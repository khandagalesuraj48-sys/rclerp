// update-104 (Edit Log Book of a water tanker – one row per trip; Excel export and import) in the browser, on the local rig
// (Mechanical :3001 – the app's own sign-in, site S1). A tanker with an entry made before trip by trip: Edit Log Book opens its
// TRIPS (not the usual grid), + Add row adds a trip into the same Day, a Night trip makes a Night entry, the same challan twice is
// stopped on the page, a row taken out; Export Excel = the Water Tanker Report layout with empty lines; Import Excel adds trips of
// two tankers (one already saved = skipped); another machinery opens the usual grid. The test's own records are taken out.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node tanker104.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), fs = require('fs'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const SHOTS = '/home/claude/test/shots/', PORT = 3001, BASE = 'http://127.0.0.1:' + PORT, DL = '/tmp/claude-0/dl104';
const clean = () => sql("delete from log_book where machinery like 'WT-D%'; delete from boq where vendor_name = 'DT Water Agency'; delete from master where id like 'WT-D%'; delete from vendors where vendor_name = 'DT Water Agency';");
const ist = ms => new Date(Date.now() + 330 * 60000 - ms).toISOString().slice(0, 10), today = ist(0), yday = ist(86400000), dmy = d => d.split('-').reverse().join('-');
const trips = (no, sh) => sql("select coalesce(max(trip)::text, '-') || '|' || coalesce(max(challan_no), '') from log_book where machinery = '" + no + "'" + (sh ? " and shift = '" + sh + "'" : ''));
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = [], E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 300)); return r; };
  E(await api('saveVendor', { name: 'DT Water Agency', gstReg: 'No', pan: 'ABCPW1234D', bank: 'SBI', account: '12345672', ifsc: 'SBIN0000001' }, 'add'));
  for (const no of ['WT-D1', 'WT-D2']) E(await api('saveMaster', { no: no, name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'DT Water Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'DT Water Agency', from: '2026-09-01', tdsPct: 0, woNo: 'WO-DT', lines: [{ no: 'WT-D1', basis: 'Per Trip', rate: 500, diesel: 'Company' }, { no: 'WT-D2', basis: 'Per Trip', rate: 500, diesel: 'Company' }] }, 'add'));
  E(await api('saveLogRows', { rows: [{ date: yday, shift: 'Day', no: 'WT-D1', mode: 'Trip', trip: 1, challan: 'DT-1', tStart: '08:00', tEnd: '08:40' }] }));
  E(await api('saveLbFormats', { 'WT-D1': 'I', 'WT-D2': 'I' }));
  ok('seed: WT-D1 with a Day entry made before trip by trip (DT-1), WT-D2; both Format I', !seedErr.length, seedErr.join(' // '));
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    const cdp = await p.target().createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }).catch(() => cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    const frameReady = async pg => { for (let i = 0; i < 60; i++) { await wait(500); const fr = pg.frames().find(x => x !== pg.mainFrame()); try { if (fr && await fr.evaluate(() => !!document.getElementById('lg_email') && typeof showTab === 'function')) return fr; } catch (e) {} } throw new Error('the page did not load'); };
    let f = await frameReady(p); await wait(2500); f = await frameReady(p);
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000);
    const open = async (no, from, to) => { await f.evaluate((no, from, to) => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; if (S.lt) S.lt = null; LX.rows = []; LX.deleted = []; showTab('logedit'); $('lx_from').value = from; $('lx_to').value = to; const n = $('lx_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); $('lx_load').click(); }, no, from, to); await wait(3500); };
    const st = () => f.evaluate(() => ({ lt: !$('lt_panel').hidden, lx: !$('lx_panel').hidden, rows: [...document.querySelectorAll('#lt_rows tr.ltr')].map(tr => [...tr.querySelectorAll('[data-t]')].map(x => x.value).join(' ') + (tr.dataset.old === '1' ? ' (old)' : '')),
      tot: $('lt_tot').textContent, err: $('lt_err').hidden ? '' : $('lt_err').textContent, save: !$('lt_save').disabled, sum: $('lt_sum').textContent, add: !$('lt_add').hidden, info: $('lt_info').textContent }));
    const fillLast = async v => { await f.evaluate(v => { const tr = [...document.querySelectorAll('#lt_rows tr.ltr')].pop(); Object.keys(v).forEach(k => { const x = tr.querySelector('[data-t=' + k + ']'); x.value = v[k]; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }); }, v); };
    const saveIt = async () => { await f.evaluate(() => $('lt_save').click()); for (let i = 0; i < 40; i++) { await wait(400); if (await f.evaluate(() => !$('lt_err').hidden || ($('lt_save').disabled && !/Saving/.test($('lt_save').textContent)))) break; } await wait(300); };
    await open('WT-D1', yday, today);
    let s = await st();
    ok('Edit Log Book, a water tanker: its trips open (one row each), not the usual grid; "+ Add row" is there', s.lt && !s.lx && s.add && s.rows.length === 1 && s.rows[0] === yday + ' Day DT-1 08:00 08:40   (old)', s);
    await p.screenshot({ path: SHOTS + 'wt104_open.png' });
    await f.evaluate(() => $('lt_add').click()); await wait(300);
    s = await st();
    ok('+ Add row: a new row with the date and shift of the row above', s.rows.length === 2 && s.rows[1].startsWith(yday + ' Day'), s);
    await fillLast({ c: 'DT-2', a: '10:00', b: '10:30', ch: '7+100', u: 'Curing' }); await saveIt();
    s = await st();
    ok('saved: the 2nd trip joins the same Day entry (before: "two entries on Day")', !s.err && trips('WT-D1', 'Day') === '2|DT-1, DT-2' && s.rows.length === 2 && /Day trips: 2/.test(s.tot), { s, db: trips('WT-D1', 'Day') });
    await f.evaluate(() => $('lt_add').click()); await fillLast({ date: today, shift: 'Night', c: 'DT-3', a: '21:00', b: '21:30' }); await saveIt();
    s = await st();
    ok('a Night trip on another date: its own Night entry; totals Day 2, Night 1', !s.err && sql("select count(*) from log_book where machinery = 'WT-D1' and shift = 'Night' and date = '" + today + "'") === '1' && /Night trips: 1/.test(s.tot) && /Total trips: 3/.test(s.tot), s);
    await f.evaluate(() => $('lt_add').click()); await fillLast({ date: yday, shift: 'Day', c: 'dt-2', a: '11:00', b: '11:30' }); await saveIt();
    s = await st();
    ok('the same challan twice on a date: stopped on the page, nothing saved', /DUPLICATE challan dt-2 – also in row 2/.test(s.err) && trips('WT-D1', 'Day') === '2|DT-1, DT-2', s);
    await f.evaluate(() => [...document.querySelectorAll('#lt_rows tr.ltr')].pop().querySelector('.del').click());
    await f.evaluate(() => [...document.querySelectorAll('#lt_rows tr.ltr')].find(tr => tr.querySelector('[data-t=c]').value === 'DT-2').querySelector('.del').click()); await wait(200); await saveIt();
    s = await st();
    ok('a row taken out and saved: the Day entry has 1 trip again; nothing left to save ("No changes yet")', !s.err && trips('WT-D1', 'Day') === '1|DT-1' && s.rows.length === 2 && !s.save && s.sum === 'No changes yet', { s, db: trips('WT-D1', 'Day') });
    await p.screenshot({ path: SHOTS + 'wt104_saved.png' });
    // Export Excel
    await f.evaluate(() => $('lt_export').click());
    let file = ''; for (let i = 0; i < 40 && !file; i++) { await wait(500); file = fs.readdirSync(DL).find(x => /\.xlsx$/.test(x)) || ''; }
    const XLSX = require('xlsx');
    const aoa = file ? XLSX.utils.sheet_to_json(XLSX.readFile(path.join(DL, file)).Sheets.Trips, { header: 1, defval: '' }) : [];
    const hi = aoa.findIndex(r => r[0] === 'SR. NO.');
    ok('Export Excel: the Water Tanker Report layout – its 2 trips, then empty lines with the tanker filled in', hi > -1 && aoa[hi].join('|') === 'SR. NO.|DATE|SHIFT|NAME OF AGENCY|VEHICLE NO|CHALLAN NO|DISPATCH TIME|UNLOAD TIME|TRIP|CHAINAGE NO|USE FOR' && aoa[hi + 1][5] === 'DT-1' && aoa[hi + 2][5] === 'DT-3' && aoa[hi + 3][4] === 'WT-D1' && aoa.length - hi - 1 >= 102, { file, head: aoa[hi], r1: aoa[hi + 1], r3: aoa[hi + 3], n: aoa.length });
    // Import Excel: the exported file with lines filled in (one already saved, new trips of WT-D1 and WT-D2)
    aoa[hi + 3] = [3, dmy(today), 'Day', 'DT Water Agency', 'WT-D1', 'DT-4', '07:00', '07:45', 1, '8+000', 'Dust'];
    aoa[hi + 4] = [4, dmy(yday), 'Night', 'DT Water Agency', 'WT-D2', 'DT-5', '22:00', '22:40', 1, '', ''];
    aoa[hi + 5] = [5, dmy(yday), 'Day', 'DT Water Agency', 'WT-D2', 'DT-6', '09:00', '09:30', 1, '', 'Curing'];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Trips'); const up = path.join(DL, 'filled.xlsx'); XLSX.writeFile(wb, up);
    const inp = await f.$('#lt_file'); await f.evaluate(() => window.rclLoadXlsx && window.rclLoadXlsx()); await wait(1500); await inp.uploadFile(up); await wait(4000);
    const conf = await f.evaluate(() => !$('cf_back').hidden && $('cf_back').textContent.replace(/\s+/g, ' '));
    ok('Import Excel: checked first – 3 trips will be added (2 tankers), 2 already saved – skipped', !!conf && /3 trips will be added \(2 tankers\)/.test(conf) && /2 already saved/.test(conf), conf);
    await p.screenshot({ path: SHOTS + 'wt104_import.png' });
    await f.evaluate(() => $('cf_ok').click()); await wait(5000);
    s = await st();
    ok('   imported: WT-D1 today Day DT-4; WT-D2 Day DT-6 and Night DT-5; the grid shows the new trip', trips('WT-D1', 'Day').indexOf('DT-4') > -1 && trips('WT-D2', 'Day') === '1|DT-6' && trips('WT-D2', 'Night') === '1|DT-5' && s.rows.some(x => /DT-4/.test(x)), { s, d1: trips('WT-D1', 'Day'), d2: trips('WT-D2') });
    // another machinery: the usual grid as before
    const other = sql("select id from master where id not like 'WT-%' and coalesce(log_book_format,'') <> 'I' order by id limit 1");
    await open(other, '2026-09-01', '2026-09-30');
    s = await st();
    ok('another machinery (' + other + '): the usual Edit Log Book grid, the tanker rows gone', s.lx && !s.lt, s);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error', errs.length === 0, errs);
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
