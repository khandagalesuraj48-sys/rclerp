/* update-94 (the pages of Mechanical given by the Super Admin in the Portal) – through the server's own door on the local rig:
 *   Mechanical :3000 linked to the Portal (PORTAL_URL=http://127.0.0.1:3010), :3001 not linked; the Portal :3010 and its database.
 *   The Portal repository must be next to this one (../rcl-portal): its own code signs the tickets.
 *   node test/portal94api.js      (run test/portal91api.js first – it sets the Portal up)
 * Mechanical's users are kept aside and put back at the end. */
'use strict';
const { execSync } = require('child_process'), path = require('path'), crypto = require('crypto');
let pass = 0, fail = 0; const out = [], T0 = Date.now();
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const P = 'http://127.0.0.1:3010';
const call = async (port, fn, ...args) => {
  const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }), signal: AbortSignal.timeout(90000) });
  return Object.assign({ status: r.status }, await r.json());
};
Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:3106', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_SECRET: 'rig-portal-secret-0123456789abcdefghijklmnop' });
const keys = require(path.join(__dirname, '..', '..', 'rcl-portal', 'lib', 'keys'));
const now = () => Math.floor(Date.now() / 1000);
const adm = o => keys.sign(Object.assign({ iss: P, aud: 'mechanical-admin', sub: 'sa@rcl.test', site: 'S1', act: 'users', iat: now(), exp: now() + 60, jti: crypto.randomBytes(16).toString('hex') }, o || {}));
const col = (e, c) => sql('rcl', "select " + c + " from app_users where email = '" + e + "'");

(async () => {
  sql('rcl', "drop table if exists public._t94_users; create table public._t94_users as select * from public.app_users; drop table if exists public._t94_us; create table public._t94_us as select * from public.rcl_user_sites; delete from public.app_users where email like '%@portal94.test'; delete from web.cache where key like 'SSO\\_%';");

  const keep = col('view@rcl.test', "perm_diesel_issue || '|' || perm_log_book || '|' || perm_reports");
  let r = await call(3000, 'portalAdmin', await adm());
  const users = (r.result && r.result.users) || [], pages = (r.result && r.result.pages) || [];
  ok('the Super Admin\'s ticket: S1\'s users with their pages, and the list of pages', users.length >= 3 && pages.some(p => p.key === 'Diesel Issue') && users.every(u => u.perms && u.perms.Dashboard), r.error || r.result);
  ok('   no password leaves (not even a fingerprint)', !/scrypt|sha256|password/i.test(JSON.stringify(r.result)), JSON.stringify(r.result).slice(0, 200));
  const before = users.find(u => u.email === 'view@rcl.test');
  const want = Object.assign({}, before.perms, { 'Diesel Issue': 'Edit', 'Log Book': 'None', Reports: 'View' });
  r = await call(3000, 'portalAdmin', await adm({ act: 'pages', email: 'view@rcl.test', name: 'view', admin: false, perms: want }));
  ok('his pages set from the Portal are saved in Mechanical', r.result && r.result.ok && col('view@rcl.test', 'perm_diesel_issue') === 'Edit' && col('view@rcl.test', 'perm_log_book') === 'No access' && col('view@rcl.test', 'perm_reports') === 'View', r.error || r.result);
  ok('   Active and Admin stay as they were', col('view@rcl.test', "active || '|' || admin") === 'Yes|No');
  ok('   the Activity Log says who did it: "Super Admin (Portal)"', sql('rcl', "select count(*) from activity_log where email = 'sa@rcl.test' and name = 'Super Admin (Portal)' and record_id = 'view@rcl.test'") !== '0');
  r = await call(3000, 'portalAdmin', await adm({ act: 'pages', email: 'new1@portal94.test', name: 'New One', admin: false, perms: { Dashboard: 'View', 'Diesel Issue': 'Edit' } }));
  ok('a person given the site in the Portal who never opened Mechanical: written in with these pages', r.result && r.result.added && col('new1@portal94.test', "active || '|' || admin || '|' || perm_dashboard || '|' || perm_diesel_issue || '|' || perm_master") === 'Yes|No|View|Edit|No access', r.error || col('new1@portal94.test', 'perm_dashboard'));
  ok('   with a password nobody knows (not a one-time one)', /^scrypt\$/.test(col('new1@portal94.test', 'password_hash')));
  ok('   and the list of sites knows him on S1', sql('rcl', "select count(*) from rcl_user_sites where email = 'new1@portal94.test' and site = 'S1'") === '1');

  const t = await adm({ act: 'pages', email: 'view@rcl.test', perms: { Dashboard: 'View' } });
  await call(3000, 'portalAdmin', t); r = await call(3000, 'portalAdmin', t);
  ok('the same ticket twice: refused', /already used/.test(r.error || ''), r.error);
  r = await call(3000, 'portalAdmin', await keys.sign({ iss: P, aud: 'mechanical', sub: 'sujit@rcl.test', site: 'S1', act: 'users', iat: now(), exp: now() + 60, jti: crypto.randomBytes(16).toString('hex') }));
  ok('a person\'s sign-in ticket cannot be used as the Super Admin\'s', /another module/.test(r.error || ''), r.error);
  r = await call(3000, 'ssoLogin', await adm());
  ok('   and the Super Admin\'s ticket opens no session', /another module/.test(r.error || ''), r.error);
  r = await call(3000, 'portalAdmin', await adm({ act: 'delete' }));
  ok('an unknown request: refused', /not a known request/.test(r.error || ''), r.error);
  r = await call(3000, 'portalAdmin', await adm({ act: 'pages', email: 'view@rcl.test', perms: { 'Diesel Issue': 'Owner' } }));
  ok('only Edit / View / No access are taken', /No page was given/.test(r.error || '') && col('view@rcl.test', 'perm_diesel_issue') === 'Edit', r.error);
  r = await call(3000, 'portalAdmin', await adm({ site: 'ZZ' }));
  ok('a site that is not set up: refused', /not set up/.test(r.error || ''), r.error);
  r = await call(3001, 'portalAdmin', await adm());
  ok('a server not linked to the Portal: refused', /not linked to the Portal/.test(r.error || ''), r.error);
  r = await call(3000, 'portalAdmin', await adm({ site: 'T2' }));
  ok('T2: its own users (its own database)', r.result && Array.isArray(r.result.users), r.error);

  sql('rcl', "delete from public.app_users where email like '%@portal94.test'; update public.app_users u set active = b.active, admin = b.admin, password_hash = b.password_hash, perm_dashboard = b.perm_dashboard, perm_master = b.perm_master, perm_diesel_inward = b.perm_diesel_inward, perm_diesel_transfer = b.perm_diesel_transfer, perm_diesel_issue = b.perm_diesel_issue, perm_log_book = b.perm_log_book, perm_reports = b.perm_reports, perm_vendor_master = b.perm_vendor_master, perm_vendor_boq = b.perm_vendor_boq, perm_machinery_billing = b.perm_machinery_billing, perm_saved_bills = b.perm_saved_bills, perm_bill_summary = b.perm_bill_summary, perm_machinery_payments = b.perm_machinery_payments, perm_vendor_ledger = b.perm_vendor_ledger, perm_vendor_outstanding = b.perm_vendor_outstanding, perm_vehicle_compliance = b.perm_vehicle_compliance, perm_breakdown = b.perm_breakdown, updated_at = now() from public._t94_users b where b.email = u.email; " +
    "delete from public.rcl_user_sites; insert into public.rcl_user_sites select * from public._t94_us; drop table public._t94_users; drop table public._t94_us;");
  ok('Mechanical\'s users put back', col('view@rcl.test', "perm_diesel_issue || '|' || perm_log_book || '|' || perm_reports") === keep && col('new1@portal94.test', 'email') === '');
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - T0) / 1000) + ' s)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e.stack || e)); process.exit(2); });
