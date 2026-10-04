// the top bar on phone-size screens, every page: nothing lies over anything, the page title can be read, nothing runs off the screen
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core'); const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => { const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  let bad = 0, pages = 0;
  for (const W of [360, 412]) { const p = await b.newPage(); await p.setViewport({ width: W, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1500); const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
    const tabs = await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} return [...document.querySelectorAll('[id^="tab-"]')].map(x => x.id.slice(4)); });
    for (const t of tabs) { await f.evaluate(x => { try { closeConfirm(false); } catch (e) {} showTab(x); }, t); await wait(220);
      const r = await f.evaluate(() => { const box = el => { const x = el.getBoundingClientRect(); return [x.left, x.top, x.right, x.bottom]; };
        const left = [...document.querySelectorAll('.topbar .tb-left > *')].filter(e => e.offsetParent !== null), o = left.map(box), over = [];
        for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) if (o[i][0] < o[j][2] - 2 && o[j][0] < o[i][2] - 2 && o[i][1] < o[j][3] - 2 && o[j][1] < o[i][3] - 2) over.push(i + '×' + j);
        const h = document.getElementById('page_title'), hb = h.getBoundingClientRect(), bar = document.querySelector('.topbar').getBoundingClientRect();
        return { over: over, titleW: Math.round(hb.width), titleIn: hb.left >= 0 && hb.right <= innerWidth + 1, barH: Math.round(bar.height), spill: document.documentElement.scrollWidth > innerWidth + 1, title: h.textContent }; });
      pages++; if (r.over.length || r.titleW < 90 || !r.titleIn || r.spill || r.barH > 170) { bad++; console.log('CHECK ' + W + ' px ' + t + ': ' + JSON.stringify(r)); } }
    await p.close(); }
  console.log('top bar on phones: ' + pages + ' page views at 360 and 412 px, ' + bad + ' to check'); await b.close(); })().catch(e => { console.log('CRASH ' + String(e.message).slice(0, 200)); process.exit(1); });
