/* (update-157) THE BACKUP OF THE OTHER MODULES: the Engineering module's rows of a site and the Portal's users and access come
 * through their own "backup export" (api/backup-export.js in rcl-engineering and rcl-portal). This server asks it with
 * BACKUP_EXPORT_SECRET – the same value in Vercel for rclerp, rcl-portal and rcl-engineering; it is never in a file or the page.
 * They keep their own database keys: a password, a key or a sign-in never leaves them (the export leaves those out itself).
 * Where they are: the Portal at PORTAL_URL (as for the sign-in); Engineering at ENGINEERING_URL, else where this project's
 * vercel.json sends /engineering (https://rcl-engineering.vercel.app). */
'use strict';
const path = require('path');
const { fetchAllSync } = require('./syncfetch');
const secret = () => String(process.env.BACKUP_EXPORT_SECRET || '');
function base(source) {
  if (source === 'portal') return String(process.env.PORTAL_URL || '').trim().replace(/\/+$/, '');
  if (source !== 'eng') return '';
  const e = String(process.env.ENGINEERING_URL || '').trim(); if (e) return e.replace(/\/+$/, '');
  try { const v = require(path.join(__dirname, '..', 'vercel.json')); const r = (v.rewrites || []).find(x => x && x.source === '/engineering/:path*');
    if (r) return String(r.destination).replace(/\/:path\*$/, '').replace(/\/+$/, ''); } catch (e2) { /* not known */ }
  return '';
}
function on() { return { secret: secret().length >= 24, eng: !!base('eng'), portal: !!base('portal') }; }
function call(source, bodyJson, ms) {
  if (secret().length < 24) return { code: 0, text: 'BACKUP_EXPORT_SECRET is not set (at least 24 letters and digits, the same in the three projects)' };
  const b = base(source); if (!b) return { code: 0, text: 'the address of ' + source + ' is not known' };
  const r = fetchAllSync([{ url: b + '/api/backup-export', method: 'POST', headers: { Authorization: 'Bearer ' + secret(), 'Content-Type': 'application/json', 'X-RCL': '1' }, body: String(bodyJson || '{}') }], Math.max(5000, Math.min(30000, Number(ms) || 25000)))[0];
  return r.error ? { code: 599, text: String(r.error).slice(0, 300) } : { code: r.code, text: r.text || '' };
}
module.exports = { on, call, base };
