// Log Book: list of the last 2 days by default, readings fully visible, other people's diesel in the open rows within seconds by ONE call
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  for (const W of [1536, 1366]) {
    const p = await b.newPage(); await p.setViewport({ width: W, height: 860 });
    await p.evaluateOnNewDocument(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /hover: hover/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q); });
    const reqs = []; p.on('request', r => { if (/api\/rpc/.test(r.url())) { try { const j = JSON.parse(r.postData()); if (j.fn === 'api') reqs.push({ fn: j.args[1], a: j.args[2] }); } catch (e) {} } });
    const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2800); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    if (W === 1536) {
      const d = await f.evaluate(() => ({ from: document.getElementById('lf_from').value, to: document.getElementById('lf_to').value, today: S.today, rows: document.getElementById('l_rows').rows.length }));
      const first = reqs.find(r => r.fn === 'getLogBookList');
      const y = new Date(d.today + 'T00:00:00'); y.setDate(y.getDate() - 1); const ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      ok('the list opens with yesterday and today only', d.from === ys && d.to === d.today && first && JSON.stringify(first.a).indexOf(ys) > -1, d.from + ' to ' + d.to + ', ' + d.rows + ' row(s); asked ' + JSON.stringify(first && first.a).slice(0, 120));
      await f.evaluate(() => document.getElementById('lf_reset').click()); await wait(1500);
      ok('"Clear filters" goes back to the two days', await f.evaluate(ys2 => document.getElementById('lf_from').value === ys2, ys));
    }
    // rows with long readings
    await f.evaluate(async () => { setLgMode('date'); const nos = ['MH-15-AB-0003', 'MH-15-AB-0001', 'MH-15-AB-0004'];
      for (let i = 0; i < 3; i++) { while (document.querySelectorAll('#lg_in .lrow').length <= i) document.getElementById('l_add1').click(); const tr = document.querySelectorAll('#lg_in .lrow')[i]; const x = tr.querySelector('[data-f=no]'); x.value = nos[i]; x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); } });
    await wait(1500);
    const rd = await f.evaluate(() => { const out = []; document.querySelectorAll('#lg_in .lrow').forEach(tr => { tr.querySelectorAll('input[data-f=openingKm], input[data-f=closingKm], input[data-f=openingHr], input[data-f=closingHr]').forEach(i => { if (i.offsetParent === null) return; const keep = i.value, ro = i.readOnly; i.value = '12345678.5'; out.push({ f: i.dataset.f, w: i.clientWidth, need: i.scrollWidth, fits: i.scrollWidth <= i.clientWidth + 1 }); i.value = keep; }); }); const lg = document.querySelector('#lg_in .lrow'); return { cells: out, room: document.querySelector('.lg-wrap').clientWidth, rowFits: lg.scrollWidth <= lg.clientWidth + 1, heights: [...document.querySelectorAll('#lg_in .lrow')].map(r => Math.round(r.getBoundingClientRect().height)).join(',') }; });
    ok(W + ' px screen: a reading of 10 characters (12345678.5) is fully visible in every Start / Close field', rd.cells.length >= 6 && rd.cells.every(c => c.fits), 'room ' + rd.room + ' px, row fits ' + rd.rowFits + ', row heights ' + rd.heights + ', fields ' + rd.cells.map(c => c.w + '/' + c.need).join(' '));
    await p.screenshot({ path: 'shots/lg2_' + W + '.png' });
    if (W === 1536) {
      const tk = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token; const day = await f.evaluate(() => document.getElementById('lg_top_date').value);
      const n0 = reqs.length, t0 = Date.now();
      const r = await rpc('api', tk, 'saveDieselIssue', [{ date: day, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0001', qty: 33, kmReading: 71500, hrReading: 715, driver: 'LG2', force: true }]);
      let seen = 0; for (let i = 0; i < 40 && !seen; i++) { await wait(250); if (await f.evaluate(() => /33/.test((document.querySelectorAll('#lg_in .lrow')[1].querySelector('[data-o=dieselCell]') || {}).textContent || ''))) seen = Date.now() - t0; }
      const calls = reqs.slice(n0).map(x => x.fn).filter(x => x !== 'sync');
      ok('another user issues 33 L to a machinery of an open row: the row shows it by itself', seen > 0, seen ? 'after ' + (seen / 1000).toFixed(1) + ' s' : 'not seen in 10 s');
      ok('…with ONE call for all open rows (no call per row)', calls.filter(x => x === 'getLogRowPrefills').length >= 1 && calls.filter(x => x === 'getLogRowPrefill').length === 0, calls.join(', '));
      if (r.result && r.result.id) await rpc('api', tk, 'deleteDieselIssue', [r.result.id]);
    }
    ok(W + ': no script error', errs.length === 0, errs.join(' | '));
    await p.close();
  }
  console.log(pass + ' passed, ' + fail + ' failed'); await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
