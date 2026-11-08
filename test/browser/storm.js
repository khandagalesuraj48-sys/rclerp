// Another user keeps saving entries. What happens on THIS user's screen (who is only looking / clicking)?
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const reqs = []; p.on('request', r => { if (/api\/rpc/.test(r.url())) { try { const j = JSON.parse(r.postData()); reqs.push(j.fn === 'api' ? j.args[1] : j.fn); } catch (e) {} } });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const dismiss = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  // a working day: several pages were opened, some Log Book rows are typed, the user now sits on Diesel Issue
  for (const t of ['dash', 'master', 'inward', 'transfer', 'log']) { await f.evaluate(t2 => showTab(t2), t); await wait(1800); await dismiss(); }
  await f.evaluate(async () => { setLgMode('date'); for (let i = 0; i < 12; i++) { while (document.querySelectorAll('#lg_in .lrow').length <= i) document.getElementById('l_add1').click(); const tr = document.querySelectorAll('#lg_in .lrow')[i]; const x = tr.querySelector('[data-f=no]'); x.value = 'MH-15-AB-' + String(41 + i).padStart(4, '0'); x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); } });
  await wait(2500); await f.evaluate(() => showTab('diesel')); await wait(2500); await dismiss();
  await f.evaluate(() => {
    window.__m = { blocked: 0, max: 0, last: performance.now(), writes: 0, clicks: 0, done: 0, slowest: 0 };
    setInterval(() => { const n = performance.now(), g = n - window.__m.last; window.__m.last = n; if (g > 60) { window.__m.blocked += g - 10; if (g > window.__m.max) window.__m.max = g; } }, 10);
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'); const proto = Object.getPrototypeOf(document.createElement('tbody'));
    new MutationObserver(l => { window.__m.writes += l.filter(x => x.type === 'childList' && x.target.tagName === 'TBODY' && x.addedNodes.length > 3).length; }).observe(document.body, { childList: true, subtree: true });
    // a click must reach its button: we press "One entry" / "Multiple entries" in turn and see whether the page switched
    document.getElementById('dmode_one').addEventListener('click', () => { window.__m.done++; }); document.getElementById('dmode_many').addEventListener('click', () => { window.__m.done++; });
  });
  const tok = (await rpc('login', 'view@rcl.test', 'Audit#PassView9!x')).result; const tk2 = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
  const n0 = reqs.length, t0 = Date.now(); const ids = []; let clicks = 0, lost = 0;
  const QUIET = process.argv[3] === 'quiet';
  const saver = (async () => { for (let i = 0; i < (QUIET ? 0 : 12); i++) { const r = await rpc('api', tk2, 'saveDieselIssue', [{ date: '2026-09-29', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-' + String(60 + i).padStart(4, '0'), qty: 3 + i, kmReading: 70000 + i, hrReading: 600 + i, driver: 'STORM', force: true }]); if (r.result && r.result.id) ids.push(r.result.id); await wait(2200); } })();
  const pos = id => f.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  while (Date.now() - t0 < 30000) { const id = clicks % 2 ? 'dmode_one' : 'dmode_many'; try { const q = await Promise.race([pos(id), wait(4000).then(() => null)]); if (q) { const before = await f.evaluate(() => window.__m.done); await p.mouse.click(q.x, q.y); await wait(120); const after = await Promise.race([f.evaluate(() => window.__m.done), wait(3000).then(() => -1)]); clicks++; if (after <= before) lost++; } else { clicks++; lost++; } } catch (e) { clicks++; lost++; } await wait(600); }
  await saver; await wait(4000);
  const m = await f.evaluate(() => window.__m); const mine = reqs.slice(n0); const by = {}; mine.forEach(x => { by[x] = (by[x] || 0) + 1; });
  console.log((process.argv[2] || '').padEnd(7) + ' 12 saves by another user in 30 s →  calls from this page: ' + mine.length + ' (without the 2-second check: ' + mine.filter(x => x !== 'sync').length + ')');
  console.log('        ' + Object.keys(by).sort((a, c) => by[c] - by[a]).slice(0, 9).map(k => k + ' ' + by[k]).join(', '));
  console.log('        page could not answer for ' + (m.blocked / 1000).toFixed(1) + ' s of 34 s in all, longest single freeze ' + Math.round(m.max) + ' ms; lists redrawn ' + m.writes + ' times; clicks: ' + clicks + ' tried, ' + lost + ' did not get through or took over 3 s');
  for (const id of ids) await rpc('api', tk2, 'deleteDieselIssue', [id]);
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
