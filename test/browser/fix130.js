// update-130 (asked 19-10-2026: "jy entry pathwale hote te mala open krun edit pn krta yaw kay kuth chukley te pn samjayla haw"; his
// choices: only the sender, corrected → to verification again, Diesel Issue first) – in the browser, on the local rig only
// (PORTAL=1 bash rig/all.sh; Mechanical :3001 own sign-in). Test data only: two users, machinery KDX-130 / KDX-130B and their diesel
// issues, the requests – all taken out at the end; the verification rules are put back as they were.
//   1. Multiple entries (2 lines) sent; KDX-130B is taken out of the Master meanwhile; approved → Returned "Line 2: … not in Master";
//   2. the maker: "Open & correct" → the Multiple entries form with the two lines as sent, line 2 red with the reason, the bar on top
//      ("Correcting VF-…"), the button "Send again (VF-…)"; corrected (line 2 → KDX-130) → a remark → sent: Pending, the corrected
//      lines, its step "Corrected and sent again" with what changed;
//   3. the checker's Approvals: "Corrected by Maker 130" and what changed; approved → the corrected lines saved;
//   4. one entry, rejected: "Open & correct" → the one-entry form as sent; "Stop correcting" → nothing changes; opened again,
//      litres corrected → sent; approved → saved.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node fix130.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from diesel_issue where machinery in ('KDX-130', 'KDX-130B'); delete from master where machinery_number in ('KDX-130', 'KDX-130B'); delete from billed_changes where kind = 'Flow' and (requester_email = 'mk130@rcl.test' or machinery like '%KDX-130%'); delete from app_users where email in ('mk130@rcl.test', 'ck130@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key like 'F\\_%' or key like 'LG\\_%' or key = 'USERS_LIST';");
  const post = async (body) => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const login = async email => (await post({ fn: 'login', args: [email, PW] })).result.token;
  const caller = tok => async (fn, ...a) => { const r = await post({ fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const rules = on => sql("insert into app_settings (id, value) values ('FLOW_RULES', '{\"tasks\":{\"Diesel Issue\":{\"on\":" + on + ",\"levels\":[[\"ck130@rcl.test\"]],\"daysBack\":\"\",\"qtyAbove\":\"\"}},\"remindHours\":4}') on conflict (id) do update set value = excluded.value; delete from web.cache where key like 'SB%';");
  const errs = [];
  let b = null;
  try {
    cleanup();
    const SA = caller(await login('sujit@rcl.test'));
    const mach = no => SA('saveMaster', { no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.5, owner: 'KD Owner', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
    const m1 = await mach('KDX-130'), m2 = await mach('KDX-130B');
    const today = (await SA('getInit')).today;
    const d0 = await SA('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'KDX-130', qty: 5, kmReading: 5000, remark: 'test of update-130', force: true });
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue) select 'mk130', 'mk130@rcl.test', password_hash, 'Maker 130', 'Yes', 'No', 'Edit' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue) select 'ck130', 'ck130@rcl.test', password_hash, 'Checker 130', 'Yes', 'No', 'View' from app_users where email = 'sujit@rcl.test';" +
      "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
    rules(true);
    ok('0. the rig: KDX-130 (a diesel issue at KM 5000) and KDX-130B', !m1.ERROR && !m2.ERROR && !d0.ERROR, { m1, m2, d0 });
    // ---- 1. Multiple entries sent; KDX-130B taken out meanwhile; approved → Returned with the line and why ----
    const MK = caller(await login('mk130@rcl.test')), CK = caller(await login('ck130@rcl.test'));
    const s1 = await MK('saveDieselBulk', { date: today, shift: 'Day', source: 'Dispenser', rows: [{ no: 'KDX-130', qty: '10', kmReading: '5100', hrReading: '', driver: 'Ravi', remark: 't130' }, { no: 'KDX-130B', qty: '6', kmReading: '700', hrReading: '', driver: '', remark: 't130' }], force: false });
    const a = ((s1.ERROR || '').match(/VF-\d{5}/) || [])[0];
    rules(false); const del = await SA('deleteMaster', 'KDX-130B', true); rules(true);
    const ra = await CK('decideChangeRequest', { id: a, approve: true });
    ok('1. Multiple entries sent (' + a + '); KDX-130B taken out of the Master meanwhile; approved → Returned "' + ra.result + '"', !!a && !del.ERROR && ra.status === 'Returned' && ra.result === 'Not saved: Line 2: "KDX-130B" is not in Master.', { s1, del, ra });

    // ---- 2. the maker opens it and corrects it ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const open = async email => {
      const ctx = await b.createBrowserContext(), p = await ctx.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
      await p.goto(U + '/', { waitUntil: 'load' });
      const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
      let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
      await F.type('#lg_email', email); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
      F = await find(() => typeof S === 'object' && !!S.user);
      try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); } catch (e) {}
      return { p, F };
    };
    const { p, F } = await open('mk130@rcl.test');
    await F.evaluate(() => showTab('diesel'));
    const fixBtn = async id => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(id => !!document.querySelector('#fv_diesel [data-fvfix="' + id + '"]'), id); if (v) return true; await wait(500); } return false; };
    ok('2. Diesel Issue: "Open & correct" next to "Send again" on ' + a, await fixBtn(a) && await F.evaluate(id => !!document.querySelector('#fv_diesel [data-fvagain="' + id + '"]'), a));
    await F.evaluate(id => document.querySelector('#fv_diesel [data-fvfix="' + id + '"]').click(), a);
    const form = await (async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => ({ bar: $('d_fixbar').hidden ? '' : $('d_fixbar').innerText.replace(/\s+/g, ' '), many: !$('d_multi').hidden, type: dMType(), date: $('bd_date').value,
      rows: [...$('bd_rows').children].map(tr => ({ no: tr.querySelector('[data-f=no]').value, qty: tr.querySelector('[data-f=qty]').value, km: tr.querySelector('[data-f=kmReading]').value, driver: tr.querySelector('[data-f=driver]').value, cls: tr.className })),
      list: $('bd_errors').hidden ? '' : $('bd_errors').innerText.replace(/\s+/g, ' '), btn: $('bd_save').textContent })); if (v.bar) return v; await wait(500); } return null; })();
    ok('   it opens in Multiple entries as sent: the two lines, line 2 red with why; the bar on top; the button "Send again (' + a + ')"', !!form && form.many && form.type === 'date' && form.date === today && form.rows.length === 2 &&
      form.rows[0].no === 'KDX-130' && form.rows[0].qty === '10' && form.rows[0].km === '5100' && form.rows[0].driver === 'Ravi' && !/err/.test(form.rows[0].cls) && form.rows[1].no === 'KDX-130B' && /err/.test(form.rows[1].cls) &&
      form.list === 'Row 2: "KDX-130B" is not in Master.' && new RegExp('^Correcting ' + a + ' – Returned, not saved Not saved: Line 2: "KDX-130B" is not in Master\\. Now: the rows in red are wrong').test(form.bar) && form.btn === 'Send again (' + a + ')', form);
    await p.screenshot({ path: SHOTS + 'fix130_open.png' });
    // corrected: line 2 → KDX-130 (reading after line 1)
    await F.evaluate(() => { const tr = $('bd_rows').children[1]; const no = tr.querySelector('[data-f=no]'); no.value = 'KDX-130'; no.dispatchEvent(new Event('change', { bubbles: true })); tr.querySelector('[data-f=kmReading]').value = '5150'; tr.querySelector('[data-f=kmReading]').dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(800);
    await F.evaluate(() => $('bd_save').click()); await wait(1200);
    const dlg = await F.evaluate(() => ({ open: !$('cf_back').hidden, title: $('cf_title').textContent, text: $('cf_msg').innerText.replace(/\s+/g, ' '), ok: $('cf_ok').textContent }));
    ok('   "Send again (' + a + ')": a remark is asked – "' + dlg.title + '"', dlg.open && dlg.title === 'Send ' + a + ' again, corrected?' && /What did you correct\?/.test(dlg.text) && dlg.ok === 'Send again', dlg);
    await F.evaluate(() => { $('cr_note').value = 'KDX-130B was a typing mistake – it is KDX-130'; $('cf_ok').click(); });
    const t1 = await (async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => $('toast').textContent); if (/corrected and sent again/.test(v)) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    const row1 = JSON.parse(sql("select json_build_object('st', status, 'args', args::json, 'data', data::json)::text from billed_changes where id = '" + a + "'"));
    const last = row1.data.history.slice(-1)[0];
    const after = await F.evaluate(() => ({ bar: !$('d_fixbar').hidden, btn: $('bd_save').textContent, rows: [...$('bd_rows').children].map(tr => tr.querySelector('[data-f=no]').value).join('|') }));
    ok('   sent: "' + t1 + '" – waiting (level 1) with the corrected lines; its step says what changed; the form emptied, the bar gone', t1 === a + ' corrected and sent again for verification (level 1) – saved when approved.' && row1.st === 'Pending' &&
      row1.args[0].rows[1].no === 'KDX-130' && row1.args[0].rows[1].kmReading === '5150' && last.step === 'Corrected and sent again' && last.note === 'KDX-130B was a typing mistake – it is KDX-130' &&
      JSON.stringify(last.changes) === JSON.stringify(['Row 2 – Machinery: KDX-130B → KDX-130', 'Row 2 – KM reading: 700 → 5150']) && !after.bar && after.rows === '|', { t1, st: row1.st, last, after });
    // ---- 3. the checker sees what was corrected; approves → saved as corrected ----
    const C = await open('ck130@rcl.test');
    await C.F.evaluate(() => showTab('approvals'));
    const seen = await (async () => { for (let i = 0; i < 40; i++) { const v = await C.F.evaluate(id => { const tr = [...document.querySelectorAll('#cr_rows tr')].find(t => t.innerText.indexOf(id) > -1); const x = tr && tr.querySelector('.cr-chg'); return x ? x.innerText.replace(/\s+/g, ' ') : ''; }, a); if (v) return v; await wait(500); } return ''; })();
    ok('3. the checker\'s Approvals: "' + seen + '"', seen === 'Corrected by Maker 130: KDX-130B was a typing mistake – it is KDX-130 Row 2 – Machinery: KDX-130B → KDX-130 Row 2 – KM reading: 700 → 5150', seen);
    await C.F.evaluate(id => { const tr = [...document.querySelectorAll('#cr_rows tr')].find(t => t.innerText.indexOf(id) > -1); tr.scrollIntoView({ block: 'center' }); }, a); await wait(300);
    await C.p.screenshot({ path: SHOTS + 'fix130_approver.png' });
    const rb = await CK('decideChangeRequest', { id: a, approve: true });
    const saved = sql("select string_agg(machinery || ':' || km_reading || ':' || qty, ',' order by km_reading) from diesel_issue where machinery like 'KDX-130%'");
    ok('   approved: saved – the corrected lines', rb.status === 'Approved' && saved === 'KDX-130:5000:5,KDX-130:5100:10,KDX-130:5150:6', { rb, saved });
    // ---- 4. one entry: rejected → opened; Stop correcting; opened again, corrected → sent → approved ----
    const s2 = await MK('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'KDX-130', qty: 5, kmReading: 5200, hrReading: '', driver: 'Ravi', remark: 't130 one', force: false, mode: 'KM' });
    const c = ((s2.ERROR || '').match(/VF-\d{5}/) || [])[0];
    const rc = await CK('decideChangeRequest', { id: c, approve: false, note: 'litres are 7' });
    await F.evaluate(() => crLoad(true)); await fixBtn(c);
    await F.evaluate(id => document.querySelector('#fv_diesel [data-fvfix="' + id + '"]').click(), c);
    const one = await (async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => ({ bar: $('d_fixbar').hidden ? '' : $('d_fixbar').innerText.replace(/\s+/g, ' '), single: !$('d_single').hidden, title: $('d_title').textContent, no: $('d_no').value, qty: $('d_qty').value, km: $('d_km').value, driver: $('d_driver').value, btn: $('d_save').textContent })); if (v.bar && v.no) return v; await wait(500); } return null; })();
    ok('4. one entry, rejected (' + c + '): opens in One entry as sent – "' + (one || {}).title + '", why on top, "Send again (' + c + ')"', !!c && rc.status === 'Rejected' && !!one && one.single && one.title === 'Correct ' + c && one.no === 'KDX-130' && one.qty === '5' && one.km === '5200' && one.driver === 'Ravi' &&
      new RegExp('^Correcting ' + c + ' – Rejected, not saved Rejected by Checker 130: litres are 7 The save takes it now as it is').test(one.bar) && one.btn === 'Send again (' + c + ')', one);
    await p.screenshot({ path: SHOTS + 'fix130_one.png' });
    await F.evaluate(() => $('d_fixstop').click()); await wait(800);
    const stop = await F.evaluate(() => ({ bar: !$('d_fixbar').hidden, no: $('d_no').value, title: $('d_title').textContent, btn: $('d_save').textContent, toast: $('toast').textContent }));
    ok('   "Stop correcting": the form is emptied, the bar gone – "' + stop.toast + '"; still Rejected', !stop.bar && stop.no === '' && stop.title === 'Issue diesel' && stop.btn !== 'Send again (' + c + ')' && stop.toast === c + ' stays as it was – nothing changed.' && sql("select status from billed_changes where id = '" + c + "'") === 'Rejected', stop);
    await F.evaluate(id => document.querySelector('#fv_diesel [data-fvfix="' + id + '"]').click(), c);
    for (let i = 0; i < 40; i++) { if (await F.evaluate(() => !$('d_fixbar').hidden && !!$('d_no').value)) break; await wait(500); }
    await F.evaluate(() => { $('d_qty').value = '7'; $('d_qty').dispatchEvent(new Event('input', { bubbles: true })); }); await wait(1500);
    await F.evaluate(() => $('d_save').click()); await wait(1500);
    await F.evaluate(() => { $('cr_note').value = 'Litres 7, as the checker said'; $('cf_ok').click(); });
    const t2 = await (async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => $('toast').textContent); if (/corrected and sent again/.test(v)) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    const last2 = JSON.parse(sql("select data from billed_changes where id = '" + c + "'")).history.slice(-1)[0];
    const rd = await CK('decideChangeRequest', { id: c, approve: true });
    ok('   corrected (litres 5 → 7) and sent: "' + t2 + '"; approved → saved', /corrected and sent again for verification \(level 1\)/.test(t2) && JSON.stringify(last2.changes) === JSON.stringify(['Litres: 5 → 7']) && rd.status === 'Approved' &&
      sql("select qty from diesel_issue where machinery = 'KDX-130' and km_reading = 5200") === '7', { t2, last2, rd });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the page', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
