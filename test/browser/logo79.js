// update-79 (asked 11-10-2026): One Click Solution's own logo – the browser-tab icon, the app icons, the opening and the logo on the
// sign-in screen (the sign-in screen itself as it was). After the sign-in nothing changes.   node logo79.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 60000 });
  const errs = [];
  for (const [name, w, h, mob] of [['wide', 1366, 768, false], ['phone', 390, 844, true]]) {
    const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    if (name === 'wide') {
      const tab = await p.evaluate(async () => { const l = document.querySelector('link[rel="icon"]'), a = document.querySelector('link[rel="apple-touch-icon"]'); const sz = async u => { const bm = await createImageBitmap(await (await fetch(u)).blob()); return bm.width + 'x' + bm.height; }; return { icon: l && l.getAttribute('href'), iconSize: l ? await sz(l.href) : '', apple: a && a.getAttribute('href'), appleSize: a ? await sz(a.href) : '' }; });
      ok('the browser tab and an iPhone show the new logo (its own files of the app, not a link elsewhere)', tab.icon === '/icons/oc2-favicon-64.png' && tab.iconSize === '64x64' && tab.apple === '/icons/oc2-apple-180.png' && tab.appleSize === '180x180', tab);
      ok('(update-123) no opening film – the sign-in at once', await f.evaluate(() => !document.getElementById('oc_intro')));
    }
    await wait(5000);
    const lg = await f.evaluate(() => { const im = document.querySelector('#login_screen .lp-img'), lo = document.querySelector('#login_form .oc-logo'), card = getComputedStyle(document.getElementById('login_form'));
      return { pic: im && im.getAttribute('src'), picW: im && im.naturalWidth, picShown: !!(im && im.offsetParent), logoShown: !!(lo && lo.offsetParent), logoW: lo && lo.naturalWidth, card: card.backgroundColor, btn: getComputedStyle(document.getElementById('lg_btn')).backgroundImage.slice(0, 60), rachana: /Rachana/i.test(document.getElementById('login_screen').textContent) || [...document.querySelectorAll('#login_screen img')].some(i => /Rachana|RCL/i.test(i.alt + i.getAttribute('src'))), fields: !!document.getElementById('lg_email') && !!document.getElementById('lg_pass') && !!document.getElementById('lg_remember') && !!document.getElementById('lg_forgot') && !!document.getElementById('lg_signup') }; });
    // (his answer: the sign-in screen stays as it was – the picture on the left, the white form; only the logo is his)
    if (name === 'wide') lg.pic = await p.evaluate(async () => { const t = await (await fetch('/')).text(); const m = /class=\\?"lp-img\\?" src=\\?"([^"\\]+)/.exec(t); return m ? m[1] : ''; });      // (the rig cannot reach that picture: the page takes it away – read what the page asks for)
    if (name === 'wide') ok('sign-in, wide screen: the same picture on the left as before, the white form; his logo on top of the form; no Rachana name or logo (update-81)', /cdn\.21st\.dev\/assets\/mirror\/0d\/0d205a1a/.test(lg.pic) && lg.logoShown && lg.logoW === 640 && /rgba\(0, 0, 0, 0\)/.test(lg.card) && !lg.rachana && lg.fields, lg);
    else ok('sign-in, phone: the form with his logo on top; no Rachana name or logo (update-81)', !lg.picShown && lg.logoShown && lg.logoW === 640 && !lg.rachana && lg.fields, lg);
    await p.screenshot({ path: '/home/claude/test/shots/logo79_' + name + '.png' });
    if (name === 'wide') {      // after the sign-in: nothing of this shows; the app is as before
      await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
      const inside = await f.evaluate(() => ({ login: !document.getElementById('login_screen').hidden || !document.body.classList.contains('locked') ? (document.getElementById('login_screen').hidden ? 'hidden' : 'shown') : 'locked', side: !!document.querySelector('#side .rlogo img'), oc: [...document.querySelectorAll('.app img')].filter(i => /oc-/.test(i.getAttribute('src') || '') && i.offsetParent).length }));
      ok('after the sign-in: the sign-in screen is gone, the customer\'s logo in the side bar as before, no One Click Solution logo inside', inside.login === 'hidden' && inside.side && inside.oc === 0, inside);
    }
    await p.close();
  }
  ok('no script error', !errs.length, errs);
  await b.close();
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
