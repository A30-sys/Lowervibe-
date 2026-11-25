/**
 * LOWERVIBE PWA Service Worker
 * Supports dual installable WebApps (Main & Creator), offline shell caching,
 * and native notification click navigation.
 */

const CACHE_NAME = 'lowervibe-cache-v12';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-creator.json',
  '/apple-touch-icon.png',
  '/icons/icon-192.svg',
  '/icons/pwa-192x192.png',
  '/icons/pwa-512x512.png',
  '/icons/pwa-maskable-512x512.png',
  '/assets/aistudio/hf_20261027_065809_f2446c35-920d-4d5a-a97a-dcfad0262ef1_802ab9c5.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    try {
      payload = { notification: { title: 'LOWERVIBE', body: event.data.text() } };
    } catch {
      payload = {};
    }
  }

  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || data.title || 'LOWERVIBE';
  const body = notif.body || data.body || 'New update on LOWERVIBE';
  const icon = notif.icon || '/icons/pwa-192x192.png';
  const image = notif.image || data.artworkUrl || undefined;
  const tag = data.tag || notif.tag || 'lowervibe-push';

  let safeUrl = '/';
  const rawUrl = data.url || data.actionRoute || (payload.fcmOptions && payload.fcmOptions.link) || '/';
  try {
    const parsed = new URL(String(rawUrl), self.location.origin);
    if (parsed.origin === self.location.origin) {
      safeUrl = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    }
  } catch {
    safeUrl = '/';
  }

  const options = {
    body,
    icon,
    badge: '/icons/pwa-192x192.png',
    ...(image ? { image } : {}),
    tag,
    renotify: true,
    vibrate: [120, 40, 120],
    data: { url: safeUrl },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawTarget = (event.notification.data && event.notification.data.url) || '/';
  let parsedUrl;
  try {
    parsedUrl = new URL(String(rawTarget), self.location.origin);
    if (parsedUrl.origin !== self.location.origin) {
      parsedUrl = new URL('/', self.location.origin);
    }
  } catch {
    parsedUrl = new URL('/', self.location.origin);
  }
  const fullTargetUrl = parsedUrl.href;
  const relativeTarget = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          try {
            await client.focus();
          } catch {}
          try {
            client.postMessage({ type: 'LOWERVIBE_NAVIGATE', url: relativeTarget });
            return;
          } catch {
            if ('navigate' in client && typeof client.navigate === 'function') {
              await client.navigate(fullTargetUrl).catch(() => {});
              return;
            }
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullTargetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // Never intercept cross-origin traffic, /api/ routes, live manifests, or Vite dev source/module imports
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/manifest-creator.json' ||
    (url.protocol !== 'http:' && url.protocol !== 'https:')
  ) {
    return;
  }

  // Network-first for navigation requests so deep links & fresh builds work reliably
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request);
    })
  );
});
