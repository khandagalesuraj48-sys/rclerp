// update-149 (the Log Book Debit Statement) in the browser, on the local rig (Mechanical :3001, database rcl). Test data only ("LD149"
// machinery, parties, entries), all taken out at the end.
//   1. Reports → "Log Book Debit Statement": the period; Generate → the summary (one line per party) and the entries party by party;
//   2. a rate typed: the amounts follow at once, "Save changed rates (1)" → asked → saved;
//   3. "Rate for all shown" + "Put on all shown" → every box; saved;
//   4. "Import party + rate (Excel)": a file of Date / Shift / Machinery / Debit to / Rate → asked → saved; a wrong line → said,
//      nothing saved;
//   5. the print holds the figures (no boxes); a phone-size screen does not get wider.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node ldebit149.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const XLSX = require('xlsx'), { execSync } = require('child_process'), path = require('path'), fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!';
const post = async body => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
(async () => {
  const cleanup = () => sql("delete from log_book where machinery like 'LD149-%'; delete from master where id like 'LD149-%'; delete from vendors where vendor_name like 'LD149 %'; delete from web.cache where key like 'SB%';");
  const errs = [], files = path.join(process.cwd(), 'shots'); fs.mkdirSync(files, { recursive: true });
  let b = null;
  try {
    cleanup();
    const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const A = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await A('getInit')).today, day = k => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
    const D1 = day(-2), D2 = day(-1), dmy = k => k.split('-').reverse().join('-');
    for (const [nm, pan] of [['LD149 Party A', 'ABCPL1149A'], ['LD149 Party B', 'ABCPL2149B']]) await A('saveVendor', { name: nm, gstReg: 'No', pan: pan, bank: 'SBI', account: '1490149' + pan.slice(-2, -1), ifsc: 'SBIN0000149' }, 'add');
    await A('saveMaster', { no: 'LD149-1', name: 'Tipper 149', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    await A('saveMaster', { no: 'LD149-2', name: 'Excavator 149', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 12, tankCap: 300, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const s1 = await A('saveLogRows', { rows: [
      { date: D1, shift: 'Full Day', no: 'LD149-1', mode: 'KM', openingKm: 1000, closingKm: 1040, debitTo: 'LD149 Party A', debitRate: 55, work: 'Carting for A' },
      { date: D2, shift: 'Full Day', no: 'LD149-1', mode: 'KM', openingKm: 1040, closingKm: 1100, debitTo: 'LD149 Party A', debitRate: 50, work: 'Carting for A' },
      { date: D1, shift: 'Day', no: 'LD149-2', mode: 'Hrs', openingHr: 500, closingHr: 508, debitTo: 'LD149 Party B', debitRate: 900, work: 'Excavation for B' }] });
    ok('seed: 2 parties, 2 machinery, 3 Log Book entries charged to them', !s1.ERROR && s1.ok !== false && sql("select count(*) from log_book where machinery like 'LD149-%'") === '3', s1);

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const c = document.getElementById('ai_close'); if (c && c.offsetParent !== null) c.click(); });
    // ---- 1. the statement ----
    const nav = await F.evaluate(() => { const t = document.getElementById('tab-rp-ldebit'); return t ? t.textContent.trim() : ''; });
    ok('1. Reports: "Log Book Debit Statement" in the menu', nav === 'Log Book Debit Statement', nav);
    await F.evaluate((a, z) => { showTab('rp-ldebit'); $('rpldebit_from').value = a; $('rpldebit_to').value = z; $('rpldebit_party').value = ''; $('rpldebit_mno').value = ''; $('rpldebit_go').click(); }, D1, D2);
    await F.waitForFunction(() => !!document.querySelector('#rpldebit_body .ldebit-t'), { timeout: 30000 });
    const st = await F.evaluate(() => ({ title: $('rpldebit_title').textContent, kpis: $('rpldebit_kpis').textContent, sum: [...document.querySelectorAll('#rpldebit_body table[data-sheet="Summary"] tbody tr')].map(t => t.textContent),
      rows: [...document.querySelectorAll('#rpldebit_body .ldebit-t tbody tr')].map(t => t.textContent), boxes: document.querySelectorAll('#rpldebit_body input.ldrate').length }));
    ok('   Generate: the summary – A: 2 entries, 100 KM, 5,200.00; B: 1 entry, 8 Hrs, 7,200.00; a rate box on each entry', st.title === 'Log Book Debit Statement' && st.sum.some(t => /LD149 Party A.*2.*100 KM.*5,200\.00/.test(t)) && st.sum.some(t => /LD149 Party B.*1.*8 Hrs.*7,200\.00/.test(t)) && st.boxes >= 3, st);
    await p.screenshot({ path: path.join(files, '149-statement.png'), fullPage: false });
    // ---- 2. one rate ----
    const k1 = 'LD149-1|' + D1 + '|Full Day';
    await F.evaluate(k => { const i = document.querySelector('#rpldebit_body input.ldrate[data-key="' + k + '"]'); i.value = '60'; i.dispatchEvent(new Event('input', { bubbles: true })); }, k1);
    const r2 = await F.evaluate(k => { const i = document.querySelector('#rpldebit_body input.ldrate[data-key="' + k + '"]'); return { amt: i.closest('tr').querySelector('.amt').textContent, btn: $('rpldebit_save').textContent, dis: $('rpldebit_save').disabled }; }, k1);
    ok('2. a rate typed (55 → 60): its amount at once 2,400.00; "Save changed rates (1)"', r2.amt === '2,400.00' && r2.btn === 'Save changed rates (1)' && !r2.dis, r2);
    await F.evaluate(() => $('rpldebit_save').click()); await wait(700);
    const q2 = await F.evaluate(() => document.getElementById('cf_msg').textContent);
    await F.evaluate(() => $('cf_ok').click()); await wait(4000);
    ok('   asked (the entry, ₹55.00 → ₹60.00), saved in the Log Book; the statement drawn again', /LD149-1 .*₹55\.00 → ₹60\.00/.test(q2) && sql("select debit_rate from log_book where id = '" + k1 + "'") === '60' && await F.evaluate(k => document.querySelector('#rpldebit_body input.ldrate[data-key="' + k + '"]').dataset.orig === '60', k1), q2.slice(0, 300));
    // ---- 3. one rate for all shown ----
    await F.evaluate(() => { $('rpldebit_party').value = 'LD149 Party A'; $('rpldebit_go').click(); }); await wait(3000);
    await F.evaluate(() => { $('rpldebit_all').value = '58'; $('rpldebit_apply').click(); });
    const r3 = await F.evaluate(() => ({ vals: [...document.querySelectorAll('#rpldebit_body input.ldrate')].map(i => i.value), btn: $('rpldebit_save').textContent }));
    ok('3. Party A only; "Rate for all shown" 58 → "Put on all shown": both boxes 58, "Save changed rates (2)"', r3.vals.length === 2 && r3.vals.every(v => v === '58') && r3.btn === 'Save changed rates (2)', r3);
    await F.evaluate(() => $('rpldebit_save').click()); await wait(700); await F.evaluate(() => $('cf_ok').click()); await wait(4000);
    ok('   saved: both entries of A at 58', sql("select string_agg(debit_rate::text, ',' order by id) from log_book where machinery = 'LD149-1'") === '58,58');
    // ---- 4. import ----
    const xf = path.join(files, 'ld149-import.xlsx');
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Date', 'Shift', 'Machinery', 'Debit to', 'Rate'], [dmy(D2), 'Full Day', 'LD149-1', 'LD149 Party B', 45], [dmy(D1), 'Day', 'LD149-2', 'LD149 Party A', 950]]), 'Debit to'); XLSX.writeFile(wb, xf);
    await F.evaluate(() => { $('rpldebit_party').value = ''; $('rpldebit_go').click(); }); await wait(3000);
    await (await F.$('#rpldebit_file')).uploadFile(xf); await wait(1500);
    const q4 = await F.evaluate(() => document.getElementById('cf_msg').textContent);
    await F.evaluate(() => $('cf_ok').click()); await wait(4000);
    ok('4. import: asked (2 lines with their party and rate), saved – D2 of LD149-1 to B @ 45, LD149-2 to A @ 950',
      /Import 2 lines/.test(await F.evaluate(() => (document.getElementById('cf_title') || {}).textContent || '')) || /Row 2: LD149-1/.test(q4), q4.slice(0, 300));
    ok('   …in the Log Book', sql("select debit_to || '@' || debit_rate from log_book where id = 'LD149-1|" + D2 + "|Full Day'") === 'LD149 Party B@45' && sql("select debit_to || '@' || debit_rate from log_book where id = 'LD149-2|" + D1 + "|Day'") === 'LD149 Party A@950');
    const before = sql("select string_agg(id || '=' || debit_to || '@' || debit_rate, ';' order by id) from log_book where machinery like 'LD149-%'");
    const wb2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([['Date', 'Shift', 'Machinery', 'Debit to', 'Rate'], [dmy(D2), 'Full Day', 'LD149-1', 'LD149 Party A', 47], [dmy(D1), 'Full Day', 'LD149-1', 'Nobody 149', 47], [dmy(D1), 'Day', 'LD149-2', '', 960]]), 'Debit to');
    const xf2 = path.join(files, 'ld149-import2.xlsx'); XLSX.writeFile(wb2, xf2);
    await F.evaluate(() => { $('rpldebit_file').value = ''; }); await (await F.$('#rpldebit_file')).uploadFile(xf2); await wait(1500);
    const q5 = await F.evaluate(() => document.getElementById('cf_msg').textContent);
    ok('   a blank "Debit to" cell: asked as "(its party)" – the entry keeps its party', /Row 4: LD149-2 · [0-9-]+ · Day → \(its party\) @ ₹960/.test(q5), q5.slice(0, 400));
    await F.evaluate(() => $('cf_ok').click()); await wait(3500);
    const t4 = await F.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    ok('   a wrong line (a party not in the Vendor Master): said with its row – nothing saved (the right line neither)', /Row 3: .*"Nobody 149" is not in the Vendor Master/.test(t4) && sql("select string_agg(id || '=' || debit_to || '@' || debit_rate, ';' order by id) from log_book where machinery like 'LD149-%'") === before, t4);
    // ---- 5. print, phone ----
    const ph = await F.evaluate(async () => { let got = ''; const keep = printDoc; try { printDoc = (t, body) => { got = body; }; } catch (e) {} const keepAsk = askPrintName; try { askPrintName = async () => 'Rachana Construction Limited'; } catch (e) {}
      try { await rpPrint(S.rpDefs.find(x => x.key === 'ldebit')); } catch (e) { got = 'ERR ' + e.message; } try { printDoc = keep; askPrintName = keepAsk; } catch (e) {} return got; });
    ok('5. the print: the figures (no rate boxes, no buttons), the sign lines with "Party acceptance"', /Log Book Debit Statement/.test(ph) && !/<input/.test(ph) && !/Put on all shown/.test(ph) && /Party acceptance/.test(ph) && /45\.00/.test(ph), ph.slice(0, 300));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); await wait(800);
    const wide = await F.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok('   a phone-size screen: the page does not get wider (the tables scroll in their own box)', wide <= 0, wide);
    await p.screenshot({ path: path.join(files, '149-phone.png') });
    ok('no script error on the page', errs.length === 0, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
