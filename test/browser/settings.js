// Settings: every user's own app – through the page and the database
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
const saved = () => { const v = sql("select value from app_settings where id = 'USER_PREFS|sujit@rcl.test'"); try { return JSON.parse(v); } catch (e) { return {}; } };
(async () => {
  sql("delete from app_settings where id like 'USER_PREFS|%'; delete from web.props where key = 'SITE_RULES'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  let f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { Object.keys(localStorage).filter(k => /^oc_prefs_|^oc_intro_off|^rcl_lang/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
  const signIn = async () => { f = p.frames().find(x => x !== p.mainFrame()); await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); };
  await signIn();
  const st = () => f.evaluate(() => ({ theme: document.documentElement.dataset.theme, text: document.documentElement.dataset.text, dens: document.documentElement.dataset.density, lang: fixLang, tab: S.curTab, fav: [...document.querySelectorAll('#grp_fav_items [data-fav]')].map(x => x.dataset.fav).join(','), favShown: !document.getElementById('grp_fav').hidden, ava: !!document.querySelector('#u_ava img'), initials: (document.querySelector('#u_ava i') || {}).textContent || '' }));
  let s = await st();
  ok('as the app comes: light, Marathi help, the Dashboard first, initials instead of a photo', s.theme === 'light' && s.lang === 'mr' && (s.tab === 'dash' || !s.tab) && !s.ava && s.initials === 'S', s);
  await f.evaluate(() => document.getElementById('u_ava').click()); await wait(1800);
  const page = await f.evaluate(() => ({ title: document.getElementById('page_title').textContent, crumb: document.getElementById('crumb_mod').textContent, name: document.getElementById('set_name').textContent, email: document.getElementById('set_email').textContent, admin: !document.getElementById('set_admin').hidden, logins: document.querySelectorAll('#set_logins div').length, pages: document.querySelectorAll('#set_fav input').length }));
  ok('the Settings page opens from the photo: my name, e-mail, last sign-ins, the pages I may open', page.title === 'Settings' && page.crumb === 'My account' && page.name === 'Sujit' && page.email === 'sujit@rcl.test' && page.admin && page.logins >= 1 && page.pages >= 30, page);
  await Promise.race([p.screenshot({ path: 'shots/settings_light.png' }).catch(() => {}), wait(20000)]);
  const press = (pref, v) => f.evaluate((a, c) => document.querySelector('#sec-settings .set-seg[data-pref="' + a + '"] button[data-v="' + c + '"]').click(), pref, v);
  const pick = (id, v) => f.evaluate((a, c) => { const el = document.getElementById(a); el.value = c; el.dispatchEvent(new Event('change', { bubbles: true })); }, id, v);
  // ---- look ----
  await press('theme', 'dark'); await press('text', 'large'); await press('density', 'compact'); await press('lang', 'en'); await wait(1500);
  s = await st(); let d = saved();
  ok('dark, large text, tight rows, English help: applied at once and saved with my account', s.theme === 'dark' && s.text === 'large' && s.dens === 'compact' && s.lang === 'en' && d.theme === 'dark' && d.text === 'large' && d.density === 'compact' && d.lang === 'en', { page: s, db: { theme: d.theme, text: d.text, density: d.density, lang: d.lang } });
  await Promise.race([p.screenshot({ path: 'shots/settings_dark.png' }).catch(() => {}), wait(20000)]);
  // ---- work ----
  await pick('set_start', 'log'); await pick('set_lbdays', '7'); await pick('set_shift', 'Night');
  await f.evaluate(() => { ['log', 'diesel'].forEach(t => { const c = document.querySelector('#set_fav [data-favpick="' + t + '"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await f.evaluate(() => prefSet({ photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' })); await wait(1500);
  s = await st(); d = saved();
  ok('first page, list days, usual shift, favourites and a photo are saved; the favourites are at the top of the menu', d.start === 'log' && d.lbDays === '7' && d.shift === 'Night' && d.fav.join() === 'log,diesel' && /^data:image\/png/.test(d.photo) && s.fav === 'log,diesel' && s.favShown && s.ava, { db: { start: d.start, lbDays: d.lbDays, shift: d.shift, fav: d.fav }, page: s });
  // ---- another user is not touched ----
  let l2 = await post({ fn: 'login', args: ['view@rcl.test', 'Audit#PassView9!x'] });
  const p2 = l2.result ? (await post({ fn: 'api', args: [l2.result.token, 'getMyPrefs', []] })).result : null;
  ok('another user still has the app as it comes (settings are per user)', p2 && p2.prefs.theme === 'light' && p2.prefs.start === '' && p2.prefs.photo === '' && p2.email === 'view@rcl.test', p2 ? { theme: p2.prefs.theme, start: p2.prefs.start } : (l2.error || 'no sign-in'));
  // ---- a fresh browser (another computer): sign in → my settings come from my account ----
  await f.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }); await p.reload({ waitUntil: 'load' }); await wait(1200);
  await signIn(); await wait(2500);
  const s2 = await f.evaluate(() => ({ theme: document.documentElement.dataset.theme, text: document.documentElement.dataset.text, lang: fixLang, tab: S.curTab, from: document.getElementById('lf_from').value, to: document.getElementById('lf_to').value, ava: !!document.querySelector('#u_ava img'), fav: document.querySelectorAll('#grp_fav_items [data-fav]').length }));
  const days = s2.from && s2.to ? Math.round((new Date(s2.to) - new Date(s2.from)) / 86400000) + 1 : 0;
  ok('on another computer (nothing kept in the browser): dark, large, English, my photo, my favourites – and it opens on Log Book with the last 7 days', s2.theme === 'dark' && s2.text === 'large' && s2.lang === 'en' && s2.tab === 'log' && s2.ava && s2.fav === 2 && days === 7, Object.assign({ days: days }, s2));
  await wait(1500); await Promise.race([p.screenshot({ path: 'shots/logbook_dark.png' }).catch(() => {}), wait(20000)]);
  await f.evaluate(() => showTab('dash')); await wait(3000); await Promise.race([p.screenshot({ path: 'shots/dash_dark.png' }).catch(() => {}), wait(20000)]);
  await f.evaluate(() => document.getElementById('tab-settings').click()); await wait(1500);
  // ---- rules of the site (Admin) ----
  await f.evaluate(() => { document.getElementById('rule_back').value = '3'; document.getElementById('rule_note').value = 'Fill every entry by the 30th'; document.getElementById('rule_save').click(); }); await wait(2500);
  const rl = await f.evaluate(() => ({ note: document.getElementById('announce').textContent, shown: !document.getElementById('announce').hidden, rules: S.rules }));
  ok('Admin: the notice is shown to everybody, the rule "3 days back" is kept', rl.shown && rl.note === 'Fill every entry by the 30th' && rl.rules.backDays === 3 && JSON.parse(sql("select value from web.props where key = 'SITE_RULES'")).backDays === 3, rl);
  const r2 = l2.result ? (await post({ fn: 'api', args: [l2.result.token, 'getInit', []] })).result : null;
  ok('…and every user gets the rule and the notice', r2 && r2.rules && r2.rules.backDays === 3 && r2.rules.announce === 'Fill every entry by the 30th', r2 && r2.rules);
  // ---- back to the usual settings ----
  await f.evaluate(() => document.getElementById('set_reset').click()); await wait(400); await f.evaluate(() => document.getElementById('cf_ok').click()); await wait(1600);
  s = await st(); d = saved();
  ok('"Back to the usual settings": light again, the photo stays', s.theme === 'light' && s.lang === 'mr' && d.theme === 'light' && d.start === '' && d.fav.length === 0 && /^data:image/.test(d.photo) && s.ava, { page: s, db: { theme: d.theme, start: d.start, fav: d.fav } });
  ok('no script error', errs.length === 0, errs.join(' | '));
  sql("delete from app_settings where id like 'USER_PREFS|%'; delete from web.props where key = 'SITE_RULES'");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/settings.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/settings.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 700)); process.exit(1); });
