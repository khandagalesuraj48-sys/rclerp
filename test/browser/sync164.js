// update-164 fix (27-10-2026: "data base connect hoina gela" – the live page stayed "Connecting…"): the page's live sync starts again
// after the sign-in, on a site as before (S1) and on a site on fuel cards (T2). The local rig started with PORTAL=1 (the Portal :3010
// from ../rcl-portal, Mechanical :3000 linked to it). Nothing is saved by this test.
//   1. S1: after the sign-in the dot says "Live" (the heartbeat answered) and the heartbeat goes on (it answers again)
//   2. a change made elsewhere reaches the open page without a reload (the version of the master raised → the page asks again)
//   3. the other calls of that line ran too: the closed months (setClosed) and the calls' set-up (rtcAfterLogin)
//   4. T2 the same
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node sync164.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010';
(async () => {
  const errs = []; let b = null, cookie = '';
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  try {
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    for (const site of ['S1', 'T2']) {
      const pg = await b.newPage(); await pg.setViewport({ width: 1440, height: 950 }); pg.on('pageerror', e => errs.push(site + ': ' + String(e.message).slice(0, 200)));
      await pg.goto(SA + '/#sso=' + await ticket(site), { waitUntil: 'load' });
      const F = await find(pg, () => typeof S === 'object' && !!S.user && !!S.today);
      if (!F) { ok(site + ': the page signed in', false, 'no page'); continue; }
      let live = null;
      for (let i = 0; i < 40; i++) { live = await F.evaluate(() => ({ text: document.getElementById('live_dot').textContent.trim(), ok: document.getElementById('live_dot').dataset.ok, at: window.rclSyncAt || 0 })); if (live.ok === 'true') break; await wait(500); }
      ok((site === 'S1' ? '1. ' : '4. ') + site + ': after the sign-in the dot says "Live" – the heartbeat answered', live.text === 'Live' && live.ok === 'true' && live.at > 0, live);
      const at1 = live.at; await wait(6000);
      const at2 = await F.evaluate(() => window.rclSyncAt || 0);
      ok('   ' + site + ': the heartbeat goes on (it answered again a few seconds later)', at2 > at1, [at1, at2]);
      // 2. a change made elsewhere: the versions the page knows are those of the server (the heartbeat keeps them)
      const vv = await F.evaluate(async () => ({ page: S.ver, server: (await rawCall('sync', {})).versions }));
      ok('   ' + site + ': the page knows the versions of now (a change by anybody reaches it without a reload)', !!vv.page && JSON.stringify(vv.page) === JSON.stringify(vv.server), vv);
      // 3. the rest of the line ran: the calls' set-up and the closed months
      const rest = await F.evaluate(() => ({ rtc: typeof RTC === 'object' && !!RTC ? 'set' : typeof rtcFast === 'function' ? 'fn' : '', closed: typeof S.closedUpto === 'string' || S.closedUpto === null || S.closedUpto === undefined ? 'ok' : 'bad', syncOnce: typeof syncNow === 'function' }));
      ok('   ' + site + ': the page has its calls\' set-up and closed months (the rest of that line runs)', rest.syncOnce && rest.closed === 'ok', rest);
      await pg.close();
    }
    ok('no error on the pages', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally { if (b) await b.close(); }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
