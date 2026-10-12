// update-88 (asked 12-10-2026): the list under a form is a closed bar – pressed, it opens right under it; pressed again, it closes.
// Phone and computer. Not remembered: the app opened again starts closed; opened, it stays open while the app is open. Nothing in
// the lists changes. A search result of such a list opens it. On the local rig.   node fold88.js [port]   (with geo-shim.js)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const PAGES = { diesel: 'Diesel issued', inward: 'Inward entries', transfer: 'Transfers', log: 'Log Book', tankcheck: 'Tank checks', pay: 'Payments & opening balances', brk: 'Saved days', comp: 'Renewal history' };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const open = async (ctx, phone) => {
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    if (phone) await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); else await p.setViewport({ width: 1536, height: 900 });
    await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1500);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
    if (await f.evaluate(() => !$('login_screen').hidden)) { await f.evaluate(() => { $('lg_email').value = 'sujit@rcl.test'; $('lg_pass').value = 'Nashik#Road848!'; $('lg_btn').click(); }); }
    await wait(6500); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    return { p, f, errs };
  };
  const look = (f, tab) => f.evaluate(tab => {
    const sec = $('sec-' + tab), panel = sec && sec.querySelector('.panel.fold[data-fold="' + tab + '"]'); if (!panel) return null;
    const head = panel.querySelector('.fold-head'), kids = [...panel.children].filter(x => !x.classList.contains('fold-head'));
    return { open: panel.classList.contains('open'), aria: head.getAttribute('aria-expanded'), pill: head.querySelector('.fold-tx').textContent, headShown: head.offsetHeight > 0,
      bodyShown: kids.some(x => x.offsetHeight > 0), title: head.querySelector('h2') ? head.querySelector('h2').firstChild.textContent.trim() : head.firstChild.textContent.trim() };
  }, tab);
  for (const phone of [true, false]) {
    const who = phone ? 'PHONE' : 'COMPUTER', ctx = await b.createBrowserContext(), S1 = await open(ctx, phone);
    for (const tab of Object.keys(PAGES)) {
      await S1.f.evaluate(t => showTab(t), tab); await wait(900);
      const a = await look(S1.f, tab);
      ok(who + ' ' + tab + ': "' + PAGES[tab] + '" is a closed bar with "Show" – the list under it hidden', a && !a.open && a.aria === 'false' && a.pill === 'Show' && a.headShown && !a.bodyShown && a.title === PAGES[tab], a);
      await S1.f.evaluate(t => $('sec-' + t).querySelector('.panel.fold .fold-head').click(), tab); await wait(400);
      const c = await look(S1.f, tab);
      ok('   pressed: the list opens right under it, "Hide"', c && c.open && c.aria === 'true' && c.pill === 'Hide' && c.bodyShown, c);
      if (tab === 'diesel' && phone) { await S1.f.evaluate(() => $('sec-diesel').querySelector('.panel.fold').scrollIntoView({ block: 'start' })); await wait(300); await S1.p.screenshot({ path: '/home/claude/test/shots/fold88_open.png' }); }
      if (tab === 'inward') { await S1.f.evaluate(t => $('sec-' + t).querySelector('.panel.fold .fold-head').click(), tab); await wait(300);
        const d = await look(S1.f, tab); ok('   pressed again: closed', d && !d.open && !d.bodyShown, d); }
    }
    // open stays open while the app is open; the inward list closed again stays closed
    await S1.f.evaluate(() => showTab('dash')); await wait(600); await S1.f.evaluate(() => showTab('diesel')); await wait(600);
    ok(who + ': back to Diesel Issue – the list opened before is still open (the app was not closed)', (await look(S1.f, 'diesel')).open);
    // the list itself is unchanged: its rows are there
    ok('   the list is as before (its rows are there)', await S1.f.evaluate(() => $('d_rows').querySelectorAll('tr').length > 0));
    // the app opened again: every list closed
    await S1.p.reload({ waitUntil: 'load' }); await wait(7000);
    const S2 = { p: S1.p, f: S1.p.frames().find(x => x !== S1.p.mainFrame()) };
    await S2.f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); }); await wait(900);
    const r = await look(S2.f, 'diesel');
    ok(who + ': the app opened again – the list is closed again (not remembered)', r && !r.open && !r.bodyShown, r);
    if (phone) { await S2.f.evaluate(() => $('sec-diesel').querySelector('.panel.fold').scrollIntoView({ block: 'end' })); await wait(300); await S2.p.screenshot({ path: '/home/claude/test/shots/fold88_closed.png' }); }
    // a search result of the list opens it
    await S2.f.evaluate(() => { const id = (S.dieselRows || [])[0] ? S.dieselRows[0].id : 'DI-'; gsOpenIssues({ q: id }); }); await wait(1500);
    ok('   a search result of the list (Ctrl + K → a diesel issue) opens the list', (await look(S2.f, 'diesel')).open);
    ok('   no script error', !S1.errs.length, S1.errs);
    await ctx.close();
  }
  await b.close();
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
