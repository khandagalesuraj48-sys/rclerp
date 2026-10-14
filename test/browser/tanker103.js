// update-103 (water tanker – more trips in the same Day / Night) in the browser, on the local rig (Mechanical :3001 – the app's own
// sign-in, site S1). An entry made the usual way BEFORE trip by trip (as on site: Day, Trip 1, its challan and times) no longer
// stops new trips: it is shown as its trip (marked) and the new trips join it; a Night of that day gets its own entry; an old Full
// Day entry + Night trips → it becomes the Day; Edit Log Book adds no row for a tanker (a note says where trips go), other
// machinery as before. The test's own records are taken out at the end.
//   NODE_OPTIONS="--require <path>/geo-shim.js" node tanker103.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const SHOTS = '/home/claude/test/shots/', PORT = 3001, BASE = 'http://127.0.0.1:' + PORT;
const clean = () => sql("delete from log_book where machinery like 'WT-C%'; delete from boq where vendor_name = 'CT Water Agency'; delete from master where id like 'WT-C%'; delete from vendors where vendor_name = 'CT Water Agency';");
const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10), yday = new Date(Date.now() + 330 * 60000 - 86400000).toISOString().slice(0, 10);
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = [], E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 300)); return r; };
  E(await api('saveVendor', { name: 'CT Water Agency', gstReg: 'No', pan: 'ABCPW1234C', bank: 'SBI', account: '12345670', ifsc: 'SBIN0000001' }, 'add'));
  for (const no of ['WT-C1', 'WT-C2']) E(await api('saveMaster', { no: no, name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'CT Water Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'CT Water Agency', from: '2026-09-01', tdsPct: 0, woNo: 'WO-CT', lines: [{ no: 'WT-C1', basis: 'Per Trip', rate: 500, diesel: 'Company' }, { no: 'WT-C2', basis: 'Per Trip', rate: 500, diesel: 'Company' }] }, 'add'));
  // the entries made BEFORE trip by trip (the usual Log Book page, the tanker not yet on Format I)
  E(await api('saveLogRows', { rows: [{ date: yday, shift: 'Day', no: 'WT-C1', mode: 'Trip', trip: 1, challan: 'CT-1', tStart: '08:00', tEnd: '08:40', work: 'Curing' },
    { date: today, shift: 'Full Day', no: 'WT-C2', mode: 'Trip', trip: 2, challan: 'CT-21, CT-22' }] }));
  E(await api('saveLbFormats', { 'WT-C1': 'I', 'WT-C2': 'I' }));
  ok('seed: two tankers with an entry made before trip by trip (WT-C1 Day, Trip 1; WT-C2 Full Day, Trip 2), then Format I', !seedErr.length && sql("select count(*) from log_book where machinery like 'WT-C%'") === '2', seedErr.join(' // '));
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    const frameReady = async pg => { for (let i = 0; i < 60; i++) { await wait(500); const fr = pg.frames().find(x => x !== pg.mainFrame()); try { if (fr && await fr.evaluate(() => !!document.getElementById('lg_email') && typeof showTab === 'function')) return fr; } catch (e) {} } throw new Error('the page did not load'); };
    let f = await frameReady(p); await wait(2500); f = await frameReady(p);
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000);
    const shut = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await shut(); await f.evaluate(() => showTab('log')); await wait(2000); await shut();
    await f.evaluate(() => document.querySelector('[data-lgmode="tanker"]').click()); await wait(800);
    const pick = async (no, d, shift) => { await f.evaluate((no, sh, d) => { $('wt_date').value = d; $('wt_shift').value = sh; const n = $('wt_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); }, no, shift, d); await wait(2000); };
    const typeTrips = async list => { await f.evaluate(list => { $('wt_in').innerHTML = ''; list.forEach(() => $('wt_add').click()); const rows = [...document.querySelectorAll('#wt_in .wrow')];
      list.forEach((t, i) => { ['c', 'a', 'b', 'ch', 'u'].forEach((k, j) => { rows[i].querySelector('[data-w=' + k + ']').value = t[j] || ''; }); }); }, list); };
    const saveIt = async () => { await f.evaluate(() => $('wt_save').click()); await wait(3000); };
    const state = () => f.evaluate(() => ({ saved: [...document.querySelectorAll('#wt_saved tr')].filter(tr => tr.children.length > 2).map(tr => [...tr.children].slice(1, 6).map(c => c.textContent).join(' ')), tot: $('wt_tot').textContent, err: $('wt_err').hidden ? '' : $('wt_err').textContent, info: $('wt_info').textContent }));
    await pick('WT-C1', yday, 'Day');
    let st = await state();
    ok('the old Day entry is shown as its trip, marked "entered before trip by trip" – no error', st.saved.length === 1 && /^Day CT-1 \(entered before trip by trip\) 08:00 08:40/.test(st.saved[0]) && !/not made trip by trip|already/.test(st.info), st);
    await typeTrips([['CT-2', '10:00', '10:30', '12+500', 'Curing'], ['CT-3', '11:00', '11:40']]); await saveIt();
    st = await state();
    ok('two more Day trips the same day: SAVED (before: "there is already a Day entry that was not made trip by trip")', !st.err && st.saved.length === 3 && /Day trips: 3/.test(st.tot), st);
    ok('   ONE Day entry of 3 trips: challans CT-1, CT-2, CT-3, 08:00 to 11:40', sql("select count(*) || '|' || max(trip) || '|' || max(challan_no) || '|' || max(start_time) || '|' || max(end_time) from log_book where machinery = 'WT-C1' and shift = 'Day'") === '1|3|CT-1, CT-2, CT-3|08:00|11:40', sql("select count(*) || '|' || max(trip) || '|' || max(challan_no) || '|' || max(start_time) || '|' || max(end_time) from log_book where machinery = 'WT-C1' and shift = 'Day'"));
    await p.screenshot({ path: SHOTS + 'wt103_joined.png' });
    await typeTrips([['CT-4', '08:10', '08:30']]); await saveIt();
    st = await state();
    ok('a time on the old trip (08:00–08:40): DUPLICATE time, nothing saved', /DUPLICATE time – 08:10–08:30 falls on the trip 08:00–08:40/.test(st.err) && st.saved.length === 3, st);
    await f.evaluate(() => { $('wt_shift').value = 'Night'; }); await typeTrips([['CT-5', '21:00', '21:30'], ['CT-6', '23:30', '00:10']]); await saveIt();
    st = await state();
    ok('Night trips of that day: saved – Day 3, Night 2, Total 5', !st.err && /Day trips: 3/.test(st.tot) && /Night trips: 2/.test(st.tot) && /Total trips: 5/.test(st.tot), st);
    // the old Full Day entry and Night trips
    await pick('WT-C2', today, 'Night');
    st = await state();
    ok('the old Full Day entry (Trip 2, two challans): its 2 trips shown, marked', st.saved.length === 2 && st.saved.every(x => /entered before trip by trip/.test(x)), st);
    await typeTrips([['CT-31', '21:00', '21:45']]); await saveIt();
    st = await state();
    const sh2 = sql("select string_agg(shift || ':' || trip, ',' order by shift) from log_book where machinery = 'WT-C2'");
    ok('a Night trip on a Full Day date: saved – the old entry is now the Day, the Night its own (Day:2, Night:1)', !st.err && sh2 === 'Day:2,Night:1' && /Day trips: 2/.test(st.tot) && /Night trips: 1/.test(st.tot), { st, sh2 });
    await p.screenshot({ path: SHOTS + 'wt103_fullday.png' });
    // Edit Log Book: no row is added for a tanker; another machinery as before
    const lx = async (no, from, to) => { await f.evaluate((no, from, to) => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); $('lx_from').value = from; $('lx_to').value = to; const n = $('lx_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); $('lx_load').click(); }, no, from, to); await wait(3500);
      return f.evaluate(() => ({ add: $('lx_add').hidden, fill: $('lx_fill').hidden, info: $('lx_info').textContent, rows: document.querySelectorAll('#lx_rows tr').length })); };
    let L = await lx('WT-C1', yday, today);
    ok('Edit Log Book, a water tanker: "+ Add row" / "Add all missing dates" hidden; the note says where more trips go', L.add && L.fill && /more trips in a Day \/ Night are added on Log Book → "Water tanker – trip by trip"/.test(L.info), L);
    await p.screenshot({ path: SHOTS + 'wt103_lx.png' });
    const other = sql("select id from master where id not like 'WT-%' and coalesce(log_book_format,'') not in ('I') order by id limit 1");
    L = await lx(other, '2026-09-01', '2026-09-30');
    ok('Edit Log Book, another machinery (' + other + '): the buttons are back, no tanker note', !L.add && !L.fill && !/Water tanker/.test(L.info), L);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error', errs.length === 0, errs);
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
