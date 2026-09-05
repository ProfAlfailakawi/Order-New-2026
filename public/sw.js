/*
 * Hand-written service worker for مطبخ التراث الكويتي.
 *
 * Deliberately conservative to avoid the payment-return white-screen bug that
 * caused vite-plugin-pwa to be disabled:
 *   - /api/* is never touched (network passthrough).
 *   - The payment return/callback (any navigation carrying ?payment=, and the
 *     /track page) is network-only — never served a cached/stale app shell.
 *   - Navigations are network-first with an offline fallback to the app shell.
 *   - Hashed build assets (/assets/*) are cache-first (immutable).
 */

const VERSION = 'v1';
const SHELL_CACHE = `alturath-shell-${VERSION}`;
const ASSET_CACHE = `alturath-assets-${VERSION}`;

const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/logo-optimized.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isPaymentFlow = (url) =>
  url.searchParams.has('payment') || url.pathname === '/track';

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; everything else goes straight to the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only. Let the browser handle cross-origin (fonts, gateway, CDN).
  if (url.origin !== self.location.origin) return;

  // Never intervene on the API or the payment return/callback path.
  if (url.pathname.startsWith('/api') || isPaymentFlow(url)) return;

  // Hashed build assets are immutable: cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: network-first, fall back to the cached app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/')),
        ),
    );
  }
});
