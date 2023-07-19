// sw.js (Service Worker)

// Cache version
const cacheName = "v1";

// Cache static assets
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(cacheName).then(function (cache) {
      return cache.addAll([
        "/", // Add the URL of your index.html file
        "/style.css", // Add the URLs of other important CSS files
        "/public/**/*", // Add other URLs of static assets used in your app
      ]);
    })
  );
});

// Serve cached static assets or fetch from the network
self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request);
    })
  );
});
