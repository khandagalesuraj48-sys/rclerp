// (update-140) THE LIGHT 15-MINUTE CHECK of the tables kept in a server's memory (server/gas.js makeWarm → check).
// Two servers of their own (ports 3007 / 3008) are started from the built app (APP_DIR, default /home/claude/vercel) with the check
// due every 2 s instead of 15 min (RCL_WARM_REFRESH_MS – tests only). Changes are made STRAIGHT IN THE DATABASE in ways the
// "what changed since" question cannot see (the time of change put back, a delete that was not noted, a row that arrives with an old
// time – like a slow save): after the check both servers must show exactly what the database has. On the rig's gateway with its
// byte counter (GET /__meter) the check must also send far less than a whole read of the table.
const { execSync, spawn } = require('child_process');
const RIG_DB = process.env.RIG_DB || 'rcl', DOOR = process.env.RIG_DOOR || 'http://127.0.0.1:3100';      // another test database of the rig
const sql = q => execSync('su postgres -c "psql -d ' + RIG_DB + ' -tA -q"', { input: q }).toString().trim();
const APP = process.env.APP_DIR || '/home/claude/vercel', A = 3007, B = 3008;
const wait = ms => new Promise(r => setTimeout(r, ms));
const call = async (port, body) => { for (let i = 0; i < 3; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { await wait(300); } } throw new Error('server ' + port + ' does not answer'); };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const meter = async () => { try { return await (await fetch(DOOR + '/__meter')).json(); } catch (e) { return null; } };
const NO = 'EG-1', LOGID = 'EG-1|2026-10-01|Full Day';
const clean = () => sql("delete from diesel_issue where machinery = '" + NO + "' or id = 'EG-LATE'; delete from log_book where machinery = '" + NO + "'; delete from master where id = '" + NO + "';");
const off = (table, trig, q) => sql('alter table ' + table + ' disable trigger ' + trig + '; ' + q + '; alter table ' + table + ' enable trigger ' + trig + ';');
(async () => {
  clean();
  const procs = [A, B].map(p => spawn('node', ['dev.js'], { cwd: APP, env: Object.assign({}, process.env, { PORT: String(p), RCL_WARM_REFRESH_MS: '2000', RCL_SITES_KEY: 'rig-sites-key-0123456789-abcdefghij' }), stdio: 'ignore' }));
  try {
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + B + '/'); if (r.status === 200) break; } catch (e) { /* not up yet */ } await wait(250); }
    const tk = {}; for (const p of [A, B]) tk[p] = (await call(p, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const api = async (p, fn, ...a) => { const r = await call(p, { fn: 'api', args: [tk[p], fn, a] }); if (r.error) throw new Error(fn + ' on ' + p + ': ' + r.error); return r.result; };
    const view = async p => { const d = await api(p, 'getDieselIssues', { from: '2026-10-01', to: '2026-10-02', no: NO, all: true }); const l = await api(p, 'getLogBookList', { from: '2026-10-01', to: '2026-10-02', no: NO, all: true });
      return 'issues ' + (d.rows || []).map(r => r.qty).sort((a, b) => a - b).join('+') + ' | log ' + (l.rows || []).map(r => r.date.slice(8) + ':' + r.okm + '-' + r.ckm).sort().join(','); };
    const truth = () => 'issues ' + sql("select coalesce(string_agg(qty::float::text, '+' order by qty), '') from diesel_issue where machinery = '" + NO + "'") + ' | log ' + sql("select coalesce(string_agg(to_char(date, 'DD') || ':' || coalesce(opening_km::float::text, '') || '-' || coalesce(closing_km::float::text, ''), ',' order by 1), '') from log_book where machinery = '" + NO + "'");
    const same = async name => { const a = await view(A), b = await view(B), t = truth(); ok(name, a === t && b === t, a === b && a === t ? t : 'server A: ' + a + ' ¦ server B: ' + b + ' ¦ database: ' + t); };
    const afterCheck = async name => { await wait(2600); await same(name); };
    await api(A, 'saveMaster', { no: NO, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Egress Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add');
    const i1 = await api(A, 'saveDieselIssue', { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: NO, qty: 11, kmReading: 100, force: true });
    await api(B, 'saveLogRows', { rows: [{ date: '2026-10-01', shift: 'Full Day', no: NO, mode: 'KM', openingKm: 100, closingKm: 150 }] });
    await same('start: an issue and a Log Book day, both servers agree with the database');
    // 1. a change with its time of change put back (the "what changed" question asks only for newer times – it cannot see it)
    off('diesel_issue', 'diesel_issue_touch', "update diesel_issue set qty = 44, updated_at = updated_at - interval '1 hour' where id = '" + i1.id + "'");
    await afterCheck('a change with an OLD time of change (unseen by "what changed") is found by the light check on both servers');
    // 2. the same in the Log Book, whose id has "|" and spaces (the read by id must quote it)
    off('log_book', 'log_book_touch', "update log_book set closing_km = 175, updated_at = updated_at - interval '1 hour' where id = '" + LOGID + "'");
    await afterCheck('…the same for a Log Book row whose id has "|" and spaces');
    // 3. a delete that was not noted in deleted_rows
    off('diesel_issue', 'diesel_issue_deleted', "delete from diesel_issue where id = '" + i1.id + "'");
    await afterCheck('a row deleted without its note in deleted_rows is gone on both servers');
    // 4. a row that arrives with an old time of change (as a slow save that began long ago would)
    sql("insert into diesel_issue (id, issue_date, shift, source, machinery, qty, created_at, updated_at) values ('EG-LATE', '2026-10-02', 'Day', 'Dispenser', '" + NO + "', 7, now() - interval '1 day', now() - interval '1 day')");
    await afterCheck('a row that arrives with an old time of change is added on both servers');
    // 5. many differences at once (more than 300): the table is read whole instead – still the same as the database
    off('log_book', 'log_book_touch', "update log_book set remark = coalesce(remark, '') || ' ', updated_at = updated_at - interval '1 minute' where id in (select id from log_book order by id limit 400)");
    off('log_book', 'log_book_touch', "update log_book set closing_km = 190, updated_at = updated_at - interval '1 hour' where id = '" + LOGID + "'");
    await afterCheck('400 rows changed behind the app\'s back: the table is read whole instead – both servers agree');
    // 6. what the light check costs, against a whole read (only on the rig's gateway with the byte counter)
    const m0 = await meter();
    if (!m0) ok('(the byte counter of the rig\'s gateway is not there – the cost was not measured)', true);
    else {
      await fetch(DOOR + '/__meter', { method: 'POST' });
      await wait(2600); await api(A, 'getLogBookList', { from: '2026-10-01', to: '2026-10-01', no: NO });
      const m = await meter(), sum = re => m.rows.filter(r => re.test(r.kind)).reduce((t, r) => t + r.bytes, 0);
      const light = sum(/^GET other log_book select&order/), whole = Number(sql("select sum(octet_length(row_to_json(t)::text)) from log_book t"));
      ok('the light check of the Log Book sends less than a sixth of the table (' + light + ' bytes against ' + whole + ')', light > 0 && light < whole / 6, { light, whole });
      ok('…and no whole read of the Log Book was needed', sum(/^GET whole log_book/) === 0, m.rows.slice(0, 6));
    }
  } catch (e) { ok('the test ran to its end', false, String(e.stack || e)); }
  finally { procs.forEach(p => { try { p.kill(); } catch (e) { /* gone */ } }); clean(); }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
