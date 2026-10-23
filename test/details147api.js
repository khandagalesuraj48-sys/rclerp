/* update-147 – an entry in Approvals in full ("Details"), through the server's own door (/api/rpc) on the local rig started with
 * PORTAL=1: :3001 = the app's own sign-in (a maker, a checker, an outsider, Sujit as Admin), :3000 = linked to the Portal :3010
 * (the Super Admin's ticket), database rcl. Test data only (users, a vendor, a machinery, diesel of "VF147"), all taken out at the
 * end; the rules of the site are put back as they were.      node test/details147api.js
 * Checks: the checker (his level) sees every field the maker sent, with its name; a Multiple-entries diesel issue as a table (each
 * row, each column, the machinery's name); several at once; the sender and the Super Admin see it too; a person of no level and a
 * wrong number get "not found"; it only reads – nothing is decided, nothing written.
 * (Its figures differ from test/browser/details147.js on purpose: the same entry sent again within seconds is "sent twice".)
 * update-148: an entry with photos – the pictures themselves (their names and links that open them), never their file names. */
const { execSync } = require('child_process'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!';
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = async (base, body) => { const r = await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); return r.json(); };
let n = 0; const rid = () => 'vf147' + Date.now().toString(36) + (n++);
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => {
    sql("delete from vendors where vendor_name like 'VF147 %'; delete from diesel_issue where machinery = 'VF147-1'; delete from diesel_inward where bill_number = 'VF147'; delete from master where id = 'VF147-1';" +
      "delete from billed_changes where kind = 'Flow' and (summary like '%VF147%' or args like '%VF147%'); delete from app_users where email in ('mk147@rcl.test', 'ck147@rcl.test', 'ot147@rcl.test');" +
      (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
      "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  };
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_vendor_master, perm_diesel_issue, perm_master) select 'mk147', 'mk147@rcl.test', password_hash, 'Maker 147', 'Yes', 'No', 'Edit', 'Edit', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck147', 'ck147@rcl.test', password_hash, 'Checker 147', 'Yes', 'No' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue) select 'ot147', 'ot147@rcl.test', password_hash, 'Other 147', 'Yes', 'No', 'View' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    await wait(1500);
    const signIn = async e => { const a = await post(U, { fn: 'login', args: [e, PW] }); return a.result && a.result.token; };
    const mk = await signIn('mk147@rcl.test'), ck = await signIn('ck147@rcl.test'), ot = await signIn('ot147@rcl.test'), su = await signIn('sujit@rcl.test');
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' });
    const ticket = (go.headers.get('location') || '').split('#sso=')[1] || '';
    const ss = await post(SA, { fn: 'ssoLogin', args: [ticket] }); const sa = ss.result && ss.result.token;
    ok('signed in: maker, checker, outsider, Sujit (Admin) at :3001; the Super Admin through the Portal at :3000', !!(mk && ck && ot && su && sa), { mk: !!mk, ck: !!ck, ot: !!ot, su: !!su, sa: ss.error || !!sa });
    const api = async (base, tok, fn, a) => { const x = await post(base, { fn: 'api', args: [tok, fn, a || []], rid: rid() }); return x.error ? { ERROR: x.error } : x.result; };
    const M = (fn, ...a) => api(U, mk, fn, a), C = (fn, ...a) => api(U, ck, fn, a), O = (fn, ...a) => api(U, ot, fn, a), S = (fn, ...a) => api(SA, sa, fn, a), J = (fn, ...a) => api(U, su, fn, a);
    let r = await S('saveFlowRules', { remindHours: 4, tasks: { 'Vendor Master': { on: true, levels: [['ck147@rcl.test']] }, 'Diesel Issue': { on: true, levels: [['ck147@rcl.test']] } } });
    ok('rules (Super Admin): Vendor Master and Diesel Issue → Checker 147', r.ok === true, r);
    // ---- a vendor: every field with its name ----
    r = await M('saveVendor', { name: 'VF147 Earthmovers', gstReg: 'No', pan: 'ABCPV1147A', bank: 'SBI', account: '12345147', ifsc: 'SBIN0000147', phone: '9800000147', address: 'Plot 7, Test Road' }, 'add');
    const v1 = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('the maker saves a vendor → sent for verification (' + v1 + ')', !!v1 && /^Sent for verification to Checker 147/.test(r.ERROR || ''), r);
    const sumBefore = sql("select summary from billed_changes where id = '" + v1 + "'");
    const list = await C('getChangeRequests', {});
    const inList = (list.requests || []).find(x => x.id === v1);
    ok('   the checker\'s list: one line (the short summary) – no details in the list itself', inList && inList.canDecide && !('args' in inList), inList);
    r = await C('approvalDetails', { ids: [v1] });
    const d1 = (r.details || [])[0] || {}, f1 = Object.fromEntries((d1.fields || []).map(f => [f[0], f[1]]));
    ok('the checker\'s Details: every field with its name (Name, PAN, Bank, Account No, IFSC, Phone, Address, GST registered), who sent it',
      f1.Name === 'VF147 Earthmovers' && f1.PAN === 'ABCPV1147A' && f1.Bank === 'SBI' && f1['Account No'] === '12345147' && f1.IFSC === 'SBIN0000147' && f1.Phone === '9800000147' && f1.Address === 'Plot 7, Test Road' && f1['GST registered'] === 'No' && d1.by === 'Maker 147' && d1.task === 'Vendor Master' && d1.action === 'Vendor' && f1['Sent as'] === 'add', d1);
    // ---- diesel: one entry, and Multiple entries by date (a table) ----
    r = await J('saveMaster', { no: 'VF147-1', name: 'Tipper 147', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 2000, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const today = (await J('getInit')).today;
    const w = await J('saveInward', { date: today, location: 'Dispenser', pump: 'Pump', qty: 1001, rate: 92, billNo: 'VF147', billDate: today });
    ok('seed (Sujit): machinery VF147-1 (Tipper 147), 1001 L into the Dispenser today', r.ok && w.ok, [r, w]);
    const cnt0 = sql('select count(*) from diesel_issue');
    r = await M('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'VF147-1', qty: 119, kmReading: 5119, driver: 'Ramesh 147', remark: 'night trip', force: true });
    const d2id = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('a diesel issue of 119 L → sent (' + d2id + ')', !!d2id, r);
    r = await M('saveDieselBulk', { date: today, shift: 'Night', source: 'Dispenser', rows: [{ line: 1, no: 'VF147-1', qty: 29, kmReading: 5199, driver: 'Suresh 147' }, { line: 2, no: 'VF147-1', qty: 24, kmReading: 5259, remark: 'second fill' }], force: true });
    const d3id = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('Multiple entries (2 rows) → sent (' + d3id + ')', !!d3id, r);
    r = await C('approvalDetails', { ids: [d2id, d3id, v1] });
    const [a2, a3, a1] = r.details || [];
    const f2 = Object.fromEntries(((a2 || {}).fields || []).map(f => [f[0], f[1]]));
    ok('several at once (bulk): the three, in the order asked; what each does in plain words', (r.details || []).map(d => d.id).join() === [d2id, d3id, v1].join() && r.details[0].action === 'New diesel issue – one entry' && r.details[1].action === 'New diesel issue – multiple entries', r);
    ok('   one diesel issue: Machinery with its name and type, Litres, KM reading, Driver, Remark, Date (dd-mm-yyyy), Shift, Diesel source',
      f2.Machinery === 'VF147-1 – Tipper 147 · Tipper' && f2.Litres === '119' && f2['KM reading'] === '5119' && f2.Driver === 'Ramesh 147' && f2.Remark === 'night trip' && f2.Date === today.split('-').reverse().join('-') && f2.Shift === 'Day' && f2['Diesel source'] === 'Dispenser' && !('force' in f2), a2);
    const t3 = ((a3 || {}).tables || [])[0] || {};
    ok('   Multiple entries: a table – one row per entry, every column (Machinery with its name, Litres, KM reading, Driver, Remark)',
      t3.rows && t3.rows.length === 2 && t3.cols.join('|') === '#|Machinery|Litres|KM reading|Driver|Remark' && t3.rows[0].join('|') === '1|VF147-1 – Tipper 147 · Tipper|29|5199|Suresh 147|' && t3.rows[1].join('|') === '2|VF147-1 – Tipper 147 · Tipper|24|5259||second fill', t3);
    ok('   …and its date, shift and source above the table', Object.fromEntries(((a3 || {}).fields || []).map(f => [f[0], f[1]])).Shift === 'Night', (a3 || {}).fields);
    ok('   the vendor too (a request of another work in the same call)', a1 && a1.task === 'Vendor Master', a1);
    // ---- (update-148) an entry with photos: the pictures, never their file names ----
    const TINY = fs.readFileSync(path.join(__dirname, 'photo85api.js'), 'utf8').match(/const TINY = '([^']+)'/)[1], pic = 'data:image/jpeg;base64,' + TINY;
    const ph1 = await M('dieselPhoto', { kind: 'dash', data: pic, lat: 19.99, lng: 73.78, acc: 12, at: new Date().toISOString(), no: 'VF147-1' });
    const ph2 = await M('dieselPhoto', { kind: 'pump', data: pic, lat: 19.99, lng: 73.78, acc: 12, at: new Date().toISOString(), no: 'VF147-1' });
    r = await M('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'VF147-1', qty: 41, kmReading: 5140, photos: [{ k: 'dash', p: ph1.path }, { k: 'pump', p: ph2.path }], force: true });
    const d4id = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('(update-148) a diesel issue with two photos (Dashboard, Dispenser litres) → sent (' + d4id + ')', ph1.ok && ph2.ok && !!d4id, [ph1, ph2, r]);
    r = await C('approvalDetails', { ids: [d4id] });
    const a4 = (r.details || [])[0] || {};
    ok('   the checker\'s Details: the two pictures with their names and a link that opens each one; no table of file names, no file name among the fields',
      (a4.pics || []).map(x => x.label).join('|') === 'Dashboard|Dispenser litres' && a4.pics.every(x => /^http.*\/storage\/v1\/object\/sign\/diesel-photos\//.test(x.url)) && a4.photos === 2 &&
      !(a4.tables || []).length && !JSON.stringify([a4.fields, a4.tables]).includes(ph1.path), a4);
    const img = await fetch(a4.pics[0].url, { signal: AbortSignal.timeout(30000) });
    ok('   the link opens the picture', img.status === 200 && (await img.arrayBuffer()).byteLength > 100, img.status);
    // ---- who may see it ----
    r = await M('approvalDetails', { ids: [d2id] });
    ok('the sender sees his own entry in full', ((r.details || [])[0] || {}).fields && !r.details[0].error, r);
    r = await S('approvalDetails', { ids: [d2id, d3id] });
    ok('the Super Admin sees them', (r.details || []).every(d => !d.error && d.fields.length), r);
    r = await O('approvalDetails', { ids: [d2id] });
    ok('a person of no level (Diesel Issue: View): "not found" – he does not see them in the list either', /not found/.test(((r.details || [])[0] || {}).error || '') && !((r.details || [])[0] || {}).fields, r);
    r = await C('approvalDetails', { ids: ['VF-99999'] });
    ok('a wrong number: "not found"', /not found/.test(((r.details || [])[0] || {}).error || ''), r);
    r = await C('approvalDetails', {});
    ok('no number: said', /Choose an entry/.test(r.ERROR || ''), r);
    // ---- it only reads ----
    ok('only read: all three still Pending, the same summary, nothing saved (no vendor, no new diesel issue)',
      sql("select string_agg(status, ',' order by id) from billed_changes where id in ('" + [v1, d2id, d3id].join("','") + "')") === 'Pending,Pending,Pending' && sql("select summary from billed_changes where id = '" + v1 + "'") === sumBefore &&
      sql("select count(*) from vendors where vendor_name = 'VF147 Earthmovers'") === '0' && sql('select count(*) from diesel_issue') === cnt0, sql("select id, status from billed_changes where id in ('" + [v1, d2id, d3id].join("','") + "')"));
    // ---- and the approval works as before ----
    r = await C('decideChangeRequests', { ids: [d2id, d3id], approve: true });
    ok('the checker approves the two diesel entries at once → saved as the maker\'s (3 issues)', (r.done || []).length === 2 && sql("select count(*) from diesel_issue where machinery = 'VF147-1'") === '3', r);
    r = await C('approvalDetails', { ids: [d2id] });
    ok('   an approved entry: its details still open (Approved)', ((r.details || [])[0] || {}).status === 'Approved', r);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 600)); }
  finally { try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
