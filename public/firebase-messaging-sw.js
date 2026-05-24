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

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'تنبيه ديوانية';
  const options = {
    body: payload?.notification?.body || 'عندك تنبيه مهم من الديوانية.',
    icon: '/icon-192.png',
    badge: '/icon-180.png',
    tag: payload?.data?.tag || `diwaniya-${payload?.data?.type || 'important'}`,
    data: {
      url: payload?.data?.url || '/',
    },
    renotify: false,
  };

  self.registration.showNotification(title, options);
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
