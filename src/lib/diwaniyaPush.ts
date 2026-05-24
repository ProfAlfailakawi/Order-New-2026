import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

export type DiwaniyaPushState =
  | 'unsupported'
  | 'missing-key'
  | 'blocked'
  | 'ready'
  | 'saved'
  | 'error';

const VAPID_KEY =
  ((import.meta as any).env?.VITE_FIREBASE_VAPID_KEY as string | undefined) ||
  ((firebaseConfig as any).webPushVapidKey as string | undefined) ||
  '';

const TOKEN_STORAGE_KEY = 'diwaniya_important_push_token';

export const isDiwaniyaPushReady = async () => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (!VAPID_KEY) return false;
  return isSupported().catch(() => false);
};

export const enableDiwaniyaImportantPush = async ({ phone, squadId }: { phone: string; squadId?: string }) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-8);
  if (!cleanPhone) return { state: 'error' as DiwaniyaPushState, message: 'رقم العميل غير واضح' };
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { state: 'unsupported' as DiwaniyaPushState, message: 'المتصفح لا يدعم إشعارات الديوانية الخارجية' };
  }
  if (!VAPID_KEY) {
    return { state: 'missing-key' as DiwaniyaPushState, message: 'مفتاح إشعارات الويب غير مفعّل حالياً' };
  }
  const supported = await isSupported().catch(() => false);
  if (!supported) return { state: 'unsupported' as DiwaniyaPushState, message: 'الإشعارات الخارجية غير مدعومة على هذا الجهاز' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { state: 'blocked' as DiwaniyaPushState, message: 'تم إلغاء إذن الإشعارات' };
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(getApp());
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

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
    }),
  });

  if (!response.ok) throw new Error('ما قدرنا نحفظ إعداد الإشعارات');
  try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
  return { state: 'saved' as DiwaniyaPushState, message: 'تم تفعيل تنبيهات القطيّة والروليت' };
};

export const watchDiwaniyaForegroundPush = (onNotify: (payload: any) => void) => {
  if (!VAPID_KEY || !('Notification' in window)) return () => {};
  let unsubscribe = () => {};
  isSupported()
    .then((supported) => {
      if (!supported) return;
      const messaging = getMessaging(getApp());
      unsubscribe = onMessage(messaging, onNotify);
    })
    .catch(() => {});
  return () => unsubscribe();
};
