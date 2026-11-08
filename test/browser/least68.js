// update-68 in a real (headless) browser on the test rig: users with LITTLE access still work – no page breaks because a
// list or a detail is no longer sent (D4); the backup pill for a user who is not the Admin (D5); the Access report (D3).
//      node least68.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const BASE = 'http://127.0.0.1:3000';
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA -q"', { input: q, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 520) : '')); };
const raw = async body => { const r = await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) }); return r.json(); };
const MODULES = ['Dashboard', 'Vendor Master', 'Master', 'Vendor BOQ', 'Vehicle Compliance', 'Breakdown', 'Diesel Inward', 'Diesel Transfer', 'Diesel Issue', 'Log Book', 'Machinery Billing', 'Saved Bills', 'Bill Summary', 'Machinery Payments', 'Vendor Ledger', 'Vendor Outstanding', 'Reports'];
const TAG = 'l68' + Date.now().toString(36);
const cleanUp = () => { try { sql("delete from activity_log where email like 'l68%@rcl.test'; delete from app_users where id like 'l68%@rcl.test'; delete from diesel_issue where driver_name = 'L68 driver'; delete from web.cache where key like 'LG\\_%';"); } catch (e) {} };
(async () => {
  cleanUp();
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const today = sql("select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')");
  await raw({ fn: 'api', args: [admin, 'saveDieselIssue', [{ date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: 'L68 driver', qty: 1, kmReading: 99970 + Math.floor(Math.random() * 9), force: true }]] });
  const mk = async (name, perms) => { const email = TAG + name + '@rcl.test', p = {}; MODULES.forEach(m => { p[m] = perms[m] || 'None'; });
    const a = await raw({ fn: 'api', args: [admin, 'saveUserAdmin', [{ email, name: 'L68 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]] }); if (a.error) throw new Error(a.error);
    const l = await raw({ fn: 'login', args: [email, 'Temp#' + name + '1'] }), pw = 'Own#' + name + '2468'; const c = await raw({ fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] }); if (c.error) throw new Error(c.error); return { email, pw }; };
  const U = { none: await mk('none', {}), diesel: await mk('dsl', { 'Diesel Issue': 'Edit' }), logbill: await mk('lb', { 'Log Book': 'Edit', 'Machinery Billing': 'View', 'Saved Bills': 'View' }),
    report: await mk('rpt', { 'Reports': 'View', 'Dashboard': 'View' }), inward: await mk('inw', { 'Diesel Inward': 'Edit', 'Diesel Transfer': 'Edit' }) };
  sql("delete from web.cache where key like 'LG\\_%'");

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const session = async (email, pw) => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [], calls = [];
    p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 160)); });
    p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|Failed to load resource|public key credentia/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
    p.on('request', q => { if (/\/api\/rpc/.test(q.url())) { try { const j = JSON.parse(q.postData() || '{}'); calls.push(j.fn === 'api' ? j.args[1] : j.fn); } catch (e) {} } });
    await p.setViewport({ width: 1536, height: 900 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(em => { try { localStorage.setItem('oc_brief_' + em, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', pw); await f.click('#lg_btn'); await wait(6000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    // every page the user can see is opened once
    const tabs = await f.evaluate(() => TABS.filter(t => { const el = document.getElementById('tab-' + t); return el && !el.closest('[hidden]') && t !== 'settings'; }));
    for (const t of tabs) { await f.evaluate(t2 => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab(t2); }, t); await wait(700); }
    await wait(800);
    const st = await f.evaluate(() => ({ signedIn: document.getElementById('login_screen').hidden, machines: (S.master || []).length, pick: document.querySelectorAll('#dl_machines option').length,
      drivers: document.querySelectorAll('#dl_drivers option').length, pumps: document.querySelectorAll('#dl_pumps option').length, parties: (S.parties || []).length,
      stock: S.stock ? typeof S.stock.stock : String(S.stock), rateKeys: (S.master || []).filter(m => 'monthlyRate' in m || 'tdsRate' in m).length, engineKeys: (S.master || []).filter(m => 'engineNo' in m || 'taxUpto' in m).length,
      pill: (document.getElementById('d_pill') || {}).textContent || '',
      // (the rig's servers have no backup set up: the pill is given a "backup is fine" state as the server would send it)
      bk: (() => { setBackupInfo({ ok: true, lastCheck: new Date().toISOString(), lastRun: new Date().toISOString() }); const el = document.getElementById('bk_btn'); return { hidden: el.hidden, title: el.title }; })() }));
    return { ctx, p, f, errs, calls, tabs, st }; };

  // ---------- the user with NO page ----------
  let s = await session(U.none.email, U.none.pw);
  ok('NO-ACCESS user: signs in, the app shows no page and does not break (no script error); the machinery list is there, without rate / engine details; no drivers, pumps, vendor names, stock; the stock is not even asked for',
    s.st.signedIn && s.errs.length === 0 && s.tabs.length === 0 && s.st.machines > 0 && s.st.rateKeys === 0 && s.st.engineKeys === 0 && s.st.drivers === 0 && s.st.pumps === 0 && s.st.parties === 0 && s.calls.indexOf('getStock') === -1,
    { pages: s.tabs.length, errors: s.errs.slice(0, 2), machinery: s.st.machines, drivers: s.st.drivers, pumps: s.st.pumps, vendors: s.st.parties, stock: s.st.stock, asked_getStock: s.calls.indexOf('getStock') > -1 });
  // the backup pill for a user who is not the Admin: shows the state, a click starts nothing
  const before = s.calls.length; await s.f.evaluate(() => document.getElementById('bk_btn').click()); await wait(1200);
  const toast = await s.f.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map(x => x.textContent).join(' | '));
  ok('[fix] the backup pill for a user who is not the Admin: it still shows that the backup is all right, its hint no longer says "click to copy now", and a click asks the server for nothing', !s.st.bk.hidden && !/Click to check again/.test(s.st.bk.title) && s.calls.slice(before).indexOf('backupNow') === -1 && /Only Admin/.test(toast), { title: s.st.bk.title.slice(0, 90), calls_after_click: s.calls.slice(before), told: toast.slice(0, 80) });
  await s.ctx.close();

  // ---------- Diesel Issue only ----------
  s = await session(U.diesel.email, U.diesel.pw);
  await s.f.evaluate(() => { showTab('diesel'); }); await wait(900);
  const d = await s.f.evaluate(() => { const no = document.getElementById('d_no'); no.value = 'MH-15-AB-0002'; no.dispatchEvent(new Event('input', { bubbles: true })); no.dispatchEvent(new Event('change', { bubbles: true })); return true; }); await wait(1500);
  const dInfo = await s.f.evaluate(() => ({ unit: (document.getElementById('d_unit') || {}).textContent || (document.getElementById('d_info') || {}).textContent || '', pill: (document.getElementById('d_pill') || {}).title || '' }));
  ok('DIESEL-ISSUE-ONLY user: his pages open without a script error; machinery pick-list, driver names and the stock are there (his page uses them); pump names, vendor names, rate and engine details are not sent',
    s.errs.length === 0 && s.tabs.length >= 1 && s.tabs.indexOf('diesel') > -1 && s.st.pick > 0 && s.st.drivers > 0 && s.st.stock === 'number' && s.st.pumps === 0 && s.st.parties === 0 && s.st.rateKeys === 0 && s.st.engineKeys === 0 && d,
    { pages: s.tabs, errors: s.errs.slice(0, 2), pick: s.st.pick, drivers: s.st.drivers, stock: s.st.stock, pumps: s.st.pumps, vendors: s.st.parties, stock_hint: dInfo.pill.slice(0, 60) });
  await s.ctx.close();

  // ---------- Log Book + Billing ----------
  s = await session(U.logbill.email, U.logbill.pw);
  ok('LOG BOOK + BILLING user: Log Book, Edit Log Book, Tank check, Machinery Billing, Saved Bills open without a script error; rate and TDS % are sent (their pages use them), vendor names for "Debit to"; engine / paper details and the stock are not',
    s.errs.length === 0 && ['log', 'logedit', 'bill', 'bills'].every(t => s.tabs.indexOf(t) > -1) && s.st.rateKeys === s.st.machines && s.st.engineKeys === 0 && s.st.parties > 0 && s.st.stock !== 'number' && s.calls.indexOf('getStock') === -1,
    { pages: s.tabs, errors: s.errs.slice(0, 2), with_rate: s.st.rateKeys + ' of ' + s.st.machines, with_engine: s.st.engineKeys, vendors: s.st.parties, stock: s.st.stock });
  await s.ctx.close();

  // ---------- Reports + Dashboard ----------
  s = await session(U.report.email, U.report.pw);
  ok('REPORTS + DASHBOARD user: the Dashboard and every report page open without a script error; pump names (report filter) and stock are there; rate / engine details, drivers and vendor names are not',
    s.errs.length === 0 && s.tabs.indexOf('dash') > -1 && s.tabs.filter(t => /^r/.test(t)).length >= 3 && s.st.pumps > 0 && s.st.stock === 'number' && s.st.rateKeys === 0 && s.st.engineKeys === 0 && s.st.drivers === 0 && s.st.parties === 0,
    { pages: s.tabs.length, errors: s.errs.slice(0, 2), pumps: s.st.pumps, stock: s.st.stock, drivers: s.st.drivers });
  await s.ctx.close();

  // ---------- Diesel Inward + Transfer ----------
  s = await session(U.inward.email, U.inward.pw);
  const pills = await s.f.evaluate(() => [...document.querySelectorAll('.stock_multi')].map(x => x.textContent.trim().length));
  ok('DIESEL INWARD + TRANSFER user: both pages open without a script error; pump names and the stock at each location are shown', s.errs.length === 0 && s.tabs.indexOf('inward') > -1 && s.tabs.indexOf('transfer') > -1 && s.st.pumps > 0 && s.st.stock === 'number' && pills.every(n => n > 0),
    { pages: s.tabs, errors: s.errs.slice(0, 2), pumps: s.st.pumps, stock_pills_chars: pills });
  await s.ctx.close();

  // ---------- the Admin: everything, the Access report, the backup by hand ----------
  s = await session('sujit@rcl.test', 'Nashik#Road848!');
  ok('ADMIN: every page opens without a script error, everything is sent as before (rate, engine details, drivers, pumps, stock)', s.errs.length === 0 && s.tabs.length > 20 && s.st.rateKeys === s.st.machines && s.st.engineKeys === s.st.machines && s.st.drivers > 0 && s.st.pumps > 0 && s.st.stock === 'number' && /Click to check again/.test(s.st.bk.title),
    { pages: s.tabs.length, errors: s.errs.slice(0, 2), with_rate: s.st.rateKeys, with_engine: s.st.engineKeys, drivers: s.st.drivers });
  await s.f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('users'); }); await wait(1500);
  await s.f.evaluate(() => { window.__csv = null; const mk = URL.createObjectURL; URL.createObjectURL = function (blob) { try { blob.text().then(t => { window.__csv = t; }); } catch (e) {} return mk.call(URL, blob); }; });
  await s.f.evaluate(() => document.getElementById('ua_report').click()); await wait(2500);
  const dlg = await s.f.evaluate(() => ({ open: !document.getElementById('cf_back').hidden, title: document.getElementById('cf_title').textContent, text: document.getElementById('cf_msg').textContent.slice(0, 400), ok: document.getElementById('cf_ok').textContent }));
  await s.f.evaluate(() => document.getElementById('cf_ok').click()); await wait(1500);
  const csv = await s.f.evaluate(() => window.__csv || '');
  const users = Number(sql("select count(*) from app_users")), lines = csv.split('\r\n');
  ok('ADMIN – "Access report" on Users & Access: a summary (written / empty / other text / Admin) and the full list as a file for Excel – one line per user and page: User, Page, Written, Access now, Why', dlg.open && dlg.title === 'Access report' && /EMPTY cell/.test(dlg.text) && /Save the full list/.test(dlg.ok) && lines.length === users * MODULES.length + 1 && /"Written in the Users table","Access the app gives now"/.test(lines[0]) && s.errs.length === 0,
    { dialog: dlg.text.slice(0, 150), file_lines: lines.length, expected: users * MODULES.length + 1, head: (lines[0] || '').slice(0, 110), a_line: (lines[1] || '').slice(0, 110), errors: s.errs.slice(0, 2) });
  // D10: the strict script rule is only WATCHED – something that would fall foul of it is not blocked, and the Admin gets a note
  const e0 = (await raw({ fn: 'api', args: [admin, 'getErrors', []] })).result.errors.filter(x => /Security policy/.test(x.msg)).length, c0 = s.calls.length;
  const ran = await s.f.evaluate(() => new Promise(res => { window.__ext = 0; const sc = document.createElement('script'); sc.src = 'data:text/javascript,window.__ext=1'; sc.onload = () => res('ran ' + window.__ext); sc.onerror = () => res('blocked'); document.head.appendChild(sc); setTimeout(() => res('no answer'), 4000); }));
  await wait(2500);
  const card = await s.f.evaluate(() => [...document.querySelectorAll('.fixcard, .fix-card')].map(x => x.textContent).join(' ').slice(0, 120));
  const errs2 = (await raw({ fn: 'api', args: [admin, 'getErrors', []] })).result.errors.filter(x => /Security policy/.test(x.msg));
  ok('D10 – the strict script rule is still only WATCHED: a script from outside the app\'s own address is NOT blocked (as before) – and the Admin\'s fault list now gets a quiet note of it (the user sees nothing)', ran === 'ran 1' && s.calls.slice(c0).indexOf('reportError') > -1 && errs2.length > e0 && /watched only/.test(errs2[0].msg) && /script-src/.test(errs2[0].msg) && !/Security policy/.test(card),
    { script: ran, reported: s.calls.slice(c0).indexOf('reportError') > -1, note: errs2[0] && errs2[0].msg, shown_to_user: card || 'nothing' });
  await s.ctx.close();

  await b.close(); cleanUp();
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { cleanUp(); } catch (x) {} process.exit(1); });
