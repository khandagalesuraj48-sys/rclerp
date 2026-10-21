/* Synchronous HTTP for the server code.
 * The app's server code (Code.gs …) was written for Apps Script, where a network call waits for its answer
 * (UrlFetchApp.fetch). Node answers later (async). To run the SAME code unchanged, the calls are made by a helper
 * thread while this thread waits for it – so, for the code, a call still "waits for its answer". */
'use strict';
const { Worker, MessageChannel, receiveMessageOnPort } = require('worker_threads');

/* CONNECTIONS THAT WENT DEAD (02-10-2026: a call waited 22 s and more on the live site).
 * The helper keeps its connections to the database open between calls (faster). On Vercel the server process is FROZEN
 * between requests, and a helper of a thread that is used only when two requests overlap can sit unused for minutes.
 * Meanwhile the other side closes the connection; the frozen process never notices, and the next call on that connection
 * waits for an answer that never comes (up to the 55-second limit below). Three protections:
 *   1. a helper that was not used for IDLE_MS gets fresh connections (update-142: the helper is kept and its connections are
 *      thrown away; before, the helper itself was thrown away and a new one started – see renew below);
 *   2. every call has its own time limit (reads 15 s, writes 30 s) instead of hanging for 55 s;
 *   3. a READ that failed on the network or ran into its limit is asked once more on a new connection. A WRITE is never
 *      repeated by itself – it may have arrived; the person gets the message and decides. */
const IDLE_MS = Math.max(500, Number(process.env.RCL_FETCH_IDLE_MS) || 5000);
const READ_MS = Math.max(200, Number(process.env.RCL_FETCH_READ_MS) || 15000), WRITE_MS = Math.max(200, Number(process.env.RCL_FETCH_WRITE_MS) || 30000);
const WORKER_SRC = `
const { parentPort, workerData } = require('worker_threads');
async function once(q, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(q.url, { method: q.method || 'GET', headers: q.headers || {}, body: q.body === undefined || q.body === null ? undefined : q.body, redirect: q.redirect === 'error' ? 'error' : 'follow', signal: ac.signal });
    const text = await res.text();
    const headers = {}; res.headers.forEach((v, k) => { headers[k] = v; });
    return { code: res.status, text: text, headers: headers };
  } catch (e) { return { error: ac.signal.aborted ? 'The database did not answer in time.' : String((e && e.cause && e.cause.message) || (e && e.message) || e), net: true }; }
  finally { clearTimeout(t); }
}
async function one(q) {
  const read = /^(GET|HEAD)$/i.test(q.method || 'GET');
  let r = await once(q, read ? workerData.readMs : workerData.writeMs);
  if (r.net && read) { await new Promise(ok => setTimeout(ok, 120)); r = await once(q, workerData.readMs); if (!r.net) r.retried = true; }
  delete r.net; return r;
}
// (update-142) "fresh connections": every open connection is closed, the next request opens new ones (Node's web requests use
// the connection pool kept under this name; a new pool of the same kind replaces it). Answers true only when that was done.
const POOL_KEY = Symbol.for('undici.globalDispatcher.1');
function renewPool() {
  const old = globalThis[POOL_KEY];
  if (old === undefined) return true;                       // no request made yet: no connection to throw away
  if (!old || typeof old.constructor !== 'function' || typeof old.destroy !== 'function') return false;
  const neu = new old.constructor();
  if (typeof neu.dispatch !== 'function') return false;
  globalThis[POOL_KEY] = neu;
  try { const p = old.destroy(); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch (e) { /* closed anyway */ }
  return true;
}
parentPort.on('message', async m => {
  if (m && m.renew) { let ok = false; try { ok = renewPool(); } catch (e) { ok = false; } m.port.postMessage(ok === true); Atomics.store(m.flag, 0, 1); Atomics.notify(m.flag, 0); return; }
  let out;
  try { out = await Promise.all(m.reqs.map(one)); } catch (e) { out = m.reqs.map(() => ({ error: String(e && e.message || e) })); }
  m.port.postMessage(out);
  Atomics.store(m.flag, 0, 1); Atomics.notify(m.flag, 0);
});
`;
let worker = null, lastUsed = 0, made = 0, renewed = 0;
function getWorker() {
  // not used for a while: its open connections cannot be trusted any more – fresh connections (update-142: in the SAME helper;
  // a new helper only when that cannot be done)
  if (worker && Date.now() - lastUsed > IDLE_MS && !renew(worker)) { const old = worker; worker = null; try { old.terminate(); } catch (e) {} }
  if (!worker) { const w = new Worker(WORKER_SRC, { eval: true, workerData: { readMs: READ_MS, writeMs: WRITE_MS } }); made++; w.unref(); w.on('error', () => { if (worker === w) worker = null; }); w.on('exit', () => { if (worker === w) worker = null; }); worker = w; }
  return worker;
}
/* FRESH CONNECTIONS WITHOUT A NEW HELPER (update-142, 21-10-2026: Vercel's free CPU was used up – 94 % by this app).
 * Starting a helper costs about 100–150 ms of CPU (a new thread, and Node loads its whole web-request library again); a request
 * that finds its helper unused for 5 s paid that every time: a page left open asks every 15 s, a tab in the background every
 * 30 s, so on a quiet site almost every request did (test copy: 154 ms of CPU for one "anything new?" of an idle page, 4 ms
 * for one of a page in use). Now the helper is kept and only its connections are thrown away: it closes them all and opens new
 * ones for the next request – the same protection against a connection that went dead, at a fraction of the cost. The helper
 * says whether it could; if not (an unexpected Node version), it is replaced as before. */
function renew(w) {
  const flag = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new MessageChannel();
  try { w.postMessage({ renew: true, flag: flag, port: port2 }, [port2]); } catch (e) { port1.close(); return false; }
  const r = Atomics.wait(flag, 0, 0, 2000);
  const msg = receiveMessageOnPort(port1); port1.close();
  if (r === 'timed-out' || !msg || msg.message !== true) return false;
  renewed++; return true;
}
/* (update-138, asked 20-10-2026: "Staging database … KR PERFECT") A PREVIEW NEVER TOUCHES THE LIVE DATA.
 * A Preview (a test deployment of a branch – VERCEL_ENV = 'preview') works ONLY with a database that says of itself "I am a test
 * database": the row app_settings THIS_IS_A_TEST_DATABASE = 'yes' (STAGING_SETUP.md; only the staging database has it). Before a
 * Preview's first call to a database it asks that row (once in 5 minutes); a database without it – the live one, if a Vercel
 * setting of the Preview was left pointing there – is refused: nothing is read or saved, the page says why. Production does not
 * ask anything (VERCEL_ENV = 'production'); the local copy neither (none set). */
const isPreview = () => String(process.env.VERCEL_ENV || '') === 'preview';
const PREVIEW_NO = 'This is a Preview (a test copy of the app): it works only with the TEST database, and this database is not marked as one – nothing was read or saved. (STAGING_SETUP.md: the Preview\'s settings in Vercel must point to the staging database.)';
const testDbs = new Map();      // the database's address → { ok, at }
function dbBase(url) { const m = /^(https?:\/\/[^/]+)\/(rest|storage|auth|functions)\/v1\//.exec(String(url || '')); return m ? m[1] : ''; }
function previewGuard(reqs) {
  if (!isPreview()) return;
  for (const q of reqs) {
    const base = dbBase(q && q.url); if (!base) continue;      // (not a database: Google, the AI …)
    const h = (q && q.headers) || {}, key = String(h.apikey || h.Apikey || String(h.Authorization || h.authorization || '').replace(/^Bearer\s+/i, ''));
    const was = testDbs.get(base);
    if (was && Date.now() - was.at < (was.ok ? 300000 : 10000)) { if (!was.ok) throw new Error(PREVIEW_NO); continue; }
    const r = rawFetch([{ url: base + '/rest/v1/app_settings?id=eq.THIS_IS_A_TEST_DATABASE&select=value', method: 'GET', headers: { apikey: key, Accept: 'application/json' } }], 15000)[0] || {};
    let ok = false; try { ok = r.code === 200 && (JSON.parse(r.text || '[]')[0] || {}).value === 'yes'; } catch (e) { ok = false; }
    if (r.error && !ok) throw new Error('Could not reach the database – please try again in a moment.');      // (not known yet: asked again next time)
    testDbs.set(base, { ok: ok, at: Date.now() });
    if (!ok) throw new Error(PREVIEW_NO);
  }
}
// reqs: [{ url, method, headers, body }] → [{ code, text, headers } | { error }] (all at the same time, in order)
function fetchAllSync(reqs, timeoutMs) {
  if (!reqs.length) return [];
  previewGuard(reqs);
  return rawFetch(reqs, timeoutMs);
}
function rawFetch(reqs, timeoutMs) {
  const flag = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new MessageChannel();
  getWorker().postMessage({ reqs: reqs, flag: flag, port: port2 }, [port2]);
  const r = Atomics.wait(flag, 0, 0, timeoutMs || 55000);
  const msg = receiveMessageOnPort(port1);
  port1.close(); lastUsed = Date.now();
  if (r === 'timed-out' || !msg) { try { worker && worker.terminate(); } catch (e) {} worker = null; return reqs.map(() => ({ error: 'The database did not answer in time.' })); }
  return msg.message;
}
const SLEEP = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) { if (ms > 0) Atomics.wait(SLEEP, 0, 0, ms); }
module.exports = { fetchAllSync, sleepSync, helpersMade: () => made, renewals: () => renewed, isPreview, PREVIEW_NO };
