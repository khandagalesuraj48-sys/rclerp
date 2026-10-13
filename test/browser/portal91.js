// update-91 (sign-in through the Portal) in the browser, on the local rig (run test/portal91api.js first – it sets the Portal up):
//   Mechanical :3000 linked to the Portal :3010; :3001 not linked (as live today).
//   Opening Mechanical → the Portal's sign-in → the dashboard → Mechanical, signed in, no password typed in Mechanical;
//   "Modules" → Mechanical on the other site (through the Portal, no sign-in); a sign-in that ended comes back by itself;
//   the password button → the Portal's "Change password"; Logout → signed out of the Portal too; ?local=1 → the old sign-in;
//   a server not linked → the old sign-in as before; a phone.
//   node portal91.js      (with geo-shim.js; pictures in /home/claude/test/shots/)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const M = 'http://127.0.0.1:3000', PLAIN = 'http://127.0.0.1:3001', P = 'http://127.0.0.1:3010';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const SHOTS = '/home/claude/test/shots/';
const PW = 'Nashik#Road848!';
// the Portal's sign-in puts the cursor in the email box a moment after it opens: typing starts after that, as a person's does
const settled = p => p.waitForFunction(() => document.activeElement && document.activeElement.id === 'l_email', { timeout: 20000 });
const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 20000)) { try { const v = await fn(); if (v) return v; } catch (e) { /* the page is changing */ } await wait(300); } return null; };
(async () => {
  // the start: sujit has Mechanical on S1 (Admin) and on T2 (User) in the Portal
  sql('rcl_portal', "insert into public.access (email, site, module, role, granted_by) values ('sujit@rcl.test', 'T2', 'mechanical', 'user', 'test') on conflict (email, site, module) do update set role = 'user'; delete from public.counters; update public.users set start_item = null where email = 'sujit@rcl.test';");
  // (update-93) a second module on S1 for the shortcuts in the top bar – "Store" played by the other app server (:3001)
  sql('rcl_portal', "insert into public.modules (key, name, url, status, sort) values ('store', 'Store', 'http://127.0.0.1:3001', 'live', 2) on conflict (key) do update set url = excluded.url, status = 'live'; insert into public.access (email, site, module, role, granted_by) values ('sujit@rcl.test', 'S1', 'store', 'user', 'test') on conflict (email, site, module) do nothing;");
  sql('rcl', "delete from web.cache where key like 'F\\_%' or key like 'LG\\_%';");
  const hadT2 = sql('rcl', "select count(*) from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'") !== '0';      // (opening T2 through the Portal writes it; put back at the end)
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  const app = p => p.frames().find(x => x !== p.mainFrame());
  // a note the app shows by itself at the start (e.g. "Vehicle papers need attention" for an Admin) is closed first, as a person would
  const closeDlg = async p => { await wait(2500); await app(p).evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { try { closeConfirm(false); } catch (e) { document.getElementById('cf_ok').click(); } } }); await wait(400); };
  const inApp = async p => { const f = app(p); return f && f.evaluate(() => document.getElementById('login_screen').hidden === true && !!document.getElementById('site_chg')); };
  try {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.setViewport({ width: 1440, height: 900 });
    // ---- open Mechanical: it sends the person to the Portal ----
    await p.goto(M + '/', { waitUntil: 'load' });
    const atPortal = await until(() => p.url().startsWith(P) && p.evaluate(() => !document.getElementById('v_login').hidden));
    ok('opening Mechanical, nobody signed in: the browser goes to the Portal\'s sign-in (no Mechanical sign-in screen)', !!atPortal, p.url());
    await settled(p); await p.type('#l_email', 'sujit@rcl.test'); await p.type('#l_pass', PW); await p.click('#l_btn');
    await until(() => p.evaluate(() => !document.getElementById('v_home').hidden));
    const cards = await p.$$eval('#h_sites a.mod', x => x.map(a => a.textContent));
    ok('the Portal shows his modules: Mechanical and Store on S1, Mechanical on T2', cards.length === 3, cards);
    await p.screenshot({ path: SHOTS + 'p91_portal_dashboard.png' });
    await p.click('#h_sites a.mod');
    const inS1 = await until(async () => p.url().startsWith(M) && await inApp(p), 40000);
    ok('a card opens Mechanical, signed in – no password typed in Mechanical', !!inS1, p.url());
    ok('   the ticket is taken out of the address at once', !/sso=/.test(p.url()), p.url());
    let st = await app(p).evaluate(() => ({ chg: !document.getElementById('site_box').hidden, name: document.getElementById('site_chg_name').textContent, site: localStorage.getItem('rcl_site'), topbar: [...document.querySelectorAll('.topbar .site-pill, .topbar .mod-chips')].length }));
    ok('   on S1; the dark menu starts with "Change site" and the site\'s name (nothing of it in the top bar)', st.chg && /S1|VTR|Nashik/i.test(st.name) && st.site === 'S1' && st.topbar === 0, st);
    // (asked 13-10-2026) his other modules of this site – in the dark menu, under Machinery
    const chips = await app(p).evaluate(() => { const b = document.getElementById('grp_mods'); return { shown: !b.hidden, list: [...b.querySelectorAll('button[data-go]')].map(x => x.textContent.replace('↗', '').trim()), afterMach: b.previousElementSibling && b.previousElementSibling.id }; });
    ok('   the dark menu shows his other module of this site (Store) under Machinery', chips.shown && chips.list.join(',') === 'Store' && chips.afterMach === 'grp_mach', chips);
    await wait(1500); await p.screenshot({ path: SHOTS + 'p96_menu_change_site.png' });
    await closeDlg(p);
    const [toStore] = await Promise.all([p.waitForResponse(r => r.url().startsWith(P + '/api/go?module=store') && r.status() === 302, { timeout: 30000 }), app(p).click('#grp_mods button[data-go]')]);
    ok('   a click on "Store" opens Store on S1 with a ticket (no sign-in)', /site=S1/.test(toStore.url()) && (toStore.headers().location || '').startsWith('http://127.0.0.1:3001/#sso='), toStore.url());
    await p.evaluate(u => { location.href = u; }, P + '/api/go?module=mechanical&site=S1');
    await until(async () => p.url().startsWith(M) && await inApp(p), 40000);
    // ---- Change site → Mechanical on T2 ----
    await closeDlg(p); await app(p).click('#site_chg'); await wait(600);
    const dlg = await app(p).evaluate(() => [...document.querySelectorAll('#cf_msg .sp-btn')].map(x => x.textContent + (x.disabled ? '*' : '')));
    ok('"Change site" lists his sites (this one marked) and "All my modules"', dlg.some(t => /T2/.test(t)) && dlg.some(t => /open now\*$/.test(t)) && dlg.some(t => /All my modules/.test(t)), dlg);
    await p.screenshot({ path: SHOTS + 'p91_modules_dialog.png' });
    await app(p).evaluate(() => [...document.querySelectorAll('#cf_msg .sp-btn')].find(x => /T2/.test(x.textContent)).click());
    const inT2 = await until(async () => p.url().startsWith(M) && await inApp(p) && (await app(p).evaluate(() => localStorage.getItem('rcl_site'))) === 'T2', 40000);
    ok('   a click opens Mechanical on T2 – through the Portal, without signing in', !!inT2, await p.url());
    // (asked 13-10-2026) on T2 he is a User: the top bar is clean – no Backup, no "Supabase", no database or month-close pill
    await wait(2500);
    const clean = await app(p).evaluate(() => ['bk_btn', 'ds_pill', 'db_pill', 'err_pill', 'lock_pill'].filter(id => { const e = document.getElementById(id); return e && !e.hidden && e.getBoundingClientRect().width > 0; }));
    ok('   a User\'s top bar: no Backup / Supabase / database pills', clean.length === 0, clean);
    await p.screenshot({ path: SHOTS + 'p96_user_clean_topbar.png' });
    // ---- a sign-in that ended comes back by itself ----
    const tokBefore = await app(p).evaluate(() => localStorage.getItem('rcl_token'));
    await app(p).evaluate(() => { localStorage.setItem('rcl_token', 'ended-session-0000'); });
    await p.evaluate(() => location.reload());
    const back = await until(async () => p.url().startsWith(M) && await inApp(p) && (await app(p).evaluate(() => localStorage.getItem('rcl_token'))) !== 'ended-session-0000', 40000);
    const tokAfter = await app(p).evaluate(() => localStorage.getItem('rcl_token')).catch(() => '');
    ok('a sign-in that ended: back in at once through the Portal (nothing typed), a new session, still on T2', !!back && tokAfter !== tokBefore && (await app(p).evaluate(() => localStorage.getItem('rcl_site'))) === 'T2', { back: !!back });
    // ---- the password button → the Portal ----
    await closeDlg(p); await app(p).click('#u_pw');
    const pwv = await until(() => p.url().startsWith(P) && p.evaluate(() => !document.getElementById('v_pw').hidden && /Change password/.test(document.getElementById('p_title').textContent)));
    ok('the password button opens the Portal\'s "Change password" (one password for every module)', !!pwv, p.url());
    await p.click('#p_cancel');
    const home = await until(() => p.evaluate(() => !document.getElementById('v_home').hidden));
    ok('   Cancel: his dashboard (not sent straight into a module)', !!home);
    await p.click('#h_sites a.mod');
    await until(async () => p.url().startsWith(M) && await inApp(p), 40000);
    // ---- Logout → the Portal too ----
    await closeDlg(p); await app(p).click('#u_logout'); await wait(500);
    const msg = await app(p).evaluate(() => document.getElementById('cf_msg').textContent);
    ok('Logout asks first and says it signs out of the Portal and every module', /Portal and every module/.test(msg), msg);
    await app(p).click('#cf_ok');
    const outP = await until(() => p.url().startsWith(P) && p.evaluate(() => !document.getElementById('v_login').hidden));
    const me = outP ? await p.evaluate(async () => (await (await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: '{"action":"me"}' })).json()).signedIn) : null;
    ok('   he ends on the Portal\'s sign-in, signed out there too', !!outP && me === false, { url: p.url(), signedIn: me });
    ok('   the address no longer says "signout" (a reload does not sign out again)', !/signout/.test(p.url()), p.url());
    // ---- the reserve ----
    await p.evaluate(u => { location.href = u; }, M + '/?local=1');
    const res = await until(async () => { const f = app(p); return f && f.evaluate(() => !document.getElementById('login_screen').hidden && !document.getElementById('login_form').hidden && document.getElementById('lg_portal').hidden); });
    ok('?local=1: the app\'s own sign-in (the reserve) – not sent to the Portal', !!res && p.url().startsWith(M), p.url());
    await wait(2500);      // (the app has started: its sign-in screen is ready)
    await app(p).type('#lg_email', 'sujit@rcl.test'); await app(p).type('#lg_pass', PW); await app(p).click('#lg_btn');
    const resIn = await until(() => inApp(p), 30000);
    ok('   and it signs in with the Mechanical password', !!resIn, await app(p).evaluate(() => [document.getElementById('lg_err').textContent, document.getElementById('lg_email').value, document.getElementById('login_screen').hidden, document.getElementById('lg_pass').value.length, document.getElementById('lg_btn').textContent, document.getElementById('lg_btn').disabled, document.getElementById('cf_back').hidden, document.getElementById('lg_note').textContent]).catch(e => String(e)));
    await ctx.close();

    // ---- a server not linked to the Portal: as before ----
    const c2 = await b.createBrowserContext(), q = await c2.newPage();
    q.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await q.goto(PLAIN + '/', { waitUntil: 'load' }); await wait(3000);
    const plain = await app(q).evaluate(() => !document.getElementById('login_screen').hidden && !document.getElementById('login_form').hidden && document.getElementById('lg_portal').hidden);
    ok('a server without PORTAL_URL: its own sign-in screen, exactly as before', plain && q.url().startsWith(PLAIN), q.url());
    await c2.close();

    // ---- a phone ----
    const c3 = await b.createBrowserContext(), r = await c3.newPage();
    r.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await r.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await r.goto(M + '/', { waitUntil: 'load' });
    await until(() => r.url().startsWith(P) && r.evaluate(() => !document.getElementById('v_login').hidden));
    await settled(r); await r.type('#l_email', 'sujit@rcl.test'); await r.type('#l_pass', PW); await r.click('#l_btn');
    await until(() => r.evaluate(() => !document.getElementById('v_home').hidden));
    await r.click('#h_sites a.mod');
    const phoneIn = await until(async () => r.url().startsWith(M) && await inApp(r), 40000);
    if (phoneIn) await closeDlg(r);
    if (phoneIn) { await app(r).click('#nav_menu'); await wait(800); }
    const vis = phoneIn ? await app(r).evaluate(() => { const b = document.getElementById('site_chg').getBoundingClientRect(); return { w: b.width, h: b.height, shown: !document.getElementById('site_box').hidden && b.width > 0 && b.left >= -1 && b.right <= window.innerWidth + 1 }; }) : {};
    ok('phone: Portal → Mechanical, signed in; the menu opens with "Change site" on the screen', !!phoneIn && vis.shown, vis);
    await wait(1500); await r.screenshot({ path: SHOTS + 'p91_phone.png' });
    await c3.close();
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  // (this test browser has no password store: the app's "saved sign-in" look on the sign-in screen fails there – cred.js plays the store)
  const real = errs.filter(e => !/does not support public key credentials/.test(e));
  ok('no script error on any page', real.length === 0, real);
  sql('rcl_portal', "delete from public.access where email = 'sujit@rcl.test' and granted_by = 'test'; delete from public.modules where key = 'store';");
  if (!hadT2) sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2';");
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
