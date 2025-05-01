// Service Worker for Mermaid Chart Converter PWA

const CACHE_NAME = 'mermaid-converter-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './script.js',
  './codemirror-custom.css',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './favicon.ico'
];

// External resources to cache
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/mermaid@11.5.0/dist/mermaid.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.12/lib/codemirror.css',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.12/lib/codemirror.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.12/addon/mode/simple.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.12/addon/selection/active-line.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.12/addon/scroll/simplescrollbars.js',
  'https://cdn.jsdelivr.net/npm/codemirror@5.65.12/addon/scroll/simplescrollbars.css'
];

// Install event - cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Cache local assets
        return cache.addAll(ASSETS_TO_CACHE)
          .then(() => {
            // Try to cache external assets, but don't block installation if they fail
            return Promise.allSettled(
              EXTERNAL_ASSETS.map(url => 
                fetch(url, { mode: 'no-cors' })
                  .then(response => cache.put(url, response))
                  .catch(err => console.warn(`Failed to cache ${url}:`, err))
              )
            );
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return the response from cache
        if (response) {
          return response;
        }

        // Clone the request because it's a one-time use stream
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response because it's a one-time use stream
            const responseToCache = response.clone();

            // Open the cache and store the new response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, try to serve offline page
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            // For non-HTML requests, just return whatever we have
            return new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});
