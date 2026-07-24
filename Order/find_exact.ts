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
  const indexOfPhone = str.indexOf("97424400");
  const indexOfTest = str.toLowerCase().indexOf("test");
  
  console.log("IndexOfPhone:", indexOfPhone);
  
  if (indexOfPhone > -1) {
     console.log("Phone content context:", str.substring(indexOfPhone - 100, indexOfPhone + 100));
  }
  
  process.exit(0);
}
check();
