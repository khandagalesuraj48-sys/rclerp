// update-97 (water tanker – trip by trip) in the browser, on the local rig (Mechanical :3001 – the app's own sign-in, site S1):
//   the form (Log Book → "Water tanker – trip by trip"): trips saved, one more later the same day, a Night trip, the totals;
//   the same challan / a time on another trip refused (on the page, and by the server for another tanker of the agency);
//   a trip deleted; the usual rows say a tanker is entered there; the print "WATER TANKER REPORT": one line per trip,
//   DAY / NIGHT TRIPS, the amount at the Day and the Night rate; a phone. The test's own records are taken out at the end.
//   NODE_OPTIONS="--require <path>/geo-shim.js" node tanker97.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const SHOTS = '/home/claude/test/shots/', PORT = 3001, BASE = 'http://127.0.0.1:' + PORT;
const clean = () => sql("delete from log_book where machinery like 'WT-B%'; delete from boq where vendor_name = 'BT Water Agency'; delete from master where id like 'WT-B%'; delete from vendors where vendor_name = 'BT Water Agency';");
const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10), yday = new Date(Date.now() + 330 * 60000 - 86400000).toISOString().slice(0, 10);
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = [], E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'BT Water Agency', gstReg: 'No', pan: 'ABCPW1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add'));
  for (const no of ['WT-B1', 'WT-B2']) E(await api('saveMaster', { no: no, name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'BT Water Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'BT Water Agency', from: '2026-09-01', tdsPct: 0, woNo: 'WO-WT', lines: [{ no: 'WT-B1', basis: 'Per Trip', rate: 500, nightRate: 700, diesel: 'Company' }, { no: 'WT-B2', basis: 'Per Trip', rate: 500, diesel: 'Company' }] }, 'add'));
  E(await api('saveLbFormats', { 'WT-B1': 'I', 'WT-B2': 'I' }));
  E(await api('saveTankerTrips', { no: 'WT-B2', date: yday, shift: 'Day', trips: [{ c: 'BT-900', a: '07:00', b: '07:30' }] }));      // a challan of the agency on its other tanker
  ok('seed: an agency with two water tankers (Format I), Per Trip BOQ ₹500 (Night ₹700 on WT-B1)', !seedErr.length, seedErr.join(' // '));
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [], prints = [], mine = new Set();
  b.on('targetcreated', async t => { try { if (t.type() !== 'page') return; const w = await t.page(); await wait(300); if (mine.has(w)) return; await wait(2200); if (mine.has(w)) return;
    const v = await w.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(s => ({ name: (s.querySelector('.lb-name') || {}).textContent, mach: (s.querySelector('.lb-mach') || {}).textContent,
      head: [...s.querySelectorAll('table.lb-t thead th')].map(x => x.innerText.replace(/\s+/g, ' ').trim()), body: [...s.querySelectorAll('table.lb-t tbody tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim())),
      bill: [...s.querySelectorAll('.lb-bill tr:not(.net)')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim())) })));
    prints.push(v); await w.close(); } catch (e) { /* not a print */ } });
  try {
    const p = await b.newPage(); mine.add(p); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    const frameReady = async pg => { for (let i = 0; i < 60; i++) { await wait(500); const fr = pg.frames().find(x => x !== pg.mainFrame()); try { if (fr && await fr.evaluate(() => !!document.getElementById('lg_email') && typeof showTab === 'function')) return fr; } catch (e) { /* the frame is (re)loading */ } } return null; };
    let f = await frameReady(p); await wait(2500); f = await frameReady(p);
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000);
    const shut = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await shut(); await f.evaluate(() => showTab('log')); await wait(2000); await shut();
    await f.evaluate(() => document.querySelector('[data-lgmode="tanker"]').click()); await wait(800);
    ok('Log Book → "Water tanker – trip by trip" opens its own form (date, shift, tanker, one line per trip)', await f.evaluate(() => !document.getElementById('wt_form').hidden && document.getElementById('lg_form').hidden && document.querySelectorAll('#wt_in .wrow').length === 1));
    const pickTanker = async (no, shift) => { await f.evaluate((no, sh, d) => { $('wt_date').value = d; $('wt_shift').value = sh; const n = $('wt_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); }, no, shift, today); await wait(2000); };
    const typeTrips = async list => { await f.evaluate(list => { $('wt_in').innerHTML = ''; list.forEach(() => $('wt_add').click()); const rows = [...document.querySelectorAll('#wt_in .wrow')];
      list.forEach((t, i) => { ['c', 'a', 'b', 'ch', 'u'].forEach((k, j) => { rows[i].querySelector('[data-w=' + k + ']').value = t[j] || ''; }); }); }, list); };
    const saveIt = async () => { await f.evaluate(() => $('wt_save').click()); await wait(3000); };
    const state = () => f.evaluate(() => ({ saved: [...document.querySelectorAll('#wt_saved tr')].filter(tr => tr.children.length > 2).map(tr => [...tr.children].slice(1, 8).map(c => c.textContent).join(' ')), tot: $('wt_tot').textContent, err: $('wt_err').hidden ? '' : $('wt_err').textContent, info: $('wt_info').textContent, rows: document.querySelectorAll('#wt_in .wrow').length }));
    await pickTanker('WT-B1', 'Day');
    let st = await state();
    ok('   the tanker picked: its agency is shown, no trip yet', /Agency: BT Water Agency/.test(st.info) && st.saved.length === 0, st);
    await typeTrips([['BT-101', '08:00', '08:40', '12+500', 'Curing'], ['BT-102', '09:00', '09:45', '13+000', 'Dust suppression']]); await saveIt();
    st = await state();
    ok('two trips saved: listed with challan, dispatch, unload, trip 1, chainage, use for; the form is empty again', st.saved.length === 2 && st.saved[0] === 'Day BT-101 08:00 08:40 1 12+500 Curing' && st.rows === 1 && /Total trips: 2/.test(st.tot), st);
    await p.screenshot({ path: SHOTS + 'wt97_form.png' });
    await typeTrips([['BT-103', '10:00', '10:30', '13+200', 'Curing']]); await saveIt();
    st = await state();
    ok('one more trip later the same day: added to the same day (3 trips, one Log Book entry)', st.saved.length === 3 && sql("select count(*) || ':' || max(trip) from log_book where machinery = 'WT-B1' and shift = 'Day'") === '1:3', st);
    await typeTrips([['BT-102', '11:00', '11:30']]); await saveIt();
    st = await state();
    ok('the same challan again: DUPLICATE shown, nothing saved', /DUPLICATE challan BT-102/.test(st.err) && /Nothing was saved/.test(st.err) && st.saved.length === 3, st);
    await typeTrips([['BT-104', '08:20', '08:50']]); await saveIt();
    st = await state();
    ok('a time on another trip: DUPLICATE time shown, nothing saved', /DUPLICATE time – 08:20–08:50 falls on the trip 08:00–08:40/.test(st.err) && st.saved.length === 3, st);
    await typeTrips([['BT-900', '11:00', '11:30']]); await saveIt();
    st = await state();
    ok('the challan of the same agency on its OTHER tanker (only the server knows it): refused by the server, nothing saved', /DUPLICATE – this challan no of BT Water Agency is already saved \(WT-B2/.test(st.err) && st.saved.length === 3, st);
    await p.screenshot({ path: SHOTS + 'wt97_duplicate.png' });
    await f.evaluate(() => { $('wt_shift').value = 'Night'; }); await typeTrips([['BT-105', '21:00', '21:40', '12+800', 'Compaction']]); await saveIt();
    st = await state();
    ok('a Night trip: the totals – Day 3, Night 1, Total 4', st.saved.length === 4 && /Day trips: 3/.test(st.tot) && /Night trips: 1/.test(st.tot) && /Total trips: 4/.test(st.tot), st);
    await f.evaluate(() => [...document.querySelectorAll('#wt_saved tr')].find(tr => /BT-103/.test(tr.textContent)).querySelector('[data-wtdel]').click()); await wait(700);
    await f.evaluate(() => document.getElementById('cf_ok').click()); await wait(3000);
    st = await state();
    ok('a trip deleted (asked first): Day 2, Night 1', st.saved.length === 3 && /Day trips: 2/.test(st.tot) && !st.saved.some(x => /BT-103/.test(x)), st);
    await p.screenshot({ path: SHOTS + 'wt97_saved.png' });
    // the usual rows: a tanker is entered on its own form
    await f.evaluate(() => { document.getElementById('lg_change').click(); }); await wait(500);
    await f.evaluate(() => document.querySelector('[data-lgmode="date"]').click()); await wait(800);
    await f.evaluate(() => { const i = document.querySelector('#lg_in .lrow [data-f=no]'); i.value = 'WT-B1'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(1500);
    const note = await f.evaluate(() => (document.querySelector('#lg_in .lrow .c-m .lnote') || {}).textContent || '');
    ok('the usual Log Book rows: a water tanker is pointed to "Water tanker – trip by trip"', /is a water tanker – enter its trips with/.test(note), note);
    // the print
    await f.evaluate(d => { try { closeConfirm(false); } catch (e) {} document.getElementById('lf_from').value = d; document.getElementById('lf_to').value = d; const n = document.getElementById('lf_no'); n.value = 'WT-B1'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, today);
    await wait(2500); const before = prints.length; await f.evaluate(() => document.getElementById('lf_print').click());
    for (let i = 0; i < 30 && prints.length === before; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
    const sh = (prints[prints.length - 1] || []).find(x => /WT-B1/.test(x.mach || ''));
    const val = re => { const r = sh && sh.bill.find(q => re.test(q[0])); return r ? r[1] : (sh && (sh.bill.find(q => re.test(q[2])) || [])[3]) || null; };
    ok('the print is the WATER TANKER REPORT with his headings', !!sh && /WATER TANKER REPORT/.test(sh.name) && ['SR. NO.', 'DATE', 'SHIFT', 'NAME OF AGENCY', 'VEHICLE NO', 'CHALLAN NO', 'DISPATCH TIME', 'UNLOAD TIME', 'TRIP', 'CHAINAGE NO', 'USE FOR'].every(h => sh.head.indexOf(h) > -1), sh ? { name: sh.name, head: sh.head } : 'no print');
    ok('   one line per trip (3), each with its challan and times, trip 1', !!sh && sh.body.length === 3 && sh.body.every(r => r[8] === '1') && sh.body.map(r => r[5]).join(',') === 'BT-101,BT-102,BT-105', sh ? sh.body : null);
    ok('   below: TOTAL TRIPS 3, DAY TRIPS 2, NIGHT TRIPS 1; payable 2 × ₹500 + 1 × ₹700 = ₹1,700', val(/^TOTAL TRIPS/) === '3' && val(/^DAY TRIPS/) === '2' && val(/^NIGHT TRIPS/) === '1' && /1,700\.00/.test(val(/^PAYABLE AMOUNT/) || ''), sh ? sh.bill : null);
    // a phone: the form fits
    const ph = await b.newPage(); mine.add(ph); await ph.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); ph.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await ph.goto(BASE + '/', { waitUntil: 'load' }); await wait(6000);
    const g = await frameReady(ph);
    await g.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(1500); await g.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('lg_change').hidden || document.getElementById('lg_change').click(); document.querySelector('[data-lgmode="tanker"]').click(); }); await wait(1200);
    const fit = await g.evaluate(() => ({ shown: !document.getElementById('wt_form').hidden, wide: document.documentElement.scrollWidth - window.innerWidth }));
    ok('phone: the water tanker form opens and the page does not scroll sideways', fit.shown && fit.wide <= 1, fit);
    await ph.screenshot({ path: SHOTS + 'wt97_phone.png' });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error', errs.length === 0, errs);
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
