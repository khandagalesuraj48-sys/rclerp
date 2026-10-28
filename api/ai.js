/* THE ASSISTANT'S ANSWER WORD BY WORD (update-186):  POST /api/ai  { token, x: { contents, context }, site }
 * → lines of JSON, one at a time as they come:  { t: 'd', x: words } …  then  { t: 'end', parts, model, used, ms }  or  { t: 'err', e }.
 * Before the first line: a refusal of the app itself (not signed in, the limits, no Claude key → "AI_NO_STREAM") as { error } – the
 * page then asks getAiReply as before. Every check and the request itself are the app's own (aiPrepare, with the person's sign-in
 * on his site – app/Code.gs); only the asking of Claude and the handing on of its words are here (server/aistream.js). */
'use strict';
const pool = require('../server/pool');
const usage = require('../server/usage');
const { stream } = require('../server/aistream');
const { statusOf } = require('./rpc');

function readBody(req) {
  if (req.body !== undefined && req.body !== null) return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8') || '{}') : req.body);
  return new Promise((resolve, reject) => { let b = ''; req.setEncoding('utf8'); req.on('data', d => { b += d; if (b.length > 2e6) reject(new Error('Too much data.')); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(new Error('Bad request.')); } }); req.on('error', reject); });
}
module.exports = async (req, res) => {
  const json = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return json(405, { error: 'POST only.' });
  let body; try { body = await readBody(req); } catch (e) { return json(400, { error: 'Bad request.' }); }
  if (!body || typeof body !== 'object') body = {};
  const site = typeof body.site === 'string' ? body.site.slice(0, 20) : '', host = req.headers['x-forwarded-host'] || req.headers.host || '', t0 = Date.now();
  const meta = { url: host ? 'https://' + host + '/' : '', rid: '', site: site };
  let prep;
  try { prep = JSON.parse(await pool.call('api', [String(body.token || ''), 'aiPrepare', [body.x && typeof body.x === 'object' ? body.x : {}]], meta)); }
  catch (e) {
    const msg = String((e && e.message) || e).replace(/^Error:\s*/, '');
    try { usage.add(site, 'aiStream', { ms: Date.now() - t0, out: msg.length, err: 1 }); } catch (x) { /* only a count */ }
    return json(msg === 'AI_NO_STREAM' ? 200 : statusOf(msg), { error: msg });
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8'); res.setHeader('Cache-Control', 'no-store, no-transform'); res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  let out = 0; const line = o => { const t = JSON.stringify(o) + '\n'; out += t.length; res.write(t); };
  try {
    const r = await stream(prep, words => line({ t: 'd', x: words }));
    // the first model was busy and another answered: that one is asked first next time (kept by the app, as for the answer in one piece)
    if (r.model && Array.isArray(prep.seq) && r.model !== prep.seq[0]) { try { await pool.call('api', [String(body.token || ''), 'aiModelFirst', [{ model: r.model }]], meta); } catch (e) { /* only the order of asking */ } }
    line({ t: 'end', parts: r.parts, model: r.model, used: r.used, ms: r.ms });
  } catch (e) { line({ t: 'err', e: String((e && e.message) || e).replace(/^Error:\s*/, '') }); }
  try { usage.add(site, 'aiStream', { ms: Date.now() - t0, out: out }); } catch (x) { /* only a count */ }
  res.end();
};
