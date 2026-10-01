// correctness of "refresh only the page on screen": nothing may stay old once a page is opened; typed rows must survive
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(x).slice(0, 220) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const reqs = []; p.on('request', r => { if (/api\/rpc/.test(r.url())) { try { const j = JSON.parse(r.postData()); reqs.push(j.fn === 'api' ? j.args[1] : j.fn); } catch (e) {} } });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const dismiss = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const go = async t => { await f.evaluate(t2 => showTab(t2), t); await wait(2200); await dismiss(); };
  await go('diesel'); await go('log');
  await f.evaluate(async () => { setLgMode('date'); for (let i = 0; i < 3; i++) { while (document.querySelectorAll('#lg_in .lrow').length <= i) document.getElementById('l_add1').click(); const tr = document.querySelectorAll('#lg_in .lrow')[i]; const x = tr.querySelector('[data-f=no]'); x.value = 'MH-15-AB-' + String(71 + i).padStart(4, '0'); x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); }
    const w = document.querySelector('#lg_in .lrow [data-f=work]'); w.value = 'typed by me'; w.dispatchEvent(new Event('input', { bubbles: true })); });
  await wait(1500); await go('inward');
  const tk = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
  // another user: one diesel issue for a machinery typed in my Log Book grid (same day), and one inward
  const day = await f.evaluate(() => document.getElementById('lg_date') ? document.getElementById('lg_date').value : S.today);
  const di = await rpc('api', tk, 'saveDieselIssue', [{ date: day, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0071', qty: 37, kmReading: 71000, hrReading: 710, driver: 'STALE', force: true }]);
  const inw = await rpc('api', tk, 'saveInward', [{ date: day, location: 'Dispenser', pump: 'Stale Pump', qty: 11, rate: 90, billNo: 'ST-1', billDate: day }]);
  ok('the other user saved a diesel issue and an inward', di.result && di.result.id && inw.result && inw.result.id, (di.error || di.result.id) + ' / ' + (inw.error || inw.result.id));
  const n0 = reqs.length; await wait(9000);
  const bg = reqs.slice(n0).filter(x => x !== 'sync');
  ok('page on screen (Inward) shows the new inward by itself', await f.evaluate(id => document.getElementById('i_rows').textContent.indexOf(id) > -1, inw.result.id), 'calls made meanwhile: ' + bg.join(', '));
  ok('pages NOT on screen were not reloaded in the background', bg.indexOf('getDieselIssues') === -1 && bg.indexOf('getLogBookList') === -1 && bg.indexOf('getLogRowPrefill') === -1);
  ok('…so the hidden Diesel list is still the old one (as designed)', await f.evaluate(id => document.getElementById('d_rows').textContent.indexOf(id) === -1, di.result.id));
  let m0 = reqs.length; await go('diesel');
  ok('opening Diesel Issue: the list is fetched and shows the other user\'s entry', reqs.slice(m0).indexOf('getDieselIssues') > -1 && await f.evaluate(id => document.getElementById('d_rows').textContent.indexOf(id) > -1, di.result.id), reqs.slice(m0).filter(x => x !== 'sync').join(', '));
  m0 = reqs.length; await go('log'); await wait(1500);
  const lg = await f.evaluate(() => ({ rows: [...document.querySelectorAll('#lg_in .lrow')].map(tr => tr.querySelector('[data-f=no]').value).join(','), work: document.querySelector('#lg_in .lrow [data-f=work]').value, issued: (document.querySelector('#lg_in .lrow [data-o=dieselCell]') || {}).textContent }));
  ok('opening Log Book: my typed rows are still there', lg.rows.indexOf('MH-15-AB-0071') === 0 && lg.rows.split(',').length === 3 && lg.work === 'typed by me', JSON.stringify(lg));
  ok('…and the row of that machinery now shows the diesel the other user issued (37)', /37/.test(lg.issued || ''), 'Issued cell: ' + lg.issued + ' · calls: ' + reqs.slice(m0).filter(x => x !== 'sync').join(', '));
  ok('…and the Log Book list was fetched again', reqs.slice(m0).indexOf('getLogBookList') > -1);
  // my own save still shows at once
  await go('diesel'); m0 = reqs.length;
  const mine = await f.evaluate(async d => { const r = await call('saveDieselIssue', { date: d, shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-0072', qty: 9, kmReading: 72000, hrReading: 720, driver: 'STALE', force: true }); loadDiesel(); return r.id; }, day); await wait(2500);
  ok('my own save shows in the list at once', await f.evaluate(id => document.getElementById('d_rows').textContent.indexOf(id) > -1, mine), mine);
  ok('no script error', errs.length === 0, errs.join(' | '));
  for (const id of [di.result.id, mine]) await rpc('api', tk, 'deleteDieselIssue', [id]); await rpc('api', tk, 'deleteInward', [inw.result.id]);
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
