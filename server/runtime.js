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
function run(fn, args, meta) {
  const st = gas.newState(meta);
  gas.boot(st, bootKeys(fn, args));
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
