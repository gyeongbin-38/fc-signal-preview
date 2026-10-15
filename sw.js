/* FC SIGNAL v0.5 preview service worker.
   HTML is network-first so deploys propagate; same-origin snapshot assets are
   cache-first (immutable binaries). Offline falls back to cache throughout.
   Prices/stats never change offline; the snapshot is fixed. */
const CACHE = 'fc-signal-v08-1';
const MAX_ENTRIES=220,TTL=7*86400000;
self.addEventListener('push',e=>{let p={};try{p=e.data?.json()||{};}catch(_){}e.waitUntil(self.registration.showNotification(String(p.title||'FC SIGNAL').slice(0,100),{body:String(p.body||'').slice(0,500),tag:'fc-signal-own-service'}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(new URL('./#market',self.registration.scope).href));});
async function store(request,response){if(!response.ok)return;const cache=await caches.open(CACHE),headers=new Headers(response.headers);headers.set('X-FC-Cached-At',String(Date.now()));await cache.put(request,new Response(await response.clone().arrayBuffer(),{status:response.status,statusText:response.statusText,headers}));const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-MAX_ENTRIES)))await cache.delete(key);}
async function fresh(request){const c=await caches.open(CACHE),r=await c.match(request);if(r&&Date.now()-Number(r.headers.get('X-FC-Cached-At')||0)>TTL){await c.delete(request);return null;}return r;}

self.addEventListener('install', e => {
  e.waitUntil(fetch('./').then(r=>store('./',r)).then(() => self.skipWaiting())
    .catch(err => console.error('sw install failed:', err && err.message || err)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k.startsWith('fc-signal-')&&k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const isPage = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) e.waitUntil(store(e.request,r.clone()));
      return r;
    }).catch(() => fresh(e.request).then(hit => hit || fresh('./'))));
    return;
  }
  if (u.pathname.includes('/api/')) return; // Live DB state never comes from an offline cache.
  if (u.pathname.endsWith('.json')||u.pathname.endsWith('/search-worker.js')) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) e.waitUntil(store(e.request,r.clone()));
      return r;
    }).catch(() => fresh(e.request)));
    return;
  }
  if (!u.pathname.includes('/assets/') && !u.pathname.includes('/web/')) return;
  e.respondWith(fresh(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) e.waitUntil(store(e.request,r.clone()));
    return r;
  })));
});
