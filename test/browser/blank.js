// the browser never reports "this panel is on screen" (what seems to have happened on the live site): pages must still be visible
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  await p.evaluateOnNewDocument(() => { window.IntersectionObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} }; });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  const res = await f.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const bad = []; let n = 0;
    showTab('vendors'); await sleep(400);
    for (const t of TABS) { try { closeConfirm(false); } catch (e) {} showTab(t); await new Promise(r => requestAnimationFrame(() => r())); await sleep(1700); const sec = document.getElementById('sec-' + t); if (!sec) continue;
      const ps = [...sec.querySelectorAll('.panel, .ledger, .loccard')].filter(x => x.offsetParent !== null); n += ps.length;
      const hid = ps.filter(x => Number(getComputedStyle(x).opacity) < 0.99).length; if (hid) bad.push(t + ' (' + hid + ' of ' + ps.length + ' invisible)'); }
    return { n, bad }; });
  console.log('with a browser that never reports: ' + res.n + ' panels on 36 pages, invisible after 1.7 s: ' + (res.bad.length ? res.bad.join(', ') : 'none'));
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 300)); process.exit(1); });
