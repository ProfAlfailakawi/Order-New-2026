import http from 'http';
setTimeout(() => {
  http.get('http://localhost:3000/api/debug-squads', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data));
  });
}, 500);
