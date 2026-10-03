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
      const r = webBackup_({ auto: true, full: !!o.cron && !!o.full }); return { ok: r.ok !== false, skipped: !!r.skipped, busy: !!r.busy, off: !!r.off }; } }[fn];
  if (!f) throw new Error('Unknown action.');
  const r = f.apply(null, JSON.parse(argsJson));
  return JSON.stringify(r === undefined ? null : r);
};
appBuild_ = function () { return __BUILD; };                 // the version of the page (made at deploy)
movedTo_ = function () { return ''; };                       // "the app has moved" is only for the old Apps Script app
sbBackupNow_ = function () { return webBackup_({ manual: true }); };   // the Google Sheet backup is made from here (see backup.vm.js)
`;
const COUNTER = { off: false }, WRITE = { mode: '' };   // remembered while this server lives: is the step-3 SQL there?
let script = null;
function compiled() {
  if (!script) script = new vm.Script(FILES.map(read).join('\n;\n') + '\n;\n' + require('./backup.vm.js') + TAIL, { filename: 'app-server.gs' });
  return script;
}
// the cache keys a call will surely ask for (read together with the settings, in the first database call)
function bootKeys(fn, args) {
  if (fn === 'api') return ['S_' + String(args[0] || ''), 'USERS_LIST'];
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
const IS_QUESTION = f => /^(get|rpt)[A-Z]/.test(f) || ['sync', 'logDashboard', 'pendingLog', 'billInit', 'vendorLedger', 'vendorOutstanding', 'billSummary', 'dieselHistory', 'boqRateCheck', 'boqMissing', 'logPrintExtra'].indexOf(f) > -1;
const { sleepSync } = require('./syncfetch');
function run(fn, args, meta) {
  const rid = meta && typeof meta.rid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(meta.rid) ? meta.rid : '';
  if (!rid || fn !== 'api' || IS_QUESTION(String(args[1]))) return runPlain(fn, args, meta);
  const kR = 'OPR_' + rid, kT = 'OPT_' + rid, kC = 'OPC_' + rid;
  const keep = (k, v) => { try { gas.rpc('web_flush', { p_props: null, p_put: [{ key: k, value: v, ttl: 3600 }], p_del: [] }); } catch (e) { /* the save itself is done */ } };
  const look = () => { try { return gas.rpc('web_cache_get', { p_keys: [kR, kT] }) || {}; } catch (e) { return {}; } };
  const answer = v => { let j = null; try { j = JSON.parse(v); } catch (e) { j = null; } if (j && typeof j === 'object' && j.__refused !== undefined) throw new Error(String(j.__refused)); return v; };
  let first = true, exact = !COUNTER.off;
  if (exact) { try { first = !(Number(gas.rpc('web_count', { p_key: kC, p_ttl: 3600 })) > 1); } catch (e) { exact = false; if (/404|web_count/.test(String(e && e.message))) COUNTER.off = true; } }
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
    if (!key) { if (COUNTER.ok) return 0; try { gas.rpc('web_uncount', { p_key: '__probe' }); COUNTER.ok = true; return 0; } catch (e) { if (/404/.test(String(e && e.message))) { COUNTER.off = true; return -1; } throw e; } }
    try { return Number(gas.rpc('web_count', { p_key: String(key), p_ttl: Number(ttl) || 60 })) || 0; }
    catch (e) { if (/404|web_count/.test(String(e && e.message))) { COUNTER.off = true; return -1; } throw e; } };
  g.__uncount = key => { if (!COUNTER.off) gas.rpc('web_uncount', { p_key: String(key) }); };
  g.__writeMode = v => { if (v) WRITE.mode = v; return WRITE.mode; };
  // for the Google Sheet backup: its settings, Google's Sheets API, and its own lock (not the lock of the saves)
  g.__backupConfig = () => { const c = google.config(); return JSON.stringify(c.ok ? { ok: true, sheetId: c.sheetId, email: c.email } : c); };
  g.__g = (method, p2, body) => JSON.stringify(google.call(String(method), String(p2), body ? String(body) : ''));
  g.__lockNamed = (name, ttl) => { const r = gas.rpc('web_lock', { p_name: String(name), p_holder: st.holder, p_ttl: Number(ttl) || 110 }); if (r && r.ok) { st.named = (st.named || []).concat(String(name)); return true; } return false; };
  g.__unlockNamed = name => { try { gas.rpc('web_unlock', { p_name: String(name), p_holder: st.holder }); } catch (e) {} st.named = (st.named || []).filter(x => x !== String(name)); };
  const ctx = vm.createContext(g);
  compiled().runInContext(ctx);
  let out, err = null;
  try { out = ctx.__call(fn, JSON.stringify(args)); } catch (e) { err = e; }
  // whatever happened: the lock is given back and what is waiting (sessions, counters, versions) is written
  try { gas.forceUnlock(st); } catch (e) { /* frees itself after a minute */ }
  (st.named || []).forEach(n => { try { gas.rpc('web_unlock', { p_name: n, p_holder: st.holder }); } catch (e) {} });
  try { gas.flush(st); } catch (e) { if (!err) err = e; }
  if (err) throw err;
  return out;          // JSON text
}
module.exports = { run, page, warm: compiled };
