/* The Google Sheet backup, checked on the local test rig against a stand-in for Google's Sheets API (test/sheets-standin.js).
 * It starts its own two copies of the app's server (ports 3005 / 3006) with the backup switched on, so the rig's normal
 * servers are left alone. Nothing here touches the live database or a real Google Sheet.
 *   node test/backup.js [section …]      sections: privacy manual first text pieces cutoff failure cron changes
 *   APP_DIR=/path/to/another/copy node test/backup.js …      the same checks against another copy of the code ("before") */
const { execSync, spawn } = require('child_process'); const path = require('path'), crypto = require('crypto');
const APP = process.env.APP_DIR || path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 360) : '')); };
const want = process.argv.slice(2), on = s => !want.length || want.indexOf(s) > -1;
const G = 'http://127.0.0.1:3997', g = async p => (await fetch(G + p)).json();
const ADMIN = ['sujit@rcl.test', 'Nashik#Road848!'];
const raw = async (port, body) => { let r; for (let i = 0; ; i++) { try { r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) }); break; } catch (e) { if (i >= 6) throw e; await wait(500); } } const j = await r.json(); return { status: r.status, error: j.error, result: j.result }; };
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const ENV = Object.assign({}, process.env, { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'backup-robot@rig.test', private_key: key }), BACKUP_SHEET_ID: 'rigSheet0123456789abcdefghijklmn', GOOGLE_SHEETS_URL: G, GOOGLE_TOKEN_URL: G + '/token', CRON_SECRET: 'local-cron-secret' });
const procs = {};
const start = async port => { procs[port] = spawn('node', ['dev.js'], { cwd: APP, env: Object.assign({}, ENV, { PORT: String(port) }), stdio: 'ignore', detached: true });
  for (let i = 0; i < 50; i++) { try { const x = await fetch('http://127.0.0.1:' + port + '/'); if (x.status === 200) return; } catch (e) {} await wait(300); } throw new Error('server ' + port + ' did not start'); };
const stop = (port, sig) => { const c = procs[port]; if (!c) return; try { process.kill(-c.pid, sig || 'SIGTERM'); } catch (e) { try { c.kill(sig || 'SIGTERM'); } catch (e2) {} } delete procs[port]; };
const props = () => { const o = {}; sql("select key || chr(9) || value from web.props where key in ('BK_STATE', 'SB_INFO')").split('\n').filter(Boolean).forEach(l => { const i = l.indexOf('\t'); try { o[l.slice(0, i)] = JSON.parse(l.slice(i + 1)); } catch (e) { o[l.slice(0, i)] = l.slice(i + 1); } }); return o; };
const clearNotes = () => sql("delete from web.props where key in ('BK_STATE', 'SB_INFO', 'BK_BUDGET_MS', 'BK_GROUP_ROWS'); delete from web.locks where name = 'backup';");
const setKnob = (k, v) => sql("insert into web.props (key, value) values ('" + k + "', '" + v + "') on conflict (key) do update set value = excluded.value");
const tableRows = () => { const o = {}; sql("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'deleted_rows'").split('\n').filter(Boolean).forEach(t => { o[t] = Number(sql('select count(*) from public.' + t)); }); return o; };
const TITLES = { master: 'Master', diesel_inward: 'Diesel Inward', diesel_transfer: 'Diesel Transfer', diesel_issue: 'Diesel Issue', log_book: 'Log Book', tank_check: 'Tank Check', activity_log: 'Activity Log', app_users: 'Users', vendors: 'Vendors', boq: 'BOQ', bills: 'Bills', payments: 'Payments', debit_notes: 'Debit Notes', compliance_history: 'Compliance History', breakdowns: 'Breakdowns', breakdown_reports: 'Breakdown Reports' };
// which tabs do not have exactly the rows of their table (the Activity Log grows with every call: it must have at least as many as before)
const mismatch = async (counts, loose) => { const d = await g('/dump'), bad = []; Object.keys(counts).forEach(t => { const tab = d.tabs.find(x => x.title === (TITLES[t] || t)); const rows = tab ? tab.rows - 1 : -1, want2 = counts[t];
  const fine = tab && (t === 'activity_log' || (loose && loose.indexOf(t) > -1) ? rows >= Math.min(want2, 1) : rows === want2 || (want2 === 0 && rows <= 1)); if (!fine) bad.push(t + ': tab ' + rows + ' ≠ table ' + want2); }); return bad; };

(async () => {
  const stand = spawn('node', [path.join(__dirname, 'sheets-standin.js')], { stdio: 'ignore', detached: true });
  const vend = 'BKP Vendor ' + Date.now().toString(36);
  try {
    for (let i = 0; i < 30; i++) { try { await g('/dump'); break; } catch (e) { await wait(200); } }
    clearNotes(); await g('/reset?bare=1');
    await start(3005); await start(3006);
    let r = await raw(3005, { fn: 'login', args: ADMIN }); const admin = r.result.token; ok('admin signs in (a server with the backup switched on)', !!admin, r.error);
    const api = (fn, args, opt) => raw((opt && opt.port) || 3005, { fn: 'api', args: [(opt && opt.token) || admin, fn, args || []] });
    const page = (port, token) => fetch('http://127.0.0.1:' + port + '/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token || admin }) }).then(async x => Object.assign({ status: x.status }, await x.json()));
    const cron = (port, proof) => fetch('http://127.0.0.1:' + port + '/api/backup?full=1', { headers: proof === false ? {} : { Authorization: 'Bearer local-cron-secret' } }).then(async x => Object.assign({ status: x.status }, await x.json()));
    // a user who is not the Admin (made through the app, own password set)
    const mail = 'bkp' + Date.now().toString(36) + '@rcl.test'; const init = await api('usersAdmin'), perms = {}; ((init.result && init.result.modules) || []).forEach(m => { perms[m.key || m] = 'View'; });
    await api('saveUserAdmin', [{ email: mail, name: 'Backup Viewer', active: true, admin: false, perms: perms, isNew: true, newPassword: 'Temp#12345' }]);
    let l = await raw(3005, { fn: 'login', args: [mail, 'Temp#12345'] }); const c = await raw(3005, { fn: 'changePassword', args: [l.result.token, 'Temp#12345', 'Backup#View9!x'] }); const user = (c.result && c.result.token) || l.result.token;

    if (on('first') || on('text') || on('privacy') || on('manual')) {
      console.log('\n=== THE FIRST BACKUP: EVERY TABLE, AS IT IS IN THE DATABASE ===');
      // values a Sheet would "improve" if it were left to guess, put into the database first
      await api('saveVendor', [{ name: vend, gstReg: 'No', pan: 'ABCPE1234T', bank: '=1+1 Bank', account: '000123456789012345', ifsc: 'SBIN0000001' }, 'add']);
      const acct = sql("select account_number from vendors where vendor_name = '" + vend + "'");
      r = await api('backupNow');
      const counts = tableRows(), bad = await mismatch(counts), d = await g('/dump');
      ok('"Backup" button on an empty Sheet: every table has its tab with exactly its rows', !r.error && bad.length === 0 && d.tabs.length >= Object.keys(counts).length, r.error || bad.join('; ') || (d.tabs.length + ' tabs, ' + d.calls + ' calls to Google'));
      const users = (await g('/tab?title=Users')).values || [], flat = JSON.stringify(users);
      ok('passwords are not copied (the cell says "(hidden)")', flat.indexOf('(hidden)') > -1 && flat.indexOf('sha256') === -1 && flat.indexOf('scrypt') === -1 && flat.indexOf('Temp#') === -1, JSON.stringify(users[1] || []).slice(0, 120));
      if (on('text')) {
        const v = (await g('/tab?title=Vendors')).values || [], row = v.find(x => x.some(c2 => String(c2).indexOf(vend) > -1)) || [], head = v[0] || [];
        const at = h => row[head.indexOf(h)];
        const lb = (await g('/tab?title=Log%20Book')).values || [], dateCol = (lb[0] || []).indexOf('Date'), aDate = (lb[1] || [])[dateCol];
        ok('[fix] a TEXT stays the text it is: the account number ' + acct + ' is sent as text (not left for the Sheet to turn into a number), "=1+1 Bank" can never be a formula; a date goes as a date',
          at('Account Number') === "'" + acct && acct === '000123456789012345' && String(at('Bank Name')).charAt(0) === "'" && /^\d{4}-\d{2}-\d{2}$/.test(String(aDate)), { account_sent: at('Account Number'), bank_sent: at('Bank Name'), a_date_sent: aDate });
      }
    }

    if (on('privacy')) {
      console.log('\n=== WHO GETS THE LINK OF THE BACKUP SHEET ===');
      const a = await api('sync'), u = await api('sync', [], { token: user }), ub = await api('backupNow', [], { token: user });
      ok('[fix] the Admin\'s page gets the link; a user who is not the Admin gets the state and the time but NOT the link', a.result && a.result.backup && /docs\.google\.com/.test(a.result.backup.url || '') && u.result && u.result.backup && u.result.backup.ok === true && !!u.result.backup.lastCheck && u.result.backup.url === undefined && !(ub.result && ub.result.info && ub.result.info.url),
        { admin_url: !!(a.result.backup || {}).url, user: u.result && u.result.backup, user_backupNow_url: (ub.result && ub.result.info && ub.result.info.url) || 'none' });
    }

    if (on('manual')) {
      console.log('\n=== WHO CAN START A BACKUP BY HAND (update-68, D5) ===');
      await api('backupNow'); await wait(1100);
      const c0 = (await g('/dump')).calls, t0 = (props().BK_STATE || {}).lastTry || '';
      const ub = await api('backupNow', [], { token: user }), c1 = (await g('/dump')).calls, t1 = (props().BK_STATE || {}).lastTry || '';
      ok('[fix] a signed-in user who is not the Admin cannot start a backup: refused by the SERVER, and nothing was started (no call to Google, the backup\'s notes untouched)', /Only Admin can start a backup/.test(ub.error || '') && c1 === c0 && t1 === t0, { answer: ub.error || 'RAN: ' + JSON.stringify(ub.result).slice(0, 80), calls_to_google: c1 - c0, notes_changed: t1 !== t0 });
      const ab = await api('backupNow');
      ok('the Admin can: the backup runs and answers', !ab.error && ab.result && (ab.result.upToDate === true || ab.result.full === true || Array.isArray(ab.result.lines)), ab.error || JSON.stringify(ab.result).slice(0, 120));
      const auto = await page(3005, user);
      ok('the backup that runs by itself with an open app (the check every few minutes – not a start by hand) still works for every signed-in user', auto.status === 200 && auto.ok === true, auto);
      const none = await page(3005, 'not-a-session');
      ok('…and is refused without a sign-in', none.status === 401 || none.ok === false || /SESSION_EXPIRED/.test(JSON.stringify(none)), none);
      await wait(1100); const cr = await cron(3006);
      ok('the nightly job with its secret still runs (it does not come through the Admin-only action)', cr.status === 200 && cr.ok === true, cr);
    }

    if (on('changes')) {
      console.log('\n=== AFTER A CHANGE ONLY THE CHANGED TABLES ARE COPIED ===');
      await api('backupNow'); await api('backupNow');
      const before = await g('/dump');
      r = await api('saveDieselIssue', [{ date: '2026-09-30', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 7, kmReading: 99500, driver: 'BKP', force: true }]); const id = r.result && r.result.id;
      const b = await api('backupNow', [], { port: 3006 }), lines = (b.result && b.result.lines) || [];
      ok('after one Diesel Issue: its tab (and the Activity Log) are written, Master is not', !r.error && lines.some(x => x[0] === 'Diesel Issue') && !lines.some(x => x[0] === 'Master'), r.error || JSON.stringify(lines));
      await api('deleteDieselIssue', [id]); await api('backupNow');
      const after = await g('/dump'), di = t => (t.tabs.find(x => x.title === 'Diesel Issue') || {});
      ok('after its delete the tab is as short as the table again (rows and grid)', di(after).rows === di(before).rows && di(after).grid.rowCount === Math.max(di(before).rows, 2), { rows: di(after).rows, grid: di(after).grid });
      const p1 = await page(3005), p2 = await page(3006);
      ok('the open pages asking again within 4 minutes: left alone', p1.skipped === true && p2.skipped === true, JSON.stringify([p1, p2]));
    }

    if (on('pieces')) {
      console.log('\n=== A BACKUP THAT DOES NOT FIT IN ONE RUN GOES ON WHERE IT STOPPED ===');
      // every table a group of its own, Google answering slowly, a run that stops by itself after 3 seconds; a full round is due
      setKnob('BK_GROUP_ROWS', '1'); setKnob('BK_BUDGET_MS', '3000'); await g('/slow?ms=900');
      const st0 = props().BK_STATE || {}; delete st0.lastFull; delete st0.fullRun; sql("update web.props set value = $$" + JSON.stringify(st0) + "$$ where key = 'BK_STATE'"); await wait(1200);
      const counts = tableRows(), n = Object.keys(counts).length;
      const runs = []; let guard = 0;
      do { r = await api('backupNow'); const s = props(); runs.push({ copied: ((r.result && r.result.lines) || []).length, pending: (r.result && r.result.pending) || 0, todo: ((s.BK_STATE || {}).todo || []).length, info_pending: (s.SB_INFO || {}).pending || 0, full: !!(r.result && r.result.full), err: r.error }); guard++; } while (!runs[runs.length - 1].err && runs[runs.length - 1].pending > 0 && guard < 30);
      const s1 = props(), last = runs[runs.length - 1];
      ok('[fix] the first run copies SOME tables, says how many are left, and has them noted (todo) – it is not "all or nothing"', runs.length >= 2 && runs[0].copied >= 1 && runs[0].copied < n && runs[0].pending === n - runs[0].copied && runs[0].todo === runs[0].pending && runs[0].info_pending === runs[0].pending && !runs[0].full, runs.slice(0, 4));
      ok('[fix] every later run goes on with the tables that are left (none is done twice), until nothing is left', runs.every((x, i) => !x.err && (i === 0 || x.pending < runs[i - 1].pending)) && last.pending === 0 && runs.reduce((a2, x) => a2 + x.copied, 0) === n, { runs: runs.length, copied_per_run: runs.map(x => x.copied).join(','), tables: n });
      const bad = await mismatch(tableRows());
      ok('[fix] at the end every tab has exactly the rows of its table, the full round is noted as done, nothing is left', bad.length === 0 && last.full === true && !!(s1.BK_STATE || {}).lastFull && !(s1.BK_STATE || {}).fullRun && ((s1.BK_STATE || {}).todo || []).length === 0 && s1.SB_INFO.ok === true && !s1.SB_INFO.pending, bad.join('; ') || { lastFull: (s1.BK_STATE || {}).lastFull });
      const status = (await g('/tab?title=Backup%20Status')).values || [];
      ok('the "Backup Status" tab says what is still to copy / that it is complete', status.some(x => /Still to copy/.test(String(x[0])) && /complete/.test(String(x[1]))), JSON.stringify(status.slice(0, 5)).slice(0, 300));
      sql("delete from web.props where key in ('BK_BUDGET_MS', 'BK_GROUP_ROWS')"); await g('/slow?ms=0');
    }

    if (on('cutoff')) {
      console.log('\n=== A RUN THAT IS CUT OFF IN THE MIDDLE (the server stops a request after 58 s) ===');
      setKnob('BK_GROUP_ROWS', '1'); await g('/slow?ms=2500');
      const cut = async () => { const st = props().BK_STATE || {}; delete st.lastFull; delete st.fullRun; st.todo = []; sql("update web.props set value = $$" + JSON.stringify(st) + "$$ where key = 'BK_STATE'"); await wait(1100);
        const tk = (await raw(3006, { fn: 'login', args: ADMIN })).result.token;
        raw(3006, { fn: 'api', args: [tk, 'backupNow', []] }).catch(() => {});      // a full round starts on server 3006 …
        await wait(7000); stop(3006, 'SIGKILL'); await wait(600); sql("delete from web.locks where name = 'backup'"); await start(3006); };      // … and the server is killed in the middle of it
      await cut();
      const a = props();
      ok('[fix] the run that was killed had already noted the tables it finished, and left its mark', !!(a.BK_STATE || {}).running && Object.keys(((a.BK_STATE || {}).fullRun || {}).done || {}).length >= 1 && ((a.BK_STATE || {}).todo || []).length >= 1, { running: (a.BK_STATE || {}).running, done: Object.keys(((a.BK_STATE || {}).fullRun || {}).done || {}).length, todo: ((a.BK_STATE || {}).todo || []).length });
      // a second run is killed too
      { const tk = (await raw(3006, { fn: 'login', args: ADMIN })).result.token; raw(3006, { fn: 'api', args: [tk, 'backupNow', []] }).catch(() => {}); await wait(4000); stop(3006, 'SIGKILL'); await wait(600); sql("delete from web.locks where name = 'backup'"); await start(3006); }
      // the third run: while it works the app already shows the backup as FAILED (two in a row were cut off); when it finishes: fine again
      const third = api('backupNow'); await wait(2200);
      const mid = props();
      let res3 = await third; let guard = 0; while (!res3.error && res3.result && res3.result.pending > 0 && guard++ < 30) res3 = await api('backupNow');
      const end = props(), bad = await mismatch(tableRows());
      ok('[fix] after two runs cut off in a row the app SHOWS the backup as failed (it used to stay green) and says why', mid.SB_INFO && mid.SB_INFO.ok === false && /cut off 2 times in a row/.test(mid.SB_INFO.error || ''), mid.SB_INFO);
      ok('[fix] the runs after it finish the work: backup fine again, every tab complete, the mark is gone', !res3.error && end.SB_INFO.ok === true && !(end.BK_STATE || {}).running && !(end.BK_STATE || {}).died && bad.length === 0, res3.error || bad.join('; ') || 'complete');
      sql("delete from web.props where key in ('BK_BUDGET_MS', 'BK_GROUP_ROWS')"); await g('/slow?ms=0');
    }

    if (on('failure')) {
      console.log('\n=== GOOGLE DOES NOT ANSWER PROPERLY ===');
      await api('saveVendor', [{ name: vend + ' F', gstReg: 'No', pan: 'ABCPE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add']);
      const st = props().BK_STATE || {}; st.lastCheck = new Date(Date.now() - 10 * 60000).toISOString(); st.lastTry = ''; sql("update web.props set value = $$" + JSON.stringify(st) + "$$ where key = 'BK_STATE'"); await wait(1100);
      await g('/fail?n=40&code=500');
      const calls0 = (await g('/dump')).calls;
      const p1 = await page(3005); const calls1 = (await g('/dump')).calls;
      const p2 = await page(3006); const p3 = await page(3005); const calls2 = (await g('/dump')).calls;
      const a = await api('sync'), u = await api('sync', [], { token: user });
      ok('a backup that fails: the page is told "not ok", the app shows it as failed', p1.ok === false && a.result.backup.ok === false && /Google Sheet \(500\)/.test(a.result.backup.error || ''), { page: p1, admin_sees: String(a.result.backup.error).slice(0, 80) });
      ok('[fix] the pages that ask right after a failure are left alone for 4 minutes (each of them used to start the failing backup again)', p2.skipped === true && p3.skipped === true && calls2 === calls1 && calls1 > calls0, { second: p2, third: p3, calls_to_google: [calls0, calls1, calls2] });
      ok('[fix] a user who is not the Admin sees that there is a problem, not its technical words (they name the robot account)', u.result.backup.ok === false && /tell the Admin/.test(u.result.backup.error || '') && u.result.backup.url === undefined, u.result.backup);
      await g('/fail?n=0'); r = await api('backupNow'); await wait(1300);
      ok('Google answers again: the "Backup" button copies what was waiting, the app shows the backup as fine', !r.error && (await api('sync')).result.backup.ok === true, r.error || JSON.stringify((r.result || {}).lines || 'up to date').slice(0, 120));
    }

    if (on('cron')) {
      console.log('\n=== THE NIGHTLY JOB ===');
      const no = await cron(3005, false), yes = await cron(3005);
      ok('without its proof the nightly call is refused (401); with it the full backup runs (200)', no.status === 401 && no.denied === true && yes.status === 200 && yes.ok === true, { without: no, with: yes });
      await g('/fail?n=40&code=500'); const st = props().BK_STATE || {}; st.lastTry = ''; sql("update web.props set value = $$" + JSON.stringify(st) + "$$ where key = 'BK_STATE'"); await wait(1100);
      const bad = await cron(3006); await g('/fail?n=0');
      ok('[fix] a nightly backup that FAILS answers 500 (the job\'s log showed "200 OK" for a failed backup)', bad.status === 500 && bad.ok === false, bad);
      const two = await Promise.all([cron(3005), cron(3006)]);
      ok('two nightly calls at the same moment: one runs, the other is told "busy" – never two together', two.filter(x => x.busy).length >= 1 || two.every(x => x.ok), JSON.stringify(two));
      ok('no lock is left behind', sql("select count(*) from web.locks where name = 'backup'") === '0');
    }
  } finally {
    stop(3005); stop(3006); try { process.kill(-stand.pid); } catch (e) { try { stand.kill(); } catch (e2) {} }
    try { clearNotes(); sql("delete from vendors where vendor_name like 'BKP Vendor%'; delete from app_users where id like 'bkp%@rcl.test'; delete from diesel_issue where driver_name = 'BKP';"); } catch (e) { console.log('clean-up: ' + String(e.message).slice(0, 160)); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (process.env.APP_DIR ? '   (code in ' + APP + ')' : ''));
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); Object.keys(procs).forEach(p => stop(Number(p))); process.exit(1); });
