import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
    const d = await getDocs(collection(db, "orders"));
    const stringOrders = d.docs.map(x => x.data()).filter(o => JSON.stringify(o).includes('***REDACTED***'));
    console.log(JSON.stringify(stringOrders.map(o => ({ status: o.status, created: o.createdAt, id: o.id, _raw: Object.keys(o) })), null, 2));
}
checkOrders();
