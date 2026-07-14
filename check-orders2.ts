import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
    const d = await getDocs(collection(db, "orders"));
    const stringOrders = d.docs.map(x => x.data()).filter(o => JSON.stringify(o).includes('66665872'));
    console.log('from collection orders count:', stringOrders.length);
    console.log('Collection orders status:', stringOrders.map(o => o.status));

    const sRef = await getDoc(doc(db, "appData", "shared_company_data"));
    const sData = sRef.data() || {};
    const sOrders = (sData.orders || []).filter(o => JSON.stringify(o).includes('66665872'));
    console.log('from shared count:', sOrders.length);
    console.log('Shared orders status:', sOrders.map(o => o.status));
}
checkOrders();
