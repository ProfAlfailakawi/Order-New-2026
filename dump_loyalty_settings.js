
import http from 'http';

http.get('http://localhost:3000/api/debug-docs', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json.loyaltySettings, null, 2));
    } catch(e) {
        console.log(data);
    }
  });
});
