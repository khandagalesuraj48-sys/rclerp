// update-147 (an entry in Approvals in full) in the browser, on the local rig started with PORTAL=1 (Mechanical :3001 own sign-in,
// :3000 linked to the Portal :3010; site S1). Test data only (three users, a machinery, diesel of "VF147"), all taken out at the
// end; the site's rules are put back as they were.
//   1. a maker sends a diesel issue and Multiple entries (2 rows) – both wait for Checker 147;
//   2. the checker's Approvals: "Details" under an entry opens it in full under its line (every field, the rows as a table, the
//      machinery's name); "Hide details" closes it; "Details of all" opens every entry;
//   3. he ticks both and presses "Approve ticked": the question shows EACH entry in full before he decides; he approves – saved;
//   4. a phone-size screen: the details fit (the table scrolls inside its own box).
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node details147.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from diesel_issue where machinery = 'VF147-1'; delete from diesel_inward where bill_number = 'VF147'; delete from master where id = 'VF147-1';" +
    "delete from billed_changes where kind = 'Flow' and (summary like '%VF147%' or args like '%VF147%'); delete from app_users where email in ('mk147@rcl.test', 'ck147@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const errs = [];
  let b = null;
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue, perm_master) select 'mk147', 'mk147@rcl.test', password_hash, 'Maker 147', 'Yes', 'No', 'Edit', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck147', 'ck147@rcl.test', password_hash, 'Checker 147', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    await wait(1500);
    const tok = async e => (await post(U, { fn: 'login', args: [e, PW] })).result.token;
    const su = await tok('sujit@rcl.test'), mk = await tok('mk147@rcl.test');
    const call = async (t, base, fn, ...a) => { const r = await post(base, { fn: 'api', args: [t, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await call(su, U, 'getInit')).today;
    const s1 = await call(su, U, 'saveMaster', { no: 'VF147-1', name: 'Tipper 147', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 2000, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const s2 = await call(su, U, 'saveInward', { date: today, location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 92, billNo: 'VF147', billDate: today });
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' });
    const sa = (await post(SA, { fn: 'ssoLogin', args: [(go.headers.get('location') || '').split('#sso=')[1] || ''] })).result.token;
    const s3 = await call(sa, SA, 'saveFlowRules', { remindHours: 4, tasks: { 'Diesel Issue': { on: true, levels: [['ck147@rcl.test']] } } });
    const e1 = await call(mk, U, 'saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'VF147-1', qty: 120, kmReading: 5120, driver: 'Ramesh 147', remark: 'night trip', force: true });
    const e2 = await call(mk, U, 'saveDieselBulk', { date: today, shift: 'Night', source: 'Dispenser', rows: [{ line: 1, no: 'VF147-1', qty: 30, kmReading: 5200, driver: 'Suresh 147' }, { line: 2, no: 'VF147-1', qty: 25, kmReading: 5260, remark: 'second fill' }], force: true });
    const id1 = ((e1.ERROR || '').match(/VF-\d{5}/) || [])[0], id2 = ((e2.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('1. seed: machinery VF147-1, diesel in the Dispenser, the rule; the maker\'s two entries wait (' + id1 + ', ' + id2 + ')', s1.ok && s2.ok && s3.ok && !!id1 && !!id2, [s1.ok || s1.ERROR, s2.ok || s2.ERROR || s2, s3.ok || s3.ERROR || s3, e1, e2]);

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'ck147@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const c = document.getElementById('ai_close'); if (c && c.offsetParent !== null) c.click(); }); } catch (e) {}      // (the Assistant opens with its brief at sign-in)
    await F.evaluate(() => showTab('approvals')); await wait(3000);
    const rows = await F.evaluate(() => [...document.querySelectorAll('#cr_rows [data-crdet]')].map(x => x.dataset.crdet));
    ok('2. the checker\'s Approvals: "Details" under each entry, "Details of all" in the bar', rows.includes(id1) && rows.includes(id2) && await F.evaluate(() => !$('cr_det_all').hidden), rows);
    await F.evaluate(id => document.querySelector('#cr_rows [data-crdet="' + id + '"]').click(), id2);
    await F.waitForFunction(id => { const r = document.querySelector('#cr_rows tr.cr-detrow[data-for="' + id + '"]'); return r && !r.hidden && r.querySelector('.cr-det'); }, { timeout: 30000 }, id2);
    const d2 = await F.evaluate(id => { const r = document.querySelector('#cr_rows tr.cr-detrow[data-for="' + id + '"]'); return { text: r.textContent, cols: [...r.querySelectorAll('.cr-dt th')].map(x => x.textContent), n: r.querySelectorAll('.cr-dt tbody tr').length, btn: document.querySelector('#cr_rows [data-crdet="' + id + '"]').textContent }; }, id2);
    ok('   Details of the Multiple entries: opened under its line – a table, one row per entry, every column, the machinery\'s name; the button says "Hide details"',
      d2.n === 2 && d2.cols.join('|') === '#|Machinery|Litres|KM reading|Driver|Remark' && /Tipper 147/.test(d2.text) && /Suresh 147/.test(d2.text) && /second fill/.test(d2.text) && /Night/.test(d2.text) && d2.btn === 'Hide details', d2);
    await p.screenshot({ path: 'shots/147-details-one.png' });
    await F.evaluate(id => document.querySelector('#cr_rows [data-crdet="' + id + '"]').click(), id2); await wait(300);
    ok('   "Hide details" closes it', await F.evaluate(id => !document.querySelector('#cr_rows tr.cr-detrow[data-for="' + id + '"]'), id2));
    await F.evaluate(() => $('cr_det_all').click());
    await F.waitForFunction(() => document.querySelectorAll('#cr_rows tr.cr-detrow').length === document.querySelectorAll('#cr_rows [data-crdet]').length && [...document.querySelectorAll('#cr_rows tr.cr-detrow')].every(r => r.querySelector('.cr-det')), { timeout: 30000 });
    const all = await F.evaluate(id => ({ n: document.querySelectorAll('#cr_rows tr.cr-detrow .cr-det').length, one: document.querySelector('#cr_rows tr.cr-detrow[data-for="' + id + '"]').textContent, btn: $('cr_det_all').textContent }), id1);
    ok('   "Details of all": every entry open – the single issue with Litres 120, KM reading 5120, Driver, Remark; the button says "Hide all details"',
      all.n >= 2 && /Litres120/.test(all.one) && /KM reading5120/.test(all.one) && /Ramesh 147/.test(all.one) && /night trip/.test(all.one) && all.btn === 'Hide all details', all);
    await p.screenshot({ path: 'shots/147-details-all.png', fullPage: true });
    // ---- 3. bulk: each ticked entry in full in the question ----
    await F.evaluate(ids => ids.forEach(id => { const c = document.querySelector('#cr_rows .cr-tick[data-id="' + id + '"]'); if (c) c.checked = true; }), [id1, id2]);
    await F.evaluate(() => $('cr_bulk_ok').click());
    await F.waitForFunction(() => { const m = document.querySelector('.cr-bulkdet'); return m && m.querySelectorAll('.cr-det').length >= 2; }, { timeout: 30000 });
    const q = await F.evaluate(() => { const m = document.querySelector('.cr-bulkdet'); return { n: m.querySelectorAll('.cr-det').length, text: m.textContent }; });
    ok('3. "Approve ticked": the question shows EACH ticked entry in full (both, with their fields and rows) before he decides',
      q.n === 2 && q.text.includes(id1) && q.text.includes(id2) && /Ramesh 147/.test(q.text) && /Suresh 147/.test(q.text), q);
    await wait(600); await p.screenshot({ path: 'shots/147-bulk-question.png' });      // (after the question has faded in)
    await F.evaluate(() => { $('cf_ok').click(); });
    await F.waitForFunction(() => /2 done/.test((document.getElementById('toast') || {}).textContent || ''), { timeout: 60000 }).catch(() => {});
    ok('   he approves – both saved as the maker\'s', sql("select count(*) from diesel_issue where machinery = 'VF147-1'") === '3', sql("select qty, entered_by from diesel_issue where machinery = 'VF147-1'"));
    // ---- 4. phone ----
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); await wait(800);      // (isMobile would load the page again)
    await F.evaluate(() => { $('cr_all').checked = true; crDraw(); });
    await F.evaluate(id => { const b0 = document.querySelector('#cr_rows [data-crdet="' + id + '"]'); if (b0 && b0.textContent === 'Details') b0.click(); }, id2);
    await F.waitForFunction(id => { const r = document.querySelector('#cr_rows tr.cr-detrow[data-for="' + id + '"]'); return r && !r.hidden && r.querySelector('.cr-det'); }, { timeout: 30000 }, id2);
    const fit = await F.evaluate(() => ({ page: document.documentElement.scrollWidth - innerWidth }));
    ok('4. phone size: the page does not get wider (the table scrolls inside its box)', fit.page <= 0, fit);
    await F.evaluate(id => document.querySelector('#cr_rows tr.cr-detrow[data-for="' + id + '"]').scrollIntoView(), id2); await wait(300);
    await p.screenshot({ path: 'shots/147-details-phone.png' });
    ok('no script error on the page', errs.length === 0, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
