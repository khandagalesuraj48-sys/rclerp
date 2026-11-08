/* The one address the page talks to:  POST /api/rpc  { fn, args }  →  { result } or { error }.
 * fn is what the page called with google.script.run in Apps Script: api, login, changePassword, logout,
 * getAppHtml, getAppBuild. */
'use strict';
const pool = require('../server/pool');            // each request in its own helper thread
const { page } = require('../server/page');
const delta = require('../server/delta');          // (update-155) "the same as you have" / only what changed
const usage = require('../server/usage');          // (update-155) what each action costs (counted in memory)
const ALLOWED = ['api', 'login', 'changePassword', 'logout', 'orgInfo', 'switchSite', 'setDefaultSite', 'super', 'ssoLogin', 'portalAdmin'];   // ssoLogin (update-91): a ticket of the Portal   // (update-90) another of my sites / my default site / the Super Admin   // orgInfo: what the sign-in screen shows (brand, customer, site) – nothing else is given without a sign-in

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
  if (/SESSION_EXPIRED|^Wrong email or password|^The Portal sign-in could not be accepted/.test(msg)) return 401;
  if (/^You do not have access|^You have View access only|^Only Admin /.test(msg)) return 403;
  if (/^Unknown action/.test(msg)) return 404;
  if (/^Too many (sign-in|wrong) attempts/.test(msg)) return 429;
  if (/RETRY_LATER|Another save is still running|Could not reach the database|did not answer in time|^Database \([a-z_]+\): 5\d\d/.test(msg)) return 503;
  if (/^This took too long/.test(msg)) return 504;
  if (/^The app hit a fault|^The server had a problem|^The server is not set up/.test(msg)) return 500;
  if (/^This site is not set up/.test(msg)) return 404;
  if (/^This is a Preview \(a test copy of the app\)/.test(msg)) return 503;      // (update-138) a Preview not on the test database
  return 200;
}
module.exports = async (req, res) => {
  const send = (code, text) => { if (code === 503 || code === 429) res.setHeader('Retry-After', code === 503 ? '2' : '60'); res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(text); };
  /* KEEP AWAKE (update-86, asked 12-10-2026: "the server must never go to sleep"). A server nobody has used for some minutes is
   * put to sleep by the hosting, and the next person waits seconds while it wakes. The database calls GET /api/rpc?warm=1 every
   * 3 minutes (sql/supabase_step6_keep_awake.sql): this runs the same light step as the sign-in screen (orgInfo) in a helper
   * thread – the server, its threads and its connection to the database stay awake – and answers only "ok", no data. */
  if (req.method === 'GET' && /[?&]warm=1(&|$)/.test(String(req.url || ''))) {
    const t0 = Date.now(); let ok = true; const wm = { url: '', rid: '' };
    try { await pool.call('orgInfo', [], wm); } catch (e) { ok = false; }      // (even a refusal has woken it)
    res.setHeader('Cache-Control', 'no-store');
    const wt = JSON.stringify({ ok: ok, ms: Date.now() - t0 });
    usage.add('', 'warm', Object.assign({ ms: Date.now() - t0, out: wt.length, err: !ok }, wm.use || {}));
    return send(200, wt);
  }
  // (update-155) the counts of this server – only on the local test rig (RCL_USAGE=on is never set on the live site)
  if (req.method === 'GET' && process.env.RCL_USAGE === 'on' && /[?&]usage=(1|reset)(&|$)/.test(String(req.url || ''))) {
    if (/usage=reset/.test(String(req.url))) { usage.reset(); delta.clearKept(); }
    return send(200, JSON.stringify(Object.assign(usage.summary(200), { kept: delta.kept() })));
  }
  if (req.method !== 'POST') return send(405, JSON.stringify({ error: 'POST only.' }));
  let body;
  try { body = await readBody(req); } catch (e) { return send(400, JSON.stringify({ error: 'Bad request.' })); }
  if (!body || typeof body !== 'object') body = {};
  const fn = String((body && body.fn) || ''), args = Array.isArray(body && body.args) ? body.args : [];
  const t0 = Date.now(), site = typeof body.site === 'string' ? body.site.slice(0, 20) : '', action = fn === 'api' ? String(args[1] || '') : fn;
  const meta = { url: '', rid: typeof body.rid === 'string' ? body.rid.slice(0, 64) : '', site: site };
  const counted = (text, x) => { try { usage.add(site, action, Object.assign({ ms: Date.now() - t0, out: text.length }, meta.use || {}, x || {})); } catch (e) { /* only a count */ } return text; };
  try {
    if (fn === 'getAppBuild') return send(200, counted(JSON.stringify({ result: page().build })));
    if (fn === 'getAppHtml') { const p = page(); return send(200, counted(JSON.stringify({ result: { build: p.build, html: p.html } }))); }
    if (ALLOWED.indexOf(fn) === -1) return send(404, counted(JSON.stringify({ error: 'Unknown action.' }), { err: 1 }));
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    // site: which site's database (stage 1 of "new site" – not sent = the first site, as before; a site that is not set up is refused)
    meta.url = host ? 'https://' + host + '/' : '';
    const out = await pool.call(fn, args, meta);   // rid: the number of a save (a save sent again is saved once – runtime.js)
    // Vercel does not send an answer bigger than about 4.5 MB
    if (Buffer.byteLength(out, 'utf8') > 4200000) return send(200, counted(JSON.stringify({ error: 'Too much data in one go – pick a shorter period (or fewer machinery) and try again.' }), { err: 1 }));
    /* (update-155) a question from a page that keeps its answers (m: 1, never a save): "the same", only what changed, or whole –
     * worked out from this answer of NOW (server/delta.js). Everyone else gets { result } exactly as before. */
    if (body.m === 1 && fn === 'api' && !meta.rid) { const a = delta.answer(delta.keyOf(site, fn, args), out, body.have, body.dx === 1); return send(200, counted(a.text, { kind: a.kind, full: a.full + 11 })); }
    return send(200, counted('{"result":' + out + '}'));
  } catch (e) {
    const msg = String((e && e.message) || e).replace(/^Error:\s*/, '');
    try { usage.add(site, action, Object.assign({ ms: Date.now() - t0, out: msg.length + 12, err: 1 }, meta.use || {})); } catch (x) { /* only a count */ }
    if (!/SESSION_EXPIRED|Wrong email|View access|do not have access|Only Admin|^The Portal sign-in could not be accepted \((it ran out|this ticket was already used)/.test(msg)) console.error('[' + fn + (fn === 'api' ? ':' + args[1] : '') + '] ' + msg);
    return send(statusOf(msg), JSON.stringify({ error: msg }));
  }
};
module.exports.statusOf = statusOf;
