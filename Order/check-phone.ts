import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

async function checkPhone() {
    console.log("Database ID:", firebaseConfig.firestoreDatabaseId || '(default)');
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    if (!d.exists()) {
      console.log("Document shared_company_data does NOT exist in Firestore!");
      return;
    }
    const data = d.data() || {};
    const orders = data.orders || [];
    const invoices = data.invoices || [];
    const customers = data.customers || [];
    
    console.log(`Total orders: ${orders.length}`);
    console.log(`Total invoices: ${invoices.length}`);
    console.log(`Total customers: ${customers.length}`);
    
    const query = '***REDACTED***';
    
    const matchingCustomers = customers.filter((c: any) => JSON.stringify(c).includes(query));
    const matchingInvoices = invoices.filter((i: any) => JSON.stringify(i).includes(query));
    const matchingOrders = orders.filter((o: any) => JSON.stringify(o).includes(query));
    
    console.log(`Matching customers:`, matchingCustomers);
    console.log(`Matching invoices:`, matchingInvoices);
    console.log(`Matching orders:`, matchingOrders);
}
checkPhone();
