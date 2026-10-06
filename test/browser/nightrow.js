// Edit Log Book: a second entry for a date (the forgotten Night), full or half by the tick; the shift of a saved entry can be changed.
// Through the page and the real database: grid → Save → database rows, diesel by shift, the debit-note link, the bill.
// Also (before / after, the live code on port 3002 against this code on 3001): a row deleted and entered again in ONE save.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 520) : '')); };
const clean = () => sql("delete from bills where vendor_name in ('Night Vendor'); delete from debit_notes where vendor_name = 'Night Debit Party'; delete from log_book where machinery in ('NRX-1','NRX-0'); delete from diesel_issue where machinery in ('NRX-1','NRX-0'); delete from boq where vendor_name = 'Night Vendor'; delete from master where id in ('NRX-1','NRX-0'); delete from vendors where vendor_name in ('Night Vendor','Night Debit Party');");
const rowsOf = no => sql("select string_agg(to_char(date,'DD') || ' ' || shift || ' ' || opening_km::float || '>' || closing_km::float || ' dsl ' || coalesce(diesel_qty,0)::float || case when day_part is not null then ' part ' || day_part::float else '' end, ' | ' order by date, case shift when 'Night' then 2 else 1 end) from log_book where machinery = '" + no + "'");
const idsOf = no => sql("select string_agg(id, ' , ' order by id) from log_book where machinery = '" + no + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const mk = port => { let tk = ''; const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
    return async (fn, ...a) => { if (!tk) tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token; const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; }; };
  const api = mk(3001), old = mk(3002);
  const must = (n, r) => { if (!r || r.ERROR || r.ok === false) { out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); } return r; };
  const mach = no => ({ no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: 'Night Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' });
  must('machinery', await api('saveMaster', mach('NRX-1'), 'add')); must('machinery 0', await api('saveMaster', mach('NRX-0'), 'add'));
  must('vendor', await api('saveVendor', { name: 'Night Vendor', gstReg: 'No', pan: 'ABCDE1234N', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add')); must('party', await api('saveVendor', { name: 'Night Debit Party', gstReg: 'No' }, 'add'));
  must('boq', await api('saveBoq', { vendor: 'Night Vendor', from: '2026-09-01', tdsPct: 0, woNo: 'WO-NR', lines: [{ no: 'NRX-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }, { no: 'NRX-0', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add'));

  // ================= A. before / after: a row deleted and entered again in one save =================
  const seed0 = async () => { sql("delete from log_book where machinery = 'NRX-0'"); await wait(300); return must('log 0', await api('saveLogRows', { rows: [{ date: '2026-09-21', shift: 'Day', no: 'NRX-0', mode: 'KM', openingKm: 500, closingKm: 540 }, { date: '2026-09-22', shift: 'Day', no: 'NRX-0', mode: 'KM', closingKm: 590 }] })); };
  const again = async srv => { const g = (await srv('getLogEditData', 'NRX-0', '2026-09-21', '2026-09-24')).rows; const k22 = g.find(x => x.date === '2026-09-22').key;
    const rows = g.filter(x => x.date !== '2026-09-22').map(r => ({ key: r.key, half: !!r.half, date: r.date, shift: r.shift, mode: r.mode || r.unit, openingKm: r.okm, closingKm: r.ckm, work: r.work || '' }));
    rows.push({ key: '', date: '2026-09-22', shift: 'Day', mode: 'KM', openingKm: 540, closingKm: 600 });
    return srv('saveLogBulk', { no: 'NRX-0', from: '2026-09-21', to: '2026-09-24', rows: rows, deleted: [k22] }); };
  await seed0(); let r = await again(old); await wait(400); const before = rowsOf('NRX-0');
  await seed0(); const r2 = await again(api); await wait(400); const after = rowsOf('NRX-0');
  // (the code on :3002 – before update-60 it LOST the 22nd; from update-60 on it keeps it: both are named, neither fails the run)
  ok('the code on :3002, the 22nd deleted and entered again in one save: ' + (before === '21 Day 500>540 dsl 0' ? 'the database has LOST the 22nd (code before update-60)' : 'the 22nd is kept (update-60 or later)'), r && r.ok === true && (before === '21 Day 500>540 dsl 0' || before === '21 Day 500>540 dsl 0 | 22 Day 540>600 dsl 0'), { answer: r && r.ERROR ? r.ERROR : { ok: r.ok, added: r.added, deleted: r.deleted }, database: before });
  ok('AFTER (this update): the same save keeps the 22nd, with the new reading', (r2 && r2.ok === true) && after === '21 Day 500>540 dsl 0 | 22 Day 540>600 dsl 0', { answer: r2 && r2.ERROR ? r2.ERROR : { ok: r2.ok, added: r2.added, deleted: r2.deleted }, database: after });

  // ================= B. the month as it was entered =================
  must('log', await api('saveLogRows', { rows: [{ date: '2026-09-21', shift: 'Day', no: 'NRX-1', mode: 'KM', openingKm: 1000, closingKm: 1084 }, { date: '2026-09-22', shift: 'Full Day', no: 'NRX-1', mode: 'KM', closingKm: 1167, debitTo: 'Night Debit Party', debitRate: 40 }, { date: '2026-09-23', shift: 'Day', no: 'NRX-1', mode: 'KM', closingKm: 1229 }, { date: '2026-09-24', shift: 'Day', no: 'NRX-1', mode: 'KM', closingKm: 1300 }] }));
  must('diesel day', await api('saveDieselIssue', { date: '2026-09-22', shift: 'Day', source: 'Dispenser', no: 'NRX-1', qty: 30, kmReading: 1084, force: true }));
  must('diesel night', await api('saveDieselIssue', { date: '2026-09-22', shift: 'Night', source: 'Dispenser', no: 'NRX-1', qty: 20, kmReading: 1167, force: true }));
  const co = ((await api('billInit')).companies || ['Rachana Construction Limited'])[0];
  must('debit note', await api('saveDebitNote', { company: co, vendor: 'Night Debit Party', date: '2026-09-25', from: '2026-09-01', to: '2026-09-30', lines: [{ logId: 'NRX-1|2026-09-22|Full Day', machinery: 'NRX-1', particular: 'Tipper work', qty: 83, unit: 'KM', rate: 40 }] }));
  const start = rowsOf('NRX-1');
  ok('start: 21 Day, 22 Full Day (holds the day\'s and the night\'s diesel: 50 L), 23 Day, 24 Day', start === '21 Day 1000>1084 dsl 0 | 22 Full Day 1084>1167 dsl 50 | 23 Day 1167>1229 dsl 0 | 24 Day 1229>1300 dsl 0', start);

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  const toastNow = () => f.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent.trim() : ''; });
  const grid = () => f.evaluate(() => [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const g = k => { const i = tr.querySelector('[data-f="' + k + '"]'); return i ? i.value : null; }; const r = LX.rows[Number(tr.dataset.i)];
    return showDate(r.date).slice(0, 2) + ' ' + (tr.querySelector('select[data-f="shift"]') ? g('shift') : 'TEXT') + (tr.querySelector('.tag.n') ? ' NEW' : tr.querySelector('.tag.c') ? ' CHANGED' : '') + ' ' + g('okm') + '>' + g('ckm') + ' issued ' + tr.querySelector('.is').textContent.trim() + ' [' + tr.querySelector('.lg-half').textContent.trim() + (tr.querySelector('[data-f="half"]').checked ? ' ✓' : '') + ']' + (tr.classList.contains('bad') ? ' RED' : ''); }));
  const open = async (from, to) => { await f.evaluate((from, to) => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = from; document.getElementById('lx_to').value = to; const n = document.getElementById('lx_no'); n.value = 'NRX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('lx_load').click(); }, from, to); await wait(3000); };
  const rowI = (dd, sh) => f.evaluate((dd, sh) => LX.rows.findIndex(r => r.date === '2026-09-' + dd && r.shift === sh), dd, sh);
  const setF = (i, k, v, ev) => f.evaluate((i, k, v, ev) => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="' + k + '"]'); if (el.type === 'checkbox') el.checked = v; else el.value = v; (ev || ['input', 'change']).forEach(n => el.dispatchEvent(new Event(n, { bubbles: true }))); }, i, k, v, ev || null);
  const tickRow = i => f.evaluate(i => { const c = document.querySelector('#lx_rows tr[data-i="' + i + '"] .lx-sel'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }, i);
  const save = async until => { const said = []; await f.evaluate(() => document.getElementById('lx_save').click()); for (let i = 0; i < 40; i++) { await wait(500); const t = await toastNow(); if (t && said.indexOf(t) < 0) said.push(t); await yes(); if (until()) break; } await wait(2500); return said; };
  const sumNow = () => f.evaluate(() => ({ sum: document.getElementById('lx_sum').textContent.replace(/\s+/g, ' ').trim(), save: document.getElementById('lx_save').disabled ? 'off' : 'on', notes: [...document.querySelectorAll('#lx_rows .lx-slot')].map(x => x.textContent) }));

  // ---------- 1. the grid; "+ Add row" with nothing ticked and no date missing ----------
  await open('2026-09-21', '2026-09-24');
  let g = await grid();
  ok('1. Edit Log Book: the Shift of every saved row is a list now (it was fixed text)', g.length === 4 && g.every(x => !/TEXT/.test(x)), g);
  await f.evaluate(() => document.getElementById('lx_add').click()); await wait(500);
  let t = await toastNow();
  ok('   "+ Add row" with nothing ticked and no date missing: says how to add a Night', /tick its row/.test(t) && (await grid()).length === 4, t);

  // ---------- 2. the forgotten nights: tick 21 and 22, "+ Add row" ----------
  await tickRow(await rowI('21', 'Day')); await tickRow(await rowI('22', 'Full Day'));
  await f.evaluate(() => document.getElementById('lx_add').click()); await wait(700);
  t = await toastNow(); g = await grid();
  ok('2. rows of 21 and 22 ticked, "+ Add row": a Night row under each, starting and closing at that date\'s Close (0 km); the Full Day entry of the 22nd became Day; the diesel is shown by shift (30 / 20)',
    g.join(' | ') === '21 Day 1000>1084 issued 0 [½ day] | 21 Night NEW 1084>1084 issued 0 [½ night] | 22 Day CHANGED 1084>1167 issued 30 [½ day] | 22 Night NEW 1167>1167 issued 20 [½ night] | 23 Day 1167>1229 issued 0 [½ day] | 24 Day 1229>1300 issued 0 [½ day]', { rows: g, toast: t });
  await setF(await rowI('22', 'Night'), 'half', true, ['change']); await wait(400);
  await p.screenshot({ path: '/home/claude/test/shots/nightrow.png', clip: { x: 0, y: 0, width: 1536, height: 760 } });
  let said = await save(() => /2026-09-22\|Night/.test(idsOf('NRX-1')));
  let db = rowsOf('NRX-1');
  ok('   saved – database: 21 Night (full), 22 Day (30 L) + 22 Night HALF (20 L, 0.5); nothing else moved',
    db === '21 Day 1000>1084 dsl 0 | 21 Night 1084>1084 dsl 0 | 22 Day 1084>1167 dsl 30 | 22 Night 1167>1167 dsl 20 part 0.5 | 23 Day 1167>1229 dsl 0 | 24 Day 1229>1300 dsl 0', { database: db, said: said });
  const ids = idsOf('NRX-1');
  ok('   the Full Day entry is now stored as Day (one row, not two)', ids === 'NRX-1|2026-09-21|Day , NRX-1|2026-09-21|Night , NRX-1|2026-09-22|Day , NRX-1|2026-09-22|Night , NRX-1|2026-09-23|Day , NRX-1|2026-09-24|Day', ids);
  const dn = sql("select log_ids::text || ' / ' || (lines::jsonb -> 0 ->> 'logId') from debit_notes where vendor_name = 'Night Debit Party'");
  ok('   the debit note that holds the 22nd still points at it (its key moved with it)', /NRX-1\|2026-09-22\|Day/.test(dn) && !/Full Day/.test(dn), dn);
  const pend = await api('getDebitPending', { vendor: 'Night Debit Party', from: '2026-09-01', to: '2026-09-30' });
  ok('   …so the 22nd is not offered for a second debit note', pend && (pend.rows || []).length === 0, { pending: (pend.rows || []).length, already: pend.already });

  // ---------- 3. the bill ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
  await f.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /Night Vendor/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co).catch(e => out.push('bill load: ' + String(e.message).slice(0, 120)));
  for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await f.evaluate(() => (S.mb.bills || []).length > 0)) break; }
  const m = await f.evaluate(() => { const bb = (S.mb.bills || []).find(x => /Night Vendor/.test(x.vendor.name)); if (!bb) return null; const x = bb.machines.find(y => y.no === 'NRX-1'); return x ? { workDays: x.workDays, nights: x.nights, amount: x.amount } : null; });
  ok('3. the bill: 4 days + 1 night + ½ night = 5.5 × ₹1,000 = ₹5,500 (before the nights: 4 days = ₹4,000)', m && m.workDays === 4 && m.nights === 1.5 && m.amount === 5500, m);

  // ---------- 4. the work shared between day and night ----------
  await open('2026-09-21', '2026-09-24');
  await setF(await rowI('22', 'Day'), 'ckm', '1140', ['input']); await wait(400);
  g = await grid();
  ok('4. the Day\'s Close of the 22nd lowered to 1140: the Night\'s Start follows it by itself (1140 → 1167 = 27 km in the night)', g[2] === '22 Day CHANGED 1084>1140 issued 30 [½ day]' && g[3] === '22 Night CHANGED 1140>1167 issued 20 [½ night ✓]', g.slice(2, 4));
  said = await save(() => /1084>1140/.test(rowsOf('NRX-1')));
  db = rowsOf('NRX-1');
  ok('   saved – database: 22 Day 1084>1140, 22 Night 1140>1167 (still half), the 23rd still starts at 1167', /22 Day 1084>1140 dsl 30 \| 22 Night 1140>1167 dsl 20 part 0\.5 \| 23 Day 1167>1229/.test(db), db);

  // ---------- 5. the rule of a date, shown in the grid ----------
  await setF(await rowI('21', 'Night'), 'shift', 'Day', ['change']); await wait(500);
  let s = await sumNow(); g = await grid();
  ok('5. two entries of one date on the same shift: both rows red with the reason, Save is off', g.filter(x => /^21 /.test(x)).every(x => / RED$/.test(x)) && s.save === 'off' && s.notes.length === 2 && /two entries on Day/.test(s.notes[0]), { rows: g.slice(0, 2), note: s.notes[0], sum: s.sum });
  await setF(await f.evaluate(() => LX.rows.findIndex(r => r.date === '2026-09-21' && r.key && /Night$/.test(r.key))), 'shift', 'Full Day', ['change']); await wait(500);
  s = await sumNow();
  ok('   a Full Day entry next to another entry of the date: red, "a Full Day entry stands alone"', s.save === 'off' && s.notes.length === 2 && /Full Day entry stands alone/.test(s.notes.join(' ')), s.notes);
  await setF(await f.evaluate(() => LX.rows.findIndex(r => r.date === '2026-09-21' && r.key && /Night$/.test(r.key))), 'shift', 'Night', ['change']); await wait(500);
  s = await sumNow();
  ok('   put back to Night: clean again, nothing to save', s.notes.length === 0 && /No changes yet/.test(s.sum), s.sum);

  // ---------- 6. the shift of a saved entry changed ----------
  await setF(await rowI('23', 'Day'), 'shift', 'Night', ['change']); await wait(500);
  g = await grid();
  ok('6. the saved entry of the 23rd changed from Day to Night in the grid', /^23 Night CHANGED 1167>1229 issued 0 \[½ night\]$/.test(g[4]), g[4]);
  said = await save(() => /2026-09-23\|Night/.test(idsOf('NRX-1')));
  ok('   saved – database: the 23rd is a Night entry (same readings), the Day row is gone, six rows as before', /23 Night 1167>1229 dsl 0 \| 24 Day 1229>1300/.test(rowsOf('NRX-1')) && !/2026-09-23\|Day/.test(idsOf('NRX-1')) && idsOf('NRX-1').split(' , ').length === 6, rowsOf('NRX-1'));

  // ---------- 7. a row deleted and entered again in one save (through the page) ----------
  await f.evaluate(i => document.querySelector('#lx_rows tr[data-i="' + i + '"] .del').click(), await rowI('24', 'Day')); await wait(500);
  await f.evaluate(() => document.getElementById('lx_add').click()); await wait(600);
  let i24 = await f.evaluate(() => LX.rows.findIndex(r => r.date === '2026-09-24'));
  await setF(i24, 'shift', 'Day', ['change']); await wait(400); i24 = await f.evaluate(() => LX.rows.findIndex(r => r.date === '2026-09-24'));
  await setF(i24, 'ckm', '1310', ['input']); await wait(400);
  s = await sumNow();
  said = await save(() => /1229>1310/.test(rowsOf('NRX-1')) || !/24 Day/.test(rowsOf('NRX-1')));
  ok('7. the 24th deleted and entered again (Close 1310) in one save: it is in the database with the new reading', /24 Day 1229>1310 dsl 0$/.test(rowsOf('NRX-1')), { before_save: s.sum, database: rowsOf('NRX-1').split(' | ').slice(-2), said: said });

  // ---------- 8. half night → full night ----------
  await setF(await rowI('22', 'Night'), 'half', false, ['change']); await wait(400);
  said = await save(() => !/part 0\.5/.test(rowsOf('NRX-1')));
  ok('8. the tick "½ night" taken off and saved: a full night in the database', /22 Night 1140>1167 dsl 20 \| 23/.test(rowsOf('NRX-1')), rowsOf('NRX-1'));

  // ---------- 9. on a phone-size screen ----------
  await p.setViewport({ width: 390, height: 800 }); await wait(900);
  await open('2026-09-21', '2026-09-24');
  const ph = await f.evaluate(() => { const sel = document.querySelector('#lx_rows select[data-f="shift"]'), bx = sel.getBoundingClientRect(), ad = document.getElementById('lx_add').getBoundingClientRect(); return { shiftBox: Math.round(bx.width) + '×' + Math.round(bx.height), addBtn: Math.round(ad.width) + '×' + Math.round(ad.height) }; });
  await tickRow(await rowI('24', 'Day')); await f.evaluate(() => document.getElementById('lx_add').click()); await wait(600);
  g = await grid();
  ok('9. phone-size screen (390 px): the shift list and "+ Add row" are there; ticking the 24th and "+ Add row" adds its Night', parseInt(ph.shiftBox) > 50 && parseInt(ph.addBtn) > 50 && /^24 Night NEW 1310>1310/.test(g[g.length - 1]), { sizes: ph, last: g[g.length - 1] });
  await p.screenshot({ path: '/home/claude/test/shots/nightrow_phone.png' });
  await f.evaluate(() => { S.formDirty = false; LX.rows = []; LX.deleted = []; });
  ok('no page error in the whole run', errs.length === 0, errs);
  await b.close();
  try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
