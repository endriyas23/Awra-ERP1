
const CACHE_NAME = 'awra-erp-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event: Cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch Event: Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // Only cache same-origin requests to avoid caching API calls incorrectly here
          if (event.request.url.startsWith(self.location.origin)) {
             cache.put(event.request, responseToCache);
          }
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
