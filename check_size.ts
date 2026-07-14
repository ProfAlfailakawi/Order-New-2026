import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const fbConfigPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
const appClient = initializeApp(firebaseConfig);
const db = getFirestore(appClient, firebaseConfig.firestoreDatabaseId || '(default)');

async function check() {
  const d = await getDoc(doc(db, "appData", "shared_company_data"));
  const data = d.data() || {};
  const str = JSON.stringify(data);
  console.log("Size in bytes:", Buffer.byteLength(str, 'utf8'));
  console.log("Size in KB:", Buffer.byteLength(str, 'utf8') / 1024);
  process.exit(0);
}

check();
