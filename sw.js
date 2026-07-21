// BONGE RIDERS — Service Worker
// Strategy: Network first for HTML (always gets latest update),
// Cache first for icons/fonts (they never change).
// Also handles Firebase Cloud Messaging push notifications in the background.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyAw6a_VeGF76_Flua_zhECEQGRqMdGx2xo",
  authDomain:        "bonge-96f37.firebaseapp.com",
  projectId:         "bonge-96f37",
  storageBucket:     "bonge-96f37.firebasestorage.app",
  messagingSenderId: "641310472447",
  appId:             "1:641310472447:web:2bd335fd022c5aedb2b4ca"
});

const messaging = firebase.messaging();

// Shown when the app is closed or in the background
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Bogonko-Ngelani Stage';
  const body  = (payload.notification && payload.notification.body)  || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-32.png',
    data: payload.data || {},
    vibrate: [120, 60, 120]
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});

const CACHE_NAME = 'bonge-riders-cache-v5';
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

// Activate: delete only old cache versions, keep the current one
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
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
