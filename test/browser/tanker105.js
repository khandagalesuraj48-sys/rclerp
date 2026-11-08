// update-105 (a water tanker: each trip its own line in the Log Book, Edit / Delete; a saved trip changed) in the browser, on the
// local rig (Mechanical :3001, the app's own sign-in, site S1). His case: an older Day entry (challan 18522) and one more trip (123)
// the same day – before, ONE line "2 trips, Challan 123, 18522". The test's own records are taken out at the end.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node tanker105.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const SHOTS = '/home/claude/test/shots/', PORT = 3001, BASE = 'http://127.0.0.1:' + PORT;
const clean = () => sql("delete from log_book where machinery like 'WT-E%'; delete from boq where vendor_name = 'ET Water Agency'; delete from master where id like 'WT-E%'; delete from vendors where vendor_name = 'ET Water Agency';");
const yday = new Date(Date.now() + 330 * 60000 - 86400000).toISOString().slice(0, 10);
const db = sh => sql("select coalesce(max(trip)::text, '-') || '|' || coalesce(max(challan_no), '') || '|' || coalesce(max(start_time), '') || '|' || coalesce(max(end_time), '') from log_book where machinery = 'WT-E1' and date = '" + yday + "' and shift = '" + sh + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = [], E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 300)); return r; };
  E(await api('saveVendor', { name: 'ET Water Agency', gstReg: 'No', pan: 'ABCPW1234E', bank: 'SBI', account: '12345674', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'WT-E1', name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'ET Water Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'ET Water Agency', from: '2026-09-01', tdsPct: 0, woNo: 'WO-ET', lines: [{ no: 'WT-E1', basis: 'Per Trip', rate: 500, diesel: 'Company' }] }, 'add'));
  E(await api('saveLogRows', { rows: [{ date: yday, shift: 'Day', no: 'WT-E1', mode: 'Trip', trip: 1, challan: '18522', tStart: '10:30', tEnd: '10:36', chFrom: 'VTR', work: 'PQC curing' }] }));
  E(await api('saveLbFormats', { 'WT-E1': 'I' }));
  E(await api('saveTankerTrips', { no: 'WT-E1', date: yday, shift: 'Day', trips: [{ c: '123', a: '07:35', b: '07:50' }] }));
  ok('seed: his case – an older Day entry (18522) and one more trip (123) the same day: ONE entry of 2 trips', !seedErr.length && db('Day') === '2|123, 18522|07:35|10:36', seedErr.join(' // ') + ' ' + db('Day'));
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    const frameReady = async pg => { for (let i = 0; i < 60; i++) { await wait(500); const fr = pg.frames().find(x => x !== pg.mainFrame()); try { if (fr && await fr.evaluate(() => !!document.getElementById('lg_email') && typeof showTab === 'function')) return fr; } catch (e) {} } throw new Error('the page did not load'); };
    let f = await frameReady(p); await wait(2500); f = await frameReady(p);
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000);
    const shut = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    const list = async () => { await shut(); await f.evaluate(d => { showTab('log'); $('lf_from').value = d; $('lf_to').value = d; $('lf_no').value = 'WT-E1'; loadLog(); }, yday); await wait(3000);
      return f.evaluate(() => [...document.querySelectorAll('#l_rows tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '))); };
    let L = await list();
    ok('Log Book list: each trip its own line (Trip 1 challan 123 07:35–07:50, Trip 2 challan 18522 10:30–10:36), each with Edit / Delete', L.length === 2 && /07:35–07:50 \| Trip 1\s*Challan 123/.test(L[0]) && /10:30–10:36 \| Trip 2\s*Challan 18522/.test(L[1]) && L.every(x => /Edit\s*Delete|Edit \| Delete|EditDelete/.test(x)), L);
    await p.screenshot({ path: SHOTS + 'wt105_list.png' });
    // Edit from the list: the trip opens in the water tanker form, ready to change
    await f.evaluate(() => document.querySelector('#l_rows [data-tedit="0"]').click()); await wait(3500);
    const ed = await f.evaluate(() => ({ form: !$('wt_form').hidden, note: $('wt_edit').hidden ? '' : $('wt_edit').innerText, row: [...document.querySelectorAll('#wt_in .wrow [data-w]')].map(x => x.value).join(' '), save: $('wt_save').textContent, add: $('wt_add').hidden }));
    ok('Edit (list): the water tanker form opens with that trip in the line above – "Changing trip 1 of Day – challan 123", Save change', ed.form && /Changing trip 1 of Day – challan 123/.test(ed.note) && ed.row.startsWith('123 07:35 07:50') && ed.save === 'Save change' && ed.add, ed);
    await p.screenshot({ path: SHOTS + 'wt105_edit.png' });
    await f.evaluate(() => { const tr = document.querySelector('#wt_in .wrow'); tr.querySelector('[data-w=b]').value = '08:05'; tr.querySelector('[data-w=ch]').value = '3+100'; $('wt_save').click(); }); await wait(3500);
    ok('   Save change: the trip is changed (07:35–08:05), still ONE Day entry of 2 trips', db('Day') === '2|123, 18522|07:35|10:36' && sql("select item_work::text from log_book where machinery = 'WT-E1' and shift = 'Day'").indexOf('08:05') > -1, db('Day'));
    // Edit on the form's saved trips: the older trip moved to the Night
    await f.evaluate(() => [...document.querySelectorAll('#wt_saved tr')].find(tr => /18522/.test(tr.textContent)).querySelector('[data-wtedit]').click()); await wait(400);
    await f.evaluate(() => { const tr = document.querySelector('#wt_in .wrow'); tr.querySelector('[data-w=a]').value = '21:00'; tr.querySelector('[data-w=b]').value = '21:30'; $('wt_shift').value = 'Night'; $('wt_save').click(); }); await wait(3500);
    const tot = await f.evaluate(() => $('wt_tot').textContent);
    ok('Edit (form): the older trip moved to the Night – Day 1 (123), Night 1 (18522)', db('Day') === '1|123|07:35|08:05' && db('Night') === '1|18522|21:00|21:30' && /Day trips: 1/.test(tot) && /Night trips: 1/.test(tot), { d: db('Day'), n: db('Night'), tot });
    // Delete from the list: one trip
    L = await list();
    await f.evaluate(() => [...document.querySelectorAll('#l_rows tr')].find(tr => /18522/.test(tr.textContent)).querySelector('[data-tdel]').click()); await wait(700);
    await f.evaluate(() => $('cf_ok').click()); await wait(3500);
    L = await list();
    ok('Delete (list): that trip goes (its Night entry with it); the Day trip stays', db('Night') === '-||' + '|' && db('Day') === '1|123|07:35|08:05' && L.length === 1, { L, n: db('Night') });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error', errs.length === 0, errs);
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
