// update-84 (asked 12-10-2026): "a user sees only what he was given – Diesel Issue given, then only that, nothing else, not even View".
// 1. Users page: a new user starts with "No access" on every page; only the page Admin sets is given.
// 2. The search (Ctrl + K): a machinery / owner result and each of its buttons only for a page the user may open.
// On the local rig only.   node access84.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from activity_log where email like 'u84%@rcl.test'; delete from app_users where id like 'u84%@rcl.test'; delete from diesel_issue where machinery like 'N84-%'; delete from master where id like 'N84-%'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%' or key = 'USERS_LIST';");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveMaster', { no: 'N84-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'N84 Owner Patil', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveDieselIssue', { date: '2026-10-05', shift: 'Day', source: 'Dispenser', no: 'N84-JCB', qty: 40, hrReading: 1200, driver: 'N84 Ganesh Driver', force: true }));
  ok('test data: machinery N84-JCB (owner "N84 Owner Patil"), a diesel issue with driver "N84 Ganesh Driver"', !seedErr.length, seedErr.join(' // ') || 'ready');

  // the server: a new user sent with only one page → every other page "No access" (not View)
  E(await api('saveUserAdmin', { isNew: true, email: 'u84api@rcl.test', name: 'U84 api', active: true, admin: false, perms: { 'Diesel Issue': 'Edit' }, newPassword: 'Temp#api1' }));
  const ua = await api('usersAdmin'); const apiU = (ua.users || []).find(u => u.email === 'u84api@rcl.test') || {};
  const others = Object.keys(apiU.perms || {}).filter(m => m !== 'Diesel Issue' && apiU.perms[m] !== 'None');
  ok('a new user saved with only "Diesel Issue: Edit": every other page is "No access"', apiU.perms && apiU.perms['Diesel Issue'] === 'Edit' && !others.length, apiU.perms);

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const session = async (email, pw) => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [], denied = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    p.on('response', async q => { if (/\/api\/rpc/.test(q.url())) { try { const t = await q.text(); if (/do not have access/i.test(t)) denied.push(t.slice(0, 120)); } catch (e) {} } });
    await p.setViewport({ width: 1536, height: 900 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(em => { try { localStorage.setItem('oc_brief_' + em, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', pw); await f.click('#lg_btn'); await wait(6000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    const start = await f.evaluate(() => ({ tab: S.curTab, shown: TABS.filter(t => !$('sec-' + t).hidden), toast: [...document.querySelectorAll('.fixcard, .toast')].filter(x => !x.hidden && x.offsetParent).map(x => x.textContent.slice(0, 80)) }));
    return { p, f, errs, ctx, denied, start }; };
  const search = async (f, q) => { await f.evaluate(q => { if ($('gs_back').hidden) gsOpen(); const i = $('gs_in'); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); }, q);
    for (let k = 0; k < 40; k++) { await wait(150); if (await f.evaluate(() => !!GS.server)) break; }
    return f.evaluate(() => ({ groups: [...$('gs_list').querySelectorAll('.gs-grp')].map(g => g.textContent.replace(/\s+\(.*$/, '')),
      items: [...$('gs_list').querySelectorAll('.gs-item')].map(x => ({ t: x.querySelector('b').textContent, chips: [...x.querySelectorAll('.gs-chip')].map(c => c.textContent) })) })); };
  const pagesShown = f => f.evaluate(() => TABS.filter(t => { const el = document.getElementById('tab-' + t); return el && !el.hidden && !el.closest('[hidden]'); }));

  // 1. Admin – Users page: "+ Add user" starts with No access on every page
  const A = await session('sujit@rcl.test', 'Nashik#Road848!');
  await A.f.evaluate(() => showTab('users')); await wait(2500);
  await A.f.evaluate(() => $('ua_new').click()); await wait(400);
  const fresh = await A.f.evaluate(() => [...document.querySelectorAll('#ua_rows tr[data-new] .ua-p')].map(s => s.dataset.m + '=' + s.value));
  ok('Users page – "+ Add user": every page starts at "No access"', fresh.length > 10 && fresh.every(x => /=None$/.test(x)), fresh);
  await A.p.screenshot({ path: '/home/claude/test/shots/access84_newuser.png' });
  await A.f.evaluate(() => { const tr = document.querySelector('#ua_rows tr[data-new]'); tr.querySelector('.ua-email').value = 'u84dsl@rcl.test'; tr.querySelector('.ua-name').value = 'U84 Diesel';
    const s = tr.querySelector('.ua-p[data-m="Diesel Issue"]'); s.value = 'Edit'; s.dispatchEvent(new Event('change', { bubbles: true })); tr.querySelector('.ua-pw').value = 'Temp#dsl1'; tr.querySelector('.ua-save').click(); });
  await wait(3000);
  const saved = (await api('usersAdmin')).users.find(u => u.email === 'u84dsl@rcl.test') || {};
  ok('   only "Diesel Issue: Edit" set and Add pressed: that user has Diesel Issue Edit and No access everywhere else', saved.perms && saved.perms['Diesel Issue'] === 'Edit' && Object.keys(saved.perms).every(m => m === 'Diesel Issue' || saved.perms[m] === 'None'), saved.perms);
  // Admin's own search unchanged: all buttons on a machinery, the owner found
  let r = await search(A.f, 'n84-jcb');
  const am = r.items.find(x => x.t === 'N84-JCB');
  ok('Admin search "n84-jcb": the machinery with all its buttons as before', am && ['Diesel issued', 'Log Book', 'Ledger', 'Master', 'New issue'].every(c => am.chips.indexOf(c) > -1), r);
  r = await search(A.f, 'n84 owner patil');
  ok('Admin search: the owner is found', r.groups.indexOf('Owners') > -1, r.groups);
  await A.ctx.close();

  // 2. the user with Diesel Issue only (set a password of his own first)
  const l = await post({ fn: 'login', args: ['u84dsl@rcl.test', 'Temp#dsl1'] }); await post({ fn: 'changePassword', args: [l.result.token, 'Temp#dsl1', 'Own#dsl2468'] });
  const D = await session('u84dsl@rcl.test', 'Own#dsl2468');
  ok('Diesel Issue user signs in: he lands on Diesel Issue (not the Dashboard) and no "You do not have access" comes', D.start.tab === 'diesel' && D.start.shown.join() === 'diesel' && !D.denied.length && !D.start.toast.some(t => /access/i.test(t)), { start: D.start, denied: D.denied });
  const dp = await pagesShown(D.f);
  ok('Diesel Issue user: the menu shows the Diesel Issue page and nothing else (only his own Settings / Help)', dp.indexOf('diesel') > -1 && dp.every(t => ['diesel', 'settings', 'readme'].indexOf(t) > -1), dp);
  r = await search(D.f, 'n84-jcb');
  const dm = r.items.find(x => x.t === 'N84-JCB');
  ok('   search "n84-jcb": the machinery with only "Diesel issued" and "New issue" (no Log Book, Ledger, Master)', dm && dm.chips.join() === 'Diesel issued,New issue', r);
  ok('   only Diesel groups – no Log Book, Owners, Vendors, Bills', r.groups.every(g => ['Pages', 'Quick actions', 'Machinery', 'Diesel issues'].indexOf(g) > -1), r.groups);
  r = await search(D.f, 'n84 owner patil');
  ok('   search the owner\'s name: no "Owners" result (it opens the Asset Master he does not have)', r.groups.indexOf('Owners') === -1, r);
  r = await search(D.f, 'ganesh');
  ok('   search the driver: his diesel issue is found', r.items.some(x => /N84-JCB/.test(x.t)) && r.groups.indexOf('Diesel issues') > -1, r);
  await D.f.evaluate(() => { const it = [...$('gs_list').querySelectorAll('.gs-item')].find(x => /N84-JCB/.test(x.textContent)); it.click(); }); await wait(2500);
  ok('   the result opens the Diesel Issue page', await D.f.evaluate(() => S.curTab) === 'diesel');
  await D.p.screenshot({ path: '/home/claude/test/shots/access84_diesel.png' });
  ok('   no script error, no "You do not have access" from the server', !D.errs.length && !D.denied.length, { errs: D.errs, denied: D.denied });
  await D.ctx.close();

  // 3. a user with Log Book View only
  E(await api('saveUserAdmin', { isNew: true, email: 'u84lb@rcl.test', name: 'U84 LB', active: true, admin: false, perms: { 'Log Book': 'View' }, newPassword: 'Temp#lb1' }));
  const l2 = await post({ fn: 'login', args: ['u84lb@rcl.test', 'Temp#lb1'] }); await post({ fn: 'changePassword', args: [l2.result.token, 'Temp#lb1', 'Own#lb2468'] });
  const L = await session('u84lb@rcl.test', 'Own#lb2468');
  ok('Log Book (View) user signs in: he lands on a Log Book page, no "You do not have access"', /^(log|logedit|tankcheck)$/.test(L.start.tab || '') && !L.denied.length, { start: L.start, denied: L.denied });
  r = await search(L.f, 'n84-jcb');
  const lm = r.items.find(x => x.t === 'N84-JCB');
  ok('Log Book (View) user: the machinery with only "Log Book"; no diesel issue of it', lm && lm.chips.join() === 'Log Book' && r.groups.indexOf('Diesel issues') === -1, r);
  await L.f.evaluate(() => { const it = [...$('gs_list').querySelectorAll('.gs-item')].find(x => x.querySelector('b').textContent === 'N84-JCB'); it.click(); }); await wait(2500);
  ok('   the machinery result opens the Log Book (not the Diesel Issue)', await L.f.evaluate(() => S.curTab) === 'log');
  ok('   no script error, no "You do not have access" from the server', !L.errs.length && !L.denied.length, { errs: L.errs, denied: L.denied });
  await L.ctx.close();

  await b.close(); clean();
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (x) {} process.exit(1); });
