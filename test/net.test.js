'use strict';
/* The helper that talks to the database must not hang on a connection that went dead.
 * A small server plays "the other side": the FIRST request on a connection is answered; every later request on the SAME
 * connection is never answered (that is how a connection behaves that was closed behind a frozen process). */
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const { Worker } = require('worker_threads');

// the helper waits for its answers without letting anything else run in its thread (as in the app), so the test server
// lives in a thread of its own
const SERVER = `
const http = require('http'); const { parentPort } = require('worker_threads');
let conns = 0, hung = 0;
const srv = http.createServer((req, res) => {
  const s = req.socket; s._n = (s._n || 0) + 1;
  if (req.url === '/stats') { res.end(JSON.stringify({ conns: conns, hung: hung })); return; }
  if (s._n > 1) { hung++; return; }                     // a later request on the same connection: silence
  let b = ''; req.on('data', d => { b += d; }); req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, method: req.method, n: s._n })); });
});
srv.keepAliveTimeout = 60000; srv.on('connection', () => { conns++; });
srv.listen(0, '127.0.0.1', () => parentPort.postMessage(srv.address().port));
`;
const startServer = () => new Promise(ok => { const w = new Worker(SERVER, { eval: true }); w.once('message', port => ok({ w, port })); });

test('database helper: a dead connection does not hang a read; a helper unused for a while is replaced; a write is not repeated', async () => {
  process.env.RCL_FETCH_IDLE_MS = '700'; process.env.RCL_FETCH_READ_MS = '900'; process.env.RCL_FETCH_WRITE_MS = '900';
  delete require.cache[require.resolve(path.join(__dirname, '..', 'server', 'syncfetch.js'))];
  const sf = require(path.join(__dirname, '..', 'server', 'syncfetch.js'));
  const { w, port } = await startServer(); const url = 'http://127.0.0.1:' + port + '/x';
  const get = () => sf.fetchAllSync([{ url: url, method: 'GET' }])[0];
  try {
    // 1. first read: answered
    let r = get(); assert.strictEqual(r.code, 200, JSON.stringify(r));
    // 2. at once again: the same connection is reused and never answers → the helper gives up after its limit and asks again on a new connection
    let t = Date.now(); r = get(); const took = Date.now() - t;
    assert.strictEqual(r.code, 200, 'second read: ' + JSON.stringify(r)); assert.strictEqual(r.retried, true);
    assert.ok(took >= 800 && took < 4000, 'the dead connection cost ' + took + ' ms (limit 900 ms), not the 55-second limit');
    // 3. after a pause longer than the idle limit: a fresh helper, so the read is answered at once (no waiting for a limit)
    const before = sf.helpersMade(); sf.sleepSync(900);
    t = Date.now(); r = get(); const took2 = Date.now() - t;
    assert.strictEqual(r.code, 200); assert.ok(!r.retried, 'no retry needed'); assert.strictEqual(sf.helpersMade(), before + 1, 'a fresh helper was started');
    assert.ok(took2 < 700, 'answered in ' + took2 + ' ms');
    // 4. a WRITE on a dead connection: reported after its limit, never sent a second time
    const hungBefore = JSON.parse(sf.fetchAllSync([{ url: 'http://127.0.0.1:' + port + '/stats', method: 'GET', headers: { connection: 'close' } }])[0].text).hung;
    sf.sleepSync(900); get();                                 // fresh helper, its connection has now been used once
    t = Date.now(); r = sf.fetchAllSync([{ url: url, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' }])[0];
    assert.ok(r.error && /did not answer in time/.test(r.error), JSON.stringify(r)); assert.ok(Date.now() - t < 4000);
    sf.sleepSync(900);
    const st = JSON.parse(sf.fetchAllSync([{ url: 'http://127.0.0.1:' + port + '/stats', method: 'GET' }])[0].text);
    assert.strictEqual(st.hung - hungBefore, 1, 'the write reached the other side once only: ' + JSON.stringify(st));
  } finally { await w.terminate(); delete process.env.RCL_FETCH_IDLE_MS; delete process.env.RCL_FETCH_READ_MS; delete process.env.RCL_FETCH_WRITE_MS; }
});
