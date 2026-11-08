/* (update-158, asked 24-10-2026) THE COPY OF THE FILES TO GOOGLE DRIVE – the Google side.
 * The photos and attachments are copied into the Google Drive of the company's own account (the Super Admin connects it once:
 * Portal → Sites → Storage → "Connect Google Drive"; Google asks that account "Allow"). The app gets the right to make and
 * see ONLY its own files and folders there ("drive.file") – nothing else in that Drive.
 * Kept in Vercel only: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (the "OAuth client" of the Google Cloud project).
 * What Google gives back when the account allows it (the refresh token) is kept LOCKED (RCL_SITES_KEY, as a site's database key)
 * in the first site's settings – never in a file, never on a page. A Preview (a test copy) never touches Drive. */
'use strict';
const crypto = require('crypto');
const { fetchAllSync, pipeSync, sleepSync, isPreview } = require('./syncfetch');
const sites = require('./sites');

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
// (review 25-10-2026) another address for Google only on the test rig – never on Vercel (a wrong one there would send the client
// secret and the refresh token elsewhere)
const onVercel = () => !!String(process.env.VERCEL_ENV || '');
const testUrl = (name, real) => (onVercel() ? '' : String(process.env[name] || '').trim()) || real;
const authBase = () => testUrl('GOOGLE_OAUTH_AUTH_URL', 'https://accounts.google.com/o/oauth2/v2/auth');
const tokenUrl = () => testUrl('GOOGLE_OAUTH_TOKEN_URL', 'https://oauth2.googleapis.com/token');
const api = () => testUrl('GOOGLE_DRIVE_URL', 'https://www.googleapis.com').replace(/\/+$/, '');
// where Google sends the account back after "Allow" – the same address must be in the OAuth client (Authorized redirect URIs)
function redirect() {
  const set = String(process.env.DRIVE_REDIRECT_URL || '').trim(); if (set) return set;
  const host = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return host ? 'https://' + host + '/api/drive' : '';
}
function client() {
  if (isPreview()) return { ok: false, error: 'This is a Preview (a test copy): it makes no copy to Google Drive.' };
  const id = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim(), secret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  if (!id || !secret) return { ok: false, error: 'The copy to Google Drive is not set up yet: add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel → Settings → Environment Variables, then Redeploy (see README).' };
  const back = redirect();
  if (!back) return { ok: false, error: 'The copy to Google Drive is not set up yet: add DRIVE_REDIRECT_URL (this app\'s address + /api/drive) in Vercel → Settings → Environment Variables, then Redeploy (see README).' };
  // (review) DRIVE_ACCOUNT (optional): only that Google account can be connected – a leaked "Allow" link cannot give the copy to another
  return { ok: true, id: id, secret: secret, redirect: back, account: String(process.env.DRIVE_ACCOUNT || '').trim().toLowerCase() };
}
// the address the Super Admin opens: Google asks the account "Allow" (state: one use, 15 minutes – checked in api/drive.js)
function authUrl(state) {
  const c = client(); if (!c.ok) throw new Error(c.error);
  const q = { client_id: c.id, redirect_uri: c.redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state: String(state) };
  return authBase() + '?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
}
function post(form, ms) {
  const r = fetchAllSync([{ url: tokenUrl(), method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: Object.keys(form).map(k => k + '=' + encodeURIComponent(form[k])).join('&') }], Math.max(3000, Math.min(15000, Number(ms) || 15000)))[0];
  if (r.error) throw new Error('Could not reach Google: ' + r.error);
  let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; }
  return { code: r.code, j: j || {}, text: String(r.text || '') };
}
// "Allow" was pressed: Google's one-time code → the refresh token (kept locked), and an access token
function exchange(code) {
  const c = client(); if (!c.ok) throw new Error(c.error);
  const r = post({ grant_type: 'authorization_code', code: String(code), client_id: c.id, client_secret: c.secret, redirect_uri: c.redirect });
  if (r.code >= 300 || !r.j.access_token) throw new Error('Google did not give the access (' + r.code + '): ' + String(r.j.error_description || r.j.error || r.text).slice(0, 200));
  if (!r.j.refresh_token) throw new Error('Google gave no lasting access – open "Connect Google Drive" again and press Allow (the app asks Google for it every time).');
  const scopes = String(r.j.scope || SCOPE).split(/\s+/);
  if (scopes.indexOf(SCOPE) === -1) throw new Error('The access to Google Drive was not given – tick "See, edit, create … the specific Google Drive files that you use with this app" and Allow.');
  remember(r.j.refresh_token, r.j.access_token, r.j.expires_in);
  return { rt: r.j.refresh_token, sealed: sites.seal(r.j.refresh_token) };
}
let TOK = { key: '', value: '', exp: 0 };
const keyOf = rt => crypto.createHash('sha256').update('drive|' + rt).digest('hex');
function remember(rt, value, expiresIn) { TOK = { key: keyOf(rt), value: String(value), exp: Math.floor(Date.now() / 1000) + (Number(expiresIn) || 3600) }; }
// an access token from the kept (locked) refresh token – kept in memory until 2 minutes before it ends (ms: the time left for asking)
function access(sealed, ms) {
  const c = client(); if (!c.ok) throw new Error(c.error);
  const rt = sites.open(sealed), k = keyOf(rt), now = Math.floor(Date.now() / 1000);
  if (TOK.key === k && TOK.value && TOK.exp - 120 > now) return TOK.value;
  const r = post({ grant_type: 'refresh_token', refresh_token: rt, client_id: c.id, client_secret: c.secret }, ms);
  if (r.code >= 300 || !r.j.access_token) {
    if (r.j.error === 'invalid_grant') throw new Error('Google Drive: the access given before does not work any more (taken back, or the password of that Google account changed) – the Super Admin connects Google Drive again (Portal → Sites → Storage).');
    throw new Error('Google did not give the access (' + r.code + '): ' + String(r.j.error_description || r.j.error || r.text).slice(0, 200));
  }
  remember(rt, r.j.access_token, r.j.expires_in);
  return TOK.value;
}
function forget() { TOK = { key: '', value: '', exp: 0 }; }
// one call to the Drive API → { code, text } (a busy or failing Google is asked again while there is time; a refused token once)
function call(sealed, method, path, bodyJson, ms) {
  const until = Date.now() + Math.max(4000, Math.min(50000, Number(ms) || 25000));
  let last = { code: 599, text: 'not asked' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = until - Date.now(); if (attempt && room < 3000) break;
    const h = { Authorization: 'Bearer ' + access(sealed, room) }; if (bodyJson) h['Content-Type'] = 'application/json; charset=UTF-8';
    const r = fetchAllSync([{ url: api() + path, method: method, headers: h, body: bodyJson || undefined }], Math.max(3000, Math.min(30000, room)))[0];
    if (r.error) { last = { code: 599, text: r.error }; if (!/^GET$/i.test(method)) break; continue; }      // (a write that got no answer is not sent again by itself)
    if (r.code === 401 && attempt === 0) { forget(); last = r; continue; }
    if (r.code === 429 || r.code >= 500 || (r.code === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(String(r.text || '')))) { last = r; if (until - Date.now() > 3000 + 1200 * (attempt + 1)) sleepSync(1200 * (attempt + 1)); continue; }
    return { code: r.code, text: String(r.text || '') };
  }
  return { code: last.code, text: String(last.text || '') };
}
// files from this site's file store into Drive: jobs [{ bucket, path, name, parent, mime, src }] → [{ code, text, md5, sha256, size } | { error }]
function pipe(sealed, site, jobs, ms) {
  const t0 = Date.now(), first = send(sealed, site, jobs, ms);
  // a token Google no longer takes (401 when sending): a new one, and those files once more (the file store is read again – harmless)
  const again = first.map((r, i) => (r && r.code === 401 && r.stage !== 'read' ? i : -1)).filter(i => i > -1);
  if (!again.length || Date.now() - t0 > ms - 5000) return first;
  forget();
  const more = send(sealed, site, again.map(i => jobs[i]), ms - (Date.now() - t0));
  again.forEach((i, k) => { first[i] = more[k]; });
  return first;
}
function send(sealed, site, jobs, ms) {
  const tok = access(sealed, ms), c = site;      // { url, key } of this site's database (gas.conf)
  const enc = p => String(p).split('/').map(encodeURIComponent).join('/');
  return pipeSync(jobs.map(j => ({
    src: { url: c.url + '/storage/v1/object/' + encodeURIComponent(j.bucket) + '/' + enc(j.path), headers: { apikey: c.key } },
    max: 50 * 1048576,
    up: { url: api() + '/upload/drive/v3/files', headers: { Authorization: 'Bearer ' + tok }, mime: j.mime || 'application/octet-stream', fields: 'id,md5Checksum,size',
      meta: { name: String(j.name), parents: [String(j.parent)], mimeType: j.mime || undefined, appProperties: { rcl: String(j.src).slice(0, 110) } } }
  })), ms);
}
module.exports = { client, redirect, authUrl, exchange, access, call, pipe, forget, SCOPE };
