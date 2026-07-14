import admin from 'firebase-admin';
import fs from 'fs';

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));
} catch (error) {
  // Try previous location as fallback
  serviceAccount = JSON.parse(fs.readFileSync('/app/secrets/firebase-service-account.json', 'utf8'));
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const d = await db.collection("appdata").doc("shared_company_data").get();
  const data = d.data() || {};
  console.log("Keys in settings:", data.settings ? Object.keys(data.settings) : "No settings");
  console.log("Keys in root:", Object.keys(data));
  console.log("Loyalty Tiers Setting:", JSON.stringify(data.settings?.loyaltyTiers, null, 2));
  console.log("Loyalty Tiers Root:", JSON.stringify(data.loyaltyTiers, null, 2));
  console.log("Squad Tiers Setting:", JSON.stringify(data.settings?.squadTiers, null, 2));
  console.log("Squad Tiers Root:", JSON.stringify(data.squadTiers, null, 2));
  process.exit(0);
}
run();
