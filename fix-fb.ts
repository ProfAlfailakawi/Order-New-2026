import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const firebaseConfigStr = fs.readFileSync(
  "firebase-applet-config.json",
  "utf-8"
);
const firebaseConfig = JSON.parse(firebaseConfigStr);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

async function run() {
  const docRef = doc(db, "appData", "shared_company_data");
  const snap = await getDoc(docRef);
  const data = snap.data();
  const orders = data.orders || [];
  const index = orders.findIndex((o: any) => o.id === "ORD-1778952912568-8GM9");
  
  const sps = orders[index].splitPayments;
  
  if (sps.length > 1) {
     sps[0].status = "failed";
     sps[1].status = "paid";
  }
  
  await updateDoc(docRef, { orders });
  console.log(JSON.stringify(sps, null, 2));
  process.exit(0);
}
run();
