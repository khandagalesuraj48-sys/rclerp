// update-219 (his "Option A", 10-11-2026: "mechanical war click kel ki lagech sagle open hoil submenu eka khali ek … submenu madhe kashya war
// click kel ki submenu close hoyla hawa … screen adjust auto … open and close cha effect") – the new menu in a real browser, on the local rig
// only (PORTAL=1 bash rig/all.sh). Nothing is saved: it signs in through the Portal (:3010 → Mechanical :3000, site S1) and only opens pages.
//   1. the rail: Machinery, his modules of S1 from the Portal, Admin, My account; closed = the page has the whole width;
//   2. Machinery → its pages at once, every page one below another (no section to open), the search box, the page beside them narrower;
//   3. the search: "diesel" keeps only those pages, Enter opens the first, the pages close;
//   4. a page picked → closed, that page open, Machinery marked on the rail; the module's button again / Esc / a click outside → closed;
//   5. another module (Engineering): its pages; one picked → its page in the middle, closed;
//   6. Ctrl + K still opens the app's search;
//   7. a phone (390 px): the modules a bar at the bottom (the page keeps the whole width), the pages a sheet sliding up over the page with a
//      shade; a page picked or a tap on the shade closes;
//   no error on the page. Pictures: SHOTS (default /tmp) nav219-*.png
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms)), P = 'http://127.0.0.1:3010', M = 'http://127.0.0.1:3000', SHOT = process.env.SHOTS || '/tmp';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
(async () => {
  let b = null; const errs = [];
  try {
    const r = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sujit@rcl.test', password: 'Nashik#Road848!' }) });
    const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    const ticket = async () => { const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000, args: [...chromium.args, '--no-sandbox'] });
    const open = async (w, h, mobile) => {
      const ctx = await b.createBrowserContext(); await ctx.overridePermissions(M, ['geolocation']);
      const p = await ctx.newPage(); await p.setGeolocation({ latitude: 18.52, longitude: 73.85 });
      await p.setViewport({ width: w, height: h, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: 2 });
      p.on('pageerror', e => errs.push(String(e.message).slice(0, 200))); p.on('dialog', d => d.dismiss().catch(() => {}));
      await p.evaluateOnNewDocument(() => { try { localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
      await p.goto(M + '/#sso=' + await ticket(), { waitUntil: 'domcontentloaded' }); await wait(1500);
      let f = null;
      for (let i = 0; i < 80; i++) { f = p.frames().find(x => x !== p.mainFrame()); try { if (f && await f.evaluate(() => typeof S !== 'undefined' && !!S.user && typeof NAV === 'object')) break; } catch (e) {} await wait(500); }
      await wait(2500);
      return { p, f };
    };
    // (the rig's own notices – its test database lacks some SQL steps, the papers of its test machinery – are put away before a picture)
    const calm = f => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} const a = document.getElementById('ai_panel'); if (a) a.hidden = true;
      document.querySelectorAll('#toast').forEach(t => { t.hidden = true; });
      [...document.querySelectorAll('body *')].filter(e => e.querySelector('.fixhelp') && getComputedStyle(e).position === 'fixed').forEach(e => { e.style.display = 'none'; }); });
    const rail = (f, k) => f.evaluate(k => { const x = [...document.querySelectorAll('#mrail .mr-btn')].find(y => y.dataset.k === k); if (x) x.click(); return !!x; }, k);
    const st = f => f.evaluate(() => ({ open: NAV.open, key: NAV.key, cls: document.querySelector('.app').classList.contains('nav-open'), page: S.curTab,
      main: Math.round(document.querySelector('.mainwrap').getBoundingClientRect().width), sm: Math.round(document.getElementById('smenu').getBoundingClientRect().width),
      shown: [...document.querySelectorAll('#smenu .navbtn')].filter(x => x.offsetParent !== null).map(x => x.id || x.dataset.page || x.textContent.trim()),
      find: Math.round(document.querySelector('.sm-find').getBoundingClientRect().height), on: [...document.querySelectorAll('#mrail .mr-btn.on')].map(x => x.dataset.k) }));
    const shot = async (p, n) => { await wait(400); try { await calm(p.frames().find(x => x !== p.mainFrame())); } catch (e) { /* as it is */ } await p.screenshot({ path: SHOT + '/nav219-' + n + '.png' }); };

    // ---------- a computer ----------
    { const { p, f } = await open(1440, 900); await calm(f);
      const mods = await f.evaluate(() => [...document.querySelectorAll('#mrail .mr-btn')].filter(x => !x.hidden).map(x => x.dataset.k));
      const s0 = await st(f);
      ok('1. the rail: Machinery, his modules of S1 (from the Portal), Admin, My account; closed – the page has the whole width',
        mods[0] === 'mach' && mods.some(k => /^mod:/.test(k)) && mods.indexOf('admin') > -1 && mods[mods.length - 1] === 'me' && !s0.open && s0.sm === 0 && s0.main > 1300, { mods, s0 });
      await shot(p, '1-closed');
      await rail(f, 'mach'); await wait(450); const s1 = await st(f);
      const all = await f.evaluate(() => [...document.querySelectorAll('#grp_mach .navbtn')].filter(x => !x.hidden && !x.closest('[hidden]')).length);
      ok('2. Machinery → its pages at once, every page one below another (' + s1.shown.length + '), the search box (38 px), the page beside them narrower (' + s0.main + ' → ' + s1.main + ' px)',
        s1.open && s1.key === 'mach' && s1.sm > 250 && s1.main < s0.main - 200 && s1.shown.length >= all && all > 20 && s1.shown.indexOf('tab-diesel') > -1 && s1.shown.indexOf('tab-master') > -1 && s1.find >= 36, { s1, all });
      await shot(p, '2-machinery-open');
      await f.evaluate(() => { const i = document.getElementById('sm_find'); i.focus(); i.value = 'diesel'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
      const s2 = await st(f);
      ok('3a. the search "diesel": only those pages (' + s2.shown.length + ')', s2.shown.length > 2 && s2.shown.length < s1.shown.length && s2.shown.indexOf('tab-diesel') > -1 && s2.shown.indexOf('tab-master') < 0, s2.shown);
      await shot(p, '3-search');
      await f.evaluate(() => document.getElementById('sm_find').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))); await wait(600);
      const s3 = await st(f);
      ok('3b. Enter opens the first page found, the pages close and the page has its width again', !s3.open && !s3.cls && /diesel|inward|transfer/.test(s3.page) && s3.main > 1300, s3);
      await rail(f, 'mach'); await wait(400); await f.evaluate(() => document.getElementById('tab-log').click()); await wait(600);
      const s4 = await st(f);
      ok('4a. a page picked (Log Book) → closed, that page open, Machinery marked on the rail', !s4.open && s4.page === 'log' && s4.on.join() === 'mach', s4);
      await shot(p, '4-page-picked');
      await rail(f, 'mach'); await wait(300); const o1 = (await st(f)).open; await rail(f, 'mach'); await wait(300); const c1 = !(await st(f)).open;
      await rail(f, 'mach'); await wait(300); await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await wait(300); const c2 = !(await st(f)).open;
      await rail(f, 'mach'); await wait(400); await p.mouse.click(900, 600); await wait(400); const c3 = !(await st(f)).open;      // (a real click on the page)
      ok('4b. the module\'s button again, Esc, a click outside → closed', o1 && c1 && c2 && c3, { o1, c1, c2, c3 });
      await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))); await wait(500);
      const gs = await f.evaluate(() => !document.getElementById('gs_back').hidden);
      await f.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))); await wait(300);
      ok('6. Ctrl + K still opens the app\'s search', gs, gs);
      const mk = mods.find(k => /^mod:/.test(k));
      await rail(f, mk); await wait(450); const s5 = await st(f);
      const mpages = await f.evaluate(() => [...document.querySelectorAll('#grp_mods .modgrp.sm-on .navbtn')].filter(x => x.offsetParent !== null).length);
      ok('5a. another module (' + mk + '): only its pages (' + mpages + '), titled with its name', s5.open && s5.key === mk && mpages > 0 && s5.shown.indexOf('tab-diesel') < 0
        && await f.evaluate(() => document.getElementById('sm_title').textContent.trim().length > 2), { s5, mpages });
      await shot(p, '5-module-open');
      // (its page opens in the middle, or – on this rig – at the module's own address: the page goes there; the pages are closed at the click)
      const s6 = await f.evaluate(() => { const x = [...document.querySelectorAll('#grp_mods .modgrp.sm-on .navbtn')].find(y => y.offsetParent !== null); if (!x) return null; x.click(); return { open: NAV.open, cls: document.querySelector('.app').classList.contains('nav-open') }; });
      ok('5b. one of its pages picked → the pages close', s6 && !s6.open && !s6.cls, s6);
      await p.browserContext().close(); }

    // ---------- a phone ----------
    { const { p, f } = await open(390, 844, true); await calm(f);
      const s0 = await st(f), bar = await f.evaluate(() => { const r = document.getElementById('mrail').getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; });
      const broken = await f.evaluate(() => [...document.querySelectorAll('#mrail .mr-btn:not([hidden]) .mr-l')].filter(l => { const w = l.textContent.trim(); return w.indexOf(' ') < 0 && l.getClientRects().length > 1 || l.scrollWidth > l.clientWidth + 1; }).map(l => l.textContent));
      ok('7a. a phone: the modules are a bar at the bottom (' + bar.w + ' × ' + bar.h + ' px), the page keeps the whole width (' + s0.main + ' px), no word broken in two',
        !s0.open && bar.w >= 389 && bar.h >= 56 && bar.h <= 80 && bar.top >= 844 - 80 && s0.main >= 389 && !broken.length, { bar, s0, broken });
      await shot(p, '6-phone-closed');
      const m0 = s0.main; await rail(f, 'mach'); await wait(500); await calm(f); const s1 = await st(f);
      const sheet = await f.evaluate(() => { const r = document.getElementById('smenu').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width) }; });
      const shade = await f.evaluate(() => getComputedStyle(document.getElementById('nav_back')).opacity);
      ok('7b. Machinery → its pages slide UP over the page as a sheet above the bar (the page keeps its width), a shade behind them',
        s1.open && sheet.w >= 389 && sheet.bottom <= bar.top + 1 && sheet.top > 100 && Math.abs(s1.main - m0) < 2 && Number(shade) > 0.9 && s1.shown.indexOf('tab-diesel') > -1, { s1, sheet, bar, m0, shade });
      await shot(p, '7-phone-open');
      await f.evaluate(() => document.getElementById('tab-diesel').click()); await wait(500);
      const s2 = await st(f);
      ok('7c. a page picked → the sheet closes, the page is open', !s2.open && s2.page === 'diesel', s2);
      await rail(f, 'mach'); await wait(400); await p.mouse.click(195, 60); await wait(400);
      ok('7d. a tap on the shade closes', !(await st(f)).open);
      await p.browserContext().close(); }
    ok('no error on the page', !errs.length, errs);
  } catch (e) { ok('the test ran to its end', false, String(e && e.stack || e).slice(0, 600)); }
  finally { try { if (b) await b.close(); } catch (e) {} }
  console.log(out.join('\n')); console.log('TOTAL pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();
