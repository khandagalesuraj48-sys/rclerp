/* =====================================================================
 * RCL FLEET ERP – BRIDGE between this Apps Script project and the app on its own web address (Vercel)
 * Paste this as a NEW file "VercelBridge" in the Apps Script project. It changes nothing by itself.
 *
 * After the move, this Apps Script project keeps only ONE job: the Google Sheet backup (its time triggers stay as they are).
 *
 *   exportSettingsToWeb()  – run ONCE from the editor at the move (and it is safe to run again): copies the app's
 *                            settings and counters (Script Properties: bill settings, company details, format names,
 *                            last numbers, tank settings …) into Supabase, where the new app reads them.
 *                            Keys of Supabase and of the backup are NOT copied.
 *   webMirror_()           – the backup tells its status (time of the last backup) to the new app.
 *   doPost()               – "Backup now" pressed in the new app runs the backup here (optional; needs the script
 *                            property GAS_BACKUP_KEY = a long secret text, the same text in Vercel).
 *
 * To close the OLD app for everyone at the move: script property APP_MOVED_TO = the new link (see Code.gs movedTo_).
 * ===================================================================== */
function exportSettingsToWeb() {
  sbOwnerOnly_();
  const skip = k => /^(SUPABASE_|DATA_SOURCE$|APP_MOVED_TO$|GAS_|SB_)/.test(k) && k !== 'SB_INFO';
  const all = PropertiesService.getScriptProperties().getProperties(), out = {};
  Object.keys(all).forEach(k => { if (!skip(k)) out[k] = String(all[k]); });
  sbFetch_('POST', '/rest/v1/rpc/web_props_set', { p: out });
  Logger.log('Copied ' + Object.keys(out).length + ' settings to Supabase (web.props): ' + Object.keys(out).sort().join(', '));
}
// one setting for the new app (used by the backup for its status)
function webMirror_(key, value) {
  const o = {}; o[key] = value;
  sbFetch_('POST', '/rest/v1/rpc/web_props_set', { p: o });
}
// "Backup now" from the new app
function doPost(e) {
  const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const key = PropertiesService.getScriptProperties().getProperty('GAS_BACKUP_KEY');
    if (!key || String(key).length < 16 || b.key !== key) return out({ error: 'Not allowed.' });
    if (b.action === 'backupNow') {
      const r = sbBackupNow_() || {};
      if (!r.info) r.info = sbBackupInfo_();
      return out({ result: r });
    }
    return out({ error: 'Unknown action.' });
  } catch (err) { return out({ error: String((err && err.message) || err) }); }
}
