// the page as an app: manifest, icons, service worker (opens without a network), the install offer, and the update the person sees
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
const APP = '/home/claude/vercel/app/App.html', MARK = '\n<!-- test: a later version -->';
const restore = () => { const t = fs.readFileSync(APP, 'utf8'); if (t.endsWith(MARK)) { fs.writeFileSync(APP, t.slice(0, -MARK.length)); execSync('cd /home/claude/vercel && node build.js && timeout 60 /tmp/up3.sh >/dev/null 2>&1'); } };
(async () => {
  restore();
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 412, height: 860, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(2500);
  // 1. what a phone needs to install it
  const head = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'), m = l ? await (await fetch(l.href)).json() : null; const icon = async src => { const r = await fetch(src); const bl = await r.blob(); const bmp = await createImageBitmap(bl); return bmp.width + 'x' + bmp.height; };
    return { manifest: !!m, name: m && m.short_name, display: m && m.display, start: m && m.start_url, theme: (document.querySelector('meta[name="theme-color"]') || {}).content, icons: m ? await Promise.all(m.icons.map(async i => i.sizes + '=' + await icon(i.src) + ' ' + i.purpose)) : [], apple: !!document.querySelector('link[rel="apple-touch-icon"]'), viewport: (document.querySelector('meta[name="viewport"]') || {}).content }; });
  ok('the page says it is an app: a manifest (name, standalone, start page, colour) and real icons of the stated sizes, also the one an iPhone uses', head.manifest && head.name === 'Fleet ERP' && head.display === 'standalone' && head.start === '/' && head.theme === '#0F1F3D' && head.icons.join() === '192x192=192x192 any,512x512=512x512 any,512x512=512x512 maskable' && head.apple && /viewport-fit=cover/.test(head.viewport), head);
  // 2. the service worker
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { active: !!r.active, scope: r.scope, state: r.active && r.active.state }; });
  await p.reload({ waitUntil: 'load' }); await wait(2500);
  const ctl = await p.evaluate(() => !!navigator.serviceWorker.controller);
  ok('its service worker is installed and in charge of the page', sw.active && /127\.0\.0\.1:3000\/$/.test(sw.scope) && ctl, { sw: sw, controls: ctl });
  await p.setOfflineMode(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await wait(2500);
  const off = await p.evaluate(() => ({ frame: !!document.getElementById('app'), title: document.title }));
  const fo = p.frames().find(x => x !== p.mainFrame());
  const offApp = fo ? await fo.evaluate(() => !!document.getElementById('lg_email')).catch(() => false) : false;
  ok('with the network off the app still opens (the page it kept), instead of the browser\'s "no internet" page', off.frame && /Fleet ERP/.test(off.title) && offApp, { shell: off, signInFormThere: offApp });
  await p.setOfflineMode(false); await p.reload({ waitUntil: 'load' }); await wait(3000);
  let f = p.frames().find(x => x !== p.mainFrame());
  // 3. the install offer
  const before = await f.evaluate(() => ({ login: !document.getElementById('lg_install').hidden }));
  await p.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); window.__prompted = 0; e.prompt = () => { window.__prompted++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }); await wait(400);
  const offer = await f.evaluate(() => ({ shown: !document.getElementById('lg_install').hidden, text: document.getElementById('lg_install').textContent }));
  await f.evaluate(() => document.getElementById('lg_install').click()); await wait(600);
  const after = { prompted: await p.evaluate(() => window.__prompted), gone: await f.evaluate(() => document.getElementById('lg_install').hidden) };
  ok('when the browser offers to install, the sign-in screen shows "Install this app"; a press opens the browser\'s install box; then the button goes', !before.login && offer.shown && /install करा/.test(offer.text) && after.prompted === 1 && after.gone, { before: before, offer: offer, after: after });
  // 4. an update the person sees and applies from inside the app
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.evaluate(() => { document.getElementById('lg_remember').checked = true; localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); }); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('settings'); }); await wait(1500);
  const v0 = await p.evaluate(() => window.rclApp.build()), shown0 = await f.evaluate(() => document.getElementById('app_ver').textContent);
  await f.evaluate(() => document.getElementById('app_check').click()); await wait(2500);
  const t0 = await f.evaluate(() => document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent);
  ok('Settings → "This app" shows the version; "Check for an update" says it is the latest', shown0 === 'Version ' + v0.slice(0, 8) && /सर्वात नवीन version आहे/.test(t0), { shown: shown0, toast: t0 });
  // a new deploy
  fs.writeFileSync(APP, fs.readFileSync(APP, 'utf8') + MARK); execSync('cd /home/claude/vercel && node build.js && timeout 60 /tmp/up3.sh >/dev/null 2>&1'); await wait(2500);
  const r = await p.evaluate(() => new Promise(res => window.rclApp.check(x => res(x)))); await wait(400);
  const bar = await p.evaluate(() => ({ shown: !document.getElementById('upd').hidden, text: document.getElementById('upd_t').textContent, go: document.getElementById('upd_go').textContent, later: document.getElementById('upd_later').textContent }));
  ok('a new version is deployed: a bar says so over the app, with "Update करा" and "नंतर" – nothing is swapped behind the person\'s back', r.newer && r.live !== v0 && bar.shown && /नवीन version तयार आहे/.test(bar.text) && bar.go === 'Update करा' && bar.later === 'नंतर' && await p.evaluate(v => window.rclApp.build() === v, v0), { check: r, bar: bar });
  await p.screenshot({ path: 'shots/pwa_update.png' });
  await p.evaluate(() => document.getElementById('upd_later').click()); await wait(300);
  ok('"नंतर" puts the bar away', await p.evaluate(() => document.getElementById('upd').hidden));
  await p.evaluate(() => new Promise(res => window.rclApp.update(() => res()))); await wait(5000);
  f = p.frames().find(x => x !== p.mainFrame());
  const upd = await p.evaluate(() => ({ build: window.rclApp.build(), bar: !document.getElementById('upd').hidden }));
  const st = await f.evaluate(() => ({ signedIn: !!(typeof S !== 'undefined' && S.token) && document.getElementById('login_screen').hidden, hasMark: document.documentElement.outerHTML.length > 1000 })).catch(e => ({ error: String(e.message).slice(0, 80) }));
  ok('"Update" loads the new version into the app at once – the person stays signed in, the bar is gone', upd.build === r.live && !upd.bar && st.signedIn, { now: upd.build, was: v0, state: st });
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/pwa.out', out.join('\n')); await b.close(); restore();
})().catch(e => { fs.writeFileSync('/tmp/pwa.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); try { restore(); } catch (e2) {} process.exit(1); });
