import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
    const d = await getDocs(collection(db, "orders"));
    console.log(`Total orders in collection: ${d.docs.length}`);
    const stringOrders = JSON.stringify(d.docs.map(x => x.data()));
    console.log('Includes ***REDACTED***:', stringOrders.includes('***REDACTED***'));
}
checkOrders();
