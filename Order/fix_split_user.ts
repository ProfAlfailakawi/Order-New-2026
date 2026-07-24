import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, initializeFirestore } from "firebase/firestore";
import fs from "fs";

const configPath = "firebase-applet-config.json";
if (!fs.existsSync(configPath)) {
  console.log("No config");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const app = initializeApp(config);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  config.firestoreDatabaseId || "(default)",
);

async function main() {
  try {
      const dRef = doc(db, "appData", "shared_company_data");
      const snap = await getDoc(dRef);
      if (!snap.exists()) {
          console.log("no shared_company_data");
          process.exit(0);
      }
      const data = snap.data();
      const orders = data.orders || [];
      
      const orderId = "ORD-1779024002750-L3PS";
      const targetIdx = orders.findIndex((o: any) => o.id === orderId);
      
      if (targetIdx !== -1) {
          const splits = orders[targetIdx].splitPayments || [];
          let updated = false;
          splits.forEach((s: any) => {
             if (s.status === "pending") {
                 s.status = "paid";
                 s.datePaid = new Date().toISOString();
                 updated = true;
             }
          });
          
          if (updated) {
               console.log("Saving...");
               await setDoc(dRef, { orders }, { merge: true });
               console.log("Fixed splits for", orderId);
          } else {
               console.log("Splits already paid for", orderId);
          }
      } else {
          console.log("Order not found:", orderId);
      }

      process.exit(0);
  } catch (e) {
      console.error(e);
      process.exit(1);
  }
}

main();
