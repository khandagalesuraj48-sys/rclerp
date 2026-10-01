// This file is text: the backup code that is added to the app's server code (see runtime.js).
module.exports = String.raw`
/* ================= GOOGLE SHEET BACKUP – from this server, no Apps Script =================
 * (runs in the same place as the app's own code, so it uses the app's own table list, tab names and headings)
 * What it does: looks at every table of the database; a table that changed since the last backup (rows added,
 * changed or deleted) has its tab in the Google Sheet written again, whole. Once a day every tab is written again.
 * The Sheet is a copy for reading – the app never reads it back.
 * When: a few minutes after any change while somebody has the app open (the page asks), every night (Vercel cron),
 * and at once with the "Backup" button. Two backups never run together (lock "backup"). */
function webBackup_(opt) {
  opt = opt || {};
  const cfg = JSON.parse(__backupConfig());
  if (!cfg.ok) { if (opt.auto) return { off: true }; throw new Error(cfg.error); }
  const P = PropertiesService.getScriptProperties();
  const url = 'https://docs.google.com/spreadsheets/d/' + cfg.sheetId;
  const readState = () => { try { return JSON.parse(P.getProperty('BK_STATE') || '{}') || {}; } catch (e) { return {}; } };
  let state = readState();
  const nowMs = Date.now();
  if (opt.auto && !opt.full && state.lastCheck && nowMs - new Date(state.lastCheck).getTime() < 4 * 60000) return { skipped: true };
  if (!__lockNamed('backup', 110)) return { busy: true, info: sbBackupInfo_() };
  try {
    const G = (method, path, body) => { const r = JSON.parse(__g(method, path, body === undefined ? '' : JSON.stringify(body)));
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
    const day = 24 * 3600000, full = !!opt.full || !state.lastFull || nowMs - new Date(state.lastFull).getTime() > day;
    const old = state.sig || {};
    let changed = tables.filter(t => full || old[t] !== sig[t] || /\?\|/.test(sig[t]));
    // the "Backup" button also LOOKS at the Sheet: a tab that is missing, or does not have exactly the rows of its table
    // (someone deleted or cleared it), is written again even though the table itself did not change
    let meta0 = null;
    if (opt.manual && !full) {
      meta0 = G('GET', '/v4/spreadsheets/' + cfg.sheetId + '?fields=sheets(properties,protectedRanges(range,warningOnly,requestingUserCanEdit))');
      const have = {}; (meta0.sheets || []).forEach(s => { have[s.properties.title] = (s.properties.gridProperties || {}).rowCount; });
      const rowsOf = t => Number(String(sig[t]).split('|')[0]);
      changed = tables.filter(t => changed.indexOf(t) > -1 || have[sbTabName_(t)] === undefined || (isFinite(rowsOf(t)) && have[sbTabName_(t)] !== Math.max(rowsOf(t) + 1, 2)));
    }
    const nowIso = new Date(nowMs).toISOString();
    const info = { ok: true, lastCheck: nowIso, lastRun: state.lastRun || '', lastChangeCopied: newest || state.lastChangeCopied || '', url: url };
    const lines = [];
    if (changed.length) {
      const sid = '/v4/spreadsheets/' + cfg.sheetId;
      const meta = meta0 || G('GET', sid + '?fields=sheets(properties,protectedRanges(range,warningOnly,requestingUserCanEdit))');
      const byTitle = {}, locked = {};
      (meta.sheets || []).forEach(s => { byTitle[s.properties.title] = s.properties;
        if ((s.protectedRanges || []).some(p => !p.warningOnly && p.requestingUserCanEdit === false)) locked[s.properties.title] = true; });
      // what goes into every changed tab – written the way the backup always wrote it (same tab names, headings and cell values)
      let cut = 0;      // a Sheet cell holds 50,000 letters at most: longer values are cut, and the status page says how many
      const cell = (t, col, v) => { v = sbCell_(sbSafe_(t, col, v)); if (typeof v === 'string' && v.length > 49000) { cut++; return v.slice(0, 49000) + ' …(cut: longer than a Sheet cell can hold)'; } return v; };
      const jobs = changed.map(t => { const cols = cat[t], rows = sbAllRows_(t), hdr = cols.map(x => sbHeader_(t, x.name));
        const data = [hdr].concat(rows.map(r => cols.map(x => cell(t, x.name, r[x.name])))); if (data.length < 2) data.push(hdr.map(() => ''));
        lines.push([sbTabName_(t), rows.length + ' rows']); return { title: sbTabName_(t), data: data, cols: hdr.length }; });
      const when = Utilities.formatDate(new Date(nowMs), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm:ss');
      const st = [['RCL Fleet ERP – copy of the Supabase database (made by the app, do not edit)', ''], ['Last backup (India time)', when], ['Kind', full ? 'Full – every table' : 'Changed tables only'], ['Cells too long for a Sheet (cut)', cut ? cut + ' – the database has them whole' : 'none'], ['', ''], ['Table', 'Rows copied now']].concat(lines);
      jobs.push({ title: 'Backup Status', data: st, cols: 2 });
      // tabs the old Apps Script backup protected for its owner only: this app cannot write them until the protection is removed
      const stuck = jobs.map(x => x.title).filter(x => locked[x]);
      if (stuck.length) throw new Error('These tabs of the backup Sheet are protected (by the old backup), so they cannot be written: ' + stuck.slice(0, 6).join(', ') + (stuck.length > 6 ? ' … (' + stuck.length + ' tabs)' : '') +
        '. Open the Sheet → Data → Protect sheets and ranges → remove each protection (once), and stop the old Apps Script backup so it does not protect them again.');
      // 1) tabs that are missing – one call   2) every tab to its exact size + heading style – one call   3) the values – a few big calls
      const miss = jobs.filter(x => !byTitle[x.title]);
      if (miss.length) { const rep = G('POST', sid + ':batchUpdate', { requests: miss.map(x => ({ addSheet: { properties: { title: x.title, gridProperties: { rowCount: x.data.length, columnCount: x.cols, frozenRowCount: 1 } } } })) });
        (rep.replies || []).forEach(r => { if (r.addSheet) byTitle[r.addSheet.properties.title] = r.addSheet.properties; }); }
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
      info.lastRun = nowIso;
    }
    state = { sig: sig, lastCheck: nowIso, lastRun: info.lastRun, lastFull: changed.length && full ? nowIso : (state.lastFull || ''), lastChangeCopied: info.lastChangeCopied };
    P.setProperties({ BK_STATE: JSON.stringify(state), SB_INFO: JSON.stringify(info) });
    return changed.length ? { full: full, lines: lines, info: info } : { upToDate: true, info: info };
  } catch (e) {
    const bad = { ok: false, error: String((e && e.message) || e), lastCheck: new Date(nowMs).toISOString(), lastRun: state.lastRun || '', url: url };
    try { P.setProperties({ SB_INFO: JSON.stringify(bad) }); } catch (e2) { /* shown next time */ }
    if (opt.auto) return { ok: false };
    throw e;
  } finally { __unlockNamed('backup'); }
}
`;
