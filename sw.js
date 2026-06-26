// BONGE RIDERS — Service Worker
// Strategy: Network first for HTML (always gets latest update),
// Cache first for icons/fonts (they never change).

const CACHE_NAME = 'bonge-riders-cache-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
  '/icon-32.png',
  '/icon-16.png'
];

// Install: cache only static assets (icons, manifest)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Don't skipWaiting here — let the app decide via SKIP_WAITING message
});

// Listen for SKIP_WAITING message from the update banner
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: delete all old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - HTML → always network first (gets latest code immediately)
// - icons/manifest → cache first (never change, fast)
// - everything else → network first with cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always fetch HTML fresh from network
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache first
  if (STATIC_ASSETS.some(a => url.pathname.endsWith(a))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Everything else: network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
