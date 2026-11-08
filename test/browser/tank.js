// the MD's example through the page and the database: last fill 30 L at 1234, closed at 1280 → 20 L still in the tank → 9.13 L debited; the server agrees on Verify & Submit
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
(async () => {
  const tk = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token; const api = async (fn, ...a) => { const r = await rpc('api', tk, fn, a); if (r.error && !/already/.test(r.error)) out.push('setup ' + fn + ': ' + r.error); return r.result; };
  sql("delete from bills where vendor_name = 'Tank Vendor'; delete from log_book where machinery = 'TKX-1'; delete from diesel_issue where machinery = 'TKX-1'; delete from boq where vendor_name = 'Tank Vendor';");
  await api('saveMaster', { no: 'TKX-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.6, owner: 'Tank Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  await api('saveVendor', { name: 'Tank Vendor', gstReg: 'No', pan: 'ABCDE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  await api('saveBoq', { vendor: 'Tank Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-TK', lines: [{ no: 'TKX-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add');
  await api('saveLogRows', { rows: [{ date: '2026-09-28', shift: 'Full Day', no: 'TKX-1', mode: 'KM', openingKm: 1000, closingKm: 1134 }, { date: '2026-09-29', shift: 'Full Day', no: 'TKX-1', mode: 'KM', closingKm: 1234 }, { date: '2026-09-30', shift: 'Full Day', no: 'TKX-1', mode: 'KM', closingKm: 1280 }] });
  await api('saveDieselIssue', { date: '2026-09-28', shift: 'Day', source: 'Dispenser', no: 'TKX-1', qty: 60, kmReading: 1000, force: true });
  await api('saveDieselIssue', { date: '2026-09-30', shift: 'Day', source: 'Dispenser', no: 'TKX-1', qty: 30, kmReading: 1234, force: true });
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('bill'); }); await wait(1500);
  await f.evaluate(async () => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /Tank Vendor/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_co').value = 'Rachana Construction Limited'; document.getElementById('mb_build').click(); });
  for (let i = 0; i < 40; i++) { await wait(500); if (await f.evaluate(() => (S.mb.bills || []).length > 0)) break; }
  const m = await f.evaluate(() => { const bb = (S.mb.bills || []).find(x => /Tank Vendor/.test(x.vendor.name)); if (!bb) return null; const x = bb.machines[0]; return { issued: x.issued, raw: x.rawExcess, tank: x.tank, excess: x.excessQty, rate: x.dieselRate, amt: x.excessAmt, B: bb.B, warn: bb.warnings.join(' | '), abs: document.querySelector('#mb_pages .mb-paper') ? document.querySelector('#mb_pages .mb-paper').textContent.replace(/\s+/g, ' ') : '' }; });
  ok('page: 90 L issued, 60.87 L by standard → 29.13 L over', m && m.issued === 90 && m.raw === 29.13, m && { issued: m.issued, raw: m.raw });
  ok('…last fill 30 L at 1234, closed at 1280 → 46 km = 10 L → 20 L still in the tank', m && m.tank && m.tank.qty === 30 && m.tank.km === 1234 && m.tank.kmAfter === 46 && m.tank.used === 10 && m.tank.applied === 20, m && m.tank);
  ok('…so 9.13 L are debited (× the diesel rate)', m && m.excess === 9.13 && Math.abs(m.amt - Math.round(9.13 * m.rate * 100) / 100) < 0.01 && m.B === m.amt, m && { excess: m.excess, rate: m.rate, amt: m.amt, B: m.B });
  ok('the Abstract says it on line B', m && /last fill 30 L on 30-09-2026 at 1,234 km; run after it 46 km = 10 L by standard; 20 L taken as still in the tank – not debited/.test(m.abs), m && m.abs.slice(m.abs.indexOf('Less- Diesel'), m.abs.indexOf('Less- Diesel') + 260));
  ok('"to check" says the tank size is not set in Asset Master', m && /20 L of the last fill taken as still in the tank – Tank Capacity is not set/.test(m.warn), m && m.warn);
  await p.screenshot({ path: 'shots/tank_bill.png' });
  // Verify & Submit: the server builds the bill again by itself and must come to the same figures
  await f.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const no = tr.querySelector('.mb-no'); if (no && !no.value) { no.value = '91'; no.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(600);
  await f.evaluate(() => document.getElementById('mb_abstract').click()); let seen = '';
  for (let i = 0; i < 40; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const tx = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 200); document.getElementById('cf_ok').click(); return tx; } return ''; }); if (t) seen += t + ' || '; if (sql("select count(*) from bills where vendor_name = 'Tank Vendor'") !== '0') break; }
  const saved = sql("select coalesce(data::json->>'B', '') from bills where vendor_name = 'Tank Vendor' and status = 'Active'");
  ok('Verify & Submit: the server agrees and the bill is saved with the same deduction', !!m && Number(saved) === m.B && /All correct|ready/.test(seen), 'saved B = ' + saved + ' | ' + seen.slice(0, 200));
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/tank.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/tank.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
