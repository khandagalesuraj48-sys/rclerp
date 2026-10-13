/* ================= SIGN-IN THROUGH THE PORTAL (update-91, asked 13-10-2026) =================
 * "Login moves out of Mechanical onto the Portal. The Portal checks who the person is and shows his modules; a click opens
 *  the module; from inside one module he goes to another without going out." – the Portal is the one place a person signs in
 *  and the one place the Super Admin gives a site and a module.
 *
 * HOW A PERSON ARRIVES: the Portal sends the browser to this app with a TICKET after "#sso=" in the link (it never reaches a
 * server log). The ticket is a short note – who, which site, as Admin or User, his other modules and sites – SIGNED by the
 * Portal (ES256) and valid for 60 seconds. This file checks it:
 *   the signature, with the Portal's PUBLIC key (<PORTAL_URL>/api/jwks – kept here 10 minutes; asked again once when a ticket
 *   names a key this server does not know yet, so a new Portal key works at once);
 *   who made it (iss = PORTAL_URL), for whom (aud = "mechanical"), when (not before it was made, not after it ran out,
 *   never longer than 2 minutes), and that its parts are sound (an email, a site code).
 * That a ticket is used ONCE is checked inside the site (Sites.gs sysSso_ – the site's own memory).
 *
 * SWITCHED ON by the Vercel setting PORTAL_URL (e.g. https://rcl-portal-flame.vercel.app). Without it nothing changes:
 * the app's own sign-in, as before. The app's own sign-in also stays as the reserve (the link with ?local=1). */
'use strict';
const crypto = require('crypto');
const { fetchAllSync } = require('./syncfetch');

const AUD = 'mechanical';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// the Portal's address: https only (http only for this computer, for tests); '' = not switched on
function url() {
  const u = String(process.env.PORTAL_URL || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(u) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(u)) return '';
  return u;
}
const bad = why => { const e = new Error('The Portal sign-in could not be accepted (' + why + ') – open the module again from the Portal.'); e.portal = true; return e; };

let KEYS = { at: 0, from: '', keys: [] };
const KEYS_MS = 10 * 60 * 1000, AGAIN_MS = 30 * 1000;
function keys(fresh) {
  const from = url();
  if (!fresh && KEYS.from === from && KEYS.at && Date.now() - KEYS.at < KEYS_MS) return KEYS.keys;
  // asked again for an unknown key: at most once in 30 s (made-up tickets cannot make this server ask the Portal on every try)
  if (fresh && KEYS.from === from && KEYS.at && Date.now() - KEYS.at < AGAIN_MS) return KEYS.keys;
  const r = fetchAllSync([{ url: from + '/api/jwks', method: 'GET', headers: { Accept: 'application/json' } }])[0];
  if (r.error || r.code !== 200) { if (KEYS.from === from && KEYS.keys.length) return KEYS.keys; throw bad('the Portal could not be reached: ' + String(r.error || r.code).slice(0, 80)); }
  let j; try { j = JSON.parse(r.text); } catch (e) { throw bad('the Portal answered strangely'); }
  KEYS = { at: Date.now(), from: from, keys: Array.isArray(j && j.keys) ? j.keys : [] };
  return KEYS.keys;
}
const part = s => { try { return JSON.parse(Buffer.from(String(s), 'base64url').toString('utf8')); } catch (e) { return null; } };

// a ticket's claims after the checks every ticket gets (signature, issuer, for whom, time, number)
function check(ticket, aud, now) {
  const from = url();
  if (!from) throw bad('this app is not linked to the Portal');
  const t = String(ticket || '');
  if (t.length > 8000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) throw bad('not a ticket');
  const [h64, b64, s64] = t.split('.'), head = part(h64), c = part(b64);
  if (!head || !c || head.alg !== 'ES256' || !head.kid) throw bad('not a ticket of the Portal');
  let jwk = keys(false).find(k => k.kid === head.kid);
  if (!jwk) jwk = keys(true).find(k => k.kid === head.kid);      // a key made after the last look
  if (!jwk) throw bad('unknown key');
  let ok = false;
  try { ok = crypto.verify('sha256', Buffer.from(h64 + '.' + b64), { key: crypto.createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(s64, 'base64url')); }
  catch (e) { ok = false; }
  if (!ok) throw bad('the signature does not match');
  const sec = Math.floor((now || Date.now()) / 1000);
  if (c.iss !== from) throw bad('made by another Portal');
  if (c.aud !== aud) throw bad('made for another module');
  if (typeof c.exp !== 'number' || typeof c.iat !== 'number' || c.exp - c.iat > 120) throw bad('no proper time');
  if (c.exp < sec - 5) throw bad('it ran out – it is valid for one minute');
  if (c.iat > sec + 60) throw bad('made in the future – check the clock');
  if (!EMAIL.test(String(c.sub || '').trim()) || String(c.sub).length > 120) throw bad('no proper email');
  if (!/^[A-Z0-9]{1,12}$/.test(String(c.site || ''))) throw bad('no proper site');
  if (!/^[0-9a-f]{16,64}$/.test(String(c.jti || ''))) throw bad('no ticket number');
  return c;
}
// a person's ticket (opening Mechanical): the claims the sign-in needs, or an error the page shows (and then it sends him to the Portal)
function verify(ticket, now) {
  const c = check(ticket, AUD, now), email = String(c.sub).trim().toLowerCase();
  const list = (a, f) => (Array.isArray(a) ? a : []).slice(0, 40).map(f).filter(Boolean);
  return {
    email: email, name: String(c.name || email).slice(0, 80), site: c.site, siteName: String(c.siteName || c.site).slice(0, 80),
    admin: c.role === 'admin', jti: c.jti, exp: c.exp,
    mods: list(c.mods, m => m && /^[a-z]{2,20}$/.test(String(m.key)) ? { key: m.key, name: String(m.name || m.key).slice(0, 40) } : null),
    sites: list(c.sites, s => s && /^[A-Z0-9]{1,12}$/.test(String(s.code)) ? { code: s.code, name: String(s.name || s.code).slice(0, 80) } : null),
  };
}
/* (update-94) the Super Admin's ticket – the Portal's server asks for one site's users and their pages, or sets one person's
 * pages ("Users & Access" in the Portal). Made by the Portal's server only (its signature), for "mechanical-admin", 60 s, once.
 * The pages and their access travel INSIDE the signed ticket, so nothing can be changed on the way. */
const ADMIN_AUD = 'mechanical-admin', ACCESS = ['Edit', 'View', 'None'];
function verifyAdmin(ticket, now) {
  const c = check(ticket, ADMIN_AUD, now), out = { by: String(c.sub).trim().toLowerCase(), act: c.act, site: c.site, jti: c.jti };
  if (c.act === 'users') return out;
  if (c.act !== 'pages') throw bad('not a known request');
  const email = String(c.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 120) throw bad('no proper email of the user');
  const perms = {};
  Object.keys(c.perms && typeof c.perms === 'object' ? c.perms : {}).slice(0, 60).forEach(k => { const v = c.perms[k]; if (/^[A-Za-z &]{2,40}$/.test(k) && ACCESS.indexOf(v) > -1) perms[k] = v; });
  return Object.assign(out, { email: email, name: String(c.name || email).slice(0, 80), admin: c.admin === true, perms: perms });
}
function forget() { KEYS = { at: 0, from: '', keys: [] }; }
module.exports = { url, verify, verifyAdmin, forget, AUD, ADMIN_AUD };
