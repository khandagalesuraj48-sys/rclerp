/* Stage 1 of "new site" (asked 12-10-2026): one app, several sites, each with its own database – the server is ready.
 * On the local rig: the first site = database rcl (door :3100), a second site "T2" = database rcl_s2 (door :3102).
 * (update-90) T2 is in the list of sites (rcl_sites, its key locked – test/site90api.js puts it there; RCL_SITES_KEY of the app
 * servers) and sujit@ is a user of it (rcl_user_sites). App servers: :3000 (helper threads as usual) and :3001 (ONE helper
 * thread – every request of both sites goes through the same thread and its memory).
 *   node test/site89.js
 * Proves: the first site works as before (no site sent); a sign-in belongs to its site only; the data of one site is never seen
 * on the other – also when requests of the two sites take turns in one thread; a save on T2 does not change ONE row of the first
 * site's database (every table compared before / after); a site that is not set up is refused; T2 has no Sheet → its backup is
 * refused, never written to the first site's Sheet. */
const { execSync } = require('child_process');
const T0 = Date.now(); let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const call = async (port, site, fn, ...args) => {
  const body = { fn, args }; if (site !== null) body.site = site;
  const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const j = await r.json(); return Object.assign({ status: r.status }, j);
};
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
// every table of the first site's database, row by row (a checksum of each table's content)
const snapshot = db => {
  const tabs = sql(db, "select table_schema||'.'||table_name from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','web') order by 1").split('\n').filter(Boolean);
  const o = {}; tabs.forEach(t => { o[t] = sql(db, 'select count(*)||\':\'||coalesce(md5(string_agg(md5(x::text), \'\' order by md5(x::text))),\'-\') from ' + t + ' x'); }); return o;
};
const PASS = 'Nashik#Road848!', EMAIL = 'sujit@rcl.test';
(async () => {
  sql('rcl', "insert into rcl_user_sites (email, site, is_admin) values ('sujit@rcl.test', 'T2', true) on conflict (email, site) do nothing; update rcl_user_sites set is_default = false where email = 'sujit@rcl.test';");
  for (const port of [3000, 3001]) {
    const P = ':' + port + ' ';
    // the first site, as before (no site sent)
    const a = await call(port, null, 'login', EMAIL, PASS);
    ok(P + 'first site: sign-in as before (no site sent)', a.result && a.result.token, a.error);
    const tA = a.result.token;
    const vtrIssues = await call(port, null, 'api', tA, 'getDieselIssues', [{ from: '2000-01-01', to: '2099-12-31', all: true }]);
    const nA = ((vtrIssues.result || {}).rows || []).length;
    ok(P + 'first site: its diesel issues are read', nA > 0, nA + ' rows ' + (vtrIssues.error || ''));
    const same = await call(port, '', 'api', tA, 'getDieselIssues', [{ from: '2000-01-01', to: '2099-12-31', all: true }]);
    ok(P + 'site "" = the first site (same answer)', ((same.result || {}).rows || []).length === nA);
    const org1 = await call(port, null, 'orgInfo');

    // (update-90) a person's password is proved on his FIRST site, then the site he asked for gets its session
    const b = await call(port, null, 'login', EMAIL, PASS, { site: 'T2' });
    ok(P + 'T2: sign-in – a session in T2\'s own database', b.result && b.result.token && b.result.site === 'T2', b.error);
    const tB = b.result.token;
    // the first site's database is photographed NOW – everything that follows on T2 must leave it exactly as it is
    const before = snapshot('rcl');
    const x1 = await call(port, 'T2', 'api', tA, 'getDieselIssues', [{}]);
    ok(P + 'the first site\'s sign-in is NOT valid on T2', /SESSION_EXPIRED/.test(x1.error || ''), x1.error);
    const t2Issues = await call(port, 'T2', 'api', tB, 'getDieselIssues', [{ from: '2000-01-01', to: '2099-12-31', all: true }]);
    ok(P + 'T2: no diesel issues (a blank site) – the first site\'s are not seen', !t2Issues.error && ((t2Issues.result || {}).rows || []).length === 0, t2Issues.error || ((t2Issues.result || {}).rows || []).length);
    // the two sites take turns – the same thread on :3001
    let mixed = 0;
    for (let i = 0; i < 6; i++) {
      const v = await call(port, null, 'api', tA, 'getDieselIssues', [{ from: '2000-01-01', to: '2099-12-31', all: true }]);
      const t = await call(port, 'T2', 'api', tB, 'getDieselIssues', [{ from: '2000-01-01', to: '2099-12-31', all: true }]);
      if (((v.result || {}).rows || []).length !== nA || ((t.result || {}).rows || []).length !== 0) mixed++;
    }
    ok(P + 'the two sites take turns 6 times: every answer from its own site (memory not mixed)', mixed === 0, mixed);
    // a save on T2
    const vend = 'T2 Vendor ' + port + ' ' + Date.now().toString(36);
    const sv = await call(port, 'T2', 'api', tB, 'saveVendor', [{ name: vend, gstReg: 'No', pan: 'ABCPE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add']);
    ok(P + 'T2: a vendor saved', !sv.error, sv.error);
    ok(P + '   it is in T2\'s database, not in the first site\'s', sql('rcl_s2', "select count(*) from public.vendors where vendor_name = '" + vend + "'") === '1' && sql('rcl', "select count(*) from public.vendors where vendor_name = '" + vend + "'") === '0');
    const vT2 = await call(port, 'T2', 'api', tB, 'getVendors', []), vA = await call(port, null, 'api', tA, 'getVendors', []);
    const has = r => JSON.stringify(r.result || '').indexOf(vend) > -1;
    ok(P + '   T2 lists it; the first site does not', has(vT2) && !has(vA), [vT2.error, vA.error]);
    const so = await call(port, 'T2', 'api', tB, 'saveOrgSettings', [{ customer: 'Sketchline Test ' + port, site: 'Site T2', logo: '', video: '', billNames: ['Sketchline Test'] }]);
    ok(P + 'T2: its company name saved', !so.error, so.error);
    const org2 = await call(port, 'T2', 'api', tB, 'getInit', []), org1b = await call(port, null, 'orgInfo');
    ok(P + '   T2\'s app shows it; the first site\'s is unchanged', JSON.stringify((org2.result || {}).org || '').indexOf('Sketchline Test ' + port) > -1 && JSON.stringify(org1b.result) === JSON.stringify(org1.result), [org2.error || (org2.result || {}).org, org1b.result]);
    const org3 = await call(port, 'T2', 'orgInfo');
    ok(P + '   the sign-in screen (nobody signed in) never gives out another site\'s name – the first site\'s', JSON.stringify(org3.result) === JSON.stringify(org1.result), org3.result);
    const bk = await call(port, 'T2', 'api', tB, 'backupNow', []);
    const bkText = JSON.stringify(bk);
    ok(P + 'T2 has no Sheet: its backup is refused ("not set up") – nothing goes to the first site\'s Sheet', /not set up/.test(bkText), bkText);
    const lo = await call(port, 'T2', 'logout', tB);
    ok(P + 'T2: sign-out', !lo.error, lo.error);

    const after = snapshot('rcl');
    const changed = Object.keys(before).filter(k => before[k] !== after[k]).concat(Object.keys(after).filter(k => !(k in before)));
    ok(P + 'the first site\'s database: ' + Object.keys(before).length + ' tables, NOT ONE row changed by all of T2\'s work', changed.length === 0, changed);

    const a2 = await call(port, null, 'api', tA, 'getDieselIssues', [{ from: '2000-01-01', to: '2099-12-31', all: true }]);
    ok(P + 'the first site afterwards: the same sign-in and the same rows', ((a2.result || {}).rows || []).length === nA, a2.error);
    const z = await call(port, 'ZZ', 'api', tA, 'whoami', []);
    ok(P + 'a site that is not set up: refused (404), nothing read', z.status === 404 && /This site is not set up \(ZZ\)/.test(z.error || ''), [z.status, z.error]);
    const w = await call(port, 'a b', 'api', tA, 'whoami', []);
    ok(P + 'a wrong site code: refused', /This site is not set up/.test(w.error || ''), w.error);
    await call(port, null, 'logout', tA);
  }
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - T0) / 1000) + ' s)');
  console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
