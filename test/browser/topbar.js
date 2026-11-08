// the top bar with every pill showing: the page title must not be covered, nothing may spill, on two screen widths
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  for (const W of [1536, 1366, 1280]) {
    const p = await b.newPage(); await p.setViewport({ width: W, height: 800 });
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6500);
    const r = await f.evaluate(async () => { try { closeConfirm(false); } catch (e) {} setClosed('2026-08-31'); const sleep = ms => new Promise(r => setTimeout(r, ms)); const bad = []; let pills = '';
      for (const t of TABS) { showTab(t); await sleep(120); const ti = document.getElementById('page_title').getBoundingClientRect(), right = document.querySelector('.tb-right'), first = [...right.children].filter(x => x.offsetParent !== null)[0].getBoundingClientRect(), bar = document.querySelector('.topbar');
        const over = [...right.children].filter(x => x.offsetParent !== null).map(x => x.getBoundingClientRect()).filter(q => q.left < ti.right - 1 && q.right > ti.left + 1 && q.top < ti.bottom - 1 && q.bottom > ti.top + 1).length;
        if (over) bad.push(t + ': title covered'); if (bar.scrollWidth > bar.clientWidth + 1) bad.push(t + ': bar spills ' + (bar.scrollWidth - bar.clientWidth) + ' px'); if (bar.getBoundingClientRect().height > 80) bad.push(t + ': two lines');
        pills = [...right.children].filter(x => x.offsetParent !== null).map(x => (x.id || x.className.split(' ')[0]) + ':' + Math.round(x.getBoundingClientRect().width)).join(' '); }
      setClosed(''); return { bad, pills }; });
    console.log(W + ' px: ' + (r.bad.length ? r.bad.slice(0, 6).join(' | ') : 'title free and nothing spills on all 36 pages') + '\n   ' + r.pills);
    if (W === 1366) await p.screenshot({ path: 'shots/topbar.png', clip: { x: 0, y: 0, width: 1366, height: 120 } });
    await p.close();
  }
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
