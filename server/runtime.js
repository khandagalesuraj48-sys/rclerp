/* Runs the app's server code (the same .gs files as in Apps Script) for one request.
 * Every request gets a fresh copy of the code's "globals" – exactly as Apps Script does – so nothing is carried
 * over from one request to the next by mistake. */
'use strict';
process.env.TZ = 'Asia/Kolkata';        // dates work as they do in the Apps Script project (India time)
const vm = require('vm');
const gas = require('./gas');
const { page, read } = require('./page');
const { fetchAllSync } = require('./syncfetch');

const FILES = ['SupabaseSync.gs', 'SupabaseData.gs', 'Code.gs', 'ReadMe.gs'];
// added after the app's own code (same scope): the door for the calls, and the two things that differ outside Apps Script
const TAIL = `
;this.__call = function (fn, argsJson) {
  const f = { api: api, login: login, changePassword: changePassword, logout: logout }[fn];
  if (!f) throw new Error('Unknown action.');
  const r = f.apply(null, JSON.parse(argsJson));
  return JSON.stringify(r === undefined ? null : r);
};
appBuild_ = function () { return __BUILD; };                 // the version of the page (made at deploy)
movedTo_ = function () { return ''; };                       // "the app has moved" is only for the old Apps Script app
sbBackupNow_ = function () { return JSON.parse(__backupNow()); };   // the Google Sheet backup runs in Apps Script
`;
let script = null;
function compiled() {
  if (!script) script = new vm.Script(FILES.map(read).join('\n;\n') + TAIL, { filename: 'app-server.gs' });
  return script;
}
// "Backup now": asks the Apps Script project (which holds the Google Sheet) to run its backup now.
// Both sides already have the Supabase secret key; a fingerprint of it (never the key itself) proves the call is ours.
function backupNow() {
  const url = String(process.env.GAS_BACKUP_URL || '').trim();
  if (!url) throw new Error('The Google Sheet backup runs by itself every few minutes. For "Backup now" from here, add GAS_BACKUP_URL (the old app\'s /exec link) in Vercel → Environment Variables and redeploy.');
  const sig = require('crypto').createHash('sha256').update(gas.conf().key + '|rcl-backup', 'utf8').digest('hex');
  const r = fetchAllSync([{ url: url, method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'backupNow', sig: sig, key: process.env.GAS_BACKUP_KEY || '' }) }], 50000)[0];
  if (r.error) throw new Error('Could not reach the backup: ' + r.error);
  let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; }
  if (!j) throw new Error('The backup did not answer properly (' + r.code + '). Check GAS_BACKUP_URL (the /exec link), that the file VercelBridge is in the Apps Script project, and that a New version is deployed with access "Anyone".');
  if (j.error) throw new Error('Backup: ' + j.error);
  return JSON.stringify(j.result === undefined ? j : j.result);
}
// the cache keys a call will surely ask for (read together with the settings, in the first database call)
function bootKeys(fn, args) {
  if (fn === 'api') return ['S_' + String(args[0] || ''), 'USERS_LIST'];
  if (fn === 'login') { const e = String(args[0] || '').trim().toLowerCase().slice(0, 120); return ['USERS_LIST', 'F_' + e, 'LG_' + Math.floor(Date.now() / 60000)]; }
  if (fn === 'changePassword' || fn === 'logout') return ['S_' + String(args[fn === 'logout' ? 0 : 0] || ''), 'USERS_LIST'];
  return [];
}
function run(fn, args, meta) {
  const st = gas.newState(meta);
  gas.boot(st, bootKeys(fn, args));
  const g = gas.makeGlobals(st, page());
  g.__BUILD = page().build; g.__backupNow = backupNow;
  const ctx = vm.createContext(g);
  compiled().runInContext(ctx);
  let out, err = null;
  try { out = ctx.__call(fn, JSON.stringify(args)); } catch (e) { err = e; }
  // whatever happened: the lock is given back and what is waiting (sessions, counters, versions) is written
  try { gas.forceUnlock(st); } catch (e) { /* frees itself after a minute */ }
  try { gas.flush(st); } catch (e) { if (!err) err = e; }
  if (err) throw err;
  return out;          // JSON text
}
module.exports = { run, page, warm: compiled };
