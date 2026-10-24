// update-151 – a submitted bill keeps its Log Book as EVIDENCE, through the page and the real database (local rig, PORTAL=1, step 1zc
// applied to the rig databases). Test data only ("EV151" vendors, machinery, entries, bills), taken out at the end.
//   1. Build bills → Verify & Submit: the bill and its evidence are written together (bill_snapshots + bill_log_rows, hashes);
//      the print that opens after Submit says "Log Book as submitted … Evidence check ✔".
//   2. The database refuses any change or delete of the evidence (as the app's own role).
//   3. The Super Admin corrects a billed entry (Portal sign-in): the live Log Book changes – the saved bill's View / Print and its
//      "Log Book" print still show the entry AS BILLED, evidence check ✔.
//   4. A bill without evidence (legacy – made here by taking its evidence away on the rig): its Log Book is today's, the paper says
//      so, with how many entries changed after it was saved.
//   5. Changed after Verify (a new entry of the bill's machinery in its dates): "Not submitted … verify the bill again", no bill.
//   6. No script error.
//   NODE_PATH=<puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node ev151.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), fs = require('fs'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const sqlAs = q => { try { return execSync('timeout 60 su postgres -c "psql -d rcl -tA -q -v ON_ERROR_STOP=1"', { input: 'set role service_role; ' + q, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { return 'ERROR ' + String(e.stderr || e.message); } };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!';
const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) })).json();
(async () => {
  const evIds = () => sql("select coalesce(string_agg(id, ','), '') from bills where vendor_name like 'EV151 %'");
  const cleanup = () => {
    const ids = evIds().split(',').filter(Boolean).map(x => "'" + x + "'").join(',');
    if (ids) sql('alter table public.bill_log_rows disable trigger bill_log_rows_fixed; alter table public.bill_snapshots disable trigger bill_snapshots_fixed;' +
      'delete from public.bill_log_rows where bill_id in (' + ids + '); delete from public.bill_snapshots where id in (' + ids + ');' +
      'alter table public.bill_log_rows enable trigger bill_log_rows_fixed; alter table public.bill_snapshots enable trigger bill_snapshots_fixed;');      // (LOCAL RIG ONLY – the triggers are switched off just for this)
    sql("delete from bills where vendor_name like 'EV151 %'; delete from log_book where machinery like 'EV151-%'; delete from boq where vendor_name like 'EV151 %'; delete from master where id like 'EV151-%'; delete from vendors where vendor_name like 'EV151 %'; delete from web.cache where key like 'SB%' or key like 'VB_%';");
  };
  const files = path.join(process.cwd(), 'shots'); fs.mkdirSync(files, { recursive: true });
  const errs = []; let b = null;
  try {
    cleanup();
    const tk = (await post(U, { fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const A = async (fn, ...a) => { const r = await post(U, { fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const must = (n, r) => { if (!r || r.ERROR || r.ok === false) out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
    for (const [nm, pan] of [['EV151 Vendor A', 'ABCPV1151A'], ['EV151 Vendor B', 'ABCPV2151B'], ['EV151 Vendor C', 'ABCPV3151C']]) must('vendor ' + nm, await A('saveVendor', { name: nm, gstReg: 'No', pan: pan, bank: 'SBI', account: '1510151' + pan.slice(-2, -1), ifsc: 'SBIN0000151' }, 'add'));
    const mach = (no, owner) => ({ no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: owner, ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' });
    must('m1', await A('saveMaster', mach('EV151-1', 'EV151 Vendor A'), 'add')); must('m2', await A('saveMaster', mach('EV151-2', 'EV151 Vendor B'), 'add')); must('m3', await A('saveMaster', mach('EV151-3', 'EV151 Vendor C'), 'add'));
    for (const [v, no] of [['EV151 Vendor A', 'EV151-1'], ['EV151 Vendor B', 'EV151-2'], ['EV151 Vendor C', 'EV151-3']]) must('boq ' + v, await A('saveBoq', { vendor: v, from: '2026-09-01', tdsPct: 2, woNo: 'WO-' + no, lines: [{ no: no, basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add'));
    const dd = d => '2026-09-' + String(d).padStart(2, '0');
    for (const [no, k0] of [['EV151-1', 1000], ['EV151-2', 5000], ['EV151-3', 8000]]) { let k = k0; const rows = []; for (let d = 1; d <= 6; d++) rows.push({ date: dd(d), shift: 'Full Day', no: no, mode: 'KM', openingKm: d === 1 ? k : undefined, closingKm: (k += 40), work: 'Carting ' + no });
      must('log ' + no, await A('saveLogRows', { rows: rows })); }
    // the Super Admin through the Portal (the only one who changes an entry of a submitted bill)
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: (lr.headers.get('set-cookie') || '').split(';')[0] }, redirect: 'manual' });
    const ss = await post(SA, { fn: 'ssoLogin', args: [(go.headers.get('location') || '').split('#sso=')[1] || ''] }), sat = ss.result && ss.result.token;
    const S_ = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sat, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    ok('setup: 3 vendors, 3 machinery, 6 entries each; the Super Admin signed in through the Portal', sql("select count(*) from log_book where machinery like 'EV151-%'") === '18' && !!sat, { sa: ss.error || !!sat });
    const co = ((await A('billInit')).companies || ['Rachana Construction Limited'])[0];

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    const quiet = () => F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const c = document.getElementById('ai_close'); if (c && c.offsetParent !== null) c.click(); S.formDirty = false; });
    const yes = () => F.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; });
    const popupOf = async click => { const got = new Promise(res => b.once('targetcreated', t => res(t))); await click(); const t = await Promise.race([got, wait(20000).then(() => null)]); if (!t) return null;
      const w = await t.page(); for (let i = 0; i < 60; i++) { if (await w.evaluate(() => !!document.querySelector('.sheet')).catch(() => false)) break; await wait(300); } await wait(1500); return w; };
    const paperOf = w => w.evaluate(() => ({ note: (document.querySelector('.ev-note') || {}).textContent || '', noteKind: (document.querySelector('.ev-note') || {}).className || '',
      lb: [...document.querySelectorAll('section.lbsheet')].map(s => s.innerText.replace(/\s+/g, ' ')).join(' | ') }));
    const build = async (vendor, no) => {
      await quiet(); await F.evaluate(() => showTab('bill')); await wait(1500);
      await F.evaluate(async (v, co) => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = x.closest('label, tr, div').textContent.indexOf(v) > -1; x.dispatchEvent(new Event('change', { bubbles: true })); });
        document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-05'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, vendor, co);
      for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await F.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
      await wait(1200);
      await F.evaluate(n => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const x = tr.querySelector('.mb-no'); if (x && !x.value) { x.value = n; x.dispatchEvent(new Event('input', { bubbles: true })); } }); }, no); await wait(800);
    };
    const billOf = v => sql("select id from bills where vendor_name = '" + v + "' and status = 'Active'");

    // ---------- 1. Verify & Submit: the bill with its evidence ----------
    await build('EV151 Vendor A', '151');
    const sub = new Promise(res => b.once('targetcreated', t => res(t)));
    await F.evaluate(() => document.getElementById('mb_abstract').click());
    let vtitle = ''; for (let i = 0; i < 50; i++) { await wait(500); const t = await yes(); if (/^Verification/.test(t)) vtitle = t; if (billOf('EV151 Vendor A')) break; }
    const t0 = await Promise.race([sub, wait(20000).then(() => null)]); let after = null;
    if (t0) { const w = await t0.page(); for (let i = 0; i < 40; i++) { if (await w.evaluate(() => !!document.querySelector('.ev-note')).catch(() => false)) break; await wait(400); } after = await paperOf(w); await w.close(); }
    const id1 = billOf('EV151 Vendor A');
    const snap = sql("select bill_no || '|' || rows_count || '|' || length(snapshot_sha256) || '|' || kind from bill_snapshots where id = '" + id1 + "'");
    ok('1. Verify & Submit: the bill and its evidence are written together – 6 entries, a 64-letter SHA-256, kind "submission"', !!id1 && snap === '151|6|64|submission' && sql("select count(*) from bill_log_rows where bill_id = '" + id1 + "' and length(row_sha256) = 64") === '6', { id1, snap, vtitle });
    ok('   the print after Submit: "Log Book as submitted with RA Bill 151 … Evidence check ✔ (6 entries …)" above the Log Book', after && /^Log Book as submitted with RA Bill 151 .* Evidence check ✔ \(6 entries, SHA-256 [0-9a-f]{16}…\)\.$/.test(after.note.trim()) && /EV151-1/.test(after.lb), after && after.note);
    // ---------- 2. the database refuses a change or a delete of the evidence ----------
    const u2 = sqlAs("update public.bill_log_rows set data = '{}' where bill_id = '" + id1 + "';"), d2 = sqlAs("delete from public.bill_snapshots where id = '" + id1 + "';"), t2 = sqlAs('truncate public.bill_log_rows;');
    ok('2. as the app\'s own role: UPDATE refused by the trigger, DELETE and TRUNCATE refused (no right) – nothing changed', /RCL_EVIDENCE_FIXED/.test(u2) && /permission denied/.test(d2) && /permission denied/.test(t2) && sql("select count(*) from bill_log_rows where bill_id = '" + id1 + "'") === '6', { u2: u2.slice(0, 160), d2: d2.slice(0, 120), t2: t2.slice(0, 120) });
    // ---------- 3. the Super Admin corrects a billed entry: the bill keeps the entry as billed ----------
    const key5 = 'EV151-1|2026-09-06|Full Day';      // (the last entry: nothing after it follows its Close)
    const before5 = sql("select closing_km from log_book where id = '" + key5 + "'");
    const lr5 = await S_('getLogEntry', key5).catch(() => null);
    // (update-152) a billed entry: the Super Admin's change goes with his reason (asked first – SA_REASON)
    const upNo = await S_('updateLogRow', key5, Object.assign({}, { closingKm: Number(before5) + 7, work: 'Corrected by the Super Admin' }, lr5 && lr5.ver ? { ver: lr5.ver } : {}));
    const upR = await post(SA, { fn: 'api', args: [sat, 'updateLogRow', [key5, Object.assign({}, { closingKm: Number(before5) + 7, work: 'Corrected by the Super Admin' }, lr5 && lr5.ver ? { ver: lr5.ver } : {})], { reason: 'Close KM typed wrong' }] });
    const up = upR.error ? { ERROR: upR.error } : upR.result;
    ok('   (update-152) asked for his reason first ("SA_REASON: Super Admin – this save changes 1 locked Log Book entry …")', /^SA_REASON: Super Admin – this save changes 1 locked Log Book entry/.test(upNo.ERROR || ''), upNo);
    ok('3. the Super Admin corrects an entry of the submitted bill (06-09 Close ' + before5 + ' → ' + (Number(before5) + 7) + '): saved in the live Log Book', up && !up.ERROR && sql("select closing_km from log_book where id = '" + key5 + "'") === String(Number(before5) + 7), up);
    await quiet(); await F.evaluate(() => showTab('bills')); await wait(1200);
    await F.evaluate(() => { document.getElementById('sb_from').value = '2026-09-01'; document.getElementById('sb_to').value = '2026-09-30'; return sbLoad(); }); await wait(1500);
    let w = await popupOf(() => F.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => r.textContent.indexOf('EV151 Vendor A') > -1); tr.querySelector('[data-sbv]').click(); }));
    let pv = w ? await paperOf(w) : null;
    if (w) { await w.screenshot({ path: path.join(files, '151-saved-bill.png'), fullPage: true }); await w.close(); }
    ok('   RCL Drive → View / Print: the Log Book AS BILLED (Close ' + before5 + ', not the correction) with "Evidence check ✔"', pv && /Evidence check ✔/.test(pv.note) && pv.lb.indexOf(before5) > -1 && pv.lb.indexOf(String(Number(before5) + 7)) === -1 && pv.lb.indexOf('Corrected by the Super Admin') === -1, pv && { note: pv.note, lb: pv.lb.slice(0, 400) });
    w = await popupOf(() => F.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => r.textContent.indexOf('EV151 Vendor A') > -1); const x = tr.querySelector('[data-sbl]'); x.click(); setTimeout(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }, 700); }));
    pv = w ? await paperOf(w) : null; if (w) await w.close();
    ok('   its "Log Book" print: the same – as billed, the note on top, no rate question (the bill\'s own rate)', pv && /^Log Book as submitted with RA Bill 151/.test(pv.note.trim()) && pv.lb.indexOf(before5) > -1 && pv.lb.indexOf('Corrected by the Super Admin') === -1, pv && pv.note);
    const ev = await A('getBillEvidence', { id: id1 });
    ok('   getBillEvidence: kind submission, 6 entries, check ✔, the bill\'s own figures the same as saved', ev && ev.kind === 'submission' && ev.count === 6 && ev.check && ev.check.ok === true && ev.check.billSame === true && ev.rows.find(r => r.date === '2026-09-06').ckm === Number(before5), ev && { kind: ev.kind, count: ev.count, check: ev.check });
    // ---------- 4. a legacy bill (no evidence): today's Log Book, said so, with what changed after it ----------
    await build('EV151 Vendor B', '152');
    await F.evaluate(() => document.getElementById('mb_abstract').click());
    for (let i = 0; i < 50; i++) { await wait(500); await yes(); if (billOf('EV151 Vendor B')) break; }
    for (const pg of await b.pages()) { if (pg !== p) await pg.close().catch(() => {}); }
    const id2 = billOf('EV151 Vendor B');
    sql('alter table public.bill_log_rows disable trigger bill_log_rows_fixed; alter table public.bill_snapshots disable trigger bill_snapshots_fixed;' +
      "delete from public.bill_log_rows where bill_id = '" + id2 + "'; delete from public.bill_snapshots where id = '" + id2 + "';" +
      'alter table public.bill_log_rows enable trigger bill_log_rows_fixed; alter table public.bill_snapshots enable trigger bill_snapshots_fixed;');      // (LOCAL RIG ONLY: a bill as submitted before step 1zc)
    await wait(2500);      // (a change made later than the bill – the check gives a second of room for the bill's own save)
    sql("update log_book set work_done = 'changed after the bill' where id = 'EV151-2|2026-09-03|Full Day'");
    const times = sql("select (select entered_at from bills where id = '" + id2 + "') || ' / ' || (select updated_at from log_book where id = 'EV151-2|2026-09-03|Full Day')");
    await quiet(); await F.evaluate(() => showTab('bills')); await wait(1000); await F.evaluate(() => sbLoad()); await wait(1500);
    w = await popupOf(() => F.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => r.textContent.indexOf('EV151 Vendor B') > -1); tr.querySelector('[data-sbv]').click(); }));
    pv = w ? await paperOf(w) : null; if (w) await w.close();
    ok('4. a bill without evidence: "submitted before the Log Book was kept with bills … TODAY\'S Log Book … 1 entry changed, 0 added, 0 deleted"', pv && /legacy/.test(pv.noteKind) && /^This bill was submitted before the Log Book was kept with bills\. The Log Book below is TODAY'S Log Book \(\d\d-\d\d-\d{4} \d\d:\d\d\), not a record of the time of submission\. Since the bill was saved: 1 entry changed, 0 added, 0 deleted \(by the database's own times\)\.$/.test(pv.note.trim()), pv && { note: pv.note, times });
    // ---------- 5. changed after Verify: nothing is submitted ----------
    await build('EV151 Vendor C', '153');
    await F.evaluate(() => document.getElementById('mb_abstract').click());
    let asked = ''; for (let i = 0; i < 40; i++) { await wait(500); asked = await F.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? document.getElementById('cf_title').textContent : ''; }); if (/^Verification/.test(asked)) break; }
    const add = await A('updateLogRow', 'EV151-3|2026-09-04|Full Day', { closingKm: 8160, work: 'changed after Verify' });      // the same reading, another work text: only the evidence tells
    await F.evaluate(() => document.getElementById('cf_ok').click());
    let said = ''; for (let i = 0; i < 30; i++) { await wait(500); said = await F.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent : ''; }); if (said) break; }
    ok('5. an entry changed between Verify and Submit: "Not submitted – … changed after it was verified … verify the bill again", no bill, no evidence', /^Verification/.test(asked) && add && !add.ERROR && /^Not submitted :: .*EV151 Vendor C: the Log Book of this bill changed after it was verified/.test(said) && !billOf('EV151 Vendor C'), { asked, add, said: said.slice(0, 300) });
    await quiet();
    ok('6. no script error on the page', errs.length === 0, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + String(e.message).slice(0, 200)); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
