/* Synchronous HTTP for the server code.
 * The app's server code (Code.gs …) was written for Apps Script, where a network call waits for its answer
 * (UrlFetchApp.fetch). Node answers later (async). To run the SAME code unchanged, the calls are made by a helper
 * thread while this thread waits for it – so, for the code, a call still "waits for its answer". */
'use strict';
const { Worker, MessageChannel, receiveMessageOnPort } = require('worker_threads');

const WORKER_SRC = `
const { parentPort } = require('worker_threads');
async function one(q) {
  try {
    const res = await fetch(q.url, { method: q.method || 'GET', headers: q.headers || {}, body: q.body === undefined || q.body === null ? undefined : q.body, redirect: 'follow' });
    const text = await res.text();
    const headers = {}; res.headers.forEach((v, k) => { headers[k] = v; });
    return { code: res.status, text: text, headers: headers };
  } catch (e) { return { error: String((e && e.cause && e.cause.message) || (e && e.message) || e) }; }
}
parentPort.on('message', async m => {
  let out;
  try { out = await Promise.all(m.reqs.map(one)); } catch (e) { out = m.reqs.map(() => ({ error: String(e && e.message || e) })); }
  m.port.postMessage(out);
  Atomics.store(m.flag, 0, 1); Atomics.notify(m.flag, 0);
});
`;
let worker = null;
function getWorker() {
  if (!worker) { worker = new Worker(WORKER_SRC, { eval: true }); worker.unref(); worker.on('error', () => { worker = null; }); worker.on('exit', () => { worker = null; }); }
  return worker;
}
// reqs: [{ url, method, headers, body }] → [{ code, text, headers } | { error }] (all at the same time, in order)
function fetchAllSync(reqs, timeoutMs) {
  if (!reqs.length) return [];
  const flag = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new MessageChannel();
  getWorker().postMessage({ reqs: reqs, flag: flag, port: port2 }, [port2]);
  const r = Atomics.wait(flag, 0, 0, timeoutMs || 55000);
  const msg = receiveMessageOnPort(port1);
  port1.close();
  if (r === 'timed-out' || !msg) { try { worker && worker.terminate(); } catch (e) {} worker = null; return reqs.map(() => ({ error: 'The database did not answer in time.' })); }
  return msg.message;
}
const SLEEP = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) { if (ms > 0) Atomics.wait(SLEEP, 0, 0, ms); }
module.exports = { fetchAllSync, sleepSync };
