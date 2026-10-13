/* update-90 (new sites, stage 2): the Super Admin, the sites of a person, his default site, opening another site, one password
 * on all his sites – checked through the server's own door (/api/rpc) on the local rig:
 *   first site S1 = database rcl (door :3100, step-7 SQL run), second site T2 = database rcl_s2 (door :3102), listed in
 *   rcl_sites with its key LOCKED (RCL_SITES_KEY of the app servers). App servers :3000 and :3001 (one helper thread).
 *   A third server (:3007) whose first site is rcl_s2 – a database WITHOUT the step-7 SQL – shows that nothing changes there.
 *   node test/site90api.js
 * The test sets its own start: no Super Admin, T2's users as copies of S1's, nobody on T2 yet. */
const { execSync, spawn } = require('child_process'), path = require('path');
const T0 = Date.now(); let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
let PORT = 3001;      // the server with ONE helper thread: the one that made the Super Admin knows it at once
const call = async (site, fn, ...args) => {
  const b = { fn, args }; if (site) b.site = site;
  const r = await fetch('http://127.0.0.1:' + PORT + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(90000) });
  return Object.assign({ status: r.status }, await r.json());
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const PW = 'Nashik#Road848!', VPW = 'Audit#PassView9!x', SAPW = 'Super#Admin2026';
const snapshot = db => {
  const tabs = sql(db, "select table_schema||'.'||table_name from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','web') order by 1").split('\n').filter(Boolean);
  const o = {}; tabs.forEach(t => { o[t] = sql(db, "select count(*)||':'||coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text))),'-') from " + t + ' x'); }); return o;
};
(async () => {
  // ---- the start ----
  const key = execSync('node -e "console.log(require(\'./server/sites\').seal(\'sb_secret_rigkey\'))"', { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { RCL_SITES_KEY: 'rig-sites-key-0123456789-abcdefghij' }) }).toString().trim();
  sql('rcl', "delete from rcl_super_admin; delete from rcl_user_sites where site <> 'S1'; update rcl_user_sites set is_default = false; delete from rcl_user_sites where email like '%@new90.test'; " +
    "insert into rcl_sites (code, name, status, db_url, db_key_enc, sort) values ('T2', 'Test Site T2', 'ready', 'http://127.0.0.1:3102', '" + key + "', 2) on conflict (code) do update set name = 'Test Site T2', status = 'ready', db_url = excluded.db_url, db_key_enc = excluded.db_key_enc, company_id = null; " +
    "update rcl_sites set company_id = null where code = 'S1'; delete from rcl_companies; delete from public.app_users where email like '%@new90.test'; " +
    "delete from web.cache where key like 'SA%' or key like 'F\\_%' or key like 'LG\\_%' or key like 'CPF\\_%';");
  sql('rcl_s2', "delete from public.app_users; delete from web.cache where key like 'F\\_%' or key like 'LG\\_%' or key like 'S\\_%';");
  execSync('timeout 60 su postgres -c "pg_dump --data-only -t public.app_users rcl" | timeout 60 su postgres -c "psql -q -d rcl_s2"');
  // (rows put back with their old times would be missed by the servers' memory of the tables, which asks "what changed since …")
  sql('rcl_s2', "delete from public.app_users where email like '%@new90.test'; update public.app_users set updated_at = now() + interval '1 second';");
  await wait(16000);      // the servers' memory of the list of sites (15 s)
  const vtrBefore = snapshot('rcl');

  // ---- before the Super Admin ----
  let a = await call(null, 'login', 'sujit@rcl.test', PW);
  ok('Admin signs in: the first site (only his), no question', a.result && a.result.site === 'S1' && !a.result.choose && a.result.sites.length === 1, a.error || a.result.sites);
  const tA = a.result.token;
  let ua = await call('S1', 'api', tA, 'usersAdmin', []);
  ok('   his Users page: may create the Super Admin, users not yet given by one', ua.result && ua.result.canCreateSuper === true && ua.result.managedBySuper === false, ua.result && [ua.result.canCreateSuper, ua.result.managedBySuper]);
  const v = await call(null, 'login', 'view@rcl.test', VPW);
  const nonAdmin = await call('S1', 'api', v.result.token, 'createSuperAdmin', [{ email: 'x@y.test', name: 'x', password: SAPW, password2: SAPW }]);
  ok('a user who is not Admin cannot create the Super Admin', /Only Admin/.test(nonAdmin.error || ''), nonAdmin.error);
  let c = await call('S1', 'api', tA, 'createSuperAdmin', [{ email: 'view@rcl.test', name: 'x', password: SAPW, password2: SAPW }]);
  ok('   not with the email of a user', /already a user of this site/.test(c.error || ''), c.error);
  c = await call('S1', 'api', tA, 'createSuperAdmin', [{ email: 'sa@rcl.test', name: 'Owner', password: 'abc', password2: 'abc' }]);
  ok('   not with a weak password', /at least 8/.test(c.error || ''), c.error);
  c = await call('S1', 'api', tA, 'createSuperAdmin', [{ email: 'sa@rcl.test', name: 'Owner', password: SAPW, password2: SAPW }]);
  const rec = c.result && c.result.recovery;
  ok('the first site\'s Admin creates the Super Admin – a recovery code is given once', /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(rec || ''), c.error || rec);
  c = await call('S1', 'api', tA, 'createSuperAdmin', [{ email: 'sa2@rcl.test', name: 'Two', password: SAPW, password2: SAPW }]);
  ok('   a second Super Admin: refused', /already a Super Admin/.test(c.error || ''), c.error);
  ok('   the database itself allows one row only', /duplicate key|unique/.test((() => { try { execSync('timeout 30 su postgres -c "psql -d rcl -v ON_ERROR_STOP=1 -q"', { input: "insert into rcl_super_admin (email, password_hash) values ('z@z.test', 'x')", stdio: ['pipe', 'pipe', 'pipe'] }); return 'inserted'; } catch (e) { return String(e.stderr || e.message); } })()));
  ok('   kept as a hash (no password, no recovery code in the table)', !sql('rcl', "select password_hash || recovery_hash from rcl_super_admin").includes(SAPW) && !sql('rcl', "select recovery_hash from rcl_super_admin").includes(rec.replace(/-/g, '')) && /^scrypt\$/.test(sql('rcl', 'select password_hash from rcl_super_admin')));
  ua = await call('S1', 'api', tA, 'usersAdmin', []);      // (the same server knows it at once; :3001 within 15 s)
  ok('the Admin\'s Users page: now given by the Super Admin, no "Create" any more', ua.result && ua.result.managedBySuper === true && ua.result.canCreateSuper === false);
  const adminSave = await call('S1', 'api', tA, 'saveUserAdmin', [{ email: 'view@rcl.test', name: 'view', active: true, admin: false, perms: {} }]);
  ok('   an Admin cannot change users or access any more (refused by the server)', /given by the Super Admin only/.test(adminSave.error || ''), adminSave.error);

  // ---- the Super Admin ----
  let s = await call(null, 'login', 'sa@rcl.test', 'wrong-pass-1');
  ok('Super Admin, wrong password: the same answer as anybody', s.error === 'Wrong email or password.', s.error);
  s = await call(null, 'login', 'sa@rcl.test', SAPW);
  ok('Super Admin signs in on the same screen → his own session', s.result && s.result.superAdmin === true && /^sa/.test(s.result.token), s.error);
  let tS = s.result.token;
  let x = await call('S1', 'api', tS, 'getDieselIssues', [{}]);
  ok('   his session opens NO page of a site (entries / reports)', /SESSION_EXPIRED/.test(x.error || ''), x.error);
  x = await call(null, 'super', tA, 'sites', {});
  ok('   a user\'s session cannot do what the Super Admin does', /SESSION_EXPIRED/.test(x.error || ''), x.error);
  const st = await call(null, 'super', tS, 'sites', {});
  ok('Sites: the first site and T2 (names; T2 still without users)', st.result && st.result.sites.length === 2 && st.result.sites[0].code === 'S1' && st.result.sites[0].home && st.result.sites[1].name === 'Test Site T2' && st.result.sites[1].users === 0, st.result && st.result.sites);
  const chk = await call(null, 'super', tS, 'siteCheck', { site: 'T2' });
  ok('   "Check": T2\'s database answers (through its locked key)', chk.result && chk.result.ok === true, chk.result);
  let co = await call(null, 'super', tS, 'companySave', { name: 'Rachana Construction Limited', gstin: '27AABCR1234Q1ZX', pan: 'AABCR1234Q', address: 'Mittal Chambers, Nariman Point, Mumbai', logo: '' });
  ok('Companies: Rachana added', co.result && co.result.ok && co.result.id === 'RACHANACONSTRUCTIONL', co.error || co.result);
  co = await call(null, 'super', tS, 'companySave', { name: 'Sketchline Industries', gstin: '27ABC', pan: '' });
  ok('   a wrong GSTIN is refused', /right format/.test(co.error || ''), co.error);
  co = await call(null, 'super', tS, 'companySave', { name: 'Sketchline Industries', gstin: '', pan: '', logo: 'http://x.test/a.png' });
  ok('   a logo link without https is refused', /https/.test(co.error || ''), co.error);
  co = await call(null, 'super', tS, 'companySave', { name: 'Sketchline Industries' });
  ok('   Sketchline added', co.result && co.result.ok, co.error);
  co = await call(null, 'super', tS, 'companySave', { name: 'sketchline industries' });
  ok('   the same name twice: refused', /already a company/.test(co.error || ''), co.error);
  let ss = await call(null, 'super', tS, 'siteSave', { site: 'S1', name: 'VTR NH 848', company: 'RACHANACONSTRUCTIONL' });
  ok('   the first site gets its name and company', ss.result && ss.result.ok && sql('rcl', "select name || '|' || company_id from rcl_sites where code = 'S1'") === 'VTR NH 848|RACHANACONSTRUCTIONL', ss.error);

  // ---- users on two sites ----
  let us = await call(null, 'super', tS, 'users', { site: 'T2' });
  ok('Users & Access of T2: its own users table', us.result && us.result.site === 'T2' && us.result.users.length === 3 && us.result.modules.length > 10, us.error || (us.result && us.result.users.map(u => u.email)));
  const vRow = us.result.users.find(u => u.email === 'view@rcl.test');
  const perms = Object.assign({}, vRow.perms, { 'Diesel Issue': 'Edit', 'Log Book': 'None' });
  let sv = await call(null, 'super', tS, 'userSave', { site: 'T2', user: { email: 'view@rcl.test', name: vRow.name, active: true, admin: false, perms: perms } });
  ok('the Super Admin gives view@ site T2 (Diesel Issue: Edit there)', sv.result && sv.result.ok && sql('rcl', "select count(*) from rcl_user_sites where email = 'view@rcl.test' and site = 'T2'") === '1', sv.error);
  ok('   written in T2\'s Users table only (S1\'s access of view@ unchanged)', sql('rcl_s2', "select perm_diesel_issue from app_users where email = 'view@rcl.test'") === 'Edit' && sql('rcl', "select coalesce(perm_diesel_issue,'') from app_users where email = 'view@rcl.test'") !== 'Edit');
  let l = await call(null, 'login', 'view@rcl.test', VPW);
  ok('view@ (not Admin, 2 sites, no default): signs in on the first one and is ASKED which site', l.result && l.result.choose === true && l.result.site === 'S1' && l.result.sites.map(z => z.code).join() === 'S1,T2', l.result && [l.result.choose, l.result.site]);
  let sw = await call('S1', 'switchSite', l.result.token, 'T2');
  ok('   he opens T2 without signing in again (a T2 session)', sw.result && sw.result.site === 'T2' && sw.result.token !== l.result.token, sw.error);
  x = await call('S1', 'api', l.result.token, 'whoami', []);
  ok('   his S1 session is closed when he moves', /SESSION_EXPIRED/.test(x.error || ''), x.error);
  const gi = await call('T2', 'api', sw.result.token, 'getInit', []);
  ok('   on T2 the page learns the site it is on and his sites', gi.result && gi.result.siteInfo && gi.result.siteInfo.site === 'T2' && gi.result.siteInfo.sites.length === 2 && gi.result.siteInfo.sites.find(z => z.current).code === 'T2', gi.error || gi.result.siteInfo);
  ok('   T2\'s access: Diesel Issue Edit, Log Book none', gi.result.user.perms['Diesel Issue'] === 'Edit' && gi.result.user.perms['Log Book'] === 'None');
  x = await call('T2', 'switchSite', sw.result.token, 'ZZ');
  ok('   a site he does not have: refused', /do not have access to this site|not set up/.test(x.error || ''), x.error);
  x = await call('T2', 'setDefaultSite', sw.result.token, 'T2');
  ok('his default site: T2', x.result && x.result.ok && x.result.sites.find(z => z.code === 'T2').default === true, x.error);
  l = await call(null, 'login', 'view@rcl.test', VPW);
  ok('   the next sign-in opens T2 straight away, no question', l.result && l.result.site === 'T2' && l.result.choose === false, l.result && [l.result.site, l.result.choose]);
  x = await call('T2', 'setDefaultSite', l.result.token, '');
  ok('   "Ask me every time" again', x.result && x.result.ok && !x.result.sites.some(z => z.default));
  // an Admin is never asked
  us = await call(null, 'super', tS, 'users', { site: 'T2' });
  const sRow = us.result.users.find(u => u.email === 'sujit@rcl.test');
  sv = await call(null, 'super', tS, 'userSave', { site: 'T2', user: { email: 'sujit@rcl.test', name: sRow.name, active: true, admin: true, perms: sRow.perms } });
  l = await call(null, 'login', 'sujit@rcl.test', PW, { last: 'T2' });
  ok('an Admin with 2 sites is not asked: the site he used last opens (T2)', l.result && l.result.choose === false && l.result.site === 'T2', l.result && [l.result.site, l.result.choose]);
  l = await call(null, 'login', 'sujit@rcl.test', PW, {});
  ok('   nothing remembered: the first of his sites', l.result && l.result.choose === false && l.result.site === 'S1', l.result && l.result.site);

  // ---- a brand-new person, one password on all his sites ----
  sv = await call(null, 'super', tS, 'userSave', { site: 'T2', user: { isNew: true, email: 'ravi@new90.test', name: 'Ravi', active: true, admin: false, perms: { 'Diesel Issue': 'Edit' } } });
  ok('a new person without a one-time password: refused', /one-time password/.test(sv.error || ''), sv.error);
  sv = await call(null, 'super', tS, 'userSave', { site: 'T2', user: { isNew: true, email: 'ravi@new90.test', name: 'Ravi', active: true, admin: false, newPassword: 'Temp1234', perms: { 'Diesel Issue': 'Edit' } } });
  ok('   a new person on T2 with a one-time password', sv.result && sv.result.added === true, sv.error);
  ok('   in T2\'s Users only – not in the first site\'s', sql('rcl_s2', "select count(*) from app_users where email = 'ravi@new90.test'") === '1' && sql('rcl', "select count(*) from app_users where email = 'ravi@new90.test'") === '0');
  l = await call(null, 'login', 'ravi@new90.test', 'Temp1234');
  ok('   he signs in: T2 (his only site), must set his own password', l.result && l.result.site === 'T2' && l.result.mustChange === true, l.error || l.result);
  let cp = await call('T2', 'changePassword', l.result.token, 'Temp1234', 'Ravi#Own2026');
  ok('   he sets his own password on T2', cp.result && cp.result.token, cp.error);
  sv = await call(null, 'super', tS, 'userSave', { site: 'S1', user: { isNew: true, email: 'ravi@new90.test', name: 'Ravi', active: true, admin: false, perms: { 'Diesel Inward': 'View' } } });
  ok('the Super Admin also gives him S1 – no password needed: he keeps his own', sv.result && sv.result.copiedPassword === true, sv.error || sv.result);
  ok('   the same kept password on both sites', sql('rcl', "select password_hash from app_users where email = 'ravi@new90.test'") === sql('rcl_s2', "select password_hash from app_users where email = 'ravi@new90.test'"));
  l = await call(null, 'login', 'ravi@new90.test', 'Ravi#Own2026');
  ok('   he signs in with his password and is asked (2 sites)', l.result && l.result.choose === true && !l.result.mustChange, l.error || l.result);
  sw = await call(l.result.site, 'switchSite', l.result.token, l.result.site === 'S1' ? 'T2' : 'S1');
  ok('   and opens the other site', sw.result && sw.result.token, sw.error);
  cp = await call(sw.result.site, 'changePassword', sw.result.token, 'Ravi#Own2026', 'Ravi#New2027');
  ok('he changes his password on ' + sw.result.site, cp.result && cp.result.token, cp.error);
  ok('   it is written on his other site too (one password everywhere)', sql('rcl', "select password_hash from app_users where email = 'ravi@new90.test'") === sql('rcl_s2', "select password_hash from app_users where email = 'ravi@new90.test'"));
  for (const site of ['S1', 'T2']) {
    l = await call(null, 'login', 'ravi@new90.test', 'Ravi#New2027', { site: site });
    ok('   the new password opens ' + site, l.result && l.result.site === site, l.error || (l.result && l.result.site));
  }
  l = await call(null, 'login', 'ravi@new90.test', 'Ravi#Own2026');
  ok('   the old one opens nothing', l.error === 'Wrong email or password.', l.error);
  sv = await call(null, 'super', tS, 'userSave', { site: 'S1', user: { email: 'ravi@new90.test', name: 'Ravi', active: true, admin: false, newPassword: 'Reset5678', perms: { 'Diesel Inward': 'View' } } });
  ok('a password reset by the Super Admin is his one-time password on both sites', sv.result && sv.result.otherSites === 1 && sql('rcl', "select password_hash from app_users where email = 'ravi@new90.test'") === sql('rcl_s2', "select password_hash from app_users where email = 'ravi@new90.test'") && /^tmp\$/.test(sql('rcl', "select password_hash from app_users where email = 'ravi@new90.test'")), sv.error || sv.result);
  // the Super Admin takes T2 away from view@
  us = await call(null, 'super', tS, 'users', { site: 'T2' });
  const vr = us.result.users.find(u => u.email === 'view@rcl.test');
  sv = await call(null, 'super', tS, 'userSave', { site: 'T2', user: { email: 'view@rcl.test', name: vr.name, active: false, admin: false, perms: vr.perms } });
  ok('view@ made inactive on T2 → T2 is not his site any more', sv.result && sql('rcl', "select count(*) from rcl_user_sites where email = 'view@rcl.test' and site = 'T2'") === '0', sv.error);
  l = await call(null, 'login', 'view@rcl.test', VPW);
  ok('   he signs in: S1 only, no question', l.result && l.result.site === 'S1' && l.result.choose === false && l.result.sites.length === 1, l.result && l.result.sites);
  x = await call('S1', 'switchSite', l.result.token, 'T2');
  ok('   opening T2 is refused', /do not have access to this site/.test(x.error || ''), x.error);
  x = await call(null, 'super', tS, 'userSave', { site: 'T2', user: { isNew: true, email: 'sa@rcl.test', name: 'x', active: true, admin: false, newPassword: 'Temp1234', perms: {} } });
  ok('the Super Admin\'s own email cannot be a user', /Super Admin\'s email/.test(x.error || ''), x.error);

  // ---- the Super Admin's password ----
  x = await call(null, 'super', tS, 'changePassword', { old: 'wrong-old-1', password: 'Super#Admin2027' });
  ok('Super Admin: wrong current password – refused', /Current password is wrong/.test(x.error || ''), x.error);
  x = await call(null, 'super', tS, 'changePassword', { old: SAPW, password: 'Super#Admin2027' });
  ok('   changed → a new session; the old one ends', x.result && x.result.token && /SESSION_EXPIRED/.test((await call(null, 'super', tS, 'me', {})).error || ''), x.error);
  tS = x.result.token;
  x = await call(null, 'super', '', 'recover', { email: 'sa@rcl.test', code: 'AAAA-BBBB-CCCC-DDDD', password: 'Super#Admin2028' });
  ok('recovery code wrong: refused', /recovery code is wrong/.test(x.error || ''), x.error);
  x = await call(null, 'super', '', 'recover', { email: 'sa@rcl.test', code: rec.toLowerCase(), password: 'Super#Admin2028' });
  ok('the right recovery code → a new password and a NEW recovery code', x.result && x.result.ok && x.result.recovery && x.result.recovery !== rec, x.error);
  x = await call(null, 'super', '', 'recover', { email: 'sa@rcl.test', code: rec, password: 'Super#Admin2029' });
  ok('   the old recovery code works no more', /recovery code is wrong/.test(x.error || ''), x.error);
  s = await call(null, 'login', 'sa@rcl.test', 'Super#Admin2028');
  ok('   he signs in with the new password', s.result && s.result.superAdmin, s.error);
  for (let i = 0; i < 5; i++) await call(null, 'login', 'sa@rcl.test', 'wrong-pass-' + i);
  s = await call(null, 'login', 'sa@rcl.test', 'Super#Admin2028');
  ok('5 wrong passwords → 15 minutes locked (also the right one)', /Too many wrong attempts/.test(s.error || ''), s.error);
  sql('rcl', "delete from web.cache where key like 'SA%F\\_%' or key like 'SAF\\_%';");

  // ---- wrong passwords are counted per PERSON, whichever of his sites is asked for ----
  for (let i = 0; i < 5; i++) await call(null, 'login', 'ravi@new90.test', 'wrong-pass-' + i, { site: i % 2 ? 'S1' : 'T2' });
  l = await call(null, 'login', 'ravi@new90.test', 'Reset5678', { site: 'T2' });
  ok('5 wrong passwords asked for on his two sites in turn → locked (one count per person, not per site)', /Too many wrong attempts/.test(l.error || ''), l.error);
  sql('rcl', "delete from web.cache where key like 'F\\_ravi%';"); sql('rcl_s2', "delete from web.cache where key like 'F\\_ravi%';");

  // ---- what may be asked from outside ----
  for (const fn of ['sysUsers', 'sysSession', 'saLogin', 'saWho', 'sysSetPw', 'saved']) { x = await call(null, fn, 'sujit@rcl.test'); ok('the server\'s own function "' + fn + '" cannot be asked for from outside', x.status === 404 && /Unknown action/.test(x.error || ''), [x.status, x.error]); }

  // ---- the first site's data ----
  const vtrAfter = snapshot('rcl');
  const changed = Object.keys(vtrBefore).filter(k => vtrBefore[k] !== vtrAfter[k]);
  const allowed = ['public.activity_log', 'public.app_users', 'public.rcl_companies', 'public.rcl_sites', 'public.rcl_super_admin', 'public.rcl_user_sites', 'web.cache', 'web.props', 'web.locks', 'web.ops', 'public.deleted_rows'];
  ok('the first site: of its ' + Object.keys(vtrBefore).length + ' tables only the sign-in / users / sites ones changed – not one entry (diesel, log book, master, bills …)', changed.every(t => allowed.indexOf(t) > -1), changed);
  ok('   its users: only the new person was added (no one else changed)', sql('rcl', "select count(*) from app_users where email not like '%@new90.test'") === '3');

  // ---- a database WITHOUT the step-7 SQL: as before ----
  const env = Object.assign({}, process.env, { PORT: '3007', SUPABASE_URL: 'http://127.0.0.1:3102', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', RCL_SITES_KEY: 'rig-sites-key-0123456789-abcdefghij' });
  const srv = spawn('node', ['dev.js'], { cwd: path.join(__dirname, '..'), env: env, stdio: 'ignore' });
  try {
    await wait(4000); PORT = 3007;
    l = await call(null, 'login', 'sujit@rcl.test', PW);
    ok('no step 7 (a site set up the old way): the sign-in as before – no sites in the answer', l.result && l.result.token && l.result.site === undefined && l.result.sites === undefined, l.error || Object.keys(l.result || {}));
    const g2 = await call(null, 'api', l.result.token, 'getInit', []);
    ok('   no site switch for the page', g2.result && g2.result.siteInfo === undefined, g2.error);
    const u2 = await call(null, 'api', l.result.token, 'usersAdmin', []);
    ok('   the Admin gives users and access as before; no "Create Super Admin" (step 7 is not there)', u2.result && u2.result.managedBySuper === false && u2.result.canCreateSuper === false, u2.result && [u2.result.managedBySuper, u2.result.canCreateSuper]);
  } finally { srv.kill(); }
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - T0) / 1000) + ' s)');
  console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
