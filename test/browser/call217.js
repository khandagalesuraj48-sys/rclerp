// update-217 (asked 09-11-2026: "both user same site war asayla lagtat tr as nko user online asla ki bas zal call lawta yeil mgg to
// kuthe pn aso"): a call between users of TWO sites. Hari is a user of the first site only (S1), Kiran of the second only (T2).
//   The server (by the API): each sees the other on his list with the other's site; a ring of one reaches the other's heartbeat at
//   his own site; answer, "who is at the app", missed calls kept at the first site; T2's own store holds no note of a call.
//   Real browsers (two sign-ins, two sites): Hari's list shows Kiran (Test Site T2) while he is at the app; Hari shares his screen,
//   Kiran's page (at T2) rings with "Hari Home (VTR Site – NH 848)", he accepts, sees the screen and they hear each other.
// Only on the local rig (test values, its own test databases); everything it adds is taken away after.   node call217.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), crypto = require('crypto');
const wait = ms => new Promise(r => setTimeout(r, ms)), sql = (db, q) => execSync('timeout 20 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port, PW = 'Nashik#Road848!';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const HE = 'c217hari@rcl.test', KE = 'c217kiran@rcl.test', LE = 'c217lata@rcl.test', uid = e => crypto.createHash('sha256').update('rtc|' + e).digest('hex').slice(0, 16);
const clean = () => {
  for (const db of ['rcl', 'rcl_s2']) sql(db, "delete from app_users where email like 'c217%@rcl.test'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'RTC%' or key = 'USERS_LIST'; delete from app_settings where id in ('RTCMISS|" + uid(HE) + "', 'RTCMISS|" + uid(KE) + "', 'RTCMISS|" + uid(LE) + "', 'RTCMISS|" + uid('sujit@rcl.test') + "');");
  sql('rcl', "delete from rcl_user_sites where email like 'c217%@rcl.test';");
};
const raw = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json(); } catch (e) { if (i > 2) throw e; await wait(800); } } };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  // two people, each of ONE site only (the password of the rig's test user)
  sql('rcl', "insert into app_users (id,email,password_hash,name,active,admin,perm_dashboard,perm_log_book) select '" + HE + "','" + HE + "',password_hash,'Hari Home','Yes','No','View','View' from app_users where email='sujit@rcl.test'; insert into rcl_user_sites (email, site) values ('" + HE + "', 'S1');");
  sql('rcl_s2', "insert into app_users (id,email,password_hash,name,active,admin,perm_dashboard,perm_log_book) select '" + KE + "','" + KE + "',password_hash,'Kiran Far','Yes','No','View','View' from app_users where email='sujit@rcl.test';");
  sql('rcl_s2', "insert into app_users (id,email,password_hash,name,active,admin,perm_dashboard,perm_log_book) select '" + LE + "','" + LE + "',password_hash,'Lata Far','Yes','No','View','View' from app_users where email='sujit@rcl.test';");
  sql('rcl', "insert into rcl_user_sites (email, site) values ('" + KE + "', 'T2'), ('" + LE + "', 'T2');");
  const H = (await raw({ fn: 'login', args: [HE, PW] })).result, K = (await raw({ fn: 'login', args: [KE, PW] })).result;
  ok('Hari signs in at the first site (S1), Kiran at the second (T2)', H && K && H.site === 'S1' && K.site === 'T2', { H: H && H.site, K: K && K.site });
  const api = async (who, fn, ...a) => { const x = await raw({ fn: 'api', args: [who.token, fn, a], site: who.site }); return x.error ? { ERROR: x.error } : x.result; };
  const beat = async (who, r) => { const x = await api(who, 'sync', r === undefined ? {} : { r: r }); return x && x.rtc; };

  // ---------- 1. the server: the lists, a ring each way, answer, who, missed ----------
  const lk = await api(K, 'rtcUsers'), lh = await api(H, 'rtcUsers');
  const kh = (lk.users || []).find(u => u.uid === uid(HE)), hk = (lh.users || []).find(u => u.uid === uid(KE));
  ok('Kiran\'s list (T2) has Hari "Hari Home (VTR Site – NH 848)" as one of another site; Hari\'s list has "Kiran Far (Test Site T2)"; no e-mail address',
    kh && kh.far && kh.name === 'Hari Home (VTR Site – NH 848)' && hk && hk.far && hk.name === 'Kiran Far (Test Site T2)' && !/@/.test(JSON.stringify([lk, lh])), { kh, hk });
  const k0 = await beat(K), h0 = await beat(H);
  let r = await api(H, 'rtcSend', { t: 'ring', to: [uid(KE)], call: 'c217a', d: { sdp: 'v=0 rig', mode: 'voice' } });
  ok('Hari (S1) rings Kiran (T2)', r && r.ok && r.n > 0, r);
  let kb = null; for (let i = 0; i < 6 && !(kb && kb.m && kb.m.length); i++) { kb = await beat(K, k0.r); if (!(kb && kb.m && kb.m.length)) await wait(700); }
  ok('… Kiran\'s heartbeat at T2 gets the ring, named "Hari Home (VTR Site – NH 848)"', kb && kb.m.some(m => m.t === 'ring' && m.call === 'c217a' && m.name === 'Hari Home (VTR Site – NH 848)' && JSON.parse(m.d).sdp === 'v=0 rig'), kb);
  r = await api(K, 'rtcSend', { t: 'answer', to: uid(HE), call: 'c217a', d: { sdp: 'v=0 answer' } });
  ok('Kiran answers Hari (who is not a user of T2)', r && r.ok, r);
  let hb = null; for (let i = 0; i < 6 && !(hb && hb.m && hb.m.length); i++) { hb = await beat(H, h0.r); if (!(hb && hb.m && hb.m.length)) await wait(700); }
  ok('… Hari\'s heartbeat at S1 gets the answer, named "Kiran Far (Test Site T2)"', hb && hb.m.some(m => m.t === 'answer' && m.name === 'Kiran Far (Test Site T2)'), hb);
  const h1 = hb.r, k1 = kb.r;
  r = await api(K, 'rtcSend', { t: 'ring', to: [uid(HE)], call: 'c217b', d: { sdp: 'v=0 back' } });
  ok('Kiran (T2) rings Hari (S1) – the note is written at the first site from T2', r && r.ok && r.n > h1, r);
  hb = null; for (let i = 0; i < 6 && !(hb && hb.m && hb.m.length); i++) { hb = await beat(H, h1); if (!(hb && hb.m && hb.m.length)) await wait(700); }
  ok('… Hari\'s heartbeat at S1 gets it, named "Kiran Far (Test Site T2)"', hb && hb.m.some(m => m.t === 'ring' && m.call === 'c217b' && m.name === 'Kiran Far (Test Site T2)'), hb);
  r = await api(K, 'rtcSend', { t: 'cancel', to: [uid(HE)], call: 'c217b', d: {} });
  const ms = await api(H, 'rtcMissed');
  ok('Kiran gives up: Hari\'s missed calls (S1) show "Kiran Far (Test Site T2)" with Call back', r && r.ok && ms && ms.list.some(m => m.call === 'c217b' && m.name === 'Kiran Far (Test Site T2)' && m.can), ms);
  r = await api(K, 'rtcSend', { t: 'who' });
  hb = null; for (let i = 0; i < 6 && !(hb && hb.m && hb.m.some(m => m.t === 'who')); i++) { hb = await beat(H, h1); if (!(hb && hb.m && hb.m.some(m => m.t === 'who'))) await wait(700); }
  ok('"Who is at the app?" of Kiran (T2) reaches Hari (S1); Hari\'s "I am" goes back', hb && hb.m.some(m => m.t === 'who' && m.from === uid(KE)) && (await api(H, 'rtcSend', { t: 'here', to: [uid(KE)], d: { busy: false } })).ok);
  ok('T2\'s own store holds no note of a call (all at the first site); the first site\'s counter moved', sql('rcl_s2', "select count(*) from web.cache where key like 'RTCM\\_%'") === '0' && Number(sql('rcl', "select count(*) from web.cache where key like 'RTCM\\_%'")) >= 5);
  ok('Kiran\'s missed-call list is kept at the first site', sql('rcl', "select count(*) from app_settings where id = 'RTCMISS|" + uid(KE) + "'") === '1' && sql('rcl_s2', "select count(*) from app_settings where id = 'RTCMISS|" + uid(KE) + "'") === '0');
  // the same site, as before: Kiran rings Lata (both T2 – through the first site's store now); Hari rings Sujit (both S1 – its own store)
  const L = (await raw({ fn: 'login', args: [LE, PW] })).result, SJ0 = (await raw({ fn: 'login', args: ['sujit@rcl.test', PW] })).result;
  const SJ = SJ0.site === 'S1' ? SJ0 : Object.assign({}, SJ0, (await raw({ fn: 'switchSite', args: [SJ0.token, 'S1'] })).result, { site: 'S1' });
  const l0 = await beat(L), s0 = await beat(SJ);
  r = await api(K, 'rtcSend', { t: 'ring', to: [uid(LE)], call: 'c217c', d: { sdp: 'same' } });
  let lb = null; for (let i = 0; i < 6 && !(lb && lb.m && lb.m.length); i++) { lb = await beat(L, l0.r); if (!(lb && lb.m && lb.m.length)) await wait(700); }
  ok('the same site (T2): Kiran rings Lata – she gets it, named "Kiran Far" (no site: her own)', r && r.ok && lb && lb.m.some(m => m.t === 'ring' && m.call === 'c217c' && m.name === 'Kiran Far'), lb);
  r = await api(H, 'rtcSend', { t: 'ring', to: [uid('sujit@rcl.test')], call: 'c217d', d: { sdp: 'same' } });
  let sb = null; for (let i = 0; i < 6 && !(sb && sb.m && sb.m.some(m => m.call === 'c217d')); i++) { sb = await beat(SJ, s0.r); if (!(sb && sb.m && sb.m.some(m => m.call === 'c217d'))) await wait(700); }
  ok('the same site (S1, the first site): Hari rings Sujit – he gets it, named "Hari Home"', r && r.ok && sb && sb.m.some(m => m.t === 'ring' && m.call === 'c217d' && m.name === 'Hari Home'), sb);
  await api(K, 'rtcSend', { t: 'cancel', to: [uid(LE)], call: 'c217c', d: {} }); await api(H, 'rtcSend', { t: 'cancel', to: [uid('sujit@rcl.test')], call: 'c217d', d: {} });
  // a heartbeat of T2 that has nothing new: answered quickly (the first site's counter is kept a second)
  let t0 = Date.now(); for (let i = 0; i < 10; i++) await beat(K, (await beat(K)).r); const per = Math.round((Date.now() - t0) / 20);
  ok('a heartbeat at T2 stays quick (' + per + ' ms each)', per < 400, per);

  // ---------- 2. real browsers: Hari (S1) shares his screen with Kiran (T2) ----------
  sql('rcl', "delete from web.cache where key like 'LG\\_%' or key like 'F\\_%'"); sql('rcl_s2', "delete from web.cache where key like 'LG\\_%' or key like 'F\\_%'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000,
    args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const session = async email => { const ctx = await b.createBrowserContext(), errs = [];
    await ctx.overridePermissions(BASE, ['geolocation', 'microphone', 'camera']); const p = await ctx.newPage(); await p.setGeolocation({ latitude: 18.52, longitude: 73.85 });      // (the app opens only with the location)
    p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
    await p.setViewport({ width: 1536, height: 900 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame()) || p.mainFrame(); await f.waitForSelector('#lg_email', { visible: true, timeout: 30000 });
    await f.evaluate(e => { try { localStorage.setItem('oc_brief_' + e, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (er) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(6000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    return { p, f, errs, ctx }; };
  const A = await session(HE), B = await session(KE);
  const st = X => X.f.evaluate(async () => { const C = RTC.call, v = document.getElementById('rtc_video'), vis = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
    const stats = async kind => { let n = 0; if (C) for (const P of C.peers.values()) { try { (await P.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === kind) n += r.packetsReceived || 0; }); } catch (e) {} } return n; };
    return { site: S.site || (S.org && S.org.site) || '', call: C ? { peers: [...C.peers.values()].map(P => P.name + ':' + P.state + (P.up ? ':up' : '')) } : null, inBox: vis('rtc_in') ? document.getElementById('rtc_in_t').textContent : '',
      bar: vis('rtc_bar') ? document.getElementById('rtc_bar').textContent.replace(/\s+/g, ' ').trim() : '', view: vis('rtc_view') ? { title: document.getElementById('rtc_vt').textContent, w: v.videoWidth } : null, aIn: await stats('audio'), vIn: await stats('video') }; });
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
  const click = (X, sel) => X.f.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const rows = X => X.f.evaluate(() => [...document.querySelectorAll('#rtc_list .rtc-u')].map(l => ({ name: l.querySelector('b').textContent, st: l.querySelector('.rtc-st').textContent, shown: !l.hidden && l.offsetParent !== null })));
  await click(A, '#u_share'); await until(() => A.f.evaluate(() => !!RTC.pick && !!document.querySelector('#rtc_list')), 8000);
  const r0 = await rows(A);
  const r1 = await until(async () => { const l = await rows(A); const k = l.find(x => x.name === 'Kiran Far (Test Site T2)'); return k && k.shown && /at the app now/.test(k.st) ? l : null; }, 15000) || await rows(A);
  const note = await A.f.evaluate(() => /Users of the other sites are shown here while they are at the app/.test(document.getElementById('cf_back').textContent));
  ok('Hari\'s list (S1): "Kiran Far (Test Site T2)" appears once Kiran answers "at the app now"; the list says so', !!r1.find(x => x.name === 'Kiran Far (Test Site T2)' && x.shown) && note, { before: r0, after: r1 });
  await A.p.screenshot({ path: '/home/claude/test/shots/call217_list.png' });
  await A.f.evaluate(() => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === 'Kiran Far (Test Site T2)'); const c = l.querySelector('input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await A.f.evaluate(() => document.getElementById('cf_ok').click());
  let bb = await until(async () => { const s = await st(B); return s.inBox ? s : null; }, 15000);
  ok('Kiran\'s page (T2) rings: "Hari Home (VTR Site – NH 848) wants to show you a screen"', bb && /Hari Home \(VTR Site – NH 848\) wants to show you a screen/.test(bb.inBox), bb && bb.inBox);
  await B.p.screenshot({ path: '/home/claude/test/shots/call217_ring.png' });
  await click(B, '#rtc_yes');
  bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 && s.vIn > 0 && s.aIn > 0 ? s : null; }, 30000) || await st(B);
  const a = await until(async () => { const s = await st(A); return s.call && s.call.peers.some(x => /:up/.test(x)) && s.aIn > 0 ? s : null; }, 15000) || await st(A);
  ok('Kiran accepts: he SEES Hari\'s screen and HEARS him; Hari hears Kiran – across the two sites', !!bb.view && bb.view.w > 100 && bb.aIn > 0 && bb.vIn > 0 && a.aIn > 0, { B: bb, A: a });
  await wait(800); await B.p.screenshot({ path: '/home/claude/test/shots/call217_view.png' });
  await click(A, '#rtc_end'); await wait(1500);
  ok('no script error on either page', !A.errs.length && !B.errs.length, [A.errs, B.errs]);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
