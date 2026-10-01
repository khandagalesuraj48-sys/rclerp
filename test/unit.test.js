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
    showDate: d => d.split('-').reverse().join('/'), fmt: String, ITEM_WORD: { hr: 'hr', km: 'km', trip: 'trips' }, dieselDebitDay: (vt, bd, m) => bd ? bd.diesel === 'Debit Basis' : !!(m && m.supply === 'Debit Basis'), findMachine: no => T.getMaster_().find(m => m.id === no) };
  const C = new Function(...Object.keys(env), grab('function itemDaySegs(') + '\n' + grab('function mbMachine(') + '; return { mbMachine };')(...Object.values(env));
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
    DOC_CSS: '', billHtml: () => '<div class="bl">ABSTRACT</div>' };
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
  run('x => saveDieselIssue_(x)', { date: '2026-08-01', shift: 'Day', source: 'Dispenser', no: 'CS-OWN', qty: 50, kmReading: 500, force: true });
  const d = JSON.parse(JSON.stringify(run('f => rptMachineCost_(f)', { from: '2026-08-01', to: '2026-08-02' })));
  const rows = [].concat(...d.groups.map(g => g.rows)), jcb = rows.find(r => r.no === 'CS-JCB'), own = rows.find(r => r.no === 'CS-OWN');
  assert.strictEqual(d.rate, 92);
  // by hand – JCB: 16 hr × 900 = 14,400 rent; 200 L × 92 = 18,400 diesel; standard 16 × 5 = 80 L, so 120 L × 92 = 11,040 taken back
  assert.deepStrictEqual([jcb.rent, jcb.dieselCost, jcb.recover, jcb.net, jcb.perHr], [14400, 18400, 11040, 21760, 1360]);
  // own tipper: no rent; 50 L × 92 = 4,600; 200 km → 23 per km
  assert.deepStrictEqual([own.rent, own.dieselCost, own.recover, own.net, own.perKm], [0, 4600, 0, 4600, 23]);
  assert.strictEqual(d.total.net, 26360); assert.strictEqual(d.total.rent + d.total.dieselCost - d.total.recover, d.total.net);
  assert.deepStrictEqual(d.groups.map(g => g.ownership), ['Own', 'Rental']);
});
