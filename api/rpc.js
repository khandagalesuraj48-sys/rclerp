/* The one address the page talks to:  POST /api/rpc  { fn, args }  →  { result } or { error }.
 * fn is what the page called with google.script.run in Apps Script: api, login, changePassword, logout,
 * getAppHtml, getAppBuild. */
'use strict';
const pool = require('../server/pool');            // each request in its own helper thread
const { page } = require('../server/page');
const ALLOWED = ['api', 'login', 'changePassword', 'logout'];

function readBody(req) {
  if (req.body !== undefined && req.body !== null) return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8') || '{}') : req.body);
  return new Promise((resolve, reject) => { let b = ''; req.setEncoding('utf8'); req.on('data', d => { b += d; if (b.length > 8e6) reject(new Error('Too much data.')); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(new Error('Bad request.')); } }); req.on('error', reject); });
}
module.exports = async (req, res) => {
  const send = (code, text) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(text); };
  if (req.method !== 'POST') return send(405, JSON.stringify({ error: 'POST only.' }));
  let body;
  try { body = await readBody(req); } catch (e) { return send(400, JSON.stringify({ error: 'Bad request.' })); }
  const fn = String((body && body.fn) || ''), args = Array.isArray(body && body.args) ? body.args : [];
  try {
    if (fn === 'getAppBuild') return send(200, JSON.stringify({ result: page().build }));
    if (fn === 'getAppHtml') { const p = page(); return send(200, JSON.stringify({ result: { build: p.build, html: p.html } })); }
    if (ALLOWED.indexOf(fn) === -1) return send(200, JSON.stringify({ error: 'Unknown action.' }));
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const out = await pool.call(fn, args, { url: host ? 'https://' + host + '/' : '' });
    // Vercel does not send an answer bigger than about 4.5 MB
    if (Buffer.byteLength(out, 'utf8') > 4200000) return send(200, JSON.stringify({ error: 'Too much data in one go – pick a shorter period (or fewer machinery) and try again.' }));
    return send(200, '{"result":' + out + '}');
  } catch (e) {
    const msg = String((e && e.message) || e).replace(/^Error:\s*/, '');
    if (!/SESSION_EXPIRED|Wrong email|View access|do not have access|Only Admin/.test(msg)) console.error('[' + fn + (fn === 'api' ? ':' + args[1] : '') + '] ' + msg);
    return send(200, JSON.stringify({ error: msg }));
  }
};
