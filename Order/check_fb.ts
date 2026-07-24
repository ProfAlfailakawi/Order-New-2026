import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, deleteDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const d = await getDoc(doc(db, "appData", "shared_company_data"));
  if (d.exists()) {
    const data = d.data();
    console.log("Products: ", data.products?.length);
    console.log("Orders: ", data.orders?.length);
    if (!data.products?.length && !data.orders?.length) {
      console.log("DB is empty. Deleting to ensure localFallbackDB works.");
      await deleteDoc(doc(db, "appData", "shared_company_data"));
    }
  } else {
    console.log("DB doesn't exist");
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
