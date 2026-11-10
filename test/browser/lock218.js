// update-218 (asked for web security; he chose "अ – Web lock (शिफारस)", 10-11-2026: 10 minutes) – the web lock in a real browser on the
// local rig (test values, its own test databases; everything it adds is taken away after). Mechanical started with the rig-only
// shorter time RCL_RIG_LOCK_MS=20000 (never on Vercel): :PLAIN its own sign-in, :LINKED linked to the Portal :3010.
// A passkey needs a NAME as address (WebAuthn refuses 127.0.0.1), so the page is opened at http://localhost:PLAIN; the device's
// fingerprint / face / PIN is Chrome's virtual authenticator (DevTools protocol: WebAuthn.addVirtualAuthenticator, user verification
// on) – every registration and every unlock is checked by the server itself.
//   node lock218.js [plain port – 3061] [linked port – 3060]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), crypto = require('crypto');
const wait = ms => new Promise(r => setTimeout(r, ms)), sql = (db, q) => execSync('timeout 20 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const PLAIN = process.argv[2] || '3061', LINKED = process.argv[3] || '3060', BASE = 'http://localhost:' + PLAIN, PW = 'Nashik#Road848!', E = 'l218@rcl.test', P = 'http://127.0.0.1:3010';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => {
  sql('rcl', "delete from app_users where email = '" + E + "'; delete from rcl_user_sites where email = '" + E + "'; delete from app_settings where id = 'WL_PK|" + E + "' or id = 'USER_PREFS|" + E + "';" +
    " delete from web.cache where (key like 'S\\_%' and value like '" + E + "|%') or key like 'WLF\\_%' or key like 'WLC\\_%' or key like 'WLCU\\_%' or key like 'LG\\_%' or key like 'F\\_%' or key = 'USERS_LIST'; delete from activity_log where email = '" + E + "';");
};
const rpc = async (port, body) => { const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }); return Object.assign({ status: r.status }, await r.json()); };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  sql('rcl', "insert into app_users (id,email,password_hash,name,active,admin,perm_dashboard,perm_diesel_issue,perm_log_book) select '" + E + "','" + E + "',password_hash,'Lata Lock','Yes','No','View','Edit','View' from app_users where email='sujit@rcl.test'; insert into rcl_user_sites (email, site) values ('" + E + "', 'S1');");

  // ---------- 0. the Portal's password (a sign-in that came from the Portal: :LINKED) – by the server's own door ----------
  {
    const r = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sujit@rcl.test', password: PW }) });
    const ck = (r.headers.get('set-cookie') || '').split(';')[0];
    const g = await (await fetch(P + '/api/go?module=mechanical&site=S1&json=1', { headers: { Cookie: ck, 'X-RCL': '1' } })).json();
    const s = await rpc(LINKED, { fn: 'ssoLogin', args: [g.ticket] }), t = s.result && s.result.token;
    const api = (fn, a, act) => rpc(LINKED, Object.assign({ fn: 'api', args: [t, fn, a === undefined ? [] : [a]], site: 'S1' }, act === undefined ? {} : { act: act }));
    await api('getInit', undefined, 0);
    const st = (await api('lockState', undefined, 0)).result, lk = await api('lockNow', undefined, 0), ref = await api('getInit', undefined, 0);
    const a0 = sql('rcl_portal', "select now()");
    const wrong = await api('unlockPassword', { password: 'Wrong#Pass218' }), right = await api('unlockPassword', { password: PW });
    const lines = sql('rcl_portal', "select string_agg(action, ',' order by at) from audit where actor = 'sujit@rcl.test' and at >= '" + a0 + "'");
    ok('a Portal sign-in (:' + LINKED + '): locked → refused (423); its password is checked BY THE PORTAL – a wrong one counted ("4 tries left"), the right one opens; the Portal\'s own sign-in made for the check is ended at once',
      st && st.portal === true && lk.result && lk.result.locked && ref.status === 423 && /^SCREEN_LOCKED/.test(ref.error) && /^Wrong password – 4 tries left/.test(wrong.error || '') && right.result && right.result.ok && /Login failed.*,Login,.*Logout/.test(lines || ''),
      { st, ref: ref.status, wrong: wrong.error, right, lines });
    await rpc(LINKED, { fn: 'logout', args: [t] }); await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1', Cookie: ck }, body: '{"action":"logout"}' });
  }

  // ---------- 1. the browser: sign in, set up the fingerprint / face / PIN in My settings ----------
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000, args: [...chromium.args, '--no-sandbox'] });
  const ctx = await b.createBrowserContext(); await ctx.overridePermissions(BASE, ['geolocation']);
  const errs = [];
  const open = async () => { const p = await ctx.newPage(); await p.setGeolocation({ latitude: 18.52, longitude: 73.85 }); await p.setViewport({ width: 1440, height: 900 });
    p.on('pageerror', e => { if (!/Credential Management|public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
    await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1500); return p; };
  const frameOf = p => p.frames().find(x => x !== p.mainFrame() && /srcdoc/.test(x.url())) || p.frames().find(x => x !== p.mainFrame());
  const A = await open(); let f = frameOf(A);
  const cdp = await A.createCDPSession(); await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await f.waitForSelector('#lg_email', { visible: true, timeout: 30000 });
  await f.evaluate(e => { try { localStorage.setItem('oc_brief_' + e, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (er) {} }, E);
  await f.type('#lg_email', E); await f.type('#lg_pass', PW); await f.evaluate(() => { document.getElementById('lg_remember').checked = true; }); await f.click('#lg_btn');      // ("Remember me": the sign-in is kept for every tab of this browser)
  await f.waitForFunction(() => typeof S !== 'undefined' && S.user && S.user.email && document.getElementById('login_screen').hidden, { timeout: 30000 }); await wait(1500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} prefSet({ appLang: 'en', lang: 'en' }); }); await wait(1500);      // (his language: English, for the words checked below – the panel is in 3 languages)
  const ms = await f.evaluate(() => WL.ms);
  ok('signed in with the password; the lock time comes from the server (the rig\'s 20 s here – 10 minutes everywhere else)', ms === 20000, ms);
  await f.evaluate(() => document.getElementById('tab-settings').click()); await f.waitForFunction(() => !document.getElementById('wl_set_add').hidden, { timeout: 15000 });
  const s0 = await f.evaluate(() => ({ h: document.getElementById('wl_set_h').textContent, st: document.getElementById('wl_set_state').textContent, devs: document.getElementById('wl_devs').textContent }));
  await f.evaluate(() => document.getElementById('wl_set_add').click());
  await f.waitForFunction(() => /Done/.test(document.getElementById('wl_set_msg').textContent) || /bad/.test(document.getElementById('wl_set_msg').className), { timeout: 20000 });
  const s1 = await f.evaluate(() => ({ msg: document.getElementById('wl_set_msg').textContent, st: document.getElementById('wl_set_state').textContent, devs: [...document.querySelectorAll('#wl_devs .wl-dev')].map(d => d.textContent), local: localStorage.getItem('rcl_wl_pk') }));
  const kept = sql('rcl', "select value from app_settings where id = 'WL_PK|" + E + "'"), kl = JSON.parse(kept || '[]');
  const vcred = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials;
  ok('My settings → Screen lock: "Set up on this device" makes a passkey (virtual authenticator) that the SERVER checked and keeps: the first site\'s app_settings "WL_PK|<email>" (' + kept.length + ' bytes); listed as "This device" with the date',
    /Not set up/.test(s0.st) && /Done/.test(s1.msg) && /Set up on this device ✔/.test(s1.st) && s1.devs.length === 1 && /This device/.test(s1.devs[0]) && /Added \d\d-\d\d-\d{4}/.test(s1.devs[0]) &&
      kl.length === 1 && kl[0].alg === -7 && kl[0].k && kl[0].k.kty === 'EC' && vcred.length === 1 && Buffer.from(vcred[0].credentialId, 'base64').toString('base64url') === kl[0].id, { s0, s1, kept: kept.slice(0, 120), vcred: vcred.length });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('set_lock').scrollIntoView({ block: 'center' }); }); await wait(400);
  await A.screenshot({ path: '/home/claude/test/shots/lock218_settings.png' });

  // ---------- 2. idle → locked; data hidden; the server refuses; nothing typed is lost; a module's page inside is covered ----------
  await f.evaluate(() => document.getElementById('tab-diesel').click()); await wait(1500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} const r = document.getElementById('d_remark'); r.focus(); });
  await f.type('#d_remark', 'Typed before the lock 218');
  // a module's page shown inside this screen (as the Store's is at the one address): a page of this same address in the module frame
  await f.evaluate(() => { const m = { key: 'store', name: 'Store', url: location.origin + '/app' }; PT.mods = PT.mods.filter(x => x.key !== 'store').concat([m]);
    const fr = extFrame(m, ''); fr.src = '/app?embed=1'; });
  await f.waitForFunction(() => { const fr = document.getElementById('ext_store'); try { return fr && fr.contentDocument && fr.contentDocument.readyState === 'complete' && fr.contentWindow.location.pathname === '/app'; } catch (e) { return false; } }, { timeout: 15000 });
  await wait(500);
  // a touch inside the module's page counts: kept touching it there for 26 s (longer than the 20 s) – not locked
  const mf = A.frames().find(x => /\/app\?embed=1/.test(x.url()));
  for (let i = 0; i < 9; i++) { await mf.evaluate(() => window.dispatchEvent(new Event('pointermove'))); await wait(3000); }
  const still = await f.evaluate(() => WL.on);
  ok('a touch inside a module\'s page (same address, in the screen) counts: 27 s of moving the mouse there only – not locked', still === false && !!mf, still);
  await f.evaluate(() => { document.getElementById('d_remark').focus(); });
  // show the module page in the middle for the "covered" check, the diesel form stays typed behind it
  await f.evaluate(() => { document.getElementById('sec-ext').hidden = false; const fr = document.getElementById('ext_store'); fr.hidden = false; fr.style.height = '300px'; document.getElementById('sec-ext').style.height = '320px'; });
  const t0 = Date.now();
  await f.waitForFunction(() => WL.on, { timeout: 40000 }).catch(() => {});
  const lk = await f.evaluate(() => { const l = document.getElementById('wl_lock'), fr = document.getElementById('ext_store').getBoundingClientRect(), app = document.querySelector('.app');
    const at = document.elementFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2), mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return { on: WL.on, shown: !l.hidden && getComputedStyle(l).display !== 'none', z: getComputedStyle(l).zIndex, covers: !!(at && at.closest('#wl_lock')), mid: !!(mid && mid.closest('#wl_lock')),
      appHidden: getComputedStyle(app).visibility === 'hidden', inert: app.inert === true, frameHidden: getComputedStyle(document.getElementById('ext_store')).visibility === 'hidden',
      name: document.getElementById('wl_name').textContent, site: document.getElementById('wl_site').textContent, when: document.getElementById('wl_when').textContent, title: document.getElementById('wl_t').textContent,
      pk: !document.getElementById('wl_pk').hidden, out: document.getElementById('wl_out').textContent, token: S.token, flag: localStorage.getItem('rcl_wl') }; });
  ok('20 s untouched → LOCKED (after ' + Math.round((Date.now() - t0) / 1000) + ' s): the panel covers the whole screen – also the module\'s page – the app behind is hidden and cannot be reached (inert); his name, the site, the time; "Unlock with fingerprint / face / PIN" (this device has one), password, Sign out',
    lk.on && lk.shown && lk.covers && lk.mid && lk.appHidden && lk.inert && lk.frameHidden && lk.name === 'Lata Lock' && lk.site && /^Locked at \d\d:\d\d$/.test(lk.when) && lk.title === 'Screen locked' && lk.pk && lk.out === 'Sign out' && /"at"/.test(lk.flag || ''), lk);
  await A.screenshot({ path: '/home/claude/test/shots/lock218_locked.png' });
  // the server refuses a data call of this sign-in – also one that claims "just touched" – the panel taken away in the browser's tools gives nothing
  await wait(1500);
  const r1 = await rpc(PLAIN, { fn: 'api', args: [lk.token, 'getInit', []], site: 'S1' }), r2 = await rpc(PLAIN, { fn: 'api', args: [lk.token, 'getDashboard', []], site: 'S1', act: 0 });
  await f.evaluate(() => { const l = document.getElementById('wl_lock'); l.dataset.was = '1'; l.hidden = true; document.body.classList.remove('wl-on'); window.__t218 = 'waiting'; rawCall('getInit').then(d => { window.__t218 = d && d.user ? 'GOT DATA' : 'answer'; }, e => { window.__t218 = 'refused'; }); });
  await wait(3500);
  const got = await f.evaluate(() => window.__t218);
  await f.evaluate(() => { const l = document.getElementById('wl_lock'); l.hidden = false; document.body.classList.add('wl-on'); });
  ok('locked: the SERVER refuses the sign-in\'s data calls (HTTP 423 SCREEN_LOCKED), also one sent with "touched 0 ms ago"; with the panel removed by hand the page\'s own call gets NO data (it waits for the unlock)',
    r1.status === 423 && /^SCREEN_LOCKED/.test(r1.error) && !r1.result && r2.status === 423 && /^SCREEN_LOCKED/.test(r2.error) && got === 'waiting', { r1, r2, got });
  // a wrong password: said clearly; the right one: open, where he was, nothing typed lost; the waiting call answered
  await f.evaluate(() => { document.getElementById('wl_pw').value = 'Wrong#Pass218'; document.getElementById('wl_go').click(); });
  await f.waitForFunction(() => /Wrong password/.test(document.getElementById('wl_msg').textContent), { timeout: 20000 }).catch(() => {});
  const wr = await f.evaluate(() => ({ msg: document.getElementById('wl_msg').textContent, on: WL.on }));
  ok('a wrong password: "Wrong password – tries left: 4, then you are signed out." – still locked', /Wrong password – tries left: 4,/.test(wr.msg) && wr.on, wr);
  await f.evaluate(pw => { document.getElementById('wl_pw').value = pw; document.getElementById('wl_go').click(); }, PW);
  await f.waitForFunction(() => !WL.on, { timeout: 20000 }).catch(() => {}); await wait(1500);
  const op = await f.evaluate(() => ({ on: WL.on, shown: !document.getElementById('wl_lock').hidden, remark: document.getElementById('d_remark').value, focus: document.activeElement && document.activeElement.id,
    tab: S.curTab, inert: document.querySelector('.app').inert, vis: getComputedStyle(document.querySelector('.app')).visibility, frame: !!document.getElementById('ext_store'), waited: window.__t218 }));
  const r3 = await rpc(PLAIN, { fn: 'api', args: [lk.token, 'whoami', []], site: 'S1', act: 0 });
  ok('the right password opens it: everything back as it was – the same page (Diesel Issue), "Typed before the lock 218" still in its box with the cursor in it, the module\'s page still there; the call that waited got its answer; the server answers again',
    !op.on && !op.shown && op.remark === 'Typed before the lock 218' && op.focus === 'd_remark' && op.tab === 'diesel' && !op.inert && op.vis === 'visible' && op.frame && op.waited === 'GOT DATA' && r3.result === true, { op, r3 });
  await A.screenshot({ path: '/home/claude/test/shots/lock218_open.png' });

  // ---------- 3. the computer wakes up after longer: the first touch locks (it is not counted) ----------
  await f.evaluate(() => { WL.last = Date.now() - 60000; localStorage.setItem(KK('rcl_wl_act'), String(WL.last)); window.dispatchEvent(new Event('pointerdown')); });
  await wait(400);
  const wk = await f.evaluate(() => WL.on);
  ok('woken up after longer than the time: the first touch LOCKS the screen (it is not taken as "in use")', wk === true, wk);

  // ---------- 4. unlock with the fingerprint / face / PIN (the virtual authenticator); a wrong passkey is refused ----------
  // another passkey on the same device, not his (made outside the ERP): the server refuses it
  const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }), otherId = crypto.randomBytes(32);
  await cdp.send('WebAuthn.addCredential', { authenticatorId, credential: { credentialId: otherId.toString('base64'), isResidentCredential: false, rpId: 'localhost', privateKey: other.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), signCount: 0 } });
  const wrongPk = await f.evaluate(async oid => {
    const o = await wlAsk('unlockPasskeyStart');
    const c = await navigator.credentials.get({ publicKey: { challenge: wlBuf(o.challenge), rpId: o.rpId, allowCredentials: [{ type: 'public-key', id: wlBuf(oid) }], userVerification: 'required' } });
    try { await wlAsk('unlockPasskey', { id: c.id, clientDataJSON: wlStr(c.response.clientDataJSON), authenticatorData: wlStr(c.response.authenticatorData), signature: wlStr(c.response.signature) }); return 'OPENED'; } catch (e) { return errMsg(e); } }, otherId.toString('base64url'));
  // his own passkey's answer with a changed signature: refused too
  const badSig = await f.evaluate(async () => {
    const o = await wlAsk('unlockPasskeyStart');
    const c = await navigator.credentials.get({ publicKey: { challenge: wlBuf(o.challenge), rpId: o.rpId, allowCredentials: o.allowCredentials.map(x => ({ type: 'public-key', id: wlBuf(x.id) })), userVerification: 'required' } });
    const sig = new Uint8Array(c.response.signature.slice(0)); sig[sig.length - 3] ^= 0x55;
    try { await wlAsk('unlockPasskey', { id: c.id, clientDataJSON: wlStr(c.response.clientDataJSON), authenticatorData: wlStr(c.response.authenticatorData), signature: wlStr(sig.buffer) }); return 'OPENED'; } catch (e) { return errMsg(e); } });
  const stillOn = await f.evaluate(() => WL.on);
  ok('a WRONG passkey is refused by the server: another credential of this device ("not set up for you"), and his own with a changed signature ("signature does not match") – still locked',
    /not set up for you/.test(wrongPk) && /signature does not match/.test(badSig) && stillOn, { wrongPk, badSig, stillOn });
  const n0 = JSON.parse(sql('rcl', "select value from app_settings where id = 'WL_PK|" + E + "'"))[0].n;
  await f.evaluate(() => { WL.pf = null; document.getElementById('wl_pk').click(); });      // (the two tries above asked their own requests: the one the page had fetched beforehand is not the last any more)
  await f.waitForFunction(() => !WL.on, { timeout: 20000 }).catch(() => {}); await wait(800);
  const pk = await f.evaluate(() => ({ on: WL.on, remark: document.getElementById('d_remark').value }));
  const k1 = JSON.parse(sql('rcl', "select value from app_settings where id = 'WL_PK|" + E + "'"))[0];
  const log = sql('rcl', "select string_agg(summary, ' | ' order by id) from activity_log where email = '" + E + "' and module = 'Screen lock'");
  ok('"Unlock with fingerprint / face / PIN": the device is asked (user verification), the SERVER checks its signature and counter – open; its counter moved (' + n0 + ' → ' + k1.n + '), last used noted; the Activity Log has the set-up and each unlock',
    !pk.on && pk.remark === 'Typed before the lock 218' && k1.n > n0 && !!k1.used && /set up on Linux · Chrome|set up on/.test(log) && /unlocked with the password/.test(log) && /unlocked with the fingerprint \/ face \/ PIN/.test(log), { pk, n0, k1: { n: k1.n, used: k1.used }, log });

  // ---------- 5. several tabs: one sign-in; a lock and an unlock in one reach the other ----------
  const B = await open(); const fb = frameOf(B);
  await fb.waitForFunction(() => typeof S !== 'undefined' && S.user && S.user.email, { timeout: 30000 }); await wait(1000);
  await fb.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const sameTok = await fb.evaluate(() => S.token) === await f.evaluate(() => S.token);
  await f.evaluate(() => { WL.last = Date.now() - 60000; localStorage.setItem(KK('rcl_wl_act'), String(WL.last)); wlCheck(); });
  await fb.waitForFunction(() => WL.on, { timeout: 15000 }).catch(() => {});
  const bOn = await fb.evaluate(() => WL.on);
  await f.evaluate(pw => { document.getElementById('wl_pw').value = pw; document.getElementById('wl_go').click(); }, PW);
  await f.waitForFunction(() => !WL.on, { timeout: 20000 }).catch(() => {});
  await fb.waitForFunction(() => !WL.on, { timeout: 15000 }).catch(() => {});
  const bOpen = await fb.evaluate(() => !WL.on);
  // a NEW tab opened while the screen is locked starts locked (before any data is asked)
  await f.evaluate(() => { WL.last = Date.now() - 60000; localStorage.setItem(KK('rcl_wl_act'), String(WL.last)); wlCheck(); }); await wait(1500);
  const C = await open(); const fc = frameOf(C); await wait(3500);
  const cSt = await fc.evaluate(() => ({ on: WL.on, user: !!(typeof S !== 'undefined' && S.user), shown: !document.getElementById('wl_lock').hidden }));
  ok('several tabs (one sign-in): the lock of one tab locks the other at once, unlocking in one unlocks the other; a tab opened while locked starts LOCKED with no data loaded',
    sameTok && bOn && bOpen && cSt.on && cSt.shown && !cSt.user, { sameTok, bOn, bOpen, cSt });
  await C.close(); await B.close();

  // ---------- 6. 5 wrong passwords in a row → signed out; Sign out from the lock ----------
  for (let i = 1; i <= 4; i++) { await f.evaluate(n => { document.getElementById('wl_pw').value = 'Wrong#' + n; document.getElementById('wl_go').click(); }, i);
    await f.waitForFunction(n => new RegExp('Wrong password – tries left: ' + (5 - n)).test(document.getElementById('wl_msg').textContent), { timeout: 20000 }, i).catch(() => {}); }
  const four = await f.evaluate(() => document.getElementById('wl_msg').textContent);
  await f.evaluate(() => { document.getElementById('wl_pw').value = 'Wrong#5'; document.getElementById('wl_go').click(); });
  await f.waitForFunction(() => /signed out/.test(document.getElementById('wl_msg').textContent), { timeout: 20000 }).catch(() => {});
  const fiveMsg = await f.evaluate(() => document.getElementById('wl_msg').textContent) + ' (after: ' + four + ')';
  await wait(4000); f = frameOf(A);
  const five = await f.evaluate(() => ({ login: !document.getElementById('login_screen').hidden, token: (typeof S !== 'undefined' && S.token) || '' }));
  const r5 = await rpc(PLAIN, { fn: 'api', args: [lk.token, 'whoami', []], site: 'S1', act: 0 });
  ok('5 wrong passwords in a row on the locked screen → signed out (the server ended the sign-in): "You are signed out (5 wrong passwords)…", then the sign-in screen',
    /signed out \(5 wrong passwords\)/.test(fiveMsg) && /tries left: 1/.test(fiveMsg) && five.login && !five.token && /SESSION_EXPIRED/.test(r5.error || ''), { fiveMsg, five, r5 });
  await f.waitForSelector('#lg_email', { visible: true, timeout: 30000 });
  await f.evaluate(() => { document.getElementById('lg_email').value = ''; document.getElementById('lg_pass').value = ''; });
  await f.type('#lg_email', E); await f.type('#lg_pass', PW); await f.click('#lg_btn');
  await f.waitForFunction(() => typeof S !== 'undefined' && S.user && S.user.email && document.getElementById('login_screen').hidden, { timeout: 30000 }); await wait(1000);
  const fresh = await f.evaluate(() => ({ on: WL.on, flag: localStorage.getItem('rcl_wl') }));
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} WL.last = Date.now() - 60000; localStorage.setItem(KK('rcl_wl_act'), String(WL.last)); wlCheck(); }); await wait(1500);
  const tok2 = await f.evaluate(() => S.token);
  await f.evaluate(() => document.getElementById('wl_out').click());
  await wait(5000); f = frameOf(A);
  const so = await f.evaluate(() => ({ login: !document.getElementById('login_screen').hidden, lock: !document.getElementById('wl_lock').hidden, flag: localStorage.getItem('rcl_wl'), act: localStorage.getItem('rcl_wl_act') }));
  const r6 = await rpc(PLAIN, { fn: 'api', args: [tok2, 'whoami', []], site: 'S1', act: 0 });
  ok('signing in again with the password starts unlocked; "Sign out" on the locked screen signs out (no question behind the lock): the sign-in screen, the session ended on the server, the lock\'s marks of this browser gone',
    !fresh.on && !fresh.flag && so.login && !so.lock && !so.flag && !so.act && /SESSION_EXPIRED/.test(r6.error || ''), { fresh, so, r6 });
  await A.screenshot({ path: '/home/claude/test/shots/lock218_signedout.png' });

  // ---------- 7. My settings: remove the device ----------
  await f.type('#lg_email', E); await f.type('#lg_pass', PW); await f.click('#lg_btn');
  await f.waitForFunction(() => typeof S !== 'undefined' && S.user && S.user.email && document.getElementById('login_screen').hidden, { timeout: 30000 }); await wait(1000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('tab-settings').click(); });
  await f.waitForFunction(() => document.querySelectorAll('#wl_devs [data-wlrm]').length === 1, { timeout: 15000 }).catch(() => {});
  await f.evaluate(() => document.querySelector('#wl_devs [data-wlrm]').click()); await wait(600);
  await f.evaluate(() => document.getElementById('cf_ok').click());
  await f.waitForFunction(() => !document.querySelector('#wl_devs [data-wlrm]'), { timeout: 15000 }).catch(() => {});
  const rm = await f.evaluate(() => ({ devs: document.getElementById('wl_devs').textContent, st: document.getElementById('wl_set_state').textContent, add: !document.getElementById('wl_set_add').hidden }));
  const left = sql('rcl', "select value from app_settings where id = 'WL_PK|" + E + "'");
  ok('My settings → Screen lock → Remove (asked first): the device is gone from his list and from the server; "Set up on this device" is offered again', /No device is set up yet/.test(rm.devs) && rm.add && left === '[]', { rm, left });
  ok('no script error on the pages', errs.length === 0, errs);
  await b.close();
  try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('ports ' + PLAIN + ' / ' + LINKED + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
