// LOCAL TEST RIG ONLY – update-189: a page's 4th access "Admin" (a page with a date) – Edit, and that page's entries of an earlier day.
// A user with Diesel Inward = Admin and Log Book = Edit: an inward of 5 days back not refused for its date, a Log Book of 3 days back
// refused; his inward date box any day, his Diesel Issue date box only today; Users & Access offers Admin on the pages with a date.
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
  const who = isNew => ({ isNew: isNew, email: 'clerk189@rcl.test', name: 'Clerk 189', active: true, admin: false, newPassword: 'Audit#PassView9!x', perms: { 'Dashboard': 'View', 'Diesel Issue': 'Edit', 'Diesel Inward': 'Admin', 'Log Book': 'Edit', 'Reports': 'Admin' } });
  let mk = await api(A, 'saveUserAdmin', who(true));
  if (mk.error) mk = await api(A, 'saveUserAdmin', who(false));
  ok('a user made: Diesel Inward = Admin, Diesel Issue and Log Book = Edit (Reports "Admin" – a page without a date – kept as Edit)', mk.result && !mk.error, mk.error || mk.result);
  const ua = (await api(A, 'usersAdmin')).result || {}, me = (ua.users || []).find(u => u.email === 'clerk189@rcl.test') || {};
  ok('Users & Access: Admin on Diesel Inward, Edit on Reports; the pages with a date offer Admin', me.perms && me.perms['Diesel Inward'] === 'Admin' && me.perms.Reports === 'Edit' &&
    (ua.modules || []).filter(m => m.dateAdmin).map(m => m.key).sort().join(',') === ['Breakdown', 'Diesel Inward', 'Diesel Issue', 'Diesel Transfer', 'Log Book', 'Maintenance'].join(','), { perms: me.perms, mods: (ua.modules || []).filter(m => m.dateAdmin).map(m => m.key) });
  const first = (await post({ fn: 'login', args: ['clerk189@rcl.test', 'Audit#PassView9!x'] })).result;
  if (first && first.mustChange) await post({ fn: 'changePassword', args: [first.token, 'Audit#PassView9!x', 'Clerk#189-Rig!Pass'] });
  const PW = first && first.mustChange ? 'Clerk#189-Rig!Pass' : 'Audit#PassView9!x';
  const U = (await post({ fn: 'login', args: ['clerk189@rcl.test', PW] })).result.token;
  const init = (await api(U, 'getInit')).result || {};
  ok('his sign-in says his Admin page (pageAdmin) – and Edit for every check', JSON.stringify(init.user && init.user.pageAdmin) === '["Diesel Inward"]' && init.user.perms['Diesel Inward'] === 'Edit', init.user);
  await api(A, 'saveMaster', { no: 'T189-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rig Vendor 189', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: ist(-40) }, 'add');
  const ai = (await api(A, 'getInit')).result || {}, ms = ai.master || [], loc = (init.locations || ai.locations || [])[0], m = ms.find(x => x.status !== 'Inactive') || ms[0];
  const inward = d => ({ date: d, shift: 'Day', location: loc, qty: 10, rate: 90, billNo: 'T189-' + d, supplier: 'Rig Pump 189', remark: 'update-189 rig' });
  let r = await api(U, 'saveInward', inward(ist(-5)));
  ok('Diesel Inward Admin: an inward of 5 days back – not refused for its date', !RULE.test(said(r)), said(r));
  const row = (d, k) => ({ rows: [{ date: d, shift: 'Day', no: m.id || m.no, mode: 'KM', openingKm: k, closingKm: k + 30 }] });
  r = await api(U, 'saveLogRows', row(ist(-3), 910100));
  ok('Log Book Edit: 3 days back refused – said why', /the Log Book of today and yesterday/.test(said(r)), said(r));
  // the page
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
    const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(900);
    let f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await f.type('#lg_email', 'clerk189@rcl.test'); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(7000);
    f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); }); await wait(1500);
    const box = (id, v) => f.evaluate((a, val, today) => { const el = document.getElementById(a); if (!el) return { none: a };
      el.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); const lim = { min: el.min, max: el.max }; el.value = val; const msg = liveMsg(el); el.value = today; return Object.assign(lim, { msg: msg }); }, id, v, T0);
    let x = await box('i_date', ist(-5));
    ok('his Diesel Inward date box: any day (Admin of the page) – no refusal there', !x.min && !(x.msg && RULE.test(x.msg)), x);
    x = await box('d_date', Y1);
    ok('his Diesel Issue date box: only today (Edit) – yesterday said there', x.min === T0 && x.max === T0 && RULE.test(x.msg || ''), x);
    ok('no page error', errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(out.join('\n')); console.log('TOTAL ' + pass + ' passed, ' + fail + ' failed');
  require('fs').writeFileSync('/tmp/page189.out', out.join('\n') + '\nTOTAL ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack); process.exit(1); });
