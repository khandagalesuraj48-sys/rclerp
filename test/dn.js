/* "Debit to" and Debit Notes against the local stack (PostgreSQL + PostgREST, app servers on :3000 / :3001).
 * Part 1: the step-1t SQL is NOT there → nothing may break.   Part 2: with the SQL → the whole flow, by two servers. */
const { execSync } = require('child_process');
const rpc = async (port, fn, ...args) => { const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) }); return r.json(); };
const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 250) : '')); };
const part = process.argv[2];
(async () => {
  const tk = (await rpc(3000, 'login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
  const api = (port, fn, ...a) => rpc(port, 'api', tk, fn, a);
  for (const v of ['Vendor 5', 'Vendor 6']) await api(3000, 'saveVendor', { name: v, gstReg: 'No', pan: 'ABCDE12' + (v === 'Vendor 5' ? '35' : '36') + 'F', bank: 'SBI', account: '1234567' + v.slice(-1), ifsc: 'SBIN0000001' }, 'add');   // test parties (kept if already there)
  const entry = (no, date, close, extra) => Object.assign({ date: date, shift: 'Full Day', no: no, mode: 'KM', closingKm: close }, extra);
  const last = Number(sql("select coalesce(max(closing_km), 0) from log_book where machinery = 'MH-15-AB-0001'")) || 0;
  if (part === 'nosql') {
    let r = await api(3000, 'saveLogRows', { rows: [entry('MH-15-AB-0001', '2026-10-02', last + 40, { debitTo: 'Vendor 5', debitRate: 55, work: 'no-sql test' })] });
    ok('SQL not run: an entry WITH "Debit to" is refused with a clear message (nothing typed is silently dropped)', /step1t/.test(JSON.stringify(r)), JSON.stringify(r.error || r.result.errors));
    r = await api(3000, 'saveLogRows', { rows: [entry('MH-15-AB-0001', '2026-10-02', last + 40, { work: 'no-sql test' })] });
    ok('SQL not run: an ordinary entry (no "Debit to") is saved as always', r.result && r.result.ok === true, r.error || r.result.errors);
    r = await api(3000, 'getDebitNotes', {}); ok('SQL not run: the Debit Notes list is empty, no error', !r.error && r.result.notes.length === 0, r.error);
    r = await api(3000, 'vendorLedger', { vendor: 'Vendor 5' }); ok('SQL not run: the Vendor Ledger works', !r.error, r.error);
    r = await api(3000, 'getLookups'); ok('SQL not run: the form lists come with the parties', !r.error && r.result.vendors.indexOf('Vendor 5') > -1, r.error || r.result.vendors.length + ' parties');
    r = await api(3000, 'saveDebitNote', { company: 'Rachana Construction Limited', vendor: 'Vendor 5', date: '2026-10-02', lines: [{ particular: 'x', qty: 1, rate: 5 }] });
    ok('SQL not run: saving a note is refused with a clear message (nothing half-saved)', /step1t/.test(r.error || ''), r.error);
    await api(3000, 'deleteLogRow', 'MH-15-AB-0001|2026-10-02|Full Day');
  } else {
    let r = await api(3000, 'saveLogRows', { rows: [entry('MH-15-AB-0001', '2026-10-02', last + 40, { debitTo: 'vendor 5', debitRate: 55, work: 'Carting for Vendor 5' })] });
    ok('entry saved with Debit to + rate', r.result && r.result.ok !== false && !r.error, r.error || r.result);
    ok('…kept in the database', sql("select debit_to || '@' || debit_rate from log_book where id = 'MH-15-AB-0001|2026-10-02|Full Day'") === 'Vendor 5@55');
    r = await api(3001, 'getLogBookList', { from: '2026-10-02', to: '2026-10-02', all: true }); const row = (r.result.rows || []).find(x => x.no === 'MH-15-AB-0001');
    ok('…the other server reads it in the Log Book list', row && row.debitTo === 'Vendor 5' && row.debitRate === 55, row && [row.debitTo, row.debitRate]);
    r = await api(3001, 'getDebitPending', { vendor: 'Vendor 5', from: '2026-10-02', to: '2026-10-02' });
    ok('pending for the party: 40 km × 55 = 2,200', r.result && r.result.rows.length === 1 && r.result.rows[0].amount === 2200, r.error || r.result.rows);
    const line = r.result.rows[0];
    const note = { company: 'Sketchline Industries', vendor: 'Vendor 5', date: '2026-10-02', from: '2026-10-02', to: '2026-10-02', gstPct: 18, tdsPct: 1, lines: [{ logId: line.logId, machinery: line.no, particular: 'Carting', qty: line.qty, unit: line.unit, rate: line.rate }] };
    const two = await Promise.all([api(3000, 'saveDebitNote', note), api(3001, 'saveDebitNote', note)]);
    const saved = two.filter(x => x.result && x.result.ok);
    ok('the same note sent to two servers at the same moment is saved once', saved.length === 1 && Number(sql('select count(*) from debit_notes')) === 1, two.map(x => x.error || x.result.no));
    const n = saved[0].result; ok('number of Sketchline\'s run, total 2,200 + 396 − 22 = 2,574', /^SLI\/VTR\/DN-\d{3}$/.test(n.no) && n.total === 2574, n);
    r = await api(3001, 'getDebitNotes', { id: n.id }); ok('the note with its lines and the party\'s details for the print', r.result.notes[0].lines.length === 1 && r.result.notes[0].vendorInfo && r.result.notes[0].companyInfo.gstin, r.error);
    const led0 = (await api(3000, 'vendorLedger', { vendor: 'Vendor 5' })).result;
    ok('Vendor Ledger of the party shows the note and is lower by 2,574', led0.rows.some(x => x.kind === 'dn' && x.dnNo === n.no && x.paid === 2574), 'closing ' + led0.closing);
    r = await api(3000, 'updateLogRow', 'MH-15-AB-0001|2026-10-02|Full Day', { closingKm: last + 40, debitTo: 'Vendor 6', debitRate: 60 });
    ok('"Debit to" of an entry that is in a note cannot be changed', /cannot be changed/.test(r.error || ''), r.error);
    const view = (await rpc(3000, 'login', 'view@rcl.test', 'Audit#PassView9!x')).result;
    if (view && view.token) { r = await rpc(3000, 'api', view.token, 'saveDebitNote', [note]); ok('a view-only user cannot make a note', /View access only|do not have access/.test(r.error || ''), r.error);
      r = await rpc(3000, 'api', view.token, 'cancelDebitNote', [n.id]); ok('…and cannot cancel one', /Only Admin/.test(r.error || ''), r.error); }
    r = await api(3000, 'cancelDebitNote', n.id); ok('Admin cancels the note', r.result && r.result.ok, r.error);
    const led1 = (await api(3001, 'vendorLedger', { vendor: 'Vendor 5' })).result; ok('…the ledger is back', Math.abs(led1.closing - (led0.closing + 2574)) < 0.01, led0.closing + ' → ' + led1.closing);
    try { await fetch('http://127.0.0.1:3997/unprotect'); } catch (e) {}
    r = await api(3000, 'backupNow'); ok('the backup copies the new table too', !r.error && (r.result.upToDate || (r.result.lines || []).some(x => x[0] === 'Debit Notes')), r.error || JSON.stringify(r.result.lines || 'up to date').slice(0, 160));
    await api(3000, 'deleteLogRow', 'MH-15-AB-0001|2026-10-02|Full Day'); sql('delete from debit_notes');
  }
  console.log(pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log('CRASH', e); process.exit(1); });
