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
    used = true;
    const res = await fetch(q.url, { method: q.method || 'GET', headers: q.headers || {}, body: q.body === undefined || q.body === null ? undefined : q.body, redirect: q.redirect === 'error' ? 'error' : 'follow', signal: ac.signal });
    const text = await res.text();
    const headers = {}; res.headers.forEach((v, k) => { headers[k] = v; });
    return { code: res.status, text: text, headers: headers };
  } catch (e) { return { error: ac.signal.aborted ? 'The database did not answer in time.' : String((e && e.cause && e.cause.message) || (e && e.message) || e), net: true }; }
  finally { clearTimeout(t); }
}
/* (update-158) ONE FILE FROM THE SITE'S FILE STORE INTO GOOGLE DRIVE, in this helper: read, its MD5 and SHA-256 worked out, sent
 * to Drive (multipart up to 5 MB, else resumable) – the file never goes through the server code. Never repeated by itself (a write). */
async function pipe(q) {
  const crypto = require('crypto'), p = q.pipe, ac = new AbortController(), t = setTimeout(() => ac.abort(), Math.max(1000, Number(q.ms) || 45000));
  const words = r => r.text().then(x => String(x || '').slice(0, 400)).catch(() => ''), NL = String.fromCharCode(13, 10);      // (no backslash in this text: it is a template)
  try {
    used = true;
    const d = await fetch(p.src.url, { method: 'GET', headers: p.src.headers || {}, redirect: 'error', signal: ac.signal });      // (the key is never sent on to another address)
    if (d.status !== 200) return { code: d.status, text: await words(d), stage: 'read' };
    const buf = Buffer.from(await d.arrayBuffer());
    if (p.max && buf.length > p.max) return { code: 413, text: 'The file is bigger than ' + p.max + ' bytes.', stage: 'read' };
    const md5 = crypto.createHash('md5').update(buf).digest('hex'), sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const meta = JSON.stringify(p.up.meta || {}), mime = String(p.up.mime || 'application/octet-stream'), F = 'fields=' + encodeURIComponent(p.up.fields || 'id,md5Checksum,size');
    let r;
    if (buf.length <= 5 * 1048576) {
      const b = 'rcl' + crypto.randomBytes(12).toString('hex');
      const body = Buffer.concat([Buffer.from('--' + b + NL + 'Content-Type: application/json; charset=UTF-8' + NL + NL + meta + NL + '--' + b + NL + 'Content-Type: ' + mime + NL + NL, 'utf8'), buf, Buffer.from(NL + '--' + b + '--' + NL, 'utf8')]);
      r = await fetch(p.up.url + '?uploadType=multipart&' + F, { method: 'POST', headers: Object.assign({}, p.up.headers || {}, { 'Content-Type': 'multipart/related; boundary=' + b }), body: body, signal: ac.signal });
    } else {
      const s = await fetch(p.up.url + '?uploadType=resumable&' + F, { method: 'POST', headers: Object.assign({}, p.up.headers || {}, { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(buf.length) }), body: meta, signal: ac.signal });
      const loc = s.headers.get('location');
      if (s.status !== 200 || !loc) return { code: s.status, text: await words(s), stage: 'start', md5: md5, sha256: sha256, size: buf.length };
      r = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': mime }, body: buf, signal: ac.signal });
      // (review) the answer of the last piece may not carry the MD5 Drive counted: it is asked for (files.get)
      if (r.status >= 200 && r.status < 300) { const t = await words(r); let j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
        if (j && j.id && !j.md5Checksum) { const g = await fetch(p.up.url.replace('/upload/drive/v3/files', '/drive/v3/files') + '/' + encodeURIComponent(j.id) + '?' + F, { headers: { Authorization: (p.up.headers || {}).Authorization || '' }, signal: ac.signal });
          return { code: g.status, text: await words(g), md5: md5, sha256: sha256, size: buf.length, stage: 'send' }; }
        return { code: r.status, text: t, md5: md5, sha256: sha256, size: buf.length, stage: 'send' }; }
    }
    return { code: r.status, text: await words(r), md5: md5, sha256: sha256, size: buf.length, stage: 'send' };
  } catch (e) { return { error: ac.signal.aborted ? 'Google Drive or the file store did not answer in time.' : String((e && e.cause && e.cause.message) || (e && e.message) || e) }; }
  finally { clearTimeout(t); }
}
/* (update-176) THE PAGES OF A PDF ASKED, AS A PDF OF THEIR OWN (pdf-lib – app/vendor): the old log book's PDF is read by the AI a page at a
 * time; sent whole, the AI worked through EVERY page of the file at every call and ran out of time ("too slow to answer"). Only reads. */
async function pdfPart(q) {
  try {
    const L = require(workerData.pdfLib), x = q.pdf;
    const src = await L.PDFDocument.load(Buffer.from(String(x.data || ''), 'base64'), { ignoreEncryption: true, updateMetadata: false });
    const count = src.getPageCount(), from = Math.max(1, Math.floor(Number(x.from)) || 1);
    if (from > count) return { pages: count, from: from, to: from - 1, data: '' };
    const to = Math.min(count, from + Math.max(1, Math.floor(Number(x.n)) || 1) - 1), out = await L.PDFDocument.create();
    (await out.copyPages(src, Array.from({ length: to - from + 1 }, (v, i) => from - 1 + i))).forEach(p => out.addPage(p));
    return { pages: count, from: from, to: to, data: Buffer.from(await out.save()).toString('base64') };
  } catch (e) { return { error: String((e && e.message) || e).slice(0, 300) }; }
}
async function one(q) {
  if (q && q.pipe) return pipe(q);
  if (q && q.pdf) return pdfPart(q);
  const read = /^(GET|HEAD)$/i.test(q.method || 'GET');
  let r = await once(q, read ? workerData.readMs : workerData.writeMs);
  if (r.net && read) { await new Promise(ok => setTimeout(ok, 120)); r = await once(q, workerData.readMs); if (!r.net) r.retried = true; }
  delete r.net; return r;
}
// (update-142) "fresh connections": every open connection is closed, the next request opens new ones (Node's web requests use
// the connection pool kept under this name; a new pool of the same kind replaces it). Answers true only when that was done.
// (review 22-10-2026) Only for the layout it was built and tested for – Node 20 / 22: ONE pool, under '.1'. A newer Node keeps
// it elsewhere (undici 8, Node 26: '.2'): then false, and the helper is replaced as before (the old cost, never a dead connection).
// <renewPool>
const POOL_KEY = Symbol.for('undici.globalDispatcher.1');
function renewPool(used) {
  if (!used) return true;                                   // no request made yet: no connection to throw away
  const keys = Object.getOwnPropertySymbols(globalThis).filter(k => /^undici[.]globalDispatcher[.]/.test(String(k.description)));
  if (keys.length !== 1 || keys[0] !== POOL_KEY) return false;
  const old = globalThis[POOL_KEY];
  if (!old || typeof old.constructor !== 'function' || typeof old.destroy !== 'function') return false;
  const neu = new old.constructor();
  if (typeof neu.dispatch !== 'function') return false;
  globalThis[POOL_KEY] = neu;
  if (globalThis[POOL_KEY] !== neu) return false;           // could not be replaced: the pool in use is left as it is
  try { const p = old.destroy(); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch (e) { /* closed anyway */ }
  return true;
}
// </renewPool>
let used = false;                                           // this helper has made a request (Node's pool exists)
// (a renewal never reaches a helper with a request in flight: rawFetch returns only when all its requests are answered, and
// a helper that ran out of time is thrown away – a request in flight would end with UND_ERR_DESTROYED)
parentPort.on('message', async m => {
  if (m && m.renew) { let ok = false; try { ok = renewPool(used); } catch (e) { ok = false; } m.port.postMessage(ok === true); Atomics.store(m.flag, 0, 1); Atomics.notify(m.flag, 0); return; }
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
  if (!worker) { const w = new Worker(WORKER_SRC, { eval: true, workerData: { readMs: READ_MS, writeMs: WRITE_MS, pdfLib: PDF_LIB } }); made++; w.unref(); w.on('error', () => { if (worker === w) worker = null; }); w.on('exit', () => { if (worker === w) worker = null; }); worker = w; }
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
// (update-176) the PDF tool, in the app's own files (app/** goes with the server – vercel.json includeFiles)
const PDF_LIB = require('path').join(__dirname, '..', 'app', 'vendor', 'pdf-lib-1.17.1.min.js');
// pages from … of a PDF (base64) → { pages, from, to, data } (data: a PDF of only those pages) | { error }
function pdfPartSync(b64, from, n, timeoutMs) { return rawFetch([{ pdf: { data: b64, from: from, n: n } }], timeoutMs || 20000)[0] || { error: 'no answer' }; }
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
  // (update-155) counted: the calls to the database (tables, functions, files) and the bytes it sent back
  try { reqs.forEach((q, i) => { if (dbBase(q && q.url)) { METER.n++; const x = msg.message[i]; METER.b += x && typeof x.text === 'string' ? x.text.length : 0; } }); } catch (e) { /* not counted */ }
  return msg.message;
}
const METER = { n: 0, b: 0 };      // (update-155) database calls and bytes of this thread
const SLEEP = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) { if (ms > 0) Atomics.wait(SLEEP, 0, 0, ms); }
// (update-158) files from the site's file store into Google Drive (see pipe in the helper): jobs [{ src, up, max }] → answers in order.
// Never in a Preview (a test copy never writes to the live Drive).
function pipeSync(jobs, timeoutMs) {
  if (!jobs.length) return [];
  if (isPreview()) throw new Error(PREVIEW_NO);
  const ms = Math.max(2000, Number(timeoutMs) || 45000);
  return rawFetch(jobs.map(j => ({ pipe: j, ms: ms })), ms + 3000);
}
module.exports = { fetchAllSync, pipeSync, pdfPartSync, sleepSync, helpersMade: () => made, renewals: () => renewed, isPreview, PREVIEW_NO, meter: () => ({ n: METER.n, b: METER.b }) };
