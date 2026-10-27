// update-170 (asked 27-10-2026 with the Maintenance Log Book of Roller No-03: "mala log book as hawa aahe ya format madhe ok ani ha
// party name jithun ty gadi sathi material issue hotey tyach naw asel … jr direct bill marle tr party ch name yeil"; his answers: every
// site, every machinery; the Store's provision, for now direct bills; the tax lines as now) – on the local rig started with PORTAL=1 and
// RCLSTEPS=1: site S1 (database rcl, steps 1zg / 1zh / 1zi run) plays VTR – diesel from stock, not on fuel cards. Test data only.
//   1. the server at S1: a roller on hours – its bill with the Uom of each line, its reading; the log book: the bills only (no fill)
//   2. the page at S1: Maintenance in the menu; the form (Machinery, Party name, Current reading (KM / Hrs), the Uom column); a bill
//      typed – the ₹ from Qty × Rate, the Uom kept; the log book in his format: Sr No · Date · Party Name · Current Reading · Particulars ·
//      Qty · Uom · Basic Rate · Amount · GST Amount · Amount With GST · Total; Date / Party / Reading once for a bill's rows; the tax lines
//      in GST Amount; the totals; no fuel table; Excel (merged cells)
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt170.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'); const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const R = 'ROLLER-03-170';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
  const linesOf = id => JSON.parse(sql('rcl', "select lines from maintenance where id = '" + id + "'") || '[]');
  try {
    ok('start: S1 (rcl) has step 1zi and no bill; it is not on fuel cards', n0 === '0' && sql('rcl', "select coalesce((select value from web.props where key = 'FUEL_MODE'), '')") !== 'card', n0);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const pagesOf = async site => { const r = await preq('/api/admin', { action: 'mechPages', site: site }); return (r.pages || r.modules || []).map(x => x.key || x); };
    const p1 = await pagesOf('S1');
    ok('the Portal\'s Users & Access → Pages at S1 lists Maintenance (not Fuel Cards)', p1.indexOf('Maintenance') > -1 && p1.indexOf('Fuel Cards') === -1, p1);
    // ---- 1. the server at S1 ----
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01', d2 = today.slice(0, 8) + '02';
    const mm = await J('saveMaster', { no: R, name: 'Soil Compactor No.03', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add');
    ok('1. a roller on hours (Soil Compactor No.03)', mm && !mm.ERROR, mm);
    const s1 = await J('saveMaint', { date: d1, no: R, garage: 'ARS Group', billNo: 'ARS-11', km: 1903, service: true, lines: [
      { work: 'Air Filter Safety', type: 'Paid', qty: 1, uom: 'Nos', rate: 584, amount: 584 }, { work: 'Hydraulic oil (29 Ltr)', type: 'Paid', qty: 3, uom: 'Bkt', rate: 7667, amount: 23001 },
      { work: 'CGST 9%', type: 'Paid', amount: 2122.65 }, { work: 'SGST 9%', type: 'Paid', amount: 2122.65 }] });
    ok('   a bill at S1 (a site with stock): MT-000001 ₹27,830.30, the Uom of each line kept, its reading 1903 (Hrs)', s1.ok && s1.id === 'MT-000001' && sql('rcl', "select amount || '|' || km_reading || '|' || garage from maintenance where id = 'MT-000001'") === '27830.3|1903|ARS Group' &&
      same(linesOf('MT-000001').map(l => l.uom || ''), ['Nos', 'Bkt', '', '']), [s1, linesOf('MT-000001')]);
    const noR = await J('saveMaint', { date: d1, no: R, garage: 'ARS Group', billNo: 'ARS-12', service: true, lines: [{ work: 'Bulb', amount: 40 }] });
    ok('   a service needs its reading – "(KM / Hrs)"', noR.ERROR === R + ': a service needs its reading (KM / Hrs) – the next service is counted from it.', noR);
    const lg = await J('maintLog', { no: R, from: d1, to: today });
    ok('   its log book: the bill with its Party, the machinery\'s meter Hrs; no fuel at a site with stock', lg && lg.card === false && lg.machine.meter === 'Hrs' && lg.lines.length === 1 && lg.lines[0].party === 'ARS Group' && lg.total.fuel.fills === 0 && lg.total.maint.amount === 27830.3, lg);
    // ---- 2. the page at S1 ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await wait(4500);
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); await wait(300); };
    const nav = await F.evaluate(() => ({ mnt: !$('tab-mnt').hidden, cards: !$('tab-cards').hidden, inward: !$('tab-inward').hidden }));
    ok('2. S1\'s menu: Maintenance (update-170), Diesel Inward, no Fuel Cards', nav.mnt && nav.inward && !nav.cards, nav);
    await F.evaluate(() => showTab('mnt')); await wait(2500);
    const form = await F.evaluate(() => ({ no: document.querySelector('label[for="mt_no"]').textContent.trim(), party: document.querySelector('label[for="mt_garage"]').textContent.trim(), km: document.querySelector('label[for="mt_km"]').textContent.trim(),
      head: [...document.querySelectorAll('#sec-mnt .mt-lines thead th')].map(t => t.textContent.trim()).slice(0, 8), list: $('mt_rows').rows.length }));
    ok('   the form for any machinery: "Machinery", "Party name (garage / shop of the bill)", "Current reading (KM / Hrs)"; the lines with Uom; the list has the bill', /^Machinery/.test(form.no) && /^Party name/.test(form.party) && form.km === 'Current reading (KM / Hrs)' &&
      same(form.head, ['#', 'Work / part', 'Kind', 'Qty', 'Uom', 'Rate (₹)', 'Disc %', 'Amount (₹)']) && form.list === 1, form);
    // a bill typed by hand: RK Power, two parts and a tax line
    await F.evaluate((no, d) => { $('mt_no').value = no; $('mt_date').value = d; S.mt.dateTyped = true; $('mt_garage').value = 'RK Power'; $('mt_billno').value = 'RKP-77'; $('mt_km').value = '1915'; }, R, d2);
    const typeLine = async (i, w, q, u, r) => F.evaluate((i, w, q, u, r) => { const tr = [...document.querySelectorAll('#mt_lines tr')][i], set = (c, v) => { const x = tr.querySelector(c); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); };
      set('.mt-w', w); if (q !== '') set('.mt-q', q); if (u) set('.mt-u', u); if (r !== '') set('.mt-r', r); }, i, w, q, u, r);
    await typeLine(0, 'Main fuel filter (602269641)', '1', 'Nos', '1425'); await typeLine(1, 'Powerol Engine oil (507339)', '15', 'Ltr', '278');
    await typeLine(2, 'CGST 9%', '', '', ''); await F.evaluate(() => { const a = [...document.querySelectorAll('#mt_lines tr')][2].querySelector('.mt-a'); a.value = '503.55'; a.dispatchEvent(new Event('input', { bubbles: true })); });
    const typed = await F.evaluate(() => ({ lines: mtLinesNow().filter(l => !mtEmpty(l)).map(l => [l.work, l.qty, l.uom, l.rate, l.amount].join('|')), total: $('mt_total').textContent }));
    ok('   typed: the ₹ from Qty × Rate (1 × 1425, 15 × 278), the Uom kept; Bill total ₹6,098.55', same(typed.lines, ['Main fuel filter (602269641)|1|Nos|1425|1425', 'Powerol Engine oil (507339)|15|Ltr|278|4170', 'CGST 9%|||' + '|503.55']) && typed.total === '6,098.55', typed);
    await F.evaluate(() => $('mt_save').click());
    for (let i = 0; i < 40 && sql('rcl', "select count(*) from maintenance where bill_no = 'RKP-77'") === '0'; i++) await wait(500);
    const l2 = linesOf('MT-000002');
    ok('   saved from the page: MT-000002 – ₹6,098.55, reading 1915, the lines with their Uom', sql('rcl', "select amount || '|' || km_reading || '|' || garage from maintenance where id = 'MT-000002'") === '6098.55|1915|RK Power' &&
      same(l2.map(l => l.work + ':' + (l.uom || '') + ':' + l.amount), ['Main fuel filter (602269641):Nos:1425', 'Powerol Engine oil (507339):Ltr:4170', 'CGST 9%::503.55']), l2);
    await wait(2000);
    const lhead = await F.evaluate(() => [...document.querySelector('#mt_rows').closest('table').tHead.rows[0].cells].map(c => c.textContent));
    ok('   the list: Machinery, Party, Reading', same(lhead.slice(0, 9), ['Bill ID', 'Date', 'Machinery', 'Party', 'Bill no.', 'Work / parts', 'Amount (₹)', 'Service', 'Reading']), lhead);
    // the log book in his format
    await F.evaluate((no, a, z) => { $('ml_no').value = no; $('ml_from').value = a; $('ml_to').value = z; $('ml_go').click(); }, R, d1, today);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden)); i++) await wait(400);
    const lb = await F.evaluate(() => { const tb = [...document.querySelectorAll('#rpmlog_body table')], t0 = tb[0];
      return { title: $('rpmlog_title').textContent, head: [...t0.tHead.rows[0].cells].map(c => c.textContent), rows: [...t0.tBodies[0].rows].map(r => [...r.cells].map(c => c.textContent)), spans: [...t0.tBodies[0].rows].map(r => r.cells[1].rowSpan),
        foot: [...t0.tFoot.rows].map(r => [...r.cells].map(c => c.textContent)), sheets: tb.map(x => x.dataset.sheet), kp: [...document.querySelectorAll('#rpmlog_kpis div')].map(x => x.textContent) }; });
    ok('   the log book: "Maintenance Log Book – ' + R + '", his columns: Sr No · Date · Party Name · Current Reading · Particulars · Qty · Uom · Basic Rate · Amount · GST Amount · Amount With GST · Total', lb.title === 'Maintenance Log Book – ' + R &&
      same(lb.head, ['Sr No', 'Date', 'Party Name', 'Current Reading', 'Particulars', 'Qty', 'Uom', 'Basic Rate', 'Amount', 'GST Amount', 'Amount With GST', 'Total']), lb);
    const dmy = d => d.split('-').reverse().join('-');
    ok('   a row a line (4 + 3); Date, Party and Reading once for a bill (rowspan 4 and 3); the parts with Qty / Uom / Rate; the tax lines in GST Amount', lb.rows.length === 7 && lb.spans[0] === 4 && lb.spans[4] === 3 &&
      same(lb.rows[0], ['1', dmy(d1), 'ARS GroupBill ARS-11', '1,903', 'Air Filter Safety', '1', 'Nos', '584.00', '584.00', '', '584.00', '584.00']) && same(lb.rows[1], ['2', 'Hydraulic oil (29 Ltr)', '3', 'Bkt', '7,667.00', '23,001.00', '', '23,001.00', '23,001.00']) &&
      same(lb.rows[2], ['3', 'CGST 9%', '', '', '', '', '2,122.65', '2,122.65', '2,122.65']) && same(lb.rows[4].slice(0, 5), ['5', dmy(d2), 'RK PowerBill RKP-77', '1,915', 'Main fuel filter (602269641)']), lb.rows);
    ok('   Total – 2 bills: Amount ₹29,180.00, GST ₹4,748.85, With GST ₹33,928.85; no fuel table at a site with stock; Maintenance / Last service (1,903 hrs)', same(lb.foot[0], ['Total – 2 bill(s)', '29,180.00', '4,748.85', '33,928.85', '33,928.85']) &&
      same(lb.sheets, ['Log Book', 'By work']) && same(lb.kp, ['Maintenance₹33,928.85', 'Last service' + dmy(d1) + ' · 1,903 hrs']), [lb.foot, lb.sheets, lb.kp]);
    await tidy(); await F.evaluate(() => $('rpmlog_out').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt170_logbook.png') });
    for (let i = 0; i < 30 && !(await F.evaluate(() => typeof XLSX !== 'undefined')); i++) await wait(500);
    const xl = await F.evaluate(() => { let got = null; const w = XLSX.writeFile; XLSX.writeFile = (wb, name) => { const s = wb.Sheets[wb.SheetNames[0]]; got = { name: name, sheets: wb.SheetNames, merges: (s['!merges'] || []).length, a6: s.A6 && s.A6.v, c7: s.C7 && s.C7.v, j9: s.J9 && s.J9.v }; }; try { rpExcel({ key: 'mlog' }); } finally { XLSX.writeFile = w; } return got; });
    ok('   … in Excel: "Log Book" and "By work"; his columns from row 6; Date / Party / Reading merged for each bill (3 × 2)', !!xl && same(xl.sheets, ['Log Book', 'By work']) && xl.a6 === 'Sr No' && /^ARS Group/.test(String(xl.c7 || '')) && xl.merges >= 6, xl);
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl', "delete from maintenance; delete from master where id like 'ROLLER-%170'; delete from web.props where key = 'MNT_LAST_NO'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: S1 back to ' + sql('rcl', 'select count(*) from maintenance') + ' bills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
