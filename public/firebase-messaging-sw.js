/* Alturath Order Service Worker - direct FCM/Web Push delivery guard */

const PUSH_DEDUPE_CACHE = 'alturath-order-push-dedupe-v2';
const PUSH_DEDUPE_TTL_MS = 48 * 60 * 60 * 1000;
const PUSH_DEDUPE_TIMEOUT_MS = 5;

self.addEventListener('install', (event) => {
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

function normalizeUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '/';
  if (value.startsWith('http')) return value;
  return value.startsWith('/') ? value : `/${value}`;
}

function readPushPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch (e) {
    return {
      notification: {
        title: 'تنبيه من الديوانية',
        body: event.data ? event.data.text() : 'عندك شي ناطر من الربع.',
      },
    };
  }
}

function pickPayloadFields(payload) {
  const title =
    payload?.notification?.title ||
    payload?.title ||
    payload?.data?.title ||
    'تنبيه من الديوانية';

  const body =
    payload?.notification?.body ||
    payload?.body ||
    payload?.data?.body ||
    'عندك شي ناطر من الربع.';

  const url = normalizeUrl(
    payload?.fcmOptions?.link ||
    payload?.webpush?.fcmOptions?.link ||
    payload?.notification?.click_action ||
    payload?.data?.url ||
    payload?.data?.click_action ||
    payload?.url ||
    '/'
  );

  const type = payload?.data?.type || payload?.type || 'diwaniya';
  const orderId = payload?.data?.orderId || payload?.orderId || '';
  const squadId = payload?.data?.squadId || payload?.squadId || '';
  const eventId =
    payload?.data?.eventId ||
    payload?.eventId ||
    payload?.data?.tag ||
    `${type}:${orderId || squadId || ''}:${title}:${body}:${url}`;

  const notificationTag =
    payload?.data?.notificationTag ||
    payload?.notification?.tag ||
    payload?.data?.tag ||
    `diwaniya-${type}-${orderId || squadId || eventId}`;

  const image = normalizeUrl(
    payload?.notification?.image ||
    payload?.data?.image ||
    payload?.data?.imageUrl ||
    payload?.image ||
    ''
  );

  const icon = normalizeUrl(
    payload?.notification?.icon ||
    payload?.data?.icon ||
    '/icon-192.png'
  );

  const badge = normalizeUrl(
    payload?.notification?.badge ||
    payload?.data?.badge ||
    '/icon-180.png'
  );

  return { title, body, url, type, orderId, squadId, eventId, notificationTag, image, icon, badge };
}

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const { title, body, url, type, orderId, squadId, eventId, notificationTag, image, icon, badge } = pickPayloadFields(payload);

  event.waitUntil((async () => {
    const alreadyShown = await Promise.race([
      wasPushAlreadyShown(eventId),
      new Promise((resolve) => setTimeout(() => resolve(false), PUSH_DEDUPE_TIMEOUT_MS)),
    ]);

    if (alreadyShown) return;

    const oldNotifications = await self.registration.getNotifications({ tag: notificationTag });
    oldNotifications.forEach((notification) => notification.close());

    const notificationOptions = {
      body,
      icon,
      badge,
      tag: notificationTag,
      renotify: type !== 'presence_in',
      requireInteraction: type === 'qatya_request',
      silent: type === 'presence_in',
      data: { url, eventId, notificationTag, type, orderId, squadId, image },
    };

    if (image && image !== '/') notificationOptions.image = image;

    await self.registration.showNotification(title, notificationOptions);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = normalizeUrl(event.notification?.data?.url || '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url && client.url.includes(self.location.origin)) {
          if ('navigate' in client) return client.navigate(url).then(() => client.focus());
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
