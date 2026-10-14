// update-107 (Log Book → "Import from Excel" takes a water tanker's lines as TRIPS – before, the whole file was refused) in the
// browser, on the local rig (Mechanical :3001 – the app's own sign-in, site S1). One file with a KM machinery and a water tanker:
// the KM row goes in as before, each tanker line = one trip (a trip already saved = skipped, an Idle line of the tanker = not
// imported, said so); a tanker line with 3 trips is stopped ("one line per trip"); a trip without its Unload time is stopped by the
// tanker's own check (nothing saved); the Log Book Excel of the tanker = one line per trip, and that same file comes back as
// "already in the Log Book". The test's own records are taken out.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node tanker107.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const SHOTS = '/home/claude/test/shots/', PORT = 3001, BASE = 'http://127.0.0.1:' + PORT;
const clean = () => sql("delete from log_book where machinery like 'WT-U%' or machinery like 'TU-K%'; delete from boq where vendor_name = 'DU Water Agency'; delete from master where id like 'WT-U%' or id like 'TU-K%'; delete from vendors where vendor_name = 'DU Water Agency';");
const ist = ms => new Date(Date.now() + 330 * 60000 - ms).toISOString().slice(0, 10), today = ist(0), yday = ist(86400000), dmy = d => d.split('-').reverse().join('-');
const db = (no, dk, sh) => sql("select coalesce(max(trip)::text, '-') || '|' || coalesce(max(challan_no), '') from log_book where machinery = '" + no + "' and date = '" + dk + "'" + (sh ? " and shift = '" + sh + "'" : ''));
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = [], E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 300)); return r; };
  E(await api('saveVendor', { name: 'DU Water Agency', gstReg: 'No', pan: 'ABCPU1234D', bank: 'SBI', account: '12345673', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'WT-U1', name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'DU Water Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveMaster', { no: 'TU-K1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'DU Water Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'DU Water Agency', from: '2026-09-01', tdsPct: 0, woNo: 'WO-DU', lines: [{ no: 'WT-U1', basis: 'Per Trip', rate: 500, diesel: 'Company' }, { no: 'TU-K1', basis: 'Per KM', rate: 40, diesel: 'Company' }] }, 'add'));
  E(await api('saveLogRows', { rows: [{ date: yday, shift: 'Day', no: 'WT-U1', mode: 'Trip', trip: 1, challan: 'DU-1', tStart: '08:00', tEnd: '08:40' }] }));
  E(await api('saveLbFormats', { 'WT-U1': 'I' }));
  ok('seed: WT-U1 (Format I) with a Day trip DU-1 on ' + yday + '; TU-K1 a KM tipper', !seedErr.length, seedErr.join(' // '));
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    const frameReady = async pg => { for (let i = 0; i < 60; i++) { await wait(500); const fr = pg.frames().find(x => x !== pg.mainFrame()); try { if (fr && await fr.evaluate(() => !!document.getElementById('lg_email') && typeof showTab === 'function')) return fr; } catch (e) {} } throw new Error('the page did not load'); };
    let f = await frameReady(p); await wait(2500); f = await frameReady(p);
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('log'); }); await wait(3000);
    await f.addScriptTag({ path: path.join(path.dirname(require.resolve('xlsx')), 'dist/xlsx.full.min.js') });      // the Excel tool from the local copy (the CDN is closed in the test rig)
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__x = null; saveXlsxLists = async function (name, sheets) { window.__x = { name: name, sheets: sheets }; return true; }; });
    // give an Excel file (rows under a heading row) to the page's own "Import from Excel"; every question answered with its OK button
    const importFile = async (aoa, sheets) => { await f.evaluate((aoa2, sh2) => { const wb = XLSX.utils.book_new();
        if (sh2) sh2.forEach(s => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name)); else XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa2), 'Log Book');
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), dt = new DataTransfer(); dt.items.add(new File([buf], 'in.xlsx'));
        const inp = document.getElementById('lg_file'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); }, aoa, sheets || null);
      let asked = '';
      for (let i = 0; i < 60; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const tx = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 600); const stop = /Fix the file|Nothing imported|not imported|Already in/.test(document.getElementById('cf_title').textContent); document.getElementById('cf_ok').click(); return (stop ? 'STOP ' : '') + tx; }
          const x = document.getElementById('toast'); if (x && !x.hidden && /Log Book:|Water tanker:/.test(x.textContent)) return 'TOAST ' + x.textContent; const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? 'FIX ' + bx.textContent.replace(/\s+/g, ' ').slice(0, 300) : ''; });
        if (/^(TOAST|STOP|FIX)/.test(t)) return asked + t; if (t) { asked += t + ' || '; await wait(300); } }
      return asked + ' (no end)'; };
    const H = ['Date', 'Shift', 'Machinery', 'Measured by', 'Start KM', 'Close KM', 'From time', 'To time', 'Trips', 'Challan No', 'Chainage From', 'Chainage To', 'Work Done', 'Status'];
    // 1) one file: a KM machinery and a water tanker
    let r = await importFile([H,
      [dmy(yday), 'Full Day', 'TU-K1', 'KM', 1000, 1040, '', '', '', '', '', '', 'Soil', ''],
      [dmy(yday), 'Day', 'WT-U1', 'Trip', '', '', '08:00', '08:40', 1, 'DU-1', '', '', '', ''],
      [dmy(yday), 'Day', 'WT-U1', 'Trip', '', '', '10:00', '10:30', 1, 'DU-2', '7+100', '', 'Curing', ''],
      [dmy(today), 'Night', 'WT-U1', 'Trip', '', '', 0.875, 0.895833333, 1, 'DU-3', '', '', '', ''],      // Excel times (21:00 – 21:30)
      [dmy(today), 'Day', 'WT-U1', '', '', '', '', '', '', '', '', '', '', 'Idle']]);
    ok('one file, a KM machinery + a water tanker: not refused; the question says 1 new entry, 2 tanker trips to add (1 tanker), 1 already saved, the Idle line not imported',
      /1 new entry will be added/.test(r) && /2 water tanker trips will be added \(1 tanker\)/.test(r) && /1 water tanker trip already saved/.test(r) && /1 line of a water tanker with Idle/.test(r) && /^.*TOAST Log Book: 1 added.*Water tanker: 2 trips added, 1 already saved/.test(r), r);
    ok('…saved: TU-K1 its entry (40 km); WT-U1 Day ' + yday + ' = 2 trips DU-1, DU-2 (one entry); Night ' + today + ' = DU-3 at 21:00–21:30; no Idle entry',
      sql("select working_km from log_book where machinery = 'TU-K1' and date = '" + yday + "'") === '40' && db('WT-U1', yday, 'Day') === '2|DU-1, DU-2' && db('WT-U1', today, 'Night') === '1|DU-3'
      && sql("select start_time || '-' || end_time from log_book where machinery = 'WT-U1' and date = '" + today + "'").replace(/(\d\d:\d\d):00/g, '$1') === '21:00-21:30' && sql("select count(*) from log_book where machinery = 'WT-U1' and unit = 'Idle'") === '0',
      { k: sql("select working_km from log_book where machinery = 'TU-K1'"), d: db('WT-U1', yday, 'Day'), n: db('WT-U1', today, 'Night'), t: sql("select start_time || '-' || end_time from log_book where machinery = 'WT-U1' and date = '" + today + "'") });
    await p.screenshot({ path: SHOTS + 'wt107_import.png' });
    // 2) a tanker line with 3 trips – stopped on the page
    const before = sql("select count(*) from log_book where machinery like 'WT-U%' or machinery like 'TU-K%'");
    r = await importFile([H, [dmy(today), 'Day', 'WT-U1', 'Trip', '', '', '', '', 3, 'DU-7, DU-8, DU-9', '', '', '', '']]);
    ok('a tanker line with 3 trips: stopped – "one line per trip", nothing imported', /^STOP Fix the file first/.test(r) && /WT-U1 is a water tanker – one line per trip \(this line has 3 trips\)/.test(r) && sql("select count(*) from log_book where machinery like 'WT-U%' or machinery like 'TU-K%'") === before, r);
    // 3) a trip without its Unload time (with a new KM row in the same file) – stopped by the tanker's own check, nothing saved
    r = await importFile([H, [dmy(today), 'Full Day', 'TU-K1', 'KM', '', 1070, '', '', '', '', '', '', '', ''], [dmy(today), 'Day', 'WT-U1', 'Trip', '', '', '11:00', '', 1, 'DU-10', '', '', '', '']]);
    ok('a trip without its Unload time: stopped with the line and the reason; the KM row of the same file is not saved either', /^STOP Fix the file first/.test(r) && /Line 3: .*WT-U1 .*challan DU-10: enter the Unload time/.test(r) && sql("select count(*) from log_book where machinery like 'WT-U%' or machinery like 'TU-K%'") === before, r);
    // 4) the Log Book Excel of the tanker: one line per trip – and the same file back = already in the Log Book
    await f.evaluate((a, c) => { document.getElementById('lf_from').value = a; document.getElementById('lf_to').value = c; document.getElementById('lf_no').value = 'WT-U1'; window.__x = null; document.getElementById('lf_exp_mach').click(); }, yday, today);
    for (let i = 0; i < 40; i++) { await wait(400); if (await f.evaluate(() => !!window.__x)) break; }
    const ex = await f.evaluate(() => { const x = window.__x; if (!x) return null; const s = x.sheets.find(y => y.name === 'WT-U1'); const head = s.aoa[s.head - 1];
      const body = s.aoa.slice(s.head).filter(r => r && r.length && !/^Total/.test(String(r[0])) && String(r[2] || '').trim());
      return { head: head, rows: body.map(r => [r[1], r[head.indexOf('Trips')], r[head.indexOf('Challan No')], r[head.indexOf('From time')], r[head.indexOf('To time')], r[head.indexOf('Chainage From')], r[head.indexOf('Work Done')]].join(' ')),
        sheets: x.sheets.map(y => ({ name: y.name, aoa: y.aoa.map(r => (r || []).map(v => v && typeof v === 'object' && v.formula ? (v.result === undefined ? '' : v.result) : v)) })) }; });
    ok('Log Book Excel of the tanker: one line per trip (DU-1, DU-2 on Day, DU-3 on Night) with its challan, times, chainage, use for',
      !!ex && ex.rows.join(' ; ') === 'Day 1 DU-1 08:00 08:40   ; Day 1 DU-2 10:00 10:30 7+100 Curing ; Night 1 DU-3 21:00 21:30  ', ex && ex.rows);
    r = ex ? await importFile(null, ex.sheets) : 'no file';
    ok('…the same file back: "already in the Log Book", nothing added', /^STOP Already in the Log Book/.test(r) && /All 3 lines/.test(r) && db('WT-U1', yday, 'Day') === '2|DU-1, DU-2' && db('WT-U1', today, 'Night') === '1|DU-3', r);
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 600)); }
  finally { await b.close(); try { clean(); } catch (e) {} }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
