// update-129 (live, 19-10-2026, after update-128: "40 merge kela AHE BUT ASA ERROR KA YET AAHE" – "Not sent again: the save refuses it"
// and "Not saved: refused" on Diesel Issue "Multiple entries"): a save's WARNINGS (a KM / Hrs reading lower than the last one) are
// said as warnings – at the approval and when sent again – and the sender confirms them ("Send again anyway"), as "Save all anyway"
// on the page. On the local rig only (PORTAL=1 bash rig/all.sh; Mechanical :3001 own sign-in). Test data only: two users, one
// machinery KDX-129 and its diesel issues, the requests – all taken out at the end; the verification rules are put back as they were.
//   1. Diesel Issue goes to verification (Checker 129); Maker 129 sends "Multiple entries" (two lines of KDX-129, readings above the
//      last one): "Sent for verification"; meanwhile a later reading of KDX-129 is saved; the checker approves: Returned –
//      "Not saved: To check (warnings, not mistakes): Line 1: KDX-129: KM Reading 5100 is less than the last KM Reading 5300. …";
//   2. the maker's Diesel Issue page: the box shows that reason (not "refused");
//   3. "Send again" + remark: the warnings are shown to check ("Please check – warnings, not mistakes"); Cancel → nothing changes;
//   4. again, "Send again anyway": it goes (level 1), kept confirmed; the checker approves: the two lines are saved as they were sent.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node again129.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from diesel_issue where machinery = 'KDX-129'; delete from master where machinery_number = 'KDX-129'; delete from billed_changes where kind = 'Flow' and (requester_email = 'mk129@rcl.test' or machinery = 'KDX-129'); delete from app_users where email in ('mk129@rcl.test', 'ck129@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key like 'F\\_%' or key like 'LG\\_%' or key = 'USERS_LIST';");
  const post = async (body) => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const login = async email => (await post({ fn: 'login', args: [email, PW] })).result.token;
  const caller = tok => async (fn, ...a) => { const r = await post({ fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const errs = [];
  let b = null;
  try {
    cleanup();
    const SA = caller(await login('sujit@rcl.test'));
    const m = await SA('saveMaster', { no: 'KDX-129', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.5, owner: 'KD Owner', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
    const today = (await SA('getInit')).today;
    const d0 = await SA('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'KDX-129', qty: 5, kmReading: 5000, remark: 'test of update-129', force: true });
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_issue) select 'mk129', 'mk129@rcl.test', password_hash, 'Maker 129', 'Yes', 'No', 'Edit' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck129', 'ck129@rcl.test', password_hash, 'Checker 129', 'Yes', 'No' from app_users where email = 'sujit@rcl.test';" +
      "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
    const rules = on => sql("insert into app_settings (id, value) values ('FLOW_RULES', '{\"tasks\":{\"Diesel Issue\":{\"on\":" + on + ",\"levels\":[[\"ck129@rcl.test\"]],\"daysBack\":\"\",\"qtyAbove\":\"\"}},\"remindHours\":4}') on conflict (id) do update set value = excluded.value; delete from web.cache where key like 'SB%';");
    rules(true);
    ok('0. the rig: KDX-129 with a diesel issue of today at KM 5000', !m.ERROR && !d0.ERROR && sql("select count(*) from diesel_issue where machinery = 'KDX-129'") === '1', { m, d0 });
    // ---- 1. "Multiple entries" sent; a later reading saved meanwhile; approved → Returned with the WARNING said ----
    const MK = caller(await login('mk129@rcl.test')), CK = caller(await login('ck129@rcl.test'));
    const s1 = await MK('saveDieselBulk', { date: today, shift: 'Day', source: 'Dispenser', rows: [{ no: 'KDX-129', qty: 10, kmReading: 5100, remark: 't129' }, { no: 'KDX-129', qty: 6, kmReading: 5150, remark: 't129' }], force: false });
    const a = ((s1.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('1. Maker 129 sends Multiple entries (2 lines, readings above the last): "Sent for verification" ' + a + ', nothing saved', !!a && /^Sent for verification/.test(s1.ERROR) && sql("select count(*) from diesel_issue where machinery = 'KDX-129'") === '1', s1);
    rules(false);      // (the rig's admin is held too while the rule is on – the later reading is saved with the rule off for a moment)
    const d1 = await SA('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'KDX-129', qty: 4, kmReading: 5300, remark: 'test of update-129 (a later reading)', force: true });
    rules(true);
    const ra = await CK('decideChangeRequest', { id: a, approve: true });
    const why = 'Not saved: To check (warnings, not mistakes): Line 1: KDX-129: KM Reading 5100 is less than the last KM Reading 5300. – the sender can send it again and confirm them';
    ok('   meanwhile a later reading (5300) is saved; the checker approves: Returned – "' + ra.result + '"', !d1.ERROR && ra.status === 'Returned' && ra.result === why && sql("select count(*) from diesel_issue where machinery = 'KDX-129'") === '2', { d1, ra });

    // ---- 2. the maker's page ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'mk129@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); } catch (e) {}
    await F.evaluate(() => showTab('diesel'));
    const rowOf = async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(id => { const x = document.getElementById('fv_diesel'); const t = x && !x.hidden ? [...x.querySelectorAll('tr')].map(t => t.innerText.replace(/\s+/g, ' ')).find(t => t.indexOf(id) > -1) : ''; return t || ''; }, a); if (v) return v; await wait(500); } return ''; };
    const row = await rowOf();
    ok('2. Diesel Issue: the box shows why – the warning, not "refused"', row.indexOf('Not saved: To check (warnings, not mistakes): Line 1: KDX-129: KM Reading 5100 is less than the last KM Reading 5300.') > -1 && !/refused/.test(row), row);
    await F.evaluate(() => document.getElementById('fv_diesel').scrollIntoView()); await wait(300);
    await p.screenshot({ path: SHOTS + 'again129_box.png' });
    // ---- 3. Send again: the warnings to check; Cancel → nothing changes ----
    const sendAgain = async note => {
      await F.evaluate(id => document.querySelector('#fv_diesel [data-fvagain="' + id + '"]').click(), a); await wait(600);
      await F.evaluate(n => { $('cr_note').value = n; $('cf_ok').click(); }, note);
      for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => ({ open: !$('cf_back').hidden, title: $('cf_title').textContent, text: $('cf_msg').innerText.replace(/\s+/g, ' '), items: [...$('cf_msg').querySelectorAll('li')].map(x => x.textContent), ok: $('cf_ok').textContent })); if (v.open && v.title === 'Please check – warnings, not mistakes') return v; await wait(500); }
      return null;
    };
    const dlg = await sendAgain('Reading checked – the 5300 entry is of a later fill');
    ok('3. "Send again" + remark: the warnings are shown to check, each line; "Send again anyway"', !!dlg && dlg.items.length === 1 && dlg.items[0] === 'Line 1: KDX-129: KM Reading 5100 is less than the last KM Reading 5300.' && dlg.ok === 'Send again anyway' && /These are warnings, not mistakes/.test(dlg.text), dlg);
    await p.screenshot({ path: SHOTS + 'again129_warnings.png' });
    await F.evaluate(() => $('cf_cancel').click());
    const t1 = await (async () => { for (let i = 0; i < 20; i++) { const v = await F.evaluate(() => $('toast').textContent); if (/nothing changed/.test(v)) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    const st1 = sql("select status from billed_changes where id = '" + a + "'"), args1 = JSON.parse(sql("select args from billed_changes where id = '" + a + "'"));
    ok('   Cancel: "' + t1.replace(/\n/g, ' / ') + '" – still Returned, nothing changed (a red line, with the help in the app\'s language first)', t1.split('\n').pop() === 'Not sent again: ' + a + ' – nothing changed.' && st1 === 'Returned' && args1[0].force === false, { t1, st1 });
    // ---- 4. Send again anyway → waits again, confirmed; approved → saved as sent ----
    await wait(1200);
    const dlg2 = await sendAgain('Reading checked – the 5300 entry is of a later fill');
    await F.evaluate(() => $('cf_ok').click());
    const t2 = await (async () => { for (let i = 0; i < 30; i++) { const v = await F.evaluate(() => $('toast').textContent); if (/sent again for verification/.test(v)) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    const st2 = sql("select status || '|' || coalesce(result, '') from billed_changes where id = '" + a + "'"), args2 = JSON.parse(sql("select args from billed_changes where id = '" + a + "'"));
    const last = JSON.parse(sql("select data from billed_changes where id = '" + a + "'")).history.slice(-1)[0];
    ok('4. "Send again anyway": "' + t2 + '" – waiting at the checker again, kept confirmed (the remark + "warnings confirmed by the sender")', !!dlg2 && /sent again for verification \(level 1\) – saved when approved\./.test(t2) && st2 === 'Pending|' && args2[0].force === true && args2[0].rows.length === 2 && last.step === 'Sent again' && last.note === 'Reading checked – the 5300 entry is of a later fill – warnings confirmed by the sender', { t2, st2, last });
    await wait(1500); await p.screenshot({ path: SHOTS + 'again129_after.png' });
    const rb = await CK('decideChangeRequest', { id: a, approve: true });
    const rows = sql("select string_agg(km_reading || ':' || qty, ',' order by km_reading) from diesel_issue where machinery = 'KDX-129'");
    ok('   the checker approves: Approved – the two lines saved as they were sent (nothing typed again)', rb.status === 'Approved' && rows === '5000:5,5100:10,5150:6,5300:4', { rb, rows });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the page', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
