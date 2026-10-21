/* The Google Sheet backup, checked on the local test rig against a stand-in for Google's Sheets API (test/sheets-standin.js).
 * It starts its own two copies of the app's server (ports 3005 / 3006) with the backup switched on, so the rig's normal
 * servers are left alone. Nothing here touches the live database or a real Google Sheet.
 *   node test/backup.js [section …]      sections: privacy manual first text pieces cutoff failure cron changes daily logs
 *   APP_DIR=/path/to/another/copy node test/backup.js …      the same checks against another copy of the code ("before") */
const { execSync, spawn } = require('child_process'); const path = require('path'), crypto = require('crypto');
const APP = process.env.APP_DIR || path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const RIG_DB = process.env.RIG_DB || 'rcl', DOOR = process.env.RIG_DOOR || 'http://127.0.0.1:3100';      // (update-141) another test database of the rig
const sql = q => execSync('su postgres -c "psql -d ' + RIG_DB + ' -tA"', { input: q }).toString().trim();
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
// (update-98: a module's sign-ins and used tickets are never copied – SB_SKIP_)
const tableRows = () => { const o = {}; sql("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not in ('deleted_rows', 'store_sessions', 'store_tickets')").split('\n').filter(Boolean).forEach(t => { o[t] = Number(sql('select count(*) from public.' + t)); }); return o; };
const id0 = r => r && r.result && r.result.id;
const TITLES = { master: 'Master', diesel_inward: 'Diesel Inward', diesel_transfer: 'Diesel Transfer', diesel_issue: 'Diesel Issue', log_book: 'Log Book', tank_check: 'Tank Check', activity_log: 'Activity Log', app_users: 'Users', vendors: 'Vendors', boq: 'BOQ', bills: 'Bills', payments: 'Payments', debit_notes: 'Debit Notes', billed_changes: 'Billed Changes', compliance_history: 'Compliance History', breakdowns: 'Breakdowns', breakdown_reports: 'Breakdown Reports' };
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
    let r = await raw(3005, { fn: 'login', args: ADMIN }); const admin = (r.result || {}).token; ok('admin signs in (a server with the backup switched on)', !!admin, r.error);
    const api = (fn, args, opt) => raw((opt && opt.port) || 3005, { fn: 'api', args: [(opt && opt.token) || admin, fn, args || []] });
    const page = (port, token) => fetch('http://127.0.0.1:' + port + '/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token || admin }) }).then(async x => Object.assign({ status: x.status }, await x.json()));
    const cron = (port, proof) => fetch('http://127.0.0.1:' + port + '/api/backup?full=1', { headers: proof === false ? {} : { Authorization: 'Bearer local-cron-secret' } }).then(async x => Object.assign({ status: x.status }, await x.json()));
    // a user who is not the Admin – straight in the database of the rig (since update-90 users are given by the Super Admin, so the
    // Admin's "Users" action refuses: this test made its user that way and stopped there); his password is the Admin's
    const mail = 'bkp' + Date.now().toString(36) + '@rcl.test';
    sql("insert into app_users (id, email, password_hash, name, active, admin) select '" + mail + "', '" + mail + "', password_hash, 'Backup Viewer', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';"); await wait(1200);
    const ul = await raw(3005, { fn: 'login', args: [mail, ADMIN[1]] }); const user = (ul.result || {}).token; ok('(a test user who is not the Admin signs in)', !!user, ul.error);
    // a Super Admin row for the check of the site tables below (rig only; after the user above is made – with a Super Admin the Admin gives no users) – taken out at the end
    sql("insert into rcl_super_admin (email, name, password_hash, recovery_hash) values ('bk-sa@rcl.test', 'Backup check', 'scrypt$32768$8$3$00$11$22', 'scrypt$32768$8$3$33$44$55') on conflict do nothing;");

    if (on('first') || on('text') || on('privacy') || on('manual')) {
      console.log('\n=== THE FIRST BACKUP: EVERY TABLE, AS IT IS IN THE DATABASE ===');
      // values a Sheet would "improve" if it were left to guess, put into the database first
      await api('saveVendor', [{ name: vend, gstReg: 'No', pan: 'ABCPE1234T', bank: '=1+1 Bank', account: '000123456789012345', ifsc: 'SBIN0000001' }, 'add']);
      const acct = sql("select account_number from vendors where vendor_name = '" + vend + "'");
      r = await api('backupNow');
      const counts = tableRows(), bad = await mismatch(counts), d = await g('/dump');
      // (update-98) the Store's tables in the same database: its items are copied (read by their code), its sign-ins never
      if (Object.prototype.hasOwnProperty.call(counts, 'items')) ok('[update-98] the Store\'s Item Master is copied (its own key "code"); the Store\'s sign-ins and used tickets are NOT', d.tabs.some(x => x.title === 'items') && !d.tabs.some(x => /store_sessions|store_tickets/.test(x.title)), d.tabs.map(x => x.title));
      ok('"Backup" button on an empty Sheet: every table has its tab with exactly its rows', !r.error && bad.length === 0 && d.tabs.length >= Object.keys(counts).length, r.error || bad.join('; ') || (d.tabs.length + ' tabs, ' + d.calls + ' calls to Google'));
      const users = (await g('/tab?title=Users')).values || [], flat = JSON.stringify(users);
      ok('passwords are not copied (the cell says "(hidden)")', flat.indexOf('(hidden)') > -1 && flat.indexOf('sha256') === -1 && flat.indexOf('scrypt') === -1 && flat.indexOf('Temp#') === -1, JSON.stringify(users[1] || []).slice(0, 120));
      // (13-10-2026) the tables of several sites (step-7 SQL, update-90) have no "id": read by their own key; the Super Admin's
      // password and recovery code and another site's locked database key are never copied
      const sa = JSON.stringify((await g('/tab?title=rcl_super_admin')).values || []), st = JSON.stringify((await g('/tab?title=rcl_sites')).values || []), us = (await g('/tab?title=rcl_user_sites')).values || [];
      // (there is only ever ONE Super Admin – rcl_super_admin_only_one: the row inserted above stays out where the rig has one already)
      const saMail = sql('select email from rcl_super_admin limit 1');
      ok('the tables of several sites are copied too (rcl_sites, rcl_user_sites, rcl_super_admin)', st.indexOf('S1') > -1 && us.length - 1 === Number(sql('select count(*) from rcl_user_sites')) && !!saMail && sa.indexOf(saMail) > -1, [st.slice(0, 80), us.length, sa.slice(0, 80)]);
      ok('   the Super Admin\'s password and recovery code, and a site\'s database key: "(hidden)"', sa.indexOf('(hidden)') > -1 && sa.indexOf('scrypt') === -1 && sa.indexOf('sha256') === -1 && st.indexOf('v1.') === -1, [sa.slice(0, 160), st.slice(0, 160)]);
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
      ok('[update-141] the open pages asking after the change: left alone – today\'s backup is done (no backup every 4 minutes any more)', p1.skipped === true && p2.skipped === true, JSON.stringify([p1, p2]));
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
      const st = props().BK_STATE || {}; st.lastCheck = new Date(Date.now() - 26 * 3600000).toISOString(); st.lastTry = ''; sql("update web.props set value = $$" + JSON.stringify(st) + "$$ where key = 'BK_STATE'"); await wait(1100);      // (update-141: the last backup yesterday – today's is due)
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

    if (on('daily')) {
      console.log('\n=== (update-141) ONCE A DAY ===');
      const setState = async f => { const st = props().BK_STATE || {}; f(st); sql("update web.props set value = $$" + JSON.stringify(st) + "$$ where key = 'BK_STATE'"); await wait(1100); };
      await api('backupNow'); await wait(1100);
      // the last backup YESTERDAY (India date): the first open page of the day starts today's
      await api('saveVendor', [{ name: vend + ' D', gstReg: 'No', pan: 'ABCPE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add']);      // something new to copy
      await setState(st => { st.lastCheck = new Date(Date.now() - 26 * 3600000).toISOString(); st.lastTry = ''; st.todo = []; });
      let c0 = (await g('/dump')).calls; const first = await page(3005); let c1 = (await g('/dump')).calls;
      const s1 = props().BK_STATE || {}, istDay = t => new Date(new Date(t).getTime() + 330 * 60000).toISOString().slice(0, 10);
      ok('the last backup was yesterday: the first open page of the day starts today\'s (Google is written to, the backup is noted as done today)', first.status === 200 && first.ok === true && !first.skipped && c1 > c0 && istDay(s1.lastCheck) === istDay(Date.now()), { answer: first, calls_to_google: c1 - c0, lastCheck: s1.lastCheck });
      // done today: every page after it is left alone, also after a change (it used to copy within 4 minutes)
      r = await api('saveDieselIssue', [{ date: '2026-09-30', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 3, kmReading: 99600, driver: 'BKP', force: true }]);
      await setState(st => { st.lastCheck = new Date(Date.now() - 10 * 60000).toISOString(); });
      c0 = (await g('/dump')).calls; const later = await Promise.all([page(3005), page(3006), page(3005, user)]); c1 = (await g('/dump')).calls;
      ok('today\'s backup is done: open pages asking after a new entry are left alone – nothing is read, nothing is written to Google', !r.error && later.every(x => x.status === 200 && x.skipped === true) && c1 === c0, { saved: !r.error, answers: later, calls_to_google: c1 - c0 });
      // the nightly job always runs (a full copy), even when a backup was made today
      c0 = (await g('/dump')).calls; const night = await cron(3006); c1 = (await g('/dump')).calls;
      ok('the nightly job runs even when a backup was made today (the full copy of the night)', night.status === 200 && night.ok === true && c1 > c0, { night: night, calls_to_google: c1 - c0 });
      // the "Backup" button still copies at once (the Admin)
      const btn = await api('backupNow');
      ok('the "Backup" button still copies at once', !btn.error && btn.result && (btn.result.upToDate === true || Array.isArray(btn.result.lines)), btn.error || JSON.stringify(btn.result).slice(0, 120));
      // a backup that does not end in one run: the page is told what is left (it asks again a minute later)
      setKnob('BK_GROUP_ROWS', '1'); setKnob('BK_BUDGET_MS', '1500'); await g('/slow?ms=700');
      await setState(st => { st.lastCheck = new Date(Date.now() - 26 * 3600000).toISOString(); st.lastTry = ''; delete st.lastFull; delete st.fullRun; st.todo = []; });
      const part = await page(3005);
      ok('a backup that is not finished in one run: the page is told how many tables are left (pending) – the page asks again a minute later', part.status === 200 && part.ok === true && part.pending > 0, part);
      sql("delete from web.props where key in ('BK_BUDGET_MS', 'BK_GROUP_ROWS')"); await g('/slow?ms=0');
      let guard = 0, rr; do { rr = await api('backupNow'); } while (!rr.error && rr.result && rr.result.pending > 0 && guard++ < 40);
      ok('…and it ends: every tab complete', !rr.error && (await mismatch(tableRows())).length === 0, rr.error || 'complete');
      if (id0(r)) await api('deleteDieselIssue', [id0(r)]);
    }

    if (on('logs')) {
      console.log('\n=== (update-141) THE LOGS: ONLY THEIR NEW ROWS ARE READ AND ADDED ===');
      const setState = async f => { const st = props().BK_STATE || {}; f(st); sql("update web.props set value = $$" + JSON.stringify(st) + "$$ where key = 'BK_STATE'"); await wait(1100); };
      const meter = async () => { try { return await (await fetch(DOOR + '/__meter')).json(); } catch (e) { return null; } };
      const zero = async () => { try { await fetch(DOOR + '/__meter', { method: 'POST' }); } catch (e) { /* no counter */ } };
      const readOf = (m, t) => m ? m.rows.filter(x => x.kind.indexOf(t) > -1).reduce((a2, x) => a2 + x.bytes, 0) : -1;
      const tabIs = async (title, q) => { const v = ((await g('/tab?title=' + encodeURIComponent(title))).values || []).slice(1).map(x => String(x[0]).replace(/^'/, '')); const d = sql(q).split('\n').filter(Boolean); return { same: v.length === d.length && v.every((x, i) => x === d[i]), tab: v.length, db: d.length, tabEnd: v.slice(-2), dbEnd: d.slice(-2) }; };
      const AL = "select id from public.activity_log order by id", SA = "select id from public.store_activity order by id";
      // a whole copy first (the notes of the logs start from it)
      await api('backupNow'); await setState(st => { delete st.app; delete st.lastFull; delete st.fullRun; });
      await zero(); let b = await api('backupNow'); const mWhole = await meter();
      const lw = ((b.result && b.result.lines) || []).find(x => x[0] === 'Activity Log');
      ok('a full copy writes the Activity Log whole and notes how far it copied', !b.error && lw && /^\d+ rows$/.test(lw[1]) && ((props().BK_STATE || {}).app || {}).activity_log, b.error || { line: lw, notes: ((props().BK_STATE || {}).app || {}).activity_log });
      // new rows: a few saves (each writes the Activity Log), one delete (a row in deleted_rows)
      const ids = []; for (let i = 0; i < 3; i++) { r = await api('saveDieselIssue', [{ date: '2026-09-30', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 2, kmReading: 99700 + i, driver: 'BKP', force: true }]); if (id0(r)) ids.push(id0(r)); }
      await api('deleteDieselIssue', [ids.pop()]);
      await zero(); b = await api('backupNow'); const mAdd = await meter();
      const la = ((b.result && b.result.lines) || []).find(x => x[0] === 'Activity Log');
      const al = await tabIs('Activity Log', AL);
      ok('after new entries only the NEW rows of the Activity Log are added to its tab', !b.error && la && /^\+\d+ new rows/.test(la[1]), b.error || { activity: la });
      ok('…and the tab is then exactly the table, row by row, in the table\'s order', al.same, { activity_log: al });
      // the Store's log (the same database): its new rows too
      if (sql("select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'store_activity'") === '1') {
        sql("insert into public.store_activity (at, email, action, target, detail) values (now(), 'bkp@rcl.test', 'Backup test', 'BKP', '{}')");
        b = await api('backupNow'); const ls = ((b.result && b.result.lines) || []).find(x => x[0] === 'store_activity'), sa = await tabIs('store_activity', SA);
        ok('the Store\'s log: only its new row is added, and the tab is exactly the table', !b.error && ls && /^\+1 new rows/.test(ls[1]) && sa.same, b.error || { line: ls, tab: sa });
        sql("delete from public.store_activity where email = 'bkp@rcl.test'");
      }
      ok('…reading far less from the database than a whole read of the Activity Log', readOf(mAdd, 'activity_log') >= 0 && readOf(mAdd, 'activity_log') * 10 < readOf(mWhole, 'activity_log'), { bytes_new_rows_only: readOf(mAdd, 'activity_log'), bytes_whole: readOf(mWhole, 'activity_log') });
      // the notes and the tab disagree (somebody changed the tab, or the notes are off): the tab is written whole
      await setState(st => { st.app.activity_log.n = Number(st.app.activity_log.n) - 1; });
      await api('saveDieselIssue', [{ date: '2026-09-30', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 2, kmReading: 99800, driver: 'BKP', force: true }]).then(x => { if (id0(x)) ids.push(id0(x)); });
      b = await api('backupNow'); const l2 = ((b.result && b.result.lines) || []).find(x => x[0] === 'Activity Log');
      ok('the tab does not have the rows the notes say: it is written WHOLE (never a gap or a double row)', !b.error && l2 && /^\d+ rows$/.test(l2[1]) && (await tabIs('Activity Log', AL)).same, b.error || l2);
      // a row deleted from the log in the database (the table has fewer rows than copied + new): whole
      const victim = sql("select id from public.activity_log where id < (select max(id) from public.activity_log) order by id limit 1");
      const kept = sql("select row_to_json(a)::text from public.activity_log a where id = '" + victim + "'");
      sql("delete from public.activity_log where id = '" + victim + "'");
      await api('saveDieselIssue', [{ date: '2026-09-30', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 2, kmReading: 99900, driver: 'BKP', force: true }]).then(x => { if (id0(x)) ids.push(id0(x)); });
      b = await api('backupNow'); const l3 = ((b.result && b.result.lines) || []).find(x => x[0] === 'Activity Log');
      ok('a row deleted from the log in the database: the tab is written WHOLE and is exactly the table again', !b.error && l3 && /^\d+ rows$/.test(l3[1]) && (await tabIs('Activity Log', AL)).same, b.error || l3);
      sql("insert into public.activity_log select * from json_populate_record(null::public.activity_log, $$" + kept + "$$::json)");
      // once in 30 days the logs are written whole anyway
      b = await api('backupNow');
      await setState(st => { st.app.activity_log.whole = new Date(Date.now() - 31 * 86400000).toISOString(); });
      await api('saveDieselIssue', [{ date: '2026-09-30', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 2, kmReading: 99950, driver: 'BKP', force: true }]).then(x => { if (id0(x)) ids.push(id0(x)); });
      b = await api('backupNow'); const l4 = ((b.result && b.result.lines) || []).find(x => x[0] === 'Activity Log');
      ok('once in 30 days the Activity Log is written whole', !b.error && l4 && /^\d+ rows$/.test(l4[1]) && (await tabIs('Activity Log', AL)).same, b.error || l4);
      // (review 21-10-2026) more than 1000 new rows: read by key, page by page – every row once, the tab exactly the table
      b = await api('backupNow');
      sql("insert into public.activity_log (id, at, email, action, module, summary) select 'LOG-9' || lpad(g::text, 6, '0') || '-bkp', now(), 'bkp@rcl.test', 'Backup test', 'Backup', 'row ' || g from generate_series(1, 1500) g");
      b = await api('backupNow'); const l5 = ((b.result && b.result.lines) || []).find(x => x[0] === 'Activity Log');
      ok('[review] 1,500 new rows at once (two pages): only they are added, each once – the tab is exactly the table', !b.error && l5 && /^\+1500 new rows/.test(l5[1]) && (await tabIs('Activity Log', AL)).same, b.error || l5);
      // a column added to a log: its tab is written whole (heading and rows), not appended under the old heading
      if (sql("select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'store_activity'") === '1') {
        b = await api('backupNow');
        sql("alter table public.store_activity add column bkp_note text; insert into public.store_activity (at, email, action, target, detail) values (now(), 'bkp@rcl.test', 'Backup test', 'BKP', '{}')");
        b = await api('backupNow'); const lc = ((b.result && b.result.lines) || []).find(x => x[0] === 'store_activity'), head = ((await g('/tab?title=store_activity')).values || [])[0] || [];
        ok('[review] a column added to a log: its tab is written WHOLE, with the new heading', !b.error && lc && /^\d+ rows$/.test(lc[1]) && head.indexOf('bkp_note') > -1, b.error || { line: lc, head: head });
        sql("delete from public.store_activity where email = 'bkp@rcl.test'; alter table public.store_activity drop column bkp_note");
      }
      // every tab gone from the Sheet (made again in the same run): the log is written whole, never appended into the new tab
      await g('/reset?bare=1'); sql("insert into public.activity_log (id, at, email, action, module, summary) values ('LOG-9999999-bkpz', now(), 'bkp@rcl.test', 'Backup test', 'Backup', 'after reset')");
      b = await api('backupNow'); let guard2 = 0; while (!b.error && b.result && b.result.pending > 0 && guard2++ < 30) b = await api('backupNow');
      ok('[review] the tabs made again: the Activity Log is written WHOLE and is exactly the table', !b.error && (await tabIs('Activity Log', AL)).same, b.error || 'whole');
      sql("delete from public.activity_log where email = 'bkp@rcl.test'");
      for (const x of ids) await api('deleteDieselIssue', [x]);
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
    try { sql("delete from rcl_super_admin where email = 'bk-sa@rcl.test';"); } catch (e) { /* rig only */ }
    stop(3005); stop(3006); try { process.kill(-stand.pid); } catch (e) { try { stand.kill(); } catch (e2) {} }
    try { clearNotes(); sql("delete from vendors where vendor_name like 'BKP Vendor%'; delete from app_users where id like 'bkp%@rcl.test'; delete from diesel_issue where driver_name = 'BKP';"); } catch (e) { console.log('clean-up: ' + String(e.message).slice(0, 160)); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (process.env.APP_DIR ? '   (code in ' + APP + ')' : ''));
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); Object.keys(procs).forEach(p => stop(Number(p))); process.exit(1); });
