// update-117 (every site its own diesel places) in the browser, on the local rig started with PORTAL=1 (the Portal :3010,
// Mechanical :3000 linked to it). Site T2 (database rcl_s2, no diesel entry) plays 18B; S1 (VTR) must look as before.
// Test data only (T2's places, a machinery TP-117 and its diesel), all taken out at the end; nothing of S1 is changed.
//   1. the Super Admin in the Portal: Sites → "Diesel places" of T2 → types Camp Pump 18000, MH12ZE1739 2650, + Add place
//      MH12WJ1381 2650 → Save; "New site" has the same small table (+ Add place / Remove);
//   2. diesel at T2 (inward, pump → dispenser, dispenser → dispenser, issue) – then T2's Mechanical page: every place list has
//      the 3 places (Transfer: From Camp Pump, To MH12ZE1739), the Dashboard has one tank per place with its stock;
//   3. the Portal: each place now "has entries", its stock now; no Remove;
//   4. S1's Dashboard: the pickup and the barrels as before, the old words.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node places117.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const propsOf = db => { const o = {}; sql(db, "select key || chr(9) || coalesce(value, '') from web.props").split('\n').filter(Boolean).forEach(l => { const [k, v] = l.split('\t'); o[k] = v; }); return o; };
(async () => {
  const keepT2 = propsOf('rcl_s2');
  const n0 = sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)');
  const errs = []; let b = null, cookie = '', pw = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  try {
    ok('start: T2 has no diesel entry and no places of its own', n0 === '0' && !('DIESEL_PLACES' in keepT2), [n0, keepT2.DIESEL_PLACES]);
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { const lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: p }) }); if (lr.status === 200) { pw = p; cookie = (lr.headers.get('set-cookie') || '').split(';')[0]; break; } }
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    // ---- 1. the Portal ----
    const pp = await b.newPage(); await pp.setViewport({ width: 1440, height: 900 }); pp.on('pageerror', e => errs.push('portal: ' + String(e.message).slice(0, 200)));
    await pp.goto(P + '/', { waitUntil: 'load' }); await wait(1500);
    await pp.type('#l_email', 'sa@rcl.test'); await pp.type('#l_pass', pw); await pp.click('#l_btn'); await wait(3500);
    await pp.evaluate(() => document.querySelector('#sa_tabs [data-t="sites"]').click()); await wait(800);
    await pp.evaluate(() => document.querySelector('#st_rows tr[data-code="T2"] .st-places').click()); await wait(3500);
    let pv = await pp.evaluate(() => ({ shown: !document.getElementById('dp_panel').hidden, head: (document.querySelector('#dp_panel h2') || {}).textContent, note: (document.querySelector('#dp_panel .panel-head .note') || {}).textContent, rows: [...document.querySelectorAll('#dp_box .pl-rows tr')].map(tr => [tr.querySelector('.pl-name').value, tr.querySelector('.pl-cap').value, !!tr.querySelector('.pl-del')]) }));
    ok('1. Portal → Sites → "Diesel places" of T2: the first site\'s places, not set yet, each can be removed (no entry)', pv.shown && /Diesel places – Test Site T2 \(T2\)/.test(pv.head) && /Not set yet/.test(pv.note) && JSON.stringify(pv.rows) === '[["Dispenser","10000",true],["VTR Store","10000",true]]', pv);
    await pp.evaluate(() => { const r = [...document.querySelectorAll('#dp_box .pl-rows tr')]; const set = (tr, n, c) => { tr.querySelector('.pl-name').value = n; tr.querySelector('.pl-cap').value = c; };
      set(r[0], 'Camp Pump', '18000'); set(r[1], 'MH12ZE1739', '2650'); document.querySelector('#dp_box .pl-add').click(); });
    await pp.type('#dp_box .pl-rows tr:last-child .pl-name', 'MH12WJ1381'); await pp.type('#dp_box .pl-rows tr:last-child .pl-cap', '2650');
    await pp.click('#dp_save'); await wait(4000);
    pv = await pp.evaluate(() => ({ toast: document.getElementById('toast').textContent, note: (document.querySelector('#dp_panel .panel-head .note') || {}).textContent, rows: [...document.querySelectorAll('#dp_box .pl-rows tr')].map(tr => [tr.querySelector('.pl-name').value, tr.querySelector('.pl-cap').value, tr.children[2].textContent]) }));
    ok('   typed Camp Pump 18000, MH12ZE1739 2650, + Add place MH12WJ1381 2650 → Save: saved, shown with their stock (0)', /Diesel places of T2 saved: Camp Pump, MH12ZE1739, MH12WJ1381\./.test(pv.toast) && !/Not set yet/.test(pv.note) && JSON.stringify(pv.rows) === '[["Camp Pump","18000","0 Ltr"],["MH12ZE1739","2650","0 Ltr"],["MH12WJ1381","2650","0 Ltr"]]', pv);
    ok('   in T2\'s own database', JSON.parse(propsOf('rcl_s2').DIESEL_PLACES || '[]').map(x => x.name).join() === 'Camp Pump,MH12ZE1739,MH12WJ1381');
    await pp.screenshot({ path: SHOT + '/places117_portal.png' });
    // "New site": the same table
    await pp.evaluate(() => document.getElementById('st_new').click()); await wait(500);
    const ns = async () => pp.evaluate(() => document.querySelectorAll('#ns_places .pl-rows tr').length);
    const n1 = await ns(); await pp.evaluate(() => document.querySelector('#ns_places .pl-add').click()); const n2 = await ns();
    await pp.evaluate(() => document.querySelector('#ns_places .pl-rows tr:last-child .pl-del').click()); const n3 = await ns();
    ok('   "New site": the diesel places table (one empty row; + Add place; Remove)', n1 === 1 && n2 === 2 && n3 === 1 && await pp.evaluate(() => /Diesel places of this site/.test(document.getElementById('ns_panel').textContent)), [n1, n2, n3]);
    await pp.evaluate(() => { document.getElementById('ns_code').value = 'N8'; document.querySelector('#ns_places .pl-name').value = 'Camp Pump'; document.querySelector('#ns_places .pl-cap').value = '18000'; });
    await pp.evaluate(() => document.getElementById('ns_panel').scrollIntoView()); await pp.screenshot({ path: SHOT + '/places117_newsite.png' });
    await pp.evaluate(() => document.getElementById('ns_close').click());
    // ---- 2. diesel at T2 (the Super Admin's own entries are saved at once), then its page ----
    const s = await post(SA, { fn: 'ssoLogin', args: [await ticket('T2')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [s.result.token, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J('getInit')).today;
    const seed = [await J('saveMaster', { no: 'TP-117', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add'),
      await J('saveInward', { date: today, location: 'Camp Pump', pump: 'Vendor Pump 117', qty: 12000, rate: 92, billNo: 'B117-1', billDate: today }),
      await J('saveTransfer', { date: today, shift: 'Day', from: 'Camp Pump', to: 'MH12ZE1739', qty: 2000 }),
      await J('saveTransfer', { date: today, shift: 'Day', from: 'MH12ZE1739', to: 'MH12WJ1381', qty: 900 }),
      await J('saveDieselIssue', { date: today, shift: 'Day', source: 'MH12WJ1381', no: 'TP-117', qty: 150, kmReading: 1000, force: true })];
    ok('2. seed at T2: 12,000 Ltr into the Camp Pump, 2,000 to MH12ZE1739, 900 on to MH12WJ1381, 150 issued from it', seed.every(x => x && x.ok), seed);
    const mp = await b.newPage(); await mp.setViewport({ width: 1440, height: 900 }); mp.on('pageerror', e => errs.push('T2: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('T2'), { waitUntil: 'load' });
    const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations));
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('dash'); }); await wait(5000);
    const pg = await F.evaluate(() => { const opt = id => [...document.getElementById(id).options].map(o => o.textContent); return { locs: S.locations, src: opt('d_src'), inLoc: opt('i_loc'), from: $('t_from').value, to: $('t_to').value, dfAll: opt('df_src'),
      tanks: [...document.querySelectorAll('#tanks .tk-one')].map(c => [c.querySelector('.tkc-t b').textContent, c.querySelector('.t-qty').textContent, c.querySelector('.t-pct').textContent]), own: $('tanks').classList.contains('own'), pick: !!document.querySelector('#tanks .tk-pick'),
      moved: [...document.querySelectorAll('#loc_cards dt.sm')].map(x => x.textContent).join('|') }; });
    ok('   T2\'s page: Diesel Source, Received at: the 3 places; Transfer From Camp Pump → To MH12ZE1739; the filter: All + 3', JSON.stringify(pg.src) === '["Camp Pump","MH12ZE1739","MH12WJ1381"]' && JSON.stringify(pg.inLoc) === JSON.stringify(pg.src) && pg.from === 'Camp Pump' && pg.to === 'MH12ZE1739' && pg.dfAll.length === 4, pg);
    ok('   T2\'s Dashboard: one tank per place – Camp Pump 10,000 of 18,000 · MH12ZE1739 1,100 of 2,650 · MH12WJ1381 750 of 2,650', pg.own && !pg.pick && JSON.stringify(pg.tanks.map(t => t[0])) === '["Camp Pump","MH12ZE1739","MH12WJ1381"]' &&
      /10,000/.test(pg.tanks[0][1]) && /18,000/.test(pg.tanks[0][2]) && /1,100/.test(pg.tanks[1][1]) && /2,650/.test(pg.tanks[1][2]) && /750/.test(pg.tanks[2][1]), pg.tanks);
    const lvl = await F.evaluate(() => [...document.querySelectorAll('#tanks .tk-one .liq-g')].map(g => g.style.transform));
    ok('   the diesel level of each drawn (Camp Pump 56 %, MH12ZE1739 42 %, MH12WJ1381 28 %)', lvl.length === 3 && lvl.every(t => /translateY\([\d.]+px\)/.test(t)) && parseFloat(lvl[0].slice(11)) < parseFloat(lvl[1].slice(11)) && parseFloat(lvl[1].slice(11)) < parseFloat(lvl[2].slice(11)), lvl);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; } catch (e) {} ($('tanks').closest('.panel') || $('tanks')).scrollIntoView({ block: 'start' }); }); await wait(1800);
    await mp.screenshot({ path: SHOT + '/places117_t2dash.png' });
    // the stock card words (Dashboard → locations, filled when the Dashboard loads its stock)
    ok('   no word names the first site\'s places at T2', !/VTR Store/.test(await F.evaluate(() => document.getElementById('sec-dash').textContent)) && !/Dispenser or VTR Store/.test(await F.evaluate(() => (document.querySelector('#sec-rp-stock .empty-note') || {}).textContent || '')), pg.moved);
    // ---- 3. the Portal again: entries now ----
    await pp.evaluate(() => document.querySelector('#st_rows tr[data-code="T2"] .st-places').click()); await wait(3500);
    pv = await pp.evaluate(() => ({ note: (document.querySelector('#dp_panel .panel-head .note') || {}).textContent, rows: [...document.querySelectorAll('#dp_box .pl-rows tr')].map(tr => [tr.querySelector('.pl-name').value, tr.querySelector('.pl-name').readOnly, tr.children[2].textContent, !!tr.querySelector('.pl-del'), (tr.querySelector('small') || {}).textContent || '']) }));
    ok('3. the Portal: every place "has entries – the name stays", its stock now, no Remove', /A place that has entries keeps its name and cannot be removed/.test(pv.note) && JSON.stringify(pv.rows) === JSON.stringify([['Camp Pump', true, '10,000 Ltr', false, 'has entries – the name stays'], ['MH12ZE1739', true, '1,100 Ltr', false, 'has entries – the name stays'], ['MH12WJ1381', true, '750 Ltr', false, 'has entries – the name stays']]), pv);
    await pp.screenshot({ path: SHOT + '/places117_portal2.png' });
    // ---- 4. S1 (VTR): as before ----
    const vp = await b.newPage(); await vp.setViewport({ width: 1440, height: 900 }); vp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await vp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const V = await find(vp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations));
    await V.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('dash'); }); await wait(5000);
    const vv = await V.evaluate(() => ({ locs: S.locations, pick: !!document.querySelector('#tanks .tk-pick'), barrels: !!document.querySelector('#tanks .tk-barrels'), one: document.querySelectorAll('#tanks .tk-one').length, own: $('tanks').classList.contains('own'), note: (document.querySelector('#sec-rp-stock .empty-note') || {}).textContent }));
    ok('4. S1 (VTR): Dispenser + VTR Store, the pickup and the barrels on the Dashboard as before, the old words', JSON.stringify(vv.locs) === '["Dispenser","VTR Store"]' && vv.pick && vv.barrels && vv.one === 0 && !vv.own && vv.note === 'Every diesel movement of one location (Dispenser or VTR Store) with the running balance.', vv);
    await V.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; } catch (e) {} ($('tanks').closest('.panel') || $('tanks')).scrollIntoView({ block: 'start' }); }); await wait(1500); await vp.screenshot({ path: SHOT + '/places117_s1dash.png' });
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally {
    try { if (b) await b.close(); } catch (e) {}
    try {
      if (n0 === '0') sql('rcl_s2', "delete from diesel_issue where machinery = 'TP-117'; delete from diesel_transfer where from_location in ('Camp Pump', 'MH12ZE1739', 'MH12WJ1381'); delete from diesel_inward where pump_name = 'Vendor Pump 117'; delete from master where id = 'TP-117';");
      const now2 = propsOf('rcl_s2');
      Object.keys(now2).filter(k => !(k in keepT2) && !/^V_/.test(k)).forEach(k => sql('rcl_s2', "delete from web.props where key = '" + k.replace(/'/g, "''") + "'"));
      sql('rcl_s2', "delete from web.cache where key like 'SB%'");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)') + ' diesel entries; DIESEL_PLACES ' + sql('rcl_s2', "select count(*) from web.props where key = 'DIESEL_PLACES'"));
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
