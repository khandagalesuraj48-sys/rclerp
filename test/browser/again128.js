// update-128 (asked 19-10-2026: "ata user prt tya entry krt basnar nahi ata je return reject zal tech reason deun return krta yeil
// as banaw ata jyana return zaley tith tyana option asel send to approval or verification data loss nko karu") – in the browser,
// on the local rig (PORTAL=1 bash rig/all.sh; Mechanical :3001 own sign-in, site S1). Test data only (two users, three vendors
// "VA128 …", their requests), all taken out at the end; the site's verification rules are put back as they were.
//   1. Vendor Master goes to verification (Checker 128 at level 1); Maker 128 sends three vendors; the checker rejects two (one
//      with "PAN?"); the third is approved while the maker has lost his Edit access – the save refuses it: Returned;
//   2. the maker (access back) opens Vendor Master: the box "My entries in verification" shows Not saved 3, each with why
//      (Rejected – the checker's note; Returned – "Not saved: …"), "Send again" on each and "Send all again (3)";
//   3. "Send again" on the returned one: the dialog shows why; no remark → "Write why it is sent again."; with a remark it goes –
//      waiting at the checker, level 1; nothing typed again;
//   4. "Send all again (2)" with one remark: both go; the box: Waiting 3;
//   5. the checker approves the three: the three vendors are saved, as they were sent.
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node again128.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => sql("delete from vendors where vendor_name like 'VA128 %'; delete from billed_changes where kind = 'Flow' and requester_email = 'mk128@rcl.test'; delete from app_users where email in ('mk128@rcl.test', 'ck128@rcl.test');" +
    (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
    "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  const post = async (body) => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const login = async email => (await post({ fn: 'login', args: [email, PW] })).result.token;
  const caller = tok => async (fn, ...a) => { const r = await post({ fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const V = n => ({ name: n, gstReg: 'No', pan: 'ABCPV1128A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' });
  const errs = [];
  let b = null;
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_vendor_master) select 'mk128', 'mk128@rcl.test', password_hash, 'Maker 128', 'Yes', 'No', 'Edit' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin) select 'ck128', 'ck128@rcl.test', password_hash, 'Checker 128', 'Yes', 'No' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_settings (id, value) values ('FLOW_RULES', '{\"tasks\":{\"Vendor Master\":{\"on\":true,\"levels\":[[\"ck128@rcl.test\"]],\"daysBack\":\"\",\"qtyAbove\":\"\"}},\"remindHours\":4}') on conflict (id) do update set value = excluded.value;" +
      "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
    // ---- 1. three vendors sent; two rejected; one returned ----
    const MK = caller(await login('mk128@rcl.test')), CK = caller(await login('ck128@rcl.test'));
    const send = async n => { const r = await MK('saveVendor', V(n), 'add'); return ((r.ERROR || '').match(/VF-\d{5}/) || [])[0]; };
    const a = await send('VA128 One'), bb = await send('VA128 Two'), c = await send('VA128 Three');
    ok('1. Maker 128 sends three vendors: each "Sent for verification" (' + [a, bb, c].join(', ') + '), nothing saved', !!(a && bb && c) && sql("select count(*) from vendors where vendor_name like 'VA128 %'") === '0', [a, bb, c]);
    const ra = await CK('decideChangeRequest', { id: a, approve: false, note: 'PAN?' }), rc = await CK('decideChangeRequest', { id: c, approve: false, note: 'later' });
    sql("update app_users set perm_vendor_master = 'View' where email = 'mk128@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    const rb = await CK('decideChangeRequest', { id: bb, approve: true });
    sql("update app_users set perm_vendor_master = 'Edit' where email = 'mk128@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    ok('   the checker rejects two; the third, approved while the maker had no Edit access, is Returned (the save refused it)', ra.status === 'Rejected' && rc.status === 'Rejected' && rb.status === 'Returned' && /^Not saved: Maker 128 has no Edit access to Vendor Master any more/.test(rb.result), [ra.status, rc.status, rb]);

    // ---- 2. the maker's page ----
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'mk128@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); } catch (e) {}
    await F.evaluate(() => showTab('vendors'));
    const box = await (async () => { for (let i = 0; i < 40; i++) { const v = await F.evaluate(() => { const x = document.getElementById('fv_vendors'); return x && !x.hidden ? { chips: x.querySelector('.fv-chips').innerText.replace(/\s+/g, ' '), rows: [...x.querySelectorAll('tr')].map(t => t.innerText.replace(/\s+/g, ' ')), again: [...x.querySelectorAll('[data-fvagain]')].map(y => y.dataset.fvagain), all: (x.querySelector('[data-fvagainall]') || {}).textContent || '' } : null; }); if (v && v.rows.length >= 3) return v; await wait(500); } return null; })();
    const rowOf = id => ((box || {}).rows || []).find(t => t.indexOf(id) > -1) || '';
    ok('2. Vendor Master: "My entries in verification" – Not saved 3, each with "Send again", and "Send all again (3)"', !!box && /Not saved\s*3/.test(box.chips) && box.again.length === 3 && box.all === 'Send all again (3)', box);
    ok('   why each was not saved is in the box: the checker\'s note, and for the returned one the save\'s reason', /Rejected – not saved Checker 128: PAN\?/.test(rowOf(a)) && /Returned – not saved .*Not saved: Maker 128 has no Edit access to Vendor Master any more/.test(rowOf(bb)), [rowOf(a), rowOf(bb)]);
    await F.evaluate(() => document.getElementById('fv_vendors').scrollIntoView()); await wait(300);
    await p.screenshot({ path: SHOTS + 'again128_box.png' });
    // ---- 3. Send again: the returned one ----
    await F.evaluate(id => document.querySelector('#fv_vendors [data-fvagain="' + id + '"]').click(), bb); await wait(600);
    const dlg = await F.evaluate(() => ({ open: !$('cf_back').hidden, title: $('cf_title').textContent, text: $('cf_msg').innerText.replace(/\s+/g, ' '), ok: $('cf_ok').textContent }));
    ok('3. "Send again": a box with the entry, why it was not saved, "it goes … exactly as it was sent", a remark to write', dlg.open && dlg.title === 'Send ' + bb + ' again?' && /Not saved: Maker 128 has no Edit access/.test(dlg.text) && /exactly as it was sent – the same lines and photos – starting at level 1/.test(dlg.text) && dlg.ok === 'Send again', dlg);
    await p.screenshot({ path: SHOTS + 'again128_dialog.png' });
    await F.evaluate(() => $('cf_ok').click()); await wait(700);
    const t1 = await F.evaluate(() => ({ toast: $('toast').textContent, open: !$('cf_back').hidden }));
    ok('   no remark: "Write why it is sent again." – the box stays', /Write why it is sent again\./.test(t1.toast) && t1.open, t1);
    await F.evaluate(() => { $('cr_note').value = 'Access is back – please approve'; $('cf_ok').click(); });
    const t2 = await (async () => { for (let i = 0; i < 30; i++) { const v = await F.evaluate(() => $('toast').textContent); if (/sent again for verification/.test(v)) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    const db1 = sql("select status || '|' || coalesce(result, '') from billed_changes where id = '" + bb + "'");
    ok('   with a remark: "' + t2 + '" – the same request waits again (Pending), nothing typed again', /sent again for verification \(level 1\) – saved when approved\./.test(t2) && db1 === 'Pending|', { t2, db1 });
    const steps = JSON.parse(sql("select data from billed_changes where id = '" + bb + "'")).history.map(h => h.step + (h.note ? ':' + h.note : ''));
    ok('   its steps keep everything: Sent, Approved, Returned (why), Sent again (the remark)', steps[0] === 'Sent' && steps[1].indexOf('Approved') === 0 && /^Returned:/.test(steps[2]) && steps[3] === 'Sent again:Access is back – please approve', steps);
    // ---- 4. Send all again ----
    await wait(1500);
    const all2 = await F.evaluate(() => (document.querySelector('#fv_vendors [data-fvagainall]') || {}).textContent || '');
    await F.evaluate(() => document.querySelector('#fv_vendors [data-fvagainall]').click()); await wait(600);
    const dlg2 = await F.evaluate(() => ({ title: $('cf_title').textContent, text: $('cf_msg').innerText.replace(/\s+/g, ' ') }));
    await F.evaluate(() => { $('cr_note').value = 'PAN checked'; $('cf_ok').click(); });
    const t3 = await (async () => { for (let i = 0; i < 30; i++) { const v = await F.evaluate(() => $('toast').textContent); if (v.indexOf(a) > -1 && v.indexOf(c) > -1) return v; await wait(500); } return await F.evaluate(() => $('toast').textContent); })();
    await wait(1500);
    const box2 = await F.evaluate(() => { const x = document.getElementById('fv_vendors'); return { chips: x.querySelector('.fv-chips').innerText.replace(/\s+/g, ' '), again: x.querySelectorAll('[data-fvagain]').length }; });
    ok('4. "' + all2 + '" with one remark: both go; the box shows Waiting 3, nothing left to send again', all2 === 'Send all again (2)' && dlg2.title === 'Send 2 entries again?' && /They go to verification again exactly as they were sent/.test(dlg2.text) && /sent again for verification \(level 1\)/.test(t3) && t3.indexOf(a) > -1 && t3.indexOf(c) > -1 && /Waiting\s*3/.test(box2.chips) && box2.again === 0, { all2, dlg2, t3, box2 });
    await p.screenshot({ path: SHOTS + 'again128_after.png' });
    // ---- 5. approved: saved as they were sent ----
    const rs = await CK('decideChangeRequests', { ids: [a, bb, c], approve: true, note: '' });
    ok('5. the checker approves the three: saved – the vendors as they were sent (nothing typed again)', (rs.done || []).length === 3 && (rs.done || []).every(d => d.status === 'Approved') && sql("select string_agg(vendor_name || ':' || pan_number, ',' order by vendor_name) from vendors where vendor_name like 'VA128 %'") === 'VA128 One:ABCPV1128A,VA128 Three:ABCPV1128A,VA128 Two:ABCPV1128A', rs);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the page', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
