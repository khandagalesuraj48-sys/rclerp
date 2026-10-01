const { execSync } = require('child_process');
const call = async (port, fn, ...args) => { const t = Date.now(); const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) }); const j = await r.json(); j.ms = Date.now() - t; return j; };
const sql = q => execSync('su postgres -c "psql -d rcl -tAc \\"' + q + '\\""').toString().trim();
const ok = (name, cond, extra) => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
(async () => {
  let r = await call(3000, 'login', 'sujit@rcl.test', 'Nashik#Road848!'); const token = r.result.token; ok('login', !!token);
  const api = (port, fn, ...a) => call(port, 'api', token, fn, a);
  const before = (await api(3000, 'getStock')).result.stock, n0 = Number(sql('select count(*) from diesel_issue'));
  const many = await Promise.all(Array.from({ length: 10 }, (_, i) => api(i % 2 ? 3000 : 3001, 'saveDieselIssue', { date: '2026-09-30', shift: 'Night', source: 'Dispenser', no: 'MH-15-AB-' + String(i + 1).padStart(4, '0'), qty: 5, kmReading: (i + 1) % 3 === 0 ? '' : 99000 + i, hrReading: (i + 1) % 3 === 0 ? 99000 + i : '', driver: 'T' + i })));
  ok('10 saves at the same moment on two servers', many.every(x => !x.error), many.filter(x => x.error).map(x => x.error).join(' | ').slice(0, 300) + ' times ' + many.map(x => x.ms).join(','));
  const ids = sql("select string_agg(id, chr(44) order by id) from diesel_issue where driver_name like 'T_' and issue_date = '2026-09-30' and shift = 'Night'").split(',');
  ok('numbers are all different', new Set(ids).size === ids.length && ids.length >= 10, ids.slice(-10).join(' '));
  ok('rows in database', Number(sql('select count(*) from diesel_issue')) === n0 + 10);
  const after = (await api(3001, 'getStock')).result.stock; ok('stock went down by 50 (read on the other server right after)', Math.abs(before - after - 50) < 0.01, before + ' → ' + after);
  ok('no lock left behind', sql('select count(*) from web.locks') === '0');
  // a change from outside is seen at once, on a warm server
  await api(3000, 'getLookups'); await api(3000, 'getLookups');
  sql("update master set machinery_name = 'CHANGED OUTSIDE' where id = 'MH-15-AB-0001'");
  r = await api(3000, 'getLookups'); ok('change made outside the app is seen', r.result.master.find(m => m.id === 'MH-15-AB-0001').name === 'CHANGED OUTSIDE');
  sql("update master set machinery_name = 'Tipper' where id = 'MH-15-AB-0001'");
  // own save is seen by the next read on the same warm thread and on the other server
  r = await api(3000, 'saveLogRows', { rows: [{ date: '2026-10-01', shift: 'Full Day', no: 'MH-15-AB-0001', mode: 'KM', closingKm: 3500 + Math.floor(Math.random() * 1000), work: 'regression' }] });
  const saved = !r.error || /already saved/.test(r.error); ok('save a Log Book row', saved, r.error || '');
  const l1 = await api(3000, 'getLogBookList', { from: '2026-10-01', to: '2026-10-01', no: 'MH-15-AB-0001' }), l2 = await api(3001, 'getLogBookList', { from: '2026-10-01', to: '2026-10-01', no: 'MH-15-AB-0001' });
  ok('the saved row is read back (same server / other server)', l1.result.rows.length === 1 && l2.result.rows.length === 1, l1.ms + ' ms / ' + l2.ms + ' ms');
  // clean up the test rows
  for (const id of ids.slice(-10)) { const d = await api(3000, 'deleteDieselIssue', id); if (d.error) console.log('cleanup', d.error); }
  const end = (await api(3001, 'getStock')).result.stock; ok('after deleting them the stock is back', Math.abs(end - before) < 0.01, String(end));
  let t = Date.now(); for (let i = 0; i < 20; i++) await api(3000, 'sync'); ok('20 sync calls', true, (Date.now() - t) + ' ms');
})().catch(e => console.log('CRASH', e));
