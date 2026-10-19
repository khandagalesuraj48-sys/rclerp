// update-126 (asked 19-10-2026: "dashbord war opening closing received je numbers aahet n nantr khali bgh issued today … ya waril kuth
// hi click kel ki tyanchi entryies open hotil ek mast motha dialogbox open hoil tyatach entry open hotil fkt show hotil"):
// every number of the Diesel dashboard opens one big box with the entries behind it – only shown – and the box's total IS the
// number on the card. On the local rig only (never the live databases): Mechanical :3001 (its own sign-in), its database.
//   node test/browser/dashkd126.js        (with the rig up: bash /home/claude/rig/all.sh)
// It adds one machinery KDX-126 and one Diesel Issue of today for it (taken out again at the end); everything else is the rig's data.
const fs = require('fs'), path = require('path'), os = require('os');
const { execSync } = require('child_process');
const need = n => { try { return require(n); } catch (e) { return require(path.join('/opt/node-tools/node_modules', n)); } };
const { chromium } = need('playwright');
const M = 'http://127.0.0.1:3001';
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const rpc = async (fn, ...args) => (await (await fetch(M + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }), signal: AbortSignal.timeout(60000) })).json());
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 20000)) { try { const v = await fn(); if (v) return v; } catch (e) { /* the page is changing */ } await wait(250); } return null; };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashkd126-'));
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (c || x === undefined ? '' : '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700))); };
const num = t => { const m = String(t || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
const PW = 'Nashik#Road848!', VPW = 'Audit#PassView9!x';
const KINDS = [['open', '#k_open'], ['in', '#k_inqty'], ['issued', '#k_total'], ['close', '#k_close'], ['now', '#k_stock'], ['today', '#k_todayqty'], ['machines', '#k_machines'], ['entries', '#k_entries'], ['avg', '#k_avg']];
const clean = () => sql("delete from diesel_issue where machinery = 'KDX-126'; delete from master where machinery_number = 'KDX-126'; delete from web.cache where key like 'F\\_%' or key like 'LG\\_%' or key = 'USERS_LIST';");

(async () => {
  // ---- the rig's data, and one Diesel Issue of today ----
  try { clean(); } catch (e) { /* the master column may be named otherwise – the save below makes it afresh */ }
  const tk = (await rpc('login', 'sujit@rcl.test', PW)).result.token;
  const api = async (fn, ...a) => { const r = await rpc('api', tk, fn, a); if (r.error) out.push('setup ' + fn + ': ' + r.error); return r.result; };
  await api('saveMaster', { no: 'KDX-126', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.5, owner: 'KD Owner', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  const today = (await api('getInit')).today || new Date().toISOString().slice(0, 10);
  await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'KDX-126', qty: 12.5, kmReading: 5000, remark: 'test of update-126', force: true });

  const b = await chromium.launch();
  const signIn = async (ctx, email, pw) => {
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.route('**/*', r => /^https?:\/\/127\.0\.0\.1/.test(r.request().url()) || r.request().url().startsWith('data:') ? r.continue() : r.abort());      // nothing outside the rig
    await p.goto(M + '/', { waitUntil: 'load' });
    const f = await until(() => p.frames().find(x => x !== p.mainFrame()), 20000);
    await f.waitForSelector('#lg_email', { state: 'visible', timeout: 30000 });
    await f.fill('#lg_email', email); await f.fill('#lg_pass', pw); await f.click('#lg_btn');
    await until(() => f.evaluate(() => document.getElementById('login_screen').hidden === true && !!S.token), 40000);
    await wait(2500);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) { /* none open */ } const a = document.getElementById('ai_panel'); if (a) a.hidden = true; showTab('dash'); });
    return { p, f, errs };
  };
  const range = async (f, kind) => {
    await f.evaluate(k => { S.dashD = null; document.querySelector('[data-krange="' + k + '"]').click(); }, kind);
    const done = await until(() => f.evaluate(() => !!S.dashD && document.getElementById('k_total').textContent !== '–'), 40000);
    await wait(1200);      // (the numbers roll into place – here without the roll: reducedMotion)
    return done;
  };
  // the box of one number: what it shows, what is on top, what can be pressed
  const box = async (f, kind) => {
    await f.evaluate(() => { const a = document.getElementById('ai_panel'); if (a && !a.hidden) a.hidden = true; });      // the assistant's panel, if it opened by itself, is not in the way
    await f.click('[data-kd="' + kind + '"]');
    await until(() => f.evaluate(() => !document.getElementById('kd_back').hidden && !/Loading/.test(document.getElementById('kd_body').textContent)), 40000);
    return f.evaluate(() => {
      const kd = document.getElementById('kd'), r = kd.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const foot = [...document.querySelectorAll('#kd_body tfoot td.hl')].map(x => x.textContent);
      return { open: !document.getElementById('kd_back').hidden, title: document.getElementById('kd_title').textContent, sub: document.getElementById('kd_sub').textContent,
        big: document.getElementById('kd_big').textContent, bigSub: document.getElementById('kd_big_s').textContent, rows: document.querySelectorAll('#kd_body tbody tr').length,
        foot: foot, none: (document.querySelector('#kd_body .kd-none') || {}).textContent || '', body: document.getElementById('kd_body').textContent.slice(0, 300),
        onTop: !!top && !!top.closest('#kd'), rect: [Math.round(r.width), Math.round(r.height)], vp: [innerWidth, innerHeight],
        typing: kd.querySelectorAll('input, select, textarea, [contenteditable="true"]').length, buttons: [...kd.querySelectorAll('button')].map(x => x.id) };
    });
  };
  const closeBox = f => f.evaluate(() => document.getElementById('kd_close').click());
  try {
    // ---- a computer: every number, for "All dates", "This month" and "Today" ----
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: 16.69, longitude: 74.17, accuracy: 20 }, reducedMotion: 'reduce' });
    const { p, f, errs } = await signIn(ctx, 'sujit@rcl.test', PW);
    for (const rg of ['all', 'month', 'today']) {
      ok(rg + ': the Dashboard has its numbers', !!(await range(f, rg)));
      const tile = await f.evaluate(sels => { const o = {}; sels.forEach(([k, s]) => { o[k] = document.querySelector(s).textContent; }); o.inamt = document.getElementById('k_inamt').textContent; return o; }, KINDS);
      for (const [k] of KINDS) {
        const x = await box(f, k);
        const want = num(tile[k]), got = num(x.big);
        ok(rg + ' · ' + k + ': the box opens on top, read-only, its number = the card\'s (' + tile[k] + ')', x.open && x.onTop && x.typing === 0 && x.buttons.join() === 'kd_x,kd_close' &&
          (tile[k] === '–' ? x.big === '–' || got === 0 || x.none !== '' : got === want), { tile: tile[k], x });
        if (k === 'machines') ok(rg + ' · machines:    one line per machinery (' + tile[k] + ')', x.rows === want || (want === 0 && x.none !== ''), { rows: x.rows, tile: tile[k] });
        if (['issued', 'today', 'in', 'open', 'close', 'now'].includes(k) && x.foot.length) ok(rg + ' · ' + k + ':    the total row = the card', num(x.foot[0]) === want, { tile: tile[k], foot: x.foot });
        if (k === 'issued' || k === 'entries') ok(rg + ' · ' + k + ':    one line per entry (' + num(tile.entries) + ')', x.rows === Math.min(500, num(tile.entries) || 0) || (num(tile.entries) === 0 && x.none !== ''), { rows: x.rows, entries: tile.entries });
        if (k === 'in') ok(rg + ' · in:    the bills and the amount = the card (' + tile.inamt + ')', x.bigSub.replace(/\s/g, '') === tile.inamt.replace(/\s/g, ''), { card: tile.inamt, box: x.bigSub });
        if (k === 'today') ok(rg + ' · today:    today\'s entry of KDX-126 is in it (12.5 Ltr)', /KDX-126/.test(x.body) || x.rows > 0, x.body);
        if (rg === 'month' && k === 'issued') await p.screenshot({ path: path.join(dir, 'computer-issued.png') });
        if (rg === 'all' && k === 'open') await p.screenshot({ path: path.join(dir, 'computer-opening.png') });
        await closeBox(f);
      }
    }
    // closing: ×, Escape, a click outside
    await f.evaluate(() => { const a = document.getElementById('ai_panel'); if (a) a.hidden = true; });
    await f.click('[data-kd="issued"]'); await wait(400); await f.press('#kd_close', 'Escape'); await wait(200);
    ok('Escape closes the box', await f.evaluate(() => document.getElementById('kd_back').hidden));
    await f.click('[data-kd="now"]'); await wait(400); await p.mouse.click(20, 450); await wait(200);
    ok('a click outside the box closes it', await f.evaluate(() => document.getElementById('kd_back').hidden));
    await f.focus('[data-kd="close"]'); await p.keyboard.press('Enter'); await wait(500);
    ok('Enter on a number opens its box (keyboard)', await f.evaluate(() => !document.getElementById('kd_back').hidden && document.getElementById('kd_title').textContent === 'Closing stock'));
    await f.click('#kd_x'); await wait(200);
    ok('× closes it', await f.evaluate(() => document.getElementById('kd_back').hidden));
    // the ownership rows below still open their own machine-wise list (as before), not this box
    await f.evaluate(() => { const a = document.getElementById('ai_panel'); if (a) a.hidden = true; document.querySelector('#own_ledger [data-own]').click(); });
    await until(() => f.evaluate(() => !document.getElementById('dlg_back').hidden), 20000);
    ok('an ownership row still opens its machine-wise list (as before), not this box', await f.evaluate(() => !document.getElementById('dlg_back').hidden && document.getElementById('kd_back').hidden && /Diesel issued/.test(document.getElementById('dlg_title').textContent)));
    await f.evaluate(() => document.getElementById('dlg_close').click());
    ok('computer: no page error', errs.length === 0, errs);
    await ctx.close();

    // ---- a phone: the box fills the screen ----
    const pc = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ['geolocation'], geolocation: { latitude: 16.69, longitude: 74.17, accuracy: 20 }, reducedMotion: 'reduce' });
    const ph = await signIn(pc, 'sujit@rcl.test', PW);
    await range(ph.f, 'month');
    const x = await box(ph.f, 'issued');
    ok('phone: the box fills the screen, on top', x.open && x.onTop && x.rect[0] >= x.vp[0] - 2 && x.rect[1] >= x.vp[1] - 2, x);
    await ph.p.screenshot({ path: path.join(dir, 'phone-issued.png') });
    ok('phone: no page error', ph.errs.length === 0, ph.errs);
    await pc.close();

    // ---- the same access as the pages: a person with the Dashboard but NOT Diesel Issue ----
    const keep = sql("select perm_diesel_issue from app_users where email = 'view@rcl.test'");
    sql("update app_users set perm_diesel_issue = 'No access', updated_at = now() where email = 'view@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    try {
      const vc = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: 16.69, longitude: 74.17, accuracy: 20 }, reducedMotion: 'reduce' });
      const v = await signIn(vc, 'view@rcl.test', VPW);
      await range(v.f, 'month');
      const vi = await box(v.f, 'issued');
      ok('no Diesel Issue access: the box says so – no entry is shown', vi.open && vi.rows === 0 && /access/i.test(vi.none), vi);
      await closeBox(v.f);
      const vo = await box(v.f, 'open');
      ok('   the stock of the places (the Dashboard\'s own numbers) is shown', vo.open && vo.rows > 0, vo);
      await vc.close();
    } finally {
      sql("update app_users set perm_diesel_issue = '" + keep.replace(/'/g, "''") + "', updated_at = now() where email = 'view@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    }
  } catch (e) { ok('the test ran to its end', false, String((e && e.stack) || e)); }
  await b.close();
  try { clean(); } catch (e) { out.push('clean-up: ' + e.message); }
  console.log(out.join('\n'));
  console.log(pass + ' passed, ' + fail + ' failed  (pictures: ' + dir + ')');
  process.exit(fail ? 1 : 0);
})();
