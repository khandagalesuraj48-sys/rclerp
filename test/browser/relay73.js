// update-73 (asked 10-10-2026): screen share THROUGH A RELAY. His call to a friend far away rang, was accepted and then stayed at
//   "connecting": the two networks did not let the computers reach each other directly. With a relay (TURN server) set in the
//   hosting's settings the pages get its address, and a connection that cannot be made directly goes through it.
//   Here: a server with the rig's own small relay set (turn-standin.js on 127.0.0.1:3478), port 3009.
//   1. both pages are told to use ONLY the relay (as if no direct way existed) → the call connects, picture and sound arrive,
//      and the browser itself reports that the connection runs through the relay;  2. left to choose, on one computer, the
//      direct way is taken (the relay is only the way out);  3. (when a second port is given: a server whose relay password
//      is WRONG) the call does not connect and the page says that the relay could not be reached, with the advice box.
// Real browsers (two separate sign-ins) on the local rig; the browser is started with a pretend microphone and with
// "share this tab" answered by itself (nobody is there to press Allow).
//   node relay73.js [port of a server with the relay set – 3009] [port of a server with a wrong relay password – none]
// The relay of the rig is turn-standin.js (needs `npm install node-turn` in the test folder – it is not in package.json).
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3009', BASE = 'http://127.0.0.1:' + port, port2 = process.argv[3] || '', BASE2 = port2 ? 'http://127.0.0.1:' + port2 : '';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from app_users where email like 'r73%@rcl.test'; delete from activity_log where module = 'Screen Share'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'RTC%' or key = 'USERS_LIST';");
const raw = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mods = (await raw({ fn: 'api', args: [admin, 'usersAdmin', []] })).result;
  const MOD = (mods.modules || Object.keys((mods.users || [])[0].perms || {}));
  const mk = async name => { const email = 'r73' + name.toLowerCase() + '@rcl.test', p = {}; MOD.forEach(m => { p[m] = m === 'Log Book' || m === 'Dashboard' ? 'Edit' : 'None'; });
    const a = await raw({ fn: 'api', args: [admin, 'saveUserAdmin', [{ email, name: 'R73 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]] }); if (a.error) throw new Error(a.error);
    const l = await raw({ fn: 'login', args: [email, 'Temp#' + name + '1'] }), pw = 'Own#' + name + '2468'; const c = await raw({ fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] }); if (c.error) throw new Error(c.error); return { email, pw, name: 'R73 ' + name }; };
  const UB = await mk('Bala'), UC = await mk('Chitra');
  sql("delete from web.cache where key like 'LG\\_%'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000,
    args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const session = async (email, pw, base) => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
    await p.setViewport({ width: 1536, height: 900 }); await p.goto((base || BASE) + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(e => { try { localStorage.setItem('oc_brief_' + e, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (er) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', pw); await f.click('#lg_btn'); await wait(5000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    return { p, f, errs, ctx }; };
  const A = await session('sujit@rcl.test', 'Nashik#Road848!'), B = await session(UB.email, UB.pw), C = await session(UC.email, UC.pw);
  // what a page shows of the screen share
  const st = X => X.f.evaluate(async () => { const C = RTC.call, v = document.getElementById('rtc_video'), vis = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
    const stats = async kind => { let n = 0; if (C) for (const P of C.peers.values()) { try { (await P.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === kind) n += r.packetsReceived || 0; }); } catch (e) {} } return n; };
    return { call: C ? { role: C.role, peers: [...C.peers.values()].map(P => P.name + ':' + P.state + (P.up ? ':up' : '') + (P.open ? ':dc' : '')), screen: !!C.screen, selfTab: C.selfTab, mic: !!C.mic, micOn: C.micOn, audio: C.audio.length, shares: Object.keys(C.shares).map(k => C.shares[k].name + (C.shares[k].ptr ? '(ptr)' : '')), view: C.view ? (C.shares[C.view] || {}).name : '' } : null,
      ring: RTC.ring ? RTC.ring.name : '', inBox: vis('rtc_in') ? document.getElementById('rtc_in_t').textContent : '', bar: vis('rtc_bar') ? document.getElementById('rtc_bar').textContent.replace(/\s+/g, ' ').trim() : '', note: vis('rtc_note') ? document.getElementById('rtc_note').textContent : '',
      view: vis('rtc_view') ? { title: document.getElementById('rtc_vt').textContent, w: v.videoWidth, h: v.videoHeight, t: v.currentTime, open: vis('rtc_open') ? document.getElementById('rtc_open').textContent : '', hint: document.getElementById('rtc_hint').textContent, size: document.getElementById('rtc_view').dataset.size, tabs: [...document.querySelectorAll('#rtc_tabs button')].map(x => x.textContent) } : null,
      aIn: await stats('audio'), vIn: await stats('video'), tab: S.curTab, toast: !document.getElementById('toast').hidden ? document.getElementById('toast').textContent : '', fix: document.getElementById('fixbox') && !document.getElementById('fixbox').hidden ? document.getElementById('fixbox').textContent.replace(/\s+/g, ' ').slice(0, 200) : '' }; });
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
  const click = (X, sel) => X.f.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  // A opens the list, ticks the names, presses "Share screen"
  const pickList = X => X.f.evaluate(() => [...document.querySelectorAll('#rtc_list .rtc-u')].map(l => l.querySelector('b').textContent + ' – ' + l.querySelector('.rtc-st').textContent));
  const openList = async X => { await X.f.evaluate(() => { const l = document.getElementById('rtc_list'); if (l) l.remove(); }); await click(X, '#u_share'); await until(() => X.f.evaluate(() => !!RTC.pick && !document.getElementById('cf_back').hidden && !!document.querySelector('#rtc_list')), 8000); await wait(150); };
  const tick = (X, name) => X.f.evaluate(n => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === n); if (!l) return false; const c = l.querySelector('input'); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); return c.checked; }, name);
  const shareWith = async (X, names) => { await openList(X); for (const n of names) await tick(X, n); await X.f.evaluate(() => document.getElementById('cf_ok').click()); };

  const way = X => X.f.evaluate(async () => { const C = RTC.call; if (!C) return null; const o = []; for (const P of C.peers.values()) { const st = await P.pc.getStats(), by = {}; let pair = null; st.forEach(r => { by[r.id] = r; if (r.type === 'transport' && r.selectedCandidatePairId) pair = r.selectedCandidatePairId; }); const cp = by[pair] || {}; o.push({ via: P.via, local: (by[cp.localCandidateId] || {}).candidateType, remote: (by[cp.remoteCandidateId] || {}).candidateType, relayAddr: (by[cp.localCandidateId] || {}).address }); } return o; });
  const info = await A.f.evaluate(async () => { const x = await rawCall('rtcUsers'); return { relay: x.relay, urls: (x.ice[x.ice.length - 1] || {}).urls, hasName: !!(x.ice[x.ice.length - 1] || {}).username }; });
  ok('the server has a relay set: the pages are given its address over UDP and over TCP, with the name and password to use it', info.relay === true && /turn:127\.0\.0\.1:3478\?transport=udp/.test(String(info.urls)) && /transport=tcp/.test(String(info.urls)) && info.hasName, info);

  // ---------- 1. ONLY the relay may be used (as between two networks that cannot reach each other) ----------
  await A.f.evaluate(() => { RTC.policy = 'relay'; }); await B.f.evaluate(() => { RTC.policy = 'relay'; });
  await shareWith(A, ['R73 Bala']);
  let bb = await until(async () => { const s = await st(B); return s.inBox ? s : null; }, 14000);
  await click(B, '#rtc_yes');
  bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 && s.vIn > 0 && s.aIn > 0 ? s : null; }, 30000) || await st(B);
  let a = await until(async () => { const s = await st(A); return s.call && s.call.peers.some(x => /:up:dc/.test(x)) && s.aIn > 0 && /through the relay/.test(s.bar) ? s : null; }, 12000) || await st(A);
  const wA = await way(A), wB = await way(B); const t1 = bb.view ? bb.view.t : 0, v1 = bb.vIn; await A.f.evaluate(() => showTab('log')); await wait(2500); const bb2 = await st(B);      // (A changes his page, so that there is something new to show)
  ok('with no direct way allowed, the call CONNECTS through the relay: B sees A\'s screen (moving) and hears him, A hears B; the browser reports the connection as "relay" on both sides and the bars say "through the relay"',
    !!bb.view && bb.view.w > 100 && bb2.view && (bb2.view.t > t1 || bb2.vIn > v1) && /Log Book/.test(bb2.view.open) && bb.aIn > 0 && a.aIn > 0 && wA && wA[0].local === 'relay' && wB && wB[0].local === 'relay' && wA[0].via === 'relay' && /through the relay/.test(a.bar) && /through the relay/.test(bb2.bar),
    { A: { way: wA, bar: a.bar, sound: a.aIn }, B: { way: wB, picture: bb.view && (bb.view.w + 'x' + bb.view.h), sound: bb.aIn, clockMoved: bb2.view ? Math.round((bb2.view.t - t1) * 100) / 100 : 0, picturePackets: [v1, bb2.vIn], pageTold: bb2.view && bb2.view.open } });
  await B.p.screenshot({ path: '/home/claude/test/shots/relay73_view.png' });
  // B shows his screen too (a change agreed over the connection that runs through the relay)
  await click(B, '#rtc_share');
  a = await until(async () => { const s = await st(A); return s.view && /R73 Bala/.test(s.view.title) && s.view.w > 0 ? s : null; }, 15000) || await st(A);
  ok('   B shows his own screen over that same relayed connection: A sees it', !!a.view && /Screen of R73 Bala/.test(a.view.title), a.view);
  await click(A, '#rtc_end'); await until(async () => !(await st(B)).call, 8000);

  // ---------- 2. left to choose: the direct way is taken when there is one ----------
  await A.f.evaluate(() => { RTC.policy = ''; }); await B.f.evaluate(() => { RTC.policy = ''; });
  await shareWith(A, ['R73 Bala']); await until(async () => (await st(B)).inBox, 14000); await click(B, '#rtc_yes');
  bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 && s.aIn > 0 ? s : null; }, 30000) || await st(B);
  await wait(1200); a = await st(A); const wA2 = await way(A);
  ok('the same two pages left to choose (both on one computer): they connect DIRECTLY – the relay is only used when there is no direct way; the bar says "direct connection", not "through the relay"', !!bb.view && wA2 && wA2[0].local !== 'relay' && wA2[0].remote !== 'relay' && wA2[0].via === 'direct' && !/through the relay/.test(a.bar) && /direct connection/.test(a.bar), { way: wA2, bar: a.bar });
  await click(A, '#rtc_end'); await until(async () => !(await st(B)).call, 8000);

  ok('no script error on the pages', !A.errs.length && !B.errs.length, [A.errs, B.errs]);

  // ---------- 3. a relay whose password is written wrongly in the hosting, and no direct way ----------
  if (BASE2) {
    await A.ctx.close(); await B.ctx.close(); await C.ctx.close(); await wait(1500);
    const A2 = await session('sujit@rcl.test', 'Nashik#Road848!', BASE2), B2 = await session(UB.email, UB.pw, BASE2);
    await A2.f.evaluate(() => { RTC.policy = 'relay'; }); await B2.f.evaluate(() => { RTC.policy = 'relay'; });
    const t0 = Date.now(); await shareWith(A2, ['R73 Bala']);
    const rung = await until(async () => (await st(B2)).inBox, 20000); const tRing = Date.now() - t0; await click(B2, '#rtc_yes');
    const seen = await until(async () => { const a2 = await st(A2), b2 = await st(B2); return /relay could not be reached/.test(a2.toast + ' ' + b2.toast) ? { a: a2, b: b2 } : null; }, 45000);
    let a2 = seen ? seen.a : await st(A2), b2 = seen ? seen.b : await st(B2);
    // each page finds it out by itself (about 25 s after the answer): wait for the other one too
    const both = await until(async () => { const x = await st(A2), y = await st(B2); if (/relay could not be reached/.test(x.toast)) a2 = x; if (/relay could not be reached/.test(y.toast)) b2 = y; return /relay could not be reached/.test(a2.toast) && /relay could not be reached/.test(b2.toast); }, 15000);
    const said = a2; await wait(1500); const a3 = await st(A2), b3 = await st(B2);
    ok('a relay with a WRONG password and no direct way: the ring still arrives, the call does NOT connect, and BOTH pages – the one who started and the one who accepted – say that the relay could not be reached (address, name or password in the hosting settings), with the advice box; no call is left hanging on either page',
      !!rung && !!seen && !!both && /could not connect to R73 Bala/.test(a2.toast) && /could not connect to Sujit/.test(b2.toast) && /hosting settings/.test(said.toast) && !!said.fix && !a3.call && !b3.call && !a2.view && !b2.view,
      { ringAfterMs: tRing, saidAfterMs: Date.now() - t0, A: a2.toast.slice(0, 260), B: b2.toast.slice(0, 260), advice: said.fix.slice(0, 160), callLeft: [!!a3.call, !!b3.call] });
    ok('   no script error on those pages', !A2.errs.length && !B2.errs.length, [A2.errs, B2.errs]);
  } else out.push('NOTE part 3 (a wrong relay password) was not run: no second port given');
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
