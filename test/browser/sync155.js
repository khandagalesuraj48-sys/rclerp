// update-155 (asked 24-10-2026: Smart Cache, Smart Data Sync, Realtime): another person's save on an open list within about
// 2 seconds; the list kept by "the same" / only-what-changed answers is exactly a fresh page's list; a page that was offline gets
// everything it missed (new, changed, deleted) when it is back; two people saving at the same moment – each entry once, a save
// sent twice saved once; access taken away – no answer, kept or new, reaches the page; sign-out empties the page's memory.
// Two app servers (:3000 the pages, :3001 the other person) – the memory of answers is per server, as on Vercel.
// On the local rig only.   node sync155.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const P = 'http://127.0.0.1:3000', O = 'http://127.0.0.1:3001';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from diesel_issue where machinery like 'N155-%'; delete from log_book where machinery like 'N155-%'; delete from master where id like 'N155-%'; delete from log_book where machinery like 'N155-%'; delete from activity_log where email = 'u155@rcl.test'; delete from app_users where id = 'u155@rcl.test'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async (base, body) => { for (let i = 0; ; i++) { try { return await (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post(O, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post(O, { fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  let rn = 0; const saveOnce = async d => { const r = await post(O, { fn: 'api', args: [tk, 'saveDieselIssue', [d]], rid: 's155' + Date.now().toString(36) + (rn++) }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  for (let k = 1; k <= 3; k++) E(await api('saveMaster', { no: 'N155-L' + k, name: 'Loader ' + k, type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 300, owner: 'N155 Owner', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  for (let k = 1; k <= 9; k++) E(await api('saveMaster', { no: 'N155-T' + k, name: 'Tipper ' + k, type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 300, owner: 'N155 Owner', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveDieselIssue', { date: '2026-10-03', shift: 'Day', source: 'Dispenser', no: 'N155-T9', qty: 20, kmReading: 500, driver: 'N155-DRV-0', force: true }));
  // a list of the size a site has (the audit's lists were 100 – 380 KB): 90 more issues of other machinery in October
  for (let k = 0; k < 90; k++) { const r = await api('saveDieselIssue', { date: '2026-10-' + String(1 + (k % 22)).padStart(2, '0'), shift: k % 2 ? 'Night' : 'Day', source: 'Dispenser', no: 'N155-T9', qty: 5 + (k % 9), kmReading: 600 + k * 10, driver: 'N155-BULK-' + k, remark: 'seed row ' + k + ' for the list size', force: true }); if (r && r.ERROR) { seedErr.push('bulk ' + k + ': ' + r.ERROR.slice(0, 120)); break; } }
  E(await api('saveUserAdmin', { isNew: true, email: 'u155@rcl.test', name: 'U155 Diesel', active: true, admin: false, perms: { 'Diesel Issue': 'Edit' }, newPassword: 'Temp#u155a' }));
  const l0 = await post(P, { fn: 'login', args: ['u155@rcl.test', 'Temp#u155a'] }); E(l0.error ? { ERROR: l0.error } : null);
  if (l0.result) await post(P, { fn: 'changePassword', args: [l0.result.token, 'Temp#u155a', 'Own#u155b2468'] });
  ok('test data: 9 tippers N155-T1…T9, 91 diesel issues, a user u155 with only "Diesel Issue: Edit"', !seedErr.length, seedErr.join(' // ') || 'ready');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  const open = async (email, pw) => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(); await p.setViewport({ width: 1600, height: 1000 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    const calls = []; p.on('request', q => { if (/\/api\/rpc/.test(q.url())) { try { const j = JSON.parse(q.postData() || '{}'); calls.push({ fn: j.fn === 'api' ? j.args[1] : j.fn, have: !!j.have, m: j.m === 1, t: Date.now() }); } catch (e) {} } });
    const sizes = []; p.on('response', async r => { if (/\/api\/rpc/.test(r.url())) { try { const t = await r.text(); let fn = '?'; try { const j = JSON.parse(r.request().postData() || '{}'); fn = j.fn === 'api' ? j.args[1] : j.fn; } catch (e) {} sizes.push({ fn: fn, n: t.length, kind: /^\{"h":"[0-9a-f]+","same"/.test(t) ? 'same' : /"delta":/.test(t.slice(0, 120)) ? 'delta' : 'full' }); } catch (e) {} } });
    await p.goto(P + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(em => { try { localStorage.setItem('oc_brief_' + em, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', pw); await f.click('#lg_btn'); await wait(6000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__t = []; const o = window.toast; window.toast = function (m) { window.__t.push(String(m)); return o.apply(this, arguments); }; });
    return { p, f, ctx, calls, sizes }; };
  const listText = f => f.evaluate(() => ({ rows: [...document.querySelectorAll('#d_rows tr')].map(tr => '|' + [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()).join('|') + '|'), sum: document.getElementById('d_sum').textContent.replace(/\s+/g, ' ').trim() }));
  const watch = (f, sel) => f.evaluate(sel => { window.__seen = {}; window.__want = []; const el = document.querySelector(sel);
    const look = () => { const t = el.textContent; (window.__want || []).forEach(m => { if (!window.__seen[m] && t.indexOf(m) > -1) window.__seen[m] = Date.now(); }); };
    new MutationObserver(look).observe(el, { childList: true, subtree: true, characterData: true }); }, sel);
  const want = (f, m) => f.evaluate(m => { window.__want.push(m); }, m);
  const seenAt = async (f, m, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const t = await f.evaluate(m => window.__seen[m] || 0, m); if (t) return t; await wait(100); } return 0; };
  const memo = f => f.evaluate(() => window.__rclMemo ? window.__rclMemo() : null);
  const nudge = async p => { try { await p.mouse.move(300 + Math.round(Math.random() * 200), 400); } catch (e) {} };

  // ---------- 1. User B (Diesel Issue only) on the Diesel Issue list; User A saves on the other server ----------
  const B = await open('u155@rcl.test', 'Own#u155b2468');
  const bTab = await B.f.evaluate(() => S.curTab);
  await B.f.evaluate(() => { $('df_from').value = '2026-10-01'; $('df_to').value = S.today; loadDiesel(); }); await wait(2500);
  await watch(B.f, '#d_rows');
  const lat = [];
  for (let k = 1; k <= 6; k++) {
    const m = 'N155-DRV-' + k; await want(B.f, m); await nudge(B.p);
    // (an entry of today – most entries are of today: the list's rows before it do not change; one of a past date changes the
    //  running balance of every later row, and is then sent whole – see part 3)
    const r = await saveOnce({ date: TODAY, shift: 'Day', source: 'Dispenser', no: 'N155-T' + k, qty: 10 + k, kmReading: 1000 + k, driver: m, force: true });
    const t1 = Date.now(); if (!r || r.ERROR || r.ok === false) { lat.push(99999); out.push('save ' + k + ': ' + JSON.stringify(r).slice(0, 200)); continue; }
    const at = await seenAt(B.f, m, 10000); lat.push(at ? at - t1 : 99999);
    await wait(5000 + Math.round(Math.random() * 1500));
  }
  ok('B is on the Diesel Issue list (his only page)', bTab === 'diesel', bTab);
  ok('A saves 6 diesel issues (one every ~7 s, on the other server): each one shows on B\'s list – median ≤ 2.0 s, none later than 3.5 s', lat.every(x => x <= 3500) && median(lat) <= 2000, { ms: lat, median: median(lat) });
  const mB = await memo(B.f);
  ok('   the list came as "only what changed" or "the same" – not whole – after the first load', mB && mB.delta >= 4 && mB.same >= 5, mB);
  const dsz = B.sizes.filter(x => x.fn === 'getDieselIssues');
  ok('   the list\'s answers: the first whole, the reloads a small part of it', dsz.length >= 7 && dsz.slice(1).filter(x => x.kind !== 'full').length >= 5 && Math.max(...dsz.slice(1).filter(x => x.kind === 'delta').map(x => x.n)) < dsz[0].n / 3, dsz.map(x => x.kind + ' ' + x.n));
  const sz = B.sizes.filter(x => x.fn === 'sync');
  ok('   the heartbeat: nearly all "the same" (a few bytes) while nothing new is in it', sz.length > 10 && sz.filter(x => x.kind === 'same').length >= sz.length * 0.6 && sz.filter(x => x.kind === 'same').every(x => x.n < 80), { n: sz.length, same: sz.filter(x => x.kind === 'same').length, sizes: [...new Set(sz.map(x => x.n))].slice(0, 8) });

  // ---------- 1b. the Admin on the Log Book page; A saves Log Book rows of today on the other server ----------
  const D = await open('sujit@rcl.test', 'Nashik#Road848!');
  await D.f.evaluate(() => { showTab('log'); }); await wait(3500);
  await watch(D.f, '#l_rows');
  const latL = [];
  for (let k = 1; k <= 3; k++) {
    const m = 'N155-L' + k; await want(D.f, m); await nudge(D.p);
    const r = await api('saveLogRows', { rows: [{ no: m, date: TODAY, shift: 'Full Day', mode: 'KM', openingKm: 100 * k, closingKm: 100 * k + 40, openingDiesel: 0 }] });
    const t1 = Date.now(); if (!r || r.ERROR || r.ok === false) { latL.push(99999); out.push('log save ' + k + ': ' + JSON.stringify(r).slice(0, 200)); continue; }
    const at = await seenAt(D.f, m, 10000); latL.push(at ? at - t1 : 99999);
    await wait(5000 + Math.round(Math.random() * 1500));
  }
  ok('the Admin on the Log Book page; A saves 3 Log Book rows of today (other server): each one shows on his list – median ≤ 2.0 s, none later than 3.5 s', latL.every(x => x <= 3500) && median(latL) <= 2000, { ms: latL, median: median(latL) });
  await D.ctx.close();

  // ---------- 2. what B shows = what a fresh page shows = the server's whole answer ----------
  const C = await open('u155@rcl.test', 'Own#u155b2468');
  await C.f.evaluate(() => { $('df_from').value = '2026-10-01'; $('df_to').value = S.today; loadDiesel(); }); await wait(3000);
  const lb = await listText(B.f), lc = await listText(C.f);
  ok('B\'s list (kept up to date by changes) is exactly a freshly opened page\'s list – every row, the totals', JSON.stringify(lb) === JSON.stringify(lc) && lb.rows.length >= 7, { B: lb.rows.length, C: lc.rows.length, sumB: lb.sum, sumC: lc.sum });
  const btk = await B.f.evaluate(() => S.token);
  const viaPage = await B.f.evaluate(() => new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(e => r({ ERR: String(e) })).api(S.token, 'getDieselIssues', [dieselFilter()])));
  const f0 = await B.f.evaluate(() => dieselFilter());
  const whole = await post(P, { fn: 'api', args: [btk, 'getDieselIssues', [f0]], site: '' });
  ok('   the answer the page rebuilt is the server\'s whole answer, value for value', JSON.stringify(viaPage) === JSON.stringify(whole.result), { page: JSON.stringify(viaPage).length, server: JSON.stringify(whole.result || whole).length });

  // ---------- 3. B offline: new, changed and deleted entries while he is away; back online → all of it ----------
  const ids = {}; ['N155-DRV-1', 'N155-DRV-2'].forEach(m => { ids[m] = sql("select id from diesel_issue where driver_name = '" + m + "'"); });
  await B.p.setOfflineMode(true); await wait(2500);
  const offLive = await B.f.evaluate(() => document.getElementById('live_dot').textContent.trim());
  E(await saveOnce({ date: '2026-10-12', shift: 'Day', source: 'Dispenser', no: 'N155-T7', qty: 17, kmReading: 1007, driver: 'N155-DRV-OFF1', force: true }));
  E(await saveOnce({ date: '2026-10-13', shift: 'Night', source: 'Dispenser', no: 'N155-T8', qty: 18, kmReading: 1008, driver: 'N155-DRV-OFF2', force: true }));
  E(await api('updateDieselIssue', ids['N155-DRV-1'], { date: '2026-10-05', shift: 'Day', source: 'Dispenser', no: 'N155-T1', qty: 11, kmReading: 1001, driver: 'N155-DRV-CHANGED', force: true }));
  E(await api('deleteDieselIssue', ids['N155-DRV-2']));
  await wait(3000);
  const tOn = Date.now(); await B.p.setOfflineMode(false); await nudge(B.p);
  let caught = 0; for (let i = 0; i < 80; i++) { const t = await listText(B.f); const s = t.rows.join(' | '); if (s.indexOf('|N155-DRV-OFF1|') > -1 && s.indexOf('|N155-DRV-OFF2|') > -1 && s.indexOf('|N155-DRV-CHANGED|') > -1 && s.indexOf('|N155-DRV-2|') === -1 && s.indexOf('|N155-DRV-1|') === -1) { caught = Date.now() - tOn; break; } await wait(250); }
  ok('B offline ("Reconnecting…"); A adds 2, changes 1 and deletes 1 meanwhile; B back online: all four on his list (no reload)', /Reconnecting/.test(offLive) && caught > 0 && caught < 8000, { live: offLive, ms: caught || 'not in 20 s' });
  await C.f.evaluate(() => loadDiesel()); await wait(2500);
  const lb2 = await listText(B.f), lc2 = await listText(C.f);
  ok('   and his list is again exactly a fresh page\'s list', JSON.stringify(lb2) === JSON.stringify(lc2), { B: lb2.rows.length, C: lc2.rows.length });

  // ---------- 4. two people save at the same moment; a save sent twice ----------
  const both = await Promise.all([
    B.f.evaluate(() => new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(e => r({ ERR: String(e) })).api(S.token, 'saveDieselIssue', [{ date: '2026-10-14', shift: 'Day', source: 'Dispenser', no: 'N155-T3', qty: 13, kmReading: 1103, driver: 'N155-DRV-BB', force: true }]))),
    saveOnce({ date: '2026-10-14', shift: 'Day', source: 'Dispenser', no: 'N155-T4', qty: 14, kmReading: 1104, driver: 'N155-DRV-AA', force: true })]);
  const cnt = m => Number(sql("select count(*) from diesel_issue where driver_name = '" + m + "'"));
  ok('A and B save at the same moment (two servers): both saved, each once', both.every(x => x && x.ok !== false && !x.ERR && !x.ERROR) && cnt('N155-DRV-BB') === 1 && cnt('N155-DRV-AA') === 1, { both: both.map(x => JSON.stringify(x).slice(0, 120)), BB: cnt('N155-DRV-BB'), AA: cnt('N155-DRV-AA') });
  const rid = 's155dup' + Date.now().toString(36), body = { fn: 'api', args: [tk, 'saveDieselIssue', [{ date: '2026-10-15', shift: 'Day', source: 'Dispenser', no: 'N155-T5', qty: 15, kmReading: 1105, driver: 'N155-DRV-DUP', force: true }]], rid: rid };
  const dup = await Promise.all([post(P, body), post(O, body)]); await wait(1500); const again = await post(O, body);
  ok('   the same save (same number) sent to both servers at once and once more later: one entry', cnt('N155-DRV-DUP') === 1 && [...dup, again].every(x => !x.error), { rows: cnt('N155-DRV-DUP'), answers: [...dup, again].map(x => JSON.stringify(x).slice(0, 100)) });
  await wait(4000);
  const lb3 = await listText(B.f);
  ok('   B\'s list shows both new entries once', lb3.rows.filter(r => /\|N155-DRV-BB\|/.test(r)).length === 1 && lb3.rows.filter(r => /\|N155-DRV-AA\|/.test(r)).length === 1 && lb3.rows.filter(r => /\|N155-DRV-DUP\|/.test(r)).length === 1, lb3.rows.filter(r => /N155-DRV-(BB|AA|DUP)/.test(r)));

  // ---------- 5. access taken away: nothing kept or new reaches B ----------
  const hq = { fn: 'api', args: [btk, 'getDieselIssues', [f0]], m: 1 };
  const h0 = await post(P, hq);
  E(await api('saveUserAdmin', { isNew: false, email: 'u155@rcl.test', name: 'U155 Diesel', active: true, admin: false, perms: { 'Diesel Issue': 'None', 'Log Book': 'View' } }));
  let gone = false; for (let i = 0; i < 40 && !gone; i++) { await wait(250); gone = await B.f.evaluate(() => $('sec-diesel').hidden || $('tab-diesel').hidden); }
  const said = await B.f.evaluate(() => (window.__t || []).join(' | '));
  ok('Admin takes Diesel Issue away from B: within seconds the page is gone from his screen and he is told', gone && /access was updated/i.test(said), { gone, said });
  const h1 = await post(P, Object.assign({}, hq, { have: h0.h, dx: 1 }));
  ok('   B asks with the fingerprint of the list he had: refused – no "same", no change, no rows', !!h0.h && /do not have access/i.test(String(h1.error || '')) && !('same' in h1) && !('delta' in h1) && !('result' in h1), { before: Object.keys(h0), after: h1 });
  const viaPage2 = await B.f.evaluate(() => new Promise(r => google.script.run.withSuccessHandler(x => r({ GOT: !!x })).withFailureHandler(e => r({ ERR: String(e && e.message || e) })).api(S.token, 'getDieselIssues', [dieselFilter()])));
  ok('   the page itself asking the same question: refused (the page\'s memory is not used for it)', /do not have access/i.test(String(viaPage2.ERR || '')), viaPage2);
  E(await api('saveUserAdmin', { isNew: false, email: 'u155@rcl.test', name: 'U155 Diesel', active: true, admin: false, perms: { 'Diesel Issue': 'Edit' } }));
  await wait(3500);
  const back = await B.f.evaluate(() => !$('tab-diesel').hidden);
  ok('   access given back: the page is there again', back, back);

  // ---------- 6. sign-out: the page's memory is empty; nothing of it in the browser's storage ----------
  const before = await memo(B.f);
  const stored = await B.f.evaluate(() => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); for (let i = 0; i < sessionStorage.length; i++) ks.push('s:' + sessionStorage.key(i)); return ks.map(k => k + '=' + String(k.indexOf('s:') === 0 ? sessionStorage.getItem(k.slice(2)) : localStorage.getItem(k)).length); });
  ok('   no list or answer is kept in the browser\'s storage (only the page\'s own small notes)', !stored.some(x => /N155|getDiesel/.test(x)) && await B.f.evaluate(() => { const all = JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)); return all.indexOf('N155-DRV') === -1; }), stored);
  await B.f.evaluate(() => new Promise(r => google.script.run.withSuccessHandler(r).withFailureHandler(r).logout(S.token)));
  const after = await memo(B.f);
  ok('B signs out: the page\'s memory of answers is empty', before && before.answers > 0 && after && after.answers === 0, { before, after });

  ok('no script error on the pages', !errs.length, errs);
  await b.close();
  try { clean(); } catch (e) { /* the next run cleans */ }
  out.forEach(l => console.log(l)); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(0);
})().catch(e => { out.forEach(l => console.log(l)); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
