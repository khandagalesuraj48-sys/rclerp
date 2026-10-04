// his transit mixer sheet (MH-04-KU-3332, 01 to 05-10-2026) rebuilt: the Log Book print, the cost sheet / Log Book dashboard and the monthly report must all say the same average
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 460) : '')); };
const clean = () => sql("delete from log_book where machinery = 'TMB-3332'; delete from diesel_issue where machinery = 'TMB-3332'; delete from master where id = 'TMB-3332';");
(async () => {
  clean();
  const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); if (r.error) out.push('setup ' + fn + ': ' + r.error); return r.result; };
  await api('saveMaster', { no: 'TMB-3332', name: 'Transit Mixer', type: 'TM', unit: 'KM + Hrs', worksOn: ['KM + Hrs'], kmStd: 2.5, hrStd: 3, owner: 'TM Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  // the three days of his sheet: 33 + 76.9 + 100 = 209.9 km; 8.4 + 6.8 + 5.9 = 21.1 hr; 60 L each day
  await api('saveLogRows', { rows: [{ date: '2026-10-01', shift: 'Day', no: 'TMB-3332', mode: 'KM + Hrs', openingKm: 80273.1, closingKm: 80306.1, openingHr: 13306.1, closingHr: 13314.5 }] });
  await api('saveLogRows', { rows: [{ date: '2026-10-02', shift: 'Day', no: 'TMB-3332', mode: 'KM + Hrs', openingKm: 80308.6, closingKm: 80385.5, openingHr: 13314.5, closingHr: 13321.3 }] });
  await api('saveLogRows', { rows: [{ date: '2026-10-03', shift: 'Day', no: 'TMB-3332', mode: 'KM + Hrs', openingKm: 80385.5, closingKm: 80485.5, openingHr: 13321.3, closingHr: 13327.2 }] });
  for (const d of [['2026-10-01', 80273.1, 13306.1], ['2026-10-02', 80308.6, 13314.5], ['2026-10-03', 80393.7, 13322.8]]) await api('saveDieselIssue', { date: d[0], shift: 'Day', source: 'Dispenser', no: 'TMB-3332', qty: 60, kmReading: d[1], hrReading: d[2], force: true });
  const f0 = { from: '2026-10-01', to: '2026-10-05' };
  // the server's reports
  const mon = await api('getMonthlyAvgReport', f0), mrow = [].concat(...mon.groups.map(g => g.rows)).find(r => (r.no || r.id) === 'TMB-3332') || {};
  ok('Monthly Diesel & Average: 1.8 km/L + 3 L/hr (std)', mrow.actual === '1.8 km/L + 3 L/hr (std)' && mrow.tKm === 209.9 && mrow.tHr === 21.1, { actual: mrow.actual, km: mrow.tKm, hr: mrow.tHr, need: mrow.need });
  const dash = await api('logDashboard', f0), drow = (dash.machines || dash.rows || []).find(r => r.no === 'TMB-3332') || {};
  ok('Log Book dashboard / cost sheet: the same 1.8 km/L against the 2.5 km/L standard (it used to say 8.53 L/hr against 3)', drow.actualAvg === 1.8 && drow.stdAvg === 2.5 && drow.avgUnit === 'km/L (drum at 3 L/hr std)' && drow.std === 147.26 && drow.extra === 32.74, { actualAvg: drow.actualAvg, stdAvg: drow.stdAvg, unit: drow.avgUnit, need: drow.std, extra: drow.extra });
  // the page: the Log Book print
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const dlgYes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__docs = []; printDoc = function (title, inner) { window.__docs.push({ title: title, html: inner }); };
    document.getElementById('lf_from').value = '2026-10-01'; document.getElementById('lf_to').value = '2026-10-05'; const n0 = document.getElementById('lf_no'); n0.value = 'TMB-3332'; n0.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  await f.evaluate(() => [...document.querySelectorAll('#sec-log button')].find(x => /Print Log Book/.test(x.textContent)).click()); for (let i = 0; i < 20; i++) { await wait(400); await dlgYes(); if (await f.evaluate(() => window.__docs.length > 0)) break; }
  const cells = await f.evaluate(() => { const box = document.createElement('div'); box.innerHTML = (window.__docs[0] || { html: '' }).html; const o = {}; box.querySelectorAll('tr').forEach(tr => { const td = [...tr.children]; for (let i = 0; i + 1 < td.length; i += 2) { const k = td[i].textContent.replace(/\s+/g, ' ').trim(); if (/^(TOTAL KM|TOTAL HOURS|TOTAL DIESEL ISSUE|DIESEL MONTHLY AVERAGE|STANDARD AVERAGE|EXCESS DIESEL)/.test(k)) o[k.replace(/(DIESEL MONTHLY AVERAGE|STANDARD AVERAGE|EXCESS DIESEL – DEBIT AMT).*/, '$1')] = td[i + 1].textContent.replace(/\s+/g, ' ').trim(); } }); return o; });
  const whole = await f.evaluate(() => { const box = document.createElement('div'); box.innerHTML = (window.__docs[0] || { html: '' }).html; return box.textContent.replace(/\s+/g, ' '); });
  ok('Log Book print (the sheet that goes with the bill): 209.9 km, 21.1 hr, 180 L as on his sheet', /209\.9 KM/.test(whole) && /21\.1 HR/.test(whole) && /180(\.00)? LTR/.test(cells['TOTAL DIESEL ISSUE'] || ''), (whole.match(/TOTAL ?209\.9 KM ?21\.1 HR/) || whole.match(/209\.9 KM.{0,12}/) || [''])[0] + ' | ' + cells['TOTAL DIESEL ISSUE']);
  ok('…its "DIESEL MONTHLY AVERAGE" now follows the rule and shows the working: 1.80 KM/LTR, 3 LTR/HR (STD); drum 21.1 × 3 = 63.3 L, vehicle 180 − 63.3 = 116.7 L', /^1\.80 KM \/ LTR ?3 LTR \/ HR \(STD\) ?DRUM 21\.1 HR × 3 = 63\.3 L AT STANDARD · VEHICLE 180 − 63\.3 = 116\.7 L → 209\.9 KM ÷ 116\.7 L$/.test(cells['DIESEL MONTHLY AVERAGE'] || ''), cells['DIESEL MONTHLY AVERAGE']);
  ok('…and the money is unchanged: 147.26 L allowed for the work, 32.74 L over before the last fill\'s tank allowance', /147\.26 L allowed for the work/.test(cells['STANDARD AVERAGE'] || '') && /22\.66 L extra/.test(cells['EXCESS DIESEL – DEBIT AMT'] || '') && /10\.08 L TAKEN AS STILL IN THE TANK/.test(cells['EXCESS DIESEL – DEBIT AMT'] || ''), { std: cells['STANDARD AVERAGE'], excess: (cells['EXCESS DIESEL – DEBIT AMT'] || '').slice(0, 200) });
  fs.writeFileSync('/tmp/tmprint.html', '<html><head><meta charset="utf-8"><style>body{font-family:Arial;margin:16px;width:1000px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:3px 6px;font-size:12px}small{display:block;font-size:10px;color:#444}</style></head><body>' + (await f.evaluate(() => (window.__docs[0] || { html: '' }).html)) + '</body></html>');
  ok('no script error', errs.length === 0, errs.join(' | '));
  clean();
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/tmbill.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/tmbill.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); try { clean(); } catch (e2) {} process.exit(1); });
