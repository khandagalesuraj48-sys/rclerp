// update-99 (ONE ADDRESS, asked 13-10-2026) in the browser, on the local rig in gateway mode – what Mechanical's vercel.json does
// live, played by /home/claude/rig/gateway.js on :3030: Mechanical at /, the Store at /store/, the Portal at /portal/.
//   "store page open dusri kade zal he chukich keles … store war click kel ki store ch dropdown khali yetil … jyach war click krel
//    te tithch open hoil same view madhe dusri kade nahi janar ani he sagle modual sathi asel … hach behiour all site madhe"
// Checks: the Portal under /portal/ (its logo and sign-in work there); a click on Store opens it at /store/ in the same tab; the
// Store's dark menu shows Mechanical's pages (sections as in Mechanical); a click opens Mechanical ON that page; Mechanical's
// dark menu shows the Store's pages; a click opens the Store on that page; a Store save goes through (its origin check);
// another site from a menu goes through the Portal and opens on the same page; ONE tab all the way, and its address always
// starts with the one address.
//   GATEWAY=1 PORTAL=1 bash /home/claude/rig/all.sh     then     node oneaddress99.js   (with geo-shim.js; pictures in shots/)
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
  sql('rcl', "delete from web.cache where key like 'F\\_%' or key like 'LG\\_%';");
  const hadT2 = sql('rcl', "select count(*) from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'") !== '0';
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [], urls = [];
  const app = p => p.frames().find(x => x !== p.mainFrame());
  try {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    p.on('framenavigated', f => { if (f === p.mainFrame()) urls.push(f.url()); });
    await p.setViewport({ width: 1440, height: 900 });
    // ---- the Portal under /portal/ ----
    await p.goto(G + '/portal', { waitUntil: 'load' });
    await until(() => p.evaluate(() => !document.getElementById('v_login').hidden));
    const pv = await p.evaluate(() => ({ url: location.href, logo: [...document.images].filter(i => /oc-logo/.test(i.src) && i.offsetParent).every(i => i.complete && i.naturalWidth > 0) }));
    ok('the Portal at <one address>/portal/ (the bare /portal goes to /portal/); its logo shows', pv.url === G + '/portal/' && pv.logo, pv);
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'l_email', { timeout: 20000 });
    await p.type('#l_email', 'sujit@rcl.test'); await p.type('#l_pass', 'Nashik#Road848!'); await p.click('#l_btn');
    const home = await until(() => p.evaluate(() => !document.getElementById('v_home').hidden && document.querySelectorAll('#h_sites a.mod').length));
    ok('   signing in works there (its changes pass the origin check under the one address)', !!home);
    // ---- Store from the Portal: same tab, same address ----
    await p.evaluate(() => [...document.querySelectorAll('#h_sites a.mod')].find(a => /module=store&site=S1/.test(a.getAttribute('href'))).click());
    const st = await until(() => p.url().startsWith(G + '/store/') && p.evaluate(() => !document.getElementById('v_app').hidden && document.getElementById('pg_title').textContent), 30000);
    ok('a click on Store: the Store opens at <one address>/store/ in the SAME tab, on its Dashboard', st === 'Dashboard' && (await ctx.pages()).length === 1, { st, url: p.url(), tabs: (await ctx.pages()).length });
    // ---- the Store's menu: Mechanical's pages ----
    await p.evaluate(() => [...document.querySelectorAll('#mods .grphead')].find(h => /Mechanical/.test(h.textContent)).click());
    const mp = await until(() => p.evaluate(() => { const g = [...document.querySelectorAll('#mods .grp')].find(x => /Mechanical/.test(x.textContent)); const b = g && [...g.querySelectorAll('.navbtn')]; return b && b.length > 5 && { n: b.length, caps: [...g.querySelectorAll('.cap')].map(c => c.textContent), log: (b.find(x => x.textContent.trim() === 'Log Book') || { dataset: {} }).dataset.go }; }), 15000);
    ok('   Store → Mechanical (a click): Mechanical\'s pages drop down, in its sections (Master, Diesel, Log Book, Billing, Reports)', !!mp && mp.caps.join() === 'Master,Diesel,Log Book,Billing,Reports' && mp.log === G + '/#site=S1&page=log', mp);
    await wait(500); await p.screenshot({ path: SHOTS + 'oneaddr_store_menu.png' });
    await p.evaluate(() => [...document.querySelectorAll('#mods .navbtn')].find(x => x.textContent.trim() === 'Log Book').click());
    const lg = await until(async () => { const f = app(p); return p.url().startsWith(G + '/') && f && await f.evaluate(() => document.getElementById('login_screen').hidden && !document.getElementById('sec-log').hidden && document.getElementById('page_title').textContent); }, 45000);
    ok('   "Log Book": Mechanical opens ON the Log Book, same tab, signed in through the Portal (nothing typed)', lg === 'Log Book' && (await ctx.pages()).length === 1, { lg, url: p.url() });
    await p.screenshot({ path: SHOTS + 'oneaddr_mech_log.png' });
    // ---- Mechanical's menu: the Store's pages ----
    const sm = await until(() => app(p).evaluate(() => { const g = document.querySelector('#grp_mods .modgrp[data-mod="store"]'); if (!g) return null; g.querySelector('.grphead').click(); const b = [...g.querySelectorAll('.navbtn')]; return b.length === 2 && b.map(x => x.textContent.trim() + '=' + x.dataset.go); }), 15000);
    ok('Mechanical → Store (a click): the Store\'s pages drop down – Dashboard, Item Master', !!sm && sm.join() === 'Dashboard=' + G + '/store/#site=S1&page=dashboard,Item Master=' + G + '/store/#site=S1&page=items', sm);
    await app(p).evaluate(() => { const g = document.querySelector('#grp_mods .modgrp[data-mod="store"]'); if (!g.classList.contains('open')) g.querySelector('.grphead').click(); });
    await wait(500); await p.screenshot({ path: SHOTS + 'oneaddr_mech_menu.png' });
    await app(p).evaluate(() => [...document.querySelectorAll('#grp_mods .navbtn')].find(x => /Item Master/.test(x.textContent)).click());
    const im = await until(() => p.url().startsWith(G + '/store/') && p.evaluate(() => !document.getElementById('v_app').hidden && document.getElementById('pg_title').textContent === 'Item Master' && !document.getElementById('pg_items').hidden), 30000);
    ok('   "Item Master": the Store opens ON Item Master, same tab', !!im && (await ctx.pages()).length === 1, p.url());
    // ---- a save in the Store through the one address ----
    const name = 'Gateway Test ' + Date.now().toString(36);
    await p.click('#b_new'); await p.evaluate(n => { document.getElementById('i_name').value = n; document.getElementById('i_unit').value = 'Nos'; document.getElementById('i_cat').value = 'Test'; }, name); await p.click('#b_save');
    const saved = await until(async () => { const d = await p.evaluate(() => !document.getElementById('dlg').hidden && document.getElementById('dlg_t').textContent); if (d && /proper name/i.test(d)) await p.evaluate(() => [...document.querySelectorAll('#dlg_btns button')].find(x => /Keep mine|Use/.test(x.textContent)).click()); return sql('rcl', "select count(*) from items where name = '" + name.replace(/'/g, "''") + "'") === '1'; }, 15000);
    ok('   a new item saved in the Store under the one address (the Store\'s origin check lets its own page through)', !!saved);
    // ---- another site from the menu: through the Portal, on the same page ----
    await p.click('#site_chg'); await wait(400);
    await p.evaluate(() => [...document.querySelectorAll('#dlg_btns button')].find(x => /T2/.test(x.textContent)).click());
    const t2 = await until(() => p.url().startsWith(G + '/store/') && p.evaluate(() => !document.getElementById('v_app').hidden && /T2/.test(document.getElementById('site_name').textContent) && document.getElementById('pg_title').textContent), 30000);
    ok('Store: Change site → T2 through the Portal, back on the same page (Item Master), same tab', t2 === 'Item Master' && (await ctx.pages()).length === 1, { t2, url: p.url() });
    await p.evaluate(() => [...document.querySelectorAll('#mods .grphead')].find(h => /Mechanical/.test(h.textContent)).click());
    await until(() => p.evaluate(() => [...document.querySelectorAll('#mods .navbtn')].some(x => x.textContent.trim() === 'Diesel Issue')), 15000);
    await p.evaluate(() => [...document.querySelectorAll('#mods .navbtn')].find(x => x.textContent.trim() === 'Diesel Issue').click());
    const t2m = await until(async () => { const f = app(p); return f && await f.evaluate(() => document.getElementById('login_screen').hidden && /T2/.test((document.getElementById('site_chg') || {}).textContent || '') && document.getElementById('page_title').textContent); }, 45000);
    ok('   Store on T2 → Mechanical "Diesel Issue": Mechanical was on S1 – it goes to T2 through the Portal and opens Diesel Issue', t2m === 'Diesel Issue', { t2m, url: p.url() });
    ok('ONE tab all the way, and every address it showed starts with the one address', (await ctx.pages()).length === 1 && urls.every(u => u.startsWith(G + '/')), urls.filter(u => !u.startsWith(G + '/')));
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error on any page', errs.length === 0, errs);
  // back as it was
  before.split('\n').filter(Boolean).forEach(l => { const [k, u] = l.split('|'); sql('rcl_portal', "update modules set url = '" + u + "' where key = '" + k + "';"); });
  sql('rcl_portal', "delete from access where granted_by = 'test' and module = 'store';");
  sql('rcl', "delete from items where name like 'Gateway Test %';");
  if (!hadT2) sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2';");
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
