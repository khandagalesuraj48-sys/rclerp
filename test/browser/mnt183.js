// update-183 (asked 28-10-2026: "auto gst ka add krt aahet kuthe 6 kuth 2.5 tr kuthe 14 as nko karu … old import tyat tr ajibat karu nko as
// it is rahude … kadhi kadhi ai service slow asa pn error ywto te pn fix krun de … konte vichle / asset ch maintanace log book add aahe
// kadhi prynt updeted aahe konte ch baki aahe … show dable ki distey but prt hide pn krta yaw") – on the local rig in claude mode
// (PORTAL=1, RCLSTEPS=1): site S1 (database rcl, step 1zi run). Test data only (made here – not his data).
//   1. his Excel of a roller whose GST is 12 %, 5 % and 28 % on its lines: imported with each line's GST ₹ as in the file (no GST %
//      made from it); the log book: no CGST / SGST % columns – the ₹ in "GST Amount"; the totals as in the file
//   2. a line's Edit: its GST ₹ (as in the old log book) shown and changed; the whole bill in the form: the GST ₹ kept when saved
//   3. "Log book status": the Own machinery without a bill first (Not added yet), the roller up to its last bill; its Show opens the log
//      book; "Hide log book" hides it; the status hidden again
//   4. a PDF page read in parts (at most 25 rows an answer, then the rows after the last one); the AI busy: asked again by itself;
//      busy all the time: stopped – "Continue reading" goes on from that page
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt183.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const XLSX = require('xlsx');
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1500) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp', AI = 'http://127.0.0.1:3998';
const aiSay = async (p, body) => (await fetch(AI + p, { method: /^\/__(log|clear|busy)/.test(p) ? 'GET' : 'POST', body: /^\/__(log|clear|busy)/.test(p) ? undefined : body, signal: AbortSignal.timeout(10000) })).json();
const R = 'RL-183', J2 = 'JCB-183';
(async () => {
  const errs = []; let b = null, cookie = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const n0 = sql('rcl', 'select count(*) from maintenance');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnt183-'));
  try {
    ok('start: S1 (rcl) has step 1zi and no bill', n0 === '0', n0);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01';
    const m1 = await J('saveMaster', { no: R, name: 'Roller No.03', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add');
    const m2 = await J('saveMaster', { no: J2, name: 'JCB 183', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add');
    ok('two Own machinery: the roller (its old log book) and a JCB (none yet)', !m1.ERROR && !m2.ERROR, [m1, m2]);
    const head = ['Sr No', 'Date', 'Party Name', 'Current Reading', 'Particulars', 'Qty', 'Uom', 'Basic Rate', 'Amount', 'GST Amount', 'Amount With GST', 'Total'];
    const roller = [['', '', '', 'Rachana Construction Limited'], ['', '', '', 'ROLLER NO-03'], head,
      [1, '05-01-2023', 'Store', 500, 'FUEL FILTER', 1, 'Nos', 650, 650, 78, 728, 728],          // 12 %
      [2, '', '', '', 'BULB', 4, 'Nos', 40, 160, 8, 168, 168],                                  // 5 %
      [3, '18-01-2023', 'Store', 611, 'TYRE', 1, 'Nos', 10000, 10000, 2800, 12800, 12800]];       // 28 %
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(roller), 'Roller 03');
    const file = path.join(dir, 'Roller 03 log book.xlsx'); XLSX.writeFile(wb, file);
    // a one-page PDF (the AI's answers come from the stand-in)
    const PL = require(path.join(__dirname, '..', '..', 'app', 'vendor', 'pdf-lib-1.17.1.min.js')), pd = await PL.PDFDocument.create();
    pd.addPage([842, 595]).drawText('MAINTENANCE LOG BOOK – JCB 183', { x: 40, y: 540, size: 18, font: await pd.embedFont(PL.StandardFonts.Helvetica) });
    const pdfFile = path.join(dir, 'JCB log book.pdf'); fs.writeFileSync(pdfFile, Buffer.from(await pd.save()));
    // ---- 1. the import as it is ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(4500);
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); await wait(300); };
    const toastNow = () => F.evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
    await F.evaluate(() => showTab('mnt')); await wait(2500); await tidy();
    for (let i = 0; i < 30 && !(await F.evaluate(() => typeof XLSX !== 'undefined')); i++) await wait(500);
    await aiSay('/__clear');
    await F.evaluate(() => $('ml_imp').click()); await wait(400);
    const inp = await F.$('#mti_file'); await inp.uploadFile(file);
    for (let i = 0; i < 40 && !(await F.evaluate(() => !!(S.mli && S.mli.fix && !S.mli.fix.busy))); i++) await wait(500);
    const rd = await F.evaluate(() => ({ lines: S.mli.sheets[0].bills.flatMap(x => x.lines.map(l => [l.work, l.amount, l.gst === undefined ? '' : l.gst, l.gstAmt === undefined ? '' : l.gstAmt])), total: S.mli.sheets[0].total, file: S.mli.sheets[0].fileTotal, no: S.mli.sheets[0].no,
      warn: (S.mli.sheets[0].warn || []).length }));
    ok('1. his Excel (GST 12 %, 5 % and 28 % on its lines) read: each line its GST ₹ as in the file, no GST % made; the total as the file\'s; nothing "to look at"',
      JSON.stringify(rd.lines) === JSON.stringify([['FUEL FILTER', 650, '', 78], ['BULB', 160, '', 8], ['TYRE', 10000, '', 2800]]) && rd.total === 13696 && rd.file === 13696 && rd.no === R && rd.warn === 0, rd);
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 30 && !(await F.evaluate(() => !!(S.mli.sheets[0].res))); i++) await wait(400);
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 30 && sql('rcl', "select count(*) from maintenance where machinery = '" + R + "'") !== '2'; i++) await wait(500);
    const kept = sql('rcl', "select string_agg(lines, ' | ' order by date) from maintenance where machinery = '" + R + "'");
    ok('   imported – saved as it is: its lines keep "gstAmt" (₹), no "gst" (%)', /"gstAmt":78/.test(kept) && /"gstAmt":8\b/.test(kept) && /"gstAmt":2800/.test(kept) && !/"gst":/.test(kept), kept);
    await F.evaluate(r => { $('mti_x').click(); $('ml_no').value = r; $('ml_all').checked = true; $('ml_all').dispatchEvent(new Event('change')); $('ml_go').click(); }, R);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden && S.rp && S.rp.mlog && S.rp.mlog.d.all)); i++) await wait(400);
    await wait(500); await tidy();
    const lb = await F.evaluate(() => { const tb = document.querySelector('#rpmlog_body table[data-sheet="Log Book"]');
      return { head: [...tb.querySelectorAll('thead th')].map(t => t.textContent).filter(t => /GST/.test(t)), rows: [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)),
        foot: [...tb.tFoot.rows[0].cells].map(c => c.textContent), hide: !$('ml_hide').hidden }; });
    const gi = lb.rows.length ? null : null;
    ok('   the log book: no CGST / SGST % columns ("GST Amount", "Amount With GST"); each line its GST ₹ as in the file; the total ₹13,696.00',
      JSON.stringify(lb.head) === JSON.stringify(['GST Amount', 'Amount With GST']) && lb.rows.some(r => r.includes('78.00') && r.includes('728.00')) && lb.rows.some(r => r.includes('8.00') && r.includes('168.00')) && lb.rows.some(r => r.includes('2,800.00') && r.includes('12,800.00')) && lb.foot.includes('13,696.00') && lb.hide, lb);
    await F.evaluate(() => $('rpmlog_out').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt183_logbook.png') });
    // ---- 2. a line's Edit; the whole bill ----
    await F.evaluate(() => [...document.querySelectorAll('#rpmlog_body tr[data-mll]')].find(tr => /BULB/.test(tr.textContent)).querySelector('[data-mlle]').click()); await wait(900);
    const box = await F.evaluate(() => ({ ga: $('mll_ga') ? $('mll_ga').value : null, g: $('mll_g').value, sum: $('mll_sum').textContent }));
    await F.evaluate(() => { $('mll_ga').value = '9'; $('mll_ga').dispatchEvent(new Event('input', { bubbles: true })); $('cf_ok').click(); });
    for (let i = 0; i < 30 && !/"work":"BULB"[^}]*"gstAmt":9\b/.test(sql('rcl', "select lines from maintenance where machinery = '" + R + "' and date = '2023-01-05'")); i++) await wait(400);
    const after = sql('rcl', "select lines || ' ₹' || amount from maintenance where machinery = '" + R + "' and date = '2023-01-05'");
    ok('2. a line\'s Edit: its "GST ₹ (as in the old log book)" 8 (no GST %), "GST ₹8.00 · Amount with GST ₹168.00"; changed to 9 – saved as 9 (the bill ₹897)',
      box.ga === '8' && box.g === '' && box.sum === 'GST ₹8.00 · Amount with GST ₹168.00' && /"work":"BULB"[^}]*"gstAmt":9\b/.test(after) && / ₹897$/.test(after), [box, after]);
    await tidy(); await wait(1500);
    await F.evaluate(() => [...document.querySelectorAll('#rpmlog_body tr[data-mll]')].find(tr => /FUEL FILTER/.test(tr.textContent)).querySelector('[data-mlle]').click()); await wait(900);
    await F.evaluate(() => $('mll_bill').click()); await wait(2500);
    const fm = await F.evaluate(() => [...document.querySelectorAll('#mt_lines tr')].filter(tr => tr.querySelector('.mt-w').value).map(tr => [tr.querySelector('.mt-w').value, tr.querySelector('.mt-g').value, tr.querySelector('.mt-gv').textContent, tr.dataset.ga || '']));
    await F.evaluate(() => { $('mt_remark').value = 'checked 183'; $('mt_save').click(); });
    for (let i = 0; i < 30 && sql('rcl', "select coalesce(remark, '') from maintenance where machinery = '" + R + "' and date = '2023-01-05'") !== 'checked 183'; i++) await wait(400);
    const saved2 = sql('rcl', "select lines from maintenance where machinery = '" + R + "' and date = '2023-01-05'");
    ok('   the whole bill in the form: its GST ₹ shown (no %); saved – each line keeps its GST ₹', JSON.stringify(fm) === JSON.stringify([['FUEL FILTER', '', '78.00', '78'], ['BULB', '', '9.00', '9']]) && /"gstAmt":78/.test(saved2) && /"gstAmt":9\b/.test(saved2) && !/"gst":/.test(saved2), [fm, saved2]);
    await F.evaluate(() => mtClear());
    // ---- 3. the log book status; Hide ----
    await tidy();
    await F.evaluate(() => $('ml_stbtn').click());
    for (let i = 0; i < 30 && await F.evaluate(() => $('ml_stbox').hidden); i++) await wait(300);
    await wait(500);
    const st = await F.evaluate(() => ({ btn: $('ml_stbtn').textContent, sum: $('ml_stsum').textContent, rows: [...document.querySelectorAll('#ml_strows tr')].map(tr => [...tr.cells].map(c => c.textContent.trim())).filter(r => /183/.test(r[1])) }));
    ok('3. "Log book status": the JCB first – "Not added yet"; the roller – 2 bills, 05-01-2023 to 18-01-2023, "✓ Up to 18-01-2023"; the button "Hide log book status"',
      st.btn === 'Hide log book status' && /\d+ added · \d+ not added yet/.test(st.sum) && st.rows.length === 2 && st.rows[0][1] === J2 && st.rows[0][7] === 'Not added yet' && st.rows[1][1] === R && st.rows[1][3] === '2' && st.rows[1][4] === '05-01-2023' && st.rows[1][5] === '18-01-2023' && st.rows[1][7] === '✓ Up to 18-01-2023', st);
    await F.evaluate(() => $('ml_stbox').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt183_status.png') });
    await F.evaluate(() => { $('ml_stf').value = 'none'; $('ml_stf').dispatchEvent(new Event('change')); });
    const only = await F.evaluate(() => [...document.querySelectorAll('#ml_strows tr')].map(tr => tr.cells[7] ? tr.cells[7].textContent.trim() : '').filter(Boolean));
    ok('   Show "Not added yet": only those', only.length > 0 && only.every(t => t === 'Not added yet'), only);
    await F.evaluate(() => { $('ml_stf').value = 'all'; $('ml_stf').dispatchEvent(new Event('change')); });
    await F.evaluate(() => { $('rpmlog_out').hidden = true; [...document.querySelectorAll('#ml_strows [data-mlsn]')].find(x => x.dataset.mlsn === 'RL-183').click(); });
    for (let i = 0; i < 30 && await F.evaluate(() => $('rpmlog_out').hidden); i++) await wait(300);
    const shown = await F.evaluate(() => ({ title: $('rpmlog_title').textContent, all: $('ml_all').checked }));
    await F.evaluate(() => $('ml_hide').click()); await wait(300);
    const hid = await F.evaluate(() => ({ out: $('rpmlog_out').hidden, btn: $('ml_hide').hidden }));
    await F.evaluate(() => $('ml_stx').click()); await wait(300);
    ok('   its Show: the roller\'s log book Start to end; "Hide log book" hides it (and itself); ✕ hides the status', shown.title === 'Maintenance Log Book – ' + R && shown.all && hid.out && hid.btn && await F.evaluate(() => $('ml_stbox').hidden && $('ml_stbtn').textContent === 'Log book status'), [shown, hid]);
    // ---- 4. a PDF page in parts; the AI busy ----
    const row = (n, w, a, g) => [n, '2023-03-0' + n, 'Store', 800 + n, w, 1, 'Nos', a, a, g, a + g, a + g];
    const ans = (more, rows) => JSON.stringify({ pages: 1, more: more, tables: [{ machinery: 'JCB 183', head: head, rows: rows }] });
    await aiSay('/__clear');
    await aiSay('/__next', ans(true, [row(1, 'GREASE', 360, 64.8)])); await aiSay('/__next', ans(false, [row(2, 'BUCKET TEETH', 1200, 216)]));
    await F.evaluate(() => $('ml_imp').click()); await wait(300);
    await F.evaluate(() => { $('mti_file').value = ''; }); await inp.uploadFile(pdfFile);
    for (let i = 0; i < 60 && !(await F.evaluate(() => !!(S.mli && S.mli.fix && !S.mli.fix.busy))); i++) await wait(500);
    const parts = (await aiSay('/__log')).filter(x => x.kind === 'document');
    const pr = await F.evaluate(() => S.mli ? S.mli.sheets.map(x => [x.sheet, x.bills.flatMap(y => y.lines.map(l => l.work + ':' + l.gstAmt))]) : null);
    ok('4. a PDF page read in parts: the first part "at most 25 rows" from the top, the next after the last row given; both rows in the sheet (their GST ₹ as given)',
      parts.length === 2 && parts[0].part === 25 && !parts[0].after && parts[1].part === 25 && parts[1].after && parts[1].kept === 'ephemeral' && JSON.stringify(pr) === JSON.stringify([['JCB 183', ['GREASE:64.8', 'BUCKET TEETH:216']]]), [parts.map(p => [p.model, p.part, p.after, p.kept]), pr]);
    // the AI busy: Sonnet and Haiku answer "overloaded" 3 times – asked again by itself
    await aiSay('/__clear'); await aiSay('/__busy?model=*&n=3'); await aiSay('/__next', ans(false, [row(1, 'GREASE', 360, 64.8)]));
    await F.evaluate(() => { $('mti_file').value = ''; }); await inp.uploadFile(pdfFile);
    for (let i = 0; i < 80 && !(await F.evaluate(() => !!(S.mli && S.mli.fix && !S.mli.fix.busy))); i++) await wait(500);
    const lg2 = await aiSay('/__log'), ok2 = await F.evaluate(() => !!(S.mli && S.mli.sheets.length === 1 && S.mli.sheets[0].bills.length === 1));
    ok('   the AI busy (overloaded 3 times): asked again by itself (the quicker model) – the page read', ok2 && lg2.filter(x => x.busy).length === 3 && lg2.filter(x => x.kind === 'document' && !x.busy).length === 1, lg2.map(x => [x.model, x.busy ? 'busy' : x.kind || '']));
    // busy all the time: stopped – what was read kept, "Continue reading" goes on from that page
    await aiSay('/__clear'); await aiSay('/__busy?model=*&n=40');
    await F.evaluate(() => { $('mti_file').value = ''; }); await inp.uploadFile(pdfFile);
    for (let i = 0; i < 160 && !(await F.evaluate(() => !$('mti_more').hidden)); i++) await wait(500);
    const t1 = await toastNow(), more = await F.evaluate(() => ({ shown: !$('mti_more').hidden, text: $('mti_more').textContent, name: $('mti_name').textContent }));
    await tidy(); await F.evaluate(() => $('mti_panel').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt183_continue.png') });
    ok('   busy all the time: stopped at page 1 – "… press "Continue reading" to go on from page 1."; the button "Continue reading (from page 1)"',
      more.shown && more.text === 'Continue reading (from page 1)' && /stopped at page 1/.test(more.name) && /press "Continue reading" to go on from page 1\./.test(t1), [more, t1]);
    await aiSay('/__clear'); await aiSay('/__next', ans(false, [row(1, 'GREASE', 360, 64.8)]));
    await F.evaluate(() => $('mti_more').click());
    for (let i = 0; i < 60 && !(await F.evaluate(() => !!(S.mli && S.mli.fix && !S.mli.fix.busy))); i++) await wait(500);
    const cont = await F.evaluate(() => ({ sheets: S.mli ? S.mli.sheets.length : 0, more: !$('mti_more').hidden }));
    ok('   "Continue reading": the page read – the button gone', cont.sheets === 1 && !cont.more, cont);
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    try { await aiSay('/__clear'); } catch (e) {}
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl', "delete from maintenance; delete from master where id in ('" + R + "', '" + J2 + "'); delete from web.props where key = 'MNT_LAST_NO'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: S1 back to ' + sql('rcl', 'select count(*) from maintenance') + ' bills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
