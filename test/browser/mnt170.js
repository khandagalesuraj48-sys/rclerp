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
      head: [...document.querySelectorAll('#sec-mnt .mt-lines thead th')].map(t => t.textContent.trim()).slice(0, 8), gh: [...document.querySelectorAll('#sec-mnt .mt-lines thead th')].map(t => t.textContent.trim()).slice(8, 11), list: $('mt_rows').rows.length }));
    ok('   (update-171) each line its GST %, its GST ₹ and its amount with GST', same(form.gh, ['GST %', 'GST ₹', 'With GST']), form.gh);
    ok('   the form for any machinery: "Machinery", "Party name (garage / shop of the bill)", "Current reading (KM / Hrs)"; the lines with Uom; the list has the bill', /^Machinery/.test(form.no) && /^Party name/.test(form.party) && form.km === 'Current reading (KM / Hrs)' &&
      same(form.head, ['#', 'Work / part', 'Paid by', 'Qty', 'Uom', 'Rate (₹)', 'Disc %', 'Amount (₹)']) && form.list === 1, form);      // (update-171: Paid by)
    // a bill typed by hand: RK Power, two parts – each its GST % (update-171: no tax line)
    await F.evaluate((no, d) => { $('mt_no').value = no; $('mt_date').value = d; S.mt.dateTyped = true; $('mt_garage').value = 'RK Power'; $('mt_billno').value = 'RKP-77'; $('mt_km').value = '1915'; }, R, d2);
    const typeLine = async (i, w, q, u, r, g) => F.evaluate((i, w, q, u, r, g) => { const tr = [...document.querySelectorAll('#mt_lines tr')][i], set = (c, v) => { const x = tr.querySelector(c); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); };
      set('.mt-w', w); if (q !== '') set('.mt-q', q); if (u) set('.mt-u', u); if (r !== '') set('.mt-r', r); if (g !== '') set('.mt-g', g); }, i, w, q, u, r, g);
    await typeLine(0, 'Main fuel filter (602269641)', '1', 'Nos', '1425', '18'); await typeLine(1, 'Powerol Engine oil (507339)', '15', 'Ltr', '278', '18');
    const typed = await F.evaluate(() => ({ lines: mtLinesNow().filter(l => !mtEmpty(l)).map(l => [l.work, l.qty, l.uom, l.rate, l.amount, l.gst].join('|')), total: $('mt_total').textContent,
      gv: [...document.querySelectorAll('#mt_lines tr')].slice(0, 2).map(tr => tr.querySelector('.mt-gv').textContent + '|' + tr.querySelector('.mt-wv').textContent) }));
    ok('   typed: the ₹ from Qty × Rate (1 × 1425, 15 × 278), the Uom and GST 18 % kept; GST ₹ (CGST + SGST each rounded) and With GST shown; Bill total ₹6,602.10', same(typed.lines, ['Main fuel filter (602269641)|1|Nos|1425|1425|18', 'Powerol Engine oil (507339)|15|Ltr|278|4170|18']) &&
      same(typed.gv, ['256.50|1,681.50', '750.60|4,920.60']) && typed.total === '6,602.10', typed);
    // (update-172, his picture) the totals' box: Subtotal (before GST) · GST (18%) · Bill total; every number and name seen whole in its box
    const tb = await F.evaluate(() => { const trs = [...document.querySelectorAll('#mt_lines tr')].slice(0, 2), cut = x => x.scrollWidth > x.clientWidth + 1;
      return { sub: $('mt_sub').textContent, gl: $('mt_gstl').textContent, gst: $('mt_gstt').textContent, total: $('mt_total').textContent,
        cut: trs.flatMap(tr => [...tr.querySelectorAll('input, select, td.mt-gv, td.mt-wv')].filter(cut).map(x => x.className || x.tagName)), sw: !!document.querySelector('label.mt-switch #mt_service') }; });
    ok('   (update-172) the totals\' box: Subtotal ₹5,595.00 · GST (18%) ₹1,007.10 · Bill total ₹6,602.10; no number or name cut in its box; the service a switch in the head', tb.sub === '5,595.00' && tb.gl === 'GST (18%)' && tb.gst === '1,007.10' && tb.total === '6,602.10' && tb.cut.length === 0 && tb.sw, tb);
    // (update-172) a double-click opens a box big – the app's own big box: all its text (Esc closes it, nothing changed); on Rate a number
    // saved there goes into the line – its ₹ and the Bill total worked out again
    await F.evaluate(() => document.querySelector('#sec-mnt .mt-lcard').scrollIntoView({ block: 'start' })); await wait(500);
    const big = async (sel, i, synth) => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(200);      // (the app's "Vehicle papers need attention" of the test's roller may come up meanwhile)
      if (synth) await F.evaluate((sel, i) => document.querySelectorAll(sel)[i].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })), sel, i); else { const hs = await F.$$(sel); await hs[i].click({ clickCount: 2 }); } await wait(400);
      return F.evaluate(() => { const bk = $('bigbox'), ed = bk && bk.querySelector('#bb_field input, #bb_field textarea'), c = bk && bk.querySelector('.bb-card');
        return bk && !bk.hidden && ed ? { title: $('bb_title').textContent, val: ed.value, type: ed.type, w: Math.round(c.getBoundingClientRect().width), fs: getComputedStyle(ed).fontSize, focus: document.activeElement === ed } : null; }); };
    const key = k => F.evaluate(k => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })), k);
    const bg1 = await big('#mt_lines tr .mt-w', 0, true); await key('Escape'); await wait(300);      // (its pick-list: the test's quick clicks open the list – the double-click itself sent to the box)
    const after1 = await F.evaluate(() => ({ hidden: $('bigbox').hidden, w: [...document.querySelectorAll('#mt_lines tr')][0].querySelector('.mt-w').value }));
    await F.evaluate(() => document.activeElement && document.activeElement.blur()); await wait(400);      // (the Work box's pick-list closed first)
    const bg2 = await big('#mt_lines tr .mt-r', 1);
    const mid = bg2 && await F.evaluate(() => { const ed = $('bigbox').querySelector('#bb_field input'); ed.value = '280'; ed.dispatchEvent(new Event('input', { bubbles: true })); return true; }) && (await key('Enter'), await wait(300),
      await F.evaluate(() => { const tr = [...document.querySelectorAll('#mt_lines tr')][1]; return { hidden: $('bigbox').hidden, rate: tr.querySelector('.mt-r').value, amt: tr.querySelector('.mt-a').value, total: $('mt_total').textContent }; }));
    await F.evaluate(() => document.activeElement && document.activeElement.blur()); await wait(400);
    await big('#mt_lines tr .mt-r', 1); await F.evaluate(() => { const ed = $('bigbox').querySelector('#bb_field input'); ed.value = '278'; ed.dispatchEvent(new Event('input', { bubbles: true })); }); await key('Enter'); await wait(300);
    const back = await F.evaluate(() => { const tr = [...document.querySelectorAll('#mt_lines tr')][1]; return { hidden: $('bigbox').hidden, amt: tr.querySelector('.mt-a').value, total: $('mt_total').textContent }; });
    ok('   (update-172) a double-click on a box opens it big (the app\'s big box, ' + (bg1 && bg1.w) + ' px, its letters ' + (bg1 && bg1.fs) + '): "Work / part" with all its text – Esc, nothing changed; on Rate: 278 → 280 saved there makes the line ₹4,200 and the Bill total ₹6,637.50, back to 278 – ₹4,170',
      !!bg1 && /Work \/ part/.test(bg1.title) && bg1.val === 'Main fuel filter (602269641)' && bg1.w >= 480 && bg1.focus && after1.hidden && after1.w === 'Main fuel filter (602269641)' &&
      !!bg2 && bg2.val === '278' && bg2.type === 'number' && !!mid && mid.hidden && mid.rate === '280' && mid.amt === '4200' && mid.total === '6,637.50' && back.hidden && back.amt === '4170' && back.total === '6,602.10', [bg1, after1, bg2, mid, back]);
    // (update-172) the icons of the boxes do not cover what is written in them
    const icw = await F.evaluate(() => [...document.querySelectorAll('#sec-mnt .mt-ic')].map(w => { const i = w.querySelector('.mt-i').getBoundingClientRect(), x = w.querySelector('input'); return Math.round(x.getBoundingClientRect().left + parseFloat(getComputedStyle(x).paddingLeft) - i.right); }));
    ok('   (update-172) each box its icon, the writing after it (never under it)', icw.length === 6 && icw.every(d => d >= 4), icw);
    await tidy(); await F.evaluate(() => { document.querySelector('#sec-mnt .mt-form').scrollIntoView({ block: 'start' }); const m = document.querySelector('main'); (m && m.scrollHeight > m.clientHeight + 5 ? m : document.scrollingElement).scrollBy(0, -70); }); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt172_form.png') });
    await F.evaluate(() => document.querySelector('#sec-mnt .mt-lcard').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt172_lines.png') });
    await F.evaluate(() => $('mt_save').click());
    for (let i = 0; i < 40 && sql('rcl', "select count(*) from maintenance where bill_no = 'RKP-77'") === '0'; i++) await wait(500);
    const l2 = linesOf('MT-000002');
    ok('   saved from the page: MT-000002 – ₹6,602.10, reading 1915, the lines with their Uom and GST %', sql('rcl', "select amount || '|' || km_reading || '|' || garage from maintenance where id = 'MT-000002'") === '6602.1|1915|RK Power' &&
      same(l2.map(l => l.work + ':' + (l.uom || '') + ':' + l.amount + ':' + (l.gst || '')), ['Main fuel filter (602269641):Nos:1425:18', 'Powerol Engine oil (507339):Ltr:4170:18']), l2);
    await wait(2000);
    // (update-171) a line paid by the insurance: the claim ticked by itself, its ₹ = that line with its GST (not typed)
    const ib = await F.evaluate(() => { mtClear(); const tr = document.querySelector('#mt_lines tr'), set = (c, v, ev) => { const x = tr.querySelector(c); x.value = v; x.dispatchEvent(new Event(ev || 'input', { bubbles: true })); };
      set('.mt-w', 'Front bumper'); set('.mt-a', '10000'); set('.mt-g', '28'); set('.mt-t', 'By Insurance', 'change');
      const r = { ins: $('mt_ins').checked, box: !$('mt_insbox').hidden, paid: $('mt_inspaid').value, ro: $('mt_inspaid').readOnly, total: $('mt_total').textContent, we: $('mt_wepaid').textContent, opt: tr.querySelector('.mt-t').selectedOptions[0].textContent, cls: tr.className };
      mtClear(); return r; });
    ok('   a line "Paid by: Insurance": the claim ticked by itself, Paid by the insurance ₹12,800 (10,000 + 28 % GST) – not typed; We paid ₹0.00', ib.ins && ib.box && ib.paid === '12800' && ib.ro && ib.total === '12,800.00' && ib.we === '0.00' && ib.opt === 'Insurance' && /mt-insl/.test(ib.cls), ib);
    const lhead = await F.evaluate(() => [...document.querySelector('#mt_rows').closest('table').tHead.rows[0].cells].map(c => c.textContent));
    ok('   the list: Machinery, Party, Reading', same(lhead.slice(0, 9), ['Bill ID', 'Date', 'Machinery', 'Party', 'Bill no.', 'Work / parts', 'Amount (₹)', 'Service', 'Reading']), lhead);
    // the log book in his format
    await F.evaluate((no, a, z) => { $('ml_no').value = no; $('ml_from').value = a; $('ml_to').value = z; $('ml_go').click(); }, R, d1, today);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden)); i++) await wait(400);
    const lb = await F.evaluate(() => { const bd = $('rpmlog_body').cloneNode(true); bd.querySelectorAll('.no-print').forEach(x => x.remove());      // (update-175: each bill's Change / Delete – on the screen only, as printed)
      const tb = [...bd.querySelectorAll('table')], t0 = tb[0];
      return { title: $('rpmlog_title').textContent, head: [...t0.tHead.rows[0].cells].map(c => c.textContent), rows: [...t0.tBodies[0].rows].map(r => [...r.cells].map(c => c.textContent)), spans: [...t0.tBodies[0].rows].map(r => r.cells[1].rowSpan),
        foot: [...t0.tFoot.rows].map(r => [...r.cells].map(c => c.textContent)), sheets: tb.map(x => x.dataset.sheet), kp: [...document.querySelectorAll('#rpmlog_kpis div')].map(x => x.textContent) }; });
    ok('   the log book: "Maintenance Log Book – ' + R + '", his columns – the GST rates in the heading (update-171: CGST 9% · SGST 9% · GST 18%), Paid by, Insurance claim, Service', lb.title === 'Maintenance Log Book – ' + R &&
      same(lb.head, ['Sr No', 'Date', 'Party Name', 'Current Reading', 'Particulars', 'Qty', 'Uom', 'Basic Rate', 'Amount', 'CGST 9%', 'SGST 9%', 'GST 18%', 'Amount With GST', 'Paid by', 'Insurance claim', 'Service', 'Total']), lb);
    const dmy = d => d.split('-').reverse().join('-');
    // (update-172) the bill of before: its CGST 9% / SGST 9% lines are not rows – on its two items by 9 % + 9 % (₹2,122.65 each, as the bill)
    ok('   a row a line (2 + 2); Date, Party and Reading once for a bill; a bill of before: no GST row – its CGST / SGST on its items (9 % + 9 %); a new one: each item\'s CGST and SGST; Paid by RCL, no claim, service Yes / No', lb.rows.length === 4 && lb.spans[0] === 2 && lb.spans[2] === 2 &&
      same(lb.rows[0], ['1', dmy(d1), 'ARS GroupBill ARS-11', '1,903', 'Air Filter Safety', '1', 'Nos', '584.00', '584.00', '52.56', '52.56', '105.12', '689.12', 'RCL', 'No', 'Yes', '689.12']) &&
      same(lb.rows[1], ['2', 'Hydraulic oil (29 Ltr)', '3', 'Bkt', '7,667.00', '23,001.00', '2,070.09', '2,070.09', '4,140.18', '27,141.18', 'RCL', 'No', 'Yes', '27,141.18']) &&
      same(lb.rows[2], ['3', dmy(d2), 'RK PowerBill RKP-77', '1,915', 'Main fuel filter (602269641)', '1', 'Nos', '1,425.00', '1,425.00', '128.25', '128.25', '256.50', '1,681.50', 'RCL', 'No', 'No', '1,681.50']) &&
      same(lb.rows[3], ['4', 'Powerol Engine oil (507339)', '15', 'Ltr', '278.00', '4,170.00', '375.30', '375.30', '750.60', '4,920.60', 'RCL', 'No', 'No', '4,920.60']) &&
      lb.rows.every(r => !/CGST|SGST/.test(r.join('|'))), lb.rows);
    ok('   Total – 2 bills: Amount ₹29,180.00, CGST ₹2,626.20, SGST ₹2,626.20, GST ₹5,252.40, With GST ₹34,432.40; no fuel table at a site with stock; Maintenance / Last service (1,903 hrs)', same(lb.foot[0], ['Total – 2 bill(s)', '29,180.00', '2,626.20', '2,626.20', '5,252.40', '34,432.40', '', '', '', '34,432.40']) &&
      same(lb.sheets, ['Log Book', 'By work']) && same(lb.kp, ['Maintenance₹34,432.40', 'Last service' + dmy(d1) + ' · 1,903 hrs']), [lb.foot, lb.sheets, lb.kp]);
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
