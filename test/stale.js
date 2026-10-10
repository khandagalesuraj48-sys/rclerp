/* update-68, decision D11 (design): "the last one to save wins" – MEASURED as it is today, on the local test rig.
 * Two people open the same entry; A saves a change; B, whose form still shows the old values, saves another change.
 * Today B's save silently puts the old values back over A's. This script shows exactly that (it is not a fix – the design
 * for one is in UPDATE_68.md). When that design is built, the lines marked [today] must flip: B gets a clear refusal.
 *   node test/stale.js */
const { execSync } = require('child_process');
const PORT = Number(process.env.PORT) || 3000;
const sql = q => execSync('su postgres -c "psql -d rcl -tA -q"', { input: q, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
const raw = async body => { const r = await fetch('http://127.0.0.1:' + PORT + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) }); return r.json(); };
let n = 0; const say = (name, x) => { n++; console.log(name + '  → ' + JSON.stringify(x).slice(0, 420)); };
(async () => {
  const admin = (await raw({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = (fn, args) => raw({ fn: 'api', args: [admin, fn, args || []] });
  const today = sql("select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')");
  // ---- a Diesel Issue
  const base = { date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: 'STALE first', qty: 10, kmReading: 99950 + Math.floor(Math.random() * 9), remark: '', force: true };
  const id = (await api('saveDieselIssue', [base])).result.id;
  const formA = Object.assign({}, base), formB = Object.assign({}, base);                       // both open the entry: both forms show 10 Ltr, "STALE first"
  const a = await api('updateDieselIssue', [id, Object.assign(formA, { qty: 25, driver: 'A corrected' })]);      // A corrects the quantity and the driver
  const afterA = sql("select qty || ' / ' || driver_name || ' / ' || coalesce(remark, '') from diesel_issue where id = '" + id + "'");
  const b = await api('updateDieselIssue', [id, Object.assign(formB, { remark: 'B added a remark' })]);              // B only adds a remark – the form still holds 10 Ltr
  const afterB = sql("select qty || ' / ' || driver_name || ' / ' || coalesce(remark, '') from diesel_issue where id = '" + id + "'");
  say('[today] Diesel Issue ' + id + ': A changed 10 → 25 Ltr; B (old form) added a remark. B was told', { A: a.error || 'saved', after_A: afterA, B: b.error || 'saved – no warning', after_B: afterB, A_change_lost: /^10(\.0+)? \//.test(afterB) });
  await api('deleteDieselIssue', [id]);
  // ---- a payment (money)
  const V = 'STALE Vendor ' + Date.now().toString(36);
  await api('saveVendor', [{ name: V, gstReg: 'No', pan: 'ABCPE1234T', bank: 'SBI', account: '000123456789', ifsc: 'SBIN0000001' }, 'add']);
  const p0 = { type: 'Payment', vendor: V, date: today, amount: 50000, mode: 'NEFT', ref: 'UTR-1', remark: '' };
  const pid = (await api('savePayment', [p0, 'add'])).result.id;
  const pa = await api('savePayment', [Object.assign({}, p0, { id: pid, amount: 55000 }), 'edit']);
  const pb = await api('savePayment', [Object.assign({}, p0, { id: pid, remark: 'B: cheque returned' }), 'edit']);
  const pay = sql("select amount || ' / ' || coalesce(remark, '') from payments where id = '" + pid + "'");
  say('[today] Payment ' + pid + ': A corrected ₹50,000 → ₹55,000; B (old form) added a remark. B was told', { A: pa.error || 'saved', B: pb.error || 'saved – no warning', now: pay, A_change_lost: /^50000/.test(pay) });
  sql("delete from payments where id = '" + pid + "'; delete from vendors where vendor_name = '" + V + "'; delete from activity_log where record_id in ('" + id + "', '" + pid + "') or summary like '%" + V + "%';");
  console.log('\n' + n + ' cases measured (this is today\'s behaviour, not a pass/fail test)');
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
