// update-86 (asked 12-10-2026): (1) the server kept awake – the wake address GET /api/rpc?warm=1; (2) no "Waiting for the server"
// words, only the thin bar; (3) on a PHONE the app never puts the cursor in a box by itself (the keyboard opens only when a box is
// tapped); (4) on a PHONE a saved diesel issue shows a "saved" box for 3 seconds (or closed by hand), the form empty for the next.
// A computer keeps the cursor and the line at the bottom as before. On the local rig.   node mobile86.js [port]
// (run with test/browser/geo-shim.js – the app opens only with the location on)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', BASE = 'http://127.0.0.1:' + port, GATE = 'http://127.0.0.1:3100';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const clean = () => sql("delete from log_book where machinery like 'M86-%'; delete from diesel_issue where machinery like 'M86-%'; delete from master where id like 'M86-%'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1200);
  // 1. the wake address
  const w = await fetch(BASE + '/api/rpc?warm=1'); const wj = await w.json();
  ok('the wake address GET /api/rpc?warm=1 answers "ok" (no data), not kept by any cache', w.status === 200 && wj.ok === true && typeof wj.ms === 'number' && Object.keys(wj).sort().join() === 'ms,ok' && /no-store/.test(w.headers.get('cache-control') || ''), { status: w.status, body: wj });
  const g = await fetch(BASE + '/api/rpc');
  ok('   any other GET is still refused (POST only)', g.status === 405);
  const post = async body => (await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json());
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const sm = await api('saveMaster', { no: 'M86-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 3, owner: 'Rachana Construction Limited', ownership: 'Own', status: 'Active', activeFrom: '2026-10-01' }, 'add');
  ok('test data: machinery M86-TIP (KM)', !sm.ERROR, sm);

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const open = async phone => {
    const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    if (phone) { await p.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'); await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); }
    else await p.setViewport({ width: 1536, height: 900 });
    await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(1500);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
    await f.evaluate(() => { $('lg_email').value = 'sujit@rcl.test'; $('lg_pass').value = 'Nashik#Road848!'; $('lg_btn').click(); }); await wait(6500);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); setDieselMode('one'); }); await wait(2500);
    return { ctx, p, f, errs };
  };
  // a fill as the person makes it: machinery, litres, reading – then Save
  let km = 1000;
  const fill = async f => { km += 10; await f.evaluate(km => { const n = $('d_no'); n.value = 'M86-TIP'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); n.blur(); }, km); await wait(900);
    await f.evaluate(km => { const w = document.querySelector('#d_way [data-way="KM"], #d_way button'); if (w && !document.querySelector('#d_way .on, #d_way [aria-pressed="true"]')) w.click(); $('d_qty').value = '10'; $('d_qty').dispatchEvent(new Event('input', { bubbles: true })); $('d_km').value = String(km); $('d_qty').blur(); $('d_km').blur(); }, km); await wait(900);
    await f.evaluate(() => $('d_save').click());
    for (let i = 0; i < 40; i++) { await wait(200); const s = await f.evaluate(() => !$('savedpop').hidden || /saved/i.test($('toast').textContent || '')); if (s) break; } };

  // 2. a PHONE
  const P = await open(true);
  ok('the phone is seen as a phone (no mouse, a finger)', await P.f.evaluate(() => PHONE === true));
  await fill(P.f);
  const pop = await P.f.evaluate(() => ({ shown: !$('savedpop').hidden, title: $('sp_t').textContent, rows: [...$('sp_rows').children].map(d => d.textContent), form: $('d_no').value, focus: document.activeElement && document.activeElement.id, tag: document.activeElement && document.activeElement.tagName }));
  ok('after Save on the phone: the "saved" box – Issue ID, machinery, litres, reading – and the form under it empty for the next machinery', pop.shown && pop.title === 'Diesel issue saved' && /^Issue IDDI-\d+$/.test(pop.rows[0]) && pop.rows.join('|').indexOf('MachineryM86-TIP|Diesel10 L|Reading1,010 km') > -1 && pop.form === '', pop);
  ok('   the app did NOT put the cursor in a box (no keyboard opening by itself)', !/^(INPUT|TEXTAREA)$/.test(pop.tag || ''), pop);
  await P.p.screenshot({ path: '/home/claude/test/shots/mobile86_saved.png' });
  await wait(2400);
  ok('   still there after 2.4 s', await P.f.evaluate(() => !$('savedpop').hidden));
  await wait(1000);
  ok('   gone by itself after 3 seconds', await P.f.evaluate(() => $('savedpop').hidden));
  await fill(P.f); await wait(300);
  await P.f.evaluate(() => $('sp_x').click());
  ok('closed by hand with × at once', await P.f.evaluate(() => $('savedpop').hidden));
  await fill(P.f); await wait(300);
  await P.f.evaluate(() => { const r = $('savedpop').getBoundingClientRect(); const ev = new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }); $('savedpop').dispatchEvent(ev); });
  ok('   or with a tap outside the box', await P.f.evaluate(() => $('savedpop').hidden));
  const saved = Number(sql("select count(*) from diesel_issue where machinery = 'M86-TIP'"));
  ok('the 3 fills were saved (3 entries)', saved === 3, saved);
  // the keyboard: a tap opens it; moving on while typing works; the app alone never opens it; Search keeps it
  const kb = await P.f.evaluate(() => {
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    $('d_qty').focus(); const byApp = document.activeElement === $('d_qty');
    $('d_qty').blur(); return { byApp };
  });
  await P.f.tap('#d_qty'); await wait(300);
  const tapped = await P.f.evaluate(() => document.activeElement === $('d_qty'));
  const next = await P.f.evaluate(() => { $('d_driver').focus(); return document.activeElement === $('d_driver'); });
  ok('a box gets the cursor only when it is TAPPED; the app alone cannot put it there; moving on while typing still works', kb.byApp === false && tapped && next, { byApp: kb.byApp, tapped, next });
  await P.f.evaluate(() => { document.activeElement.blur(); gsOpen(); }); await wait(300);
  ok('   Search (pressed to type) still opens with the cursor in its box', await P.f.evaluate(() => document.activeElement === $('gs_in')));
  await P.f.evaluate(() => gsClose());
  // the waiting bar: a slow answer → the thin bar, no words
  await fetch(GATE + '/__fault', { method: 'POST', body: JSON.stringify({ match: 'rpc/web_(boot|stamp)', delay: 4500, n: 4, after: true }) });
  await P.f.evaluate(() => { loadDiesel(); });
  await wait(3800);
  const bar = await P.f.evaluate(() => { const b = document.getElementById('rcl_wait'); return b ? { shown: !b.hidden, text: b.textContent, spanHidden: b.lastChild.hidden } : null; });
  await fetch(GATE + '/__fault', { method: 'POST', body: '{}' });
  ok('a slow answer (3.8 s): the thin moving bar only – no "Waiting for the server…" words', bar && bar.shown && bar.text === '' && bar.spanHidden, bar);
  ok('no script error on the phone', !P.errs.length, P.errs);
  await P.ctx.close();

  // 3. a COMPUTER: as before
  const C = await open(false);
  ok('a computer is not a phone', await C.f.evaluate(() => PHONE === false));
  await fill(C.f); await wait(400);
  const pc = await C.f.evaluate(() => ({ pop: !$('savedpop').hidden, toast: $('toast').textContent, focus: document.activeElement && document.activeElement.id }));
  ok('on the computer: the line at the bottom as before, no box, and the cursor back in Machinery for the next entry', !pc.pop && /Diesel issue saved: DI-\d+/.test(pc.toast) && pc.focus === 'd_no', pc);
  ok('no script error on the computer', !C.errs.length, C.errs);
  await b.close(); clean();
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (x) {} process.exit(1); });
