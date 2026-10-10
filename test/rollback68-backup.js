/* RELEASE CHECK 1b – after going back from update-68 to update-65s the Google Sheet backup still works.
 * (update-67 / 68 keep more in the backup's notes – BK_STATE – than update-65 did.)
 * On the local test rig, against the stand-in for Google's Sheets API (test/sheets-standin.js). Own servers on 3005 / 3006:
 *     3005 = update-68 (this folder)        3006 = update-65s (SAFE_DIR=<its folder>)
 *   SAFE_DIR=/path/to/update-65s node test/rollback68-backup.js
 * Nothing here touches the live database or a real Google Sheet. */
const { execSync, spawn } = require('child_process'); const path = require('path'), crypto = require('crypto');
const NEW_DIR = path.join(__dirname, '..'), SAFE_DIR = process.env.SAFE_DIR || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA -q"', { input: q, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 420) : '')); };
const G = 'http://127.0.0.1:3997', g = async p => (await fetch(G + p)).json();
const raw = async (port, body) => { let r; for (let i = 0; ; i++) { try { r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) }); break; } catch (e) { if (i >= 6) throw e; await wait(500); } } return r.json(); };
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const ENV = Object.assign({}, process.env, { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'backup-robot@rig.test', private_key: key }), BACKUP_SHEET_ID: 'rigSheet0123456789abcdefghijklmn', GOOGLE_SHEETS_URL: G, GOOGLE_TOKEN_URL: G + '/token', CRON_SECRET: 'local-cron-secret' });
const procs = [];
const start = async (dir, port) => { const c = spawn('node', ['dev.js'], { cwd: dir, env: Object.assign({}, ENV, { PORT: String(port) }), stdio: 'ignore', detached: true }); procs.push(c);
  for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/')).status === 200) return c; } catch (e) {} await wait(300); } throw new Error('server ' + port + ' did not start'); };
const stopAll = () => procs.forEach(c => { try { process.kill(-c.pid); } catch (e) { try { c.kill(); } catch (e2) {} } });
const state = () => { try { return JSON.parse(sql("select value from web.props where key = 'BK_STATE'") || '{}'); } catch (e) { return {}; } };
const tabRows = async title => { const d = await g('/dump'); const t = d.tabs.find(x => x.title === title); return t ? t.rows - 1 : -1; };
const clear = () => sql("delete from web.props where key in ('BK_STATE', 'SB_INFO'); delete from web.locks where name = 'backup'; delete from diesel_issue where driver_name = 'RB-BKP'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%';");

(async () => {
  if (!SAFE_DIR) { console.log('set SAFE_DIR to the folder of update-65s'); process.exit(1); }
  const stand = spawn('node', [path.join(__dirname, 'sheets-standin.js')], { stdio: 'ignore', detached: true }); procs.push(stand);
  try {
    for (let i = 0; i < 30; i++) { try { await g('/dump'); break; } catch (e) { await wait(200); } }
    clear(); await g('/reset?bare=1');
    await start(NEW_DIR, 3005);
    let a = (await raw(3005, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    let b = await raw(3005, { fn: 'api', args: [a, 'backupNow', []] }); for (let i = 0; i < 6 && b.result && b.result.pending; i++) { await wait(1200); b = await raw(3005, { fn: 'api', args: [a, 'backupNow', []] }); }
    const s68 = state(), n68 = await tabRows('Diesel Issue');
    ok('update-68 makes its backup; its notes hold more than update-65 kept (fullRun / todo / died …)', !b.error && !!s68.sig && ('fullRun' in s68 || 'todo' in s68), b.error || Object.keys(s68).join(', '));
    // ---- the rollback: update-65s on the same database and the same Sheet ----
    await start(SAFE_DIR, 3006);
    const a65 = (await raw(3006, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const sv = await raw(3006, { fn: 'api', args: [a65, 'saveDieselIssue', [{ date: sql("select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')"), shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: 'RB-BKP', qty: 2, kmReading: 99930 + Math.floor(Math.random() * 9), force: true }]] });
    const calls0 = (await g('/dump')).calls;
    const bk = await raw(3006, { fn: 'api', args: [a65, 'backupNow', []] }), calls1 = (await g('/dump')).calls, s65 = state();
    const want = Number(sql('select count(*) from diesel_issue')), got = await tabRows('Diesel Issue');
    ok('ROLLBACK: update-65s reads the notes update-68 left, is not confused by them and makes a backup (it copies everything once, to be sure); the new Diesel Issue is in the Sheet', !sv.error && !bk.error && calls1 > calls0 && got === want && !!s65.lastFull, { save: sv.error || sv.result.id, backup: bk.error || Object.keys(bk.result || {}).join(','), calls_to_google: calls1 - calls0, tab_rows: got, table_rows: want, notes_after: Object.keys(s65).join(',') });
    const sync = await raw(3006, { fn: 'api', args: [a65, 'sync', []] });
    ok('…and the app on update-65s shows the backup as all right', sync.result && sync.result.backup && sync.result.backup.ok === true, sync.error || sync.result.backup);
    // ---- forward again ----
    if (sv.result && sv.result.id) await raw(3006, { fn: 'api', args: [a65, 'deleteDieselIssue', [sv.result.id]] });
    await wait(1200); sql("delete from web.cache where key like 'LG\\_%'");
    a = (await raw(3005, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    let f = await raw(3005, { fn: 'api', args: [a, 'backupNow', []] }); for (let i = 0; i < 6 && f.result && f.result.pending; i++) { await wait(1200); f = await raw(3005, { fn: 'api', args: [a, 'backupNow', []] }); }
    const want2 = Number(sql('select count(*) from diesel_issue')), got2 = await tabRows('Diesel Issue');
    ok('FORWARD AGAIN: update-68 reads the notes update-65s left and its backup is right again (the deleted entry is gone from the Sheet)', !f.error && got2 === want2, { backup: f.error || 'ok', tab_rows: got2, table_rows: want2, before_all: n68 });
  } finally { stopAll(); try { clear(); } catch (e) {} }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); stopAll(); process.exit(1); });
