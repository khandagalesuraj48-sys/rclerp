// update-138 – THE STAGING (TEST) DATABASE, on the local rig, the three servers as a Vercel Preview (VERCEL_ENV=preview):
//   asked 20-10-2026 "Staging database: HE 2 KR PERFECT" (Mechanical + Portal + Store, empty + a few TEST entries).
// Part A – the Preview pointed at databases WITHOUT the test mark (the rig's first site :3100 and Portal :3106 – like live):
//   every server refuses (503, "This is a Preview …"), the page shows the TEST band and nothing is read or written there.
// Part B – the Preview on the database made with staging/rcl_staging_all.sql (rcl_stg :3112), one address :3055 as live:
//   the Super Admin's one-time password → his own; the Mechanical and Store cards; the TEST entries are there; a save in
//   Mechanical and in the Store lands in the TEST database only; no Google Sheet backup; the band on every page.
//   needs: bash /home/claude/rig/stg_up.sh (the script starts it itself for each part)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const G = 'http://127.0.0.1:3055';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const sql = (db, q) => execSync('timeout 60 runuser -u postgres -- psql -d ' + db + ' -tA -q', { input: q }).toString().trim();
const up = env => execSync('timeout 150 bash /home/claude/rig/stg_up.sh', { env: Object.assign({}, process.env, env) }).toString().trim();
const SHOTS = '/home/claude/test/shots/';
const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 20000)) { try { const v = await fn(); if (v) return v; } catch (e) { /* the page is changing */ } await wait(300); } return null; };
const post = async (path, body, head) => { const r = await fetch(G + path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'X-RCL': '1', Origin: G }, head || {}), body: JSON.stringify(body) }); let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return { status: r.status, j }; };
const get = async path => { const r = await fetch(G + path); return { status: r.status, text: await r.text() }; };
// every row written to the rig's live-like databases (inserts + updates + deletes, all tables) – must not move in part A
const writes = db => Number(sql(db, 'select pg_stat_force_next_flush(); select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) from pg_stat_user_tables;').split('\n').pop());
const BAND = /id="rcl_preview_band"[^>]*>TEST copy \(Preview\)/;
(async () => {
  // ===================== A: the Preview on databases WITHOUT the mark (like the live ones) =====================
  ok('A: the staging rig is up on the live-like databases', /staging rig up/.test(up({ STG_DB_URL: 'http://127.0.0.1:3100', STG_PORTAL_DB_URL: 'http://127.0.0.1:3106' })));
  const w0 = [writes('rcl'), writes('rcl_portal')];
  const pg = await get('/');
  ok('A: Mechanical\'s page carries the TEST band', pg.status === 200 && BAND.test(pg.text), pg.text.slice(0, 300));
  const lg = await post('/api/rpc', { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] });
  ok('A: Mechanical refuses the database without the mark – 503, "This is a Preview …", nothing read', lg.status === 503 && /^This is a Preview \(a test copy of the app\)/.test(lg.j.error || ''), lg);
  const pm = await post('/portal/api/auth', { action: 'login', email: 'sujit@rcl.test', password: 'Nashik#Road848!' });
  ok('A: the Portal refuses its database without the mark (503, the same words)', pm.status === 503 && /^This is a Preview/.test(pm.j.error || ''), pm);
  const pme = await post('/portal/api/auth', { action: 'me' });
  ok('A: the Portal\'s page learns it is a Preview (for its band)', pme.j.preview === true || /^This is a Preview/.test(pme.j.error || ''), pme);
  const sme = await fetch(G + '/store/api/me').then(r => r.json());
  ok('A: the Store says it is a Preview (for its band)', sme.preview === true, sme);
  let storeErr = '';
  try { execSync('cd /home/claude/rcl-store && timeout 60 node -e "require(\'./lib/sites\').db(\'S1\', \'GET\', \'items?select=code&limit=1\').then(r => { console.log(\'READ\', JSON.stringify(r)); process.exit(0) }, e => { console.log(\'REFUSED\', e.status || e.code, e.message); process.exit(0) })"', { env: Object.assign({}, process.env, { VERCEL_ENV: 'preview', SUPABASE_URL: 'http://127.0.0.1:3100', SUPABASE_SECRET_KEY: 'sb_secret_rigkey' }) }).toString().trim(); } catch (e) { storeErr = String(e.stdout || e.message); }
  const sr = execSync('cd /home/claude/rcl-store && timeout 60 node -e "require(\'./lib/sites\').db(\'S1\', \'GET\', \'items?select=code&limit=1\').then(r => console.log(\'READ \' + JSON.stringify(r)), e => console.log(\'REFUSED \' + (e.status || e.code) + \' \' + e.message))"', { env: Object.assign({}, process.env, { VERCEL_ENV: 'preview', SUPABASE_URL: 'http://127.0.0.1:3100', SUPABASE_SECRET_KEY: 'sb_secret_rigkey' }) }).toString().trim();
  ok('A: the Store\'s database calls refuse the database without the mark (503)', /^REFUSED 503 This is a Preview/.test(sr), sr + storeErr);
  const bk = await post('/api/backup', { token: 'x', site: 'S1' });
  ok('A: the backup asked by the page does nothing (no sign-in can be read: refused)', bk.status !== 200 || bk.j.ok !== true, bk);
  await wait(1500);
  const w1 = [writes('rcl'), writes('rcl_portal')];
  ok('A: not one row was written to the live-like databases (Mechanical\'s first site, the Portal)', w1[0] === w0[0] && w1[1] === w0[1], [w0, w1]);
  // the same servers, NOT a Preview (production): the guard asks nothing – they work as before
  const prodRead = execSync('cd /home/claude/rcl-store && timeout 60 node -e "require(\'./lib/sites\').db(\'S1\', \'GET\', \'items?select=code&limit=1\').then(r => console.log(\'READ \' + JSON.stringify(r)), e => console.log(\'REFUSED \' + e.message))"', { env: Object.assign({}, process.env, { VERCEL_ENV: 'production', SUPABASE_URL: 'http://127.0.0.1:3100', SUPABASE_SECRET_KEY: 'sb_secret_rigkey' }) }).toString().trim();
  ok('A: live (not a Preview) the same call reads as before – the guard is only for a Preview', /^READ \[/.test(prodRead), prodRead);

  // ===================== B: the Preview on the staging database =====================
  ok('B: the staging rig is up on rcl_stg', /staging rig up/.test(up({})));
  // (rig only) the modules' addresses: the SQL file has the Vercel staging addresses; here the one address is :3055
  // the SQL file run once more (as he may do): it gives the modules their staging addresses, keeps every TEST entry once
  sql('rcl_stg', "update modules set url = null where key = 'mechanical'; delete from modules where key = 'store';");
  const fileSql = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'staging', 'rcl_staging_all.sql'), 'utf8')
    .replace("'TYPE-YOUR-EMAIL-HERE'", "'Boss@RCL.test'").replace("'TYPE-YOUR-NAME-HERE'", "'Test Boss'").replace("'TYPE-A-ONE-TIME-PASSWORD-HERE'", "'OneTime#2026'");
  const again = execSync('timeout 60 runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -d rcl_stg -tA', { input: fileSql }).toString().trim().split('\n').pop();
  ok('B: the SQL file runs again on the staging database without a fault (nothing doubled)', /^TEST database ready · test mark: yes · machinery [0-9]+ · vendors [0-9]+ · items [0-9]+ · sites 1 · Portal sites 1/.test(again) && sql('rcl_stg', "select count(*) from master where id like 'TEST-%'") === '3', again);
  const live = sql('rcl_stg', "select string_agg(key || ' ' || url, ', ' order by key) from modules");
  ok('B: the SQL file gave the modules the staging addresses (Mechanical, Store under it)', live === 'mechanical https://rclerp-git-staging-pk12356843.vercel.app, store https://rclerp-git-staging-pk12356843.vercel.app/store', live);
  sql('rcl_stg', "update modules set url = '" + G + "' where key = 'mechanical'; update modules set url = '" + G + "/store' where key = 'store'; delete from counters;" +
    // (rig only, so the test can run again: the Super Admin back to the one-time password of the SQL file, the test's own saves out)
    " delete from sessions; update users set password_hash = 'OneTime#2026' where email = 'boss@rcl.test'; delete from vendors where vendor_name = 'Test Vendor B'; delete from items where name = 'Gloves Test Pair'; delete from store_sessions; delete from web.cache where key like 'F\\_%' or key like 'LG\\_%';");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  const app = p => p.frames().find(x => x !== p.mainFrame() && !/\/store\//.test(x.url()) && x.parentFrame() === p.mainFrame());
  const store = p => p.frames().find(x => /\/store\/\?embed=1/.test(x.url()));
  try {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(G + '/portal/', { waitUntil: 'load' });
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'l_email', { timeout: 20000 });
    ok('B: the Portal page shows the TEST band', await p.evaluate(() => !!document.getElementById('rcl_preview_band')));
    await p.type('#l_email', 'Boss@RCL.test'); await p.type('#l_pass', 'OneTime#2026'); await p.click('#l_btn');
    const pw = await until(() => p.evaluate(() => !document.getElementById('v_pw').hidden && document.getElementById('p_title').textContent));
    ok('B: the Super Admin of the SQL file signs in with the one-time password and must set his own', pw === 'Set your own password', pw);
    await p.type('#p_old', 'OneTime#2026'); await p.type('#p_new', 'Staging#Own2026!'); await p.type('#p_new2', 'Staging#Own2026!'); await p.click('#p_btn');
    const sa = await until(() => p.evaluate(() => !document.getElementById('v_sa').hidden && document.getElementById('sa_email').textContent));
    ok('B: the Super Admin\'s own page (Users & Access) opens after his password', sa === 'boss@rcl.test', sa);
    await p.goto(G + '/portal/?menu=1', { waitUntil: 'load' });
    const cards = await until(() => p.evaluate(() => !document.getElementById('v_home').hidden && [...document.querySelectorAll('#h_sites a.mod')].map(a => a.getAttribute('href')).join(' ')));
    ok('B: his own password saved (hashed); the home shows Mechanical and Store of site S1', !!cards && /module=mechanical&site=S1/.test(cards) && /module=store&site=S1/.test(cards) && /^scrypt\$/.test(sql('rcl_stg', "select password_hash from users where email = 'boss@rcl.test'")), cards);
    await p.screenshot({ path: SHOTS + 'staging138_portal.png' });
    // Mechanical through the Portal card
    await p.evaluate(() => [...document.querySelectorAll('#h_sites a.mod')].find(a => /module=mechanical&site=S1/.test(a.getAttribute('href'))).click());
    const tk = await until(async () => { const f = app(p); if (!f) return null; return f.evaluate(() => { const t = sessionStorage.getItem('rcl_token') || localStorage.getItem('rcl_token'); return t && document.getElementById('login_screen').hidden ? t : null; }); }, 40000);
    ok('B: Mechanical opens from the Portal card and signs in by itself (the staging Portal\'s ticket)', !!tk);
    ok('B: Mechanical\'s page shows the TEST band', await p.evaluate(() => !!document.getElementById('rcl_preview_band') && getComputedStyle(document.getElementById('rcl_preview_band')).position === 'fixed'));
    await wait(1500); await p.screenshot({ path: SHOTS + 'staging138_mech.png' });
    const vend = await post('/api/rpc', { fn: 'api', args: [tk, 'getVendors', []], site: 'S1' });
    const vl = JSON.stringify(vend.j.result || vend.j);
    ok('B: Mechanical reads the TEST vendor of the SQL file', vend.status === 200 && /Test Vendor A/.test(vl), vl.slice(0, 300));
    const look = await post('/api/rpc', { fn: 'api', args: [tk, 'getLookups', []], site: 'S1' });
    const ll = JSON.stringify(look.j.result || look.j);
    ok('B: Mechanical reads the three TEST machinery', ['TEST-JCB-01', 'TEST-TIPPER-01', 'TEST-EXC-01'].every(m => ll.indexOf(m) > -1), ll.slice(0, 300));
    const sv = await post('/api/rpc', { fn: 'api', args: [tk, 'saveVendor', [{ name: 'Test Vendor B', gstReg: 'No', pan: 'TESTB1234B', bank: 'TEST BANK', account: '000033334444', ifsc: 'TEST0000002' }, 'add']], site: 'S1' });
    ok('B: a Mechanical save on the staging copy lands in the TEST database', sv.status === 200 && !sv.j.error && sql('rcl_stg', "select count(*) from vendors where vendor_name = 'Test Vendor B'") === '1', sv);
    ok('   …and nowhere live-like', sql('rcl', "select count(*) from vendors where vendor_name = 'Test Vendor B'") === '0');
    const bk2 = await post('/api/backup', { token: tk, site: 'S1' });
    ok('B: the Google Sheet backup does not run on a Preview', bk2.j.ok !== true || bk2.j.off === true, bk2);
    // the Store inside Mechanical's screen (one address, as live)
    await until(() => app(p).evaluate(() => !!document.querySelector('#grp_mods .modgrp[data-mod="store"] .navbtn[data-page]')), 30000);
    await app(p).evaluate(() => { const g = document.querySelector('#grp_mods .modgrp[data-mod="store"]'); if (!g.classList.contains('open')) g.querySelector('.grphead').click(); });
    await app(p).evaluate(() => [...document.querySelectorAll('#grp_mods .navbtn[data-page]')].find(x => /Item Master/.test(x.textContent)).click());
    const st = await until(async () => { const f = store(p); if (!f) return null; return f.evaluate(() => !document.getElementById('v_app').hidden && document.getElementById('pg_title').textContent); }, 40000);
    ok('B: the Store opens inside Mechanical\'s screen (one address, as live) and signs in by itself', !!st, st);
    if (store(p)) {
      const items = await store(p).evaluate(() => fetch('api/items', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'list' }) }).then(r => r.json()));
      const codes = (items.items || []).map(i => i.code + ' ' + i.name).join(', ');
      ok('B: the Store reads the three TEST items', /ITM-0001 Cement Bag \(TEST\)/.test(codes) && /ITM-0003 Steel Bar 12mm \(TEST\)/.test(codes), JSON.stringify(items).slice(0, 300));
      const si = await store(p).evaluate(() => fetch('api/items', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'save', item: { name: 'Gloves Test Pair', unit: 'Pair', category: 'Safety' } }) }).then(r => r.json()));
      ok('B: a Store save on the staging copy gets the next code (ITM-0004) in the TEST database', sql('rcl_stg', "select code from items where name = 'Gloves Test Pair'") === 'ITM-0004', si);
      ok('   …and nowhere live-like', sql('rcl', "select count(*) from items where name = 'Gloves Test Pair'") === '0');
      ok('B: the Store page (alone) shows the TEST band too', BAND.test((await get('/store/')).text) || await (async () => { const q = await ctx.newPage(); await q.goto(G + '/store/', { waitUntil: 'load' }); const v = await until(() => q.evaluate(() => !!document.getElementById('rcl_preview_band'))); await q.close(); return !!v; })());
    }
    ok('B: no error on the pages', !errs.length, errs);
  } finally { await b.close(); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n') + '\nCRASH ' + (e && e.stack || e)); process.exit(1); });
