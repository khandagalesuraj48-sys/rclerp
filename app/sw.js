/* Fleet ERP – service worker (05-10-2026). Small on purpose.
 *  - It makes the page an installable app and lets it OPEN without a network: the page itself (/) is fetched from the
 *    network every time (so a new deploy is seen at once) and kept; with no network the kept copy is shown – the app then
 *    says "no connection" for what needs the server.
 *  - /api/ is never touched: every call goes to the server as it is.
 *  - Icons and the manifest are kept.
 *  - BUILD changes with every deploy, so the browser installs the new worker; it takes over at once (skipWaiting) – the
 *    "Update" the person sees is decided by the app's own version check, not by this file. */
const BUILD = '/*BUILD*/', KEEP = 'fleet-erp-shell';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(KEEP).then(c => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== KEEP).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'build' && e.source) e.source.postMessage({ swBuild: BUILD }); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || u.pathname.indexOf('/api/') === 0) return;      // the server's calls: untouched
  if (e.request.mode === 'navigate' || u.pathname === '/' || u.pathname === '/index.html') {
    e.respondWith(fetch(e.request).then(r => { if (r && r.ok) { const copy = r.clone(); caches.open(KEEP).then(c => c.put('/', copy)); } return r; }).catch(() => caches.match('/').then(r => r || new Response('<meta charset="utf-8"><p style="font:16px sans-serif;padding:24px">No network, and this device has no saved copy of the app yet. Connect once and open the app again.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
    return;
  }
  if (/^\/(icons\/|manifest\.webmanifest)/.test(u.pathname)) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => { if (x && x.ok) { const copy = x.clone(); caches.open(KEEP).then(c => c.put(e.request, copy)); } return x; })));
});
