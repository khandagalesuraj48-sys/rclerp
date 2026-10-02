// waiting bar for a slow server; a tab the browser had put to sleep comes back on the same page with an explanation
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  let slow = false; await p.setRequestInterception(true);
  p.on('request', r => { if (slow && /api\/rpc/.test(r.url()) && /getDieselIssues/.test(r.postData() || '')) setTimeout(() => r.continue().catch(() => {}), 4000); else r.continue().catch(() => {}); });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  let f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const bar = () => f.evaluate(() => { const w = document.getElementById('rcl_wait'); return !w || w.hidden ? 'hidden' : 'shown' + (w.lastChild.hidden ? '' : ': ' + w.lastChild.textContent); });
  await wait(4000); ok('no bar while nothing is waiting', (await bar()) === 'hidden', await bar());
  slow = true; await f.evaluate(() => showTab('diesel'));
  await wait(1300); const b1 = await bar(); await wait(2200); const b2 = await bar();
  const alive = await f.evaluate(() => { showTab('inward'); return document.getElementById('page_title').textContent; });
  slow = false; await wait(9000); const b3 = await bar();
  ok('a slow answer shows the moving bar after half a second', b1 === 'shown', b1);
  ok('…and the seconds once it is longer than 2.5 s', /^shown: Waiting for the server… [34] s$/.test(b2), b2);
  ok('…the app stays usable meanwhile (another page opens)', alive === 'Diesel Inward', alive);
  ok('…and the bar goes when the answer is there', b3 === 'hidden', b3);
  ok('the tab holds a lock (Chrome does not freeze such a tab)', await f.evaluate(async () => { const q = await navigator.locks.query(); return (q.held || []).some(l => l.name === 'rcl-fleet-erp-open'); }));
  // the browser had put the tab to sleep: same page again, explained once a day
  await f.evaluate(() => { localStorage.removeItem('rcl_slept_note'); showTab('log'); }); await wait(1500);   // (the test profile is reused: forget that the note was shown today)
  p.removeAllListeners('request'); await p.setRequestInterception(false);
  await p.evaluateOnNewDocument(() => { try { Object.defineProperty(Document.prototype, 'wasDiscarded', { get: () => true, configurable: true }); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); const hist = [];
  for (let k = 0; k < 7; k++) { await wait(1000); try { const fr = p.frames().find(x => x !== p.mainFrame()); hist.push(await fr.evaluate(() => { const bx = document.getElementById('fixbox'), t = document.getElementById('toast'); return (bx ? (bx.hidden ? 'hidden' : 'shown') + '/' + bx.className + '/' + bx.textContent.slice(1, 30) : 'none') + ' toast:' + (t && !t.hidden ? t.className + ':' + t.textContent.slice(0, 50) : '-'); })); } catch (e) { hist.push('x'); } }
  out.push('   after the reload, second by second: ' + hist.join(' | '));
  f = p.frames().find(x => x !== p.mainFrame());
  const st = await f.evaluate(() => { const bx = document.getElementById('fixbox'); return { page: document.getElementById('page_title').textContent, card: bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 900) : '', info: bx && bx.classList.contains('info') }; });
  ok('after the browser had put the tab to sleep: the same page opens again (Log Book, not the Dashboard)', st.page === 'Log Book', st.page);
  ok('…with an explanation and what to do in Chrome (Marathi)', st.info && /put this tab to sleep/.test(st.card) && /काय करायचे/.test(st.card) && /Always keep these sites active/.test(st.card), st.card);
  await p.screenshot({ path: 'shots/slept.png' });
  await p.reload({ waitUntil: 'load' }); await wait(7000); f = p.frames().find(x => x !== p.mainFrame());
  const st2 = await f.evaluate(() => { const bx = document.getElementById('fixbox'); return { page: document.getElementById('page_title').textContent, card: !!(bx && !bx.hidden) }; });
  ok('…the explanation comes once a day, the page every time', st2.page === 'Log Book' && !st2.card, st2);
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/idle.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/idle.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 500)); process.exit(1); });
