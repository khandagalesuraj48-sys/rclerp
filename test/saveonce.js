/* "A save is saved ONCE – decided inside the database" (update-68, decision D7; sql/supabase_step5_save_once.sql).
 * On the local test rig: PostgreSQL + PostgREST behind the gateway stand-in with its FAULT switch (test/gateway-standin.js),
 * the app's server on 3000 and 3001. Nothing here touches the live database.
 *   node test/saveonce.js [section …]     sections: normal lost dies together payload fails takeover direct sql numbers compat
 *   BEFORE=1 PORT=3002 APP_DIR=<folder of the code before> node test/saveonce.js normal lost dies together payload fails numbers
 *                                         the same faults against the code before update-68: lines marked [fix] FAIL there */
const { execSync, spawn } = require('child_process'); const path = require('path'), crypto = require('crypto');
const PORT = Number(process.env.PORT) || 3000, OTHER = PORT === 3000 ? 3001 : PORT, GW = 'http://127.0.0.1:3100';
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA -q"', { input: q, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
const raw = async (port, body, quiet) => { const t = Date.now(); let r; try { r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) }); } catch (e) { if (quiet) return { status: 0, error: 'NO ANSWER (' + String(e.cause && e.cause.code || e.message) + ')', ms: Date.now() - t }; throw e; }
  let j; const txt = await r.text(); try { j = JSON.parse(txt); } catch (e) { j = { error: 'no JSON (' + r.status + ')' }; } return { status: r.status, error: j.error, result: j.result, ms: Date.now() - t }; };
const fault = async f => { await fetch(GW + '/__fault', { method: 'POST', body: JSON.stringify(f || {}) }); };
const fired = async () => (await (await fetch(GW + '/__fault')).json());
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 420) : '')); };
const want = process.argv.slice(2), on = s => !want.length || want.indexOf(s) > -1;
const ADMIN = ['sujit@rcl.test', 'Nashik#Road848!'];
const rid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
const rows = tag => Number(sql("select count(*) from diesel_issue where driver_name = '" + tag + "'"));
const ids = tag => sql("select coalesce(string_agg(id, ',' order by id), '') from diesel_issue where driver_name = '" + tag + "'");
const lastNo = () => Number(sql("select value from web.props where key = 'DIESEL_LAST_NO'"));
const op = r => { const x = sql("select state || '|' || holder || '|' || coalesce(left(result, 200), '') from web.ops where rid = '" + r + "'"); const p = x.split('|'); return x ? { state: p[0], holder: p[1], result: p.slice(2).join('|') } : null; };
const logLines = id => sql("select count(*) || ' ' || coalesce(string_agg(action, '+'), '') from activity_log where record_id = '" + id + "'");
const verStock = () => sql("select value from web.props where key = 'V_stock'");
const closed = r => sql("select (closed_at is not null)::text from web.ops where rid = '" + r + "'");
const hasOps = () => sql("select count(*) from pg_proc where proname = 'web_write2'") === '1';
const unlock = () => sql("delete from web.locks where name = 'script'");
const cleanUp = () => { try { sql("delete from activity_log where record_id in (select id from diesel_issue where driver_name like 'ONCE%'); delete from diesel_issue where driver_name like 'ONCE%'; delete from web.ops where rid like 't%'; alter table public.diesel_issue drop constraint if exists once_test_chk;"); } catch (e) { console.log('clean-up: ' + String(e.message).slice(0, 200)); } };
const startServer = async (port, env) => { const c = spawn('node', ['dev.js'], { cwd: process.env.APP_DIR || path.join(__dirname, '..'), env: Object.assign({}, process.env, { PORT: String(port) }, env || {}), stdio: 'ignore', detached: true });
  for (let i = 0; i < 50; i++) { try { const x = await fetch('http://127.0.0.1:' + port + '/'); if (x.status === 200) return c; } catch (e) {} await wait(300); } throw new Error('server ' + port + ' did not start'); };
const stopServer = (c, sig) => { try { process.kill(-c.pid, sig || 'SIGTERM'); } catch (e) { try { c.kill(sig || 'SIGTERM'); } catch (e2) {} } };

(async () => {
  await fault(); unlock(); cleanUp();
  const NEW = hasOps() && !process.env.BEFORE;      // BEFORE=1: the server under test is the code before update-68 (it does not use the step-5 SQL)
  console.log('step-5 SQL (web.ops, web_write2) in the test database: ' + (NEW ? 'installed' : 'NOT installed') + ' · server on port ' + PORT);
  let r = await raw(PORT, { fn: 'login', args: ADMIN }); const admin = r.result && r.result.token; ok('admin signs in', !!admin, r.error);
  const call = (port, token, fn, args, id, quiet) => raw(port, Object.assign({ fn: 'api', args: [token, fn, args || []] }, id ? { rid: id } : {}), quiet);
  let km = 97000 + Math.floor(Math.random() * 500);
  const issue = (tag, extra) => Object.assign({ date: '2026-09-27', shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: tag, qty: 3, kmReading: ++km, force: true }, extra || {});
  const save = (tag, id, opt) => { const x = (opt && opt.entry) || issue(tag); return call((opt && opt.port) || PORT, (opt && opt.token) || admin, 'saveDieselIssue', [x], id, opt && opt.quiet).then(a => Object.assign(a, { entry: x })); };

  if (on('normal')) {
    console.log('\n=== A / C. A NORMAL SAVE, AND THE SAME SAVE SENT AGAIN ===');
    const id = rid(), n0 = lastNo();
    const a = await save('ONCE-a', id), n1 = lastNo();
    const again = await call(OTHER, admin, 'saveDieselIssue', [a.entry], id), again2 = await call(PORT, admin, 'saveDieselIssue', [a.entry], id), n2 = lastNo();
    const o = op(id);
    ok('A. a save with its number: saved once, one Diesel Issue number taken', !a.error && rows('ONCE-a') === 1 && n1 === n0 + 1, { answer: a.error || a.result.id, rows: rows('ONCE-a'), numbers_taken: n1 - n0 });
    if (NEW) ok('[fix] …and the number is IN the database with the entry: state "done", the answer kept', o && o.state === 'done' && o.result.indexOf(a.result.id) > -1, o);
    ok('C. the same save sent again (the other server, then this one): the SAME answer, still one row, no further number taken', !again.error && !again2.error && again.result.id === a.result.id && again2.result.id === a.result.id && rows('ONCE-a') === 1 && n2 === n1, { first: a.result && a.result.id, again: [again.error || again.result.id, again2.error || again2.result.id], rows: rows('ONCE-a'), numbers_taken_by_the_copies: n2 - n1 });
    // the kept answer is only for a sign-in that is still good
    const l2 = await raw(PORT, { fn: 'login', args: ADMIN }); const tk2 = l2.result.token, id2 = rid();
    const b = await save('ONCE-a2', id2, { token: tk2 }); await raw(PORT, { fn: 'logout', args: [tk2] });
    const after = await call(PORT, tk2, 'saveDieselIssue', [b.entry], id2);
    ok('a kept answer is NOT given to a sign-in that has ended (signed out): "not signed in", and nothing is saved again', !b.error && after.error === 'SESSION_EXPIRED' && rows('ONCE-a2') === 1, { after_sign_out: after.error || 'ANSWERED', rows: rows('ONCE-a2') });
  }

  if (on('lost')) {
    console.log('\n=== B. THE ENTRY IS WRITTEN, ITS ANSWER IS LOST ON THE WAY BACK TO THE SERVER ===');
    const W = NEW ? 'POST /rest/v1/rpc/web_write2' : 'POST /rest/v1/rpc/web_write$';
    // B1: the database carried the write out; the server gets "503" instead of the answer
    let id = rid(), n0 = lastNo(); const v0 = verStock(); await fault({ match: W, code: 503, n: 1, after: true });
    let a = await save('ONCE-b1', id), f1 = await fired(); await fault();
    const b1 = { log: a.result ? logLines(a.result.id) : '', ver: verStock() !== v0, closed: closed(id) };
    let again = await call(OTHER, admin, 'saveDieselIssue', [a.entry], id);
    ok('[fix] B1. the write went through but the server was told "503": the request still answers SAVED (the database has the last word); sent again: same answer, one row, one number', f1[0].fired === 1 && !a.error && !!a.result.id && !again.error && again.result.id === a.result.id && rows('ONCE-b1') === 1 && lastNo() === n0 + 1,
      { fired: f1[0].fired, first: a.error || a.result.id, again: again.error || again.result.id, rows: rows('ONCE-b1'), numbers_taken: lastNo() - n0 });
    if (NEW) ok('[fix]     …and what follows a save was still done, once: the Activity Log has its line ("Add"), the open pages are told (data version raised), the number is closed; the copy sent again adds no second line', b1.log === '1 Add' && b1.ver && b1.closed === 'true' && logLines(a.result.id) === '1 Add', { activity_log: b1.log, after_the_copy: a.result && logLines(a.result.id), version_raised: b1.ver, closed: b1.closed });
    // the same for another kind of entry with its own number series (Diesel Inward, IN-…) – the protection is not per page
    { const idI = rid(), i0 = Number(sql("select value from web.props where key = 'INWARD_LAST_NO'")), inw = { date: '2026-09-27', location: 'Dispenser', pump: 'ONCE-pump', qty: 10, rate: 1, billNo: 'ONCE-' + Date.now(), billDate: '2026-09-27' };
      await fault({ match: W, code: 503, n: 1, after: true });
      const x = await call(PORT, admin, 'saveInward', [inw], idI); await fault(); const y = await call(OTHER, admin, 'saveInward', [inw], idI);
      const nI = Number(sql("select count(*) from diesel_inward where pump_name = 'ONCE-pump'")), i1 = Number(sql("select value from web.props where key = 'INWARD_LAST_NO'"));
      ok('[fix]     …the same with a Diesel Inward (IN- numbers): answered saved, sent again: same answer, one row, one IN- number', !x.error && !y.error && x.result.id === y.result.id && nI === 1 && i1 === i0 + 1, { first: x.error || x.result.id, again: y.error || y.result.id, rows: nI, numbers_taken: i1 - i0 });
      sql("delete from activity_log where record_id in (select id from diesel_inward where pump_name = 'ONCE-pump'); delete from diesel_inward where pump_name = 'ONCE-pump'; update web.props set value = '" + i0 + "' where key = 'INWARD_LAST_NO'"); }
    // B5: the write went through, its answer was lost AND the database cannot be asked right after (two faults at once)
    if (NEW) { id = rid(); n0 = lastNo();
      await fault({ match: W, code: 503, n: 1, after: true }); await fault({ match: 'POST /rest/v1/rpc/web_op_end', code: 503, n: 4 });
      a = await save('ONCE-b5', id); f1 = await fired(); await fault();
      const r5 = rows('ONCE-b5'); again = await call(OTHER, admin, 'saveDieselIssue', [a.entry], id);
      ok('[fix] B5. the write went through, the server was told "503" AND could not ask the database afterwards (4 tries): the page is told "again later" (it sends the SAME number again by itself – no error the person would answer by typing the entry a second time); that copy gets the saved entry: one row, one number', f1[0].fired === 1 && f1[1].fired === 4 && /RETRY_LATER/.test(a.error || '') && r5 === 1 && !again.error && !!again.result.id && rows('ONCE-b5') === 1 && lastNo() === n0 + 1 && logLines(again.result.id) === '1 Add',
        { faults_fired: f1.map(x => x.fired), first: a.error || 'SAVED', row_is_in: r5, again: again.error || again.result.id, rows: rows('ONCE-b5'), numbers_taken: lastNo() - n0, activity_log: again.result && logLines(again.result.id) }); }
    // B2: the connection is cut after the write (no answer at all)
    id = rid(); n0 = lastNo(); await fault({ match: W, n: 1, after: true, drop: true });
    a = await save('ONCE-b2', id); f1 = await fired(); await fault();
    again = await call(OTHER, admin, 'saveDieselIssue', [a.entry], id);
    ok('[fix] B2. the connection to the database is cut right after the write: SAVED is answered; sent again: same answer, one row, one number', f1[0].fired === 1 && !a.error && !again.error && again.result.id === a.result.id && rows('ONCE-b2') === 1 && lastNo() === n0 + 1,
      { first: a.error || a.result.id, again: again.error || again.result.id, rows: rows('ONCE-b2'), numbers_taken: lastNo() - n0 });
    // B3: the answer comes too late (the server waits 2.5 s for a write on this test server; the database answers after 6 s)
    const srv = await startServer(3008, { RCL_FETCH_WRITE_MS: '2500' });
    try {
      const tk = (await raw(3008, { fn: 'login', args: ADMIN })).result.token;
      id = rid(); n0 = lastNo(); await fault({ match: W, code: 200, n: 1, after: true, delay: 6000, text: '{"written":1,"deleted":0}' });
      a = await save('ONCE-b3', id, { port: 3008, token: tk }); await fault();
      again = await call(PORT, tk, 'saveDieselIssue', [a.entry], id);
      ok('[fix] B3. the database\'s answer comes too late (after the server stopped waiting): no second save – sent again it gets the answer of the first; one row, one number', !again.error && !!again.result && rows('ONCE-b3') === 1 && lastNo() === n0 + 1 && (a.error ? /did not answer in time|SAVED/.test(a.error) : a.result.id === again.result.id),
        { first: a.error ? String(a.error).slice(0, 70) : a.result.id, again: again.error || again.result.id || JSON.stringify(again.result), rows: rows('ONCE-b3'), numbers_taken: lastNo() - n0 });
    } finally { stopServer(srv); await fault(); unlock(); }
  }

  if (on('dies')) {
    console.log('\n=== B4. THE SERVER ITSELF DIES RIGHT AFTER THE WRITE (before it could answer or note anything) ===');
    const W = NEW ? 'POST /rest/v1/rpc/web_write2' : 'POST /rest/v1/rpc/web_write$';
    const srv = await startServer(3009);
    const tk = (await raw(3009, { fn: 'login', args: ADMIN })).result.token;
    const id = rid(), n0 = lastNo(), entry = issue('ONCE-die');
    await fault({ match: W, code: 200, n: 1, after: true, delay: 5000, text: '{"written":1,"deleted":0}' });      // the write is carried out; its answer is held back …
    const first = call(3009, tk, 'saveDieselIssue', [entry], id, true);
    await wait(2500); stopServer(srv, 'SIGKILL'); const a = await first; await fault();                              // … and the server is killed meanwhile
    const mid = rows('ONCE-die');
    unlock();                                                                                                       // (the dead server's lock would end by itself after 75 s)
    const t0 = Date.now(); let again = await call(PORT, tk, 'saveDieselIssue', [entry], id);
    for (let i = 0; i < 6 && again.error && /RETRY_LATER|still running/.test(again.error); i++) { await wait(15000); unlock(); again = await call(PORT, tk, 'saveDieselIssue', [entry], id); }      // (the page sends it again until it is answered)
    ok('[fix] B4. the server is killed after the write, before any answer: the entry is in the database once; the page\'s copy sent to another server gets "saved" and writes NOTHING more – one row, one number', a.status === 0 && mid === 1 && !again.error && rows('ONCE-die') === 1 && lastNo() === n0 + 1,
      { first: a.error, rows_after_the_crash: mid, again: again.error || again.result.id || JSON.stringify(again.result), rows: rows('ONCE-die'), numbers_taken: lastNo() - n0, answered_after_ms: Date.now() - t0 });
    if (NEW && again.result && again.result.id) { const third = await call(OTHER, tk, 'saveDieselIssue', [entry], id);
      ok('[fix]     …the server that died never wrote the Activity Log line: the copy that found the entry wrote it – once (a third copy adds none), and the number is closed', logLines(again.result.id) === '1 Add' && closed(id) === 'true' && !third.error, { activity_log: logLines(again.result.id), closed: closed(id), third: third.error || third.result.id }); }
  }

  if (on('together')) {
    console.log('\n=== D. THE SAME SAVE REACHES TWO SERVERS AT THE SAME MOMENT ===');
    const id = rid(), n0 = lastNo(), entry = issue('ONCE-d');
    const two = await Promise.all([call(PORT, admin, 'saveDieselIssue', [entry], id), call(OTHER, admin, 'saveDieselIssue', [entry], id)]);
    ok('D. two copies, two servers, one moment: both are answered with the same entry; one row, one number', two.every(x => !x.error) && two[0].result.id === two[1].result.id && rows('ONCE-d') === 1 && lastNo() === n0 + 1, { answers: two.map(x => x.error || x.result.id), rows: rows('ONCE-d'), numbers_taken: lastNo() - n0 });
    const id6 = rid(), n1 = lastNo(), e6 = issue('ONCE-d6');
    const six = await Promise.all(Array.from({ length: 6 }, (_, i) => call(i % 2 ? PORT : OTHER, admin, 'saveDieselIssue', [e6], id6)));
    ok('   six copies at once on two servers: one row, one number, six times the same answer', six.every(x => !x.error && x.result.id === six[0].result.id) && rows('ONCE-d6') === 1 && lastNo() === n1 + 1, { answers: [...new Set(six.map(x => x.error || x.result.id))], rows: rows('ONCE-d6'), numbers_taken: lastNo() - n1 });
  }

  if (on('payload')) {
    console.log('\n=== E. THE SAME NUMBER WITH A DIFFERENT ENTRY ===');
    const id = rid();
    const a = await save('ONCE-e', id), n1 = lastNo();
    const other = await call(PORT, admin, 'saveDieselIssue', [issue('ONCE-e-other', { qty: 99 })], id);
    const l2 = await raw(PORT, { fn: 'login', args: ADMIN }); const sameByOther = await call(PORT, l2.result.token, 'saveDieselIssue', [a.entry], id);
    ok((NEW ? '[fix] ' : '') + 'E. a different entry under a number that is already used: REFUSED (not saved, and not answered with the first one\'s answer)', !a.error && !!other.error && /different entry/.test(other.error) && rows('ONCE-e-other') === 0 && rows('ONCE-e') === 1 && lastNo() === n1, { first: a.error || a.result.id, different_entry: other.error || 'ANSWERED: ' + JSON.stringify(other.result).slice(0, 60), rows_of_the_different_one: rows('ONCE-e-other') });
    ok((NEW ? '[fix] ' : '') + '   the same entry and number from ANOTHER sign-in: refused as well (a kept answer belongs to the sign-in that saved)', !!sameByOther.error && /different entry/.test(sameByOther.error) && rows('ONCE-e') === 1, sameByOther.error || 'ANSWERED');
  }

  if (on('fails')) {
    console.log('\n=== F. THE WRITE REALLY FAILS ===');
    const W = NEW ? 'POST /rest/v1/rpc/web_write2' : 'POST /rest/v1/rpc/web_write$';
    // F1: the database is never reached
    let id = rid(); await fault({ match: W, code: 500, n: 1 });
    let a = await save('ONCE-f1', id); await fault();
    const o1 = op(id), again = await call(PORT, admin, 'saveDieselIssue', [a.entry], id), fresh = await save('ONCE-f1', rid(), { entry: Object.assign({}, a.entry) });
    ok('F1. the write does not reach the database: an error, NO row' + (NEW ? ', the number is kept as "refused"' : '') + '; the same number again gives the same error (not run again); the person pressing Save again (a new number) saves it – once', !!a.error && (!NEW || (o1 && o1.state === 'refused')) && !!again.error && !fresh.error && rows('ONCE-f1') === 1, { first: String(a.error).slice(0, 60), number: o1 && o1.state, again: String(again.error || 'SAVED').slice(0, 60), pressed_again: fresh.error || fresh.result.id, rows: rows('ONCE-f1') });
    // F2: the database refuses the row INSIDE the transaction – the number's "done" must be undone with it
    sql("alter table public.diesel_issue add constraint once_test_chk check (driver_name is distinct from 'ONCE-f2') not valid;"); await wait(300);
    id = rid(); a = await save('ONCE-f2', id);
    const o2 = op(id);
    sql("alter table public.diesel_issue drop constraint if exists once_test_chk;");
    ok((NEW ? '[fix] ' : '') + 'F2. the database refuses the row inside the transaction: nothing is written – no row' + (NEW ? ' and the number is NOT "done" (its mark was undone together with the row)' : ''), !!a.error && rows('ONCE-f2') === 0 && (!NEW || (o2 && o2.state !== 'done')), { answer: String(a.error || 'SAVED').slice(0, 110), number: o2 && o2.state, rows: rows('ONCE-f2') });
    ok('G. no lock is left behind by any of the failures', sql("select count(*) from web.locks where name = 'script' and expires_at > now()") === '0');
  }

  if (on('takeover') && NEW) {
    console.log('\n=== A COPY THAT STARTED AND NEVER FINISHED ===');
    const hashOf = (token, fn, args) => crypto.createHash('sha256').update(JSON.stringify([token, fn, args])).digest('hex');
    // (1) it died long ago without writing: the copy sent again takes the number over and saves – once
    let id = rid(), e = issue('ONCE-t1');
    sql("insert into web.ops (rid, hash, holder, started_at) values ('" + id + "', '" + hashOf(admin, 'saveDieselIssue', [e]) + "', 'dead-request-1', now() - interval '80 seconds')");
    let a = await call(PORT, admin, 'saveDieselIssue', [e], id);
    ok('[fix] a first copy that died 80 s ago without writing: the copy sent again takes the number over and saves it – once', !a.error && rows('ONCE-t1') === 1 && op(id).state === 'done' && op(id).holder !== 'dead-request-1', { answer: a.error || a.result.id, rows: rows('ONCE-t1'), number: op(id).state });
    // (2) a first copy that is still running (started 2 s ago): the second copy WAITS for it and does not run
    id = rid(); e = issue('ONCE-t2');
    sql("insert into web.ops (rid, hash, holder, started_at) values ('" + id + "', '" + hashOf(admin, 'saveDieselIssue', [e]) + "', 'running-request-2', now())");
    const t0 = Date.now(), p = call(PORT, admin, 'saveDieselIssue', [e], id);
    await wait(3000); const during = rows('ONCE-t2');
    sql("update web.ops set state = 'done', result = '{\"ok\":true,\"id\":\"DI-FROM-THE-FIRST\"}', done_at = now(), closed_at = now() where rid = '" + id + "'");
    a = await p;
    ok('[fix] a first copy that is still running: the second copy waits (writes nothing) and then gets the FIRST one\'s answer', during === 0 && !a.error && a.result.id === 'DI-FROM-THE-FIRST' && rows('ONCE-t2') === 0 && Date.now() - t0 >= 3000, { rows_while_waiting: during, answer: a.error || a.result.id, waited_ms: Date.now() - t0 });
  }
  if (on('direct') && NEW) {
    console.log('\n=== THE DATABASE FUNCTIONS BY THEMSELVES ===');
    const q = s => { try { return execSync('su postgres -c "psql -d rcl -tA -v ON_ERROR_STOP=1"', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { return 'ERROR ' + String(e.stderr || e.message).replace(/\s+/g, ' ').slice(0, 220); } };
    const id = rid();
    q("select public.web_op_begin('" + id + "', 'h1', 'holder-A')");
    q("update web.ops set started_at = now() - interval '90 seconds' where rid = '" + id + "'");
    const take = q("select public.web_op_begin('" + id + "', 'h1', 'holder-B')");
    const stale = q("select public.web_write2('[{\"table\":\"diesel_issue\",\"upserts\":[{\"id\":\"DI-LATE-1\",\"driver_name\":\"ONCE-late\"}],\"deletes\":[]}]'::jsonb, '" + id + "', 'holder-A', null)");
    ok('[fix] a writer whose number was taken over (it comes back late): the database REFUSES its write – nothing is written', /"mine": ?true/.test(take) && /OP_NOT_MINE/.test(stale) && rows('ONCE-late') === 0, { take_over: take.slice(0, 80), late_writer: stale.slice(0, 120) });
    const good = q("select public.web_write2('[{\"table\":\"diesel_issue\",\"upserts\":[{\"id\":\"DI-ONCE-OK\",\"driver_name\":\"ONCE-direct\"}],\"deletes\":[]}]'::jsonb, '" + id + "', 'holder-B', '{\"ok\":true}')");
    const twice = q("select public.web_write2('[{\"table\":\"diesel_issue\",\"upserts\":[{\"id\":\"DI-ONCE-OK2\",\"driver_name\":\"ONCE-direct\"}],\"deletes\":[]}]'::jsonb, '" + id + "', 'holder-B', '{\"ok\":true}')");
    ok('[fix] the holder writes once; a second write under the same number is refused by the database', /written/.test(good) && /OP_NOT_MINE/.test(twice) && rows('ONCE-direct') === 1, { first: good.slice(0, 60), second: twice.slice(0, 90), rows: rows('ONCE-direct') });
    const free = q("select public.web_op_end('" + id + "', 'holder-B', 'free', null)");
    ok('[fix] "give the number back" does nothing once the entry is written (the number stays "done")', /"state": ?"done"/.test(free) && /"n": ?0/.test(free), free.slice(0, 100));
    const anon = q("set role anon; select public.web_op_begin('x12345678', 'h', 'z');");
    ok('only the server\'s key may call these (the public role is refused)', /permission denied/.test(anon), anon.slice(0, 100));
    sql("delete from diesel_issue where id in ('DI-ONCE-OK', 'DI-ONCE-OK2', 'DI-LATE-1'); delete from web.ops where rid = '" + id + "'");
  }

  if (on('sql') && NEW) {
    console.log('\n=== THE STEP-5 SQL ITSELF: WHO CAN TOUCH IT, AND IT CANNOT GROW FOR EVER ===');
    const q = s => { try { return execSync('su postgres -c "psql -d rcl -tA -v ON_ERROR_STOP=1"', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { return 'ERROR ' + String(e.stderr || e.message).replace(/\s+/g, ' ').slice(0, 200); } };
    const FN = ['web_op_begin', 'web_op_mark', 'web_op_end', 'web_ops_cleanup', 'web_write2'];
    // 1. how the functions run
    const conf = q("select string_agg(p.proname || ':' || p.prosecdef || ':' || coalesce(array_to_string(p.proconfig, ';'), 'none'), ' ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('" + FN.join("','") + "')");
    ok('the four functions that work on web.ops run with the owner\'s rights and a FIXED, EMPTY search_path; web_write2 runs with the caller\'s rights (also a fixed, empty search_path)',
      conf === 'web_op_begin:true:search_path="" web_op_end:true:search_path="" web_op_mark:true:search_path="" web_ops_cleanup:true:search_path="" web_write2:false:search_path=""', conf);
    // 2. who may call them
    const grants = q("select string_agg(p.proname || ' ' || has_function_privilege('anon', p.oid, 'execute') || '/' || has_function_privilege('authenticated', p.oid, 'execute') || '/' || has_function_privilege('service_role', p.oid, 'execute') || '/' || coalesce((select bool_or(a.grantee = 0) from aclexplode(p.proacl) a), true), ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('" + FN.join("','") + "')");
    const callAnon = q("set role anon; select public.web_ops_cleanup();"), callAuth = q("set role authenticated; select public.web_op_end('x12345678', 'h', 'free', null);"), callAnon2 = q("set role anon; select public.web_write2('[]'::jsonb, 'x12345678', 'h', null);");
    ok('EXECUTE: anon no, authenticated no, PUBLIC no – only the server\'s key (service_role); tried as anon and as authenticated: "permission denied"', FN.every(f => grants.indexOf(f + ' false/false/true/false') > -1) && [callAnon, callAuth, callAnon2].every(x => /permission denied/.test(x)), { 'anon/authenticated/service_role/PUBLIC': grants, anon: callAnon.slice(0, 70) });
    const note = q("select p.prosecdef || ':' || coalesce(array_to_string(p.proconfig, ';'), 'none') || ' anon ' || has_function_privilege('anon', p.oid, 'execute') || ' authenticated ' || has_function_privilege('authenticated', p.oid, 'execute') || ' service_role ' || has_function_privilege('service_role', p.oid, 'execute') from pg_proc p where p.proname = 'web_op_note'");
    const noteCall = q("set role service_role; select public.web_op_note('x12345678', 'x');");
    ok('the helper that leaves the old-style note (web_op_note) is for use INSIDE the functions only: not even the server\'s key may call it', note === 'true:search_path="" anon false authenticated false service_role false' && /permission denied/.test(noteCall), { function: note, called_with_the_server_key: noteCall.slice(0, 70) });
    // 3. the table itself
    const tbl = q("select 'rls ' || c.relrowsecurity || ', policies ' || (select count(*) from pg_policy p where p.polrelid = c.oid) || ', owner ' || pg_get_userbyid(c.relowner) from pg_class c where c.oid = 'web.ops'::regclass");
    const priv = ['anon', 'authenticated', 'service_role'].map(r => r + ' ' + ['select', 'insert', 'update', 'delete'].map(pv => q("select has_table_privilege('" + r + "', 'web.ops', '" + pv + "')")).join('') + ' schema ' + q("select has_schema_privilege('" + r + "', 'web', 'usage')")).join(', ');
    const direct = ['anon', 'authenticated', 'service_role'].map(r => q("set role " + r + "; select count(*) from web.ops;")), write = q("set role service_role; update web.ops set state = 'done';"), del = q("set role service_role; delete from web.ops;");
    const KEYH = { apikey: 'sb_secret_rigkey' };
    const rest = async (path, h) => { const r = await fetch(GW + '/rest/v1/' + path, { headers: Object.assign({}, KEYH, h || {}) }); return r.status + ' ' + (await r.text()).slice(0, 90); };
    const r1 = await rest('ops?select=rid&limit=1'), r2 = await rest('ops?select=rid&limit=1', { 'Accept-Profile': 'web' });
    ok('web.ops cannot be read or changed directly – not by anon, not by authenticated, and not even with the server\'s secret key (SQL as each role: refused; through the API with the secret key: the table is not offered); row-level security on, no policy',
      /^rls true, policies 0, owner postgres$/.test(tbl) && priv === 'anon ffff schema f, authenticated ffff schema f, service_role ffff schema f' && direct.every(x => /permission denied/.test(x)) && /permission denied/.test(write) && /permission denied/.test(del) && /^4\d\d/.test(r1) && /^4\d\d/.test(r2),
      { table: tbl, rights: priv, read_as_service_role: direct[2].slice(0, 60), api_with_secret_key: [r1.slice(0, 60), r2.slice(0, 70)] });
    // 4. a look-alike table in another schema is never picked up (every name in the functions carries its schema)
    q("create table if not exists public.ops (rid text primary key, hash text, holder text, state text default 'started', result text, started_at timestamptz default now(), done_at timestamptz, closed_at timestamptz); create table if not exists public.cache (key text primary key, value text, expires_at timestamptz);");
    const idD = rid(), sv = await save('ONCE-sql', idD), decoy = q("select (select count(*) from public.ops) || '/' || (select count(*) from public.cache)"), real = op(idD);
    q("drop table if exists public.ops; drop table if exists public.cache;");
    ok('a look-alike table "ops" / "cache" placed in the public schema is ignored: the save goes through web.ops', !sv.error && decoy === '0/0' && real && real.state === 'done', { save: sv.error || sv.result.id, rows_in_the_look_alikes: decoy, in_web_ops: real && real.state });
    // 5. the number: its shape, and reuse
    const badShape = q("select public.web_op_begin('bad rid!', 'h', 'x')"), tooShort = q("select public.web_op_begin('abc', 'h', 'x')"), badState = q("update web.ops set state = 'whatever' where rid = '" + idD + "'");
    const noNumber = await raw(PORT, { fn: 'api', args: [admin, 'whoami', []], rid: 'bad rid!' });
    const other = q("select public.web_op_begin('" + idD + "', 'another-fingerprint', 'holder-Z')");
    ok('a number of the wrong shape cannot get into the table (the database refuses it; the server treats such a request as one without a number); a state that does not exist is refused', /ops_rid_shape/.test(badShape) && /ops_rid_shape/.test(tooShort) && /ops_state_known/.test(badState) && !noNumber.error, { bad_shape: badShape.slice(0, 80), bad_state: badState.slice(0, 70), server: noNumber.error || 'handled' });
    ok('a used number asked for with ANOTHER fingerprint (other data, or another sign-in): the database says "not the same" and does NOT give the kept answer', /"same": ?false/.test(other) && /"mine": ?false/.test(other) && /"result": ?null/.test(other), other.slice(0, 120));
    // 6. retention
    const big = 'x'.repeat(5000), mk = (id, age, state, res) => "insert into web.ops (rid, hash, holder, state, result, started_at, done_at, closed_at) values ('" + id + "', 'h', 'old', '" + state + "', " + (res === null ? 'null' : "'" + res + "'") + ", now() - interval '" + age + "', now() - interval '" + age + "', now());";
    q(mk('tret-4days-done', '4 days', 'done', 'short') + mk('tret-4days-started', '4 days', 'started', null) + mk('tret-4days-refused', '4 days', 'refused', 'no') + mk('tret-25h-long', '25 hours', 'done', big) + mk('tret-25h-short', '25 hours', 'done', '{"ok":true,"id":"DI-1"}') + mk('tret-1h-long', '1 hour', 'done', big) + mk('tret-2days-started', '2 days', 'started', null));
    const cl = q("select public.web_ops_cleanup()"), left = q("select coalesce(string_agg(rid || '=' || coalesce(length(result)::text, 'null'), ' ' order by rid), '') from web.ops where rid like 'tret-%'");
    ok('RETENTION: a number is forgotten 3 days after it started (done, refused or never finished); a long answer is dropped after 24 hours but its number stays; short answers and everything younger are untouched',
      left === 'tret-1h-long=5000 tret-25h-long=null tret-25h-short=23 tret-2days-started=null' && /"deleted": ?3/.test(cl) && /"trimmed": ?1/.test(cl), { cleanup: cl, kept: left });
    // a copy that comes after its long answer was dropped: still not saved again
    const idL = rid(), sl = await save('ONCE-late', idL); sql("update web.ops set result = null where rid = '" + idL + "'");
    const late = await call(OTHER, admin, 'saveDieselIssue', [sl.entry], idL);
    ok('…a copy that arrives after the answer was dropped is still NOT saved again: it is answered "saved" (without the details)', !sl.error && !late.error && late.result && late.result.ok === true && late.result._resent === true && rows('ONCE-late') === 1, { answer: late.error || late.result, rows: rows('ONCE-late') });
    // the hard limit, and how big three busy days are
    q("insert into web.ops (rid, hash, holder, state, result, started_at, done_at, closed_at) select 'tcap' || lpad(g::text, 8, '0'), 'h', 'x', 'done', repeat('y', 300), now() - interval '3 hours' - (g || ' seconds')::interval, now(), now() from generate_series(1, 6000) g;");
    const size6k = q("select count(*) || ' numbers = ' || pg_size_pretty(pg_total_relation_size('web.ops')) from web.ops"), young = q(mk('tcapyoung-1', '10 minutes', 'done', 'r'));
    const cap = q("select public.web_ops_cleanup(3, 24, 1000)"), after = q("select (select count(*) from web.ops where rid like 'tcap0%') || ' old, ' || (select count(*) from web.ops where rid = 'tcapyoung-1') || ' young, oldest kept ' || (select min(rid) from web.ops where rid like 'tcap0%')");
    ok('HARD LIMIT: with more numbers than the limit the OLDEST are forgotten first, never one younger than 2 hours (here: limit 1,000 over 6,000 numbers of three hours ago)', /"capped": ?[1-9]/.test(cap) && Number((cap.match(/"rows": ?(\d+)/) || [])[1]) <= 1000 && / 1 young/.test(after) && /oldest kept tcap0000000[1-9]|oldest kept tcap000000[0-9]{2}|oldest kept tcap00000[0-9]{3}/.test(after), { six_thousand_numbers: size6k, cleanup: cap, left: after });
    q("delete from web.ops where rid like 'tcap%' or rid like 'tret-%'; vacuum web.ops;");
    // housekeeping can never stand in the way of a save: web_op_begin with a clean-up that FAILS still answers (all inside one transaction that is undone)
    { const q2 = s => { try { return execSync('su postgres -c "psql -d rcl -tA 2>&1"', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { return 'ERROR ' + String(e.stdout || e.message).replace(/\s+/g, ' ').slice(0, 300); } };
      let seed = ''; for (let i = 1; i < 600 && !seed; i++) { const v = q2('select setseed(' + (i / 1000) + '); select random();').split('\n').pop(); if (Number(v) < 0.02) seed = String(i / 1000); }
      const fake = body => "create or replace function public.web_ops_cleanup(p_keep_days int default 3, p_answer_hours int default 24, p_max_rows int default 200000) returns jsonb language plpgsql security definer set search_path = '' as $f$ begin " + body + " return '{}'::jsonb; end $f$;";
      const seen = q2('begin; ' + fake("raise notice 'CLEANUP_WAS_CALLED';") + ' select setseed(' + seed + "); select public.web_op_begin('tguard-called-1', 'h', 'holder-1'); rollback;");
      const broke = q2('begin; ' + fake("raise exception 'clean-up is broken';") + ' select setseed(' + seed + "); select public.web_op_begin('tguard-broken-1', 'h', 'holder-1'); rollback;");
      const real = q("select prosrc ~ 'delete from web.ops' from pg_proc where proname = 'web_ops_cleanup'"), left = q("select count(*) from web.ops where rid like 'tguard-%'");
      ok('HOUSEKEEPING CANNOT FAIL A SAVE: with a clean-up that raises an error, web_op_begin (at a moment it does call the clean-up) still takes the number; nothing of the experiment is left', !!seed && /CLEANUP_WAS_CALLED/.test(seen) && /"mine": ?true/.test(broke) && !/clean-up is broken|ERROR/.test(broke) && real === 't' && left === '0', { seed, called: /CLEANUP_WAS_CALLED/.test(seen), with_a_broken_cleanup: (broke.match(/\{.*\}/) || [broke.slice(-160)])[0].slice(0, 120), real_cleanup_back: real, left }); }
    // the nightly job runs it (a server with the job's secret, no Google Sheet set up: the backup is "off", the clean-up still runs)
    const srv = await startServer(3008, { CRON_SECRET: 'local-cron-secret' });
    try {
      q(mk('tnight-5days', '5 days', 'done', 'x'));
      const cr = await fetch('http://127.0.0.1:3008/api/backup?full=1', { headers: { Authorization: 'Bearer local-cron-secret' } }), no = await fetch('http://127.0.0.1:3008/api/backup?full=1');
      ok('the nightly job of the server runs the clean-up (with the job\'s secret; without it the call is refused as before)', cr.status === 200 && no.status === 401 && q("select count(*) from web.ops where rid = 'tnight-5days'") === '0', { job: cr.status, without_secret: no.status, old_number_left: q("select count(*) from web.ops where rid = 'tnight-5days'") });
    } finally { stopServer(srv); q("delete from web.ops where rid like 'tnight-%'"); }
  }

  if (on('numbers')) {
    console.log('\n=== G / H. THE OTHER PROTECTIONS AND THE NUMBERING ===');
    const e = issue('ONCE-g');
    const a = await call(PORT, admin, 'saveDieselIssue', [e], rid()), b = await call(PORT, admin, 'saveDieselIssue', [e], rid());
    ok('G. the same NEW entry under two different numbers within seconds (a double click): still saved once', !a.error && /sent twice/.test(b.error || '') && rows('ONCE-g') === 1, { first: a.error || a.result.id, second: b.error || 'SAVED AGAIN' });
    const all = sql("select coalesce(string_agg(id, ',' order by id), '') from diesel_issue where driver_name like 'ONCE%' and id like 'DI-0%'").split(',').filter(Boolean);
    const nums = all.map(x => Number(x.replace(/\D/g, '')));
    ok('H. every entry of this test has its own Diesel Issue number (no number twice); the counter stands at or above the highest', new Set(all).size === all.length && all.length >= 1 && lastNo() >= Math.max(...nums), { entries: all.length, highest: Math.max(...nums), counter: lastNo() });
    const st = sql("select coalesce(string_agg(state || ' ' || n, ', ' order by state), 'none') from (select state, count(*) n from web.ops where rid like 't%' group by state) x");
    if (NEW) ok('   the numbers of this test in the database: only "done" and "refused" – none left "started"', !/started/.test(st), st);
  }

  if (on('compat') && PORT === 3000) {
    console.log('\n=== COMPATIBILITY: WITHOUT THE STEP-5 SQL THE APP WORKS AS BEFORE; THE STEP CAN BE TAKEN OUT AND PUT BACK ===');
    const restart = () => execSync('timeout 80 /tmp/up3.sh >/dev/null 2>&1; for i in $(seq 1 40); do a=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/); b=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/); if [ "$a" = "200" ] && [ "$b" = "200" ]; then break; fi; sleep 0.5; done', { shell: '/bin/bash' });
    const file = path.join(__dirname, '..', 'sql', 'supabase_step5_save_once.sql');
    // the roll-back exactly as written in the file's heading
    sql("drop function if exists public.web_write2(jsonb, text, text, text); drop function if exists public.web_op_mark(text, text, text); drop function if exists public.web_op_begin(text, text, text, int); drop function if exists public.web_op_end(text, text, text, text); drop function if exists public.web_ops_cleanup(int, int, int); drop function if exists public.web_op_note(text, text); drop table if exists web.ops; notify pgrst, 'reload schema';");
    await wait(800); restart();
    try {
      const tk = (await raw(3000, { fn: 'login', args: ADMIN })).result.token;
      const id = rid(), a = await save('ONCE-c1', id, { token: tk }), again = await call(3001, tk, 'saveDieselIssue', [a.entry], id);
      const h = await call(3000, tk, 'dbHealth', []), line = ((h.result && h.result.checks) || []).find(x => /step 5/.test(x.name)) || {};
      ok('without the step-5 SQL: a save and its copy work the old way (saved once, same answer); the Admin\'s Database check shows step 5 as "to do" with the file\'s name', !a.error && !again.error && again.result.id === a.result.id && rows('ONCE-c1') === 1 && line.ok === false && /supabase_step5_save_once\.sql/.test(line.fix || ''), { save: a.error || a.result.id, again: again.error || again.result.id, health: line });
    } finally {
    }
    // THE CHANGE-OVER while people work: a save goes the old way, THEN the step is run (the servers are NOT restarted)
    const tk = (await raw(3000, { fn: 'login', args: ADMIN })).result.token;
    const idOld = rid(), o1 = await save('ONCE-c3', idOld, { token: tk });
    execSync('su postgres -c "psql -d rcl -q -v ON_ERROR_STOP=1 -f ' + file + '"', { stdio: 'pipe' }); execSync('su postgres -c "psql -d rcl -q -v ON_ERROR_STOP=1 -f ' + file + '"', { stdio: 'pipe' });      // put back (run twice: safe to run again)
    await wait(1500);
    const o2 = await call(3001, tk, 'saveDieselIssue', [o1.entry], idOld), o3 = await call(3000, tk, 'saveDieselIssue', [o1.entry], idOld);
    ok('the step is run while the servers are up: a save that went the old way just before, sent again afterwards, is still answered from its old note – one row (no restart, no window)', !o1.error && !o2.error && !o3.error && o2.result.id === o1.result.id && o3.result.id === o1.result.id && rows('ONCE-c3') === 1 && op(idOld) === null, { first: o1.error || o1.result.id, again: [o2.error || o2.result.id, o3.error || o3.result.id], rows: rows('ONCE-c3') });
    const id = rid(), a = await save('ONCE-c2', id, { token: tk }), o = op(id), h = await call(3000, tk, 'dbHealth', []), line = ((h.result && h.result.checks) || []).find(x => /step 5/.test(x.name)) || {};
    ok('the step put back (its file run twice), servers NOT restarted: the very next save carries its number into the database; the Database check shows it as done', !a.error && o && o.state === 'done' && line.ok === true, { save: a.error || a.result.id, number: o && o.state, health_ok: line.ok });
  }

  await fault(); unlock(); cleanUp();
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (PORT !== 3000 ? '   (port ' + PORT + ')' : ''));
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); try { execSync('curl -s -m 3 -X POST http://127.0.0.1:3100/__fault -d "{}"'); } catch (x) {} process.exit(1); });
