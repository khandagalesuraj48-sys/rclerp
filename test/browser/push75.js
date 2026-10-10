// update-75 (asked 10-10-2026): a screen share call reaches a user whose app is CLOSED – as a notification (Web Push).
//   The server sends the ring to the browser maker's push service, encrypted for that one browser (RFC 8291) and signed with
//   the site's key (VAPID, RFC 8292). Here a stand-in push service (this file, 127.0.0.1:3555 – the app's server is told it
//   may write to it with RCL_PUSH_TEST_HOST, which the live site never has) checks the signature and opens the message with
//   the browser's keys, exactly as a push service and a browser do. Then the app's service worker is handed a push (Chrome's
//   own test door) and shows the notification; a tap on it reaches the open app.
//   node push75.js <port of a server started with RCL_PUSH_TEST_HOST=127.0.0.1:3555>
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), crypto = require('crypto'), http = require('http');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3011', BASE = 'http://127.0.0.1:' + port, PUSH = 'http://127.0.0.1:3555';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from app_users where email like 'p75%@rcl.test'; delete from activity_log where module = 'Screen Share'; delete from app_settings where id like 'RTCMISS|%' or id like 'PUSH|%' or id like 'PUSHE|%'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'RTC%' or key = 'USERS_LIST';");
const raw = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
// ---- the stand-in push service: what arrives, checked and opened as a browser would ----
const got = [];
const B64 = b => Buffer.from(b).toString('base64url');
function openMsg(body, ua, auth) {      // RFC 8291, receiver side
  const salt = body.subarray(0, 16), idlen = body[20], as = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const hk = (s, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, s, info, len));
  const ikm = hk(auth, ua.computeSecret(as), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as]), 32);
  const d = crypto.createDecipheriv('aes-128-gcm', hk(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hk(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12));
  d.setAuthTag(ct.subarray(ct.length - 16)); const p = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  if (p[p.length - 1] !== 2) throw new Error('no end mark'); return JSON.parse(p.subarray(0, p.length - 1).toString());
}
function checkSig(h) {      // RFC 8292: "vapid t=<JWT>, k=<the site's public key>"
  const m = /^vapid t=([^,]+), k=([A-Za-z0-9_-]+)$/.exec(String(h || '')); if (!m) return { ok: false, why: 'no vapid header' };
  const [hd, pl, sg] = m[1].split('.'), pub = Buffer.from(m[2], 'base64url');
  const key = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: B64(pub.subarray(1, 33)), y: B64(pub.subarray(33, 65)) } });
  const good = crypto.verify('sha256', Buffer.from(hd + '.' + pl), { key: key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sg, 'base64url'));
  const claims = JSON.parse(Buffer.from(pl, 'base64url').toString()), head = JSON.parse(Buffer.from(hd, 'base64url').toString());
  return { ok: good, alg: head.alg, aud: claims.aud, exp: claims.exp - Math.floor(Date.now() / 1000), sub: claims.sub, k: m[2] };
}
const devices = {};      // the "browsers" the stand-in knows: endpoint id → keys
const mkDevice = idn => { const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16); devices[idn] = { ua, auth }; return { endpoint: PUSH + '/push/' + idn, p256dh: B64(ua.getPublicKey()), auth: B64(auth) }; };
const srv = http.createServer((q, r) => { const ch = []; q.on('data', c => ch.push(c)); q.on('end', () => {
  const idn = q.url.split('/').pop(), dev = devices[idn], rec = { id: idn, h: q.headers, sig: checkSig(q.headers.authorization) };
  if (idn === 'gone') { got.push(rec); r.writeHead(410); r.end(); return; }
  try { rec.msg = openMsg(Buffer.concat(ch), dev.ua, dev.auth); } catch (e) { rec.err = String(e.message); }
  got.push(rec); r.writeHead(201); r.end(); }); });
(async () => {
  await new Promise(ok => srv.listen(3555, '127.0.0.1', ok));
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mods = (await raw({ fn: 'api', args: [admin, 'usersAdmin', []] })).result, MOD = (mods.modules || Object.keys((mods.users || [])[0].perms || {}));
  const mk = async name => { const email = 'p75' + name.toLowerCase() + '@rcl.test', p = {}; MOD.forEach(m => { p[m] = m === 'Log Book' || m === 'Dashboard' ? 'Edit' : 'None'; });
    const a = await raw({ fn: 'api', args: [admin, 'saveUserAdmin', [{ email, name: 'P75 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]] }); if (a.error) throw new Error(a.error);
    const l = await raw({ fn: 'login', args: [email, 'Temp#' + name + '1'] }), pw = 'Own#' + name + '2468'; const c = await raw({ fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] }); if (c.error) throw new Error(c.error); return { email, pw, name: 'P75 ' + name, token: c.result.token }; };
  const UB = await mk('Bala');
  const api = (tok, fn, x) => raw({ fn: 'api', args: [tok, fn, [x]] });

  // ---------- 1. a device of Bala's is saved; what is refused ----------
  const key = (await api(UB.token, 'rtcPushKey', {})).result.key;
  const evil = await api(UB.token, 'rtcPushSave', { endpoint: 'https://evil.example.com/push/x', p256dh: mkDevice('x').p256dh, auth: devices.x ? B64(devices.x.auth) : '' });
  const lan = await api(UB.token, 'rtcPushSave', { endpoint: 'http://10.0.0.5/push/x', p256dh: mkDevice('y').p256dh, auth: B64(devices.y.auth) });
  const s1 = await api(UB.token, 'rtcPushSave', mkDevice('bala-phone')), s2 = await api(UB.token, 'rtcPushSave', Object.assign(mkDevice('gone'), {}));
  ok('the site\'s public key is given (65 bytes, the same each time); Bala\'s device is saved; an address that is not a push service is refused (no calling other servers)',
    Buffer.from(key, 'base64url').length === 65 && key === (await api(UB.token, 'rtcPushKey', {})).result.key && s1.result && s2.result && s2.result.devices === 2 && /not a known push service/.test(evil.error || '') && /not a known push service/.test(lan.error || ''), { key: key.slice(0, 12) + '…', s1: s1.result, evil: evil.error, lan: lan.error });

  // ---------- 2. Sujit rings Bala (whose app is closed): the notification goes out – signed, encrypted, readable only by Bala's device ----------
  // notifications need the FULL Chromium (the small "headless shell" refuses every notification); it is used when the rig has it
  const FULL = process.env.RCL_FULL_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', full = require('fs').existsSync(FULL);
  if (!full) out.push('NOTE the full Chromium is not on this computer – the notification part runs in the headless shell (it refuses notifications)');
  const b = await puppeteer.launch({ executablePath: full ? FULL : await chromium.executablePath(), headless: full ? true : 'shell', protocolTimeout: 120000,
    args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.createBrowserContext(); await ctx.overridePermissions(BASE, ['notifications']);
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  await p.setViewport({ width: 1366, height: 860 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1500);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('rcl_np_no', '1'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
  await f.evaluate(() => { const l = document.getElementById('rtc_list'); if (l) l.remove(); document.getElementById('u_share').click(); });
  await until(() => f.evaluate(() => !!document.querySelector('#rtc_list')), 8000);
  await f.evaluate(() => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === 'P75 Bala'); const c = l.querySelector('input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('cf_ok').click(); });
  const ring = await until(() => got.find(x => x.id === 'bala-phone' && x.msg && x.msg.t === 'ring'), 15000);
  const gone = got.find(x => x.id === 'gone');
  ok('Sujit rings Bala: Bala\'s device gets "ring – Sujit" – signed by the site (ES256, for this push service, valid ≤ 12 h), encrypted so that only Bala\'s browser can read it, urgent, kept only 75 s',
    !!ring && ring.msg.name === 'Sujit' && /^c/.test(ring.msg.call) && ring.sig.ok && ring.sig.alg === 'ES256' && ring.sig.aud === PUSH && ring.sig.exp > 0 && ring.sig.exp <= 12 * 3600 && ring.sig.k === key && ring.h['content-encoding'] === 'aes128gcm' && ring.h.urgency === 'high' && ring.h.ttl === '75',
    ring ? { msg: ring.msg, sig: ring.sig, enc: ring.h['content-encoding'], urgency: ring.h.urgency, ttl: ring.h.ttl } : got.map(x => x.id + ':' + (x.err || '')));
  await wait(1500);
  const left = sql("select value from app_settings where id like 'PUSH|%'");
  ok('   the device the push service called gone (410) is forgotten by itself; Bala\'s phone stays', !!gone && /bala-phone/.test(left) && !/\/push\/gone/.test(left), left.slice(0, 200));
  // Sujit gives up → "missed"
  await f.evaluate(() => document.getElementById('rtc_end').click());
  const missed = await until(() => got.find(x => x.id === 'bala-phone' && x.msg && x.msg.t === 'missed'), 10000);
  ok('   Sujit gives up: Bala\'s device gets "missed – Sujit" (kept an hour)', !!missed && missed.msg.name === 'Sujit' && missed.h.ttl === '3600', missed ? missed.msg : null);
  // Bala signs out on that device → it is not his any more
  await api(UB.token, 'rtcPushOff', { endpoint: PUSH + '/push/bala-phone' });
  ok('   signed out there (the app tells the server): the device is not Bala\'s any more', !/bala-phone/.test(sql("select coalesce(string_agg(value, ' '), '') from app_settings where id like 'PUSH|%'")));

  // ---------- 3. the app's service worker shows the notification; a tap reaches the open app ----------
  const cdp = await p.target().createCDPSession(); let regId = '';
  cdp.on('ServiceWorker.workerRegistrationUpdated', e => { (e.registrations || []).forEach(r => { if (r.scopeURL.startsWith(BASE) && !r.isDeleted) regId = r.registrationId; }); });
  await cdp.send('ServiceWorker.enable'); await until(() => regId, 8000);
  await p.evaluate(() => { window.__sw = []; navigator.serviceWorker.addEventListener('message', e => window.__sw.push(e.data)); });
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: BASE, registrationId: regId, data: JSON.stringify({ t: 'ring', call: 'c9test', name: 'P75 Bala', help: 1, page: 'Log Book' }) });
  const notes = await until(async () => { const n = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(x => ({ title: x.title, body: x.body, tag: x.tag, stay: x.requireInteraction }))); return n.length ? n : null; }, 8000) || [];
  ok('the service worker gets the push and shows "P75 Bala wants to show you a screen" – "Needs help – Log Book. … tap to open the app and answer" – it stays until tapped', notes.length === 1 && notes[0].title === 'P75 Bala wants to show you a screen' && /^Needs help – Log Book\. Screen share with voice – tap to open the app and answer\.$/.test(notes[0].body) && notes[0].tag === 'rtc-c9test' && notes[0].stay === true, notes);
  const swT = await b.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith(BASE) && t.browserContext() === ctx, { timeout: 8000 }).catch(() => null);
  if (swT) { const w = await swT.worker(); await w.evaluate(async () => { const ns = await self.registration.getNotifications(); try { self.dispatchEvent(new NotificationEvent('notificationclick', { notification: ns[0] })); } catch (e) { /* (a made-up event cannot wait – what matters happens before) */ } }).catch(() => {}); }
  const msg = await until(() => p.evaluate(() => window.__sw.find(x => x && x.rtcOpen)), 6000);
  const after = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length);
  ok('   a tap on it: the notification closes and the open app is told to look for the ring at once', !!msg && msg.rtcOpen === 'c9test' && after === 0, { msg, left: after });
  // Settings: the line for this device
  await f.evaluate(() => document.getElementById('tab-settings').click()); await wait(1500);
  const np = await f.evaluate(() => ({ state: document.getElementById('np_state').textContent, msg: document.getElementById('np_msg').textContent, btn: !document.getElementById('np_on').hidden }));
  ok('Settings → This app: "Screen share calls when the app is closed: Off on this device – Turn on" (this test browser cannot reach a real push service, so it stays off here)', /Off on this device/.test(np.state) && np.btn, np);

  ok('no script error on the page', !errs.length, errs);
  await b.close(); srv.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} srv.close(); process.exit(1); });
