/* (update-161, asked 26-10-2026: "mala app war pratek gostich realtime notification jayla haw app band aso ki chalu app updet
 * pasun te sagle kahi") THE PHONE APP'S NOTIFICATIONS THROUGH GOOGLE FIREBASE (FCM) – at once, also when the app is closed.
 *   – A phone of the app gives its Firebase address (its "token") when it is signed in (the action fcmSave). It is kept at the
 *     FIRST site, beside the list of sites (its app_settings: FCM|<person> – his phones, at most 6; FCMT|<fingerprint of the
 *     token> – whose phone it is), so a notification of ANY site reaches him. One phone = one person: when another person signs in
 *     on it, it becomes his (as the web's notifications, update-75). Signing out takes it off (fcmOff).
 *   – Whatever the server already tells the web (Code.gs rtcPush_: a call's ring / answered / missed, verification, approvals,
 *     reminders) also goes to his phones – a DATA message with the site it is from: the app shows it in the person's language
 *     and opens that site and screen when it is pressed.
 *   – The key: FCM_SERVICE_ACCOUNT_JSON (Vercel → Environment Variables) – the file Firebase gives (Project settings → Service
 *     accounts → Generate new private key), pasted whole. Not set = nothing is sent (as before). A Preview never sends.
 *   – A phone Firebase says is no longer there (the app removed) is forgotten. Sending never throws: a notification never stops
 *     a save. Only Google's two addresses are ever called (the test rig's stand-in only off the live site). */
'use strict';
const crypto = require('crypto');
const { fetchAllSync } = require('./syncfetch');
const sites = require('./sites');

const TOKEN_RE = /^[A-Za-z0-9_:-]{100,400}$/;      // a Firebase token (about 160 letters)
const MAX_PHONES = 6;
// the test rig only: a stand-in for Google (http://127.0.0.1:port) – never on the live site, even if it is set there
function testBase() {
  const t = String(process.env.FCM_TEST_URL || '').replace(/\/+$/, '');
  return t && String(process.env.VERCEL_ENV || '') !== 'production' && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(t) ? t : '';
}
const tokenUrl = () => (testBase() ? testBase() + '/token' : 'https://oauth2.googleapis.com/token');
const sendUrl = p => (testBase() || 'https://fcm.googleapis.com') + '/v1/projects/' + encodeURIComponent(p) + '/messages:send';

function conf() {
  if (String(process.env.VERCEL_ENV || '') === 'preview') return null;      // a Preview (a test copy) never sends to real phones
  const raw = String(process.env.FCM_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  let k = null; try { k = JSON.parse(raw); } catch (e) { return { error: 'FCM_SERVICE_ACCOUNT_JSON is not the complete key file – paste the whole .json file Firebase gave, from { to }.' }; }
  if (!k || !k.client_email || !k.private_key || !k.project_id) return { error: 'FCM_SERVICE_ACCOUNT_JSON has no client_email / private_key / project_id – it must be the service account key file of the Firebase project.' };
  return { email: String(k.client_email), key: String(k.private_key), project: String(k.project_id) };
}
const on = () => { const c = conf(); return !!c && !c.error; };

/* ---------- Google's permission to send (an hour; asked again a little before it ends) ---------- */
const b64 = x => Buffer.from(x).toString('base64url');
let ACCESS = { value: '', exp: 0, email: '' };
function access(c) {
  const now = Math.floor(Date.now() / 1000);
  if (ACCESS.value && ACCESS.email === c.email && ACCESS.exp - 120 > now) return ACCESS.value;
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64(JSON.stringify({ iss: c.email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  let sig; try { sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(c.key).toString('base64url'); }
  catch (e) { throw new Error('the private key in FCM_SERVICE_ACCOUNT_JSON could not be used'); }
  const r = fetchAllSync([{ url: tokenUrl(), method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + sig }], 6000)[0];
  if (r.error) throw new Error('Google not reached: ' + r.error);
  let j = null; try { j = JSON.parse(r.text); } catch (e) { j = null; }
  if (r.code >= 300 || !j || !j.access_token) throw new Error('Google did not accept the key (' + r.code + '): ' + String((j && (j.error_description || j.error)) || r.text || '').slice(0, 160));
  ACCESS = { value: String(j.access_token), exp: now + (Number(j.expires_in) || 3600), email: c.email };
  return ACCESS.value;
}

/* ---------- the phones of each person (at the first site) ---------- */
const keyOf = id => 'FCM|' + id;
const idxOf = t => 'FCMT|' + crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 24);
const IO = {      // (the tests put a stand-in here)
  read(ids) {
    if (!ids.length) return {};
    const rows = sites.homeRest('GET', 'app_settings?select=id,value&id=in.(' + encodeURIComponent(ids.map(i => '"' + i + '"').join(',')) + ')') || [];
    const o = {}; rows.forEach(r => { o[r.id] = String(r.value || ''); }); return o;
  },
  write(id, value) { sites.homeRest('POST', 'app_settings?on_conflict=id', [{ id: id, value: String(value) }], 'resolution=merge-duplicates,return=minimal'); }
};
const listOf = v => { let j = []; try { j = JSON.parse(v || '[]'); } catch (e) { j = []; } return (Array.isArray(j) ? j : []).filter(p => p && TOKEN_RE.test(String(p.t || ''))); };
const okId = id => /^[0-9a-f]{16}$/.test(String(id));

// put = true: this phone is now this person's (taken from whoever had it); false: not his any more (signed out)
function keep(id, token, put) {
  id = String(id); token = String(token || '');
  if (!okId(id)) throw new Error('Notifications: who this phone belongs to is not known – sign in again.');
  if (!TOKEN_RE.test(token)) throw new Error('Notifications: the address of this phone for notifications is not valid – close the app and open it again.');
  const ix = idxOf(token), got = IO.read([keyOf(id), ix]), was = String(got[ix] || '');
  let mine = listOf(got[keyOf(id)]).filter(p => p.t !== token);
  if (put) {
    if (was && was !== id && okId(was)) { const theirs = IO.read([keyOf(was)])[keyOf(was)]; IO.write(keyOf(was), JSON.stringify(listOf(theirs).filter(p => p.t !== token))); }
    mine = [{ t: token, at: Date.now() }].concat(mine).slice(0, MAX_PHONES);
    IO.write(keyOf(id), JSON.stringify(mine));
    if (was !== id) IO.write(ix, id);
  } else {
    IO.write(keyOf(id), JSON.stringify(mine));
    if (was === id) IO.write(ix, '');
  }
  return { ok: true, phones: mine.length, sending: on() };
}

/* ---------- sending ----------
 * ids: the people (rtcUid_); msg: what the web is told ({ t: 'ring' | 'done' | 'missed' | 'cr', … }); ttl: seconds it is worth
 * delivering (a ring: 60). site: the code of the site it is from. Answer: { sent, gone } – never throws. */
const DATA_KEYS = ['t', 'call', 'name', 'from', 'mode', 'help', 'page', 'id', 'title', 'body'];
function send(ids, msg, ttl, site) {
  const out = { sent: 0, gone: 0 };
  try {
    const c = conf(); if (!c || c.error) { if (c && c.error) out.error = c.error; return out; }
    ids = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(okId))].slice(0, 300);
    if (!ids.length || !msg || typeof msg !== 'object') return out;
    const got = IO.read(ids.map(keyOf)), to = [];
    ids.forEach(id => listOf(got[keyOf(id)]).forEach(p => to.push({ id: id, t: p.t })));
    if (!to.length) return out;
    const data = { site: String(site || ''), at: String(Date.now()) };
    DATA_KEYS.forEach(k => { if (msg[k] !== undefined && msg[k] !== null && msg[k] !== '') data[k] = String(msg[k]).slice(0, k === 'body' ? 400 : 160); });
    const life = Math.max(30, Math.min(2419200, Math.round(Number(ttl) || 3600)));
    const bearer = access(c);
    const reqs = to.map(x => ({ url: sendUrl(c.project), method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: x.t, data: data, android: Object.assign({ priority: 'HIGH', ttl: life + 's' }, data.call ? { collapse_key: 'call-' + data.call.slice(0, 40) } : {}) } }) }));
    const res = fetchAllSync(reqs, 5000), dead = {};
    res.forEach((r, i) => {
      if (r && !r.error && r.code >= 200 && r.code < 300) { out.sent++; return; }
      if (r && r.code === 401) ACCESS = { value: '', exp: 0, email: '' };      // (a new permission next time)
      // the phone is no longer there (the app removed, its data cleared): forgotten
      if (r && (r.code === 404 || (r.code === 400 && /registration token|UNREGISTERED|INVALID_ARGUMENT/i.test(String(r.text || ''))))) (dead[to[i].id] = dead[to[i].id] || []).push(to[i].t);
    });
    Object.keys(dead).forEach(id => { IO.write(keyOf(id), JSON.stringify(listOf(got[keyOf(id)]).filter(p => dead[id].indexOf(p.t) < 0))); out.gone += dead[id].length; });
  } catch (e) { out.error = String((e && e.message) || e).slice(0, 200); if (typeof console !== 'undefined') console.warn('[phone notifications] ' + out.error); }
  return out;
}

module.exports = { keep, send, on, conf, TOKEN_RE, _io: IO, _forget: () => { ACCESS = { value: '', exp: 0, email: '' }; } };
