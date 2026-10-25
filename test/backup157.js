/* update-157 – NUMBERED BACKUP SHEETS for every site and the Portal, with the Engineering and Portal data, on the local test rig
 * against the Sheets stand-in (test/sheets-standin.js). Nothing here touches a live database or a real Google Sheet.
 * Before: the rig in Portal mode with the Portal (PORTAL_DIR) and Engineering (ENG_DIR) trees, their own tests run first (the Super
 * Admin sa@rcl.test, sites S1 and T2, Engineering rows). This test starts its own Mechanical servers (3005, 3006) with the backup on,
 * and the Portal (:3010) and Engineering (:3040) again with the export secret; at the end the Portal and Engineering are started
 * again as they were.
 *   APP_DIR=/home/claude/vercel PORTAL_DIR=… ENG_DIR=… node test/backup157.js */
'use strict';
const { execSync, spawn } = require('child_process'), path = require('path'), crypto = require('crypto');
const APP = process.env.APP_DIR || path.join(__dirname, '..'), PDIR = process.env.PORTAL_DIR || '/home/claude/rcl-portal', EDIR = process.env.ENG_DIR || '/home/claude/rcl-engineering';
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const G = 'http://127.0.0.1:3997', g = async p => (await fetch(G + p)).json();
const SECRET = 'rig-backup-export-secret-0123456789abcdef', LEGACY = 'rigSheet0123456789abcdefghijklmn';
const IDS = { t2: 'rigT2sheet1abcdefghijklmnopq', s1a: 'rigS1sheet1abcdefghijklmnopq', s1b: 'rigS1sheet2abcdefghijklmnopq', deny: 'rigDENYsheetabcdefghijklmnop', portal: 'rigPORTALsheetabcdefghijklmn',
  s1c: 'rigS1sheet3abcdefghijklmnopq', old: 'rigOLDbackupabcdefghijklmnop', ro: 'rigROsheetabcdefghijklmnopqr', t2b: 'rigT2sheetBabcdefghijklmnopq' };
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const GOOGLE = { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'backup-robot@rig.test', private_key: key }), BACKUP_SHEET_ID: LEGACY, GOOGLE_SHEETS_URL: G, GOOGLE_TOKEN_URL: G + '/token', CRON_SECRET: 'local-cron-secret' };
const MECH_ENV = Object.assign({}, process.env, GOOGLE, { RCL_SITES_KEY: 'rig-sites-key-0123456789-abcdefghij', PORTAL_URL: 'http://127.0.0.1:3010', ENGINEERING_URL: 'http://127.0.0.1:3040', BACKUP_EXPORT_SECRET: SECRET });
const PORTAL_ENV = { SUPABASE_URL: 'http://127.0.0.1:3106', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_SECRET: 'rig-portal-secret-0123456789abcdefghijklmnop', MECH_URL: 'http://127.0.0.1:3100', MECH_KEY: 'sb_secret_rigkey', MECH_APP_URL: 'http://127.0.0.1:3005', APP_STORE_URL: 'http://127.0.0.1:3100', APP_STORE_KEY: 'sb_secret_rigkey', PORT: '3010' };
const ENG_ENV = { SUPABASE_URL: 'http://127.0.0.1:3108', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_URL: 'http://127.0.0.1:3010', PORT: '3040' };
const procs = [];
// a server on its port: the one there is stopped first (only the rig's node dev.js on that port)
function killPort(port) {
  require('fs').readdirSync('/proc').filter(x => /^\d+$/.test(x)).forEach(p => { try {
    const env = require('fs').readFileSync('/proc/' + p + '/environ', 'utf8'), cmd = require('fs').readFileSync('/proc/' + p + '/cmdline', 'utf8');
    if (/dev\.js/.test(cmd) && env.split('\0').indexOf('PORT=' + port) > -1) process.kill(Number(p)); } catch (e) { /* gone */ } });
}
async function start(dir, env, port) {
  killPort(port); await wait(700);
  const c = spawn('node', ['dev.js'], { cwd: dir, env: Object.assign({}, process.env, env, { PORT: String(port) }), stdio: 'ignore', detached: true }); c.unref(); procs.push({ c, port });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/', { signal: AbortSignal.timeout(2000) })).status === 200) return; } catch (e) { /* starting */ } await wait(300); }
  throw new Error('server ' + port + ' did not start');
}
const cron = port => fetch('http://127.0.0.1:' + port + '/api/backup?full=1', { headers: { Authorization: 'Bearer local-cron-secret' }, signal: AbortSignal.timeout(120000) }).then(async x => Object.assign({ status: x.status }, await x.json()));
async function cronDone(port, label) {      // the nightly job, again while something is left (each run works about half a minute)
  let r = null; for (let i = 0; i < 12; i++) { r = await cron(port); if (!(r && r.busy) && !(await pending())) break; await wait(1500); }
  return r;
}
async function pending() { const p = sql('rcl', "select coalesce((value::json->>'pending')::int, 0) + coalesce((select (value::json->>'pending')::int from web.props where key = 'SB_PORTAL_INFO'), 0) from web.props where key = 'SB_INFO'"); return Number(p) > 0; }
function portal() {
  let cookie = '';
  return async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch('http://127.0.0.1:3010' + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; cookie = /=$/.test(v) ? '' : v; }
    let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { j = {}; } return { status: r.status, j: j }; };
}
const exp = (port, body, auth) => fetch('http://127.0.0.1:' + port + '/api/backup-export', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth === undefined ? { Authorization: 'Bearer ' + SECRET } : auth ? { Authorization: auth } : {}), body: JSON.stringify(body) }).then(async x => ({ status: x.status, j: await x.json().catch(() => ({})) }));
const tab = async (id, title) => (await g('/tab?id=' + id + '&title=' + encodeURIComponent(title))).values || null;
const dump = id => g('/dump?id=' + id);

(async () => {
  const stand = spawn('node', [path.join(__dirname, 'sheets-standin.js')], { stdio: 'ignore', detached: true });
  const keepMod = sql('rcl_portal', "select url from modules where key = 'mechanical'");
  try {
    for (let i = 0; i < 30; i++) { try { await g('/dump'); break; } catch (e) { await wait(200); } }
    await g('/reset?bare=1');
    for (const db of ['rcl', 'rcl_s2']) sql(db, "delete from web.props where key in ('BK_STATE', 'SB_INFO', 'BK_SHEETS', 'BK_PORTAL_SHEETS', 'BK_PORTAL_STATE', 'SB_PORTAL_INFO', 'BK_BUDGET_MS', 'BK_GROUP_ROWS'); delete from web.locks where name like 'backup%';");
    sql('rcl', "update rcl_sites set sheet = null where code = 'T2'");      // 18B on the live site: no Sheet given yet
    // test rows of the rig (machinery and Log Book rows of September) at both sites
    for (const db of ['rcl', 'rcl_s2']) sql(db, "delete from log_book where id like 'B157-%'; delete from master where id like 'B157-%';" +
      "insert into master (id, machinery_number, machinery_name, type, unit, make) select 'B157-' || g, 'B157-' || g, 'Tipper', 'Tipper', 'KM', 'Test' from generate_series(1, 5) g;" +
      "insert into log_book (id, date, machinery, shift, remark) select 'B157-' || (g % 5 + 1) || '|2026-09-' || lpad(g::text, 2, '0') || '|Day', ('2026-09-' || lpad(g::text, 2, '0'))::date, 'B157-' || (g % 5 + 1), 'Day', 'test' from generate_series(1, 20) g;" +
      "set session_replication_role = replica; update log_book set updated_at = now() - interval '3 days' where id like 'B157-%'; update master set updated_at = now() - interval '3 days' where id like 'B157-%'; set session_replication_role = origin;");      // (the database's own trigger would set the time of now)
    sql('rcl_portal', "update modules set url = 'http://127.0.0.1:3005' where key = 'mechanical'");      // the Portal asks the Mechanical with the backup switched on
    await start(APP, MECH_ENV, 3005); await start(APP, MECH_ENV, 3006);
    await start(PDIR, Object.assign({}, PORTAL_ENV, { BACKUP_EXPORT_SECRET: SECRET }), 3010);
    await start(EDIR, Object.assign({}, ENG_ENV, { BACKUP_EXPORT_SECRET: SECRET }), 3040);
    const engS1 = Number(sql('rcl_eng', "select count(*) from eng_masters where site = 'S1'")), engAll = Number(sql('rcl_eng', 'select count(*) from eng_masters'));
    ok('the rig: Engineering has rows of S1 (and of other sites)', engS1 > 0, { s1: engS1, all: engAll });

    // ---- the export doors of the Portal and Engineering ----
    let e = await exp(3010, { action: 'catalog' }, false);
    ok('the Portal\'s backup export: without the secret – refused (401)', e.status === 401, e);
    e = await exp(3010, { action: 'catalog' }, 'Bearer wrong-secret-wrong-secret-wrong');
    ok('   a wrong secret – refused (401)', e.status === 401, e);
    e = await exp(3010, { action: 'catalog' });
    const pnames = (e.j.tables || []).map(t => t.name);
    ok('   with it: users, access, sites, companies, modules, the activity record – never the sign-ins, counters or signing keys', e.status === 200 && ['users', 'access', 'sites', 'companies', 'modules', 'audit'].every(n => pnames.indexOf(n) > -1) && !pnames.some(n => /session|counter|signing/.test(n)), pnames);
    e = await exp(3010, { action: 'rows', table: 'users', offset: 0, limit: 1000 });
    ok('   users: every kept password and recovery code "(hidden)" – none leaves', e.status === 200 && e.j.rows.length > 0 && e.j.rows.every(r => !r.password_hash || r.password_hash.__hidden) && e.j.rows.every(r => !r.recovery_hash || r.recovery_hash.__hidden) && e.j.rows.some(r => r.password_hash && r.password_hash.__hidden), (e.j.rows || []).map(r => [r.email, r.password_hash, r.recovery_hash]).slice(0, 4));
    e = await exp(3010, { action: 'rows', table: 'sessions', offset: 0 });
    ok('   the sign-ins: refused (not a table of the backup)', e.status === 400, e);
    e = await exp(3040, { action: 'catalog' });
    ok('Engineering\'s backup export: a site must be named', e.status === 400, e);
    e = await exp(3040, { action: 'rows', table: 'eng_masters', site: 'S1', offset: 0 });
    ok('   S1\'s masters: only S1\'s rows', e.status === 200 && e.j.rows.length === engS1 && e.j.rows.every(r => r.site === 'S1'), { n: (e.j.rows || []).length, want: engS1 });
    e = await exp(3040, { action: 'rows', table: 'eng_sessions', site: 'S1' });
    ok('   the sign-ins: refused', e.status === 400, e);
    const later = new Date(Date.now() + 3600000).toISOString();
    e = await exp(3040, { action: 'rows', table: 'eng_activity', site: 'S1', since: later, offset: 0 });
    ok('   "since" (for Sheet 2 and after): no activity after an hour from now', e.status === 200 && e.j.rows.length === 0, e.j);

    // ---- 1. as before: the first site writes its Sheet of before (BACKUP_SHEET_ID) as its Sheet 1, now with Engineering; 18B none ----
    let n0 = await cronDone(3005);
    ok('the nightly job: every ready site and the Portal – the first site writes, 18B (no Sheet) and the Portal (none) are left out', n0.status === 200 && n0.ok === true && n0.sites === 3, n0);
    let d = await dump(LEGACY), titles = d.tabs.map(t => t.title);
    ok('   the first site\'s Sheet of before is its Sheet 1: its tables as always, and Engineering\'s of S1 ("Engineering – …")', titles.indexOf('Master') > -1 && titles.indexOf('Engineering – Masters') > -1 && titles.indexOf('Engineering – Plans and reports') > -1, titles.slice(0, 40));
    const em = await tab(LEGACY, 'Engineering – Masters'), siteCol = em ? em[0].indexOf('site') : -1;
    ok('   Engineering – Masters: exactly S1\'s rows (none of another site)', em && em.length - 1 === engS1 && em.slice(1).every(r => r[siteCol] === "'S1"), { rows: em && em.length - 1, want: engS1, sites: em && [...new Set(em.slice(1).map(r => r[siteCol]))] });
    let st = await tab(LEGACY, 'Backup Status');
    ok('   the status tab says which Sheet this is: "Sheet 1", "everything, from the first day"', st && st.some(r => r[0] === 'This Sheet' && /Sheet 1/.test(r[1])) && st.some(r => r[0] === 'It holds' && /everything, from the first day/.test(r[1])), st && st.slice(0, 6));
    const books0 = (await g('/books')).map(b => b.id);
    ok('   nothing written anywhere else (18B has no Sheet, the Portal none)', books0.length === 1 && books0[0] === LEGACY, books0);

    // ---- 2. the Super Admin in the Portal: Sites → Backup ----
    const P = portal(); let r = await P('/api/auth', { action: 'login', email: 'sa@rcl.test', password: 'Super#Admin2040' });
    ok('the Super Admin signs in to the Portal', r.status === 200, r.j);
    r = await P('/api/admin', { action: 'bkGet', site: 'S1' });
    ok('S1 → Backup: Sheet 1 is the Sheet of before, in use; the robot\'s address to share with', r.status === 200 && r.j.sheets.length === 1 && r.j.sheets[0].legacy && r.j.sheets[0].active && r.j.email === 'backup-robot@rig.test', r.j);
    ok('   how full it is: the cells of the Sheet (as Google counts them)', r.j.sheets[0].cells > 0 && r.j.sheets[0].cells === (await dump(LEGACY)).cells, { said: r.j.sheets[0].cells, sheet: (await dump(LEGACY)).cells });
    r = await P('/api/admin', { action: 'bkGet', site: 'T2' });
    ok('T2 (18B on the live site) → Backup: no Sheet yet', r.status === 200 && r.j.sheets.length === 0, r.j);
    await g('/deny?id=' + IDS.deny);
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: 'https://docs.google.com/spreadsheets/d/' + IDS.deny + '/edit#gid=0' });
    ok('   a Sheet not shared with the robot: refused, and told to share it with the robot as Editor', r.status >= 400 && /share it with backup-robot@rig\.test as Editor/.test(r.j.error || ''), r.j);
    await g('/deny?id=');
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: 'https://docs.google.com/spreadsheets/d/' + LEGACY + '/edit' });
    ok('   the first site\'s Sheet: refused – every site its own Sheet', r.status >= 400 && /already the backup Sheet of another site/.test(r.j.error || ''), r.j);
    const aud0 = Number(sql('rcl_portal', "select count(*) from audit where action = 'Backup Sheet changed' and target = 'T2'"));
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: 'https://docs.google.com/spreadsheets/d/' + IDS.t2 + '/edit#gid=0' });
    ok('   its own new Sheet: Sheet 1 of T2', r.status === 200 && r.j.sheets.length === 1 && r.j.sheets[0].n === 1 && /rigT2sheet1/.test(r.j.sheets[0].url), r.j);
    ok('   written in the Portal\'s record and in T2\'s Activity Log', Number(sql('rcl_portal', "select count(*) from audit where action = 'Backup Sheet changed' and target = 'T2'")) === aud0 + 1 && Number(sql('rcl_s2', "select count(*) from activity_log where summary like '%Backup Sheet 1%'")) >= 1);
    let now = await P('/api/admin', { action: 'bkNow', site: 'T2' });
    for (let i = 0; i < 10 && now.j.last && now.j.last.pending; i++) now = await P('/api/admin', { action: 'bkNow', site: 'T2' });
    const t2tabs = (await dump(IDS.t2)).tabs.map(t => t.title), t2Master = await tab(IDS.t2, 'Master');
    ok('   "Backup now": T2\'s whole data from its first day into its Sheet 1 (its own tables, not S1\'s)', now.status === 200 && t2tabs.indexOf('Master') > -1 && t2Master && t2Master.length - 1 === Number(sql('rcl_s2', 'select count(*) from master')), { status: now.status, err: now.j.runError || now.j.error, tabs: t2tabs.length, master: t2Master && t2Master.length - 1 });

    // ---- 3. S1: a new link for Sheet 1 – the whole copy goes there; the Sheet of before is not written any more ----
    const legacyWrites = (await dump(LEGACY)).writes;
    r = await P('/api/admin', { action: 'bkSet', site: 'S1', mode: 'change', link: IDS.s1a });
    ok('S1: Change link of Sheet 1 – the new Sheet is Sheet 1 (the Sheet of before is left as it is)', r.status === 200 && r.j.sheets.length === 1 && !r.j.sheets[0].legacy && /rigS1sheet1/.test(r.j.sheets[0].url), r.j);
    const w0 = (await g('/dump')).writes; await cronDone(3006);
    const s1aTabs = (await dump(IDS.s1a)).tabs.map(t => t.title), w1 = (await g('/dump')).writes;
    const nLog = Number(sql('rcl', 'select count(*) from log_book')), s1aLog = await tab(IDS.s1a, 'Log Book');
    ok('   the nightly job: the whole of S1 in the new Sheet 1 (Log Book: every row), Engineering\'s too', s1aTabs.indexOf('Log Book') > -1 && s1aLog && s1aLog.length - 1 === nLog && s1aTabs.indexOf('Engineering – Masters') > -1, { tabs: s1aTabs.length, log: s1aLog && s1aLog.length - 1, want: nLog });
    const legacyAfter = await g('/dump?id=' + LEGACY);
    ok('   the Sheet of before: not written again', w1 > w0 && legacyAfter.tabs.length > 0 && (await g('/books')).find(b => b.id === LEGACY).cells === (await dump(LEGACY)).cells && JSON.stringify((await tab(LEGACY, 'Backup Status')) || []) === JSON.stringify(st || []), { writes_before: legacyWrites });

    // ---- 4. S1: Sheet 2 – Sheet 1 stays as it is; Sheet 2 gets what is new or changed since, and the masters whole ----
    const s1aBefore = JSON.stringify(await dump(IDS.s1a));
    r = await P('/api/admin', { action: 'bkSet', site: 'S1', mode: 'add', link: IDS.s1a });
    ok('   Add Sheet 2 with Sheet 1\'s own link: refused (a new, empty Sheet)', r.status >= 400 && /already Sheet 1/.test(r.j.error || ''), r.j);
    r = await P('/api/admin', { action: 'bkSet', site: 'S1', mode: 'add', link: IDS.s1b });
    const v1 = (r.j.sheets || [])[0] || {}, v2 = (r.j.sheets || [])[1] || {};
    ok('S1: Add Sheet 2 – Sheet 1 kept as it is (with how full it was), Sheet 2 in use from an hour before the last copy', r.status === 200 && r.j.sheets.length === 2 && v1.frozen && !v1.active && v2.active && v2.n === 2 && v2.from && new Date(v2.from).getTime() < Date.now() - 50 * 60000 && v1.cells > 0, r.j.sheets);
    // a row changed now (long ago entered) and the rows of the hour before: in Sheet 2; an old row not changed since: not in Sheet 2
    const oldId = sql('rcl', "select id from log_book order by id limit 1"), keepId = sql('rcl', "select id from log_book order by id desc limit 1");
    sql('rcl', "set session_replication_role = replica; update log_book set updated_at = now() - interval '3 days' where id <> '" + oldId + "'; set session_replication_role = origin; update log_book set remark = coalesce(remark, '') || ' (157)' where id = '" + oldId + "';");
    await wait(1200);      // (the servers' memory of the tables follows the change)
    await cronDone(3005);
    const s2Log = await tab(IDS.s1b, 'Log Book'), s2Master = await tab(IDS.s1b, 'Master'), idCol = s2Log ? s2Log[0].indexOf('Log Book Key') : -1;
    const s2ids = s2Log ? s2Log.slice(1).map(x => String(x[idCol]).replace(/^'/, '')) : [];
    ok('   the nightly job: Sheet 2\'s Log Book = only the row changed since (an old entry corrected now) – not the others', s2Log && s2ids.indexOf(oldId) > -1 && s2ids.indexOf(keepId) === -1 && s2ids.length === 1, { ids: s2ids.slice(0, 5), changed: oldId });
    ok('   the masters whole in Sheet 2 (Master: every machinery)', s2Master && s2Master.length - 1 === Number(sql('rcl', 'select count(*) from master')), { rows: s2Master && s2Master.length - 1 });
    st = await tab(IDS.s1b, 'Backup Status');
    ok('   its status tab: "Sheet 2 of 2", "every row new or changed since …"', st && st.some(x => x[0] === 'This Sheet' && /Sheet 2 of 2/.test(x[1])) && st.some(x => x[0] === 'It holds' && /new or changed since/.test(x[1])), st && st.slice(0, 5));
    ok('   Sheet 1 not written again', JSON.stringify(await dump(IDS.s1a)).replace(/"calls":\d+,"writes":\d+,/, '') === s1aBefore.replace(/"calls":\d+,"writes":\d+,/, ''));

    // ---- 5. a full Sheet: said plainly, with what to do ----
    const cells2 = (await dump(IDS.s1b)).cells; await g('/cap?cells=' + (cells2 + 5));
    sql('rcl', "insert into master (id, machinery_number, machinery_name, type, unit, make) values ('B157-9', 'B157-9', 'Tipper', 'Tipper', 'KM', 'Test')");      // one row more: the Sheet would grow
    await cron(3005); await g('/cap?cells=0');
    const info = JSON.parse(sql('rcl', "select value from web.props where key = 'SB_INFO'") || '{}');
    ok('a full Sheet (Google\'s 10 million cells): "Sheet 2 of this site is full … the Super Admin adds Sheet 3"', info.ok === false && /Sheet 2 of this site is full/.test(info.error || '') && /adds Sheet 3/.test(info.error || ''), info.error);
    await cronDone(3005);

    // ---- 5b. (review 25-10-2026) a Sheet used before, a Sheet that holds a backup, a Sheet shared as Viewer: refused ----
    r = await P('/api/admin', { action: 'bkSet', site: 'S1', mode: 'change', link: LEGACY });
    ok('(review) S1: its own Sheet of before (replaced by Change link): refused – never given again', r.status >= 400 && /before/.test(r.j.error || ''), r.j);
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: LEGACY });
    ok('(review)    T2: S1\'s Sheet of before: refused (another site\'s)', r.status >= 400 && /another site/.test(r.j.error || ''), r.j);
    await fetch(G + '/v4/spreadsheets/' + IDS.old + ':batchUpdate', { method: 'POST', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Backup Status' } } }] }) });
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: IDS.old });
    ok('(review)    a Sheet that already holds a backup (a "Backup Status" tab – of any site): refused', r.status >= 400 && /already holds a backup/.test(r.j.error || ''), r.j);
    await g('/ro?id=' + IDS.ro);
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: 'https://docs.google.com/spreadsheets/u/1/d/' + IDS.ro + '/edit' });
    ok('(review)    a Sheet shared as Viewer (not Editor): refused – "cannot write it"', r.status >= 400 && /cannot write it/.test(r.j.error || ''), r.j);
    await g('/ro?id=');
    r = await P('/api/admin', { action: 'bkGet', site: 'T2' });
    ok('(review)    T2 still has its own Sheet 1 (nothing changed by the refusals)', r.status === 200 && r.j.sheets.length === 1 && /rigT2sheet1/.test(r.j.sheets[0].url), r.j.sheets);
    // (second review) a Sheet given to T2 whose giving did not finish (its status tab has only T2's mark): T2 can give it again; nobody else
    const gput = (id, body, tail) => fetch(G + '/v4/spreadsheets/' + id + (tail || ':batchUpdate'), { method: 'POST', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await gput(IDS.t2b, { requests: [{ addSheet: { properties: { title: 'Backup Status' } } }] });
    await gput(IDS.t2b, { valueInputOption: 'RAW', data: [{ range: "'Backup Status'!A1", values: [['RCL ERP backup – given to site T2, waiting for its first copy']] }] }, '/values:batchUpdate');
    r = await P('/api/admin', { action: 'bkSet', site: 'S1', mode: 'change', link: IDS.t2b });
    ok('(second review) a Sheet marked "given to site T2" (a giving that did not finish): refused for S1', r.status >= 400 && /already holds a backup/.test(r.j.error || ''), r.j);
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: IDS.t2b });
    ok('(second review)    … and taken for T2 (its Sheet 1 now; the Sheet of before kept as used)', r.status === 200 && r.j.sheets.length === 1 && /rigT2sheetB/.test(r.j.sheets[0].url), r.j.error || r.j.sheets);

    // ---- 5c. (review) Engineering fails while its rows are read: the site's own backup goes on; the next backup takes it ----
    const fault = body => fetch('http://127.0.0.1:3108/__fault', { method: 'POST', body: JSON.stringify(body) });
    await fault({ match: 'GET /rest/v1/eng_days\\?select=\\*', code: 500, n: 1000 });
    sql('rcl', "insert into master (id, machinery_number, machinery_name, type, unit, make) values ('B157-8', 'B157-8', 'Tipper', 'Tipper', 'KM', 'Test')");
    await cronDone(3005);      // (until the round reaches Engineering's tables – they come last)
    let inf = JSON.parse(sql('rcl', "select value from web.props where key = 'SB_INFO'") || '{}'), s2m = await tab(IDS.s1b, 'Master');
    ok('(review) Engineering fails while its rows are read: S1\'s own backup is written (Master with the new machinery), not failed; the status names what was not copied', inf.ok !== false && /Plans and reports/.test(inf.engNote || '') && s2m && s2m.length - 1 === Number(sql('rcl', 'select count(*) from master')), { ok: inf.ok, error: inf.error, engNote: inf.engNote, master: s2m && s2m.length - 1 });
    await fault({});
    await cron(3005); await cronDone(3005);
    inf = JSON.parse(sql('rcl', "select value from web.props where key = 'SB_INFO'") || '{}');
    ok('(review)    the next backup copies it (nothing left out any more)', inf.ok !== false && !/not copied now/i.test(inf.engNote || '') && !!(await tab(IDS.s1b, 'Engineering – Plans and reports')), { engNote: inf.engNote });

    // ---- 5d. (review) Sheet 2 was not complete when Sheet 3 is added (its Log Book not copied yet): each table from ITS last copy ----
    const vol2 = JSON.parse(sql('rcl', "select value from web.props where key = 'BK_SHEETS'"))[1] || {}, cutAct = new Date(Date.now() + 3600000).toISOString();
    sql('rcl', "update web.props set value = ((value::jsonb - 'todo') || jsonb_build_object('todo', jsonb_build_array('log_book'), 'copied', ((value::jsonb -> 'copied') - 'log_book') || jsonb_build_object('activity_log', '" + cutAct + "')))::text where key = 'BK_STATE'");
    const tCut = Date.now();
    r = await P('/api/admin', { action: 'bkSet', site: 'S1', mode: 'add', link: IDS.s1c });
    const vol3 = (JSON.parse(sql('rcl', "select value from web.props where key = 'BK_SHEETS'")) || [])[2] || {}, cuts3 = vol3.cuts || {};
    ok('(review) S1: Add Sheet 3 while Sheet 2 is not complete: the Log Book keeps its cut of Sheet 2 (from its copy into Sheet 1), the Activity Log from its own copy into Sheet 2', r.status === 200 && vol3.n === 3 && cuts3.log_book && cuts3.log_book === (vol2.cuts || {}).log_book && Math.abs(new Date(cuts3.activity_log).getTime() - tCut) < 120000, { log: cuts3.log_book, logBefore: (vol2.cuts || {}).log_book, act: cuts3.activity_log });
    await cronDone(3005);
    const s3Log = await tab(IDS.s1c, 'Log Book'), s3Act = await tab(IDS.s1c, 'Activity Log'), c3 = s3Log ? s3Log[0].indexOf('Log Book Key') : -1;
    const s3ids = s3Log ? s3Log.slice(1).map(x => String(x[c3]).replace(/^'/, '')) : [];
    const wantAct = Number(sql('rcl', "select count(*) from activity_log where updated_at >= '" + cuts3.activity_log + "'"));
    ok('(review)    Sheet 3: the Log Book row changed since its copy into Sheet 1 is there (nothing lost), the old ones not; the Activity Log only from its cut', s3ids.indexOf(oldId) > -1 && s3ids.indexOf(keepId) === -1 && s3Act && s3Act.length - 1 === wantAct, { log: s3ids.slice(0, 4), act: s3Act && s3Act.length - 1, wantAct: wantAct });

    // ---- 5e. (second review) a big table of another module is copied in pieces: each run goes on where the one before stopped ----
    sql('rcl_eng', "insert into eng_activity (site, email, action, target) select 'S1', 'b157@rcl.test', 'B157 test', 'row ' || g from generate_series(1, 30000) g");
    sql('rcl', "insert into web.props (key, value) values ('BK_HARD_MS', '12000'), ('BK_REMOTE_ROWS', '20') on conflict (key) do update set value = excluded.value");      // (a short run and small pages: it must stop in the middle of the table)
    let runs = 0, partSeen = false, nowR = null;
    for (; runs < 15; runs++) { nowR = await P('/api/admin', { action: 'bkNow', site: 'S1' }); const stt = await tab(IDS.s1c, 'Backup Status') || [];
      if (stt.some(x => /Activity/.test(String(x[0])) && /so far/.test(String(x[1])))) partSeen = true;
      if (nowR.status === 200 && !(nowR.j.last && nowR.j.last.pending) && !(nowR.j.ran && (nowR.j.ran.pending || nowR.j.ran.busy || nowR.j.ran.timedOut))) break; }
    sql('rcl', "delete from web.props where key in ('BK_HARD_MS', 'BK_REMOTE_ROWS')");
    await cronDone(3005);
    const engAct = await tab(IDS.s1c, 'Engineering – Activity'), cutE = ((JSON.parse(sql('rcl', "select value from web.props where key = 'BK_SHEETS'")) || [])[2] || {}).cuts || {};
    const wantE = Number(sql('rcl_eng', "select count(*) from eng_activity where site = 'S1'" + (cutE['eng:eng_activity'] ? " and at >= '" + cutE['eng:eng_activity'] + "'" : '')));
    ok('(second review) Engineering\'s activity of 30,000 new rows: copied in pieces ("… rows so far" in the status, several presses), then exactly its rows – each once', partSeen && runs >= 2 && engAct && engAct.length - 1 === wantE && new Set(engAct.slice(1).map(x => x[0])).size === wantE, { runs: runs + 1, partSeen: partSeen, rows: engAct && engAct.length - 1, want: wantE });
    sql('rcl_eng', "delete from eng_activity where action = 'B157 test'"); sql('rcl', "delete from web.props where key in ('BK_HARD_MS', 'BK_REMOTE_ROWS')");

    // ---- 6. the Portal's own backup ----
    r = await P('/api/admin', { action: 'bkSet', target: 'portal', mode: 'change', link: IDS.t2 });
    ok('the Portal: T2\'s Sheet refused (every one its own)', r.status >= 400 && /another site/.test(r.j.error || ''), r.j);
    r = await P('/api/admin', { action: 'bkSet', target: 'portal', mode: 'change', link: IDS.portal });
    ok('   its own Sheet: Sheet 1 of the Portal', r.status === 200 && r.j.target === 'portal' && r.j.sheets.length === 1, r.j);
    await cronDone(3006);
    const ptabs = (await dump(IDS.portal)).tabs.map(t => t.title), pu = await tab(IDS.portal, 'Portal – Users');
    const hashCol = pu ? pu[0].indexOf('password_hash') : -1;
    ok('   the nightly job: Users, Access, Sites, Companies, Modules, Activity – no sign-ins, counters or keys', ['Portal – Users', 'Portal – Access', 'Portal – Sites', 'Portal – Companies', 'Portal – Modules', 'Portal – Activity'].every(t => ptabs.indexOf(t) > -1) && !ptabs.some(t => /ession|ounter|igning/.test(t)), ptabs);
    ok('   Users: no password, no recovery code in the Sheet ("(hidden)")', pu && hashCol > -1 && pu.slice(1).every(x => x[hashCol] === '' || x[hashCol] === "'(hidden)") && pu.slice(1).some(x => x[hashCol] === "'(hidden)"), pu && pu.slice(1, 4).map(x => x[hashCol]));
    ok('   Users: every user of the Portal', pu && pu.length - 1 === Number(sql('rcl_portal', 'select count(*) from users')));

    // ---- 7. the page of the first site: its Backup status names the Sheet in use ----
    r = await P('/api/admin', { action: 'bkGet', site: 'S1' });
    ok('S1 → Backup: Sheets 1 and 2 (kept) and Sheet 3 (in use), each with how full it is; the last backup', r.status === 200 && r.j.sheets.length === 3 && !r.j.sheets[1].active && r.j.sheets[1].frozen && r.j.sheets[2].active && r.j.sheets[2].cells === (await dump(IDS.s1c)).cells && r.j.last && r.j.last.lastRun, r.j);
    // ---- 8. the real page of the Portal: Sites → Backup (the Super Admin sees the Sheets, how full each is, and the buttons) ----
    try {
      const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'), puppeteer = require('puppeteer-core');
      const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
      try {
        const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 1000 }); const errs = []; pg.on('pageerror', x => errs.push(String(x.message).slice(0, 200)));
        await pg.goto('http://127.0.0.1:3010/', { waitUntil: 'load' }); await pg.waitForSelector('#l_email', { visible: true });
        await pg.type('#l_email', 'sa@rcl.test'); await pg.type('#l_pass', 'Super#Admin2040'); await pg.click('#l_btn');
        await pg.waitForSelector('#sa_tabs button[data-t="sites"]', { visible: true, timeout: 20000 }); await pg.click('#sa_tabs button[data-t="sites"]'); await pg.waitForSelector('#t_sites:not([hidden])');
        await pg.waitForSelector('#st_rows tr[data-code="S1"] .st-backup'); await pg.click('#st_rows tr[data-code="S1"] .st-backup');
        await pg.waitForSelector('#bk_panel table', { timeout: 30000 });
        const txt = await pg.$eval('#bk_panel', x => x.innerText);
        if (process.env.SHOT_DIR) await pg.screenshot({ path: path.join(process.env.SHOT_DIR, 'bk157-sites-backup.png'), fullPage: true });
        ok('the Portal page: Sites → Backup of S1 – Sheets 1 and 2 kept, Sheet 3 in use, how full each is, the robot to share with, the buttons', /Sheet 1/.test(txt) && /Sheet 2/.test(txt) && /Sheet 3/.test(txt) && /In use/.test(txt) && /Kept as it is/.test(txt) && /\d+ %/.test(txt) && /backup-robot@rig\.test/.test(txt) && /Change link of Sheet 3/.test(txt) && /Add Sheet 4/.test(txt) && /Backup now/.test(txt), txt.slice(0, 600));
        await pg.click('#bk_close'); await pg.click('#st_pbk'); await pg.waitForFunction(() => /Portal backup/.test((document.getElementById('bk_panel') || {}).innerText || '') && !!document.querySelector('#bk_panel table'), { timeout: 30000 });
        ok('   Portal backup: its own Sheet 1', /Sheet 1/.test(await pg.$eval('#bk_panel', x => x.innerText)));
        ok('   no script error on the page', !errs.length, errs);
      } finally { await b.close(); }
    } catch (e2) { ok('the Portal page (browser)', false, String((e2 && e2.stack) || e2).slice(0, 400)); }
  } catch (err) { ok('no crash', false, String((err && err.stack) || err)); }
  finally {
    try { sql('rcl_portal', "update modules set url = '" + keepMod + "' where key = 'mechanical'"); } catch (e) { /* as it was */ }
    for (const db of ['rcl', 'rcl_s2']) { try { sql(db, "delete from log_book where id like 'B157-%'; delete from master where id like 'B157-%';"); } catch (e) { /* the rig's test rows */ } }
    procs.forEach(p => { try { process.kill(-p.c.pid); } catch (e) { try { p.c.kill(); } catch (e2) { /* gone */ } } });
    try { process.kill(-stand.pid); } catch (e) { try { stand.kill(); } catch (e2) { /* gone */ } }
    // the Portal and Engineering as the rig had them (without the export secret)
    try { await start(PDIR, Object.assign({}, PORTAL_ENV, { MECH_APP_URL: 'http://127.0.0.1:3000' }), 3010); await start(EDIR, ENG_ENV, 3040); } catch (e) { out.push('restart: ' + String(e.message)); }
  }
  out.forEach(x => console.log(x)); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
