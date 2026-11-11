/* (update-232, asked 12-11-2026) ONE CLICK SOLUTION – the first page: "user adhi company name takel … RCL takel mg RCL che page
 * yeil ani RCL che fkt user login kru shakel". GET /api/company?code=RCL → { ok: true, url: <that company's sign-in> } or
 * { ok: false }. Each company has its OWN Portal and databases (his decision), so only its own people can sign in there.
 * The list is never given out: one code is asked, one answer is given. The codes are not secrets (a company's people are told
 * theirs); the list of customers is kept out of this public repository – in Vercel → Environment Variables:
 *   OCS_COMPANIES = RCL=/portal/,MILESTONE=https://<its address>/portal/
 * Not set: only RCL, at this address's own Portal (/portal/). */
'use strict';
const CODE = /^[A-Z0-9]{2,20}$/;
function list() {
  const out = {}, raw = String(process.env.OCS_COMPANIES || '').trim() || 'RCL=/portal/';
  raw.split(/[,;\n]+/).forEach(p => {
    const i = p.indexOf('='); if (i < 1) return;
    const code = p.slice(0, i).trim().toUpperCase(), url = p.slice(i + 1).trim();
    if (CODE.test(code) && (/^\/[A-Za-z0-9/_-]*$/.test(url) || /^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9/_-]*)?$/.test(url))) out[code] = url;      // this address's own path, or an https address
  });
  return out;
}
function find(code) { code = String(code || '').trim().toUpperCase(); if (!CODE.test(code)) return null; const all = list(); return Object.prototype.hasOwnProperty.call(all, code) ? { code: code, url: all[code] } : null; }
module.exports = (req, res) => {
  const send = (status, o) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.end(JSON.stringify(o)); };
  if (req.method !== 'GET') return send(405, { ok: false });
  let code = ''; try { code = new URL(String(req.url || ''), 'https://x').searchParams.get('code') || ''; } catch (e) { code = ''; }
  const c = find(code);
  return c ? send(200, { ok: true, code: c.code, url: c.url }) : send(200, { ok: false });
};
module.exports.find = find; module.exports.list = list;
