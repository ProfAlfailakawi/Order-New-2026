import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, initializeFirestore } from "firebase/firestore";
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
      
      const target = orders.find((o: any) => o.id === "ORD-1779024002750-L3PS");
      if (target) {
          console.log("TARGET:", JSON.stringify(target, null, 2));
      } else {
          console.log("NOT FOUND ORD-1779024002750-L3PS");
      }
      
      const last5 = orders.slice(-5).map((o: any) => ({
         id: o.id,
         total: o.total,
         status: o.status,
         paymentStatus: o.paymentStatus,
         splitPayments: o.splitPayments,
      }));
      console.log("Last 5:", JSON.stringify(last5, null, 2));
      process.exit(0);
  } catch (e) {
      console.error(e);
      process.exit(1);
  }
}

main();
