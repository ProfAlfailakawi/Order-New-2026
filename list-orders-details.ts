import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listOrders() {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    const data = d.data() || {};
    const orders = data.orders || [];
    console.log("Orders:", JSON.stringify(orders.map(o => ({ id: o.id, status: o.status, total: o.total })), null, 2));
}
listOrders();
