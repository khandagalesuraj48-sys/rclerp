// update-137 (with App 3.26.0, asked 19-10-2026: "JR SAMAJ EK USER APP WAR AAHE ANI EK USER WEB WAR TRI SUDHA CONNECT HOYLA HAW TE PN
// PROPER") – the WEB page with the PHONE APP's way of calling, on the local rig (bash rig/all.sh – own sign-in on :3000; a pretend camera
// and microphone). A Flutter app cannot run here, so B is "the app": a plain page of the same address that sends exactly the notes and
// data-channel messages of the app's call engine (rcl-mobile lib/core/rtc.dart – its own device name, one person, modes voice / video,
// the answer with every way written in, share {kind, face}, chat, bye) through /api/rpc with B's sign-in, and hears the heartbeat
// ("sync" {r}) as the app does. Test users A137 / B137 only, taken out at the end.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node app137.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port, PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1400) : '')); };
const clean = () => sql("delete from app_users where email in ('a137@rcl.test', 'b137@rcl.test'); delete from web.cache where key like 'RTC%' or key = 'USERS_LIST' or key like 'LG\\_%';");

// ---- "the app": the call engine of App 3.26.0, the same notes and messages, in plain JavaScript ----
const APPJS = `window.APP = (() => {
  const A = { tok: '', dev: 'a' + Math.random().toString(36).slice(2, 12), since: null, seen: new Set(), call: null, ring: null, me: '', name: '', ice: [], people: [], log: [], chat: [], beats: [] };
  const rpc = async (fn, args) => { const r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: 'api', args: [A.tok, fn, args] }) }); const j = await r.json(); if (j.error) throw new Error(j.error); return j.result; };
  const note = (t, to, call, d) => rpc('rtcSend', [{ t: t, to: to, call: call, d: Object.assign({}, d || {}, { dev: A.dev }) }]);
  const json = s => { try { return typeof s === 'string' ? (s ? JSON.parse(s) : {}) : (s || {}); } catch (e) { return {}; } };
  const iceDone = pc => new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 3000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
  const dc = (P, m) => { if (P.dc && P.dc.readyState === 'open') { P.dc.send(JSON.stringify(m)); return true; } return false; };
  function wire(P) { const pc = P.pc;
    pc.ontrack = e => { const C = A.call; if (!C) return; const s = e.streams[0]; if (e.track.kind === 'video') C.vids[s.id] = s; else { const a = new Audio(); a.srcObject = new MediaStream([e.track]); a.play().catch(() => {}); } };
    pc.onconnectionstatechange = () => { const C = A.call; if (C && pc.connectionState === 'connected') { P.up = true; if (!C.t1) C.t1 = Date.now(); if (C.role === 'host') roster(P); } };
    pc.onnegotiationneeded = () => nego(P);
    pc.onicecandidate = e => { if (P.open && e.candidate) dc(P, { t: 'ice', d: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } }); };
    pc.ondatachannel = e => wireDc(P, e.channel); }
  function wireDc(P, ch) { P.dc = ch; ch.onopen = () => { if (P.open) return; P.open = true; hello(P); if (P.dirty) { P.dirty = false; nego(P); } }; ch.onmessage = e => onDc(P, json(e.data)); if (ch.readyState === 'open') ch.onopen(); }
  async function nego(P) { if (!P.open) { P.dirty = true; return; } if (P.making || P.pc.signalingState !== 'stable') { P.again = true; return; }
    try { P.making = true; const o = await P.pc.createOffer(); await P.pc.setLocalDescription(o); dc(P, { t: 'sdp', d: { type: o.type, sdp: o.sdp } }); } catch (e) { P.again = true; } finally { P.making = false; } }
  async function onSdp(P, d) { const ready = !P.making && (P.pc.signalingState === 'stable' || P.answering), clash = d.type === 'offer' && !ready;
    P.ignore = !P.polite && clash; if (P.ignore) return; if (clash) { try { await P.pc.setLocalDescription({ type: 'rollback' }); } catch (e) {} P.again = true; }
    P.answering = d.type === 'answer'; try { await P.pc.setRemoteDescription({ type: d.type, sdp: d.sdp }); } finally { P.answering = false; }
    if (d.type === 'offer') { const a = await P.pc.createAnswer(); await P.pc.setLocalDescription(a); dc(P, { t: 'sdp', d: { type: a.type, sdp: a.sdp } }); }
    if (P.again && P.pc.signalingState === 'stable') { P.again = false; setTimeout(() => nego(P), 200); } }
  const roster = P => dc(P, { t: 'roster', host: { uid: A.me, name: A.name }, people: [{ uid: P.uid, name: P.name, up: P.up }] });
  function hello(P) { const C = A.call; if (!C) return; if (C.role === 'host') roster(P); if (C.cam) dc(P, { t: 'share', on: true, sid: C.cam.id, uid: A.me, name: A.name, ptr: false, kind: 'cam', face: true }); }
  function onDc(P, m) { const C = A.call; if (!C) return; A.log.push('dc:' + m.t);
    if (m.t === 'sdp') onSdp(P, m.d).catch(e => A.log.push('sdp-err ' + e.message));
    else if (m.t === 'ice') { if (m.d && m.d.candidate) P.pc.addIceCandidate(m.d).catch(() => {}); }
    else if (m.t === 'share') { if (m.on) C.shares[m.sid] = m; else delete C.shares[m.sid]; }
    else if (m.t === 'chat') A.chat.push(m);
    else if (m.t === 'roster') C.roster = m;
    else if (m.t === 'bye') { A.ended = m.end ? 'ended' : 'left'; end(true); } }
  function onNote(m) { const d = json(m.d); if ((d.todev && d.todev !== A.dev) || (d.butdev && d.butdev === A.dev)) return; A.log.push('note:' + m.t);
    if (m.t === 'who') { note('here', [m.from], '', { busy: !!(A.call || A.ring), share: true }); return; }
    if (m.t === 'here') return;
    if (m.t === 'ring') { if ((A.call && A.call.id === m.call) || (A.ring && A.ring.call === m.call)) return; if (A.call || A.ring) { note('busy', [m.from], m.call, { why: 'busy', todev: d.dev }); return; }
      A.ring = { call: m.call, from: m.from, name: m.name, dev: d.dev || '', sdp: d.sdp, mode: d.mode || '' }; return; }
    if ((m.t === 'cancel' || m.t === 'bye') && A.ring && A.ring.call === m.call && A.ring.from === m.from) { A.ring = null; A.missed = d.why || 'cancel'; return; }
    if (m.t === 'answer') { const C = A.call, P = C && C.id === m.call ? C.peers[m.from] : null; if (!P) { note('bye', [m.from], m.call, { todev: d.dev, why: 'over' }); return; }
      if (P.dev && P.dev !== d.dev) { note('bye', [m.from], m.call, { todev: d.dev, why: 'elsewhere' }); return; }
      if (!P.dev) { P.dev = d.dev; note('cancel', [m.from], m.call, { butdev: d.dev, why: 'elsewhere' }); }
      if (P.pc.signalingState === 'have-local-offer') P.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }).catch(e => A.log.push('ans-err ' + e.message)); return; }
    const C = A.call; if (!C || C.id !== m.call) return; const P = C.peers[m.from]; if (!P) return;
    if (m.t === 'decline') { A.declined = d.reply || 0; note('cancel', [m.from], m.call, { butdev: d.dev, why: 'declined' }); end(true); } else if (m.t === 'bye' || m.t === 'cancel') { A.ended = 'left'; end(true); } }
  async function beat() { if (!A.tok) return; try { const arg = { r: A.since }; A.beats.push(A.since); const r = await rpc('sync', [arg]); const x = r && r.rtc;
      if (x) { if (typeof x.r === 'number') A.since = x.r; (x.m || []).forEach(m => { if (!m || !m.id || A.seen.has(m.id)) return; A.seen.add(m.id); try { onNote(m); } catch (e) { A.log.push('note-err ' + e.message); } }); } } catch (e) { A.log.push('beat-err ' + e.message); } }
  let T = null; A.go = tok => { A.tok = tok; if (!T) T = setInterval(beat, 1500); beat(); };
  A.users = async () => { const x = await rpc('rtcUsers', []); A.me = x.me; A.name = x.name; A.ice = x.ice || []; A.people = x.users || []; return x; };
  const newCall = (id, role, mode) => ({ id: id, role: role, mode: mode, peers: {}, shares: {}, vids: {}, cam: null, mic: null, t1: 0, roster: null });
  const peer = (uid, name, polite) => { const P = { uid: uid, name: name, polite: polite, pc: new RTCPeerConnection({ iceServers: A.ice }), dev: '', open: false, up: false }; wire(P); return P; };
  A.accept = async () => { const R = A.ring; A.ring = null; await A.users(); const C = A.call = newCall(R.call, 'guest', R.mode); const P = C.peers[R.from] = peer(R.from, R.name, true); P.dev = R.dev;
    C.mic = await navigator.mediaDevices.getUserMedia({ audio: true }); await P.pc.setRemoteDescription({ type: 'offer', sdp: R.sdp }); P.micS = P.pc.addTrack(C.mic.getAudioTracks()[0], C.mic);
    await P.pc.setLocalDescription(await P.pc.createAnswer()); await iceDone(P.pc); await note('answer', [R.from], R.call, { sdp: P.pc.localDescription.sdp, todev: R.dev, ep: '' }); };
  A.decline = reply => { const R = A.ring; A.ring = null; return note('decline', [R.from], R.call, { todev: R.dev, reply: reply || 0, ep: '' }); };
  A.start = async (uid, mode) => { await A.users(); const u = A.people.find(x => x.uid === uid); const C = A.call = newCall('c' + Date.now().toString(36) + 'app', 'host', mode); const P = C.peers[uid] = peer(uid, u.name, false);
    C.mic = await navigator.mediaDevices.getUserMedia({ audio: true }); if (mode === 'video') C.cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720, frameRate: 24 } });
    wireDc(P, P.pc.createDataChannel('rcl')); P.micS = P.pc.addTrack(C.mic.getAudioTracks()[0], C.mic); if (C.cam) P.camS = P.pc.addTrack(C.cam.getVideoTracks()[0], C.cam);
    await P.pc.setLocalDescription(await P.pc.createOffer()); await iceDone(P.pc); await note('ring', [uid], C.id, { sdp: P.pc.localDescription.sdp, people: [u.name], mode: mode }); return C.id; };
  A.cam = async () => { const C = A.call; C.cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720, frameRate: 24 } });
    for (const P of Object.values(C.peers)) { P.camS = P.pc.addTrack(C.cam.getVideoTracks()[0], C.cam); dc(P, { t: 'share', on: true, sid: C.cam.id, uid: A.me, name: A.name, ptr: false, kind: 'cam', face: true }); } };
  A.camOff = () => { const C = A.call, s = C.cam; C.cam = null; for (const P of Object.values(C.peers)) { if (P.camS) { P.pc.removeTrack(P.camS); P.camS = null; } dc(P, { t: 'share', on: false, sid: s.id, uid: A.me }); } s.getTracks().forEach(t => t.stop()); };
  A.chatSend = txt => { for (const P of Object.values(A.call.peers)) dc(P, { t: 'chat', id: Math.random().toString(36).slice(2, 10), uid: A.me, name: A.name, txt: txt }); };
  A.who = () => note('who', [], '', {});
  function end(quiet) { const C = A.call; if (!C) return; A.call = null; for (const P of Object.values(C.peers)) dc(P, { t: 'bye', end: C.role === 'host' });
    if (C.role === 'host' && C.t1) rpc('rtcSend', [{ t: 'end', to: Object.keys(C.peers), call: C.id, secs: Math.round((Date.now() - C.t1) / 1000) }]).catch(() => {});
    setTimeout(() => { for (const P of Object.values(C.peers)) { try { P.pc.close(); } catch (e) {} } [C.mic, C.cam].forEach(s => s && s.getTracks().forEach(t => t.stop())); }, 300); }
  A.end = () => end(false);
  A.state = async () => { const C = A.call; let aIn = 0, vIn = 0; if (C) for (const P of Object.values(C.peers)) { try { (await P.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp') { if (r.kind === 'audio') aIn += r.packetsReceived || 0; else vIn += r.packetsReceived || 0; } }); } catch (e) {} }
    return { ring: A.ring ? { name: A.ring.name, mode: A.ring.mode } : null, call: !!C, up: !!(C && Object.values(C.peers).some(P => P.up)), shares: C ? Object.values(C.shares).map(s => s.name + ':' + s.kind + (s.face ? ':face' : '')) : [],
      vids: C ? Object.keys(C.vids).length : 0, aIn: aIn, vIn: vIn, chat: A.chat.map(m => m.name + ': ' + m.txt), ended: A.ended || '', missed: A.missed || '', declined: A.declined, roster: C && C.roster ? C.roster.host.name : '', beats: A.beats.slice(0, 3), log: A.log.slice(-10) }; };
  return A;
})();`;

(async () => {
  let b = null; const errs = [];
  try {
    clean();
    sql("insert into app_users (id, email, password_hash, name, active, admin) select 'a137', 'a137@rcl.test', password_hash, 'A 137 Asha', 'Yes', 'No' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'b137', 'b137@rcl.test', password_hash, 'B 137 Bala', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
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
    const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
    const W = await session('a137@rcl.test');
    // B: signed in (as the app is, with its own sign-in), then the web page is left – a plain page of the same address speaks as the app
    const Bw = await session('b137@rcl.test'); const tok = await Bw.f.evaluate(() => S.token);
    await Bw.p.goto(BASE + '/app-137-not-a-page', { waitUntil: 'load' }); await Bw.p.evaluate(APPJS); await Bw.p.evaluate(t => APP.go(t), tok);
    const app = () => Bw.p.evaluate(() => APP.state());
    const web = () => W.f.evaluate(async () => { const C = RTC.call, v = document.getElementById('rtc_view');
      const faces = [...document.querySelectorAll('#rtc_faces .rtc-face')].map(el => { const vd = el.querySelector('video'); return el.querySelector('b').textContent + (el.classList.contains('me') ? '(me)' : '') + (vd.videoWidth > 0 ? ':live' : ':dark'); });
      let aIn = 0; if (C) for (const P of C.peers.values()) { try { (await P.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') aIn += r.packetsReceived || 0; }); } catch (e) {} }
      const P = C ? [...C.peers.values()][0] : null;
      return { call: !!C, up: !!(P && P.up), ring: !document.getElementById('rtc_in').hidden ? document.getElementById('rtc_in_t').textContent + ' | ' + document.getElementById('rtc_in_s').textContent : '', faces: faces,
        view: !v.hidden ? document.getElementById('rtc_vt').textContent : '', msgs: [...document.querySelectorAll('#rtc_msgs .m')].map(m => m.textContent), note: document.getElementById('rtc_note').hidden ? '' : document.getElementById('rtc_note').textContent, aIn: aIn }; });

    // ---- 1. the web asks "who is at the app?": the app says it is here ----
    const beats0 = (await until(async () => { const s = await app(); return s.beats.length >= 2 ? s : null; }, 8000) || await app()).beats;
    ok('1a. the app\'s heartbeat: first "just opened" (r null), then up to the note read', beats0[0] === null && typeof beats0[1] === 'number', beats0);
    await W.f.evaluate(() => document.getElementById('u_share').click()); await until(() => W.f.evaluate(() => !!document.querySelector('#rtc_list')), 8000);
    const here = await until(() => W.f.evaluate(() => { const sp = document.querySelector('#rtc_list [data-st]:not([data-st=""])'); const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === 'B 137 Bala'); const s = l && l.querySelector('[data-st]'); return s && /at the app now/.test(s.textContent) ? s.textContent : null; }), 12000);
    ok('1b. the web\'s list: B (on the app) "at the app now"', !!here, here);
    // ---- 2. the web calls the app (its screen); the app answers ----
    await W.f.evaluate(() => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === 'B 137 Bala'); const c = l.querySelector('input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('cf_ok').click(); });
    let a = await until(async () => { const s = await app(); return s.ring ? s : null; }, 15000) || await app();
    ok('2a. the web rings the app: the ring comes with the heartbeat (' + JSON.stringify(a.ring) + ')', !!a.ring && a.ring.name === 'A 137 Asha' && a.ring.mode === 'screen', a);
    await Bw.p.evaluate(() => APP.accept());
    a = await until(async () => { const s = await app(); return s.up && s.vids > 0 && s.aIn > 20 && s.shares.some(x => /screen/.test(x)) ? s : null; }, 25000) || await app();
    let w = await until(async () => { const s = await web(); return s.up && s.aIn > 20 ? s : null; }, 15000) || await web();
    ok('2b. the app accepts: connected – the app gets A\'s screen (' + JSON.stringify(a.shares) + ', ' + a.vids + ' picture) and his voice (' + a.aIn + ' packets), the roster ("' + a.roster + '"); the web hears the app (' + w.aIn + ')',
      a.up && a.vids > 0 && a.aIn > 20 && a.shares.join() === 'A 137 Asha:screen' && a.roster === 'A 137 Asha' && w.up && w.aIn > 20, { a, w });
    // ---- 3. the app shows its camera (a face): the web sees it at the side; chat both ways ----
    await Bw.p.evaluate(() => APP.cam());
    w = await until(async () => { const s = await web(); return s.faces.some(f => /^B 137 Bala:live/.test(f)) ? s : null; }, 20000) || await web();
    ok('3a. the app shows its front camera: the web sees B\'s face at the side ' + JSON.stringify(w.faces), w.faces.some(f => /^B 137 Bala:live/.test(f)), w);
    await Bw.p.evaluate(() => APP.chatSend('Hello from the app'));
    w = await until(async () => { const s = await web(); return s.msgs.some(m => /Hello from the app/.test(m)) ? s : null; }, 8000) || await web();
    await W.f.evaluate(() => { document.getElementById('rtc_txt').value = 'Hello from the web'; document.getElementById('rtc_chat_f').dispatchEvent(new Event('submit', { cancelable: true })); });
    a = await until(async () => { const s = await app(); return s.chat.length ? s : null; }, 8000) || await app();
    ok('3b. chat: the web shows the app\'s message ' + JSON.stringify(w.msgs) + '; the app gets the web\'s ' + JSON.stringify(a.chat), w.msgs.some(m => /B 137 Bala.*Hello from the app/.test(m)) && a.chat.some(m => /A 137 Asha: Hello from the web/.test(m)), { w: w.msgs, a: a.chat });
    await W.p.screenshot({ path: SHOTS + 'app137_web_sees_app.png' });
    await Bw.p.evaluate(() => APP.camOff());
    w = await until(async () => { const s = await web(); return !s.faces.some(f => /^B 137 Bala/.test(f)) ? s : null; }, 15000) || await web();
    ok('3c. the app stops its camera: its face goes at the web', !w.faces.some(f => /^B 137 Bala/.test(f)), w.faces);
    // ---- 4. the web ends: the app hears "bye" (ended) ----
    await W.f.evaluate(() => document.getElementById('rtc_end').click());
    a = await until(async () => { const s = await app(); return !s.call ? s : null; }, 8000) || await app();
    ok('4. the web ends the call: the app\'s call ends ("' + a.ended + '")', !a.call && a.ended === 'ended', a);
    await wait(1500);
    // ---- 5. the APP calls the web – a voice call: the web says it as a call (update-137) ----
    const meW = await W.f.evaluate(() => RTC.me);
    await Bw.p.evaluate(u => APP.start(u, 'voice'), meW);
    w = await until(async () => { const s = await web(); return s.ring ? s : null; }, 15000) || await web();
    ok('5a. the app calls the web (voice): the web\'s ring says "' + w.ring + '"', /^B 137 Bala is calling you – voice call/.test(w.ring) && /A call from the phone app, with voice/.test(w.ring), w);
    await W.p.screenshot({ path: SHOTS + 'app137_web_ring.png' });
    await W.f.evaluate(() => document.getElementById('rtc_yes').click());
    a = await until(async () => { const s = await app(); return s.up && s.aIn > 20 ? s : null; }, 25000) || await app();
    w = await until(async () => { const s = await web(); return s.up && s.aIn > 20 ? s : null; }, 15000) || await web();
    ok('5b. the web accepts: connected, voices both ways (app ' + a.aIn + ', web ' + w.aIn + ' packets)', a.up && a.aIn > 20 && w.up && w.aIn > 20, { a, w });
    // the web shows its screen to the app (a guest's screen goes to the app, the host)
    await W.f.evaluate(() => { const b0 = document.getElementById('rtc_share'); if (b0) b0.click(); });
    a = await until(async () => { const s = await app(); return s.shares.some(x => /A 137 Asha:screen/.test(x)) && s.vids > 0 ? s : null; }, 20000) || await app();
    ok('5c. the web shows its screen in the app\'s call: the app gets it (' + JSON.stringify(a.shares) + ')', a.shares.some(x => /A 137 Asha:screen/.test(x)) && a.vids > 0, a);
    await Bw.p.evaluate(() => APP.end());
    w = await until(async () => { const s = await web(); return !s.call ? s : null; }, 10000) || await web();
    ok('5d. the app ends: the web\'s call ends too ("' + w.note + '")', !w.call && /B 137 Bala ended the screen share/.test(w.note), w);
    await wait(1500);
    const log = sql("select count(*) from activity_log where summary like '%B 137 Bala%' and (summary like '%joined the screen share%' or summary like '%ended after%')");
    ok('5e. the Activity Log has the joining and the end of the app\'s call (' + log + ' lines)', Number(log) >= 2, log);
    // ---- 6. the app calls again (video); the web declines with a reply ----
    await Bw.p.evaluate(u => APP.start(u, 'video'), meW);
    w = await until(async () => { const s = await web(); return s.ring ? s : null; }, 15000) || await web();
    ok('6a. a video call from the app: "' + w.ring.split(' | ')[0] + '"', /is calling you – video call/.test(w.ring), w);
    await W.f.evaluate(() => { document.getElementById('rtc_rep').click(); }); await wait(300);
    await W.f.evaluate(() => { const r = document.querySelector('#rtc_rep_m [data-reply="2"]'); if (r) r.click(); });
    a = await until(async () => { const s = await app(); return !s.call ? s : null; }, 12000) || await app();
    ok('6b. the web declines with a reply: the app\'s call ends with reply ' + a.declined, !a.call && a.declined === 2, a);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { clean(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the pages', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
