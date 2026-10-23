// update-145 (asked 23-10-2026: two people changing the same entry – "Log Book + Diesel Issue first"): two people open the same
//   entry; the first saves; the second's save is refused with the reason ("… was changed by … after you opened it") and the first
//   one's change stays. Real pages, two browsers: the Log Book edit window, Edit Log Book, the Diesel Issue form.
// On the local rig only.   node same145.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N145-%'; delete from diesel_issue where machinery like 'N145-%'; delete from boq where vendor_name = 'N145 Vendor'; delete from master where id like 'N145-%'; delete from vendors where vendor_name = 'N145 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const work = d => sql("select coalesce(work_done, '') || ' ' || coalesce(closing_km::text, '') from log_book where machinery = 'N145-TIP' and date = '2026-10-" + d + "'");
const qty = () => sql("select coalesce(string_agg(trim(trailing '.' from trim(trailing '0' from qty::text)), ','), '') from diesel_issue where machinery = 'N145-TIP'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N145 Vendor', gstReg: 'No', pan: 'ABCDE1245N', bank: 'SBI', account: '12345145', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N145-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 300, owner: 'N145 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveLogRows', { rows: [{ no: 'N145-TIP', date: '2026-10-01', shift: 'Full Day', mode: 'KM', openingKm: 1000, closingKm: 1100, openingDiesel: 50 }, { no: 'N145-TIP', date: '2026-10-02', shift: 'Full Day', mode: 'KM', closingKm: 1180, work: 'START' }] }));
  E(await api('saveDieselIssue', { date: '2026-10-02', shift: 'Day', source: 'Dispenser', no: 'N145-TIP', qty: 40, kmReading: 1120, force: true }));
  ok('the test machinery: a tipper on KM, 01-10 1000 → 1100, 02-10 → 1180 "START", a diesel issue of 40 L on 02-10', !seedErr.length && /^START 1180/.test(work('02')) && qty() === '40', seedErr.join(' // ') || [work('02'), qty()]);

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  // two people: two browsers (each its own sign-in)
  const open = async () => { const ctx = await b.createBrowserContext(), p = await ctx.newPage(); await p.setViewport({ width: 1600, height: 1000 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__t = []; const o = window.toast; window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; });
    return f; };
  const A = await open(), B = await open();
  const yes = f => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  const said = f => f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 500) : ''; if (bx) bx.hidden = true; const r = ((window.__t || []).join(' | ') + ' ' + t).trim(); window.__t = []; return r; });
  const click = async (f, id) => { await f.evaluate(id => document.getElementById(id).click(), id); for (let i = 0; i < 12; i++) { await wait(500); await yes(f); } await wait(800); };

  // ---------- 1. the Log Book edit window ----------
  const key = 'N145-TIP|2026-10-02|Full Day';
  const edit = (f, k) => f.evaluate(async k => { showTab('log'); await new Promise(r => setTimeout(r, 1500)); try { closeConfirm(false); } catch (e) {} await openLogEdit(k); }, k);
  const setV = (f, id, v) => f.evaluate((id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, id, v);
  await edit(A, key); await edit(B, key); await wait(800);
  await setV(B, 'le_work', 'LOADING BY B'); await click(B, 'le_save'); const sb = await said(B);
  ok('the edit window: A and B open 02-10; B saves "LOADING BY B"', /^LOADING BY B 1180/.test(work('02')), [work('02'), sb]);
  await setV(A, 'le_work', 'CARTING BY A'); await click(A, 'le_save'); const sa = await said(A);
  ok('   A saves what he opened before B\'s change: refused – "N145-TIP (02-10-2026, Full Day) was changed by … after you opened it – open it again"; B\'s change stays',
    /N145-TIP \(02-10-2026, Full Day\) was changed by .* after you opened it – open it again and make your change there\. Nothing was saved\./.test(sa) && /^LOADING BY B 1180/.test(work('02')), [sa, work('02')]);
  ok('   the help says what happened and what to do (in his language)', /Someone else changed this entry after you opened it|तुम्ही ही entry उघडल्यानंतर दुसऱ्या कोणीतरी ती बदलली/.test(sa), sa);
  await A.evaluate(() => { try { document.getElementById('le_cancel').click(); } catch (e) {} }); await edit(A, key);
  await setV(A, 'le_work', 'CARTING BY A'); await click(A, 'le_save'); await said(A);
  ok('   opened again (it shows B\'s change) and saved: A\'s change is in', /^CARTING BY A 1180/.test(work('02')), work('02'));
  await B.evaluate(() => { try { document.getElementById('le_cancel').click(); } catch (e) {} });

  // ---------- 2. Edit Log Book ----------
  const grid = f => f.evaluate(async () => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = '2026-10-01'; document.getElementById('lx_to').value = '2026-10-02'; const n = document.getElementById('lx_no'); n.value = 'N145-TIP'; n.dispatchEvent(new Event('change', { bubbles: true })); await lxLoad(); });
  const lxSet = (f, i, k, v) => f.evaluate((i, k, v) => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="' + k + '"]'); el.value = v; ['input', 'change'].forEach(n => el.dispatchEvent(new Event(n, { bubbles: true }))); }, i, k, v);
  await grid(A); await wait(1000);
  await edit(B, key); await setV(B, 'le_work', 'CHANGED BY B'); await click(B, 'le_save'); await said(B);
  await lxSet(A, 1, 'ckm', '1190'); await wait(400); await click(A, 'lx_save'); const sg = await said(A);
  ok('Edit Log Book: A opened the grid; B then changed 02-10 in the edit window; A\'s save of the grid is refused – nothing saved, B\'s change and 1180 stay',
    /Nothing saved: .*N145-TIP \(02-10-2026, Full Day\) was changed by .* after you opened it/.test(sg) && /^CHANGED BY B 1180/.test(work('02')), [sg, work('02')]);
  await grid(A); await wait(1000); await lxSet(A, 1, 'ckm', '1190'); await wait(400); await click(A, 'lx_save'); await said(A);
  ok('   loaded again and saved: 1190', / 1190$/.test(work('02')), work('02'));

  // ---------- 3. the Diesel Issue form ----------
  const id = sql("select id from diesel_issue where machinery = 'N145-TIP'");
  const dedit = (f, i) => f.evaluate(async i => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; await gsOpenIssues({ q: i }); await new Promise(r => setTimeout(r, 1200)); editDiesel(i); }, i);
  await dedit(A, id); await dedit(B, id); await wait(1000);
  await setV(B, 'd_qty', '45'); await click(B, 'd_save'); const db1 = await said(B);
  ok('Diesel Issue: A and B open ' + id + '; B saves 45 L', qty() === '45', [qty(), db1]);
  await setV(A, 'd_qty', '50'); await click(A, 'd_save'); const da = await said(A);
  ok('   A saves 50 L on what he opened (40): refused – "Diesel issue ' + id + ' (N145-TIP, 02-10-2026) was changed by … after you opened it"; 45 stays',
    new RegExp('Diesel issue ' + id + ' \\(N145-TIP, 02-10-2026\\) was changed by .* after you opened it').test(da) && qty() === '45', [da, qty()]);
  ok('no script error on the pages', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
