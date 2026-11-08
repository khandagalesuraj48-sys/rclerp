/* update-111 – every site its own vendors, through the server's own door (/api/rpc) on the local rig:
 *   S1 = database rcl (:3100), T2 = database rcl_s2 (:3102), app server :3001. Test data only; the vendors, BOQs and payments of
 *   both sites are put back at the end.      node test/vendors111api.js
 * Checks: a vendor saved at S1 stays at S1 (nothing copied); one saved at T2 stays at T2; a COPY that update-106 had written at T2
 * (owner S1) is not shown, not a party to pick, not changed / deleted there; a copy that T2 already uses (a payment – the real
 * database is asked, with a name holding a comma and quotes) stays T2's vendor; a new vendor of the copy's name at T2 becomes T2's
 * own (the row taken over, nothing added twice); S1 is not touched by any of it. */
const { execSync } = require('child_process');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const PORT = 3001, PW = 'Nashik#Road848!';
const call = async (site, fn, ...args) => {
  const b = { fn, args }; if (site) b.site = site;
  const r = await fetch('http://127.0.0.1:' + PORT + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(120000) });
  return Object.assign({ status: r.status }, await r.json());
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const DUMP = '/tmp/claude-0/vendors111';
(async () => {
  execSync('mkdir -p ' + DUMP);
  for (const db of ['rcl', 'rcl_s2']) execSync('timeout 60 su postgres -c "pg_dump --data-only -t public.vendors -t public.boq -t public.payments ' + db + '" > ' + DUMP + '/' + db + '.sql');
  const was2 = sql('rcl_s2', "select admin || '|' || coalesce(perm_vendor_master,'') from app_users where email = 'sujit@rcl.test'");
  const cleanup = () => {
    for (const db of ['rcl', 'rcl_s2']) { sql(db, 'delete from public.boq; delete from public.vendors; delete from public.payments;'); execSync('timeout 60 su postgres -c "psql -q -d ' + db + '" < ' + DUMP + '/' + db + '.sql');
      sql(db, "update public.vendors set updated_at = now() + interval '1 second'; update public.boq set updated_at = now() + interval '1 second'; update public.payments set updated_at = now() + interval '1 second'; delete from web.cache where key like 'SBCOL%';"); }
    sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'");
    const w = was2.split('|'); sql('rcl_s2', "update app_users set admin = '" + w[0] + "', perm_vendor_master = '" + w[1] + "' where email = 'sujit@rcl.test'");
  };
  try {
    // ---- sujit is Admin at both sites; step 1y at both (as live may have it since update-106) ----
    const step = require('fs').readFileSync(require('path').join(__dirname, '..', 'sql', 'supabase_step1y_vendor_owner.sql'), 'utf8');
    for (const db of ['rcl', 'rcl_s2']) { sql(db, step); sql(db, "delete from public.vendors where vendor_name like 'V111 %'; delete from public.payments where vendor_name like 'V111 %'; delete from web.cache where key like 'SBCOL%';"); }
    sql('rcl', "insert into rcl_user_sites (email, site, is_admin, is_default) values ('sujit@rcl.test', 'T2', true, false) on conflict (email, site) do update set is_admin = true");
    sql('rcl_s2', "update app_users set admin = 'Yes', perm_vendor_master = 'Edit', updated_at = now() + interval '1 second' where email = 'sujit@rcl.test'");
    await wait(16500);      // the servers' memory of the list of sites (15 s)
    const signIn = async site => { const a = await call(null, 'login', 'sujit@rcl.test', PW); let t = a.result.token;
      if (site !== 'S1') { const s = await call(null, 'switchSite', t, site); t = s.result.token; } return t; };
    const api = async (site, tok, action, ...a) => { const r = await call(site, 'api', tok, action, a); return r.error ? { ERROR: r.error } : r.result; };
    let s1 = await signIn('S1'); const t2 = await signIn('T2'); s1 = await signIn('S1');
    ok('signed in at S1 and at T2 (Admin at both)', !!s1 && !!t2);
    const V = { gstReg: 'No', pan: 'ABCPV1111A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' };
    const cnt = (db, n) => sql(db, "select count(*) from vendors where vendor_name = '" + n.replace(/'/g, "''") + "'");
    // ---- each site its own ----
    let r = await api('S1', s1, 'saveVendor', Object.assign({ name: 'V111 Alpha' }, V), 'add');
    ok('a vendor saved at S1 stays at S1 – nothing is copied to T2', r.ok && cnt('rcl', 'V111 Alpha') === '1' && cnt('rcl_s2', 'V111 Alpha') === '0' && sql('rcl', "select owner_site from vendors where vendor_name = 'V111 Alpha'") === 'S1', r.ERROR || r.spread);
    r = await api('T2', t2, 'saveVendor', Object.assign({ name: 'V111 Beta' }, V), 'add');
    ok('a vendor saved at T2 stays at T2', r.ok && cnt('rcl_s2', 'V111 Beta') === '1' && cnt('rcl', 'V111 Beta') === '0', r.ERROR);
    r = await api('T2', t2, 'saveVendor', Object.assign({ name: 'V111 Beta', oldName: 'V111 Beta', remark: 'changed at T2' }, V), 'edit');
    ok('   changed at T2: only T2', r.ok && sql('rcl_s2', "select remark from vendors where vendor_name = 'V111 Beta'") === 'changed at T2', r.ERROR);
    // ---- copies that update-106 had written at T2 (owner S1) ----
    const USED = 'V111 "Q", Used & Co';
    sql('rcl_s2', "insert into vendors (id, vendor_name, owner_site, gst_registered) values ('V111 GAMMA', 'V111 Gamma', 'S1', 'No'), ('" + USED.toUpperCase().replace(/'/g, "''") + "', '" + USED.replace(/'/g, "''") + "', 'S1', 'No');" +
      "insert into payments (id, entry_type, entry_date, vendor_name, amount, side) values ('PAY-V111', 'Payment', '2026-10-01', '" + USED.replace(/'/g, "''") + "', 1000, 'Paid');" +
      "delete from web.cache where key like 'SB%';");
    await wait(1200);
    r = await api('T2', t2, 'getBoqs', {});
    const names2 = (r.vendors || []).filter(v => /^V111/.test(v.name)).map(v => v.name);
    ok('at T2: the copy nobody uses here is NOT shown; the copy T2 pays (name with a comma and quotes – asked from the database) is', names2.indexOf('V111 Gamma') === -1 && names2.indexOf(USED) > -1 && names2.indexOf('V111 Beta') > -1 && names2.indexOf('V111 Alpha') === -1, names2.concat(r.ERROR || []));
    r = await api('T2', t2, 'getVendors');
    const pv = (Array.isArray(r) ? r : (r && r.vendors) || []).map(v => v.name || v);
    ok('   the Payments / Ledger list the same', pv.indexOf('V111 Gamma') === -1 && pv.indexOf(USED) > -1, pv.filter(n => /^V111/.test(n)));
    r = await api('T2', t2, 'saveVendor', Object.assign({ name: 'V111 Gamma X', oldName: 'V111 Gamma' }, V), 'edit');
    ok('   the copy cannot be changed at T2 ("not a vendor of this site")', r.ERROR && /V111 Gamma is not a vendor of this site/.test(r.ERROR) && cnt('rcl_s2', 'V111 Gamma') === '1', r);
    r = await api('T2', t2, 'deleteVendor', 'V111 Gamma');
    ok('   nor deleted from T2 (it stays in the database, hidden)', r.ERROR && cnt('rcl_s2', 'V111 Gamma') === '1', r);
    // ---- a new vendor of that name at T2: T2's own ----
    r = await api('T2', t2, 'saveVendor', Object.assign({ name: 'V111 Gamma', phone: '9876500000' }, V), 'add');
    ok('a NEW "V111 Gamma" at T2 becomes T2\'s own: the row taken over (owner T2), not added twice', r.ok && cnt('rcl_s2', 'V111 Gamma') === '1' && sql('rcl_s2', "select owner_site || '|' || phone from vendors where vendor_name = 'V111 Gamma'") === 'T2|9876500000' && (r.vendors || []).some(v => v.name === 'V111 Gamma'), r.ERROR || sql('rcl_s2', "select owner_site || '|' || coalesce(phone,'') from vendors where vendor_name = 'V111 Gamma'"));
    r = await api('T2', t2, 'saveVendor', Object.assign({ name: USED, oldName: USED, remark: 'ours now' }, V), 'edit');
    ok('the copy T2 uses is changed at T2 and becomes T2\'s own', r.ok && sql('rcl_s2', "select owner_site || '|' || remark from vendors where vendor_name = '" + USED.replace(/'/g, "''") + "'") === 'T2|ours now', r.ERROR);
    // ---- S1 untouched ----
    r = await api('S1', s1, 'getBoqs', {});
    const names1 = (r.vendors || []).filter(v => /^V111/.test(v.name)).map(v => v.name);
    ok('S1 sees only its own (V111 Alpha) – nothing of T2', names1.join('|') === 'V111 Alpha' && cnt('rcl', 'V111 Gamma') === '0', names1);
    r = await api('T2', t2, 'deleteVendor', 'V111 Gamma');
    ok('T2 deletes its own V111 Gamma – only at T2', r.ok && cnt('rcl_s2', 'V111 Gamma') === '0' && cnt('rcl', 'V111 Alpha') === '1', r.ERROR);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 600)); }
  finally { try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
