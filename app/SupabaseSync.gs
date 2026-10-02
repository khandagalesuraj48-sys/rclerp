/* =====================================================================
 * RCL FLEET ERP – SUPABASE (step 1)
 *   1. migrateToSupabase()   – copies all data of this Google Sheet into Supabase (safe to run again)
 *   2. setupSupabaseBackup() – creates the backup Google Sheet and the automatic copy
 *   3. Supabase → backup Google Sheet: every 5 minutes (new / changed / deleted rows), every night a full
 *      rewrite, every Sunday a dated copy of the backup file. New tables become new tabs, new / removed columns
 *      follow automatically. The backup Sheet is a read-only copy (one way: Supabase → Sheet).
 * Script properties (Project Settings → Script properties):
 *   SUPABASE_URL         https://mydhljgncdszrglqppsv.supabase.co
 *   SUPABASE_SECRET_KEY  sb_secret_…   (Supabase → Project Settings → API Keys → Secret key; never share it)
 * ===================================================================== */
const SB_DEFAULT_URL_ = 'https://mydhljgncdszrglqppsv.supabase.co';

/* ---------- tables: [sheet header, database column, type] ---------- */
const SB_TABLES_ = [
  { table: 'master', tab: 'Master', title: 'Master', pk: 'id', key: r => sbStr_(r['Machinery Number']) || sbStr_(r['Machinery Name']), cols: [
    ['Machinery Number', 'machinery_number', 'text'], ['Machinery Name', 'machinery_name', 'text'], ['Type of Machinery', 'type', 'text'], ['Make', 'make', 'text'],
    ['Unit', 'unit', 'text'], ['Works On', 'works_on', 'text'], ['Log Book Format', 'log_book_format', 'text'], ['Standard Average (KM/Ltr)', 'std_km_per_ltr', 'numeric'], ['Standard Average (Ltr/Hr)', 'std_ltr_per_hr', 'numeric'],
    ['Owner Name', 'owner_name', 'text'], ['Ownership', 'ownership', 'text'], ['Diesel Supply', 'diesel_supply', 'text'], ['Status', 'status', 'text'],
    ['Active From', 'active_from', 'date'], ['Inactive From', 'inactive_from', 'date'], ['Tank Capacity (Ltr)', 'tank_capacity', 'numeric'],
    ['Monthly Rate', 'monthly_rate', 'numeric'], ['TDS Rate (%)', 'tds_rate', 'numeric'],
    ['Engine Number', 'engine_number', 'text'], ['Chassis Number', 'chassis_number', 'text'], ['Engine Make', 'engine_make', 'text'],
    ['Tax Valid Upto', 'tax_valid_upto', 'text'], ['PUC Valid Upto', 'puc_valid_upto', 'text'], ['Permit Valid Upto', 'permit_valid_upto', 'text'],
    ['Fitness Valid Upto', 'fitness_valid_upto', 'text'], ['Insurance Valid Upto', 'insurance_valid_upto', 'text'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'diesel_inward', tab: 'Diesel Inward', title: 'Diesel Inward', pk: 'id', key: r => sbStr_(r['Inward ID']), cols: [
    ['Date', 'date', 'date'], ['Location', 'location', 'text'], ['Pump Name', 'pump_name', 'text'], ['Qty (Ltr)', 'qty', 'numeric'], ['Rate', 'rate', 'numeric'],
    ['Amount', 'amount', 'numeric'], ['Bill Number', 'bill_number', 'text'], ['Bill Date', 'bill_date', 'date'], ['Balance', 'balance', 'numeric'], ['Created At', 'entered_at', 'timestamptz'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'diesel_transfer', tab: 'Diesel Transfer', title: 'Diesel Transfer', pk: 'id', key: r => sbStr_(r['Transfer ID']), cols: [
    ['Date', 'date', 'date'], ['Shift', 'shift', 'text'], ['From', 'from_location', 'text'], ['To', 'to_location', 'text'], ['Qty (Ltr)', 'qty', 'numeric'],
    ['Remark', 'remark', 'text'], ['From Balance', 'from_balance', 'numeric'], ['To Balance', 'to_balance', 'numeric'], ['Created At', 'entered_at', 'timestamptz'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'diesel_issue', tab: 'Diesel Issue', title: 'Diesel Issue', pk: 'id', key: r => sbStr_(r['Issue ID']), cols: [
    ['Issue Date', 'issue_date', 'date'], ['Shift', 'shift', 'text'], ['Diesel Source', 'source', 'text'], ['Machinery Number', 'machinery', 'text'],
    ['Type of Machinery', 'type', 'text'], ['Owner Name', 'owner_name', 'text'], ['Diesel Qty (Ltr)', 'qty', 'numeric'], ['KM Reading', 'km_reading', 'numeric'],
    ['Hrs Reading', 'hrs_reading', 'numeric'], ['Driver Name', 'driver_name', 'text'], ['Remark', 'remark', 'text'], ['Diesel Supply', 'diesel_supply', 'text'],
    ['Debit Rate', 'debit_rate', 'numeric'], ['Balance', 'balance', 'numeric'], ['Current Diesel Issue Reading', 'dispenser_reading', 'numeric'], ['Created At', 'entered_at', 'timestamptz'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'log_book', tab: 'Log Book', title: 'Log Book', pk: 'id',
    key: r => [sbStr_(r['Machinery Number']), sbDate_(r['Date']), sbStr_(r['Shift']) || 'Full Day'].join('|'), cols: [
    ['Date', 'date', 'date'], ['Machinery Number', 'machinery', 'text'], ['Shift', 'shift', 'text'], ['Owner Name', 'owner_name', 'text'], ['Type of Machinery', 'type', 'text'], ['Unit', 'unit', 'text'],
    ['Opening KM', 'opening_km', 'numeric'], ['Closing KM', 'closing_km', 'numeric'], ['Working KM', 'working_km', 'numeric'],
    ['Opening Hrs', 'opening_hrs', 'numeric'], ['Closing Hrs', 'closing_hrs', 'numeric'], ['Working Hrs', 'working_hrs', 'numeric'],
    ['Opening Diesel', 'opening_diesel', 'numeric'], ['Diesel Qty (Ltr)', 'diesel_qty', 'numeric'], ['Total Diesel Consumption', 'consumed_std', 'numeric'], ['Stock Balance', 'closing_diesel', 'numeric'],
    ['Standard Average (KM/Ltr)', 'std_km_per_ltr', 'numeric'], ['Standard Average (Ltr/Hr)', 'std_ltr_per_hr', 'numeric'],
    ['Diesel Consumption - KM', 'consumption_km', 'numeric'], ['Diesel Consumption - Hrs', 'consumption_hrs', 'numeric'],
    ['KM Reading', 'km_reading', 'numeric'], ['Hrs Reading', 'hrs_reading', 'numeric'], ['Diesel Readings', 'diesel_readings', 'text'],
    ['Chainage From', 'chainage_from', 'text'], ['Chainage To', 'chainage_to', 'text'], ['Chainage No.', 'chainage_no', 'text'], ['Work Done', 'work_done', 'text'],
    ['Trip', 'trip', 'text'], ['Driver Name', 'driver_name', 'text'], ['Remark', 'remark', 'text'],
    ['Start Time', 'start_time', 'text'], ['End Time', 'end_time', 'text'], ['Break (min)', 'break_min', 'numeric'], ['Time Hrs', 'time_hrs', 'numeric'], ['Challan No', 'challan_no', 'text'], ['Item Work', 'item_work', 'text'], ['Debit To', 'debit_to', 'text'], ['Debit Rate', 'debit_rate', 'numeric'], ['Meter Note', 'meter_note', 'text'],
    ['Actual Average', 'actual_average', 'text'], ['Extra / Short Diesel', 'extra_short', 'numeric'], ['Fill Cycle', 'fill_cycle', 'text'],
    ['Opening Diesel Set', 'opening_diesel_set', 'numeric'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'tank_check', tab: 'Tank Check', title: 'Tank Check', pk: 'id', key: r => sbStr_(r['Check ID']), cols: [
    ['Date', 'date', 'date'], ['Machinery Number', 'machinery', 'text'], ['System Diesel (Ltr)', 'system_diesel', 'numeric'], ['Physical Diesel (Ltr)', 'physical_diesel', 'numeric'],
    ['Difference (Ltr)', 'difference', 'numeric'], ['Method', 'method', 'text'], ['Litres To Fill', 'litres_to_fill', 'numeric'], ['Reason', 'reason', 'text'],
    ['Checked By', 'checked_by', 'text'], ['Created At', 'entered_at', 'timestamptz'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'vendors', tab: 'Vendors', title: 'Vendors', pk: 'id', key: r => sbStr_(r['Vendor Name']).toUpperCase(), cols: [
    ['Vendor Name', 'vendor_name', 'text'], ['Ownership', 'ownership', 'text'], ['GST Registered', 'gst_registered', 'text'], ['GST Number', 'gst_number', 'text'],
    ['GST %', 'gst_percent', 'numeric'], ['PAN Number', 'pan_number', 'text'], ['TDS %', 'tds_percent', 'numeric'], ['Bank Name', 'bank_name', 'text'], ['Branch', 'branch', 'text'],
    ['Account Number', 'account_number', 'text'], ['IFSC Code', 'ifsc_code', 'text'], ['Address', 'address', 'text'], ['Phone', 'phone', 'text'], ['Remark', 'remark', 'text'],
    ['Aadhaar Number', 'aadhaar_number', 'text'], ['Email', 'email', 'text'],
    ['Created At', 'entered_at', 'timestamptz'], ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'boq', tab: 'BOQ', title: 'BOQ', pk: 'id', key: r => sbStr_(r['BOQ ID']), cols: [
    ['BOQ No', 'boq_no', 'text'], ['Vendor Name', 'vendor_name', 'text'], ['Valid From', 'valid_from', 'date'], ['Valid To', 'valid_to', 'date'],
    ['Amendment Of', 'amendment_of', 'text'], ['Amendment No', 'amendment_no', 'numeric'], ['Lines', 'lines', 'text'], ['Remark', 'remark', 'text'],
    ['Created At', 'entered_at', 'timestamptz'], ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'bills', tab: 'Bills', title: 'Bills', pk: 'id', key: r => sbStr_(r['Bill ID']), cols: [
    ['Vendor Name', 'vendor_name', 'text'], ['Company', 'company', 'text'], ['Bill No', 'bill_no', 'text'], ['Rev', 'rev', 'numeric'],
    ['Period From', 'period_from', 'date'], ['Period To', 'period_to', 'date'], ['Bill Date', 'bill_date', 'date'], ['Net Payable', 'net_payable', 'numeric'],
    ['Status', 'status', 'text'], ['Data', 'data', 'text'], ['Remark', 'remark', 'text'], ['Created At', 'entered_at', 'timestamptz'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'payments', tab: 'Payments', title: 'Payments', pk: 'id', key: r => sbStr_(r['Payment ID']), cols: [
    ['Type', 'entry_type', 'text'], ['Date', 'entry_date', 'date'], ['Vendor Name', 'vendor_name', 'text'], ['Amount', 'amount', 'numeric'], ['Side', 'side', 'text'],
    ['Mode', 'mode', 'text'], ['Reference', 'reference', 'text'], ['Against Bill', 'against_bill', 'text'], ['Remark', 'remark', 'text'], ['Created At', 'entered_at', 'timestamptz'],
    ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'debit_notes', tab: 'Debit Notes', title: 'Debit Notes', pk: 'id', key: r => sbStr_(r['Note ID']), cols: [
    ['DN No', 'dn_no', 'text'], ['Company', 'company', 'text'], ['Date', 'dn_date', 'date'], ['Vendor Name', 'vendor_name', 'text'], ['Kind', 'kind', 'text'],
    ['Period From', 'period_from', 'date'], ['Period To', 'period_to', 'date'], ['Lines', 'lines', 'text'], ['Log IDs', 'log_ids', 'text'], ['Amount', 'amount', 'numeric'],
    ['GST %', 'gst_pct', 'numeric'], ['GST Amount', 'gst_amt', 'numeric'], ['TDS %', 'tds_pct', 'numeric'], ['TDS Amount', 'tds_amt', 'numeric'], ['Total', 'total', 'numeric'],
    ['Status', 'status', 'text'], ['Bill ID', 'bill_id', 'text'], ['Remark', 'remark', 'text'], ['Created At', 'entered_at', 'timestamptz'], ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'breakdowns', tab: 'Breakdowns', title: 'Breakdowns', pk: 'id', key: r => sbStr_(r['Breakdown ID']), cols: [
    ['Machinery No', 'machinery_no', 'text'], ['From Date', 'from_date', 'date'], ['Reason', 'reason', 'text'], ['Remark', 'remark', 'text'], ['Status', 'status', 'text'],
    ['Back On', 'back_on', 'date'], ['Closing Remark', 'closing_remark', 'text'], ['Created At', 'entered_at', 'timestamptz'], ['Entered By', 'entered_by', 'text'], ['Updated By', 'updated_by', 'text']] },
  { table: 'breakdown_reports', tab: 'Breakdown Reports', title: 'Breakdown Reports', pk: 'id', key: r => sbStr_(r['Report ID']), cols: [
    ['Report Date', 'report_date', 'date'], ['Machinery Count', 'machinery_count', 'numeric'], ['Details', 'details', 'text'], ['Submitted At', 'submitted_at', 'timestamptz'], ['Entered By', 'entered_by', 'text']] },
  { table: 'compliance_history', tab: 'Compliance History', title: 'Compliance History', pk: 'id', key: r => sbStr_(r['History ID']), cols: [
    ['Machinery No', 'machinery_no', 'text'], ['Document', 'document', 'text'], ['Old Valid Upto', 'old_valid_upto', 'text'], ['New Valid Upto', 'new_valid_upto', 'text'],
    ['Renewed On', 'renewed_on', 'date'], ['Document No', 'document_no', 'text'], ['Amount', 'amount', 'numeric'], ['Remark', 'remark', 'text'], ['Source', 'source', 'text'],
    ['Created At', 'entered_at', 'timestamptz'], ['Entered By', 'entered_by', 'text']] },
  { table: 'app_users', tab: 'Users', title: 'Users', pk: 'id', key: r => sbStr_(r['Email']).toLowerCase(), cols: [
    ['Email', 'email', 'text'], ['Password', 'password_hash', 'text'], ['Name', 'name', 'text'], ['Active', 'active', 'text'], ['Admin', 'admin', 'text'],
    ['Dashboard', 'perm_dashboard', 'text'], ['Master', 'perm_master', 'text'], ['Diesel Inward', 'perm_diesel_inward', 'text'], ['Diesel Transfer', 'perm_diesel_transfer', 'text'],
    ['Diesel Issue', 'perm_diesel_issue', 'text'], ['Log Book', 'perm_log_book', 'text'], ['Reports', 'perm_reports', 'text'],
    ['Vendor Master', 'perm_vendor_master', 'text'], ['Vendor BOQ', 'perm_vendor_boq', 'text'], ['Machinery Billing', 'perm_machinery_billing', 'text'], ['Saved Bills', 'perm_saved_bills', 'text'],
    ['Bill Summary', 'perm_bill_summary', 'text'], ['Machinery Payments', 'perm_machinery_payments', 'text'], ['Vendor Ledger', 'perm_vendor_ledger', 'text'],
    ['Vendor Outstanding', 'perm_vendor_outstanding', 'text'], ['Vehicle Compliance', 'perm_vehicle_compliance', 'text'], ['Breakdown', 'perm_breakdown', 'text']] },
  { table: 'activity_log', tab: 'Activity Log', title: 'Activity Log', pk: 'id', key: r => sbStr_(r['Log ID']), cols: [
    ['Date & Time', 'at', 'timestamptz'], ['User Email', 'email', 'text'], ['User Name', 'name', 'text'], ['Action', 'action', 'text'], ['Module', 'module', 'text'],
    ['Record ID', 'record_id', 'text'], ['Summary', 'summary', 'text'], ['Changes', 'changes', 'text']] },
];

/* ---------- small helpers ---------- */
function sbStr_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function sbDate_(v) {
  // same time zone as the app uses for its dates (the Sheet's), so a date never moves by a day
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, (typeof tz_ === 'function' ? tz_() : '') || 'Asia/Kolkata', 'yyyy-MM-dd');
  const t = sbStr_(v); if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/); if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return '';
}
function sbVal_(v, type) {
  if (v === '' || v === null || v === undefined) return null;
  if (type === 'numeric') { const n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : null; }
  if (type === 'date') return sbDate_(v) || null;
  if (type === 'timestamptz') return v instanceof Date && !isNaN(v) ? v.toISOString() : (sbStr_(v) || null);
  return v instanceof Date ? sbDate_(v) : String(v);
}
function sbConf_() {
  const p = PropertiesService.getScriptProperties();
  const url = (p.getProperty('SUPABASE_URL') || SB_DEFAULT_URL_).replace(/\/+$/, '');
  const key = p.getProperty('SUPABASE_SECRET_KEY');
  if (!key || key.indexOf('sb_secret_') !== 0) throw new Error('Add the script property SUPABASE_SECRET_KEY (the Supabase secret key, starts with sb_secret_).');
  return { url: url, key: key };
}
// one call to the Supabase REST API (the secret key goes only in the apikey header)
function sbFetch_(method, path, body, extraHeaders) {
  const c = sbConf_();
  const headers = Object.assign({ apikey: c.key, 'Content-Type': 'application/json' }, extraHeaders || {});
  const opt = { method: method.toLowerCase(), headers: headers, muteHttpExceptions: true };
  if (body !== undefined) opt.payload = JSON.stringify(body);
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try { res = UrlFetchApp.fetch(c.url + path, opt); }
    catch (e) { lastErr = e; Utilities.sleep(1000 * Math.pow(2, attempt)); continue; } // network hiccup: wait 1, 2, 4, 8 s and try again
    const code = res.getResponseCode(), text = res.getContentText();
    if (code >= 200 && code < 300) return text ? JSON.parse(text) : null;
    if (code >= 500 || code === 429) { Utilities.sleep(800 * (attempt + 1)); continue; }
    throw new Error('Supabase ' + method + ' ' + path.split('?')[0] + ' → ' + code + ': ' + text.slice(0, 300));
  }
  throw new Error('Supabase did not answer (' + method + ' ' + path.split('?')[0] + ')' + (lastErr ? ': ' + lastErr.message : '') + '. It will try again at the next run.');
}
// several GET calls at once (one network round), each retried on its own if it fails
function sbFetchAllGet_(paths) {
  const c = sbConf_();
  let todo = paths.map((p, i) => ({ i: i, p: p })), out = new Array(paths.length), lastErr = '';
  for (let attempt = 0; attempt < 4 && todo.length; attempt++) {
    if (attempt) Utilities.sleep(1000 * Math.pow(2, attempt - 1));
    let res = [];
    try { res = UrlFetchApp.fetchAll(todo.map(x => ({ url: c.url + x.p, method: 'get', muteHttpExceptions: true, headers: { apikey: c.key, Range: '0-999', 'Range-Unit': 'items' } }))); }
    catch (e) { lastErr = e.message; continue; }
    const again = [];
    todo.forEach((x, k) => {
      const r = res[k], code = r.getResponseCode();
      if (code >= 200 && code < 300) out[x.i] = JSON.parse(r.getContentText() || '[]');
      else if (code >= 500 || code === 429) { again.push(x); lastErr = code + ''; }
      else throw new Error('Supabase GET ' + x.p.split('?')[0] + ' → ' + code + ': ' + r.getContentText().slice(0, 300));
    });
    todo = again;
  }
  if (todo.length) throw new Error('Supabase did not answer (' + lastErr + '). It will try again at the next run.');
  return out;
}
// lock for the backup only – it never makes the app's saves wait
function sbBackupLock_() {
  let l = null; try { l = LockService.getDocumentLock(); } catch (e) { l = null; }
  if (l) return l.tryLock(1000) ? { release: () => l.releaseLock() } : null;
  const c = CacheService.getScriptCache();
  if (c.get('SB_BACKUP_RUNNING')) return null;
  c.put('SB_BACKUP_RUNNING', '1', 300);
  return { release: () => c.remove('SB_BACKUP_RUNNING') };
}
// "has anything changed?" – one small call: newest change time in Supabase and a fingerprint of the tables / columns
function sbLastChange_() {
  const r = sbFetch_('POST', '/rest/v1/rpc/backup_last_change', {});
  const x = Array.isArray(r) ? r[0] : r;
  return { last: x && x.last_change ? String(x.last_change) : '', layout: x && x.layout ? String(x.layout) : '' };
}
// backup status for the app (kept in the fast cache so the app can show it without extra work)
function sbSetInfo_(o) {
  const p = PropertiesService.getScriptProperties();
  const cur = JSON.parse(p.getProperty('SB_INFO') || '{}');
  const info = Object.assign(cur, o);
  p.setProperty('SB_INFO', JSON.stringify(info));
  try { if (typeof webMirror_ === 'function') webMirror_('SB_INFO', JSON.stringify(info)); } catch (e) { /* the app on its own web address shows this; the backup itself is not touched */ }
  try { CacheService.getScriptCache().put('SB_INFO', JSON.stringify(info), 21600); } catch (e) {}
  return info;
}
function sbBackupInfo_() {
  try {
    const c = CacheService.getScriptCache().get('SB_INFO');
    if (c) return JSON.parse(c);
    const p = PropertiesService.getScriptProperties().getProperty('SB_INFO');
    return p ? JSON.parse(p) : null;
  } catch (e) { return null; }
}
function sbOwnerOnly_() { if (typeof ownerOnly_ === 'function') ownerOnly_(); }

/* ---------- 0. check the connection ---------- */
function testSupabaseConnection() {
  sbOwnerOnly_();
  const cat = sbFetch_('POST', '/rest/v1/rpc/backup_catalog', {});
  const tables = [...new Set(cat.map(x => x.table_name))];
  Logger.log('Connected. Tables in Supabase: ' + tables.join(', '));
  return tables;
}

/* ---------- 1. copy all data of this Google Sheet into Supabase ---------- */
function migrateToSupabase() {
  sbOwnerOnly_();
  // once the app runs on Supabase, the old Google Sheet is out of date: copying it again would overwrite newer data
  if (typeof sbDataOn_ === 'function' && sbDataOn_()) throw new Error('The app already runs on Supabase. The old Google Sheet is out of date – copying it again would overwrite newer entries, so this is blocked.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const report = [];
  SB_TABLES_.forEach(def => {
    const sh = ss.getSheetByName(def.tab);
    if (!sh || sh.getLastRow() < 2) { report.push(def.tab + ': no data'); return; }
    const all = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    const hdr = all[0].map(h => sbStr_(h));
    const known = {}; def.cols.forEach(c => { known[c[0]] = c; });
    const rows = [], seen = {};
    let skipped = 0;
    all.slice(1).forEach(line => {
      const r = {}; hdr.forEach((h, i) => { r[h] = line[i]; });
      const id = def.key(r);
      if (!id) { if (line.some(v => sbStr_(v) !== '')) skipped++; return; }
      if (seen[id]) { skipped++; return; } seen[id] = true;
      const o = { id: id }, extra = {};
      hdr.forEach((h, i) => {
        if (!h) return;
        const c = known[h];
        if (c) o[c[1]] = sbVal_(line[i], c[2]);
        else if (['Inward ID', 'Transfer ID', 'Issue ID', 'Check ID', 'Log ID', 'ID'].indexOf(h) === -1 && sbStr_(line[i]) !== '') extra[h] = line[i] instanceof Date ? line[i].toISOString() : line[i];
      });
      if (Object.keys(extra).length) o.extra = extra;
      rows.push(o);
    });
    for (let i = 0; i < rows.length; i += 500) {
      sbFetch_('POST', '/rest/v1/' + def.table + '?on_conflict=id', rows.slice(i, i + 500), { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    report.push(def.tab + ': ' + rows.length + ' rows' + (skipped ? ' (' + skipped + ' skipped: blank ID or repeated)' : ''));
  });
  // settings (tank sizes and similar) kept in script properties
  const props = PropertiesService.getScriptProperties().getProperties(), set = [];
  Object.keys(props).forEach(k => { if (/^TANK_/.test(k)) set.push({ id: k, value: props[k] }); });
  if (set.length) sbFetch_('POST', '/rest/v1/app_settings?on_conflict=id', set, { Prefer: 'resolution=merge-duplicates,return=minimal' });
  Logger.log('Copied to Supabase:\n' + report.join('\n'));
  try { ss.toast(report.join(' · '), 'Copied to Supabase', 15); } catch (e) {}
  return report;
}

/* ---------- 2. backup Google Sheet: Supabase → Sheet, automatically ---------- */
function setupSupabaseBackup() {
  sbOwnerOnly_();
  const p = PropertiesService.getScriptProperties();
  let id = p.getProperty('SB_BACKUP_SHEET_ID');
  if (!id) {
    const f = SpreadsheetApp.create('RCL Fleet ERP – Supabase Backup (read only)');
    id = f.getId(); p.setProperty('SB_BACKUP_SHEET_ID', id);
  }
  ScriptApp.getProjectTriggers().filter(t => ['sbSyncChanges', 'sbSyncFull', 'sbWeeklyCopy'].indexOf(t.getHandlerFunction()) > -1).forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sbSyncChanges').timeBased().everyMinutes(1).create(); // every minute (a quick check when nothing changed)
  ScriptApp.newTrigger('sbSyncFull').timeBased().atHour(2).everyDays(1).create();
  ScriptApp.newTrigger('sbWeeklyCopy').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  sbSyncFull();
  sbShareViewOnly_();
  const url = 'https://docs.google.com/spreadsheets/d/' + id;
  Logger.log('Backup Sheet ready: ' + url);
  return url;
}
function sbBackup_() {
  const id = PropertiesService.getScriptProperties().getProperty('SB_BACKUP_SHEET_ID');
  if (!id) throw new Error('Run setupSupabaseBackup first.');
  return SpreadsheetApp.openById(id);
}
// what is in Supabase now: every table and its columns (in order)
function sbCatalog_() {
  const cat = sbFetch_('POST', '/rest/v1/rpc/backup_catalog', {});
  const t = {};
  cat.forEach(x => { (t[x.table_name] = t[x.table_name] || []).push({ name: x.column_name, pos: x.ordinal_position }); });
  Object.keys(t).forEach(k => t[k].sort((a, b) => a.pos - b.pos));
  return t;
}
function sbTabName_(table) { const d = SB_TABLES_.find(x => x.table === table); return d ? d.title : table; }
// header shown in the backup: the app's own column names where known, the database name otherwise
function sbHeader_(table, col) {
  const d = SB_TABLES_.find(x => x.table === table);
  if (col === 'id') return d ? ({ master: 'Machinery', diesel_inward: 'Inward ID', diesel_transfer: 'Transfer ID', diesel_issue: 'Issue ID', boq: 'BOQ ID', bills: 'Bill ID', vendors: 'Vendor', log_book: 'Log Book Key', tank_check: 'Check ID', app_users: 'User', activity_log: 'Log ID' }[table] || 'ID') : 'id';
  const c = d && d.cols.find(x => x[1] === col);
  return c ? c[0] : col;
}
function sbAllRows_(table, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    // the delete log has no "id" column – its order column is "seq"
    const order = table === 'deleted_rows' ? 'seq' : 'id';
    const page = sbFetch_('GET', '/rest/v1/' + table + '?select=*' + (filter || '') + '&order=' + order + '.asc', undefined, { Range: from + '-' + (from + 999), 'Range-Unit': 'items' });
    out.push.apply(out, page);
    if (page.length < 1000) break;
  }
  return out;
}
function sbCell_(v) {
  if (v === null || v === undefined) return '';
  if (v && typeof v === 'object' && v.__hidden) return '(hidden)';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v; // never a formula
  return v;
}
function sbWriteTab_(bk, table, cols, rows) {
  const name = sbTabName_(table);
  let sh = bk.getSheetByName(name) || bk.insertSheet(name);
  const hdr = cols.map(c => sbHeader_(table, c.name));
  const data = [hdr].concat(rows.map(r => cols.map(c => sbCell_(sbSafe_(table, c.name, r[c.name])))));
  sh.clearContents();
  sh.getRange(1, 1, data.length, hdr.length).setValues(data);
  if (sh.getMaxColumns() > hdr.length) sh.deleteColumns(hdr.length + 1, sh.getMaxColumns() - hdr.length);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, hdr.length).setFontWeight('bold').setBackground('#E8EEF3');
  sbProtect_(sh);
  return sh;
}
// the password of a user is never copied into the backup Sheet
function sbSafe_(table, col, v) { return table === 'app_users' && col === 'password_hash' && v ? { __hidden: true } : v; }
/* Backup Sheet sharing: anyone who has the link can OPEN it (view only) – nobody but the owner can edit.
 * Every tab is also protected, so even a person made editor by mistake cannot change it. */
function sbShareViewOnly_() {
  const id = PropertiesService.getScriptProperties().getProperty('SB_BACKUP_SHEET_ID'); if (!id) return;
  const f = DriveApp.getFileById(id), owner = f.getOwner() ? f.getOwner().getEmail() : Session.getEffectiveUser().getEmail();
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  f.setShareableByEditors(false);
  f.getEditors().forEach(u => { if (u.getEmail() !== owner) f.removeEditor(u); });
  PropertiesService.getScriptProperties().setProperty('SB_SHARED', 'view');
}
function sbProtect_(sh) {
  try {
    const pr = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0] || sh.protect();
    pr.setDescription('Backup copy of Supabase – changes here are overwritten');
    const me = Session.getEffectiveUser();
    pr.addEditor(me); pr.removeEditors(pr.getEditors().filter(u => u.getEmail() !== me.getEmail()));
    if (pr.canDomainEdit()) pr.setDomainEdit(false);
  } catch (e) { /* protection is a convenience only */ }
}
function sbStatus_(bk, lines, ok) {
  const sh = bk.getSheetByName('Backup Status') || bk.insertSheet('Backup Status', 0);
  const now = new Date();
  sh.clearContents();
  const data = [['RCL Fleet ERP – Supabase backup', ''], ['Last run', now], ['Result', ok ? 'OK' : 'ERROR – see below'], ['', ''], ['Table / tab', 'Rows / note']].concat(lines);
  sh.getRange(1, 1, data.length, 2).setValues(data);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(3, 2).setFontColor(ok ? '#047857' : '#B91C1C').setFontWeight('bold');
  sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 420);
  sbProtect_(sh);
}
function sbFail_(e, what) {
  const p = PropertiesService.getScriptProperties();
  const n = Number(p.getProperty('SB_FAILS') || 0) + 1;
  p.setProperty('SB_FAILS', String(n));
  if (n === 3 || n % 24 === 0) {
    try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'RCL Fleet ERP – Supabase backup is failing', what + ' failed ' + n + ' times in a row.\n\n' + e.message); } catch (x) {}
  }
  try { sbStatus_(sbBackup_(), [['Error', e.message]], false); } catch (x) {}
  throw e;
}
function sbOk_() { PropertiesService.getScriptProperties().setProperty('SB_FAILS', '0'); }

// Full copy: every table rewritten; tables that no longer exist are kept as "OLD – …"
function sbSyncFull() {
  const lock = sbBackupLock_(); if (!lock) return;
  try {
    const bk = sbBackup_(), mark = sbLastChange_(), cat = sbCatalog_(), lines = [];
    const tables = Object.keys(cat).sort();
    const first = sbFetchAllGet_(tables.map(t => '/rest/v1/' + t + '?select=*&order=id.asc'));
    tables.forEach((table, i) => {
      const rows = first[i].length === 1000 ? sbAllRows_(table) : first[i];
      sbWriteTab_(bk, table, cat[table], rows);
      lines.push([sbTabName_(table), rows.length]);
    });
    const live = tables.map(sbTabName_).concat(['Backup Status']);
    bk.getSheets().forEach(sh => { const n = sh.getName(); if (live.indexOf(n) === -1 && n.indexOf('OLD – ') !== 0 && n !== 'Sheet1') sh.setName('OLD – ' + n); });
    const s1 = bk.getSheetByName('Sheet1'); if (s1 && bk.getSheets().length > 1) bk.deleteSheet(s1);
    const p = PropertiesService.getScriptProperties();
    p.setProperty('SB_SEEN', mark.last); p.setProperty('SB_LAYOUT', mark.layout);
    p.setProperty('SB_COLS', JSON.stringify(tables.reduce((o, t) => { o[t] = cat[t].map(c => c.name).join(','); return o; }, {})));
    sbStatus_(bk, lines.concat([['', ''], ['Type of run', 'Full copy']]), true);
    sbSetInfo_({ lastRun: new Date().toISOString(), lastChangeCopied: mark.last, ok: true, error: '', url: bk.getUrl ? bk.getUrl() : '' });
    sbOk_();
  } catch (e) { sbSetInfo_({ ok: false, error: e.message, lastTry: new Date().toISOString() }); sbFail_(e, 'Full backup'); } finally { lock.release(); }
}
// Every minute: one quick call "has anything changed?". Only when something changed: copy the new, edited and
// deleted rows (a table whose columns changed, or a new table, is rewritten in full). Returns what it did.
function sbSyncChanges() {
  const lock = sbBackupLock_(); if (!lock) return { busy: true };
  try {
    const p = PropertiesService.getScriptProperties();
    const seen = p.getProperty('SB_SEEN'), layout = p.getProperty('SB_LAYOUT');
    if (!seen || !p.getProperty('SB_COLS')) { lock.release(); sbSyncFull(); return { full: true, info: sbBackupInfo_() }; }
    const mark = sbLastChange_();
    if (mark.last === seen && mark.layout === layout) {           // nothing new – done in one call
      const info = sbSetInfo_({ lastCheck: new Date().toISOString(), ok: true, error: '' });
      sbOk_();
      return { upToDate: true, info: info };
    }
    const bk = sbBackup_(), cat = sbCatalog_(), lines = [];
    const oldCols = JSON.parse(p.getProperty('SB_COLS') || '{}');
    const tables = Object.keys(cat).sort();
    const since = encodeURIComponent(seen);
    // all changed rows and all deletes in one network round
    const res = sbFetchAllGet_(tables.map(t => '/rest/v1/' + t + '?select=*&updated_at=gt.' + since + '&order=id.asc')
      .concat(['/rest/v1/deleted_rows?select=*&deleted_at=gt.' + since + '&order=seq.asc']));
    const deleted = res[tables.length];
    let total = 0;
    tables.forEach((table, ti) => {
      const cols = cat[table], sig = cols.map(c => c.name).join(',');
      const sh = bk.getSheetByName(sbTabName_(table));
      if (!sh || oldCols[table] !== sig) {                          // new table or columns added / removed
        const rows = sbAllRows_(table); sbWriteTab_(bk, table, cols, rows);
        lines.push([sbTabName_(table), rows.length + ' (layout changed – rewritten)']); total += rows.length; return;
      }
      const changed = res[ti].length === 1000 ? sbAllRows_(table, '&updated_at=gt.' + since) : res[ti];
      const gone = deleted.filter(d => d.table_name === table).map(d => String(d.row_id));
      if (!changed.length && !gone.length) return;
      const last = sh.getLastRow();
      const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
      const at = {}; ids.forEach((id, i) => { at[id] = i + 2; });
      const adds = [];
      changed.forEach(r => {
        const line = cols.map(c => sbCell_(sbSafe_(table, c.name, r[c.name])));
        const row = at[String(r.id)];
        if (row) sh.getRange(row, 1, 1, cols.length).setValues([line]); else adds.push(line);
      });
      if (adds.length) sh.getRange(sh.getLastRow() + 1, 1, adds.length, cols.length).setValues(adds);
      gone.filter(id => changed.every(r => String(r.id) !== id)).map(id => at[id]).filter(Boolean).sort((a, b) => b - a).forEach(row => sh.deleteRow(row));
      lines.push([sbTabName_(table), changed.length + ' new / changed, ' + gone.length + ' deleted']);
      total += changed.length + gone.length;
    });
    const gone = tables.map(sbTabName_).concat(['Backup Status']);
    bk.getSheets().forEach(sh => { const n = sh.getName(); if (gone.indexOf(n) === -1 && n.indexOf('OLD – ') !== 0 && n !== 'Sheet1') sh.setName('OLD – ' + n); });
    p.setProperty('SB_SEEN', mark.last); p.setProperty('SB_LAYOUT', mark.layout);
    p.setProperty('SB_COLS', JSON.stringify(tables.reduce((o, t) => { o[t] = cat[t].map(c => c.name).join(','); return o; }, {})));
    sbStatus_(bk, (lines.length ? lines : [['No row changes', '']]).concat([['', ''], ['Type of run', 'Changes (every minute)']]), true);
    const info = sbSetInfo_({ lastRun: new Date().toISOString(), lastCheck: new Date().toISOString(), lastChangeCopied: mark.last, ok: true, error: '', url: bk.getUrl ? bk.getUrl() : '' });
    sbOk_();
    return { copied: total, lines: lines, info: info };
  } catch (e) {
    sbSetInfo_({ ok: false, error: e.message, lastTry: new Date().toISOString() });
    sbFail_(e, 'Backup of changes');
  } finally { try { lock.release(); } catch (x) {} }
}
/* ---------- "Backup now" button in the app (Admin) ----------
 * Checks whether the newest data of Supabase is already in the backup Google Sheet; if not, copies it at once. */
function sbBackupNow_() {
  const P = PropertiesService.getScriptProperties();
  if (!P.getProperty('SB_BACKUP_SHEET_ID')) throw new Error('The backup Sheet is not set up yet (run setupSupabaseBackup once).');
  if (P.getProperty('SB_SHARED') !== 'view') { try { sbShareViewOnly_(); } catch (e) { /* sharing is set again next time */ } }
  let r = sbSyncChanges();
  if (r && r.busy) { Utilities.sleep(4000); r = sbSyncChanges(); }   // the automatic backup was running – ask again
  if (r && r.busy) return { busy: true, info: sbBackupInfo_() };
  return r;
}
// Every Sunday: a dated copy of the backup file in Drive
function sbWeeklyCopy() {
  try {
    const f = DriveApp.getFileById(sbBackup_().getId());
    f.makeCopy('RCL Backup ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'));
  } catch (e) { sbFail_(e, 'Weekly copy'); }
}
