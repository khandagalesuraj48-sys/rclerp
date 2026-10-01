// the "anything changed?" check: overlap, slow network, failures, hidden tab, sign-out
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(x).slice(0, 200) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  let mode = 'pass', delay = 0, open = 0, maxOpen = 0; const sent = [];
  await p.setRequestInterception(true);
  p.on('request', async r => { const isSync = /api\/rpc/.test(r.url()) && /"sync"/.test(r.postData() || '');
    if (!isSync) return r.continue();
    sent.push(Date.now()); open++; maxOpen = Math.max(maxOpen, open);
    if (mode === 'fail') { open--; return r.abort('failed'); }
    if (delay) await wait(delay);
    try { await r.continue(); } catch (e) {} });
  p.on('requestfinished', r => { if (/api\/rpc/.test(r.url()) && /"sync"/.test(r.postData() || '')) open--; });
  p.on('requestfailed', r => { if (/api\/rpc/.test(r.url()) && /"sync"/.test(r.postData() || '') && mode !== 'fail') open--; });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const count = async (ms, move) => { const n0 = sent.length, t0 = Date.now(); while (Date.now() - t0 < ms) { if (move) await p.mouse.move(500 + Math.random() * 200, 300 + Math.random() * 200); await wait(500); } return sent.length - n0; };
  const live = () => f.evaluate(() => document.getElementById('live_dot').textContent.trim());
  let n = await count(20000, true); ok('working: about one check every 2 seconds', n >= 8 && n <= 13, n + ' checks in 20 s');
  ok('never two checks at the same time', maxOpen <= 1, 'most at once: ' + maxOpen);
  // many "window came to the front" signals at once must not start many loops
  await f.evaluate(() => { for (let i = 0; i < 25; i++) window.dispatchEvent(new Event('focus')); }); n = await count(10000, true);
  ok('25 focus signals at once do not multiply the checks', n <= 8 && maxOpen <= 1, n + ' checks in 10 s, most at once ' + maxOpen);
  // slow network: every answer takes 3.5 s
  delay = 3500; maxOpen = 0; n = await count(15000, true); delay = 0;
  ok('slow network (3.5 s per answer): the next check waits for the answer', maxOpen <= 1 && n <= 5, n + ' checks in 15 s, most at once ' + maxOpen);
  await wait(4500);
  // network down
  mode = 'fail'; maxOpen = 0; n = await count(12000, true); const shown = await live();
  ok('network down: the page says so and keeps a steady rhythm (no storm of retries)', /Reconnecting/.test(shown) && n <= 8, '"' + shown + '", ' + n + ' attempts in 12 s');
  mode = 'pass'; await count(5000, true); ok('network back: "Live" again by itself', /Live/.test(await live()), await live());
  // tab in the background
  await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(1000); n = await count(40000, false); ok('tab in the background: about one check in 30 seconds', n >= 1 && n <= 2, n + ' checks in 40 s');
  await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(900); const back = sent.length; await wait(100); ok('coming back to the tab asks at once', sent.length >= back && Date.now() - sent[sent.length - 1] < 1500, 'last check ' + (Date.now() - sent[sent.length - 1]) + ' ms ago');
  // sign out
  await f.evaluate(() => { const x = [...document.querySelectorAll('button')].find(q => /^Logout$/i.test(q.textContent.trim())); x.click(); }); await wait(1500);
  await f.evaluate(() => { try { const k = document.getElementById('cf_ok'); if (k && !document.getElementById('cf_back').hidden) k.click(); } catch (e) {} }); await wait(1500);
  n = await count(8000, true); ok('after sign-out the checks stop', n === 0, n + ' checks in 8 s; sign-in screen shown: ' + await f.evaluate(() => !document.getElementById('login_screen').hidden));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
