/* Peak service worker — cache the app shell, never cache API calls.

   Strategy is split by request type, because the two goals genuinely conflict:

   - Navigations (HTML) are NETWORK-FIRST. index.html carries the ?v=NN asset
     references, so it is the one file that must never be stale — serving an old
     copy is what pins the whole app to an old version.
   - Versioned assets (?v=NN) are CACHE-FIRST. Their URL changes whenever the
     content does, so a cache hit is always correct, and every cold start on gym
     wifi stops waiting on a network round-trip before it can paint.

   The previous build was network-first for everything, which fixed stale updates
   at the cost of a network timeout on every single launch offline or on 1 bar.
*/
const CACHE = 'peak-v28';
const SHELL = [
  './', 'index.html',
  'style.css?v=28',
  'store.js?v=28', 'charts.js?v=28', 'quips.js?v=28', 'api.js?v=28',
  'food.js?v=28', 'train.js?v=28', 'sleep.js?v=28', 'grocery.js?v=28', 'app.js?v=28',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache:'reload' bypasses the browser's HTTP cache so the SW stores genuinely
  // fresh copies — otherwise a stale HTTP-cached file gets re-saved under the new
  // cache name and updates never actually land.
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
  // Delete ALL old caches (any name != current) so a corrupted entry from a
  // previous version can never survive an update.
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* only cache genuinely-good responses — caching a 4xx/5xx/opaque/partial
   response is what once served a broken app and a white screen */
function putIfOk(request, res) {
  if (res && res.ok && res.type !== 'opaque') {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // API calls & external: network only

  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isNav) {
    // network-first: the entry point must never be stale
    e.respondWith(
      fetch(new Request(req, { cache: 'reload' }))
        .then(res => putIfOk(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(hit => hit || caches.match('index.html', { ignoreSearch: true })))
    );
    return;
  }

  // cache-first for everything else, with a background refresh so a changed file
  // under an unchanged URL still lands by the next launch
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) {
        fetch(new Request(req, { cache: 'reload' })).then(res => putIfOk(req, res)).catch(() => {});
        return hit;
      }
      return fetch(req).then(res => putIfOk(req, res));
    })
  );
});
