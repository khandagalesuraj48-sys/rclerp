// The Log Book print: every machinery on ONE page, signatures at the foot. The real print window is opened by the app, the page is
// turned into a PDF by the browser's own print engine (the CSS page size and margins of the print window) and the PAGES ARE COUNTED.
//   node lbpage.js 3000        (this code)        node lbpage.js 3002        (the code that is live, for "before")
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const PORT = Number(process.argv[2] || 3000), TAG = PORT === 3000 ? 'new' : 'old', KEEP = process.argv.indexOf('keep') > -1;
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const NOS = ['LBP-1', 'LBP-2', 'LBP-3', 'LBP-4'];
const clean = () => sql("delete from log_book where machinery like 'LBP-%'; delete from diesel_issue where machinery like 'LBP-%'; delete from boq where vendor_name = 'Print Vendor'; delete from master where id like 'LBP-%'; delete from vendors where vendor_name = 'Print Vendor';");
const PLACES = ['VTR TO RCL CAMP TO CASTING YARD TO SONALE TO RCL CAMP 567+070 RHS', 'RCL CAMP TO CASTING YARD TO YENKAI NAKA TO SONALE TO RCL CAMP 548+100 RHS MCW', '543+710 TO 562+680 RHS', 'RCL CAMP TO VTR CAMP 546+100 RHS', 'VTR TO RMC PLANT TO RCL CAMP', 'VTR TO 560+150 RHS MCW TO 558+100', 'RMC PLANT TO 561+280 LHS MCW–VTR TO RCL TO VTR TO RCL', 'NANALKAR TO VADAPE TO SARAVLI TO VADAPE TO RCL CAMP', 'RCL TO YENKAI NAKA TO SONALE TO VTR TO KASHINGAON TO SAKET BRIDGE TO CASTING YARD TO RCL CAMP'];
const WORKS = ['BARRICADES LOADING FOR INSTALLATION WORK', 'STOP DUE TO NO WORK', 'BARRICADES SHIFTING', 'SHUTTERING MATERIAL STEEL SHIFTING', 'KOBELCO MACHINE SHIFTING', 'ROLLER SHIFTING /STEEL SHIFTING /POCLAIN SHIFTING', 'SANY210 MACHINE SHIFTING & ROLLER SHIFTING', 'BARRICADES LOADING & UNLOADING', 'MATERIAL SHIFTING'];
(async () => {
  const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const must = (n, r) => { if (!r || r.ERROR || r.ok === false) out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
  if (!Number(sql("select count(*) from log_book where machinery = 'LBP-2'"))) {
    try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
    const mach = (no, type, unit) => Object.assign({ no: no, name: type, type: type, unit: unit, worksOn: [unit], owner: 'Print Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, unit === 'KM' ? { kmStd: 2 } : { hrStd: 12 });
    must('m1', await api('saveMaster', mach('LBP-1', 'Trailer', 'KM'), 'add')); must('m2', await api('saveMaster', mach('LBP-2', 'Trailer', 'KM'), 'add')); must('m3', await api('saveMaster', mach('LBP-3', 'Excavator', 'Hrs'), 'add')); must('m4', await api('saveMaster', mach('LBP-4', 'Tipper', 'KM'), 'add'));
    must('vendor', await api('saveVendor', { name: 'Print Vendor', gstReg: 'No', pan: 'ABCDE1234P', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add'));
    must('boq', await api('saveBoq', { vendor: 'Print Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-LBP', lines: NOS.map(no => ({ no: no, basis: 'Monthly', rate: 50000, diesel: 'Company' })) }, 'add'));
    const dd = d => '2026-09-' + String(d).padStart(2, '0');
    let rows = [], k = 55263; for (let d = 1; d <= 30; d++) { const w = (d * 7) % 60; rows.push({ date: dd(d), shift: 'Day', no: 'LBP-1', mode: 'KM', openingKm: d === 1 ? k : undefined, closingKm: (k += w), chFrom: PLACES[d % PLACES.length], work: WORKS[d % WORKS.length] }); }
    must('log 1', await api('saveLogRows', { rows: rows }));
    rows = []; k = 172000; for (let d = 1; d <= 30; d++) for (const sh of ['Day', 'Night']) { const w = (d * 11 + (sh === 'Night' ? 5 : 0)) % 90; rows.push({ date: dd(d), shift: sh, no: 'LBP-2', mode: 'KM', openingKm: d === 1 && sh === 'Day' ? k : undefined, closingKm: (k += w), chFrom: PLACES[(d + (sh === 'Night' ? 3 : 0)) % PLACES.length], work: WORKS[(d + (sh === 'Night' ? 4 : 0)) % WORKS.length] }); }
    must('log 2a', await api('saveLogRows', { rows: rows.slice(0, 30) })); must('log 2b', await api('saveLogRows', { rows: rows.slice(30) }));
    rows = []; k = 4100; for (let d = 1; d <= 30; d++) rows.push({ date: dd(d), shift: 'Full Day', no: 'LBP-3', mode: 'Hrs', openingHr: d === 1 ? k : undefined, closingHr: (k += 6 + (d % 4)), chFrom: '561+280', chTo: '562+100', work: 'Excavation' });
    must('log 3', await api('saveLogRows', { rows: rows }));
    rows = []; k = 900; for (let d = 1; d <= 8; d++) rows.push({ date: dd(d), shift: 'Full Day', no: 'LBP-4', mode: 'KM', openingKm: d === 1 ? k : undefined, closingKm: (k += 40), work: 'Murum carting' });
    must('log 4', await api('saveLogRows', { rows: rows }));
    for (const [no, d, q, rdg] of [['LBP-1', 3, 50, 55300], ['LBP-1', 8, 50, 55425], ['LBP-1', 19, 60, 55660], ['LBP-2', 5, 80, 172300], ['LBP-2', 20, 90, 173500], ['LBP-3', 6, 120, 4140]]) must('diesel', await api('saveDieselIssue', Object.assign({ date: dd(d), shift: 'Day', source: 'Dispenser', no: no, qty: q, force: true }, no === 'LBP-3' ? { hrReading: rdg } : { kmReading: rdg })));
  }
  const counts = sql("select string_agg(machinery || ' ' || n, ', ' order by machinery) from (select machinery, count(*) n from log_book where machinery like 'LBP-%' group by 1) x");

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.removeItem('rcl_orient_rep_rep-lb'); localStorage.setItem('rcl_print_head', 'Sketchline Industries'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  // open the app's own print window for a filter of the Log Book list, and hand back that window
  const printWin = async (filter) => {
    await f.evaluate(flt => { try { closeConfirm(false); } catch (e) {} document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const set = (id, v) => { const n = document.getElementById(id); n.value = v; n.dispatchEvent(new Event('change', { bubbles: true })); }; set('lf_no', flt.no || ''); set('lf_owner', flt.owner || ''); }, filter); await wait(3000);
    const got = new Promise(res => b.once('targetcreated', t => res(t)));
    await f.evaluate(() => [...document.querySelectorAll('#sec-log button')].find(x => /Print Log Book/.test(x.textContent)).click());
    for (let i = 0; i < 10; i++) { await wait(400); if (await yes()) break; }
    const t = await Promise.race([got, wait(15000).then(() => null)]); if (!t) return null;
    const w = await t.page(); await wait(2500); return w;
  };
  const pdfOf = async (w, name) => { const file = '/home/claude/test/shots/lb_' + TAG + '_' + name + '.pdf'; await w.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    const info = execSync('pdfinfo "' + file + '"').toString(); const pages = Number((info.match(/Pages:\s+(\d+)/) || [])[1]); const size = (info.match(/Page size:\s+([^\n]+)/) || [])[1];
    return { pages: pages, paper: /^84\d(\.\d+)? x 59\d/.test(size) ? 'A4 landscape' : /^59\d(\.\d+)? x 84\d/.test(size) ? 'A4 portrait' : size, file: file }; };
  // where the pieces of each sheet are on the screen copy (the same layout the paper gets): size used, signature place, smallest letters
  const look = w => w.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(sh => { const z = Number(sh.dataset.fit || 1), r = sh.getBoundingClientRect(), sg = sh.querySelector('.lb-sign'), sr = sg.getBoundingClientRect(), ln = sg.querySelector('span').getBoundingClientRect(), bl = sh.querySelector('.lb-bill') || sh.querySelector('table'), br = bl.getBoundingClientRect(), mm = 3.7795;
    const td = sh.querySelector('table.lb-t tbody td'), fs = td ? parseFloat(getComputedStyle(td).fontSize) * 0.75 * z : 0;
    return { machinery: (sh.querySelector('.lb-mach') || { textContent: '' }).textContent.trim().slice(0, 12), rows: sh.querySelectorAll('table.lb-t tbody tr').length, size: sh.dataset.fit ? Math.round(z * 100) + '%' : 'not fitted', sheet_mm: Math.round(r.height / mm), room_to_sign_mm: Math.round((ln.top - br.bottom) / mm * 10) / 10, sign_from_sheet_foot_mm: Math.round((r.bottom - sr.bottom) / mm * 10) / 10, letters_pt: Math.round(fs * 10) / 10 }; }));
  const res = {};
  for (const [name, flt] of [['30rows', { no: 'LBP-1' }], ['60rows', { no: 'LBP-2' }], ['hrs30', { no: 'LBP-3' }], ['8rows', { no: 'LBP-4' }], ['all4', { owner: 'Print Vendor' }]]) {
    const w = await printWin(flt); if (!w) { ok(name + ': the print window opened', false); continue; }
    const P = await pdfOf(w, name + '_P'), lookP = await look(w);
    let L = null, lookL = null;
    if (await w.evaluate(() => typeof setOrient === 'function')) { await w.evaluate(() => setOrient('L')); await wait(800); L = await pdfOf(w, name + '_L'); lookL = await look(w); await w.evaluate(() => setOrient('P')); await wait(300); }
    res[name] = { P: P, lookP: lookP, L: L, lookL: lookL };
    if (name === '30rows' || name === '60rows') { execSync('pdftoppm -r 70 -png "' + P.file + '" "/home/claude/test/shots/lb_' + TAG + '_' + name + '_P"'); if (L) execSync('pdftoppm -r 70 -png "' + L.file + '" "/home/claude/test/shots/lb_' + TAG + '_' + name + '_L"'); }
    await w.close(); await wait(400);
  }
  const want = { '30rows': 1, '60rows': 1, 'hrs30': 1, '8rows': 1, 'all4': 4 }, label = { '30rows': 'Trailer, 30 Day entries, long Chainage / Work text (as in his print)', '60rows': 'Trailer, Day + Night on all 30 dates = 60 entries', 'hrs30': 'Excavator on hours, 30 entries, short text', '8rows': 'Tipper, 8 entries only', 'all4': 'all four machinery in one print' };
  Object.keys(want).forEach(n => { const r = res[n]; if (!r) return;
    ok('Portrait – ' + label[n] + ': ' + want[n] + ' page(s)', r.P.pages === want[n] && r.P.paper === 'A4 portrait', { pages: r.P.pages, paper: r.P.paper, sheets: r.lookP });
    if (r.L) ok('Landscape – ' + label[n] + ': ' + want[n] + ' page(s)', r.L.pages === want[n] && r.L.paper === 'A4 landscape', { pages: r.L.pages, paper: r.L.paper, sheets: r.lookL.map(x => ({ machinery: x.machinery, size: x.size, room_to_sign_mm: x.room_to_sign_mm, letters_pt: x.letters_pt })) }); });
  if (TAG === 'new') {
    const all = [].concat(...Object.values(res).map(r => r.lookP.concat(r.lookL || [])));
    ok('the room to sign above the lines is at least 12 mm on paper on every sheet, and the signatures are at the foot of the page', all.every(x => x.room_to_sign_mm >= 11.9 && x.sign_from_sheet_foot_mm < 1), { least_room_mm: Math.min(...all.map(x => x.room_to_sign_mm)), sheets: all.length });
    ok('a sheet that already fits is NOT made smaller (8 entries: 100%)', res['8rows'].lookP[0].size === '100%' && res['8rows'].lookP[0].sheet_mm >= 270, res['8rows'].lookP[0]);
  }
  ok('no script error', errs.length === 0, errs.join(' | '));
  await f.evaluate(() => { try { localStorage.removeItem('rcl_orient_rep_rep-lb'); } catch (e) {} });
  await b.close();
  if (!KEEP) { try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); } }
  console.log('[' + TAG + ' code, port ' + PORT + '] entries: ' + counts + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
