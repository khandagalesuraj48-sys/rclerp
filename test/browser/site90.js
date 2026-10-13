// update-90 (new sites, stage 2) in the browser, on the local rig (sites S1 = rcl, T2 = rcl_s2 – see test/site90api.js, run first):
//   the first site's Admin creates the Super Admin (recovery code shown once) → his Users page only shows users from then on;
//   an Admin with two sites is not asked, sees the site at the top and opens the other site from there (computer);
//   a user with two sites and no default site is asked which one (phone); Settings → My sites;
//   the Super Admin's own screen: Sites, Users & Access per site (a change saved), Companies (one added), sign out;
//   the saved sign-in of the Super Admin opens his screen again; "Forgot password?" shows the recovery-code way.
//   node site90.js [port]      (with geo-shim.js; the app servers with RCL_SITES_KEY)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const SHOTS = '/home/claude/test/shots/';
const SAPW = 'Super#Admin2031';
(async () => {
  // the start: no Super Admin; sujit@ (Admin) on S1 and T2; view@ on S1 and T2 (no default site)
  sql('rcl', "delete from rcl_super_admin; delete from web.cache where key like 'SA%' or key like 'F\\_%' or key like 'LG\\_%'; " +
    "insert into rcl_user_sites (email, site, is_admin) values ('sujit@rcl.test', 'T2', true), ('view@rcl.test', 'T2', false) on conflict (email, site) do update set is_admin = excluded.is_admin; update rcl_user_sites set is_default = false;");
  sql('rcl_s2', "update app_users set active = 'Yes', updated_at = now() where email in ('sujit@rcl.test', 'view@rcl.test'); update app_users set admin = 'Yes', updated_at = now() where email = 'sujit@rcl.test'; delete from web.cache where key like 'F\\_%' or key like 'LG\\_%';");
  await wait(16000);      // the servers' memory of the list of sites
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const frameOf = p => p.frames().find(x => x !== p.mainFrame());
  const open = async (ctx, phone) => {
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    if (phone) await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); else await p.setViewport({ width: 1536, height: 900 });
    await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1500);
    const f = frameOf(p);
    await f.evaluate(() => { try { localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); localStorage.removeItem('rcl_last_site'); } catch (e) {} });
    return { p, f, errs };
  };
  const signIn = async (f, email, pw) => { await f.evaluate((e, w) => { ['oc_brief_sujit@rcl.test', 'oc_brief_view@rcl.test'].forEach(k => { try { localStorage.setItem(k, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (x) {} });
    $('lg_email').value = e; $('lg_pass').value = w; $('lg_remember').checked = true; $('lg_btn').click(); }, email, pw); };
  const dialog = f => f.evaluate(() => ({ open: !$('cf_back').hidden, title: $('cf_title').textContent, btns: [...document.querySelectorAll('#cf_msg .sp-btn')].map(x => x.textContent), text: $('cf_msg').textContent }));

  // ===== 1. COMPUTER: the Admin creates the Super Admin; two sites; the switch =====
  let ctx = await b.createBrowserContext(), A = await open(ctx, false);
  await signIn(A.f, 'sujit@rcl.test', 'Nashik#Road848!'); await wait(7000);
  await A.f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  let st = await A.f.evaluate(() => ({ login: !$('login_screen').hidden, pill: !$('site_box').hidden, pillText: $('site_chg_name').textContent, site: localStorage.getItem('rcl_site'), sites: (S.siteInfo || {}).sites }));
  ok('COMPUTER Admin with 2 sites: no question – the app opens on the first site', !st.login && st.site === 'S1', st);
  ok('   the site he is on is shown at the top of the dark menu (Change site · VTR NH 848)', st.pill && /VTR NH 848/.test(st.pillText), st.pillText);
  await A.f.evaluate(() => showTab('users')); await wait(2500);
  st = await A.f.evaluate(() => ({ mk: !$('ua_mksa').hidden, add: !$('ua_new').hidden, note: !$('ua_sa_note').hidden }));
  ok('   Users & Access: "Create Super Admin" is offered (none yet); he still adds users', st.mk && st.add && !st.note, st);
  await A.f.evaluate(() => $('ua_mksa').click()); await wait(500);
  await A.f.evaluate(pw => { $('mk_name').value = 'Owner'; $('mk_email').value = 'sa@rcl.test'; $('mk_pw').value = pw; $('mk_pw2').value = pw; $('cf_ok').click(); }, SAPW); await wait(3500);
  st = await dialog(A.f);
  const code = ((st.text.match(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/) || [])[0]) || '';
  ok('   he creates the Super Admin: the recovery code is shown once, to write down', st.open && /write this code down/.test(st.title) && !!code, st.title + ' | ' + code);
  await A.p.screenshot({ path: SHOTS + 'site90_recovery.png' });
  await A.f.evaluate(() => $('cf_ok').click()); await wait(17000); await A.f.evaluate(() => uaLoad()); await wait(2500);
  st = await A.f.evaluate(() => ({ mk: !$('ua_mksa').hidden, add: !$('ua_new').hidden, note: !$('ua_sa_note').hidden, saves: document.querySelectorAll('#ua_rows .ua-save').length, enabled: document.querySelectorAll('#ua_rows select:not([disabled]), #ua_rows input:not([disabled])').length }));
  ok('   from then on his Users page only SHOWS users: a note, no Add, no Save, nothing to change', !st.mk && !st.add && st.note && st.saves === 0 && st.enabled === 0, st);
  await A.f.evaluate(() => showTab('settings')); await wait(1200);
  st = await A.f.evaluate(() => ({ shown: !$('set_sites').hidden, opts: [...$('set_site_def').options].map(o => o.textContent) }));
  ok('   Settings → My sites: "The site I used last" (an Admin) and his two sites', st.shown && st.opts[0] === 'The site I used last' && st.opts.length === 3, st);
  await A.f.evaluate(() => $('site_chg').click()); await wait(500);
  st = await dialog(A.f);
  ok('   pressing "Change site": his sites (the one he is on cannot be pressed)', st.open && st.btns.length === 2 && /open now/.test(st.btns.join()), st.btns);
  await A.p.screenshot({ path: SHOTS + 'site90_switch.png' });
  await A.f.evaluate(() => [...document.querySelectorAll('#cf_msg .sp-btn')].find(x => !x.disabled).click()); await wait(9000);
  A.f = frameOf(A.p); await A.f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(500);
  st = await A.f.evaluate(() => ({ login: !$('login_screen').hidden, pillText: $('site_chg_name').textContent, site: localStorage.getItem('rcl_site'), cur: (S.siteInfo || {}).site, issues: document.querySelectorAll('#d_rows tr').length }));
  await A.p.screenshot({ path: SHOTS + 'site90_on_t2.png' });
  ok('   he is on T2 – opened without signing in again', !st.login && st.site === 'T2' && st.cur === 'T2' && /Test Site T2/.test(st.pillText), st);
  ok('   no script error', !A.errs.length, A.errs);
  await ctx.close();

  // ===== 2. PHONE: a user with two sites and no default site is asked =====
  ctx = await b.createBrowserContext(); const B = await open(ctx, true);
  await signIn(B.f, 'view@rcl.test', 'Audit#PassView9!x'); await wait(5000);
  st = await dialog(B.f);
  ok('PHONE user with 2 sites, no default: "Which site do you want to open?" – one button per site', st.open && /Which site/.test(st.title) && st.btns.join('|') === 'VTR NH 848|Test Site T2', st);
  await B.p.screenshot({ path: SHOTS + 'site90_pick_phone.png' });
  await B.f.evaluate(() => [...document.querySelectorAll('#cf_msg .sp-btn')].find(x => /T2/.test(x.textContent)).click()); await wait(7000);
  await B.f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  st = await B.f.evaluate(() => ({ login: !$('login_screen').hidden, site: localStorage.getItem('rcl_site'), cur: (S.siteInfo || {}).site, pill: !$('site_box').hidden, pillText: $('site_chg_name').textContent }));
  await B.p.screenshot({ path: SHOTS + 'site90_phone_t2.png' });
  ok('   he picks T2: the app opens on T2, its name at the top', !st.login && st.site === 'T2' && st.cur === 'T2' && st.pill && /Test Site T2/.test(st.pillText), st);
  await B.f.evaluate(() => showTab('settings')); await wait(1200);
  await B.f.evaluate(() => { const s = $('set_site_def'); s.value = 'T2'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  ok('   Settings → My sites: he makes T2 his default', sql('rcl', "select site from rcl_user_sites where email = 'view@rcl.test' and is_default") === 'T2');
  ok('   no script error', !B.errs.length, B.errs);
  await ctx.close();

  // ===== 3. COMPUTER: the Super Admin's own screen =====
  ctx = await b.createBrowserContext(); const C = await open(ctx, false);
  await C.f.evaluate(() => $('lg_forgot').click());
  ok('sign-in screen: "Forgot password?" also shows the Super Admin\'s recovery-code way', await C.f.evaluate(() => !$('lg_sarec').hidden));
  await signIn(C.f, 'sa@rcl.test', SAPW); await wait(5000);
  st = await C.f.evaluate(() => ({ sa: !$('sa_screen').hidden, mode: document.body.classList.contains('sa-mode'), login: !$('login_screen').hidden, who: $('sa_who').textContent, rows: [...document.querySelectorAll('#sa_sites_rows tr')].map(t => t.querySelector('.sa-sname') && t.querySelector('.sa-sname').value) }));
  ok('SUPER ADMIN signs in on the same screen → his own screen: Sites (VTR NH 848, Test Site T2)', st.sa && st.mode && !st.login && /sa@rcl\.test/.test(st.who) && st.rows.join('|') === 'VTR NH 848|Test Site T2', st);
  const cover = await C.f.evaluate(() => { const r = $('sa_screen').getBoundingClientRect(); const el = document.elementFromPoint(r.width / 2, 300); return !!el && !!el.closest('#sa_screen'); });
  ok('   his screen covers the app: no page of a site can be pressed', cover);
  await C.p.screenshot({ path: SHOTS + 'site90_sa_sites.png' });
  await C.f.evaluate(() => [...document.querySelectorAll('#sa_sites_rows tr')][1].querySelector('.sa-scheck').click()); await wait(2500);
  ok('   "Check" T2: its database answers', await C.f.evaluate(() => /answers/.test([...document.querySelectorAll('#sa_sites_rows .sa-sres')][1].textContent)));
  await C.f.evaluate(() => saTab('users')); await wait(3000);
  st = await C.f.evaluate(() => ({ sites: [...$('sa_u_site').options].map(o => o.textContent), rows: document.querySelectorAll('#sa_ua_rows tr').length, saves: document.querySelectorAll('#sa_ua_rows .ua-save').length }));
  ok('   Users & Access: a site to pick, its users with Save', st.sites.length === 2 && st.rows >= 3 && st.saves === st.rows, st);
  await C.f.evaluate(() => { const s = $('sa_u_site'); s.value = 'T2'; s.dispatchEvent(new Event('change')); }); await wait(3000);
  await C.f.evaluate(() => { const tr = document.querySelector('#sa_ua_rows tr[data-email="view@rcl.test"]'); const sel = tr.querySelector('.ua-p[data-m="Diesel Inward"]'); sel.value = 'Edit'; sel.dispatchEvent(new Event('change', { bubbles: true })); tr.querySelector('.ua-save').click(); }); await wait(4000);
  ok('   T2: view@ gets Diesel Inward Edit – saved in T2\'s Users only', sql('rcl_s2', "select perm_diesel_inward from app_users where email = 'view@rcl.test'") === 'Edit' && sql('rcl', "select coalesce(perm_diesel_inward, '') from app_users where email = 'view@rcl.test'") !== 'Edit');
  await C.p.screenshot({ path: SHOTS + 'site90_sa_users.png' });
  await C.f.evaluate(() => saTab('companies')); await wait(2000);
  await C.f.evaluate(() => { $('sa_co_name').value = 'Browser Test Company'; $('sa_co_gstin').value = '27AABCB1234Q1ZX'; $('sa_co_save').click(); }); await wait(3000);
  ok('   Companies: one added from the form, it is in the list', await C.f.evaluate(() => /Browser Test Company/.test($('sa_co_rows').textContent)));
  await C.f.evaluate(() => saTab('me')); await wait(400);
  ok('   My account: change password', await C.f.evaluate(() => !$('sa_me').hidden && !!$('sa_pw_save')));
  // his saved sign-in opens his screen again
  await C.p.reload({ waitUntil: 'load' }); await wait(5000); C.f = frameOf(C.p);
  ok('   the app opened again: his screen again (not a site, not the sign-in)', await C.f.evaluate(() => !$('sa_screen').hidden && $('login_screen').hidden));
  await C.f.evaluate(() => $('sa_out').click()); await wait(400); await C.f.evaluate(() => $('cf_ok').click()); await wait(2000);
  ok('   Sign out → the sign-in screen', await C.f.evaluate(() => $('sa_screen').hidden && !$('login_screen').hidden));
  ok('   no script error', !C.errs.length, C.errs);
  await ctx.close(); await b.close();
  sql('rcl', "delete from rcl_companies where name = 'Browser Test Company';");
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
