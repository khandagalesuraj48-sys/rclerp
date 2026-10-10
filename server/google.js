/* Google Sheets from the server, without Apps Script.
 * A "service account" (a robot Google account made for this app) writes the backup Sheet through Google's Sheets API.
 * Its key is kept only in Vercel (GOOGLE_SERVICE_ACCOUNT_JSON); the Sheet is shared with its e-mail address as Editor. */
'use strict';
const crypto = require('crypto');
const { fetchAllSync } = require('./syncfetch');

function config() {
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const sheet = String(process.env.BACKUP_SHEET_ID || '').trim();
  if (!raw || !sheet) return { ok: false, error: 'The Google Sheet backup is not set up yet: add GOOGLE_SERVICE_ACCOUNT_JSON and BACKUP_SHEET_ID in Vercel → Settings → Environment Variables, then Redeploy (see README).' };
  let key = null;
  try { key = JSON.parse(raw); } catch (e) { return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not the complete key file – paste the whole content of the .json file Google gave, from { to }.' }; }
  if (!key.client_email || !key.private_key) return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_JSON has no client_email / private_key – it must be a service-account key file.' };
  const m = /\/d\/([A-Za-z0-9_-]{20,})/.exec(sheet);         // the whole link of the Sheet may be pasted
  return { ok: true, sheetId: m ? m[1] : sheet, email: key.client_email, key: key };
}
const b64 = x => Buffer.from(x).toString('base64url');
let tok = { value: '', exp: 0, email: '' };
function token(cfg) {
  const now = Math.floor(Date.now() / 1000);
  if (tok.value && tok.email === cfg.email && tok.exp - 120 > now) return tok.value;
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const aud = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
  const claim = b64(JSON.stringify({ iss: cfg.email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  let sig;
  try { sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(cfg.key.private_key).toString('base64url'); }
  catch (e) { throw new Error('The private key in GOOGLE_SERVICE_ACCOUNT_JSON could not be used – paste the key file again, whole and unchanged.'); }
  const r = fetchAllSync([{ url: aud, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + sig }], 30000)[0];
  if (r.error) throw new Error('Could not reach Google: ' + r.error);
  let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; }
  if (r.code >= 300 || !j || !j.access_token) throw new Error('Google did not accept the service account (' + r.code + '): ' + String((j && (j.error_description || j.error)) || r.text || '').slice(0, 200));
  tok = { value: j.access_token, exp: now + (Number(j.expires_in) || 3600), email: cfg.email };
  return tok.value;
}
// one call to the Sheets API → { code, text }.  ms = how long the caller can still wait (the backup's own clock): the call and
// its repeats never run past it – before, 3 tries of up to 50 s each could outlast the 58 s a request is given (07-10-2026)
function call(method, path, bodyJson, ms) {
  const cfg = config(); if (!cfg.ok) throw new Error(cfg.error);
  const base = (process.env.GOOGLE_SHEETS_URL || 'https://sheets.googleapis.com').replace(/\/+$/, '');
  const until = Date.now() + Math.max(5000, Math.min(150000, Number(ms) || 150000));
  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = until - Date.now(); if (attempt && room < 4000) break;
    const r = fetchAllSync([{ url: base + path, method: method, headers: { Authorization: 'Bearer ' + token(cfg), 'Content-Type': 'application/json' }, body: bodyJson || undefined }], Math.max(4000, Math.min(50000, room)))[0];
    if (r.error) { last = { code: 599, text: r.error }; continue; }
    if (r.code === 401) { tok = { value: '', exp: 0, email: '' }; last = r; continue; }          // token refused: take a new one
    if (r.code === 429 || r.code >= 500) { last = r; if (until - Date.now() > 4000 + 1500 * (attempt + 1)) require('./syncfetch').sleepSync(1500 * (attempt + 1)); continue; }
    return { code: r.code, text: r.text || '' };
  }
  return { code: last.code, text: last.text || '' };
}
module.exports = { config, call };
