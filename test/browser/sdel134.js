// update-134 (asked 19-10-2026: "super admin user ni kelelI konti hi entry mg ti save aso approval madhe aso ki retuen aso ki reject aso
// konti hi entry delet kru shakel … single date or ya period wise") – in the browser, on the local rig only (PORTAL=1 bash rig/all.sh:
// Mechanical :3001 own sign-in, :3000 linked to the Portal :3010; site S1). Test data only (users mk134 / ck134, machinery SX134-1, its
// diesel, its requests and deleted entries), all taken out at the end; the verification rules put back as they were.
//   1. seed: SX134-1, 1000 L; two saved issues of today (10 L, 20 L); Diesel Issue goes to verification (Checker 134); Maker 134 sends
//      one more (5 L) → waiting;
//   2. the Super Admin (Portal ticket) → Diesel Issue → "Delete entries – Super Admin": today → the 2 saved + the 1 waiting;
//   3. ticks the 10 L entry and the waiting request → Delete ticked → OK: out of the diesel and Approvals, kept in Deleted entries;
//   4. Deleted entries: both → Bring back ticked → the same entry (its ID) and the request waiting again;
//   5. an Admin who is not the Super Admin (own sign-in): no such panel. Picture: test/shots/sdel134.png.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node sdel134.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1500) : '')); };
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from diesel_issue where machinery = 'SX134-1'; delete from diesel_inward where bill_number = 'SX134'; delete from master where id = 'SX134-1';" +
    "delete from billed_changes where machinery like '%SX134-1%'; delete from app_users where email in ('mk134@rcl.test', 'ck134@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const errs = [];
  let b = null;
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue, perm_master) select 'mk134', 'mk134@rcl.test', password_hash, 'Maker 134', 'Yes', 'No', 'Edit', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck134', 'ck134@rcl.test', password_hash, 'Checker 134', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    const su = (await post(U, { fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const J = async (tok, fn, ...a) => { const r = await post(U, { fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J(su, 'getInit')).today;
    const s1 = await J(su, 'saveMaster', { no: 'SX134-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 2000, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const s2 = await J(su, 'saveInward', { date: today, location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 92, billNo: 'SX134', billDate: today });
    const e1 = await J(su, 'saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'SX134-1', qty: 10, kmReading: 100 });
    const e2 = await J(su, 'saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'SX134-1', qty: 20, kmReading: 200 });
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const open = async (url, email) => {
      const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1000 }); p.on('pageerror', e => errs.push((email || 'SA') + ': ' + String(e.message).slice(0, 200)));
      await p.goto(url, { waitUntil: 'load' });
      const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
      if (email) { const f = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
        await f.type('#lg_email', email); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(6000); }
      const F = await find(() => typeof S === 'object' && !!S.user);
      try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const a = document.getElementById('ai_panel'); if (a) a.hidden = true; }); } catch (e) {}
      return { p, F };
    };
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' });
    const A = await open(SA + '/#sso=' + ((go.headers.get('location') || '').split('#sso=')[1] || ''), null);
    const rule = await A.F.evaluate(() => call('saveFlowRules', { tasks: { 'Diesel Issue': { on: true, levels: [['ck134@rcl.test']] } } }));
    const mk = (await post(U, { fn: 'login', args: ['mk134@rcl.test', PW] })).result.token;
    const sent = await J(mk, 'saveDieselBulk', { date: today, shift: 'Day', source: 'Dispenser', rows: [{ no: 'SX134-1', qty: '5', kmReading: '300', hrReading: '', driver: '', remark: '' }] });
    const vf = (String(sent.ERROR || '').match(/VF-\d{5}/) || [''])[0];
    ok('1. seed: SX134-1, 1000 L; two saved issues of today (' + (e1.id || '?') + ' 10 L, ' + (e2.id || '?') + ' 20 L); Maker 134\'s 5 L waits for verification (' + vf + ')',
      s1.ok && s2.ok && e1.ok && e2.ok && rule && rule.ok && /^Sent for verification/.test(String(sent.ERROR || '')) && !!vf, { s1, s2, e1, e2, rule, sent });
    // ---- 2. the Super Admin: the panel, today ----
    await A.F.evaluate(() => showTab('diesel')); await wait(2500);
    const shown = await A.F.evaluate(() => !$('sx_panel').hidden);
    await A.F.evaluate(d => { $('sx_from').value = d; $('sx_to').value = ''; $('sx_no').value = 'SX134-1'; $('sx_show').click(); }, today); await wait(3000);
    const L1 = await A.F.evaluate(() => ({ s: [...document.querySelectorAll('#sx_out input.sx-s')].map(x => x.value), f: [...document.querySelectorAll('#sx_out input.sx-f')].map(x => x.value), d: document.querySelectorAll('#sx_out input.sx-d').length, by: [...$('sx_by').options].map(o => o.value) }));
    ok('2. Super Admin → Diesel Issue → "Delete entries – Super Admin" (shown): today, SX134-1 → the 2 saved + the 1 waiting, nothing deleted yet; "Entered by" lists who entered them',
      shown && L1.s.join() === [e1.id, e2.id].join() && L1.f.join() === vf && L1.d === 0 && L1.by.includes('Maker 134'), L1);
    // ---- 3. tick the 10 L entry and the request → Delete ticked ----
    await A.F.evaluate((a, v) => { document.querySelector('#sx_out input.sx-s[value="' + a + '"]').click(); document.querySelector('#sx_out input.sx-f[value="' + v + '"]').click(); }, e1.id, vf);
    const btn = await A.F.evaluate(() => $('sx_del').textContent);
    await A.F.evaluate(() => $('sx_del').click()); await wait(1200);
    const dlg = await A.F.evaluate(() => $('cf_title').textContent);
    await A.F.evaluate(() => $('cf_ok').click()); await wait(4000);
    const toast1 = await A.F.evaluate(() => $('toast').textContent);
    const db1 = { issues: sql("select string_agg(id, ',' order by id) from diesel_issue where machinery = 'SX134-1'"), flow: sql("select kind from billed_changes where id = '" + vf + "'"), kept: sql("select count(*) from billed_changes where kind = 'Deleted' and machinery like '%SX134-1%' and status = 'Deleted'") };
    await A.F.evaluate(() => { const ai = document.getElementById('ai_panel'); if (ai) ai.hidden = true; $('sx_panel').scrollIntoView({ block: 'start' }); }); await wait(500);
    await A.p.screenshot({ path: SHOTS + 'sdel134.png' });
    ok('3. ticked ' + e1.id + ' and ' + vf + ' → "' + btn + '" → "' + dlg + '" → OK: "' + toast1.slice(0, 90) + '…" – out of the diesel and Approvals, both kept in Deleted entries',
      btn === 'Delete ticked (2)' && dlg === 'Delete 2 entries?' && /^2 entries deleted – kept in Deleted entries/.test(toast1) && db1.issues === e2.id && db1.flow === 'Flow Deleted' && db1.kept === '2', db1);
    // ---- 4. Deleted entries → Bring back ticked ----
    const L2 = await A.F.evaluate(() => ({ s: [...document.querySelectorAll('#sx_out input.sx-s')].map(x => x.value), f: document.querySelectorAll('#sx_out input.sx-f').length, d: [...document.querySelectorAll('#sx_out input.sx-d')].map(x => x.closest('tr').children[2].textContent) }));
    await A.F.evaluate(() => { document.querySelector('#sx_out input.sx-all[data-all="sx-d"]').click(); });
    await A.F.evaluate(() => $('sx_back').click()); await wait(1200);
    const dlg2 = await A.F.evaluate(() => $('cf_title').textContent);
    await A.F.evaluate(() => $('cf_ok').click()); await wait(4000);
    const toast2 = await A.F.evaluate(() => $('toast').textContent);
    const db2 = { issues: sql("select string_agg(id || ':' || qty::text, ',' order by id) from diesel_issue where machinery = 'SX134-1'"), flow: sql("select kind || ':' || status from billed_changes where id = '" + vf + "'"), kept: sql("select count(*) from billed_changes where kind = 'Deleted' and machinery like '%SX134-1%' and status = 'Restored'") };
    ok('4. the list then: ' + JSON.stringify(L2) + '; Deleted entries both ticked → "' + dlg2 + '" → "' + toast2.slice(0, 80) + '" – ' + e1.id + ' back with its 10 L, ' + vf + ' waiting again',
      L2.s.join() === e2.id && L2.f === 0 && L2.d.sort().join() === [e1.id, vf].sort().join() && dlg2 === 'Bring back 2 entries?' && /^2 entries brought back/.test(toast2) &&
      db2.issues === [e1.id + ':10', e2.id + ':20'].join() && db2.flow === 'Flow:Pending' && db2.kept === '2', db2);
    // ---- 5. an Admin who is not the Super Admin ----
    const Ad = await open(U + '/', 'sujit@rcl.test');
    await Ad.F.evaluate(() => showTab('diesel')); await wait(1500);
    const hid = await Ad.F.evaluate(() => $('sx_panel').hidden);
    const refused = await J(su, 'superDelList', { from: today });
    ok('5. an Admin who is not the Super Admin: no panel; the server refuses too', hid && /Only the Super Admin/.test(String(refused.ERROR || '')), { hid, refused });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the pages', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
