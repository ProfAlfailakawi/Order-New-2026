/*
 * «نُحدّث البرنامج» داخل التطبيق.
 *
 * أثناء نشر خادم الطلبات (Cloud Run) تجيب واجهةُ Google الأمامية طلباتِ /api بصفحة
 * HTML إنجليزية (500/502/503/504) لا يكتبها خادمُنا — هو يجيب /api بـJSON دائماً،
 * حتى أخطاؤه. فكانت الشاشات تعرض خطأً غامضاً، وكانت استعادةُ الحزم المفقودة قد
 * تمسح الذاكرة وتُلغي العامل في اللحظة التي تلزم فيها صفحةُ «نُحدّث البرنامج».
 *
 * لا يوجد هنا غلافٌ مركزي لـfetch، فلا نبني واحداً: `watchForPlatformUpdating` يراقب
 * الأجوبة فقط. الجوابُ يعود إلى صاحبه كما هو تماماً — لا يُقرأ ولا يُستنسخ ولا يُبدَّل —
 * فلا يتغيّر شيءٌ في مسار الطلب أو الدفع. حين يرى 5xx بغير JSON من /api يُظهر شريطاً
 * هادئاً واحداً، ويسأل /api/health حتى يعود الخادم فيختفي ويُعلم من ينتظر.
 */

const UPDATING_STATUSES = new Set([500, 502, 503, 504]);

export const UPDATING_MESSAGE = 'نُحدّث البرنامج الآن ✨ لحظاتٍ ونعود.';
/** يُطلق على window حين يعود الخادم. */
export const SERVER_BACK_EVENT = 'alturath:server-back';
export const HEALTH_URL = '/api/health';

/** جوابُ المنصّة لا جوابُ البرنامج: 5xx بغير JSON. */
export const isPlatformUpdating = (status: number, contentType: string | null | undefined): boolean =>
  UPDATING_STATUSES.has(status) && !String(contentType || '').includes('application/json');

/**
 * خادمُنا أجاب؟ نجاحٌ، أو جوابُ JSON منه غيرُ 5xx: خادمٌ أقدم لا يعرف /api/health
 * يجيب 404 بـJSON، وهو حيٌّ يجيب. صفحاتُ أخطاء المنصّة HTML دائماً.
 */
export const serverAnswered = (status: number, contentType: string | null | undefined): boolean =>
  (status >= 200 && status < 300) || (status < 500 && String(contentType || '').includes('application/json'));

let nativeFetch: typeof fetch | null = null;

/** سؤالُ الخادم مباشرةً، من غير المراقِب أدناه. */
export async function serverAnswers(): Promise<boolean> {
  try {
    const ask = nativeFetch || window.fetch.bind(window);
    const response = await ask(HEALTH_URL, { cache: 'no-store', credentials: 'same-origin' });
    return serverAnswered(response.status, response.headers.get('content-type'));
  } catch {
    return false;
  }
}

let notice: HTMLElement | null = null;
const waiting = new Set<() => void>();

/**
 * يُظهر الشريطَ مرّةً واحدة مهما تكرّر الطلب، ويسأل `probe` كل ثلاث ثوانٍ
 * (ويتباطأ إلى خمس عشرة)، فإذا أجاب أخفاه ونادى `onBack` ومن سبقه.
 */
export function showUpdatingNotice(probe: () => Promise<boolean> = serverAnswers, onBack?: () => void): void {
  if (onBack) waiting.add(onBack);
  if (notice || typeof document === 'undefined' || !document.body) return;
  const bar = document.createElement('div');
  bar.className = 'alturath-updating-notice';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.dir = 'rtl';
  bar.textContent = UPDATING_MESSAGE;
  bar.style.cssText = [
    'position:fixed', 'inset-inline:0', 'bottom:max(18px,env(safe-area-inset-bottom))', 'margin:0 auto', 'width:max-content', 'max-width:calc(100vw - 32px)',
    'z-index:2147483000', 'padding:11px 18px', 'border-radius:14px', 'font-family:inherit', 'font-size:14px', 'font-weight:700', 'line-height:1.6',
    'background:var(--sd-ivory,#fffaf0)', 'color:var(--sd-ink,#12301f)', 'border:1px solid var(--sd-seam,rgba(18,48,31,.16))',
    'box-shadow:0 14px 36px rgba(24,51,38,.18)', 'text-align:center', 'pointer-events:none',
  ].join(';');
  document.body.appendChild(bar);
  notice = bar;
  let tries = 0;
  const ask = async () => {
    const back = await probe().catch(() => false);
    if (!back) { tries++; window.setTimeout(ask, Math.min(15_000, 3000 * Math.pow(1.3, Math.max(0, tries - 5)))); return; }
    bar.remove();
    notice = null;
    const callbacks = [...waiting];
    waiting.clear();
    callbacks.forEach((callback) => { try { callback(); } catch { /* لا يوقف منتظرٌ واحد البقية */ } });
    window.dispatchEvent(new Event(SERVER_BACK_EVENT));
  };
  window.setTimeout(ask, 3000);
}

const isOwnApi = (input: RequestInfo | URL): boolean => {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

/**
 * يُركَّب مرّةً عند الإقلاع. يراقب ولا يتدخّل: الجوابُ نفسه يعود، والخطأ نفسه يُرمى.
 */
export function watchForPlatformUpdating(): void {
  if (nativeFetch || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const original = window.fetch.bind(window);
  nativeFetch = original;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const pending = original(input, init);
    pending.then((response) => {
      try {
        if (isPlatformUpdating(response.status, response.headers.get('content-type')) && isOwnApi(input)) showUpdatingNotice();
      } catch { /* المراقبة لا تكسر شيئاً */ }
    }, () => undefined);
    return pending;
  }) as typeof fetch;
}
