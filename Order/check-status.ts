import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStatus() {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    const data = d.data() || {};
    const orders = data.orders || [];
    const testOrder = orders.find(o => o.id === "ORD-TEST-1778342752062");
    console.log("Order status:", testOrder ? testOrder.status : "not found");
}
checkStatus();
