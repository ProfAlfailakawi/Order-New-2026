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
 *   - A navigation answered 500/502/503/504 (or dropped while online) gets
 *     /updating.html instead of Google's English error page.
 */

/* بصمة البناء تُطبع هنا عند البناء (scripts/build-stamp.mjs). بايتات هذا الملف يجب أن
   تتغيّر مع كل إصدار، وإلا لم يرَ المتصفح تحديثاً أصلاً ولم تعلم التبويبات المفتوحة بشيء. */
const VERSION = '__BUILD_ID__';
/* الأصول المبصومة بهاش في اسمها وحدها تُقدَّم من الكاش مباشرة. */
const HASHED = /\/assets\/.+[-.][A-Za-z0-9_]{8,}\.[a-z0-9]+$/i;
const SHELL_CACHE = `alturath-shell-${VERSION}`;
const ASSET_CACHE = `alturath-assets-${VERSION}`;

const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/logo-optimized.png'];

/*
 * «نُحدّث البرنامج» بدل صفحة Google الإنجليزية.
 *
 * أثناء النشر يتبدّل الخادم، فتجيب واجهةُ Google الأمامية بصفحة «Server Error»
 * لا يكتبها خادمُنا. الصفحةُ البديلة (/updating.html) تُحفظ هنا عند التثبيت، وتُقدَّم
 * للتنقّل وحده — لا لـ/api ولا لمسار الدفع ولا لغير GET ولا لجوابٍ ناجح — حين يعود
 * 500/502/503/504 أو ينقطع الطلب والجهاز متصل. لا يُحفظ جوابُ 5xx في أيّ ذاكرة هنا.
 */
const UPDATING_PAGE = '/updating.html';
const isUpdatingStatus = (status) => status === 500 || status === 502 || status === 503 || status === 504;

/* إعادةُ الكتابة إلى index.html تجيب أيّ مسارٍ مفقود بـ200: نحفظ الصفحة بعلامتها وحدها. */
const storeUpdatingPage = async () => {
  const response = await fetch(UPDATING_PAGE, {cache: 'no-store'});
  if (!response.ok) return;
  const body = await response.clone().text();
  if (!body.includes('<meta name="updating-page"')) return;
  await (await caches.open(SHELL_CACHE)).put(UPDATING_PAGE, response);
};

/* مسحتها الاستعادةُ مع كل الذاكرة؟ تُعاد بعد أول تنقّلٍ ناجح، ولا يُنتظر ذلك. */
const refillUpdatingPage = () =>
  caches
    .match(UPDATING_PAGE)
    .then((hit) => (hit ? undefined : storeUpdatingPage()))
    .catch(() => undefined);

const updatingResponse = async () => {
  const page = await caches.match(UPDATING_PAGE).catch(() => undefined);
  if (!page) return null;
  return new Response(await page.text(), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5'},
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => storeUpdatingPage().catch(() => undefined))
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

// Everything on the money path is network-only: the gateway return
// (?payment=...), a resumed checkout (?checkout=payment), order tracking and
// the split-payment route. None of these may ever be answered from a cache.
const isPaymentFlow = (url) =>
  url.searchParams.has('payment') ||
  url.searchParams.has('checkout') ||
  url.pathname === '/track' ||
  url.pathname.startsWith('/track/') ||
  url.pathname.startsWith('/split');

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; everything else goes straight to the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only. Let the browser handle cross-origin (fonts, gateway, CDN).
  if (url.origin !== self.location.origin) return;

  // Never intervene on the API or the payment return/callback path.
  if (url.pathname.startsWith('/api') || isPaymentFlow(url)) return;

  // Hashed build assets are immutable: cache-first — the name changes with the bytes.
  if (HASHED.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            // Only a real asset is kept; a mid-deploy error page must never become "the file".
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  /* Navigations (HTML) always come from the network with cache: "no-store" — a stored
     shell names hashed bundles the next deploy removed. Cache is an offline fallback only. */
  /* A 5xx is the platform swapping servers mid-deploy: the updating page waits for the
     server and reopens this same URL. A dropped request while the device says it is
     online is the same moment; truly offline keeps the cached shell. */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(url.pathname + url.search, {cache: 'no-store', credentials: 'same-origin'})
        .then(async (res) => {
          if (isUpdatingStatus(res.status)) return (await updatingResponse()) || res;
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
            void refillUpdatingPage();
          }
          return res;
        })
        .catch(async () => {
          if (self.navigator?.onLine !== false) {
            const page = await updatingResponse();
            if (page) return page;
          }
          return caches.match(request).then((cached) => cached || caches.match('/'));
        }),
    );
  }
});
