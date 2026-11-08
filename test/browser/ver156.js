// update-156 (asked 24-10-2026: "Concurrent Updates साठी Version Checks आणि Conflict Detection अनिवार्य ठेव"): two people open the
//   same entry on Inward, Transfer, Payments, Asset Master and Vendor Master; the first saves; the second's save – or delete – of
//   what he opened is refused with the reason, and the first one's change stays. Real pages, two browsers (each its own sign-in).
// On the local rig only.   node ver156.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const clean = () => sql("delete from diesel_inward where pump_name = 'N156 Pump'; delete from diesel_transfer where remark = 'N156'; delete from payments where vendor_name = 'N156 Vendor'; delete from master where id like 'N156-%'; delete from vendors where vendor_name = 'N156 Vendor';");
const NOW = /was changed by .* after you opened it – open it again and make your change there\. Nothing was saved\./;
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N156 Vendor', gstReg: 'No', pan: 'ABCDE1256N', bank: 'SBI', account: '12345156', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N156-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 6, owner: 'N156 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  const inw = E(await api('saveInward', { date: '2026-10-05', location: 'Dispenser', pump: 'N156 Pump', qty: 1000, rate: 90, billNo: 'N156-B1', billDate: '2026-10-05' }));
  E(await api('saveInward', { date: '2026-10-05', location: 'VTR Store', pump: 'N156 Pump', qty: 500, rate: 90, billNo: 'N156-B2', billDate: '2026-10-05' }));
  const tr = E(await api('saveTransfer', { date: '2026-10-06', shift: 'Day', from: 'VTR Store', to: 'Dispenser', qty: 100, remark: 'N156' }));
  E(await api('savePayment', { type: 'Payment', date: '2026-10-07', vendor: 'N156 Vendor', amount: 10000, mode: 'NEFT', ref: 'UTR156' }, 'add'));
  ok('test data: a vendor, a JCB, two inwards, a transfer, a payment', !seedErr.length && inw && inw.id && tr && tr.id, seedErr.join(' // ') || [inw && inw.id, tr && tr.id]);

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  const open = async () => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(); await p.setViewport({ width: 1600, height: 1000 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__t = []; const o = window.toast; window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; });
    return f; };
  const A = await open(), B = await open();
  const yes = f => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  const said = f => f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 500) : ''; if (bx) bx.hidden = true; const r = ((window.__t || []).join(' | ') + ' ' + t).trim(); window.__t = []; return r; });
  const click = async (f, id) => { await f.evaluate(id => document.getElementById(id).click(), id); for (let i = 0; i < 12; i++) { await wait(500); await yes(f); } await wait(800); };
  const setV = (f, id, v) => f.evaluate((id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, id, v);
  const tab = async (f, t) => { await f.evaluate(t => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab(t); }, t); await wait(2500); };

  // ---------- 1. Inward ----------
  const rate = () => sql("select rate::float8 from diesel_inward where id = '" + inw.id + "'");
  for (const f of [A, B]) { await tab(f, 'inward'); await f.evaluate(() => { $('if_from').value = '2026-10-01'; $('if_to').value = '2026-10-31'; loadInward(); }); await wait(2000); await f.evaluate(id => editInward(id), inw.id); }
  await setV(B, 'i_rate', '91'); await click(B, 'i_save'); await said(B);
  ok('Inward: A and B open ' + inw.id + '; B saves the rate 91', rate() === '91', rate());
  await setV(A, 'i_rate', '95'); await click(A, 'i_save'); let s = await said(A);
  ok('   A saves 95 on what he opened (90): refused – "Inward ' + inw.id + ' was changed by … after you opened it"; 91 stays', new RegExp('Inward ' + inw.id + ' was changed by').test(s) && NOW.test(s) && rate() === '91', [s, rate()]);
  const staleB = await B.evaluate(id => ((S.inwardRows || []).find(r => r.id === id) || {}).ver || '', inw.id);      // what B's list shows now (91)
  await A.evaluate(() => { try { clearInward(); } catch (e) {} loadInward(); }); await wait(2000); await A.evaluate(id => editInward(id), inw.id); await setV(A, 'i_rate', '95'); await click(A, 'i_save'); await said(A);
  ok('   opened again (it shows 91) and saved: 95', rate() === '95', rate());
  // a delete of the version B's list showed before A's change: refused (his list then follows by itself within seconds)
  const delMsg = await B.evaluate((id, v) => call('deleteInward', id, v).then(() => 'DELETED', e => String(e && e.message || e)), inw.id, staleB);
  ok('   B deletes it with what his list showed (91): refused, not deleted', NOW.test(delMsg) && rate() === '95', [delMsg, rate()]);
  await wait(3500);
  const freshB = await B.evaluate(id => { const r = (S.inwardRows || []).find(x => x.id === id); return r ? r.rate : null; }, inw.id);
  ok('   B\'s list shows 95 by itself (the live refresh) – a delete from it now has the version of now', Number(freshB) === 95, freshB);

  // ---------- 2. Transfer ----------
  const tq = () => sql("select qty::float8 from diesel_transfer where id = '" + tr.id + "'");
  for (const f of [A, B]) { await tab(f, 'transfer'); await f.evaluate(() => { $('tf_from') && ($('tf_from').value = '2026-10-01'); $('tf_to') && ($('tf_to').value = '2026-10-31'); loadTransfers(); }); await wait(2000); await f.evaluate(id => editTransfer(id), tr.id); }
  await setV(B, 't_qty', '120'); await click(B, 't_save'); await said(B);
  await setV(A, 't_qty', '150'); await click(A, 't_save'); s = await said(A);
  ok('Transfer: B saves 120, then A saves 150 on what he opened (100): refused; 120 stays', tq() === '120' && new RegExp('Transfer ' + tr.id + ' was changed by').test(s), [tq(), s]);

  // ---------- 3. Payments ----------
  const pa = () => sql("select amount::float8 from payments where vendor_name = 'N156 Vendor'");
  for (const f of [A, B]) { await tab(f, 'pay'); await f.evaluate(() => { try { $('py_vendor').value = 'N156 Vendor'; } catch (e) {} return pyLoad(); }); await wait(2000);
    await f.evaluate(() => { const bt = document.querySelector('#py_rows [data-pye]'); if (bt) bt.click(); }); await wait(1500); }
  await setV(B, 'py_amount', '12000'); await click(B, 'py_save'); await said(B);
  await setV(A, 'py_amount', '15000'); await click(A, 'py_save'); s = await said(A);
  ok('Payments: B saves 12,000, then A saves 15,000 on what he opened (10,000): refused; 12,000 stays (the ledger)', pa() === '12000' && /Payment PAY-\d+ \(N156 Vendor\) was changed by/.test(s), [pa(), s]);

  // ---------- 4. Asset Master ----------
  const hs = () => sql("select std_ltr_per_hr::float8 from master where id = 'N156-JCB'");
  for (const f of [A, B]) { await tab(f, 'master'); await f.evaluate(() => { try { setMode('one'); } catch (e) {} editMaster('N156-JCB'); }); await wait(800); }
  await setV(B, 'm_hrstd', '7'); await click(B, 'm_save'); await said(B);
  await setV(A, 'm_hrstd', '8'); await click(A, 'm_save'); s = await said(A);
  ok('Asset Master: B saves 7 L/hr, then A saves 8 on what he opened (6): refused; 7 stays', hs() === '7' && /Machinery N156-JCB was changed by/.test(s), [hs(), s]);

  // ---------- 5. Vendor Master ----------
  const vb = () => sql("select coalesce(bank_name, '') || '/' || coalesce(phone, '') from vendors where vendor_name = 'N156 Vendor'");
  for (const f of [A, B]) { await tab(f, 'vendors'); await wait(1500); await f.evaluate(() => vOpen('N156 Vendor')); await wait(800); }
  await setV(B, 'v_bank', 'HDFC Bank'); await click(B, 'v_save'); await said(B);
  await setV(A, 'v_phone', '9800000156'); await click(A, 'v_save'); s = await said(A);
  ok('Vendor Master: B changes the bank, then A the phone on what he opened: refused; B\'s bank stays, the phone is not changed', /^HDFC Bank\/$/.test(vb()) && /Vendor N156 Vendor was changed by/.test(s), [vb(), s]);
  ok('   the help says what happened and what to do (in his language)', await A.evaluate(() => { try { return typeof FIX_RULES !== 'undefined' && FIX_RULES.some(r => r.re && r.re.test('Vendor X was changed by Y after you opened it – open it again and make your change there. Nothing was saved.')); } catch (e) { return false; } }));

  ok('no script error on the pages', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
