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
import {installAppUpdate} from './lib/app-update';
import {installReveal} from './lib/reveal';
import {watchForPlatformUpdating} from './lib/updatingNotice';

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
