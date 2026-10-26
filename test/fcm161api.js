// update-161 – the phone app's notifications through Firebase, on the local rig (two sites S1 / T2, Mechanical :3001, the
// stand-in for Google test/fcm-standin.js on :3997 – started by the rig with FCM_TEST_URL and a TEST key; never the live site).
// Test data only (people ph161 / ca161 / tw161, their phones), taken out at the end.
//   1. a phone given at S1 is kept at the FIRST site only (S1's database – T2's has none), any site reaches it
//   2. a ring at S1 → a DATA message to that phone: ring, the caller, the site S1, HIGH, 60 s, one per call
//   3. the caller gives up → "missed"; a phone Firebase says is gone is forgotten
//   4. a ring at T2 (another site) → the SAME phone, with the site T2
//   5. another person signs in on that phone → it is his: nothing of the first person reaches it; signed out → off
//   6. a wrong address → the plain message (its help rule is in FIX_RULES)
'use strict';
const { execSync } = require('child_process');
const crypto = require('crypto');
const out = []; let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const U = 'http://127.0.0.1:3001', F = 'http://127.0.0.1:3997', PW = 'Nashik#Road848!';
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = async (body) => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json();
const uid = e => crypto.createHash('sha256').update('rtc|' + e.toLowerCase()).digest('hex').slice(0, 16);
const tok = c => c + 'f'.repeat(20) + ':APA91b' + crypto.createHash('sha256').update(c).digest('hex').repeat(3).slice(0, 140);
const sent = async () => (await (await fetch(F + '/sent')).json()).sent;
const PEOPLE = ['ph161@rcl.test', 'ca161@rcl.test', 'tw161@rcl.test'];
(async () => {
  const cleanup = () => {
    const ids = PEOPLE.map(e => "'FCM|" + uid(e) + "'").join(',');
    sql('rcl', "delete from app_settings where id in (" + ids + ") or (id like 'FCMT|%' and value in (" + PEOPLE.map(e => "'" + uid(e) + "'").join(',') + ")) or (id like 'FCMT|%' and value = '');" +
      "delete from app_users where email in ('ph161@rcl.test', 'ca161@rcl.test'); delete from rcl_user_sites where email in (" + PEOPLE.map(e => "'" + e + "'").join(',') + "); delete from web.cache where key in ('USERS_LIST') or key like 'RTC%';");
    sql('rcl_s2', "delete from app_users where email in ('ph161@rcl.test', 'tw161@rcl.test'); delete from web.cache where key in ('USERS_LIST') or key like 'RTC%';");
  };
  try {
    cleanup();
    await fetch(F + '/reset');
    const h1 = sql('rcl', "select password_hash from app_users where email = 'sujit@rcl.test'"), h2 = sql('rcl_s2', "select password_hash from app_users where email = 'sujit@rcl.test'");
    sql('rcl', "insert into app_users (id, email, password_hash, name, active, admin) values ('ph161', 'ph161@rcl.test', '" + h1 + "', 'Phone 161', 'Yes', 'No'), ('ca161', 'ca161@rcl.test', '" + h1 + "', 'Caller 161', 'Yes', 'No');" +
      "insert into rcl_user_sites (email, site, is_admin, is_default) values ('ph161@rcl.test', 'S1', false, true), ('ph161@rcl.test', 'T2', false, false), ('ca161@rcl.test', 'S1', false, true), ('tw161@rcl.test', 'T2', false, true);");
    sql('rcl_s2', "insert into app_users (id, email, password_hash, name, active, admin) values ('ph161', 'ph161@rcl.test', '" + h2 + "', 'Phone 161', 'Yes', 'No'), ('tw161', 'tw161@rcl.test', '" + h2 + "', 'Caller T2 161', 'Yes', 'No');");
    await wait(1200);
    const signIn = async e => { const r = await post({ fn: 'login', args: [e, PW] }); return { t: r.result && r.result.token, site: (r.result && r.result.site) || '', err: r.error }; };
    const ph = await signIn('ph161@rcl.test'), ca = await signIn('ca161@rcl.test'), tw = await signIn('tw161@rcl.test');
    ok('setup: the phone\'s owner and a caller signed in at S1, a caller at T2', !!(ph.t && ca.t && tw.t) && tw.site === 'T2', { ph, ca, tw });
    const call = async (s, fn, a) => { const r = await post(Object.assign({ fn: 'api', args: [s.t, fn, a] }, s.site && s.site !== 'S1' ? { site: s.site } : {})); return r.error ? { ERROR: r.error } : r.result; };
    const A = tok('phoneA'), G = tok('gone-phone');

    // 6. a wrong address: the plain message
    const bad = await call(ph, 'fcmSave', [{ token: 'not-a-phone' }]);
    ok('6. a wrong address of a phone: "Notifications: the address of this phone … is not valid"', /^Notifications: the address of this phone for notifications is not valid/.test(bad.ERROR || ''), bad);
    // 1. the phone given at S1: kept at the first site
    const sv = await call(ph, 'fcmSave', [{ token: A }]);
    const at1 = sql('rcl', "select value from app_settings where id = 'FCM|" + uid('ph161@rcl.test') + "'"), at2 = sql('rcl_s2', "select count(*) from app_settings where id like 'FCM%'");
    ok('1. the phone given at S1 is kept at the first site (S1\'s database); T2\'s database has none', sv && sv.ok === true && sv.sending === true && at1.indexOf(A) > -1 && at2 === '0', { sv, at1: at1.slice(0, 80), at2 });

    // 2. a ring at S1
    let r = await call(ca, 'rtcSend', [{ t: 'ring', to: [uid('ph161@rcl.test')], call: 'f161a', d: { mode: 'voice' } }]);
    await wait(300);
    let s = await sent();
    const m = s[0] && s[0].message;
    ok('2. a ring at S1 → one DATA message to his phone: ring, the caller, the site S1, HIGH, 60 s, one per call', r && r.ok && s.length === 1 && m.token === A && !m.notification && m.data.t === 'ring' && m.data.name === 'Caller 161' && m.data.from === uid('ca161@rcl.test') && m.data.mode === 'voice' &&
      m.data.site === 'S1' && m.android.priority === 'HIGH' && m.android.ttl === '60s' && m.android.collapse_key === 'call-f161a' && s[0].project === 'rclerp-rig', { r, s });

    // 3. the caller gives up: "missed"; the phone that is gone is forgotten
    await call(ph, 'fcmSave', [{ token: G }]);
    await fetch(F + '/reset');
    r = await call(ca, 'rtcSend', [{ t: 'cancel', to: [uid('ph161@rcl.test')], call: 'f161a', d: {} }]);
    await wait(300);
    s = await sent();
    const left = sql('rcl', "select value from app_settings where id = 'FCM|" + uid('ph161@rcl.test') + "'");
    ok('3. the caller gave up → "missed" on his phone; the phone Firebase says is gone is forgotten', r && r.ok && s.length === 1 && s[0].message.data.t === 'missed' && s[0].message.token === A && left.indexOf(A) > -1 && left.indexOf('gone-phone') < 0, { r, s, left: left.slice(0, 120) });

    // 4. a ring at T2: the same phone, with the site T2
    await fetch(F + '/reset');
    r = await call(tw, 'rtcSend', [{ t: 'ring', to: [uid('ph161@rcl.test')], call: 'f161b', d: { mode: 'video' } }]);
    await wait(300);
    s = await sent();
    ok('4. a ring at T2 (another site) → the SAME phone (given once, at S1), with the site T2', r && r.ok && s.length === 1 && s[0].message.token === A && s[0].message.data.site === 'T2' && s[0].message.data.name === 'Caller T2 161' && s[0].message.data.mode === 'video', { r, s });

    // 5. another person signs in on that phone: it is his; then signed out: off
    const mv = await call(ca, 'fcmSave', [{ token: A }]);
    await fetch(F + '/reset');
    r = await call(tw, 'rtcSend', [{ t: 'cancel', to: [uid('ph161@rcl.test')], call: 'f161b', d: {} }]);
    await wait(300);
    s = await sent();
    const phNow = sql('rcl', "select value from app_settings where id = 'FCM|" + uid('ph161@rcl.test') + "'"), caNow = sql('rcl', "select value from app_settings where id = 'FCM|" + uid('ca161@rcl.test') + "'");
    ok('5. another person signs in on the phone → it is his: the first person\'s "missed" does not reach it', mv && mv.ok && r && r.ok && s.length === 0 && phNow.indexOf(A) < 0 && caNow.indexOf(A) > -1, { mv, r, s, phNow: phNow.slice(0, 80) });
    const off = await call(ca, 'fcmOff', [{ token: A }]);
    const caOff = sql('rcl', "select value from app_settings where id = 'FCM|" + uid('ca161@rcl.test') + "'");
    ok('   signed out on it: the phone is off (nothing kept)', off && off.ok && caOff.indexOf(A) < 0, { off, caOff });
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally { try { cleanup(); } catch (e) { out.push('cleanup failed: ' + e.message); } }
  console.log(out.join('\n'));
  console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
