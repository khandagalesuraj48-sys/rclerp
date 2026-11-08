// hostile text in names / remarks must never run as code on any page
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3000/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
(async () => {
  const P = '"><img src=x onerror="window.__xss=(window.__xss||0)+1"><b>X</b>';
  const tok = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token; const api = (fn, ...a) => rpc('api', tok, fn, a);
  const made = [];
  let r = await api('saveVendor', { name: 'XSS ' + P, gstReg: 'No', pan: 'ABCDE1234F', address: P, contact: P, bank: P }, 'add'); made.push('vendor: ' + (r.error || 'saved'));
  r = await api('saveMaster', { no: 'XSS-1', name: 'Nm ' + P, type: 'Ty ' + P, unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'XSS ' + P, ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01', remark: P }, 'add'); made.push('machinery: ' + (r.error || 'saved'));
  r = await api('saveDieselIssue', { date: '2026-09-29', shift: 'Day', source: 'Dispenser', no: 'XSS-1', qty: 3, kmReading: 10, driver: 'Dr ' + P, remark: P, force: true }); made.push('diesel issue: ' + (r.error || 'saved')); const di = r.result && r.result.id;
  r = await api('saveLogRows', { rows: [{ date: '2026-09-29', shift: 'Full Day', no: 'XSS-1', mode: 'KM', openingKm: 10, closingKm: 50, work: P, chFrom: P, chTo: P }] }); made.push('log book: ' + (r.error || 'saved'));
  r = await api('saveInward', { date: '2026-09-29', location: 'Dispenser', pump: 'Pump ' + P, qty: 1, rate: 90, billNo: P, billDate: '2026-09-29', remark: P }); made.push('inward: ' + (r.error || 'saved')); const inw = r.result && r.result.id;
  console.log('hostile text saved through the app → ' + made.join(' · '));
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4000);
  const hits = [];
  for (const t of await f.evaluate(() => TABS.slice())) { await f.evaluate(t2 => { try { closeConfirm(false); } catch (e) {} showTab(t2); }, t); await wait(1500);
    const n = await f.evaluate(() => { const v = window.__xss || 0; window.__xss = 0; return v; }); if (n) hits.push(t + ' ×' + n); }
  // the pages that need a pick to show the hostile rows
  await f.evaluate(() => showTab('log')); await wait(1200); await f.evaluate(() => { const a = document.getElementById('lf_from'), c = document.getElementById('lf_to'); a.value = '2026-09-29'; c.value = '2026-09-29'; a.dispatchEvent(new Event('change', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2000);
  await f.evaluate(() => { showTab('diesel'); }); await wait(1500); await f.evaluate(() => { const i = document.getElementById('d_no'); i.value = 'XSS-1'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(1500);
  await f.evaluate(() => { const s = document.getElementById('gs_in') || document.querySelector('[id^=gs_] input'); if (s) { s.value = 'XSS'; s.dispatchEvent(new Event('input', { bubbles: true })); } }); await wait(1500);
  const n2 = await f.evaluate(() => window.__xss || 0); if (n2) hits.push('filtered lists / search ×' + n2);
  const shown = await f.evaluate(() => document.body.innerHTML.indexOf('&lt;img src=x onerror') > -1 || document.body.textContent.indexOf('<img src=x onerror') > -1);
  console.log((hits.length ? 'FAIL' : 'PASS') + ' hostile text never ran as code on any of the pages' + (hits.length ? '  → ran on: ' + hits.join(', ') : '') + ' (the text itself was on screen as plain text: ' + shown + ')');
  await b.close();
  // clean up
  if (di) await api('deleteLogRow', 'XSS-1|2026-09-29|Full Day'); if (di) await api('deleteDieselIssue', di); if (inw) await api('deleteInward', inw);
  await api('deleteMaster', 'XSS-1'); await api('deleteVendor', 'XSS ' + P);
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
