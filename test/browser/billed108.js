// update-108 (an entry of a submitted bill: the Super Admin changes it, a user's change waits for his approval; the next bill takes
// the difference with a Credit / Debit Note) – in the browser and through the server, on the local rig started with PORTAL=1
// (Mechanical :3000 linked to the Portal :3010, :3001 the app's own sign-in; step 1z run in the rig's databases). Test data only.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium, xlsx> NODE_OPTIONS="--require <path>/geo-shim.js" node billed108.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SHOTS = '/home/claude/test/shots/', U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010';
const V = 'Corr Vendor Q';
const clean = () => sql("delete from debit_notes where vendor_name = '" + V + "'; delete from billed_changes where machinery like 'CRX-%' or summary like '%CRX-%' or id like 'BL|%|CRX%'; delete from bills where vendor_name = '" + V + "'; delete from log_book where machinery like 'CRX-%'; delete from diesel_issue where machinery like 'CRX-%'; delete from boq where vendor_name = '" + V + "'; delete from master where id like 'CRX-%'; delete from vendors where vendor_name = '" + V + "';");
const logOf = (dk) => sql("select coalesce(opening_km::float::text, '') || '>' || coalesce(closing_km::float::text, '') from log_book where machinery = 'CRX-1' and date = '" + dk + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async (base, body) => { for (let i = 0; ; i++) { try { return await (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
  const tk = (await post(U, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post(U, { fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = [], E = (n, r) => { if (!r || r.ERROR || r.ok === false) seedErr.push(n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
  E('vendor', await api('saveVendor', { name: V, gstReg: 'No', pan: 'ABCPQ1234Q', bank: 'SBI', account: '12345674', ifsc: 'SBIN0000001' }, 'add'));
  E('machine', await api('saveMaster', { no: 'CRX-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: V, ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add'));
  E('boq', await api('saveBoq', { vendor: V, from: '2026-08-01', tdsPct: 2, woNo: 'WO-CQ', lines: [{ no: 'CRX-1', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add'));
  E('log', await api('saveLogRows', { rows: [{ date: '2026-08-31', shift: 'Full Day', no: 'CRX-1', mode: 'KM', openingKm: 960, closingKm: 1000 }, { date: '2026-09-01', shift: 'Full Day', no: 'CRX-1', mode: 'KM', closingKm: 1040 },
    { date: '2026-09-02', shift: 'Full Day', no: 'CRX-1', mode: 'KM', closingKm: 1080 }, { date: '2026-09-03', shift: 'Full Day', no: 'CRX-1', mode: 'KM', closingKm: 1120 }, { date: '2026-10-01', shift: 'Full Day', no: 'CRX-1', mode: 'KM', closingKm: 1190 }] }));
  E('diesel 1', await api('saveDieselIssue', { date: '2026-09-01', shift: 'Day', source: 'Dispenser', no: 'CRX-1', qty: 40, kmReading: 1000, force: true }));
  E('diesel 3', await api('saveDieselIssue', { date: '2026-09-03', shift: 'Day', source: 'Dispenser', no: 'CRX-1', qty: 10, kmReading: 1120, force: true }));
  ok('seed: ' + V + ', CRX-1 Per KM ₹50; September 120 km, diesel 40 + 10 L; 1 October 70 km', !seedErr.length, seedErr.join(' // '));
  const co = ((await api('billInit')).settings || {}).companies ? Object.keys((await api('billInit')).settings.companies)[0] : 'Rachana Construction Limited';

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const mine = new Set();
  b.on('targetcreated', async t => { try { if (t.type() === 'page') { await wait(1500); if (mine.has(t)) return; const w = await t.page(); if (w) await w.close(); } } catch (e) {} });      // (print windows are closed)
  const errs = [];
  try {
    const page = async () => { const p = await b.newPage(); mine.add(p.target()); await p.setViewport({ width: 1536, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200))); return p; };
    const frameOf = async p => { for (let i = 0; i < 60; i++) { await wait(500); const fr = p.frames().find(x => x !== p.mainFrame()); try { if (fr && await fr.evaluate(() => typeof showTab === 'function' && !!document.getElementById('lg_email'))) return fr; } catch (e) {} } throw new Error('the page did not load'); };
    const box = f => f.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ') : ''; });
    const okBox = f => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
    const toastOf = f => f.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });

    // ---------- 1. the September bill (RA 71) is built and submitted by the user (the app's own sign-in, :3001) ----------
    const pu = await page(); await pu.goto(U + '/', { waitUntil: 'load' }); let fu = await frameOf(pu); await wait(1500); fu = await frameOf(pu);
    await fu.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
    await fu.type('#lg_email', 'sujit@rcl.test'); await fu.type('#lg_pass', 'Nashik#Road848!'); await fu.click('#lg_btn'); await wait(6000);
    const buildBills = async (from, to, no, tick) => {
      await fu.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1200);
      await fu.evaluate(async (from, to, co, V) => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = x.closest('label, tr, div').textContent.indexOf(V) > -1; x.dispatchEvent(new Event('change', { bubbles: true })); });
        document.getElementById('mb_from').value = from; document.getElementById('mb_to').value = to; document.getElementById('mb_date').value = to; document.getElementById('mb_co').value = co; S.mb.bills = []; document.getElementById('mb_build').click(); }, from, to, co, V);
      for (let i = 0; i < 40; i++) { await wait(500); await okBox(fu); if (await fu.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
      await fu.evaluate(no => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const x = tr.querySelector('.mb-no'); if (x && !x.value) { x.value = no; x.dispatchEvent(new Event('input', { bubbles: true })); } }); }, no); await wait(900);
      if (tick) { await fu.evaluate(() => document.querySelectorAll('#mb_rows .mb-corck').forEach(x => { x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); })); await wait(300); }
    };
    const submit = async () => { await fu.evaluate(() => document.getElementById('mb_abstract').click()); let seen = '';
      for (let i = 0; i < 60; i++) { await wait(500); const t = await box(fu); if (t) { seen += t.slice(0, 1500) + ' || '; if (/^Cannot submit/.test(t)) { await okBox(fu); return seen; } await okBox(fu); } if (/submitted\./.test(await toastOf(fu))) return seen + ' SUBMITTED'; } return seen + ' TOAST: ' + await toastOf(fu); };
    await buildBills('2026-09-01', '2026-09-30', '71', false);
    let r = await submit();
    const bill71 = sql("select id || '|' || bill_no || '|' || status from bills where vendor_name = '" + V + "' and period_from = '2026-09-01'");
    const m71 = JSON.parse(sql("select data from bills where vendor_name = '" + V + "' and bill_no = '71'") || '{}').machines || [{}];
    const rate = Number(m71[0].dieselRate);
    ok('1. RA Bill 71 (September) submitted: 120 km × ₹50 = ₹6,000; diesel debited ' + m71[0].excessQty + ' L at ₹' + rate, /\|71\|Active$/.test(bill71) && Number(m71[0].amount) === 6000 && Number(m71[0].excessQty) === 10 && rate > 0, { bill71, r: r.slice(-300), m: m71[0] });
    const id71 = bill71.split('|')[0];

    // ---------- 2. the user changes 03-09 (in the bill): the page warns, the save is refused, he sends it to the Super Admin ----------
    await fu.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('log'); }); await wait(1500);
    await fu.evaluate(() => { document.getElementById('lf_from').value = '2026-08-25'; document.getElementById('lf_to').value = '2026-10-05'; const n = document.getElementById('lf_no'); n.value = 'CRX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(3000);
    await fu.evaluate(() => { const tr = [...document.querySelectorAll('#l_rows tr')].find(x => /^03-09-2026/.test(x.textContent.trim())); tr.querySelector('[data-ledit]').click(); }); await wait(2500);
    const warn = await box(fu);
    ok('2. Edit on 03-09 (in RA Bill 71): a box says it is in the submitted bill and offers "send for approval"', /This entry is in a submitted bill/.test(warn) && /RA Bill 71/.test(warn) && /Super Admin/.test(warn), warn);
    await okBox(fu); await wait(800);
    const editOpen = await fu.evaluate(() => !document.getElementById('le_back').hidden);
    await fu.evaluate(() => { const x = document.getElementById('le_ckm'); x.value = '1150'; x.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('le_save').click(); }); await wait(1500);
    let asked = ''; for (let i = 0; i < 20; i++) { const t = await box(fu); if (t && /send it to the Super Admin\?/.test(t)) { asked = t; break; } if (t) await okBox(fu); await wait(500); }
    await fu.evaluate(() => { document.getElementById('cr_reason').value = 'Close KM typed wrong – meter photo shows 1150'; document.getElementById('cf_ok').click(); }); await wait(2500);
    const sent = await toastOf(fu);
    const req = sql("select id || '|' || status || '|' || action || '|' || requested_by || '|' || reason from billed_changes where kind = 'Request' and summary like '%CRX-1%' order by id desc limit 1");
    ok('   the edit window opens; Save is refused by the server and the page asks to send it, with a reason → "Sent"; nothing saved', editOpen && /In a submitted bill – send it to the Super Admin\?/.test(asked) && /CR-\d+\|Pending\|updateLogRow\|/.test(req) && /meter photo/.test(req) && logOf('2026-09-03') === '1080>1120' && /Sent to the Super Admin/.test(sent), { editOpen, asked: asked.slice(0, 200), req, log: logOf('2026-09-03'), sent });
    await pu.screenshot({ path: SHOTS + 'b108_sent.png' });
    const reqId = req.split('|')[0];
    // (update-109) the user sees what he sent: Approvals (1), his request Waiting – no Approve / Reject for him
    await fu.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('approvals'); }); await wait(2500);
    const mineW = await fu.evaluate(() => ({ tab: !document.getElementById('tab-approvals').hidden, label: document.getElementById('tab-approvals').textContent.trim(), rows: [...document.querySelectorAll('#cr_rows tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()), buttons: document.querySelectorAll('#cr_rows [data-crok]').length, intro: document.getElementById('cr_intro').textContent }));
    ok('   (update-109) the user\'s Approvals: his request Waiting, no Approve button; the page says what Waiting / Approved / Rejected mean', mineW.tab && /Approvals \(1\)/.test(mineW.label) && mineW.rows.length === 1 && /Waiting/.test(mineW.rows[0]) && /CRX-1 · 03-09-2026/.test(mineW.rows[0]) && mineW.buttons === 0 && /You get a notification/.test(mineW.intro), mineW);
    const notSuper = await api('decideChangeRequest', { id: reqId, approve: true });
    ok('   a user (an Admin, not the Super Admin) cannot approve it', /Only the Super Admin approves/.test(notSuper.ERROR || ''), notSuper);

    // ---------- 3. the Super Admin opens Mechanical through the Portal and approves ----------
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }      // (the rig's Portal test leaves the second one)
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' });
    const loc = go.headers.get('location') || '', ticket = loc.split('#sso=')[1] || '';
    const claims = ticket ? JSON.parse(Buffer.from(ticket.split('.')[1], 'base64url').toString()) : {};
    ok('3. the Portal\'s ticket for the Super Admin says super: true', claims.super === true && claims.role === 'admin', claims);
    const ps = await page(); await ps.goto(SA + '/#sso=' + ticket, { waitUntil: 'load' }); await wait(7000);
    const fs2 = ps.frames().find(x => x !== ps.mainFrame());
    const saState = await fs2.evaluate(() => ({ user: S.user && { super: S.user.super, admin: S.user.admin, email: S.user.email }, tab: !document.getElementById('tab-approvals').hidden, label: document.getElementById('tab-approvals').textContent.trim() }));
    ok('   signed in as the Super Admin: "Approvals (1)" in the menu', saState.user && saState.user.super === true && saState.tab && /Approvals \(1\)/.test(saState.label), saState);
    await fs2.evaluate(() => showTab('approvals')); await wait(2500);
    const list = await fs2.evaluate(() => [...document.querySelectorAll('#cr_rows tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()));
    ok('   Approvals: the request – who, what (CRX-1 · 03-09-2026 · Close KM 1150, saved now 1120), why', list.length === 1 && /Sujit/.test(list[0]) && /CRX-1 · 03-09-2026/.test(list[0]) && /Close KM 1150/.test(list[0]) && /Close KM 1120/.test(list[0]) && /meter photo/.test(list[0]), list);
    await ps.keyboard.press('Escape'); await fs2.evaluate(() => document.querySelectorAll('.modal-back, .brief-back, #brief_back').forEach(x => { x.hidden = true; })); await wait(300);
    { const el = await fs2.$('#sec-approvals .panel'); if (el) await el.screenshot({ path: SHOTS + 'b108_approvals.png' }); }
    await fs2.evaluate(() => document.querySelector('#cr_rows [data-crok]').click()); await wait(800);
    const ask = await box(fs2); await okBox(fs2); await wait(4000);
    const after = await fs2.evaluate(() => [...document.querySelectorAll('#cr_rows tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()));
    const base = sql("select bill_id || '|' || data from billed_changes where kind = 'Baseline' and id = 'BL|" + id71 + "|CRX1'");
    ok('   Approve: saved as the user\'s change (03-09 now 1080>1150); the request Approved; the bill\'s "before" kept (120 km, 10 L)', /Approve this change\?/.test(ask) && logOf('2026-09-03') === '1080>1150' && sql("select status || '|' || decided_by from billed_changes where id = '" + reqId + "'") === 'Approved|Super Admin' || sql("select status from billed_changes where id = '" + reqId + "'") === 'Approved',
      { ask: ask.slice(0, 160), log: logOf('2026-09-03'), st: sql("select status || '|' || decided_by from billed_changes where id = '" + reqId + "'"), after });
    ok('   …the "before" of RA Bill 71: KM 120 (₹6,000), diesel debited 10 L', base.startsWith(id71 + '|') && JSON.parse(base.split('|').slice(1).join('|')).units.KM.qty === 120 && JSON.parse(base.split('|').slice(1).join('|')).dieselL === 10, base);
    ok('   …the entry after it (01-10) starts from the new Close (1150 > 1190)', logOf('2026-10-01') === '1150>1190', logOf('2026-10-01'));
    await fu.evaluate(() => crLoad()); await wait(2000);
    const mineA = await fu.evaluate(() => [...document.querySelectorAll('#cr_rows tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()));
    ok('   (update-109) …and the user\'s list now says Approved, by whom', mineA.length === 1 && /Approved/.test(mineA[0]) && !/Waiting/.test(mineA[0]), mineA);

    // ---------- 4. the Super Admin changes a diesel issue of the bill himself ----------
    const satk = await fs2.evaluate(() => S.token);
    const sapi = async (fn, ...a) => { const r2 = await post(SA, { fn: 'api', args: [satk, fn, a] }); return r2.error ? { ERROR: r2.error } : r2.result; };
    const d1 = sql("select id from diesel_issue where machinery = 'CRX-1' and issue_date = '2026-09-01'");
    const userTry = await api('updateDieselIssue', d1, { date: '2026-09-01', shift: 'Day', source: 'Dispenser', no: 'CRX-1', qty: 50, kmReading: 1000, force: true });
    const saTry = await sapi('updateDieselIssue', d1, { date: '2026-09-01', shift: 'Day', source: 'Dispenser', no: 'CRX-1', qty: 50, kmReading: 1000, force: true });
    ok('4. a diesel issue of the bill: the user is refused (the way out names the Super Admin); the Super Admin saves it (40 → 50 L)', /is in the submitted RA Bill 71/.test(userTry.ERROR || '') && /send it to the Super Admin for approval/.test(userTry.ERROR || '') && !saTry.ERROR && sql("select qty::float from diesel_issue where id = '" + d1 + "'") === '50', { userTry, saTry });
    ok('   …the "before" stays the one of the first change (one per bill and machinery)', sql("select count(*) from billed_changes where kind = 'Baseline' and bill_id = '" + id71 + "'") === '1');

    // ---------- 5. the October bill shows the difference of RA Bill 71 and must take it ----------
    await buildBills('2026-10-01', '2026-10-10', '72', false);
    const corr = await fu.evaluate(() => { const b0 = S.mb.bills[0] || {}; return { corr: (b0.corr || []).map(z => ({ billNo: z.billNo, no: z.no, kind: z.kind, net: z.net, total: z.total, work: z.work, diesel: z.diesel })), J: b0.J, K: b0.K, I: b0.I, box: (document.querySelector('#mb_rows .mb-corr') || { textContent: '' }).textContent.replace(/\s+/g, ' ') }; });
    const z = corr.corr[0] || {}, dieselAmt = Math.round(10 * rate * 100) / 100, net = Math.round((1500 - dieselAmt) * 100) / 100, amt = Math.abs(net), tot = Math.round((amt - amt * 0.02) * 100) / 100;
    ok('5. October bill: the difference of RA Bill 71 – KM 120 → 150 × ₹50 = +₹1,500, diesel debited 10 → 20 L × ₹' + rate + ' = −₹' + dieselAmt + ' → ' + (net < 0 ? 'Debit' : 'Credit') + ' Note ₹' + tot + ' (TDS 2%)',
      corr.corr.length === 1 && z.billNo === '71' && z.no === 'CRX-1' && z.work[0].unit === 'KM' && z.work[0].from === 120 && z.work[0].to === 150 && z.work[0].amount === 1500 && z.diesel.from === 10 && z.diesel.to === 20 && z.diesel.amount === dieselAmt && z.kind === (net < 0 ? 'Debit' : 'Credit') && Math.abs(z.total - tot) < 0.01 && /Earlier bills changed/.test(corr.box),
      corr);
    ok('   …in the bill: J ' + (net < 0 ? '= the Debit Note' : '= − the Credit Note') + ', K = I − J', Math.abs(corr.J - (net < 0 ? tot : -tot)) < 0.01 && Math.abs(corr.K - (corr.I - corr.J)) < 0.01, corr);
    const abs = await fu.evaluate(() => { const pg = document.querySelector('#mb_pages .mb-paper'); return pg ? pg.textContent.replace(/\s+/g, ' ') : ''; });
    ok('   …the Abstract shows the calculation ("Corrections of earlier bills", KM 120 → 150, Diesel debited 10 L → 20 L) and the J line', /Corrections of earlier bills taken in this bill/.test(abs) && /KM 120 → 150 × ₹50\.00 = \+ ₹1,500\.00/.test(abs) && /Diesel debited 10 L → 20 L/.test(abs) && /Less – Debit Note\(s\) \/ Add – Credit Note\(s\)/.test(abs), abs.slice(abs.indexOf('Corrections') - 400, abs.indexOf('Corrections') + 500));
    await pu.screenshot({ path: SHOTS + 'b108_bill.png' });
    for (const [sel, name] of [['#mb_rows .mb-corr', 'b108_box'], ['#mb_pages .bl-corr', 'b108_corr']]) { await fu.evaluate(q => { const e = document.querySelector(q); if (e) e.scrollIntoView({ block: 'center' }); }, sel); await wait(700); await pu.screenshot({ path: SHOTS + name + '.png' }); }
    r = await submit();
    ok('   Verify without ticking it: cannot submit – "tick Checked … a difference that is not cleared stops the submit"', /Cannot submit/.test(r) && /tick "Checked" for its difference/.test(r) && sql("select count(*) from bills where vendor_name = '" + V + "' and bill_no = '72'") === '0', r.slice(0, 600));
    await fu.evaluate(() => document.querySelectorAll('#mb_rows .mb-corck').forEach(x => { x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); })); await wait(300);
    r = await submit();
    const b72 = sql("select id || '|' || status from bills where vendor_name = '" + V + "' and bill_no = '72'"), id72 = b72.split('|')[0];
    const d72 = JSON.parse(sql("select data from bills where id = '" + id72 + "'") || '{}');
    const note = sql("select dn_no || '|' || kind || '|' || total::float || '|' || status || '|' || bill_id || '|' || remark from debit_notes where vendor_name = '" + V + "'");
    ok('   ticked → submitted: the ' + (net < 0 ? 'Debit' : 'Credit') + ' Note is made and taken in RA Bill 72 (J / K), its number in the bill', /\|Active$/.test(b72) && (d72.corr || []).length === 1 && d72.corr[0].noteNo && Math.abs(d72.J - (net < 0 ? tot : -tot)) < 0.01 && Math.abs(d72.K - (d72.I - d72.J)) < 0.01 &&
      new RegExp('\\|Correction ' + (net < 0 ? 'DN' : 'CN') + '\\|' + tot + '\\|Deducted\\|' + id72 + '\\|Correction of RA Bill 71').test(note), { b72, corr: d72.corr, J: d72.J, K: d72.K, note, r: r.slice(0, 900) });
    const again = await api('billCorrections', { vendor: V, company: co, bills: [] });
    ok('   the next time: nothing left to take', (again.items || []).length === 0, again);
    const led = await api('vendorLedger', { vendor: V });
    ok('   vendor ledger: the note is a line of its own', (led.rows || []).some(l => (l.kind === 'dn' || l.kind === 'cn') && Math.abs((l.paid || l.bill) - tot) < 0.01), (led.rows || []).map(l => l.kind + ' ' + l.bill + '/' + l.paid));

    // ---------- 6. the bill that took it is deleted: its note is cancelled, the difference comes back ----------
    // (update-152) only the Super Admin deletes a submitted bill (kept, marked Deleted, with the reason) – the Admin is refused
    const delA = await api('deleteBill', id72, 'test – taken back');
    const del = await sapi('deleteBill', id72, 'test – taken back');
    const back = await api('billCorrections', { vendor: V, company: co, bills: [] });
    ok('   (update-152) the Admin cannot delete it: "Only the Super Admin deletes a submitted bill"', /^Only the Super Admin deletes a submitted bill/.test(delA.ERROR || ''), delA);
    ok('6. RA Bill 72 deleted (by the Super Admin): its note is Cancelled and the difference of RA Bill 71 shows again', del && del.ok && sql("select status from debit_notes where vendor_name = '" + V + "'") === 'Cancelled' && (back.items || []).length === 1 && Math.abs(back.items[0].total - tot) < 0.01, { del, back: (back.items || []).map(x => x.total) });
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 800)); }
  finally { await b.close(); try { clean(); } catch (e) {} }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
