// the Log Book Excel of a picked machinery: only that machinery, its dates, its columns; and it comes back through the import
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(3000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__x = null; saveXlsxLists = async function (name, sheets) { window.__x = { name: name, sheets: sheets.map(s => ({ name: s.name, head: s.head, aoa: s.aoa })) }; return true; }; });
  const run = async (btn, no, from, to, top) => { await f.evaluate((no2, a, c, top2) => { document.getElementById('lf_from').value = a; document.getElementById('lf_to').value = c; document.getElementById('lf_no').value = no2; if (top2 !== undefined) { setLgMode('mach'); document.getElementById('lg_top_no').value = top2; } window.__x = null; }, no, from, to, top);
    await f.evaluate(id => document.getElementById(id).click(), btn); for (let i = 0; i < 40; i++) { await wait(400); if (await f.evaluate(() => !!window.__x)) break; }
    return f.evaluate(() => { const x = window.__x; if (!x) { const bx = document.getElementById('fixbox'); return { err: bx && !bx.hidden ? bx.querySelector('.fx-msg').textContent : 'nothing came' }; }
      return { file: x.name, tabs: x.sheets.map(s => s.name), sheets: x.sheets.map(s => ({ name: s.name, title: (s.aoa[2] || [])[0], head: s.aoa[s.head - 1], rows: s.aoa.slice(s.head).filter(r => r && r.length && !/^Total/.test(String(r[0]))).length, nos: [...new Set(s.aoa.slice(s.head).filter(r => r && r.length && !/^Total/.test(String(r[0]))).map(r => r[2]))] })) }; }); };
  // 1. a KM machinery, 6 days
  let x = await run('lf_exp_mach', 'MH-15-AB-0001', '2026-09-25', '2026-09-30'); let s = (x.sheets || []).find(y => y.name === 'MH-15-AB-0001') || {};
  ok('KM machinery: only its own tab (and the summary), named after it', JSON.stringify(x.tabs) === '["Summary","MH-15-AB-0001"]' && /MH-15-AB-0001/.test(x.file), x.err || x.file + ' ' + JSON.stringify(x.tabs));
  ok('…exactly the 6 dates of the period, one row each, all of this machinery', s.rows === 6 && JSON.stringify(s.nos) === '["MH-15-AB-0001"]' && /25-09-2026 to 30-09-2026/.test(s.title || ''), s.title + ' / ' + s.rows + ' rows');
  const h1 = (s.head || []).join(' | ');
  ok('…only its columns: KM readings, no hour / time / trip / challan / item columns', /Start KM \| Close KM \| Total KM/.test(h1) && !/Hrs|From time|Trips|Challan|Item work/.test(h1) && /Date \| Shift \| Machinery/.test(h1), h1);
  // 2. an hour machinery with an item-wise BOQ
  x = await run('lf_exp_mach', 'EX-200', '2026-09-28', '2026-10-02'); s = (x.sheets || []).find(y => y.name === 'EX-200') || {}; const h2 = (s.head || []).join(' | ');
  ok('hour machinery with Bucket / Breaker: hour readings and "Item work", no KM columns', /Start Hrs \| Close Hrs \| Total Hrs/.test(h2) && /Item work/.test(h2) && !/Start KM|Trips|From time/.test(h2) && s.rows === 5, x.err || h2 + ' / ' + s.rows + ' rows');
  // 3. date-wise for one machinery, and the machinery typed only in the entry form
  x = await run('lf_exp_date', 'MH-15-AB-0001', '2026-09-25', '2026-09-30'); s = (x.sheets || [])[0] || {};
  ok('"one date – many machinery" with a machinery picked: that machinery only, its columns', s.rows === 6 && JSON.stringify(s.nos) === '["MH-15-AB-0001"]' && !/Hrs/.test((s.head || []).join('|')), x.err || s.rows + ' rows ' + JSON.stringify(s.nos));
  x = await run('lf_exp_mach', '', '2026-09-25', '2026-09-30', 'MH-15-AB-0003'); 
  ok('machinery typed in the entry form (filter empty): the Excel is for that machinery', JSON.stringify(x.tabs) === '["Summary","MH-15-AB-0003"]', x.err || JSON.stringify(x.tabs));
  x = await run('lg_tpl_mach', '', '2026-09-25', '2026-09-30', 'MH-15-AB-0003');
  ok('"Template: one machinery – many dates" with a machinery picked gives that machinery\'s own sheet (not a general example)', JSON.stringify(x.tabs) === '["Summary","MH-15-AB-0003"]', x.err || JSON.stringify(x.tabs));
  x = await run('lf_exp_mach', 'NO-SUCH-1', '2026-09-25', '2026-09-30', '');
  ok('a number that is not in the Master: said, no file', /not in Master/.test(x.err || ''), x.err || JSON.stringify(x.tabs));
  await f.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; });
  // 4. the file comes back: write it as real Excel, read it with the import's reader, fill one empty date, let the server check it
  await run('lf_exp_mach', 'MH-15-AB-0001', '2026-09-25', '2026-10-02', '');
  await f.addScriptTag({ path: require('path').join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js') });      // the same Excel tool, from the local copy (the CDN is closed in the test rig)
  const back = await f.evaluate(async () => { if (!window.XLSX) return { err: 'Excel tool did not load in the test rig' };
    const x = window.__x, wb = XLSX.utils.book_new(); let filled = '';
    x.sheets.forEach(sh => { const aoa = sh.aoa.map(r => (r || []).slice()); if (sh.name !== 'Summary') { const head = aoa[sh.head - 1], iC = head.indexOf('Close KM'), iM = head.indexOf('Measured by'), iS = head.indexOf('Start KM');
        const lastClose = Math.max(0, ...aoa.slice(sh.head).map(r => Number(r[iC]) || 0)); const row = aoa.slice(sh.head).find(r => r.length && r[iC] === '' && !/^Total/.test(String(r[0])) && String(r[0]) >= '');
        const blanks = aoa.slice(sh.head).filter(r => r.length > 3 && (r[iC] === '' || r[iC] === undefined) && !/^Total/.test(String(r[0]))); const last = blanks[blanks.length - 1];
        if (last) { last[iM] = 'KM'; last[iC] = lastClose + 40; filled = String(last[0]); } }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sh.name); });
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const raw = await readExcelRows(new File([buf], 'back.xlsx'), LB_COLS, ['date', 'no'], true);
    // … and through the real "Import from Excel" of the page
    const dt = new DataTransfer(); dt.items.add(new File([buf], 'back.xlsx')); const inp = document.getElementById('lg_file'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    return { read: raw.length, nos: [...new Set(raw.map(r => String(r.no)))], filled: filled, sample: raw.filter(r => String(r.ckm) !== '').length }; });
  let asked = '', done = '';
  for (let i = 0; i < 50; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const tx = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 200); document.getElementById('cf_ok').click(); return tx; } const x = document.getElementById('toast'); return x && !x.hidden && /Log Book:/.test(x.textContent) ? 'TOAST ' + x.textContent : ''; });
    if (/^TOAST/.test(t)) { done = t; break; } if (t) asked += t + ' || '; }
  const { execSync } = require('child_process'); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
  const saved = sql("select count(*) from log_book where id = 'MH-15-AB-0001|2026-10-02|Full Day'");
  ok('…and "Import from Excel" takes it as it is: the date that was filled in Excel is added, the saved ones are skipped', /Import into the Log Book/.test(asked) && /1 new entry will be added/.test(asked) && /Log Book: 1 added/.test(done) && saved === '1', (asked + done).slice(0, 330));
  sql("delete from log_book where id = 'MH-15-AB-0001|2026-10-02|Full Day'");
  ok('the Excel is read back by the import: every row of the machinery, under its headings', back.read === 8 && JSON.stringify(back.nos) === '["MH-15-AB-0001"]', back);
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/xls.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/xls.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
