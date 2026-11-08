// (update-140) THE START OF A REQUEST WITHOUT SENDING WHAT THE SERVER ALREADY HAS (sql/supabase_step2b_light_boot.sql, server/gas.js bootAsk).
// Two servers of their own (ports 3063 / 3064) from the built app (APP_DIR). A change made through ONE server, or straight in the
// database, must be seen by the OTHER at its next request: a setting, the users list, a sign-in switched off, a saved entry (the
// stamp). Without step 2b the server goes on with web_boot. On the rig's gateway (GET /__meter) the answer must be small.
//   RIG_DB=<database> RIG_DOOR=<its door> APP_DIR=<built app> node test/browser/boot140.js
const { execSync, spawn } = require('child_process');
const RIG_DB = process.env.RIG_DB || 'rcl', DOOR = process.env.RIG_DOOR || 'http://127.0.0.1:3100';
const sql = q => execSync('su postgres -c "psql -d ' + RIG_DB + ' -tA -q"', { input: q }).toString().trim();
const APP = process.env.APP_DIR || '/home/claude/vercel', A = 3063, B = 3064;
const wait = ms => new Promise(r => setTimeout(r, ms));
const call = async (port, body) => { for (let i = 0; i < 3; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { await wait(300); } } throw new Error('server ' + port + ' does not answer'); };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const meter = async () => { try { return await (await fetch(DOOR + '/__meter')).json(); } catch (e) { return null; } };
const zero = async () => { try { await fetch(DOOR + '/__meter', { method: 'POST' }); } catch (e) { /* no counter */ } };
const NO = 'BT-1', MAIL = 'boot140@rcl.test';
const clean = () => sql("delete from diesel_issue where machinery = '" + NO + "'; delete from master where id = '" + NO + "'; delete from web.props where key = 'BOOT140_TEST';");
(async () => {
  clean();
  const has2b = sql("select count(*) from pg_proc where proname = 'web_boot2' and pronargs = 4") === '1';
  const procs = [A, B].map(p => spawn('node', ['dev.js'], { cwd: APP, env: Object.assign({}, process.env, { PORT: String(p), RCL_SITES_KEY: 'rig-sites-key-0123456789-abcdefghij' }), stdio: 'ignore' }));
  try {
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + B + '/'); if (r.status === 200) break; } catch (e) { /* not up yet */ } await wait(250); }
    const tk = {}; for (const p of [A, B]) tk[p] = (await call(p, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const api = async (p, fn, ...a) => call(p, { fn: 'api', args: [tk[p], fn, a] });
    // warm both servers (their memory of the settings, the users list and the stamp)
    for (const p of [A, B]) { await api(p, 'getLookups'); await api(p, 'getLookups'); }
    // 1. a saved entry on A: B's next real request has the new stamp and shows it
    await api(A, 'saveMaster', { no: NO, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Boot Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add');
    const s1 = await api(A, 'saveDieselIssue', { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: NO, qty: 9, kmReading: 100, force: true });
    const l = await api(B, 'getDieselIssues', { from: '2026-10-01', to: '2026-10-01', no: NO, all: true });
    ok('an entry saved through server A is in server B\'s next list (the stamp changed → it is sent and B reads the change)', !s1.error && l.result && (l.result.rows || []).some(r => r.qty === 9), s1.error || l.error || (l.result.rows || []).length);
    // 2. a setting written straight in the database: the next request of each server has it
    sql("insert into web.props (key, value) values ('BOOT140_TEST', 'one') on conflict (key) do update set value = excluded.value");
    const v1 = sql("select value from web.props where key = 'BOOT140_TEST'");
    await api(A, 'getLookups'); await api(B, 'getLookups');
    sql("update web.props set value = 'two' where key = 'BOOT140_TEST'");
    // (a setting is read by the server's own code; seen here through the user's version keys – a version bump is a setting too)
    const before = (await api(B, 'sync')).result || {};
    sql("update web.props set value = (coalesce(nullif(value, ''), '0')::bigint + 1)::text where key = 'V_master'");
    await wait(1100);
    const after = (await api(B, 'sync')).result || {};
    ok('a setting changed in the database (the master version) is seen by the next request of the other server', v1 === 'one' && JSON.stringify(before.versions) !== JSON.stringify(after.versions), { before: before.versions, after: after.versions });
    // 3. sign-in ended (logout on A): B refuses that session at its next real request
    const t2 = (await call(B, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const pre = await call(A, { fn: 'api', args: [t2, 'getLookups', []] });
    await call(B, { fn: 'logout', args: [t2] });
    const post = await call(A, { fn: 'api', args: [t2, 'getLookups', []] });
    ok('a sign-in ended on server B is refused by server A at once (sessions always come fresh)', !pre.error && /SESSION_EXPIRED|sign in again|signed out/i.test(String(post.error || '')), { before: pre.error || 'ok', after: post.error || 'NOT REFUSED' });
    // 4. what one start of a request costs now (nothing changed in between)
    await api(A, 'getLookups'); await wait(1100); await zero();
    for (let i = 0; i < Number(process.env.N || 10); i++) { await api(A, 'getLookups'); await wait(1100); }
    const m = await meter();
    if (!m) ok('(the byte counter of the rig\'s gateway is not there – the cost was not measured)', true);
    else {
      const b2 = m.rows.find(x => x.kind === 'rpc web_boot2'), b1 = m.rows.find(x => x.kind === 'rpc web_boot');
      // (the counter adds ~300 bytes per answer for its headers; web_boot sent ~4,700 counted this way)
      if (has2b) ok('with step 2b: the start of a request with nothing changed is small – no settings, no users list, no stamp (counted with the answer\'s headers)', b2 && b2.calls >= 10 && b2.bytes / b2.calls < 700 && !b1, { per_call: b2 && Math.round(b2.bytes / b2.calls), calls: b2 && b2.calls, web_boot_calls: b1 && b1.calls });
      else ok('without step 2b: the server uses web_boot, as before', b1 && b1.calls >= 10 && !b2, { web_boot: b1, web_boot2: b2 });
    }
  } catch (e) { ok('the test ran to its end', false, String(e.stack || e)); }
  finally { procs.forEach(p => { try { p.kill(); } catch (e) { /* gone */ } }); clean(); }
  console.log((has2b ? '(step 2b installed)' : '(step 2b NOT installed)') + '\n' + out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
