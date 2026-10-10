// BEFORE / AFTER (update-69): the Log Book print of EVERY machinery of a period, on the live code (port A) and on the changed code
// (port B), same database. Expected: every sheet the same to the letter – except a machinery that has an entry with two works,
// where only the ROWS differ (a row for each work) and every total and every amount is the same.   node compare69.js 3008 3000
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const [pa, pb] = [process.argv[2] || '3008', process.argv[3] || '3000'], from = process.argv[4] || '2026-09-01', to = process.argv[5] || '2026-10-10';
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const sheets = async port => { const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 }); const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200); const f = p.frames().find(x => x !== p.mainFrame());
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
    const r = await f.evaluate(async (from, to) => { try { closeConfirm(false); } catch (e) {} const L = await call('getLogBookList', { from: from, to: to, all: true }); const x = await logSheetsOf({ rows: L.rows, f: { from: from, to: to }, summary: [] }, 'Rachana Construction Limited');
      const d = document.createElement('div'); d.innerHTML = x.sheets; const T = el => el.textContent.replace(/\s+/g, ' ').trim();
      return { entries: L.rows.length, split: L.rows.filter(r => (r.itemQty || []).filter(q => q.k !== 'day' && q.q > 0).length > 1).map(r => r.no + ' ' + r.date), sheets: [...d.querySelectorAll('section.lbsheet')].map(s => { const t = s.querySelector('table.lb-t'), rows = [...t.querySelectorAll('tbody tr')].map(T);
        const all = T(s); return { head: (all.match(/^.{0,140}/) || [''])[0], rows: rows, foot: T(t.querySelector('tfoot')), rest: all.slice(all.indexOf(T(t.querySelector('tfoot'))) + T(t.querySelector('tfoot')).length) }; }) }; }, from, to);
    await p.close(); return Object.assign(r, { errs: errs }); };
  const A = await sheets(pa), B = await sheets(pb);
  let same = 0, rowsOnly = 0; const diff = [];
  for (let i = 0; i < Math.max(A.sheets.length, B.sheets.length); i++) { const a = A.sheets[i] || {}, c = B.sheets[i] || {};
    const money = a.foot === c.foot && a.rest === c.rest && a.head === c.head;
    if (money && JSON.stringify(a.rows) === JSON.stringify(c.rows)) same++;
    else if (money) { rowsOnly++; diff.push('ROWS ONLY  ' + (a.head || '').slice(0, 70) + ' … ' + a.rows.length + ' rows → ' + c.rows.length + ' rows; totals and amounts the same'); }
    else diff.push('DIFFERENT  ' + (a.head || c.head || '').slice(0, 70) + (a.foot !== c.foot ? ' | total row: ' + a.foot + ' → ' + c.foot : '') + (a.rest !== c.rest ? ' | summary differs' : '')); }
  console.log('period ' + from + ' to ' + to + ' · entries ' + A.entries + ' / ' + B.entries + ' · sheets ' + A.sheets.length + ' / ' + B.sheets.length);
  console.log('entries with two works: ' + (B.split.length ? B.split.join(', ') : 'none'));
  console.log('sheets the same to the letter: ' + same + ' · sheets where only the rows differ: ' + rowsOnly + ' · sheets with another total or amount: ' + diff.filter(x => /^DIFFERENT/.test(x)).length);
  diff.forEach(x => console.log(x)); console.log('script errors: ' + (A.errs.concat(B.errs).join(' | ') || 'none'));
  await b.close();
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
