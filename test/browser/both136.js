// update-136 (asked 19-10-2026: "show my camera kela ki screen band hote screen kel ki camrea band hot as nko aahe screen share chalu astana
// user ne jar camera share kela tr poper mala maza pn face disel ani user ch aapn perfect he haw aahe quality pn super yeyla hawi voice pn
// clear yawa") – a screen AND a camera at the same time, the faces at the side (his own too), the quality – in two real browsers on the
// local rig (bash rig/all.sh – own sign-in on :3000; a pretend camera and microphone; "share this tab" answered by itself). Test users
// A136 / B136 only, taken out at the end.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node both136.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port, PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1400) : '')); };
const clean = () => sql("delete from app_users where email in ('a136@rcl.test', 'b136@rcl.test'); delete from web.cache where key like 'RTC%' or key = 'USERS_LIST' or key like 'LG\\_%';");
(async () => {
  let b = null; const errs = [];
  try {
    clean();
    sql("insert into app_users (id, email, password_hash, name, active, admin) select 'a136', 'a136@rcl.test', password_hash, 'A 136 Asha', 'Yes', 'No' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'b136', 'b136@rcl.test', password_hash, 'B 136 Bala', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
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
    const A = await session('a136@rcl.test'), B = await session('b136@rcl.test');
    const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
    const click = (X, sel) => X.f.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
    const st = X => X.f.evaluate(async () => { const C = RTC.call, v = document.getElementById('rtc_view');
      const faces = [...document.querySelectorAll('#rtc_faces .rtc-face')].map(el => { const vd = el.querySelector('video'); return el.querySelector('b').textContent + (el.classList.contains('me') ? '(me)' : '') + (vd.videoWidth > 0 ? ':live' : ':dark'); });
      const stats = async kind => { let n = 0; if (C) for (const P of C.peers.values()) { try { (await P.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === kind) n += r.packetsReceived || 0; }); } catch (e) {} } return n; };
      const enc = sn => { try { const p = sn.getParameters(); const e = (p.encodings || [])[0] || {}; return { br: e.maxBitrate || 0, fps: e.maxFramerate || 0, pri: e.priority || '', deg: p.degradationPreference || '' }; } catch (e) { return null; } };
      const P = C ? [...C.peers.values()][0] : null;
      return { screen: !!(C && C.screen), cam: !!(C && C.cam), faces: faces, view: !v.hidden ? { title: document.getElementById('rtc_vt').textContent, w: document.getElementById('rtc_video').videoWidth, tabs: [...document.querySelectorAll('#rtc_tabs .rtc-tab')].map(x => x.textContent) } : null,
        mine: document.getElementById('rtc_mine').textContent, aIn: await stats('audio'), vIn: await stats('video'),
        enc: P ? { scr: P.scr ? enc(P.scr) : null, cam: P.camS ? enc(P.camS) : null, mic: P.micS ? enc(P.micS) : null } : null,
        viewRight: Math.round(innerWidth - v.getBoundingClientRect().right) }; });
    // ---- A calls B with his screen; B accepts ----
    await click(A, '#u_share'); await until(() => A.f.evaluate(() => !!document.querySelector('#rtc_list')), 8000); await wait(300);
    await A.f.evaluate(() => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === 'B 136 Bala'); const c = l.querySelector('input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('cf_ok').click(); });
    await until(async () => (await B.f.evaluate(() => !document.getElementById('rtc_in').hidden)), 12000); await click(B, '#rtc_yes');
    let bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 && s.aIn > 0 ? s : null; }, 25000) || await st(B);
    ok('1. A calls B with his screen; B sees it big ("' + (bb.view && bb.view.title) + '") and hears A', !!bb.view && /^Screen of A 136 Asha/.test(bb.view.title) && bb.aIn > 0, bb);
    // ---- 2. A shows his camera too: his screen stays ----
    await A.f.evaluate(() => { const b0 = document.getElementById('rtc_hide'); if (RTC.call.mini) b0.click(); }); await wait(300);
    await click(A, '#rtc_cam');
    let a = await until(async () => { const s = await st(A); return s.cam && s.faces.some(f => /^You\(me\):live/.test(f)) ? s : null; }, 15000) || await st(A);
    bb = await until(async () => { const s = await st(B); return s.faces.some(f => /^A 136 Asha:live/.test(f)) ? s : null; }, 20000) || await st(B);
    ok('2. A presses Show my camera while his screen is shown: BOTH stay on ("' + a.mine + '"); A sees his own face ' + JSON.stringify(a.faces) + '; B sees A\'s screen big and A\'s face at the side ' + JSON.stringify(bb.faces),
      a.screen && a.cam && /^Your screen and camera are shown/.test(a.mine) && a.faces.join() === 'You(me):live' && !!bb.view && /^Screen of A 136 Asha/.test(bb.view.title) && bb.faces.join() === 'A 136 Asha:live', { a, bb });
    // ---- 3. B shows his camera: each sees the other's face and his own ----
    await click(B, '#rtc_cam');
    a = await until(async () => { const s = await st(A); return s.faces.some(f => /^B 136 Bala:live/.test(f)) ? s : null; }, 20000) || await st(A);
    bb = await until(async () => { const s = await st(B); return s.faces.length === 2 && s.faces.every(f => /:live$/.test(f)) ? s : null; }, 15000) || await st(B);
    ok('3. B shows his camera too: A sees the faces ' + JSON.stringify(a.faces) + ' (nothing big over his own app: ' + !a.view + '), B sees ' + JSON.stringify(bb.faces) + ' – B\'s big picture is still A\'s screen; it leaves the faces room (' + bb.viewRight + ' px)',
      a.faces.join() === 'B 136 Bala:live,You(me):live' && !a.view && bb.faces.join() === 'A 136 Asha:live,You(me):live' && /^Screen of A 136 Asha/.test(bb.view.title) && bb.viewRight >= 230, { a: a, b: bb });
    await wait(1500); await B.p.screenshot({ path: SHOTS + 'both136_viewer.png' }); await A.p.screenshot({ path: SHOTS + 'both136_presenter.png' });
    // ---- 3b. a phone-sized window: the faces in a row on top, the big picture under them, the bar fits ----
    await B.p.setViewport({ width: 390, height: 844 }); await wait(800);
    const ph = await B.f.evaluate(() => { const f = document.getElementById('rtc_faces').getBoundingClientRect(), v = document.getElementById('rtc_view').getBoundingClientRect(), bar = document.getElementById('rtc_bar').getBoundingClientRect(); return { facesBottom: Math.round(f.bottom), viewTop: Math.round(v.top), barIn: bar.left >= 0 && bar.right <= innerWidth, facesW: Math.round(f.width) }; });
    await B.p.screenshot({ path: SHOTS + 'both136_phone.png' });
    ok('3b. a phone-sized window (390 px): the faces in a row on top (' + JSON.stringify(ph) + '), the big picture under them, the bar fits', ph.facesBottom <= ph.viewTop && ph.barIn && ph.facesW > 300, ph);
    await B.p.setViewport({ width: 1440, height: 860 }); await wait(600);
    // ---- 4. the quality this page sends ----
    a = await st(A);
    ok('4. what A sends: the screen ' + JSON.stringify(a.enc.scr) + ', the camera ' + JSON.stringify(a.enc.cam) + ', the voice ' + JSON.stringify(a.enc.mic),
      a.enc.scr && a.enc.scr.br === 2500000 && a.enc.cam && a.enc.cam.br === 1200000 && a.enc.cam.fps === 24 && a.enc.mic && a.enc.mic.br === 64000 && a.enc.mic.pri === 'high', a.enc);
    // ---- 5. a tap on a face shows it big; the screen can be taken back by its tab ----
    await B.f.evaluate(() => { const f = [...document.querySelectorAll('#rtc_faces .rtc-face')].find(x => !x.classList.contains('me')); if (f) f.click(); }); await wait(800);
    bb = await st(B);
    ok('5. B taps A\'s face: it is big ("' + (bb.view && bb.view.title) + '"), A\'s screen is a tab ' + JSON.stringify(bb.view && bb.view.tabs) + ', the faces ' + JSON.stringify(bb.faces), !!bb.view && /^Camera of A 136 Asha/.test(bb.view.title) && bb.view.tabs.some(t => t === 'A 136 Asha') && bb.faces.join() === 'You(me):live', bb);
    await B.f.evaluate(() => { const t = [...document.querySelectorAll('#rtc_tabs .rtc-tab')].find(x => x.textContent === 'A 136 Asha'); if (t) t.click(); }); await wait(800);
    bb = await st(B);
    ok('   its tab → A\'s screen big again, his face back at the side', !!bb.view && /^Screen of A 136 Asha/.test(bb.view.title) && bb.faces.join() === 'A 136 Asha:live,You(me):live', bb);
    // ---- 6. A stops his camera: his screen goes on; then stops his screen: his camera … ----
    await click(A, '#rtc_cam');
    bb = await until(async () => { const s = await st(B); return !s.faces.some(f => /^A 136 Asha/.test(f)) ? s : null; }, 15000) || await st(B);
    a = await st(A);
    ok('6. A stops his camera: his screen is still shown ("' + a.mine + '"); at B his face goes, the screen stays', a.screen && !a.cam && /^Your screen is shown/.test(a.mine) && /^Screen of A 136 Asha/.test(bb.view.title) && bb.faces.join() === 'You(me):live', { a: a.mine, bb });
    await click(A, '#rtc_cam'); await wait(2500); await click(A, '#rtc_share');
    bb = await until(async () => { const s = await st(B); return !s.view && s.faces.join() === 'A 136 Asha:live,You(me):live' ? s : null; }, 15000) || await st(B);
    a = await st(A);
    ok('   A shows his camera again and stops his screen: his camera stays ("' + a.mine + '"); at B no big picture – the two faces ' + JSON.stringify(bb.faces), !a.screen && a.cam && /^Your camera is shown/.test(a.mine) && !bb.view && bb.faces.join() === 'A 136 Asha:live,You(me):live', { a: a.mine, bb });
    // ---- the voices both ways ----
    a = await st(A); bb = await st(B);
    ok('7. the voices go both ways all along (sound arriving: A ' + a.aIn + ', B ' + bb.aIn + ' packets)', a.aIn > 50 && bb.aIn > 50, { a: a.aIn, b: bb.aIn });
    await click(A, '#rtc_end'); await wait(1500);
    const gone = await B.f.evaluate(() => ({ call: !!RTC.call, faces: document.querySelectorAll('#rtc_faces .rtc-face').length, hidden: document.getElementById('rtc_faces').hidden }));
    ok('8. the call ends: no faces left at B', !gone.call && gone.faces === 0 && gone.hidden, gone);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { clean(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the pages', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
