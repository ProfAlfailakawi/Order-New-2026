import * as dotenv from 'dotenv';
dotenv.config();
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
    const cols = await getDocs(collection(db, "appData"));
    let found = false;
    cols.forEach(d => {
        const str = JSON.stringify(d.data());
        if (str.includes("p4fj56urv")) {
            console.log("Found in doc:", d.id);
            // find what has it
            const data = d.data();
            for(const key of Object.keys(data)) {
                if(JSON.stringify(data[key]).includes("p4fj56urv")) {
                     console.log("  In key:", key);
                }
            }
            found = true;
        }
    });

    const productsCol = await getDocs(collection(db, "products"));
    productsCol.forEach(d => {
        const str = JSON.stringify(d.data());
        console.log("Product doc:", d.id);
        if (str.includes("p4fj56urv") || d.id === "p4fj56urv") {
            console.log("Found in products col:", d.id);
            found = true;
        }
    });
    
    if(!found) console.log("Not found anywhere");
}

check().catch(console.error).finally(() => process.exit(0));
