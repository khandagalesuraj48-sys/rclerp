/* The one address the page talks to:  POST /api/rpc  { fn, args }  →  { result } or { error }.
 * fn is what the page called with google.script.run in Apps Script: api, login, changePassword, logout,
 * getAppHtml, getAppBuild. */
'use strict';
const pool = require('../server/pool');            // each request in its own helper thread
const { page } = require('../server/page');
const ALLOWED = ['api', 'login', 'changePassword', 'logout', 'orgInfo'];   // orgInfo: what the sign-in screen shows (brand, customer, site) – nothing else is given without a sign-in

function readBody(req) {
  if (req.body !== undefined && req.body !== null) return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8') || '{}') : req.body);
  return new Promise((resolve, reject) => { let b = ''; req.setEncoding('utf8'); req.on('data', d => { b += d; if (b.length > 8e6) reject(new Error('Too much data.')); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(new Error('Bad request.')); } }); req.on('error', reject); });
}
/* THE ANSWER'S HTTP STATUS (07-10-2026). The page reads only the BODY ({ result } or { error }) – that stays exactly as it
 * was, so the page (also an older one still open) works as before. The status now says what kind of answer it is, so the
 * server's own log and any monitoring see failures as failures instead of "200 OK":
 *   401 not signed in / wrong password      403 no access to that page          404 not an action of the app
 *   429 too many attempts                   503 busy or the database is not reachable (Retry-After)
 *   504 the request took too long           500 a fault of the app itself
 * A REFUSAL of an entry (a wrong reading, a closed month, a locked bill …) is an ANSWER for the person and stays 200. */
function statusOf(msg) {
  if (/SESSION_EXPIRED|^Wrong email or password/.test(msg)) return 401;
  if (/^You do not have access|^You have View access only|^Only Admin /.test(msg)) return 403;
  if (/^Unknown action/.test(msg)) return 404;
  if (/^Too many (sign-in|wrong) attempts/.test(msg)) return 429;
  if (/RETRY_LATER|Another save is still running|Could not reach the database|did not answer in time|^Database \([a-z_]+\): 5\d\d/.test(msg)) return 503;
  if (/^This took too long/.test(msg)) return 504;
  if (/^The app hit a fault|^The server had a problem|^The server is not set up/.test(msg)) return 500;
  return 200;
}
module.exports = async (req, res) => {
  const send = (code, text) => { if (code === 503 || code === 429) res.setHeader('Retry-After', code === 503 ? '2' : '60'); res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(text); };
  if (req.method !== 'POST') return send(405, JSON.stringify({ error: 'POST only.' }));
  let body;
  try { body = await readBody(req); } catch (e) { return send(400, JSON.stringify({ error: 'Bad request.' })); }
  const fn = String((body && body.fn) || ''), args = Array.isArray(body && body.args) ? body.args : [];
  try {
    if (fn === 'getAppBuild') return send(200, JSON.stringify({ result: page().build }));
    if (fn === 'getAppHtml') { const p = page(); return send(200, JSON.stringify({ result: { build: p.build, html: p.html } })); }
    if (ALLOWED.indexOf(fn) === -1) return send(404, JSON.stringify({ error: 'Unknown action.' }));
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const out = await pool.call(fn, args, { url: host ? 'https://' + host + '/' : '', rid: typeof body.rid === 'string' ? body.rid.slice(0, 64) : '' });   // rid: the number of a save (a save sent again is saved once – runtime.js)
    // Vercel does not send an answer bigger than about 4.5 MB
    if (Buffer.byteLength(out, 'utf8') > 4200000) return send(200, JSON.stringify({ error: 'Too much data in one go – pick a shorter period (or fewer machinery) and try again.' }));
    return send(200, '{"result":' + out + '}');
  } catch (e) {
    const msg = String((e && e.message) || e).replace(/^Error:\s*/, '');
    if (!/SESSION_EXPIRED|Wrong email|View access|do not have access|Only Admin/.test(msg)) console.error('[' + fn + (fn === 'api' ? ':' + args[1] : '') + '] ' + msg);
    return send(statusOf(msg), JSON.stringify({ error: msg }));
  }
};
module.exports.statusOf = statusOf;
