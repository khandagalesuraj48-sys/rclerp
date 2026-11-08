// update-118 (the sender sees his entries in verification and reminds the approver) in the browser, on the local rig started with
// PORTAL=1 (Mechanical :3001 own sign-in, :3000 linked to the Portal :3010; site S1). Test data only (two users, diesel inward of
// "R118", the site's rules), all taken out / put back at the end.
//   1. the Super Admin's rule: Diesel Inward → Checker 118. Unticking it with the person still picked: asked first ("Ticked off,
//      but people are picked"), Cancel = nothing saved;
//   2. the maker's 2 inward entries are sent; on his Diesel Inward page and on his Dashboard: "My entries in verification" with
//      both waiting at Checker 118;
//   3. the checker's page is open on Approvals; the maker presses "Remind" on one → "Reminder sent"; the checker's open page says
//      "Reminder from Maker 118 …" by itself and his row "Reminded 1× by Maker 118";
//   4. "Remind all waiting (2)": the other one goes, the first one waits 5 minutes (said so);
//   5. the checker approves one → the maker's box shows it "Approved – saved" by itself; no page error.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node remind118.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!', SHOT = process.env.SHOTS || '/tmp';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from diesel_inward where bill_number like 'R118%'; delete from billed_changes where kind = 'Flow' and requester_email in ('mk118@rcl.test');" +
    "delete from app_users where email in ('mk118@rcl.test', 'ck118@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const errs = [];
  let b = null;
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_inward, perm_dashboard) select 'mk118', 'mk118@rcl.test', password_hash, 'Maker 118', 'Yes', 'No', 'Edit', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck118', 'ck118@rcl.test', password_hash, 'Checker 118', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    // the Super Admin (Portal ticket) – his rule
    let lr = null; for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: p }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const ticket = async () => ((await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' })).headers.get('location') || '').split('#sso=')[1] || '';
    const sa = (await post(SA, { fn: 'ssoLogin', args: [await ticket()] })).result.token;
    const SAJ = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const rr = await SAJ('saveFlowRules', { tasks: { 'Diesel Inward': { on: true, levels: [['ck118@rcl.test']] } } });
    ok('seed: users Maker 118 (Diesel Inward: Edit, Dashboard) and Checker 118; the rule Diesel Inward → Checker 118', rr && rr.ok, rr);
    // the maker sends 2 inward entries
    const mk = (await post(U, { fn: 'login', args: ['mk118@rcl.test', PW] })).result.token;
    const MJ = async (fn, ...a) => { const r = await post(U, { fn: 'api', args: [mk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await MJ('getInit')).today;
    const s1 = await MJ('saveInward', { date: today, location: 'Dispenser', pump: 'Pump 118', qty: 500, rate: 92, billNo: 'R118-1', billDate: today });
    const s2 = await MJ('saveInward', { date: today, location: 'Dispenser', pump: 'Pump 118', qty: 700, rate: 92, billNo: 'R118-2', billDate: today });
    const v1 = ((s1.ERROR || '').match(/VF-\d{5}/) || [])[0], v2 = ((s2.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('2. the maker\'s 2 inward entries are sent for verification (' + v1 + ', ' + v2 + ')', !!v1 && !!v2, [s1, s2]);

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const open = async (url, email) => {
      const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(email + ': ' + String(e.message).slice(0, 200)));
      await p.goto(url, { waitUntil: 'load' });
      const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
      if (email) { const f = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
        await f.type('#lg_email', email); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(6000); }
      const F = await find(() => typeof S === 'object' && !!S.user);
      try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); } catch (e) {}
      return { p, F };
    };
    // ---- 1. the rules panel: unticked with the person picked → asked ----
    const A = await open(SA + '/#sso=' + await ticket(), null);
    await A.F.evaluate(() => showTab('approvals')); await wait(3500);
    await A.F.evaluate(() => { const t = document.querySelector('#fr_list .fr-task[data-m="Diesel Inward"]'); t.querySelector('.fr-on').click(); $('fr_save').click(); }); await wait(1200);
    const ask = await A.F.evaluate(() => ({ open: !$('cf_back').hidden, title: ($('cf_title') || {}).textContent || '', text: $('cf_box').textContent }));
    await A.F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(800);
    const keptOn = JSON.parse(sql("select value from app_settings where id = 'FLOW_RULES'") || '{}').tasks['Diesel Inward'].on;
    ok('1. the Super Admin unticks Diesel Inward with Checker 118 still picked → asked "Ticked off, but people are picked"; Cancel: nothing saved', ask.open && /Ticked off, but people are picked/.test(ask.title + ask.text) && /Diesel Inward/.test(ask.text) && keptOn === true, { ask, keptOn });
    // ---- the checker's page, left open on Approvals ----
    const C = await open(U + '/', 'ck118@rcl.test');
    await C.F.evaluate(() => showTab('approvals')); await wait(2500);
    // ---- 2. the maker's pages ----
    const Mk = await open(U + '/', 'mk118@rcl.test');
    await Mk.F.evaluate(() => showTab('inward')); await wait(3000);
    const box = () => Mk.F.evaluate(() => { const x = $('fv_inward'); return x ? { shown: !x.hidden, head: (x.querySelector('.fv-head') || {}).textContent || '', rows: [...x.querySelectorAll('.fv-t tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()), btns: [...x.querySelectorAll('[data-fvr]')].map(b2 => b2.dataset.fvr) } : null; });
    let bx = await box();
    ok('2. his Diesel Inward page: "My entries in verification" – Waiting 2, both "at Checker 118", a "Remind" for each, "Remind all waiting (2)"',
      bx && bx.shown && /My entries in verification/.test(bx.head) && /Waiting\s*2/.test(bx.head) && /Remind all waiting \(2\)/.test(bx.head) && bx.rows.length === 2 && bx.rows.every(t => /Waiting at Checker 118/.test(t)) && bx.btns.length === 2, bx);
    await Mk.F.evaluate(() => showTab('dash')); await wait(3000);
    const dsh = await Mk.F.evaluate(() => { const x = $('fv_dash'); return x ? { shown: !x.hidden, rows: x.querySelectorAll('.fv-t tr').length, txt: x.textContent.replace(/\s+/g, ' ') } : null; });
    ok('   his Dashboard: the same 2 waiting (with the work: Diesel Inward)', dsh && dsh.shown && dsh.rows === 2 && /Diesel Inward/.test(dsh.txt), dsh);
    await Mk.F.evaluate(() => { try { $('ai_panel').hidden = true; } catch (e) {} $('fv_dash').scrollIntoView({ block: 'start' }); }); await wait(600);
    await Mk.p.screenshot({ path: SHOT + '/remind118_dash.png' });
    // ---- 3. "Remind" one ----
    await Mk.F.evaluate(() => showTab('inward')); await wait(1500);
    await Mk.F.evaluate(id => document.querySelector('#fv_inward [data-fvr="' + id + '"]').click(), v1); await wait(3500);
    const t1 = await Mk.F.evaluate(() => ({ toast: $('toast').textContent, bad: $('toast').className }));
    bx = await box();
    ok('3. "Remind" on ' + v1 + ': "' + t1.toast + '"; his row says "reminded 1×"', t1.toast === 'Reminder sent: ' + v1 + '.' && t1.bad !== 'bad' && bx.rows.some(t => t.indexOf(v1) > -1 && /reminded 1×/.test(t)), [t1, bx]);
    await Mk.F.evaluate(() => $('fv_inward').scrollIntoView({ block: 'start' })); await wait(500); await Mk.p.screenshot({ path: SHOT + '/remind118_inward.png' });
    let c1 = null; for (let i = 0; i < 30; i++) { await wait(1000); c1 = await C.F.evaluate(() => ({ toast: $('toast').textContent, rows: [...document.querySelectorAll('#cr_rows tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()) })); if (/Reminder from Maker 118/.test(c1.toast)) break; }
    ok('   the checker\'s open page says it by itself: "Reminder from Maker 118: ' + v1 + ' – waiting for your approval."; his row: "Reminded 1× by Maker 118"',
      c1.toast === 'Reminder from Maker 118: ' + v1 + ' – waiting for your approval.' && c1.rows.some(t => t.indexOf(v1) > -1 && /Reminded 1× by Maker 118/.test(t)), c1);
    await C.p.screenshot({ path: SHOT + '/remind118_checker.png' });
    // ---- 4. "Remind all waiting" ----
    await Mk.F.evaluate(() => document.querySelector('#fv_inward [data-fvall]').click()); await wait(3500);
    const t2 = await Mk.F.evaluate(() => $('toast').textContent);
    ok('4. "Remind all waiting (2)": "' + t2 + '"', new RegExp('^Reminder sent: ' + v2 + '\\. ' + v1 + ' was reminded at \\d{2}:\\d{2} – again after \\d{2}:\\d{2}\\.$').test(t2), t2);
    const steps = JSON.parse(sql("select data from billed_changes where id = '" + v1 + "'") || '{}').history || [];
    ok('   the entry keeps the step: Reminded – Maker 118 – to Checker 118', steps.some(h => h.step === 'Reminded' && h.by === 'Maker 118' && h.note === 'to Checker 118'), steps);
    // ---- 5. the checker approves one → the maker's box by itself ----
    const ck = (await post(U, { fn: 'login', args: ['ck118@rcl.test', PW] })).result.token;
    const ap = await post(U, { fn: 'api', args: [ck, 'decideChangeRequest', [{ id: v1, approve: true }]] });
    ok('5. the checker approves ' + v1, ap.result && ap.result.status === 'Approved', ap.error || ap.result);
    let b5 = null; for (let i = 0; i < 30; i++) { await wait(1000); b5 = await box(); if (b5 && b5.rows.some(t => t.indexOf(v1) > -1 && /Approved – saved/.test(t))) break; }
    ok('   the maker\'s page shows it by itself: ' + v1 + ' "Approved – saved" by Checker 118; ' + v2 + ' still waiting', b5.rows.some(t => t.indexOf(v1) > -1 && /Approved – saved Checker 118/.test(t)) && b5.rows.some(t => t.indexOf(v2) > -1 && /Waiting/.test(t)) && /Approved\s*1/.test(b5.head), b5);
    ok('   the approved inward is saved', sql("select count(*) from diesel_inward where bill_number = 'R118-1'") === '1');
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
