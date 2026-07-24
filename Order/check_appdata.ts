import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const fbConfigPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
const appClient = initializeApp(firebaseConfig);
const db = getFirestore(appClient, firebaseConfig.firestoreDatabaseId || '(default)');

async function check() {
  try {
    const col = await getDocs(collection(db, "appData"));
    console.log("Documents in appData:");
    col.forEach(d => {
      console.log("-", d.id);
      const str = JSON.stringify(d.data());
      if (str.includes("***REDACTED***")) {
        console.log("!!! FOUND IN:", d.id);
      }
    });
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}

check();
