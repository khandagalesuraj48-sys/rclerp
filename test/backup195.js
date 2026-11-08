/* update-195 – PURCHASE'S OWN BACKUP SHEETS (asked 30-10-2026: "ya modual la google sheet asign kruya"; his choice: Purchase's own
 * Sheet – every site's Purchase data in one Sheet, like the Portal's backup), on the local test rig against the Sheets stand-in
 * (test/sheets-standin.js). Nothing here touches a live database or a real Google Sheet.
 * Before: the rig in Portal mode with the Portal (PORTAL_DIR) and Purchase (PUR_DIR) trees, Purchase's own api test run first (its
 * people and activity rows of S1 and T2). This test starts its own Mechanical servers (3005, 3006) with the backup on, and the Portal
 * (:3010) and Purchase (:3050) again with the export secret; at the end the Portal and Purchase are started again as they were.
 *   APP_DIR=/home/claude/vercel PORTAL_DIR=… PUR_DIR=… timeout 600 node test/backup195.js */
'use strict';
const { execSync, spawn } = require('child_process'), path = require('path'), crypto = require('crypto'), fs = require('fs');
const APP = process.env.APP_DIR || path.join(__dirname, '..'), PDIR = process.env.PORTAL_DIR || '/home/claude/rcl-portal', UDIR = process.env.PUR_DIR || '/home/claude/rcl-purchase';
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const G = 'http://127.0.0.1:3997', g = async p => (await fetch(G + p)).json();
const SECRET = 'rig-backup-export-secret-0123456789abcdef', LEGACY = 'rigSheet0123456789abcdefghijklmn';
const IDS = { pur: 'rigPURCHASEsheet1abcdefghijkl', pur2: 'rigPURCHASEsheet2abcdefghijkl', portal: 'rigPORTALsheetabcdefghijklmn', t2: 'rigT2sheet1abcdefghijklmnopq' };
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const GOOGLE = { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'backup-robot@rig.test', private_key: key }), BACKUP_SHEET_ID: LEGACY, GOOGLE_SHEETS_URL: G, GOOGLE_TOKEN_URL: G + '/token', CRON_SECRET: 'local-cron-secret' };
const MECH_ENV = Object.assign({}, process.env, GOOGLE, { RCL_SITES_KEY: 'rig-sites-key-0123456789-abcdefghij', PORTAL_URL: 'http://127.0.0.1:3010', ENGINEERING_URL: 'http://127.0.0.1:3040', PURCHASE_URL: 'http://127.0.0.1:3050', BACKUP_EXPORT_SECRET: SECRET });
const PORTAL_ENV = { SUPABASE_URL: 'http://127.0.0.1:3106', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_SECRET: 'rig-portal-secret-0123456789abcdefghijklmnop', MECH_URL: 'http://127.0.0.1:3100', MECH_KEY: 'sb_secret_rigkey', MECH_APP_URL: 'http://127.0.0.1:3005', APP_STORE_URL: 'http://127.0.0.1:3100', APP_STORE_KEY: 'sb_secret_rigkey', PORT: '3010' };
const PUR_ENV = { SUPABASE_URL: 'http://127.0.0.1:3110', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_URL: 'http://127.0.0.1:3010', PORT: '3050' };
const KEYS = "('BK_PUR_SHEETS', 'BK_PUR_STATE', 'SB_PUR_INFO', 'BK_PORTAL_SHEETS', 'BK_PORTAL_STATE', 'SB_PORTAL_INFO', 'BK_SHEETS', 'BK_STATE', 'SB_INFO')";
const procs = [];
function killPort(port) {
  fs.readdirSync('/proc').filter(x => /^\d+$/.test(x)).forEach(p => { try {
    const env = fs.readFileSync('/proc/' + p + '/environ', 'utf8'), cmd = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8');
    if (/dev\.js/.test(cmd) && env.split('\0').indexOf('PORT=' + port) > -1) process.kill(Number(p)); } catch (e) { /* gone */ } });
  // (a rig server started by its script: node dev.js in that tree)
  const dir = port === 3010 ? PDIR : port === 3050 ? UDIR : '';
  if (dir) fs.readdirSync('/proc').filter(x => /^\d+$/.test(x)).forEach(p => { try { const cmd = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8');
    if (/^node\0dev\.js/.test(cmd) && fs.readlinkSync('/proc/' + p + '/cwd') === dir) process.kill(Number(p)); } catch (e) { /* gone */ } });
}
async function start(dir, env, port) {
  killPort(port); await wait(700);
  const c = spawn('node', ['dev.js'], { cwd: dir, env: Object.assign({}, process.env, env, { PORT: String(port) }), stdio: 'ignore', detached: true }); c.unref(); procs.push({ c, port });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/', { signal: AbortSignal.timeout(2000) })).status === 200) return; } catch (e) { /* starting */ } await wait(300); }
  throw new Error('server ' + port + ' did not start');
}
const cron = port => fetch('http://127.0.0.1:' + port + '/api/backup?full=1', { headers: { Authorization: 'Bearer local-cron-secret' }, signal: AbortSignal.timeout(120000) }).then(async x => Object.assign({ status: x.status }, await x.json()));
function portal() {
  let cookie = '';
  return async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch('http://127.0.0.1:3010' + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; cookie = /=$/.test(v) ? '' : v; }
    let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { j = {}; } return { status: r.status, j: j }; };
}
const exp = (body, auth) => fetch('http://127.0.0.1:3050/api/backup-export', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth === undefined ? { Authorization: 'Bearer ' + SECRET } : auth ? { Authorization: auth } : {}), body: JSON.stringify(body) }).then(async x => ({ status: x.status, j: await x.json().catch(() => ({})) }));
const tab = async (id, title) => (await g('/tab?id=' + id + '&title=' + encodeURIComponent(title))).values || null;
const dump = id => g('/dump?id=' + id);

(async () => {
  const stand = spawn('node', [path.join(__dirname, 'sheets-standin.js')], { stdio: 'ignore', detached: true });
  const keepMod = sql('rcl_portal', "select url from modules where key = 'mechanical'");
  try {
    for (let i = 0; i < 30; i++) { try { await g('/dump'); break; } catch (e) { await wait(200); } }
    await g('/reset?bare=1');
    for (const db of ['rcl', 'rcl_s2']) sql(db, 'delete from web.props where key in ' + KEYS + "; delete from web.locks where name like 'backup%';");
    sql('rcl', "update rcl_sites set sheet = null where code = 'T2'");
    // Purchase's rows of two sites (as its api test leaves them, and one row of T2 made here)
    sql('rcl_pur', "delete from pur_activity where action = 'B195 test'; insert into pur_activity (site, email, action, target) values ('T2', 'b195@rcl.test', 'B195 test', 'row of T2'), ('S1', 'b195@rcl.test', 'B195 test', 'row of S1');");
    const purPeople = Number(sql('rcl_pur', 'select count(*) from pur_people')), purAct = Number(sql('rcl_pur', 'select count(*) from pur_activity')), purSess = Number(sql('rcl_pur', 'select count(*) from pur_sessions'));
    ok('the rig: Purchase has people and activity rows (of more than one site)', purPeople > 0 && Number(sql('rcl_pur', 'select count(distinct site) from pur_activity')) >= 2, { purPeople, purAct });
    sql('rcl_portal', "update modules set url = 'http://127.0.0.1:3005' where key = 'mechanical'");
    await start(APP, MECH_ENV, 3005); await start(APP, MECH_ENV, 3006);
    await start(PDIR, Object.assign({}, PORTAL_ENV, { BACKUP_EXPORT_SECRET: SECRET }), 3010);
    await start(UDIR, Object.assign({}, PUR_ENV, { BACKUP_EXPORT_SECRET: SECRET }), 3050);

    // ---- Purchase's export door ----
    let e = await exp({ action: 'catalog' }, false);
    ok('Purchase\'s backup export: without the secret – refused (401)', e.status === 401, e);
    e = await exp({ action: 'catalog' }, 'Bearer wrong-secret-wrong-secret-wrong');
    ok('   a wrong secret – refused (401)', e.status === 401, e);
    e = await exp({ action: 'catalog' });
    const names = (e.j.tables || []).map(t => t.name);
    ok('   with it: people, settings, numbers, activity – never the sign-ins or the used tickets', e.status === 200 && JSON.stringify(names) === '["pur_people","pur_settings","pur_numbers","pur_activity"]', e.j);
    e = await exp({ action: 'rows', table: 'pur_sessions', offset: 0 });
    ok('   the sign-ins: refused (not a table of the backup)', e.status === 400, e);
    e = await exp({ action: 'rows', table: 'pur_activity', offset: 0, limit: 1000 });
    ok('   every site\'s rows (each with its site)', e.status === 200 && e.j.rows.length === purAct && e.j.rows.some(r => r.site === 'T2') && e.j.rows.some(r => r.site === 'S1'), { n: (e.j.rows || []).length, want: purAct });

    // ---- the nightly job before any Sheet: every site, the Portal and Purchase – Purchase (no Sheet) is left out ----
    let n0 = await cron(3005);
    ok('the nightly job: every ready site, the Portal and Purchase (4 backups) – Purchase without a Sheet is "off", nothing fails', n0.status === 200 && n0.ok === true && n0.sites === 4, n0);
    ok('   nothing written for Purchase', !(await g('/books')).some(b => /PURCHASE/.test(b.id)));

    // ---- the Super Admin in the Portal: Sites → Purchase backup ----
    const P = portal(); let SAPW = 'Super#Admin2040', r = await P('/api/auth', { action: 'login', email: 'sa@rcl.test', password: SAPW });
    if (r.status !== 200) { SAPW = 'Super#Admin2041'; r = await P('/api/auth', { action: 'login', email: 'sa@rcl.test', password: SAPW }); }      // (the rig's Super Admin password, as another test may have left it)
    ok('the Super Admin signs in to the Portal', r.status === 200, r.j);
    r = await P('/api/admin', { action: 'bkGet', target: 'purchase' });
    ok('Purchase backup: no Sheet yet; the robot\'s address to share with', r.status === 200 && r.j.target === 'purchase' && r.j.sheets.length === 0 && r.j.email === 'backup-robot@rig.test', r.j);
    r = await P('/api/admin', { action: 'bkSet', target: 'purchase', mode: 'change', link: 'https://docs.google.com/spreadsheets/d/' + LEGACY + '/edit' });
    ok('   the first site\'s Sheet: refused – Purchase needs its own Sheet', r.status >= 400 && /already the backup Sheet of another site/.test(r.j.error || ''), r.j);
    r = await P('/api/admin', { action: 'bkSet', target: 'portal', mode: 'change', link: IDS.portal });
    ok('   (the Portal is given its own Sheet 1)', r.status === 200 && r.j.target === 'portal' && r.j.sheets.length === 1, r.j);
    r = await P('/api/admin', { action: 'bkSet', target: 'purchase', mode: 'change', link: IDS.portal });
    ok('   the Portal\'s Sheet: refused', r.status >= 400 && /already the backup Sheet of another site \(or of the Portal, or of Purchase\)/.test(r.j.error || ''), r.j);
    await g('/deny?id=' + IDS.pur);
    r = await P('/api/admin', { action: 'bkSet', target: 'purchase', mode: 'change', link: IDS.pur });
    ok('   a Sheet not shared with the robot: refused, and told to share it as Editor', r.status >= 400 && /share it with backup-robot@rig\.test as Editor/.test(r.j.error || ''), r.j);
    await g('/deny?id=');
    const aud0 = Number(sql('rcl_portal', "select count(*) from audit where action = 'Backup Sheet changed' and target = 'Purchase'"));
    r = await P('/api/admin', { action: 'bkSet', target: 'purchase', mode: 'change', link: 'https://docs.google.com/spreadsheets/d/' + IDS.pur + '/edit#gid=0' });
    ok('   its own new Sheet: Sheet 1 of Purchase', r.status === 200 && r.j.target === 'purchase' && r.j.sheets.length === 1 && r.j.sheets[0].n === 1 && /rigPURCHASEsheet1/.test(r.j.sheets[0].url), r.j);
    ok('   written in the Portal\'s record ("Purchase") and in the first site\'s Activity Log', Number(sql('rcl_portal', "select count(*) from audit where action = 'Backup Sheet changed' and target = 'Purchase'")) === aud0 + 1 &&
      Number(sql('rcl', "select count(*) from activity_log where summary like '%Backup Sheet 1 link changed (Purchase)%'")) >= 1);
    ok('   kept at the first site only (BK_PUR_SHEETS), not at 18B', sql('rcl', "select count(*) from web.props where key = 'BK_PUR_SHEETS'") === '1' && sql('rcl_s2', "select count(*) from web.props where key = 'BK_PUR_SHEETS'") === '0');
    r = await P('/api/admin', { action: 'bkSet', site: 'T2', mode: 'change', link: IDS.pur });
    ok('Purchase\'s Sheet given to a site (T2): refused', r.status >= 400 && /already the backup Sheet of another site/.test(r.j.error || ''), r.j);
    r = await P('/api/admin', { action: 'bkSet', target: 'portal', mode: 'change', link: IDS.pur });
    ok('Purchase\'s Sheet given to the Portal: refused', r.status >= 400 && /already the backup Sheet of another site/.test(r.j.error || ''), r.j);

    // ---- "Backup now": Purchase's rows of every site into its Sheet ----
    let now = await P('/api/admin', { action: 'bkNow', target: 'purchase' });
    for (let i = 0; i < 10 && now.j.last && now.j.last.pending; i++) now = await P('/api/admin', { action: 'bkNow', target: 'purchase' });
    const tabs = (await dump(IDS.pur)).tabs.map(t => t.title);
    ok('"Backup now": the tabs "Purchase – People / Settings / Numbers / Activity" and the status – no sign-ins, nothing of a site\'s own tables', now.status === 200 && !now.j.runError &&
      ['Purchase – People', 'Purchase – Settings', 'Purchase – Numbers', 'Purchase – Activity', 'Backup Status'].every(t => tabs.indexOf(t) > -1) && !tabs.some(t => /session|ticket|Master|Log Book|Engineering|Portal –/i.test(t)), { tabs: tabs, err: now.j.runError });
    const act = await tab(IDS.pur, 'Purchase – Activity'), sc = act ? act[0].indexOf('site') : -1;
    ok('   Purchase – Activity: every row of every site, each with its site', act && act.length - 1 === purAct && act.slice(1).some(x => x[sc] === "'T2") && act.slice(1).some(x => x[sc] === "'S1"), { rows: act && act.length - 1, want: purAct });
    const ppl = await tab(IDS.pur, 'Purchase – People');
    ok('   Purchase – People: every person of every site; only the listed columns', ppl && ppl.length - 1 === purPeople && JSON.stringify(ppl[0]) === '["site","email","name","role","first_seen","last_seen"]', ppl && ppl[0]);
    const st = await tab(IDS.pur, 'Backup Status');
    ok('   the status tab: "RCL ERP Purchase – copy of the Purchase database", Sheet 1, everything from the first day', st && /RCL ERP Purchase – copy of the Purchase database/.test(st[0][0]) && st.some(x => x[0] === 'Backup of' && /Purchase – every site/.test(x[1])) && st.some(x => x[0] === 'This Sheet' && /Sheet 1/.test(x[1])) && st.some(x => x[0] === 'It holds' && /everything, from the first day/.test(x[1])), st && st.slice(0, 5));
    ok('   the sign-ins stay in Purchase (none of their rows anywhere in the Sheet)', purSess === 0 || !JSON.stringify((await dump(IDS.pur)).tabs).includes('id_hash'));
    r = await P('/api/admin', { action: 'bkGet', target: 'purchase' });
    ok('Purchase backup: Sheet 1 in use, its last backup, how full it is', r.status === 200 && r.j.sheets.length === 1 && r.j.sheets[0].active && r.j.sheets[0].cells > 0 && r.j.last.ok !== false && !!r.j.last.lastRun, r.j);

    // ---- the nightly job: a new row of Purchase goes in; Sheet 2 holds what is new ----
    sql('rcl_pur', "insert into pur_activity (site, email, action, target) values ('S1', 'b195@rcl.test', 'B195 test', 'row of the night')");
    const n1 = await cron(3006);
    const act2 = await tab(IDS.pur, 'Purchase – Activity');
    ok('the nightly job: Purchase\'s new row is in its Sheet', n1.status === 200 && n1.ok === true && act2 && act2.length - 1 === purAct + 1 && act2.slice(1).some(x => x.indexOf("'row of the night") > -1), { n1: n1, rows: act2 && act2.length - 1 });
    r = await P('/api/admin', { action: 'bkSet', target: 'purchase', mode: 'add', link: IDS.pur2 });
    ok('Add Sheet 2 of Purchase: Sheet 1 kept as it is, Sheet 2 in use', r.status === 200 && r.j.sheets.length === 2 && !r.j.sheets[0].active && r.j.sheets[1].active && r.j.sheets[1].n === 2, r.j);
    now = await P('/api/admin', { action: 'bkNow', target: 'purchase' });
    const st2 = await tab(IDS.pur2, 'Backup Status'), ppl2 = await tab(IDS.pur2, 'Purchase – Numbers');
    ok('   Sheet 2: its status says what it holds (new or changed since …, with Sheet 1 the whole data)', now.status === 200 && st2 && st2.some(x => x[0] === 'This Sheet' && /Sheet 2 of 2/.test(x[1])) && st2.some(x => x[0] === 'It holds' && /together with Sheet 1/.test(x[1])) && !!ppl2, st2 && st2.slice(0, 5));

    // ---- the real page of the Portal: Sites → Purchase backup ----
    try {
      const M = '/home/claude/test/node_modules/';
      const chromium = require(M + '@sparticuz/chromium').default || require(M + '@sparticuz/chromium'), puppeteer = require(M + 'puppeteer-core');
      const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
      try {
        const pg = await b.newPage(), errs = []; pg.on('pageerror', x => errs.push(String(x.message).slice(0, 200))); await pg.setViewport({ width: 1366, height: 900 });
        await pg.goto('http://127.0.0.1:3010/', { waitUntil: 'networkidle0' }); await pg.waitForSelector('#l_email', { visible: true });
        await pg.type('#l_email', 'sa@rcl.test'); await pg.type('#l_pass', SAPW); await pg.click('#l_btn');
        await pg.waitForSelector('#sa_tabs button[data-t="sites"]', { visible: true, timeout: 20000 }); await pg.click('#sa_tabs button[data-t="sites"]'); await pg.waitForSelector('#t_sites:not([hidden])');
        const btns = await pg.$eval('#st_pbk', x => [...x.parentElement.querySelectorAll('button')].map(y => y.textContent.trim()));
        ok('the Portal page: Sites – "Storage", "Portal backup", "Purchase backup", "New site"', JSON.stringify(btns) === '["Storage","Portal backup","Purchase backup","New site"]', btns);
        await pg.click('#st_purbk');
        await pg.waitForFunction(() => /Purchase backup/.test((document.getElementById('bk_panel') || {}).innerText || '') && !!document.querySelector('#bk_panel table'), { timeout: 30000 });
        const txt = await pg.$eval('#bk_panel', x => x.innerText);
        if (process.env.SHOT_DIR) await pg.screenshot({ path: path.join(process.env.SHOT_DIR, 'bk195-purchase-backup.png'), fullPage: true });
        ok('   Purchase backup: what it holds (every site), Sheet 1 kept, Sheet 2 in use, the robot to share with, the buttons', /Purchase of every site/.test(txt) && /Sheet 1/.test(txt) && /Sheet 2/.test(txt) && /In use/.test(txt) && /Kept as it is/.test(txt) && /backup-robot@rig\.test/.test(txt) && /Change link of Sheet 2/.test(txt) && /Add Sheet 3/.test(txt) && /Backup now/.test(txt), txt.slice(0, 600));
        await pg.click('#bk_close'); await pg.click('#st_pbk'); await pg.waitForFunction(() => /Portal backup/.test((document.getElementById('bk_panel') || {}).innerText || '') && !!document.querySelector('#bk_panel table'), { timeout: 30000 });
        ok('   Portal backup: still its own Sheet 1', /Sheet 1/.test(await pg.$eval('#bk_panel', x => x.innerText)) && !/Purchase of every site/.test(await pg.$eval('#bk_panel', x => x.innerText)));
        ok('   no script error on the page', !errs.length, errs);
      } finally { await b.close(); }
    } catch (e2) { ok('the Portal page (browser)', false, String((e2 && e2.stack) || e2).slice(0, 400)); }
  } catch (err) { ok('no crash', false, String((err && err.stack) || err)); }
  finally {
    try { sql('rcl_portal', "update modules set url = '" + keepMod + "' where key = 'mechanical'"); } catch (e) { /* as it was */ }
    try { sql('rcl_pur', "delete from pur_activity where action = 'B195 test'"); } catch (e) { /* the rig's test rows */ }
    for (const db of ['rcl', 'rcl_s2']) { try { sql(db, 'delete from web.props where key in ' + KEYS); } catch (e) { /* the rig */ } }
    procs.forEach(p => { try { process.kill(-p.c.pid); } catch (e) { try { p.c.kill(); } catch (e2) { /* gone */ } } });
    try { process.kill(-stand.pid); } catch (e) { try { stand.kill(); } catch (e2) { /* gone */ } }
    // the Portal and Purchase as the rig had them (without the export secret)
    try { await start(PDIR, Object.assign({}, PORTAL_ENV, { MECH_APP_URL: 'http://127.0.0.1:3000' }), 3010); await start(UDIR, PUR_ENV, 3050); } catch (e) { out.push('restart: ' + String(e.message)); }
  }
  out.forEach(x => console.log(x)); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
