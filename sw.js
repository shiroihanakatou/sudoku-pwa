/**
 * SERVICE WORKER (PWA & Offline First)
 * Lưu trữ App Shell và Assets cho phép chơi ngoại tuyến hoàn toàn
 */

const CACHE_NAME = 'sudoku-pwa-v1.0.0.dc62534';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './sudoku-engine.js',
  './app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Chiến lược Cache First, Network Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        if (networkResponse?.status !== 200 || networkResponse.type !== 'basic') return networkResponse;
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      });
    })
  );
});