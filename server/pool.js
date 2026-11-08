/* Several requests at the same time.
 * The app's server code waits for the database inside a request (as it did in Apps Script). So that one request never
 * makes the others wait, each request runs in its own helper thread; a few threads are kept ready and used again. */
'use strict';
process.env.TZ = 'Asia/Kolkata';       // before any helper thread starts: dates as in the Apps Script project (India time)
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread && workerData && workerData.rclWorker) {
  const { run, warm } = require('./runtime');
  const { meter } = require('./syncfetch');
  const cpuMs = () => { try { if (typeof process.threadCpuUsage === 'function') { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; } } catch (e) { /* older Node */ } return 0; };
  // (update-140) the tables this server already read (another thread's copy) – and every copy this thread makes is handed on
  const gas = require('./gas');
  try { (workerData.seed || []).forEach(x => gas.seed(x.site, x.table, x.state)); } catch (e) { /* this thread reads for itself */ }
  gas.onTable((site, table, state) => { try { parentPort.postMessage({ warmTable: { site: site, table: table, state: state } }); } catch (e) { /* the others read for themselves */ } });
  try { warm(); } catch (e) { /* shown with the first request */ }
  parentPort.on('message', m => {
    if (m && m.seed) { try { m.seed.forEach(x => gas.seed(x.site, x.table, x.state)); } catch (e) { /* kept as it is */ } return; }
    let out;
    // (update-155) what this request cost: database calls and bytes (syncfetch's meter) and this thread's CPU time
    const d0 = meter(), c0 = cpuMs();
    try { out = { id: m.id, ok: run(m.fn, m.args, m.meta) }; } catch (e) { out = { id: m.id, err: String((e && e.message) || e) }; }
    try { const d1 = meter(); out.use = { db: d1.n - d0.n, dbBytes: d1.b - d0.b, cpu: Math.round((cpuMs() - c0) * 10) / 10 }; } catch (e) { /* not counted */ }
    parentPort.postMessage(out);
  });
} else {
  const MAX = Math.max(1, Math.min(12, Number(process.env.RCL_WORKERS) || 6));
  const LIMIT_MS = 58000;
  /* THE WAITING LINE HAS AN END (07-10-2026). All helper threads busy → a request waits in line. The line used to be
   * endless and its clock started only when a thread took the request: with slow calls piling up, requests waited past
   * the 60 seconds the platform gives a request and were cut off without an answer, while the line kept growing in memory.
   * Now: at most QUEUE_MAX requests wait (the next one is told at once "busy – RETRY_LATER"; the page sends a save again by
   * itself and asks a question again), and the 58 seconds count from the moment the request ARRIVED – one that has waited
   * too long to still finish is not started. */
  const QUEUE_MAX = Math.max(10, Math.min(1000, Number(process.env.RCL_QUEUE) || 120));
  const BUSY = 'The server is busy right now – please try again in a moment (RETRY_LATER).';
  const workers = [], queue = [];
  let seq = 0;
  /* (update-140) THE NEWEST COPY OF EACH TABLE (per site) that a thread read or checked: given to the other threads at once and to
   * every thread started later, so the server reads a table once, not once per thread (see gas.js seed). */
  const SNAP = new Map();
  const shared = (from, x) => {
    if (!x || !x.state || typeof x.table !== 'string') return;
    const k = String(x.site || '') + '|' + x.table, had = SNAP.get(k);
    if (had && !(Number(x.state.at) > Number(had.state.at))) return;
    SNAP.set(k, x);
    workers.forEach(o => { if (o !== from) { try { o.w.postMessage({ seed: [x] }); } catch (e) { /* that thread reads for itself */ } } });
  };
  const drop = s => { const i = workers.indexOf(s); if (i > -1) workers.splice(i, 1); };
  const fail = (s, msg) => { const job = s.job; s.job = null; drop(s); try { s.w.terminate(); } catch (e) {} if (job) { clearTimeout(job.timer); job.reject(new Error(msg)); } next(); };
  function spawn() {
    const s = { w: new Worker(__filename, { workerData: { rclWorker: true, seed: [...SNAP.values()] } }), job: null };
    s.w.on('message', m => { if (m && m.warmTable) { shared(s, m.warmTable); return; } const job = s.job; if (!job || m.id !== job.id) return; s.job = null; clearTimeout(job.timer); if (m.use && job.meta && typeof job.meta === 'object') job.meta.use = m.use; if (m.err !== undefined) job.reject(new Error(m.err)); else job.resolve(m.ok); next(); });
    s.w.on('error', e => fail(s, 'The server had a problem: ' + String((e && e.message) || e)));
    s.w.on('exit', () => { if (workers.indexOf(s) > -1) fail(s, 'The server had a problem – please try again.'); });
    s.w.unref();
    workers.push(s);
    return s;
  }
  function next() {
    while (queue.length) {
      let s = workers.find(x => !x.job);
      if (!s && workers.length < MAX) s = spawn();
      if (!s) return;
      const job = queue.shift();
      const left = LIMIT_MS - (Date.now() - job.at);
      if (left < 8000) { job.reject(new Error(BUSY)); continue; }      // waited too long in line to still finish in time: not started
      s.job = job;
      job.timer = setTimeout(() => fail(s, 'This took too long – please try again (or pick a shorter period).'), left);
      s.w.postMessage({ id: job.id, fn: job.fn, args: job.args, meta: Object.assign({}, job.meta || {}, { until: job.at + LIMIT_MS }) });      // (update-158: the server code knows its last moment)
    }
  }
  module.exports = {
    call: (fn, args, meta) => new Promise((resolve, reject) => {
      if (queue.length >= QUEUE_MAX) { reject(new Error(BUSY)); return; }
      queue.push({ id: ++seq, at: Date.now(), fn: fn, args: args, meta: meta, resolve: resolve, reject: reject }); next(); }),
    size: () => workers.length, waiting: () => queue.length,
  };
  spawn(); spawn();      // two threads are made ready while the server starts (a click while the every-second check runs does not wait)
}
