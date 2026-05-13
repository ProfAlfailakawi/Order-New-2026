const fetch = require('node-fetch');
fetch('http://localhost:3000/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerName: "ام ابراهيم",
    customerPhone: "65111605",
    address: "\"غير محدد\"",
    items: [{price: 5, quantity: 1, name: "مموش"}],
    deliveryFee: 2,
    total: 7,
  })
}).then(r => r.text()).then(console.log);
