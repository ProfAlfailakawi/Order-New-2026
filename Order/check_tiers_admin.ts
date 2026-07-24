import { getAppDataRef } from "./server.ts";

async function run() {
  const d = await getAppDataRef();
  const data = d.data() || {};
  console.log("Keys in settings:", data.settings ? Object.keys(data.settings) : "No settings");
  console.log("Keys in root:", Object.keys(data));
  console.log("Loyalty Tiers:", JSON.stringify(data.loyaltyTiers, null, 2));
  console.log("Squad Tiers:", JSON.stringify(data.squadTiers, null, 2));
  process.exit(0);
}
run();
