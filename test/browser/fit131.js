// update-131 (asked 19-10-2026: "send any way he option nko aahe chukicha data approval sathi gelach nahi pahije kay chukey te user
// la patkan samjle pahije user correct krel tya nantr correct hoil mg te send hou shakel") – in the browser, on the local rig only
// (PORTAL=1 bash rig/all.sh; Mechanical :3001 own sign-in). Test data only: two users, machinery KDX-131 and its diesel issues, the
// requests – all taken out at the end; the verification rules are put back as they were. (Replaces again129.js – "Send again
// anyway" is gone.)
//   0. KDX-131: a fill 2 days ago at KM 5000;
//   1. the maker's Multiple entries of YESTERDAY (5100, 5150): sent – a fill of an earlier date is not "less than the last" any more;
//      a row that does not fit (4000, before 5000) is not sent, even with "Save all anyway" (force);
//   2. meanwhile a fill of TODAY at KM 5120 is saved → the approval: Returned – "Line 2: … 5150 is more than the later KM Reading
//      5120 (fill of <today>, Day)";
//   3. Send again: said in full, no "anyway" – nothing changes;
//   4. Open & correct: line 2 red with the reason; 5150 → 5110 → sent; approved → saved as corrected.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node fit131.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
const addDays = (dk, n) => { const d = new Date(dk + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dmy = dk => dk.split('-').reverse().join('-');
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from diesel_issue where machinery = 'KDX-131'; delete from master where machinery_number = 'KDX-131'; delete from billed_changes where kind = 'Flow' and (requester_email = 'mk131@rcl.test' or machinery like '%KDX-131%'); delete from app_users where email in ('mk131@rcl.test', 'ck131@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key like 'F\\_%' or key like 'LG\\_%' or key = 'USERS_LIST';");
  const post = async (body) => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const login = async email => (await post({ fn: 'login', args: [email, PW] })).result.token;
  const caller = tok => async (fn, ...a) => { const r = await post({ fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const rules = on => sql("insert into app_settings (id, value) values ('FLOW_RULES', '{\"tasks\":{\"Diesel Issue\":{\"on\":" + on + ",\"levels\":[[\"ck131@rcl.test\"]],\"daysBack\":\"\",\"qtyAbove\":\"\"}},\"remindHours\":4}') on conflict (id) do update set value = excluded.value; delete from web.cache where key like 'SB%';");
  const errs = [];
  let b = null;
  try {
    cleanup();
    const SA = caller(await login('sujit@rcl.test'));
    const m = await SA('saveMaster', { no: 'KDX-131', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.5, owner: 'KD Owner', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
    const today = (await SA('getInit')).today, yday = addDays(today, -1), d2 = addDays(today, -2);
    const d0 = await SA('saveDieselIssue', { date: d2, shift: 'Day', source: 'Dispenser', no: 'KDX-131', qty: 5, kmReading: 5000, remark: 'test of update-131', force: true });
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue) select 'mk131', 'mk131@rcl.test', password_hash, 'Maker 131', 'Yes', 'No', 'Edit' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue) select 'ck131', 'ck131@rcl.test', password_hash, 'Checker 131', 'Yes', 'No', 'View' from app_users where email = 'sujit@rcl.test';" +
      "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
    rules(true);
    ok('0. the rig: KDX-131 with a fill of ' + dmy(d2) + ' at KM 5000', !m.ERROR && !d0.ERROR, { m, d0 });
    // ---- 1. not sent with a reading that does not fit – not even "anyway"; an earlier date that fits: sent ----
    const MK = caller(await login('mk131@rcl.test')), CK = caller(await login('ck131@rcl.test'));
    const B = (rows, force) => ({ date: yday, shift: 'Day', source: 'Dispenser', rows: rows.map(x => ({ no: 'KDX-131', qty: x[0], kmReading: x[1], hrReading: '', driver: '', remark: 't131' })), force: !!force });
    const bad = await MK('saveDieselBulk', B([['10', '4000']], true));
    ok('1. a row that does not fit (4000, the fill before is 5000): not sent, even with "Save all anyway" – the row and why', bad.ok === false && JSON.stringify(bad.errors) === JSON.stringify([{ row: 1, msg: 'KDX-131: KM Reading 4000 is less than the earlier KM Reading 5000 (fill of ' + dmy(d2) + ', Day).' }]) && sql("select count(*) from billed_changes where kind = 'Flow' and requester_email = 'mk131@rcl.test'") === '0', bad);
    const s1 = await MK('saveDieselBulk', B([['10', '5100'], ['6', '5150']]));
    const a = ((s1.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('   Multiple entries of yesterday (5100, 5150): "Sent for verification" ' + a, !!a && /^Sent for verification/.test(s1.ERROR), s1);
    // ---- 2. a fill of today at 5120 saved meanwhile → the approval: Returned with the line and the date ----
    rules(false); const d1 = await SA('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'KDX-131', qty: 4, kmReading: 5120, remark: 'test of update-131 (later)', force: true }); rules(true);
    const ra = await CK('decideChangeRequest', { id: a, approve: true });
    const why = 'Not saved: Line 2: KDX-131: KM Reading 5150 is more than the later KM Reading 5120 (fill of ' + dmy(today) + ', Day).';
    ok('2. a fill of today at 5120 meanwhile; the approval: Returned – "' + ra.result + '"', !d1.ERROR && ra.status === 'Returned' && ra.result === why, { d1, ra });

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'mk131@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); } catch (e) {}
    await F.evaluate(() => showTab('diesel'));
    for (let i = 0; i < 40; i++) { if (await F.evaluate(id => !!document.querySelector('#fv_diesel [data-fvagain="' + id + '"]'), a)) break; await wait(500); }
    // ---- 3. Send again: said in full; no "anyway" ----
    await F.evaluate(id => document.querySelector('#fv_diesel [data-fvagain="' + id + '"]').click(), a); await wait(600);
    await F.evaluate(() => { $('cr_note').value = 'please'; $('cf_ok').click(); });
    const t1 = await (async () => { for (let i = 0; i < 30; i++) { const v = await F.evaluate(() => $('toast').textContent); if (/Not sent/.test(v)) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    const anyDlg = await F.evaluate(() => !$('cf_back').hidden ? $('cf_ok').textContent : '');
    ok('3. "Send again": not sent – the line and why said in full; no "Send again anyway"; nothing changed', t1.indexOf('Not sent: ' + a + ' – Not sent again: Line 2: KDX-131: KM Reading 5150 is more than the later KM Reading 5120 (fill of ' + dmy(today) + ', Day).') > -1 && anyDlg === '' &&
      sql("select status from billed_changes where id = '" + a + "'") === 'Returned', { t1, anyDlg });
    // ---- 4. Open & correct: line 2 red with why; corrected → sent; approved → saved ----
    await wait(1200);
    await F.evaluate(id => document.querySelector('#fv_diesel [data-fvfix="' + id + '"]').click(), a);
    const form = await (async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => ({ bar: $('d_fixbar').hidden ? '' : $('d_fixbar').innerText.replace(/\s+/g, ' '), cls: [...$('bd_rows').children].map(tr => tr.className).join('|'), list: $('bd_errors').hidden ? '' : $('bd_errors').innerText.replace(/\s+/g, ' ') })); if (v.bar) return v; await wait(500); } return null; })();
    ok('4. "Open & correct": line 2 red with why (the later fill and its date)', !!form && form.cls === '|err' && form.list === 'Row 2: KDX-131: KM Reading 5150 is more than the later KM Reading 5120 (fill of ' + dmy(today) + ', Day).', form);
    await p.screenshot({ path: SHOTS + 'fit131_open.png' });
    await F.evaluate(() => { const x = $('bd_rows').children[1].querySelector('[data-f=kmReading]'); x.value = '5110'; x.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(500);
    await F.evaluate(() => $('bd_save').click()); await wait(1200);
    await F.evaluate(() => { $('cr_note').value = 'Reading 5110 from the meter photo'; $('cf_ok').click(); });
    const t2 = await (async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => $('toast').textContent); if (/corrected and sent again/.test(v)) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    const rb = await CK('decideChangeRequest', { id: a, approve: true });
    const saved = sql("select string_agg(km_reading::text, ',' order by km_reading) from diesel_issue where machinery = 'KDX-131'");
    ok('   corrected (5150 → 5110): "' + t2 + '"; approved → saved as corrected', /corrected and sent again for verification \(level 1\)/.test(t2) && rb.status === 'Approved' && saved === '5000,5100,5110,5120', { t2, rb, saved });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the page', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
