// update-114 (verification of every work) in the browser, on the local rig started with PORTAL=1 (Mechanical :3001 own sign-in,
// :3000 linked to the Portal :3010; site S1). Test data only (two users, a machinery, diesel of "VF114"), all taken out at the end;
// the site's rules are put back as they were.
//   1. the Super Admin (Portal ticket) opens Approvals → "Verification rules": every work; he switches Diesel Issue on with
//      Checker 114 at level 1 and saves;
//   2. the maker saves a diesel issue in the form: the message is "Sent for verification …" (not red), the form is emptied,
//      nothing is saved; his Approvals shows it waiting;
//   3. the checker's page, open the whole time, shows it by itself (no reload): "Approvals (1)", the row with a tick box;
//   4. the checker ticks it and presses "Approve ticked": saved; the maker's page shows "Approved" by itself.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node flow114.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from diesel_issue where machinery = 'VF114-1'; delete from diesel_inward where bill_number = 'VF114'; delete from master where id = 'VF114-1';" +
    "delete from billed_changes where kind = 'Flow' and id like 'VF-%'; delete from app_users where email in ('mk114@rcl.test', 'ck114@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const errs = [];
  let b = null;
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue, perm_master) select 'mk114', 'mk114@rcl.test', password_hash, 'Maker 114', 'Yes', 'No', 'Edit', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck114', 'ck114@rcl.test', password_hash, 'Checker 114', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    const su = (await post(U, { fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const J = async (fn, ...a) => { const r = await post(U, { fn: 'api', args: [su, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J('getInit')).today;
    const s1 = await J('saveMaster', { no: 'VF114-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 2000, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const s2 = await J('saveInward', { date: today, location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 92, billNo: 'VF114', billDate: today });
    ok('seed: machinery VF114-1, 1000 L in the Dispenser; users Maker 114 (Diesel Issue: Edit) and Checker 114 (no page)', s1.ok && s2.ok, [s1, s2]);

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const open = async (url, email) => {
      const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(email + ': ' + String(e.message).slice(0, 200)));
      await p.goto(url, { waitUntil: 'load' });
      let F = null;
      const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
      if (email) { const f = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
        await f.type('#lg_email', email); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(6000); }
      F = await find(() => typeof S === 'object' && !!S.user);
      try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); } catch (e) {}
      return { p, F };
    };
    // ---- 1. the Super Admin: the rules ----
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' });
    const ticket = (go.headers.get('location') || '').split('#sso=')[1] || '';
    const A = await open(SA + '/#sso=' + ticket, null);
    await A.F.evaluate(() => showTab('approvals')); await wait(3000);
    const rp = await A.F.evaluate(() => ({ shown: !$('fr_panel').hidden, tasks: [...document.querySelectorAll('#fr_list .fr-task')].map(x => x.dataset.m), users: [...document.querySelectorAll('#fr_list .fr-task[data-m="Diesel Issue"] .fr-level label')].map(l => l.textContent.trim()), qty: !!document.querySelector('#fr_list .fr-task[data-m="Diesel Issue"] .fr-qty'), qtyV: !!document.querySelector('#fr_list .fr-task[data-m="Vendor Master"] .fr-qty') }));
    ok('1. the Super Admin: Approvals → "Verification rules" with every work (' + rp.tasks.length + '), the users of the site, litres only for diesel', rp.shown && rp.tasks.includes('Diesel Issue') && rp.tasks.includes('Log Book') && rp.tasks.includes('Vendor Master') && rp.users.includes('Checker 114') && rp.qty && !rp.qtyV, rp);
    await A.F.evaluate(() => { const t = document.querySelector('#fr_list .fr-task[data-m="Diesel Issue"]'); t.querySelector('.fr-on').click(); [...t.querySelectorAll('.fr-level input')].find(c => c.value === 'ck114@rcl.test').click(); t.querySelector('.fr-qty').value = '50'; });
    await A.F.evaluate(() => { const t = document.querySelector('#fr_list .fr-task[data-m="Diesel Issue"]'); t.querySelector('.fr-add').click(); });
    const lv = await A.F.evaluate(() => [...document.querySelectorAll('#fr_list .fr-task[data-m="Diesel Issue"] .fr-level > b')].map(x => x.textContent));
    await A.F.evaluate(() => { const t = document.querySelector('#fr_list .fr-task[data-m="Diesel Issue"]'); t.querySelectorAll('.fr-del')[1].click(); });
    const lv2 = await A.F.evaluate(() => document.querySelectorAll('#fr_list .fr-task[data-m="Diesel Issue"] .fr-level').length);
    ok('   "+ add a level" adds Level 2; "remove level" takes it out', lv.join() === 'Level 1,Level 2' && lv2 === 1, { lv, lv2 });
    await A.F.evaluate(() => $('fr_save').click()); await wait(3500);
    const saved = await A.F.evaluate(() => $('toast').textContent);
    const kept = JSON.parse(sql("select value from app_settings where id = 'FLOW_RULES'") || '{}');
    ok('   saved: "' + saved + '"; Diesel Issue on, Checker 114, above 50 L', /Verification rules saved/.test(saved) && kept.tasks['Diesel Issue'].on === true && JSON.stringify(kept.tasks['Diesel Issue'].levels) === '[["ck114@rcl.test"]]' && kept.tasks['Diesel Issue'].qtyAbove === 50, kept);
    // ---- 3 (opened first). the checker's page, left open on Approvals ----
    const C = await open(U + '/', 'ck114@rcl.test');
    await C.F.evaluate(() => showTab('approvals')); await wait(2500);
    const c0 = await C.F.evaluate(() => ({ label: $('tab-approvals').textContent.trim(), rows: document.querySelectorAll('#cr_rows .cr-tick').length, rules: !$('fr_panel').hidden }));
    ok('the checker (no page of his own) has Approvals; nothing for him yet; no rules panel', /Approvals$/.test(c0.label) && c0.rows === 0 && !c0.rules, c0);
    // ---- 2. the maker saves a diesel issue in the form ----
    const Mk = await open(U + '/', 'mk114@rcl.test');
    await Mk.F.evaluate(() => showTab('diesel')); await wait(2500);
    await Mk.F.evaluate(() => { const set = (id, v) => { const x = $(id); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }; set('d_no', 'VF114-1'); });
    await wait(1500);
    await Mk.F.evaluate(() => { const set = (id, v) => { const x = $(id); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }; set('d_qty', '300'); if ($('d_km')) set('d_km', '1300'); });
    const n0 = sql("select count(*) from diesel_issue where machinery = 'VF114-1'");
    await Mk.F.click('#d_save'); await wait(2500);
    for (let i = 0; i < 3; i++) { const open1 = await Mk.F.evaluate(() => { if (!$('cf_back').hidden) { $('cf_ok').click(); return true; } return false; }); if (!open1) break; await wait(2500); }
    const m1 = await Mk.F.evaluate(() => ({ toast: $('toast').textContent, bad: $('toast').className, qty: $('d_qty').value, no: $('d_no').value }));
    ok('2. the maker saves 300 L: "' + m1.toast.slice(0, 90) + '…" – not red; the form is emptied', /^Sent for verification to Checker 114 – VF-\d{5}/.test(m1.toast) && m1.bad !== 'bad' && m1.qty === '' && m1.no === '', m1);
    ok('   nothing saved in the diesel issues', sql("select count(*) from diesel_issue where machinery = 'VF114-1'") === n0);
    await Mk.F.evaluate(() => showTab('approvals')); await wait(2500);
    const m2 = await Mk.F.evaluate(() => ({ dash: $('cr_dash').textContent.replace(/\s+/g, ' '), rows: [...document.querySelectorAll('#cr_rows tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()), ticks: document.querySelectorAll('#cr_rows .cr-tick').length }));
    ok('   his Approvals: "Your entries waiting 1"; the row: Diesel Issue, waiting at level 1 of 1 for Checker 114; no tick box for him', /Your entries waiting\s*1/.test(m2.dash) && m2.rows.length === 1 && /Diesel Issue/.test(m2.rows[0]) && /Waiting/.test(m2.rows[0]) && /level 1 of 1: Checker 114/.test(m2.rows[0]) && m2.ticks === 0, m2);
    // ---- 3. the checker's page by itself ----
    let c1 = null; for (let i = 0; i < 30; i++) { await wait(1000); c1 = await C.F.evaluate(() => ({ label: $('tab-approvals').textContent.trim(), ticks: document.querySelectorAll('#cr_rows .cr-tick').length, dash: $('cr_dash').textContent.replace(/\s+/g, ' '), bulk: !$('cr_bulk_ok').hidden })); if (c1.ticks) break; }
    ok('3. the checker\'s open page shows it BY ITSELF (no reload): "Approvals (1)", a tick box, "Waiting for you 1", "Approve ticked"', /Approvals \(1\)/.test(c1.label) && c1.ticks === 1 && /Waiting for you\s*1/.test(c1.dash) && c1.bulk, c1);
    // ---- 4. approve ticked ----
    await C.F.evaluate(() => { $('cr_tickall').click(); }); await C.F.click('#cr_bulk_ok'); await wait(1200);
    const ask = await C.F.evaluate(() => $('cf_box').textContent.replace(/\s+/g, ' ').slice(0, 300));
    await C.F.evaluate(() => { $('cf_ok').click(); }); await wait(4000);
    const c2 = await C.F.evaluate(() => ({ toast: $('toast').textContent, label: $('tab-approvals').textContent.trim() }));
    ok('4. the checker ticks it, "Approve ticked" → "1 done"; saved as the maker\'s', /Approve 1 request/.test(ask) && /^1 done\.$/.test(c2.toast) && sql("select count(*) || '|' || max(entered_by) from diesel_issue where machinery = 'VF114-1'") === (Number(n0) + 1) + '|Maker 114', { ask, c2, db: sql("select qty, entered_by from diesel_issue where machinery = 'VF114-1'") });
    let m3 = null; for (let i = 0; i < 30; i++) { await wait(1000); m3 = await Mk.F.evaluate(() => [...document.querySelectorAll('#cr_rows tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim())); if (m3.some(t => /Approved/.test(t)) || !m3.some(t => /Waiting/.test(t))) break; }
    await Mk.F.evaluate(() => { $('cr_all').click(); }); await wait(500);
    const m4 = await Mk.F.evaluate(() => [...document.querySelectorAll('#cr_rows tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()));
    ok('   the maker\'s open page: no longer waiting, by itself; with "Show approved…" it says Approved by Checker 114', !m3.some(t => /Waiting/.test(t)) && m4.some(t => /Approved/.test(t) && /Checker 114/.test(t)), { m3, m4 });
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
