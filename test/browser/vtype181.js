// update-181 (28-10-2026, with the Store's import of its old inward register – his answer: the suppliers in the site's Vendor Master as
// "Material Supplier", kept out of the machinery and billing lists) – on the local rig (PORTAL=1): site S1 (database rcl – vendors.vendor_type
// there: the Store's step 3), T2 (rcl_s2 – the column taken away for this test: a site that has not run it). Test data only (made here).
//   1. the vendors' type comes with the Vendor Master; the parties' list (Log Book "Debit to", Machinery Billing, Saved Bills) without the
//      material suppliers; one with machinery in the Asset Master is a vendor as any
//   2. the Vendor Master page: "Material Supplier" by the name, the Type filter, the count; the type in the form (kept by a save; changed)
//   3. not offered for an asset's owner, a BOQ, a payment; a page of before (no type sent) keeps the type
//   4. T2 without the column: no type in the form, a vendor saved as before
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node vtype181.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const M1 = 'TEST MATERIAL SUPPLIER ONE', M2 = 'TEST MATERIAL SUPPLIER TWO', M3 = 'TEST MATERIAL SUPPLIER THREE', RV = 'TEST RENTAL VENDOR 181';
(async () => {
  const errs = []; let b = null, cookie = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  try {
    // ---- the start: S1's test vendors (three material suppliers as the Store's import makes them, a rental vendor); T2 without the column ----
    const now = new Date().toISOString();
    sql('rcl', "alter table vendors add column if not exists vendor_type text; notify pgrst, 'reload schema';");      // (as the Store's step 3 does at a site)
    await wait(1200);
    sql('rcl', "delete from vendors where id in ('" + [M1, M2, M3, RV].join("','") + "'); delete from master where id = 'RL-181';" +
      [M1, M2, M3].map(n => "insert into vendors (id, vendor_name, gst_registered, vendor_type, remark, entered_at, entered_by, owner_site) values ('" + n + "', '" + n + "', 'No', 'Material Supplier', 'Material supplier – from the Store''s old inward register (GST, PAN, Aadhaar to be filled)', '" + now + "', 'store-import@rcl.test', 'S1');").join('') +
      "insert into vendors (id, vendor_name, gst_registered, entered_at, entered_by, owner_site) values ('" + RV + "', '" + RV + "', 'No', '" + now + "', 'sa@rcl.test', 'S1');");
    const had2 = sql('rcl_s2', "select count(*) from information_schema.columns where table_name = 'vendors' and column_name = 'vendor_type'");      // (a site whose step is not run)
    if (had2 === '1') sql('rcl_s2', "alter table vendors rename column vendor_type to vendor_type_x181; notify pgrst, 'reload schema';");
    await wait(1500);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today;
    // ---- 1. the server ----
    let v = await J('getVendors');
    const tOf = n => ((Array.isArray(v) ? v : []).find(x => x.name === n) || {}).type;
    ok('the Vendor Master: the three made by the Store "Material Supplier", the rental vendor none', tOf(M1) === 'Material Supplier' && tOf(M2) === 'Material Supplier' && tOf(RV) === '', (Array.isArray(v) ? v : [v]).filter(x => /TEST/.test(x.name || '')));
    let L = await J('getLookups');
    ok('   the parties\' list (Log Book "Debit to", Machinery Billing, Saved Bills): the rental vendor, no material supplier', L.vendors.indexOf(RV) > -1 && !L.vendors.some(n => /TEST MATERIAL/.test(n)), L.vendors.filter(n => /TEST/.test(n)));
    let bq = await J('getBoqs', {});
    ok('   S1 keeps the vendor\'s type (vendors.vendor_type there)', bq.vtypeOn === true, bq.vtypeOn);
    const m = await J('saveMaster', { no: 'RL-181', name: 'Roller of a supplier', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: M2, ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: today.slice(0, 8) + '01' }, 'add');
    L = await J('getLookups');
    ok('   a material supplier given a machinery (Rental, in the Asset Master): a vendor as any – in the parties\' list', !m.ERROR && L.vendors.indexOf(M2) > -1 && L.vendors.indexOf(M1) === -1, [m.ERROR, L.vendors.filter(n => /TEST/.test(n))]);
    // ---- 2. the Vendor Master page ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(4000);
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); await wait(300); };
    await F.evaluate(() => showTab('vendors')); await wait(3000);
    const rows = () => F.evaluate(() => [...document.querySelectorAll('#v_rows tr')].map(tr => tr.children[0] ? tr.children[0].innerText.replace(/\s+/g, ' ').trim() : ''));
    await F.evaluate(() => { $('vf_q').value = 'TEST'; $('vf_q').dispatchEvent(new Event('input')); }); await wait(400);
    let r = await rows();
    ok('the Vendor Master page: "Material Supplier" by the name of each one the Store made', r.some(t => t === M1 + ' Material Supplier') && r.some(t => t === RV), r);
    await F.evaluate(() => { $('vf_ty').value = 'mat'; $('vf_ty').dispatchEvent(new Event('change')); }); await wait(300); r = await rows();
    const sum = await F.evaluate(() => $('vf_sum').textContent);
    ok('   Type "Material suppliers (Store)": only them; the count of material suppliers', r.length === 3 && r.every(t => / Material Supplier$/.test(t)) && /material suppliers: \d+/.test(sum), [r, sum]);
    await F.evaluate(() => { $('vf_ty').value = 'bill'; $('vf_ty').dispatchEvent(new Event('change')); }); await wait(300); r = await rows();
    ok('   Type "Machinery & billing": no material supplier', r.length >= 1 && !r.some(t => /Material Supplier/.test(t)) && r.some(t => t === RV), r);
    await F.evaluate(() => { $('vf_ty').value = 'mat'; $('vf_ty').dispatchEvent(new Event('change')); }); await wait(300);
    await tidy(); await mp.screenshot({ path: SHOT + '/vtype181_vendors.png' });
    // the form: the type shown, kept by a save of the details
    await F.evaluate(n => { document.querySelector('[data-vedit="' + n + '"]').click(); }, M1); await wait(800);
    r = await F.evaluate(() => ({ shown: !$('v_type_f').hidden, v: $('v_type').value, opts: [...$('v_type').options].map(o => o.textContent) }));
    ok('   its form: "Vendor type" – Material Supplier (Store) / Machinery / billing vendor', r.shown && r.v === 'Material Supplier' && JSON.stringify(r.opts) === JSON.stringify(['Machinery / billing vendor', 'Material Supplier (Store)']), r);
    await tidy(); await mp.screenshot({ path: SHOT + '/vtype181_form.png' });
    await F.evaluate(() => { $('v_pan').value = 'ABCDE1234F'; $('v_phone').value = '9876543210'; $('v_save').click(); }); await wait(2500);
    ok('   its details saved (PAN, mobile) – still a Material Supplier', sql('rcl', "select coalesce(pan_number, '') || '|' || coalesce(phone, '') || '|' || coalesce(vendor_type, '') from vendors where id = '" + M1 + "'") === 'ABCDE1234F|9876543210|Material Supplier');
    // ---- 3. not offered for an asset's owner, a BOQ, a payment ----
    r = await F.evaluate(() => ({ owner: [...$('dl_vendornames').options].map(o => o.value), boqF: [...$('bf_vendor').options].map(o => o.textContent) }));
    ok('not offered for an asset\'s owner or in the BOQ list – the one with machinery (Rental) is', !r.owner.includes(M1) && !r.owner.includes(M3) && r.owner.includes(M2) && r.owner.includes(RV) && !r.boqF.includes(M1) && r.boqF.includes(RV), [r.owner.filter(n => /TEST/.test(n)), r.boqF.filter(n => /TEST/.test(n))]);
    r = await F.evaluate(async () => { bOpen('new'); await new Promise(z => setTimeout(z, 200)); const o = [...$('b_vendor').options].map(x => x.textContent); $('b_form') && ($('b_form').hidden = true); return o; });
    ok('   a new BOQ: the vendors to pick without a material supplier', !r.includes(M1) && r.includes(RV), r.filter(n => /TEST/.test(n)));
    r = await F.evaluate(async () => { S.py = S.py || {}; S.py.vendors = []; const n = await pyVendors(); return n; }).catch(e => 'no pyVendors: ' + e.message);
    ok('   a payment: the vendors to pick without a material supplier', Array.isArray(r) ? !r.includes(M1) && r.includes(RV) : false, Array.isArray(r) ? r.filter(n => /TEST/.test(n)) : r);
    // the type changed in the form: a machinery / billing vendor – offered then
    await F.evaluate(n => { showTab('vendors'); }); await wait(1500);
    await F.evaluate(n => { $('vf_ty').value = ''; $('vf_q').value = n; $('vf_q').dispatchEvent(new Event('input')); document.querySelector('[data-vedit="' + n + '"]').click(); }, M3); await wait(800);
    await F.evaluate(() => { $('v_type').value = ''; $('v_save').click(); }); await wait(2500);
    L = await J('getLookups');
    ok('the type changed in the form to "Machinery / billing vendor": saved (no type), in the parties\' list', sql('rcl', "select coalesce(vendor_type, '') from vendors where id = '" + M3 + "'") === '' && L.vendors.indexOf(M3) > -1, [sql('rcl', "select vendor_type from vendors where id = '" + M3 + "'"), L.vendors.filter(n => /TEST/.test(n))]);
    // a page of before (no type sent): the type kept
    const sv = await J('saveVendor', { oldName: M1, name: M1, gstReg: 'No', pan: 'ABCDE1234F', phone: '9876543211', ver: ((await J('getVendors')).find(x => x.name === M1) || {}).ver }, 'edit');
    ok('   a save from a page of before (no type in it): the vendor stays a Material Supplier', !sv.ERROR && sql('rcl', "select coalesce(vendor_type, '') || '|' || phone from vendors where id = '" + M1 + "'") === 'Material Supplier|9876543211', sv.ERROR || sql('rcl', "select vendor_type, phone from vendors where id = '" + M1 + "'"));
    // ---- 4. T2: no vendors.vendor_type ----
    const s2 = await post(SA, { fn: 'ssoLogin', args: [await ticket('T2')] });
    const J2 = async (fn, ...a) => { const x = await post(SA, { fn: 'api', args: [s2.result.token, fn, a], site: 'T2' }); return x.error ? { ERROR: x.error } : x.result; };
    bq = await J2('getBoqs', {});
    const s2v = await J2('saveVendor', { name: 'TEST T2 VENDOR 181', gstReg: 'No', type: '' }, 'add');
    ok('a site without vendors.vendor_type (its step not run): no type kept; a vendor saved as before', bq.vtypeOn === false && !s2v.ERROR, [bq.vtypeOn, s2v.ERROR]);
    sql('rcl_s2', "delete from vendors where id = 'TEST T2 VENDOR 181';");
    ok('no fault on the page', errs.length === 0, errs);
  } catch (e) { ok('the test ran to its end', false, e && e.stack); }
  try { if (sql('rcl_s2', "select count(*) from information_schema.columns where table_name = 'vendors' and column_name = 'vendor_type_x181'") === '1') sql('rcl_s2', "alter table vendors rename column vendor_type_x181 to vendor_type; notify pgrst, 'reload schema';"); } catch (e) { out.push('(T2: the column not given back: ' + e.message + ')'); }
  if (b) await b.close();
  console.log(out.join('\n')); console.log('TOTAL pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();
