/* update-114 – verification of every work, through the server's own door (/api/rpc) on the local rig started with PORTAL=1:
 *   :3001 = the app's own sign-in (the maker, the checker, Sujit as Admin), :3000 = linked to the Portal :3010 (the Super Admin's
 *   ticket), database rcl. Test data only (users, vendors, a machinery, diesel of "VF114"), all taken out at the end; the rules
 *   of the site are put back as they were.      node test/flow114api.js
 * Checks against the REAL database: an entry under a rule is checked, then sent – NOTHING of it is written (no vendor, no
 * diesel, no number used up); the same save sent again with the same save number is told the same words (never "saved");
 * level 1 → level 2 → saved at the last approval as the maker's own; the maker cannot approve his own; a reason is needed to
 * reject; several at once; diesel waiting is held back from the stock; the live-sync version "flow" moves. */
const { execSync } = require('child_process');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!';
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = async (base, body) => { const r = await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); return r.json(); };
let n = 0; const rid = () => 'vf114' + Date.now().toString(36) + (n++);
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => {
    sql("delete from vendors where vendor_name like 'VF114 %'; delete from diesel_issue where machinery = 'VF114-1'; delete from diesel_inward where bill_number = 'VF114'; delete from master where id = 'VF114-1';" +
      "delete from billed_changes where kind = 'Flow' and id like 'VF-%'; delete from app_users where email in ('mk114@rcl.test', 'ck114@rcl.test');" +
      (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
      "update vendors set updated_at = now() + interval '1 second' where false; delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  };
  try {
    cleanup();
    // ---- two users of this test (the password of the rig's Sujit): a maker (Vendor Master / Diesel Issue: Edit) and a checker (no page) ----
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_vendor_master, perm_diesel_issue, perm_master) select 'mk114', 'mk114@rcl.test', password_hash, 'Maker 114', 'Yes', 'No', 'Edit', 'Edit', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck114', 'ck114@rcl.test', password_hash, 'Checker 114', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    await wait(1500);
    const signIn = async e => { const a = await post(U, { fn: 'login', args: [e, PW] }); return a.result && a.result.token; };
    const mk = await signIn('mk114@rcl.test'), ck = await signIn('ck114@rcl.test'), su = await signIn('sujit@rcl.test');
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' });
    const ticket = (go.headers.get('location') || '').split('#sso=')[1] || '';
    const ss = await post(SA, { fn: 'ssoLogin', args: [ticket] }); const sa = ss.result && ss.result.token;
    ok('signed in: maker, checker, Sujit (Admin) at :3001; the Super Admin through the Portal at :3000', !!(mk && ck && su && sa), { mk: !!mk, ck: !!ck, su: !!su, sa: ss.error || !!sa });
    const api = async (base, tok, fn, a, r) => { const b = { fn: 'api', args: [tok, fn, a || []] }; if (r) b.rid = r; const x = await post(base, b); return x.error ? { ERROR: x.error } : x.result; };
    const M = (fn, ...a) => api(U, mk, fn, a, rid()), C = (fn, ...a) => api(U, ck, fn, a, rid()), S = (fn, ...a) => api(SA, sa, fn, a, rid()), J = (fn, ...a) => api(U, su, fn, a, rid());
    // ---- the rules: only the Super Admin ----
    let r = await J('saveFlowRules', { tasks: {} });
    ok('Sujit (Admin, not the Super Admin) cannot set the rules', /Only the Super Admin sets the verification rules/.test(r.ERROR || ''), r);
    r = await S('saveFlowRules', { remindHours: 4, tasks: { 'Vendor Master': { on: true, levels: [['ck114@rcl.test'], ['sujit@rcl.test']] }, 'Diesel Issue': { on: true, levels: [['ck114@rcl.test']], qtyAbove: '50' } } });
    ok('the Super Admin sets: Vendor Master → Checker 114, then Sujit; Diesel Issue above 50 L → Checker 114', r.ok && r.rules.tasks['Diesel Issue'].qtyAbove === 50, r);
    const fr = await S('getFlowRules');
    ok('   the rules page: every work with a save, the users of this site', fr.tasks && fr.tasks.length >= 10 && fr.users.some(u => u.email === 'ck114@rcl.test'), (fr.tasks || []).map(t => t.m));
    // ---- a vendor: checked, then sent – nothing written ----
    const V = nm => ({ name: nm, gstReg: 'No', pan: 'ABCPV1114A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' });
    const vSync0 = (await M('sync', {})).versions || {};
    const R1 = rid();
    r = await api(U, mk, 'saveVendor', [V('VF114 Alpha'), 'add'], R1);
    ok('the maker saves a vendor: "Sent for verification to Checker 114 (level 1 of 2) – VF-…"', /^Sent for verification to Checker 114 \(level 1 of 2\) – VF-\d{5}\. It is saved when it is approved/.test(r.ERROR || ''), r);
    const vf1 = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('   NOTHING in the database: no vendor; the request kept (Pending, level 1)', sql("select count(*) from vendors where vendor_name = 'VF114 Alpha'") === '0' && sql("select status || '|' || (data::jsonb->>'level') from billed_changes where id = '" + vf1 + "'") === 'Pending|0', sql("select status, data from billed_changes where id = '" + vf1 + "'"));
    r = await api(U, mk, 'saveVendor', [V('VF114 Alpha'), 'add'], R1);
    ok('   the same save sent again (same number): the same words – never "saved"; still one request', /^Sent for verification to Checker 114/.test(r.ERROR || '') && sql("select count(*) from billed_changes where kind = 'Flow' and summary like '%VF114 Alpha%'") === '1', r);
    ok('   the number is closed in the database with those words (nothing follows a save)', /"__refused":"Sent for verification/.test(sql("select result from web.ops where rid = '" + R1 + "'")) && sql("select closed_at is not null from web.ops where rid = '" + R1 + "'") === 't', sql("select state, closed_at, left(result, 120) from web.ops where rid = '" + R1 + "'"));
    const vSync1 = (await M('sync', {})).versions || {};
    ok('   every open page hears of it: the live-sync version "flow" moved', vSync1.flow && vSync1.flow !== vSync0.flow, { before: vSync0.flow, after: vSync1.flow });
    // ---- who sees it, who decides ----
    const lst = async f => (await f('getChangeRequests', {})).requests || [];
    let q = (await lst(M)).find(x => x.id === vf1);
    ok('the maker sees it waiting (level 1 of 2, for Checker 114) – no Approve for him', q && q.status === 'Pending' && q.level === 1 && q.levels === 2 && q.waitingFor.join() === 'Checker 114' && !q.canDecide, q);
    q = (await lst(C)).find(x => x.id === vf1);
    ok('the checker sees it, may decide', q && q.canDecide, q);
    r = await J('decideChangeRequest', { id: vf1, approve: true });
    ok('Sujit (level 2) cannot approve before level 1', /not waiting for you \(level 1: Checker 114\)/.test(r.ERROR || ''), r);
    r = await C('decideChangeRequest', { id: vf1, approve: false });
    ok('a reject needs a reason', /Write why it is rejected/.test(r.ERROR || ''), r);
    r = await C('decideChangeRequest', { id: vf1, approve: true, note: 'checked' });
    ok('level 1 approves → level 2 (still nothing written)', r.status === 'Pending' && r.level === 2 && sql("select count(*) from vendors where vendor_name = 'VF114 Alpha'") === '0', r);
    r = await J('decideChangeRequest', { id: vf1, approve: true });
    ok('level 2 (Sujit) approves → SAVED now, as the maker\'s own entry', r.status === 'Approved' && sql("select count(*) from vendors where vendor_name = 'VF114 Alpha'") === '1', r);
    ok('   the Activity Log names the maker for the vendor; the request Approved', sql("select string_agg(distinct name, ',') from activity_log where module = 'Vendor Master' and (record_id ilike '%VF114 Alpha%' or summary ilike '%VF114 Alpha%')") === 'Maker 114' &&
      sql("select status from billed_changes where id = '" + vf1 + "'") === 'Approved', sql("select name, module, record_id, summary from activity_log where summary ilike '%VF114 Alpha%' or record_id ilike '%VF114 Alpha%'"));
    // ---- the Super Admin: his own save at once; he may decide any level ----
    r = await S('saveVendor', V('VF114 Super'), 'add');
    ok('the Super Admin\'s own vendor is saved at once', r.ok && sql("select count(*) from vendors where vendor_name = 'VF114 Super'") === '1', r);
    // ---- several at once ----
    const a1 = await M('saveVendor', V('VF114 Bulk A'), 'add'), a2 = await M('saveVendor', V('VF114 Bulk B'), 'add');
    const ids = [a1, a2].map(x => ((x.ERROR || '').match(/VF-\d{5}/) || [])[0]);
    r = await C('decideChangeRequests', { ids: ids, approve: true });
    ok('the checker approves two at once → both at level 2', r.done && r.done.length === 2 && r.done.every(d => d.status === 'Pending'), r);
    r = await S('decideChangeRequests', { ids: ids, approve: false });
    ok('   rejecting several needs a reason too (each one refused)', r.failed && r.failed.length === 2 && /Write why/.test(r.failed[0].error), r);
    r = await S('decideChangeRequests', { ids: ids, approve: true });
    ok('   the Super Admin approves both (level 2) → both saved', r.done && r.done.every(d => d.status === 'Approved') && sql("select count(*) from vendors where vendor_name like 'VF114 Bulk %'") === '2', r);
    // ---- maker-checker: the maker on the level cannot approve his own ----
    r = await S('saveFlowRules', { remindHours: 4, tasks: { 'Vendor Master': { on: true, levels: [['mk114@rcl.test', 'ck114@rcl.test']] }, 'Diesel Issue': { on: true, levels: [['ck114@rcl.test']], qtyAbove: '50' } } });
    const own = await M('saveVendor', V('VF114 Own'), 'add'), vfo = ((own.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('the maker on the level: sent to the OTHER person of the level only', /^Sent for verification to Checker 114 – VF-/.test(own.ERROR || ''), own);
    r = await M('decideChangeRequest', { id: vfo, approve: true });
    ok('   he cannot approve his own entry', /You cannot approve your own entry/.test(r.ERROR || ''), r);
    r = await C('decideChangeRequest', { id: vfo, approve: false, note: 'no such vendor' });
    ok('   the checker rejects with a reason → not saved', r.status === 'Rejected' && sql("select count(*) from vendors where vendor_name = 'VF114 Own'") === '0', r);
    // ---- diesel: above 50 L sent; the litres held back from the stock while they wait ----
    r = await J('saveMaster', { no: 'VF114-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 2000, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const today = (await J('getInit')).today;
    const w = await J('saveInward', { date: today, location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 92, billNo: 'VF114', billDate: today });
    ok('seed (Sujit): machinery VF114-1, 1000 L into the Dispenser today', r.ok && w.ok, [r, w]);
    const issue = q2 => ({ date: today, shift: 'Day', source: 'Dispenser', no: 'VF114-1', qty: q2, kmReading: 1000 + q2, force: true });
    const cnt0 = sql("select count(*) from diesel_issue");
    r = await M('saveDieselIssue', issue(999999));
    const avail = Number(((r.ERROR || '').match(/Available: ([\d.]+) Ltr/) || [])[1]);
    ok('an issue more than the stock: refused as a save (not sent)', /^Not enough diesel at Dispenser/.test(r.ERROR || '') && !/waits for verification/.test(r.ERROR) && sql("select count(*) from billed_changes where kind = 'Flow' and status = 'Pending'") === '0', r);
    r = await M('saveDieselIssue', issue(40));
    ok('40 L (not above 50): saved at once', r.ok && r.id, r);
    r = await M('saveDieselIssue', issue(300));
    const vfd = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('300 L: sent for verification; nothing more in the diesel issues', /^Sent for verification to Checker 114 – VF-/.test(r.ERROR || '') && sql("select count(*) from diesel_issue") === String(Number(cnt0) + 1), r);
    r = await M('saveDieselIssue', issue(999999));
    const avail2 = Number(((r.ERROR || '').match(/Available: ([\d.]+) Ltr/) || [])[1]);
    ok('   the 300 L are held back: available is 300 less, and it says so', /\(300 Ltr more waits for verification\)/.test(r.ERROR || '') && Math.abs(avail - 40 - 300 - avail2) < 0.01, { avail, avail2, e: r.ERROR });
    r = await C('decideChangeRequest', { id: vfd, approve: true });
    ok('the checker approves → the 300 L issue is saved (as the maker\'s)', r.status === 'Approved' && sql("select count(*) from diesel_issue where machinery = 'VF114-1'") === '2' && sql("select entered_by from diesel_issue where machinery = 'VF114-1' and qty = 300") === 'Maker 114', [r, sql("select qty, entered_by from diesel_issue where machinery = 'VF114-1'")]);
    r = await M('saveDieselIssue', issue(999999));
    ok('   nothing held back any more', !/waits for verification/.test(r.ERROR || ''), r);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 600)); }
  finally { try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
