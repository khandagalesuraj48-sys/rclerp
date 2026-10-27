// update-164 (asked 27-10-2026: "ho madhe diesel stock hot nahi ek card dilelel aahet tya card warun payment kel jat … mi card cha
// opening balance takel nantr apli system auto amount debit dakhwel … driver la adhich samjel card madeh kiti balance aahe … card war
// payment kel tri … payment entry card war add krta yawi … other site la kahi nahi fkt ho site") – the whole way on the local rig
// started with PORTAL=1 (the Portal :3010 from ../rcl-portal, Mechanical :3000 linked to it).
// Site T2 (database rcl_s2, steps 1zg and 1zh run) plays HO, put on fuel cards; S1 (database rcl, step 1zh NOT run) plays VTR –
// exactly as before. Test data only, on the rig; nothing of S1 is saved.
//   1. the Super Admin (the Portal's own screen, Sites → Diesel places): T2 → "Fuel cards – no stock" – kept in T2's settings
//   2. Mechanical at T2: the Portal lists the page Fuel Cards (no Inward / Transfer, no diesel sources); cars; two cards
//   3. the server: a fill by a card or in Cash with its ₹; the checks; no stock entries; the balances; a payment; a statement;
//      the dashboard of cards and cars; the lists' ₹; the Portal cannot take it back to stock
//   4. the page at T2: the menu; Diesel Issue's "Paid by" (the car's cards with their balance, Cash), the Amount, no Register photo,
//      one entry at a time; a fill saved from the form; the page Fuel Cards (a card added, a payment, a statement); the Dashboard
//   5. S1: the page and the server as before
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node cards164.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const HD = 'HDFC FUEL 1', IC = 'ICICI CREDIT', BP = 'BPCL FLEET', PCAR = 'MH-12-HO-1164', DCAR = 'MH-12-HO-2164', ECAR = 'MH-12-HO-3164';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
(async () => {
  const n0 = sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)');
  const has = (db, t, c) => sql(db, "select count(*) from information_schema.columns where table_schema = 'public' and table_name = '" + t + "'" + (c ? " and column_name = '" + c + "'" : ''));
  const errs = []; let b = null;
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  let cookie = '';
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const opts = (F, id) => F.evaluate(i => [...document.getElementById(i).options].map(o => o.value || '(' + o.textContent + ')'), id);
  try {
    ok('start: T2 has no diesel entry; steps 1zg and 1zh run in T2, step 1zh not in S1', n0 === '0' && has('rcl_s2', 'diesel_issue', 'amount') === '1' && has('rcl_s2', 'card_payments') !== '0' && has('rcl', 'card_payments') === '0', [n0, has('rcl_s2', 'diesel_issue', 'amount'), has('rcl', 'card_payments')]);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    // ---- 1. the Portal's own screen: Sites → Diesel places of T2 → Fuel cards – no stock ----
    const pp = await b.newPage(); await pp.setViewport({ width: 1440, height: 1000 }); pp.on('pageerror', e => errs.push('Portal: ' + String(e.message).slice(0, 200)));
    await pp.setCookie({ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: P });
    await pp.goto(P + '/', { waitUntil: 'networkidle0' });
    await pp.evaluate(() => { const t = [...document.querySelectorAll('button, a')].find(x => /^\s*Sites\s*$/.test(x.textContent)); if (t) t.click(); });
    for (let i = 0; i < 60 && !(await pp.$('#st_rows .st-places[data-code="T2"]')); i++) await wait(500);
    await pp.click('#st_rows .st-places[data-code="T2"]');
    for (let i = 0; i < 60 && !(await pp.$('#dp_panel input[name="dp_mode"]')); i++) await wait(500);
    const m0 = await pp.evaluate(() => ({ mode: (document.querySelector('#dp_panel input[name="dp_mode"]:checked') || {}).value, box: !document.getElementById('dp_box').hidden }));
    ok('1. the Portal (Sites → Diesel places, T2): "How fuel is given" – From diesel places (stock) chosen, the places shown', m0.mode === 'stock' && m0.box, m0);
    // the tank sizes of the places stay as they are (filled if the screen shows none – the form needs a size)
    await pp.evaluate(() => document.querySelectorAll('#dp_box .pl-cap').forEach(i => { if (!i.value) i.value = 1000; }));
    await pp.click('#dp_panel input[name="dp_mode"][value="card"]'); await wait(300);
    const m1 = await pp.evaluate(() => ({ box: document.getElementById('dp_box').hidden, note: !document.querySelector('#dp_panel .dp-cnote').hidden }));
    ok('   "Fuel cards – no stock" picked: the places are hidden, the note says the cards are made in Mechanical → Fuel Cards', m1.box && m1.note, m1);
    await pp.evaluate(() => document.getElementById('dp_panel').scrollIntoView({ block: 'start' })); await wait(300);
    await pp.screenshot({ path: SHOT + '/cards164_portal.png', clip: await pp.evaluate(() => { const r = document.getElementById('dp_panel').getBoundingClientRect(); return { x: r.left, y: Math.max(0, r.top), width: r.width, height: Math.min(r.height, 600) }; }) });
    await pp.click('#dp_save');
    let fm = ''; for (let i = 0; i < 40; i++) { await wait(500); fm = sql('rcl_s2', "select coalesce((select value from web.props where key = 'FUEL_MODE'), '')"); if (fm === 'card') break; }
    ok('   Save: kept in T2\'s own settings (FUEL_MODE = card)', fm === 'card', fm);
    const pg0 = await preq('/api/admin', { action: 'placesGet', site: 'T2' });
    ok('   the Portal asked again: T2 on fuel cards, no card entry yet', pg0.mode === 'card' && pg0.cardEntries === false, pg0);
    ok('   the Activity Log of T2 says it', /fuel cards, no stock/.test(sql('rcl_s2', "select summary from activity_log where record_id = 'Diesel places' order by at desc limit 1")));
    // ---- 2. Mechanical at T2 (the Super Admin opens it: Admin there) ----
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('T2')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today;
    ok('2. Mechanical at T2: fuelMode = card', init.fuelMode === 'card', init.fuelMode);
    const mp0 = await preq('/api/admin', { action: 'mechPages', site: 'T2' });
    const keys = (mp0.pages || []).map(p => p.key);
    ok('   the Portal\'s Users & Access → Pages of T2: Fuel Cards listed, no Diesel Inward / Transfer; no diesel sources', keys.indexOf('Fuel Cards') > -1 && keys.indexOf('Diesel Inward') === -1 && keys.indexOf('Diesel Transfer') === -1 && same(mp0.places, []), [keys, mp0.places]);
    const car = (no, fuel, extra) => Object.assign({ no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 12, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01', fuel: fuel }, extra || {});
    const mm = [await J('saveMaster', car('MH12HO1164', 'Petrol'), 'add'), await J('saveMaster', car('MH12HO2164', 'Diesel'), 'add'), await J('saveMaster', car('MH12HO3164', 'Electric', { kmStd: '' }), 'add')];
    ok('   three cars: Petrol, Diesel, Electric', mm.every(x => x && !x.ERROR), mm);
    const c1 = await J('saveCard', { name: HD, last4: '4321', type: 'Fuel card', cars: [], opening: 5000, openDate: today });
    const c2 = await J('saveCard', { name: IC, type: 'Credit card', cars: [PCAR], opening: 1000, openDate: today });
    const props = sql('rcl_s2', "select coalesce((select value from web.props where key = 'FUEL_CARDS'), '')");
    ok('   two cards saved (HDFC FUEL 1 for every car, ICICI CREDIT for the Petrol car) – kept in T2\'s settings with only the last 4 digits', c1.ok && c2.ok && same(JSON.parse(props || '[]').map(c => c.name + ':' + c.last4 + ':' + c.cars.join('|')), [HD + ':4321:', IC + '::' + PCAR]), [c1, c2, props]);
    ok('   the Activity Log: "Fuel card added: HDFC FUEL 1 – Fuel card, …4321, opening ₹5000 …"', /^Fuel card added: HDFC FUEL 1 – Fuel card, …4321, opening ₹5000 on /.test(sql('rcl_s2', "select summary from activity_log where module = 'Fuel Cards' and record_id = 'HDFC FUEL 1' order by at desc limit 1")));
    // ---- 3. the server ----
    const fill = (no, src, qty, amount, extra) => Object.assign({ date: today, shift: 'Day', source: src, no: no, qty: qty, kmReading: '', amount: amount, force: true }, extra || {});
    let x = await J('saveDieselIssue', fill(PCAR, HD, 10, 1050, { kmReading: 1000 }));
    const r1 = sql('rcl_s2', "select source || '|' || amount || '|' || rate from diesel_issue where id = '" + (x.id || '') + "'");
    ok('3. a fill of the Petrol car by HDFC FUEL 1, ₹1050 for 10 Ltr: saved – the card in Diesel Source, ₹1050, rate 105', x.ok && r1 === HD + '|1050|105', [x, r1]);
    ok('   the balance comes back with the save: HDFC FUEL 1 ₹3950', ((x.stock || {}).cards || []).find(c => c.name === HD).balance === 3950, x.stock);
    x = await J('saveDieselIssue', fill(DCAR, IC, 10, 900));
    ok('   ICICI CREDIT for the Diesel car: refused – "card ICICI CREDIT is not for this car"', x.ERROR === DCAR + ': card ICICI CREDIT is not for this car (Fuel Cards → its cars) – pick its own card or Cash.', x);
    x = await J('saveDieselIssue', fill(DCAR, HD, 10, ''));
    ok('   no Amount: refused', x.ERROR === DCAR + ': enter the Amount (₹) of this fill.', x);
    x = await J('saveDieselIssue', fill(ECAR, 'Cash', 5, 500));
    ok('   the Electric car: refused', x.ERROR === ECAR + ' runs on Electric – no fuel is issued to it (Asset Master → Fuel).', x);
    x = await J('saveDieselIssue', fill(DCAR, 'Cash', 10, 900));
    ok('   the Diesel car in Cash ₹900: saved – no card changes', x.ok && sql('rcl_s2', "select source from diesel_issue where id = '" + x.id + "'") === 'Cash', x);
    x = await J('saveDieselIssue', fill(PCAR, IC, 15, 1500));
    ok('   ICICI CREDIT ₹1500 on a balance of ₹1000: saved (the fuel is in the car) – the balance −500', x.ok && x.stock.cards.find(c => c.name === IC).balance === -500, x.stock);
    const inw = await J('saveInward', { date: today, location: 'Dispenser', pump: 'P', qty: 100, rate: 90, billNo: 'X164', billDate: today });
    const trf = await J('saveTransfer', { date: today, shift: 'Day', from: 'Dispenser', to: 'VTR Store', qty: 5 });
    const blk = await J('saveDieselBulk', { date: today, shift: 'Day', source: HD, rows: [{ no: PCAR, qty: 1 }] });
    ok('   no stock entries at a site on fuel cards: Inward, Transfer and "Multiple entries" refused', /it keeps no diesel stock, so a Diesel Inward is not made here/.test(inw.ERROR || '') && /a Diesel Transfer is not made here/.test(trf.ERROR || '') && /"Multiple entries" of diesel issues is not made here/.test(blk.ERROR || ''), [inw, trf, blk]);
    const pay = await J('saveCardPayment', { date: today, card: IC, amount: 2000, ref: 'NEFT 164' });
    ok('   a payment of ₹2000 onto ICICI CREDIT: CP-000001 in card_payments; the balance ₹1500', pay.ok && pay.id === 'CP-000001' && sql('rcl_s2', "select card || '|' || amount || '|' || reference from card_payments where id = 'CP-000001'") === IC + '|2000|NEFT 164' && pay.cards.find(c => c.name === IC).balance === 1500, pay);
    const st = await J('cardStatement', { card: IC });
    ok('   the statement of ICICI CREDIT: opening 1000, the fill −1500, the payment +2000, closing 1500', st.opening === 1000 && st.lines.length === 2 && st.closing === 1500 && st.lines.some(l => l.kind === 'Fill' && l.out === 1500 && l.no === PCAR) && st.lines.some(l => l.kind === 'Payment' && l.in === 2000), st);
    const li = await J('getDieselIssues', { from: today, to: today });
    ok('   the Diesel Issue list: the ₹ of each card / Cash; the fuels apart (Petrol 25, Diesel 10)', same(li.byPay, { [HD]: 1050, Cash: 900, [IC]: 1500 }) && li.totalAmount === 3450 && li.byFuel && li.byFuel.Petrol === 25 && li.byFuel.Diesel === 10, [li.byPay, li.totalAmount, li.byFuel]);
    const dd = await J('getCardDash', {});
    const pc = (dd.cars || []).find(c => c.no === PCAR) || {};
    ok('   the dashboard (this month): the cards\' balances; the Petrol car 25 Ltr, ₹2550 by card, 2 fills, its last fill ICICI CREDIT ₹1500', same(dd.cards.map(c => c.name + ':' + c.balance), [HD + ':3950', IC + ':1500']) && pc.qty === 25 && pc.card === 2550 && pc.cash === 0 && pc.fills === 2 && pc.last.paidBy === IC && pc.last.amount === 1500, [dd.cards, pc]);
    const back = await preq('/api/admin', { action: 'placesSave', site: 'T2', places: (pg0.places || []).map(p => ({ name: p.name, cap: p.cap || 1000 })), mode: 'stock' });
    ok('   the Portal cannot take T2 back to diesel stock now – "it stays on fuel cards"', /it stays on fuel cards/.test(JSON.stringify(back)) && sql('rcl_s2', "select value from web.props where key = 'FUEL_MODE'") === 'card', back);
    // ---- 4. the page at T2 ----
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('T2: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('T2'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && S.fuelMode === 'card' && Array.isArray(S.cards) && S.cards.length === 2);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    const nav = await F.evaluate(() => ({ cards: !$('tab-cards').hidden, inward: !$('tab-inward').hidden, transfer: !$('tab-transfer').hidden, stock: !($('tab-rp-stock') || { hidden: true }).hidden }));
    ok('4. the page: the menu has Fuel Cards; no Diesel Inward, Transfer or Stock Register', nav.cards && !nav.inward && !nav.transfer && !nav.stock, nav);
    await F.evaluate(() => showTab('diesel')); await wait(2000);
    await F.evaluate(n => { const i = $('d_no'); i.value = n; i.dispatchEvent(new Event('change', { bubbles: true })); }, PCAR); await wait(900);
    const f0 = await F.evaluate(() => ({ lbl: $('d_src_lbl').textContent.trim(), opts: [...$('d_src').options].map(o => o.textContent), amt: !$('d_amt').closest('.field').hidden, pill: $('d_pill').hidden,
      many: getComputedStyle($('dmode_many').closest('.switch')).display, tiles: [...document.querySelectorAll('#d_ph_grid .dph-lbl')].map(x => x.textContent), qty: document.querySelector('label[for="d_qty"]').textContent.trim() }));
    ok('   Diesel Issue of the Petrol car: "Paid by" = HDFC FUEL 1 – ₹3,950.00, ICICI CREDIT – ₹1,500.00, Cash; the Amount box; no stock pill; one entry at a time; no Register photo', /^Paid by/.test(f0.lbl) && same(f0.opts, [HD + ' – ₹3,950.00', IC + ' – ₹1,500.00', 'Cash']) && f0.amt && f0.pill && f0.many === 'none' && f0.tiles.indexOf('Register') === -1 && f0.tiles.indexOf('Dispenser litres') > -1 && /^Petrol Qty \(Ltr\)/.test(f0.qty), f0);
    await F.evaluate(n => { const i = $('d_no'); i.value = n; i.dispatchEvent(new Event('change', { bubbles: true })); }, DCAR); await wait(700);
    ok('   the Diesel car: only HDFC FUEL 1 and Cash (ICICI CREDIT is for the Petrol car)', same(await opts(F, 'd_src'), [HD, 'Cash']), await opts(F, 'd_src'));
    await F.evaluate(n => { const i = $('d_no'); i.value = n; i.dispatchEvent(new Event('change', { bubbles: true })); }, PCAR); await wait(700);
    await F.evaluate(hd => { $('d_src').value = hd; $('d_src').dispatchEvent(new Event('change', { bubbles: true })); $('d_qty').value = 20; $('d_qty').dispatchEvent(new Event('input', { bubbles: true }));
      $('d_amt').value = 2100; $('d_amt').dispatchEvent(new Event('input', { bubbles: true })); $('d_km').value = 1200; }, HD); await wait(500);
    const after = await F.evaluate(() => ({ line: $('d_after').textContent, bal: $('d_balance').value, lbl: $('d_bal_lbl').textContent }));
    ok('   typed 20 Ltr, ₹2100 on HDFC FUEL 1: "balance now ₹3,950.00 → after this fill ₹1,850.00"', /balance now ₹3,950\.00 → after this fill ₹1,850\.00/.test(after.line) && after.bal === '1,850.00' && after.lbl === 'Card balance after (₹)', after);
    const calm = () => F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) y.hidden = true; }); });
    const shotOf = async (sel, file) => { await calm(); await F.evaluate(q => document.querySelector(q).closest('.panel, section, .card, .dsum').scrollIntoView({ block: 'start' }), sel); await wait(800);
      const rr = await F.evaluate(q => { const y = document.querySelector(q).closest('.panel, section, .card, .dsum').getBoundingClientRect(); return { x: y.left, y: Math.max(0, y.top), w: y.width, h: Math.min(y.bottom, window.innerHeight) - Math.max(0, y.top) }; }, sel);
      const fr = await (await F.frameElement()).boundingBox(); if (rr.w > 0 && rr.h > 0) await mp.screenshot({ path: SHOT + '/' + file, clip: { x: fr.x + rr.x, y: fr.y + rr.y, width: rr.w, height: Math.min(rr.h, 760) } }); };
    await shotOf('#d_src', 'cards164_issue.png');
    await F.evaluate(() => $('d_save').click());
    let saved = ''; for (let i = 0; i < 40; i++) { await wait(500); await F.evaluate(() => { if (!$('cf_back').hidden) $('cf_ok').click(); }); saved = sql('rcl_s2', "select count(*) from diesel_issue where machinery = '" + PCAR + "' and amount = 2100 and source = '" + HD + "'"); if (saved === '1') break; }
    ok('   Save diesel issue (the page): saved with its card and ₹2100', saved === '1', saved);
    await wait(2500);
    const lst = await F.evaluate(hd => ({ src: $('d_th_src').textContent, bal: $('d_th_bal').textContent, foot: $('d_foot').innerText, card: (S.cards.find(c => c.name === hd) || {}).balance }), HD);
    ok('   the list: "Paid by" and "Amount (₹)"; the total ₹ of each card / Cash; HDFC FUEL 1 now ₹1850', lst.src === 'Paid by' && lst.bal === 'Amount (₹)' && /₹5,550\.00/.test(lst.foot) && /HDFC FUEL 1 ₹3,150\.00/.test(lst.foot) && lst.card === 1850, lst);
    // the page Fuel Cards
    await F.evaluate(() => showTab('cards')); await wait(2000);
    const cp0 = await F.evaluate(() => ({ tiles: document.querySelectorAll('#cd_tiles .cd-card').length, rows: [...document.querySelectorAll('#cd_rows tr')].map(tr => tr.cells[0].textContent + '=' + tr.cells[8].textContent), neg: document.querySelectorAll('#cd_tiles .cd-card.neg').length }));
    ok('   Fuel Cards: a tile and a row for each card with its balance (HDFC FUEL 1 1,850.00 · ICICI CREDIT 1,500.00)', cp0.tiles === 2 && same(cp0.rows, [HD + '=1,850.00', IC + '=1,500.00']), cp0);
    await F.evaluate(() => $('cd_add').click()); await wait(400);
    await F.evaluate((bp, car) => { $('cd_name').value = bp; $('cd_type').value = 'Fuel card'; $('cd_last4').value = '9876'; $('cd_open').value = 3000; $('cd_date').value = S.today;
      [...document.querySelectorAll('#cd_cars .cd-car')].forEach(i => { i.checked = i.value === car; }); }, BP, DCAR);
    await F.evaluate(() => $('cd_save').click());
    let bp = ''; for (let i = 0; i < 30; i++) { await wait(500); bp = sql('rcl_s2', "select coalesce((select value from web.props where key = 'FUEL_CARDS'), '')"); if (/BPCL FLEET/.test(bp)) break; }
    ok('   "+ Add card" in the page: BPCL FLEET (…9876, ₹3000, the Diesel car) – kept', JSON.parse(bp || '[]').some(c => c.name === BP && c.last4 === '9876' && c.opening === 3000 && same(c.cars, [DCAR])), bp);
    await wait(1200);
    await F.evaluate(bp => { $('cp_card').value = bp; $('cp_amount').value = 500; $('cp_ref').value = 'UPI 164'; }, BP);
    await F.evaluate(() => $('cp_save').click());
    let cpr = ''; for (let i = 0; i < 30; i++) { await wait(500); cpr = sql('rcl_s2', "select count(*) from card_payments where card = 'BPCL FLEET' and amount = 500"); if (cpr === '1') break; }
    ok('   a payment of ₹500 onto BPCL FLEET from the page: in card_payments', cpr === '1', cpr);
    await wait(1500);
    await F.evaluate(bp => { $('cs_card').value = bp; }, BP); await F.evaluate(() => $('cs_show').click()); await wait(2500);
    const cs = await F.evaluate(() => $('cs_out').innerText.replace(/\s+/g, ' '));
    ok('   its statement: opening 3,000.00, the payment 500.00, closing 3,500.00', /Opening balance 3,000\.00/.test(cs) && /Payment – UPI 164 500\.00 3,500\.00/.test(cs) && /Closing balance 500\.00 0\.00 3,500\.00/.test(cs), cs);
    await shotOf('#cd_tiles', 'cards164_cards.png');
    // the Dashboard
    await F.evaluate(() => showTab('dash')); await wait(3000);
    const dsh = await F.evaluate(pcar => ({ card: !$('dash_card').hidden, diesel: $('dash_diesel').hidden, tab: $('dtab-diesel').textContent, tiles: [...document.querySelectorAll('#hd_cards .cd-card > b')].map(x => x.textContent),
      row: ([...document.querySelectorAll('#hd_rows tr')].find(tr => tr.cells[0].textContent.indexOf(pcar) === 0) || { innerText: '' }).innerText.replace(/\s+/g, ' '), tot: $('hd_tot').textContent }), PCAR);
    ok('   the Dashboard: "Fuel cards & cars" – the balance of each card; the Petrol car 45 Ltr, ₹4,650.00, 3 fills', dsh.card && dsh.diesel && dsh.tab === 'Fuel cards & cars' && dsh.tiles.length === 3 && /45 Ltr/.test(dsh.row) && /4,650\.00/.test(dsh.row) && /Petrol 45 Ltr · Diesel 10 Ltr/.test(dsh.tot), dsh);
    await shotOf('#hd_cards', 'cards164_dash.png');
    // ---- 5. S1: as before ----
    const s1 = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J1 = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [s1.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const i1 = await J1('getInit');
    ok('5. S1: not on fuel cards; no cards in its stock; Fuel Cards not listed in the Portal', i1.fuelMode === '' && !('cards' in (i1.stock || {})) && ((await preq('/api/admin', { action: 'mechPages', site: 'S1' })).pages || []).every(p => p.key !== 'Fuel Cards'), [i1.fuelMode, i1.stock]);
    x = await J1('saveCard', { name: 'X', type: 'Fuel card', opening: 1, openDate: i1.today });
    ok('   S1: a card is refused – "This site is not on fuel cards …"', x.ERROR === 'This site is not on fuel cards – the Super Admin sets that in the Portal (Sites → Diesel places → Fuel cards).', x);
    const vp = await b.newPage(); await vp.setViewport({ width: 1600, height: 1000 }); vp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await vp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const V = await find(vp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations) && S.locations.length > 0 && !!S.placeFuels);
    await V.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await V.evaluate(() => showTab('diesel')); await wait(1500);
    const v = await V.evaluate(() => ({ cards: !$('tab-cards').hidden, inward: !$('tab-inward').hidden, lbl: $('d_src_lbl').textContent.trim(), amt: [...document.querySelectorAll('.card-f')].every(x => x.hidden), pill: !$('d_pill').hidden, src: [...$('d_src').options].map(o => o.value), locs: S.locations, th: $('d_th_bal').textContent }));
    ok('   S1\'s page: no Fuel Cards, Diesel Inward there; "Diesel Source" every place; no Amount box; the stock pill; Balance (Ltr)', !v.cards && v.inward && /^Diesel Source/.test(v.lbl) && v.amt && v.pill && same(v.src, v.locs) && v.th === 'Balance (Ltr)', v);
    ok('no error on the pages', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    try { if (b) await b.close(); } catch (e) {}
    try {      // the test's own data out again (rig only): T2's fills, payments, cars, cards and mode of this test; S1 had nothing saved
      if (n0 === '0') sql('rcl_s2', "delete from diesel_issue where machinery like 'MH-12-HO-%164'; delete from card_payments; delete from master where id like 'MH-12-HO-%164'; " +
        "delete from web.props where key in ('FUEL_MODE', 'FUEL_CARDS', 'CARDPAY_LAST_NO', 'DIESEL_PLACES') or key like 'TANK_CAP_%'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from card_payments)') + ' fills / payments; FUEL_MODE ' + sql('rcl_s2', "select count(*) from web.props where key = 'FUEL_MODE'"));
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
