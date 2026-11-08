// update-180 (asked 28-10-2026: "kahi pdf madhe heading maghe pudhe aahet tr aple systeam ni auto identify krun te sagla banwayla haw ok
// ani ha kontya hi gadichi log bokk maintanace wala ek ek entry mala edit or delet krta yawi"; his answer: each line on its own) – on the
// local rig in claude mode (PORTAL=1, RCLSTEPS=1): site S1 (database rcl, step 1zi run). Test data only (made here – not his data).
//   1. an Excel of the old log book with its headings in ANOTHER ORDER and other names (Item Description, Bill Date, Supplier, KM, Unit,
//      Rate, Taxable Value, CGST 9%, SGST 9%, Net Amount, Remarks): read by their words – the same bills; Check; Import
//   2. a PDF of 2 pages read by the AI (the stand-in answers as Claude): page 1 its headings in another order (one the rules do not know,
//      "Kilometre" – the AI's word), page 2 going on without its heading – the page sends page 1's headings with it; Check; Import
//   3. the Maintenance Log Book of the roller: each line its Edit · Delete on the screen (not in the print / Excel); a line changed in its
//      box (Qty → its ₹ from Qty × Rate), the rest of the bill as it was; a line changed by someone meanwhile – refused in the box; a line
//      deleted; the only line of a bill – the whole bill deleted (said first); View only – no Edit / Delete
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node mline180.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const XLSX = require('xlsx');
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1500) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp', AI = 'http://127.0.0.1:3998';
const aiSay = async (p, body) => (await fetch(AI + p, { method: p === '/__log' || p === '/__clear' ? 'GET' : 'POST', body: p === '/__log' || p === '/__clear' ? undefined : body, signal: AbortSignal.timeout(10000) })).json();
const R = 'RL-180';
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mline180-'));
  const bill = id => { const t = sql('rcl', "select amount || '|' || lines from maintenance where id = '" + id + "'"); if (!t) return null; const i = t.indexOf('|'); return { amount: Number(t.slice(0, i)), lines: JSON.parse(t.slice(i + 1)) }; };
  try {
    ok('start: S1 (rcl) has step 1zi and no bill', n0 === '0', n0);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01';
    const m1 = await J('saveMaster', { no: R, name: 'Roller No.18', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add');
    ok('an Own roller (Roller No.18) in the Asset Master', !m1.ERROR, m1);
    // ---- 1. an Excel in another order ----
    const head = ['Item Description', 'Bill Date', 'Supplier', 'KM', 'Qty', 'Unit', 'Rate', 'Taxable Value', 'CGST 9%', 'SGST 9%', 'Net Amount', 'Remarks'];
    const sheet = [['Rachana Construction Limited'], ['ROLLER NO-18'], head,
      ['AD BLUE', '02-12-2022', 'Store', '', 20, 'Ltr', 59, 1180, 106.2, 106.2, 1392.4, ''],
      ['FUEL FILTER', '05-01-2023', 'Store', 500, 1, 'Nos', 650, 650, 58.5, 58.5, 767, 'changed at 500 hrs'],
      ['ENGINE OIL FILTER', '', '', '', 1, 'Nos', 930, 930, 83.7, 83.7, 1097.4, '']];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet), 'Roller 18');
    const file = path.join(dir, 'Roller 18 old log book.xlsx'); XLSX.writeFile(wb, file);
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(4500);
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); await wait(300); };
    const toastNow = () => F.evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
    await F.evaluate(() => showTab('mnt')); await wait(2500);
    for (let i = 0; i < 30 && !(await F.evaluate(() => typeof XLSX !== 'undefined')); i++) await wait(500);
    await aiSay('/__clear');
    const namesDone = () => F.evaluate(() => !!(S.mli && S.mli.fix && !S.mli.fix.busy));
    const inp = await F.$('#mti_file'); await inp.uploadFile(file);
    for (let i = 0; i < 40 && !(await namesDone()); i++) await wait(400);
    const rd = await F.evaluate(() => ({ name: $('mti_name').textContent, sheets: S.mli.sheets.map(x => [x.sheet, x.label, x.no, x.rows, x.fileTotal, x.total]),
      bills: S.mli.sheets[0] ? S.mli.sheets[0].bills.map(x => [x.rows, x.date, x.garage, x.km, x.lines.map(l => l.work + ':' + l.qty + ':' + l.uom + ':' + l.rate + ':' + l.amount + ':' + l.gstAmt).join(', ')]) : [] }));
    ok('1. an Excel with its headings in another order (Item Description, Bill Date, Supplier, KM, Unit, Rate, Taxable Value, CGST 9%, SGST 9%, Net Amount, Remarks): read – the sheet put to ' + R + ', 3 rows, ₹3,256.80 (the file ₹3,256.80)',
      /Roller 18 old log book\.xlsx – 1 sheet\(s\)/.test(rd.name) && JSON.stringify(rd.sheets) === JSON.stringify([['Roller 18', 'ROLLER NO-18', R, 3, 3256.8, 3256.8]]), rd);
    ok('   each column by its heading: a bill = the rows of one date and party (the empty date = the row above), the reading, Qty, Unit, Rate, the Taxable Value as the amount, (update-183) the GST ₹ as in the file (CGST + SGST), no GST % made; the remark left out',
      JSON.stringify(rd.bills) === JSON.stringify([['Line 4', '2022-12-02', 'Store', '', 'AD BLUE:20:Ltr:59:1180:212.4'], ['Line 5–6', '2023-01-05', 'Store', 500, 'FUEL FILTER:1:Nos:650:650:117, ENGINE OIL FILTER:1:Nos:930:930:167.4']]), rd.bills);
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 40 && !(await F.evaluate(() => S.mli.sheets[0].res)); i++) await wait(400);
    await wait(300);
    const ck = await F.evaluate(() => [...[...document.querySelectorAll('#mti_out .table-wrap')].pop().querySelectorAll('tbody tr')][0].cells[7].textContent);
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 40 && sql('rcl', 'select count(*) from maintenance') !== '2'; i++) await wait(500);
    await wait(1200);
    const rows1 = sql('rcl', "select id || '|' || to_char(date, 'YYYY-MM-DD') || '|' || garage || '|' || coalesce(km_reading::text, '') || '|' || amount from maintenance order by id").split('\n');
    ok('   Check "✓ 2 new bill(s), 3 line(s), ₹3,256.80"; Import: MT-000001 (02-12-2022, Store, ₹1,392.40), MT-000002 (05-01-2023, Store, 500, ₹1,864.40)',
      /✓ 2 new bill\(s\), 3 line\(s\), ₹3,256\.80 \(02-12-2022 – 05-01-2023\)/.test(ck) && JSON.stringify(rows1) === JSON.stringify(['MT-000001|2022-12-02|Store||1392.4', 'MT-000002|2023-01-05|Store|500|1864.4']), [ck, rows1]);
    // ---- 2. a PDF of 2 pages: page 1 its headings in another order (one only the AI knows); page 2 going on without its heading ----
    await aiSay('/__clear');
    await aiSay('/__next', JSON.stringify({ pages: 1, tables: [{ machinery: 'ROLLER NO-18', head: ['Bill Date', 'Supplier', 'Kilometre', 'Item Description', 'Qty', 'Uom', 'Rate', 'Taxable', 'CGST 9%', 'SGST 9%', 'Net Amount'],
      fields: ['date', 'party', 'reading', 'particulars', 'qty', 'uom', 'rate', 'amount', 'gstAmount', 'gstAmount', 'withGst'], rows: [['2024-01-29', 'Ganesh Motors', 1745, 'HYDROLIC OIL', 78, 'Ltr', 133, 10374, 933.66, 933.66, 12241.32]] }] }));
    await aiSay('/__next', JSON.stringify({ pages: 1, tables: [{ machinery: null, head: null, rows: [[null, null, null, 'GREASE', 2, 'Kg', 180, 360, 32.4, 32.4, 424.8]] }] }));
    const PL = require(path.join(__dirname, '..', '..', 'app', 'vendor', 'pdf-lib-1.17.1.min.js')), pd = await PL.PDFDocument.create(), pf = await pd.embedFont(PL.StandardFonts.Helvetica);
    for (let i = 1; i <= 2; i++) pd.addPage([842, 595]).drawText('MAINTENANCE LOG BOOK – ROLLER NO-18 – page ' + i, { x: 40, y: 540, size: 18, font: pf });
    const pdfFile = path.join(dir, 'Roller 18 log book.pdf'); fs.writeFileSync(pdfFile, Buffer.from(await pd.save()));
    await F.evaluate(() => { $('mti_file').value = ''; }); await inp.uploadFile(pdfFile);
    for (let i = 0; i < 60 && !(await F.evaluate(() => !!(S.mli && S.mli.name === 'Roller 18 log book.pdf' && S.mli.fix && !S.mli.fix.busy))); i++) await wait(400);
    const pr = await F.evaluate(() => ({ name: $('mti_name').textContent, sheets: S.mli.sheets.map(x => [x.sheet, x.no, x.rows, x.bills.map(b => b.rows + ':' + b.date + ':' + b.garage + ':' + b.km + ':' + b.lines.map(l => l.work + ':' + l.amount + ':' + l.gstAmt).join('+')).join(' | ')]) }));
    const lg2 = (await aiSay('/__log')).filter(x => x.kind === 'document');
    ok('2. a PDF of 2 pages read by the AI a page a call: page 1 its headings in another order – "Kilometre" by the AI\'s word (the reading); page 2 going on without its heading – read in page 1\'s headings (sent with it); one bill of 2 lines, put to ' + R,
      /Roller 18 log book\.pdf – 1 sheet\(s\)/.test(pr.name) && JSON.stringify(pr.sheets) === JSON.stringify([['ROLLER NO-18', R, 2, 'Line 1–2:2024-01-29:Ganesh Motors:1745:HYDROLIC OIL:10374:1867.32+GREASE:360:64.8']]) &&
      lg2.length === 2 && lg2[0].carry === '' && lg2[1].carry === JSON.stringify(['Bill Date', 'Supplier', 'Current Reading', 'Item Description', 'Qty', 'Uom', 'Rate', 'Taxable', 'CGST 9%', 'SGST 9%', 'Net Amount']) && /Its columns can be in ANY ORDER/.test(lg2[0].ask), [pr, lg2.map(x => [x.read, x.carry])]);
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 40 && !(await F.evaluate(() => S.mli.sheets[0].res)); i++) await wait(400);
    await wait(300);
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 40 && sql('rcl', 'select count(*) from maintenance') !== '3'; i++) await wait(500);
    await wait(1200);
    const r3 = sql('rcl', "select id || '|' || to_char(date, 'YYYY-MM-DD') || '|' || garage || '|' || coalesce(km_reading::text, '') || '|' || amount from maintenance where id = 'MT-000003'");
    ok('   Import: MT-000003 – 29-01-2024, Ganesh Motors, 1745, ₹12,666.12', r3 === 'MT-000003|2024-01-29|Ganesh Motors|1745|12666.12', r3);
    // ---- 3. the log book: each line its Edit · Delete ----
    await tidy();
    await F.evaluate(r => { $('ml_no').value = r; $('ml_all').checked = true; $('ml_all').dispatchEvent(new Event('change')); $('ml_go').click(); }, R);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden && S.rp && S.rp.mlog && S.rp.mlog.d.all)); i++) await wait(400);
    await wait(600);
    // (update-182) Edit · Delete in the Action column at the end of each entry – no buttons under the Party Name / the Particulars
    const lk = await F.evaluate(() => ({ lines: [...document.querySelectorAll('#rpmlog_body tr[data-mll]')].map(tr => tr.dataset.mlid + '#' + tr.dataset.mll + ' ' + [...tr.querySelectorAll('td.mc')].pop().textContent + ' [' + [...tr.querySelectorAll('.mlog-actd button')].filter(x => !x.dataset.mlfv).map(x => x.textContent).join('/') + ']'),
      bills: document.querySelectorAll('#rpmlog_body .mlog-act, #rpmlog_body .mlog-lact').length, th: [...document.querySelectorAll('#rpmlog_body table[data-sheet="Log Book"] thead th')].pop().textContent, html: /mlog-actd|>Edit</.test(S.rp.mlog.v.html) }));
    ok('3. the log book of ' + R + ': each of its 5 lines has its own Edit · Delete in the Action column at its end (update-182 – none under the Party Name or the Particulars); not in the print / Excel',
      JSON.stringify(lk.lines) === JSON.stringify(['MT-000001#0 AD BLUE [Edit/Delete]', 'MT-000002#0 FUEL FILTER [Edit/Delete]', 'MT-000002#1 ENGINE OIL FILTER [Edit/Delete]', 'MT-000003#0 HYDROLIC OIL [Edit/Delete]', 'MT-000003#1 GREASE [Edit/Delete]']) &&
      lk.bills === 0 && lk.th === 'Action' && lk.html === false, lk);
    await F.evaluate(() => $('rpmlog_out').scrollIntoView({ block: 'start' })); await wait(400);
    await mp.screenshot({ path: path.join(SHOT, 'mline180_logbook.png') });
    const line = (id, i) => '#rpmlog_body [data-mlid="' + id + '"][data-mll="' + i + '"]';
    // a line changed in its box: Qty 1 → 2 – its ₹ from Qty × Rate
    await F.evaluate(s => document.querySelector(s + ' [data-mlle]').click(), line('MT-000002', 0)); await wait(900);
    const bx = await F.evaluate(() => ({ title: $('cf_title').textContent, v: ['mll_w', 'mll_t', 'mll_q', 'mll_u', 'mll_r', 'mll_d', 'mll_a', 'mll_g', 'mll_ga'].map(id => $(id) ? $(id).value : null), sum: $('mll_sum').textContent, note: document.querySelector('#cf_msg p').textContent }));
    ok('   Edit of FUEL FILTER: its box – Particulars, Paid by, Qty, Uom, Rate, Disc %, Amount as saved, (update-183) no GST %, its GST ₹ as in the old log book (117); "line 1 of 2. The other lines of the bill stay as they are."',
      bx.title === 'Change this line – ' + R && JSON.stringify(bx.v) === JSON.stringify(['FUEL FILTER', 'Paid', '1', 'Nos', '650', '', '650', '', '117']) && bx.sum === 'GST ₹117.00 · Amount with GST ₹767.00' &&
      bx.note === 'Bill MT-000002 · 05-01-2023 · Store – line 1 of 2. The other lines of the bill stay as they are.', bx);
    await F.evaluate(() => { const q = $('mll_q'); q.value = '2'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(300);
    const bx2 = await F.evaluate(() => ({ a: $('mll_a').value, sum: $('mll_sum').textContent }));
    await mp.screenshot({ path: path.join(SHOT, 'mline180_edit.png') });
    await F.evaluate(() => $('cf_ok').click());
    for (let i = 0; i < 30 && (bill('MT-000002') || {}).amount !== 2514.4; i++) await wait(400);
    await wait(300);
    const t1 = await toastNow(); await wait(2200);
    const b2 = bill('MT-000002');
    const shown = await F.evaluate(() => { const x = S.rp.mlog.d.lines.find(y => y.id === 'MT-000002'); return x ? [x.amount, x.lines.map(l => l.work + ':' + l.qty + ':' + l.amount).join(', ')] : null; });
    ok('   Qty 2: its ₹ 1,300 (Qty × Rate) – (update-183) its GST ₹117 as in the old log book stays, with GST ₹1,417; Save: "Line saved – bill MT-000002 is now ₹2,514.40."; only that line changed (the engine oil filter as it was); the log book shown again',
      bx2.a === '1300' && bx2.sum === 'GST ₹117.00 · Amount with GST ₹1,417.00' && /Line saved – bill MT-000002 is now ₹2,514\.40\./.test(t1) && b2 && b2.amount === 2514.4 &&
      JSON.stringify(b2.lines) === JSON.stringify([{ work: 'FUEL FILTER', type: 'Paid', amount: 1300, qty: 2, uom: 'Nos', rate: 650, gstAmt: 117 }, { work: 'ENGINE OIL FILTER', type: 'Paid', amount: 930, qty: 1, uom: 'Nos', rate: 930, gstAmt: 167.4 }]) &&
      JSON.stringify(shown) === JSON.stringify([2514.4, 'FUEL FILTER:2:1300, ENGINE OIL FILTER:1:930']), [bx2, t1, b2, shown]);
    // a line changed by someone else meanwhile: refused in its box (nothing saved)
    const other = await J('updateMaintLine', 'MT-000003', { i: 1, date: '2024-01-29', was: { work: 'GREASE', amount: 360 }, line: { work: 'GREASE MP3', type: 'Paid', qty: 2, uom: 'Kg', rate: 180, amount: 360, gst: '', gstAmt: 64.8 } });      // (update-183: an app of now sends its GST ₹ as in the old log book)
    await wait(1500);
    const stillOld = await F.evaluate(s => document.querySelector(s) ? [...document.querySelector(s).querySelectorAll('td.mc')].pop().textContent : '', line('MT-000003', 1));
    await tidy();
    await F.evaluate(s => document.querySelector(s + ' [data-mlle]').click(), line('MT-000003', 1)); await wait(900);
    await F.evaluate(() => { const r = $('mll_r'); r.value = '200'; r.dispatchEvent(new Event('input', { bubbles: true })); $('cf_ok').click(); }); await wait(2500);
    const st = await F.evaluate(() => ({ open: !$('cf_back').hidden, err: (document.querySelector('#cf_msg p.neg') || {}).textContent || '', rate: $('mll_r') ? $('mll_r').value : '' }));
    await F.evaluate(() => $('cf_cancel').click()); await wait(500);
    const b3 = bill('MT-000003');
    ok('   a line changed by someone else after the log book was shown (GREASE → GREASE MP3): its Save refused in the box – "Bill MT-000003 was changed meanwhile – show the log book again, then change its line." (what was typed kept); nothing saved',
      other && other.ok && stillOld === 'GREASE' && st.open && st.err === 'Bill MT-000003 was changed meanwhile – show the log book again, then change its line.' && st.rate === '200' && b3.lines[1].work === 'GREASE MP3' && b3.lines[1].rate === 180, [other, stillOld, st, b3 && b3.lines]);
    // a line deleted
    await F.evaluate(() => mlogShow()); await wait(1500); await tidy();
    await F.evaluate(s => document.querySelector(s + ' [data-mlld]').click(), line('MT-000002', 1)); await wait(800);
    const dq = await F.evaluate(() => ({ title: $('cf_title').textContent, ok: $('cf_ok').textContent, items: [...document.querySelectorAll('#cf_msg li')].map(li => li.textContent) }));
    await F.evaluate(() => $('cf_ok').click());
    for (let i = 0; i < 30 && (bill('MT-000002') || { lines: [1, 2] }).lines.length !== 1; i++) await wait(400);
    await wait(300); const t2 = await toastNow(); await wait(2200);
    const b2b = bill('MT-000002');
    ok('   Delete of ENGINE OIL FILTER: asked ("Delete this line?" – the line with its ₹, the bill, "The other lines of the bill stay as they are."); deleted – the bill ₹1,417 with its fuel filter; "Line deleted – bill MT-000002 is now ₹1,417.00."',
      dq.title === 'Delete this line?' && dq.ok === 'Delete' && JSON.stringify(dq.items) === JSON.stringify(['ENGINE OIL FILTER – ₹1,097.40', 'Bill MT-000002 · 05-01-2023 · Store', 'The other lines of the bill stay as they are.']) &&
      b2b && b2b.amount === 1417 && b2b.lines.map(l => l.work).join() === 'FUEL FILTER' && /Line deleted – bill MT-000002 is now ₹1,417\.00\./.test(t2), [dq, b2b, t2]);
    // the only line of a bill: the whole bill (said first)
    await tidy();
    await F.evaluate(s => document.querySelector(s + ' [data-mlld]').click(), line('MT-000001', 0)); await wait(800);
    const oq = await F.evaluate(() => ({ title: $('cf_title').textContent, ok: $('cf_ok').textContent, p: (document.querySelector('#cf_msg p') || {}).textContent }));
    await F.evaluate(() => $('cf_ok').click());
    for (let i = 0; i < 30 && bill('MT-000001'); i++) await wait(400);
    await wait(2500);
    const left = await F.evaluate(() => ({ bills: S.rp.mlog.d.total.maint.bills, lines: document.querySelectorAll('#rpmlog_body [data-mll]').length }));
    ok('   Delete of the only line of MT-000001 (AD BLUE): "Delete bill MT-000001?" – "…is the only line of this bill – the whole bill is deleted."; the bill deleted; the log book: 2 bills, 3 lines',
      oq.title === 'Delete bill MT-000001?' && oq.ok === 'Delete the bill' && oq.p === '"AD BLUE" is the only line of this bill – the whole bill is deleted.' && !bill('MT-000001') && left.bills === 2 && left.lines === 3, [oq, left]);
    // View only: no Edit / Delete
    // (the page's heartbeat may put the real access back while the log book is asked – then the check is made again)
    const vo = await F.evaluate(async () => { for (let i = 0; i < 5; i++) { const u = S.user, keep = { admin: u.admin, perms: u.perms }; u.admin = false; u.perms = Object.assign({}, u.perms, { Maintenance: 'View' });
      try { await mlogShow(); if (S.user !== u || u.perms.Maintenance !== 'View') continue; return { lact: document.querySelectorAll('#rpmlog_body .mlog-actd').length, act: document.querySelectorAll('#rpmlog_body .mlog-acth').length, lines: document.querySelectorAll('#rpmlog_body [data-mll]').length }; }
      finally { u.admin = keep.admin; u.perms = keep.perms; await mlogShow(); } } return { again: 5 }; });
    ok('   a user with Maintenance View only: the log book without any Edit / Delete', vo.lact === 0 && vo.act === 0 && vo.lines === 3, vo);
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl', "delete from maintenance; delete from master where id = '" + R + "'; delete from web.props where key = 'MNT_LAST_NO'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: S1 back to ' + sql('rcl', 'select count(*) from maintenance') + ' bills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
