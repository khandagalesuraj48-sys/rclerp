/* =====================================================================
 * RCL FLEET ERP – RUN THE APP ON SUPABASE
 * Script property DATA_SOURCE = supabase  → the app reads and writes Supabase (main database).
 * Script property DATA_SOURCE = sheet (or empty) → the app works on this Google Sheet as before.
 *
 * How: every tab the app uses is given to the app as a "sheet" that lives in Supabase. The app's own logic
 * (stock, balances, Log Book, reports) stays exactly the same. Within one save everything is kept in memory and
 * written to Supabase together at the end – if the save fails, nothing is written (all or nothing).
 * The backup Google Sheet (SupabaseSync.gs) keeps a copy of Supabase automatically.
 * ===================================================================== */
// switch, SS_(), sbFlush_(), sbDiscard_() live in WebApp.gs (they work without this file when the app runs on the Sheet)
const SB_ID_HEADER_ = { diesel_inward: 'Inward ID', diesel_transfer: 'Transfer ID', diesel_issue: 'Issue ID', tank_check: 'Check ID', activity_log: 'Log ID', boq: 'BOQ ID', bills: 'Bill ID', payments: 'Payment ID', debit_notes: 'Note ID', compliance_history: 'History ID', breakdowns: 'Breakdown ID', breakdown_reports: 'Report ID' };
// tables read together in one go (they are nearly always needed together)
const SB_GROUP_ = ['master', 'diesel_inward', 'diesel_transfer', 'diesel_issue', 'log_book', 'tank_check'];

function SbBook_() { this.sheets = {}; }
SbBook_.prototype.def_ = function (name) { return SB_TABLES_.find(d => d.tab === name) || null; };
SbBook_.prototype.getSheetByName = function (name) {
  const d = this.def_(name); if (!d) return null;
  return this.sheets[d.table] = this.sheets[d.table] || new SbSheet_(this, d);
};
SbBook_.prototype.insertSheet = function (name) { return this.getSheetByName(name); };
SbBook_.prototype.getSheets = function () { return SB_TABLES_.map(d => this.getSheetByName(d.tab)); };
SbBook_.prototype.getSpreadsheetTimeZone = function () { return 'Asia/Kolkata'; };
SbBook_.prototype.getId = function () { return 'supabase'; };
SbBook_.prototype.toast = function () {};
// read several tables at once (parallel calls)
SbBook_.prototype.loadMany = function (tables) {
  const need = tables.map(t => this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t)))).filter(s => !s.loaded);
  if (!need.length) return;
  // fast path: the same tables were read a moment ago and nothing has changed since (same data version) –
  // take them from the script cache instead of asking Supabase. Saves never use this: they always read fresh.
  const useCache = SB_DEPTH_ === 0 && tables === SB_GROUP_;
  const ck = useCache ? sbGroupKey_() : '';
  if (useCache) {
    const snap = sbCacheGet_(ck);
    if (snap) { need.forEach(s => s.fill(snap[s.def.table] || [])); return; }
  }
  const c = sbConf_();
  const req = t => ({ url: c.url + '/rest/v1/' + t + '?select=*&order=id.asc', method: 'get', muteHttpExceptions: true, headers: { apikey: c.key, Range: '0-999', 'Range-Unit': 'items' } });
  const res = UrlFetchApp.fetchAll(need.map(s => req(s.def.table)));
  const keep = {};
  need.forEach((s, i) => {
    const r = res[i];
    if (r.getResponseCode() >= 300) throw new Error('Supabase read ' + s.def.table + ' → ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    let rows = JSON.parse(r.getContentText() || '[]');
    if (rows.length === 1000) rows = rows.concat(sbAllRows_(s.def.table).slice(1000)); // more than 1000: read the rest page by page
    s.fill(rows);
    if (useCache) keep[s.def.table] = rows;
  });
  if (useCache && need.length === SB_GROUP_.length) sbCachePut_(ck, keep);
};
/* ---------- fast cache of the main tables, tagged with the data version ----------
 * Every save changes the version (bump_), so a cached copy is used only while nothing has changed. */
function sbGroupKey_() { const v = getVersions_(); return 'SBG_' + v.master + '_' + v.stock + '_' + v.log; }
function sbCacheGet_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get(key) || 0); if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push(key + '_' + i);
    const got = cache.getAll(keys);
    if (keys.some(k => !(k in got))) return null;
    return JSON.parse(keys.map(k => got[k]).join(''));
  } catch (e) { return null; }
}
function sbCachePut_(key, obj) {
  try {
    const text = JSON.stringify(obj), size = 40000; // characters per piece (the cache takes up to 100 KB a piece)
    if (text.length > 4000000) return;               // very large data: read from Supabase each time
    const o = {}, n = Math.ceil(text.length / size);
    for (let i = 0; i < n; i++) o[key + '_' + i] = text.slice(i * size, (i + 1) * size);
    const cache = CacheService.getScriptCache();
    cache.putAll(o, 21600);
    cache.put(key, String(n), 21600);                // written last: a copy is used only when complete
  } catch (e) { /* no cache – still correct, only slower */ }
}
SbBook_.prototype.flush = function () {
  const c = sbConf_(), calls = [], after = [];
  Object.keys(this.sheets).forEach(t => {
    const s = this.sheets[t], w = s.pending();
    if (w.upserts.length) for (let i = 0; i < w.upserts.length; i += 500) calls.push({ url: c.url + '/rest/v1/' + t + '?on_conflict=id', method: 'post', muteHttpExceptions: true,
      headers: { apikey: c.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, payload: JSON.stringify(w.upserts.slice(i, i + 500)) });
    if (w.deletes.length) for (let i = 0; i < w.deletes.length; i += 100) calls.push({ url: c.url + '/rest/v1/' + t + '?id=in.(' + w.deletes.slice(i, i + 100).map(id => '"' + String(id).replace(/"/g, '\\"') + '"').map(encodeURIComponent).join(',') + ')',
      method: 'delete', muteHttpExceptions: true, headers: { apikey: c.key, Prefer: 'return=minimal' } });
    after.push(s);
  });
  if (!calls.length) return;
  /* One save = ONE database transaction (function web_write, step-3 SQL): everything of this save is written, or nothing.
   * Where that function is not installed, the save is written the old way – one call per table (if one of them fails,
   * the others stay written). */
  let done = false;
  if (!(typeof __writeMode === 'function' && __writeMode() === 'old')) {
    const p = [];
    Object.keys(this.sheets).forEach(t => { const w = this.sheets[t].pending(); if (w.upserts.length || w.deletes.length) p.push({ table: t, upserts: w.upserts, deletes: w.deletes.map(String) }); });
    const r = UrlFetchApp.fetch(c.url + '/rest/v1/rpc/web_write', { method: 'post', muteHttpExceptions: true, headers: { apikey: c.key, 'Content-Type': 'application/json' }, payload: JSON.stringify({ p: p }) });
    const code = r.getResponseCode();
    if (code >= 200 && code < 300) done = true;
    else if (code === 404 && /web_write|PGRST202/.test(r.getContentText())) { if (typeof __writeMode === 'function') __writeMode('old'); }   // not installed: the old way
    else { SB_BOOK_ = null; throw new Error('Could not save to Supabase: ' + code + ' ' + r.getContentText().slice(0, 200)); }
  }
  if (!done) {
    const res = UrlFetchApp.fetchAll(calls);
    const bad = res.map((r, i) => ({ r: r, i: i })).filter(x => x.r.getResponseCode() >= 300);
    if (bad.length) { SB_BOOK_ = null; throw new Error('Could not save to Supabase: ' + bad[0].r.getResponseCode() + ' ' + bad[0].r.getContentText().slice(0, 200)); }
  }
  after.forEach(s => s.saved());
  // anything written makes the fast cache out of date at once (also for writes that do not come through the app screens)
  const g = { master: 'master', diesel_inward: 'stock', diesel_transfer: 'stock', diesel_issue: 'stock', log_book: 'log', tank_check: 'log' };
  const groups = [...new Set(calls.map(q => g[q.url.split('/rest/v1/')[1].split('?')[0]]).filter(Boolean))];
  if (groups.length && typeof bump_ === 'function') bump_(groups);
};

function SbSheet_(book, def) {
  this.book = book; this.def = def; this.loaded = false;
  this.idh = SB_ID_HEADER_[def.table] || null;
  this.hdr = (this.idh ? [this.idh] : []).concat(def.cols.map(x => x[0]));
  this.type = {}; def.cols.forEach(x => { this.type[x[0]] = x[2]; });
  this.data = []; this.ids = []; this.dirty = new Set(); this.gone = []; this.appended = [];
}
SbSheet_.prototype.load_ = function () {
  if (this.loaded) return;
  if (SB_GROUP_.indexOf(this.def.table) > -1) this.book.loadMany(SB_GROUP_); else this.fill(sbAllRows_(this.def.table));
};
// Supabase rows → sheet rows (dates as Date, numbers as numbers, empty as '')
SbSheet_.prototype.fill = function (rows) {
  const toCell = (v, t) => {
    if (v === null || v === undefined) return '';
    if (t === 'date') return new Date(String(v).slice(0, 10) + 'T00:00:00+05:30');
    if (t === 'timestamptz') { const d = new Date(v); return isNaN(d) ? '' : d; }
    if (t === 'numeric') return Number(v);
    return v;
  };
  this.data = rows.map(r => this.hdr.map(h => h === this.idh ? r.id : toCell(r[(this.def.cols.find(x => x[0] === h) || [])[1]], this.type[h])));
  this.ids = rows.map(r => r.id);
  // the columns the database really has (from the rows it sent). A column the app knows but the database does not have yet –
  // its SQL step was not run – is left out of every save, so nothing breaks; it starts to be saved once the SQL is run.
  if (rows.length) this.dbCols = Object.keys(rows[0]);
  // rows added before the table was read (e.g. an Activity Log line) stay
  this.appended.forEach(row => { this.data.push(row); this.ids.push(null); });
  this.appended = [];
  this.loaded = true;
};
SbSheet_.prototype.rowId_ = function (row) {
  if (this.idh) return String(row[0] === undefined ? '' : row[0]).trim();
  const o = {}; this.hdr.forEach((h, i) => { o[h] = row[i]; });
  return this.def.key(o);
};
SbSheet_.prototype.toRecord_ = function (row) {
  const o = { id: this.rowId_(row) };
  this.def.cols.forEach(x => { if (this.dbCols && this.dbCols.indexOf(x[1]) === -1) return; const i = this.hdr.indexOf(x[0]); o[x[1]] = sbVal_(row[i], x[2]); });
  return o;
};
SbSheet_.prototype.pending = function () {
  const up = [], del = this.gone.slice();
  const rows = this.loaded ? [...this.dirty] : this.appended;
  rows.forEach(row => {
    const rec = this.toRecord_(row);
    if (!rec.id) return;
    const k = this.loaded ? this.data.indexOf(row) : -1, old = k > -1 ? this.ids[k] : null;
    if (old && old !== rec.id) del.push(old); // the row's key changed (e.g. Machinery Number in Master)
    up.push(rec);
  });
  return { upserts: up, deletes: [...new Set(del)] };
};
SbSheet_.prototype.saved = function () {
  if (this.loaded) this.data.forEach((row, i) => { if (this.dirty.has(row)) this.ids[i] = this.rowId_(row); });
  this.dirty.clear(); this.gone = []; if (!this.loaded) this.appended = [];
};
SbSheet_.prototype.getName = function () { return this.def.tab; };
SbSheet_.prototype.getLastRow = function () { this.load_(); return this.data.length + 1; };
SbSheet_.prototype.getLastColumn = function () { return this.hdr.length; };
SbSheet_.prototype.getMaxColumns = function () { return this.hdr.length; };
SbSheet_.prototype.appendRow = function (row) {
  const r = this.hdr.map((h, i) => (row[i] === undefined ? '' : row[i]));
  if (this.loaded) { this.data.push(r); this.ids.push(null); this.dirty.add(r); } else this.appended.push(r);
};
SbSheet_.prototype.deleteRow = function (n) {
  this.load_();
  const k = n - 2; if (k < 0 || k >= this.data.length) return;
  const row = this.data[k], id = this.ids[k] || this.rowId_(row);
  if (id) this.gone.push(id);
  this.dirty.delete(row); this.data.splice(k, 1); this.ids.splice(k, 1);
};
SbSheet_.prototype.getRange = function (r, c, nr, nc) {
  const s = this; nr = nr || 1; nc = nc || 1;
  const same = (a, b) => (a instanceof Date && b instanceof Date) ? a.getTime() === b.getTime() : String(a === undefined ? '' : a) === String(b === undefined ? '' : b);
  const range = {
    getValues() { s.load_(); const o = []; for (let i = 0; i < nr; i++) { const row = r + i === 1 ? s.hdr : (s.data[r + i - 2] || []); const v = []; for (let j = 0; j < nc; j++) v.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(v); } return o; },
    setValues(v) {
      s.load_();
      v.forEach((vals, i) => {
        const rr = r + i; if (rr === 1) return;          // header row: the columns already exist in Supabase
        while (s.data.length < rr - 1) { const blank = s.hdr.map(() => ''); s.data.push(blank); s.ids.push(null); }
        const row = s.data[rr - 2];
        vals.forEach((x, j) => { const ci = c - 1 + j; if (ci < s.hdr.length && !same(row[ci], x)) { row[ci] = x; s.dirty.add(row); } });
      });
      return range;
    },
    setValue(x) { return range.setValues([[x]]); },
    setNumberFormat() { return range; }, setFontWeight() { return range; }, setBackground() { return range; }, setDataValidation() { return range; }, setFontColor() { return range; },
  };
  return range;
};
SbSheet_.prototype.setFrozenRows = function () {};
SbSheet_.prototype.protect = function () { return { setDescription() {}, addEditor() {}, removeEditors() {}, getEditors() { return []; }, canDomainEdit() { return false; } }; };

/* ---------- switch the app to Supabase (run from the editor) ---------- */
function useSupabase() {
  sbOwnerOnly_();
  if (sbDataOn_()) { Logger.log('The app already runs on Supabase – nothing to do (running this again is not needed).'); return; }
  testSupabaseConnection();
  migrateToSupabase();                       // last copy of the Google Sheet into Supabase
  PropertiesService.getScriptProperties().setProperty('DATA_SOURCE', 'supabase');
  CacheService.getScriptCache().remove('USERS_LIST');
  Logger.log('The app now runs on Supabase. The Google Sheet is no longer changed by the app; the backup Sheet copies Supabase.');
}
/* ---------- go back to the Google Sheet (only right after switching – later entries are only in Supabase) ---------- */
function useGoogleSheet() {
  sbOwnerOnly_();
  PropertiesService.getScriptProperties().setProperty('DATA_SOURCE', 'sheet');
  CacheService.getScriptCache().remove('USERS_LIST');
  Logger.log('The app runs on the Google Sheet again.');
}

/* ---------- machines typed in the OLD Google Sheet after the switch ----------
 * The app reads Supabase, so a machine added in the old Sheet's Master tab does not show in the app.
 * Run this once to bring such machines into Supabase. It only ADDS machines that Supabase does not have yet –
 * it never changes or removes a machine that is already there. */
function copyNewMachinesFromSheet() {
  sbOwnerOnly_();
  const def = SB_TABLES_.find(d => d.table === 'master');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.tab);
  if (!sh || sh.getLastRow() < 2) { Logger.log('The Master tab of the Google Sheet is empty.'); return; }
  const all = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const hdr = all[0].map(h => sbStr_(h));
  const have = {}; sbAllRows_('master').forEach(r => { have[String(r.id).toUpperCase().replace(/\s+/g, '')] = true; });
  const add = [];
  all.slice(1).forEach(line => {
    const r = {}; hdr.forEach((h, i) => { r[h] = line[i]; });
    const id = def.key(r); if (!id) return;
    const k = id.toUpperCase().replace(/\s+/g, '');
    if (have[k]) return; have[k] = true;
    const o = { id: id }; def.cols.forEach(c => { const i = hdr.indexOf(c[0]); o[c[1]] = i > -1 ? sbVal_(line[i], c[2]) : null; });
    if (!o.status) o.status = 'Active';
    add.push(o);
  });
  if (!add.length) { Logger.log('Nothing to copy – every machine of the Sheet is already in Supabase.'); return; }
  sbFetch_('POST', '/rest/v1/master?on_conflict=id', add, { Prefer: 'resolution=ignore-duplicates,return=minimal' });
  if (typeof bump_ === 'function') bump_(['master']);   // open apps refresh their machine lists
  Logger.log('Added to Supabase: ' + add.map(x => x.id).join(', '));
}
