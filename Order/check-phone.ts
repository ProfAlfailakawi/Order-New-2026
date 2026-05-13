import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import * as fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkPhone() {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    const data = d.data() || {};
    const orders = data.orders || [];
    console.log(`Total orders: ${orders.length}`);
    const firstFew = orders.slice(0, 10).map((o: any) => ({
      id: o.id,
      customerPhone: o.customerPhone,
      phone: o.phone,
      status: o.status,
      paymentStatus: o.paymentStatus,
      amount: o.amount
    }));
    fs.writeFileSync('all_orders.json', JSON.stringify(firstFew, null, 2));
    
    // check if it's anywhere in the string
    const stringOrders = JSON.stringify(orders);
    console.log('Includes 66665872:', stringOrders.includes('66665872'));
    
    if (stringOrders.includes('66665872')) {
       const userOrders = orders.filter((o: any) => JSON.stringify(o).includes('66665872'));
       console.log('Found orders containing the number:', userOrders.length);
       fs.writeFileSync('user_orders.json', JSON.stringify(userOrders, null, 2));
    }
}
checkPhone();
