import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createOrder() {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    const data = d.data() || {};
    const orders = data.orders || [];
    const newOrder = {
        id: `ORD-TEST-${Date.now()}`,
        status: "قيد تجميع القطية",
        total: 100,
        customerPhone: "99999999",
        createdAt: new Date().toISOString()
    };
    orders.push(newOrder);
    await updateDoc(doc(db, "appData", "shared_company_data"), { orders });
    console.log("Order created:", newOrder.id);
}
createOrder();
