// This file is text: the backup code that is added to the app's server code (see runtime.js).
module.exports = String.raw`
/* ================= GOOGLE SHEET BACKUP – from this server, no Apps Script =================
 * (runs in the same place as the app's own code, so it uses the app's own table list, tab names and headings)
 * What it does: looks at every table of the database; a table that changed since the last backup (rows added,
 * changed or deleted) has its tab in the Google Sheet written again, whole. Once a day every tab is written again.
 * The Sheet is a copy for reading – the app never reads it back.
 * When: a few minutes after any change while somebody has the app open (the page asks), every night (Vercel cron),
 * and at once with the "Backup" button. Two backups never run together (lock "backup").
 *
 * IN PIECES, AND IT GOES ON WHERE IT STOPPED (07-10-2026). A request of this server is stopped after 58 seconds. Until now
 * the backup read every changed table, wrote them all, and only at the very END noted what it had done. A backup that
 * needed longer than 58 seconds was cut off in the middle with nothing noted: the next one started from the beginning
 * and was cut off again – for ever – while the app kept showing the last good time in green.
 * Now:  - the tables are written in GROUPS (the small ones together, a big one alone), the smallest first, and after
 *         every group "these are done" is written down at once;
 *       - the run stops by itself after about 36 seconds; what is left (state.todo) is taken up by the next asking
 *         (the open pages ask every few minutes; an unfinished backup does not wait for the 4-minute rule);
 *       - a run that was cut off all the same leaves a mark (state.running); after two in a row the app shows the
 *         backup as failed, with the reason, instead of staying green;
 *       - after a failure the next automatic try waits 4 minutes too (every open page used to try again at once).
 * A tab is always written whole and to its exact size, so writing one again is harmless. */
function webBackup_(opt) {
  opt = opt || {};
  const cfg = JSON.parse(__backupConfig());
  if (!cfg.ok) { if (opt.auto) return { off: true }; throw new Error(cfg.error); }
  const P = PropertiesService.getScriptProperties();
  const url = 'https://docs.google.com/spreadsheets/d/' + cfg.sheetId;
  const readState = () => { try { return JSON.parse(P.getProperty('BK_STATE') || '{}') || {}; } catch (e) { return {}; } };
  let state = readState();
  const nowMs = Date.now(), nowIso = new Date(nowMs).toISOString(), ms = iso => (iso ? new Date(iso).getTime() || 0 : 0);
  const unfinished = !!(state.todo && state.todo.length);
  // the automatic check: not more often than every 4 minutes (counted from the last check OR the last failed try);
  // an unfinished backup goes on at the next asking – but not for several open pages in the same half minute
  if (opt.auto && !opt.full && !unfinished && Math.max(ms(state.lastCheck), ms(state.lastTry)) && nowMs - Math.max(ms(state.lastCheck), ms(state.lastTry)) < 4 * 60000) return { skipped: true };
  if (opt.auto && !opt.full && unfinished && nowMs - Math.max(ms(state.lastCheck), ms(state.lastTry)) < 30000) return { skipped: true };
  if (!__lockNamed('backup', 110)) return { busy: true, info: sbBackupInfo_() };
  // with the lock: the notes as they are NOW (while this request waited, another server may have finished a backup)
  try { if (typeof __propFresh === 'function') { const now = __propFresh('BK_STATE'); state = now ? (JSON.parse(now) || {}) : {}; } } catch (e) { /* the notes read at the start are used */ }
  if (opt.auto && !opt.full && !(state.todo && state.todo.length) && ms(state.lastCheck) && nowMs - ms(state.lastCheck) < 60000) { __unlockNamed('backup'); return { skipped: true }; }      // it was just done
  // how long one run works before it stops by itself, and how many rows go into one group – the app's settings may change
  // them (BK_BUDGET_MS, BK_GROUP_ROWS in web.props: for tests, or to tune a very big site); normally 36 s and 6,000 rows
  const knob = (k, d, lo, hi) => { const v = Number(P.getProperty(k)); return isFinite(v) && v >= lo && v <= hi ? v : d; };
  const T0 = Date.now(), BUDGET = knob('BK_BUDGET_MS', 36000, 1000, 40000), HARD = 52000, GROUP_ROWS = knob('BK_GROUP_ROWS', 6000, 1, 100000);
  const left = () => HARD - (Date.now() - T0);
  // the lock is ours and the mark of the run before is still there: that run did not end (it was cut off)
  const died = state.running ? (Number(state.died) || 0) + 1 : 0;
  const keep = o => { state = Object.assign({}, state, o); P.setProperty('BK_STATE', JSON.stringify(state)); };      // written to the database at once
  try {
    keep({ running: nowIso, died: died });
    if (died >= 2) P.setProperty('SB_INFO', JSON.stringify({ ok: false, error: 'The backup was cut off ' + died + ' times in a row before it could finish (a request may run 58 seconds). It is trying again now; if this stays, a table has become too big to copy in one go – tell the developer.', lastCheck: state.lastCheck || '', lastRun: state.lastRun || '', url: url }));
    const G = (method, path, body) => {
      if (left() < 6000) throw new Error('BK_OUT_OF_TIME');
      const r = JSON.parse(__g(method, path, body === undefined ? '' : JSON.stringify(body), left()));
      if (r.code >= 300) { let msg = String(r.text || '').slice(0, 300); try { msg = JSON.parse(r.text).error.message; } catch (e) {}
        if (r.code === 403) msg += ' – share the backup Sheet with ' + cfg.email + ' as Editor, and check that the Google Sheets API is enabled for the project of the service account.';
        if (r.code === 404) msg += ' – BACKUP_SHEET_ID is not a Sheet this service account can open.';
        throw new Error('Google Sheet (' + r.code + '): ' + msg); }
      return r.text ? JSON.parse(r.text) : {}; };
    const cat = sbCatalog_(), tables = Object.keys(cat).sort(), c = sbConf_();
    // what every table looks like now: number of rows + newest change
    const res = UrlFetchApp.fetchAll(tables.map(t => { const has = cat[t].some(x => x.name === 'updated_at');
      return { url: c.url + '/rest/v1/' + t + '?select=' + (has ? 'updated_at&order=updated_at.desc' : cat[t][0].name) + '&limit=1', method: 'get', muteHttpExceptions: true, headers: { apikey: c.key, Prefer: 'count=exact' } }; }));
    const sig = {}; let newest = '';
    tables.forEach((t, i) => { const r = res[i]; if (r.getResponseCode() >= 300) throw new Error('Could not read ' + t + ' (' + r.getResponseCode() + ').');
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
    let changed = tables.filter(t => (fullRun && !fullRun.done[t]) || old[t] !== sig[t] || /\?\|/.test(sig[t]) || (state.todo || []).indexOf(t) > -1);
    // the "Backup" button also LOOKS at the Sheet: a tab that is missing, or does not have exactly the rows of its table
    // (someone deleted or cleared it), is written again even though the table itself did not change
    let meta0 = null;
    if (opt.manual && !full) {
      meta0 = G('GET', '/v4/spreadsheets/' + cfg.sheetId + '?fields=sheets(properties,protectedRanges(range,warningOnly,requestingUserCanEdit))');
      const have = {}; (meta0.sheets || []).forEach(s => { have[s.properties.title] = (s.properties.gridProperties || {}).rowCount; });
      changed = tables.filter(t => changed.indexOf(t) > -1 || have[sbTabName_(t)] === undefined || (/^\d+\|/.test(sig[t]) && have[sbTabName_(t)] !== Math.max(rowsOf(t) + 1, 2)));
    }
    const info = { ok: true, lastCheck: nowIso, lastRun: state.lastRun || '', lastChangeCopied: state.lastChangeCopied || '', url: url };
    const lines = [], doneNow = {};
    let stopped = false;
    if (changed.length) {
      const sid = '/v4/spreadsheets/' + cfg.sheetId;
      const meta = meta0 || G('GET', sid + '?fields=sheets(properties,protectedRanges(range,warningOnly,requestingUserCanEdit))');
      const byTitle = {}, locked = {};
      (meta.sheets || []).forEach(s => { byTitle[s.properties.title] = s.properties;
        if ((s.protectedRanges || []).some(p => !p.warningOnly && p.requestingUserCanEdit === false)) locked[s.properties.title] = true; });
      // tabs the old Apps Script backup protected for its owner only: this app cannot write them until the protection is removed
      const stuck = changed.map(sbTabName_).concat(['Backup Status']).filter(x => locked[x]);
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
      const missing = changed.map(sbTabName_).concat(['Backup Status']).filter(x => !byTitle[x]);
      if (missing.length) { const rep = G('POST', sid + ':batchUpdate', { requests: missing.map(x => ({ addSheet: { properties: { title: x, gridProperties: { rowCount: 2, columnCount: 2, frozenRowCount: 1 } } } })) });
        (rep.replies || []).forEach(r => { if (r.addSheet) byTitle[r.addSheet.properties.title] = r.addSheet.properties; }); }
      // one group of tabs: every tab to its exact size + heading style – one call; the values – a few big calls
      const writeTabs = jobs => {
        const shape = [];
        jobs.forEach(x => { const id = byTitle[x.title].sheetId;
          shape.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: { rowCount: x.data.length, columnCount: x.cols, frozenRowCount: 1 } }, fields: 'gridProperties(rowCount,columnCount,frozenRowCount)' } });
          shape.push({ repeatCell: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.91, green: 0.93, blue: 0.95 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } }); });
        G('POST', sid + ':batchUpdate', { requests: shape });
        let pack = [], size = 0;
        const send = () => { if (pack.length) { G('POST', sid + '/values:batchUpdate', { valueInputOption: 'USER_ENTERED', data: pack }); pack = []; size = 0; } };
        jobs.forEach(x => { const name = "'" + x.title.replace(/'/g, "''") + "'";
          let i = 0; while (i < x.data.length) { let j = i, part = 0; while (j < x.data.length && (j === i || (part < 1200000 && size + part < 3000000)) && j - i < 5000) { part += JSON.stringify(x.data[j]).length; j++; }
            pack.push({ range: name + '!A' + (i + 1), values: x.data.slice(i, j) }); size += part; i = j; if (size >= 3000000) send(); } });
        send();
      };
      // the smallest tables first: whatever happens later, most of the copy is up to date
      changed.sort((a, b) => rowsOf(a) - rowsOf(b) || (a < b ? -1 : 1));
      let k = 0;
      while (k < changed.length) {
        if (Date.now() - T0 > BUDGET) { stopped = true; break; }
        const group = []; let rows = 0;
        while (k < changed.length && (!group.length || rows + rowsOf(changed[k]) <= GROUP_ROWS)) { group.push(changed[k]); rows += rowsOf(changed[k]); k++; }
        try {
          // (read with a filter that leaves nothing out, so that this is asked from the database itself and not answered from the server's memory)
          const jobs = group.map(t => { const cols = cat[t], hasId = cols.some(x => x.name === 'id'), list = sbAllRows_(t, hasId ? '&id=not.is.null' : ''), hdr = cols.map(x => sbHeader_(t, x.name));
            const data = [hdr].concat(list.map(r => cols.map(x => cell(t, x.name, r[x.name])))); if (data.length < 2) data.push(hdr.map(() => ''));
            return { table: t, title: sbTabName_(t), data: data, cols: hdr.length, n: list.length }; });
          writeTabs(jobs);
          jobs.forEach(x => { old[x.table] = sig[x.table]; doneNow[x.table] = 1; if (fullRun) fullRun.done[x.table] = 1; lines.push([x.title, x.n + ' rows']); });
          keep({ sig: old, fullRun: fullRun, todo: changed.filter(t => !doneNow[t]), lastRun: nowIso });      // noted at once: a run that is cut off after this loses nothing of it
        } catch (e) { if (/BK_OUT_OF_TIME/.test(String(e && e.message))) { stopped = true; break; } throw e; }
      }
      const todo = changed.filter(t => !doneNow[t]);
      if (lines.length) {
        info.lastRun = nowIso;
        const when = Utilities.formatDate(new Date(nowMs), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm:ss');
        const st = [['RCL Fleet ERP – copy of the Supabase database (made by the app, do not edit)', ''], ['Last backup (India time)', when], ['Kind', full ? 'Full – every table' : 'Changed tables only'],
          ['Still to copy (goes on by itself in a few minutes)', todo.length ? todo.map(sbTabName_).join(', ') : 'nothing – complete'],
          ['Cells too long for a Sheet (cut)', cut ? cut + ' – the database has them whole' : 'none'], ['', ''], ['Table', 'Rows copied now']].concat(lines);
        try { writeTabs([{ title: 'Backup Status', data: st, cols: 2 }]); } catch (e) { if (!/BK_OUT_OF_TIME/.test(String(e && e.message))) throw e; stopped = true; }
      }
      if (todo.length) info.pending = todo.length;
    }
    const todo = changed.filter(t => !doneNow[t]);
    if (!todo.length) { info.lastChangeCopied = newest || state.lastChangeCopied || ''; }
    const fullDone = full && !todo.length;
    keep({ sig: changed.length ? old : sig, lastCheck: nowIso, lastTry: '', lastRun: info.lastRun, lastFull: fullDone ? nowIso : (state.lastFull || ''), fullRun: full && !fullDone ? fullRun : null,
      lastChangeCopied: info.lastChangeCopied, todo: todo, running: '', died: 0 });
    P.setProperty('SB_INFO', JSON.stringify(info));
    if (!changed.length) return { upToDate: true, info: info };
    return { full: fullDone, lines: lines, info: info, pending: todo.length, ok: true };
  } catch (e) {
    const bad = { ok: false, error: String((e && e.message) || e), lastCheck: state.lastCheck || '', lastTry: nowIso, lastRun: state.lastRun || '', url: url };
    try { keep({ lastTry: nowIso, running: '', died: 0 }); P.setProperty('SB_INFO', JSON.stringify(bad)); } catch (e2) { /* shown next time */ }
    if (opt.auto) return { ok: false };
    throw e;
  } finally { __unlockNamed('backup'); }
}
`;
