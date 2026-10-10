/* RELEASE CHECK 1 – going BACK from update-68 is safe (passwords kept with scrypt).
 * On the local test rig, three versions of the app's server on the SAME database:
 *     NEW  (port 3000)  update-68
 *     SAFE (port 3003)  update-65s = update-65 + "can read a scrypt password"  → the version to go back to
 *     OLD  (port 3002)  the exact update-65 that is live today                  → shown only to measure the hazard
 * A user is moved to scrypt by a sign-in on NEW; then the "rollback" is: the same user on SAFE (and on OLD).
 *   node test/rollback68.js            SAFE_PORT / OLD_PORT can be set; without OLD the hazard lines are skipped and say so.
 * Nothing here touches the live database. */
const { execSync } = require('child_process'); const crypto = require('crypto');
const NEW = Number(process.env.PORT) || 3000, SAFE = Number(process.env.SAFE_PORT) || 3003, OLD = Number(process.env.OLD_PORT) || 3002;
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA -q"', { input: q, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
const raw = async (port, body) => { const t = Date.now(); const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) });
  let j; const txt = await r.text(); try { j = JSON.parse(txt); } catch (e) { j = { error: 'no JSON (' + r.status + ')' }; } return { status: r.status, error: j.error, result: j.result, ms: Date.now() - t }; };
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 520) : '')); };
const note = (name, extra) => console.log('MEASURED ' + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 520) : ''));
const ADMIN = ['sujit@rcl.test', 'Nashik#Road848!'];
const TAG = 'rb68' + Date.now().toString(36);
const MODULES = ['Dashboard', 'Vendor Master', 'Master', 'Vendor BOQ', 'Vehicle Compliance', 'Breakdown', 'Diesel Inward', 'Diesel Transfer', 'Diesel Issue', 'Log Book', 'Machinery Billing', 'Saved Bills', 'Bill Summary', 'Machinery Payments', 'Vendor Ledger', 'Vendor Outstanding', 'Reports'];
const login = (port, email, pw) => raw(port, { fn: 'login', args: [email, pw] });
const api = (port, token, fn, args) => raw(port, { fn: 'api', args: [token, fn, args || []] });
const stored = email => sql("select password_hash from app_users where id = '" + email + "'");
const fresh = () => sql("delete from web.cache where key = 'USERS_LIST' or key like 'LG\\_%' or key like 'LGL\\_%' or key like 'F\\_rb68%' or key like 'CPF\\_rb68%'");
const setStored = async (email, v) => { sql("update app_users set password_hash = $q$" + v + "$q$ where id = '" + email + "'"); fresh(); await wait(1300); };
const oldHash = (pw, salt) => { let x = crypto.createHash('sha256').update(salt + '|' + pw, 'utf8').digest(); for (let i = 0; i < 300; i++) x = crypto.createHash('sha256').update(Buffer.concat([x, Buffer.from(salt, 'utf8')])).digest(); return 'sha256$' + salt + '$' + x.toString('hex'); };
const SCRYPT = /^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{64}\$[0-9a-f]{12}$/;
const up = async port => { try { return (await fetch('http://127.0.0.1:' + port + '/')).status === 200; } catch (e) { return false; } };
const cleanUp = () => { try { sql("delete from activity_log where email like 'rb68%@rcl.test'; delete from app_users where id like 'rb68%@rcl.test'; delete from web.cache where key like 'F\\_rb68%' or key like 'CPF\\_rb68%' or key like 'LG\\_%';"); } catch (e) {} };

(async () => {
  if (!(await up(NEW)) || !(await up(SAFE))) { console.log('needs update-68 on port ' + NEW + ' and update-65s on port ' + SAFE); process.exit(1); }
  const hasOld = await up(OLD);
  cleanUp(); fresh();
  // the Admin signs in on NEW: from this moment his own password is kept with scrypt too
  let r = await login(NEW, ADMIN[0], ADMIN[1]); const adminNew = r.result && r.result.token; ok('the Admin signs in on update-68 (his password is now kept with scrypt)', !!adminNew && SCRYPT.test(stored(ADMIN[0])), r.error || stored(ADMIN[0]).slice(0, 24) + '…');
  const mkUser = async (name, pw) => { const email = TAG + name + '@rcl.test', p = {}; MODULES.forEach(m => { p[m] = 'View'; });
    const a = await api(NEW, adminNew, 'saveUserAdmin', [{ email, name: 'RB ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]); if (a.error) throw new Error(a.error);
    if (pw) await setStored(email, oldHash(pw, '03df218ade11434e')); return email; };

  console.log('\n=== A. A USER WITH TODAY\'S PASSWORD (old sha256), BEFORE ANY MIGRATION ===');
  const pw = 'Site#Office2468', u1 = await mkUser('u1', pw), h0 = stored(u1);
  const b1 = await login(SAFE, u1, pw), b2 = hasOld ? await login(OLD, u1, pw) : { error: 'skipped' };
  { const t0 = [], t1 = []; for (let i = 0; i < 3; i++) { t1.push((await login(SAFE, 'nobodyA' + i + TAG + '@rcl.test', 'Some#Pass1234')).ms); t0.push((await login(SAFE, u1, 'Wrong#Old' + i)).ms); }
    const md = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]; sql("delete from web.cache where key = 'F_" + u1 + "'"); await wait(300);
    ok('[safe] update-65s, a password kept the old way: a wrong password takes the same work as an unknown e-mail (no quick "no" that tells which e-mails exist)', md(t0) > md(t1) * 0.5 && md(t0) < md(t1) * 2 && md(t0) > 60, { unknown_email_ms: md(t1), old_hash_wrong_pw_ms: md(t0) }); }
  ok('before the migration the user signs in on update-65s exactly as on update-65 (old hash, no "must change", the hash is left as it is)', !b1.error && b1.result.mustChange === false && (!hasOld || (!b2.error && b2.result.mustChange === false)) && stored(u1) === h0, { safe: b1.error || 'in', old: b2.error || 'in' });

  console.log('\n=== B. THE USER SIGNS IN ON update-68 → THE PASSWORD IS NOW KEPT WITH scrypt ===');
  fresh(); const m = await login(NEW, u1, pw), kept = stored(u1), t68 = m.result && m.result.token;
  ok('migrated: the kept text is now "scrypt$32768$8$3$…"', !m.error && SCRYPT.test(kept), kept.slice(0, 34) + '…');

  if (hasOld) {
    console.log('\n=== C. THE HAZARD – going back to the EXACT update-65 (measured, this is what must not happen) ===');
    fresh(); const o1 = await login(OLD, u1, pw), o2 = await login(OLD, u1, kept);
    note('exact update-65: the user\'s real password', o1.error || 'signed in');
    note('exact update-65: the KEPT TEXT typed as the password', o2.error ? o2.error : 'ACCEPTED – signed in (mustChange ' + o2.result.mustChange + ')');
    ok('the hazard is real on the exact update-65 (so that version must never be the one to go back to): real password refused, kept text accepted', /Wrong email or password/.test(o1.error || '') && !o2.error, { real_password: o1.error || 'in', kept_text: o2.error || 'ACCEPTED' });
  } else console.log('\n(C skipped – no exact update-65 on port ' + OLD + ')');

  console.log('\n=== D. ROLLBACK TO update-65s – the same database, the same migrated user ===');
  fresh();
  const variants = { 'the kept text': kept, '"tmp$" + the kept text': 'tmp$' + kept, 'the kept text without its stamp': kept.slice(0, -13), 'only its hash part': kept.split('$')[5], 'the kept text in capitals': kept.toUpperCase() };
  const tried = {}; for (const k of Object.keys(variants)) { const x = await login(SAFE, u1, variants[k]); tried[k] = x.error || 'ACCEPTED'; if (Object.keys(tried).length === 4) sql("delete from web.cache where key = 'F_" + u1 + "'"); }
  sql("delete from web.cache where key = 'F_" + u1 + "'");
  ok('[safe] the stored hash string is NOT a password on update-65s (the text itself, with "tmp$", cut, its hash part, in capitals): every one refused', Object.values(tried).every(v => /Wrong email or password/.test(v)), tried);
  const s1 = await login(SAFE, u1, pw), s2 = await login(SAFE, u1, pw + 'x'), s1init = await api(SAFE, s1.result && s1.result.token, 'getInit');
  ok('[safe] NOBODY IS LOCKED OUT: the user signs in on update-65s with the same password as always (no "must change"), the app opens; a wrong password is refused', !s1.error && s1.result.mustChange === false && !s1init.error && Array.isArray(s1init.result.master) && /Wrong email or password/.test(s2.error || ''), { right: s1.error || 'in', app: s1init.error || 'opens', wrong: s2.error });
  const s3 = await api(SAFE, t68, 'whoami'), s3b = await api(SAFE, t68, 'getInit');
  ok('[safe] the session the user had on update-68 goes on working after the rollback (nobody is thrown out in the middle of work)', !s3.error && !s3b.error, s3.error || s3b.error || 'works');
  ok('[safe] signing in on update-65s does not rewrite the password (it stays as update-68 kept it)', stored(u1) === kept);
  // the Admin himself (his password is scrypt too): he can work, so the normal recovery path exists
  fresh(); const a65 = await login(SAFE, ADMIN[0], ADMIN[1]), aUsers = await api(SAFE, a65.result && a65.result.token, 'usersAdmin');
  ok('[safe] the Admin (password kept with scrypt) signs in on update-65s and opens Users & Access – the normal way to help a user exists', !a65.error && a65.result.mustChange === false && !aUsers.error && (aUsers.result.users || []).some(x => x.email === u1), a65.error || aUsers.error || 'ok');
  // wrong tries still lock; a wrong e-mail takes the same work
  const tk = [], tu = []; for (let i = 0; i < 3; i++) { tu.push((await login(SAFE, 'nobody' + i + TAG + '@rcl.test', 'Some#Pass1234')).ms); tk.push((await login(SAFE, u1, 'Wrong#Pass' + i)).ms); }
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  await login(SAFE, u1, 'Wrong#3'); await login(SAFE, u1, 'Wrong#4'); const locked = await login(SAFE, u1, pw);
  ok('[safe] 5 wrong tries still lock the e-mail; a wrong e-mail takes the same work as a wrong password', /Too many wrong attempts/.test(locked.error || '') && med(tu) > med(tk) * 0.5 && med(tu) < med(tk) * 2, { after_5_wrong: locked.error, unknown_email_ms: med(tu), wrong_password_ms: med(tk) });
  sql("delete from web.cache where key = 'F_" + u1 + "'");
  // a damaged kept text
  await setStored(u1, kept.slice(0, -20) + 'zz' + kept.slice(-18));
  const d1 = await login(SAFE, u1, pw), d2 = await login(SAFE, u1, kept.slice(0, -20) + 'zz' + kept.slice(-18));
  ok('[safe] a damaged kept text opens for nothing on update-65s – not for the password, not for itself', !!d1.error && !!d2.error, { password: d1.error, itself: d2.error });
  await setStored(u1, kept);

  console.log('\n=== E. A ONE-TIME PASSWORD MADE ON update-68 (kept as "tmp$scrypt$…"), THEN THE ROLLBACK ===');
  fresh(); const u2 = await mkUser('u2', ''), k2 = stored(u2);
  if (hasOld) { const o = await login(OLD, u2, k2); note('exact update-65: the kept text of a one-time password typed as the password', o.error ? o.error : 'ACCEPTED'); fresh(); }
  const e1 = await login(SAFE, u2, k2), e1b = await login(SAFE, u2, k2.slice(4)), e2 = await login(SAFE, u2, 'Temp#u21');
  ok('[safe] the kept text of a one-time password is not a password either; the one-time password itself signs in and must be changed', /^tmp\$scrypt\$/.test(k2) && !!e1.error && !!e1b.error && !e2.error && e2.result.mustChange === true, { kept_text: e1.error, without_tmp: e1b.error, one_time: e2.error || 'in, mustChange ' + e2.result.mustChange });
  const e3 = await raw(SAFE, { fn: 'changePassword', args: [e2.result.token, 'Temp#u21', 'Chosen#Pass2468'] }), k2b = stored(u2), e4 = await login(SAFE, u2, 'Chosen#Pass2468'), e5 = await login(SAFE, u2, 'Temp#u21');
  ok('[safe] the forced change works on update-65s (kept the way update-65 keeps it: sha256$…); the new password signs in, the one-time one is dead', !e3.error && /^sha256\$[0-9a-f]{16}\$[0-9a-f]{64}$/.test(k2b) && !e4.error && e4.result.mustChange === false && !!e5.error, { change: e3.error || 'done', kept: k2b.slice(0, 22) + '…', new_pw: e4.error || 'in', one_time: e5.error });
  // the Admin helps a user on update-65s: a new one-time password (the documented recovery path, should anybody ever need it)
  const aTok = a65.result.token, rs = await api(SAFE, aTok, 'saveUserAdmin', [{ email: u1, name: 'RB u1', active: true, admin: false, perms: {}, newPassword: 'Help#1234' }]);
  fresh(); const f1 = await login(SAFE, u1, 'Help#1234'), f0 = await login(SAFE, u1, pw);
  ok('[safe] recovery path on update-65s: the Admin sets a one-time password in Users & Access → the user signs in with it and must change it; the former password is dead', !rs.error && !f1.error && f1.result.mustChange === true && !!f0.error, { reset: rs.error || 'done', one_time: f1.error || 'in', former: f0.error });
  const f2 = await raw(SAFE, { fn: 'changePassword', args: [f1.result.token, 'Help#1234', 'Again#Pass1357'] });

  console.log('\n=== F. FORWARD AGAIN TO update-68 (after the time on update-65s) ===');
  fresh(); const g1 = await login(NEW, u1, 'Again#Pass1357'), g2 = await login(NEW, u2, 'Chosen#Pass2468'), g3 = await login(NEW, ADMIN[0], ADMIN[1]);
  ok('update-68 reads everything update-65s wrote: both users and the Admin sign in, and the passwords update-65s kept the old way are kept with scrypt again at that sign-in', !f2.error && !g1.error && !g2.error && !g3.error && SCRYPT.test(stored(u1)) && SCRYPT.test(stored(u2)), { u1: g1.error || stored(u1).slice(0, 16), u2: g2.error || stored(u2).slice(0, 16), admin: g3.error || 'in' });
  const sess = await login(SAFE, u2, 'Chosen#Pass2468'), onNew = await api(NEW, sess.result && sess.result.token, 'whoami');
  ok('a session made on update-65s goes on working on update-68', !sess.error && !onNew.error, sess.error || onNew.error || 'works');

  console.log('\n=== G. A SAVE IN FLIGHT AT THE MOMENT OF A SWITCH (its copy reaches the OTHER version) ===');
  if (sql("select count(*) from pg_proc where proname = 'web_write2'") !== '1') console.log('(G skipped – the step-5 SQL is not installed in the test database)');
  else {
    const GW = 'http://127.0.0.1:3100/__fault', fault = f => fetch(GW, { method: 'POST', body: JSON.stringify(f || {}) });
    const rid = () => 'rb' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
    const rows = tag => Number(sql("select count(*) from diesel_issue where driver_name = '" + tag + "'")), lastNo = () => Number(sql("select value from web.props where key = 'DIESEL_LAST_NO'"));
    const today = sql("select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')"); let km = 99700 + Math.floor(Math.random() * 90);
    const entry = tag => ({ date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: tag, qty: 2, kmReading: ++km, force: true });
    const send = (port, e, id) => raw(port, { fn: 'api', args: [g3.result.token, 'saveDieselIssue', [e]], rid: id });      // the same sign-in on both versions, as the open page has it
    sql("delete from diesel_issue where driver_name like 'RB68-%'"); await fault();
    // forward: saved on update-65s (the old way), its copy reaches update-68
    let id = rid(), e = entry('RB68-fwd'), n0 = lastNo();
    const f1 = await send(SAFE, e, id), f2 = await send(NEW, e, id);
    ok('FORWARD (update-65s → update-68): a save done on update-65s whose copy reaches update-68 is answered from the old note – one entry, one number', !f1.error && !f2.error && f2.result.id === f1.result.id && rows('RB68-fwd') === 1 && lastNo() === n0 + 1 && sql("select count(*) from web.ops where rid = '" + id + "'") === '0', { first: f1.error || f1.result.id, copy_on_68: f2.error || f2.result.id, rows: rows('RB68-fwd') });
    // rollback: saved on update-68, its copy reaches update-65s – also after the 8 seconds of the double-click guard
    id = rid(); e = entry('RB68-back'); n0 = lastNo();
    const r1 = await send(NEW, e, id); await wait(9500); const r2 = await send(SAFE, e, id);
    ok('[safe] ROLLBACK (update-68 → update-65s): a save done on update-68 whose copy reaches update-65s 9 seconds later is answered from the note the database left – NOT saved again: one entry, one number', !r1.error && !r2.error && r2.result.id === r1.result.id && rows('RB68-back') === 1 && lastNo() === n0 + 1, { first: r1.error || r1.result.id, copy_on_65s: r2.error || r2.result.id, rows: rows('RB68-back'), numbers_taken: lastNo() - n0 });
    // the worst case: on update-68 the entry went in but its answer was lost; the page's copy arrives on update-65s
    id = rid(); e = entry('RB68-lost'); n0 = lastNo();
    await fault({ match: 'POST /rest/v1/rpc/web_write2', n: 1, after: true, drop: true });
    const l1 = await send(NEW, e, id); await fault(); await wait(9500); const l2 = await send(SAFE, e, id);
    ok('[safe] …also when the connection was cut right after the write on update-68: the copy on update-65s gets the same entry back – one entry, one number', !l2.error && rows('RB68-lost') === 1 && lastNo() === n0 + 1 && (l1.error || l1.result.id === l2.result.id), { first: l1.error || l1.result.id, copy_on_65s: l2.error || l2.result.id, rows: rows('RB68-lost'), numbers_taken: lastNo() - n0 });
    if (hasOld) { id = rid(); e = entry('RB68-old'); n0 = lastNo(); await setStored(ADMIN[0], oldHash(ADMIN[1], '03df218ade11434e'));
      const ao = await login(OLD, ADMIN[0], ADMIN[1]), an = await login(SAFE, ADMIN[0], ADMIN[1]);      // (a sign-in both versions can use: the password in its old form, made on update-65s)
      const o1 = await raw(NEW, { fn: 'api', args: [an.result.token, 'saveDieselIssue', [e]], rid: id }); await wait(9500); const o2 = await raw(OLD, { fn: 'api', args: [an.result.token, 'saveDieselIssue', [e]], rid: id });
      ok('the note works for the exact update-65 as well (shown for completeness – that version is not the one to go back to)', !ao.error && !o1.error && !o2.error && o2.result.id === o1.result.id && rows('RB68-old') === 1 && lastNo() === n0 + 1, { first: o1.error || o1.result.id, copy_on_65: o2.error || o2.result.id, rows: rows('RB68-old') }); }
    sql("delete from activity_log where record_id in (select id from diesel_issue where driver_name like 'RB68-%'); delete from diesel_issue where driver_name like 'RB68-%'; delete from web.locks;");
  }

  cleanUp();
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (hasOld ? '' : '   (hazard lines skipped: no exact update-65 running)'));
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); try { cleanUp(); } catch (x) {} process.exit(1); });
