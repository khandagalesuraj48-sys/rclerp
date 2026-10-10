// update-74 (asked 10-10-2026): "the Admin must be able to understand which version the app runs on" – and, about the relay of
//   update-73: "I cannot make out whether the relay is connected or not". Settings → This app shows the Admin: the update that runs
//   (from the commit message Vercel gives the server) and whether the screen share's relay is set, with "Check the relay".
// Servers (rig): A = relay set + a commit message / SHA as Vercel gives them; B = relay with a WRONG password; C = nothing set.
//   node version74.js <port A – 3009> <port B – 3010> <port C – 3000>      (the rig's relay: turn-standin.js on 127.0.0.1:3478)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const [pA, pB, pC] = [process.argv[2] || '3009', process.argv[3] || '3010', process.argv[4] || '3000'], url = p => 'http://127.0.0.1:' + p;
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from app_users where email like 'v74%@rcl.test'; delete from web.cache where key like 'RTC%' or key = 'USERS_LIST';");
const raw = async (base, body) => { for (let i = 0; ; i++) { try { return await (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const admin = (await raw(url(pA), { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mods = (await raw(url(pA), { fn: 'api', args: [admin, 'usersAdmin', []] })).result, MOD = (mods.modules || Object.keys((mods.users || [])[0].perms || {}));
  const p = {}; MOD.forEach(m => { p[m] = m === 'Log Book' || m === 'Dashboard' ? 'Edit' : 'None'; });
  const a = await raw(url(pA), { fn: 'api', args: [admin, 'saveUserAdmin', [{ email: 'v74bala@rcl.test', name: 'V74 Bala', active: true, admin: false, perms: p, isNew: true, newPassword: 'Temp#Bala1' }]] }); if (a.error) throw new Error(a.error);
  const l = await raw(url(pA), { fn: 'login', args: ['v74bala@rcl.test', 'Temp#Bala1'] }); const c = await raw(url(pA), { fn: 'changePassword', args: [l.result.token, 'Temp#Bala1', 'Own#Bala2468'] }); if (c.error) throw new Error(c.error);
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: 'shell', protocolTimeout: 120000,
    args: [...chromium.args, '--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const session = async (base, email, pw) => { const ctx = await b.createBrowserContext(), pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => { if (!/public key credentia/i.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
    await pg.setViewport({ width: 1366, height: 860 }); await pg.goto(base + '/', { waitUntil: 'load' }); await wait(1200);
    const f = pg.frames().find(x => x !== pg.mainFrame());
    await f.evaluate(e => { try { localStorage.setItem('oc_brief_' + e, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (er) {} }, email);
    await f.type('#lg_email', email); await f.type('#lg_pass', pw); await f.click('#lg_btn'); await wait(5000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    return { pg, f, errs, ctx }; };
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await wait(300); } };
  const box = X => X.f.evaluate(() => { const g = id => document.getElementById(id); return { shown: !!g('av_box') && !g('av_box').hidden && g('av_box').offsetHeight > 0, upd: g('av_upd').textContent, msg: g('av_msg').textContent, relay: g('av_relay').textContent, rmsg: g('av_rmsg').textContent, rcls: g('av_rmsg').className, btn: !g('av_test').hidden }; });
  const openSettings = async X => { await X.f.evaluate(() => document.getElementById('tab-settings').click()); await until(async () => { const v = await box(X); return !v.shown || v.upd !== '–' ? v : null; }, 10000); await wait(300); };
  const check = async X => { await X.f.evaluate(() => document.getElementById('av_test').click()); return until(async () => { const v = await box(X); return /^(Working|Not working|This browser)/.test(v.rmsg) ? v : null; }, 15000); };

  // A: the live-like server (relay set, commit as Vercel gives it)
  const A = await session(url(pA), 'sujit@rcl.test', 'Nashik#Road848!');
  await openSettings(A); let v = await box(A);
  ok('Admin, Settings → This app: the update that runs ("update-74"), its words and commit, and the relay set (address only)', v.shown && v.upd === 'update-74' && /version for the Admin · 1234abc$/.test(v.msg) && v.relay === 'Set – 127.0.0.1:3478' && v.btn, v);
  await A.f.evaluate(() => document.getElementById('av_box').scrollIntoView({ block: 'center' })); await wait(300);
  const txt = await A.f.evaluate(() => document.getElementById('sec-settings').textContent);
  ok('   the relay\'s name and password are nowhere on the page', !/rig-relay-pass/.test(txt) && !/rig-relay-pass/.test(JSON.stringify(await A.f.evaluate(() => rawCall('getAppVersion')))));
  v = await check(A);
  ok('"Check the relay" (right password): the browser gets an address from the relay → "Working … (over UDP)"', !!v && /^Working – the relay answered in [0-9.]+ s \(over UDP\)/.test(v.rmsg) && v.rcls === 'ok', v && v.rmsg);
  await A.pg.screenshot({ path: '/home/claude/test/shots/version74_admin.png', clip: await A.f.evaluate(() => { const r = document.getElementById('set_app').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) }).catch(() => {});
  await A.f.evaluate(() => { window.APP_BUILD = 'an-older-one'; }); await openSettings(A); v = await box(A);
  ok('a page older than the live version says so ("close the app and open it again")', /This page is older than the live version/.test(v.msg), v.msg);
  ok('   no script error on the Admin page', !A.errs.length, A.errs);

  // a user who is not Admin: nothing of it, and the server refuses the question
  const U = await session(url(pA), 'v74bala@rcl.test', 'Own#Bala2468');
  await openSettings(U); v = await box(U); const asked = await U.f.evaluate(() => rawCall('getAppVersion').then(() => 'answered', e => String(e && e.message || e)));
  ok('a user who is not Admin: the lines are not shown, and the server does not answer him', !v.shown && asked !== 'answered', { shown: v.shown, server: asked.slice(0, 120) });

  // B: the relay password is wrong
  const B = await session(url(pB), 'sujit@rcl.test', 'Nashik#Road848!');
  await openSettings(B); v = await check(B);
  ok('"Check the relay" with a WRONG password: "Not working – the relay refused the name / password …" in red', !!v && /^Not working – the relay refused the name \/ password/.test(v.rmsg) && v.rcls === 'bad', v && v.rmsg);

  // C: nothing set (as before update-73) – and no commit given (the rig)
  const C = await session(url(pC), 'sujit@rcl.test', 'Nashik#Road848!');
  await openSettings(C); v = await box(C);
  ok('nothing set: "Not set" (no Check button) with the three names to put in Vercel; no commit given: "Not known here"', v.shown && v.relay === 'Not set' && !v.btn && /RTC_TURN_URL, RTC_TURN_USER, RTC_TURN_PASS/.test(v.rmsg) && v.upd === 'Not known here', v);
  ok('   no script error on the pages', !U.errs.length && !B.errs.length && !C.errs.length, [U.errs, B.errs, C.errs]);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
