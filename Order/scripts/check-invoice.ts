import * as dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';

import firebaseConfig from '../firebase-applet-config.json' assert { type: "json" };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    const data = d.data();
    const invoices = data.invoices || [];
    const invoice = invoices.find(i => i.id === "INV-1778428825291-7VPD");
    console.log("INVOICE:", JSON.stringify(invoice, null, 2));

    const products = data.products || [];
    console.log("PRODUCTS snippet:");
    console.log(JSON.stringify(products.slice(0, 2), null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
