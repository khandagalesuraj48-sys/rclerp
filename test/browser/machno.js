// Asset Master: changing a Machinery Number – through the real server, the real database (key changes and all) and the page.
// Needs the local rig (database + its web layer + two copies of the server on 3000 / 3001).
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const { execSync } = require('child_process');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 520) : '')); };
const NOS = "('ZR-1','ZR-9','ZR-GONE','MH-12-ZR-1234','ZR-PAGE','ZR-PAGE-2')";
const clean = () => sql(`delete from debit_notes where vendor_name = 'Debit Party N'; delete from bills where vendor_name = 'Number Vendor'; delete from boq where vendor_name = 'Number Vendor';
  delete from log_book where machinery in ${NOS}; delete from diesel_issue where machinery in ${NOS}; delete from tank_check where machinery in ${NOS}; delete from breakdowns where machinery_no in ${NOS};
  delete from compliance_history where machinery_no in ${NOS}; delete from breakdown_reports where id = '2026-09-12'; delete from master where id in ${NOS}; delete from vendors where vendor_name in ('Number Vendor', 'Debit Party N'); delete from diesel_inward where bill_number = 'ZR-IN';`);
const snap = no => { const k = `upper(regexp_replace(%s, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace('${no}', '[^A-Za-z0-9]', '', 'g'))`, w = c => k.replace('%s', c);
  return sql(`select json_build_object('master', (select count(*) from master where ${w('id')}), 'diesel', (select count(*) from diesel_issue where ${w('machinery')}), 'log', (select count(*) from log_book where ${w('machinery')}),
    'logIds', (select coalesce(json_agg(id order by id), '[]') from log_book where ${w("split_part(id, '|', 1)")}), 'tank', (select count(*) from tank_check where ${w('machinery')}), 'bd', (select count(*) from breakdowns where ${w('machinery_no')}),
    'papers', (select count(*) from compliance_history where ${w('machinery_no')}), 'boq', (select count(*) from boq where lines like '%"no":"${no}"%'), 'register', (select count(*) from breakdown_reports where details like '%"no":"${no}"%'),
    'billPaper', (select count(*) from bills where data like '%"no":"${no}"%'), 'billLink', (select count(*) from bills where data like '%"noNow":"${no}"%'), 'dnLink', (select count(*) from debit_notes where log_ids like '%"${no}|%'), 'dnPaper', (select count(*) from debit_notes where lines like '%"machinery":"${no}"%'))`); };
(async () => {
  clean();
  const post = (port, body) => fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const tk = (await post(3001, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post(3001, { fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const api0 = async (fn, ...a) => { const r = await post(3000, { fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };      // the OTHER server (it did not make the change)
  const must = (name, r) => { if (!r || r.ERROR || r.ok === false) out.push('setup ' + name + ': ' + JSON.stringify(r).slice(0, 260)); return r; };
  const mach = (no, more) => Object.assign({ no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'Number Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, more || {});
  must('master', await api('saveMaster', mach('ZR-1', { taxUpto: '2026-12-31' }), 'add')); must('master 9', await api('saveMaster', mach('ZR-9'), 'add'));
  must('vendor', await api('saveVendor', { name: 'Number Vendor', gstReg: 'No', pan: 'ABCDE1234N', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add')); must('party', await api('saveVendor', { name: 'Debit Party N', gstReg: 'No' }, 'add'));
  must('boq', await api('saveBoq', { vendor: 'Number Vendor', from: '2026-09-01', tdsPct: 0, woNo: 'WO-ZR', lines: [{ no: 'ZR-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }, { no: 'ZR-9', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add'));
  must('inward', await api('saveInward', { date: '2026-09-01', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 100, billNo: 'ZR-IN', billDate: '2026-09-01' }));
  must('log', await api('saveLogRows', { rows: [{ date: '2026-09-10', shift: 'Full Day', no: 'ZR-1', mode: 'KM', openingKm: 1000, closingKm: 1100, debitTo: 'Debit Party N', debitRate: 50, work: 'carting' },
    { date: '2026-09-11', shift: 'Day', no: 'ZR-1', mode: 'KM', closingKm: 1180 }, { date: '2026-09-11', shift: 'Night', no: 'ZR-1', mode: 'KM', closingKm: 1200 }, { date: '2026-09-10', shift: 'Full Day', no: 'ZR-9', mode: 'KM', openingKm: 10, closingKm: 60 }] }));
  must('diesel 1', await api('saveDieselIssue', { date: '2026-09-10', shift: 'Day', source: 'Dispenser', no: 'ZR-1', qty: 40, kmReading: 1000, force: true }));
  must('diesel 2', await api('saveDieselIssue', { date: '2026-09-11', shift: 'Day', source: 'Dispenser', no: 'ZR-1', qty: 25, kmReading: 1100, force: true }));
  must('diesel 9', await api('saveDieselIssue', { date: '2026-09-10', shift: 'Day', source: 'Dispenser', no: 'ZR-9', qty: 10, kmReading: 10, force: true }));
  must('tank', await api('saveTankCheck', { date: '2026-09-11', no: 'ZR-1', method: 'measured', physical: 10, reason: 'test', by: 'T' }));
  must('register', await api('submitBdReport', { date: '2026-09-12', rows: [{ no: 'ZR-1', status: 'Breakdown', reason: 'Tyre' }, { no: 'ZR-9', status: 'Working' }] }));
  must('papers', await api('saveMaster', mach('ZR-1', { taxUpto: '2027-12-31' }), 'edit', 'ZR-1'));
  const co = ((await api('billInit')).companies || ['Rachana Construction Limited'])[0];
  const pend = must('pending', await api('getDebitPending', { vendor: 'Debit Party N', from: '2026-09-01', to: '2026-09-30' }));
  must('debit note', await api('saveDebitNote', { company: co, vendor: 'Debit Party N', date: '2026-09-12', from: '2026-09-01', to: '2026-09-30', lines: [{ logId: 'ZR-1|2026-09-10|Full Day', machinery: 'ZR-1', particular: 'Tipper work', qty: 100, unit: 'KM', rate: 50 }] }));
  sql(`insert into bills (id, vendor_name, company, bill_no, rev, period_from, period_to, status, net_payable, data) values ('BL-ZR1', 'Number Vendor', '${co}', '7', 0, '2026-09-01', '2026-09-30', 'Active', 1000, '{"B":0,"machines":[{"no":"ZR-1","workDays":2,"amount":2000},{"no":"ZR-9","workDays":1,"amount":1000}]}');
       insert into breakdowns (id, machinery_no, from_date, reason, status) values ('BD-ZR1', 'ZR-1', '2026-09-12', 'Tyre', 'Open');`);
  await wait(1500);
  const before = snap('ZR-1'), other = snap('ZR-9'), stock0 = (await api('getStock')).stock;
  ok('the test machinery is in every place a machinery can be named (database, before the change)', before === '{"master" : 1, "diesel" : 2, "log" : 3, "logIds" : ["ZR-1|2026-09-10|Full Day", "ZR-1|2026-09-11|Day", "ZR-1|2026-09-11|Night"], "tank" : 1, "bd" : 1, "papers" : 1, "boq" : 1, "register" : 1, "billPaper" : 1, "billLink" : 0, "dnLink" : 1, "dnPaper" : 1}' && pend.rows && pend.rows.length === 1, before);
  const rowBefore = sql("select opening_km::float || '|' || closing_km::float || '|' || debit_to || '|' || debit_rate::float || '|' || work_done || '|' || coalesce(entered_by, '') from log_book where id = 'ZR-1|2026-09-10|Full Day'");
  // ---------- refused ----------
  let r = await api('saveMaster', mach('ZR-9', { taxUpto: '2027-12-31' }), 'edit', 'ZR-1');
  ok('a number another machinery has is refused – nothing changes in the database', /ZR-9 is already in Master – two machinery cannot have the same Number/.test(r.ERROR || '') && snap('ZR-1') === before && snap('ZR-9') === other, r.ERROR);
  await api('saveMaster', mach('ZR-GONE'), 'add'); await api('saveLogRows', { rows: [{ date: '2026-09-10', shift: 'Full Day', no: 'ZR-GONE', mode: 'KM', openingKm: 5, closingKm: 9 }] }); await api('deleteMaster', 'ZR-GONE', true);
  r = await api('saveMaster', mach('ZR-GONE', { taxUpto: '2027-12-31' }), 'edit', 'ZR-1');
  ok('a number that still holds the entries of a machinery deleted from Asset Master is refused (the two would be joined) – nothing changes', /ZR-GONE already has records in the app \(1 Log Book entries\)/.test(r.ERROR || '') && snap('ZR-1') === before, r.ERROR);
  // ---------- the change ----------
  const del0 = Number(sql("select coalesce(max(seq), 0) from deleted_rows"));
  r = await api('saveMaster', mach('mh12zr1234', { taxUpto: '2027-12-31' }), 'edit', 'ZR-1');
  ok('ZR-1 → MH-12-ZR-1234 (typed without dashes): saved; the answer says what moved', r.renamed && r.renamed.from === 'ZR-1' && r.renamed.to === 'MH-12-ZR-1234' && r.renamed.text === '2 diesel issues, 3 Log Book entries, 1 tank checks, 1 breakdown records, 1 renewals of papers, 1 BOQs, 1 days of the breakdown register, 1 debit notes (link only), 1 saved bills (link only)', r.renamed || r);
  const a = snap('MH-12-ZR-1234'), gone = snap('ZR-1');
  ok('DATABASE: everything is under the new number – Master, diesel issues, Log Book entries (each on its new key), tank check, breakdown, papers, BOQ line, register; the links of the bill and the debit note', a === '{"master" : 1, "diesel" : 2, "log" : 3, "logIds" : ["MH-12-ZR-1234|2026-09-10|Full Day", "MH-12-ZR-1234|2026-09-11|Day", "MH-12-ZR-1234|2026-09-11|Night"], "tank" : 1, "bd" : 1, "papers" : 1, "boq" : 1, "register" : 1, "billPaper" : 0, "billLink" : 1, "dnLink" : 1, "dnPaper" : 0}', a);
  ok('DATABASE: nothing is left under the old number – except on the papers already issued (the saved bill and the debit note keep "ZR-1")', gone === '{"master" : 0, "diesel" : 0, "log" : 0, "logIds" : [], "tank" : 0, "bd" : 0, "papers" : 0, "boq" : 0, "register" : 0, "billPaper" : 1, "billLink" : 0, "dnLink" : 0, "dnPaper" : 1}', gone);
  const rowAfter = sql("select opening_km::float || '|' || closing_km::float || '|' || debit_to || '|' || debit_rate::float || '|' || work_done || '|' || coalesce(entered_by, '') from log_book where id = 'MH-12-ZR-1234|2026-09-10|Full Day'");
  ok('a moved Log Book entry holds exactly what it held (readings, debit to, work, who entered it)', rowAfter === rowBefore && /^1000\|1100\|Debit Party N\|50\|carting\|/.test(rowAfter), rowAfter);
  ok('the other machinery is untouched; the diesel stock is the same', snap('ZR-9') === other && (await api('getStock')).stock === stock0, { stock: stock0 });
  const noted = sql(`select string_agg(table_name || ':' || row_id, ', ' order by seq) from deleted_rows where seq > ${del0}`);
  ok('the old keys are noted as removed (so the Google Sheet backup drops the old rows and takes the new ones)', /master:ZR-1/.test(noted) && (noted.match(/log_book:ZR-1\|/g) || []).length === 3, noted);
  // ---------- the app after the change, asked on the OTHER server ----------
  await wait(2500);
  const l1 = await api0('getLogBookList', { from: '2026-09-01', to: '2026-09-30', no: 'MH-12-ZR-1234', all: true }), l0 = await api0('getLogBookList', { from: '2026-09-01', to: '2026-09-30', no: 'ZR-1', all: true });
  ok('the second server (which did not make the change) shows the 3 entries under the new number and no entry that still carries the old one', (l1.rows || []).length === 3 && (l0.rows || []).filter(x => x.no === 'ZR-1').length === 0 && l1.rows.every(x => x.no === 'MH-12-ZR-1234'), { underNew: (l1.rows || []).length, stillCarryingOld: (l0.rows || []).filter(x => x.no === 'ZR-1').length });
  const pf = await api0('getLogRowPrefill', 'MH-12-ZR-1234', '2026-09-12', 'Full Day'), old = await api0('getLogRowPrefill', 'ZR-1', '2026-09-12', 'Full Day');
  ok('the next entry carries on from the last Close (1200) under the new number; the old number is no longer known', pf.openingKm === 1200 && /"ZR-1" is not in Master/.test(old.ERROR || ''), { start: pf.openingKm, old: old.ERROR });
  const pend2 = await api0('getDebitPending', { vendor: 'Debit Party N', from: '2026-09-01', to: '2026-09-30' });
  ok('the entry that is in the debit note is still known to be in it (not offered for a second note)', pend2.rows && pend2.rows.length === 0 && pend2.already === 1, { rows: pend2.rows && pend2.rows.length, already: pend2.already });
  const act = sql("select string_agg(c, ' ## ') from (select row_to_json(t)::text c from activity_log t order by created_at desc limit 4) x");
  ok('the Activity Log says who changed the number, from what to what, and what moved', /Machinery number changed: ZR-1 → MH-12-ZR-1234 \(moved with it: 2 diesel issues, 3 Log Book entries/.test(act), (act.match(/Machinery number changed[^"]{0,160}/) || [''])[0]);
  // ---------- the page ----------
  must('page machinery', await api('saveMaster', mach('ZR-PAGE'), 'add')); must('page diesel', await api('saveDieselIssue', { date: '2026-09-10', shift: 'Night', source: 'Dispenser', no: 'ZR-PAGE', qty: 5, kmReading: 5, force: true }));
  const b = await puppeteer.launch({ executablePath: EXE, args: ['--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1500);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('master'); }); await wait(1500);
  await f.evaluate(() => editMaster('ZR-PAGE')); await wait(500);
  const form = await f.evaluate(() => ({ title: document.getElementById('m_title').textContent, no: document.getElementById('m_no').value, locked: document.getElementById('m_no').readOnly || document.getElementById('m_no').disabled }));
  ok('PAGE: Edit opens the machinery and the Machinery Number box can be typed in', form.no === 'ZR-PAGE' && form.locked === false, form);
  await f.evaluate(() => { const i = document.getElementById('m_no'); i.focus(); i.select(); }); await p.keyboard.type('ZR-PAGE-2'); await wait(200);
  await f.evaluate(() => document.getElementById('m_save').click()); await wait(900);
  const box = await f.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? { text: c.textContent.replace(/\s+/g, ' ').trim(), okBtn: document.getElementById('cf_ok').textContent } : null; });
  ok('PAGE: before saving, a box says plainly what a number change does and lists the change', box && /known as ZR-PAGE today and will be known as ZR-PAGE-2/.test(box.text) && /Everything entered for it moves to the new number/.test(box.text) && /Bills and debit notes already saved keep the number/.test(box.text) && /QR label/.test(box.text) && /Machinery Number ?ZR-PAGE ?ZR-PAGE-2/.test(box.text) && box.okBtn === 'Change the number' && sql("select count(*) from master where id = 'ZR-PAGE-2'") === '0', box);
  await p.screenshot({ path: 'shots/machno_confirm.png' });
  await f.evaluate(() => document.getElementById('cf_ok').click());
  for (let i = 0; i < 30; i++) { await wait(400); if (sql("select count(*) from master where id = 'ZR-PAGE-2'") === '1') break; } await wait(800);
  const after = await f.evaluate(() => ({ toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent, inList: !!findMachine('ZR-PAGE-2'), oldInList: !!findMachine('ZR-PAGE'), formTitle: document.getElementById('m_title').textContent }));
  ok('PAGE: saved – the toast says what moved, the list has the new number, the form is cleared; the database agrees', /ZR-PAGE is now ZR-PAGE-2 \(moved with it: 1 diesel issues\)/.test(after.toast) && after.inList && !after.oldInList && after.formTitle === 'Add machinery' && sql("select machinery from diesel_issue where machinery in ('ZR-PAGE', 'ZR-PAGE-2')") === 'ZR-PAGE-2' && sql("select count(*) from master where id = 'ZR-PAGE'") === '0', after);
  // an edit that does not touch the number: the ordinary box, nothing moves
  await f.evaluate(() => editMaster('ZR-PAGE-2')); await wait(400);
  await f.evaluate(() => { const i = document.getElementById('m_make'); i.value = 'Tata'; i.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('m_save').click(); }); await wait(900);
  const box2 = await f.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? { text: c.textContent.replace(/\s+/g, ' ').trim(), okBtn: document.getElementById('cf_ok').textContent } : null; });
  ok('PAGE: an edit that leaves the number alone asks as before (no word about a number change)', box2 && !/will be known as/.test(box2.text) && /Make/.test(box2.text) && box2.okBtn === 'Update', box2);
  await f.evaluate(() => document.getElementById('cf_ok').click()); await wait(2500);
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  // ---------- changed back ----------
  r = await api('saveMaster', mach('ZR-1', { taxUpto: '2027-12-31' }), 'edit', 'MH-12-ZR-1234');
  ok('changed back to ZR-1 (a mistake undone): the database is exactly as before the first change; the bill has no "noNow" left', r.renamed && r.renamed.to === 'ZR-1' && snap('ZR-1') === before && sql("select data from bills where id = 'BL-ZR1'") === '{"B":0,"machines":[{"no":"ZR-1","workDays":2,"amount":2000},{"no":"ZR-9","workDays":1,"amount":1000}]}', snap('ZR-1'));
  clean();
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/machno.out', out.join('\n'));
})().catch(e => { fs.writeFileSync('/tmp/machno.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 700)); try { clean(); } catch (e2) {} process.exit(1); });
