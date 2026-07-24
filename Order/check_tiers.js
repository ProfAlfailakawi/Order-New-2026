import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const configPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const d = await getDoc(doc(db, "appdata", "shared_company_data"));
const data = d.data() || {};
console.log("Keys in settings:", data.settings ? Object.keys(data.settings) : "No settings");
console.log("Keys in root:", Object.keys(data));
console.log("Loyalty Tiers Setting:", data.settings?.loyaltyTiers);
console.log("Loyalty Tiers:", data.loyaltyTiers);
console.log("Squad Tiers Setting:", data.settings?.squadTiers);
console.log("Squad Tiers:", data.squadTiers);
process.exit(0);
