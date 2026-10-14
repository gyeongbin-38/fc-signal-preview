/* FC SIGNAL v0.5 preview service worker.
   HTML is network-first so deploys propagate; same-origin snapshot assets are
   cache-first (immutable binaries). Offline falls back to cache throughout.
   Prices/stats never change offline; the snapshot is fixed. */
const CACHE = 'fc-signal-v05-4';

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
  const isPage = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./'))));
    return;
  }
  if (u.pathname.endsWith('/catalog.json') || u.pathname.endsWith('/idmaps.json')) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  if (!u.pathname.includes('/assets/') && !u.pathname.includes('/web/')) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  })));
});
