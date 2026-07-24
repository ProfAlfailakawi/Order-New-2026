import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const fbConfigPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
const appClient = initializeApp(firebaseConfig);
const db = getFirestore(appClient, firebaseConfig.firestoreDatabaseId || '(default)');

async function check() {
  const users = await getDocs(collection(db, "users"));
  const customers = await getDocs(collection(db, "customers"));
  const orders = await getDocs(collection(db, "orders"));
  const invoices = await getDocs(collection(db, "invoices"));
  
  console.log("Docs in users:", users.size);
  console.log("Docs in customers:", customers.size);
  console.log("Docs in orders:", orders.size);
  console.log("Docs in invoices:", invoices.size);

  process.exit(0);
}

check();
