// sw.js (Service Worker)

// Cache version for the landing page
const landingPageCacheVersion = "v2";

// Cache static assets during installation for the landing page
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(landingPageCacheVersion).then(function (cache) {
      return cache.addAll([
        "/", // Add the URL of your index.html file (landing page)
        // Add other URLs of static assets used in your landing page (e.g., images, CSS, etc.)
      ]);
    })
  );
});

// Handle cache activation and removal of old caches
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== landingPageCacheVersion) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Serve cached landing page or fetch from the network for the landing page
self.addEventListener("fetch", function (event) {
  const requestUrl = new URL(event.request.url);

  // Check if the request is for the landing page
  if (requestUrl.pathname === "/") {
    event.respondWith(
      caches.open(landingPageCacheVersion).then(function (cache) {
        return cache.match(event.request).then(function (response) {
          const fetchPromise = fetch(event.request);

          // Return the cached response if available, or fetch from network and cache the response
          return response || fetchPromise;
        });
      })
    );
  } else {
    // For other requests (e.g., cart, increment/decrements, payments), bypass the cache and fetch from the network directly
    event.respondWith(fetch(event.request));
  }
});
