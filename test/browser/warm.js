// two servers, each with its own memory of the tables: after every change – through either server or straight in the database – both must show the same as the database
const fs = require('fs'); const { execSync } = require('child_process');
const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const call = async (port, body) => { for (let i = 0; i < 3; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i === 2) throw e; } } };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
const clean = () => sql("delete from diesel_issue where machinery = 'WQ-1'; delete from log_book where machinery in ('WQ-1', 'WQ-BULK'); delete from master where id in ('WQ-1', 'WQ-BULK');");
(async () => {
  clean();
  const tk = {}; for (const p of [3000, 3001]) tk[p] = (await call(p, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (p, fn, ...a) => { const r = await call(p, { fn: 'api', args: [tk[p], fn, a] }); if (r.error) throw new Error(fn + ' on ' + p + ': ' + r.error); return r.result; };
  // what each server shows for the test machinery, and what the database has
  const view = async p => { const d = await api(p, 'getDieselIssues', { from: '2026-10-01', to: '2026-10-02', no: 'WQ-1', all: true }); const l = await api(p, 'getLogBookList', { from: '2026-10-01', to: '2026-10-02', no: 'WQ-1', all: true });
    return 'issues ' + (d.rows || []).map(r => r.qty).sort((a, b) => a - b).join('+') + ' | log ' + (l.rows || []).map(r => r.date.slice(8) + ':' + r.okm + '-' + r.ckm).sort().join(',') ; };
  const truth = () => 'issues ' + sql("select coalesce(string_agg(qty::float::text, '+' order by qty), '') from diesel_issue where machinery = 'WQ-1'") + ' | log ' + sql("select coalesce(string_agg(to_char(date, 'DD') || ':' || opening_km::float || '-' || closing_km::float, ',' order by date), '') from log_book where machinery = 'WQ-1'");
  const same = async name => { const a = await view(3000), b = await view(3001), t = truth(); ok(name, a === t && b === t, a === b && a === t ? t : 'server A: ' + a + ' ¦ server B: ' + b + ' ¦ database: ' + t); };
  await api(3000, 'saveMaster', { no: 'WQ-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Warm Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  await same('a new machinery made on server A is known to server B');
  const i1 = await api(3000, 'saveDieselIssue', { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'WQ-1', qty: 11, kmReading: 100, force: true });
  await same('diesel issue added on A');
  await api(3001, 'updateDieselIssue', i1.id, { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'WQ-1', qty: 12, kmReading: 100, force: true });
  await same('…changed on B');
  const i2 = await api(3001, 'saveDieselIssue', { date: '2026-10-02', shift: 'Day', source: 'Dispenser', no: 'WQ-1', qty: 21, kmReading: 150, force: true });
  await api(3000, 'deleteDieselIssue', i1.id);
  await same('a second one added on B, the first deleted on A');
  await api(3001, 'saveLogRows', { rows: [{ date: '2026-10-01', shift: 'Full Day', no: 'WQ-1', mode: 'KM', openingKm: 100, closingKm: 150 }] });
  await api(3000, 'saveLogRows', { rows: [{ date: '2026-10-02', shift: 'Full Day', no: 'WQ-1', mode: 'KM', closingKm: 190 }] });
  await same('Log Book: one day entered on B, the next on A (its Start comes from the entry made on B)');
  await api(3000, 'updateLogRow', 'WQ-1|2026-10-01|Full Day', { closingKm: 160, work: '' });
  await same('…the first day corrected on A: the Start of the next day follows on both');
  await api(3001, 'deleteLogRow', 'WQ-1|2026-10-02|Full Day'); await api(3000, 'saveLogRows', { rows: [{ date: '2026-10-02', shift: 'Full Day', no: 'WQ-1', mode: 'KM', closingKm: 200 }] });
  await same('an entry deleted on B and entered again (same day) on A');
  // straight in the database, behind the app's back
  sql("update diesel_issue set qty = 33 where id = '" + i2.id + "'"); await same('a change made straight in the database is seen by both');
  sql("delete from log_book where id = 'WQ-1|2026-10-01|Full Day'"); await same('a row deleted straight in the database is gone on both');
  // a big change: 2,500 rows at once (more than one page of changes) – the servers must read the table whole and agree
  await api(3000, 'saveMaster', { no: 'WQ-BULK', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Warm Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2015-01-01' }, 'add');
  sql("insert into log_book select (jsonb_populate_record(null::log_book, to_jsonb(l) || jsonb_build_object('id', 'WQ-BULK|' || (date '2016-01-01' + g)::text || '|Full Day', 'machinery', 'WQ-BULK', 'date', (date '2016-01-01' + g)))).* from (select * from log_book where machinery = 'WQ-1' limit 1) l, generate_series(0, 2499) g");
  const big = async p => (await api(p, 'getLogBookList', { from: '2016-01-01', to: '2022-12-31', no: 'WQ-BULK', all: true })).rows.length;
  const nA = await big(3000), nB = await big(3001), nT = Number(sql("select count(*) from log_book where machinery = 'WQ-BULK'"));
  ok('2,500 rows added at once in the database: both servers have all of them', nA === 2500 && nB === 2500 && nT === 2500, { A: nA, B: nB, database: nT });
  sql("delete from log_book where machinery = 'WQ-BULK' and date >= '2018-01-01'");
  const mA = await big(3000), mB = await big(3001), mT = Number(sql("select count(*) from log_book where machinery = 'WQ-BULK'"));
  ok('…and when 1,769 of them are deleted at once, both agree with the database again', mA === mT && mB === mT && mT === 731, { A: mA, B: mB, database: mT });
  await same('the small machinery is still right on both after all that');
  clean();
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/warm.out', out.join('\n'));
})().catch(e => { fs.writeFileSync('/tmp/warm.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); try { clean(); } catch (e2) {} process.exit(1); });
