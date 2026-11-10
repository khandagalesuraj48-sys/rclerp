// update-221 (his brief of 10-11-2026: the animation & micro-interaction upgrade; and "jya modual war click krel to colour tith jail …
// rachana name proper … zoom in out … machinery madhun store war click kel ki sign in nahi pahije") – in a real browser on the local rig
// only (GATEWAY=1 bash rig/all.sh: one address :3030). Nothing is saved: the boxes and buttons are tried with the page's own functions
// on made-up questions, the modules only open their pages. The Portal's module addresses are pointed at :3030 for this test and put
// back at the end (test data of the rig's Portal only).
//   A. (:3001, its own sign-in) the Delete box pops (Scale Pop), a refused box wobbles; closing: the box is closed and answered AT ONCE,
//      a picture of it fades and is gone; the busy ring only while the work waits, a refusal shakes, "sent for approval" does not;
//      "Less motion": no picture; a page and the Dashboard's Log Book tab zoom in;
//   B. (:3030, through the Portal) his modules are ready in the background (no "Signing in…" when opened), the clicked module is the
//      yellow one, the names proper, the full logo on the pages, a module's page shown at once and zooming in.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)), M = 'http://127.0.0.1:3001', G = 'http://127.0.0.1:3030', SHOT = process.env.SHOTS || '/tmp';
const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl_portal -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
(async () => {
  let b = null; const errs = [], urls0 = sql("select string_agg(key || '=' || coalesce(url, ''), ';' order by key) from modules");
  try {
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 90000, args: [...chromium.args, '--no-sandbox'] });
    const page = async base => { const ctx = await b.createBrowserContext(); await ctx.overridePermissions(base, ['geolocation']);
      const p = await ctx.newPage(); await p.setGeolocation({ latitude: 18.52, longitude: 73.85 }); await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
      p.on('pageerror', e => errs.push(String(e.message).slice(0, 160))); p.on('dialog', d => d.dismiss().catch(() => {}));
      await p.evaluateOnNewDocument(() => { try { localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('rcl_dash_tab', 'diesel'); localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
      return p; };
    const app = p => p.frames().find(x => x !== p.mainFrame() && /srcdoc/.test(x.url())) || p.frames().find(x => x !== p.mainFrame());
    const calm = f => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.querySelectorAll('#toast').forEach(t => { t.hidden = true; });
      [...document.querySelectorAll('body *')].filter(e => e.querySelector('.fixhelp') && getComputedStyle(e).position === 'fixed').forEach(e => { e.style.display = 'none'; }); });

    // ---------- A. boxes, buttons, zoom (its own sign-in) ----------
    { const p = await page(M); await p.goto(M + '/', { waitUntil: 'domcontentloaded' }); await wait(2000);
      let f = app(p); await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn');
      await f.waitForFunction(() => typeof S !== 'undefined' && S.user && document.getElementById('k_total').textContent.trim() !== '–', { timeout: 30000 }); await wait(2500); await calm(f); await wait(500);
      const r = await f.evaluate(async () => {
        const o = {}, w = ms => new Promise(x => setTimeout(x, ms));
        const pr = askConfirm({ title: 'Delete this entry?', message: 'Test only – nothing is deleted.', ok: 'Delete', danger: true }); await w(40);
        o.pop = getComputedStyle(document.getElementById('cf_box')).animationName;
        let ans = 'none'; pr.then(v => { ans = String(v); });
        closeConfirm(false); await Promise.resolve(); await Promise.resolve();
        o.closedAtOnce = document.getElementById('cf_back').hidden; o.answeredAtOnce = ans; o.picture = document.querySelectorAll('.mo-ghost').length;
        o.pictureInert = !!(document.querySelector('.mo-ghost') || {}).inert; o.boxIsTheRealOne = !document.getElementById('cf_ok').closest('.mo-ghost');
        await w(450); o.pictureGone = document.querySelectorAll('.mo-ghost').length === 0;
        askConfirm({ title: 'Nothing saved', message: 'Test only.', ok: 'OK', danger: true, alertOnly: true }); await w(40); o.wobble = getComputedStyle(document.getElementById('cf_box')).animationName; closeConfirm(false);
        askConfirm({ title: 'A', message: 'first' }); await w(20); closeConfirm(true); askConfirm({ title: 'B', message: 'second' }); await w(20);
        o.reopenedNoPicture = document.querySelectorAll('.mo-ghost').length === 0 && document.getElementById('cf_title').textContent === 'B'; closeConfirm(false); await w(450);
        const btn = document.createElement('button'); btn.className = 'btn primary'; btn.textContent = 'Save'; document.getElementById('sec-dash').appendChild(btn);
        let mid = ''; await busy(btn, 'Saving…', () => new Promise(x => setTimeout(() => { mid = btn.className; x(); }, 80)));
        o.ringWhileWaiting = /mo-busy/.test(mid); o.ringAfter = /mo-busy/.test(btn.className); o.wordsBack = btn.textContent;
        await busy(btn, 'Saving…', () => Promise.reject(new Error('Test refusal – nothing saved.'))); o.shake = /mo-shake/.test(btn.className); await w(450);
        await busy(btn, 'Saving…', () => Promise.reject(new Error(CR_SENT))); o.sentNoShake = !/mo-shake/.test(btn.className); btn.remove();
        document.documentElement.dataset.motion = 'less'; askConfirm({ title: 'q', message: 'x' }); await w(20); closeConfirm(false); await Promise.resolve(); o.lessNoPicture = document.querySelectorAll('.mo-ghost').length === 0; document.documentElement.dataset.motion = '';
        document.getElementById('dtab-log').click(); await w(30); o.tabZoom = getComputedStyle(document.getElementById('dash_log')).animationName; document.getElementById('dtab-diesel').click();
        document.getElementById('tab-master').click(); await w(40); const pn = document.querySelector('#sec-master > .panel, #sec-master > div > .panel'); o.pageZoom = !pn ? 'no panel' : pn.classList.contains('rv') ? 'rv:' + getComputedStyle(pn).transitionProperty + ':' + (pn.classList.contains('in') ? 'in' : 'waiting') : getComputedStyle(pn).animationName;
        document.getElementById('tab-dash').click(); await w(300);
        return o; });
      ok('A1. the Delete box pops in (Scale Pop from 72 %), a refused box wobbles', r.pop === 'moPop' && r.wobble === 'moWobble', r);
      ok('A2. closing: the box is closed and answered AT ONCE (nothing waits); a picture of it (not usable) fades and is gone; opened again at once – no picture over it',
        r.closedAtOnce && r.answeredAtOnce === 'false' && r.picture === 1 && r.pictureInert && r.boxIsTheRealOne && r.pictureGone && r.reopenedNoPicture, r);
      ok('A3. busy: the turning ring only while the work waits, the words back after; a refusal shakes; "sent for approval" does not', r.ringWhileWaiting && !r.ringAfter && r.wordsBack === 'Save' && r.shake && r.sentNoShake, r);
      ok('A4. "Less motion": no closing picture', r.lessNoPicture, r);
      ok('A5. a page and the Dashboard\'s Log Book tab zoom in (a page part that appears as it is scrolled to: from 97 %)', r.tabZoom === 'moZoomIn' && (r.pageZoom === 'moZoomIn' || /^rv:.*transform/.test(r.pageZoom)), r);
      await f.evaluate(() => { askConfirm({ title: 'Delete this entry?', message: 'Test only – nothing is deleted.', ok: 'Delete', danger: true }); }); await wait(330);
      await p.screenshot({ path: SHOT + '/motion221-delete-box.png' }); await f.evaluate(() => closeConfirm(false));
      await p.browserContext().close(); }

    // ---------- B. his modules ready in the background, the rail (through the Portal, one address) ----------
    sql("update modules set url = 'http://127.0.0.1:3030/' || key where key in ('engineering', 'purchase', 'store')");
    { const p = await page(G); await p.goto(G + '/portal/', { waitUntil: 'domcontentloaded' }); await wait(1200);
      const t = await p.evaluate(async () => { await fetch('/portal/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sujit@rcl.test', password: 'Nashik#Road848!' }) });
        const r = await fetch('/portal/api/go?module=mechanical&site=S1&json=1', { headers: { 'X-RCL': '1' } }); try { return (await r.json()).ticket || ''; } catch (e) { return ''; } });
      await p.goto(G + '/#sso=' + t, { waitUntil: 'domcontentloaded' }); const t0 = Date.now();
      let f = null; for (let i = 0; i < 120; i++) { f = app(p); try { if (f && await f.evaluate(() => typeof S !== 'undefined' && !!S.user && typeof NAV === 'object')) break; } catch (e) {} await wait(250); }
      const mods = await f.evaluate(() => PT.mods.filter(m => m.key !== 'mechanical' && inHere(m)).map(m => m.key));
      let st = {}; for (let i = 0; i < 60; i++) { st = await f.evaluate(() => { const o = {}; document.querySelectorAll('#ext_frames iframe').forEach(fr => { let s = 'loading'; try { s = fr.contentWindow.rclModule ? 'ready' : 'loading'; } catch (e) { s = 'x'; } o[fr.id.slice(4)] = s + (fr.hidden ? '/hidden' : ''); }); return o; });
        if (mods.length && mods.every(k => /^ready/.test(st[k] || ''))) break; await wait(500); }
      ok('B1. his modules of this site (' + mods.join(', ') + ') are ready in the background, out of sight, ' + Math.round((Date.now() - t0) / 1000) + ' s after opening', mods.length >= 2 && mods.every(k => st[k] === 'ready/hidden'), { mods, st });
      await calm(f);
      const k = 'mod:' + mods[0];
      await f.evaluate(k => [...document.querySelectorAll('#mrail .mr-btn')].find(x => x.dataset.k === k).click(), k); await wait(500);
      const rr = await f.evaluate(() => ({ yellow: [...document.querySelectorAll('#mrail .mr-btn')].filter(x => getComputedStyle(x).backgroundColor === 'rgb(242, 183, 5)').map(x => x.dataset.k),
        line: getComputedStyle(document.querySelector('#mrail .mr-btn[data-k="mach"]')).boxShadow, names: [...document.querySelectorAll('#mrail .mr-btn:not([hidden]) .mr-l')].map(x => x.textContent),
        logo: !!document.querySelector('#smenu .sm-brand .rlogo.big') && document.querySelector('#smenu .sm-brand').getBoundingClientRect().height > 40 }));
      ok('B2. the module clicked is the yellow one (Machinery keeps a thin line), the names proper, the full logo on top of the pages', rr.yellow.join() === k && /inset/.test(rr.line) && rr.names.every(n => /^[A-Z]/.test(n)) && rr.logo, rr);
      await p.screenshot({ path: SHOT + '/motion221-module-pages.png' });
      const t1 = Date.now();
      await f.evaluate(() => { const x = [...document.querySelectorAll('#grp_mods .modgrp.sm-on .navbtn')].find(y => y.offsetParent !== null); x.click(); });
      let shown = {}; for (let i = 0; i < 50; i++) { shown = await f.evaluate(k => { const fr = document.getElementById('ext_' + k.slice(4)); let txt = ''; try { txt = fr.contentWindow.document.body.innerText; } catch (e) {} return { vis: !!fr && !fr.hidden, ready: !!(fr && fr.contentWindow.rclModule), signing: /Signing in/.test(txt), zoom: !!fr && fr.classList.contains('mo-zoom') }; }, k); if (shown.vis && shown.ready) break; await wait(100); }
      ok('B3. its page shows at once (' + (Date.now() - t1) + ' ms), signed in already – no "Signing in…", zooming in', shown.vis && shown.ready && !shown.signing && shown.zoom && Date.now() - t1 < 2500, shown);
      await wait(700); await p.screenshot({ path: SHOT + '/motion221-module-page.png' });
      await p.browserContext().close(); }
    ok('no error on the page', !errs.length, errs);
  } catch (e) { ok('the test ran to its end', false, String(e && e.stack || e).slice(0, 600)); }
  finally {
    try { urls0.split(';').forEach(x => { const [k, u] = x.split('='); sql("update modules set url = " + (u ? "'" + u.replace(/'/g, "''") + "'" : 'null') + " where key = '" + k.replace(/'/g, "''") + "'"); }); } catch (e) { out.push('could not put the module addresses back: ' + e.message); }
    try { if (b) await b.close(); } catch (e) {}
  }
  console.log(out.join('\n')); console.log('TOTAL pass=' + pass + ' fail=' + fail); process.exit(fail ? 1 : 0);
})();
