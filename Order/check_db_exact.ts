import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId || "(default)");

async function run() {
  const d = await getDoc(doc(db, "appData", "shared_company_data"));
  if (d.exists()) {
    const data = d.data();
    console.log("Categories in DB:", data.productCategories || data.categories || data.menuCategories);
    console.log("Products in DB:", data.products?.length);
    if (data.products?.length > 0) {
       console.log("Sample product:", data.products[0]);
    }
  } else {
    console.log("DB doesn't exist");
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
