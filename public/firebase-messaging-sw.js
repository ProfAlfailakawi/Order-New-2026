importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBBVG0C-xjkuT3WeqiNAmJjw6lI8M6Gt6k',
  authDomain: 'gen-lang-client-0200723670.firebaseapp.com',
  projectId: 'gen-lang-client-0200723670',
  storageBucket: 'gen-lang-client-0200723670.firebasestorage.app',
  messagingSenderId: '119610604304',
  appId: '1:119610604304:web:55eba98b72a9a7f98d4395',
});

const messaging = firebase.messaging();
const PUSH_DEDUPE_CACHE = 'alturath-order-push-dedupe-v1';
const PUSH_DEDUPE_TTL_MS = 48 * 60 * 60 * 1000;
const PUSH_DEDUPE_TIMEOUT_MS = 5;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function wasPushAlreadyShown(eventId) {
  if (!eventId || !self.caches) return false;

  try {
    const cache = await caches.open(PUSH_DEDUPE_CACHE);
    const key = `/__order_push_dedupe__/${encodeURIComponent(eventId)}`;
    const existing = await cache.match(key);

    if (existing) {
      const savedAt = Number(existing.headers.get('x-saved-at') || '0');
      if (savedAt && Date.now() - savedAt < PUSH_DEDUPE_TTL_MS) return true;
    }

    await cache.put(key, new Response('1', {
      headers: {
        'cache-control': 'no-store',
        'x-saved-at': String(Date.now()),
      },
    }));
  } catch (e) {
    // Do not delay notification delivery because of dedupe cache errors.
  }

  return false;
}

messaging.onBackgroundMessage(async (payload) => {
  const title = payload?.notification?.title || 'تنبيه من الديوانية';
  const url = payload?.data?.url || '/';
  const eventId = payload?.data?.eventId || payload?.data?.tag || `${title}:${payload?.notification?.body || ''}:${url}`;
  const notificationTag = payload?.data?.notificationTag || payload?.data?.tag || `diwaniya-${payload?.data?.type || 'important'}`;
  const alreadyShown = await Promise.race([
    wasPushAlreadyShown(eventId),
    new Promise((resolve) => setTimeout(() => resolve(false), PUSH_DEDUPE_TIMEOUT_MS)),
  ]);

  if (alreadyShown) return;

  const oldNotifications = await self.registration.getNotifications({ tag: notificationTag });
  oldNotifications.forEach((notification) => notification.close());

  const options = {
    body: payload?.notification?.body || 'عندك شي ناطر من الربع.',
    icon: '/icon-192.png',
    badge: '/icon-180.png',
    tag: notificationTag,
    data: {
      url,
      eventId,
      notificationTag,
    },
    renotify: false,
  };

  await self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
