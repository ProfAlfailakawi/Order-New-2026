import "dotenv/config";
import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback in-memory DB
let localFallbackDB: any = {
  products: [],
  supplierCopies: [],
  orders: [],
  invoices: [],
  customers: [],
  zones: [],
  settings: {},
  promocodes: []
};

// Attempt to load entire fallback from file first
try {
  if (fs.existsSync(path.join(__dirname, "app_data_fallback.json"))) {
    const fileData = JSON.parse(fs.readFileSync(path.join(__dirname, "app_data_fallback.json"), "utf8"));
    localFallbackDB = { ...localFallbackDB, ...fileData };
  } else {
    // legacy migrations
    if (fs.existsSync(path.join(__dirname, "shared_products.json"))) {
      localFallbackDB.products = JSON.parse(fs.readFileSync(path.join(__dirname, "shared_products.json"), "utf8"));
    }
    if (fs.existsSync(path.join(__dirname, "suppliers.json"))) {
      localFallbackDB.supplierCopies = JSON.parse(fs.readFileSync(path.join(__dirname, "suppliers.json"), "utf8")).flatMap((s:any) => s.products || []);
    }
  }
} catch(e) {
  console.log("Could not load local data files", e);
}

// Read firebase config safely for Node ESM
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"),
);

const appClient = initializeApp(firebaseConfig);
const db = initializeFirestore(
  appClient,
  { experimentalForceLongPolling: true },
  firebaseConfig.firestoreDatabaseId || "(default)",
);

async function getAppData() {
  try {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    if (d.exists()) {
      return d.data();
    }
  } catch (error) {
    console.warn("Firebase read restricted or failed, using local in-memory fallback");
  }
  return localFallbackDB;
}

async function updateAppData(data: any) {
  try {
    const docRef = doc(db, "appData", "shared_company_data");
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.warn("Firebase write restricted or failed, updating local in-memory fallback");
    localFallbackDB = { ...localFallbackDB, ...data };
    
    // Save to disk to persist across dev server restarts
    try {
      fs.writeFileSync(path.join(__dirname, "app_data_fallback.json"), JSON.stringify(localFallbackDB, null, 2));
    } catch(err) {
      console.warn("Could not save to disk:", err);
    }
  }
}


async function getAppDataRef() {
  const data = await getAppData();
  return {
    exists: () => true,
    data: () => data
  };
}

// Helper to clean phone numbers
function cleanPhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");

  // If it starts with 965 and is longer than 8 digits, it's a full country code
  if (cleaned.startsWith("965") && cleaned.length > 8) {
    cleaned = cleaned.slice(3);
  }

  // Kuwait numbers are 8 digits. Take the last 8 digits available to be safe.
  if (cleaned.length >= 8) {
    return cleaned.slice(-8);
  }
  return cleaned;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || process.env.DEFAULT_APP_PORT || 3000);

  console.log(`[STARTUP] Using PORT: ${PORT}`);
  console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[STARTUP] DEFAULT_APP_PORT: ${process.env.DEFAULT_APP_PORT}`);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes

  // 1. Track Orders
  app.get("/api/appdata", async (req, res) => {
  try {
    const d = await getAppDataRef();
    res.json(d.exists() ? d.data() : {});
  } catch(e) {
    res.status(500).json({});
  }
});

app.patch("/api/appdata", async (req, res) => {
  try {
    await updateAppData(req.body);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({});
  }
});

app.get("/api/track-orders", async (req, res) => {
    const { phone, order_id } = req.query;
    if (!phone && !order_id) {
      return res
        .status(400)
        .json({ error: "Phone number or Order ID required" });
    }

    try {
      const cleanQueryPhone = phone ? cleanPhone(phone) : null;

      const d = await getAppDataRef();
      const appData = d.data() || {};

      const allOrdersOriginal = appData.orders || [];
      const now = Date.now();
      const TIMEOUT = 90 * 60 * 1000;
      let needsUpdate = false;

      const allOrders = allOrdersOriginal.map((o: any) => {
        if (o.status === "قيد تجميع القطية" && o.createdAt) {
          const created = new Date(o.createdAt).getTime();
          if (now - created > TIMEOUT) {
            needsUpdate = true;
            return {
              ...o,
              status: "ملغي - انتهى وقت القطية",
              isInvoice: false,
            };
          }
        }
        return { ...o, isInvoice: false };
      });

      if (needsUpdate) {
        console.log(`[SPLIT] Timing out expired split payments`);
        await updateAppData({
          orders: allOrders.map((o) => {
            const { isInvoice, ...rest } = o;
            return rest;
          }),
        });
      }

      const allInvoices = (appData.invoices || []).map((inv: any) => ({
        ...inv,
        isInvoice: true,
      }));

      console.log(
        `DEBUG: Tracking orders for ${cleanQueryPhone} or order_id ${order_id}. Total shared orders: ${allOrders.length}, invoices: ${allInvoices.length}`,
      );

      const customers = appData.customers || [];
      const matchingCustomerIds = customers
        .filter(
          (c: any) =>
            cleanQueryPhone && cleanPhone(c.phone) === cleanQueryPhone,
        )
        .map((c: any) => c.id);

      // Filter function
      const filterFn = (item: any) => {
        let match = false;
        if (cleanQueryPhone) {
          const itemPhone = cleanPhone(
            item.customerPhone ||
              item.phone ||
              (item.address && item.address.phone),
          );
          match =
            itemPhone === cleanQueryPhone ||
            (item.customerId && matchingCustomerIds.includes(item.customerId));

          // Allow participants in split payments to see it
          if (!match && item.splitPayments && Array.isArray(item.splitPayments)) {
            match = item.splitPayments.some((p: any) => cleanPhone(p.phone) === cleanQueryPhone);
          }

          // Allow participants in roulette to see it
          if (!match && item.splitParticipants && Array.isArray(item.splitParticipants)) {
            match = item.splitParticipants.some((p: any) => cleanPhone(p.phone) === cleanQueryPhone);
          }
        }
        if (!match && order_id) {
          const qid = String(order_id).trim().toUpperCase();
          match =
            String(item.id).toUpperCase() === qid ||
            String(item.linkedInvoiceId).toUpperCase() === qid ||
            String(item.invoiceId).toUpperCase() === qid;
        }
        return match;
      };

      const matchedOrders = allOrders.filter(filterFn);
      const matchedInvoices = allInvoices.filter(filterFn);
      const allMatched = [...matchedOrders, ...matchedInvoices];
      console.log(
        `DEBUG: Found matched orders: ${matchedOrders.length}, invoices: ${matchedInvoices.length}`,
      );

      const finalOrders = allMatched;

      // Find customer points dynamically from invoices
      let points = 0;
      allInvoices.forEach((inv: any) => {
        const invPhone = cleanPhone(inv.customerPhone || inv.phone || "");
        if (invPhone === cleanQueryPhone) {
          points += Number(inv.total) || 0;
        }
      });
      points = Math.floor(points);

      // Sort by date descending
      finalOrders.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
      });

      const isGlobalFreeDelivery = appData.settings?.isFreeDelivery === true;
      const freeDeliveryThreshold = Number(
        appData.settings?.freeDeliveryThreshold ||
          appData.settings?.freeDeliveryLimit ||
          0,
      );

      console.log(
        `DEBUG TrackOrders: Phone=${cleanQueryPhone}, GlobalFree=${isGlobalFreeDelivery}, Threshold=${freeDeliveryThreshold}`,
      );

      const populatedOrders = finalOrders.map((o: any) => {
        const oDeliveryFeeOriginal = Number(
          o.deliveryFee ?? o.deliveryInfo?.finalPrice ?? 0,
        );
        const oTotalOriginal = Number(o.total ?? o.totalAmount ?? 0);
        const itemsTotalValue = Math.max(
          0,
          oTotalOriginal - oDeliveryFeeOriginal,
        );

        let shouldBeFree =
          o.isFreeDelivery || isGlobalFreeDelivery || o.deliveryType === "free";

        // Apply threshold dynamically even for old orders if tracked now
        if (
          !shouldBeFree &&
          freeDeliveryThreshold > 0 &&
          itemsTotalValue >= freeDeliveryThreshold
        ) {
          shouldBeFree = true;
        }

        const finalDeliveryFee = shouldBeFree ? 0 : oDeliveryFeeOriginal;
        const finalTotal = shouldBeFree ? itemsTotalValue : oTotalOriginal;

        let custName = o.customerName;
        let custPhone = o.customerPhone || o.phone;
        let custAddress = o.address;

        if (!custAddress || custAddress === "غير محدد" || custAddress === "") {
          if (o.deliveryInfo && o.deliveryInfo.zoneName) {
            custAddress = o.deliveryInfo.zoneName;
          }
        }

        const products = [
          ...(appData.products || []),
          ...(appData.supplierCopies || []),
        ];
        const populatedItems = (o.items || []).map((item: any) => {
          const prod = products.find(
            (p: any) => p.id === item.productId || p.id === item.id,
          );
          return {
            ...item,
            productName:
              item.productName ||
              item.name ||
              (prod ? prod.name : "منتج غير معروف"),
            name:
              item.name ||
              item.productName ||
              (prod ? prod.name : "منتج غير معروف"),
            price:
              item.price !== undefined
                ? item.price
                : item.priceAtTime !== undefined
                  ? item.priceAtTime
                  : prod
                    ? prod.price
                    : 0,
            image: item.image || (prod ? prod.image : null),
          };
        });

        if (
          o.customerId &&
          (!custName ||
            !custPhone ||
            !custAddress ||
            custAddress === "غير محدد" ||
            custAddress === "")
        ) {
          const c = customers.find((cust: any) => cust.id === o.customerId);
          if (c) {
            custName = custName || c.name || c.customerName;
            custPhone = custPhone || c.phone || c.customerPhone;
            if (
              !custAddress ||
              custAddress === "غير محدد" ||
              custAddress === ""
            ) {
              custAddress =
                typeof c.address === "object"
                  ? c.address?.region || "غير محدد"
                  : c.address || "غير محدد";
            }
          }
        }

        // Keep the full address object so the split page can display it
        const resolvedAddress =
          typeof custAddress === "object" && custAddress !== null
            ? custAddress
            : custAddress || "غير محدد";

        return {
          ...o,
          items: populatedItems,
          customerName: custName,
          customerPhone: custPhone,
          address: resolvedAddress,
          customerPoints: points,
          isFreeDelivery: shouldBeFree,
          deliveryType: shouldBeFree ? "free" : o.deliveryType,
          deliveryFee: finalDeliveryFee,
          total: finalTotal,
        };
      });
      res.json(populatedOrders);
    } catch (error) {
      console.error("Error tracking orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // 2. Regions
  app.get("/api/regions", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      res.json(data.zones || []);
    } catch (error) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ error: "Failed to fetch regions" });
    }
  });

  // Admin Zones Management
  app.post("/api/admin/zones", async (req, res) => {
    try {
      const { name, finalPrice } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      const zones = appData.zones || [];

      const newZone = {
        id: "ZONE-" + Date.now().toString(36),
        name,
        finalPrice: Number(finalPrice) || 0,
        cost: Number(finalPrice) || 0,
        deliveryFee: Number(finalPrice) || 0,
        price: Number(finalPrice) || 0,
        deliveryPrice: Number(finalPrice) || 0,
      };

      zones.push(newZone);
      await updateAppData({ zones });
      res.status(201).json(newZone);
    } catch (e) {
      console.error("Error creating zone:", e);
      res.status(500).json({ error: "Failed to create zone" });
    }
  });

  app.patch("/api/admin/zones/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, finalPrice } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      const zones = appData.zones || [];

      const index = zones.findIndex((z: any) => z.id === id);
      if (index === -1)
        return res.status(404).json({ error: "Zone not found" });

      zones[index] = {
        ...zones[index],
        ...(name && { name }),
        ...(finalPrice !== undefined && {
          finalPrice: Number(finalPrice),
          cost: Number(finalPrice),
          deliveryFee: Number(finalPrice),
          price: Number(finalPrice),
          deliveryPrice: Number(finalPrice),
        }),
      };

      await updateAppData({ zones });
      res.json(zones[index]);
    } catch (e) {
      console.error("Error updating zone:", e);
      res.status(500).json({ error: "Failed to update zone" });
    }
  });

  app.delete("/api/admin/zones/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      const zones = appData.zones || [];

      const newZones = zones.filter((z: any) => z.id !== id);
      await updateAppData({ zones: newZones });
      res.json({ success: true });
    } catch (e) {
      console.error("Error deleting zone:", e);
      res.status(500).json({ error: "Failed to delete zone" });
    }
  });

  // Admin: Update Store Status
  app.patch("/api/admin/settings/storeStatus", async (req, res) => {
    try {
      const docRef = doc(db, "appData", "shared_company_data");
      await updateAppData({
        "settings.storeStatus": req.body,
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Error updating store status:", e);
      res.status(500).json({ error: "Failed to update store status" });
    }
  });

  // Validate Promo Code
  app.post("/api/validate-promo", async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code is required" });

    try {
      const d = await getAppDataRef();
      if (!d.exists()) return res.status(404).json({ error: "No data found" });

      const data = d.data();
      const promo = (data.promocodes || []).find(
        (p: any) =>
          p.code.toUpperCase() === code.trim().toUpperCase() && p.isActive,
      );

      if (promo) {
        res.json({
          success: true,
          promo: {
            code: promo.code,
            type: promo.type, // 'percentage' or 'flat'
            value: promo.value || promo.discountValue,
            discountValue: promo.discountValue || promo.value,
          },
        });
      } else {
        res.json({ success: false, error: "كوبون غير صالح أو انتهت صلاحيته" });
      }
    } catch (e) {
      console.error("Error validating promo:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 3. Settings (fallback to shared_company_data)
  app.get("/api/settings", async (req, res) => {
    try {
      let settings: any = {};
      const d = await getAppDataRef();
      if (d.exists()) {
        const data = d.data();
        settings = data.settings || {};

        // Include company info from root if it exists
        if (data.info) {
          settings = { ...settings, ...data.info };
        }

        // Fallback for phone numbers: check multiple possible sources
        if (!settings.companyPhone) {
          const fallback =
            settings.whatsapp ||
            settings.phone ||
            (settings.restaurantNumbers && settings.restaurantNumbers[0]);
          if (fallback) {
            settings.companyPhone = fallback;
          }
        }
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // 4. Customers
  app.get("/api/customers", async (req, res) => {
    let { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: "Phone number required" });
    }
    try {
      const cleanQueryPhone = cleanPhone(phone);

      const d = await getAppDataRef();
      const data = d.data() || {};
      const customers = data.customers || [];
      const invoices = data.invoices || [];

      // Calculate total points dynamically from invoices
      let dynamicPoints = 0;
      invoices.forEach((inv: any) => {
        const invPhone = cleanPhone(inv.customerPhone || inv.phone || "");
        if (invPhone === cleanQueryPhone) {
          dynamicPoints += Number(inv.total) || 0;
        }
      });
      dynamicPoints = Math.floor(dynamicPoints);

      let matchedCustomers: any[] = [];
      customers.forEach((customer: any) => {
        const phoneField = customer.phone;
        if (phoneField && cleanPhone(phoneField) === cleanQueryPhone) {
          matchedCustomers.push({
            ...customer,
            // Keep their original points, or add dynamic points, but don't just blindly overwrite 
            // if dynamicPoints is 0!
            loyaltyPoints: customer.loyaltyPoints !== undefined ? customer.loyaltyPoints : dynamicPoints,
          });
        }
      });

      // If no customer profile found, try to synthesize one from their latest invoice
      if (matchedCustomers.length === 0) {
        // Reverse array to find the most recent one easily (since new ones are pushed to the end)
        const recentInvoice = [...invoices].reverse().find((inv: any) => {
          return cleanPhone(inv.customerPhone || inv.phone || "") === cleanQueryPhone;
        });
        
        if (recentInvoice) {
          matchedCustomers.push({
            name: recentInvoice.customerName || recentInvoice.name || "",
            phone: phone,
            address: recentInvoice.address || null,
            loyaltyPoints: dynamicPoints,
          });
        }
      }

      // If still nothing, try from orders
      if (matchedCustomers.length === 0) {
        const orders = data.orders || [];
        const recentOrder = [...orders].reverse().find((o: any) => {
          return cleanPhone(o.customerPhone || o.phone || "") === cleanQueryPhone;
        });

        if (recentOrder) {
          matchedCustomers.push({
            name: recentOrder.customerName || recentOrder.name || "",
            phone: phone,
            address: recentOrder.address || null,
            loyaltyPoints: dynamicPoints,
          });
        }
      }

      return res.json(matchedCustomers);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Helper function to process products uniformly
  const processProducts = (rawProducts: any[]) => {
    let products = (rawProducts || []).filter(
      (p: any) =>
        p.isActive !== false &&
        p.isHidden !== true &&
        p.hidden !== true &&
        p.visible !== false &&
        p.isVisible !== false,
    );

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    products = products.map((p: any) => {
      let isNew = p.isNewProduct === true || p.isNew === true;
      if (!isNew && (p.createdAt || p.dateAdded || p.date)) {
        let timestamp = 0;
        if (p.createdAt && typeof p.createdAt === 'object' && p.createdAt.seconds) timestamp = p.createdAt.seconds * 1000;
        else if (p.createdAt) timestamp = new Date(p.createdAt).getTime();
        else if (p.dateAdded) timestamp = new Date(p.dateAdded).getTime();
        else if (p.date) timestamp = new Date(p.date).getTime();
        
        if (timestamp > thirtyDaysAgo) {
          isNew = true;
        }
      }
      return { ...p, isNewProduct: isNew };
    });

    return products;
  };

  // 5. Top Products
  app.get("/api/top-products", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const allProducts = [...(data.products || []), ...(data.supplierCopies || [])];

      let products = processProducts(allProducts);
      const allInvoices = data.invoices || [];

      const productStats: any = {};
      allInvoices.forEach((order: any) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (!item.productId) return;
            if (!productStats[item.productId]) {
              productStats[item.productId] = { count: 0, revenue: 0 };
            }
            const quantity = Number(item.quantity) || 1;
            const price = Number(item.priceAtTime || item.price || 0);
            productStats[item.productId].count += quantity;
            productStats[item.productId].revenue += price * quantity;
          });
        }
      });

      // 1. Top products by quantity (Total Quantity) - take top 15
      const byQuantity = [...products]
        .filter((p) => (productStats[p.id]?.count || 0) > 0)
        .sort(
          (a, b) =>
            (productStats[b.id]?.count || 0) - (productStats[a.id]?.count || 0),
        )
        .slice(0, 15);

      // 2. Top products by sales amount (Total Sales) - take top 15
      const byRevenue = [...products]
        .filter((p) => (productStats[p.id]?.revenue || 0) > 0)
        .sort(
          (a, b) =>
            (productStats[b.id]?.revenue || 0) -
            (productStats[a.id]?.revenue || 0),
        )
        .slice(0, 15);

      // Mix both and remove duplicates
      const mixedMap = new Map();
      byQuantity.forEach((p) => mixedMap.set(p.id, p));
      byRevenue.forEach((p) => mixedMap.set(p.id, p));

      let allTopProducts = Array.from(mixedMap.values());
      
      // If we don't have enough data, fallback to active products
      if (allTopProducts.length < 6) {
        const fallbacks = [...products].filter(p => !p.isHidden && !p.isOutOfStock).slice(0, 20);
        fallbacks.forEach(p => {
          if (!mixedMap.has(p.id)) {
            allTopProducts.push(p);
            mixedMap.set(p.id, p);
          }
        });
      }

      // Randomly select 6 products from the pool so it changes on every load
      const shuffled = allTopProducts.sort(() => 0.5 - Math.random());
      let topProductsList = shuffled.slice(0, 6);

      res.json(topProductsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top products" });
    }
  });

  // 6. Products
  app.get("/api/recent-fomo", async (req, res) => {
    try {
      // First, get all active products from the shared database
      const activeProductsSnap = await getAppDataRef();
      const activeProducts =
        activeProductsSnap.data()?.products?.filter((p: any) => !p.isHidden) ||
        [];
      const activeProductNames = new Set(
        activeProducts.map((p: any) => p.name),
      );

      // Get the most recent 150 orders to find valid recent purchases
      const allOrders = activeProductsSnap.data()?.orders || [];
      const allInvoices = activeProductsSnap.data()?.invoices || [];
      const combinedOrders = [...allOrders, ...allInvoices].sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
      }).slice(0, 150);

      const recentOrders: any[] = [];
      const seenNames = new Set<string>();

      combinedOrders.forEach((data: any) => {
        if (
          data.customerName &&
          data.address &&
          typeof data.address === "object" &&
          data.address.region &&
          data.address.region !== "غير محدد"
        ) {
          // Only include realistic ones
          if (
            (data.status === "paid" ||
              data.status === "تم الدفع" ||
              data.status === "pending" ||
              data.status === "قيد الانتظار" ||
              data.status === "تم الدفع وجاري التوصيل") &&
            recentOrders.length < 50
          ) {
            const items = data.items || [];
            // STRICT: Only use items that EXACTLY match real products in the shared database
            const validItems = items.filter(
              (i: any) => i && i.name && activeProductNames.has(i.name),
            );
            const randomItem =
              validItems.length > 0
                ? validItems[Math.floor(Math.random() * validItems.length)]
                : null;

            if (randomItem) {
              let fNameParts = String(data.customerName).trim().split(" ");
              let fName = fNameParts[0] || "عميل";
              if (
                (fName === "ام" ||
                  fName === "أم" ||
                  fName === "ابو" ||
                  fName === "أبو" ||
                  fName === "بو") &&
                fNameParts.length > 1
              ) {
                fName = fName + " " + fNameParts[1];
              }

              if (!seenNames.has(fName)) {
                seenNames.add(fName);
                // STRICT: Use real area and real time from the order itself
                const area = data.address.region;

                let timestamp = data.createdAt;
                if (timestamp?.toDate) timestamp = timestamp.toDate();
                else if (typeof timestamp === "number")
                  timestamp = new Date(timestamp);
                else if (typeof timestamp === "string")
                  timestamp = new Date(timestamp);
                else timestamp = new Date(); // fallback if missing

                recentOrders.push({
                  name: fName,
                  area: area,
                  time: timestamp.toISOString(),
                  productName: randomItem.name,
                });
              }
            }
          }
        }
      });

      // We do NOT pad with fake orders anymore. Only real data from the database.

      // Shuffle the final list to keep it feeling fresh without altering real data
      const shuffled = recentOrders.sort(() => 0.5 - Math.random());
      res.json(shuffled);
    } catch (e) {
      console.error("Failed to get recent FOMO:", e);
      res.status(500).json([]);
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const allProducts = [...(data.products || []), ...(data.supplierCopies || [])];
      let products = processProducts(allProducts);

      // Sort alphabetically
      products.sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "", "ar"),
      );

      res.json(products);
    } catch (error) {
      console.error("DEBUG: Failed to fetch products in /api/products:", error);
      res.status(500).json({
        error: "Failed to fetch products",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Function to generate a unified, completely unique ID
  function generateUnifiedId(prefix = "ORD") {
    const timestamp = Date.now();
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    return `${prefix}-${timestamp}-${randomSuffix}`;
  }

  // 7. Orders Submission
  app.post("/api/orders", async (req, res) => {
    const {
      customerName,
      customerPhone,
      address,
      items,
      deliveryFee,
      total,
      regionId,
      generalNotes,
      isFreeDelivery,
      deliveryType,
      status,
      paymentStatus,
      splitType,
    } = req.body;

    console.log(
      `[ORDER] New order request from ${customerPhone} (${customerName}) total: ${total}`,
    );

    // Basic validation
    if (
      !customerName ||
      !customerPhone ||
      !address ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0 ||
      typeof total !== "number"
    ) {
      console.warn("[ORDER] Invalid order data received:", req.body);
      return res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
    }

    const orderCustomId = generateUnifiedId("ORD");

    const newOrder: any = {
      id: orderCustomId,
      linkedInvoiceId: orderCustomId,
      customerName: String(customerName).substring(0, 100),
      customerPhone: String(customerPhone).substring(0, 20),
      address: typeof address === "string" ? { full: address } : { ...address },
      items,
      deliveryFee: deliveryFee || 0,
      isFreeDelivery: isFreeDelivery || false,
      deliveryType: deliveryType || (isFreeDelivery ? "free" : null),
      total,
      regionId: regionId || null,
      status: status || (total < 0.001 ? "تم الدفع وجاري التوصيل" : "جديد"),
      paymentStatus: paymentStatus || (total < 0.001 ? "paid" : "pending"),
      createdAt: new Date().toISOString(),
      source: "customer_website",
      generalNotes: generalNotes || "",
    };

    if (splitType) {
      newOrder.splitType = splitType;
    }

    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();

      if (!d.exists()) {
        console.error("[ORDER] shared_company_data document NOT FOUND");
        return res.status(500).json({ error: "فشل الوصول إلى قاعدة البيانات" });
      }

      const appData = d.data() || {};
      const orders = appData.orders || [];
      const customers = appData.customers || [];
      const products = [
        ...(appData.products || []),
        ...(appData.supplierCopies || []),
      ];

      // Validate all items are currently active
      for (const item of items) {
        const product = products.find(
          (p: any) => p.id === item.productId || p.id === item.id,
        );
        if (product && product.isActive === false) {
          return res
            .status(400)
            .json({ error: `المنتج ${product.name} غير متوفر حالياً` });
        }
      }

      orders.push(newOrder);

      // Update customer record basic info but NOT points/loyalty
      const cleanPhoneQuery = cleanPhone(customerPhone);
      let existingIndex = -1;

      customers.forEach((c: any, idx: number) => {
        if (cleanPhone(c.phone) === cleanPhoneQuery) {
          existingIndex = idx;
        }
      });

      if (existingIndex >= 0) {
        customers[existingIndex] = {
          ...customers[existingIndex],
          name: newOrder.customerName,
          address: newOrder.address,
          lastOrderDate: newOrder.createdAt,
        };
      } else {
        customers.push({
          id: "CUST-" + Date.now().toString(36),
          name: newOrder.customerName,
          phone: newOrder.customerPhone,
          address: newOrder.address,
          lastOrderDate: newOrder.createdAt,
          loyaltyPoints: 0,
          points: 0,
        });
      }

      await updateAppData({
        orders,
        customers,
      });

      console.log(`[ORDER] Order ${newOrder.id} saved successfully`);
      res.status(201).json(newOrder);
    } catch (e) {
      console.error("[ORDER] Critical error creating order:", e);
      res.status(500).json({ error: "حدث خطأ غير متوقع في الخادم" });
    }
  });

  app.get("/api/create-test-split-order", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const orders = data.orders || [];
      const newOrder = {
        id: `ORD-TEST-${Date.now()}`,
        status: "قيد تجميع القطية",
        total: 100,
        customerPhone: "99999999",
        createdAt: new Date().toISOString(),
      };
      orders.push(newOrder);
      await updateAppData({ orders });
      res.json({ orderId: newOrder.id, message: "Order created successfully" });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Split Payment Endpoint
  app.post("/api/create-split-payment", async (req, res) => {
    try {
      const { orderId, name, amount, customerMobile, customerEmail } = req.body;

      if (!orderId || !amount || isNaN(parseFloat(amount))) {
        console.error("[SPLIT] Invalid request params:", { orderId, amount });
        return res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
      }

      console.log(
        `[SPLIT] Creating partial payment for Order ${orderId}: ${amount} KWD by ${name}`,
      );

      const d = await getAppDataRef();
      const data = d.data() || {};
      const orders = data.orders || [];
      const invoices = data.invoices || [];

      let index = orders.findIndex(
        (o: any) =>
          String(o.id).trim().toUpperCase() ===
          String(orderId).trim().toUpperCase(),
      );
      let isInvoice = false;

      if (index === -1) {
        index = invoices.findIndex(
          (o: any) =>
            String(o.id).trim().toUpperCase() ===
            String(orderId).trim().toUpperCase(),
        );
        if (index !== -1) {
          isInvoice = true;
        }
      }

      if (index === -1) {
        console.error(`[SPLIT] Order/Invoice ${orderId} not found`);
        return res.status(400).json({ error: "الطلب غير موجود" });
      }

      const existingOrder = isInvoice ? invoices[index] : orders[index];

      const rawApiKey = process.env.UPAYMENTS_API_KEY;
      if (!rawApiKey) {
        console.error("[SPLIT] UPAYMENTS_API_KEY is missing");
        return res.status(500).json({ error: "UPAYMENTS_API_KEY is missing." });
      }

      let cleanApiKey = rawApiKey.replace(/[^\x20-\x7E]/g, "").trim();
      if (cleanApiKey.toLowerCase().startsWith("bearer "))
        cleanApiKey = cleanApiKey.substring(7).trim();
      else if (cleanApiKey.toLowerCase().startsWith("token "))
        cleanApiKey = cleanApiKey.substring(6).trim();

      const uniqueSuffix =
        Date.now().toString(36).slice(-6) +
        Math.random().toString(36).substring(2, 6);
      const splitId = `S-${uniqueSuffix}`;

      const isSandbox =
        String(process.env.UPAYMENTS_MODE || "").toLowerCase() === "sandbox" ||
        String(process.env.UPAYMENTS_ENV || "").toLowerCase() === "sandbox" ||
        cleanApiKey.toLowerCase().includes("sandbox") ||
        cleanApiKey.startsWith("test_");
      const upaymentsApiUrl = isSandbox
        ? "https://sandboxapi.upayments.com/api/v1/charge"
        : "https://uapi.upayments.com/api/v1/charge";

      let protocol = req.headers["x-forwarded-proto"] || req.protocol;
      let host = req.headers["x-forwarded-host"] || req.get("host");
      let reqOrigin = req.get("origin");
      let devOrProdUrl = (reqOrigin && reqOrigin !== "null" && reqOrigin !== "undefined") ? reqOrigin : protocol + "://" + host;

      if (!devOrProdUrl || devOrProdUrl.includes("undefined") || devOrProdUrl === "null") {
        devOrProdUrl = "https://alturathkw.shop";
      }

      // If localhost, fallback to public url for Upayments to accept it
      if (devOrProdUrl.includes("localhost")) {
        devOrProdUrl = "https://alturathkw.shop";
      }
      
      // Ensure no trailing slash
      devOrProdUrl = devOrProdUrl.replace(/\/$/, "");

      const finalAmount = parseFloat(amount).toFixed(3);
      const numericAmount = parseFloat(finalAmount);

      const generatedReturnUrl = `${devOrProdUrl}/split/${orderId}?payment=success`;
      const generatedCancelUrl = `${devOrProdUrl}/split/${orderId}?payment=failed`;
      const generatedNotifyUrl = `${devOrProdUrl}/api/payment-webhook/${orderId}/${splitId}`;

      console.log(`[SPLIT] Generated Notify URL: ${generatedNotifyUrl}`);

      // Update with pending split info
      if (!existingOrder.splitPayments) existingOrder.splitPayments = [];

      existingOrder.splitPayments.push({
        id: splitId,
        name: name || "Customer",
        phone: customerMobile || "",
        amount: numericAmount,
        status: "pending",
        date: new Date().toISOString(),
      });

      try {
        if (isInvoice) {
          invoices[index] = existingOrder;
          await updateAppData({
            invoices,
          });
        } else {
          orders[index] = existingOrder;
          await updateAppData({
            orders,
          });
        }
      } catch (dbErr: any) {
        console.error("[SPLIT] Firestore Update Error:", dbErr);
        return res.status(500).json({
          error: "فشل تحديث بيانات الطلب في قاعدة البيانات",
          details: dbErr.message,
        });
      }

      const upaymentsPayload = {
        returnUrl: generatedReturnUrl,
        cancelUrl: generatedCancelUrl,
        notificationUrl: generatedNotifyUrl,
        language: "ar",
        paymentGateway: { src: "knet" },
        order: {
          id: splitId,
          currency: "KWD",
          amount: numericAmount,
        },
        reference: { id: `${orderId}-${splitId}` },
        customer: {
          uniqueId: customerMobile
            ? `cid_${customerMobile}`
            : `cid_${uniqueSuffix}`,
          name: name || "Customer",
          email: customerEmail || "Dr.Ahmad.Alfailakawi@gmail.com",
          mobile: customerMobile || "00000000",
        },
      };

      // Call UPAYMENTS via AXIOS for better timeout and error handling
      let paymentResponse: any;
      try {
        console.log(`[SPLIT] Calling UPayments API: ${upaymentsApiUrl}`);
        const response = await axios.post(upaymentsApiUrl, upaymentsPayload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${cleanApiKey}`,
          },
          timeout: 15000, // 15s timeout
        });
        paymentResponse = response.data;
      } catch (error: any) {
        const status = error.response?.status || 500;
        const errorData = error.response?.data || {};
        console.error("[SPLIT] External API Error:", status, errorData);

        let errMsg =
          errorData.error || errorData.message || "فشل الاتصال بمزود الدفع";
        if (status === 401) errMsg = "مفتاح الربط الخاص بالدفع غير صالح";

        const safeStatus = status === 404 ? 400 : status;
        return res.status(safeStatus).json({
          error: errMsg,
          details: errorData,
        });
      }

      if (
        paymentResponse.status &&
        paymentResponse.data &&
        paymentResponse.data.link
      ) {
        console.log(
          `[SPLIT] Payment link created: ${paymentResponse.data.link}`,
        );
        res.json({ paymentLink: paymentResponse.data.link });
      } else {
        console.error("[SPLIT] Invalid response structure:", paymentResponse);
        res.status(500).json({
          error:
            "فشل في إنشاء الرابط: " +
            (paymentResponse.message || "استجابة غير صالحة من البوابة"),
          details: paymentResponse,
        });
      }
    } catch (e: any) {
      console.error("[SPLIT] Exception:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Payment Endpoint
  app.post("/api/create-payment", async (req, res) => {
    try {
      const {
        amount,
        customerName,
        customerEmail,
        customerMobile,
        orderId,
        description,
        returnUrl,
        cancelUrl,
        notificationUrl,
        isPopup,
      } = req.body;

      if (orderId) {
        const d = await getAppDataRef();
        const data = d.data() || {};
        const orders = data.orders || [];
        const existingOrder = orders.find((o: any) => o.id === orderId);
        if (
          existingOrder &&
          (existingOrder.paymentStatus === "paid" ||
            (existingOrder.status || "").startsWith("تم الدفع"))
        ) {
          return res.status(400).json({ error: "هذا الطلب مدفوع بالفعل" });
        }
      }

      // Get API token from environment variable
      const rawApiKey = process.env.UPAYMENTS_API_KEY;

      if (!rawApiKey) {
        console.error(
          "[PAYMENT ERROR] UPAYMENTS_API_KEY is missing from environment variables.",
        );
        return res.status(500).json({
          error:
            "الرجاء إضافة مفتاح المبيعات الحقيقي (Live API Key) من UPayments في إعدادات التطبيق (Environment Variables) تحت اسم UPAYMENTS_API_KEY ليتم تفعيل الدفع بنجاح.",
        });
      }

      // Clean key and handle cases where 'Bearer ' might already be included
      let cleanApiKey = rawApiKey.replace(/[^\x20-\x7E]/g, "").trim();
      if (cleanApiKey.toLowerCase().startsWith("bearer ")) {
        cleanApiKey = cleanApiKey.substring(7).trim();
      } else if (cleanApiKey.toLowerCase().startsWith("token ")) {
        cleanApiKey = cleanApiKey.substring(6).trim();
      }

      if (cleanApiKey.length === 0) {
        console.error(
          "[PAYMENT] INVALID KEY DETECTED - User might have pasted dots/bullets instead of actual key.",
        );
        return res.status(400).json({
          error:
            "مفتاح الربط الخاص بالدفع غير صالح. يبدو أنك قمت بنسخ نقاط (••••) بدلاً من المفتاح الحقيقي. يرجى التأكد من نسخ المفتاح الفعلي من لوحة تحكم UPayments ولصقه في إعدادات التطبيق.",
        });
      }

      // Ensure absolutely unique track ID for KNET by using timestamp and random string (max length 20 chars total)
      const uniqueSuffix =
        Date.now().toString(36).slice(-6) +
        Math.random().toString(36).substring(2, 6);
      const knetTrackId = `O-${uniqueSuffix}`;

      // Define base url depending on if it contains sandbox markers
      const isSandbox =
        String(process.env.UPAYMENTS_MODE || "").toLowerCase() === "sandbox" ||
        String(process.env.UPAYMENTS_ENV || "").toLowerCase() === "sandbox" ||
        cleanApiKey.toLowerCase().includes("sandbox") ||
        cleanApiKey.startsWith("test_");

      // Prefer standard production endpoint
      const upaymentsApiUrl = isSandbox
        ? "https://sandboxapi.upayments.com/api/v1/charge"
        : "https://uapi.upayments.com/api/v1/charge";

      // Log token details (truncated for security) to help debug 401 errors
      console.log(
        `[PAYMENT] UPAYMENTS_API_KEY exists: ${!!process.env.UPAYMENTS_API_KEY}, length: ${rawApiKey.length}`,
      );
      const tokenPrefix = cleanApiKey.substring(0, 5) + "...";
      console.log(
        `[PAYMENT] Creating payment with isSandbox=${isSandbox}, token starts with ${tokenPrefix}, Url: ${upaymentsApiUrl}`,
      );

      let protocol = req.headers["x-forwarded-proto"] || req.protocol;
      let host = req.headers["x-forwarded-host"] || req.get("host");
      let reqOrigin = req.get("origin");
      let devOrProdUrl = (reqOrigin && reqOrigin !== "null" && reqOrigin !== "undefined") ? reqOrigin : protocol + "://" + host;

      // Remove any forced replacement
      if (!devOrProdUrl || devOrProdUrl.includes("undefined") || devOrProdUrl === "null") {
        devOrProdUrl = "https://alturathkw.shop"; // fallback only
      }
      
      // If localhost, fallback to public url for Upayments to accept it
      if (devOrProdUrl.includes("localhost")) {
        devOrProdUrl = "https://alturathkw.shop";
      }
      
      // Ensure no trailing slash
      devOrProdUrl = devOrProdUrl.replace(/\/$/, "");

      // Return browser to whichever environment initiated the payment
      const generatedReturnUrl = `${devOrProdUrl}/api/payment-return/${orderId}/success${isPopup ? "?isPopup=true" : ""}`;
      const generatedCancelUrl = `${devOrProdUrl}/api/payment-return/${orderId}/failed${isPopup ? "?isPopup=true" : ""}`;
      // Webhooks should ideally go to the environment that initiated it
      const generatedNotifyUrl = `${devOrProdUrl}/api/payment-webhook/${orderId}`;

      const finalReturnUrl = generatedReturnUrl;
      const finalCancelUrl = generatedCancelUrl;
      const finalNotificationUrl = generatedNotifyUrl;

      console.log(
        `[PAYMENT] URLs generated - Return: ${finalReturnUrl}, Notify: ${finalNotificationUrl}`,
      );

      // Save payment ID to order before creating link
      const d = await getAppDataRef();
      const data = d.data() || {};
      const orders = data.orders || [];
      const index = orders.findIndex((o: any) => o.id === orderId);
      if (index !== -1) {
        orders[index].paymentId = knetTrackId;
        await updateAppData({ orders });
      }

      // Check if amount is valid for UPayments (min 0.001 KWD)
      const finalAmount = parseFloat(amount);
      if (finalAmount < 0.001) {
        console.log(
          `[PAYMENT] Skipping UPayments for 0 or small amount: ${finalAmount}`,
        );
        // If it's 0, we treat it as a pre-paid/free successful transaction
        return res.json({
          success: true,
          paymentLink: `${devOrProdUrl}/api/payment-return/${orderId}/success${isPopup ? "?isPopup=true" : ""}`,
        });
      }

      // Define the Upayments mapped payload
      const upaymentsPayload = {
        returnUrl: finalReturnUrl,
        cancelUrl: finalCancelUrl,
        notificationUrl: finalNotificationUrl,
        language: "ar",
        paymentGateway: { src: "knet" },
        order: {
          id: knetTrackId,
          currency: "KWD",
          amount: finalAmount,
        },
        reference: { id: orderId },
        customer: {
          uniqueId: customerMobile
            ? `cid_${customerMobile}`
            : `cid_${uniqueSuffix}`,
          name: customerName || "Customer",
          email: customerEmail || "Dr.Ahmad.Alfailakawi@gmail.com",
          mobile: customerMobile || "00000000",
        },
      };

      let paymentResponse: any;
      try {
        const apiRes = await axios.post(upaymentsApiUrl, upaymentsPayload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${cleanApiKey}`,
          },
          timeout: 15000,
        });
        paymentResponse = apiRes.data;
      } catch (error: any) {
        const status = error.response?.status || 500;
        const errorData = error.response?.data || {};
        console.error("[PAYMENT] UPayments API Error:", status, errorData);

        if (status === 401) {
          return res.status(500).json({
            error:
              "مفتاح الربط الخاص بالدفع غير صالح، يرجى التأكد من الـ API Key الخاص بـ UPayments.",
          });
        }

        const errMsg =
          errorData.error || errorData.message || `UPayments Error: ${status}`;
        return res.status(status).json({ error: errMsg, details: errorData });
      }

      if (
        paymentResponse.status &&
        paymentResponse.data &&
        paymentResponse.data.link
      ) {
        res.json({ paymentLink: paymentResponse.data.link });
      } else {
        console.error("[PAYMENT] Failed to generate link:", paymentResponse);
        res.status(500).json({
          error: paymentResponse.data?.error || "Failed to create payment link",
        });
      }
    } catch (err: any) {
      console.error("Error creating payment:", err);
      res
        .status(500)
        .json({ error: "Failed to create payment", details: err.message });
    }
  });

  // Update Payment Link
  app.put("/api/orders/:id/payment-link", async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentLink } = req.body;
      if (!paymentLink) return res.status(400).json({ error: "No link" });

      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      let orders = appData.orders || [];
      const index = orders.findIndex((o: any) => o.id === id);
      if (index !== -1) {
        orders[index].paymentLink = paymentLink;
        await updateAppData({ orders });
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save link" });
    }
  });

  // Join Roulette
  app.post("/api/orders/:id/join-roulette", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      if (!name) return res.status(400).json({ error: "Missing name" });

      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      let orders = appData.orders || [];
      const index = orders.findIndex((o: any) => o.id === id);
      if (index !== -1) {
        if (!orders[index].splitParticipants) {
          orders[index].splitParticipants = [];
        }
        if (
          !orders[index].splitParticipants.some((p: any) => p.name === name || (phone && p.phone === phone))
        ) {
          orders[index].splitParticipants.push({
            name,
            phone,
            joinedAt: new Date().toISOString(),
          });
          await updateAppData({ orders });
        }
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to join roulette" });
    }
  });

  // Spin Roulette
  app.post("/api/orders/:id/spin-roulette", async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      let orders = appData.orders || [];
      const index = orders.findIndex((o: any) => o.id === id);
      if (index === -1)
        return res.status(400).json({ error: "Order not found" });

      const order = orders[index];
      if (!order.splitParticipants || order.splitParticipants.length === 0) {
        return res.status(400).json({ error: "No participants" });
      }

      const loserIndex = Math.floor(
        Math.random() * order.splitParticipants.length,
      );
      const loser = order.splitParticipants[loserIndex];

      order.rouletteLoser = loser.name;
      order.rouletteSpunAt = new Date().toISOString();

      await updateAppData({ orders });
      res.json({ success: true, loser: loser.name });
    } catch (e) {
      res.status(500).json({ error: "Failed to spin roulette" });
    }
  });

  // Payment Webhook
  app.post(
    ["/api/payment-webhook/:pathOrderId/:pathSplitId", "/api/payment-webhook/:pathOrderId", "/api/payment-webhook"],
    async (req, res) => {
      try {
        console.log(
          `[PAYMENT] Webhook received at ${new Date().toISOString()}:`,
          JSON.stringify(req.body),
        );

        const pathOrder = req.params?.pathOrderId as string;
        const pathSplit = req.params?.pathSplitId as string;
        const queryId =
          (req.query.order_id as string) || (req.query.TrackID as string);
        let orderId = pathOrder || queryId;

        if (!orderId && req.body?.reference?.id) {
          orderId = req.body.reference.id;
        }

        if (!orderId && req.body?.order_id) {
          orderId = req.body.order_id;
        }

        if (orderId && typeof orderId === "string" && orderId.includes("?")) {
          const parts = orderId.split("?");
          orderId = parts[0];
        }

        console.log(`[PAYMENT] Processing webhook for orderId: ${orderId}`);

        let statusStr = String(
          req.body?.status ||
            req.body?.Result ||
            req.query?.status ||
            req.query?.result ||
            req.query?.Result ||
            "",
        )
          .toUpperCase()
          .trim();
        if (statusStr.includes("?")) statusStr = statusStr.split("?")[0];
        const status =
          ["SUCCESS", "CAPTURED", "PAID", "APPROVED", "SUCCESSFUL"].includes(
            statusStr,
          ) ||
          req.body?.status === true ||
          req.body?.status === "success" ||
          req.body?.result === "success" ||
          req.body?.Result === "success";

        if (orderId) {
          const docRef = doc(db, "appData", "shared_company_data");
          const d = await getAppDataRef();
          const appData = d.data() || {};
          let orders = appData.orders || [];
          let invoices = appData.invoices || [];
          let isSplit = false;
          let originalOrderIdAsString = String(orderId);
          let baseOrderId = originalOrderIdAsString.toUpperCase();
          let splitId = pathSplit || (req.query.splitId as string) || "";

          if (splitId || baseOrderId.includes("-S")) {
            isSplit = true;
            if (baseOrderId.includes("-S") && originalOrderIdAsString.includes("-S")) {
              const partsOriginal = originalOrderIdAsString.split("-S");
              baseOrderId = partsOriginal[0].toUpperCase();
              if (!splitId) splitId = "S" + partsOriginal[1];
            }
          }

          const orderIndex = orders.findIndex(
            (o: any) => String(o.id).toUpperCase() === baseOrderId,
          );
          const invoiceIndex = invoices.findIndex(
            (o: any) => String(o.id).toUpperCase() === baseOrderId,
          );

          let updated = false;

          if (orderIndex !== -1) {
            if (isSplit) {
              if (!orders[orderIndex].splitPayments)
                orders[orderIndex].splitPayments = [];
              const splitIdx = orders[orderIndex].splitPayments.findIndex(
                (s: any) => s.id === splitId,
              );
              if (splitIdx !== -1) {
                if (status) {
                  orders[orderIndex].splitPayments[splitIdx].status = "paid";
                  orders[orderIndex].splitPayments[splitIdx].paymentId =
                    req.body?.reference?.id ||
                    req.body?.TrackID ||
                    req.query?.TrackID;
                  updated = true;
                  console.log(
                    `[PAYMENT] Split ${splitId} for Order ${baseOrderId} updated to paid`,
                  );

                  const payer = orders[orderIndex].splitPayments[splitIdx];
                  const cPhone = cleanPhone(payer.phone);
                  if (cPhone) {
                    const customers = appData.customers || [];
                    const existingCustIdx = customers.findIndex(
                      (c: any) => cleanPhone(c.phone) === cPhone,
                    );
                    if (existingCustIdx === -1) {
                      customers.push({
                        id:
                          "CUST-" +
                          Date.now().toString(36) +
                          Math.random().toString(36).slice(-4),
                        name: payer.name || "صديق عميل",
                        phone: payer.phone,
                        acquired_via_split: true,
                        createdAt: new Date().toISOString(),
                        totalSpent: Number(payer.amount) || 0,
                      });
                    } else {
                      customers[existingCustIdx].totalSpent =
                        (Number(customers[existingCustIdx].totalSpent) || 0) +
                        (Number(payer.amount) || 0);
                      customers[existingCustIdx].loyaltyPoints =
                        (Number(customers[existingCustIdx].loyaltyPoints) ||
                          0) + (Number(payer.amount) || 0);
                      customers[existingCustIdx].lastUpdated =
                        new Date().toISOString();
                    }
                    appData.customers = customers;
                  }

                  // Check if total is fulfilled
                  const totalPaid = orders[orderIndex].splitPayments
                    .filter((s: any) => s.status === "paid")
                    .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);

                  const totalPaidFils = Math.round(totalPaid * 1000);
                  const orderTotalFils = Math.round((Number(orders[orderIndex].total) || 0) * 1000);

                  if (totalPaidFils === orderTotalFils) {
                    orders[orderIndex].status = "تم الدفع وجاري التوصيل";
                    orders[orderIndex].paymentStatus = "paid";
                    orders[orderIndex].paidAt = new Date().toISOString();
                    console.log(
                      `[PAYMENT] Split Group fully paid exactly - Order ${baseOrderId} becomes paid!`,
                    );
                  }
                } else {
                  const isExplicitFailure = [
                    "FAILED",
                    "CANCEL",
                    "CANCELED",
                    "CANCELLED",
                    "NOT CAPTURED",
                    "FAILURE",
                    "ERROR",
                    "DECLINED",
                  ].includes(statusStr);
                  if (isExplicitFailure) {
                    orders[orderIndex].splitPayments[splitIdx].status =
                      "failed";
                    updated = true;
                  }
                }
              }
            } else {
              const currentStatus = orders[orderIndex].status;
              if (
                currentStatus === "فشل في عملية الدفع" ||
                currentStatus === "جديد" ||
                currentStatus === "بانتظار الدفع" ||
                currentStatus === "قيد تجميع القطية" ||
                (currentStatus || "").includes("ملغي")
              ) {
                if (status) {
                  // Success
                  orders[orderIndex].status = "تم الدفع وجاري التوصيل";
                  orders[orderIndex].paymentStatus = "paid";
                  orders[orderIndex].paidAt = new Date().toISOString();
                  orders[orderIndex].transactionId =
                    req.body?.reference?.id ||
                    req.body?.TrackID ||
                    req.query?.TrackID ||
                    req.body?.order_id ||
                    "upayments_auth";
                  updated = true;
                  console.log(
                    `[PAYMENT] Order ${baseOrderId} status updated to تم الدفع وجاري التوصيل via webhook`,
                  );

                  // Update customer points
                  const cPhone = cleanPhone(orders[orderIndex].customerPhone);
                  const custIdx = appData.customers?.findIndex(
                    (c: any) => cleanPhone(c.phone) === cPhone,
                  );
                  if (custIdx !== -1) {
                    appData.customers[custIdx].totalSpent =
                      (Number(appData.customers[custIdx].totalSpent) || 0) +
                      (Number(orders[orderIndex].total) || 0);
                    appData.customers[custIdx].loyaltyPoints =
                      (Number(appData.customers[custIdx].loyaltyPoints) || 0) +
                      (Number(orders[orderIndex].total) || 0);
                    appData.customers[custIdx].lastUpdated =
                      new Date().toISOString();
                  }
                } else {
                  const isExplicitFailure = [
                    "FAILED",
                    "CANCEL",
                    "CANCELED",
                    "CANCELLED",
                    "NOT CAPTURED",
                    "FAILURE",
                    "ERROR",
                    "DECLINED",
                  ].includes(statusStr);
                  if (
                    isExplicitFailure &&
                    currentStatus !== "قيد تجميع القطية"
                  ) {
                    orders[orderIndex].status = "فشل في عملية الدفع";
                    orders[orderIndex].paymentStatus = "failed";
                    updated = true;
                    console.log(
                      `[PAYMENT] Order ${baseOrderId} status updated to failed via webhook`,
                    );
                  }
                }
              }
            }
          } else if (invoiceIndex !== -1) {
            const currentStatus = invoices[invoiceIndex].status;
            if (
              currentStatus === "فشل في عملية الدفع" ||
              currentStatus === "جديد" ||
              currentStatus === "بانتظار الدفع"
            ) {
              if (status) {
                // Success
                invoices[invoiceIndex].status = "تم الدفع وجاري التوصيل";
                invoices[invoiceIndex].paymentStatus = "paid";
                invoices[invoiceIndex].paidAt = new Date().toISOString();
                invoices[invoiceIndex].transactionId =
                  req.body?.reference?.id ||
                  req.body?.TrackID ||
                  req.query?.TrackID ||
                  req.body?.order_id ||
                  "upayments_auth";
                updated = true;
                console.log(
                  `[PAYMENT] Invoice ${orderId} status updated to تم الدفع via webhook`,
                );
              }
            }
          }

          if (updated) {
            await updateAppData({
              orders,
              invoices,
              customers: appData.customers || [],
            });
          }
        }
        res.json({ success: true });
      } catch (e) {
        console.error("[PAYMENT] Webhook processing error:", e);
        res.status(500).json({ error: "Webhook Error" });
      }
    },
  );

  // Payment Success Handler
  app.all(
    [
      "/api/payment-return",
      "/api/payment-return/:orderId",
      "/api/payment-return/:orderId/:pathStatus",
    ],
    async (req, res) => {
      try {
        const bodyOrder = req.body?.order_id || req.body?.reference?.id;
        const queryOrder = req.query?.order_id as string;

        let orderId = req.params.orderId || queryOrder || bodyOrder || "";

        // Fallback if orderId has '?'
        if (typeof orderId === "string" && orderId.includes("?")) {
          orderId = orderId.split("?")[0];
        }

        // Gather all possible status indicators
        const searchParams = new URL(
          req.protocol + "://" + req.get("host") + req.originalUrl,
        ).searchParams;

        let statusFields = [
          req.params?.pathStatus,
          searchParams.get("payment"),
          searchParams.get("result"),
          searchParams.get("Result"),
          searchParams.get("status"),
          req.body?.payment,
          req.body?.result,
          req.body?.Result,
          req.body?.status,
        ];

        const pathStatus = (req.params?.pathStatus || "").toLowerCase();

        let isExplicitFailure = statusFields.some((x) => {
          if (!x) return false;
          let s = String(x).toUpperCase().trim();
          if (s.includes("?")) s = s.split("?")[0];
          return [
            "FAILED",
            "CANCEL",
            "CANCELED",
            "CANCELLED",
            "NOT CAPTURED",
            "FAILURE",
            "ERROR",
            "DECLINED",
          ].includes(s);
        });
        let isExplicitSuccess = statusFields.some((x) => {
          if (!x) return false;
          let s = String(x).toUpperCase().trim();
          if (s.includes("?")) s = s.split("?")[0];
          return (
            ["SUCCESS", "CAPTURED", "PAID", "APPROVED", "SUCCESSFUL"].includes(
              s,
            ) || s === "TRUE"
          );
        });

        if (pathStatus === "success") {
          isExplicitSuccess = true;
          isExplicitFailure = false;
        } else if (pathStatus === "failed" || pathStatus === "cancel") {
          isExplicitFailure = true;
          isExplicitSuccess = false;
        }

        let phone = "";
        if (orderId) {
          const docRef = doc(db, "appData", "shared_company_data");
          const d = await getAppDataRef();
          const appData = d.data() || {};
          let orders = appData.orders || [];
          let invoices = appData.invoices || [];
          const orderIndex = orders.findIndex((o: any) => o.id === orderId);
          const invoiceIndex = invoices.findIndex((o: any) => o.id === orderId);

          let updated = false;

          if (orderIndex !== -1) {
            phone =
              orders[orderIndex].customerPhone ||
              orders[orderIndex].phone ||
              "";
            const currentStatus = orders[orderIndex].status;

            if (
              currentStatus === "فشل في عملية الدفع" ||
              currentStatus === "جديد" ||
              currentStatus === "بانتظار الدفع" ||
              currentStatus === "قيد تجميع القطية" ||
              (currentStatus || "").includes("ملغي")
            ) {
              if (isExplicitFailure) {
                orders[orderIndex].status = "فشل في عملية الدفع";
                orders[orderIndex].paymentStatus = "failed";
                updated = true;
                console.log(
                  `[PAYMENT] Order ${orderId} marked as failed via explicitly cancelled return URL`,
                );
              } else if (isExplicitSuccess) {
                orders[orderIndex].status = "تم الدفع وجاري التوصيل";
                orders[orderIndex].paymentStatus = "paid";
                orders[orderIndex].paidAt = new Date().toISOString();
                orders[orderIndex].transactionId =
                  req.body?.reference?.id ||
                  req.body?.TrackID ||
                  req.query?.TrackID ||
                  req.body?.order_id ||
                  req.query?.order_id ||
                  "upayments_auth";
                updated = true;
                console.log(
                  `[PAYMENT] Order ${orderId} marked as PAID via synchronous return URL (Webhook may have failed due to 403)`,
                );
              } else {
                console.log(
                  `[PAYMENT] Order ${orderId} unverified return status, waiting for webhook`,
                );
              }
            }
          }

          if (invoiceIndex !== -1) {
            if (!phone)
              phone =
                invoices[invoiceIndex].customerPhone ||
                invoices[invoiceIndex].phone ||
                "";
            const currentStatus = invoices[invoiceIndex].status;

            if (
              currentStatus === "فشل في عملية الدفع" ||
              currentStatus === "جديد" ||
              currentStatus === "بانتظار الدفع"
            ) {
              if (isExplicitFailure) {
                invoices[invoiceIndex].status = "فشل في عملية الدفع";
                invoices[invoiceIndex].paymentStatus = "failed";
                updated = true;
                console.log(
                  `[PAYMENT] Invoice ${orderId} marked as failed via explicitly cancelled return URL`,
                );
              } else if (isExplicitSuccess) {
                invoices[invoiceIndex].status = "تم الدفع وجاري التوصيل";
                invoices[invoiceIndex].paymentStatus = "paid";
                invoices[invoiceIndex].paidAt = new Date().toISOString();
                invoices[invoiceIndex].transactionId =
                  req.body?.reference?.id ||
                  req.body?.TrackID ||
                  req.query?.TrackID ||
                  req.body?.order_id ||
                  req.query?.order_id ||
                  "upayments_auth";
                updated = true;
                console.log(
                  `[PAYMENT] Invoice ${orderId} marked as PAID via synchronous return URL`,
                );
              }
            }
          }

          if (updated) {
            await updateAppData({ orders, invoices });
          }
        }

        // Target Base URL for the return button (current environment)
        let rProtocol = req.headers["x-forwarded-proto"] || req.protocol;
        let rHost = req.headers["x-forwarded-host"] || req.get("host");
        let baseUrl = req.get("origin") || rProtocol + "://" + rHost;
        if (!baseUrl || baseUrl.includes("undefined"))
          baseUrl = "https://alturathkw.shop";

        // Append success or fail for frontend alert
        let paymentParam = isExplicitFailure
          ? "failed"
          : isExplicitSuccess
            ? "success"
            : "pending";
        const trackUrl = `${baseUrl}/track?order_id=${orderId}&payment=${paymentParam}`;

        if (req.query.isPopup !== "true") {
          console.log(
            `[PAYMENT] Main window return detected for order ${orderId}. Redirecting immediately to track page.`,
          );
          return res.type("html")
            .send(`<html><head><title>Redirecting...</title></head><body><script>
                  try {
                      localStorage.setItem("track_order_id", "${orderId}");
                      localStorage.setItem("track_status", "${paymentParam}");
                  } catch(e) {}
                  window.location.href="${trackUrl}";
              </script></body></html>`);
        }

        console.log(
          `[PAYMENT] Showing return page for order ${orderId} (Failure detected: ${isExplicitFailure}, status: ${paymentParam})`,
        );

        return res.type("html").send(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>حالة الدفع</title>
                <style>
                    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafaf9; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
                    .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 90%; width: 400px; }
                    .icon { font-size: 4rem; margin-bottom: 1rem; }
                    .success { color: #16a34a; }
                    .error { color: #dc2626; }
                    h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1c1917; }
                    p { color: #78716c; margin-bottom: 1.5rem; }
                    .btn { display: inline-block; background: #e0ac69; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 500; transition: background 0.2s; border: none; cursor: pointer; width: 100%; box-sizing: border-box; }
                    .btn:hover { background: #c89552; }
                    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #e0ac69; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div id="loading">
                        <div class="spinner"></div>
                        <p style="margin-top: 1rem;">جاري تحديث حالة الدفع...</p>
                    </div>
                    <div id="content" style="display: none;">
                        <div class="icon ${isExplicitFailure ? "error" : "success"}">
                            ${isExplicitFailure ? "✖" : "✔"}
                        </div>
                        <h1>${isExplicitFailure ? "فشلت عملية الدفع" : "تم الدفع بنجاح"}</h1>
                        <p>${isExplicitFailure ? "نعتذر، لم نتمكن من إتمام عملية الدفع." : "شكراً لك، تم تأكيد طلبك بنجاح."}</p>
                        <a href="${trackUrl}" class="btn" onclick="closePopupAndRedirect(event)">العودة إلى الموقع</a>
                    </div>
                </div>
                <script>
                    try {
                        localStorage.setItem("track_order_id", "${orderId}");
                        localStorage.setItem("track_status", "${paymentParam}");
                    } catch(e) {}

                    function closePopupAndRedirect(e) {
                        if (e) e.preventDefault();
                        const targetUrl = e ? e.currentTarget.href : "${trackUrl}";
                        
                        try {
                            if (window.opener && !window.opener.closed) {
                                window.opener.postMessage(JSON.stringify({ type: 'payment_return', orderId: '${orderId}', payment: '${paymentParam}' }), '*');
                                window.opener.postMessage({ type: 'PAYMENT_COMPLETE', url: targetUrl, orderId: '${orderId}', payment: '${paymentParam}' }, '*');
                                setTimeout(() => window.close(), 100);
                            } else {
                                window.location.href = targetUrl;
                            }
                        } catch (err) {
                            window.location.href = targetUrl;
                        }
                    }

                    // Auto-trigger completion after brief delay
                    setTimeout(() => {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('content').style.display = 'block';
                        closePopupAndRedirect(null);
                    }, 1500);
                </script>
            </body>
            </html>
          `);
      } catch (e) {
        console.error("Error in return handler", e);

        let rProtocol = req.headers["x-forwarded-proto"] || req.protocol;
        let rHost = req.headers["x-forwarded-host"] || req.get("host");
        let fallbackBaseUrl = req.get("origin") || rProtocol + "://" + rHost;
        if (!fallbackBaseUrl || fallbackBaseUrl.includes("undefined"))
          fallbackBaseUrl = "https://alturathkw.shop";
        let trackFallback = `${fallbackBaseUrl}/track`;
        const possibleOrderId =
          req.params.orderId ||
          req.query.order_id ||
          req.body?.order_id ||
          req.body?.reference?.id;
        if (possibleOrderId) {
          const cleanId =
            typeof possibleOrderId === "string"
              ? possibleOrderId.split("?")[0]
              : possibleOrderId;
          trackFallback += `?order_id=${cleanId}`;
          res.type("html")
            .send(`<html><head><title>Redirecting...</title></head><body><script>
                  try {
                      localStorage.setItem("track_order_id", "${cleanId}");
                      localStorage.setItem("track_status", "failed");
                  } catch(e) {}
                  window.location.href="${trackFallback}";
              </script></body></html>`);
        } else {
          res
            .type("html")
            .send(
              `<html><head><title>Redirecting...</title></head><body><script>window.location.href="${trackFallback}";</script></body></html>`,
            );
        }
      }
    },
  );

  // Search Orders by Phone
  app.get("/api/search-order/:phone", async (req, res) => {
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    try {
      const cleanQueryPhone = cleanPhone(phone);
      const d = await getAppDataRef();
      const appData = d.data() || {};

      const allOrders = appData.orders || [];

      // Filter by phone
      const matchedOrders = allOrders.filter(
        (order: any) =>
          cleanPhone(order.customerPhone || order.phone) === cleanQueryPhone,
      );

      // Sort by date descending
      matchedOrders.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
      });

      res.json(matchedOrders.slice(0, 10));
    } catch (error) {
      console.error("Error searching orders:", error);
      res.status(500).json({ error: "Failed to search orders" });
    }
  });

  // Legacy endpoints for UI compatibility
  app.get("/api/admin/orders", async (req, res) => {
    const d = await getAppDataRef();
    const data = d.data() || {};
    res.json(data.orders || []);
  });

  app.get("/api/admin/invoices", async (req, res) => {
    const d = await getAppDataRef();
    const data = d.data() || {};
    res.json(data.invoices || []);
  });

  app.patch("/api/admin/orders/:id/pay", async (req, res) => {
    const { id } = req.params;
    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const data = d.data() || {};
      const orders = data.orders || [];
      const invoices = data.invoices || [];

      const orderIdx = orders.findIndex((o: any) => o.id === id);
      if (orderIdx === -1) {
        return res.status(404).json({ error: "Order not found" });
      }

      const orderData = orders[orderIdx];

      const invoiceData = {
        ...orderData,
        id: orderData.id,
        invoiceId: orderData.id,
        paymentStatus: "paid",
        status: "تم الدفع وجاري التوصيل",
        completedAt: new Date().toISOString(),
      };

      invoices.push(invoiceData);
      // Delete from orders
      orders.splice(orderIdx, 1);

      await updateAppData({ orders, invoices });

      res.json({
        message: "Order moved to invoices successfully",
        invoiceData,
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to mark as paid" });
    }
  });

  // Fix free delivery logic to actually update the database in both lists!
  app.patch("/api/admin/orders/:id/free-delivery", async (req, res) => {
    const { id } = req.params;
    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};

      let orders = appData.orders || [];
      let invoices = appData.invoices || [];

      let found = false;

      const updateToFree = (item: any) => {
        // ALWAYS force recalculation for free delivery to fix bad state total
        const itemsTotal = (item.items || []).reduce((sum: number, i: any) => {
          const extrasTotal = (i.selectedExtras || i.extras || []).reduce(
            (eSum: number, e: any) => eSum + (Number(e.price) || 0),
            0,
          );
          return (
            sum +
            (Number(i.price) || 0) * (Number(i.quantity) || 1) +
            extrasTotal
          );
        }, 0);

        return {
          ...item,
          deliveryFee: 0,
          isFreeDelivery: true,
          deliveryType: "free",
          total: itemsTotal,
        };
      };

      const oIdx = orders.findIndex((o: any) => o.id === id);
      if (oIdx !== -1) {
        orders[oIdx] = updateToFree(orders[oIdx]);
        found = true;
      }

      const iIdx = invoices.findIndex((i: any) => i.id === id);
      if (iIdx !== -1) {
        invoices[iIdx] = updateToFree(invoices[iIdx]);
        found = true;
      }

      if (!found) {
        return res.status(404).json({ error: "Order/Invoice not found" });
      }

      await updateAppData({ orders, invoices });

      res.json({ message: "Delivery fee removed successfully" });
    } catch (e) {
      console.error("Error in free-delivery PATCH:", e);
      res.status(500).json({ error: "Failed to update delivery fee" });
    }
  });

  // Admin: Promo Codes
  app.get("/api/admin/promocodes", async (req, res) => {
    try {
      const d = await getAppDataRef();
      if (!d.exists()) return res.json([]);
      res.json(d.data().promocodes || []);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch promocodes" });
    }
  });

  app.post("/api/admin/promocodes", async (req, res) => {
    const { code, type, value, isActive } = req.body;
    if (!code || !type || value === undefined)
      return res.status(400).json({ error: "Missing fields" });

    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      let promocodes = d.exists() ? d.data().promocodes || [] : [];

      const newPromo = {
        code: code.toUpperCase().trim(),
        type,
        value: Number(value),
        discountValue: Number(value),
        isActive: isActive !== undefined ? isActive : true,
      };

      // Check if exists
      const existingIdx = promocodes.findIndex(
        (p: any) => p.code === newPromo.code,
      );
      if (existingIdx > -1) {
        promocodes[existingIdx] = newPromo;
      } else {
        promocodes.push(newPromo);
      }

      await updateAppData({ promocodes });
      res.json({ success: true, promo: newPromo });
    } catch (e) {
      res.status(500).json({ error: "Failed to save promocode" });
    }
  });

  app.delete("/api/admin/promocodes/:code", async (req, res) => {
    const { code } = req.params;
    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      if (!d.exists()) return res.status(404).json({ error: "Not found" });

      let promocodes = d.data().promocodes || [];
      promocodes = promocodes.filter(
        (p: any) => p.code !== code.toUpperCase().trim(),
      );

      await updateAppData({ promocodes });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete promocode" });
    }
  });

  app.get("/api/debug", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      res.json({
        databaseSource: "Firebase Firestore",
        documentPath: "appData/shared_company_data",
        customersCount: (data.customers || []).length,
        productsCount: (data.products || []).length,
        zonesCount: (data.zones || []).length,
        ordersCount: (data.orders || []).length,
        invoicesCount: (data.invoices || []).length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debug data" });
    }
  });

  // Viral Split Payment Meta Tags (WhatsApp/iMessage)
  app.get("/split/:id", async (req, res, next) => {
    // Detect if it's a social crawler or bot
    const ua = req.headers["user-agent"] || "";
    const isBot =
      /WhatsApp|facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Pinterest|Slackbot|TelegramBot/i.test(
        ua,
      );

    if (isBot) {
      try {
        const { id } = req.params;
        const d = await getAppDataRef();
        const data = d.data() || {};
        const orders = data.orders || [];
        const order = orders.find((o: any) => o.id === id);

        if (order) {
          const title = "قطية عشا بمطبخ التراث! 🍽️";
          const desc = `عشانا بـ ${order.total.toFixed(3)} د.ك.. قط قطيتك بالرابط والحق على الأكل! 🥘`;
          // Thumbnail image - ideally a generic "Order" or "Food" image
          const image =
            "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1287&auto=format&fit=crop";

          return res.send(`
              <!DOCTYPE html>
              <html dir="rtl" lang="ar">
              <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <meta name="description" content="${desc}">
                <meta property="og:title" content="${title}">
                <meta property="og:description" content="${desc}">
                <meta property="og:image" content="${image}">
                <meta property="og:type" content="website">
                <meta name="twitter:card" content="summary_large_image">
              </head>
              <body>
                <h1>جاري تحويلك...</h1>
                <script>window.location.href = "/split/${id}";</script>
              </body>
              </html>
            `);
        }
      } catch (e) {
        console.error("[META ERROR]", e);
      }
    }
    next(); // Pass to Vite/React if not a bot or order not found
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler to guarantee JSON response
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Express Error:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);

    // Background task to timeout expired split payments automatically
    setInterval(async () => {
      try {
        const d = await getAppDataRef();
        const appData = d.data() || {};
        const allOrders = appData.orders || [];
        const now = Date.now();
        const TIMEOUT = 120 * 60 * 1000;
        let needsUpdate = false;

        const updatedOrders = allOrders.map((o: any) => {
          if (o.status === "قيد تجميع القطية" && o.createdAt) {
            const created = new Date(o.createdAt).getTime();
            if (now - created > TIMEOUT) {
              needsUpdate = true;
              console.log(`[SPLIT] Auto-cancelling expired order ${o.id}`);
              return { ...o, status: "ملغي - انتهى وقت القطية" };
            }
          }
          return o;
        });

        if (needsUpdate) {
          await updateAppData({
            orders: updatedOrders,
          });
          console.log(`[SPLIT] Background updated timeout orders`);
        }
      } catch (err) {
        console.error("[SPLIT] Background task error:", err);
      }
    }, 60 * 1000); // Check every 1 minute
  });
}

startServer();
