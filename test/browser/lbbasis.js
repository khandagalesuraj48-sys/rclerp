// The summary under a Log Book print follows what the machinery is ON: hours, days, trips, or mixed.
//   node lbbasis.js            – seed, read the prints from the new code (port 3000), check, clean
//   node lbbasis.js compare    – the same, and also read the prints from the code on port 3002 (the version before) to show before / after
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const NOS = ['BS-H', 'BS-HB', 'BS-D', 'BS-M', 'BS-T', 'BS-X', 'BS-K'];
const clean = () => sql("delete from log_book where machinery like 'BS-%'; delete from boq where vendor_name = 'Basis Vendor'; delete from master where id like 'BS-%'; delete from vendors where vendor_name = 'Basis Vendor';");
async function read(port) {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const got = []; b.on('targetcreated', async t => { try { if (t.type() === 'page') { const w = await t.page(); if (w && w !== p) { await wait(2500);
    const v = await w.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(s => ({ mach: (s.querySelector('.lb-mach') || {}).textContent, works: ((s.querySelector('.lb-meta') || {}).innerText || '').replace(/\s+/g, ' '),
      rows: [...s.querySelectorAll('.lb-bill tr:not(.net)')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim())), net: ((s.querySelector('.lb-bill tr.net') || {}).innerText || '').replace(/\s+/g, ' ').trim(), pages: s.dataset.fit || '' }))).catch(() => null);
    if (v) got.push(v); await w.close(); } } } catch (e) {} });
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('rcl_print_head', 'Rachana Construction Limited'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  const res = {};
  for (const no of NOS) {
    await f.evaluate(no => { try { closeConfirm(false); } catch (e) {} document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n = document.getElementById('lf_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }, no); await wait(2200);
    const before = got.length; await f.evaluate(() => document.getElementById('lf_print').click());
    for (let i = 0; i < 24; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); if (got.length > before) break; }
    const sh = (got[got.length - 1] || []).find(x => String(x.mach || '').toUpperCase().indexOf(no + ' (') === 0);      // (the filter 'BS-H' also brings BS-HB) if (got.length === before || !sh) { res[no] = null; continue; }
    res[no] = { left: sh.rows.map(r => [r[0], r[1]]).filter(r => r[0]), right: sh.rows.map(r => [r[2], r[3]]).filter(r => r[0]), net: sh.net, works: sh.works };
  }
  await b.close(); return { res, errs };
}
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const mk = (no, type, works, unit, fmtL) => api('saveMaster', Object.assign({ no: no, name: type, type: type, unit: unit, worksOn: works, owner: 'Basis Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, unit === 'Hrs' ? { hrStd: 4 } : unit === 'KM' ? { kmStd: 4 } : {}, fmtL ? { lbFormat: fmtL } : {}), 'add');
  const seedErr = [];
  const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'Basis Vendor', gstReg: 'No', pan: 'ABCPE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add'));
  E(await mk('BS-H', 'JCB', ['Hrs', 'Time'], 'Hrs', 'F'));       // his case: on hours, no BOQ yet, the format with times
  E(await api('saveLbFormats', { 'BS-H': 'F' }));
  E(await mk('BS-HB', 'Poclain', ['Hrs'], 'Hrs'));               // on hours with a Per Hour BOQ
  E(await mk('BS-D', 'Roller', ['Day'], 'Day'));                 // on days, Monthly BOQ
  E(await mk('BS-M', 'Grader', ['Hrs'], 'Hrs'));                 // meter in hours, PAID by the month
  E(await mk('BS-T', 'Tipper', ['Trip'], 'Day'));                // on trips, Per Trip BOQ
  E(await mk('BS-X', 'Loader', ['Day', 'Hrs'], 'Hrs'));          // mixed, no BOQ
  E(await mk('BS-K', 'Car', ['KM'], 'KM'));                      // KM meter, no BOQ
  E(await api('saveBoq', { vendor: 'Basis Vendor', from: '2026-09-01', tdsPct: 0, woNo: 'WO-BS', lines: [{ no: 'BS-HB', basis: 'Per Hour', rate: 1000, diesel: 'Company' }, { no: 'BS-D', basis: 'Monthly', rate: 60000, diesel: 'Company' }, { no: 'BS-M', basis: 'Monthly', rate: 90000, diesel: 'Company' }, { no: 'BS-T', basis: 'Per Trip', rate: 500, diesel: 'Company' }] }, 'add'));
  const rows = [
    { date: '2026-09-01', shift: 'Day', no: 'BS-H', mode: 'Time', tStart: '11:00', tEnd: '17:00', tSlots: [['11:00', '13:00'], ['14:00', '17:00']] },
    { date: '2026-09-01', shift: 'Night', no: 'BS-H', mode: 'Time', tStart: '20:00', tEnd: '23:00', tSlots: [['20:00', '23:00']] },
    { date: '2026-09-01', shift: 'Full Day', no: 'BS-HB', mode: 'Hrs', openingHr: 100, closingHr: 106, openingDiesel: 0 }, { date: '2026-09-02', shift: 'Full Day', no: 'BS-HB', mode: 'Hrs', openingHr: 106, closingHr: 110 },
    { date: '2026-09-01', shift: 'Full Day', no: 'BS-D', mode: 'Day' }, { date: '2026-09-02', shift: 'Full Day', no: 'BS-D', mode: 'Day' }, { date: '2026-09-03', shift: 'Full Day', no: 'BS-D', mode: 'Day' },
    { date: '2026-09-01', shift: 'Full Day', no: 'BS-M', mode: 'Hrs', openingHr: 50, closingHr: 55, openingDiesel: 0 },
    { date: '2026-09-01', shift: 'Full Day', no: 'BS-T', mode: 'Trip', trip: 4 }, { date: '2026-09-02', shift: 'Full Day', no: 'BS-T', mode: 'Trip', trip: 6 },
    { date: '2026-09-01', shift: 'Full Day', no: 'BS-X', mode: 'Day' }, { date: '2026-09-02', shift: 'Full Day', no: 'BS-X', mode: 'Hrs', openingHr: 10, closingHr: 15, openingDiesel: 0 },
    { date: '2026-09-01', shift: 'Full Day', no: 'BS-K', mode: 'KM', openingKm: 1000, closingKm: 1080, openingDiesel: 0 }];
  for (const no of NOS) E(await api('saveLogRows', { rows: rows.filter(r => r.no === no) }));
  const inDb = sql("select string_agg(machinery || ':' || n, ' ' order by machinery) from (select machinery, count(*) n from log_book where machinery like 'BS-%' group by 1) q");
  ok('the test machinery and entries are saved (7 machinery, 13 entries)', !seedErr.length && inDb === 'BS-D:3 BS-H:2 BS-HB:2 BS-K:1 BS-M:1 BS-T:2 BS-X:2', seedErr.join(' // ') || inDb);

  const N = await read(3000); const R = N.res;
  const labels = x => x ? x.left.map(r => r[0].replace(/ (DAY \d|HOLIDAY|IDLE|BREAKDOWN|NOT PAID|\d+ HALF).*$/, '')) : ['(no print)'], rlab = x => x ? x.right.map(r => r[0].replace(/ ?(rate = .*|\d.*|– not applicable)$/, '').trim()) : [];
  const val = (x, re, side) => { const r = x && (side === 'r' ? x.right : x.left).find(q => re.test(q[0])); return r ? r[1] : null; };
  const hasDays = x => !!x && x.left.some(r => /WORKING DAYS|WORKING NIGHT/.test(r[0]));
  // 1. his case
  ok('ON HOURS, no BOQ yet (his print: works on Hrs, Time; the format with times): the left side of the summary is one line, TOTAL HOURS (day and night hours named) – no "working days", no "daily rate"',
    !!R['BS-H'] && !hasDays(R['BS-H']) && val(R['BS-H'], /^TOTAL HOURS/) === '8 HRS' && /DAY 5 HRS · NIGHT 3 HRS/.test((R['BS-H'].left.find(q => /^TOTAL HOURS/.test(q[0])) || [''])[0]) && !R['BS-H'].right.some(r => /DAILY RATE/.test(r[0])) && R['BS-H'].left.length === 1,
    R['BS-H'] ? { left: R['BS-H'].left, right: rlab(R['BS-H']) } : 'no print');
  ok('ON HOURS with a Per Hour BOQ: TOTAL HOURS 10 HRS, rate ₹ 1,000.00 / HR, payable ₹ 10,000.00 – no days, no daily rate',
    !!R['BS-HB'] && !hasDays(R['BS-HB']) && val(R['BS-HB'], /^TOTAL HOURS/) === '10 HRS' && /1,000\.00 \/ HR/.test(val(R['BS-HB'], /^RATE/, 'r') || '') && /10,000\.00/.test(val(R['BS-HB'], /^PAYABLE AMOUNT/, 'r') || '') && !R['BS-HB'].right.some(r => /DAILY RATE/.test(r[0])),
    R['BS-HB'] ? { left: labels(R['BS-HB']), hours: val(R['BS-HB'], /^TOTAL HOURS/), right: R['BS-HB'].right.slice(0, 2) } : 'no print');
  ok('ON DAYS (Monthly BOQ): exactly as before – working days 3, night 0, net 3, monthly rate, daily rate ₹ 2,000.00 (÷ 30), payable ₹ 6,000.00; no hours line',
    !!R['BS-D'] && val(R['BS-D'], /^TOTAL WORKING DAYS/) === '3' && val(R['BS-D'], /^TOTAL WORKING NIGHT/) === '0' && val(R['BS-D'], /^NET WORKING DAYS/) === '3' && /2,000\.00 \(÷ 30\)/.test(val(R['BS-D'], /^DAILY RATE/, 'r') || '') && /6,000\.00/.test(val(R['BS-D'], /^PAYABLE AMOUNT/, 'r') || '') && !R['BS-D'].left.some(r => /TOTAL HOURS/.test(r[0])),
    R['BS-D'] ? { left: labels(R['BS-D']), right: R['BS-D'].right.slice(0, 3) } : 'no print');
  ok('meter in HOURS but PAID BY THE MONTH (Monthly BOQ): it is on days – days and daily rate stay, as before',
    !!R['BS-M'] && val(R['BS-M'], /^NET WORKING DAYS/) === '1' && /3,000\.00 \(÷ 30\)/.test(val(R['BS-M'], /^DAILY RATE/, 'r') || '') && /3,000\.00/.test(val(R['BS-M'], /^PAYABLE AMOUNT/, 'r') || ''),
    R['BS-M'] ? { left: labels(R['BS-M']), right: R['BS-M'].right.slice(0, 3) } : 'no print');
  ok('ON TRIPS (Per Trip BOQ): TOTAL TRIPS 10, rate ₹ 500.00 / TRIP, payable ₹ 5,000.00 – no days, no daily rate',
    !!R['BS-T'] && !hasDays(R['BS-T']) && val(R['BS-T'], /^TOTAL TRIPS/) === '10' && /500\.00 \/ TRIP/.test(val(R['BS-T'], /^RATE/, 'r') || '') && /5,000\.00/.test(val(R['BS-T'], /^PAYABLE AMOUNT/, 'r') || '') && !R['BS-T'].right.some(r => /DAILY RATE/.test(r[0])),
    R['BS-T'] ? { left: labels(R['BS-T']), trips: val(R['BS-T'], /^TOTAL TRIPS/), right: R['BS-T'].right.slice(0, 2) } : 'no print');
  ok('MIXED (works on Day and Hrs, no BOQ): both – working days 2 … and TOTAL HOURS 5 HRS',
    !!R['BS-X'] && val(R['BS-X'], /^NET WORKING DAYS/) === '2' && val(R['BS-X'], /^TOTAL HOURS/) === '5 HRS', R['BS-X'] ? R['BS-X'].left.slice(0, 4) : 'no print');
  ok('KM meter, no BOQ: as before (working days)', !!R['BS-K'] && val(R['BS-K'], /^NET WORKING DAYS/) === '1' && !R['BS-K'].left.some(r => /TOTAL HOURS|TOTAL KM/.test(r[0])), R['BS-K'] ? labels(R['BS-K']) : 'no print');
  ok('no script error', N.errs.length === 0, N.errs.join(' | '));
  if (process.argv[2] === 'compare') {
    const O = (await read(3002)).res;
    out.push('', 'BEFORE (the version that is live) → AFTER, the left lines of the summary:');
    NOS.forEach(no => out.push('  ' + no + ': ' + labels(O[no]).join(' | ') + '   →   ' + labels(R[no]).join(' | ')));
    const money = x => x ? x.right.filter(r => /PAYABLE|DIESEL|TDS|GST|^RATE|MONTHLY RATE/.test(r[0])).map(r => r[1]).join(' ; ') + ' ; ' + x.net : '';
    ok('the money on every sheet is the same before and after (rate, payable, diesel debit, TDS, GST, net payable)', NOS.every(no => money(O[no]) === money(R[no])), NOS.filter(no => money(O[no]) !== money(R[no])).map(no => no + ': ' + money(O[no]) + ' → ' + money(R[no])).join(' // ') || 'identical on all 7');
    ok('the machinery on days and the KM machinery: every line of the summary is identical before and after', ['BS-D', 'BS-M', 'BS-K'].every(no => JSON.stringify(O[no]) === JSON.stringify(R[no])), ['BS-D', 'BS-M', 'BS-K'].filter(no => JSON.stringify(O[no]) !== JSON.stringify(R[no])).join(', ') || 'identical');
  }
  if (process.argv[3] !== 'keep') { try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); } }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
