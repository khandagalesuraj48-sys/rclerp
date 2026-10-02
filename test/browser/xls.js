// the Log Book Excel of a picked machinery: only that machinery, its dates, its columns (no diesel, no status / hint columns),
// "Work type" for Bucket / Breaker, and the same file back through the page's own Import
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
(async () => {
  sql("delete from log_book where id in ('MH-15-AB-0001|2026-10-02|Full Day', 'EX-200|2026-10-02|Full Day')");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(3000);
  await f.addScriptTag({ path: path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js') });      // the Excel tool from the local copy (the CDN is closed in the test rig)
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__x = null; saveXlsxLists = async function (name, sheets) { window.__x = { name: name, sheets: sheets }; return true; }; });
  const run = async (btn, no, from, to, top) => { await f.evaluate((no2, a, c, top2) => { document.getElementById('lf_from').value = a; document.getElementById('lf_to').value = c; document.getElementById('lf_no').value = no2; if (top2 !== undefined) { setLgMode('mach'); document.getElementById('lg_top_no').value = top2; } window.__x = null; }, no, from, to, top);
    await f.evaluate(id => document.getElementById(id).click(), btn); for (let i = 0; i < 40; i++) { await wait(400); if (await f.evaluate(() => !!window.__x)) break; }
    return f.evaluate(() => { const x = window.__x; if (!x) { const bx = document.getElementById('fixbox'); return { err: bx && !bx.hidden ? bx.querySelector('.fx-msg').textContent : 'nothing came' }; }
      const body = s => s.aoa.slice(s.head).filter(r => r && r.length && !/^Total/.test(String(r[0])));
      return { file: x.name, tabs: x.sheets.map(s => s.name), sheets: x.sheets.map(s => ({ name: s.name, title: (s.aoa[2] || [])[0], head: s.aoa[s.head - 1], rows: body(s).length, nos: [...new Set(body(s).map(r => r[2]))],
        lists: (s.lists || []).map(L => s.aoa[s.head - 1][L.col] + ': ' + (typeof L.values === 'function' ? L.values(body(s)[0]) : L.values).join('/')), first: body(s)[0], last: body(s)[body(s).length - 1] })) }; }); };
  // write the captured sheets as a real Excel file, change some cells, and give it to the page's own "Import from Excel"
  const importBack = async edit => { await f.evaluate(e => { const x = window.__x, wb = XLSX.utils.book_new();
      x.sheets.forEach(sh => { const aoa = sh.aoa.map(r => (r || []).map(v => v && typeof v === 'object' && v.formula ? (v.result === undefined ? '' : v.result) : v));
        if (sh.name !== 'Summary') { const head = aoa[sh.head - 1]; Object.keys(e).forEach(date => { const row = aoa.find(r => r[0] === date); Object.keys(e[date]).forEach(h => { row[head.indexOf(h)] = e[date][h]; }); }); }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sh.name); });
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), dt = new DataTransfer(); dt.items.add(new File([buf], 'back.xlsx'));
      const inp = document.getElementById('lg_file'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); }, edit);
    let asked = '', done = '';
    for (let i = 0; i < 50; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const tx = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 220); const stop = /Fix the file|Nothing imported/.test(tx); document.getElementById('cf_ok').click(); return (stop ? 'STOP ' : '') + tx; } const x = document.getElementById('toast'); return x && !x.hidden && /Log Book:/.test(x.textContent) ? 'TOAST ' + x.textContent : ''; });
      if (/^TOAST/.test(t)) { done = t; break; } if (/^STOP/.test(t)) { done = t; break; } if (t) asked += t + ' || '; }
    return asked + done; };
  // 1. a KM machinery
  let x = await run('lf_exp_mach', 'MH-15-AB-0001', '2026-09-25', '2026-10-02'); let s = (x.sheets || []).find(y => y.name === 'MH-15-AB-0001') || {};
  const h1 = (s.head || []).join(' | ');
  ok('KM machinery: its own tab, the 8 dates of the period', JSON.stringify(x.tabs) === '["Summary","MH-15-AB-0001"]' && s.rows === 8 && JSON.stringify(s.nos) === '["MH-15-AB-0001"]', x.err || JSON.stringify(x.tabs) + ' ' + s.rows + ' rows');
  ok('…its columns only – no diesel, no Status, no hint column', h1 === 'Date | Shift | Machinery | Type | Measured by | Start KM | Close KM | Total KM | Chainage From | Chainage To | Work Done | Driver Name | Remark', h1);
  ok('…"Measured by" has a drop-down of its ways + Idle / Holiday / Breakdown, and comes filled on the empty dates', /Measured by: KM\/Idle\/Holiday\/Breakdown/.test((s.lists || []).join(' ; ')) && s.last && s.last[4] === 'KM', (s.lists || []).join(' ; ') + ' | last row: ' + JSON.stringify(s.last).slice(0, 120));
  ok('…Total KM is a formula (Close − Start)', s.last && s.last[7] && /^IF\(AND\(ISNUMBER\(G\d+\),ISNUMBER\(F\d+\)\),G\d+-F\d+,""\)$/.test(s.last[7].formula || ''), JSON.stringify(s.last && s.last[7]));
  const lastClose = Number(sql("select max(closing_km) from log_book where machinery = 'MH-15-AB-0001'"));
  let r = await importBack({ '02-10-2026': { 'Close KM': lastClose + 40 } });
  ok('the file comes back: the date filled in Excel is added, the empty dates are skipped (their "Measured by" alone is not an entry)', /1 new entry will be added/.test(r) && /Log Book: 1 added/.test(r) && sql("select working_km from log_book where id = 'MH-15-AB-0001|2026-10-02|Full Day'") === '40', r.slice(0, 260));
  // 2. an hour machinery with Bucket / Breaker
  x = await run('lf_exp_mach', 'EX-200', '2026-09-30', '2026-10-02'); s = (x.sheets || []).find(y => y.name === 'EX-200') || {}; const h2 = (s.head || []).join(' | ');
  ok('Bucket / Breaker machinery: hour columns, "Work type" and "Breaker (hr)"; no KM, no diesel', h2 === 'Date | Shift | Machinery | Type | Measured by | Start Hrs | Close Hrs | Total Hrs | Work type | Breaker (hr) | Chainage From | Chainage To | Work Done | Driver Name | Remark', x.err || h2);
  ok('…"Work type" drop-down: Bucket / Breaker / Split; the saved days show what they were', /Work type: Bucket\/Breaker\/Split/.test((s.lists || []).join(' ; ')) && s.first && s.first[8] === 'Breaker', (s.lists || []).join(' ; ') + ' | 30-09: ' + JSON.stringify(s.first).slice(0, 160));
  r = await importBack({ '02-10-2026': { 'Close Hrs': 1024 } });
  ok('a working day without a Work type is refused before anything is imported', /STOP Fix the file first/.test(r) && sql("select count(*) from log_book where id = 'EX-200|2026-10-02|Full Day'") === '0', r.slice(0, 200));
  r = await importBack({ '02-10-2026': { 'Close Hrs': 1024, 'Work type': 'Breaker' } });
  ok('Work type "Breaker": the whole day (8 hr) is breaker work', /Log Book: 1 added/.test(r) && /^8\|.*Breaker.*8/.test(sql("select working_hrs || '|' || coalesce(item_work::text, '') from log_book where id = 'EX-200|2026-10-02|Full Day'")), sql("select working_hrs || '|' || coalesce(item_work::text, '') from log_book where id = 'EX-200|2026-10-02|Full Day'") + ' ' + r.slice(-80));
  sql("delete from log_book where id = 'EX-200|2026-10-02|Full Day'");
  await run('lf_exp_mach', 'EX-200', '2026-09-30', '2026-10-02');
  r = await importBack({ '02-10-2026': { 'Close Hrs': 1024, 'Work type': 'Split', 'Breaker (hr)': 3 } });
  ok('Work type "Split" with Breaker 3: Breaker 3 hr, Bucket takes the other 5', /Log Book: 1 added/.test(r) && /^8\|.*Breaker.*3/.test(sql("select working_hrs || '|' || coalesce(item_work::text, '') from log_book where id = 'EX-200|2026-10-02|Full Day'")), sql("select working_hrs || '|' || coalesce(item_work::text, '') from log_book where id = 'EX-200|2026-10-02|Full Day'"));
  sql("delete from log_book where id = 'EX-200|2026-10-02|Full Day'");
  await run('lf_exp_mach', 'EX-200', '2026-09-30', '2026-10-02');
  r = await importBack({ '02-10-2026': { 'Close Hrs': 1024, 'Work type': 'Bucket' } });
  ok('Work type "Bucket": the whole day is bucket work (nothing for Breaker)', /Log Book: 1 added/.test(r) && !/Breaker[^0-9]*[1-9]/.test(sql("select coalesce(item_work::text, '') from log_book where id = 'EX-200|2026-10-02|Full Day'")), sql("select working_hrs || '|' || coalesce(item_work::text, '') from log_book where id = 'EX-200|2026-10-02|Full Day'"));
  // 3. the other ways of picking
  x = await run('lf_exp_mach', '', '2026-09-25', '2026-09-30', 'MH-15-AB-0003');
  ok('machinery typed in the entry form (filter empty): the Excel is for that machinery', JSON.stringify(x.tabs) === '["Summary","MH-15-AB-0003"]', x.err || JSON.stringify(x.tabs));
  x = await run('lf_exp_mach', 'NO-SUCH-1', '2026-09-25', '2026-09-30', '');
  ok('a number that is not in the Master: said, no file', /not in Master/.test(x.err || ''), x.err || JSON.stringify(x.tabs));
  ok('no script error', errs.length === 0, errs.join(' | '));
  sql("delete from log_book where id in ('MH-15-AB-0001|2026-10-02|Full Day', 'EX-200|2026-10-02|Full Day')");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/xls.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/xls.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
