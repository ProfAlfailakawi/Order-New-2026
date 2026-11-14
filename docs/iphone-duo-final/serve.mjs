// Local preview for the iPhone Duo audit. Serves the built dist/ (npm run build) on
// http://127.0.0.1:5160 with an SPA fallback.
//   * GET menu reads (/api/customer-menu, products, top-products, regions, settings,
//     recent-fomo) are proxied read-only to the live store and cached in memory.
//   * /api/track-orders answers with two clearly fake demo orders (DEMO-1001/DEMO-1002).
//   * Every other /api call is answered locally (GET -> empty JSON, others -> 503).
//     Nothing is ever written: no order, payment, customer or squad request leaves this machine.
// Usage: node docs/iphone-duo-final/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv[2] || process.env.PORT || 5160);
const DIST = path.resolve(process.cwd(), 'dist');
const LIVE = process.env.DUO_LIVE_ORIGIN || 'https://alturathkw.shop';
const PROXY_GET = ['/api/customer-menu', '/api/products', '/api/top-products', '/api/regions', '/api/settings', '/api/recent-fomo'];
const cache = new Map();

const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
const DEMO_ORDERS = [
  {
    id: 'DEMO-1001', customerName: 'عميل تجريبي', customerPhone: '99999999', status: 'قيد التحضير',
    paymentStatus: 'paid', paymentMethod: 'online', total: 24.5, deliveryFee: 1.5, createdAt: iso(25),
    address: { region: 'السالمية', block: '5', street: '12', house: '7', notes: 'تجربة عرض فقط' },
    items: [
      { id: 'demo-a', name: 'مجبوس دجاج', quantity: 2, price: 6.5 },
      { id: 'demo-b', name: 'هريس', quantity: 1, price: 4.0 },
      { id: 'demo-c', name: 'لقيمات', quantity: 2, price: 3.0 },
    ],
  },
  {
    id: 'DEMO-1002', customerName: 'عميل تجريبي', customerPhone: '99999999', status: 'تم التوصيل',
    paymentStatus: 'paid', paymentMethod: 'online', total: 11.0, deliveryFee: 1.0, createdAt: iso(60 * 50),
    address: { region: 'حولي', block: '2', street: '4', house: '9' },
    items: [{ id: 'demo-d', name: 'مطبق زبيدي', quantity: 1, price: 10.0 }],
  },
];
// A split ("قطية") still collecting money: one of three people has paid.
const DEMO_SPLIT = {
  id: 'DEMO-2001', customerName: 'عميل تجريبي', customerPhone: '99999999', status: 'قيد تجميع القطية',
  paymentStatus: 'pending', total: 30.0, deliveryFee: 1.5, createdAt: iso(10),
  address: { region: 'السالمية', block: '5', street: '12', house: '7' },
  items: [{ id: 'demo-e', name: 'مجبوس لحم', quantity: 3, price: 9.5 }],
  splitPayments: [
    { name: 'سارة', phone: '90000001', amount: 10, status: 'paid' },
    { name: 'خالد', phone: '90000002', amount: 10, status: 'pending' },
  ],
};
// The roulette ("وهق") split: the wheel has not been spun yet.
const DEMO_ROULETTE = {
  ...DEMO_SPLIT, id: 'DEMO-3001', splitType: 'roulette',
  splitParticipants: [
    { name: 'سارة', phone: '90000001', status: 'pending' },
    { name: 'خالد', phone: '90000002', status: 'pending' },
    { name: 'نورة', phone: '90000003', status: 'pending' },
  ],
  splitPayments: [],
};

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  if (p.startsWith('/api/')) {
    if (req.method !== 'GET') return json(res, 503, { error: 'duo-audit: writes are disabled locally' });
    if (p === '/api/track-orders') {
      const id = (url.searchParams.get('order_id') || '').toUpperCase();
      const empty = url.searchParams.get('phone') === '90000000';
      if (empty) return json(res, 200, []);
      return json(res, 200, id ? [...DEMO_ORDERS, DEMO_SPLIT, DEMO_ROULETTE].filter((o) => o.id === id) : DEMO_ORDERS);
    }
    if (PROXY_GET.includes(p)) {
      const key = p + url.search;
      if (!cache.has(key)) {
        try {
          const r = await fetch(LIVE + key, { headers: { accept: 'application/json' } });
          cache.set(key, { code: r.status, body: await r.text() });
        } catch (e) { return json(res, 502, { error: String(e) }); }
      }
      const c = cache.get(key);
      return json(res, c.code, c.body);
    }
    return json(res, 200, {});
  }
  let file = path.join(DIST, decodeURIComponent(p));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, '127.0.0.1', () => console.log(`duo preview on http://127.0.0.1:${PORT}`));
