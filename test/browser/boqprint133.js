// update-133 (asked 19-10-2026 with his picture of an "Amendment letter Of Intent": "je boq bantat je amendment bante tya warti work
// order number date he sagle yeu de … proper amendment watayla haw") – in the browser, on the local rig only (PORTAL=1 bash rig/all.sh;
// Mechanical :3001 own sign-in). Test data only: vendor "VP133 Vendor", machinery VP133-1 / VP133-2, their BOQs – all taken out at the end.
//   1. BOQ 1 (01-08-2026 – 31-08-2026, work order SLI/VTR-Office/WO/2024-2025/73 of 01-05-2024): VP133-1 Per Trip ₹1,000, VP133-2 ₹500;
//      Amendment 1 (no work order of its own): only VP133-1 at ₹1,200 from 01-09-2026;
//   2. Print of BOQ 1: the work order number and date on top;
//   3. Print of the amendment: an amendment letter – To the vendor (address, contact), Subject, Reference (the work order of BOQ 1),
//      "with effect from 01-09-2026", Annexure-I with the earlier rate (₹1,000 till 31-08-2026) and the new rate (₹1,200), "For and on
//      behalf of", "ACCEPTED BY VENDOR"; picture in test/shots/boqprint133.png.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node boqprint133.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1500) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
(async () => {
  const cleanup = () => sql("delete from boq where vendor_name = 'VP133 Vendor'; delete from master where machinery_number in ('VP133-1', 'VP133-2'); delete from vendors where vendor_name = 'VP133 Vendor'; delete from web.cache where key like 'SB%' or key like 'F\\_%';");
  const post = async (body) => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const errs = [];
  let b = null;
  try {
    cleanup();
    const tok = (await post({ fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const SA = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const v = await SA('saveVendor', { name: 'VP133 Vendor', gstReg: 'No', pan: 'ABCDE1234J', bank: 'HDFC Bank', branch: 'Mankoli', account: '12345671', ifsc: 'HDFC0009218', phone: '9800000133', address: 'At Post Test Village, Tal Bhiwandi, Dist Thane' }, 'add');
    const mk = no => SA('saveMaster', { no: no, name: 'Tanker', type: 'Water Tanker', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'VP133 Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
    const m1 = await mk('VP133-1'), m2 = await mk('VP133-2');
    const b1 = await SA('saveBoq', { vendor: 'VP133 Vendor', from: '2026-08-01', to: '2026-08-31', tdsPct: 2, woNo: 'SLI/VTR-Office/WO/2024-2025/73', woDate: '2024-05-01', lines: [{ no: 'VP133-1', basis: 'Per Trip', rate: 1000, diesel: 'Debit Basis' }, { no: 'VP133-2', basis: 'Per Trip', rate: 500, diesel: 'Debit Basis' }] }, 'add');
    const a1 = await SA('saveBoq', { vendor: 'VP133 Vendor', amendOf: b1 && b1.id, from: '2026-09-01', to: '', tdsPct: 2, lines: [{ no: 'VP133-1', basis: 'Per Trip', rate: 1200, diesel: 'Debit Basis' }] }, 'add');
    ok('1. BOQ 1 with its work order, and Amendment 1 (only VP133-1 ₹1,200 from 01-09-2026)', !v.ERROR && !m1.ERROR && !m2.ERROR && b1 && b1.ok && a1 && a1.ok, { v, m1, m2, b1, a1 });
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const a = document.getElementById('ai_panel'); if (a) a.hidden = true; }); } catch (e) {}
    // the print window is caught here (its HTML), not opened
    await F.evaluate(() => { window.__printed = ''; window.open = () => ({ closed: false, focus() {}, print() {}, alert() {}, document: { open() {}, write(h) { window.__printed += h; }, close() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } } }); });
    await F.evaluate(() => showTab('boq'));
    for (let i = 0; i < 40; i++) { if (await F.evaluate(() => [...$('bf_vendor').options].some(o => o.value === 'VP133 Vendor'))) break; await wait(500); }
    await F.evaluate(() => { $('bf_vendor').value = 'VP133 Vendor'; $('bf_vendor').dispatchEvent(new Event('change')); }); await wait(1000);
    const printOf = async id => {
      await F.evaluate(() => { window.__printed = ''; });
      await F.evaluate(x => document.querySelector('#boq_rows [data-bprint="' + x + '"]').click(), id); await wait(800);
      await F.evaluate(() => { if (!$('cf_back').hidden) $('cf_ok').click(); }); await wait(1200);
      return F.evaluate(() => window.__printed);
    };
    const text = h => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ').replace(/<br>/g, ' \n ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ');
    // 2. BOQ 1
    const h1 = await printOf(b1.id), t1 = text(h1);
    ok('2. Print of BOQ 1: "Work Order No: SLI/VTR-Office/WO/2024-2025/73" and "Work Order Date: 01-05-2024" on top', /Work Order No: SLI\/VTR-Office\/WO\/2024-2025\/73/.test(t1) && /Work Order Date: 01-05-2024/.test(t1) && /BOQ \/ Rate Contract – BOQ 1/.test(t1) && /VENDOR SIGN & STAMP/.test(t1), t1.slice(0, 1500));
    // 3. the amendment
    const h2 = await printOf(a1.id), t2 = text(h2).replace(/\s+/g, ' ');
    const want = [/Amendment Letter – Amendment 1 of BOQ 1/, /Work Order No: SLI\/VTR-Office\/WO\/2024-2025\/73/, /Work Order Date: 01-05-2024/, /With effect from: 01-09-2026/,
      /To, VP133 Vendor At Post Test Village, Tal Bhiwandi, Dist Thane Contact No\. 9800000133/, /Subject: Amendment 1 of BOQ 1 – change of rate for 01 Nos Water Tanker\./,
      /Reference: Work Order No\. SLI\/VTR-Office\/WO\/2024-2025\/73 dated 01-05-2024; BOQ 1 \(BOQ-\d+\) from 01-08-2026 to 31-08-2026\./,
      /Dear Sir, With reference to the above work order, we are changing the rate of the machinery given below \(Annexure-I\) with effect from 01-09-2026 ?\. The other machinery of BOQ 1 and all other terms and conditions remain the same\./,
      /Annexure-I – BOQ \(amended rate\)/, /1 VP133-1 Water Tanker Per Trip ₹1,000 per trip till 31-08-2026 ₹1,200 per trip Debit basis/, /For and on behalf of /, /ACCEPTED BY VENDOR SIGN & STAMP/];
    const miss = want.filter(r => !r.test(t2)).map(String);
    ok('3. Print of the amendment = an amendment letter: To, Subject, Reference (work order of BOQ 1), with effect from 01-09-2026, earlier ₹1,000 till 31-08-2026 → new ₹1,200, acceptance', miss.length === 0 && !/VP133-2 Water Tanker Per Trip/.test(t2.split('All versions')[0]), { miss, t2: t2.slice(0, 1800) });
    // the picture
    const pw = await b.newPage(); await pw.setViewport({ width: 900, height: 1250 });
    await pw.goto(U + '/', { waitUntil: 'domcontentloaded' }); await pw.setContent(h2.replace(/<script[\s\S]*?<\/script>/g, ''), { waitUntil: 'load' }); await wait(800);
    await pw.screenshot({ path: SHOTS + 'boqprint133.png', fullPage: true });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the page', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
