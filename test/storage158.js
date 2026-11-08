/* update-158 – STORAGE (how full every place is) and THE COPY OF THE FILES TO GOOGLE DRIVE, on the local test rig, against the
 * Sheets stand-in (test/sheets-standin.js) and the Google sign-in / Drive stand-in (test/drive-standin.js). Nothing here touches a
 * live database, a real Google account or a real Drive.
 * Before: the rig in Portal mode, the Portal's and Engineering's own tests run first (the Super Admin sa@rcl.test, sites S1, T2),
 * steps 1zc, 1zd, 1ze in the site databases (run158.sh does it). This test adds a stand-in of Supabase's storage.objects to the
 * rig databases, runs step 1zf (S1 first, T2 later), the Portal's step 4 and Engineering's step 2, starts its own Mechanical servers
 * (3005 with the Portal, 3006 for the Admin's own sign-in), the Portal (:3010) and Engineering (:3040) with the export secret.
 *   APP_DIR=/home/claude/vercel PORTAL_DIR=… ENG_DIR=… [SHOT_DIR=…] node test/storage158.js */
'use strict';
const { execSync, spawn } = require('child_process'), path = require('path'), crypto = require('crypto'), fs = require('fs');
const APP = process.env.APP_DIR || path.join(__dirname, '..'), PDIR = process.env.PORTAL_DIR || '/home/claude/rcl-portal', EDIR = process.env.ENG_DIR || '/home/claude/rcl-engineering';
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -v ON_ERROR_STOP=1 -tA -q"', { input: q }).toString().trim();
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const G = 'http://127.0.0.1:3997', D = 'http://127.0.0.1:3996', gj = async u => (await fetch(u)).json();
const SECRET = 'rig-backup-export-secret-0123456789abcdef', LEGACY = 'rigSheet0123456789abcdefghijklmn';
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const GOOGLE = { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'backup-robot@rig.test', private_key: key }), BACKUP_SHEET_ID: LEGACY, GOOGLE_SHEETS_URL: G, GOOGLE_TOKEN_URL: G + '/token', CRON_SECRET: 'local-cron-secret',
  GOOGLE_OAUTH_CLIENT_ID: 'rig-client', GOOGLE_OAUTH_CLIENT_SECRET: 'rig-client-secret', GOOGLE_OAUTH_TOKEN_URL: D + '/token', GOOGLE_OAUTH_AUTH_URL: D + '/auth', GOOGLE_DRIVE_URL: D, DRIVE_REDIRECT_URL: 'http://127.0.0.1:3005/api/drive' };
const MECH = Object.assign({}, process.env, GOOGLE, { RCL_SITES_KEY: 'rig-sites-key-0123456789-abcdefghij', PORTAL_URL: 'http://127.0.0.1:3010', ENGINEERING_URL: 'http://127.0.0.1:3040', BACKUP_EXPORT_SECRET: SECRET });
const MECH_OWN = Object.assign({}, MECH); delete MECH_OWN.PORTAL_URL;      // (3006: the Admin signs in with his own password)
const PORTAL_ENV = { SUPABASE_URL: 'http://127.0.0.1:3106', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_SECRET: 'rig-portal-secret-0123456789abcdefghijklmnop', MECH_URL: 'http://127.0.0.1:3100', MECH_KEY: 'sb_secret_rigkey', MECH_APP_URL: 'http://127.0.0.1:3005', APP_STORE_URL: 'http://127.0.0.1:3100', APP_STORE_KEY: 'sb_secret_rigkey', BACKUP_EXPORT_SECRET: SECRET };
const ENG_ENV = { SUPABASE_URL: 'http://127.0.0.1:3108', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_URL: 'http://127.0.0.1:3010', BACKUP_EXPORT_SECRET: SECRET };
function killPort(port) {
  fs.readdirSync('/proc').filter(x => /^\d+$/.test(x)).forEach(p => { try {
    const env = fs.readFileSync('/proc/' + p + '/environ', 'utf8'), cmd = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8');
    if (/dev\.js/.test(cmd) && env.split('\0').indexOf('PORT=' + port) > -1) process.kill(Number(p)); } catch (e) { /* gone */ } });
}
async function start(dir, env, port) {
  killPort(port); await wait(700);
  const c = spawn('node', ['dev.js'], { cwd: dir, env: Object.assign({}, process.env, env, { PORT: String(port) }), stdio: 'ignore', detached: true }); c.unref();
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/', { signal: AbortSignal.timeout(2000) })).status === 200) return; } catch (e) { /* starting */ } await wait(300); }
  throw new Error('server ' + port + ' did not start');
}
function portal() {
  let cookie = '';
  return async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch('http://127.0.0.1:3010' + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; cookie = /=$/.test(v) ? '' : v; }
    let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { j = {}; } return { status: r.status, j: j }; };
}
const raw = async (port, body) => (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
const cronQuick = port => fetch('http://127.0.0.1:' + port + '/api/backup', { headers: { Authorization: 'Bearer local-cron-secret' }, signal: AbortSignal.timeout(120000) }).then(async x => Object.assign({ status: x.status }, await x.json()));      // (the nightly job without "every tab again")
const cron = port => fetch('http://127.0.0.1:' + port + '/api/backup?full=1', { headers: { Authorization: 'Bearer local-cron-secret' }, signal: AbortSignal.timeout(120000) }).then(async x => Object.assign({ status: x.status }, await x.json()));
const md5 = b => crypto.createHash('md5').update(b).digest('hex'), sha = b => crypto.createHash('sha256').update(b).digest('hex');
// a file into the rig's file store as the app keeps it (the rig's door notes it in storage.objects, as Supabase does)
async function put(dbPort, bucket, p2, bytes, mime) {
  const r = await fetch('http://127.0.0.1:' + dbPort + '/storage/v1/object/' + bucket + '/' + p2, { method: 'POST', headers: { apikey: 'sb_secret_rigkey', 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes });
  if (r.status !== 200) throw new Error('rig store: ' + r.status + ' ' + (await r.text()));
}
const jpg = n => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), crypto.randomBytes(n)]), pdf = n => Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(n)]);
const RIG_OBJECTS = "create schema if not exists storage; create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(), metadata jsonb, version text, unique (bucket_id, name)); delete from storage.objects;";
const step = f => fs.readFileSync(f, 'utf8');

(async () => {
  const kids = [spawn('node', [path.join(__dirname, 'sheets-standin.js')], { stdio: 'ignore', detached: true }), spawn('node', [path.join(__dirname, 'drive-standin.js')], { stdio: 'ignore', detached: true })];
  const keepMod = sql('rcl_portal', "select url from modules where key = 'mechanical'");
  try {
    for (let i = 0; i < 30; i++) { try { await gj(G + '/dump'); await gj(D + '/dump'); break; } catch (e) { await wait(200); } }
    await fetch(G + '/reset?bare=1');
    // the rig: storage.objects as Supabase has it (a stand-in table, rig only); step 1zf at S1 only (T2 later); the Portal's and Engineering's steps
    for (const db of ['rcl', 'rcl_s2', 'rcl_portal', 'rcl_eng']) sql(db, RIG_OBJECTS);
    for (const db of ['rcl', 'rcl_s2']) sql(db, "delete from web.props where key in ('DRIVE_AUTH', 'DRIVE_STATE', 'DRV_STATE', 'BK_STATE', 'SB_INFO', 'BK_SHEETS'); delete from web.locks where name like 'backup%' or name = 'drive'; drop function if exists public.web_usage(); drop function if exists public.web_files(timestamptz, uuid, int); drop table if exists public.backup_drive; drop table if exists public.backup_drive_state; delete from web.cache where key in ('STO_USAGE', 'DRV_QUOTA', 'DRV_OFF', 'DRV_NEXT'); notify pgrst, 'reload schema';");      // (rig only: as before step 1zf)
    sql('rcl', step(path.join(APP, 'sql', 'supabase_step1zf_storage_drive.sql')));
    sql('rcl_portal', step(path.join(PDIR, 'sql', 'portal_step4_usage.sql'))); sql('rcl_eng', step(path.join(EDIR, 'sql', 'eng_step2_usage.sql')));
    sql('rcl', "update rcl_sites set sheet = null where code = 'T2'");
    sql('rcl_portal', "update modules set url = 'http://127.0.0.1:3005' where key = 'mechanical'");
    await start(APP, MECH, 3005); await start(APP, MECH_OWN, 3006);
    await start(PDIR, PORTAL_ENV, 3010); await start(EDIR, ENG_ENV, 3040);

    // ---- the files of S1 (as the app keeps them) and their entries ----
    const F = {}, mk = async (db, port, k, bucket, p2, bytes, mime) => { await put(port, bucket, p2, bytes, mime); F[k] = { b: bucket, p: p2, bytes: bytes, md5: md5(bytes) }; };
    const u = () => crypto.randomUUID();
    await mk('rcl', 3100, 'dash', 'diesel-photos', '2026-10/' + u() + '.jpg', jpg(30000), 'image/jpeg');
    await mk('rcl', 3100, 'hrs', 'diesel-photos', '2026-10/' + u() + '.jpg', jpg(22000), 'image/jpeg');
    await mk('rcl', 3100, 'bill', 'diesel-photos', 'inward/2026-10/' + u() + '.jpg', jpg(18000), 'image/jpeg');
    const att = jpg(41000), attSha = sha(att), doc = pdf(52000), docSha = sha(doc), big = jpg(6 * 1048576), bigSha = sha(big);
    await mk('rcl', 3100, 'att', 'erp-files', 'log/' + attSha.slice(0, 2) + '/' + attSha + '.jpg', att, 'image/jpeg');
    await mk('rcl', 3100, 'doc', 'erp-files', 'log/' + docSha.slice(0, 2) + '/' + docSha + '.pdf', doc, 'application/pdf');
    await mk('rcl', 3100, 'big', 'erp-files', 'log/' + bigSha.slice(0, 2) + '/' + bigSha + '.jpg', big, 'image/jpeg');      // (more than 5 MB: sent in the resumable way)
    const lo = jpg(9000), loSha = sha(lo), yo = jpg(9100), yoSha = sha(yo);
    await mk('rcl', 3100, 'loose', 'erp-files', 'log/' + loSha.slice(0, 2) + '/' + loSha + '.jpg', lo, 'image/jpeg');
    await mk('rcl', 3100, 'young', 'erp-files', 'log/' + yoSha.slice(0, 2) + '/' + yoSha + '.jpg', yo, 'image/jpeg');
    sql('rcl', "update storage.objects set created_at = now() - interval '3 days' where name <> '" + F.young.p + "'");      // (the young one was sent just now)
    const A = (k, name) => ({ sha: k === 'att' ? attSha : k === 'doc' ? docSha : bigSha, p: F[k].p, mime: k === 'doc' ? 'application/pdf' : 'image/jpeg', size: F[k].bytes.length, name: name, at: '2026-10-05T10:00:00Z', by: 'Sujit' });
    const J = o => "'" + JSON.stringify(o).replace(/'/g, "''") + "'", AGO = "now() - interval '3 minutes'";      // (an entry is copied a minute after it was saved at the earliest)
    sql('rcl', "delete from diesel_issue where id like 'B158-%'; delete from diesel_inward where id like 'B158-%'; delete from log_book where id like 'B158-%' or id like 'MH-15-B15_|%';" +
      "insert into diesel_issue (id, issue_date, machinery, photos, updated_at) values ('B158-DI1', '2026-10-05', 'MH-15-B158', " + J([{ k: 'dash', p: F.dash.p }, { k: 'hrs', p: F.hrs.p }]) + ", " + AGO + ");" +
      "insert into diesel_inward (id, date, pump_name, photos, updated_at) values ('B158-IN1', '2026-10-04', 'Rig Pump', " + J([{ p: F.bill.p }]) + ", " + AGO + ");" +
      "insert into log_book (id, date, machinery, shift, attachments, updated_at) values ('MH-15-B158|2026-10-05|Day', '2026-10-05', 'MH-15-B158', 'Day', " + J([A('att', 'Challan.jpg')]) + ", " + AGO + ")," +
      "('MH-15-B159|2026-10-06|Day', '2026-10-06', 'MH-15-B159', 'Day', " + J([A('att', 'Challan.jpg'), A('doc', 'Report.pdf'), A('big', 'Site photo.jpg')]) + ", " + AGO + ");");
    // a submitted bill's evidence (step 1zc) with the Log Book of the second entry
    const billId = 'B158-BILL-' + Date.now();
    sql('rcl', "insert into bill_snapshots (id, bill_no, rev, vendor_name, period_from, period_to, snapshot_sha256, created_at) values ('" + billId + "', 'RA-158', 1, 'Rig Vendor', '2026-10-01', '2026-10-31', 'x', " + AGO + ");" +
      "insert into bill_log_rows (id, bill_id, entry_key, machinery, entry_date, shift, data, row_sha256) values ('" + billId + "|MH-15-B159|2026-10-06|Day', '" + billId + "', 'MH-15-B159|2026-10-06|Day', 'MH-15-B159', '2026-10-06', 'Day', " + J({ key: 'MH-15-B159|2026-10-06|Day', att: [A('att', 'Challan.jpg'), A('doc', 'Report.pdf')] }) + ", 'x');");

    // ---- 1. Storage before Google Drive is connected ----
    const P = portal(); let r = await P('/api/auth', { action: 'login', email: 'sa@rcl.test', password: 'Super#Admin2040' });
    ok('the Super Admin signs in to the Portal', r.status === 200, r.j);
    r = await P('/api/admin', { action: 'stoGet' });
    const s1 = (r.j.sites || []).find(x => x.code === 'S1') || {}, t2 = (r.j.sites || []).find(x => x.code === 'T2') || {};
    const dbS1 = Number(sql('rcl', 'select pg_database_size(current_database())')), filesS1 = Number(sql('rcl', "select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects"));
    ok('Storage: S1 – its database (as the database counts it) of 8 GB, its photos and files (every file), its backup Sheet; Drive not connected yet', r.status === 200 && s1.db && Math.abs(s1.db.bytes - dbS1) < 2 * 1048576 && s1.db.limit === 8 * 1073741824 &&
      s1.files && s1.files.bytes === filesS1 && s1.files.n === 8 && s1.files.limit === 100 * 1073741824 && s1.drive && s1.drive.connected === false, { db: s1.db, files: s1.files && { n: s1.files.n, bytes: s1.files.bytes, want: filesS1 }, drive: s1.drive, error: r.j.error });
    ok('   T2 (no step 1zf yet): says which SQL file to run – nothing else breaks', t2.code === 'T2' && !t2.db && /supabase_step1zf_storage_drive\.sql/.test(t2.error || ''), { error: t2.error });
    ok('   the Portal\'s and Engineering\'s own databases (their step: web_usage)', r.j.portal && r.j.portal.db > 0 && r.j.eng && r.j.eng.db > 0, { portal: r.j.portal, eng: r.j.eng });
    ok('   Google Drive: ready to connect (the OAuth client is set) and the address Google sends back to', r.j.drive && r.j.drive.ready === true && r.j.drive.redirect === 'http://127.0.0.1:3005/api/drive' && !r.j.drive.quota, r.j.drive);

    // ---- 2. "Connect Google Drive": the state is good once; the refresh token is kept locked ----
    r = await P('/api/admin', { action: 'drvStart' });
    const au = new URL(r.j.url || 'http://x/'), state = au.searchParams.get('state');
    ok('Connect Google Drive: Google\'s page with ONLY the right to its own files (drive.file), lasting access, and a state of its own', r.status === 200 && au.origin === D && au.searchParams.get('scope') === 'https://www.googleapis.com/auth/drive.file' && au.searchParams.get('access_type') === 'offline' && au.searchParams.get('client_id') === 'rig-client' && /^[0-9a-f]{64}$/.test(state || ''), r.j.url);
    let cb = await fetch('http://127.0.0.1:3005/api/drive?state=' + 'f'.repeat(64) + '&code=good-code'), cbt = await cb.text();
    ok('   Google\'s answer with a state nobody gave: refused, nothing connected', /was not connected/.test(cbt) && /old or was used already/.test(cbt) && !sql('rcl', "select value from web.props where key = 'DRIVE_AUTH'"), cbt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200));
    cb = await fetch('http://127.0.0.1:3005/api/drive?state=' + state + '&code=good-code'); cbt = await cb.text();
    const auth = JSON.parse(sql('rcl', "select value from web.props where key = 'DRIVE_AUTH'") || '{}'), dump0 = await gj(D + '/dump');
    ok('   the real answer: connected – the account, the backup\'s own folder in that Drive; the refresh token kept LOCKED (not in the settings as it is)', cb.status === 200 && /Google Drive connected/.test(cbt) && /erp@rig\.test/.test(cbt) && auth.acct === 'erp@rig.test' && /^v1\./.test(auth.sealed || '') &&
      !/rig-refresh-/.test(sql('rcl', "select string_agg(value, ' ') from web.props")) && dump0.files.some(f => f.id === auth.root && f.name === 'RCL ERP – Files (backup)' && f.mimeType === 'application/vnd.google-apps.folder' && !f.parents.length), { acct: auth.acct, root: auth.root, sealed: String(auth.sealed || '').slice(0, 6) });
    cb = await fetch('http://127.0.0.1:3005/api/drive?state=' + state + '&code=good-code'); cbt = await cb.text();
    ok('   the same answer again (the state is good once): refused', /old or was used already/.test(cbt));
    ok('   written in S1\'s Activity Log', Number(sql('rcl', "select count(*) from activity_log where summary like 'Google Drive connected%'")) >= 1);

    // ---- 3. "Copy files now" (S1): every file once, in its folder; a shared file once + a shortcut; the bill's shortcuts ----
    let runs = 0, now = null;
    for (; runs < 8; runs++) { now = await P('/api/admin', { action: 'drvNow', site: 'S1' }); if (now.status !== 200 || !(now.j.run && (now.j.run.pending || now.j.run.busy))) break; }
    const d1 = await gj(D + '/dump'), byId = {}; d1.files.forEach(f => { byId[f.id] = f; });
    const pathOf = f => { const parts = []; let x = f; for (let i = 0; i < 12 && x && x.parents.length; i++) { x = byId[x.parents[0]]; if (x) parts.unshift(x.name); } return parts.join(' / '); };
    const real = d1.files.filter(f => !/google-apps/.test(f.mimeType)), links = d1.files.filter(f => f.mimeType === 'application/vnd.google-apps.shortcut');
    const where = k => real.filter(f => f.md5 === F[k].md5).map(f => pathOf(f) + ' / ' + f.name);
    ok('Copy files now (S1): it ran without a problem', now.status === 200 && now.j.run && now.j.run.ok !== false && !now.j.run.error, now.j.run || now.j);
    ok('   Diesel Issue photos: site / kind / year / month / the entry – "Dashboard 1.jpg", "Hour meter 1.jpg"', where('dash').length === 1 && where('dash')[0] === 'RCL ERP – Files (backup) / VTR Site – NH 848 (S1) / Diesel Issue photos / 2026 / 10 October / 05-10-2026 MH-15-B158 B158-DI1 / Dashboard 1.jpg' &&
      where('hrs')[0] === 'RCL ERP – Files (backup) / VTR Site – NH 848 (S1) / Diesel Issue photos / 2026 / 10 October / 05-10-2026 MH-15-B158 B158-DI1 / Hour meter 1.jpg', [where('dash'), where('hrs')]);
    ok('   Diesel Inward bill copies: "… / Diesel Inward bills / 2026 / 10 October / 04-10-2026 B158-IN1 Rig Pump / Bill copy 1.jpg"', where('bill').length === 1 && /Diesel Inward bills \/ 2026 \/ 10 October \/ 04-10-2026 B158-IN1 Rig Pump \/ Bill copy 1\.jpg$/.test(where('bill')[0]), where('bill'));
    const attLinks = links.filter(f => byId[f.target] && byId[f.target].md5 === F.att.md5).map(f => pathOf(f) + ' / ' + f.name);
    ok('   a file on two Log Book entries: copied ONCE (into the first entry), the second entry has a shortcut to it', where('att').length === 1 && /Log Book attachments \/ 2026 \/ 10 October \/ 05-10-2026 MH-15-B158 Day \/ Challan\.jpg$/.test(where('att')[0]) &&
      attLinks.some(x => /Log Book attachments \/ 2026 \/ 10 October \/ 06-10-2026 MH-15-B159 Day \/ Challan\.jpg$/.test(x)), { file: where('att'), links: attLinks });
    ok('   a PDF and a 6 MB photo (sent the resumable way): each once, whole (MD5 as Drive counted it = the file\'s)', where('doc').length === 1 && /Report\.pdf$/.test(where('doc')[0]) && where('big').length === 1 && real.find(f => f.md5 === F.big.md5).size === F.big.bytes.length, { doc: where('doc'), big: where('big') });
    ok('   the submitted bill: "Bills / 2026 / RA-158 rev 1 – Rig Vendor" with shortcuts to the files of its Log Book', links.filter(f => /Bills \/ 2026 \/ RA-158 rev 1 – Rig Vendor$/.test(pathOf(f))).length === 2 &&
      links.filter(f => /RA-158/.test(pathOf(f))).every(f => /^06-10-2026 MH-15-B159 Day – /.test(f.name)), links.filter(f => /RA-158/.test(pathOf(f))).map(f => f.name));
    ok('   a file no entry has (3 days old): "Not linked to any entry / erp-files / 2026 / …"; the one sent just now: not yet (it may still be saved with its entry)', where('loose').length === 1 && /Not linked to any entry \/ erp-files \/ 20\d\d \/ \d\d \w+ \/ [0-9a-f]{64}\.jpg$/.test(where('loose')[0]) && where('young').length === 0, { loose: where('loose'), young: where('young') });
    // (this run's files only: a rig used before keeps the bills of before – their evidence can never be deleted)
    const mine = ['dash', 'hrs', 'bill', 'att', 'doc', 'big', 'loose'].map(k => F[k].md5), inList = "('" + mine.join("','") + "')";
    const rowsBD = Number(sql('rcl', "select count(*) from backup_drive where root = '" + auth.root + "' and kind = 'file' and md5 in " + inList));
    ok('   noted in backup_drive: each file once, with Drive\'s MD5 (= the file\'s); nothing deleted or shared in Drive, ever', rowsBD === 7 && real.filter(f => mine.indexOf(f.md5) > -1).length === 7 && d1.deletes === 0 && d1.shares === 0, { noted: rowsBD, inDrive: real.filter(f => mine.indexOf(f.md5) > -1).length, deletes: d1.deletes, shares: d1.shares });
    const dstate = db => JSON.parse(sql(db, "select value from backup_drive_state where id = 'drive'") || '{}');      // (the copy's notes: table backup_drive_state)
    const cp3 = Number(dstate('rcl').copied) || 0;
    ok('   its notes in the table backup_drive_state (not in the settings)', cp3 >= 7 && !sql('rcl', "select key from web.props where key like 'DRV%' and key <> 'DRV_OFF'"), { copied: cp3 });
    // again: nothing new, nothing twice
    const n0 = d1.files.length; now = await P('/api/admin', { action: 'drvNow', site: 'S1' });
    ok('   pressed again: nothing copied twice', now.status === 200 && (await gj(D + '/dump')).files.length === n0, { before: n0, after: (await gj(D + '/dump')).files.length });

    // ---- 4. a new entry with a photo – the nightly job copies it (after the Sheet backup); a file Drive did not receive whole ----
    for (let i = 0; i < 12; i++) { const c0 = await cronQuick(3005); const sb = JSON.parse(sql('rcl', "select value from web.props where key = 'SB_INFO'") || '{}'); if (!c0.busy && !Number(sb.pending)) break; }      // (the Sheet backup of the day done first)
    await mk('rcl', 3100, 'dash2', 'diesel-photos', '2026-11/' + u() + '.jpg', jpg(25000), 'image/jpeg');
    sql('rcl', "insert into diesel_issue (id, issue_date, machinery, photos, updated_at) values ('B158-DI2', '2026-11-02', 'MH-15-B158', " + J([{ k: 'dash', p: F.dash2.p }]) + ", " + AGO + ")");
    await fetch(D + '/corrupt?n=1');
    let n1 = await cronQuick(3005);      // (the nightly job copies even when an open page copied a minute ago)
    let dst = dstate('rcl');
    ok('the nightly job: a file Drive did not receive whole (its MD5 is not the file\'s) is NOT noted as copied – said, and tried again', n1.status === 200 && /did not receive the file whole/.test(dst.error || '') && !sql('rcl', "select src from backup_drive where src = 'file:diesel-photos/" + F.dash2.p + "'"), { error: dst.error, pending: dst.pending });
    ok('   it waits on the list "tried again by itself" (after an hour, 6 hours, then every day) – the other files go on', dst.bad && dst.bad['file:diesel-photos/' + F.dash2.p] && dst.bad['file:diesel-photos/' + F.dash2.p].n === 1 && !dst.pending, dst.bad);
    // an hour later (rig: its time on the list put back by 2 hours)
    sql('rcl', "update backup_drive_state set value = jsonb_set(value::jsonb, '{bad,file:diesel-photos/" + F.dash2.p + ",at}', to_jsonb((now() - interval '2 hours')::text))::text where id = 'drive'");
    for (let i = 0; i < 4; i++) { n1 = await cronQuick(3005); dst = dstate('rcl'); if (!dst.pending) break; }
    const good2 = (await gj(D + '/dump')).files.filter(f => f.md5 === F.dash2.md5);
    ok('   an hour later it is copied whole: "… / 2026 / 11 November / 02-11-2026 MH-15-B158 B158-DI2 / Dashboard 1.jpg"; off the list; the problem cleared', good2.length === 1 && !dst.error && !(dst.bad || {})['file:diesel-photos/' + F.dash2.p] && !!sql('rcl', "select src from backup_drive where src like 'file:diesel-photos/" + F.dash2.p + "%'"), { copies: good2.length, error: dst.error });

    // ---- 5. T2: its step, its own files in its own folder (never S1's) ----
    sql('rcl_s2', step(path.join(APP, 'sql', 'supabase_step1zf_storage_drive.sql')));
    await mk('rcl_s2', 3102, 't2dash', 'diesel-photos', '2026-10/' + u() + '.jpg', jpg(15000), 'image/jpeg');
    sql('rcl_s2', "delete from diesel_issue where id like 'B158-%'; insert into diesel_issue (id, issue_date, machinery, photos, updated_at) values ('B158-T2DI', '2026-10-07', 'MH-09-T2', " + J([{ k: 'dash', p: F.t2dash.p }]) + ", " + AGO + ")");
    await wait(1500);
    now = await P('/api/admin', { action: 'drvNow', site: 'T2' });
    const d2 = await gj(D + '/dump'), by2 = {}; d2.files.forEach(f => { by2[f.id] = f; });
    const path2 = f => { const parts = []; let x = f; for (let i = 0; i < 12 && x && x.parents.length; i++) { x = by2[x.parents[0]]; if (x) parts.unshift(x.name); } return parts.join(' / '); };
    const t2f = d2.files.filter(f => f.md5 === F.t2dash.md5);
    ok('T2 (after its step 1zf): its photo in ITS folder "Test Site T2 (T2) / Diesel Issue photos / …"; S1\'s files not in T2\'s database\'s notes', now.status === 200 && t2f.length === 1 && /^RCL ERP – Files \(backup\) \/ Test Site T2 \(T2\) \/ Diesel Issue photos \/ 2026 \/ 10 October \/ 07-10-2026 MH-09-T2 B158-T2DI$/.test(path2(t2f[0])) &&
      Number(sql('rcl_s2', "select count(*) from backup_drive where kind = 'file'")) === 1, { path: t2f[0] && path2(t2f[0]), notes: sql('rcl_s2', "select count(*) from backup_drive where kind = 'file'") });

    // ---- 6. Storage after: how full the Drive is; what each site has copied ----
    r = await P('/api/admin', { action: 'stoGet' });
    const s1b = (r.j.sites || []).find(x => x.code === 'S1') || {}, q = (r.j.drive || {}).quota || {};
    ok('Storage after: Google Drive – the account and how full (as Google says); S1: files copied and their size, the last copy', q.acct === 'erp@rig.test' && q.used === (await gj(D + '/dump')).used && q.limit > 0 && s1b.drive && s1b.drive.connected && s1b.drive.copied === cp3 + 1 && s1b.drive.lastRun && !s1b.drive.pending, { quota: q, drive: s1b.drive });

    // ---- 7. Drive full; the access taken back – said plainly, nothing lost ----
    await mk('rcl', 3100, 'dash3', 'diesel-photos', '2026-11/' + u() + '.jpg', jpg(26000), 'image/jpeg');
    sql('rcl', "insert into diesel_issue (id, issue_date, machinery, photos, updated_at) values ('B158-DI3', '2026-11-03', 'MH-15-B158', " + J([{ k: 'hrs', p: F.dash3.p }]) + ", " + AGO + ")");
    await fetch(D + '/full?bytes=' + ((await gj(D + '/dump')).used + 1000));
    now = await P('/api/admin', { action: 'drvNow', site: 'S1' });
    ok('Google Drive full: "Google Drive is full … buy more Google storage" – the file is not noted, the copy goes on later', /Google Drive is full/.test((now.j.run && now.j.run.error) || '') && !sql('rcl', "select src from backup_drive where src = 'file:diesel-photos/" + F.dash3.p + "'"), now.j.run);
    await fetch(D + '/full?bytes=0'); await fetch(D + '/revoke');
    now = await P('/api/admin', { action: 'drvNow', site: 'S1' });
    ok('the access taken back in Google: "the Super Admin connects Google Drive again"', /connects Google Drive again/.test((now.j.run && now.j.run.error) || ''), now.j.run);
    // connected again (the same account): the same folder – nothing copied twice; the file left over goes in
    r = await P('/api/admin', { action: 'drvStart' }); const st2 = new URL(r.j.url).searchParams.get('state');
    await (await fetch('http://127.0.0.1:3005/api/drive?state=' + st2 + '&code=good-code')).text();
    const auth2 = JSON.parse(sql('rcl', "select value from web.props where key = 'DRIVE_AUTH'") || '{}');
    const before3 = (await gj(D + '/dump')).files.filter(f => !/google-apps/.test(f.mimeType)).length;
    now = await P('/api/admin', { action: 'drvNow', site: 'S1' });
    const after3 = (await gj(D + '/dump')).files.filter(f => !/google-apps/.test(f.mimeType)).length;
    ok('   connected again with the same account: the same folder; only the file left over is copied (nothing twice)', auth2.root === auth.root && after3 === before3 + 1 && (await gj(D + '/dump')).files.filter(f => f.md5 === F.dash3.md5).length === 1, { root: auth2.root === auth.root, before: before3, after: after3 });

    // ---- 8. the Admin's own Backup window (Mechanical): this site's storage ----
    const adm = (await raw(3006, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result || {};
    const bn = adm.token ? await raw(3006, { fn: 'api', args: [adm.token, 'backupNow', []] }) : {};
    const sto = (bn.result || {}).storage || {};
    ok('the Admin\'s Backup window: this site\'s database, files, backup Sheet and Drive copy', !!adm.token && sto.db && sto.db.limit === 8 * 1073741824 && sto.files && sto.files.n >= 8 && sto.drive && sto.drive.connected && sto.drive.copied === cp3 + 2, { error: bn.error, db: sto.db, files: sto.files && sto.files.n, drive: sto.drive });
    // ---- 8b. (review) a folder deleted by hand in that Drive: an entry's folder is made again; a bigger one: the whole copy of the site again ----
    const tree = d => { const by = {}; d.files.forEach(f => { by[f.id] = f; }); return f => { const parts = []; let x = f; for (let i = 0; i < 12 && x && x.parents.length; i++) { x = by[x.parents[0]]; if (x) parts.unshift(x.name); } return parts.join(' / '); }; };
    const FOLDER = 'application/vnd.google-apps.folder', di2 = '02-11-2026 MH-15-B158 B158-DI2';
    let d3 = await gj(D + '/dump'); const di2f = d3.files.find(f => f.mimeType === FOLDER && f.name === di2);
    await fetch(D + '/gone?id=' + (di2f && di2f.id));      // (deleted by hand, with its photo)
    await mk('rcl', 3100, 'dash2b', 'diesel-photos', '2026-11/' + u() + '.jpg', jpg(24000), 'image/jpeg');
    sql('rcl', "set session_replication_role = replica; update diesel_issue set photos = " + J([{ k: 'dash', p: F.dash2.p }, { k: 'dash', p: F.dash2b.p }]) + ", updated_at = " + AGO.replace('3 minutes', '2 minutes') + " where id = 'B158-DI2';");      // (rig: a second photo added two minutes ago)
    for (let i = 0; i < 4; i++) { n1 = await cronQuick(3005); dst = dstate('rcl'); if (!dst.pending) break; }
    d3 = await gj(D + '/dump'); let p3 = tree(d3);
    const di2now = d3.files.filter(f => f.mimeType === FOLDER && f.name === di2), in2 = di2now.length === 1 ? d3.files.filter(f => f.parents[0] === di2now[0].id).map(f => f.name + '=' + (f.md5 === F.dash2.md5 ? 'dash2' : f.md5 === F.dash2b.md5 ? 'dash2b' : '?')).sort() : [];
    ok('a deleted entry folder (by hand in Drive): made again with ALL its files – the one that was in it and the new one; the copy did not stop; said in Storage', di2f && di2now.length === 1 && /2026 \/ 11 November$/.test(p3(di2now[0])) && in2.join(',') === 'Dashboard 1.jpg=dash2,Dashboard 2.jpg=dash2b' && !dst.error && /a folder was deleted in Google Drive/.test(dst.note || ''), { folders: di2now.length, in: in2, error: dst.error, note: dst.note });
    // a bigger folder: "Diesel Inward bills" of S1 deleted by hand – a new inward with a bill copy
    const site1 = 'VTR Site – NH 848 (S1)', inwF = d3.files.find(f => f.mimeType === FOLDER && f.name === 'Diesel Inward bills' && p3(f) === 'RCL ERP – Files (backup) / ' + site1);
    await fetch(D + '/gone?id=' + (inwF && inwF.id));
    await mk('rcl', 3100, 'bill2', 'diesel-photos', 'inward/2026-11/' + u() + '.jpg', jpg(17000), 'image/jpeg');
    sql('rcl', "insert into diesel_inward (id, date, pump_name, photos, updated_at) values ('B158-IN2', '2026-11-04', 'Rig Pump', " + J([{ p: F.bill2.p }]) + ", " + AGO + ")");
    for (let i = 0; i < 10; i++) { n1 = await cronQuick(3005); dst = dstate('rcl'); if (!dst.pending) break; }
    d3 = await gj(D + '/dump'); p3 = tree(d3);
    const tops = d3.files.filter(f => f.mimeType === FOLDER && f.parents[0] === auth.root).map(f => f.name), again = tops.find(x => /^VTR Site – NH 848 \(S1\) – made again \d\d-\d\d-\d{4}$/.test(x)) || '';
    const allMine = ['dash', 'hrs', 'bill', 'att', 'doc', 'big', 'loose', 'dash2', 'dash2b', 'dash3', 'bill2'];
    const inAgain = k => d3.files.filter(f => f.md5 === F[k].md5 && !/google-apps/.test(f.mimeType) && p3(f).indexOf('RCL ERP – Files (backup) / ' + again + ' /') === 0).length;
    ok('a bigger folder deleted by hand ("Diesel Inward bills"): the whole copy of the site made again in "' + site1 + ' – made again <date>" – every file once there, the new bill copy too; the old folder of the site stays; said in Storage', !!again && tops.indexOf(site1) > -1 &&
      allMine.every(k => inAgain(k) === 1) && d3.files.some(f => f.md5 === F.bill2.md5 && /Diesel Inward bills \/ 2026 \/ 11 November \/ 04-11-2026 B158-IN2 Rig Pump$/.test(p3(f))) && !dst.error && !dst.pending && /whole copy of this site is made again/.test(dst.note || ''),
      { tops: tops, once: allMine.map(k => k + ':' + inAgain(k)).join(' '), error: dst.error, pending: dst.pending, note: dst.note });
    ok('Never deleted or shared anything in Google Drive', (await gj(D + '/dump')).deletes === 0 && (await gj(D + '/dump')).shares === 0);

    // ---- 9. the real pages: the Portal's Storage; the Admin's Backup window ----
    try {
      require('./browser/geo-shim.js');      // (the app opens only with the location on: every page of this browser has it, as a phone with its location on)
      const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'), puppeteer = require('puppeteer-core');
      const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
      try {
        const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 1000 }); const errs = []; pg.on('pageerror', x => errs.push(String(x.message).slice(0, 200)));
        await pg.goto('http://127.0.0.1:3010/', { waitUntil: 'networkidle0' });      // (the page's first calls done before typing: typed earlier, the sign-in form could be reset under it) await pg.waitForSelector('#l_email', { visible: true });
        await pg.type('#l_email', 'sa@rcl.test'); await pg.type('#l_pass', 'Super#Admin2040'); await pg.click('#l_btn');
        await pg.waitForSelector('#sa_tabs button[data-t="sites"]', { visible: true, timeout: 20000 }); await pg.click('#sa_tabs button[data-t="sites"]'); await pg.waitForSelector('#t_sites:not([hidden])');
        await pg.click('#st_sto'); await pg.waitForFunction(() => /Google Drive –/.test((document.getElementById('sto_panel') || {}).innerText || ''), { timeout: 60000 });
        const txt = await pg.$eval('#sto_panel', x => x.innerText);
        if (process.env.SHOT_DIR) await pg.screenshot({ path: path.join(process.env.SHOT_DIR, 'storage158-portal.png'), fullPage: true });
        ok('the Portal page: Sites → Storage – every site, the Portal, Engineering, all files together, Google Drive connected with how full it is, the buttons', /S1/.test(txt) && /T2/.test(txt) && /Portal/.test(txt) && /Engineering \(all sites\)/.test(txt) && /All photos and files together/.test(txt) && /Connected: erp@rig\.test/.test(txt) && /Copy files now/.test(txt) && /Connect again/.test(txt) && /\d+(\.\d)? %/.test(txt), txt.slice(0, 700));
        ok('   no script error on the Portal page', errs.length === 0, errs);
        const ctx = await b.createBrowserContext(), p2 = await ctx.newPage(), e2 = []; p2.on('pageerror', x => e2.push(String(x.message).slice(0, 200)));
        await p2.setViewport({ width: 1440, height: 900 }); await p2.goto('http://127.0.0.1:3006/', { waitUntil: 'load' }); await wait(1200);
        const f = p2.frames().find(x => x !== p2.mainFrame());
        await f.evaluate(() => { try { localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
        await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
        await f.evaluate(() => { setBackupInfo({ ok: true, lastCheck: new Date().toISOString(), lastRun: new Date().toISOString() }); document.getElementById('bk_btn').click(); });
        try { await f.waitForFunction(() => /Storage/.test(document.body.innerText) && !!document.querySelector('table.sto'), { timeout: 100000 }); }
        catch (e) { if (process.env.SHOT_DIR) await p2.screenshot({ path: path.join(process.env.SHOT_DIR, 'storage158-admin-fail.png') });
          throw new Error('the Backup window did not show Storage: ' + (await f.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '?')) + ' | errors: ' + e2.join(' | ')); }
        const t2x = await f.evaluate(() => (document.querySelector('table.sto') || {}).innerText || '');
        await wait(900);      // (the window has faded in)
        if (process.env.SHOT_DIR) await p2.screenshot({ path: path.join(process.env.SHOT_DIR, 'storage158-admin.png') });
        ok('the Admin\'s Backup window (the real page): Storage – Database, Photos and files, Backup Sheet, Google Drive copy', /Database/.test(t2x) && /of 8\.00 GB/.test(t2x) && /Photos and files/.test(t2x) && /Google Drive copy/.test(t2x) && /files copied/.test(t2x), t2x.slice(0, 400));
        ok('   no script error on the Mechanical page', e2.length === 0, e2);
      } finally { await b.close(); }
    } catch (e) { ok('the pages could be opened in the browser', false, String(e && e.stack || e).slice(0, 300)); }
  } catch (e) { ok('no crash', false, String(e && e.stack || e)); }
  finally {
    try { sql('rcl_portal', "update modules set url = '" + keepMod.replace(/'/g, "''") + "' where key = 'mechanical'"); } catch (e) { /* as it was */ }
    for (const db of ['rcl', 'rcl_s2']) { try { sql(db, "delete from web.props where key in ('DRIVE_AUTH', 'DRIVE_STATE', 'DRV_STATE', 'DRV_OFF'); delete from web.cache where key in ('DRV_NEXT', 'DRV_OFF', 'DRV_QUOTA', 'STO_USAGE');"); } catch (e) { /* rig */ } }
    [3005, 3006].forEach(killPort); kids.forEach(k => { try { process.kill(-k.pid); } catch (e) { try { k.kill(); } catch (e2) {} } });
    await start(PDIR, Object.assign({}, PORTAL_ENV, { MECH_APP_URL: 'http://127.0.0.1:3000' }), 3010).catch(() => {}); await start(EDIR, ENG_ENV, 3040).catch(() => {});
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
