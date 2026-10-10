/* Runs the app's server code (the same .gs files as in Apps Script) for one request.
 * Every request gets a fresh copy of the code's "globals" – exactly as Apps Script does – so nothing is carried
 * over from one request to the next by mistake. */
'use strict';
process.env.TZ = 'Asia/Kolkata';        // dates work as they do in the Apps Script project (India time)
const vm = require('vm');
const gas = require('./gas');
const { page, read } = require('./page');
const google = require('./google');

const FILES = ['SupabaseSync.gs', 'SupabaseData.gs', 'Code.gs', 'ReadMe.gs'];
// added after the app's own code (same scope): the door for the calls, and the two things that differ outside Apps Script
const TAIL = `
;this.__call = function (fn, argsJson) {
  const f = { api: api, login: login, changePassword: changePassword, logout: logout,
    // the sign-in screen: the product name, whose copy this is, its site, logo and opening film (nothing else is given without a sign-in)
    orgInfo: () => orgPublic_(),
    // backup check: only for someone signed in (the open app), or the nightly job (which proved itself to api/backup.js)
    backup: o => { o = o || {}; if (!o.cron && !sessionUser_(o.token)) throw new Error('SESSION_EXPIRED');
      // the nightly job also forgets old save numbers (step-5 SQL: web_ops_cleanup). Never in the way of the backup; nothing to do where step 5 is not installed.
      if (o.cron) { try { __opsCleanup(); } catch (e) { /* tried again with the next saves and the next night */ } }
      const r = webBackup_({ auto: true, full: !!o.cron && !!o.full }); return { ok: r.ok !== false, skipped: !!r.skipped, busy: !!r.busy, off: !!r.off }; },
    // only from this server itself (runOnce): the entry is in, what follows a save was never finished
    saved: (token, fn, args, kept) => savedAfterAll_(token, fn, args, kept) }[fn];
  if (!f) throw new Error('Unknown action.');
  const r = f.apply(null, JSON.parse(argsJson));
  return JSON.stringify(r === undefined ? null : r);
};
appBuild_ = function () { return __BUILD; };                 // the version of the page (made at deploy)
movedTo_ = function () { return ''; };                       // "the app has moved" is only for the old Apps Script app
sbBackupNow_ = function () { return webBackup_({ manual: true }); };   // the Google Sheet backup is made from here (see backup.vm.js)
`;
const COUNTER = { off: false }, WRITE = { mode: '' };   // remembered while this server lives: is the step-3 SQL there?
/* "Not installed" is ONLY the answer 404 of the database for that function (gas.rpc words it "404 <name> is not installed").
 * Until 07-10-2026 the test was /404|web_count/ – and every error text of that function carries its name, so ONE network
 * hiccup switched the exact counters off for as long as the server lived: the sign-in limit and "a save sent twice is
 * saved once" silently fell back to the weaker read-then-write way. A hiccup is now a hiccup: that one request fails or
 * uses the plain look, the counter stays on. */
const NOT_INSTALLED = e => /^404 /.test(String((e && e.message) || e).replace(/^Error:\s*/, ''));
let script = null;
function compiled() {
  if (!script) script = new vm.Script(FILES.map(read).join('\n;\n') + '\n;\n' + require('./backup.vm.js') + TAIL, { filename: 'app-server.gs' });
  return script;
}
// the cache keys a call will surely ask for (read together with the settings, in the first database call)
function bootKeys(fn, args) {
  if (fn === 'api' || fn === 'saved') return ['S_' + String(args[0] || ''), 'USERS_LIST', 'RTCN'];      // RTCN: the counter of screen-share notes (Code.gs rtcBeat_) – loaded with the rest, so the heartbeat asks nothing extra
  if (fn === 'login') { const e = String(args[0] || '').trim().toLowerCase().slice(0, 120); return ['USERS_LIST', 'F_' + e, 'LG_' + Math.floor(Date.now() / 60000)]; }
  if (fn === 'changePassword' || fn === 'logout') return ['S_' + String(args[0] || ''), 'USERS_LIST'];
  if (fn === 'backup') return ['S_' + String((args[0] && args[0].token) || ''), 'USERS_LIST'];
  return [];
}
/* ---------- A SAVE THAT IS SENT AGAIN IS SAVED ONCE (03-10-2026) ----------
 * The page sends every save with its own number (rid) and, when no answer comes, sends the SAME save again (see the bridge in
 * page.js). Here: the first copy of a number runs and its answer is kept for an hour (web.cache OPR_<rid>). A later copy of
 * the same number does not run the save again – it gets the kept answer; while the first copy is still running it waits
 * for it. Only when the first copy cannot be running any more (a request lives 60 s at most) and left no answer – it
 * died before it saved – the later copy runs the save.
 * An entry the server REFUSED is kept too (the same refusal is given again). "Could not do it now" (busy, database slow)
 * is NOT kept: the number is given back, so the next copy tries afresh.
 * web_count (step-3 SQL) makes "who is first" exact; without it a plain look is used. */
const NOT_NOW = /Another save is still running|Could not reach the database|did not answer in time|^Database \([a-z_]+\): 5\d\d|RETRY_LATER/;
const IS_QUESTION = f => /^(get|rpt|rtc)[A-Z]/.test(f) || ['sync', 'logDashboard', 'pendingLog', 'billInit', 'vendorLedger', 'vendorOutstanding', 'billSummary', 'dieselHistory', 'boqRateCheck', 'boqMissing', 'logPrintExtra'].indexOf(f) > -1;
const { sleepSync } = require('./syncfetch');
const crypto = require('crypto');
/* ---------- SAVED ONCE, DECIDED INSIDE THE DATABASE (update-68, step-5 SQL: web.ops) ----------
 * The way above keeps "number X is done" in a note written AFTER the save. A save that reached the database while its
 * answer was lost (connection gone, the 30-second limit, the server stopped) left no note – its copy was saved again.
 * With the step-5 SQL the number is written IN THE SAME TRANSACTION as the entry (web_write2 = web_op_mark + web_write):
 *   web_op_begin  → "yours: run it" / "done: here is the answer" / "refused: here is why" / "somebody is on it: wait";
 *                   the same number with DIFFERENT data is refused (never answered with another entry's answer);
 *   the save runs with { rid, holder } (the app's write carries them – SupabaseData.gs flush);
 *   web_op_end    → the final answer is kept; or the refusal; or – when the save did not happen – the number is given back.
 *                   The DATABASE has the last word: if it says "done" (the write went through although this server got
 *                   an error or no answer), the request answers with the kept answer instead of the error.
 * GOING BACK: when a save is done the database also leaves the old-style note (web_op_note: OPC_ / OPR_ in web.cache, in the
 * same transaction), so the code before update-68 – after a roll-back – answers a copy of that save from the note.
 * RETENTION: a number is kept 3 days, a long answer 24 hours, never more than 200,000 numbers (web_ops_cleanup – run by the
 * database about every 50th save and by the nightly job, see the door "backup" above).
 * A copy that died long ago without writing is taken over after 75 s (a request lives 60 s at most); a write of the dead
 * copy that is still on its way makes the take-over WAIT (row lock) and then find "done". web_op_mark refuses a writer
 * whose number was taken over, so two copies can never both write.
 * A kept answer is given only to the same sign-in (the fingerprint includes it) while that sign-in is still valid.
 * WHAT FOLLOWS A SAVE (Activity Log line, telling the open pages) is done by the request that saved, which then "closes"
 * the number. When that request could not (it got no answer for its write, or its server stopped), the request that finds
 * the number "done but not closed" does it instead – web_op_end('close') lets exactly one request do so (savedAfterAll_).
 * Where the step-5 SQL is not installed, the way above (notes after the save) is used – nothing changes there. Whether it
 * is installed is asked with every save (NOT remembered): the moment the SQL is run, every server uses it – one that still
 * went the old way for a while could save a copy again that another server had already saved the new way. A number that
 * was started the old way just before the change-over is finished the old way (web_op_begin answers "old"). */
const OK_RESENT = JSON.stringify({ ok: true, _resent: true });
function runOnce(fn, args, meta, rid) {
  const holder = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(JSON.stringify([String(args[0] || ''), String(args[1] || ''), args[2] === undefined ? null : args[2]])).digest('hex');
  const begin = () => gas.rpc('web_op_begin', { p_rid: rid, p_hash: hash, p_holder: holder });
  const end = (state, result) => gas.rpc('web_op_end', { p_rid: rid, p_holder: holder, p_state: state, p_result: result === undefined ? null : result });
  // an answer that was kept: only for a sign-in that is still good (the same checks as any call – whoami does nothing else)
  const kept = result => { runPlain('api', [args[0], 'whoami', []], {}); return result === null || result === undefined || result === '' ? OK_RESENT : String(result); };
  const finish = result => { try { const c = end('close', null); if (c && c.n === 1) runPlain('saved', [args[0], String(args[1]), args[2] === undefined || args[2] === null ? [] : args[2], result === null || result === undefined ? '' : String(result)], {}); }
    catch (e) { console.error('[after a save whose answer was lost] ' + String((e && e.message) || e)); } };
  // the number is done: its answer – and, if the request that saved never finished what follows a save, that is done now
  // (it is given 3 seconds first: normally it is just about to finish)
  const answerKept = () => { const ans = kept(b.result);
    if (b.closed === false) { try { for (let i = 0; i < 5 && b.state === 'done' && b.closed === false; i++) { sleepSync(600); b = begin(); } } catch (e) { return ans; }
      if (b.state === 'done' && b.closed === false) finish(b.result); }
    return ans; };
  let b;
  try { b = begin(); } catch (e) { if (NOT_INSTALLED(e)) { const x = new Error('step 5 is not installed'); x.rclNoOps = true; throw x; } throw e; }
  if (b && b.state === 'old') { const x = new Error('this number was started the old way'); x.rclNoOps = true; throw x; }
  const settled = () => {
    if (!b || b.state === 'gone') return false;
    if (b.same === false) throw new Error('This save was sent with a number that another, different entry already used – nothing was saved. Reload the page (Ctrl + R) and enter it again.');
    if (b.state === 'done') return true;
    if (b.state === 'refused') { runPlain('api', [args[0], 'whoami', []], {}); throw new Error(String(b.result || 'This entry was refused.')); }
    return false;
  };
  if (settled()) return answerKept();
  if (!b.mine) {
    // another copy of this save is being worked on: wait for it (about 24 s; the page sends it again after that)
    for (let i = 0; i < 40 && !b.mine; i++) { sleepSync(600); b = begin(); if (settled()) return answerKept(); }
    if (!b.mine) throw new Error('RETRY_LATER');
  }
  let out;
  try { out = runPlain(fn, args, Object.assign({}, meta, { op: { rid: rid, holder: holder } })); }
  catch (e) {
    const msg = String((e && e.message) || e).replace(/^Error:\s*/, '');
    const notNow = NOT_NOW.test(msg) || /SESSION_EXPIRED|OP_NOT_MINE/.test(msg);
    let st = null, asked = true;
    try { st = end(notNow ? 'free' : 'refused', notNow ? null : msg); } catch (e2) { st = null; asked = false; }      // (cannot be told now: the number stays "started" and is taken over or found done later)
    if (st && st.state === 'done') {      // the write DID go through (the database has the last word): answered "saved", and what follows a save is done now
      if (st.closed === false) finish(st.result);
      return st.result === null || st.result === undefined ? OK_RESENT : String(st.result); }
    if (/OP_NOT_MINE/.test(msg)) throw new Error('RETRY_LATER');
    // the write failed with an error AND the database could not be asked what became of it: it is NOT known whether the entry is in.
    // The page must not show an error the person answers by typing the entry again (a new number – it could then be in twice):
    // it is told "again later", sends the SAME number again, and the database then has the last word (done → its answer; not done → it is run).
    if (!asked) throw new Error('RETRY_LATER');
    throw e;
  }
  try { end('done', out.length <= 400000 ? out : OK_RESENT); } catch (e) { /* the answer kept with the write itself stays */ }
  return out;
}
function run(fn, args, meta) {
  const rid = meta && typeof meta.rid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(meta.rid) ? meta.rid : '';
  if (!rid || fn !== 'api' || IS_QUESTION(String(args[1]))) return runPlain(fn, args, meta);
  try { return runOnce(fn, args, meta, rid); } catch (e) { if (!(e && e.rclNoOps)) throw e; }      // step 5 not installed (or a number of the old way): the way described above
  const kR = 'OPR_' + rid, kT = 'OPT_' + rid, kC = 'OPC_' + rid;
  const keep = (k, v) => { try { gas.rpc('web_flush', { p_props: null, p_put: [{ key: k, value: v, ttl: 3600 }], p_del: [] }); } catch (e) { /* the save itself is done */ } };
  const look = () => { try { return gas.rpc('web_cache_get', { p_keys: [kR, kT] }) || {}; } catch (e) { return {}; } };
  const answer = v => { let j = null; try { j = JSON.parse(v); } catch (e) { j = null; } if (j && typeof j === 'object' && j.__refused !== undefined) throw new Error(String(j.__refused)); return v; };
  let first = true, exact = !COUNTER.off;
  if (exact) { try { first = !(Number(gas.rpc('web_count', { p_key: kC, p_ttl: 3600 })) > 1); } catch (e) { exact = false; if (NOT_INSTALLED(e)) COUNTER.off = true; } }
  if (!exact) { const g = look(); if (g[kR] !== undefined && g[kR] !== null) return answer(g[kR]); first = !(g[kT] !== undefined && g[kT] !== null); }
  if (!first) {
    // a later copy: wait for the first one's answer (about 24 s here; the page asks again after that)
    for (let i = 0; i < 40; i++) {
      const g = look();
      if (g[kR] !== undefined && g[kR] !== null) return answer(g[kR]);
      const t0 = Number(g[kT]) || 0;
      if (!t0 || Date.now() - t0 > 75000) { first = true; break; }      // the first copy is not running any more and left no answer: it did not save
      sleepSync(600);
    }
    if (!first) throw new Error('RETRY_LATER');
  }
  keep(kT, String(Date.now()));
  let out;
  try { out = runPlain(fn, args, meta); }
  catch (e) {
    const msg = String((e && e.message) || e).replace(/^Error:\s*/, '');
    if (e && e.rclSaved && NOT_NOW.test(msg)) {
      // the entry IS in the database and something after it failed: it must NOT run again by itself (it would be saved twice).
      // The number keeps this answer, so a copy that is sent again gets the same words.
      const told = 'Your entry is SAVED, but the server could not finish its last step (' + msg.slice(0, 80) + '). Do not enter it again – open the list and check it is there.';
      keep(kR, JSON.stringify({ __refused: told }));
      throw new Error(told);
    }
    if (NOT_NOW.test(msg) || /SESSION_EXPIRED/.test(msg)) {        // not done, and not refused: the number is free again
      try { gas.rpc('web_flush', { p_props: null, p_put: [], p_del: [kT] }); if (exact) gas.rpc('web_uncount', { p_key: kC }); } catch (e2) { /* it frees itself */ }
    } else keep(kR, JSON.stringify({ __refused: msg }));
    throw e;
  }
  keep(kR, out.length <= 400000 ? out : JSON.stringify({ ok: true, _resent: true }));
  return out;
}
function runPlain(fn, args, meta) {
  const st = gas.newState(meta);
  gas.boot(st, bootKeys(fn, args), fn === 'api' && String(args[1]) === 'sync');      // the heartbeat may be answered from memory (see gas.boot)
  const g = gas.makeGlobals(st, page());
  g.__BUILD = page().build;
  // an exact counter (step-3 SQL). -1 = not installed → the app's code falls back to its old way of counting
  g.__count = (key, ttl) => { if (COUNTER.off) return -1;
    if (!key) { if (COUNTER.ok) return 0; try { gas.rpc('web_uncount', { p_key: '__probe' }); COUNTER.ok = true; return 0; } catch (e) { if (NOT_INSTALLED(e)) { COUNTER.off = true; return -1; } throw e; } }
    try { return Number(gas.rpc('web_count', { p_key: String(key), p_ttl: Number(ttl) || 60 })) || 0; }
    catch (e) { if (NOT_INSTALLED(e)) { COUNTER.off = true; return -1; } throw e; } };
  g.__uncount = key => { if (!COUNTER.off) gas.rpc('web_uncount', { p_key: String(key) }); };
  g.__writeMode = v => { if (v) WRITE.mode = v; return WRITE.mode; };
  /* SCREEN SHARE THROUGH A RELAY (update-73). Two computers on different networks often cannot reach each other directly; a relay
   * (TURN server) passes the encrypted picture and sound on. It is switched on by three settings of the hosting (Vercel →
   * Environment Variables): RTC_TURN_URL (the relay's address, e.g. relay1.example.com:3478 – several with commas),
   * RTC_TURN_USER and RTC_TURN_PASS. Nothing set = no relay, as before. The app's code only asks "is there a relay?". */
  g.__rtcRelay = () => { const url = String(process.env.RTC_TURN_URL || '').trim(), user = String(process.env.RTC_TURN_USER || '').trim(), pass = String(process.env.RTC_TURN_PASS || '').trim(); return url && user && pass ? { url: url, user: user, pass: pass } : null; };
  g.__oldWrites = () => String(process.env.RCL_OLD_WRITES || '').toLowerCase() === 'on';      // may a save be written table by table when web_write is missing? (default: no – see SupabaseData.gs)
  g.__saved = () => { st.saved = true; };
  g.__opsCleanup = () => gas.rpc('web_ops_cleanup', {});      // old save numbers are forgotten (3 days; long answers 24 hours) – see the step-5 SQL
  g.__op = () => (st.meta && st.meta.op) || null;      // { rid, holder } of this request's save, where the step-5 SQL is installed (see runOnce)      // the app's code says: the save of this request IS in the database (see "AFTER THE SAVE")
  // for the Google Sheet backup: its settings, Google's Sheets API, and its own lock (not the lock of the saves)
  g.__backupConfig = () => { const c = google.config(); return JSON.stringify(c.ok ? { ok: true, sheetId: c.sheetId, email: c.email } : c); };
  g.__g = (method, p2, body, ms) => JSON.stringify(google.call(String(method), String(p2), body ? String(body) : '', ms));
  // the settings as the database has them NOW (the backup looks again once it holds its lock – another server may just have finished one)
  g.__propFresh = key => { const b = gas.rpc('web_boot', { p_keys: [] }) || {}; st.props = Object.assign({}, b.props || {}, st.propQueue); return key in st.props ? st.props[key] : null; };
  g.__lockNamed = (name, ttl) => { const r = gas.rpc('web_lock', { p_name: String(name), p_holder: st.holder, p_ttl: Number(ttl) || 110 }); if (r && r.ok) { st.named = (st.named || []).concat(String(name)); return true; } return false; };
  g.__unlockNamed = name => { try { gas.rpc('web_unlock', { p_name: String(name), p_holder: st.holder }); } catch (e) {} st.named = (st.named || []).filter(x => x !== String(name)); };
  const ctx = vm.createContext(g);
  compiled().runInContext(ctx);
  let out, err = null;
  try { out = ctx.__call(fn, JSON.stringify(args)); } catch (e) { err = e; }
  // whatever happened: the lock is given back and what is waiting (sessions, counters, versions) is written
  try { gas.forceUnlock(st); } catch (e) { /* frees itself after a minute */ }
  (st.named || []).forEach(n => { try { gas.rpc('web_unlock', { p_name: n, p_holder: st.holder }); } catch (e) {} });
  /* AFTER THE SAVE (07-10-2026). Once the entry is in the database (st.saved), what still follows is housekeeping: the
   * sign-in time, the data versions, counters. If THAT fails (a network hiccup), the entry is still saved – so the answer
   * is still the answer. Before, such a failure was reported as "could not reach the database", the page sent the same
   * save again, and it was saved a SECOND time (a second Diesel Issue number, stock counted twice). */
  try { gas.flush(st); } catch (e) { if (!err && !st.saved) err = e; else console.error('[after a save] ' + String((e && e.message) || e)); }
  if (err) { try { err.rclSaved = !!st.saved; } catch (e) { /* a frozen error object: treated as not saved */ } throw err; }
  return out;          // JSON text
}
module.exports = { run, page, warm: compiled };
