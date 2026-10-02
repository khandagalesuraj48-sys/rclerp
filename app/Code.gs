/*************************************************************
 * RACHANA CONSTRUCTION LIMITED – FLEET ERP
 * Web App (server side)
 * Backend tabs used: Master, Diesel Inward, Diesel Transfer, Diesel Issue, Log Book
 *************************************************************/

const APP = {
  COMPANY: 'Rachana Construction Limited',
  LOGO_URL: 'https://i.ibb.co/CpSfBqXX/RCL-LOGO-PDF.png', // company logo (ImgBB)
  SHEET_MASTER: 'Master',
  SHEET_DIESEL: 'Diesel Issue',
  SHEET_LOG: 'Log Book',
  SHEET_TANK: 'Tank Check',
  SHEET_VENDORS: 'Vendors',
  SHEET_BOQ: 'BOQ',
  SHEET_BILLS: 'Bills',
  SHEET_PAYMENTS: 'Payments',
  SHEET_COMPLIANCE: 'Compliance History',
  SHEET_BREAKDOWN: 'Breakdowns',
  SHEET_BDREPORT: 'Breakdown Reports',
  SHEET_INWARD: 'Diesel Inward',
  SHEET_TRANSFER: 'Diesel Transfer',
  LOCATIONS: ['Dispenser', 'VTR Store'], // diesel stock points; pump diesel comes into the first one by default
  MAIN_LOC: 'Dispenser',
  UNITS: ['KM', 'Hrs', 'KM + Hrs', 'Day'],
  OWNERSHIP: ['Own', 'Rental', 'Hired', 'Debit', 'Other'],
  SUPPLY: ['Company', 'Debit Basis', 'Other'],   // who gives the diesel to this machinery
  STATUS: ['Active', 'Inactive'],
  SHIFTS: ['Day', 'Night'],
};

const H = {
  NO: 'Machinery Number', NAME: 'Machinery Name', TYPE: 'Type of Machinery', MAKE: 'Make',
  UNIT: 'Unit', WORKS: 'Works On', LBFMT: 'Log Book Format', TSTART: 'Start Time', TEND: 'End Time', TBRK: 'Break (min)', THRS: 'Time Hrs', CHALLAN: 'Challan No', ITEMS: 'Item Work', DEBITTO: 'Debit To', DEBITRATE: 'Debit Rate', OWNTYPE: 'Ownership', KMSTD: 'Standard Average (KM/Ltr)', HRSTD: 'Standard Average (Ltr/Hr)', OWNER: 'Owner Name',
  ID: 'Issue ID', IDATE: 'Issue Date', SHIFT: 'Shift', QTY: 'Diesel Qty (Ltr)',
  KMR: 'KM Reading', HRR: 'Hrs Reading', REMARK: 'Remark', CREATED: 'Created At',
  DATE: 'Date', OKM: 'Opening KM', CKM: 'Closing KM', WKM: 'Working KM',
  OHR: 'Opening Hrs', CHR: 'Closing Hrs', WHR: 'Working Hrs',
  CKMC: 'Diesel Consumption - KM', CHRC: 'Diesel Consumption - Hrs', TOT: 'Total Diesel Consumption',
  STOCK: 'Stock Balance', AKM: 'Actual KM Avg', AHR: 'Actual Hrs Avg', XS: 'Extra/Short Diesel',
  TRIP: 'Trip', CH: 'Chainage No.', WORK: 'Work Done', DRIVER: 'Driver Name',
  CYCLE: 'Fill Cycle', ODSL: 'Opening Diesel', DRATE: 'Debit Rate', TCAP: 'Tank Capacity (Ltr)', ODSET: 'Opening Diesel Set', MRATE: 'Monthly Rate', TDS: 'TDS Rate (%)',
  ENGNO: 'Engine Number', CHASSIS: 'Chassis Number', ENGMAKE: 'Engine Make',
  TAXV: 'Tax Valid Upto', PUCV: 'PUC Valid Upto', PERMITV: 'Permit Valid Upto', FITV: 'Fitness Valid Upto', INSV: 'Insurance Valid Upto', EBY: 'Entered By', UBY: 'Updated By', DMETER: 'Current Diesel Issue Reading',
  CHFROM: 'Chainage From', CHTO: 'Chainage To', AVG: 'Actual Average', EXTRA: 'Extra / Short Diesel', DREAD: 'Diesel Readings',
  STATUS: 'Status', AFROM: 'Active From', IFROM: 'Inactive From', SUPPLY: 'Diesel Supply',
  BAL: 'Balance', SOURCE: 'Diesel Source', LOC: 'Location', TR_ID: 'Transfer ID', FROM: 'From', TO: 'To',
  FROMBAL: 'From Balance', TOBAL: 'To Balance', IN_ID: 'Inward ID', IN_QTY: 'Qty (Ltr)', PUMP: 'Pump Name', RATE: 'Rate', AMOUNT: 'Amount', BILLNO: 'Bill Number', BILLDATE: 'Bill Date',
};

/* ================= WHERE THE DATA LIVES =================
 * Script property DATA_SOURCE = supabase → Supabase (SupabaseData.gs); otherwise this Google Sheet. */
let SB_BOOK_ = null, SB_ON_ = null, SB_DEPTH_ = 0;
function sbDataOn_() {
  if (SB_ON_ === null) SB_ON_ = String(PropertiesService.getScriptProperties().getProperty('DATA_SOURCE') || '').toLowerCase() === 'supabase';
  return SB_ON_;
}
function SS_() {
  if (!sbDataOn_()) return SpreadsheetApp.getActiveSpreadsheet();
  if (typeof SbBook_ !== 'function') throw new Error('DATA_SOURCE is supabase but the file SupabaseData.gs is missing.');
  return SB_BOOK_ = SB_BOOK_ || new SbBook_();
}
function sbFlush_() { if (SB_BOOK_) SB_BOOK_.flush(); }
function sbDiscard_() { SB_BOOK_ = null; }

/* ================= WEB APP ENTRY ================= */
/* ---------- app version (a fingerprint of Index.html) ----------
 * Every new deployment has a different Index.html, so a different fingerprint. The page carries the fingerprint it
 * was built with; the sync tells the page the fingerprint of the deployment now live. When they differ, the page
 * knows a new version is out and updates itself (see the app side). */
function appBuildOf_(html) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, html).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('').slice(0, 12);
}
function appBuild_() {
  try { return appBuildNow_(); } catch (e) { return ''; } // never let the version check stop the sync
}
function appBuildNow_() {
  const cache = CacheService.getScriptCache();
  let b = cache.get('APP_BUILD');
  if (!b) { b = appBuildOf_(HtmlService.createHtmlOutputFromFile('App').getContent()); cache.put('APP_BUILD', b, 60); } // checked again every minute
  return b;
}
// the app (App.html) with its version fingerprint and link put in
function appPage_() {
  const html = HtmlService.createHtmlOutputFromFile('App').getContent();
  const build = appBuildOf_(html);
  CacheService.getScriptCache().put('APP_BUILD', build, 60);
  let url = ''; try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  const put = "window.APP_BUILD = '" + build + "'; window.APP_URL = '" + url + "';";
  return { build: build, html: html.replace('/*APP_BUILD*/', () => put) };
}
// called by the shell page (Index.html) when a new version is live – the app is not secret, so no sign-in needed
function getAppHtml() { return appPage_(); }
function getAppBuild() { return appBuild_(); }
/* The app was moved out of Apps Script (to its own web address): when the script property APP_MOVED_TO holds the new
 * link, this old app shows that link and refuses every sign-in and every action – so nobody keeps working here by mistake.
 * Delete the property and the old app works again. (Checked through the fast cache, at most once a minute.) */
function movedTo_() {
  try {
    const c = CacheService.getScriptCache(); let v = c.get('APP_MOVED');
    if (v === null) { v = PropertiesService.getScriptProperties().getProperty('APP_MOVED_TO') || '-'; c.put('APP_MOVED', v, 60); }
    return v === '-' ? '' : v;
  } catch (e) { return ''; }
}
function doGet(e) {
  const moved = movedTo_();
  if (moved) {
    const safe = String(moved).replace(/[<>"']/g, '');
    return HtmlService.createHtmlOutput('<div style="font:16px/1.6 Arial,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;text-align:center"><h2>' + APP.COMPANY + ' – Fleet ERP</h2><p>The app has moved to a new link:</p><p><a target="_top" style="font-size:18px;font-weight:700" href="' + safe + '">' + safe + '</a></p><p>Sign in there with the same email and password.</p></div>')
      .setTitle(APP.COMPANY + ' – Fleet ERP').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  // "…/exec?classic=1" opens the app directly, without the shell (for checking, or if the shell ever has a problem)
  if (e && e.parameter && e.parameter.classic) {
    return HtmlService.createHtmlOutput(appPage_().html)
      .setFaviconUrl(APP.LOGO_URL)
      .setTitle(APP.COMPANY + ' – Fleet ERP')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }
  // Index.html is a small shell; the app (App.html) runs inside it and is swapped for a new version by itself
  const a = appPage_();
  const json = JSON.stringify(a).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); // safe inside a <script>
  const shell = HtmlService.createHtmlOutputFromFile('Index').getContent().replace('/*APP_JSON*/null', () => json); // a function: $ signs in the app stay as they are
  return HtmlService.createHtmlOutput(shell)
    .setFaviconUrl(APP.LOGO_URL)
    .setTitle(APP.COMPANY + ' – Fleet ERP')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function getInit_() {
  return { company: APP.COMPANY, today: today_(), master: getMaster_(), drivers: getDrivers_(), stock: getStock_(), pumps: getPumps_(), locations: APP.LOCATIONS };
}

/* ================= LOGIN, ACCESS AND ACTIVITY LOG ================= *
 * Users sheet: Email | Password | Name | Active | Admin | one column per module (View / Edit)
 * Everybody who can log in can VIEW every module. Edit (add, change, delete, import) needs "Edit" in that module –
 * this applies to every user, Admin too. Admin = Yes only adds the Activity Log.
 * Every call from the app goes through api(); the business functions end with "_" so the browser cannot call them directly.
 */
/* ================= SECURITY =================
 * - Passwords are kept as salted hashes ("sha256$salt$hash"); a plain password typed by Admin in the Users tab
 *   works once and must be changed at that sign-in.
 * - A session remembers a stamp of the password: when a password changes, every older session ends.
 * - Sign-in: 5 wrong tries per email → 15 min lock; at most 60 tries a minute in total; one message for every failure.
 * - Nothing typed by a user can become a formula in the sheet (= + - @ at the start are stored as text).
 * - Setup and trigger functions only run from the Apps Script editor / real triggers. */
const PW_MIN_ = 8;
function hex_(bytes) { return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join(''); }
function hashPw_(pw, salt) {
  let h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8);
  for (let i = 0; i < 300; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(Utilities.newBlob(salt).getBytes()));
  return hex_(h);
}
function makeHash_(pw) { const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16); return 'sha256$' + salt + '$' + hashPw_(pw, salt); }
const isHashed_ = stored => /^sha256\$[0-9a-f]{16}\$[0-9a-f]{64}$/.test(String(stored));
function checkPw_(pw, stored) {
  stored = String(stored || '');
  if (!stored) return false;
  if (isHashed_(stored)) { const p = stored.split('$'); return hashPw_(String(pw), p[1]) === p[2]; }
  return String(pw) === stored; // plain password set by Admin: accepted once, then must be changed
}
// short fingerprint of the stored password: sessions carry it, so changing a password ends older sessions
const pwStamp_ = stored => hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'st|' + String(stored || ''))).slice(0, 12);
function pwPolicy_(pw) {
  pw = String(pw || '');
  if (pw.length < PW_MIN_) return 'Password must have at least ' + PW_MIN_ + ' characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must have letters and numbers.';
  if (/^(admin@123|demo1234|password1|12345678|rcl@1234)$/i.test(pw)) return 'This password is too easy to guess.';
  return '';
}
// text that would start a formula in Google Sheets is stored as plain text
const FORMULA_START_ = /^[=+\-@]/;
function safeCell_(v) { return typeof v === 'string' && FORMULA_START_.test(v) ? "'" + v : v; }
const safeRows_ = rows => rows.map(r => Array.isArray(r) ? r.map(safeCell_) : safeCell_(r));
// setup / maintenance functions: only the owner, from the Apps Script editor (never from the web app)
function ownerOnly_() {
  let active = '', owner = '';
  try { active = Session.getActiveUser().getEmail(); owner = Session.getEffectiveUser().getEmail(); } catch (e) { /* no identity */ }
  if (!active || !owner || active.toLowerCase() !== owner.toLowerCase()) throw new Error('This can only be run by the owner from the Apps Script editor.');
}

const USERS_SHEET = 'Users';
const LOG_SHEET = 'Activity Log';
/* Every page of the app has its own access, one column each in Users: Edit / View / No access.
 * A new page is added HERE (and gets its column in Users by itself); "Master" is the Asset Master. */
const MODULES = ['Dashboard', 'Vendor Master', 'Master', 'Vendor BOQ', 'Vehicle Compliance', 'Breakdown', 'Diesel Inward', 'Diesel Transfer', 'Diesel Issue', 'Log Book', 'Machinery Billing', 'Saved Bills', 'Bill Summary', 'Machinery Payments', 'Vendor Ledger', 'Vendor Outstanding', 'Reports'];
const MODULE_LABEL_ = { 'Master': 'Asset Master' };
// a column that is not in Users yet takes the access of the column it came out of
const MODULE_FROM_ = { 'Vendor Master': 'Master', 'Vendor BOQ': 'Master', 'Machinery Billing': 'Master', 'Saved Bills': 'Reports' };
const ACCESS_ = v => { const k = str_(v).toUpperCase().replace(/[^A-Z]/g, ''); return k === 'EDIT' ? 'Edit' : (k === 'NOACCESS' || k === 'NONE' || k === 'NO' || k === 'HIDE') ? 'None' : 'View'; };
const SESSION_SECONDS = 21600; // 6 hours, renewed on every action

function readUsers_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('USERS_LIST');
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* read again */ } }
  const list = readUsersSheet_();
  try { cache.put('USERS_LIST', JSON.stringify(list), 20); } catch (e) { /* too big for cache: fine, read each time */ }
  return list;
}
function readUsersSheet_() {
  const sh = SS_().getSheetByName(USERS_SHEET);
  if (!sh) throw new Error('Tab "Users" not found. Run setupLogin from Setup.gs.');
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const col = h => hdr.indexOf(h);
  return sh.getRange(2, 1, lastRow - 1, lastCol).getValues().map(r => {
    const perms = {};
    const admin = col('Admin') > -1 && str_(r[col('Admin')]).toUpperCase() === 'YES';
    MODULES.forEach(m => { let i = col(m); if (i === -1 && MODULE_FROM_[m]) i = col(MODULE_FROM_[m]); perms[m] = admin ? 'Edit' : i > -1 ? ACCESS_(r[i]) : 'None'; }); // a brand-new page stays hidden until Admin gives access
    return {
      email: str_(r[col('Email')]).toLowerCase(), password: String(r[col('Password')] === undefined ? '' : r[col('Password')]),
      name: str_(r[col('Name')]) || str_(r[col('Email')]), active: str_(r[col('Active')]).toUpperCase() !== 'NO', admin: admin, perms: perms,
    };
  }).filter(u => u.email);
}
/* Users & Access (Admin page): the same Users table the app reads at sign-in, so a change here and a change in the
 * Users tab are the same thing. Passwords are never sent to the page; Admin can only set a new one-time password. */
function usersSheet_() {
  const sh = SS_().getSheetByName(USERS_SHEET);
  if (!sh) throw new Error('Tab "Users" not found.');
  // every page has its column (a new page gets it here, with the access of the column it came out of)
  let hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const missing = MODULES.filter(m => hdr.indexOf(m) === -1);
  if (missing.length) {
    const rows = Math.max(sh.getLastRow() - 1, 0), data = rows ? sh.getRange(2, 1, rows, hdr.length).getValues() : [];
    missing.forEach(m => {
      const from = hdr.indexOf(MODULE_FROM_[m] || ''), c = sh.getLastColumn() + 1;
      sh.getRange(1, c).setValue(m).setFontWeight('bold');
      if (rows) sh.getRange(2, c, rows, 1).setValues(data.map(r => [str_(r[hdr.indexOf('Admin')]).toUpperCase() === 'YES' ? 'Edit' : from > -1 ? (ACCESS_(r[from]) === 'None' ? 'No access' : ACCESS_(r[from])) : 'No access']));
      hdr.push(m);
    });
    CacheService.getScriptCache().remove('USERS_LIST');
  }
  return { sh: sh, hdr: hdr };
}
function usersAdmin_() {
  const x = usersSheet_(), hdr = x.hdr, sh = x.sh, col = h => hdr.indexOf(h);
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, hdr.length).getValues() : [];
  const users = rows.filter(r => str_(r[col('Email')])).map(r => ({
    email: str_(r[col('Email')]).toLowerCase(), name: str_(r[col('Name')]), active: str_(r[col('Active')]).toUpperCase() !== 'NO',
    admin: col('Admin') > -1 && str_(r[col('Admin')]).toUpperCase() === 'YES', mustChange: !isHashed_(r[col('Password')]),
    perms: MODULES.reduce((o, m) => { o[m] = col(m) > -1 ? ACCESS_(r[col(m)]) : 'None'; return o; }, {}) }));
  return { users: users, modules: MODULES.map(m => ({ key: m, label: MODULE_LABEL_[m] || m })) };
}
// add or change one user: name, active, admin, access per page; a new user (or a reset) gets a one-time password
function saveUserAdmin_(x, me) {
  x = x || {};
  const email = str_(x.email).toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a proper email.');
  const t = usersSheet_(), sh = t.sh, hdr = t.hdr, col = h => hdr.indexOf(h);
  const n = Math.max(sh.getLastRow() - 1, 0), data = n ? sh.getRange(2, 1, n, hdr.length).getValues() : [];
  const i = data.findIndex(r => str_(r[col('Email')]).toLowerCase() === email);
  const adding = i === -1;
  if (adding && !x.isNew) throw new Error('User ' + email + ' was not found.');
  if (!adding && x.isNew) throw new Error(email + ' is already a user.');
  const row = adding ? hdr.map(() => '') : data[i].slice();
  const before = adding ? null : row.slice();
  const put = (h, v) => { if (col(h) > -1) row[col(h)] = v; };
  put('Email', email); put('Name', clean_(x.name) || email);
  put('Active', x.active === false ? 'No' : 'Yes'); put('Admin', x.admin ? 'Yes' : 'No');
  MODULES.forEach(m => { const v = (x.perms || {})[m]; if (v) put(m, v === 'None' ? 'No access' : v === 'Edit' ? 'Edit' : 'View'); });
  // Admin cannot lock himself out
  if (!adding && me && me.email === email && (x.active === false || !x.admin)) throw new Error('You cannot remove your own Admin access or deactivate yourself.');
  if (adding || x.newPassword) {
    const pw = String(x.newPassword || '');
    if (pw.length < 6) throw new Error('Give a one-time password of at least 6 characters – the user must change it at the first sign-in.');
    put('Password', pw); // plain on purpose: accepted once, then the user must set their own
  }
  if (adding) sh.appendRow(row); else sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
  if (col('Password') > -1) sh.getRange(adding ? sh.getLastRow() : i + 2, col('Password') + 1).setNumberFormat('@');
  CacheService.getScriptCache().remove('USERS_LIST');
  bump_(['users']);
  const changes = before ? hdr.map((h, k) => h !== 'Password' && String(before[k]) !== String(row[k]) ? h + ': ' + (before[k] || '–') + ' → ' + (row[k] || '–') : '').filter(Boolean).concat(x.newPassword ? ['one-time password set'] : []).join('; ') : 'access: ' + MODULES.map(m => (MODULE_LABEL_[m] || m) + ' ' + (row[col(m)] || 'View')).join(', ');
  return { ok: true, email: email, added: adding, changes: changes };
}
function publicUser_(u) { return { email: u.email, name: u.name, admin: u.admin, perms: u.perms }; }

function login(email, password) {
  { const moved = movedTo_(); if (moved) throw new Error('The app has moved to a new link: ' + moved + ' – sign in there with the same password.'); }
  const e = str_(email).toLowerCase().slice(0, 120);
  const cache = CacheService.getScriptCache();
  // all sign-ins together: at most 60 a minute (stops floods)
  const mk = 'LG_' + Math.floor(Date.now() / 60000);
  const failKey = 'F_' + e;
  /* Counting: where the server has an exact counter (countUp_), every attempt first TAKES a place and is looked at only
   * if it is among the first 5 – so many guesses fired at the same moment cannot slip past the limit.
   * Without it (the old way): read the count, then write it back. */
  const exact = typeof __count === 'function' && __count('', 0) !== -1;
  let fails;
  if (exact) {
    if (__count(mk, 120) > 60) throw new Error('Too many sign-in attempts. Please wait a minute and try again.');
    fails = __count(failKey, 900) - 1;
  } else {
    const all = Number(cache.get(mk) || 0);
    if (all >= 60) throw new Error('Too many sign-in attempts. Please wait a minute and try again.');
    cache.put(mk, String(all + 1), 120);
    fails = Number(cache.get(failKey) || 0);
  }
  if (fails >= 5) throw new Error('Too many wrong attempts. Try again after 15 minutes.');
  const u = e ? readUsers_().find(x => x.email === e) : null;
  if (!u || !u.active || !checkPw_(password, u.password)) {
    if (!exact) cache.put(failKey, String(fails + 1), 900);
    // log only the first failure and the lock, so failures cannot flood the Activity Log
    const hk = 'LGL_' + Math.floor(Date.now() / 3600000), logged = Number(cache.get(hk) || 0); // at most 100 failure lines an hour
    if ((fails === 0 || fails === 4) && logged < 100 && (cache.put(hk, String(logged + 1), 3700), true)) writeLog_({ email: e, name: u ? u.name : '' }, 'Login failed', '', '', (u && !u.active ? 'User is not active' : 'Wrong email or password') + (fails === 4 ? ' – locked for 15 minutes' : ''), '');
    sbFlush_();
    throw new Error('Wrong email or password.'); // same message for every case: nobody can tell which emails exist
  }
  cache.remove(failKey); if (exact) __uncount(failKey);
  const token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  cache.put('S_' + token, u.email + '|' + pwStamp_(u.password), SESSION_SECONDS);
  writeLog_(u, 'Login', '', '', 'Logged in', '');
  sbFlush_();
  // a password set by Admin (not hashed yet) or a weak one must be changed now
  const must = !isHashed_(u.password) || !!pwPolicy_(password);
  return { token: token, user: publicUser_(u), mustChange: must };
}
/* Change own password (also the forced change after Admin set one). Ends every other session of this user. */
function changePassword(token, oldPw, newPw) {
  const cache = CacheService.getScriptCache();
  const val = cache.get('S_' + str_(token));
  if (!val) throw new Error('SESSION_EXPIRED');
  const email = val.split('|')[0];
  const u = readUsers_().find(x => x.email === email);
  if (!u || !u.active) throw new Error('SESSION_EXPIRED');
  const fk = 'CPF_' + email, fails = Number(cache.get(fk) || 0);
  if (fails >= 5) throw new Error('Too many wrong attempts. Try again after 15 minutes.');
  if (!checkPw_(oldPw, u.password)) { cache.put(fk, String(fails + 1), 900); throw new Error('Current password is wrong.'); }
  const bad = pwPolicy_(newPw); if (bad) throw new Error(bad);
  if (String(newPw) === String(oldPw)) throw new Error('Choose a password different from the current one.');
  const stored = makeHash_(String(newPw));
  const sh = SS_().getSheetByName(USERS_SHEET);
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const ce = hdr.indexOf('Email'), cp = hdr.indexOf('Password');
  const emails = sh.getRange(2, ce + 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(r => str_(r[0]).toLowerCase());
  const i = emails.indexOf(email);
  if (i === -1) throw new Error('User not found.');
  sh.getRange(i + 2, cp + 1).setNumberFormat('@').setValue(stored);
  cache.remove('USERS_LIST'); cache.remove(fk); cache.remove('S_' + str_(token));
  const t2 = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  cache.put('S_' + t2, email + '|' + pwStamp_(stored), SESSION_SECONDS);
  writeLog_(u, 'Password changed', '', '', 'Changed own password (other sessions signed out)', '');
  sbFlush_();
  bump_(['users']);
  return { token: t2 };
}

function logout(token) {
  const cache = CacheService.getScriptCache();
  const email = (cache.get('S_' + token) || '').split('|')[0];
  if (email) {
    cache.remove('S_' + token);
    const u = readUsers_().find(x => x.email === email);
    writeLog_(u || { email: email, name: '' }, 'Logout', '', '', 'Logged out', '');
    sbFlush_();
  }
  return true;
}

function sessionUser_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const val = cache.get('S_' + token);
  if (!val) return null;
  const email = val.split('|')[0], stamp = val.split('|')[1] || '';
  const u = readUsers_().find(x => x.email === email);
  // not active any more, or the password was changed since this sign-in → session ends
  if (!u || !u.active || stamp !== pwStamp_(u.password)) { cache.remove('S_' + token); return null; }
  cache.put('S_' + token, val, SESSION_SECONDS);
  return u;
}
// Edit only where the Users sheet says Edit – also for Admin. (Admin = Activity Log access.)
function canEdit_(u, module) { return u.perms[module] === 'Edit'; }

/* ---------- every action the app can ask for ---------- *
 * m = module, edit = needs Edit access, admin = Admin only, log = how to write it in the Activity Log */
const API_ = {
  whoami:            { m: '', f: () => true },
  sync:              { m: '', f: () => ({}) },          // heartbeat: fresh access + what changed (filled in api)
  getLookups:        { m: '', f: getLookups_ },
  backupNow:         { m: '', f: () => (typeof sbBackupNow_ === 'function' ? sbBackupNow_() : { off: true }) }, // every signed-in user
  saveTankSettings:  { m: 'Master', edit: true, f: saveTankSettings_ },
  globalSearch:      { m: '', withUser: true, f: globalSearch_ },
  getInit:           { m: '', f: getInit_ },
  getStock:          { m: '', f: getStock_ },
  dieselHistory:     { m: 'Diesel Issue', f: dieselHistory_ },
  getDashboard:      { m: 'Dashboard', f: getDashboard_ },
  logDashboard:      { m: 'Dashboard', f: logDashboard_ },
  pendingLog:        { m: 'Dashboard', f: pendingLogs_ },
  getOwnershipDetail:{ m: 'Dashboard', f: getOwnershipDetail_ },
  getStockLedger:    { m: 'Dashboard', f: getStockLedger_ },
  exportMaster:      { m: 'Master', f: exportMaster_ },
  saveMaster:        { m: 'Master', edit: true, f: saveMaster_, log: 'master' },
  saveMasterBulk:    { m: 'Master', edit: true, f: saveMasterBulk_, log: 'masterBulk' },
  deleteMaster:      { m: 'Master', edit: true, f: deleteMaster_, log: 'masterDelete' },
  getVendors:        { m: 'Vendor Master', any: ['Vendor Master', 'Master', 'Vendor BOQ', 'Machinery Billing', 'Machinery Payments', 'Vendor Ledger', 'Vendor Outstanding'], f: getVendors_ },
  saveVendor:        { m: 'Vendor Master', edit: true, f: saveVendor_, log: 'vendor' },
  deleteVendor:      { m: 'Vendor Master', edit: true, f: deleteVendor_, log: 'vendorDel' },
  getBoqs:           { m: 'Vendor BOQ', any: ['Vendor BOQ', 'Vendor Master', 'Master'], f: getBoqs_ },
  saveBoq:           { m: 'Vendor BOQ', edit: true, f: saveBoq_, log: 'boq' },
  deleteBoq:         { m: 'Vendor BOQ', edit: true, f: deleteBoq_, log: 'boqDel' },
  boqRateCheck:      { m: 'Vendor BOQ', f: boqRateCheck_ },
  boqMissing:        { m: 'Vendor BOQ', f: boqMissing_ },
  billInit:          { m: 'Machinery Billing', any: ['Machinery Billing', 'Saved Bills'], f: billInit_ },
  saveBillSettings:  { m: 'Machinery Billing', edit: true, f: saveBillSettings_, log: 'billSettings' },
  getBills:          { m: 'Saved Bills', any: ['Saved Bills', 'Machinery Billing', 'Bill Summary', 'Vendor Ledger'], f: getBills_ },
  billSummary:       { m: 'Bill Summary', f: billSummary_ },
  getPayments:       { m: 'Machinery Payments', f: getPayments_ },
  savePayment:       { m: 'Machinery Payments', edit: true, f: savePayment_, log: 'payment' },
  getCompliance:     { m: 'Vehicle Compliance', f: getCompliance_ },
  saveLbFormats:     { m: 'Master', edit: true, f: saveLbFormats_, log: 'lbFormat' },
  getLbFormatNames:  { m: 'Master', f: getLbFormatNames_ },
  saveLbFormatName:  { m: 'Master', edit: true, f: saveLbFormatName_, log: 'lbFormatName' },
  getBreakdowns:     { m: 'Breakdown', f: getBreakdowns_ },
  submitBdReport:    { m: 'Breakdown', edit: true, f: submitBdReport_, log: 'bdReport' },
  deleteBdReport:    { m: 'Breakdown', edit: true, f: deleteBdReport_, log: 'bdReport' },
  renewDoc:          { m: 'Vehicle Compliance', edit: true, f: renewDoc_, log: 'renew' },
  saveCmpRules:      { m: 'Vehicle Compliance', edit: true, f: saveCmpRules_, log: 'cmpRules' },
  importCompliance:  { m: 'Vehicle Compliance', edit: true, f: importCompliance_, log: 'cmpImport' },
  deletePayment:     { m: 'Machinery Payments', edit: true, f: deletePayment_, log: 'paymentDel' },
  vendorLedger:      { m: 'Vendor Ledger', any: ['Vendor Ledger', 'Vendor Outstanding', 'Machinery Payments'], f: vendorLedger_ },
  vendorOutstanding: { m: 'Vendor Outstanding', f: vendorOutstanding_ },
  verifyBills:       { m: 'Machinery Billing', edit: true, f: verifyBills_ },
  submitBills:       { m: 'Machinery Billing', edit: true, f: submitBills_, log: 'billSubmit' },
  deleteBill:        { m: 'Saved Bills', admin: true, f: deleteBill_, log: 'billDelete' },
  getDebitPending:   { m: 'Machinery Billing', f: debitPending_ },
  saveDebitNote:     { m: 'Machinery Billing', edit: true, f: saveDebitNote_, log: 'debitNote' },
  getDebitNotes:     { m: 'Saved Bills', any: ['Saved Bills', 'Machinery Billing', 'Vendor Ledger'], f: getDebitNotes_ },
  cancelDebitNote:   { m: 'Saved Bills', admin: true, f: cancelDebitNote_, log: 'debitNoteCancel' },
  vendorsFromOwners: { m: 'Vendor Master', edit: true, f: vendorsFromOwners_, log: 'vendorsNew' },
  assignVendors:     { m: 'Master', edit: true, f: assignVendors_, log: 'assignVendors' },
  editMasterMany:    { m: 'Master', edit: true, f: editMasterMany_, log: 'masterMany' },
  deleteMasterMany:  { m: 'Master', edit: true, f: deleteMasterMany_, log: 'masterManyDel' },
  importMaster:      { m: 'Master', edit: true, f: importMaster_, log: 'masterImport' },
  getInwards:        { m: 'Diesel Inward', f: getInwards_ },
  saveInward:        { m: 'Diesel Inward', edit: true, f: saveInward_, log: 'add', sheet: 'SHEET_INWARD', idh: 'IN_ID' },
  importInward:      { m: 'Diesel Inward', edit: true, f: importInward_, log: 'inImport' },
  updateInward:      { m: 'Diesel Inward', edit: true, f: updateInward_, log: 'edit', sheet: 'SHEET_INWARD', idh: 'IN_ID' },
  deleteInward:      { m: 'Diesel Inward', edit: true, f: deleteInward_, log: 'delete', sheet: 'SHEET_INWARD', idh: 'IN_ID' },
  getTransfers:      { m: 'Diesel Transfer', f: getTransfers_ },
  getTransferBalance:{ m: 'Diesel Transfer', f: getTransferBalance_ },
  saveTransfer:      { m: 'Diesel Transfer', edit: true, f: saveTransfer_, log: 'add', sheet: 'SHEET_TRANSFER', idh: 'TR_ID' },
  saveTransferBulk:  { m: 'Diesel Transfer', edit: true, f: saveTransferBulk_, log: 'trBulk' },
  updateTransfer:    { m: 'Diesel Transfer', edit: true, f: updateTransfer_, log: 'edit', sheet: 'SHEET_TRANSFER', idh: 'TR_ID' },
  deleteTransfer:    { m: 'Diesel Transfer', edit: true, f: deleteTransfer_, log: 'delete', sheet: 'SHEET_TRANSFER', idh: 'TR_ID' },
  getDieselIssues:   { m: 'Diesel Issue', f: getDieselIssues_ },
  getIssueBalance:   { m: 'Diesel Issue', f: getIssueBalance_ },
  getStockPoints:    { m: 'Diesel Issue', f: getStockPoints_ },
  saveDieselIssue:   { m: 'Diesel Issue', edit: true, f: saveDieselIssue_, log: 'add', sheet: 'SHEET_DIESEL', idh: 'ID' },
  saveDieselBulk:    { m: 'Diesel Issue', edit: true, f: saveDieselBulk_, log: 'dieselBulk' },
  importDiesel:      { m: 'Diesel Issue', edit: true, f: importDiesel_, log: 'diImport' },
  updateDieselIssue: { m: 'Diesel Issue', edit: true, f: updateDieselIssue_, log: 'edit', sheet: 'SHEET_DIESEL', idh: 'ID' },
  deleteDieselIssue: { m: 'Diesel Issue', edit: true, f: deleteDieselIssue_, log: 'delete', sheet: 'SHEET_DIESEL', idh: 'ID' },
  getLogBook:        { m: 'Log Book', f: getLogBook_ },
  getLogBookList:    { m: 'Log Book', any: ['Log Book', 'Machinery Billing', 'Saved Bills'], f: getLogBookList_ },
  logPrintExtra:     { m: 'Log Book', any: ['Log Book', 'Machinery Billing', 'Saved Bills'], f: logPrintExtra_ },
  getLogEntry:       { m: 'Log Book', f: getLogEntry_ },
  getLogEditData:    { m: 'Log Book', f: getLogEditData_ },
  getTankSystem:     { m: 'Log Book', f: getTankSystem_ },
  getTankChecks:     { m: 'Log Book', f: getTankChecks_ },
  saveTankCheck:     { m: 'Log Book', edit: true, f: saveTankCheck_, log: 'tankAdd' },
  deleteTankCheck:   { m: 'Log Book', edit: true, f: deleteTankCheck_, log: 'tankDel' },
  rptTank:           { m: 'Reports', f: rptTank_ },
  saveLogBulk:       { m: 'Log Book', edit: true, f: saveLogBulk_, log: 'logBulk' },
  updateLogRow:      { m: 'Log Book', edit: true, f: updateLogRow_, log: 'logEdit' },
  deleteLogRow:      { m: 'Log Book', edit: true, f: deleteLogRow_, log: 'logDelete' },
  getLogPrefill:     { m: 'Log Book', f: getLogPrefill_ },
  saveLogBook:       { m: 'Log Book', edit: true, f: saveLogBook_, log: 'logbook' },
  getLogDayPrefill:  { m: 'Log Book', f: getLogDayPrefill_ },
  saveLogDay:        { m: 'Log Book', edit: true, f: saveLogDay_, log: 'logday' },
  getLogRowPrefill:  { m: 'Log Book', f: getLogRowPrefill_ },
  getLogRowPrefills: { m: 'Log Book', f: getLogRowPrefills_ },
  saveLogRows:       { m: 'Log Book', edit: true, f: saveLogRows_, log: 'logrows' },
  checkLogImport:    { m: 'Log Book', f: b => importLogBook_(Object.assign({}, b, { check: true })) },
  importLogBook:     { m: 'Log Book', edit: true, f: importLogBook_, log: 'logImport' },
  getActivity:       { m: '', admin: true, f: getActivity_ },
  usersAdmin:        { m: '', admin: true, f: usersAdmin_ },
  readme:            { m: '', admin: true, f: () => (typeof readmePage_ === 'function' ? readmePage_() : { missing: true }) }, // ReadMe.gs
  saveUserAdmin:     { m: '', admin: true, withUser: true, f: (u, x) => saveUserAdmin_(x, u), log: 'userSave' },
  getMonthlyDieselReport: { m: 'Reports', f: getMonthlyDieselReport_ },
  getMonthlyAvgReport: { m: 'Reports', f: f => getMonthlyDieselReport_(Object.assign({}, f, { withReadings: true })) },
  getDailyInwardIssueReport: { m: 'Reports', f: getDailyInwardIssueReport_ },
  rptDebit:          { m: 'Reports', f: rptDebit_ },
  saveDebitRates:    { m: 'Diesel Issue', edit: true, f: saveDebitRates_, log: 'debitRates' },
  rptCost:           { m: 'Reports', f: rptCost_ },
  rptMachineCost:    { m: 'Reports', f: rptMachineCost_ },
  rptPurchase:       { m: 'Reports', f: rptPurchase_ },
  rptLedger:         { m: 'Reports', f: rptLedger_ },
  rptOwner:          { m: 'Reports', f: rptOwner_ },
  rptType:           { m: 'Reports', f: rptType_ },
  rptStock:          { m: 'Reports', f: rptStock_ },
  rptCompare:        { m: 'Reports', f: rptCompare_ },
  rptAverage:        { m: 'Reports', f: rptAverage_ },
};

function api(token, fn, args) {
  { const moved = movedTo_(); if (moved) throw new Error('The app has moved to a new link: ' + moved + ' – open it and sign in with the same password.'); }
  const u = sessionUser_(token);
  if (!u) throw new Error('SESSION_EXPIRED');
  const spec = API_[fn];
  if (!spec) throw new Error('Unknown action: ' + fn);
  if (spec.admin && !u.admin) throw new Error(fn === 'backupNow' ? 'Only Admin can start a backup.' : fn === 'getActivity' ? 'Only Admin can open the Activity Log.' : 'Only Admin can open this.');
  const label = m => MODULE_LABEL_[m] || m;
  if (spec.any) { if (!spec.any.some(m => u.perms[m] && u.perms[m] !== 'None')) throw new Error('You do not have access to ' + spec.any.map(label).join(' / ') + '. Ask Admin.'); }
  else if (spec.m && u.perms[spec.m] === 'None') throw new Error('You do not have access to ' + label(spec.m) + '. Ask Admin.');
  if (spec.edit && !canEdit_(u, spec.m)) throw new Error('You have View access only for ' + label(spec.m) + '. Ask Admin for Edit access.');
  args = args || [];
  /* The same NEW entry sent twice within a few seconds (double click, a retry on a weak connection, two tabs) is saved
   * once: the second copy is refused. Only for actions that ADD rows; a different entry, or the same one again later,
   * is not affected. If the first one fails, its place is given back so it can be tried again at once. */
  let onceKey = '';
  if (ONCE_FNS_.indexOf(fn) > -1 && typeof __count === 'function') {
    const k = 'DUP_' + hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, u.email + '|' + fn + '|' + JSON.stringify(args), Utilities.Charset.UTF_8)).slice(0, 40);
    const n = __count(k, 8);
    if (n > 1) throw new Error('This entry was just sent twice – it is saved once. Check the list before entering it again.');
    if (n === 1) onceKey = k;
  }
  try { return apiRun_(u, spec, fn, args); }
  catch (err) { if (onceKey) { try { __uncount(onceKey); } catch (e2) { /* it frees itself in a few seconds */ } } throw err; }
}
const ONCE_FNS_ = ['saveDebitNote', 'saveDieselIssue', 'saveDieselBulk', 'importDiesel', 'saveInward', 'importInward', 'saveTransfer', 'saveTransferBulk', 'savePayment', 'saveTankCheck', 'submitBdReport'];
function apiRun_(u, spec, fn, args) {
  const vBefore = spec.edit ? getVersions_() : null;
  TABLE_MEMO_ = {}; // each tab read once per request (dropped automatically when written)
  if (sbDataOn_()) sbDiscard_(); // Supabase: every request starts with fresh data
  const before = spec.log ? logBefore_(spec, args) : null;
  ACTOR_ = u.name || u.email || '';
  const res = spec.withUser ? spec.f.apply(null, [u].concat(args)) : spec.f.apply(null, args);
  if (fn === 'getInit' || fn === 'sync') { res.user = publicUser_(u); res.versions = getVersions_(); res.today = today_(); res.source = sbDataOn_() ? 'supabase' : 'sheet'; res.build = appBuild_();
    if (typeof sbBackupInfo_ === 'function') res.backup = sbBackupInfo_(); }
  if (spec.log) {
    try { logAfter_(u, spec, args, res, before); } catch (e) { /* the entry is saved; a log problem must not undo it */ }
  }
  if (spec.edit) {
    bump_(SYNC_GROUPS_[spec.m] || []); // tell every open app that this data changed
    if (res && typeof res === 'object' && !Array.isArray(res)) res._v = { before: vBefore, after: getVersions_() };
  }
  sbFlush_(); // Supabase: Activity Log lines and anything else still waiting
  return res;
}

/* ================= LIVE SYNC =================
 * Every change – from the app (any user) or typed directly in the Google Sheet – raises a "version" for its data group.
 * Every open app asks every few seconds (sync) and reloads only what changed, and re-applies the user's access.
 * Groups: master, stock (Inward, Transfer, Diesel Issue), log (Log Book), users, activity.
 * New modules: add their sheet to SHEET_GROUPS_ and their module to SYNC_GROUPS_.
 */
const SYNC_GROUPS_ = {
  'Master': ['master'], 'Diesel Inward': ['stock'], 'Diesel Transfer': ['stock'],
  'Diesel Issue': ['stock', 'log'], 'Log Book': ['log'],
};
const SHEET_GROUPS_ = {
  'Master': ['master'], 'Diesel Inward': ['stock'], 'Diesel Transfer': ['stock'], 'Diesel Issue': ['stock', 'log'],
  'Log Book': ['log'], 'Users': ['users'], 'Activity Log': ['activity'], 'Tank Check': ['log'],
};
// Versions live in the fast script cache (read by every user every few seconds, no daily limit),
// with a copy in Script Properties in case the cache is cleared.
const SYNC_KEYS_ = ['master', 'stock', 'log', 'users', 'activity'].map(g => 'V_' + g);
function bump_(groups) {
  if (!groups || !groups.length) return;
  if (groups.indexOf('users') > -1) CacheService.getScriptCache().remove('USERS_LIST'); // access changes apply at once
  const v = String(Date.now()) + Math.floor(Math.random() * 1000);
  const o = {};
  groups.forEach(g => { o['V_' + g] = v; });
  CacheService.getScriptCache().putAll(o, 21600);
  PropertiesService.getScriptProperties().setProperties(o);
}
function getVersions_() {
  const cache = CacheService.getScriptCache();
  let got = cache.getAll(SYNC_KEYS_);
  if (SYNC_KEYS_.some(k => !(k in got))) {
    const all = PropertiesService.getScriptProperties().getProperties();
    got = {};
    SYNC_KEYS_.forEach(k => { got[k] = all[k] || '0'; });
    cache.putAll(got, 21600);
  }
  const v = {};
  SYNC_KEYS_.forEach(k => { v[k.slice(2)] = got[k] || '0'; });
  return v;
}
function getLookups_() { return { master: getMaster_(), drivers: getDrivers_(), pumps: getPumps_(), vendors: vendorNames_() }; }

// Simple trigger: runs by itself whenever someone types in the Google Sheet
function onEdit(e) {
  if (sbDataOn_()) return; // the app's data is in Supabase – edits in this Google Sheet do not change it
  try {
    if (!e || !e.range || typeof e.range.getSheet !== 'function') return; // only a real edit in the sheet
    const name = e.range.getSheet().getName();
    const groups = SHEET_GROUPS_[name];
    if (!groups) return;
    // quantities typed in the sheet: keep the Balance columns right
    if (groups.indexOf('stock') > -1) { try { recalcBalances_(); } catch (err) { /* balances refresh on the next save */ } }
    bump_(groups);
  } catch (err) { /* never block typing in the sheet */ }
}
// Installed by setupLiveSync (Setup.gs): catches rows inserted or deleted in the sheet
function liveSyncOnChange(e) {
  if (sbDataOn_()) return;
  // only the real installed trigger (its authMode is a Google value that cannot be sent from a browser)
  if (!e || e.authMode !== ScriptApp.AuthMode.FULL || !e.triggerUid) return;
  const cache = CacheService.getScriptCache();
  if (cache.get('LSC_BUSY')) return; cache.put('LSC_BUSY', '1', 5); // at most once every few seconds
  const t = e && e.changeType;
  if (t === 'INSERT_ROW' || t === 'REMOVE_ROW' || t === 'INSERT_COLUMN' || t === 'REMOVE_COLUMN' || t === 'OTHER' || t === 'EDIT') {
    try { recalcBalances_(); } catch (err) { /* ignore */ }
    bump_(['master', 'stock', 'log', 'users', 'activity']);
  }
}

/* ---------- Activity Log ---------- */
function writeLog_(u, action, module, recordId, summary, changes) {
  const ss = SS_();
  const sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) return;
  const p = PropertiesService.getScriptProperties();
  const n = Number(p.getProperty('LOG_LAST_NO') || 0) + 1;
  p.setProperty('LOG_LAST_NO', String(n));
  sh.appendRow(safeRows_(['LOG-' + String(n).padStart(7, '0'), new Date(), u.email || '', u.name || '', action, module || '', recordId || '', String(summary || '').slice(0, 2000), String(changes || '').slice(0, 5000)]));
  bump_(['activity']);
}

const LOG_SKIP_ = ['Balance', 'From Balance', 'To Balance', 'Created At'];
function fmtVal_(v) {
  if (v instanceof Date) return dkey_(v).split('-').reverse().join('-'); // dd-mm-yyyy (Created At is not logged)
  return v === null || v === undefined ? '' : String(v);
}
// one sheet row as { header: value }
function snapshot_(sheetName, idHeader, id) {
  const t = table_(sheetName, [idHeader]);
  const r = t.rows.find(x => str_(x[t.c[idHeader]]) === str_(id));
  if (!r) return null;
  const o = {};
  t.headers.forEach((h, i) => { if (h) o[h] = r[i]; });
  return o;
}
function masterSnapshot_(id) {
  const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
  const r = t.rows.find(x => same_(rowId_(x, t), id));
  if (!r) return null;
  const o = {};
  t.headers.forEach((h, i) => { if (h) o[h] = r[i]; });
  return o;
}
function describe_(o) {
  if (!o) return '';
  return Object.keys(o).filter(k => LOG_SKIP_.indexOf(k) === -1 && fmtVal_(o[k]) !== '').map(k => k + ': ' + fmtVal_(o[k])).join('; ');
}
function changes_(a, b) {
  const keys = Object.keys(Object.assign({}, a || {}, b || {})).filter(k => LOG_SKIP_.indexOf(k) === -1);
  return keys.filter(k => fmtVal_((a || {})[k]) !== fmtVal_((b || {})[k]))
    .map(k => k + ': ' + (fmtVal_((a || {})[k]) || '(blank)') + ' → ' + (fmtVal_((b || {})[k]) || '(blank)')).join('; ');
}
function logBefore_(spec, args) {
  if (spec.log === 'edit' || spec.log === 'delete') return snapshot_(APP[spec.sheet], H[spec.idh], args[0]);
  if (spec.log === 'master' && args[1] === 'edit') return masterSnapshot_(args[2]);
  if (spec.log === 'masterDelete') return masterSnapshot_(args[0]);
  if (spec.log === 'logEdit' || spec.log === 'logDelete') return snapshotLog_(args[0]);
  return null;
}
function logAfter_(u, spec, args, res, before) {
  if (!res || res.ok === false || (res.errors && res.errors.length) || res.warning || res.warnings) return; // nothing was saved
  const m = spec.m;
  switch (spec.log) {
    case 'add': {
      const after = snapshot_(APP[spec.sheet], H[spec.idh], res.id);
      writeLog_(u, 'Add', m, res.id, 'New entry ' + res.id, describe_(after));
      break;
    }
    case 'edit': {
      const after = snapshot_(APP[spec.sheet], H[spec.idh], args[0]);
      writeLog_(u, 'Edit', m, str_(args[0]), 'Changed ' + str_(args[0]), changes_(before, after) || 'No field changed');
      break;
    }
    case 'delete':
      writeLog_(u, 'Delete', m, str_(args[0]), 'Deleted ' + str_(args[0]), 'Deleted values – ' + describe_(before));
      break;
    case 'dieselBulk': {
      const b = args[0] || {};
      writeLog_(u, 'Add (multiple)', m, res.firstId + ' to ' + res.lastId, res.count + ' diesel issues on ' + fmtVal_(toDate_(b.date)) + ' ' + b.shift + ' from ' + b.source,
        (b.rows || []).filter(r => str_(r.no)).map(r => clean_(r.no) + ' ' + r.qty + ' Ltr (' + clean_(r.driver) + ')').join('; '));
      break;
    }
    case 'master': {
      const v = validateMaster_(args[0]);
      const after = masterSnapshot_(v.id);
      if (args[1] === 'edit') writeLog_(u, 'Edit', m, str_(args[2]), 'Changed ' + str_(args[2]), changes_(before, after) || 'No field changed');
      else writeLog_(u, 'Add', m, v.id, 'New machinery ' + v.id, describe_(after));
      break;
    }
    case 'masterBulk':
      writeLog_(u, 'Add (multiple)', m, '', res.count + ' machinery added', (args[0] || []).filter(x => str_(x.no) || str_(x.name)).map(x => formatNo_(x.no || '') || clean_(x.name)).join(', '));
      break;
    case 'masterMany':
      if (res.ok) writeLog_(u, 'Edit (multiple)', m, res.count + ' machinery', 'Changed ' + Object.keys(args[1] || {}).join(', ') + ' for ' + res.count + ' machinery', (args[0] || []).join(', '));
      break;
    case 'masterManyDel':
      if (res.ok) writeLog_(u, 'Delete (multiple)', m, res.count + ' machinery', 'Deleted ' + res.count + ' machinery', (res.ids || []).join(', '));
      break;
    case 'vendor':
      if (res.ok) writeLog_(u, args[1] === 'add' ? 'Add' : 'Edit', m, res.name, (args[1] === 'add' ? 'Vendor details saved: ' : 'Vendor details changed: ') + res.name, '');
      break;
    case 'billSettings':
      writeLog_(u, 'Edit', m, 'Company details', 'Company details / project name for bills changed', '');
      break;
    case 'billSubmit':
      if (res.ok) writeLog_(u, 'Add (multiple)', m, res.saved.length + ' bills', res.saved.length + ' bill(s) submitted', res.saved.map(x => x.vendor + ' – bill ' + x.billNo + (x.rev ? ' rev ' + x.rev : '') + ' (' + x.id + ')').join(', '));
      break;
    case 'breakdown':
      if (res.ok) writeLog_(u, res.action === 'delete' ? 'Delete' : res.action === 'add' ? 'Add' : 'Edit', 'Breakdown', res.no, res.summary, res.changes || '');
      break;
    case 'lbFormatName':
      if (res.ok) writeLog_(u, 'Edit', 'Master', 'Log Book format ' + res.id, 'Log Book format ' + res.id + ' renamed', (res.from || '(default)') + ' → ' + res.name);
      break;
    case 'lbFormat':
      if (res.ok && res.count) writeLog_(u, 'Edit', 'Master', 'Log Book format', 'Log Book format set for ' + res.count + ' machinery', res.list || '');
      break;
    case 'bdReport':
      if (res.ok) writeLog_(u, res.deleted ? 'Delete' : res.replaced ? 'Edit' : 'Add', 'Breakdown', dmy_(res.date), res.deleted ? 'Daily machinery status of ' + dmy_(res.date) + ' deleted' :
        'Daily machinery status of ' + dmy_(res.date) + (res.replaced ? ' changed' : ' submitted') + ': ' + res.total + ' machinery, ' + res.count + ' under breakdown', res.list || '');
      break;
    case 'cmpImport':
      if (res.ok && res.applied && res.changes) writeLog_(u, 'Edit', 'Vehicle Compliance', 'Excel import', 'Papers imported from Excel: ' + res.changes + ' date(s) on ' + res.machines + ' machinery', res.list || '');
      break;
    case 'cmpRules':
      if (res.ok) writeLog_(u, 'Edit', 'Vehicle Compliance', 'Papers per type', 'Papers needed per machinery type changed', res.changes || '');
      break;
    case 'renew':
      if (res.ok) writeLog_(u, 'Edit', 'Vehicle Compliance', res.no, res.doc + ' renewed: ' + res.no + ' – valid upto ' + docShow_(res.to), res.doc + ' Valid Upto: ' + docShow_(res.from) + ' → ' + docShow_(res.to));
      break;
    case 'debitNote':
      if (res.ok) writeLog_(u, 'Add', 'Debit Notes', res.id, 'Debit note ' + res.no + ' made: ' + res.vendor + ' – ' + r2_(res.total) + ' (' + res.company + ')', res.lines + ' line(s)');
      break;
    case 'debitNoteCancel':
      if (res.ok && !res.already) writeLog_(u, 'Delete', 'Debit Notes', res.id, 'Debit note ' + res.no + ' cancelled: ' + res.vendor + ' – ' + r2_(res.total), '');
      break;
    case 'payment':
      if (res.ok) writeLog_(u, res.added ? 'Add' : 'Edit', m, res.id, (res.type === 'Opening' ? 'Opening balance ' : 'Payment ') + (res.added ? 'entered: ' : 'changed: ') + res.vendor + ' – ' + r2_(res.amount), res.changes || '');
      break;
    case 'paymentDel':
      if (res.ok) writeLog_(u, 'Delete', m, res.id, (res.type === 'Opening' ? 'Opening balance' : 'Payment') + ' deleted: ' + res.vendor + ' – ' + r2_(res.amount) + ' (' + dmy_(res.date) + ')', '');
      break;
    case 'billDelete':
      if (res.ok) writeLog_(u, 'Delete', m, res.bill.id, 'Bill deleted: ' + res.bill.vendor + ' – bill ' + res.bill.billNo + ' (' + dmy_(res.bill.from) + ' to ' + dmy_(res.bill.to) + ')', 'Reason: ' + clean_(args[1]));
      break;
    case 'userSave':
      if (res.ok) writeLog_(u, res.added ? 'Add' : 'Edit', 'Users', res.email, (res.added ? 'User added: ' : 'User changed: ') + res.email, res.changes || '');
      break;
    case 'vendorsNew':
      if (res.ok && res.count) writeLog_(u, 'Add (multiple)', m, res.count + ' vendors', res.count + ' vendors created from Owner Names', (res.names || []).join(', '));
      break;
    case 'assignVendors':
      if (res.ok) writeLog_(u, 'Edit (multiple)', m, res.count + ' assets', 'Vendor assigned to ' + res.count + ' assets', (args[0] || []).map(x => str_(x.id) + ' → ' + clean_(x.vendor)).join(', '));
      break;
    case 'vendorDel':
      if (res.ok) writeLog_(u, 'Delete', m, str_(args[0]), 'Vendor details deleted: ' + str_(args[0]), '');
      break;
    case 'boq':
      if (res.ok) writeLog_(u, args[1] === 'edit' ? 'Edit' : 'Add', m, res.id, (args[1] === 'edit' ? 'BOQ changed ' : (args[0] && args[0].amendOf ? 'BOQ amendment ' + res.amendNo + ' added ' : 'BOQ added ')) + res.id + ' – ' + clean_((args[0] || {}).vendor), '');
      break;
    case 'boqDel':
      if (res.ok) writeLog_(u, 'Delete', m, str_(args[0]), 'BOQ deleted ' + str_(args[0]), '');
      break;
    case 'masterDelete':
      if (res.ok) writeLog_(u, 'Delete', m, str_(args[0]), 'Deleted machinery ' + str_(args[0]), 'Deleted values – ' + describe_(before));
      break;
    case 'masterImport':
      if (res.saved) writeLog_(u, 'Import', m, '', 'Excel import: ' + res.adds + ' new, ' + res.updates + ' updated',
        (args[0] || []).filter(x => str_(x.no) || str_(x.name)).map(x => formatNo_(x.no || '') || clean_(x.name)).join(', '));
      break;
    case 'debitRates':
      if (res.count) writeLog_(u, 'Edit', 'Diesel Issue', (args[0] || []).map(x => x.id).join(', '), 'Debit rate changed for ' + res.count + ' entr' + (res.count === 1 ? 'y' : 'ies'),
        (args[0] || []).map(x => x.id + ': ' + (blank_(x.rate) ? 'back to rate of the day' : '₹' + x.rate)).join('; '));
      break;
    case 'diImport':
      if (res.ok) writeLog_(u, 'Add', m, res.ids[0] + (res.ids.length > 1 ? ' to ' + res.ids[res.ids.length - 1] : ''), 'Imported ' + res.count + ' diesel issues from a file (' + res.qty + ' Ltr)', '');
      break;
    case 'trBulk':
      if (res.ok) writeLog_(u, 'Add', m, res.ids[0] + (res.ids.length > 1 ? ' to ' + res.ids[res.ids.length - 1] : ''), 'Saved ' + res.count + ' transfers together (' + res.qty + ' Ltr)', '');
      break;
    case 'logImport':
      if (res.ok) writeLog_(u, 'Add', m, res.added + ' new / ' + res.overwritten + ' overwritten', 'Log Book imported from a file: ' + res.added + ' new, ' + res.overwritten + ' overwritten, ' + res.same + ' already there', '');
      break;
    case 'inImport':
      if (res.ok) writeLog_(u, 'Add', m, res.ids[0] + (res.ids.length > 1 ? ' to ' + res.ids[res.ids.length - 1] : ''), 'Imported ' + res.count + ' inward entries from a file (' + res.qty + ' Ltr)', '');
      break;
    case 'tankAdd': {
      const t = args[0] || {};
      writeLog_(u, 'Add', m, res.id, 'Tank check ' + res.no + ' on ' + fmtVal_(toDate_(res.date)) + ': system ' + res.system + ' L, found ' + res.physical + ' L (' + (res.diff > 0 ? '+' : '') + res.diff + ' L)', clean_(t.reason));
      break;
    }
    case 'tankDel': writeLog_(u, 'Delete', m, res.id, 'Tank check deleted: ' + res.no + ' on ' + fmtVal_(toDate_(res.date)), ''); break;
    case 'logBulk': {
      const b = args[0] || {};
      if (res.changed || res.added || res.deleted) writeLog_(u, 'Edit', m, res.no, 'Edit Log Book ' + fmtVal_(toDate_(b.from)) + ' to ' + fmtVal_(toDate_(b.to)) + ': ' + res.changed + ' changed, ' + res.added + ' added, ' + res.deleted + ' deleted',
        (b.deleted || []).length ? 'Deleted: ' + b.deleted.map(k => str_(k).split('|').slice(1).join(' ')).join(', ') : '');
      break;
    }
    case 'logEdit': {
      const after = snapshotLog_(args[0]);
      writeLog_(u, 'Edit', m, str_(args[0]).replace(/\|/g, ' '), 'Changed Log Book entry (following entries updated)', changes_(before, after) || 'No field changed');
      break;
    }
    case 'logDelete':
      writeLog_(u, 'Delete', m, str_(args[0]).replace(/\|/g, ' '), 'Deleted Log Book entry (following entries updated)', 'Deleted values – ' + describe_(before));
      break;
    case 'logrows': {
      const rows = (args[0] && args[0].rows || []).filter(r => str_(r.no));
      writeLog_(u, 'Add (multiple)', m, (res.ids || []).join(', '), res.count + ' Log Book entries',
        rows.map(r => clean_(r.no) + ' ' + fmtVal_(toDate_(r.date)) + ' ' + (r.shift || 'Full Day') + ' – close ' +
          [r.closingKm !== '' && r.closingKm !== undefined ? r.closingKm + ' km' : '', r.closingHr !== '' && r.closingHr !== undefined ? r.closingHr + ' hr' : ''].filter(Boolean).join(', ') +
          (r.chFrom || r.chTo ? ', ch ' + (r.chFrom || '') + '–' + (r.chTo || '') : '') + (r.work ? ', ' + clean_(r.work) : '')).join('; '));
      break;
    }
    case 'logday': {
      const b = args[0] || {};
      writeLog_(u, 'Add (multiple)', m, (res.ids || []).join(', '), res.count + ' Log Book entries on ' + fmtVal_(toDate_(b.date)),
        (b.rows || []).filter(r => str_(r.no)).map(r => clean_(r.no) + ' – closing ' + [r.closingKm !== '' && r.closingKm !== undefined ? r.closingKm + ' km' : '', r.closingHr !== '' && r.closingHr !== undefined ? r.closingHr + ' hr' : ''].filter(Boolean).join(', ') +
          (r.trip !== '' && r.trip !== undefined ? ', ' + r.trip + ' trips' : '') + (r.chFrom || r.chTo ? ', ch ' + (r.chFrom || '') + '–' + (r.chTo || '') : '')).join('; '));
      break;
    }
    case 'logbook': {
      const l = args[0] || {};
      writeLog_(u, 'Add', m, clean_(l.no) + ' ' + fmtVal_(toDate_(l.date)) + ' ' + l.shift, 'Log Book entry',
        describe_({ 'Machinery': l.no, 'Date': toDate_(l.date), 'Shift': l.shift, 'Opening KM': l.openingKm, 'Closing KM': l.closingKm,
          'Opening Hrs': l.openingHr, 'Closing Hrs': l.closingHr, 'Driver Name': l.driver, 'Trip': l.trip, 'Chainage No.': l.chainage, 'Work Done': l.workDone }));
      break;
    }
  }
}

// f: { from, to, user, module, action, q } – newest first
function getActivity_(f) {
  f = f || {};
  const sh = SS_().getSheetByName(LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) return { count: 0, rows: [] };
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  const from = str_(f.from), to = str_(f.to), usr = str_(f.user).toLowerCase(), mod = str_(f.module), act = str_(f.action), q = str_(f.q).toUpperCase();
  const hits = vals.filter(r => {
    const dk = dkey_(r[1]);
    if ((from && dk < from) || (to && dk > to)) return false;
    if (usr && (str_(r[2]) + ' ' + str_(r[3])).toLowerCase().indexOf(usr) === -1) return false;
    if (mod && str_(r[5]) !== mod) return false;
    if (act && str_(r[4]).indexOf(act) !== 0) return false;
    if (q && (str_(r[6]) + ' ' + str_(r[7]) + ' ' + str_(r[8])).toUpperCase().indexOf(q) === -1) return false;
    return true;
  });
  hits.reverse();
  return {
    count: hits.length,
    rows: hits.slice(0, 500).map(r => ({
      id: str_(r[0]), when: r[1] instanceof Date ? Utilities.formatDate(r[1], tz_(), 'dd-MM-yyyy HH:mm:ss') : str_(r[1]),
      email: str_(r[2]), name: str_(r[3]), action: str_(r[4]), module: str_(r[5]), record: str_(r[6]), summary: str_(r[7]), changes: str_(r[8]),
    })),
  };
}

/* ================= MASTER ================= */
// A machine is identified by its Machinery Number; if it has no number, by its Machinery Name.
function rowId_(r, t) { return str_(r[t.c[H.NO]]) || str_(r[t.c[H.NAME]]); }

function getMaster_() {
  if (TABLE_MEMO_ && TABLE_MEMO_.__master) return TABLE_MEMO_.__master;
  const list = buildMaster_();
  if (TABLE_MEMO_) TABLE_MEMO_.__master = list;
  return list;
}
function buildMaster_() {
  const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
  return t.rows
    .filter(r => rowId_(r, t) !== '')
    .map(r => ({
      id: rowId_(r, t),
      no: str_(r[t.c[H.NO]]), name: str_(r[t.c[H.NAME]]), type: str_(r[t.c[H.TYPE]]),
      make: str_(r[t.c[H.MAKE]]), ...(() => { const w = H.WORKS in t.c && normWorks_(r[t.c[H.WORKS]]).length ? normWorks_(r[t.c[H.WORKS]]) : worksFromUnit_(r[t.c[H.UNIT]]);
        const fm = H.LBFMT in t.c ? (str_(r[t.c[H.LBFMT]]) || 'A') : 'A', fmd = LB_FMT_MODES_[fm];
        return { lbFormat: fm, worksOn: w, unit: H.WORKS in t.c && normWorks_(r[t.c[H.WORKS]]).length ? unitFromWorks_(w) : normUnit_(r[t.c[H.UNIT]]), modes: fmd || logModes_(w), meterKm: fmd ? fmd.some(hasKm_) : (w.indexOf('KM') > -1 || w.indexOf('KM + Hrs') > -1), meterHr: fmd ? fmd.some(hasHr_) : (w.indexOf('Hrs') > -1 || w.indexOf('KM + Hrs') > -1) }; })(),
      kmStd: numOrBlank_(r[t.c[H.KMSTD]]), hrStd: numOrBlank_(r[t.c[H.HRSTD]]), owner: str_(r[t.c[H.OWNER]]),
      ownership: normOwnership_(r[t.c[H.OWNTYPE]]),
      supply: normSupply_(r[t.c[H.SUPPLY]], str_(r[t.c[H.OWNTYPE]])),
      status: str_(r[t.c[H.STATUS]]).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active',
      activeFrom: r[t.c[H.AFROM]] === '' ? '' : dkey_(r[t.c[H.AFROM]]),
      inactiveFrom: r[t.c[H.IFROM]] === '' ? '' : dkey_(r[t.c[H.IFROM]]),
      tankCap: H.TCAP in t.c ? numOrBlank_(r[t.c[H.TCAP]]) : '', // optional, reference only
      monthlyRate: H.MRATE in t.c ? numOrBlank_(r[t.c[H.MRATE]]) : '', // Rental / Hired only
      engineNo: H.ENGNO in t.c ? str_(r[t.c[H.ENGNO]]) : '', chassisNo: H.CHASSIS in t.c ? str_(r[t.c[H.CHASSIS]]) : '', engineMake: H.ENGMAKE in t.c ? str_(r[t.c[H.ENGMAKE]]) : '',
      taxUpto: H.TAXV in t.c ? docVal_(r[t.c[H.TAXV]]) : '', pucUpto: H.PUCV in t.c ? docVal_(r[t.c[H.PUCV]]) : '', permitUpto: H.PERMITV in t.c ? docVal_(r[t.c[H.PERMITV]]) : '',
      fitnessUpto: H.FITV in t.c ? docVal_(r[t.c[H.FITV]]) : '', insuranceUpto: H.INSV in t.c ? docVal_(r[t.c[H.INSV]]) : '',
      tdsRate: H.TDS in t.c ? numOrBlank_(r[t.c[H.TDS]]) : '',
      enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '', updatedBy: H.UBY in t.c ? str_(r[t.c[H.UBY]]) : '',
    }));
}

const MASTER_COLS_ = [H.NO, H.NAME, H.TYPE, H.MAKE, H.UNIT, H.KMSTD, H.HRSTD, H.OWNER, H.OWNTYPE, H.SUPPLY, H.STATUS, H.AFROM, H.IFROM];

function normSupply_(v, ownership) {
  const k = str_(v).toUpperCase().replace(/[^A-Z]/g, '');
  if (k === 'COMPANY' || k === 'RCL') return 'Company';
  if (k === 'DEBIT' || k === 'DEBITBASIS') return 'Debit Basis';
  if (k === 'OTHER') return 'Other';
  return ownership === 'Debit' ? 'Debit Basis' : 'Company'; // blank: sensible default
}
// Machinery must be active on the entry date: on/after "Active From" and before "Inactive From"
function assertActive_(m, dk) {
  const show = k => k.split('-').reverse().join('-');
  if (m.activeFrom && dk < m.activeFrom) throw new Error(m.id + ' is active only from ' + show(m.activeFrom) + '. Entry date ' + show(dk) + ' is before that.');
  if (m.status === 'Inactive' && (!m.inactiveFrom || dk >= m.inactiveFrom)) {
    throw new Error(m.id + ' is inactive' + (m.inactiveFrom ? ' from ' + show(m.inactiveFrom) : '') + '. Activate it in Master to make entries.');
  }
}

function docCheck_(id, label, v) {
  const x = docVal_(v); if (x === '' || x === 'NA') return x;
  if (x === 'LIFETIME') { if (label !== 'Tax') throw new Error(id + ': "Lifetime" is only for Tax.'); return x; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) throw new Error(id + ': ' + label + ' Valid Upto must be a date, NA if not applicable, or Lifetime (Tax only).');
  return x;
}
function validateMaster_(m) {
  const no = formatNo_(m.no);
  const name = clean_(m.name);
  if (!no && !name) throw new Error('Enter the Machinery Number, or the Machinery Name if it has no number.');
  const id = no || name;
  const ownership = normOwnership_(m.ownership);
  if (APP.OWNERSHIP.indexOf(ownership) === -1) throw new Error(id + ': select Ownership (Own / Rental / Hired / Debit / Other).');
  const debit = ownership === 'Debit'; // Debit: only Number or Name is needed, everything else is optional
  const works = normWorks_(m.worksOn).length ? normWorks_(m.worksOn) : worksFromUnit_(m.unit);
  const unit = unitFromWorks_(works);
  if (!debit && !works.length) throw new Error(id + ': tick what it works on (Day / Trip / KM / Hrs / Time).');
  const kmStd = numOrBlank_(m.kmStd), hrStd = numOrBlank_(m.hrStd);
  if (!debit && hasKm_(unit) && !(kmStd > 0)) throw new Error(id + ': enter Standard Average (KM/Ltr).');
  if (!debit && hasHr_(unit) && !(hrStd > 0)) throw new Error(id + ': enter Standard Average (Ltr/Hr).');
  const supply = normSupply_(m.supply, ownership);
  const status = str_(m.status).toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active';
  const activeFrom = str_(m.activeFrom) ? (m.activeFrom instanceof Date ? dkey_(m.activeFrom) : checkDate_(dkey_(m.activeFrom))) : '';
  const inactiveFrom = str_(m.inactiveFrom) ? (m.inactiveFrom instanceof Date ? dkey_(m.inactiveFrom) : checkDate_(dkey_(m.inactiveFrom))) : '';
  if (status === 'Inactive' && !inactiveFrom) throw new Error(id + ': enter the "Inactive From" date.');
  if (activeFrom && inactiveFrom && inactiveFrom <= activeFrom) throw new Error(id + ': "Inactive From" must be after "Active From".');
  return {
    id: id, no: no, name: name, type: clean_(m.type), make: clean_(m.make), unit: unit, worksOn: works.join(', '),
    kmStd: hasKm_(unit) ? kmStd : '', hrStd: hasHr_(unit) ? hrStd : '', owner: clean_(m.owner), ownership: ownership,
    supply: supply, status: status, activeFrom: activeFrom, inactiveFrom: status === 'Inactive' ? inactiveFrom : '',
    tankCap: blank_(m.tankCap) ? '' : (() => { const v = Number(m.tankCap); if (!(v > 0) || v > 100000) throw new Error(id + ': Tank Capacity must be a number of litres.'); return r2_(v); })(),
    // Monthly Rate and TDS Rate: only for Rental and Hired machinery (blank for the others)
    monthlyRate: m.monthlyRate === undefined ? undefined : (ownership !== 'Rental' && ownership !== 'Hired') || blank_(m.monthlyRate) ? '' :
      (() => { const v = Number(m.monthlyRate); if (!(v >= 0) || !isFinite(v)) throw new Error(id + ': Monthly Rate must be an amount in ₹.'); return r2_(v); })(),
    engineNo: m.engineNo === undefined ? undefined : clean_(m.engineNo).toUpperCase(),
    chassisNo: m.chassisNo === undefined ? undefined : clean_(m.chassisNo).toUpperCase(),
    engineMake: m.engineMake === undefined ? undefined : clean_(m.engineMake),
    taxUpto: m.taxUpto === undefined ? undefined : docCheck_(id, 'Tax', m.taxUpto),
    pucUpto: m.pucUpto === undefined ? undefined : docCheck_(id, 'PUC', m.pucUpto),
    permitUpto: m.permitUpto === undefined ? undefined : docCheck_(id, 'Permit', m.permitUpto),
    fitnessUpto: m.fitnessUpto === undefined ? undefined : docCheck_(id, 'Fitness', m.fitnessUpto),
    insuranceUpto: m.insuranceUpto === undefined ? undefined : docCheck_(id, 'Insurance', m.insuranceUpto),
    tdsRate: m.tdsRate === undefined ? undefined : (ownership !== 'Rental' && ownership !== 'Hired') || blank_(m.tdsRate) ? '' :
      (() => { const v = Number(m.tdsRate); if (!(v >= 0) || v > 100) throw new Error(id + ': TDS Rate must be a % between 0 and 100.'); return r2_(v); })(),
  };
}

function buildMasterRow_(t, base, v) {
  const row = base ? stampEdit_(base.slice(), t) : newRow_(t);
  set_(row, t, H.NO, v.no); set_(row, t, H.NAME, v.name); set_(row, t, H.TYPE, v.type);
  set_(row, t, H.MAKE, v.make); set_(row, t, H.UNIT, v.unit); set_(row, t, H.WORKS, v.worksOn); set_(row, t, H.KMSTD, v.kmStd);
  set_(row, t, H.HRSTD, v.hrStd); set_(row, t, H.OWNER, v.owner); set_(row, t, H.OWNTYPE, v.ownership);
  set_(row, t, H.SUPPLY, v.supply); set_(row, t, H.STATUS, v.status);
  set_(row, t, H.AFROM, v.activeFrom ? toDate_(v.activeFrom) : ''); set_(row, t, H.IFROM, v.inactiveFrom ? toDate_(v.inactiveFrom) : '');
  set_(row, t, H.TCAP, v.tankCap);
  if (v.monthlyRate !== undefined) set_(row, t, H.MRATE, v.monthlyRate);
  if (v.tdsRate !== undefined) set_(row, t, H.TDS, v.tdsRate);
  ASSET_TEXT_.concat(ASSET_DOCS_).forEach(x => { if (v[x[0]] !== undefined) set_(row, t, H[x[1]], v[x[0]]); });
  return row;
}

// mode 'add' or 'edit'. For edit, origId is the machine being edited (its number or name).
function saveMaster_(m, mode, origId) {
  return withLock_(() => {
    const v = validateMaster_(m);
    addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.WORKS);
    if (v.tankCap !== '') addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.TCAP);
    if (v.monthlyRate !== undefined && v.monthlyRate !== '') addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.MRATE);
    if (v.tdsRate !== undefined && v.tdsRate !== '') addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.TDS);
    ASSET_TEXT_.concat(ASSET_DOCS_).forEach(x => { if (v[x[0]] !== undefined && v[x[0]] !== '') addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H[x[1]]); });
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
    const clash = t.rows.findIndex(r => same_(rowId_(r, t), v.id));
    if (mode === 'add') {
      if (clash !== -1) throw new Error(v.id + ' is already in Master.');
      t.sh.appendRow(buildMasterRow_(t, null, v));
    } else {
      const i = t.rows.findIndex(r => same_(rowId_(r, t), origId));
      if (i === -1) throw new Error(clean_(origId) + ' was not found in Master.');
      if (!same_(v.id, origId)) throw new Error('The Machinery Number / Name that identifies ' + clean_(origId) + ' cannot be changed.');
      const was = {}; cmpDocs_().forEach(d => { was[d.name] = d.col in t.c ? docVal_(t.rows[i][t.c[d.col]]) : ''; });
      const row = buildMasterRow_(t, t.rows[i], v);
      t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
      const chg = cmpDocs_().filter(d => d.col in t.c && docVal_(row[t.c[d.col]]) !== was[d.name]).map(d => ({ no: v.id, doc: d.name, from: was[d.name], to: docVal_(row[t.c[d.col]]), on: today_(), source: 'Asset Master' }));
      try { cmpHistAdd_(chg); } catch (e) { /* history is extra – the Master change stands */ }
    }
    return { ok: true, master: getMaster_() };
  });
}

// Add many machinery at once. Nothing is saved if any row has a problem.
function saveMasterBulk_(list) {
  return withLock_(() => {
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
    const existing = {};
    t.rows.forEach(r => { const k = noKey_(rowId_(r, t)); if (k) existing[k] = true; });
    const seen = {}, rows = [], errors = [];
    (list || []).forEach((m, k) => {
      const blank = ['no', 'name', 'type', 'make', 'unit', 'kmStd', 'hrStd', 'owner', 'ownership'].every(f => str_(m[f]) === '');
      if (blank) return;
      try {
        const v = validateMaster_(m);
        const key = noKey_(v.id);
        if (existing[key]) throw new Error(v.id + ' is already in Master.');
        if (seen[key]) throw new Error(v.id + ' is repeated in this list.');
        seen[key] = true;
        rows.push(buildMasterRow_(t, null, v));
      } catch (e) { errors.push({ row: k + 1, msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    if (!rows.length) throw new Error('Enter at least one machinery.');
    t.sh.getRange(t.sh.getLastRow() + 1, 1, rows.length, t.headers.length).setValues(rows);
    return { ok: true, count: rows.length, master: getMaster_() };
  });
}

/* Change the same fields of many machinery at once (Master list → select → Edit selected).
 * changes: only the fields to change, e.g. { ownership: 'Rental', monthlyRate: 45000 }. Every machinery is checked
 * with the same rules as a single save; if any one fails nothing is saved. */
const MASTER_BULK_FIELDS_ = ['type', 'make', 'unit', 'kmStd', 'hrStd', 'tankCap', 'owner', 'ownership', 'supply', 'status', 'activeFrom', 'inactiveFrom', 'monthlyRate', 'tdsRate'];
function editMasterMany_(ids, changes) {
  return withLock_(() => {
    ids = (ids || []).map(str_).filter(Boolean);
    changes = changes || {};
    const keys = Object.keys(changes).filter(k => MASTER_BULK_FIELDS_.indexOf(k) > -1);
    if (!ids.length) throw new Error('Select at least one machinery.');
    if (!keys.length) throw new Error('Pick at least one field to change.');
    addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.WORKS);
    if (keys.indexOf('tankCap') > -1 && !blank_(changes.tankCap)) addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.TCAP);
    if (keys.indexOf('monthlyRate') > -1 && !blank_(changes.monthlyRate)) addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.MRATE);
    if (keys.indexOf('tdsRate') > -1 && !blank_(changes.tdsRate)) addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.TDS);
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
    const errors = [], writes = [];
    ids.forEach(id => {
      try {
        const i = t.rows.findIndex(r => same_(rowId_(r, t), id));
        if (i === -1) throw new Error(clean_(id) + ' was not found in Master.');
        const m = getMaster_().find(x => same_(x.id, id)) || {};
        const cur = { no: m.no, name: m.name, type: m.type, make: m.make, unit: m.unit, worksOn: keys.indexOf('unit') > -1 ? '' : m.worksOn, kmStd: m.kmStd, hrStd: m.hrStd, tankCap: m.tankCap, owner: m.owner,
          ownership: m.ownership, supply: m.supply, status: m.status, activeFrom: m.activeFrom, inactiveFrom: m.inactiveFrom, monthlyRate: m.monthlyRate, tdsRate: m.tdsRate };
        keys.forEach(k => { cur[k] = changes[k]; });
        if (keys.indexOf('status') > -1 && changes.status === 'Active') cur.inactiveFrom = '';
        if (keys.indexOf('ownership') > -1 && keys.indexOf('supply') === -1) cur.supply = '';   // Diesel Supply follows the new Ownership
        const v = validateMaster_(cur);
        writes.push({ i: i, row: buildMasterRow_(t, t.rows[i], v) });
      } catch (e) { errors.push({ id: id, msg: e.message.replace(/^Error:\s*/, '') }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    writes.forEach(w => { t.sh.getRange(w.i + 2, 1, 1, w.row.length).setValues([w.row]); });
    return { ok: true, count: writes.length, master: getMaster_() };
  });
}
/* Delete many machinery at once. Machinery that already have Diesel Issue / Log Book entries are listed first
 * (their entries stay); they are deleted only when force is true. */
function deleteMasterMany_(ids, force) {
  return withLock_(() => {
    ids = (ids || []).map(str_).filter(Boolean);
    if (!ids.length) throw new Error('Select at least one machinery.');
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
    const dt = table_(APP.SHEET_DIESEL, [H.NO]), lt = table_(APP.SHEET_LOG, [H.NO]);
    const found = ids.map(id => { const i = t.rows.findIndex(r => same_(rowId_(r, t), id)); return { id: id, i: i }; });
    const missing = found.filter(x => x.i === -1).map(x => x.id);
    if (missing.length) throw new Error('Not found in Master: ' + missing.join(', ') + ' – reload the list.');
    const used = [];
    found.forEach(x => {
      const real = rowId_(t.rows[x.i], t);
      const nd = dt.rows.filter(r => same_(r[dt.c[H.NO]], real)).length, nl = lt.rows.filter(r => same_(r[lt.c[H.NO]], real)).length;
      if (nd || nl) used.push({ id: real, diesel: nd, log: nl });
    });
    if (used.length && !force) return { ok: false, used: used };
    const idsOut = found.map(x => rowId_(t.rows[x.i], t));
    found.map(x => x.i).sort((a, b) => b - a).forEach(i => t.sh.deleteRow(i + 2)); // bottom first
    return { ok: true, count: idsOut.length, ids: idsOut, master: getMaster_() };
  });
}
function fillEnteredByFromActivity() {
  if (typeof ownerOnly_ === 'function') ownerOnly_();
  ACTOR_ = '';
  const ss = SS_(), log = ss.getSheetByName('Activity Log');
  if (!log || log.getLastRow() < 2) return;
  const lv = log.getRange(1, 1, log.getLastRow(), log.getLastColumn()).getValues(), lh = lv[0].map(String);
  const iA = lh.indexOf('Action'), iR = lh.indexOf('Record ID'), iN = lh.indexOf('User Name'), iE = lh.indexOf('User Email');
  const who = {};
  const expand = rec => { const m = String(rec).match(/^([A-Z]+-)(\d+)\s+to\s+[A-Z]+-(\d+)$/); if (!m) return [String(rec).trim()]; const a = +m[2], b = +m[3], w = m[2].length, out = []; for (let n = a; n <= b && out.length < 5000; n++) out.push(m[1] + String(n).padStart(w, '0')); return out; };
  lv.slice(1).forEach(r => { if (!/^Add/.test(String(r[iA]))) return; const name = String(r[iN] || r[iE] || '').trim(); if (!name) return; expand(r[iR]).forEach(id => { if (id && !(id in who)) who[id] = name; }); });
  let n = 0;
  [[APP.SHEET_DIESEL, DIESEL_COLS_, H.ID], [APP.SHEET_INWARD, INWARD_COLS_, H.IN_ID], [APP.SHEET_TRANSFER, TRANSFER_COLS_, H.TR_ID], [APP.SHEET_MASTER, MASTER_COLS_, null]].forEach(x => {
    addColIfMissing_(x[0], x[1], H.EBY); addColIfMissing_(x[0], x[1], H.UBY); TABLE_MEMO_ = {};
    const t = table_(x[0], x[1]);
    t.rows.forEach((r, i) => {
      if (str_(r[t.c[H.EBY]])) return;
      const id = x[2] ? str_(r[t.c[x[2]]]) : rowId_(r, t);
      if (who[id]) { t.sh.getRange(i + 2, t.c[H.EBY] + 1).setValue(who[id]); n++; }
    });
  });
  addColIfMissing_(APP.SHEET_LOG, logHeaders_(), H.EBY); addColIfMissing_(APP.SHEET_LOG, logHeaders_(), H.UBY);
  sbFlush_();
  Logger.log('"Entered By" filled from the Activity Log for ' + n + ' older entries (Log Book entries made before today stay blank).');
}
/* ================= VENDORS (party master) & BOQ (rate contracts) =================
 * Vendors: the owners of Rental / Hired / Debit machinery – GST, PAN, TDS and bank details, entered once per vendor.
 * BOQ: vendor-wise rate contracts for a period (Valid From – Valid To), one line per machinery:
 *   Monthly / Per Day / Per Hour / Per KM / Per Trip; Per Hour can have slabs (e.g. first 1 hr ₹1,000, after that ₹2,000),
 *   counted on each day's hours or on the whole period's hours.
 * An amendment is a new version of a BOQ from a date inside its period. For any date the rate is taken from the newest
 * version in force on that date (latest "from" date; then the higher amendment number). */
const VENDOR_COLS_ = ['Vendor Name', 'Ownership', 'GST Registered', 'GST Number', 'GST %', 'PAN Number', 'TDS %', 'Bank Name', 'Branch', 'Account Number', 'IFSC Code', 'Address', 'Phone', 'Remark', 'Created At'];
const VENDOR_MORE_ = ['Aadhaar Number', 'Email'];
/* Diesel of a machinery on a day is debited or company – decided MACHINE-WISE (a vendor can have both):
 * the BOQ line of that machinery in force that day (Diesel: Debit basis = ALL diesel debited; Company = only the diesel above the
 * standard average), else its Diesel Supply in Asset Master (Debit Basis = a full-debit machinery, no rent, all diesel debited).
 * (The vendor-level types below are kept only for the code; they are not used.)
 *  'As per BOQ'              – rent as the BOQ; diesel debited or company as each BOQ line says (Diesel: Debit basis / Company paid) – hired per day / hour
 *  'Full Debit'              – no rent; ALL diesel given is debited
 *  'Rental – diesel debit'   – rent as the BOQ; ALL diesel given is debited
 *  'Rental – company diesel' – rent as the BOQ; company diesel – only the diesel above the standard average is debited
 * Debited diesel is always at one rate: the higher of the period's average and the last purchase rate. */
const VTYPES_ = ['As per BOQ', 'Full Debit', 'Rental – diesel debit', 'Rental – company diesel'];
function normVType_(v) { const k = str_(v).toUpperCase().replace(/[^A-Z]/g, ''); return k === 'FULLDEBIT' ? 'Full Debit' : k === 'RENTALDIESELDEBIT' ? 'Rental – diesel debit' : k === 'RENTALCOMPANYDIESEL' ? 'Rental – company diesel' : 'As per BOQ'; }
// is the diesel of this day debited to the vendor?
function dieselDebitDay_(vtype, bday, m) {
  if (vtype === 'Full Debit' || vtype === 'Rental – diesel debit') return true;
  if (vtype === 'Rental – company diesel') return false;
  return bday ? bday.diesel === 'Debit Basis' : (m && m.supply === 'Debit Basis');
}
const BOQ_COLS_ = ['BOQ ID', 'BOQ No', 'Vendor Name', 'Valid From', 'Valid To', 'Amendment Of', 'Amendment No', 'Lines', 'Remark', 'Created At'];
const BOQ_BASIS_ = ['Monthly', 'Per Day', 'Per Hour', 'Per KM', 'Per Trip', 'Item-wise', 'No rent – diesel only'];
const BOQ_ITEMWISE_ = 'Item-wise'; // the line holds several items (e.g. Bucket, Breaker), each with its own rent type and rate
const BOQ_ITEM_BASIS_ = ['Per Hour', 'Per Day', 'Monthly', 'Per KM', 'Per Trip'];
const BOQ_NORENT_ = 'No rent – diesel only'; // no rent; ALL diesel given is debited; no Log Book needed
const VENDOR_OWNERSHIPS_ = ['Own', 'Rental', 'Hired', 'Debit', 'Other']; // every owner in Asset Master is a vendor (Own = Rachana Construction Limited)
function vbSheet_(name, cols) {
  const ss = SS_();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (sh.getLastRow() < 1) { sh.getRange(1, 1, 1, cols.length).setValues([cols]); try { sh.setFrozenRows(1); } catch (e) {} } TABLE_MEMO_ = {}; }
  return sh;
}
function vbTable_(name, cols) {
  if (!SS_().getSheetByName(name)) return null;
  const t = table_(name, cols);
  return t;
}
const vendorTable_ = () => vbTable_(APP.SHEET_VENDORS, VENDOR_COLS_);
const boqTable_ = () => vbTable_(APP.SHEET_BOQ, BOQ_COLS_);
const vKey_ = v => clean_(v).toUpperCase();
function vendorOut_(t, r) {
  const g = h => h in t.c ? r[t.c[h]] : '';
  return { name: clean_(g('Vendor Name')), ownership: str_(g('Ownership')), gstReg: str_(g('GST Registered')) || 'No', gst: str_(g('GST Number')), gstPct: numOrBlank_(g('GST %')),
    pan: str_(g('PAN Number')), tds: numOrBlank_(g('TDS %')), bank: str_(g('Bank Name')), branch: str_(g('Branch')), account: str_(g('Account Number')), ifsc: str_(g('IFSC Code')),
    address: str_(g('Address')), phone: str_(g('Phone')), remark: str_(g('Remark')), aadhaar: str_(g('Aadhaar Number')), email: str_(g('Email')),
    enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '', updatedBy: H.UBY in t.c ? str_(r[t.c[H.UBY]]) : '' };
}
// machinery of each vendor (Owner Name in Master), Rental / Hired / Debit only
function vendorMachines_() {
  const by = {};
  getMaster_().forEach(m => {
    if (VENDOR_OWNERSHIPS_.indexOf(m.ownership) === -1 || !clean_(m.owner)) return;
    const k = vKey_(m.owner);
    (by[k] = by[k] || { name: clean_(m.owner), machines: [] }).machines.push({ id: m.id, type: m.type, unit: m.unit, ownership: m.ownership, status: m.status });
  });
  return by;
}
function getVendors_() {
  const t = vendorTable_(), mach = vendorMachines_(), out = [], seen = {};
  if (t) t.rows.forEach(r => {
    const v = vendorOut_(t, r); if (!v.name) return;
    const k = vKey_(v.name); seen[k] = true;
    const ms = (mach[k] || {}).machines || [];
    out.push(Object.assign(v, { saved: true, machines: ms, ownership: [...new Set(ms.map(m => m.ownership))].join(', ') || v.ownership,
      complete: ms.length && ms.every(m => m.ownership === 'Own') ? true : !!(v.pan && v.bank && v.account && v.ifsc && (v.gstReg !== 'Yes' || v.gst)) }));
  });
  // owners in Master that have no vendor details yet
  Object.keys(mach).forEach(k => { if (seen[k]) return; const x = mach[k];
    out.push({ name: x.name, saved: false, complete: false, machines: x.machines, ownership: [...new Set(x.machines.map(m => m.ownership))].join(', '), gstReg: 'No' }); });
  const b = boqTable_(), nBoq = {};
  if (b) b.rows.forEach(r => { const k = vKey_(r[b.c['Vendor Name']]); nBoq[k] = (nBoq[k] || 0) + 1; });
  out.forEach(v => { v.boqs = nBoq[vKey_(v.name)] || 0; });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
function validateVendor_(v) {
  const name = clean_(v.name); if (!name) throw new Error('Enter the Vendor Name.');
  const up = x => clean_(x).toUpperCase().replace(/\s+/g, '');
  const gstReg = str_(v.gstReg) === 'Yes' ? 'Yes' : 'No';
  const gst = up(v.gst), ifsc = up(v.ifsc);
  let pan = up(v.pan);
  if (gstReg === 'Yes') {
    if (!gst) throw new Error('Enter the GST Number (or set "GST registered" to No).');
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) throw new Error('GST Number "' + gst + '" is not in the right format (15 characters, e.g. 27ABCDE1234F1Z5).');
  } else if (gst) throw new Error('"GST registered" is No – remove the GST Number or set it to Yes.');
  if (!pan && gst) pan = gst.slice(2, 12);                                        // PAN is inside the GST number
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new Error('PAN Number "' + pan + '" is not in the right format (10 characters, e.g. ABCDE1234F).');
  if (gst && pan && gst.slice(2, 12) !== pan) throw new Error('PAN ' + pan + ' does not match the PAN inside the GST Number (' + gst.slice(2, 12) + ').');
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new Error('IFSC Code "' + ifsc + '" is not in the right format (11 characters, e.g. SBIN0001234).');
  const account = clean_(v.account).replace(/\s+/g, '');
  const aadhaar = clean_(v.aadhaar).replace(/[\s-]+/g, '');
  if (aadhaar && !/^[2-9][0-9]{11}$/.test(aadhaar)) throw new Error('Aadhaar Number should be 12 digits.');
  const email = clean_(v.email).toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email "' + email + '" does not look right.');
  const mobile = clean_(v.phone).replace(/[\s-]+/g, '');
  if (mobile && !/^(\+?91)?[6-9][0-9]{9}$/.test(mobile)) throw new Error('Mobile Number should be 10 digits.');
  if (account && !/^[0-9A-Za-z]{6,20}$/.test(account)) throw new Error('Account Number should be 6 to 20 digits / letters.');
  const pct = (x, label, max) => blank_(x) ? '' : (() => { const n = Number(x); if (!isFinite(n) || n < 0 || n > max) throw new Error(label + ' must be between 0 and ' + max + '.'); return r2_(n); })();
  return { name: name, gstReg: gstReg, gst: gst, gstPct: gstReg === 'Yes' ? pct(v.gstPct, 'GST %', 28) : '', pan: pan, tds: pct(v.tds, 'TDS %', 100),
    bank: clean_(v.bank), branch: clean_(v.branch), account: account, ifsc: ifsc, address: clean_(v.address), phone: mobile, remark: clean_(v.remark), aadhaar: aadhaar, email: email };
}
function saveVendor_(v, mode) {
  return withLock_(() => {
    const x = validateVendor_(v || {});
    const mach = vendorMachines_()[vKey_(x.name)];
    vbSheet_(APP.SHEET_VENDORS, VENDOR_COLS_);
    addColIfMissing_(APP.SHEET_VENDORS, VENDOR_COLS_, H.EBY); addColIfMissing_(APP.SHEET_VENDORS, VENDOR_COLS_, H.UBY);
    VENDOR_MORE_.forEach(h => addColIfMissing_(APP.SHEET_VENDORS, VENDOR_COLS_, h)); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_VENDORS, VENDOR_COLS_);
    const i = t.rows.findIndex(r => vKey_(r[t.c['Vendor Name']]) === vKey_(x.name));
    if (mode === 'add' && i > -1) throw new Error(x.name + ' is already saved – use Edit.');
    const row = i > -1 ? stampEdit_(t.rows[i].slice(), t) : newRow_(t);
    const put = (h, val) => set_(row, t, h, val);
    put('Vendor Name', x.name); put('Ownership', mach ? [...new Set(mach.machines.map(m => m.ownership))].join(', ') : ''); put('GST Registered', x.gstReg); put('GST Number', x.gst);
    put('GST %', x.gstPct); put('PAN Number', x.pan); put('TDS %', x.tds); put('Bank Name', x.bank); put('Branch', x.branch); put('Account Number', x.account);
    put('IFSC Code', x.ifsc); put('Address', x.address); put('Phone', x.phone); put('Remark', x.remark); put('Aadhaar Number', x.aadhaar); put('Email', x.email);
    if (i === -1) { put('Created At', new Date()); t.sh.appendRow(row); } else t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    return { ok: true, name: x.name, vendors: getVendors_() };
  });
}
// vendor names that are not yet saved in Vendor Master are saved (name only – details can be filled later)
function ensureVendorRows_(names) {
  vbSheet_(APP.SHEET_VENDORS, VENDOR_COLS_);
  addColIfMissing_(APP.SHEET_VENDORS, VENDOR_COLS_, H.EBY); addColIfMissing_(APP.SHEET_VENDORS, VENDOR_COLS_, H.UBY); TABLE_MEMO_ = {};
  const t = table_(APP.SHEET_VENDORS, VENDOR_COLS_);
  const have = {}; t.rows.forEach(r => { have[vKey_(r[t.c['Vendor Name']])] = clean_(r[t.c['Vendor Name']]); });
  const mach = vendorMachines_(), added = [];
  [...new Set((names || []).map(clean_).filter(Boolean))].forEach(n => {
    if (have[vKey_(n)]) return; have[vKey_(n)] = n;
    const ms = (mach[vKey_(n)] || {}).machines || [];
    const row = newRow_(t);
    set_(row, t, 'Vendor Name', n); set_(row, t, 'Ownership', [...new Set(ms.map(m => m.ownership))].join(', ')); set_(row, t, 'GST Registered', 'No'); set_(row, t, 'Created At', new Date());
    t.sh.appendRow(row); added.push(n);
  });
  if (added.length) TABLE_MEMO_ = {};
  return { added: added, names: have };
}
// save the Owner Names of Asset Master as vendors (name only – details can be filled later)
function vendorsFromOwners_(names) {
  return withLock_(() => {
    const x = ensureVendorRows_(names);
    return { ok: true, count: x.added.length, names: x.added, vendors: getVendors_() };
  });
}
// give many assets their vendor at once – each asset its own vendor (all saved together, or none)
function assignVendors_(items) {
  return withLock_(() => {
    items = (items || []).filter(x => str_(x.id));
    if (!items.length) throw new Error('Pick at least one asset.');
    const blank = items.filter(x => !clean_(x.vendor)).map(x => str_(x.id));
    if (blank.length) return { ok: false, errors: blank.map(id => id + ': pick a vendor.') };
    const saved = {}; const ens = ensureVendorRows_(items.map(x => x.vendor)).names;
    Object.keys(ens).forEach(k => { saved[k] = ens[k]; });
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_), writes = [], errors = [];
    items.forEach(x => {
      const i = t.rows.findIndex(r => same_(rowId_(r, t), x.id));
      if (i === -1) { errors.push(str_(x.id) + ': not found in Asset Master.'); return; }
      const v = saved[vKey_(x.vendor)];
      if (!v) { errors.push(str_(x.id) + ': "' + clean_(x.vendor) + '" is not in Vendor Master.'); return; }
      if (clean_(t.rows[i][t.c[H.OWNER]]) === v) return;
      writes.push({ i: i, v: v, id: rowId_(t.rows[i], t) });
    });
    if (errors.length) return { ok: false, errors: errors };
    writes.forEach(w => { const row = stampEdit_(t.rows[w.i].slice(), t); row[t.c[H.OWNER]] = w.v; t.sh.getRange(w.i + 2, 1, 1, row.length).setValues([row]); });
    TABLE_MEMO_ = {};
    if (writes.length) syncSupplyFromBoq_(writes.map(w => w.id));
    return { ok: true, count: writes.length, master: getMaster_(), vendors: getVendors_() };
  });
}
/* ================= MACHINERY BILLING =================
 * Bills are worked out on the page (same rules as the Log Book print: BOQ rate of each date, excess diesel,
 * GST / TDS of the BOQ) and, when the user submits, saved here as a snapshot: the numbers of that moment.
 * A saved bill is never edited. If the data behind it was wrong, the data is corrected and the bill built and
 * submitted again: the older one stays and is marked "Superseded". Only Admin can delete a saved bill (with a reason). */
const BILL_COLS_ = ['Bill ID', 'Vendor Name', 'Company', 'Bill No', 'Rev', 'Period From', 'Period To', 'Bill Date', 'Net Payable', 'Status', 'Data', 'Remark', 'Created At'];
const BILL_COMPANIES_ = ['Sketchline Industries', 'Rachana Construction Limited'];
const billTable_ = () => vbTable_(APP.SHEET_BILLS, BILL_COLS_);
function billOut_(t, r, withData) {
  const g = h => h in t.c ? r[t.c[h]] : '';
  const o = { id: str_(g('Bill ID')), vendor: clean_(g('Vendor Name')), company: str_(g('Company')), billNo: str_(g('Bill No')), rev: num0_(g('Rev')),
    from: dkey_(g('Period From')), to: dkey_(g('Period To')), billDate: dkey_(g('Bill Date')), net: num0_(g('Net Payable')), status: str_(g('Status')) || 'Active',
    remark: str_(g('Remark')), created: g('Created At') instanceof Date ? g('Created At').toISOString() : str_(g('Created At')),
    enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '' };
  // the diesel Debit Note of the bill (its number is kept inside the saved bill): number and amount, for the lists
  let d = null; try { d = JSON.parse(str_(g('Data')) || '{}'); } catch (e) { d = {}; }
  o.dnNo = str_(d && d.dnNo); o.dnAmt = r2_(num0_(d && d.B));
  if (withData) o.data = d || {};
  return o;
}
// company details printed on the bills (both names), and the project name – kept with the app settings
function billSettings_() {
  const p = PropertiesService.getScriptProperties().getProperty('BILL_SETTINGS');
  let s = {}; try { s = JSON.parse(p || '{}'); } catch (e) { s = {}; }
  s.project = s.project || 'Construction of 8 laning of Existing 4 lane From Km. 539+202 to Km. 563+040 Vadape to Thane Section of NH-3 (New NH 848) in the State of Maharashtra.';
  s.companies = s.companies || {};
  // Sketchline's own details (from its bills) – used until they are changed in "Company details"
  const known = { 'Sketchline Industries': { address: 'FLAT NO - 104 S.N.109/10, DATTATRAY APPARTMENT, LANE NO. 14, PRABHAT ROAD, ERANDWANE, PUNE - 411004. (MAHARASHTRA)', gstin: '27AFGFS3815J1ZQ', pan: 'AFGFS3815J' },
    'Rachana Construction Limited': { address: '', gstin: '27AAKCR9897B1ZQ', pan: 'AAKCR9897B' } };
  // site office – printed on the bills of both names
  s.siteAddress = s.siteAddress || 'SITE OFFICE AT VALSHIND VILLAGE ON MUMBAI NASHIK EXPRESS WAY, BACK SIDE OF PICHAD WAREHOUSE, BHIWANDI, MAHARASHTRA - 432302';
  BILL_COMPANIES_.forEach(c => {
    const cur = Object.assign({ address: '', gstin: '', pan: '' }, s.companies[c] || {}), k = known[c] || {};
    // what the numbers of the Tax Invoice and of the Debit Note start with – each name has its own run of numbers
    const code = /sketchline/i.test(c) ? 'SLI' : 'RCL';
    s.companies[c] = { address: cur.address || k.address || '', gstin: cur.gstin || k.gstin || '', pan: cur.pan || k.pan || '',
      invPrefix: cur.invPrefix === undefined ? code + '/VTR/RA-' : str_(cur.invPrefix), dnPrefix: cur.dnPrefix === undefined ? code + '/VTR/DN-' : str_(cur.dnPrefix) };
  });
  return s;
}
function saveBillSettings_(x) {
  x = x || {};
  const s = billSettings_();
  if (!blank_(x.project)) s.project = clean_(x.project);
  if (x.siteAddress !== undefined) s.siteAddress = clean_(x.siteAddress);
  BILL_COMPANIES_.forEach(c => {
    const y = (x.companies || {})[c]; if (!y) return;
    const gstin = clean_(y.gstin).toUpperCase().replace(/\s/g, ''), pan = clean_(y.pan).toUpperCase().replace(/\s/g, '');
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new Error(c + ': GSTIN "' + gstin + '" is not in the right format.');
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new Error(c + ': PAN "' + pan + '" is not in the right format.');
    const old = s.companies[c] || {};
    s.companies[c] = { address: clean_(y.address), gstin: gstin, pan: pan || (gstin ? gstin.slice(2, 12) : ''),
      invPrefix: y.invPrefix === undefined ? old.invPrefix : clean_(y.invPrefix), dnPrefix: y.dnPrefix === undefined ? old.dnPrefix : clean_(y.dnPrefix) };
  });
  PropertiesService.getScriptProperties().setProperty('BILL_SETTINGS', JSON.stringify(s));
  return s;
}
// what the Billing page needs: vendors that can be billed (not Own / Other), their details, the next bill numbers
function billInit_(f) {
  f = f || {};
  const vendors = getVendors_().map(v => Object.assign({}, v, { machines: (v.machines || []).filter(m => ['Rental', 'Hired', 'Debit'].indexOf(m.ownership) > -1) }))
    .filter(v => v.machines.length);
  const t = billTable_(), next = {};
  if (t) t.rows.forEach(r => {
    const b = billOut_(t, r, false), k = vKey_(b.vendor) + '|' + b.company;
    const n = Number(String(b.billNo).replace(/[^0-9]/g, '')) || 0;
    next[k] = Math.max(next[k] || 0, n);
  });
  // debit notes that can be deducted in a bill: open, not cancelled, not already in a bill
  const pendingDn = dnList_().filter(d => d.status !== 'Cancelled' && !d.billId).map(d => ({ id: d.id, no: d.no, vendor: d.vendor, company: d.company, date: d.date, total: d.total }));
  return { vendors: vendors, lastNo: next, settings: billSettings_(), pendingDn: pendingDn };
}
function getBills_(f) {
  f = f || {};
  const t = billTable_(); if (!t) return { bills: [] };
  const v = vKey_(f.vendor || ''), co = str_(f.company);
  const list = t.rows.map(r => billOut_(t, r, !!f.id)).filter(b => b.id && (!f.id || b.id === f.id) && (!v || vKey_(b.vendor) === v) && (!co || b.company === co) &&
    (!f.from || b.to >= f.from) && (!f.to || b.from <= f.to));
  list.sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0) || a.vendor.localeCompare(b.vendor) || (b.rev - a.rev));
  return { bills: list };
}
/* ================= LOG BOOK FORMAT (per machinery) =================
 * Which print format the Log Book of a machinery uses. The top (company, site, owner, machinery) is the same in every
 * format; the rows and the summary differ. A new format is added to LB_FORMATS_ (and the print) – assigning it is done here. */
const LB_FORMATS_ = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
// the ways a format measures the work: an entry of such a machinery is made in these ways (Format A: the Asset Master ticks)
const LB_FMT_MODES_ = { B: ['KM', 'Hrs', 'KM + Hrs', 'Trip'], C: ['KM'], D: ['Hrs'], E: ['Hrs'], F: ['Time'], G: ['Time'], H: ['Trip'] };
// names given to the formats (Script Properties); a format without a name shows its default name
function getLbFormatNames_() { let n = {}; try { n = JSON.parse(PropertiesService.getScriptProperties().getProperty('LB_FORMAT_NAMES') || '{}'); } catch (e) { n = {}; } return n; }
function saveLbFormatName_(x) {
  x = x || {}; const id = str_(x.id).toUpperCase(), name = clean_(x.name);
  if (LB_FORMATS_.indexOf(id) === -1) throw new Error('Format ' + id + ' is not there.');
  if (name.length > 80) throw new Error('Keep the name under 80 letters.');
  const n = getLbFormatNames_(), from = n[id] || '';
  if (name) n[id] = name; else delete n[id];
  PropertiesService.getScriptProperties().setProperty('LB_FORMAT_NAMES', JSON.stringify(n));
  return { ok: true, id: id, name: name || '(default)', from: from, names: n };
}
// changes: { MACHINERY: 'A' | 'B' … }
function saveLbFormats_(changes) {
  return withLock_(() => {
    changes = changes || {};
    addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.LBFMT); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_), done = [];
    Object.keys(changes).forEach(no => {
      const f = str_(changes[no]).toUpperCase(); if (LB_FORMATS_.indexOf(f) === -1) throw new Error('Format ' + f + ' is not there yet.');
      const i = t.rows.findIndex(r => same_(rowId_(r, t), no)); if (i === -1) throw new Error(clean_(no) + ' was not found in Asset Master.');
      if ((str_(t.rows[i][t.c[H.LBFMT]]) || 'A') === f) return;
      const row = stampEdit_(t.rows[i].slice(), t); row[t.c[H.LBFMT]] = f;
      t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]); done.push(rowId_(row, t) + ' → ' + f);
    });
    if (done.length) bump_(['master']);
    return { ok: true, count: done.length, list: done.slice(0, 80).join('; '), master: getMaster_() };
  });
}

/* ================= BREAKDOWN =================
 * A machinery under breakdown: since when, why, and when it is back in work. It is only a record – a machinery under
 * breakdown can still take diesel and have Log Book entries (a puncture does not stop it from being fuelled).
 * The day's breakdown report is submitted once a day by a user with Edit access; everyone with access sees it. */
const BD_COLS_ = ['Breakdown ID', 'Machinery No', 'From Date', 'Reason', 'Remark', 'Status', 'Back On', 'Closing Remark', 'Created At'];
const BDR_COLS_ = ['Report ID', 'Report Date', 'Machinery Count', 'Details', 'Submitted At'];
function bdOut_(t, r) {
  const g = h => h in t.c ? r[t.c[h]] : '';
  return { id: str_(g('Breakdown ID')), no: str_(g('Machinery No')), from: dkey_(g('From Date')), reason: str_(g('Reason')), remark: str_(g('Remark')),
    status: str_(g('Status')) || 'Open', backOn: dkey_(g('Back On')), closeRemark: str_(g('Closing Remark')),
    by: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '', updatedBy: H.UBY in t.c ? str_(r[t.c[H.UBY]]) : '' };
}
function bdTable_() { vbSheet_(APP.SHEET_BREAKDOWN, BD_COLS_); addColIfMissing_(APP.SHEET_BREAKDOWN, BD_COLS_, H.EBY); addColIfMissing_(APP.SHEET_BREAKDOWN, BD_COLS_, H.UBY); TABLE_MEMO_ = {}; return table_(APP.SHEET_BREAKDOWN, BD_COLS_); }
// days under breakdown: from the From date up to the day before it is back (or up to the date asked for, counting that day)
const bdDays_ = (x, upto) => { const end = x.backOn ? addDays_(x.backOn, -1) : upto; const e2 = end < upto ? end : upto; return e2 < x.from ? 0 : daysBetween_(x.from, e2) + 1; };
/* The daily machinery status: for a date, every machinery on site is Working or Breakdown (with the reason).
 * One report per date (Own and Rental can be submitted separately – each submit merges its machinery into that date).
 * "Breakdown since" = the first day of the unbroken run of Breakdown days up to that date (days with no report are skipped). */
function bdReports_() {
  const rt = SS_().getSheetByName(APP.SHEET_BDREPORT) ? table_(APP.SHEET_BDREPORT, BDR_COLS_) : null;
  if (!rt) return [];
  return rt.rows.map((r, i) => {
    let rows = []; try { rows = JSON.parse(str_(r[rt.c['Details']]) || '[]'); } catch (e) { rows = []; }
    return { i: i, date: str_(r[rt.c['Report ID']]) || dkey_(r[rt.c['Report Date']]), rows: Array.isArray(rows) ? rows : [],
      at: r[rt.c['Submitted At']] instanceof Date ? Utilities.formatDate(r[rt.c['Submitted At']], tz_(), 'dd-MM-yyyy HH:mm') : str_(r[rt.c['Submitted At']]), by: H.EBY in rt.c ? str_(r[rt.c[H.EBY]]) : '' };
  }).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date)).sort((a, b) => a.date < b.date ? -1 : 1);
}
// status of each machinery through the reports: { KEY: [{ date, status, reason, remark }] } (dates ascending)
function bdTimeline_(reps) { const tl = {}; reps.forEach(rp => rp.rows.forEach(x => { (tl[noKey_(x.no)] = tl[noKey_(x.no)] || []).push({ date: rp.date, no: x.no, status: x.status, reason: x.reason || '', remark: x.remark || '' }); })); return tl; }
function bdSince_(list, date) { let since = ''; for (let k = list.length - 1; k >= 0; k--) { const y = list[k]; if (y.date > date) continue; if (y.status !== 'Breakdown') break; since = y.date; } return since; }
function getBreakdowns_(f) {
  f = f || {};
  const today = today_(), date = str_(f.date) ? checkDate_(f.date) : today;
  const reps = bdReports_(), tl = bdTimeline_(reps);
  const master = {}; getMaster_().forEach(m => { master[noKey_(m.id)] = m; });
  const info = no => { const m = master[noKey_(no)] || {}; return { type: m.type || '', name: m.name || '', owner: m.owner || '', ownership: m.ownership || '' }; };
  const rep = reps.find(x => x.date === date) || null;
  // the list to start from: this date's report, else the last report before it (breakdowns carry on until marked Working)
  const before = reps.filter(x => x.date < date).pop() || null;
  const status = {};
  (before ? before.rows : []).forEach(x => { if (x.status === 'Breakdown') status[noKey_(x.no)] = { status: 'Breakdown', reason: x.reason || '', remark: x.remark || '', carried: true }; });
  (rep ? rep.rows : []).forEach(x => { status[noKey_(x.no)] = { status: x.status, reason: x.reason || '', remark: x.remark || '' }; });
  const onDate = [];
  Object.keys(tl).forEach(k => {
    const s0 = status[k]; if (!s0 || s0.status !== 'Breakdown') return;
    const list = tl[k], since = rep && rep.rows.some(x => noKey_(x.no) === k) ? bdSince_(list, date) : bdSince_(list, before ? before.date : date);
    const no = list[list.length - 1].no;
    onDate.push(Object.assign({ no: no, from: since || date, days: daysBetween_(since || date, date) + 1, reason: s0.reason, remark: s0.remark, id: no }, info(no)));
  });
  // periods: a run of Breakdown days; it ends on the first Working day after it
  const history = [];
  Object.keys(tl).forEach(k => {
    let cur = null;
    tl[k].forEach(y => {
      if (y.status === 'Breakdown') { if (!cur) cur = { no: y.no, from: y.date, reason: y.reason, remark: y.remark }; else if (y.reason) cur.reason = y.reason; }
      else if (cur) { cur.backOn = y.date; history.push(cur); cur = null; }
    });
    if (cur) { cur.backOn = ''; history.push(cur); }
  });
  history.forEach(x => { Object.assign(x, info(x.no), { id: x.no + '|' + x.from, days: daysBetween_(x.from, x.backOn ? addDays_(x.backOn, -1) : today) + 1 }); });
  history.sort((a, b) => (b.from > a.from ? 1 : b.from < a.from ? -1 : a.no.localeCompare(b.no)));
  return { today: today, date: date, report: rep ? { date: rep.date, at: rep.at, by: rep.by, rows: rep.rows, count: rep.rows.filter(x => x.status === 'Breakdown').length } : null,
    carried: before ? before.date : '', status: status, onDate: onDate.sort((a, b) => a.from < b.from ? -1 : 1), history: history,
    reports: reps.slice().reverse().map(x => ({ date: x.date, at: x.at, by: x.by, total: x.rows.length, count: x.rows.filter(y => y.status === 'Breakdown').length })) };
}
// x: { date, rows: [{ no, status: 'Working' | 'Breakdown', reason, remark }] } – merged into that date's report (Own and Rental can be sent separately)
function submitBdReport_(x) {
  return withLock_(() => {
    x = x || {};
    const date = entryDate_(x.date || today_());
    const rows = (x.rows || []).map((y, n) => {
      const m = findMachine_(y.no), st = str_(y.status) === 'Breakdown' ? 'Breakdown' : str_(y.status) === 'Working' ? 'Working' : '';
      if (!st) throw new Error(m.id + ': pick Working or Breakdown.');
      if (st === 'Breakdown' && !clean_(y.reason)) throw new Error(m.id + ': write the reason of the breakdown.');
      return { no: m.id, status: st, reason: st === 'Breakdown' ? clean_(y.reason) : '', remark: clean_(y.remark) };
    });
    if (!rows.length) throw new Error('No machinery in the list.');
    vbSheet_(APP.SHEET_BDREPORT, BDR_COLS_); addColIfMissing_(APP.SHEET_BDREPORT, BDR_COLS_, H.EBY); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_BDREPORT, BDR_COLS_);
    const i = t.rows.findIndex(r => str_(r[t.c['Report ID']]) === date || dkey_(r[t.c['Report Date']]) === date);
    let old = []; if (i > -1) { try { old = JSON.parse(str_(t.rows[i][t.c['Details']]) || '[]'); } catch (e) { old = []; } }
    const keep = old.filter(y => !rows.some(z => noKey_(z.no) === noKey_(y.no)));
    const all = keep.concat(rows);
    const row = i > -1 ? t.rows[i].slice() : newRow_(t);
    set_(row, t, 'Report ID', date); set_(row, t, 'Report Date', toDate_(date)); set_(row, t, 'Machinery Count', all.filter(y => y.status === 'Breakdown').length);
    set_(row, t, 'Details', JSON.stringify(all)); set_(row, t, 'Submitted At', new Date());
    if (H.EBY in t.c) row[t.c[H.EBY]] = ACTOR_;
    if (i > -1) t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]); else t.sh.appendRow(row);
    const bd = rows.filter(y => y.status === 'Breakdown');
    return { ok: true, date: date, replaced: i > -1, total: rows.length, count: bd.length, list: bd.map(y => y.no + ' – ' + y.reason).join('; ') };
  });
}
function deleteBdReport_(dateStr) {
  return withLock_(() => {
    const date = checkDate_(dateStr);
    const t = SS_().getSheetByName(APP.SHEET_BDREPORT) ? table_(APP.SHEET_BDREPORT, BDR_COLS_) : null;
    const i = t ? t.rows.findIndex(r => str_(r[t.c['Report ID']]) === date || dkey_(r[t.c['Report Date']]) === date) : -1;
    if (i === -1) throw new Error('There is no report of ' + dmy_(date) + '.');
    t.sh.deleteRow(i + 2);
    return { ok: true, date: date, deleted: true };
  });
}

/* ================= VEHICLE COMPLIANCE =================
 * Tax, PUC, Permit, Fitness and Insurance of every active Own / Rental / Hired machinery: expired, due within 30 days,
 * missing (not entered) or not applicable. A renewal writes the new "valid upto" into Asset Master and keeps a history row;
 * a date changed in Asset Master itself is also kept in the history. */
const CMP_COLS_ = ['History ID', 'Machinery No', 'Document', 'Old Valid Upto', 'New Valid Upto', 'Renewed On', 'Document No', 'Amount', 'Remark', 'Source', 'Created At'];
const CMP_SOON_ = 30;
const cmpDocs_ = () => ASSET_DOCS_.map(x => ({ key: x[0], col: H[x[1]], name: x[2] }));
function cmpState_(v, today) {
  if (v === 'NA') return { s: 'na', days: '' };
  if (v === 'LIFETIME') return { s: 'life', days: '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return { s: 'missing', days: '' };
  const n = daysBetween_(today, v);
  return { s: v < today ? 'expired' : n <= CMP_SOON_ ? 'due' : 'ok', days: v < today ? -daysBetween_(v, today) : n };
}
function cmpHistAdd_(rows) {
  if (!rows.length) return;
  vbSheet_(APP.SHEET_COMPLIANCE, CMP_COLS_);
  addColIfMissing_(APP.SHEET_COMPLIANCE, CMP_COLS_, H.EBY); TABLE_MEMO_ = {};
  const t = table_(APP.SHEET_COMPLIANCE, CMP_COLS_);
  let n = t.rows.reduce((mx, r) => Math.max(mx, Number(str_(r[t.c['History ID']]).replace(/\D/g, '')) || 0), 0);
  rows.forEach(x => {
    const row = newRow_(t);
    set_(row, t, 'History ID', 'CMP-' + String(++n).padStart(6, '0')); set_(row, t, 'Machinery No', x.no); set_(row, t, 'Document', x.doc);
    set_(row, t, 'Old Valid Upto', x.from || ''); set_(row, t, 'New Valid Upto', x.to || ''); set_(row, t, 'Renewed On', x.on ? toDate_(x.on) : '');
    set_(row, t, 'Document No', clean_(x.docNo)); set_(row, t, 'Amount', numOrBlank_(x.amount)); set_(row, t, 'Remark', clean_(x.remark)); set_(row, t, 'Source', x.source || 'Renewal');
    set_(row, t, 'Created At', new Date());
    t.sh.appendRow(row);
  });
}
/* Import papers from Excel (the Export format). rows: [{ line, no, docs: { Tax: 'yyyy-mm-dd' | 'NA' | '' | 'NOT NEEDED' | text } }]
 * A blank cell changes nothing. apply = false only checks; nothing is saved if any row has a problem.
 * Every changed date goes into Asset Master and the history (source "Excel import"). */
// a real calendar date yyyy-mm-dd (31-13-2026 or 31-02-2027 are refused, not rolled over)
function realDate_(v) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); if (!m) return false; const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]); }
function importCompliance_(rows, apply) {
  return withLock_(() => {
    const docs = cmpDocs_(), master = getMaster_(), byKey = {}; master.forEach(m => { byKey[noKey_(m.id)] = m; });
    const errors = [], changes = [], seen = {};
    (rows || []).forEach(r => {
      const vals = docs.map(d => str_((r.docs || {})[d.name])).filter(v => v && !/^NOT NEEDED$/i.test(v));
      if (!clean_(r.no) && !vals.length) return;
      const m = byKey[noKey_(r.no)];
      if (!m) { errors.push({ row: r.line, msg: '"' + clean_(r.no) + '" is not in Asset Master.' }); return; }
      if (seen[noKey_(m.id)]) { errors.push({ row: r.line, msg: m.id + ' is also on row ' + seen[noKey_(m.id)] + ' of the file.' }); return; }
      seen[noKey_(m.id)] = r.line;
      docs.forEach(d => {
        let v = str_((r.docs || {})[d.name]); if (!v || /^NOT NEEDED$/i.test(v) || /^[-–—]$/.test(v)) return;
        if (/^(na|n\/a|not applicable)$/i.test(v)) v = 'NA';
        else if (LIFETIME_RE_.test(v) || v === 'LIFETIME') { if (d.name !== 'Tax') { errors.push({ row: r.line, msg: m.id + ' – ' + d.name + ': "Lifetime" is only for Tax.' }); return; } v = 'LIFETIME'; }
        else if (!realDate_(v)) { errors.push({ row: r.line, msg: m.id + ' – ' + d.name + ': "' + (str_((r.raw || {})[d.name]) || v) + '" is not a date (use dd-mm-yyyy, or N/A).' }); return; }
        const old = m[d.key] || '';
        if (old === v) return;
        changes.push({ i: m.id, doc: d, from: old, to: v });
      });
    });
    const machines = [...new Set(changes.map(c => c.i))].length;
    if (errors.length || !apply) return { ok: !errors.length, errors: errors, changes: changes.length, machines: machines, preview: changes.slice(0, 30).map(c => c.i + ' – ' + c.doc.name + ': ' + docShow_(c.from) + ' → ' + docShow_(c.to)) };
    if (!changes.length) return { ok: true, applied: true, changes: 0, machines: 0, errors: [] };
    docs.forEach(d => addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, d.col)); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_), idx = {}; t.rows.forEach((r, i) => { idx[noKey_(rowId_(r, t))] = i; });
    const touched = {};
    changes.forEach(c => { const i = idx[noKey_(c.i)]; if (i === undefined) return; const row = touched[i] || (touched[i] = t.rows[i].slice()); set_(row, t, c.doc.col, c.to === 'NA' || c.to === 'LIFETIME' ? c.to : toDate_(c.to)); });
    Object.keys(touched).forEach(i => { stampEdit_(touched[i], t); t.sh.getRange(Number(i) + 2, 1, 1, touched[i].length).setValues([touched[i]]); });
    cmpHistAdd_(changes.map(c => ({ no: c.i, doc: c.doc.name, from: c.from, to: c.to, on: today_(), source: 'Excel import' })));
    bump_(['master']);
    return { ok: true, applied: true, changes: changes.length, machines: machines, errors: [], list: changes.slice(0, 60).map(c => c.i + ' ' + c.doc.name + ' → ' + docShow_(c.to)).join('; ') };
  });
}
/* Which papers each machinery TYPE needs. Road vehicles need all five; registered construction vehicles (JCB, Hydra, crane,
 * tractor) need Tax, PUC, Fitness, Insurance; site-only equipment (excavator, grader, roller …) only Insurance; DG, pumps,
 * compressors, plants need none. A type not recognised needs all five until it is set (safe side). Admin can change any type. */
const CMP_ALL_ = ['Tax', 'PUC', 'Permit', 'Fitness', 'Insurance'];
function cmpGuess_(type) {
  const t = String(type || '').toUpperCase();
  if (/\b(DG|GENSET|GENERATOR|PUMP|DEWATER|COMPRESSOR|WELD|BATCH|CRUSHER|PLANT|LIGHT|TOWER|MIXER MACHINE|VIBRATOR|CUTTER|DRILL|HOIST|CONCRETE MIXER|WMM|HOT MIX)\b/.test(t) || /KVA|KW\b/.test(t)) return { docs: [], guess: 'Equipment – no papers' };
  if (/(TIPPER|DUMPER|TRUCK|TANKER|BOLERO|CAR|JEEP|PICK ?UP|BUS|TRAILER|TRANSIT|TEMPO|SCORPIO|INNOVA|ERTIGA|VAN|HIGHWA|AMBULANCE|CAMPER)/.test(t)) return { docs: CMP_ALL_.slice(), guess: 'Road vehicle – all papers' };
  if (/(JCB|BACKHOE|HYDRA|CRANE|TRACTOR|FARANA)/.test(t)) return { docs: ['Tax', 'PUC', 'Fitness', 'Insurance'], guess: 'Registered site vehicle – no permit' };
  if (/(EXCAVATOR|POCLAIN|POCLAINE|GRADER|ROLLER|LOADER|DOZER|PAVER|COMPACTOR|SOIL|MILLING|SHOVEL|BREAKER|SKID)/.test(t)) return { docs: ['Insurance'], guess: 'Site equipment – insurance only' };
  return { docs: CMP_ALL_.slice(), guess: 'Not recognised – all papers until set' };
}
function cmpRules_() { let r = {}; try { r = JSON.parse(PropertiesService.getScriptProperties().getProperty('CMP_RULES') || '{}'); } catch (e) { r = {}; } return r; }
function cmpNeeds_(type, rules) { const k = String(type || '').trim().toUpperCase(); return rules[k] ? rules[k] : cmpGuess_(type).docs; }
// rules: { TYPE: [papers] } – only the types sent are changed
function saveCmpRules_(rules) {
  const cur = cmpRules_(), changes = [];
  Object.keys(rules || {}).forEach(k => {
    const t = String(k).trim().toUpperCase(); if (!t) return;
    const docs = CMP_ALL_.filter(d => (rules[k] || []).indexOf(d) > -1);
    const was = cur[t] || cmpGuess_(t).docs;
    if (was.join(',') !== docs.join(',')) changes.push(t + ': ' + (was.join(', ') || 'none') + ' → ' + (docs.join(', ') || 'none'));
    cur[t] = docs;
  });
  PropertiesService.getScriptProperties().setProperty('CMP_RULES', JSON.stringify(cur));
  bump_(['master']);
  return { ok: true, changes: changes.join('; ') };
}
function getCompliance_() {
  const today = today_(), docs = cmpDocs_(), rules = cmpRules_();
  const active = getMaster_().filter(m => m.status !== 'Inactive' && ['Own', 'Rental', 'Hired'].indexOf(m.ownership) > -1);
  // papers needed by each type (the list for "Papers per type")
  const typeMap = {};
  active.forEach(m => { const k = String(m.type || '').trim().toUpperCase() || '(NO TYPE)'; const x = typeMap[k] = typeMap[k] || { type: m.type || '(no type)', key: k, count: 0 }; x.count++; });
  const types = Object.values(typeMap).map(x => Object.assign(x, { docs: cmpNeeds_(x.key, rules), set: !!rules[x.key], guess: cmpGuess_(x.key).guess })).sort((a, b) => a.type.localeCompare(b.type));
  const machines = active.map(m => {
    const need = cmpNeeds_(m.type, rules), d = {};
    docs.forEach(x => { const v = m[x.key] || ''; d[x.name] = need.indexOf(x.name) === -1 ? { v: v, s: 'notreq', days: '' } : Object.assign({ v: v }, cmpState_(v, today)); });
    return { no: m.id, type: m.type || '', owner: m.owner || '', ownership: m.ownership, docs: d, needs: need.length };
  }).filter(m => m.needs).sort((a, b) => natCmp_(a.no, b.no));
  const noPapers = active.length - machines.length;
  const t = table_(APP.SHEET_COMPLIANCE, CMP_COLS_), c = t.c;
  const hist = t.rows.filter(r => str_(r[c['History ID']])).map(r => ({ id: str_(r[c['History ID']]), no: str_(r[c['Machinery No']]), doc: str_(r[c['Document']]),
    from: docVal_(r[c['Old Valid Upto']]), to: docVal_(r[c['New Valid Upto']]), on: dkey_(r[c['Renewed On']]), docNo: str_(r[c['Document No']]), amount: numOrBlank_(r[c['Amount']]),
    remark: str_(r[c['Remark']]), source: str_(r[c['Source']]), by: H.EBY in c ? str_(r[c[H.EBY]]) : '', at: r[c['Created At']] instanceof Date ? dkey_(r[c['Created At']]) : dkey_(r[c['Created At']]) }))
    .sort((a, b) => (b.id > a.id ? 1 : -1));
  return { today: today, soonDays: CMP_SOON_, docs: docs.map(x => x.name), machines: machines, history: hist, types: types, noPapers: noPapers };
}
// x: { no, doc: 'Tax' | 'PUC' | 'Permit' | 'Fitness' | 'Insurance', to: 'yyyy-mm-dd' | 'NA', on, docNo, amount, remark }
function renewDoc_(x) {
  return withLock_(() => {
    x = x || {};
    const d = cmpDocs_().find(y => y.name === str_(x.doc)); if (!d) throw new Error('Pick the document.');
    const m = findMachine_(x.no);
    const to = str_(x.to) === 'NA' ? 'NA' : str_(x.to) === 'LIFETIME' ? 'LIFETIME' : checkDate_(x.to);
    if (to === 'LIFETIME' && d.name !== 'Tax') throw new Error('"Lifetime" is only for Tax.');
    const on = str_(x.on) ? entryDate_(x.on) : today_();
    const from = m[d.key] || '';
    if (/^\d{4}-/.test(to) && /^\d{4}-/.test(from) && to <= from) throw new Error('The new "valid upto" (' + dmy_(to) + ') must be after the old one (' + dmy_(from) + ').');
    if (num0_(x.amount) < 0) throw new Error('Amount cannot be below 0.');
    addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, d.col); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
    const i = t.rows.findIndex(r => same_(rowId_(r, t), m.id)); if (i === -1) throw new Error(m.id + ' was not found in Asset Master.');
    const row = t.rows[i].slice();
    set_(row, t, d.col, to === 'NA' || to === 'LIFETIME' ? to : toDate_(to)); stampEdit_(row, t);
    t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    cmpHistAdd_([{ no: m.id, doc: d.name, from: from, to: to, on: on, docNo: x.docNo, amount: x.amount, remark: x.remark, source: 'Renewal' }]);
    bump_(['master']);
    return { ok: true, no: m.id, doc: d.name, from: from, to: to };
  });
}

/* ================= LOG BOOK DASHBOARD =================
 * Everything from the Log Book, Diesel Issue, Asset Master and BOQ for a period: utilisation, working hours / KM / trips,
 * diesel against the standard, idle machinery (and the rent paid while idle), reading mistakes, Log Book not filled,
 * type / ownership / chainage / driver / work summaries, a day-by-day calendar per machinery, and the same KPIs for the
 * period before (to compare). Debit Basis machinery do not fill the Log Book and are left out.
 * f: { from, to, ownerships: [..], vendor, type } */
function logDashboard_(f) {
  f = f || {};
  const today = today_();
  let to = str_(f.to) ? checkDate_(f.to) : today, from = str_(f.from) ? checkDate_(f.from) : to.slice(0, 8) + '01';
  if (from > to) throw new Error('From date is after To date.');
  if (daysBetween_(from, to) > 366) throw new Error('Pick up to one year.');
  const n = daysBetween_(from, to) + 1, pTo = addDays_(from, -1), pFrom = addDays_(pTo, -(n - 1));
  const owns = (f.ownerships || []).map(String), vendor = vKey_(f.vendor || ''), type = clean_(f.type).toUpperCase();
  const own5 = o => APP.OWNERSHIP.indexOf(o) > -1 ? o : 'Other';
  const machines = getMaster_().filter(m => (f.withDebit || m.supply !== 'Debit Basis') && (!owns.length || owns.indexOf(own5(m.ownership)) > -1) &&
    (!vendor || vKey_(m.owner) === vendor) && (!type || String(m.type || '').toUpperCase() === type));
  const want = {}; machines.forEach(m => { want[noKey_(m.id)] = m; });
  // diesel rate for ₹ values: the higher of the period average and the last bought rate (same as the bills)
  let dRate = 0; try { const x = logPrintExtra_({ from: from, to: to, nos: [] }); dRate = Math.max(Number(x.avgRate) || 0, Number(x.lastRate) || 0); } catch (e) { dRate = 0; }
  const boqs = allBoqs_();
  const rateOn = (m, dk) => {
    const hits = [];
    boqs.filter(b => vKey_(b.vendor) === vKey_(m.owner) && b.from <= dk && (!b.to || b.to >= dk)).forEach(b => { const l = b.lines.find(x => same_(x.no, m.id)); if (l) hits.push({ b: b, l: l }); });
    if (!hits.length) return null;
    hits.sort((x, y) => (x.b.from < y.b.from ? 1 : x.b.from > y.b.from ? -1 : 0) || (y.b.amendNo - x.b.amendNo));
    return hits[0].l;
  };
  const lt = table_(APP.SHEET_LOG, logHeaders_()), lc = lt.c, g = h => h in lc;
  const T = stockTables_(), issues = issueList_(T);
  const rentNos = machines.filter(m => m.ownership === 'Rental' || m.ownership === 'Hired').map(m => m.id), extraMemo = {};
  const extraOf = (a, b) => extraMemo[a + b] || (extraMemo[a + b] = (() => { try { return logPrintExtra_({ from: a, to: b, nos: rentNos }); } catch (e) { return {}; } })());
  const core = (a, b, full) => {
    const days = []; for (let d = a; d <= b; d = addDays_(d, 1)) days.push(d);
    const M = {};
    machines.forEach(m => {
      const k = noKey_(m.id), af = m.activeFrom ? dkey_(m.activeFrom) : '', inf = m.status === 'Inactive' && m.inactiveFrom ? dkey_(m.inactiveFrom) : '';
      const avail = days.filter(d => (!af || d >= af) && (!inf || d < inf) && d <= today);
      M[k] = { no: m.id, type: m.type || '', owner: m.owner || '', ownership: own5(m.ownership), unit: m.unit, kmStd: num0_(m.kmStd), hrStd: num0_(m.hrStd),
        avail: avail.length, availSet: avail.reduce((o, d) => { o[d] = true; return o; }, {}), day: {}, night: {}, hrs: 0, km: 0, trips: 0, entries: 0, nightHrs: 0,
        issued: 0, dieselDays: {}, drivers: {}, chain: {}, work: {}, anomalies: [], lastLog: '', rows: [] };
    });
    const rows = [];
    lt.rows.forEach(r => { const k = noKey_(r[lc[H.NO]]), dk = dkey_(r[lc[H.DATE]]); if (M[k] && dk && dk >= a && dk <= b && ['Holiday', 'Idle', 'Breakdown'].indexOf(str_(r[lc[H.UNIT]])) === -1) rows.push({ r: r, k: k, dk: dk }); });
    rows.sort((x, y) => (x.dk < y.dk ? -1 : x.dk > y.dk ? 1 : 0) || ((str_(x.r[lc[H.SHIFT]]) === 'Night') - (str_(y.r[lc[H.SHIFT]]) === 'Night')));
    const daily = {}; days.forEach(d => { daily[d] = { date: d, hrsDay: 0, hrsNight: 0, km: 0, trips: 0, machines: {} }; });
    const lastClose = {};
    rows.forEach(x => {
      const r = x.r, m = M[x.k], night = str_(r[lc[H.SHIFT]]) === 'Night';
      const wkm = num0_(r[lc[H.WKM]]), whr = num0_(r[lc[H.WHR]]), trip = g(H.TRIP) ? num0_(r[lc[H.TRIP]]) : 0;
      m.entries++; (night ? m.night : m.day)[x.dk] = true; m.lastLog = x.dk;
      m.rows.push(logItemsOut_({ no: m.no, date: x.dk, shift: night ? 'Night' : 'Day', whr: whr, wkm: wkm, trip: trip, mode: str_(r[lc[H.UNIT]]), itemWork: H.ITEMS in lc ? itemWorkParse_(r[lc[H.ITEMS]]) : {} }));
      m.hrs += Math.max(0, whr); m.km += Math.max(0, wkm); m.trips += trip; if (night) m.nightHrs += Math.max(0, whr);
      const dd = daily[x.dk]; if (night) dd.hrsNight += Math.max(0, whr); else dd.hrsDay += Math.max(0, whr); dd.km += Math.max(0, wkm); dd.trips += trip; dd.machines[x.k] = true;
      if (!full) return;
      const drv = g(H.DRIVER) ? clean_(r[lc[H.DRIVER]]) : '';
      if (drv) { const dv = m.drivers[drv] = m.drivers[drv] || { hrs: 0, km: 0, trips: 0, days: {} }; dv.hrs += Math.max(0, whr); dv.km += Math.max(0, wkm); dv.trips += trip; dv.days[x.dk] = true; }
      const ch = [g(H.CHFROM) ? clean_(r[lc[H.CHFROM]]) : '', g(H.CHTO) ? clean_(r[lc[H.CHTO]]) : ''].filter(Boolean).join(' – ') || (g(H.CH) ? clean_(r[lc[H.CH]]) : '');
      if (ch) { const c = m.chain[ch] = m.chain[ch] || { hrs: 0, km: 0, trips: 0, entries: 0 }; c.hrs += Math.max(0, whr); c.km += Math.max(0, wkm); c.trips += trip; c.entries++; }
      const wk = g(H.WORK) ? clean_(r[lc[H.WORK]]) : ''; if (wk) { const w = wk.toUpperCase().slice(0, 60); m.work[w] = (m.work[w] || 0) + 1; }
      // reading mistakes: closing below opening, too much in one entry, opening not the last closing
      const okm = numOrBlank_(r[lc[H.OKM]]), ckm = numOrBlank_(r[lc[H.CKM]]), ohr = numOrBlank_(r[lc[H.OHR]]), chr = numOrBlank_(r[lc[H.CHR]]);
      if (ckm !== '' && okm !== '' && ckm < okm) m.anomalies.push({ date: x.dk, text: 'Closing KM ' + ckm + ' is below opening ' + okm });
      if (chr !== '' && ohr !== '' && chr < ohr) m.anomalies.push({ date: x.dk, text: 'Closing Hrs ' + chr + ' is below opening ' + ohr });
      if (whr > 24) m.anomalies.push({ date: x.dk, text: r2_(whr) + ' working hours in one entry' });
      if (wkm > 800) m.anomalies.push({ date: x.dk, text: r2_(wkm) + ' KM in one entry' });
      const lc0 = lastClose[x.k] || {};
      if (okm !== '' && lc0.km !== undefined && lc0.km !== '' && Math.abs(okm - lc0.km) > 1) m.anomalies.push({ date: x.dk, text: 'Opening KM ' + okm + ' ≠ last closing ' + lc0.km });
      if (ohr !== '' && lc0.hr !== undefined && lc0.hr !== '' && Math.abs(ohr - lc0.hr) > 0.5) m.anomalies.push({ date: x.dk, text: 'Opening Hrs ' + ohr + ' ≠ last closing ' + lc0.hr });
      lastClose[x.k] = { km: ckm !== '' ? ckm : lc0.km, hr: chr !== '' ? chr : lc0.hr };
    });
    issues.forEach(x => { const m = M[x.key]; if (!m || x.date < a || x.date > b) return; m.issued += x.qty; m.dieselDays[x.date] = true; });
    let tot = { machines: machines.length, worked: 0, avail: 0, workDays: 0, hrs: 0, km: 0, trips: 0, nightHrs: 0, issued: 0, std: 0, extra: 0, dDays: 0, dDaysLogged: 0, idle3: 0, rent: 0, idleRent: 0 };
    const list = Object.keys(M).map(k => {
      const m = M[k], worked = {}; Object.keys(m.day).concat(Object.keys(m.night)).forEach(d => { worked[d] = true; });
      const wd = Object.keys(worked).length;
      const std = r2_((hasKm_(m.unit) && m.kmStd ? m.km / m.kmStd : 0) + (hasHr_(m.unit) && m.hrStd ? m.hrs * m.hrStd : 0));
      // diesel is judged only where diesel was issued in the period (work with no diesel here says nothing about the average)
      const extra = std > 0 && m.issued > 0 ? r2_(m.issued - std) : 0;
      const dd = Object.keys(m.dieselDays), ddLogged = dd.filter(d => worked[d]).length, pending = dd.filter(d => !worked[d]).sort();
      const end = b < today ? b : today;
      const lastAny = m.lastLog || '';
      const idleFor = m.avail ? (lastAny ? daysBetween_(lastAny, end) : Math.min(m.avail, daysBetween_(a, end) + 1)) : 0;
      // rent of the period = what the bill works out to (BOQ day by day, same rules as Machinery Billing)
      let rent = 0, idleRent = 0, basis = '', recover = 0;
      if ((m.ownership === 'Rental' || m.ownership === 'Hired') && m.rows.length) {
        const mm = machines.find(z => noKey_(z.id) === k);
        try { const bc = billMachineCalc_(mm, m.rows, extraOf(a, b), a, b); rent = bc.amount; recover = bc.excessAmt; } catch (e) { rent = 0; recover = 0; }
        const l = rateOn(mm, m.lastLog || end); basis = l ? l.basis : '';
      }
      tot.worked += wd ? 1 : 0; tot.avail += m.avail; tot.workDays += wd; tot.hrs += m.hrs; tot.km += m.km; tot.trips += m.trips; tot.nightHrs += m.nightHrs;
      tot.issued += m.issued; tot.std += m.issued > 0 ? std : 0; tot.extra += Math.max(0, extra); tot.dDays += dd.length; tot.dDaysLogged += ddLogged; tot.rent += rent; tot.idleRent += idleRent;
      if (m.avail && idleFor >= 3) tot.idle3++;
      const o = { no: m.no, type: m.type, owner: m.owner, ownership: m.ownership, unit: m.unit, avail: m.avail, workDays: wd, nights: Object.keys(m.night).length,
        util: m.avail ? r2_(wd / m.avail * 100) : 0, hrs: r2_(m.hrs), km: r2_(m.km), trips: r2_(m.trips), nightHrs: r2_(m.nightHrs), entries: m.entries,
        hrsPerDay: wd ? r2_(m.hrs / wd) : 0, kmPerDay: wd ? r2_(m.km / wd) : 0, tripsPerDay: wd ? r2_(m.trips / wd) : 0,
        issued: r2_(m.issued), std: std, extra: extra, extraPct: std > 0 && m.issued > 0 ? r2_(extra / std * 100) : '', extraAmt: r2_(Math.max(0, extra) * dRate),
        actualAvg: hasKm_(m.unit) && !hasHr_(m.unit) ? (m.issued ? r2_(m.km / m.issued) : '') : (m.hrs ? r2_(m.issued / m.hrs) : ''), stdAvg: hasKm_(m.unit) && !hasHr_(m.unit) ? m.kmStd : m.hrStd,
        avgUnit: hasKm_(m.unit) && !hasHr_(m.unit) ? 'km/L' : 'L/hr', lastLog: lastAny, idleFor: idleFor, pending: pending,
        basis: basis, rent: r2_(rent), recover: r2_(recover), idleRent: r2_(idleRent), perHr: m.hrs && rent ? r2_(rent / m.hrs) : '', perKm: m.km && rent ? r2_(rent / m.km) : '', perTrip: m.trips && rent ? r2_(rent / m.trips) : '' };
      if (full) {
        o.cal = days.map(d => !m.availSet[d] ? '-' : m.day[d] && m.night[d] ? 'B' : m.day[d] ? 'D' : m.night[d] ? 'N' : m.dieselDays[d] ? 'P' : '.').join('');
        o.drivers = Object.keys(m.drivers).map(n2 => ({ name: n2, hrs: r2_(m.drivers[n2].hrs), km: r2_(m.drivers[n2].km), trips: r2_(m.drivers[n2].trips), days: Object.keys(m.drivers[n2].days).length }));
        o.chain = Object.keys(m.chain).map(c => Object.assign({ ch: c }, m.chain[c]));
        o.work = Object.keys(m.work).map(w => ({ w: w, n: m.work[w] })).sort((x, y) => y.n - x.n).slice(0, 5);
        o.anomalies = m.anomalies;
      }
      return o;
    });
    const kpi = { machines: tot.machines, worked: tot.worked, util: tot.avail ? r2_(tot.workDays / tot.avail * 100) : 0, hrs: r2_(tot.hrs), km: r2_(tot.km), trips: r2_(tot.trips),
      issued: r2_(tot.issued), std: r2_(tot.std), extra: r2_(tot.extra), extraAmt: r2_(tot.extra * dRate), eff: tot.issued && tot.std ? r2_(tot.std / tot.issued * 100) : '',
      idle3: tot.idle3, compliance: tot.dDays ? r2_(tot.dDaysLogged / tot.dDays * 100) : '', pendingDays: tot.dDays - tot.dDaysLogged,
      nightShare: tot.hrs ? r2_(tot.nightHrs / tot.hrs * 100) : 0, rent: r2_(tot.rent), idleRent: r2_(tot.idleRent) };
    const out = { kpi: kpi, list: list };
    if (full) out.daily = days.map(d => { const x = daily[d]; return { date: d, hrsDay: r2_(x.hrsDay), hrsNight: r2_(x.hrsNight), km: r2_(x.km), trips: r2_(x.trips), machines: Object.keys(x.machines).length }; });
    return out;
  };
  const cur = core(from, to, true), prev = core(pFrom, pTo, false);
  const L = cur.list, sum = (arr, fn) => r2_(arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0));
  const group = keyFn => { const gmap = {}; L.forEach(x => { const k = keyFn(x); (gmap[k] = gmap[k] || []).push(x); });
    return Object.keys(gmap).map(k => { const a = gmap[k], av = sum(a, x => x.avail), wd = sum(a, x => x.workDays), iss = sum(a, x => x.issued), std = sum(a, x => x.issued > 0 ? x.std : 0);
      return { key: k, count: a.length, worked: a.filter(x => x.workDays).length, util: av ? r2_(wd / av * 100) : 0, hrs: sum(a, x => x.hrs), km: sum(a, x => x.km), trips: sum(a, x => x.trips),
        issued: iss, std: std, extra: sum(a, x => Math.max(0, x.extra)), eff: iss && std ? r2_(std / iss * 100) : '', rent: sum(a, x => x.rent), idleRent: sum(a, x => x.idleRent) }; }); };
  const byType = group(x => x.type || '(no type)').sort((a, b) => b.hrs + b.km - a.hrs - a.km);
  const byOwn = group(x => x.ownership).sort((a, b) => APP.OWNERSHIP.indexOf(a.key) - APP.OWNERSHIP.indexOf(b.key));
  const chainMap = {}, drvMap = {}, workMap = {};
  L.forEach(x => {
    (x.chain || []).forEach(c => { const y = chainMap[c.ch] = chainMap[c.ch] || { ch: c.ch, hrs: 0, km: 0, trips: 0, entries: 0, machines: {} }; y.hrs += c.hrs; y.km += c.km; y.trips += c.trips; y.entries += c.entries; y.machines[x.no] = true; });
    (x.drivers || []).forEach(d => { const y = drvMap[d.name.toUpperCase()] = drvMap[d.name.toUpperCase()] || { name: d.name, hrs: 0, km: 0, trips: 0, days: 0, machines: [], extra: 0 };
      y.hrs += d.hrs; y.km += d.km; y.trips += d.trips; y.days += d.days; y.machines.push(x.no); if (x.extra > 0 && (x.drivers || []).length === 1) y.extra += x.extra; });
    (x.work || []).forEach(w => { workMap[w.w] = (workMap[w.w] || 0) + w.n; });
  });
  const chainage = Object.values(chainMap).map(y => ({ ch: y.ch, hrs: r2_(y.hrs), km: r2_(y.km), trips: r2_(y.trips), entries: y.entries, machines: Object.keys(y.machines).length })).sort((a, b) => b.trips - a.trips || b.hrs - a.hrs).slice(0, 25);
  const drivers = Object.values(drvMap).map(y => ({ name: y.name, hrs: r2_(y.hrs), km: r2_(y.km), trips: r2_(y.trips), days: y.days, machines: y.machines.join(', '), extra: r2_(y.extra) })).sort((a, b) => b.hrs + b.km / 10 - a.hrs - a.km / 10).slice(0, 40);
  const work = Object.keys(workMap).map(w => ({ w: w, n: workMap[w] })).sort((a, b) => b.n - a.n).slice(0, 12);
  // alerts
  const alerts = [];
  // hired machinery standing idle at site (not billed for those days, but not working either – release or put to work)
  L.filter(x => x.avail && x.idleFor >= 3 && (x.ownership === 'Rental' || x.ownership === 'Hired')).sort((a, b) => b.idleFor - a.idleFor).forEach(x => alerts.push({ kind: 'rent', level: 'bad', no: x.no, owner: x.owner,
    text: 'Rental / hired machinery idle ' + x.idleFor + ' day(s)' + (x.lastLog ? ' since ' + dmy_(x.lastLog) : ' – no work in the period') + ' – put it to work or release it' }));
  L.filter(x => x.avail && x.idleFor >= 7 && x.ownership !== 'Rental' && x.ownership !== 'Hired').sort((a, b) => b.idleFor - a.idleFor).forEach(x => alerts.push({ kind: 'idle', level: 'warn', no: x.no, owner: x.owner,
    text: 'No Log Book for ' + x.idleFor + ' day(s)' + (x.lastLog ? ' (last ' + dmy_(x.lastLog) + ')' : ' in the period') }));
  L.filter(x => x.extraPct !== '' && x.extraPct > 10 && x.extra > 20).sort((a, b) => b.extraAmt - a.extraAmt).forEach(x => alerts.push({ kind: 'diesel', level: 'bad', no: x.no, owner: x.owner, amount: x.extraAmt,
    text: 'Diesel ' + r2_(x.extra) + ' L (' + x.extraPct + '%) over the standard – ₹' + x.extraAmt + '; average ' + x.actualAvg + ' ' + x.avgUnit + ' vs standard ' + x.stdAvg }));
  L.filter(x => x.pending.length).sort((a, b) => a.pending[0] < b.pending[0] ? -1 : 1).forEach(x => alerts.push({ kind: 'pending', level: 'warn', no: x.no, owner: x.owner,
    text: 'Diesel issued but no Log Book on ' + x.pending.length + ' day(s) – oldest ' + dmy_(x.pending[0]) }));
  L.forEach(x => (x.anomalies || []).forEach(an => alerts.push({ kind: 'reading', level: 'bad', no: x.no, owner: x.owner, date: an.date, text: dmy_(an.date) + ': ' + an.text })));
  // last bill of every machinery (for its profile)
  try {
    const bt = billTable_();
    if (bt) bt.rows.map(r => billOut_(bt, r, true)).filter(b => b.status === 'Active').forEach(b => ((b.data || {}).machines || []).forEach(mm => {
      const x = L.find(y => noKey_(y.no) === noKey_(mm.no)); if (x && (!x.lastBill || b.to > x.lastBill.to)) x.lastBill = { billNo: b.billNo, rev: b.rev, from: b.from, to: b.to, net: b.net, company: b.company };
    }));
  } catch (e) { /* no bills yet */ }
  const types = [...new Set(getMaster_().map(m => m.type).filter(Boolean))].sort();
  const vendors = [...new Set(getMaster_().map(m => clean_(m.owner)).filter(Boolean))].sort();
  return { from: from, to: to, days: n, prevFrom: pFrom, prevTo: pTo, today: today, dieselRate: dRate, kpi: cur.kpi, prev: prev.kpi, machines: L.sort((a, b) => b.util - a.util || b.hrs + b.km - a.hrs - a.km),
    daily: cur.daily, byType: byType, byOwn: byOwn, chainage: chainage, drivers: drivers, work: work, alerts: alerts, types: types, vendors: vendors };
}

/* ================= MACHINERY PAYMENTS & VENDOR LEDGER =================
 * One ledger per vendor (the name on the bill – Sketchline / Rachana – is only a heading, not a separate account).
 * Balance = Opening (Payable +, Advance −) + submitted bills in force (Net Payable, on the Bill Date) − payments.
 * A positive balance is what the company still has to pay the vendor. */
const PAY_COLS_ = ['Payment ID', 'Type', 'Date', 'Vendor Name', 'Amount', 'Side', 'Mode', 'Reference', 'Against Bill', 'Remark', 'Created At'];
const PAY_MODES_ = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Adjustment'];
const payTable_ = () => vbTable_(APP.SHEET_PAYMENTS, PAY_COLS_);
function payOut_(t, r) {
  const g = h => h in t.c ? r[t.c[h]] : '';
  return { id: str_(g('Payment ID')), type: str_(g('Type')) === 'Opening' ? 'Opening' : 'Payment', date: dkey_(g('Date')), vendor: clean_(g('Vendor Name')), amount: r2_(num0_(g('Amount'))),
    side: str_(g('Side')) === 'Advance' ? 'Advance' : 'Payable', mode: str_(g('Mode')), ref: str_(g('Reference')), bill: str_(g('Against Bill')), remark: str_(g('Remark')),
    enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '', updatedBy: H.UBY in t.c ? str_(r[t.c[H.UBY]]) : '' };
}
function payList_() { const t = payTable_(); return t ? t.rows.map(r => payOut_(t, r)).filter(p => p.id) : []; }
function getPayments_(f) {
  f = f || {};
  const v = vKey_(f.vendor || '');
  const list = payList_().filter(p => (!v || vKey_(p.vendor) === v) && (!f.from || p.date >= f.from) && (!f.to || p.date <= f.to) && (!f.type || p.type === f.type));
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.id < b.id ? 1 : -1));
  return { payments: list, modes: PAY_MODES_ };
}
// x: { id?, type: 'Payment' | 'Opening', date, vendor, amount, side (opening: Payable / Advance), mode, ref, bill, remark }; mode 'add' | 'edit'
function savePayment_(x, mode) {
  return withLock_(() => {
    x = x || {};
    const type = x.type === 'Opening' ? 'Opening' : 'Payment';
    const vendor = clean_(x.vendor); if (!vendor) throw new Error('Pick the vendor.');
    const date = entryDate_(x.date);
    const amount = r2_(num0_(x.amount)); if (!(amount > 0)) throw new Error('Enter the amount.');
    if (type === 'Payment' && PAY_MODES_.indexOf(str_(x.mode)) === -1) throw new Error('Pick how it was paid (NEFT, RTGS, Cheque …).');
    vbSheet_(APP.SHEET_PAYMENTS, PAY_COLS_);
    addColIfMissing_(APP.SHEET_PAYMENTS, PAY_COLS_, H.EBY); addColIfMissing_(APP.SHEET_PAYMENTS, PAY_COLS_, H.UBY); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_PAYMENTS, PAY_COLS_);
    const all = t.rows.map((r, i) => Object.assign(payOut_(t, r), { i: i }));
    const cur = mode === 'edit' ? all.find(p => p.id === str_(x.id)) : null;
    if (mode === 'edit' && !cur) throw new Error('This entry was not found – it may have been deleted.');
    // one opening balance per vendor
    if (type === 'Opening' && all.some(p => p.type === 'Opening' && vKey_(p.vendor) === vKey_(vendor) && (!cur || p.id !== cur.id)))
      throw new Error('The opening balance of ' + vendor + ' is already entered. Edit that entry instead.');
    const row = cur ? t.rows[cur.i].slice() : newRow_(t);
    const id = cur ? cur.id : 'PAY-' + String(all.reduce((mx, p) => Math.max(mx, Number(p.id.replace(/\D/g, '')) || 0), 0) + 1).padStart(5, '0');
    set_(row, t, 'Payment ID', id); set_(row, t, 'Type', type); set_(row, t, 'Date', toDate_(date)); set_(row, t, 'Vendor Name', vendor); set_(row, t, 'Amount', amount);
    set_(row, t, 'Side', type === 'Opening' ? (x.side === 'Advance' ? 'Advance' : 'Payable') : '');
    set_(row, t, 'Mode', type === 'Payment' ? str_(x.mode) : ''); set_(row, t, 'Reference', type === 'Payment' ? clean_(x.ref) : '');
    set_(row, t, 'Against Bill', type === 'Payment' ? clean_(x.bill) : ''); set_(row, t, 'Remark', clean_(x.remark));
    let changes = '';
    if (cur) {
      stampEdit_(row, t);
      const was = cur, now = payOut_(t, row), show = { date: 'Date', vendor: 'Vendor', amount: 'Amount', side: 'Side', mode: 'Mode', ref: 'Reference', bill: 'Against Bill', remark: 'Remark' };
      changes = Object.keys(show).filter(k => String(was[k]) !== String(now[k])).map(k => show[k] + ': ' + (was[k] || '–') + ' → ' + (now[k] || '–')).join('; ');
      t.sh.getRange(cur.i + 2, 1, 1, row.length).setValues([row]);
    } else { set_(row, t, 'Created At', new Date()); t.sh.appendRow(row); }
    return { ok: true, id: id, added: !cur, type: type, vendor: vendor, amount: amount, changes: changes };
  });
}
function deletePayment_(id) {
  return withLock_(() => {
    const t = payTable_(); if (!t) throw new Error('Entry not found.');
    const i = t.rows.findIndex(r => str_(r[t.c['Payment ID']]) === str_(id));
    if (i === -1) throw new Error('This entry was not found – it may have been deleted already.');
    const p = payOut_(t, t.rows[i]);
    t.sh.deleteRow(i + 2);
    return { ok: true, id: p.id, type: p.type, vendor: p.vendor, amount: p.amount, date: p.date };
  });
}
// every ledger line of every vendor: opening, bills in force (on the Bill Date), payments
/* ================= "DEBIT TO" and DEBIT NOTES =================
 * A Log Book entry can carry "Debit to" (a party of the Vendor Master) and a rate typed by hand: that work is charged to
 * the party – whoever owns the machinery (own or a vendor's).
 * A Debit Note collects such entries of one party and period (and lines typed by hand): Sr, machinery, particular, qty,
 * rate, amount; GST % and TDS % typed on the note; Total = amount + GST − TDS. Its number is the next of the name's own
 * run (Rachana / Sketchline) – the same run the diesel debit notes of the bills use, so no number is given twice.
 * A Log Book entry can be in ONE note only (until that note is cancelled).
 * Money: a note that is not cancelled lowers what is payable to the party in the Vendor Ledger from its date. */
const DN_SHEET_ = 'Debit Notes';
const DN_COLS_ = ['Note ID', 'DN No', 'Company', 'Date', 'Vendor Name', 'Kind', 'Period From', 'Period To', 'Lines', 'Log IDs', 'Amount', 'GST %', 'GST Amount', 'TDS %', 'TDS Amount', 'Total', 'Status', 'Bill ID', 'Remark', 'Created At'];
const dnParse_ = v => { try { const o = JSON.parse(str_(v) || '[]'); return Array.isArray(o) ? o : []; } catch (e) { return []; } };
const dnNum_ = no => Number((/(\d+)\s*$/.exec(str_(no)) || [])[1]) || 0;
function dnOut_(t, r, i) {
  const g = h => h in t.c ? r[t.c[h]] : '';
  return { i: i, id: str_(g('Note ID')), no: str_(g('DN No')), company: str_(g('Company')), date: dkey_(g('Date')), vendor: clean_(g('Vendor Name')), kind: str_(g('Kind')) || 'Manual',
    from: dkey_(g('Period From')), to: dkey_(g('Period To')), lines: dnParse_(g('Lines')), logIds: dnParse_(g('Log IDs')).map(String), amount: r2_(num0_(g('Amount'))),
    gstPct: num0_(g('GST %')), gst: r2_(num0_(g('GST Amount'))), tdsPct: num0_(g('TDS %')), tds: r2_(num0_(g('TDS Amount'))), total: r2_(num0_(g('Total'))),
    status: str_(g('Status')) || 'Open', billId: str_(g('Bill ID')), remark: str_(g('Remark')), enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '' };
}
// every debit note; an empty list when the table is not there yet (step-1t SQL not run) – nothing else may break because of it
function dnList_() {
  try { const t = vbTable_(DN_SHEET_, DN_COLS_); return t ? t.rows.map((r, i) => dnOut_(t, r, i)).filter(x => x.id) : []; } catch (e) { return []; }
}
const logIdOf_ = r => str_(r.no) + '|' + str_(r.date) + '|' + str_(r.shift);
// the quantity an entry is charged for: hours, KM, trips or one day – as the entry was measured
function debitQty_(r) {
  const mode = r.mode || r.unit;
  if (mode === 'KM') return { qty: r2_(num0_(r.wkm)), unit: 'KM' };
  if (mode === 'Trip') return { qty: r2_(num0_(r.trip)), unit: 'Trips' };
  if (mode === 'Hrs' || mode === 'KM + Hrs') return { qty: r2_(num0_(r.whr)), unit: 'Hrs' };
  if (mode === 'Time') return { qty: r2_(num0_(r.tHrs) || num0_(r.whr)), unit: 'Hrs' };
  if (mode === 'Holiday' || mode === 'Breakdown') return { qty: 0, unit: 'Day' };
  return { qty: 1, unit: 'Day' };
}
// "Debit to" of an entry as typed: both the party and the rate, or neither.  undefined = not sent (leave what is saved)
function logDebit_(l, when) {
  if (!l || (l.debitTo === undefined && l.debitRate === undefined)) return null;
  const to = clean_(l.debitTo), rate = blank_(l.debitRate) ? '' : num0_(l.debitRate);
  if (!to && (rate === '' || rate === 0)) return { to: '', rate: '' };
  if (!to) throw new Error((when || '') + 'Debit to: pick the party for the rate ' + rate + '.');
  const vt = vendorTable_(), names = vt ? vt.rows.map(r => clean_(r[vt.c['Vendor Name']])).filter(Boolean) : [];
  const hit = names.find(n => vKey_(n) === vKey_(to));
  if (!hit) throw new Error((when || '') + 'Debit to: "' + to + '" is not in the Vendor Master.');
  if (!(rate > 0)) throw new Error((when || '') + 'Debit to ' + hit + ': type the rate.');
  return { to: hit, rate: r2_(rate) };
}
// the database must have the two "Debit to" columns (step-1t SQL); if not, say so instead of dropping what was typed
const DN_SQL_MSG_ = 'This needs one database step first: run sql/supabase_step1t_debit_notes.sql in Supabase → SQL Editor (it only adds; nothing is changed).';
function debitReady_() { let cols = null; try { cols = SS_().getSheetByName(APP.SHEET_LOG).dbCols; } catch (e) { cols = null; } if (cols && cols.indexOf('debit_to') === -1) throw new Error('"Debit to" cannot be saved yet. ' + DN_SQL_MSG_); }
function vendorNames_() { const vt = vendorTable_(); return vt ? [...new Set(vt.rows.map(r => clean_(r[vt.c['Vendor Name']])).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : []; }
// Log Book entries charged to a party in a period that are not in a debit note yet
function debitPending_(f) {
  f = f || {};
  const v = vKey_(f.vendor || ''); if (!v) throw new Error('Pick the party (Debit to).');
  const from = checkDate_(f.from), to = checkDate_(f.to); if (from > to) throw new Error('From date is after To date.');
  const used = {}; dnList_().filter(d => d.status !== 'Cancelled').forEach(d => d.logIds.forEach(k => { used[k] = d.no; }));
  const rows = getLogBookList_({ from: from, to: to, all: true }).rows.filter(r => r.debitTo && vKey_(r.debitTo) === v)
    .sort((a, b) => natCmp_(a.no, b.no) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(r => { const q = debitQty_(r), rate = r2_(num0_(r.debitRate));
      return { logId: logIdOf_(r), date: r.date, shift: r.shift, no: r.no, type: r.type || '', mode: r.mode || r.unit, qty: q.qty, unit: q.unit, rate: rate, amount: r2_(q.qty * rate), work: r.work || r.remark || '', inNote: used[logIdOf_(r)] || '' }; });
  return { vendor: clean_(f.vendor), from: from, to: to, rows: rows.filter(r => !r.inNote), already: rows.filter(r => r.inNote).length };
}
function nextDnNo_(company) {
  let last = 0;
  const t = billTable_(); if (t) t.rows.forEach(r => { const b = billOut_(t, r, false); if (b.company === company) last = Math.max(last, dnNum_(b.dnNo)); });
  dnList_().forEach(d => { if (d.company === company) last = Math.max(last, dnNum_(d.no)); });
  return str_(((billSettings_().companies || {})[company] || {}).dnPrefix) + String(last + 1).padStart(3, '0');
}
function saveDebitNote_(x) {
  return withLock_(() => {
    x = x || {};
    const company = str_(x.company); if (BILL_COMPANIES_.indexOf(company) === -1) throw new Error('Pick the name on the note (Rachana / Sketchline).');
    const names = vendorNames_(), vendor = names.find(n => vKey_(n) === vKey_(x.vendor || '')); if (!vendor) throw new Error('Pick the party from the Vendor Master.');
    const date = entryDate_(x.date);
    const from = x.from ? checkDate_(x.from) : '', to = x.to ? checkDate_(x.to) : ''; if (from && to && from > to) throw new Error('From date is after To date.');
    let sh, t;
    try { sh = vbSheet_(DN_SHEET_, DN_COLS_); addColIfMissing_(DN_SHEET_, DN_COLS_, H.EBY); addColIfMissing_(DN_SHEET_, DN_COLS_, H.UBY); TABLE_MEMO_ = {}; t = table_(DN_SHEET_, DN_COLS_); }
    catch (e) { if (/debit_notes|42P01|does not exist/.test(String(e && e.message))) throw new Error('Debit notes cannot be saved yet. ' + DN_SQL_MSG_); throw e; }
    const all = t.rows.map((r, i) => dnOut_(t, r, i)).filter(d => d.id);
    const used = {}; all.filter(d => d.status !== 'Cancelled').forEach(d => d.logIds.forEach(k => { used[k] = d.no; }));
    const inL = Array.isArray(x.lines) ? x.lines : []; if (!inL.length) throw new Error('Add at least one line.');
    if (inL.length > 300) throw new Error('A note can have up to 300 lines.');
    // the Log Book entries named in the lines: they must exist, be charged to this party, and not be in another note
    const ids = [...new Set(inL.map(l => str_(l.logId)).filter(Boolean))];
    let logs = {};
    if (ids.length) {
      const dates = ids.map(k => k.split('|')[1]).sort();
      getLogBookList_({ from: dates[0], to: dates[dates.length - 1], all: true }).rows.forEach(r => { logs[logIdOf_(r)] = r; });
    }
    const lines = inL.map((l, i) => {
      const at = 'Line ' + (i + 1) + ': ', logId = str_(l.logId);
      if (logId) {
        const r = logs[logId]; if (!r) throw new Error(at + 'its Log Book entry is not there any more – get the entries again.');
        if (vKey_(r.debitTo) !== vKey_(vendor)) throw new Error(at + 'that Log Book entry is not charged to ' + vendor + '.');
        if (used[logId]) throw new Error(at + 'that Log Book entry is already in debit note ' + used[logId] + '.');
      }
      const qty = num0_(l.qty), rate = num0_(l.rate), part = clean_(l.particular);
      if (!part) throw new Error(at + 'type the particular.');
      if (!(qty > 0)) throw new Error(at + 'the quantity must be more than 0.');
      if (!(rate > 0)) throw new Error(at + 'type the rate.');
      if (qty > 100000 || rate > 100000000) throw new Error(at + 'the quantity or the rate looks wrong.');
      return { sr: i + 1, logId: logId, machinery: clean_(l.machinery), particular: part, qty: r2_(qty), unit: clean_(l.unit), rate: r2_(rate), amount: r2_(qty * rate) };
    });
    const pct = (v, name) => { const n = blank_(v) ? 0 : num0_(v); if (n < 0 || n > 100) throw new Error(name + ' % must be between 0 and 100.'); return n; };
    const gstPct = pct(x.gstPct, 'GST'), tdsPct = pct(x.tdsPct, 'TDS');
    const amount = r2_(lines.reduce((a, l) => a + l.amount, 0)), gst = r2_(amount * gstPct / 100), tds = r2_(amount * tdsPct / 100), total = r2_(amount + gst - tds);
    const id = 'DN-' + String(all.reduce((mx, d) => Math.max(mx, Number(d.id.replace(/\D/g, '')) || 0), 0) + 1).padStart(5, '0'), no = nextDnNo_(company);
    const row = newRow_(t);
    set_(row, t, 'Note ID', id); set_(row, t, 'DN No', no); set_(row, t, 'Company', company); set_(row, t, 'Date', toDate_(date)); set_(row, t, 'Vendor Name', vendor);
    set_(row, t, 'Kind', ids.length ? 'Log Book' : 'Manual'); if (from) set_(row, t, 'Period From', toDate_(from)); if (to) set_(row, t, 'Period To', toDate_(to));
    set_(row, t, 'Lines', JSON.stringify(lines)); set_(row, t, 'Log IDs', JSON.stringify(ids)); set_(row, t, 'Amount', amount);
    set_(row, t, 'GST %', gstPct); set_(row, t, 'GST Amount', gst); set_(row, t, 'TDS %', tdsPct); set_(row, t, 'TDS Amount', tds); set_(row, t, 'Total', total);
    set_(row, t, 'Status', 'Open'); set_(row, t, 'Remark', clean_(x.remark)); set_(row, t, 'Created At', new Date());
    sh.appendRow(row); TABLE_MEMO_ = {};
    return { ok: true, id: id, no: no, vendor: vendor, company: company, total: total, lines: lines.length };
  });
}
function getDebitNotes_(f) {
  f = f || {};
  const v = vKey_(f.vendor || ''), co = str_(f.company), st = billSettings_();
  const list = dnList_().filter(d => (!f.id || d.id === f.id) && (!v || vKey_(d.vendor) === v) && (!co || d.company === co) && (!f.from || d.date >= f.from) && (!f.to || d.date <= f.to));
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.id < b.id ? 1 : -1));
  // the party's and the company's details for the print, as they are now
  const vend = {}; if (f.id) getVendors_().forEach(x => { vend[vKey_(x.name)] = x; });
  // the RA bill number of the bill a note is deducted in
  const billNoOf = {}; if (list.some(d => d.billId)) { const bt = billTable_(); if (bt) bt.rows.forEach(r => { const b = billOut_(bt, r, false); billNoOf[b.id] = b.billNo + (b.rev ? ' (Rev ' + b.rev + ')' : ''); }); }
  list.forEach(d => { d.billNo = d.billId ? (billNoOf[d.billId] || d.billId) : ''; });
  return { notes: list.map(d => Object.assign({}, d, f.id ? { vendorInfo: vend[vKey_(d.vendor)] || { name: d.vendor }, companyInfo: (st.companies || {})[d.company] || {} } : { lines: undefined, lineCount: d.lines.length })) };
}
function cancelDebitNote_(id) {
  return withLock_(() => {
    const t = vbTable_(DN_SHEET_, DN_COLS_); if (!t) throw new Error('No debit notes yet.');
    const d = t.rows.map((r, i) => dnOut_(t, r, i)).find(x => x.id === str_(id)); if (!d) throw new Error('Debit note not found.');
    if (d.status === 'Cancelled') return { ok: true, id: d.id, no: d.no, vendor: d.vendor, total: d.total, already: true };
    if (d.billId) { let bn = d.billId; try { const bt = billTable_(), br = bt && bt.rows.find(r => str_(r[bt.c['Bill ID']]) === d.billId); if (br) bn = 'RA Bill ' + billOut_(bt, br, false).billNo; } catch (e) { /* keep the id */ }
      throw new Error('Debit note ' + d.no + ' is deducted in a bill (' + bn + '). Delete that bill, or save it again without this note, then cancel the note.'); }
    const row = t.rows[d.i].slice(); set_(row, t, 'Status', 'Cancelled'); stampEdit_(row, t);
    t.sh.getRange(d.i + 2, 1, 1, row.length).setValues([row]); TABLE_MEMO_ = {};
    return { ok: true, id: d.id, no: d.no, vendor: d.vendor, total: d.total };
  });
}

function ledgerLines_() {
  const lines = [];
  payList_().forEach(p => lines.push({ vendor: p.vendor, date: p.date, kind: p.type === 'Opening' ? 'opening' : 'payment', ord: p.type === 'Opening' ? 0 : 2, id: p.id,
    bill: p.type === 'Opening' ? (p.side === 'Advance' ? 0 : p.amount) : 0, paid: p.type === 'Opening' ? (p.side === 'Advance' ? p.amount : 0) : p.amount,
    side: p.side, mode: p.mode, ref: p.ref, against: p.bill, remark: p.remark }));
  const t = billTable_();
  if (t) t.rows.map(r => billOut_(t, r, true)).filter(b => b.id && b.status === 'Active').forEach(b => {
    const d = b.data || {}, n = x => r2_(num0_(x)), net = d.I !== undefined && d.I !== '' ? n(d.I) : n(b.net);
    lines.push({ vendor: b.vendor, date: b.billDate || b.to, kind: 'bill', ord: 1, id: b.id, bill: net, paid: 0, company: b.company, billNo: b.billNo, rev: b.rev, from: b.from, to: b.to,
      basic: n(d.A), diesel: n(d.B), other: n(d.C), gst: r2_(n(d.E) + n(d.F)), tds: n(d.H) });
  });
  dnList_().filter(d => d.status !== 'Cancelled').forEach(d => lines.push({ vendor: d.vendor, date: d.date, kind: 'dn', ord: 2, id: d.id, bill: 0, paid: d.total, company: d.company, dnNo: d.no, remark: d.remark,
    basic: d.amount, gst: d.gst, tds: d.tds }));
  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.ord - b.ord || (a.id < b.id ? -1 : 1));
  return lines;
}
// one vendor, one period: opening at the start, every line with the running balance, closing
function vendorLedger_(f) {
  f = f || {};
  const v = vKey_(f.vendor || ''); if (!v) throw new Error('Pick the vendor.');
  const all = ledgerLines_().filter(l => vKey_(l.vendor) === v), from = dkey_(f.from) || '', to = dkey_(f.to) || '9999-12-31';
  // opening = the opening balance entry + everything before the start date; the rows are bills and payments of the period
  let open = 0; all.filter(l => l.date <= to && (l.kind === 'opening' || (from && l.date < from))).forEach(l => { open = r2_(open + l.bill - l.paid); });
  const openEntry = all.find(l => l.kind === 'opening') || null;
  let bal = open; const rows = [];
  all.filter(l => l.kind !== 'opening' && (!from || l.date >= from) && l.date <= to).forEach(l => { bal = r2_(bal + l.bill - l.paid); rows.push(Object.assign({}, l, { balance: bal })); });
  const tb = r2_(rows.reduce((a, l) => a + l.bill, 0)), tp = r2_(rows.reduce((a, l) => a + l.paid, 0));
  return { vendor: clean_(f.vendor), from: from, to: f.to ? dkey_(f.to) : '', opening: open, openEntry: openEntry && openEntry.date <= to ? { date: openEntry.date, side: openEntry.side, amount: openEntry.bill || openEntry.paid, remark: openEntry.remark } : null,
    rows: rows, totalBill: tb, totalPaid: tp, closing: bal };
}
// every vendor: opening at the start of the first month, bills and payments in the months, closing, and the balance at the end of each month
function vendorOutstanding_(f) {
  f = f || {};
  const fm = str_(f.fromM), tm = str_(f.toM); if (!fm || !tm || fm > tm) throw new Error('Pick the months.');
  const months = []; let [y, m] = fm.split('-').map(Number);
  while (true) { const k = y + '-' + String(m).padStart(2, '0'); if (k > tm || months.length > 60) break; months.push(k); m++; if (m > 12) { m = 1; y++; } }
  const lines = ledgerLines_(), by = {};
  lines.forEach(l => { const k = vKey_(l.vendor); (by[k] = by[k] || { vendor: l.vendor, lines: [] }).lines.push(l); });
  const rows = Object.keys(by).map(k => {
    const L = by[k].lines, sumTo = end => r2_(L.filter(l => l.date.slice(0, 7) <= end).reduce((a, l) => a + l.bill - l.paid, 0));
    const inP = L.filter(l => l.kind !== 'opening' && l.date.slice(0, 7) >= fm && l.date.slice(0, 7) <= tm);
    const opening = r2_(L.filter(l => l.date.slice(0, 7) <= tm && (l.kind === 'opening' || l.date.slice(0, 7) < fm)).reduce((a, l) => a + l.bill - l.paid, 0));
    return { vendor: by[k].vendor, opening: opening, bills: r2_(inP.reduce((a, l) => a + l.bill, 0)), paid: r2_(inP.reduce((a, l) => a + l.paid, 0)), closing: sumTo(tm),
      monthEnd: months.map(sumTo), lastPay: (L.filter(l => l.kind === 'payment').slice(-1)[0] || {}).date || '' };
  }).filter(r => r.opening || r.bills || r.paid || r.closing || r.monthEnd.some(x => x));
  rows.sort((a, b) => b.closing - a.closing || a.vendor.localeCompare(b.vendor));
  return { months: months, rows: rows };
}
/* Bill Summary: every SUBMITTED bill that is in force (a bill replaced by a revision is left out, so nothing is counted twice).
 * A bill belongs to the month its work period starts in. f: { fromM: 'yyyy-mm', toM, company, vendor } */
function billSummary_(f) {
  f = f || {};
  const t = billTable_(); if (!t) return { rows: [] };
  const v = vKey_(f.vendor || ''), co = str_(f.company), fm = str_(f.fromM), tm = str_(f.toM);
  const rows = t.rows.map(r => billOut_(t, r, true)).filter(b => b.id && b.status === 'Active' && (!v || vKey_(b.vendor) === v) && (!co || b.company === co))
    .map(b => {
      const d = b.data || {}, n = x => r2_(num0_(x));
      const A = n(d.A), B = n(d.B), C = n(d.C), gst = r2_(n(d.E) + n(d.F)), tds = n(d.H);
      return { id: b.id, vendor: b.vendor, company: b.company, billNo: b.billNo, rev: b.rev, from: b.from, to: b.to, billDate: b.billDate, month: b.from.slice(0, 7),
        basic: A, diesel: B, other: C, gst: gst, gstPct: num0_(d.gstPct), tds: tds, tdsPct: num0_(d.tdsPct), net: d.I !== undefined && d.I !== '' ? n(d.I) : n(b.net) };
    })
    .filter(b => b.month && (!fm || b.month >= fm) && (!tm || b.month <= tm));
  rows.sort((a, b) => a.vendor.localeCompare(b.vendor) || (a.month < b.month ? -1 : a.month > b.month ? 1 : 0) || a.company.localeCompare(b.company));
  return { rows: rows };
}
// the machinery of a bill (keys); an old bill without the list counts as "all machinery of the vendor"
function billMachKeys_(data) { return ((data || {}).machines || []).map(x => noKey_(x.no)).filter(Boolean); }
function billMachOverlap_(a, b) { return !a.length || !b.length || a.some(k => b.indexOf(k) > -1); }
/* ---------- Verify before submit ----------
 * The server builds every bill again from the database (Log Book, Diesel Issue, BOQ, Asset / Vendor Master) the same way
 * the Machinery Billing page does, and checks it line by line against the bill on the screen. A bill with any ✖ cannot be
 * submitted; ⚠ is shown to the user but does not stop the submit. A verified bill is remembered for 15 minutes. */
function billVerifyKey_(d, x) {
  const k = [vKey_((d.vendor || {}).name || x.vendor || ''), str_(x.company || d.company), dkey_(x.from || d.from), dkey_(x.to || d.to), r2_(num0_(d.A)), r2_(num0_(d.B)), r2_(num0_(d.C)), r2_(num0_(d.I))].join('|');
  return 'VB_' + hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, k, Utilities.Charset.UTF_8)).slice(0, 40);
}
// one machinery's part of a bill – the same rules as the Machinery Billing page (BOQ day by day, excess diesel)
function billMachineCalc_(m, list, extra, from, to, vtype, idlePaid) {
  const u = m.unit || (list[0] || {}).unit || 'KM', key = noKey_(m.id);
  const bday = (extra.boq || {})[key] || {}, iss0 = (extra.issues || {})[key] || {};
  const dim = d => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0).getDate();
  // day status: Holiday and Breakdown are recorded but NOT paid; Idle (standing by, no work) is paid or not as chosen in the bill
  const holidays = list.filter(r => (r.mode || r.unit) === 'Holiday').length, breakdowns = list.filter(r => (r.mode || r.unit) === 'Breakdown').length;
  const idleDays = [...new Set(list.filter(r => (r.mode || r.unit) === 'Idle').map(r => r.date))].length;
  list = list.filter(r => ['Holiday', 'Breakdown'].concat(idlePaid === false ? ['Idle'] : []).indexOf(r.mode || r.unit) === -1);
  const itemHrs = {}, itemOver = [], itemUnknown = [], itemLeft = [];
  const units = {}; list.forEach(r => { units[r.date] = units[r.date] || { day: false, night: false }; if (r.shift === 'Night') units[r.date].night = true; else units[r.date].day = true; });
  const workDays = Object.values(units).filter(x => x.day).length, nights = Object.values(units).filter(x => x.night).length;
  const segs = {}; let periodHrs = 0, last = null; const noBoq = [], legacy = [], zero = {};
  const seg = (k, o) => (segs[k] = segs[k] || Object.assign({ qty: 0, amount: 0 }, o));
  Object.keys(units).sort().forEach(d => {
    const x = units[d], n = (x.day ? 1 : 0) + (x.night ? 1 : 0), b = bday[d];
    const dayRows = list.filter(r => r.date === d);
    const hrs = dayRows.reduce((a, r) => a + (Number(r.whr) || 0), 0), km = dayRows.reduce((a, r) => a + (Number(r.wkm) || 0), 0), trips = dayRows.reduce((a, r) => a + (Number(r.trip) || 0), 0);
    if (!b) {
      if (Number(m.monthlyRate)) { legacy.push(d); const s1 = seg('legacy|' + dim(d), { unit: 'Days', rate: m.monthlyRate / dim(d) }); s1.qty += n; s1.amount += m.monthlyRate / dim(d) * n; }
      else noBoq.push(d);
      return;
    }
    last = b; const bk = b.boq + (b.amendNo ? '/' + b.amendNo : '');
    // Item-wise BOQ: every item on its own quantity (as shared in the Log Book entries) and its own rate
    if (Array.isArray(b.items) && b.items.length) {
      let any = 0;
      dayRows.forEach(r => { (r.itemOver || []).forEach(t => itemOver.push(dmy_(d) + ': ' + t)); (r.itemUnknown || []).forEach(t => itemUnknown.push(dmy_(d) + ': ' + t));
        Object.keys(r.itemLeft || {}).forEach(k => itemLeft.push(dmy_(d) + ': ' + r.itemLeft[k] + ' ' + ITEM_KIND_WORD_[k])); });
      b.items.forEach((it, j) => {
        const q = dayRows.reduce((a, r) => a + (r.itemQty || []).filter(x => x.n === it.name).reduce((a2, x) => a2 + (Number(x.q) || 0), 0), 0);
        if (!(q > 0)) return; any += q;
        const ik = bk + '|I' + j;
        if (it.basis === 'Monthly') { const s1 = seg(ik + '|M|' + dim(d), { unit: 'Days', rate: it.rate / dim(d) }); s1.qty += q; s1.amount += it.rate / dim(d) * q; }
        else if (it.basis === 'Per Day') { const s1 = seg(ik + '|D', { unit: 'Days', rate: it.rate }); s1.qty += q; s1.amount += it.rate * q; }
        else if (it.basis === 'Per KM') { const s1 = seg(ik + '|K', { unit: 'KM', rate: it.rate }); s1.qty += q; s1.amount += it.rate * q; }
        else if (it.basis === 'Per Trip') { const s1 = seg(ik + '|T', { unit: 'Trips', rate: it.rate }); s1.qty += q; s1.amount += it.rate * q; }
        else if (it.basis === 'Per Hour') {
          if (it.slabs && it.slabs.length) {
            let from2 = it.slabOn === 'Period' ? (itemHrs[ik] || 0) : 0, left = q;
            it.slabs.forEach((sl, k) => { if (left <= 0) return; const cap = sl.upTo === '' ? Infinity : Number(sl.upTo); if (from2 >= cap) return; const take = Math.min(left, cap - from2);
              const s1 = seg(ik + '|S' + k, { unit: 'Hrs', rate: sl.rate }); s1.qty += take; s1.amount += take * sl.rate; left -= take; from2 += take; });
            itemHrs[ik] = (itemHrs[ik] || 0) + q;
          } else { const s1 = seg(ik + '|H', { unit: 'Hrs', rate: it.rate }); s1.qty += q; s1.amount += it.rate * q; }
        }
      });
      if (!(any > 0) && dayRows.some(r => (r.mode || r.unit) !== 'Idle')) (zero[BOQ_ITEMWISE_] = zero[BOQ_ITEMWISE_] || []).push({ d: d, ways: [...new Set(dayRows.map(r => r.mode || r.unit))].join('/') });
      return;
    }
    // paid per hour / KM / trip, but that day's Log Book has none of it (e.g. filled on Trip for a Per Hour BOQ)
    if ((b.basis === 'Per Hour' && !(hrs > 0)) || (b.basis === 'Per KM' && !(km > 0)) || (b.basis === 'Per Trip' && !(trips > 0)))
      (zero[b.basis] = zero[b.basis] || []).push({ d: d, ways: [...new Set(dayRows.map(r => r.mode || r.unit))].join('/') });
    if (b.basis === 'Monthly') { const s1 = seg(bk + '|M|' + dim(d), { unit: 'Days', rate: b.rate / dim(d) }); s1.qty += n; s1.amount += b.rate / dim(d) * n; }
    else if (b.basis === 'Per Day') { const s1 = seg(bk + '|D', { unit: 'Days', rate: b.rate }); s1.qty += n; s1.amount += b.rate * n; }
    else if (b.basis === 'Per KM') { const s1 = seg(bk + '|K', { unit: 'KM', rate: b.rate }); s1.qty += km; s1.amount += b.rate * km; }
    else if (b.basis === 'Per Trip') { const s1 = seg(bk + '|T', { unit: 'Trips', rate: b.rate }); s1.qty += trips; s1.amount += b.rate * trips; }
    else if (b.basis === 'Per Hour') {
      if (b.slabs && b.slabs.length) {
        let from2 = b.slabOn === 'Period' ? periodHrs : 0, left = hrs;
        b.slabs.forEach((sl, k) => { if (left <= 0) return; const cap = sl.upTo === '' ? Infinity : Number(sl.upTo); if (from2 >= cap) return; const take = Math.min(left, cap - from2);
          const s1 = seg(bk + '|S' + k, { unit: 'Hrs', rate: sl.rate }); s1.qty += take; s1.amount += take * sl.rate; left -= take; from2 += take; });
        periodHrs += hrs;
      } else { const s1 = seg(bk + '|H', { unit: 'Hrs', rate: b.rate }); s1.qty += hrs; s1.amount += b.rate * hrs; }
    }
  });
  const amount = r2_(Object.values(segs).reduce((a, x) => a + r2_(x.amount), 0));
  // diesel: on a debited day ALL of it is recovered; on a company day only what is above the standard average
  const vt = vtype || 'As per BOQ', isDebit = d => dieselDebitDay_(vt, bday[d], m);
  const issued = r2_(Object.values(iss0).reduce((a, x) => a + (Number(x.qty) || 0), 0));
  const debitQty = r2_(Object.keys(iss0).filter(isDebit).reduce((a, d) => a + (Number(iss0[d].qty) || 0), 0)), companyQty = r2_(issued - debitQty);
  const own = list.filter(r => !isDebit(r.date));
  const tKm = own.reduce((a, r) => a + (Number(r.wkm) || 0), 0), tHr = own.reduce((a, r) => a + (Number(r.whr) || 0), 0);
  const kmStd = Number(m.kmStd) || 0, hrStd = Number(m.hrStd) || 0;
  const stdQty = r2_((hasKm_(u) && kmStd ? tKm / kmStd : 0) + (hasHr_(u) && hrStd ? tHr * hrStd : 0));
  const excessQty = stdQty > 0 ? Math.max(0, r2_(companyQty - stdQty)) : 0;
  const dRate = Math.max(Number(extra.avgRate) || 0, Number(extra.lastRate) || 0), excessAmt = r2_((debitQty + excessQty) * dRate);
  return { no: m.id, workDays: workDays, nights: nights, holidays: holidays, breakdowns: breakdowns, idleDays: idleDays, itemOver: itemOver, itemUnknown: itemUnknown, itemLeft: itemLeft, amount: amount, issued: issued, excessAmt: excessAmt, debitQty: debitQty, excessQty: excessQty, noBoq: noBoq, legacy: legacy, zero: zero, days: Object.keys(units).length,
    gstPct: last && last.gstPct !== '' && last.gstPct !== undefined ? Number(last.gstPct) : 0,
    tdsPct: last && last.tdsPct !== '' && last.tdsPct !== undefined ? Number(last.tdsPct) : (Number(m.tdsRate) || 0), woNo: last ? last.woNo || '' : '' };
}
function verifyBills_(p) {
  const bills = ((p || {}).bills || []).filter(b => b && b.vendor);
  if (!bills.length) throw new Error('No bill to verify.');
  const today = today_(), init = billInit_(), vendorsAll = getVendors_(), master = getMaster_(), cache = CacheService.getScriptCache();
  const byVendor = {}; init.vendors.forEach(v => { byVendor[vKey_(v.name)] = v; });
  const vendorRec = {}; vendorsAll.forEach(v => { vendorRec[vKey_(v.name)] = v; });
  const mByKey = {}; master.forEach(m => { mByKey[noKey_(m.id)] = m; });
  const periods = {}; bills.forEach(b => { periods[dkey_(b.from) + '|' + dkey_(b.to)] = true; });
  const cachePer = {};
  const periodData = (from, to) => {
    const k = from + '|' + to; if (cachePer[k]) return cachePer[k];
    const nos = [].concat(...init.vendors.map(v => v.machines.map(m => m.id)));
    const logs = getLogBookList_({ from: from, to: to, all: true }).rows || [];
    const extra = logPrintExtra_({ from: from, to: to, nos: nos });
    const byNo = {}; logs.forEach(r => { (byNo[noKey_(r.no)] = byNo[noKey_(r.no)] || []).push(r); });
    // diesel issued on a day that has no Log Book entry (Debit Basis machinery do not fill the Log Book)
    const missing = {};
    Object.keys(extra.issues || {}).forEach(k => { const m = mByKey[k]; if (m && m.supply === 'Debit Basis') return;
      Object.keys(extra.issues[k]).forEach(d => { if (!(byNo[k] || []).some(r => r.date === d)) (missing[k] = missing[k] || []).push(d); }); });
    return (cachePer[k] = { byNo: byNo, extra: extra, missing: missing });
  };
  const bs = billSettings_(), tbl = billTable_(), saved = tbl ? tbl.rows.map(r => billOut_(tbl, r, true)) : [];
  // machinery billed in this same batch (so a per-machinery bill does not report its sister bills as "left out")
  const inBatch = {}; bills.forEach(b => (b.machines || []).forEach(x => { (inBatch[vKey_((b.vendor || {}).name)] = inBatch[vKey_((b.vendor || {}).name)] || {})[noKey_(x.no)] = true; }));
  const out = bills.map((b, bi) => {
    const checks = [], ok = t => checks.push({ s: 'ok', t: t }), warn = t => checks.push({ s: 'warn', t: t }), bad = t => checks.push({ s: 'bad', t: t });
    const vname = clean_((b.vendor || {}).name), vk = vKey_(vname), from = dkey_(b.from), to = dkey_(b.to), co = str_(b.company);
    if (b.edited) bad('The bill was changed by hand on the page – build it again (a bill changed by hand can only be printed).');
    // period
    if (!from || !to || to < from) bad('Bill period is not proper.');
    else if (to > today) bad('Bill period ends after today (' + dmy_(to) + ').');
    else ok('Period ' + dmy_(from) + ' to ' + dmy_(to) + '.');
    if (b.billDate && dkey_(b.billDate) < to) warn('Bill date ' + dmy_(dkey_(b.billDate)) + ' is before the end of the period.');
    // bill number
    const no = clean_(b.billNo), myKeys = billMachKeys_(b);
    // a bill of the same vendor, name and period with any of the same machinery = the same bill again (a revision)
    const sameBill = y => y.status !== 'Deleted' && vKey_(y.vendor) === vk && y.company === co && y.from === from && y.to === to && billMachOverlap_(billMachKeys_(y.data), myKeys);
    if (!no) bad('RA Bill No is blank.');
    else if (bills.some((z, zi) => zi !== bi && vKey_((z.vendor || {}).name) === vk && str_(z.company) === co && clean_(z.billNo) === no)) bad('RA Bill No ' + no + ' is given to two bills of this vendor here – each bill needs its own number.');
    else {
      const other = saved.filter(y => y.status !== 'Deleted' && vKey_(y.vendor) === vk && y.company === co && y.billNo === no && !sameBill(y));
      const same = saved.filter(y => y.status === 'Active' && sameBill(y) && (!billMachKeys_(y.data).length || billMachKeys_(y.data).every(k => myKeys.indexOf(k) > -1)));
      if (other.length) bad('RA Bill No ' + no + ' is already used by another bill of this vendor (' + dmy_(other[0].from) + ' to ' + dmy_(other[0].to) + (billMachKeys_(other[0].data).length ? ', ' + other[0].data.machines.map(x => x.no).join(', ') : '') + ').');
      else if (same.length) warn('A bill of this vendor for the same period and machinery is already submitted (RA Bill ' + same[0].billNo + ') – you will be asked to keep the number (revision) or give a new one.');
      else ok('RA Bill No ' + no + ' is free.');
    }
    // the same machinery must never be billed twice for the same days (in any other bill still in force)
    saved.filter(y => y.status === 'Active' && vKey_(y.vendor) === vk && y.from <= to && y.to >= from && !(y.company === co && y.from === from && y.to === to &&
      (billMachKeys_(y.data).length ? billMachKeys_(y.data).every(k => myKeys.indexOf(k) > -1) : true)))
      .forEach(y => { const both = billMachKeys_(y.data).length ? (b.machines || []).filter(x => billMachKeys_(y.data).indexOf(noKey_(x.no)) > -1).map(x => x.no) : (b.machines || []).map(x => x.no);
        if (both.length) bad(both.join(', ') + ' already billed for these days in RA Bill ' + y.billNo + (y.rev ? ' rev ' + y.rev : '') + ' (' + y.company + ', ' + dmy_(y.from) + ' to ' + dmy_(y.to) + ') – double billing.'); });
    // vendor
    const vr = vendorRec[vk];
    if (!vr) bad('Vendor "' + vname + '" is not in Vendor Master.');
    else {
      ok('Vendor is in Vendor Master.');
      if (!vr.pan) warn('PAN is missing in Vendor Master.');
      if (!vr.account || !vr.ifsc) warn('Bank account / IFSC is missing in Vendor Master.');
    }
    const ci = (bs.companies || {})[co] || {};
    if (!ci.gstin || !ci.pan || !ci.address) warn('Company details of ' + co + ' are not complete (GST address / GSTIN / PAN) – Company details.');
    // machinery of the bill against the database
    const pd = from && to ? periodData(from, to) : { byNo: {}, extra: {}, missing: {} };
    const inBill = (b.machines || []), billKeys = {}; inBill.forEach(x => { billKeys[noKey_(x.no)] = true; });
    if (!inBill.length) bad('No machinery with Log Book / diesel in this period – nothing to bill.');
    const own = (byVendor[vk] || { machines: [] }).machines;
    const left = own.filter(m => !billKeys[noKey_(m.id)] && !(inBatch[vk] || {})[noKey_(m.id)] && ((pd.byNo[noKey_(m.id)] || []).length || (pd.extra.issues || {})[noKey_(m.id)]));
    if (left.length) (b.partial ? warn : bad)('Machinery of this vendor with work / diesel in the period are not in this bill: ' + left.map(m => m.id).join(', ') + (b.partial ? ' – bill them separately.' : ' – build again.'));
    let A = 0, B = 0, gstPct = 0, tdsPct = 0, woNo = '', mismatch = [];
    inBill.forEach(x => {
      const k = noKey_(x.no), m = mByKey[k];
      if (!m) { bad(x.no + ' is not in Asset Master.'); return; }
      if (vKey_(m.owner) !== vk) { bad(x.no + ' belongs to "' + (m.owner || 'no vendor') + '" in Asset Master, not to this vendor.'); return; }
      const c = billMachineCalc_(m, pd.byNo[k] || [], pd.extra, from, to, undefined, b.idlePaid !== false);
      if (c.idleDays && b.idlePaid !== true && b.idlePaid !== false) bad(x.no + ': ' + c.idleDays + ' Idle day(s) in the Log Book – choose in the bill whether Idle days are Paid or Not paid.');
      else if (c.idleDays) ok(x.no + ': ' + c.idleDays + ' Idle day(s) – ' + (b.idlePaid ? 'PAID' : 'NOT paid') + ' as chosen in the bill.');
      if (c.itemOver.length) bad(x.no + ': items have more work than the Log Book entry (' + c.itemOver.slice(0, 4).join('; ') + (c.itemOver.length > 4 ? ' …' : '') + ') – correct the items in the Log Book.');
      if (c.itemUnknown.length) bad(x.no + ': item not in the BOQ of that date (' + c.itemUnknown.slice(0, 4).join('; ') + (c.itemUnknown.length > 4 ? ' …' : '') + ') – correct the items in the Log Book or the BOQ.');
      if (c.itemLeft.length) warn(x.no + ': work given to no item – not billed (' + c.itemLeft.slice(0, 4).join('; ') + (c.itemLeft.length > 4 ? ' …' : '') + ').');
      A += c.amount; B += c.excessAmt; gstPct = Math.max(gstPct, c.gstPct); tdsPct = Math.max(tdsPct, c.tdsPct); woNo = woNo || c.woNo;
      const diff = [];
      if (c.workDays !== Number(x.workDays) || c.nights !== Number(x.nights)) diff.push('Log Book days ' + c.workDays + (c.nights ? ' + ' + c.nights + ' night' : '') + ' (bill: ' + x.workDays + (x.nights ? ' + ' + x.nights + ' night' : '') + ')');
      if (Math.abs(c.issued - num0_(x.issued)) > 0.01) diff.push('diesel issued ' + c.issued + ' L (bill: ' + num0_(x.issued) + ' L)');
      if (Math.abs(c.amount - num0_(x.amount)) > 0.5) diff.push('amount ₹' + c.amount + ' (bill: ₹' + num0_(x.amount) + ')');
      if (Math.abs(c.excessAmt - num0_(x.excessAmt)) > 0.5) diff.push('diesel deduction ₹' + c.excessAmt + ' (bill: ₹' + num0_(x.excessAmt) + ')');
      if (diff.length) mismatch.push(x.no + ': ' + diff.join(', '));
      if (c.noBoq.length && m.supply !== 'Debit Basis') bad(x.no + ': no BOQ rate on ' + c.noBoq.length + ' day(s) with Log Book (' + c.noBoq.slice(0, 5).map(dmy_).join(', ') + (c.noBoq.length > 5 ? ' …' : '') + ') – make / extend the BOQ.');
      if (c.legacy.length) warn(x.no + ': ' + c.legacy.length + ' day(s) billed at the old monthly rate from Asset Master (no BOQ on those days).');
      // BOQ basis against how the Log Book was filled: nothing billed for those days
      Object.keys(c.zero).forEach(bs => {
        const z = c.zero[bs], what = { 'Per Hour': 'hours (Hrs / Time)', 'Per KM': 'KM', 'Per Trip': 'trips', 'Item-wise': 'work for any of its items' }[bs], txt = z.slice(0, 5).map(y => dmy_(y.d) + ' ' + y.ways).join(', ') + (z.length > 5 ? ' …' : '');
        if (z.length >= c.days) bad(x.no + ': the BOQ is ' + bs + ' but the Log Book has no ' + what + ' in these dates (' + txt + ') – the machinery would earn nothing. Fill the Log Book on ' + what + ' or correct the BOQ.');
        else warn(x.no + ': ' + z.length + ' day(s) with no ' + what + ' for the ' + bs + ' BOQ (' + txt + ') – those days are not billed.');
      });
      const miss = pd.missing[k] || [];
      if (miss.length) bad(x.no + ': diesel issued but no Log Book entry on ' + miss.length + ' day(s) (' + miss.slice(0, 5).map(dmy_).join(', ') + (miss.length > 5 ? ' …' : '') + ') – fill the Log Book first.');
    });
    if (mismatch.length) bad('Bill does not match the Log Book / Diesel / BOQ now (something changed after "Build bills") – build again. ' + mismatch.join(' · '));
    else if (inBill.length) ok('Log Book, diesel issued and BOQ rates match the bill for all ' + inBill.length + ' machinery.');
    // amounts
    A = r2_(A); B = r2_(B);
    // GST and TDS only on a plus amount (a full-debit or diesel-heavy bill comes to a minus: the vendor owes)
    const C = r2_(num0_(b.C)), D = r2_(A - B - C), E = D > 0 ? r2_(D * gstPct / 200) : 0, F = E, G = r2_(D + E + F), Hh = D > 0 ? r2_(D * tdsPct / 100) : 0, I = r2_(G - Hh);
    const near = (a, x) => Math.abs(a - num0_(x)) <= 1;
    if (!(near(A, b.A) && near(B, b.B) && near(D, b.D) && near(E + F, num0_(b.E) + num0_(b.F)) && near(Hh, b.H) && near(I, b.I)))
      bad('Totals do not match: A ' + A + ', B ' + B + ', D ' + D + ', GST ' + r2_(E + F) + ', TDS ' + Hh + ', Net ' + I + ' (bill: Net ' + num0_(b.I) + ').');
    else ok('Totals are correct: A − B − C = D, GST ' + gstPct + '%, TDS ' + tdsPct + '%, Net Payable ₹' + I + '.');
    if (C > 0 && !clean_(b.cReason)) bad('Other deduction (C) ₹' + C + ' has no reason.');
    if (C > A) bad('Other deduction (C) is more than the work done (A).');
    if (inBill.length && !A && !B) bad('Net Payable is ₹0 – no work and no diesel to debit.');
    else if (inBill.length && I < 0) warn('The diesel debited is more than the work: the vendor owes ₹' + r2_(-I) + ' – it goes to his ledger as recoverable.');
    if (vr) {
      const reg = /^y/i.test(vr.gstReg || '');
      if (gstPct > 0 && (!reg || !vr.gst)) bad('GST ' + gstPct + '% is in the BOQ but the vendor is not GST registered / has no GST number in Vendor Master.');
      if (reg && !gstPct) warn('Vendor is GST registered but the BOQ has no GST %.');
    }
    if (inBill.length && !tdsPct) warn('TDS % is 0 in the BOQ.');
    if (inBill.length && !woNo) warn('Work Order No is not in the BOQ.');
    const nBad = checks.filter(c => c.s === 'bad').length;
    if (!nBad) cache.put(billVerifyKey_(b, { vendor: vname, company: co, from: from, to: to }), '1', 900);
    return { vendor: vname, billNo: no, net: num0_(b.I), checks: checks, bad: nBad, warn: checks.filter(c => c.s === 'warn').length };
  });
  return { ok: out.every(x => !x.bad), bills: out };
}
// submit bills: [{ vendor, company, billNo, from, to, billDate, net, data }]; same vendor + company + period already there → asks first
function submitBills_(b) {
  return withLock_(() => {
    b = b || {};
    const bills = (b.bills || []).filter(x => clean_(x.vendor));
    if (!bills.length) throw new Error('No bill to submit.');
    const notVerified = bills.filter(x => !CacheService.getScriptCache().get(billVerifyKey_(x.data || {}, x)));
    if (notVerified.length) return { ok: false, errors: notVerified.map(x => clean_(x.vendor) + ': verify the bill first (Verify & Submit) – the data or the amounts changed after it was checked.') };
    bills.forEach(x => {
      if (BILL_COMPANIES_.indexOf(str_(x.company)) === -1) throw new Error('Pick the company name for ' + x.vendor + '.');
      if (!clean_(x.billNo)) throw new Error('Enter the bill number for ' + x.vendor + '.');
      if (!dkey_(x.from) || !dkey_(x.to)) throw new Error('Pick the bill period.');
    });
    vbSheet_(APP.SHEET_BILLS, BILL_COLS_);
    addColIfMissing_(APP.SHEET_BILLS, BILL_COLS_, H.EBY); addColIfMissing_(APP.SHEET_BILLS, BILL_COLS_, H.UBY); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_BILLS, BILL_COLS_);
    const all = t.rows.map((r, i) => Object.assign(billOut_(t, r, true), { i: i }));
    const sameKey = x => all.filter(y => y.status !== 'Deleted' && vKey_(y.vendor) === vKey_(x.vendor) && y.company === x.company && y.from === dkey_(x.from) && y.to === dkey_(x.to) &&
      billMachOverlap_(billMachKeys_(y.data), billMachKeys_(x.data)));
    const dup = bills.map((x, i) => ({ i: i, vendor: clean_(x.vendor), company: x.company, existing: sameKey(x).map(y => ({ billNo: y.billNo, rev: y.rev, billDate: y.billDate, net: y.net, status: y.status })) })).filter(d => d.existing.length);
    const takenNo = x => all.some(y => y.status !== 'Deleted' && vKey_(y.vendor) === vKey_(x.vendor) && y.company === x.company && y.billNo === clean_(x.billNo) && !sameKey(x).some(z => z.id === y.id)) ||
      bills.some(z => z !== x && vKey_(z.vendor) === vKey_(x.vendor) && z.company === x.company && clean_(z.billNo) === clean_(x.billNo));
    const clash = bills.filter(takenNo).map(x => clean_(x.vendor) + ': bill no ' + clean_(x.billNo) + ' is already used by another bill of this vendor.');
    if (clash.length) return { ok: false, errors: clash };
    /* Debit notes ticked in a bill ("less debit notes" after the net payable): each must be a note of the same party and
     * the same name, not cancelled, and in ONE bill only (a bill saved again for the same period may keep the notes of the
     * bill it replaces). The amounts are taken from the saved notes, not from what the page sent. */
    let dnT = null; try { dnT = vbTable_(DN_SHEET_, DN_COLS_); } catch (e) { dnT = null; }
    const dnAll = dnT ? dnT.rows.map((r, i) => dnOut_(dnT, r, i)).filter(d => d.id) : [], dnTaken = {}, dnErr = [];
    bills.forEach(x => {
      const ids = [...new Set((Array.isArray((x.data || {}).dns) ? x.data.dns : []).map(n => str_(n && n.id)).filter(Boolean))], olderIds = sameKey(x).map(y => y.id);
      x._dn = ids.map(id => { const n = dnAll.find(z => z.id === id), who = clean_(x.vendor) + ': debit note ' + ((n && n.no) || id) + ' ';
        if (!n) { dnErr.push(who + 'was not found.'); return null; }
        if (n.status === 'Cancelled') { dnErr.push(who + 'is cancelled.'); return null; }
        if (vKey_(n.vendor) !== vKey_(x.vendor) || n.company !== x.company) { dnErr.push(who + 'is of ' + n.vendor + ' / ' + n.company + ' – it cannot be deducted in this bill.'); return null; }
        if (n.billId && olderIds.indexOf(n.billId) === -1) { dnErr.push(who + 'is already deducted in another bill.'); return null; }
        if (dnTaken[id]) { dnErr.push(who + 'is ticked in two bills.'); return null; }
        dnTaken[id] = true; return n; }).filter(Boolean);
    });
    if (dnErr.length) return { ok: false, errors: dnErr };
    if (dup.length && !b.confirm) return { ok: false, duplicates: dup };
    let n = all.reduce((mx, r) => Math.max(mx, Number(String(r.id).replace(/\D/g, '')) || 0), 0);
    const saved = [];
    /* Debit Note numbers (diesel deducted in the bill): one run of numbers for each name (Rachana / Sketchline).
     * The next number is one more than the highest ever given under that name; a bill saved again keeps its number. */
    const st = billSettings_(), dnLast = {};
    const dnNum = no => Number((/(\d+)\s*$/.exec(str_(no)) || [])[1]) || 0;
    all.forEach(y => { const k = y.company; dnLast[k] = Math.max(dnLast[k] || 0, dnNum((y.data || {}).dnNo)); });
    dnList_().forEach(y => { dnLast[y.company] = Math.max(dnLast[y.company] || 0, dnNum(y.no)); });   // the notes made from the Log Book use the same run
    bills.forEach(x => {
      const older = sameKey(x);
      // the older bill(s) of the same vendor and period are kept, marked Superseded
      older.filter(y => y.status === 'Active').forEach(y => { t.sh.getRange(y.i + 2, t.c['Status'] + 1).setValue('Superseded'); });
      const sameNo = older.filter(y => y.billNo === clean_(x.billNo));
      const rev = sameNo.length ? Math.max(...sameNo.map(y => y.rev)) + 1 : 0;
      const id = 'BILL-' + String(++n).padStart(5, '0');
      x.data = x.data || {};
      if (num0_(x.data.B) > 0) {
        const kept = older.map(y => str_((y.data || {}).dnNo)).filter(Boolean)[0];
        if (kept) x.data.dnNo = kept;
        else { dnLast[x.company] = (dnLast[x.company] || 0) + 1; x.data.dnNo = str_(((st.companies || {})[x.company] || {}).dnPrefix) + String(dnLast[x.company]).padStart(3, '0'); }
      } else delete x.data.dnNo;
      const J = r2_(x._dn.reduce((a, n2) => a + n2.total, 0));
      if (x._dn.length) { x.data.dns = x._dn.map(n2 => ({ id: n2.id, no: n2.no, date: n2.date, total: n2.total })); x.data.J = J; x.data.K = r2_(num0_(x.data.I) - J); }
      else { delete x.data.dns; delete x.data.J; delete x.data.K; }
      delete x.data.dnOpen;
      // the notes of this bill are marked as deducted in it; notes of the bill(s) it replaces that are no longer ticked are free again
      if (dnT) {
        const mine = {}; x._dn.forEach(n2 => { mine[n2.id] = true; });
        const olderIds = older.map(y => y.id);
        dnAll.forEach(n2 => {
          const link = mine[n2.id] ? id : (n2.billId && olderIds.indexOf(n2.billId) > -1 ? '' : null);
          if (link === null) return;
          const dr = dnT.rows[n2.i].slice(); set_(dr, dnT, 'Bill ID', link); set_(dr, dnT, 'Status', link ? 'Deducted' : 'Open'); stampEdit_(dr, dnT);
          dnT.sh.getRange(n2.i + 2, 1, 1, dr.length).setValues([dr]); dnT.rows[n2.i] = dr; n2.billId = link; n2.status = link ? 'Deducted' : 'Open';
        });
      }
      const row = newRow_(t);
      set_(row, t, 'Bill ID', id); set_(row, t, 'Vendor Name', clean_(x.vendor)); set_(row, t, 'Company', x.company); set_(row, t, 'Bill No', clean_(x.billNo)); set_(row, t, 'Rev', rev);
      set_(row, t, 'Period From', toDate_(dkey_(x.from))); set_(row, t, 'Period To', toDate_(dkey_(x.to))); set_(row, t, 'Bill Date', toDate_(dkey_(x.billDate) || today_()));
      set_(row, t, 'Net Payable', r2_(num0_(x.net))); set_(row, t, 'Status', 'Active'); set_(row, t, 'Data', JSON.stringify(x.data || {})); set_(row, t, 'Created At', new Date());
      t.sh.appendRow(row);
      saved.push({ id: id, vendor: clean_(x.vendor), billNo: clean_(x.billNo), rev: rev });
    });
    return { ok: true, saved: saved };
  });
}
function deleteBill_(id, reason) {
  return withLock_(() => {
    if (!clean_(reason)) throw new Error('Give the reason for deleting this bill.');
    const t = billTable_(); if (!t) throw new Error('Bill not found.');
    const i = t.rows.findIndex(r => str_(r[t.c['Bill ID']]) === str_(id));
    if (i === -1) throw new Error('Bill ' + id + ' was not found.');
    const b = billOut_(t, t.rows[i], false);
    t.sh.deleteRow(i + 2);
    // debit notes that were deducted in this bill are open again
    try { const dt = vbTable_(DN_SHEET_, DN_COLS_);
      if (dt) dt.rows.map((r, k) => dnOut_(dt, r, k)).filter(d => d.billId === b.id).forEach(d => { const dr = dt.rows[d.i].slice(); set_(dr, dt, 'Bill ID', ''); set_(dr, dt, 'Status', 'Open'); stampEdit_(dr, dt); dt.sh.getRange(d.i + 2, 1, 1, dr.length).setValues([dr]); });
      TABLE_MEMO_ = {}; } catch (e) { /* no debit notes table */ }
    return { ok: true, bill: b };
  });
}
function deleteVendor_(name) {
  return withLock_(() => {
    const t = vendorTable_(); if (!t) throw new Error('Vendor not found.');
    const i = t.rows.findIndex(r => vKey_(r[t.c['Vendor Name']]) === vKey_(name));
    if (i === -1) throw new Error(clean_(name) + ' has no saved details.');
    const b = boqTable_();
    const n = b ? b.rows.filter(r => vKey_(r[b.c['Vendor Name']]) === vKey_(name)).length : 0;
    if (n) throw new Error(clean_(name) + ' has ' + n + ' BOQ(s). Delete them first.');
    const a = (vendorMachines_()[vKey_(name)] || {}).machines || [];
    if (a.length) throw new Error(clean_(name) + ' has ' + a.length + ' asset(s) in Asset Master (' + a.slice(0, 3).map(m => m.id).join(', ') + (a.length > 3 ? '…' : '') + '). Give them another vendor first.');
    t.sh.deleteRow(i + 2);
    return { ok: true, vendors: getVendors_() };
  });
}
/* ---------- BOQ ---------- */
function boqOut_(t, r) {
  const g = h => h in t.c ? r[t.c[h]] : '';
  let lines = [], gstPct = '', tdsPct = '';
  let woNo = '', woDate = '';
  try { const j = JSON.parse(str_(g('Lines')) || '[]'); if (Array.isArray(j)) lines = j; else { lines = j.lines || []; gstPct = j.gstPct === undefined ? '' : j.gstPct; tdsPct = j.tdsPct === undefined ? '' : j.tdsPct; woNo = j.woNo || ''; woDate = j.woDate || ''; } } catch (e) { lines = []; }
  return { id: str_(g('BOQ ID')), no: str_(g('BOQ No')), vendor: clean_(g('Vendor Name')), from: dkey_(g('Valid From')), to: dkey_(g('Valid To')),
    amendOf: str_(g('Amendment Of')), amendNo: num0_(g('Amendment No')), lines: lines, gstPct: gstPct, tdsPct: tdsPct, woNo: woNo, woDate: woDate, remark: str_(g('Remark')),
    created: g('Created At') instanceof Date ? g('Created At').toISOString() : str_(g('Created At')),
    enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '', updatedBy: H.UBY in t.c ? str_(r[t.c[H.UBY]]) : '' };
}
function allBoqs_() { const t = boqTable_(); return t ? t.rows.map(r => boqOut_(t, r)).filter(b => b.id) : []; }
function getBoqs_(f) {
  f = f || {};
  const v = vKey_(f.vendor || '');
  const list = allBoqs_().filter(b => !v || vKey_(b.vendor) === v);
  // originals first, each followed by its amendments
  const roots = list.filter(b => !b.amendOf).sort((a, b) => a.vendor.localeCompare(b.vendor) || (a.from < b.from ? -1 : 1));
  const out = [];
  roots.forEach(r => { out.push(r); list.filter(b => b.amendOf === r.id).sort((a, b) => a.amendNo - b.amendNo).forEach(a => out.push(a)); });
  list.filter(b => b.amendOf && !roots.some(r => r.id === b.amendOf)).forEach(b => out.push(b));
  return { boqs: out, vendors: getVendors_() };
}
// hour slabs of a Per Hour rate (2 or more): [{ upTo, rate }], the last one open ("after that")
function boqSlabs_(l, basis, at) {
  if (basis !== 'Per Hour' || !Array.isArray(l.slabs) || l.slabs.filter(s => !blank_(s.rate)).length < 2) return [];
  const slabs = l.slabs.filter(s => !blank_(s.rate)).map((s, k, all) => {
    const rate = Number(s.rate); if (!(rate > 0)) throw new Error(at + 'every slab needs a rate.');
    const upTo = k === all.length - 1 ? '' : Number(s.upTo);
    if (k < all.length - 1 && !(upTo > 0)) throw new Error(at + 'slab ' + (k + 1) + ' needs "up to" hours.');
    return { upTo: upTo === '' ? '' : r2_(upTo), rate: r2_(rate) };
  });
  for (let k = 1; k < slabs.length - 1; k++) if (!(slabs[k].upTo > slabs[k - 1].upTo)) throw new Error(at + 'slab hours must go up (e.g. up to 1, up to 8, after that).');
  return slabs;
}
// the items of an Item-wise line: [{ name, basis, rate, slabs, slabOn, qty }]
//   qty: 'rest'  = takes what is left of the Log Book entry's total (hours / KM / trips) after the typed items – one per kind
//        'typed' = the quantity is typed in the Log Book entry.   Per Day / Monthly items have no qty (they count days).
function boqItems_(list, at) {
  const rows = (Array.isArray(list) ? list : []).filter(x => x && (clean_(x.name) || !blank_(x.rate) || (Array.isArray(x.slabs) && x.slabs.some(s => !blank_(s.rate)))));
  if (!rows.length) throw new Error(at + 'add the items (e.g. Bucket, Breaker) with their rates.');
  const seen = {}, rest = {};
  return rows.map((x, k) => {
    const a2 = at + 'item ' + (k + 1) + ': ';
    const name = clean_(x.name).replace(/[=;|"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) throw new Error(a2 + 'give the item a name (e.g. Bucket).');
    if (name.charAt(0) === '_') throw new Error(a2 + 'the name cannot start with "_".');
    if (seen[name.toUpperCase()]) throw new Error(a2 + '"' + name + '" is twice in this line.'); seen[name.toUpperCase()] = true;
    const basis = BOQ_ITEM_BASIS_.indexOf(str_(x.basis)) > -1 ? str_(x.basis) : '';
    if (!basis) throw new Error(a2 + 'pick the rent type (' + BOQ_ITEM_BASIS_.join(' / ') + ').');
    const slabs = boqSlabs_(x, basis, a2);
    const rate = slabs.length ? slabs[0].rate : Number(x.rate);
    if (!(rate > 0)) throw new Error(a2 + 'enter the rate of ' + name + '.');
    const kind = itemKind_(basis);
    let qty = '';
    if (kind !== 'day') { qty = str_(x.qty) === 'typed' ? 'typed' : str_(x.qty) === 'rest' ? 'rest' : (rest[kind] ? 'typed' : 'rest');
      if (qty === 'rest') { if (rest[kind]) throw new Error(a2 + 'only one ' + basis + ' item can take the "rest of the entry" – set ' + name + ' to "typed in the Log Book".'); rest[kind] = true; } }
    return { name: name, basis: basis, rate: r2_(rate), slabs: slabs, slabOn: slabs.length ? (str_(x.slabOn) === 'Period' ? 'Period' : 'Day') : '', qty: qty };
  });
}
function validateBoqLines_(lines, vendor) {
  const mine = ((vendorMachines_()[vKey_(vendor)] || {}).machines || []).map(m => m.id);
  const seen = {};
  if (!Array.isArray(lines) || !lines.length) throw new Error('Add at least one machinery line.');
  return lines.map((l, n) => {
    const at = 'Line ' + (n + 1) + ': ';
    const m = findMachine_(l.no);
    if (mine.indexOf(m.id) === -1) throw new Error(at + m.id + ' is not an asset of ' + vendor + ' in Asset Master (its Vendor / Owner Name must be ' + vendor + ').');
    if (seen[m.id]) throw new Error(at + m.id + ' is twice in this BOQ.'); seen[m.id] = true;
    const basis = BOQ_BASIS_.indexOf(str_(l.basis)) > -1 ? str_(l.basis) : '';
    if (!basis) throw new Error(at + 'pick the rate basis (' + BOQ_BASIS_.join(' / ') + ').');
    if (basis === BOQ_ITEMWISE_) {
      // several items with their own rent type and rate; the diesel rule stays one for the machinery
      return { no: m.id, type: m.type, basis: basis, rate: 0, slabs: [], slabOn: '', items: boqItems_(l.items, at + m.id + ' – '),
        diesel: str_(l.diesel) === 'Debit Basis' ? 'Debit Basis' : 'Company', minQty: '', remark: clean_(l.remark) };
    }
    const slabs = boqSlabs_(l, basis, at);
    const noRent = basis === BOQ_NORENT_;
    const rate = noRent ? 0 : slabs.length ? slabs[0].rate : Number(l.rate);
    if (!noRent && !(rate > 0)) throw new Error(at + 'enter the rate.');
    return { no: m.id, type: m.type, basis: basis, rate: r2_(rate), slabs: noRent ? [] : slabs, slabOn: !noRent && slabs.length ? (str_(l.slabOn) === 'Period' ? 'Period' : 'Day') : '',
      diesel: noRent || str_(l.diesel) === 'Debit Basis' ? 'Debit Basis' : 'Company',
      minQty: blank_(l.minQty) ? '' : r2_(Number(l.minQty) || 0), remark: clean_(l.remark) };
  });
}
function saveBoq_(b, mode, id) {
  return withLock_(() => {
    b = b || {};
    const vendor = clean_(b.vendor); if (!vendor) throw new Error('Pick the vendor.');
    ensureVendorRows_([vendor]);
    const vt = vendorTable_();
    const from = entryDateAny_(b.from, 'Valid From'), to = blank_(b.to) ? '' : entryDateAny_(b.to, 'Valid To');
    if (to && to < from) throw new Error('Valid To must be on or after Valid From.');
    const lines = validateBoqLines_(b.lines, vendor);
    const pct = (x, label, max) => blank_(x) ? '' : (() => { const n = Number(x); if (!isFinite(n) || n < 0 || n > max) throw new Error(label + ' must be between 0 and ' + max + '.'); return r2_(n); })();
    const vRow = vt.rows.find(r => vKey_(r[vt.c['Vendor Name']]) === vKey_(vendor));
    const gstReg = vRow && str_(vRow[vt.c['GST Registered']]) === 'Yes';
    const gstPct = gstReg ? pct(b.gstPct, 'GST %', 28) : '', tdsPct = pct(b.tdsPct, 'TDS %', 100);
    if (gstReg && gstPct === '') throw new Error(vendor + ' is GST registered – enter the GST % for this BOQ.');
    const all = allBoqs_().filter(x => x.id !== str_(id));
    let amendOf = str_(b.amendOf), amendNo = 0;
    if (mode === 'edit') { const me = allBoqs_().find(x => x.id === str_(id)); if (!me) throw new Error('BOQ ' + id + ' was not found.'); amendOf = me.amendOf; amendNo = me.amendNo; }
    if (amendOf) {
      const root = all.find(x => x.id === amendOf); if (!root) throw new Error('The BOQ being amended (' + amendOf + ') was not found.');
      if (vKey_(root.vendor) !== vKey_(vendor)) throw new Error('An amendment must be for the same vendor (' + root.vendor + ').');
      if (from < root.from || (root.to && from > root.to)) throw new Error('The amendment must start inside the BOQ period (' + dmy_(root.from) + ' to ' + (root.to ? dmy_(root.to) : 'open') + ').');
      if (mode !== 'edit') amendNo = all.filter(x => x.amendOf === amendOf).reduce((mx, x) => Math.max(mx, x.amendNo), 0) + 1;
    } else {
      // two BOQs (not amendments) of one vendor may not give the same machinery for the same dates
      const end = to || '9999-12-31';
      all.filter(x => !x.amendOf && vKey_(x.vendor) === vKey_(vendor) && x.from <= end && (x.to || '9999-12-31') >= from).forEach(x => {
        const both = lines.filter(l => x.lines.some(y => same_(y.no, l.no)));
        if (both.length) throw new Error(both.map(l => l.no).join(', ') + ' is already in ' + (x.no || x.id) + ' for ' + dmy_(x.from) + ' to ' + (x.to ? dmy_(x.to) : 'open') + '. Use "Amend" to change its rate.');
      });
    }
    const sh = vbSheet_(APP.SHEET_BOQ, BOQ_COLS_);
    addColIfMissing_(APP.SHEET_BOQ, BOQ_COLS_, H.EBY); addColIfMissing_(APP.SHEET_BOQ, BOQ_COLS_, H.UBY); TABLE_MEMO_ = {};
    const t = table_(APP.SHEET_BOQ, BOQ_COLS_);
    let i = -1, newId = str_(id);
    if (mode === 'edit') { i = t.rows.findIndex(r => str_(r[t.c['BOQ ID']]) === newId); if (i === -1) throw new Error('BOQ ' + id + ' was not found.'); }
    else { const n = t.rows.reduce((mx, r) => Math.max(mx, Number(String(r[t.c['BOQ ID']]).replace(/\D/g, '')) || 0), 0) + 1; newId = 'BOQ-' + String(n).padStart(4, '0'); }
    const row = i > -1 ? stampEdit_(t.rows[i].slice(), t) : newRow_(t);
    const put = (h, val) => set_(row, t, h, val);
    let boqNo = clean_(b.no);
    if (!boqNo) boqNo = String(all.filter(x => vKey_(x.vendor) === vKey_(vendor)).reduce((mx, x) => Math.max(mx, /^\d+$/.test(x.no) ? Number(x.no) : 0), 0) + 1);
    if (all.some(x => vKey_(x.vendor) === vKey_(vendor) && x.no === boqNo)) throw new Error(vendor + ' already has BOQ No ' + boqNo + '. Leave BOQ No blank for the next number.');
    put('BOQ ID', newId); put('BOQ No', boqNo); put('Vendor Name', vendor); put('Valid From', toDate_(from)); put('Valid To', to ? toDate_(to) : '');
    put('Amendment Of', amendOf); put('Amendment No', amendOf ? amendNo : ''); put('Lines', JSON.stringify({ lines: lines, gstPct: gstPct, tdsPct: tdsPct, woNo: clean_(b.woNo), woDate: dkey_(b.woDate) || '' })); put('Remark', clean_(b.remark));
    if (i === -1) { put('Created At', new Date()); t.sh.appendRow(row); } else t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    TABLE_MEMO_ = {}; ITEM_NOS_ = null; ITEM_ON_ = {};
    syncSupplyFromBoq_(lines.map(l => l.no));
    return { ok: true, id: newId, no: boqNo, amendNo: amendNo };
  });
}
function entryDateAny_(v, label) { const dk = dkey_(v); if (!dk) throw new Error('Enter the ' + label + '.'); return dk; }
function deleteBoq_(id) {
  return withLock_(() => {
    const t = boqTable_(); if (!t) throw new Error('BOQ not found.');
    const i = t.rows.findIndex(r => str_(r[t.c['BOQ ID']]) === str_(id));
    if (i === -1) throw new Error('BOQ ' + id + ' was not found.');
    const kids = t.rows.filter(r => str_(r[t.c['Amendment Of']]) === str_(id)).length;
    if (kids) throw new Error('This BOQ has ' + kids + ' amendment(s). Delete the amendments first.');
    const gone = boqOut_(t, t.rows[i]);
    t.sh.deleteRow(i + 2);
    TABLE_MEMO_ = {}; ITEM_NOS_ = null; ITEM_ON_ = {};
    syncSupplyFromBoq_(gone.lines.map(l => l.no));
    return { ok: true };
  });
}
/* ================= ITEM-WISE BOQ: the work of a Log Book entry shared between the items =================
 * The Log Book stays ONE entry per machinery + date + shift (readings, diesel and tank are not touched).
 * Its work is shared between the items of the BOQ line in force on that date:
 *   typed items – the quantity typed for them in the entry, kept in the "Item Work" column as { "Breaker": 3 }
 *   rest item   – what is left of the entry's total of that kind (hours / KM / trips) after the typed items
 *   Per Day / Monthly items – one in the line: every paid day; several: the one picked in the entry ("_day"), else the first. */
const itemKind_ = basis => basis === 'Per Hour' ? 'hr' : basis === 'Per KM' ? 'km' : basis === 'Per Trip' ? 'trip' : 'day';
const ITEM_KIND_WORD_ = { hr: 'hr', km: 'km', trip: 'trips' };
function itemWorkParse_(v) { try { const o = JSON.parse(str_(v) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
// machinery that are in an Item-wise BOQ line (any date) – only these need the item work looked up
let ITEM_NOS_ = null, ITEM_ON_ = {};
function itemNos_() {
  if (!ITEM_NOS_) { ITEM_NOS_ = {}; try { allBoqs_().forEach(b => (b.lines || []).forEach(l => { if (Array.isArray(l.items) && l.items.length) ITEM_NOS_[noKey_(l.no)] = true; })); } catch (e) { ITEM_NOS_ = {}; } }
  return ITEM_NOS_;
}
// the items of a machinery's BOQ on a date ([] = its BOQ is not Item-wise, or no BOQ)
function boqItemsOn_(m, dk) {
  if (!m || !m.owner || !itemNos_()[noKey_(m.id)]) return [];
  const k = noKey_(m.id) + '|' + dk;
  if (!(k in ITEM_ON_)) { let h = null; try { h = boqRateFor_(m.owner, m.id, dk); } catch (e) { h = null; } ITEM_ON_[k] = h && Array.isArray(h.line.items) ? h.line.items : []; }
  return ITEM_ON_[k];
}
const itemBrief_ = items => (items || []).map(it => ({ name: it.name, basis: it.basis, qty: it.qty || '' }));
/* the quantity of every item for ONE entry: row = { mode, whr, wkm, trip, work: { item: qty, _day: item } }
 * → { list: [{ n, q, k }], over: [text], unknown: [names], left: { hr, km, trip } (work given to no item) } */
function itemQtyOf_(items, row) {
  const out = { list: [], over: [], unknown: [], left: {} };
  const mode = str_(row.mode);
  if (!items || !items.length || mode === 'Holiday' || mode === 'Breakdown') return out;
  const work = row.work || {}, idle = mode === 'Idle', known = {};
  ['hr', 'km', 'trip'].forEach(k => {
    const its = items.filter(it => itemKind_(it.basis) === k); if (!its.length) return;
    const total = idle ? 0 : Math.max(0, Number(k === 'hr' ? row.whr : k === 'km' ? row.wkm : row.trip) || 0);
    let sum = 0;
    its.filter(it => it.qty !== 'rest').forEach(it => { known[it.name] = true; const q = Math.max(0, Number(work[it.name]) || 0); if (q > 0) { out.list.push({ n: it.name, q: r2_(q), k: k }); sum += q; } });
    const rest = its.find(it => it.qty === 'rest'), left = r2_(total - sum);
    if (left < -0.005) out.over.push(fmtVal_(r2_(sum)) + ' ' + ITEM_KIND_WORD_[k] + ' typed for the items, the entry has ' + fmtVal_(total) + ' ' + ITEM_KIND_WORD_[k]);
    else if (left > 0.005) { if (rest) out.list.push({ n: rest.name, q: left, k: k }); else out.left[k] = left; }
  });
  const days = items.filter(it => itemKind_(it.basis) === 'day');
  if (days.length) {
    const pick = days.length > 1 && str_(work._day) ? days.find(it => it.name === str_(work._day)) : null;
    if (days.length > 1 && str_(work._day) && !pick) out.unknown.push(str_(work._day));
    out.list.push({ n: (pick || days[0]).name, q: 1, k: 'day' });
    out.left = {}; // the day is paid by the Per Day / Monthly item: hours / KM given to no item are not "left out"
  }
  Object.keys(work).forEach(n => { if (n !== '_day' && !known[n] && Number(work[n]) > 0) out.unknown.push(n); });
  return out;
}
/* what is kept for an entry ("Item Work"): the typed items and the picked day item, checked against the BOQ of that date.
 * l.items = { item: qty, _day: item } as typed; tot = { hr, km, trip } of the entry (null = totals not checked here). */
function logItemWork_(m, dk, mode, l, tot) {
  const items = boqItemsOn_(m, dk);
  if (!items.length || mode === 'Holiday' || mode === 'Breakdown') return '';
  const inp = l && l.items && typeof l.items === 'object' ? Object.assign({}, l.items) : {}, out = {}, when = m.id + ' (' + dmy_(dk) + '): ';
  const find = n => items.find(it => it.name.toUpperCase() === clean_(n).toUpperCase());
  const given = {}; // by the item's own name
  Object.keys(inp).forEach(n => {
    if (n === '_day' || blank_(inp[n])) return;
    const it = find(n);
    if (!it) throw new Error(when + '"' + clean_(n) + '" is not an item of its BOQ (items: ' + items.map(x => x.name).join(', ') + ').');
    const q = Number(inp[n]); if (!isFinite(q) || q < 0) throw new Error(when + 'the quantity of ' + it.name + ' must be a number, 0 or more.');
    if (itemKind_(it.basis) === 'day') { if (q > 0 && !str_(inp._day)) inp._day = it.name; return; }
    given[it.name] = r2_(q);
  });
  ['hr', 'km', 'trip'].forEach(k => {
    const its = items.filter(it => itemKind_(it.basis) === k); if (!its.length) return;
    const total = mode === 'Idle' || !tot ? 0 : Math.max(0, num0_(tot[k])), w = ITEM_KIND_WORD_[k];
    let sum = 0;
    its.filter(it => it.qty !== 'rest').forEach(it => { const q = given[it.name] || 0; if (q > 0) { out[it.name] = q; sum += q; } });
    if (tot && sum > total + 0.005) throw new Error(when + its.filter(it => out[it.name]).map(it => it.name + ' ' + fmtVal_(out[it.name])).join(' + ') + ' ' + w + ' is more than the entry\'s total ' + fmtVal_(r2_(total)) + ' ' + w + '.');
    const rest = its.find(it => it.qty === 'rest');
    if (tot && rest && rest.name in given && Math.abs(given[rest.name] - r2_(total - sum)) > 0.01)
      throw new Error(when + rest.name + ' takes the rest of the entry (' + fmtVal_(r2_(total - sum)) + ' ' + w + ') – ' + fmtVal_(given[rest.name]) + ' does not match. Leave it blank or correct the other items.');
  });
  const days = items.filter(it => itemKind_(it.basis) === 'day');
  if (days.length > 1 && str_(inp._day)) {
    const hit = find(inp._day);
    if (!hit || itemKind_(hit.basis) !== 'day') throw new Error(when + '"' + clean_(inp._day) + '" is not a Per Day / Monthly item of its BOQ (' + days.map(x => x.name).join(', ') + ').');
    if (hit !== days[0]) out._day = hit.name;
  }
  return Object.keys(out).length ? JSON.stringify(out) : '';
}
function logItemCol_() { addColIfMissing_(APP.SHEET_LOG, logHeaders_(), H.ITEMS); TABLE_MEMO_ = {}; }
function logDebitCol_() { [H.DEBITTO, H.DEBITRATE].forEach(h => addColIfMissing_(APP.SHEET_LOG, logHeaders_(), h)); TABLE_MEMO_ = {}; }
const hasDebitIn_ = l => l && !blank_(l.debitTo);
const hasItemsIn_ = l => !!(l && l.items && typeof l.items === 'object' && Object.keys(l.items).some(k => !blank_(l.items[k])));
// Diesel Supply of a machinery on a date: from its BOQ in force (company paid / debit basis), else what Asset Master says
function supplyOn_(m, dk) {
  try { const h = m && m.owner ? boqRateFor_(m.owner, m.id, dk) : null; if (h && h.line.diesel) return h.line.diesel; } catch (e) {}
  return m ? m.supply : '';
}
// keep Asset Master's Diesel Supply = the BOQ in force today (so lists and new entries show it)
function syncSupplyFromBoq_(nos) {
  const t = table_(APP.SHEET_MASTER, MASTER_COLS_), today = today_();
  [...new Set(nos || [])].forEach(no => {
    const i = t.rows.findIndex(r => same_(rowId_(r, t), no)); if (i === -1) return;
    const owner = clean_(t.rows[i][t.c[H.OWNER]]); if (!owner) return;
    const h = boqRateFor_(owner, no, today); if (!h || !h.line.diesel) return;
    if (str_(t.rows[i][t.c[H.SUPPLY]]) !== h.line.diesel) t.sh.getRange(i + 2, t.c[H.SUPPLY] + 1).setValue(h.line.diesel);
  });
}
// the rate in force for a vendor's machinery on a date: newest version whose period covers the date
function boqRateFor_(vendor, no, dk) {
  const hits = [];
  allBoqs_().filter(b => vKey_(b.vendor) === vKey_(vendor) && b.from <= dk && (!b.to || b.to >= dk)).forEach(b => {
    const l = b.lines.find(x => same_(x.no, no)); if (l) hits.push({ b: b, l: l });
  });
  if (!hits.length) return null;
  hits.sort((x, y) => (x.b.from < y.b.from ? 1 : x.b.from > y.b.from ? -1 : 0) || (y.b.amendNo - x.b.amendNo) || (y.b.created > x.b.created ? 1 : -1));
  const h = hits[0];
  const root = h.b.amendOf ? allBoqs_().find(x => x.id === h.b.amendOf) : null;
  return { boq: h.b.id, boqNo: h.b.no, amendNo: h.b.amendNo, from: h.b.from, to: h.b.to, line: h.l, gstPct: h.b.gstPct, tdsPct: h.b.tdsPct,
    woNo: h.b.woNo || (root ? root.woNo : ''), woDate: h.b.woDate || (root ? root.woDate : '') };
}
function boqMissing_(f) {
  f = f || {};
  const dk = dkey_(f.date) || today_();
  const saved = {}; const vt = vendorTable_(); if (vt) vt.rows.forEach(r => { saved[vKey_(r[vt.c['Vendor Name']])] = true; });
  const out = getMaster_().filter(m => m.ownership !== 'Own' && m.status !== 'Inactive').map(m => ({ no: m.id, type: m.type, vendor: clean_(m.owner), ownership: m.ownership, vendorSaved: !!clean_(m.owner) }))
    .filter(x => !x.vendor || !boqRateFor_(x.vendor, x.no, dk));
  return { date: dk, rows: out };
}
function boqRateCheck_(f) {
  f = f || {};
  const m = findMachine_(f.no), dk = entryDateAny_(f.date, 'date');
  return { no: m.id, vendor: m.owner, date: dk, hit: boqRateFor_(m.owner, m.id, dk) };
}
function deleteMaster_(id, force) {
  return withLock_(() => {
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
    const i = t.rows.findIndex(r => same_(rowId_(r, t), id));
    if (i === -1) throw new Error(clean_(id) + ' was not found in Master.');
    const realId = rowId_(t.rows[i], t);
    if (!force) {
      const dt = table_(APP.SHEET_DIESEL, [H.NO]);
      const lt = table_(APP.SHEET_LOG, [H.NO]);
      const nd = dt.rows.filter(r => same_(r[dt.c[H.NO]], realId)).length;
      const nl = lt.rows.filter(r => same_(r[lt.c[H.NO]], realId)).length;
      if (nd || nl) {
        return { ok: false, warning: realId + ' has ' + nd + ' Diesel Issue and ' + nl +
          ' Log Book entries. Those entries will stay, but this machinery will be removed from Master. Delete anyway?' };
      }
    }
    t.sh.deleteRow(i + 2);
    return { ok: true, master: getMaster_() };
  });
}

/* ---------- Master export / import ---------- */
const MASTER_FIELDS_ = ['no', 'name', 'type', 'make', 'unit', 'kmStd', 'hrStd', 'owner', 'ownership', 'supply', 'status', 'activeFrom', 'inactiveFrom',
  'engineNo', 'chassisNo', 'engineMake', 'taxUpto', 'pucUpto', 'permitUpto', 'fitnessUpto', 'insuranceUpto'];
// Asset Master extras: engine / chassis details and the validity of papers (a date, or NA = not applicable)
const ASSET_TEXT_ = [['engineNo', 'ENGNO'], ['chassisNo', 'CHASSIS'], ['engineMake', 'ENGMAKE']];
const ASSET_DOCS_ = [['taxUpto', 'TAXV', 'Tax'], ['pucUpto', 'PUCV', 'PUC'], ['permitUpto', 'PERMITV', 'Permit'], ['fitnessUpto', 'FITV', 'Fitness'], ['insuranceUpto', 'INSV', 'Insurance']];
const LIFETIME_RE_ = /^(life ?time|ltt|life ?time tax( paid)?|lifetime tax paid|one ?time tax( paid)?|ott)$/i;
const docVal_ = v => { if (v instanceof Date) return dkey_(v); const s = str_(v); if (!s) return ''; if (/^(na|n\/a|not applicable)$/i.test(s)) return 'NA'; if (LIFETIME_RE_.test(s)) return 'LIFETIME'; return dkey_(s) || s; };
const docShow_ = v => v === 'NA' ? 'N/A' : v === 'LIFETIME' ? 'Lifetime' : v ? dmy_(v) : '–';

// All Master rows, in the same column order as the Master sheet.
function exportMaster_() {
  const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
  const extra = [H.WORKS, H.TCAP, H.ENGNO, H.CHASSIS, H.ENGMAKE, H.TAXV, H.PUCV, H.PERMITV, H.FITV, H.INSV];
  const heads = MASTER_COLS_.concat(extra);
  return {
    headers: heads,
    rows: t.rows.filter(r => rowId_(r, t) !== '').map(r => heads.map(h => { const v = h in t.c ? r[t.c[h]] : ''; return v instanceof Date ? dkey_(v).split('-').reverse().join('-') : (v === null || v === undefined ? '' : v); })),
  };
}

// rows: [{ line, no, name, type, make, unit, kmStd, hrStd, owner, ownership }]
// A field that is missing (undefined) keeps the value already in Master.
// apply = false only checks and counts; apply = true saves. Nothing is saved if any row has a problem.
function importMaster_(rows, apply) {
  return withLock_(() => {
    if (apply) { addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.WORKS); TABLE_MEMO_ = {}; }
    const t = table_(APP.SHEET_MASTER, MASTER_COLS_);
    const index = {};
    t.rows.forEach((r, i) => { const k = noKey_(rowId_(r, t)); if (k) index[k] = i; });
    const errors = [], adds = [], updates = [], seen = {};
    let same = 0;

    (rows || []).forEach(x => {
      if (MASTER_FIELDS_.every(f => x[f] === undefined || str_(x[f]) === '')) return;
      try {
        const key = noKey_(formatNo_(x.no || '') || clean_(x.name || ''));
        if (!key) throw new Error('enter the Machinery Number, or the Machinery Name if it has no number.');
        if (seen[key]) throw new Error('this machinery is also on row ' + seen[key] + ' of the file.');
        seen[key] = x.line;
        const i = index[key];
        const merged = {};
        if (i !== undefined) {
          const cur = t.rows[i];
          const curObj = { no: cur[t.c[H.NO]], name: cur[t.c[H.NAME]], type: cur[t.c[H.TYPE]], make: cur[t.c[H.MAKE]],
            unit: cur[t.c[H.UNIT]], kmStd: cur[t.c[H.KMSTD]], hrStd: cur[t.c[H.HRSTD]], owner: cur[t.c[H.OWNER]], ownership: cur[t.c[H.OWNTYPE]],
            supply: cur[t.c[H.SUPPLY]], status: cur[t.c[H.STATUS]], activeFrom: cur[t.c[H.AFROM]], inactiveFrom: cur[t.c[H.IFROM]] };
          ASSET_TEXT_.concat(ASSET_DOCS_).forEach(x => { curObj[x[0]] = H[x[1]] in t.c ? cur[t.c[H[x[1]]]] : undefined; });
          curObj.worksOn = H.WORKS in t.c ? cur[t.c[H.WORKS]] : '';
          MASTER_FIELDS_.forEach(f => { merged[f] = x[f] !== undefined ? x[f] : curObj[f]; });
          // a new Unit in the file without "Works On" = the ticks follow that Unit; "Works On" in the file wins
          merged.worksOn = !blank_(x.worksOn) ? x.worksOn : !blank_(x.unit) && normUnit_(x.unit) !== normUnit_(curObj.unit) ? '' : curObj.worksOn;
        } else {
          MASTER_FIELDS_.forEach(f => { merged[f] = x[f] !== undefined ? x[f] : ''; });
          merged.worksOn = x.worksOn || '';
        }
        const v = validateMaster_(merged);
        if (i !== undefined) {
          const row = buildMasterRow_(t, t.rows[i], v);
          const changed = row.some((val, k) => String(val) !== String(t.rows[i][k] === null ? '' : t.rows[i][k]));
          if (changed) updates.push({ i: i, row: row }); else same++;
        } else {
          adds.push(buildMasterRow_(t, null, v));
        }
      } catch (e) { errors.push({ row: x.line, msg: e.message.replace(/^Error:\s*/, '') }); }
    });

    const result = { ok: errors.length === 0, errors: errors, adds: adds.length, updates: updates.length, same: same };
    if (!apply || errors.length) return result;
    ASSET_TEXT_.concat(ASSET_DOCS_).forEach(x => { if ((rows || []).some(r => !blank_(r[x[0]]))) addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H[x[1]]); });
    if (adds.length || updates.length) addColIfMissing_(APP.SHEET_MASTER, MASTER_COLS_, H.WORKS);
    if (!adds.length && !updates.length) return result;

    if (updates.length) {
      const data = t.rows.map(r => r.slice());
      updates.forEach(u => { data[u.i] = u.row; });
      t.sh.getRange(2, 1, data.length, t.headers.length).setValues(data);
    }
    if (adds.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, adds.length, t.headers.length).setValues(adds);
    result.saved = true;
    result.master = getMaster_();
    return result;
  });
}

// "Debit" is no longer an ownership: diesel debit is decided in the BOQ. An old "Debit" machinery reads as Rental
// (its Diesel Supply stays Debit Basis until a BOQ decides it – "No rent – diesel only" for a machinery that only takes diesel).
function normOwnership_(v) {
  const k = str_(v).toUpperCase();
  if (k === 'DEBIT') return 'Rental';
  return APP.OWNERSHIP.find(o => o.toUpperCase() === k) || str_(v);
}

/* ---------- What a machinery works on (ticked in Asset Master): Day, Trip, KM, Hrs (hour meter), Time (from–to) ----------
 * Every Log Book entry is measured by one of its ways: KM, Hrs, KM + Hrs (both meters), Time, Trip or Day.
 * The machinery "Unit" is worked out from the ticks: KM when KM is ticked, Hrs when Hrs or Time is ticked (hours worked),
 * so the standard average (KM/Ltr, Ltr/Hr), the diesel, the bills and the reports keep working the same way. */
const WORKS_ = ['Day', 'Trip', 'KM', 'Hrs', 'KM + Hrs', 'Time'];
// ticks written as "KM, Hrs, KM + Hrs" – "KM + Hrs" (both readings in one entry) is its own tick
function normWorks_(v) {
  const t = Array.isArray(v) ? v.join(',') : str_(v); if (!t) return [];
  const got = {};
  t.split(/[,;\/|]/).forEach(p0 => {
    let u = p0.toUpperCase().trim(); if (!u) return;
    if (/KM\s*\+\s*(HRS?|HOURS?)/.test(u)) { got['KM + Hrs'] = true; u = u.replace(/KM\s*\+\s*(HRS?|HOURS?)/g, ' '); }
    if (/\bKM\b/.test(u)) got.KM = true; if (/\b(HRS|HR|HOURS?|HOUR METER)\b/.test(u)) got.Hrs = true;
    if (/\bTIME\b/.test(u)) got.Time = true; if (/\bTRIPS?\b/.test(u)) got.Trip = true; if (/\bDAYS?\b/.test(u)) got.Day = true;
  });
  return WORKS_.filter(w => got[w]);
}
function worksFromUnit_(unit) { const u = normUnit_(unit); return u === 'KM' ? ['KM'] : u === 'Hrs' ? ['Hrs'] : u === 'KM + Hrs' ? ['KM', 'Hrs'] : u === 'Day' ? ['Day'] : []; }
function unitFromWorks_(w) { const both = w.indexOf('KM + Hrs') > -1, km = w.indexOf('KM') > -1 || both, hr = w.indexOf('Hrs') > -1 || w.indexOf('Time') > -1 || both; return km && hr ? 'KM + Hrs' : km ? 'KM' : hr ? 'Hrs' : w.length ? 'Day' : ''; }
// the ways one Log Book entry can be measured, from the ticks
function logModes_(w) {
  // KM + Hrs: when ticked, or when both KM and Hrs are ticked (as before)
  const out = []; if (w.indexOf('KM') > -1) out.push('KM'); if (w.indexOf('Hrs') > -1) out.push('Hrs'); if (w.indexOf('KM + Hrs') > -1 || (w.indexOf('KM') > -1 && w.indexOf('Hrs') > -1)) out.push('KM + Hrs');
  if (w.indexOf('Time') > -1) out.push('Time'); if (w.indexOf('Trip') > -1) out.push('Trip'); if (w.indexOf('Day') > -1) out.push('Day'); return out;
}
// "08:00" – "13:30" less a break → hours (over midnight: 20:00 – 06:00 = 10 hrs)
function hhmm_(v) { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(str_(v)); if (!m) return null; let h = Number(m[1]); const mi = Number(m[2]); if (m[3]) { const pm = /PM/i.test(m[3]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; } if (h > 23 || mi > 59) return null; return h * 60 + mi; }
function timeHrs_(start, end, brk) {
  const a = hhmm_(start), b = hhmm_(end); if (a === null || b === null) return null;
  let mins = b - a; if (mins <= 0) mins += 1440; mins -= Math.max(0, num0_(brk));
  return mins > 0 ? r2_(mins / 60) : 0;
}
function normUnit_(u) {
  const k = str_(u).toUpperCase().replace(/\s+/g, '');
  if (k === 'KM') return 'KM';
  if (k === 'HRS' || k === 'HR' || k === 'HOURS') return 'Hrs';
  if (k === 'KM+HRS' || k === 'KM+HR' || k === 'KMHRS' || k === 'KM/HRS') return 'KM + Hrs';
  if (k === 'DAY' || k === 'DAYS' || k === 'TRIP' || k === 'TIME') return k === 'TIME' ? 'Hrs' : 'Day';
  return str_(u);
}

/* ================= DIESEL ISSUE ================= */
const DIESEL_COLS_ = [H.ID, H.IDATE, H.SHIFT, H.NO, H.TYPE, H.OWNER, H.QTY, H.KMR, H.HRR, H.REMARK, H.CREATED, H.DRIVER, H.SOURCE, H.SUPPLY];

// Checks one diesel line for a machine; returns the cleaned values.
function validateDiesel_(d, m) {
  const qty = numOrBlank_(d.qty);
  if (!(qty > 0)) throw new Error(m.id + ': enter Diesel Qty (Ltr).');
  // KM / Hrs reading and Driver Name are optional; a reading that is typed must be a valid number
  const debit = m.supply === 'Debit Basis'; // diesel on Debit Basis: no readings are kept
  // how this fill is measured (one of the machinery's ticks); KM / Hrs then need their reading
  const way = !debit && str_(d.mode) ? logModeFor_(m, d.mode) : '';
  if (way && hasKm_(way) && blank_(d.kmReading)) throw new Error(m.id + ': enter the KM reading (measured by ' + way + ').');
  if (way && hasHr_(way) && blank_(d.hrReading)) throw new Error(m.id + ': enter the Hrs reading (measured by ' + way + ').');
  const useKm = way ? hasKm_(way) : (m.meterKm !== undefined ? m.meterKm : hasKm_(m.unit)), useHr = way ? hasHr_(way) : (m.meterHr !== undefined ? m.meterHr : hasHr_(m.unit));
  const km = !debit && useKm && !blank_(d.kmReading) ? reqReading_(d.kmReading, m.id + ' KM Reading') : '';
  const hr = !debit && useHr && !blank_(d.hrReading) ? reqReading_(d.hrReading, m.id + ' Hrs Reading') : '';
  const driver = clean_(d.driver);
  // reading on the dispenser's total-litres counter after this fill (optional; only for the Dispenser)
  const src0 = checkLoc_(d.source || APP.MAIN_LOC, 'Diesel Source');
  const meter = src0 === APP.MAIN_LOC && !blank_(d.meter) ? reqReading_(d.meter, 'Current diesel issue reading') : '';
  return { qty: qty, km: km, hr: hr, driver: driver, remark: clean_(d.remark), source: src0, meter: meter };
}

// earlier name of the column ("Dispenser Meter") is renamed once
function renameMeterCol_() {
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  if (!(H.DMETER in t.c) && ('Dispenser Meter' in t.c)) { t.sh.getRange(1, t.c['Dispenser Meter'] + 1).setValue(H.DMETER); TABLE_MEMO_ = {}; }
}
function addColIfMissing_(sheet, cols, header) {
  const t = table_(sheet, cols);
  if (header in t.c) return;
  const cell = t.sh.getRange(1, t.headers.length + 1);
  cell.setValue(header);
  TABLE_MEMO_ = {};
}
function ensureMeterCol_() {
  renameMeterCol_();
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  if (H.DMETER in t.c) return;
  t.sh.getRange(1, t.headers.length + 1).setValue(H.DMETER);
  TABLE_MEMO_ = {};
}
/* Dispenser meter check: between two meter readings, the counter must have moved by exactly the diesel that
 * went out of the Dispenser (issues + transfers to VTR Store). A difference means a missing / wrong entry
 * or diesel taken without an entry. */
function meterChecks_(T) {
  const dc = T.dt.c;
  if (!(H.DMETER in dc)) return {};
  const out = {};
  let last = null, since = 0;
  events_(T).forEach(e => {
    if (e.loc !== APP.MAIN_LOC || e.q >= 0) return;         // only diesel going out of the Dispenser
    since = r2_(since - e.q);
    if (e.kind !== 'issue') return;
    const r = T.dt.rows[e.idx], mt = numOrBlank_(r[dc[H.DMETER]]);
    if (mt === '') return;
    if (last !== null) out[str_(r[dc[H.ID]])] = { used: r2_(mt - last), entered: since, gap: r2_((mt - last) - since) };
    last = mt; since = 0;
  });
  return out;
}
function buildDieselRow_(t, id, dk, shift, m, v, created) {
  const row = newRow_(t);
  set_(row, t, H.ID, id);
  set_(row, t, H.IDATE, toDate_(dk));
  set_(row, t, H.SHIFT, shift);
  set_(row, t, H.NO, m.id);
  set_(row, t, H.TYPE, m.type);
  set_(row, t, H.OWNER, m.owner);
  set_(row, t, H.QTY, v.qty);
  set_(row, t, H.KMR, v.km);
  set_(row, t, H.HRR, v.hr);
  set_(row, t, H.REMARK, v.remark);
  set_(row, t, H.CREATED, created);
  set_(row, t, H.DRIVER, v.driver);
  set_(row, t, H.SOURCE, v.source);
  set_(row, t, H.SUPPLY, supplyOn_(m, dk)); // how this machinery got diesel on that day (BOQ of that date, else Asset Master) – for Debit reports
  set_(row, t, H.DMETER, v.meter === undefined ? '' : v.meter);
  return row;
}

// Issue IDs never repeat, even after an entry is deleted.
function nextDieselNo_(t) {
  let max = Number(PropertiesService.getScriptProperties().getProperty('DIESEL_LAST_NO') || 0);
  t.rows.forEach(r => { const mt = String(r[t.c[H.ID]]).match(/(\d+)$/); if (mt) max = Math.max(max, Number(mt[1])); });
  return max + 1;
}
function markDieselNo_(n) { PropertiesService.getScriptProperties().setProperty('DIESEL_LAST_NO', String(n)); }

function readingWarnings_(no, v, last) {
  const w = [];
  if (last && v.km !== '' && last.km !== '' && v.km < last.km) w.push(no + ': KM Reading ' + v.km + ' is less than the last KM Reading ' + last.km + '.');
  if (last && v.hr !== '' && last.hr !== '' && v.hr < last.hr) w.push(no + ': Hrs Reading ' + v.hr + ' is less than the last Hrs Reading ' + last.hr + '.');
  return w;
}

/* Diesel given to one machinery before / on a date (newest first): shown while issuing diesel,
 * so the person knows when it was last filled, how much, and the last reading. */
function dieselHistory_(f) {
  f = f || {};
  const m = findMachine_(f.no), dk = dkey_(f.date) || today_(), lim = Math.min(Number(f.limit) || 5, 20);
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_), c = t.c;
  const mine = t.rows.filter(r => same_(r[c[H.NO]], m.id) && dkey_(r[c[H.IDATE]]) && dkey_(r[c[H.IDATE]]) <= dk).sort((a, b) => cmpDiesel_(b, a, c));
  const out = r => ({ id: str_(r[c[H.ID]]), date: dkey_(r[c[H.IDATE]]), shift: str_(r[c[H.SHIFT]]), qty: num0_(r[c[H.QTY]]),
    km: numOrBlank_(r[c[H.KMR]]), hr: numOrBlank_(r[c[H.HRR]]), source: loc_(r[c[H.SOURCE]]), driver: str_(r[c[H.DRIVER]]) });
  const withKm = mine.find(r => numOrBlank_(r[c[H.KMR]]) !== ''), withHr = mine.find(r => numOrBlank_(r[c[H.HRR]]) !== '');
  const month = dk.slice(0, 7), inMonth = mine.filter(r => dkey_(r[c[H.IDATE]]).slice(0, 7) === month);
  return { no: m.id, unit: m.unit, date: dk, rows: mine.slice(0, lim).map(out), total: mine.length,
    lastKm: withKm ? { value: numOrBlank_(withKm[c[H.KMR]]), date: dkey_(withKm[c[H.IDATE]]) } : null,
    lastHr: withHr ? { value: numOrBlank_(withHr[c[H.HRR]]), date: dkey_(withHr[c[H.IDATE]]) } : null,
    month: { qty: r2_(inMonth.reduce((s2, r) => s2 + num0_(r[c[H.QTY]]), 0)), count: inMonth.length } };
}
function saveDieselIssue_(d) {
  return withLock_(() => {
    if (!blank_(d.meter)) ensureMeterCol_();
    const dk = entryDate_(d.date);
    const shift = checkShift_(d.shift);
    const m = findMachine_(d.no);
    assertActive_(m, dk);
    const v = validateDiesel_(d, m);
    const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
    requireStockAt_(v.source, dk, shift, '', v.qty);

    if (!d.force) {
      const warn = readingWarnings_(m.id, v, lastReadings_(t, m.id));
      if (warn.length) return { ok: false, warning: warn.join(' ') + ' Save anyway?' };
    }

    const n = nextDieselNo_(t);
    const id = 'DI-' + String(n).padStart(6, '0');
    t.sh.appendRow(buildDieselRow_(t, id, dk, shift, m, v, new Date()));
    markDieselNo_(n);
    syncLogFromDiesel_(m.id, dk, shift);
    recalcBalances_();
    return { ok: true, id: id, stock: getStock_() };
  });
}

// Many diesel issues for one Date + Shift. Nothing is saved if any row has a problem.
/* Import diesel issues from an Excel / CSV file checked in the app. Each row has its own date, shift and source.
 * All rows are checked first (machinery in Master and active, qty, readings, dates up to today) and the stock of
 * every location is checked with all rows together in date order. Anything wrong → nothing saved, every problem listed. */
function importDiesel_(rows) {
  return withLock_(() => {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) throw new Error('The file has no rows to import.');
    if (rows.length > 1000) throw new Error('Import up to 1,000 rows at a time.');
    if (rows.some(r => !blank_(r.meter))) ensureMeterCol_();
    const byKey = {};
    getMaster_().forEach(m => { byKey[noKey_(m.id)] = m; });
    const T = stockTables_(), t = T.dt;
    const errors = [], items = [];
    rows.forEach((d, i) => {
      const line = Number((d && d.line) || i + 1);
      try {
        const dk = entryDate_(d.date), shift = checkShift_(d.shift || 'Day');
        const m = byKey[noKey_(d.no)];
        if (!m) throw new Error('"' + clean_(d.no) + '" is not in Master.');
        if (m.ownership !== 'Debit' && APP.UNITS.indexOf(m.unit) === -1) throw new Error('Set the Unit for ' + m.id + ' in Master first.');
        assertActive_(m, dk);
        const v = validateDiesel_(d, m);
        items.push({ line: line, dk: dk, shift: shift, m: m, v: v });
      } catch (e) { errors.push({ row: line, msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    let n = nextDieselNo_(t);
    const now = Date.now(), ids = [];
    const out = items.map((it, k) => { const id = 'DI-' + String(n++).padStart(6, '0'); ids.push(id); return buildDieselRow_(t, id, it.dk, it.shift, it.m, it.v, new Date(now + k)); });
    // stock with every row together; if it fails, find the row in date order
    try { assertNoNegative_(T, withRows_(T, 'dt', t.rows.concat(out))); }
    catch (e) {
      const order = items.map((it, k) => ({ it: it, row: out[k] })).sort((a, b) => a.it.dk < b.it.dk ? -1 : a.it.dk > b.it.dk ? 1 : shiftOrder_(a.it.shift) - shiftOrder_(b.it.shift));
      const acc = t.rows.slice();
      for (const x of order) { acc.push(x.row); try { assertNoNegative_(T, withRows_(T, 'dt', acc)); } catch (e2) { return { ok: false, errors: [{ row: x.it.line, msg: e2.message }] }; } }
      return { ok: false, errors: [{ row: 0, msg: e.message }] };
    }
    t.sh.getRange(t.sh.getLastRow() + 1, 1, out.length, t.headers.length).setValues(out);
    markDieselNo_(n - 1);
    // Log Book rows that already exist for those dates / shifts take the new diesel
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const hasLog = {};
    lt.rows.forEach(r => { hasLog[noKey_(r[lt.c[H.NO]]) + '|' + dkey_(r[lt.c[H.DATE]]) + '|' + str_(r[lt.c[H.SHIFT]])] = true; });
    const done = {};
    items.forEach(it => {
      ['Full Day', it.shift].forEach(sh => {
        const k = noKey_(it.m.id) + '|' + it.dk + '|' + sh;
        if (hasLog[k] && !done[k]) { done[k] = true; syncLogFromDiesel_(it.m.id, it.dk, sh); }
      });
    });
    recalcBalances_();
    return { ok: true, count: out.length, ids: ids, qty: r2_(items.reduce((a, it) => a + it.v.qty, 0)), stock: getStock_() };
  });
}
function saveDieselBulk_(b) {
  return withLock_(() => {
    if ((b.rows || []).some(r => !blank_(r.meter))) ensureMeterCol_();
    const dk = entryDate_(b.date);
    const shift = checkShift_(b.shift);
    const byKey = {};
    getMaster_().forEach(m => { byKey[noKey_(m.id)] = m; });
    const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);

    // last readings of every machine, read once
    const last = {}, lastRow = {};
    t.rows.forEach(r => {
      const k = noKey_(r[t.c[H.NO]]);
      if (!k) return;
      if (!lastRow[k] || cmpDiesel_(r, lastRow[k], t.c) >= 0) {
        lastRow[k] = r;
        last[k] = { km: numOrBlank_(r[t.c[H.KMR]]), hr: numOrBlank_(r[t.c[H.HRR]]) };
      }
    });

    const errors = [], warnings = [], items = [], seen = {};
    (b.rows || []).forEach((d, i) => {
      const blank = ['no', 'qty', 'kmReading', 'hrReading', 'driver', 'remark'].every(f => str_(d[f]) === '');
      if (blank) return;
      try {
        const m = byKey[noKey_(d.no)];
        if (!m) throw new Error('"' + clean_(d.no) + '" is not in Master.');
        if (m.ownership !== 'Debit' && APP.UNITS.indexOf(m.unit) === -1) throw new Error('Set the Unit for ' + m.id + ' in Master first.');
        assertActive_(m, dk);
        const v = validateDiesel_(d, m);
        const k = noKey_(m.id);
        // the same machinery more than once in a day is normal (several fills) – only its readings are checked in order
        readingWarnings_(m.id, v, seen[k] || last[k]).forEach(msg => warnings.push({ row: i + 1, msg: msg }));
        const prev = seen[k] || last[k] || { km: '', hr: '' };
        seen[k] = { km: v.km !== '' ? v.km : prev.km, hr: v.hr !== '' ? v.hr : prev.hr };
        items.push({ m: m, v: v });
      } catch (e) { errors.push({ row: i + 1, msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    if (!items.length) throw new Error('Enter at least one diesel issue.');
    const bsource = checkLoc_(b.source || APP.MAIN_LOC, 'Diesel Source');
    items.forEach(it => { it.v.source = bsource; });
    requireStockAt_(bsource, dk, shift, '', r2_(items.reduce((sum, it) => sum + it.v.qty, 0)));
    if (warnings.length && !b.force) return { ok: false, warnings: warnings };

    let n = nextDieselNo_(t);
    const created = new Date();
    const ids = [];
    const rows = items.map(it => {
      const id = 'DI-' + String(n++).padStart(6, '0');
      ids.push(id);
      return buildDieselRow_(t, id, dk, shift, it.m, it.v, created);
    });
    t.sh.getRange(t.sh.getLastRow() + 1, 1, rows.length, t.headers.length).setValues(rows);
    markDieselNo_(n - 1);

    // update Log Book rows that already exist for this Date + Shift
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const hasLog = {};
    lt.rows.forEach(r => { if (dkey_(r[lt.c[H.DATE]]) === dk && str_(r[lt.c[H.SHIFT]]) === shift) hasLog[noKey_(r[lt.c[H.NO]])] = true; });
    const done = {};
    items.forEach(it => {
      const k = noKey_(it.m.id);
      if (hasLog[k] && !done[k]) { done[k] = true; syncLogFromDiesel_(it.m.id, dk, shift); }
    });
    recalcBalances_();
    return { ok: true, count: rows.length, firstId: ids[0], lastId: ids[ids.length - 1], stock: getStock_() };
  });
}

// Edit one diesel issue. Issue ID and Created At stay the same.
function updateDieselIssue_(id, d) {
  return withLock_(() => {
    if (!blank_(d.meter)) ensureMeterCol_();
    const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
    const i = t.rows.findIndex(r => str_(r[t.c[H.ID]]) === str_(id));
    if (i === -1) throw new Error('Diesel issue ' + id + ' was not found.');
    const old = t.rows[i];
    const oldNo = str_(old[t.c[H.NO]]), oldDk = dkey_(old[t.c[H.IDATE]]), oldShift = str_(old[t.c[H.SHIFT]]);
    const created = old[t.c[H.CREATED]] instanceof Date ? old[t.c[H.CREATED]] : new Date();

    const dk = entryDate_(d.date);
    const shift = checkShift_(d.shift);
    const m = findMachine_(d.no);
    assertActive_(m, dk);
    const v = validateDiesel_(d, m);
    requireStockAt_(v.source, dk, shift, str_(id), v.qty); // the entry being edited is left out first

    if (!d.force) {
      const warn = neighbourWarnings_(t, i, m.id, dk, shift, created, v);
      if (warn.length) return { ok: false, warning: warn.join(' ') + ' Save anyway?' };
    }

    const row = buildDieselRow_(t, str_(id), dk, shift, m, v, created);
    t.headers.forEach((h, k) => { if (DIESEL_COLS_.indexOf(h) === -1 && h !== H.DMETER) row[k] = old[k]; }); // keep any extra columns (who entered it too)
    stampEdit_(row, t);                                                                                        // who changed it
    t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);

    syncLogFromDiesel_(m.id, dk, shift);
    if (!same_(oldNo, m.id) || oldDk !== dk || oldShift !== shift) syncLogFromDiesel_(oldNo, oldDk, oldShift);
    recalcBalances_();
    return { ok: true, id: str_(id), stock: getStock_() };
  });
}

function deleteDieselIssue_(id) {
  return withLock_(() => {
    const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
    const i = t.rows.findIndex(r => str_(r[t.c[H.ID]]) === str_(id));
    if (i === -1) throw new Error('Diesel issue ' + id + ' was not found.');
    const old = t.rows[i];
    t.sh.deleteRow(i + 2);
    syncLogFromDiesel_(str_(old[t.c[H.NO]]), dkey_(old[t.c[H.IDATE]]), str_(old[t.c[H.SHIFT]]));
    recalcBalances_();
    return { ok: true, stock: getStock_() };
  });
}

// For an edited entry: reading should not be below the entry before it or above the entry after it.
function neighbourWarnings_(t, skip, no, dk, shift, created, v) {
  const key = r => [dkey_(r[t.c[H.IDATE]]), shiftOrder_(str_(r[t.c[H.SHIFT]])),
    r[t.c[H.CREATED]] instanceof Date ? r[t.c[H.CREATED]].getTime() : 0];
  const cmp = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] - b[1]) || (a[2] - b[2]));
  const me = [dk, shiftOrder_(shift), created.getTime()];
  let prev = null, next = null;
  t.rows.forEach((r, k) => {
    if (k === skip || !same_(r[t.c[H.NO]], no)) return;
    const kk = key(r);
    if (cmp(kk, me) < 0) { if (!prev || cmp(kk, key(prev)) > 0) prev = r; }
    else if (!next || cmp(kk, key(next)) < 0) next = r;
  });
  const w = [];
  const chk = (val, col, label) => {
    if (val === '') return;
    const p = prev ? numOrBlank_(prev[t.c[col]]) : '';
    const n = next ? numOrBlank_(next[t.c[col]]) : '';
    if (p !== '' && val < p) w.push(label + ' ' + val + ' is less than the earlier ' + label + ' ' + p + '.');
    if (n !== '' && val > n) w.push(label + ' ' + val + ' is more than the later ' + label + ' ' + n + '.');
  };
  chk(v.km, H.KMR, 'KM Reading');
  chk(v.hr, H.HRR, 'Hrs Reading');
  return w;
}

// Filtered list of diesel issues, newest first.
// f: { from, to, no, shift, owner, driver, q }  (all optional; q searches Issue ID and Remark)
function getDieselIssues_(f) {
  f = f || {};
  if (typeof f === 'string') f = { from: f, to: f };
  const checks = {}; // dispenser reading check no longer used (the KM / Hrs reading is the reading at the fill)
  const from = str_(f.from) ? checkDate_(f.from) : '';
  const to = str_(f.to) ? checkDate_(f.to) : '';
  if (from && to && from > to) throw new Error('From date is after To date.');
  const noK = noKey_(f.no);
  const shift = str_(f.shift);
  const owner = clean_(f.owner).toUpperCase();
  const driver = clean_(f.driver).toUpperCase();
  const q = clean_(f.q).toUpperCase();
  const src = str_(f.source);
  const LIMIT = 500;

  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const c = t.c;
  const hits = [];
  let totalQty = 0;
  t.rows.forEach(r => {
    const dk = dkey_(r[c[H.IDATE]]);
    if (!dk || (from && dk < from) || (to && dk > to)) return;
    if (noK && noKey_(r[c[H.NO]]).indexOf(noK) === -1) return;
    if (shift && str_(r[c[H.SHIFT]]) !== shift) return;
    if (src && loc_(r[c[H.SOURCE]]) !== src) return;
    if (owner && str_(r[c[H.OWNER]]).toUpperCase().indexOf(owner) === -1) return;
    if (driver && str_(r[c[H.DRIVER]]).toUpperCase().indexOf(driver) === -1) return;
    if (q && (str_(r[c[H.ID]]) + ' ' + str_(r[c[H.REMARK]])).toUpperCase().indexOf(q) === -1) return;
    totalQty += num0_(r[c[H.QTY]]);
    hits.push(r);
  });
  hits.sort((a, b) => {
    const da = dkey_(a[c[H.IDATE]]), db = dkey_(b[c[H.IDATE]]);
    if (da !== db) return da < db ? 1 : -1;
    const s = shiftOrder_(str_(b[c[H.SHIFT]])) - shiftOrder_(str_(a[c[H.SHIFT]]));
    if (s) return s;
    return str_(b[c[H.ID]]).localeCompare(str_(a[c[H.ID]]));
  });
  // share of every machinery in the diesel of these dates / filters (for the % view)
  const share = {};
  hits.forEach(r => {
    const k = noKey_(r[c[H.NO]]);
    const x = share[k] = share[k] || { no: str_(r[c[H.NO]]), type: str_(r[c[H.TYPE]]), owner: str_(r[c[H.OWNER]]), qty: 0, entries: 0 };
    x.qty = r2_(x.qty + num0_(r[c[H.QTY]])); x.entries++;
  });
  return {
    count: hits.length,
    totalQty: r2_(totalQty),
    share: Object.keys(share).map(k => share[k]).sort((a, b) => b.qty - a.qty),
    rows: hits.slice(0, f.all ? hits.length : LIMIT).map(r => ({
      id: str_(r[c[H.ID]]), date: dkey_(r[c[H.IDATE]]), shift: str_(r[c[H.SHIFT]]), no: str_(r[c[H.NO]]),
      type: str_(r[c[H.TYPE]]), owner: str_(r[c[H.OWNER]]), qty: numOrBlank_(r[c[H.QTY]]),
      kmReading: numOrBlank_(r[c[H.KMR]]), hrReading: numOrBlank_(r[c[H.HRR]]), remark: str_(r[c[H.REMARK]]),
      driver: str_(r[c[H.DRIVER]]), balance: H.BAL in c ? numOrBlank_(r[c[H.BAL]]) : '', source: loc_(r[c[H.SOURCE]]), supply: str_(r[c[H.SUPPLY]]),
      meter: H.DMETER in c ? numOrBlank_(r[c[H.DMETER]]) : '', meterCheck: checks[str_(r[c[H.ID]])] || null,
      enteredBy: H.EBY in c ? str_(r[c[H.EBY]]) : '', updatedBy: H.UBY in c ? str_(r[c[H.UBY]]) : '',
    })),
  };
}

/* ================= DIESEL STOCK: locations, inward, transfer ================= *
 * Stock points: APP.LOCATIONS (Dispenser, VTR Store).
 *   Inward (pump)        : + at its Location (default Dispenser)
 *   Transfer             : - at From, + at To (e.g. Dispenser -> VTR Store)
 *   Diesel Issue         : - at its Diesel Source
 * Order on one date: first all Inward, then the Day shift, then the Night shift.
 * Inside a shift, transfers and issues follow the order they were entered. Every balance follows this one order.
 */
const INWARD_COLS_ = [H.IN_ID, H.DATE, H.IN_QTY, H.PUMP, H.RATE, H.AMOUNT, H.BILLNO, H.BILLDATE, H.CREATED, H.LOC];
const TRANSFER_COLS_ = [H.TR_ID, H.DATE, H.SHIFT, H.FROM, H.TO, H.IN_QTY, H.REMARK, H.CREATED];
const KIND_ORDER_ = { inward: 0, tout: 1, tin: 2, issue: 3 };

function loc_(v) {
  const s = clean_(v);
  if (!s) return APP.MAIN_LOC;
  return APP.LOCATIONS.find(l => l.toUpperCase() === s.toUpperCase()) || s;
}
function checkLoc_(v, label) {
  const s = clean_(v);
  const f = APP.LOCATIONS.find(l => l.toUpperCase() === s.toUpperCase());
  if (!f) throw new Error('Select ' + label + ' (' + APP.LOCATIONS.join(' / ') + ').');
  return f;
}

function stockTables_() {
  return {
    dt: table_(APP.SHEET_DIESEL, DIESEL_COLS_),
    it: table_(APP.SHEET_INWARD, INWARD_COLS_),
    tt: table_(APP.SHEET_TRANSFER, TRANSFER_COLS_),
  };
}
// Copy of the tables with one sheet's rows changed (for "what if" checks before saving)
function withRows_(T, which, rows) { const c = Object.assign({}, T); c[which] = Object.assign({}, T[which], { rows: rows }); return c; }

const OPENING_PUMP_ = 'Opening Stock';
const isOpeningPump_ = p => str_(p).toUpperCase().replace(/\s+/g, ' ') === 'OPENING STOCK';
// Extra diesel: more diesel found than the entries show (e.g. 100 L issued but only 99 L went out) – added as inward
const EXTRA_PUMP_ = 'Extra Diesel';
const isExtraPump_ = p => str_(p).toUpperCase().replace(/\s+/g, ' ') === 'EXTRA DIESEL';
// an Opening Stock entry belongs to the opening of any period that starts on or after its date
const isOpenBefore_ = (e, from) => !!e.open && (!from || e.dk <= from);
function events_(T) {
  const ev = [];
  const ct = v => v instanceof Date ? v.getTime() : 0;
  const it = T.it, tt = T.tt, dt = T.dt;
  it.rows.forEach((r, i) => {
    const dk = dkey_(r[it.c[H.DATE]]); if (!dk) return;
    const open = isOpeningPump_(r[it.c[H.PUMP]]);
    ev.push({ key: 'N' + i, kind: 'inward', open: open, idx: i, loc: loc_(r[it.c[H.LOC]]), dk: dk, ord: open ? -1 : 0, ct: ct(r[it.c[H.CREATED]]), q: num0_(r[it.c[H.IN_QTY]]) });
  });
  tt.rows.forEach((r, i) => {
    const dk = dkey_(r[tt.c[H.DATE]]); if (!dk) return;
    const ord = 2 + 2 * shiftOrder_(str_(r[tt.c[H.SHIFT]])), c = ct(r[tt.c[H.CREATED]]), q = num0_(r[tt.c[H.IN_QTY]]);
    ev.push({ key: 'TO' + i, kind: 'tout', idx: i, loc: loc_(r[tt.c[H.FROM]]), dk: dk, ord: ord, ct: c, q: -q });
    ev.push({ key: 'TI' + i, kind: 'tin', idx: i, loc: loc_(r[tt.c[H.TO]]), dk: dk, ord: ord, ct: c, q: q });
  });
  dt.rows.forEach((r, i) => {
    const dk = dkey_(r[dt.c[H.IDATE]]); if (!dk) return;
    ev.push({ key: 'I' + i, kind: 'issue', idx: i, loc: loc_(r[dt.c[H.SOURCE]]), dk: dk,
      ord: 2 + 2 * shiftOrder_(str_(r[dt.c[H.SHIFT]])), ct: ct(r[dt.c[H.CREATED]]), q: -num0_(r[dt.c[H.QTY]]) });
  });
  ev.sort(cmpEvent_);
  const run = {};
  let tot = 0;
  ev.forEach(e => { run[e.loc] = r2_((run[e.loc] || 0) + e.q); e.bal = run[e.loc]; tot = r2_(tot + e.q); e.tot = tot; });
  ev.run = run;
  return ev;
}
function cmpEvent_(a, b) {
  if (a.dk !== b.dk) return a.dk < b.dk ? -1 : 1;
  return (a.ord - b.ord) || (a.ct - b.ct) || (KIND_ORDER_[a.kind] - KIND_ORDER_[b.kind]) || (a.idx - b.idx);
}
// Stock of one location just before a point, and the most that can be taken out there
// without any later balance of that location going below zero.
function availableAt_(ev, loc, point) {
  let before = 0, minAfter = null;
  ev.forEach(e => {
    if (e.loc !== loc) return;
    if (cmpEvent_(e, point) < 0) before = e.bal;
    else minAfter = minAfter === null ? e.bal : Math.min(minAfter, e.bal);
  });
  return { balance: r2_(before), available: r2_(Math.max(0, minAfter === null ? before : Math.min(before, minAfter))) };
}
// A change must not push any balance below zero (balances that were already negative may not get worse).
function assertNoNegative_(T, T2) {
  const before = {};
  events_(T).forEach(e => { before[e.key] = e.bal; });
  const bad = events_(T2).find(e => e.bal < -0.005 && (before[e.key] === undefined || e.bal < before[e.key] - 0.005));
  if (bad) {
    const p = bad.dk.split('-');
    // name the entry at which the stock would go below zero
    let what = '';
    try {
      if (bad.kind === 'issue') { const r = T2.dt.rows[bad.idx], c = T2.dt.c; what = ' – at diesel issue ' + str_(r[c[H.ID]]) + ' (' + str_(r[c[H.NO]]) + ', ' + num0_(r[c[H.QTY]]) + ' Ltr, ' + str_(r[c[H.SHIFT]]) + ' shift)'; }
      else if (bad.kind === 'tout') { const r = T2.tt.rows[bad.idx], c = T2.tt.c; what = ' – at transfer ' + str_(r[c[H.TR_ID]]) + ' (' + num0_(r[c[H.IN_QTY]]) + ' Ltr to ' + loc_(r[c[H.TO]]) + ')'; }
    } catch (e) { what = ''; }
    throw new Error('Not enough diesel at ' + bad.loc + ': on ' + p[2] + '-' + p[1] + '-' + p[0] + ' the balance would become ' + bad.bal + ' Ltr' + what + '.');
  }
}
function stockFrom_(T, ev) {
  ev = ev || events_(T);
  const byLoc = {};
  APP.LOCATIONS.forEach(l => { byLoc[l] = r2_(ev.run[l] || 0); });
  let inward = 0, issued = 0;
  ev.forEach(e => { if (e.kind === 'inward') inward += e.q; if (e.kind === 'issue') issued -= e.q; });
  const total = r2_(Object.keys(ev.run).reduce((s, k) => s + ev.run[k], 0));
  return { stock: total, byLoc: byLoc, inward: r2_(inward), issued: r2_(issued) };
}
function getStock_() { return stockFrom_(stockTables_()); }

function issuePoint_(dk, shift, ct) { return { dk: dk, ord: 2 + 2 * shiftOrder_(shift), ct: ct, kind: 'issue', idx: Number.MAX_SAFE_INTEGER }; }

// Stock at one source for a diesel issue on this date and shift (excludeId = the issue being edited)
function getIssueBalance_(dateStr, shiftIn, excludeId, source) {
  const dk = checkDate_(dateStr), shift = checkShift_(shiftIn), loc = checkLoc_(source || APP.MAIN_LOC, 'Diesel Source');
  const T = stockTables_();
  const ex = str_(excludeId);
  let ct = Number.MAX_SAFE_INTEGER, T2 = T;
  if (ex) {
    const i = T.dt.rows.findIndex(r => str_(r[T.dt.c[H.ID]]) === ex);
    if (i > -1) {
      if (T.dt.rows[i][T.dt.c[H.CREATED]] instanceof Date) ct = T.dt.rows[i][T.dt.c[H.CREATED]].getTime();
      T2 = withRows_(T, 'dt', T.dt.rows.filter((r, k) => k !== i));
    }
  }
  const b = availableAt_(events_(T2), loc, issuePoint_(dk, shift, ct));
  b.loc = loc;
  b.stock = stockFrom_(T);
  return b;
}

// stock of a location just before several date + shift points (one call for a whole grid)
function getStockPoints_(points) {
  const ev = events_(stockTables_());
  return (points || []).slice(0, 400).map(p => {
    try {
      const dk = checkDate_(p.date), shift = checkShift_(p.shift || 'Day'), loc = checkLoc_(p.source || APP.MAIN_LOC, 'Diesel Source');
      const b = availableAt_(ev, loc, issuePoint_(dk, shift, Number.MAX_SAFE_INTEGER));
      return { balance: b.balance, available: b.available };
    } catch (e) { return null; }
  });
}
function requireStockAt_(loc, dk, shift, excludeId, qty) {
  const b = getIssueBalance_(dk, shift, excludeId, loc);
  if (qty > b.available) {
    const p = dk.split('-');
    throw new Error('Not enough diesel at ' + loc + ' for ' + p[2] + '-' + p[1] + '-' + p[0] + ' (' + shift + '). Available: ' +
      b.available + ' Ltr, you are issuing: ' + r2_(qty) + ' Ltr.');
  }
}

// Writes running balances into the sheets (only columns that exist):
// Diesel Issue "Balance", Diesel Inward "Balance", Diesel Transfer "From Balance" / "To Balance".
function recalcBalances_() {
  const T = stockTables_();
  const ev = events_(T);
  const put = (tab, header, kind) => {
    if (!(header in tab.c) || !tab.rows.length) return;
    const want = tab.rows.map(r => r[tab.c[header]]);
    ev.forEach(e => { if (e.kind === kind) want[e.idx] = e.bal; });
    const changed = [];
    want.forEach((v, i) => { if (String(v) !== String(tab.rows[i][tab.c[header]])) changed.push(i); });
    if (!changed.length) return;
    if (changed.length > 20) tab.sh.getRange(2, tab.c[header] + 1, want.length, 1).setValues(want.map(v => [v]));
    else changed.forEach(i => tab.sh.getRange(i + 2, tab.c[header] + 1).setValue(want[i]));
  };
  put(T.dt, H.BAL, 'issue');
  put(T.it, H.BAL, 'inward');
  put(T.tt, H.FROMBAL, 'tout');
  put(T.tt, H.TOBAL, 'tin');
}

function nextNo_(t, idHeader, prop) {
  const p = PropertiesService.getScriptProperties();
  let max = Number(p.getProperty(prop) || 0);
  t.rows.forEach(r => { const mt = String(r[t.c[idHeader]]).match(/(\d+)$/); if (mt) max = Math.max(max, Number(mt[1])); });
  return max + 1;
}
function markNo_(prop, n) { PropertiesService.getScriptProperties().setProperty(prop, String(n)); }

/* ---------- Inward (from pump) ---------- */
function validateInward_(x) {
  const dk = entryDate_(x.date);
  const qty = numOrBlank_(x.qty);
  if (!(qty > 0)) throw new Error('Enter Qty (Ltr).');
  if (x.type === 'extra' || isExtraPump_(x.pump)) {
    const rate = numOrBlank_(x.rate);
    if (rate !== '' && rate < 0) throw new Error('Rate cannot be below zero.');
    const r = rate === '' ? 0 : rate;
    return { dk: dk, qty: qty, pump: EXTRA_PUMP_, rate: r, amount: r2_(qty * r), billNo: clean_(x.billNo), billDate: '', extra: true,
      loc: checkLoc_(x.location || APP.MAIN_LOC, 'Location') };
  }
  if (x.type === 'opening' || isOpeningPump_(x.pump)) {
    const rate = numOrBlank_(x.rate);
    if (rate !== '' && rate < 0) throw new Error('Rate cannot be below zero.');
    const r = rate === '' ? 0 : rate;
    return { dk: dk, qty: qty, pump: OPENING_PUMP_, rate: r, amount: r2_(qty * r), billNo: '', billDate: '', open: true,
      loc: checkLoc_(x.location || APP.MAIN_LOC, 'Location') };
  }
  const pump = clean_(x.pump);
  if (!pump) throw new Error('Enter the Pump Name.');
  const rate = numOrBlank_(x.rate);
  if (!(rate > 0)) throw new Error('Enter the Rate.');
  const billDate = str_(x.billDate) ? entryDate_(x.billDate) : '';
  return { dk: dk, qty: qty, pump: pump, rate: rate, amount: r2_(qty * rate), billNo: clean_(x.billNo), billDate: billDate,
    loc: checkLoc_(x.location || APP.MAIN_LOC, 'Received at') };
}
function buildInwardRow_(t, id, v, created, base) {
  const row = base ? stampEdit_(base.slice(), t) : newRow_(t);
  set_(row, t, H.IN_ID, id);
  set_(row, t, H.DATE, toDate_(v.dk));
  set_(row, t, H.IN_QTY, v.qty);
  set_(row, t, H.PUMP, v.pump);
  set_(row, t, H.RATE, v.rate);
  set_(row, t, H.AMOUNT, v.amount);
  set_(row, t, H.BILLNO, v.billNo);
  set_(row, t, H.BILLDATE, v.billDate ? toDate_(v.billDate) : '');
  set_(row, t, H.CREATED, created);
  set_(row, t, H.LOC, v.loc);
  return row;
}
/* Import many inward entries at once (from an Excel / CSV file checked in the app).
 * All rows are checked first; if any row has a problem nothing is saved and every problem is listed.
 * A row whose Bill Number (with the same pump) is already in the sheet – or twice in the file – is refused,
 * so the same file cannot be imported twice by mistake. */
function importInward_(rows) {
  return withLock_(() => {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) throw new Error('The file has no rows to import.');
    if (rows.length > 1000) throw new Error('Import up to 1,000 rows at a time.');
    const T = stockTables_(), c = T.it.c;
    const seen = {};
    T.it.rows.forEach(r => { const b = str_(r[c[H.BILLNO]]).toUpperCase(); if (b) seen[b + '|' + str_(r[c[H.PUMP]]).toUpperCase()] = str_(r[c[H.IN_ID]]); });
    const errors = [], ok = [];
    rows.forEach((x, i) => {
      try {
        const v = validateInward_(x || {});
        if (v.open) throw new Error('Opening stock cannot be imported – enter it with "Opening stock" on the Diesel Inward page.');
        if (v.extra) throw new Error('Extra diesel cannot be imported – enter it with "Extra diesel" on the Diesel Inward page.');
        if (v.billNo) {
          const k = v.billNo.toUpperCase() + '|' + v.pump.toUpperCase();
          if (seen[k]) throw new Error('Bill ' + v.billNo + ' of ' + v.pump + ' is already entered' + (seen[k] === 'file' ? ' earlier in this file.' : ' (' + seen[k] + ').'));
          seen[k] = 'file';
        }
        ok.push(v);
      } catch (e) { errors.push({ row: Number((x && x.line) || i + 1), msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    let n = nextNo_(T.it, H.IN_ID, 'INWARD_LAST_NO');
    const now = new Date(), ids = [];
    const out = ok.map(v => { const id = 'IN-' + String(n++).padStart(6, '0'); ids.push(id); return buildInwardRow_(T.it, id, v, now); });
    T.it.sh.getRange(T.it.sh.getLastRow() + 1, 1, out.length, T.it.headers.length).setValues(out);
    markNo_('INWARD_LAST_NO', n - 1);
    recalcBalances_();
    return { ok: true, count: out.length, ids: ids, qty: r2_(ok.reduce((a, v) => a + v.qty, 0)), stock: getStock_() };
  });
}
/* Opening stock: one per location, and it must be the first entry of that location */
function checkOpening_(T, v, selfId) {
  if (!v.open) return;
  const c = T.it.c;
  const other = T.it.rows.find(r => isOpeningPump_(r[c[H.PUMP]]) && loc_(r[c[H.LOC]]) === v.loc && str_(r[c[H.IN_ID]]) !== str_(selfId || ''));
  if (other) throw new Error('Opening stock of ' + v.loc + ' is already entered (' + str_(other[c[H.IN_ID]]) + ', ' + dmy_(dkey_(other[c[H.DATE]])) + '). Edit that entry instead.');
  const earlier = events_(T).find(e => e.loc === v.loc && e.dk < v.dk && !(e.kind === 'inward' && str_(T.it.rows[e.idx][c[H.IN_ID]]) === str_(selfId || '')));
  if (earlier) throw new Error(v.loc + ' already has entries before ' + dmy_(v.dk) + ' (first on ' + dmy_(earlier.dk) + '). The opening stock must be on or before the first entry.');
}
function saveInward_(x) {
  return withLock_(() => {
    const v = validateInward_(x);
    const T = stockTables_();
    checkOpening_(T, v, '');
    const n = nextNo_(T.it, H.IN_ID, 'INWARD_LAST_NO');
    const id = 'IN-' + String(n).padStart(6, '0');
    T.it.sh.appendRow(buildInwardRow_(T.it, id, v, new Date()));
    markNo_('INWARD_LAST_NO', n);
    recalcBalances_();
    return { ok: true, id: id, stock: getStock_() };
  });
}
function updateInward_(id, x) {
  return withLock_(() => {
    const v = validateInward_(x);
    const T = stockTables_();
    checkOpening_(T, v, id);
    const i = T.it.rows.findIndex(r => str_(r[T.it.c[H.IN_ID]]) === str_(id));
    if (i === -1) throw new Error('Inward ' + id + ' was not found.');
    const old = T.it.rows[i];
    const row = buildInwardRow_(T.it, str_(id), v, old[T.it.c[H.CREATED]] instanceof Date ? old[T.it.c[H.CREATED]] : new Date(), old);
    const rows = T.it.rows.slice(); rows[i] = row;
    try { assertNoNegative_(T, withRows_(T, 'it', rows)); }
    catch (e) {
      const oldDk = dkey_(old[T.it.c[H.DATE]]);
      throw new Error(e.message + (v.dk > oldDk ? ' That diesel was already issued from this inward before ' + dmy_(v.dk) +
        '. Keep the date the diesel actually reached the tank (the Bill Date can be a different date), or first correct those entries.' :
        ' Less diesel on this inward than what was already issued from it.'));
    }
    T.it.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    recalcBalances_();
    return { ok: true, id: str_(id), stock: getStock_() };
  });
}
function deleteInward_(id) {
  return withLock_(() => {
    const T = stockTables_();
    const i = T.it.rows.findIndex(r => str_(r[T.it.c[H.IN_ID]]) === str_(id));
    if (i === -1) throw new Error('Inward ' + id + ' was not found.');
    assertNoNegative_(T, withRows_(T, 'it', T.it.rows.filter((r, k) => k !== i)));
    T.it.sh.deleteRow(i + 2);
    recalcBalances_();
    return { ok: true, stock: getStock_() };
  });
}
// f: { from, to, pump, bill, location } – all optional, blank = all
function getInwards_(f) {
  f = f || {};
  const from = str_(f.from) ? checkDate_(f.from) : '';
  const to = str_(f.to) ? checkDate_(f.to) : '';
  if (from && to && from > to) throw new Error('From date is after To date.');
  const pump = clean_(f.pump).toUpperCase(), bill = clean_(f.bill).toUpperCase(), loc = str_(f.location);
  const t = table_(APP.SHEET_INWARD, INWARD_COLS_);
  const c = t.c;
  const hits = [];
  let qty = 0, amount = 0;
  t.rows.forEach(r => {
    const dk = dkey_(r[c[H.DATE]]);
    if (!dk || (from && dk < from) || (to && dk > to)) return;
    if (loc && loc_(r[c[H.LOC]]) !== loc) return;
    if (pump && str_(r[c[H.PUMP]]).toUpperCase().indexOf(pump) === -1) return;
    if (bill && (str_(r[c[H.BILLNO]]) + ' ' + str_(r[c[H.IN_ID]])).toUpperCase().indexOf(bill) === -1) return;
    qty += num0_(r[c[H.IN_QTY]]); amount += num0_(r[c[H.AMOUNT]]);
    hits.push(r);
  });
  hits.sort((a, b) => {
    const da = dkey_(a[c[H.DATE]]), db = dkey_(b[c[H.DATE]]);
    return da !== db ? (da < db ? 1 : -1) : str_(b[c[H.IN_ID]]).localeCompare(str_(a[c[H.IN_ID]]));
  });
  return {
    count: hits.length, qty: r2_(qty), amount: r2_(amount), stock: getStock_(),
    rows: (f.all ? hits : hits.slice(0, 500)).map(r => ({
      id: str_(r[c[H.IN_ID]]), date: dkey_(r[c[H.DATE]]), qty: numOrBlank_(r[c[H.IN_QTY]]), pump: str_(r[c[H.PUMP]]),
      rate: numOrBlank_(r[c[H.RATE]]), amount: numOrBlank_(r[c[H.AMOUNT]]), billNo: str_(r[c[H.BILLNO]]),
      billDate: r[c[H.BILLDATE]] === '' ? '' : dkey_(r[c[H.BILLDATE]]), location: loc_(r[c[H.LOC]]),
      balance: H.BAL in c ? numOrBlank_(r[c[H.BAL]]) : '', open: isOpeningPump_(r[c[H.PUMP]]), extra: isExtraPump_(r[c[H.PUMP]]),
      enteredBy: H.EBY in c ? str_(r[c[H.EBY]]) : '', updatedBy: H.UBY in c ? str_(r[c[H.UBY]]) : '',
    })),
  };
}
function getPumps_() {
  const t = table_(APP.SHEET_INWARD, [H.PUMP]);
  const names = {};
  t.rows.forEach(r => { const v = str_(r[t.c[H.PUMP]]); if (v) names[v.toUpperCase()] = v; });
  return Object.keys(names).map(k => names[k]).sort();
}

/* ---------- Transfer between stock points (e.g. Dispenser -> VTR Store) ---------- */
function validateTransfer_(x) {
  const dk = entryDate_(x.date);
  const shift = checkShift_(x.shift);
  const from = checkLoc_(x.from, 'From');
  const to = checkLoc_(x.to, 'To');
  if (from === to) throw new Error('From and To cannot be the same.');
  const qty = numOrBlank_(x.qty);
  if (!(qty > 0)) throw new Error('Enter Qty (Ltr).');
  return { dk: dk, shift: shift, from: from, to: to, qty: qty, remark: clean_(x.remark) };
}
function buildTransferRow_(t, id, v, created, base) {
  const row = base ? stampEdit_(base.slice(), t) : newRow_(t);
  set_(row, t, H.TR_ID, id);
  set_(row, t, H.DATE, toDate_(v.dk));
  set_(row, t, H.SHIFT, v.shift);
  set_(row, t, H.FROM, v.from);
  set_(row, t, H.TO, v.to);
  set_(row, t, H.IN_QTY, v.qty);
  set_(row, t, H.REMARK, v.remark);
  set_(row, t, H.CREATED, created);
  return row;
}
function transferMessage_(T, v, excludeIdx) {
  const T2 = excludeIdx === undefined ? T : withRows_(T, 'tt', T.tt.rows.filter((r, k) => k !== excludeIdx));
  const b = availableAt_(events_(T2), v.from, { dk: v.dk, ord: 2 + 2 * shiftOrder_(v.shift), ct: Number.MAX_SAFE_INTEGER, kind: 'tout', idx: Number.MAX_SAFE_INTEGER });
  if (v.qty > b.available) {
    const p = v.dk.split('-');
    throw new Error('Not enough diesel at ' + v.from + ' for ' + p[2] + '-' + p[1] + '-' + p[0] + ' (' + v.shift + '). Available: ' +
      b.available + ' Ltr, you are transferring: ' + v.qty + ' Ltr.');
  }
}
/* Many transfers at once – the "Multiple entries" grid and Import from Excel.
 * Every row is checked (dates, locations, qty) and the stock is checked with all of them together, in date order:
 * no location may go below zero at any moment. If anything is wrong nothing is saved and every problem is listed. */
function saveTransferBulk_(rows) {
  return withLock_(() => {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) throw new Error('No rows to save.');
    if (rows.length > 1000) throw new Error('Save up to 1,000 rows at a time.');
    const T = stockTables_();
    const errors = [], ok = [];
    rows.forEach((x, i) => {
      try { ok.push({ line: Number((x && x.line) || i + 1), v: validateTransfer_(x || {}) }); }
      catch (e) { errors.push({ row: Number((x && x.line) || i + 1), msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    let n = nextNo_(T.tt, H.TR_ID, 'TRANSFER_LAST_NO');
    const now = Date.now(), ids = [];
    const out = ok.map((o, k) => { const id = 'TR-' + String(n++).padStart(6, '0'); ids.push(id); return buildTransferRow_(T.tt, id, o.v, new Date(now + k)); });
    // stock with all new rows together: find the first moment a location would go below zero
    try { assertNoNegative_(T, withRows_(T, 'tt', T.tt.rows.concat(out))); }
    catch (e) {
      // say which row: check them one by one in date order
      const order = ok.map((o, k) => ({ o: o, row: out[k] })).sort((a, b) => a.o.v.dk < b.o.v.dk ? -1 : a.o.v.dk > b.o.v.dk ? 1 : shiftOrder_(a.o.v.shift) - shiftOrder_(b.o.v.shift));
      const acc = T.tt.rows.slice();
      for (const x of order) {
        acc.push(x.row);
        try { assertNoNegative_(T, withRows_(T, 'tt', acc)); } catch (e2) { return { ok: false, errors: [{ row: x.o.line, msg: e2.message }] }; }
      }
      return { ok: false, errors: [{ row: 0, msg: e.message }] };
    }
    T.tt.sh.getRange(T.tt.sh.getLastRow() + 1, 1, out.length, T.tt.headers.length).setValues(out);
    markNo_('TRANSFER_LAST_NO', n - 1);
    recalcBalances_();
    return { ok: true, count: out.length, ids: ids, qty: r2_(ok.reduce((a, o) => a + o.v.qty, 0)), stock: getStock_() };
  });
}
function saveTransfer_(x) {
  return withLock_(() => {
    const v = validateTransfer_(x);
    const T = stockTables_();
    transferMessage_(T, v);
    const n = nextNo_(T.tt, H.TR_ID, 'TRANSFER_LAST_NO');
    const id = 'TR-' + String(n).padStart(6, '0');
    const row = buildTransferRow_(T.tt, id, v, new Date());
    assertNoNegative_(T, withRows_(T, 'tt', T.tt.rows.concat([row])));
    T.tt.sh.appendRow(row);
    markNo_('TRANSFER_LAST_NO', n);
    recalcBalances_();
    return { ok: true, id: id, stock: getStock_() };
  });
}
function updateTransfer_(id, x) {
  return withLock_(() => {
    const v = validateTransfer_(x);
    const T = stockTables_();
    const i = T.tt.rows.findIndex(r => str_(r[T.tt.c[H.TR_ID]]) === str_(id));
    if (i === -1) throw new Error('Transfer ' + id + ' was not found.');
    transferMessage_(T, v, i);
    const old = T.tt.rows[i];
    const row = buildTransferRow_(T.tt, str_(id), v, old[T.tt.c[H.CREATED]] instanceof Date ? old[T.tt.c[H.CREATED]] : new Date(), old);
    const rows = T.tt.rows.slice(); rows[i] = row;
    assertNoNegative_(T, withRows_(T, 'tt', rows));
    T.tt.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    recalcBalances_();
    return { ok: true, id: str_(id), stock: getStock_() };
  });
}
function deleteTransfer_(id) {
  return withLock_(() => {
    const T = stockTables_();
    const i = T.tt.rows.findIndex(r => str_(r[T.tt.c[H.TR_ID]]) === str_(id));
    if (i === -1) throw new Error('Transfer ' + id + ' was not found.');
    assertNoNegative_(T, withRows_(T, 'tt', T.tt.rows.filter((r, k) => k !== i)));
    T.tt.sh.deleteRow(i + 2);
    recalcBalances_();
    return { ok: true, stock: getStock_() };
  });
}
// Stock at From and To for a transfer on this date and shift (excludeId = the transfer being edited)
function getTransferBalance_(dateStr, shiftIn, from, to, excludeId) {
  const dk = checkDate_(dateStr), shift = checkShift_(shiftIn);
  const f = checkLoc_(from, 'From'), tLoc = checkLoc_(to, 'To');
  const T = stockTables_();
  const i = str_(excludeId) ? T.tt.rows.findIndex(r => str_(r[T.tt.c[H.TR_ID]]) === str_(excludeId)) : -1;
  const T2 = i > -1 ? withRows_(T, 'tt', T.tt.rows.filter((r, k) => k !== i)) : T;
  const ev = events_(T2);
  const pt = kind => ({ dk: dk, ord: 2 + 2 * shiftOrder_(shift), ct: Number.MAX_SAFE_INTEGER, kind: kind, idx: Number.MAX_SAFE_INTEGER });
  return { from: availableAt_(ev, f, pt('tout')), to: availableAt_(ev, tLoc, pt('tin')), stock: stockFrom_(T) };
}
// f: { from, to, location, q } – blank = all
function getTransfers_(f) {
  f = f || {};
  const from = str_(f.from) ? checkDate_(f.from) : '';
  const to = str_(f.to) ? checkDate_(f.to) : '';
  if (from && to && from > to) throw new Error('From date is after To date.');
  const loc = str_(f.location), q = clean_(f.q).toUpperCase();
  const t = table_(APP.SHEET_TRANSFER, TRANSFER_COLS_);
  const c = t.c;
  const hits = [];
  let qty = 0;
  t.rows.forEach(r => {
    const dk = dkey_(r[c[H.DATE]]);
    if (!dk || (from && dk < from) || (to && dk > to)) return;
    if (loc && loc_(r[c[H.FROM]]) !== loc && loc_(r[c[H.TO]]) !== loc) return;
    if (q && (str_(r[c[H.TR_ID]]) + ' ' + str_(r[c[H.REMARK]])).toUpperCase().indexOf(q) === -1) return;
    qty += num0_(r[c[H.IN_QTY]]);
    hits.push(r);
  });
  hits.sort((a, b) => {
    const da = dkey_(a[c[H.DATE]]), db = dkey_(b[c[H.DATE]]);
    if (da !== db) return da < db ? 1 : -1;
    return shiftOrder_(str_(b[c[H.SHIFT]])) - shiftOrder_(str_(a[c[H.SHIFT]])) || str_(b[c[H.TR_ID]]).localeCompare(str_(a[c[H.TR_ID]]));
  });
  return {
    count: hits.length, qty: r2_(qty), stock: getStock_(),
    rows: (f.all ? hits : hits.slice(0, 500)).map(r => ({
      id: str_(r[c[H.TR_ID]]), date: dkey_(r[c[H.DATE]]), shift: str_(r[c[H.SHIFT]]), from: loc_(r[c[H.FROM]]), to: loc_(r[c[H.TO]]),
      qty: numOrBlank_(r[c[H.IN_QTY]]), remark: str_(r[c[H.REMARK]]),
      fromBal: H.FROMBAL in c ? numOrBlank_(r[c[H.FROMBAL]]) : '', toBal: H.TOBAL in c ? numOrBlank_(r[c[H.TOBAL]]) : '',
      enteredBy: H.EBY in c ? str_(r[c[H.EBY]]) : '', updatedBy: H.UBY in c ? str_(r[c[H.UBY]]) : '',
    })),
  };
}

/* ---------- Stock position per location for a period, and day-wise ledger ---------- */
function stockSummary_(ev, from, to) {
  const out = {};
  APP.LOCATIONS.forEach(l => { out[l] = { loc: l, opening: 0, inward: 0, tin: 0, tout: 0, issued: 0, closing: 0 }; });
  ev.forEach(e => {
    const x = out[e.loc] || (out[e.loc] = { loc: e.loc, opening: 0, inward: 0, tin: 0, tout: 0, issued: 0, closing: 0 });
    if ((from && e.dk < from) || isOpenBefore_(e, from)) { x.opening = e.bal; x.closing = e.bal; return; }
    if (to && e.dk > to) return;
    if (e.kind === 'inward') x.inward += e.q; else if (e.kind === 'tin') x.tin += e.q;
    else if (e.kind === 'tout') x.tout -= e.q; else x.issued -= e.q;
    x.closing = e.bal;
  });
  return Object.keys(out).map(k => {
    const x = out[k];
    ['opening', 'inward', 'tin', 'tout', 'issued', 'closing'].forEach(f => { x[f] = r2_(x[f]); });
    x.current = r2_(ev.run[k] || 0);
    return x;
  });
}
// Day-wise: Opening, Inward, Transfer in, Transfer out, Issued, Closing for one location (or all).
function getStockLedger_(f) {
  f = f || {};
  const today = today_();
  const to = str_(f.to) ? checkDate_(f.to) : today;
  let from = str_(f.from) ? checkDate_(f.from) : addDays_(to, -29);
  if (from > to) throw new Error('From date is after To date.');
  if (daysBetween_(from, to) > 366) from = addDays_(to, -366);
  const loc = str_(f.location);
  const ev = events_(stockTables_()).filter(e => !loc || e.loc === loc);
  const days = {};
  for (let d = from; d <= to; d = addDays_(d, 1)) days[d] = { date: d, opening: 0, inward: 0, tin: 0, tout: 0, issued: 0, closing: 0 };
  let run = 0;
  const bal = e => loc ? e.bal : e.tot;
  ev.forEach(e => {
    if (e.dk < from || isOpenBefore_(e, from)) { run = bal(e); return; }
    if (e.dk > to) return;
    const x = days[e.dk];
    if (e.kind === 'inward') x.inward += e.q; else if (e.kind === 'tin') x.tin += e.q;
    else if (e.kind === 'tout') x.tout -= e.q; else x.issued -= e.q;
  });
  const rows = Object.keys(days).sort().map(d => {
    const x = days[d];
    x.opening = r2_(run);
    // transfers between two stock points cancel out when all locations are shown
    run = r2_(run + x.inward + x.tin - x.tout - x.issued);
    x.closing = run;
    ['inward', 'tin', 'tout', 'issued'].forEach(k => { x[k] = r2_(x[k]); });
    return x;
  });
  return { location: loc || 'All', from: from, to: to, rows: rows };
}

/* ================= DASHBOARD ================= */
// f: { from, to } – blank = all dates. Pending Log Book is always for all dates.
function getDashboard_(f) {
  f = f || {};
  const from = str_(f.from) ? checkDate_(f.from) : '';
  const to = str_(f.to) ? checkDate_(f.to) : '';
  if (from && to && from > to) throw new Error('From date is after To date.');
  const today = today_();
  const own = ownershipIndex_();
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const c = t.c;

  // Day-wise chart window: the chosen range if it is up to 62 days, otherwise the last 30 days of it
  const end = to || today;
  let start = from && daysBetween_(from, end) <= 61 ? from : addDays_(end, -29);
  if (from && start < from) start = from;
  const daily = {};
  for (let d = start; d <= end; d = addDays_(d, 1)) daily[d] = 0;

  const groups = {}, machines = {};
  APP.OWNERSHIP.forEach(o => { groups[o] = { ownership: o, qty: 0, entries: 0, machines: {} }; });
  let totalQty = 0, totalEntries = 0, todayQty = 0;
  t.rows.forEach(r => {
    const dk = dkey_(r[c[H.IDATE]]);
    if (!dk) return;
    const q = num0_(r[c[H.QTY]]);
    if (dk === today) todayQty += q;
    if ((from && dk < from) || (to && dk > to)) return;
    const k = noKey_(r[c[H.NO]]);
    const o = own[k] || 'Not in Master';
    if (!groups[o]) groups[o] = { ownership: o, qty: 0, entries: 0, machines: {} };
    groups[o].qty += q; groups[o].entries++; groups[o].machines[k] = true;
    if (!machines[k]) machines[k] = { no: str_(r[c[H.NO]]), type: str_(r[c[H.TYPE]]), ownership: o, qty: 0, entries: 0 };
    machines[k].qty += q; machines[k].entries++;
    if (dk in daily) daily[dk] += q;
    totalQty += q; totalEntries++;
  });
  const byOwnership = Object.keys(groups).map(k => {
    const g = groups[k];
    return { ownership: g.ownership, qty: r2_(g.qty), entries: g.entries, machines: Object.keys(g.machines).length };
  }).filter(g => APP.OWNERSHIP.indexOf(g.ownership) > -1 || g.entries > 0);
  // Inward in the period and day-wise closing stock
  const it = table_(APP.SHEET_INWARD, INWARD_COLS_);
  const inDay = {};
  let inQty = 0, inAmount = 0, inEntries = 0;
  it.rows.forEach(r => {
    const dk = dkey_(r[it.c[H.DATE]]);
    if (!dk) return;
    const q = num0_(r[it.c[H.IN_QTY]]);
    const open = isOpeningPump_(r[it.c[H.PUMP]]);
    if (open && (!from || dk <= from)) return;       // part of the opening, not "received"
    if (dk in daily) inDay[dk] = (inDay[dk] || 0) + q;
    if ((from && dk < from) || (to && dk > to)) return;
    inQty += q; inAmount += num0_(r[it.c[H.AMOUNT]]); inEntries++;
  });
  const T = stockTables_();
  const ev = events_(T);
  const closing = {};
  ev.forEach(e => { closing[e.dk] = e.tot; });
  let carry = 0;
  ev.forEach(e => { if (e.dk < start) carry = e.tot; });
  const top = Object.keys(machines).map(k => machines[k]).sort((a, b) => b.qty - a.qty).slice(0, 6)
    .map(m => ({ no: m.no, type: m.type, ownership: m.ownership, qty: r2_(m.qty), entries: m.entries }));
  return {
    today: today,
    total: { qty: r2_(totalQty), entries: totalEntries, machines: Object.keys(machines).length, todayQty: r2_(todayQty) },
    inward: { qty: r2_(inQty), amount: r2_(inAmount), entries: inEntries },
    stock: stockFrom_(T, ev),
    locations: stockSummary_(ev, from, to),
    byOwnership: byOwnership,
    daily: Object.keys(daily).sort().map(d => {
      if (d in closing) carry = closing[d];
      return { date: d, qty: r2_(daily[d]), inQty: r2_(inDay[d] || 0), closing: carry };
    }),
    top: top,
    pending: pendingLogs_(),
    tanks: tankSettings_(),
  };
}
/* Diesel tank picture on the Dashboard: size of each tank (Ltr) and the low-stock level (red below it) */
const TANK_DEFAULT_ = 10000, TANK_LOW_ = 1000;
function tankSettings_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const caps = {};
  APP.LOCATIONS.forEach(l => { caps[l] = num0_(p['TANK_CAP_' + l]) || TANK_DEFAULT_; });
  return { caps: caps, low: num0_(p.TANK_LOW) || TANK_LOW_ };
}
function saveTankSettings_(t) {
  t = t || {};
  const out = {};
  APP.LOCATIONS.forEach(l => {
    const v = Number((t.caps || {})[l]);
    if (!(v > 0)) throw new Error('Enter the tank size (Ltr) for ' + l + '.');
    out['TANK_CAP_' + l] = String(Math.round(v));
  });
  const low = Number(t.low);
  if (!(low >= 0)) throw new Error('Enter the low-stock level (Ltr).');
  out.TANK_LOW = String(Math.round(low));
  PropertiesService.getScriptProperties().setProperties(out);
  return tankSettings_();
}

function addDays_(dk, n) {
  const p = dk.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

// Machine-wise diesel for one ownership group in the date range (for the pop-up and print).
function getOwnershipDetail_(ownership, f) {
  f = f || {};
  const from = str_(f.from) ? checkDate_(f.from) : '';
  const to = str_(f.to) ? checkDate_(f.to) : '';
  const own = ownershipIndex_();
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const c = t.c;
  const m = {};
  t.rows.forEach(r => {
    const dk = dkey_(r[c[H.IDATE]]);
    if (!dk || (from && dk < from) || (to && dk > to)) return;
    const k = noKey_(r[c[H.NO]]);
    if ((own[k] || 'Not in Master') !== ownership) return;
    if (!m[k]) m[k] = { no: str_(r[c[H.NO]]), type: str_(r[c[H.TYPE]]), owner: str_(r[c[H.OWNER]]), entries: 0, qty: 0, first: dk, last: dk };
    const x = m[k];
    x.entries++; x.qty += num0_(r[c[H.QTY]]);
    if (dk < x.first) x.first = dk;
    if (dk > x.last) { x.last = dk; x.type = str_(r[c[H.TYPE]]) || x.type; x.owner = str_(r[c[H.OWNER]]) || x.owner; }
  });
  const rows = Object.keys(m).map(k => { m[k].qty = r2_(m[k].qty); return m[k]; })
    .sort((a, b) => b.qty - a.qty || a.no.localeCompare(b.no));
  return {
    company: APP.COMPANY, ownership: ownership, from: from, to: to, today: today_(), rows: rows,
    total: { qty: r2_(rows.reduce((s, x) => s + x.qty, 0)), entries: rows.reduce((s, x) => s + x.entries, 0) },
  };
}

/* A Log Book day is pending when a machinery was ACTIVE on that day and has no Log Book entry for it (any shift),
 * from 01-09-2026 (or the From date picked) up to today. Debit Basis machinery do not fill the Log Book and are left out. */
const PENDING_FROM_ = '2026-09-01';
function pendingLogs_(f) {
  f = f || {};
  const today = today_();
  const from = str_(f.from) ? checkDate_(f.from) : PENDING_FROM_, to0 = str_(f.to) ? checkDate_(f.to) : today, to = to0 > today ? today : to0;
  if (from > to) throw new Error('From date is after To date.');
  if (daysBetween_(from, to) > 400) throw new Error('Pick up to about one year.');
  const lt = table_(APP.SHEET_LOG, [H.DATE, H.NO, H.SHIFT]);
  const done = {};
  lt.rows.forEach(r => { const dk = dkey_(r[lt.c[H.DATE]]); if (dk >= from && dk <= to) done[noKey_(r[lt.c[H.NO]]) + '|' + dk] = true; }); // any entry on that day counts
  const items = [], byMachine = {};
  getMaster_().filter(m => m.supply !== 'Debit Basis').forEach(m => {
    const k = noKey_(m.id), af = m.activeFrom ? dkey_(m.activeFrom) : '', inf = m.status === 'Inactive' ? (m.inactiveFrom ? dkey_(m.inactiveFrom) : '0000') : '';
    for (let d = from; d <= to; d = addDays_(d, 1)) {
      if ((af && d < af) || (inf && d >= inf)) continue;
      if (done[k + '|' + d]) continue;
      items.push({ no: m.id, type: m.type || '', owner: m.owner || '', date: d });
      const x = byMachine[k] = byMachine[k] || { no: m.id, type: m.type || '', owner: m.owner || '', today: false, older: [] };
      if (d === today) x.today = true; else x.older.push(d);
    }
  });
  const todayRows = [], olderRows = [], age = { d0: 0, d1: 0, d2_3: 0, d4_7: 0, d8: 0 };
  Object.keys(byMachine).forEach(k => {
    const x = byMachine[k];
    if (x.today) todayRows.push({ no: x.no, type: x.type, owner: x.owner, shifts: 'Full Day' });
    if (x.older.length) olderRows.push({ no: x.no, type: x.type, owner: x.owner, since: x.older[0], sinceShift: 'Full Day', days: daysBetween_(x.older[0], today), entries: x.older.length, latest: x.older[x.older.length - 1] });
  });
  items.forEach(x => { const n = daysBetween_(x.date, today); if (n <= 0) age.d0++; else if (n === 1) age.d1++; else if (n <= 3) age.d2_3++; else if (n <= 7) age.d4_7++; else age.d8++; });
  todayRows.sort((a, b) => a.no.localeCompare(b.no)); olderRows.sort((a, b) => b.days - a.days || a.no.localeCompare(b.no));
  return { today: todayRows, older: olderRows, age: age, items: items, asOf: today, from: from, to: to, total: items.length };
}

function ownershipIndex_() {
  const o = {};
  getMaster_().forEach(m => { o[noKey_(m.id)] = APP.OWNERSHIP.indexOf(m.ownership) > -1 ? m.ownership : 'Other'; });
  return o;
}

function daysBetween_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

/* ================= GLOBAL SEARCH (Ctrl + K) =================
 * Searches the entries in the sheets: Diesel Issue, Diesel Inward, Diesel Transfer and Log Book.
 * Every word typed must appear (machinery numbers match with or without dashes / spaces).
 * Newest first, a few of each kind. Machinery, owners and pages are searched in the app itself. */
function globalSearch_(u, q) {
  const may = m => !!(u && u.perms && (u.perms[m] === 'View' || u.perms[m] === 'Edit'));
  const words = clean_(q).toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { issues: [], inwards: [], transfers: [], logs: [] };
  const squash = v => String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hit = parts => {
    const text = parts.map(str_).join(' ').toUpperCase(), flat = squash(text);
    return words.every(w => text.indexOf(w) > -1 || (squash(w) && flat.indexOf(squash(w)) > -1));
  };
  const LIMIT = 8;
  const newest = (rows, dateOf) => rows.sort((a, b) => dateOf(b) < dateOf(a) ? -1 : dateOf(b) > dateOf(a) ? 1 : 0).slice(0, LIMIT);
  const T = stockTables_();
  const dc = T.dt.c, ic = T.it.c, tc = T.tt.c;
  const issues = newest(T.dt.rows.filter(r => hit([r[dc[H.ID]], r[dc[H.NO]], r[dc[H.DRIVER]], r[dc[H.REMARK]], r[dc[H.OWNER]], r[dc[H.TYPE]], loc_(r[dc[H.SOURCE]]), dmy_(dkey_(r[dc[H.IDATE]]))])), r => dkey_(r[dc[H.IDATE]]))
    .map(r => ({ id: str_(r[dc[H.ID]]), date: dkey_(r[dc[H.IDATE]]), shift: str_(r[dc[H.SHIFT]]), no: str_(r[dc[H.NO]]), qty: num0_(r[dc[H.QTY]]), driver: str_(r[dc[H.DRIVER]]), source: loc_(r[dc[H.SOURCE]]) }));
  const inwards = newest(T.it.rows.filter(r => hit([r[ic[H.IN_ID]], r[ic[H.PUMP]], r[ic[H.BILLNO]], loc_(r[ic[H.LOC]]), dmy_(dkey_(r[ic[H.DATE]]))])), r => dkey_(r[ic[H.DATE]]))
    .map(r => ({ id: str_(r[ic[H.IN_ID]]), date: dkey_(r[ic[H.DATE]]), pump: str_(r[ic[H.PUMP]]), bill: str_(r[ic[H.BILLNO]]), qty: num0_(r[ic[H.IN_QTY]]), location: loc_(r[ic[H.LOC]]) }));
  const transfers = newest(T.tt.rows.filter(r => hit([r[tc[H.TR_ID]], loc_(r[tc[H.FROM]]), loc_(r[tc[H.TO]]), r[tc[H.REMARK]], dmy_(dkey_(r[tc[H.DATE]]))])), r => dkey_(r[tc[H.DATE]]))
    .map(r => ({ id: str_(r[tc[H.TR_ID]]), date: dkey_(r[tc[H.DATE]]), from: loc_(r[tc[H.FROM]]), to: loc_(r[tc[H.TO]]), qty: num0_(r[tc[H.IN_QTY]]) }));
  const lt = table_(APP.SHEET_LOG, [H.DATE, H.NO, H.SHIFT]);
  const lc = lt.c, g = h => (h in lc ? h : null);
  const logs = newest(lt.rows.filter(r => hit([r[lc[H.NO]], r[lc[H.SHIFT]], g(H.WORK) ? r[lc[H.WORK]] : '', g(H.CHFROM) ? r[lc[H.CHFROM]] : '', g(H.CHTO) ? r[lc[H.CHTO]] : '',
      g(H.DRIVER) ? r[lc[H.DRIVER]] : '', dmy_(dkey_(r[lc[H.DATE]]))])), r => dkey_(r[lc[H.DATE]]))
    .map(r => ({ date: dkey_(r[lc[H.DATE]]), shift: str_(r[lc[H.SHIFT]]) || 'Full Day', no: str_(r[lc[H.NO]]),
      work: g(H.WORK) ? str_(r[lc[H.WORK]]) : '', wkm: g(H.WKM) ? numOrBlank_(r[lc[H.WKM]]) : '', whr: g(H.WHR) ? numOrBlank_(r[lc[H.WHR]]) : '' }));
  return { issues: may('Diesel Issue') ? issues : [], inwards: may('Diesel Inward') ? inwards : [], transfers: may('Diesel Transfer') ? transfers : [], logs: may('Log Book') ? logs : [] };
}

/* ================= REPORTS (read only) ================= */
// Ownership groups in the report: Own first, Debit last, anything new (Hired, Other, …) in between.
const REPORT_GROUP_ORDER_ = ['Own', 'Rental', 'Hired', 'Other'];
function groupRank_(o) {
  if (o === 'Debit') return 900;
  if (o === 'Not in Master') return 999;
  const i = REPORT_GROUP_ORDER_.indexOf(o);
  return i > -1 ? i : 500;
}
function natCmp_(a, b) { return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' }); }

/* Monthly Diesel Issue Report
 * f: { month: 'yyyy-mm', source: '' | location, shift: '' | Day | Night,
 *      ownerships: [..] (empty = all), machines: [ids] (empty = all), includeZero: bool }
 * Returns machinery rows × days of the month, grouped by ownership, with day-wise, machinery-wise, group and grand totals. */
function getMonthlyDieselReport_(f) {
  f = f || {};
  // From – To (up to 31 days so every day fits on one A4 landscape page width)
  const from = checkDate_(f.from), to = checkDate_(f.to);
  if (from > to) throw new Error('From date is after To date.');
  const nDays = daysBetween_(from, to) + 1;
  if (nDays > 31) throw new Error('Select up to 31 days (one month) for this report.');
  const dayKeys = [];
  for (let d = from; d <= to; d = addDays_(d, 1)) dayKeys.push(d);
  const dayIndex = {};
  dayKeys.forEach((d, i) => { dayIndex[d] = i; });
  const src = str_(f.source), shift = str_(f.shift), supplyF = str_(f.supply);
  const owns = (f.ownerships || []).map(String);
  const pick = {};
  (f.machines || []).forEach(id => { pick[noKey_(id)] = true; });
  const usePick = Object.keys(pick).length > 0;

  const master = {};
  getMaster_().forEach(m => { master[noKey_(m.id)] = m; });
  const rows = {};
  const newRow = (k, m, fallback) => ({
    id: m ? m.id : fallback.no, name: m ? m.name : '', type: m ? m.type : fallback.type, owner: m ? m.owner : fallback.owner,
    ownership: m ? (APP.OWNERSHIP.indexOf(m.ownership) > -1 ? m.ownership : 'Other') : 'Not in Master',
    unit: m ? m.unit : '', supply: m ? m.supply : '', status: m ? m.status : '', inactiveFrom: m ? m.inactiveFrom : '',
    days: new Array(nDays).fill(0), total: 0, entries: 0,
  });
  const keep = r => (!owns.length || owns.indexOf(r.ownership) > -1);

  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const c = t.c;
  let entries = 0;
  t.rows.forEach(r => {
    const dk = dkey_(r[c[H.IDATE]]);
    if (!dk || dk < from || dk > to) return;
    if (src && loc_(r[c[H.SOURCE]]) !== src) return;
    if (shift && str_(r[c[H.SHIFT]]) !== shift) return;
    const k = noKey_(r[c[H.NO]]);
    if (!k || (usePick && !pick[k])) return;
    // Diesel Supply as it was on the day of issue (older entries: from Master)
    if (supplyF && (str_(r[c[H.SUPPLY]]) || (master[k] ? master[k].supply : '')) !== supplyF) return;
    if (!rows[k]) {
      const row = newRow(k, master[k], { no: str_(r[c[H.NO]]), type: str_(r[c[H.TYPE]]), owner: str_(r[c[H.OWNER]]) });
      if (!keep(row)) return;
      rows[k] = row;
    }
    const q = num0_(r[c[H.QTY]]);
    const d = dayIndex[dk];
    rows[k].days[d] = r2_(rows[k].days[d] + q);
    rows[k].total = r2_(rows[k].total + q);
    rows[k].entries++; entries++;
  });
  if (f.includeZero) { // machinery with no diesel in the month
    Object.keys(master).forEach(k => {
      if (rows[k] || (usePick && !pick[k])) return;
      const row = newRow(k, master[k]);
      if (keep(row) && (!supplyF || row.supply === supplyF)) rows[k] = row;
    });
  }

  const groups = {};
  Object.keys(rows).forEach(k => { const r = rows[k]; (groups[r.ownership] = groups[r.ownership] || []).push(r); });
  const sum = list => { const d = new Array(nDays).fill(0); let tot = 0, en = 0; list.forEach(r => { r.days.forEach((v, i) => { d[i] = r2_(d[i] + v); }); tot = r2_(tot + r.total); en += r.entries; }); return { days: d, total: tot, entries: en }; };
  const out = Object.keys(groups).sort((a, b) => groupRank_(a) - groupRank_(b) || natCmp_(a, b)).map(g => {
    const list = groups[g].sort((a, b) => natCmp_(a.id, b.id));
    const s = sum(list);
    return { ownership: g, rows: list, dayTotals: s.days, total: s.total, entries: s.entries };
  });
  if (f.withReadings) addReadings_(out, from, to);
  const all = sum([].concat.apply([], out.map(g => g.rows)));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dmy = k => k.slice(8, 10) + '-' + k.slice(5, 7) + '-' + k.slice(0, 4);
  const fy = Number(from.slice(0, 4)), fm = Number(from.slice(5, 7));
  const lastDay = new Date(Date.UTC(fy, fm, 0)).getUTCDate();
  const wholeMonth = from.slice(8) === '01' && to === from.slice(0, 8) + String(lastDay).padStart(2, '0');
  const period = (wholeMonth ? FULL[fm - 1] + ' ' + fy + ' (' : '') + dmy(from) + ' to ' + dmy(to) + (wholeMonth ? ')' : '');
  return {
    company: APP.COMPANY, month: from.slice(0, 7), monthName: period, from: from, to: to, nDays: nDays,
    days: dayKeys.map((k, i) => {
      const p = k.split('-').map(Number);
      const dd = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
      return { d: p[2], date: k, mon: (i === 0 || p[2] === 1) ? MON[p[1] - 1] : '', dow: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dd.getUTCDay()] };
    }),
    groups: out, dayTotals: all.days, total: all.total, entries: entries, machines: Object.keys(rows).length,
    filters: { source: src || 'All', shift: shift || 'All', supply: supplyF || 'All', ownerships: owns.length ? owns : ['All'], machines: usePick ? Object.keys(pick).length : 'All' },
    generated: Utilities.formatDate(new Date(), tz_(), 'dd-MM-yyyy HH:mm'),
  };
}

/* Monthly Diesel & Average: for every machinery in the report –
 *   Opening reading = Start of its first Log Book entry in the period, Closing reading = Close of its last one (blank if none)
 *   Total = Closing − Opening (KM and / or Hrs as per its Unit in Master)
 *   Actual average from Total and the diesel issued in the period; Standard average from Master
 *   KM: km/L = KM ÷ diesel · Hrs: L/hr = diesel ÷ Hrs · KM + Hrs: diesel used vs diesel needed as per standard */
function addReadings_(groups, from, to) {
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  const byNo = {};
  lt.rows.forEach(r => {
    const dk = dkey_(r[c[H.DATE]]);
    if (!dk || dk < from || dk > to) return;
    (byNo[noKey_(r[c[H.NO]])] = byNo[noKey_(r[c[H.NO]])] || []).push(r);
  });
  groups.forEach(g => g.rows.forEach(row => {
    let m = null; try { m = findMachine_(row.id); } catch (e) { /* not in Master */ }
    const unit = m ? m.unit : '', km = hasKm_(unit), hr = hasHr_(unit);
    row.unit = unit || '–';
    const list = (byNo[noKey_(row.id)] || []).sort((a, b) => cmpKey_(a, b, c));
    Object.assign(row, { oKm: '', cKm: '', tKm: '', oHr: '', cHr: '', tHr: '', actual: '', standard: '', need: '', diff: '', pct: '', status: '', statusCode: '' });
    if (m) row.standard = [km && m.kmStd ? m.kmStd + ' km/L' : '', hr && m.hrStd ? m.hrStd + ' L/hr' : ''].filter(Boolean).join(' + ');
    if (!m) { row.statusNote = 'Not in Master'; row.statusCode = 'na'; return; }
    if (!list.length) { row.statusNote = 'No Log Book readings'; row.statusCode = 'na'; return; }
    const first = list[0], last = list[list.length - 1];
    // Opening = first Start, Closing = last Close; Total = all the work of the entries in the period added up
    // (same as the Log Book period total and the Actual vs Standard Average report)
    const sumW = h => r2_(list.reduce((a, r) => a + Math.max(0, num0_(r[c[h]])), 0));
    if (km) { row.oKm = numOrBlank_(first[c[H.OKM]]); row.cKm = numOrBlank_(last[c[H.CKM]]); row.tKm = sumW(H.WKM); }
    if (hr) { row.oHr = numOrBlank_(first[c[H.OHR]]); row.cHr = numOrBlank_(last[c[H.CHR]]); row.tHr = sumW(H.WHR); }
    const d = row.total;
    if (unit === 'KM' && row.tKm !== '' && d > 0) row.actual = r2_(row.tKm / d) + ' km/L';
    else if (unit === 'Hrs' && row.tHr > 0 && d > 0) row.actual = r2_(d / row.tHr) + ' L/hr';
    else if (unit === 'KM + Hrs' && d > 0 && (row.tKm !== '' || row.tHr !== '')) row.actual = dualAvg_(d, row.tKm, row.tHr, m.kmStd, m.hrStd).text;
    // Status: diesel issued vs diesel the standard says the work needed (±10% counts as OK)
    const need = r2_((km && m.kmStd > 0 && row.tKm !== '' ? row.tKm / m.kmStd : 0) + (hr && m.hrStd > 0 && row.tHr !== '' ? row.tHr * m.hrStd : 0));
    const stdSet = (!km || m.kmStd > 0) && (!hr || m.hrStd > 0);
    if (!stdSet) { row.statusNote = 'Standard not set in Master'; row.statusCode = 'na'; return; }
    if (!(need > 0)) { row.statusNote = 'No work in Log Book'; row.statusCode = 'na'; return; }
    row.need = need; row.diff = r2_(d - need); row.pct = r2_((d - need) / need * 100);
    if (row.pct > 10) { row.status = 'High consumption'; row.statusCode = 'more'; }
    else if (row.pct < -10) { row.status = 'Low consumption'; row.statusCode = 'less'; }
    else { row.status = 'Balanced'; row.statusCode = 'ok'; }
  }));
}

/* Daily Diesel Inward & Issue Summary (portrait)
 * f: { from, to, location: '' (all) | Dispenser | VTR Store }
 * One row per date: Opening, Inward, (Transfer in / out when one location is chosen), Issued by ownership, Total issued, Closing. */
function getDailyInwardIssueReport_(f) {
  f = f || {};
  const from = checkDate_(f.from), to = checkDate_(f.to);
  if (from > to) throw new Error('From date is after To date.');
  if (daysBetween_(from, to) > 366) throw new Error('Select up to one year.');
  const loc = str_(f.location);
  if (loc) checkLoc_(loc, 'Location');
  const T = stockTables_();
  const ev = events_(T).filter(e => !loc || e.loc === loc);
  const own = ownershipIndex_();
  const ownOf = idx => own[noKey_(T.dt.rows[idx][T.dt.c[H.NO]])] || 'Not in Master';

  const days = {}, order = [];
  for (let d = from; d <= to; d = addDays_(d, 1)) { days[d] = { date: d, opening: 0, inward: 0, tin: 0, tout: 0, issue: {}, issued: 0, closing: 0 }; order.push(d); }
  let run = 0;
  const bal = e => loc ? e.bal : e.tot;
  const groupsSeen = {};
  ev.forEach(e => {
    if (e.dk < from || isOpenBefore_(e, from)) { run = bal(e); return; }
    if (e.dk > to) return;
    const x = days[e.dk];
    if (e.kind === 'inward') x.inward += e.q;
    else if (e.kind === 'tin') x.tin += e.q;
    else if (e.kind === 'tout') x.tout -= e.q;
    else { const g = ownOf(e.idx); x.issue[g] = r2_((x.issue[g] || 0) - e.q); x.issued -= e.q; groupsSeen[g] = true; }
  });
  const rows = order.map(d => {
    const x = days[d];
    x.opening = r2_(run);
    run = r2_(run + x.inward + (loc ? x.tin - x.tout : 0) - x.issued); // with all locations, transfers stay inside
    x.closing = run;
    ['inward', 'tin', 'tout', 'issued'].forEach(k => { x[k] = r2_(x[k]); });
    return x;
  });
  // Own, Rental, (Hired, Other when used), Debit – same order as every report
  const groups = ['Own', 'Rental', 'Hired', 'Other', 'Debit', 'Not in Master']
    .filter(g => ['Own', 'Rental', 'Debit'].indexOf(g) > -1 || groupsSeen[g]);
  const tot = { inward: 0, tin: 0, tout: 0, issued: 0, issue: {} };
  rows.forEach(x => {
    ['inward', 'tin', 'tout', 'issued'].forEach(k => { tot[k] = r2_(tot[k] + x[k]); });
    groups.forEach(g => { tot.issue[g] = r2_((tot.issue[g] || 0) + (x.issue[g] || 0)); });
  });
  tot.opening = rows.length ? rows[0].opening : 0;
  tot.closing = rows.length ? rows[rows.length - 1].closing : 0;
  return {
    company: APP.COMPANY, from: from, to: to, location: loc || 'All locations', byLocation: !!loc,
    otherLocations: loc ? APP.LOCATIONS.filter(l => l !== loc) : [],
    groups: groups, rows: rows, totals: tot,
    generated: Utilities.formatDate(new Date(), tz_(), 'dd-MM-yyyy HH:mm'),
  };
}

/* ================= DIESEL REPORTS (read only) ================= */
function rptRange_(f, maxDays) {
  const from = checkDate_(f.from), to = checkDate_(f.to);
  if (from > to) throw new Error('From date is after To date.');
  if (daysBetween_(from, to) > (maxDays || 366)) throw new Error('Select up to ' + (maxDays || 366) + ' days.');
  return { from: from, to: to };
}
const dmy_ = k => k ? k.split('-').reverse().join('-') : '';
function rptBase_(title, range) {
  return { company: APP.COMPANY, title: title, from: range ? range.from : '', to: range ? range.to : '', generated: Utilities.formatDate(new Date(), tz_(), 'dd-MM-yyyy HH:mm') };
}
// All diesel issues with their machine details (supply as on the day of issue)
function issueList_(T) {
  const master = {};
  getMaster_().forEach(m => { master[noKey_(m.id)] = m; });
  const c = T.dt.c;
  return T.dt.rows.map((r, i) => {
    const dk = dkey_(r[c[H.IDATE]]); if (!dk) return null;
    const k = noKey_(r[c[H.NO]]); const m = master[k];
    return {
      idx: i, id: str_(r[c[H.ID]]), date: dk, shift: str_(r[c[H.SHIFT]]), key: k, no: m ? m.id : str_(r[c[H.NO]]),
      name: m ? m.name : '', type: (m && m.type) || str_(r[c[H.TYPE]]), owner: (m && m.owner) || str_(r[c[H.OWNER]]),
      ownership: m ? (APP.OWNERSHIP.indexOf(m.ownership) > -1 ? m.ownership : 'Other') : 'Not in Master',
      supply: str_(r[c[H.SUPPLY]]) || (m ? m.supply : ''), source: loc_(r[c[H.SOURCE]]), qty: num0_(r[c[H.QTY]]),
      km: numOrBlank_(r[c[H.KMR]]), hr: numOrBlank_(r[c[H.HRR]]), driver: str_(r[c[H.DRIVER]]), remark: str_(r[c[H.REMARK]]),
      unit: m ? m.unit : '', kmStd: m ? m.kmStd : '', hrStd: m ? m.hrStd : '',
    };
  }).filter(Boolean);
}
/* Diesel rate for every issue.
 * avg  = weighted average cost of the diesel in stock at that moment (all locations together; transfers do not change cost)
 * last = rate of the latest purchase on or before that moment */
function issueRates_(T) {
  const ev = events_(T);
  const rateOf = i => num0_(T.it.rows[i][T.it.c[H.RATE]]);
  let stock = 0, avg = 0, last = 0;
  const out = {};
  ev.forEach(e => {
    if (e.kind === 'inward') {
      const q = e.q, r = rateOf(e.idx);
      if ((e.open || isExtraPump_(T.it.rows[e.idx][T.it.c[H.PUMP]])) && !(r > 0)) { stock += q; return; } // opening / extra diesel with no rate: stock only
      avg = stock > 0 ? (stock * avg + q * r) / (stock + q) : r;
      stock += q; last = r;
    } else if (e.kind === 'issue') {
      out[e.idx] = { avg: Math.round(avg * 100) / 100, last: last };
      stock += e.q;
    }
  });
  return out;
}
function rateFor_(rates, idx, f) {
  if (f.rateMode === 'fixed') return num0_(f.fixedRate);
  const r = rates[idx] || { avg: 0, last: 0 };
  return f.rateMode === 'avg' ? r.avg : r.last; // default: rate of the day
}
const rateLabel_ = f => f.rateMode === 'fixed' ? 'Fixed rate ₹' + num0_(f.fixedRate) : f.rateMode === 'avg' ? 'Weighted average stock rate' : 'Rate of the day (latest purchase on or before the issue date)';
const byGroupOrder_ = (a, b) => groupRank_(a) - groupRank_(b) || natCmp_(a, b);

/* 1. Debit Recovery Statement – diesel given on Debit Basis, vendor-wise, with ₹ to recover.
 * Rate of every entry: the rate typed for that entry ("Debit Rate" in Diesel Issue) if there is one,
 * otherwise the rate of the day (or the rate basis chosen). Summary: one line per vendor. */
/* For the Log Book print (monthly log book + bill): diesel given on Debit Basis to each machinery in the dates,
 * with its amount at the rate of the day – the "Debit Amt" taken off the payable. */
function logPrintExtra_(f) {
  f = f || {};
  const out = {}, boq = {};
  // BOQ in force on every day of the dates, for each machinery asked
  (f.nos || []).forEach(no => {
    let m; try { m = findMachine_(no); } catch (e) { return; }
    const days = {}; let d = f.from;
    for (let k = 0; d && d <= f.to && k < 370; k++) {
      const h = m.owner ? boqRateFor_(m.owner, m.id, d) : null;
      if (h) days[d] = { boq: h.boqNo, amendNo: h.amendNo, basis: h.line.basis, rate: h.line.rate, slabs: h.line.slabs, slabOn: h.line.slabOn, items: Array.isArray(h.line.items) ? h.line.items : [], diesel: h.line.diesel, gstPct: h.gstPct, tdsPct: h.tdsPct, woNo: h.woNo, woDate: h.woDate };
      const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10);
    }
    boq[noKey_(m.id)] = days;
  });
  try {
    const d = rptDebit_({ from: f.from, to: f.to });
    (d.vendors || []).forEach(v => (v.rows || []).forEach(r => {
      const k = noKey_(r.no); out[k] = out[k] || { qty: 0, amount: 0 };
      out[k].qty = r2_(out[k].qty + r.qty); out[k].amount = r2_(out[k].amount + r.amount);
    }));
  } catch (e) { /* no debit diesel */ }
  // diesel issued to each machinery, day by day: litres added up, and the reading of the LAST issue of the day
  const issues = {}, want = {}; (f.nos || []).forEach(n => { want[noKey_(n)] = true; });
  try {
    const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_), c = t.c;
    t.rows.filter(r => want[noKey_(r[c[H.NO]])] && dkey_(r[c[H.IDATE]]) >= f.from && dkey_(r[c[H.IDATE]]) <= f.to).sort((a, b) => cmpDiesel_(a, b, c)).forEach(r => {
      const k = noKey_(r[c[H.NO]]), d = dkey_(r[c[H.IDATE]]);
      const x = ((issues[k] = issues[k] || {})[d] = issues[k][d] || { qty: 0, km: '', hr: '' });
      x.qty = r2_(x.qty + num0_(r[c[H.QTY]]));
      if (numOrBlank_(r[c[H.KMR]]) !== '') x.km = numOrBlank_(r[c[H.KMR]]);
      if (numOrBlank_(r[c[H.HRR]]) !== '') x.hr = numOrBlank_(r[c[H.HRR]]);
    });
  } catch (e) { /* no diesel issues */ }
  // average diesel rate of the dates (bought diesel, weighted by litres); none bought → the last rate before
  let avgRate = 0, lastRate = 0, lastDate = '';
  try {
    const it = table_(APP.SHEET_INWARD, INWARD_COLS_), c = it.c;
    const bought = it.rows.map(r => ({ d: dkey_(r[c[H.DATE]]), q: num0_(r[c[H.IN_QTY]]), rate: num0_(r[c[H.RATE]]), pump: str_(r[c[H.PUMP]]) }))
      .filter(x => x.d && x.q > 0 && x.rate > 0 && x.pump !== OPENING_PUMP_ && x.pump !== EXTRA_PUMP_);
    const inDates = bought.filter(x => x.d >= f.from && x.d <= f.to);
    // the last diesel bought up to the end of the dates
    const lastBuy = bought.filter(x => x.d <= f.to).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0).pop();
    lastRate = lastBuy ? lastBuy.rate : 0; lastDate = lastBuy ? lastBuy.d : '';
    if (inDates.length) avgRate = r2_(inDates.reduce((s2, x) => s2 + x.q * x.rate, 0) / inDates.reduce((s2, x) => s2 + x.q, 0));
    else avgRate = lastRate;
  } catch (e) { /* no inward */ }
  return { debit: out, boq: boq, issues: issues, avgRate: avgRate, lastRate: lastRate, lastDate: lastDate };
}
function rptDebit_(f) {
  f = f || {};
  const rg = rptRange_(f);
  if (f.rateMode === 'fixed' && !(num0_(f.fixedRate) > 0)) throw new Error('Enter the fixed rate.');
  const T = stockTables_();
  const rates = issueRates_(T);
  const dc = T.dt.c;
  const vendor = clean_(f.owner).toUpperCase();
  const list = issueList_(T).filter(x => x.date >= rg.from && x.date <= rg.to && x.supply === 'Debit Basis' && (!vendor || x.owner.toUpperCase() === vendor));
  const vendors = {};
  list.forEach(x => {
    const auto = rateFor_(rates, x.idx, f);
    const manual = H.DRATE in dc ? numOrBlank_(T.dt.rows[x.idx][dc[H.DRATE]]) : '';
    const rate = manual !== '' && manual >= 0 ? manual : auto;
    const key = x.owner || '(No owner)';
    const v = vendors[key] = vendors[key] || { owner: key, rows: [], qty: 0, amount: 0, machines: {} };
    const amount = r2_(x.qty * rate);
    v.rows.push({ date: x.date, shift: x.shift, id: x.id, no: x.no, type: x.type, driver: x.driver, source: x.source, qty: x.qty, rate: rate, autoRate: auto, manual: manual !== '', amount: amount });
    v.qty = r2_(v.qty + x.qty); v.amount = r2_(v.amount + amount); v.machines[x.key] = true;
  });
  const out = Object.keys(vendors).sort(natCmp_).map(k => {
    const v = vendors[k];
    v.rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : natCmp_(a.no, b.no));
    v.machines = Object.keys(v.machines).length;
    v.rate = v.qty ? r2_(v.amount / v.qty) : 0;
    return v;
  });
  return Object.assign(rptBase_('Debit Recovery Statement', rg), {
    rateText: rateLabel_(f), vendors: out,
    total: { qty: r2_(out.reduce((s, v) => s + v.qty, 0)), amount: r2_(out.reduce((s, v) => s + v.amount, 0)), entries: list.length, machines: out.reduce((s, v) => s + v.machines, 0) },
  });
}
// Save the rate typed for debit entries; a blank rate goes back to the automatic rate of the day.
// rows: [{ id: 'DI-000123', rate: 92.5 | '' }]
function saveDebitRates_(rows) {
  return withLock_(() => {
    const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
    if (!(H.DRATE in t.c)) { // first time: add the column at the end of Diesel Issue
      t.sh.getRange(1, t.headers.length + 1).setValue(H.DRATE);
      TABLE_MEMO_ = {};
      return saveDebitRates_Inner_(rows);
    }
    return saveDebitRates_Inner_(rows);
  });
}
function saveDebitRates_Inner_(rows) {
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const col = t.c[H.DRATE] + 1;
  let n = 0;
  (rows || []).forEach(x => {
    const i = t.rows.findIndex(r => str_(r[t.c[H.ID]]) === str_(x.id));
    if (i === -1) throw new Error('Diesel issue ' + x.id + ' was not found.');
    let v = '';
    if (!blank_(x.rate)) { v = Number(x.rate); if (isNaN(v) || v < 0) throw new Error(x.id + ': rate must be a number, 0 or more.'); v = r2_(v); }
    if (String(t.rows[i][t.c[H.DRATE]]) !== String(v)) { t.sh.getRange(i + 2, col).setValue(v); n++; }
  });
  return { ok: true, count: n };
}

/* Machinery Cost Sheet – what every machinery cost in the period, with the working shown.
 *   Rent          = what the bill of the period works out to for this machinery (BOQ, day by day – the same calculation as
 *                   Machinery Billing, Idle days counted as paid). Own machinery has no rent in the app.
 *   Diesel cost   = diesel issued to it × the diesel rate of the period (the higher of the period average and the last
 *                   bought rate – the rate the bills use).
 *   Recovered     = the diesel the bill takes back from the party for this machinery (debit basis / over the standard).
 *   Net cost      = Rent + Diesel cost − Recovered.   Per hour / per KM = Net cost ÷ the hours / KM of the Log Book.
 * Nothing is saved; it is worked out from the Log Book, the diesel issues and the BOQ each time. */
function rptMachineCost_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const d = logDashboard_({ from: rg.from, to: rg.to, ownerships: f.ownerships || [], withDebit: true });
  const rate = num0_(d.dieselRate), groups = {};
  (d.machines || []).forEach(m => {
    if (!(m.workDays || m.issued || m.rent)) return;          // nothing happened with it in the period
    const rent = r2_(num0_(m.rent)), diesel = r2_(num0_(m.issued) * rate), rec = r2_(num0_(m.recover)), net = r2_(rent + diesel - rec);
    const row = { no: m.no, type: m.type, owner: m.owner, ownership: m.ownership, unit: m.unit, basis: m.basis || '', workDays: m.workDays, avail: m.avail,
      hrs: m.hrs, km: m.km, trips: m.trips, rent: rent, issued: m.issued, dieselCost: diesel, recover: rec, net: net,
      perHr: m.hrs ? r2_(net / m.hrs) : '', perKm: m.km ? r2_(net / m.km) : '', perDay: m.workDays ? r2_(net / m.workDays) : '',
      actualAvg: m.actualAvg, stdAvg: m.stdAvg, avgUnit: m.avgUnit };
    (groups[m.ownership] = groups[m.ownership] || []).push(row);
  });
  const sum = (list, k) => r2_(list.reduce((s, r) => s + num0_(r[k]), 0));
  const out = Object.keys(groups).sort(byGroupOrder_).map(g => { const list = groups[g].sort((a, b) => natCmp_(a.no, b.no));
    return { ownership: g, rows: list, rent: sum(list, 'rent'), issued: sum(list, 'issued'), dieselCost: sum(list, 'dieselCost'), recover: sum(list, 'recover'), net: sum(list, 'net'), hrs: sum(list, 'hrs'), km: sum(list, 'km') }; });
  const all = [].concat(...out.map(g => g.rows));
  return Object.assign(rptBase_('Machinery Cost Sheet', rg), { rate: rate, groups: out,
    total: { machines: all.length, rent: sum(all, 'rent'), issued: sum(all, 'issued'), dieselCost: sum(all, 'dieselCost'), recover: sum(all, 'recover'), net: sum(all, 'net'), hrs: sum(all, 'hrs'), km: sum(all, 'km') } });
}

/* 2. Diesel Cost Report – machinery-wise ₹, grouped Own → … → Debit */
function rptCost_(f) {
  f = f || {};
  const rg = rptRange_(f);
  if (f.rateMode === 'fixed' && !(num0_(f.fixedRate) > 0)) throw new Error('Enter the fixed rate.');
  const owns = (f.ownerships || []).map(String);
  const T = stockTables_();
  const rates = issueRates_(T);
  const rows = {};
  issueList_(T).forEach(x => {
    if (x.date < rg.from || x.date > rg.to) return;
    if (owns.length && owns.indexOf(x.ownership) === -1) return;
    const r = rows[x.key] = rows[x.key] || { no: x.no, type: x.type, owner: x.owner, ownership: x.ownership, supply: x.supply, entries: 0, qty: 0, amount: 0 };
    const rate = rateFor_(rates, x.idx, f);
    r.entries++; r.qty = r2_(r.qty + x.qty); r.amount = r2_(r.amount + x.qty * rate);
  });
  const groups = {};
  Object.keys(rows).forEach(k => { const r = rows[k]; r.rate = r.qty ? r2_(r.amount / r.qty) : 0; (groups[r.ownership] = groups[r.ownership] || []).push(r); });
  const out = Object.keys(groups).sort(byGroupOrder_).map(g => {
    const list = groups[g].sort((a, b) => natCmp_(a.no, b.no));
    return { ownership: g, rows: list, qty: r2_(list.reduce((s, r) => s + r.qty, 0)), amount: r2_(list.reduce((s, r) => s + r.amount, 0)), entries: list.reduce((s, r) => s + r.entries, 0) };
  });
  const qty = r2_(out.reduce((s, g) => s + g.qty, 0)), amount = r2_(out.reduce((s, g) => s + g.amount, 0));
  return Object.assign(rptBase_('Diesel Cost Report', rg), { rateText: rateLabel_(f), groups: out, total: { qty: qty, amount: amount, rate: qty ? r2_(amount / qty) : 0, machines: Object.keys(rows).length } });
}

/* 3. Diesel Purchase Register – every inward (pump bill) with pump-wise summary */
function rptPurchase_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const pump = clean_(f.pump).toUpperCase(), loc = str_(f.location);
  const t = table_(APP.SHEET_INWARD, INWARD_COLS_);
  const c = t.c;
  const rows = [];
  t.rows.forEach(r => {
    const dk = dkey_(r[c[H.DATE]]);
    if (!dk || dk < rg.from || dk > rg.to) return;
    if (loc && loc_(r[c[H.LOC]]) !== loc) return;
    if (isOpeningPump_(r[c[H.PUMP]]) || isExtraPump_(r[c[H.PUMP]])) return; // opening stock / extra diesel are not purchases
    if (pump && str_(r[c[H.PUMP]]).toUpperCase().indexOf(pump) === -1) return;
    rows.push({ date: dk, id: str_(r[c[H.IN_ID]]), pump: str_(r[c[H.PUMP]]), billNo: str_(r[c[H.BILLNO]]), billDate: r[c[H.BILLDATE]] === '' ? '' : dkey_(r[c[H.BILLDATE]]),
      location: loc_(r[c[H.LOC]]), qty: num0_(r[c[H.IN_QTY]]), rate: num0_(r[c[H.RATE]]), amount: num0_(r[c[H.AMOUNT]]) });
  });
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : natCmp_(a.id, b.id));
  const pumps = {};
  rows.forEach(r => { const p = pumps[r.pump] = pumps[r.pump] || { pump: r.pump, bills: 0, qty: 0, amount: 0 }; p.bills++; p.qty = r2_(p.qty + r.qty); p.amount = r2_(p.amount + r.amount); });
  const plist = Object.keys(pumps).sort(natCmp_).map(k => { const p = pumps[k]; p.rate = p.qty ? r2_(p.amount / p.qty) : 0; return p; });
  const qty = r2_(rows.reduce((s, r) => s + r.qty, 0)), amount = r2_(rows.reduce((s, r) => s + r.amount, 0));
  return Object.assign(rptBase_('Diesel Purchase Register', rg), { location: loc || 'All locations', rows: rows, pumps: plist, total: { bills: rows.length, qty: qty, amount: amount, rate: qty ? r2_(amount / qty) : 0 } });
}

/* 4. Machinery Diesel Ledger – one machinery, every diesel entry in the dates.
 * For each fill day: the Log Book work from that day until the day before the next fill ("run on this fill"),
 * and the average of that fill. Totals: all diesel in the dates, all Log Book work in the dates, period average. */
function rptLedger_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const m = findMachine_(f.no);
  const unit = m.unit, km = hasKm_(unit), hr = hasHr_(unit);
  const T = stockTables_();
  const issues = issueList_(T).filter(x => x.key === noKey_(m.id)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : shiftOrder_(a.shift) - shiftOrder_(b.shift) || a.idx - b.idx);
  // Log Book work per day for this machinery
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const lc = lt.c, work = {};
  lt.rows.forEach(r => {
    if (!same_(r[lc[H.NO]], m.id)) return;
    const dk = dkey_(r[lc[H.DATE]]); if (!dk) return;
    const w = work[dk] = work[dk] || { km: 0, hr: 0 };
    w.km = r2_(w.km + Math.max(0, num0_(r[lc[H.WKM]]))); w.hr = r2_(w.hr + Math.max(0, num0_(r[lc[H.WHR]])));
  });
  const fillDays = [...new Set(issues.map(x => x.date))];
  const dayQty = {}; issues.forEach(x => { dayQty[x.date] = r2_((dayQty[x.date] || 0) + x.qty); });
  const avgText = (q, k, h) => unit === 'KM' ? (k > 0 && q > 0 ? r2_(k / q) + ' km/L' : '') : unit === 'Hrs' ? (h > 0 && q > 0 ? r2_(q / h) + ' L/hr' : '') : unit === 'KM + Hrs' ? dualAvg_(q, k, h, m.kmStd, m.hrStd).text : '';
  const rows = [], shownDay = {};
  // everything stays inside the chosen period
  const inWork = (a, b) => { let k = 0, h = 0, n = 0; Object.keys(work).forEach(dk => { if (dk >= a && dk <= b && dk >= rg.from && dk <= rg.to) { k += work[dk].km; h += work[dk].hr; n++; } }); return { k: r2_(k), h: r2_(h), n: n }; };
  const pDays = fillDays.filter(dk => dk >= rg.from && dk <= rg.to);
  // work at the start of the period that still ran on diesel filled before the period
  const firstFill = pDays[0];
  const pre = inWork(rg.from, firstFill ? addDays_(firstFill, -1) : rg.to);
  if (pre.n && (pre.k || pre.h)) rows.push({ date: rg.from, shift: '', id: '', source: '', driver: '', qty: '', km: '', hr: '', kmRun: km ? pre.k : '', hrRun: hr ? pre.h : '', used: '',
    upto: firstFill ? addDays_(firstFill, -1) : rg.to, avg: 'On diesel filled before ' + dmy_(rg.from), remark: '', pre: true });
  issues.forEach(x => {
    if (x.date < rg.from || x.date > rg.to) return;
    const row = { date: x.date, shift: x.shift, id: x.id, source: x.source, driver: x.driver, qty: x.qty, km: x.km, hr: x.hr, kmRun: '', hrRun: '', used: '', avg: '', upto: '', remark: x.remark };
    if (!shownDay[x.date]) { // the fill-day figures go on the first entry of that day
      shownDay[x.date] = true;
      const i = fillDays.indexOf(x.date), next = fillDays[i + 1];
      const closes = !!next && next <= rg.to;                          // the next fill is inside the period
      const end = closes ? addDays_(next, -1) : rg.to;                    // never past the end of the period
      const w = inWork(x.date, end);
      row.kmRun = km ? w.k : ''; row.hrRun = hr ? w.h : ''; row.used = dayQty[x.date];
      row.upto = end;
      row.avg = closes ? (avgText(row.used, w.k, w.h) || (w.n ? '' : 'No Log Book')) : 'Still running at ' + dmy_(rg.to);
    }
    rows.push(row);
  });
  // period totals: diesel in the dates, Log Book work in the dates
  let tk = 0, th = 0;
  Object.keys(work).forEach(dk => { if (dk >= rg.from && dk <= rg.to) { tk += work[dk].km; th += work[dk].hr; } });
  const qty = r2_(rows.reduce((a, r) => a + num0_(r.qty), 0));
  return Object.assign(rptBase_('Machinery Diesel Ledger', rg), {
    machine: m, rows: rows,
    total: { entries: rows.filter(r => !r.pre).length, qty: qty, kmRun: km ? r2_(tk) : 0, hrRun: hr ? r2_(th) : 0, used: qty, overall: avgText(qty, km ? tk : 0, hr ? th : 0),
      std: unit === 'KM' ? (m.kmStd ? m.kmStd + ' km/L' : '') : unit === 'Hrs' ? (m.hrStd ? m.hrStd + ' L/hr' : '') : (m.kmStd ? m.kmStd + ' km/L, ' : '') + (m.hrStd ? m.hrStd + ' L/hr' : '') },
  });
}

/* 5. Owner / Vendor-wise Summary – with each owner's machinery */
function rptOwner_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const owns = (f.ownerships || []).map(String);
  const T = stockTables_();
  const rates = issueRates_(T);
  const owners = {};
  let total = 0, amountAll = 0;
  issueList_(T).forEach(x => {
    if (x.date < rg.from || x.date > rg.to) return;
    if (owns.length && owns.indexOf(x.ownership) === -1) return;
    const k = (x.owner || '(No owner)') + '|' + x.ownership;
    const o = owners[k] = owners[k] || { owner: x.owner || '(No owner)', ownership: x.ownership, qty: 0, amount: 0, entries: 0, machines: {} };
    const amt = x.qty * rateFor_(rates, x.idx, { rateMode: 'avg' });
    o.qty = r2_(o.qty + x.qty); o.amount = r2_(o.amount + amt); o.entries++;
    const mm = o.machines[x.key] = o.machines[x.key] || { no: x.no, type: x.type, qty: 0, entries: 0, bySource: {} };
    mm.qty = r2_(mm.qty + x.qty); mm.entries++;
    mm.bySource[x.source] = r2_((mm.bySource[x.source] || 0) + x.qty); // Dispenser / VTR Store
    total = r2_(total + x.qty); amountAll = r2_(amountAll + amt);
  });
  const list = Object.keys(owners).map(k => {
    const o = owners[k];
    o.machines = Object.keys(o.machines).map(m => o.machines[m]).sort((a, b) => b.qty - a.qty || natCmp_(a.no, b.no));
    o.share = total ? r2_(o.qty / total * 100) : 0;
    return o;
  }).sort((a, b) => byGroupOrder_(a.ownership, b.ownership) || b.qty - a.qty);
  // transfers between locations in the period (e.g. Dispenser → VTR Store)
  const tc = T.tt.c, transfers = [];
  T.tt.rows.forEach(r => {
    const dk = dkey_(r[tc[H.DATE]]);
    if (!dk || dk < rg.from || dk > rg.to) return;
    transfers.push({ id: str_(r[tc[H.TR_ID]]), date: dk, shift: str_(r[tc[H.SHIFT]]), from: loc_(r[tc[H.FROM]]), to: loc_(r[tc[H.TO]]), qty: num0_(r[tc[H.IN_QTY]]) });
  });
  transfers.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : shiftOrder_(a.shift) - shiftOrder_(b.shift));
  // stock position of every location and of all locations together for the period
  const locs = stockSummary_(events_(T), rg.from, rg.to);
  const sumL = k => r2_(locs.reduce((s, x) => s + x[k], 0));
  const combined = { loc: 'All locations', opening: sumL('opening'), inward: sumL('inward'), tin: 0, tout: 0, issued: sumL('issued'), closing: sumL('closing') };
  return Object.assign(rptBase_('Owner / Vendor-wise Diesel Summary', rg), {
    owners: list, total: { qty: total, amount: amountAll, owners: list.length }, locations: APP.LOCATIONS,
    transfers: transfers, transferQty: r2_(transfers.reduce((s, x) => s + x.qty, 0)),
    stock: locs.concat([combined]),
  });
}

/* 6. Type-wise Summary */
function rptType_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const owns = (f.ownerships || []).map(String);
  const T = stockTables_();
  const types = {};
  let total = 0;
  issueList_(T).forEach(x => {
    if (x.date < rg.from || x.date > rg.to) return;
    if (owns.length && owns.indexOf(x.ownership) === -1) return;
    const t = types[x.type || '(No type)'] = types[x.type || '(No type)'] || { type: x.type || '(No type)', qty: 0, entries: 0, machines: {}, byOwn: {} };
    t.qty = r2_(t.qty + x.qty); t.entries++; t.machines[x.key] = true; t.byOwn[x.ownership] = r2_((t.byOwn[x.ownership] || 0) + x.qty);
    total = r2_(total + x.qty);
  });
  const list = Object.keys(types).map(k => {
    const t = types[k]; const n = Object.keys(t.machines).length;
    return { type: t.type, qty: t.qty, entries: t.entries, machines: n, perMachine: n ? r2_(t.qty / n) : 0, perEntry: t.entries ? r2_(t.qty / t.entries) : 0, share: total ? r2_(t.qty / total * 100) : 0, byOwn: t.byOwn };
  }).sort((a, b) => b.qty - a.qty);
  return Object.assign(rptBase_('Type-wise Diesel Summary', rg), { types: list, total: { qty: total, types: list.length } });
}

/* 8. Stock Register – one location, every movement with running balance */
function rptStock_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const loc = checkLoc_(f.location, 'Location');
  const T = stockTables_();
  const ev = events_(T).filter(e => e.loc === loc);
  const ic = T.it.c, tc = T.tt.c, dc = T.dt.c;
  let opening = 0;
  const rows = [];
  let tin = 0, tout = 0;
  ev.forEach(e => {
    if (e.dk < rg.from || isOpenBefore_(e, rg.from)) { opening = e.bal; return; }
    if (e.dk > rg.to) return;
    let ref = '', part = '', shift = '';
    if (e.kind === 'inward') { const r = T.it.rows[e.idx]; ref = str_(r[ic[H.IN_ID]]); part = e.open ? 'Opening stock' : 'Inward – ' + str_(r[ic[H.PUMP]]) + (str_(r[ic[H.BILLNO]]) ? ' (Bill ' + str_(r[ic[H.BILLNO]]) + ')' : ''); }
    else if (e.kind === 'tin' || e.kind === 'tout') { const r = T.tt.rows[e.idx]; ref = str_(r[tc[H.TR_ID]]); shift = str_(r[tc[H.SHIFT]]); part = e.kind === 'tin' ? 'Received from ' + loc_(r[tc[H.FROM]]) : 'Sent to ' + loc_(r[tc[H.TO]]); }
    else { const r = T.dt.rows[e.idx]; ref = str_(r[dc[H.ID]]); shift = str_(r[dc[H.SHIFT]]); part = 'Issued – ' + str_(r[dc[H.NO]]) + (str_(r[dc[H.DRIVER]]) ? ' (' + str_(r[dc[H.DRIVER]]) + ')' : ''); }
    const inQ = e.q > 0 ? e.q : 0, outQ = e.q < 0 ? -e.q : 0;
    if (e.kind === 'tin') tin += inQ; if (e.kind === 'tout') tout += outQ;
    rows.push({ date: e.dk, shift: shift, kind: e.kind, ref: ref, part: part, inQ: r2_(inQ), outQ: r2_(outQ), bal: e.bal });
  });
  const inTot = r2_(rows.reduce((s, r) => s + r.inQ, 0)), outTot = r2_(rows.reduce((s, r) => s + r.outQ, 0));
  return Object.assign(rptBase_('Diesel Stock Register – ' + loc, rg), { location: loc, opening: opening, rows: rows,
    total: { inQ: inTot, outQ: outTot, closing: r2_(opening + inTot - outTot), tin: r2_(tin), tout: r2_(tout), entries: rows.length } });
}

/* 13. Month vs Month – machinery-wise diesel in two months */
function rptCompare_(f) {
  f = f || {};
  const ma = str_(f.monthA), mb = str_(f.monthB);
  if (!/^\d{4}-\d{2}$/.test(ma) || !/^\d{4}-\d{2}$/.test(mb)) throw new Error('Select both months.');
  const owns = (f.ownerships || []).map(String);
  const T = stockTables_();
  const rows = {};
  issueList_(T).forEach(x => {
    const mk = x.date.slice(0, 7);
    if (mk !== ma && mk !== mb) return;
    if (owns.length && owns.indexOf(x.ownership) === -1) return;
    const r = rows[x.key] = rows[x.key] || { no: x.no, type: x.type, owner: x.owner, ownership: x.ownership, a: 0, b: 0 };
    if (mk === ma) r.a = r2_(r.a + x.qty); if (mk === mb) r.b = r2_(r.b + x.qty);
  });
  const groups = {};
  Object.keys(rows).forEach(k => { const r = rows[k]; r.diff = r2_(r.b - r.a); r.pct = r.a ? r2_((r.b - r.a) / r.a * 100) : ''; (groups[r.ownership] = groups[r.ownership] || []).push(r); });
  const out = Object.keys(groups).sort(byGroupOrder_).map(g => {
    const list = groups[g].sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || natCmp_(x.no, y.no));
    const a = r2_(list.reduce((s, r) => s + r.a, 0)), b = r2_(list.reduce((s, r) => s + r.b, 0));
    return { ownership: g, rows: list, a: a, b: b, diff: r2_(b - a), pct: a ? r2_((b - a) / a * 100) : '' };
  });
  const A = r2_(out.reduce((s, g) => s + g.a, 0)), B = r2_(out.reduce((s, g) => s + g.b, 0));
  const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const name = k => FULL[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4);
  return Object.assign(rptBase_('Month vs Month Diesel Comparison'), { monthA: ma, monthB: mb, nameA: name(ma), nameB: name(mb), groups: out,
    total: { a: A, b: B, diff: r2_(B - A), pct: A ? r2_((B - A) / A * 100) : '' } });
}

/* 14. Actual vs Standard Average – for the whole chosen period, machinery by machinery:
 *   Diesel issued = all Diesel Issue entries in the dates (every shift, Dispenser + VTR Store)
 *   KM / Hrs run  = all Log Book work in the dates (sum of each entry's Total)
 *   Actual average from those two totals; Standard from Master; diesel the standard needs for that work;
 *   More / (Less) and status: over 10% → High consumption, within 10% → Balanced, under 10% → Low consumption.
 * (Same way of working as the Log Book period total and the Monthly Diesel & Average report.) */
function rptAverage_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const owns = (f.ownerships || []).map(String);
  const T = stockTables_();
  const master = {};
  getMaster_().forEach(m => { master[noKey_(m.id)] = m; });
  const own = k => master[k] ? (APP.OWNERSHIP.indexOf(master[k].ownership) > -1 ? master[k].ownership : 'Other') : 'Not in Master';
  const rows = {};
  const row = (k, name) => rows[k] = rows[k] || { key: k, no: master[k] ? master[k].id : name, fills: 0, used: 0, runs: 0, km: 0, hr: 0 };
  // diesel issued in the period
  issueList_(T).forEach(x => { if (x.date < rg.from || x.date > rg.to) return; const r = row(x.key, x.no); r.fills++; r.used = r2_(r.used + x.qty); });
  // Log Book work in the period
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const lc = lt.c, days = {};
  lt.rows.forEach(r => {
    const dk = dkey_(r[lc[H.DATE]]); if (!dk || dk < rg.from || dk > rg.to) return;
    const k = noKey_(r[lc[H.NO]]), x = row(k, str_(r[lc[H.NO]]));
    (days[k] = days[k] || {})[dk] = true;
    x.km = r2_(x.km + Math.max(0, num0_(r[lc[H.WKM]]))); x.hr = r2_(x.hr + Math.max(0, num0_(r[lc[H.WHR]])));
  });
  const groups = {};
  Object.keys(rows).forEach(k => {
    const r = rows[k], m = master[k] || {}, ow = own(k);
    if (owns.length && owns.indexOf(ow) === -1) return;
    if (m.supply === 'Debit Basis') return; // Debit Basis machinery keep no readings
    const unit = m.unit || '–', km = hasKm_(unit), hr = hasHr_(unit);
    r.runs = days[k] ? Object.keys(days[k]).length : 0;
    Object.assign(r, { type: m.type || '', owner: m.owner || '', ownership: ow, unit: unit, kmStd: m.kmStd, hrStd: m.hrStd, actual: '', std: '', expected: '', excess: '', pct: '', status: '' });
    if (!km) r.km = ''; if (!hr) r.hr = '';
    r.std = [km && m.kmStd ? m.kmStd + ' km/L' : '', hr && m.hrStd ? m.hrStd + ' L/hr' : ''].filter(Boolean).join(' + ');
    const work = (km ? num0_(r.km) : 0) + (hr ? num0_(r.hr) : 0);
    if (!r.runs) r.status = 'No Log Book readings';
    else if (!(work > 0)) r.status = 'No work in Log Book';
    else if (!(r.used > 0)) r.status = 'No diesel issued';
    else {
      if (unit === 'KM') r.actual = r2_(r.km / r.used) + ' km/L';
      else if (unit === 'Hrs') r.actual = r2_(r.used / r.hr) + ' L/hr';
      else if (unit === 'KM + Hrs') r.actual = dualAvg_(r.used, r.km, r.hr, m.kmStd, m.hrStd).text;
      const need = r2_((km && m.kmStd > 0 ? num0_(r.km) / m.kmStd : 0) + (hr && m.hrStd > 0 ? num0_(r.hr) * m.hrStd : 0));
      const stdSet = (!km || m.kmStd > 0) && (!hr || m.hrStd > 0);
      if (!stdSet || !(need > 0)) r.status = 'Standard not set in Master';
      else {
        r.expected = need; r.excess = r2_(r.used - need); r.pct = r2_((r.used - need) / need * 100);
        r.status = r.pct > 10 ? 'High consumption' : r.pct < -10 ? 'Low consumption' : 'Balanced';
      }
    }
    (groups[ow] = groups[ow] || []).push(r);
  });
  const rank = r => r.status === 'High consumption' ? 0 : r.status === 'Balanced' ? 1 : r.status === 'Low consumption' ? 2 : 3;
  const out = Object.keys(groups).sort(byGroupOrder_).map(g => ({ ownership: g, rows: groups[g].sort((a, b) => rank(a) - rank(b) || (b.pct === '' ? -1e9 : b.pct) - (a.pct === '' ? -1e9 : a.pct) || natCmp_(a.no, b.no)) }));
  const flat = [].concat.apply([], out.map(g => g.rows));
  const withStd = flat.filter(r => r.expected !== '');
  const used = r2_(withStd.reduce((s, r) => s + r.used, 0)), exp = r2_(withStd.reduce((s, r) => s + r.expected, 0));
  return Object.assign(rptBase_('Actual vs Standard Average', rg), { groups: out,
    total: { used: used, expected: exp, excess: r2_(used - exp), machines: flat.length, excessCount: flat.filter(r => r.status === 'High consumption').length,
      issuedAll: r2_(flat.reduce((s, r) => s + r.used, 0)) } });
}

/* ================= LOG BOOK ================= */
function getLogPrefill_(no, dateStr, shiftIn) {
  const dk = checkDate_(dateStr);
  const shift = checkShift_(shiftIn);
  const m = findMachine_(no);
  const ds = dieselSummary_(m.id, dk, shift);
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const prev = previousLog_(lt, m.id, dk, shift);
  const exists = lt.rows.some(r => same_(r[lt.c[H.NO]], m.id) && dkey_(r[lt.c[H.DATE]]) === dk && str_(r[lt.c[H.SHIFT]]) === shift);
  return {
    machine: m, dieselQty: ds.qty, kmReading: ds.km, hrReading: ds.hr, driver: ds.driver,
    openingKm: prev ? numOrBlank_(prev[lt.c[H.CKM]]) : '',
    openingHr: prev ? numOrBlank_(prev[lt.c[H.CHR]]) : '',
    prevStock: prev ? num0_(prev[lt.c[H.STOCK]]) : 0,
    exists: exists,
  };
}

function saveLogBook_(l) {
  return withLock_(() => {
    const dk = entryDate_(l.date);
    const shift = checkShift_(l.shift);
    const m = findMachine_(l.no);
    assertActive_(m, dk);
    const driver = clean_(l.driver);
    if (!driver) throw new Error('Enter the Driver Name.');
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const dup = lt.rows.some(r => same_(r[lt.c[H.NO]], m.id) && dkey_(r[lt.c[H.DATE]]) === dk && str_(r[lt.c[H.SHIFT]]) === shift);
    if (dup) throw new Error('Log Book entry for ' + m.id + ' on ' + dk + ' (' + shift + ') already exists.');

    let okm = '', ckm = '', wkm = '', ohr = '', chr = '', whr = '', ckmc = '', chrc = '';
    if (hasKm_(m.unit)) {
      okm = reqReading_(l.openingKm, 'Opening KM');
      ckm = reqReading_(l.closingKm, 'Closing KM');
      if (ckm < okm) throw new Error('Closing KM cannot be less than Opening KM.');
      wkm = r2_(ckm - okm);
      ckmc = m.kmStd > 0 ? r2_(wkm / m.kmStd) : '';
    }
    if (hasHr_(m.unit)) {
      ohr = reqReading_(l.openingHr, 'Opening Hrs');
      chr = reqReading_(l.closingHr, 'Closing Hrs');
      if (chr < ohr) throw new Error('Closing Hrs cannot be less than Opening Hrs.');
      whr = r2_(chr - ohr);
      chrc = m.hrStd > 0 ? r2_(whr * m.hrStd) : '';
    }
    const tot = r2_(num0_(ckmc) + num0_(chrc));
    const ds = dieselSummary_(m.id, dk, shift);

    const row = newRow_(lt);
    set_(row, lt, H.DATE, toDate_(dk));
    set_(row, lt, H.NO, m.id);
    set_(row, lt, H.SHIFT, shift);
    set_(row, lt, H.OWNER, m.owner);
    set_(row, lt, H.QTY, ds.qty);
    set_(row, lt, H.KMR, ds.km);
    set_(row, lt, H.HRR, ds.hr);
    set_(row, lt, H.TYPE, m.type);
    set_(row, lt, H.UNIT, m.unit);
    set_(row, lt, H.OKM, okm); set_(row, lt, H.CKM, ckm); set_(row, lt, H.WKM, wkm);
    set_(row, lt, H.OHR, ohr); set_(row, lt, H.CHR, chr); set_(row, lt, H.WHR, whr);
    set_(row, lt, H.KMSTD, hasKm_(m.unit) ? m.kmStd : '');
    set_(row, lt, H.HRSTD, hasHr_(m.unit) ? m.hrStd : '');
    set_(row, lt, H.CKMC, ckmc); set_(row, lt, H.CHRC, chrc); set_(row, lt, H.TOT, tot);
    set_(row, lt, H.TRIP, numOrBlank_(l.trip));
    set_(row, lt, H.CH, clean_(l.chainage));
    set_(row, lt, H.WORK, clean_(l.workDone));
    set_(row, lt, H.DRIVER, driver);
    lt.sh.appendRow(row);

    recalcStock_(m.id);
    return { ok: true };
  });
}

function logRowOut_(t, r) {
  return {
    date: dkey_(r[t.c[H.DATE]]), owner: str_(r[t.c[H.OWNER]]),
    shift: str_(r[t.c[H.SHIFT]]), no: str_(r[t.c[H.NO]]), type: str_(r[t.c[H.TYPE]]),
    unit: str_(r[t.c[H.UNIT]]), qty: numOrBlank_(r[t.c[H.QTY]]),
    wkm: numOrBlank_(r[t.c[H.WKM]]), whr: numOrBlank_(r[t.c[H.WHR]]),
    tot: numOrBlank_(r[t.c[H.TOT]]), stock: numOrBlank_(r[t.c[H.STOCK]]),
    trip: numOrBlank_(r[t.c[H.TRIP]]), chainage: str_(r[t.c[H.CH]]), work: str_(r[t.c[H.WORK]]),
    driver: str_(r[t.c[H.DRIVER]]), okm: numOrBlank_(r[t.c[H.OKM]]), ckm: numOrBlank_(r[t.c[H.CKM]]), ohr: numOrBlank_(r[t.c[H.OHR]]), chr: numOrBlank_(r[t.c[H.CHR]]),
    chFrom: str_(r[t.c[H.CHFROM]]), chTo: str_(r[t.c[H.CHTO]]), remark: str_(r[t.c[H.REMARK]]), avg: str_(r[t.c[H.AVG]]), extra: numOrBlank_(r[t.c[H.EXTRA]]),
    dread: str_(r[t.c[H.DREAD]]), kmStd: numOrBlank_(r[t.c[H.KMSTD]]), hrStd: numOrBlank_(r[t.c[H.HRSTD]]),
    stdUse: numOrBlank_(r[t.c[H.TOT]]), cycle: H.CYCLE in t.c ? str_(r[t.c[H.CYCLE]]) : '',
    odsl: H.ODSL in t.c ? numOrBlank_(r[t.c[H.ODSL]]) : '',
    odSet: H.ODSET in t.c ? numOrBlank_(r[t.c[H.ODSET]]) : '', // opening diesel typed on the 1st of a month
    kmr: H.KMR in t.c ? numOrBlank_(r[t.c[H.KMR]]) : '', hrr: H.HRR in t.c ? numOrBlank_(r[t.c[H.HRR]]) : '', // reading at the day's diesel fill
    enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '', updatedBy: H.UBY in t.c ? str_(r[t.c[H.UBY]]) : '',
    mode: str_(r[t.c[H.UNIT]]), tStart: H.TSTART in t.c ? tStr_(r[t.c[H.TSTART]]) : '', tEnd: H.TEND in t.c ? tStr_(r[t.c[H.TEND]]) : '',
    tBrk: H.TBRK in t.c ? numOrBlank_(r[t.c[H.TBRK]]) : '', tHrs: H.THRS in t.c ? numOrBlank_(r[t.c[H.THRS]]) : '', challan: H.CHALLAN in t.c ? str_(r[t.c[H.CHALLAN]]) : '',
    itemWork: H.ITEMS in t.c ? itemWorkParse_(r[t.c[H.ITEMS]]) : {}, // Item-wise BOQ: the typed items of this entry
    debitTo: H.DEBITTO in t.c ? str_(r[t.c[H.DEBITTO]]) : '', debitRate: H.DEBITRATE in t.c ? numOrBlank_(r[t.c[H.DEBITRATE]]) : '', // work charged to a party
  };
}
// a time cell back to "HH:MM" (the sheet may hand back a Date for a time)
function tStr_(v) { if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'HH:mm'); const s = str_(v); const x = hhmm_(s); return x === null ? s : String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); }
function getLogBook_(dateStr) {
  const dk = checkDate_(dateStr);
  const t = table_(APP.SHEET_LOG, logHeaders_());
  return t.rows.filter(r => dkey_(r[t.c[H.DATE]]) === dk).map(r => logRowOut_(t, r));
}
/* Log Book list with filters – all optional, blank = all.
 * f: { from, to, no, shift, ownership, owner, type, q (chainage / work / driver text) }
 * Totals are always for every matching entry; the list shows the latest 500. */
function getLogBookList_(f) {
  f = f || {};
  const from = str_(f.from) ? checkDate_(f.from) : '', to = str_(f.to) ? checkDate_(f.to) : '';
  if (from && to && from > to) throw new Error('From date is after To date.');
  const no = clean_(f.no), shift = str_(f.shift), own = str_(f.ownership), owner = clean_(f.owner).toUpperCase(), type = clean_(f.type).toUpperCase(), q = clean_(f.q).toUpperCase();
  const ownIdx = ownershipIndex_();
  const t = table_(APP.SHEET_LOG, logHeaders_());
  const hits = [];
  const tot = { km: 0, hr: 0, issued: 0, consumed: 0, machines: {} };
  t.rows.forEach(r => {
    const dk = dkey_(r[t.c[H.DATE]]);
    if (!dk || (from && dk < from) || (to && dk > to)) return;
    if (no && !same_(r[t.c[H.NO]], no) && str_(r[t.c[H.NO]]).toUpperCase().indexOf(no.toUpperCase()) === -1) return;
    if (shift && (str_(r[t.c[H.SHIFT]]) || 'Full Day') !== shift) return;
    if (own && (ownIdx[noKey_(r[t.c[H.NO]])] || 'Not in Master') !== own) return;
    if (owner && str_(r[t.c[H.OWNER]]).toUpperCase().indexOf(owner) === -1) return;
    if (type && str_(r[t.c[H.TYPE]]).toUpperCase().indexOf(type) === -1) return;
    if (q && [r[t.c[H.CHFROM]], r[t.c[H.CHTO]], r[t.c[H.CH]], r[t.c[H.WORK]], r[t.c[H.REMARK]], r[t.c[H.DRIVER]]].map(str_).join(' ').toUpperCase().indexOf(q) === -1) return;
    hits.push(r);
    tot.km += num0_(r[t.c[H.WKM]]); tot.hr += num0_(r[t.c[H.WHR]]); tot.issued += num0_(r[t.c[H.QTY]]); tot.consumed += num0_(r[t.c[H.TOT]]);
    tot.machines[noKey_(r[t.c[H.NO]])] = true;
  });
  hits.sort((a, b) => cmpKey_(b, a, t.c) || natCmp_(str_(a[t.c[H.NO]]), str_(b[t.c[H.NO]])));
  /* Period total for every machinery: all its entries in the chosen dates added up
   * (first Start, last Close, total KM / Hrs, diesel issued, diesel as per standard, average for the period) */
  const by = {};
  hits.slice().reverse().forEach(r => { // oldest first
    const k = noKey_(r[t.c[H.NO]]);
    const x = by[k] = by[k] || { no: str_(r[t.c[H.NO]]), type: str_(r[t.c[H.TYPE]]), unit: str_(r[t.c[H.UNIT]]), entries: 0, days: {}, firstDate: '', lastDate: '',
      okm: '', ohr: '', ckm: '', chr: '', km: 0, hr: 0, issued: 0, consumed: 0, kmStd: numOrBlank_(r[t.c[H.KMSTD]]), hrStd: numOrBlank_(r[t.c[H.HRSTD]]), ownership: ownIdx[k] || 'Not in Master' };
    const dk = dkey_(r[t.c[H.DATE]]);
    if (!x.entries) { x.firstDate = dk; x.okm = numOrBlank_(r[t.c[H.OKM]]); x.ohr = numOrBlank_(r[t.c[H.OHR]]); }
    x.entries++; x.days[dk] = true; x.lastDate = dk;
    x.ckm = numOrBlank_(r[t.c[H.CKM]]); x.chr = numOrBlank_(r[t.c[H.CHR]]);
    x.km = r2_(x.km + Math.max(0, num0_(r[t.c[H.WKM]]))); x.hr = r2_(x.hr + Math.max(0, num0_(r[t.c[H.WHR]])));
    x.issued = r2_(x.issued + num0_(r[t.c[H.QTY]])); x.consumed = r2_(x.consumed + num0_(r[t.c[H.TOT]]));
  });
  const summary = Object.keys(by).map(k => {
    const x = by[k]; x.days = Object.keys(x.days).length;
    const u = x.unit;
    x.average = u === 'KM' ? (x.km > 0 && x.issued > 0 ? r2_(x.km / x.issued) + ' km/L' : '') : u === 'Hrs' ? (x.hr > 0 && x.issued > 0 ? r2_(x.issued / x.hr) + ' L/hr' : '') : u === 'KM + Hrs' ? dualAvg_(x.issued, x.km, x.hr, x.kmStd, x.hrStd).text : '';
    x.diff = x.consumed > 0 || x.issued > 0 ? r2_(x.issued - x.consumed) : '';
    return x;
  }).sort((a, b) => groupRank_(a.ownership) - groupRank_(b.ownership) || natCmp_(a.no, b.no));
  return {
    summary: summary,
    count: hits.length,
    totals: { km: r2_(tot.km), hr: r2_(tot.hr), issued: r2_(tot.issued), consumed: r2_(tot.consumed), machines: Object.keys(tot.machines).length },
    rows: (f.all ? hits : hits.slice(0, 500)).map(r => logItemsOut_(Object.assign(logRowOut_(t, r), { key: logKeyOf_(t, r), ownership: ownIdx[noKey_(r[t.c[H.NO]])] || 'Not in Master' }))),
    itemBoq: itemBoqNow_(to || today_()),
  };
}

// Item-wise BOQ: the quantity of every item for this entry (rows of other machinery are left as they are)
function logItemsOut_(o) {
  if (!itemNos_()[noKey_(o.no)]) return o;
  let m = null; try { m = findMachine_(o.no); } catch (e) { m = null; }
  const items = m ? boqItemsOn_(m, o.date) : [];
  if (!items.length) return o;
  const q = itemQtyOf_(items, { mode: o.mode || o.unit, whr: o.whr, wkm: o.wkm, trip: o.trip, work: o.itemWork });
  o.itemQty = q.list; o.itemOver = q.over; o.itemUnknown = q.unknown; o.itemLeft = q.left; o.boqItems = itemBrief_(items);
  return o;
}
// the items of every Item-wise machinery on a date: { machinery: [{ name, basis, qty }] } (Excel export, hints)
function itemBoqNow_(dk) {
  const out = {};
  try { getMaster_().forEach(m => { if (!itemNos_()[noKey_(m.id)]) return; const it = boqItemsOn_(m, dk); if (it.length) out[m.id] = itemBrief_(it); }); } catch (e) { /* no BOQ */ }
  return out;
}

/* ================= FILL-TO-FILL AVERAGE =================
 * Diesel filled on one day is used until the next fill. So the real average is worked out per "fill cycle":
 *   cycle  = from a fill day up to the day before the next fill
 *   work   = Working KM / Hrs of all Log Book days in the cycle
 *   std    = diesel the standard says that work needs (KM ÷ km/L + Hrs × L/hr)
 *   actual = diesel filled at the start of the cycle
 *   average: KM → work KM ÷ diesel (km/L); Hrs → diesel ÷ work Hrs (L/hr); KM + Hrs → diesel vs std
 *   Extra / (Short) = diesel filled − std  (only once the next fill has happened and the cycle is closed) */
function fillDays_(no) {
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const f = {};
  t.rows.forEach(r => { if (same_(r[t.c[H.NO]], no)) { const dk = dkey_(r[t.c[H.IDATE]]); if (dk) f[dk] = r2_((f[dk] || 0) + num0_(r[t.c[H.QTY]])); } });
  Object.keys(f).forEach(k => { if (!(f[k] > 0)) delete f[k]; });
  return f;
}
/* KM + Hrs machinery (vehicle engine + working engine) get one diesel figure for both.
 * The diesel is split between the KM part and the Hrs part in the ratio the Standard Average says each part needs
 *   (KM ÷ km/L  :  Hrs × L/hr), and each part gets its own actual average:  km/L = KM ÷ its diesel,  L/hr = its diesel ÷ Hrs.
 * Only KM worked → all diesel is the KM part; only Hrs worked → all diesel is the Hrs part. */
function dualAvg_(diesel, km, hr, kmStd, hrStd) {
  km = num0_(km); hr = num0_(hr); kmStd = num0_(kmStd); hrStd = num0_(hrStd); diesel = num0_(diesel);
  if (!(diesel > 0) || !(km > 0 || hr > 0)) return { text: '', kmpl: '', lph: '' };
  let dKm, dHr;
  const needKm = km > 0 && kmStd > 0 ? km / kmStd : 0, needHr = hr > 0 && hrStd > 0 ? hr * hrStd : 0;
  if (needKm + needHr > 0) { dKm = diesel * needKm / (needKm + needHr); dHr = diesel * needHr / (needKm + needHr); }
  else if (km > 0 && hr > 0) return { text: '', kmpl: '', lph: '' }; // no standard to split by
  else { dKm = km > 0 ? diesel : 0; dHr = hr > 0 ? diesel : 0; }
  const kmpl = km > 0 && dKm > 0 ? r2_(km / dKm) : '', lph = hr > 0 && dHr > 0 ? r2_(dHr / hr) : '';
  return { kmpl: kmpl, lph: lph, text: [kmpl !== '' ? kmpl + ' km/L' : '', lph !== '' ? lph + ' L/hr' : ''].filter(Boolean).join(' + ') };
}
function avgText_(unit, diesel, km, hr, kmStd, hrStd) {
  if (unit === 'KM') return km > 0 && diesel > 0 ? r2_(km / diesel) + ' km/L' : '';
  if (unit === 'Hrs') return hr > 0 && diesel > 0 ? r2_(diesel / hr) + ' L/hr' : '';
  if (unit === 'KM + Hrs') return dualAvg_(diesel, km, hr, kmStd, hrStd).text;
  return '';
}
function cycleText_(unit, c, m) {
  if (!c) return '';
  if (unit === 'KM') return c.km > 0 ? r2_(c.km / c.qty) + ' km/L' : '';
  if (unit === 'Hrs') return c.hr > 0 ? r2_(c.qty / c.hr) + ' L/hr' : '';
  return m ? dualAvg_(c.qty, c.km, c.hr, m.kmStd, m.hrStd).text : '';
}
// all cycles of one machinery from its fills and Log Book rows (rows: [{dk, wkm, whr, std}])
function buildCycles_(unit, fills, rows, lastKnown, m) {
  const days = Object.keys(fills).sort();
  return days.map((d, i) => {
    const next = days[i + 1] || '';
    const end = next ? addDays_(next, -1) : '';
    const inC = rows.filter(r => r.dk >= d && (!end || r.dk <= end));
    const c = { start: d, end: end, closed: !!next, qty: fills[d], km: 0, hr: 0, std: 0, logged: inC.length };
    inC.forEach(r => { c.km = r2_(c.km + num0_(r.wkm)); c.hr = r2_(c.hr + num0_(r.whr)); c.std = r2_(c.std + num0_(r.std)); });
    const lastDay = end || lastKnown || d;
    c.days = daysBetween_(d, lastDay) + 1;
    c.missing = Math.max(0, c.days - c.logged);
    c.avg = cycleText_(unit, c, m);
    c.extra = c.closed && c.std > 0 ? r2_(c.qty - c.std) : '';
    return c;
  });
}
function logRowsOf_(lt, no) {
  const c = lt.c;
  const pos = v => v === '' ? '' : Math.max(0, v); // negative totals are waiting for correction: no work counted
  return lt.rows.map((r, i) => ({ i: i, r: r, dk: dkey_(r[c[H.DATE]]), wkm: pos(numOrBlank_(r[c[H.WKM]])), whr: pos(numOrBlank_(r[c[H.WHR]])), std: numOrBlank_(r[c[H.TOT]]) }))
    .filter(x => x.dk && same_(x.r[c[H.NO]], no)).sort((a, b) => cmpKey_(a.r, b.r, c) || a.i - b.i);
}
// Writes the fill-cycle average into every Log Book row of one machinery
function recalcCycles_(no) {
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  let m; try { m = findMachine_(no); } catch (e) { return; }
  const rows = logRowsOf_(lt, no);
  if (!rows.length) return;
  const cycles = buildCycles_(m.unit, fillDays_(m.id), rows, rows[rows.length - 1].dk, m);
  const show = k => k.split('-').reverse().join('-');
  const firstRowOf = {};
  rows.forEach(x => {
    const cy = cycles.filter(q => q.start <= x.dk && (!q.end || x.dk <= q.end)).pop();
    let avg = 'No diesel filled yet', extra = '', text = '';
    if (cy) {
      avg = cy.closed ? (cy.avg || '–') + ' (fill ' + show(cy.start) + ')' : 'Running on fill of ' + show(cy.start);
      text = show(cy.start) + ' → ' + (cy.end ? show(cy.end) : 'running') + '  |  ' + cy.qty + ' L filled  |  ' +
        [hasKm_(m.unit) ? cy.km + ' km' : '', hasHr_(m.unit) ? cy.hr + ' hr' : ''].filter(Boolean).join(' + ') + '  |  std ' + cy.std + ' L' +
        (cy.closed && cy.extra !== '' ? '  |  ' + (cy.extra > 0 ? 'Extra +' + cy.extra + ' L' : cy.extra < 0 ? 'Short ' + (-cy.extra) + ' L' : 'As per standard') : '') + (cy.missing ? '  |  Log Book missing ' + cy.missing + ' day(s)' : '');
      if (!firstRowOf[cy.start]) { firstRowOf[cy.start] = true; extra = cy.extra; } // count Extra/Short once per cycle
    }
    const put = (h, v) => { if (h in c && String(x.r[c[h]]) !== String(v)) lt.sh.getRange(x.i + 2, c[h] + 1).setValue(v); };
    put(H.AVG, avg); put(H.EXTRA, extra); put(H.CYCLE, text);
  });
}
// Cycle facts for the Log Book entry screen: the fill running before this date, and (if diesel is filled today) its closing result
function cycleFor_(lt, m, dk) {
  const fills = fillDays_(m.id);
  const rows = logRowsOf_(lt, m.id).filter(x => x.dk < dk);
  const before = {};
  Object.keys(fills).forEach(d => { if (d < dk) before[d] = fills[d]; });
  const cyc = buildCycles_(m.unit, before, rows, addDays_(dk, -1), m);
  const cur = cyc.length ? cyc[cyc.length - 1] : null; // running on the day before this date
  const fillToday = fills[dk] || 0;
  let prevClosed = null;
  if (cur && fillToday > 0) {
    prevClosed = Object.assign({}, cur, { closed: true, end: addDays_(dk, -1) });
    prevClosed.extra = prevClosed.std > 0 ? r2_(prevClosed.qty - prevClosed.std) : '';
    prevClosed.avg = cycleText_(m.unit, prevClosed, m);
  }
  return { cycle: cur ? { start: cur.start, qty: cur.qty, km: cur.km, hr: cur.hr, std: cur.std, days: cur.days, missing: cur.missing } : null, prevClosed: prevClosed };
}

/* ================= DAILY LOG BOOK (one entry per machinery per day) =================
 * Opening = Closing of the machinery's previous Log Book entry (first entry ever: 0, can be typed).
 * Diesel  = all Diesel Issue of that machinery on that date added together (every shift, Dispenser + VTR Store).
 * Actual average and Extra / Short are worked out from the day's working KM / Hrs and the Standard Average in Master. */
function dieselDay_(no, dk) {
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const c = t.c;
  let qty = 0, driver = '';
  const reads = [];
  t.rows.filter(r => same_(r[c[H.NO]], no) && dkey_(r[c[H.IDATE]]) === dk).sort((a, b) => cmpDiesel_(a, b, c)).forEach(r => {
    const q = num0_(r[c[H.QTY]]); qty += q;
    const km = numOrBlank_(r[c[H.KMR]]), hr = numOrBlank_(r[c[H.HRR]]);
    reads.push({ shift: str_(r[c[H.SHIFT]]), source: loc_(r[c[H.SOURCE]]), qty: q, km: km, hr: hr });
    if (str_(r[c[H.DRIVER]])) driver = str_(r[c[H.DRIVER]]);
  });
  const text = reads.map(x => x.qty + ' L' + (x.km !== '' ? ' @ ' + x.km + ' km' : '') + (x.hr !== '' ? ' @ ' + x.hr + ' hr' : '') + ' (' + x.source + ', ' + x.shift + ')').join('; ');
  return { qty: r2_(qty), reads: reads, text: text, driver: driver,
    km: reads.reduce((v, x) => x.km !== '' ? x.km : v, ''), hr: reads.reduce((v, x) => x.hr !== '' ? x.hr : v, '') };
}
const blank_ = v => v === '' || v === null || v === undefined;
function prevLogOf_(lt, no, dk) {
  let best = null;
  lt.rows.forEach(r => {
    if (!same_(r[lt.c[H.NO]], no) || dkey_(r[lt.c[H.DATE]]) >= dk) return;
    if (!best || cmpKey_(r, best, lt.c) >= 0) best = r;
  });
  return best;
}
// Working, standard consumption, actual average and extra/short for one day
// one entry: work and diesel as per the Standard Average. mode = how the entry is measured (KM / Hrs / KM + Hrs / Time / Trip / Day)
function logCalc_(m, diesel, okm, ckm, ohr, chr, mode, tHrs) {
  const md = mode || m.unit, km = hasKm_(md), hr = hasHr_(md), tm = md === 'Time';
  const wkm = km && okm !== '' && ckm !== '' ? r2_(ckm - okm) : '';
  const whr = hr && ohr !== '' && chr !== '' ? r2_(chr - ohr) : tm && tHrs !== '' && tHrs !== null && tHrs !== undefined ? r2_(tHrs) : '';
  const ckmc = km && wkm !== '' && m.kmStd > 0 ? r2_(wkm / m.kmStd) : '';
  const chrc = (hr || tm) && whr !== '' && m.hrStd > 0 ? r2_(whr * m.hrStd) : '';
  const tot = r2_(num0_(ckmc) + num0_(chrc));
  let avg = '';
  if (md === 'KM' && wkm !== '' && diesel > 0) avg = r2_(wkm / diesel) + ' km/L';
  else if ((md === 'Hrs' || tm) && whr > 0 && diesel > 0) avg = r2_(diesel / whr) + ' L/hr';
  else if (md === 'KM + Hrs' && (wkm !== '' || whr !== '')) avg = dualAvg_(diesel, wkm, whr, m.kmStd, m.hrStd).text;
  const extra = tot > 0 || diesel > 0 ? r2_(diesel - tot) : '';
  return { wkm: wkm, whr: whr, ckmc: ckmc, chrc: chrc, tot: tot, avg: avg, extra: extra };
}
// Everything the Log Book needs for these machinery on this date
function getLogDayPrefill_(dateStr, nos) {
  const dk = checkDate_(dateStr);
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  return (nos || []).filter(n => str_(n)).map(n => {
    const m = findMachine_(n);
    const prev = prevLogOf_(lt, m.id, dk);
    const ds = dieselDay_(m.id, dk);
    const exists = lt.rows.some(r => same_(r[lt.c[H.NO]], m.id) && dkey_(r[lt.c[H.DATE]]) === dk);
    let problem = '';
    try { assertActive_(m, dk); } catch (e) { problem = e.message; }
    const cy = cycleFor_(lt, m, dk);
    return {
      cycle: cy.cycle, prevClosed: cy.prevClosed,
      machine: m, exists: exists, problem: problem, first: !prev,
      openingKm: prev ? numOrBlank_(prev[lt.c[H.CKM]]) : (hasKm_(m.unit) ? 0 : ''),
      openingHr: prev ? numOrBlank_(prev[lt.c[H.CHR]]) : (hasHr_(m.unit) ? 0 : ''),
      prevDate: prev ? dkey_(prev[lt.c[H.DATE]]) : '',
      diesel: ds.qty, dieselText: ds.text, reads: ds.reads, driver: ds.driver,
    };
  });
}
/* Save many machinery for one date at once. Every row is checked first; nothing is saved if any row has a problem.
 * b: { date, rows: [{ no, openingKm, closingKm, openingHr, closingHr, chFrom, chTo, trip, driver, remark }] } */
function saveLogDay_(b) {
  return withLock_(() => {
    const dk = entryDate_(b.date);
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const errors = [], out = [], seen = {};
    (b.rows || []).forEach((l, i) => {
      if (!str_(l.no)) return;
      try {
        const m = findMachine_(l.no);
        const k = noKey_(m.id);
        if (seen[k]) throw new Error(m.id + ' is entered more than once.');
        seen[k] = true;
        assertActive_(m, dk);
        if (APP.UNITS.indexOf(m.unit) === -1) throw new Error('Set the Unit for ' + m.id + ' in Master first.');
        if (lt.rows.some(r => same_(r[lt.c[H.NO]], m.id) && dkey_(r[lt.c[H.DATE]]) === dk)) throw new Error('Log Book for ' + m.id + ' on ' + dmy_(dk) + ' is already saved.');
        const prev = prevLogOf_(lt, m.id, dk);
        let okm = '', ckm = '', ohr = '', chr = '';
        if (hasKm_(m.unit)) {
          okm = prev ? num0_(prev[lt.c[H.CKM]]) : reqReading_(blank_(l.openingKm) ? 0 : l.openingKm, 'Opening KM');
          ckm = reqReading_(l.closingKm, 'Closing KM');
          if (ckm < okm) throw new Error(m.id + ': Closing KM (' + ckm + ') cannot be less than Opening KM (' + okm + ').');
        }
        if (hasHr_(m.unit)) {
          ohr = prev ? num0_(prev[lt.c[H.CHR]]) : reqReading_(blank_(l.openingHr) ? 0 : l.openingHr, 'Opening Hrs');
          chr = reqReading_(l.closingHr, 'Closing Hrs');
          if (chr < ohr) throw new Error(m.id + ': Closing Hrs (' + chr + ') cannot be less than Opening Hrs (' + ohr + ').');
        }
        const ds = dieselDay_(m.id, dk);
        const cal = logCalc_(m, ds.qty, okm, ckm, ohr, chr);
        const row = newRow_(lt);
        set_(row, lt, H.DATE, toDate_(dk)); set_(row, lt, H.NO, m.id); set_(row, lt, H.SHIFT, 'Full Day');
        set_(row, lt, H.OWNER, m.owner); set_(row, lt, H.TYPE, m.type); set_(row, lt, H.UNIT, m.unit);
        set_(row, lt, H.QTY, ds.qty); set_(row, lt, H.KMR, ds.km); set_(row, lt, H.HRR, ds.hr); set_(row, lt, H.DREAD, ds.text);
        set_(row, lt, H.OKM, okm); set_(row, lt, H.CKM, ckm); set_(row, lt, H.WKM, cal.wkm);
        set_(row, lt, H.OHR, ohr); set_(row, lt, H.CHR, chr); set_(row, lt, H.WHR, cal.whr);
        set_(row, lt, H.KMSTD, hasKm_(m.unit) ? m.kmStd : ''); set_(row, lt, H.HRSTD, hasHr_(m.unit) ? m.hrStd : '');
        set_(row, lt, H.CKMC, cal.ckmc); set_(row, lt, H.CHRC, cal.chrc); set_(row, lt, H.TOT, cal.tot);
        set_(row, lt, H.AVG, cal.avg); set_(row, lt, H.EXTRA, cal.extra);
        set_(row, lt, H.CHFROM, clean_(l.chFrom)); set_(row, lt, H.CHTO, clean_(l.chTo));
        set_(row, lt, H.TRIP, numOrBlank_(l.trip)); set_(row, lt, H.DRIVER, clean_(l.driver) || ds.driver); set_(row, lt, H.REMARK, clean_(l.remark));
        out.push({ id: m.id, row: row });
      } catch (e) { errors.push({ row: i + 1, msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    if (!out.length) throw new Error('Enter at least one machinery.');
    lt.sh.getRange(lt.sh.getLastRow() + 1, 1, out.length, lt.headers.length).setValues(out.map(x => x.row));
    out.forEach(x => recalcStock_(x.id));
    return { ok: true, count: out.length, ids: out.map(x => x.id) };
  });
}

/* ================= LOG BOOK ROWS (date + shift per row, added one by one) =================
 * Shift: Full Day (all diesel of the date) or Day / Night (that shift's diesel only).
 * A machinery has either one Full Day entry or Day / Night entries on a date – not both.
 * Reading: Start = previous entry's Close (first entry: typed). Total = Close − Start.
 * Diesel:  Opening = previous entry's Closing diesel (first entry: typed, what is already in the tank)
 *          Issued  = Diesel Issue of that date (and shift) added up
 *          Consumed = as per Standard Average (Total KM ÷ km/L, Total Hrs × L/hr)
 *          Closing = Opening + Issued − Consumed  (diesel left in the machinery) */
const LOG_SHIFTS_ = ['Full Day', 'Day', 'Night'];
function logShift_(v) { const s = str_(v); const f = LOG_SHIFTS_.find(x => x.toUpperCase() === s.toUpperCase()); if (!f) throw new Error('Select the Shift (Full Day / Day / Night).'); return f; }
function logOrd_(sh) { return sh === 'Night' ? 1 : 0; }
function logKeyCmp_(a, b) { return a.dk !== b.dk ? (a.dk < b.dk ? -1 : 1) : logOrd_(a.shift) - logOrd_(b.shift); }
function dieselFor_(no, dk, shift) {
  if (shift === 'Full Day') return dieselDay_(no, dk);
  const all = dieselDay_(no, dk);
  const reads = all.reads.filter(x => x.shift === shift);
  return { qty: r2_(reads.reduce((s, x) => s + x.qty, 0)), reads: reads,
    text: reads.map(x => x.qty + ' L' + (x.km !== '' ? ' @ ' + x.km + ' km' : '') + (x.hr !== '' ? ' @ ' + x.hr + ' hr' : '') + ' (' + x.source + ')').join('; '),
    driver: all.driver, km: reads.reduce((v, x) => x.km !== '' ? x.km : v, ''), hr: reads.reduce((v, x) => x.hr !== '' ? x.hr : v, '') };
}
function logEntriesOf_(lt, no) {
  const c = lt.c;
  return lt.rows.filter(r => same_(r[c[H.NO]], no) && dkey_(r[c[H.DATE]])).map(r => ({
    dk: dkey_(r[c[H.DATE]]), shift: str_(r[c[H.SHIFT]]) || 'Full Day', ckm: numOrBlank_(r[c[H.CKM]]), chr: numOrBlank_(r[c[H.CHR]]), stock: num0_(r[c[H.STOCK]]),
    mode: str_(r[c[H.UNIT]]),
  })).sort(logKeyCmp_);
}
// why this date + shift cannot take an entry ('' = it can)
function logSlotProblem_(list, dk, shift) {
  const same = list.filter(x => x.dk === dk);
  if (same.some(x => x.shift === shift)) return 'already saved for ' + dmy_(dk) + ' (' + shift + ')';
  if (shift === 'Full Day' && same.length) return 'has ' + same.map(x => x.shift).join(' / ') + ' entry on ' + dmy_(dk) + ' – use Day / Night';
  if (shift !== 'Full Day' && same.some(x => x.shift === 'Full Day')) return 'has a Full Day entry on ' + dmy_(dk);
  return ''; // any date can be entered – the entries are linked again in date order when saved
}
/* The same answer as getLogRowPrefill_ for many rows in ONE call (the open rows of the entry grid after a change by anyone).
 * The tables are read once for all of them. A row that cannot be answered gets { error } and does not stop the others. */
function getLogRowPrefills_(list) {
  list = Array.isArray(list) ? list.slice(0, 80) : [];
  return list.map(x => { try { return getLogRowPrefill_(str_(x && x.no), str_(x && x.date), str_(x && x.shift)); } catch (e) { return { error: String(e && e.message || e) }; } });
}
function getLogRowPrefill_(no, dateStr, shiftIn) {
  const dk = checkDate_(dateStr), shift = logShift_(shiftIn || 'Full Day');
  const m = findMachine_(no);
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const list = logEntriesOf_(lt, m.id);
  const before = list.filter(x => logKeyCmp_(x, { dk: dk, shift: shift }) < 0), prev = before[before.length - 1] || null;
  const prevKm = before.filter(x => x.ckm !== '').pop() || null, prevHr = before.filter(x => x.chr !== '').pop() || null;
  const ds = dieselFor_(m.id, dk, shift);
  let problem = '';
  try { assertActive_(m, dk); } catch (e) { problem = e.message; }
  const slot = logSlotProblem_(list, dk, shift);
  const cy = cycleFor_(lt, m, dk);
  return {
    machine: m, problem: problem || (slot ? m.id + ' ' + slot + '.' : ''), first: !prev,
    openingKm: prevKm ? prevKm.ckm : (m.meterKm || hasKm_(m.unit) ? 0 : ''), openingHr: prevHr ? prevHr.chr : (m.meterHr || hasHr_(m.unit) ? 0 : ''),
    firstKm: !prevKm, firstHr: !prevHr, lastMode: prev && (m.modes || []).indexOf(prev.mode) > -1 ? prev.mode : '',
    openingDiesel: prev ? prev.stock : 0, prevDate: prev ? prev.dk : '', prevShift: prev ? prev.shift : '',
    lastDate: list.length ? list[list.length - 1].dk : '', lastShift: list.length ? list[list.length - 1].shift : '',
    diesel: ds.qty, dieselText: ds.text, reads: ds.reads, driver: ds.driver, cycle: cy.cycle, prevClosed: cy.prevClosed,
    boqItems: itemBrief_(boqItemsOn_(m, dk)), // Item-wise BOQ on this date ([] = none)
  };
}
/* rows: [{ date, shift, no, openingKm, closingKm, openingHr, closingHr, openingDiesel, chFrom, chTo, work }]
 * All rows are checked first (in date order per machinery, so one batch can hold several days of one machinery); nothing is saved if one fails. */
/* Log Book import from a file. Every row is matched with the Log Book (machinery + date + shift):
 *   new     – not in the Log Book yet → added
 *   same    – already there with the same readings / details → skipped
 *   changed – already there but the file is different → overwritten only when b.overwrite is true
 * check: true only reports (nothing saved). After saving, every Start = the Close before it, then totals and diesel
 * are worked out again. A row whose Close would be below its Start stops the whole import (nothing saved). */
function importLogBook_(b) {
  const run = () => {
    if (!b.check && (b.rows || []).some(hasItemsIn_)) logItemCol_();
    if (!b.check && (b.rows || []).some(hasDebitIn_)) logDebitCol_();
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const c = lt.c;
    const byKey = {}; lt.rows.forEach((r, i) => { if (dkey_(r[c[H.DATE]])) byKey[logKeyOf_(lt, r).toUpperCase()] = i; });
    const errors = [], fresh = [], same = [], changed = [];
    (b.rows || []).forEach((l, n) => {
      const line = l.line || n + 1;
      try {
        const m = findMachine_(l.no), dk = entryDate_(l.date), sh = logShift_(l.shift || 'Full Day');
        const key = (m.id + '|' + dk + '|' + sh).toUpperCase();
        const i = byKey[key];
        if (i === undefined) { fresh.push({ l: l, line: line, n: n }); return; }
        const r = lt.rows[i], km = hasKm_(str_(r[c[H.UNIT]]) || m.unit), hr = hasHr_(str_(r[c[H.UNIT]]) || m.unit), diffs = [];
        const numDiff = (h, v, name) => { if (blank_(v)) return; const a = numOrBlank_(r[c[h]]), nv = Number(v); if (a === '' || Math.abs(a - nv) > 0.001) diffs.push({ f: name, from: a, to: nv, h: h, v: nv }); };
        const txtDiff = (h, v, name) => { if (blank_(v) || !(h in c)) return; if (str_(r[c[h]]) !== clean_(v)) diffs.push({ f: name, from: str_(r[c[h]]), to: clean_(v), h: h, v: clean_(v) }); };
        if (km) numDiff(H.CKM, l.closingKm, 'Close KM');
        if (hr) numDiff(H.CHR, l.closingHr, 'Close Hrs');
        txtDiff(H.CHFROM, l.chFrom, 'Chainage From'); txtDiff(H.CHTO, l.chTo, 'Chainage To'); txtDiff(H.WORK, l.work, 'Work'); txtDiff(H.DRIVER, l.driver, 'Driver'); txtDiff(H.REMARK, l.remark, 'Remark');
        if (hasItemsIn_(l)) { const want = logItemWork_(m, dk, str_(r[c[H.UNIT]]), l, null), have = H.ITEMS in c ? str_(r[c[H.ITEMS]]) : '';
          if (JSON.stringify(itemWorkParse_(want)) !== JSON.stringify(itemWorkParse_(have))) diffs.push({ f: 'Item work', from: have, to: want, h: H.ITEMS, v: want }); }
        if (!diffs.length) same.push({ line: line, no: m.id, date: dk, shift: sh });
        else changed.push({ line: line, no: m.id, date: dk, shift: sh, i: i, diffs: diffs });
      } catch (e) { errors.push({ row: line, msg: e.message }); }
    });
    const report = { ok: !errors.length, errors: errors, fresh: fresh.length, same: same.length, sameList: same.slice(0, 50),
      changed: changed.map(x => ({ line: x.line, no: x.no, date: x.date, shift: x.shift, diffs: x.diffs.map(d => ({ f: d.f, from: d.from, to: d.to })) })) };
    if (errors.length || b.check) return report;
    // 1) overwrite the existing entries that are different (only with permission)
    const touched = {};
    if (b.overwrite) changed.forEach(x => {
      const row = lt.rows[x.i].slice();
      x.diffs.forEach(d => { row[c[d.h]] = d.v; });
      stampEdit_(row, lt);
      lt.sh.getRange(x.i + 2, 1, 1, row.length).setValues([row]);
      touched[x.no] = true;
    });
    // 2) add the new entries (Start from the Close before them, diesel from Diesel Issue)
    let added = 0;
    if (fresh.length) {
      const res = saveLogRowsInner_({ rows: fresh.map(x => x.l) }); // already inside the lock
      if (!res.ok) throw new Error((res.errors || []).map(e => 'Line ' + (fresh[e.row - 1] ? fresh[e.row - 1].line : e.row) + ': ' + e.msg).join(' | '));
      added = res.count; (res.ids || []).forEach(id => { touched[id] = true; });
    }
    // 3) every Start = the Close before it, then totals / diesel again
    Object.keys(touched).forEach(no => {
      const t = table_(APP.SHEET_LOG, logHeaders_()), cc = t.c;
      let lastK = '', lastH = '';
      machineLogIdx_(t, no).forEach(i => {
        const r = t.rows[i], row = r.slice(), unit = str_(r[cc[H.UNIT]]);
        if (hasKm_(unit) && lastK !== '') row[cc[H.OKM]] = lastK;
        if (hasHr_(unit) && lastH !== '') row[cc[H.OHR]] = lastH;
        if (hasKm_(unit) && numOrBlank_(row[cc[H.CKM]]) !== '' && num0_(row[cc[H.CKM]]) < num0_(row[cc[H.OKM]]))
          throw new Error(no + ' (' + dmy_(dkey_(r[cc[H.DATE]])) + '): Close KM ' + row[cc[H.CKM]] + ' would be less than its Start KM ' + row[cc[H.OKM]] + ' (the Close before it). Nothing imported.');
        if (hasHr_(unit) && numOrBlank_(row[cc[H.CHR]]) !== '' && num0_(row[cc[H.CHR]]) < num0_(row[cc[H.OHR]]))
          throw new Error(no + ' (' + dmy_(dkey_(r[cc[H.DATE]])) + '): Close Hrs ' + row[cc[H.CHR]] + ' would be less than its Start Hrs ' + row[cc[H.OHR]] + ' (the Close before it). Nothing imported.');
        if (row.some((v, k) => String(v) !== String(r[k]))) t.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
        if (hasKm_(unit) && numOrBlank_(row[cc[H.CKM]]) !== '') lastK = row[cc[H.CKM]];
        if (hasHr_(unit) && numOrBlank_(row[cc[H.CHR]]) !== '') lastH = row[cc[H.CHR]];
      });
      recalcChain_(no);
    });
    return Object.assign(report, { ok: true, added: added, overwritten: b.overwrite ? changed.length : 0 });
  };
  return b.check ? run() : withLock_(run);
}
// the way an entry is measured: the one picked (must be one of the machinery's ticks), else the usual one
function logModeFor_(m, want) {
  // day status for any machinery: Holiday / Breakdown (not paid), Idle (standing by, no work – paid or not is chosen in the bill)
  const modes = (m.modes && m.modes.length ? m.modes : logModes_(worksFromUnit_(m.unit))).concat(['Idle', 'Holiday', 'Breakdown']);
  const w = str_(want).toUpperCase().replace(/\s+/g, '');
  if (w) { const hit = modes.find(x => x.toUpperCase().replace(/\s+/g, '') === w); if (!hit) throw new Error(m.id + ' does not work on "' + str_(want) + '" – it works on ' + (m.worksOn || []).join(', ') + ' (Asset Master).'); return hit; }
  return modes.indexOf(m.unit) > -1 ? m.unit : ['Idle', 'Holiday', 'Breakdown'].indexOf(modes[0]) > -1 ? '' : modes[0] || '';
}
// the Time / Trip part of an entry: { tStart, tEnd, tBrk, tHrs, trip }
function logExtra_(m, mode, l, when) {
  const x = { tStart: '', tEnd: '', tBrk: '', tHrs: '', trip: numOrBlank_(l.trip), challan: clean_(l.challan) };
  if (mode === 'Time') {
    const a = hhmm_(l.tStart), b = hhmm_(l.tEnd);
    if (a === null || b === null) throw new Error(m.id + ' (' + when + '): enter the From and To time (e.g. 08:00 and 13:00).');
    x.tStart = String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); x.tEnd = String(Math.floor(b / 60)).padStart(2, '0') + ':' + String(b % 60).padStart(2, '0');
    x.tBrk = blank_(l.tBreak) ? '' : Math.max(0, num0_(l.tBreak));
    x.tHrs = timeHrs_(x.tStart, x.tEnd, x.tBrk);
    if (!(x.tHrs > 0)) throw new Error(m.id + ' (' + when + '): the working time is 0 – check From, To and the break.');
  }
  if (mode === 'Trip' && !(num0_(l.trip) > 0)) throw new Error(m.id + ' (' + when + '): enter the number of trips.');
  // trips can also carry an in / out time (Format H) – kept as written, the hours are not counted
  if (mode === 'Trip') { const a = hhmm_(l.tStart), b = hhmm_(l.tEnd); const t2 = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); if (a !== null) x.tStart = t2(a); if (b !== null) x.tEnd = t2(b); }
  return x;
}
function saveLogRows_(b) { return withLock_(() => saveLogRowsInner_(b)); }
function logTimeCols_() { [H.TSTART, H.TEND, H.TBRK, H.THRS, H.CHALLAN].forEach(h => addColIfMissing_(APP.SHEET_LOG, logHeaders_(), h)); TABLE_MEMO_ = {}; }
function saveLogRowsInner_(b) {
  {
    if ((b.rows || []).some(l => str_(l.mode) || str_(l.challan))) logTimeCols_();
    if ((b.rows || []).some(hasItemsIn_)) logItemCol_();
    if ((b.rows || []).some(hasDebitIn_)) logDebitCol_();
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const errors = [], out = [];
    const items = (b.rows || []).map((l, i) => ({ l: l, i: i })).filter(x => str_(x.l.no));
    if (!items.length) throw new Error('Enter at least one machinery.');
    const prepared = [];
    items.forEach(x => {
      try {
        const m = findMachine_(x.l.no);
        prepared.push({ x: x, m: m, dk: entryDate_(x.l.date), shift: logShift_(x.l.shift || 'Full Day') });
      } catch (e) { errors.push({ row: x.i + 1, msg: e.message }); }
    });
    prepared.sort((a, b) => natCmp_(a.m.id, b.m.id) || logKeyCmp_(a, b) || a.x.i - b.x.i);
    const chain = {}; // machinery -> entries (sheet + this batch)
    prepared.forEach(p => {
      const { x, m, dk, shift } = p, l = x.l;
      try {
        assertActive_(m, dk);
        if (!(m.modes || []).length && APP.UNITS.indexOf(m.unit) === -1) throw new Error('Tick what ' + m.id + ' works on in Asset Master first.');
        const mode = logModeFor_(m, l.mode);
        const k = noKey_(m.id);
        const list = chain[k] = chain[k] || logEntriesOf_(lt, m.id);
        const slot = logSlotProblem_(list, dk, shift);
        if (slot) throw new Error(m.id + ' ' + slot + '.');
        const before = list.filter(e => logKeyCmp_(e, { dk: dk, shift: shift }) < 0);
        const prev = before[before.length - 1] || null;
        // each meter follows its own last reading (an entry on Time / Trip / Day has no reading and does not break it)
        const prevKm = before.filter(e => e.ckm !== '').pop() || null, prevHr = before.filter(e => e.chr !== '').pop() || null;
        const ex = logExtra_(m, mode, l, dmy_(dk));
        let okm = '', ckm = '', ohr = '', chr = '';
        if (hasKm_(mode)) {
          okm = prevKm ? num0_(prevKm.ckm) : reqReading_(blank_(l.openingKm) ? 0 : l.openingKm, 'Start KM');
          ckm = reqReading_(l.closingKm, 'Close KM');
          if (ckm < okm) throw new Error(m.id + ' (' + dmy_(dk) + '): Close KM ' + ckm + ' is less than Start KM ' + okm + '.');
        }
        if (hasHr_(mode)) {
          ohr = prevHr ? num0_(prevHr.chr) : reqReading_(blank_(l.openingHr) ? 0 : l.openingHr, 'Start Hrs');
          chr = reqReading_(l.closingHr, 'Close Hrs');
          if (chr < ohr) throw new Error(m.id + ' (' + dmy_(dk) + '): Close Hrs ' + chr + ' is less than Start Hrs ' + ohr + '.');
        }
        const odsl = prev ? prev.stock : (blank_(l.openingDiesel) ? 0 : Math.max(0, num0_(l.openingDiesel)));
        const ds = dieselFor_(m.id, dk, shift);
        const cal = logCalc_(m, ds.qty, okm, ckm, ohr, chr, mode, ex.tHrs);
        const closing = r2_(odsl + ds.qty - cal.tot);
        const itemWork = logItemWork_(m, dk, mode, l, { hr: cal.whr, km: cal.wkm, trip: ex.trip });
        const row = newRow_(lt);
        if (itemWork) set_(row, lt, H.ITEMS, itemWork);
        const dbt = logDebit_(l, m.id + ' (' + dmy_(dk) + '): ');
        if (dbt && dbt.to) { debitReady_(lt); set_(row, lt, H.DEBITTO, dbt.to); set_(row, lt, H.DEBITRATE, dbt.rate); }
        set_(row, lt, H.DATE, toDate_(dk)); set_(row, lt, H.NO, m.id); set_(row, lt, H.SHIFT, shift);
        set_(row, lt, H.OWNER, m.owner); set_(row, lt, H.TYPE, m.type); set_(row, lt, H.UNIT, mode);
        set_(row, lt, H.TSTART, ex.tStart); set_(row, lt, H.TEND, ex.tEnd); set_(row, lt, H.TBRK, ex.tBrk); set_(row, lt, H.THRS, ex.tHrs);
        if (ex.trip !== '') set_(row, lt, H.TRIP, ex.trip);
        if (ex.challan) set_(row, lt, H.CHALLAN, ex.challan);
        set_(row, lt, H.QTY, ds.qty); set_(row, lt, H.KMR, ds.km); set_(row, lt, H.HRR, ds.hr); set_(row, lt, H.DREAD, ds.text);
        set_(row, lt, H.OKM, okm); set_(row, lt, H.CKM, ckm); set_(row, lt, H.WKM, cal.wkm);
        set_(row, lt, H.OHR, ohr); set_(row, lt, H.CHR, chr); set_(row, lt, H.WHR, cal.whr);
        set_(row, lt, H.KMSTD, hasKm_(m.unit) ? m.kmStd : ''); set_(row, lt, H.HRSTD, hasHr_(m.unit) ? m.hrStd : '');
        set_(row, lt, H.CKMC, cal.ckmc); set_(row, lt, H.CHRC, cal.chrc); set_(row, lt, H.TOT, cal.tot);
        set_(row, lt, H.ODSL, odsl); set_(row, lt, H.STOCK, closing);
        set_(row, lt, H.CHFROM, clean_(l.chFrom)); set_(row, lt, H.CHTO, clean_(l.chTo)); set_(row, lt, H.WORK, clean_(l.work));
        set_(row, lt, H.DRIVER, clean_(l.driver) || ds.driver);
        if (!blank_(l.remark)) set_(row, lt, H.REMARK, clean_(l.remark));
        list.push({ dk: dk, shift: shift, ckm: ckm, chr: chr, stock: closing, mode: mode }); list.sort(logKeyCmp_);
        out.push({ id: m.id, row: row });
      } catch (e) { errors.push({ row: x.i + 1, msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors.sort((a, b) => a.row - b.row) };
    lt.sh.getRange(lt.sh.getLastRow() + 1, 1, out.length, lt.headers.length).setValues(out.map(o => o.row));
    const done = {};
    out.forEach(o => { if (!done[o.id]) { done[o.id] = true; linkAfterInsert_(o.id, out.filter(x => x.id === o.id).map(x => x.row)); } });
    return { ok: true, count: out.length, ids: Object.keys(done) };
  }
}

/* ================= LOG BOOK: EDIT / DELETE with automatic re-chaining =================
 * An entry is found by its key: "machinery|yyyy-mm-dd|shift".
 * After any change the whole chain of that machinery is worked out again:
 *   Start of every entry = Close of the entry before it  →  Total, Consumed (as per standard),
 *   then Opening / Closing diesel (tank) and the fill-to-fill average. */
const logKeyOf_ = (t, r) => str_(r[t.c[H.NO]]) + '|' + dkey_(r[t.c[H.DATE]]) + '|' + (str_(r[t.c[H.SHIFT]]) || 'Full Day');
function findLogIdx_(lt, key) {
  const i = lt.rows.findIndex(r => logKeyOf_(lt, r) === str_(key));
  if (i === -1) throw new Error('This Log Book entry was not found (it may have been changed by someone else). Refresh the list.');
  return i;
}
function machineLogIdx_(lt, no) {
  const idx = [];
  lt.rows.forEach((r, i) => { if (same_(r[lt.c[H.NO]], no) && dkey_(r[lt.c[H.DATE]])) idx.push(i); });
  return idx.sort((a, b) => cmpKey_(lt.rows[a], lt.rows[b], lt.c) || a - b);
}
// Works out Total, Consumed, tank Opening / Closing and averages again from each entry's own Start and Close
function recalcChain_(no) {
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  let lastK, lastH, prevUsedK = true, prevUsedH = true;
  machineLogIdx_(lt, no).forEach(i => {
    const r = lt.rows[i], row = r.slice(), unit = str_(r[c[H.UNIT]]), km = hasKm_(unit), hr = hasHr_(unit), tm = unit === 'Time';
    // an entry on Time / Trip / Day in between: the next KM / Hrs entry starts at the last reading of that meter
    if (km && !prevUsedK && lastK !== undefined && lastK !== '') row[c[H.OKM]] = lastK;
    if (hr && !prevUsedH && lastH !== undefined && lastH !== '') row[c[H.OHR]] = lastH;
    const okm = numOrBlank_(row[c[H.OKM]]), ckm = numOrBlank_(row[c[H.CKM]]), ohr = numOrBlank_(row[c[H.OHR]]), chr = numOrBlank_(row[c[H.CHR]]);
    if (km && ckm !== '') lastK = ckm; if (hr && chr !== '') lastH = chr; prevUsedK = km; prevUsedH = hr;
    const wkm = km && okm !== '' && ckm !== '' ? r2_(ckm - okm) : '';
    const whr = hr && ohr !== '' && chr !== '' ? r2_(chr - ohr) : tm && H.THRS in c && numOrBlank_(row[c[H.THRS]]) !== '' ? num0_(row[c[H.THRS]]) : '';
    const ks = num0_(row[c[H.KMSTD]]), hs = num0_(row[c[H.HRSTD]]);
    // a negative total (Start above Close, waiting to be corrected) uses no diesel
    const ckmc = km && wkm !== '' && ks > 0 ? r2_(Math.max(0, wkm) / ks) : '', chrc = (hr || tm) && whr !== '' && hs > 0 ? r2_(Math.max(0, whr) * hs) : '';
    row[c[H.WKM]] = wkm; row[c[H.WHR]] = whr; row[c[H.CKMC]] = ckmc; row[c[H.CHRC]] = chrc; row[c[H.TOT]] = r2_(num0_(ckmc) + num0_(chrc));
    if (row.some((v, k) => String(v) !== String(r[k]))) lt.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
  });
  recalcStock_(no); // tank opening / closing and fill-to-fill average
}
// one entry with the entries just before and after it (for the edit window)
function getLogEntry_(key) {
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const i = findLogIdx_(lt, key);
  const no = str_(lt.rows[i][lt.c[H.NO]]);
  const idx = machineLogIdx_(lt, no), pos = idx.indexOf(i);
  const brief = j => j === undefined ? null : { key: logKeyOf_(lt, lt.rows[j]), date: dkey_(lt.rows[j][lt.c[H.DATE]]), shift: str_(lt.rows[j][lt.c[H.SHIFT]]) || 'Full Day',
    ckm: numOrBlank_(lt.rows[j][lt.c[H.CKM]]), chr: numOrBlank_(lt.rows[j][lt.c[H.CHR]]), okm: numOrBlank_(lt.rows[j][lt.c[H.OKM]]), ohr: numOrBlank_(lt.rows[j][lt.c[H.OHR]]) };
  const out = Object.assign(logRowOut_(lt, lt.rows[i]), { key: str_(key), first: pos === 0, prev: brief(idx[pos - 1]), next: brief(idx[pos + 1]) });
  let mm = null; try { mm = findMachine_(no); } catch (e) { mm = null; }
  out.boqItems = mm ? itemBrief_(boqItemsOn_(mm, out.date)) : [];
  return out;
}
/* Edit a Log Book entry (Start / Close reading, Chainage, Work description; Opening diesel on the first entry).
 *   Close changed → only the NEXT entry's Start becomes this Close (its Close stays; its total is worked out again)
 *   Start changed → only this entry's total changes; nothing else is touched
 * Everything else stays as it is; Total, Consumed, diesel Opening / Closing and averages are then worked out again.
 * Date, Shift or Machinery cannot be changed: delete the entry and enter it again. */
function updateLogRow_(key, l) {
  return withLock_(() => {
    if (hasItemsIn_(l)) logItemCol_();
    if (hasDebitIn_(l)) logDebitCol_();
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const c = lt.c;
    const i = findLogIdx_(lt, key);
    const r = lt.rows[i], no = str_(r[c[H.NO]]), unit = str_(r[c[H.UNIT]]);
    const idx = machineLogIdx_(lt, no), pos = idx.indexOf(i);
    const mm = findMachine_(no);
    const nextI = pos < idx.length - 1 ? idx[pos + 1] : -1;
    const dk = dkey_(r[c[H.DATE]]);
    const me = r.slice(), next = nextI > -1 ? lt.rows[nextI].slice() : null;
    let nextChanged = false;
    const kinds = [];
    if (hasKm_(unit)) kinds.push({ o: H.OKM, cl: H.CKM, open: l.openingKm, close: l.closingKm, name: 'KM' });
    if (hasHr_(unit)) kinds.push({ o: H.OHR, cl: H.CHR, open: l.openingHr, close: l.closingHr, name: 'Hrs' });
    kinds.forEach(k => {
      const start = blank_(k.open) ? num0_(r[c[k.o]]) : reqReading_(k.open, 'Start ' + k.name);
      const close = reqReading_(k.close, 'Close ' + k.name);
      if (close < start) throw new Error('Close ' + k.name + ' ' + close + ' cannot be less than Start ' + k.name + ' ' + start + '.');
      me[c[k.o]] = start; me[c[k.cl]] = close;
      // the next entry that reads this meter starts where this one closed (entries on Time / Trip / Day in between are skipped)
      if (next && close !== num0_(r[c[k.cl]]) && (k.name === 'KM' ? hasKm_(str_(next[c[H.UNIT]])) : hasHr_(str_(next[c[H.UNIT]])))) { next[c[k.o]] = close; nextChanged = true; }
    });
    if (H.CHALLAN in c && l.challan !== undefined && ['Idle', 'Holiday', 'Breakdown'].indexOf(unit) === -1) me[c[H.CHALLAN]] = clean_(l.challan);
    // "Debit to": cannot be changed once the entry is in a debit note (cancel the note first)
    const dbt = logDebit_(l, '');
    if (dbt && H.DEBITTO in c && (str_(me[c[H.DEBITTO]]) !== dbt.to || String(numOrBlank_(me[c[H.DEBITRATE]])) !== String(dbt.rate))) {
      const lk = str_(me[c[H.NO]]) + '|' + dkey_(me[c[H.DATE]]) + '|' + str_(me[c[H.SHIFT]]);
      const inNote = dnList_().find(d => d.status !== 'Cancelled' && d.logIds.indexOf(lk) > -1);
      if (inNote) throw new Error('This entry is in debit note ' + inNote.no + ' – its "Debit to" cannot be changed. Cancel that note first.');
      if (dbt.to) debitReady_(lt);
      me[c[H.DEBITTO]] = dbt.to; me[c[H.DEBITRATE]] = dbt.rate;
    }
    if (unit === 'Time' || unit === 'Trip') {
      const ex = logExtra_(mm, unit, { tStart: l.tStart, tEnd: l.tEnd, tBreak: l.tBreak, trip: l.trip, challan: l.challan }, dmy_(dkey_(r[c[H.DATE]])));
      if (unit === 'Time') { ['TSTART', 'TEND', 'TBRK', 'THRS'].forEach((h, n) => { if (H[h] in c) me[c[H[h]]] = [ex.tStart, ex.tEnd, ex.tBrk, ex.tHrs][n]; }); }
      if (unit === 'Trip' && H.TRIP in c) me[c[H.TRIP]] = ex.trip;
      if (unit === 'Trip' && H.CHALLAN in c && l.challan !== undefined) me[c[H.CHALLAN]] = clean_(l.challan);
    }
    if (pos === 0 && H.ODSL in c && !blank_(l.openingDiesel)) me[c[H.ODSL]] = Math.max(0, num0_(l.openingDiesel));
    if (H.CHFROM in c) me[c[H.CHFROM]] = clean_(l.chFrom);
    if (H.CHTO in c) me[c[H.CHTO]] = clean_(l.chTo);
    me[c[H.WORK]] = clean_(l.work);
    // Item-wise BOQ: the typed items, checked against this entry's totals as they now are
    if (l.items !== undefined && H.ITEMS in c) {
      const n2 = h => numOrBlank_(me[c[h]]);
      const tot = { km: hasKm_(unit) && n2(H.CKM) !== '' ? r2_(n2(H.CKM) - num0_(me[c[H.OKM]])) : 0,
        hr: hasHr_(unit) && n2(H.CHR) !== '' ? r2_(n2(H.CHR) - num0_(me[c[H.OHR]])) : unit === 'Time' && H.THRS in c ? num0_(me[c[H.THRS]]) : 0, trip: H.TRIP in c ? num0_(me[c[H.TRIP]]) : 0 };
      me[c[H.ITEMS]] = logItemWork_(mm, dk, unit, l, tot);
    }
    stampEdit_(me, lt);
    lt.sh.getRange(i + 2, 1, 1, me.length).setValues([me]);
    if (nextChanged) lt.sh.getRange(nextI + 2, 1, 1, next.length).setValues([next]);
    recalcChain_(no);
    return { ok: true, key: str_(key), date: dk, nextChanged: nextChanged };
  });
}
/* A Log Book entry was added (maybe between older ones): the entry right after it (by date and shift)
 * now starts at its Close. Nothing else is moved; totals, consumed, tank and averages are worked out again. */
function linkAfterInsert_(no, newRows) {
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  const keyOf = r => dkey_(r[c[H.DATE]]) + '|' + (str_(r[c[H.SHIFT]]) || 'Full Day');
  const isNew = {}; newRows.forEach(r => { isNew[keyOf(r)] = true; });
  const idx = machineLogIdx_(lt, no);
  idx.forEach((i, n) => {
    if (!isNew[keyOf(lt.rows[i])]) return;
    const j = idx[n + 1]; if (j === undefined || isNew[keyOf(lt.rows[j])]) return; // next one is new too: already linked
    const r = lt.rows[i], nx = lt.rows[j].slice(), unit = str_(nx[c[H.UNIT]]);
    let changed = false;
    if (hasKm_(unit) && r[c[H.CKM]] !== '' && String(nx[c[H.OKM]]) !== String(r[c[H.CKM]])) { nx[c[H.OKM]] = num0_(r[c[H.CKM]]); changed = true; }
    if (hasHr_(unit) && r[c[H.CHR]] !== '' && String(nx[c[H.OHR]]) !== String(r[c[H.CHR]])) { nx[c[H.OHR]] = num0_(r[c[H.CHR]]); changed = true; }
    if (changed) lt.sh.getRange(j + 2, 1, 1, nx.length).setValues([nx]);
  });
  recalcChain_(no);
}
/* ================= EDIT LOG BOOK (many entries of one machinery at once) =================
 * getLogEditData_: the entries of one machinery between two dates, with the entry just before and just after,
 *                  and the diesel issued on every date (to show Issued for new rows).
 * saveLogBulk_:    saves the whole grid in one go – changed rows, new rows, deleted rows – then works everything out again. */
function getLogEditData_(no, fromStr, toStr) {
  const m = findMachine_(no);
  const from = checkDate_(fromStr), to = checkDate_(toStr);
  if (from > to) throw new Error('From date is after To date.');
  if (daysBetween_(from, to) > 92) throw new Error('Select up to 3 months at a time.');
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  const idx = machineLogIdx_(lt, m.id);
  const rows = [], before = [], after = [];
  idx.forEach(i => { const dk = dkey_(lt.rows[i][c[H.DATE]]); (dk < from ? before : dk > to ? after : rows).push(i); });
  const brief = i => i === undefined ? null : { key: logKeyOf_(lt, lt.rows[i]), date: dkey_(lt.rows[i][c[H.DATE]]), shift: str_(lt.rows[i][c[H.SHIFT]]) || 'Full Day',
    okm: numOrBlank_(lt.rows[i][c[H.OKM]]), ckm: numOrBlank_(lt.rows[i][c[H.CKM]]), ohr: numOrBlank_(lt.rows[i][c[H.OHR]]), chr: numOrBlank_(lt.rows[i][c[H.CHR]]), stock: num0_(lt.rows[i][c[H.STOCK]]) };
  // diesel issued per date and shift for this machinery
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  const diesel = {};
  t.rows.forEach(r => {
    if (!same_(r[t.c[H.NO]], m.id)) return;
    const dk = dkey_(r[t.c[H.IDATE]]); if (!dk || dk < from || dk > to) return;
    const d = diesel[dk] = diesel[dk] || { Day: 0, Night: 0 };
    const sh = str_(r[t.c[H.SHIFT]]) === 'Night' ? 'Night' : 'Day';
    d[sh] = r2_(d[sh] + num0_(r[t.c[H.QTY]]));
  });
  const lastRead = h => { for (let k = before.length - 1; k >= 0; k--) { const v = numOrBlank_(lt.rows[before[k]][c[h]]); if (v !== '') return v; } return ''; };
  // Item-wise BOQ: the items in force on each date of the range ({} = this machinery has no Item-wise BOQ)
  const boqItems = {};
  if (itemNos_()[noKey_(m.id)]) { let d = from; for (let k = 0; k < 100 && d <= to; k++) { const it = boqItemsOn_(m, d); if (it.length) boqItems[d] = itemBrief_(it); d = addDays_(d, 1); } }
  return { machine: m, from: from, to: to, boqItems: boqItems, rows: rows.map(i => Object.assign(logRowOut_(lt, lt.rows[i]), { key: logKeyOf_(lt, lt.rows[i]) })),
    prev: brief(before[before.length - 1]), next: brief(after[0]), diesel: diesel, prevKm: lastRead(H.CKM), prevHr: lastRead(H.CHR) };
}
/* b: { no, from, to, rows: [{ key | '', date, shift, openingKm, closingKm, openingHr, closingHr, chFrom, chTo, work }], deleted: [key], openingDiesel } */
function saveLogBulk_(b) {
  return withLock_(() => {
    const m = findMachine_(b.no);
    if (!(m.modes || []).length) throw new Error('Tick what ' + m.id + ' works on in Asset Master first.');
    if ((b.rows || []).some(l => str_(l.mode) === 'Time' || str_(l.challan))) logTimeCols_();
    if ((b.rows || []).some(hasItemsIn_)) logItemCol_();
    if ((b.rows || []).some(hasDebitIn_)) logDebitCol_();
    // a month opening diesel (typed on the 1st) needs its column
    if ((b.rows || []).some(l => !blank_(l.odSet) && /-01$/.test(str_(l.date)))) addColIfMissing_(APP.SHEET_LOG, logHeaders_(), H.ODSET);
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const c = lt.c;
    const idx = machineLogIdx_(lt, m.id);
    const byKey = {}; idx.forEach(i => { byKey[logKeyOf_(lt, lt.rows[i])] = i; });
    const deleted = (b.deleted || []).map(str_).filter(k => k in byKey);
    const odOf = l => blank_(l.odSet) ? '' : (() => { const v = Number(l.odSet); if (!isFinite(v) || v < 0) throw new Error('Opening diesel must be 0 or more.'); return r2_(v); })();
    const errors = [];
    const rows = (b.rows || []).map((l, n) => ({ l: l, n: n }));
    // every date + shift once; not clashing with entries outside this grid
    const taken = {};
    idx.forEach(i => { const k = logKeyOf_(lt, lt.rows[i]); if (deleted.indexOf(k) === -1 && !rows.some(x => x.l.key === k)) taken[dkey_(lt.rows[i][c[H.DATE]])] = (taken[dkey_(lt.rows[i][c[H.DATE]])] || []).concat(str_(lt.rows[i][c[H.SHIFT]]) || 'Full Day'); });
    const clash = (dk, sh) => { const t = taken[dk] || []; return t.indexOf(sh) > -1 || (sh === 'Full Day' && t.length) || (sh !== 'Full Day' && t.indexOf('Full Day') > -1); };
    const prepared = [];
    rows.forEach(x => {
      const l = x.l;
      try {
        const dk = entryDate_(l.date), sh = logShift_(l.shift || 'Full Day');
        if (l.key && !(l.key in byKey)) throw new Error('This entry was changed by someone else – reload the list.');
        if (!l.key) assertActive_(m, dk);
        if (clash(dk, sh)) throw new Error(dmy_(dk) + ' (' + sh + ') is entered more than once.');
        taken[dk] = (taken[dk] || []).concat(sh);
        const cur = l.key && l.key in byKey ? str_(lt.rows[byKey[l.key]][c[H.UNIT]]) : '';
        const mode = logModeFor_(m, str_(l.mode) || cur), km = hasKm_(mode), hr = hasHr_(mode);
        const v = { mode: mode, km: km, hr: hr, ex: logExtra_(m, mode, l, dmy_(dk)) };
        if (km) { v.okm = reqReading_(blank_(l.openingKm) ? 0 : l.openingKm, 'Start KM'); v.ckm = reqReading_(l.closingKm, 'Close KM'); if (v.ckm < v.okm) throw new Error(dmy_(dk) + ': Close KM ' + v.ckm + ' is less than Start KM ' + v.okm + '.'); }
        if (hr) { v.ohr = reqReading_(blank_(l.openingHr) ? 0 : l.openingHr, 'Start Hrs'); v.chr = reqReading_(l.closingHr, 'Close Hrs'); if (v.chr < v.ohr) throw new Error(dmy_(dk) + ': Close Hrs ' + v.chr + ' is less than Start Hrs ' + v.ohr + '.'); }
        // Item-wise BOQ: the typed items of this row (undefined = not sent: what is saved stays)
        if (l.items !== undefined) v.itemWork = logItemWork_(m, dk, mode, l, { km: km ? r2_(v.ckm - v.okm) : 0, hr: hr ? r2_(v.chr - v.ohr) : mode === 'Time' ? num0_(v.ex.tHrs) : 0, trip: num0_(v.ex.trip) });
        prepared.push({ x: x, dk: dk, sh: sh, v: v, od: /-01$/.test(dk) ? odOf(l) : undefined });
      } catch (e) { errors.push({ row: x.n + 1, msg: e.message }); }
    });
    if (errors.length) return { ok: false, errors: errors };
    // the chain must be joined: every Start = the Close just before it
    {
      const ordC = { 'Day': 0, 'Full Day': 0, 'Night': 1 };
      const sortedC = prepared.slice().sort((a, b) => a.dk < b.dk ? -1 : a.dk > b.dk ? 1 : ordC[a.sh] - ordC[b.sh]);
      const from = sortedC.length ? sortedC[0].dk : '';
      // each meter: its last reading before these dates (entries on Time / Trip / Day have none)
      const beforeAll = idx.filter(i => dkey_(lt.rows[i][c[H.DATE]]) < from && deleted.indexOf(logKeyOf_(lt, lt.rows[i])) === -1);
      const lastOf = h => { for (let k = beforeAll.length - 1; k >= 0; k--) { const v = numOrBlank_(lt.rows[beforeAll[k]][c[h]]); if (v !== '') return v; } return ''; };
      let pk = lastOf(H.CKM), ph = lastOf(H.CHR);
      sortedC.forEach(p => {
        if (p.v.km && pk !== '' && p.v.okm !== pk) errors.push({ row: p.x.n + 1, msg: dmy_(p.dk) + ': Start KM ' + p.v.okm + ' must be ' + pk + ' (the last Close KM before it).' });
        if (p.v.hr && ph !== '' && p.v.ohr !== ph) errors.push({ row: p.x.n + 1, msg: dmy_(p.dk) + ': Start Hrs ' + p.v.ohr + ' must be ' + ph + ' (the last Close Hrs before it).' });
        pk = p.v.km ? p.v.ckm : pk; ph = p.v.hr ? p.v.chr : ph;
      });
      if (errors.length) return { ok: false, errors: errors };
    }
    // 1) changed rows (and the entry just after the grid follows the last Close)
    let changed = 0;
    prepared.filter(p => p.x.l.key).forEach(p => {
      const i = byKey[p.x.l.key], r = lt.rows[i], row = r.slice(), l = p.x.l, v = p.v;
      row[c[H.UNIT]] = v.mode;
      row[c[H.OKM]] = v.km ? v.okm : ''; row[c[H.CKM]] = v.km ? v.ckm : '';
      row[c[H.OHR]] = v.hr ? v.ohr : ''; row[c[H.CHR]] = v.hr ? v.chr : '';
      ['TSTART', 'TEND', 'TBRK', 'THRS'].forEach((h, n) => { if (H[h] in c) row[c[H[h]]] = [v.ex.tStart, v.ex.tEnd, v.ex.tBrk, v.ex.tHrs][n]; });
      if (v.mode === 'Trip' && H.TRIP in c) row[c[H.TRIP]] = v.ex.trip;
      if (H.CHALLAN in c) row[c[H.CHALLAN]] = ['Idle', 'Holiday', 'Breakdown'].indexOf(v.mode) > -1 ? '' : v.ex.challan;
      if (H.CHFROM in c) row[c[H.CHFROM]] = clean_(l.chFrom);
      if (H.CHTO in c) row[c[H.CHTO]] = clean_(l.chTo);
      row[c[H.WORK]] = clean_(l.work); if (H.REMARK in c && l.remark !== undefined) row[c[H.REMARK]] = clean_(l.remark);
      if (p.od !== undefined && H.ODSET in c) row[c[H.ODSET]] = p.od;
      if (v.itemWork !== undefined && H.ITEMS in c) row[c[H.ITEMS]] = v.itemWork;
      if (row.some((v, k) => String(v) !== String(r[k]))) { stampEdit_(row, lt); lt.sh.getRange(i + 2, 1, 1, row.length).setValues([row]); changed++; }
    });
    const order = { 'Day': 0, 'Full Day': 0, 'Night': 1 };
    const sorted = prepared.slice().sort((a, b) => a.dk < b.dk ? -1 : a.dk > b.dk ? 1 : order[a.sh] - order[b.sh]);
    const last = sorted[sorted.length - 1];
    const nextOut = idx.filter(i => deleted.indexOf(logKeyOf_(lt, lt.rows[i])) === -1 && !prepared.some(p => p.x.l.key === logKeyOf_(lt, lt.rows[i])))
      .find(i => { const dk = dkey_(lt.rows[i][c[H.DATE]]); return last && (dk > last.dk || (dk === last.dk && order[str_(lt.rows[i][c[H.SHIFT]]) || 'Full Day'] > order[last.sh])); });
    if (last && nextOut !== undefined && b.linkNext !== false) {
      const r = lt.rows[nextOut], row = r.slice(), nu = str_(r[c[H.UNIT]]);
      const lk = sorted.filter(p => p.v.km).pop(), lh = sorted.filter(p => p.v.hr).pop();
      if (hasKm_(nu) && lk) row[c[H.OKM]] = lk.v.ckm;
      if (hasHr_(nu) && lh) row[c[H.OHR]] = lh.v.chr;
      if (row.some((v, k) => String(v) !== String(r[k]))) lt.sh.getRange(nextOut + 2, 1, 1, row.length).setValues([row]);
    }
    // opening diesel of the machinery's very first entry
    if (!blank_(b.openingDiesel) && H.ODSL in c && sorted.length && !idx.some(i => dkey_(lt.rows[i][c[H.DATE]]) < sorted[0].dk && deleted.indexOf(logKeyOf_(lt, lt.rows[i])) === -1)) {
      const f = sorted[0];
      if (f.x.l.key) { const i = byKey[f.x.l.key]; lt.sh.getRange(i + 2, c[H.ODSL] + 1).setValue(Math.max(0, num0_(b.openingDiesel))); }
      else f.odsl = Math.max(0, num0_(b.openingDiesel));
    }
    // 2) new rows
    const add = prepared.filter(p => !p.x.l.key).map(p => {
      const l = p.x.l, ds = dieselFor_(m.id, p.dk, p.sh), v = p.v, km = v.km, hr = v.hr;
      const cal = logCalc_(m, ds.qty, km ? v.okm : '', km ? v.ckm : '', hr ? v.ohr : '', hr ? v.chr : '', v.mode, v.ex.tHrs);
      const row = newRow_(lt);
      set_(row, lt, H.DATE, toDate_(p.dk)); set_(row, lt, H.NO, m.id); set_(row, lt, H.SHIFT, p.sh);
      set_(row, lt, H.OWNER, m.owner); set_(row, lt, H.TYPE, m.type); set_(row, lt, H.UNIT, v.mode);
      set_(row, lt, H.TSTART, v.ex.tStart); set_(row, lt, H.TEND, v.ex.tEnd); set_(row, lt, H.TBRK, v.ex.tBrk); set_(row, lt, H.THRS, v.ex.tHrs);
      if (v.ex.trip !== '') set_(row, lt, H.TRIP, v.ex.trip);
      if (v.ex.challan) set_(row, lt, H.CHALLAN, v.ex.challan);
      set_(row, lt, H.QTY, ds.qty); set_(row, lt, H.KMR, ds.km); set_(row, lt, H.HRR, ds.hr); set_(row, lt, H.DREAD, ds.text);
      set_(row, lt, H.OKM, km ? p.v.okm : ''); set_(row, lt, H.CKM, km ? p.v.ckm : ''); set_(row, lt, H.WKM, cal.wkm);
      set_(row, lt, H.OHR, hr ? p.v.ohr : ''); set_(row, lt, H.CHR, hr ? p.v.chr : ''); set_(row, lt, H.WHR, cal.whr);
      set_(row, lt, H.KMSTD, hasKm_(m.unit) ? m.kmStd : ''); set_(row, lt, H.HRSTD, hasHr_(m.unit) ? m.hrStd : '');
      set_(row, lt, H.CKMC, cal.ckmc); set_(row, lt, H.CHRC, cal.chrc); set_(row, lt, H.TOT, cal.tot);
      if (p.odsl !== undefined) set_(row, lt, H.ODSL, p.odsl);
      if (p.od !== undefined && p.od !== '') set_(row, lt, H.ODSET, p.od);
      if (v.itemWork) set_(row, lt, H.ITEMS, v.itemWork);
      set_(row, lt, H.CHFROM, clean_(l.chFrom)); set_(row, lt, H.CHTO, clean_(l.chTo)); set_(row, lt, H.WORK, clean_(l.work)); set_(row, lt, H.DRIVER, ds.driver); if (l.remark) set_(row, lt, H.REMARK, clean_(l.remark));
      return row;
    });
    if (add.length) lt.sh.getRange(lt.sh.getLastRow() + 1, 1, add.length, lt.headers.length).setValues(add);
    // 3) deleted rows (bottom first so the row numbers above stay right)
    deleted.map(k => byKey[k]).sort((a, b) => b - a).forEach(i => lt.sh.deleteRow(i + 2));
    recalcChain_(m.id);
    return { ok: true, no: m.id, changed: changed, added: add.length, deleted: deleted.length };
  });
}

/* ================= TANK CHECK (system tank vs physical) =================
 * The system keeps a tank for every machinery: Opening + diesel given − diesel used as per the Standard Average
 * (Log Book "Closing diesel (est.)"). A physical check records what was really found in the tank; the difference
 * is kept with its reason, and from the end of that day the system tank starts again from the real figure. */
const TANK_COLS_ = ['Check ID', 'Date', 'Machinery Number', 'System Diesel (Ltr)', 'Physical Diesel (Ltr)', 'Difference (Ltr)', 'Method', 'Litres To Fill', 'Reason', 'Checked By', 'Created At'];
// "Entered By" is an extra column after these (added when missing)
function tankSheet_() {
  const ss = SS_();
  let sh = ss.getSheetByName(APP.SHEET_TANK);
  if (!sh) {
    sh = ss.insertSheet(APP.SHEET_TANK);
    sh.getRange(1, 1, 1, TANK_COLS_.length).setValues([TANK_COLS_]);
    sh.setFrozenRows(1);
    TABLE_MEMO_ = {};
  }
  return sh;
}
function tankTable_() {
  if (!SS_().getSheetByName(APP.SHEET_TANK)) return null;
  return table_(APP.SHEET_TANK, TANK_COLS_);
}
function tankRowOut_(t, r) {
  const g = h => r[t.c[h]];
  return { id: str_(g('Check ID')), date: dkey_(g('Date')), no: str_(g('Machinery Number')), system: num0_(g('System Diesel (Ltr)')), physical: num0_(g('Physical Diesel (Ltr)')),
    diff: num0_(g('Difference (Ltr)')), method: str_(g('Method')), toFill: numOrBlank_(g('Litres To Fill')), reason: str_(g('Reason')), by: str_(g('Checked By')),
    enteredBy: H.EBY in t.c ? str_(r[t.c[H.EBY]]) : '' };
}
function tankChecksOf_(no) {
  const t = tankTable_(); if (!t) return [];
  return t.rows.map(r => tankRowOut_(t, r)).filter(x => x.date && same_(x.no, no)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
// what the system says is in the machinery's tank at the end of a day (before any check on that day)
function systemTankAt_(no, dk) {
  const m = findMachine_(no);
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  const idx = machineLogIdx_(lt, m.id).filter(i => dkey_(lt.rows[i][c[H.DATE]]) <= dk);
  const last = idx.length ? lt.rows[idx[idx.length - 1]] : null;
  let base = 0, baseKey = '', from = '';
  if (last) { base = num0_(last[c[H.STOCK]]); from = dkey_(last[c[H.DATE]]); baseKey = from + '|' + shiftOrder_(str_(last[c[H.SHIFT]]) || 'Full Day'); }
  const lastCheck = tankChecksOf_(m.id).filter(x => x.date < dk && x.date >= (from || '0000')).pop();
  if (lastCheck && (!from || lastCheck.date >= from)) { base = lastCheck.physical; baseKey = lastCheck.date + '|9'; from = lastCheck.date; }
  // diesel given after that point (no Log Book yet, so nothing used as per standard)
  let extra = 0;
  issueList_(stockTables_()).forEach(x => { if (x.key !== noKey_(m.id) || x.date > dk) return; const k = x.date + '|' + shiftOrder_(x.shift); if (!baseKey || k > baseKey) extra += x.qty; });
  return { machine: m, date: dk, system: r2_(base + extra), fromLog: last ? { date: dkey_(last[c[H.DATE]]), shift: str_(last[c[H.SHIFT]]) || 'Full Day', stock: num0_(last[c[H.STOCK]]) } : null,
    fromCheck: lastCheck || null, addedAfter: r2_(extra), cap: m.tankCap };
}
function getTankSystem_(no, date) { return systemTankAt_(no, checkDate_(date)); }
function getTankChecks_(f) {
  f = f || {};
  const t = tankTable_(); if (!t) return { rows: [] };
  const from = str_(f.from) ? checkDate_(f.from) : '', to = str_(f.to) ? checkDate_(f.to) : '', nk = noKey_(f.no);
  const rows = t.rows.map(r => tankRowOut_(t, r)).filter(x => x.date && (!from || x.date >= from) && (!to || x.date <= to) && (!nk || noKey_(x.no).indexOf(nk) > -1))
    .sort((a, b) => a.date > b.date ? -1 : a.date < b.date ? 1 : b.id.localeCompare(a.id));
  const caps = {}; getMaster_().forEach(m => { caps[noKey_(m.id)] = m.tankCap; });
  rows.forEach(x => { x.cap = caps[noKey_(x.no)] || ''; x.pct = x.system ? r2_(x.diff / x.system * 100) : ''; });
  return { rows: rows.slice(0, 500), count: rows.length };
}
function saveTankCheck_(d) {
  return withLock_(() => {
    d = d || {};
    const dk = entryDate_(d.date), m = findMachine_(d.no);
    const method = d.method === 'full' ? 'Filled to full' : 'Measured in tank';
    let physical, toFill = '';
    if (method === 'Filled to full') {
      if (!(m.tankCap > 0)) throw new Error('Set the Tank Capacity of ' + m.id + ' in Master to use "Filled to full".');
      toFill = reqReading_(d.toFill, 'Litres needed to fill');
      if (toFill > m.tankCap) throw new Error('Litres to fill (' + toFill + ') is more than the tank capacity (' + m.tankCap + ').');
      physical = r2_(m.tankCap - toFill);
    } else physical = reqReading_(d.physical, 'Diesel found in the tank');
    if (tankChecksOf_(m.id).some(x => x.date === dk)) throw new Error(m.id + ' already has a tank check on ' + dmy_(dk) + '. Delete it first to check again.');
    const sys = systemTankAt_(m.id, dk).system, diff = r2_(physical - sys);
    const reason = clean_(d.reason);
    if (Math.abs(diff) > Math.max(5, Math.abs(sys) * 0.1) && !reason) throw new Error('Difference is ' + (diff > 0 ? '+' : '') + diff + ' L – write the reason.');
    const sh = tankSheet_(), t = table_(APP.SHEET_TANK, TANK_COLS_);
    const n = t.rows.reduce((mx, r) => Math.max(mx, Number(String(r[t.c['Check ID']]).replace(/\D/g, '')) || 0), 0) + 1;
    const id = 'TC-' + String(n).padStart(5, '0');
    const trow = [id, toDate_(dk), m.id, sys, physical, diff, method, toFill, reason, clean_(d.by), new Date()];
    if (H.EBY in t.c) { while (trow.length < t.headers.length) trow.push(''); trow[t.c[H.EBY]] = ACTOR_; }
    sh.appendRow(safeRows_(trow));
    TABLE_MEMO_ = {};
    recalcStock_(m.id); // from the end of this day the system tank starts from the real figure
    bump_(['log']);
    return { ok: true, id: id, no: m.id, date: dk, system: sys, physical: physical, diff: diff };
  });
}
function deleteTankCheck_(id) {
  return withLock_(() => {
    const t = tankTable_(); if (!t) throw new Error('Tank check not found.');
    const i = t.rows.findIndex(r => str_(r[t.c['Check ID']]) === str_(id));
    if (i === -1) throw new Error('Tank check not found.');
    const x = tankRowOut_(t, t.rows[i]);
    t.sh.deleteRow(i + 2);
    TABLE_MEMO_ = {};
    recalcStock_(x.no);
    bump_(['log']);
    return { ok: true, id: x.id, no: x.no, date: x.date };
  });
}
/* Report: tank checks in the dates, and today's system tank of every active machinery
 * (marked when it is more than the tank capacity, when a capacity is set). */
function rptTank_(f) {
  f = f || {};
  const rg = rptRange_(f);
  const checks = getTankChecks_({ from: rg.from, to: rg.to }).rows;
  const today = today_();
  const current = getMaster_().filter(m => m.status !== 'Inactive' && m.supply !== 'Debit Basis').map(m => {
    let s = null; try { s = systemTankAt_(m.id, rg.to < today ? rg.to : today); } catch (e) { s = null; }
    if (!s) return null;
    const last = tankChecksOf_(m.id).filter(x => x.date <= (rg.to < today ? rg.to : today)).pop();
    return { no: m.id, type: m.type, ownership: m.ownership, unit: m.unit, system: s.system, cap: m.tankCap, over: m.tankCap > 0 && s.system > m.tankCap, lastCheck: last ? last.date : '', lastDiff: last ? last.diff : '' };
  }).filter(Boolean).sort((a, b) => (b.over - a.over) || natCmp_(a.no, b.no));
  return Object.assign(rptBase_('Tank Check – System vs Physical', rg), { checks: checks, current: current, asOn: rg.to < today ? rg.to : today,
    total: { checks: checks.length, diff: r2_(checks.reduce((a, x) => a + x.diff, 0)), over: current.filter(x => x.over).length, bigDiff: checks.filter(x => Math.abs(x.diff) > Math.max(5, Math.abs(x.system) * 0.1)).length } });
}

function deleteLogRow_(key) {
  return withLock_(() => {
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const i = findLogIdx_(lt, key);
    const c = lt.c, no = str_(lt.rows[i][c[H.NO]]);
    const idx = machineLogIdx_(lt, no), pos = idx.indexOf(i);
    const prevI = pos > 0 ? idx[pos - 1] : -1, nextI = pos < idx.length - 1 ? idx[pos + 1] : -1;
    // the next entry now starts where the entry before the deleted one closed
    if (prevI > -1 && nextI > -1) {
      const p = lt.rows[prevI], n = lt.rows[nextI].slice(), unit = str_(n[c[H.UNIT]]);
      if (hasKm_(unit)) n[c[H.OKM]] = num0_(p[c[H.CKM]]);
      if (hasHr_(unit)) n[c[H.OHR]] = num0_(p[c[H.CHR]]);
      lt.sh.getRange(nextI + 2, 1, 1, n.length).setValues([n]);
    }
    lt.sh.deleteRow(i + 2);
    recalcChain_(no);
    return { ok: true, key: str_(key) };
  });
}
function snapshotLog_(key) {
  try {
    const lt = table_(APP.SHEET_LOG, logHeaders_());
    const r = lt.rows[findLogIdx_(lt, key)];
    const o = {}; lt.headers.forEach((h, k) => { if (h) o[h] = r[k]; }); return o;
  } catch (e) { return null; }
}

/* ================= LINKING: Diesel Issue <-> Log Book ================= */
function dieselSummary_(no, dk, shift) {
  const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_);
  let qty = 0, km = '', hr = '', driver = '';
  // all fills of that shift added up; readings of the last fill (by time)
  t.rows.filter(r => same_(r[t.c[H.NO]], no) && dkey_(r[t.c[H.IDATE]]) === dk && str_(r[t.c[H.SHIFT]]) === shift).sort((a, b) => cmpDiesel_(a, b, t.c)).forEach(r => {
    {
      qty += num0_(r[t.c[H.QTY]]);
      if (numOrBlank_(r[t.c[H.KMR]]) !== '') km = numOrBlank_(r[t.c[H.KMR]]);
      if (numOrBlank_(r[t.c[H.HRR]]) !== '') hr = numOrBlank_(r[t.c[H.HRR]]);
      if (str_(r[t.c[H.DRIVER]]) !== '') driver = str_(r[t.c[H.DRIVER]]);
    }
  });
  return { qty: r2_(qty), km: km, hr: hr, driver: driver };
}

// A diesel issue saved after the Log Book entry updates that Log Book row.
/* A saved Diesel Issue must stay saved even if updating the Log Book link runs into a problem:
 * the link is refreshed again on the next Log Book save or edit. */
function syncLogFromDiesel_(no, dk, shift) {
  try { syncLogFromDieselInner_(no, dk, shift); } catch (e) { console.warn('Log Book link not updated for ' + no + ' ' + dk + ': ' + e.message); }
}
function syncLogFromDieselInner_(no, dk, shift) {
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  // daily entry (Full Day) takes the whole day's diesel; an old shift entry keeps its own shift's diesel
  const i = lt.rows.findIndex(r => same_(r[c[H.NO]], no) && dkey_(r[c[H.DATE]]) === dk && (str_(r[c[H.SHIFT]]) === 'Full Day' || str_(r[c[H.SHIFT]]) === shift));
  if (i === -1) { if (lt.rows.some(r => same_(r[c[H.NO]], no))) recalcCycles_(no); return; }
  const r = lt.rows[i];
  const daily = str_(r[c[H.SHIFT]]) === 'Full Day';
  const ds = daily ? dieselDay_(no, dk) : dieselSummary_(no, dk, shift);
  const m = findMachine_(no);
  const row = r.slice();
  row[c[H.QTY]] = ds.qty; row[c[H.KMR]] = ds.km; row[c[H.HRR]] = ds.hr;
  if (daily) {
    row[c[H.DREAD]] = ds.text;
    const cal = logCalc_(m, ds.qty, numOrBlank_(r[c[H.OKM]]), numOrBlank_(r[c[H.CKM]]), numOrBlank_(r[c[H.OHR]]), numOrBlank_(r[c[H.CHR]]));
    row[c[H.AVG]] = cal.avg; row[c[H.EXTRA]] = cal.extra;
  }
  if (str_(r[c[H.DRIVER]]) === '' && ds.driver) row[c[H.DRIVER]] = ds.driver;
  lt.sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
  recalcStock_(no);
}

// Stock Balance = previous Stock Balance of the same machine + Diesel Qty - Total Diesel Consumption
function recalcStock_(no) {
  recalcStockOnly_(no);
  recalcCycles_(no);
}
function recalcStockOnly_(no) {
  const lt = table_(APP.SHEET_LOG, logHeaders_());
  const c = lt.c;
  const idx = [];
  lt.rows.forEach((r, i) => { if (same_(r[c[H.NO]], no)) idx.push(i); });
  idx.sort((a, b) => cmpKey_(lt.rows[a], lt.rows[b], c) || a - b);
  const checks = tankChecksOf_(no); // physical checks, oldest first
  let stock = 0, ci = 0;
  idx.forEach((i, n) => {
    const r = lt.rows[i], dk = dkey_(r[c[H.DATE]]);
    // a physical check before this day sets the tank to what was really found
    let reset = null;
    while (ci < checks.length && checks[ci].date < dk) { reset = checks[ci].physical; ci++; }
    // first entry: the diesel already in the tank as typed; later entries: previous closing
    // opening diesel typed on the 1st of a month: the tank starts again from that figure
    const set = H.ODSET in c && /-01$/.test(dk) ? numOrBlank_(r[c[H.ODSET]]) : '';
    const open = set !== '' ? set : reset !== null ? reset : n === 0 ? (H.ODSL in c ? num0_(r[c[H.ODSL]]) : 0) : stock;
    stock = r2_(open + num0_(r[c[H.QTY]]) - num0_(r[c[H.TOT]]));
    if (H.ODSL in c && (n > 0 || reset !== null || set !== '') && String(r[c[H.ODSL]]) !== String(open)) lt.sh.getRange(i + 2, c[H.ODSL] + 1).setValue(open);
    if (r[c[H.STOCK]] !== stock) lt.sh.getRange(i + 2, c[H.STOCK] + 1).setValue(stock);
  });
}

function previousLog_(lt, no, dk, shift) {
  const key = { d: dk, s: shiftOrder_(shift) };
  let best = null;
  lt.rows.forEach(r => {
    if (!same_(r[lt.c[H.NO]], no)) return;
    const k = { d: dkey_(r[lt.c[H.DATE]]), s: shiftOrder_(str_(r[lt.c[H.SHIFT]])) };
    const before = k.d < key.d || (k.d === key.d && k.s < key.s);
    if (!before) return;
    if (!best || cmpKey_(r, best, lt.c) >= 0) best = r;
  });
  return best;
}

function lastReadings_(t, no) {
  let best = null;
  t.rows.forEach(r => {
    if (!same_(r[t.c[H.NO]], no)) return;
    if (!best || cmpDiesel_(r, best, t.c) >= 0) best = r;
  });
  return best ? { km: numOrBlank_(best[t.c[H.KMR]]), hr: numOrBlank_(best[t.c[H.HRR]]) } : { km: '', hr: '' };
}

function cmpKey_(a, b, c) {
  const da = dkey_(a[c[H.DATE]]), db = dkey_(b[c[H.DATE]]);
  if (da !== db) return da < db ? -1 : 1;
  return shiftOrder_(str_(a[c[H.SHIFT]])) - shiftOrder_(str_(b[c[H.SHIFT]]));
}

function cmpDiesel_(a, b, c) {
  const da = dkey_(a[c[H.IDATE]]), db = dkey_(b[c[H.IDATE]]);
  if (da !== db) return da < db ? -1 : 1;
  const s = shiftOrder_(str_(a[c[H.SHIFT]])) - shiftOrder_(str_(b[c[H.SHIFT]]));
  if (s) return s;
  const ta = a[c[H.CREATED]] instanceof Date ? a[c[H.CREATED]].getTime() : 0;
  const tb = b[c[H.CREATED]] instanceof Date ? b[c[H.CREATED]].getTime() : 0;
  return ta - tb;
}

// Driver names already used (for suggestions in the app)
function getDrivers_() {
  const names = {};
  [APP.SHEET_DIESEL, APP.SHEET_LOG].forEach(n => {
    const t = table_(n, [H.DRIVER]);
    t.rows.forEach(r => { const v = str_(r[t.c[H.DRIVER]]); if (v) names[v.toUpperCase()] = v; });
  });
  return Object.keys(names).map(k => names[k]).sort();
}

/* ================= HELPERS ================= */
// Columns the Log Book must have. Newer columns (Chainage From / To, Remark, Actual Average, Extra / Short,
// Diesel Readings, Fill Cycle, Opening Diesel) are used when present – setupLogBookDaily adds them.
function logHeaders_() {
  return [H.DATE, H.NO, H.SHIFT, H.OWNER, H.QTY, H.KMR, H.HRR, H.TYPE, H.UNIT, H.OKM, H.CKM, H.WKM,
    H.OHR, H.CHR, H.WHR, H.KMSTD, H.HRSTD, H.CKMC, H.CHRC, H.TOT, H.STOCK, H.TRIP, H.CH, H.WORK, H.DRIVER];
}

// Each tab is read once per request and kept in memory. The moment a tab is written (appendRow, getRange…set, deleteRow)
// its copy is dropped, so the next read in the same request is fresh.
let TABLE_MEMO_ = null;
function writeGuard_(sh, name) {
  const drop = () => { if (TABLE_MEMO_) { delete TABLE_MEMO_[name]; if (name === APP.SHEET_MASTER) delete TABLE_MEMO_.__master; } };
  // a range whose setValue / setValues store user text safely (never as a formula)
  const safeRange = rg => new Proxy(rg, { get: (t, p) => p === 'setValues' ? v => t.setValues(safeRows_(v)) : p === 'setValue' ? v => t.setValue(safeCell_(v)) : (typeof t[p] === 'function' ? t[p].bind(t) : t[p]) });
  return {
    appendRow: row => { drop(); return sh.appendRow(safeRows_(row)); },
    deleteRow: r => { drop(); return sh.deleteRow(r); },
    getRange: function () { drop(); return safeRange(sh.getRange.apply(sh, arguments)); },
    getLastRow: () => sh.getLastRow(),
    getName: () => sh.getName(),
  };
}
function table_(name, required) {
  let t = TABLE_MEMO_ ? TABLE_MEMO_[name] : null;
  if (!t) {
    const sh = SS_().getSheetByName(name);
    if (!sh) throw new Error('Tab "' + name + '" not found in the Google Sheet. Run setupDieselStock and setupLogin (Setup.gs) once.');
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const lastRow = sh.getLastRow();
    // one read for header + data
    const all = sh.getRange(1, 1, Math.max(lastRow, 1), lastCol).getValues();
    const headers = all[0].map(h => String(h).trim());
    const c = {};
    headers.forEach((h, i) => { if (h && !(h in c)) c[h] = i; });
    t = { sh: writeGuard_(sh, name), headers: headers, c: c, rows: lastRow > 1 ? all.slice(1) : [] };
    if (TABLE_MEMO_) TABLE_MEMO_[name] = t;
  }
  (required || []).forEach(h => { if (!(h in t.c)) throw new Error('Column "' + h + '" not found in tab "' + name + '". Run setupDieselStock (Setup.gs) once.'); });
  return t;
}

function findMachine_(no) {
  const m = getMaster_().find(x => same_(x.id, no));
  if (!m) throw new Error('"' + clean_(no) + '" is not in Master.');
  if (m.ownership !== 'Debit' && APP.UNITS.indexOf(m.unit) === -1) throw new Error('Set the Unit for ' + m.id + ' in Master first.');
  return m;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const outer = SB_DEPTH_ === 0;
  SB_DEPTH_++;
  // someone else may have saved while we waited: start this save with fresh data
  if (outer) { if (TABLE_MEMO_) TABLE_MEMO_ = {}; if (sbDataOn_()) sbDiscard_(); }
  try {
    const out = fn();
    if (outer) sbFlush_();                  // Supabase: everything of this save is written together
    return out;
  } catch (e) {
    if (outer && sbDataOn_()) { sbDiscard_(); if (TABLE_MEMO_) TABLE_MEMO_ = {}; } // nothing of a failed save is written
    throw e;
  } finally { SB_DEPTH_--; lock.releaseLock(); }
}

function set_(row, t, header, value) { if (header in t.c) row[t.c[header]] = value; }
/* Who made / changed an entry: the signed-in user of the request (shown in the app's lists, not in reports) */
let ACTOR_ = '';
function newRow_(t) { const row = new Array(t.headers.length).fill(''); set_(row, t, H.EBY, ACTOR_); return row; }
function stampEdit_(row, t) { if (ACTOR_) set_(row, t, H.UBY, ACTOR_); return row; }
function hasKm_(unit) { return unit === 'KM' || unit === 'KM + Hrs'; }
function hasHr_(unit) { return unit === 'Hrs' || unit === 'KM + Hrs'; }
function shiftOrder_(s) { return s === 'Night' ? 1 : 0; }
function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function clean_(v) { return str_(v).replace(/\s+/g, ' '); }
function noKey_(v) { return str_(v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function same_(a, b) { return noKey_(a) === noKey_(b); }
// MH25AJ5974 / mh 25 aj 5974 / MH-25 AJ 5974  ->  MH-25-AJ-5974  (names without a reg. number stay as typed)
function formatNo_(v) {
  const s = clean_(v);
  const m = noKey_(s).match(/^([A-Z]{2})(\d{2})([A-Z]{0,3})(\d{4})$/);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join('-') : s;
}
function r2_(n) { return Math.round(n * 100) / 100; }
function num0_(v) { const n = numOrBlank_(v); return n === '' ? 0 : n; }
function numOrBlank_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}
function reqReading_(v, label) {
  const n = numOrBlank_(v);
  if (n === '' || n < 0) throw new Error('Enter ' + label + '.');
  return n;
}
function checkShift_(s) {
  if (APP.SHIFTS.indexOf(s) === -1) throw new Error('Select a Shift (Day / Night).');
  return s;
}
/* Date of an entry (Diesel Issue, Inward, Transfer, Log Book): never after today,
 * so a mistyped future date cannot make the live stock differ from today's closing. */
function entryDate_(s) {
  const dk = checkDate_(s);
  if (dk > today_()) throw new Error('Date ' + dmy_(dk) + ' is after today (' + dmy_(today_()) + '). Entries can be made only up to today.');
  return dk;
}
function checkDate_(s) {
  const v = str_(s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Select a Date.');
  return v;
}
function tz_() { return SS_().getSpreadsheetTimeZone(); }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function toDate_(dk) { const p = dk.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12, 0, 0); }
function dkey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const s = str_(v);
  const mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); // dd-mm-yyyy typed as text
  if (mt) return mt[3] + '-' + mt[2].padStart(2, '0') + '-' + mt[1].padStart(2, '0');
  return s.slice(0, 10);
}
