/* Checks that need no database and no network:  npm test
 * (the business rules run on a small in-memory stand-in for the database – see harness.js) */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');

test('dates: the India-time formatter agrees with the engine for two years of instants', () => {
  const { Utilities } = require('../server/gas.js');
  const ref = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2027, 0, 1); t += 37 * 60000 + 13000) { const d = new Date(t); assert.strictEqual(Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd'), ref.format(d)); }
  assert.strictEqual(Utilities.formatDate(new Date('2026-09-30T19:45:07Z'), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm:ss'), '01-10-2026 01:15:07');
});

test('passwords: the hash is the same as an independent calculation (salted SHA-256, 300 rounds)', () => {
  const { Utilities } = require('../server/gas.js');
  const salt = '03df218ade11434e', pw = 'Nashik#Road848!';
  let h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8);
  for (let i = 0; i < 300; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(Utilities.newBlob(salt).getBytes()));
  const mine = h.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
  let x = crypto.createHash('sha256').update(salt + '|' + pw, 'utf8').digest();
  for (let i = 0; i < 300; i++) x = crypto.createHash('sha256').update(Buffer.concat([x, Buffer.from(salt, 'utf8')])).digest();
  assert.strictEqual(mine, x.toString('hex'));
});

test('the page that is sent to the browser holds no secret and has the bridge', () => {
  const { page, shell } = require('../server/page.js');
  const html = shell();
  for (const bad of ['sb_secret_', 'BEGIN PRIVATE KEY', 'private_key', 'SUPABASE_SECRET_KEY=', 'service_role']) assert.ok(html.indexOf(bad) === -1, 'found "' + bad + '" in the page');
  assert.ok(html.indexOf('/api/rpc') > -1 && page().build.length === 12);
  assert.strictEqual(page().build, page().build);
});

test('every script in the page that is sent to the browser parses (a typo there would stop the whole app)', () => {
  const vm = require('vm'); const { page } = require('../server/page.js');
  const html = page().html, scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 3, 'scripts found: ' + scripts.length);
  scripts.forEach((js, i) => { assert.doesNotThrow(() => new vm.Script(js, { filename: 'page-script-' + i + '.js' }), 'script ' + i + ' does not parse'); });
  assert.ok(scripts.some(js => js.indexOf('/api/rpc') > -1 && js.indexOf('rcl_trace') > -1), 'the bridge with the recorder is in the page');
});

test('no secret is written anywhere in the project files', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === 'node_modules' || e.name === '.git' || e.name === 'public' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const hits = [];
  for (const f of walk(root)) { if (/\.env/.test(f)) continue; const s = fs.readFileSync(f, 'utf8');
    if (/sb_secret_[A-Za-z0-9_-]{12,}/.test(s) || /-----BEGIN (RSA )?PRIVATE KEY-----\n[A-Za-z0-9+/=\n]{200,}/.test(s) || /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(s) || /ghp_[A-Za-z0-9]{30,}/.test(s)) hits.push(path.relative(root, f)); }
  assert.deepStrictEqual(hits, []);
});

test('vercel.json: both endpoints, the nightly job and the safety headers are there', () => {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(j.functions['api/rpc.js'] && j.functions['api/backup.js'] && j.crons[0].path.indexOf('/api/backup') === 0);
  assert.ok(JSON.stringify(j.headers).indexOf('X-Content-Type-Options') > -1);
});

test('billing: item-wise BOQ with an hour slab, Idle paid / not paid, and page = server (independent figures)', () => {
  const { T } = require('./harness.js');
  const step = fn => { const r = fn(); T.reset(); return r; };
  for (const [no, unit, type] of [['JCB-1', 'Hrs', 'JCB'], ['BOLERO-1', 'KM', 'Bolero']])
    step(() => T.saveMaster_({ no, name: type, type, unit, worksOn: [unit], hrStd: 5, kmStd: 12, owner: 'ABC Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  step(() => T.saveVendor_({ name: 'ABC Earthmovers', gstReg: 'No', pan: 'ABCDE1234F', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add'));
  step(() => T.saveBoq_({ vendor: 'ABC Earthmovers', from: '2026-09-01', tdsPct: 2, woNo: 'WO-1', lines: [
    { no: 'JCB-1', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 900 }, { name: 'Breaker', basis: 'Per Hour', slabs: [{ upTo: 1, rate: 1500 }, { upTo: '', rate: 1200 }], slabOn: 'Day' }] },
    { no: 'BOLERO-1', basis: 'Monthly', rate: 40000, diesel: 'Company' }] }, 'add'));
  step(() => T.saveLogRowsInner_({ rows: [
    { date: '2026-09-01', shift: 'Full Day', no: 'JCB-1', mode: 'Hrs', openingHr: 100, closingHr: 108, items: { Breaker: 3 } },
    { date: '2026-09-02', shift: 'Full Day', no: 'JCB-1', mode: 'Hrs', closingHr: 116 },
    { date: '2026-09-01', shift: 'Full Day', no: 'BOLERO-1', mode: 'KM', openingKm: 1000, closingKm: 1100 },
    { date: '2026-09-02', shift: 'Full Day', no: 'BOLERO-1', mode: 'KM', closingKm: 1180 },
    { date: '2026-09-03', shift: 'Full Day', no: 'BOLERO-1', mode: 'Idle' }] }));
  const from = '2026-09-01', to = '2026-09-10';
  const logs = JSON.parse(JSON.stringify(T.getLogBookList_({ from, to, all: true }))), extra = JSON.parse(JSON.stringify(T.logPrintExtra_({ from, to, nos: ['JCB-1', 'BOLERO-1'] })));
  const byNo = {}; logs.rows.forEach(r => (byNo[r.no] = byNo[r.no] || []).push(r));
  const srv = (no, idle) => T.billMachineCalc_(T.findMachine_(no), byNo[no], extra, from, to, undefined, idle).amount;
  // by hand: day 1 Bucket 5 × 900 + Breaker 1 × 1500 + 2 × 1200 ; day 2 Bucket 8 × 900
  assert.strictEqual(srv('JCB-1', true), 5 * 900 + 1500 + 2 * 1200 + 8 * 900);
  assert.strictEqual(srv('BOLERO-1', true), Math.round(40000 / 30 * 3 * 100) / 100);
  assert.strictEqual(srv('BOLERO-1', false), Math.round(40000 / 30 * 2 * 100) / 100);
  // the page works the bill out by itself – it must give the same figure as the server
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const grab = m => { const i = app.indexOf(m); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const env = { r2: n => Math.round(n * 100) / 100, hasKm: u => u === 'KM' || u === 'KM + Hrs', hasHr: u => u === 'Hrs' || u === 'KM + Hrs', isHol: r => ['Holiday', 'Breakdown'].indexOf(r.mode || r.unit) > -1,
    showDate: d => d.split('-').reverse().join('/'), fmt: String, DAY_STATUS: ['Idle', 'Holiday', 'Breakdown'], METER_OFF: 'No reading', isoDate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), ITEM_WORD: { hr: 'hr', km: 'km', trip: 'trips' }, dieselDebitDay: (vt, bd, m) => bd ? bd.diesel === 'Debit Basis' : !!(m && m.supply === 'Debit Basis'), findMachine: no => T.getMaster_().find(m => m.id === no) };
  const C = new Function(...Object.keys(env), grab('function itemDaySegs(') + '\n' + grab('function tankLeft(') + '\n' + grab('function mbMachine(') + '; return { mbMachine };')(...Object.values(env));
  for (const no of ['JCB-1', 'BOLERO-1']) for (const idle of [true, false]) assert.strictEqual(C.mbMachine(no, byNo[no], extra, from, to, undefined, idle).amount, srv(no, idle), no + ' idle=' + idle);
});

test('vendor ledger: opening + bills − payments = closing, also with a date filter', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return r; };
  run('(x, m) => savePayment_(x, m)', { type: 'Opening', vendor: 'Ledger Test', date: '2026-09-01', amount: 100000, side: 'Payable' }, 'add');
  run('(x, m) => savePayment_(x, m)', { type: 'Payment', vendor: 'Ledger Test', date: '2026-09-10', amount: 33333.33, mode: 'NEFT' }, 'add');
  run('(x, m) => savePayment_(x, m)', { type: 'Payment', vendor: 'Ledger Test', date: '2026-09-20', amount: 33333.33, mode: 'NEFT' }, 'add');
  const L = JSON.parse(JSON.stringify(run('f => vendorLedger_(f)', { vendor: 'Ledger Test' })));
  assert.strictEqual(L.closing, 33333.34); assert.strictEqual(Math.round((L.opening + L.totalBill - L.totalPaid) * 100) / 100, L.closing);
  const L2 = JSON.parse(JSON.stringify(run('f => vendorLedger_(f)', { vendor: 'Ledger Test', from: '2026-09-15', to: '2026-09-30' })));
  assert.strictEqual(L2.opening, 66666.67); assert.strictEqual(L2.closing, L.closing);
  assert.throws(() => run('(x, m) => savePayment_(x, m)', { type: 'Payment', vendor: 'Ledger Test', date: '2026-09-21', amount: -5, mode: 'NEFT' }, 'add'), /Enter the amount/);
  assert.throws(() => run('(x, m) => savePayment_(x, m)', { type: 'Opening', vendor: 'Ledger Test', date: '2026-09-01', amount: 5, side: 'Payable' }, 'add'), /already entered/);
});

test('bill papers: amount in words, Tax Invoice = the Abstract\'s figures, Debit Note = the diesel deduction', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const grab = m => { const i = app.indexOf(m); assert.ok(i > -1, m); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const env = { r2: n => Math.round(n * 100) / 100, esc, fmt: n => String(n), mbN2: n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), mbDot: d => String(d || '').split('-').reverse().join('.'),
    DOC_CSS: '', billHtml: () => '<div class="bl">ABSTRACT</div>', showDate: d => String(d || '').split('-').reverse().join('-'),
    billTank: () => '', billEst: () => '', billFinal: () => '',
    billNoEntry: b => [].concat(...((b && b.machines) || []).map(m => (m.noEntry || []).map(x => String(m.no) + ' ' + x.d + ' ' + x.q + ' L'))).join(', ') };
  const C = new Function(...Object.keys(env), grab('function rupeesWords(') + '\nconst docDash = v => (v === \'\' || v === null || v === undefined || Number(v) === 0) ? \'-\' : mbN2(v);\n' + grab('function taxInvoiceHtml(') + '\n' + grab('function debitNoteHtml(') + '\n' + grab('function billSheets(') + '; return { rupeesWords, taxInvoiceHtml, debitNoteHtml, billSheets };')(...Object.values(env));
  for (const [n, w] of [[40000, 'Rupees Forty Thousand Only'], [0, 'Rupees Zero Only'], [15600, 'Rupees Fifteen Thousand Six Hundred Only'], [123456789.5, 'Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine and Fifty Paise Only'],
    [100000, 'Rupees One Lakh Only'], [1000019.99, 'Rupees Ten Lakh Nineteen and Ninety Nine Paise Only'], [99.995, 'Rupees One Hundred Only'], [-250, 'Minus Rupees Two Hundred Fifty Only']]) assert.strictEqual(C.rupeesWords(n), w);
  const text = h => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  // the sample bill: one vehicle on monthly rent, no deduction, no GST, no TDS
  const plain = { company: 'Sketchline Industries', companyInfo: { address: 'PUNE', gstin: '27AFGFS3815J1ZQ', invPrefix: 'SLI/VTR/RA-' }, vendor: { name: 'Mr. Suresh Sarjerav Patil', pan: 'ATPPP4359M', account: '000401670367', ifsc: 'ICIC0000004' },
    billNo: '27', from: '2026-07-01', to: '2026-07-31', billDate: '2026-08-10', woNo: 'SLI/VTR-Office/WO/2024-2025/47', woDate: '2025-04-12', siteAddress: 'SITE',
    machines: [{ no: 'MH-06-AS-9417', type: 'Bolero', amount: 40000, lines: [{ monthly: 40000, unit: 'Days', qty: 31, rate: 1290.32, amount: 40000 }] }], A: 40000, B: 0, C: 0, D: 40000, gstPct: 0, tdsPct: 0, E: 0, F: 0, G: 40000, H: 0, I: 40000 };
  const t1 = text(C.taxInvoiceHtml(plain));
  for (const want of ['TAX INVOICE', 'SLI/VTR/RA-27', '10.08.2026', '01.07.2026 To 31.07.2026', 'RENT ON VEHICLE MH06AS9417', 'Total Amount Before Tax 40,000.00', 'Basic Value 40,000.00', 'Total Billing Amt 40,000.00', 'Net Cheque Amount 40,000.00', 'Rupees Forty Thousand Only', 'PAN NO :- ATPPP4359M']) assert.ok(t1.indexOf(want) > -1, 'Tax Invoice should say: ' + want + '\n' + t1.slice(0, 900));
  assert.ok(t1.indexOf('Less:') === -1, 'no deduction lines on a bill without deductions');
  assert.strictEqual(C.debitNoteHtml(plain), ''); assert.strictEqual((C.billSheets(plain, '').match(/<section/g) || []).length, 2);
  // a bill with diesel deducted, GST 18 % and TDS 2 %: every figure must be the Abstract's own
  const full = Object.assign({}, plain, { dnNo: 'SLI/VTR/DN-004', machines: [{ no: 'JCB-1', type: 'JCB', amount: 15600, dieselRate: 92, debitQty: 0, excessQty: 25, excessAmt: 2300, lines: [{ item: 'Bucket', unit: 'Hrs', qty: 13, rate: 900, amount: 11700 }, { item: 'Breaker', unit: 'Hrs', qty: 3, rate: 1300, amount: 3900 }] }],
    A: 15600, B: 2300, C: 300, cReason: 'tyre', D: 13000, gstPct: 18, tdsPct: 2, E: 1170, F: 1170, G: 15340, H: 260, I: 15080 });
  const t2 = text(C.taxInvoiceHtml(full));
  for (const want of ['Total Amount Before Tax 15,600.00', 'Less: Diesel deduction (Debit Note SLI/VTR/DN-004) − 2,300.00', 'Less: Other deduction (tyre) − 300.00', 'Basic Value 13,000.00', 'SGST 9% 1,170.00', 'CGST 9% 1,170.00', 'Total Billing Amt 15,340.00', 'Net Cheque Amount 15,340.00', 'Rupees Fifteen Thousand Three Hundred Forty Only', 'BUCKET: 13 Hrs × 900.00 = 11,700.00'])
    assert.ok(t2.indexOf(want) > -1, 'Tax Invoice should say: ' + want + '\n' + t2.slice(0, 1400));
  assert.ok(t2.indexOf('TDS') === -1, 'the party\'s invoice never shows TDS');
  const d2 = text(C.debitNoteHtml(full));
  for (const want of ['DEBIT NOTE', 'SLI/VTR/DN-004', 'JCB1', 'Diesel used over the standard average 25 92.00 2,300.00', 'Total debit 2,300.00', 'Rupees Two Thousand Three Hundred Only', 'RA Bill No 27']) assert.ok(d2.indexOf(want) > -1, 'Debit Note should say: ' + want + '\n' + d2.slice(0, 900));
  assert.strictEqual((C.billSheets(full, '').match(/<section/g) || []).length, 3);
  // hostile text in a name stays text
  assert.ok(C.taxInvoiceHtml(Object.assign({}, plain, { vendor: { name: '<img src=x onerror=1>' } })).indexOf('<img') === -1);
});

test('Machinery Cost Sheet: rent + diesel − recovered = net cost, per hour / KM (independent figures)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return r; };
  run('(x, m) => saveMaster_(x, m)', { no: 'CS-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'Cost Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'CS-OWN', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Cost Vendor', gstReg: 'No', pan: 'ABCDE1234H', bank: 'SBI', account: '12345670', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Cost Vendor', from: '2026-08-01', tdsPct: 2, woNo: 'WO-9', lines: [{ no: 'CS-JCB', basis: 'Per Hour', rate: 900, diesel: 'Company' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-07-31', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 92, billNo: 'CS1', billDate: '2026-07-31' });
  run('x => saveLogRowsInner_(x)', { rows: [
    { date: '2026-08-01', shift: 'Full Day', no: 'CS-JCB', mode: 'Hrs', openingHr: 100, closingHr: 108 }, { date: '2026-08-02', shift: 'Full Day', no: 'CS-JCB', mode: 'Hrs', closingHr: 116 },
    { date: '2026-08-01', shift: 'Full Day', no: 'CS-OWN', mode: 'KM', openingKm: 500, closingKm: 700 }] });
  run('x => saveDieselIssue_(x)', { date: '2026-08-01', shift: 'Day', source: 'Dispenser', no: 'CS-JCB', qty: 200, hrReading: 100, force: true });
  run('x => saveDieselIssue_(x)', { date: '2026-08-02', shift: 'Day', source: 'Dispenser', no: 'CS-JCB', qty: 40, hrReading: 108, force: true });
  run('x => saveDieselIssue_(x)', { date: '2026-08-01', shift: 'Day', source: 'Dispenser', no: 'CS-OWN', qty: 50, kmReading: 500, force: true });
  const d = JSON.parse(JSON.stringify(run('f => rptMachineCost_(f)', { from: '2026-08-01', to: '2026-08-02' })));
  const rows = [].concat(...d.groups.map(g => g.rows)), jcb = rows.find(r => r.no === 'CS-JCB'), own = rows.find(r => r.no === 'CS-OWN');
  assert.strictEqual(d.rate, 92);
  // by hand – JCB: 16 hr × 900 = 14,400 rent; 240 L × 92 = 22,080 diesel; standard 16 × 5 = 80 L → 160 L over. The last fill (40 L at
  // 108 hr) ran 8 hr = 40 L, nothing of it is left in the tank → 160 L × 92 = 14,720 taken back; net 14,400 + 22,080 − 14,720 = 21,760
  assert.deepStrictEqual([jcb.rent, jcb.dieselCost, jcb.recover, jcb.net, jcb.perHr], [14400, 22080, 14720, 21760, 1360]);
  // own tipper: no rent; 50 L × 92 = 4,600; 200 km → 23 per km
  assert.deepStrictEqual([own.rent, own.dieselCost, own.recover, own.net, own.perKm], [0, 4600, 0, 4600, 23]);
  assert.strictEqual(d.total.net, 26360); assert.strictEqual(d.total.rent + d.total.dieselCost - d.total.recover, d.total.net);
  assert.deepStrictEqual(d.groups.map(g => g.ownership), ['Own', 'Rental']);
});

test('"Debit to" and Debit Notes: entry → pending → note (numbers, GST, TDS) → ledger; one entry in one note only', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'DT-OWN', name: 'Own JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-07-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Joy Kumar', gstReg: 'No', pan: 'ABCDE1234J', bank: 'SBI', account: '12345671', ifsc: 'SBIN0000001' }, 'add');
  // the rate is needed with the party; an unknown party is refused
  const refused = l => { let out = ''; try { out = JSON.stringify(run('x => saveLogRowsInner_(x)', { rows: [Object.assign({ date: '2026-07-01', shift: 'Full Day', no: 'DT-OWN', mode: 'Hrs', openingHr: 10, closingHr: 18 }, l)] })); } catch (e) { out = String(e.message); } return out; };
  assert.match(refused({ debitTo: 'Joy Kumar' }), /type the rate/);
  assert.match(refused({ debitTo: 'Nobody', debitRate: 5 }), /not in the Vendor Master/);
  assert.match(refused({ debitRate: 900 }), /pick the party/);
  run('x => saveLogRowsInner_(x)', { rows: [
    { date: '2026-07-01', shift: 'Full Day', no: 'DT-OWN', mode: 'Hrs', openingHr: 10, closingHr: 18, debitTo: 'joy kumar', debitRate: 1200, work: 'Trench for Joy' },
    { date: '2026-07-02', shift: 'Full Day', no: 'DT-OWN', mode: 'Hrs', closingHr: 23, debitTo: 'Joy Kumar', debitRate: 1200 },
    { date: '2026-07-03', shift: 'Full Day', no: 'DT-OWN', mode: 'Hrs', closingHr: 30 }] });
  const P = run('f => debitPending_(f)', { vendor: 'Joy Kumar', from: '2026-07-01', to: '2026-07-31' });
  assert.deepStrictEqual(P.rows.map(r => [r.date, r.qty, r.unit, r.rate, r.amount]), [['2026-07-01', 8, 'Hrs', 1200, 9600], ['2026-07-02', 5, 'Hrs', 1200, 6000]]);
  const lines = P.rows.map(r => ({ logId: r.logId, machinery: r.no, particular: 'Hire ' + r.date, qty: r.qty, unit: r.unit, rate: r.rate })).concat([{ machinery: '', particular: 'Operator overtime', qty: 2, unit: 'Nos', rate: 500 }]);
  const S = run('x => saveDebitNote_(x)', { company: 'Rachana Construction Limited', vendor: 'Joy Kumar', date: '2026-07-31', from: '2026-07-01', to: '2026-07-31', lines: lines, gstPct: 18, tdsPct: 2 });
  // by hand: 9,600 + 6,000 + 1,000 = 16,600; GST 18 % = 2,988; TDS 2 % = 332; total = 16,600 + 2,988 − 332 = 19,256
  assert.strictEqual(S.no, 'RCL/VTR/DN-001'); assert.strictEqual(S.total, 19256);
  const N = run('f => getDebitNotes_(f)', { id: S.id }).notes[0];
  assert.deepStrictEqual([N.amount, N.gst, N.tds, N.total, N.kind, N.status, N.lines.length], [16600, 2988, 332, 19256, 'Log Book', 'Open', 3]);
  // the entries are now in a note: not offered again, cannot be put in a second note, and their "Debit to" is locked
  assert.strictEqual(run('f => debitPending_(f)', { vendor: 'Joy Kumar', from: '2026-07-01', to: '2026-07-31' }).rows.length, 0);
  assert.throws(() => run('x => saveDebitNote_(x)', { company: 'Rachana Construction Limited', vendor: 'Joy Kumar', date: '2026-07-31', lines: [lines[0]] }), /already in debit note RCL\/VTR\/DN-001/);
  // the next number of the same name, and Sketchline's own run
  assert.strictEqual(run('x => saveDebitNote_(x)', { company: 'Rachana Construction Limited', vendor: 'Joy Kumar', date: '2026-07-31', lines: [{ particular: 'Loading', qty: 1, unit: 'Job', rate: 744 }] }).no, 'RCL/VTR/DN-002');
  assert.strictEqual(run('x => saveDebitNote_(x)', { company: 'Sketchline Industries', vendor: 'Joy Kumar', date: '2026-07-31', lines: [{ particular: 'Loading', qty: 1, unit: 'Job', rate: 100 }] }).no, 'SLI/VTR/DN-001');
  for (const bad of [{ lines: [] }, { lines: [{ particular: 'x', qty: 0, rate: 5 }] }, { lines: [{ particular: 'x', qty: 1, rate: 0 }] }, { lines: [{ particular: '', qty: 1, rate: 5 }] }, { lines: [{ particular: 'x', qty: 1, rate: 5 }], gstPct: 120 }])
    assert.throws(() => run('x => saveDebitNote_(x)', Object.assign({ company: 'Rachana Construction Limited', vendor: 'Joy Kumar', date: '2026-07-31' }, bad)));
  // Vendor Ledger: the three notes lower what is payable to the party: 19,256 + 744 + 100
  const L = run('f => vendorLedger_(f)', { vendor: 'Joy Kumar' });
  assert.strictEqual(L.closing, -(19256 + 744 + 100)); assert.strictEqual(L.rows.filter(r => r.kind === 'dn').length, 3);
  assert.strictEqual(Math.round((L.opening + L.totalBill - L.totalPaid) * 100) / 100, L.closing);
  // cancelled: out of the ledger, and its Log Book entries can go into a new note
  run('id => cancelDebitNote_(id)', S.id);
  assert.strictEqual(run('f => vendorLedger_(f)', { vendor: 'Joy Kumar' }).closing, -(744 + 100));
  assert.strictEqual(run('f => debitPending_(f)', { vendor: 'Joy Kumar', from: '2026-07-01', to: '2026-07-31' }).rows.length, 2);
  assert.strictEqual(run('x => saveDebitNote_(x)', { company: 'Rachana Construction Limited', vendor: 'Joy Kumar', date: '2026-07-31', lines: [{ particular: 'Again', qty: 1, unit: 'Job', rate: 10 }] }).no, 'RCL/VTR/DN-003');
});

test('open Log Book rows are answered in one call: same answers as one by one, a bad row does not stop the others', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const one = run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'DT-OWN', '2026-07-04', 'Full Day');
  const many = run('l => getLogRowPrefills_(l)', [{ no: 'DT-OWN', date: '2026-07-04', shift: 'Full Day' }, { no: 'NO-SUCH-MACHINE', date: '2026-07-04', shift: 'Full Day' }, { no: 'DT-OWN', date: '2026-07-04', shift: 'Full Day' }]);
  assert.strictEqual(many.length, 3);
  assert.deepStrictEqual(many[0], one); assert.deepStrictEqual(many[2], one);
  assert.ok(many[1] && typeof many[1].error === 'string' && many[1].error.length > 0);
  assert.deepStrictEqual(run('l => getLogRowPrefills_(l)', null), []);
});

test('help for errors: every rule has English, Marathi and Hindi; real messages get the right advice; the server\'s messages are covered', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const a = app.indexOf('const FIX_RULES = ['), b = app.indexOf('function fixInner(');
  assert.ok(a > -1 && b > a, 'catalogue found');
  const F = new Function(app.slice(a, b) + '; return { FIX_RULES, FIX_ANY, fixRules };')();
  const deva = /[\u0900-\u097F]/;
  F.FIX_RULES.concat([F.FIX_ANY]).forEach((r, i) => { for (const l of ['en', 'mr', 'hi']) { assert.ok(Array.isArray(r[l]) && r[l].length === 2 && r[l][0].length > 15 && r[l][1].length > 15, 'rule ' + i + ' ' + l); }
    assert.ok(deva.test(r.mr[0]) && deva.test(r.mr[1]) && deva.test(r.hi[0]) && deva.test(r.hi[1]), 'rule ' + i + ' is written in Devanagari'); assert.ok(!deva.test(r.en[0] + r.en[1]), 'rule ' + i + ' English'); });
  const first = m => F.fixRules(m)[0].en.join(' ');
  for (const [msg, want] of [
    ['Date 05-10-2026 is after today (02-10-2026). Entries can be made only up to today.', /future/],
    ['MH-15-AB-0001 (01-09-2026): Close KM 100 is less than Start KM 200.', /closing reading is smaller/],
    ['Not enough diesel at Dispenser for 02-10-2026: stock 20 L, issue 50 L.', /does not have this much diesel/],
    ['"MH-99-ZZ-0000" is not in Master.', /not in the Asset Master/],
    ['JCB-1 is inactive from 01-09-2026. Entry date 02-09-2026.', /not active on the date/],
    ['You have View access only for Diesel Issue. Ask Admin for Edit access.', /permission/],
    ['SESSION_EXPIRED', /signed out/], ['Wrong email or password.', /does not match/],
    ['This entry was just sent twice – it is saved once. Check the list before entering it again.', /saved ONCE/],
    ['Log Book for JCB-1 on 01-09-2026 is already saved.', /already there/],
    ['JCB-1 does not work on "KM" – it works on Hrs.', /way of measuring/],
    ['"Debit to" cannot be saved yet. This needs one database step first: run sql/supabase_step1t_debit_notes.sql', /SQL file/],
    ['Debit to Joy Kumar: type the rate.', /party and the rate/],
    ['This entry is in debit note RCL/VTR/DN-001 – its "Debit to" cannot be changed. Cancel that note first.', /locked/],
    ['GST Number "27ABC" is not in the right format (15 characters, e.g. 27ABCDE1234F1Z5).', /right format/],
    ['Line 1: JCB-1 is not an asset of ABC Earthmovers in Asset Master (its Vendor / Owner Name is XYZ).', /does not belong to this vendor/],
    ['Enter the bill number for ABC Earthmovers.', /bill number/],
    ['Failed to fetch', /NOT saved/], ['Diesel issued on a day with no Log Book entry', /no working Log Book entry/],
    ['Enter Qty (Ltr).', /must be filled/], ['Something nobody has seen before', /could not accept/]])
    assert.match(first(msg), want, msg);
  // every error text the server can throw: how many fall through to the general advice only
  const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  // the written parts of each message (pieces of code between the quotes, like ' + name + ', are left out)
  const msgs = [...code.matchAll(/throw new Error\(([^;]*)/g)].map(m => (m[1].match(/'([^']{6,})'/g) || []).map(s => s.slice(1, -1)).filter(s => !/ \+ |=>|\(.*\)\./.test(s) && /[a-z]{3,} [a-z]{2,}/i.test(s)).join(' … ')).filter(Boolean);
  const general = msgs.filter(m => F.fixRules(m)[0] === F.FIX_ANY);
  assert.ok(msgs.length > 200, 'messages read: ' + msgs.length);
  assert.ok(general.length <= msgs.length * 0.03, general.length + ' of ' + msgs.length + ' server messages have only the general advice:\n' + general.slice(0, 40).join('\n'));
});

test('the app knows itself: every page and report is explained in 3 languages, and every saving action belongs to a described page', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  const a = app.indexOf('const PAGE_GUIDE = {'), b = app.indexOf('const GUIDE_W = ');
  assert.ok(a > -1 && b > a, 'the guide is in the page');
  const G = new Function(app.slice(a, b) + '; return { PAGE_GUIDE, REPORT_GUIDE };')();
  const deva = /[\u0900-\u097F]/;
  const full = (g, what) => { assert.ok(g, what + ' has no entry in the guide – describe it in PAGE_GUIDE / REPORT_GUIDE (App.html)');
    for (const l of ['en', 'mr', 'hi']) assert.ok(Array.isArray(g[l]) && g[l].length === 2 && g[l][0].length > 15 && g[l][1].length > 10, what + ': ' + l + ' text is missing');
    assert.ok(deva.test(g.mr[0]) && deva.test(g.mr[1]) && deva.test(g.hi[0]) && deva.test(g.hi[1]), what + ': Marathi / Hindi must be written in Devanagari'); };
  // every page of the menu
  const tabs = (app.match(/const TABS = \[([^\]]*)\]/) || [])[1].match(/'([a-z0-9-]+)'/g).map(x => x.slice(1, -1));
  assert.ok(tabs.length >= 25, 'pages found: ' + tabs.length);
  tabs.forEach(t => full(G.PAGE_GUIDE[t], 'page "' + t + '"'));
  // every report
  const i0 = app.indexOf('function reportDefs()'), reports = [...app.slice(i0, i0 + 60000).matchAll(/\{ key: '([a-z0-9]+)', label: '/g)].map(m => m[1]);
  assert.ok(reports.length >= 11, 'reports found: ' + reports.length);
  reports.forEach(r => full(G.REPORT_GUIDE[r], 'report "' + r + '"'));
  // every action of the server that writes data (or is Admin-only) is listed under a page; nothing is listed that does not exist
  const api = [...code.matchAll(/^  ([a-zA-Z]+):\s*\{[^}\n]*\}/gm)].map(m => ({ name: m[1], text: m[0] }));
  assert.ok(api.length > 80, 'server actions found: ' + api.length);
  const listed = new Set([].concat(...Object.values(G.PAGE_GUIDE).map(g => g.saves || [])));
  const writers = api.filter(x => /edit: true|admin: true/.test(x.text)).map(x => x.name);
  const orphan = writers.filter(n => !listed.has(n));
  assert.deepStrictEqual(orphan, [], 'saving actions that belong to no described page (add them to "saves" of their page in PAGE_GUIDE): ' + orphan.join(', '));
  const names = new Set(api.map(x => x.name));
  const ghost = [...listed].filter(n => !names.has(n));
  assert.deepStrictEqual(ghost, [], 'the guide lists actions the server does not have: ' + ghost.join(', '));
});

test('meter not working: "No reading" days are paid and counted for the diesel standard; a stuck meter resumes; a new meter starts fresh (hand-worked)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const save = l => { try { return run('x => saveLogRowsInner_(x)', { rows: [Object.assign({ shift: 'Full Day', no: 'NR-1' }, l)] }); } catch (e) { return { ok: false, thrown: String(e.message) }; } };
  const errOf = r => JSON.stringify(r.errors || r.thrown || '');
  run('(x, m) => saveMaster_(x, m)', { no: 'NR-1', name: 'Innova', type: 'Innova', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: 'NR Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'NR-TRIP', name: 'Tipper', type: 'Tipper', unit: 'Trip', worksOn: ['Trip'], owner: 'NR Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'NR Vendor', gstReg: 'No', pan: 'ABCDE1234N', bank: 'SBI', account: '12345673', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'NR Vendor', from: '2026-06-01', tdsPct: 0, woNo: 'WO-N', lines: [{ no: 'NR-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-05-31', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 100, billNo: 'NR1', billDate: '2026-05-31' });
  assert.strictEqual(save({ date: '2026-06-01', mode: 'KM', openingKm: 1000, closingKm: 1100 }).ok, true);
  assert.strictEqual(save({ date: '2026-06-02', mode: 'KM', closingKm: 1160 }).ok, true);
  // the app proposes the machinery's own average of its entries with readings: (100 + 60) / 2 = 80 km
  assert.strictEqual(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'NR-1', '2026-06-03', 'Full Day').avgWork.km, 80);
  // a day without a reading needs the estimate and the reason; a machinery without a meter cannot use it
  assert.match(errOf(save({ date: '2026-06-03', mode: 'No reading', estKm: 80 })), /write why there is no reading/);
  assert.match(errOf(save({ date: '2026-06-03', mode: 'No reading', meterNote: 'odometer stuck' })), /type the estimated KM/);
  assert.match(errOf(save({ date: '2026-06-03', mode: 'No reading', estHr: 5, meterNote: 'x' })), /not measured by hours/);
  assert.match(errOf(save({ no: 'NR-TRIP', date: '2026-06-03', mode: 'No reading', estKm: 5, meterNote: 'x' })), /does not work on|has no meter/);
  assert.strictEqual(save({ date: '2026-06-03', mode: 'No reading', estKm: 80, meterNote: 'odometer stuck' }).ok, true);
  assert.strictEqual(save({ date: '2026-06-04', mode: 'No reading', estKm: 80, meterNote: 'odometer stuck' }).ok, true);
  // the meter works again: Start is the last reading BEFORE the gap (1160); a lower Start is refused, an empty one takes 1160
  assert.strictEqual(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'NR-1', '2026-06-05', 'Full Day').openingKm, 1160);
  assert.match(errOf(save({ date: '2026-06-05', mode: 'KM', openingKm: 5, closingKm: 1200 })), /Start KM 5 is less than the last Close KM 1160/);
  assert.strictEqual(save({ date: '2026-06-05', mode: 'KM', closingKm: 1200 }).ok, true);
  // a NEW meter: a lower reading is refused as usual, and accepted when the entry is marked "new meter" with a reason
  assert.match(errOf(save({ date: '2026-06-06', mode: 'KM', closingKm: 120 })), /less than Start KM 1200/);
  assert.match(errOf(save({ date: '2026-06-06', mode: 'KM', meter: 'new', openingKm: 50, closingKm: 120 })), /New meter: write what was done/);
  assert.strictEqual(save({ date: '2026-06-06', mode: 'KM', meter: 'new', openingKm: 50, closingKm: 120, meterNote: 'new speedometer fitted' }).ok, true);
  assert.strictEqual(save({ date: '2026-06-07', mode: 'KM', closingKm: 180 }).ok, true);
  const rows = () => run('f => getLogBookList_(f)', { from: '2026-06-01', to: '2026-06-30', no: 'NR-1', all: true }).rows.sort((a, b) => a.date < b.date ? -1 : 1).map(r => [r.date.slice(8), r.mode || r.unit, r.okm, r.ckm, r.wkm, r.meter || '']);
  assert.deepStrictEqual(rows(), [
    ['01', 'KM', 1000, 1100, 100, ''], ['02', 'KM', 1100, 1160, 60, ''],
    ['03', 'No reading', '', '', 80, 'No reading – odometer stuck'], ['04', 'No reading', '', '', 80, 'No reading – odometer stuck'],
    ['05', 'KM', 1160, 1200, 40, ''], ['06', 'KM', 50, 120, 70, 'New meter – new speedometer fitted'], ['07', 'KM', 120, 180, 60, '']]);
  // the bill: 7 days of a 30-day month at 30,000 = 7,000; work 100+60+80+80+40+70+60 = 490 km → 49 L allowed; 55 L issued → 6 L over × 100 = 600
  run('x => saveDieselIssue_(x)', { date: '2026-06-01', shift: 'Day', source: 'Dispenser', no: 'NR-1', qty: 55, kmReading: 1000, force: true });
  const bill = () => { const from = '2026-06-01', to = '2026-06-30', list = run('f => getLogBookList_(f)', { from: from, to: to, no: 'NR-1', all: true }).rows, extra = run('f => logPrintExtra_(f)', { from: from, to: to, nos: ['NR-1'] });
    return run('(l, e, f, t) => billMachineCalc_(findMachine_("NR-1"), l, e, f, t, undefined, true)', list, extra, from, to); };
  let b = bill();
  // (that single fill of the 1st is also the LAST fill: after it 390 km = 39 L, so 16 L of it count as still in the tank → the 6 L are not debited)
  assert.deepStrictEqual([b.workDays, b.amount, b.issued, b.rawExcess, b.excessQty, b.excessAmt], [7, 7000, 55, 6, 0, 0]);
  // a correction of an earlier reading re-links only what must follow it: 02-06 closes at 1170 → 05-06 starts at 1170 (30 km);
  // the estimates and the new meter's Start are untouched
  const key02 = run('f => getLogBookList_(f)', { from: '2026-06-02', to: '2026-06-02', no: 'NR-1', all: true }).rows[0];
  run('(k, l) => updateLogRow_(k, l)', key02.key || ('NR-1|2026-06-02|Full Day'), { closingKm: 1170, work: '' });
  assert.deepStrictEqual(rows().map(r => [r[0], r[2], r[3], r[4]]), [['01', 1000, 1100, 100], ['02', 1100, 1170, 70], ['03', '', '', 80], ['04', '', '', 80], ['05', 1170, 1200, 30], ['06', 50, 120, 70], ['07', 120, 180, 60]]);
  b = bill(); assert.deepStrictEqual([b.workDays, b.rawExcess], [7, 6]);   // 70+30 instead of 60+40: the same 490 km
  // the estimate of a "No reading" day can be corrected in the edit window; deleting such a day leaves the chain intact
  run('(k, l) => updateLogRow_(k, l)', 'NR-1|2026-06-03|Full Day', { estKm: 90, meterNote: 'odometer stuck', work: '' });
  assert.strictEqual(rows()[2][4], 90);
  run('k => deleteLogRow_(k)', 'NR-1|2026-06-04|Full Day');
  assert.deepStrictEqual(rows().map(r => [r[0], r[2], r[3], r[4]]), [['01', 1000, 1100, 100], ['02', 1100, 1170, 70], ['03', '', '', 90], ['05', 1170, 1200, 30], ['06', 50, 120, 70], ['07', 120, 180, 60]]);
  // a machinery whose meter does not work from its FIRST day: nothing of its own to average → the average of the other machinery of
  // its type (entries with readings: 100, 70, 30, 70, 60 → 66); the day is saved; its first entry WITH a reading types its Start
  run('(x, m) => saveMaster_(x, m)', { no: 'NR-2', name: 'Innova', type: 'Innova', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: 'NR Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  const a2 = run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'NR-2', '2026-06-08', 'Full Day').avgWork;
  assert.deepStrictEqual([a2.km, a2.src, a2.type], [66, 'type', 'Innova']);
  assert.strictEqual(save({ no: 'NR-2', date: '2026-06-08', mode: 'No reading', estKm: 66, meterNote: 'meter not working since it came' }).ok, true);
  assert.strictEqual(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'NR-2', '2026-06-09', 'Full Day').firstKm, true);
  assert.strictEqual(save({ no: 'NR-2', date: '2026-06-09', mode: 'KM', openingKm: 500, closingKm: 560 }).ok, true);
  assert.deepStrictEqual(run('f => getLogBookList_(f)', { from: '2026-06-01', to: '2026-06-30', no: 'NR-2', all: true }).rows.sort((x, y) => x.date < y.date ? -1 : 1).map(r => [r.date.slice(8), r.okm, r.ckm, r.wkm]), [['08', '', '', 66], ['09', 500, 560, 60]]);
  // a type with no other machinery: nothing is proposed (the person types the day's work)
  run('(x, m) => saveMaster_(x, m)', { no: 'NR-3', name: 'Crane', type: 'Crane', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 6, owner: 'NR Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  assert.deepStrictEqual((a => [a.km, a.hr, a.src])(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'NR-3', '2026-06-08', 'Full Day').avgWork), ['', '', '']);
  // diesel can be issued without a reading while the meter is not working
  const di = run('x => saveDieselIssue_(x)', { date: '2026-06-03', shift: 'Day', source: 'Dispenser', no: 'NR-1', qty: 20, mode: 'No reading' });
  assert.ok(di && di.ok !== false && di.id, JSON.stringify(di));
});


test('Start reading: automatic, may be typed HIGHER (the machinery ran elsewhere), never lower; corrections follow only what was linked (hand-worked)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryIt = f => { try { return f(); } catch (e) { return { ok: false, thrown: String(e.message) }; } };
  const save = l => tryIt(() => run('x => saveLogRowsInner_(x)', { rows: [Object.assign({ shift: 'Full Day', no: 'GAP-1', mode: 'KM' }, l)] }));
  const edit = (d, l) => tryIt(() => run('(k, l) => updateLogRow_(k, l)', 'GAP-1|' + d + '|Full Day', Object.assign({ work: '' }, l)));
  const errOf = r => JSON.stringify(r.errors || r.thrown || '');
  const rows = () => run('f => getLogBookList_(f)', { from: '2026-07-01', to: '2026-07-31', no: 'GAP-1', all: true }).rows.sort((a, b) => a.date < b.date ? -1 : 1).map(r => [r.date.slice(8), r.okm, r.ckm, r.wkm]);
  run('(x, m) => saveMaster_(x, m)', { no: 'GAP-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Gap Vendor', ownership: 'Rental', supply: 'Debit Basis', status: 'Active', activeFrom: '2026-07-01' }, 'add');
  assert.strictEqual(save({ date: '2026-07-01', openingKm: 1000, closingKm: 1100 }).ok, true);
  // the next day the meter shows 1150: it ran 50 km for someone else – typed, accepted, and those 50 km are in no entry
  assert.match(errOf(save({ date: '2026-07-02', openingKm: 1090, closingKm: 1200 })), /Start KM 1090 is less than the last Close KM 1100 \(01-07-2026\)/);
  assert.strictEqual(save({ date: '2026-07-02', openingKm: 1150, closingKm: 1200 }).ok, true);
  assert.strictEqual(save({ date: '2026-07-03', closingKm: 1260 }).ok, true);                 // nothing typed: Start = the last Close
  assert.deepStrictEqual(rows(), [['01', 1000, 1100, 100], ['02', 1150, 1200, 50], ['03', 1200, 1260, 60]]);   // work 210 km, the gap of 50 is not counted
  // a correction of the 1st: Close 1120 – the 2nd was typed higher (1150), it stays
  assert.strictEqual(edit('2026-07-01', { closingKm: 1120 }).ok, true);
  assert.deepStrictEqual(rows(), [['01', 1000, 1120, 120], ['02', 1150, 1200, 50], ['03', 1200, 1260, 60]]);
  // Close 1170 passes the Start of the 2nd: that Start is lifted to 1170 (never below the Close before it)
  assert.strictEqual(edit('2026-07-01', { closingKm: 1170 }).ok, true);
  assert.deepStrictEqual(rows(), [['01', 1000, 1170, 170], ['02', 1170, 1200, 30], ['03', 1200, 1260, 60]]);
  // the 3rd was LINKED to the Close of the 2nd (1200): when that Close is corrected to 1190, it follows
  assert.strictEqual(edit('2026-07-02', { closingKm: 1190 }).ok, true);
  assert.deepStrictEqual(rows(), [['01', 1000, 1170, 170], ['02', 1170, 1190, 20], ['03', 1190, 1260, 70]]);
  // in the edit window too: a Start below the Close before it is refused, a higher one is taken
  assert.match(errOf(edit('2026-07-03', { openingKm: 1180, closingKm: 1260 })), /Start KM 1180 is less than the last Close KM 1190/);
  assert.strictEqual(edit('2026-07-03', { openingKm: 1195, closingKm: 1260 }).ok, true);
  assert.deepStrictEqual(rows()[2], ['03', 1195, 1260, 65]);
  // deleting the 2nd: the 3rd was not linked to it (1195 ≠ 1190) and keeps its Start
  run('k => deleteLogRow_(k)', 'GAP-1|2026-07-02|Full Day');
  assert.deepStrictEqual(rows(), [['01', 1000, 1170, 170], ['03', 1195, 1260, 65]]);
  // the app proposes the last Close for the next entry, as before
  assert.strictEqual(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'GAP-1', '2026-07-04', 'Full Day').openingKm, 1260);
});

test('renaming a vendor: its assets, BOQ, payments, Log Book and diesel entries follow the new name; joining two parties is refused', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryIt = f => { try { return f(); } catch (e) { return { ok: false, thrown: String(e.message) }; } };
  const det = { gstReg: 'No', pan: 'ABCDE1234P', bank: 'SBI', account: '12345676', ifsc: 'SBIN0000001' };
  for (const n of ['RN-1', 'RN-2']) run('(x, m) => saveMaster_(x, m)', { no: n, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Old Name Co', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'RN-9', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Someone Else', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'Old Name Co' }, det), 'add');
  run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'Someone Else' }, det, { pan: 'ABCDE1234Q', account: '12345677' }), 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Old Name Co', from: '2026-08-01', tdsPct: 2, woNo: 'WO-RN', lines: [{ no: 'RN-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-07-31', location: 'Dispenser', pump: 'Pump', qty: 500, rate: 100, billNo: 'RN1', billDate: '2026-07-31' });
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-08-01', shift: 'Full Day', no: 'RN-1', mode: 'KM', openingKm: 100, closingKm: 180 }] });
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-08-01', shift: 'Full Day', no: 'RN-9', mode: 'KM', openingKm: 10, closingKm: 60, debitTo: 'Old Name Co', debitRate: 50 }] });
  run('x => saveDieselIssue_(x)', { date: '2026-08-01', shift: 'Day', source: 'Dispenser', no: 'RN-1', qty: 20, kmReading: 100, force: true });
  run('(x, m) => savePayment_(x, m)', { type: 'Payment', vendor: 'Old Name Co', date: '2026-08-05', amount: 5000, mode: 'NEFT' }, 'add');
  // joining two parties by a rename is refused, and nothing changes
  const no = tryIt(() => run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'Someone Else', oldName: 'Old Name Co' }, det), 'edit'));
  assert.match(String(no.thrown), /already a vendor/);
  assert.deepStrictEqual(run('() => getMaster_().filter(m => /^RN-[12]$/.test(m.id)).map(m => m.owner)'), ['Old Name Co', 'Old Name Co']);
  // the rename
  const res = run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'New Name Pvt Ltd', oldName: 'Old Name Co' }, det), 'edit');
  assert.strictEqual(res.ok, true); assert.deepStrictEqual([res.renamed.from, res.renamed.to], ['Old Name Co', 'New Name Pvt Ltd']);
  assert.deepStrictEqual(res.renamed.moved, { assets: 2, BOQs: 1, payments: 1, 'Log Book entries': 2, 'diesel issues': 1 });
  // the assets stay with the vendor under its new name; the old name is gone; the other vendor is untouched
  assert.deepStrictEqual(run('() => getMaster_().filter(m => /^RN-/.test(m.id)).map(m => m.id + ":" + m.owner)'), ['RN-1:New Name Pvt Ltd', 'RN-2:New Name Pvt Ltd', 'RN-9:Someone Else']);
  const vs = res.vendors.filter(v => /Name|Someone/.test(v.name)).map(v => [v.name, v.saved, v.machines.length, v.pan]);
  assert.deepStrictEqual(vs.sort(), [['New Name Pvt Ltd', true, 2, 'ABCDE1234P'], ['Someone Else', true, 1, 'ABCDE1234Q']]);
  // BOQ, Log Book (owner and "Debit to"), diesel issue and the ledger are under the new name
  assert.deepStrictEqual(run('f => getBoqs_(f).boqs.map(b => b.vendor)', { vendor: 'New Name Pvt Ltd' }), ['New Name Pvt Ltd']);
  const lg = run('f => getLogBookList_(f)', { from: '2026-08-01', to: '2026-08-01', all: true }).rows.filter(r => /^RN-/.test(r.no)).map(r => [r.no, r.owner, r.debitTo || '']).sort();
  assert.deepStrictEqual(lg, [['RN-1', 'New Name Pvt Ltd', ''], ['RN-9', 'Someone Else', 'New Name Pvt Ltd']]);
  assert.deepStrictEqual(run('() => { const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_); return t.rows.filter(r => /^RN-/.test(r[t.c[H.NO]])).map(r => r[t.c[H.OWNER]]); }'), ['New Name Pvt Ltd']);
  const led = run('f => vendorLedger_(f)', { vendor: 'New Name Pvt Ltd' });
  assert.ok(JSON.stringify(led).indexOf('5000') > -1, 'the payment is in the ledger of the new name');
  assert.strictEqual(JSON.stringify(run('f => vendorLedger_(f)', { vendor: 'Old Name Co' })).indexOf('5000'), -1, 'nothing is left under the old name');
  // a new entry for its machinery takes the new owner name by itself
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-08-02', shift: 'Full Day', no: 'RN-1', mode: 'KM', closingKm: 250 }] });
  assert.strictEqual(run('f => getLogBookList_(f)', { from: '2026-08-02', to: '2026-08-02', no: 'RN-1', all: true }).rows[0].owner, 'New Name Pvt Ltd');
});


test('the last fill of the period is partly still in the tank: not debited, this period only (the MD\'s example, hand-worked); page = server', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'TK-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.6, owner: 'Tank Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-05-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Tank Vendor', gstReg: 'No', pan: 'ABCDE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Tank Vendor', from: '2026-05-01', tdsPct: 0, woNo: 'WO-T', lines: [{ no: 'TK-1', basis: 'Monthly', rate: 31000, diesel: 'Company' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-04-30', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 100, billNo: 'TK1', billDate: '2026-04-30' });
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-05-28', shift: 'Full Day', no: 'TK-1', mode: 'KM', openingKm: 1000, closingKm: 1134 }, { date: '2026-05-29', shift: 'Full Day', no: 'TK-1', mode: 'KM', closingKm: 1234 }, { date: '2026-05-30', shift: 'Full Day', no: 'TK-1', mode: 'KM', closingKm: 1280 }] });
  run('x => saveDieselIssue_(x)', { date: '2026-05-28', shift: 'Day', source: 'Dispenser', no: 'TK-1', qty: 60, kmReading: 1000, force: true });
  const last = run('x => saveDieselIssue_(x)', { date: '2026-05-30', shift: 'Day', source: 'Dispenser', no: 'TK-1', qty: 30, kmReading: 1234, force: true });
  const calc = () => { const from = '2026-05-01', to = '2026-05-31', list = run('f => getLogBookList_(f)', { from: from, to: to, no: 'TK-1', all: true }).rows, extra = run('f => logPrintExtra_(f)', { from: from, to: to, nos: ['TK-1'] });
    return { list: list, extra: extra, b: run('(l, e, f, t) => billMachineCalc_(findMachine_("TK-1"), l, e, f, t, undefined, true)', list, extra, from, to) }; };
  // work 134 + 100 + 46 = 280 km ÷ 4.6 = 60.87 L; issued 90 L → 29.13 L over. Last fill: 30 L at 1234; closed at 1280 → 46 km = 10 L;
  // 20 L are still in the tank → debited: 29.13 − 20 = 9.13 L × 100 = 913
  let x = calc();
  assert.deepStrictEqual([x.b.issued, x.b.rawExcess, x.b.excessQty, x.b.excessAmt], [90, 29.13, 9.13, 913]);
  assert.deepStrictEqual([x.b.tank.date, x.b.tank.qty, x.b.tank.km, x.b.tank.kmAfter, x.b.tank.used, x.b.tank.left, x.b.tank.applied, x.b.tank.by], ['2026-05-30', 30, 1234, 46, 10, 20, 20, 'reading']);
  // the page works out the same
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const grab = m => { const i = app.indexOf(m); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const P = new Function('r2', 'hasKm', 'hasHr', grab('function tankLeft(') + '; return tankLeft;')(n => Math.round(n * 100) / 100, u => u === 'KM' || u === 'KM + Hrs', u => u === 'Hrs' || u === 'KM + Hrs');
  assert.deepStrictEqual(P({ kmStd: 4.6 }, 'KM', x.list, x.extra.issues.TK1, () => false, 29.13), x.b.tank);
  // FINAL BILL: the machinery is Inactive from 31-05-2026 (it left the site) → nothing is taken as "in the tank": the whole 29.13 L are debited
  run('(x, m, o) => saveMaster_(x, m, o)', { no: 'TK-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.6, owner: 'Tank Vendor', ownership: 'Rental', supply: 'Company', status: 'Inactive', activeFrom: '2026-05-01', inactiveFrom: '2026-05-31' }, 'edit', 'TK-1');
  x = calc(); assert.deepStrictEqual([x.b.final, x.b.tank, x.b.excessQty, x.b.excessAmt], ['2026-05-31', null, 29.13, 2913]);
  run('(x, m, o) => saveMaster_(x, m, o)', { no: 'TK-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.6, owner: 'Tank Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-05-01' }, 'edit', 'TK-1');
  // Tank Capacity 15 L in Asset Master: never more than the tank holds → 15 L left out, 14.13 L debited
  run('(x, m, o) => saveMaster_(x, m, o)', { no: 'TK-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.6, tankCap: 15, owner: 'Tank Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-05-01' }, 'edit', 'TK-1');
  x = calc(); assert.deepStrictEqual([x.b.tank.left, x.b.excessQty], [15, 14.13]);
  run('(x, m, o) => saveMaster_(x, m, o)', { no: 'TK-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4.6, tankCap: '', owner: 'Tank Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-05-01' }, 'edit', 'TK-1');
  // the last fill has NO reading: the work of the days after the fill date is used – none here → the whole 30 L are in the tank → nothing debited
  run('(id, x) => updateDieselIssue_(id, x)', last.id, { date: '2026-05-30', shift: 'Day', source: 'Dispenser', no: 'TK-1', qty: 30, mode: 'No reading', force: true });
  x = calc(); assert.deepStrictEqual([x.b.tank.by, x.b.tank.used, x.b.tank.left, x.b.tank.applied, x.b.excessQty], ['days', 0, 30, 29.13, 0]);
  // no Log Book entry on / after the fill (the 30th is deleted): work 234 km = 50.87 L, 39.13 L over; the whole fill of 30 L is in the tank → 9.13 L
  run('(id, x) => updateDieselIssue_(id, x)', last.id, { date: '2026-05-30', shift: 'Day', source: 'Dispenser', no: 'TK-1', qty: 30, kmReading: 1234, force: true });
  run('k => deleteLogRow_(k)', 'TK-1|2026-05-30|Full Day');
  x = calc(); assert.deepStrictEqual([x.b.rawExcess, x.b.tank.kmAfter, x.b.tank.left, x.b.excessQty], [39.13, 0, 30, 9.13]);
});

test('month close: nothing dated in a closed period can be added, changed or deleted – diesel, Log Book, inward; the Admin reopens', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryIt = f => { try { const r = f(); return r && r.ok === false ? { err: JSON.stringify(r.errors || r) } : { ok: true, r: r }; } catch (e) { return { err: String(e.message) }; } };
  const closed = /entries up to 30-04-2026 are closed \(month closed by the Admin\)/;
  run('(x, m) => saveMaster_(x, m)', { no: 'LK-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Lock Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-04-01' }, 'add');
  const inw = run('x => saveInward_(x)', { date: '2026-04-01', location: 'Dispenser', pump: 'Pump', qty: 800, rate: 100, billNo: 'LK1', billDate: '2026-04-01' });
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-04-10', shift: 'Full Day', no: 'LK-1', mode: 'KM', openingKm: 100, closingKm: 200 }] });
  const di = run('x => saveDieselIssue_(x)', { date: '2026-04-10', shift: 'Day', source: 'Dispenser', no: 'LK-1', qty: 25, kmReading: 100, force: true });
  // a date after today cannot be closed; then April is closed
  assert.match(tryIt(() => run('x => saveBooksLock_(x)', { upto: '2099-01-01' })).err, /after today/);
  assert.deepStrictEqual(run('x => saveBooksLock_(x)', { upto: '2026-04-30' }), { ok: true, upto: '2026-04-30', was: '' });
  assert.strictEqual(run('() => getInit_().closedUpto'), '2026-04-30');
  // Log Book: add, edit, delete in April – refused; May – allowed
  assert.match(tryIt(() => run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-04-15', shift: 'Full Day', no: 'LK-1', mode: 'KM', closingKm: 260 }] })).err, closed);
  assert.match(tryIt(() => run('(k, l) => updateLogRow_(k, l)', 'LK-1|2026-04-10|Full Day', { closingKm: 210, work: '' })).err, closed);
  assert.match(tryIt(() => run('k => deleteLogRow_(k)', 'LK-1|2026-04-10|Full Day')).err, closed);
  assert.strictEqual(tryIt(() => run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-05-01', shift: 'Full Day', no: 'LK-1', mode: 'KM', closingKm: 260 }] })).ok, true);
  // Diesel Issue: add, change (also when only the NEW date is open), delete – refused
  assert.match(tryIt(() => run('x => saveDieselIssue_(x)', { date: '2026-04-20', shift: 'Day', source: 'Dispenser', no: 'LK-1', qty: 10, kmReading: 200, force: true })).err, closed);
  assert.match(tryIt(() => run('(id, x) => updateDieselIssue_(id, x)', di.id, { date: '2026-05-01', shift: 'Day', source: 'Dispenser', no: 'LK-1', qty: 30, kmReading: 100, force: true })).err, closed);
  assert.match(tryIt(() => run('id => deleteDieselIssue_(id)', di.id)).err, closed);
  // Diesel Inward: add in April and delete the April one – refused
  assert.match(tryIt(() => run('x => saveInward_(x)', { date: '2026-04-28', location: 'Dispenser', pump: 'Pump', qty: 100, rate: 100, billNo: 'LK2', billDate: '2026-04-28' })).err, closed);
  assert.match(tryIt(() => run('id => deleteInward_(id)', inw.id)).err, closed);
  // … an inward of May whose pump bill is dated in April is fine (only the entry date is closed)
  assert.strictEqual(tryIt(() => run('x => saveInward_(x)', { date: '2026-05-02', location: 'Dispenser', pump: 'Pump', qty: 100, rate: 100, billNo: 'LK3', billDate: '2026-04-29' })).ok, true);
  // nothing was changed by the refused attempts
  assert.deepStrictEqual(run('f => getLogBookList_(f)', { from: '2026-04-01', to: '2026-04-30', no: 'LK-1', all: true }).rows.map(r => [r.date, r.okm, r.ckm]), [['2026-04-10', 100, 200]]);
  // the Admin reopens: the April entry can be corrected again
  assert.deepStrictEqual(run('x => saveBooksLock_(x)', { upto: '' }), { ok: true, upto: '', was: '2026-04-30' });
  assert.strictEqual(tryIt(() => run('(k, l) => updateLogRow_(k, l)', 'LK-1|2026-04-10|Full Day', { closingKm: 210, work: '' })).ok, true);
});

test('settings: every user has own settings (checked, kept apart); the site rule "days back" stops a user who is not Admin, not the Admin', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryIt = f => { try { const r = f(); return r && r.ok === false ? { err: JSON.stringify(r.errors || r) } : { ok: true, r: r }; } catch (e) { return { err: String(e.message) }; } };
  const A = { email: 'a@x.test', name: 'A' }, B = { email: 'b@x.test', name: 'B' };
  // as the app comes: light theme, Marathi help, nothing chosen
  let p = run('u => getMyPrefs_(u)', A).prefs;
  assert.deepStrictEqual([p.theme, p.text, p.lang, p.lbDays, p.start, p.fav, p.photo, p.intro, p.sound], ['light', 'normal', 'mr', '2', '', [], '', true, false]);
  // A chooses; only what the app knows is kept, a wrong value falls back, B is not touched
  p = run('(u, x) => saveMyPrefs_(u, x)', A, { theme: 'dark', text: 'huge', lang: 'en', lbDays: '7', start: 'log', fav: ['log', 'diesel', 'log', 'BAD TAB'], sound: true, admin: true, somethingElse: 'x' }).prefs;
  assert.deepStrictEqual([p.theme, p.text, p.lang, p.lbDays, p.start, p.fav, p.sound, p.admin, p.somethingElse], ['dark', 'normal', 'en', '7', 'log', ['log', 'diesel'], true, undefined, undefined]);
  p = run('(u, x) => saveMyPrefs_(u, x)', A, { density: 'compact' }).prefs;              // one change keeps the others
  assert.deepStrictEqual([p.theme, p.density, p.lang], ['dark', 'compact', 'en']);
  assert.strictEqual(run('u => getMyPrefs_(u)', B).prefs.theme, 'light');
  // a photo must be a small picture; a mobile number 10 digits
  assert.match(tryIt(() => run('(u, x) => saveMyPrefs_(u, x)', A, { photo: 'javascript:alert(1)' })).err, /must be a picture/);
  assert.match(tryIt(() => run('(u, x) => saveMyPrefs_(u, x)', A, { photo: 'data:image/jpeg;base64,' + 'A'.repeat(80000) })).err, /too big/);
  assert.match(tryIt(() => run('(u, x) => saveMyPrefs_(u, x)', A, { mobile: '12345' })).err, /10 digits/);
  assert.strictEqual(run('(u, x) => saveMyPrefs_(u, x)', A, { photo: 'data:image/jpeg;base64,AAAA', mobile: '98220 12345' }).prefs.mobile, '9822012345');
  // ---- rule of the site: a user who is not Admin enters / changes only the last 3 days ----
  const today = run('() => today_()'), day = n => run('(d, n) => addDays_(d, n)', today, n), closed = /older than 3 days can be made or changed only by the Admin/;
  run('(x, m) => saveMaster_(x, m)', { no: 'RL-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rule Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: day(-40) }, 'add');
  assert.match(tryIt(() => run('x => saveSiteRules_(x)', { backDays: 'many' })).err, /whole number/);
  assert.deepStrictEqual(run('x => saveSiteRules_(x)', { backDays: '3', announce: '  Fill every entry by the 30th  ' }).rules, { backDays: 3, announce: 'Fill every entry by the 30th' });
  assert.deepStrictEqual(run('() => getInit_().rules'), { backDays: 3, announce: 'Fill every entry by the 30th' });
  const asUser = (admin, f) => { run('a => { ACTOR_ADMIN_ = a; }', admin); try { return f(); } finally { run('() => { ACTOR_ADMIN_ = true; }'); } };
  const entry = d => ({ rows: [{ date: d, shift: 'Full Day', no: 'RL-1', mode: 'KM', openingKm: 100, closingKm: 150 }] });
  assert.match(asUser(false, () => tryIt(() => run('x => saveLogRowsInner_(x)', entry(day(-10))))).err, closed);          // 10 days back: refused for a user
  assert.strictEqual(asUser(true, () => tryIt(() => run('x => saveLogRowsInner_(x)', entry(day(-10))))).ok, true);        // the Admin may
  assert.match(asUser(false, () => tryIt(() => run('k => deleteLogRow_(k)', 'RL-1|' + day(-10) + '|Full Day'))).err, closed);   // … and the user cannot delete it either
  assert.strictEqual(asUser(false, () => tryIt(() => run('x => saveLogRowsInner_(x)', { rows: [{ date: day(-3), shift: 'Full Day', no: 'RL-1', mode: 'KM', closingKm: 200 }] }))).ok, true);   // 3 days back: inside the rule
  // no limit again
  assert.deepStrictEqual(run('x => saveSiteRules_(x)', { backDays: '', announce: '' }).rules, { backDays: '', announce: '' });
  assert.strictEqual(asUser(false, () => tryIt(() => run('k => deleteLogRow_(k)', 'RL-1|' + day(-10) + '|Full Day'))).ok, true);
});

test('ownership "Debit": a party that takes diesel on debit basis – its own group in the reports, diesel supply always Debit Basis; back to Rental when changed', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const one = () => run('() => getMaster_().filter(m => m.id === "Debit Party X").map(m => [m.ownership, m.supply, m.owner])[0]');
  // only a name is needed for a Debit party (no "works on", no standard average)
  run('(x, m) => saveMaster_(x, m)', { no: '', name: 'Debit Party X', type: 'Outside party', owner: 'Debit Party X', ownership: 'Debit', supply: 'Company', status: 'Active' }, 'add');
  assert.deepStrictEqual(one(), ['Debit', 'Debit Basis', 'Debit Party X']);          // "Company" sent by the form is overruled: Debit = Debit Basis
  run('x => saveInward_(x)', { date: '2026-03-01', location: 'Dispenser', pump: 'Pump', qty: 500, rate: 90, billNo: 'DBX1', billDate: '2026-03-01' });
  run('x => saveDieselIssue_(x)', { date: '2026-03-05', shift: 'Day', source: 'Dispenser', no: 'Debit Party X', qty: 40, force: true });
  const groups = () => run('f => rptOwner_(f).owners.filter(o => o.owner === "Debit Party X").map(o => [o.ownership, o.qty])', { from: '2026-03-01', to: '2026-03-31' });
  assert.deepStrictEqual(groups(), [['Debit', 40]]);                                  // shown under Debit, not under Rental
  assert.deepStrictEqual(run('f => rptOwner_(f).owners.filter(o => o.owner === "Debit Party X").length', { from: '2026-03-01', to: '2026-03-31', ownerships: ['Rental'] }), 0);
  // taken out of Debit: a Rental machinery needs what it works on; its diesel supply is Company again and its issues move with it
  assert.throws(() => run('(x, m, o) => saveMaster_(x, m, o)', { no: '', name: 'Debit Party X', owner: 'Debit Party X', ownership: 'Rental', status: 'Active' }, 'edit', 'Debit Party X'), /tick what it works on/);
  run('(x, m, o) => saveMaster_(x, m, o)', { no: '', name: 'Debit Party X', owner: 'Debit Party X', ownership: 'Rental', worksOn: ['Hrs'], hrStd: 3, supply: 'Company', status: 'Active' }, 'edit', 'Debit Party X');
  assert.deepStrictEqual(one(), ['Rental', 'Company', 'Debit Party X']);
  assert.deepStrictEqual(groups(), [['Rental', 40]]);
  // and back
  run('(x, m, o) => saveMaster_(x, m, o)', { no: '', name: 'Debit Party X', owner: 'Debit Party X', ownership: 'debit', worksOn: ['Hrs'], hrStd: 3, status: 'Active' }, 'edit', 'Debit Party X');
  assert.deepStrictEqual(one(), ['Debit', 'Debit Basis', 'Debit Party X']);
});

test('two engines, one tank (transit mixer, KM + Hrs): the hour engine at its standard, the rest of the diesel is the vehicle engine\'s (the MD\'s rule, his figures)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const avg = (d, km, hr, ks, hs) => run('(d, km, hr, ks, hs) => dualAvg_(d, km, hr, ks, hs)', d, km, hr, ks, hs);
  // his example (MH-25-AJ-2169, 01 to 03-10-2026): 60 L, 102.4 km, 1.8 hr, standard 1.5 km/L + 3 L/hr
  //   drum: 1.8 × 3 = 5.4 L;  vehicle: 60 − 5.4 = 54.6 L;  102.4 ÷ 54.6 = 1.8755 → 1.88 km/L
  let a = avg(60, 102.4, 1.8, 1.5, 3);
  assert.deepStrictEqual([a.hrDiesel, a.kmDiesel, a.kmpl, a.lph, a.text], [5.4, 54.6, 1.88, 3, '1.88 km/L + 3 L/hr (std)']);
  // September, MH-04-KU-3332: 1,140 L against 86.4 km and 7.9 hr → drum 23.7 L, vehicle 1,116.3 L → 0.08 km/L (the Log Book is missing most of the month)
  a = avg(1140, 86.4, 7.9, 1.5, 3);
  assert.deepStrictEqual([a.hrDiesel, a.kmDiesel, a.kmpl], [23.7, 1116.3, 0.08]);
  // the hours alone need more than the diesel given: no average is made up
  a = avg(60, 100, 25, 1.5, 3);
  assert.deepStrictEqual([a.kmpl, a.lph, a.text], ['', '', 'hours need 75 L, 60 L given – check readings']);
  // only KM worked / no hour standard → km ÷ diesel; only hours worked → diesel ÷ hours
  assert.strictEqual(avg(60, 102.4, 0, 1.5, 3).text, '1.71 km/L');
  assert.strictEqual(avg(60, 100, 5, 1.5, 0).text, '1.67 km/L');        // no hour standard in the Master: 100 ÷ 60
  assert.strictEqual(avg(60, 0, 10, 1.5, 3).text, '6 L/hr');
  assert.strictEqual(avg(0, 100, 5, 1.5, 3).text, '');
  // the one-meter machinery are untouched
  assert.strictEqual(run('() => avgText_("KM", 60, 600, 0, 10, 0)'), '10 km/L');
  assert.strictEqual(run('() => avgText_("Hrs", 60, 0, 20, 0, 3)'), '3 L/hr');
  assert.strictEqual(run('() => avgText_("KM + Hrs", 60, 102.4, 1.8, 1.5, 3)'), '1.88 km/L + 3 L/hr (std)');
});

test('faults: a fault of the app or of the database is told apart from a refusal; each is written once with who / where / what, and counted for the Admin', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // what is a fault and what is not
  assert.strictEqual(run('() => { try { null.x; } catch (e) { return faultKind_(e); } }'), 'server');                       // a TypeError of the code
  assert.strictEqual(run('() => faultKind_(new Error("Close KM 5 cannot be less than Start KM 9."))'), '');                   // a refusal of a wrong entry: not a fault
  assert.strictEqual(run('() => faultKind_(new Error("The database did not answer in time."))'), 'database');
  assert.strictEqual(run('() => faultKind_(new Error("Database (web_write): 503 upstream"))'), 'database');
  assert.strictEqual(run('() => faultKind_("Enter the Vendor Name.")'), '');
  // written down, newest first, with the count of today for the Admin's page
  run('() => clearErrors_()');
  assert.strictEqual(run('x => errLog_(x)', { kind: 'server', by: 'Ramesh', email: 'r@x.test', where: 'saveLogRows', msg: 'x is not a function', detail: 'at line 1' }), true);
  assert.strictEqual(run('(u, x) => reportError_(u, x).noted', { name: 'Sita', email: 's@x.test' }, { where: 'log', msg: 'Uncaught TypeError: y is undefined' }), true);
  const d = run('() => getErrors_()');
  assert.deepStrictEqual(d.errors.map(e => [e.kind, e.by, e.where, e.msg]), [['page', 'Sita', 'log', 'Uncaught TypeError: y is undefined'], ['server', 'Ramesh', 'saveLogRows', 'x is not a function']]);
  assert.deepStrictEqual([d.stamp.n, d.stamp.last], [2, 'log: Uncaught TypeError: y is undefined']);
  assert.strictEqual(run('x => errLog_(x)', { kind: 'page', msg: '' }), false);                                              // nothing to write
  run('() => clearErrors_()');
  assert.deepStrictEqual([run('() => getErrors_().errors.length'), run('() => errStamp_().n')], [0, 0]);
});

test('the words for a machinery\'s diesel: Good within 10%, Very good / More diesel up to 30%, Bad beyond, "Check reading" when it is too good to be true', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const v = p => { const x = run('p => dieselVerdict_(p)', p); return x.code + ': ' + x.text; };
  // the figures of his report of 01 to 04-10-2026 (diesel against what the standard needs)
  assert.strictEqual(v(-6.3), 'ok: Good');                                              // 11.24 L/hr against 12 – was "Balanced"
  assert.strictEqual(v(-24.2), 'less: Very good – 24% less diesel');                    // 1.32 km/L against 1
  assert.strictEqual(v(102.7), 'bad: Bad – 103% more diesel');                          // 0.74 km/L against 1.5
  assert.strictEqual(v(-98.8), 'check: Check reading – too good (99% less diesel)');    // 684.67 km/L against 8: a Start reading is missing
  // the edges
  assert.strictEqual(v(10), 'ok: Good'); assert.strictEqual(v(-10), 'ok: Good'); assert.strictEqual(v(0), 'ok: Good');
  assert.strictEqual(v(10.01), 'more: More diesel – 10% over'); assert.strictEqual(v(30), 'more: More diesel – 30% over');
  assert.strictEqual(v(30.01), 'bad: Bad – 30% more diesel');
  assert.strictEqual(v(-30), 'less: Very good – 30% less diesel'); assert.strictEqual(v(-30.01), 'check: Check reading – too good (30% less diesel)');
});

test('Log Book is not asked of Ownership "Other" (nor of Debit): they are in no pending list – an entry can still be made for them', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const today = run('() => today_()'), yest = run('() => addDays_(today_(), -1)');
  const mk = (no, ownership) => run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Bolero', type: 'Bolero', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: ownership === 'Own' ? 'Rachana Construction Limited' : 'Somebody', ownership: ownership, status: 'Active', activeFrom: yest }, 'add');
  mk('PN-RENT', 'Rental'); mk('PN-OWN', 'Own'); mk('PN-OTHER', 'Other');
  run('(x, m) => saveMaster_(x, m)', { no: '', name: 'PN Debit Party', owner: 'PN Debit Party', ownership: 'Debit', status: 'Active', activeFrom: yest }, 'add');
  const pendingOf = () => { const p = run('() => pendingLogs_()'); const o = {}; p.items.filter(x => /^PN/.test(x.no)).forEach(x => { o[x.no] = (o[x.no] || 0) + 1; }); return o; };
  assert.deepStrictEqual(pendingOf(), { 'PN-RENT': 2, 'PN-OWN': 2 });                    // yesterday and today; nothing for Other and Debit
  assert.deepStrictEqual(run('() => logPending_().items.filter(x => /^PN/.test(x[0])).map(x => x[0]).filter((v, i, a) => a.indexOf(v) === i).sort()'), ['PN-OWN', 'PN-RENT']);
  assert.deepStrictEqual([run('m => needsLogBook_(m)', { supply: 'Company', ownership: 'Other' }), run('m => needsLogBook_(m)', { supply: 'Company', ownership: 'Hired' }), run('m => needsLogBook_(m)', { supply: 'Debit Basis', ownership: 'Rental' })], [false, true, false]);
  // an entry for an "Other" vehicle is still accepted
  run('x => saveLogRows_(x)', { rows: [{ date: today, shift: 'Full Day', no: 'PN-OTHER', mode: 'KM', openingKm: 100, closingKm: 140 }] });
  assert.strictEqual(run('() => logRowsOf_(table_(APP.SHEET_LOG, logHeaders_()), "PN-OTHER").length'), 1);
  // … and changing a machinery to Other takes it out of the pending list
  run('(x, m, o) => saveMaster_(x, m, o)', { no: 'PN-RENT', name: 'Bolero', type: 'Bolero', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: 'Somebody', ownership: 'Other', status: 'Active', activeFrom: yest }, 'edit', 'PN-RENT');
  assert.deepStrictEqual(pendingOf(), { 'PN-OWN': 2 });
});
