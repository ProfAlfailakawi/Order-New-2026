import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const firebaseConfig = JSON.parse(readFileSync(resolve("firebase-applet-config.json"), "utf8"));
const appClient = initializeApp(firebaseConfig);
const db = getFirestore(appClient, firebaseConfig.firestoreDatabaseId || "(default)");

function cleanPhone(phone: any): string {
    if (!phone) return "";
    let cleaned = String(phone).replace(/\D/g, "");
    cleaned = cleaned.replace(/^0+/g, "");
    if (cleaned.startsWith("965") && cleaned.length > 8) {
       cleaned = cleaned.substring(3);
    }
    return cleaned;
}

async function fixPoints() {
    console.log("Starting points recalculation...");
    try {
        const docRef = doc(db, "appData", "shared_company_data");
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
            console.error("No data found!");
            return;
        }

        const data = snapshot.data();
        const orders = data.orders || [];
        const invoices = data.invoices || [];
        const customers = data.customers || [];

        const allOrders = [...orders, ...invoices];

        // Map customerId to their clean phone
        const customerPhoneMap: Record<string, string> = {};
        customers.forEach((c: any) => {
            if (c.id && c.phone) {
                customerPhoneMap[c.id] = cleanPhone(c.phone);
            }
        });

        const spentByPhone: Record<string, number> = {};

        // Calculate actual spent per phone
        for (const o of allOrders) {
            let phone = cleanPhone(o.customerPhone || o.phone);
            
            if (!phone && o.customerId && customerPhoneMap[o.customerId]) {
                phone = customerPhoneMap[o.customerId];
            }

            if (!phone) continue;

            const status = o.status || "";
            const isPaid = o.paymentStatus === "paid" || status.startsWith("تم الدفع");
            
            if (isPaid) {
                const orderTotal = Number(o.total) || Number(o.totalAmount) || 0;
                spentByPhone[phone] = (spentByPhone[phone] || 0) + orderTotal;
            }
        }

        let updatedCount = 0;
        const updatedCustomers = customers.map((c: any) => {
            const phone = cleanPhone(c.phone);
            const actualSpent = phone ? Math.floor(spentByPhone[phone] || 0) : 0;
            
            // Only update if there's a discrepancy
            if (c.loyaltyPoints !== actualSpent || c.totalSpent !== actualSpent) {
                updatedCount++;
                return {
                    ...c,
                    loyaltyPoints: actualSpent,
                    totalSpent: actualSpent,
                    points: actualSpent
                };
            }
            return c;
        });

        if (updatedCount > 0) {
            await updateDoc(docRef, { customers: updatedCustomers });
            console.log(`Successfully updated ${updatedCount} customers with recalculated points.`);
        } else {
            console.log("All customers already have the correct points. No updates needed.");
        }
        
        process.exit(0);

    } catch (error) {
        console.error("Error recalculating points:", error);
        process.exit(1);
    }
}

fixPoints();
