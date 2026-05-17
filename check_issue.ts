import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const configPath = "firebase-applet-config.json";
if (!fs.existsSync(configPath)) {
  console.log("No config");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function main() {
  const dRef = doc(db, "appData", "shared_company_data");
  const snap = await getDoc(dRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const orders = data.orders || [];
  const o = orders.find((x: any) => x.id === "ORD-1779024002750-L3PS");
  console.log("FOUND ORDER:", JSON.stringify(o, null, 2));
}

main();
