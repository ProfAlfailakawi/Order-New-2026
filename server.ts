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
  setLogLevel,
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
  runTransaction,
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
setLogLevel("silent");
const db = initializeFirestore(
  appClient,
  { experimentalForceLongPolling: true },
  firebaseConfig.firestoreDatabaseId || "(default)",
);

let _appDataCache: any = null;
let _appDataCacheTime = 0;
const CACHE_TTL = 0; // Disable cache to prevent concurrency issues and data loss during split payments

async function getAppData() {
  if (_appDataCache && Date.now() - _appDataCacheTime < CACHE_TTL) {
    return _appDataCache;
  }
  try {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    if (d.exists()) {
      _appDataCache = d.data();
      _appDataCacheTime = Date.now();
      return _appDataCache;
    }
  } catch (error) {
    console.warn("Firebase read restricted or failed, using local in-memory fallback", error);
  }
  return localFallbackDB;
}



const calculateSplitPaymentSummary = (order: any) => {
  const splitPayments = Array.isArray(order?.splitPayments) ? order.splitPayments : [];
  const total = Number(order?.total || order?.totalAmount || 0);

  const paidAmount = splitPayments.reduce((sum: number, split: any) => {
    const status = String(split?.status || "").toLowerCase();
    const isPaid = status === "paid" || status === "captured" || status === "success" || status === "successful";
    return isPaid ? sum + Number(split?.amount || 0) : sum;
  }, 0);

  const remainingAmount = Math.max(0, total - paidAmount);
  const isFullyPaid = total > 0 && paidAmount + 0.001 >= total;

  return { total, paidAmount, remainingAmount, isFullyPaid };
};


const removeUndefinedDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep);
  }

  if (value && typeof value === "object") {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      cleaned[key] = removeUndefinedDeep(val);
    }
    return cleaned;
  }

  return value;
};

async function updateAppData(data: any) {
  try {
    const docRef = doc(db, "appData", "shared_company_data");
    await setDoc(docRef, removeUndefinedDeep(data), { merge: true });
    _appDataCache = null;
    _appDataCacheTime = 0;
  } catch (error) {
    console.warn("Firebase write restricted or failed, updating local in-memory fallback", error);
    localFallbackDB = { ...localFallbackDB, ...data };
    
    // Save to disk to persist across dev server restarts
    try {
      fs.writeFileSync(path.join(__dirname, "app_data_fallback.json"), JSON.stringify(localFallbackDB, null, 2));
    } catch(err) {
      console.warn("Could not save to disk:", err);
    }
  }
}

/**
 * Transaction-safe update helper.
 * Use this for any update that involves arrays (orders, invoices, customers)
 * to prevent race conditions.
 */
async function updateAppDataAtomically(updater: (currentData: any) => any) {
  const docRef = doc(db, "appData", "shared_company_data");
  try {
    await runTransaction(db, async (transaction) => {
      const sDoc = await transaction.get(docRef);
      if (!sDoc.exists()) throw new Error("shared_company_data not found");
      
      const currentData = sDoc.data();
      const updates = updater(currentData);
      
      if (updates) {
        transaction.update(docRef, updates);
      }
    });
    _appDataCache = null;
    _appDataCacheTime = 0;
    return true;
  } catch (err) {
    console.error("[ATOMIC_UPDATE_ERROR]", err);
    return false;
  }
}

async function handlePaymentUpdate(orderId: string, splitId: string, isSuccess: boolean, providerData: any) {
  console.log(`[PAYMENT_UPDATE] Processing Order:${orderId} Split:${splitId} Success:${isSuccess}`);
  const docRef = doc(db, "appData", "shared_company_data");
  
  try {
    await runTransaction(db, async (transaction) => {
      const sDoc = await transaction.get(docRef);
      if (!sDoc.exists()) throw new Error("shared_company_data not found");
      
      const appData = sDoc.data();
      let orders = [...(appData.orders || [])];
      let invoices = [...(appData.invoices || [])];
      let customers = [...(appData.customers || [])];
      
      let baseId = String(orderId).toUpperCase();
      let sId = splitId;
      let isSplit = !!sId;
      
      if (baseId.includes("-S-")) {
        isSplit = true;
        const parts = baseId.split("-S-");
        baseId = parts[0];
        if (!sId) sId = parts[1];
      }

      let updated = false;

      // Handle Orders
      const oIdx = orders.findIndex(o => String(o.id).toUpperCase() === baseId);
      if (oIdx !== -1) {
        if (isSplit) {
          if (!orders[oIdx].splitPayments) orders[oIdx].splitPayments = [];
          const sIdx = orders[oIdx].splitPayments.findIndex((s: any) => {
            const sid = String(s.id).toUpperCase();
            const target = String(sId).toUpperCase();
            return sid === target || sid === `S-${target}` || target.includes(sid);
          });
          
          if (sIdx !== -1) {
            const currentStatus = String(orders[oIdx].splitPayments[sIdx].status || "").toLowerCase();
            if (isSuccess && currentStatus !== "paid") {
              orders[oIdx].splitPayments[sIdx].status = "paid";
              orders[oIdx].splitPayments[sIdx].paymentId = providerData?.reference?.id || providerData?.TrackID || "upayments_auth";
              orders[oIdx].splitPayments[sIdx].datePaid = new Date().toISOString();
              
              // Update customer totalSpent
              const cPhone = cleanPhone(orders[oIdx].splitPayments[sIdx].phone);
              if (cPhone) {
                const custIdx = customers.findIndex((c: any) => cleanPhone(c.phone) === cPhone);
                if (custIdx !== -1) {
                  customers[custIdx].totalSpent = (Number(customers[custIdx].totalSpent) || 0) + (Number(orders[oIdx].splitPayments[sIdx].amount) || 0);
                  customers[custIdx].lastUpdated = new Date().toISOString();
                } else {
                  customers.push({
                    id: "CUST-" + Date.now().toString(36),
                    name: orders[oIdx].splitPayments[sIdx].name || "صديق عميل",
                    phone: orders[oIdx].splitPayments[sIdx].phone,
                    createdAt: new Date().toISOString(),
                    totalSpent: Number(orders[oIdx].splitPayments[sIdx].amount) || 0,
                    loyaltyPoints: 0,
                  });
                }
              }
              
              // Check if order fully paid
              const splitSummary = calculateSplitPaymentSummary(orders[oIdx]);
              orders[oIdx].paidAmount = splitSummary.paidAmount;
              orders[oIdx].remainingAmount = splitSummary.remainingAmount;

              if (splitSummary.isFullyPaid) {
                orders[oIdx].status = "تم الدفع وجاري التوصيل";
                orders[oIdx].paymentStatus = "paid";
                orders[oIdx].paidAt = new Date().toISOString();
                
                // Distribute points ONLY when fully paid
                orders[oIdx].splitPayments.filter((s: any) => s.status === "paid").forEach((p: any) => {
                  const cp = cleanPhone(p.phone);
                  const eIdx = customers.findIndex(c => cleanPhone(c.phone) === cp);
                  if (eIdx !== -1) {
                    customers[eIdx].loyaltyPoints = (Number(customers[eIdx].loyaltyPoints) || 0) + (Number(p.amount) || 0);
                  }
                });
              } else {
                orders[oIdx].status = "بانتظار اكتمال القطية";
                orders[oIdx].paymentStatus = "partial";
              }
              updated = true;
            } else if (!isSuccess && currentStatus !== "paid") {
              orders[oIdx].splitPayments[sIdx].status = "failed";
              updated = true;
            }
          }
        } else {
          // Regular Order
          const currentStatus = orders[oIdx].status;
          if (isSuccess) {
            if (orders[oIdx].paymentStatus !== "paid") {
              orders[oIdx].status = "تم الدفع وجاري التوصيل";
              orders[oIdx].paymentStatus = "paid";
              orders[oIdx].paidAt = new Date().toISOString();
              orders[oIdx].transactionId = providerData?.reference?.id || providerData?.TrackID || "upayments_auth";
              
              // Loyalty points
              const cPhone = cleanPhone(orders[oIdx].customerPhone);
              if (cPhone) {
                const custIdx = customers.findIndex(c => cleanPhone(c.phone) === cPhone);
                if (custIdx !== -1) {
                   const amount = Number(orders[oIdx].total) || 0;
                   customers[custIdx].totalSpent = (Number(customers[custIdx].totalSpent) || 0) + amount;
                   customers[custIdx].loyaltyPoints = (Number(customers[custIdx].loyaltyPoints) || 0) + amount;
                   customers[custIdx].lastUpdated = new Date().toISOString();
                }
              }
              updated = true;
            }
          } else if (currentStatus === "جديد" || currentStatus === "بانتظار الدفع") {
             orders[oIdx].status = "فشل في عملية الدفع";
             orders[oIdx].paymentStatus = "failed";
             updated = true;
          }
        }
      }

      // Handle Invoices
      invoices.forEach((inv: any) => {
        if (String(inv.id).toUpperCase() === baseId) {
          if (isSuccess && inv.paymentStatus !== "paid") {
            inv.status = "تم الدفع وجاري التوصيل";
            inv.paymentStatus = "paid";
            inv.paidAt = new Date().toISOString();
            updated = true;
          } else if (!isSuccess && (inv.status === "جديد" || inv.status === "بانتظار الدفع")) {
            inv.status = "فشل في عملية الدفع";
            inv.paymentStatus = "failed";
            updated = true;
          }
        }
      });

      if (updated) {
        transaction.update(docRef, { orders, invoices, customers });
      }
    });
    console.log(`[PAYMENT_UPDATE] Successfully processed Order:${orderId}`);
  } catch (err) {
    console.error(`[PAYMENT_UPDATE] Concurrency error or logical failure for Order:${orderId}:`, err);
  }
}


export async function getAppDataRef() {
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
  const PORT = Number(process.env.PORT) || 3000;

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

app.get("/api/debug/order/:id", async (req, res) => {
    try {
      const dbData = await getAppDataRef();
      const data = dbData.exists() ? dbData.data() : {};
      const order = (data.orders || []).find((o: any) => o.id === req.params.id) 
                 || (data.invoices || []).find((i: any) => i.id === req.params.id);
      res.json(order || { error: "not found" });
    } catch(e) {
      res.status(500).json({ error: String(e) });
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
      let expiredIds: string[] = [];

      allOrdersOriginal.forEach((o: any) => {
        if (o.status === "قيد تجميع القطية" && o.createdAt) {
          const created = new Date(o.createdAt).getTime();
          if (now - created > TIMEOUT) {
            expiredIds.push(o.id);
          }
        }
      });

      if (expiredIds.length > 0) {
        console.log(`[SPLIT] Timing out expired split payments: ${expiredIds.join(", ")}`);
        await updateAppDataAtomically((current) => {
          const updatedOrders = (current.orders || []).map((o: any) => {
            if (expiredIds.includes(o.id) && o.status === "قيد تجميع القطية") {
               return { ...o, status: "ملغي - انتهى وقت القطية" };
            }
            return o;
          });
          return { orders: updatedOrders };
        });
      }

      const allInvoices = (appData.invoices || []).map((inv: any) => ({
        ...inv,
        isInvoice: true,
      }));

      console.log(
        `DEBUG: Tracking orders for ${cleanQueryPhone} or order_id ${order_id}. Total shared orders: ${allOrdersOriginal.length}, invoices: ${allInvoices.length}`,
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
          let qid = String(order_id).trim().toUpperCase();
          match =
            String(item.id).toUpperCase() === qid ||
            String(item.linkedInvoiceId).toUpperCase() === qid ||
            String(item.invoiceId).toUpperCase() === qid;

          if (!match && qid.includes("-S-")) {
            const base = qid.split("-S-")[0];
            match = String(item.id).toUpperCase() === base;
          }
        }
        return match;
      };

      const matchedOrders = allOrdersOriginal.filter(filterFn);
      const matchedInvoices = allInvoices.filter(filterFn);
      const allMatched = [...matchedOrders, ...matchedInvoices];
      console.log(
        `DEBUG: Found matched orders: ${matchedOrders.length}, invoices: ${matchedInvoices.length}`,
      );

      const finalOrders = allMatched;

      // Get customer points from shared data customers list
      const matchedCust = customers.find((c: any) => cleanPhone(c.phone) === cleanQueryPhone);
      let points = matchedCust?.loyaltyPoints !== undefined ? matchedCust.loyaltyPoints : (matchedCust?.points || 0);

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

      let needsPersistence = false;
      const populatedOrders = finalOrders.map((o: any) => {
        // Healing Logic: If paymentStatus is paid but status is stuck in split/roulette mode, auto-fix it
        if ((o.paymentStatus === 'paid' || o.status === 'paid' || (o.splitPayments && o.splitPayments.filter((sp:any) => sp.status === 'paid').reduce((sum:number, sp:any) => sum + (Number(sp.amount) || 0), 0) >= (Number(o.total) || 0) - 0.005)) && 
            (o.status === "قيد تجميع القطية" || o.status === "بانتظار الدفع" || o.status === "جديد")) {
          o.status = "تم الدفع وجاري التوصيل";
          o.paymentStatus = "paid";
          needsPersistence = true;
          
          if (!o.paidAt) {
             o.paidAt = new Date().toISOString();
          }

          // Add points to customer if healing for the first time
          const cPhone = cleanPhone(o.customerPhone);
          const cIdx = customers.findIndex((c: any) => cleanPhone(c.phone) === cPhone);
          if (cIdx !== -1) {
             const prevPoints = Number(customers[cIdx].loyaltyPoints) || 0;
             customers[cIdx].loyaltyPoints = prevPoints + (Number(o.total) || 0);
             if (cPhone === cleanQueryPhone) {
                 points = customers[cIdx].loyaltyPoints;
             }
          }

          console.log(`[HEALING] Order ${o.id} auto-corrected to paid status during tracking`);
        }
        
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

      if (needsPersistence) {
        // Find updated orders and merge into allOrders (which includes orders not being tracked)
        const mergedOrders = (appData.orders || []).map(o => {
          const match = populatedOrders.find(po => po.id === o.id);
          if (match && match.paymentStatus === 'paid') {
             return { ...o, status: match.status, paymentStatus: match.paymentStatus, paidAt: match.paidAt };
          }
          return o;
        });
        await updateAppData({ orders: mergedOrders, customers: customers });
      }

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
        settings.loyaltyTiers = data.loyaltyTiers || [];
        settings.squadTiers = data.squadTiers || [];
        settings.loyaltySettings = data.loyaltySettings || {};
        settings.productCategories = data.productCategories || settings.productCategories || [];
        settings.menuCategories = data.menuCategories || settings.menuCategories || [];

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

  app.patch("/api/admin/settings/loyaltyTiers", async (req, res) => {
    try {
      const { tiers } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      await setDoc(docRef, { loyaltyTiers: tiers }, { merge: true });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/settings/squadTiers", async (req, res) => {
    try {
      const { tiers } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      await setDoc(docRef, { squadTiers: tiers }, { merge: true });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/settings/loyaltySettings", async (req, res) => {
    try {
      const { settings } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      await setDoc(docRef, { loyaltySettings: settings }, { merge: true });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. Customers
  app.get("/api/squad-gamification", async (req, res) => {
    let { phone, squadId } = req.query;
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const squads = data.squads || [];
      
      const customers = data.customers || [];
      const squadTiersForPublic = Array.isArray(data.squadTiers) ? data.squadTiers : [];
      const getTierForPoints = (points: number) => {
        return [...squadTiersForPublic]
          .sort((a: any, b: any) => Number(a.minPoints ?? a.points ?? a.requiredPoints ?? 0) - Number(b.minPoints ?? b.points ?? b.requiredPoints ?? 0))
          .reverse()
          .find((tier: any) => points >= Number(tier.minPoints ?? tier.points ?? tier.requiredPoints ?? 0));
      };
      
      const enrichedSquads = squads.map((sq: any) => {
         let teamPoints = 0;
         const mappedMembers = (sq.membersList || []).map((m: any) => {
             const cust = customers.find((c: any) => cleanPhone(c.phone) === cleanPhone(m.phone));
             const realPoints = cust ? (cust.loyaltyPoints !== undefined ? cust.loyaltyPoints : (cust.points || 0)) : (m.points || 0);
             teamPoints += realPoints;
             return { ...m, orderCount: realPoints, points: realPoints };
         }).sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
         
         const computedTier = getTierForPoints(teamPoints);
         return {
            ...sq,
            points: teamPoints,
            totalPoints: teamPoints,
            teamPoints,
            totalOrders: teamPoints,
            tier: sq.tier || computedTier?.name || "",
            tierData: computedTier || null,
            membersList: mappedMembers
         };
      });

      const topSquads = [...enrichedSquads].sort((a,b) => b.totalOrders - a.totalOrders).slice(0, 5);

      const cleanQPhone = phone ? cleanPhone(phone as string) : null;
      let joinedSquadId = squadId ? String(squadId) : null;
      let userSquads: any[] = [];

      if (cleanQPhone) {
         // Find all squads the user is a member of
         userSquads = enrichedSquads.filter((sq: any) => 
            (sq.membersList || []).some((m: any) => cleanPhone(m.phone) === cleanQPhone)
         );
         
         // If a squadId was requested, check if it's valid
         if (joinedSquadId) {
             const isMemberOfRequested = userSquads.some((sq: any) => String(sq.id) === joinedSquadId);
             // If not a member of requested, but is a member of others, maybe keep the requested one so they can view/join it.
         } else if (userSquads.length > 0) {
             // Auto-select the first one if no squadId requested
             joinedSquadId = String(userSquads[0].id);
         }
      }

      let mySquad = joinedSquadId ? enrichedSquads.find((sq: any) => String(sq.id) === String(joinedSquadId)) : null;

      let myRank = null;
      let myMemberData = null;

      if (mySquad && cleanQPhone) {
         const memberIndex = mySquad.membersList.findIndex((mem: any) => cleanPhone(mem.phone) === cleanQPhone);
         if (memberIndex !== -1) {
            myMemberData = { ...mySquad.membersList[memberIndex], isMember: true };
            myRank = memberIndex + 1;
         } else {
             // زائر من رابط دعوة: نعرض الديوانية مع نموذج انضمام واضح بدل اعتبارها عضوية مكتملة.
             myMemberData = { phone: cleanQPhone, name: "أنت", orderCount: 0, points: 0, isMember: false };
             myRank = mySquad.membersList.length + 1;
         }
      }

      // Geofencing data lookup
      const allGeofenceRequests = data.geofenceJoinRequests || [];
      const activeSquadsWithCoords = enrichedSquads.filter((s: any) => s.lat !== undefined && s.lng !== undefined);
      
      let pendingGeofenceRequests: any[] = [];
      if (mySquad && cleanQPhone && cleanPhone(mySquad.phone || "") === cleanQPhone) {
         // The current user is the owner/king of this squad! Show them pending requests for approval.
         pendingGeofenceRequests = allGeofenceRequests.filter((r: any) => String(r.squadId) === String(mySquad.id) && r.status === "pending");
      }

      // Check user's own requests
      const myGeofenceRequests = cleanQPhone ? allGeofenceRequests.filter((r: any) => cleanPhone(r.phone) === cleanQPhone) : [];

      res.json({
         topSquads,
         mySquad,
         myRank,
         myMemberData,
         userSquads,
         activeSquads: activeSquadsWithCoords,
         pendingGeofenceRequests,
         myGeofenceRequests
      });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-set-location", async (req, res) => {
    const { squadId, phone, lat, lng } = req.body;
    if (!squadId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing squadId, lat, or lng" });
    }
    try {
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const idx = squads.findIndex((s: any) => String(s.id) === String(squadId));
        if (idx > -1) {
          squads[idx] = { ...squads[idx], lat: Number(lat), lng: Number(lng) };
        }
        return { squads };
      });
      if (!ok) throw new Error("Failed to set squad location in database");
      res.json({ success: true, lat, lng });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-geofence-join-request", async (req, res) => {
    const { name, phone, squadId, distance } = req.body;
    if (!phone || !squadId) {
      return res.status(400).json({ error: "Missing phone or squadId" });
    }
    try {
      const cleanQPhone = cleanPhone(phone);
      const ok = await updateAppDataAtomically((current: any) => {
        const reqs = Array.isArray(current.geofenceJoinRequests) ? [...current.geofenceJoinRequests] : [];
        
        // Remove existing pending/rejected from same user for same squad to overwrite nicely
        const filtered = reqs.filter((r: any) => !(cleanPhone(r.phone) === cleanQPhone && String(r.squadId) === String(squadId)));
        
        filtered.push({
          phone,
          name: name || "عضو قريب",
          squadId: String(squadId),
          distance: Number(distance || 0),
          timestamp: new Date().toISOString(),
          status: "pending"
        });
        return { geofenceJoinRequests: filtered };
      });
      if (!ok) throw new Error("Failed to save geofence request");
      res.json({ success: true });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-geofence-approve-request", async (req, res) => {
    const { phone, squadId, approved } = req.body;
    if (!phone || !squadId) return res.status(400).json({ error: "Missing phone or squadId" });
    try {
      const cleanTargetPhone = cleanPhone(phone);
      let joinedSquad: any = null;
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const customers = Array.isArray(current.customers) ? [...current.customers] : [];
        const reqs = Array.isArray(current.geofenceJoinRequests) ? [...current.geofenceJoinRequests] : [];

        // Find and update status
        const rIdx = reqs.findIndex((r: any) => cleanPhone(r.phone) === cleanTargetPhone && String(r.squadId) === String(squadId));
        const requestObj = rIdx > -1 ? reqs[rIdx] : null;
        if (rIdx > -1) {
          reqs[rIdx] = { ...reqs[rIdx], status: approved ? "approved" : "rejected" };
        }

        if (approved) {
          let fIndex = squads.findIndex((s: any) => String(s.id) === String(squadId));
          if (fIndex > -1) {
            const squad = { ...squads[fIndex] };
            squad.membersList = Array.isArray(squad.membersList) ? [...squad.membersList] : [];
            const mIndex = squad.membersList.findIndex((m: any) => cleanPhone(m.phone) === cleanTargetPhone);
            if (mIndex === -1) {
              squad.membersList.push({
                phone: phone,
                name: (requestObj ? requestObj.name : "") || "عضو قريب",
                points: 0,
                joinedAt: new Date().toISOString()
              });
            }
            squad.members = squad.membersList.length;
            squads[fIndex] = squad;
            joinedSquad = squad;

            // Update customer membership info
            const membership = { id: squad.id, squadId: squad.id, name: squad.name, joinedAt: new Date().toISOString() };
            const cidx = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanTargetPhone);
            if (cidx > -1) {
              const ids = new Set([...(customers[cidx].squadIds || []), customers[cidx].squadId].filter(Boolean).map(String));
              ids.add(String(squad.id));
              customers[cidx] = {
                ...customers[cidx],
                name: (requestObj ? requestObj.name : "") || customers[cidx].name,
                squadId: squad.id,
                squadIds: [...ids],
                diwaniyaName: squad.name,
                diwaniyaMemberships: [...(customers[cidx].diwaniyaMemberships || []).filter((m: any) => String(m.squadId || m.id) !== String(squad.id)), membership]
              };
            } else {
              customers.push({
                id: "CUST-" + Date.now().toString(36),
                name: (requestObj ? requestObj.name : "") || "",
                phone: phone,
                address: "",
                lastOrderDate: new Date().toISOString(),
                squadId: squad.id,
                squadIds: [String(squad.id)],
                diwaniyaName: squad.name,
                diwaniyaMemberships: [membership],
                loyaltyPoints: 0,
                points: 0
              });
            }
          }
        }

        return { geofenceJoinRequests: reqs, squads, customers };
      });
      if (!ok) throw new Error("Failed atomic transaction");
      res.json({ success: true, squad: joinedSquad });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-create", async (req, res) => {
    const { name, phone, customerName } = req.body;
    if (!name) return res.status(400).json({ error: "Missing squad name" });
    try {
      let createdSquad: any = null;
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const customers = Array.isArray(current.customers) ? [...current.customers] : [];
        const newSquadId = squads.length > 0 ? Math.max(...squads.map((s:any)=>Number(s.id) || 0)) + 1 : 1;
        const cleanQPhone = cleanPhone(phone);
        createdSquad = {
           id: newSquadId,
           name: name,
           tier: "برونزية",
           points: 0,
           totalPoints: 0,
           teamPoints: 0,
           kingOrders: 0,
           members: phone ? 1 : 0,
           king: customerName || "عميل",
           phone: phone,
           membersList: phone ? [{ name: customerName || "عميل", phone: phone, points: 0, joinedAt: new Date().toISOString() }] : [],
           createdAt: new Date().toISOString()
        };
        squads.push(createdSquad);
        if (phone) {
           const cidx = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanQPhone);
           const membership = { id: newSquadId, squadId: newSquadId, name, joinedAt: new Date().toISOString() };
           if (cidx > -1) {
              const ids = new Set([...(customers[cidx].squadIds || []), customers[cidx].squadId].filter(Boolean).map(String));
              ids.add(String(newSquadId));
              customers[cidx] = { ...customers[cidx], name: customerName || customers[cidx].name, squadId: newSquadId, squadIds: [...ids], diwaniyaName: name, diwaniyaMemberships: [...(customers[cidx].diwaniyaMemberships || []).filter((m:any)=>String(m.squadId||m.id)!==String(newSquadId)), membership] };
           } else {
              customers.push({ id: "CUST-" + Date.now().toString(36), name: customerName || "", phone, address: "", lastOrderDate: new Date().toISOString(), squadId: newSquadId, squadIds: [String(newSquadId)], diwaniyaName: name, diwaniyaMemberships: [membership], loyaltyPoints: 0, points: 0 });
           }
        }
        return { squads, customers };
      });
      if (!ok) throw new Error("Failed to save squad");
      res.json({ success: true, squad: createdSquad });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-join", async (req, res) => {
   const { phone, squadId, name } = req.body;
   if (!phone || !squadId) return res.status(400).json({ error: "Missing phone or squadId" });
   try {
     const cleanQPhone = cleanPhone(phone);
     let joinedSquad: any = null;
     const ok = await updateAppDataAtomically((current: any) => {
       const squads = Array.isArray(current.squads) ? [...current.squads] : [];
       const customers = Array.isArray(current.customers) ? [...current.customers] : [];
       let finalSquadIndex = squads.findIndex((s:any) => String(s.id) === String(squadId));
       if (finalSquadIndex === -1) {
         squads.push({ id: squadId, name: `ديوانية ${squadId}`, tier: "برونزية", points: 0, totalPoints: 0, teamPoints: 0, members: 0, membersList: [], createdAt: new Date().toISOString() });
         finalSquadIndex = squads.length - 1;
       }
       const squad = { ...squads[finalSquadIndex] };
       squad.membersList = Array.isArray(squad.membersList) ? [...squad.membersList] : [];
       const existingMemberIndex = squad.membersList.findIndex((m:any) => cleanPhone(m.phone) === cleanQPhone);
       if (existingMemberIndex === -1) {
         squad.membersList.push({ phone, name: name || "عميل", points: 0, joinedAt: new Date().toISOString() });
       } else if (name) {
         squad.membersList[existingMemberIndex] = { ...squad.membersList[existingMemberIndex], name };
       }
       squad.members = squad.membersList.length;
       squads[finalSquadIndex] = squad;
       joinedSquad = squad;
       const membership = { id: squad.id, squadId: squad.id, name: squad.name, joinedAt: new Date().toISOString() };
       const cidx = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanQPhone);
       if (cidx > -1) {
         const ids = new Set([...(customers[cidx].squadIds || []), customers[cidx].squadId].filter(Boolean).map(String));
         ids.add(String(squad.id));
         customers[cidx] = { ...customers[cidx], name: name || customers[cidx].name, squadId: squad.id, squadIds: [...ids], diwaniyaName: squad.name, diwaniyaMemberships: [...(customers[cidx].diwaniyaMemberships || []).filter((m:any)=>String(m.squadId||m.id)!==String(squad.id)), membership] };
       } else {
         customers.push({ id: "CUST-" + Date.now().toString(36), name: name || "", phone, address: "", lastOrderDate: new Date().toISOString(), squadId: squad.id, squadIds: [String(squad.id)], diwaniyaName: squad.name, diwaniyaMemberships: [membership], loyaltyPoints: 0, points: 0 });
       }
       return { customers, squads };
     });
     if (!ok) throw new Error("Failed to join squad");
     res.json({ success: true, squad: joinedSquad });
   } catch(e) {
     res.status(500).json({ error: String(e) });
   }
  });

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

      let matchedCustomers: any[] = [];
      customers.forEach((customer: any) => {
        const phoneField = customer.phone;
        if (phoneField && cleanPhone(phoneField) === cleanQueryPhone) {
          matchedCustomers.push({
            ...customer,
            loyaltyPoints: customer.loyaltyPoints !== undefined ? customer.loyaltyPoints : (customer.points || 0),
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
            loyaltyPoints: 0,
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
            loyaltyPoints: 0,
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
      squadId,
      squadName,
      squadTier,
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
      squadId: squadId || null,
      squadName: squadName || null,
      squadTier: squadTier || null,
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

      await updateAppDataAtomically((current) => {
        const orders = [...(current.orders || [])];
        const customers = [...(current.customers || [])];
        const squads = [...(current.squads || [])];
        
        orders.push(newOrder);

        const cleanPhoneQuery = cleanPhone(customerPhone);
        let existingIndex = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanPhoneQuery);

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

        let attributedSquad = squadId;
        if (!attributedSquad && customerPhone) {
            const custSquad = squads.find((sq: any) => 
                 (sq.membersList || []).some((m: any) => cleanPhone(m.phone) === cleanPhoneQuery)
            );
            if (custSquad) attributedSquad = String(custSquad.id);
        }

        if (attributedSquad) {
           const sqIndex = squads.findIndex((s:any) => String(s.id) === String(attributedSquad));
           if (sqIndex > -1) {
               if (customerPhone) {
                   if (!squads[sqIndex].membersList) squads[sqIndex].membersList = [];
                   let mIndex = squads[sqIndex].membersList.findIndex((m:any) => cleanPhone(m.phone) === cleanPhoneQuery);
                   if (mIndex > -1) {
                       if (customerName && (!squads[sqIndex].membersList[mIndex].name || squads[sqIndex].membersList[mIndex].name === "عميل")) {
                           squads[sqIndex].membersList[mIndex].name = customerName;
                       }
                   } else {
                       squads[sqIndex].membersList.push({
                           phone: customerPhone,
                           name: customerName || "عميل",
                           points: 0
                       });
                       squads[sqIndex].members = squads[sqIndex].membersList.length;
                   }
               }
           }
        }
        return { orders, customers, squads };
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
      const { orderId, name, amount, customerMobile, customerEmail, baseUrl } = req.body;

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

      const splitPayments = existingOrder.splitPayments || [];
      const orderTotal = Number(existingOrder.total) || 0;
      const totalPaid = splitPayments
        .filter((sp: any) => sp.status === "paid")
        .reduce((sum: number, sp: any) => sum + (Number(sp.amount) || 0), 0);

      if (orderTotal > 0 && totalPaid >= orderTotal - 0.005) {
         return res.status(400).json({ error: "تم إكتمال دفع الفاتورة مسبقاً" });
      }

      const numericAmount = parseFloat(parseFloat(amount).toFixed(3));
      if (orderTotal > 0 && totalPaid + numericAmount > orderTotal + 0.005) {
         return res.status(400).json({ error: "المبلغ يتجاوز المتبقي من الفاتورة" });
      }

      const sanitizePhone = (p: string) => (p || "").replace(/\D/g, "").slice(-8);
      const reqPhone = sanitizePhone(customerMobile);

      // Allow multiple payments from same phone if it's a split and balance remains. 
      // The hasPaid check was blocking "Pay remaining" if same person tries again.
      const hasPaid = splitPayments.some((sp: any) => sanitizePhone(sp.phone) === reqPhone && sp.status === "paid");
      if (hasPaid && existingOrder.splitType !== "traditional" && existingOrder.splitType !== "roulette") {
         // If it's a general split or repay, we might want to allow it.
         // Actually, even in traditional, if they want to cover someone else, why not?
         // Let's just warn but allow, or allow for "Pay Remaining" specifically.
      }
      
      // Better: Just remove this check or make it more flexible. 
      // Most users won't accidentally pay twice, and if they want to pay more, we should let them.
      /*
      if (hasPaid) {
         return res.status(400).json({ error: "هذا الرقم قام بالدفع مسبقاً" });
      }
      */

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
      let reqOrigin = baseUrl || req.get("origin");
      let devOrProdUrl = (reqOrigin && reqOrigin !== "null" && reqOrigin !== "undefined") ? reqOrigin : protocol + "://" + host;

      if (!devOrProdUrl || devOrProdUrl.includes("undefined") || devOrProdUrl === "null") {
        // Fallback to current domain if possible, otherwise use a safe default
        devOrProdUrl = protocol + "://" + host;
      }

      // If localhost, we might need a public proxy but for webhooks to hit this server 
      // the domain must be publicly accessible.
      
      // Ensure no trailing slash
      devOrProdUrl = devOrProdUrl.replace(/\/$/, "");

      const finalAmount = parseFloat(amount).toFixed(3);

      let generatedReturnUrl = `${devOrProdUrl}/api/payment-return/${orderId}-S-${splitId}/success`;
      let generatedCancelUrl = `${devOrProdUrl}/api/payment-return/${orderId}-S-${splitId}/failed`;
      // FIX: Use devOrProdUrl instead of hardcoded domain to ensure webhooks reach the correct environment!
      const generatedNotifyUrl = `${devOrProdUrl}/api/payment-webhook/${orderId}/${splitId}`;

      console.log(`[SPLIT] Generated Notify URL: ${generatedNotifyUrl}`);

      // Update with pending split info
      const newSplitEntry = {
        id: splitId,
        name: name || "Customer",
        phone: customerMobile || "",
        amount: numericAmount,
        status: "pending",
        date: new Date().toISOString(),
      };

      try {
        await updateAppDataAtomically((current) => {
           let orders = [...(current.orders || [])];
           let invoices = [...(current.invoices || [])];
           
           let idx = orders.findIndex((o: any) => String(o.id).trim().toUpperCase() === String(orderId).trim().toUpperCase());
           if (idx !== -1) {
              if (!orders[idx].splitPayments) orders[idx].splitPayments = [];
              orders[idx].splitPayments.push(newSplitEntry);
              return { orders };
           } else {
              idx = invoices.findIndex((o: any) => String(o.id).trim().toUpperCase() === String(orderId).trim().toUpperCase());
              if (idx !== -1) {
                 if (!invoices[idx].splitPayments) invoices[idx].splitPayments = [];
                 invoices[idx].splitPayments.push(newSplitEntry);
                 return { invoices };
              }
           }
           return null;
        });
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
        reference: { id: splitId },
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
        baseUrl,
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
      let reqOrigin = baseUrl || req.get("origin");
      let devOrProdUrl = (reqOrigin && reqOrigin !== "null" && reqOrigin !== "undefined") ? reqOrigin : protocol + "://" + host;

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
      const generatedReturnUrl = `${devOrProdUrl}/api/payment-return/${orderId}/success`;
      const generatedCancelUrl = `${devOrProdUrl}/api/payment-return/${orderId}/failed`;
      // Webhooks MUST go to production to bypass sandbox blocking!
      // Use devOrProdUrl instead of hardcoded domain
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
      
      const rawFinalAmount = parseFloat(amount).toFixed(3);
      const finalAmount = parseFloat(rawFinalAmount);

      if (index !== -1) {
        orders[index].paymentId = knetTrackId;
        orders[index].lastPaymentAmount = finalAmount;
        await updateAppData({ orders });
      }

      // Check if amount is valid for UPayments (min 0.001 KWD)
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

      await updateAppDataAtomically((current) => {
        let orders = [...(current.orders || [])];
        const index = orders.findIndex((o: any) => o.id === id);
        if (index !== -1) {
          orders[index].paymentLink = paymentLink;
          return { orders };
        }
        return null;
      });
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

      await updateAppDataAtomically((current) => {
        let orders = [...(current.orders || [])];
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
            return { orders };
          }
        }
        return null;
      });
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

      let loserName = "";
      await updateAppDataAtomically((current) => {
        let orders = [...(current.orders || [])];
        const index = orders.findIndex((o: any) => o.id === id);
        if (index === -1) return null;

        const order = orders[index];
        if (!order.splitParticipants || order.splitParticipants.length === 0) return null;

        if (order.rouletteLoser) {
          loserName = order.rouletteLoser;
          return null;
        }

        const loserIndex = Math.floor(Math.random() * order.splitParticipants.length);
        const loser = order.splitParticipants[loserIndex];

        orders[index].rouletteLoser = loser.name;
        orders[index].rouletteSpunAt = new Date().toISOString();
        loserName = loser.name;
        return { orders };
      });

      res.json({ success: true, loser: loserName });
    } catch (e) {
      res.status(500).json({ error: "Failed to spin roulette" });
    }
  });

  // Payment Webhook
  app.post(
    ["/api/payment-webhook/:pathOrderId/:pathSplitId", "/api/payment-webhook/:pathOrderId", "/api/payment-webhook", "/api/webhook/upayments"],
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
        let splitId = pathSplit || "";

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
            req.body?.result ||
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
          ["SUCCESS", "CAPTURED", "PAID", "APPROVED", "SUCCESSFUL", "TRUE", "AUTHORIZED", "HOSTED_SUCCESS", "1"].includes(
            statusStr,
          ) ||
          req.body?.status === true ||
          req.body?.status === 1 ||
          String(req.body?.status).toUpperCase() === "SUCCESS" ||
          String(req.body?.result).toUpperCase() === "SUCCESS" ||
          String(req.body?.Result).toUpperCase() === "SUCCESS" ||
          String(req.body?.Status).toUpperCase() === "SUCCESS";

        if (orderId) {
          await handlePaymentUpdate(orderId, splitId, status, req.body);
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
        let splitId = (req.query.splitId as string) || (req.query.SplitID as string) || "";

        // Fallback if orderId has '?'
        if (typeof orderId === "string" && orderId.includes("?")) {
          orderId = orderId.split("?")[0];
        }

        let isSplit = !!splitId;
        let originalOrderId = String(orderId);
        let baseOrderId = originalOrderId.toUpperCase();
        
        // Radical Fix: Ensure baseOrderId is correctly stripped of split suffixes even with complex IDs
        if (baseOrderId.includes("-S-")) {
           isSplit = true;
           const parts = originalOrderId.split("-S-");
           if (parts.length > 2) {
              // Format was ORDER_ID-S-S-UNIQUE
              baseOrderId = parts[0].toUpperCase();
              if (!splitId) splitId = "S-" + parts[2];
           } else if (parts.length === 2) {
              // Format might be ORDER_ID-S-UNIQUE
              baseOrderId = parts[0].toUpperCase();
              if (!splitId) splitId = parts[1];
           }
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

          // لا نعتبر Apple Pay / OTP / redirect intermediate فشل إلا إذا كان الفشل صريحًا.
          return [
            "FAILED",
            "FAILURE",
            "CANCELED",
            "CANCELLED",
            "ERROR",
            "DECLINED",
            "REJECTED",
            "EXPIRED",
            "NOT CAPTURED",
            "NOT_CAPTURED",
          ].includes(s);
        });
        let isExplicitSuccess = statusFields.some((x) => {
          if (!x) return false;
          let s = String(x).toUpperCase().trim();
          if (s.includes("?")) s = s.split("?")[0];
          return (
            ["SUCCESS", "CAPTURED", "PAID", "APPROVED", "SUCCESSFUL", "AUTHORIZED", "TRUE", "HOSTED_SUCCESS", "1"].includes(
              s,
            ) || s === "TRUE" || s === "SUCCESS" || s === "SUCCESSFUL" || s === "1"
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
          await handlePaymentUpdate(orderId, splitId, isExplicitSuccess, { ...req.body, ...req.query });
        }
        
        if (false) {
          const docRef = doc(db, "appData", "shared_company_data");
          const d = await getAppDataRef();
          const appData = d.data() || {};
          let orders = appData.orders || [];
          let invoices = appData.invoices || [];
          const orderIndex = orders.findIndex((o: any) => String(o.id).toUpperCase() === baseOrderId);
          const invoiceIndex = invoices.findIndex((o: any) => String(o.id).toUpperCase() === baseOrderId);

          let updated = false;

          if (orderIndex !== -1) {
            phone =
              orders[orderIndex].customerPhone ||
              orders[orderIndex].phone ||
              "";
            const currentStatus = orders[orderIndex].status;

            if (isSplit) {
              if (!orders[orderIndex].splitPayments) orders[orderIndex].splitPayments = [];
              const splitIdx = orders[orderIndex].splitPayments.findIndex((s: any) => {
                const sid = String(s.id).toUpperCase();
                const target = String(splitId).toUpperCase();
                return sid === target || sid === `S-${target}` || target === `S-${sid}` || (sid.length > 5 && target.includes(sid));
              });
              
              if (splitIdx !== -1) {
                 if (isExplicitSuccess && orders[orderIndex].splitPayments[splitIdx].status !== "paid") {
                    orders[orderIndex].splitPayments[splitIdx].status = "paid";
                    orders[orderIndex].splitPayments[splitIdx].datePaid = new Date().toISOString();
                    
                    // Update totalSpent immediately, but DO NOT add loyalty points yet
                    const payer = orders[orderIndex].splitPayments[splitIdx];
                    const cPhone = cleanPhone(payer.phone);
                    if (cPhone) {
                       const customers = appData.customers || [];
                       const existingCustIdx = customers.findIndex((c: any) => cleanPhone(c.phone) === cPhone);
                       if (existingCustIdx === -1) {
                         customers.push({
                           id: "CUST-" + Date.now().toString(36) + Math.random().toString(36).slice(-4),
                           name: payer.name || "صديق عميل",
                           phone: payer.phone,
                           acquired_via_split: true,
                           createdAt: new Date().toISOString(),
                           totalSpent: Number(payer.amount) || 0,
                           loyaltyPoints: 0, // Wait until fully paid to add points
                         });
                       } else {
                         customers[existingCustIdx].totalSpent = (Number(customers[existingCustIdx].totalSpent) || 0) + (Number(payer.amount) || 0);
                         customers[existingCustIdx].lastUpdated = new Date().toISOString();
                       }
                       appData.customers = customers; // Ensure reference updates
                    }
                    
                    const totalPaid = orders[orderIndex].splitPayments
                      .filter((s: any) => s.status === "paid")
                      .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
                    
                    const totalPaidFils = Math.round(totalPaid * 1000);
                    const orderTotalFils = Math.round((Number(orders[orderIndex].total) || 0) * 1000);

                    if (totalPaidFils >= orderTotalFils - 5) {
                      orders[orderIndex].status = "تم الدفع وجاري التوصيل";
                      orders[orderIndex].paymentStatus = "paid";
                      orders[orderIndex].paidAt = new Date().toISOString();
                      
                      // Now that the ENTIRE order is fully paid, distribute loyalty points to all contributors!
                      orders[orderIndex].splitPayments.filter((s: any) => s.status === "paid").forEach((p: any) => {
                          const cleanP = cleanPhone(p.phone);
                          if (cleanP && appData.customers) {
                              const eIdx = appData.customers.findIndex((c: any) => cleanPhone(c.phone) === cleanP);
                              if (eIdx !== -1) {
                                  appData.customers[eIdx].loyaltyPoints = (Number(appData.customers[eIdx].loyaltyPoints) || 0) + (Number(p.amount) || 0);
                              }
                          }
                      });
                    }
                    updated = true;
                    console.log(`[PAYMENT] Split ${splitId} for Order ${baseOrderId} marked paid via return URL`);
                  } else if (isExplicitFailure) {
                    if (orders[orderIndex].splitPayments[splitIdx].status !== "paid") {
                      orders[orderIndex].splitPayments[splitIdx].status = "failed";
                      updated = true;
                    }
                 }
              }
            } else if (
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
                if (orders[orderIndex].paymentStatus !== "paid" && !orders[orderIndex].status.startsWith("تم الدفع")) {
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
                  
                  // Auto-fill splitPayments so the UI sees it as fully paid
                  if (!orders[orderIndex].splitPayments) orders[orderIndex].splitPayments = [];
                  const localTotalPaid = orders[orderIndex].splitPayments
                    .filter((s: any) => String(s.status).toLowerCase() === "paid")
                    .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
                    const remainder = Number(orders[orderIndex].total) - localTotalPaid;
                    if (remainder >= 0.005) {
                      orders[orderIndex].splitPayments.push({
                        id: "S-" + Date.now().toString(36),
                        name: "مكمل الفاتورة",
                        phone: orders[orderIndex].customerPhone || "00000000",
                        amount: remainder,
                        status: "paid",
                        date: new Date().toISOString(),
                        paymentId: orders[orderIndex].transactionId
                      });
                    }
                  }

                  // Update customer points
                  const cPhone = cleanPhone(orders[orderIndex].customerPhone);
                  const custIdx = appData.customers?.findIndex(
                    (c: any) => cleanPhone(c.phone) === cPhone,
                  );
                  if (custIdx !== -1) {
                    const amountPaid = orders[orderIndex].lastPaymentAmount !== undefined ? Number(orders[orderIndex].lastPaymentAmount) : Number(orders[orderIndex].total) || 0;
                    appData.customers[custIdx].totalSpent =
                      (Number(appData.customers[custIdx].totalSpent) || 0) +
                      amountPaid;
                    appData.customers[custIdx].loyaltyPoints =
                      (Number(appData.customers[custIdx].loyaltyPoints) || 0) +
                      amountPaid;
                    appData.customers[custIdx].lastUpdated = new Date().toISOString();
                  }
                }
              } else {
                console.log(`[PAYMENT] Order ${orderId} unverified return status`);
              }
            }

          if (invoiceIndex !== -1) {
            if (!phone) phone = invoices[invoiceIndex].customerPhone || invoices[invoiceIndex].phone || "";
            const currentStatus = invoices[invoiceIndex].status;
            const normalizedInvoiceId = String(orderId).toUpperCase();
            const invoiceIndexes = invoices.map((inv: any, idx: number) => String(inv.id).toUpperCase() === normalizedInvoiceId ? idx : -1).filter((idx: number) => idx !== -1);

            if (currentStatus === "جديد" || currentStatus === "بانتظار الدفع" || currentStatus === "تم الدفع وجاري التوصيل") {
              const transactionId = req.body?.reference?.id || req.body?.TrackID || req.query?.TrackID || "upayments_auth";
              if (isExplicitFailure) {
                invoiceIndexes.forEach((idx: number) => {
                  invoices[idx].status = "فشل في عملية الدفع";
                  invoices[idx].paymentStatus = "failed";
                  invoices[idx].transactionId = transactionId;
                });
                updated = true;
              } else if (isExplicitSuccess) {
                invoiceIndexes.forEach((idx: number) => {
                  invoices[idx].status = "تم الدفع وجاري التوصيل";
                  invoices[idx].paymentStatus = "paid";
                  invoices[idx].transactionId = transactionId;
                });
                updated = true;
              }
            }
          }

          if (updated) {
            await updateAppData({ orders, invoices, customers: appData.customers || [] });
          }
        }

        // Target Base URL
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

        // Double check against real database status since webhooks often arrive faster or browsers can misreport
        if (orderId) {
           try {
              const d = await getAppDataRef();
              const reqData = d.data() || {};
              const dbOrders = reqData.orders || [];
              const oIdx = dbOrders.findIndex((o: any) => String(o.id).toUpperCase() === baseOrderId);
              if (oIdx !== -1) {
                 if (isSplit && dbOrders[oIdx].splitPayments) {
                    const splitIdx = dbOrders[oIdx].splitPayments.findIndex((s: any) => String(s.id).toUpperCase() === String(splitId).toUpperCase() || String(s.id).toUpperCase() === `S-${String(splitId).toUpperCase()}` || String(splitId).toUpperCase().includes(String(s.id).toUpperCase()));
                    if (splitIdx !== -1 && dbOrders[oIdx].splitPayments[splitIdx].status === "paid") {
                       paymentParam = "success";
                       isExplicitFailure = false;
                       isExplicitSuccess = true;
                    }
                 } else {
                    if (dbOrders[oIdx].paymentStatus === "paid" || (dbOrders[oIdx].status || "").startsWith("تم الدفع")) {
                       paymentParam = "success";
                       isExplicitFailure = false;
                       isExplicitSuccess = true;
                    }
                 }
              }
           } catch(e) {}
        }
        
        let trackUrl = `${baseUrl}/track?order_id=${baseOrderId}&payment=${paymentParam}`;
        if (isSplit) {
           trackUrl = `${baseUrl}/split/${baseOrderId}?payment=${paymentParam}`;
        }

        // We removed the immediate redirect so the beautiful HTML screen always appears.

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
                        localStorage.setItem("track_order_id", "${baseOrderId}");
                        localStorage.setItem("track_status", "${paymentParam}");
                        if ("${paymentParam}" === "success" || "${paymentParam}" === "paid") {
                            localStorage.setItem("post_payment_open_order_id", "${baseOrderId}");
                        }
                    } catch(e) {}

                    function closePopupAndRedirect(e) {
                        if (e) e.preventDefault();
                        const targetUrl = e ? e.currentTarget.href : "${trackUrl}";
                        
                        try {
                            if (window.opener && !window.opener.closed) {
                                window.opener.postMessage(JSON.stringify({ type: 'payment_return', orderId: '${baseOrderId}', payment: '${paymentParam}' }), '*');
                                window.opener.postMessage({ type: 'PAYMENT_COMPLETE', url: targetUrl, orderId: '${baseOrderId}', payment: '${paymentParam}' }, '*');
                                setTimeout(() => window.close(), 100);
                            } else {
                                window.location.href = targetUrl;
                            }
                        } catch (err) {
                            window.location.href = targetUrl;
                        }
                    }

                    // Auto-trigger completion immediately to avoid duplicate screens
                    closePopupAndRedirect();
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
      let resultData = null;
      await updateAppDataAtomically((current) => {
        const orders = [...(current.orders || [])];
        const invoices = [...(current.invoices || [])];

        const orderIdx = orders.findIndex((o: any) => o.id === id);
        if (orderIdx === -1) return null;

        const orderData = orders[orderIdx];
        const invoiceData = {
          ...orderData,
          id: orderData.id,
          invoiceId: orderData.id,
          paymentStatus: "paid",
          status: "تم الدفع وجاري التوصيل",
          completedAt: new Date().toISOString(),
        };

        const existingInvoiceIdx = invoices.findIndex((inv: any) => String(inv.id).toUpperCase() === String(invoiceData.id).toUpperCase());
        if (existingInvoiceIdx !== -1) {
          invoices[existingInvoiceIdx] = { ...invoices[existingInvoiceIdx], ...invoiceData };
        } else {
          invoices.push(invoiceData);
        }
        orders.splice(orderIdx, 1);
        resultData = invoiceData;
        return { orders, invoices };
      });

      if (!resultData) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({
        message: "Order moved to invoices successfully",
        invoiceData: resultData,
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

  app.get("/api/debug-collections", async (req, res) => {
    try {
      const q = await getDocs(collection(db, "appData"));
      const docs = q.docs.map(d => ({ id: d.id, data: d.data() }));
      res.json(docs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-docs", async (req, res) => {
    try {
      const data = await getAppData();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-search", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const results = [];
      const searchObj = (obj, path) => {
        if (!obj) return;
        
        // Search keys
        if (typeof obj === "object" && !Array.isArray(obj)) {
          for (const key in obj) {
            if (key.toLowerCase().includes("tier") || key.toLowerCase().includes("level")) {
               results.push({ path: path + "." + key, type: "key", value: obj[key] });
            }
          }
        }

        if (typeof obj === "object") {
          for (const key in obj) {
            searchObj(obj[key], path ? `${path}.${key}` : key);
          }
        }
      };
      searchObj(data, "");
      res.json(results);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-squads", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const sqs = (data.squads || []).map(s => ({
        id: s.id,
        name: s.name,
        tier: s.tier,
      }));
      res.json(sqs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-loyalty", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      res.json(data.loyaltySettings || { message: "No loyalty settings" });
    } catch (e) {
      res.status(500).json({ error: e.message });
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
        settings: data.settings || {},
        allKeys: Object.keys(data),
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
        let expiredIds: string[] = [];

        allOrders.forEach((o: any) => {
          if (o.status === "قيد تجميع القطية" && o.createdAt) {
            const created = new Date(o.createdAt).getTime();
            if (now - created > TIMEOUT) {
              expiredIds.push(o.id);
            }
          }
        });

        if (expiredIds.length > 0) {
          console.log(`[SPLIT_BG] Expired: ${expiredIds.join(", ")}`);
          await updateAppDataAtomically((current) => {
            const updatedOrders = (current.orders || []).map((o: any) => {
              if (expiredIds.includes(o.id) && o.status === "قيد تجميع القطية") {
                 return { ...o, status: "ملغي - انتهى وقت القطية" };
              }
              return o;
            });
            return { orders: updatedOrders };
          });
        }
      } catch (err) {
        console.error("[SPLIT] Background task error:", err);
      }
    }, 60 * 1000); // Check every 1 minute
  });
}

startServer();
