// update-166 (asked 27-10-2026: "fuel card number / details takayla option nahiye te baanaw" – his answers: the number stays only its
// LAST 4 digits; the details: bank / company, the name on the card, the expiry (month / year), the customer / account ID) – the whole
// way on the local rig started with PORTAL=1 (the Portal :3010 from ../rcl-portal, Mechanical :3000 linked to it).
// T2 (rcl_s2, steps 1zg + 1zh run) plays HO, put on fuel cards; S1 plays VTR – as before. Test data only, on the rig.
//   1. the page at T2: Fuel Cards → "+ Add card" has the 4 boxes; a card saved with them; the list shows the details and the expiry
//      (ending this month: amber "Expires <its last day>"); the tile too; Edit brings them back; a change saved
//   2. the whole card number typed into the Customer ID: refused with its message, nothing kept
//   3. an expired card: red "Expired …"; the Dashboard's card tiles show the same
//   4. S1: no Fuel Cards, "Live"
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node card166.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const C = 'HDFC FLEET 166';
(async () => {
  const errs = []; let b = null, cookie = '';
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const cardsKept = () => JSON.parse(sql('rcl_s2', "select coalesce((select value from web.props where key = 'FUEL_CARDS'), '[]')") || '[]');
  try {
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { const lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const pg0 = await preq('/api/admin', { action: 'placesGet', site: 'T2' });
    const sv0 = await preq('/api/admin', { action: 'placesSave', site: 'T2', places: (pg0.places || []).map(p => ({ name: p.name, cap: p.cap || 1000, fuel: p.fuel })), mode: 'card' });
    ok('start: T2 on fuel cards (the Portal), no card yet', sv0.mode === 'card' && cardsKept().length === 0, [sv0.status, sv0.error, sv0.mode]);
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('T2: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('T2'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && S.fuelMode === 'card');
    const calm = () => F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) y.hidden = true; }); });
    await calm();
    await F.evaluate(() => showTab('cards')); await wait(2000);
    // ---- 1. a card with its details
    await F.evaluate(() => $('cd_add').click()); await wait(400);
    const boxes = await F.evaluate(() => ['cd_issuer', 'cd_holder', 'cd_exp', 'cd_cust'].map(id => !!$(id) && !$(id).closest('[hidden]') ? $(id).type || 'text' : 'missing'));
    ok('1. "+ Add card": the boxes Bank / company, Name on the card, Expiry (month / year), Customer / Account ID', JSON.stringify(boxes) === JSON.stringify(['text', 'text', 'month', 'text']), boxes);
    const thisMonth = await F.evaluate(() => S.today.slice(0, 7));
    await F.evaluate((name, ym) => { $('cd_name').value = name; $('cd_type').value = 'Fuel card'; $('cd_last4').value = '4321'; $('cd_open').value = 5000; $('cd_date').value = S.today.slice(0, 8) + '01';
      $('cd_issuer').value = 'HDFC Bank'; $('cd_holder').value = 'Rachana Construction Ltd'; $('cd_exp').value = ym; $('cd_cust').value = 'CUST 778899'; $('cd_save').click(); }, C, thisMonth);
    for (let i = 0; i < 30 && !cardsKept().length; i++) await wait(500);
    const k1 = cardsKept()[0] || {};
    ok('   saved: kept with its details (and only the last 4 digits)', k1.name === C && k1.issuer === 'HDFC Bank' && k1.holder === 'Rachana Construction Ltd' && k1.expiry === thisMonth && k1.custId === 'CUST 778899' && k1.last4 === '4321', k1);
    await wait(1500);
    const row = await F.evaluate(name => { const tr = [...document.querySelectorAll('#cd_rows tr')].find(r => r.cells[0] && r.cells[0].textContent.indexOf(name) > -1); return tr ? { det: (tr.querySelector('.cd-det') || {}).textContent, exp: tr.cells[3].textContent, cls: (tr.cells[3].querySelector('.cd-exp') || {}).className } : null; }, C);
    ok('   the list: its details under its name; Expiry "Expires <the last day of this month>" in amber (it ends this month)', !!row && row.det === 'HDFC Bank · Rachana Construction Ltd · Customer ID CUST 778899' && /^Expires \d{2}-\d{2}-\d{4}$/.test(row.exp) && /warn/.test(row.cls || ''), row);
    const tile = await F.evaluate(() => { const t = document.querySelector('#cd_tiles .cd-card'); return t ? { top: t.querySelector('span').textContent, exp: (t.querySelector('.cd-exp') || {}).textContent || '' } : null; });
    ok('   the tile: "Fuel card ···· 4321 · HDFC Bank" and its expiry mark', !!tile && tile.top === 'Fuel card ···· 4321 · HDFC Bank' && /^Expires /.test(tile.exp), tile);
    await calm(); await F.evaluate(() => $('cd_tiles').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: SHOT + '/card166_list.png' });
    // Edit: the form brings them back; a change saved
    await F.evaluate(name => document.querySelector('[data-cded="' + name + '"]').click(), C); await wait(500);
    const fm = await F.evaluate(() => ({ t: $('cd_form_t').textContent, i: $('cd_issuer').value, h: $('cd_holder').value, e: $('cd_exp').value, c: $('cd_cust').value }));
    ok('   Edit: "Change card …" with its details in the boxes', fm.t === 'Change card ' + C && fm.i === 'HDFC Bank' && fm.h === 'Rachana Construction Ltd' && fm.e === thisMonth && fm.c === 'CUST 778899', fm);
    await calm(); await F.evaluate(() => $('cd_form').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: SHOT + '/card166_form.png' });
    // ---- 2. the whole card number in the Customer ID: refused
    await F.evaluate(() => { $('cd_cust').value = '4111 1111 1111 1111'; $('cd_save').click(); }); await wait(2500);
    const rf = await F.evaluate(() => ({ toast: ($('toast') || {}).textContent || '', fix: ($('fixbox') || {}).textContent || '', open: !$('cd_form').hidden }));
    ok('2. the whole card number typed as the Customer ID: refused – "that is the whole card number – it is never kept"', /that is the whole card number – it is never kept/.test(rf.toast + rf.fix) && rf.open && (cardsKept()[0] || {}).custId === 'CUST 778899', rf);
    ok('   nothing of it is kept', JSON.stringify(cardsKept()).indexOf('4111') === -1);
    // ---- 3. an expired card: red; the Dashboard's tiles the same
    const lastMonth = await F.evaluate(() => { const t = new Date(S.today + 'T00:00:00'); const d = new Date(t.getFullYear(), t.getMonth() - 1, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
    await calm();
    await F.evaluate(ym => { $('cd_cust').value = 'CUST 778899'; $('cd_exp').value = ym; $('cd_save').click(); }, lastMonth);
    for (let i = 0; i < 30 && (cardsKept()[0] || {}).expiry !== lastMonth; i++) await wait(500);
    await wait(1500);
    const ex = await F.evaluate(() => { const tr = document.querySelector('#cd_rows tr'); const e = tr && tr.cells[3].querySelector('.cd-exp'); return e ? { t: e.textContent, cls: e.className } : null; });
    ok('3. an expiry of last month: "Expired MM/YYYY" in red', !!ex && /^Expired \d{2}\/\d{4}$/.test(ex.t) && /bad/.test(ex.cls), ex);
    await F.evaluate(() => showTab('dash')); await wait(4000);
    const dt = await F.evaluate(() => { const t = document.querySelector('#hd_cards .cd-card .cd-exp'); return t ? t.textContent : ''; });
    ok('   the Dashboard\'s card tile: "Expired …" too', /^Expired \d{2}\/\d{4}$/.test(dt), dt);
    // ---- 4. S1 as before
    const sp = await b.newPage(); await sp.setViewport({ width: 1440, height: 950 }); sp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await sp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F1 = await find(sp, () => typeof S === 'object' && !!S.user && !!S.today);
    let live1 = ''; for (let i = 0; i < 30; i++) { live1 = await F1.evaluate(() => document.getElementById('live_dot').textContent.trim()); if (live1 === 'Live') break; await wait(500); }
    const v1 = await F1.evaluate(() => ({ cards: !$('tab-cards').hidden, inward: !$('tab-inward').hidden }));
    ok('4. S1: no Fuel Cards, Diesel Inward there, "Live"', !v1.cards && v1.inward && live1 === 'Live', [v1, live1]);
    ok('no error on the pages', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try {      // the test's own data out again (rig only)
      sql('rcl_s2', "delete from web.props where key in ('FUEL_MODE', 'FUEL_CARDS', 'DIESEL_PLACES') or key like 'TANK_CAP_%'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: T2 FUEL_CARDS ' + sql('rcl_s2', "select count(*) from web.props where key = 'FUEL_CARDS'") + ', FUEL_MODE ' + sql('rcl_s2', "select count(*) from web.props where key = 'FUEL_MODE'"));
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
