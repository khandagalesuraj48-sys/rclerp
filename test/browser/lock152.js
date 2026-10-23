// update-152 – an approved or billed Log Book entry is locked: only the Super Admin changes it, with his reason; a bill is deleted only
// by him and kept as Deleted, still locking. Real page + real database (local rig, PORTAL=1, steps 1zc and 1zd applied to the rig
// databases). Test data only ("LK152" vendor, machinery, entries, users, a bill), taken out at the end.
//   1. under a verification rule: the maker's entries are sent, the checker approves – saved and marked (approved_by / at / ref)
//   2. the maker's page: "✔ Approved" in the list; Edit → "This entry was approved" box → his change is refused and offered to the
//      Super Admin ("An approved entry – send it to the Super Admin?") → sent with his reason; nothing changed
//   3. the Super Admin's page (Portal): Edit the approved entry → Save → "Locked entry – give the reason" → saved; the database's own
//      history keeps before / after, who (super) and the reason (web_write3 → log_book_history)
//   4. the Super Admin approves the maker's request → saved, the request's reason in the history
//   5. the database guard: a change of an approved entry by the app's role without the Super Admin – written down (warn) and named in
//      Database health; with "enforce" refused
//   6. a bill: submitted by the Super Admin's page; Saved Bills → Delete only for him → kept, marked Deleted with the reason; its entries
//      stay locked for everybody else; the Admin cannot delete
//   7. no script error
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const sqlAs = q => { try { return execSync('timeout 60 su postgres -c "psql -d rcl -tA -q -v ON_ERROR_STOP=1"', { input: 'set role service_role; ' + q, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { return 'ERROR ' + String(e.stderr || e.message); } };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 800) : '')); };
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!';
const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) })).json();
(async () => {
  const cleanup = () => {
    const ids = sql("select coalesce(string_agg(quote_literal(id), ','), '') from bills where vendor_name = 'LK152 Vendor'");
    if (ids) sql('alter table public.bill_log_rows disable trigger bill_log_rows_fixed; alter table public.bill_snapshots disable trigger bill_snapshots_fixed;' +
      'delete from public.bill_log_rows where bill_id in (' + ids + '); delete from public.bill_snapshots where id in (' + ids + ');' +
      'alter table public.bill_log_rows enable trigger bill_log_rows_fixed; alter table public.bill_snapshots enable trigger bill_snapshots_fixed;');      // (LOCAL RIG ONLY)
    sql("alter table public.log_book_history disable trigger log_book_history_fixed; delete from public.log_book_history where entry_key like 'LK152-%'; alter table public.log_book_history enable trigger log_book_history_fixed;" +      // (LOCAL RIG ONLY)
      "delete from public.bill_machines where bill_id in (select id from bills where vendor_name = 'LK152 Vendor'); delete from bills where vendor_name = 'LK152 Vendor'; delete from log_book where machinery like 'LK152-%'; delete from boq where vendor_name = 'LK152 Vendor';" +
      "delete from master where id like 'LK152-%'; delete from vendors where vendor_name = 'LK152 Vendor'; delete from billed_changes where args like '%LK152-%' or machinery like '%LK152%'; delete from app_users where email in ('mk152@rcl.test', 'ck152@rcl.test');" +
      "update app_settings set value = 'warn' where id = 'ENTRY_GUARD'; delete from app_settings where id = 'FLOW_RULES' and value like '%ck152%'; delete from web.cache where key like 'SB%' or key like 'VB_%' or key in ('USERS_LIST');");
  };
  const errs = { u: [], s: [] }; let b = null;
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_log_book) select 'mk152', 'mk152@rcl.test', password_hash, 'Maker 152', 'Yes', 'No', 'Edit' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin, perm_log_book) select 'ck152', 'ck152@rcl.test', password_hash, 'Checker 152', 'Yes', 'No', 'View' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    await wait(1500);
    const signIn = async e => { const a = await post(U, { fn: 'login', args: [e, PW] }); return a.result && a.result.token; };
    const su = await signIn('sujit@rcl.test'), mk = await signIn('mk152@rcl.test'), ck = await signIn('ck152@rcl.test');
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const ticketNow = async () => { const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
    const ss = await post(SA, { fn: 'ssoLogin', args: [await ticketNow()] }), sat = ss.result && ss.result.token;
    const call = async (base, tk, fn, a, meta) => { const r = await post(base, { fn: 'api', args: meta ? [tk, fn, a, meta] : [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const A = (fn, ...a) => call(U, su, fn, a), M = (fn, ...a) => call(U, mk, fn, a), C = (fn, ...a) => call(U, ck, fn, a), S_ = (fn, ...a) => call(SA, sat, fn, a);
    ok('setup: Admin, maker, checker signed in at :3001; the Super Admin through the Portal at :3000', !!(su && mk && ck && sat), { su: !!su, mk: !!mk, ck: !!ck, sa: ss.error || !!sat });
    const must = (n, r) => { if (!r || r.ERROR || r.ok === false) out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
    must('vendor', await A('saveVendor', { name: 'LK152 Vendor', gstReg: 'No', pan: 'ABCPL1152K', bank: 'SBI', account: '15215215', ifsc: 'SBIN0000152' }, 'add'));
    must('master', await A('saveMaster', { no: 'LK152-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'LK152 Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add'));
    must('boq', await A('saveBoq', { vendor: 'LK152 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-LK152', lines: [{ no: 'LK152-1', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add'));
    const K = d => 'LK152-1|' + d + '|Full Day', db = d => sql("select coalesce(closing_km::text, '') || '|' || coalesce(approved_by, '') || '|' || coalesce(approval_ref, '') || '|' || (approved_at is not null) from log_book where id = '" + K(d) + "'");
    const row = (d, close, ex) => ({ rows: [Object.assign({ date: d, shift: 'Full Day', no: 'LK152-1', mode: 'KM', closingKm: close, work: 'Carting' }, ex || {})] });
    // ---------- 1. the verification rule: sent, approved – saved and marked ----------
    const fr = await S_('saveFlowRules', { tasks: { 'Log Book': { on: true, levels: [['ck152@rcl.test']] } } });
    const s1 = await M('saveLogRows', row('2026-09-01', 1040, { openingKm: 1000 })), s2 = await M('saveLogRows', row('2026-09-02', 1080));
    const vf1 = ((s1.ERROR || '').match(/VF-\d+/) || [''])[0], vf2 = ((s2.ERROR || '').match(/VF-\d+/) || [''])[0];
    const d1 = await C('decideChangeRequest', { id: vf1, approve: true }), d2 = await C('decideChangeRequest', { id: vf2, approve: true });
    ok('1. under the verification rule: sent (' + vf1 + ', ' + vf2 + '), the checker approves – saved AND marked approved (by, at, the request)', fr && fr.ok && d1 && d1.status === 'Approved' && d2 && d2.status === 'Approved' &&
      db('2026-09-01') === '1040|Checker 152|' + vf1 + '|true' && db('2026-09-02') === '1080|Checker 152|' + vf2 + '|true', { fr, d1: d1 && (d1.status || d1.ERROR), d2: d2 && (d2.status || d2.ERROR), r1: db('2026-09-01'), r2: db('2026-09-02') });
    must('rule off', await S_('saveFlowRules', { tasks: {} }));
    const s3 = await M('saveLogRows', row('2026-09-03', 1120));
    ok('   without the rule: the next entry is saved at once, not marked', s3 && s3.ok && db('2026-09-03') === '1120|||false', { s3, r3: db('2026-09-03') });

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const frameOf = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    const box = f => f.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ') : ''; });
    const okBox = f => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
    const waitBox = async (f, re, n) => { for (let i = 0; i < (n || 30); i++) { const t = await box(f); if (t && (!re || re.test(t))) return t; await wait(400); } return await box(f); };
    const toastOf = f => f.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });
    const logList = async f => { await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('log'); }); await wait(1500);
      await f.evaluate(() => { document.getElementById('lf_from').value = '2026-08-25'; document.getElementById('lf_to').value = '2026-09-30'; const n = document.getElementById('lf_no'); n.value = 'LK152-1'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(2500);
      return f.evaluate(() => [...document.querySelectorAll('#l_rows tr')].map(tr => (tr.children[0] ? tr.children[0].textContent.trim() : '') + (tr.querySelector('.tag.ap') ? ' [' + tr.querySelector('.tag.ap').textContent.trim() + ']' : '') + (tr.querySelector('.tag.lk') ? ' [' + tr.querySelector('.tag.lk').textContent.trim() + ']' : '')).filter(Boolean).sort()); };
    const editOf = (f, d) => f.evaluate(d => { const tr = [...document.querySelectorAll('#l_rows tr')].find(r => r.textContent.trim().indexOf(d) === 0); tr.querySelector('[data-ledit]').click(); }, d);
    const setClose = (f, v) => f.evaluate(v => { const c = document.getElementById('le_ckm'); c.value = v; c.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('le_save').click(); }, v);

    // ---------- 2. the maker's page ----------
    const pu = await b.newPage(); await pu.setViewport({ width: 1440, height: 900 }); pu.on('pageerror', e => errs.u.push(String(e.message).slice(0, 200)));
    await pu.goto(U + '/', { waitUntil: 'load' });
    let fu = await frameOf(pu, () => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await fu.type('#lg_email', 'mk152@rcl.test'); await fu.type('#lg_pass', PW); await fu.click('#lg_btn'); await wait(6000);
    fu = await frameOf(pu, () => typeof S === 'object' && !!S.user);
    const marks = await logList(fu);
    ok('2. the maker\'s Log Book list: 01-09 and 02-09 marked "✔ Approved", 03-09 not', JSON.stringify(marks) === JSON.stringify(['01-09-2026 [✔ Approved]', '02-09-2026 [✔ Approved]', '03-09-2026']), marks);
    await editOf(fu, '02-09-2026'); const apBox = await waitBox(fu, /approved/);
    ok('   Edit 02-09: "This entry was approved" – by whom, the request, the way out (send to the Super Admin)', /^This entry was approved :: Log Book entry of LK152-1 on 02-09-2026: it was approved on \d\d-\d\d-\d{4} by Checker 152 \(VF-\d+\) – an approved entry cannot be changed or deleted without the Super Admin\./.test(apBox) && /goes to the Super Admin for approval/.test(apBox), apBox);
    await okBox(fu); for (let i = 0; i < 20 && !(await fu.evaluate(() => !document.getElementById('le_back').hidden)); i++) await wait(300);
    await setClose(fu, '1085');
    let offer = ''; for (let i = 0; i < 40; i++) { offer = await box(fu); if (/send it to the Super Admin/.test(offer)) break; if (/^Update /.test(offer)) await okBox(fu); await wait(400); }      // (the page's own "Update …?" first)
    ok('   his change on Save: refused by the server and offered – "An approved entry – send it to the Super Admin?"', /^An approved entry – send it to the Super Admin\? :: Log Book entry of LK152-1 on 02-09-2026: it was approved/.test(offer) && !/difference is taken in the next bill/.test(offer), offer);
    await fu.evaluate(() => { document.getElementById('cr_reason').value = 'meter shows 1085'; document.getElementById('cf_ok').click(); }); await wait(2500);
    const cr = sql("select id || '|' || status || '|' || reason from billed_changes where kind = 'Request' and args like '%LK152-1|2026-09-02%'");
    ok('   sent with his reason (a request waits for the Super Admin); the entry is NOT changed', /^CR-\d+\|Pending\|meter shows 1085$/.test(cr) && db('2026-09-02').startsWith('1080|'), { cr, now: db('2026-09-02'), toast: await toastOf(fu) });
    await fu.evaluate(() => { try { leClose(); } catch (e) {} try { closeConfirm(false); } catch (e) {} });
    const dDel = await M('deleteLogRow', K('2026-09-01'));
    ok('   a delete of the approved entry (asked directly): refused, the same reason', /^Log Book entry of LK152-1 on 01-09-2026: it was approved/.test(dDel.ERROR || '') && db('2026-09-01').startsWith('1040|'), dDel);

    // ---------- 3. the Super Admin approves the maker's request ----------
    const crId = cr.split('|')[0], dec = await S_('decideChangeRequest', { id: crId, approve: true });
    const h2 = sql("select allowed || '|' || (ctx->>'reason') from log_book_history where entry_key = '" + K('2026-09-02') + "' order by seq desc limit 1");
    ok('3. the Super Admin approves the request: saved (1085), the request\'s reason in the history', dec && dec.ok && db('2026-09-02').startsWith('1085|Checker 152|VF-') && /^true\|Change request CR-\d+ of Maker 152 approved: meter shows 1085$/.test(h2), { dec: dec && (dec.status || dec.ERROR), now: db('2026-09-02'), h2 });
    // ---------- 4. the Super Admin's page ----------
    const ps = await b.newPage(); await ps.setViewport({ width: 1440, height: 900 }); ps.on('pageerror', e => errs.s.push(String(e.message).slice(0, 200)));
    await ps.goto(SA + '/#sso=' + await ticketNow(), { waitUntil: 'load' }); await wait(7000);
    const fs2 = await frameOf(ps, () => typeof S === 'object' && !!S.user && S.user.super === true);
    const marksS = await logList(fs2);
    await editOf(fs2, '02-09-2026'); for (let i = 0; i < 20 && !(await fs2.evaluate(() => !document.getElementById('le_back').hidden)); i++) await wait(300);
    const saToast = await toastOf(fs2);
    await setClose(fs2, '1083');
    let reasonBox = ''; for (let i = 0; i < 40; i++) { reasonBox = await box(fs2); if (/give the reason/.test(reasonBox)) break; if (/^Update /.test(reasonBox)) await okBox(fs2); await wait(400); }
    ok('4. the Super Admin: the list marks them too; Edit opens at once (a note, no box); Save asks "Locked entry – give the reason"', marksS.length === 3 && /was approved – your change asks for the reason/.test(saToast) &&
      /^Locked entry – give the reason :: Super Admin – this save changes 1 locked Log Book entry \(LK152-1 02-09-2026 – changed, approved\)\./.test(reasonBox), { marksS, saToast, reasonBox });
    await fs2.evaluate(() => { document.getElementById('sa_reason').value = 'Close KM typed wrong – meter photo 1083'; document.getElementById('cf_ok').click(); }); for (let i = 0; i < 20 && !db('2026-09-02').startsWith('1083|'); i++) await wait(400);
    const h = sql("select action || '|' || locked_by || '|' || allowed || '|' || (ctx->>'super') || '|' || (ctx->>'actor') || '|' || (ctx->>'reason') || '|' || (old_row->>'closing_km') || '>' || (new_row->>'closing_km') || '|' || array_to_string(changed, ',') from log_book_history where entry_key = '" + K('2026-09-02') + "' order by seq desc limit 1");
    ok('   saved with the reason: 02-09 Close 1083, still approved; the database\'s history: update, approval, allowed, super, his reason, 1085 > 1083', db('2026-09-02').startsWith('1083|Checker 152|VF-') &&
      /^update\|approval\|true\|true\|[^|]+\|Close KM typed wrong – meter photo 1083\|1085>1083\|closing_km$/.test(h), { now: db('2026-09-02'), h });
    // ---------- 5. the database's own guard ----------
    const w = sqlAs("update public.log_book set work_done = 'changed outside the app' where id = '" + K('2026-09-01') + "';");
    const hw = sql("select allowed || '|' || locked_by || '|' || coalesce(ctx::text, 'no context') from log_book_history where entry_key = '" + K('2026-09-01') + "' order by seq desc limit 1");
    const health = await A('dbHealth'), chk = ((health && health.checks) || []).find(c => /step 1zd/.test(c.name)) || {};
    ok('5. the database guard (warn): a change of an approved entry by the app\'s role without the Super Admin is written down (allowed false); Database health names it', !/ERROR/.test(w) && /^false\|approval\|no context$/.test(hw) && chk.ok === true && /guard: warn · changes of locked entries not by the Super Admin in 30 days: 1 \(LK152-1\|2026-09-01\|Full Day\)/.test(chk.note || ''), { w, hw, chk });
    sql("update app_settings set value = 'enforce' where id = 'ENTRY_GUARD'");
    const e5 = sqlAs("update public.log_book set work_done = 'again' where id = '" + K('2026-09-01') + "';");
    sql("update app_settings set value = 'warn' where id = 'ENTRY_GUARD'");
    ok('   …switched to "enforce": refused by the database (RCL_ENTRY_LOCKED), nothing changed', /RCL_ENTRY_LOCKED: the Log Book entry LK152-1\|2026-09-01\|Full Day is approved/.test(e5) && sql("select work_done from log_book where id = '" + K('2026-09-01') + "'") === 'changed outside the app', e5.slice(0, 200));
    // ---------- 6. a bill: submitted, deleted by the Super Admin – kept, still locking ----------
    const co = ((await A('billInit')).companies || ['Rachana Construction Limited'])[0];
    await fs2.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
    await fs2.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = x.closest('label, tr, div').textContent.indexOf('LK152 Vendor') > -1; x.dispatchEvent(new Event('change', { bubbles: true })); });
      document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-05'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co);
    for (let i = 0; i < 40; i++) { await wait(500); await okBox(fs2); if (await fs2.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
    await wait(1000); await fs2.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const x = tr.querySelector('.mb-no'); if (x && !x.value) { x.value = '152'; x.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(800);
    await fs2.evaluate(() => document.getElementById('mb_abstract').click());
    for (let i = 0; i < 50; i++) { await wait(500); await okBox(fs2); if (sql("select count(*) from bills where vendor_name = 'LK152 Vendor'") === '1') break; }
    for (const pg of await b.pages()) { if (pg !== pu && pg !== ps) await pg.close().catch(() => {}); }
    const billId = sql("select id from bills where vendor_name = 'LK152 Vendor'");
    const lockedNow = await M('updateLogRow', K('2026-09-03'), { closingKm: 1125, work: 'Carting' });
    ok('6. a bill of September submitted (the Super Admin\'s page); the entry of 03-09 (not approved) is now locked by it', !!billId && /^Log Book entry of LK152-1 on 03-09-2026: this machinery is in the submitted RA Bill 152 of LK152 Vendor/.test(lockedNow.ERROR || ''), { billId, lockedNow });
    const adminDel = await A('deleteBill', billId, 'wrong');
    await fs2.evaluate(async () => { try { closeConfirm(false); } catch (e) {} showTab('bills'); document.getElementById('sb_from').value = '2026-09-01'; document.getElementById('sb_to').value = '2026-09-30'; await sbLoad(); }); await wait(1500);
    const btns = await fs2.evaluate(() => [...document.querySelectorAll('#sb_rows tr')].filter(tr => /LK152 Vendor/.test(tr.textContent)).map(tr => !!tr.querySelector('[data-sbd]')));
    await fs2.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => /LK152 Vendor/.test(r.textContent)); tr.querySelector('[data-sbd]').click(); });
    const delBox = await waitBox(fs2, /Delete this bill/);
    await fs2.evaluate(() => { document.getElementById('sb_reason').value = 'built before the BOQ amendment'; document.getElementById('cf_ok').click(); });
    for (let i = 0; i < 20 && sql("select status from bills where id = '" + billId + "'") !== 'Deleted'; i++) await wait(400);
    await wait(1200);
    const shown = await fs2.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => /LK152 Vendor/.test(r.textContent)); return tr ? tr.textContent.replace(/\s+/g, ' ') : ''; });
    ok('   the Admin cannot delete it; the Super Admin\'s Saved Bills has Delete → "it is not removed: kept, marked Deleted, with your reason"', /^Only the Super Admin deletes a submitted bill/.test(adminDel.ERROR || '') && btns.length === 1 && btns[0] === true && /It is not removed: it is kept, marked Deleted/.test(delBox), { adminDel, btns, delBox: delBox.slice(0, 300) });
    const kept = sql("select status || '|' || deleted_by || '|' || delete_reason || '|' || (deleted_at is not null) from bills where id = '" + billId + "'");
    const still = await M('updateLogRow', K('2026-09-03'), { closingKm: 1125, work: 'Carting' });
    ok('   kept, marked Deleted (who, why, when); the list says "Deleted" with the reason, no Delete any more; its entries STAY locked', /^Deleted\|[^|]+\|built before the BOQ amendment\|true$/.test(kept) && /Deleted/.test(shown) && /built before the BOQ amendment/.test(shown) &&
      /this machinery is in the submitted RA Bill 152 \(deleted\) of LK152 Vendor/.test(still.ERROR || '') && db('2026-09-03').startsWith('1120|'), { kept, shown: shown.slice(0, 300), still: still.ERROR || still });
    ok('7. no script error (the maker\'s page, the Super Admin\'s page)', errs.u.length === 0 && errs.s.length === 0, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 800)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + String(e.message).slice(0, 200)); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
