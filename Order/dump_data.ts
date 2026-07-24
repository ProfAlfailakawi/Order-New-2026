import { getAppDataRef } from "./server.ts";

async function run() {
  const d = await getAppDataRef();
  const data = d.data() || {};
  console.log("Root keys:", Object.keys(data));
  if (data.settings) {
    console.log("Settings keys:", Object.keys(data.settings));
  }
  // Let's dump the whole thing to a local file
  const fs = await import('fs');
  fs.writeFileSync('dump.json', JSON.stringify(data, null, 2));
  process.exit(0);
}
run();
