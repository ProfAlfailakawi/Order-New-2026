
import http from 'http';

// I need an API that returns the whole `data` or at least those keys.
// I'll check /api/debug-loyalty more closely.
// Or I can add a new debug endpoint in server.ts if I have to, but let's check existing ones.

http.get('http://localhost:3000/api/debug-docs', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        console.log("Keys found:", Object.keys(json));
        console.log("loyaltySettings:", json.loyaltySettings);
        console.log("settings:", json.settings);
    } catch(e) {
        console.log("Raw response:", data);
    }
  });
});
