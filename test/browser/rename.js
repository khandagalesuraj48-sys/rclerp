// rename a vendor through the page; check every table in the database; rename back
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 330) : '')); };
const OLD = 'Multi Vendor', NEW = 'Multi Vendor Pvt Ltd';
const counts = name => sql("select (select count(*) from vendors where vendor_name = '" + name + "') || ' vendor, ' || (select count(*) from master where owner_name = '" + name + "') || ' assets, ' || (select count(*) from boq where vendor_name = '" + name + "') || ' boq, ' || (select count(*) from log_book where owner_name = '" + name + "') || ' log, ' || (select count(*) from log_book where debit_to = '" + name + "') || ' debit-to, ' || (select count(*) from payments where vendor_name = '" + name + "') || ' payments, ' || (select count(*) from diesel_issue where owner_name = '" + name + "') || ' diesel'");
(async () => {
  const tk = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token; const api = async (fn, ...a) => (await rpc('api', tk, fn, a));
  // a clean start: the vendor under its old name, with an entry, a "Debit to", a diesel issue and a payment
  sql("update vendors set vendor_name = '" + OLD + "', id = upper('" + OLD + "') where vendor_name = '" + NEW + "'; update master set owner_name = '" + OLD + "' where owner_name = '" + NEW + "'; update boq set vendor_name = '" + OLD + "' where vendor_name = '" + NEW + "'; delete from log_book where machinery in ('MV-1', 'GAPX-1') and date = '2026-09-20'; delete from payments where vendor_name in ('" + OLD + "', '" + NEW + "'); delete from diesel_issue where machinery = 'MV-1';");
  let r = await api('saveLogRows', { rows: [{ date: '2026-09-20', shift: 'Full Day', no: 'MV-1', mode: 'Hrs', openingHr: 100, closingHr: 108 }] }); if (r.error || (r.result && r.result.ok === false)) out.push('setup log: ' + JSON.stringify(r).slice(0, 200));
  r = await api('saveLogRows', { rows: [{ date: '2026-09-20', shift: 'Full Day', no: 'GAPX-1', mode: 'KM', openingKm: 900, closingKm: 950, debitTo: OLD, debitRate: 40 }] }); if (r.error || (r.result && r.result.ok === false)) out.push('setup debit-to: ' + JSON.stringify(r).slice(0, 200));
  r = await api('saveDieselIssue', { date: '2026-09-20', shift: 'Day', source: 'Dispenser', no: 'MV-1', qty: 15, hrReading: 100, force: true }); if (r.error) out.push('setup diesel: ' + r.error);
  r = await api('savePayment', { type: 'Payment', vendor: OLD, date: '2026-09-25', amount: 7000, mode: 'NEFT' }, 'add'); if (r.error) out.push('setup payment: ' + r.error);
  const before = counts(OLD);
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('vendors'); });
  const waitVendor = async name => { for (let i = 0; i < 40; i++) { if (await f.evaluate(n => (S.vendors || []).some(v => v.name === n), name)) return true; await wait(500); } return false; };
  await waitVendor(OLD);
  const openV = name => f.evaluate(n => { vOpen(n); return { ro: document.getElementById('v_name').readOnly, title: document.getElementById('v_title').textContent, name: document.getElementById('v_name').value }; }, name);
  const typeName = v => f.evaluate(v2 => { const el = document.getElementById('v_name'); el.value = v2; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const press = async () => { await f.evaluate(() => document.getElementById('v_save').click()); await wait(600); const q = await f.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 260) : ''; }); return q; };
  const yes = async () => { await f.evaluate(() => document.getElementById('cf_ok').click()); for (let i = 0; i < 30; i++) { await wait(500); const t = await f.evaluate(() => { const x = document.getElementById('toast'), bx = document.getElementById('fixbox'); return (x && !x.hidden ? x.textContent : '') + (bx && !bx.hidden ? ' || ' + bx.textContent.replace(/\s+/g, ' ').slice(0, 300) : ''); }); if (t.trim()) return t; } return ''; };
  let st = await openV(OLD);
  ok('the name of a saved vendor can be typed over', st.ro === false && st.name === OLD, st);
  // 1. a name another vendor has: refused
  await typeName('Item Vendor'); let q = await press(); let t = await yes();
  ok('renaming to the name of ANOTHER vendor is refused (with what to do), nothing changes', /Rename this vendor/.test(q) && /already a vendor/.test(t) && /काय करायचे/.test(t) && counts(OLD) === before, t.slice(0, 200));
  await f.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; });
  // 2. the rename
  await typeName(NEW); q = await press();
  ok('Save asks first and says what will follow', /Rename this vendor/.test(q) && q.indexOf(OLD) > -1 && q.indexOf(NEW) > -1 && /4 asset\(s\)/.test(q), q);
  await p.screenshot({ path: 'shots/rename.png' }); t = await yes();
  ok('renamed, and the message says what moved with it', /Vendor renamed: Multi Vendor → Multi Vendor Pvt Ltd/.test(t) && /4 assets/.test(t), t.slice(0, 220));
  const after = counts(NEW), left = counts(OLD);
  ok('database: everything is under the new name (' + before + ')', after === before && left === '0 vendor, 0 assets, 0 boq, 0 log, 0 debit-to, 0 payments, 0 diesel', 'new: ' + after + ' | old: ' + left);
  ok('database: the vendor row kept its details (PAN, bank)', sql("select pan_number || '|' || account_number from vendors where vendor_name = '" + NEW + "'") === 'ABCDE1234L|12345675', sql("select pan_number || '|' || account_number from vendors where vendor_name = '" + NEW + "'"));
  await waitVendor(NEW);
  const inPage = await f.evaluate((o, n) => ({ old: (S.vendors || []).some(v => v.name === o), now: ((S.vendors || []).find(v => v.name === n) || { machines: [] }).machines.length }), OLD, NEW);
  ok('the page: the vendor list shows the new name with its 4 assets, the old name is gone', !inPage.old && inPage.now === 4, inPage);
  const led = await api('vendorLedger', { vendor: NEW }); ok('the ledger of the new name has the payment of 7,000', JSON.stringify(led.result).indexOf('7000') > -1);
  const act = sql("select count(*) from activity_log where summary like 'Vendor renamed: Multi Vendor → Multi Vendor Pvt Ltd%'"); ok('the Activity Log records the rename', Number(act) >= 1, act);
  // back to the old name (so the test can run again)
  st = await openV(NEW); await typeName(OLD); await press(); t = await yes();
  ok('renamed back', /Vendor renamed/.test(t) && counts(OLD) === before, counts(OLD));
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/rename.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/rename.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
