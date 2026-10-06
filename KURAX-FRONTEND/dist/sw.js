const CACHE_NAME = 'kurax-v4';
try {
  importScripts('/firebase-config.js');
  const config = self.KURAX_FIREBASE_CONFIG;
  if (config?.apiKey && config?.projectId && config?.messagingSenderId && config?.appId) {
    importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
    firebase.initializeApp(config);
    firebase.messaging().onBackgroundMessage((payload) => {
      const data = payload.data || {};
      self.registration.showNotification(data.title || 'Kurax staff alert', {
        body: data.body || 'A staff update needs your attention.',
        icon: '/icons/icon-192x192.png',
        tag: `${data.type || 'staff'}-${data.referenceId || data.createdAt || Date.now()}`,
        data: { link: data.link || '/' },
      });
    });
  }
} catch (error) {
  console.error('Firebase background notifications are unavailable:', error);
}

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data?.link;
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return;

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const target = new URL(link, self.location.origin).href;
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
