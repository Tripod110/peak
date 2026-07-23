/* Peak service worker — cache app shell, never cache API calls */
const CACHE = 'peak-v9';
const SHELL = [
  './', 'index.html', 'style.css',
  'store.js', 'charts.js', 'api.js', 'food.js', 'train.js', 'sleep.js', 'grocery.js', 'app.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // Fetch shell files with cache:'reload' so the SW bypasses the browser's HTTP
  // cache and stores genuinely fresh copies — otherwise a stale HTTP-cached file
  // gets re-saved under the new cache name and updates never actually land.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u =>
        fetch(new Request(u, { cache: 'reload' }))
          .then(res => { if (res.ok) return c.put(u, res); })
          .catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // API calls & external: network only
  // network-first (bypassing the HTTP cache) so updates always land; cache fallback for offline
  e.respondWith(
    fetch(new Request(e.request, { cache: 'reload' })).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
