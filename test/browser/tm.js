// his transit-mixer example through the real reports and the database
const fs = require('fs'); const { execSync } = require('child_process');
const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
(async () => {
  sql("delete from log_book where machinery in ('TMX-1', 'TMX-2'); delete from diesel_issue where machinery in ('TMX-1', 'TMX-2'); delete from master where id in ('TMX-1', 'TMX-2');");
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); if (r.error) out.push('setup ' + fn + ': ' + r.error); return r.result; };
  for (const no of ['TMX-1', 'TMX-2']) await api('saveMaster', { no: no, name: 'Transit Mixer', type: 'TM', unit: 'KM + Hrs', worksOn: ['KM + Hrs'], kmStd: 1.5, hrStd: 3, owner: 'Rachana Construction Limited', ownership: 'Own', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  // TMX-1 = his example: 102.4 km, 1.8 hr, one fill of 60 L
  await api('saveLogRows', { rows: [{ date: '2026-10-01', shift: 'Full Day', no: 'TMX-1', mode: 'KM + Hrs', openingKm: 147810, closingKm: 147912.4, openingHr: 5088.2, closingHr: 5090 }] });
  await api('saveDieselIssue', { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'TMX-1', qty: 60, kmReading: 147810, hrReading: 5088.2, force: true });
  // TMX-2: the hours alone need more than the diesel given (20 hr × 3 = 60 L, 40 L given)
  await api('saveLogRows', { rows: [{ date: '2026-10-01', shift: 'Full Day', no: 'TMX-2', mode: 'KM + Hrs', openingKm: 1000, closingKm: 1050, openingHr: 100, closingHr: 120 }] });
  await api('saveDieselIssue', { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'TMX-2', qty: 40, kmReading: 1000, hrReading: 100, force: true });
  const f = { from: '2026-10-01', to: '2026-10-01' };
  const mon = await api('getMonthlyAvgReport', f);
  const rowsM = [].concat(...(mon.groups || []).map(g => g.rows || g.machines || [])).filter(r => /^TMX-/.test(r.no || r.id || ''));
  const m1 = rowsM.find(r => (r.no || r.id) === 'TMX-1') || {}, m2 = rowsM.find(r => (r.no || r.id) === 'TMX-2') || {};
  ok('Monthly Diesel & Average: his example shows 1.88 km/L with the drum at its standard; the diesel is still judged on the total (60 L against 73.67 L needed → Very good, 19% less)', m1.actual === '1.88 km/L + 3 L/hr (std)' && m1.status === 'Very good – 19% less diesel' && m1.tKm === 102.4 && m1.tHr === 1.8, { actual: m1.actual, status: m1.status, km: m1.tKm, hr: m1.tHr, need: m1.need });
  ok('…when the hours alone need more than the diesel given, no average is made up – it says so', m2.actual === 'hours need 60 L, 40 L given – check readings', { actual: m2.actual, status: m2.status });
  const av = await api('rptAverage', f);
  const rowsA = [].concat(...(av.groups || []).map(g => g.rows || g.machines || [])).filter(r => /^TMX-/.test(r.no || r.id || ''));
  const a1 = rowsA.find(r => (r.no || r.id) === 'TMX-1') || {};
  ok('Actual vs Standard Average: the same figure', a1.actual === '1.88 km/L + 3 L/hr (std)' && a1.status === 'Very good – 19% less diesel', { actual: a1.actual, status: a1.status, expected: a1.expected });
  const lg = await api('getLogBookList', { from: '2026-10-01', to: '2026-10-01', no: 'TMX-1', all: true });
  const l1 = (lg.rows || [])[0] || {};
  ok('Log Book list: the fill is still running (its average is made when the next fill closes it); work and standard need are as in the reports', /Running on fill/.test(String(l1.avg)) && /60 L filled \| 102\.4 km \+ 1\.8 hr \| std 73\.67 L/.test(String(l1.cycle).replace(/\s+/g, ' ')), { avg: l1.avg, cycle: l1.cycle });
  sql("delete from log_book where machinery in ('TMX-1', 'TMX-2'); delete from diesel_issue where machinery in ('TMX-1', 'TMX-2'); delete from master where id in ('TMX-1', 'TMX-2');");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/tm.out', out.join('\n'));
})().catch(e => { fs.writeFileSync('/tmp/tm.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
