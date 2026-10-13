/* ---------- SEVERAL SITES, ONE APP (stage 1 of "new site", asked 12-10-2026) ----------
 * Every site has its OWN database (its own Supabase project) and its own Google Sheet; the app (this code) is one for all.
 * A request says which site it is for (meta.site – a short code). No code (or '') = the FIRST site: the database of the
 * Vercel settings SUPABASE_URL / SUPABASE_SECRET_KEY and the Sheet of BACKUP_SHEET_ID – exactly as before; nothing
 * changes for it.
 * Stage 1 only makes the server ready: what the server keeps in its memory (the copy of the tables, the heartbeat's
 * memory, "is this SQL step installed?") is kept per site, so the data of two sites can never mix.
 * Where the other sites' settings come from: stage 2 / 3 (the sites list kept by the Super Admin). Until then only
 * RCL_SITES can name one – a test setting ({"T2":{"url":"…","key":"…","sheet":"…"}}); not set = the first site only. */
'use strict';

const CODE = /^[A-Z0-9]{1,12}$/;
function code(c) {
  const s = String(c === undefined || c === null ? '' : c).trim().toUpperCase();
  if (s === '') return '';
  if (!CODE.test(s)) throw new Error('This site is not set up (' + s.slice(0, 20) + ').');
  return s;
}
let listed = null;
function others() {
  if (listed) return listed;
  let o = {};
  try { o = JSON.parse(String(process.env.RCL_SITES || '').trim() || '{}') || {}; } catch (e) { o = {}; }
  listed = new Map();
  Object.keys(o).forEach(k => { const c = String(k).trim().toUpperCase(), x = o[k] || {};
    if (CODE.test(c) && x.url && x.key) listed.set(c, { url: String(x.url).replace(/\/+$/, ''), key: String(x.key), sheet: String(x.sheet || '').trim() }); });
  return listed;
}
// the database (and Sheet) of a site
function conf(c) {
  c = code(c);
  if (c === '') {
    const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key = String(process.env.SUPABASE_SECRET_KEY || '');
    if (!url || !key) throw new Error('The server is not set up: add SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel → Settings → Environment Variables, then Redeploy.');
    return { site: '', url: url, key: key, sheet: String(process.env.BACKUP_SHEET_ID || '').trim() };
  }
  const x = others().get(c);
  if (!x) throw new Error('This site is not set up (' + c + ').');
  return { site: c, url: x.url, key: x.key, sheet: x.sheet };
}
module.exports = { code, conf };
