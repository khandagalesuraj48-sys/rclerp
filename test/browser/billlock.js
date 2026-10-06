// A submitted bill locks the Log Book and diesel entries of its machinery for its dates (rule of 06-10-2026). Through the page and the
// real database: the lists mark the entries, Edit / Delete says why and what to do, the server refuses every way in, nothing changes
// in the database; the Admin deletes the bill → the same edit goes through.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 640) : '')); };
const clean = () => sql("delete from bills where vendor_name = 'Lock Vendor P'; delete from log_book where machinery like 'KLX-%'; delete from diesel_issue where machinery like 'KLX-%'; delete from boq where vendor_name = 'Lock Vendor P'; delete from master where id like 'KLX-%'; delete from vendors where vendor_name = 'Lock Vendor P';");
const snap = () => sql("select coalesce((select string_agg(id || ' ' || opening_km::float || '>' || closing_km::float || ' d' || coalesce(diesel_qty,0)::float || ' ' || coalesce(work_done,''), ' | ' order by id) from log_book where machinery like 'KLX-%'), '') || ' || ' || coalesce((select string_agg(machinery || ' ' || issue_date || ' ' || qty::float, ' | ' order by id) from diesel_issue where machinery like 'KLX-%'), '')");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const must = (n, r) => { if (!r || r.ERROR || r.ok === false) out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
  const mach = no => ({ no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Lock Vendor P', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' });
  must('m1', await api('saveMaster', mach('KLX-1'), 'add')); must('m2', await api('saveMaster', mach('KLX-2'), 'add'));
  must('vendor', await api('saveVendor', { name: 'Lock Vendor P', gstReg: 'No', pan: 'ABCPE1234K', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add'));
  must('boq', await api('saveBoq', { vendor: 'Lock Vendor P', from: '2026-08-01', tdsPct: 2, woNo: 'WO-KL', lines: [{ no: 'KLX-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }, { no: 'KLX-2', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add'));
  const rows = [{ date: '2026-08-31', shift: 'Full Day', no: 'KLX-1', mode: 'KM', openingKm: 960, closingKm: 1000 }];
  for (let d = 1; d <= 5; d++) rows.push({ date: '2026-09-0' + d, shift: 'Full Day', no: 'KLX-1', mode: 'KM', closingKm: 1000 + d * 40, work: 'carting' });
  rows.push({ date: '2026-10-01', shift: 'Full Day', no: 'KLX-1', mode: 'KM', closingKm: 1240 }, { date: '2026-10-01', shift: 'Full Day', no: 'KLX-2', mode: 'KM', openingKm: 500, closingKm: 540 });
  must('log', await api('saveLogRows', { rows: rows }));
  must('diesel', await api('saveDieselIssue', { date: '2026-09-03', shift: 'Day', source: 'Dispenser', no: 'KLX-1', qty: 10, kmReading: 1080, force: true }));
  const co = ((await api('billInit')).companies || ['Rachana Construction Limited'])[0];

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  b.on('targetcreated', async t => { try { if (t.type() === 'page') { const w = await t.page(); if (w && w !== p) { await wait(1500); await w.close(); } } } catch (e) {} });      // (print windows are closed: not the subject here)
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_fix_lang', 'mr'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  const said = () => f.evaluate(() => { const t = document.getElementById('toast'), fx = document.getElementById('fixbox'); return { toast: t && !t.hidden ? t.textContent : '', advice: fx && !fx.hidden ? fx.textContent.replace(/\s+/g, ' ') : '' }; });
  const hush = () => f.evaluate(() => { const t = document.getElementById('toast'), fx = document.getElementById('fixbox'); if (t) t.hidden = true; if (fx) fx.hidden = true; });

  // ---------- before the bill: everything can be edited ----------
  const open0 = await api('getLogBookList', { from: '2026-08-01', to: '2026-10-31', no: 'KLX-1', all: true });
  ok('before the bill: no entry is marked as locked', (open0.rows || []).length === 7 && !(open0.rows || []).some(r => r.lk), { entries: (open0.rows || []).length });

  // ---------- the bill of September (KLX-1 only) is built and submitted on the page ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
  await f.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /Lock Vendor P/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-05'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co).catch(e => out.push('bill load: ' + String(e.message).slice(0, 120)));
  for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await f.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
  await f.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const no = tr.querySelector('.mb-no'); if (no && !no.value) { no.value = '61'; no.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(900);
  await f.evaluate(() => document.getElementById('mb_abstract').click());
  for (let i = 0; i < 50; i++) { await wait(500); await yes(); if (sql("select count(*) from bills where vendor_name = 'Lock Vendor P' and status = 'Active'") === '1') break; }
  ok('the bill RA Bill 61 of September is submitted', sql("select bill_no || ' ' || period_from || '..' || period_to || ' ' || status from bills where vendor_name = 'Lock Vendor P'") === '61 2026-09-01..2026-09-30 Active', sql("select bill_no || ' ' || period_from || '..' || period_to || ' ' || status from bills where vendor_name = 'Lock Vendor P'"));
  await wait(2500); await hush();
  const before = snap();

  // ---------- 1. Log Book list ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('log'); }); await wait(2000);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-08-01'; document.getElementById('lf_to').value = '2026-10-31'; const n = document.getElementById('lf_no'); n.value = 'KLX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(3000);
  const marks = await f.evaluate(() => [...document.querySelectorAll('#l_rows tr')].map(tr => (tr.children[0] ? tr.children[0].textContent.trim() : '') + (tr.querySelector('.tag.lk') ? ' [' + tr.querySelector('.tag.lk').textContent.trim() + ']' : '')).filter(Boolean).sort());
  ok('1. Log Book list: the five entries of September carry the mark "RA Bill 61"; 31 Aug and 1 Oct do not', JSON.stringify(marks) === JSON.stringify(['01-09-2026 [RA Bill 61]', '01-10-2026', '02-09-2026 [RA Bill 61]', '03-09-2026 [RA Bill 61]', '04-09-2026 [RA Bill 61]', '05-09-2026 [RA Bill 61]', '31-08-2026']), marks);
  await f.evaluate(() => { const tr = [...document.querySelectorAll('#l_rows tr')].find(r => /^03-09-2026/.test(r.textContent.trim())); tr.querySelector('[data-ledit]').click(); }); await wait(2500);
  let s = await said(); const editOpen = await f.evaluate(() => !document.getElementById('le_back').hidden);
  ok('   Edit on 03-09: the edit window does NOT open; the red line says why (in Marathi first) and names the bill', !editOpen && /submit झालेल्या bill मध्ये आहे/.test(s.toast) && /Log Book entry of KLX-1 on 03-09-2026: this machinery is in the submitted RA Bill 61 of Lock Vendor P/.test(s.toast), s.toast.slice(0, 330));
  ok('   …and the card says what to do: Admin deletes the bill → correct → build and submit again', /काय करायचे/.test(s.advice) && /Admin ला ते bill delete करायला सांगा \(RCL Drive → Saved Bills → Delete/.test(s.advice) && /पुन्हा Build करून submit करा/.test(s.advice), s.advice.slice(0, 420));
  await p.screenshot({ path: '/home/claude/test/shots/billlock_list.png' });
  await hush();
  await f.evaluate(() => { const tr = [...document.querySelectorAll('#l_rows tr')].find(r => /^04-09-2026/.test(r.textContent.trim())); tr.querySelector('[data-ldel]').click(); }); await wait(2500);
  s = await said(); const asked = await f.evaluate(() => !document.getElementById('cf_back').hidden);
  ok('   Delete on 04-09: no "Delete?" question – the same warning; the entry is still in the database', !asked && /is in the submitted RA Bill 61/.test(s.toast) && snap() === before, s.toast.slice(0, 160));
  await hush();

  // ---------- 2. Diesel Issue list ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('diesel'); }); await wait(2500);
  const dmark = await f.evaluate(() => { const tr = [...document.querySelectorAll('#d_rows tr')].find(r => /KLX-1/.test(r.textContent)); if (!tr) return null; const res = { tag: (tr.querySelector('.tag.lk') || { textContent: '' }).textContent.trim() }; tr.querySelector('[data-dedit]').click(); return res; }); await wait(1500);
  s = await said(); const dEdit = await f.evaluate(() => ({ editing: S.editDieselId, title: document.getElementById('d_title').textContent }));
  ok('2. Diesel Issue list: the issue of 03-09 carries the mark; Edit does not open it – warning with the way out', dmark && dmark.tag === 'RA Bill 61' && !dEdit.editing && /Diesel issue of KLX-1 on 03-09-2026: this machinery is in the submitted RA Bill 61/.test(s.toast) && /काय करायचे/.test(s.advice), { tag: dmark && dmark.tag, form: dEdit.title, toast: s.toast.slice(0, 200) });
  await hush();
  await f.evaluate(() => { const tr = [...document.querySelectorAll('#d_rows tr')].find(r => /KLX-1/.test(r.textContent)); tr.querySelector('[data-ddel]').click(); }); await wait(2000);
  s = await said();
  ok('   Delete: the same warning, the issue stays', /is in the submitted RA Bill 61/.test(s.toast) && snap() === before && !(await f.evaluate(() => !document.getElementById('cf_back').hidden)), s.toast.slice(0, 120));
  await hush();

  // ---------- 3. Edit Log Book ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = '2026-08-25'; document.getElementById('lx_to').value = '2026-10-05'; const n = document.getElementById('lx_no'); n.value = 'KLX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('lx_load').click(); }); await wait(3500);
  const gridState = await f.evaluate(() => ({ note: document.getElementById('lx_lock').hidden ? '' : document.getElementById('lx_lock').textContent.replace(/\s+/g, ' '),
    rows: [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)], ins = [...tr.querySelectorAll('input, select')]; return showDate(r.date).slice(0, 5) + (ins.every(x => x.disabled) ? ' LOCKED' : ins.some(x => x.disabled) ? ' part' : ' open') + (tr.querySelector('.tag.lk') ? ' tag' : '') + (getComputedStyle(tr.querySelector('button.del')).visibility === 'hidden' ? ' no-del' : ''); }) }));
  ok('3. Edit Log Book (25-08 to 05-10): a note above the grid names the bill and the way out; the September rows are read-only (no typing, no ×), 31-08 and 01-10 are open',
    /01-09-2026 to 30-09-2026 are in the submitted RA Bill 61/.test(gridState.note) && /To correct them: the Admin deletes that bill/.test(gridState.note) && JSON.stringify(gridState.rows) === JSON.stringify(['31-08 open', '01-09 LOCKED tag no-del', '02-09 LOCKED tag no-del', '03-09 LOCKED tag no-del', '04-09 LOCKED tag no-del', '05-09 LOCKED tag no-del', '01-10 open']), gridState);
  await p.screenshot({ path: '/home/claude/test/shots/billlock_grid.png' });
  // "+ Add row" / "Add all missing dates": no row for a date of the bill
  await f.evaluate(() => document.getElementById('lx_fill').click()); await wait(600);
  const filled = await f.evaluate(() => LX.rows.filter(r => r.isNew).map(r => r.date));
  ok('   "Add all missing dates": rows only for dates outside the bill (2 to 4 Oct would be after the last entry – none inside September)', !filled.some(d => d >= '2026-09-01' && d <= '2026-09-30'), filled);
  await f.evaluate(() => { LX.rows = LX.rows.filter(r => !r.isNew); lxRender(); }); await wait(300);
  // an open row of the same grid is changed and saved: allowed, the billed rows stay as they are
  await f.evaluate(() => { const i = LX.rows.findIndex(r => r.date === '2026-10-01'); const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="ckm"]'); el.value = '1250'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  await f.evaluate(() => document.getElementById('lx_save').click()); for (let i = 0; i < 30; i++) { await wait(500); await yes(); if (/KLX-1\|2026-10-01\|Full Day 1200>1250/.test(snap())) break; } await wait(2000);
  const afterOct = snap();
  ok('   the entry of 01-10 (not in the bill) changed in the same grid and saved: only it changed in the database', /KLX-1\|2026-10-01\|Full Day 1200>1250/.test(afterOct) && afterOct.replace('1200>1250', '1200>1240') === before, afterOct.split(' | ').slice(-3));
  await hush();
  // the entry BEFORE the bill: its Close is the Start of the first billed entry – raising it is refused by the server
  await f.evaluate(() => { const i = LX.rows.findIndex(r => r.date === '2026-08-31'); const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="ckm"]'); el.value = '990'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  const linkKept = await f.evaluate(() => LX.rows.find(r => r.date === '2026-09-01').okm);
  await f.evaluate(() => document.getElementById('lx_save').click()); for (let i = 0; i < 14; i++) { await wait(500); await yes(); } s = await said();
  ok('   31-08 (before the bill) lowered to Close 990: the first billed entry keeps its Start 1000 in the grid; the save goes through (a gap, nothing of the bill moves)', linkKept === 1000 && /KLX-1\|2026-08-31\|Full Day 960>990/.test(snap()) && /KLX-1\|2026-09-01\|Full Day 1000>1040/.test(snap()), { start_of_01_09_in_grid: linkKept, toast: s.toast.slice(0, 120) });
  await hush();
  const base = snap();

  // ---------- 4. the server refuses every way in (as the Admin), nothing changes ----------
  const key = d => 'KLX-1|' + d + '|Full Day';
  const dId = sql("select id from diesel_issue where machinery = 'KLX-1'");
  const g = (await api('getLogEditData', 'KLX-1', '2026-08-25', '2026-10-05')).rows.map(r => ({ key: r.key, half: !!r.half, date: r.date, shift: r.shift, mode: r.mode || r.unit, openingKm: r.okm, closingKm: r.ckm, work: r.work || '' }));
  const tries = {
    'new Log Book entry on 10-09': await api('saveLogRows', { rows: [{ date: '2026-09-10', shift: 'Full Day', no: 'KLX-1', mode: 'KM', closingKm: 1210 }] }),
    'entry of 02-09 changed': await api('updateLogRow', key('2026-09-02'), { closingKm: 1085, work: 'x' }),
    'entry of 05-09 deleted': await api('deleteLogRow', key('2026-09-05')),
    'Edit Log Book: reading of 03-09 changed': await api('saveLogBulk', { no: 'KLX-1', from: '2026-08-25', to: '2026-10-05', deleted: [], rows: g.map(x => x.date === '2026-09-03' ? Object.assign({}, x, { closingKm: 1125 }) : x.date === '2026-09-04' ? Object.assign({}, x, { openingKm: 1125 }) : x) }),
    'Edit Log Book: 04-09 made a half day': await api('saveLogBulk', { no: 'KLX-1', from: '2026-08-25', to: '2026-10-05', deleted: [], rows: g.map(x => x.date === '2026-09-04' ? Object.assign({}, x, { half: true }) : x) }),
    'Edit Log Book: 05-09 deleted': await api('saveLogBulk', { no: 'KLX-1', from: '2026-08-25', to: '2026-10-05', deleted: [key('2026-09-05')], rows: g.filter(x => x.date !== '2026-09-05') }),
    'Edit Log Book: 31-08 raised to 1010 (the first billed entry would have to start there)': await api('saveLogBulk', { no: 'KLX-1', from: '2026-08-25', to: '2026-08-31', deleted: [], rows: g.filter(x => x.date === '2026-08-31').map(x => Object.assign({}, x, { closingKm: 1010 })) }),
    'new diesel issue on 04-09': await api('saveDieselIssue', { date: '2026-09-04', shift: 'Day', source: 'Dispenser', no: 'KLX-1', qty: 5, kmReading: 1120, force: true }),
    'diesel issue of 03-09 changed': await api('updateDieselIssue', dId, { date: '2026-09-03', shift: 'Day', source: 'Dispenser', no: 'KLX-1', qty: 99, kmReading: 1080, force: true }),
    'diesel issue of 03-09 deleted': await api('deleteDieselIssue', dId),
  };
  const notRefused = Object.keys(tries).filter(k => !/is in the submitted RA Bill 61 of Lock Vendor P/.test(JSON.stringify(tries[k])) || !/To correct them: the Admin deletes that bill/.test(JSON.stringify(tries[k])));
  ok('4. the server (asked directly, as the Admin): all ' + Object.keys(tries).length + ' ways of adding / changing / deleting inside the bill are refused with the way out', notRefused.length === 0, notRefused.length ? notRefused.map(k => k + ' → ' + JSON.stringify(tries[k]).slice(0, 160)) : Object.keys(tries));
  ok('   …and the database is exactly as before those tries', snap() === base, snap() === base ? 'identical' : snap());
  const free = [await api('saveLogRows', { rows: [{ date: '2026-10-02', shift: 'Full Day', no: 'KLX-1', mode: 'KM', closingKm: 1290 }] }), await api('saveLogRows', { rows: [{ date: '2026-10-02', shift: 'Full Day', no: 'KLX-2', mode: 'KM', closingKm: 580 }] }), await api('saveDieselIssue', { date: '2026-10-02', shift: 'Day', source: 'Dispenser', no: 'KLX-1', qty: 6, kmReading: 1250, force: true })];
  ok('   outside the bill everything works: KLX-1 on 02-10, KLX-2 (not in this bill\'s dates), diesel on 02-10', free.every(r => r && !r.ERROR && r.ok !== false), free.map(r => r && r.ERROR ? r.ERROR.slice(0, 80) : 'saved'));

  // ---------- 5. the Admin deletes the bill: the entry can be corrected ----------
  const billId = sql("select id from bills where vendor_name = 'Lock Vendor P'");
  must('delete bill', await api('deleteBill', billId, 'Log Book of 03-09 to be corrected'));
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('log'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-08-01'; document.getElementById('lf_to').value = '2026-10-31'; const n = document.getElementById('lf_no'); n.value = 'KLX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(3000);
  const marks2 = await f.evaluate(() => document.querySelectorAll('#l_rows .tag.lk').length);
  await f.evaluate(() => { const tr = [...document.querySelectorAll('#l_rows tr')].find(r => /^05-09-2026/.test(r.textContent.trim())); tr.querySelector('[data-ledit]').click(); }); await wait(2500);
  const open2 = await f.evaluate(() => !document.getElementById('le_back').hidden);
  await f.evaluate(() => { const c = document.getElementById('le_ckm'); c.value = '1205'; c.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('le_save').click(); }); for (let i = 0; i < 20; i++) { await wait(500); await yes(); if (/KLX-1\|2026-09-05\|Full Day 1160>1205/.test(snap())) break; }
  ok('5. the bill deleted by the Admin: the marks are gone, Edit opens, the correction of 05-09 is saved', marks2 === 0 && open2 && /KLX-1\|2026-09-05\|Full Day 1160>1205/.test(snap()), { marks: marks2, edit_window: open2, database: (snap().match(/KLX-1\|2026-09-05[^|]*\|[^|]*/) || [''])[0] });
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
