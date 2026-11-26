import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'motion/react';
import App from './App.tsx';
import './index.css';
import './beauty-pass.css';
import './identity.css';
import './motion.css';
import './polish.css';
import './duo.css';
import './duo-stacked.css';
import './dock-motion.css';
import {installAppUpdate} from './lib/app-update';
import {installReveal} from './lib/reveal';
import {watchForPlatformUpdating} from './lib/updatingNotice';

/* علامات iPhone Duo على <html>، للعرض وحده:
   data-device="duo" حين تكون الشاشة شبه مربّعة (الخارجية 466×678، الداخلية 669×951؛ النسبة ≤1.48).
   كل iPhone نسبته ≥1.7 وiPad أعرض من 700، فقواعد الدوو لا تمسّهما. يُعاد عند الفتح والإغلاق.
   data-shell: "app" داخل التطبيق المثبّت، و"browser" في المتصفح.
   data-widget-side: جهة عمود ساعة النظام كما يبلغها iOS عبر safe-area (صفرٌ في Safari). */
const rootEl = document.documentElement;
/* على الجهاز الحقيقي نسبة الشاشة الخارجية ≈1.484، فالقرار من ثلاث قرائن يكفي أيٌّ منها على iPhone/غلاف iOS:
   شاشةٌ شبه مربّعة (الضلع القصير 400–720 والنسبة ≤ 1.62)، أو مثلها بأبعاد screen.avail*، أو نافذةٌ ضلعها القصير
   أعرض من 500. وكل iPad ضلعه القصير ≥ 744 فيبقى «other». */
const isAppleHandheld = () => /iPhone|iPod/.test(navigator.userAgent)
  || (window as unknown as {Capacitor?: {getPlatform?: () => string}}).Capacitor?.getPlatform?.() === 'ios';
const nearSquare = (a: number, b: number) => { const lo = Math.min(a, b), hi = Math.max(a, b); return lo >= 400 && lo <= 720 && hi / lo <= 1.62; };
const markDevice = () => {
  const shortScreen = Math.min(screen.width, screen.height);
  const viewportShort = Math.min(window.innerWidth, window.innerHeight);
  const duo = isAppleHandheld() && shortScreen <= 720 && (
    nearSquare(screen.width, screen.height)
    || nearSquare(screen.availWidth, screen.availHeight)
    || (viewportShort > 500 && viewportShort <= 720)
  );
  rootEl.dataset.device = duo ? 'duo' : 'other';
};
markDevice();
window.addEventListener('resize', markDevice);
window.addEventListener('orientationchange', () => window.setTimeout(markDevice, 300));
const isApp = Boolean((window as unknown as {Capacitor?: {isNativePlatform?: () => boolean}}).Capacitor?.isNativePlatform?.())
  || window.matchMedia('(display-mode: standalone)').matches
  || (navigator as unknown as {standalone?: boolean}).standalone === true;
rootEl.dataset.shell = isApp ? 'app' : 'browser';
const sideProbe = document.createElement('div');
sideProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
rootEl.appendChild(sideProbe);
const markWidgetSide = () => {
  const cs = getComputedStyle(sideProbe), l = parseFloat(cs.paddingLeft) || 0, r = parseFloat(cs.paddingRight) || 0;
  let side = l > 20 && l > r ? 'left' : r > 20 ? 'right' : 'none';
  /* الداخلية عرضاً داخل التطبيق: قد يبلغ iOS حدوداً صفرية والساعة قائمةٌ في الركن الأعلى الأيمن، فكانت الصفحة تمتدّ تحتها. نحجز الركن دائماً. */
  if (side === 'none' && rootEl.dataset.shell === 'app' && rootEl.dataset.device === 'duo'
    && window.matchMedia('screen and (orientation: landscape) and (min-width: 860px) and (max-width: 1000px) and (min-height: 500px) and (max-height: 760px)').matches) side = 'right';
  rootEl.dataset.widgetSide = side;
};
markWidgetSide();
// المسبار 0×0 والحدود حشوته: يُراقَب صندوقه الخارجي، فمراقبة المحتوى لا تتغيّر أبداً. وقراءاتٌ مؤجَّلة احتياطاً.
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(markWidgetSide).observe(sideProbe, {box: 'border-box'});
for (const ms of [120, 600, 1500, 3000]) window.setTimeout(markWidgetSide, ms);
document.addEventListener('visibilitychange', () => { if (!document.hidden) markWidgetSide(); });
window.addEventListener('resize', () => { requestAnimationFrame(markWidgetSide); window.setTimeout(markWidgetSide, 400); });
window.addEventListener('orientationchange', () => window.setTimeout(markWidgetSide, 400));

// أثناء النشر تجيب المنصّة /api بصفحة خطأ HTML: شريطٌ هادئ بدل خطأ غامض. يراقب ولا يبدّل الجواب.
watchForPlatformUpdating();
// التحديث الذاتي الصامت: بصمة الإصدار، منارتها، ثم التحديث والتصعيد عند اللزوم.
installAppUpdate();
installReveal();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

// Register the caching service worker in production only. It bypasses /api and
// the payment return/callback route, so it cannot reintroduce the payment
// white-screen bug that led vite-plugin-pwa to be disabled.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
