/* ---------- SEVERAL SITES, ONE APP (stage 1: update-89; stage 2: update-90) ----------
 * Every site has its OWN database (its own Supabase project) and its own Google Sheet; the app (this code) is one for all.
 * A request says which site it is for (meta.site – a short code). No code (or '') = the FIRST site: the database of the
 * Vercel settings SUPABASE_URL / SUPABASE_SECRET_KEY and the Sheet of BACKUP_SHEET_ID – exactly as before.
 *
 * THE LIST OF SITES (stage 2) is kept in the first site's database (sql/supabase_step7_sites.sql → public.rcl_sites):
 *   the first site is the row marked "home" (code S1) – nothing about its database is stored, it is the one in Vercel;
 *   any other site keeps its database link and key LOCKED (db_key_enc: AES-256-GCM with a key made from the Vercel setting
 *   RCL_SITES_KEY – without that setting no other site can be opened, and the database alone gives nobody the key).
 * Where the step-7 SQL is not run yet, there is no list: the first site only, as before.
 * The list is kept in this server's memory for 15 seconds (a change made by the Super Admin on THIS server is seen at once). */
'use strict';
const crypto = require('crypto');
const { fetchAllSync, sleepSync } = require('./syncfetch');

const CODE = /^[A-Z0-9]{1,12}$/;
function code(c) {
  const s = String(c === undefined || c === null ? '' : c).trim().toUpperCase();
  if (s === '') return '';
  if (!CODE.test(s)) throw new Error('This site is not set up (' + s.slice(0, 20) + ').');
  return s;
}
function homeConf() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key = String(process.env.SUPABASE_SECRET_KEY || '');
  if (!url || !key) throw new Error('The server is not set up: add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel → Settings → Environment Variables, then Redeploy.');
  return { site: '', url: url, key: key, sheet: String(process.env.BACKUP_SHEET_ID || '').trim() };
}

/* one call to the FIRST site's database (REST) → parsed answer; 404 of a missing table → null (step 7 not run) */
function homeRest(method, path, body, prefer) {
  const c = homeConf(); let last = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const h = { apikey: c.key, 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
    const r = fetchAllSync([{ url: c.url + '/rest/v1/' + path, method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }])[0];
    if (r.error) { last = r.error; sleepSync(300 * (attempt + 1)); continue; }
    if (r.code >= 200 && r.code < 300) return r.text ? JSON.parse(r.text) : null;
    if ((r.code === 404 || r.code === 400) && /PGRST205|42P01|does not exist|Could not find the table/i.test(String(r.text || ''))) { const e = new Error('NOT_INSTALLED'); e.notInstalled = true; throw e; }
    last = r.code + ' ' + String(r.text || '').slice(0, 300);
    if (r.code >= 500 || r.code === 429) { sleepSync(400 * (attempt + 1)); continue; }
    throw new Error('Database (sites): ' + last);
  }
  throw new Error('Could not reach the database (sites): ' + last);
}

/* ---------- the lock on the other sites' keys ---------- */
function lockKey() {
  const k = String(process.env.RCL_SITES_KEY || '');
  if (k.length < 24) return null;
  return crypto.createHash('sha256').update('rcl-sites|' + k).digest();
}
function seal(text) {
  const k = lockKey(); if (!k) throw new Error('The server has no key for sites yet: add RCL_SITES_KEY (at least 24 letters and digits) in Vercel → Settings → Environment Variables, then Redeploy.');
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return 'v1.' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}
function open(sealed) {
  const k = lockKey(); if (!k) throw new Error('This site cannot be opened: the server has no key for sites (RCL_SITES_KEY in Vercel).');
  const s = String(sealed || ''); if (!/^v1\./.test(s)) throw new Error('This site cannot be opened: its database key is not kept the right way.');
  const b = Buffer.from(s.slice(3), 'base64url');
  try { const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); }
  catch (e) { throw new Error('This site cannot be opened: its database key does not match the server\'s key for sites (RCL_SITES_KEY).'); }
}

/* ---------- (update-95) a site's database key kept in Vercel ----------
 * A site made from the Portal ("New site") keeps its secret key ONLY in Vercel → Environment Variables, under SITE_<CODE>_KEY
 * (e.g. SITE_18B_KEY) – nothing about it is stored in any database. (A site of update-90 with its key locked in the list
 * still works the same way.) */
const envKeyName = c => 'SITE_' + String(c || '').toUpperCase() + '_KEY';
const envKey = c => String(process.env[envKeyName(c)] || '').trim();
// the site being set up by "New site" (one request only): its database is used before it is in the list as ready
let SETUP = null;
function setupWith(c) { SETUP = c || null; }

/* ---------- the list ---------- */
let REG = { at: 0, rows: null, off: false, sa: false };
const REG_MS = 15000;
function registry(fresh) {
  if (!fresh && REG.at && Date.now() - REG.at < REG_MS) return REG.off ? null : REG.rows;
  try {
    const rows = homeRest('GET', 'rcl_sites?select=code,name,company_id,home,status,sheet,db_url,db_key_enc,sort&order=sort.asc,code.asc') || [];
    // (cannot be read now: taken as "there is one" – an Admin's change of users is refused rather than let through – and asked again in 2 s)
    let sa = true, saOk = true; try { sa = (homeRest('GET', 'rcl_super_admin?select=email&limit=1') || []).length > 0; } catch (e) { sa = true; saOk = false; }
    REG = { at: saOk ? Date.now() : Date.now() - REG_MS + 2000, rows: rows, off: false, sa: sa };
  } catch (e) {
    if (e && e.notInstalled) { REG = { at: Date.now(), rows: null, off: true, sa: false }; return null; }
    if (REG.rows) return REG.rows;      // the list could not be read now: the last one known
    throw e;
  }
  return REG.rows;
}
function forget() { REG = { at: 0, rows: null, off: false, sa: false }; }
function superExists() { registry(); return !!REG.sa; }
// the code of the first site ('S1'), or '' where there is no list
function homeCode() { const r = registry(); const h = r && r.find(x => x.home); return h ? h.code : ''; }
// a site's code as the list knows it: the first site is always '' inside the server (one memory for it, whatever it is called)
function norm(c) { c = code(c); if (!c) return ''; const r = registry(); const h = r && r.find(x => x.home); return h && h.code === c ? '' : c; }
// the database (and Sheet) of a site
function conf(c, opt) {
  c = norm(c);
  if (c === '') return homeConf();
  if (SETUP && SETUP.site === c) return SETUP;
  const r = registry(), x = r && r.find(y => y.code === c);
  if (!x) throw new Error('This site is not set up (' + c + ').');
  if ((x.status !== 'ready' && !(opt && opt.setup)) || !x.db_url || (!x.db_key_enc && !envKey(c))) throw new Error('This site is not set up (' + c + ').');
  return { site: c, url: String(x.db_url).replace(/\/+$/, ''), key: x.db_key_enc ? open(x.db_key_enc) : envKey(c), sheet: String(x.sheet || '').trim() };
}
module.exports = { code, conf, norm, homeConf, homeCode, homeRest, registry, forget, superExists, seal, open, envKey, envKeyName, setupWith };
