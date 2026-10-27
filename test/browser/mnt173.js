// update-173 (asked 27-10-2026: "ata mazya kade pdf aahet excel aahe log book che ok ata jewde active aahet own rachana vehicle te mala
// import karaych aahe as it is jas asel tr tya nantr new data mi bharat jail") – on the local rig started with PORTAL=1 and RCLSTEPS=1:
// site S1 (database rcl, step 1zi run) plays VTR. Test data only (a workbook made here in his layout – not his data).
//   1. the page at S1 as the Super Admin: "Import the old log book (Excel)"; a workbook of 3 sheets – ROLLER NO-03 (its title above the
//      heading, the reading only on a bill's first row, a ₹0 line, a total line), a rented JCB, a sheet with another heading – read;
//      the roller found (ROLLER NO-03 = its Asset Master name / number), the JCB not offered (Rental); Check; Import; saved as it is
//   2. the same file again: every bill already there – nothing twice
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt173.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const XLSX = require('xlsx');
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const R = 'RL-173', J2 = 'JCB-173';      // (the roller found by its name in the Asset Master – Roller No.03 = ROLLER NO-03)
(async () => {
  const errs = []; let b = null, cookie = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const has = (db, t) => sql(db, "select count(*) from information_schema.tables where table_schema = 'public' and table_name = '" + t + "'");
  const n0 = has('rcl', 'maintenance') === '1' ? sql('rcl', 'select count(*) from maintenance') : 'none';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnt173-'));
  try {
    ok('start: S1 (rcl) has step 1zi and no bill', n0 === '0', n0);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01';
    const m1 = await J('saveMaster', { no: R, name: 'Roller No.03', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add');
    const m2 = await J('saveMaster', { no: J2, name: 'JCB 3DX', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'Patil Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add');
    ok('the roller (Own, Active from this month) and a rented JCB in the Asset Master', !m1.ERROR && !m2.ERROR, [m1, m2]);
    // his layout (the PDF of Roller No-03): 3 title rows, a heading of wrapped names, the reading only on a bill's first row, a date left
    // empty under a merged cell, a ₹0 "Drum oil", the total line; dates of 2022–2024 (before the roller's Active From – history)
    const head = ['Sr\nNo', 'Date', 'Party Name', 'Current\nReading', 'Particulars', 'Qty', 'Uom', 'Basic Rate', 'Amount', 'GST Amount', 'Amount\nWith GST', 'Total'];
    const roller = [['', '', '', 'Rachana Construction Limited'], ['', '', '', 'Vehicle Maintanance Log Book'], ['', '', '', 'ROLLER NO-03'], head,
      [1, '02-12-2022', 'Store', '', 'AD BLUE', 20, 'Ltr', 59, 1180, 212.4, 1392.4, 1392.4],
      [2, '05-01-2023', 'Store', 500, 'FUEL FILTER', 1, 'Nos', 650, 650, 117, 767, 767],
      [3, '05-01-2023', 'Store', '', 'FUEL WATER SEPRETOR', 1, 'Nos', 425, 425, 76.5, 501.5, 501.5],
      [4, '', '', '', 'ENGINE OIL FILTER', 1, 'Nos', 930, 930, 167.4, 1097.4, 1097.4],
      [5, '29-01-2024', 'Ganesh Motors', 1745, 'DRUM OIL', 25, 'Ltr', 0, 0, 0, 0, 0],
      [6, '29-01-2024', 'Ganesh Motors', 1745, 'HYDROLIC OIL L&T', 78, 'Ltr', 133, 10374, 1867.32, 12241.32, 12241.32],
      ['', '', '', '', 'Total', '', '', '', '', '', 15999.62, 15999.62]];
    const jcb = [['', '', '', 'Rachana Construction Limited'], ['', '', '', 'JCB 3DX'], head, [1, '03-03-2023', 'Store', 800, 'Grease', 2, 'Kg', 180, 360, 64.8, 424.8, 424.8]];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(roller), 'Roller 03');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(jcb), 'JCB');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Summary'], ['Machinery', 'Bills'], ['Roller 03', 3]]), 'Summary');
    const file = path.join(dir, 'All Machinery Maintenance Logbook.xlsx'); XLSX.writeFile(wb, file);
    // ---- 1. the page ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(4500);
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); await wait(300); };
    await F.evaluate(() => showTab('mnt')); await wait(2500);
    const pv = await F.evaluate(() => ({ shown: !$('mti_panel').hidden, admin: !!(S.user && S.user.admin), title: document.querySelector('#mti_panel h2').textContent }));
    ok('1. the Super Admin sees "Import the old log book (Excel)" under the bills', pv.shown && pv.admin && pv.title === 'Import the old log book (Excel)', pv);
    for (let i = 0; i < 30 && !(await F.evaluate(() => typeof XLSX !== 'undefined')); i++) await wait(500);
    const inp = await F.$('#mti_file'); await inp.uploadFile(file);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !!S.mli)); i++) await wait(300);
    const rd = await F.evaluate(() => ({ name: $('mti_name').textContent, rows: [...document.querySelectorAll('#mti_out tbody tr')].map(tr => [...tr.cells].map(c => c.querySelector('select') ? c.querySelector('select').value : c.textContent.trim())),
      opts: [...document.querySelectorAll('#mti_out tbody tr select')][0] ? [...[...document.querySelectorAll('#mti_out tbody tr select')][0].options].map(o => o.value) : [],
      bills: S.mli.sheets[0].bills.map(x => [x.rows, x.date, x.garage, x.km, x.lines.map(l => l.work + ':' + l.amount + ':' + l.gst).join(', ')]) }));
    ok('   the file read: 2 sheets with the heading (the "Summary" left out); "Roller 03" – its name in the file ROLLER NO-03, put to ' + R + ' (Own, its name Roller No.03); 6 rows, 3 bills, ₹15,999.62 (the file ₹15,999.62); the JCB: not imported (Rental – not offered)',
      /All Machinery Maintenance Logbook\.xlsx – 2 sheet\(s\)/.test(rd.name) && rd.rows.length === 2 && JSON.stringify(rd.rows[0].slice(0, 7)) === JSON.stringify(['Roller 03', 'ROLLER NO-03', R, '6', '3', '15,999.62', '15,999.62']) &&
      rd.rows[1][0] === 'JCB' && rd.rows[1][2] === '' && rd.opts.indexOf(J2) === -1 && rd.opts.indexOf(R) > -1, rd);
    ok('   a bill = the rows of one date and party (the reading of its first row; a date under a merged cell = the row above); each line as it is – GST 18 % from its GST Amount, "Drum oil" ₹0',
      JSON.stringify(rd.bills) === JSON.stringify([['Line 5', '2022-12-02', 'Store', '', 'AD BLUE:1180:18'], ['Line 6–8', '2023-01-05', 'Store', 500, 'FUEL FILTER:650:18, FUEL WATER SEPRETOR:425:18, ENGINE OIL FILTER:930:18'],
        ['Line 9–10', '2024-01-29', 'Ganesh Motors', 1745, 'DRUM OIL:0:, HYDROLIC OIL L&T:10374:18']]), rd.bills);
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 40 && !(await F.evaluate(() => S.mli.sheets[0].res)); i++) await wait(400);
    await wait(300);
    const ck = await F.evaluate(() => ({ st: [...document.querySelectorAll('#mti_out tbody tr')][0].cells[7].textContent, go: !$('mti_go').disabled, saved: S.mt.rows.length }));
    ok('   Check: "✓ 3 new bill(s), 6 line(s), ₹15,999.62 (02-12-2022 – 29-01-2024)" – nothing saved yet; Import can be pressed', /✓ 3 new bill\(s\), 6 line\(s\), ₹15,999\.62 \(02-12-2022 – 29-01-2024\)/.test(ck.st) && ck.go && sql('rcl', 'select count(*) from maintenance') === '0', ck);
    await tidy(); await F.evaluate(() => $('mti_panel').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt173_check.png') });
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 40 && sql('rcl', 'select count(*) from maintenance') !== '3'; i++) await wait(500);
    await wait(1500);
    const rows = sql('rcl', "select id || '|' || to_char(date, 'YYYY-MM-DD') || '|' || garage || '|' || coalesce(km_reading::text, '') || '|' || amount from maintenance order by id").split('\n');
    const l3 = JSON.parse(sql('rcl', "select lines from maintenance order by id desc limit 1") || '[]');
    const st2 = await F.evaluate(() => [...document.querySelectorAll('#mti_out tbody tr')][0].cells[7].textContent);
    ok('   Import: 3 bills saved as they are – MT-000001 … MT-000003 (dates of 2022–2024, the party, the reading, ₹1,392.40 / ₹2,365.90 / ₹12,241.32); "Drum oil" kept as FOC; "✓ 3 bill(s) imported"',
      JSON.stringify(rows) === JSON.stringify(['MT-000001|2022-12-02|Store||1392.4', 'MT-000002|2023-01-05|Store|500|2365.9', 'MT-000003|2024-01-29|Ganesh Motors|1745|12241.32']) &&
      l3.map(l => l.work + ':' + l.type + ':' + (l.gst || 0)).join(', ') === 'DRUM OIL:FOC:0, HYDROLIC OIL L&T:Paid:18' && /✓ 3 bill\(s\) imported \(MT-000001 – MT-000003\)/.test(st2), [rows, l3, st2]);
    // ---- 2. the same file again: nothing twice ----
    await F.evaluate(() => { $('mti_file').value = ''; }); await inp.uploadFile(file); await wait(1500);      // (as "Choose the Excel file" does)
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 40 && !(await F.evaluate(() => S.mli.sheets[0].res)); i++) await wait(400);
    await wait(300);
    const again = await F.evaluate(() => ({ st: [...document.querySelectorAll('#mti_out tbody tr')][0].cells[7].textContent }));
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); }); await wait(2500);
    ok('2. the same file again: "✓ 0 new bill(s) … 3 bill(s) already there – left out"; still 3 bills – nothing twice', /✓ 0 new bill\(s\)/.test(again.st) && /3 bill\(s\) already there – left out/.test(again.st) && sql('rcl', 'select count(*) from maintenance') === '3', again);
    // the log book of the roller shows them (history)
    const lg = await J('maintLog', { no: R, from: '2022-12-01', to: '2025-11-30' });      // (a log book of at most 1,100 days)
    ok('   the roller\'s log book: the 3 old bills, ₹15,999.62', lg && lg.total && lg.total.maint.bills === 3 && lg.total.maint.amount === 15999.62, lg && (lg.total || lg));
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl', "delete from maintenance; delete from master where id in ('" + R + "', '" + J2 + "'); delete from web.props where key = 'MNT_LAST_NO'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: S1 back to ' + sql('rcl', 'select count(*) from maintenance') + ' bills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
