// LOCAL TEST RIG ONLY – update-187: back-dated entries only by the Admin and the Super Admin. A user (not Admin): only today's
// entries, the Log Book also yesterday's – refused by the server (api) and offered so by the page's date boxes; the Admin any day.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const ist = n => { const d = new Date(Date.now() + 330 * 60000 + n * 86400000); return d.toISOString().slice(0, 10); };
const T0 = ist(0), Y1 = ist(-1), Y2 = ist(-2), dmy = d => d.slice(8, 10) + '-' + d.slice(5, 7) + '-' + d.slice(0, 4);
const RULE = /a user enters only (today's entries|the Log Book of today and yesterday) – an entry of an earlier day is made, changed or deleted only by the Admin or the Super Admin\./;
const said = r => JSON.stringify(r && (r.error || (r.result && (r.result.errors || r.result.error || r.result.warning)) || r.result || r)).slice(0, 400);
(async () => {
  const A = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = (tk, fn, ...args) => post({ fn: 'api', args: [tk, fn, args] });
  const who = isNew => ({ isNew: isNew, email: 'clerk187@rcl.test', name: 'Clerk 187', active: true, admin: false, newPassword: 'Audit#PassView9!x', perms: { 'Dashboard': 'View', 'Diesel Issue': 'Edit', 'Diesel Inward': 'Edit', 'Log Book': 'Edit' } });
  let mk = await api(A, 'saveUserAdmin', who(true));
  if (mk.error) mk = await api(A, 'saveUserAdmin', who(false));      // (run again on the same copy: his password given again)
  ok('a user who is not Admin made (Diesel Issue, Inward, Log Book: Edit)', mk.result && !mk.error, mk.error || mk.result);
  // (a password given by the Admin is changed by the person first – as every new user)
  const first = (await post({ fn: 'login', args: ['clerk187@rcl.test', 'Audit#PassView9!x'] })).result;
  if (first && first.mustChange) await post({ fn: 'changePassword', args: [first.token, 'Audit#PassView9!x', 'Clerk#187-Rig!Pass'] });
  const PW = first && first.mustChange ? 'Clerk#187-Rig!Pass' : 'Audit#PassView9!x';
  const U = (await post({ fn: 'login', args: ['clerk187@rcl.test', PW] })).result.token;
  const init = (await api(U, 'getInit')).result;
  // (the copy may have no machinery: one is made by the Admin)
  await api(A, 'saveMaster', { no: 'T187-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rig Vendor 187', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: ist(-40) }, 'add');
  const ai = (await api(A, 'getInit')).result || {}, ms = (init.master && init.master.length ? init.master : ai.master) || [];
  const loc = (init.locations || ai.locations || [])[0], m = ms.find(x => x.status !== 'Inactive' && /KM/.test(String(x.unit || 'KM'))) || ms[0];
  ok('the site\'s lists for him', !!loc && !!m, { loc: loc, m: m && (m.id || m.no) });
  const inward = d => ({ date: d, shift: 'Day', location: loc, qty: 10, rate: 90, billNo: 'T187-' + d, supplier: 'Rig Pump 187', remark: 'update-187 rig' });
  // the server: a user – only today; the Log Book also yesterday
  let r = await api(U, 'saveInward', inward(Y1));
  ok('a user: Diesel Inward of yesterday refused – said why', RULE.test(said(r)) && /today's entries/.test(said(r)) && said(r).includes(dmy(Y1)), said(r));
  r = await api(U, 'saveInward', inward(T0));
  ok('a user: Diesel Inward of today – not refused for its date', !RULE.test(said(r)), said(r));
  const row = (d, k) => ({ rows: [{ date: d, shift: 'Day', no: m.id || m.no, mode: 'KM', openingKm: k, closingKm: k + 30 }] });
  r = await api(U, 'saveLogRows', row(Y2, 900100));
  ok('a user: Log Book of 2 days back refused – said why', /the Log Book of today and yesterday/.test(said(r)), said(r));
  r = await api(U, 'saveLogRows', row(Y1, 900200));
  ok('a user: Log Book of yesterday – not refused for its date', !RULE.test(said(r)), said(r));
  // the Admin: any day
  r = await api(A, 'saveInward', inward(ist(-5)));
  ok('the Admin: Diesel Inward of 5 days back – not refused for its date', !RULE.test(said(r)), said(r));
  // the page: his date boxes offer only today (the Log Book also yesterday); the same words before it is sent
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
    const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(900);
    let f = p.frames().find(x => x !== p.mainFrame());
    await f.type('#lg_email', 'clerk187@rcl.test'); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(7000);
    f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    const box = (id, v) => f.evaluate((a, val, today) => {
      const el = document.getElementById(a); if (!el) return { none: a };
      el.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); const lim = { min: el.min, max: el.max, title: el.title };
      el.value = val; const msg = liveMsg(el); el.value = today; return Object.assign(lim, { msg: msg });
    }, id, v, T0);
    await f.evaluate(() => showTab('diesel')); await wait(1500);
    let x = await box('d_date', Y1);
    ok('his Diesel Issue date: only today offered; yesterday refused there with the server\'s words', x.min === T0 && x.max === T0 && RULE.test(x.msg || '') && /today's entries/.test(x.msg), x);
    x = await box('i_date', Y1);
    ok('his Diesel Inward date: only today', x.min === T0 && x.max === T0 && RULE.test(x.msg || ''), x);
    await f.evaluate(() => showTab('log')); await wait(1800);
    await f.evaluate(() => { try { setLgMode('date'); } catch (e) {} }); await wait(600);
    x = await box('lg_top_date', Y2);
    ok('his Log Book date: today or yesterday; 2 days back refused there', x.min === Y1 && x.max === T0 && /the Log Book of today and yesterday/.test(x.msg || ''), x);
    const yok = await f.evaluate((y, t) => { const el = document.getElementById('lg_top_date'); el.value = y; const m = liveMsg(el); el.value = t; return m; }, Y1, T0);
    ok('…yesterday allowed there', !yok || !RULE.test(yok), yok);
    await Promise.race([p.screenshot({ path: (process.env.SHOT_DIR || '.') + '/today187_user.png' }).catch(() => {}), wait(20000)]);
    // the Admin: no limit on the box
    const p2 = await b.newPage(); await p2.setViewport({ width: 1536, height: 900 });
    await p2.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(900);
    let g = p2.frames().find(x => x !== p2.mainFrame());
    await g.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await g.type('#lg_email', 'sujit@rcl.test'); await g.type('#lg_pass', 'Nashik#Road848!'); await g.click('#lg_btn'); await wait(7000);
    g = p2.frames().find(x => x !== p2.mainFrame());
    await g.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); }); await wait(1500);
    const ax = await g.evaluate((y) => { const el = document.getElementById('d_date'); el.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); const r = { min: el.min }; el.value = y; r.msg = liveMsg(el); return r; }, ist(-5));
    ok('the Admin: his date box any day back; no refusal', !ax.min && !(ax.msg && RULE.test(ax.msg)), ax);
    ok('no page error', errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(out.join('\n')); console.log('TOTAL ' + pass + ' passed, ' + fail + ' failed');
  require('fs').writeFileSync('/tmp/today187.out', out.join('\n') + '\nTOTAL ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack); process.exit(1); });
