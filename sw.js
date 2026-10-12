/* FC SIGNAL v0.5 preview service worker — cache-first for the local snapshot.
   Caches only same-origin preview assets. Prices/stats never change offline;
   the snapshot is fixed, so stale-while-revalidate is not needed. */
const CACHE = 'fc-signal-v05';
const CORE = ['./'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add('./')).then(() => self.skipWaiting())
    .catch(err => console.error('sw install failed:', err && err.message || err)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && (u.pathname.endsWith('/') || u.pathname.endsWith('.html') || u.pathname.includes('/assets/'))) {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return r;
  }).catch(() => caches.match('./'))));
});
