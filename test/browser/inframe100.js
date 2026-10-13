// update-100 (THE SAME VIEW, asked 13-10-2026) in the browser, on the local rig in gateway mode (rig/gateway.js :3030 = what the
// live rewrites do: Mechanical at /, the Store at /store/, the Portal at /portal/):
//   "mechanical che tab bgh diesel issue log book he eka warun dusrya war click kel ki sign in magat nahit patkn yetat same other
//    modual user use krt sl r tya modual madhe pn same as smoothness asel" – "Store open kel tri Mechanical sarkha view – sagle
//    fix aahe fkt tab changes".
// Checks: one sign-in; the Store's card on the Portal opens Mechanical's screen with the Store page in the middle; Mechanical's
// dark menu and top bar stay; Store pages and Mechanical pages swap in place (the Store page is not loaded again); no
// sign-in page after the first; Back; a Store save inside; a Store sign-in that ended comes back by itself; another site.
//   GATEWAY=1 PORTAL=1 bash /home/claude/rig/all.sh     then     node inframe100.js   (with geo-shim.js; pictures in shots/)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const G = 'http://127.0.0.1:3030';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const SHOTS = '/home/claude/test/shots/';
const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 20000)) { try { const v = await fn(); if (v) return v; } catch (e) { /* the page is changing */ } await wait(300); } return null; };
(async () => {
  const before = sql('rcl_portal', "select key || '|' || url from modules where key in ('mechanical', 'store') order by key");
  sql('rcl_portal', "update modules set url = '" + G + "' where key = 'mechanical'; insert into modules (key, name, url, status, sort) values ('store', 'Store', '" + G + "/store', 'live', 2) on conflict (key) do update set url = excluded.url, status = 'live'; " +
    "insert into access (email, site, module, role, granted_by) values ('sujit@rcl.test', 'S1', 'store', 'admin', 'test'), ('sujit@rcl.test', 'T2', 'store', 'user', 'test'), ('sujit@rcl.test', 'T2', 'mechanical', 'user', 'test') on conflict (email, site, module) do nothing; " +
    "delete from counters; update users set start_item = null where email = 'sujit@rcl.test';");
  sql('rcl', "delete from web.cache where key like 'F\\_%' or key like 'LG\\_%'; delete from store_sessions;"); sql('rcl_s2', 'delete from store_sessions;');
  const hadT2 = sql('rcl', "select count(*) from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'") !== '0';
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [], tops = [];
  const app = p => p.frames().find(x => x !== p.mainFrame() && !/\/store\//.test(x.url()) && x.parentFrame() === p.mainFrame());
  const store = p => p.frames().find(x => /\/store\/\?embed=1/.test(x.url()));
  const view = p => app(p).evaluate(() => ({ title: document.getElementById('page_title').textContent, crumb: document.getElementById('crumb_mod').textContent, ext: !document.getElementById('sec-ext').hidden,
    side: !!document.getElementById('site_chg') && document.getElementById('side').offsetWidth > 0, login: !document.getElementById('login_screen').hidden }));
  try {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    p.on('framenavigated', f => { if (f === p.mainFrame()) tops.push(f.url()); });
    await p.setViewport({ width: 1440, height: 900 });
    // ---- the one sign-in ----
    await p.goto(G + '/portal/', { waitUntil: 'load' });
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'l_email', { timeout: 20000 });
    await p.type('#l_email', 'sujit@rcl.test'); await p.type('#l_pass', 'Nashik#Road848!'); await p.click('#l_btn');
    await until(() => p.evaluate(() => !document.getElementById('v_home').hidden && document.querySelectorAll('#h_sites a.mod').length));
    const signIns = tops.length;
    // ---- the Store's card → Mechanical's screen with the Store in the middle ----
    await p.evaluate(() => [...document.querySelectorAll('#h_sites a.mod')].find(a => /module=store&site=S1/.test(a.getAttribute('href'))).click());
    const v1 = await until(async () => { const f = store(p); if (!f || !app(p)) return null; const s = await f.evaluate(() => !document.getElementById('v_app').hidden && document.getElementById('pg_title').textContent); return s && Object.assign(await view(p), { store: s }); }, 60000);
    ok('the Store\'s card on the Portal: Mechanical\'s screen opens with the Store\'s Dashboard in the middle (address = the main one)', !!v1 && v1.ext && v1.side && !v1.login && v1.store === 'Dashboard' && v1.crumb === 'Store' && p.url().startsWith(G + '/') && !/\/store\//.test(p.url()), { v1, url: p.url() });
    const inside = await store(p).evaluate(() => ({ side: getComputedStyle(document.getElementById('side')).display, top: getComputedStyle(document.querySelector('.topbar')).display }));
    ok('   inside, the Store shows no menu or top bar of its own – Mechanical\'s are the only ones', inside.side === 'none' && inside.top === 'none', inside);
    await wait(800); await p.screenshot({ path: SHOTS + 'inframe_store_dash.png' });
    await store(p).evaluate(() => { window.__still = 1; });
    // ---- Store pages ↔ Mechanical pages, in place ----
    await app(p).evaluate(() => { const g = document.querySelector('#grp_mods .modgrp[data-mod="store"]'); if (!g.classList.contains('open')) g.querySelector('.grphead').click(); });
    await app(p).evaluate(() => [...document.querySelectorAll('#grp_mods .navbtn[data-page]')].find(x => /Item Master/.test(x.textContent)).click());
    const v2 = await until(async () => { const s = await store(p).evaluate(() => document.getElementById('pg_title').textContent === 'Item Master' && !document.getElementById('pg_items').hidden && window.__still === 1); return s && await view(p); }, 15000);
    ok('Mechanical\'s menu → Store › Item Master: only the middle changes (the Store page is not loaded again); the title says Item Master', !!v2 && v2.title === 'Item Master' && v2.ext && !v2.login, v2);
    await app(p).evaluate(() => document.getElementById('tab-log').click());
    const v3 = await until(async () => { const v = await view(p); return !v.ext && v.title === 'Log Book' && await app(p).evaluate(() => !document.getElementById('sec-log').hidden) && v; }, 15000);
    ok('   → Mechanical\'s Log Book: at once, in the same screen', !!v3, v3 || await view(p));
    const t0 = Date.now();
    await app(p).evaluate(() => [...document.querySelectorAll('#grp_mods .navbtn[data-page]')].find(x => /Item Master/.test(x.textContent)).click());
    const v4 = await until(async () => { const v = await view(p); return v.ext && v.title === 'Item Master' && await store(p).evaluate(() => window.__still === 1) && v; }, 10000);
    ok('   → back to Store › Item Master: at once (' + (Date.now() - t0) + ' ms), still the same Store page – no sign-in, nothing loaded again', !!v4 && Date.now() - t0 < 3000, v4);
    await app(p).evaluate(() => document.getElementById('pg_back').click());
    const v5 = await until(async () => { const v = await view(p); return !v.ext && v.title === 'Log Book' && v; }, 10000);
    ok('   Back (top bar) from the Store page: to Log Book, the page before it', !!v5, await view(p));
    await app(p).evaluate(() => [...document.querySelectorAll('#grp_mods .navbtn[data-page]')].find(x => /Item Master/.test(x.textContent)).click()); await wait(800);
    await p.screenshot({ path: SHOTS + 'inframe_store_items.png' });
    // ---- a save inside ---- (a note Mechanical shows by itself at the start – "Vehicle papers" – is closed first, as a person would)
    await app(p).evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { try { closeConfirm(false); } catch (e) { document.getElementById('cf_ok').click(); } } }); await wait(500);
    const name = 'Inframe Test ' + Date.now().toString(36), f = store(p);
    await f.evaluate(() => document.getElementById('b_new').click()); await f.evaluate(n => { document.getElementById('i_name').value = n; document.getElementById('i_unit').value = 'Nos'; document.getElementById('i_cat').value = 'Test'; }, name); await f.evaluate(() => document.getElementById('b_save').click());
    const saved = await until(async () => { const d = await f.evaluate(() => !document.getElementById('dlg').hidden && document.getElementById('dlg_t').textContent); if (d && /proper name/i.test(d)) await f.evaluate(() => [...document.querySelectorAll('#dlg_btns button')].find(x => /Keep mine|Use/.test(x.textContent)).click()); return sql('rcl', "select count(*) from items where name = '" + name + "'") === '1'; }, 15000);
    ok('a new item saved in the Store inside Mechanical\'s screen', !!saved);
    // ---- the Store's sign-in ended (12 h): it comes back by itself, nothing shown ----
    sql('rcl', 'delete from store_sessions;');
    await f.evaluate(() => document.getElementById('b_export') && document.querySelector('[data-page="dashboard"]').click());
    const back = await until(async () => sql('rcl', 'select count(*) from store_sessions') === '1' && await f.evaluate(() => !document.getElementById('v_app').hidden && document.getElementById('pg_title').textContent === 'Dashboard'), 20000);
    const v6 = await view(p);
    ok('the Store\'s sign-in ended: a new one comes by itself – no sign-in page, the screen stays', !!back && !v6.login && v6.ext && p.url().startsWith(G + '/') && !/\/portal\//.test(p.url()), { back, v6, url: p.url() });
    // ---- another site ----
    await app(p).evaluate(() => { try { closeConfirm(false); } catch (e) { /* none open */ } });
    await app(p).evaluate(() => document.getElementById('site_chg').click()); await wait(600);
    await app(p).evaluate(() => [...document.querySelectorAll('#cf_msg .sp-btn')].find(x => /T2/.test(x.textContent)).click());
    await until(async () => app(p) && await app(p).evaluate(() => localStorage.getItem('rcl_site') === 'T2' && document.getElementById('login_screen').hidden), 40000); await wait(2500);
    await app(p).evaluate(() => { const g = document.querySelector('#grp_mods .modgrp[data-mod="store"]'); if (!g.classList.contains('open')) g.querySelector('.grphead').click(); });
    await until(() => app(p).evaluate(() => [...document.querySelectorAll('#grp_mods .navbtn[data-page]')].some(x => /Item Master/.test(x.textContent))), 15000);
    await app(p).evaluate(() => [...document.querySelectorAll('#grp_mods .navbtn[data-page]')].find(x => /Item Master/.test(x.textContent)).click());
    const t2 = await until(async () => { const s = store(p); return s && await s.evaluate(() => !document.getElementById('v_app').hidden && document.getElementById('pg_title').textContent === 'Item Master' && document.getElementById('i_count').textContent + '|' + document.getElementById('u_role').textContent); }, 30000);
    ok('Change site → T2 (Mechanical\'s): Store › Item Master there shows T2\'s items only (none), as Store User – no sign-in', !!t2 && /^0 of 0/.test(t2) && /Store User/.test(t2), t2);
    ok('ONE tab all the way; after the one sign-in no sign-in page came again', (await ctx.pages()).length === 1 && !tops.slice(signIns).some(u => /\/portal\/(\?.*)?$/.test(u) && !/msg=/.test(u)), tops.slice(signIns));
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error on any page', errs.length === 0, errs);
  before.split('\n').filter(Boolean).forEach(l => { const [k, u] = l.split('|'); sql('rcl_portal', "update modules set url = '" + u + "' where key = '" + k + "';"); });
  sql('rcl_portal', "delete from access where granted_by = 'test' and module = 'store';");
  sql('rcl', "delete from items where name like 'Inframe Test %';");
  if (!hadT2) sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2';");
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
