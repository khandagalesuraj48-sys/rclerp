/* (update-158) GOOGLE DRIVE: where Google sends the company's account back after "Allow" (Portal → Sites → Storage →
 * "Connect Google Drive"). Google adds a one-time code and the "state" the app gave; the state was made by the Super Admin's
 * press in the Portal, is good once and for 15 minutes (drive.vm.js drvOauth_) – a call without it is refused. The answer is a
 * small page that says what happened (no data of the app is on it). The address of this page must be in the OAuth client of
 * the Google Cloud project ("Authorized redirect URIs") exactly as the Portal shows it. */
'use strict';
const pool = require('../server/pool');
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page(res, code, ok, text) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"); res.setHeader('X-Frame-Options', 'DENY');
  res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Google Drive – RCL ERP</title>' +
    '<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f4f6fb;color:#0f1f3d}main{max-width:560px;margin:12vh auto;padding:28px;background:#fff;border-radius:14px;box-shadow:0 2px 14px rgba(15,31,61,.08)}h1{font-size:20px;margin:0 0 10px}.ok{color:#0a7a3a}.bad{color:#b42318}p{margin:8px 0}</style></head>' +
    '<body><main><h1 class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓ Google Drive connected' : 'Google Drive was not connected') + '</h1><p>' + esc(text) + '</p><p>You can close this tab and go back to the Portal (Sites → Storage).</p></main></body></html>');
}
module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
    const u = new URL(String(req.url || '/'), 'http://x'), q = k => String(u.searchParams.get(k) || '').slice(0, 2000);
    if (q('error')) return page(res, 200, false, q('error') === 'access_denied' ? 'Allow was not pressed – nothing was connected.' : 'Google did not give the access – nothing was connected. Press "Connect Google Drive" in the Portal again.');      // (nothing of the address is shown on the page)
    if (!q('code') || !q('state')) return page(res, 400, false, 'This page is opened by Google after "Connect Google Drive" in the Portal – not by itself.');
    const r = JSON.parse(await pool.call('driveOauth', [{ code: q('code'), state: q('state') }], { site: '' }));
    return page(res, 200, true, 'The copies of the photos, bill copies and attachments go into the Google Drive of ' + (r && r.acct ? r.acct : 'that account') + ', folder "RCL ERP – Files (backup)" – the first copy starts with the next backup and goes on by itself.');
  } catch (e) {
    return page(res, 200, false, String((e && e.message) || e).replace(/^Error:\s*/, '').slice(0, 300));
  }
};
