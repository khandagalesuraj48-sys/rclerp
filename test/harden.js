/* The fixes of the audit of 07-10-2026, checked on the local test rig (PostgreSQL + PostgREST + the gateway stand-in with
 * its FAULT switch + the app's server). Nothing here touches the live database.
 *   node test/harden.js [section …]        sections: status counters aftersave failclosed column auth queue ai
 *   PORT=3002 node test/harden.js …        the same checks against another copy of the server (e.g. the code that is live:
 *                                          there the lines marked [fix] are expected to FAIL – that is the "before")
 * The fault switch (test/gateway-standin.js): POST http://127.0.0.1:3100/__fault { match, code, n, skip, after, text }. */
const { execSync, spawn } = require('child_process'); const path = require('path');
const PORT = Number(process.env.PORT) || 3000, GW = 'http://127.0.0.1:3100';
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const raw = async (port, body) => { const t = Date.now(); let r; for (let i = 0; ; i++) { try { r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) }); break; } catch (e) { if (i >= 5) throw e; await wait(500); } }
  let j; const txt = await r.text(); try { j = JSON.parse(txt); } catch (e) { j = { error: 'no JSON (' + r.status + '): ' + txt.slice(0, 80) }; } return { status: r.status, retryAfter: r.headers.get('retry-after'), error: j.error, result: j.result, ms: Date.now() - t }; };
const fault = async f => { await fetch(GW + '/__fault', { method: 'POST', body: JSON.stringify(f || {}) }); };
const fired = async () => (await (await fetch(GW + '/__fault')).json());
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 330) : '')); };
const want = process.argv.slice(2), on = s => !want.length || want.indexOf(s) > -1;
const ADMIN = ['sujit@rcl.test', 'Nashik#Road848!'];
const rid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
const unlock = () => sql("delete from web.locks where name = 'script'");
const issues = tag => Number(sql("select count(*) from diesel_issue where driver_name = '" + tag + "'"));
const cleanUp = () => { try { sql("delete from diesel_issue where driver_name like 'HARDEN%'; delete from log_book where machinery = 'MH-15-AB-0003' and date >= '2026-09-20' and coalesce(work_done, '') like 'HARDEN%'; delete from app_users where id like 'harden%@rcl.test'; delete from web.cache where key like 'F\\_harden%' or key like 'USERS_LIST';"); } catch (e) { console.log('clean-up: ' + String(e.message).slice(0, 200)); } };

(async () => {
  await fault(); unlock(); cleanUp();
  let r = await raw(PORT, { fn: 'login', args: ADMIN }); const admin = r.result && r.result.token; ok('admin signs in', !!admin, r.error);
  const api = (fn, args, opt) => raw((opt && opt.port) || PORT, Object.assign({ fn: 'api', args: [(opt && opt.token) || admin, fn, args || []] }, opt && opt.rid ? { rid: opt.rid } : {}));
  let kmNo = 99900 + Math.floor(Math.random() * 50);
  const issue = (tag, extra) => Object.assign({ date: '2026-09-28', shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: tag, qty: 5, kmReading: ++kmNo, force: true }, extra || {});

  if (on('status')) {
    console.log('\n=== THE ANSWER\'S HTTP STATUS (the body is what the page reads – unchanged) ===');
    const a = await raw(PORT, { fn: 'api', args: ['no-such-token', 'getInit', []] }), b = await raw(PORT, { fn: 'login', args: ['nobody@rcl.test', 'wrong-password-1'] });
    const c = await api('noSuchAction'), d = await raw(PORT, { fn: 'deleteEverything', args: [] }), e = await api('constructor'), f2 = await api('__proto__');
    const g = await api('saveDieselIssue', [issue('HARDEN-st', { qty: -5 })]), h = await api('getStock');
    ok('[fix] not signed in → 401, wrong password → 401 (body: the same message as before)', a.status === 401 && a.error === 'SESSION_EXPIRED' && b.status === 401 && /Wrong email or password/.test(b.error), { api: a.status, login: b.status });
    ok('[fix] not an action of the app → 404; "constructor" / "__proto__" are not actions (no fault is noted for them)', c.status === 404 && d.status === 404 && /Unknown action/.test(e.error || '') && /Unknown action/.test(f2.error || '') && e.status === 404, { unknown: c.status, notAllowed: d.status, constructor: e.error, proto: f2.error });
    ok('a REFUSED entry is an answer for the person: 200 with { error }; a good call: 200 with { result }', g.status === 200 && !!g.error && h.status === 200 && !!h.result, { refused: g.status + ' ' + String(g.error).slice(0, 60), good: h.status });
  }

  if (on('counters')) {
    console.log('\n=== THE EXACT COUNTERS SURVIVE A NETWORK HICCUP ===');
    // sequential calls are all served by the same helper thread of the server, so "that thread switched its counter off" shows
    let a = await api('saveDieselIssue', [issue('HARDEN-c1', { kmReading: 99801 })]), b = await api('saveDieselIssue', [issue('HARDEN-c1', { kmReading: 99801 })]);
    ok('before the hiccup: the same NEW entry sent twice within seconds is saved once', !a.error && /sent twice/.test(b.error || '') && issues('HARDEN-c1') === 1, { first: a.error || 'saved', second: b.error });
    await fault({ match: 'POST /rest/v1/rpc/web_count', code: 503, n: 4 });
    const hid = rid(), hEntry = issue('HARDEN-c2');
    let h = await api('saveDieselIssue', [hEntry], { rid: hid });      // a count of this save fails 4 times
    const f1 = await fired(); await fault();
    // (update-68, with the step-5 SQL: "who is first" is no longer a counter, so the hiccup meets the double-click counter – the save is
    //  answered "could not reach the database", nothing is saved, and the page sends the SAME number again, which is saved – once)
    const first = h.error || 'saved'; if (h.error && /Could not reach the database/.test(h.error)) h = await api('saveDieselIssue', [hEntry], { rid: hid });
    ok('the hiccup happened (the counter failed 4 times for one save); that save itself still went through, once (at once, or when the page sent the same number again)', f1[0] && f1[0].fired === 4 && !h.error && issues('HARDEN-c2') === 1, { fired: f1[0] && f1[0].fired, first_answer: first, answer: h.error || 'saved', rows: issues('HARDEN-c2') });
    a = await api('saveDieselIssue', [issue('HARDEN-c3', { kmReading: 99802 })]); b = await api('saveDieselIssue', [issue('HARDEN-c3', { kmReading: 99802 })]);
    ok('[fix] AFTER the hiccup the protection is still on: the same entry sent twice is saved once', !a.error && /sent twice/.test(b.error || '') && issues('HARDEN-c3') === 1, { first: a.error || 'saved', second: b.error || 'SAVED AGAIN', rows: issues('HARDEN-c3') });
  }

  if (on('aftersave')) {
    console.log('\n=== A FAILURE AFTER THE ENTRY IS SAVED DOES NOT SAVE IT TWICE ===');
    // (a) the lock cannot be given back
    let id = rid(); await fault({ match: 'POST /rest/v1/rpc/web_unlock', code: 503, n: 4 });
    let a = await api('saveDieselIssue', [issue('HARDEN-a1')], { rid: id }); let f1 = await fired(); await fault();
    let b = await api('saveDieselIssue', [issue('HARDEN-a1', { kmReading: kmNo })], { rid: id });      // the page sends the same save again (same number)
    ok('[fix] (a) "give the lock back" fails 4 times after the save: the answer is still "saved", and the copy sent again does not save a second one', f1[0].fired === 4 && !a.error && !b.error && issues('HARDEN-a1') === 1, { fired: f1[0].fired, first: a.error || 'saved', again: b.error || 'saved', rows: issues('HARDEN-a1') });
    const lockLeft = sql("select count(*) from web.locks where name = 'script' and expires_at > now()");
    ok('[fix]     …and the lock was given back at the end of the request (the next save does not wait)', lockLeft === '0', 'locks still held: ' + lockLeft);
    unlock();
    // (b) the Activity Log line cannot be written
    id = rid(); await fault({ match: 'POST /rest/v1/rpc/web_write', code: 503, n: 1, skip: 1 });
    a = await api('saveDieselIssue', [issue('HARDEN-a2')], { rid: id }); f1 = await fired(); await fault();
    const errs = await api('getErrors');
    ok('[fix] (b) the Activity Log line fails after the save: the answer is "saved" (it was), and the fault is noted for the Admin', f1[0].fired === 1 && !a.error && issues('HARDEN-a2') === 1 && JSON.stringify((errs.result || {}).errors || []).indexOf('The entry was saved, but a step after it failed') > -1, { fired: f1[0].fired, answer: a.error || 'saved', rows: issues('HARDEN-a2') });
    // (c) the last housekeeping write (data versions, sign-in time) fails
    // (the old way wrote a first note with the same function – that one is let through; with the step-5 SQL there is no such note)
    id = rid(); await fault({ match: 'POST /rest/v1/rpc/web_flush', code: 503, n: 4, skip: sql("select count(*) from pg_proc where proname = 'web_write2'") === '1' ? 0 : 1 });
    a = await api('saveDieselIssue', [issue('HARDEN-a3')], { rid: id }); f1 = await fired(); await fault();
    b = await api('saveDieselIssue', [issue('HARDEN-a3', { kmReading: kmNo })], { rid: id });
    ok('[fix] (c) the last housekeeping write fails 4 times after the save: "saved", and the copy sent again does not save a second one', f1[0].fired === 4 && !a.error && !b.error && issues('HARDEN-a3') === 1, { fired: f1[0].fired, first: a.error || 'saved', again: b.error || 'saved', rows: issues('HARDEN-a3') });
    // (d) a save the database really did NOT take is still an error with nothing written (nothing of the above may hide that)
    id = rid(); await fault({ match: 'POST /rest/v1/rpc/web_write', code: 503, n: 1 });
    a = await api('saveDieselIssue', [issue('HARDEN-a4')], { rid: id }); await fault();
    const mid = issues('HARDEN-a4');
    b = await api('saveDieselIssue', [issue('HARDEN-a4', { kmReading: kmNo })], { rid: rid() });      // the person presses Save again
    ok('(d) a save the database did NOT take (it answered 503 to the write itself): an error, nothing written; pressing Save again saves it – once', !!a.error && mid === 0 && !b.error && issues('HARDEN-a4') === 1, { first: String(a.error).slice(0, 70), rows_after_first: mid, again: b.error || 'saved', rows: issues('HARDEN-a4') });
  }

  if (on('failclosed')) {
    console.log('\n=== NO "ALL OR NOTHING" SAVE FUNCTION → NO SAVE (never half a save) ===');
    await fault({ match: 'POST /rest/v1/rpc/web_write', code: 404, n: 1, text: '{"code":"PGRST202","message":"Could not find the function public.web_write(p) in the schema cache"}' });
    const a = await api('saveDieselIssue', [issue('HARDEN-f1')]); const f1 = await fired(); await fault();
    ok('[fix] the database says "web_write is not there": the save is REFUSED, names the SQL file, nothing is written', f1[0].fired === 1 && /Saving is switched off/.test(a.error || '') && /supabase_step3_safety\.sql/.test(a.error || '') && issues('HARDEN-f1') === 0, { answer: String(a.error || 'SAVED (the old way)').slice(0, 150), rows: issues('HARDEN-f1') });
    const b = await api('saveDieselIssue', [issue('HARDEN-f2')]);
    ok('…and the next save (the function is there again) is written normally – the server did not stay in "the old way"', !b.error && issues('HARDEN-f2') === 1, b.error || 'saved');
  }

  if (on('column')) {
    console.log('\n=== A VALUE FOR A COLUMN THE DATABASE DOES NOT HAVE IS NEVER DROPPED SILENTLY ===');
    const restart = () => execSync('timeout 80 /tmp/up3.sh >/dev/null 2>&1; for i in $(seq 1 40); do a=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:' + PORT + '/); if [ "$a" = "200" ]; then break; fi; sleep 0.5; done', { shell: '/bin/bash' });
    if (PORT !== 3000) console.log('     (this section restarts the rig\'s own servers – run it with the default port)');
    else {
      sql("alter table public.log_book drop column if exists challan_no; notify pgrst, 'reload schema';"); await wait(800); restart();
      try {
        const tk = (await raw(PORT, { fn: 'login', args: ADMIN })).result.token;
        const row = extra => Object.assign({ date: '2026-09-21', shift: 'Day', no: 'MH-15-AB-0003', mode: 'KM', openingKm: 5000, closingKm: 5010, work: 'HARDEN column' }, extra);
        let a = await api('saveLogRows', [{ rows: [row({ challan: 'CH-0045' })] }], { token: tk });
        const said = a.error || JSON.stringify(a.result || '');
        const n1 = sql("select count(*) from log_book where machinery = 'MH-15-AB-0003' and date = '2026-09-21'");
        ok('[fix] the database has no "challan_no" column and the entry carries a Challan No: REFUSED, the column is named, nothing saved', /System update incomplete/.test(said) && /log_book\.challan_no/.test(said) && n1 === '0', { answer: said.slice(0, 190), rows: n1 });
        a = await api('saveLogRows', [{ rows: [row({ date: '2026-09-22' })] }], { token: tk });
        const n2 = sql("select count(*) from log_book where machinery = 'MH-15-AB-0003' and date = '2026-09-22'");
        ok('…an entry WITHOUT a Challan No (nothing would be lost) is saved as always', n2 === '1' && !a.error, a.error || JSON.stringify(a.result).slice(0, 120));
      } finally { sql("alter table public.log_book add column if not exists challan_no text; notify pgrst, 'reload schema';"); await wait(800); restart(); }
      const tk2 = (await raw(PORT, { fn: 'login', args: ADMIN })).result.token;
      const a = await raw(PORT, { fn: 'api', args: [tk2, 'saveLogRows', [{ rows: [{ date: '2026-09-23', shift: 'Day', no: 'MH-15-AB-0003', mode: 'KM', openingKm: 5010, closingKm: 5020, work: 'HARDEN column', challan: 'CH-0046' }] }]] });
      ok('the column is back (its SQL step was run): the same entry with its Challan No is saved, the value is in the database', sql("select coalesce(challan_no, '') from log_book where machinery = 'MH-15-AB-0003' and date = '2026-09-23'") === 'CH-0046', a.error || 'saved');
      r = await raw(PORT, { fn: 'login', args: ADMIN });      // (the servers were restarted: the admin of the later sections signs in again)
    }
  }
  const admin2 = on('column') && PORT === 3000 ? r.result.token : admin;
  const api2 = (fn, args, opt) => api(fn, args, Object.assign({ token: admin2 }, opt || {}));

  if (on('auth')) {
    console.log('\n=== SIGN-IN: ONE-TIME PASSWORD, THE LOCK, THE ACTIVITY LOG ===');
    const email = 'harden' + Date.now().toString(36) + '@rcl.test';
    const init = await api2('usersAdmin'), perms = {}; ((init.result && init.result.modules) || []).forEach(m => { perms[m.key || m] = 'Edit'; });
    let a = await api2('saveUserAdmin', [{ email: email, name: 'Harden', active: true, admin: false, perms: perms, isNew: true, newPassword: 'Temp#12345' }]);
    const stored = sql("select password_hash from app_users where id = '" + email + "'");
    let l = await raw(PORT, { fn: 'login', args: [email, 'Temp#12345'] });
    const g = await api('getInit', [], { token: l.result && l.result.token }), s2 = await api('saveDieselIssue', [issue('HARDEN-otp')], { token: l.result && l.result.token });
    ok('[fix] the Admin\'s ONE-TIME password is stored as a hash (not as typed); signed in on it the page is told "must change", and the SERVER opens nothing until it is changed (not even by reloading the page)', !a.error && /^tmp\$(sha256\$[0-9a-f]{16}\$[0-9a-f]{64}|scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{64}\$[0-9a-f]{12})$/.test(stored) && stored.indexOf('Temp#12345') === -1 && l.result && l.result.mustChange === true && g.error === 'SESSION_EXPIRED' && s2.error === 'SESSION_EXPIRED' && issues('HARDEN-otp') === 0, { mustChange: l.result && l.result.mustChange, getInit: g.error || 'OPEN – the whole app', save: s2.error || 'SAVED', storedAs: stored.slice(0, 22) });
    const c = await raw(PORT, { fn: 'changePassword', args: [l.result.token, 'Temp#12345', 'Harden#Pass9!x'] });
    const g2 = await api('getInit', [], { token: c.result && c.result.token });
    ok('…after setting an own password the app opens (and the password is stored as a hash)', !c.error && !g2.error && !!g2.result && /^(sha256|scrypt)\$/.test(sql("select password_hash from app_users where id = '" + email + "'")), c.error || g2.error || 'open');
    { const e2m = 'harden-plain' + Date.now().toString(36) + '@rcl.test';
      sql("insert into app_users (id, email, name, active, admin, password_hash) values ('" + e2m + "', '" + e2m + "', 'Plain', 'Yes', 'No', 'Plain#Word77')"); sql("delete from web.cache where key = 'USERS_LIST'"); await wait(1200);
      const lp = await raw(PORT, { fn: 'login', args: [e2m, 'Plain#Word77'] }), gp = await api('getStock', [], { token: lp.result && lp.result.token });
      const cp = lp.result ? await raw(PORT, { fn: 'changePassword', args: [lp.result.token, 'Plain#Word77', 'Plain#Changed88!'] }) : { error: 'no sign-in' };
      ok('a plain password written straight into the table (the first Admin of a new site): signs in, must change, nothing opens before – then it is a hash', lp.result && lp.result.mustChange === true && gp.error === 'SESSION_EXPIRED' && !cp.error && /^(sha256|scrypt)\$/.test(sql("select password_hash from app_users where id = '" + e2m + "'")), lp.error || cp.error || 'ok'); }
    // the lock: 5 wrong tries; a 6th try while locked must not start the 15 minutes afresh
    for (let i = 0; i < 5; i++) await raw(PORT, { fn: 'login', args: [email, 'wrong-' + i] });
    const e1 = sql("select extract(epoch from expires_at)::bigint || '|' || value from web.cache where key = 'F_" + email + "'");
    await wait(2500);
    const locked = await raw(PORT, { fn: 'login', args: [email, 'Harden#Pass9!x'] });
    const e2 = sql("select extract(epoch from expires_at)::bigint || '|' || value from web.cache where key = 'F_" + email + "'");
    ok('[fix] 5 wrong tries lock the e-mail (429); a try WHILE locked is refused and does not push the 15 minutes further', locked.status === 429 && /Too many wrong attempts/.test(locked.error || '') && e1 === e2 && /\|5$/.test(e1), { status: locked.status, before: e1, after: e2 });
    // Activity Log: 12 sign-ins at the same moment → 12 lines (a shared number used to make them overwrite each other)
    sql("delete from web.cache where key like 'F\\_%' or key like 'LG\\_%'");
    const n0 = Number(sql("select count(*) from activity_log where action = 'Login' and email = '" + ADMIN[0] + "'"));
    // (update-68: a sign-in now takes about a third of a second of work – scrypt – and at most 5 tries of ONE e-mail are looked at
    //  at the same time. So: 12 sign-ins one after the other, then their 12 sign-OUTS at the same moment – 12 lines written together.)
    const toks = []; for (let i = 0; i < 12; i++) { const x = await raw(PORT === 3000 && i % 2 ? 3001 : PORT, { fn: 'login', args: ADMIN }); if (x.result) toks.push(x.result.token); if (i === 5) sql("delete from web.cache where key like 'LG\\_%'"); }
    const o0 = Number(sql("select count(*) from activity_log where action = 'Logout' and email = '" + ADMIN[0] + "'"));
    const many = await Promise.all(toks.map((t, i) => raw(PORT === 3000 && i % 2 ? 3001 : PORT, { fn: 'logout', args: [t] })));
    await wait(1500);
    const n1 = Number(sql("select count(*) from activity_log where action = 'Login' and email = '" + ADMIN[0] + "'")), o1 = Number(sql("select count(*) from activity_log where action = 'Logout' and email = '" + ADMIN[0] + "'"));
    ok('[fix] 12 sign-ins, then their 12 sign-outs at the same moment on two servers: 12 + 12 lines in the Activity Log (none overwritten)', toks.length === 12 && many.every(x => !x.error) && n1 - n0 === 12 && o1 - o0 === 12, { signed_in: toks.length, login_lines: n1 - n0, logout_lines_written_together: o1 - o0, newest_key: sql("select id from activity_log order by created_at desc limit 1") });
    // more than 5 sign-ins of ONE e-mail in the same instant: those beyond 5 are asked to try again – nobody is locked by it
    sql("delete from web.cache where key like 'F\\_%' or key like 'LG\\_%'");
    const burst = await Promise.all(Array.from({ length: 9 }, (_, i) => raw(PORT === 3000 && i % 2 ? 3001 : PORT, { fn: 'login', args: ADMIN }))), inN = burst.filter(x => !x.error).length;
    const next = await raw(PORT, { fn: 'login', args: ADMIN });
    ok('9 sign-ins of one e-mail in the same instant: at least 5 get in, the others are asked to try again (never "wrong password") – and nobody is locked: the next sign-in works at once', inN >= 5 && burst.every(x => !x.error || /Too many/.test(x.error)) && !next.error, { in: inN, others: [...new Set(burst.filter(x => x.error).map(x => x.error))], next: next.error || 'in' });
  }

  if (on('queue')) {
    console.log('\n=== THE WAITING LINE OF THE SERVER HAS AN END ===');
    // a third copy of the server with ONE helper thread and room for 10 waiting requests
    const child = spawn('node', ['dev.js'], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PORT: '3003', RCL_WORKERS: '1', RCL_QUEUE: '10' }), stdio: 'ignore', detached: true });
    try {
      for (let i = 0; i < 40; i++) { try { const x = await fetch('http://127.0.0.1:3003/'); if (x.status === 200) break; } catch (e) {} await wait(400); }
      const tk = (await raw(3003, { fn: 'login', args: ADMIN })).result.token;
      const t0 = Date.now(), all = await Promise.all(Array.from({ length: 60 }, () => raw(3003, { fn: 'api', args: [tk, 'getInit', []] })));
      const good = all.filter(x => x.status === 200 && x.result).length, busy = all.filter(x => x.status === 503 && /RETRY_LATER/.test(x.error || '') && x.retryAfter).length;
      ok('[fix] 60 requests at once on a server with 1 thread and room for 10 in line: the ones that fit are answered, the others are told "busy" (503, Retry-After) AT ONCE – nobody hangs', good >= 10 && busy >= 30 && good + busy === 60 && Math.max(...all.filter(x => x.status === 503).map(x => x.ms)) < 3000, { answered: good, told_busy: busy, slowest_busy_ms: Math.max(0, ...all.filter(x => x.status === 503).map(x => x.ms)), all_done_ms: Date.now() - t0 });
      const after = await raw(3003, { fn: 'api', args: [tk, 'getStock', []] });
      ok('…and right after it the server answers normally again', after.status === 200 && !!after.result, after.error || after.ms + ' ms');
    } finally { try { process.kill(-child.pid); } catch (e) { try { child.kill(); } catch (e2) {} } }
  }

  if (on('ai')) {
    console.log('\n=== THE ASSISTANT: QUESTIONS ARE COUNTED EXACTLY; A LONG CHAT KEEPS WORKING ===');
    const stand = spawn('node', [path.join(__dirname, 'gemini-standin.js')], { stdio: 'ignore', detached: true });
    const child = spawn('node', ['dev.js'], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PORT: '3004', GEMINI_API_KEY: 'test-key', GEMINI_API_BASE: 'http://127.0.0.1:3998' }), stdio: 'ignore', detached: true });
    try {
      for (let i = 0; i < 40; i++) { try { const x = await fetch('http://127.0.0.1:3004/'); if (x.status === 200) break; } catch (e) {} await wait(400); }
      const tk = (await raw(3004, { fn: 'login', args: ADMIN })).result.token;
      sql("delete from web.cache where key like 'AIU\\_%' or key like 'AIS\\_%'");
      const ask = contents => raw(3004, { fn: 'api', args: [tk, 'getAiReply', [{ contents: contents }]] });
      const q = t => ({ role: 'user', parts: [{ text: t }] }), ans = t => ({ role: 'model', parts: [{ text: t }] });
      const first = await ask([q('hello')]);
      const all = await Promise.all(Array.from({ length: 20 }, () => ask([q('hello')])));
      await wait(800);
      const counted = sql("select value from web.cache where key like 'AIU\\_%' order by expires_at desc limit 1");
      ok('[fix] 1 + 20 questions (20 of them at the same moment): the hour\'s counter says 21', !first.error && all.every(x => !x.error) && counted === '21', { answered: all.filter(x => !x.error).length, counter: counted, firstError: first.error || (all.find(x => x.error) || {}).error || '' });
      // a chat of 45 turns: user, model, user, model … ending with a question (so the cut to the last 40 begins with an ANSWER)
      const long = []; for (let i = 0; i < 22; i++) { long.push(q('question ' + i)); long.push(ans('answer ' + i)); } long.push(q('and now?'));
      const l = await ask(long);
      ok('[fix] a chat of 45 turns still gets its answer (it used to answer only "Type a question for the assistant")', !l.error && !!l.result, l.error || 'answered');
    } finally { [child, stand].forEach(c => { try { process.kill(-c.pid); } catch (e) { try { c.kill(); } catch (e2) {} } }); }
  }

  await fault(); unlock(); cleanUp();
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (PORT !== 3000 ? '   (port ' + PORT + ')' : ''));
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); try { execSync('curl -s -m 3 -X POST http://127.0.0.1:3100/__fault -d "{}"'); } catch (x) {} process.exit(1); });
