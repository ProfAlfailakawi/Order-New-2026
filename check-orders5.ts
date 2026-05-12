import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
    const sRef = await getDoc(doc(db, "appData", "shared_company_data"));
    const sData = sRef.data() || {};
    const sOrders = (sData.orders || []).filter((o: any) => JSON.stringify(o).includes('66665872'));
    console.log(JSON.stringify(sOrders.map((o: any) => ({ status: o.status, created: o.createdAt, id: o.id })), null, 2));

    const sInvoices = (sData.invoices || []).filter((o: any) => JSON.stringify(o).includes('66665872'));
    console.log("INVOICES:");
    console.log(JSON.stringify(sInvoices.map((o: any) => ({ status: o.status, created: o.createdAt, id: o.id })), null, 2));
}
checkOrders();
