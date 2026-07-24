
import http from 'http';

http.get('http://localhost:3000/api/debug-docs', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        for (const key in json) {
            console.log(`Key: ${key}, Value Type: ${typeof json[key]}, Sample: ${JSON.stringify(json[key]).substring(0, 100)}`);
        }
    } catch(e) {
        console.log(data);
    }
  });
});
