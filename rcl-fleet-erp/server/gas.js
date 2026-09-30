/* What Apps Script gave the server code for free, given again here – so Code.gs, SupabaseData.gs, SupabaseSync.gs
 * and ReadMe.gs run UNCHANGED:
 *   PropertiesService → settings and counters, kept in Supabase (web.props)
 *   CacheService      → sign-in sessions, users list, attempt counters in Supabase (web.cache);
 *                       the big copy of the main tables stays in this server's memory
 *   LockService       → one save at a time, across all servers (web.locks)
 *   UrlFetchApp       → network calls that wait for their answer
 *   Utilities, Session, ScriptApp, HtmlService, Logger → the few things the code uses from them
 * One "state" is made for every request (st) and thrown away after it, as in Apps Script. */
'use strict';
const crypto = require('crypto');
const { fetchAllSync, sleepSync } = require('./syncfetch');

const TZ = 'Asia/Kolkata';
const LOCK_TTL = 75;               // seconds: a lock left by a request that died frees itself
const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'DATA_SOURCE'];

function conf() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key = String(process.env.SUPABASE_SECRET_KEY || '');
  if (!url || !key) throw new Error('The server is not set up: add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel → Settings → Environment Variables, then Redeploy.');
  return { url: url, key: key };
}
// one database function (Supabase RPC); a network hiccup or a busy database is tried again
function rpc(name, body) {
  const c = conf();
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = fetchAllSync([{ url: c.url + '/rest/v1/rpc/' + name, method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }])[0];
    if (r.error) { last = r.error; sleepSync(300 * (attempt + 1)); continue; }
    if (r.code >= 200 && r.code < 300) return r.text ? JSON.parse(r.text) : null;
    last = r.code + ' ' + String(r.text || '').slice(0, 300);
    if (r.code >= 500 || r.code === 429) { sleepSync(400 * (attempt + 1)); continue; }
    if (r.code === 404 && /web_/.test(name)) throw new Error('The database is not ready for this app: run sql/supabase_step2_web.sql in Supabase → SQL Editor (' + name + ' is missing).');
    throw new Error('Database (' + name + '): ' + last);
  }
  throw new Error('Could not reach the database (' + name + '): ' + last);
}

/* ---------- memory of this server (lives while the server stays warm) ---------- */
const LOCAL = { stamp: null, map: new Map() };           // the big copy of the main tables (SBG_…), valid for one "stamp"
const isLocalKey = k => /^SBG_/.test(k) || k === 'APP_BUILD';
const isVersionKey = k => /^V_/.test(k);                    // data versions: kept with the settings (one place, not two)

function newState(meta) {
  return { props: {}, cache: {}, left: {}, puts: new Map(), dels: new Set(), propQueue: {}, lockDepth: 0,
    holder: crypto.randomUUID(), stamp: '', meta: meta || {}, calls: 0 };
}
// start of a request: settings + the cache keys this request will surely ask for, in one call
function boot(st, keys) {
  const b = rpc('web_boot', { p_keys: keys || [] }) || {};
  st.props = b.props || {}; st.left = b.left || {}; st.stamp = String(b.stamp || '');
  st.cache = {}; (keys || []).forEach(k => { st.cache[k] = null; });
  Object.keys(b.cache || {}).forEach(k => { st.cache[k] = b.cache[k]; });
  // no stamp (nothing could be read about the last change) → the copy in memory is not trusted at all
  if (!st.stamp || LOCAL.stamp !== st.stamp) { LOCAL.map.clear(); LOCAL.stamp = st.stamp; }
}
// end of a request: what is still waiting (cache entries, data versions) is written in one call
function flush(st) {
  const put = [...st.puts.entries()].map(([k, x]) => ({ key: k, value: x.value, ttl: x.ttl })), del = [...st.dels];
  const props = Object.keys(st.propQueue).length ? st.propQueue : null;
  if (!put.length && !del.length && !props) return;
  st.puts = new Map(); st.dels = new Set(); st.propQueue = {};
  rpc('web_flush', { p_props: props, p_put: put, p_del: del });
}
function forceUnlock(st) { if (st.lockDepth > 0) { st.lockDepth = 0; rpc('web_unlock', { p_name: 'script', p_holder: st.holder }); } }

function makeProperties(st) {
  const env = k => k === 'DATA_SOURCE' ? 'supabase' : k === 'SUPABASE_URL' ? conf().url : conf().key;
  const p = {
    getProperty: k => { k = String(k); return ENV_KEYS.indexOf(k) > -1 ? env(k) : (k in st.props ? st.props[k] : null); },
    getProperties: () => Object.assign({}, st.props, { DATA_SOURCE: 'supabase' }),
    getKeys: () => Object.keys(st.props),
    setProperty: (k, v) => { p.setProperties({ [k]: v }); return p; },
    setProperties: (o) => {
      const now = {};
      Object.keys(o || {}).forEach(k => { if (ENV_KEYS.indexOf(k) > -1) return; const v = String(o[k]); st.props[k] = v;
        if (isVersionKey(k)) st.propQueue[k] = v; else now[k] = v; });       // versions wait for the end of the request
      if (Object.keys(now).length) rpc('web_props_set', { p: now });          // settings and counters are written at once
      return p;
    },
    deleteProperty: k => { k = String(k); if (ENV_KEYS.indexOf(k) > -1) return p; delete st.props[k]; delete st.propQueue[k]; rpc('web_props_set', { p: { [k]: null } }); return p; },
    deleteAllProperties: () => { throw new Error('Not allowed here.'); },
  };
  return p;
}

function makeCache(st) {
  const localGet = k => { const x = LOCAL.map.get(k); if (!x) return null; if (x.exp < Date.now()) { LOCAL.map.delete(k); return null; } return x.value; };
  const need = keys => {   // keys not known yet → asked from the database in one call
    const ask = keys.filter(k => !(k in st.cache) && !st.dels.has(k));
    if (!ask.length) return;
    const got = rpc('web_cache_get', { p_keys: ask }) || {};
    ask.forEach(k => { st.cache[k] = k in got ? got[k] : null; });
  };
  const get = k => {
    k = String(k);
    if (isVersionKey(k)) return k in st.props ? st.props[k] : null;
    if (k === 'SB_INFO') return null;                       // backup status: read from the settings (Apps Script writes it there)
    if (isLocalKey(k)) return localGet(k);
    if (st.dels.has(k)) return null;
    need([k]);
    return st.cache[k] === undefined ? null : st.cache[k];
  };
  const put = (k, v, ttl) => {
    k = String(k); v = String(v); ttl = Math.max(1, Math.min(21600, Number(ttl) || 600));
    if (isVersionKey(k)) { st.props[k] = v; st.propQueue[k] = v; return; }
    if (k === 'SB_INFO') return;
    if (isLocalKey(k)) { if (st.stamp || k === 'APP_BUILD') LOCAL.map.set(k, { value: v, exp: Date.now() + ttl * 1000 }); return; }
    // a session is renewed on every action: it is written again only when a good part of its time has gone
    if (st.cache[k] === v && !st.puts.has(k) && Number(st.left[k]) > ttl * 0.9) return;
    st.cache[k] = v; st.dels.delete(k); st.puts.set(k, { value: v, ttl: ttl });
  };
  const remove = k => { k = String(k); if (isVersionKey(k) || k === 'SB_INFO') return; if (isLocalKey(k)) { LOCAL.map.delete(k); return; } st.cache[k] = null; st.puts.delete(k); st.dels.add(k); };
  return {
    get: get, put: put, remove: remove,
    getAll: keys => { keys = [...keys].map(String); need(keys.filter(k => !isVersionKey(k) && !isLocalKey(k) && k !== 'SB_INFO')); const o = {}; keys.forEach(k => { const v = get(k); if (v !== null && v !== undefined) o[k] = v; }); return o; },
    putAll: (o, ttl) => { Object.keys(o || {}).forEach(k => put(k, o[k], ttl)); },
    removeAll: keys => { [...keys].forEach(remove); },
  };
}

function makeLock(st) {
  const lock = {
    waitLock: ms => {
      if (st.lockDepth > 0) { st.lockDepth++; return; }     // already ours (a save inside a save)
      const end = Date.now() + Math.max(1000, Math.min(Number(ms) || 30000, 40000));
      for (;;) {
        const r = rpc('web_lock', { p_name: 'script', p_holder: st.holder, p_ttl: LOCK_TTL });
        if (r && r.ok) { st.lockDepth = 1; st.props = Object.assign({}, r.props || {}, st.propQueue); return; } // settings as they are NOW
        if (Date.now() >= end) throw new Error('Another save is still running. Please try again in a moment.');
        sleepSync(120 + Math.floor(Math.random() * 160));
      }
    },
    tryLock: ms => { try { lock.waitLock(ms); return true; } catch (e) { return false; } },
    hasLock: () => st.lockDepth > 0,
    releaseLock: () => { if (st.lockDepth <= 0) return; st.lockDepth--; if (st.lockDepth === 0) rpc('web_unlock', { p_name: 'script', p_holder: st.holder }); },
  };
  return lock;
}

/* ---------- Utilities ---------- */
const isDate = d => d && typeof d.getTime === 'function';
function formatDate(date, tz, fmt) {
  if (!isDate(date) || isNaN(date.getTime())) throw new Error('formatDate: not a date');
  const parts = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz || TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(new Date(date.getTime())).forEach(x => { parts[x.type] = x.value; });
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(parts.month) - 1];
  const h = Number(parts.hour) % 24, h12 = h % 12 === 0 ? 12 : h % 12;
  const map = { yyyy: parts.year, yy: parts.year.slice(2), MMM: mon, MM: parts.month, M: String(Number(parts.month)), dd: parts.day, d: String(Number(parts.day)),
    HH: String(h).padStart(2, '0'), H: String(h), hh: String(h12).padStart(2, '0'), h: String(h12), mm: parts.minute, ss: parts.second, a: h < 12 ? 'AM' : 'PM', EEE: parts.weekday };
  return String(fmt).replace(/'([^']*)'|yyyy|yy|MMM|MM|M|dd|d|HH|H|hh|h|mm|ss|a|EEE/g, (m, quoted) => quoted !== undefined ? quoted : map[m]);
}
const signed = buf => [...buf].map(b => b > 127 ? b - 256 : b);
function toBytes(value, charset) {
  if (typeof value === 'string') {
    if (charset === 'utf8') return Buffer.from(value, 'utf8');
    return Buffer.from([...value].map(ch => { const c = ch.codePointAt(0); return c < 128 ? c : 63; }));   // US-ASCII, as Apps Script does without a charset
  }
  return Buffer.from([...value].map(b => ((Number(b) % 256) + 256) % 256));                              // a list of (signed) bytes
}
const Utilities = {
  DigestAlgorithm: { MD2: 'md2', MD5: 'md5', SHA_1: 'sha1', SHA_256: 'sha256', SHA_384: 'sha384', SHA_512: 'sha512' },
  Charset: { UTF_8: 'utf8', US_ASCII: 'ascii' },
  formatDate: formatDate,
  getUuid: () => crypto.randomUUID(),
  sleep: ms => sleepSync(Number(ms) || 0),
  computeDigest: (alg, value, charset) => signed(crypto.createHash(alg).update(toBytes(value, charset)).digest()),
  newBlob: data => ({ getBytes: () => signed(Buffer.from(String(data), 'utf8')), getDataAsString: () => String(data) }),
  base64Encode: v => (typeof v === 'string' ? Buffer.from(v, 'utf8') : toBytes(v)).toString('base64'),
};

/* ---------- UrlFetchApp ---------- */
function toReq(url, o) {
  o = o || {};
  const headers = Object.assign({}, o.headers || {});
  if (o.contentType && !headers['Content-Type']) headers['Content-Type'] = o.contentType;
  let body = o.payload;
  if (body !== undefined && body !== null && typeof body !== 'string') body = JSON.stringify(body);
  return { url: String(url), method: String(o.method || (body !== undefined && body !== null ? 'POST' : 'GET')).toUpperCase(), headers: headers, body: body, mute: !!o.muteHttpExceptions };
}
function toRes(q, r) {
  if (r.error) throw new Error('Network: ' + r.error);
  if (!q.mute && r.code >= 400) throw new Error('Request failed for ' + q.url.split('?')[0] + ' returned code ' + r.code + '. ' + String(r.text || '').slice(0, 200));
  return { getResponseCode: () => r.code, getContentText: () => r.text || '', getHeaders: () => r.headers || {}, getAllHeaders: () => r.headers || {} };
}
const UrlFetchApp = {
  fetch: (url, o) => { const q = toReq(url, o); return toRes(q, fetchAllSync([q])[0]); },
  fetchAll: reqs => { const qs = [...reqs].map(x => toReq(x.url, x)); const rs = fetchAllSync(qs); return qs.map((q, i) => toRes(q, rs[i])); },
};

const notHere = what => new Proxy(function () {}, { get: (t, p) => p === 'then' ? undefined : notHere(what), apply: () => { throw new Error(what + ' works only in Apps Script (the Google Sheet backup runs there).'); } });

// everything the server code sees as "global" for one request
function makeGlobals(st, page) {
  const props = makeProperties(st), cache = makeCache(st), lock = makeLock(st);
  return {
    PropertiesService: { getScriptProperties: () => props, getUserProperties: () => props, getDocumentProperties: () => props },
    CacheService: { getScriptCache: () => cache, getUserCache: () => cache, getDocumentCache: () => cache },
    LockService: { getScriptLock: () => lock, getDocumentLock: () => lock, getUserLock: () => lock },
    Utilities: Utilities, UrlFetchApp: UrlFetchApp,
    Session: { getScriptTimeZone: () => TZ, getActiveUser: () => ({ getEmail: () => '' }), getEffectiveUser: () => ({ getEmail: () => '' }) },
    ScriptApp: { getService: () => ({ getUrl: () => st.meta.url || '' }), getProjectTriggers: () => [], AuthMode: {}, WeekDay: {},
      newTrigger: notHere('A trigger'), deleteTrigger: notHere('A trigger') },
    HtmlService: { createHtmlOutputFromFile: name => ({ getContent: () => String(name) === 'App' ? page.bridged : '' }), createHtmlOutput: notHere('HtmlService') },
    SpreadsheetApp: notHere('A Google Sheet'), DriveApp: notHere('Google Drive'), MailApp: notHere('Mail'), ContentService: notHere('ContentService'),
    Logger: { log: () => {} },
    console: console,
  };
}
module.exports = { newState, boot, flush, forceUnlock, makeGlobals, rpc, conf, Utilities, TZ };
