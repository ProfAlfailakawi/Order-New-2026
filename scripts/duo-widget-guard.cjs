/* Duo widget-corner guard (Playwright WebKit). Presentation only, read-only (writes are answered locally).
 *
 * The reserved corner is the physical top-right rectangle of the window:
 *     x >= innerWidth - W      y <= H        W = 96px, H = clamp(64px, 31vh, 270px)
 * The guard loads every screen reachable without credentials (it reuses SCREENS from
 * docs/iphone-duo-final/duo-final-audit.cjs), resizes it through the Duo sizes and fails when any
 * IMPORTANT element crosses the corner: visible text (measured by its text rects), a/button/input/select/
 * textarea/[role=tab]/[role=button], img and svg that are not decorative.
 * Exceptions (recorded in the report, never silent):
 *   - data-duo-bleed anywhere above the element, or an img/svg covering more than 35% of the window (background);
 *   - decorative img/svg (alt="" or aria-hidden);
 *   - an element whose centre point inside the corner is covered by another layer (occluded: e.g. the page
 *     behind a full-screen dialog).
 * It also fails when the corner is NOT active at a Duo size (the CSS variable --duo-widget-w must be > 0).
 *
 *   npm run build && npm run test:duo-widget
 *
 * Needs Playwright (not a dependency of the repo): NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
 * Env: DUO_URL (use a server already running), DUO_PASSES (comma list of A,B,C,D), DUO_ONLY (screen ids), DUO_CTX (safari,app: default both), passes A..D and H (tall, app only),
 *      DUO_GUARD_BASE=1 (measure only: do not require the corner to be active; used for the "before" numbers),
 *      DUO_GUARD_REPORT (default docs/iphone-duo-widget-corner/guard-report.json), DUO_CONC (default 2).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { webkit } = require('playwright');
// The screen scripts read their address from DUO_URL: point them at the server this guard starts.
const EXTERNAL_SERVER = !!process.env.DUO_URL;
process.env.DUO_URL = process.env.DUO_URL || `http://127.0.0.1:${Number(process.env.DUO_GUARD_PORT || 5171)}`;
const { SCREENS, DAY, NIGHT } = require('../docs/iphone-duo-final/duo-final-audit.cjs');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.DUO_GUARD_PORT || 5171);
const BASE = process.env.DUO_URL || `http://127.0.0.1:${PORT}`;
const REPORT = process.env.DUO_GUARD_REPORT || path.join(ROOT, 'docs/iphone-duo-widget-corner/guard-report.json');
const BASE_MODE = process.env.DUO_GUARD_BASE === '1';
const CONC = Number(process.env.DUO_CONC || 2);
const ENTRY_KEY = 'alturath_customer_entry_seen_v1';

const NATIVE = ['382x580', '457x678', '457x760', '470x780', '594x368', '669x867', '951x585'];
const swap = (v) => v.split('x').reverse().join('x');
const PASSES = {
  A: { label: 'فاتح، الأحجام الأصلية', sizes: NATIVE, scheme: 'light', font: false },
  B: { label: 'فاتح، الأحجام مقلوبة (طولي/عرضي)', sizes: NATIVE.map(swap).filter((v) => v !== '368x594'), scheme: 'light', font: false },
  C: { label: 'داكن، الأحجام الأصلية', sizes: NATIVE, scheme: 'dark', font: false },
  D: { label: 'نص 200%، الأحجام الأصلية', sizes: NATIVE, scheme: 'light', font: true },
};
// Full-height windows of the installed app (no browser toolbars): only in the APP context.
PASSES.H = { label: 'فاتح، ارتفاعات كاملة للتطبيق', sizes: ['382x780', '470x900', '457x900', '669x1000', '951x700'], scheme: 'light', font: false, appOnly: true };
// Sizes protected by the earlier rounds (portrait book up to 720, landscape book 721-1000 x 520-960): must stay active.
PASSES.E = { label: 'فاتح، أحجام الكتاب المحميّة سابقًا', sizes: ['720x900', '951x669', '951x800'], scheme: 'light', font: false };
// WKWebView of the installed app, emulated: no "Safari/" token, no navigator.standalone, Capacitor present, 2x.
const APP_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Evaluated in the page. Returns { active, hits, bleed, occluded, zone }.
function measureInPage([w, h]) {
  const ZW = 96;
  const zx = w - ZW;
  const zy = Math.min(270, Math.max(64, 0.31 * h));
  const rootCs = getComputedStyle(document.documentElement);
  // Resolve the tokens through a real box: an unregistered custom property such as clamp(64px, 31vh, 270px) is not resolved by getPropertyValue.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;right:0;visibility:hidden;pointer-events:none;width:var(--duo-widget-w);height:var(--duo-widget-h)';
  document.body.appendChild(probe);
  const pr = probe.getBoundingClientRect();
  probe.remove();
  const active = pr.width;
  const cssH = pr.height;
  const visible = (el) => {
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      if (a.getAttribute('aria-hidden') === 'true') return false;
      if (a.matches('details:not([open])') && el !== a && !el.closest('summary')) return false;
    }
    return true;
  };
  const bleedAnc = (el) => !!el.closest('[data-duo-bleed]');
  const label = (el) => ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('alt'))) || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 36);
  const sel = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const hits = [], bleed = [], occluded = [];
  const seen = new Set();
  const cross = (r) => r.width > 0 && r.height > 0 && r.right > zx + 0.5 && r.left < w && r.top < zy - 0.5 && r.bottom > 0;
  const note = (el, r, kind) => {
    const k = kind + sel(el) + Math.round(r.left) + ',' + Math.round(r.top);
    if (seen.has(k)) return;
    seen.add(k);
    const cx = Math.min(w - 1, Math.max(zx, r.left) + 1), cy = Math.max(1, r.top) + 1;
    const ix = Math.max(zx, r.left), iy = Math.max(0, r.top);
    const px = (ix + Math.min(w, r.right)) / 2, py = (iy + Math.min(zy, r.bottom)) / 2;
    const top = document.elementFromPoint(Math.min(w - 1, px), Math.min(h - 1, Math.max(0, py)));
    void cx; void cy;
    const chain = []; for (let a = el.parentElement, i = 0; a && i < 5; a = a.parentElement, i++) chain.push(sel(a).slice(0, 48));
    const rec = { kind, chain, el: sel(el), text: label(el), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
    if (top && !(el.contains(top) || top.contains(el))) { occluded.push(rec); return; }
    hits.push(rec);
  };
  // 1) text, measured by the text itself
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !visible(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = [...range.getClientRects()].find((q) => cross(q) && q.width > 1);
    if (!r) continue;
    if (bleedAnc(el)) { bleed.push({ kind: 'text', el: sel(el), text: label(el), why: 'data-duo-bleed' }); continue; }
    // clipped away by an overflow-hidden ancestor: not painted
    note(el, r, 'text');
  }
  // 2) controls
  const controls = document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=tab], [role=button]');
  for (const el of controls) {
    if (!visible(el) || getComputedStyle(el).pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (!cross(r)) continue;
    if (bleedAnc(el)) { bleed.push({ kind: 'control', el: sel(el), text: label(el), why: 'data-duo-bleed' }); continue; }
    note(el, r, 'control');
  }
  // 2b) clickable things that are not semantic controls (div with cursor:pointer): small ones only (icons, chips, avatars)
  for (const el of document.body.querySelectorAll('*')) {
    if (el.matches('a[href], button, input, select, textarea, [role=tab], [role=button]') || (el instanceof SVGElement && el.tagName !== 'svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.cursor !== 'pointer' || cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (!cross(r) || r.width > 160 || r.height > 160) continue; // wider wrappers are backgrounds: their content is checked on its own
    if (bleedAnc(el)) { bleed.push({ kind: 'clickable', el: sel(el), text: label(el), why: 'data-duo-bleed' }); continue; }
    // visible() rejects aria-hidden ancestors; a clickable div is checked by its own style chain only
    let shown = true;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) { shown = false; break; } }
    if (shown) note(el, r, 'clickable');
  }
  // 3) images and svg
  for (const el of document.querySelectorAll('img, svg')) {
    if (!visible(el)) continue;
    if (el.tagName === 'IMG' && el.getAttribute('alt') === '') continue;
    const r = el.getBoundingClientRect();
    if (!cross(r)) continue;
    if (el.closest('button, a[href], [role=button], [role=tab]')) continue; // counted through the control
    if (bleedAnc(el)) { bleed.push({ kind: 'media', el: sel(el), text: label(el), why: 'data-duo-bleed' }); continue; }
    if (r.width * r.height > 0.35 * w * h) { bleed.push({ kind: 'media', el: sel(el), text: label(el), why: 'covers >35% of the window (background)' }); continue; }
    note(el, r, 'media');
  }
  return { active, cssH, zone: [Math.round(zx), 0, w, Math.round(zy)], hits, bleed, occluded };
}

async function runScreenOnce(browser, s, pass, onlyVps, app) {
  const [w0, h0] = pass.sizes[0].split('x').map(Number);
  const ctx = await browser.newContext({
    viewport: { width: w0, height: h0 }, deviceScaleFactor: app ? 2 : 1, isMobile: true, hasTouch: true,
    ...(app ? { userAgent: APP_UA } : {}),
    reducedMotion: 'reduce', colorScheme: pass.scheme, locale: 'ar-KW',
  });
  await ctx.clock.setFixedTime(s.night ? NIGHT : DAY); // Date only: timers keep running (a frozen clock leaves animated elements at opacity 0)
  await ctx.route('**/api/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() !== 'GET') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"guard: writes disabled"}' });
    if (s.fail && s.fail.includes(u.pathname)) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"guard"}' });
    if (s.hold && s.hold.includes(u.pathname)) return;
    return route.continue();
  });
  if (s.holdAsset) await ctx.route(s.holdAsset, () => {});
  await ctx.route(/firestore|googleapis|gstatic|firebaseio|google-analytics|googletagmanager/, (r) => r.abort());
  if (!s.smartPick) await ctx.addInitScript(() => { try { sessionStorage.setItem('alturath_smart_promo_seen_session_v2', '1'); } catch (e) {} });
  if (pass.font) await ctx.addInitScript(() => {
    const add = () => { const st = document.createElement('style'); st.textContent = 'html{font-size:200%}'; (document.head || document.documentElement).appendChild(st); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  });
  if (app) await ctx.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', platform: 'ios' };
    try { Object.defineProperty(navigator, 'standalone', { get: () => undefined, configurable: true }); } catch (e) { /* already undefined */ }
  });
  const page = await ctx.newPage();
  const out = { id: s.id, name: s.name, setupError: null, results: {} };
  try { await s.setup(page, ctx); } catch (e) { out.setupError = String(e.message || e).split('\n')[0].slice(0, 160); }
  for (const vp of s.transient || pass.sizes) {
    if (onlyVps && !onlyVps.includes(vp)) continue;
    const [w, h] = vp.split('x').map(Number);
    await page.setViewportSize({ width: w, height: h });
    // Content that is scrolled up under the corner is the system overlay doing its job (like the iOS status bar): measure the top of the page.
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('main, [class*=overflow-y-auto], [class*=overflow-auto]').forEach((e) => { e.scrollTop = 0; }); }).catch(() => {});
    await sleep(s.transient ? 250 : 400);
    try { out.results[vp] = await page.evaluate(measureInPage, [w, h]); } catch (e) { out.results[vp] = { error: String(e).slice(0, 160) }; }
  }
  await ctx.close();
  return out;
}

// A setup that fails on a slow, shared machine (missing selector, timeout) is retried with a fresh context.
async function runScreen(browser, s, pass, onlyVps, app) {
  let out;
  for (let i = 0; i < 3; i++) {
    out = await runScreenOnce(browser, s, pass, onlyVps, app);
    if (!out.setupError || /closed|crash/i.test(out.setupError)) return out;
  }
  return out;
}

async function pool(items, n, fn) {
  const res = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k]); }
  }));
  return res;
}

async function main() {
  let server;
  if (!EXTERNAL_SERVER) {
    if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) { console.error('dist/ is missing: run `npm run build` first'); process.exit(2); }
    server = spawn('node', ['docs/iphone-duo-final/serve.mjs', String(PORT)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY || '1' } });
    for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE + '/'); if (r.ok) break; } catch (e) { /* not up yet */ } await sleep(250); }
  }
  // Warm the read-only menu cache of serve.mjs so the first screens do not race the upstream fetch.
  for (const p of ['/api/customer-menu', '/api/products', '/api/top-products', '/api/regions', '/api/settings', '/api/recent-fomo']) { try { await fetch(BASE + p); } catch (e) { /* offline: menu screens will report a setup error */ } }
  const only = process.env.DUO_ONLY ? process.env.DUO_ONLY.split(',') : null;
  const passIds = (process.env.DUO_PASSES || 'A,B,C,D,E,H').split(',');
  let browser = await webkit.launch();
  // Negative control: a plain button put in the corner MUST be reported, otherwise the guard is vacuous.
  {
    const ctx = await browser.newContext({ viewport: { width: 382, height: 580 }, isMobile: true });
    const pg = await ctx.newPage();
    await pg.setContent('<!doctype html><meta name=viewport content="width=device-width"><body style="margin:0"><button style="position:absolute;top:20px;right:10px">control</button><p style="position:absolute;top:100px;left:10px">outside</p>');
    const r = await pg.evaluate(measureInPage, [382, 580]);
    await ctx.close();
    if (!(r.hits.some((x) => x.text === 'control') && !r.hits.some((x) => x.text === 'outside'))) { console.error('NEGATIVE CONTROL FAILED: the guard did not flag a button placed in the corner', JSON.stringify(r)); process.exit(3); }
    console.log('negative control: a button in the corner is flagged (ok)');
  }
  const report = { engine: 'WebKit (Playwright ' + require('playwright/package.json').version + ')', base: BASE, baseMode: BASE_MODE, generatedAt: new Date().toISOString(), passes: {}, summary: {} };
  let violations = 0, inactive = 0, cases = 0, setupErrors = 0, bleed = 0, occluded = 0;
  const screens = SCREENS.filter((s) => !only || only.includes(s.id));
  const ctxList = (process.env.DUO_CTX || 'safari,app').split(',');
  for (const pid of passIds) for (const cx of ctxList) {
    const pass = PASSES[pid];
    const app = cx === 'app';
    if (pass.appOnly && !app) continue;
    const key = pid + ':' + cx;
    const rows = await pool(screens, CONC, async (s) => {
      // The Editor-class machines this runs on are sometimes overloaded: relaunch WebKit and retry once on a crash.
      for (let attempt = 0; ; attempt++) {
        if (!browser.isConnected()) browser = await webkit.launch();
        const row = await runScreen(browser, s, pass, undefined, app).catch((e) => ({ id: s.id, name: s.name, setupError: String(e).slice(0, 160), results: {} }));
        if (attempt >= 1 || !(row.setupError && /closed|crash/i.test(row.setupError))) return row;
      }
    });
    report.passes[key] = { context: app ? 'APP (WKWebView emulated)' : 'Safari', label: pass.label, sizes: pass.sizes, screens: rows };
    for (const row of rows) {
      if (row.setupError) { setupErrors++; console.log(`  setup-error ${key} ${row.id}: ${row.setupError}`); }
      for (const [vp, m] of Object.entries(row.results)) {
        cases++;
        if (m.error) { violations++; console.log(`  ERROR ${key} ${row.id} ${vp}: ${m.error}`); continue; }
        bleed += m.bleed.length; occluded += m.occluded.length;
        if (!BASE_MODE && !(m.active > 0 && Math.abs(m.cssH - m.zone[3]) <= 1.5 && Math.abs(m.active - 96) <= 0.5)) { inactive++; console.log(`  INACTIVE/MISMATCH ${key} ${row.id} ${vp} (css w=${m.active} h=${m.cssH}, guard zone h=${m.zone[3]})`); }
        if (m.hits.length) {
          violations += m.hits.length;
          console.log(`  HIT ${key} ${row.id} ${vp}: ` + m.hits.slice(0, 4).map((x) => `${x.el} "${x.text}"`).join(' | ') + (m.hits.length > 4 ? ` (+${m.hits.length - 4})` : ''));
        }
      }
    }
    console.log(`pass ${key} (${pass.label}) done`);
  }
  await browser.close();
  if (server) server.kill();
  report.summary = { screens: screens.length, cases, violations, inactive, setupErrors, bleedExceptions: bleed, occludedExceptions: occluded };
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report));
  console.log('summary', JSON.stringify(report.summary), '->', path.relative(ROOT, REPORT));
  process.exit(violations || inactive || setupErrors ? 1 : 0);
}
module.exports = { measureInPage, PASSES, NATIVE };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
