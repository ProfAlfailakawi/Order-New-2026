/* iPhone Duo final audit (Playwright WebKit). Read-only: every non-GET request is answered locally.
 *
 *   npm run build
 *   node docs/iphone-duo-final/serve.mjs 5160          # in another terminal
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node docs/iphone-duo-final/duo-final-audit.cjs
 *
 * Env: DUO_URL (default http://127.0.0.1:5160), DUO_OUT (screenshots, default $TMPDIR/duo-final-shots),
 *      DUO_REPORT (default docs/iphone-duo-final/report.json), DUO_ONLY (comma list of screen ids),
 *      DUO_VP (comma list like 669x867,951x585), DUO_SHOTS=all|key|none (default key).
 *
 * Each screen is opened once and then resized through every viewport on the SAME page (no reload),
 * so the matrix is also a resize-survival test. Metrics per screen x viewport:
 *   overflowX   document wider than the window
 *   offscreen   buttons/inputs/headings cut by the left/right window edge
 *   smallTaps   visible controls smaller than 44x44 (listed)
 *   spine       at the inner (book) sizes: text or controls whose box crosses the centre +-16px
 */
const { webkit } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.DUO_URL || 'http://127.0.0.1:5160';
const OUT = process.env.DUO_OUT || path.join(os.tmpdir(), 'duo-final-shots');
const REPORT = process.env.DUO_REPORT || path.join(__dirname, 'report.json');
const SHOTS = process.env.DUO_SHOTS || 'key';
const ENTRY_KEY = 'alturath_customer_entry_seen_v1';
// 13:00 Kuwait (store open) unless a screen asks for the night.
const DAY = new Date('2026-11-14T10:00:00Z');
const NIGHT = new Date('2026-11-14T22:30:00Z');

const POSES = {
  A: ['382x580', '385x571', '320x568'],
  B: ['594x368'],
  C: ['669x867'],
  D: ['951x585'],
  E: ['951x350', '600x350'],
  F: ['669x520', '600x480'],
  G: ['768x1024', '1024x768', '1280x800', '1440x900'],
  H: ['360x640', '390x844', '844x390'],
  S: ['320x350', '320x600', '320x900', '470x350', '470x600', '470x900', '620x350', '620x600', '620x900'],
};
const KEY_SHOTS = new Set(['669x867', '951x585', '951x350', '600x350', '594x368', '382x580']);
let VIEWPORTS = Object.values(POSES).flat();
if (process.env.DUO_VP) VIEWPORTS = process.env.DUO_VP.split(',');
const isBook = (w, h) => (w >= 640 && w <= 720 && h >= 760) || (w >= 860 && w <= 1000 && h >= 520 && h <= 700);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jsClick = (page, sel, text) =>
  page.evaluate(([s, t]) => {
    const els = [...document.querySelectorAll(s)].filter((e) => !t || e.textContent.includes(t));
    const el = els[0];
    if (!el) throw new Error('missing ' + s + (t ? ' ' + t : ''));
    el.scrollIntoView({ block: 'center' });
    el.click();
  }, [sel, text || '']);

async function openMenu(page, { welcome = false } = {}) {
  if (!welcome) await page.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch (e) {} }, ENTRY_KEY);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }).catch(() => {});
  await sleep(1500);
}
async function openProduct(page) {
  await openMenu(page);
  await jsClick(page, '.dna-cat-tile');
  await sleep(600);
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('main h3')].filter((e) => e.closest('.grid'))[0];
    h.click();
  });
  await page.waitForSelector('.product-detail-layer', { timeout: 8000 });
  await sleep(700);
}
async function addToCart(page) {
  await openProduct(page);
  await jsClick(page, '.product-add-cta');
  await sleep(1200);
  await page.evaluate(() => document.querySelector('[aria-label="تفاصيل المنتج"] [aria-label="إغلاق"]')?.click());
  await sleep(500);
}
async function openCheckout(page) {
  await addToCart(page);
  await jsClick(page, '.al-cart-summary');
  await page.waitForSelector('.checkout-wow-panel', { timeout: 8000 });
  await sleep(900);
}
async function openTrackResults(page, phone = '99999999') {
  await page.goto(BASE + '/track', { waitUntil: 'networkidle' }).catch(() => {});
  await sleep(900);
  await page.fill('section.order-detail-card form input[dir="ltr"]', phone);
  await page.evaluate(() => document.querySelector('section.order-detail-card form').requestSubmit());
  await sleep(1800);
}

// Every screen reachable without credentials, from the router and the dialogs in the code.
const SCREENS = [
  { id: 'welcome', name: 'الترحيب (أول زيارة)', setup: (p) => openMenu(p, { welcome: true }) },
  { id: 'menu', name: 'المنيو (أعلى الصفحة)', setup: (p) => openMenu(p) },
  { id: 'menu-dishes', name: 'المنيو: فئة وأطباق', setup: async (p) => { await openMenu(p); await jsClick(p, '.dna-cat-tile'); await sleep(800); } },
  { id: 'menu-search', name: 'المنيو: بحث بالمزاج', setup: async (p) => { await openMenu(p); await p.fill('.orser-search-input', 'مجبوس'); await sleep(1500); } },
  { id: 'menu-loading', name: 'المنيو: تحميل', hold: ['/api/customer-menu', '/api/products'], setup: async (p) => { await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await sleep(1500); } },
  { id: 'menu-error', name: 'المنيو: فشل التحميل', fail: ['/api/customer-menu', '/api/products', '/api/top-products'], setup: (p) => openMenu(p) },
  { id: 'legal', name: 'بيانات السجل التجاري', setup: async (p) => { await openMenu(p); await jsClick(p, '[aria-label="بيانات السجل التجاري"]'); await sleep(700); } },
  { id: 'welcome-replay', name: 'نافذة «كيف تطلب» (زر ؟)', setup: async (p) => { await openMenu(p); await jsClick(p, '.order-welcome-replay'); await sleep(900); } },
  { id: 'diwaniya', name: 'الديوانية (نافذة)', setup: async (p) => { await openMenu(p); await jsClick(p, '[role="region"][aria-label="الديوانية"] button, [role="region"][aria-label="الديوانية"] [class*="cursor-pointer"]'); await sleep(1200); } },
  { id: 'smart-pick', name: 'اقتراح اليوم (نافذة تظهر بعد 9 ثوانٍ)', smartPick: true, setup: async (p) => { await openMenu(p); await p.waitForSelector('[aria-label="عرض خاص"]', { timeout: 20000 }); await sleep(800); } },
  { id: 'product', name: 'ورقة المنتج', setup: openProduct },
  { id: 'product-photo', name: 'معاينة صورة المنتج', setup: async (p) => { await openProduct(p); await jsClick(p, '.product-detail-layer .food-photo'); await sleep(700); } },
  { id: 'cart-bar', name: 'المنيو مع شريط السلة', setup: addToCart },
  { id: 'checkout-cart', name: 'الدفع: السلة', setup: openCheckout },
  { id: 'checkout-address', name: 'الدفع: العنوان', setup: async (p) => { await openCheckout(p); await jsClick(p, '.checkout-wow-footer button', 'كمل'); await sleep(900); } },
  { id: 'checkout-closed', name: 'الدفع: المطعم مغلق وأوقات العمل', night: true, setup: async (p) => { await openCheckout(p); await p.evaluate(() => [...document.querySelectorAll('.checkout-wow-panel button')].find((b) => b.textContent.includes('الجدول'))?.click()); await sleep(600); } },
  { id: 'track', name: 'التتبع: البحث', setup: async (p) => { await p.goto(BASE + '/track', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(900); } },
  { id: 'track-results', name: 'التتبع: النتائج', setup: (p) => openTrackResults(p) },
  { id: 'track-empty', name: 'التتبع: لا توجد طلبات', setup: (p) => openTrackResults(p, '90000000') },
  { id: 'track-profile', name: 'التتبع: الملف (العضوية)', setup: async (p) => { await openTrackResults(p); await jsClick(p, '.track-signature main .space-y-4 > div.rounded-\\[34px\\] > button'); await sleep(700); await jsClick(p, '.track-signature main button', 'العضوية'); await sleep(700); } },
  { id: 'track-addresses', name: 'التتبع: الملف (عناويني)', setup: async (p) => { await openTrackResults(p); await jsClick(p, '.track-signature main .space-y-4 > div.rounded-\\[34px\\] > button'); await sleep(700); await jsClick(p, '.track-signature main button', 'عناويني'); await sleep(700); } },
  { id: 'track-detail', name: 'التتبع: تفاصيل الطلب (الحالة)', setup: async (p) => { await openTrackResults(p); await jsClick(p, '.track-signature main .space-y-4 > div.bg-white'); await sleep(1000); } },
  { id: 'track-invoice', name: 'التتبع: تفاصيل الطلب (الفاتورة)', setup: async (p) => { await openTrackResults(p); await jsClick(p, '.track-signature main .space-y-4 > div.bg-white'); await sleep(800); await jsClick(p, '[aria-label="تفاصيل الطلب"] button', 'الفاتورة'); await sleep(700); } },
  // Return from the payment page. The note clears itself after 3.5s, so it is measured at two sizes only.
  { id: 'track-paid', name: 'التتبع: عائد من الدفع (نجح)', transient: ['951x585', '669x867'], setup: async (p) => { await p.goto(BASE + '/track?payment=success&order_id=DEMO-1001', { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(900); } },
  { id: 'track-payfail', name: 'التتبع: عائد من الدفع (فشل)', transient: ['951x585', '669x867'], setup: async (p) => { await p.goto(BASE + '/track?payment=failed&order_id=DEMO-1001', { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(900); } },
  { id: 'split-overview', name: 'القطية: نظرة عامة', setup: async (p) => { await p.goto(BASE + '/split/DEMO-2001', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(1500); } },
  { id: 'split-payment', name: 'القطية: قطيتك (الدفع)', setup: async (p) => { await p.goto(BASE + '/split/DEMO-2001?tab=payment', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(1500); } },
  { id: 'split-people', name: 'القطية: المشاركون', setup: async (p) => { await p.goto(BASE + '/split/DEMO-2001', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(1200); await jsClick(p, '.qatya-tabs button', 'المشاركون'); await sleep(700); } },
  { id: 'split-failed', name: 'القطية: فشل الدفع (عائد من البنك)', setup: async (p) => { await p.goto(BASE + '/split/DEMO-2001?payment=failed', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(1500); } },
  { id: 'split-roulette', name: 'القطية: الوهق (الروليت)', setup: async (p) => { await p.goto(BASE + '/split/DEMO-3001', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(1800); } },
  { id: 'split-paid', name: 'القطية: اكتملت', setup: async (p) => { await p.goto(BASE + '/split/DEMO-1001', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(1500); } },
  { id: 'split-error', name: 'القطية: رابط خاطئ', setup: async (p) => { await p.goto(BASE + '/split/NOPE-0', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(1500); } },
  { id: 'not-found', name: '404', setup: async (p) => { await p.goto(BASE + '/no-such-page', { waitUntil: 'networkidle' }).catch(() => {}); await sleep(900); } },
  { id: 'route-loading', name: 'تحميل الصفحة (Suspense)', holdAsset: /OrderPage-.*\.js$/, setup: async (p) => { await p.goto(BASE + '/track', { waitUntil: 'domcontentloaded' }); await sleep(1200); } },
  { id: 'offline', name: 'بلا اتصال', setup: async (p, ctx) => { await openMenu(p); await ctx.setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline'))); await sleep(900); } },
];

async function measure(page, w, h) {
  return page.evaluate(([w, h, book]) => {
    const vis = (el) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
      // WebKit still reports a box for the body of a closed <details>; it is not painted.
      if (el.closest('details:not([open])') && !el.closest('summary')) return false;
      for (let a = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (Number(s.opacity) === 0 || s.visibility === 'hidden') return false;
        if (a.getAttribute && a.getAttribute('aria-hidden') === 'true') return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
    };
    const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth - doc.clientWidth;
    const interactive = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab]')].filter(vis);
    const important = [...interactive, ...document.querySelectorAll('h1, h2, h3')].filter(vis);
    const offscreen = important.filter((el) => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > w + 1; }).map(label);
    const smallTaps = interactive
      .filter((el) => { const r = el.getBoundingClientRect(); return (r.width < 44 || r.height < 44) && !el.closest('[aria-hidden=true]') && getComputedStyle(el).pointerEvents !== 'none'; })
      .filter((el) => !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'))
      .map((el) => { const r = el.getBoundingClientRect(); return `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`; });
    let spine = [];
    if (book) {
      const c = w / 2, lo = c - 16, hi = c + 16;
      const textEls = [...document.querySelectorAll('body *')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      spine = [...new Set([...interactive, ...textEls])]
        .filter(vis)
        .filter((el) => { const cs = getComputedStyle(el); return cs.pointerEvents !== 'none' || el.tagName !== 'DIV'; })
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!(r.left < hi && r.right > lo)) return false;
          if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.getAttribute('role')) return true;
          // text: measure the text itself, not a wide block that merely contains it
          const range = document.createRange(); range.selectNodeContents(el);
          return [...range.getClientRects()].some((q) => q.width > 0 && q.left < hi && q.right > lo && q.bottom > 0 && q.top < h);
        })
        .map((el) => `${el.tagName.toLowerCase()} "${label(el)}"`);
    }
    return { overflowX, offscreen, smallTaps, spine, url: location.pathname + location.search };
  }, [w, h, isBook(w, h)]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.env.DUO_ONLY ? process.env.DUO_ONLY.split(',') : null;
  const browser = await webkit.launch();
  const report = { generatedAt: new Date().toISOString(), base: BASE, viewports: VIEWPORTS, poses: POSES, screens: {} };
  for (const s of SCREENS) {
    if (only && !only.includes(s.id)) continue;
    const [w0, h0] = (VIEWPORTS.includes('951x585') ? '951x585' : VIEWPORTS[0]).split('x').map(Number);
    const ctx = await browser.newContext({
      viewport: { width: w0, height: h0 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
      reducedMotion: process.env.DUO_MOTION === 'full' ? 'no-preference' : 'reduce',
      colorScheme: process.env.DUO_SCHEME || 'light', locale: 'ar-KW',
    });
    await ctx.clock.install({ time: s.night ? NIGHT : DAY });
    // Never write anything: any non-GET API call is answered here and never leaves the browser.
    await ctx.route('**/api/**', async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      if (req.method() !== 'GET') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"audit: writes disabled"}' });
      if (s.fail && s.fail.includes(u.pathname)) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"audit"}' });
      if (s.hold && s.hold.includes(u.pathname)) return; // never answered: loading state
      return route.continue();
    });
    if (s.holdAsset) await ctx.route(s.holdAsset, () => {});
    await ctx.route(/firestore|googleapis|gstatic|firebaseio|google-analytics|googletagmanager/, (r) => r.abort());
    // The timed "pick of the day" popup would otherwise land on top of whichever screen is open.
    if (!s.smartPick) await ctx.addInitScript(() => { try { sessionStorage.setItem('alturath_smart_promo_seen_session_v2', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    const entry = { name: s.name, results: {} };
    try {
      await s.setup(page, ctx);
    } catch (e) {
      entry.setupError = String(e.message || e).split('\n')[0].slice(0, 200);
    }
    for (const vp of s.transient || VIEWPORTS) {
      const [w, h] = vp.split('x').map(Number);
      await page.setViewportSize({ width: w, height: h });
      await sleep(s.transient ? 250 : 450);
      let m;
      try { m = await measure(page, w, h); } catch (e) { m = { error: String(e).slice(0, 160) }; }
      if (SHOTS === 'all' || s.transient || (SHOTS === 'key' && KEY_SHOTS.has(vp))) {
        await page.screenshot({ path: path.join(OUT, `${s.id}-${vp}.jpg`), type: 'jpeg', quality: 62, timeout: 8000, caret: 'initial' }).catch((e) => { entry.shotErrors = (entry.shotErrors || 0) + 1; });
      }
      entry.results[vp] = m;
    }
    report.screens[s.id] = entry;
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 1)); // partial results survive a crash
    const bad = Object.entries(entry.results).filter(([, m]) => m.overflowX > 0 || (m.offscreen || []).length || (m.spine || []).length);
    console.log(`${s.id.padEnd(17)} ${entry.setupError ? 'SETUP ' + entry.setupError.slice(0, 80) : 'ok'}  issues@${bad.map(([v, m]) => `${v}[x${m.overflowX}/o${(m.offscreen || []).length}/s${(m.spine || []).length}]`).join(' ')}`);
    await ctx.close();
  }
  await browser.close();
  const summary = { overflow: 0, offscreen: 0, spine: 0, smallTaps: 0 };
  for (const e of Object.values(report.screens)) for (const m of Object.values(e.results)) {
    if (m.overflowX > 0) summary.overflow++;
    summary.offscreen += (m.offscreen || []).length;
    summary.spine += (m.spine || []).length;
    summary.smallTaps += (m.smallTaps || []).length;
  }
  report.summary = summary;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
  console.log('summary', JSON.stringify(summary), '->', REPORT, 'shots ->', OUT);
}

module.exports = { SCREENS, measure, isBook, BASE, DAY, NIGHT };
if (require.main === module) main();
