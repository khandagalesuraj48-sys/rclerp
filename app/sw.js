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
/* SCREEN SHARE CALLS WHEN THE APP IS CLOSED (update-75): the server sends a ring (encrypted for this browser only) – shown as a
 * notification of the phone / computer. A tap opens the app (or brings it to the front); the app then finds the ring itself.
 * A ring that was not answered becomes "Missed". Nothing else is ever sent this way. */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = {}; }
  const name = String(d.name || 'Somebody').slice(0, 60), tag = 'rtc-' + String(d.call || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const opt = d.t === 'ring'
    ? { body: (d.help ? 'Needs help' + (d.page ? ' – ' + String(d.page).slice(0, 40) : '') + '. ' : '') + 'Screen share with voice – tap to open the app and answer.', tag: tag, renotify: true, requireInteraction: true, vibrate: [400, 200, 400, 200, 400], icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { call: d.call || '', t: 'ring' } }
    : { body: 'Tap to open the app – call back from the screen button at the top.', tag: tag, renotify: false, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { call: d.call || '', t: 'missed' } };
  if (d.t === 'done') {      // answered / declined on another device of this user: the ring here goes (a short quiet note, closed after 4 s)
    e.waitUntil(self.registration.getNotifications({ tag: tag }).then(l => { l.forEach(n => n.close()); return self.registration.showNotification('Screen share answered on another device', { body: 'The call of ' + name + ' was answered or declined on another device of yours.', tag: tag, silent: true, icon: '/icons/icon-192.png', data: { t: 'done' } }); })
      .then(() => new Promise(ok => setTimeout(ok, 4000))).then(() => self.registration.getNotifications({ tag: tag })).then(l => l.forEach(n => n.close())));
    return;
  }
  const title = d.t === 'ring' ? name + ' wants to show you a screen' : d.t === 'missed' ? 'Missed: ' + name + ' wanted to show you a screen' : 'Fleet ERP';
  e.waitUntil(self.registration.showNotification(title, opt));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {}; if (data.t === 'done') return;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => { try { return new URL(x.url).origin === self.location.origin; } catch (er) { return false; } });
    if (w) { w.postMessage({ rtcOpen: data.call || '1' }); return w.focus(); }
    return self.clients.openWindow('/');
  }));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || u.pathname.indexOf('/api/') === 0) return;      // the server's calls: untouched
  if (e.request.mode === 'navigate' || u.pathname === '/' || u.pathname === '/index.html') {
    // only the page itself (/ or /index.html) is kept as the offline copy. (Any address opened in a tab – an icon, the manifest –
    // used to be stored AS the page, so the offline copy could become a picture. 07-10-2026)
    const isPage = u.pathname === '/' || u.pathname === '/index.html';
    e.respondWith(fetch(e.request).then(r => { if (r && r.ok && isPage) { const copy = r.clone(); caches.open(KEEP).then(c => c.put('/', copy)); } return r; }).catch(() => caches.match('/').then(r => r || new Response('<meta charset="utf-8"><p style="font:16px sans-serif;padding:24px">No network, and this device has no saved copy of the app yet. Connect once and open the app again.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
    return;
  }
  if (/^\/(icons\/|manifest\.webmanifest)/.test(u.pathname)) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => { if (x && x.ok) { const copy = x.clone(); caches.open(KEEP).then(c => c.put(e.request, copy)); } return x; })));
});
