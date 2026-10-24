// This file is text: the storage and Google Drive code that is added to the app's server code (see runtime.js).
module.exports = String.raw`
/* ================= (update-158, asked 24-10-2026) STORAGE, AND THE COPY OF THE FILES TO GOOGLE DRIVE =================
 * "super admin ani admin la he hi disaw ki supabase storage kiti aahe ki to bharley same google sheet kiti bharle kiti baki"
 * "baki sagle files photos attachment drive madhe organization madhe astil mhanje sagle ektr nasel ok as proper structure banaw"
 *
 * STORAGE (storageOf_): this site's database size (Supabase Pro: 8 GB a project), its files (100 GB for every project together),
 * the backup Sheet in use (Google: 1 crore cells), and the Google Drive copy. Green; yellow from 80 %; red from 90 %.
 * Needs step 1zf (web_usage); until then it says so.
 *
 * THE DRIVE COPY (driveBackup_): every photo, bill copy and attachment of this site, ONCE, into the Google Drive the Super Admin
 * connected (drive.js), in folders:
 *   RCL ERP – Files (backup) / <site> / Diesel Issue photos   / 2026 / 10 October / 05-10-2026 MH-15-AB-0002 DI-000123 / Dashboard 1.jpg
 *                                     / Diesel Inward bills    / 2026 / 10 October / 05-10-2026 IN-000012 <pump> / Bill copy 1.jpg
 *                                     / Log Book attachments   / 2026 / 10 October / 05-10-2026 MH-15-AB-0002 Day / <its name>
 *                                     / Bills / 2026 / RA-12 rev 1 – <vendor> / shortcuts to the files of its entries
 *                                     / Not linked to any entry / erp-files / 2026 / 10 October / <file>   (a file no entry has, a day old)
 * A file on two entries is copied once (into the first) and the other entry gets a SHORTCUT to it; a submitted bill's folder holds
 * shortcuts to the files of its Log Book as submitted. Every copy is checked: Drive's MD5 of what it received = the MD5 of the file
 * read here (and an attachment's SHA-256 = its name). Nothing is ever deleted or changed – here or in Drive. What is in Drive is
 * noted in backup_drive (step 1zf), so nothing is copied twice; another Google account starts its own whole copy.
 * When: with the backup – the nightly job, and the open pages (every 30 minutes; every 3 minutes while files are left), in pieces of
 * about half a minute; the Super Admin's "Copy files now". A copy in the middle goes on where it stopped (its notes – cursors,
 * counts, files to try again – in the table backup_drive_state of step 1zf, never in the settings: a note changed after every
 * file would make every server read the settings again, review of 25-10-2026).
 * (review 25-10-2026) A folder deleted in that Drive by hand: an entry's folder is made again and its files copied again; a
 * bigger folder (the site's, a kind's, a year's, a month's): the whole copy of the site is made again. A file that cannot be
 * copied (not in the store, not received whole) is tried again by itself – after an hour, 6 hours, then every day (one whose copy
 * reached Drive wrong: 3 times by itself – each try leaves that copy there – then with "Copy files now"); anything else (Google busy, the network, the access, a full Drive) stops the run and the next one goes on. */
const DRV_GB_ = 1073741824, DRV_LIMIT_DB_ = 8 * DRV_GB_, DRV_LIMIT_FILES_ = 100 * DRV_GB_;
const DRV_SQL_MSG_ = 'This needs one database step first: the Admin runs sql/supabase_step1zf_storage_drive.sql once in Supabase → SQL Editor, in every site.';
const DRV_KIND_ = { issue: 'Diesel Issue photos', inward: 'Diesel Inward bills', log: 'Log Book attachments', bills: 'Bills', loose: 'Not linked to any entry' };
const DRV_MONTHS_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DRV_FOLDER_ = 'application/vnd.google-apps.folder', DRV_SHORTCUT_ = 'application/vnd.google-apps.shortcut';
const drvJ_ = (v, d) => { try { const x = typeof v === 'string' ? JSON.parse(v || 'null') : v; return x === null || x === undefined ? d : x; } catch (e) { return d; } };
const drvNoSql_ = e => /PGRST20[25]|42P01|42883|does not exist|Could not find the (table|function)|→ 404/.test(String((e && e.message) || e));
const drvPct_ = (a, b) => b > 0 ? Math.round(a * 1000 / b) / 10 : 0;
const drvMonth_ = d => { const m = /^(\d{4})-(\d{2})/.exec(String(d || '')); return m ? [m[1], m[2] + ' ' + DRV_MONTHS_[Number(m[2]) - 1]] : ['No date', 'No date']; };
const drvDmy_ = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 10).split('-').reverse().join('-') : 'no date';
const drvName_ = s => clean_(s).replace(/[\u0000-\u001f]/g, ' ').slice(0, 150) || 'file';
const drvQ_ = v => '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';      // a value inside in.( ) / or( )

/* ---------- STORAGE ---------- */
// this site's database and files (asked once in 10 minutes)
function storageUsage_() {
  const C = CacheService.getScriptCache(), hit = drvJ_(C.get('STO_USAGE'), null);
  if (hit) return hit;
  let u = null, err = '';
  try { u = sbFetch_('POST', '/rest/v1/rpc/web_usage', {}); } catch (e) { err = drvNoSql_(e) ? DRV_SQL_MSG_ : String((e && e.message) || e).slice(0, 200); }
  if (!u) return { ok: false, error: err };
  const files = (Array.isArray(u.files) ? u.files : []).map(x => ({ bucket: str_(x.bucket), n: Number(x.n) || 0, bytes: Number(x.bytes) || 0 }));
  const out = { ok: true, db: Number(u.db) || 0, files: files, filesBytes: files.reduce((t, x) => t + x.bytes, 0), filesN: files.reduce((t, x) => t + x.n, 0), at: new Date().toISOString() };
  C.put('STO_USAGE', JSON.stringify(out), 600);
  return out;
}
// everything the Storage window shows for this site
function storageOf_() {
  const u = storageUsage_(), T = bkTarget_({}), cfg = drvJ_(__backupConfig(), {}), vols = bkSheets_(T, cfg.fallback), info = bkInfoOf_(T) || {};
  const act = vols[vols.length - 1] || null, cells = act ? (Number(info.sheetN) === Number(act.n) && info.cells ? Number(info.cells) : Number(act.cells) || 0) : 0;
  return { site: typeof __siteCode === 'function' ? __siteCode() : '',
    db: u.ok ? { bytes: u.db, limit: DRV_LIMIT_DB_, pct: drvPct_(u.db, DRV_LIMIT_DB_) } : null,
    files: u.ok ? { bytes: u.filesBytes, n: u.filesN, limit: DRV_LIMIT_FILES_, pct: drvPct_(u.filesBytes, DRV_LIMIT_FILES_), places: u.files } : null,
    error: u.ok ? '' : u.error, at: u.at || '',
    sheet: act ? { n: Number(act.n) || 1, sheets: vols.length, cells: cells, limit: BK_CELLS_, pct: drvPct_(cells, BK_CELLS_) } : null,
    drive: drvInfo_() };
}

/* ---------- THE GOOGLE DRIVE CONNECTION (kept at the first site) ---------- */
// { ok, sealed, root, acct } – the first site's own settings; another site asks the first site (runtime: __drvHome)
function drvAuth_() {
  const a = __siteIsHome() ? drvJ_(PropertiesService.getScriptProperties().getProperty('DRIVE_AUTH'), null) : drvJ_(__drvHome(), null);
  return a && a.sealed && a.root ? { ok: true, sealed: a.sealed, root: a.root, acct: a.acct || '', at: a.at || '', by: a.by || '' } : { ok: false };
}
// the Super Admin pressed "Connect Google Drive" (Portal): the address of Google's "Allow" page, good once for 15 minutes
function drvStart_(c) {
  if (!__siteIsHome()) throw new Error('Google Drive is connected at the first site only.');
  const cl = drvJ_(__drvClient(), {}); if (!cl.ok) throw new Error(cl.error || 'The copy to Google Drive is not set up yet.');
  const state = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('DRIVE_STATE', JSON.stringify({ h: hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, state)), exp: Date.now() + 900000, by: str_(c && c.by).slice(0, 120) }));
  return { url: __drvAuthUrl(state), redirect: cl.redirect };
}
// Google sent the account back (api/drive.js): the state checked (once – under a lock, two answers at the same moment cannot both
// pass), the account checked (DRIVE_ACCOUNT, when set), the access kept locked, the backup's own folder made
function drvOauth_(x) {
  x = x || {};
  if (!__siteIsHome()) throw new Error('Google Drive is connected at the first site only.');
  if (!__lockNamed('drive_oauth', 60)) throw new Error('Google Drive is being connected right now – wait a minute and look in the Portal (Sites → Storage).');
  try {
    const P = PropertiesService.getScriptProperties(), st = drvJ_(bkFresh_('DRIVE_STATE'), null);
    const h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str_(x.state)));
    if (!st || !st.h || st.h !== h || !(Number(st.exp) > Date.now())) throw new Error('This link to connect Google Drive is old or was used already – press "Connect Google Drive" in the Portal again.');
    P.deleteProperty('DRIVE_STATE');      // (good once)
    const cl = drvJ_(__drvClient(), {});
    const got = drvJ_(__drvExchange(str_(x.code)), {});
    if (!got.sealed) throw new Error(got.error || 'Google did not give the access.');
    const sealed = got.sealed;
    const ab = drvCall_(sealed, 'GET', '/drive/v3/about?fields=' + encodeURIComponent('user(emailAddress,displayName),storageQuota'));
    const acct = str_(ab && ab.user && ab.user.emailAddress).toLowerCase();
    if (cl.account && acct !== cl.account) throw new Error('This is not the company\'s Google account (' + (acct || 'unknown') + ') – sign in with ' + cl.account + ' and press Allow. Nothing was connected.');
    const was = drvJ_(P.getProperty('DRIVE_AUTH'), null);
    let root = was && was.root && was.acct === acct ? was.root : '';
    if (root && !drvAlive_(sealed, root)) root = '';
    if (!root) root = drvCall_(sealed, 'POST', '/drive/v3/files?fields=id', { name: 'RCL ERP – Files (backup)', mimeType: DRV_FOLDER_, appProperties: { rcl: 'root' },
      description: 'Copies of the photos, bill copies and attachments of RCL ERP, made by the app every night. Nothing here is deleted by the app.' }).id;
    const by = str_(st.by);
    P.setProperty('DRIVE_AUTH', JSON.stringify({ sealed: sealed, root: root, acct: acct, at: new Date().toISOString(), by: by }));
    CacheService.getScriptCache().remove('DRV_QUOTA'); CacheService.getScriptCache().remove('DRV_OFF');
    try { writeLog_({ email: by || 'super-admin', name: 'Super Admin (Portal)' }, 'Edit', 'Backup', 'Google Drive', 'Google Drive connected for the copy of the files: ' + (acct || 'the account') + (was && was.acct && was.acct !== acct ? ' (before: ' + was.acct + ' – the whole copy is made again there)' : ''), ''); if (typeof sbFlush_ === 'function') sbFlush_(); } catch (e) { /* the record is best effort */ }
    return { ok: true, acct: acct };
  } finally { __unlockNamed('drive_oauth'); }
}
// one Drive API call → its answer (an error says what Google said). ms: what the caller can still wait
function drvCall_(sealed, method, path, body, ms) {
  const r = drvJ_(__drvCall(sealed, method, path, body === undefined ? '' : JSON.stringify(body), Math.max(3000, Math.min(25000, Number(ms) || 25000))), {});
  if (r.error) throw new Error(/did not answer in time/.test(r.error) ? DRV_OUT_ : r.error);
  if (!(r.code >= 200 && r.code < 300)) {
    const j = drvJ_(r.text, {}), why = str_((j.error && (j.error.message || j.error.status)) || r.text).slice(0, 200);
    if (r.code === 403 && /storageQuotaExceeded|storage ?quota/i.test(r.text)) throw new Error('Google Drive is full – the files cannot be copied there. Make room or buy more Google storage for that account, then the copy goes on by itself.');
    const e = new Error('Google Drive (' + r.code + '): ' + why); e.code = r.code; if (r.code === 404) e.gone = true;      // (404: a folder deleted in Drive)
    throw e;
  }
  return drvJ_(r.text, {});
}
// a file or folder of the app is still there (not deleted, not in the bin)
function drvAlive_(sealed, id, ms) { try { const f = drvCall_(sealed, 'GET', '/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,trashed', undefined, ms); return !!(f && f.id && !f.trashed); } catch (e) { if (e.gone) return false; throw e; } }
// how full that Drive is (asked once in 10 minutes)
function drvQuota_() {
  const A = drvAuth_(); if (!A.ok) return null;
  const C = CacheService.getScriptCache(), hit = drvJ_(C.get('DRV_QUOTA'), null); if (hit && hit.root === A.root) return hit;
  let q = null; try { const ab = drvCall_(A.sealed, 'GET', '/drive/v3/about?fields=' + encodeURIComponent('user(emailAddress),storageQuota'), undefined, 10000); q = ab.storageQuota || {}; }
  catch (e) { return { root: A.root, acct: A.acct, error: String((e && e.message) || e).replace(DRV_OUT_, 'Google Drive did not answer in time.').slice(0, 200) }; }
  const limit = Number(q.limit) || 0, used = Number(q.usage) || 0;
  const out = { root: A.root, acct: A.acct, used: used, inDrive: Number(q.usageInDrive) || 0, limit: limit, pct: limit ? drvPct_(used, limit) : null, at: new Date().toISOString() };
  C.put('DRV_QUOTA', JSON.stringify(out), 600);
  return out;
}

/* ---------- THE COPY ---------- */
const DRV_OUT_ = 'DRV_OUT_OF_TIME', DRV_GAP_MS_ = 180000, DRV_IDLE_MS_ = 1800000, DRV_SETTLE_MS_ = 60000, DRV_GEN_ = ['', '#1', '#2', '#3'];
const DRV_BATCH_MS_ = 12000;      // (a batch of up to 4 files is not started with less time left – "Copy files now" has about 17 s in all)
const drvOut_ = () => { throw new Error(DRV_OUT_); };
// the notes of the copy (table backup_drive_state of step 1zf) – null: the step is not run yet
function drvStateRead_() {
  try { const r = sbFetch_('GET', '/rest/v1/backup_drive_state?id=eq.drive&select=value') || []; return drvJ_(r[0] && r[0].value, {}) || {}; }
  catch (e) { if (drvNoSql_(e)) return null; throw e; }
}
function drvStateWrite_(s) { sbFetch_('POST', '/rest/v1/backup_drive_state?on_conflict=id', [{ id: 'drive', value: JSON.stringify(s), at: new Date().toISOString() }], { Prefer: 'resolution=merge-duplicates,return=minimal' }); }
const drvBadDue_ = b => { const n = Number(b && b.n) || 0, gap = n <= 1 ? 3600000 : n === 2 ? 6 * 3600000 : 24 * 3600000; return Date.now() - (new Date(b && b.at).getTime() || 0) > gap; };
function drvInfo_() {
  const A = drvAuth_(); if (!A.ok) return { connected: false };
  let s = null; try { s = drvStateRead_(); } catch (e) { s = {}; }
  if (s === null) return { connected: true, acct: A.acct, needSql: true, error: DRV_SQL_MSG_ };
  const mine = s.root === A.root;
  return { connected: true, acct: A.acct, needSql: false, lastRun: mine ? s.lastRun || '' : '', lastDone: mine ? s.lastDone || '' : '', copied: mine ? Number(s.copied) || 0 : 0,
    bytes: mine ? Number(s.bytes) || 0 : 0, links: mine ? Number(s.links) || 0 : 0, pending: mine ? !!s.pending : true, error: mine ? s.error || '' : '', errorAt: mine ? s.errorAt || '' : '',
    skipped: mine ? Object.keys(s.bad || {}).length : 0, note: mine ? s.note || '' : '' };
}
// what backup_drive already has of these keys → { src: row }
function drvHave_(C, keys) {
  const out = {}; keys = [...new Set(keys)];
  for (let i = 0; i < keys.length; i += 25) {      // (25 at a time: the address stays short)
    const part = keys.slice(i, i + 25);
    const rows = sbFetch_('GET', '/rest/v1/backup_drive?select=src,kind,drive_id,parent&root=eq.' + encodeURIComponent(C.R) + '&src=in.' + encodeURIComponent('(' + part.map(drvQ_).join(',') + ')')) || [];
    rows.forEach(r => { out[r.src] = r; });
  }
  return out;
}
// the keys to look up for a file or a shortcut: its own and – when a folder of this site was deleted in Drive – its copies of after
const drvKeys_ = (C, k) => Object.keys(C.dead).length ? DRV_GEN_.map(g => k + g) : [k];
// the copy of a key that is still there (its folder not deleted), and the key a new copy is noted under (null: copied 4 times)
function drvLive_(C, have, k) {
  let row = null, next = null;
  DRV_GEN_.forEach(g => { const r = have[k + g]; if (r) { if (!C.dead[r.parent] && !C.dead[r.drive_id]) row = r; } else if (next === null) next = k + g; });
  return { row: row, next: next };
}
// every copy and shortcut of a batch noted in ONE call, whatever happened to the others (else a copy made is copied again later)
function drvNoteAll_(C, rows) { if (rows.length) sbFetch_('POST', '/rest/v1/backup_drive?on_conflict=root,src', rows.map(r => Object.assign({ root: C.R }, r)), { Prefer: 'resolution=ignore-duplicates,return=minimal' }); }

/* one run: opt { budget (ms), until (the request's last moment), manual, nightly }. → { ok, off, busy, skipped, pending, copied, links, error } */
function driveBackup_(opt) {
  opt = opt || {};
  const t0 = Date.now(), BUDGET = Math.max(5000, Math.min(45000, Number(opt.budget) || 30000)), until = Number(opt.until) || 0;
  const left = () => Math.min(BUDGET - (Date.now() - t0), until ? until - Date.now() - 6000 : Infinity);
  const CC = CacheService.getScriptCache();
  // not due (an open page): the next run is noted in the cache – nothing is read; Drive not connected: looked at again in 30 minutes
  const due = CC.get('DRV_NEXT');
  if (!opt.manual && !opt.nightly && due && new Date(due).getTime() > Date.now()) return { ok: true, skipped: true, pending: 0 };
  if (!opt.manual && CC.get('DRV_OFF')) return { off: true };
  const A = drvAuth_(); if (!A.ok) { CC.put('DRV_OFF', '1', 1800); return { off: true }; }
  if (!__lockNamed('drive', 75)) return { ok: true, busy: true, pending: 1 };
  const next = (ms) => { try { CC.put('DRV_NEXT', new Date(Date.now() + ms).toISOString(), Math.max(60, Math.round(ms / 1000))); } catch (e) { /* asked again */ } };
  try {
    let s = drvStateRead_();
    if (s === null) { next(DRV_IDLE_MS_); return { ok: false, error: DRV_SQL_MSG_, needSql: true }; }
    if (s.root !== A.root) s = { root: A.root, cur: {}, copied: 0, bytes: 0, links: 0, bad: {}, dead: {}, moved: {}, gen: 0 };
    ['cur', 'bad', 'dead', 'moved'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    const C = { A: A, s: s, R: A.root + (Number(s.gen) ? '#g' + Number(s.gen) : ''), dead: s.dead, left: left, folders: {}, manual: !!opt.manual, code: __siteCode(), name: (drvJ_(__siteNames(), {})[__siteCode()] || __siteCode() || 'Site'), err: '' };
    C.save = () => drvStateWrite_(C.s);      // (after a page of entries and at the end – never after each file)
    let more = false, err = '';
    try {
      // the backup's own folder: deleted or in the bin → nothing can go there (connect again: a new folder, the whole copy again)
      if (!drvAlive_(A.sealed, A.root, 10000)) throw new Error('The backup folder "RCL ERP – Files (backup)" was deleted in Google Drive (or is in its bin) – the Super Admin connects Google Drive again (Portal → Sites → Storage): a new folder is made and the whole copy goes in again.');
      if (drvCheck_(C)) more = true;      // (once a day: the site's and the kinds' folders are still there)
      if (!more && drvRetry_(C)) more = true;
      if (!more) for (const k of ['issue', 'inward', 'log', 'bills']) { if (drvEntries_(C, k)) { more = true; break; } }
      if (!more && (opt.manual || !s.looseAt || Date.now() - new Date(s.looseAt).getTime() > 6 * 3600000)) { more = drvLoose_(C); if (!more) s.looseAt = new Date().toISOString(); }
    } catch (e) {
      const m = String((e && e.message) || e);
      if (m === DRV_OUT_) more = true;      // (out of time in the middle of a call: the next run goes on)
      else if (m === 'DRV_REGEN') more = true;      // (a big folder was deleted in Drive: the whole copy of the site starts again)
      else err = m.slice(0, 300);
    }
    const now = new Date().toISOString(), why = err || C.err || '';
    // (a problem – Drive full, the access, Google busy – is tried again at the next turn: in 30 minutes, or at night; a run that
    // ran out of time with files left goes on in 3 minutes)
    Object.assign(C.s, { lastRun: now, pending: !!more, error: why, errorAt: why ? now : (C.s.errorAt || ''), lastDone: !more && !why ? now : (C.s.lastDone || '') });
    if (C.s.note && Date.now() - (new Date(C.s.noteAt).getTime() || 0) > 7 * 86400000) { C.s.note = ''; C.s.noteAt = ''; }      // (a note is shown for a week)
    C.save(); next(more ? DRV_GAP_MS_ : DRV_IDLE_MS_);
    return { ok: !why, error: why, pending: more ? 1 : 0, copied: C.s.copied, links: C.s.links };
  } finally { __unlockNamed('drive'); }
}
// the key of a folder: its path; an entry's folder made again (its own was deleted) has #n after it (s.moved)
const drvFolderKey_ = (C, path) => 'folder:' + path + (Number(C.s.moved[path]) ? '#' + Number(C.s.moved[path]) : '');
// the folder of these names (made in Drive the first time) → its Drive id
function drvFolder_(C, parts) {
  let parent = C.A.root, path = '';
  for (let i = 0; i < parts.length; i++) {
    path = path ? path + '/' + parts[i] : parts[i];
    const key = drvFolderKey_(C, path);
    if (!C.folders[key]) { const have = drvHave_(C, [key])[key]; if (have) C.folders[key] = have.drive_id; }
    if (!C.folders[key]) {
      if (C.left() < 8000) drvOut_();
      const name = i === 0 ? C.name + ' (' + C.code + ')' + (C.s.tag ? ' – ' + C.s.tag : '') : drvName_(parts[i]);
      const f = drvCall_(C.A.sealed, 'POST', '/drive/v3/files?fields=id', { name: name, mimeType: DRV_FOLDER_, parents: [parent], appProperties: { rcl: key.slice(0, 110) } }, C.left() - 2000);
      drvNoteAll_(C, [{ src: key, kind: 'folder', drive_id: f.id, parent: parent, name: name }]);
      C.folders[key] = f.id;
    }
    parent = C.folders[key];
  }
  return parent;
}
/* Drive answered "not found" for a folder (deleted by hand): which one is gone, from the site's folder down. The entry's own folder:
 * made again (#n) and the files that were in it copied again. A bigger one: the whole copy of this site starts again (gen). */
function drvRepair_(C, parts, whole) {
  let path = '';
  for (let i = 0; i < parts.length; i++) {
    path = path ? path + '/' + parts[i] : parts[i];
    const id = C.folders[drvFolderKey_(C, path)]; if (!id) return false;
    if (drvAlive_(C.A.sealed, id, C.left() - 2000)) continue;
    C.dead[id] = 1;
    const ks = Object.keys(C.dead); if (ks.length > 300) ks.slice(0, ks.length - 300).forEach(k => { delete C.dead[k]; });
    const today = drvDmy_(new Date(Date.now() + 19800000).toISOString());
    if (i === parts.length - 1 && !whole) { C.s.moved[path] = (Number(C.s.moved[path]) || 0) + 1; delete C.folders[drvFolderKey_(C, path)]; C.s.note = today + ': a folder was deleted in Google Drive (' + parts.slice(1).join(' / ') + ') – it was made again and its files copied again.'; C.s.noteAt = new Date().toISOString(); C.save(); return true; }
    /* a bigger folder (the site's, a kind's, a year's, a month's): which files were in it is not known one by one – the whole copy of
     * this site is made again, in a new folder of the site; when the site's own folder is still there the new one is named
     * "… – made again <date>" (the old one stays as it is – nothing is deleted in Drive) */
    const tag = i === 0 ? '' : 'made again ' + today, was = parts.slice(0, i + 1).join(' / ');
    Object.assign(C.s, { gen: (Number(C.s.gen) || 0) + 1, tag: tag, cur: {}, looseAt: '', moved: {}, dead: {}, checkAt: '', bad: {}, stuck: null, copied: 0, bytes: 0, links: 0,
      note: today + ': the folder "' + was + '" was deleted in Google Drive – the whole copy of this site is made again' + (tag ? ' in "' + C.name + ' (' + C.code + ') – ' + tag + '" (the old folder of the site stays as it is)' : '') + '.', noteAt: new Date().toISOString() });
    C.save(); throw new Error('DRV_REGEN');
  }
  return false;
}
// once a day: the site's folder and its kinds' folders are still there (a deleted one: the whole copy of the site again)
function drvCheck_(C) {
  if (C.s.checkAt && Date.now() - new Date(C.s.checkAt).getTime() < 86400000) return false;
  const kinds = Object.keys(DRV_KIND_).map(k => [C.code, DRV_KIND_[k]]), keys = [drvFolderKey_(C, C.code)].concat(kinds.map(x => drvFolderKey_(C, x.join('/')))), have = drvHave_(C, keys);
  keys.forEach(k => { if (have[k]) C.folders[k] = have[k].drive_id; });
  for (let j = 0; j < keys.length; j++) { const k = keys[j]; if (!have[k]) continue; if (C.left() < 8000) return true;
    if (!drvAlive_(C.A.sealed, have[k].drive_id, C.left() - 2000)) drvRepair_(C, j === 0 ? [C.code] : kinds[j - 1], true); }
  C.s.checkAt = new Date().toISOString(); return false;
}
// files of one kind of entry: [{ id, at, folder: [...], files: [{ b, p, name, mime, sha }] }]
const DRV_SPEC_ = {
  issue: { table: 'diesel_issue', col: 'photos', sel: 'id,issue_date,machinery,photos,updated_at', ent: r => {
    const n = {}; return { id: str_(r.id), at: r.updated_at, folder: [DRV_KIND_.issue].concat(drvMonth_(r.issue_date), [drvDmy_(r.issue_date) + ' ' + clean_(r.machinery) + ' ' + str_(r.id)]),
      files: photoList_(r.photos).map(x => { const k = PHOTO_KINDS_[x.k] || 'Photo'; n[k] = (n[k] || 0) + 1; return { b: PHOTO_BUCKET_, p: str_(x.p), name: k + ' ' + n[k] + '.jpg', mime: 'image/jpeg' }; }) }; } },
  inward: { table: 'diesel_inward', col: 'photos', sel: 'id,date,pump_name,photos,updated_at', ent: r => ({ id: str_(r.id), at: r.updated_at,
    folder: [DRV_KIND_.inward].concat(drvMonth_(r.date), [drvDmy_(r.date) + ' ' + str_(r.id) + (clean_(r.pump_name) ? ' ' + clean_(r.pump_name) : '')]),
    files: billList_(r.photos).map((x, i) => ({ b: PHOTO_BUCKET_, p: str_(x.p), name: 'Bill copy ' + (i + 1) + '.jpg', mime: 'image/jpeg' })) }) },
  log: { table: 'log_book', col: 'attachments', sel: 'id,date,machinery,shift,attachments,updated_at', ent: r => ({ id: str_(r.id), at: r.updated_at,
    folder: [DRV_KIND_.log].concat(drvMonth_(r.date), [drvDmy_(r.date) + ' ' + clean_(r.machinery) + ' ' + (clean_(r.shift) || 'Full Day')]),
    files: attList_(r.attachments).map(x => ({ b: ATT_BUCKET_, p: str_(x.p), sha: str_(x.sha), name: drvName_(x.name || (str_(x.sha).slice(0, 12) + '.' + str_(x.p).split('.').pop())), mime: str_(x.mime) })) }) }
};
// the entries of one kind changed since the cursor (and saved a minute ago at least), page by page; → true when time ran out
function drvEntries_(C, kind) {
  if (kind === 'bills') return drvBills_(C);
  const S = DRV_SPEC_[kind], settled = encodeURIComponent(new Date(Date.now() - DRV_SETTLE_MS_).toISOString());
  for (let page = 0; page < 200; page++) {
    if (C.left() < 10000) return true;
    const cur = C.s.cur[kind] || null;
    const after = cur ? '&or=' + encodeURIComponent('(updated_at.gt.' + drvQ_(cur.at) + ',and(updated_at.eq.' + drvQ_(cur.at) + ',id.gt.' + drvQ_(cur.id) + '))') : '';
    let rows;
    try { rows = sbFetch_('GET', '/rest/v1/' + S.table + '?select=' + S.sel + '&' + S.col + '=not.is.null&updated_at=lt.' + settled + '&order=updated_at.asc,id.asc&limit=40' + after) || []; }
    catch (e) { if (/42703|column .* does not exist|PGRST204/.test(String(e.message))) return false; throw e; }      // (a site without that step: nothing of this kind)
    if (!rows.length) return false;
    const ents = rows.map(S.ent);
    const done = drvPut_(C, kind, ents);
    if (done) { C.s.cur[kind] = { at: ents[done - 1].at, id: ents[done - 1].id }; C.save(); }
    if (done < ents.length) return true;
    if (rows.length < 40) return false;
  }
  return true;
}
/* the files of these entries into their folders: a file not in Drive yet is copied (4 at a time), one that is (another entry has
 * it) gets a shortcut in this entry's folder. → how many entries are complete (in order; stops at the first one left) */
function drvPut_(C, kind, ents) {
  const keys = [];
  ents.forEach(e => { if (!e.files.length) return;
    e.files.forEach(f => { drvKeys_(C, 'file:' + f.b + '/' + f.p).forEach(k => keys.push(k)); drvKeys_(C, 'link:' + kind + ':' + e.id + ':' + f.b + '/' + f.p).forEach(k => keys.push(k)); });
    const parts = [C.code].concat(e.folder); let path = ''; parts.forEach(x => { path = path ? path + '/' + x : x; const fk = drvFolderKey_(C, path); if (!C.folders[fk]) keys.push(fk); }); });
  if (!keys.length) return ents.length;
  const have = drvHave_(C, keys);
  Object.keys(have).forEach(k => { if (have[k].kind === 'folder' && !C.dead[have[k].drive_id]) C.folders[k] = have[k].drive_id; });
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i]; if (!e.files.length) continue;
    if (C.left() < 10000) return i;
    let tries = 0;
    for (;;) {
      try { if (!drvPutOne_(C, kind, e, have)) return i; break; }
      catch (x) {
        if (x.gone && !tries++) {
          if (x.target) { C.dead[x.target] = 1; continue; }      // (the file a shortcut points to was deleted in Drive: copied again)
          if (drvRepair_(C, [C.code].concat(e.folder))) continue;      // (its folder was deleted in Drive: made again)
        }
        if (drvStuck_(C, kind, e, x)) break;
        throw x;
      }
    }
  }
  return ents.length;
}
/* (review 25-10-2026) an entry Google Drive refuses (4xx, not the access, not a full Drive) at three runs in a row: its files go to
 * the list that is tried again by itself, and the copy goes on with the next entry – one entry never stops a site's copy */
function drvStuck_(C, kind, e, x) {
  const c = Number(x && x.code) || 0;
  if (!(c >= 400 && c < 500 && c !== 401 && c !== 403 && c !== 429)) return false;
  const k = kind + ':' + e.id, was = C.s.stuck && C.s.stuck.k === k ? Number(C.s.stuck.n) || 0 : 0;
  if (was + 1 < 3) { C.s.stuck = { k: k, n: was + 1, why: String(x.message).slice(0, 160) }; return false; }
  C.s.stuck = null;
  e.files.forEach(f => drvBad_(C, { base: 'file:' + f.b + '/' + f.p, f: f, parts: [C.code].concat(e.folder) }, x.message));
  C.err = C.err || String(x.message).slice(0, 200);
  return true;
}
function drvPutOne_(C, kind, e, have) {
  const folder = drvFolder_(C, [C.code].concat(e.folder)), todo = [], links = [], seen = {};
  for (const f of e.files) {
    const fk = 'file:' + f.b + '/' + f.p; if (seen[fk]) continue; seen[fk] = 1;      // (the same file twice in one entry: once)
    if (C.s.bad[fk]) continue;      // (waiting to be tried again – see drvRetry_)
    const F = drvLive_(C, have, fk), L = drvLive_(C, have, 'link:' + kind + ':' + e.id + ':' + f.b + '/' + f.p);
    if (!F.row) { if (F.next) todo.push({ f: f, fk: F.next, base: fk, folder: folder, parts: [C.code].concat(e.folder) }); }
    else if (F.row.parent !== folder && !L.row && L.next) links.push({ f: f, lk: L.next, target: F.row.drive_id });
  }
  const notes = [];
  try {
    for (const l of links) {
      if (C.left() < 8000) drvOut_();
      let sc;
      try { sc = drvCall_(C.A.sealed, 'POST', '/drive/v3/files?fields=id', { name: l.f.name, mimeType: DRV_SHORTCUT_, parents: [folder], shortcutDetails: { targetId: l.target }, appProperties: { rcl: l.lk.slice(0, 110) } }, C.left() - 2000); }
      catch (x) { if (x.gone && drvAlive_(C.A.sealed, folder, C.left() - 2000)) x.target = l.target; throw x; }      // (the folder is there: the file it points to is not)
      notes.push({ src: l.lk, kind: 'link', drive_id: sc.id, parent: folder, name: l.f.name }); have[l.lk] = { drive_id: sc.id, parent: folder };
      C.s.links = (Number(C.s.links) || 0) + 1;
    }
  } finally { drvNoteAll_(C, notes); }
  return drvCopy_(C, todo, have);
}
// copy these files (4 at a time) → false when time ran out before all were copied
function drvCopy_(C, todo, have) {
  for (let i = 0; i < todo.length; i += 4) {
    if (C.left() < DRV_BATCH_MS_) return false;      // (a batch needs time: not started with less left)
    const part = todo.slice(i, i + 4), notes = [];
    let stop = '', gone = false, stopCode = 0;
    try {
      const res = drvJ_(__drvPipe(C.A.sealed, JSON.stringify(part.map(x => ({ bucket: x.f.b, path: x.f.p, name: x.f.name, parent: x.folder, mime: x.f.mime || 'application/octet-stream', src: x.fk }))), Math.max(8000, Math.min(30000, C.left() - 4000))), []);
      part.forEach((x, j) => {
        const r = res[j] || { error: 'no answer' }, d = drvJ_(r.text, {});
        /* the FILE's own fault (not in the store, not received whole, not what its name says, too big): noted to be tried again by
         * itself later (drvRetry_ – it never holds up the others); anything else (Google busy, the network, the access, a full
         * Drive, out of time) is nobody's file: the run stops and the next one goes on from here */
        let why = '', mine = false;
        if (r.error) { if (/did not answer in time/.test(r.error)) { stop = stop || DRV_OUT_; return; } why = r.error; }
        else if (r.stage === 'read' && (r.code === 404 || (r.code === 400 && /not.?found/i.test(String(r.text))))) { why = 'the file is not in the file store (' + x.f.b + '/' + x.f.p + ')'; mine = true; }
        else if (r.code === 413) { why = 'the file is too big to copy (' + x.f.p + ')'; mine = true; }
        else if (r.code === 404 && r.stage !== 'read') { gone = true; return; }      // (its folder was deleted in Drive)
        else if (!(r.code >= 200 && r.code < 300)) why = (r.stage === 'read' ? 'the file store' : 'Google Drive') + ' answered ' + r.code + ': ' + str_((d.error && d.error.message) || r.text).slice(0, 160);
        else if (!d.id || str_(d.md5Checksum).toLowerCase() !== str_(r.md5).toLowerCase()) { why = 'Drive did not receive the file whole (its MD5 is not the file\'s) – ' + x.f.p; mine = true; }
        else if (x.f.sha && str_(r.sha256) !== x.f.sha) { why = 'the file in the store is not the one its name says (SHA-256) – ' + x.f.p; mine = true; }
        if (why) {
          if (r.code === 403 && /storageQuotaExceeded|storage ?quota/i.test(String(r.text || '') + why)) { stop = 'Google Drive is full – the files cannot be copied there. Make room or buy more Google storage for that account, then the copy goes on by itself.'; return; }
          if (mine) { drvBad_(C, x, why, r.code >= 200 && r.code < 300); C.err = C.err || why; return; }
          if (!stop) { stop = why; stopCode = Number(r.code) || 0; } return; }
        notes.push({ src: x.fk, kind: 'file', drive_id: d.id, parent: x.folder, name: x.f.name, bytes: Number(r.size) || 0, md5: str_(r.md5) });
        have[x.fk] = { drive_id: d.id, parent: x.folder };
        if (C.s.bad[x.base]) delete C.s.bad[x.base];
        C.s.copied = (Number(C.s.copied) || 0) + 1; C.s.bytes = (Number(C.s.bytes) || 0) + (Number(r.size) || 0);
      });
    } finally { drvNoteAll_(C, notes); }
    if (gone) { const e = new Error('Google Drive (404): a folder of the copy is not there any more'); e.gone = true; e.code = 404; throw e; }
    if (stop) { const e = new Error(stop); e.code = stopCode; throw e; }
  }
  return true;
}
// a file that could not be copied, with what is needed to try it again (at most 300 are kept; the oldest goes)
function drvBad_(C, x, why, landed) {
  const was = C.s.bad[x.base] || {};
  C.s.bad[x.base] = { n: (Number(was.n) || 0) + 1, up: (Number(was.up) || 0) + (landed ? 1 : 0), at: new Date().toISOString(), why: String(why).slice(0, 160), b: x.f.b, p: x.f.p, name: x.f.name, mime: x.f.mime || '', sha: x.f.sha || '', folder: x.parts || was.folder || null };
  const ks = Object.keys(C.s.bad); if (ks.length > 300) delete C.s.bad[ks[0]];
}
/* the files that could not be copied before: tried again after an hour, 6 hours, then once a day – into the folder they belong to.
 * One whose copy reached Drive but was not right (MD5 / SHA-256 – each try leaves that copy there: nothing is deleted in Drive) is
 * tried by itself 3 times at most; after that only "Copy files now" tries it again (at most once in 10 minutes). */
function drvRetry_(C) {
  const due = Object.keys(C.s.bad).filter(k => { const b = C.s.bad[k]; if (!Array.isArray(b.folder)) return false;
    if ((Number(b.up) || 0) >= 3) return !!C.manual && Date.now() - (new Date(b.at).getTime() || 0) > 600000;
    return drvBadDue_(b) || (!!C.manual && Date.now() - (new Date(b.at).getTime() || 0) > 600000); }).slice(0, 8);
  if (!due.length) return false;
  const have = drvHave_(C, [].concat(...due.map(k => drvKeys_(C, k))));
  for (const k of due) {
    if (C.left() < DRV_BATCH_MS_) return true;
    const b = C.s.bad[k], F = drvLive_(C, have, k);
    if (F.row) { delete C.s.bad[k]; continue; }      // (copied meanwhile – as another entry's file)
    if (!F.next) { delete C.s.bad[k]; continue; }
    try { if (!drvCopy_(C, [{ f: { b: b.b, p: b.p, name: b.name, mime: b.mime, sha: b.sha }, fk: F.next, base: k, folder: drvFolder_(C, b.folder), parts: b.folder }], have)) return true; }
    catch (e) {
      const m = String((e && e.message) || e);
      if (m === DRV_OUT_ || m === 'DRV_REGEN' || e.code === 401 || e.code === 403 || /Drive is full|Google Drive again|did not give the access/.test(m)) throw e;
      if (e.gone) drvRepair_(C, b.folder);      // (its folder was deleted in Drive: made again; tried at the next turn)
      else drvBad_(C, { base: k, f: { b: b.b, p: b.p, name: b.name, mime: b.mime, sha: b.sha }, parts: b.folder }, m);      // (tried again later – never stops the others)
    }
  }
  C.save(); return false;
}
// submitted bills (their evidence, step 1zc): a folder per bill with shortcuts to the files of its Log Book as submitted
function drvBills_(C) {
  const settled = encodeURIComponent(new Date(Date.now() - DRV_SETTLE_MS_).toISOString());
  for (let page = 0; page < 100; page++) {
    if (C.left() < 10000) return true;
    const cur = C.s.cur.bills || null;
    const after = cur ? '&or=' + encodeURIComponent('(created_at.gt.' + drvQ_(cur.at) + ',and(created_at.eq.' + drvQ_(cur.at) + ',id.gt.' + drvQ_(cur.id) + '))') : '';
    let bills;
    try { bills = sbFetch_('GET', '/rest/v1/bill_snapshots?select=id,bill_no,rev,vendor_name,period_to,created_at&created_at=lt.' + settled + '&order=created_at.asc,id.asc&limit=5' + after) || []; }
    catch (e) { if (drvNoSql_(e)) return false; throw e; }
    if (!bills.length) return false;
    for (const b of bills) {
      if (C.left() < 10000) return true;
      const rows = sbFetch_('GET', '/rest/v1/bill_log_rows?select=entry_key,machinery,entry_date,shift,data&bill_id=eq.' + encodeURIComponent(b.id) + '&order=entry_key.asc&limit=5000') || [];
      const files = [], seen = {};
      rows.forEach(r => { const d = drvJ_(r.data, {}); attList_(d.att).forEach(x => { if (seen[x.p]) return; seen[x.p] = 1; files.push({ b: ATT_BUCKET_, p: str_(x.p), sha: str_(x.sha), mime: str_(x.mime),
        name: drvName_(drvDmy_(r.entry_date) + ' ' + clean_(r.machinery) + ' ' + (clean_(r.shift) || 'Full Day') + ' – ' + (x.name || str_(x.sha).slice(0, 12))) }); }); });
      if (files.length) {
        const ent = { id: str_(b.id), folder: [DRV_KIND_.bills, drvMonth_(b.period_to)[0], drvName_(str_(b.bill_no) + (Number(b.rev) ? ' rev ' + Number(b.rev) : '') + ' – ' + clean_(b.vendor_name))], files: files };
        if (drvPut_(C, 'bill', [ent]) < 1) return true;
      }
      C.s.cur.bills = { at: b.created_at, id: b.id }; C.save();
    }
    if (bills.length < 5) return false;
  }
  return true;
}
// the files of the two places that no entry has (a day old at least: a file just sent may still be saved with its entry)
function drvLoose_(C) {
  const dayAgo = Date.now() - 86400000;
  for (let page = 0; page < 100; page++) {
    if (C.left() < 10000) return true;
    const cur = C.s.cur.files || null;
    let list;
    try { list = sbFetch_('POST', '/rest/v1/rpc/web_files', { p_after: cur ? cur.at : null, p_id: cur ? cur.id : null, p_n: 100 }) || []; }
    catch (e) { if (drvNoSql_(e)) return false; throw e; }
    if (!list.length) return false;
    const young = list.findIndex(x => new Date(x.at).getTime() > dayAgo), ripe = young === -1 ? list : list.slice(0, young);
    const have = drvHave_(C, [].concat(...ripe.map(x => drvKeys_(C, 'file:' + x.b + '/' + x.p))));
    for (let i = 0; i < ripe.length; i++) {
      const x = ripe[i], fk = 'file:' + x.b + '/' + x.p, F = drvLive_(C, have, fk);
      if (!F.row && F.next && !C.s.bad[fk]) {
        const parts = [C.code, DRV_KIND_.loose, x.b].concat(drvMonth_(String(x.at).slice(0, 10)));
        const sha = /([0-9a-f]{64})\.[a-z]+$/.exec(x.p);
        let tries = 0, ok = false;
        for (;;) { try { ok = drvCopy_(C, [{ f: { b: x.b, p: x.p, name: drvName_(String(x.p).split('/').pop()), mime: x.mime || '', sha: x.b === ATT_BUCKET_ && sha ? sha[1] : '' }, fk: F.next, base: fk, folder: drvFolder_(C, parts), parts: parts }], have); break; }
          catch (e) { if (!e.gone || tries++ || !drvRepair_(C, parts)) throw e; } }
        if (!ok) { C.save(); return true; }
      }
      C.s.cur.files = { at: x.at, id: x.id };
    }
    C.save();
    if (young > -1 || list.length < 100) return false;
  }
  return true;
}
// the Super Admin's "Copy files now" (Portal): one piece now
function drvNow_(c) { const r = driveBackup_({ manual: true, budget: 17000 }); return Object.assign({ run: r }, storageOf_()); }
`;
