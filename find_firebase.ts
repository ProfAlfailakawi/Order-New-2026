import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const fbConfigPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
const appClient = initializeApp(firebaseConfig);
const db = getFirestore(appClient, firebaseConfig.firestoreDatabaseId || '(default)');

async function check() {
  try {
     const snap = await getDoc(doc(db, "customers", "97424400"));
     if (snap.exists()) {
       console.log("Found in /customers/97424400:", snap.data());
     } else {
       console.log("Not in /customers/");
     }
  } catch (e: any) {
     console.log("Error customers collection", e.message);
  }
  
  try {
     const snap2 = await getDoc(doc(db, "users", "97424400"));
     if (snap2.exists()) console.log("Found in /users/97424400");
  } catch (e: any) { }

  process.exit(0);
}
check();
