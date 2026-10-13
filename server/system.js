/* ================= SEVERAL SITES, ONE APP – the server's side (update-90, stage 2 of "new site") =================
 * What needs MORE THAN ONE site at a time is done here (each site's own part runs inside that site – app/Sites.gs):
 *   login           which site a person opens: his default site; an Admin never asked; a person with several sites and no
 *                   default site is asked (the page shows the choice) – the password is proved on one of his sites first
 *   switchSite      open another of his sites without signing in again (the server proves him on the site he is on)
 *   setDefaultSite  his default site (Settings)
 *   changePassword  a password changed on one site is written to his other sites too
 *   super           the Super Admin: sites, users and access per site, companies – and nothing of any site's entries or reports
 * R = { runIn(site, fn, args) } – runs one of the app's own functions inside a site (runtime.js), its answer parsed. */
'use strict';
const sites = require('./sites');
const portal = require('./portal');

const lc = s => String(s || '').trim().toLowerCase();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// the sites a person has (ready ones, in the list's order); a person not listed yet = the first site (users made before step 7)
function memberships(email) {
  const reg = sites.registry() || [], e = lc(email);
  let rows = [];
  try { rows = sites.homeRest('GET', 'rcl_user_sites?select=site,is_admin,is_default&email=eq.' + encodeURIComponent(e)) || []; } catch (er) { if (!(er && er.notInstalled)) throw er; }
  const ready = reg.filter(x => x.status === 'ready');
  const mine = ready.filter(x => rows.some(r => r.site === x.code)).map(x => { const r = rows.find(y => y.site === x.code); return { code: x.code, home: !!x.home, admin: !!r.is_admin, def: !!r.is_default }; });
  if (!rows.length) { const h = ready.find(x => x.home); if (h) mine.push({ code: h.code, home: true, admin: false, def: false, unlisted: true }); }
  return mine;
}
// the name of a site as the switch shows it: the list's name, or (filled once) the site name of its "Company & site"
// (only the first site is asked for its name on a sign-in – a site far away that does not answer must never slow a sign-in;
// the Super Admin's Sites list asks every site: all = true)
function siteNames(R, all) {
  const reg = sites.registry() || [], out = {};
  reg.forEach(x => {
    let n = String(x.name || '').trim();
    if (!n && x.status === 'ready' && (all || x.home)) {
      try { const o = R.runIn(x.home ? '' : x.code, 'orgInfo', []); n = String((o && (o.site || o.customer)) || '').trim();
        if (n) { sites.homeRest('PATCH', 'rcl_sites?code=eq.' + encodeURIComponent(x.code), { name: n }, 'return=minimal'); x.name = n; } } catch (e) { /* shown by its code */ }
    }
    out[x.code] = n || x.code;
  });
  return out;
}
const pub = (mine, names, cur) => mine.map(m => ({ code: m.code, name: names[m.code] || m.code, default: !!m.def, current: m.code === cur }));
// what the page needs to show the site it is on and the others of this person (added to getInit by runtime.js)
function siteInfo(R, email, curNorm) {
  const reg = sites.registry(); if (!reg) return null;
  const mine = memberships(email), names = siteNames(R), cur = curNorm === '' ? sites.homeCode() : curNorm;
  return { site: cur, name: names[cur] || cur, sites: pub(mine, names, cur) };
}

/* ---- sign-in ---- */
function login(R, args) {
  const email = lc(args[0]), pw = args[1], opt = (args[2] && typeof args[2] === 'object') ? args[2] : {};
  const reg = sites.registry();
  if (!reg) return R.runIn('', 'login', [args[0], pw]);                               // step 7 not run: the first site, as before
  // the Super Admin signs in on the same screen
  let sa = null; try { sa = (sites.homeRest('GET', 'rcl_super_admin?select=email&email=eq.' + encodeURIComponent(email)) || [])[0] || null; } catch (e) { sa = null; }
  if (sa) return R.runIn('', 'saLogin', [email, pw]);
  const mine = memberships(email);
  if (!mine.length) return R.runIn('', 'login', [args[0], pw]);                       // nobody's site: the first site says "wrong email or password"
  const want = String(opt.site || '').toUpperCase(), last = String(opt.last || '').toUpperCase();
  const def = mine.find(m => m.def), admin = mine.some(m => m.admin);
  const pick = mine.find(m => m.code === want) || def || (admin ? (mine.find(m => m.code === last) || mine[0]) : mine[0]);
  const choose = mine.length > 1 && !mine.some(m => m.code === want) && !def && !admin;
  /* the password is ALWAYS proved on the person's first site: one count of wrong tries per person (5, then 15 minutes),
   * whichever of his sites is asked for. The site to open then gets its own session from the server (as "open another site").
   * A one-time password is set on that first site first; the page then opens the site meant (want). */
  const proof = mine[0], r = R.runIn(proof.home ? '' : proof.code, 'login', [args[0], pw]);
  let res = Object.assign({}, r, { site: proof.code });
  if (pick.code !== proof.code && !r.mustChange) {
    const s = R.runIn(pick.home ? '' : pick.code, 'sysSession', [email]);
    try { R.runIn(proof.home ? '' : proof.code, 'logout', [r.token]); } catch (e) { /* that session simply runs out */ }
    res = Object.assign({}, r, { token: s.token, user: s.user, site: pick.code });
  }
  const names = siteNames(R);
  return Object.assign(res, { siteName: names[res.site] || res.site, sites: pub(mine, names, res.site), choose: choose, want: pick.code });
}
/* ---- (update-91) sign-in through the Portal: a ticket (server/portal.js) → a session on the site the ticket names ----
 * The Portal is the one place access is given: a person with a ticket for a site gets in there – the site writes him into
 * its Users if he is new, switches him on, and sets Admin as the Portal says (Sites.gs sysSso_). Which PAGES he sees inside
 * stays this app's own access, set by the site's Admin as before. */
function ssoLogin(R, args) {
  const c = portal.verify(args[0]);
  const reg = sites.registry();
  let at = '';
  if (reg) {
    const s = reg.find(x => x.code === c.site);
    if (!s || s.status !== 'ready') throw new Error('This site is not set up (' + c.site + ').');
    at = s.home ? '' : s.code;
  }
  const r = R.runIn(at, 'sysSso', [{ email: c.email, name: c.name, admin: c.admin, jti: c.jti, exp: c.exp }]);
  if (reg) { try { keepMembership(c.email, c.site, true, c.admin); } catch (e) { console.error('[portal sign-in: site list] ' + String((e && e.message) || e)); } }      // (only the app's own list – the sign-in works without it)
  return { token: r.token, user: r.user, site: reg ? c.site : '', siteName: c.siteName, portal: { url: portal.url(), mods: c.mods, sites: c.sites } };
}
/* ---- open another of my sites ---- */
function switchSite(R, args, curNorm) {
  const token = String(args[0] || ''), target = String(args[1] || '').toUpperCase();
  const who = R.runIn(curNorm, 'sysWho', [token]);
  const mine = memberships(who.email), t = mine.find(m => m.code === target);
  if (!t) throw new Error('You do not have access to this site. Ask the Super Admin.');
  const cur = curNorm === '' ? sites.homeCode() : curNorm;
  if (t.code === cur) { const names = siteNames(R); return { token: token, site: cur, siteName: names[cur] || cur, sites: pub(mine, names, cur), same: true }; }
  const s = R.runIn(t.home ? '' : t.code, 'sysSession', [who.email]);
  try { R.runIn(curNorm, 'logout', [token]); } catch (e) { /* that session simply runs out */ }
  const names = siteNames(R);
  return { token: s.token, user: s.user, site: t.code, siteName: names[t.code] || t.code, sites: pub(mine, names, t.code) };
}
function setDefaultSite(R, args, curNorm) {
  const who = R.runIn(curNorm, 'sysWho', [String(args[0] || '')]), code = String(args[1] || '').toUpperCase();
  const mine = memberships(who.email);
  if (code && !mine.some(m => m.code === code)) throw new Error('You do not have access to this site. Ask the Super Admin.');
  if (mine.some(m => m.unlisted)) throw new Error('Your sites are not set yet – ask the Super Admin.');
  sites.homeRest('PATCH', 'rcl_user_sites?email=eq.' + encodeURIComponent(who.email), { is_default: false }, 'return=minimal');
  if (code) sites.homeRest('PATCH', 'rcl_user_sites?email=eq.' + encodeURIComponent(who.email) + '&site=eq.' + encodeURIComponent(code), { is_default: true }, 'return=minimal');
  const names = siteNames(R), cur = curNorm === '' ? sites.homeCode() : curNorm;
  return { ok: true, sites: pub(memberships(who.email), names, cur) };
}
/* ---- a password changed on one site → his other sites (the person keeps ONE password) ---- */
function passwordToOthers(R, email, fromNorm) {
  if (!sites.registry()) return { others: 0 };
  const row = R.runIn(fromNorm, 'sysUserRow', [email]); if (!row || !row.exists || !row.pw) return { others: 0 };
  const from = fromNorm === '' ? sites.homeCode() : fromNorm; let n = 0; const failed = [];
  memberships(email).filter(m => m.code !== from && !m.unlisted).forEach(m => {
    try { const r = R.runIn(m.home ? '' : m.code, 'sysSetPw', [email, row.pw]); if (r && r.ok) n++; }
    catch (e) { failed.push(m.code); console.error('[password to site ' + m.code + '] ' + String((e && e.message) || e)); }
  });
  return { others: n, failed: failed };
}
// which sites a person is on, written from what the site itself says after the Super Admin changed him there
function keepMembership(email, code, active, admin) {
  const e = lc(email);
  if (active) sites.homeRest('POST', 'rcl_user_sites?on_conflict=email,site', [{ email: e, site: code, is_admin: !!admin }], 'resolution=merge-duplicates,return=minimal');
  else sites.homeRest('DELETE', 'rcl_user_sites?email=eq.' + encodeURIComponent(e) + '&site=eq.' + encodeURIComponent(code), undefined, 'return=minimal');
}

/* ================= THE SUPER ADMIN ================= */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const clean = (v, n) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 200);
function superDo(R, args) {
  const token = String(args[0] || ''), action = String(args[1] || ''), x = (args[2] && typeof args[2] === 'object') ? args[2] : {};
  if (!sites.registry()) throw new Error('This needs one database step first: run sql/supabase_step7_sites.sql once in Supabase → SQL Editor (the first site only).');
  if (action === 'recover') return R.runIn('', 'saRecover', [x.email, x.code, x.password]);      // (no session: the recovery code proves him)
  const me = R.runIn('', 'saWho', [token]);
  const siteOf = c => { const s = (sites.registry() || []).find(y => y.code === String(c || '').toUpperCase()); if (!s) throw new Error('This site is not set up (' + String(c || '').slice(0, 20) + ').'); return s; };
  const at = s => (s.home ? '' : s.code);
  switch (action) {
    case 'me': return me;
    case 'logout': return R.runIn('', 'saLogout', [token]);
    case 'changePassword': return R.runIn('', 'saChangePassword', [token, x.old, x.password]);
    case 'sites': {
      sites.registry(true);
      const names = siteNames(R, true), reg = sites.registry() || [];
      let comps = []; try { comps = sites.homeRest('GET', 'rcl_companies?select=id,name&order=name.asc') || []; } catch (e) { comps = []; }
      let mem = []; try { mem = sites.homeRest('GET', 'rcl_user_sites?select=site') || []; } catch (e) { mem = []; }
      return { sites: reg.map(s => ({ code: s.code, name: names[s.code] || s.code, home: !!s.home, status: s.status, company: s.company_id || '', users: mem.filter(m => m.site === s.code).length, sheet: !!s.sheet || !!s.home })), companies: comps };
    }
    case 'siteCheck': {
      const s = siteOf(x.site), t0 = Date.now();
      try { const o = R.runIn(at(s), 'orgInfo', []); return { ok: true, ms: Date.now() - t0, customer: o.customer, site: o.site }; }
      catch (e) { return { ok: false, error: String((e && e.message) || e).slice(0, 300) }; }
    }
    case 'siteSave': {
      const s = siteOf(x.site), name = clean(x.name, 80), comp = clean(x.company, 40);
      if (name.length < 2) throw new Error('Give the site a name (2 to 80 letters).');
      if (comp && !(sites.homeRest('GET', 'rcl_companies?select=id&id=eq.' + encodeURIComponent(comp)) || []).length) throw new Error('This company is not in the list.');
      sites.homeRest('PATCH', 'rcl_sites?code=eq.' + encodeURIComponent(s.code), { name: name, company_id: comp || null }, 'return=minimal');
      sites.forget(); return { ok: true };
    }
    case 'companies': return { companies: sites.homeRest('GET', 'rcl_companies?select=id,name,address,gstin,pan,logo&order=name.asc') || [] };
    case 'companySave': {
      const name = clean(x.name, 80), gstin = clean(x.gstin, 15).toUpperCase(), pan = clean(x.pan, 10).toUpperCase(), logo = clean(x.logo, 300), address = clean(x.address, 300);
      if (name.length < 2) throw new Error('Enter the name of the company (2 to 80 letters).');
      if (gstin && !GSTIN.test(gstin)) throw new Error('GST Number "' + gstin + '" is not in the right format (15 characters, e.g. 27ABCDE1234F1Z5).');
      if (pan && !PAN.test(pan)) throw new Error('PAN "' + pan + '" is not in the right format (10 characters, e.g. ABCDE1234F).');
      if (logo && !/^https:\/\/[^\s"'<>]{4,300}$/.test(logo)) throw new Error('The logo must be a link that starts with https:// (or be left empty).');
      const all = sites.homeRest('GET', 'rcl_companies?select=id,name') || [];
      if (all.some(c => c.name.toUpperCase() === name.toUpperCase() && c.id !== x.id)) throw new Error('There is already a company with this name.');
      if (x.id) {
        if (!all.some(c => c.id === x.id)) throw new Error('This company is not in the list.');
        sites.homeRest('PATCH', 'rcl_companies?id=eq.' + encodeURIComponent(x.id), { name: name, address: address, gstin: gstin, pan: pan, logo: logo }, 'return=minimal');
        return { ok: true, id: x.id };
      }
      let id = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 20) || 'CO'; const base = id; let n = 2;
      while (all.some(c => c.id === id)) id = base.slice(0, 18) + (n++);
      sites.homeRest('POST', 'rcl_companies', [{ id: id, name: name, address: address, gstin: gstin, pan: pan, logo: logo }], 'return=minimal');
      return { ok: true, id: id };
    }
    case 'users': {
      const s = siteOf(x.site), d = R.runIn(at(s), 'sysUsers', []);
      let mem = []; try { mem = sites.homeRest('GET', 'rcl_user_sites?select=email,site') || []; } catch (e) { mem = []; }
      const here = new Set((d.users || []).map(u => u.email));
      const elsewhere = [...new Set(mem.filter(m => m.site !== s.code && !here.has(m.email)).map(m => m.email))].sort();
      return { site: s.code, users: d.users, modules: d.modules, elsewhere: elsewhere };
    }
    case 'accessReport': return R.runIn(at(siteOf(x.site)), 'sysAccessReport', []);
    case 'userSave': {
      const s = siteOf(x.site), u = Object.assign({}, x.user || {}), email = lc(u.email);
      if (!EMAIL.test(email)) throw new Error('Enter a proper email.');
      u.email = email;
      if ((sites.homeRest('GET', 'rcl_super_admin?select=email&email=eq.' + encodeURIComponent(email)) || []).length) throw new Error('This is the Super Admin\'s email – a user needs an email of his own.');
      const mine = memberships(email).filter(m => m.code !== s.code);
      // a person new on this site who is already on another site keeps his one password (unless a one-time password is typed)
      let pw = '';
      if (u.isNew && !u.newPassword) {
        for (const m of mine) { try { const row = R.runIn(m.home ? '' : m.code, 'sysUserRow', [email]); if (row && row.exists && row.pw) { pw = row.pw; break; } } catch (e) { /* the next site */ } }
        if (!pw) throw new Error('Give a one-time password of at least 6 characters – the user must change it at the first sign-in.');
      }
      // a person of the first site who is not in the list yet (made before step 7) keeps the first site when he gets another one
      const before = memberships(email);
      const res = R.runIn(at(s), 'sysSaveUser', [u, me, pw]);
      if (before.some(m => m.unlisted) && !siteOf(s.code).home) {
        const h = before.find(m => m.unlisted), row = R.runIn('', 'sysUserRow', [email]);
        if (row && row.exists && row.active) keepMembership(email, h.code, true, row.admin);
      }
      keepMembership(email, s.code, res.active, res.admin);
      // a one-time password typed here is his password on every site of his (one password everywhere)
      let others = { others: 0 };
      if (u.newPassword) others = passwordToOthers(R, email, at(s));
      return Object.assign({}, res, { copiedPassword: !!pw, otherSites: others.others, failedSites: others.failed || [] });
    }
    default: throw new Error('Unknown action.');
  }
}
module.exports = { login, ssoLogin, switchSite, setDefaultSite, passwordToOthers, siteInfo, superDo, memberships };
