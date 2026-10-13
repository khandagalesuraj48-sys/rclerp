/* update-91 (sign-in through the Portal) – checked through the server's own door (/api/rpc) on the local rig, never live:
 *   Mechanical :3000 linked to the Portal (PORTAL_URL=http://127.0.0.1:3010), :3001 NOT linked (as live today);
 *   the Portal :3010 with its test database (door :3106); Mechanical's sites S1 (rcl, :3100) and T2 (rcl_s2, :3102).
 *   The Portal repository must be next to this one (../rcl-portal): its own code signs the odd tickets below.
 *   node test/portal91api.js
 * The test sets its own start (an empty Portal, the users brought over from Mechanical) and puts Mechanical's users back. */
'use strict';
const { execSync } = require('child_process'), path = require('path'), crypto = require('crypto');
let pass = 0, fail = 0; const out = [], T0 = Date.now();
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const wait = ms => new Promise(r => setTimeout(r, ms));
const P = 'http://127.0.0.1:3010', LINKED = 3000, PLAIN = 3001;
const call = async (port, site, fn, ...args) => {
  const b = { fn, args }; if (site) b.site = site;
  const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(90000) });
  return Object.assign({ status: r.status }, await r.json());
};
// a browser of the Portal: keeps its cookie, sends its header
function portalBrowser() {
  let cookie = '';
  const req = async (p, body) => {
    const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(60000) });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; cookie = /=$/.test(v) ? '' : v; }
    let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { j = {}; }
    return { status: r.status, j: j, loc: r.headers.get('location') };
  };
  return { req };
}
// the Portal's own signing (its code, its test database and test secret) – for tickets the Portal itself would never make
Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:3106', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_SECRET: 'rig-portal-secret-0123456789abcdefghijklmnop' });
const keys = require(path.join(__dirname, '..', '..', 'rcl-portal', 'lib', 'keys'));
const now = () => Math.floor(Date.now() / 1000);
const claims = o => Object.assign({ iss: P, aud: 'mechanical', sub: 'sujit@rcl.test', name: 'Sujit', site: 'S1', siteName: 'VTR', role: 'admin', mods: [{ key: 'mechanical', name: 'Mechanical' }], sites: [{ code: 'S1', name: 'VTR' }], iat: now(), exp: now() + 60, jti: crypto.randomBytes(16).toString('hex') }, o || {});
const ticket = async o => keys.sign(claims(o));
const userRow = e => sql('rcl', "select active || '|' || admin || '|' || split_part(password_hash, '$', 1) from app_users where email = '" + e + "'");
const SAPW = 'Super#Admin2040', PW = 'Nashik#Road848!';

(async () => {
  // ---- the start: Mechanical's users kept aside (put back at the end), an empty Portal, the users brought over ----
  sql('rcl', "drop table if exists public._t91_users; create table public._t91_users as select * from public.app_users; drop table if exists public._t91_us; create table public._t91_us as select * from public.rcl_user_sites; " +
    "delete from rcl_super_admin; delete from web.cache where key like 'SA%' or key like 'F\\_%' or key like 'LG\\_%' or key like 'SSO\\_%'; delete from public.app_users where email like '%@portal91.test';");
  sql('rcl_s2', "delete from web.cache where key like 'SSO\\_%' or key like 'F\\_%'; delete from public.app_users where email like '%@portal91.test';");
  sql('rcl_portal', "truncate public.access, public.sessions, public.audit, public.counters, public.signing_keys, public.users, public.sites, public.companies cascade; update public.modules set url = null, status = 'live' where key = 'mechanical'; delete from public.modules where key <> 'mechanical';");
  execSync('timeout 60 bash /home/claude/rig/portal_srv.sh');      // a fresh Portal server: it forgets the signing key of the emptied database
  const a = await call(PLAIN, null, 'login', 'sujit@rcl.test', PW);
  const mk = await call(PLAIN, 'S1', 'api', a.result.token, 'createSuperAdmin', [{ email: 'sa@rcl.test', name: 'Owner', password: SAPW, password2: SAPW }]);
  ok('rig: Mechanical Super Admin made', !!(mk.result && mk.result.recovery), mk.error);
  const B = portalBrowser();
  let r = await B.req('/api/setup', { action: 'import', email: 'sa@rcl.test', password: SAPW });
  ok('rig: the Portal brought the users over', r.status === 200 && r.j.users >= 3, r.j);
  await wait(16000);      // Mechanical's memory of the list of sites (15 s)

  // ---- linked or not ----
  let o = await call(LINKED, null, 'orgInfo');
  ok('a server with PORTAL_URL tells the page the Portal\'s address', o.result && o.result.portal === P, o.result && o.result.portal);
  o = await call(PLAIN, null, 'orgInfo');
  ok('a server without it: nothing about a Portal (as live today)', o.result && o.result.customer && o.result.portal === undefined, o.result);

  // ---- the real way: sign in on the Portal, press Mechanical ----
  r = await B.req('/api/auth', { action: 'login', email: 'sujit@rcl.test', password: PW });
  ok('sujit signs in on the Portal with his Mechanical password', r.status === 200, r.j);
  r = await B.req('/api/go?module=mechanical&site=S1');
  const t1 = String(r.loc || '').split('#sso=')[1] || '';
  ok('the Portal sends him to Mechanical with a ticket after "#"', r.status === 302 && String(r.loc).startsWith('http://127.0.0.1:3000/#sso=') && t1.split('.').length === 3, r.loc);
  let s = await call(LINKED, null, 'ssoLogin', t1);
  ok('Mechanical accepts the ticket: a session on S1 for sujit', s.result && s.result.token && s.result.user.email === 'sujit@rcl.test' && s.result.site === 'S1', s.error || s.result);
  ok('   the answer carries the Portal\'s address and his modules / sites (for "Modules")', s.result && s.result.portal.url === P && s.result.portal.mods.some(m => m.key === 'mechanical') && s.result.portal.sites.some(x => x.code === 'S1'), s.result && s.result.portal);
  const tok = s.result && s.result.token;
  let w = await call(LINKED, 'S1', 'api', tok, 'getInit', []);
  ok('   the session opens the app (getInit) with his own pages', w.result && w.result.user && w.result.user.admin === true, w.error);
  ok('   the Activity Log says "Signed in through the Portal"', sql('rcl', "select count(*) from public.activity_log where summary = 'Signed in through the Portal' and email = 'sujit@rcl.test'") !== '0');
  ok('   the session lasts 12 hours at most (its 4th part)', /\|43200000$/.test(sql('rcl', "select value from web.cache where key = 'S_" + tok + "'")));
  s = await call(LINKED, null, 'ssoLogin', t1);
  ok('the same ticket a second time: refused (401)', s.status === 401 && /already used/.test(s.error || ''), s);
  s = await call(PLAIN, null, 'ssoLogin', t1);
  ok('a server NOT linked to the Portal refuses any ticket', /not linked to the Portal/.test(s.error || ''), s.error);

  // ---- tickets that must never open anything ----
  const good = await ticket(), [h, b, g] = good.split('.');
  const body = JSON.parse(Buffer.from(b, 'base64url').toString()); body.sub = 'view@rcl.test';
  s = await call(LINKED, null, 'ssoLogin', h + '.' + Buffer.from(JSON.stringify(body)).toString('base64url') + '.' + g);
  ok('a ticket changed after signing (another email): refused', /signature does not match/.test(s.error || ''), s.error);
  const fake = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
  const fh = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: JSON.parse(Buffer.from(h, 'base64url').toString()).kid })).toString('base64url'), fb = Buffer.from(JSON.stringify(claims())).toString('base64url');
  s = await call(LINKED, null, 'ssoLogin', fh + '.' + fb + '.' + crypto.sign('sha256', Buffer.from(fh + '.' + fb), { key: fake, dsaEncoding: 'ieee-p1363' }).toString('base64url'));
  ok('a ticket signed with another key (same key name): refused', /signature does not match/.test(s.error || ''), s.error);
  for (const [name, o2, re] of [
    ['ran out (2 minutes old)', { iat: now() - 120, exp: now() - 60 }, /ran out/],
    ['made for another module (store)', { aud: 'store' }, /another module/],
    ['made by another Portal', { iss: 'https://evil.example' }, /another Portal/],
    ['valid for longer than 2 minutes', { exp: now() + 3600 }, /no proper time/],
    ['for a site that is not set up (ZZ)', { site: 'ZZ' }, /not set up/],
    ['without a proper ticket number', { jti: 'x' }, /no ticket number/],
    ['without a proper email', { sub: 'nobody' }, /no proper email/]]) {
    s = await call(LINKED, null, 'ssoLogin', await ticket(o2));
    ok('a ticket ' + name + ': refused', re.test(s.error || ''), s.error);
  }
  s = await call(LINKED, null, 'ssoLogin', 'not-a-ticket');
  ok('rubbish instead of a ticket: refused', /not a ticket/.test(s.error || ''), s.error);

  // ---- the Portal decides who is on the site ----
  s = await call(LINKED, null, 'ssoLogin', await ticket({ sub: 'new1@portal91.test', name: 'New One', role: 'user' }));
  ok('a person new to Mechanical: written into its Users and let in', s.result && s.result.token, s.error);
  ok('   active, not Admin, a password nobody knows (not a one-time one)', userRow('new1@portal91.test') === 'Yes|No|scrypt', userRow('new1@portal91.test'));
  ok('   NO page open until the site\'s Admin gives pages', sql('rcl', "select count(*) from app_users where email = 'new1@portal91.test' and 'Edit' in (perm_dashboard, perm_master, perm_log_book, perm_diesel_issue, perm_reports)") === '0' && s.result && Object.values(s.result.user.perms).every(v => v === 'None'), s.result && s.result.user.perms);
  w = await call(LINKED, 'S1', 'api', s.result.token, 'whoami', []);
  ok('   his session works (whoami)', w.result === true, w.error);
  ok('   the Activity Log has the line with what was done', sql('rcl', "select changes from public.activity_log where email = 'new1@portal91.test' and summary = 'Signed in through the Portal' order by 1 desc limit 1").includes('new user on this site'));
  s = await call(LINKED, null, 'ssoLogin', await ticket({ sub: 'view@rcl.test', name: 'view', role: 'admin' }));
  ok('Admin given in the Portal → Admin in Mechanical', s.result && userRow('view@rcl.test').startsWith('Yes|Yes|'), s.error || userRow('view@rcl.test'));
  s = await call(LINKED, null, 'ssoLogin', await ticket({ sub: 'view@rcl.test', name: 'view', role: 'user' }));
  ok('   taken back in the Portal → not Admin in Mechanical (at his next sign-in)', s.result && userRow('view@rcl.test').startsWith('Yes|No|'), s.error || userRow('view@rcl.test'));
  sql('rcl', "update app_users set active = 'No', updated_at = now() where email = 'none@rcl.test'");
  await wait(1500);
  s = await call(LINKED, null, 'ssoLogin', await ticket({ sub: 'none@rcl.test', name: 'none', role: 'user' }));
  ok('a person switched off in Mechanical but given the site in the Portal: switched on', s.result && userRow('none@rcl.test').startsWith('Yes|'), s.error || userRow('none@rcl.test'));
  sql('rcl', "update app_users set password_hash = 'tmp$' || password_hash, updated_at = now() where email = 'view@rcl.test'");
  await wait(1500);
  s = await call(LINKED, null, 'ssoLogin', await ticket({ sub: 'view@rcl.test', name: 'view', role: 'user' }));
  w = s.result ? await call(LINKED, 'S1', 'api', s.result.token, 'whoami', []) : {};
  ok('a one-time password left in Mechanical does not block him (replaced by one nobody knows)', w.result === true && userRow('view@rcl.test') === 'Yes|No|scrypt', (s.error || w.error) + ' ' + userRow('view@rcl.test'));

  // ---- another site (its own database) ----
  s = await call(LINKED, null, 'ssoLogin', await ticket({ site: 'T2', siteName: 'Test Site T2', role: 'user' }));
  ok('a ticket for T2: a session on T2\'s own database', s.result && s.result.site === 'T2', s.error || s.result);
  w = s.result ? await call(LINKED, 'T2', 'api', s.result.token, 'whoami', []) : {};
  ok('   it works on T2', w.result === true, w.error);
  ok('   and NOT on S1 (one site per session)', (await call(LINKED, 'S1', 'api', s.result.token, 'whoami', [])).error === 'SESSION_EXPIRED');
  ok('   sujit is now on T2 in T2\'s Users and in the list of sites', sql('rcl_s2', "select active from app_users where email = 'sujit@rcl.test'") === 'Yes' && sql('rcl', "select count(*) from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'") === '1');

  // ---- 12 hours at most ----
  sql('rcl', "update web.cache set value = regexp_replace(value, '\\|[0-9]+\\|43200000$', '|' || ((extract(epoch from now()) * 1000)::bigint - 13 * 3600000) || '|43200000') where key = 'S_" + tok + "'");
  w = await call(LINKED, 'S1', 'api', tok, 'whoami', []);
  ok('a Portal sign-in 13 hours old has ended (401 – the page then asks the Portal again)', w.status === 401 && w.error === 'SESSION_EXPIRED', w);

  // ---- the reserve and nothing else changed ----
  const loc = await call(LINKED, null, 'login', 'sujit@rcl.test', PW);
  ok('the app\'s own sign-in still works on the linked server (the reserve, ?local=1)', loc.result && loc.result.token && /^scrypt\$/.test(sql('rcl', "select password_hash from app_users where email = 'sujit@rcl.test'")), loc.error);
  w = await call(LINKED, 'S1', 'api', loc.result.token, 'whoami', []);
  ok('   and its session works', w.result === true);

  // ---- put Mechanical's users back as they were ----
  sql('rcl', "delete from public.app_users where email like '%@portal91.test'; update public.app_users u set active = b.active, admin = b.admin, password_hash = b.password_hash, updated_at = now() from public._t91_users b where b.email = u.email; " +
    "delete from public.rcl_user_sites; insert into public.rcl_user_sites select * from public._t91_us; drop table public._t91_users; drop table public._t91_us;");
  sql('rcl_s2', "delete from public.app_users where email like '%@portal91.test';");
  ok('Mechanical\'s users put back', userRow('view@rcl.test') === 'Yes|No|scrypt' && userRow('none@rcl.test') === 'Yes|No|scrypt' && sql('rcl', "select count(*) from app_users where email like '%@portal91.test'") === '0');
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - T0) / 1000) + ' s)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e.stack || e)); process.exit(2); });
