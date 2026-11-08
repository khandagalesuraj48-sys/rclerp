const fs = require('fs'), vm = require('vm');
const P = require('path').join(__dirname, '..', 'app') + '/';
const src = ['SupabaseSync.gs', 'SupabaseData.gs', 'Code.gs'].map(f => fs.readFileSync(P + f, 'utf8')).join('\n;\n');
const props = { DATA_SOURCE: 'supabase', SUPABASE_URL: 'x', SUPABASE_SECRET_KEY: 'k' };
const cache = {};
const pad = n => String(n).padStart(2, '0');
function fmtDate(d, tz, f) {
  const t = new Date(d.getTime() + 330 * 60000); // IST
  const Y = t.getUTCFullYear(), M = pad(t.getUTCMonth() + 1), D = pad(t.getUTCDate()), h = pad(t.getUTCHours()), m = pad(t.getUTCMinutes()), s = pad(t.getUTCSeconds());
  return f.replace('yyyy', Y).replace('MM', M).replace('dd', D).replace('HH', h).replace('mm', m).replace('ss', s);
}
const ctx = {
  console, JSON, Math, Date, Object, Array, String, Number, Set, Map, Error, isFinite, isNaN, parseFloat, parseInt, Proxy, Promise, RegExp, Infinity,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => props, setProperties: o => { Object.assign(props, o); } }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }, getAll: ks => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; }, putAll: o => Object.assign(cache, o), removeAll: ks => ks.forEach(k => delete cache[k]) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {}, hasLock() { return true; } }) },
  Utilities: { formatDate: fmtDate, getUuid: () => 'uuid-' + Math.random().toString(16).slice(2), sleep() {}, DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
    computeDigest: (a, s) => { const h = require('crypto').createHash('sha256').update(String(s)).digest(); return [...h].map(b => b > 127 ? b - 256 : b); } },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata', getActiveUser: () => ({ getEmail: () => 't@x' }), getEffectiveUser: () => ({ getEmail: () => 't@x' }) },
  ScriptApp: { getService: () => ({ getUrl: () => '' }), getProjectTriggers: () => [] },
  SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('sheet mode not mocked'); } },
  UrlFetchApp: { fetch() { throw new Error('no network'); }, fetchAll() { throw new Error('no network'); } },
  Logger: { log() {} }, HtmlService: {}, ContentService: {},
};
vm.createContext(ctx);
vm.runInContext(src + `
;SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) s.fill([]); }); };
SbSheet_.prototype.load_ = function () { if (!this.loaded) this.fill([]); };
SbBook_.prototype.flush = function () {
  // (update-152) the entry guard runs as before a real write; refused = nothing of the save stays (as the database's one transaction)
  try { if (typeof entryGuard_ === 'function') entryGuard_(this); }
  catch (e) { Object.keys(this.sheets).forEach(t => { const s = this.sheets[t];
      s.orig.forEach((o, r) => { o.forEach((v, i) => { r[i] = v; }); });
      const keep = s.data.map((r, i) => !(s.dirty.has(r) && !s.ids[i])); s.data = s.data.filter((r, i) => keep[i]); s.ids = s.ids.filter((x, i) => keep[i]);
      s.goneRows.forEach(r => { s.data.push(r); s.ids.push(s.rowId_(r)); });
      s.dirty.clear(); s.orig.clear(); s.goneRows = []; s.gone = []; s.appended = []; }); TABLE_MEMO_ = {}; throw e; }
  Object.keys(this.sheets).forEach(t => this.sheets[t].saved()); };
sbDiscard_ = function () {};
USER_DATE_RULE_ON_ = false;      // (update-187) the users' date rule is tested on its own (test "update-187"); the tests of before keep their fixed dates
this.T = { saveMaster_, saveBoq_, getBoqs_, saveLogRowsInner_, saveLogRows_, getLogBookList_, logPrintExtra_, billMachineCalc_, verifyBills_, getLogRowPrefill_, getLogEntry_, updateLogRow_, getLogEditData_, saveLogBulk_, importLogBook_, findMachine_, getMaster_, boqRateFor_, itemQtyOf_, logItemWork_, boqItemsOn_, billInit_, getVendors_, saveVendor_, today_, logDashboard_, deleteBoq_,
  reset: () => { TABLE_MEMO_ = {}; ITEM_NOS_ = null; ITEM_ON_ = {}; /* (update-152) each call of a test is one request: what it wrote outside a save counts as saved, as before */ if (SB_BOOK_) Object.keys(SB_BOOK_.sheets).forEach(t => { if (SB_BOOK_.sheets[t].loaded) SB_BOOK_.sheets[t].saved(); }); }, SS: () => SS_(), setActor: a => { ACTOR_ = a; } };
`, ctx);
module.exports = { T: ctx.T, ctx };
