const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
const out = [];
(async () => {
  const tk = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
  for (const [no, type, unit, std] of [['NEWTIP-1', 'Tipper', 'KM', { kmStd: 4 }], ['NEWCRN-1', 'Crane', 'Hrs', { hrStd: 6 }]]) { const r = await rpc('api', tk, 'saveMaster', [Object.assign({ no: no, name: type, type: type, unit: unit, worksOn: [unit], owner: 'Vendor 5', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, std), 'add']); if (r.error) out.push('master ' + no + ': ' + r.error); }
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 700 });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2600); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  await f.evaluate(async () => { setLgMode('date'); const nos = ['NEWTIP-1', 'NEWCRN-1', 'MH-15-AB-0001'];
    for (let i = 0; i < 3; i++) { while (document.querySelectorAll('#lg_in .lrow').length <= i) document.getElementById('l_add1').click(); const tr = document.querySelectorAll('#lg_in .lrow')[i]; const x = tr.querySelector('[data-f=no]'); x.value = nos[i]; x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1500));
      [...tr.querySelectorAll('.way .wy')].find(b => b.dataset.way === 'No reading').click(); await new Promise(r => setTimeout(r, 300)); } lgCalcAll(); });
  await wait(600);
  const rows = await f.evaluate(() => [...document.querySelectorAll('#lg_in .lrow')].map(tr => tr.querySelector('[data-f=no]').value + ' → est km "' + tr.querySelector('[data-f=estKm]').value + '", est hr "' + tr.querySelector('[data-f=estHr]').value + '" | ' + tr.querySelector('.nrhint').textContent));
  out.push(...rows); await p.screenshot({ path: 'shots/meter_first.png' });
  await b.close();
  for (const no of ['NEWTIP-1', 'NEWCRN-1']) await rpc('api', tk, 'deleteMaster', [no, true]);
  fs.writeFileSync('/tmp/meter2.out', out.join('\n'));
})().catch(e => { fs.writeFileSync('/tmp/meter2.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 400)); process.exit(1); });
