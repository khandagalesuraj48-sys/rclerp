/* Google Sheet backup: "copy what changed, if anything did".
 * Called by the open app every few minutes (POST) and by Vercel every night (GET ?full=1 – see "crons" in vercel.json).
 * It gives nothing away (only ok / not ok) and the server ignores calls that come too often, so it needs no sign-in. */
'use strict';
const pool = require('../server/pool');
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  const full = /[?&]full=1\b/.test(String(req.url || ''));
  try { const out = await pool.call('backup', [{ auto: true, full: full }], {}); res.statusCode = 200; res.end(out); }
  catch (e) { console.error('[backup] ' + String((e && e.message) || e)); res.statusCode = 200; res.end('{"ok":false}'); }
};
