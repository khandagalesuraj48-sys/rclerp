// One Log Book entry row measured by Time: how wide is the row against its box, and how wide are the time boxes – on the port given
// (3000 = new code, 3002 = the code that is live), at four screen widths. Reads only.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms)); const port = process.argv[2] || '3000', no = process.argv[3] || 'MH-15-AB-0001';
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  await f.evaluate(no => { try { closeConfirm(false); } catch (e) {} setLgMode('mach'); const n = document.getElementById('lg_top_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); }, no); await wait(3000);
  const way = await f.evaluate(() => { const tr = document.querySelector('#sec-log tr.lrow'); const bt = tr.querySelector('.way [data-way="Time"]'); if (bt && !bt.classList.contains('dis')) { bt.click(); return 'Time'; } return [...tr.querySelectorAll('.way .wy:not(.dis)')].map(x => x.dataset.way).join(','); }); await wait(800);
  const out = [];
  for (const w of [1920, 1536, 1366, 1280]) { await p.setViewport({ width: w, height: 800 }); await wait(700);
    out.push(w + ': ' + await f.evaluate(() => { const tr = document.querySelector('#sec-log tr.lrow'), wr = document.querySelector('.lg-wrap'); const last = [...tr.children].filter(x => x.offsetParent).reduce((a, x) => Math.max(a, x.getBoundingClientRect().right), 0);
      return 'box ' + Math.round(wr.getBoundingClientRect().width) + ' px, content ' + wr.scrollWidth + ' px, right edge of the last cell ' + Math.round(last - wr.getBoundingClientRect().left) + ', time boxes ' + [...tr.querySelectorAll('.rd.tm input[type=time]')].filter(x => x.offsetParent).map(x => Math.round(x.getBoundingClientRect().width)).join('/'); })); }
  console.log('port ' + port + ' (' + way + ')\n' + out.join('\n')); await b.close();
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
