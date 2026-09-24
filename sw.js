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
const CACHE = 'peak-v48';
const SHELL = [
  './', 'index.html',
  'style.css?v=48',
  'store.js?v=48', 'ui.js?v=48', 'charts.js?v=48', 'quips.js?v=48', 'api.js?v=48',
  'food.js?v=48', 'train.js?v=48', 'routines.js?v=48', 'sleep.js?v=48', 'grocery.js?v=48', 'custom.js?v=48', 'coach.js?v=48', 'app.js?v=48',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache:'reload' bypasses the browser's HTTP cache so the SW stores genuinely
  // fresh copies — otherwise a stale HTTP-cached file gets re-saved under the new
  // cache name and updates never actually land.
  /* All or nothing. Swallowing a failed download let an install "succeed" with
     half the shell, and activate() then deleted the previous — complete — cache,
     so the app stopped opening offline. A failed install keeps the old worker
     and its full cache, and the browser simply tries again next launch. */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u =>
        fetch(new Request(u, { cache: 'reload' })).then(res => {
          if (!res.ok) throw new Error(`precache ${u}: ${res.status}`);
          return c.put(u, res);
        })
      )))
      .then(() => self.skipWaiting())
      .catch(err => caches.delete(CACHE).then(() => { throw err; }))
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
    /* network-first, but not network-forever: on one bar of gym wifi a fetch
       can hang for a minute. After 2.5s serve the cached shell; the network
       copy still lands in the cache for next time when it does arrive. */
    const cached = () => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || caches.match('index.html', { ignoreSearch: true }));
    const network = fetch(new Request(req, { cache: 'reload' })).then(res => putIfOk(req, res));
    e.respondWith(new Promise(resolve => {
      let done = false;
      const finish = r => { if (r && !done) { done = true; resolve(r); } };
      // network answer wins if it comes; offline falls straight to the cache
      network.then(finish, () => cached().then(finish));
      // slow network: the cached shell after 2.5s
      setTimeout(() => cached().then(finish), 2500);
      // nothing anywhere: let the browser show its offline page
      Promise.allSettled([network]).then(() => setTimeout(() => {
        if (!done) cached().then(r => { done = true; resolve(r || Response.error()); });
      }, 2600));
    }));
    return;
  }

  /* Cache-first for everything else — but matched EXACTLY, query included.
     Using ignoreSearch here was a serious bug: it strips the version query, so
     every version of a file collapsed onto a single cache entry and a release
     could serve the PREVIOUS build's script in response to a request for the new
     one. That defeated the entire cache-busting mechanism and could hand out a
     mixed bundle — some files new, some old — on the first load after a deploy.

     An exact miss is exactly what we want on a version bump: fall through to the
     network once, cache under the new URL, and let activate() drop the old cache.
     No background revalidation either — a versioned URL's content never changes,
     so re-fetching on every hit is pure waste. */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => putIfOk(req, res)))
  );
});

/* Reminder notifications from worker/src/index.js's scheduled() cron job —
   payload shape is { title, body } (see REMINDER_COPY in that file). */
self.addEventListener('push', e => {
  let data = { title: 'Peak', body: 'You have a reminder.' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'peak-reminder'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => 'focus' in c);
      return existing ? existing.focus() : self.clients.openWindow('./');
    })
  );
});
