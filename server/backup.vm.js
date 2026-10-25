// This file is text: the backup code that is added to the app's server code (see runtime.js).
module.exports = String.raw`
/* ================= GOOGLE SHEET BACKUP – from this server, no Apps Script =================
 * (runs in the same place as the app's own code, so it uses the app's own table list, tab names and headings)
 * What it does: looks at every table of the database; a table that changed since the last backup (rows added,
 * changed or deleted) has its tab in the Google Sheet written again, whole. Once a day every tab is written again.
 * The Sheet is a copy for reading – the app never reads it back.
 * When: ONCE A DAY (update-141, 21-10-2026 – "one successful Google Sheets backup daily" with the least data read from the
 * database): every night by the Vercel cron (02:00 India time); if that did not run (no CRON_SECRET, Vercel or Google down),
 * the first open page of the day starts it; and at once with the "Backup" button. Until update-141 every open page started
 * one every 4 minutes after any change, and each read every changed table WHOLE again – the Activity Log (it changes with
 * every save) many times a day: most of what the database sent out. Two backups never run together (lock "backup").
 * THE LOGS ONLY GROW (the Activity Log, the Store's log – APPEND_ below): only their NEW rows are read and added at the end of the
 * tab, when the tab and the notes agree exactly (rows in the tab = rows copied, and the table has exactly those plus the new
 * ones); otherwise, and once in 30 days, the tab is written whole as before.
 *
 * IN PIECES, AND IT GOES ON WHERE IT STOPPED (07-10-2026). A request of this server is stopped after 58 seconds. Until now
 * the backup read every changed table, wrote them all, and only at the very END noted what it had done. A backup that
 * needed longer than 58 seconds was cut off in the middle with nothing noted: the next one started from the beginning
 * and was cut off again – for ever – while the app kept showing the last good time in green.
 * Now:  - the tables are written in GROUPS (the small ones together, a big one alone), the smallest first, and after
 *         every group "these are done" is written down at once;
 *       - the run stops by itself after about 36 seconds; what is left (state.todo) is taken up by the next asking
 *         (an open page asks again a minute later while something is left; an unfinished backup is not "done today");
 *       - a run that was cut off all the same leaves a mark (state.running); after two in a row the app shows the
 *         backup as failed, with the reason, instead of staying green;
 *       - after a failure the next automatic try waits 4 minutes too (every open page used to try again at once).
 * A tab is always written whole and to its exact size, so writing one again is harmless. */
/* (update-157, asked 24-10-2026) NUMBERED BACKUP SHEETS – every site its own Sheet 1, 2, … and the Portal its own.
 * "vtr ani 18b chi 2 ni google sheet link … super admin 2 ni link change kru shakel new sheet link deu shakel mhanje eka google
 * sheet full zali tr new add krta yeil mhanje old pn asel but te backup sheet 1 zali nantr 2 number chalu zali"
 * The list is kept in the site's own settings (BK_SHEETS; the Portal's in the first site's: BK_PORTAL_SHEETS). The Super Admin
 * gives the links in the Portal (Sites → Backup):
 *   – CHANGE: another Sheet in place of the one in use – the whole copy (its part) goes there at the next backup;
 *   – ADD: the next number, when the one in use is full (Google allows 10 million cells in one Sheet). The one before stays as it
 *     is – never written again – and the new one holds every row NEW OR CHANGED since an hour before the last complete copy of
 *     the one before (a row may be in both, none is left out), the deletions since then (Deleted Rows) and the masters whole:
 *     Sheet 1 + Sheet 2 + … is the whole data.
 * A site without a list yet uses the Sheet it had (BACKUP_SHEET_ID for the first site, the list of sites for another) as Sheet 1. */
const BK_CELLS_ = 10000000;
const BK_REF_ = ['master', 'vendors', 'boq', 'app_users', 'app_settings', 'rcl_companies', 'rcl_sites', 'rcl_super_admin', 'rcl_user_sites', 'items', 'bill_machines'];      // the masters: whole in every Sheet
const BK_SINCE_COLS_ = ['updated_at', 'created_at', 'at', 'deleted_at'];      // the time a row was saved or changed (the first a table has)
function bkTarget_(o) {
  return o && o.target === 'portal'
    ? { kind: 'portal', lock: 'backup_portal', state: 'BK_PORTAL_STATE', info: 'SB_PORTAL_INFO', sheets: 'BK_PORTAL_SHEETS', name: 'the Portal' }
    : { kind: 'site', lock: 'backup', state: 'BK_STATE', info: 'SB_INFO', sheets: 'BK_SHEETS', name: 'this site' };
}
const bkUrl_ = id => 'https://docs.google.com/spreadsheets/d/' + id;
const bkJson_ = (v, d) => { try { const x = JSON.parse(v || 'null'); return x === null ? d : x; } catch (e) { return d; } };
const bkFresh_ = k => { const P = PropertiesService.getScriptProperties(); try { return typeof __propFresh === 'function' ? __propFresh(k) : P.getProperty(k); } catch (e) { return P.getProperty(k); } };
function bkSheets_(T, fallback) {
  const v = bkJson_(PropertiesService.getScriptProperties().getProperty(T.sheets), null);
  if (Array.isArray(v) && v.length) return v.filter(x => x && x.id);
  return T.kind === 'site' && fallback ? [{ n: 1, id: String(fallback), from: '', legacy: true }] : [];
}
function bkInfoOf_(T) { return bkJson_(PropertiesService.getScriptProperties().getProperty(T.info), null); }
// how full a Sheet is, kept with it in the list (only a list the Super Admin gave – the Sheet of before has no list)
function bkCellsKeep_(T, vol, cells, at) {
  if (vol.legacy) return;
  const v = bkJson_(bkFresh_(T.sheets), null); if (!Array.isArray(v)) return;
  const x = v.find(y => Number(y.n) === Number(vol.n) && y.id === vol.id); if (!x) return;
  x.cells = cells; x.cellsAt = at; PropertiesService.getScriptProperties().setProperty(T.sheets, JSON.stringify(v));
}
/* (update-157) THE OTHER MODULES. Engineering keeps every site in its own database, the Portal its users and access in its own:
 * their rows come through their own "backup export" (api/backup-export.js there – asked with BACKUP_EXPORT_SECRET, the same
 * value in the three Vercel projects). They keep their own database keys; a password, a key or a sign-in never leaves them.
 * Engineering's rows of THIS site only go into this site's Sheet ("Engineering – …" tabs); the Portal's into the Portal's own. */
function bkRemote_(source, body, ms) {
  const r = JSON.parse(__bkRemote(source, JSON.stringify(body), Math.max(3000, Math.min(25000, Number(ms) || 25000)))), who = source === 'eng' ? 'Engineering' : 'The Portal';
  if (r.code === 401 || r.code === 403) throw new Error(who + ' refused the backup (BACKUP_EXPORT_SECRET must be the same value in Vercel for rclerp, rcl-portal and rcl-engineering).');
  if (r.code >= 300 || !r.code) throw new Error(who + ' did not give its data for the backup (' + r.code + '): ' + String(r.text || '').slice(0, 200));
  return bkJson_(r.text, {});
}
// (review 25-10-2026) the catalog is asked with a short wait (10 s – it must not eat the time of this site's own tables); when the
// secret or Engineering's address is missing the status says so (before, Engineering was left out without a word)
function bkRemoteCatalog_(T, siteCode) {
  const on = bkJson_(__bkRemoteOn(), {}), out = {};
  const add = (src, list, prefix) => (list || []).forEach(x => { if (!x || !x.name || !Array.isArray(x.cols)) return;
    out[src + ':' + x.name] = { src: src, name: x.name, title: prefix + (x.title || x.name), cols: x.cols.map(n => ({ name: String(n) })), count: Number(x.count) || 0, newest: String(x.newest || '') }; });
  let note = '';
  if (T.kind === 'site' && siteCode) {
    if (!on.secret) note = 'Engineering\'s data is not in this backup: BACKUP_EXPORT_SECRET is not set in Vercel (the same value in rclerp, rcl-portal and rcl-engineering).';
    else if (!on.eng) note = 'Engineering\'s data is not in this backup: its address is not known – set ENGINEERING_URL in Vercel (rclerp).';
    else add('eng', bkRemote_('eng', { action: 'catalog', site: siteCode }, 10000).tables, 'Engineering – ');
  }
  if (T.kind === 'portal' && on.secret && on.portal) add('portal', bkRemote_('portal', { action: 'catalog' }, 10000).tables, 'Portal – ');
  return { out: out, note: note };
}
// a table of another module, page by page (300 rows – a page stays far below what a Vercel answer may carry), from row "start";
// never past the time this run has left: → { list, done, next } – a big table is written in pieces and the next run goes on from
// "next" (second review, 25-10-2026: before, a table bigger than one run could read was started again, and again, every run)
function bkRemoteRows_(x, siteCode, since, left, start, per) {
  const out = [], n = Math.max(20, Math.min(300, Number(per) || 300)); let off = Math.max(0, Number(start) || 0);
  for (let k = 0; k < 50000; k++) {
    if (left() < 9000) { if (out.length) return { list: out, done: false, next: off }; throw new Error('BK_OUT_OF_TIME'); }
    const page = bkRemote_(x.src, { action: 'rows', table: x.name, site: siteCode || '', since: since || '', offset: off, limit: n }, left() - 5000).rows || [];
    out.push.apply(out, page); off += page.length; if (page.length < n) return { list: out, done: true, next: off };
  }
  return { list: out, done: false, next: off };
}
/* (update-157) the Super Admin in the Portal (Sites → Backup): this site's (or the Portal's) numbered Sheets, how full each is,
 * the last backup; the e-mail address of the backup robot (each Sheet is shared with it as Editor) */
function bkSheetsInfo_(c) {
  const T = bkTarget_(c), cfg = bkJson_(__backupConfig(), {}), P = PropertiesService.getScriptProperties();
  const vols = bkSheets_(T, cfg.fallback), st = bkJson_(P.getProperty(T.state), {}) || {}, info = bkJson_(P.getProperty(T.info), {}) || {};
  const act = vols[vols.length - 1];
  return { target: T.kind, email: cfg.email || '', ready: !!cfg.ok, error: cfg.ok ? '' : String(cfg.error || ''), limit: BK_CELLS_,
    sheets: vols.map(v => ({ n: Number(v.n) || 1, url: bkUrl_(v.id), from: v.since || v.from || '', added: v.added || '', by: v.by || '', frozen: v.frozen || '', legacy: !!v.legacy, active: v === act,
      cells: Number(v === act ? (info.cells || st.cells || v.cells) : v.cells) || 0 })),
    last: { ok: info.ok !== false, error: info.error || '', lastRun: info.lastRun || st.lastRun || '', lastCheck: info.lastCheck || st.lastCheck || '', pending: Number(info.pending) || (st.todo || []).length || 0, engNote: info.engNote || '' } };
}
// the Sheets this site uses (and, at the first site, the Portal's) – so no Sheet is given to two of them
function bkIds_() {
  const cfg = bkJson_(__backupConfig(), {}), ids = v => [v.id].concat(Array.isArray(v.was) ? v.was : []);
  // (review 25-10-2026) also the Sheets used before (a link changed) and the Sheet this site had before its list – never given to another
  const own = [].concat(...bkSheets_(bkTarget_({}), cfg.fallback).map(ids)).concat(cfg.fallback ? [cfg.fallback] : []);
  const portal = typeof __siteIsHome === 'function' && __siteIsHome() ? [].concat(...bkSheets_(bkTarget_({ target: 'portal' }), '').map(ids)) : [];
  return { site: [...new Set(own.filter(Boolean))], portal: [...new Set(portal.filter(Boolean))] };
}
function bkSheetSet_(c) {
  const T = bkTarget_(c), cfg = bkJson_(__backupConfig(), {}), P = PropertiesService.getScriptProperties();
  if (!cfg.ok) throw new Error(cfg.error || 'The Google Sheet backup is not set up (GOOGLE_SERVICE_ACCOUNT_JSON in Vercel).');
  const link = String(c.link || '').trim(), m = /\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/.exec(link) || /^([A-Za-z0-9_-]{20,})$/.exec(link);
  if (!m) throw new Error('The Google Sheet link: open the Sheet and copy the address from the browser (…/spreadsheets/d/…).');
  const id = m[1], mode = c.mode === 'add' ? 'add' : 'change';
  if ((c.taken || []).map(String).indexOf(id) > -1) throw new Error('This Sheet is already the backup Sheet of another site (or of the Portal) – every site needs its own Sheet.');
  if (!__lockNamed(T.lock, 60)) throw new Error('A backup is being copied right now – try again in a minute.');
  try {
    let vols = bkJson_(bkFresh_(T.sheets), null);
    if (!Array.isArray(vols) || !vols.length) vols = bkSheets_(T, cfg.fallback);
    vols = vols.map(v => Object.assign({}, v));
    const act = vols.length ? vols[vols.length - 1] : null;
    if (mode === 'add' && !act) throw new Error('Give the link of Sheet 1 first (Change link).');
    const twin = vols.find(v => v.id === id), used = vols.find(v => Array.isArray(v.was) && v.was.indexOf(id) > -1);
    if (twin && (mode === 'add' || twin !== act)) throw new Error('This Sheet is already Sheet ' + twin.n + ' of ' + T.name + ' – give a new, empty Sheet.');
    if (used || (cfg.fallback && cfg.fallback === id && !(act && act.legacy && act.id === id))) throw new Error('This Sheet was a backup Sheet of ' + T.name + ' before – give a new, empty Sheet.');
    if (mode === 'change' && act && act.id === id && !act.legacy) return bkSheetsInfo_(c);      // the same link again: nothing to change
    // (review 25-10-2026) the Sheet must be NEW: one that already holds a backup (its "Backup Status" tab – of this or any other
    // site, a Sheet of before) is refused; and the robot must be able to WRITE it (Editor, not Viewer): its status tab is made now
    const r = bkJson_(__gNew('look', id), {});
    if (r.code === 403 || r.code === 404) throw new Error('The backup cannot open this Sheet: share it with ' + cfg.email + ' as Editor (Share → add that address → Editor), then give the link again.');
    if (!(r.code < 300)) throw new Error('Google did not answer about this Sheet (' + r.code + ') – try again in a minute.');
    const tabs = ((bkJson_(r.text, {}).sheets) || []).map(x => String((x.properties || {}).title || ''));
    const mark = 'RCL ERP backup – given to ' + (T.kind === 'portal' ? 'the Portal' : 'site ' + (typeof __siteCode === 'function' ? __siteCode() : '')) + ', waiting for its first copy';
    if (tabs.indexOf('Backup Status') > -1) {
      // a status tab with only this site's mark: a try of before that did not finish – the same Sheet is taken now; anything else: refused
      const pk = bkJson_(__gNew('peek', id), {}), a1 = String((((bkJson_(pk.text, {}).values) || [])[0] || [])[0] || '');
      if (!(pk.code < 300) || a1 !== mark) throw new Error('This Sheet already holds a backup (it has a "Backup Status" tab) – give a new, empty Sheet.');
    } else {
      const w = bkJson_(__gNew('claim', id, mark), {});
      if (w.code === 403) throw new Error('The backup can open this Sheet but cannot write it: share it with ' + cfg.email + ' as Editor (not Viewer), then give the link again.');
      if (!(w.code < 300)) throw new Error('Google did not answer about this Sheet (' + w.code + ') – try again in a minute.');
    }
    const now = new Date().toISOString(), by = String(c.by || ''), st = bkJson_(bkFresh_(T.state), {}) || {}, ms = x => (x ? new Date(x).getTime() || 0 : 0);
    if (mode === 'add') {
      /* (review 25-10-2026) EACH TABLE FROM ITS OWN LAST COPY: a Sheet fills up in the middle of a copy, when some tables are copied
       * and others not yet. The next Sheet holds, table by table, every row new or changed since an hour before that table's last
       * copy into this Sheet (state.copied); a table not copied into it yet: everything this Sheet was to hold (its own "from").
       * (Before, the next Sheet then got everything – and was full too.) A list of before without these notes: the old rule. */
      // (a table not copied into this Sheet at all keeps the cut it had for this Sheet – nothing of it is left out either)
      const copied = st.copied || {}, cuts = Object.assign({}, act.cuts && typeof act.cuts === 'object' ? act.cuts : {}), anyCopied = Object.keys(copied).some(t => ms(copied[t]));
      Object.keys(copied).forEach(t => { if (ms(copied[t])) cuts[t] = new Date(ms(copied[t]) - 3600000).toISOString(); });
      const complete = !(st.todo && st.todo.length) && ms(st.lastCheck) && !st.running;
      const base = anyCopied ? String(act.from || '') : complete ? new Date(ms(st.lastCheck) - 3600000).toISOString() : String(act.from || '');
      const since = Object.keys(cuts).length ? Object.keys(cuts).map(t => cuts[t]).sort()[0] : base;
      act.frozen = now; act.cells = Number(st.cells || act.cells) || 0; delete act.legacy;
      const nv = { n: (Number(act.n) || vols.length) + 1, id: id, from: base, since: since, added: now, by: by };
      if (Object.keys(cuts).length) nv.cuts = cuts;
      vols.push(nv);
    } else if (act) { if (act.id !== id) act.was = (Array.isArray(act.was) ? act.was : []).concat([act.id]).slice(-20);
      act.id = id; act.added = now; act.by = by; act.cells = 0; delete act.legacy; delete act.frozen; delete act.cellsAt; }
    else vols = [{ n: 1, id: id, from: '', added: now, by: by }];
    const top = vols[vols.length - 1];
    P.setProperty(T.sheets, JSON.stringify(vols));
    P.setProperty(T.state, JSON.stringify({}));      // the Sheet in use is new: its whole copy goes there at the next backup
    P.setProperty(T.info, JSON.stringify({ ok: true, pending: 1, url: bkUrl_(id), sheetN: Number(top.n) || 1, sheets: vols.length, cells: 0, note: 'New Sheet ' + top.n + ' – its first copy is made by the next backup.' }));
    try { writeLog_({ email: by, name: 'Super Admin (Portal)' }, 'Edit', 'Backup', 'Sheet ' + top.n, (mode === 'add' ? 'Backup Sheet ' + top.n + ' added' : 'Backup Sheet ' + top.n + ' link changed') + (T.kind === 'portal' ? ' (the Portal)' : ''), bkUrl_(id)); if (typeof sbFlush_ === 'function') sbFlush_(); } catch (e) { /* the change itself is saved */ }
    return bkSheetsInfo_(c);
  } finally { __unlockNamed(T.lock); }
}
// "Backup now" from the Portal: a short run (the Portal waits 25 s); what is left goes on by itself
function bkNow_(c) {
  let r = null, err = '';
  try { r = webBackup_({ manual: true, target: c && c.target === 'portal' ? 'portal' : '', budget: 14000, hard: 20000 }); } catch (e) { err = String((e && e.message) || e); }
  return Object.assign(bkSheetsInfo_(c), { ran: r ? { busy: !!r.busy, pending: Number(r.pending) || 0, upToDate: !!r.upToDate, timedOut: !!r.timedOut } : null, runError: err });
}
function webBackup_(opt) {
  opt = opt || {};
  const cfg = JSON.parse(__backupConfig());
  if (!cfg.ok) { if (opt.auto) return { off: true }; throw new Error(cfg.error); }
  const P = PropertiesService.getScriptProperties();
  // (update-157) whose backup (this site's, or the Portal's) and which of its numbered Sheets is in use – the last one
  const T = bkTarget_(opt), vols = bkSheets_(T, cfg.fallback), vol = vols.length ? vols[vols.length - 1] : null;
  if (!vol) { if (opt.auto) return { off: true };
    throw new Error(T.kind === 'portal' ? 'The Google Sheet backup of the Portal is not set up yet – the Super Admin gives its Sheet link (Portal → Sites → Portal backup).' : 'The Google Sheet backup of this site is not set up yet – the Super Admin gives its Sheet link (Portal → Sites → Backup).'); }
  const sheetId = String(vol.id), later = Number(vol.n) > 1, from = later ? String(vol.from || '') : '';      // from: Sheet 2 and after hold what is new or changed since then
  // (review 25-10-2026) … table by table: since an hour before that table's last copy into the Sheet before (vol.cuts)
  const cuts = later && vol.cuts && typeof vol.cuts === 'object' ? vol.cuts : {}, fromOf = t => (later ? String(cuts[t] !== undefined ? cuts[t] : from) : '');
  const sinceTxt = later ? String(vol.since || from || '') : '';
  const url = bkUrl_(sheetId);
  const readState = () => { try { return JSON.parse(P.getProperty(T.state) || '{}') || {}; } catch (e) { return {}; } };
  let state = readState();
  const nowMs = Date.now(), nowIso = new Date(nowMs).toISOString(), ms = iso => (iso ? new Date(iso).getTime() || 0 : 0);
  const unfinished = !!(state.todo && state.todo.length);
  // (update-141) the automatic check (an open page; the nightly job always runs): ONCE A DAY – nothing when a backup already
  // ended today (India date); after a failed try the next one waits 4 minutes (every open page used to try again at once);
  // an unfinished backup goes on at the next asking – but not for several open pages in the same half minute
  const dayOf = t => Utilities.formatDate(new Date(t), 'Asia/Kolkata', 'yyyy-MM-dd');
  const doneToday = st => !!ms(st.lastCheck) && dayOf(ms(st.lastCheck)) === dayOf(nowMs);
  if (opt.auto && !opt.full && !unfinished && (doneToday(state) || (ms(state.lastTry) && nowMs - ms(state.lastTry) < 4 * 60000))) return { skipped: true };
  if (opt.auto && !opt.full && unfinished && nowMs - Math.max(ms(state.lastCheck), ms(state.lastTry)) < 30000) return { skipped: true };
  if (!__lockNamed(T.lock, 110)) return { busy: true, info: T.kind === 'portal' ? bkInfoOf_(T) : sbBackupInfo_() };
  // with the lock: the notes as they are NOW (while this request waited, another server may have finished a backup)
  try { if (typeof __propFresh === 'function') { const now = __propFresh(T.state); state = now ? (JSON.parse(now) || {}) : {}; } } catch (e) { /* the notes read at the start are used */ }
  // (review 25-10-2026) the Super Admin may have given another Sheet while this request waited: the next run takes that one
  { const v2 = bkJson_(PropertiesService.getScriptProperties().getProperty(T.sheets), null);
    if (Array.isArray(v2) && v2.length && String(v2[v2.length - 1].id) !== sheetId) { __unlockNamed(T.lock); return { busy: true, info: bkInfoOf_(T) || {} }; } }
  if (state.sheet && state.sheet !== sheetId) state = {};      // the notes of another Sheet (a link changed): this Sheet gets its whole copy
  if (opt.auto && !opt.full && !(state.todo && state.todo.length) && doneToday(state)) { __unlockNamed(T.lock); return { skipped: true }; }      // another server has just done it
  // how long one run works before it stops by itself, and how many rows go into one group – the app's settings may change
  // them (BK_BUDGET_MS, BK_GROUP_ROWS in web.props: for tests, or to tune a very big site); normally 36 s and 6,000 rows
  const knob = (k, d, lo, hi) => { const v = Number(P.getProperty(k)); return isFinite(v) && v >= lo && v <= hi ? v : d; };
  // (update-157) "Backup now" from the Portal waits at most 25 s for the answer: that run works shorter (opt.budget / opt.hard)
  // (BK_HARD_MS: the last moment a run may still write – for tests of a run that is cut in the middle; normally 52 s)
  const T0 = Date.now(), BUDGET = Math.min(knob('BK_BUDGET_MS', 36000, 1000, 40000), Number(opt.budget) || 40000), HARD = Math.min(knob('BK_HARD_MS', 52000, 12000, 52000), Number(opt.hard) || 52000), GROUP_ROWS = knob('BK_GROUP_ROWS', 6000, 1, 100000);
  const left = () => HARD - (Date.now() - T0);
  // the lock is ours and the mark of the run before is still there: that run did not end (it was cut off)
  const died = state.running ? (Number(state.died) || 0) + 1 : 0;
  const keep = o => { state = Object.assign({}, state, o); P.setProperty(T.state, JSON.stringify(state)); };      // written to the database at once
  try {
    keep({ running: nowIso, died: died, sheet: sheetId });
    if (died >= 2) P.setProperty(T.info, JSON.stringify({ ok: false, error: 'The backup was cut off ' + died + ' times in a row before it could finish (a request may run 58 seconds). It is trying again now; if this stays, a table has become too big to copy in one go – tell the developer.', lastCheck: state.lastCheck || '', lastRun: state.lastRun || '', url: url }));
    const G = (method, path, body) => {
      if (left() < 6000) throw new Error('BK_OUT_OF_TIME');
      const r = JSON.parse(__g(method, path, body === undefined ? '' : JSON.stringify(body), left(), sheetId));
      if (r.code >= 300) { let msg = String(r.text || '').slice(0, 300); try { msg = JSON.parse(r.text).error.message; } catch (e) {}
        // (update-157) Google allows 10 million cells in one Sheet: a full one is said plainly – the next number takes over
        if (/10[,.]?000[,.]?000|limit of [0-9,. ]+ cells/i.test(msg)) throw new Error('Sheet ' + vol.n + ' of ' + T.name + ' is full – Google allows 10 million cells in one Sheet. The Super Admin adds Sheet ' + (Number(vol.n) + 1) + ' (Portal → Sites → Backup); nothing already copied is lost.');
        if (r.code === 403) msg += ' – share the backup Sheet with ' + cfg.email + ' as Editor, and check that the Google Sheets API is enabled for the project of the service account.';
        if (r.code === 404) msg += ' – the link of Sheet ' + vol.n + ' of ' + T.name + ' is not a Sheet this service account can open (Portal → Sites → Backup).';
        throw new Error('Google Sheet (' + r.code + '): ' + msg); }
      return r.text ? JSON.parse(r.text) : {}; };
    const siteCode = T.kind === 'site' && typeof __siteCode === 'function' ? __siteCode() : '';
    const cat = T.kind === 'site' ? sbCatalog_() : {}, c = sbConf_();
    // (update-157) the Engineering module's rows of this site (the Portal's for the Portal's backup), read through their own export
    let rem = {}, remNote = '';
    try { const rc = bkRemoteCatalog_(T, siteCode); rem = rc.out; remNote = rc.note; } catch (e) { if (T.kind === 'portal') throw e; remNote = String((e && e.message) || e).slice(0, 300); rem = {}; }
    if (T.kind === 'portal' && !Object.keys(rem).length) throw new Error('The Portal backup needs the same BACKUP_EXPORT_SECRET in Vercel for the Mechanical (rclerp) and the Portal (rcl-portal) projects, and PORTAL_URL in rclerp.');
    const local = Object.keys(cat).sort(), tables = local.concat(Object.keys(rem).sort());
    const tabOf = t => rem[t] ? rem[t].title : sbTabName_(t);
    // (update-157) Sheet 2 and after: a table of entries holds only its rows new or changed since "from" (a master stays whole)
    const sinceCol = t => { if (!fromOf(t) || BK_REF_.indexOf(t) > -1 || !cat[t]) return ''; const names = cat[t].map(x => x.name); return BK_SINCE_COLS_.find(x => names.indexOf(x) > -1) || ''; };
    const volFilter = t => { const col = sinceCol(t); return col ? '&' + col + '=gte.' + encodeURIComponent(fromOf(t)) : ''; };
    // what every table looks like now: number of rows + newest change
    const res = UrlFetchApp.fetchAll(local.map(t => { const has = cat[t].some(x => x.name === 'updated_at');
      return { url: c.url + '/rest/v1/' + t + '?select=' + (has ? 'updated_at&order=updated_at.desc' : cat[t][0].name) + '&limit=1', method: 'get', muteHttpExceptions: true, headers: { apikey: c.key, Prefer: 'count=exact' } }; }));
    const sig = {}; let newest = '';
    Object.keys(rem).forEach(t => { sig[t] = rem[t].count + '|' + rem[t].newest; });
    local.forEach((t, i) => { const r = res[i]; if (r.getResponseCode() >= 300) throw new Error('Could not read ' + t + ' (' + r.getResponseCode() + ').');
      const h = r.getHeaders() || {}, cr = String(h['content-range'] || h['Content-Range'] || ''); let top = '';
      try { const a = JSON.parse(r.getContentText() || '[]'); top = a[0] && a[0].updated_at ? String(a[0].updated_at) : ''; } catch (e) { top = ''; }
      sig[t] = (cr.split('/')[1] || '?') + '|' + top; if (top > newest) newest = top; });
    const rowsOf = t => { const n = Number(String(sig[t]).split('|')[0]); return isFinite(n) ? n : 0; };
    // "every tab again" (once a day, and the nightly job): a round that is noted table by table, so it can be taken up again
    const day = 24 * 3600000;
    let fullRun = state.fullRun && state.fullRun.done ? { at: state.fullRun.at, done: Object.assign({}, state.fullRun.done) } : null;
    if (!fullRun && (!!opt.full || !state.lastFull || nowMs - ms(state.lastFull) > day)) fullRun = { at: nowIso, done: {} };
    const full = !!fullRun;
    const old = Object.assign({}, state.sig || {});
    let changed = tables.filter(t => (fullRun && !fullRun.done[t]) || old[t] !== sig[t] || /\?\|/.test(sig[t]) || (state.todo || []).indexOf(t) > -1 || (state.retry || []).indexOf(t) > -1);      // retry: another module's table not copied the last time
    // the "Backup" button also LOOKS at the Sheet: a tab that is missing, or does not have exactly the rows of its table
    // (someone deleted or cleared it), is written again even though the table itself did not change
    let meta0 = null;
    if (opt.manual && !full) {
      meta0 = G('GET', '/v4/spreadsheets/' + sheetId + '?fields=sheets(properties,protectedRanges(range,warningOnly,requestingUserCanEdit))');
      const have = {}; (meta0.sheets || []).forEach(s => { have[s.properties.title] = (s.properties.gridProperties || {}).rowCount; });
      changed = tables.filter(t => changed.indexOf(t) > -1 || have[tabOf(t)] === undefined || (!rem[t] && !volFilter(t) && /^\d+\|/.test(sig[t]) && have[tabOf(t)] !== Math.max(rowsOf(t) + 1, 2)));
    }
    const info = { ok: true, lastCheck: nowIso, lastRun: state.lastRun || '', lastChangeCopied: state.lastChangeCopied || '', url: url, sheetN: Number(vol.n) || 1, sheets: vols.length, cells: Number(state.cells) || 0 };
    if (remNote) info.engNote = remNote;
    const lines = [], doneNow = {};
    let stopped = false;
    if (changed.length) {
      const sid = '/v4/spreadsheets/' + sheetId;
      const meta = meta0 || G('GET', sid + '?fields=sheets(properties,protectedRanges(range,warningOnly,requestingUserCanEdit))');
      const byTitle = {}, locked = {};
      (meta.sheets || []).forEach(s => { byTitle[s.properties.title] = s.properties;
        if ((s.protectedRanges || []).some(p => !p.warningOnly && p.requestingUserCanEdit === false)) locked[s.properties.title] = true; });
      // tabs the old Apps Script backup protected for its owner only: this app cannot write them until the protection is removed
      const stuck = changed.map(tabOf).concat(['Backup Status']).filter(x => locked[x]);
      if (stuck.length) throw new Error('These tabs of the backup Sheet are protected (by the old backup), so they cannot be written: ' + stuck.slice(0, 6).join(', ') + (stuck.length > 6 ? ' … (' + stuck.length + ' tabs)' : '') +
        '. Open the Sheet → Data → Protect sheets and ranges → remove each protection (once), and stop the old Apps Script backup so it does not protect them again.');
      // what goes into a tab – the same tab names and headings as always. EVERY TEXT STAYS THE TEXT IT IS: the Sheet is told so
      // (a leading apostrophe, which it does not show). Until 07-10-2026 the Sheet was left to guess, and it turned an account
      // number 000123456789 into 123456789, a long one into 1.23457E+17, a challan "12/5" into the 12th of May. Dates and
      // times of the database (2026-09-01, 2026-09-01T10:15:00+00:00) are left as they were – the Sheet shows them as dates.
      let cut = 0;      // a Sheet cell holds 50,000 letters at most: longer values are cut, and the status page says how many
      const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)?)?$/;
      const cell = (t, col, v) => { v = sbSafe_(t, col, v);
        if (v === null || v === undefined) return '';
        if (v && typeof v === 'object') v = v.__hidden ? '(hidden)' : JSON.stringify(v);
        if (typeof v === 'string') { if (v.length > 49000) { cut++; v = v.slice(0, 49000) + ' …(cut: longer than a Sheet cell can hold)'; } return v === '' || ISO.test(v) ? v : "'" + v; }
        return v; };
      const missing = changed.map(tabOf).concat(['Backup Status']).filter(x => !byTitle[x]);
      if (missing.length) { const rep = G('POST', sid + ':batchUpdate', { requests: missing.map(x => ({ addSheet: { properties: { title: x, gridProperties: { rowCount: 2, columnCount: 2, frozenRowCount: 1 } } } })) });
        (rep.replies || []).forEach(r => { if (r.addSheet) byTitle[r.addSheet.properties.title] = r.addSheet.properties; }); }
      // one group of tabs: every tab to its exact size + heading style – one call; the values – a few big calls
      const writeTabs = jobs => {
        if (!jobs.length) return;
        const shape = [];
        // (update-141) a job with "from" adds rows at the end of its tab: the tab grows to "total" rows, the values go from row from + 1
        jobs.forEach(x => { const id = byTitle[x.title].sheetId;
          shape.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: { rowCount: x.total || x.data.length, columnCount: x.cols, frozenRowCount: 1 } }, fields: 'gridProperties(rowCount,columnCount,frozenRowCount)' } });
          shape.push({ repeatCell: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.91, green: 0.93, blue: 0.95 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } }); });
        G('POST', sid + ':batchUpdate', { requests: shape });
        let pack = [], size = 0;
        const send = () => { if (pack.length) { G('POST', sid + '/values:batchUpdate', { valueInputOption: 'USER_ENTERED', data: pack }); pack = []; size = 0; } };
        jobs.forEach(x => { const name = "'" + x.title.replace(/'/g, "''") + "'";
          let i = 0; while (i < x.data.length) { let j = i, part = 0; while (j < x.data.length && (j === i || (part < 1200000 && size + part < 3000000)) && j - i < 5000) { part += JSON.stringify(x.data[j]).length; j++; }
            pack.push({ range: name + '!A' + ((x.from || 0) + i + 1), values: x.data.slice(i, j) }); size += part; i = j; if (size >= 3000000) send(); } });
        send();
      };
      /* (update-141) THE LOGS: ONLY THEIR NEW ROWS. A log only grows; its tab is sorted by its key like every tab. The notes
       * (state.app) say how many rows were copied (n) and the last key (last). The new rows (key after "last") are added at the
       * end of the tab only when everything agrees: the tab has exactly n rows (nobody changed it in the Sheet), and the table
       * has exactly n rows up to the newest key read (none was deleted, none came in below "last"). Anything else – and once in
       * 30 days – the tab is written whole, as before, and the notes start again from it. */
      const APPEND_ = { activity_log: 'id', store_activity: 'id' };      // (the Store's log: its id is a growing number)
      const apps = Object.assign({}, state.app || {}), MONTH = 30 * day;
      const countUpTo = (t, kcol, last) => { const r = UrlFetchApp.fetchAll([{ url: c.url + '/rest/v1/' + t + '?select=' + kcol + '&' + kcol + '=lte.' + encodeURIComponent(last) + volFilter(t) + '&limit=1', method: 'get', muteHttpExceptions: true, headers: { apikey: c.key, Prefer: 'count=exact' } }])[0];
        if (r.getResponseCode() >= 300) return -1; const h = r.getHeaders() || {}, n = Number(String(h['content-range'] || h['Content-Range'] || '').split('/')[1]); return isFinite(n) ? n : -1; };
      // a log read page by page BY ITS KEY (after the last key of the page before), never by position: a row saved meanwhile
      // can then neither come twice nor push another row out of the read (review of 21-10-2026)
      const byKey = (t, kcol, after) => { const out = []; let last = after;
        for (;;) { const page = sbFetch_('GET', '/rest/v1/' + t + '?select=*&order=' + kcol + '.asc' + (last !== undefined && last !== null && last !== '' ? '&' + kcol + '=gt.' + encodeURIComponent(String(last)) : '&' + kcol + '=not.is.null') + volFilter(t), undefined, { Range: '0-999', 'Range-Unit': 'items' }) || [];      // (a filter on every page: always asked of the database, never of the server's memory)
          out.push.apply(out, page); if (page.length < 1000) break; last = page[page.length - 1][kcol]; }
        return out; };
      const distinct = (list, kcol) => new Set(list.map(r => String(r[kcol]))).size === list.length;
      const colsOf = t => (cat[t] || (rem[t] && rem[t].cols) || []).map(x => x.name).join(',');
      const newRowsOf = t => {      // the new rows to add, or null: write the tab whole
        const kcol = rem[t] ? '' : APPEND_[t], a = apps[t], tab = byTitle[tabOf(t)];
        if (!kcol || !a || !(Number(a.n) > 0) || a.last === undefined || a.last === null || a.last === '' || !(nowMs - ms(a.whole) < MONTH)) return null;
        if (a.cols !== colsOf(t)) return null;      // a column added or taken away: the tab's heading and rows must change – whole
        if (missing.indexOf(tabOf(t)) > -1) return null;      // the tab was made again just now: whole
        if (!tab || !tab.gridProperties || Number(tab.gridProperties.rowCount) !== Number(a.n) + 1) return null;
        const add = byKey(t, kcol, a.last);
        if (!distinct(add, kcol)) return null;
        const top = add.length ? String(add[add.length - 1][kcol]) : String(a.last);
        return countUpTo(t, kcol, top) === Number(a.n) + add.length ? add : null;
      };
      // the smallest tables first: whatever happens later, most of the copy is up to date; (review 25-10-2026) this site's own
      // tables before the other modules' – a slow or failing Engineering never holds back the site's own data
      changed.sort((a, b) => (rem[a] ? 1 : 0) - (rem[b] ? 1 : 0) || rowsOf(a) - rowsOf(b) || (a < b ? -1 : 1));
      const copied = Object.assign({}, state.copied || {}), remBad = {}, remPos = Object.assign({}, state.remPos || {});
      let k = 0;
      while (k < changed.length) {
        if (Date.now() - T0 > BUDGET) { stopped = true; break; }
        const group = []; let rows = 0;
        while (k < changed.length && (!group.length || rows + rowsOf(changed[k]) <= GROUP_ROWS)) { group.push(changed[k]); rows += rowsOf(changed[k]); k++; }
        try {
          // (read with a filter that leaves nothing out, so that this is asked from the database itself and not answered from the server's memory)
          const jobs = group.map(t => {
            if (rem[t]) { const x = rem[t], hdr = x.cols.map(y => y.name); let got;
              // where a big table stopped in the run before (the same table, the same rows, the same start) – else from its first row
              const was = remPos[t], pos = was && was.sig === sig[t] && was.since === fromOf(t) && was.sheet === sheetId && missing.indexOf(x.title) === -1 ? Number(was.off) || 0 : 0;
              // (review 25-10-2026) another module that fails here is noted and left for the next run – never stops this site's backup
              try { got = bkRemoteRows_(x, siteCode, fromOf(t), left, pos, knob('BK_REMOTE_ROWS', 300, 20, 300)); } catch (e) { if (/BK_OUT_OF_TIME/.test(String(e && e.message))) throw e; remBad[t] = String((e && e.message) || e).slice(0, 200); return null; }
              const body = got.list.map(r => x.cols.map(y => cell(t, y.name, r[y.name])));
              if (!pos) { const data = [hdr].concat(body); if (data.length < 2) data.push(hdr.map(() => ''));
                return { table: t, title: x.title, data: data, cols: hdr.length, n: got.list.length, app: null, part: got.done ? null : got.next }; }
              return { table: t, title: x.title, data: body, cols: hdr.length, from: 1 + pos, total: Math.max(2, 1 + pos + got.list.length), n: pos + got.list.length, app: null, part: got.done ? null : got.next }; }
            const cols = cat[t], hdr = cols.map(x => sbHeader_(t, x.name)), kcol = APPEND_[t];
            const add = newRowsOf(t);
            if (add) { const a = apps[t]; return { table: t, title: tabOf(t), data: add.map(r => cols.map(x => cell(t, x.name, r[x.name]))), cols: hdr.length, from: Number(a.n) + 1, total: Number(a.n) + 1 + add.length, added: add.length,
              n: Number(a.n) + add.length, app: { n: Number(a.n) + add.length, last: add.length ? String(add[add.length - 1][kcol]) : a.last, whole: a.whole, cols: a.cols } }; }
            const hasId = cols.some(x => x.name === 'id'), list = kcol ? byKey(t, kcol, '') : sbAllRows_(t, (hasId ? '&id=not.is.null' : '') + volFilter(t));
            const data = [hdr].concat(list.map(r => cols.map(x => cell(t, x.name, r[x.name])))); if (data.length < 2) data.push(hdr.map(() => ''));
            // a log's notes start from this whole copy – only when its keys came each once (else the next run writes it whole again)
            return { table: t, title: tabOf(t), data: data, cols: hdr.length, n: list.length, app: kcol ? (distinct(list, kcol) ? { n: list.length, last: list.length ? String(list[list.length - 1][kcol]) : '', whole: nowIso, cols: colsOf(t) } : 'none') : null }; });
          group.filter(t => remBad[t]).forEach(t => { doneNow[t] = 1; if (fullRun) fullRun.done[t] = 1; lines.push([tabOf(t), 'not copied now – ' + remBad[t]]); });      // (its signature is kept old: the next run tries it again)
          const ok = jobs.filter(Boolean);
          writeTabs(ok.filter(x => !(x.added === 0)));      // a log with no new row: its tab is already right
          ok.forEach(x => {
            if (x.part !== null && x.part !== undefined) { remPos[x.table] = { off: x.part, sig: sig[x.table], since: fromOf(x.table), sheet: sheetId, at: remPos[x.table] && remPos[x.table].off ? remPos[x.table].at : nowIso }; stopped = true;
              lines.push([x.title, x.n + ' rows so far – the rest goes on by itself']); return; }      // (a big table of another module: the next run goes on from here)
            delete remPos[x.table];
            old[x.table] = sig[x.table]; doneNow[x.table] = 1; copied[x.table] = (rem[x.table] && state.remPos && state.remPos[x.table] && state.remPos[x.table].at) || nowIso; if (fullRun) fullRun.done[x.table] = 1; if (x.app === 'none') delete apps[x.table]; else if (x.app) apps[x.table] = x.app;
            lines.push([x.title, x.added !== undefined ? '+' + x.added + ' new rows (' + x.n + ' in all)' : x.n + ' rows']); });
          keep({ sig: old, fullRun: fullRun, todo: changed.filter(t => !doneNow[t]), lastRun: nowIso, app: apps, copied: copied, remPos: remPos, retry: Object.keys(remBad) });      // noted at once: a run that is cut off after this loses nothing of it
          if (stopped) break;
        } catch (e) { if (/BK_OUT_OF_TIME/.test(String(e && e.message))) { stopped = true; break; } throw e; }
      }
      const todo = changed.filter(t => !doneNow[t]);
      if (lines.length) {
        info.lastRun = nowIso;
        const when = Utilities.formatDate(new Date(nowMs), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm:ss');
        const fromTxt = sinceTxt ? Utilities.formatDate(new Date(sinceTxt), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm') : '';
        const st = [[T.kind === 'portal' ? 'RCL ERP Portal – copy of the Portal database (made by the app, do not edit)' : 'RCL Fleet ERP – copy of the Supabase database (made by the app, do not edit)', ''],
          [T.kind === 'portal' ? 'Backup of' : 'Site', T.kind === 'portal' ? 'the Portal (users, access, sites, companies, modules, the Super Admin\'s record)' : (siteCode || 'this site')],
          ['This Sheet', 'Sheet ' + vol.n + (vols.length > 1 ? ' of ' + vols.length : '')],
          ['It holds', later ? 'every row new or changed since ' + (sinceTxt ? fromTxt : 'the first day') + (Object.keys(cuts).length ? ' at the earliest (each table from an hour before its last copy into Sheet ' + (Number(vol.n) - 1) + ')' : '') + ' (India time), the deletions since then (Deleted Rows), and the masters whole – together with Sheet 1' + (Number(vol.n) > 2 ? ' … ' + (Number(vol.n) - 1) : '') + ' it is the whole data' : 'everything, from the first day'],
          ['Last backup (India time)', when], ['Kind', full ? 'Full – every table' : 'Changed tables only'],
          ['Still to copy (goes on by itself in a few minutes)', todo.length ? todo.map(tabOf).join(', ') : Object.keys(remBad).length ? 'nothing of this site; not copied now (tried again at the next backup): ' + Object.keys(remBad).map(tabOf).join(', ') : 'nothing – complete'],
          ['Cells too long for a Sheet (cut)', cut ? cut + ' – the database has them whole' : 'none'], ['', ''], ['Table', 'Rows copied now']].concat(lines);
        try { writeTabs([{ title: 'Backup Status', data: st, cols: 2 }]); } catch (e) { if (!/BK_OUT_OF_TIME/.test(String(e && e.message))) throw e; stopped = true; }
      }
      if (todo.length) info.pending = todo.length;
      if (Object.keys(remBad).length) info.engNote = ((info.engNote ? info.engNote + ' ' : '') + 'Not copied now (tried again at the next backup): ' + Object.keys(remBad).map(t => tabOf(t) + ' – ' + remBad[t]).join('; ')).slice(0, 600);
    }
    // (update-157) how full the Sheet is (Google allows 10 million cells in one): read after it was written, and by "Backup now"
    if (changed.length || opt.manual) {
      try { const mm = G('GET', '/v4/spreadsheets/' + sheetId + '?fields=sheets(properties(title,gridProperties(rowCount,columnCount)))');
        info.cells = (mm.sheets || []).reduce((n, x) => { const gp = (x.properties || {}).gridProperties || {}; return n + (Number(gp.rowCount) || 0) * (Number(gp.columnCount) || 0); }, 0);
        info.cellsAt = nowIso; bkCellsKeep_(T, vol, info.cells, nowIso);
      } catch (e) { if (!/BK_OUT_OF_TIME/.test(String(e && e.message))) info.cellsNote = String((e && e.message) || e).slice(0, 200); }
    }
    info.cellsPct = Math.round((Number(info.cells) || 0) / BK_CELLS_ * 1000) / 10;
    const todo = changed.filter(t => !doneNow[t]);
    if (!todo.length) { info.lastChangeCopied = newest || state.lastChangeCopied || ''; }
    const fullDone = full && !todo.length;
    keep({ sig: changed.length ? old : sig, lastCheck: nowIso, lastTry: '', lastRun: info.lastRun, lastFull: fullDone ? nowIso : (state.lastFull || ''), fullRun: full && !fullDone ? fullRun : null,
      lastChangeCopied: info.lastChangeCopied, todo: todo, running: '', died: 0, cells: Number(info.cells) || 0 });
    P.setProperty(T.info, JSON.stringify(info));
    if (!changed.length) return { upToDate: true, info: info };
    return { full: fullDone, lines: lines, info: info, pending: todo.length, ok: true };
  } catch (e) {
    // (review 25-10-2026) out of time before the first group (a short "Backup now"): not a failure – the rest goes on by itself
    if (/BK_OUT_OF_TIME/.test(String(e && e.message))) { try { keep({ running: '', died: 0, lastTry: nowIso }); } catch (e2) { /* noted next time */ } return { ok: true, timedOut: true, pending: (state.todo || []).length, info: bkInfoOf_(T) || {} }; }
    const bad = { ok: false, error: String((e && e.message) || e), lastCheck: state.lastCheck || '', lastTry: nowIso, lastRun: state.lastRun || '', url: url, sheetN: Number(vol.n) || 1, sheets: vols.length, cells: Number(state.cells) || 0 };
    try { keep({ lastTry: nowIso, running: '', died: 0 }); P.setProperty(T.info, JSON.stringify(bad)); } catch (e2) { /* shown next time */ }
    if (opt.auto) return { ok: false };
    throw e;
  } finally { __unlockNamed(T.lock); }
}
`;
