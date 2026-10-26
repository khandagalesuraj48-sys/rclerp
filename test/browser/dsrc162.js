// update-162 (asked 26-10-2026: "user wise konala konte source cha access deycha … jya user la jyacha access asel to tyach madhun
// issue kru shakel same transfer la pn … inward la nko") – the whole way, on the local rig started with PORTAL=1 (the Portal :3010
// from ../rcl-portal, Mechanical :3000 linked to it). Site T2 (database rcl_s2, no diesel entry) plays 18B with three places.
// Test data only (T2's places, a machinery DS-162 and its diesel, the person ds162 in the Portal and at T2), all taken out at the
// end; nothing of S1 is changed.
//   1. the Super Admin: T2's places; a Portal user ds162 (Mechanical User at T2); Users & Access → Pages → his diesel sources:
//      Diesel Issue – source: only ZE; Diesel Transfer – From: only ZE (the Portal's own screen, pressed in a browser)
//   2. kept in T2's own database (S1 has none); the Activity Log of T2 and the Portal's record have it
//   3. he signs in through the Portal: the page knows his sources; Diesel Issue / its "many at once" / Transfer From show only ZE;
//      Transfer To, the lists' filters and Diesel Inward every place
//   4. the server: an issue / a transfer from CAMP PUMP refused with the plain message; from ZE saved; Inward anywhere; a transfer
//      of CAMP PUMP made by the Admin is not his to delete
//   5. the Admin's page: every place;  6. all ticked again in the Portal = every source (nothing kept for him)
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node dsrc162.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const CP = 'CAMP PUMP', ZE = 'DISPENSER - MH12ZE-1739', WJ = 'DISPENSER - MH12WJ-1381', ME = 'ds162@rcl.test', MYPW = 'Ds162#Own2026';
const propsOf = db => { const o = {}; sql(db, "select key || chr(9) || coalesce(value, '') from web.props").split('\n').filter(Boolean).forEach(l => { const [k, v] = l.split('\t'); o[k] = v; }); return o; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
(async () => {
  const keepT2 = propsOf('rcl_s2'), s1Had = sql('rcl', "select count(*) from web.props where key = 'DIESEL_SOURCES'");
  const n0 = sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)');
  const errs = []; let b = null;
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const portalAs = () => { let cookie = ''; return { get cookie() { return cookie; }, async req(p, body) { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); } }; };
  const SAp = portalAs(), MEp = portalAs();
  const ticket = async (who, site) => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: who.cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const opts = (F, id) => F.evaluate(i => [...document.getElementById(i).options].map(o => o.value || '(' + o.textContent + ')'), id);
  try {
    ok('start: T2 has no diesel entry, no places and no diesel sources of its own; S1 no diesel sources', n0 === '0' && !('DIESEL_PLACES' in keepT2) && !('DIESEL_SOURCES' in keepT2) && s1Had === '0', [n0, keepT2.DIESEL_PLACES, s1Had]);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await SAp.req('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const pl = await SAp.req('/api/admin', { action: 'placesSave', site: 'T2', places: [{ name: CP, cap: 18000 }, { name: ZE, cap: 2650 }, { name: WJ, cap: 2650 }] });
    ok('1. the Super Admin: T2\'s places CAMP PUMP, DISPENSER - MH12ZE-1739, DISPENSER - MH12WJ-1381', lr.status === 200 && (pl.places || []).map(x => x.name).join('|') === [CP, ZE, WJ].join('|'), pl);
    // the Admin's diesel at T2 (the Super Admin opens Mechanical: Admin there)
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket(SAp, 'T2')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J('getInit')).today;
    const seed = [await J('saveMaster', { no: 'DS-162', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add'),
      await J('saveInward', { date: today, location: CP, pump: 'Vendor Pump 162', qty: 12000, rate: 92, billNo: 'B162-1', billDate: today }),
      await J('saveTransfer', { date: today, shift: 'Day', from: CP, to: ZE, qty: 2000 })];
    ok('   the Admin\'s diesel at T2: 12,000 in at CAMP PUMP; CAMP PUMP → ZE 2,000', seed.every(x => x && x.ok), seed);
    const cpTr = seed[2].id;
    // his user in the Portal: Mechanical User at T2
    let r = await SAp.req('/api/admin', { action: 'userSave', isNew: true, email: ME, name: 'Diesel Sources 162', active: true, newPassword: 'Temp1234' });
    const r2 = await SAp.req('/api/admin', { action: 'accessSet', email: ME, site: 'T2', module: 'mechanical', role: 'user' });
    ok('   the Portal: ds162 added, Mechanical User at T2', r.status === 200 && r2.status === 200, [r, r2]);
    // ---- the Portal's own screen: Users & Access → his name → Module Access (T2): pages + diesel sources ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const pp = await b.newPage(); await pp.setViewport({ width: 1440, height: 1000 }); pp.on('pageerror', e => errs.push('Portal: ' + String(e.message).slice(0, 200)));
    await pp.setCookie({ name: SAp.cookie.split('=')[0], value: SAp.cookie.split('=').slice(1).join('='), url: P });
    await pp.goto(P + '/', { waitUntil: 'load' });
    const openHim = async () => {
      for (let i = 0; i < 60 && !(await pp.$('#u_rows .u-pages[data-email="' + ME + '"]')); i++) await wait(500);
      await pp.evaluate(() => { const s = document.getElementById('u_site'); s.value = 'T2'; s.dispatchEvent(new Event('change')); });
      await wait(500); await pp.click('#u_rows .u-pages[data-email="' + ME + '"]');
      for (let i = 0; i < 60 && !(await pp.$('#pg_panel .ds-chk')); i++) await wait(500);
      return pp.evaluate(() => document.querySelectorAll('#pg_panel .ds-chk').length);
    };
    const opened = await openHim();
    ok('   the Portal (Users & Access, site T2 → ds162 → Module Access): under "Diesel sources" a tick for each of the 3 places, for Issue and for Transfer – all ticked (every source)', opened === 6 &&
      await pp.evaluate(() => [...document.querySelectorAll('#pg_panel .ds-chk')].every(x => x.checked)) && /Diesel Issue – source[\s\S]*Diesel Transfer – From/.test(await pp.evaluate(() => document.getElementById('pg_access').innerText)), opened);
    // his pages and his sources, then Save changes
    await pp.evaluate((ze) => {
      document.querySelectorAll('#pg_panel .pg-sel[data-g="mech"]').forEach(x => { x.value = /^Diesel (Issue|Transfer|Inward)$/.test(x.dataset.k) ? 'Edit' : 'None'; });
      document.querySelectorAll('#pg_panel .ds-chk').forEach(x => { x.checked = x.value === ze; });
    }, ZE);
    await wait(300);
    const pbox = await pp.evaluate(() => { const x = document.getElementById('pg_access').getBoundingClientRect(); return { x: x.left, y: x.top, w: x.width, h: x.height }; });
    await pp.evaluate(() => document.querySelector('#pg_access .sa-dsg').scrollIntoView({ block: 'center' }));
    await wait(400);
    const dsb = await pp.evaluate(() => { const g = document.querySelector('#pg_access .sa-dsg'), h = g.previousElementSibling.previousElementSibling, a = h.getBoundingClientRect(), z = g.getBoundingClientRect(); return { x: Math.max(0, a.left - 8) + window.scrollX, y: Math.max(0, a.top - 8) + window.scrollY, w: z.width + 16, h: z.bottom - a.top + 16 }; });
    await pp.screenshot({ path: SHOT + '/dsrc162_portal.png', clip: { x: dsb.x, y: dsb.y, width: dsb.w, height: dsb.h } });
    await pp.click('#pg_save');
    let dsT2 = ''; for (let i = 0; i < 40 && !dsT2; i++) { await wait(500); dsT2 = sql('rcl_s2', "select coalesce((select value from web.props where key = 'DIESEL_SOURCES'), '')"); }
    ok('2. Save changes: kept in T2\'s own database – Issue: ZE, Transfer: ZE', same(JSON.parse(dsT2 || '{}'), { [ME]: { 'Diesel Issue': [ZE], 'Diesel Transfer': [ZE] } }), [dsT2, pbox]);
    ok('   S1 has no diesel sources (each site its own)', sql('rcl', "select count(*) from web.props where key = 'DIESEL_SOURCES'") === '0');
    await wait(800);
    ok('   the Activity Log of T2: "Diesel sources of ds162@rcl.test – Diesel Issue: …ZE; Diesel Transfer: …ZE" by the Super Admin (Portal)', /Diesel sources of ds162@rcl\.test – Diesel Issue: DISPENSER - MH12ZE-1739; Diesel Transfer: DISPENSER - MH12ZE-1739/.test(sql('rcl_s2', "select string_agg(changes, ' || ') from activity_log where record_id = '" + ME + "'")) &&
      sql('rcl_s2', "select name from activity_log where record_id = '" + ME + "' order by at desc limit 1") === 'Super Admin (Portal)');
    ok('   the Portal\'s own record has it', /Diesel sources of ds162@rcl\.test/.test(sql('rcl_portal', "select string_agg(detail::text, ' ') from audit where action = 'Pages' and target = '" + ME + " · T2'")));
    // ---- 3. he signs in through the Portal (his one-time password → his own), opens Mechanical at T2 ----
    await MEp.req('/api/auth', { action: 'login', email: ME, password: 'Temp1234' });
    r = await MEp.req('/api/auth', { action: 'changePassword', old: 'Temp1234', password: MYPW });
    const me = await post(SA, { fn: 'ssoLogin', args: [await ticket(MEp, 'T2')] });
    const M = async (fn, ...a) => { const x = await post(SA, { fn: 'api', args: [me.result.token, fn, a], site: 'T2' }); return x.error ? { ERROR: x.error } : x.result; };
    const init = await M('getInit');
    ok('3. ds162 opens Mechanical at T2 from the Portal: the page is told his sources (Issue: ZE, Transfer: ZE)', r.status === 200 && me.result && me.result.token && init.user && same(init.user.dsrc, { 'Diesel Issue': [ZE], 'Diesel Transfer': [ZE] }) && same(init.locations, [CP, ZE, WJ]), [r, me.error, init.user, init.locations]);
    // ---- 4. the server ----
    const iss = (src, km) => ({ date: today, shift: 'Day', source: src, no: 'DS-162', qty: 20, kmReading: km, force: true });
    let x = await M('saveDieselIssue', iss(CP, 1000));
    ok('4. an issue from CAMP PUMP: refused – "Diesel source CAMP PUMP is not given to Diesel Sources 162 for Diesel Issue (given: DISPENSER - MH12ZE-1739) – the Super Admin gives the diesel sources in the Portal (Users & Access → Pages)."',
      x.ERROR === 'Diesel source CAMP PUMP is not given to Diesel Sources 162 for Diesel Issue (given: DISPENSER - MH12ZE-1739) – the Super Admin gives the diesel sources in the Portal (Users & Access → Pages).', x);
    x = await M('saveDieselIssue', iss(ZE, 1000));
    ok('   from ZE (his): saved', x && x.ok, x);
    x = await M('saveTransfer', { date: today, shift: 'Day', from: CP, to: WJ, qty: 10 });
    ok('   a transfer FROM CAMP PUMP: refused (for Diesel Transfer)', /^Diesel source CAMP PUMP is not given to Diesel Sources 162 for Diesel Transfer \(given: DISPENSER - MH12ZE-1739\)/.test(x.ERROR || ''), x);
    x = await M('saveTransfer', { date: today, shift: 'Day', from: ZE, to: WJ, qty: 100 });
    ok('   ZE → WJ (from his own, to any): saved', x && x.ok, x);
    x = await M('deleteTransfer', cpTr);
    ok('   the Admin\'s transfer CAMP PUMP → ZE: not his to delete', /CAMP PUMP is not given to Diesel Sources 162 for Diesel Transfer/.test(x.ERROR || ''), x);
    x = await M('saveInward', { date: today, location: WJ, pump: 'Vendor Pump 162', qty: 500, rate: 92, billNo: 'B162-2', billDate: today });
    ok('   Diesel Inward at WJ (not his source): saved – inward is free', x && x.ok, x);
    ok('   in T2\'s database: his issue from ZE, his transfer ZE → WJ, his inward; nothing from CAMP PUMP by him', sql('rcl_s2', "select count(*) from diesel_issue where machinery = 'DS-162' and source = '" + ZE + "'") === '1' &&
      sql('rcl_s2', "select count(*) from diesel_issue where machinery = 'DS-162' and source = '" + CP + "'") === '0' && sql('rcl_s2', "select count(*) from diesel_transfer where from_location = '" + ZE + "' and to_location = '" + WJ + "'") === '1' &&
      sql('rcl_s2', "select count(*) from diesel_transfer where from_location = '" + CP + "'") === '1');
    // ---- 3. his page in the browser ----
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('T2 ds162: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket(MEp, 'T2'), { waitUntil: 'load' });
    let F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && Array.isArray(S.locations) && S.locations.length === 3);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await F.evaluate(() => showTab('diesel')); await wait(2500);
    const mine = { d_src: await opts(F, 'd_src'), bd_src: await opts(F, 'bd_src'), t_from: await opts(F, 't_from'), t_to: await opts(F, 't_to'), df_src: await opts(F, 'df_src'), inw: await F.evaluate(() => { const s = document.querySelector('#sec-inward select.loc-select, select#in_loc, select#i_loc'); return s ? [...s.options].map(o => o.value) : null; }) };
    ok('   his page: Diesel Issue source = only ZE; "many at once" = only ZE', same(mine.d_src, [ZE]) && same(mine.bd_src, [ZE]), mine);
    ok('   Transfer From = only ZE; To = every place, ready on another place than From', same(mine.t_from, [ZE]) && same(mine.t_to, [CP, ZE, WJ]) && await F.evaluate(() => $('t_to').value !== $('t_from').value), [mine, await F.evaluate(() => $('t_to').value)]);
    ok('   the Diesel list\'s filter: every place (lists as before)' + (mine.inw ? '; Diesel Inward: every place' : ''), same(mine.df_src, ['(All)', CP, ZE, WJ]) && (!mine.inw || same(mine.inw, [CP, ZE, WJ])), mine);
    const grid = await F.evaluate(() => { const t = document.createElement('tr'); t.innerHTML = trRowHtml(); const f = [...t.querySelector('[data-f=from]').options].map(o => o.value), to = t.querySelector('[data-f=to]').value;
      const m = document.createElement('tr'); m.innerHTML = bmRowHtml ? bmRowHtml({}) : ''; const ms = m.querySelector('select[data-f=source], select[data-f=src]'); return { f, to, bm: ms ? [...ms.options].map(o => o.value) : null }; }).catch(e => ({ e: String(e) }));
    ok('   Transfer "many at once" rows: From only ZE (To another place); the issue rows: only ZE', same(grid.f, [ZE]) && grid.to !== ZE && (grid.bm === null || same(grid.bm, [ZE])), grid);
    // the pictures: his Diesel Issue form and his Transfer form
    const calm = () => F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const x = document.getElementById(id); if (x) x.hidden = true; }); });
    const shotOf = async (sel, file) => { await calm(); await F.evaluate(q => document.querySelector(q).closest('.panel, section, .card').scrollIntoView({ block: 'start' }), sel); await wait(800);
      const rr = await F.evaluate(q => { const x = document.querySelector(q).closest('.panel, section, .card').getBoundingClientRect(); return { x: x.left, y: Math.max(0, x.top), w: x.width, h: Math.min(x.bottom, window.innerHeight) - Math.max(0, x.top) }; }, sel);
      const fr = await (await F.frameElement()).boundingBox(); if (rr.w > 0 && rr.h > 0) await mp.screenshot({ path: SHOT + '/' + file, clip: { x: fr.x + rr.x, y: fr.y + rr.y, width: rr.w, height: Math.min(rr.h, 700) } }); };
    await shotOf('#d_src', 'dsrc162_issue.png');
    await F.evaluate(() => showTab('transfer')); await wait(2000);
    await shotOf('#t_from', 'dsrc162_transfer.png');
    // ---- 5. the Admin's page: every place ----
    const ap = await b.newPage(); await ap.setViewport({ width: 1600, height: 1000 }); ap.on('pageerror', e => errs.push('T2 admin: ' + String(e.message).slice(0, 200)));
    await ap.goto(SA + '/#sso=' + await ticket(SAp, 'T2'), { waitUntil: 'load' });
    const A = await find(ap, () => typeof S === 'object' && !!S.user && Array.isArray(S.locations) && S.locations.length === 3);
    const adm = { d_src: await opts(A, 'd_src'), t_from: await opts(A, 't_from'), dsrc: await A.evaluate(() => S.user.dsrc || null) };
    ok('5. the Admin\'s page: Issue source and Transfer From = every place; nothing told about sources', same(adm.d_src, [CP, ZE, WJ]) && same(adm.t_from, [CP, ZE, WJ]) && adm.dsrc === null, adm);
    // ---- 6. all ticked again in the Portal (Save changes) = every source ----
    await openHim();
    const back = await pp.evaluate(() => [...document.querySelectorAll('#pg_panel .ds-chk')].map(x => x.dataset.pg + ':' + x.value + ':' + x.checked));
    ok('6. the Portal\'s screen opened again: his ticks as saved (only ZE, twice)', same(back.filter(t => /:true$/.test(t)), ['Diesel Issue:' + ZE + ':true', 'Diesel Transfer:' + ZE + ':true']) && back.length === 6, back);
    await pp.evaluate(() => { document.querySelectorAll('#pg_panel .ds-chk').forEach(x => { x.checked = true; }); });
    await pp.click('#pg_save');
    let gone = false; for (let i = 0; i < 40 && !gone; i++) { await wait(500); gone = !JSON.parse(sql('rcl_s2', "select coalesce((select value from web.props where key = 'DIESEL_SOURCES'), '{}')") || '{}')[ME]; }
    const init2 = await M('getInit');
    ok('   every place ticked + Save: nothing kept for him; the page is told nothing (every source, as before)', gone && init2.user && !init2.user.dsrc, init2.user);
    x = await M('saveDieselIssue', iss(CP, 1100));
    ok('   an issue from CAMP PUMP: now saved', x && x.ok, x);
    ok('no error on the pages', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    try { if (b) await b.close(); } catch (e) {}
    try {
      if (n0 === '0') sql('rcl_s2', "delete from diesel_issue where machinery = 'DS-162'; delete from diesel_transfer where from_location in ('" + CP + "', '" + ZE + "', '" + WJ + "'); delete from diesel_inward where pump_name = 'Vendor Pump 162'; delete from master where id = 'DS-162';");
      const now2 = propsOf('rcl_s2');
      Object.keys(now2).filter(k => !(k in keepT2) && !/^V_/.test(k)).forEach(k => sql('rcl_s2', "delete from web.props where key = '" + k.replace(/'/g, "''") + "'"));
      sql('rcl_s2', "delete from app_users where email = '" + ME + "'; delete from web.cache where key like 'SB%' or key = 'USERS_LIST'");
      sql('rcl', "delete from rcl_user_sites where email = '" + ME + "'; delete from web.cache where key = 'USERS_LIST'");
      if (s1Had === '0') sql('rcl', "delete from web.props where key = 'DIESEL_SOURCES'");
      sql('rcl_portal', "delete from sessions where email = '" + ME + "'; delete from access where email = '" + ME + "'; delete from users where email = '" + ME + "';");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', 'select (select count(*) from diesel_issue) + (select count(*) from diesel_inward) + (select count(*) from diesel_transfer)') + ' diesel entries; T2 DIESEL_PLACES ' + sql('rcl_s2', "select count(*) from web.props where key in ('DIESEL_PLACES', 'DIESEL_SOURCES')") + '; ds162 in the Portal ' + sql('rcl_portal', "select count(*) from users where email = '" + ME + "'"));
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
