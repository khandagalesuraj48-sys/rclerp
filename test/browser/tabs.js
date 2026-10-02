// after someone else's save: do Tank Check and a report page still load when opened?
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
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); }); await wait(2500);
  const tk = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
  const r = await rpc('api', tk, 'saveInward', [{ date: '2026-10-02', location: 'Dispenser', pump: 'Tabs test', qty: 7, rate: 90, billNo: 'TT-1', billDate: '2026-10-02' }]);
  await wait(7000);
  console.log('S.stale exists after the other save:', await f.evaluate(() => !!S.stale));
  let n0 = reqs.length; await f.evaluate(() => showTab('tankcheck')); await wait(2500);
  console.log('Tank Check opened → asked the server for:', reqs.slice(n0).filter(x => x !== 'sync').join(', ') || 'NOTHING');
  const rp = await f.evaluate(() => TABS.find(t => /^rp-/.test(t)));
  await f.evaluate(t => showTab(t), rp); await wait(1500);
  console.log('report page ' + rp + ' opened → its dates are filled:', await f.evaluate(() => [...document.querySelectorAll('main section:not([hidden]) input[type=date]')].map(i => i.value).join(' to ') || 'EMPTY'));
  if (r.result && r.result.id) await rpc('api', tk, 'deleteInward', [r.result.id]);
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 300)); process.exit(1); });
