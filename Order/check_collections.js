
import http from 'http';

http.get('http://localhost:3000/api/debug-collections', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        console.log("Documents in appData:");
        json.forEach(d => console.log(`- ${d.id}`));
    } catch(e) {
        console.log(data);
    }
  });
});
