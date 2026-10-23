/* update-149 – the Log Book Debit Statement (Reports) and the rates / parties of its entries, through the server's own door (/api/rpc)
 * on the local rig (app servers :3000 / :3001, database rcl). Test data only ("LD149" machinery, parties, entries, a user, a debit
 * note), all taken out at the end.      node test/ldebit149api.js
 * Checks: party by party, the quantity as each entry is measured (KM, Hrs) × its rate; filters (party, machinery); one rate changed;
 * one rate for several; the Excel way (machinery + date + shift → party + rate; no shift: the one entry of the day); all or nothing
 * (a wrong line – nothing saved); the party must be in the Vendor Master and the rate above 0; an entry in a Debit Note keeps its
 * rate; View access cannot change it; the other server sees it at once; the Activity says what changed; under a Log Book
 * verification rule a change is sent (nothing written) and saved when approved. */
const { execSync } = require('child_process');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const PW = 'Nashik#Road848!';
const post = async (port, body) => { const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); return r.json(); };
let n = 0; const rid = () => 'ld149' + Date.now().toString(36) + (n++);
(async () => {
  const cleanup = () => sql("delete from log_book where machinery like 'LD149-%'; delete from master where id like 'LD149-%'; delete from vendors where vendor_name like 'LD149 %';" +
    "delete from debit_notes where vendor_name like 'LD149 %'; delete from app_users where email = 'ld149v@rcl.test'; delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_log_book, perm_reports) select 'ld149v', 'ld149v@rcl.test', password_hash, 'Viewer 149', 'Yes', 'No', 'View', 'View' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
    await new Promise(r => setTimeout(r, 1500));
    const tk = (await post(3000, { fn: 'login', args: ['sujit@rcl.test', PW] })).result.token, vt = (await post(3000, { fn: 'login', args: ['ld149v@rcl.test', PW] })).result.token;
    const api = async (port, t, fn, ...a) => { const x = await post(port, { fn: 'api', args: [t, fn, a], rid: rid() }); return x.error ? { ERROR: x.error } : x.result; };
    const A = (fn, ...a) => api(3000, tk, fn, ...a), B = (fn, ...a) => api(3001, tk, fn, ...a);
    const today = (await A('getInit')).today, day = k => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
    const D1 = day(-2), D2 = day(-1), dmy = k => k.split('-').reverse().join('-');
    const vs = []; for (const [nm, pan] of [['LD149 Party A', 'ABCPL1149A'], ['LD149 Party B', 'ABCPL2149B']]) vs.push(await A('saveVendor', { name: nm, gstReg: 'No', pan: pan, bank: 'SBI', account: '1490149' + pan.slice(-2, -1), ifsc: 'SBIN0000149' }, 'add'));
    const m1 = await A('saveMaster', { no: 'LD149-1', name: 'Tipper 149', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const m2 = await A('saveMaster', { no: 'LD149-2', name: 'Excavator 149', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 12, tankCap: 300, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    const L = (no, date, shift, ex) => Object.assign({ date: date, shift: shift, no: no }, ex);
    const s1 = await A('saveLogRows', { rows: [
      L('LD149-1', D1, 'Full Day', { mode: 'KM', openingKm: 1000, closingKm: 1040, debitTo: 'LD149 Party A', debitRate: 55, work: 'Carting for A' }),
      L('LD149-2', D1, 'Day', { mode: 'Hrs', openingHr: 500, closingHr: 508, debitTo: 'LD149 Party B', debitRate: 900, work: 'Excavation for B' }),
      L('LD149-2', D1, 'Night', { mode: 'Hrs', openingHr: 508, closingHr: 512, debitTo: 'LD149 Party B', debitRate: 900, work: 'Excavation for B' })] });
    const s2 = await A('saveLogRows', { rows: [L('LD149-1', D2, 'Full Day', { mode: 'KM', openingKm: 1040, closingKm: 1100, debitTo: 'LD149 Party A', debitRate: 50, work: 'Carting for A' })] });
    ok('seed: 2 parties, LD149-1 (KM) and LD149-2 (Hrs), 4 Log Book entries charged to them', vs.every(v => !v.ERROR) && m1.ok && m2.ok && s1.ok !== false && !s1.ERROR && s2.ok !== false && !s2.ERROR && sql("select count(*) from log_book where machinery like 'LD149-%' and debit_to like 'LD149 %'") === '4', [vs, m1.ERROR, m2.ERROR, s1, s2]);
    // ---- the statement ----
    let r = await A('rptLogDebit', { from: D1, to: D2 });
    const pA = (r.parties || []).find(p => p.party === 'LD149 Party A'), pB = (r.parties || []).find(p => p.party === 'LD149 Party B');
    ok('the statement: party by party – A: 40 + 60 KM × 55 / 50 = 2,200 + 3,000 = 5,200; B: 8 + 4 Hrs × 900 = 10,800', r.title === 'Log Book Debit Statement' && pA && pB && pA.amount === 5200 && pA.qty.KM === 100 && pB.amount === 10800 && pB.qty.Hrs === 12 && pA.rows.length === 2 && pB.rows.length === 2, r.ERROR || r.parties);
    ok('   each entry: date, shift, machinery, type, measured by, quantity, unit, work, rate, amount, its key', pA && pA.rows[0].date === D1 && pA.rows[0].no === 'LD149-1' && pA.rows[0].type === 'Tipper' && pA.rows[0].mode === 'KM' && pA.rows[0].qty === 40 && pA.rows[0].unit === 'KM' && pA.rows[0].rate === 55 && pA.rows[0].amount === 2200 && pA.rows[0].work === 'Carting for A' && pA.rows[0].logId === 'LD149-1|' + D1 + '|Full Day' && pA.rows[0].note === '', pA && pA.rows[0]);
    ok('   the totals (the other parties of the rig are counted as well, if any): at least 4 entries, 16,000', r.total && r.total.entries >= 4 && r.total.amount >= 16000, r.total);
    r = await A('rptLogDebit', { from: D1, to: D2, party: 'ld149 party a' });
    ok('filter – one party (as typed, any case): only A', (r.parties || []).length === 1 && r.parties[0].party === 'LD149 Party A' && r.party === 'ld149 party a', r.parties && r.parties.map(p => p.party));
    r = await A('rptLogDebit', { from: D1, to: D2, no: 'LD149-2' });
    ok('filter – one machinery: only its entries (B)', (r.parties || []).length === 1 && r.parties[0].party === 'LD149 Party B' && r.no === 'LD149-2', r.parties && r.parties.map(p => p.party));
    // ---- rates: one, several ----
    const k1 = 'LD149-1|' + D1 + '|Full Day', kd = 'LD149-2|' + D1 + '|Day', kn = 'LD149-2|' + D1 + '|Night', k2 = 'LD149-1|' + D2 + '|Full Day';
    r = await A('saveLogDebits', { rows: [{ logId: k1, rate: 60 }], from: 'report' });
    ok('one rate changed (55 → 60): saved; the party stays', r.ok && r.count === 1 && sql("select debit_to || '@' || debit_rate from log_book where id = '" + k1 + "'") === 'LD149 Party A@60', r);
    r = await B('rptLogDebit', { from: D1, to: D2, party: 'LD149 Party A' });
    ok('   the other server shows it at once: 40 × 60 = 2,400; A = 5,400', r.parties && r.parties[0].rows[0].amount === 2400 && r.parties[0].amount === 5400, r.parties && r.parties[0]);
    r = await A('saveLogDebits', { rows: [{ logId: kd, rate: 1000 }, { logId: kn, rate: 1000 }, { logId: k2, rate: 50 }], from: 'report' });
    ok('one rate for several (B\'s two entries 900 → 1,000; A\'s D2 already 50): 2 saved, 1 as it was', r.ok && r.count === 2 && r.same === 1, r);
    // ---- the Excel way ----
    r = await A('saveLogDebits', { rows: [{ line: 2, no: 'LD149-1', date: D2, shift: 'Full Day', to: 'LD149 Party B', rate: 45 }, { line: 3, no: 'ld149-1', date: D1, shift: '', to: 'LD149 Party A', rate: 61 }], from: 'import' });
    ok('import: machinery + date + shift → party and rate (D2 moves to B @ 45); no shift on a day with one entry – that entry (D1 @ 61)', r.ok && r.count === 2 && sql("select debit_to || '@' || debit_rate from log_book where id = '" + k2 + "'") === 'LD149 Party B@45' && sql("select debit_rate from log_book where id = '" + k1 + "'") === '61', r);
    r = await A('saveLogDebits', { rows: [{ line: 2, no: 'LD149-1', date: D1, shift: '', to: '  ', rate: 62 }], from: 'import' });
    ok('   a blank "Debit to" cell: the entry keeps its party (A @ 62)', r.ok && r.count === 1 && sql("select debit_to || '@' || debit_rate from log_book where id = '" + k1 + "'") === 'LD149 Party A@62', r);
    const before = sql("select string_agg(id || '=' || debit_to || '@' || debit_rate, ';' order by id) from log_book where machinery like 'LD149-%'");
    const refused = async (rows, re, what) => { const x = await A('saveLogDebits', { rows: rows, from: 'import' }); ok(what, re.test(x.ERROR || '') && sql("select string_agg(id || '=' || debit_to || '@' || debit_rate, ';' order by id) from log_book where machinery like 'LD149-%'") === before, x); };
    await refused([{ line: 2, no: 'LD149-1', date: D2, shift: 'Full Day', to: 'LD149 Party A', rate: 70 }, { line: 3, no: 'LD149-2', date: D1, shift: '', to: 'LD149 Party A', rate: 70 }],
      /^Row 3: LD149-2 · .* has 2 entries \(Day and Night\) – give the shift\.$/, 'a day with two entries and no shift: said for its row – and NOTHING saved (row 2 was right, it is not saved either)');
    await refused([{ line: 4, no: 'LD149-1', date: day(-5), shift: 'Full Day', to: 'LD149 Party A', rate: 70 }], /^Row 4: there is no Log Book entry of LD149-1 · /, 'an entry that is not saved: said');
    await refused([{ line: 2, no: 'LD149-1', date: D2, shift: 'Full Day', to: 'Nobody 149', rate: 70 }], /"Nobody 149" is not in the Vendor Master/, 'a party not in the Vendor Master: said');
    await refused([{ line: 2, no: 'LD149-1', date: D2, shift: 'Full Day', to: 'LD149 Party A', rate: 0 }], /type the rate/, 'a rate of 0: said');
    await refused([{ line: 2, no: 'LD149-1', date: D2, shift: 'Full Day', rate: 70 }, { line: 5, no: 'LD149-1', date: D2, shift: 'Full Day', rate: 71 }], /^Row 5: .* is given twice/, 'the same entry on two lines: said');
    await refused([], /Nothing to save/, 'nothing to save: said');
    // ---- a debit note keeps its rate ----
    const pend = await A('getDebitPending', { vendor: 'LD149 Party A', from: D1, to: D1 });
    const line = ((pend || {}).rows || [])[0];
    const dn = line ? await A('saveDebitNote', { company: 'Rachana Construction Limited', vendor: 'LD149 Party A', date: D1, from: D1, to: D1, gstPct: 0, tdsPct: 0, lines: [{ logId: line.logId, machinery: line.no, particular: 'Carting', qty: line.qty, unit: line.unit, rate: line.rate }] }) : { ERROR: 'no pending line' };
    if (dn && dn.ok) {
      r = await A('saveLogDebits', { rows: [{ logId: k1, rate: 99 }], from: 'report' });
      ok('an entry in a Debit Note (' + dn.no + '): its rate cannot be changed – said; nothing saved', /is in debit note .* cannot be changed\. Cancel that note first\./.test(r.ERROR || '') && sql("select debit_rate from log_book where id = '" + k1 + "'") === '62', r);
      r = await A('rptLogDebit', { from: D1, to: D2, party: 'LD149 Party A' });
      ok('   the statement names its Debit Note', r.parties && r.parties[0].rows[0].note === dn.no && r.parties[0].inNote === 1, r.parties && r.parties[0]);
      await A('cancelDebitNote', dn.id);
    } else ok('a debit note on the rig (for the lock check)', false, dn);
    // ---- access, the Activity ----
    r = await api(3000, vt, 'saveLogDebits', { rows: [{ logId: k1, rate: 70 }] });
    ok('Log Book View access: cannot change a rate', /View access only for Log Book/.test(r.ERROR || ''), r);
    r = await api(3000, vt, 'rptLogDebit', { from: D1, to: D2 });
    ok('   …but sees the statement (Reports)', Array.isArray(r.parties), r);
    const act = sql("select summary || ' | ' || changes from activity_log where module = 'Log Book' and summary like 'Debit to / rate changed%' order by at desc limit 3");
    ok('the Activity: "Debit to / rate changed for … Log Book entries (Excel import)" with each change (was → now)', /Debit to \/ rate changed for 2 Log Book entries \(Excel import\) \| LD149-1 · .* → LD149 Party B @ 45/.test(act), act);
    // ---- a verification rule for the Log Book (as any change of a Log Book entry): sent, NOTHING written; saved when approved ----
    const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
    let vf = '';
    try {
      sql("insert into app_users (id, email, password_hash, name, active, admin) select 'ck149', 'ck149@rcl.test', password_hash, 'Checker 149', 'Yes', 'No' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key = 'USERS_LIST';");
      await new Promise(r => setTimeout(r, 1500));
      const P = 'http://127.0.0.1:3010';
      let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
      const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: (lr.headers.get('set-cookie') || '').split(';')[0] }, redirect: 'manual' });
      const ss = await post(3000, { fn: 'ssoLogin', args: [(go.headers.get('location') || '').split('#sso=')[1] || ''] }), sa = ss.result && ss.result.token;
      const ck = (await post(3000, { fn: 'login', args: ['ck149@rcl.test', PW] })).result.token;
      r = await api(3000, sa, 'saveFlowRules', { remindHours: 4, tasks: { 'Log Book': { on: true, levels: [['ck149@rcl.test']] } } });
      ok('verification: the Super Admin sets Log Book → Checker 149', r && r.ok, r);
      const k2now = () => sql("select debit_to || '@' || debit_rate from log_book where id = '" + k2 + "'");
      const was = k2now();
      r = await A('saveLogDebits', { rows: [{ logId: k2, rate: 46 }], from: 'report' });
      vf = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0] || '';
      ok('   a rate changed under the rule: "Sent for verification to Checker 149" – nothing written', /^Sent for verification to Checker 149/.test(r.ERROR || '') && k2now() === was, { r: r, now: k2now(), was: was });
      r = await api(3000, ck, 'approvalDetails', { ids: [vf] });
      ok('   the checker sees it in Details (the entry and its rate)', JSON.stringify(r).indexOf(k2) > -1 && JSON.stringify(r).indexOf('46') > -1, r);
      r = await api(3000, ck, 'decideChangeRequest', { id: vf, approve: true });
      ok('   approved: saved – B @ 46', !(r && r.ERROR) && k2now() === 'LD149 Party B@46', { r: r, now: k2now() });
    } finally {
      sql((rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
        "delete from app_users where email = 'ck149@rcl.test';" + (vf ? "delete from billed_changes where id = '" + vf + "';" : '') + "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
    }
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 600)); }
  finally { try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
