/* Google Sheet backup: "copy what changed, if anything did".
 * Who may ask:
 *   - the open app of a signed-in user (POST with the session token) – every few minutes; the server itself decides
 *     whether anything is due, so asking often costs nothing;
 *   - the nightly job of Vercel (GET ?full=1): Vercel sends "Authorization: Bearer <CRON_SECRET>" when the environment
 *     variable CRON_SECRET is set. Without that proof the call is refused.
 * Nobody else. The answer never contains data – only ok / not ok. */
'use strict';
const pool = require('../server/pool');
const crypto = require('crypto');
function readBody(req) {
  if (req.body !== undefined && req.body !== null) { try { return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8') || '{}') : req.body); } catch (e) { return Promise.resolve({}); } }
  return new Promise(resolve => { let b = ''; req.setEncoding('utf8'); req.on('data', d => { b += d; if (b.length > 10000) b = b.slice(0, 10000); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); req.on('error', () => resolve({})); });
}
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
module.exports = async (req, res) => {
  const send = (code, o) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(o)); };
  try {
    let opt;
    if (req.method === 'GET') {
      const secret = String(process.env.CRON_SECRET || ''), got = String(req.headers.authorization || '');
      if (!secret || !same(got, 'Bearer ' + secret)) return send(401, { ok: false, denied: true });
      opt = { cron: true, full: /[?&]full=1\b/.test(String(req.url || '')) };
    } else if (req.method === 'POST') {
      const body = await readBody(req), token = String((body && body.token) || '');
      if (!token) return send(401, { ok: false, denied: true });
      opt = { token: token };
    } else return send(405, { ok: false });
    const out = JSON.parse(await pool.call('backup', [opt], {}));
    // the nightly job: a backup that failed is a failed job in the server's log (it used to read "200 OK"); the open pages get 200 as before
    return send(opt.cron && out.ok === false ? 500 : 200, out);
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/SESSION_EXPIRED/.test(msg)) return send(401, { ok: false, denied: true });
    console.error('[backup] ' + msg); return send(req.method === 'GET' ? 500 : 200, { ok: false });
  }
};
