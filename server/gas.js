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
    if (r.code === 404 && /^web_(count|uncount|write)$/.test(name)) throw new Error('404 ' + name + ' is not installed (sql/supabase_step3_safety.sql)');
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
  return { props: {}, cache: {}, left: {}, puts: new Map(), dels: new Set(), propQueue: {}, lockDepth: 0, fresh: false, tables: [],
    holder: crypto.randomUUID(), stamp: '', meta: meta || {}, calls: 0 };
}
// start of a request: settings + the cache keys this request will surely ask for, in one call
/* THE HEARTBEAT WITHOUT THE DATABASE (04-10-2026: "100 users on every site, no load, no hang").
 * Every open page asks "anything new?" every 2 seconds. Until now each of these asked the database (settings, session,
 * stamp) – 100 open pages = 50 questions a second to the database, all day, for nothing most of the time.
 * Now the answer to the heartbeat is taken from this server's memory when it is fresh enough:
 *   - the shared part (settings with the data versions, the users list, the stamp): at most 1 second old;
 *   - the session of the asking sign-in: at most 20 seconds old (its remaining time is counted down, so it is still
 *     renewed in time; a user switched off by the Admin is stopped by the users list, i.e. within a second).
 * So a change is seen by the others at most one second later than before, and the database is asked about once a second
 * per server instead of once per page. Only the heartbeat ("light") uses this; every real action reads the database. */
const BEAT = { at: 0, props: null, stamp: '', tables: null, shared: {}, sess: new Map() };
function boot(st, keys, light) {
  const now = Date.now(); keys = keys || [];
  if (light && process.env.RCL_WARM !== 'off' && BEAT.props && now - BEAT.at < 1000) {
    const rec = k => /^S_/.test(k) ? BEAT.sess.get(k) : BEAT.shared[k], maxAge = k => /^S_/.test(k) ? 20000 : 1000;
    if (keys.every(k => { const m = rec(k); return m && now - m.at <= maxAge(k); })) {
      st.props = Object.assign({}, BEAT.props); st.left = {}; st.cache = {};
      keys.forEach(k => { const m = rec(k); st.cache[k] = m.value; if (m.left !== undefined && m.left !== null) st.left[k] = Math.max(0, Number(m.left) - (now - m.at) / 1000); });
      st.stamp = BEAT.stamp; st.tables = BEAT.tables || OLD_TABLES; st.light = true;      // (no table is read by a heartbeat; the tables' memory is left alone)
      return;
    }
  }
  const b = rpc('web_boot', { p_keys: keys }) || {};
  st.props = b.props || {}; st.left = b.left || {};
  st.cache = {}; keys.forEach(k => { st.cache[k] = null; });
  Object.keys(b.cache || {}).forEach(k => { st.cache[k] = b.cache[k]; });
  useStamp(st, b);
  // remembered for the heartbeats of the next second (and this sign-in's session for the next 20 seconds)
  BEAT.at = now; BEAT.props = Object.assign({}, st.props); BEAT.stamp = st.stamp; BEAT.tables = st.tables;
  keys.forEach(k => { const m = { value: st.cache[k], left: st.left[k], at: now }; if (/^S_/.test(k)) BEAT.sess.set(k, m); else BEAT.shared[k] = m; });
  if (BEAT.sess.size > 4000) BEAT.sess.forEach((m, k) => { if (now - m.at > 60000) BEAT.sess.delete(k); });
}
// the stamp of the data as the database has it now, and the tables it covers; a different stamp empties the memory copy
function useStamp(st, b) {
  st.stamp = String((b && b.stamp) || '');
  st.tables = b && Array.isArray(b.tables) ? b.tables : OLD_TABLES;     // an older step-2 SQL covers the six main tables
  // no stamp (nothing could be read about the last change) → the copy in memory is not trusted at all
  if (!st.stamp || LOCAL.stamp !== st.stamp) { LOCAL.map.clear(); LOCAL.stamp = st.stamp; }
}
const OLD_TABLES = ['master', 'diesel_inward', 'diesel_transfer', 'diesel_issue', 'log_book', 'tank_check'];
// end of a request: what is still waiting (cache entries, data versions) is written in one call
function flush(st) {
  const put = [...st.puts.entries()].map(([k, x]) => ({ key: k, value: x.value, ttl: x.ttl })), del = [...st.dels];
  const props = Object.keys(st.propQueue).length ? st.propQueue : null;
  if (props) BEAT.at = 0;      // this server has just changed the settings / data versions: its heartbeats must not answer from before that
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
  const remove = k => { k = String(k); if (/^S_/.test(k)) BEAT.sess.delete(k);      // a session that is ended is forgotten by the heartbeat's memory at once
    if (isVersionKey(k) || k === 'SB_INFO') return; if (isLocalKey(k)) { LOCAL.map.delete(k); return; } st.cache[k] = null; st.puts.delete(k); st.dels.add(k); };
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
        if (r && r.ok) {
          st.lockDepth = 1; st.props = Object.assign({}, r.props || {}, st.propQueue);      // settings as they are NOW
          // the stamp as it is NOW, with the lock held: the memory copy is used only if nothing changed; an older SQL
          // (no stamp with the lock) → a save reads everything fresh, as before
          if (r.stamp !== undefined) useStamp(st, r); else st.fresh = true;
          return;
        }
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
// India has one fixed time (+5:30, no summer time), so its dates are worked out by plain arithmetic – this is called
// for every date cell of every row, so it has to be quick. Any other time zone: one formatter per zone, kept.
const FIXED_OFFSET = { 'Asia/Kolkata': 330, 'Asia/Calcutta': 330, 'IST': 330, 'UTC': 0, 'GMT': 0, 'Etc/UTC': 0, 'Etc/GMT': 0 };
const ZONE_FMT = new Map();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const p2 = n => (n < 10 ? '0' : '') + n;
function dateParts(ms, tz) {
  const off = FIXED_OFFSET[tz];
  if (off !== undefined) { const t = new Date(ms + off * 60000); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds(), t.getUTCDay()]; }
  let f = ZONE_FMT.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' }); ZONE_FMT.set(tz, f); }
  const o = {}; f.formatToParts(new Date(ms)).forEach(x => { o[x.type] = x.value; });
  return [Number(o.year), Number(o.month), Number(o.day), Number(o.hour) % 24, Number(o.minute), Number(o.second), DAY.indexOf(o.weekday)];
}
function formatDate(date, tz, fmt) {
  if (!isDate(date)) throw new Error('formatDate: not a date');
  const ms = date.getTime(); if (isNaN(ms)) throw new Error('formatDate: not a date');
  const [Y, M, D, h, mi, s, wd] = dateParts(ms, tz || TZ);
  if (fmt === 'yyyy-MM-dd') return Y + '-' + p2(M) + '-' + p2(D);                 // by far the most used
  if (fmt === 'HH:mm') return p2(h) + ':' + p2(mi);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const map = { yyyy: String(Y), yy: String(Y).slice(2), MMM: MON[M - 1], MM: p2(M), M: String(M), dd: p2(D), d: String(D),
    HH: p2(h), H: String(h), hh: p2(h12), h: String(h12), mm: p2(mi), ss: p2(s), a: h < 12 ? 'AM' : 'PM', EEE: DAY[wd] };
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
/* The app's tables are read whole by nearly every request. Their answers from the database are kept in this server's
 * memory and used again ONLY while the "stamp" (newest change in exactly the tables it covers – see web_stamp in the
 * step-2 SQL) is the same as when they were kept. The stamp is read from the database at the start of every request,
 * and again with the lock when a request saves – so a save never works on old data. */
const TABLE_GET = /\/rest\/v1\/([a-z_]+)\?select=\*&order=id\.asc$/;
function makeFetch(st) {
  const keyOf = q => { if (q.method !== 'GET') return ''; const m = TABLE_GET.exec(q.url); return m && st.tables.indexOf(m[1]) > -1 ? 'GET|' + q.url + '|' + String((q.headers || {}).Range || '') : ''; };
  const all = qs => {
    const out = new Array(qs.length), ask = [], at = [];
    qs.forEach((q, i) => {
      const k = st.stamp && !st.fresh ? keyOf(q) : '';
      const hit = k ? LOCAL.map.get(k) : null;
      if (hit) out[i] = hit.value; else { ask.push(q); at.push(i); }
    });
    if (ask.length) fetchAllSync(ask).forEach((r, n) => {
      out[at[n]] = r;
      const k = st.stamp && !st.fresh ? keyOf(ask[n]) : '';
      if (k && !r.error && r.code >= 200 && r.code < 300) LOCAL.map.set(k, { value: r, exp: Date.now() + 6 * 3600 * 1000 });
    });
    return out;
  };
  return {
    fetch: (url, o) => { const q = toReq(url, o); return toRes(q, all([q])[0]); },
    fetchAll: reqs => { const qs = [...reqs].map(x => toReq(x.url, x)); const rs = all(qs); return qs.map((q, i) => toRes(q, rs[i])); },
  };
}

/* ---------- THE TABLES IN THIS SERVER'S MEMORY, KEPT UP TO DATE BY THE CHANGES ONLY (04-10-2026: "3,000 users") ----------
 * Until now a table was read WHOLE from the database whenever anything in any table had changed (the stamp), and its
 * text was parsed again for every request. With many people saving, the stamp changes all the time, so every request of
 * every user read every table – the app would slow down with the number of users AND with the size of the data.
 * Now each table is kept here as rows, in the order of its ids, and a request brings it up to date with the CHANGES only:
 *   - the stamp is the same as when the table was last brought up to date → nothing is asked at all;
 *   - otherwise: the rows changed since then (updated_at) and the ids deleted since then (deleted_rows) – small answers;
 *   - a table this server does not have yet: read whole once, page by page by id (no row can be skipped or doubled).
 * Safe-guards: changes are asked from 15 s (after a first read: its duration + 15 s) BEFORE the newest change seen, so a
 * save that was still being written is not missed; every table is read whole again after 15 minutes; a change list that
 * is too long (1,000) reads the table whole. Every server has its own copy and each brings itself up to date this way,
 * so two servers agree. RCL_WARM=off switches all of this off (the old way). The Activity Log is not kept (it only grows). */
const WARM = { tables: new Map(), skip: new Set(['activity_log', 'deleted_rows']), stats: { whole: 0, changes: 0, kept: 0 } };
const WARM_OVERLAP = 15000, WARM_REFRESH = 15 * 60 * 1000, WARM_MAX = 250000;
const warmPos = (ids, id) => { let lo = 0, hi = ids.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ids[m] < id) lo = m + 1; else hi = m; } return lo; };
const isoBack = (iso, ms) => new Date((Date.parse(iso) || 0) - ms).toISOString();
function makeWarm(st) {
  if (process.env.RCL_WARM === 'off') return null;
  const get = (path, range) => { const c = conf(); return { url: c.url + path, method: 'GET', headers: Object.assign({ apikey: c.key }, range ? { Range: range, 'Range-Unit': 'items' } : {}) }; };
  // the time on the database's side when it answered (its "Date" header) – "what changed since" is asked from that time, less the overlap
  let answered = 0;
  const ask = reqs => fetchAllSync(reqs).map((r, i) => {
    const hd = r.headers && (r.headers.date || r.headers.Date), ht = hd ? Date.parse(hd) : 0; if (ht > answered) answered = ht;
    const what = (/\/rest\/v1\/([a-z_]+)/.exec(reqs[i].url) || [])[1] || 'table';
    if (r.error) throw new Error('Could not reach the database (' + what + '): ' + r.error);
    if (r.code >= 300) throw new Error('Supabase read ' + what + ' → ' + r.code + ': ' + String(r.text || '').slice(0, 200));
    return r.text ? JSON.parse(r.text) : [];
  });
  const newest = (rows, key, from) => { let best = from || '', bt = Date.parse(best) || 0; rows.forEach(r => { const t = Date.parse(r[key]); if (t > bt) { bt = t; best = r[key]; } }); return best; };
  // every row of these tables, each read page by page in the order of its ids
  const whole = tables => {
    const t0 = Date.now();
    const first = ask([get('/rest/v1/deleted_rows?select=deleted_at&order=seq.desc', '0-0')].concat(tables.map(t => get('/rest/v1/' + t + '?select=*&order=id.asc', '0-999'))));
    const delSeen = (first[0][0] && first[0][0].deleted_at) || '';
    tables.forEach((t, i) => {
      let rows = first[i + 1], page = rows;
      while (page.length === 1000 && rows.length < WARM_MAX) { page = ask([get('/rest/v1/' + t + '?select=*&order=id.asc&id=gt.' + encodeURIComponent(page[999].id), '0-999')])[0]; rows = rows.concat(page); }
      const byId = new Map(); rows.forEach(r => byId.set(String(r.id), r));              // (one row per id, whatever the pages said)
      const ids = [...byId.keys()].sort();
      WARM.stats.whole++;
      // "at" = when this copy was true, on the database's clock (its answer's time, to the second; without it: the newest change seen)
      WARM.tables.set(t, { ids: ids, list: ids.map(id => byId.get(id)), at: answered ? answered - 1000 : 0, seen: newest(rows, 'updated_at', '') || new Date(t0 - 600000).toISOString(), delSeen: delSeen || new Date(t0 - 600000).toISOString(),
        sync: st.stamp, loadedAt: Date.now(), slack: Date.now() - t0, big: rows.length >= WARM_MAX });
    });
  };
  const covered = t => st.tables.indexOf(t) > -1;
  return {
    stats: () => WARM.stats,
    load: (tables, together) => {
      const out = {}, cold = [], hot = [];
      // "together": tables that should be brought up to date in the same round trip IF this server already has them (never read whole for it)
      const want = tables.concat((together || []).filter(t => tables.indexOf(t) === -1 && WARM.tables.has(t)));
      want.forEach(t => {
        if (WARM.skip.has(t)) return;
        const s = WARM.tables.get(t);
        if (!s || s.big || Date.now() - s.loadedAt > WARM_REFRESH) cold.push(t);
        else if (st.stamp && !st.fresh && covered(t) && s.sync === st.stamp) WARM.stats.kept++;
        else hot.push(t);
      });
      if (cold.length) whole(cold);
      if (hot.length) {
        // since when: the time the copy was last true (database clock) less the overlap; the newest change seen is the fall-back
        const back = s => WARM_OVERLAP + s.slack;
        const since = t => { const s = WARM.tables.get(t); return s.at ? new Date(s.at - back(s)).toISOString() : isoBack(s.seen, back(s)); };
        const delSince = hot.map(t => { const s = WARM.tables.get(t); return s.at ? new Date(s.at - back(s)).toISOString() : isoBack(s.delSeen, back(s)); }).sort()[0];
        const delReq = after => get('/rest/v1/deleted_rows?select=seq,table_name,row_id,deleted_at&order=seq.asc&deleted_at=gt.' + encodeURIComponent(delSince) + '&table_name=in.(' + hot.join(',') + ')' + (after ? '&seq=gt.' + after : ''), '0-999');
        answered = 0;
        const res = ask(hot.map(t => get('/rest/v1/' + t + '?select=*&order=id.asc&updated_at=gt.' + encodeURIComponent(since(t)), '0-999')).concat([delReq(0)]));
        const now = answered ? answered - 1000 : 0;
        // the list of deleted ids can be long (a clean-up): it is read to its end, page by page – it never forces a whole table to be read
        let gone = res[hot.length], page = gone;
        while (page.length === 1000 && gone.length < 200000) { page = ask([delReq(page[999].seq)])[0]; gone = gone.concat(page); }
        const again = [];
        hot.forEach((t, i) => {
          const s = WARM.tables.get(t), rows = res[i];
          if (rows.length >= 1000) { again.push(t); return; }            // a thousand rows changed: the whole table is read instead
          gone.forEach(d => { if (d.table_name !== t) return; const id = String(d.row_id), p = warmPos(s.ids, id); if (s.ids[p] === id) { s.ids.splice(p, 1); s.list.splice(p, 1); } });
          rows.forEach(r => { const id = String(r.id), p = warmPos(s.ids, id); if (s.ids[p] === id) s.list[p] = r; else { s.ids.splice(p, 0, id); s.list.splice(p, 0, r); } });
          s.seen = newest(rows, 'updated_at', s.seen); s.delSeen = newest(gone, 'deleted_at', s.delSeen); s.at = now; s.sync = st.stamp; s.slack = 0;
          WARM.stats.changes++;
        });
        if (again.length) whole(again);
      }
      tables.forEach(t => { const s = WARM.tables.get(t); if (s && !WARM.skip.has(t)) out[t] = s.list; });
      return out;
    },
  };
}

const notHere = what => new Proxy(function () {}, { get: (t, p) => p === 'then' ? undefined : notHere(what), apply: () => { throw new Error(what + ' works only in Apps Script (the Google Sheet backup runs there).'); } });

// everything the server code sees as "global" for one request
function makeGlobals(st, page) {
  const props = makeProperties(st), cache = makeCache(st), lock = makeLock(st);
  return {
    PropertiesService: { getScriptProperties: () => props, getUserProperties: () => props, getDocumentProperties: () => props },
    CacheService: { getScriptCache: () => cache, getUserCache: () => cache, getDocumentCache: () => cache },
    LockService: { getScriptLock: () => lock, getDocumentLock: () => lock, getUserLock: () => lock },
    Utilities: Utilities, UrlFetchApp: makeFetch(st),
    Session: { getScriptTimeZone: () => TZ, getActiveUser: () => ({ getEmail: () => '' }), getEffectiveUser: () => ({ getEmail: () => '' }) },
    ScriptApp: { getService: () => ({ getUrl: () => st.meta.url || '' }), getProjectTriggers: () => [], AuthMode: {}, WeekDay: {},
      newTrigger: notHere('A trigger'), deleteTrigger: notHere('A trigger') },
    HtmlService: { createHtmlOutputFromFile: name => ({ getContent: () => String(name) === 'App' ? page.bridged : '' }), createHtmlOutput: notHere('HtmlService') },
    SpreadsheetApp: notHere('A Google Sheet'), DriveApp: notHere('Google Drive'), MailApp: notHere('Mail'), ContentService: notHere('ContentService'),
    Logger: { log: () => {} },
    console: console,
    __warm: makeWarm(st),       // the tables kept in this server's memory (see makeWarm)
  };
}
module.exports = { newState, boot, flush, forceUnlock, makeGlobals, rpc, conf, Utilities, TZ };
