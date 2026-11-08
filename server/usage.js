/* (update-155) WHAT EACH ACTION COSTS, counted by this server while it runs (one Vercel instance): per site and action –
 * calls, time, this thread's CPU, database calls and the bytes the database sent, the bytes sent to the page, and how many
 * answers were "the same" or "only what changed" (server/delta.js) with the bytes they saved.
 * Nothing is written anywhere: one short line in the server's log every 10 minutes (Vercel → Logs: "[usage]"), and on the
 * local test rig GET /api/rpc?usage=1 (only when RCL_USAGE=on – never set on the live site). */
'use strict';
const T = new Map();
let since = Date.now(), logged = Date.now();
const row = () => ({ n: 0, ms: 0, cpu: 0, db: 0, dbBytes: 0, out: 0, full: 0, same: 0, delta: 0, err: 0 });
function add(site, action, x) {
  const k = (site || '-') + '|' + String(action || '?').slice(0, 40);
  let r = T.get(k); if (!r) { if (T.size > 2000) return; T.set(k, r = row()); }
  r.n++; r.ms += x.ms || 0; r.cpu += x.cpu || 0; r.db += x.db || 0; r.dbBytes += x.dbBytes || 0; r.out += x.out || 0; r.full += x.full || x.out || 0;
  if (x.kind === 'same') r.same++; else if (x.kind === 'delta') r.delta++;
  if (x.err) r.err++;
  if (Date.now() - logged > 600000 && process.env.RCL_USAGE_LOG !== 'off') { logged = Date.now(); try { console.log('[usage] ' + JSON.stringify(summary(12))); } catch (e) { /* only a log */ } }
}
function totals() { const t = row(); T.forEach(r => Object.keys(t).forEach(k => { t[k] += r[k]; })); return t; }
function summary(top) {
  const all = []; T.forEach((r, k) => all.push(Object.assign({ key: k }, r)));
  all.sort((a, b) => b.out - a.out);
  const round = r => { const o = {}; Object.keys(r).forEach(k => { o[k] = typeof r[k] === 'number' ? Math.round(r[k]) : r[k]; }); return o; };
  return { since: new Date(since).toISOString(), minutes: Math.round((Date.now() - since) / 60000), total: round(totals()), top: all.slice(0, top || 50).map(round) };
}
function reset() { T.clear(); since = Date.now(); }
module.exports = { add, summary, totals, reset };
