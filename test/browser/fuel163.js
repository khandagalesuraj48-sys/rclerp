// update-163 (asked 26-10-2026: "petrol cng he field banaw ani ha electric ha pn thew future madhe ya gadya pn yenar aahet") –
// the whole way on the local rig started with PORTAL=1 (the Portal :3010 from ../rcl-portal, Mechanical :3000 linked to it).
// Site T2 (database rcl_s2, no diesel entry, step 1zg run) plays HO with a place per fuel card; S1 (database rcl, step 1zg NOT
// run) plays VTR – all Diesel, exactly as before. Test data only, on the rig; nothing of S1 is saved.
//   1. the Super Admin (the Portal's own screen, Sites → Diesel places): T2's places DIESEL CARD, PETROL CARD (Petrol), CNG CARD
//      (CNG), PETROL CAN (Petrol) – kept in T2's database with their fuel
//   2. Mechanical at T2: cars of each fuel (Asset Master → Fuel); inward at each card
//   3. the server: a fill only from a place of the car's fuel; Electric gets none; a transfer only within one fuel; CNG in kg
//   4. the lists, the dashboard and a report of ONE fuel – never added together
//   5. the page at T2: Diesel Issue offers the places of the car's fuel; Transfer To of the From's fuel; the dashboard's Fuel;
//      a report's Fuel; the Asset Master's Fuel; units in kg for CNG
//   6. S1 (all Diesel, no step 1zg): the page as before – no Fuel box anywhere; a Diesel machinery saves, a Petrol one asks for the step
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node fuel163.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const DC = 'DIESEL CARD', PC = 'PETROL CARD', CC = 'CNG CARD', PK = 'PETROL CAN';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
(async () => {
  const n0 = sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)');
  const hasCol = db => sql(db, "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'master' and column_name = 'fuel'");
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
    ok('start: T2 has no diesel entry; step 1zg run in T2, not in S1', n0 === '0' && hasCol('rcl_s2') === '1' && hasCol('rcl') === '0', [n0, hasCol('rcl_s2'), hasCol('rcl')]);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    // ---- 1. the Portal's own screen: Sites → Diesel places of T2 – a Fuel box in each row ----
    const pp = await b.newPage(); await pp.setViewport({ width: 1440, height: 1000 }); pp.on('pageerror', e => errs.push('Portal: ' + String(e.message).slice(0, 200)));
    await pp.setCookie({ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: P });
    await pp.goto(P + '/', { waitUntil: 'networkidle0' });
    await pp.evaluate(() => { const t = [...document.querySelectorAll('button, a')].find(x => /^\s*Sites\s*$/.test(x.textContent)); if (t) t.click(); });
    for (let i = 0; i < 60 && !(await pp.$('#st_rows .st-places[data-code="T2"]')); i++) await wait(500);
    await pp.click('#st_rows .st-places[data-code="T2"]');
    for (let i = 0; i < 60 && !(await pp.$('#dp_box .pl-fuel')); i++) await wait(500);
    const before = await pp.evaluate(() => [...document.querySelectorAll('#dp_box .pl-rows tr')].map(tr => tr.querySelector('.pl-name').value + ':' + tr.querySelector('.pl-fuel').value));
    ok('1. the Portal (Sites → Diesel places, T2): a Fuel box in each row – the places of before are Diesel', before.length > 0 && before.every(x => /:Diesel$/.test(x)) &&
      await pp.evaluate(() => [...document.querySelectorAll('#dp_panel thead th')].map(x => x.textContent).join('|')) === 'Diesel place|Fuel|Tank size (Ltr)|Stock now|', before);
    // the four places, typed in the screen, then Save diesel places
    await pp.evaluate((rows) => {
      const tb = document.querySelector('#dp_box .pl-rows');
      while (tb.children.length < rows.length) document.querySelector('#dp_box .pl-add').click();
      [...tb.children].forEach((tr, i) => { const r = rows[i]; if (!r) { tr.remove(); return; } tr.querySelector('.pl-name').value = r[0]; tr.querySelector('.pl-fuel').value = r[1]; tr.querySelector('.pl-cap').value = r[2]; });
    }, [[DC, 'Diesel', 500], [PC, 'Petrol', 500], [CC, 'CNG', 300], [PK, 'Petrol', 100]]);
    await pp.evaluate(() => document.getElementById('dp_panel').scrollIntoView({ block: 'start' })); await wait(300);
    await pp.screenshot({ path: SHOT + '/fuel163_portal.png', clip: await pp.evaluate(() => { const r = document.getElementById('dp_panel').getBoundingClientRect(); return { x: r.left, y: Math.max(0, r.top), width: r.width, height: Math.min(r.height, 700) }; }) });
    await pp.click('#dp_save');
    let pl = ''; for (let i = 0; i < 40; i++) { await wait(500); pl = sql('rcl_s2', "select coalesce((select value from web.props where key = 'DIESEL_PLACES'), '')"); if (/CNG CARD/.test(pl)) break; }
    ok('   Save diesel places: kept in T2\'s own database with the fuel of each (Diesel kept as nothing, as a place of before)', same(JSON.parse(pl || '[]').map(p => p.name + ':' + (p.fuel || '')), [DC + ':', PC + ':Petrol', CC + ':CNG', PK + ':Petrol']), pl);
    const pg = await preq('/api/admin', { action: 'placesGet', site: 'T2' });
    ok('   the Portal asked again: each place with its fuel', same((pg.places || []).map(p => p.name + ':' + p.fuel), [DC + ':Diesel', PC + ':Petrol', CC + ':CNG', PK + ':Petrol']), pg);
    ok('   the Activity Log of T2 says the fuel', /PETROL CARD 500 Ltr Petrol, CNG CARD 300 Ltr CNG, PETROL CAN 100 Ltr Petrol/.test(sql('rcl_s2', "select summary from activity_log where record_id = 'Diesel places' order by at desc limit 1")));
    // ---- 2. Mechanical at T2 (the Super Admin opens it: Admin there) ----
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('T2')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J('getInit')).today;
    const car = (no, fuel, extra) => Object.assign({ no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 12, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01', fuel: fuel }, extra || {});
    const m = [await J('saveMaster', car('MH12HO0163', 'Diesel'), 'add'), await J('saveMaster', car('MH12HO1163', 'Petrol'), 'add'), await J('saveMaster', car('MH12HO2163', 'CNG'), 'add'), await J('saveMaster', car('MH12HO3163', 'Electric', { kmStd: '' }), 'add')];
    ok('2. four cars: Diesel, Petrol, CNG, Electric (no standard average for Electric) – kept in master.fuel (Diesel = empty)', m.every(x => x && !x.ERROR) &&
      sql('rcl_s2', "select string_agg(id || ':' || coalesce(fuel, ''), ',' order by id) from master where id like 'MH-12-HO-%163'") === 'MH-12-HO-0163:,MH-12-HO-1163:Petrol,MH-12-HO-2163:CNG,MH-12-HO-3163:Electric', [m, sql('rcl_s2', "select string_agg(id || ':' || coalesce(fuel, ''), ',' order by id) from master where id like 'MH-12-HO-%163'")]);
    const inw = await Promise.all([[DC, 200], [PC, 150], [CC, 40]].map((x, i) => J('saveInward', { date: today, location: x[0], pump: 'Card 163', qty: x[1], rate: 100, billNo: 'F163-' + i, billDate: today })));
    ok('   inward at each card (the fuel of the place): 200 / 150 / 40', inw.every(x => x && x.ok), inw);
    // ---- 3. the server ----
    const iss = (no, src, qty, km) => ({ date: today, shift: 'Day', source: src, no: no, qty: qty, kmReading: km, force: true });
    let x = await J('saveDieselIssue', iss('MH-12-HO-1163', DC, 10, 1000));
    ok('3. the Petrol car from DIESEL CARD: refused – "DIESEL CARD holds Diesel and MH-12-HO-1163 runs on Petrol – pick a Petrol place (Asset Master → Fuel)."', x.ERROR === 'DIESEL CARD holds Diesel and MH-12-HO-1163 runs on Petrol – pick a Petrol place (Asset Master → Fuel).', x);
    x = await J('saveDieselIssue', iss('MH-12-HO-3163', PC, 10, 1000));
    ok('   the Electric car: refused – no fuel is issued to it', x.ERROR === 'MH-12-HO-3163 runs on Electric – no fuel is issued to it (Asset Master → Fuel).', x);
    const good = [await J('saveDieselIssue', iss('MH-12-HO-1163', PC, 30, 1000)), await J('saveDieselIssue', iss('MH-12-HO-0163', DC, 50, 2000)), await J('saveDieselIssue', iss('MH-12-HO-2163', CC, 8, 3000))];
    ok('   Petrol from PETROL CARD 30, Diesel from DIESEL CARD 50, CNG from CNG CARD 8: saved', good.every(y => y && y.ok), good);
    x = await J('saveDieselIssue', iss('MH-12-HO-2163', CC, 100, 3100));
    ok('   CNG beyond the stock: "Not enough CNG at CNG CARD … Available: 32 kg, you are issuing: 100 kg."', /^Not enough CNG at CNG CARD for .+ \(Day\)\. Available: 32 kg, you are issuing: 100 kg\.$/.test(x.ERROR || ''), x);
    x = await J('saveDieselBulk', { date: today, shift: 'Day', source: PC, rows: [{ no: 'MH-12-HO-0163', qty: 5, kmReading: 2100, mode: 'KM' }] });
    ok('   "many at once" at PETROL CARD with the Diesel car: refused for that row', x && x.ok === false && /PETROL CARD holds Petrol and MH-12-HO-0163 runs on Diesel/.test(JSON.stringify(x.errors)), x);
    x = await J('saveTransfer', { date: today, shift: 'Day', from: PC, to: DC, qty: 5 });
    ok('   a transfer PETROL CARD → DIESEL CARD: refused – only within one fuel', x.ERROR === 'A transfer goes only between places of the same fuel: PETROL CARD holds Petrol, DIESEL CARD holds Diesel.', x);
    x = await J('saveTransfer', { date: today, shift: 'Day', from: PC, to: PK, qty: 20 });
    ok('   PETROL CARD → PETROL CAN 20: saved', x && x.ok, x);
    x = await preq('/api/admin', { action: 'placesSave', site: 'T2', places: [{ name: DC, cap: 500 }, { name: PC, cap: 500, fuel: 'Diesel' }, { name: CC, cap: 300, fuel: 'CNG' }, { name: PK, cap: 100, fuel: 'Petrol' }] });
    ok('   the Portal: PETROL CARD (it has entries) cannot become Diesel', /PETROL CARD \(Petrol\) has entries – its fuel cannot be changed/.test(JSON.stringify(x)), x);
    // ---- 4. lists, the dashboard and a report of one fuel ----
    const li = await J('getDieselIssues', { from: today, to: today });
    ok('4. the Diesel Issue list: the total of each fuel – Diesel 50, Petrol 30, CNG 8 (never added together)', same(Object.keys(li.byFuel || {}).sort().map(k => k + ':' + li.byFuel[k]), ['CNG:8', 'Diesel:50', 'Petrol:30']), li.byFuel);
    const dP = await J('getDashboard', { from: today, to: today, fuel: 'Petrol' }), dC = await J('getDashboard', { from: today, to: today, fuel: 'CNG' }), d0 = await J('getDashboard', { from: today, to: today });
    ok('   the dashboard of Petrol: issued 30, received 150, its places only (PETROL CARD 100, PETROL CAN 20)', dP.total.qty === 30 && dP.inward.qty === 150 && same(dP.stock.byLoc, { [PC]: 100, [PK]: 20 }), [dP.total, dP.inward, dP.stock]);
    ok('   of CNG: issued 8, stock 32', dC.total.qty === 8 && same(dC.stock.byLoc, { [CC]: 32 }), [dC.total, dC.stock]);
    ok('   no fuel sent (an app of before): every fuel as before, the stock told per fuel', d0.total.qty === 88 && same(Object.keys(d0.stock.byFuel || {}).sort().map(k => k + ':' + d0.stock.byFuel[k]), ['CNG:32', 'Diesel:150', 'Petrol:120']), [d0.total, d0.stock]);
    const rm = await J('getMonthlyDieselReport', { from: today, to: today, source: '', shift: '', supply: '', ownerships: ['Own', 'Rental', 'Hired', 'Debit', 'Other'], machines: [], fuel: 'CNG' });
    ok('   the Monthly Diesel Issue report of CNG: only the CNG car, 8', rm.total === 8 && JSON.stringify(rm.groups).indexOf('MH-12-HO-1163') === -1 && JSON.stringify(rm.groups).indexOf('MH-12-HO-2163') > -1, rm.total);
    // ---- 5. the page at T2 ----
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('T2: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('T2'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations) && S.locations.length === 4 && !!S.placeFuels);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    ok('5. the page knows the fuel of each place', same(await F.evaluate(() => S.placeFuels), { [DC]: 'Diesel', [PC]: 'Petrol', [CC]: 'CNG', [PK]: 'Petrol' }));
    await F.evaluate(() => showTab('diesel')); await wait(2000);
    const pick = async no => { await F.evaluate(n => { const i = $('d_no'); i.value = n; i.dispatchEvent(new Event('change', { bubbles: true })); }, no); await wait(900);
      return { src: await opts(F, 'd_src'), qty: await F.evaluate(() => document.querySelector('label[for="d_qty"]').textContent.trim()), note: await F.evaluate(() => $('d_inactive').hidden ? '' : $('d_inactive').textContent), fuel: await F.evaluate(() => $('d_f_fuel_w').hidden ? '' : $('d_f_fuel').textContent), unit: await F.evaluate(() => $('d_pill_u').textContent) }; };
    const pP = await pick('MH-12-HO-1163'), pC = await pick('MH-12-HO-2163'), pD = await pick('MH-12-HO-0163'), pE = await pick('MH-12-HO-3163');
    ok('   Diesel Issue – the Petrol car: Source = PETROL CARD, PETROL CAN; "Petrol Qty (Ltr)"; Fuel Petrol', same(pP.src, [PC, PK]) && /^Petrol Qty \(Ltr\)/.test(pP.qty) && pP.fuel === 'Petrol', pP);
    ok('   the CNG car: Source = CNG CARD; "CNG Qty (kg)"; the stock in kg', same(pC.src, [CC]) && /^CNG Qty \(kg\)/.test(pC.qty) && pC.unit === 'kg', pC);
    ok('   the Diesel car: Source = DIESEL CARD; "Diesel Qty (Ltr)" as before', same(pD.src, [DC]) && /^Diesel Qty \(Ltr\)/.test(pD.qty) && pD.unit === 'Ltr', pD);
    ok('   the Electric car: "runs on Electric – no fuel is issued to it"', /MH-12-HO-3163 runs on Electric – no fuel is issued to it/.test(pE.note), pE);
    await pick('MH-12-HO-2163'); await wait(1200);
    const hist = await F.evaluate(() => $('d_hist').hidden ? '' : $('d_hist').innerText.replace(/\s+/g, ' '));
    ok('   its fill history in its words: "CNG history – MH-12-HO-2163 … 8 kg"', /^CNG history – MH-12-HO-2163/.test(hist) && /8 kg/.test(hist) && !/\b8 L\b/.test(hist), hist);
    const calm = () => F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) y.hidden = true; }); });
    const shotOf = async (sel, file) => { await calm(); await F.evaluate(q => document.querySelector(q).closest('.panel, section, .card').scrollIntoView({ block: 'start' }), sel); await wait(800);
      const rr = await F.evaluate(q => { const y = document.querySelector(q).closest('.panel, section, .card').getBoundingClientRect(); return { x: y.left, y: Math.max(0, y.top), w: y.width, h: Math.min(y.bottom, window.innerHeight) - Math.max(0, y.top) }; }, sel);
      const fr = await (await F.frameElement()).boundingBox(); if (rr.w > 0 && rr.h > 0) await mp.screenshot({ path: SHOT + '/' + file, clip: { x: fr.x + rr.x, y: fr.y + rr.y, width: rr.w, height: Math.min(rr.h, 700) } }); };
    await shotOf('#d_src', 'fuel163_issue_cng.png');
    const ex = await F.evaluate(() => { const r = { date: S.today, shift: 'Day', source: 'DIESEL CARD', no: 'MH-12-HO-1163', qty: 5 }; return diProblems(r); });
    ok('   an Excel row of the Petrol car at DIESEL CARD: marked before anything is sent', ex.some(p => /runs on Petrol – not at DIESEL CARD/.test(p)), ex);
    // Transfer: the To of the From's fuel
    await F.evaluate(() => showTab('transfer')); await wait(1500);
    await F.evaluate(pc => { const s = $('t_from'); s.value = pc; s.dispatchEvent(new Event('change', { bubbles: true })); }, PC); await wait(600);
    const tP = { to: await opts(F, 't_to'), val: await F.evaluate(() => $('t_to').value) };
    await F.evaluate(dc => { const s = $('t_from'); s.value = dc; s.dispatchEvent(new Event('change', { bubbles: true })); }, DC); await wait(600);
    const tD = await opts(F, 't_to');
    ok('   Transfer: From PETROL CARD → To offers PETROL CARD, PETROL CAN (ready on PETROL CAN); From DIESEL CARD → only DIESEL CARD', same(tP.to, [PC, PK]) && tP.val === PK && same(tD, [DC]), [tP, tD]);
    const grid = await F.evaluate(pc => { const t = document.createElement('tr'); t.innerHTML = trRowHtml({ from: pc }); return [...t.querySelector('[data-f=to]').options].map(o => o.value); }, PC);
    ok('   its "many at once" row from PETROL CARD: To = the Petrol places', same(grid, [PC, PK]), grid);
    const chips = await F.evaluate(() => document.querySelector('#sec-transfer .stock_multi').innerText.replace(/\s+/g, ' ').trim());
    ok('   the stock chips: "CNG CARD 32 kg", the others in Ltr', /CNG CARD 32 kg/.test(chips) && /PETROL CARD 100 Ltr/.test(chips), chips);
    // the dashboard
    await F.evaluate(() => showTab('dash')); await wait(2500);
    const dash = async fu => { await F.evaluate(f => { const s = $('k_fuel'); s.value = f; s.dispatchEvent(new Event('change', { bubbles: true })); }, fu); await wait(2500);
      return F.evaluate(() => ({ shown: !document.querySelector('#k_fuel').closest('.fuel-f').hidden, opts: [...$('k_fuel').options].map(o => o.value), head: $('k_head').textContent, total: $('k_total').textContent.replace(/\s+/g, ''), stock: $('k_stock').textContent.replace(/\s+/g, ''),
        tanks: [...document.querySelectorAll('#tanks .tk-one')].length, title: $('tank_title').textContent, lg: [...$('lg_loc').options].map(o => o.value) })); };
    const kP = await dash('Petrol');
    ok('   the dashboard: a Fuel box (Diesel / Petrol / CNG); Petrol → "Petrol summary – all locations", issued 30 Ltr, stock 120 Ltr, 2 tanks, the stock place list = the Petrol places', kP.shown && same(kP.opts, ['Diesel', 'Petrol', 'CNG']) && kP.head === 'Petrol summary – all locations' && kP.total === '30Ltr' && kP.stock === '120Ltr' && kP.tanks === 2 && /^Petrol tank/.test(kP.title) && same(kP.lg, ['', PC, PK]), kP);
    const kC = await dash('CNG');
    ok('   CNG → issued 8 kg, stock 32 kg, 1 tank', kC.head === 'CNG summary – all locations' && kC.total === '8kg' && kC.stock === '32kg' && kC.tanks === 1, kC);
    await shotOf('#k_fuel', 'fuel163_dash_cng.png');
    const kD = await dash('Diesel');
    ok('   back to Diesel → "Diesel summary – all locations", 50 Ltr (the words as before)', kD.head === 'Diesel summary – all locations' && kD.total === '50Ltr' && kD.tanks === 1, kD);
    // a report of one fuel (Stock Register) and the daily Inward & Issue summary
    await F.evaluate(() => showTab('rp-stock')); await wait(1200);
    await F.evaluate(() => { const s = $('rpstock_fuel'); s.value = 'CNG'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(500);
    const rpLocs = await opts(F, 'rpstock_loc');
    await F.evaluate(t => { $('rpstock_from').value = t; $('rpstock_to').value = t; }, today);
    await F.evaluate(() => $('rpstock_go').click()); await wait(3500);
    const rp = await F.evaluate(() => ({ title: $('rpstock_title').textContent, body: $('rpstock_body').innerText.slice(0, 1500) }));
    ok('   Reports → Stock Register: a Fuel box; CNG → Location = CNG CARD; the report in kg', same(rpLocs, [CC]) && rp.title === 'CNG Stock Register – CNG CARD' && /In \(kg\)/.test(rp.body) && /Issued – MH-12-HO-2163/.test(rp.body) && !/\bLtr\b/.test(rp.body + rp.title), [rpLocs, rp]);
    await F.evaluate(() => showTab('rdaily')); await wait(1200);
    await F.evaluate(t => { $('rd_from').value = t; $('rd_to').value = t; const s = $('rd_fuel'); s.value = 'Petrol'; s.dispatchEvent(new Event('change', { bubbles: true })); }, today); await wait(400);
    await F.evaluate(() => $('rd_go').click()); await wait(3500);
    const rd = await F.evaluate(() => ({ title: $('rd_title').textContent, kpis: $('rd_kpis').innerText.replace(/\s+/g, ' '), locs: [...$('rd_loc').options].map(o => o.value) }));
    ok('   Daily Inward & Issue Summary of Petrol: "Daily Petrol Inward & Issue Summary", inward 150, issued 30', rd.title === 'Daily Petrol Inward & Issue Summary' && /Inward 150/.test(rd.kpis) && /Total issued 30/.test(rd.kpis) && same(rd.locs, ['', PC, PK]), rd);
    // the Asset Master
    await F.evaluate(() => showTab('master')); await wait(1500);
    await F.evaluate(() => editMaster('MH-12-HO-2163')); await wait(600);
    const am = await F.evaluate(() => ({ fuel: $('m_fuel').value, km: document.querySelector('label[for="m_kmstd"]').textContent, tag: [...document.querySelectorAll('#m_rows .fuel-tag')].map(x => x.textContent) }));
    ok('   Asset Master: Fuel = CNG for the CNG car; "Standard Average (KM/kg)"; the list marks Petrol / CNG / Electric', am.fuel === 'CNG' && am.km === 'Standard Average (KM/kg)' && ['Petrol', 'CNG', 'Electric'].every(f => am.tag.indexOf(f) > -1), am);
    await shotOf('#m_fuel', 'fuel163_master.png');
    await F.evaluate(() => { $('m_fuel').value = 'Petrol'; $('m_fuel').dispatchEvent(new Event('change')); $('m_kmstd').value = 13; }); await wait(200);
    await F.evaluate(() => $('m_save').click()); await wait(1200);
    await F.evaluate(() => { if (!$('cf_back').hidden) $('cf_ok').click(); }); await wait(2500);
    ok('   a change of its Fuel in the form (CNG → Petrol) is asked and saved', sql('rcl_s2', "select fuel from master where id = 'MH-12-HO-2163'") === 'Petrol', sql('rcl_s2', "select fuel from master where id = 'MH-12-HO-2163'"));
    // ---- 6. S1: all Diesel, no step 1zg ----
    const s1 = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J1 = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [s1.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    x = await J1('saveMaster', car('MH12VT1163', 'Petrol'), 'add');
    ok('6. S1 without step 1zg: a Petrol machinery is not saved – the database step is asked for', /System update incomplete|step|column/i.test(x.ERROR || '') && sql('rcl', "select count(*) from master where id = 'MH12VT1163'") === '0', x);
    const s1Init = await J1('getInit');
    ok('   S1: every place Diesel; the lists without totals per fuel', Object.values(s1Init.placeFuels || {}).every(f => f === 'Diesel') && !('byFuel' in (await J1('getDieselIssues', {}))), s1Init.placeFuels);
    const vp = await b.newPage(); await vp.setViewport({ width: 1600, height: 1000 }); vp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await vp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const V = await find(vp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations) && S.locations.length > 0 && !!S.placeFuels);
    await V.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await V.evaluate(() => showTab('dash')); await wait(2500);
    const v = await V.evaluate(() => ({ boxes: [...document.querySelectorAll('.fuel-f')].filter(x => !x.hidden).length, all: document.querySelectorAll('.fuel-f').length, head: $('k_head').textContent, unit: $('k_total').textContent.replace(/[\d.,\s]/g, ''),
      src: [...$('d_src').options].map(o => o.value), locs: S.locations }));
    ok('   S1\'s page: no Fuel box shown anywhere (' + v.all + ' hidden); "Diesel summary – all locations"; Diesel Issue source = every place as before', v.boxes === 0 && v.all > 10 && v.head === 'Diesel summary – all locations' && v.unit === 'Ltr' && same(v.src, v.locs), v);
    ok('no error on the pages', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    try { if (b) await b.close(); } catch (e) {}
    try {      // the test's own data out again (rig only): T2's entries, cars and places of this test; S1 had nothing saved
      if (n0 === '0') sql('rcl_s2', "delete from diesel_issue where machinery like 'MH-12-HO-%163'; delete from diesel_transfer where from_location in ('" + [DC, PC, CC, PK].join("','") + "'); delete from diesel_inward where pump_name = 'Card 163'; delete from master where id like 'MH-12-HO-%163'; " +
        "delete from web.props where key = 'DIESEL_PLACES' or key like 'TANK_CAP_%'; delete from web.cache where key like 'SB%'");
      sql('rcl', "delete from master where id like 'MH-12-VT-%163'");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)') + ' diesel entries; T2 DIESEL_PLACES ' + sql('rcl_s2', "select count(*) from web.props where key = 'DIESEL_PLACES'"));
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
