import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

export type DiwaniyaPushState =
  | 'unsupported'
  | 'missing-key'
  | 'blocked'
  | 'ready'
  | 'saved'
  | 'error';

export const FALLBACK_VAPID_KEY =
  'BGL4HY3Wt_Mlvf-aOyxUJA1TwffllGlkm19H5IVijVfxBzGUWWFrIkQVlIr5-FQ_xQd2JGxsdCuZpBcjABpv3Fw';

const VAPID_KEY =
  ((import.meta as any).env?.VITE_FIREBASE_VAPID_KEY as string | undefined) ||
  ((firebaseConfig as any).webPushVapidKey as string | undefined) ||
  FALLBACK_VAPID_KEY;

const TOKEN_STORAGE_KEY = 'diwaniya_important_push_token';

function getFirebaseAppSafely() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig as any);
}

async function getFreshMessagingServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  try {
    await registration.update();
  } catch (error) {
    console.warn('[DiwaniyaPush] Service Worker update skipped:', error);
  }

  const readyRegistration = await navigator.serviceWorker.ready;
  await new Promise((resolve) => setTimeout(resolve, 50));
  return readyRegistration || registration;
}

export const isDiwaniyaPushReady = async () => {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (!VAPID_KEY) return false;
  return isSupported().catch(() => false);
};

export const enableDiwaniyaImportantPush = async ({ phone, squadId }: { phone: string; squadId?: string }) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-8);
  if (!cleanPhone) return { state: 'error' as DiwaniyaPushState, message: 'رقم العميل غير واضح' };
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
  return { state: 'unsupported' as DiwaniyaPushState, message: 'المتصفح ما يدعم تنبيهات الديوانية الخارجية' };
  }
  if (!VAPID_KEY) {
    return { state: 'missing-key' as DiwaniyaPushState, message: 'مفتاح إشعارات الويب غير مفعّل حالياً' };
  }
  const supported = await isSupported().catch(() => false);
  if (!supported) return { state: 'unsupported' as DiwaniyaPushState, message: 'الإشعارات الخارجية غير مدعومة على هذا الجهاز' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { state: 'blocked' as DiwaniyaPushState, message: 'إذن التنبيهات مسكر' };
  }

  const registration = await getFreshMessagingServiceWorkerRegistration();
  const messaging = getMessaging(getFirebaseAppSafely());
  let token = '';
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (firstError) {
    console.warn('[DiwaniyaPush] First token attempt failed, retrying:', firstError);
    await new Promise((resolve) => setTimeout(resolve, 120));
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  }

  if (!token) return { state: 'error' as DiwaniyaPushState, message: 'ما قدرنا نجهز رمز الإشعار' };

  const response = await fetch('/api/diwaniya-push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: cleanPhone,
      token,
      squadId: squadId || '',
      prefs: { qatya: true, roulette: true },
      userAgent: navigator.userAgent,
      platform: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'iOS' : 'web',
      standalone:
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        (navigator as any).standalone === true ||
        false,
      notificationPermission: Notification.permission,
      currentUrl: window.location.href,
    }),
  });

  if (!response.ok) throw new Error('ما قدرنا نحفظ إعداد الإشعارات');
  try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
  return { state: 'saved' as DiwaniyaPushState, message: 'تنبيهات القطيّة ووهق غيرك تفعّلت' };
};

export const watchDiwaniyaForegroundPush = (onNotify: (payload: any) => void) => {
  if (!VAPID_KEY || !('Notification' in window)) return () => {};
  let unsubscribe = () => {};
  isSupported()
    .then((supported) => {
      if (!supported) return;
      const messaging = getMessaging(getFirebaseAppSafely());
      unsubscribe = onMessage(messaging, onNotify);
    })
    .catch(() => {});
  return () => unsubscribe();
};
