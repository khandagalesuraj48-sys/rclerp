// "first 100 rows + Show all": rows drawn, order, totals, filter, export request, and the time the page freezes
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  → ' + String(x).slice(0, 230) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const reqs = []; p.on('request', r => { if (/api\/rpc/.test(r.url())) { try { const j = JSON.parse(r.postData()); if (j.fn === 'api') reqs.push({ fn: j.args[1], a: j.args[2] }); } catch (e) {} } });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const state = id => f.evaluate(id2 => { const tb = document.getElementById(id2), sec = tb.closest('section'), bar = sec.querySelector('.more-bar:not([hidden])');
    return { rows: tb.rows.length, first: tb.rows[0] ? tb.rows[0].cells[0].textContent.trim() + '|' + (tb.rows[0].cells[1] ? tb.rows[0].cells[1].textContent.trim() : '') : '', last: tb.rows.length ? tb.rows[tb.rows.length - 1].cells[0].textContent.trim() : '',
      bar: bar ? bar.textContent.trim() : '', sums: [...sec.querySelectorAll('.sum, tfoot')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' || ').slice(0, 300) }; }, id);
  const press = (id, what) => f.evaluate((id2, w) => { const bar = document.getElementById(id2).closest('section').querySelector('.more-bar:not([hidden]) [data-more=' + w + ']'); if (bar) bar.click(); return !!bar; }, id, what);
  for (const [tab, id, fn, args] of [['diesel', 'd_rows', 'getDieselIssues', {}], ['log', 'l_rows', 'getLogBookList', {}], ['master', 'm_rows', '', null], ['activity', 'a_rows', '', null]]) {
    await f.evaluate(t => { try { closeConfirm(false); } catch (e) {} showTab(t); }, tab); await wait(2600); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    const s0 = await state(id); const m = /of (\d+) rows/.exec(s0.bar); const N = m ? Number(m[1]) : s0.rows;
    console.log('\n' + tab + ': ' + s0.rows + ' rows drawn; bar: "' + s0.bar.slice(0, 120) + '"');
    if (N <= 100) { ok(tab + ': list has ' + N + ' rows – all drawn, no bar', s0.rows === N && !s0.bar); continue; }
    ok(tab + ': first 100 of ' + N + ' drawn, with a clear note and button', s0.rows === 100 && /first 100 of/.test(s0.bar) && /Show all/.test(s0.bar));
    await press(id, 'all'); let s1 = await state(id); for (let k = 0; k < 40 && s1.rows < N; k++) { await wait(150); s1 = await state(id); }   // the rows come 50 per frame
    ok(tab + ': "Show all" draws every row of the list', s1.rows === N && /All \d+ rows/.test(s1.bar), s1.rows + ' rows');
    ok(tab + ': same order (the first row did not change)', s1.first === s0.first, s0.first);
    ok(tab + ': totals on the page are the same before and after', s1.sums === s0.sums, s0.sums.slice(0, 150));
    await press(id, 'less'); await wait(300); const s2 = await state(id);
    ok(tab + ': "Show the first 100 only" goes back to 100, same first row', s2.rows === 100 && s2.first === s0.first);
  }
  // totals count every record, not the 100 drawn: compare with the database's own answer
  await f.evaluate(() => showTab('diesel')); await wait(2000);
  const api = await f.evaluate(async () => { const r = await call('getDieselIssues', {}); return { count: r.count, totalQty: r.totalQty, rows: r.rows.length, firstId: r.rows[0] && r.rows[0].id }; });
  const sd = await state('d_rows');
  ok('Diesel issued: the total line counts all ' + api.count + ' records (the list holds ' + api.rows + ', 100 are drawn)', sd.sums.indexOf(String(api.count)) > -1 && sd.rows === 100, sd.sums.slice(0, 160));
  ok('Diesel issued: the first row drawn is the first row of the list', sd.first.indexOf(api.firstId) === 0, sd.first + ' vs ' + api.firstId);
  // a filter still searches everything (the server does it), then the result is drawn by the same rule
  const before = reqs.length;
  await f.evaluate(() => { const i = [...document.querySelectorAll('#sec-diesel input')].find(x => /3232|number or name/i.test(x.placeholder || '') && x.closest('.panel') && !x.closest('[data-perm]')); i.value = 'MH-15-AB-0003'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  const fl = await state('d_rows'); const asked = reqs.slice(before).filter(r => r.fn === 'getDieselIssues').pop();
  ok('a filter is answered by the server over all records', !!asked && JSON.stringify(asked.a).indexOf('MH-15-AB-0003') > -1 && fl.rows > 0 && fl.rows <= 100, 'asked ' + JSON.stringify(asked && asked.a).slice(0, 120) + ' → ' + fl.rows + ' rows drawn');
  // export: what does the Excel button ask the server for?
  const b2 = reqs.length;
  await f.evaluate(() => { const x = [...document.querySelectorAll('#sec-diesel button')].find(q => /Export to Excel/i.test(q.textContent)); if (x) x.click(); }); await wait(2500);
  const ex = reqs.slice(b2).filter(r => /Diesel/i.test(r.fn)).pop();
  ok('"Export to Excel" asks the server for ALL matching records (not the rows drawn)', !!ex && /"all":true/.test(JSON.stringify(ex.a)), ex ? ex.fn + ' ' + JSON.stringify(ex.a).slice(0, 140) : 'no request seen');
  ok('no script error on the way', errs.length === 0, errs.join(' | '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
