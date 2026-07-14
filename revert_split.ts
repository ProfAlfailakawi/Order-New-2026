import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, initializeFirestore } from "firebase/firestore";
import fs from "fs";

const configPath = "firebase-applet-config.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const app = initializeApp(config);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  config.firestoreDatabaseId || "(default)",
);

async function main() {
      const dRef = doc(db, "appData", "shared_company_data");
      const snap = await getDoc(dRef);
      const data = snap.data();
      const orders = data.orders || [];
      
      const orderId = "ORD-1779024002750-L3PS";
      const targetIdx = orders.findIndex((o: any) => o.id === orderId);
      
      if (targetIdx !== -1) {
          const splits = orders[targetIdx].splitPayments || [];
          let updated = false;
          splits.forEach((s: any) => {
             // Revert Gggh
             if (s.name === "Gggh" && s.status === "paid") {
                 s.status = "pending";
                 delete s.datePaid;
                 updated = true;
             }
          });
          
          if (updated) {
               await setDoc(dRef, { orders }, { merge: true });
               console.log("Reverted split for Gggh");
          }
      }
      process.exit(0);
}
main();
