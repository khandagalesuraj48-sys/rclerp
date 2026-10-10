// update-72 (asked 10-10-2026): screen share with voice between users of the app – one to one.
//   A picks B from the list → B's page rings → Accept → B sees A's screen live, both hear each other;
//   the page A is on can be opened by B in his own app; B's click on the picture shows a ring on A's screen;
//   B can show his own screen too; mute; end; decline; cancel; busy; the Activity Log.
// Real browsers (two separate sign-ins) on the local rig; the browser is started with a pretend microphone and with
// "share this tab" answered by itself (nobody is there to press Allow).   node screen72.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from app_users where email like 's72%@rcl.test'; delete from activity_log where module = 'Screen Share'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'RTC%' or key = 'USERS_LIST';");
const raw = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mods = (await raw({ fn: 'api', args: [admin, 'usersAdmin', []] })).result;
  const MOD = (mods.modules || Object.keys((mods.users || [])[0].perms || {}));
  const mk = async name => { const email = 's72' + name.toLowerCase() + '@rcl.test', p = {}; MOD.forEach(m => { p[m] = m === 'Log Book' || m === 'Dashboard' ? 'Edit' : 'None'; });
    const a = await raw({ fn: 'api', args: [admin, 'saveUserAdmin', [{ email, name: 'S72 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]] }); if (a.error) throw new Error(a.error);
    const l = await raw({ fn: 'login', args: [email, 'Temp#' + name + '1'] }), pw = 'Own#' + name + '2468'; const c = await raw({ fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] }); if (c.error) throw new Error(c.error); return { email, pw, name: 'S72 ' + name }; };
  const UB = await mk('Bala'), UC = await mk('Chitra'); await mk('Dev');
  sql("delete from web.cache where key like 'LG\\_%'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000,
    args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const session = async (email, pw) => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
    await p.setViewport({ width: 1536, height: 900 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200);
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

  // ---------- 1. the list: who is at the app now ----------
  await openList(A);
  const l0 = await pickList(A);
  const l1 = await until(async () => { const l = await pickList(A); return l.filter(x => /at the app now$/.test(x)).length >= 2 && l.some(x => /S72 Dev – not at the app now/.test(x)) ? l : null; }, 12000) || await pickList(A);
  ok('the screen button at the top opens the list of the other users; within seconds it says who is at the app now (Bala, Chitra) and who is not (Dev)',
    l0.length >= 3 && l0.every(x => !/@/.test(x)) && !l0.some(x => /^Sujit/.test(x)) && /S72 Bala – at the app now/.test(l1.join(' | ')) && /S72 Chitra – at the app now/.test(l1.join(' | ')) && /S72 Dev – not at the app now/.test(l1.join(' | ')), { first: l0, later: l1 });
  await A.f.evaluate(() => document.querySelector('table, body').scrollIntoView && null); await A.p.screenshot({ path: '/home/claude/test/shots/screen72_list.png' });
  // more than 3 cannot be ticked; nothing ticked is told
  await A.f.evaluate(() => document.getElementById('cf_ok').click()); await wait(700);
  let a = await st(A);
  ok('   "Share screen" with nobody ticked: told to pick a user, nothing starts', !a.call && /pick the user to share with/.test(a.toast), a.toast);

  // ---------- 2. A shares with B: ring, accept, picture and voice ----------
  await shareWith(A, ['S72 Bala']);
  a = await until(async () => { const s = await st(A); return s.call ? s : null; }, 8000);
  ok('A ticks Bala and presses Share screen: A\'s bar says "Calling S72 Bala (ringing)", his screen is being shown (this tab), the microphone is on', a && /Calling S72 Bala \(ringing\)/.test(a.bar) && a.call.screen && a.call.selfTab && a.call.mic && /Your screen is shown/.test(a.bar), a && { bar: a.bar, call: a.call });
  let bb = await until(async () => { const s = await st(B); return s.inBox ? s : null; }, 10000);
  ok('B\'s page rings within seconds: "Sujit wants to show you a screen" with Accept / Decline; C gets nothing', bb && /Sujit wants to show you a screen/.test(bb.inBox) && !(await st(C)).inBox, bb && bb.inBox);
  await B.p.screenshot({ path: '/home/claude/test/shots/screen72_ring.png' });
  await click(B, '#rtc_yes');
  bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 && s.vIn > 0 && s.aIn > 0 ? s : null; }, 25000) || await st(B);
  a = await until(async () => { const s = await st(A); return s.call && s.call.peers.some(x => /:up:dc/.test(x)) && s.aIn > 0 ? s : null; }, 10000) || await st(A);
  const t1 = bb.view ? bb.view.t : 0; await wait(1500); const bb2 = await st(B);
  ok('B accepts: B SEES A\'s screen ("Screen of Sujit", a moving picture ' + (bb.view ? bb.view.w + '×' + bb.view.h : '?') + ') and HEARS A (sound is arriving); A hears B; both bars say who is in the call',
    !!bb.view && /Screen of Sujit/.test(bb.view.title) && bb.view.w > 100 && bb2.view && bb2.view.t > t1 && bb.aIn > 0 && a.aIn > 0 && /Screen share with S72 Bala/.test(a.bar) && /Screen share with Sujit/.test(bb.bar) && bb.call.audio === 1 && a.call.audio === 1,
    { B: { view: bb.view, soundPackets: bb.aIn, picturePackets: bb.vIn, bar: bb.bar, movedSeconds: bb2.view ? Math.round((bb2.view.t - t1) * 100) / 100 : 0 }, A: { soundPackets: a.aIn, bar: a.bar, peers: a.call && a.call.peers } });
  await wait(600); await B.p.screenshot({ path: '/home/claude/test/shots/screen72_view.png' });

  // ---------- 3. the same page, the pointer ----------
  await A.f.evaluate(() => showTab('log')); 
  bb = await until(async () => { const s = await st(B); return s.view && /Log Book/.test(s.view.open) ? s : null; }, 6000) || await st(B);
  ok('A goes to the Log Book page: B is offered "Open this page here: Log Book"', !!bb.view && /Open this page here: Log Book/.test(bb.view.open), bb.view && bb.view.open);
  await click(B, '#rtc_open'); await wait(900); bb = await st(B);
  ok('   B presses it: B\'s OWN app opens the Log Book page (he works there with his own sign-in); the picture goes small and stays', bb.tab === 'log' && bb.view && bb.view.size === 's' && !bb.view.open, { tab: bb.tab, size: bb.view && bb.view.size });
  await A.f.evaluate(() => showTab('users')); await wait(1500); bb = await st(B);
  ok('   A (Admin) goes to Users & Access: B, who has no such page in his menu, is NOT offered to open it', bb.view && !bb.view.open && bb.tab === 'log', bb.view && bb.view.open);
  await A.f.evaluate(() => showTab('log')); await wait(600);
  // B clicks in the middle of the picture
  const ptrAt = await B.f.evaluate(() => { const v = document.getElementById('rtc_video'); if (!v.videoWidth) return { hint: 'no picture' }; const r = v.getBoundingClientRect(), k = Math.min(r.width / v.videoWidth, r.height / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k, x = r.left + (r.width - w) / 2 + w * 0.25, y = r.top + (r.height - h) / 2 + h * 0.6; v.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y })); return { hint: document.getElementById('rtc_hint').textContent }; });
  const ring = await until(() => A.p.evaluate(() => { const d = document.querySelector('[data-rtc-ptr]'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: Math.round((r.left + r.width / 2) / innerWidth * 100) / 100, y: Math.round((r.top + r.height / 2) / innerHeight * 100) / 100, by: d.textContent }; }), 5000);
  ok('B clicks on the picture (a quarter from the left, 60 % down): a red ring with his name shows at that very place on A\'s screen', !!ring && Math.abs(ring.x - 0.25) < 0.02 && Math.abs(ring.y - 0.6) < 0.02 && /S72 Bala/.test(ring.by) && /red ring/.test(ptrAt.hint), { ring, hint: ptrAt.hint });
  await A.p.screenshot({ path: '/home/claude/test/shots/screen72_pointer.png' });
  const gone = await until(() => A.p.evaluate(() => !document.querySelector('[data-rtc-ptr]')), 6000);
  ok('   the ring goes away by itself after a few seconds', !!gone, gone);

  // ---------- 4. B shows his own screen too; stops it; mute ----------
  await click(B, '#rtc_share');
  a = await until(async () => { const s = await st(A); return s.view && /S72 Bala/.test(s.view.title) && s.view.w > 0 ? s : null; }, 15000) || await st(A);
  bb = await st(B);
  ok('B presses "Show my screen": A now sees "Screen of S72 Bala" – both screens are shown at the same time, in the same call', !!a.view && /Screen of S72 Bala/.test(a.view.title) && a.view.w > 100 && /Your screen is shown/.test(bb.bar) && /Stop showing my screen/.test(bb.bar) && bb.view && /Sujit/.test(bb.view.title), { A: a.view, B: bb.bar });
  await click(B, '#rtc_share');
  a = await until(async () => { const s = await st(A); return !s.view ? s : null; }, 10000) || await st(A); bb = await st(B);
  ok('   B stops showing: the picture closes at A; the call goes on (B still sees A\'s screen)', !a.view && a.call && /Your screen is not shown/.test(bb.bar) && !!bb.view && /Sujit/.test(bb.view.title), { A: a.view, B: bb.bar });
  // both change something at the very same moment: A stops showing and shows again while B starts showing
  await click(A, '#rtc_share'); await until(async () => !(await st(B)).view, 8000);
  await Promise.all([click(A, '#rtc_share'), click(B, '#rtc_share')]);
  a = await until(async () => { const s = await st(A); return s.view && /S72 Bala/.test(s.view.title) && s.view.w > 0 ? s : null; }, 20000) || await st(A);
  bb = await until(async () => { const s = await st(B); return s.view && /Sujit/.test(s.view.title) && s.view.w > 0 ? s : null; }, 20000) || await st(B);
  ok('A and B press "Show my screen" at the same moment: both screens arrive – A sees B\'s, B sees A\'s (neither change is lost)', !!a.view && /S72 Bala/.test(a.view.title) && !!bb.view && /Sujit/.test(bb.view.title) && /Your screen is shown/.test(a.bar) && /Your screen is shown/.test(bb.bar), { A: a.view && a.view.title, B: bb.view && bb.view.title });
  await click(B, '#rtc_share'); await until(async () => !(await st(A)).view, 8000);
  await click(A, '#rtc_mic'); a = await st(A); const muted = await A.f.evaluate(() => RTC.call.mic.getAudioTracks().every(t => !t.enabled));
  ok('A presses Mute: his microphone is off (the button says Unmute)', muted && /Unmute/.test(a.bar) && !a.call.micOn, a.bar);
  await click(A, '#rtc_mic');

  // ---------- 5. End; the Activity Log ----------
  await wait(1200); await click(A, '#rtc_end');
  bb = await until(async () => { const s = await st(B); return !s.call ? s : null; }, 8000) || await st(B); a = await st(A);
  const capOff = await A.f.evaluate(() => !document.querySelector('video') || true);
  ok('A presses End: the call is over on both sides – bars and picture gone, B is told "Sujit ended the screen share."', !a.call && !a.bar && !bb.call && !bb.bar && !bb.view && /Sujit ended the screen share/.test(bb.note), { A: a.note, B: bb.note });
  await wait(2500);
  const log = sql("select string_agg(name || ' :: ' || summary, ' || ' order by at) from activity_log where module = 'Screen Share'");
  ok('the Activity Log has two lines: who joined whose screen share, and that it ended after how long – nothing else is kept', /S72 Bala :: S72 Bala joined the screen share of Sujit/.test(log) && /Sujit :: Screen share of Sujit with S72 Bala ended after \d+ min \d+ s/.test(log), log);

  // ---------- 6. decline, cancel, busy ----------
  await shareWith(A, ['S72 Bala']);
  await until(async () => (await st(B)).inBox, 10000); await click(B, '#rtc_no');
  a = await until(async () => { const s = await st(A); return !s.call ? s : null; }, 8000) || await st(A);
  ok('B declines: A is told "S72 Bala declined the screen share." and nothing stays on (no bar, the screen is not shown any more)', !a.call && !a.bar && /S72 Bala declined the screen share/.test(a.note) && !(await st(B)).inBox, a.note);
  await shareWith(A, ['S72 Bala']);
  await until(async () => (await st(B)).inBox, 10000); await click(A, '#rtc_end');
  bb = await until(async () => { const s = await st(B); return !s.inBox && s.note ? s : null; }, 8000) || await st(B);
  ok('A ends it before B answers: B\'s ring stops – "Sujit stopped the screen share before it was answered."', !bb.inBox && /Sujit stopped the screen share before it was answered/.test(bb.note), bb.note);
  // busy: A and B are in a call; C wants to show A a screen
  await shareWith(A, ['S72 Bala']); await until(async () => (await st(B)).inBox, 10000); await click(B, '#rtc_yes');
  await until(async () => { const s = await st(A); return s.call && s.call.peers.some(x => /:up/.test(x)); }, 20000);
  await shareWith(C, ['Sujit']);
  let cc = await until(async () => { const s = await st(C); return !s.call && s.note ? s : null; }, 24000) || await st(C);      // (the host waits 6 s after a "busy" – another tab of that user might still answer)
  a = await st(A);
  ok('while A and B are in a screen share, C tries to show A a screen: C is told "Sujit is in another screen share."; A\'s call is not disturbed and does not ring', /Sujit is in another screen share/.test(cc.note) && !cc.call && !!a.call && !a.inBox, { C: cc.note, A: a.bar });
  // B leaves
  await click(B, '#rtc_end');
  a = await until(async () => { const s = await st(A); return !s.call ? s : null; }, 8000) || await st(A);
  ok('B presses Leave: A is told "S72 Bala left the screen share." and, being alone, the call ends', !a.call && /S72 Bala left the screen share/.test(a.note), a.note);

  // ---------- 7. B has the app open in TWO tabs ----------
  const p2 = await B.ctx.newPage(); await p2.setViewport({ width: 1536, height: 900 }); await p2.goto(BASE + '/', { waitUntil: 'load' }); await wait(6000);
  const B2 = { p: p2, f: p2.frames().find(x => x !== p2.mainFrame()), errs: [] }; p2.on('pageerror', e => B2.errs.push(String(e.message).slice(0, 200)));
  if (!(await B2.f.evaluate(() => !!S.token && !!S.user))) { await B2.f.type('#lg_email', UB.email); await B2.f.type('#lg_pass', UB.pw); await B2.f.click('#lg_btn'); await wait(5000); }      // (a new tab signs in by itself only when "keep me signed in" was ticked)
  await B2.f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const signedIn = await B2.f.evaluate(() => !!S.token && !!S.user);
  await shareWith(A, ['S72 Bala']);
  const r1 = await until(async () => (await st(B)).inBox, 12000), r2 = await until(async () => (await st(B2)).inBox, 12000);
  await click(B2, '#rtc_yes');
  const b2 = await until(async () => { const s = await st(B2); return s.view && s.view.w > 0 ? s : null; }, 25000) || await st(B2);
  const b1 = await until(async () => { const s = await st(B); return !s.inBox ? s : null; }, 10000) || await st(B);
  ok('B has the app open in two tabs: the ring shows in BOTH; he accepts in the second – it connects there, and the first tab stops ringing ("… answered in another tab …")', signedIn && !!r1 && !!r2 && !!b2.view && /Screen of Sujit/.test(b2.view.title) && !b1.inBox && !b1.call && /answered in another tab/.test(b1.note), { second: b2.view && b2.view.title, first: b1.note });
  // while that call is on, C rings B: neither tab of B rings (the first tab knows of the call in the second)
  await shareWith(C, ['S72 Bala']);
  await C.f.evaluate(() => { document.getElementById('rtc_note').hidden = true; });
  cc = await until(async () => { const s = await st(C); return !s.call && s.note ? s : null; }, 24000) || await st(C); const b1b = await st(B);
  ok('   while B is in that call, C rings B: no tab of B rings; C is told "S72 Bala is in another screen share."', /S72 Bala is in another screen share/.test(cc.note) && !b1b.inBox && !(await st(B2)).inBox, { C: cc.note, firstTab: b1b.inBox });
  await click(A, '#rtc_end'); await wait(1500);

  ok('no script error on any of the three pages', !A.errs.length && !B.errs.length && !C.errs.length && !B2.errs.length, [A.errs, B.errs, C.errs, B2.errs]);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
