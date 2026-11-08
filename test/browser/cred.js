// "Save password?" and auto-fill: what the app hands to the browser's password store, and what it does with what it gets back.
// (The browser's own bubble cannot be seen in this test; the browser's store is played by the test.)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1366, height: 800 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const real = await (async () => { const q = await b.newPage(); await q.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); const r = await q.evaluate(() => ({ has: typeof window.PasswordCredential === 'function', secure: window.isSecureContext })); await q.close(); return r; })();
  // the browser's password store, played by the test (in the top page – that is where the app must go)
  await p.evaluateOnNewDocument(() => { if (window.top !== window) return;
    window.__store = []; window.__gets = []; window.__prevent = 0; window.__saved = null;
    window.PasswordCredential = function (d) { this.type = 'password'; this.id = d.id; this.password = d.password; this.name = d.name; };
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: {
      store: c => { window.__store.push({ id: c.id, password: c.password }); window.__saved = c; return Promise.resolve(c); },
      get: o => { window.__gets.push(JSON.stringify(o)); return Promise.resolve(window.__saved); },
      preventSilentAccess: () => { window.__prevent++; return Promise.resolve(); } } }); });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1500);
  const f = p.frames().find(x => x !== p.mainFrame());
  const top = () => p.evaluate(() => ({ store: window.__store, gets: window.__gets, prevent: window.__prevent }));
  const form = () => f.evaluate(() => ({ login: !document.getElementById('login_screen').hidden, email: document.getElementById('lg_email').value, passLen: document.getElementById('lg_pass').value.length, note: document.getElementById('lg_cred').hidden ? '' : document.getElementById('lg_cred').textContent, focus: document.activeElement && document.activeElement.id }));
  ok('this browser (Chromium) has the password store the app uses, on this kind of address', real.has && real.secure, real);
  let t = await top(), g = await form();
  ok('sign-in screen, nothing saved yet: the app asks the browser for a saved sign-in, gets none, the boxes stay empty', t.gets.length === 1 && /"password":true/.test(t.gets[0]) && /"mediation":"optional"/.test(t.gets[0]) && g.email === '' && g.passLen === 0 && !g.note, { asked: t.gets, form: g });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  t = await top();
  ok('after a correct sign-in the app hands e-mail and password to the browser to offer "Save password?"', t.store.length === 1 && t.store[0].id === 'sujit@rcl.test' && t.store[0].password === 'Nashik#Road848!' && !(await form()).login, { handed: t.store.map(x => x.id + ' / ' + x.password.length + ' characters') });
  const inApp = await f.evaluate(() => { let found = ''; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (String(localStorage.getItem(k)).indexOf('Nashik#Road848!') > -1) found += k + ' '; } for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (String(sessionStorage.getItem(k)).indexOf('Nashik#Road848!') > -1) found += k + ' '; } } catch (e) {} return found; });
  ok('the app itself keeps the password nowhere (not in its own storage)', inApp === '', inApp);
  // sign out: the browser is told to ask first; the saved sign-in fills the boxes
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('logout_btn') ? document.getElementById('logout_btn').click() : [...document.querySelectorAll('button')].find(x => /^Logout$/.test(x.textContent.trim())).click(); }); await wait(600);
  await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); await wait(2500);
  t = await top(); g = await form();
  ok('sign-out: the browser is told not to hand the password over silently, and the saved sign-in fills the two boxes with a note', t.prevent === 1 && g.login && g.email === 'sujit@rcl.test' && g.passLen === 15 && /saved in this browser/.test(g.note) && g.focus === 'lg_btn', { told: t.prevent, form: g });
  await p.screenshot({ path: 'shots/cred_filled.png' });
  await p.keyboard.press('Enter'); await wait(6000);
  g = await form(); t = await top();
  ok('Enter on the filled form signs in', !g.login && t.store.length === 2, { login: g.login, handedAgain: t.store.length });
  // a wrong password is never handed to the browser
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} [...document.querySelectorAll('button')].find(x => /^Logout$/.test(x.textContent.trim())).click(); }); await wait(600);
  await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); await wait(2500);
  await f.evaluate(() => { document.getElementById('lg_pass').value = 'wrong-password-1'; }); const n0 = (await top()).store.length;
  await f.click('#lg_btn'); await wait(3500);
  ok('a wrong password is not handed to the browser', (await top()).store.length === n0 && (await form()).login, { handed: (await top()).store.length, before: n0 });
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/cred.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/cred.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
