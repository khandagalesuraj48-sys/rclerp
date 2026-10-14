/* update-106 – the Vendor Master common to every site, through the server's own door (/api/rpc) on the local rig:
 *   S1 = database rcl (:3100), T2 = database rcl_s2 (:3102), app server :3001. Test data only; the vendors of both sites and the
 *   test's changes are put back at the end. Run it on a freshly started rig (rig/all.sh): the test takes the column away first, and
 *   a server that read the table with it would still have it in its memory.      node test/vendors106api.js
 * Checks: a vendor made at S1 is copied to T2 (owner S1); at T2 it cannot be changed or deleted (who and where are said); a vendor
 * made at T2 reaches S1; a rename at S1 follows at T2 with what holds the name there (a BOQ); a vendor used at T2 is not deleted at
 * S1; deleted at both once free; "Vendors of all sites": check (what would change) and bring together; before step 1y nothing
 * of this happens (each site its own, as before). */
const { execSync } = require('child_process');
const T0 = Date.now(); let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const PORT = 3001, PW = 'Nashik#Road848!';
const call = async (site, fn, ...args) => {
  const b = { fn, args }; if (site) b.site = site;
  const r = await fetch('http://127.0.0.1:' + PORT + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(120000) });
  return Object.assign({ status: r.status }, await r.json());
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const DUMP = '/tmp/claude-0/vendors106';
(async () => {
  execSync('mkdir -p ' + DUMP);
  for (const db of ['rcl', 'rcl_s2']) execSync('timeout 60 su postgres -c "pg_dump --data-only -t public.vendors -t public.boq ' + db + '" > ' + DUMP + '/' + db + '.sql');
  const was2 = sql('rcl_s2', "select admin || '|' || coalesce(perm_vendor_master,'') from app_users where email = 'sujit@rcl.test'");
  const cleanup = () => {
    for (const db of ['rcl', 'rcl_s2']) { sql(db, 'delete from public.boq; delete from public.vendors;'); execSync('timeout 60 su postgres -c "psql -q -d ' + db + '" < ' + DUMP + '/' + db + '.sql');
      sql(db, "update public.vendors set updated_at = now() + interval '1 second'; update public.boq set updated_at = now() + interval '1 second'; delete from web.cache where key like 'SBCOL%';"); }
    sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'");
    const w = was2.split('|'); sql('rcl_s2', "update app_users set admin = '" + w[0] + "', perm_vendor_master = '" + w[1] + "' where email = 'sujit@rcl.test'");
  };
  try {
    // ---- the start: sujit is Admin at both sites; no step 1y yet ----
    for (const db of ['rcl', 'rcl_s2']) sql(db, "alter table public.vendors drop column if exists owner_site; notify pgrst, 'reload schema'; delete from web.cache where key like 'SBCOL%'; delete from public.vendors where vendor_name like 'V106 %'; delete from public.boq where vendor_name like 'V106 %';");
    sql('rcl', "insert into rcl_user_sites (email, site, is_admin, is_default) values ('sujit@rcl.test', 'T2', true, false) on conflict (email, site) do update set is_admin = true");
    sql('rcl_s2', "update app_users set admin = 'Yes', perm_vendor_master = 'Edit', updated_at = now() + interval '1 second' where email = 'sujit@rcl.test'");
    await wait(16500);      // the servers' memory of the list of sites (15 s)
    const signIn = async site => { const a = await call(null, 'login', 'sujit@rcl.test', PW); let t = a.result.token;
      if (site !== 'S1') { const s = await call(null, 'switchSite', t, site); t = s.result.token; } return t; };
    const api = async (site, tok, action, ...a) => { const r = await call(site, 'api', tok, action, a); return r.error ? { ERROR: r.error } : r.result; };
    let s1 = await signIn('S1'); const t2 = await signIn('T2'); s1 = await signIn('S1');
    ok('signed in at S1 and at T2 (Admin at both)', !!s1 && !!t2);
    const V = { gstReg: 'No', pan: 'ABCPV1061A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' };
    let r = await api('S1', s1, 'saveVendor', Object.assign({ name: 'V106 Before Step' }, V), 'add');
    ok('before step 1y: a vendor saved at S1 stays at S1 only (as before)', r.ok && r.spread === null && sql('rcl_s2', "select count(*) from vendors where vendor_name = 'V106 Before Step'") === '0', r);
    r = await api('S1', s1, 'getBoqs', {});
    ok('   the page is told the step is needed', r.vshare && r.vshare.on === false && r.vshare.here === 'S1', r.vshare);
    // ---- step 1y at both sites (the SQL file itself) ----
    const step = require('fs').readFileSync(require('path').join(__dirname, '..', 'sql', 'supabase_step1y_vendor_owner.sql'), 'utf8');
    for (const db of ['rcl', 'rcl_s2']) { sql(db, step); sql(db, step); sql(db, "delete from web.cache where key like 'SBCOL%'"); }      // (the app asked a minute ago: "not there" – kept 60 s; the test does not wait)
    ok('step 1y runs at both sites, and again (safe twice)', sql('rcl_s2', "select count(*) from information_schema.columns where table_name = 'vendors' and column_name = 'owner_site'") === '1');
    await wait(1500);
    r = await api('S1', s1, 'saveVendor', Object.assign({ name: 'V106 Alpha Infra' }, V), 'add');
    ok('a vendor made at S1: saved there (owner S1) and copied to T2 (owner S1)', r.ok && r.spread && r.spread.ok.length === 1 && !r.spread.failed.length && sql('rcl', "select owner_site from vendors where vendor_name = 'V106 Alpha Infra'") === 'S1' &&
      sql('rcl_s2', "select owner_site || '|' || ifsc_code || '|' || entered_by from vendors where vendor_name = 'V106 Alpha Infra'") === 'S1|SBIN0000001|Sujit', { r: r.spread, t2: sql('rcl_s2', "select owner_site || '|' || ifsc_code || '|' || entered_by from vendors where vendor_name = 'V106 Alpha Infra'") });
    r = await api('T2', t2, 'getBoqs', {});
    const a2 = (r.vendors || []).find(v => v.name === 'V106 Alpha Infra');
    ok('   at T2: shown, made at VTR NH 848 (not its own)', a2 && a2.mine === false && a2.ownerSite === 'S1' && a2.ownerName === 'VTR NH 848' && r.vshare.on === true, a2);
    r = await api('T2', t2, 'saveVendor', Object.assign({ name: 'V106 Alpha Infra', remark: 'changed at T2' }, V), 'edit');
    ok('   at T2 it cannot be changed: which site and who made it', r.ERROR && /was made at site VTR NH 848 by Sujit\. It can be changed or deleted only there/.test(r.ERROR) && sql('rcl_s2', "select coalesce(remark,'') from vendors where vendor_name = 'V106 Alpha Infra'") === '', r);
    r = await api('T2', t2, 'deleteVendor', 'V106 Alpha Infra');
    ok('   nor deleted', r.ERROR && /was made at site VTR NH 848/.test(r.ERROR) && sql('rcl_s2', "select count(*) from vendors where vendor_name = 'V106 Alpha Infra'") === '1', r);
    r = await api('T2', t2, 'saveVendor', Object.assign({ name: 'V106 Beta Supply' }, V), 'add');
    ok('a vendor made at T2 reaches S1 (owner T2)', r.ok && sql('rcl', "select owner_site from vendors where vendor_name = 'V106 Beta Supply'") === 'T2', r.spread || r);
    r = await api('S1', s1, 'saveVendor', Object.assign({ name: 'V106 Beta Supply', remark: 'x' }, V), 'edit');
    ok('   and S1 cannot change it', r.ERROR && /made at site Test Site T2/.test(r.ERROR), r);
    // ---- a rename at S1 follows at T2, with what holds the name there ----
    sql('rcl_s2', "insert into boq (id, boq_no, vendor_name, valid_from, lines, entered_at) values ('BOQ-V106', 'WO-V106', 'V106 Alpha Infra', '2026-09-01', '[]', now())");
    await wait(1200);
    r = await api('S1', s1, 'saveVendor', Object.assign({ oldName: 'V106 Alpha Infra', name: 'V106 Alpha Infra Pvt' }, V), 'edit');
    ok('a rename at S1: at T2 the vendor and its BOQ follow', r.ok && sql('rcl_s2', "select count(*) from vendors where vendor_name = 'V106 Alpha Infra Pvt'") === '1' && sql('rcl_s2', "select count(*) from vendors where vendor_name = 'V106 Alpha Infra'") === '0' &&
      sql('rcl_s2', "select vendor_name from boq where id = 'BOQ-V106'") === 'V106 Alpha Infra Pvt', { spread: r.spread, err: r.ERROR });
    r = await api('S1', s1, 'deleteVendor', 'V106 Alpha Infra Pvt');
    ok('a vendor used at T2 (its BOQ) is not deleted at S1 – said where', r.ERROR && /is used at site Test Site T2 \(1 BOQ\)/.test(r.ERROR) && sql('rcl', "select count(*) from vendors where vendor_name = 'V106 Alpha Infra Pvt'") === '1', r);
    sql('rcl_s2', "delete from boq where id = 'BOQ-V106'"); await wait(1200);
    r = await api('S1', s1, 'deleteVendor', 'V106 Alpha Infra Pvt');
    ok('   once free: deleted at S1 and at T2', r.ok && sql('rcl', "select count(*) from vendors where vendor_name like 'V106 Alpha%'") === '0' && sql('rcl_s2', "select count(*) from vendors where vendor_name like 'V106 Alpha%'") === '0', r.ERROR || r.spread);
    // ---- the vendors each site had before: brought together ----
    const n1 = Number(sql('rcl', 'select count(*) from vendors')), n2 = Number(sql('rcl_s2', 'select count(*) from vendors'));
    r = await api('S1', s1, 'vendorsTogether', { check: true });
    const union = new Set(sql('rcl', 'select upper(vendor_name) from vendors').split('\n').concat(sql('rcl_s2', 'select upper(vendor_name) from vendors').split('\n')).filter(Boolean)).size;
    ok('"Vendors of all sites" – check: the vendors of both sites, what each would get; nothing written yet', r.ok && r.check && r.vendors === union && r.sites.length === 2 && Number(sql('rcl', 'select count(*) from vendors')) === n1, { vendors: r.vendors, union, sites: r.sites, diffs: (r.diffs || []).length });
    r = await api('S1', s1, 'vendorsTogether', {});
    ok('   brought together: both sites have every vendor (' + union + '), each with its owner; nothing deleted', r.ok && !(r.failed || []).length && Number(sql('rcl', 'select count(*) from vendors')) === union && Number(sql('rcl_s2', 'select count(*) from vendors')) === union &&
      sql('rcl', 'select count(*) from vendors where owner_site is null') === '0' && sql('rcl_s2', 'select count(*) from vendors where owner_site is null') === '0' && Number(sql('rcl_s2', 'select count(*) from vendors')) >= n2, { r: r.failed, n1, n2, union });
    r = await api('S1', s1, 'vendorsTogether', { check: true });
    ok('   again: nothing left to do', r.ok && r.sites.every(x => !x.add && !x.update), r.sites);
    r = await api('T2', t2, 'getBoqs', {});
    ok('   T2 sees S1\'s old vendors as made at VTR NH 848', (r.vendors || []).some(v => v.saved && v.ownerSite === 'S1' && v.mine === false), (r.vendors || []).slice(0, 3));
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { cleanup(); } catch (e) { out.push('cleanup: ' + String(e.message).slice(0, 300)); } }
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - T0) / 1000) + ' s)');
  process.exit(fail ? 1 : 0);
})();
