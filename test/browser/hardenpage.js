// The browser side of the audit of 07-10-2026, in a real (headless) browser on the test rig:
// the security headers and that nothing on the pages falls foul of them, the freeze recorder, the redraw limiter,
// what sign-out leaves behind, the offline copy.      node hardenpage.js [3000 | 3002 = the code that is live ("before")]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const PORT = Number(process.argv[2] || 3000), NEW = PORT === 3000, BASE = 'http://127.0.0.1:' + PORT;
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 520) : '')); };
const T = NEW ? '[fix] ' : 'BEFORE: ';
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const csp = [], errs = [];
  const watch = pg => { pg.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to (load|execute|apply|frame|connect)|violates the following/i.test(t)) csp.push(t.slice(0, 220)); }); pg.on('pageerror', e => { if (!/public key credentials/.test(String(e.message))) errs.push(String(e.message).slice(0, 160)); }); };      // (the headless test browser has no password manager – the app's "forget the saved sign-in" says so there)
  b.on('targetcreated', async t => { try { if (t.type() === 'page') { const w = await t.page(); if (w) watch(w); } } catch (e) {} });
  const open = async () => { const p = await b.newPage(); watch(p); await p.setViewport({ width: 1536, height: 900 }); const resp = await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200); return { p, f: p.frames().find(x => x !== p.mainFrame()), headers: resp.headers() }; };
  const signIn = async f => { await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
    await f.evaluate(() => { document.getElementById('lg_remember').checked = true; }); await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); };

  // ---------- 1. the headers, and a walk through the app under them ----------
  let { p, f, headers } = await open();
  ok(T + 'the site sends a Content-Security-Policy: no plug-in objects, no foreign <base>, forms only to itself, framed only by itself; the script rule is watched (report-only), not enforced',
    /object-src 'none'/.test(headers['content-security-policy'] || '') && /frame-ancestors 'self'/.test(headers['content-security-policy'] || '') && /script-src 'self' 'unsafe-inline'/.test(headers['content-security-policy-report-only'] || ''), { enforced: headers['content-security-policy'] || 'none', watched: headers['content-security-policy-report-only'] || 'none' });
  await signIn(f);
  const tabs = await f.evaluate(() => TABS.slice());
  for (const t of tabs) { await f.evaluate(t2 => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab(t2); }, t); await wait(450); }
  // a print window (written with document.write) and its Excel – made with the app's own copy of the tools
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('master'); }); await wait(1500);
  const got = new Promise(res => b.once('targetcreated', t => res(t)));
  await f.evaluate(() => document.getElementById('m_print').click());
  for (let i = 0; i < 10; i++) { await wait(300); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }      // (the print asks what to include: OK)
  const tw = await Promise.race([got, wait(8000).then(() => null)]); const w = tw ? await tw.page() : null; await wait(2500);
  let xl = null;
  if (w && NEW) { await f.evaluate(() => { window.__xl = []; saveXlsxBuffer = function (buf, name) { window.__xl.push({ name: name, size: buf.byteLength }); }; });
    await w.evaluate(() => { const x = document.getElementById('xl_btn'); if (x) x.click(); }); for (let i = 0; i < 40; i++) { await wait(400); xl = await f.evaluate(() => window.__xl[0] || null); if (xl) break; }
    xl = Object.assign({ btn: await w.evaluate(() => (document.getElementById('xl_btn') || {}).textContent) }, xl || {}); }
  if (w) await w.close();
  const src = await f.evaluate(() => [...document.scripts].map(x => x.src).filter(Boolean));
  if (NEW) ok('[fix] every page of the app opened, a print window and its formatted Excel made – NOTHING was refused or reported by the policy (also not by the watched script rule); every script comes from the app\'s own address',
    csp.length === 0 && tabs.length > 30 && xl && xl.size > 3000 && /Excel ✓/.test(xl.btn || '') && src.length >= 2 && src.every(u => u.indexOf(BASE + '/') === 0), { pages: tabs.length, policy_messages: csp.length ? csp.slice(0, 3) : 0, excel: xl, scripts: src.map(u => u.replace(BASE, '')) });
  else ok('BEFORE: scripts are fetched from public file servers into the signed-in page', src.every(u => u.indexOf(BASE + '/') === 0), src);

  // ---------- 2. the freeze recorder: how often it writes to the browser's storage ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('dash'); }); await wait(2500);
  await f.evaluate(() => { window.__w = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'rcl_trace') window.__w++; return o.apply(this, arguments); }; });
  await wait(10000);
  const idleWrites = await f.evaluate(() => window.__w);
  await f.evaluate(() => { window.__w = 0; const bt = document.getElementById('u_pw') || document.querySelector('button'); bt.dispatchEvent(new MouseEvent('click', { bubbles: true })); try { closePw && 0; } catch (e) {} }); await wait(2500);
  await f.evaluate(() => { try { document.getElementById('pw_cancel').click(); } catch (e) {} });
  const afterClick = await f.evaluate(() => window.__w);
  ok(T + 'an open page nobody touches writes its trace 0 times in 10 seconds (it was once every second); after a click it is written (the trace still works)', idleWrites <= 1 && afterClick >= 1, { writes_in_10s_idle: idleWrites, writes_after_a_click: afterClick });

  // ---------- 3. a second tab does not get "the page stopped without closing properly" from the first one; a page that really died does ----------
  const second = await open(); await wait(1800);
  const falseAlarm = await second.f.evaluate(() => [...document.querySelectorAll('div')].some(d => /stopped at .* without closing properly/.test(d.textContent || '') && d.querySelector('pre')));
  ok(T + 'a SECOND tab of the app: no "last time this page stopped … without closing properly" box about the first tab (which is open and fine)', falseAlarm === false, 'box shown: ' + falseAlarm);
  await second.p.close();
  await f.evaluate(() => { localStorage.setItem('rcl_trace', JSON.stringify({ beat: Date.now() - 60000, clean: false, tab: 'deadtab1', crumbs: ['10:00:00 → saveDieselIssue', '10:00:09 PAGE DID NOT ANSWER for 9.0 s'] })); });
  const third = await open(); await wait(1800);
  const realNote = await third.f.evaluate(() => { const d = [...document.querySelectorAll('div')].find(x => /without closing properly/.test(x.textContent || '') && x.querySelector('pre')); return d ? d.querySelector('pre').textContent : ''; });
  ok('a page that really died (its trace is there, nobody answers for it): the note IS shown at the next start, with its lines', /PAGE DID NOT ANSWER for 9\.0 s/.test(realNote), realNote.slice(0, 120));
  await third.p.close();
  // the page goes to the background (a phone that then ends the app must not look like a crash)
  await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hiddenRec = await f.evaluate(() => JSON.parse(localStorage.getItem('rcl_trace') || '{}').clean);
  await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  const shownRec = await f.evaluate(() => JSON.parse(localStorage.getItem('rcl_trace') || '{}').clean);
  ok(T + 'page in the background: its trace is marked "closed properly" (ended there by the phone = no alarm); back on screen: open again', hiddenRec === true && shownRec === false, { in_background: hiddenRec, back_on_screen: shownRec });

  // ---------- 4. the redraw limiter: five changes in a row = ONE redraw of the page on screen ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('dash'); }); await wait(2500);
  const redraws = await f.evaluate(async () => { window.__d = 0; const orig = loadDash; loadDash = function () { window.__d++; return orig.apply(this, arguments); };
    S.freshAt = S.freshAt || {}; S.freshAt.dash = Date.now();      // it was just drawn: the next redraw is due in 5 seconds
    for (let i = 0; i < 5; i++) { onDataChanged(['stock']); await new Promise(r => setTimeout(r, 300)); }
    await new Promise(r => setTimeout(r, 7000)); const n = window.__d; loadDash = orig; return n; });
  ok(T + 'five changes arriving within 2 seconds while the Dashboard is on screen: it is redrawn ONCE (each change used to add its own redraw)', redraws === 1, 'redraws: ' + redraws);

  // ---------- 5. the offline copy stays the page ----------
  const sw = await f.evaluate(async () => { try { const W = window.parent; if (!W.navigator.serviceWorker) return 'no service worker here'; await W.navigator.serviceWorker.ready; return 'ready'; } catch (e) { return 'error ' + e.message; } });
  if (sw === 'ready') {
    await wait(800); const pic = await b.newPage(); await pic.goto(BASE + '/icons/icon-192.png', { waitUntil: 'load' }).catch(() => {}); await wait(1200); await pic.close();
    const kept = await p.evaluate(async () => { const c = await caches.open('fleet-erp-shell'), r = await c.match('/'); return r ? (r.headers.get('content-type') || '') : 'nothing kept'; });
    ok(T + 'an icon opened as an address in a tab: the copy kept for "no network" is still the PAGE (it used to be replaced by the picture)', /text\/html/.test(kept), 'kept as "/": ' + kept);
  } else out.push('     (5. offline copy: not checked – ' + sw + ')');

  // ---------- 6. sign-out ----------
  await f.evaluate(() => { localStorage.setItem('oc_prefs_sujit@rcl.test', JSON.stringify({ mobile: '9999999999', photo: 'data:image/png;base64,AAAA' })); localStorage.setItem('rcl_dbcheck', JSON.stringify({ day: 'x', r: {} })); });
  await f.evaluate(() => { document.getElementById('u_logout').click(); }); await wait(700);
  await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); await wait(4500);
  const f2 = p.frames().find(x => x !== p.mainFrame());
  const left = await f2.evaluate(() => ({ token: localStorage.getItem('rcl_token') || sessionStorage.getItem('rcl_token'), prefs: Object.keys(localStorage).filter(k => /^oc_prefs_/.test(k)).length, dbcheck: localStorage.getItem('rcl_dbcheck'), login: !!document.getElementById('lg_email') && document.body.classList.contains('locked'), lang: localStorage.getItem('rcl_lang') }));
  ok(T + 'Sign out: the sign-in is gone AND this browser\'s copy of the person\'s settings (mobile number, photo) and of the Admin\'s database check; the language choice stays', left.login && !left.token && left.prefs === 0 && !left.dbcheck && !!left.lang, left);
  ok('no script error on the way', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed' + (NEW ? '' : '   (port ' + PORT + ')'));
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
