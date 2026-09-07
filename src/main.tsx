import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {installAppUpdate} from './lib/app-update';

// التحديث الذاتي الصامت: بصمة الإصدار، منارتها، ثم التحديث والتصعيد عند اللزوم.
installAppUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
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
