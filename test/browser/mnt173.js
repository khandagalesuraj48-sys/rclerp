// update-173 (asked 27-10-2026: "ata mazya kade pdf aahet excel aahe log book che ok ata jewde active aahet own rachana vehicle te mala
// import karaych aahe as it is jas asel tr tya nantr new data mi bharat jail") – on the local rig started with PORTAL=1 and RCLSTEPS=1:
// site S1 (database rcl, step 1zi run) plays VTR. Test data only (a workbook made here in his layout – not his data).
//   1. the page at S1 as the Super Admin: "Import the old log book (Excel)"; a workbook of 3 sheets – ROLLER NO-03 (its title above the
//      heading, the reading only on a bill's first row, a ₹0 line, a total line), a rented JCB, a sheet with another heading – read;
//      the roller found (ROLLER NO-03 = its Asset Master name / number), the JCB not offered (Rental); Check; Import; saved as it is
//   2. the same file again: every bill already there – nothing twice
//   (28-10-2026, his answers: "PDF import – Claude AI वाचेल", "Excel format (template) download", "यादी दाखव, मी पाहून ✓ करेन"; on the
//   rig in claude mode – the stand-in test/claude-standin.js answers as Claude would)
//   1. the names: the AI's list (GANESH MOTERS → Ganesh Motors, FUEL WATER SEPRETOR → …), nothing ticked; one ticked goes with its bill;
//      a line whose Qty × Rate is not its Amount shown to look at
//   2. the duplicates listed (rows, date, ₹, the bill it is) – also a bill whose party is written another way
//   3. a PDF read by the AI a page a call (update-176: each page taken out and sent alone; a cut answer: the quicker model); two machinery in it; Check, Import
//   4. "Download the format (Excel)": a sheet for each Own machinery on the site, its number in row 3, the heading
//   5. (update-174) a user with Maintenance Edit sees the import, View only does not
//   6. (update-175) an Own machinery no longer on the site offered too; the names' list gone after the import; the log book "Start to end"
//      (no limit of days), each bill Change / Delete on the screen (not in the Excel), "Fetch outward (Store)"; the bills "Start to end"
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt173.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const XLSX = require('xlsx');
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp', AI = 'http://127.0.0.1:3998';
const aiSay = async (p, body) => (await fetch(AI + p, { method: p === '/__log' || p === '/__clear' ? 'GET' : 'POST', body: p === '/__log' || p === '/__clear' ? undefined : body, signal: AbortSignal.timeout(10000) })).json();
const R = 'RL-173', J2 = 'JCB-173', O3 = 'OLD-173';      // (the roller found by its name in the Asset Master – Roller No.03 = ROLLER NO-03)
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
    const m3 = await J('saveMaster', { no: O3, name: 'Old Roller 173', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Inactive', activeFrom: '2019-01-01', inactiveFrom: '2025-06-01' }, 'add');
    ok('the roller (Own, Active from this month), a rented JCB and an Own roller no longer on the site in the Asset Master', !m1.ERROR && !m2.ERROR && !m3.ERROR, [m1, m2, m3]);
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
      [7, '30-12-2023', 'GANESH MOTERS', '', 'Cotton West', 0.5, 'Kg', 33, 15, 3, 18, 18],      // (the party written another way; Qty × Rate = 16.50, not 15)
      ['', '', '', '', 'Total', '', '', '', '', '', 16017.62, 16017.62]];
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
    ok('1. the Super Admin sees "Import the old log book (Excel or PDF)" under the bills, "Download the format (Excel)" beside it', pv.shown && pv.admin && pv.title === 'Import the old log book (Excel or PDF)' && await F.evaluate(() => $('mti_fmt').textContent === 'Download the format (Excel)'), pv);
    for (let i = 0; i < 30 && !(await F.evaluate(() => typeof XLSX !== 'undefined')); i++) await wait(500);
    await aiSay('/__clear');
    await aiSay('/__names', JSON.stringify({ fixes: [['party', 'GANESH MOTERS', 'Ganesh Motors'], ['work', 'FUEL WATER SEPRETOR', 'FUEL WATER SEPARATOR']] }));
    const namesDone = () => F.evaluate(() => !!(S.mli && S.mli.fix && !S.mli.fix.busy));
    const inp = await F.$('#mti_file'); await inp.uploadFile(file);
    for (let i = 0; i < 40 && !(await namesDone()); i++) await wait(400);
    const rd = await F.evaluate(() => ({ name: $('mti_name').textContent, rows: [...document.querySelectorAll('#mti_out tbody tr')].map(tr => [...tr.cells].map(c => c.querySelector('select') ? c.querySelector('select').value : c.textContent.trim())),
      opts: [...document.querySelectorAll('#mti_out tbody tr select')][0] ? [...[...document.querySelectorAll('#mti_out tbody tr select')][0].options].map(o => o.value) : [],
      optOld: [...document.querySelectorAll('#mti_out tbody tr select')][0] ? ([...[...document.querySelectorAll('#mti_out tbody tr select')][0].options].find(o => o.value === 'OLD-173') || {}).textContent || '' : '',
      bills: S.mli.sheets[0].bills.map(x => [x.rows, x.date, x.garage, x.km, x.lines.map(l => l.work + ':' + l.amount + ':' + l.gst).join(', ')]) }));
    const rows0 = await F.evaluate(() => [...document.querySelectorAll('#mti_out .table-wrap')].pop().querySelectorAll('tbody tr').length);
    rd.rows = rd.rows.slice(rd.rows.length - rows0);      // (the sheets' table – after the names' table)
    ok('   the file read: 2 sheets with the heading (the "Summary" left out); "Roller 03" – its name in the file ROLLER NO-03, put to ' + R + ' (Own, its name Roller No.03); 7 rows, 4 bills, ₹16,017.32 (the file ₹16,017.62); the JCB: not imported (Rental – not offered)',
      /All Machinery Maintenance Logbook\.xlsx – 2 sheet\(s\)/.test(rd.name) && rd.rows.length === 2 && JSON.stringify(rd.rows[0].slice(0, 7)) === JSON.stringify(['Roller 03', 'ROLLER NO-03', R, '7', '4', '16,017.62', '16,017.32']) &&
      rd.rows[1][0] === 'JCB' && rd.rows[1][2] === '' && rd.opts.indexOf(J2) === -1 && rd.opts.indexOf(R) > -1 && rd.optOld === 'OLD-173 · Old Roller 173 (not on the site now)', rd);
    ok('   a bill = the rows of one date and party (the reading of its first row; a date under a merged cell = the row above); each line as it is – GST 18 % from its GST Amount, "Drum oil" ₹0',
      JSON.stringify(rd.bills) === JSON.stringify([['Line 5', '2022-12-02', 'Store', '', 'AD BLUE:1180:18'], ['Line 6–8', '2023-01-05', 'Store', 500, 'FUEL FILTER:650:18, FUEL WATER SEPRETOR:425:18, ENGINE OIL FILTER:930:18'],
        ['Line 9–10', '2024-01-29', 'Ganesh Motors', 1745, 'DRUM OIL:0:, HYDROLIC OIL L&T:10374:18'], ['Line 11', '2023-12-30', 'GANESH MOTERS', '', 'Cotton West:15:18']]), rd.bills);
    // the names: the AI's list, nothing ticked; the file's names and the saved ones went to the AI
    const nm = await F.evaluate(() => ({ head: (document.querySelector('#mti_out .mli-names h3') || {}).textContent, rows: [...document.querySelectorAll('#mti_out .mli-names tbody tr')].map(tr => [tr.cells[0].querySelector('input').checked, tr.cells[1].textContent, tr.cells[2].textContent, tr.cells[3].querySelector('input').value, tr.cells[4].textContent]),
      look: [...document.querySelectorAll('#mti_out details.mli-more')].map(d => d.querySelector('summary').textContent + ' | ' + d.querySelector('li').textContent) }));
    const lg1 = (await aiSay('/__log')).filter(x => x.names);
    ok('   the names (AI): "Names written in more than one way" – Party Name GANESH MOTERS → Ganesh Motors (1 row), Particulars FUEL WATER SEPRETOR → FUEL WATER SEPARATOR (1 row), nothing ticked; the AI asked once with the file\'s names and rows (every sheet – the JCB\'s too)',
      nm.head === 'Names written in more than one way (AI)' && JSON.stringify(nm.rows) === JSON.stringify([[false, 'Party Name', 'GANESH MOTERS', 'Ganesh Motors', '1'], [false, 'Particulars', 'FUEL WATER SEPRETOR', 'FUEL WATER SEPARATOR', '1']]) &&
      lg1.length === 1 && /\["Store",5\],\["Ganesh Motors",2\],\["GANESH MOTERS",1\]\]/.test(lg1[0].ask) && /\["Cotton West",1\],\["Grease",1\]\]/.test(lg1[0].ask), [nm, lg1]);
    ok('   the full check: "1 line(s) to look at – imported as they are": Line 11 (Cotton West): Qty × Rate = ₹16.50, Amount ₹15.00',
      JSON.stringify(nm.look) === JSON.stringify(['1 line(s) to look at – imported as they are | Line 11 (Cotton West): Qty × Rate = ₹16.50, Amount ₹15.00']), nm.look);
    await F.evaluate(() => { const c = document.querySelector('#mti_out [data-mlf="0"]'); c.click(); }); await wait(400);      // (the party ticked; the Particulars not)
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 40 && !(await F.evaluate(() => S.mli.sheets[0].res)); i++) await wait(400);
    await wait(300);
    const ck = await F.evaluate(() => ({ st: [...[...document.querySelectorAll('#mti_out .table-wrap')].pop().querySelectorAll('tbody tr')][0].cells[7].textContent, go: !$('mti_go').disabled, saved: S.mt.rows.length }));
    ok('   Check: "✓ 4 new bill(s), 7 line(s), ₹16,017.32 (02-12-2022 – 29-01-2024)" – nothing saved yet; Import can be pressed', /✓ 4 new bill\(s\), 7 line\(s\), ₹16,017\.32 \(02-12-2022 – 29-01-2024\)/.test(ck.st) && ck.go && sql('rcl', 'select count(*) from maintenance') === '0', ck);
    await tidy(); await F.evaluate(() => $('mti_panel').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt173_check.png') });
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 40 && sql('rcl', 'select count(*) from maintenance') !== '4'; i++) await wait(500);
    await wait(1500);
    const rows = sql('rcl', "select id || '|' || to_char(date, 'YYYY-MM-DD') || '|' || garage || '|' || coalesce(km_reading::text, '') || '|' || amount from maintenance order by id").split('\n');
    const st2 = await F.evaluate(() => [...[...document.querySelectorAll('#mti_out .table-wrap')].pop().querySelectorAll('tbody tr')][0].cells[7].textContent);
    const namesAfter = await F.evaluate(() => !!document.querySelector('#mti_out .mli-names'));
    ok('   (update-175) after the import: the names\' list is gone (nothing left to import)', namesAfter === false, namesAfter);
    const l3 = JSON.parse(sql('rcl', "select lines from maintenance where id = 'MT-000003'") || '[]'), l2 = JSON.parse(sql('rcl', "select lines from maintenance where id = 'MT-000002'") || '[]');
    ok('   Import: 4 bills saved as they are – MT-000001 … MT-000004 (dates of 2022–2024, the party, the reading, ₹1,392.40 / ₹2,365.90 / ₹12,241.32 / ₹17.70); "Drum oil" kept as FOC; the ticked name: "Ganesh Motors"; the unticked one as in the file; "✓ 4 bill(s) imported"',
      JSON.stringify(rows) === JSON.stringify(['MT-000001|2022-12-02|Store||1392.4', 'MT-000002|2023-01-05|Store|500|2365.9', 'MT-000003|2024-01-29|Ganesh Motors|1745|12241.32', 'MT-000004|2023-12-30|Ganesh Motors||17.7']) &&
      l3.map(l => l.work + ':' + l.type + ':' + (l.gst || 0)).join(', ') === 'DRUM OIL:FOC:0, HYDROLIC OIL L&T:Paid:18' && l2[1].work === 'FUEL WATER SEPRETOR' && /✓ 4 bill\(s\) imported \(MT-000001 – MT-000004\)/.test(st2), [rows, l3, l2, st2]);
    // ---- 2. the same file again: nothing twice ----
    await F.evaluate(() => { $('mti_file').value = ''; }); await inp.uploadFile(file); await wait(1500);      // (as "Choose the file" does)
    for (let i = 0; i < 40 && !(await namesDone()); i++) await wait(400);
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 40 && !(await F.evaluate(() => S.mli.sheets[0].res)); i++) await wait(400);
    await wait(300);
    const again = await F.evaluate(() => { const tr = [...[...document.querySelectorAll('#mti_out .table-wrap')].pop().querySelectorAll('tbody tr')][0];
      const d = [...tr.cells[7].querySelectorAll('details')].find(x => /already there/.test(x.textContent)); return { st: tr.cells[7].textContent, list: d ? [...d.querySelectorAll('li')].map(li => li.textContent) : [] }; });
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); }); await wait(2500);
    ok('2. the same file again (its names unticked now): "✓ 0 new bill(s) … 4 bill(s) already there – left out" – each listed: its rows, date, ₹ and the bill it is (GANESH MOTERS = the saved Ganesh Motors bill); still 4 bills – nothing twice',
      /✓ 0 new bill\(s\)/.test(again.st) && /4 bill\(s\) already there – left out/.test(again.st) && sql('rcl', 'select count(*) from maintenance') === '4' &&
      JSON.stringify(again.list) === JSON.stringify(['Line 5 · 02-12-2022 · ₹1,392.40 – already saved as MT-000001', 'Line 6–8 · 05-01-2023 · ₹2,365.90 – already saved as MT-000002', 'Line 9–10 · 29-01-2024 · ₹12,241.32 – already saved as MT-000003', 'Line 11 · 30-12-2023 · ₹17.70 – already saved as MT-000004']), again);
    // ---- 3. a PDF of the old log book, read by the AI (the stand-in answers as Claude) – (update-176) a real PDF of 3 pages: each page
    //      taken out on the page and sent ALONE; page 1; page 2 cut off – asked again of the quicker model (Haiku); page 3 ----
    await aiSay('/__clear');
    await aiSay('/__next', JSON.stringify({ pages: 1, tables: [{ machinery: 'ROLLER NO-03', rows: [[1, '2022-12-02', 'Store', null, 'AD BLUE', 20, 'Ltr', 59, 1180, 212.4, 1392.4, 1392.4], [2, '2025-02-10', 'Store', 620, 'GREASE', 2, 'Kg', 180, 360, 64.8, 424.8, 424.8]] }] }));
    await aiSay('/__next', '{"pages": 1, "tables": [{"machinery": null, "rows": [[3, null, null, null, "BU');
    await aiSay('/__next', JSON.stringify({ pages: 1, tables: [{ machinery: null, rows: [[3, null, null, null, 'BULB', 1, 'Nos', 40, 40, 7.2, 47.2, 47.2]] }] }));
    await aiSay('/__next', JSON.stringify({ pages: 1, tables: [{ machinery: 'MH12XW0169', rows: [[1, '2026-02-10', 'Navnit Motors', 13153, 'Wiper blade', 1, 'Nos', 310, 310, 55.8, 365.8, 365.8]] }] }));
    const PL = require(path.join(__dirname, '..', '..', 'app', 'vendor', 'pdf-lib-1.17.1.min.js')), pd = await PL.PDFDocument.create(), pf = await pd.embedFont(PL.StandardFonts.Helvetica);
    for (let i = 1; i <= 3; i++) pd.addPage([842, 595]).drawText('MAINTENANCE LOG BOOK – page ' + i, { x: 40, y: 540, size: 18, font: pf });
    const pdfFile = path.join(dir, 'Old log book.pdf'); fs.writeFileSync(pdfFile, Buffer.from(await pd.save()));
    await F.evaluate(() => { $('mti_file').value = ''; }); await inp.uploadFile(pdfFile);
    for (let i = 0; i < 60 && !(await F.evaluate(() => !!(S.mli && S.mli.name === 'Old log book.pdf' && S.mli.fix && !S.mli.fix.busy))); i++) await wait(400);
    const pr = await F.evaluate(() => ({ name: $('mti_name').textContent, sheets: S.mli.sheets.map(x => [x.sheet, x.label, x.no, x.rows, x.bills.map(b => b.rows + ':' + b.date + ':' + b.garage + ':' + b.km + ':' + b.lines.map(l => l.work).join('+')).join(' | ')]),
      names: (document.querySelector('#mti_out .mli-names p') || {}).textContent }));
    const lg3 = (await aiSay('/__log')).filter(x => x.kind === 'document');
    ok('3. (update-176) a PDF of 3 pages: read by the AI a page a call, each page taken out of the file and sent ALONE (one page, not kept) – page 1, page 2 cut off and asked again of the quicker model (Haiku), page 3; 2 machinery: ROLLER NO-03 (a page going on without its name joined to it) put to ' + R + ', MH12XW0169 not on this site – not imported; the names: none to change',
      /Old log book\.pdf – 2 sheet\(s\)/.test(pr.name) && JSON.stringify(pr.sheets) === JSON.stringify([['ROLLER NO-03', 'ROLLER NO-03', R, 3, 'Line 1:2022-12-02:Store::AD BLUE | Line 2–3:2025-02-10:Store:620:GREASE+BULB'], ['MH12XW0169', 'MH12XW0169', '', 1, 'Line 1:2026-02-10:Navnit Motors:13153:Wiper blade']]) &&
      lg3.length === 4 && lg3.every(x => !x.kept && x.image === 'application/pdf' && x.jsonAsked && x.read === 'this page (one page of the log book)') &&
      JSON.stringify(lg3.map(x => x.model)) === JSON.stringify(['claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-sonnet-5-5']) &&
      pr.names === '✓ The AI found no name written in more than one way.', [pr, lg3.map(x => [x.read, x.kept, x.model, x.maxTokens])]);
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 40 && !(await F.evaluate(() => S.mli.sheets[0].res)); i++) await wait(400);
    await wait(300);
    const pc = await F.evaluate(() => [...[...document.querySelectorAll('#mti_out .table-wrap')].pop().querySelectorAll('tbody tr')].map(tr => tr.cells[7].textContent));
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 40 && sql('rcl', 'select count(*) from maintenance') !== '5'; i++) await wait(500);
    await wait(1200);
    const r5 = sql('rcl', "select id || '|' || to_char(date, 'YYYY-MM-DD') || '|' || garage || '|' || coalesce(km_reading::text, '') || '|' || amount from maintenance where id = 'MT-000005'");
    ok('   Check: the roller "✓ 1 new bill(s), 2 line(s), ₹472.00" and AD BLUE already there (MT-000001); Import: MT-000005 – 10-02-2025, Store, 620, ₹472',
      /✓ 1 new bill\(s\), 2 line\(s\), ₹472\.00 \(10-02-2025 – 10-02-2025\)/.test(pc[0]) && /1 bill\(s\) already there – left out/.test(pc[0]) && /not imported/.test(pc[1]) && r5 === 'MT-000005|2025-02-10|Store|620|472', [pc, r5]);
    // ---- 4. the format of the old log book (Excel) ----
    const made = await F.evaluate(() => { let got = null; const w = XLSX.writeFile; XLSX.writeFile = (wb, name) => { got = { name: name, b64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) }; }; try { $('mti_fmt').click(); } finally { XLSX.writeFile = w; } return got; });
    let fmt = null; try { const w = XLSX.read(Buffer.from(made.b64, 'base64'), { type: 'buffer' }); const r1 = XLSX.utils.sheet_to_json(w.Sheets[R], { header: 1, defval: '' });
      fmt = { file: made.name, first: w.SheetNames[0], has: w.SheetNames.indexOf(R) > -1, jcb: w.SheetNames.indexOf(J2) > -1, title: r1[1][0], no: r1[2][0], head: r1[3].join(' · ') }; } catch (e) { fmt = { made: made && made.name, err: String(e.message) }; }
    ok('4. "Download the format (Excel)": "Old Maintenance Log Book – format.xlsx" – "How to fill" first, a sheet for ' + R + ' (row 3 its number, the heading), none for the rented JCB',
      fmt && fmt.file === 'Old Maintenance Log Book – format.xlsx' && fmt.first === 'How to fill' && fmt.has && !fmt.jcb && fmt.title === 'Maintenance Log Book – Roller No.03' && fmt.no === R &&
      fmt.head === 'Sr No · Date · Party Name · Current Reading · Particulars · Qty · Uom · Basic Rate · Amount · GST Amount · Amount With GST · Total', fmt);
    // ---- 5. (update-174, "he admin la fkt nahi user la pn disu de") a user with Maintenance Edit sees the import; View only does not ----
    const seen = async (admin, perm) => { await F.evaluate((a, p) => { S.user.admin = a; S.user.perms = Object.assign({}, S.user.perms, { Maintenance: p }); mtLoad(); }, admin, perm); await wait(1500); return F.evaluate(() => !$('mti_panel').hidden); };
    const vis = [await seen(false, 'Edit'), await seen(false, 'View'), await seen(true, 'Edit')];
    ok('5. the import: a user (not Admin) with Maintenance Edit sees it; with View only not; the Admin sees it', JSON.stringify(vis) === JSON.stringify([true, false, true]), vis);
    // the log book of the roller shows them (history)
    const lg = await J('maintLog', { no: R, from: '2022-12-01', to: '2025-11-30' });      // (a log book of at most 1,100 days)
    ok('   the roller\'s log book: the 5 old bills, ₹16,489.32', lg && lg.total && lg.total.maint.bills === 5 && lg.total.maint.amount === 16489.32, lg && (lg.total || lg));
    // ---- 6. (update-175) the log book: Start to end; Change / Delete; Fetch outward; the bills: Start to end ----
    await F.evaluate(r => { $('ml_no').value = r; $('ml_all').checked = true; $('ml_all').dispatchEvent(new Event('change')); $('ml_go').click(); }, R);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden && S.rp && S.rp.mlog && S.rp.mlog.d.all)); i++) await wait(400);
    await wait(500);
    const lb = await F.evaluate(() => ({ meta: $('rpmlog_meta').textContent, dis: $('ml_from').disabled && $('ml_to').disabled, bills: S.rp.mlog.d.total.maint.bills, acts: [...document.querySelectorAll('#rpmlog_body .mlog-act')].map(x => x.closest('[data-mlb]').dataset.mlb),
      excel: /mlog-act|>Change</.test(S.rp.mlog.v.html), store: S.rp.mlog.d.store }));
    ok('6. the log book "Start to end": from its first bill (02-12-2022) to today – the dates greyed; 5 bills, each with Change / Delete on the screen (not in the Excel); the Store\'s outward: not built yet',
      new RegExp('^Start to end: 02-12-2022 to ' + today.split('-').reverse().join('-')).test(lb.meta) && lb.dis && lb.bills === 5 && JSON.stringify(lb.acts.slice().sort()) === JSON.stringify(['MT-000001', 'MT-000002', 'MT-000003', 'MT-000004', 'MT-000005']) && !lb.excel && lb.store && lb.store.on === false, lb);
    await tidy(); await F.evaluate(() => $('rpmlog_out').scrollIntoView({ block: 'start' })); await wait(400);
    await mp.screenshot({ path: path.join(SHOT, 'mnt175_logbook.png') });
    await F.evaluate(() => $('ml_out').click()); await wait(2500);
    const outT = await F.evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
    ok('   "Fetch outward (Store)": the log book read again; "The Store\'s Issue … is not built yet – there is no outward to fetch …"', /The Store's Issue \(material given to a machinery\) is not built yet – there is no outward to fetch/.test(outT), outT);
    await tidy();
    await F.evaluate(() => document.querySelector('#rpmlog_body [data-mle="MT-000005"]').click()); await wait(2500);
    const ed = await F.evaluate(() => ({ title: $('mt_title').textContent, no: $('mt_no').value, date: $('mt_date').value, edit: S.mt.edit }));
    ok('   Change of a bill in the log book: MT-000005 in the form (its machinery, its date)', ed.title === 'Change bill MT-000005' && ed.no === R && ed.date === '2025-02-10' && ed.edit === 'MT-000005', ed);
    await F.evaluate(() => mtClear());
    await F.evaluate(() => document.querySelector('#rpmlog_body [data-mld="MT-000004"]').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 30 && sql('rcl', 'select count(*) from maintenance') !== '4'; i++) await wait(400);
    await wait(2500);
    const del = await F.evaluate(() => ({ bills: S.rp.mlog.d.total.maint.bills, acts: document.querySelectorAll('#rpmlog_body .mlog-act').length }));
    ok('   Delete of a bill in the log book: MT-000004 deleted – 4 bills left, the log book shown again', sql('rcl', "select count(*) from maintenance where id = 'MT-000004'") === '0' && del.bills === 4 && del.acts === 4, del);
    await F.evaluate(() => { $('mtf_no').value = ''; $('mtf_all').checked = true; $('mtf_all').dispatchEvent(new Event('change')); }); await wait(2500);
    const bl = await F.evaluate(() => ({ n: S.mt.rows.length, dis: $('mtf_from').disabled }));
    ok('   the bills "Start to end": every bill (4 – from 2022), the dates greyed', bl.n === 4 && bl.dis, bl);
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl', "delete from maintenance; delete from master where id in ('" + R + "', '" + J2 + "', '" + O3 + "'); delete from web.props where key = 'MNT_LAST_NO'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: S1 back to ' + sql('rcl', 'select count(*) from maintenance') + ' bills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
