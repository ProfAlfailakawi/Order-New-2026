import * as dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
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

    if (invoice && invoice.items) {
        console.log("Looking up invoice items in products:");
        for (const it of invoice.items) {
            console.log("Invoice item ID:", it.id, "productId", it.productId);
            const pr = products.find(p => p.id === it.id || p.id === it.productId);
            console.log("Found product:", pr);
        }
    }
}

check().catch(console.error).finally(() => process.exit(0));
