/* iPhone Duo final: pose I (live resize on one page) and pose J (accessibility stress).
 * Same server and env as duo-final-audit.cjs:
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node docs/iphone-duo-final/duo-final-stress.cjs
 * Writes docs/iphone-duo-final/stress.json (or DUO_STRESS_REPORT).
 */
const { webkit } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const A = require('./duo-final-audit.cjs');

const OUT = process.env.DUO_OUT || path.join(os.tmpdir(), 'duo-final-shots');
const REPORT = process.env.DUO_STRESS_REPORT || path.join(__dirname, 'stress.json');
const LIVE = ['951x585', '669x867', '470x700', '382x580', '594x368', '951x350', '951x585'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const screen = (id) => A.SCREENS.find((s) => s.id === id);

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 951, height: 585 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    reducedMotion: opts.motion || 'reduce', colorScheme: opts.scheme || 'light', locale: 'ar-KW',
  });
  await ctx.clock.install({ time: A.DAY });
  await ctx.route('**/api/**', (r) => (r.request().method() !== 'GET' ? r.fulfill({ status: 503, body: '{}' }) : r.continue()));
  await ctx.route(/firestore|googleapis|gstatic|firebaseio/, (r) => r.abort());
  await ctx.addInitScript(() => { try { sessionStorage.setItem('alturath_smart_promo_seen_session_v2', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  let navigations = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations++; });
  return { ctx, page, navs: () => navigations };
}

// I: one page, no reload, state checked after every step.
const LIVE_CASES = [
  {
    id: 'track', setup: async (p) => {
      await screen('track-results').setup(p);
      await p.fill('section.order-detail-card form .order-id-track-input', 'DEMO-1001');
      await p.evaluate(() => window.scrollTo(0, 300));
    },
    probe: (p) => p.evaluate(() => ({
      phone: document.querySelector('section.order-detail-card form input[dir="ltr"]')?.value,
      orderId: document.querySelector('.order-id-track-input')?.value,
      results: document.querySelectorAll('.track-signature main .space-y-4 > div.bg-white').length,
    })),
    // The order-number field filters the list as you type, so 1 or 2 cards are both correct.
    expect: (s) => s.phone === '99999999' && s.orderId === 'DEMO-1001' && s.results >= 1,
  },
  {
    id: 'product-sheet', setup: async (p) => {
      await screen('product').setup(p);
      await p.fill('.product-detail-layer textarea', 'بدون بصل لو سمحتوا');
      await p.evaluate(() => document.querySelector('[aria-label="زيّد الكمية"], [aria-label="زيادة الكمية"]')?.click());
    },
    probe: (p) => p.evaluate(() => ({
      open: !!document.querySelector('.product-detail-layer'),
      notes: document.querySelector('.product-detail-layer textarea')?.value,
      qty: document.querySelector('.product-sheet-footer span.text-center')?.textContent?.trim(),
    })),
    expect: (s) => s.open && s.notes === 'بدون بصل لو سمحتوا' && s.qty === '2',
  },
  {
    id: 'checkout-address', setup: async (p) => {
      await screen('checkout-address').setup(p);
      await p.fill('.checkout-wow-panel input[type="tel"], .checkout-wow-panel input[inputmode="numeric"]', '99999999').catch(() => {});
    },
    probe: (p) => p.evaluate(() => ({
      open: !!document.querySelector('.checkout-wow-panel'),
      step: document.querySelector('.checkout-wow-header h2')?.textContent?.trim(),
      phone: document.querySelector('.checkout-wow-panel input[type="tel"], .checkout-wow-panel input[inputmode="numeric"]')?.value,
    })),
    expect: (s) => s.open && s.step === 'العنوان' && s.phone === '99999999',
  },
  {
    id: 'menu-scroll', setup: async (p) => {
      await screen('menu-dishes').setup(p);
      await p.fill('.orser-search-input', 'هريس');
      await sleep(600);
    },
    probe: (p) => p.evaluate(() => ({ query: document.querySelector('.orser-search-input')?.value })),
    expect: (s) => s.query === 'هريس',
  },
];

// J: stress on the screens that matter most, at the book, folded and laptop sizes.
const STRESS_SCREENS = ['menu-dishes', 'product', 'checkout-address', 'track-results', 'split-payment', 'not-found'];
const STRESS_VP = ['669x867', '951x585', '382x580', '951x350'];
const STRESS_MODES = [
  { id: 'text200', css: 'html{font-size:200% !important}' },
  { id: 'dark', scheme: 'dark' },
  { id: 'motion', motion: 'no-preference' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch();
  const report = { generatedAt: new Date().toISOString(), live: {}, stress: {}, keyboard: {} };

  for (const c of LIVE_CASES) {
    const { ctx, page, navs } = await newPage(browser);
    const steps = [];
    try {
      await c.setup(page);
      const startNavs = navs();
      for (const vp of LIVE) {
        const [w, h] = vp.split('x').map(Number);
        await page.setViewportSize({ width: w, height: h });
        await sleep(500);
        const state = await c.probe(page);
        const m = await A.measure(page, w, h);
        steps.push({ vp, ok: c.expect(state), state, overflowX: m.overflowX, spine: m.spine.length, reloads: navs() - startNavs });
      }
      await page.screenshot({ path: path.join(OUT, `I-${c.id}-end-951x585.jpg`), type: 'jpeg', quality: 62, timeout: 8000 }).catch(() => {});
    } catch (e) {
      steps.push({ error: String(e.message || e).split('\n')[0].slice(0, 160) });
    }
    report.live[c.id] = { pass: steps.length === LIVE.length && steps.every((s) => s.ok && s.overflowX <= 0 && s.reloads === 0 && s.spine === 0), steps };
    console.log('I', c.id, report.live[c.id].pass ? 'PASS' : 'FAIL', JSON.stringify(steps.map((s) => s.ok ?? s.error)));
    await ctx.close();
  }

  for (const mode of STRESS_MODES) {
    for (const id of STRESS_SCREENS) {
      const { ctx, page } = await newPage(browser, mode);
      const res = {};
      try {
        await screen(id).setup(page);
        if (mode.css) await page.addStyleTag({ content: mode.css });
        for (const vp of STRESS_VP) {
          const [w, h] = vp.split('x').map(Number);
          await page.setViewportSize({ width: w, height: h });
          await sleep(450);
          const m = await A.measure(page, w, h);
          res[vp] = { overflowX: m.overflowX, offscreen: m.offscreen, spine: m.spine };
          if (vp === '669x867' || vp === '951x585') {
            await page.screenshot({ path: path.join(OUT, `J-${mode.id}-${id}-${vp}.jpg`), type: 'jpeg', quality: 60, timeout: 8000 }).catch(() => {});
          }
        }
      } catch (e) { res.error = String(e.message || e).split('\n')[0].slice(0, 160); }
      report.stress[`${mode.id}:${id}`] = res;
      const bad = Object.entries(res).filter(([k, m]) => k !== 'error' && (m.overflowX > 0 || m.offscreen.length || m.spine.length));
      console.log('J', mode.id, id, res.error ? 'ERR ' + res.error : bad.length ? 'ISSUES ' + bad.map(([v, m]) => `${v}[x${m.overflowX}/o${m.offscreen.length}/s${m.spine.length}]`).join(' ') : 'ok');
      await ctx.close();
    }
  }

  // Keyboard: a focused field must stay visible when the window shrinks to ~350px high.
  for (const [id, sel] of [['track', 'section.order-detail-card form input[dir="ltr"]'], ['checkout-address', '.checkout-wow-panel input[type="tel"], .checkout-wow-panel input[inputmode="numeric"]'], ['product', '.product-detail-layer textarea']]) {
    const { ctx, page } = await newPage(browser);
    const res = {};
    try {
      await screen(id).setup(page);
      for (const vp of ['951x585', '669x867', '382x580']) {
        const [w, h] = vp.split('x').map(Number);
        await page.setViewportSize({ width: w, height: h });
        await sleep(300);
        await page.focus(sel);
        await page.setViewportSize({ width: w, height: 350 });
        await sleep(500);
        await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'nearest' }), sel);
        await sleep(200);
        res[vp] = await page.evaluate((s) => {
          const el = document.querySelector(s);
          const r = el.getBoundingClientRect();
          return { focused: document.activeElement === el, top: Math.round(r.top), bottom: Math.round(r.bottom), visible: r.top >= 0 && r.bottom <= innerHeight };
        }, sel);
      }
    } catch (e) { res.error = String(e.message || e).split('\n')[0].slice(0, 160); }
    report.keyboard[id] = res;
    console.log('J keyboard', id, JSON.stringify(res));
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
  console.log('->', REPORT);
})();
