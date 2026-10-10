// update-75 (asked 10-10-2026: "build all of it at once, perfectly, with security in mind") – the call REACHES the user:
//   a ring that is still waiting when the app is opened (as from a notification), missed calls (red number, list, Call back),
//   WhatsApp for a user who does not answer, a reply instead of a plain "no", "Show this to the Admin" from a red message,
//   who may use screen share (Users & Access), the history in the Activity Log.
// Real browsers (separate sign-ins) on the local rig; a pretend microphone / camera; "share this tab" answered by itself.
//   node master75.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from app_users where email like 's75%@rcl.test'; delete from activity_log where module = 'Screen Share' or (module = 'Users' and record_id = 'Screen share'); delete from app_settings where id like 'RTCMISS|%' or id like 'PUSH|%' or id like 'PUSHE|%' or id = 'RTC_OFF' or id like 'USER_PREFS|s75%'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'RTC%' or key = 'USERS_LIST';");
const raw = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mods = (await raw({ fn: 'api', args: [admin, 'usersAdmin', []] })).result, MOD = (mods.modules || Object.keys((mods.users || [])[0].perms || {}));
  const mk = async name => { const email = 's75' + name.toLowerCase() + '@rcl.test', p = {}; MOD.forEach(m => { p[m] = m === 'Log Book' || m === 'Dashboard' ? 'Edit' : 'None'; });
    const a = await raw({ fn: 'api', args: [admin, 'saveUserAdmin', [{ email, name: 'S75 ' + name, active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#' + name + '1' }]] }); if (a.error) throw new Error(a.error);
    const l = await raw({ fn: 'login', args: [email, 'Temp#' + name + '1'] }), pw = 'Own#' + name + '2468'; const c = await raw({ fn: 'changePassword', args: [l.result.token, 'Temp#' + name + '1', pw] }); if (c.error) throw new Error(c.error); return { email, pw, name: 'S75 ' + name, token: c.result.token }; };
  const UB = await mk('Bala'), UC = await mk('Chitra'), UD = await mk('Dev');
  const pr = await raw({ fn: 'api', args: [UC.token, 'saveMyPrefs', [{ mobile: '9822012345' }]] }); if (pr.error) out.push('mobile: ' + pr.error);
  sql("delete from web.cache where key like 'LG\\_%'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000,
    args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-accept-this-tab-capture', '--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
  const session = async (email, pw) => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
    await p.setViewport({ width: 1536, height: 900 }); await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(e => { try { localStorage.setItem('oc_brief_' + e, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('rcl_np_no', '1'); } catch (er) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', pw); await f.click('#lg_btn'); await wait(5000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    return { p, f, errs, ctx }; };
  const vis = (X, id) => X.f.evaluate(i => { const e = document.getElementById(i); return !!e && !e.hidden && e.offsetParent !== null; }, id);
  const st = X => X.f.evaluate(() => { const C = RTC.call, v = id => { const e = document.getElementById(id); return !!e && !e.hidden; }, v2 = document.getElementById('rtc_video');
    return { call: C ? { role: C.role, peers: [...C.peers.values()].map(P => P.name + ':' + P.state + (P.up ? ':up' : '')) } : null, inBox: v('rtc_in') ? document.getElementById('rtc_in_t').textContent : '', inSub: v('rtc_in') ? document.getElementById('rtc_in_s').textContent : '',
      note: v('rtc_note') ? document.getElementById('rtc_note').textContent : '', noteLink: v('rtc_note') && document.querySelector('#rtc_note a') ? document.querySelector('#rtc_note a').href : '',
      badge: v('rtc_badge') ? document.getElementById('rtc_badge').textContent : '', view: v('rtc_view') ? { title: document.getElementById('rtc_vt').textContent, w: v2.videoWidth } : null,
      toast: !document.getElementById('toast').hidden ? document.getElementById('toast').textContent : '', fix: document.getElementById('fixbox') && !document.getElementById('fixbox').hidden ? document.getElementById('fixbox').textContent.replace(/\s+/g, ' ') : '' }; });
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(400); } };
  const click = (X, sel) => X.f.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const openList = async X => { await X.f.evaluate(() => { const l = document.getElementById('rtc_list'); if (l) l.remove(); }); await click(X, '#u_share'); return until(() => X.f.evaluate(() => !!RTC.pick && !document.getElementById('cf_back').hidden && !!document.querySelector('#rtc_list')), 8000); };
  const tick = (X, name) => X.f.evaluate(n => { const l = [...document.querySelectorAll('#rtc_list .rtc-u')].find(x => x.querySelector('b').textContent === n); if (!l) return false; const c = l.querySelector('input'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } return c.checked; }, name);
  const shareWith = async (X, names) => { await openList(X); for (const n of names) await tick(X, n); await X.f.evaluate(() => document.getElementById('cf_ok').click()); };
  const endCall = async X => { await click(X, '#rtc_end'); await until(async () => !(await st(X)).call, 8000); };

  const A = await session('sujit@rcl.test', 'Nashik#Road848!');

  // ---------- 1. a ring that is still waiting when the app is opened (as from a notification) ----------
  await shareWith(A, ['S75 Bala']);
  await until(async () => { const s = await st(A); return s.call && s.call.peers.some(x => /ringing/.test(x)) ? s : null; }, 15000);
  await wait(2500);      // the ring went out BEFORE Bala's app is open
  const B = await session(UB.email, UB.pw);
  let bb = await until(async () => { const s = await st(B); return s.inBox ? s : null; }, 15000) || await st(B);
  ok('Bala opens the app AFTER the ring went out (as from the notification): the ring is there at once – "Sujit wants to show you a screen"', /Sujit wants to show you a screen/.test(bb.inBox), bb);
  await click(B, '#rtc_yes');
  bb = await until(async () => { const s = await st(B); return s.view && s.view.w > 0 ? s : null; }, 25000) || await st(B);
  ok('   accepted: Bala sees the screen', !!bb.view && bb.view.w > 0, bb.view);
  await endCall(A); await wait(1500);

  // ---------- 2. a reply instead of a plain "no" ----------
  await shareWith(A, ['S75 Bala']);
  await until(async () => (await st(B)).inBox, 15000);
  await click(B, '#rtc_rep'); await wait(200);
  const reps = await B.f.evaluate(() => [...document.querySelectorAll('#rtc_rep_m [data-reply]')].map(x => x.textContent));
  await click(B, '#rtc_rep_m [data-reply="2"]');
  let a = await until(async () => { const s = await st(A); return !s.call && /declined/.test(s.note) ? s : null; }, 12000) || await st(A);
  bb = await st(B);
  ok('Bala presses Reply… → "In a meeting – later, please": the ring stops; Sujit reads: S75 Bala declined the screen share: "I am in a meeting – later, please."',
    reps.length === 3 && /S75 Bala declined the screen share: "I am in a meeting – later, please\."/.test(a.note) && !bb.inBox && /Sent to Sujit/.test(bb.note), { replies: reps, A: a.note, B: bb.note });
  await wait(1200);

  // ---------- 3. not answered: WhatsApp after 15 s, then "missed" for Chitra (her app was closed) ----------
  await shareWith(A, ['S75 Chitra']);
  a = await until(async () => { const s = await st(A); return /has not answered yet/.test(s.note) && s.noteLink ? s : null; }, 25000) || await st(A);
  const link = a.noteLink ? new URL(a.noteLink) : null;
  ok('Chitra does not answer: after 15 s Sujit is offered "Ask on WhatsApp" – her own mobile number, with a message to open the app',
    !!link && link.host === 'wa.me' && link.pathname === '/919822012345' && /Sujit wants to show you a screen in the Fleet ERP app/.test(link.searchParams.get('text') || '') && /127\.0\.0\.1/.test(link.searchParams.get('text') || ''), a.noteLink);
  await endCall(A); await wait(1500);
  const C = await session(UC.email, UC.pw);
  let cc = await until(async () => { const s = await st(C); return s.badge ? s : null; }, 12000) || await st(C);
  ok('Chitra opens the app later: a red 1 on the screen button and "Missed screen share: Sujit – call back from the screen button"', cc.badge === '1' && /Missed screen share: Sujit/.test(cc.note), cc);
  await openList(C); await wait(500);
  const miss = await C.f.evaluate(() => { const m = document.querySelector('.rtc-miss'); return m ? m.textContent : ''; });
  await click(C, '[data-callback]'); await wait(300);
  const ticked = await C.f.evaluate(() => [...document.querySelectorAll('#rtc_list input[data-uid]:checked')].map(c => c.closest('.rtc-u').querySelector('b').textContent));
  cc = await st(C);
  ok('   her list shows "Missed calls: Sujit · <time>" with Call back – pressing it ticks Sujit; the red number is gone', /Missed calls/.test(miss) && /Sujit/.test(miss) && ticked.join() === 'Sujit' && !cc.badge, { miss, ticked, badge: cc.badge });
  await C.f.evaluate(() => closeConfirm(false)); await wait(500);

  // ---------- 4. "Show this to the Admin" from a red message ----------
  await B.f.evaluate(() => { showTab('log'); toast('Start reading 100 is less than the previous Close 200 for MH-15-AB-0001.', true); }); await wait(600);
  bb = await st(B);
  const helpBtn = await B.f.evaluate(() => { const x = document.querySelector('#fixbox [data-fixrtc]'); return x ? x.textContent : ''; });
  const helpAdm = await A.f.evaluate(() => { toast('Something is wrong for the Admin too.', true); const x = document.querySelector('#fixbox [data-fixrtc]'); $('fixbox').hidden = true; return !!x; });
  ok('a red message on Bala\'s page has the button "Show this to the Admin (screen share)" – in the language of the help (here Marathi: "हे Admin ला दाखवा") – and not on the Admin\'s own page', /Show this to the Admin|हे Admin ला दाखवा|यह Admin को दिखाएँ/.test(helpBtn) && !helpAdm, { helpBtn, onAdminPage: helpAdm });
  await click(B, '#fixbox [data-fixrtc]');
  await until(() => B.f.evaluate(() => !!RTC.pick && !!document.querySelector('#rtc_list')), 8000); await wait(400);
  const dlg = await B.f.evaluate(() => ({ title: document.getElementById('cf_title') ? document.getElementById('cf_title').textContent : '', help: (document.querySelector('.rtc-help') || {}).textContent || '', ticked: [...document.querySelectorAll('#rtc_list input:checked')].map(c => c.closest('.rtc-u').querySelector('b').textContent), adm: [...document.querySelectorAll('#rtc_list .rtc-adm')].length, mode: (document.querySelector('input[name=rtc_mode]:checked') || {}).value }));
  ok('   the box "Show this to the Admin": the message goes with the call, the Admin is ticked already, "My screen" chosen', /Show this to the Admin/.test(dlg.title) && /Start reading 100/.test(dlg.help) && dlg.ticked.join() === 'Sujit' && dlg.adm === 1 && dlg.mode === 'screen', dlg);
  await B.f.evaluate(() => document.getElementById('cf_ok').click());
  a = await until(async () => { const s = await st(A); return s.inBox ? s : null; }, 15000) || await st(A);
  ok('   Sujit\'s page rings: "S75 Bala needs help – wants to show you a screen" with the page and the message', /S75 Bala needs help – wants to show you a screen/.test(a.inBox) && /Log Book: Start reading 100 is less than the previous Close 200/.test(a.inSub), { box: a.inBox, line: a.inSub });
  await click(A, '#rtc_yes');
  a = await until(async () => { const s = await st(A); return s.view && s.view.w > 0 ? s : null; }, 25000) || await st(A);
  ok('   accepted: Sujit sees Bala\'s screen', !!a.view && /Screen of S75 Bala/.test(a.view.title), a.view);
  await endCall(B); await wait(1500);

  // ---------- 5. who may use screen share (Users & Access) ----------
  await A.f.evaluate(() => showTab('users')); await A.f.evaluate(() => document.getElementById('tab-users').click());
  await until(() => A.f.evaluate(() => document.querySelectorAll('#rr_list input[data-rr]').length > 3), 10000);
  const rr0 = await A.f.evaluate(() => [...document.querySelectorAll('#rr_list label')].map(l => l.textContent.trim() + ':' + l.querySelector('input').checked + (l.querySelector('input').disabled ? ':fixed' : '')));
  await A.f.evaluate(() => { const l = [...document.querySelectorAll('#rr_list label')].find(x => /S75 Dev/.test(x.textContent)); l.querySelector('input').checked = false; document.getElementById('rr_save').click(); });
  await wait(2500);
  const D = await session(UD.email, UD.pw);
  await click(D, '#u_share');
  const dd = await until(async () => { const s = await st(D); return s.toast ? s : null; }, 10000) || await st(D);
  await openList(B); await wait(300);
  const bl = await B.f.evaluate(() => [...document.querySelectorAll('#rtc_list .rtc-u b')].map(x => x.textContent)); await B.f.evaluate(() => closeConfirm(false));
  const logRr = sql("select summary from activity_log where module = 'Users' and record_id = 'Screen share' order by id desc limit 1");
  ok('Users & Access → "Screen share – who may use it": every user ticked, the Admin fixed; Dev unticked + Save → Dev is told it is switched off for him, nobody can pick him, and the Activity Log says so',
    rr0.some(x => /Sujit \(Admin\):true:fixed/.test(x)) && rr0.some(x => /S75 Dev:true/.test(x)) && /switched off for you/.test(dd.toast) && !bl.includes('S75 Dev') && bl.includes('S75 Chitra') && /switched off for S75 Dev/.test(logRr), { list: rr0, dev: dd.toast, bala: bl, log: logRr });
  await A.f.evaluate(() => { const l = [...document.querySelectorAll('#rr_list label')].find(x => /S75 Dev/.test(x.textContent)); l.querySelector('input').checked = true; document.getElementById('rr_save').click(); }); await wait(2000);

  // ---------- 6. the history: Activity Log → "Screen share calls" ----------
  await A.f.evaluate(() => document.getElementById('tab-activity').click()); await wait(1500);
  await click(A, '#af_rtc');
  const rowsNow = () => A.f.evaluate(() => [...document.querySelectorAll('#a_rows tr')].map(tr => [...tr.children].map(td => td.textContent)));
  const rows = await until(async () => { const r = await rowsNow(); return r.length && r.every(x => x[3] === 'Screen Share') ? r : null; }, 12000) || await rowsNow();
  const hist = rows.map(x => x[5]).join(' | ');
  const mod = await A.f.evaluate(() => document.getElementById('af_module').value);
  ok('Activity Log → "Screen share calls": joined, ended, declined (with the reply), did not answer – the module filter is "Screen Share"',
    mod === 'Screen Share' && rows.every(x => x[3] === 'Screen Share') && /S75 Bala joined the screen share of Sujit/.test(hist) && /ended after/.test(hist) && /S75 Bala declined the screen share of Sujit \(reply: I am in a meeting/.test(hist) && /S75 Chitra did not answer the screen share of Sujit/.test(hist) && /Sujit joined the screen share of S75 Bala/.test(hist), hist.replace(/\s+/g, ' ').slice(0, 700));

  ok('no script error on any page', ![A, B, C, D].some(X => X.errs.length), [A, B, C, D].map(X => X.errs));
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
