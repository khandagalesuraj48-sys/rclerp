/* update-68: passwords kept with scrypt (D2), the access report (D3), least privilege of the start-up calls (D4),
 * and the 30-day limit of a sign-in (D6) – on the local test rig (PostgreSQL + PostgREST + the app's server on 3000 / 3001).
 * Nothing here touches the live database.
 *   node test/secure68.js [section …]      sections: password session access least rollback
 *   "rollback" needs a server of the code BEFORE update-68 on OLD_PORT (default 3002); without one it is skipped and says so. */
const { execSync } = require('child_process'); const crypto = require('crypto');
const PORT = Number(process.env.PORT) || 3000, OTHER = PORT === 3000 ? 3001 : PORT, OLD_PORT = Number(process.env.OLD_PORT) || 3002;
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA -q"', { input: q, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
const raw = async (port, body) => { const t = Date.now(); const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) });
  let j; const txt = await r.text(); try { j = JSON.parse(txt); } catch (e) { j = { error: 'no JSON (' + r.status + ')' }; } return { status: r.status, error: j.error, result: j.result, ms: Date.now() - t }; };
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 460) : '')); };
const want = process.argv.slice(2), on = s => !want.length || want.indexOf(s) > -1;
const ADMIN = ['sujit@rcl.test', 'Nashik#Road848!'];
const TAG = 's68' + Date.now().toString(36);
const MODULES = ['Dashboard', 'Vendor Master', 'Master', 'Vendor BOQ', 'Vehicle Compliance', 'Breakdown', 'Diesel Inward', 'Diesel Transfer', 'Diesel Issue', 'Log Book', 'Machinery Billing', 'Saved Bills', 'Bill Summary', 'Machinery Payments', 'Vendor Ledger', 'Vendor Outstanding', 'Reports'];
const login = (email, pw, port) => raw(port || PORT, { fn: 'login', args: [email, pw] });
const api = (token, fn, args, port) => raw(port || PORT, { fn: 'api', args: [token, fn, args || []] });
const stored = email => sql("select password_hash from app_users where id = '" + email + "'");
const setStored = async (email, v) => { sql("update app_users set password_hash = $q$" + v + "$q$ where id = '" + email + "'; delete from web.cache where key = 'USERS_LIST' or key = 'F_" + email + "';"); await wait(1300); };      // (the users list is remembered for a second)
const fewer = () => sql("delete from web.cache where key like 'LG\\_%' or key like 'LGL\\_%'");      // the test signs in more than 60 times a minute
const sess = token => { const v = sql("select value || chr(9) || round(extract(epoch from (expires_at - now()))) from web.cache where key = 'S_" + token + "' and expires_at > now()"); if (!v) return null; const p = v.split('\t'); return { value: p[0], parts: p[0].split('|'), left: Number(p[1]) }; };
// the way a password was kept until update-67: SHA-256 of salt|password, then 300 more rounds
const oldHash = (pw, salt) => { let x = crypto.createHash('sha256').update(salt + '|' + pw, 'utf8').digest(); for (let i = 0; i < 300; i++) x = crypto.createHash('sha256').update(Buffer.concat([x, Buffer.from(salt, 'utf8')])).digest(); return 'sha256$' + salt + '$' + x.toString('hex'); };
const oldStamp = s => crypto.createHash('sha256').update('st|' + s).digest('hex').slice(0, 12);
const SCRYPT = /^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{64}\$[0-9a-f]{12}$/;
const checkScrypt = (pw, s) => { const p = s.replace(/^tmp\$/, '').split('$'); return crypto.scryptSync(Buffer.from(pw, 'utf8'), Buffer.from(p[4], 'hex'), 32, { N: Number(p[1]), r: Number(p[2]), p: Number(p[3]), maxmem: 160 * 1024 * 1024 }).toString('hex') === p[5]; };
const cleanUp = () => { try { sql("delete from activity_log where email like 's68%@rcl.test'; delete from app_users where id like 's68%@rcl.test'; delete from web.cache where key like 'F\\_s68%' or key like 'CPF\\_s68%' or key like 'LG\\_%';" +
  " update master set monthly_rate = null, tds_rate = null, engine_number = null, chassis_number = null, tax_valid_upto = null where id = 'MH-15-AB-0004' and engine_number = 'ENG-S68';"); } catch (e) { console.log('clean-up: ' + String(e.message).slice(0, 200)); } };

(async () => {
  cleanUp(); fewer();
  let r = await login(ADMIN[0], ADMIN[1]); const admin = r.result && r.result.token; ok('admin signs in', !!admin, r.error);
  // a user made through the app (Users & Access), with an own password
  const makeUser = async (name, perms, opt) => { const email = TAG + name + '@rcl.test', p = {}; MODULES.forEach(m => { p[m] = perms[m] || perms['*'] || 'None'; });
    const a = await api(admin, 'saveUserAdmin', [{ email: email, name: 'S68 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]); if (a.error) throw new Error('user ' + name + ': ' + a.error);
    if (opt && opt.raw) return { email: email, temp: 'Temp#' + name + '1' };
    const l = await login(email, 'Temp#' + name + '1'), pw = 'Own#' + name + '2468', c = await raw(PORT, { fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] });
    if (c.error) throw new Error('user ' + name + ': ' + c.error); return { email: email, pw: pw, token: c.result.token }; };

  if (on('password')) {
    console.log('\n=== D2. PASSWORDS ARE KEPT WITH scrypt ===');
    // --- a one-time password (new user) and the forced change
    const nu = await makeUser('new', { '*': 'View' }, { raw: true }), s0 = stored(nu.email);
    ok('a new user\'s one-time password is kept with scrypt and marked one-time ("tmp$scrypt$…") – never as typed', /^tmp\$scrypt\$32768\$8\$3\$/.test(s0) && s0.indexOf(nu.temp) === -1 && checkScrypt(nu.temp, s0), s0.slice(0, 40) + '…');
    const l1 = await login(nu.email, nu.temp), blocked = await api(l1.result && l1.result.token, 'getInit'), who = await api(l1.result && l1.result.token, 'whoami');
    ok('one-time password: the sign-in works and says "must change"; until then the server opens NOTHING', !l1.error && l1.result.mustChange === true && blocked.error === 'SESSION_EXPIRED' && who.error === 'SESSION_EXPIRED', { mustChange: l1.result && l1.result.mustChange, getInit: blocked.error || 'OPENED', whoami: who.error || 'OPENED' });
    const weak = await raw(PORT, { fn: 'changePassword', args: [l1.result.token, nu.temp, 'short1'] }), same = await raw(PORT, { fn: 'changePassword', args: [l1.result.token, nu.temp, nu.temp] }), wrongOld = await raw(PORT, { fn: 'changePassword', args: [l1.result.token, 'not-it', 'Good#Pass2468'] });
    const ch = await raw(PORT, { fn: 'changePassword', args: [l1.result.token, nu.temp, 'Good#Pass2468'] }), s1 = stored(nu.email), after = await api(ch.result && ch.result.token, 'getInit');
    ok('forced change: a weak password, the same password and a wrong current password are refused; a good one is kept with scrypt (no "tmp$") and the app opens', !!weak.error && !!same.error && /Current password is wrong/.test(wrongOld.error || '') && !ch.error && SCRYPT.test(s1) && checkScrypt('Good#Pass2468', s1) && !after.error,
      { weak: weak.error, same: same.error, wrong_current: wrongOld.error, kept: s1.slice(0, 30) + '…', app: after.error || 'opens' });
    const oldTok = await api(l1.result.token, 'whoami'), relog = await login(nu.email, 'Good#Pass2468'), tempAgain = await login(nu.email, nu.temp);
    ok('new hash: the sign-in with the new password works (no "must change"); the one-time password and the session before the change are dead', !relog.error && relog.result.mustChange === false && !!tempAgain.error && oldTok.error === 'SESSION_EXPIRED', { new_pw: relog.error || 'in', one_time_pw: tempAgain.error, old_session: oldTok.error });
    ok('…and a password already kept the new way is NOT written again at a sign-in', stored(nu.email) === s1);

    // --- a password kept the OLD way (as every existing user has it today)
    fewer();
    const ou = await makeUser('old', { '*': 'View' }), pwOld = 'Site#Office2468', hOld = oldHash(pwOld, '03df218ade11434e');
    await setStored(ou.email, hOld);
    // a session of this user on another device, signed in before the update (its stamp is the old one)
    const dev2 = 'dev2' + crypto.randomUUID(); sql("insert into web.cache (key, value, expires_at) values ('S_" + dev2 + "', '" + ou.email + "|" + oldStamp(hOld) + "', now() + interval '5 hours')");
    const before = await api(dev2, 'whoami');
    const wrong = await login(ou.email, 'Site#Office2469'), sWrong = stored(ou.email);
    ok('old hash, WRONG password: refused, and the kept password is not touched', /Wrong email or password/.test(wrong.error || '') && sWrong === hOld, wrong.error);
    const lo = await login(ou.email, pwOld), sUp = stored(ou.email);
    ok('old hash, right password: the user signs in as always (no "must change", nothing to do)', !lo.error && lo.result.mustChange === false && !(await api(lo.result.token, 'getInit')).error, lo.error || { mustChange: lo.result.mustChange });
    ok('[fix] automatic upgrade: at that sign-in the password was kept afresh with scrypt (N=32768, r=8, p=3) – the same password, checked independently', SCRYPT.test(sUp) && checkScrypt(pwOld, sUp) && !checkScrypt('Site#Office2469', sUp), { before: hOld.slice(0, 26) + '…', after: sUp.slice(0, 40) + '…' });
    const dev2After = await api(dev2, 'whoami');
    ok('…the person\'s OTHER open session (another device) stays signed in: only the way of keeping changed, not the password', !before.error && !dev2After.error && sUp.slice(-12) === oldStamp(hOld), { before: before.error || 'in', after: dev2After.error || 'in', stamp_carried_over: sUp.slice(-12) === oldStamp(hOld) });
    const lo2 = await login(ou.email, pwOld, OTHER), lo3 = await login(ou.email, 'Site#Office2469');
    ok('after the upgrade: right password in (other server too), wrong password out; the kept text is not written again', !lo2.error && !!lo3.error && stored(ou.email) === sUp, { right: lo2.error || 'in', wrong: lo3.error });
    // the kept text itself is never a password; a damaged kept text never opens
    const asPw = await login(ou.email, sUp); await setStored(ou.email, sUp.slice(0, -20) + 'zz' + sUp.slice(-18));
    const dmg = await login(ou.email, pwOld), dmg2 = await login(ou.email, sUp.slice(0, -20) + 'zz' + sUp.slice(-18)); await setStored(ou.email, 'scrypt$1073741824$8$1$' + '0'.repeat(32) + '$' + '0'.repeat(64) + '$' + '0'.repeat(12));
    const huge = await login(ou.email, pwOld);
    ok('the kept text typed as the password is refused; a damaged kept text opens for nothing (not even for itself); a planted "cost of a thousand million" is refused at once (it cannot hold the server)', !!asPw.error && !!dmg.error && !!dmg2.error && !!huge.error && huge.ms < 3000, { kept_text_as_pw: asPw.error, damaged: dmg.error, damaged_as_pw: dmg2.error, huge_cost: huge.error + ' in ' + huge.ms + ' ms' });

    // --- one-time passwords made BEFORE the update, and a plain password typed into the table
    fewer();
    await setStored(ou.email, 'tmp$' + oldHash('OneTime#77', 'aaaaaaaaaaaaaaaa'));
    const t1 = await login(ou.email, 'OneTime#77'), sT = stored(ou.email), t1api = await api(t1.result && t1.result.token, 'getInit');
    ok('a one-time password from before the update: accepted, kept afresh with scrypt, STILL one-time (must change, opens nothing)', !t1.error && t1.result.mustChange === true && /^tmp\$scrypt\$32768\$8\$3\$/.test(sT) && checkScrypt('OneTime#77', sT) && t1api.error === 'SESSION_EXPIRED', { mustChange: t1.result && t1.result.mustChange, kept: sT.slice(0, 34) + '…', app: t1api.error || 'OPENED' });
    await setStored(ou.email, 'Plain#Typed9');
    const p1 = await login(ou.email, 'Plain#Typed9'), sP = stored(ou.email), p1api = await api(p1.result && p1.result.token, 'whoami');
    ok('[fix] a password typed straight into the table (plain text): accepted once – and from that sign-in it is no longer in the table as typed (kept with scrypt, one-time: must change)', !p1.error && p1.result.mustChange === true && /^tmp\$scrypt\$/.test(sP) && sP.indexOf('Plain#Typed9') === -1 && checkScrypt('Plain#Typed9', sP) && p1api.error === 'SESSION_EXPIRED', { kept: sP.slice(0, 34) + '…' });
    const p2 = await raw(PORT, { fn: 'changePassword', args: [p1.result.token, 'Plain#Typed9', 'Fresh#Own8642'] });
    ok('…and the forced change from it works', !p2.error && SCRYPT.test(stored(ou.email)), p2.error);

    // --- reset by the Admin
    const sBefore = stored(ou.email), live = await login(ou.email, 'Fresh#Own8642');
    const rs = await api(admin, 'saveUserAdmin', [{ email: ou.email, name: 'S68 old', active: true, admin: false, perms: {}, newPassword: 'Reset#4321' }]);
    const sR = stored(ou.email), oldPw = await login(ou.email, 'Fresh#Own8642'), oldSess = await api(live.result.token, 'whoami'), rl = await login(ou.email, 'Reset#4321');
    ok('password reset by the Admin: kept as a one-time scrypt hash; the old password and the old sessions stop at once; the one-time password signs in and must be changed', !rs.error && /^tmp\$scrypt\$/.test(sR) && sR !== sBefore && !!oldPw.error && oldSess.error === 'SESSION_EXPIRED' && !rl.error && rl.result.mustChange === true,
      { reset: rs.error || 'done', kept: sR.slice(0, 30) + '…', old_pw: oldPw.error, old_session: oldSess.error, one_time: rl.error || 'in, mustChange ' + rl.result.mustChange });
    const pwCols = sql("select count(*) from app_users where id like '" + TAG + "%' and password_hash !~ '^(tmp\\$)?scrypt\\$'");
    ok('no user of this test has anything but a scrypt hash in the table now', pwCols === '0', pwCols + ' other');

    // --- the time of the answer does not tell which e-mails exist; 5 wrong tries still lock
    fewer(); await setStored(ou.email, stored(ou.email));
    const tk = [], tu = [];
    for (let i = 0; i < 4; i++) { tu.push((await login('nobody' + i + TAG + '@rcl.test', 'Some#Pass1234')).ms); tk.push((await login(ou.email, 'Wrong#Pass' + i)).ms); }
    const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    ok('[fix] a wrong e-mail takes the same work as a wrong password (the answer\'s time does not tell which e-mails exist)', med(tu) > med(tk) * 0.6 && med(tu) < med(tk) * 1.6, { unknown_email_ms: med(tu), known_email_wrong_pw_ms: med(tk) });
    { // a user who has NOT signed in since update-68 (password still kept the older way): a wrong password must not be answered quicker than an unknown e-mail
      const oe = TAG + 'tim@rcl.test', pp = {}; MODULES.forEach(m => { pp[m] = 'View'; });
      const mkT = await api(admin, 'saveUserAdmin', [{ email: oe, name: 'T timing', active: true, admin: false, perms: pp, isNew: true, newPassword: 'Temp#Timing1' }]);
      await setStored(oe, oldHash('Site#Timing2468', '0123456789abcdef')); const to = [], tn = [];
      for (let i = 0; i < 4; i++) { tn.push((await login('nobody' + i + 'x' + TAG + '@rcl.test', 'Some#Pass1234')).ms); to.push((await login(oe, 'Wrong#Old' + i)).ms); }
      const still = stored(oe), good = await login(oe, 'Site#Timing2468');
      ok('[review] …also for a user whose password is still kept the OLDER way (has not signed in since update-68): a wrong password takes the same work as an unknown e-mail; the refusals did not touch the kept password; the right password then signs in', !mkT.error && med(to) > med(tn) * 0.6 && med(to) < med(tn) * 1.6 && /^sha256\$/.test(still) && !!good.result, { unknown_email_ms: med(tn), old_hash_wrong_pw_ms: med(to), kept_after_refusals: still.slice(0, 7), right_password: good.error || 'in' }); }
    const fifth = await login(ou.email, 'Wrong#Pass5'), sixth = await login(ou.email, 'Reset#4321');
    ok('5 wrong tries lock the e-mail for 15 minutes – also for the right password', /Too many wrong attempts|Wrong email or password/.test(fifth.error || '') && /Too many wrong attempts/.test(sixth.error || ''), { fifth: fifth.error, then_right_pw: sixth.error });
    sql("delete from web.cache where key = 'F_" + ou.email + "'");
  }

  if (on('session')) {
    console.log('\n=== D6. A SIGN-IN LASTS 30 DAYS AT MOST ===');
    fewer();
    const u = await makeUser('ses', { '*': 'View' });
    const a = await login(u.email, u.pw), tok = a.result.token, s0 = sess(tok);
    ok('a normal session: it works, it carries its sign-in time ("email|stamp|time"), and is kept for 6 hours from the last use', !(await api(tok, 'whoami')).error && s0 && s0.parts.length === 3 && Math.abs(Number(s0.parts[2]) - Date.now()) < 60000 && s0.left > 21000 && s0.left <= 21600, s0);
    const setMade = (t, ms) => sql("update web.cache set value = split_part(value, '|', 1) || '|' || split_part(value, '|', 2) || '|" + ms + "' where key = 'S_" + t + "'");
    // 29 days 23 hours 59 minutes old: still good – but it is not renewed beyond its 30 days
    setMade(tok, Date.now() - 30 * 86400000 + 60000);
    const near = await api(tok, 'whoami'), nearInit = await api(tok, 'getInit', [], OTHER);
    ok('a session 1 minute before its 30 days: still works (both servers)', !near.error && !nearInit.error, { whoami: near.error || 'works', getInit: nearInit.error || 'works' });
    // 30 days and 1 minute old, used all the time (never 6 hours idle)
    setMade(tok, Date.now() - 30 * 86400000 - 60000); sql("update web.cache set expires_at = now() + interval '6 hours' where key = 'S_" + tok + "'");
    const over = await api(tok, 'whoami'), overInit = await api(tok, 'getInit', [], OTHER), overCh = await raw(PORT, { fn: 'changePassword', args: [tok, u.pw, 'Other#Pass9753'] }); await wait(300);
    ok('[fix] ABSOLUTE LIMIT: a session 30 days old is ended although it was in use the whole time – every action, both servers, also "change password"; it is gone from the server', over.error === 'SESSION_EXPIRED' && overInit.error === 'SESSION_EXPIRED' && overCh.error === 'SESSION_EXPIRED' && sess(tok) === null, { whoami: over.error || 'WORKS', getInit: overInit.error || 'WORKS', changePassword: overCh.error || 'WORKS', still_kept: sess(tok) !== null });
    const again = await login(u.email, u.pw);
    ok('…the person signs in again with the same password and works on', !again.error && !(await api(again.result.token, 'whoami')).error, again.error);
    // inactivity
    const t2 = again.result.token; sql("update web.cache set expires_at = now() - interval '1 second' where key = 'S_" + t2 + "'");
    const idle = await api(t2, 'whoami');
    ok('inactivity (as before): a session not used for 6 hours is ended', idle.error === 'SESSION_EXPIRED', idle.error || 'WORKS');
    // a session from before update-68 (no time in it)
    const stamp = stored(u.email).slice(-12), t3 = 'pre68' + crypto.randomUUID();
    sql("insert into web.cache (key, value, expires_at) values ('S_" + t3 + "', '" + u.email + "|" + stamp + "', now() + interval '3 hours')");
    const pre = await api(t3, 'whoami'); await wait(300); const sPre = sess(t3);
    ok('a session from before this update (it has no time): the person stays signed in; its 30 days count from now', !pre.error && sPre && sPre.parts.length === 3 && Math.abs(Number(sPre.parts[2]) - Date.now()) < 60000, { works: pre.error || 'yes', value_now: sPre && sPre.parts.length + ' parts' });
    // password change, deactivation, sign-out
    fewer();
    const b1 = await login(u.email, u.pw), b2 = await login(u.email, u.pw, OTHER);
    const ch = await raw(PORT, { fn: 'changePassword', args: [b1.result.token, u.pw, 'Changed#1357'] }), o1 = await api(b1.result.token, 'whoami'), o2 = await api(b2.result.token, 'whoami', [], OTHER), o3 = await api(t3, 'whoami'), n1 = await api(ch.result && ch.result.token, 'whoami');
    ok('password change: EVERY older session of the user ends at once (this device, the other server, the old one); the new session works', !ch.error && o1.error === 'SESSION_EXPIRED' && o2.error === 'SESSION_EXPIRED' && o3.error === 'SESSION_EXPIRED' && !n1.error, { changed: ch.error || 'yes', old: [o1.error, o2.error, o3.error], new: n1.error || 'works' });
    const live = ch.result.token, off = await api(admin, 'saveUserAdmin', [{ email: u.email, name: 'S68 ses', active: false, admin: false, perms: {} }]);
    const d1 = await api(live, 'whoami'), d2 = await api(live, 'getInit', [], OTHER), d3 = await login(u.email, 'Changed#1357');
    ok('deactivation by the Admin: the user\'s session ends at once (both servers) and a new sign-in is refused', !off.error && d1.error === 'SESSION_EXPIRED' && d2.error === 'SESSION_EXPIRED' && !!d3.error, { whoami: d1.error || 'WORKS', other_server: d2.error || 'WORKS', sign_in: d3.error || 'IN' });
    await api(admin, 'saveUserAdmin', [{ email: u.email, name: 'S68 ses', active: true, admin: false, perms: {} }]);
    const c1 = await login(u.email, 'Changed#1357'), c2 = await login(u.email, 'Changed#1357'); await raw(PORT, { fn: 'logout', args: [c1.result.token] });
    const g1 = await api(c1.result.token, 'whoami'), g2 = await api(c1.result.token, 'whoami', [], OTHER), g3 = await api(c2.result.token, 'whoami');
    ok('sign-out: that session ends at once on every server; the user\'s other session is not touched', g1.error === 'SESSION_EXPIRED' && g2.error === 'SESSION_EXPIRED' && !g3.error, { signed_out: [g1.error, g2.error], other_session: g3.error || 'works' });
  }

  if (on('access')) {
    console.log('\n=== D3. THE ACCESS REPORT (reads only) ===');
    fewer();
    const u = await makeUser('acc', { 'Diesel Issue': 'Edit', 'Log Book': 'View', 'Reports': 'View' });
    // cells as they can be in the table: empty, other text, written
    sql("update app_users set perm_dashboard = '', perm_breakdown = null, perm_vendor_ledger = 'maybe', perm_master = 'No access' where id = '" + u.email + "'; delete from web.cache where key = 'USERS_LIST';"); await wait(1300);
    const snap = () => sql("select md5(string_agg(t::text, '|' order by id)) from app_users t") + ' ' + sql("select count(*) from app_users") + ' ' + sql("select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_name = 'app_users'").length;
    const s0 = snap(), rep = await api(admin, 'accessReport'), s1 = snap();
    const rows = (rep.result && rep.result.rows) || [], mine = rows.filter(x => x.email === u.email), by = {}; mine.forEach(x => { by[x.module] = x; });
    const nUsers = Number(sql("select count(*) from app_users"));
    ok('the report lists every user × every page (user, page, what is written, the access it gives)', !rep.error && rows.length === nUsers * MODULES.length && mine.length === MODULES.length && rows.every(x => 'raw' in x && 'effective' in x && x.email && x.module), rep.error || { users: nUsers, pages: MODULES.length, lines: rows.length });
    ok('it shows the cells as they are: EMPTY → View, other text ("maybe") → View, "No access" → No access, "Edit" → Edit', by.Dashboard.raw === '' && by.Dashboard.effective === 'View' && by.Dashboard.why === 'empty' && by.Breakdown.why === 'empty' && by['Vendor Ledger'].raw === 'maybe' && by['Vendor Ledger'].effective === 'View' && by['Vendor Ledger'].why === 'unknown' &&
      by['Asset Master'].effective === 'No access' && by['Diesel Issue'].effective === 'Edit' && by['Diesel Issue'].why === 'written', { Dashboard: by.Dashboard, VendorLedger: by['Vendor Ledger'], AssetMaster: by['Asset Master'] && by['Asset Master'].effective });
    // "effective" is the truth: the same as the access the user's own session gets
    const lu = await login(u.email, u.pw), me = await api(lu.result.token, 'sync'), perms = (me.result && me.result.user && me.result.user.perms) || {};
    const label = m => m === 'Master' ? 'Asset Master' : m, diff = MODULES.filter(m => (perms[m] === 'None' ? 'No access' : perms[m]) !== by[label(m)].effective);
    const adm = rows.filter(x => x.email === ADMIN[0]);
    ok('"access it gives" is exactly what the user\'s own sign-in gets (all ' + MODULES.length + ' pages compared); an Admin shows Edit everywhere', diff.length === 0 && adm.length === MODULES.length && adm.every(x => x.effective === 'Edit' && x.why === 'admin'), diff.length ? 'differs: ' + diff.join(', ') : 'same');
    ok('NOTHING is changed by the report: the Users table is byte for byte the same (rows, columns, every cell)', s0 === s1, { before: s0, after: s1 });
    const notAdmin = await api(lu.result.token, 'accessReport');
    ok('only the Admin can open it', /Only Admin/.test(notAdmin.error || ''), notAdmin.error || 'OPENED');
    ok('D3: an empty cell still gives View – the meaning of the access cells is unchanged in update-68', perms.Dashboard === 'View' && perms.Breakdown === 'View', { Dashboard: perms.Dashboard, Breakdown: perms.Breakdown });
  }

  if (on('least')) {
    console.log('\n=== D4. THE START-UP CALLS GIVE ONLY WHAT THE USER\'S PAGES USE ===');
    fewer();
    sql("update master set monthly_rate = 55555, tds_rate = 2, engine_number = 'ENG-S68', chassis_number = 'CHS-S68', tax_valid_upto = '2027-01-01' where id = 'MH-15-AB-0004'"); await wait(1300);
    const RATE = ['monthlyRate', 'tdsRate'], FULL = ['engineNo', 'chassisNo', 'engineMake', 'taxUpto', 'pucUpto', 'permitUpto', 'fitnessUpto', 'insuranceUpto', 'enteredBy', 'updatedBy'];
    const COMMON = ['id', 'no', 'name', 'type', 'make', 'unit', 'worksOn', 'lbFormat', 'modes', 'owner', 'ownership', 'supply', 'status', 'activeFrom', 'inactiveFrom', 'kmStd', 'hrStd', 'tankCap'];
    const users = {
      edit:   await makeUser('edit', { 'Diesel Issue': 'Edit', 'Log Book': 'Edit', 'Diesel Inward': 'Edit' }),
      view:   await makeUser('view', { '*': 'View' }),
      none:   await makeUser('none', {}),
      diesel: await makeUser('dsl', { 'Diesel Issue': 'Edit' }),
      report: await makeUser('rpt', { 'Reports': 'View' }),
      bill:   await makeUser('bill', { 'Machinery Billing': 'View', 'Vendor Ledger': 'View' }),
      vend:   await makeUser('vend', { 'Vendor Master': 'Edit', 'Dashboard': 'View' }) };
    fewer();
    const look = async (token) => { const i = await api(token, 'getInit'), l = await api(token, 'getLookups'), s = await api(token, 'getStock'), b = await api(token, 'getBrief');
      const m = ((i.result && i.result.master) || []).find(x => x.id === 'MH-15-AB-0004') || {}, ml = ((l.result && l.result.master) || []).find(x => x.id === 'MH-15-AB-0004') || {};
      const all = ((i.result && i.result.master) || []).concat((l.result && l.result.master) || []);
      return { err: i.error || l.error || '', n: ((i.result && i.result.master) || []).length, m: m, rate: RATE.filter(k => all.some(x => k in x)), full: FULL.filter(k => all.some(x => k in x)), common: COMMON.every(k => k in m && k in ml),
        drivers: [(i.result.drivers || []).length, (l.result.drivers || []).length], pumps: [(i.result.pumps || []).length, (l.result.pumps || []).length], vendors: (l.result.vendors || []).length,
        stockInit: i.result.stock ? typeof i.result.stock.stock : String(i.result.stock), getStock: s.error ? 'refused' : typeof s.result.stock, brief: !!(b.result && b.result.sections && b.result.sections.stock),
        always: ['user', 'versions', 'today', 'rules', 'org', 'locations', 'closedUpto'].every(k => k in i.result) }; };
    const seed = await api(admin, 'saveDieselIssue', [{ date: sql("select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')"), shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: 'S68 driver', qty: 1, kmReading: 99980 + Math.floor(Math.random() * 9), force: true }]);      // (so that there is a driver name to give)
    const A = await look(admin), nMaster = Number(sql("select count(*) from master"));
    ok('Admin: everything as before – every machinery with all details (rate 55555, TDS 2, engine, papers), drivers, pumps, vendor names, stock', !A.err && A.n === nMaster && A.m.monthlyRate === 55555 && A.m.tdsRate === 2 && A.m.engineNo === 'ENG-S68' && A.m.taxUpto === '2027-01-01' && A.rate.length === 2 && A.full.length === FULL.length && A.drivers[0] > 0 && A.pumps[0] > 0 && A.vendors > 0 && A.stockInit === 'number' && A.getStock === 'number' && A.brief,
      { machinery: A.n, rate: A.m.monthlyRate, tds: A.m.tdsRate, engine: A.m.engineNo, drivers: A.drivers, pumps: A.pumps, vendors: A.vendors, stock: A.getStock });
    const R = {}; for (const k of Object.keys(users)) R[k] = await look(users[k].token);
    ok('EVERY user still gets the whole machinery list with what all pages use (number, name, type, make, unit, works on, owner, ownership, supply, status, dates, standard averages, tank capacity) – pick-lists and searches are built from it', Object.keys(R).every(k => !R[k].err && R[k].n === nMaster && R[k].common && R[k].always), Object.keys(R).map(k => k + ' ' + R[k].n + (R[k].common ? '' : ' MISSING')).join(', '));
    ok('[fix] NO-ACCESS user (no page at all): no monthly rate, no TDS %, no engine / chassis / paper dates, no driver, pump or vendor names, no stock (getInit, getLookups, getStock refused, daily brief)', R.none.rate.length === 0 && R.none.full.length === 0 && R.none.drivers.join() === '0,0' && R.none.pumps.join() === '0,0' && R.none.vendors === 0 && R.none.stockInit === 'null' && R.none.getStock === 'refused' && !R.none.brief, R.none.rate.concat(R.none.full).join(',') || { drivers: R.none.drivers, pumps: R.none.pumps, vendors: R.none.vendors, stock: R.none.stockInit, getStock: R.none.getStock });
    ok('[fix] MIXED – Diesel Issue only: drivers and stock (its page uses them) – but no rate, no TDS %, no engine / papers, no pump names, no vendor names', R.diesel.rate.length === 0 && R.diesel.full.length === 0 && R.diesel.drivers[0] > 0 && R.diesel.drivers[1] > 0 && R.diesel.stockInit === 'number' && R.diesel.getStock === 'number' && R.diesel.pumps.join() === '0,0' && R.diesel.vendors === 0, { rate: R.diesel.rate, details: R.diesel.full.length, drivers: R.diesel.drivers, pumps: R.diesel.pumps, vendors: R.diesel.vendors, stock: R.diesel.getStock });
    ok('[fix] MIXED – Reports only: pump names and stock (its reports use them) – no rate, no TDS %, no engine / papers, no drivers, no vendor names', R.report.rate.length === 0 && R.report.full.length === 0 && R.report.pumps[0] > 0 && R.report.getStock === 'number' && R.report.drivers.join() === '0,0' && R.report.vendors === 0, { rate: R.report.rate, pumps: R.report.pumps, drivers: R.report.drivers, stock: R.report.getStock });
    ok('[fix] MIXED – Vendor Master + Dashboard: stock (the Dashboard shows it) – no rate, no TDS %, no engine / papers, no drivers / pumps', R.vend.rate.length === 0 && R.vend.full.length === 0 && R.vend.getStock === 'number' && R.vend.drivers.join() === '0,0' && R.vend.pumps.join() === '0,0', { rate: R.vend.rate, stock: R.vend.getStock });
    ok('EDIT user (Diesel Issue, Log Book, Diesel Inward): rate and TDS % (the Log Book print uses them), drivers, pumps, vendor names (Debit to), stock – but not engine / chassis / paper dates (Asset Master only)', R.edit.rate.length === 2 && R.edit.m.monthlyRate === 55555 && R.edit.full.length === 0 && R.edit.drivers[0] > 0 && R.edit.pumps[0] > 0 && R.edit.vendors > 0 && R.edit.getStock === 'number', { rate: R.edit.m.monthlyRate, details: R.edit.full.length, drivers: R.edit.drivers[0], pumps: R.edit.pumps[0], vendors: R.edit.vendors });
    ok('Machinery Billing user: rate, TDS % and vendor names – not engine / papers, drivers, pumps or stock', R.bill.rate.length === 2 && R.bill.full.length === 0 && R.bill.vendors > 0 && R.bill.drivers.join() === '0,0' && R.bill.pumps.join() === '0,0' && R.bill.getStock === 'refused', { rate: R.bill.rate, vendors: R.bill.vendors, stock: R.bill.getStock });
    ok('VIEW-ONLY user (View on every page): everything, as the Admin – View is access to the page', R.view.rate.length === 2 && R.view.full.length === FULL.length && R.view.m.engineNo === 'ENG-S68' && R.view.drivers[0] === A.drivers[0] && R.view.pumps[0] === A.pumps[0] && R.view.vendors === A.vendors && R.view.getStock === 'number' && R.view.brief, { rate: R.view.m.monthlyRate, engine: R.view.m.engineNo });
    // no other action gives the details by the side: a machinery item inside ANY answer is cut the same way
    const today = sql("select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')"), from = today.slice(0, 8) + '01';
    const ledR = await api(users.report.token, 'rptLedger', [{ no: 'MH-15-AB-0004', from: from, to: today }]), ledA = await api(admin, 'rptLedger', [{ no: 'MH-15-AB-0004', from: from, to: today }]);
    const edU = await api(users.edit.token, 'getLogEditData', ['MH-15-AB-0004', from, today]), edA = await api(admin, 'getLogEditData', ['MH-15-AB-0004', from, today]);
    const mR = (ledR.result || {}).machine || {}, mA = (ledA.result || {}).machine || {}, mE = (edU.result || {}).machine || {}, mEA = (edA.result || {}).machine || {};
    ok('[fix] other answers too: the machinery inside a REPORT (Stock ledger) for a Reports-only user has no rate / TDS % / engine; inside "Edit Log Book" a Log Book user gets the rate but not the engine; the Admin gets all', !ledR.error && !edU.error && mR.id === 'MH-15-AB-0004' && !('monthlyRate' in mR) && !('tdsRate' in mR) && !('engineNo' in mR) && mE.monthlyRate === 55555 && !('engineNo' in mE) && mA.monthlyRate === 55555 && mA.engineNo === 'ENG-S68' && mEA.engineNo === 'ENG-S68',
      ledR.error || edU.error || { report_user: Object.keys(mR).length + ' fields, rate ' + ('monthlyRate' in mR), log_user: 'rate ' + mE.monthlyRate + ', engine ' + ('engineNo' in mE), admin: Object.keys(mA).length + ' fields' });
    // text search of the answers: the figures themselves are nowhere in what a limited user is sent
    const dump = async t => JSON.stringify([(await api(t, 'getInit')).result, (await api(t, 'getLookups')).result, (await api(t, 'sync')).result, (await api(t, 'getBrief')).result, (await api(t, 'globalSearch', ['0004'])).result]);
    const dN = await dump(users.none.token), dD = await dump(users.diesel.token), dAd = await dump(admin);
    ok('the values themselves ("55555", "ENG-S68", "CHS-S68") are nowhere in what the no-access and the diesel-only user are sent (getInit, getLookups, sync, brief, search) – they are in the Admin\'s', !/55555|ENG-S68|CHS-S68/.test(dN) && !/55555|ENG-S68|CHS-S68/.test(dD) && /55555/.test(dAd) && /ENG-S68/.test(dAd), { none_bytes: dN.length, diesel_bytes: dD.length, admin_bytes: dAd.length });
    // legitimate work is not broken: the limited users still do their job
    const di = await api(users.diesel.token, 'saveDieselIssue', [{ date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: 'S68 driver', qty: 2, kmReading: 99990 + Math.floor(Math.random() * 9), force: true }]);
    const diList = await api(users.diesel.token, 'getDieselIssues', [{ from: today, to: today }]), nope = await api(users.diesel.token, 'getLogEditData', ['MH-15-AB-0004', from, today]), vv = await api(users.vend.token, 'getVendors');
    ok('work goes on: the diesel-only user saves and lists a Diesel Issue (and the save answers with the new stock); the page access itself is as before (Log Book refused for him; Vendor Master opens for the vendor user)', !di.error && di.result.stock && typeof di.result.stock.stock === 'number' && !diList.error && /do not have access/.test(nope.error || '') && !vv.error, { save: di.error || di.result.id, list: diList.error || 'ok', log_book: nope.error, vendors: vv.error || 'ok' });
    if (di.result && di.result.id) await api(admin, 'deleteDieselIssue', [di.result.id]);
    if (seed.result && seed.result.id) await api(admin, 'deleteDieselIssue', [seed.result.id]);
    const adminOnly = await api(users.view.token, 'usersAdmin'), noEdit = await api(users.view.token, 'saveDieselIssue', [{ date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 1, kmReading: 1 }]);
    ok('permissions are untouched: View-only still cannot save, a user still cannot open Admin pages', /View access only/.test(noEdit.error || '') && /Only Admin/.test(adminOnly.error || ''), { save: noEdit.error, admin_page: adminOnly.error });
  }

  if (on('rollback')) {
    console.log('\n=== D2 – GOING BACK TO THE CODE BEFORE update-68 (what it means for passwords) ===');
    let old = false; try { old = (await fetch('http://127.0.0.1:' + OLD_PORT + '/')).status === 200; } catch (e) { old = false; }
    if (!old) console.log('SKIPPED – no server of the code before update-68 on port ' + OLD_PORT + ' (start one to run this section)');
    else {
      fewer();
      const u = await makeUser('back', { '*': 'View' }), kept = stored(u.email);
      const o1 = await login(u.email, u.pw, OLD_PORT), o2 = await login(u.email, kept, OLD_PORT);
      ok('MEASURED on the code before: a user whose password is kept with scrypt cannot sign in there with the password (the old code cannot read it) – going back locks such users out', /Wrong email or password/.test(o1.error || ''), o1.error || 'SIGNED IN');
      ok('MEASURED on the code before: it takes the kept TEXT itself for a plain password (whoever has a copy of the Users table could sign in with it) – so before going back the scrypt passwords must be replaced (the SQL in UPDATE_68.md)', !o2.error && o2.result.mustChange === true, o2.error || 'accepted, mustChange ' + o2.result.mustChange);
      // the documented way back: every scrypt password is replaced by a random unusable value, the Admin gets a one-time password
      sql("update app_users set password_hash = 'tmp$sha256$' || substr(md5(random()::text), 1, 16) || '$' || md5(random()::text) || md5(random()::text) where id = '" + u.email + "' and password_hash ~ '^(tmp\\$)?scrypt\\$'; delete from web.cache where key = 'USERS_LIST' or key like 'F\\_" + TAG + "%';"); await wait(1300);
      const o3 = await login(u.email, kept, OLD_PORT), o4 = await login(u.email, u.pw, OLD_PORT);
      sql("update app_users set password_hash = 'Back#OneTime7' where id = '" + u.email + "'; delete from web.cache where key = 'USERS_LIST' or key like 'F\\_" + TAG + "%';"); await wait(1300);
      const o5 = await login(u.email, 'Back#OneTime7', OLD_PORT), o6 = o5.result ? await raw(OLD_PORT, { fn: 'changePassword', args: [o5.result.token, 'Back#OneTime7', 'Back#Own97531'] }) : { error: 'no session' };
      ok('the documented way back, on the code before: after the SQL nobody can sign in with a kept text or an old password; a one-time password set by SQL signs the person in, must be changed, and the change works', !!o3.error && !!o4.error && !o5.error && o5.result.mustChange === true && !o6.error, { kept_text: o3.error, old_pw: o4.error, one_time: o5.error || 'in', change: o6.error || 'done' });
      // forward again: the new code reads what the old code wrote
      await wait(1300); const n1 = await login(u.email, 'Back#Own97531'), sN = stored(u.email);
      ok('forward again (update-68 after a time on the old code): the password the old code kept is accepted and kept with scrypt at that sign-in', !n1.error && SCRYPT.test(sN), n1.error || sN.slice(0, 30) + '…');
    }
  }

  cleanUp();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); try { cleanUp(); } catch (x) {} process.exit(1); });
