// Declaration of GST non-enrolment with a bill: for a party without a GST number the bill's papers carry the declaration in that
// party's name; it is saved with the bill. Page → Verify & Submit → database → Saved Bills print (PDF, pages counted, text read).
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 620) : '')); };
const NAMES = "('Siddhappa Test Basbire','Siddhappa Renamed Basbire','Gst Vendor Pvt')";
const clean = () => sql("delete from bills where vendor_name in " + NAMES + "; delete from log_book where machinery like 'GDX-%'; delete from diesel_issue where machinery like 'GDX-%'; delete from boq where vendor_name in " + NAMES + "; delete from master where id like 'GDX-%'; delete from vendors where vendor_name in " + NAMES + ";");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const must = (n, r) => { if (!r || r.ERROR || r.ok === false) out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
  const mach = (no, type, owner) => ({ no: no, name: type, type: type, unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: owner, ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' });
  must('m1', await api('saveMaster', mach('GDX-1', 'Trailer', 'Siddhappa Test Basbire'), 'add')); must('m2', await api('saveMaster', mach('GDX-2', 'Tipper', 'Siddhappa Test Basbire'), 'add')); must('m3', await api('saveMaster', mach('GDX-3', 'Tipper', 'Gst Vendor Pvt'), 'add'));
  must('v1', await api('saveVendor', { name: 'Siddhappa Test Basbire', gstReg: 'No', pan: 'ABCPE1234S', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add'));
  must('v2', await api('saveVendor', { name: 'Gst Vendor Pvt', gstReg: 'Yes', gst: '27ABCCE1234K1Z5', gstPct: 18, pan: 'ABCCE1234K', bank: 'SBI', account: '87654321', ifsc: 'SBIN0000001' }, 'add'));
  must('boq1', await api('saveBoq', { vendor: 'Siddhappa Test Basbire', from: '2026-09-01', tdsPct: 2, woNo: 'WO-GD1', lines: [{ no: 'GDX-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }, { no: 'GDX-2', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add'));
  must('boq2', await api('saveBoq', { vendor: 'Gst Vendor Pvt', from: '2026-09-01', gstPct: 18, tdsPct: 2, woNo: 'WO-GD2', lines: [{ no: 'GDX-3', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add'));
  const rows = []; ['GDX-1', 'GDX-2', 'GDX-3'].forEach((no, k) => { for (let d = 1; d <= 5; d++) rows.push({ date: '2026-09-0' + d, shift: 'Full Day', no: no, mode: 'KM', openingKm: d === 1 ? 1000 * (k + 1) : undefined, closingKm: 1000 * (k + 1) + d * 40 }); });
  must('log', await api('saveLogRows', { rows: rows }));
  const co = ((await api('billInit')).companies || ['Rachana Construction Limited'])[0];

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  const pdfOf = async (w, name) => { const file = '/home/claude/test/shots/gd_' + name + '.pdf'; await w.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    return { pages: Number((execSync('pdfinfo "' + file + '"').toString().match(/Pages:\s+(\d+)/) || [])[1]), text: execSync('pdftotext -layout "' + file + '" -').toString().replace(/\s+/g, ' '), file: file }; };

  // ---------- 1. the bill page ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
  await f.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /Siddhappa Test Basbire|Gst Vendor Pvt/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-05'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co).catch(e => out.push('bill load: ' + String(e.message).slice(0, 120)));
  for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await f.evaluate(() => (S.mb.bills || []).length >= 2)) break; }
  const pv = await f.evaluate(() => [...document.querySelectorAll('#mb_pages .mb-page')].map(pg => { const b = S.mb.bills[Number(pg.dataset.i)]; const g = pg.querySelector('.gdn');
    return { vendor: b.vendor.name, gstReg: b.vendor.gstReg, mark: b.gstDecl, papers: pg.querySelectorAll('.mb-paper').length, heads: [...pg.querySelectorAll('.mb-doc-h')].map(h => h.textContent.trim().slice(0, 44)), decl: g ? g.textContent.replace(/\s+/g, ' ') : '' }; }));
  const p1 = pv.find(x => /Siddhappa/.test(x.vendor)) || {}, p2 = pv.find(x => /Gst Vendor/.test(x.vendor)) || {};
  ok('1. bill page – the party WITHOUT a GST number: three papers (Abstract, Tax Invoice, Declaration)', p1.papers === 3 && p1.mark === true && /Declaration of GST non-enrolment/.test((p1.heads || []).join('|')), { papers: p1.papers, heads: p1.heads });
  ok('   the declaration is in that party\'s name, names the machinery of THIS bill and the company the bill is made to; signatory = the party; date = the bill date',
    /I\/We Siddhappa Test Basbire, do hereby declare/.test(p1.decl) && /goods or services Rent on vehicles GDX1, GDX2 which are exempted/.test(p1.decl) && new RegExp('also confirm ' + co.toUpperCase() + ' that shall not be liable').test(p1.decl) && /Name of the Authorised Signatory: Siddhappa Test Basbire/.test(p1.decl) && /Date: 05\.10\.2026/.test(p1.decl), p1.decl.slice(0, 600));
  ok('   the party WITH a GST number: no declaration (two papers as before)', p2.papers === 2 && p2.mark === false && !p2.decl, { papers: p2.papers, gstReg: p2.gstReg, heads: p2.heads });
  const el = await f.$('#mb_pages .gdn'); if (el) { await f.evaluate(() => document.querySelector('#mb_pages .gdn').scrollIntoView({ block: 'start' })); await wait(400); await p.screenshot({ path: '/home/claude/test/shots/gstdecl_page.png' }); }

  // ---------- 2. Verify & Submit ----------
  await f.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach((tr, i) => { const no = tr.querySelector('.mb-no'); if (no && !no.value) { no.value = String(41 + i); no.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(900);
  const popup = new Promise(res => b.once('targetcreated', t => res(t)));
  await f.evaluate(() => document.getElementById('mb_abstract').click()); let seen = '';
  for (let i = 0; i < 50; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const tx = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' '); document.getElementById('cf_ok').click(); return tx; } return ''; }); if (t) seen += t + ' || '; if (sql("select count(*) from bills where vendor_name in " + NAMES + " and status = 'Active'") === '2') break; }
  ok('2. Verify & Submit: the check list says the declaration is made with the bill of the party without GST (and not for the other)', (seen.match(/Declaration of GST non-enrolment/g) || []).length === 1 && /in the name of Siddhappa Test Basbire is made with this bill/.test(seen), (seen.match(/.{60}Declaration of GST non-enrolment.{60}/) || [seen.slice(0, 300)])[0]);
  const db = sql("select vendor_name || ' = ' || coalesce(data::json->>'gstDecl','(none)') from bills where vendor_name in " + NAMES + " order by vendor_name");
  ok('   database: the mark is SAVED IN THE BILL – true for the party without GST, false for the other', db === 'Gst Vendor Pvt = false\nSiddhappa Test Basbire = true', db.replace(/\n/g, ' | '));
  const t0 = await Promise.race([popup, wait(15000).then(() => null)]);
  if (t0) { const w = await t0.page(); await wait(2500); const r = await pdfOf(w, 'submitted');
    ok('   the print that opens after submitting: 5 papers on 5 pages (3 + 2), the declaration once, in the party\'s name', r.pages === 5 && (r.text.match(/DECLARATION OF GST NON-ENROLMENT/g) || []).length === 1 && /I\/We Siddhappa Test Basbire ?, do hereby declare/.test(r.text), { pages: r.pages, declarations: (r.text.match(/DECLARATION OF GST NON-ENROLMENT/g) || []).length });
    execSync('pdftoppm -r 80 -png "' + r.file + '" /home/claude/test/shots/gd_submitted'); await w.close(); }
  else ok('   the print that opens after submitting', false, 'no print window');

  // ---------- 3. Saved Bills → View / Print (from what is saved) ----------
  const savedPrint = async (vendorLike, name) => {
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bills'); }); await wait(1200);
    await f.evaluate(() => { document.getElementById('sb_from').value = '2026-09-01'; document.getElementById('sb_to').value = '2026-09-30'; return sbLoad(); }); await wait(1500);
    const got = new Promise(res => b.once('targetcreated', t => res(t)));
    const hit = await f.evaluate(v => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => r.textContent.indexOf(v) > -1); if (!tr) return false; tr.querySelector('[data-sbv]').click(); return true; }, vendorLike);
    if (!hit) return null; const t = await Promise.race([got, wait(15000).then(() => null)]); if (!t) return null;
    const w = await t.page(); await wait(2500); const r = await pdfOf(w, name); await w.close(); return r; };
  let r = await savedPrint('Siddhappa Test Basbire', 'saved1');
  ok('3. Saved Bills → View / Print of that bill: Abstract, Tax Invoice and the declaration (3 papers), then the Log Book of its 2 machinery – 5 pages', r && r.pages === 5 && /DECLARATION OF GST NON-ENROLMENT/.test(r.text) && /Rent on vehicles GDX1, GDX2/.test(r.text), r && { pages: r.pages });
  r = await savedPrint('Gst Vendor Pvt', 'saved2');
  ok('   the bill of the GST party: 2 papers + the Log Book of its machinery = 3 pages, no declaration', r && r.pages === 3 && !/DECLARATION OF GST NON-ENROLMENT/.test(r.text), r && { pages: r.pages });

  // ---------- 4. it stays as it was saved ----------
  must('rename', await api('saveVendor', { oldName: 'Siddhappa Test Basbire', name: 'Siddhappa Renamed Basbire', gstReg: 'Yes', gst: '27ABCPE1234S1Z5', gstPct: 18, pan: 'ABCPE1234S', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'edit')); await wait(1500);
  const nowName = sql("select vendor_name from bills where data::json->>'gstDecl' = 'true' and vendor_name in " + NAMES);
  r = await savedPrint(nowName || 'Siddhappa', 'saved_after_rename');
  ok('4. the party renamed AND made GST registered afterwards: the saved bill still prints its declaration, in the name the bill was made in', r && r.pages === 5 && /I\/We Siddhappa Test Basbire ?, do hereby declare/.test(r.text) && !/I\/We Siddhappa Renamed/.test(r.text), r ? { pages: r.pages, bill_listed_as: nowName } : 'no print');

  // ---------- 5. a bill saved before this update (no mark in it) ----------
  sql("update bills set data = (data::jsonb - 'gstDecl')::text where vendor_name in " + NAMES); await wait(2500);
  r = await savedPrint(nowName || 'Siddhappa', 'old1'); const r5 = await savedPrint('Gst Vendor Pvt', 'old2');
  ok('5. bills saved BEFORE this update (no mark): the one whose saved vendor has no GST number gets the declaration, the GST one does not', r && r.pages === 5 && /DECLARATION OF GST NON-ENROLMENT/.test(r.text) && r5 && r5.pages === 3 && !/DECLARATION/.test(r5.text), { without_gst_pages: r && r.pages, with_gst_pages: r5 && r5.pages });
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
