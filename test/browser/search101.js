// update-101 in the browser, on the local rig in gateway mode (rig/gateway.js :3030 – Mechanical at /, the Store at /store/):
//   "kali patti scroll … tyach logic wegle … baki bhag … wegle; kali patti scroll krtana white portion side la dise naye"
//   "search ctrl k new modual la search krt nahi … new task add zal tr search proper full in built asel"
// Checks: the dark menu stays on the screen and scrolls by itself (the page does not move with it, nothing empty beside it); the
// page scrolls by itself (the menu stays); Ctrl K finds the Store's pages and the Store's items (by name, code, a spelling
// mistake); a found item opens Store › Item Master showing that item – in the same screen.
//   GATEWAY=1 PORTAL=1 bash /home/claude/rig/all.sh     then     node search101.js   (with geo-shim.js; pictures in shots/)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const G = 'http://127.0.0.1:3030';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const SHOTS = '/home/claude/test/shots/';
const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 20000)) { try { const v = await fn(); if (v) return v; } catch (e) { /* the page is changing */ } await wait(300); } return null; };
(async () => {
  const before = sql('rcl_portal', "select key || '|' || url from modules where key in ('mechanical', 'store') order by key");
  sql('rcl_portal', "update modules set url = '" + G + "' where key = 'mechanical'; insert into modules (key, name, url, status, sort) values ('store', 'Store', '" + G + "/store', 'live', 2) on conflict (key) do update set url = excluded.url, status = 'live'; " +
    "insert into access (email, site, module, role, granted_by) values ('sujit@rcl.test', 'S1', 'store', 'admin', 'test') on conflict (email, site, module) do nothing; delete from counters; update users set start_item = null where email = 'sujit@rcl.test';");
  sql('rcl', "delete from web.cache where key like 'F\\_%' or key like 'LG\\_%'; delete from store_sessions; delete from items where name like 'Searchtest %'; " +
    "insert into items (name, name_key, unit, category, hsn, created_by) values ('Searchtest Hydraulic Pump', 'searchtesthydraulicpump', 'Nos', 'Spare Parts', '8413', 'test') returning code;");
  const code = sql('rcl', "select code from items where name = 'Searchtest Hydraulic Pump'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  const app = p => p.frames().find(x => x !== p.mainFrame() && x.parentFrame() === p.mainFrame() && !/\/store\//.test(x.url()));
  const store = p => p.frames().find(x => /\/store\/\?embed=1/.test(x.url()));
  try {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.setViewport({ width: 1440, height: 760 });
    await p.goto(G + '/portal/', { waitUntil: 'load' });
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'l_email', { timeout: 20000 });
    await p.type('#l_email', 'sujit@rcl.test'); await p.type('#l_pass', 'Nashik#Road848!'); await p.click('#l_btn');
    await until(() => p.evaluate(() => !document.getElementById('v_home').hidden && document.querySelectorAll('#h_sites a.mod').length));
    await p.evaluate(() => [...document.querySelectorAll('#h_sites a.mod')].find(a => /module=mechanical&site=S1/.test(a.getAttribute('href'))).click());
    await until(async () => app(p) && await app(p).evaluate(() => document.getElementById('login_screen').hidden && !!document.querySelector('#grp_mods .modgrp[data-mod="store"] .navbtn[data-page]')), 60000);
    await wait(2500); await app(p).evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { try { closeConfirm(false); } catch (e) { document.getElementById('cf_ok').click(); } } });
    // ---- the dark menu: its own scroll ----
    await app(p).evaluate(() => { document.querySelectorAll('.subgrp').forEach(g => { if (!g.classList.contains('open')) g.querySelector('.sghead').click(); }); const sb = document.getElementById('side_toggle'); if (document.querySelector('.app.side-auto') && document.getElementById('side').classList.contains('mini')) sb.click(); });
    await wait(500);
    const m1 = await app(p).evaluate(() => { const side = document.getElementById('side'), nav = side.querySelector('nav'); nav.scrollTop = 100000; return { pos: getComputedStyle(side).position, navScroll: nav.scrollTop, canScroll: nav.scrollHeight > nav.clientHeight, pageY: window.scrollY, top: Math.round(side.getBoundingClientRect().top), h: Math.round(side.getBoundingClientRect().height), vh: window.innerHeight }; });
    ok('the dark menu stays on the screen (full height) and scrolls by itself – the page does not move with it', m1.pos === 'sticky' && m1.canScroll && m1.navScroll > 0 && m1.pageY === 0 && m1.top === 0 && Math.abs(m1.h - m1.vh) <= 2, m1);
    await app(p).evaluate(() => { document.getElementById('side').querySelector('nav').scrollTop = 0; document.getElementById('tab-log').click(); });
    await wait(1500);
    const m2 = await app(p).evaluate(() => { window.scrollTo(0, 100000); const side = document.getElementById('side'); return { pageY: window.scrollY, top: Math.round(side.getBoundingClientRect().top), long: document.documentElement.scrollHeight > window.innerHeight }; });
    ok('   the page scrolls by itself – the dark menu stays where it is', !m2.long || (m2.pageY > 0 && m2.top === 0), m2);
    await app(p).evaluate(() => window.scrollTo(0, 0));
    // ---- Ctrl K: the Store too ----
    const search = async q => { await app(p).evaluate(q2 => { gsOpen(); const i = document.getElementById('gs_in'); i.value = q2; i.dispatchEvent(new Event('input')); }, q);
      return until(() => app(p).evaluate(() => { const l = document.getElementById('gs_list'); if (/Searching/.test(l.textContent)) return null; return [...l.querySelectorAll('.gs-grp, .gs-item')].map(x => x.classList.contains('gs-grp') ? '#' + x.textContent : x.querySelector('b').textContent + ' / ' + x.querySelector('small').textContent); }), 30000); };
    let r = await search('item master');
    ok('Ctrl K "item master": the Store\'s page "Item Master" is among the pages', !!r && r.some(x => /^Item Master \/ Store/.test(x)), r);
    r = await search('hydraulic pump');
    ok('Ctrl K "hydraulic pump": the Store\'s item is found (group "Store – Items", code and name)', !!r && r.indexOf('#Store – Items') > -1 && r.some(x => x.indexOf(code + '  –  Searchtest Hydraulic Pump') === 0), r);
    await p.screenshot({ path: SHOTS + 'search_store_item.png' });
    r = await search(code.toLowerCase());
    ok('   by its code (' + code + ')', !!r && r.some(x => x.indexOf(code + '  –  ') === 0), r);
    r = await search('hydrolic pmup');
    ok('   with spelling mistakes ("hydrolic pmup")', !!r && r.some(x => x.indexOf(code + '  –  ') === 0), r);
    // ---- a found item opens in the same screen, showing that item ----
    await search('searchtest hydraulic');
    await app(p).evaluate(c => { const it = [...document.querySelectorAll('#gs_list .gs-item')].find(x => x.querySelector('b').textContent.indexOf(c) === 0); it.click(); }, code);
    const shown = await until(async () => { const f = store(p); if (!f) return null; const s = await f.evaluate(() => !document.getElementById('pg_items').hidden && document.getElementById('f_q').value + '|' + [...document.querySelectorAll('#i_rows tr[data-code]')].map(t => t.dataset.code).join(',')); const v = await app(p).evaluate(() => !document.getElementById('sec-ext').hidden && document.getElementById('page_title').textContent); return s && v === 'Item Master' && s; }, 20000);
    ok('   a click on it: Store › Item Master in the same screen, showing that item only', shown === code + '|' + code, shown);
    await wait(500); await p.screenshot({ path: SHOTS + 'search_opened_item.png' });
    r = await search('diesel issue');
    ok('Mechanical\'s own search as before ("diesel issue" → the page)', !!r && r.some(x => /^Diesel Issue \//.test(x)), r);
    ok('one tab', (await ctx.pages()).length === 1);
    await app(p).evaluate(() => { document.getElementById('tab-log').click(); document.getElementById('side').querySelector('nav').scrollTop = 100000; }); await wait(800);
    await p.screenshot({ path: SHOTS + 'menu_scrolled.png' });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error on any page', errs.length === 0, errs);
  before.split('\n').filter(Boolean).forEach(l => { const [k, u] = l.split('|'); sql('rcl_portal', "update modules set url = '" + u + "' where key = '" + k + "';"); });
  sql('rcl_portal', "delete from access where granted_by = 'test' and module = 'store';");
  sql('rcl', "delete from items where name like 'Searchtest %';");
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
