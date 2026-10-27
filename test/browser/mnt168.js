// update-168 (asked 27-10-2026 with 9 of his bills: "kahi material warranty madhe aste kahi paid aste kahi discount deun aste tr sagle
// kahi yeyla hawa ok and type pn krta yayla hawa"; his answers: the car's cost = only what WE paid; a line = work / part, kind, Qty,
// Rate, Discount %, ₹; an insurance claim = one bill with the whole amount, what the insurance paid and what we paid) – the whole way
// on the local rig started with PORTAL=1, as mnt165.js: site T2 (database rcl_s2, steps 1zg / 1zh / 1zi run) plays HO on fuel cards.
// Test data only, on the rig. The AI is the stand-in on :3998 (Gemini's or Claude's – both work the same here).
//   1. the server: a labour bill with a Warranty line (₹ 0, its worth kept); the checks of a line (kind, Qty, Rate, Discount); an
//      insurance claim (we paid the rest – the Amount column); its checks; the list and the car's log book count only what we paid;
//      an app of before cannot change a bill with free lines / insurance; the bill changed with its insurance kept
//   2. the AI reads a bill given in the short form (one array a line) – every line with its kind, also the free ones; the insurance
//      from "what the customer paid"
//   3. the page: "Read the bill (AI)" puts the car (from the bill's number), each line's kind / Qty / Rate / Disc % / ₹, the free lines
//      (₹ 0, "worth ₹…"), the totals and the insurance part in the form; ₹ worked out from Qty × Rate − Discount; a kind changed;
//      saved – the Amount = what we paid; the list's notes; Edit brings everything back; the car's log book (We paid)
//   4. the page in मराठी: the kinds shown in Marathi, their English values sent – the bill saved as before
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt168.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'); const fs = require('fs'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp', AI = 'http://127.0.0.1:3998';
const C1 = 'MNT-1-168', C2 = 'MNT-2-168', INS = 'Test General Insurance';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const say = async j => fetch(AI + '/__meter?say=' + encodeURIComponent(JSON.stringify(j)));
(async () => {
  const errs = []; let b = null, cookie = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const dir = fs.mkdtempSync(path.join(SHOT, 'mnt168-'));
  const n0 = sql('rcl_s2', 'select (select count(*) from maintenance) + (select count(*) from diesel_issue)');
  const linesOf = id => JSON.parse(sql('rcl_s2', "select lines from maintenance where id = '" + id + "'") || '[]');
  const amountOf = id => sql('rcl_s2', "select amount from maintenance where id = '" + id + "'");
  try {
    ok('start: T2 has no bill and no fill; step 1zi run in T2', n0 === '0' && sql('rcl_s2', "select count(*) from information_schema.tables where table_name = 'maintenance'") !== '0', n0);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const pg0 = await preq('/api/admin', { action: 'placesGet', site: 'T2' });
    const put = await preq('/api/admin', { action: 'placesSave', site: 'T2', places: (pg0.places || []).map(p => ({ name: p.name, cap: p.cap || 1000 })), mode: 'card' });
    ok('the Portal: T2 put on fuel cards', put.status === 200 && sql('rcl_s2', "select value from web.props where key = 'FUEL_MODE'") === 'card', put);
    // ---- 1. the server ----
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('T2')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01', d2 = today.slice(0, 8) + '02';
    const car = no => ({ no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 14, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1, fuel: 'Petrol' });
    const mm = [await J('saveMaster', car(C1), 'add'), await J('saveMaster', car(C2), 'add')];
    ok('1. two cars', mm.every(x => x && !x.ERROR), mm);
    // a labour bill (as his 07668): Paid lines with Qty / Rate, a Warranty line, the taxes
    const labour = [{ work: 'General service labour', type: 'Paid', qty: 1, rate: 2100, disc: 0, amount: 2100 }, { work: 'Wheel balancing', type: 'Paid', qty: 4, rate: 150, disc: '', amount: 600 },
      { work: 'Brake check', type: 'Warranty', qty: 1, rate: 1120, disc: '', amount: '' }, { work: 'CGST 9%', type: 'Paid', qty: '', rate: '', disc: '', amount: 243 }, { work: 'SGST 9%', type: 'Paid', amount: 243 }];
    const sA = await J('saveMaint', { date: d1, no: C1, garage: 'Test Motors', billNo: 'TM-07668', km: 52000, service: true, lines: labour });
    const lA = linesOf('MT-000001');
    ok('   a labour bill: MT-000001 – Amount ₹3186 (its Paid lines); the Warranty line kept with ₹ 0, its Qty 1 and Rate 1120; every line its kind', sA.ok && sA.total === 3186 && sA.billTotal === 3186 && amountOf('MT-000001') === '3186' &&
      same(lA.map(l => l.type), ['Paid', 'Paid', 'Warranty', 'Paid', 'Paid']) && same(lA[2], { work: 'Brake check', type: 'Warranty', amount: 0, qty: 1, rate: 1120 }) && same(lA[1], { work: 'Wheel balancing', type: 'Paid', amount: 600, qty: 4, rate: 150 }), [sA, lA]);
    const bad = async (l, ins) => (await J('saveMaint', { date: d1, no: C1, garage: 'Test Motors', billNo: 'TM-X', lines: l, insurance: ins })).ERROR || '';
    const e1 = await bad([{ work: 'Brake pad', type: 'Free', amount: 0 }]), e2 = await bad([{ work: 'Brake pad', type: 'Paid', qty: 1, rate: 900, disc: 150, amount: 900 }]);
    const e3 = await bad([{ work: 'Brake pad', type: 'Paid', qty: -1, rate: 900, amount: 900 }]), e4 = await bad([{ work: 'Discount', type: 'Paid', amount: -500 }, { work: 'Brake pad', amount: 400 }]);
    ok('   the checks of a line: its kind, its discount, its Qty; a total below 0', e1 === 'Bill line 1 (Brake pad): Paid by is RCL, Insurance, Warranty, FOC or Service Plan.' && e2 === 'Bill line 1 (Brake pad): the discount is 0 to 100 %.' &&
      e3 === 'Bill line 1 (Brake pad): the quantity is not right.' && e4 === 'The total of the bill cannot be below 0 – check the amounts (a discount is a minus line).', [e1, e2, e3, e4]);
    // an insurance claim: the whole bill, what the insurance paid, we paid the rest
    const body = [{ work: 'Front bumper', type: 'Paid', qty: 1, rate: 18000, disc: 5, amount: 17100 }, { work: 'Body labour', type: 'Paid', amount: 4000 }, { work: 'GST', type: 'Paid', amount: 3798 }];
    const i1 = await bad(body, { company: INS, claimNo: 'CLM-1', paid: 30000 }), i2 = await bad(body, { company: '', claimNo: 'CLM-1', paid: 20000 }), i3 = await bad(body, { company: INS, claimNo: '', paid: '' });
    ok('   the checks of the insurance part: more than the bill; no company; no ₹', i1 === 'The insurance part of the bill: the insurance paid ₹30000 – more than the bill (₹24898).' &&
      i2 === 'The insurance part of the bill: type the insurance company.' && i3 === 'The insurance part of the bill: enter what the insurance paid (₹).', [i1, i2, i3]);
    const sB = await J('saveMaint', { date: d2, no: C1, garage: 'Test Body Shop', billNo: 'BS-1', km: '', service: false, lines: body, insurance: { company: INS, claimNo: 'CLM-1', paid: 23000 } });
    const lB = linesOf('MT-000002');
    ok('   an insurance claim: MT-000002 – the bill ₹24898, the insurance ₹23000, the Amount = we paid ₹1898; the insurance kept as its own line (a minus ₹)', sB.ok && sB.total === 1898 && sB.billTotal === 24898 && amountOf('MT-000002') === '1898' &&
      same(lB[3], { work: INS, type: 'Insurance', claim: 'CLM-1', amount: -23000 }) && lB.length === 4, [sB, lB]);
    const ls = await J('getMaint', { from: d1, to: today }), rB = (ls.rows || []).find(r => r.id === 'MT-000002') || {}, rA = (ls.rows || []).find(r => r.id === 'MT-000001') || {};
    ok('   the list: ₹5084 in all (what we paid); the claim – bill ₹24898, insurance { company, claim no., ₹23000 }, its 3 lines; the labour bill – free worth ₹1120', ls.total === 5084 && rB.total === 1898 && rB.billTotal === 24898 &&
      same(rB.insurance, { company: INS, claimNo: 'CLM-1', paid: 23000 }) && rB.lines.length === 3 && rA.free === 1120 && rA.insurance === null && rA.billTotal === 3186, [ls.total, rA, rB]);
    const lg = await J('maintLog', { no: C1, from: d1, to: today }), mn = (lg.total || {}).maint || {};
    ok('   the car\'s log book: maintenance ₹5084 (we paid) – bills ₹28084, insurance ₹23000, free worth ₹1120; "by work" has no Warranty line', mn.amount === 5084 && mn.billTotal === 28084 && mn.insurance === 23000 && mn.free === 1120 && mn.bills === 2 &&
      lg.total.all === 5084 && !lg.total.byWork.some(w => w.work === 'Brake check') && lg.total.byWork.some(w => w.work === 'Front bumper' && w.amount === 17100), lg.total);
    const oldApp = await J('updateMaint', 'MT-000002', { date: d2, no: C1, garage: 'Test Body Shop', billNo: 'BS-1', lines: body.map(l => ({ work: l.work, amount: l.amount })) });
    ok('   an app of before (lines without a kind) cannot change the claim – "update the app"', oldApp.ERROR === 'Bill MT-000002 has free lines (Warranty / FOC / Service Plan) or an insurance part – update the app to change it.' && amountOf('MT-000002') === '1898', oldApp);
    const up = await J('updateMaint', 'MT-000002', { date: d2, no: C1, garage: 'Test Body Shop', billNo: 'BS-1', lines: body, remark: 'claim passed', insurance: { company: INS, claimNo: 'CLM-1', paid: 23000 } });
    ok('   changed with its insurance: still we paid ₹1898, the remark saved', up.ok && up.total === 1898 && amountOf('MT-000002') === '1898' && sql('rcl_s2', "select remark from maintenance where id = 'MT-000002'") === 'claim passed', up);
    // ---- 2. the AI reads a bill in the short form ----
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n% bill 168\n');
    fs.writeFileSync(path.join(dir, 'bill168.pdf'), PDF);
    const ANSWER = { date: d2, billNo: '07668, 02040', garage: 'Test Toyota', vehicle: C2.replace(/-/g, ''), km: '61,234', service: true, total: '2,761.00',
      lines: [['Periodic maintenance labour', 'Paid', 1, 1800, 0, 1800], ['Wheel alignment', 'Paid', 1, 600, 10, 540], ['Engine oil', 'Service Plan', 4.5, 520, 100, 0], ['Oil filter', 'Warranty', 1, 350, 0, 0],
        ['Car wash', 'FOC', 1, 250, 0, 0], ['CGST 9%', 'Paid', null, null, 0, 210.6], ['SGST 9%', 'Paid', null, null, 0, 210.6], ['Round off', 'Paid', null, null, 0, -0.2]],
      insurer: INS, claimNo: 'CLM-168', insurancePaid: null, customerPaid: 761 };
    await fetch(AI + '/__clear'); await say(ANSWER);
    const rd = await J('readMaintBill', { data: 'data:application/pdf;base64,' + PDF.toString('base64') });
    const glog = await (await fetch(AI + '/__log')).json(), gl = glog.filter(x => x.image).pop() || {};
    ok('2. the AI is asked for every line in the short form ([work, type, qty, rate, discount, amount]), more than one invoice as one bill, the insurance', /ONE array for EVERY item|garage, service centre or parts shop/.test(gl.ask || '') && gl.image === 'application/pdf', gl);
    ok('   its answer: the 8 lines with their kinds (Service Plan, Warranty, FOC at ₹ 0), Qty / Rate / Disc %; the total ₹2761 (= the Paid lines); the insurance ₹2000 (the bill less the ₹761 the customer paid)', rd.lines && rd.lines.length === 8 &&
      same(rd.lines.map(l => l.type), ['Paid', 'Paid', 'Service Plan', 'Warranty', 'FOC', 'Paid', 'Paid', 'Paid']) && same(rd.lines[1], { work: 'Wheel alignment', type: 'Paid', amount: 540, qty: 1, rate: 600, disc: 10 }) &&
      same(rd.lines[2], { work: 'Engine oil', type: 'Service Plan', amount: 0, qty: 4.5, rate: 520, disc: 100 }) && rd.total === 2761 && rd.check === '' && same(rd.insurance, { company: INS, claimNo: 'CLM-168', paid: 2000 }) && rd.km === 61234 && rd.billNo === '07668, 02040', rd);
    // ---- 3. the page ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('T2: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('T2'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && S.fuelMode === 'card');
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await wait(4500);      // (the page's own database check speaks 4 s after it opens – for the pictures, let it speak first)
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); await wait(300); };      // (only for the pictures; the toast's words are still read)
    await F.evaluate(() => showTab('mnt')); await wait(2500);
    const head = await F.evaluate(() => [...document.querySelectorAll('#sec-mnt .mt-lines thead th')].map(t => t.textContent.trim()));
    ok('3. the page: the lines have # | Work / part | Paid by | Qty | Uom | Rate (₹) | Disc % | Amount (₹) | GST % | GST ₹ | With GST (update-170: Uom; update-171: Paid by, GST)', same(head.slice(0, 11), ['#', 'Work / part', 'Paid by', 'Qty', 'Uom', 'Rate (₹)', 'Disc %', 'Amount (₹)', 'GST %', 'GST ₹', 'With GST']), head);
    // the car box left EMPTY: the AI's vehicle number puts it
    await F.evaluate(() => $('mt_addf').click()); for (let i = 0; i < 20 && !(await F.evaluate(() => !!document.getElementById('at_back'))); i++) await wait(300);
    const inp = await F.$('#at_file'); await inp.uploadFile(path.join(dir, 'bill168.pdf'));
    for (let i = 0; i < 40; i++) { const n = await F.evaluate(() => document.querySelectorAll('#at_tiles .at-tile.st-new').length); if (n >= 1) break; await wait(300); }
    await F.evaluate(() => document.querySelector('#at_back [data-at="ok"]').click());
    for (let i = 0; i < 60 && await F.evaluate(() => !!document.getElementById('at_back')); i++) await wait(400);
    await say(ANSWER);
    await F.evaluate(() => $('mt_read').click());
    for (let i = 0; i < 40; i++) { if (await F.evaluate(() => /Read by the AI|read nothing/.test($('mt_readmsg').textContent))) break; await wait(400); }
    const row = i => `[...document.querySelectorAll('#mt_lines tr')][${i}]`;
    const fr = await F.evaluate(() => { const trs = [...document.querySelectorAll('#mt_lines tr')], g = (tr, c) => tr.querySelector(c);
      return { no: $('mt_no').value, noBlue: $('mt_no').classList.contains('ai-read'), msg: $('mt_readmsg').textContent, n: trs.length,
        kinds: trs.map(tr => g(tr, '.mt-t').value), free: trs.filter(tr => tr.classList.contains('mt-free')).length,
        dis: trs.map(tr => g(tr, '.mt-a').disabled), amt: trs.map(tr => g(tr, '.mt-a').value), worth: [...document.querySelectorAll('#mt_lines .mt-worth')].map(x => x.textContent),
        l2: [g(trs[1], '.mt-q').value, g(trs[1], '.mt-r').value, g(trs[1], '.mt-d').value, g(trs[1], '.mt-a').value],
        total: $('mt_total').textContent, freeRow: !$('mt_freerow').hidden, freeSum: $('mt_free').textContent, ins: $('mt_ins').checked, insBox: !$('mt_insbox').hidden,
        insco: $('mt_insco').value, claim: $('mt_insclaim').value, paid: $('mt_inspaid').value, wepaid: $('mt_wepaid').textContent, blueSel: document.querySelectorAll('#mt_lines select.ai-read').length };
    });
    ok('   "Read the bill (AI)": the car ' + C2 + ' from the bill\'s number (the box was empty) – blue; "check every value"', fr.no === C2 && fr.noBlue && /check every value/.test(fr.msg) && !/Check:/.test(fr.msg), fr);
    ok('   the 8 lines, each its kind (blue), Qty / Rate / Disc %: "Wheel alignment" 1 × 600 − 10 % = 540', fr.n >= 8 && same(fr.kinds.slice(0, 8), ['Paid', 'Paid', 'Service Plan', 'Warranty', 'FOC', 'Paid', 'Paid', 'Paid']) && fr.blueSel === 8 && same(fr.l2, ['1', '600', '10', '540']), fr);
    ok('   the free lines (Service Plan, Warranty, FOC): ₹ 0, not to be typed, each with its worth – ₹2,340.00, ₹350.00, ₹250.00', fr.free === 3 && same(fr.dis.slice(0, 8), [false, false, true, true, true, false, false, false]) &&
      same(fr.amt.slice(2, 5), ['0', '0', '0']) && same(fr.worth, ['worth ₹2,340.00', 'worth ₹350.00', 'worth ₹250.00']), fr);
    ok('   the totals: Bill total ₹2,761.00, free lines worth ₹2,940.00; the insurance part ticked and filled – the company, claim no., ₹2000; We paid ₹761.00', fr.total === '2,761.00' && fr.freeRow && fr.freeSum === '2,940.00' && fr.ins && fr.insBox &&
      fr.insco === INS && fr.claim === 'CLM-168' && fr.paid === '2000' && fr.wepaid === '761.00', fr);
    await tidy(); await F.evaluate(() => $('mt_lines').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt168_form.png') });
    await F.evaluate(() => document.querySelector('#sec-mnt .mt-ins').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt168_form2.png') });
    // typed by hand: the discount of line 2 taken off → its ₹ worked out again; a kind changed to Paid and back
    await F.evaluate(r => { const d = eval(r).querySelector('.mt-d'); d.value = '0'; d.dispatchEvent(new Event('input', { bubbles: true })); }, row(1));
    const t1 = await F.evaluate(r => ({ a: eval(r).querySelector('.mt-a').value, blue: eval(r).querySelector('.mt-a').classList.contains('ai-read'), total: $('mt_total').textContent, we: $('mt_wepaid').textContent }), row(1));
    await F.evaluate(r => { const s = eval(r).querySelector('.mt-t'); s.value = 'Paid'; s.dispatchEvent(new Event('change', { bubbles: true })); }, row(4));
    const t2 = await F.evaluate(r => ({ a: eval(r).querySelector('.mt-a').value, dis: eval(r).querySelector('.mt-a').disabled, worth: !!eval(r).querySelector('.mt-worth'), total: $('mt_total').textContent, free: $('mt_free').textContent }), row(4));
    await F.evaluate(r => { const s = eval(r).querySelector('.mt-t'); s.value = 'FOC'; s.dispatchEvent(new Event('change', { bubbles: true })); }, row(4));
    const t3 = await F.evaluate(r => ({ a: eval(r).querySelector('.mt-a').value, dis: eval(r).querySelector('.mt-a').disabled, worth: (eval(r).querySelector('.mt-worth') || {}).textContent, total: $('mt_total').textContent }), row(4));
    ok('   typed: Disc % of line 2 → 0 – its ₹ 600 (no longer blue), Bill total ₹2,821.00, We paid ₹821.00', t1.a === '600' && !t1.blue && t1.total === '2,821.00' && t1.we === '821.00', t1);
    ok('   "Car wash" FOC → Paid: its ₹ 250 from 1 × 250, to be typed, total ₹3,071.00, free ₹2,690.00; back to FOC: ₹ 0, worth ₹250.00, total ₹2,821.00', t2.a === '250' && !t2.dis && !t2.worth && t2.total === '3,071.00' && t2.free === '2,690.00' &&
      t3.a === '0' && t3.dis && t3.worth === 'worth ₹250.00' && t3.total === '2,821.00', [t2, t3]);
    const bad2 = await F.evaluate(async () => { $('mt_inspaid').value = '5000'; $('mt_inspaid').dispatchEvent(new Event('input', { bubbles: true })); const we = $('mt_wepaid').textContent;
      let e = ''; try { await mtSave(false); } catch (x) { e = String(x && x.message || x); } $('mt_inspaid').value = '2000'; $('mt_inspaid').dispatchEvent(new Event('input', { bubbles: true })); return { we: we, e: e, after: $('mt_wepaid').textContent }; });
    ok('   the insurance ₹5000 – more than the bill: We paid shows −₹2,179.00 and the save is refused with the reason', bad2.we === '-2,179.00' && /^The insurance part of the bill: the insurance paid ₹5000 – more than the bill \(₹2821\)\.$/.test(bad2.e) && bad2.after === '821.00' &&
      sql('rcl_s2', "select count(*) from maintenance where garage = 'Test Toyota'") === '0', bad2);
    await F.evaluate(() => { const t = document.getElementById('toast'); if (t) t.textContent = ''; $('mt_save').click(); });
    for (let i = 0; i < 40 && sql('rcl_s2', "select count(*) from maintenance where garage = 'Test Toyota'") === '0'; i++) await wait(500);
    const id3 = sql('rcl_s2', "select id from maintenance where garage = 'Test Toyota'"), l3 = linesOf(id3);
    const toastTxt = await F.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    ok('   saved from the page: ' + id3 + ' – ' + C2 + ', the Amount = we paid ₹821; the 8 lines with their kinds, the insurance line (−₹2000, CLM-168)', id3 === 'MT-000003' && amountOf(id3) === '821' &&
      sql('rcl_s2', "select machinery || '|' || bill_no || '|' || km_reading || '|' || service from maintenance where id = 'MT-000003'") === C2 + '|07668, 02040|61234|Yes' &&
      same(l3.map(l => l.type), ['Paid', 'Paid', 'Service Plan', 'Warranty', 'FOC', 'Paid', 'Paid', 'Paid', 'Insurance']) && same(l3[8], { work: INS, type: 'Insurance', claim: 'CLM-168', amount: -2000 }) &&
      same(l3[2], { work: 'Engine oil', type: 'Service Plan', amount: 0, qty: 4.5, rate: 520, disc: 100 }) && same(l3[1], { work: 'Wheel alignment', type: 'Paid', amount: 600, qty: 1, rate: 600, disc: 0 }), [id3, amountOf(id3), l3]);
    ok('   the message: "… saved – ₹821.00. (We paid ₹821.00 of ₹2,821.00.)"', /saved – ₹821\.00\. \(We paid ₹821\.00 of ₹2,821\.00\.\)/.test(toastTxt), toastTxt);
    await wait(2500);
    const lst = await F.evaluate(() => { const tr = [...document.querySelectorAll('#mt_rows tr')].find(t => t.cells[0] && t.cells[0].textContent === 'MT-000003'); return tr ? [...tr.cells].map(c => c.innerText.trim()) : null; });
    const fit = await F.evaluate(() => { const w = document.querySelector('#mt_rows').closest('.table-wrap'); return { sw: w.scrollWidth, cw: w.clientWidth }; });
    ok('   the list: ₹821.00 with "bill ₹2,821.00", "insurance ₹2,000.00 (' + INS + ')", "free worth ₹2,940.00" one under the other; the free lines named with their kind; the list fits the page (no scrolling sideways)', !!lst &&
      lst.some(c => c === '821.00\nbill ₹2,821.00\ninsurance ₹2,000.00 (Test General Insurance)\nfree worth ₹2,940.00') && lst.some(c => /Engine oil \(Service Plan\); Oil filter \(Warranty\); Car wash \(FOC\)/.test(c)) && fit.sw <= fit.cw + 1, [lst, fit]);
    await tidy(); await F.evaluate(() => $('mt_rows').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt168_list.png') });
    // Edit: everything back
    await F.evaluate(() => document.querySelector('[data-mte="MT-000003"]').click()); await wait(2500);
    const ed = await F.evaluate(() => { const trs = [...document.querySelectorAll('#mt_lines tr')];
      return { t: $('mt_title').textContent, kinds: trs.map(tr => tr.querySelector('.mt-t').value), free: trs.filter(tr => tr.classList.contains('mt-free')).length, ins: $('mt_ins').checked, insBox: !$('mt_insbox').hidden,
        insco: $('mt_insco').value, claim: $('mt_insclaim').value, paid: $('mt_inspaid').value, total: $('mt_total').textContent, we: $('mt_wepaid').textContent }; });
    ok('   Edit: "Change bill MT-000003" – the kinds, the 3 free lines, the insurance part (company, claim no., ₹2000), Bill total ₹2,821.00, We paid ₹821.00', ed.t === 'Change bill MT-000003' &&
      same(ed.kinds.slice(0, 8), ['Paid', 'Paid', 'Service Plan', 'Warranty', 'FOC', 'Paid', 'Paid', 'Paid']) && ed.free === 3 && ed.ins && ed.insBox && ed.insco === INS && ed.claim === 'CLM-168' && ed.paid === '2000' && ed.total === '2,821.00' && ed.we === '821.00', ed);
    // the car's log book: We paid
    await F.evaluate(() => mtClear());
    await F.evaluate((no, a, z) => { $('ml_no').value = no; $('ml_from').value = a; $('ml_to').value = z; $('ml_go').click(); }, C2, d1, today);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden)); i++) await wait(400);
    const lb = await F.evaluate(() => { const tb = [...document.querySelectorAll('#rpmlog_body table')], t0 = tb[0];
      return { rows: [...t0.tBodies[0].rows].map(r => [...r.cells].map(c => c.textContent)), foot: [...t0.tFoot.rows].map(r => [...r.cells].map(c => c.textContent)), date: t0.tBodies[0].rows[0].cells[1].rowSpan,
        byfoot: [...document.querySelectorAll('#rpmlog_body tfoot tr')].map(r => r.textContent) }; });
    // (update-170) his format: a row a line; Date / Party / Reading once for the bill (rowspan 9); the tax lines in GST Amount; the insurance's row minus
    ok('   the car\'s log book (update-171 format): the bill\'s 8 lines and the insurance\'s row; its CGST / SGST lines (a bill of before) in CGST 9% / SGST 9%; the free lines (their kind) at ₹ 0; Paid by, Insurance claim Yes, Service Yes; Total – 1 bill: Amount ₹2,399.80, CGST ₹210.60, SGST ₹210.60, GST ₹421.20, With GST ₹821.00; free worth ₹2,940.00; by work: Paid lines of the bills ₹2,821.00, Paid by the insurance −₹2,000.00, We paid ₹821.00',
      lb.rows.length === 9 && lb.date === 9 && lb.rows[0].slice(1, 4).join('|') === d2.split('-').reverse().join('-') + '|Test ToyotaBill 07668, 02040|61,234' &&
      same(lb.rows[0].slice(4), ['Periodic maintenance labour', '1', '', '1,800.00', '1,800.00', '', '', '', '1,800.00', 'RCL', 'Yes', 'Yes', '1,800.00']) && same(lb.rows[2].slice(1), ['Engine oil (Service Plan)', '4.5', '', '520.00', '0.00', '', '', '', '0.00', 'Service Plan', 'Yes', 'Yes', '0.00']) &&
      same(lb.rows[5].slice(1), ['CGST 9%', '', '', '', '', '210.60', '', '210.60', '210.60', 'RCL', 'Yes', 'Yes', '210.60']) && same(lb.rows[8].slice(1), ['Paid by the insurance – ' + INS + ' (claim no. CLM-168)', '', '', '', '', '', '', '', '-2,000.00', 'Insurance', 'Yes', 'Yes', '-2,000.00']) &&
      same(lb.foot[0], ['Total – 1 bill(s)', '2,399.80', '210.60', '210.60', '421.20', '821.00', '', '', '', '821.00']) && same(lb.foot[1], ['Free lines (warranty / FOC / service plan) – not paid, worth', '2,940.00']) &&
      same(lb.byfoot.slice(-3), ['Paid lines of the bills2,821.00', 'Paid by the insurance−2,000.00', 'We paid821.00']), lb);
    await tidy(); await F.evaluate(() => $('rpmlog_out').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt168_logbook.png') });
    // ---- 4. मराठी ----
    await F.evaluate(() => document.querySelector('[data-mte="MT-000003"]').click()); await wait(2500);
    await F.evaluate(() => i18nSet('mr')); await wait(2500);
    const mr = await F.evaluate(() => { const s = [...document.querySelectorAll('#mt_lines tr')][2].querySelector('.mt-t');
      return { opt: [...s.options].map(o => o.textContent + '=' + o.value), val: s.value, head: [...document.querySelectorAll('#sec-mnt .mt-lines thead th')].map(t => t.textContent.trim()).slice(2, 7), ins: document.querySelector('#sec-mnt .mt-ins b').textContent }; });
    ok('4. मराठी: the kinds in Marathi, their English values kept ("Service Plan"); the column names and "Insurance claim" in Marathi', mr.val === 'Service Plan' && mr.opt.indexOf('सर्व्हिस प्लॅन=Service Plan') > -1 && mr.opt.indexOf('वॉरंटी=Warranty') > -1 &&
      mr.head.indexOf('सवलत %') > -1 && mr.ins === 'इन्शुरन्स claim', mr);
    await tidy(); await F.evaluate(() => $('mt_lines').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt168_form_mr.png') });
    await F.evaluate(() => { $('mt_remark').value = 'मराठीतून बदलले'; $('mt_save').click(); });
    for (let i = 0; i < 30 && sql('rcl_s2', "select coalesce(remark, '') from maintenance where id = 'MT-000003'") !== 'मराठीतून बदलले'; i++) await wait(500);
    ok('   saved in Marathi: the kinds sent in English – the lines as before, we paid ₹821', sql('rcl_s2', "select remark from maintenance where id = 'MT-000003'") === 'मराठीतून बदलले' && amountOf('MT-000003') === '821' && same(linesOf('MT-000003'), l3), linesOf('MT-000003'));
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl_s2', "delete from maintenance; delete from diesel_issue where machinery like 'MNT-%168'; delete from master where id like 'MNT-%168'; " +
        "delete from web.props where key in ('FUEL_MODE', 'FUEL_CARDS', 'CARDPAY_LAST_NO', 'MNT_LAST_NO', 'DIESEL_PLACES') or key like 'TANK_CAP_%'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', 'select (select count(*) from maintenance) + (select count(*) from diesel_issue)') + ' bills / fills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
