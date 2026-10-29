/* update-193 (29-10-2026) – a company and a site's company saved in the Portal are told to Mechanical's list of sites (the first site's
 * rcl_companies / rcl_sites), where the papers of the modules (the Store's PO and Purchase Requisition Form) read them – end to end on
 * the local rig, never live: the Portal :3010 (Super Admin) → its server → Mechanical :3000 (signed ticket, act "papers") → the
 * Store :3020 reads its heading. Run after the Portal's own test (test/api.test.js of rcl-portal: it leaves its Super Admin):
 *   node test/papers193api.js
 * It puts back what it changed (the company's address, the sites' companies) at the end. */
'use strict';
const { execSync } = require('child_process');
let pass = 0, fail = 0; const out = [], T0 = Date.now();
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const P = 'http://127.0.0.1:3010', ST = 'http://127.0.0.1:3020', SAPW = 'Super#Admin2040';
function browser(base) {
  let cookie = '';
  const req = async (p, body) => {
    const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(base + p, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(90000) });
    const sc = r.headers.get('set-cookie'); if (sc) { const v = sc.split(';')[0]; cookie = /=$/.test(v) ? '' : v; }
    let j = {}; try { j = JSON.parse(await r.text()); } catch (e) { j = {}; }
    return { status: r.status, j: j };
  };
  return { req };
}
const mechCo = id => sql('rcl', "select name || '|' || coalesce(address, '') || '|' || coalesce(gstin, '') || '|' || coalesce(pan, '') || '|' || coalesce(logo, '') from rcl_companies where id = '" + id + "'");
const mechSite = code => sql('rcl', "select coalesce(company_id, '') from rcl_sites where code = '" + code + "'");

(async () => {
  const S = browser(P);
  let r = await S.req('/api/auth', { action: 'login', email: 'sa@rcl.test', password: SAPW });
  if (r.status !== 200) r = await S.req('/api/auth', { action: 'login', email: 'sa@rcl.test', password: 'Super#Admin2041' });      // (the Portal's test leaves his password changed by "Forgot password")
  ok('the Super Admin signs in on the Portal', r.status === 200 && r.j.user && r.j.user.super, r.j);
  const was = { co: sql('rcl_portal', "select coalesce(address, '') || '|' || coalesce(gstin, '') || '|' || coalesce(pan, '') from companies where id = 'RACHANATEST'").split('|'),
    s1: sql('rcl_portal', "select name || '|' || coalesce(company_id, '') || '|' || status from sites where code = 'S1'").split('|'),
    t2: sql('rcl_portal', "select name || '|' || coalesce(company_id, '') || '|' || status from sites where code = 'T2'").split('|'), mechS1: mechSite('S1'), mechT2: mechSite('T2'),
    modUrl: sql('rcl_portal', "select coalesce(url, '') from modules where key = 'mechanical'") };
  ok('the start as at the live sites: the first site (S1) has no company in Mechanical\'s list', was.mechS1 === '' && was.modUrl !== '', was);

  // ---- the company: its address, GSTIN, PAN saved in the Portal → in Mechanical's list ----
  r = await S.req('/api/admin', { action: 'companySave', id: 'RACHANATEST', name: 'Rachana Test Co', address: 'Plot 5, MIDC Ambad, Nashik 422010', gstin: '27ABCDE1234F1Z5', pan: 'ABCDE1234F', logo: '' });
  ok('Companies → Rachana Test Co → its address, GSTIN, PAN → Save: saved, no warning', r.status === 200 && r.j.ok && !r.j.warn, r.j);
  ok('   …told to Mechanical: the same company there with its address, GSTIN, PAN', mechCo('RACHANATEST') === 'Rachana Test Co|Plot 5, MIDC Ambad, Nashik 422010|27ABCDE1234F1Z5|ABCDE1234F|', mechCo('RACHANATEST'));
  // ---- the site's company ----
  r = await S.req('/api/admin', { action: 'siteSave', code: 'S1', name: was.s1[0], company: 'RACHANATEST', status: was.s1[2] });
  ok('Sites → S1 → Company: Rachana Test Co → Save: saved, no warning', r.status === 200 && r.j.ok && !r.j.warn, r.j);
  ok('   …Mechanical\'s list: S1 belongs to Rachana Test Co', mechSite('S1') === 'RACHANATEST', mechSite('S1'));
  ok('   …nothing else of S1 changed there (its name, status, first site)', sql('rcl', "select coalesce(name, '') || '|' || status || '|' || home from rcl_sites where code = 'S1'").split('|').slice(1).join('|') === 'ready|true');

  // ---- the Store's papers: the heading of the requirement (the Purchase Requisition Form) ----
  // (the rig: the Store's work as at the live sites – its steps, each can be run again safely)
  if (!sql('rcl', "select coalesce(to_regclass('public.store_req')::text, '')"))
    ['store_step2_work', 'store_step3_grn_import', 'store_step4_grn_no', 'store_step5_po_format', 'store_step6_grn_discount', 'store_step7_req_photos'].forEach(f =>
      execSync('timeout 60 su postgres -c "psql -d rcl -v ON_ERROR_STOP=1 -tA -q"', { input: require('fs').readFileSync('/home/claude/rcl-store/sql/' + f + '.sql'), stdio: ['pipe', 'pipe', 'ignore'] }));
  await new Promise(res => setTimeout(res, 1500));
  const storeWas = sql('rcl_portal', "select coalesce(url, '') || '|' || status from modules where key = 'store'");
  if (storeWas) sql('rcl_portal', "update modules set url = '" + ST + "', status = 'live' where key = 'store'");
  else sql('rcl_portal', "insert into modules (key, name, url, status) values ('store', 'Store', '" + ST + "', 'live')");      // (the rig: the Store as the live Portal has it)
  r = await S.req('/api/go?module=store&site=S1&json=1');
  let head = null, why = '';
  if (r.status === 200 && r.j.ticket) {
    const B = browser(ST); const s = await B.req('/api/sso', { ticket: r.j.ticket });
    if (s.status === 200) { const l = await B.req('/api/work', { action: 'reqList' }); head = l.j && l.j.heading; if (!head) why = 'reqList ' + l.status + ' ' + JSON.stringify(l.j).slice(0, 200); }
    else why = 'Store sign-in ' + s.status + ' ' + JSON.stringify(s.j).slice(0, 200);
  } else why = 'no Store ticket ' + r.status + ' ' + JSON.stringify(r.j).slice(0, 200);
  if (storeWas) sql('rcl_portal', "update modules set url = nullif('" + storeWas.split('|')[0] + "', ''), status = '" + storeWas.split('|')[1] + "' where key = 'store'");
  else sql('rcl_portal', "delete from modules where key = 'store'");
  ok('the Store\'s requirement paper at S1: its heading has the company\'s name and address now (before: empty)', !!head && head.company === 'Rachana Test Co' && head.address === 'Plot 5, MIDC Ambad, Nashik 422010' && head.gstin === '27ABCDE1234F1Z5', head || why);

  // ---- a new company, a site linked and unlinked; the company changed again ----
  const NEW = 'Papers Test ' + Date.now().toString(36).toUpperCase();
  r = await S.req('/api/admin', { action: 'companySave', name: NEW, address: 'Pune 411001' });
  const nid = r.j.id;
  ok('a new company added in the Portal: added in Mechanical\'s list too', r.status === 200 && !r.j.warn && mechCo(nid) === NEW + '|Pune 411001|||', [r.j, mechCo(nid)]);
  r = await S.req('/api/admin', { action: 'siteSave', code: 'T2', name: was.t2[0], company: nid, status: was.t2[2] });
  ok('   site T2 given it: T2 belongs to it there', r.status === 200 && !r.j.warn && mechSite('T2') === nid, [r.j, mechSite('T2')]);
  r = await S.req('/api/admin', { action: 'companySave', id: nid, name: NEW, address: 'Shivajinagar, Pune 411005', logo: 'https://example.com/logo.png' });
  ok('   its address and logo changed: the same row there, changed', !r.j.warn && mechCo(nid) === NEW + '|Shivajinagar, Pune 411005|||https://example.com/logo.png' && mechSite('T2') === nid, [r.j, mechCo(nid)]);
  r = await S.req('/api/admin', { action: 'siteSave', code: 'T2', name: was.t2[0], company: '', status: was.t2[2] });
  ok('   T2 given no company: none there either (the company stays in the list)', !r.j.warn && mechSite('T2') === '' && !!mechCo(nid), [r.j, mechSite('T2')]);
  r = await S.req('/api/admin', { action: 'siteSave', isNew: true, code: 'PPR1', name: 'Papers Site', company: nid, status: 'active' });
  ok('a site of the Portal that is not set up in Mechanical: saved, no warning – nothing added to Mechanical\'s sites', r.status === 200 && !r.j.warn && sql('rcl', "select count(*) from rcl_sites where code = 'PPR1'") === '0', r.j);

  // ---- Mechanical not reachable: the Portal's save stands, and it says so ----
  sql('rcl_portal', "update modules set url = 'http://127.0.0.1:3999' where key = 'mechanical'");
  r = await S.req('/api/admin', { action: 'companySave', id: 'RACHANATEST', name: 'Rachana Test Co', address: 'Plot 9, MIDC Ambad, Nashik 422010', gstin: '27ABCDE1234F1Z5', pan: 'ABCDE1234F', logo: '' });
  sql('rcl_portal', "update modules set url = '" + was.modUrl + "' where key = 'mechanical'");
  ok('Mechanical not reachable: the Portal saved it, and says the papers could not be told – save again', r.status === 200 && r.j.ok && /could not be told/.test(r.j.warn || '') && sql('rcl_portal', "select address from companies where id = 'RACHANATEST'") === 'Plot 9, MIDC Ambad, Nashik 422010' && /Plot 5/.test(mechCo('RACHANATEST')), r.j);
  r = await S.req('/api/admin', { action: 'companySave', id: 'RACHANATEST', name: 'Rachana Test Co', address: 'Plot 9, MIDC Ambad, Nashik 422010', gstin: '27ABCDE1234F1Z5', pan: 'ABCDE1234F', logo: '' });
  ok('   saved again (Mechanical back): told', !r.j.warn && /Plot 9/.test(mechCo('RACHANATEST')), [r.j, mechCo('RACHANATEST')]);
  // ---- only the Super Admin: another person cannot ----
  const U = browser(P); r = await U.req('/api/auth', { action: 'login', email: 'sujit@rcl.test', password: 'Nashik#Road848!' });
  r = await U.req('/api/admin', { action: 'companySave', id: 'RACHANATEST', name: 'Rachana Test Co', address: 'Hacked' });
  ok('not the Super Admin: refused, nothing told', r.status === 401 || r.status === 403, r);
  ok('   (Mechanical\'s list unchanged)', /Plot 9/.test(mechCo('RACHANATEST')));
  // ---- the record ----
  ok('the Activity record: "Company changed", "Site changed"', ['Company changed', 'Site changed'].every(a => sql('rcl_portal', "select count(*) from audit where action = '" + a + "'") !== '0'));

  // ---- put back ----
  await S.req('/api/admin', { action: 'siteSave', code: 'S1', name: was.s1[0], company: was.s1[1], status: was.s1[2] });
  await S.req('/api/admin', { action: 'siteSave', code: 'T2', name: was.t2[0], company: was.t2[1], status: was.t2[2] });
  await S.req('/api/admin', { action: 'siteSave', code: 'PPR1', name: 'Papers Site', company: '', status: 'closed' });
  await S.req('/api/admin', { action: 'siteDelete', code: 'PPR1', confirm: 'PPR1' });
  await S.req('/api/admin', { action: 'companySave', id: 'RACHANATEST', name: 'Rachana Test Co', address: was.co[0], gstin: was.co[1], pan: was.co[2], logo: '' });
  sql('rcl', "update rcl_sites set company_id = " + (was.mechS1 ? "'" + was.mechS1 + "'" : 'null') + " where code = 'S1'; update rcl_sites set company_id = " + (was.mechT2 ? "'" + was.mechT2 + "'" : 'null') + " where code = 'T2';");
  ok('put back: S1 and T2 as they were (the rig)', mechSite('S1') === was.mechS1 && mechSite('T2') === was.mechT2);
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - T0) / 1000) + ' s)');
  console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
