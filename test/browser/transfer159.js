// update-159 (asked 25-10-2026 at 18B: "/ nko … jyach tyach seprate ale gel transfer"; the Transfer list's stock point = From only)
// in the browser, on the local rig started with PORTAL=1 (the Portal :3010, Mechanical :3000 linked to it). Site T2 (database
// rcl_s2, no diesel entry) plays 18B with three stock points; S1 (VTR – two places) must read as before.
// Test data only (T2's places, a machinery TP-159 and its diesel), all taken out at the end; nothing of S1 is changed.
//   1. T2's places: CAMP PUMP, DISPENSER - MH12ZE-1739, DISPENSER - MH12WJ-1381 (the Portal's placesSave);
//      diesel: 12,000 in at CAMP PUMP; CAMP PUMP → ZE 2,000, CAMP PUMP → WJ 1,500, ZE → WJ 300; 100 issued from ZE, 150 from WJ;
//   2. Diesel Transfer: "From (stock point)" = CAMP PUMP → its 2; = ZE → only ZE → WJ; = WJ → none; All → 3;
//   3. Dashboard → Day-wise diesel stock: a "Received from" and a "Sent to" column for EACH other stock point (never "A / B"),
//      the figures of each; the stock cards the same;
//   4. Reports → Daily Diesel Inward & Issue Summary: the same columns on the screen and in the Excel file;
//   5. S1 (VTR): Day-wise of the Dispenser – "+ Received from VTR Store", "− Sent to VTR Store", as before.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node transfer159.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const CP = 'CAMP PUMP', ZE = 'DISPENSER - MH12ZE-1739', WJ = 'DISPENSER - MH12WJ-1381';
const propsOf = db => { const o = {}; sql(db, "select key || chr(9) || coalesce(value, '') from web.props").split('\n').filter(Boolean).forEach(l => { const [k, v] = l.split('\t'); o[k] = v; }); return o; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
(async () => {
  const keepT2 = propsOf('rcl_s2');
  const n0 = sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)');
  const errs = []; let b = null, cookie = '', pw = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  try {
    ok('start: T2 has no diesel entry and no places of its own', n0 === '0' && !('DIESEL_PLACES' in keepT2), [n0, keepT2.DIESEL_PLACES]);
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { const lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: p }) }); if (lr.status === 200) { pw = p; cookie = (lr.headers.get('set-cookie') || '').split(';')[0]; break; } }
    const pl = await (await fetch(P + '/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1', Cookie: cookie }, body: JSON.stringify({ action: 'placesSave', site: 'T2', places: [{ name: CP, cap: 18000 }, { name: ZE, cap: 2650 }, { name: WJ, cap: 2650 }] }) })).json();
    ok('1. T2\'s places saved by the Super Admin: CAMP PUMP, DISPENSER - MH12ZE-1739, DISPENSER - MH12WJ-1381', !!pw && pl && (pl.places || (pl.result || {}).places || []).map(x => x.name).join('|') === [CP, ZE, WJ].join('|'), pl);
    const s = await post(SA, { fn: 'ssoLogin', args: [await ticket('T2')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [s.result.token, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J('getInit')).today;
    const seed = [await J('saveMaster', { no: 'TP-159', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add'),
      await J('saveInward', { date: today, location: CP, pump: 'Vendor Pump 159', qty: 12000, rate: 92, billNo: 'B159-1', billDate: today }),
      await J('saveTransfer', { date: today, shift: 'Day', from: CP, to: ZE, qty: 2000 }),
      await J('saveTransfer', { date: today, shift: 'Day', from: CP, to: WJ, qty: 1500 }),
      await J('saveTransfer', { date: today, shift: 'Day', from: ZE, to: WJ, qty: 300 }),
      await J('saveDieselIssue', { date: today, shift: 'Day', source: ZE, no: 'TP-159', qty: 100, kmReading: 1000, force: true }),
      await J('saveDieselIssue', { date: today, shift: 'Day', source: WJ, no: 'TP-159', qty: 150, kmReading: 1100, force: true })];
    ok('   diesel at T2: 12,000 in; CAMP PUMP → ZE 2,000, → WJ 1,500; ZE → WJ 300; issued ZE 100, WJ 150', seed.every(x => x && x.ok), seed);
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1920, height: 1080 }); mp.on('pageerror', e => errs.push('T2: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('T2'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations));
    const calm = () => F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const x = document.getElementById(id); if (x) x.hidden = true; }); });
    const shot = async (sel, file) => { await calm(); await F.evaluate(q => document.querySelector(q).scrollIntoView({ block: 'center' }), sel); await wait(1200); const el = await F.$(sel); if (el) await el.screenshot({ path: SHOT + '/' + file }); };
    // the panel around an element, for its picture
    const panelOf = (sel, id) => F.evaluate((q, i) => { const p = document.querySelector(q).closest('.panel, section'); p.id = p.id || i; return '#' + p.id; }, sel, id);
    // ---- 2. the Transfer list: From only ----
    await calm(); await F.evaluate(() => showTab('transfer')); await wait(3000);
    const tlist = async loc => { await F.evaluate(l => { $('tf_from').value = ''; $('tf_to').value = ''; $('tf_q').value = ''; $('tf_loc').value = l; $('tf_loc').dispatchEvent(new Event('change')); }, loc); await wait(2500);
      return F.evaluate(() => ({ rows: [...document.querySelectorAll('#t_rows tr')].map(tr => tr.children.length > 4 ? tr.children[3].textContent + ' > ' + tr.children[4].textContent + ' ' + tr.children[5].textContent : tr.textContent), sum: $('t_sum').textContent })); };
    const lbl = await F.evaluate(() => document.querySelector('label[for="tf_loc"]').textContent);
    const tCP = await tlist(CP), tZE = await tlist(ZE), tWJ = await tlist(WJ), tAll = await tlist('');
    ok('2. Diesel Transfer: the filter is "From (stock point)"', lbl === 'From (stock point)', lbl);
    ok('   From = CAMP PUMP → its 2 transfers', same(tCP.rows.slice().sort(), [CP + ' > ' + WJ + ' 1,500', CP + ' > ' + ZE + ' 2,000']) && /Entries: 2/.test(tCP.sum), tCP);
    ok('   From = ZE → only ZE → WJ (not the 2,000 that came TO it)', same(tZE.rows, [ZE + ' > ' + WJ + ' 300']) && /Entries: 1/.test(tZE.sum), tZE);
    ok('   From = WJ → none (nothing was sent from it)', tWJ.rows.length === 1 && /No transfers match this filter/.test(tWJ.rows[0]) && /Entries: 0/.test(tWJ.sum), tWJ);
    ok('   All → the 3', tAll.rows.length === 3 && /Entries: 3/.test(tAll.sum), tAll);
    await F.evaluate(l => { foldOpen('transfer'); $('tf_loc').value = l; $('tf_loc').dispatchEvent(new Event('change')); }, CP); await wait(2500);
    await shot(await panelOf('#t_rows', 'tl_panel159'), 'transfer159_list_from.png');
    // ---- 3. the Dashboard: Day-wise diesel stock and the stock cards ----
    await calm(); await F.evaluate(() => { showTab('dash'); dashToday(); }); await wait(5000);
    const ledger = async loc => { await F.evaluate(l => { $('lg_loc').value = l; $('lg_loc').dispatchEvent(new Event('change')); }, loc); await wait(3000);
      return F.evaluate(t => { const head = [...document.querySelectorAll('#lg_head th')].map(x => x.textContent), row = [...document.querySelectorAll('#lg_rows tr')].find(tr => tr.children[0].textContent === t);
        return { head: head, row: row ? [...row.children].map(x => x.textContent) : null, foot: [...document.querySelectorAll('#lg_foot td')].map(x => x.textContent), help: $('lg_help').textContent }; }, await F.evaluate(() => showDate(S.today))); };
    const lCP = await ledger(CP), lZE = await ledger(ZE), lWJ = await ledger(WJ), lAll = await ledger('');
    const H = (o1, o2) => ['Date', 'Opening stock', '+ Received from pump', '+ Received from ' + o1, '+ Received from ' + o2, '− Sent to ' + o1, '− Sent to ' + o2, '− Issued to machinery', 'Closing stock'];
    ok('3. Day-wise of CAMP PUMP: a column for each dispenser – Received from ZE, from WJ, Sent to ZE, to WJ (no "/")', same(lCP.head, H(ZE, WJ)) && !lCP.head.some(h => / \/ /.test(h)), lCP.head);
    ok('   its day: opening 0, 12,000 in, 0, 0, sent ZE 2,000, sent WJ 1,500, issued 0, closing 8,500', lCP.row && same(lCP.row.slice(1), ['0', '12,000', '0', '0', '2,000', '1,500', '0', '8,500']), lCP.row);
    ok('   Day-wise of ZE: received from CAMP PUMP 2,000, from WJ 0; sent to CAMP PUMP 0, to WJ 300; issued 100; closing 1,600', same(lZE.head, H(CP, WJ)) && lZE.row && same(lZE.row.slice(1), ['0', '0', '2,000', '0', '0', '300', '100', '1,600']), [lZE.head, lZE.row]);
    ok('   Day-wise of WJ: received from CAMP PUMP 1,500 and from ZE 300 – each in its own column; closing 1,650', same(lWJ.head, H(CP, ZE)) && lWJ.row && same(lWJ.row.slice(1), ['0', '0', '1,500', '300', '0', '0', '150', '1,650']), [lWJ.head, lWJ.row]);
    ok('   the "Whole period" line sums each column the same way', same(lWJ.foot.slice(3, 7), ['1,500', '300', '0', '0']), lWJ.foot);
    ok('   the words under it: each column is one stock point', /Each "Received from" \/ "Sent to" column is the diesel transfers with that one stock point/.test(lWJ.help), lWJ.help);
    ok('   All locations: as before (no transfer columns)', same(lAll.head, ['Date', 'Opening stock', '+ Received from pump', '− Issued to machinery', 'Closing stock']), lAll.head);
    const cards = await F.evaluate(() => [...document.querySelectorAll('#loc_cards .loccard')].map(c => [c.querySelector('h3').textContent, [...c.querySelectorAll('dt')].map(d => d.textContent + ' = ' + (d.nextElementSibling ? d.nextElementSibling.textContent : '')), (c.querySelector('.check') || {}).textContent]));
    const wjCard = cards.find(c => c[0] === WJ) || [];
    ok('   the stock card of WJ: "+ Received from CAMP PUMP = 1,500" and "+ Received from ZE = 300", each a line; it adds up', (wjCard[1] || []).indexOf('+ Received from ' + CP + ' = 1,500') > -1 && (wjCard[1] || []).indexOf('+ Received from ' + ZE + ' = 300') > -1 &&
      (wjCard[1] || []).indexOf('− Sent to ' + CP + ' = 0') > -1 && !(wjCard[1] || []).some(x => / \/ /.test(x.split(' = ')[0])) && /✓/.test(wjCard[2] || ''), cards);
    await F.evaluate(l => { $('lg_loc').value = l; $('lg_loc').dispatchEvent(new Event('change')); }, CP); await wait(3000);
    const lgSel = await panelOf('#lg_head', 'lg_panel159');
    await shot(lgSel, 'transfer159_daywise_camp.png');
    await F.evaluate(l => { $('lg_loc').value = l; $('lg_loc').dispatchEvent(new Event('change')); }, WJ); await wait(3000);
    await shot(lgSel, 'transfer159_daywise_wj.png');
    await shot('#loc_cards', 'transfer159_cards.png');
    // ---- 4. the Daily Diesel Inward & Issue Summary (screen + Excel) ----
    await calm(); await F.evaluate(() => { showTab('rdaily'); try { window.rclLoadXlsx(); } catch (e) {} }); for (let i = 0; i < 40 && !(await F.evaluate(() => !!window.XLSX)); i++) await wait(500); await wait(1000);
    const rd = async loc => { await F.evaluate((l, t) => { $('rd_from').value = t; $('rd_to').value = t; $('rd_loc').value = l; window.__x = null;
        try { if (window.XLSX) XLSX.writeFile = (wb) => { window.__x = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); }; } catch (e) {} $('rd_go').click(); }, loc, today); await wait(3500);
      await F.evaluate(() => { try { if (window.XLSX) XLSX.writeFile = (wb) => { window.__x = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); }; } catch (e) {} $('rd_xlsx').click(); }); await wait(3500);
      return F.evaluate(() => ({ head: [...document.querySelectorAll('#rd_table thead tr:first-child th')].map(x => x.textContent), row: [...document.querySelectorAll('#rd_table tbody tr:first-child td')].map(x => x.textContent),
        foot: [...document.querySelectorAll('#rd_table tfoot td')].map(x => x.textContent), x: window.__x, meta: $('rd_meta').textContent })); };
    const rCP = await rd(CP), rWJ = await rd(WJ), rAll = await rd('');
    ok('4. Daily report of CAMP PUMP: Received from ZE, from WJ, Sent to ZE, to WJ – each its own column', same(rCP.head.slice(0, 7), ['Date', 'Opening stock', 'Inward (pump)', 'Received from ' + ZE, 'Received from ' + WJ, 'Sent to ' + ZE, 'Sent to ' + WJ]), rCP.head);
    ok('   its day: in 12,000; received –, –; sent 2,000 and 1,500; closing 8,500; the total line the same', rCP.row.slice(1, 7).join('|') === '0|12,000|–|–|2,000|1,500' && rCP.row[rCP.row.length - 1] === '8,500' && rCP.foot.slice(3, 7).join('|') === '0|0|2,000|1,500', [rCP.row, rCP.foot]);
    const xh = rCP.x ? rCP.x.findIndex(r => r && r[0] === 'Date') : -1;
    ok('   the Excel file: the same columns and figures', xh > -1 && same(rCP.x[xh].slice(0, 7), ['Date', 'Opening stock', 'Inward (pump)', 'Received from ' + ZE, 'Received from ' + WJ, 'Sent to ' + ZE, 'Sent to ' + WJ]) && same(rCP.x[xh + 1].slice(3, 7), [0, 0, 2000, 1500]), rCP.x);
    ok('   WJ: received from CAMP PUMP 1,500 and from ZE 300, separately; it adds up (Opening + Inward + Received − Sent − Issued = Closing)', same(rWJ.head.slice(3, 7), ['Received from ' + CP, 'Received from ' + ZE, 'Sent to ' + CP, 'Sent to ' + ZE]) && rWJ.row.slice(3, 7).join('|') === '1,500|300|–|–' && /\+ Received 1,800 − Sent 0 − Issued 150 = Closing 1,650/.test(rWJ.meta), [rWJ.head, rWJ.row, rWJ.meta]);
    ok('   All locations: no transfer columns, as before', same(rAll.head.slice(0, 4), ['Date', 'Opening stock', 'Inward (pump)', 'Diesel issued (Ltr)']), rAll.head);
    await F.evaluate((l, t) => { $('rd_from').value = t; $('rd_to').value = t; $('rd_loc').value = l; $('rd_go').click(); }, CP, today); await wait(3500);
    await shot('#rd_out', 'transfer159_report_camp.png');
    // ---- 5. S1 (VTR): two places – the words as before ----
    const vp = await b.newPage(); await vp.setViewport({ width: 1440, height: 900 }); vp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await vp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const V = await find(vp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations));
    await V.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('dash'); dashToday(); }); await wait(5000);
    await V.evaluate(() => { $('lg_loc').value = 'Dispenser'; $('lg_loc').dispatchEvent(new Event('change')); }); await wait(3000);
    const vh = await V.evaluate(() => ({ head: [...document.querySelectorAll('#lg_head th')].map(x => x.textContent), card: [...document.querySelectorAll('#loc_cards .loccard')].map(c => [...c.querySelectorAll('dt')].map(d => d.textContent)) }));
    ok('5. S1 (VTR): Day-wise of the Dispenser – "+ Received from VTR Store", "− Sent to VTR Store", as before', same(vh.head, ['Date', 'Opening stock', '+ Received from pump', '+ Received from VTR Store', '− Sent to VTR Store', '− Issued to machinery', 'Closing stock']), vh.head);
    ok('   its stock cards: the same words as before', vh.card.some(c => c.indexOf('+ Received from VTR Store') > -1 && c.indexOf('− Sent to VTR Store') > -1) && vh.card.some(c => c.indexOf('+ Received from Dispenser') > -1 && c.indexOf('− Sent to Dispenser') > -1), vh.card);
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 900)); }
  finally {
    try { if (b) await b.close(); } catch (e) {}
    try {
      if (n0 === '0') sql('rcl_s2', "delete from diesel_issue where machinery = 'TP-159'; delete from diesel_transfer where from_location in ('" + CP + "', '" + ZE + "', '" + WJ + "'); delete from diesel_inward where pump_name = 'Vendor Pump 159'; delete from master where id = 'TP-159';");
      const now2 = propsOf('rcl_s2');
      Object.keys(now2).filter(k => !(k in keepT2) && !/^V_/.test(k)).forEach(k => sql('rcl_s2', "delete from web.props where key = '" + k.replace(/'/g, "''") + "'"));
      sql('rcl_s2', "delete from web.cache where key like 'SB%'");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)') + ' diesel entries; DIESEL_PLACES ' + sql('rcl_s2', "select count(*) from web.props where key = 'DIESEL_PLACES'"));
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
