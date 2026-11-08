'use strict';
/* RELEASE CHECK 3 – update-68 on the REAL Vercel runtime (a Preview deployment), before production.
 *
 * It needs NOTHING installed: Node 18 or newer (the one that is already on the PC). It talks to
 *     - the Preview deployment (its link)                      → the app, exactly as a browser would
 *     - the TEST database of that Preview (its own Supabase)   → to prepare a user with an old password and to look at results
 * It NEVER touches production. It refuses to start when
 *     - the link is the production link,
 *     - the database is the one of this folder's .env.local,
 *     - the database does not say of itself "I am a test database" (a row the owner puts there once – see below),
 *     - the Preview is not reading from that very test database (proved with a random word BEFORE anything is saved).
 *
 * ONCE, in the TEST Supabase project (SQL Editor), after the SQL steps 1 … 5 of sql/ :
 *     insert into public.app_settings (id, value) values ('THIS_IS_A_TEST_DATABASE', 'yes') on conflict (id) do update set value = 'yes';
 *
 * RUN (PowerShell, in the project folder):
 *     $env:PREVIEW_URL       = "https://<the preview link>.vercel.app"
 *     $env:TEST_SUPABASE_URL = "https://<test project>.supabase.co"
 *     $env:TEST_SUPABASE_KEY = "<secret key of the TEST project>"
 *     $env:VERCEL_BYPASS     = "<only if the Preview asks for a Vercel login: the 'Protection Bypass for Automation' secret>"
 *     node test/preview-smoke.js
 * The keys are read from the environment only; they are never printed and never written anywhere.
 * At the end it removes what it made (its users, its machinery, its diesel receipt) from the TEST database. */
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const URL_APP = String(process.env.PREVIEW_URL || '').replace(/\/+$/, ''), SB = String(process.env.TEST_SUPABASE_URL || '').replace(/\/+$/, ''), KEY = String(process.env.TEST_SUPABASE_KEY || ''), BYPASS = String(process.env.VERCEL_BYPASS || '');
const PROD_HOSTS = ['rclerp.vercel.app'].concat(String(process.env.PRODUCTION_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const lines = [];
const say = s => { lines.push(s); console.log(s); };
const ok = (name, cond, extra) => { cond ? pass++ : fail++; say((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400) : '')); };
const stop = msg => { console.log('\nSTOPPED – nothing was saved anywhere.\n' + msg); process.exit(2); };
const host = u => { try { return new URL(u).host.toLowerCase(); } catch (e) { return ''; } };
const local = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host(URL_APP));

// ---------- the app (through the Preview link) ----------
const app = async body => { const t = Date.now(); let r, txt;
  try { r = await fetch(URL_APP + '/api/rpc', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}), body: JSON.stringify(body) }); txt = await r.text(); }
  catch (e) { return { status: 0, error: 'NO ANSWER: ' + String((e && e.cause && e.cause.code) || (e && e.message) || e), ms: Date.now() - t }; }
  let j = null; try { j = JSON.parse(txt); } catch (e) { j = null; }
  if (!j) return { status: r.status, error: (r.status === 401 || /vercel/i.test(txt.slice(0, 2000)) ? 'The Preview asks for a Vercel login (Deployment Protection). Set VERCEL_BYPASS, or switch the protection off for this test. ' : 'not JSON ') + '(HTTP ' + r.status + ')', ms: Date.now() - t };
  return { status: r.status, error: j.error, result: j.result, ms: Date.now() - t }; };
const login = (email, pw) => app({ fn: 'login', args: [email, pw] });
const api = (token, fn, args, rid) => app(Object.assign({ fn: 'api', args: [token, fn, args || []] }, rid ? { rid: rid } : {}));
// ---------- the TEST database (its own REST door, with its own key) ----------
const H = () => Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, /^eyJ/.test(KEY) ? { Authorization: 'Bearer ' + KEY } : {});
const db = async (method, p, body, extra) => { const r = await fetch(SB + '/rest/v1/' + p, { method: method, headers: Object.assign(H(), extra || {}), body: body === undefined ? undefined : JSON.stringify(body) }); const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; } if (r.status >= 300) throw new Error('test database ' + method + ' ' + p.split('?')[0] + ': ' + r.status + ' ' + String(txt).slice(0, 160)); return j; };
const rpc = (name, args) => db('POST', 'rpc/' + name, args || {});
const kept = async email => { const r = await db('GET', 'app_users?select=password_hash&id=eq.' + encodeURIComponent(email)); return (r && r[0] && r[0].password_hash) || ''; };
const count = async (table, q) => (await db('GET', table + '?select=id&' + q)).length;
const oldHash = (pw, salt) => { let x = crypto.createHash('sha256').update(salt + '|' + pw, 'utf8').digest(); for (let i = 0; i < 300; i++) x = crypto.createHash('sha256').update(Buffer.concat([x, Buffer.from(salt, 'utf8')])).digest(); return 'sha256$' + salt + '$' + x.toString('hex'); };
const SCRYPT = /^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{64}\$[0-9a-f]{12}$/;
const scryptOk = (pw, s) => { const p = s.replace(/^tmp\$/, '').split('$'); return crypto.scryptSync(Buffer.from(pw, 'utf8'), Buffer.from(p[4], 'hex'), 32, { N: Number(p[1]), r: Number(p[2]), p: Number(p[3]), maxmem: 160 * 1024 * 1024 }).toString('hex') === p[5]; };
const rid = () => 'pv' + Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
const TAG = 'pv68' + Date.now().toString(36), ADMIN = TAG + '-old@rcl.test', USER = TAG + '-user@rcl.test', PW = 'Preview#Old2468', MACH = 'PV68-' + Date.now().toString(36).toUpperCase();

(async () => {
  // ================= may this run at all? =================
  if (!URL_APP || !SB || !KEY) stop('Set PREVIEW_URL, TEST_SUPABASE_URL and TEST_SUPABASE_KEY first (see the top of this file).');
  if (PROD_HOSTS.indexOf(host(URL_APP)) > -1) stop('"' + host(URL_APP) + '" is the PRODUCTION link. This test is for a Preview deployment only.');
  if (!local && !/^https:\/\//.test(URL_APP)) stop('PREVIEW_URL must start with https://');
  try { const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8'), m = env.match(/^\s*SUPABASE_URL\s*=\s*["']?([^"'\s]+)/m);
    if (m && host(m[1]) === host(SB) && !local && process.env.ENV_LOCAL_IS_TEST !== 'yes') stop('TEST_SUPABASE_URL is the database of this folder\'s .env.local (' + host(SB) + '). If that is the live database, do not go on. Use the separate TEST project.'); } catch (e) { /* no .env.local here: nothing to compare with */ }
  let marker = null; try { marker = await db('GET', 'app_settings?select=value&id=eq.THIS_IS_A_TEST_DATABASE'); } catch (e) { stop('The test database cannot be read with the key given: ' + e.message); }
  if (!(marker && marker[0] && marker[0].value === 'yes')) stop('This database does not say "I am a test database". In the TEST project (never in the live one) run once:\n  insert into public.app_settings (id, value) values (\'THIS_IS_A_TEST_DATABASE\', \'yes\') on conflict (id) do update set value = \'yes\';');
  // the Preview must be reading from THIS database: a random word is put into the test database's settings and must come back through the Preview
  const before = ((await rpc('web_boot', { p_keys: [] })) || {}).props || {}, orgWas = before.ORG_SETTINGS;
  const word = 'PREVIEW-TEST-' + crypto.randomBytes(5).toString('hex');
  let org = {}; try { org = JSON.parse(orgWas || '{}') || {}; } catch (e) { org = {}; }
  const restoreOrg = () => rpc('web_props_set', { p: { ORG_SETTINGS: orgWas === undefined || orgWas === null ? '{}' : orgWas } });
  await rpc('web_props_set', { p: { ORG_SETTINGS: JSON.stringify(Object.assign({}, org, { customer: word })) } });
  let seen = null; for (let i = 0; i < 6; i++) { await wait(1500); seen = await app({ fn: 'orgInfo', args: [] }); if (seen.result && seen.result.customer === word) break; }
  await restoreOrg();
  if (seen.error && !seen.result) stop('The Preview did not answer: ' + seen.error);
  if (!(seen.result && seen.result.customer === word)) stop('The Preview deployment is NOT reading from the test database you gave (it answered with "' + String(seen.result && seen.result.customer).slice(0, 60) + '").\nCheck Vercel → Settings → Environment Variables: SUPABASE_URL and SUPABASE_SECRET_KEY for the PREVIEW environment must be those of the TEST project, then redeploy the Preview.');
  say('preview: ' + host(URL_APP) + ' · test database: ' + host(SB) + ' · the Preview reads from this test database (proved with a random word) · app version ' + (seen.result.build || ''));

  const made = { users: [ADMIN, USER], inward: [], master: [] };
  const cleanUp = async () => { const tryIt = async f => { try { await f(); } catch (e) { say('clean-up: ' + String(e.message).slice(0, 140)); } };
    for (const e of made.users) { await tryIt(() => db('DELETE', 'activity_log?email=eq.' + encodeURIComponent(e))); await tryIt(() => db('DELETE', 'app_users?id=eq.' + encodeURIComponent(e))); await tryIt(() => rpc('web_uncount', { p_key: 'F_' + e })); }
    for (const id of made.inward) await tryIt(() => db('DELETE', 'diesel_inward?id=eq.' + encodeURIComponent(id)));
    for (const id of made.master) await tryIt(() => db('DELETE', 'master?id=eq.' + encodeURIComponent(id)));
    await tryIt(() => db('DELETE', 'activity_log?record_id=in.(' + made.inward.concat(made.master).map(x => '"' + x + '"').join(',') + ')'));
    await tryIt(() => rpc('web_cache_set', { p_put: [], p_del: ['USERS_LIST'] })); };
  try {
    // ================= 1 – 4. an OLD SHA-256 password on the real runtime =================
    say('\n=== PASSWORDS (scrypt on the Vercel runtime) ===');
    const h0 = oldHash(PW, crypto.randomBytes(8).toString('hex'));
    await db('POST', 'app_users', [{ id: ADMIN, email: ADMIN, name: 'Preview Old', active: 'Yes', admin: 'Yes', password_hash: h0 }], { Prefer: 'return=minimal' });
    await rpc('web_cache_set', { p_put: [], p_del: ['USERS_LIST'] }); await wait(1500);
    const l1 = await login(ADMIN, PW), admin = l1.result && l1.result.token;
    ok('1. a user with an OLD SHA-256 password signs in (no "must change")', !l1.error && !!admin && l1.result.mustChange === false, l1.error || 'in, ' + l1.ms + ' ms');
    if (!admin) throw new Error('no sign-in – the rest cannot run: ' + l1.error);
    const h1 = await kept(ADMIN);
    ok('2. that sign-in moved the password to scrypt (N=32768, r=8, p=3) – the same password, checked here independently', SCRYPT.test(h1) && scryptOk(PW, h1) && !scryptOk(PW + 'x', h1), { before: h0.slice(0, 14) + '…', after: h1.slice(0, 22) + '…' });
    const times = []; let l2 = null; for (let i = 0; i < 3; i++) { l2 = await login(ADMIN, PW); times.push(l2.ms); }
    ok('3. the same user signs in again (three times); the kept password is not written again', !l2.error && (await kept(ADMIN)) === h1, l2.error || 'sign-in times ' + times.join(', ') + ' ms');
    const w = await login(ADMIN, PW + '!'), w2 = await login(ADMIN, h1);
    ok('4. a wrong password is refused – and so is the kept text typed as the password', /Wrong email or password/.test(w.error || '') && /Wrong email or password/.test(w2.error || ''), { wrong: w.error || 'SIGNED IN', kept_text: w2.error || 'SIGNED IN', ms: w.ms });
    await rpc('web_uncount', { p_key: 'F_' + ADMIN });
    const burst = await Promise.all([login(ADMIN, PW), login(ADMIN, PW), login(ADMIN, PW), login(ADMIN, PW)]);
    ok('   four sign-ins at the same moment (scrypt four times at once on the runtime): all answered', burst.every(x => !x.error), burst.map(x => x.error || x.ms + ' ms').join(', '));

    // ================= 5. the one-time password =================
    say('\n=== ONE-TIME PASSWORD ===');
    const init0 = await api(admin, 'usersAdmin'), perms = {}; ((init0.result && init0.result.modules) || []).forEach(m => { perms[m.key || m] = 'View'; });
    const mk = await api(admin, 'saveUserAdmin', [{ email: USER, name: 'Preview User', active: true, admin: false, perms: perms, isNew: true, newPassword: 'Temp#Preview1' }]), ht = await kept(USER);
    const lt = await login(USER, 'Temp#Preview1'), blocked = await api(lt.result && lt.result.token, 'getInit');
    const ch = lt.result ? await app({ fn: 'changePassword', args: [lt.result.token, 'Temp#Preview1', 'Own#Preview2468'] }) : { error: 'no session' };
    const user = ch.result && ch.result.token, opened = await api(user, 'getInit'), hu = await kept(USER);
    ok('5. one-time password: kept as "tmp$scrypt$…" (never as typed); the sign-in says "must change" and the server opens nothing; after the change the app opens and the password is kept with scrypt',
      !mk.error && /^tmp\$scrypt\$32768\$8\$3\$/.test(ht) && ht.indexOf('Temp#Preview1') === -1 && !lt.error && lt.result.mustChange === true && blocked.error === 'SESSION_EXPIRED' && !ch.error && !opened.error && SCRYPT.test(hu),
      { made: mk.error || 'yes', kept: ht.slice(0, 20) + '…', mustChange: lt.result && lt.result.mustChange, before_change: blocked.error || 'OPENED', change: ch.error || 'done', after: opened.error || 'opens' });

    // ================= 6. the session =================
    say('\n=== SESSION ===');
    const c = (await rpc('web_cache_get', { p_keys: ['S_' + admin] })) || {}, val = String(c['S_' + admin] || ''), parts = val.split('|');
    ok('6. the session carries its sign-in time ("e-mail | stamp | time") – the 30 days count from it', parts.length === 3 && parts[0] === ADMIN && parts[1] === h1.slice(-12) && Math.abs(Number(parts[2]) - Date.now()) < 15 * 60000, parts.length === 3 ? { email: parts[0], stamp: parts[1], signed_in: new Date(Number(parts[2])).toISOString() } : 'value has ' + parts.length + ' parts');

    // ================= 7. the app starts =================
    say('\n=== THE APP STARTS ===');
    const gi = await api(admin, 'getInit'), R = gi.result || {};
    const dbh = await api(admin, 'dbHealth'), step5 = ((dbh.result && dbh.result.checks) || []).find(x => /step 5/.test(x.name)) || {};
    ok('7. getInit answers with everything the page needs (user, machinery list, versions, today, rules, locations)', !gi.error && R.user && R.user.email === ADMIN && Array.isArray(R.master) && R.versions && /^\d{4}-\d{2}-\d{2}$/.test(R.today || '') && Array.isArray(R.locations), gi.error || { machinery: R.master.length, today: R.today, ms: gi.ms });
    ok('   the Database check of the app shows step 5 ("a save is saved once") as installed', step5.ok === true, step5.ok === true ? 'installed' : 'NOT installed in the test database – run sql/supabase_step5_save_once.sql there (' + (step5.note || dbh.error || '') + ')');
    const ug = await api(user, 'getInit'), um = ((ug.result && ug.result.master) || [])[0] || {};
    ok('   the normal user\'s start-up answer comes too (View access on every page)', !ug.error && ug.result.user.admin === false, ug.error || 'ok');

    // ================= 8 – 9. a save, and the same save sent again =================
    say('\n=== A SAVE WITH STEP 5, AND THE SAME SAVE AGAIN ===');
    const id1 = rid(), m1 = { no: MACH, name: 'Preview test', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Preview Owner', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: R.today };
    const s1 = await api(admin, 'saveMaster', [m1, 'add'], id1); made.master.push(MACH);
    const probe1 = await rpc('web_op_begin', { p_rid: id1, p_hash: 'a-different-fingerprint', p_holder: 'preview-probe' });
    ok('8. a save works (a machinery added) and its number is IN the database as "done" (step 5 took it)', !s1.error && (await count('master', 'id=eq.' + encodeURIComponent(MACH))) === 1 && probe1 && probe1.state === 'done' && probe1.same === false && probe1.result === null, s1.error || { saved: MACH, number: probe1 && probe1.state, ms: s1.ms });
    const s1b = await api(admin, 'saveMaster', [m1, 'add'], id1);
    ok('9. the SAME request sent again (same number): answered "saved" again, nothing saved twice', !s1b.error && s1b.result && s1b.result.ok === true && (await count('master', 'id=eq.' + encodeURIComponent(MACH))) === 1, s1b.error || 'one row');
    // an entry with its own number series: Diesel Inward (IN-…)
    const props0 = ((await rpc('web_boot', { p_keys: [] })) || {}).props || {}, n0 = Number(props0.INWARD_LAST_NO || 0);
    const id2 = rid(), inw = { date: R.today, location: R.locations[0], pump: 'Preview pump ' + TAG, qty: 10, rate: 1, billNo: 'PV-' + TAG, billDate: R.today };
    const two = await Promise.all([api(admin, 'saveInward', [inw], id2), api(admin, 'saveInward', [inw], id2)]);
    const s3 = await api(admin, 'saveInward', [inw], id2);
    const idIn = (two[0].result && two[0].result.id) || (two[1].result && two[1].result.id) || ''; if (idIn) made.inward.push(idIn);
    const n1 = Number((((await rpc('web_boot', { p_keys: [] })) || {}).props || {}).INWARD_LAST_NO || 0), rowsIn = await count('diesel_inward', 'pump_name=eq.' + encodeURIComponent(inw.pump));
    ok('   a Diesel Inward sent TWICE AT THE SAME MOMENT and once more afterwards (same number): one entry, one IN- number, three times the same answer', two.every(x => !x.error) && !s3.error && two[0].result.id === two[1].result.id && s3.result.id === idIn && rowsIn === 1 && n1 === n0 + 1, { answers: two.map(x => x.error || x.result.id).concat(s3.error || s3.result.id), rows: rowsIn, numbers_taken: n1 - n0 });
    const s4 = await api(admin, 'saveInward', [Object.assign({}, inw, { qty: 99 })], id2);
    ok('   the same number with OTHER data is refused (not saved, not answered with the first answer)', /different entry/.test(s4.error || '') && (await count('diesel_inward', 'pump_name=eq.' + encodeURIComponent(inw.pump))) === 1, s4.error || 'ANSWERED');
    if (idIn) { const del = await api(admin, 'deleteInward', [idIn]); if (!del.error) made.inward = []; }

    // ================= 10 – 11. the backup by hand =================
    say('\n=== BACKUP BY HAND ===');
    // SAFETY: the test never lets a backup really run. It first takes the backup's own lock in the TEST database: if a Google
    // Sheet were configured for the Preview (it must not be), the Admin's "Backup" is then answered "one is running" and
    // NOTHING is written to any Sheet. With no Sheet configured the answer is "not set up". Either way the server did not REFUSE him.
    const lock = await rpc('web_lock', { p_name: 'backup', p_holder: 'preview-smoke', p_ttl: 120 });
    const bu = await api(user, 'backupNow');
    let ba = { error: 'not tried: the backup\'s lock could not be taken, so the test did not risk a real backup' };
    if (lock && lock.ok) { ba = await api(admin, 'backupNow'); await rpc('web_unlock', { p_name: 'backup', p_holder: 'preview-smoke' }); }
    const notSetUp = /not set up/i.test(ba.error || ''), busy = !!(ba.result && ba.result.busy);
    ok('10. the Admin may start a backup: the server does not refuse him (no backup was really made by this test)', (notSetUp || busy) && !/Only Admin/.test(ba.error || ''), notSetUp ? 'allowed – no Google Sheet is set up for the Preview (as it should be)' : busy ? 'allowed – but A GOOGLE SHEET IS CONFIGURED for the Preview (see the note below)' : (ba.error || JSON.stringify(ba.result)).slice(0, 160));
    ok('11. a normal signed-in user cannot: "Only Admin can start a backup."', /Only Admin can start a backup/.test(bu.error || ''), bu.error || 'RAN');
    if (busy) say('NOTE  The Preview environment has GOOGLE_SERVICE_ACCOUNT_JSON / BACKUP_SHEET_ID. If that is the LIVE backup Sheet, a Preview opened in a browser would copy the TEST database into it. In Vercel set these two variables to "Production" only.');
  } catch (e) { fail++; say('CRASH ' + String((e && e.stack) || e).slice(0, 600)); }
  finally { await cleanUp(); try { await restoreOrg(); } catch (e) { /* restored above already */ } }
  say('\n' + pass + ' passed, ' + fail + ' failed   (' + new Date().toISOString() + ', ' + host(URL_APP) + ')');
  try { fs.writeFileSync(path.join(process.cwd(), 'preview-smoke-result.txt'), lines.join('\n') + '\n'); console.log('(the lines above are also in preview-smoke-result.txt – send that file back)'); } catch (e) { /* shown on screen anyway */ }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
