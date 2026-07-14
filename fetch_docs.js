import http from 'http';
setTimeout(() => {
  http.get('http://localhost:3000/api/debug-docs', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data));
  });
}, 1000);
