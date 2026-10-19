// update-135 (asked 19-10-2026 with a picture of a call: "screen share kel nantr he as distey yar he fix kr proper google meet war kas aste
// tas kr n ani ha show my camera kel ki new app open krtey tr high priority ki laptop cha camera use krel jr laptop la camre nasel tewa
// externel app la prefere karel ani khali je connect zale nantr je yet te hide karta haw proper") – the call as in Google Meet, in two
// real browsers on the local rig (bash rig/all.sh – own sign-in on :3000; a pretend camera and microphone; "share this tab" answered by
// itself). Test users A135 / B135 only, taken out at the end.
//   1. A calls B (his screen is shown at once): A's bar hides itself – a small pill with the time, the microphone and "Stop";
//   2. B accepts: A's screen BIG (as in Meet); B's bar: round buttons Mute · Show my camera · Show my screen · Chat · More · Leave, Hide;
//   3. B: Hide → the pill; Show the bar → back;
//   4. B: Show my camera → A sees "Camera of B 135 Bala";
//   5. A: Stop (on the pill) → his bar comes back by itself;
//   6. the camera of a computer: its own camera first, a camera app last – by name; the first time (no names yet) the front camera is
//      asked, and a camera app that opened is changed for the computer's own camera.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node call135.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port, PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const clean = () => sql("delete from app_users where email in ('a135@rcl.test', 'b135@rcl.test'); delete from web.cache where key like 'RTC%' or key = 'USERS_LIST' or key like 'LG\\_%';");
(async () => {
  let b = null; const errs = [];
  try {
    clean();
    sql("insert into app_users (id, email, password_hash, name, active, admin) select 'a135', 'a135@rcl.test', password_hash, 'A 135 Asha', 'Yes', 'No' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'b135', 'b135@rcl.test', password_hash, 'B 135 Bala', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000,
      args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
    const session = async email => { const ctx = await b.createBrowserContext(), p = await ctx.newPage();
      p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(email + ': ' + String(e.message).slice(0, 200)); });
      await p.setViewport({ width: 1440, height: 860 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200);
      const f = p.frames().find(x => x !== p.mainFrame());
      await f.evaluate(e => { try { localStorage.setItem('oc_brief_' + e, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (er) {} }, email);
      await f.type('#lg_email', email); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(5000);
      await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} const a = document.getElementById('ai_panel'); if (a) a.hidden = true; });
      return { p, f }; };
    const A = await session('a135@rcl.test'), B = await session('b135@rcl.test');
    const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
    const click = (X, sel) => X.f.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
    const st = X => X.f.evaluate(() => { const C = RTC.call, bar = document.getElementById('rtc_bar'), v = document.getElementById('rtc_view'), shown = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      const btns = [...bar.querySelectorAll('.rtc-btns > .rtc-b, #rtc_hide')].filter(shown).map(x => (x.querySelector('.lb') && shown(x.querySelector('.lb')) ? x.querySelector('.lb').textContent : '[' + x.title + ']'));
      const r = v.getBoundingClientRect(), br = bar.getBoundingClientRect();
      return { call: !!C, mini: bar.classList.contains('mini'), btns: btns, barW: Math.round(br.width), barRight: Math.round(innerWidth - br.right), view: !v.hidden ? { title: document.getElementById('rtc_vt').textContent, size: v.dataset.size, wShare: Math.round(r.width / innerWidth * 100), hShare: Math.round(r.height / innerHeight * 100), w: document.getElementById('rtc_video').videoWidth } : null,
        camLabel: C && C.screen && C.kind === 'cam' ? C.screen.getVideoTracks()[0].label : '', inBox: !document.getElementById('rtc_in').hidden }; });
    // ---- 1. A calls B: his screen is shown at once – his bar hides itself (a pill: time, microphone, Stop) ----
    await click(A, '#u_share'); await until(() => A.f.evaluate(() => !!document.querySelector('#rtc_list')), 8000); await wait(300);
    await A.f.evaluate(() => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === 'B 135 Bala'); const c = l.querySelector('input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('cf_ok').click(); });
    let a = await until(async () => { const s = await st(A); return s.call ? s : null; }, 8000) || await st(A);
    ok('1. A calls B (his screen shown at once): his bar is a small pill – ' + JSON.stringify(a.btns) + ', on the right', a.mini && a.btns.join() === '[Mute],[Stop showing my screen],[Show the bar]' && a.barRight < 30 && a.barW < 330, a);
    // ---- 2. B accepts: the screen big; his bar Meet-style ----
    await until(async () => (await st(B)).inBox, 10000); await click(B, '#rtc_yes');
    let bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 ? s : null; }, 25000) || await st(B);
    ok('2. B accepts: "' + (bb.view && bb.view.title) + '" big (' + (bb.view && bb.view.wShare) + ' % × ' + (bb.view && bb.view.hShare) + ' % of the window); his bar: ' + JSON.stringify(bb.btns),
      !!bb.view && bb.view.size === 'l' && bb.view.wShare > 95 && bb.view.hShare > 80 && !bb.mini && bb.btns.join() === 'Mute,Show my camera,Show my screen,Chat,More,Leave,Hide', bb);
    await wait(800); await B.p.screenshot({ path: SHOTS + 'call135_view.png' }); await A.p.screenshot({ path: SHOTS + 'call135_presenter.png' });
    // ---- 3. B hides the bar and shows it again ----
    await click(B, '#rtc_hide'); await wait(400); const b3 = await st(B);
    await B.p.screenshot({ path: SHOTS + 'call135_hidden.png' });
    await click(B, '#rtc_hide'); await wait(400); const b4 = await st(B);
    ok('3. B: Hide → a pill ' + JSON.stringify(b3.btns) + ' and the picture grows to the bottom (' + b3.view.hShare + ' %); Show the bar → back', b3.mini && b3.btns.join() === '[Mute],[Show the bar]' && b3.view.hShare > bb.view.hShare && !b4.mini && b4.btns.length === 7, { b3, b4 });
    // ---- 3b. on a phone-sized window: the bar fits ----
    await B.p.setViewport({ width: 390, height: 844 }); await wait(700);
    const fit = await B.f.evaluate(() => { const r = document.getElementById('rtc_bar').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(innerWidth - r.right), h: Math.round(r.height) }; });
    await B.p.screenshot({ path: SHOTS + 'call135_phone.png' });
    ok('3b. a phone-sized window (390 px): the bar fits in it (' + JSON.stringify(fit) + ')', fit.left >= 0 && fit.right >= 0, fit);
    await B.p.setViewport({ width: 1440, height: 860 }); await wait(500);
    // ---- 4. B shows his camera ----
    await click(B, '#rtc_cam');
    a = await until(async () => { const s = await st(A); return s.view && /^Camera of B 135 Bala/.test(s.view.title) && s.view.w > 0 ? s : null; }, 20000) || await st(A);
    bb = await st(B);
    ok('4. B: Show my camera → A sees "' + (a.view && a.view.title) + '"; B\'s button says "Stop my camera" (the camera: ' + bb.camLabel + ')', !!a.view && /^Camera of B 135 Bala/.test(a.view.title) && bb.btns.indexOf('Stop my camera') > -1, { a: a.view, b: bb.btns });
    await click(B, '#rtc_cam'); await wait(800);
    // ---- 5. A stops his screen on the pill → his bar comes back ----
    await click(A, '#rtc_share'); await wait(800); a = await st(A);
    ok('5. A presses Stop on the pill → his bar comes back by itself: ' + JSON.stringify(a.btns), !a.mini && a.btns.join() === 'Mute,Show my camera,Show my screen,Chat,More,End,Hide', a);
    // ---- 6. the camera of a computer ----
    const cam = await B.f.evaluate(async () => {
      const md = navigator.mediaDevices, keep = { e: md.enumerateDevices, g: md.getUserMedia }, asked = [];
      let list = [{ kind: 'videoinput', deviceId: 'v1', label: 'OBS Virtual Camera' }, { kind: 'videoinput', deviceId: 'i1', label: 'Integrated Webcam (0c45:6a10)' }, { kind: 'videoinput', deviceId: 'l1', label: 'Logitech HD Webcam C270' }, { kind: 'videoinput', deviceId: 'p1', label: 'Phone Link camera' }, { kind: 'audioinput', deviceId: 'm1', label: 'Mic' }];
      let opened = 'Phone Link camera';
      md.enumerateDevices = async () => list;
      let named0 = null;      // the names the browser gives once the camera was allowed
      md.getUserMedia = async o => { asked.push(JSON.stringify(o.video.deviceId || o.video.facingMode)); if (named0) { list = named0; named0 = null; } const id = o.video.deviceId ? o.video.deviceId.exact : ''; const d = list.find(x => x.deviceId === id); const label = d ? d.label : opened;
        return { getVideoTracks: () => [{ label: label, getSettings: () => ({ deviceId: d ? d.deviceId : 'p1' }), stop() {} }], getTracks: () => [{ stop() {} }] }; };
      const lab = async () => (await rtcGetCam()).getVideoTracks()[0].label;
      try {
        const rank = (await rtcCamRank()).map(d => d.label);
        const named = await lab();
        named0 = list; list = list.map(d => Object.assign({}, d, { label: '' })); asked.length = 0;      // the first time: no names before the camera is allowed (then the browser gives them)
        const first = await lab(); const firstAsked = asked.slice();
        list = [{ kind: 'videoinput', deviceId: 'p1', label: '' }];      // only a phone camera app
        opened = 'Phone Link camera'; asked.length = 0; const only = await lab();
        return { rank: rank, named: named, first: first, firstAsked: firstAsked, only: only };
      } finally { md.enumerateDevices = keep.e; md.getUserMedia = keep.g; }
    });
    ok('6. the camera of a computer: order ' + JSON.stringify(cam.rank) + '; taken by name: "' + cam.named + '"', cam.rank.join('|') === 'Integrated Webcam (0c45:6a10)|Logitech HD Webcam C270|OBS Virtual Camera|Phone Link camera' && cam.named === 'Integrated Webcam (0c45:6a10)', cam);
    ok('   the first time (no names): the front camera is asked; a camera app opened → the computer\'s own taken instead ' + JSON.stringify(cam.firstAsked) + ' = "' + cam.first + '"; with no other camera the camera app is used ("' + cam.only + '")',
      cam.firstAsked.join() === '{"ideal":"user"},{"exact":"i1"}' && cam.first === 'Integrated Webcam (0c45:6a10)' && cam.only === 'Phone Link camera', cam);
    await click(A, '#rtc_end'); await wait(1500);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { clean(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the pages', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
