// update-110 (the language of the app) in the browser, on the local rig (Mechanical :3001, site S1). The user picks Marathi in
// Settings: the screens turn Marathi at once (menu, headings, buttons, hints, messages, the server's errors), the drop-downs keep
// their English values, the setting is kept with his account (the next sign-in opens in Marathi, also the sign-in page);
// Hindi; English again draws the page in English. Every page is opened in Marathi without a page error. Nothing is saved as an entry.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node lang110.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const BASE = 'http://127.0.0.1:3001', DEVA = /[ऀ-ॿ]/;
(async () => {
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const was = (await api('getMyPrefs')).prefs || {};
  await api('saveMyPrefs', { appLang: '', lang: was.lang || 'mr' });
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const errs = [];
  const frame = async p => { let f = null; for (let i = 0; i < 80 && !f; i++) { await wait(500); const fr = p.frames().find(x => x !== p.mainFrame()); try { if (fr && await fr.evaluate(() => typeof showTab === 'function' && !!document.getElementById('lg_email'))) f = fr; } catch (e) {} } return f; };
  const signIn = async (p, f) => { await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); };
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    let f = await frame(p); await wait(1500); f = p.frames().find(x => x !== p.mainFrame());
    await signIn(p, f);
    let F0 = null; const F = () => F0;
    const findF = async () => { for (let i = 0; i < 60; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(() => typeof showTab === 'function' && typeof S === 'object')) { F0 = x; return x; } } catch (e) {} } await wait(500); } return null; };
    await findF();
    const nav = () => F().evaluate(() => [...document.querySelectorAll('#tab-dash .label, #tab-settings .label, #tab-diesel .label, #tab-log .label')].map(x => x.textContent.trim()));
    ok('English to start with (as today)', (await nav()).length === 4 && (await nav()).every(t => !/[ऀ-ॿ]/.test(t)), await nav());
    // Settings → Language of the app → मराठी
    await F().evaluate(() => showTab('settings')); await wait(1200);
    const seg = await F().evaluate(() => { const g = document.querySelector('#sec-settings .set-seg[data-pref="appLang"]'); return g ? { label: g.parentNode.querySelector('b').textContent, btns: [...g.querySelectorAll('button')].map(x => x.textContent + '=' + x.dataset.v) } : null; });
    ok('Settings shows "Language of the app": मराठी / हिंदी / English', seg && seg.label === 'Language of the app' && seg.btns.join('|') === 'मराठी=mr|हिंदी=hi|English=', seg);
    await F().click('#sec-settings .set-seg[data-pref="appLang"] button[data-v="mr"]'); await wait(2500);
    const n1 = await nav();
    ok('Marathi at once (no reload): the menu – ' + n1.join(', '), n1.length === 4 && n1.every(t => DEVA.test(t)), n1);
    const set1 = await F().evaluate(() => ({ h: [...document.querySelectorAll('#sec-settings h2')].map(x => x.textContent.trim()).slice(0, 3), on: (document.querySelector('#sec-settings .set-seg[data-pref="appLang"] button.on') || { dataset: {} }).dataset.v, lang: document.documentElement.lang, help: fixLang }));
    ok('the Settings page is Marathi, मराठी is marked, the help follows (' + set1.h.join(' / ') + ')', set1.h.length && set1.h.every(t => DEVA.test(t)) && set1.on === 'mr' && set1.lang === 'mr' && set1.help === 'mr', set1);
    await wait(1500);
    const sp = (await api('getMyPrefs')).prefs;
    ok('kept with his account: appLang "mr" (and the help "mr")', sp.appLang === 'mr' && sp.lang === 'mr', sp);
    // the Diesel page: the drop-downs show Marathi, their values stay English; hints too
    await F().evaluate(() => showTab('diesel')); await wait(2000);
    const dz = await F().evaluate(() => { const s = $('d_shift'); return { opts: [...s.options].map(o => o.value + '=' + o.textContent), val: s.value, auto: autoShift(), ph: [...document.querySelectorAll('#sec-diesel input[placeholder]')].map(x => x.placeholder).filter(Boolean).slice(0, 4), h: [...document.querySelectorAll('#sec-diesel h2')].map(x => x.textContent.trim()).slice(0, 2) }; });
    ok('Diesel Issue: the shift shows दिवस / रात्र but its value is still "Day" / "Night" (the automatic one = ' + dz.auto + ')', dz.opts.some(o => o === 'Day=दिवस') && dz.opts.some(o => o === 'Night=रात्र') && dz.val === dz.auto, dz);
    ok('   …the headings and the hints are Marathi (' + dz.h.join(' / ') + ')', dz.h.length && dz.h.every(t => DEVA.test(t)) && dz.ph.some(t => DEVA.test(t)), dz);
    const ta = await F().evaluate(() => { const t = document.querySelector('#ai_form textarea, #ai_form input[type=text]'); return t ? t.placeholder : null; });
    ok('a typing box: its hint is Marathi ("' + ta + '"), what is typed is never touched', ta === null || /[\u0900-\u097F]/.test(ta), ta);
    // a message of the page and an error of the server, as they come
    await F().evaluate(() => { toast('Mobile number must be 10 digits.', true); }); await wait(600);
    const t1 = await F().evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
    ok('a message of the page: "' + t1.slice(0, 60) + '"', DEVA.test(t1) && /10/.test(t1), t1);
    await F().evaluate(() => { call('saveSiteRules', { backDays: 'abc' }).catch(e => toast(errMsg(e), true)); }); await wait(2500);
    const t2 = await F().evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
    ok('an error of the server, with its help: "' + t2.slice(0, 80) + '…"', DEVA.test(t2) && /365/.test(t2) && !/Days back must be/.test(t2), t2);
    // busy(): the button gets its words back
    const bz = await F().evaluate(async () => { const x = document.createElement('button'); x.textContent = 'Save'; document.body.appendChild(x); await new Promise(r => setTimeout(r, 120)); const before = x.textContent; await busy(x, 'Saving…', () => new Promise(r => setTimeout(r, 300))); await new Promise(r => setTimeout(r, 120)); const after = x.textContent; x.remove(); return { before, after }; });
    ok('a busy button ("' + bz.before + '") gets its words back after the work', DEVA.test(bz.before) && bz.after === bz.before, bz);
    // every page opens in Marathi without a page error
    const tabs = await F().evaluate(() => TABS.filter(t => $('tab-' + t) && !$('tab-' + t).hidden && !(($('tab-' + t).closest('.navgroup') || {}).hidden)));
    const latin = [];
    for (const t of tabs) { await F().evaluate(t => { try { S.formDirty = false; showTab(t); } catch (e) { window.__e = String(e); } }, t); await wait(900);
      const r = await F().evaluate(t => { const sec = document.getElementById('sec-' + t); const h = sec ? [...sec.querySelectorAll('h2')].map(x => x.textContent.trim()).filter(Boolean) : []; return h.filter(x => !/[ऀ-ॿ]/.test(x)); }, t);
      if (r.length) latin.push(t + ': ' + r.join(' | ')); }
    ok('all ' + tabs.length + ' pages opened in Marathi, no page error', !errs.length, errs);
    ok('   …every heading of every page is Marathi', !latin.length, latin);
    // the next sign-in: the sign-in page is Marathi already, and after it the app
    await F().evaluate(() => showTab('dash')); await wait(500);
    const p2 = await b.newPage(); await p2.setViewport({ width: 1440, height: 900 }); p2.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p2.evaluateOnNewDocument(() => { try { localStorage.removeItem('rcl_token'); sessionStorage.clear(); } catch (e) {} });
    await p2.goto(BASE + '/', { waitUntil: 'load' }); let f2 = await frame(p2); await wait(2500); f2 = p2.frames().find(x => x !== p2.mainFrame());
    const lp = await f2.evaluate(() => ({ user: !!S.user, btn: ($('lg_btn') || {}).textContent || '', lang: document.documentElement.lang }));
    ok('another window: ' + (lp.user ? 'still signed in, ' : 'the sign-in page, ') + 'in Marathi (' + lp.btn.trim() + ')', lp.lang === 'mr' && (lp.user || DEVA.test(lp.btn)), lp);
    await p2.close();
    // Hindi, then English again (the page is drawn again)
    await F().evaluate(() => showTab('settings')); await wait(800);
    await F().click('#sec-settings .set-seg[data-pref="appLang"] button[data-v="hi"]');
    for (let i = 0; i < 30; i++) { await wait(1000); try { await findF(); if (await F().evaluate(() => !!S.user && I18N.lang === 'hi')) break; } catch (e) { /* drawn again */ } }
    await wait(2500); await findF();
    const n2 = await F().evaluate(() => [...document.querySelectorAll('#tab-dash .label, #tab-settings .label')].map(x => x.textContent.trim()));
    const sp2 = (await api('getMyPrefs')).prefs;
    ok('हिंदी: the page is drawn again in Hindi – ' + n2.join(', '), n2.every(t => DEVA.test(t)) && sp2.appLang === 'hi' && sp2.lang === 'hi', { n2, sp2 });
    await F().evaluate(() => showTab('settings')); await wait(800);
    await F().click('#sec-settings .set-seg[data-pref="appLang"] button[data-v=""]');
    for (let i = 0; i < 30; i++) { await wait(1000); try { await findF(); if (await F().evaluate(() => !!S.user && document.documentElement.lang === 'en' && !I18N.lang)) break; } catch (e) { /* drawn again */ } }
    await wait(2500); await findF();
    const n3 = await nav(); const sp3 = (await api('getMyPrefs')).prefs;
    ok('English: drawn again in English – ' + n3.join(', ') + ' (help: ' + sp3.lang + ')', n3.length === 4 && n3.every(t => !DEVA.test(t)) && sp3.appLang === '' && sp3.lang === 'en', { n3, sp3 });
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { await b.close(); await api('saveMyPrefs', { appLang: was.appLang || '', lang: was.lang || 'mr' }); }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
