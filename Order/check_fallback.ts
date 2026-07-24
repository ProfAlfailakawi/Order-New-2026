import fs from 'fs';
import path from 'path';

let localFallbackDB: any = {};
if (fs.existsSync('app_data_fallback.json')) {
  localFallbackDB = JSON.parse(fs.readFileSync('app_data_fallback.json', 'utf8'));
  console.log("Found app_data_fallback.json! Customers:", localFallbackDB.customers?.length, "Orders:", localFallbackDB.orders?.length);
  const match = localFallbackDB.orders?.find(o => JSON.stringify(o).includes('***REDACTED***'));
  console.log("Match in fallback?", !!match, match?.customerName);
} else {
  console.log("No app_data_fallback.json");
}
