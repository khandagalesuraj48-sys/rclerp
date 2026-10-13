/* update-95 ("New site" from the Portal) – end to end on the local rig, never live:
 *   the Portal :3010 (Super Admin) → its server → Mechanical :3000 (linked) → a BLANK third database rcl_s3 behind :3104.
 *   It restarts the rig twice (bash /home/claude/rig/all.sh): first WITHOUT the site's key in the server's settings, then WITH
 *   it (SITE_N3_KEY) – as the Super Admin adds it in Vercel and redeploys.
 *   node test/newsite95.js
 * The test sets its own start (an empty Portal, the users brought over, a blank rcl_s3) and takes site N3 out at the end. */
'use strict';
const { execSync } = require('child_process');
let pass = 0, fail = 0; const out = [], T0 = Date.now();
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const wait = ms => new Promise(r => setTimeout(r, ms));
const P = 'http://127.0.0.1:3010', M = 'http://127.0.0.1:3000', N3 = 'http://127.0.0.1:3104';
const rig = env => execSync('PORTAL=1 ' + (env || '') + ' timeout 150 bash /home/claude/rig/all.sh', { stdio: 'pipe' }).toString().trim();
function browser() {
  let cookie = '';
  const req = async (p, body) => {
    const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const go = () => fetch(P + p, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(90000) });
    let r; try { r = await go(); } catch (e) { await wait(1000); r = await go(); }      // (a kept connection to a server the rig just restarted)
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; cookie = /=$/.test(v) ? '' : v; }
    let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { j = {}; }
    return { status: r.status, j: j, loc: r.headers.get('location') };
  };
  return { req };
}
const mech = async (fn, args, site) => (await (await fetch(M + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ fn, args }, site ? { site } : {})), signal: AbortSignal.timeout(90000) })).json());
const SAPW = 'Super#Admin2040', PW = 'Nashik#Road848!';
const steps = r => (r.j.steps || []).map(x => x.step + (x.ok ? '✓' : '✗')).join(' ');

(async () => {
  // ---- the start: a blank rcl_s3, no N3 anywhere, the Portal set up afresh – the rig WITHOUT the site's key ----
  sql('postgres', 'drop database if exists rcl_s3 with (force);'); sql('postgres', 'create database rcl_s3;');
  execSync('timeout 60 su postgres -c "pg_dump -s -n storage rcl_s2" | timeout 60 su postgres -c "psql -q -d rcl_s3"');
  sql('rcl', "delete from rcl_user_sites where site = 'N3'; delete from rcl_sites where code = 'N3'; delete from rcl_super_admin; delete from web.cache where key like 'SA%' or key like 'F\\_%' or key like 'LG\\_%' or key like 'SSO\\_%';");
  sql('rcl_portal', "truncate public.access, public.sessions, public.audit, public.counters, public.signing_keys, public.users, public.sites, public.companies cascade; update public.modules set url = null, status = 'live' where key = 'mechanical'; delete from public.modules where key <> 'mechanical';");
  ok('rig started without SITE_N3_KEY', /rig up/.test(rig('NSKEY=0')));
  const a = await mech('login', ['sujit@rcl.test', PW]);
  await mech('api', [a.result.token, 'createSuperAdmin', [{ email: 'sa@rcl.test', name: 'Owner', password: SAPW, password2: SAPW }]], 'S1');
  const S = browser();
  let r = await S.req('/api/setup', { action: 'import', email: 'sa@rcl.test', password: SAPW });
  ok('rig: the Portal brought the users over', r.status === 200, r.j);
  r = await S.req('/api/auth', { action: 'login', email: 'sa@rcl.test', password: SAPW });
  ok('the Super Admin signs in on the Portal', r.status === 200 && r.j.user.super, r.j);
  const comp = sql('rcl_portal', 'select id from companies order by id limit 1');

  // ---- the form, step by step ----
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'n3', name: 'Test Site N3', company: comp, url: 'https://example.com' });
  ok('a link that is not a Supabase project: step 1 says so (rig: only this computer\'s address is taken)', r.status === 200 && r.j.steps[0].step === 'link' && !r.j.steps[0].ok && !r.j.ready, r.j);
  ok('   the site is in the Portal\'s list – Closed until it is ready (nobody can open it)', sql('rcl_portal', "select status from sites where code = 'N3'") === 'closed');
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'N3', name: 'Test Site N3', company: comp, url: 'http://127.0.0.1:3102' });
  ok('the database of another site (T2): refused', /belongs to another site/.test(JSON.stringify(r.j.steps)), r.j);
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'S1', name: 'VTR', company: comp, url: N3 });
  ok('the first site: refused (already set up)', /first site/.test(JSON.stringify(r.j.steps)), r.j);
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'N3', name: 'Test Site N3', company: comp, url: N3 });
  ok('step 2: the key is not in the server\'s settings – the form names it: SITE_N3_KEY', steps(r) === 'link✓ key✗' && r.j.keyName === 'SITE_N3_KEY', r.j);
  ok('   no key travels through the Portal (nothing in its answer, nothing in its database)', !/sb_secret/.test(JSON.stringify(r.j)) && sql('rcl_portal', "select count(*) from audit where detail::text like '%sb_secret%'") === '0');

  // ---- the key is added in "Vercel" and the server redeployed ----
  ok('rig restarted WITH SITE_N3_KEY', /rig up/.test(rig('NSKEY=1')));
  await S.req('/api/auth', { action: 'me' });
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'N3', name: 'Test Site N3', company: comp, url: N3 });
  ok('steps 3–4: the database answers; Mechanical\'s tables are not there yet', steps(r) === 'link✓ key✓ connect✓ tables✗' && !r.j.ready, r.j);
  r = await S.req('/api/admin', { action: 'siteSql' });
  ok('"Copy the SQL": every step of Mechanical in one piece (not the keep-awake timer, not step 7)', r.status === 200 && r.j.sql.length > 50000 && r.j.files.length >= 25 && !r.j.files.some(f => /step6|step7/.test(f)), r.j.files);
  require('fs').writeFileSync('/tmp/newsite95.sql', r.j.sql); execSync('chmod 644 /tmp/newsite95.sql');
  execSync('timeout 120 su postgres -c "psql -d rcl_s3 -v ON_ERROR_STOP=1 -q -f /tmp/newsite95.sql"', { stdio: 'pipe' });
  ok('   it runs in a blank database without one error', true);
  await wait(1500);
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'N3', name: 'Test Site N3', company: comp, url: N3 });
  ok('steps 4–6: tables there, company settings copied, Ready', steps(r) === 'link✓ key✓ connect✓ tables✓ company✓ ready✓' && r.j.ready, r.j);
  ok('   the Portal lists N3 as Active', sql('rcl_portal', "select status from sites where code = 'N3'") === 'active');
  ok('   Mechanical\'s list: N3 ready, its key NOT stored (it stays in the server\'s settings)', sql('rcl', "select status || '|' || coalesce(db_key_enc, '-') || '|' || db_url from rcl_sites where code = 'N3'") === 'ready|-|' + N3);
  const org = sql('rcl_s3', "select value from web.props where key = 'ORG_SETTINGS'");
  ok('   company settings: the first site\'s company and bill names, the new site\'s own name', /"site":"Test Site N3"/.test(org) && /"billNames":\[/.test(org), org);
  ok('   nothing of another site is copied: no machinery, no entries, no users', sql('rcl_s3', 'select (select count(*) from master) + (select count(*) from log_book) + (select count(*) from diesel_issue) + (select count(*) from app_users)') === '0');

  // ---- people: given in the Portal, they open N3 through it ----
  r = await S.req('/api/admin', { action: 'accessSet', email: 'sujit@rcl.test', site: 'N3', module: 'mechanical', role: 'admin' });
  ok('the Super Admin gives sujit Mechanical on N3 (Admin)', r.status === 200, r.j);
  r = await S.req('/api/admin', { action: 'mechPages', site: 'N3' });
  ok('   "Pages" for N3 works (nobody in N3 yet)', r.status === 200 && r.j.users.length === 0 && r.j.pages.length > 10, r.j);
  const U = browser();
  r = await U.req('/api/auth', { action: 'login', email: 'sujit@rcl.test', password: PW });
  r = await U.req('/api/go?module=mechanical&site=N3');
  const t = String(r.loc || '').split('#sso=')[1] || '';
  ok('sujit opens Mechanical on N3 from the Portal', !!t, r.loc);
  const s = await mech('ssoLogin', [t]);
  ok('   a session on N3', s.result && s.result.site === 'N3', s.error);
  const w = await mech('api', [s.result.token, 'whoami', []], 'N3');
  ok('   it works on N3\'s own database; he is written into N3\'s Users as Admin', w.result === true && sql('rcl_s3', "select admin from app_users where email = 'sujit@rcl.test'") === 'Yes', w.error);
  const o = await mech('api', [s.result.token, 'getInit', []], 'N3');
  ok('   the app on N3 shows its own name', o.result && o.result.siteInfo && o.result.siteInfo.name === 'Test Site N3', o.result && o.result.siteInfo);

  // ---- pressed again: nothing changes, the site's own settings are kept ----
  sql('rcl_s3', "update web.props set value = replace(value, 'Test Site N3', 'N3 own name') where key = 'ORG_SETTINGS'");
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'N3', name: 'Test Site N3', company: comp, url: N3 });
  ok('"Check" again on a ready site: still ready, its own company settings kept', r.j.ready && /N3 own name/.test(sql('rcl_s3', "select value from web.props where key = 'ORG_SETTINGS'")), r.j);
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'N3', name: 'Test Site N3', company: comp, url: 'http://127.0.0.1:3100' });
  ok('   a ready site cannot be moved to another database', !r.j.ready && /another database|belongs to another site/.test(JSON.stringify(r.j.steps)), r.j);
  // ---- (asked 13-10-2026) the Super Admin deletes N3 in the Portal, then brings it back with "New site" ----
  await S.req('/api/admin', { action: 'siteSave', code: 'N3', name: 'Test Site N3', company: comp, status: 'closed' });
  r = await S.req('/api/admin', { action: 'siteDelete', code: 'N3', confirm: 'N3' });
  ok('deleted in the Portal (Closed, its code typed): gone there, "closed" in Mechanical\'s list', r.status === 200 && sql('rcl_portal', "select count(*) from sites where code = 'N3'") === '0' && sql('rcl', "select status from rcl_sites where code = 'N3'") === 'closed', r.j);
  ok('   its own database is untouched (its settings, its users)', /N3 own name/.test(sql('rcl_s3', "select value from web.props where key = 'ORG_SETTINGS'")) && sql('rcl_s3', "select count(*) from app_users where email = 'sujit@rcl.test'") === '1');
  const gone = await mech('api', [s.result.token, 'whoami', []], 'N3');
  ok('   a session still open on N3 can do nothing more there', !!gone.error && /not set up/.test(gone.error), gone);
  r = await U.req('/api/go?module=mechanical&site=N3');
  ok('   and nobody gets a ticket for it', !/#sso=/.test(String(r.loc || '')), r.loc);
  r = await S.req('/api/admin', { action: 'siteSetup', code: 'N3', name: 'Test Site N3', company: comp, url: N3 });
  ok('"New site" with the same link brings it back: Ready, Active, its own settings kept', r.j.ready && sql('rcl_portal', "select status from sites where code = 'N3'") === 'active' && sql('rcl', "select status from rcl_sites where code = 'N3'") === 'ready' && /N3 own name/.test(sql('rcl_s3', "select value from web.props where key = 'ORG_SETTINGS'")), r.j);
  const U2 = browser(); await U2.req('/api/auth', { action: 'login', email: 'view@rcl.test', password: 'Audit#PassView9!x' });
  r = await U2.req('/api/admin', { action: 'siteSetup', code: 'N9', name: 'x', url: N3 });
  ok('nobody but the Super Admin can make a site', r.status === 403, r.status);

  // ---- the end: N3 taken out again ----
  sql('rcl', "delete from rcl_user_sites where site = 'N3'; delete from rcl_sites where code = 'N3';");
  sql('rcl_portal', "delete from access where site = 'N3'; delete from sites where code = 'N3';");
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - T0) / 1000) + ' s)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e.stack || e)); process.exit(2); });
