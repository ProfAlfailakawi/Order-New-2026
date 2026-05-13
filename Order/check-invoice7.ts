import * as dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
    const productsCol = await getDocs(collection(db, "products"));
    productsCol.forEach(d => {
        const prod = d.data();
        if (d.id === "p4fj56urv" || prod.id === "p4fj56urv") {
            console.log("Found in products col matching the ID:", d.id, prod.name);
        }
    });

    const categories = await getDocs(collection(db, "categories"));
    categories.forEach(c => {
         // what if p4fj56urv is a category? No...
    });
}

check().catch(console.error).finally(() => process.exit(0));
