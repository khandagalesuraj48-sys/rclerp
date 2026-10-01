// every page of the app: open it, note JavaScript errors, failed server calls, and anything wider than its box
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push('JS error: ' + String(e.message).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  const slow = []; const t0 = {}; p.on('request', r => { if (/api\/rpc/.test(r.url())) t0[r._requestId || r.url() + Math.random()] = 0; });
  p.on('response', async r => { if (/api\/rpc/.test(r.url())) { try { const j = await r.json(); if (j && j.error && !/SESSION|View access/.test(j.error)) { let fn = ''; try { const q = JSON.parse(r.request().postData()); fn = q.fn === 'api' ? q.args[1] : q.fn; } catch (e) {} errs.push('server[' + fn + ']: ' + String(j.error).slice(0, 160)); } } catch (e) {} } });
  await p.evaluateOnNewDocument(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /hover: hover/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q); });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4000);
  const dismiss = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  await dismiss(); await wait(1000); await dismiss();
  const tabs = await f.evaluate(() => TABS.slice());
  console.log('pages:', tabs.length);
  for (const t of tabs) {
    const n0 = errs.length, t1 = Date.now();
    await f.evaluate(t2 => showTab(t2), t); await wait(1800); await dismiss();
    const o = await f.evaluate(() => { const sec = document.querySelector('main section:not([hidden])') || document.body;
      const wide = [...sec.querySelectorAll('.panel, .table-wrap, .grid, .actions, .panel-head')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 3 && getComputedStyle(e).overflowX === 'visible').map(e => (e.id || e.className).toString().slice(0, 30) + ' ' + e.scrollWidth + '>' + e.clientWidth);
      const page = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      const cut = [...sec.querySelectorAll('.btn')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 2).length;
      return { title: (document.getElementById('page_title') || {}).textContent, wide: wide.slice(0, 3), page: page, cut: cut }; });
    const mine = errs.slice(n0);
    console.log((mine.length || o.wide.length || o.page ? 'CHECK ' : 'ok    ') + t.padEnd(12) + String(o.title || '').padEnd(24) + (o.page ? ' PAGE SCROLLS SIDEWAYS' : '') + (o.wide.length ? ' spills: ' + o.wide.join('; ') : '') + (o.cut ? ' buttons cut: ' + o.cut : '') + (mine.length ? ' ' + mine.join(' | ') : ''));
  }
  await b.close();
})().catch(e => { console.log('FAIL', String(e.stack || e).slice(0, 400)); process.exit(1); });
