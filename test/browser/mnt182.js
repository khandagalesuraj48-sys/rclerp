// update-182 (asked 28-10-2026: "Maintenance bills ha section remove kr … Import the old log book (Excel or PDF) he etk moth nko … Maintenance
// Log Book party name che khali chande delet nko natr particular che khali edit delet nko pratek entry che last la edit delet asa option de …
// admin or super admin gadich log book maintanace ch delet pn karu shakel as de … jith mi bil upload keto te hi perfect baanw") – on the local
// rig in claude mode (PORTAL=1, RCLSTEPS=1): site S1 (database rcl, step 1zi run). Test data only (made here – not his data).
//   1. the Maintenance page: no "Maintenance bills" list; the bill form compact (a slim head, the help folded); the old log book's import a
//      small button of the log book's card – its box opens under it and closes
//   2. the log book of a roller (3 bills): the Action column at the end – each entry Edit · Delete, the bill's files 📎 on its first row;
//      nothing under the Party Name / Particulars; not in the print / Excel; a line's Edit → "Change the whole bill" – the bill in the form
//   3. "Delete this log book": only for the Admin; asked with its bills and ₹, the number typed – a wrong number: nothing deleted; the right
//      one: its 3 bills deleted (the other machinery's bill stays), each in the Activity Log; the server refuses a number the page did not show
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt182.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'); const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1500) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const R = 'RL-182', O = 'RL-182B';
(async () => {
  const errs = []; let b = null, cookie = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const n0 = sql('rcl', 'select count(*) from maintenance');
  try {
    ok('start: S1 (rcl) has step 1zi and no bill', n0 === '0', n0);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01';
    for (const no of [R, O]) { const m = await J('saveMaster', { no: no, name: 'Roller ' + no, type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1 }, 'add'); ok('an Own roller ' + no, !m.ERROR, m); }
    const mk = async (no, date, garage, lines) => J('saveMaint', { date: date, no: no, garage: garage, billNo: 'B-' + Math.random().toString(36).slice(2, 6), km: '', service: false, remark: '', lines: lines });
    const L = (w, q, r) => ({ work: w, type: 'Paid', qty: q, uom: 'Nos', rate: r, amount: q * r, gst: 18 });
    const x1 = await mk(R, d1, 'Shri Motors', [L('OIL FILTER', 1, 500), L('AIR FILTER', 1, 900)]), x2 = await mk(R, today, 'Ganesh Motors', [L('GREASE', 2, 180)]), x3 = await mk(R, today, 'Shri Motors', [L('BULB', 4, 40)]), xo = await mk(O, today, 'Shri Motors', [L('WIPER', 1, 310)]);
    ok('4 bills (3 of ' + R + ', 1 of ' + O + ')', [x1, x2, x3, xo].every(x => x && x.ok && x.id), [x1, x2, x3, xo]);
    sql('rcl', "update maintenance set files = '" + JSON.stringify([{ sha: 'a'.repeat(64), p: 'log/aa/' + 'a'.repeat(64) + '.pdf', mime: 'application/pdf', size: 10, name: 'bill.pdf', at: '', by: '' }]) + "' where id = '" + x1.id + "'");
    await wait(1200);
    // ---- 1. the page ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(4500);
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); };
    const toastNow = () => F.evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
    await F.evaluate(() => showTab('mnt')); await wait(2500); await tidy();
    const pg = await F.evaluate(() => ({ list: [...document.querySelectorAll('#sec-mnt h2')].filter(h => h.id !== 'rpmlog_title').map(h => h.textContent), rows: !!document.getElementById('mt_rows'), imp: !$('ml_imp').hidden, box: !$('mti_panel').hidden,
      icon: getComputedStyle(document.querySelector('#sec-mnt .mt-hicon')).width, how: !!document.querySelector('#sec-mnt details.mt-howd'), hint: document.querySelector('#sec-mnt .mt-htext .chart-note').textContent, del: !$('ml_delall').hidden }));
    ok('1. the Maintenance page: no "Maintenance bills" list (the bill form, the Maintenance Log Book); the bill\'s head slim (its sign 38 px, one short line), its help folded',
      JSON.stringify(pg.list) === JSON.stringify(['Maintenance bill', 'Maintenance Log Book']) && !pg.rows && pg.icon === '38px' && pg.how && pg.hint === 'Add the bill (PDF / photo) – the AI reads it; check each line, then Save.', pg);
    ok('   the old log book\'s import: a small button of the log book ("Import old log book (Excel / PDF)") – its box closed', pg.imp && !pg.box && !pg.del, pg);
    await F.evaluate(() => $('mt_title').scrollIntoView({ block: 'start' })); await wait(400);
    await mp.screenshot({ path: path.join(SHOT, 'mnt182_form.png') });
    await F.evaluate(() => $('ml_imp').click()); await wait(500);
    const ib = await F.evaluate(() => ({ open: !$('mti_panel').hidden, inLog: !!$('mti_panel').closest('.mlb-panel'), how: document.querySelector('#mti_panel details.mti-how').open, pick: !!$('mti_pick') && !!$('mti_fmt') }));
    await mp.screenshot({ path: path.join(SHOT, 'mnt182_import.png') });
    await F.evaluate(() => $('mti_x').click()); await wait(300);
    ok('   its button opens the import\'s box in the log book\'s card (Choose the file, Download the format; "How the file is read" folded); ✕ closes it', ib.open && ib.inLog && !ib.how && ib.pick && await F.evaluate(() => $('mti_panel').hidden), ib);
    // ---- 2. the log book ----
    await F.evaluate(r => { $('ml_no').value = r; $('ml_all').checked = true; $('ml_all').dispatchEvent(new Event('change')); $('ml_go').click(); }, R);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden && S.rp && S.rp.mlog && S.rp.mlog.d.all)); i++) await wait(400);
    await wait(600); await tidy();
    const lk = await F.evaluate(() => { const tb = document.querySelector('#rpmlog_body table[data-sheet="Log Book"]');
      return { th: [...tb.querySelectorAll('thead th')].pop().textContent, rows: [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td.mc')].pop().textContent + ' [' + [...tr.lastElementChild.querySelectorAll('button')].map(x => x.textContent).join('/') + ']'),
        under: document.querySelectorAll('#rpmlog_body td.mc button').length, foot: [...tb.querySelectorAll('tfoot tr')].every(tr => tr.lastElementChild.classList.contains('no-print')), html: /Action|mlog-actd/.test(S.rp.mlog.v.html), del: !$('ml_delall').hidden,
        wide: $('rpmlog_body').scrollWidth > $('rpmlog_body').clientWidth, seen: (() => { const w = $('rpmlog_body').getBoundingClientRect(); return [...tb.querySelectorAll('td.mlog-actd, th.mlog-acth')].every(c => { const r = c.getBoundingClientRect(); return r.left >= w.left - 1 && r.right <= w.right + 1; }); })(),
        red: getComputedStyle($('ml_delall')).color }; });
    ok('2. the log book of ' + R + ': the Action column at the end – each entry Edit · Delete, the bill\'s files 📎 1 on its first row; nothing under the Party Name or the Particulars; not in the print / Excel',
      lk.th === 'Action' && JSON.stringify(lk.rows) === JSON.stringify(['OIL FILTER [Edit/Delete/📎 1]', 'AIR FILTER [Edit/Delete]', 'GREASE [Edit/Delete]', 'BULB [Edit/Delete]']) && lk.under === 0 && lk.foot && lk.html === false, lk);
    ok('   the log book wider than the page: the Action column stays in view at the rows\' end (sticky) – the table scrolls under it', lk.wide && lk.seen, lk);
    ok('   the Admin: "Delete this log book" shown – red (the page\'s Delete style)', lk.del && /^rgb\((1[5-9]\d|2\d\d), (\d|[1-7]\d), (\d|[1-7]\d)\)$/.test(lk.red), [lk.del, lk.red]);
    await F.evaluate(() => $('rpmlog_out').scrollIntoView({ block: 'start' })); await wait(400);
    await mp.screenshot({ path: path.join(SHOT, 'mnt182_logbook.png') });
    // a line's Edit → the whole bill
    await F.evaluate(() => [...document.querySelectorAll('#rpmlog_body tr[data-mll]')].find(tr => /GREASE/.test(tr.textContent)).querySelector('[data-mlle]').click()); await wait(900);
    const eb = await F.evaluate(() => ({ title: $('cf_title').textContent, btn: $('mll_bill') ? $('mll_bill').textContent : '' }));
    await F.evaluate(() => $('mll_bill').click()); await wait(2500);
    const fm = await F.evaluate(() => ({ open: !$('cf_back').hidden, title: $('mt_title').textContent, no: $('mt_no').value, garage: $('mt_garage').value, save: $('mt_save').textContent }));
    ok('   a line\'s Edit: its box has "Change the whole bill (date, party, reading, files…)" – pressed: the box closes, the bill is in the form to be changed',
      eb.title === 'Change this line – ' + R && eb.btn === 'Change the whole bill (date, party, reading, files…)' && !fm.open && fm.title === 'Change bill ' + x2.id && fm.no === R && fm.garage === 'Ganesh Motors' && fm.save === 'Save changes', [eb, fm]);
    await F.evaluate(() => mtClear()); await wait(300);
    // ---- 3. Delete this log book ----
    const vo = await F.evaluate(async () => { const u = S.user, keep = u.admin; u.admin = false; try { await mlogShow(); return !$('ml_delall').hidden; } finally { u.admin = keep; await mlogShow(); } });
    ok('3. not the Admin: no "Delete this log book"', vo === false, vo);
    const st = await J('deleteMaintLog', { no: R, all: true, count: 2 });
    ok('   the server: another number of bills than the page showed – refused, nothing deleted', st.ERROR && /was changed meanwhile \(3 bill\(s\) now, 2 shown\)/.test(st.ERROR) && sql('rcl', "select count(*) from maintenance where machinery = '" + R + "'") === '3', st);
    await tidy();
    await F.evaluate(() => $('ml_delall').click()); await wait(800);
    const dq = await F.evaluate(() => ({ title: $('cf_title').textContent, ok: $('cf_ok').textContent, p: document.querySelector('#cf_msg p').textContent }));
    await mp.screenshot({ path: path.join(SHOT, 'mnt182_delete.png') });
    await F.evaluate(() => { $('mld_t').value = 'RL-181'; $('cf_ok').click(); }); await wait(1500);
    const t1 = await toastNow(), c1 = sql('rcl', "select count(*) from maintenance where machinery = '" + R + "'");
    ok('   asked: "Delete the log book of ' + R + '?" – its 3 bills, ₹, from its first bill; a wrong number typed: "Not deleted …" – nothing deleted',
      dq.title === 'Delete the log book of ' + R + '?' && dq.ok === 'Delete 3 bill(s)' && /All 3 maintenance bill\(s\) of RL-182 from its first bill to today – ₹2,265\.60 – are deleted\. What the RCL Store issued and the fuel stay\./.test(dq.p) && /Not deleted – type the machinery number as it is \(RL-182\)/.test(t1) && c1 === '3', [dq, t1, c1]);
    await tidy();
    await F.evaluate(() => $('ml_delall').click()); await wait(800);
    await F.evaluate(() => { $('mld_t').value = 'rl 182'; $('cf_ok').click(); });
    for (let i = 0; i < 30 && sql('rcl', "select count(*) from maintenance where machinery = '" + R + "'") !== '0'; i++) await wait(400);
    await wait(2500);
    const t2 = await toastNow(), after = await F.evaluate(() => ({ bills: S.rp.mlog.d.total.maint.bills, del: !$('ml_delall').hidden }));
    const lg = sql('rcl', "select count(*) from activity_log where action = 'Delete' and summary like '%the Maintenance Log Book of " + R + " deleted (3 bill(s), start to end)%'");
    ok('   the number typed (as "rl 182"): its 3 bills deleted – "3 bill(s) of RL-182 deleted."; the log book shown again (no bill, no Delete); ' + O + '\'s bill stays; each bill in the Activity Log',
      /3 bill\(s\) of RL-182 deleted\./.test(t2) && sql('rcl', "select count(*) from maintenance where machinery = '" + R + "'") === '0' && sql('rcl', "select count(*) from maintenance where machinery = '" + O + "'") === '1' && after.bills === 0 && !after.del && lg === '3', [t2, after, lg]);
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl', "delete from maintenance; delete from master where id in ('" + R + "', '" + O + "'); delete from web.props where key = 'MNT_LAST_NO'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: S1 back to ' + sql('rcl', 'select count(*) from maintenance') + ' bills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
