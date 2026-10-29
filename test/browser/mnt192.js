// update-192 (asked 29-10-2026: "old log book mi jewa first time kontya hi machinehe upload krayla jail mg te pdf aso ki excel tewa as it
// is sagle aahe as yeyla ahw app swtaat tewa kahich nahi akrnar fkt spelling crrect krel te hi fkt iteam che je material issue zalel asel
// tyach ani heading ekde tikde astil tr heading match krel ok baki amount madhe jara pn changes hoyla nko" and "maintanace log bokk je aahet
// status made multiple delet option pn de ek ek select krun ek sathi mi delet kru shaku") – on the local rig in claude mode (PORTAL=1,
// RCLSTEPS=1): site S1 (database rcl, step 1zi run). Test data only (made here – not his data).
//   1. an Excel in another column order, with what old files have: an amount typed "1,250/-", a GST kept 56.25 but shown 56, a Qty
//      "2 Nos", an oil named TOTAL QUARTZ, a Sub Total row, two bills of one day with their own bill no.s, a row of only its date and
//      party, an amount without Particulars, a line without an Amount – every amount kept as the file shows it; File total = Total
//   2. the AI's names: a party and an item given – only the item listed; ticked: only that item changed
//   3. a sheet with an amount that is not a number: said, not checked, not imported (the other sheet is)
//   4. "Log book status": the Admin ticks two log books → "Delete selected (2)" → DELETE typed → both deleted, the third stays; a wrong
//      word – nothing deleted; a log book changed meanwhile – not deleted, said; not the Admin – no ticks
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt192.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const XLSX = require('xlsx');
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1800) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp', AI = 'http://127.0.0.1:3998';
const aiSay = async (p, body) => (await fetch(AI + p, { method: /^\/__(log|clear|busy)/.test(p) ? 'GET' : 'POST', body: /^\/__(log|clear|busy)/.test(p) ? undefined : body, signal: AbortSignal.timeout(10000) })).json();
const R = 'RL-192', J2 = 'JCB-192', K = 'TR-192';
(async () => {
  const errs = []; let b = null, cookie = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const bills = no => sql('rcl', "select count(*) from maintenance where machinery = '" + no + "'");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnt192-'));
  try {
    const n0 = sql('rcl', 'select count(*) from maintenance');
    ok('start: S1 (rcl) has step 1zi and no bill', n0 === '0', n0);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01';
    const ms = [[R, 'Roller No.192', 'Soil Compactor'], [J2, 'JCB 192', 'JCB'], [K, 'Tractor 192', 'Tractor']].map(([no, name, type]) => J('saveMaster', { no: no, name: name, type: type, unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add'));
    const mres = await Promise.all(ms);
    ok('three Own machinery (a roller – its old log book; a JCB and a tractor – their bills, for the status)', mres.every(x => !x.ERROR), mres);
    // ---- 1. his Excel, as old files are ----
    const head = ['Sr No', 'Date', 'Bill No', 'Party Name', 'Current Reading', 'Particulars', 'Qty', 'Uom', 'Basic Rate', 'Amount', 'GST Amount', 'Amount With GST', 'Total'];      // (another order: Bill No third)
    const roller = [['Rachana Construction Limited'], ['ROLLER NO-192'], head,
      [1, '05-01-2023', 'B-101', 'SURJ', 500, 'TOTAL QUARTZ 15W40', 5, 'Ltr', 250, '1,250/-', 225, '1,475/-', ''],      // row 4: an oil named Total; amounts typed with "/-"
      [2, '', '', '', '', 'FILTER', '2 Nos', '', 156.25, 312.5, 56.25, 368.5, ''],                                     // row 5: its Qty with its unit; its GST kept 56.25, shown 56
      ['', '', '', '', '', 'Sub Total', '', '', '', 1562.5, 281, 1843.5, ''],                                            // row 6: the bill's Sub Total
      [3, '05-01-2023', 'B-102', 'SURJ', 500, 'GREASE', 1, 'Kg', 200, 200, 36, 236, ''],                                 // row 7: the same day and party – another bill no.
      ['', '10-02-2023', '', 'GANESH', 620, '', '', '', '', '', '', '', ''],                                              // row 8: only its date / party / reading
      ['', '', '', '', '', 'BRAKE PAD', 2, 'Nos', 800, 1600, 288, 1888, ''],                                              // row 9: its line
      ['', '', '', '', '', '', '', '', '', 100, 18, 118, ''],                                                             // row 10: an amount without Particulars
      ['', '', '', '', '', 'BULB', 2, 'Nos', 40, '', '', '', '']];                                                        // row 11: no Amount in the file
    const ws = XLSX.utils.aoa_to_sheet(roller);
    ws['K5'].z = '0'; ws['L5'].z = '0.00'; ws['J5'].z = '0.00';      // (the GST shown as whole rupees: 56; the amount 312.50, with GST 368.50)
    const bad = [['Rachana Construction Limited'], ['TRACTOR 192'], head, [1, '07-03-2023', '', 'Store', 10, 'TYRE', 1, 'Nos', 300, 'three hundred', '', '', '']];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Roller 192'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bad), 'Tractor 192');
    const file = path.join(dir, 'Old log book 192.xlsx'); XLSX.writeFile(wb, file);
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
    await aiSay('/__names', JSON.stringify({ fixes: [['party', 'SURJ', 'SURAJ'], ['work', 'TOTAL QUARTZ 15W40', 'TOTAL QUARTZ 15W-40'], ['uom', 'Nos', 'NOS']] }));
    await F.evaluate(() => $('ml_imp').click()); await wait(400);
    const inp = await F.$('#mti_file'); await inp.uploadFile(file);
    for (let i = 0; i < 40 && !(await F.evaluate(() => !!(S.mli && S.mli.fix && !S.mli.fix.busy))); i++) await wait(500);
    const rd = await F.evaluate(() => { const x = S.mli.sheets.find(s => s.sheet === 'Roller 192'); return { no: x.no, bills: x.bills.map(b => [b.rows, b.date, b.garage, b.km, b.billNo, b.lines.map(l => [l.work, l.qty, l.uom, l.amount, l.gstAmt === undefined ? '' : l.gstAmt])]),
      total: x.total, file: x.fileTotal, warn: (x.warn || []).map(w => w.k + ':' + w.line), shown: [...document.querySelectorAll('#mti_out tr')].map(tr => [...tr.cells].map(c => c.textContent.trim())).find(r => r[0] === 'Roller 192') }; });
    ok('1. read as it is: the oil named TOTAL kept, "1,250/-" = 1,250, the GST shown 56 is 56 (not its hidden 56.25), "2 Nos" = 2 Nos, the Sub Total left out, two bills of one day by their bill no., the date / party row given to its line, the amount without Particulars kept as "-", no Amount: ₹0',
      rd.no === R && JSON.stringify(rd.bills) === JSON.stringify([
        ['Line 4–5', '2023-01-05', 'SURJ', 500, 'B-101', [['TOTAL QUARTZ 15W40', 5, 'Ltr', 1250, 225], ['FILTER', 2, 'Nos', 312.5, 56]]],
        ['Line 7', '2023-01-05', 'SURJ', 500, 'B-102', [['GREASE', 1, 'Kg', 200, 36]]],
        ['Line 9–11', '2023-02-10', 'GANESH', 620, '', [['BRAKE PAD', 2, 'Nos', 1600, 288], ['-', '', '', 100, 18], ['BULB', 2, 'Nos', 0, '']]]]), rd);
    ok('   File total = Total (₹4,085.50 – the amounts with their GST as the file shows them); each row not imported as a line, or to look at, listed',
      rd.total === 4085.5 && rd.file === 4085.5 && rd.shown && rd.shown[5] === '4,085.50' && rd.shown[6] === '4,085.50' && JSON.stringify(rd.warn) === JSON.stringify(['tot:6', 'np:10', 'na:11']), rd);
    // ---- 2. the names: only the items ----
    const nm = await F.evaluate(() => ({ list: (S.mli.fix.list || []).map(z => z.f + ':' + z.from + '→' + z.to), head: (document.querySelector('#mti_out .mli-names h3') || {}).textContent, cols: [...document.querySelectorAll('#mti_out .mli-names thead th')].map(t => t.textContent) }));
    const asked = (await aiSay('/__log')).filter(x => x.names);
    ok('2. the AI\'s names: only the item (Particulars) listed – a party / a Uom it gave is not; only the items were asked', JSON.stringify(nm.list) === JSON.stringify(['work:TOTAL QUARTZ 15W40→TOTAL QUARTZ 15W-40']) && nm.head === 'Item names (Particulars) – spelling (AI)' && JSON.stringify(nm.cols) === JSON.stringify(['✓', 'In the file', 'Becomes', 'Rows']) && asked.length === 1 && /^work – the Particulars/.test(asked[0].ask) && !/SURJ|GANESH/.test(asked[0].ask), [nm, asked.map(a => a.ask.slice(0, 200))]);
    await F.evaluate(() => { const c = document.querySelector('#mti_out [data-mlf="0"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt192_import.png') });
    // ---- 3. the sheet whose amount is not a number ----
    await F.evaluate(() => { const i = S.mli.sheets.findIndex(s => s.sheet === 'Tractor 192'), sel = document.querySelector('#mti_out [data-mli="' + i + '"]'); sel.value = 'TR-192'; sel.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
    await F.evaluate(() => $('mti_check').click());
    for (let i = 0; i < 30 && !(await F.evaluate(() => !!(S.mli.sheets.find(s => s.sheet === 'Roller 192').res))); i++) await wait(400);
    const ck = await F.evaluate(() => ({ tr: S.mli.sheets.find(s => s.sheet === 'Tractor 192'), rl: S.mli.sheets.find(s => s.sheet === 'Roller 192').res, go: !$('mti_go').disabled,
      text: ([...document.querySelectorAll('#mti_out tr')].find(tr => tr.cells[0] && tr.cells[0].textContent.trim() === 'Tractor 192') || {}).textContent }));
    ok('3. a sheet with an amount that is not a number: said ("Amount "three hundred" is not a number"), not checked; the roller checked – 3 new bills', ck.tr.nums.length === 1 && !ck.tr.res && /1 amount\(s\) are not a number – put them right in the file; nothing of this sheet is imported:/.test(ck.text) && /Line 4 \(TYRE\): Amount "three hundred" is not a number/.test(ck.text) && ck.rl.ok && ck.rl.fresh === 3 && ck.rl.total === 4085.5 && ck.go, [ck.tr.nums, ck.rl, ck.go, ck.text]);
    await F.evaluate(() => $('mti_go').click()); await wait(800);
    await F.evaluate(() => { const okb = document.getElementById('cf_ok'); if (okb) okb.click(); });
    for (let i = 0; i < 30 && bills(R) !== '3'; i++) await wait(500);
    const kept = sql('rcl', "select string_agg(coalesce(bill_no, '') || ' ' || garage || ' ' || amount || ' ' || lines, ' | ' order by date, bill_no) from maintenance where machinery = '" + R + "'");
    ok('   imported – each bill with its bill no. and ₹ as the file shows them (1,843.50, 236, 2,006); the item ticked spelt so, the party as in the file (SURJ); "-" and the free BULB kept; the tractor nothing',
      bills(R) === '3' && bills(K) === '0' && /^B-101 SURJ 1843\.5 /.test(kept) && /"work":"TOTAL QUARTZ 15W-40"[^}]*"amount":1250[^}]*"gstAmt":225/.test(kept) && /"work":"FILTER"[^}]*"amount":312\.5[^}]*"gstAmt":56\b/.test(kept) &&
      /B-102 SURJ 236 /.test(kept) && / GANESH 2006 /.test(kept) && /"work":"-"[^}]*"amount":100[^}]*"gstAmt":18/.test(kept) && /"work":"BULB","type":"FOC","amount":0/.test(kept) && !/SURAJ|"gst":/.test(kept), kept);
    await F.evaluate(() => $('mti_x').click()); await tidy();
    // ---- 4. the status: two log books deleted together ----
    const sv = await Promise.all([J('saveMaint', { date: d1, no: J2, garage: 'Shri Motors', lines: [{ work: 'OIL', type: 'Paid', amount: 500 }] }), J('saveMaint', { date: d1, no: J2, garage: 'Shri Motors', billNo: 'X2', lines: [{ work: 'FILTER', type: 'Paid', amount: 300 }] }), J('saveMaint', { date: d1, no: K, garage: 'Shri Motors', lines: [{ work: 'TYRE', type: 'Paid', amount: 9000 }] })]);
    ok('   the JCB: 2 bills, the tractor: 1 bill (saved here for the status)', sv.every(x => x && x.ok) && bills(J2) === '2' && bills(K) === '1', sv);
    await F.evaluate(() => $('ml_stbtn').click());
    for (let i = 0; i < 30 && await F.evaluate(() => $('ml_stbox').hidden); i++) await wait(300);
    await wait(500);
    const tick = (nos) => F.evaluate(ns => { ns.forEach(no => { const c = document.querySelector('#ml_strows [data-mlsd="' + no + '"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); }, nos);
    const st0 = await F.evaluate(() => ({ ck: [...document.querySelectorAll('#ml_strows [data-mlsd]')].map(c => c.dataset.mlsd).filter(n => /192$/.test(n)), th: !document.querySelector('#ml_stbox th.ml-stck').hidden, btn: [$('ml_stdel').hidden, $('ml_stdel').disabled, $('ml_stdel').textContent] }));
    await tick([R, J2]); await wait(200);
    const st1 = await F.evaluate(() => [$('ml_stdel').disabled, $('ml_stdel').textContent]);
    ok('4. "Log book status" (the Admin): a ✓ for each log book with bills; "Delete selected" – after two ticks "Delete selected (2)"', JSON.stringify(st0.ck.sort()) === JSON.stringify([J2, R, K].sort()) && st0.th && JSON.stringify(st0.btn) === JSON.stringify([false, true, 'Delete selected']) && JSON.stringify(st1) === JSON.stringify([false, 'Delete selected (2)']), [st0, st1]);
    await F.evaluate(() => $('ml_stbox').scrollIntoView({ block: 'start' })); await wait(300);
    await F.evaluate(() => $('ml_stdel').click()); await wait(700);
    const dlg = await F.evaluate(() => ({ text: $('cf_msg').textContent, ok: $('cf_ok').textContent }));
    await mp.screenshot({ path: path.join(SHOT, 'mnt192_confirm.png') });
    await F.evaluate(() => { $('mld_t').value = 'DEL'; $('cf_ok').click(); }); await wait(900);
    const t1 = await toastNow();
    ok('   said first: each with its bills, dates and ₹ (the roller 3 bills ₹4,085.50, the JCB 2 bills ₹800); a wrong word – "Not deleted – type DELETE to confirm.", nothing deleted',
      /The whole maintenance log book of these 2 machinery – 5 bill\(s\), ₹4,885\.50 – is deleted:/.test(dlg.text) && dlg.text.indexOf(R + ' – 3 bill(s), 05-01-2023 to 10-02-2023, ₹4,085.50') > -1 && dlg.text.indexOf(J2 + ' – 2 bill(s)') > -1 && dlg.ok === 'Delete 5 bill(s)' &&
      /Not deleted – type DELETE to confirm\./.test(t1) && bills(R) === '3' && bills(J2) === '2', [dlg, t1]);
    await tidy();
    await F.evaluate(() => $('ml_stdel').click()); await wait(700);
    await F.evaluate(() => { $('mld_t').value = 'delete'; $('cf_ok').click(); });
    for (let i = 0; i < 30 && (bills(R) !== '0' || bills(J2) !== '0'); i++) await wait(400);
    await wait(1200);
    const st2 = await F.evaluate(() => ({ toast: (document.getElementById('toast') || {}).textContent, rows: [...document.querySelectorAll('#ml_strows tr')].map(tr => [...tr.cells].map(c => c.textContent.trim())).filter(r => /192$/.test(r[2])).map(r => r[2] + ':' + r[8]), btn: $('ml_stdel').textContent, sel: Object.keys(S.mlsel || {}) }));
    let logged = '0'; for (let i = 0; i < 20 && Number(logged) < 5; i++) { logged = sql('rcl', "select count(*) from activity_log where summary like '%the Maintenance Log Book of " + R + " deleted%' or summary like '%the Maintenance Log Book of " + J2 + " deleted%'"); if (Number(logged) < 5) await wait(500); }
    ok('   DELETE typed: both log books deleted (the roller\'s 3 bills, the JCB\'s 2), the tractor\'s stays; "2 log book(s) deleted."; the status read again – the two "Not added yet", no tick left; each bill in the Activity Log',
      bills(R) === '0' && bills(J2) === '0' && bills(K) === '1' && /2 log book\(s\) deleted\./.test(st2.toast) && st2.rows.indexOf(R + ':Not added yet') > -1 && st2.rows.indexOf(J2 + ':Not added yet') > -1 && st2.rows.some(r => r.indexOf(K + ':✓ Up to') === 0) && st2.btn === 'Delete selected' && st2.sel.length === 0 && Number(logged) >= 5, [st2, logged]);
    // a log book changed meanwhile: not deleted, said
    await tick([K]); await wait(200);
    const more = await J('saveMaint', { date: d1, no: K, garage: 'Shri Motors', billNo: 'X3', lines: [{ work: 'BULB', type: 'Paid', amount: 40 }] });
    await F.evaluate(() => $('ml_stdel').click()); await wait(700);
    await F.evaluate(() => { $('mld_t').value = 'DELETE'; $('cf_ok').click(); }); await wait(2500);
    const left = await F.evaluate(() => ({ title: $('cf_title').textContent, text: $('cf_msg').textContent }));
    ok('   a log book changed meanwhile (a bill added after the status was shown): not deleted – "0 deleted, 1 not deleted", why', more.ok && bills(K) === '2' && left.title === '0 deleted, 1 not deleted' && left.text.indexOf('The log book of ' + K + ' was changed meanwhile (2 bill(s) now, 1 shown)') > -1, [more, left]);
    await tidy();
    // not the Admin: no ticks, no "Delete selected"
    const na = await F.evaluate(() => { const a = S.user.admin; S.user.admin = false; mlStatusPaint(); const r = { th: document.querySelector('#ml_stbox th.ml-stck').hidden, td: document.querySelectorAll('#ml_strows .ml-stck').length, btn: $('ml_stdel').hidden }; S.user.admin = a; mlStatusPaint(); return r; });
    ok('   not the Admin / Super Admin: no ✓, no "Delete selected" (the server refuses it too – deleteMaintLog is the Admin\'s)', na.th && na.td === 0 && na.btn, na);
    await F.evaluate(() => $('ml_stbox').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt192_status.png') });
    ok('no error in the page', errs.length === 0, errs);
  } catch (e) { fail++; out.push('FAIL the test stopped: ' + (e && e.stack || e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
  console.log(out.join('\n')); console.log('TOTAL ' + pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/mnt192.out', ''); process.exit(fail ? 1 : 0);
})();
