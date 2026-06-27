// BONGE RIDERS — Service Worker v5
// Strategy:
//   HTML pages → Stale-while-revalidate (instant load from cache, refreshes in background)
//   Firebase/CDN scripts → Cache-first with long TTL (they're versioned & never change)
//   Icons/manifest → Cache-first forever

const CACHE_NAME = 'bonge-riders-cache-v5';

const HTML_PAGES = [
  '/',
  '/index.html',
  '/member.html',
  '/members-list.html',
  '/payment.html',
  '/register.html',
  '/spending.html',
  '/chairperson.html',
];

const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
  '/icon-32.png',
  '/icon-16.png',
];

// CDN scripts that are versioned and never change
const CDN_SCRIPTS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://fonts.googleapis.com/css2',
  'https://fonts.gstatic.com',
];

// Install: pre-cache all HTML pages + static assets immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([...HTML_PAGES, ...STATIC_ASSETS])
    )
  );
  self.skipWaiting(); // Activate immediately — no waiting for old tabs
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: delete all old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // HTML pages → stale-while-revalidate
  // Serve from cache instantly, update cache in background
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        }).catch(() => null);

        // Return cached instantly if available, else wait for network
        return cached || fetchPromise;
      })
    );
    return;
  }

  // CDN scripts (versioned) → cache-first, never re-fetch
  const isCDN = CDN_SCRIPTS.some(cdn => event.request.url.startsWith(cdn))
    || event.request.url.includes('gstatic.com/firebasejs')
    || event.request.url.includes('fonts.gstatic.com');

  if (isCDN) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const networkRes = await fetch(event.request);
        if (networkRes && networkRes.status === 200) {
          cache.put(event.request, networkRes.clone());
        }
        return networkRes;
      })
    );
    return;
  }

  // Static assets → cache-first
  if (STATIC_ASSETS.some(a => url.pathname.endsWith(a.replace('/', '')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Everything else (Firestore API calls) → network only (no caching of live data)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
