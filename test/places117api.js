/* update-117 – every site its own diesel places, set by the Super Admin in the Portal. Local rig only (PORTAL=1 bash rig/all.sh):
 *   the Portal :3010 (its own code from ../rcl-portal, its test database), Mechanical :3000 (linked to the Portal) and :3001,
 *   S1 = database rcl (the first site: entries, Dispenser + VTR Store), T2 = database rcl_s2 (no diesel entry – as 18B).
 *   T2 gets the places of 18B: Camp Pump 18,000 Ltr, MH12ZE1739 and MH12WJ1381 2,650 Ltr each. Test data only; T2's settings,
 *   entries and machinery of this test are taken out at the end; nothing of S1 is changed.
 *      node test/places117api.js */
'use strict';
const { execSync } = require('child_process'), path = require('path'), crypto = require('crypto');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const wait = ms => new Promise(r => setTimeout(r, ms));
const P = 'http://127.0.0.1:3010';
const rpc = async (port, site, fn, ...args) => { const b = { fn, args }; if (site) b.site = site;
  const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(120000) }); return r.json(); };
// the Portal in a browser of our own (its cookie, its header)
let cookie = '';
const portal = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
  const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
// a ticket of the Portal's own code, straight to Mechanical (for a refused or a copied ticket)
Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:3106', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_SECRET: 'rig-portal-secret-0123456789abcdefghijklmnop' });
const keys = require(path.join(__dirname, '..', '..', 'rcl-portal', 'lib', 'keys'));
const now = () => Math.floor(Date.now() / 1000);
const adm = o => keys.sign(Object.assign({ iss: P, aud: 'mechanical-admin', sub: 'sa@rcl.test', site: 'T2', act: 'places', iat: now(), exp: now() + 60, jti: crypto.randomBytes(16).toString('hex') }, o || {}));
const PL18B = [{ name: 'Camp Pump', cap: 18000 }, { name: 'MH12ZE1739', cap: 2650 }, { name: 'MH12WJ1381', cap: 2650 }];
const propsOf = db => { const o = {}; sql(db, "select key || chr(9) || coalesce(value, '') from web.props").split('\n').filter(Boolean).forEach(l => { const [k, v] = l.split('\t'); o[k] = v; }); return o; };

(async () => {
  const keepT2 = propsOf('rcl_s2'), keepS1 = sql('rcl', "select count(*) from web.props where key = 'DIESEL_PLACES'");
  const log0 = Number(sql('rcl_s2', "select count(*) from activity_log where record_id = 'Diesel places'"));
  const adm0 = sql('rcl_s2', "select admin from app_users where email = 'sujit@rcl.test'");
  const n0 = { iss: sql('rcl_s2', 'select count(*) from diesel_issue'), inw: sql('rcl_s2', 'select count(*) from diesel_inward'), tr: sql('rcl_s2', 'select count(*) from diesel_transfer') };
  try {
    ok('start: T2 has no diesel entry and no places of its own; S1 has none of its own either', n0.iss === '0' && n0.inw === '0' && n0.tr === '0' && !('DIESEL_PLACES' in keepT2) && keepS1 === '0', [n0, keepS1]);
    // ---- the Super Admin signs in to the Portal ----
    let r = null;
    for (const pw of ['Super#Admin2041', 'Super#Admin2040']) { r = await portal('/api/auth', { action: 'login', email: 'sa@rcl.test', password: pw }); if (r.status === 200 && !r.error) break; }
    ok('the Super Admin is signed in to the Portal', r.status === 200 && !r.error, r);
    // ---- S1 (VTR): its places as before; a place with entries cannot be taken away; nothing is written ----
    r = await portal('/api/admin', { action: 'placesGet', site: 'S1' });
    ok('S1 in the Portal: Dispenser + VTR Store, not set (the places of the first site), entries there', JSON.stringify((r.places || []).map(p => p.name)) === '["Dispenser","VTR Store"]' && r.set === false && r.entries === true && r.places[0].used === true, r);
    const s1 = r;
    r = await portal('/api/admin', { action: 'placesSave', site: 'S1', places: [{ name: 'VTR Store', cap: 10000 }, { name: 'Camp Pump', cap: 18000 }] });
    ok('S1: taking the Dispenser away is refused ("has entries")', r.status === 400 && /Diesel place Dispenser has entries – it cannot be renamed or taken away/.test(r.error || ''), r);
    ok('   nothing written at S1', sql('rcl', "select count(*) from web.props where key = 'DIESEL_PLACES'") === '0');
    // ---- T2 (as 18B): the 3 places from the Portal ----
    r = await portal('/api/admin', { action: 'placesGet', site: 'T2' });
    ok('T2 before: the places of the first site, not set, no entry', r.set === false && r.entries === false && (r.places || []).length === 2, r);
    r = await portal('/api/admin', { action: 'placesSave', site: 'T2', places: [{ name: 'Camp Pump', cap: 18000 }, { name: 'camp pump', cap: 1 }] });
    ok('the same name twice: refused, with Mechanical\'s words', r.status === 400 && /Mechanical: Diesel place "camp pump" is there twice\./.test(r.error || ''), r);
    r = await portal('/api/admin', { action: 'placesSave', site: 'T2', places: PL18B });
    ok('T2: Camp Pump 18,000 · MH12ZE1739 2,650 · MH12WJ1381 2,650 saved', r.ok && JSON.stringify(r.places.map(p => [p.name, p.cap])) === JSON.stringify(PL18B.map(p => [p.name, p.cap])), r);
    const pT2 = propsOf('rcl_s2');
    ok('   in T2\'s own database (web.props): DIESEL_PLACES and the 3 tank sizes', JSON.parse(pT2.DIESEL_PLACES || '[]').map(p => p.name).join() === 'Camp Pump,MH12ZE1739,MH12WJ1381' && pT2['TANK_CAP_Camp Pump'] === '18000' && pT2.TANK_CAP_MH12ZE1739 === '2650' && pT2.TANK_CAP_MH12WJ1381 === '2650', pT2);
    ok('   S1 is untouched', sql('rcl', "select count(*) from web.props where key = 'DIESEL_PLACES' or key like 'TANK_CAP_Camp%'") === '0');
    ok('   the Activity Log of T2: "Diesel places set by the Super Admin in the Portal", with the places before', Number(sql('rcl_s2', "select count(*) from activity_log where record_id = 'Diesel places'")) === log0 + 1 &&
      sql('rcl_s2', "select email || ' | ' || name || ' | ' || summary || ' | ' || changes from activity_log where record_id = 'Diesel places' order by at desc limit 1") === 'sa@rcl.test | Super Admin (Portal) | Diesel places set by the Super Admin in the Portal: Camp Pump 18000 Ltr, MH12ZE1739 2650 Ltr, MH12WJ1381 2650 Ltr | Before: Dispenser 10000 Ltr, VTR Store 10000 Ltr');
    ok('   the Portal\'s own record (audit)', /Diesel places/.test(JSON.stringify((await portal('/api/admin', { action: 'audit', limit: 5 })).rows || [])));
    // a ticket used twice; a person's ticket
    const t = await adm({ act: 'places' });
    await rpc(3000, null, 'portalAdmin', t); r = await rpc(3000, null, 'portalAdmin', t);
    ok('the same ticket twice: refused', /already used/.test(r.error || ''), r.error);
    r = await rpc(3001, null, 'portalAdmin', await adm());
    ok('a Mechanical server not linked to the Portal: refused', /not linked to the Portal/.test(r.error || ''), r.error);
    // ---- the diesel of T2 with its own places (a person at T2, through the app server :3001 – another server than the Portal's) ----
    sql('rcl', "insert into rcl_user_sites (email, site, is_admin, is_default) values ('sujit@rcl.test', 'T2', true, false) on conflict (email, site) do nothing");
    sql('rcl_s2', "update app_users set admin = 'Yes' where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST'");      // (for this test: Admin at T2; put back at the end)
    await wait(16500);
    const s1tok = (await rpc(3001, null, 'login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
    const s1init = (await rpc(3001, null, 'api', s1tok, 'getInit', [])).result;
    ok('S1 page (getInit): Dispenser + VTR Store as before', JSON.stringify(s1init.locations) === '["Dispenser","VTR Store"]', s1init.locations);
    const tk = (await rpc(3001, null, 'switchSite', s1tok, 'T2')).result.token;
    const api = async (fn, ...a) => { const x = await rpc(3001, 'T2', 'api', tk, fn, a); return x.error ? { ERROR: x.error } : x.result; };
    let init = await api('getInit');
    ok('T2 page / phone app (getInit): the 3 places', JSON.stringify(init.locations) === '["Camp Pump","MH12ZE1739","MH12WJ1381"]', init.locations || init);
    const today = init.today;
    r = await api('saveMaster', { no: 'TP-117', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    ok('test machinery TP-117 at T2', r && r.ok, r);
    r = await api('saveInward', { date: today, location: 'Camp Pump', pump: 'Vendor Pump 117', qty: 5000, rate: 92, billNo: 'B117-1', billDate: today });
    ok('inward from the vendor straight into the Camp Pump: 5,000 Ltr', r && r.ok, r);
    r = await api('saveInward', { date: today, location: 'MH12WJ1381', pump: 'Vendor Pump 117', qty: 100, rate: 92, billNo: 'B117-2', billDate: today });
    ok('inward straight into a dispenser (MH12WJ1381): 100 Ltr', r && r.ok, r);
    r = await api('saveInward', { date: today, location: 'Dispenser', pump: 'Vendor Pump 117', qty: 10, rate: 92, billNo: 'B117-3', billDate: today });
    ok('   "Dispenser" is no place of T2: refused, the 3 places named', /Select Received at \(Camp Pump \/ MH12ZE1739 \/ MH12WJ1381\)/.test(r.ERROR || ''), r);
    r = await api('saveTransfer', { date: today, shift: 'Day', from: 'Camp Pump', to: 'MH12ZE1739', qty: 1000 });
    ok('transfer pump → dispenser (Camp Pump → MH12ZE1739): 1,000 Ltr', r && r.ok, r);
    r = await api('saveTransfer', { date: today, shift: 'Day', from: 'MH12ZE1739', to: 'MH12WJ1381', qty: 300 });
    ok('transfer dispenser → dispenser (MH12ZE1739 → MH12WJ1381): 300 Ltr', r && r.ok, r);
    r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'MH12WJ1381', no: 'TP-117', qty: 150, kmReading: 1000, force: true });
    ok('issue from a dispenser (MH12WJ1381): 150 Ltr', r && r.ok, r);
    r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Camp Pump', no: 'TP-117', qty: 50, kmReading: 1100, force: true });
    ok('issue from the Camp Pump: 50 Ltr', r && r.ok, r);
    r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'MH12ZE1739', no: 'TP-117', qty: 701, kmReading: 1200, force: true });
    ok('   more than the dispenser has: refused (700 Ltr there)', /Not enough diesel at MH12ZE1739 .*Available: 700 Ltr/.test(r.ERROR || ''), r);
    init = await api('getInit');
    ok('stock per place: Camp Pump 3,950 · MH12ZE1739 700 · MH12WJ1381 250 (total 4,900)', JSON.stringify(init.stock.byLoc) === '{"Camp Pump":3950,"MH12ZE1739":700,"MH12WJ1381":250}' && init.stock.stock === 4900, init.stock);
    const dash = await api('getDashboard', { from: today, to: today });
    ok('Dashboard: a tank for each place (own), with its size', dash && dash.tanks && dash.tanks.own === true && JSON.stringify(dash.tanks.caps) === '{"Camp Pump":18000,"MH12ZE1739":2650,"MH12WJ1381":2650}', dash && dash.tanks || dash);
    ok('   and the stock position of each place', JSON.stringify((dash.locations || []).map(x => [x.loc, x.inward, x.tin, x.tout, x.issued, x.closing])) === JSON.stringify([['Camp Pump', 5000, 0, 1000, 50, 3950], ['MH12ZE1739', 0, 1000, 300, 0, 700], ['MH12WJ1381', 100, 300, 0, 150, 250]]), dash.locations);
    // ---- the places now have entries ----
    r = await portal('/api/admin', { action: 'placesGet', site: 'T2' });
    ok('the Portal shows each place with entries and its stock now', JSON.stringify((r.places || []).map(p => [p.name, p.used, p.stock])) === '[["Camp Pump",true,3950],["MH12ZE1739",true,700],["MH12WJ1381",true,250]]' && r.entries === true, r);
    r = await portal('/api/admin', { action: 'placesSave', site: 'T2', places: PL18B.slice(0, 2) });
    ok('a dispenser with entries cannot be taken away', r.status === 400 && /MH12WJ1381 has entries/.test(r.error || ''), r);
    r = await portal('/api/admin', { action: 'placesSave', site: 'T2', places: PL18B.concat([{ name: 'Store Barrels', cap: 1000 }]) });
    ok('a 4th place can be added at any time', r.ok && r.places.length === 4, r);
    await wait(1500);
    const lk = await api('getLookups');
    ok('   an open page hears of it (getLookups: the 4 places)', (lk.locations || []).join() === 'Camp Pump,MH12ZE1739,MH12WJ1381,Store Barrels', lk.locations);
    r = await portal('/api/admin', { action: 'placesSave', site: 'T2', places: PL18B });
    ok('   and taken away again while it has no entry', r.ok && r.places.length === 3, r);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally {
    try {
      // only what this test made (T2 had no diesel entry at the start – checked above)
      if (n0.iss === '0' && n0.inw === '0' && n0.tr === '0') sql('rcl_s2', "delete from diesel_issue where machinery = 'TP-117'; delete from diesel_transfer where from_location in ('Camp Pump', 'MH12ZE1739', 'MH12WJ1381'); delete from diesel_inward where pump_name = 'Vendor Pump 117'; delete from master where id = 'TP-117';");
      const now2 = propsOf('rcl_s2');
      Object.keys(now2).filter(k => !(k in keepT2) && !/^V_/.test(k)).forEach(k => sql('rcl_s2', "delete from web.props where key = '" + k.replace(/'/g, "''") + "'"));
      sql('rcl_s2', "update app_users set admin = '" + adm0 + "' where email = 'sujit@rcl.test'; delete from web.cache where key like 'SB%' or key = 'USERS_LIST'"); sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', "select count(*) from diesel_issue") + ' issues / ' + sql('rcl_s2', "select count(*) from diesel_inward") + ' inward / ' + sql('rcl_s2', "select count(*) from diesel_transfer") + ' transfers; DIESEL_PLACES ' + sql('rcl_s2', "select count(*) from web.props where key = 'DIESEL_PLACES'"));
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
