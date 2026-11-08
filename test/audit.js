/* Audit checks against a local copy of the stack (PostgreSQL + PostgREST + two app servers on :3000 / :3001).
 * Nothing here touches the live database. Run:  node test/audit.js [section …]   (sections: auth brute backup diesel money) */
const fs = require('fs'), { execSync } = require('child_process');
const post = async (port, path, body) => { const t = Date.now(); const r = await fetch('http://127.0.0.1:' + port + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); let j; try { j = await r.json(); } catch (e) { j = { error: 'no JSON (' + r.status + ')' }; } j.ms = Date.now() - t; j.status = r.status; return j; };
const rpc = (port, fn, ...args) => post(port, '/api/rpc', { fn, args });
const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  → ' + String(extra).slice(0, 260) : '')); };
const ADMIN = ['sujit@rcl.test', 'Nashik#Road848!'];
const want = process.argv.slice(2), on = s => !want.length || want.indexOf(s) > -1;
const signIn = async (email, pw) => (await rpc(3000, 'login', email, pw));
const fnNames = () => { const s = fs.readFileSync(__dirname + '/../app/Code.gs', 'utf8'); const a = s.indexOf('const API_ = {'), b = s.indexOf('\n};', a); const out = []; s.slice(a, b).split('\n').forEach(l => { const m = /^\s{2}([A-Za-z]+):\s*\{(.*)\}/.exec(l); if (m) out.push({ fn: m[1], m: (/m: '([^']*)'/.exec(m[2]) || [])[1] || '', edit: /edit: true/.test(m[2]), admin: /admin: true/.test(m[2]), any: /any: \[/.test(m[2]) }); }); return out; };

(async () => {
  let r = await signIn(...ADMIN); const admin = r.result && r.result.token; ok('admin signs in', !!admin, r.error);
  const api = (token, fn, ...a) => rpc(3000, 'api', token, fn, a);
  const mods = sql("select string_agg(column_name, ',') from information_schema.columns where table_name = 'app_users' and column_name like 'perm_%'");
  // ---------- users for the tests (made through the app itself) ----------
  const mk = async (email, level) => { const init = await api(admin, 'usersAdmin'); const modules = (init.result && init.result.modules) || [];
    const perms = {}; modules.forEach(m => { perms[m.key || m] = level; });
    const exists = ((init.result && init.result.users) || []).some(u => u.email === email);
    const s = await api(admin, 'saveUserAdmin', { email, name: email.split('@')[0], active: true, admin: false, perms, isNew: !exists, newPassword: 'Temp#12345' });
    if (s.error) return { error: s.error };
    let l = await signIn(email, 'Temp#12345'); if (l.error) return { error: 'sign-in: ' + l.error };
    if (l.result.mustChange) { const c = await rpc(3000, 'changePassword', l.result.token, 'Temp#12345', 'Audit#Pass' + level + '9!x'); if (c.error) return { error: 'change: ' + c.error }; l = await signIn(email, 'Audit#Pass' + level + '9!x'); }
    return { token: l.result && l.result.token, modules: modules.length };
  };

  if (on('auth')) {
    console.log('\n=== AUTHORISATION (checked on the server, action by action) ===');
    const none = await mk('none@rcl.test', 'None'), view = await mk('view@rcl.test', 'View');
    ok('test users made (no access / view only)', none.token && view.token, none.error || view.error || (none.modules + ' modules'));
    const fns = fnNames(); ok('action list read from Code.gs', fns.length > 100, fns.length + ' actions');
    const denied = e => /do not have access|Only Admin|View access only/.test(e || '');
    let leaks = [], viewLeaks = [], noSession = [];
    for (const f of fns) {
      const a = await api(none.token, f.fn, {}); if (f.m || f.admin || f.any) { if (!denied(a.error)) leaks.push(f.fn + (a.error ? ' [' + a.error.slice(0, 40) + ']' : ' [answered]')); }
      if (f.edit || f.admin) { const b = await api(view.token, f.fn, {}); if (!denied(b.error)) viewLeaks.push(f.fn + (b.error ? ' [' + b.error.slice(0, 40) + ']' : ' [answered]')); }
      const c = await api('not-a-session', f.fn, {}); if (c.error !== 'SESSION_EXPIRED') noSession.push(f.fn);
    }
    ok('a user with NO access is refused by every module action', leaks.length === 0, leaks.join(', '));
    ok('a VIEW-only user is refused by every edit / admin action', viewLeaks.length === 0, viewLeaks.join(', '));
    ok('without a session every action is refused', noSession.length === 0, noSession.join(', '));
    const open = fns.filter(f => !f.m && !f.admin && !f.any).map(f => f.fn); console.log('     actions open to every signed-in user: ' + open.join(', '));
    const gi = await api(none.token, 'getInit'); console.log('     … what a no-access user still gets from getInit: ' + Object.keys(gi.result || {}).join(', ') + ' (master rows: ' + ((gi.result || {}).master || []).length + ')');
    r = await rpc(3000, 'readUsers_'); ok('server functions that are not on the list cannot be called', r.error === 'Unknown action.', r.error);
    r = await api(view.token, 'saveUserAdmin', { email: 'view@rcl.test', admin: true }); ok('a user cannot make himself Admin', /Only Admin/.test(r.error || ''), r.error);
    r = await rpc(3000, 'logout', view.token); r = await api(view.token, 'whoami'); ok('after sign-out the session is dead', r.error === 'SESSION_EXPIRED', r.error);
  }

  if (on('brute')) {
    console.log('\n=== SIGN-IN: guessing a password ===');
    sql("delete from web.cache where key like 'F_%' or key like 'LG_%'");
    await Promise.all(Array.from({ length: 24 }, (_, i) => rpc(i % 2 ? 3000 : 3001, 'api', 'warm-up', 'whoami', [])));   // every helper thread is awake
    const tries = await Promise.all(Array.from({ length: 40 }, (_, i) => rpc(i % 2 ? 3000 : 3001, 'login', 'view@rcl.test', 'guess-' + i)));
    const judged = tries.filter(x => /Wrong email or password/.test(x.error || '')).length, blocked = tries.filter(x => /Too many/.test(x.error || '')).length;
    ok('40 guesses fired at the same moment: at most 5 are even looked at', judged <= 5, judged + ' guesses were checked against the password, ' + blocked + ' were refused');
    const again = await rpc(3000, 'login', 'view@rcl.test', 'guess-again'); ok('the account then stays locked for a while', /Too many/.test(again.error || ''), again.error);
    sql("delete from web.cache where key like 'F_%' or key like 'LG_%'");
  }

  if (on('backup')) {
    console.log('\n=== BACKUP ENDPOINT ===');
    const dump = async () => (await fetch('http://127.0.0.1:3997/dump')).json();
    await fetch('http://127.0.0.1:3997/unprotect');
    const g0 = (await dump()).calls;
    const a = []; for (let i = 0; i < 4; i++) a.push(await post(3000, '/api/backup?full=1'));
    const g1 = (await dump()).calls;
    ok('a stranger (no sign-in) cannot make the server run full backups', a.every(x => x.ok === false || x.skipped || x.denied) && g1 - g0 <= 2, 'answers ' + JSON.stringify(a.map(x => ({ ok: x.ok, skipped: x.skipped, denied: x.denied, st: x.status }))) + ' · calls to Google caused: ' + (g1 - g0));
    const b = await post(3000, '/api/backup', { token: admin }); ok('the open app (signed in) may ask for a backup check', b.ok === true, JSON.stringify(b));
    const c = await api(admin, 'backupNow'); ok('"Backup" button works for a signed-in user', !c.error, c.error);
    const d = await dump(), counts = {}; sql("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name <> 'deleted_rows'").split('\n').forEach(t => { counts[t] = Number(sql('select count(*) from public.' + t)); });
    const titles = { master: 'Master', diesel_inward: 'Diesel Inward', diesel_transfer: 'Diesel Transfer', diesel_issue: 'Diesel Issue', log_book: 'Log Book', tank_check: 'Tank Check', activity_log: 'Activity Log', app_users: 'Users', vendors: 'Vendors', boq: 'BOQ', bills: 'Bills', payments: 'Payments', compliance_history: 'Compliance History', breakdowns: 'Breakdowns', breakdown_reports: 'Breakdown Reports', app_settings: 'app_settings' };
    const diff = Object.keys(counts).map(t => { const tab = d.tabs.find(x => x.title === (titles[t] || t)); const rows = tab ? tab.rows - 1 : -1; const exp = t === 'activity_log' ? null : counts[t]; return exp === null || rows === exp || (exp === 0 && rows <= 1) ? '' : t + ': sheet ' + rows + ' ≠ database ' + exp; }).filter(Boolean);
    ok('every table is in the Sheet with the same number of rows as the database', diff.length === 0, diff.join('; ') || Object.keys(counts).length + ' tables compared');
  }

  if (on('diesel')) {
    console.log('\n=== DIESEL ISSUE: wrong values, double posting, stock ===');
    const base = { date: '2026-09-28', shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: 'AUDIT' };
    for (const [label, qty] of [['zero', 0], ['negative', -5], ['text', 'abc'], ['empty', ''], ['absurd (10 lakh litres)', 1000000]]) { const x = await api(admin, 'saveDieselIssue', Object.assign({}, base, { qty, kmReading: 99900, force: true })); ok('quantity ' + label + ' is refused', !!x.error || (x.result && x.result.ok === false), x.error || JSON.stringify(x.result).slice(0, 120)); }
    r = await api(admin, 'saveDieselIssue', Object.assign({}, base, { qty: 10, kmReading: 99900, date: '2031-01-01', force: true })); ok('a date in the future is refused', !!r.error, r.error);
    r = await api(admin, 'saveDieselIssue', Object.assign({}, base, { qty: 10, no: 'NO-SUCH-MACHINE', force: true })); ok('an unknown machinery is refused', !!r.error, r.error);
    const s0 = (await api(admin, 'getStock')).result.stock, n0 = Number(sql("select count(*) from diesel_issue where driver_name = 'AUDIT'"));
    const same = Object.assign({}, base, { qty: 11, kmReading: 99910, force: true });
    const twice = await Promise.all([api(admin, 'saveDieselIssue', same), rpc(3001, 'api', admin, 'saveDieselIssue', [same])]);
    const n1 = Number(sql("select count(*) from diesel_issue where driver_name = 'AUDIT'"));
    ok('the very same entry sent twice at the same moment is saved once', n1 - n0 === 1, (n1 - n0) + ' rows saved; answers: ' + JSON.stringify(twice.map(x => x.error || (x.result && (x.result.id || x.result.warning)))));
    const s1 = (await api(admin, 'getStock')).result.stock;
    const sums = sql("select coalesce((select sum(qty) from diesel_inward),0) || '|' || coalesce((select sum(qty) from diesel_issue),0)").split('|').map(Number);
    ok('stock shown = everything received − everything issued (recomputed from the tables)', Math.abs(s1 - (sums[0] - sums[1])) < 0.01, 'app ' + s1 + ' vs tables ' + (sums[0] - sums[1]));
    for (const id of sql("select id from diesel_issue where driver_name = 'AUDIT'").split('\n').filter(Boolean)) await api(admin, 'deleteDieselIssue', id);
    const s2 = (await api(admin, 'getStock')).result.stock; ok('after deleting the test entries the stock is back', Math.abs(s2 - s0) < 0.01, s0 + ' → ' + s2);
    const delLog = Number(sql("select count(*) from deleted_rows where table_name = 'diesel_issue'")); ok('deleted entries leave a trace (delete log)', delLog > 0, delLog + ' rows in deleted_rows');
  }

  if (on('atomic')) {
    console.log('\n=== ONE SAVE = ALL OR NOTHING ===');
    // a save that touches two tables (Diesel Issue + the Log Book row of that day); the second table is made to fail
    sql("alter table log_book drop constraint if exists audit_fail; alter table log_book add constraint audit_fail check (diesel_qty is distinct from 777) not valid");
    const before = Number(sql('select count(*) from diesel_issue'));
    const x = await api(admin, 'saveDieselIssue', { date: '2026-09-30', shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 777, kmReading: 99950, driver: 'ATOMIC', force: true });
    const after = Number(sql('select count(*) from diesel_issue'));
    sql('alter table log_book drop constraint if exists audit_fail');
    ok('when one table of a save cannot be written, the save is refused', !!x.error, x.error || JSON.stringify(x.result).slice(0, 100));
    ok('…and NOTHING of it stays in the database', after === before, 'Diesel Issue rows before ' + before + ', after ' + after);
    for (const id of sql("select id from diesel_issue where driver_name = 'ATOMIC'").split('\n').filter(Boolean)) await api(admin, 'deleteDieselIssue', id);
  }

  if (on('money')) {
    console.log('\n=== VENDOR LEDGER: opening + bills − payments = closing ===');
    const V = 'Vendor 9'; sql("delete from payments where vendor_name = '" + V + "'");
    r = await api(admin, 'savePayment', { type: 'Opening', vendor: V, date: '2026-09-01', amount: 100000, side: 'Payable', remark: 'audit' }, 'add'); ok('opening balance saved', !r.error, r.error);
    r = await api(admin, 'savePayment', { type: 'Opening', vendor: V, date: '2026-09-01', amount: 5, side: 'Payable' }, 'add'); ok('a second opening balance for the same vendor is refused', !!r.error, r.error);
    r = await api(admin, 'savePayment', { type: 'Payment', vendor: V, date: '2026-09-10', amount: 33333.33, mode: 'NEFT', ref: 'UTR1' }, 'add'); ok('payment 1 saved', !r.error, r.error);
    r = await api(admin, 'savePayment', { type: 'Payment', vendor: V, date: '2026-09-20', amount: 33333.33, mode: 'NEFT', ref: 'UTR2' }, 'add'); ok('payment 2 saved', !r.error, r.error);
    for (const [label, amt] of [['zero', 0], ['negative', -10], ['text', 'x']]) { const x = await api(admin, 'savePayment', { type: 'Payment', vendor: V, date: '2026-09-21', amount: amt, mode: 'NEFT' }, 'add'); ok('payment amount ' + label + ' is refused', !!x.error, x.error); }
    const dup = { type: 'Payment', vendor: V, date: '2026-09-22', amount: 1000, mode: 'NEFT', ref: 'UTR-DUP' };
    const two = await Promise.all([api(admin, 'savePayment', dup, 'add'), rpc(3001, 'api', admin, 'savePayment', [dup, 'add'])]);
    const nd = Number(sql("select count(*) from payments where vendor_name = '" + V + "' and amount = 1000"));
    ok('the same payment sent twice at the same moment is saved once', nd === 1, nd + ' rows; answers ' + JSON.stringify(two.map(x => x.error || 'saved')));
    const L = (await api(admin, 'vendorLedger', { vendor: V })).result;
    const paid = Number(sql("select coalesce(sum(amount),0) from payments where vendor_name = '" + V + "' and entry_type = 'Payment'"));
    ok('ledger: opening + bills − payments = closing', Math.abs(L.opening + L.totalBill - L.totalPaid - L.closing) < 0.005, 'opening ' + L.opening + ' + bills ' + L.totalBill + ' − paid ' + L.totalPaid + ' = ' + L.closing);
    ok('ledger "paid" = sum of the payment rows in the database', Math.abs(L.totalPaid - paid) < 0.005, L.totalPaid + ' vs ' + paid);
    const O = (await api(admin, 'vendorOutstanding', { fromM: '2026-09', toM: '2026-09' })).result.rows.find(x => x.vendor === V);
    ok('Vendor Outstanding shows the same closing as the Vendor Ledger', O && Math.abs(O.closing - L.closing) < 0.005, O ? O.closing + ' vs ' + L.closing : 'vendor missing');
    const L2 = (await api(admin, 'vendorLedger', { vendor: V, from: '2026-09-15', to: '2026-09-30' })).result;
    ok('with a date filter: opening (before the period) + period = the same closing', Math.abs(L2.closing - L.closing) < 0.005 && Math.abs(L2.opening + L2.totalBill - L2.totalPaid - L2.closing) < 0.005, 'opening ' + L2.opening + ', closing ' + L2.closing);
    sql("delete from payments where vendor_name = '" + V + "'");
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log('CRASH', e); process.exit(1); });
