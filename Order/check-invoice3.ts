import * as dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    const data = d.data();

    const products = data.products || [];
    console.log("All Product IDs:", products.map(p => p.id));
}

check().catch(console.error).finally(() => process.exit(0));
