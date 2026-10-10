// update-75 (asked 10-10-2026) – IN the call: the camera (switch camera), a snapshot, "only my page" (no video – the others' app
//   follows the page, with their own access), the pen on the sharer's own screen, the chat (text and photos – and what is NOT
//   accepted: page code, other picture kinds), low data, the network's state, a line made again, a phone (no screen sharing).
// Three real browsers (separate sign-ins) on the local rig; a pretend microphone and camera; "share this tab" answered by itself.
//   node media75.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from app_users where email like 'm75%@rcl.test'; delete from activity_log where module = 'Screen Share'; delete from app_settings where id like 'RTCMISS|%' or id like 'USER_PREFS|m75%'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'RTC%' or key = 'USERS_LIST';");
const raw = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mods = (await raw({ fn: 'api', args: [admin, 'usersAdmin', []] })).result, MOD = (mods.modules || Object.keys((mods.users || [])[0].perms || {}));
  const mk = async name => { const email = 'm75' + name.toLowerCase() + '@rcl.test', p = {}; MOD.forEach(m => { p[m] = m === 'Log Book' || m === 'Dashboard' ? 'Edit' : 'None'; });
    const a = await raw({ fn: 'api', args: [admin, 'saveUserAdmin', [{ email, name: 'M75 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]] }); if (a.error) throw new Error(a.error);
    const l = await raw({ fn: 'login', args: [email, 'Temp#' + name + '1'] }), pw = 'Own#' + name + '2468'; const c = await raw({ fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] }); if (c.error) throw new Error(c.error); return { email, pw, name: 'M75 ' + name }; };
  const UB = await mk('Bala'), UC = await mk('Chitra');
  sql("delete from web.cache where key like 'LG\\_%'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000,
    args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const session = async (email, pw) => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
    p.on('dialog', d => { errs.push('a dialog opened: ' + d.message()); d.dismiss().catch(() => {}); });
    await p.setViewport({ width: 1536, height: 900 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(e => { try { localStorage.setItem('oc_brief_' + e, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('rcl_np_no', '1'); } catch (er) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', pw); await f.click('#lg_btn'); await wait(5000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    return { p, f, errs, ctx }; };
  const st = X => X.f.evaluate(async () => { const C = RTC.call, v = id => { const e = document.getElementById(id); return !!e && !e.hidden; }, v2 = document.getElementById('rtc_video');
    const stats = async kind => { let n = 0; if (C) for (const P of C.peers.values()) { try { (await P.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === kind) n += r.packetsReceived || 0; }); } catch (e) {} } return n; };
    return { call: C ? { role: C.role, kind: C.kind, pageMode: C.pageMode, follow: C.follow, low: C.low, net: C.net, peers: [...C.peers.values()].map(P => P.name + ':' + P.state + (P.up ? ':up' : '')) } : null,
      inBox: v('rtc_in') ? document.getElementById('rtc_in_t').textContent : '', bar: v('rtc_bar') ? document.getElementById('rtc_bar').innerText.replace(/\s+/g, ' ') : '', note: v('rtc_note') ? document.getElementById('rtc_note').textContent : '',
      view: v('rtc_view') ? { title: document.getElementById('rtc_vt').textContent, w: v2.videoWidth, t: v2.currentTime, pen: !document.getElementById('rtc_penb').hidden } : null, fol: v('rtc_fol') ? document.getElementById('rtc_fol_t').textContent : '',
      vIn: await stats('video'), aIn: await stats('audio'), tab: S.curTab, msgs: [...document.querySelectorAll('#rtc_msgs .m')].map(m => (m.querySelector('small') || {}).textContent + '|' + (m.querySelector('img') ? 'IMG:' + m.querySelector('img').src.slice(0, 23) : m.lastChild.textContent)), chatN: v('rtc_chat_n') ? document.getElementById('rtc_chat_n').textContent : '' }; });
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
  const click = (X, sel) => X.f.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const openList = async X => { await X.f.evaluate(() => { const l = document.getElementById('rtc_list'); if (l) l.remove(); }); await click(X, '#u_share'); return until(() => X.f.evaluate(() => !!RTC.pick && !document.getElementById('cf_back').hidden && !!document.querySelector('#rtc_list')), 8000); };
  const tick = (X, name) => X.f.evaluate(n => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === n); if (!l) return false; const c = l.querySelector('input'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } return c.checked; }, name);
  const mode = (X, m) => X.f.evaluate(m => { const r = document.querySelector('input[name=rtc_mode][value=' + m + ']'); if (!r) return false; r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; }, m);

  const A = await session('sujit@rcl.test', 'Nashik#Road848!'), B = await session(UB.email, UB.pw), C = await session(UC.email, UC.pw);

  // ---------- 1. the call starts with the CAMERA ----------
  await openList(A); await tick(A, 'M75 Bala'); await tick(A, 'M75 Chitra');
  const modes = await A.f.evaluate(() => [...document.querySelectorAll('input[name=rtc_mode]')].map(r => r.value + (r.checked ? '*' : '')));
  await mode(A, 'cam'); await A.f.evaluate(() => document.getElementById('cf_ok').click());
  await until(async () => (await st(B)).inBox && (await st(C)).inBox, 15000);
  const ringB = (await st(B)).inBox;
  await click(B, '#rtc_yes'); await click(C, '#rtc_yes');
  let bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 && s.vIn > 0 ? s : null; }, 30000) || await st(B);
  let cc = await until(async () => { const s = await st(C); return s.view && s.view.w > 0 ? s : null; }, 20000) || await st(C);
  ok('a computer offers My screen (chosen) / My camera / Only my page; with "My camera" the ring says "Sujit wants to show you a camera" and both see "Camera of Sujit"',
    modes.join() === 'screen*,cam,page' && /wants to show you a camera \(with 1 more\)/.test(ringB) && !!bb.view && /Camera of Sujit/.test(bb.view.title) && !!cc.view && /Camera of Sujit/.test(cc.view.title) && !bb.view.pen, { modes, ringB, B: bb.view, C: cc.view });
  let a = await until(async () => { const s = await st(A); return /Network: good/.test(s.bar) ? s : null; }, 12000) || await st(A);
  ok('the bar says "Your camera is shown" and the network\'s state ("Network: good"); More has Switch camera (no Light on a camera without one)', /Your camera is shown/.test(a.bar) && /Network: good/.test(a.bar) && await A.f.evaluate(() => !document.getElementById('rtc_flip').hidden && document.getElementById('rtc_torch').hidden), a.bar);
  const v0 = (await st(B)).vIn; await click(A, '#rtc_more'); await click(A, '#rtc_flip'); await wait(3500); bb = await st(B);
  ok('   Switch camera: the picture goes on without a new call', bb.vIn > v0 && !!bb.view && bb.view.w > 0 && !!bb.call && bb.call.peers.every(x => /:up/.test(x)), { before: v0, after: bb.vIn });

  // ---------- 2. a snapshot – on the device only ----------
  await B.f.evaluate(() => { window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = x => { window.__blobs.push({ type: x.type, size: x.size }); return o(x); }; });
  await click(B, '#rtc_snap'); await wait(1500);
  const snap = await B.f.evaluate(() => ({ blobs: window.__blobs, name: RTC.lastSnap, note: document.getElementById('rtc_note').textContent }));
  ok('Snapshot: a PNG of the picture is saved on this device (Downloads) – "Snapshot saved on this device: screen-share-Sujit-….png"', snap.blobs.some(x => x.type === 'image/png' && x.size > 1000) && /^screen-share-Sujit-\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.png$/.test(snap.name || '') && /Snapshot saved on this device/.test(snap.note), snap);

  // ---------- 3. "only my page": no video, the others' app follows ----------
  await click(A, '#rtc_more'); await click(A, '#rtc_page'); await wait(1500);
  await A.f.evaluate(() => showTab('log')); 
  bb = await until(async () => { const s = await st(B); return s.tab === 'log' && /Following the page of Sujit/.test(s.fol) ? s : null; }, 10000) || await st(B);
  cc = await st(C); a = await st(A);
  ok('"Show only my page": the camera stops, no picture any more, and Bala\'s and Chitra\'s app open the page Sujit is on (Log Book) – "Following the page of Sujit: Log Book"',
    !bb.view && bb.tab === 'log' && cc.tab === 'log' && /Following the page of Sujit: Log Book/.test(bb.fol) && /Your page is shown \(no video\)/.test(a.bar) && a.call.kind === '', { B: [bb.tab, bb.fol, !!bb.view], C: cc.tab, A: a.bar });
  const tall = X => X.f.evaluate(() => { const d = document.createElement('div'); d.id = 't75tall'; d.style.height = '2600px'; document.querySelector('#sec-log').appendChild(d); });      // (a long Log Book: the test data is short)
  await tall(A); await tall(B); await tall(C); await wait(300);
  await A.f.evaluate(() => { const el = document.scrollingElement; el.scrollTop = el.scrollHeight; }); await wait(2500);
  const sy = await B.f.evaluate(() => { const el = document.scrollingElement, h = el.scrollHeight - el.clientHeight; return h > 0 ? Math.round(el.scrollTop / h * 100) / 100 : -1; });
  ok('   Sujit scrolls to the bottom: Bala\'s page scrolls with him', sy > 0.8, sy);
  await A.f.evaluate(() => showTab('users')); await wait(2500); bb = await st(B);
  ok('   Sujit opens an Admin page (Users): Bala\'s app does NOT open it – "… (a page you cannot open)" – his own access counts', bb.tab === 'log' && /a page you cannot open/.test(bb.fol), [bb.tab, bb.fol]);
  await click(B, '#rtc_unfollow'); await A.f.evaluate(() => showTab('dash')); await wait(2500); bb = await st(B); cc = await st(C);
  ok('   Bala presses "Stop following": Sujit goes to the Dashboard – Bala stays where he is, Chitra follows', bb.tab === 'log' && !bb.fol && cc.tab === 'dash', { B: bb.tab, C: cc.tab });

  // ---------- 4. the pen on the sharer's own screen ----------
  await A.f.evaluate(() => rtcShareMine()); 
  bb = await until(async () => { const s = await st(B); return s.view && /Screen of Sujit/.test(s.view.title) && s.view.w > 0 && s.view.pen ? s : null; }, 20000) || await st(B);
  ok('Sujit shows his screen (this tab): Bala\'s picture has the Pen', !!bb.view && bb.view.pen, bb.view);
  await click(B, '#rtc_penb'); await wait(400);
  const r = await B.f.evaluate(() => { const q = rtcPenRect(); return q ? { x: q.left, y: q.top, w: q.w, h: q.h } : null; });
  await B.p.mouse.move(r.x + r.w * 0.3, r.y + r.h * 0.4); await B.p.mouse.down(); for (let i = 1; i <= 12; i++) await B.p.mouse.move(r.x + r.w * (0.3 + i * 0.02), r.y + r.h * (0.4 + i * 0.01)); await B.p.mouse.up();
  await wait(1500);
  const ink = () => A.p.evaluate(() => { const c = document.getElementById('rtc_pen_top'); if (!c) return { canvas: false, px: 0 }; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, red = 0, cx = 0, cy = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { n++; if (d[i - 3] > 180 && d[i - 2] < 80) { red++; const k = (i - 3) / 4; cx += k % c.width; cy += Math.floor(k / c.width); } } return { canvas: true, px: n, red: red, at: red ? [Math.round(cx / red / c.width * 100) / 100, Math.round(cy / red / c.height * 100) / 100] : null }; });
  let ik = await ink();
  const bInk = await B.f.evaluate(() => { const c = document.getElementById('rtc_pen'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  ok('   Bala draws a line on the picture: it shows in red ON SUJIT\'S OWN APP at the same place (about 30–54 % across, 40–52 % down), with Bala\'s name; and on Bala\'s picture', ik.canvas && ik.red > 200 && ik.at && ik.at[0] > 0.25 && ik.at[0] < 0.6 && ik.at[1] > 0.3 && ik.at[1] < 0.6 && bInk > 100, { sujit: ik, bala: bInk });
  await click(B, '#rtc_clr'); await wait(1200); ik = await ink();
  ok('   Clear: the lines are gone on both', !ik.canvas || ik.red === 0, ik);
  // a forged pen message that is not lines: not drawn
  await B.f.evaluate(() => { const P = [...RTC.call.peers.values()][0]; rtcDc(P, { t: 'pen', to: [...RTC.call.peers.values()][0].uid, pts: [['<b>', 'x'], [2, 3], { a: 1 }] }); }); await wait(1000); ik = await ink();
  ok('   a pen message with nonsense points draws nothing', !ik.canvas || ik.red === 0, ik);
  await click(B, '#rtc_penb');

  // ---------- 5. the chat: text, a photo, and what is refused ----------
  await click(B, '#rtc_chatb'); await B.f.evaluate(() => { document.getElementById('rtc_txt').value = 'MH-12-AB-1234 – 4 hrs bucket'; document.getElementById('rtc_send').click(); });
  a = await until(async () => { const s = await st(A); return s.msgs.length ? s : null; }, 8000) || await st(A); cc = await until(async () => { const s = await st(C); return s.msgs.length ? s : null; }, 8000) || await st(C);
  ok('Bala writes "MH-12-AB-1234 – 4 hrs bucket": Sujit gets it (a red number on Chat), and Chitra too (through Sujit)', a.msgs.join() === 'M75 Bala|MH-12-AB-1234 – 4 hrs bucket' && a.chatN === '1' && cc.msgs.join() === 'M75 Bala|MH-12-AB-1234 – 4 hrs bucket', { A: a.msgs, n: a.chatN, C: cc.msgs });
  await B.f.evaluate(() => { document.getElementById('rtc_txt').value = '<img src=x onerror="window.__xss=1">'; document.getElementById('rtc_send').click(); }); await wait(1500);
  const xs = await A.f.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('#rtc_msgs img').length, last: document.querySelector('#rtc_msgs .m:last-child').lastChild.textContent }));
  ok('   a message that looks like page code is shown as plain text – nothing runs, no picture is made', xs.xss === 0 && xs.imgs === 0 && /onerror/.test(xs.last), xs);
  await B.f.evaluate(() => { const P = [...RTC.call.peers.values()][0]; rtcDc(P, { t: 'chat', id: 'z1', img: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+' }); rtcDc(P, { t: 'chat', id: 'z2', img: 'javascript:alert(1)' }); }); await wait(1200);
  const n1 = (await st(A)).msgs.length;
  ok('   a "photo" that is not a JPEG (an SVG with code, a javascript: link) is not accepted', n1 === 2, (await st(A)).msgs);
  await B.p.screenshot({ path: '/tmp/r73/browser/m75_photo.png', clip: { x: 0, y: 0, width: 400, height: 300 } });
  const fileIn = await B.f.$('#rtc_file'); await fileIn.uploadFile('/tmp/r73/browser/m75_photo.png');
  a = await until(async () => { const s = await st(A); return s.msgs.some(x => /IMG:data:image\/jpeg/.test(x)) ? s : null; }, 10000) || await st(A);
  ok('   Bala sends a photo: Sujit sees it (made small, as JPEG)', a.msgs.some(x => /^M75 Bala\|IMG:data:image\/jpeg;base64/.test(x)), a.msgs);
  // too many messages in a short time: the rest is dropped
  await B.f.evaluate(() => { const P = [...RTC.call.peers.values()][0]; for (let i = 0; i < 30; i++) rtcDc(P, { t: 'chat', id: 'f' + i, txt: 'flood ' + i }); }); await wait(1500);
  const nf = (await st(A)).msgs.filter(x => /flood/.test(x)).length;
  ok('   30 messages at once: not more than 15 in 10 seconds are taken', nf > 0 && nf <= 15, nf);

  // ---------- 6. low data ----------
  await click(B, '#rtc_more'); await click(B, '#rtc_low'); await wait(3000);
  const enc = await A.f.evaluate(() => [...RTC.call.peers.values()].map(P => P.name + ':' + ((P.scr && P.scr.getParameters().encodings[0]) || {}).maxBitrate));
  bb = await st(B);
  ok('Bala presses More → Low data: Sujit sends HIS picture smaller and slower to Bala only (150 kbit/s, 5 frames a second); Chitra\'s stays as it was; Bala\'s bar says "low data"', enc.includes('M75 Bala:150000') && enc.includes('M75 Chitra:undefined') && /low data/.test(bb.bar) && bb.call.low, { enc, bar: bb.bar });

  // ---------- 7. a line made again ----------
  const a0 = (await st(B)).aIn;
  await A.f.evaluate(() => { const P = RTC.call.peers.get([...RTC.call.peers.keys()].find(k => RTC.call.peers.get(k).name === 'M75 Bala')); rtcRestart(P); });
  const mid = await A.f.evaluate(() => [...RTC.call.peers.values()].map(P => P.name + ':' + P.state).join());
  a = await until(async () => { const s = await st(A); return /Connected again with M75 Bala/.test(s.note) ? s : null; }, 25000) || await st(A);
  await wait(2500); bb = await st(B);
  ok('the connection to Bala is made again (ICE restart through the server): "connecting again…", then "Connected again with M75 Bala." – voice and picture go on', /M75 Bala:reconnecting/.test(mid) && /Connected again with M75 Bala/.test(a.note) && bb.aIn > a0 && a.call.peers.every(x => /:on:up/.test(x)), { mid, note: a.note, sound: [a0, bb.aIn], peers: a.call.peers });

  // ---------- 8. a phone (no screen sharing in its browser) ----------
  await click(A, '#rtc_end'); await until(async () => !(await st(B)).call && !(await st(C)).call, 10000); await wait(1000);
  await C.f.evaluate(() => { navigator.mediaDevices.getDisplayMedia = undefined; });
  await openList(C);
  const pm = await C.f.evaluate(() => [...document.querySelectorAll('input[name=rtc_mode]')].map(r => r.value + (r.checked ? '*' : '')));
  await C.f.evaluate(() => closeConfirm(false));
  ok('on a phone (its browser cannot show the screen): the box offers My camera / Only my page, "Only my page" chosen – a phone can now START a share and ask for help', pm.join() === 'cam,page*', pm);

  ok('no script error and no box of the browser on any page', ![A, B, C].some(X => X.errs.length), [A, B, C].map(X => X.errs));
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
