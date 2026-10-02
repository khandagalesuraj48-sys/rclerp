// the "?" page guide and the on-the-spot checks
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const dismiss = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  // the guide on every page: open each page, press "?", the box must carry that page's text
  const pages = await f.evaluate(() => TABS.slice());
  let missing = [];
  for (const t of pages) { await dismiss(); await f.evaluate(t2 => showTab(t2), t); await wait(350); await dismiss();
    const g = await f.evaluate(() => { document.getElementById('pg_help').click(); const bx = document.getElementById('guidebox'); return bx && !bx.hidden ? bx.querySelector('.fixhelp').textContent : ''; });
    if (!/हे काय आहे/.test(g) || g.length < 120) missing.push(t); }
  ok('"?" shows the guide of the page on all ' + pages.length + ' pages (Marathi)', missing.length === 0, missing.join(', ') || 'all');
  await f.evaluate(() => showTab('bill')); await wait(1200); await dismiss(); await f.evaluate(() => document.getElementById('pg_help').click()); await wait(200);
  await p.screenshot({ path: 'shots/guide_bill.png' });
  const hi = await f.evaluate(() => { document.querySelector('#guidebox [data-fixlang=hi]').click(); return document.getElementById('guidebox').textContent; });
  ok('the guide switches to Hindi', /यह क्या है/.test(hi) && /Abstract/.test(hi), hi.slice(0, 140));
  await f.evaluate(() => { document.querySelector('#guidebox [data-fixlang=mr]').click(); showTab('diesel'); }); await wait(2200); await dismiss();
  ok('changing the page closes the guide', await f.evaluate(() => document.getElementById('guidebox').hidden === true));
  // on-the-spot checks
  const card = () => f.evaluate(() => { const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? bx.querySelector('.fx-msg').textContent + ' || ' + bx.querySelector('.fixhelp').textContent.replace(/\s+/g, ' ').slice(0, 160) : ''; });
  const set = (sel, v) => f.evaluate((s, v2) => { const el = document.querySelector(s); el.value = v2; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
  const tomorrow = await f.evaluate(() => { const t = new Date(S.today + 'T00:00:00'); t.setDate(t.getDate() + 1); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); });
  await set('#d_date', tomorrow); await wait(300); let c = await card();
  ok('Diesel Issue: a date after today is pointed out as soon as the field is left', /is after today/.test(c) && /काय करायचे/.test(c) && await f.evaluate(() => document.getElementById('d_date').classList.contains('live-bad')), c);
  await set('#d_date', await f.evaluate(() => S.today)); await wait(300);
  ok('…and the card goes away when the date is corrected', (await card()) === '' && await f.evaluate(() => !document.getElementById('d_date').classList.contains('live-bad')));
  await set('#d_no', 'ZZ-00-ZZ-0000'); await wait(300); c = await card(); ok('Diesel Issue: a machinery that is not in the Master', /is not in Master/.test(c), c);
  await set('#d_no', 'MH-15-AB-0001'); await wait(1500); await set('#d_qty', '99999999'); await wait(2200); c = await card();
  ok('Diesel Issue: more litres than the stock', /Not enough diesel/.test(c), c || ('balance box: ' + await f.evaluate(() => document.getElementById('d_balance').value)));
  await set('#d_qty', ''); await set('#d_no', ''); await wait(1400);
  await f.evaluate(() => showTab('log')); await wait(2500); await dismiss();
  await f.evaluate(async () => { setLgMode('date'); const tr = document.querySelector('#lg_in .lrow'); const x = tr.querySelector('[data-f=no]'); x.value = 'MH-15-AB-0001'; x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1500)); });
  await set('#lg_in .lrow [data-f=closingKm]', '5'); await wait(400); c = await card();
  ok('Log Book: a Close reading below the Start is pointed out before Save', /Close KM 5 is less than Start KM/.test(c) && /Closing reading/.test(c), c);
  const top = await f.evaluate(() => S.today); await set('#lg_top_date', tomorrow); await wait(400); c = await card();
  console.log('   (Log Book date field: ' + (c ? 'card shown' : 'no card – the date field of the entry is outside the checked forms') + ')');
  await set('#lg_top_date', top); await wait(300);
  await f.evaluate(() => { document.querySelector('#lg_in .lrow .dbt-btn').click(); }); await set('#lg_in .lrow [data-f=debitTo]', 'Nobody At All'); await wait(400); c = await card();
  ok('Log Book: "Debit to" a party that is not in the Vendor Master', /not in the Vendor Master/.test(c), c);
  await f.evaluate(() => document.getElementById('l_clear') && document.getElementById('l_clear').click()); await wait(300); await f.evaluate(() => { const k = document.getElementById('cf_ok'); if (!document.getElementById('cf_back').hidden) k.click(); });
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/guide2.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/guide2.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 400)); process.exit(1); });
