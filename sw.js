/**
 * SERVICE WORKER (PWA & Offline First)
 * Lưu trữ App Shell và Assets cho phép chơi ngoại tuyến hoàn toàn
 */

const CACHE_NAME = 'sudoku-pwa-v1.0.1.357aea3';
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
      // ĐÃ BỎ self.skipWaiting() Ở ĐÂY để Service Worker mới đứng ở trạng thái "waiting"
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// LẮNG NGHE LỆNH TỪ GIAO DIỆN CLIENT
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.action === 'GET_VERSION') {
    // Phản hồi CACHE_NAME về cho cửa sổ/tab đã yêu cầu
    if (event.source) {
      event.source.postMessage({
        type: 'VERSION_INFO',
        version: CACHE_NAME
      });
    }
  }
});

self.addEventListener('fetch', (event) => {
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