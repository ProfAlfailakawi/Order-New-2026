import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const fbConfigPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
const appClient = initializeApp(firebaseConfig);
const db = getFirestore(appClient, firebaseConfig.firestoreDatabaseId || '(default)');

async function check() {
  const d = await getDoc(doc(db, "appData", "shared_company_data"));
  const data = d.data() || {};
  
  const text = JSON.stringify(data);
  // Match any digits with any characters in between
  // that form 97424400
  let cleanStr = text.replace(/\D/g, "");
  const index = cleanStr.indexOf('97424400');
  if (index > -1) {
    console.log("FOUND!");
    // find where
    const orders = data.orders || [];
    for(const o of orders) {
      if ((o.customerPhone||"").replace(/\D/g, "").includes("97424400") || (o.phone||"").replace(/\D/g, "").includes("97424400")) {
        console.log("Found in orders:", o.customerName);
      }
    }
    const inv = data.invoices || [];
    for(const i of inv) {
      if ((i.customerPhone||"").replace(/\D/g, "").includes("97424400") || (i.phone||"").replace(/\D/g, "").includes("97424400")) {
        console.log("Found in invoices:", i.customerName);
      }
    }
    const cust = data.customers || [];
    for(const c of cust) {
      if ((c.phone||"").replace(/\D/g, "").includes("97424400")) {
        console.log("Found in customers:", c.name);
      }
    }
  } else {
    console.log("NOT FOUND EVEN AFTER CLEANING");
  }

  process.exit(0);
}

check();
