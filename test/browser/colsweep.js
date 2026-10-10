// every page: tables whose total row (tfoot) has a different number of columns than the body / header, and inputs that run out of their cell
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms)); const port = process.argv[2] || '3000';
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1000);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  const dismiss = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  await dismiss(); const tabs = await f.evaluate(() => TABS.slice()); let seen = 0, bad = 0;
  for (const t of tabs) {
    await f.evaluate(t2 => showTab(t2), t); await wait(1500); await dismiss();
    // dates of the page → September (where the test entries are), then its load button if there is one
    await f.evaluate(() => { const sec = document.querySelector('main section:not([hidden])'); if (!sec) return; const ds = [...sec.querySelectorAll('input[type=date]')].filter(e => e.offsetParent && /from|to$/i.test(e.id));
      ds.forEach(e => { e.value = /from/i.test(e.id) ? '2026-09-01' : '2026-09-30'; e.dispatchEvent(new Event('change', { bubbles: true })); }); }); await wait(1800); await dismiss();
    const r = await f.evaluate(() => { const sec = document.querySelector('main section:not([hidden])') || document.body; const out = [], n = { tables: 0 };
      const width = (row, carry) => { let w = 0; [...row.cells].forEach(c => { w += c.colSpan || 1; }); return w + carry; };
      [...sec.querySelectorAll('table')].filter(tb => tb.offsetParent && tb.tFoot && tb.tFoot.rows.length && tb.tBodies[0] && tb.tBodies[0].rows.length).forEach(tb => { n.tables++;
        const body = [...tb.tBodies[0].rows].filter(x => x.offsetParent && ![...x.cells].some(c => c.rowSpan > 1)); if (!body.length) return; const bw = Math.max(...body.map(x => width(x, 0)));
        [...tb.tFoot.rows].filter(x => x.offsetParent).forEach(fr => { const fw = width(fr, 0); if (fw !== bw) out.push((tb.id || tb.className || 'table') + ': total row has ' + fw + ' columns, the rows have ' + bw); });
        // a total that is a number must stand under a heading (not under a hidden / wrong one): its box inside the box of a body cell of the same column
      });
      const spill = [...sec.querySelectorAll('td input, td select')].filter(e => e.offsetParent && e.closest('td').getBoundingClientRect().right + 1.5 < e.getBoundingClientRect().right).map(e => (e.closest('table').id || e.closest('table').className) + ' ' + (e.dataset.f || e.id || e.type));
      return { out: out, tables: n.tables, spill: [...new Set(spill)].slice(0, 4), title: (document.getElementById('page_title') || {}).textContent }; });
    seen += r.tables; if (r.out.length || r.spill.length) { bad++; console.log('CHECK ' + t.padEnd(12) + String(r.title).padEnd(26) + r.out.join(' ; ') + (r.spill.length ? ' | boxes out of their cell: ' + r.spill.join(', ') : '')); }
  }
  console.log('port ' + port + ': ' + tabs.length + ' pages, ' + seen + ' tables with a total row looked at, ' + bad + ' page(s) to check; script errors: ' + (errs.join(' | ') || 'none')); await b.close();
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
