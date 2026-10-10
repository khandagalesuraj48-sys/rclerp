// update-72 (asked 10-10-2026): screen share with voice – a call of three (the host and two guests; at most 3 guests).
//   Everybody hears everybody and sees any screen that is shown: the host passes on to the other guest what one guest sends.
//   A guest who joins later gets what is already on; the pointer reaches another guest's screen through the host;
//   one leaves and the others go on; one declines and the call starts with the other; not more than 3 can be ticked.
// Real browsers (two separate sign-ins) on the local rig; the browser is started with a pretend microphone and with
// "share this tab" answered by itself (nobody is there to press Allow).   node group72.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from app_users where email like 'g72%@rcl.test'; delete from activity_log where module = 'Screen Share'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'RTC%' or key = 'USERS_LIST';");
const raw = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mods = (await raw({ fn: 'api', args: [admin, 'usersAdmin', []] })).result;
  const MOD = (mods.modules || Object.keys((mods.users || [])[0].perms || {}));
  const mk = async name => { const email = 'g72' + name.toLowerCase() + '@rcl.test', p = {}; MOD.forEach(m => { p[m] = m === 'Log Book' || m === 'Dashboard' ? 'Edit' : 'None'; });
    const a = await raw({ fn: 'api', args: [admin, 'saveUserAdmin', [{ email, name: 'G72 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]] }); if (a.error) throw new Error(a.error);
    const l = await raw({ fn: 'login', args: [email, 'Temp#' + name + '1'] }), pw = 'Own#' + name + '2468'; const c = await raw({ fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] }); if (c.error) throw new Error(c.error); return { email, pw, name: 'G72 ' + name }; };
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
      aIn: await stats('audio'), vIn: await stats('video'), voices: await (async () => { let n = 0; if (C) for (const P of C.peers.values()) { try { (await P.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio' && (r.packetsReceived || 0) > 5) n++; }); } catch (e) {} } return n; })(), tab: S.curTab, toast: !document.getElementById('toast').hidden ? document.getElementById('toast').textContent : '', fix: document.getElementById('fixbox') && !document.getElementById('fixbox').hidden ? document.getElementById('fixbox').textContent.replace(/\s+/g, ' ').slice(0, 200) : '' }; });
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
  const click = (X, sel) => X.f.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  // A opens the list, ticks the names, presses "Share screen"
  const pickList = X => X.f.evaluate(() => [...document.querySelectorAll('#rtc_list .rtc-u')].map(l => l.querySelector('b').textContent + ' – ' + l.querySelector('.rtc-st').textContent));
  const openList = async X => { await X.f.evaluate(() => { const l = document.getElementById('rtc_list'); if (l) l.remove(); }); await click(X, '#u_share'); await until(() => X.f.evaluate(() => !!RTC.pick && !document.getElementById('cf_back').hidden && !!document.querySelector('#rtc_list')), 8000); await wait(150); };
  const tick = (X, name) => X.f.evaluate(n => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === n); if (!l) return false; const c = l.querySelector('input'); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); return c.checked; }, name);
  const shareWith = async (X, names) => { await openList(X); for (const n of names) await tick(X, n); await X.f.evaluate(() => document.getElementById('cf_ok').click()); };

  const N = { b: 'G72 Bala', c: 'G72 Chitra' };
  // ---------- 1. not more than 3 ----------
  await openList(A);
  for (const n of ['G72 Bala', 'G72 Chitra', 'G72 Dev', 'none']) await tick(A, n);
  const ticked = await A.f.evaluate(() => [...document.querySelectorAll('#rtc_list input:checked')].map(c => c.closest('.rtc-u').querySelector('b').textContent));
  let a = await st(A);
  ok('four names are ticked one after the other: the fourth does not stay ticked – "At most 3 users at a time."', ticked.length === 3 && ticked.indexOf('none') === -1 && /At most 3 users at a time/.test(a.note), { ticked, note: a.note });
  await A.f.evaluate(() => { document.getElementById('cf_cancel') ? document.getElementById('cf_cancel').click() : closeConfirm(false); }); await wait(600);

  // ---------- 2. A shows his screen to B and C; C answers first and shows HIS screen; then B answers ----------
  await shareWith(A, [N.b, N.c]);
  let bb = await until(async () => { const s = await st(B); return s.inBox ? s : null; }, 10000), cc = await until(async () => { const s = await st(C); return s.inBox ? s : null; }, 10000);
  a = await st(A);
  ok('A ticks Bala and Chitra: BOTH pages ring ("Sujit wants to show you a screen (with 1 more)"); A\'s bar: calling both', bb && cc && /Sujit wants to show you a screen \(with 1 more\)/.test(bb.inBox) && /with 1 more/.test(cc.inBox) && /Calling G72 Bala \(ringing\), G72 Chitra \(ringing\)/.test(a.bar), { B: bb && bb.inBox, C: cc && cc.inBox, A: a.bar });
  await click(C, '#rtc_yes');
  cc = await until(async () => { const s = await st(C); return s.view && s.view.w > 0 && s.aIn > 0 ? s : null; }, 25000) || await st(C);
  a = await st(A);
  ok('Chitra accepts first: she sees and hears A while Bala\'s page is still ringing (A\'s bar: "… G72 Bala (ringing), G72 Chitra")', !!cc.view && /Screen of Sujit/.test(cc.view.title) && cc.aIn > 0 && /G72 Bala \(ringing\), G72 Chitra/.test(a.bar) && !!(await st(B)).inBox, { C: cc.view && cc.view.title, A: a.bar });
  await click(C, '#rtc_share');
  a = await until(async () => { const s = await st(A); return s.view && /G72 Chitra/.test(s.view.title) && s.view.w > 0 ? s : null; }, 15000) || await st(A);
  await click(B, '#rtc_yes');
  bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 && s.view.tabs.length === 2 && s.voices >= 2 ? s : null; }, 30000) || await st(B);
  ok('Bala accepts LATER: he gets everything that is already on – both screens (Sujit\'s and Chitra\'s, to switch between) and both voices',
    !!bb.view && bb.view.tabs.length === 2 && bb.view.tabs.indexOf('Sujit') > -1 && bb.view.tabs.indexOf('G72 Chitra') > -1 && bb.voices === 2 && bb.call.audio === 2, { view: bb.view, voices: bb.voices, shares: bb.call && bb.call.shares });
  cc = await until(async () => { const s = await st(C); return s.voices >= 2 ? s : null; }, 12000) || await st(C); a = await st(A);
  ok('everybody hears everybody: Chitra hears 2 voices (Sujit and, passed on by him, Bala), Sujit hears 2; the bars name all three', cc.voices === 2 && a.voices === 2 && /Screen share with G72 Bala, G72 Chitra/.test(a.bar) && /Screen share with Sujit, G72 Chitra/.test(bb.bar) && /Screen share with Sujit, G72 Bala/.test(cc.bar), { A: a.bar, B: bb.bar, C: cc.bar, voices: [a.voices, bb.voices, cc.voices] });
  await wait(500); await B.p.screenshot({ path: '/home/claude/test/shots/group72_view.png' });

  // ---------- 3. Bala looks at Chitra's screen and points at it (the pointer goes through the host) ----------
  await B.f.evaluate(n => { const t = [...document.querySelectorAll('#rtc_tabs button')].find(x => x.textContent === n); if (t) t.click(); }, N.c); await wait(900);
  bb = await st(B);
  const moving = async X => { const v1 = (await st(X)).view; await wait(1300); const v2 = (await st(X)).view; return !!(v1 && v2 && v2.t > v1.t && v2.w > 100); };
  ok('Bala presses "G72 Chitra" above the picture: he sees Chitra\'s screen (a moving picture that came to him through the host)', !!bb.view && /Screen of G72 Chitra/.test(bb.view.title) && await moving(B), bb.view);
  await B.f.evaluate(() => { const v = document.getElementById('rtc_video'); if (!v.videoWidth) return; const r = v.getBoundingClientRect(), k = Math.min(r.width / v.videoWidth, r.height / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k; v.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + (r.width - w) / 2 + w * 0.7, clientY: r.top + (r.height - h) / 2 + h * 0.3 })); });
  const ring = await until(() => C.p.evaluate(() => { const d = document.querySelector('[data-rtc-ptr]'); if (!d) return null; const r = d.getBoundingClientRect(); return { x: Math.round((r.left + r.width / 2) / innerWidth * 100) / 100, y: Math.round((r.top + r.height / 2) / innerHeight * 100) / 100, by: d.textContent }; }), 6000);
  const ringA = await A.p.evaluate(() => !!document.querySelector('[data-rtc-ptr]'));
  ok('   he clicks on it (70 % across, 30 % down): the red ring with HIS name shows at that place on CHITRA\'s screen – and not on Sujit\'s', !!ring && Math.abs(ring.x - 0.7) < 0.02 && Math.abs(ring.y - 0.3) < 0.02 && /G72 Bala/.test(ring.by) && !ringA, { ring, onSujit: ringA });

  // ---------- 4. Chitra stops showing; Bala leaves; the call goes on; the end ----------
  await click(C, '#rtc_share');
  bb = await until(async () => { const s = await st(B); return s.view && s.view.tabs.length === 0 && /Sujit/.test(s.view.title) ? s : null; }, 12000) || await st(B); a = await st(A);
  ok('Chitra stops showing her screen: at Bala the picture is Sujit\'s screen again (no second name to switch to); at Sujit the picture closes', !!bb.view && /Screen of Sujit/.test(bb.view.title) && !bb.view.tabs.length && !a.view, { B: bb.view, A: a.view });
  await click(B, '#rtc_end');
  a = await until(async () => { const s = await st(A); return s.call && s.call.peers.length === 1 ? s : null; }, 8000) || await st(A);
  cc = await until(async () => { const s = await st(C); return /Screen share with Sujit$|Screen share with SujitYour/.test(s.bar) ? s : null; }, 8000) || await st(C);
  ok('Bala leaves: Sujit is told "G72 Bala left the screen share."; Sujit and Chitra go on (Chitra\'s bar names Sujit only, she still sees his screen)', !!a.call && /G72 Bala left the screen share/.test(a.note) && /Screen share with G72 Chitra/.test(a.bar) && !!cc.call && /Screen share with Sujit(?!, G72 Bala)/.test(cc.bar) && !!cc.view && !(await st(B)).call, { A: a.bar, note: a.note, C: cc.bar });
  ok('   and the picture at Chitra is still moving', await moving(C));
  await wait(800); await click(A, '#rtc_end');
  cc = await until(async () => { const s = await st(C); return !s.call ? s : null; }, 8000) || await st(C);
  await wait(2500);
  const log = sql("select string_agg(name || ' :: ' || summary, ' || ' order by at) from activity_log where module = 'Screen Share'");
  ok('Sujit presses End: over for Chitra too ("Sujit ended the screen share."); the Activity Log: Chitra joined, Bala joined, and "… with G72 Bala, G72 Chitra ended after …"',
    !cc.call && /Sujit ended the screen share/.test(cc.note) && /G72 Chitra :: G72 Chitra joined the screen share of Sujit/.test(log) && /G72 Bala :: G72 Bala joined the screen share of Sujit/.test(log) && /Screen share of Sujit with (G72 Bala, G72 Chitra|G72 Chitra, G72 Bala) ended after \d+ min \d+ s/.test(log), { C: cc.note, log });

  // ---------- 5. one declines, the other accepts ----------
  await shareWith(A, [N.b, N.c]);
  await until(async () => (await st(B)).inBox, 10000); await until(async () => (await st(C)).inBox, 10000);
  await click(B, '#rtc_no');
  a = await until(async () => { const s = await st(A); return /declined/.test(s.note) ? s : null; }, 8000) || await st(A);
  await click(C, '#rtc_yes');
  cc = await until(async () => { const s = await st(C); return s.view && s.view.w > 0 ? s : null; }, 25000) || await st(C); const a2 = await st(A);
  ok('Bala declines and Chitra accepts: Sujit is told "G72 Bala declined the screen share." and the call starts with Chitra alone', /G72 Bala declined the screen share/.test(a.note) && !!a2.call && a2.call.peers.length === 1 && /Screen share with G72 Chitra/.test(a2.bar) && !!cc.view, { note: a.note, A: a2.bar, C: cc.view && cc.view.title });
  await click(A, '#rtc_end'); await wait(1500);

  ok('no script error on any of the three pages', !A.errs.length && !B.errs.length && !C.errs.length, [A.errs, B.errs, C.errs]);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
