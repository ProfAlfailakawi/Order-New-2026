
import http from 'http';

http.get('http://localhost:3000/api/settings', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Keys:", Object.keys(json));
    if (json.loyaltyTiers) console.log("loyaltyTiers:", json.loyaltyTiers);
    if (json.squadTiers) console.log("squadTiers:", json.squadTiers);
  });
});
