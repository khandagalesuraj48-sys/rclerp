/* ================= SEVERAL SITES, ONE APP – the parts that run INSIDE one site (update-90, stage 2 of "new site") =================
 * Asked 12/13-10-2026: one app for every site; every site its own database. A Super Admin designs the system – sites, users
 * and their access on each site, companies – and makes no entries and sees no reports. Users and access are given by the
 * Super Admin only; a user's access is separate on every site. A user with several sites opens his default site (Settings),
 * or is asked which one; an Admin is never asked.
 *
 * HOW A USER IS ON SEVERAL SITES: every site keeps its own Users table (its own access per page – the rules of this app are
 * unchanged). The Super Admin puts the person on a site; the server then writes him into that site's Users with that site's
 * access and the SAME kept password (so one password opens every site of his). A password changed on one site is written
 * to his other sites by the server (runtime → system.js). Which sites a person has: public.rcl_user_sites in the first
 * site's database.
 * THE SUPER ADMIN is kept in the first site's database (public.rcl_super_admin – one row only), signs in on the same screen,
 * and has his own session ("SA_…", not a user's "S_…"): a Super Admin session opens no page of any site.
 *
 * Nothing here can be asked for by the page directly: these functions are reached only through the server itself
 * (runtime.js / system.js – the page's /api/rpc never names them), except "createSuperAdmin" (an Admin action, API_). */

const SA_PATH_ = '/rest/v1/rcl_super_admin';
function saRow_(email) { const r = sbFetch_('GET', SA_PATH_ + '?select=*&email=eq.' + encodeURIComponent(str_(email).toLowerCase())); return (r && r[0]) || null; }
function saAnyRow_() { try { const r = sbFetch_('GET', SA_PATH_ + '?select=email,name&limit=1'); return (r && r[0]) || null; } catch (e) { if (/42P01|PGRST205|does not exist|Could not find the table/.test(String(e.message))) return { missing: true }; throw e; } }
// a code the Super Admin writes down once: 16 letters / digits in 4 groups (no 0 / O / 1 / I – easy to read back)
function saRecoveryCode_() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let hex = ''; while (hex.length < 64) hex += Utilities.getUuid().replace(/[^0-9a-f]/g, '');
  let s = ''; for (let i = 0; i < 16; i++) s += A[parseInt(hex.substr(i * 2, 2), 16) % A.length];
  return s.match(/.{4}/g).join('-');
}
const saCodeClean_ = c => str_(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
// counting wrong tries (the same limits as a user's sign-in: 5 wrong → 15 minutes; 60 sign-ins a minute in all). Every try is
// COUNTED BEFORE it is looked at (as login does) – many guesses sent at the same moment cannot slip past the limit.
function saTry_(key) {
  const cache = CacheService.getScriptCache(), exact = typeof __count === 'function' && __count('', 0) !== -1;
  const mk = 'LG_' + Math.floor(Date.now() / 60000);
  if (Number(cache.get(key) || 0) >= 5) throw new Error('Too many wrong attempts. Try again after 15 minutes.');      // locked: refused without being counted
  if (exact) {
    if (__count(mk, 120) > 60) throw new Error('Too many sign-in attempts. Please wait a minute and try again.');
    if (__count(key, 900) - 1 >= 5) throw new Error('Too many wrong attempts. Try again after 15 minutes.');
    return { wrong: () => {}, right: () => { cache.remove(key); __uncount(key); } };
  }
  return { wrong: () => { cache.put(key, String(Number(cache.get(key) || 0) + 1), 900); }, right: () => { cache.remove(key); } };
}
const SA_ACTOR_ = a => ({ email: a.email, name: 'Super Admin' + (a.name ? ' (' + a.name + ')' : '') });
function saNewSession_(a) {
  const token = 'sa' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().slice(0, 8);
  CacheService.getScriptCache().put('SA_' + token, sessionMake_(a.email, a.password_hash), SESSION_SECONDS);
  return token;
}

/* ---- the Super Admin is made by the Admin of the FIRST site, once (Users & Access → "Create Super Admin") ---- */
function saCreate_(x, me) {
  x = x || {};
  if (typeof __siteIsHome === 'function' && !__siteIsHome()) throw new Error('The Super Admin is made on the first site only.');
  const have = saAnyRow_();
  if (have && have.missing) throw new Error('This needs one database step first: run sql/supabase_step7_sites.sql once in Supabase → SQL Editor (the first site only).');
  if (have) throw new Error('There is already a Super Admin. There can be only one.');
  const email = str_(x.email).toLowerCase().trim(), name = clean_(x.name).slice(0, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) throw new Error('Enter a proper email for the Super Admin.');
  if (readUsersSheet_().some(u => u.email === email)) throw new Error('This email is already a user of this site – give the Super Admin an email of its own.');
  { let on = []; try { on = sbFetch_('GET', '/rest/v1/rcl_user_sites?select=site&email=eq.' + encodeURIComponent(email)) || []; } catch (e) { on = []; }
    if (on.length) throw new Error('This email is already a user of a site – give the Super Admin an email of its own.'); }
  const bad = pwPolicy_(x.password); if (bad) throw new Error(bad);
  if (String(x.password) !== String(x.password2 === undefined ? x.password : x.password2)) throw new Error('The two passwords are not the same.');
  const code = saRecoveryCode_();
  sbFetch_('POST', SA_PATH_, [{ email: email, name: name || 'Super Admin', password_hash: makeHash_(String(x.password)), recovery_hash: makeHash_(saCodeClean_(code)) }], { Prefer: 'return=minimal' });
  if (typeof __sitesForget === 'function') __sitesForget();
  writeLog_(me, 'Add', 'Super Admin', email, 'Super Admin created: ' + email, 'From now on users and access are given by the Super Admin');
  sbFlush_();
  return { ok: true, email: email, recovery: code };
}
function saLogin_(email, password) {
  const e = str_(email).toLowerCase().slice(0, 120), t = saTry_('SAF_' + e);
  const a = saRow_(e), good = !!a && checkPw_(password, a.password_hash);
  if (!good) { if (!a) pwDummy_(password); t.wrong();
    writeLog_({ email: e, name: 'Super Admin' }, 'Login failed', 'Super Admin', '', 'Wrong password', ''); sbFlush_();
    throw new Error('Wrong email or password.'); }
  t.right();
  writeLog_(SA_ACTOR_(a), 'Login', 'Super Admin', '', 'Super Admin signed in', ''); sbFlush_();
  return { superAdmin: true, token: saNewSession_(a), name: a.name || 'Super Admin', email: a.email };
}
// the Super Admin of a session (renewed like a user's session; ends with a changed password or after 30 days)
function saWho_(token) {
  const cache = CacheService.getScriptCache(), k = 'SA_' + str_(token), val = str_(token) ? cache.get(k) : null;
  if (!val) throw new Error('SESSION_EXPIRED');
  const sv = sessionRead_(val), a = saRow_(sv.email);
  if (!a || sv.stamp !== pwStamp_(a.password_hash) || sv.left <= 0) { cache.remove(k); throw new Error('SESSION_EXPIRED'); }
  cache.put(k, val, Math.max(1, Math.min(SESSION_SECONDS, Math.ceil(sv.left / 1000))));
  return { email: a.email, name: a.name || 'Super Admin' };
}
function saLogout_(token) { try { const a = saWho_(token); CacheService.getScriptCache().remove('SA_' + str_(token)); writeLog_(SA_ACTOR_(a), 'Logout', 'Super Admin', '', 'Super Admin signed out', ''); sbFlush_(); } catch (e) { /* already out */ } return true; }
function saChangePassword_(token, oldPw, newPw) {
  const who = saWho_(token), a = saRow_(who.email), t = saTry_('SACP_' + a.email);
  if (!checkPw_(oldPw, a.password_hash)) { t.wrong(); throw new Error('Current password is wrong.'); }
  t.right();
  const bad = pwPolicy_(newPw); if (bad) throw new Error(bad);
  if (String(newPw) === String(oldPw)) throw new Error('Choose a password different from the current one.');
  const stored = makeHash_(String(newPw));
  sbFetch_('PATCH', SA_PATH_ + '?email=eq.' + encodeURIComponent(a.email), { password_hash: stored }, { Prefer: 'return=minimal' });
  CacheService.getScriptCache().remove('SA_' + str_(token));
  writeLog_(SA_ACTOR_(a), 'Password changed', 'Super Admin', '', 'Super Admin changed the password (other sessions signed out)', ''); sbFlush_();
  return { token: saNewSession_(Object.assign({}, a, { password_hash: stored })) };
}
// password forgotten: the recovery code written down when the Super Admin was made → a new password and a NEW recovery code
function saRecover_(email, code, newPw) {
  const e = str_(email).toLowerCase().slice(0, 120), t = saTry_('SAR_' + e);
  const a = saRow_(e), good = !!a && !!a.recovery_hash && checkPw_(saCodeClean_(code), a.recovery_hash);
  if (!good) { if (!a) pwDummy_(code); t.wrong(); throw new Error('The email or the recovery code is wrong.'); }
  const bad = pwPolicy_(newPw); if (bad) throw new Error(bad);
  t.right();
  const fresh = saRecoveryCode_(), stored = makeHash_(String(newPw));
  sbFetch_('PATCH', SA_PATH_ + '?email=eq.' + encodeURIComponent(a.email), { password_hash: stored, recovery_hash: makeHash_(saCodeClean_(fresh)) }, { Prefer: 'return=minimal' });
  writeLog_(SA_ACTOR_(a), 'Password changed', 'Super Admin', '', 'Super Admin password set with the recovery code (a new recovery code was given)', ''); sbFlush_();
  return { ok: true, recovery: fresh };
}

/* ---- a user inside one site (called by the server for the Super Admin, for "open another site", for a password change) ---- */
// the person of a session of THIS site (refused like any action of a session that is over or still on a one-time password)
function sysWho_(token) {
  const u = sessionUser_(str_(token));
  if (!u || !isHashed_(u.password)) throw new Error('SESSION_EXPIRED');
  return { email: u.email, name: u.name, admin: !!u.admin };
}
// a session on THIS site for a person the server has already proved (signed in on another of his sites)
function sysSession_(email) {
  const e = str_(email).toLowerCase(), u = readUsersSheet_().find(x => x.email === e);
  if (!u || !u.active) throw new Error('You do not have access to this site. Ask the Super Admin.');
  if (!isHashed_(u.password)) throw new Error('Set your own password first – sign in again with the one-time password you were given.');
  const token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  CacheService.getScriptCache().put('S_' + token, sessionMake_(u.email, u.password), SESSION_SECONDS);
  writeLog_(u, 'Login', '', '', 'Opened this site from another site', '');
  sbFlush_();
  return { token: token, user: publicUser_(u) };
}
// what this site keeps about a person – for the server only (the kept password never goes to a page)
function sysUserRow_(email) {
  const e = str_(email).toLowerCase(), u = readUsersSheet_().find(x => x.email === e);
  return u ? { exists: true, active: !!u.active, admin: !!u.admin, name: u.name, pw: u.password } : { exists: false };
}
// the person's kept password, the same as on his other sites (after a change there, or a reset by the Super Admin)
function sysSetPw_(email, stored) {
  const e = str_(email).toLowerCase();
  if (!readUsersSheet_().some(x => x.email === e)) return { ok: false };
  if (!/^(tmp\$)?(scrypt|sha256)\$/.test(String(stored || ''))) throw new Error('Not a kept password.');
  storePw_(e, String(stored)); bump_(['users']); sbFlush_();
  return { ok: true };
}
/* ---- (update-91) a person who comes from the Portal with a ticket (server/portal.js has checked its signature) ----
 * The ticket is used ONCE (its number is kept 5 minutes – a ticket lives 60 s). The Portal is the one place a site is given,
 * so here: a person new on this site is written into Users (no page open until the site's Admin gives pages – as any new
 * user); a person switched off is switched on; Admin is set as the Portal says. Which pages he sees stays this site's own.
 * His kept password here is not used for this sign-in. A one-time password left here (the Portal already made him set his
 * own) is replaced by a random one nobody knows – otherwise this site would refuse every action of his. The app's own
 * sign-in (the reserve, ?local=1) then needs a new one-time password from the Admin.
 * A sign-in from the Portal lasts 12 hours at most (then the page asks the Portal again – silently while the Portal still
 * knows him): access taken away in the Portal ends here within the day. */
const SSO_SESSION_MS_ = 12 * 3600000;
// a ticket of the Portal is used once: its number is kept 5 minutes (a ticket lives 60 s) – a person's and the Super Admin's alike
function portalOnce_(jti) {
  const jk = 'SSO_' + str_(jti), cache = CacheService.getScriptCache();
  if (!/^[0-9a-f]{16,64}$/.test(str_(jti))) throw new Error('The Portal sign-in could not be accepted (no ticket number) – open the module again from the Portal.');
  const exact = typeof __count === 'function' && __count('', 0) !== -1;
  if (exact) { if (__count(jk, 300) > 1) throw new Error('The Portal sign-in could not be accepted (this ticket was already used) – open the module again from the Portal.'); }
  else { if (cache.get(jk)) throw new Error('The Portal sign-in could not be accepted (this ticket was already used) – open the module again from the Portal.'); cache.put(jk, '1', 300); }
}
const portalUnknownPw_ = () => makeHash_('Portal|' + Utilities.getUuid() + Utilities.getUuid());      // a password nobody knows (sign-in is through the Portal)
function sysSso_(x) {
  x = x || {};
  const email = str_(x.email).toLowerCase(), cache = CacheService.getScriptCache();
  portalOnce_(x.jti);
  const unknownPw = portalUnknownPw_;
  let u = readUsersSheet_().find(w => w.email === email), changes = [];
  if (!u) {
    saveUserAdmin_({ isNew: true, email: email, name: clean_(x.name) || email, active: true, admin: !!x.admin, perms: {}, newPassword: 'Tmp' + Utilities.getUuid().replace(/-/g, '').slice(0, 16) }, null);
    storePw_(email, unknownPw());
    changes.push('new user on this site (from the Portal' + (x.admin ? ', Admin' : '') + ') – the site\'s Admin gives the pages');
  } else {
    if (!u.active || u.admin !== !!x.admin) {
      saveUserAdmin_({ email: email, name: u.name, active: true, admin: !!x.admin }, null);
      if (!u.active) changes.push('switched on (the Portal gives this site)');
      if (u.admin !== !!x.admin) changes.push('Admin: ' + (u.admin ? 'Yes' : 'No') + ' → ' + (x.admin ? 'Yes' : 'No') + ' (as in the Portal)');
    }
    if (!isHashed_(u.password)) { storePw_(email, unknownPw()); changes.push('one-time password of this app replaced (the Portal password is used)'); }
  }
  if (changes.length) bump_(['users']);
  u = readUsersSheet_().find(w => w.email === email);
  if (!u || !u.active || !isHashed_(u.password)) throw new Error('The Portal sign-in could not be accepted (the user could not be set on this site) – try again.');
  const token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  cache.put('S_' + token, sessionMake_(u.email, u.password, SSO_SESSION_MS_, !!x.super), SESSION_SECONDS);
  if (x.super) crSuperSeen_(u.email);      // (update-109) the approvals' notifications go to him      // (14-10-2026) the Super Admin: his session says so
  writeLog_(u, 'Login', '', '', 'Signed in through the Portal' + (x.super ? ' (Super Admin)' : ''), changes.join('; '));
  sbFlush_();
  return { token: token, user: publicUser_(x.super ? Object.assign({}, u, { super: true }) : u) };
}
/* ---- (update-94) the Super Admin in the Portal ("Users & Access" there, asked 13-10-2026: the pages of every user are given
 * there, in one place). act "users": this site's users with their pages (no password ever leaves). act "pages": one person's
 * pages (Edit / View / No access) – Active and Admin stay as they are (the Portal sets those at his sign-in). A person the
 * Portal gave this site but who has never opened it is written into Users now, with these pages and a password nobody knows. */
function sysPortalAdmin_(c) {
  c = c || {};
  portalOnce_(c.jti);
  // (update-162) with each person his diesel sources (Diesel Issue / Diesel Transfer – none = every source) and the site's places
  const ds = dsrcAll_(), pub = u => Object.assign({ email: u.email, name: u.name, active: u.active, admin: u.admin, perms: u.perms }, ds[str_(u.email).toLowerCase()] ? { dsrc: ds[str_(u.email).toLowerCase()] } : {});
  if (c.act === 'users') { const d = usersAdmin_(); return { users: d.users.map(pub), pages: d.modules, places: placeNames_() }; }
  if (c.act === 'places') return placesInfo_();      // (update-117) Sites → Diesel places
  if (c.act === 'placesSave') return sysPlacesSave_(c.places, c.by);
  // (update-157) Sites → Backup: the site's (or the Portal's) numbered Google Sheets – see backup.vm.js
  if (c.act === 'bkGet') return bkSheetsInfo_(c);
  if (c.act === 'bkSet') return bkSheetSet_(c);
  if (c.act === 'bkNow') return bkNow_(c);
  // (update-158) Sites → Storage: the first site's storage with the Drive connection; "Connect Google Drive"; "Copy files now"
  if (c.act === 'stoHome') { const cl = JSON.parse(__drvClient()), q = drvQuota_();
    return { storage: storageOf_(), drive: { ready: !!cl.ok, error: cl.ok ? '' : cl.error, redirect: cl.redirect || '', quota: q } }; }
  if (c.act === 'drvStart') return drvStart_({ by: c.by });
  if (c.act === 'drvNow') return drvNow_();
  if (c.act !== 'pages') throw new Error('Unknown action.');
  const email = str_(c.email).toLowerCase(), perms = {};
  MODULES.forEach(m => { const v = (c.perms || {})[m]; if (v === 'Edit' || v === 'View' || v === 'None') perms[m] = v; });
  if (!Object.keys(perms).length) throw new Error('No page was given.');
  const who = { email: str_(c.by), name: 'Super Admin (Portal)' };
  let u = readUsersSheet_().find(w => w.email === email), res;
  if (!u) {
    res = saveUserAdmin_({ isNew: true, email: email, name: clean_(c.name) || email, active: true, admin: !!c.admin, perms: perms, newPassword: 'Tmp' + Utilities.getUuid().replace(/-/g, '').slice(0, 16) }, null);
    storePw_(email, portalUnknownPw_());
  } else res = saveUserAdmin_({ email: email, name: u.name, active: u.active, admin: u.admin, perms: perms }, null);
  // (update-162) his diesel sources, when the Portal sends them (a Portal before update-162 does not: they stay as they were)
  let dsTxt = '';
  // (the script lock only – NOT withLock_: that starts a fresh save and would drop the page change above, not yet written)
  if (c.sources && typeof c.sources === 'object') { const lk = LockService.getScriptLock(); lk.waitLock(30000); try { dsTxt = dsrcSet_(email, c.sources, c.by); } finally { try { lk.releaseLock(); } catch (e) { /* frees itself */ } } }
  const ch = [res.changes || '', dsTxt].filter(Boolean).join(' | ');
  writeLog_(who, res.added ? 'Add' : 'Edit', 'Users', email, (res.added ? 'User added by the Super Admin in the Portal: ' : 'Pages set by the Super Admin in the Portal: ') + email, ch);
  sbFlush_();
  u = readUsersSheet_().find(w => w.email === email) || {};
  const ds2 = dsrcAll_(), out = u.email ? Object.assign(pub(u), ds2[email] ? { dsrc: ds2[email] } : {}) : null;
  if (out && !ds2[email]) delete out.dsrc;
  return { ok: true, added: !!res.added, changes: ch, admin: !!u.admin, user: out };
}
/* ---- (update-117, asked 16-10-2026) the diesel places of a site, set by the Super Admin in the Portal: when he makes the site
 * (New site) and later under Sites → Diesel places (Code.gs "DIESEL PLACES OF THIS SITE"). The Activity Log keeps the places
 * before and after. ---- */
function sysPlacesSave_(list, by) {
  const fw = f => f && f !== 'Diesel' ? ' ' + f : '';      // (update-163) a Petrol / CNG place says so in the Activity Log
  const caps0 = tankSettings_().caps, before = placeNames_().map(n => n + ' ' + caps0[n] + ' Ltr' + fw(placeFuel_(n))).join(', ');
  let res = null;
  withLock_(() => { res = savePlaces_(list); });
  const after = res.places.map(p => p.name + ' ' + p.cap + ' Ltr' + fw(p.fuel)).join(', ');
  writeLog_({ email: str_(by), name: 'Super Admin (Portal)' }, 'Edit', 'Settings', 'Diesel places', 'Diesel places set by the Super Admin in the Portal: ' + after, before === after ? '' : 'Before: ' + before);
  sbFlush_();
  return Object.assign({ ok: true }, res);
}
// New site: the places of the form are set once – a site that already has its own places keeps them
function sysPlacesSetup_(x) {
  x = x || {};
  if (x.keep) return { ok: true, note: 'kept as the site has them: ' + placeNames_().join(', ') };      // a site brought back with its own database
  if (str_(PropertiesService.getScriptProperties().getProperty('DIESEL_PLACES'))) return { ok: true, note: 'already set: ' + placeNames_().join(', ') + ' (to change them: Sites → Diesel places)' };
  if (!Array.isArray(x.places) || !x.places.length) return { ok: false, note: 'Add the diesel places of this site (name and tank size), then press Check & set up again.' };
  try { const r = sysPlacesSave_(x.places, x.by); return { ok: true, note: r.places.map(p => p.name + ' (' + p.cap + ' Ltr)').join(', ') }; }
  catch (e) { return { ok: false, note: String((e && e.message) || e) }; }
}
/* ---- (update-95) "New site": run inside the NEW site's database while it is set up ---- */
// every SQL step of Mechanical for a new site, in one piece – the same files as Read Me, without the keep-awake timer (the first
// site has it) and without step 7 (the list of sites lives in the first site only)
function sysNewSiteSql_() {
  const steps = README_SQL_.filter(x => !/step6_keep_awake|step7_sites/.test(x.name));
  return { sql: '-- RCL Fleet ERP (Mechanical) – everything a NEW site\'s database needs, in one piece. Run once in the NEW site\'s Supabase\n' +
    '-- → SQL Editor → New query → paste → Run. It only makes tables and functions; it can be run again safely.\n\n' +
    steps.map(x => '-- ===== ' + x.name + ' =====\n' + x.sql).join('\n\n') + '\n', files: steps.map(x => x.name) };
}
// is every table, column and function of Mechanical there? (the Admin's own "Database" check – the same list)
function sysSiteHealth_() { return dbHealth_(); }
// the company settings of the new site (from the first site; its own site name)
function sysOrgSet_(o) { o = o || {}; const names = Array.isArray(o.billNames) && o.billNames.length ? o.billNames : [str_(o.customer) || 'Rachana Construction Limited'];
  return saveOrgSettings_({ customer: str_(o.customer) || names[0], site: str_(o.site), logo: str_(o.logo), billNames: names, intro: o.intro !== false, video: str_(o.video) }); }
function sysUsers_() { return usersAdmin_(); }
function sysAccessReport_() { return accessReport_(); }
/* the Super Admin adds or changes a person on THIS site. pw = the person's kept password from his other site (he keeps one
 * password everywhere); without it a new person needs a one-time password, as before. */
function sysSaveUser_(x, actor, pw) {
  x = Object.assign({}, x || {});
  const copy = !!x.isNew && !x.newPassword && !!pw && /^(tmp\$)?(scrypt|sha256)\$/.test(String(pw));
  if (copy) x.newPassword = 'Tmp' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);      // replaced at once by his own kept password
  const res = saveUserAdmin_(x, null);
  if (copy) storePw_(res.email, String(pw));
  const who = { email: str_((actor || {}).email), name: 'Super Admin' };
  writeLog_(who, res.added ? 'Add' : 'Edit', 'Users', res.email, (res.added ? 'User added by the Super Admin: ' : 'User changed by the Super Admin: ') + res.email, res.changes || '');
  sbFlush_();
  const now = readUsersSheet_().find(u => u.email === res.email) || {};
  return Object.assign({}, res, { active: !!now.active, admin: !!now.admin });
}
