// @vitest-environment jsdom
/*
 * صفحة «نُحدّث البرنامج» وما يقدّمها.
 *
 * أثناء نشر خادم الطلبات تجيب واجهةُ Google بصفحة خطأٍ إنجليزية. هذا الفحص يحرس:
 *  - الصفحة نفسها: مستقلّة، عربية، تسأل /api/health ولا تدور في حلقة.
 *  - عامل الخدمة: يقدّمها للتنقّل وحده عند 5xx أو الانقطاع، ولا يلمس /api ولا الدفع،
 *    ولا يحفظ جواب 5xx أبداً. يُشغَّل العامل الحقيقي (public/sw.js) في صندوق.
 *  (/api/health في updating-health.test.ts، في بيئة Node.)
 *  - الشريط داخل التطبيق: يراقب ولا يبدّل الجواب.
 */
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/* ------------------------------ الصفحة نفسها ------------------------------ */
describe('public/updating.html', () => {
  const html = read('public/updating.html');

  it('is a standalone Arabic RTL page in the site identity', () => {
    expect(html).toMatch(/<html lang="ar" dir="rtl">/);
    expect(html).toMatch(/<title>نُحدّث البرنامج · مطبخ التراث الكويتي<\/title>/);
    expect(html).toContain('نُحدّث البرنامج الآن ✨');
    expect(html).toContain('لحظاتٍ ونعود');
    expect(html).toContain('أعد المحاولة الآن');
    expect(html).toContain('لا اتصال بالإنترنت الآن');
    expect(html).toContain('<meta name="updating-page" content="1">');
    expect(html).toContain('prefers-color-scheme:dark');
    expect(html).toContain('prefers-reduced-motion:reduce');
  });

  it('makes no request to another origin', () => {
    const urls = [...html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"|url\(\s*"?([^")]+)"?\s*\)/g)].map((m) => m[1] || m[2]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith('/'), url).toBe(true);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('polls /api/health with backoff and never loops', () => {
    expect(html).toContain('var HEALTH = "/api/health"');
    expect(html).toContain('FIRST = 3000, CEILING = 15000, PATIENT = 30000');
    expect(html).toContain('cache: "no-store"');
    expect(html).toContain('recent().length >= 3');
    expect(html).toContain('location.replace("/")');
  });
});

/* ------------------------------- عامل الخدمة ------------------------------- */
type Handler = (event: any) => void;

function loadWorker(network: (url: string, init?: any) => Promise<Response>, online = true) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (req: any) => new URL(typeof req === 'string' ? req : req.url, 'https://order.test').pathname;
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      put: async (req: any, res: Response) => { store.set(keyOf(req), res); },
      match: async (req: any) => store.get(keyOf(req))?.clone(),
      // كالحقيقي: جوابٌ غير ناجح يُفشل addAll كله ولا يُحفظ منه شيء.
      addAll: async (list: string[]) => {
        const got = await Promise.all(list.map(async (u) => [u, await network(u)] as const));
        if (got.some(([, r]) => !r.ok)) throw new TypeError('addAll: bad response');
        for (const [u, r] of got) store.set(keyOf(u), r);
      },
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (req: any) => { for (const s of stores.values()) { const hit = s.get(keyOf(req)); if (hit) return hit.clone(); } return undefined; },
  };
  const self: any = {
    location: { origin: 'https://order.test' },
    navigator: { onLine: online },
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; },
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
  };
  const fetchSpy = vi.fn((input: any, init?: any) => network(typeof input === 'string' ? input : input.url, init));
  vm.runInNewContext(read('public/sw.js'), { self, caches, fetch: fetchSpy, Response, URL, Promise, console });
  const install = async () => {
    let wait: Promise<unknown> = Promise.resolve();
    handlers.install({ waitUntil: (p: Promise<unknown>) => { wait = p; } });
    await wait;
  };
  const dispatch = async (url: string, mode = 'navigate', method = 'GET') => {
    let answer: Promise<Response> | null = null;
    handlers.fetch({
      request: { url: new URL(url, 'https://order.test').href, method, mode },
      respondWith: (p: Promise<Response>) => { answer = p; },
    });
    return answer ? await answer : null;
  };
  return { install, dispatch, stores, fetchSpy };
}

const UPDATING_HTML = read('public/updating.html');
const page = (body: string, status = 200, type = 'text/html; charset=utf-8') =>
  new Response(body, { status, headers: { 'content-type': type } });
const googleError = (status: number) => page('<html><body>Error: Server Error</body></html>', status);

function networkWith(navigation: () => Promise<Response>) {
  return async (url: string) => {
    const path = new URL(url, 'https://order.test').pathname;
    if (path === '/updating.html') return page(UPDATING_HTML);
    if (path === '/manifest.json') return page('{}', 200, 'application/json');
    if (path === '/logo-optimized.png') return page('png', 200, 'image/png');
    return navigation();
  };
}

describe('public/sw.js serves the updating page', () => {
  it('precaches /updating.html at install', async () => {
    const worker = loadWorker(networkWith(async () => page('<html>app</html>')));
    await worker.install();
    const stored = [...worker.stores.values()].some((store) => store.has('/updating.html'));
    expect(stored).toBe(true);
  });

  it.each([500, 502, 503, 504])('answers a %i navigation with the updating page (503, no-store)', async (status) => {
    const worker = loadWorker(networkWith(async () => googleError(status)));
    await worker.install();
    const response = (await worker.dispatch('/menu'))!;
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('نُحدّث البرنامج الآن');
  });

  it('answers a dropped navigation while online with the updating page', async () => {
    const worker = loadWorker(networkWith(async () => { throw new TypeError('Failed to fetch'); }), true);
    await worker.install();
    const response = (await worker.dispatch('/menu'))!;
    expect(response.status).toBe(503);
  });

  it('keeps the offline shell when the device is offline', async () => {
    let fail = false;
    const worker = loadWorker(networkWith(async () => { if (fail) throw new TypeError('offline'); return page('<html>app shell</html>'); }), false);
    await worker.install();
    fail = true;
    const response = (await worker.dispatch('/'))!;
    expect(await response.text()).toContain('app shell');
  });

  it('never stores a 5xx as the app shell', async () => {
    const worker = loadWorker(networkWith(async () => googleError(502)));
    await worker.install();
    await worker.dispatch('/');
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const store of worker.stores.values()) {
      for (const [key, res] of store) expect(res.status < 500, key).toBe(true);
    }
  });

  it('passes successful navigations through unchanged', async () => {
    const worker = loadWorker(networkWith(async () => page('<html>menu</html>')));
    await worker.install();
    const response = (await worker.dispatch('/menu'))!;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html>menu</html>');
  });

  it.each(['/api/orders', '/?payment=success', '/?checkout=payment', '/track/abc', '/split/xyz'])(
    'never touches %s',
    async (path) => {
      const worker = loadWorker(networkWith(async () => googleError(502)));
      await worker.install();
      expect(await worker.dispatch(path)).toBeNull();
    },
  );

  it('never touches non-GET requests', async () => {
    const worker = loadWorker(networkWith(async () => googleError(502)));
    await worker.install();
    expect(await worker.dispatch('/menu', 'navigate', 'POST')).toBeNull();
  });

  it('does not store a page that is not the updating page (SPA rewrite)', async () => {
    const worker = loadWorker(async (url) => {
      const path = new URL(url, 'https://order.test').pathname;
      if (path === '/updating.html') return page('<html>index.html from the rewrite</html>');
      return page('<html>app</html>');
    });
    await worker.install();
    const stored = [...worker.stores.values()].some((store) => store.has('/updating.html'));
    expect(stored).toBe(false);
  });
});

/* ------------------------------ الشريط داخل التطبيق ------------------------------ */
describe('in-app updating notice', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('tells a platform error page apart from our own JSON errors', async () => {
    const { isPlatformUpdating, serverAnswered } = await import('../lib/updatingNotice');
    expect(isPlatformUpdating(502, 'text/html')).toBe(true);
    expect(isPlatformUpdating(500, 'application/json; charset=utf-8')).toBe(false);
    expect(isPlatformUpdating(404, 'text/html')).toBe(false);
    expect(serverAnswered(200, 'application/json')).toBe(true);
    expect(serverAnswered(404, 'application/json')).toBe(true);
    expect(serverAnswered(404, 'text/html')).toBe(false);
    expect(serverAnswered(503, 'text/html')).toBe(false);
  });

  it('observes /api answers without changing them, and shows one calm bar', async () => {
    vi.resetModules();
    const answers: Response[] = [];
    window.fetch = vi.fn(async () => {
      const res = googleError(502);
      answers.push(res);
      return res;
    }) as any;
    const notice = await import('../lib/updatingNotice');
    notice.watchForPlatformUpdating();
    const first = await window.fetch('/api/orders', { method: 'POST' });
    const second = await window.fetch('/api/settings');
    await Promise.resolve();
    expect(first).toBe(answers[0]);
    expect(second).toBe(answers[1]);
    expect(first.bodyUsed).toBe(false);
    const bars = document.querySelectorAll('.alturath-updating-notice');
    expect(bars.length).toBe(1);
    expect(bars[0].textContent).toBe(notice.UPDATING_MESSAGE);
  });

  it('ignores other origins and successful answers', async () => {
    vi.resetModules();
    window.fetch = vi.fn(async (input: any) => (String(input).includes('gateway') ? googleError(502) : page('{}', 200, 'application/json'))) as any;
    const notice = await import('../lib/updatingNotice');
    notice.watchForPlatformUpdating();
    await window.fetch('https://gateway.example/pay');
    await window.fetch('/api/settings');
    await Promise.resolve();
    expect(document.querySelectorAll('.alturath-updating-notice').length).toBe(0);
  });

  it('hides the bar and tells waiters once the server answers', async () => {
    vi.resetModules();
    const notice = await import('../lib/updatingNotice');
    vi.useFakeTimers();
    let up = false;
    const back = vi.fn();
    const event = vi.fn();
    window.addEventListener(notice.SERVER_BACK_EVENT, event);
    notice.showUpdatingNotice(async () => up, back);
    expect(document.querySelectorAll('.alturath-updating-notice').length).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(back).not.toHaveBeenCalled();
    up = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(back).toHaveBeenCalledTimes(1);
    expect(event).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.alturath-updating-notice').length).toBe(0);
  });

  it('chunk recovery asks the server before wiping caches', () => {
    const source = read('src/lib/app-update.ts');
    const recover = source.slice(source.indexOf('async function recoverFromStaleChunk'), source.indexOf('export function markShellHealthy'));
    expect(recover).toContain('await serverAnswers()');
    expect(recover.indexOf('await serverAnswers()')).toBeLessThan(recover.indexOf('purgeShell()'));
    expect(read('src/main.tsx')).toContain('watchForPlatformUpdating()');
  });
});
