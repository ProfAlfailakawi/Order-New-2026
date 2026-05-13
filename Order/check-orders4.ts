import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
    const sRef = await getDoc(doc(db, "appData", "shared_company_data"));
    const sData = sRef.data() || {};
    const sOrders: any[] = sData.orders || [];
    
    // sorting desc by createdAt
    sOrders.sort((a: any, b: any) => {
       const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
       const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
       return dateB - dateA;
    });

    console.log(`Total orders in shared: ${sOrders.length}`);
    const latest = sOrders.slice(0, 10).map(o => ({
       id: o.id, status: o.status, phone: o.customerPhone || o.phone, created: o.createdAt
    }));
    console.log(JSON.stringify(latest, null, 2));
}
checkOrders();
