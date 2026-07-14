import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

async function run() {
  console.log("Reading shared_company_data from Firestore...");
  try {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    if (!d.exists()) {
      console.log("No shared_company_data found!");
      return;
    }
    const data = d.data();
    console.log("Success! Data loaded.");
    const customers = data.customers || [];
    const invoices = data.invoices || [];
    const orders = data.orders || [];
    console.log(`Counts: Customers ${customers.length}, Invoices ${invoices.length}, Orders ${orders.length}`);

    const target = "94493883";
    
    console.log("Searching in customers...");
    const matchedC = customers.filter(c => String(c.phone || "").includes(target));
    console.log("Matched customers:", matchedC);

    console.log("Searching in invoices...");
    const matchedI = invoices.filter(i => String(i.phone || i.customerPhone || "").includes(target));
    console.log("Matched invoices:", matchedI.map(i => ({ customerName: i.customerName, phone: i.phone || i.customerPhone, id: i.id })));

    console.log("Searching in orders...");
    const matchedO = orders.filter(o => String(o.phone || o.customerPhone || "").includes(target));
    console.log("Matched orders:", matchedO.map(o => ({ customerName: o.customerName, phone: o.phone || o.customerPhone, id: o.id })));

  } catch (e) {
    console.error("Error reading doc:", e);
  }
}
run();
