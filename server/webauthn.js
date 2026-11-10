/* ================= THE WEB LOCK'S FINGERPRINT / FACE / PIN (update-218) – WebAuthn, checked on the server =================
 * Asked for web security; he chose "अ – Web lock (शिफारस)" (10-11-2026: 10 minutes). The locked screen opens with the device's own
 * fingerprint / face / PIN – a "passkey" the browser makes with the device (WebAuthn, the platform authenticator, the person's
 * fingerprint / face / PIN asked every time = user verification). The device keeps the private key; this server keeps only the
 * public key (app_settings, Code.gs wlPk…) and checks every answer here:
 *   setting it up (navigator.credentials.create): the challenge this server gave (once, 2 minutes – Code.gs), the address the
 *     browser was on (origin) and the address the passkey is for (RP ID = its host name, as a SHA-256 in the answer), "the person
 *     was there" and "the person was checked" (flags UP + UV), the passkey's number and its public key (ES256 or RS256);
 *   unlocking (navigator.credentials.get): the same, and the SIGNATURE of the device over what it was asked, with the public key
 *     kept, and its counter (a counter that goes back is a copied key – refused).
 * Nothing here comes from npm: the few pieces of CBOR the answers use are read by cbor() below; the signature by Node's crypto.
 * The app's code (in its vm) reaches only run() – never crypto itself (runtime.js __webauthn). */
'use strict';
const crypto = require('crypto');

const b64u = b => Buffer.from(b).toString('base64url');
const fromB64u = s => { s = String(s || ''); if (!/^[A-Za-z0-9_-]*={0,2}$/.test(s) || s.length > 200000) throw new Error('not base64url'); return Buffer.from(s.replace(/=+$/, ''), 'base64url'); };
const sha256 = b => crypto.createHash('sha256').update(b).digest();

/* ---- CBOR (RFC 8949): what WebAuthn uses – whole numbers, byte and text strings, lists, maps, true / false / null, tags.
 * Definite lengths only (an authenticator writes the short "canonical" form); at most 16 levels; never past the end. */
function cbor(buf, start) {
  let pos = start || 0;
  const need = n => { if (pos + n > buf.length) throw new Error('CBOR: cut short'); };
  const len = info => {
    if (info < 24) return info;
    if (info === 24) { need(1); return buf[pos++]; }
    if (info === 25) { need(2); const v = buf.readUInt16BE(pos); pos += 2; return v; }
    if (info === 26) { need(4); const v = buf.readUInt32BE(pos); pos += 4; return v; }
    if (info === 27) { need(8); const v = buf.readBigUInt64BE(pos); pos += 8; if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('CBOR: number too big'); return Number(v); }
    throw new Error('CBOR: indefinite or reserved length');
  };
  const item = depth => {
    if (depth > 16) throw new Error('CBOR: too deep');
    need(1);
    const b = buf[pos++], major = b >> 5, info = b & 31;
    if (major === 0) return len(info);
    if (major === 1) return -1 - len(info);
    if (major === 2) { const n = len(info); need(n); const v = buf.subarray(pos, pos + n); pos += n; return Buffer.from(v); }
    if (major === 3) { const n = len(info); need(n); const v = buf.toString('utf8', pos, pos + n); pos += n; return v; }
    if (major === 4) { const n = len(info); if (n > 10000) throw new Error('CBOR: list too long'); const a = []; for (let i = 0; i < n; i++) a.push(item(depth + 1)); return a; }
    if (major === 5) { const n = len(info); if (n > 10000) throw new Error('CBOR: map too long'); const m = new Map(); for (let i = 0; i < n; i++) { const k = item(depth + 1); if (m.has(k)) throw new Error('CBOR: a key twice'); m.set(k, item(depth + 1)); } return m; }
    if (major === 6) { len(info); return item(depth + 1); }      // a tag: its content
    if (info === 20) return false; if (info === 21) return true; if (info === 22) return null; if (info === 23) return undefined;
    if (info === 25) { need(2); const h = buf.readUInt16BE(pos); pos += 2; const e = (h >> 10) & 31, f = h & 1023, s = h >> 15 ? -1 : 1; return s * (e === 0 ? f * Math.pow(2, -24) : e === 31 ? (f ? NaN : Infinity) : (1 + f / 1024) * Math.pow(2, e - 15)); }
    if (info === 26) { need(4); const v = buf.readFloatBE(pos); pos += 4; return v; }
    if (info === 27) { need(8); const v = buf.readDoubleBE(pos); pos += 8; return v; }
    throw new Error('CBOR: unknown simple value');
  };
  const value = item(0);
  return { value: value, end: pos };
}

/* ---- the public key of a passkey (COSE, RFC 9053) → a JWK Node can use. Only what platform authenticators make:
 * EC2 P-256 with ES256 (-7) and RSA with RS256 (-257). */
function coseKey(m) {
  if (!(m instanceof Map)) throw new Error('the public key is not readable');
  const kty = m.get(1), alg = m.get(3);
  let jwk;
  if (kty === 2 && alg === -7) {
    const crv = m.get(-1), x = m.get(-2), y = m.get(-3);
    if (crv !== 1 || !Buffer.isBuffer(x) || !Buffer.isBuffer(y) || x.length !== 32 || y.length !== 32) throw new Error('the public key is not a P-256 key');
    jwk = { kty: 'EC', crv: 'P-256', x: b64u(x), y: b64u(y) };
  } else if (kty === 3 && alg === -257) {
    const n = m.get(-1), e = m.get(-2);
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e) || n.length < 256 || n.length > 1024 || e.length < 1 || e.length > 8) throw new Error('the public key is not a proper RSA key');
    jwk = { kty: 'RSA', n: b64u(n), e: b64u(e) };
  } else throw new Error('this kind of key is not accepted (only ES256 / RS256)');
  crypto.createPublicKey({ key: jwk, format: 'jwk' });      // (throws when it is not a real key – e.g. a point not on the curve)
  return { alg: alg, jwk: jwk };
}

/* ---- authenticatorData: rpIdHash (32) · flags (1) · signCount (4) · [attested credential: aaguid (16) · idLen (2) · id · COSE key]
 * · [extensions] */
const UP = 0x01, UV = 0x04, AT = 0x40, ED = 0x80;
function authData(buf, withKey) {
  if (!Buffer.isBuffer(buf) || buf.length < 37) throw new Error('the device answer is too short');
  const out = { rpIdHash: buf.subarray(0, 32), flags: buf[32], count: buf.readUInt32BE(33) };
  let pos = 37;
  if (out.flags & AT) {
    if (buf.length < pos + 18) throw new Error('the device answer is cut short');
    out.aaguid = buf.subarray(pos, pos + 16).toString('hex'); pos += 16;
    const n = buf.readUInt16BE(pos); pos += 2;
    if (n < 16 || n > 1023 || buf.length < pos + n) throw new Error('the passkey number is not right');
    out.id = Buffer.from(buf.subarray(pos, pos + n)); pos += n;
    const k = cbor(buf, pos); out.key = coseKey(k.value); pos = k.end;
  } else if (withKey) throw new Error('the device gave no public key');
  if (out.flags & ED) { const e = cbor(buf, pos); pos = e.end; }
  if (pos !== buf.length) throw new Error('the device answer has more in it than it should');
  return out;
}

// where this server is reached – the address in the browser: https only (http only for this computer, for tests)
function rpOf(origin) {
  const o = String(origin || '');
  const m = /^(https):\/\/([a-z0-9.-]+)(:\d+)?$/i.exec(o) || /^(http):\/\/(localhost)(:\d+)?$/i.exec(o);
  if (!m || /^\d+\.\d+\.\d+\.\d+$/.test(m[2])) return null;      // (a passkey needs a name, not a number like 127.0.0.1)
  return { origin: o.toLowerCase(), id: m[2].toLowerCase() };
}
// what the browser wrote about the request (clientDataJSON): its kind, the challenge, the address
function clientData(b64, type, challenge, rp) {
  const raw = fromB64u(b64);
  if (raw.length > 4096) throw new Error('the browser answer is too long');
  let c; try { c = JSON.parse(raw.toString('utf8')); } catch (e) { throw new Error('the browser answer is not readable'); }
  if (!c || c.type !== type) throw new Error('not the right kind of answer');
  if (typeof c.challenge !== 'string' || !challenge || c.challenge.replace(/=+$/, '') !== String(challenge).replace(/=+$/, '')) throw new Error('the answer is not for this request');
  if (String(c.origin || '').toLowerCase() !== rp.origin) throw new Error('the answer was made on another address (' + String(c.origin || '').slice(0, 80) + ')');
  if (c.crossOrigin === true) throw new Error('the answer was made inside another web site');
  return raw;
}
function flagsOk(a, rp) {
  if (!crypto.timingSafeEqual(a.rpIdHash, sha256(Buffer.from(rp.id, 'utf8')))) throw new Error('the passkey is for another address');
  if (!(a.flags & UP)) throw new Error('the device did not see the person');
  if (!(a.flags & UV)) throw new Error('the device did not check the fingerprint / face / PIN');
}

/* setting up: { id, clientDataJSON, attestationObject, challenge } → { id, alg, jwk, count, aaguid }
 * (attestation "none" is asked for: the make of the device is not checked – only that this device holds the key from now on) */
function create(x, rp) {
  clientData(x.clientDataJSON, 'webauthn.create', x.challenge, rp);
  const att = cbor(fromB64u(x.attestationObject));
  if (att.end !== fromB64u(x.attestationObject).length || !(att.value instanceof Map)) throw new Error('the device answer is not readable');
  const fmt = att.value.get('fmt'), ad = att.value.get('authData');
  if (typeof fmt !== 'string' || !Buffer.isBuffer(ad)) throw new Error('the device answer is not readable');
  const a = authData(ad, true);
  flagsOk(a, rp);
  if (x.id !== undefined && b64u(a.id) !== String(x.id).replace(/=+$/, '')) throw new Error('the passkey number does not match');
  return { id: b64u(a.id), alg: a.key.alg, jwk: a.key.jwk, count: a.count, aaguid: a.aaguid, fmt: fmt };
}
/* unlocking: { clientDataJSON, authenticatorData, signature, challenge, alg, jwk, count } → { count } (the new counter) */
function get(x, rp) {
  const cd = clientData(x.clientDataJSON, 'webauthn.get', x.challenge, rp);
  const ad = fromB64u(x.authenticatorData), a = authData(ad, false);
  flagsOk(a, rp);
  const sig = fromB64u(x.signature);
  if (sig.length < 8 || sig.length > 1024) throw new Error('the signature is not right');
  const data = Buffer.concat([ad, sha256(cd)]);
  let key; try { key = crypto.createPublicKey({ key: x.jwk, format: 'jwk' }); } catch (e) { throw new Error('the kept public key is damaged'); }
  let ok = false;
  try {
    if (Number(x.alg) === -7) ok = crypto.verify('sha256', data, { key: key, dsaEncoding: 'der' }, sig);
    else if (Number(x.alg) === -257) ok = crypto.verify('sha256', data, { key: key, padding: crypto.constants.RSA_PKCS1_PADDING }, sig);
    else throw new Error('x');
  } catch (e) { ok = false; }
  if (!ok) throw new Error('the signature does not match this passkey');
  const was = Number(x.count) || 0;
  if ((a.count > 0 || was > 0) && a.count <= was) throw new Error('the passkey counter went back (' + a.count + ' after ' + was + ') – a copied key?');
  return { count: a.count };
}

/* the one door for the app's code (runtime.js __webauthn): op 'rp' (the address the passkey is for, and the person's handle),
 * 'challenge' (32 random bytes), 'create', 'get'. A refusal comes back as { error } – never thrown into the app's code. */
function run(op, x, origin) {
  x = x && typeof x === 'object' ? x : {};
  const rp = rpOf(origin);
  try {
    if (op === 'challenge') return { challenge: b64u(crypto.randomBytes(32)) };
    if (!rp) return { error: 'this address cannot use a fingerprint / face / PIN (it needs https)' };
    if (op === 'rp') return { id: rp.id, origin: rp.origin, handle: b64u(sha256(Buffer.from('rcl-web-lock|' + String(x.email || '').toLowerCase(), 'utf8')).subarray(0, 16)) };
    if (op === 'create') return create(x, rp);
    if (op === 'get') return get(x, rp);
    return { error: 'unknown' };
  } catch (e) { return { error: String((e && e.message) || e).slice(0, 200) }; }
}
module.exports = { run, cbor, coseKey, authData, rpOf, create, get };
