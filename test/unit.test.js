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
  const dayPartSrc = (app.match(/const dayPart = (r => [^\n]+?);\n/) || [])[1]; assert.ok(dayPartSrc, 'the page\'s dayPart was not found');
  const env = { dayPart: new Function('return ' + dayPartSrc)(), r2: n => Math.round(n * 100) / 100, hasKm: u => u === 'KM' || u === 'KM + Hrs', hasHr: u => u === 'Hrs' || u === 'KM + Hrs', isHol: r => ['Holiday', 'Breakdown'].indexOf(r.mode || r.unit) > -1,
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
  const C = new Function(...Object.keys(env), grab('function rupeesWords(') + '\nconst docDash = v => (v === \'\' || v === null || v === undefined || Number(v) === 0) ? \'-\' : mbN2(v);\n' + grab('function taxInvoiceHtml(') + '\n' + grab('function debitNoteHtml(') + '\n' + grab('function gstDeclNeed(') + '\n' + grab('function gstDeclOn(') + '\n' + grab('function gstDeclHtml(') + '\n' + grab('function billSheets(') + '; return { rupeesWords, taxInvoiceHtml, debitNoteHtml, billSheets, gstDeclNeed, gstDeclOn, gstDeclHtml };')(...Object.values(env));
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
  // this party has no GST number and the bill has no GST: its papers are Abstract, Tax Invoice and the GST non-enrolment declaration (06-10-2026)
  assert.strictEqual(C.debitNoteHtml(plain), ''); assert.strictEqual((C.billSheets(plain, '').match(/<section/g) || []).length, 3);
  assert.strictEqual((C.billSheets(Object.assign({}, plain, { gstDecl: false }), '').match(/<section/g) || []).length, 2);      // a saved bill marked "no declaration" stays at two papers
  const g1 = text(C.gstDeclHtml(plain));
  for (const want of ['DECLARATION OF GST NON-ENROLMENT', 'Dear Sir/Madam,', 'I/We Mr. Suresh Sarjerav Patil , do hereby declare that I/we am/are not registered under the Goods and Services Tax Act, 2017',
    'category of goods or services Rent on vehicle MH06AS9417 which are exempted', 'annual aggregate turnover below the taxable limit', 'yet to register ourselves',
    'I/We hereby also confirm SKETCHLINE INDUSTRIES that shall not be liable for any loss accrued to me/us', 'Signature of Authorised Signatory:', 'Name of the Authorised Signatory: Mr. Suresh Sarjerav Patil', 'Date: 10.08.2026', 'Stamp/Seal of the business entity:'])
    assert.ok(g1.indexOf(want) > -1, 'the declaration should say: ' + want + '\n' + g1);
  assert.match(g1, /Name of Business: +Date:/, 'a person: the business name is left to be written, as on his form');
  // the rule: GST registered (flag or number) or GST in the bill → no declaration; a firm's PAN → the name is the business, the signatory is written by hand
  assert.strictEqual(C.gstDeclNeed({ gstReg: 'No', gst: '' }, 0), true); assert.strictEqual(C.gstDeclNeed({ gstReg: 'Yes', gst: '27ABCDE1234F1Z5' }, 0), false);
  assert.strictEqual(C.gstDeclNeed({ gstReg: 'No', gst: '27ABCDE1234F1Z5' }, 0), false); assert.strictEqual(C.gstDeclNeed({ gstReg: 'No' }, 18), false);
  assert.strictEqual(C.gstDeclHtml(Object.assign({}, plain, { vendor: { name: 'Reg Vendor', gst: '27ABCDE1234F1Z5', gstReg: 'Yes' } })), '');
  assert.strictEqual(C.gstDeclHtml(Object.assign({}, plain, { gstDecl: true, vendor: { name: '' } })), '');
  const g2 = text(C.gstDeclHtml(Object.assign({}, plain, { company: 'Rachana Construction Limited', vendor: { name: 'Shree Earthmovers', pan: 'ABCFE1234K' }, machines: [{ no: 'MH-09-BC-2570' }, { no: 'mh-12-ab-0001' }, { no: 'MH-09-BC-2570' }] })));
  assert.ok(g2.indexOf('Rent on vehicles MH09BC2570, MH12AB0001 which') > -1 && g2.indexOf('confirm RACHANA CONSTRUCTION LIMITED that') > -1, g2);
  assert.match(g2, /Name of the Authorised Signatory: +Name of Business: Shree Earthmovers/);
  assert.ok(C.gstDeclHtml(Object.assign({}, plain, { vendor: { name: '<img src=x onerror=1>' } })).indexOf('<img') === -1);
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
    ['This site is not set up (ZZ).', /not set up on the server/], ['The Google Sheet backup of this site is not set up yet.', /backup Sheet/],
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
  assert.deepStrictEqual(run('x => saveSiteRules_(x)', { backDays: '3', announce: '  Fill every entry by the 30th  ' }).rules, { backDays: 3, announce: 'Fill every entry by the 30th', dayFrom: '08:00', nightFrom: '20:00', attachMax: 10 });
  assert.deepStrictEqual(run('() => getInit_().rules'), { backDays: 3, announce: 'Fill every entry by the 30th', dayFrom: '08:00', nightFrom: '20:00', attachMax: 10 });
  const asUser = (admin, f) => { run('a => { ACTOR_ADMIN_ = a; }', admin); try { return f(); } finally { run('() => { ACTOR_ADMIN_ = true; }'); } };
  const entry = d => ({ rows: [{ date: d, shift: 'Full Day', no: 'RL-1', mode: 'KM', openingKm: 100, closingKm: 150 }] });
  assert.match(asUser(false, () => tryIt(() => run('x => saveLogRowsInner_(x)', entry(day(-10))))).err, closed);          // 10 days back: refused for a user
  assert.strictEqual(asUser(true, () => tryIt(() => run('x => saveLogRowsInner_(x)', entry(day(-10))))).ok, true);        // the Admin may
  assert.match(asUser(false, () => tryIt(() => run('k => deleteLogRow_(k)', 'RL-1|' + day(-10) + '|Full Day'))).err, closed);   // … and the user cannot delete it either
  assert.strictEqual(asUser(false, () => tryIt(() => run('x => saveLogRowsInner_(x)', { rows: [{ date: day(-3), shift: 'Full Day', no: 'RL-1', mode: 'KM', closingKm: 200 }] }))).ok, true);   // 3 days back: inside the rule
  // no limit again
  assert.deepStrictEqual(run('x => saveSiteRules_(x)', { backDays: '', announce: '' }).rules, { backDays: '', announce: '', dayFrom: '08:00', nightFrom: '20:00', attachMax: 10 });      // (update-153: 10 attachments unless set; update-109: the shift times, 8 AM / 8 PM unless set)
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

test('the assistant: without a key it says so; the rules and the look-ups are the server\'s own (read-only, this app only, the user\'s language)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  assert.deepStrictEqual(run('() => aiInfo_()'), { on: false });
  assert.throws(() => run('(u, x) => getAiReply_(u, x)', { name: 'A', email: 'a@x.test' }, { contents: [{ role: 'user', parts: [{ text: 'hello' }] }] }), /assistant is not set up yet/);
  const rules = run('u => aiRules_(u)', { name: 'Ramesh', email: 'r@x.test', role: 'User' });
  assert.match(rules, /The person asking is Ramesh \(User\)\./);
  assert.match(rules, /Answer ONLY from this app/); assert.match(rules, /You never save, change or delete anything yourself/); assert.match(rules, /never say that it is saved/); assert.match(rules, /Devanagari/); assert.match(rules, /Today is \d{4}-\d{2}-\d{2}/);
  const tools = run('() => AI_TOOLS_.map(t => t.name)');
  assert.deepStrictEqual(tools, ['diesel_issues', 'log_book', 'pending_log_book', 'diesel_stock', 'machinery', 'diesel_average', 'diesel_watch', 'activity', 'prepare_diesel_issue', 'prepare_log_entry', 'app_guide']);
  // nothing the AI can call saves, changes or deletes: nine only read, two only PREPARE an entry for the person's own Save
  assert.ok(!/save|delete|update|add /i.test(tools.join(' ')));
  assert.ok(run('() => AI_TOOLS_.filter(t => /^prepare_/.test(t.name)).every(t => /It is NOT saved by this/.test(t.description))'));
});

test('the daily summary: every part only if the user may see that page; the Admin gets all; a wrong setting value is not kept', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const admin = run('u => getBrief_(u)', { name: 'MD', email: 'md@x.test', admin: true, perms: {} });
  assert.deepStrictEqual(Object.keys(admin.sections).sort(), ['admin', 'average', 'breakdown', 'diesel', 'logbook', 'papers', 'received', 'stock', 'watch']);
  assert.strictEqual(admin.day, run('() => addDays_(today_(), -1)'));
  // a user who may see only Diesel Issue: its part and the stock – nothing of the Log Book, the reports, the papers, or the Admin's part
  const one = run('u => getBrief_(u)', { name: 'Pump', email: 'p@x.test', admin: false, perms: { 'Diesel Issue': 'Edit', 'Log Book': 'None', 'Reports': 'None', 'Vehicle Compliance': 'None', 'Breakdown': 'None', 'Diesel Inward': 'None' } });
  assert.deepStrictEqual(Object.keys(one.sections).sort(), ['diesel', 'stock']);
  const view = run('u => getBrief_(u)', { name: 'Site', email: 's@x.test', admin: false, perms: { 'Log Book': 'View', 'Reports': 'View' } });
  assert.deepStrictEqual(Object.keys(view.sections).sort(), ['average', 'logbook', 'stock', 'watch']);
  // the two new settings: yes / no only, on by default
  const pr = run('x => prefsClean_(x)', { brief: 'maybe', voiceOut: false });
  assert.deepStrictEqual([pr.brief, pr.voiceOut], [true, false]);
});

test('talking with the assistant needs the microphone: the site\'s own security header and the app\'s frame must allow it', () => {
  const fs = require('fs'), path = require('path');
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const pp = (((j.headers || []).find(h => h.source === '/(.*)') || { headers: [] }).headers.find(h => h.key === 'Permissions-Policy') || {}).value || '';
  assert.match(pp, /microphone=\(self\)/, 'Permissions-Policy must say microphone=(self) – with microphone=() Chrome refuses the microphone even when the person allowed it');
  // update-85: the app opens only with the location on, and each photo of a diesel issue carries its place – this site only
  assert.match(pp, /geolocation=\(self\)/, 'Permissions-Policy must say geolocation=(self) – with geolocation=() the browser never gives the location');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'app', 'Index.html'), 'utf8'), /<iframe id="app"[^>]*allow="[^"]*geolocation/, 'the app\'s frame must allow geolocation');
  // update-75: the screen share may show the CAMERA of a phone (to show a machine) – this site only, never another one in a frame
  assert.match(pp, /camera=\(self\)/, 'Permissions-Policy must say camera=(self) for the screen share camera');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'app', 'Index.html'), 'utf8'), /<iframe id="app"[^>]*allow="[^"]*microphone[^"]*camera/);
});

test('two engines, one tank – ONE rule everywhere: the page\'s dualAvg = the server\'s dualAvg_; his Log Book sheet of MH-04-KU-3332; the cost sheet no longer divides all the diesel by the hours', () => {
  const { T, ctx } = require('./harness.js');
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'App.html'), 'utf8');
  const grab = start => { const i = html.indexOf(start); assert.ok(i > -1, 'not found in the page: ' + start); let d = 0, j = html.indexOf('{', i); for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (!d) break; } } return html.slice(i, j + 1); };
  const page = new Function('r2', grab('function dualAvg(') + '; return dualAvg;')(n => Math.round(n * 100) / 100);
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const server = (d, km, hr, ks, hs) => run('(d, km, hr, ks, hs) => dualAvg_(d, km, hr, ks, hs)', d, km, hr, ks, hs);
  // his sheet (01 to 05-10-2026): 180 L, 209.9 km, 21.1 hr, standard 2.5 km/L + 3 L/hr
  //   drum 21.1 × 3 = 63.3 L · vehicle 180 − 63.3 = 116.7 L · 209.9 ÷ 116.7 = 1.7986 → 1.8 km/L   (the sheet said 1.17 km/L and 8.53 L/hr)
  const p = page(180, 209.9, 21.1, 2.5, 3);
  assert.deepStrictEqual([p.how, p.hrDiesel, p.kmDiesel, p.kmpl, p.lph], ['split', 63.3, 116.7, 1.8, 3]);
  // the money of the bill is the same under the rule: vehicle 116.7 L against its need 209.9 ÷ 2.5 = 83.96 L → 32.74 L over = 180 − (83.96 + 63.3)
  assert.strictEqual(Math.round((p.kmDiesel - 209.9 / 2.5) * 100) / 100, Math.round((180 - (209.9 / 2.5 + 21.1 * 3)) * 100) / 100);
  // page = server, in every case
  [[180, 209.9, 21.1, 2.5, 3], [60, 102.4, 1.8, 1.5, 3], [1140, 86.4, 7.9, 1.5, 3], [60, 100, 25, 1.5, 3], [60, 102.4, 0, 1.5, 3], [60, 100, 5, 1.5, 0], [60, 0, 10, 1.5, 3], [0, 100, 5, 1.5, 3], [50, 0, 0, 1.5, 3]].forEach(a => {
    const x = page.apply(null, a), y = server.apply(null, a);
    assert.deepStrictEqual([x.kmpl, x.lph, x.hrDiesel, x.kmDiesel], [y.kmpl, y.lph, y.hrDiesel, y.kmDiesel], 'page and server differ for ' + JSON.stringify(a));
  });
  assert.strictEqual(page(60, 100, 25, 1.5, 3).how, 'short');                    // the hours alone need 75 L, 60 L given: no average is made up
  // no place on the page divides all the diesel of a two-meter machinery by each meter any more
  assert.ok(!/dual \? \[tKm \? \(tKm \/ (issued|used)\)/.test(html), 'the Log Book print still works out its own two-meter average');
});

test('half day: a Log Book entry marked "½ day" is paid as half a day – server and page the same; hours / KM pay is not touched', () => {
  const { T, ctx } = require('./harness.js');
  const fs = require('fs'), path = require('path');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // the one rule, on both sides
  const app = fs.readFileSync(path.join(__dirname, '..', 'app', 'App.html'), 'utf8');
  const page = new Function('return ' + (app.match(/const dayPart = (r => [^\n]+?);\n/) || [])[1])();
  [[{ half: true }, 0.5], [{ half: 0.5 }, 0.5], [{ half: false }, 1], [{}, 1], [{ half: '' }, 1], [null, 1]].forEach(x => { assert.strictEqual(page(x[0]), x[1]); assert.strictEqual(run('r => dayPart_(r)', x[0]), x[1]); });
  // a monthly rate of 30,000 in a 30-day month = 1,000 a day. Three dates: a whole day, a HALF day, and a day + a half night
  const calc = (basis, rate, rows) => run(`(basis, rate, rows) => { const m = { id: 'HD-1', unit: 'KM' }, boq = {}; rows.forEach(r => { boq[r.date] = { boq: 'B1', basis: basis, rate: rate }; });
    const c = billMachineCalc_(m, rows, { boq: { [noKey_('HD-1')]: boq }, issues: {} }, '2026-09-01', '2026-09-30'); return { workDays: c.workDays, nights: c.nights, amount: c.amount, rows: c.rows || c.lines || null }; }`, basis, rate, rows);
  const rows = [{ date: '2026-09-01', shift: 'Full Day', mode: 'KM', wkm: 40 }, { date: '2026-09-02', shift: 'Day', mode: 'KM', wkm: 20, half: true }, { date: '2026-09-03', shift: 'Day', mode: 'KM', wkm: 40 }, { date: '2026-09-03', shift: 'Night', mode: 'KM', wkm: 10, half: true }];
  const mo = calc('Monthly', 30000, rows);
  assert.deepStrictEqual([mo.workDays, mo.nights, mo.amount], [2.5, 0.5, 3000]);            // (1 + 0.5 + 1) days + 0.5 night = 3 × 1,000
  const whole = calc('Monthly', 30000, rows.map(r => Object.assign({}, r, { half: false })));
  assert.deepStrictEqual([whole.workDays, whole.nights, whole.amount], [3, 1, 4000]);       // the same entries without the mark, as before
  const pd = calc('Per Day', 1200, rows); assert.strictEqual(pd.amount, 3600);              // 3 × 1,200
  const km = calc('Per KM', 10, rows); assert.strictEqual(km.amount, 1100);                 // 110 km × 10 – a half day does not change pay by KM
  // refused where the day is not paid at all
  assert.throws(() => run(`() => halfCheck_({ half: true }, 'Holiday', '')`), /is for a day that is paid/);
  assert.strictEqual(run(`() => { halfCheck_({ half: true }, 'Idle', ''); halfCheck_({ half: false }, 'Breakdown', ''); return 'ok'; }`), 'ok');
});

test('half day with an Item-wise BOQ: the Per Day / Monthly item of a "½ day" entry counts 0.5; the hour items are as typed', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const items = [{ name: 'Machine with operator', basis: 'Per Day', rate: 2000 }, { name: 'Breaker', basis: 'Per Hour', rate: 900, qty: '' }];
  const q = (half) => run('(items, row) => itemQtyOf_(items, row).list', items, { mode: 'Hrs', whr: 6, wkm: 0, trip: 0, work: { Breaker: 2 }, half: half });
  assert.deepStrictEqual(q(false), [{ n: 'Breaker', q: 2, k: 'hr' }, { n: 'Machine with operator', q: 1, k: 'day' }]);
  assert.deepStrictEqual(q(true), [{ n: 'Breaker', q: 2, k: 'hr' }, { n: 'Machine with operator', q: 0.5, k: 'day' }]);
});

test('Asset Master: the Machinery Number can be changed – everything entered for the machinery follows; issued bills and debit notes keep their number, only their link moves; joining two machinery is refused', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const mach = (no, more) => Object.assign({ no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'Number Vendor ZQ', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-05-01' }, more || {});
  run('(x, m) => saveMaster_(x, m)', mach('ZQ-1', { taxUpto: '2026-12-31' }), 'add');
  run('(x, m) => saveMaster_(x, m)', mach('ZQ-9'), 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Number Vendor ZQ', gstReg: 'No', pan: 'ABCDE1234Z', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Debit Party ZQ', gstReg: 'No' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Number Vendor ZQ', from: '2026-05-01', tdsPct: 0, woNo: 'WO-ZQ', lines: [{ no: 'ZQ-1', basis: 'Monthly', rate: 31000, diesel: 'Company' }, { no: 'ZQ-9', basis: 'Monthly', rate: 31000, diesel: 'Company' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-04-30', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 100, billNo: 'ZQ1', billDate: '2026-04-30' });
  const saved = run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-05-10', shift: 'Full Day', no: 'ZQ-1', mode: 'KM', openingKm: 1000, closingKm: 1100, debitTo: 'Debit Party ZQ', debitRate: 50 },
    { date: '2026-05-11', shift: 'Day', no: 'ZQ-1', mode: 'KM', closingKm: 1180 }, { date: '2026-05-11', shift: 'Night', no: 'ZQ-1', mode: 'KM', closingKm: 1200 }, { date: '2026-05-10', shift: 'Full Day', no: 'ZQ-9', mode: 'KM', openingKm: 10, closingKm: 60 }] });
  assert.ok(saved.ok, JSON.stringify(saved).slice(0, 300));
  run('x => saveDieselIssue_(x)', { date: '2026-05-10', shift: 'Day', source: 'Dispenser', no: 'ZQ-1', qty: 40, kmReading: 1000, force: true });
  run('x => saveDieselIssue_(x)', { date: '2026-05-11', shift: 'Day', source: 'Dispenser', no: 'ZQ-1', qty: 25, kmReading: 1100, force: true });
  run('x => saveDieselIssue_(x)', { date: '2026-05-10', shift: 'Day', source: 'Dispenser', no: 'ZQ-9', qty: 10, kmReading: 10, force: true });
  // a debit note for the entry charged to a party (a real one: it links to the Log Book entry by its key "number|date|shift")
  const co = run('() => billCompanies_()')[0];
  const pend = run('f => debitPending_(f)', { vendor: 'Debit Party ZQ', from: '2026-05-01', to: '2026-05-31' });
  assert.deepStrictEqual(pend.rows.map(r => r.logId), ['ZQ-1|2026-05-10|Full Day']);
  const dn = run('x => saveDebitNote_(x)', { company: co, vendor: 'Debit Party ZQ', date: '2026-05-12', from: '2026-05-01', to: '2026-05-31', lines: [{ logId: 'ZQ-1|2026-05-10|Full Day', machinery: 'ZQ-1', particular: 'Tipper work', qty: 100, unit: 'KM', rate: 50 }] });
  assert.ok(dn && dn.ok !== false, JSON.stringify(dn).slice(0, 300));
  // rows put straight into the other tables that name a machinery: a saved bill, a tank check, the two breakdown tables
  run(`() => withLock_(() => {
    const add = (sheet, cols, vals) => { vbSheet_(sheet, cols); const t = table_(sheet); const row = newRow_(t); Object.keys(vals).forEach(h => set_(row, t, h, vals[h])); t.sh.appendRow(row); TABLE_MEMO_ = {}; };
    add(APP.SHEET_BILLS, BILL_COLS_, { 'Bill ID': 'BL-ZQ1', 'Vendor Name': 'Number Vendor ZQ', Company: '${'${co}'}', 'Bill No': '7', 'Period From': toDate_('2026-05-01'), 'Period To': toDate_('2026-05-31'), Status: 'Active', 'Net Payable': 1000,
      Data: JSON.stringify({ B: 0, machines: [{ no: 'ZQ-1', workDays: 2, amount: 2000 }, { no: 'ZQ-9', workDays: 1, amount: 1000 }] }) });
    add(APP.SHEET_TANK, TANK_COLS_, { 'Check ID': 'TC-ZQ1', Date: toDate_('2026-05-11'), 'Machinery Number': 'ZQ-1', 'System Diesel (Ltr)': 20, 'Physical Diesel (Ltr)': 18 });
    add(APP.SHEET_BREAKDOWN, BD_COLS_, { 'Breakdown ID': 'BD-ZQ1', 'Machinery No': 'ZQ-1', 'From Date': toDate_('2026-05-12'), Reason: 'Tyre', Status: 'Open' });
    add(APP.SHEET_BDREPORT, BDR_COLS_, { 'Report ID': '2026-05-12', 'Report Date': toDate_('2026-05-12'), 'Machinery Count': 2, Details: JSON.stringify([{ no: 'ZQ-1', status: 'Breakdown', reason: 'Tyre' }, { no: 'ZQ-9', status: 'Working' }]) });
  })`.replace("${co}", co));
  run('(x, m, o) => saveMaster_(x, m, o)', mach('ZQ-1', { taxUpto: '2027-12-31' }), 'edit', 'ZQ-1');           // a renewal of its papers (kept in the history under its number)
  const where = no => run(`no => { const k = noKey_(no), col = (sheet, h) => { const t = table_(sheet); return h in t.c ? t.rows.filter(r => noKey_(r[t.c[h]]) === k).length : -1; };
    const j = (sheet, h) => table_(sheet).rows.map(r => str_(r[table_(sheet).c[h]]));
    return { master: getMaster_().filter(m => noKey_(m.id) === k).length, diesel: col(APP.SHEET_DIESEL, H.NO), log: col(APP.SHEET_LOG, H.NO), tank: col(APP.SHEET_TANK, 'Machinery Number'), bd: col(APP.SHEET_BREAKDOWN, 'Machinery No'), papers: col(APP.SHEET_COMPLIANCE, 'Machinery No'),
      boq: allBoqs_().filter(b => b.lines.some(l => noKey_(l.no) === k)).length, register: bdReports_().filter(r => r.rows.some(x => noKey_(x.no) === k)).length,
      billLink: table_(APP.SHEET_BILLS).rows.map(r => billOut_(table_(APP.SHEET_BILLS), r, true)).filter(b => billMachKeys_(b.data).indexOf(k) > -1).length,
      billPaper: j(APP.SHEET_BILLS, 'Data').filter(t => JSON.parse(t || '{}').machines.some(x => noKey_(x.no) === k)).length,
      dnLink: dnList_().filter(d => d.logIds.some(id => noKey_(id.split('|')[0]) === k)).length, dnPaper: dnList_().filter(d => d.lines.some(l => noKey_(l.machinery) === k)).length,
      logIds: SS_().getSheetByName(APP.SHEET_LOG).ids.filter(id => noKey_(String(id).split('|')[0]) === k).sort() }; }`, no);
  const b0 = where('ZQ-1'), other0 = where('ZQ-9');
  assert.deepStrictEqual([b0.master, b0.diesel, b0.log, b0.tank, b0.bd, b0.papers, b0.boq, b0.register, b0.billLink, b0.billPaper, b0.dnLink, b0.dnPaper], [1, 2, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  const bill0 = run('() => billMachineCalc_(findMachine_("ZQ-1"), getLogBookList_({ from: "2026-05-01", to: "2026-05-31", no: "ZQ-1", all: true }).rows, logPrintExtra_({ from: "2026-05-01", to: "2026-05-31", nos: ["ZQ-1"] }), "2026-05-01", "2026-05-31", undefined, true)');
  const stock0 = run('() => getStock_().stock');

  // ---------- refused: a number another machinery has; a number that still has records of a machinery no longer in Master ----------
  assert.throws(() => run('(x, m, o) => saveMaster_(x, m, o)', mach('ZQ-9', { taxUpto: '2027-12-31' }), 'edit', 'ZQ-1'), /ZQ-9 is already in Master – two machinery cannot have the same Number/);
  run('(x, m) => saveMaster_(x, m)', mach('ZQ-GONE'), 'add');
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-05-10', shift: 'Full Day', no: 'ZQ-GONE', mode: 'KM', openingKm: 5, closingKm: 9 }] });
  run('(id, f) => deleteMaster_(id, f)', 'ZQ-GONE', true);                                                          // (deleting a machinery leaves its entries)
  assert.throws(() => run('(x, m, o) => saveMaster_(x, m, o)', mach('ZQ-GONE', { taxUpto: '2027-12-31' }), 'edit', 'ZQ-1'), /ZQ-GONE already has records in the app \(1 Log Book entries\) – they belong to a machinery that is no longer in Asset Master/);
  assert.deepStrictEqual(where('ZQ-1'), b0, 'a refused change must leave everything as it was');

  // ---------- the change: ZQ-1 → MH-12-ZQ-1234 (typed without dashes) ----------
  const res = run('(x, m, o) => saveMaster_(x, m, o)', mach('mh12zq1234', { taxUpto: '2027-12-31' }), 'edit', 'ZQ-1');
  assert.strictEqual(res.renamed.from + ' → ' + res.renamed.to, 'ZQ-1 → MH-12-ZQ-1234');
  assert.strictEqual(res.renamed.text, '2 diesel issues, 3 Log Book entries, 1 tank checks, 1 breakdown records, 1 renewals of papers, 1 BOQs, 1 days of the breakdown register, 1 debit notes (link only), 1 saved bills (link only)');
  const a = where('MH-12-ZQ-1234'), gone = where('ZQ-1');
  // everything follows …
  assert.deepStrictEqual([a.master, a.diesel, a.log, a.tank, a.bd, a.papers, a.boq, a.register, a.billLink, a.dnLink], [1, 2, 3, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepStrictEqual(a.logIds, ['MH-12-ZQ-1234|2026-05-10|Full Day', 'MH-12-ZQ-1234|2026-05-11|Day', 'MH-12-ZQ-1234|2026-05-11|Night']);       // the entries moved to their new keys
  // … nothing is left under the old number, except on the papers already issued
  assert.deepStrictEqual([gone.master, gone.diesel, gone.log, gone.tank, gone.bd, gone.papers, gone.boq, gone.register, gone.billLink, gone.dnLink, gone.logIds.length], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepStrictEqual([gone.billPaper, gone.dnPaper, a.billPaper, a.dnPaper], [1, 1, 0, 0]);
  // the other machinery is untouched
  assert.deepStrictEqual(where('ZQ-9'), other0);
  // no figure changed: the bill of the machinery and the diesel stock are what they were
  const bill1 = run('() => billMachineCalc_(findMachine_("MH-12-ZQ-1234"), getLogBookList_({ from: "2026-05-01", to: "2026-05-31", no: "MH-12-ZQ-1234", all: true }).rows, logPrintExtra_({ from: "2026-05-01", to: "2026-05-31", nos: ["MH-12-ZQ-1234"] }), "2026-05-01", "2026-05-31", undefined, true)');
  assert.deepStrictEqual([bill1.workDays, bill1.nights, bill1.amount, bill1.issued, bill1.excessQty, bill1.excessAmt], [bill0.workDays, bill0.nights, bill0.amount, bill0.issued, bill0.excessQty, bill0.excessAmt]);
  assert.ok(bill0.amount > 0 && bill0.issued === 65);
  assert.strictEqual(run('() => getStock_().stock'), stock0);
  // the Log Book entry that is in the debit note is still known to be in it (not offered a second time)
  const pend2 = run('f => debitPending_(f)', { vendor: 'Debit Party ZQ', from: '2026-05-01', to: '2026-05-31' });
  assert.deepStrictEqual([pend2.rows.length, pend2.already], [0, 1]);
  // the next entry carries on from the last Close under the new number
  assert.strictEqual(run('() => getLogRowPrefill_("MH-12-ZQ-1234", "2026-05-12", "Full Day").openingKm'), 1200);
  assert.throws(() => run('() => findMachine_("ZQ-1")'), /"ZQ-1" is not in Master/);

  // ---------- changed back (a mistake undone): the bill's link returns to the number printed on it ----------
  const back = run('(x, m, o) => saveMaster_(x, m, o)', mach('ZQ-1', { taxUpto: '2027-12-31' }), 'edit', 'MH-12-ZQ-1234');
  assert.strictEqual(back.renamed.to, 'ZQ-1');
  assert.deepStrictEqual(where('ZQ-1'), b0);
  assert.strictEqual(run(`() => JSON.stringify(JSON.parse(str_(table_(APP.SHEET_BILLS).rows.find(r => r[table_(APP.SHEET_BILLS).c['Bill ID']] === 'BL-ZQ1')[table_(APP.SHEET_BILLS).c['Data']])).machines[0])`), '{"no":"ZQ-1","workDays":2,"amount":2000}');
  // an edit that does not touch the number moves nothing
  const plain = run('(x, m, o) => saveMaster_(x, m, o)', mach('ZQ-1', { taxUpto: '2027-12-31', make: 'Tata' }), 'edit', 'ZQ-1');
  assert.strictEqual(plain.renamed, null);
  // a machinery without a number is known by its name – the name can be changed the same way, and a number can be given to it later
  run('(x, m) => saveMaster_(x, m)', mach('', { name: 'Pile Machine ZQ' }), 'add');
  run('x => saveDieselIssue_(x)', { date: '2026-05-10', shift: 'Day', source: 'Dispenser', no: 'Pile Machine ZQ', qty: 5, force: true });
  const nm = run('(x, m, o) => saveMaster_(x, m, o)', mach('DDIPL-7', { name: 'Pile Machine ZQ' }), 'edit', 'Pile Machine ZQ');
  assert.strictEqual(nm.renamed.from + ' → ' + nm.renamed.to + ' : ' + nm.renamed.text, 'Pile Machine ZQ → DDIPL-7 : 1 diesel issues');
  assert.strictEqual(where('DDIPL-7').diesel, 1);
});

test('Edit Log Book: a Night can be added later to a date that has its entry (full or half), a saved entry can change its shift – diesel, bill and debit-note link follow; the rule of a date holds', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'NS-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: 'Night Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Night Vendor', gstReg: 'No', pan: 'ABCDE1234S', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Night Debit Party', gstReg: 'No' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Night Vendor', from: '2026-06-01', tdsPct: 0, woNo: 'WO-NS', lines: [{ no: 'NS-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-05-31', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 100, billNo: 'NS1', billDate: '2026-05-31' });
  // the month as it was entered: 21 Day, 22 FULL DAY (charged to a party), 23 Day; on the 22nd diesel was given in the day (30 L) and in the night (20 L)
  const sv = run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-06-21', shift: 'Day', no: 'NS-1', mode: 'KM', openingKm: 1000, closingKm: 1084 }, { date: '2026-06-22', shift: 'Full Day', no: 'NS-1', mode: 'KM', closingKm: 1167, debitTo: 'Night Debit Party', debitRate: 40 }, { date: '2026-06-23', shift: 'Day', no: 'NS-1', mode: 'KM', closingKm: 1229 }] });
  assert.ok(sv.ok, JSON.stringify(sv).slice(0, 300));
  run('x => saveDieselIssue_(x)', { date: '2026-06-22', shift: 'Day', source: 'Dispenser', no: 'NS-1', qty: 30, kmReading: 1084, force: true });
  run('x => saveDieselIssue_(x)', { date: '2026-06-22', shift: 'Night', source: 'Dispenser', no: 'NS-1', qty: 20, kmReading: 1167, force: true });
  const co = run('() => billCompanies_()')[0];
  const dn = run('x => saveDebitNote_(x)', { company: co, vendor: 'Night Debit Party', date: '2026-06-24', from: '2026-06-01', to: '2026-06-30', lines: [{ logId: 'NS-1|2026-06-22|Full Day', machinery: 'NS-1', particular: 'Tipper work', qty: 83, unit: 'KM', rate: 40 }] });
  assert.ok(dn && dn.ok !== false, JSON.stringify(dn).slice(0, 300));
  const state = () => run(`() => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(r => str_(r[c[H.NO]]) === 'NS-1').map(r => dkey_(r[c[H.DATE]]).slice(8) + ' ' + str_(r[c[H.SHIFT]]) + ' ' + num0_(r[c[H.OKM]]) + '>' + num0_(r[c[H.CKM]]) + ' diesel ' + num0_(r[c[H.QTY]]) + (halfOf_(r, c) ? ' half' : '')).sort(); }`);
  const bill = () => run('() => { const c = billMachineCalc_(findMachine_("NS-1"), getLogBookList_({ from: "2026-06-01", to: "2026-06-30", no: "NS-1", all: true }).rows, logPrintExtra_({ from: "2026-06-01", to: "2026-06-30", nos: ["NS-1"] }), "2026-06-01", "2026-06-30", undefined, true); return [c.workDays, c.nights, c.amount, c.issued]; }');
  const grid = () => run('() => getLogEditData_("NS-1", "2026-06-01", "2026-06-30").rows').map(r => ({ key: r.key, half: !!r.half, date: r.date, shift: r.shift, mode: r.mode || r.unit, openingKm: r.okm, closingKm: r.ckm, work: r.work || '' }));
  const save = rows => run('b => saveLogBulk_(b)', { no: 'NS-1', from: '2026-06-01', to: '2026-06-30', rows: rows, deleted: [] });
  assert.deepStrictEqual(state(), ['21 Day 1000>1084 diesel 0', '22 Full Day 1084>1167 diesel 50', '23 Day 1167>1229 diesel 0']);
  assert.deepStrictEqual(bill(), [3, 0, 3000, 50]);                      // 3 days × ₹1,000

  // ---------- the rule of a date is checked for the grid: refused, nothing changed ----------
  let g = grid(); g.push({ key: '', date: '2026-06-22', shift: 'Night', mode: 'KM', openingKm: 1167, closingKm: 1167 });
  let r = save(g); assert.strictEqual(r.ok, false); assert.match(r.errors[0].msg, /22-06-2026 \(Night\) is entered more than once/);          // next to a Full Day entry
  g = grid(); g.push({ key: '', date: '2026-06-21', shift: 'Day', mode: 'KM', openingKm: 1084, closingKm: 1084 });
  r = save(g); assert.strictEqual(r.ok, false); assert.match(r.errors[0].msg, /21-06-2026 \(Day\) is entered more than once/);
  assert.deepStrictEqual(state(), ['21 Day 1000>1084 diesel 0', '22 Full Day 1084>1167 diesel 50', '23 Day 1167>1229 diesel 0']);

  // ---------- the forgotten nights: 21 gets a full Night; 22 (Full Day) becomes Day and gets a HALF Night ----------
  g = grid(); g.find(x => x.date === '2026-06-22').shift = 'Day';
  g.push({ key: '', date: '2026-06-21', shift: 'Night', mode: 'KM', openingKm: 1084, closingKm: 1084 }, { key: '', date: '2026-06-22', shift: 'Night', mode: 'KM', openingKm: 1167, closingKm: 1167, half: true });
  r = save(g); assert.deepStrictEqual([r.ok, r.added, r.shifted], [true, 2, 1], JSON.stringify(r).slice(0, 300));
  // each entry holds the diesel of its own shift now (the Full Day entry held both): nothing is lost, nothing counted twice
  assert.deepStrictEqual(state(), ['21 Day 1000>1084 diesel 0', '21 Night 1084>1084 diesel 0', '22 Day 1084>1167 diesel 30', '22 Night 1167>1167 diesel 20 half', '23 Day 1167>1229 diesel 0']);
  assert.deepStrictEqual(bill(), [3, 1.5, 4500, 50]);                    // 3 days + 1 night + ½ night = 4.5 × ₹1,000; the diesel is the same 50 L
  // the entry that is in the debit note moved to its new key – the note still holds it
  assert.deepStrictEqual(run('() => dnList_().filter(d => d.vendor === "Night Debit Party").map(d => [d.logIds, d.lines.map(l => l.logId)])'), [[['NS-1|2026-06-22|Day'], ['NS-1|2026-06-22|Day']]]);
  const pend = run('f => debitPending_(f)', { vendor: 'Night Debit Party', from: '2026-06-01', to: '2026-06-30' }); assert.deepStrictEqual([pend.rows.length, pend.already], [0, 1]);

  // ---------- the work shared between day and night: the Day's Close is lowered, the Night starts there ----------
  g = grid(); g.find(x => x.date === '2026-06-22' && x.shift === 'Day').closingKm = 1140; Object.assign(g.find(x => x.date === '2026-06-22' && x.shift === 'Night'), { openingKm: 1140, closingKm: 1167 });
  r = save(g); assert.strictEqual(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(state().slice(2, 4), ['22 Day 1084>1140 diesel 30', '22 Night 1140>1167 diesel 20 half']);
  // ---------- a saved entry changes its shift: the two entries of the 22nd change places; the half goes with its row ----------
  g = grid(); g.forEach(x => { if (x.date === '2026-06-22') x.shift = x.shift === 'Day' ? 'Night' : 'Day'; });
  r = save(g); assert.strictEqual(r.ok, false);                          // as typed, the Night (1084>1140) would now start below the Day's Close: refused, with the reason
  assert.match(r.errors.map(e => e.msg).join(' | '), /Start KM 1084 is less than the last Close KM 1167/);
  // a Night entry alone can become a Full Day entry only when the date has no other entry
  g = grid(); g.find(x => x.date === '2026-06-21' && x.shift === 'Night').shift = 'Full Day';
  r = save(g); assert.strictEqual(r.ok, false); assert.match(r.errors[0].msg, /21-06-2026 \(Full Day\) is entered more than once/);
  // the 23rd (Day, alone on its date) is made a Night entry: allowed – it takes the night's diesel of its date (none)
  g = grid(); g.find(x => x.date === '2026-06-23').shift = 'Night';
  r = save(g); assert.deepStrictEqual([r.ok, r.shifted], [true, 1]);
  assert.deepStrictEqual(state().slice(4), ['23 Night 1167>1229 diesel 0']);
  assert.deepStrictEqual(bill(), [2, 2.5, 4500, 50]);                    // 21 D, 22 D + 21 N, 22 ½N, 23 N
});

test('Log Book print: every machinery is fitted on one page – the fitting is in the print window, runs before printing and again when the page is turned', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const a = app.indexOf('function fitLogPages(doc)'), b = app.indexOf('const ORIENT_CSS = {');
  assert.ok(a > -1 && b > a, 'fitLogPages is in the page');
  const fn = app.slice(a, b);
  assert.match(fn, /\.lbsheet/); assert.match(fn, /style\.zoom/); assert.match(fn, /paddingTop = \(12 \/ z\) \+ 'mm'/, 'the room to sign keeps its real size');
  assert.match(fn, /land \? 186 : 272/, 'page height by the turn of the page');
  const pd = app.slice(app.indexOf('function printDoc('), app.indexOf('const signBlock'));
  assert.match(pd, /fitLogPages\.toString\(\)/, 'the print window has the function');
  assert.match(pd, /try\{fitLogPages\(document\)\}catch\(e\)\{\}\}<\\\/script>/, 'run again when Portrait / Landscape is pressed');
  assert.match(pd, /const go = \(\) => \{ try \{ fitLogPages\(w\.document\); \}/, 'run just before the print');
  // the function itself, on a stand-in page: a sheet 1.5 × the page is made smaller until it fits, a short one is left alone; both fill the page
  const fit = new Function('return ' + fn.slice(0, fn.lastIndexOf('}') + 1))();
  const mk = natural => { const sg = { style: {} }; const sh = { style: {}, dataset: {}, querySelector: () => sg, getBoundingClientRect() { const z = Number(this.style.zoom || 1); return { height: natural * z * 3.7795 + (parseFloat(sg.style.paddingTop) - 12) * z * 3.7795 }; } }; return { sh, sg }; };
  const tall = mk(408), short = mk(150);
  fit({ querySelectorAll: () => [tall.sh, short.sh], getElementById: () => ({ textContent: 'size: A4 portrait' }) });
  const zt = Number(tall.sh.style.zoom);
  assert.ok(zt < 0.68 && zt > 0.6, 'tall sheet scaled: ' + zt);                                  // 408·z + 12·(1 − z) ≤ 272 → z ≈ 0.657
  assert.ok(408 * zt + 12 * (1 - zt) <= 272.01, 'it fits the page');
  assert.strictEqual(short.sh.dataset.fit, '1'); assert.strictEqual(short.sh.style.zoom, '');
  assert.strictEqual(short.sh.style.minHeight, '272mm'); assert.strictEqual(tall.sg.style.paddingTop, (12 / Number(tall.sh.style.zoom)) + 'mm');
  // landscape: the lower page
  const t2 = mk(250); fit({ querySelectorAll: () => [t2.sh], getElementById: () => ({ textContent: 'size: A4 landscape' }) });
  assert.ok(Number(t2.sh.dataset.fit) < 0.76 && t2.sh.style.minHeight === (186 / Number(t2.sh.style.zoom)) + 'mm');
});

test('every print has "Excel" in its window; a saved bill opens with its Log Book from all four places', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const pd = app.slice(app.indexOf('function printDoc('), app.indexOf('const signBlock'));
  assert.match(pd, /id="xl_btn"/, 'the Excel button is in the bar of the print window – for every kind of print');
  assert.ok(pd.indexOf('id="xl_btn"') < pd.indexOf("'<div class=\"sheet\">'"), 'in the bar, not in the sheet');
  assert.match(pd, /win && !win\.closed \? win : window\.open/, 'a window opened at the click can be used');
  const px = app.slice(app.indexOf('function printExcelPlain('), app.indexOf('function printDoc('));
  for (const want of ['needXlsx()', "section.billsheet, :scope > section.lbsheet", "'GST Declaration'", "'Debit Note'", "'Tax Invoice'", "'Abstract'", "'LB '", '!merges', 'XLSX.writeFile']) assert.ok(px.indexOf(want) > -1, 'printExcelPlain: ' + want);
  // the formatted Excel (asked 06-10-2026: "with borders and all, the same as the print"): made from the print window, plain only as a fall-back
  const ps = app.slice(app.indexOf('async function printExcelStyled('), app.indexOf('/* THE PLAIN EXCEL'));
  for (const want of ['new ExcelJS.Workbook()', 'showGridLines: false', 'style.border = it.bd', "pattern: 'solid'", 'ws.mergeCells(', 'wrapText: true', 'fitToPage: true', "paperSize: 9", 'ws.addImage(', 'saveXlsxBuffer(buf']) assert.ok(ps.indexOf(want) > -1, 'printExcelStyled: ' + want);
  assert.match(pd, /await rclLoadExcelJs\(\); n = await printExcelStyled\(w\.document, title\)/); assert.match(pd, /n = printExcelPlain\(w\.document, title\)/, 'the plain Excel when the formatting tool cannot be had');
  // (07-10-2026: the formatting tool is the app's own file now – a public file server is only the second try)
  assert.match(app, /one\(window\.rclVendor\('exceljs-4\.4\.0\.min\.js'\)\)\.catch\(\(\) => one\('https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs\/4\.4\.0\/exceljs\.min\.js'\)\)/);
  // the rule for figures, tried: amounts become numbers; dates, codes and account-like numbers stay text
  const grabFn = m => { const i = app.indexOf(m); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const num = new Function(grabFn('function xlNum(') + '; return xlNum;')();
  const n = v => { const x = num(v); return x ? x.v : null; };
  assert.deepStrictEqual(['40,000.00', '₹ 50,000.00', '− 2,300.00', '-393', '1,23,45,678.50', '55263', '0', '0.00', '2.5', '1000'].map(n), [40000, 50000, -2300, -393, 12345678.5, 55263, 0, 0, 2.5, 1000]);
  assert.deepStrictEqual(['000123456789', '05.10.2026', '01-09-2026', 'MH09BC2570', '9876543210', '2%', '160.00 LTR', '21 KM', 'RCL/VTR/RA-51', '–', '', '27AAKCR9897B1ZQ', '0012'].map(n), Array(13).fill(null));
  assert.strictEqual(num('40,000.00').z, '#,##0.00'); assert.strictEqual(num('1,200').z, '#,##0'); assert.strictEqual(num('55263').z, '');
  // one way to open a saved bill
  assert.strictEqual((app.match(/await viewSavedBill\(/g) || []).length, 4, 'RCL Drive (bills and debit notes), Bill Summary, Vendor Ledger');
  const vs = app.slice(app.indexOf('async function viewSavedBill('), app.indexOf('/* ---------- saved bills ---------- */'));
  assert.match(vs, /window\.open\('', '_blank'\)/); assert.match(vs, /billSheets\(data, [^)]*\) \+ lb \+ ann, 'rep rep-bill' \+ \(lb \? ' rep-lb' : ''\)/);      // (update-153: and the annex of its files)
  // (update-151) its Log Book from the bill's evidence (as submitted); a legacy bill: today's Log Book with the note that says so
  assert.match(vs, /const x = await billLogOf\(b\);\s+if \(x\.L\.rows\.length\) lb = x\.note \+ \(await logSheetsOf\(x\.L, b\.company\)\)\.sheets;/);
  assert.match(vs, /call\('getBillEvidence', \{ id: b\.id \}\)/); assert.match(vs, /logs = await call\('getLogBookList', \{ from: b\.from, to: b\.to, all: true \}\)/);
  assert.match(vs, /The Log Book below is TODAY\\'S Log Book/);
  assert.match(app, /\.billsheet \+ \.lbsheet, \.lbsheet \+ \.billsheet \{ break-before: page; \}/);
});

test('a submitted bill locks the Log Book and diesel entries of its machinery for its dates – for everyone but the Super Admin, also after it is deleted (update-152); the refusal says the way out', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const LOCK = /this machinery is in the submitted RA Bill 9 of Lock Vendor \(.+, 01-07-2026 to 31-07-2026\) – its Log Book and diesel entries of those dates cannot be added, changed or deleted without the Super Admin \(a bill replaced or deleted keeps them locked\)\. To correct them: change the entry and send it to the Super Admin for approval \(the page asks\) – approved, it is saved and the difference is taken in the next bill of this vendor\./;      // (update-108: the Super Admin's approval is the way out; update-152: the only one – a deleted bill keeps them locked)
  const refused = r => LOCK.test(String((r && r.THROWN) || '') + ' ' + ((r && r.errors) || []).map(e => e.msg).join(' '));
  for (const no of ['BLK-1', 'BLK-2']) run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: no === 'BLK-1' ? 'Lock Vendor' : 'Other Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  for (const v of ['Lock Vendor', 'Other Vendor']) run('(x, m) => saveVendor_(x, m)', { name: v, gstReg: 'No', pan: 'ABCPE1234L', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Lock Vendor', from: '2026-06-01', tdsPct: 2, woNo: 'WO-BLK', lines: [{ no: 'BLK-1', basis: 'Monthly', rate: 31000, diesel: 'Company' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-06-01', location: 'Dispenser', pump: 'Pump', qty: 5000, rate: 100, billNo: 'BLK-IN', billDate: '2026-06-01' });
  const log = (no, date, close, extra) => run('x => saveLogRowsInner_(x)', { rows: [Object.assign({ date: date, shift: 'Full Day', no: no, mode: 'KM', closingKm: close }, extra || {})] });
  assert.ok(log('BLK-1', '2026-06-30', 1040, { openingKm: 1000 }).ok); assert.ok(log('BLK-1', '2026-07-01', 1080).ok); assert.ok(log('BLK-1', '2026-07-02', 1120).ok); assert.ok(log('BLK-1', '2026-07-03', 1160).ok);
  assert.ok(log('BLK-1', '2026-08-01', 1200).ok); assert.ok(log('BLK-2', '2026-07-01', 540, { openingKm: 500 }).ok);
  const d1 = run('x => saveDieselIssue_(x)', { date: '2026-07-02', shift: 'Day', source: 'Dispenser', no: 'BLK-1', qty: 10, kmReading: 1080, force: true }); assert.ok(d1 && !d1.THROWN, JSON.stringify(d1).slice(0, 200));
  const dId = run('() => getDieselIssues_({ from: "2026-07-02", to: "2026-07-02", no: "BLK-1" }).rows[0].id');
  // nothing is locked before the bill
  assert.strictEqual(run('() => billLockOf_("BLK-1", "2026-07-02")'), null);
  assert.strictEqual(run('() => getLogBookList_({ from: "2026-06-01", to: "2026-08-31", no: "BLK-1", all: true }).rows.filter(r => r.lk).length'), 0);
  // ---------- the bill of July is built (as the page builds it), verified and submitted ----------
  const co = run('() => billCompanies_()')[0];
  const bill = run(`co => { const m = findMachine_('BLK-1'), from = '2026-07-01', to = '2026-07-31';
    const c = billMachineCalc_(m, getLogBookList_({ from: from, to: to, no: 'BLK-1', all: true }).rows, logPrintExtra_({ from: from, to: to, nos: ['BLK-1'] }), from, to, undefined, true);
    const A = r2_(c.amount), B = r2_(c.excessAmt), D = r2_(A - B), H2 = D > 0 ? r2_(D * c.tdsPct / 100) : 0;
    return { company: co, vendor: { name: 'Lock Vendor' }, from: from, to: to, billDate: '2026-08-02', billNo: '9', picked: ['BLK-1'], partial: false, edited: false, idlePaid: true,
      machines: [{ no: 'BLK-1', workDays: c.workDays, nights: c.nights, issued: c.issued, amount: c.amount, excessAmt: c.excessAmt, lines: [] }], A: A, B: B, C: 0, D: D, E: 0, F: 0, G: D, H: H2, I: r2_(D - H2), gstPct: c.gstPct, tdsPct: c.tdsPct }; }`, co);
  const ver = run('b => verifyBills_({ bills: [b] })', bill);
  assert.ok(ver && ver.ok, 'the bill verifies: ' + JSON.stringify(((ver && ver.bills) || [{}])[0].checks || ver).slice(0, 700));
  const sub = run('(b, co) => submitBills_({ bills: [{ vendor: "Lock Vendor", company: co, billNo: "9", from: b.from, to: b.to, billDate: b.billDate, net: b.I, data: b }] })', bill, co);
  assert.ok(sub && sub.ok, JSON.stringify(sub).slice(0, 300));
  const state = () => run(`() => { const lt = table_(APP.SHEET_LOG), c = lt.c, t = table_(APP.SHEET_DIESEL, DIESEL_COLS_); return lt.rows.filter(r => /^BLK-/.test(str_(r[c[H.NO]]))).map(r => str_(r[c[H.NO]]) + ' ' + dkey_(r[c[H.DATE]]) + ' ' + str_(r[c[H.SHIFT]]) + ' ' + num0_(r[c[H.OKM]]) + '>' + num0_(r[c[H.CKM]]) + ' d' + num0_(r[c[H.QTY]]) + ' ' + str_(r[c[H.WORK]])).sort().join(' | ') + ' || ' + t.rows.filter(r => /^BLK-/.test(str_(r[t.c[H.NO]]))).map(r => str_(r[t.c[H.NO]]) + ' ' + dkey_(r[t.c[H.IDATE]]) + ' ' + num0_(r[t.c[H.QTY]])).sort().join(' | '); }`);
  const before = state();
  // the lists tell the page which rows are locked
  const marks = run('() => { const L = getLogBookList_({ from: "2026-06-01", to: "2026-08-31", all: true }); return { rows: L.rows.filter(r => /^BLK-/.test(r.no)).map(r => r.no + " " + r.date + (r.lk ? " LOCK" : "")).sort(), locks: Object.values(L.locks).map(x => x.billNo + " " + x.vendor + " " + x.from + ".." + x.to) }; }');
  assert.deepStrictEqual(marks.rows, ['BLK-1 2026-06-30', 'BLK-1 2026-07-01 LOCK', 'BLK-1 2026-07-02 LOCK', 'BLK-1 2026-07-03 LOCK', 'BLK-1 2026-08-01', 'BLK-2 2026-07-01']);
  assert.deepStrictEqual(marks.locks, ['9 Lock Vendor 2026-07-01..2026-07-31']);
  assert.strictEqual(run('id => getDieselIssues_({ from: "2026-07-01", to: "2026-07-31", no: "BLK-1" }).rows.filter(r => r.id === id && r.lk).length', dId), 1);
  assert.deepStrictEqual(run('() => getLogEditData_("BLK-1", "2026-06-25", "2026-08-05").locks.map(x => x.billNo + " " + x.from + ".." + x.to)'), ['9 2026-07-01..2026-07-31']);
  // ---------- every way of adding / changing / deleting inside the bill is refused ----------
  const key = d => run('d => { const lt = table_(APP.SHEET_LOG), c = lt.c; return logKeyOf_(lt, lt.rows.find(r => str_(r[c[H.NO]]) === "BLK-1" && dkey_(r[c[H.DATE]]) === d)); }', d);
  const grid = () => run('() => getLogEditData_("BLK-1", "2026-06-25", "2026-08-05").rows').map(r => ({ key: r.key, half: !!r.half, date: r.date, shift: r.shift, mode: r.mode || r.unit, openingKm: r.okm, closingKm: r.ckm, work: r.work || '' }));
  const bulk = (rows, deleted) => run('b => saveLogBulk_(b)', { no: 'BLK-1', from: '2026-06-25', to: '2026-08-05', rows: rows, deleted: deleted || [] });
  const tries = {
    'Log Book: a new entry on a billed date (15 Jul)': () => run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-07-15', shift: 'Full Day', no: 'BLK-1', mode: 'KM', closingKm: 1170 }] }),
    'Log Book list: an entry changed': () => run('(k, l) => updateLogRow_(k, l)', key('2026-07-02'), { closingKm: 1125, work: 'changed' }),
    'Log Book list: an entry deleted': () => run('k => deleteLogRow_(k)', key('2026-07-03')),
    'Edit Log Book: a reading of a billed date changed': () => { const g = grid(); g.find(x => x.date === '2026-07-02').closingKm = 1130; g.find(x => x.date === '2026-07-03').openingKm = 1130; return bulk(g); },
    'Edit Log Book: a billed entry deleted': () => { const g = grid(); return bulk(g.filter(x => x.date !== '2026-07-03'), [g.find(x => x.date === '2026-07-03').key]); },
    'Edit Log Book: a Night added on a billed date': () => { const g = grid(); g.find(x => x.date === '2026-07-02').shift = 'Day'; g.push({ key: '', date: '2026-07-02', shift: 'Night', mode: 'KM', openingKm: 1120, closingKm: 1120 }); return bulk(g); },
    'Edit Log Book: an entry BEFORE the bill changed so that the first billed entry would start elsewhere': () => bulk(grid().filter(x => x.date === '2026-06-30').map(x => Object.assign(x, { closingKm: 1050 }))),
    'Log Book list: the entry before the bill changed (its Close is the Start of the first billed entry)': () => run('(k, l) => updateLogRow_(k, l)', key('2026-06-30'), { closingKm: 1050 }),
    'Diesel Issue: a new issue on a billed date': () => run('x => saveDieselIssue_(x)', { date: '2026-07-03', shift: 'Day', source: 'Dispenser', no: 'BLK-1', qty: 5, kmReading: 1160, force: true }),
    'Diesel Issue: many at once (one row of the billed machinery)': () => run('x => saveDieselBulk_(x)', { date: '2026-07-03', shift: 'Day', source: 'Dispenser', force: true, rows: [{ no: 'BLK-2', qty: 5, kmReading: 540 }, { no: 'BLK-1', qty: 5, kmReading: 1160 }] }),
    'Diesel Issue: an issue changed': () => run('(id, x) => updateDieselIssue_(id, x)', dId, { date: '2026-07-02', shift: 'Day', source: 'Dispenser', no: 'BLK-1', qty: 99, kmReading: 1080, force: true }),
    'Diesel Issue: an issue deleted': () => run('id => deleteDieselIssue_(id)', dId),
    'Diesel Issue: an issue of another date moved INTO the bill': null,
  };
  Object.keys(tries).forEach(name => { if (!tries[name]) return; const r = tries[name](); assert.ok(refused(r), name + ' must be refused with the way out, got: ' + JSON.stringify(r).slice(0, 400)); assert.strictEqual(state(), before, name + ': nothing changed'); });
  // ---------- what is NOT locked keeps working ----------
  let r = bulk(grid()); assert.ok(r && r.ok && r.changed === 0, 'the grid sent back as it is (billed rows in it) saves: ' + JSON.stringify(r).slice(0, 300));
  r = bulk(grid().map(x => Object.assign(x, { same: true }))); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 200));
  { const g = grid(); g.find(x => x.date === '2026-08-01').closingKm = 1210; r = bulk(g); assert.ok(r && r.ok && r.changed === 1, 'an entry after the bill is changed while billed rows are in the grid: ' + JSON.stringify(r).slice(0, 300)); }
  assert.ok(log('BLK-1', '2026-08-02', 1250).ok, 'a new entry after the bill');
  assert.ok(log('BLK-2', '2026-07-02', 580).ok, 'another machinery (not in the bill) on the same dates');
  r = run('x => saveDieselIssue_(x)', { date: '2026-08-01', shift: 'Day', source: 'Dispenser', no: 'BLK-1', qty: 7, kmReading: 1200, force: true }); assert.ok(r && !r.THROWN, 'diesel after the bill: ' + JSON.stringify(r).slice(0, 200));
  r = run('x => saveDieselIssue_(x)', { date: '2026-07-02', shift: 'Day', source: 'Dispenser', no: 'BLK-2', qty: 7, kmReading: 540, force: true }); assert.ok(r && !r.THROWN, 'diesel of another machinery: ' + JSON.stringify(r).slice(0, 200));
  // ---------- (update-152) the bill is deleted – by the Super Admin only, kept as "Deleted": its entries stay locked ----------
  const billId = run('() => { const t = billTable_(); return billOut_(t, t.rows.find(r => billOut_(t, r, false).vendor === "Lock Vendor"), false).id; }');
  r = run('(id, why) => deleteBill_(id, why)', billId, 'correction of the Log Book');
  assert.match(r.THROWN || '', /^Only the Super Admin deletes a submitted bill \(signed in through the Portal\)/, 'the Admin cannot delete it: ' + JSON.stringify(r).slice(0, 200));
  r = run('(id, why) => { ACTOR_SUPER_ = true; ACTOR_ = "Super Admin"; try { return deleteBill_(id, why); } finally { ACTOR_SUPER_ = false; } }', billId, '');
  assert.match(r.THROWN || '', /Give the reason for deleting this bill/);
  r = run('(id, why) => { ACTOR_SUPER_ = true; ACTOR_ = "Super Admin"; try { return deleteBill_(id, why); } finally { ACTOR_SUPER_ = false; } }', billId, 'correction of the Log Book'); assert.ok(r && r.ok && r.bill.status === 'Deleted', JSON.stringify(r).slice(0, 200));
  const gone = run('id => getBills_({ id: id }).bills[0]', billId);
  assert.ok(gone && gone.status === 'Deleted' && gone.deletedBy === 'Super Admin' && gone.deleteReason === 'correction of the Log Book' && /^\d{4}-\d{2}-\d{2}T/.test(gone.deletedAt), 'kept, marked Deleted – who, when, why: ' + JSON.stringify(gone).slice(0, 300));
  assert.ok(run('() => billLockOf_("BLK-1", "2026-07-02")'), 'its entries stay locked');
  assert.strictEqual(run('() => billLockOf_("BLK-1", "2026-07-02").status'), 'Deleted');
  r = run('(k, l) => updateLogRow_(k, l)', key('2026-07-02'), { closingKm: 1125, work: 'corrected after the bill was deleted' });
  assert.match(r.THROWN || '', /this machinery is in the submitted RA Bill 9 \(deleted\) of Lock Vendor .*\(a bill replaced or deleted keeps them locked\)/, 'a deleted bill does not unlock: ' + JSON.stringify(r).slice(0, 300));
  r = run('id => deleteDieselIssue_(id)', dId); assert.ok(refused(r) || /RA Bill 9 \(deleted\)/.test(r.THROWN || ''), 'nor its diesel issue: ' + JSON.stringify(r).slice(0, 200));
  assert.strictEqual(run('() => getLogBookList_({ from: "2026-06-01", to: "2026-08-31", no: "BLK-1", all: true }).rows.filter(r => r.lk).length'), 3, 'the list still marks them');
  r = run('(id, why) => { ACTOR_SUPER_ = true; try { return deleteBill_(id, why); } finally { ACTOR_SUPER_ = false; } }', billId, 'again'); assert.match(r.THROWN || '', /is already deleted/);
  // the Super Admin corrects the entry – with his reason (asked by the page; without it: SA_REASON)
  r = run('(k, l) => { ACTOR_SUPER_ = true; try { return updateLogRow_(k, l); } finally { ACTOR_SUPER_ = false; } }', key('2026-07-02'), { closingKm: 1125, work: 'corrected' });
  assert.match(r.THROWN || '', /^SA_REASON: Super Admin – this save changes 2 locked Log Book entries \(BLK-1 02-07-2026 – changed, in RA Bill 9; BLK-1 03-07-2026 – changed, in RA Bill 9\)\. Give the reason: it is kept with the entry's history\.$/);
  r = run('(k, l) => { ACTOR_SUPER_ = true; SA_REASON_ = "the meter photo shows 1125"; try { return updateLogRow_(k, l); } finally { ACTOR_SUPER_ = false; SA_REASON_ = ""; } }', key('2026-07-02'), { closingKm: 1125, work: 'corrected' });
  assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
  // a new bill of these dates after the delete is a NEW bill (not a revision): allowed for the Billing user
  const ver2 = run('b => verifyBills_({ bills: [b] })', Object.assign({}, bill, { billNo: '10' }));
  assert.ok(ver2 && !(((ver2.bills || [])[0] || {}).checks || []).some(c => c.s === 'bad' && /only the Super Admin can revise/.test(c.t)), JSON.stringify(ver2).slice(0, 400));
});

test('split timing of a Time entry: several From – To in one entry, hours as decimal numbers, the hour columns stay true, the bill takes the total', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // the times themselves
  const ts = l => run('l => timeSlots_(l, "X: ")', l);
  assert.deepStrictEqual((({ text, n, start, end, gaps, mins, each }) => [text, n, start, end, gaps, mins, each])(ts([['11:00', '13:00'], ['14:00', '17:00']])), ['11:00-13:00,14:00-17:00', 2, '11:00', '17:00', 60, 300, [2, 3]]);
  assert.deepStrictEqual(ts([['14:00', '15:30']]).each, [1.5]);                                   // 2 pm to 3.30 pm = 1.5
  assert.deepStrictEqual(ts([['2:00 PM', '3:30 PM']]).text, '14:00-15:30');
  assert.deepStrictEqual((x => [x.text, x.gaps, x.mins, x.each])(ts([['20:00', '23:00'], ['01:00', '04:30']])), ['20:00-23:00,01:00-04:30', 120, 390, [3, 3.5]]);      // a night, split around midnight
  assert.deepStrictEqual((x => [x.mins, x.each])(ts([['22:00', '02:00']])), [240, [4]]);        // one time past midnight
  assert.deepStrictEqual((x => [x.n, x.gaps, x.mins])(ts([['06:00', '08:00'], ['20:00', '22:00']])), [2, 720, 240]);      // a long gap in the same day is fine
  assert.match(ts([['14:00', '17:00'], ['11:00', '13:00']]).THROWN, /time 2 \(11:00 to 13:00\) starts before time 1 ends \(17:00\) – the times must be in the order they were worked/);
  assert.match(ts([['11:00', '13:00'], ['12:00', '14:00']]).THROWN, /starts before time 1 ends \(13:00\)/);          // overlap
  assert.match(ts([['11:00', '13:00'], ['14:00', '']]).THROWN, /time 2: enter both From and To/);
  assert.match(ts([['08:00', '20:00'], ['21:00', '09:00']]).THROWN, /cover more than 24 hours/);
  assert.strictEqual(ts([['', '']]), null);
  assert.deepStrictEqual(run('() => slotsParse_("11:00-13:00, 14:00-17:00,bad")'), [['11:00', '13:00'], ['14:00', '17:00']]);

  // ---------- an entry ----------
  run('(x, m) => saveMaster_(x, m)', { no: 'TS-1', name: 'Poclain', type: 'Poclain', unit: 'Hrs', worksOn: ['Hrs', 'Time'], hrStd: 4, owner: 'Split Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Split Vendor', gstReg: 'No', pan: 'ABCPE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Split Vendor', from: '2026-06-01', tdsPct: 0, woNo: 'WO-TS', lines: [{ no: 'TS-1', basis: 'Per Hour', rate: 1000, diesel: 'Company' }] }, 'add');
  const cols = () => run(`() => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(r => str_(r[c[H.NO]]) === 'TS-1').map(r => dkey_(r[c[H.DATE]]).slice(8) + ' ' + str_(r[c[H.SHIFT]]) + ': ' + tStr_(r[c[H.TSTART]]) + '>' + tStr_(r[c[H.TEND]]) + ' brk ' + numOrBlank_(r[c[H.TBRK]]) + ' hrs ' + num0_(r[c[H.THRS]]) + ' whr ' + num0_(r[c[H.WHR]]) + (H.TSLOTS in c && str_(r[c[H.TSLOTS]]) ? ' [' + str_(r[c[H.TSLOTS]]) + ']' : '')).sort(); }`);
  const save = rows => run('x => saveLogRowsInner_(x)', { rows: rows.map(r => Object.assign({ no: 'TS-1', mode: 'Time' }, r)) });
  let r = save([{ date: '2026-07-01', shift: 'Day', tSlots: [['11:00', '13:00'], ['14:00', '17:00']] },                       // his example: 2 + 3 = 5
    { date: '2026-07-01', shift: 'Night', tSlots: [['20:00', '23:00'], ['01:00', '04:30']], tBreak: 30 },                         // a night in two parts, 30 min break inside: 3 + 3.5 − 0.5 = 6
    { date: '2026-07-02', shift: 'Full Day', tSlots: [['14:00', '15:30']] },                                                     // one time: 1.5
    { date: '2026-07-03', shift: 'Full Day', tStart: '08:00', tEnd: '13:00', tBreak: 30 }]);                                     // the old way (a page that sends From / To / Break): 4.5
  assert.ok(r && r.ok, JSON.stringify(r).slice(0, 400));
  assert.deepStrictEqual(cols(), ['01 Day: 11:00>17:00 brk 60 hrs 5 whr 5 [11:00-13:00,14:00-17:00]', '01 Night: 20:00>04:30 brk 150 hrs 6 whr 6 [20:00-23:00,01:00-04:30]', '02 Full Day: 14:00>15:30 brk  hrs 1.5 whr 1.5', '03 Full Day: 08:00>13:00 brk 30 hrs 4.5 whr 4.5']);
  // the rule that keeps every old reader right: Time Hrs = (End − Start) − Break, for every entry
  assert.deepStrictEqual(run(`() => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(r => str_(r[c[H.NO]]) === 'TS-1').map(r => timeHrs_(tStr_(r[c[H.TSTART]]), tStr_(r[c[H.TEND]]), r[c[H.TBRK]]) === num0_(r[c[H.THRS]])); }`), [true, true, true, true]);
  // the page is told the split; the bill takes the hours: 5 + 6 + 1.5 + 4.5 = 17 hours × ₹1,000
  assert.deepStrictEqual(run('() => getLogBookList_({ from: "2026-07-01", to: "2026-07-31", no: "TS-1", all: true }).rows.map(x => x.date.slice(8) + " " + x.shift + " " + x.tSlots).sort()'), ['01 Day 11:00-13:00,14:00-17:00', '01 Night 20:00-23:00,01:00-04:30', '02 Full Day ', '03 Full Day ']);
  assert.deepStrictEqual(run('() => { const c = billMachineCalc_(findMachine_("TS-1"), getLogBookList_({ from: "2026-07-01", to: "2026-07-31", no: "TS-1", all: true }).rows, logPrintExtra_({ from: "2026-07-01", to: "2026-07-31", nos: ["TS-1"] }), "2026-07-01", "2026-07-31", undefined, true); return c.amount; }'), 17000);
  // refused, nothing saved
  r = save([{ date: '2026-07-04', shift: 'Full Day', tSlots: [['14:00', '17:00'], ['11:00', '13:00']] }]); assert.match(JSON.stringify(r), /starts before time 1 ends/);
  r = save([{ date: '2026-07-04', shift: 'Full Day', tSlots: [['11:00', '11:20']], tBreak: 30 }]); assert.match(JSON.stringify(r), /the working time is 0/);
  assert.strictEqual(cols().length, 4);

  // ---------- an entry changed ----------
  const key = (d, sh) => 'TS-1|' + d + '|' + sh;
  r = run('(k, l) => updateLogRow_(k, l)', key('2026-07-01', 'Day'), { tStart: '10:00', tEnd: '18:00', tSlots: [['10:00', '13:00'], ['14:00', '16:00'], ['16:30', '18:00']], tBreak: '' }); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
  assert.strictEqual(cols()[0], '01 Day: 10:00>18:00 brk 90 hrs 6.5 whr 6.5 [10:00-13:00,14:00-16:00,16:30-18:00]');                 // three parts: 3 + 2 + 1.5
  r = run('(k, l) => updateLogRow_(k, l)', key('2026-07-01', 'Night'), { tStart: '20:00', tEnd: '04:30', tSlots: [['20:00', '04:30']], tBreak: 60 }); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
  assert.strictEqual(cols()[1], '01 Night: 20:00>04:30 brk 60 hrs 7.5 whr 7.5');                                                      // made one time again: the split is gone
  // a page that does not send the times as a list (Edit Log Book grid, an older page): the split STAYS while From / To / Break are as saved …
  const grid = () => run('() => getLogEditData_("TS-1", "2026-07-01", "2026-07-31").rows').map(x => ({ key: x.key, date: x.date, shift: x.shift, mode: x.mode, tStart: x.tStart, tEnd: x.tEnd, tBreak: x.tBrk, work: x.work || '' }));
  let g = grid(); g.find(x => x.date === '2026-07-02').work = 'trench'; r = run('b => saveLogBulk_(b)', { no: 'TS-1', from: '2026-07-01', to: '2026-07-31', rows: g, deleted: [] }); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
  assert.strictEqual(cols()[0], '01 Day: 10:00>18:00 brk 90 hrs 6.5 whr 6.5 [10:00-13:00,14:00-16:00,16:30-18:00]');
  // … and goes when one of them is changed there (the entry becomes one From – To with that break)
  g = grid(); g.find(x => x.date === '2026-07-01' && x.shift === 'Day').tEnd = '19:00'; r = run('b => saveLogBulk_(b)', { no: 'TS-1', from: '2026-07-01', to: '2026-07-31', rows: g, deleted: [] }); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
  assert.strictEqual(cols()[0], '01 Day: 10:00>19:00 brk 90 hrs 7.5 whr 7.5');
});

test('audit 07-10-2026: the Excel tools are files of the app itself; the security headers; nothing of a bill becomes HTML', () => {
  const crypto = require('crypto');
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  // 1. the two tools are in app/vendor, unchanged (their sha256 is written in the README beside them), and build.js publishes them
  const readme = fs.readFileSync(path.join(root, 'app', 'vendor', 'README.txt'), 'utf8');
  for (const f of ['xlsx-0.18.5.full.min.js', 'exceljs-4.4.0.min.js']) {
    const sum = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'app', 'vendor', f))).digest('hex');
    assert.ok(readme.indexOf(sum) > -1, f + ' is the file the README describes (sha256 ' + sum.slice(0, 12) + '…)');
    assert.ok(app.indexOf("rclVendor('" + f + "')") > -1, 'the page loads ' + f + ' from its own address');
  }
  assert.match(fs.readFileSync(path.join(root, 'build.js'), 'utf8'), /app', 'vendor'/);
  // every script the page adds by itself: the first address is the app's own; a public server appears only inside an "on error" / catch
  const srcs = [...app.matchAll(/\.src = ([^;]+);/g)].map(m => m[1]).filter(x => /https?:\/\//.test(x) && /\.js'/.test(x));
  assert.deepStrictEqual(srcs, ["'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'"], 'only the second try of the Excel tool names a public server directly');
  assert.match(app, /sc\.onerror = function \(\) \{ var s2 = document\.createElement\('script'\); s2\.src = 'https:\/\/cdnjs/);
  // 2. the headers of the site
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')), hs = vj.headers.find(h => h.source === '/(.*)').headers, H = k => (hs.find(h => h.key === k) || {}).value || '';
  assert.match(H('Content-Security-Policy'), /object-src 'none'/); assert.match(H('Content-Security-Policy'), /frame-ancestors 'self'/); assert.match(H('Content-Security-Policy'), /base-uri 'self'/); assert.match(H('Content-Security-Policy'), /form-action 'self'/);
  assert.ok(!/script-src|default-src|style-src/.test(H('Content-Security-Policy')), 'nothing that could stop the page itself is ENFORCED yet');
  assert.match(H('Content-Security-Policy-Report-Only'), /script-src 'self' 'unsafe-inline'/);
  assert.match((vj.headers.find(h => h.source === '/vendor/(.*)') || { headers: [{}] }).headers[0].value || '', /immutable/);
  // 3. a bill's stored data: the server refuses HTML in it, ordinary text passes
  const { ctx } = require('./harness.js'); const h = { run: c => require('vm').runInContext(c, ctx) };
  assert.throws(() => h.run("billNoHtml_({ from: '2026-09-01<img src=x onerror=alert(1)>' }, 'ABC')"), /looks like HTML/);
  assert.throws(() => h.run("billNoHtml_({ machines: [{ lines: [{ unit: 'Hrs</td><script>x()</script>' }] }] }, 'ABC')"), /looks like HTML/);
  assert.throws(() => h.run("billNoHtml_({ '<b>key': 1 }, 'ABC')"), /looks like HTML/);
  assert.doesNotThrow(() => h.run("billNoHtml_({ vendor: { name: 'M/s A & B (Engg.) \"Works\"', addr: 'Plot < 5, Gat > 10, 5<10, a < b' }, machines: [{ no: 'MH-04-LM-8409', nights: 2, lines: [{ unit: 'Hrs', qty: 5.5, note: 'rate ₹1,000/hr' }] }], from: '2026-09-01', A: 100.5, ok: true, none: null }, 'ABC')"));
});

test('update-68: passwords – scrypt format, old format still read, re-keeping carries the stamp; the cost settings cannot be abused', () => {
  const { ctx } = require('./harness.js'); const gas = require('../server/gas.js'); const R = c => require('vm').runInContext(c, ctx);
  // the host function: only the short list of cost settings, a proper salt
  const salt = '00112233445566778899aabbccddeeff';
  assert.strictEqual(gas.scryptHex('pw', salt, 32768, 8, 3), crypto.scryptSync(Buffer.from('pw'), Buffer.from(salt, 'hex'), 32, { N: 32768, r: 8, p: 3, maxmem: 160 * 1024 * 1024 }).toString('hex'));
  for (const bad of [[1024, 8, 1], [1073741824, 8, 1], [32768, 16, 1], [32768, 8, 9], [32768, 8, 0]]) assert.throws(() => gas.scryptHex('pw', salt, bad[0], bad[1], bad[2]), /not allowed/);
  assert.throws(() => gas.scryptHex('pw', 'xyz', 32768, 8, 3), /not allowed/);
  // without the host function (the old Apps Script copy of the code): the older way, as before
  const U0 = ctx.Utilities; ctx.Utilities = gas.Utilities;      // (the real stand-in of the server: digests, random ids)
  assert.match(R("makeHash_('Site#Office2468')"), /^sha256\$[0-9a-f]{16}\$[0-9a-f]{64}$/);
  ctx.__scrypt = gas.scryptHex;
  try {
    const h = R("makeHash_('Site#Office2468')");
    assert.match(h, /^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{64}\$[0-9a-f]{12}$/);
    assert.notStrictEqual(h, R("makeHash_('Site#Office2468')"), 'a new salt every time');
    ctx.__h = h;
    assert.strictEqual(R("checkPw_('Site#Office2468', __h)"), true); assert.strictEqual(R("checkPw_('Site#Office2469', __h)"), false); assert.strictEqual(R('checkPw_(__h, __h)'), false, 'the kept text is not a password');
    assert.strictEqual(R('isHashed_(__h)'), true); assert.strictEqual(R("isHashed_('tmp$' + __h)"), false); assert.strictEqual(R("isTempHash_('tmp$' + __h)"), true); assert.strictEqual(R("checkPw_('Site#Office2468', 'tmp$' + __h)"), true);
    assert.strictEqual(R('pwStamp_(__h)'), h.slice(-12)); assert.strictEqual(R('rehash_("Site#Office2468", __h)'), '', 'kept the current way: not written again');
    // the older way: read, and kept afresh with the stamp it had (other sessions stay signed in)
    let x = crypto.createHash('sha256').update('03df218ade11434e|Nashik#Road848!', 'utf8').digest(); for (let i = 0; i < 300; i++) x = crypto.createHash('sha256').update(Buffer.concat([x, Buffer.from('03df218ade11434e', 'utf8')])).digest();
    ctx.__old = 'sha256$03df218ade11434e$' + x.toString('hex');
    assert.strictEqual(R("checkPw_('Nashik#Road848!', __old)"), true); assert.strictEqual(R("checkPw_('nashik#Road848!', __old)"), false); assert.strictEqual(R('isHashed_(__old)'), true);
    const up = R("rehash_('Nashik#Road848!', __old)"), stamp = crypto.createHash('sha256').update('st|' + ctx.__old).digest('hex').slice(0, 12);
    assert.match(up, /^scrypt\$32768\$8\$3\$/); assert.strictEqual(up.slice(-12), stamp); assert.strictEqual(R('pwStamp_(__old)'), stamp);
    // a one-time hash of the older way and a plain text: kept afresh as ONE-TIME
    assert.match(R("rehash_('Temp#1234', 'tmp$' + __old)"), /^tmp\$scrypt\$/); assert.match(R("rehash_('Plain#Typed9', 'Plain#Typed9')"), /^tmp\$scrypt\$/);
    assert.strictEqual(R("isHashed_('Plain#Typed9')"), false);
    // damaged or planted kept texts never open and are never compared as plain text
    for (const bad of ["'scrypt$1073741824$8$1$' + '0'.repeat(32) + '$' + '0'.repeat(64) + '$' + '0'.repeat(12)", "__h.slice(0, -20) + 'zz' + __h.slice(-18)", "'sha256$zz$zz'", "'tmp$scrypt$'"]) {
      assert.strictEqual(R('checkPw_(' + bad + ', ' + bad + ')'), false, bad); assert.strictEqual(R("checkPw_('Site#Office2468', " + bad + ')'), false, bad); assert.strictEqual(R('isHashed_(' + bad + ')'), false, bad); }
    // other cost settings from the allowed list are read, and count as "to be kept afresh"
    const low = 'scrypt$16384$8$1$' + salt + '$' + gas.scryptHex('Site#Office2468', salt, 16384, 8, 1) + '$abcdefabcdef'; ctx.__low = low;
    assert.strictEqual(R("checkPw_('Site#Office2468', __low)"), true); assert.strictEqual(R('pwCurrent_(__low)'), false);
    const up2 = R("rehash_('Site#Office2468', __low)"); assert.match(up2, /^scrypt\$32768\$8\$3\$/); assert.strictEqual(up2.slice(-12), 'abcdefabcdef');
  } finally { delete ctx.__scrypt; delete ctx.__h; delete ctx.__old; delete ctx.__low; ctx.Utilities = U0; }
});

test('update-68: a session carries its sign-in time and ends 30 days after it', () => {
  const { ctx } = require('./harness.js'); const R = c => require('vm').runInContext(c, ctx);
  assert.strictEqual(R('SESSION_MAX_DAYS'), 30); assert.strictEqual(R('SESSION_SECONDS'), 21600);
  const v = R("sessionMake_('a@b.c', 'sha256$03df218ade11434e$" + '0'.repeat(64) + "')").split('|');
  assert.strictEqual(v.length, 3); assert.ok(Math.abs(Number(v[2]) - Date.now()) < 5000);
  const day = 86400000;
  assert.ok(R("sessionRead_('a@b.c|abc|" + (Date.now() - 29 * day) + "').left") > 0);
  assert.ok(R("sessionRead_('a@b.c|abc|" + (Date.now() - 30 * day - 1000) + "').left") <= 0);
  const old = R("sessionRead_('a@b.c|abc')"); assert.strictEqual(old.made, 0); assert.strictEqual(old.left, 30 * day); assert.strictEqual(old.email, 'a@b.c'); assert.strictEqual(old.stamp, 'abc');
});

test('update-68: machinery details leave the server only for users with a page that uses them (and the shared list is never changed)', () => {
  const { ctx } = require('./harness.js'); const R = c => require('vm').runInContext(c, ctx);
  const item = { id: 'X-1', no: 'X-1', name: 'JCB', type: 'JCB', make: 'JCB', lbFormat: 'A', worksOn: ['Hrs'], unit: 'Hrs', modes: ['Hrs'], kmStd: '', hrStd: 5, owner: 'V', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01', inactiveFrom: '', tankCap: 120,
    monthlyRate: 55555, tdsRate: 2, engineNo: 'E1', chassisNo: 'C1', engineMake: 'K', taxUpto: '2027-01-01', pucUpto: '', permitUpto: '', fitnessUpto: '', insuranceUpto: '', enteredBy: 'a', updatedBy: 'b' };
  ctx.__res = { master: [item, Object.assign({}, item, { id: 'X-2' })], machine: item, rows: [{ a: 1, machine: item }, { a: 2 }], deep: { list: [{ m: { x: { machine: item } } }] }, n: 5, when: new Date(), nothing: null };
  const user = perms => ({ email: 'u@x', admin: false, perms: perms });
  const out = u => { ctx.__u = u; return R('leastOut_(__u, __res)'); };
  const RATE = ['monthlyRate', 'tdsRate'], FULL = ['engineNo', 'chassisNo', 'engineMake', 'taxUpto', 'pucUpto', 'permitUpto', 'fitnessUpto', 'insuranceUpto', 'enteredBy', 'updatedBy'];
  const has = (o, ks) => ks.filter(k => k in o).length;
  // Admin, and a user with the Asset Master: the very same object (nothing copied, nothing cut)
  assert.strictEqual(out({ admin: true, perms: {} }), ctx.__res); assert.strictEqual(out(user({ Master: 'View' })), ctx.__res); assert.strictEqual(R('leastOut_(null, __res)'), ctx.__res);
  // no page at all: every machinery item, wherever it sits in the answer, loses both groups; everything else is as it was
  const n = out(user({ Master: 'None', 'Log Book': 'None' }));
  for (const m of [n.master[0], n.master[1], n.machine, n.rows[0].machine, n.deep.list[0].m.x.machine]) { assert.strictEqual(has(m, RATE), 0); assert.strictEqual(has(m, FULL), 0); assert.strictEqual(m.hrStd, 5); assert.strictEqual(m.tankCap, 120); assert.strictEqual(m.owner, 'V'); assert.deepStrictEqual(m.worksOn, ['Hrs']); }
  assert.strictEqual(n.n, 5); assert.strictEqual(n.rows[1], ctx.__res.rows[1]); assert.strictEqual(n.when, ctx.__res.when); assert.strictEqual(n.master.length, 2); assert.strictEqual(n.master[1].id, 'X-2');
  // the shared list was NOT changed (the same items serve the next answer of the request)
  assert.strictEqual(item.monthlyRate, 55555); assert.strictEqual(item.engineNo, 'E1'); assert.strictEqual(ctx.__res.master[0], item); assert.strictEqual(ctx.__res.rows[0].machine, item);
  // Log Book (or Billing, Saved Bills): rate and TDS % stay, the Asset Master's own details go
  for (const p of [{ 'Log Book': 'View' }, { 'Machinery Billing': 'Edit' }, { 'Saved Bills': 'View' }]) { const l = out(user(p)); assert.strictEqual(l.machine.monthlyRate, 55555); assert.strictEqual(l.machine.tdsRate, 2); assert.strictEqual(has(l.machine, FULL), 0); }
  // other pages do not open the rate
  for (const p of [{ 'Diesel Issue': 'Edit' }, { Reports: 'View' }, { Dashboard: 'View' }, { 'Vendor Ledger': 'View' }, { 'Vehicle Compliance': 'Edit' }]) assert.strictEqual(has(out(user(p)).machine, RATE.concat(FULL)), 0, JSON.stringify(p));
  delete ctx.__res; delete ctx.__u;
  // who gets which list
  const sees = (p, list) => { ctx.__u = user(p); const r = R('seesAny_(__u, ' + list + ')'); delete ctx.__u; return r; };
  assert.strictEqual(sees({ 'Diesel Issue': 'View' }, 'FOR_DRIVERS_'), true); assert.strictEqual(sees({ 'Log Book': 'Edit' }, 'FOR_DRIVERS_'), false);
  assert.strictEqual(sees({ Reports: 'View' }, 'FOR_PUMPS_'), true); assert.strictEqual(sees({ Dashboard: 'View' }, 'FOR_STOCK_'), true); assert.strictEqual(sees({ 'Machinery Billing': 'View' }, 'FOR_STOCK_'), false);
  assert.strictEqual(sees({ 'Log Book': 'None', 'Saved Bills': 'None' }, 'FOR_PARTIES_'), false); assert.strictEqual(sees({}, 'FOR_STOCK_'), false);
});

test('update-68: the step-5 SQL is in the project, shown in the app word for word, and only ADDS things; the manual backup is Admin-only', () => {
  const file = fs.readFileSync(path.join(root, 'sql', 'supabase_step5_save_once.sql'), 'utf8');
  const { ctx } = require('./harness.js');
  const readme = fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8');
  const list = new Function(readme + '; return README_SQL_;')();
  const mine = list.find(x => x.name === 'supabase_step5_save_once.sql');
  assert.ok(mine, 'step 5 is listed in the app'); assert.strictEqual(mine.sql, file, 'the text shown in the app is the file, word for word');
  const code = file.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\b(drop|truncate)\b/i.test(code) && !/delete\s+from\s+public\./i.test(code) && !/alter\s+table\s+public\./i.test(code), 'nothing of the app\'s own tables is dropped, emptied or altered');
  assert.ok(!/create or replace function public\.web_write\(/.test(code), 'web_write (step 3) is left as it is');
  for (const f of ['web_op_begin', 'web_op_mark', 'web_write2', 'web_op_end', 'web_ops_cleanup']) { assert.match(code, new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public, anon, authenticated')); assert.match(code, new RegExp('grant execute on function public\\.' + f + '\\([^)]*\\) to service_role')); }
  assert.match(code, /revoke all on web\.ops from public, anon, authenticated, service_role/); assert.match(code, /alter table web\.ops enable row level security/);
  // release review (07-10-2026): one transaction; every function has a fixed, EMPTY search_path and names its tables with their schema; nothing is forced on the owner
  assert.match(code, /^\s*begin;/m); assert.match(code, /commit;\s*$/);
  const fns = [...code.matchAll(/create or replace function public\.(\w+)\([^)]*\)\s*returns \w+ language (?:plpgsql|sql) security (definer|invoker) set search_path = ([^ ]+) as \$\$([\s\S]*?)\$\$;/g)].map(m => ({ name: m[1], sec: m[2], path: m[3], body: m[4] }));
  assert.deepStrictEqual(fns.map(f => f.name + ':' + f.sec + ':' + f.path).sort(), ["web_op_begin:definer:''", "web_op_end:definer:''", "web_op_mark:definer:''", "web_op_note:definer:''", "web_ops_cleanup:definer:''", "web_write2:invoker:''"]);
  assert.strictEqual((code.match(/create or replace function/g) || []).length, 6, 'every function of the file was looked at');
  assert.match(code, /revoke all on function public\.web_op_note\(text, text\) from public, anon, authenticated, service_role/); assert.ok(!/grant execute on function public\.web_op_note/.test(code), 'the note helper is for inside use only');
  for (const f of fns) { const bare = f.body.replace(/web\.(ops|cache)\b/g, '').replace(/'[^']*'/g, ''); assert.ok(!/\b(from|into|update|join)\s+(ops|cache)\b/i.test(bare), f.name + ' names every table with its schema'); }
  assert.match(fns.find(f => f.name === 'web_op_mark').body, /perform public\.web_op_note\(p_rid, p_result\)/, 'the old-style note is written in the same transaction as the entry');
  assert.ok(!/force row level security/i.test(code), 'row-level security is not forced on the owner (the functions run as the owner)');
  assert.match(code, /check \(state in \('started', 'done', 'refused'\)\)/); assert.match(code, /check \(rid ~ '\^\[A-Za-z0-9_-\]\{8,64\}\$'\)/);
  assert.match(code, /if random\(\) < 0\.02 then begin perform public\.web_ops_cleanup\(\); exception when others then null; end; end if;/, 'housekeeping can never fail a save');
  { const rt = fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8'); assert.match(rt, /catch \(e2\) \{ st = null; asked = false; \}/); assert.match(rt, /if \(!asked\) throw new Error\('RETRY_LATER'\);/, 'outcome unknown and the database cannot be asked: the same number is sent again'); }
  { const cg = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8'); assert.match(cg, /if \(!good && !\(known && pwScrypt_\(u\.password\)\)\) pwDummy_\(password\);/, 'every refused sign-in costs one scrypt'); assert.ok(!/pwDummy_\(password\) \|\| true/.test(cg)); }
  assert.match(fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8'), /if \(o\.cron\) \{ try \{ __opsCleanup\(\); \}/);
  const api = require('vm').runInContext('API_', ctx);
  assert.strictEqual(api.backupNow.admin, true); assert.strictEqual(api.accessReport.admin, true); assert.deepStrictEqual(Array.from(api.getStock.any), ['Dashboard', 'Diesel Inward', 'Diesel Transfer', 'Diesel Issue', 'Fuel Cards', 'Reports']);      // (update-164: Fuel Cards – the cards' balances)
});

test('update-68 (D1): no code can open the backup Sheet to "anyone with the link"', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = ['app', 'server', 'api'].flatMap(d => walk(path.join(root, d))).filter(f => /\.(gs|js)$/.test(f) && !/[\\/]vendor[\\/]/.test(f));
  const all = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  // the server's backup talks to Google's Sheets API only, with a right that covers spreadsheets only: sharing (a Drive right) is out of its reach
  const g = fs.readFileSync(path.join(root, 'server', 'google.js'), 'utf8');
  assert.deepStrictEqual([...g.matchAll(/googleapis\.com\/auth\/([a-z.]+)/g)].map(m => m[1]), ['spreadsheets']);
  // (update-158, asked 24-10-2026: the photos and files copied into the company's Google Drive) ONE place asks a Drive right –
  // server/drive.js – and only "drive.file" (the app's own files and folders there, nothing else of that Drive); nothing shares a file
  const asks = files.filter(f => /auth\/drive/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(root, f).split(path.sep).join('/'));
  assert.deepStrictEqual(asks, ['server/drive.js'], 'a Drive right is asked only by the Drive copy');
  assert.deepStrictEqual([...fs.readFileSync(path.join(root, 'server', 'drive.js'), 'utf8').matchAll(/googleapis\.com\/auth\/([a-z.]+)/g)].map(m => m[1]), ['drive.file']);
  assert.ok(!/drive\/v[23]\/files\/[^'"]*permissions|permissions\.create|ANYONE_WITH_LINK|Access\.ANYONE|anyoneWithLink|role:\s*'reader',\s*type:\s*'anyone'/.test(all), 'nothing shares a file with "anyone"');
  // the one place that sets sharing at all (the old Apps Script backup) sets it to PRIVATE
  assert.deepStrictEqual([...all.matchAll(/\.setSharing\(([^)]*)\)/g)].map(m => m[1].replace(/\s+/g, ' ')), ['DriveApp.Access.PRIVATE, DriveApp.Permission.NONE']);
});

/* ===== update-69 (10-10-2026): a row for each work of one shift · each work on its own printed row · the diesel rate typed by hand ===== */
test('several works in one shift are kept inside ONE entry: saved, read back, billed item by item, and dropped when they no longer fit (hand-worked)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'P69-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 4, owner: 'P69 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'P69 Earthmovers', gstReg: 'No', pan: 'ABCDE1269P', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'P69 Earthmovers', from: '2026-06-01', tdsPct: 2, woNo: 'WO-P69', lines: [{ no: 'P69-JCB', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }] }] }, 'add');
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-06-23', shift: 'Day', no: 'P69-JCB', mode: 'Hrs', openingHr: 2357.6, closingHr: 2361.8, items: {}, work: 'DRAIN' },
    { date: '2026-06-24', shift: 'Day', no: 'P69-JCB', mode: 'Hrs', closingHr: 2364.8, items: {}, work: 'PQC', challan: '694' }, { date: '2026-06-25', shift: 'Day', no: 'P69-JCB', mode: 'Hrs', closingHr: 2368.3, items: { Breaker: 1.5 }, work: 'SOLAR' }] });
  const from = '2026-06-01', to = '2026-06-30', K = 'P69-JCB|2026-06-24|Day';
  const grid = () => run('(f, t) => getLogEditData_("P69-JCB", f, t)', from, to);
  const bulk = (parts, more) => { const rows = grid().rows.map(x => ({ key: x.key, same: x.key !== K, half: false, date: x.date, shift: x.shift, mode: x.mode || x.unit, openingHr: x.ohr, closingHr: x.chr, openingKm: '', closingKm: '', tStart: '', tEnd: '', tBreak: '', remark: x.remark || '', trip: '', challan: x.challan || '', chFrom: '', chTo: '', work: x.work || '', odSet: '',
      items: x.key === K ? { _parts: parts } : x.itemWork })).map(x => x.key === K ? Object.assign(x, more || {}) : x);
    return run('p => saveLogBulk_(p)', { no: 'P69-JCB', from: from, to: to, rows: rows, deleted: [], openingDiesel: '' }); };
  const stored = () => run(`k => { const lt = table_(APP.SHEET_LOG), c = lt.c, r = lt.rows[findLogIdx_(lt, k)]; return { ohr: num0_(r[c[H.OHR]]), chr: num0_(r[c[H.CHR]]), whr: num0_(r[c[H.WHR]]), items: str_(r[c[H.ITEMS]]), work: str_(r[c[H.WORK]]), n: lt.rows.filter(x => str_(x[c[H.NO]]) === 'P69-JCB').length }; }`, K);
  const entry = () => run('(f, t) => getLogBookList_({ from: f, to: t, no: "P69-JCB", all: true })', from, to).rows.find(r => r.date === '2026-06-24');
  const amount = () => run('(f, t) => billMachineCalc_(findMachine_("P69-JCB"), getLogBookList_({ from: f, to: t, no: "P69-JCB", all: true }).rows, logPrintExtra_({ from: f, to: t, nos: ["P69-JCB"] }), f, t, undefined, true).amount', from, to);
  // before: 4.2 + 3 + 2 hr of Bucket at 1,200 and 1.5 hr of Breaker at 1,500
  assert.strictEqual(amount(), Math.round((4.2 + 3 + 2) * 1200 + 1.5 * 1500));
  // the 24th (2361.8 → 2364.8 = 3 hr): Bucket 2 hr, then Breaker 1 hr – each with its own challan and description
  let r = bulk([{ n: 'Bucket', q: 2, c: '694', w: 'PQC' }, { n: 'Breaker', q: 1, c: '694A', w: 'ROCK' }], { work: 'PQC / ROCK', challan: '694 / 694A' });
  assert.ok(r.ok && r.changed === 1 && r.added === 0, JSON.stringify(r).slice(0, 200));
  let s = stored();
  assert.deepStrictEqual([s.ohr, s.chr, s.whr, s.n], [2361.8, 2364.8, 3, 3], 'still ONE entry with the same readings');
  assert.deepStrictEqual(JSON.parse(s.items), { Breaker: 1, _parts: [{ n: 'Bucket', q: 2, c: '694', w: 'PQC' }, { n: 'Breaker', q: 1, c: '694A', w: 'ROCK' }] });
  let e = entry();
  assert.deepStrictEqual(e.itemQty.map(x => x.n + ' ' + x.q).sort(), ['Breaker 1', 'Bucket 2'], 'the quantities of the bill come from the rows');
  assert.deepStrictEqual(e.itemParts.map(x => [x.n, x.q, x.k, x.c, x.w].join('|')), ['Bucket|2|hr|694|PQC', 'Breaker|1|hr|694A|ROCK']);
  assert.deepStrictEqual(grid().rows.find(x => x.key === K).itemParts.length, 2, 'Edit Log Book gets the rows back');
  assert.strictEqual(amount(), Math.round((4.2 + 2 + 2) * 1200 + (1 + 1.5) * 1500), 'by hand: Bucket 8.2 hr × 1,200 + Breaker 2.5 hr × 1,500 = 13,590');
  assert.strictEqual(amount(), 13590);
  // three works: Bucket – Breaker – Bucket
  assert.ok(bulk([{ n: 'Bucket', q: 1.5 }, { n: 'Breaker', q: 0.5 }, { n: 'Bucket', q: 1 }]).ok);
  assert.deepStrictEqual(JSON.parse(stored().items), { Breaker: 0.5, _parts: [{ n: 'Bucket', q: 1.5 }, { n: 'Breaker', q: 0.5 }, { n: 'Bucket', q: 1 }] });
  // what is refused – with the reason, and nothing is changed
  const keep = stored().items;
  const no = (parts, re) => { const x = bulk(parts); assert.ok(x.ok === false && re.test(x.errors.map(y => y.msg).join(' | ')), JSON.stringify(x).slice(0, 300)); assert.strictEqual(stored().items, keep); };
  no([{ n: 'Bucket', q: 1 }, { n: 'Breaker', q: 1 }], /the rows of this shift make 2 hr but the entry has 3 hr/);
  // (update-77: the same work twice one after the other is allowed for a machinery on hours; a row starting below the Close before it is not)
  no([{ n: 'Bucket', q: 2 }, { n: 'Breaker', q: 1, g: -1 }], /row 2 of 24-06-2026 starts away from the Close of the row before it – it must start at that Close or above it/);
  no([{ n: 'Bucket', q: 2 }, { n: 'Ripper', q: 1 }], /"Ripper" is not an item of its BOQ/);
  no([{ n: 'Bucket', q: 3 }, { n: 'Breaker', q: 0 }], /row 2 of 24-06-2026 \(Breaker\) has no work/);
  // (tightened after the review) a sum that is off by a paisa-sized 0.01 hr is not the entry; a quantity that rounds to nothing is no work; at most 12 rows
  no([{ n: 'Bucket', q: 2 }, { n: 'Breaker', q: 1.01 }], /the rows of this shift make 3\.01 hr but the entry has 3 hr/);
  no([{ n: 'Bucket', q: 3 }, { n: 'Breaker', q: 0.004 }], /row 2 of 24-06-2026 \(Breaker\) has no work/);
  no(Array.from({ length: 13 }, (_, i) => ({ n: i % 2 ? 'Breaker' : 'Bucket', q: i ? 0.2 : 0.6 })), /at most 12 rows for the works of one shift/);
  // the small edit window (it knows nothing of rows): nothing changed → the rows stay; a text changed → the rows are joined
  bulk([{ n: 'Bucket', q: 2, w: 'PQC' }, { n: 'Breaker', q: 1, w: 'ROCK' }], { work: 'PQC / ROCK' });
  const upd = l => run('(k, l) => updateLogRow_(k, l)', K, l);
  upd({ closingHr: 2364.8, work: 'PQC / ROCK', items: { Breaker: 1 } });
  assert.ok(/"_parts"/.test(stored().items), 'an edit that changes nothing keeps the rows');
  upd({ closingHr: 2364.8, work: 'ONLY ROCK', items: { Breaker: 1 } });
  assert.deepStrictEqual(JSON.parse(stored().items), { Breaker: 1 }, 'a changed description: one entry again, the quantities stay');
  assert.strictEqual(entry().itemParts, undefined);
  // the entry's total changed elsewhere (its Close lowered in the small window, the items left as they were): the rows no longer
  // fit → they are not used, and the bill goes by the quantities as it always did
  bulk([{ n: 'Bucket', q: 2 }, { n: 'Breaker', q: 1 }]);
  run(`k => { const lt = table_(APP.SHEET_LOG), c = lt.c, i = findLogIdx_(lt, k), row = lt.rows[i].slice(); row[c[H.CHR]] = 2364.3; row[c[H.WHR]] = 2.5; lt.sh.getRange(i + 2, 1, 1, row.length).setValues([row]); }`, K);
  e = entry();
  assert.strictEqual(e.itemParts, undefined, 'rows that do not add up to the entry are not shown');
  assert.deepStrictEqual(e.itemQty.map(x => x.n + ' ' + x.q).sort(), ['Breaker 1', 'Bucket 1.5']);
});

test('the Log Book print gives each work its own row: kept rows as entered, a Split entry in the order of the BOQ (page function, hand-worked)', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const grab = m => { const i = app.indexOf(m); assert.ok(i > -1, m + ' found'); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const env = { DAY_STATUS: ['Idle', 'Holiday', 'Breakdown'], METER_OFF: 'No reading', r2: n => Math.round(n * 100) / 100, hasKm: u => u === 'KM' || u === 'KM + Hrs', hasHr: u => u === 'Hrs' || u === 'KM + Hrs' };
  const { lbWorkRows } = new Function(...Object.keys(env), grab('function lbWorkRows(') + '; return { lbWorkRows };')(...Object.values(env));
  const boq = [{ name: 'Bucket', basis: 'Per Hour', qty: 'rest' }, { name: 'Breaker', basis: 'Per Hour', qty: 'typed' }];
  const base = { no: 'JCB', date: '2026-09-24', shift: 'Day', mode: 'Hrs', unit: 'Hrs', ohr: 2361.8, chr: 2364.8, whr: 3, okm: '', ckm: '', wkm: '', trip: '', challan: '694', work: 'PQC', remark: 'BUCKET', chFrom: 'A', chTo: 'B', boqItems: boq, debitTo: 'X' };
  const pick = y => [y.ohr, y.chr, y.whr, y.itemQty.map(x => x.n + ' ' + x.q).join('+'), y.challan, y.work].join(' ¦ ');
  // one work only: one row, as always
  assert.strictEqual(lbWorkRows(Object.assign({}, base, { itemQty: [{ n: 'Bucket', q: 3, k: 'hr' }] })), null);
  assert.strictEqual(lbWorkRows(Object.assign({}, base, { itemQty: [] })), null);
  assert.strictEqual(lbWorkRows(Object.assign({}, base, { mode: 'Idle', itemQty: [{ n: 'Bucket', q: 2, k: 'hr' }, { n: 'Breaker', q: 1, k: 'hr' }] })), null);
  // entered with Split (Breaker 1 typed, Bucket takes the rest): Bucket first (the order of the BOQ), each as long as its hours
  let ys = lbWorkRows(Object.assign({}, base, { itemQty: [{ n: 'Breaker', q: 1, k: 'hr' }, { n: 'Bucket', q: 2, k: 'hr' }] }));
  assert.deepStrictEqual(ys.map(pick), ['2361.8 ¦ 2363.8 ¦ 2 ¦ Bucket 2 ¦ 694 ¦ PQC', '2363.8 ¦ 2364.8 ¦ 1 ¦ Breaker 1 ¦ 694 ¦ PQC']);
  assert.deepStrictEqual(ys.map(y => y._part + '/' + (y.debitTo || '-')), ['Bucket/X', 'Breaker/-'], 'what belongs to the whole entry stands on its first row');
  // rows kept by Edit Log Book: as entered – Breaker first here, own challan and description; the last row closes on the entry's Close
  ys = lbWorkRows(Object.assign({}, base, { itemQty: [{ n: 'Breaker', q: 1.2, k: 'hr' }, { n: 'Bucket', q: 1.8, k: 'hr' }], itemParts: [{ n: 'Breaker', q: 1.2, k: 'hr', c: '700', w: 'ROCK', p: '', f: '', t: '' }, { n: 'Bucket', q: 1.8, k: 'hr', c: '', w: 'LOADING', p: 'BKT', f: 'C', t: 'D' }] }));
  assert.deepStrictEqual(ys.map(pick), ['2361.8 ¦ 2363 ¦ 1.2 ¦ Breaker 1.2 ¦ 700 ¦ ROCK', '2363 ¦ 2364.8 ¦ 1.8 ¦ Bucket 1.8 ¦  ¦ LOADING']);
  assert.deepStrictEqual([ys[1].chFrom, ys[1].chTo, ys[1]._prt, ys[0].chFrom], ['C', 'D', 'BKT', '']);
  // the hours of the rows are the hours of the entry – nothing is added or lost
  assert.strictEqual(Math.round(ys.reduce((a, y) => a + y.whr, 0) * 100) / 100, 3);
  // trips shared between two per-trip items: a row each, no readings to share
  const tr = lbWorkRows({ mode: 'Trip', unit: 'Trip', trip: 7, ohr: '', chr: '', whr: '', okm: '', ckm: '', wkm: '', boqItems: [{ name: 'Murum', basis: 'Per Trip', qty: 'typed' }, { name: 'Sand', basis: 'Per Trip', qty: 'rest' }], itemQty: [{ n: 'Murum', q: 3, k: 'trip' }, { n: 'Sand', q: 4, k: 'trip' }], work: 'CARTING' });
  assert.deepStrictEqual(tr.map(y => y.trip + ' ' + y.itemQty[0].n), ['3 Murum', '4 Sand']);
});

test('the diesel rate typed by hand: the bill is worked out at it on the page and on the server alike; empty = the automatic rate (hand-worked)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'R69-EX', name: 'Excavator', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 10, owner: 'R69 Rate Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-03-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'R69 Rate Vendor', gstReg: 'No', pan: 'ABCDE1269Q', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R69 Rate Vendor', from: '2026-03-01', tdsPct: 0, woNo: 'WO-R', lines: [{ no: 'R69-EX', basis: 'Per Hour', rate: 1000, diesel: 'Debit Basis' }] }, 'add');
  run('x => saveInward_(x)', { date: '2026-03-01', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 90, billNo: 'R69A', billDate: '2026-03-01' });
  run('x => saveInward_(x)', { date: '2026-03-10', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 94, billNo: 'R69B', billDate: '2026-03-10' });
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-03-05', shift: 'Full Day', no: 'R69-EX', mode: 'Hrs', openingHr: 100, closingHr: 108 }, { date: '2026-03-06', shift: 'Full Day', no: 'R69-EX', mode: 'Hrs', closingHr: 115 }] });
  run('x => saveDieselIssue_(x)', { date: '2026-03-05', shift: 'Day', source: 'Dispenser', no: 'R69-EX', qty: 50, hrReading: 101, force: true });
  const from = '2026-03-01', to = '2026-03-31';
  const list = run('(f, t) => getLogBookList_({ from: f, to: t, no: "R69-EX", all: true }).rows', from, to), extra = run('(f, t) => logPrintExtra_({ from: f, to: t, nos: ["R69-EX"] })', from, to);
  // automatic: the higher of the average of the period and the last purchase (94 – bought on the 10th; the average is below it)
  assert.ok(extra.lastRate === 94 && extra.avgRate > 0 && extra.avgRate < 94, JSON.stringify([extra.avgRate, extra.lastRate]));
  const srv = x => run('(l, e, f, t) => billMachineCalc_(findMachine_("R69-EX"), l, e, f, t, undefined, true)', list, x, from, to);
  let c = srv(extra);
  assert.deepStrictEqual([c.debitQty, c.dieselRate, c.autoRate, c.rateManual, c.excessAmt, c.amount], [50, 94, 94, false, 4700, 15000]);
  // typed by hand: 95.50 → 50 L × 95.50 = 4,775; the work amount is not touched
  c = srv(Object.assign({}, extra, { manualRate: 95.5 }));
  assert.deepStrictEqual([c.debitQty, c.dieselRate, c.autoRate, c.rateManual, c.excessAmt, c.amount], [50, 95.5, 94, true, 4775, 15000]);
  assert.strictEqual(srv(Object.assign({}, extra, { manualRate: 0 })).excessAmt, 4700, '0 / empty = automatic');
  assert.strictEqual(srv(Object.assign({}, extra, { manualRate: 'abc' })).excessAmt, 4700);
  // the page works out the same, with and without the typed rate
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const grab = m => { const i = app.indexOf(m); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const dayPartSrc = (app.match(/const dayPart = (r => [^\n]+?);\n/) || [])[1];
  const env = { dayPart: new Function('return ' + dayPartSrc)(), r2: n => Math.round(n * 100) / 100, hasKm: u => u === 'KM' || u === 'KM + Hrs', hasHr: u => u === 'Hrs' || u === 'KM + Hrs', isHol: r => ['Holiday', 'Breakdown'].indexOf(r.mode || r.unit) > -1,
    showDate: d => d.split('-').reverse().join('/'), fmt: String, DAY_STATUS: ['Idle', 'Holiday', 'Breakdown'], METER_OFF: 'No reading', isoDate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), ITEM_WORD: { hr: 'hr', km: 'km', trip: 'trips' }, dieselDebitDay: (vt, bd, m) => bd ? bd.diesel === 'Debit Basis' : !!(m && m.supply === 'Debit Basis'), findMachine: no => T.getMaster_().find(m => m.id === no) };
  const C = new Function(...Object.keys(env), grab('function itemDaySegs(') + '\n' + grab('function tankLeft(') + '\n' + grab('function mbMachine(') + '; return { mbMachine };')(...Object.values(env));
  for (const x of [extra, Object.assign({}, extra, { manualRate: 95.5 }), Object.assign({}, extra, { manualRate: 88 })]) {
    const pg = C.mbMachine('R69-EX', list, x, from, to, undefined, true), sv = srv(x);
    assert.deepStrictEqual([pg.dieselRate, pg.autoRate, pg.rateManual, pg.excessAmt, pg.amount], [sv.dieselRate, sv.autoRate, sv.rateManual, sv.excessAmt, sv.amount], 'page = server at manualRate ' + x.manualRate);
  }
  // Verify (the server builds the bill again): the rate travels with the bill
  const co = run('() => billCompanies_()')[0];
  const mk = (rate, B) => ({ company: co, vendor: { name: 'R69 Rate Vendor' }, from: from, to: to, billDate: '2026-04-02', billNo: '1', picked: ['R69-EX'], partial: false, edited: false, idlePaid: true, dieselRate: rate,
    machines: [{ no: 'R69-EX', workDays: 2, nights: 0, issued: 50, amount: 15000, excessAmt: B, lines: [] }], A: 15000, B: B, C: 0, D: 15000 - B, E: 0, F: 0, G: 15000 - B, H: 0, I: 15000 - B, gstPct: 0, tdsPct: 0 });
  const said = b => JSON.stringify(run('b => verifyBills_({ bills: [b] })', b));
  const okBill = run('b => verifyBills_({ bills: [b] })', mk(95.5, 4775));
  assert.ok(okBill.ok, 'the bill at 95.50 verifies: ' + JSON.stringify(okBill).slice(0, 600));
  assert.match(JSON.stringify(okBill), /Diesel is debited at ₹95\.5 per litre – typed by hand in this bill \(automatic rate of the period: ₹94\)/);
  assert.ok(run('b => verifyBills_({ bills: [b] })', mk('', 4700)).ok, 'the automatic bill verifies as before');
  assert.match(said(mk('', 4775)), /diesel deduction ₹4700 \(bill: ₹4775\)/, 'an amount made at another rate without saying so is refused');
  assert.match(said(mk(95.5, 4700)), /diesel deduction ₹4775 \(bill: ₹4700\)/);
  assert.match(said(mk(-2, 4775)), /is not a proper rate/);
  assert.match(said(mk(5000, 4775)), /is not a proper rate/);
});

// update-70 (10-10-2026): a machinery whose entries were made by clock Time and whose Log Book format was LATER set to one read from
// the hour meter (E). Edit Log Book sends each entry back in the way it was saved – the server must take that for an entry that
// already has it (before: "does not work on Time"), and still refuse that way for a NEW entry (the format decides new entries).
test('Edit Log Book: a saved entry keeps the way it was saved in after the Log Book format is changed; a new entry follows the format', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'T70-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs', 'Time'], hrStd: 4, owner: 'T70 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-06-28', shift: 'Day', no: 'T70-JCB', mode: 'Time', tStart: '09:00', tEnd: '16:30', tSlots: [['09:00', '13:00'], ['14:00', '16:30']], work: 'CLEANING' }] });
  run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-06-29', shift: 'Day', no: 'T70-JCB', mode: 'Time', tStart: '11:00', tEnd: '13:00', work: 'SHIFTING' }] });
  run('x => saveLbFormats_(x)', { 'T70-JCB': 'E' });
  const from = '2026-06-01', to = '2026-06-30';
  const grid = () => run('(f, t) => getLogEditData_("T70-JCB", f, t)', from, to);
  const g = grid();
  assert.deepStrictEqual([g.machine.modes, g.machine.modesX], [['Hrs', 'Time'], ['Time']], 'format E: new entries are read from the hour meter – and Time for a day the meter gave no reading (update-76)');
  assert.deepStrictEqual(g.rows.map(r => [r.date, r.mode, r.tHrs].join(' ')), ['2026-06-28 Time 6.5', '2026-06-29 Time 2'], 'the entries are still what was saved');
  const send = (edit, extra) => run('p => { try { return saveLogBulk_(p); } catch (e) { return { thrown: String(e.message) }; } }', { no: 'T70-JCB', from: from, to: to, deleted: [], openingDiesel: '',
    rows: grid().rows.map(r => Object.assign({ key: r.key, same: false, half: false, date: r.date, shift: r.shift, mode: r.mode, openingHr: '', closingHr: '', openingKm: '', closingKm: '', tStart: r.tStart, tEnd: r.tEnd, tBreak: r.tBrk, remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: r.work, odSet: '' }, edit(r))).concat(extra || []) });
  const stored = () => run(`() => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(x => str_(x[c[H.NO]]) === 'T70-JCB').map(x => [dkey_(x[c[H.DATE]]), str_(x[c[H.UNIT]]), num0_(x[c[H.THRS]]), str_(x[c[H.WORK]])].join(' ')).sort(); }`);
  // a description corrected, and the To time of the 29th: saved in the way they were saved in
  let r = send(x => x.date === '2026-06-28' ? { work: 'CLEANING WORK' } : { tEnd: '14:00' });
  assert.ok(r.ok && r.changed === 2, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(stored(), ['2026-06-28 Time 6.5 CLEANING WORK', '2026-06-29 Time 3 SHIFTING']);
  // (update-76, asked 11-10-2026: an hours machinery whose hour meter gave no reading may have a day on TIME – so a NEW Time entry is
  //  accepted now for this machinery on an hours format; until update-75 it was refused.) A way it does not have (KM) is still refused.
  // a saved entry cannot be moved to a way the machinery does not have
  r = send(x => x.date === '2026-06-29' ? { mode: 'KM', openingKm: 10, closingKm: 20 } : { same: true });
  assert.ok(r.ok === false && /does not work on "KM"/.test((r.errors || []).map(e => e.msg).join(' ') + (r.thrown || '')), JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(stored(), ['2026-06-28 Time 6.5 CLEANING WORK', '2026-06-29 Time 3 SHIFTING']);
  // … but it can be moved to the way of the format (Hrs), with readings
  r = send(x => x.date === '2026-06-29' ? { mode: 'Hrs', openingHr: 100, closingHr: 103, tStart: '', tEnd: '', tBreak: '' } : { same: true });
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(stored().map(x => x.split(' ').slice(0, 2).join(' ')), ['2026-06-28 Time', '2026-06-29 Hrs']);
});

// update-71 (10-10-2026): "in Edit Log Book this can be entered, but filling the Log Book gives an error – use the same logic".
// Rows of ONE machinery on the same date and shift in one save of the entry page: the works of that shift, one after the other.
// The server joins them into ONE entry that keeps its rows – exactly what Edit Log Book saves. Hand-worked.
test('Log Book entry: rows of one machinery on the same date and shift are joined into ONE entry that keeps its rows (same rule as Edit Log Book)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'E71-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 4, owner: 'E71 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'E71-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'E71 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'E71 Earthmovers', gstReg: 'No', pan: 'ABCDE1271E', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'E71 Earthmovers', from: '2026-06-01', tdsPct: 2, woNo: 'WO-E71', lines: [{ no: 'E71-JCB', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }] }, { no: 'E71-TIP', basis: 'Per KM', rate: 40, diesel: 'Company' }] }, 'add');
  const save = rows => run('x => { try { return saveLogRowsInner_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: rows });
  const stored = no => run(`no => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(x => str_(x[c[H.NO]]) === no).map(x => ({ d: dkey_(x[c[H.DATE]]), sh: str_(x[c[H.SHIFT]]), ohr: num0_(x[c[H.OHR]]), chr: num0_(x[c[H.CHR]]), whr: num0_(x[c[H.WHR]]), items: str_(x[c[H.ITEMS]]), work: str_(x[c[H.WORK]]), challan: H.CHALLAN in c ? str_(x[c[H.CHALLAN]]) : '' })).sort((a, b) => a.d < b.d ? -1 : 1); }`, no);
  const J = (d, o) => Object.assign({ date: d, shift: 'Day', no: 'E71-JCB', mode: 'Hrs' }, o);
  // the screen he sent: the first entry of the machinery – Bucket 1 → 2, then Breaker 2 → 4 (the page sends the items as its boxes hold them: {} = Bucket, the "rest" item; { Breaker: hours } = Breaker)
  let r = save([J('2026-06-01', { openingHr: 1, closingHr: 2, items: {}, work: 'LOADING', challan: '11' }), J('2026-06-01', { openingHr: 2, closingHr: 4, items: { Breaker: 2 }, work: 'ROCK BREAKING', challan: '12' })]);
  assert.ok(r.ok && r.count === 1 && r.joined === 2, JSON.stringify(r).slice(0, 300));
  let s = stored('E71-JCB');
  assert.strictEqual(s.length, 1, 'ONE entry');
  assert.deepStrictEqual([s[0].ohr, s[0].chr, s[0].whr], [1, 4, 3]);
  assert.deepStrictEqual(JSON.parse(s[0].items), { Breaker: 2, _parts: [{ n: 'Bucket', q: 1, c: '11', w: 'LOADING' }, { n: 'Breaker', q: 2, c: '12', w: 'ROCK BREAKING' }] });
  assert.strictEqual(s[0].work, 'LOADING / ROCK BREAKING'); assert.strictEqual(s[0].challan, '11 / 12');
  // Edit Log Book reads it back as two rows; the bill is each work at its own rate: Bucket 1 × 1,200 + Breaker 2 × 1,500 = 4,200
  const g = run('() => getLogEditData_("E71-JCB", "2026-06-01", "2026-06-30")');
  assert.deepStrictEqual(g.rows[0].itemParts.map(x => [x.n, x.q].join(' ')), ['Bucket 1', 'Breaker 2']);
  const amount = () => run('(f, t) => billMachineCalc_(findMachine_("E71-JCB"), getLogBookList_({ from: f, to: t, no: "E71-JCB", all: true }).rows, logPrintExtra_({ from: f, to: t, nos: ["E71-JCB"] }), f, t, undefined, true).amount', '2026-06-01', '2026-06-30');
  assert.strictEqual(amount(), 1 * 1200 + 2 * 1500);
  // the next day in the same save as another machinery; the Start of a later row left empty = the Close above; three works (Bucket – Breaker – Bucket)
  r = save([J('2026-06-02', { closingHr: 5, items: {} }), { date: '2026-06-02', shift: 'Day', no: 'E71-TIP', mode: 'KM', openingKm: 100, closingKm: 160 }, J('2026-06-02', { closingHr: 5.5, items: { _all: 'Breaker' } }), J('2026-06-02', { openingHr: 5.5, closingHr: 7, items: {} })]);
  assert.ok(r.ok && r.count === 2 && r.joined === 3, JSON.stringify(r).slice(0, 300));
  s = stored('E71-JCB');
  assert.deepStrictEqual([s[1].ohr, s[1].chr, s[1].whr], [4, 7, 3], 'the entry starts at the Close before it (4) and closes on the last row');
  assert.deepStrictEqual(JSON.parse(s[1].items), { Breaker: 0.5, _parts: [{ n: 'Bucket', q: 1 }, { n: 'Breaker', q: 0.5 }, { n: 'Bucket', q: 1.5 }] });
  assert.strictEqual(amount(), (1 + 2.5) * 1200 + (2 + 0.5) * 1500);
  // what is refused – on the row that is wrong, and nothing is saved
  const no = (rows, re, rowNo) => { const x = save(rows); assert.ok(x.ok === false && x.errors.some(e => re.test(e.msg) && (!rowNo || e.row === rowNo)), JSON.stringify(x).slice(0, 400)); assert.strictEqual(stored('E71-JCB').length, 2); };
  // (update-77: a machinery on hours may start a row ABOVE the Close before it – the hours between are not worked – and may do the same
  //  work twice one after the other; a row starting BELOW that Close is still refused)
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { openingHr: 7.5, closingHr: 10, items: { Breaker: 2.5 } })], /row 2 of 03-06-2026 starts at 7\.5, below the Close 8 of the row before it/, 2);
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { closingHr: 10, items: { Breaker: 1 } })], /row 2 of 03-06-2026 – each row of one shift is ONE work: press Bucket \/ Breaker \(not Split\)/, 2);
  no([J('2026-06-03', { closingHr: 9, items: { Breaker: 1 } }), J('2026-06-03', { closingHr: 10, items: {} })], /row 1 of 03-06-2026 – each row of one shift is ONE work/);
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { closingHr: 8, items: { _all: 'Breaker' } })], /row 2 of 03-06-2026 \(Breaker\) has no work/);
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { closingHr: 9, items: { _all: 'Breaker' }, half: true })], /the ½ tick belongs to the first row of the shift/, 2);
  // (update-143, asked 23-10-2026) a shift that is ALREADY saved takes a new entry as its next row: Breaker 7 → 8 after Bucket – Breaker – Bucket
  // (an older app that does not show it – no "add" mark – is refused as before)
  no([J('2026-06-02', { closingHr: 8, items: { _all: 'Breaker' } })], /already saved for 02-06-2026 \(Day\)\. To add another work to this saved shift: Edit Log Book → "\+ work in this shift"/);
  r = save([J('2026-06-02', { closingHr: 8, items: { _all: 'Breaker' }, work: 'SECOND SITE', add: 1 })]);
  assert.ok(r.ok && r.count === 1 && r.added === 1 && r.into === 1, JSON.stringify(r).slice(0, 300));
  s = stored('E71-JCB');
  assert.strictEqual(s.length, 2, 'still ONE entry for 02-06 (Day)');
  assert.deepStrictEqual([s[1].ohr, s[1].chr, s[1].whr], [4, 8, 4]);
  assert.deepStrictEqual(JSON.parse(s[1].items), { Breaker: 1.5, _parts: [{ n: 'Bucket', q: 1 }, { n: 'Breaker', q: 0.5 }, { n: 'Bucket', q: 1.5 }, { n: 'Breaker', q: 1, w: 'SECOND SITE' }] });
  assert.strictEqual(amount(), (1 + 2.5) * 1200 + (2 + 1.5) * 1500);
  // … the same work again is a duplicate (refused, nothing saved); a work before the saved Close is refused
  no([J('2026-06-02', { openingHr: 7, closingHr: 8, items: { _all: 'Breaker' }, add: 1 })], /E71-JCB \(02-06-2026, Day\): this work is already in the saved entry of this shift/, 1);
  no([J('2026-06-02', { openingHr: 6, closingHr: 9, items: { _all: 'Breaker' }, add: 1 })], /starts at 6, below the Close 8 of the row before it/);
  // update-146 (23-10-2026, "sagle machinery la ha rule ghe"): a machinery with ONE kind of work too – the rows of a shift are ONE entry
  // (before: "already saved"); a vehicle's KM follow each other, row 2 starts where row 1 closed
  r = save([{ date: '2026-06-03', shift: 'Day', no: 'E71-TIP', mode: 'KM', closingKm: 200 }, { date: '2026-06-03', shift: 'Day', no: 'E71-TIP', mode: 'KM', closingKm: 240 }]);
  assert.ok(r.ok && r.count === 1 && r.joined === 2, JSON.stringify(r).slice(0, 300));
  assert.strictEqual(stored('E71-TIP').length, 2);
  assert.deepStrictEqual(JSON.parse(stored('E71-TIP')[1].items)._parts.map(x => [x.n, x.k, x.q > 0].join(' ')), [' km true', ' km true']);
  assert.strictEqual(JSON.parse(stored('E71-TIP')[1].items)._parts[1].q, 40);
  // (update-143) … and a work added to the saved 02-06 that would pass the Start of 03-06: refused, nothing changed
  r = save([{ date: '2026-06-02', shift: 'Day', no: 'E71-TIP', mode: 'KM', closingKm: 210, add: 1 }]);
  assert.ok(r.ok === false && /adding a work never changes another entry/.test(r.errors.map(e => e.msg).join(' ')), JSON.stringify(r).slice(0, 300));
  assert.strictEqual(stored('E71-TIP').length, 2);
  // the Excel sheet that is imported: two lines of the machinery on the same date and shift, each with its "Work type" → one entry with two rows too
  const imp = run('x => { try { return importLogBook_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: [
    { line: 2, date: '2026-06-04', shift: 'Day', no: 'E71-JCB', mode: 'Hrs', closingHr: 9, items: { _all: 'Bucket' }, work: 'DRAIN' }, { line: 3, date: '2026-06-04', shift: 'Day', no: 'E71-JCB', mode: 'Hrs', closingHr: 10.5, items: { _all: 'Breaker' }, work: 'ROCK' }] });
  assert.ok(imp && !imp.thrown && imp.ok !== false, JSON.stringify(imp).slice(0, 400));
  s = stored('E71-JCB');
  assert.strictEqual(s.length, 3);
  assert.deepStrictEqual([s[2].d, s[2].ohr, s[2].chr, s[2].whr], ['2026-06-04', 8, 10.5, 2.5]);      // (02-06 now closes at 8 – update-143)
  assert.deepStrictEqual(JSON.parse(s[2].items), { Breaker: 1.5, _parts: [{ n: 'Bucket', q: 1, w: 'DRAIN' }, { n: 'Breaker', q: 1.5, w: 'ROCK' }] });
});

// update-72 (10-10-2026): screen share with voice. The server only carries the short notes that set a call up – through the
// cache store and the heartbeat. Who gets which note, in which order, and what is refused.
test('screen share: a note reaches only the users it is for, through the heartbeat, in order; nothing is lost when a number is not written yet', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const U = n => ({ email: n.toLowerCase() + '@site.test', name: n, active: n !== 'Dormant', admin: n === 'Asha', perms: {}, password: 'scrypt$x' });
  const users = ['Asha', 'Bala', 'Chitra', 'Dev', 'Esha', 'Dormant'].map(U);
  run('l => { const c = CacheService.getScriptCache(); c.put("USERS_LIST", JSON.stringify(l), 600); c.remove("RTCN"); }', users);
  const A = users[0], B = users[1], C = users[2];
  const list = u => run('u => rtcUsers_(u)', u), send = (u, x) => run('(u, x) => { try { return rtcSend_(u, x); } catch (e) { return { thrown: String(e.message) }; } }', u, x), beat = (u, a) => run('(u, a) => rtcBeat_(u, a)', u, a);
  // the list: everybody who can sign in except oneself, by name and a short code – no e-mail address, not the user who is switched off
  const la = list(A), uid = n => (list(n === 'Asha' ? B : A).users.find(x => x.name === n) || {}).uid || (n === 'Asha' ? la.me : '');
  assert.deepStrictEqual(la.users.map(x => x.name), ['Bala', 'Chitra', 'Dev', 'Esha']);
  assert.ok(la.users.every(x => /^[0-9a-f]{16}$/.test(x.uid) && !('email' in x)) && !/@/.test(JSON.stringify(la)), 'no e-mail address leaves the server');
  assert.strictEqual(la.max, 3); assert.ok(la.ice.length && /^stun:/.test(la.ice[0].urls[0]));
  // a page that has just opened reads "from now on"; nothing new → the heartbeat carries nothing
  const r0 = beat(B, {}).r; assert.strictEqual(r0, 0); assert.strictEqual(beat(B, { r: 0 }), null);
  // A rings B and C; D gets nothing; A does not get his own note
  let s = send(A, { t: 'ring', to: [uid('Bala'), uid('Chitra')], call: 'call-1', d: { sdp: 'v=0 offer' } });
  assert.ok(s.ok && s.n === 1, JSON.stringify(s));
  let b = beat(B, { r: 0 });
  assert.deepStrictEqual([b.r, b.top, b.m.length, b.m[0].t, b.m[0].name, b.m[0].call, JSON.parse(b.m[0].d).sdp, b.m[0].from], [1, 1, 1, 'ring', 'Asha', 'call-1', 'v=0 offer', la.me]);
  assert.strictEqual(beat(C, { r: 0 }).m.length, 1);
  assert.deepStrictEqual(beat(users[3], { r: 0 }).m, []); assert.deepStrictEqual(beat(A, { r: 0 }).m, []);
  assert.strictEqual(beat(B, { r: 1 }), null, 'read once: the next heartbeat carries nothing');
  // B answers A (one line in the Activity Log); "who is there?" goes to everybody but the asker
  s = send(B, { t: 'answer', to: la.me, call: 'call-1', d: { sdp: 'v=0 answer' } }); assert.strictEqual(s.n, 2);
  s = send(C, { t: 'who' }); assert.strictEqual(s.n, 3);
  const a2 = beat(A, { r: 1 });
  assert.deepStrictEqual(a2.m.map(m => m.t + ' from ' + m.name), ['answer from Bala', 'who from Chitra']); assert.strictEqual(a2.r, 3);
  assert.deepStrictEqual(beat(C, { r: 1 }).m, [], 'the asker does not get his own question, nor B\'s answer to A');
  // a number that is taken but not written yet (the note is written a moment later): the page is held BEFORE it and loses nothing
  run('() => { const c = CacheService.getScriptCache(); c.put("RTCN", "5", 600); }');      // numbers 4 and 5 are taken …
  run('(me, to) => CacheService.getScriptCache().put("RTCM_5", JSON.stringify({ id: "m5", n: 5, to: [to], from: me, name: "Chitra", t: "cancel", call: "c", d: "", at: Date.now() }), 60)', uid('Chitra'), la.me);      // … 5 is there, 4 not yet
  let a3 = beat(A, { r: 3 });
  assert.deepStrictEqual([a3.r, a3.top, a3.m.length], [3, 5, 0], 'held before the missing number');
  run('(me, to) => CacheService.getScriptCache().put("RTCM_4", JSON.stringify({ id: "m4", n: 4, to: [to], from: me, name: "Bala", t: "bye", call: "c", d: "", at: Date.now() }), 60)', uid('Bala'), la.me);
  a3 = beat(A, { r: 3 });
  assert.deepStrictEqual([a3.r, a3.m.map(m => m.id).join()], [5, 'm4,m5'], 'both, in their order, once the missing one has landed');
  // … and a number that never comes is passed over when the page says it has waited
  run('() => CacheService.getScriptCache().put("RTCN", "7", 600)');
  run('(me, to) => CacheService.getScriptCache().put("RTCM_7", JSON.stringify({ id: "m7", n: 7, to: [to], from: me, name: "Bala", t: "decline", call: "c", d: "", at: Date.now() }), 60)', uid('Bala'), la.me);
  assert.deepStrictEqual([beat(A, { r: 5 }).r, beat(A, { r: 5 }).m.length], [5, 0]);
  const a4 = beat(A, { r: 5, skip: true }); assert.deepStrictEqual([a4.r, a4.m.map(m => m.id).join()], [7, 'm7']);
  // a note that is too old for its kind is not delivered; a counter that started again puts the page back in step
  run('(me, to) => { const c = CacheService.getScriptCache(); c.put("RTCN", "8", 600); c.put("RTCM_8", JSON.stringify({ id: "m8", n: 8, to: [to], from: me, name: "Bala", t: "who", call: "", d: "", at: Date.now() - 60000 }), 60); }', uid('Bala'), '*');
  assert.deepStrictEqual(beat(A, { r: 7 }).m, []);
  assert.deepStrictEqual(beat(A, { r: 500 }), { r: 8, top: 8, m: [] });
  // THE CASE THE REVIEW FOUND: a page that was not looked at for a while (it asks only once a minute). The "who is there?" notes
  // before a ring are long gone from the store – that must NOT hold the ring back: a number is not waited for when a later
  // note is already more than 10 seconds old.
  run('(me, to) => { const c = CacheService.getScriptCache(); c.put("RTCN", "11", 600); c.put("RTCM_11", JSON.stringify({ id: "m11", n: 11, to: [to], from: me, name: "Bala", t: "ring", call: "late", d: "{}", at: Date.now() - 40000 }), 150); }', uid('Bala'), la.me);      // 9 and 10 are gone, the ring (11) is 40 s old
  const a5 = beat(A, { r: 8 });
  assert.deepStrictEqual([a5.r, a5.m.map(m => m.id + ' ' + m.t).join(), a5.m[0].age >= 40000], [11, 'm11 ring', true], 'the ring is given at once, with its age');
  // what is refused
  const no = (u, x, re) => { const r = send(u, x); assert.ok(r.thrown && re.test(r.thrown), JSON.stringify(r)); };
  no(A, { t: 'ring', to: la.me, call: 'c' }, /pick the user to share with/);
  no(A, { t: 'ring', to: [], call: 'c' }, /pick the user to share with/);
  no(A, { t: 'ring', to: ['0000000000000000'], call: 'c' }, /not in the list any more/);
  no(A, { t: 'ring', to: [uid('Bala'), uid('Chitra'), uid('Dev'), uid('Esha')], call: 'c' }, /at most 3 users at a time/);
  no(A, { t: 'takeover', to: uid('Bala') }, /not known to the server/);
  no(A, { t: 'ring', to: uid('Bala'), call: 'c', d: 'x'.repeat(60001) }, /too long to send/);
  no(A, { t: 'ring', to: uid('Bala') }, /not complete/);
  // only inside a call that was really rung: an answer / decline / bye to somebody who never rang is refused (nobody can make another user's page react, or write a "joined" line)
  no(C, { t: 'answer', to: uid('Dev'), call: 'never-rung', d: {} }, /is not there any more/);
  no(users[3], { t: 'answer', to: la.me, call: 'call-1', d: {} }, /is not there any more/);      // Dev was not rung in call-1
  no(users[3], { t: 'bye', to: uid('Bala'), call: 'call-1' }, /is not there any more/);
  assert.strictEqual(run('() => Number(CacheService.getScriptCache().get("RTCN"))'), 11, 'a refused note takes no number');
  assert.ok(send(C, { t: 'decline', to: la.me, call: 'call-1' }).ok, 'Chitra WAS rung in call-1: her decline is taken');
  assert.ok(send(A, { t: 'cancel', to: [uid('Chitra')], call: 'call-1' }).ok, 'and the host may cancel');
  // the end of a call: only a line for the Activity Log, no note to anybody
  const logged = () => run('() => { const sh = SS_().getSheetByName(LOG_SHEET); if (!sh || sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().map(r => r.join(" ¦ ")).filter(x => /Screen Share/.test(x)); }');
  const before = logged().length;
  assert.deepStrictEqual(send(A, { t: 'end', to: [uid('Bala'), uid('Chitra'), uid('Dev')], call: 'call-1', secs: 999999 }), { ok: true });
  const lines = logged();
  assert.strictEqual(lines.length, before + 1, 'one line');
  assert.ok(/Screen share of Asha with Bala ended after 0 min \d+ s/.test(lines[lines.length - 1]), 'only who really answered (Bala – not Chitra who declined, not Dev who was never rung), and not longer than since the ring: ' + lines[lines.length - 1]);
  assert.ok(lines.some(x => /Bala joined the screen share of Asha/.test(x)), 'the line of the answer');
  send(A, { t: 'end', to: [uid('Bala')], call: 'call-1', secs: 5 }); assert.strictEqual(logged().length, before + 1, 'the end of a call is written once');
  send(B, { t: 'end', to: [la.me], call: 'call-1', secs: 5 }); assert.strictEqual(logged().length, before + 1, 'and only by its host');
  assert.strictEqual(run('() => Number(CacheService.getScriptCache().get("RTCN"))'), 13);
});

// update-73 (10-10-2026): the relay (TURN server) of the site. Its address is written in the hosting's settings the way the relay's
// own site shows it; the pages get it as addresses a browser understands, with the name and password – or nothing when it is not set.
test('screen share: the relay set in the hosting is given to the pages (over UDP and TCP); written wrongly or not at all = no relay', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const users = ['Asha', 'Bala'].map(n => ({ email: n.toLowerCase() + '@site.test', name: n, active: true, admin: false, perms: {}, password: 'scrypt$x' }));
  run('l => CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 600)', users);
  const withRelay = r => run('r => { __rtcRelay = r ? (() => r) : (() => null); return rtcRelay_(); }', r);
  // not set: no relay, the list of servers is as before
  assert.strictEqual(withRelay(null), null);
  let u = run('u => rtcUsers_(u)', users[0]);
  assert.deepStrictEqual([u.relay, u.ice.length, /^stun:/.test(u.ice[0].urls[0])], [false, 1, true]);
  // the address as the relay's site shows it: host and port
  assert.deepStrictEqual(withRelay({ url: 'free.expressturn.com:3478', user: 'name1', pass: 'secret1' }), { urls: ['turn:free.expressturn.com:3478?transport=udp', 'turn:free.expressturn.com:3478?transport=tcp'], username: 'name1', credential: 'secret1' });
  u = run('u => rtcUsers_(u)', users[0]);
  assert.deepStrictEqual([u.relay, u.ice.length, u.ice[1].username], [true, 2, 'name1'], 'the pages get it after the address servers');
  // other ways of writing it: "turn:" in front, no port (3478), several with commas, a secure one, one with its own ?transport
  assert.deepStrictEqual(withRelay({ url: 'turn:relay.example.com', user: 'a', pass: 'b' }).urls, ['turn:relay.example.com:3478?transport=udp', 'turn:relay.example.com:3478?transport=tcp']);
  assert.deepStrictEqual(withRelay({ url: ' relay1.example.com:3478 , turns:relay2.example.com:443 ', user: 'a', pass: 'b' }).urls, ['turn:relay1.example.com:3478?transport=udp', 'turn:relay1.example.com:3478?transport=tcp', 'turns:relay2.example.com:443?transport=tcp']);
  assert.deepStrictEqual(withRelay({ url: 'turn:relay.example.com:80?transport=tcp', user: 'a', pass: 'b' }).urls, ['turn:relay.example.com:80?transport=tcp']);
  // half set, or something that is not an address: no relay (the call still works wherever a direct way exists)
  assert.strictEqual(withRelay({ url: 'free.expressturn.com:3478', user: '', pass: 'x' }), null);
  assert.strictEqual(withRelay({ url: 'free.expressturn.com:3478', user: 'x', pass: '' }), null);
  assert.strictEqual(withRelay({ url: 'http://bad address/<script>', user: 'a', pass: 'b' }), null);
  run('() => { __rtcRelay = undefined; }');
});

// update-74 (10-10-2026): "the Admin must be able to understand which version the app runs on". The update number is read from the
// message of the commit the live deployment was made from; the relay is shown by its address only – never its name or password.
test('which version runs (Admin): the update number from the commit message; the relay by address only, never its password', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const ver = (d, r) => run('(d, r) => { __deployInfo = d ? (() => d) : undefined; __rtcRelay = r ? (() => r) : (() => null); return appVersion_(); }', d, r);
  let v = ver({ sha: '8cb92cd0123456789abcdef', msg: 'update-73: screen share through a relay when the networks need it\n\nCo-Authored-By: someone', env: 'production' }, null);
  assert.deepStrictEqual([v.update, v.msg, v.sha, v.env, v.relay], ['update-73', 'update-73: screen share through a relay when the networks need it', '8cb92cd', 'production', []]);
  assert.strictEqual(typeof v.build, 'string');
  // other ways a commit may be written; one without a number; nothing given (the rig, or a hosting that does not give it)
  assert.strictEqual(ver({ sha: 'a', msg: 'Update-74B – version for the Admin', env: '' }, null).update, 'update-74b');
  assert.deepStrictEqual([ver({ sha: 'abc1234', msg: 'fix a typo', env: '' }, null).update, ver({ sha: 'abc1234', msg: 'fix a typo', env: '' }, null).msg], ['', 'fix a typo']);
  v = ver(null, null); assert.deepStrictEqual([v.update, v.msg, v.sha], ['', '', '']);
  // the relay: its address (once, though it is offered over UDP and TCP) – the name and password are not in the answer at all
  v = ver({ sha: '', msg: '', env: '' }, { url: 'free.expressturn.com:3478', user: 'name-xyz', pass: 'pass-xyz-123' });
  assert.deepStrictEqual(v.relay, ['free.expressturn.com:3478']);
  assert.ok(!/name-xyz|pass-xyz-123/.test(JSON.stringify(v)), 'no name / password in what the Admin page gets');
  run('() => { __deployInfo = undefined; __rtcRelay = undefined; }');
});

// update-75 (10-10-2026): "build all of it at once, perfectly, with security in mind" – the server's part of the screen share's
// master level: who may use it, a ring that waits for a page that opens now, missed calls, a reply, WhatsApp only for a user just
// rung, notifications (only to push services, a device moves to the user who signed in on it, gone devices are forgotten), and
// a dropped line made again only between a host and his guest.
test('screen share master level (server): rights, a waiting ring, missed calls, replies, WhatsApp, notifications, reconnect', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run(`() => { this.__keep75 = { kvRead_, kvWrite_, prefsRead_, writeLog_ }; this.KV75 = {}; this.LOG75 = []; this.PUSH75 = []; this.PUSHANS75 = null;
    kvRead_ = id => KV75[id] || ''; kvWrite_ = (id, v) => { KV75[id] = String(v); };
    prefsRead_ = email => ({ mobile: /^bala/.test(email) ? '9876543210' : '' });
    writeLog_ = (u, a, m, r, s) => { LOG75.push(m + ': ' + s); };
    __pushKey = () => 'BPUBLICKEY'; __pushOk = url => /^https:\\/\\/fcm\\.googleapis\\.com\\//.test(String(url));
    __pushSend = (subs, text) => { const l = JSON.parse(subs); PUSH75.push({ to: l.map(s => s.e), msg: JSON.parse(text) }); return JSON.stringify(PUSHANS75 ? PUSHANS75(l) : l.map(() => ({ code: 201 }))); }; }`);
  const U = (n, admin) => ({ email: n.toLowerCase() + '75@site.test', name: n, active: true, admin: !!admin, perms: {}, password: 'scrypt$x' });      // (own addresses: nothing left by the test before can match)
  const A = U('Asha', true), B = U('Bala'), C = U('Chitra'), D = U('Dev');
  run('l => { const c = CacheService.getScriptCache(); c.put("USERS_LIST", JSON.stringify(l), 600); c.remove("RTCN"); c.remove("RTC_OFF_C"); }', [A, B, C, D]);
  const send = (u, x) => run('(u, x) => { try { return rtcSend_(u, x); } catch (e) { return { thrown: String(e.message) }; } }', u, x);
  const api = (f, u, x) => run('(f, u, x) => { try { return this[f](u, x); } catch (e) { return { thrown: String(e.message) }; } }', f, u, x);
  const beat = (u, a) => run('(u, a) => rtcBeat_(u, a)', u, a), id = u => run('e => rtcUid_(e)', u.email);
  const age = (key, ms) => run('(k, ms) => { const c = CacheService.getScriptCache(), v = c.get(k); if (!v) return; const j = JSON.parse(v); if (Array.isArray(j)) j.forEach(x => { x.at -= ms; }); else j.at -= ms; c.put(k, JSON.stringify(j)); }', key, ms);

  // --- WHO MAY USE IT: the Admin switches it off for Dev; an Admin can never be switched off
  let r = run('(x, u) => rtcRightsSave_(x, u)', { off: [id(D), id(A), 'not-a-user'] }, A);
  assert.deepStrictEqual(r.users.map(x => x.name + ':' + x.on), ['Asha:true', 'Bala:true', 'Chitra:true', 'Dev:false']);
  assert.ok(LOGS().some(l => /Users: Screen share switched off for Dev/.test(l)), 'the change is in the Activity Log');
  function LOGS() { return run('() => LOG75'); }
  assert.strictEqual(api('rtcUsers_', D).off, true, 'Dev is told it is off for him');
  assert.ok(!api('rtcUsers_', B).users.some(x => x.name === 'Dev'), 'nobody can pick Dev');
  assert.ok(api('rtcUsers_', B).users.some(x => x.name === 'Asha' && x.admin === true), 'the list says who is Admin (for "show this to the Admin")');
  assert.match(send(D, { t: 'ring', to: [id(B)], call: 'k0', d: {} }).thrown, /switched off for you/);
  assert.match(send(B, { t: 'ring', to: [id(D)], call: 'k0', d: {} }).thrown, /may not use screen share/);
  assert.ok(send(D, { t: 'here', to: [id(B)] }).ok, 'a page of Dev may still answer "here" quietly');

  // --- NOTIFICATIONS: only a push service is accepted; keys are checked; a device moves to the user who signed in on it
  const K = 'B' + 'x'.repeat(86), Au = 'y'.repeat(22);
  assert.match(api('rtcPushSave_', B, { endpoint: 'https://evil.example.com/x', p256dh: K, auth: Au }).thrown, /not a known push service/);
  assert.match(api('rtcPushSave_', B, { endpoint: 'https://fcm.googleapis.com/fcm/send/b1', p256dh: 'short', auth: Au }).thrown, /keys are not valid/);
  assert.deepStrictEqual(api('rtcPushSave_', B, { endpoint: 'https://fcm.googleapis.com/fcm/send/b1', p256dh: K, auth: Au }), { ok: true, devices: 1 });
  api('rtcPushSave_', B, { endpoint: 'https://fcm.googleapis.com/fcm/send/shared', p256dh: K, auth: Au });
  api('rtcPushSave_', C, { endpoint: 'https://fcm.googleapis.com/fcm/send/shared', p256dh: K, auth: Au });      // Chitra signs in on Bala's second device
  assert.deepStrictEqual(run('id => rtcSubs_(id).map(s => s.e)', id(B)), ['https://fcm.googleapis.com/fcm/send/b1'], 'the shared device is not Bala\'s any more');
  assert.deepStrictEqual(run('id => rtcSubs_(id).map(s => s.e)', id(C)), ['https://fcm.googleapis.com/fcm/send/shared']);
  assert.strictEqual(api('rtcPushKey_').key, 'BPUBLICKEY');

  // --- A RING: on the list of calls of the one rung, a notification to his devices, and waiting for a page that opens now
  let s = send(A, { t: 'ring', to: [id(B)], call: 'k1', d: { sdp: 'v=0', mode: 'cam', help: { title: 'Log Book', msg: 'Start reading is less than the previous Close' } } });
  assert.ok(s.ok, JSON.stringify(s));
  let p = run('() => PUSH75');
  assert.deepStrictEqual([p.length, p[0].to, p[0].msg.t, p[0].msg.name, p[0].msg.call, p[0].msg.help, p[0].msg.page], [1, ['https://fcm.googleapis.com/fcm/send/b1'], 'ring', 'Asha', 'k1', 1, 'Log Book']);
  assert.ok(!/Start reading/.test(JSON.stringify(p[0].msg)), 'the error text itself does not go through the push service – only in the app');
  let fresh = beat(B, {});      // Bala opens the app (from the notification): the ring is there although it was sent before
  assert.deepStrictEqual([fresh.m.length, fresh.m[0] && fresh.m[0].t, fresh.m[0] && fresh.m[0].call], [1, 'ring', 'k1']);
  assert.deepStrictEqual(beat(C, {}).m, [], 'not for anybody else');
  // not missed while it still rings; answered = not missed and not waiting any more
  assert.deepStrictEqual(api('rtcMissed_', B).list, []);
  assert.ok(send(B, { t: 'answer', to: id(A), call: 'k1', d: { sdp: 'a' } }).ok);
  assert.deepStrictEqual(beat(B, {}).m, [], 'answered: a page that opens now does not ring again');
  age('RTCMISS|' + id(B), 0); run('id => { const o = JSON.parse(KV75["RTCMISS|" + id]); o.list.forEach(m => { m.at -= 120000; }); KV75["RTCMISS|" + id] = JSON.stringify(o); }', id(B));
  assert.deepStrictEqual(api('rtcMissed_', B).list, [], 'an answered call is never "missed"');

  // --- NOT ANSWERED: the host gives up → "missed" notification, one line in the Activity Log, on the missed list; once
  run('() => { PUSH75.length = 0; }');
  send(A, { t: 'ring', to: [id(B), id(C)], call: 'k2', d: { sdp: 'v=0' } });
  assert.ok(send(C, { t: 'decline', to: id(A), call: 'k2', d: { reply: 2 } }).ok);
  assert.ok(LOGS().some(l => /Chitra declined the screen share of Asha \(reply: I am in a meeting – later, please\.\)/.test(l)), 'the decline and its reply are in the Activity Log');
  send(A, { t: 'cancel', to: [id(B), id(C)], call: 'k2', d: {} });
  send(A, { t: 'cancel', to: [id(B)], call: 'k2', d: {} });      // (said twice: still one line, one notification)
  p = run('() => PUSH75').filter(x => x.msg.t === 'missed');
  assert.deepStrictEqual([p.length, p[0].to, p[0].msg.name], [1, ['https://fcm.googleapis.com/fcm/send/b1'], 'Asha'], 'only Bala (Chitra declined), only once');
  assert.strictEqual(LOGS().filter(l => /Bala did not answer the screen share of Asha/.test(l)).length, 1);
  assert.deepStrictEqual(beat(B, {}).m, [], 'given up: a page that opens now does not ring');
  let mi = api('rtcMissed_', B);      // (at once – the caller gave up, it does not wait for the ring's 80 s)
  assert.deepStrictEqual([mi.list.length, mi.list[0].name, mi.list[0].call, mi.list[0].can, mi.unseen], [1, 'Asha', 'k2', true, 1]);
  assert.strictEqual(api('rtcMissed_', B, { seen: true }).unseen, 0, 'seen: the red number goes');
  assert.deepStrictEqual(api('rtcMissed_', B, { clear: true }).list, [], 'cleared');
  // the busy-softly cancel (why: declined) and a cancel because another device answered (butdev) are not "missed"
  run('() => { PUSH75.length = 0; }');
  send(A, { t: 'ring', to: [id(C)], call: 'k3', d: {} }); send(A, { t: 'cancel', to: [id(C)], call: 'k3', d: { why: 'declined' } });
  assert.strictEqual(run('() => PUSH75').filter(x => x.msg.t === 'missed').length, 0);

  // --- WHATSAPP: only for a user this user has just rung; the number only when that user set one
  assert.match(api('rtcWa_', B, { uid: id(C), call: 'k2' }).thrown, /a user you have just rung/, 'Bala did not ring Chitra');
  assert.match(api('rtcWa_', A, { uid: id(B), call: 'nope' }).thrown, /a user you have just rung/);
  assert.deepStrictEqual(api('rtcWa_', A, { uid: id(B), call: 'k2' }), { mobile: '919876543210', name: 'Bala' });
  assert.match(api('rtcWa_', A, { uid: id(C), call: 'k2' }).thrown, /a user you have just rung/, 'Chitra declined: no WhatsApp');
  send(A, { t: 'ring', to: [id(C)], call: 'k2b', d: {} });
  assert.deepStrictEqual(api('rtcWa_', A, { uid: id(C), call: 'k2b' }), { none: true, name: 'Chitra' }, 'Chitra has no number');

  // --- A GONE DEVICE (the push service says 410) is forgotten
  run('() => { PUSHANS75 = l => l.map(s => ({ code: /b1$/.test(s.e) ? 410 : 201 })); }');
  run('k => CacheService.getScriptCache().remove(k)', 'RTCPU_' + id(A) + '_' + id(B));      // (20 s later: a ring may notify again)
  send(A, { t: 'ring', to: [id(B)], call: 'k4', d: {} });
  assert.deepStrictEqual(run('id => rtcSubs_(id).length', id(B)), 0);
  run('() => { PUSHANS75 = null; }');

  // --- A DROPPED LINE MADE AGAIN: "re" only between the host and his guest, both ways; nobody else
  send(A, { t: 'ring', to: [id(B)], call: 'k5', d: {} }); send(B, { t: 'answer', to: id(A), call: 'k5', d: { sdp: 'a' } });
  assert.ok(send(A, { t: 're', to: [id(B)], call: 'k5', d: { type: 'offer', sdp: 'x' } }).ok, 'host → guest');
  assert.ok(send(B, { t: 're', to: id(A), call: 'k5', d: { type: 'answer', sdp: 'y' } }).ok, 'guest → host');
  assert.match(send(C, { t: 're', to: id(B), call: 'k5', d: {} }).thrown, /not there any more/, 'somebody not in the call');
  assert.match(send(C, { t: 're', to: id(A), call: 'k5', d: {} }).thrown, /not there any more/);


  // --- FROM THE INDEPENDENT REVIEW: abuse limits and edge cases
  // answered on one device → his OTHER devices are told ("done"), not the one that answered
  api('rtcPushSave_', B, { endpoint: 'https://fcm.googleapis.com/fcm/send/b2', p256dh: K, auth: Au }); api('rtcPushSave_', B, { endpoint: 'https://fcm.googleapis.com/fcm/send/b3', p256dh: K, auth: Au });
  run('() => { PUSH75.length = 0; }');
  send(A, { t: 'ring', to: [id(B)], call: 'k6', d: {} }); send(B, { t: 'answer', to: id(A), call: 'k6', d: { sdp: 'a', ep: 'https://fcm.googleapis.com/fcm/send/b2' } });
  p = run('() => PUSH75').filter(x => x.msg.t === 'done');
  assert.deepStrictEqual([p.length, p[0] && p[0].to, p[0] && p[0].msg.name], [1, ['https://fcm.googleapis.com/fcm/send/b3'], 'Asha']);
  // a second ring to the same person within 20 s: no second notification (a loop cannot flood his phone)
  run('() => { PUSH75.length = 0; }'); send(A, { t: 'ring', to: [id(B)], call: 'k7', d: {} });
  assert.strictEqual(run('() => PUSH75').filter(x => x.msg.t === 'ring').length, 0);
  // WhatsApp: not once the call was answered; not after 3 minutes
  assert.match(api('rtcWa_', A, { uid: id(B), call: 'k6' }).thrown, /a user you have just rung/, 'answered: no number');
  run('(k) => { const c = CacheService.getScriptCache(), v = c.get(k).split("|"); c.put(k, v[0] + "|" + (Number(v[1]) - 200000)); }', 'RTCC_k7_' + id(B));
  assert.match(api('rtcWa_', A, { uid: id(B), call: 'k7' }).thrown, /a user you have just rung/, 'more than 3 minutes after the ring: no number');
  // at most 8 NEW calls a minute from one user
  const many = []; for (let i = 0; i < 12; i++) many.push(send(C, { t: 'ring', to: [id(A)], call: 'flood' + i, d: {} }));
  assert.ok(many.slice(0, 5).every(x => x.ok) && /too many calls started/.test((many.find(x => x.thrown) || {}).thrown || ''), JSON.stringify(many.map(x => x.ok ? 'ok' : x.thrown.slice(0, 30))));
  // the same call rung again (a second guest added) is not a new call
  // a user switched off DURING a ring: the host can still cancel it and end his call
  run('(x, u) => rtcRightsSave_(x, u)', { off: [id(D)] }, A); run('(x, u) => rtcRightsSave_(x, u)', { off: [] }, A);      // (back on)
  send(B, { t: 'ring', to: [id(D)], call: 'k8', d: {} });
  run('(x, u) => rtcRightsSave_(x, u)', { off: [id(D)] }, A);
  assert.ok(send(B, { t: 'cancel', to: [id(D)], call: 'k8', d: {} }).ok, 'cancel to a user switched off meanwhile');
  // a user who is not active keeps "switched off" when the Admin saves again
  run('l => CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 600)', [A, B, C, Object.assign({}, D, { active: false })]);
  r = run('(x, u) => rtcRightsSave_(x, u)', { off: [] }, A);
  assert.ok(run('() => JSON.parse(KV75.RTC_OFF)').indexOf(id(D)) > -1, 'Dev (not active) is still switched off');
  // switched off: the list gives no relay keys
  run('l => CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 600)', [A, B, C, D]); run('() => CacheService.getScriptCache().remove("RTC_OFF_C")');
  const offList = api('rtcUsers_', D); assert.deepStrictEqual([offList.off, offList.ice.length, offList.relay], [true, 0, false]);

  run('() => { kvRead_ = __keep75.kvRead_; kvWrite_ = __keep75.kvWrite_; prefsRead_ = __keep75.prefsRead_; writeLog_ = __keep75.writeLog_; __pushKey = undefined; __pushOk = undefined; __pushSend = undefined; const c = CacheService.getScriptCache(); ["USERS_LIST", "RTC_OFF_C"].forEach(k => c.remove(k)); }');
});

// update-76 (11-10-2026): "the JCB / excavators set on hours sometimes give no hour reading – they give the timing instead, so one
// machine has Hrs and Time in one month; entering it is a problem – fix it with logic". One rule everywhere: a machinery measured by
// hours may have a day on Time. Hand-worked: 30th 95→100, 1st 100→105, 2nd Time 09:00–13:00 (4 h), 3rd 105→110, 4th Time 10:00–12:30.
test('an hours machinery (format D) may have a day on Time: saved, Hrs stays its usual way, next Start, summaries, edit window, delete, Edit Log Book', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  run('(x, m) => saveMaster_(x, m)', { no: 'T76-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'T76 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('x => saveLbFormats_(x)', { 'T76-JCB': 'D' });
  const m = run('() => findMachine_("T76-JCB")');
  assert.deepStrictEqual([m.lbFormat, m.modes, m.modesX], ['D', ['Hrs', 'Time'], ['Time']], 'format D: Hrs, and Time for a day without a reading');
  const save0 = row => tryRun('x => saveLogRowsInner_(x)', { rows: [Object.assign({ no: 'T76-JCB', shift: 'Full Day', work: 'EXCAVATION' }, row)] });
  const save = row => { const x = save0(row); return x && (x.thrown || x.ok === false) ? { thrown: x.thrown || (x.errors || []).map(e => e.msg).join(' ') } : x; };      // (a refusal comes back as errors – the same as a throw here)
  assert.ok(!save({ date: '2026-06-30', mode: 'Hrs', openingHr: 95, closingHr: 100 }).thrown);
  assert.ok(!save({ date: '2026-07-01', mode: 'Hrs', openingHr: 100, closingHr: 105 }).thrown);
  const t2 = save({ date: '2026-07-02', mode: 'Time', tStart: '09:00', tEnd: '13:00' });
  assert.ok(!t2.thrown, 'a Time day is accepted for the hours machinery: ' + JSON.stringify(t2).slice(0, 200));
  assert.match(save({ date: '2026-07-02', shift: 'Night', mode: 'KM', openingKm: 1, closingKm: 2 }).thrown || '', /does not work on "KM"/, 'a way it really does not have is still refused');
  // the next day: Start = the last hour reading (105, from the 1st – the Time day has none); the usual way stays Hrs
  const pf = run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'T76-JCB', '2026-07-03', 'Full Day');
  assert.deepStrictEqual([pf.openingHr, pf.lastMode], [105, ''], JSON.stringify(pf).slice(0, 200));
  assert.ok(!save({ date: '2026-07-03', mode: 'Hrs', openingHr: 105, closingHr: 110 }).thrown);
  assert.match(save({ date: '2026-07-05', mode: 'Hrs', openingHr: 104, closingHr: 108 }).thrown || '', /less than/, 'a Start below the last Close (110) is still refused, past the Time day');
  assert.ok(!save({ date: '2026-07-04', mode: 'Time', tStart: '10:00', tEnd: '12:30' }).thrown);
  const rows = run('f => getLogBookList_(f)', { from: '2026-07-01', to: '2026-07-04', no: 'T76-JCB', all: true });
  assert.deepStrictEqual(rows.rows.map(r => r.date.slice(8) + ' ' + r.mode + ' ' + r.whr).sort(), ['01 Hrs 5', '02 Time 4', '03 Hrs 5', '04 Time 2.5']);
  // the period summary: hours of both ways (16.5), the readings from the entries that have them although the period ENDS on a Time day
  const sm = rows.summary.find(x => x.no === 'T76-JCB');
  assert.deepStrictEqual([sm.hr, sm.ohr, sm.chr, sm.unit], [16.5, 100, 110, 'Hrs']);
  // … and when the period STARTS on a Time day the average is still worked out (it was blank)
  const sm2 = run('f => getLogBookList_(f)', { from: '2026-07-02', to: '2026-07-04', no: 'T76-JCB', all: true }).summary.find(x => x.no === 'T76-JCB');
  assert.deepStrictEqual([sm2.hr, sm2.ohr, sm2.chr, sm2.unit], [11.5, 105, 110, 'Hrs']);
  // Monthly Diesel & Average: opening / closing readings and their dates from the entries that have them
  const g = [{ rows: [{ id: 'T76-JCB', total: 0 }] }]; run('(g, f, t) => { addReadings_(g, f, t); this.__g76 = g; }', g, '2026-07-02', '2026-07-04');
  const mr = run('() => __g76[0].rows[0]');
  assert.deepStrictEqual([mr.oHr, mr.cHr, mr.tHr, mr.oDate, mr.cDate], [105, 110, 11.5, '2026-07-03', '2026-07-03']);
  // the edit window of the 1st: "the next entry" whose Start follows is the 3rd (the Time day in between has no Start)
  const key = d => run('(n, d) => { const lt = table_(APP.SHEET_LOG), c = lt.c, r = lt.rows.find(x => str_(x[c[H.NO]]) === n && dkey_(x[c[H.DATE]]) === d); return logKeyOf_(lt, r); }', 'T76-JCB', d);
  const e1 = run('k => getLogEntry_(k)', key('2026-07-01'));
  assert.deepStrictEqual([e1.next && e1.next.date, e1.next && e1.next.ohr], ['2026-07-03', 105]);
  // Edit Log Book on the 1st only: its Close lowered to 104 → (update-77, asked 11-10-2026: an edit of one date never changes another
  // date of a machinery on hours) the 3rd keeps its Start 105
  const ed = run('(f, t) => getLogEditData_("T76-JCB", f, t)', '2026-07-01', '2026-07-01');
  const r1 = ed.rows[0], b = run('p => { try { return saveLogBulk_(p); } catch (e) { return { thrown: String(e.message) }; } }', { no: 'T76-JCB', from: '2026-07-01', to: '2026-07-01', deleted: [], openingDiesel: '',
    rows: [{ key: r1.key, same: false, half: false, date: r1.date, shift: r1.shift, mode: 'Hrs', openingHr: 100, closingHr: 104, openingKm: '', closingKm: '', tStart: '', tEnd: '', tBreak: '', remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: 'EXCAVATION' }] });
  assert.ok(b.ok, JSON.stringify(b).slice(0, 300));
  const start3 = () => run('(n) => { const lt = table_(APP.SHEET_LOG), c = lt.c, r = lt.rows.find(x => str_(x[c[H.NO]]) === n && dkey_(x[c[H.DATE]]) === "2026-07-03"); return [num0_(r[c[H.OHR]]), num0_(r[c[H.CHR]])]; }', 'T76-JCB');
  assert.deepStrictEqual(start3(), [105, 110], 'the 3rd is not changed (update-77)');
  // delete the 1st: the 3rd keeps its Start (update-77: nothing else changes)
  run('k => deleteLogRow_(k)', key('2026-07-01'));
  assert.deepStrictEqual(start3(), [105, 110], 'the 3rd is not changed by the delete (update-77)');
  // the bill per hour: July = 02 Time 4 h + 03 Hrs 5 h + 04 Time 2.5 h = 11.5 h × ₹1,000 = ₹11,500 – the Time hours are paid like the meter hours
  run('(x, m) => saveVendor_(x, m)', { name: 'T76 Earthmovers', gstReg: 'No', pan: 'ABCDE1276T', bank: 'SBI', account: '12345676', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'T76 Earthmovers', from: '2026-06-01', tdsPct: 2, woNo: 'WO-76', lines: [{ no: 'T76-JCB', basis: 'Per Hour', rate: 1000, diesel: 'Company' }] }, 'add');
  const from = '2026-07-01', to = '2026-07-31', list = run('f => getLogBookList_(f)', { from: from, to: to, no: 'T76-JCB', all: true }).rows, extra = run('f => logPrintExtra_(f)', { from: from, to: to, nos: ['T76-JCB'] });
  const bl = run('(l, e, f, t) => billMachineCalc_(findMachine_("T76-JCB"), l, e, f, t, undefined, true)', list, extra, from, to);
  assert.strictEqual(bl.amount, 11500, JSON.stringify(bl).slice(0, 400));
});

// update-77 (11-10-2026): "the same machinery, the same day, Breaker worked two times – if the readings are different it must be
// accepted; when I edit the entry of the 3rd, the 2nd must not change, nor the 4th – only for machinery". His answers: the hours
// between the rows are NOT counted; a Close that passes the next entry's Start stops the save; only machinery on hours.
// Hand-worked: 01-07 Breaker 100 → 102 and 110 → 113 = 2 + 3 = 5 h (102 → 110 not worked); 02-07 113 → 116 = 3 h; 03-07 116 → 120 = 4 h.
test('an hours machinery: two rows in one shift with a gap (hours between not counted); an edit or delete never changes another date', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  run('(x, m) => saveMaster_(x, m)', { no: 'T77-BRK', name: 'Breaker', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'T77 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'T77-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 4, owner: 'T77 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'T77-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'T77 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'T77 Earthmovers', gstReg: 'No', pan: 'ABCDE1277T', bank: 'SBI', account: '12345677', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'T77 Earthmovers', from: '2026-06-01', tdsPct: 2, woNo: 'WO-77', lines: [{ no: 'T77-BRK', basis: 'Per Hour', rate: 1000, diesel: 'Company' },
    { no: 'T77-JCB', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }] }] }, 'add');
  const save = rows => { const x = tryRun('x => saveLogRowsInner_(x)', { rows: rows }); return x && (x.thrown || x.ok === false) ? { thrown: x.thrown || (x.errors || []).map(e => e.msg).join(' ') } : x; };
  const B = (d, o) => Object.assign({ date: d, shift: 'Full Day', no: 'T77-BRK', mode: 'Hrs' }, o);
  const stored = no => run(`no => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(x => str_(x[c[H.NO]]) === no).map(x => ({ d: dkey_(x[c[H.DATE]]).slice(5), ohr: num0_(x[c[H.OHR]]), chr: num0_(x[c[H.CHR]]), whr: num0_(x[c[H.WHR]]), tot: num0_(x[c[H.TOT]]), items: str_(x[c[H.ITEMS]]) })).sort((a, b) => a.d < b.d ? -1 : 1); }`, no);
  const brief = no => stored(no).map(x => x.d + ' ' + x.ohr + '→' + x.chr + ' = ' + x.whr);
  // the entry page: two rows of the same shift, the second starting ABOVE the Close of the first → one entry of 5 hours
  let r = save([B('2026-07-01', { openingHr: 100, closingHr: 102, work: 'ROCK BREAKING' }), B('2026-07-01', { openingHr: 110, closingHr: 113, work: 'ROCK BREAKING' })]);
  assert.ok(r.ok && r.count === 1 && r.joined === 2, JSON.stringify(r).slice(0, 300));
  let s = stored('T77-BRK');
  assert.deepStrictEqual([s[0].ohr, s[0].chr, s[0].whr, s[0].tot], [100, 113, 5, 25], '5 hours (not 13); diesel as per standard 5 h × 5 = 25 L');
  assert.deepStrictEqual(JSON.parse(s[0].items), { _parts: [{ n: '', q: 2, w: 'ROCK BREAKING' }, { n: '', q: 3, g: 8, w: 'ROCK BREAKING' }] });
  // a row starting BELOW the Close of the row before it is still refused
  assert.match(save([B('2026-07-05', { openingHr: 200, closingHr: 205 }), B('2026-07-05', { openingHr: 204, closingHr: 206 })]).thrown || '', /row 2 of 05-07-2026 starts at 204, below the Close 205 of the row before it/);
  // the next day starts at the last Close (113)
  assert.strictEqual(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'T77-BRK', '2026-07-02', 'Full Day').openingHr, 113);
  assert.ok(save([B('2026-07-02', { openingHr: 113, closingHr: 116 })]).ok);
  assert.ok(save([B('2026-07-03', { openingHr: 116, closingHr: 120 })]).ok);
  assert.deepStrictEqual(brief('T77-BRK'), ['07-01 100→113 = 5', '07-02 113→116 = 3', '07-03 116→120 = 4']);
  // Edit Log Book reads the 1st back as its two rows, with the hours not worked between them
  const ed = run('(f, t) => getLogEditData_("T77-BRK", f, t)', '2026-07-01', '2026-07-02');
  assert.deepStrictEqual(ed.rows[0].itemParts.map(p => [p.n, p.q, p.g || 0].join('|')), ['|2|0', '|3|8']);
  const bulk = (rows, from, to) => tryRun('p => saveLogBulk_(p)', { no: 'T77-BRK', from: from, to: to, deleted: [], openingDiesel: '', rows: rows });
  const R = (row, o) => Object.assign({ key: row.key, same: false, half: false, date: row.date, shift: row.shift, mode: 'Hrs', openingHr: row.ohr, closingHr: row.chr, openingKm: '', closingKm: '', tStart: '', tEnd: '', tBreak: '', remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: '' }, o);
  // Edit Log Book on the 2nd only: Close 117 passes the Start (116) of the 3rd → refused with the reason, nothing changed
  const e2 = ed.rows[1];
  let b = bulk([R(e2, { closingHr: 117 })], '2026-07-02', '2026-07-02');
  assert.ok(b.ok === false && /02-07-2026: Close Hrs 117 is more than the Start Hrs 116 of the entry of 03-07-2026 \(Full Day\) – that entry is not changed by itself/.test(b.errors[0].msg), JSON.stringify(b).slice(0, 300));
  assert.deepStrictEqual(brief('T77-BRK'), ['07-01 100→113 = 5', '07-02 113→116 = 3', '07-03 116→120 = 4']);
  // … Close lowered to 115.5: saved; the 3rd keeps its Start 116 (it does NOT follow)
  b = bulk([R(e2, { closingHr: 115.5 })], '2026-07-02', '2026-07-02');
  assert.ok(b.ok, JSON.stringify(b).slice(0, 300));
  assert.deepStrictEqual(brief('T77-BRK'), ['07-01 100→113 = 5', '07-02 113→115.5 = 2.5', '07-03 116→120 = 4']);
  // the small edit window: the same rule
  const key = d => run('(n, d) => { const lt = table_(APP.SHEET_LOG), c = lt.c, r = lt.rows.find(x => str_(x[c[H.NO]]) === n && dkey_(x[c[H.DATE]]) === d); return logKeyOf_(lt, r); }', 'T77-BRK', d);
  assert.match(tryRun('(k, l) => updateLogRow_(k, l)', key('2026-07-02'), { openingHr: 113, closingHr: 118, work: '' }).thrown || '', /Close Hrs 118 is more than the Start Hrs 116 of the entry of 03-07-2026/);
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', key('2026-07-02'), { openingHr: 113, closingHr: 115, work: '' }).thrown);
  assert.deepStrictEqual(brief('T77-BRK'), ['07-01 100→113 = 5', '07-02 113→115 = 2', '07-03 116→120 = 4']);
  // … and the readings of the 1st (rows with a gap) are changed row by row in Edit Log Book, not in the small window
  assert.match(tryRun('(k, l) => updateLogRow_(k, l)', key('2026-07-01'), { openingHr: 100, closingHr: 112, work: 'ROCK BREAKING' }).thrown || '', /rows in this shift that are kept row by row \(hours not worked between them, or a row by Time\) – change its Start \/ Close in Edit Log Book/);
  // Edit Log Book on the 1st: three rows 100 → 102, 105 → 106, 110 → 113 = 2 + 1 + 3 = 6 h; the 2nd keeps its Start 113
  const e1 = run('(f, t) => getLogEditData_("T77-BRK", f, t)', '2026-07-01', '2026-07-01').rows[0];
  b = bulk([R(e1, { work: 'ROCK BREAKING', items: { _parts: [{ n: '', q: 2 }, { n: '', q: 1, g: 3 }, { n: '', q: 3, g: 4 }] } })], '2026-07-01', '2026-07-01');
  assert.ok(b.ok, JSON.stringify(b).slice(0, 300));
  assert.deepStrictEqual(brief('T77-BRK'), ['07-01 100→113 = 6', '07-02 113→115 = 2', '07-03 116→120 = 4']);
  // rows that do not fit between the Start and the Close are refused
  b = bulk([R(e1, { items: { _parts: [{ n: '', q: 2 }, { n: '', q: 3, g: 4 }] } })], '2026-07-01', '2026-07-01');
  assert.ok(b.ok === false && /the rows of this shift make 5 hours but the entry has 9 hours/.test(b.errors[0].msg), JSON.stringify(b).slice(0, 300));
  // an Excel file that changes the Close of the 1st is refused (its rows are changed in Edit Log Book)
  const imp = tryRun('x => importLogBook_(x)', { check: true, rows: [{ line: 2, date: '2026-07-01', shift: 'Full Day', no: 'T77-BRK', mode: 'Hrs', closingHr: 114 }] });
  assert.ok(/has rows in its shift that are kept row by row \(hours not worked between them, or a row by Time\) – change it in Edit Log Book/.test(JSON.stringify(imp)), JSON.stringify(imp).slice(0, 300));
  // delete the 2nd: the 3rd keeps its Start 116 (nothing else changes)
  run('k => deleteLogRow_(k)', key('2026-07-02'));
  assert.deepStrictEqual(brief('T77-BRK'), ['07-01 100→113 = 6', '07-03 116→120 = 4']);
  // a new entry put in between: its Close may not pass the 3rd's Start (116) – the 3rd is not changed
  assert.match(save([B('2026-07-02', { openingHr: 113, closingHr: 117 })]).thrown || '', /Close Hrs 117 is more than the Start Hrs 116 of the entry of 03-07-2026/);
  assert.ok(save([B('2026-07-02', { openingHr: 113, closingHr: 115 })]).ok);
  assert.deepStrictEqual(brief('T77-BRK'), ['07-01 100→113 = 6', '07-02 113→115 = 2', '07-03 116→120 = 4']);
  // the bill per hour: 6 + 2 + 4 = 12 h × ₹1,000 = ₹12,000 (the gaps are not paid)
  const bill = no => run('(n, f, t) => billMachineCalc_(findMachine_(n), getLogBookList_({ from: f, to: t, no: n, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [n] }), f, t, undefined, true).amount', no, '2026-07-01', '2026-07-31');
  assert.strictEqual(bill('T77-BRK'), 12000);
  // a machinery with two hour works: Breaker twice in one shift with a gap (the same work one after the other is fine now)
  r = save([B('2026-07-01', { no: 'T77-JCB', openingHr: 100, closingHr: 102, items: { _all: 'Breaker' } }), B('2026-07-01', { no: 'T77-JCB', openingHr: 110, closingHr: 113, items: { _all: 'Breaker' } })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  s = stored('T77-JCB');
  assert.deepStrictEqual([s[0].whr, JSON.parse(s[0].items)], [5, { Breaker: 5, _parts: [{ n: 'Breaker', q: 2 }, { n: 'Breaker', q: 3, g: 8 }] }]);
  assert.strictEqual(bill('T77-JCB'), 5 * 1500);
  // (after the review) an Excel file that brings that entry back UNCHANGED ("Work type" Breaker, Close 113) is not refused: nothing to change
  const back = tryRun('x => importLogBook_(x)', { check: true, rows: [{ line: 2, date: '2026-07-01', shift: 'Full Day', no: 'T77-JCB', mode: 'Hrs', closingHr: 113, items: { _all: 'Breaker' } }] });
  assert.ok(back && !back.thrown && back.ok !== false && back.same === 1, JSON.stringify(back).slice(0, 400));
  // (after the review) Edit Log Book sends the gap entry as ONE row without its rows (they could not be shown): the rows stay, still 6 h
  const e1b = run('(f, t) => getLogEditData_("T77-BRK", f, t)', '2026-07-01', '2026-07-01').rows[0];
  b = bulk([R(e1b, { work: 'ROCK BREAKING', items: {} })], '2026-07-01', '2026-07-01');
  assert.ok(b.ok && brief('T77-BRK')[0] === '07-01 100→113 = 6' && /"g":4/.test(stored('T77-BRK')[0].items), JSON.stringify([b, stored('T77-BRK')[0]]).slice(0, 400));
  // … and its rows joined on purpose into one row 100 → 102 (the others deleted in the grid): one ordinary entry of 2 h, no rows kept
  b = bulk([R(e1b, { closingHr: 102, work: 'ROCK BREAKING', items: {}, joinRows: true })], '2026-07-01', '2026-07-01');
  assert.ok(b.ok && brief('T77-BRK')[0] === '07-01 100→102 = 2' && !/_parts/.test(stored('T77-BRK')[0].items), JSON.stringify([b, stored('T77-BRK')[0]]).slice(0, 400));
  // (after the review) a NEW METER starts a new chain: an entry before it is not held against its Start (0)
  const nm0 = save([B('2026-07-10', { meter: 'new', meterNote: 'meter changed', openingHr: 0, closingHr: 5 })]); assert.ok(nm0.ok, JSON.stringify(nm0).slice(0, 300));
  const nm = save([B('2026-07-09', { openingHr: 120, closingHr: 125 })]);
  assert.ok(nm.ok, JSON.stringify(nm).slice(0, 300));
  // a KM vehicle keeps the old rules: no second row in a shift; Edit Log Book still moves the next entry's Start
  const TP = (d, o) => Object.assign({ date: d, shift: 'Full Day', no: 'T77-TIP', mode: 'KM' }, o);
  assert.match(save([TP('2026-07-01', { openingKm: 100, closingKm: 150 }), TP('2026-07-01', { openingKm: 160, closingKm: 170 })]).thrown || '', /already saved for 01-07-2026|T77-TIP/);
  assert.ok(save([TP('2026-07-01', { openingKm: 100, closingKm: 150 })]).ok && save([TP('2026-07-02', { openingKm: 150, closingKm: 200 })]).ok);
  const t1 = run('(f, t) => getLogEditData_("T77-TIP", f, t)', '2026-07-01', '2026-07-01').rows[0];
  b = tryRun('p => saveLogBulk_(p)', { no: 'T77-TIP', from: '2026-07-01', to: '2026-07-01', deleted: [], openingDiesel: '', rows: [Object.assign(R(t1, { mode: 'KM', openingHr: '', closingHr: '' }), { openingKm: 100, closingKm: 160 })] });
  assert.ok(b.ok, JSON.stringify(b).slice(0, 300));
  assert.deepStrictEqual(stored('T77-TIP').map(x => x.d), ['07-01', '07-02']);
  assert.strictEqual(run('() => { const lt = table_(APP.SHEET_LOG), c = lt.c; const r = lt.rows.find(x => str_(x[c[H.NO]]) === "T77-TIP" && dkey_(x[c[H.DATE]]) === "2026-07-02"); return num0_(r[c[H.OKM]]); }'), 160, 'the KM vehicle\'s next entry follows the new Close, as before');
});

// update-78 (11-10-2026, his screen: Bucket on Time and Breaker on Hrs in the same Day shift – "in one shift it can be so"): a machinery
// on hours may have rows by Time (From – To, no reading) among its rows by Hrs; their hours are ADDED. Hand-worked: 30-06 3710 → 3714.5;
// 01-07 Bucket 09:00–11:00 = 2 h (Time) + Breaker 3714.5 → 3717.5 = 3 h → 5 h; 02-07 3717.5 → 3719 (1.5) + Time 13:00–14:30 (1.5) + 3720 → 3721 (1, 1 h not worked) = 4 h.
test('an hours machinery: rows by Time and rows by Hrs in one shift – the Time hours are added; Start / Close from the rows by Hrs', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  run('(x, m) => saveMaster_(x, m)', { no: 'T78-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'T78 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'T78-BB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'T78 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('x => saveLbFormats_(x)', { 'T78-JCB': 'D', 'T78-BB': 'D' });
  run('(x, m) => saveVendor_(x, m)', { name: 'T78 Earthmovers', gstReg: 'No', pan: 'ABCDE1278T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'T78 Earthmovers', from: '2026-06-01', tdsPct: 2, woNo: 'WO-78', lines: [{ no: 'T78-JCB', basis: 'Per Hour', rate: 1000, diesel: 'Company' },
    { no: 'T78-BB', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }] }] }, 'add');
  const save = rows => { const x = tryRun('x => saveLogRowsInner_(x)', { rows: rows }); return x && (x.thrown || x.ok === false) ? { thrown: x.thrown || (x.errors || []).map(e => e.msg).join(' ') } : x; };
  const J = (d, o) => Object.assign({ date: d, shift: 'Day', no: 'T78-JCB' }, o);
  const stored = no => run(`no => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(x => str_(x[c[H.NO]]) === no).map(x => ({ d: dkey_(x[c[H.DATE]]).slice(5), mode: str_(x[c[H.UNIT]]), ohr: num0_(x[c[H.OHR]]), chr: num0_(x[c[H.CHR]]), whr: num0_(x[c[H.WHR]]), tot: num0_(x[c[H.TOT]]), items: str_(x[c[H.ITEMS]]) })).sort((a, b) => a.d < b.d ? -1 : 1); }`, no);
  assert.ok(save([J('2026-06-30', { mode: 'Hrs', openingHr: 3710, closingHr: 3714.5 })]).ok);
  // his screen: row 1 Bucket by Time 09:00 – 11:00, row 2 Breaker by Hrs (its Start left to the app: 3714.5) → 3717.5
  let r = save([J('2026-07-01', { mode: 'Time', tStart: '09:00', tEnd: '11:00', work: 'LOADING' }), J('2026-07-01', { mode: 'Hrs', closingHr: 3717.5, work: 'ROCK BREAKING' })]);
  assert.ok(r.ok && r.count === 1 && r.joined === 2, JSON.stringify(r).slice(0, 300));
  let s = stored('T78-JCB').find(x => x.d === '07-01');
  assert.deepStrictEqual([s.mode, s.ohr, s.chr, s.whr, s.tot], ['Hrs', 3714.5, 3717.5, 5, 25], 'one entry on Hrs: Start / Close of its row by Hrs, 2 + 3 = 5 h, diesel 5 × 5 = 25 L');
  assert.deepStrictEqual(JSON.parse(s.items), { _parts: [{ n: '', q: 2, m: 'T', ts: '09:00-11:00', w: 'LOADING' }, { n: '', q: 3, w: 'ROCK BREAKING' }] });
  assert.strictEqual(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'T78-JCB', '2026-07-02', 'Day').openingHr, 3717.5, 'the next day starts at the last Close');
  // Edit Log Book reads the rows back (the row by Time with its times); it saves three rows: Hrs 1.5, Time 1.5, Hrs 1 after 1 h not worked = 4 h
  assert.ok(save([J('2026-07-02', { mode: 'Hrs', openingHr: 3717.5, closingHr: 3721 })]).ok);
  const ed = run('(f, t) => getLogEditData_("T78-JCB", f, t)', '2026-07-01', '2026-07-02');
  assert.deepStrictEqual(ed.rows[0].itemParts.map(p => [p.q, p.m || '', p.ts || ''].join('|')), ['2|T|09:00-11:00', '3||']);
  const e2 = ed.rows[1], bulk = (rows, f, t) => tryRun('p => saveLogBulk_(p)', { no: 'T78-JCB', from: f, to: t, deleted: [], openingDiesel: '', rows: rows });
  const R = (row, o) => Object.assign({ key: row.key, same: false, half: false, date: row.date, shift: row.shift, mode: 'Hrs', openingHr: row.ohr, closingHr: row.chr, openingKm: '', closingKm: '', tStart: '', tEnd: '', tBreak: '', remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: '' }, o);
  let b = bulk([R(e2, { items: { _parts: [{ n: '', q: 1.5 }, { n: '', q: 99, m: 'T', ts: '13:00-14:30' }, { n: '', q: 1, g: 1 }] } })], '2026-07-02', '2026-07-02');
  assert.ok(b.ok, JSON.stringify(b).slice(0, 300));
  s = stored('T78-JCB').find(x => x.d === '07-02');
  assert.deepStrictEqual([s.ohr, s.chr, s.whr], [3717.5, 3721, 4], '3.5 − 1 not worked + 1.5 by Time = 4 h (the hours of the row by Time are worked out from its times, not taken as sent)');
  assert.deepStrictEqual(JSON.parse(s.items)._parts, [{ n: '', q: 1.5 }, { n: '', q: 1.5, m: 'T', ts: '13:00-14:30' }, { n: '', q: 1, g: 1 }]);
  // a row by Time whose time is 0 is refused
  b = bulk([R(e2, { items: { _parts: [{ n: '', q: 3.5 }, { n: '', q: 0, m: 'T', ts: '13:00-14:00', tb: 60 }] } })], '2026-07-02', '2026-07-02');
  assert.ok((b.ok === false && /working time is 0 for this row/.test(JSON.stringify(b))) || /working time is 0 for this row/.test(b.thrown || ''), JSON.stringify(b).slice(0, 300));
  // update-144 (changed on purpose – it was refused): a shift of rows ALL by Time is ONE entry by Time, 09:00 – 10:00 + 11:00 – 12:00 = 2 h
  r = save([J('2026-07-03', { mode: 'Time', tStart: '09:00', tEnd: '10:00' }), J('2026-07-03', { mode: 'Time', tStart: '11:00', tEnd: '12:00' })]);
  assert.ok(r.ok && r.count === 1 && r.joined === 2, JSON.stringify(r).slice(0, 300));
  s = stored('T78-JCB').find(x => x.d === '07-03');
  assert.deepStrictEqual([s.mode, s.whr, JSON.parse(s.items)._parts.map(p => p.ts + ' ' + p.q)], ['Time', 2, ['09:00-10:00 1', '11:00-12:00 1']]);
  // the edit window: readings of such an entry are changed row by row in Edit Log Book
  const key = d => run('(n, d) => { const lt = table_(APP.SHEET_LOG), c = lt.c, r = lt.rows.find(x => str_(x[c[H.NO]]) === n && dkey_(x[c[H.DATE]]) === d); return logKeyOf_(lt, r); }', 'T78-JCB', d);
  assert.match(tryRun('(k, l) => updateLogRow_(k, l)', key('2026-07-01'), { openingHr: 3714.5, closingHr: 3718, work: 'LOADING / ROCK BREAKING' }).thrown || '', /kept row by row/);
  // the bill per hour: 5 + 4 (+ 2 by Time on 03-07 – update-144) = 11 h × ₹1,000 = ₹11,000 (30-06 is June)
  const bill = no => run('(n, f, t) => billMachineCalc_(findMachine_(n), getLogBookList_({ from: f, to: t, no: n, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [n] }), f, t, undefined, true).amount', no, '2026-07-01', '2026-07-31');
  assert.strictEqual(bill('T78-JCB'), 11000);
  // (after the review) a new meter fitted that day: ticked on the first row by Hrs, after a row by Time – the entry starts at the new meter's 0
  const nm = save([J('2026-08-01', { mode: 'Time', tStart: '08:00', tEnd: '09:00' }), J('2026-08-01', { mode: 'Hrs', meter: 'new', meterNote: 'meter changed', openingHr: 0, closingHr: 2 })]);
  assert.ok(nm.ok, JSON.stringify(nm).slice(0, 300));
  s = stored('T78-JCB').find(x => x.d === '08-01');
  assert.deepStrictEqual([s.ohr, s.chr, s.whr], [0, 2, 3]);
  // a machinery with Bucket and Breaker: Bucket by Time 2 h, Breaker by Hrs 100 → 103 → 5 h; bill 2 × 1,200 + 3 × 1,500 = ₹6,900
  r = save([J('2026-07-01', { no: 'T78-BB', mode: 'Time', tStart: '09:00', tEnd: '11:00', items: { _all: 'Bucket' } }), J('2026-07-01', { no: 'T78-BB', mode: 'Hrs', openingHr: 100, closingHr: 103, items: { _all: 'Breaker' } })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  s = stored('T78-BB')[0];
  assert.deepStrictEqual([s.ohr, s.chr, s.whr], [100, 103, 5]);
  assert.strictEqual(bill('T78-BB'), 2 * 1200 + 3 * 1500);
});

// update-83 (12-10-2026): the universal search (Ctrl + K) – "whatever I type must work: annd still finds Anand and suggests it; a
// vehicle's reading shows where it is – Log Book, Diesel Issue"; each kind only for a user who may see its page.
test('universal search: a spelling mistake still finds the name (and suggests it); a reading is found in the Log Book and the Diesel Issue; access respected', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveMaster_(x, m)', { no: 'T83-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'Sai Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveVendor_(x, m)', { name: 'Sai Earthmovers', gstReg: 'No', pan: 'ABCDE1283S', bank: 'SBI', account: '12345683', ifsc: 'SBIN0000001', phone: '9822000083' }, 'add');
  run('x => saveLogRowsInner_(x)', { rows: [{ no: 'T83-JCB', date: '2026-07-01', shift: 'Full Day', mode: 'Hrs', openingHr: 3714.5, closingHr: 3717.5, driver: 'Anand Patil', work: 'ROCK BREAKING', challan: 'CH-4471' }] });
  run('x => saveInward_(x)', { date: '2026-06-30', location: 'Dispenser', pump: 'Pump', qty: 1000, rate: 92, billNo: 'IN83', billDate: '2026-06-30' });
  run('x => saveDieselIssue_(x)', { date: '2026-07-01', shift: 'Day', source: 'Dispenser', no: 'T83-JCB', qty: 60, hrReading: 3714.5, driver: 'Anand Patil', force: true });
  const ALL = { perms: { 'Log Book': 'View', 'Diesel Issue': 'View', 'Vendor Master': 'View' } };
  const s = (u, q) => run('(u, q) => globalSearch_(u, q)', u, q);
  // "annd" (a letter missing) finds Anand – in the Log Book and the Diesel Issue – and the spelling is suggested
  let r = s(ALL, 'annd');
  assert.ok(r.logs.some(x => x.no === 'T83-JCB' && /Driver: ANAND PATIL|Driver: Anand Patil/i.test(x.why)) && r.issues.some(x => x.no === 'T83-JCB'), JSON.stringify(r).slice(0, 500));
  assert.deepStrictEqual(r.fixes, [{ w: 'ANND', to: 'ANAND' }]);
  // two mistakes in a long word: "earthmovres" (swap) + "sai" → the vendor
  r = s(ALL, 'sai earthmovres');
  assert.ok(r.vendors.some(x => x.name === 'Sai Earthmovers'), JSON.stringify(r.vendors));
  // a reading: exactly (3714.5 = 3714.50) – where it is: Start Hrs in the Log Book, Hrs reading in the Diesel Issue
  r = s(ALL, '3714.50');
  assert.ok(r.logs.some(x => /Start Hrs: 3714.5/.test(x.why)) && r.issues.some(x => /Hrs reading: 3714.5/.test(x.why)), JSON.stringify([r.logs, r.issues]).slice(0, 500));
  // a reading in between Start and Close: the Log Book entry it falls in
  r = s(ALL, '3716');
  assert.ok(r.logs.some(x => x.date === '2026-07-01' && /Hrs: 3,?714.5 → 3,?717.5 \(3716 is in between\)/.test(x.why)), JSON.stringify(r.logs));
  // machinery + challan, written without the dash
  r = s(ALL, 't83jcb ch4471');
  assert.strictEqual(r.logs.length, 1, JSON.stringify(r.logs));
  // a short word is not "corrected" into something else (no noise): "sam" finds nothing of these
  r = s(ALL, 'zzzq');
  assert.ok(!r.logs.length && !r.issues.length && !r.vendors.length && !r.fixes.length);
  // each kind only for a user who may see its page
  r = s({ perms: { 'Diesel Issue': 'View' } }, 'anand');
  assert.ok(!r.logs.length && r.issues.length && !r.vendors.length, JSON.stringify(r).slice(0, 300));
  r = s({ perms: {} }, 'anand');
  assert.ok(!r.logs.length && !r.issues.length && !r.vendors.length);
  // the page's matcher is the same as the server's (same answers for the same words)
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), a = app.indexOf('const gsNormP = '), b = app.indexOf('const gsWords = ');
  const P = new Function(app.slice(a, b) + '; return { gsRecordP };')();
  const fld = [['Driver', 'Anand Patil'], ['Close Hrs', 3717.5], ['Machinery', 'T83-JCB']];
  for (const fz of [false, true]) for (const w of ['annd', 'ANAND', 'patl', '3717.50', 't83jcb', 'zzzq', 'anadn', 'anandr']) {
    const pg = P.gsRecordP([w.toUpperCase()], fld, fz), sv = run('(w, f, fz) => gsRecord_([w], f.map(x => gsField_(x[0], x[1])), null, fz)', w.toUpperCase(), fld, fz);
    assert.deepStrictEqual(pg ? [pg.score, pg.fixes] : null, sv ? [sv.score, sv.fixes] : null, w + ' ' + fz);
  }
  // a word that is right is never "corrected": the mistakes are allowed only when nothing is found exactly
  r = s(ALL, 'anand');
  assert.ok(r.logs.length && !r.fixes.length, JSON.stringify(r.fixes));
  // the start of a longer name with a mistake: "anadr" → ANANDRAO? (here: ANAND – the driver's first name)
  assert.ok(P.gsRecordP(['ANND'], [['Driver', 'Anandrao Patil']], true) && !P.gsRecordP(['ANND'], [['Driver', 'Anandrao Patil']], false));
});

test('update-85 photos of a diesel issue: the AI\'s answer → the reading; the list kept with an entry; the page and the server know the same 4 photos; a photo is refused where it cannot be kept', () => {
  const { T, ctx } = require('./harness.js');
  const fs = require('fs'), path = require('path');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // the AI's answer (only numbers ≥ 0; the reading(s) the machinery is measured by)
  const ans = (t, km, hr) => run('(t, a, b) => meterAnswer_(t, a, b)', t, km, hr);
  assert.deepStrictEqual(ans('{"km": 45173.4, "hrs": null}', true, false), { km: 45173.4, hr: null });
  assert.deepStrictEqual(ans('```json\n{"km": null, "hrs": "3,714.5"}\n```', false, true), { km: null, hr: 3714.5 });
  assert.deepStrictEqual(ans('The reading is {"km": 120, "hrs": 88.2} as shown', true, true), { km: 120, hr: 88.2 });
  assert.deepStrictEqual(ans('{"km": 120, "hrs": 88.2}', false, true), { km: null, hr: 88.2 }, 'a KM the machinery is not measured by is not put in');
  assert.deepStrictEqual(ans('{"km": -5, "hrs": "abc"}', true, true), { km: null, hr: null });
  assert.deepStrictEqual(ans('I cannot see a meter', true, true), { km: null, hr: null });
  assert.deepStrictEqual(ans('{"km": "", "hrs": null}', true, true), { km: null, hr: null }, 'an empty text is not 0');
  // the list kept with an entry: only the 4 kinds and real names of the store
  const P = '2026-10/3d7333fb-7e7b-4666-9174-de383d96c72f.jpg';
  assert.strictEqual(run('v => photoList_(v).length', JSON.stringify([{ k: 'dash', p: P }, { k: 'xx', p: P }, { k: 'veh', p: '../../etc/passwd' }])), 1);
  assert.strictEqual(run('v => photoList_(v).length', 'not a list'), 0);
  assert.strictEqual(run('v => photoList_(v).length', ''), 0);
  // the same 4 photos on the page and in the server, in the same order
  const app = fs.readFileSync(path.join(__dirname, '..', 'app', 'App.html'), 'utf8'), code = fs.readFileSync(path.join(__dirname, '..', 'app', 'Code.gs'), 'utf8');
  const pageKinds = [...(/const PH_KINDS = \[(.*)\];/.exec(app) || ['', ''])[1].matchAll(/\['(\w+)'/g)].map(m => m[1]);
  assert.deepStrictEqual(pageKinds, ['dash', 'hrs', 'veh', 'pump', 'reg']);      // (update-139: the Hour meter photo)
  assert.deepStrictEqual(run('() => Object.keys(PHOTO_KINDS_)'), pageKinds);
  // a photo that this user did not send (or a copy where photos cannot be kept): the save is refused, nothing is saved; without photos as before
  run('() => saveMaster_({ no: "PH-1", name: "Tipper", type: "Tipper", unit: "KM", worksOn: ["KM"], kmStd: 3, owner: "RCL", ownership: "Own", status: "Active", activeFrom: "2026-01-01" }, "add")');
  const before = run('() => getDieselIssues_({ no: "PH-1", all: true }).count');
  assert.throws(() => run('x => saveDieselIssue_(x, { email: "a@b.c" })', { date: '2026-06-01', shift: 'Day', source: 'Dispenser', no: 'PH-1', qty: 10, kmReading: 100, force: true, photos: [{ k: 'dash', p: P }] }), /not taken by you|kept in Supabase only/);
  assert.strictEqual(run('() => getDieselIssues_({ no: "PH-1", all: true }).count'), before, 'nothing was saved');
  const ok = run('x => saveDieselIssue_(x)', { date: '2026-06-01', shift: 'Day', source: 'Dispenser', no: 'PH-1', qty: 10, kmReading: 100, force: true });
  assert.ok(ok.ok && ok.id, 'an entry without photos is saved as before');
  // the AI reads the dashboard photo AFTER it is kept, as its own question (a slow AI never holds up the photo or the Save);
  // not for a Debit Basis machinery (it has no reading); a photo belongs to one machinery and goes with one entry
  assert.match(app, /if \(\(\(k === 'dash' \|\| k === 'hrs'\) && m\.supply !== 'Debit Basis'\) \|\| k === 'pump'\) phAsk\(k, m\.id, pic\.small\);/);      // (update-87: dashboard and dispenser, while the photo is sent; update-139: the hour meter)
  assert.match(code, /getMeterReading:\s+\{ m: 'Diesel Issue', withUser: true, f: \(u, x\) => meterReading_\(u, x\) \}/);
  assert.ok(!/aiReadMeter_/.test(code.slice(code.indexOf('function uploadDieselPhoto_'), code.indexOf('function meterReading_'))), 'the upload does not wait for the AI');
  assert.match(code, /rec\.no !== mId/); assert.match(code, /photosTaken_\(photos\.map\(x => x\.p\)\)/); assert.match(code, /pc\.remove\('PH_' \+ p\)/);      // (update-120: photosTaken_)
  // a photo being sent is tried again 3 times (a question), not for ever (a save) – the page's shell and the server agree
  const shell = fs.readFileSync(path.join(__dirname, '..', 'server', 'page.js'), 'utf8'), rt = fs.readFileSync(path.join(__dirname, '..', 'server', 'runtime.js'), 'utf8');
  assert.match(shell, /'logPrintExtra', 'dieselPhoto', 'inwardPhoto', 'uploadAttachment', 'maintFile', 'readMaintBill', 'maintLog', 'capStart', 'capClaim', 'capAdd', 'capPoll', 'capCancel'\]/); assert.match(rt, /'logPrintExtra', 'dieselPhoto', 'inwardPhoto', 'uploadAttachment', 'maintFile', 'readMaintBill', 'maintLog', 'capStart', 'capClaim', 'capAdd', 'capPoll', 'capCancel'\]/);      // (update-120: and a bill copy; update-153: an attachment, and Scan with Mobile – they write no table; its QR's token is never kept with a save's answer)
  // the database step of this update: shown in the app's Read Me word for word; it only ADDS (a column, a private bucket)
  const sqlFile = fs.readFileSync(path.join(__dirname, '..', 'sql', 'supabase_step1x_diesel_photos.sql'), 'utf8');
  const listed = new Function(fs.readFileSync(path.join(__dirname, '..', 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1x_diesel_photos.sql');
  assert.ok(listed && listed.sql === sqlFile, 'step 1x is in Read Me, word for word');
  const sqlCode = sqlFile.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\b(drop|truncate|delete|update)\b/i.test(sqlCode), 'nothing is dropped, emptied or changed');
  assert.match(sqlCode, /add column if not exists photos text/); assert.match(sqlCode, /'diesel-photos', 'diesel-photos', false, 2097152, array\['image\/jpeg'\]/); assert.match(sqlCode, /on conflict \(id\) do nothing/);
});

test('update-87 the AI reading checked against the last reading; the dispenser litres; the driver of the last fill', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const pick = (v, seen, last, today, kind) => run('(v, s, l, t, k) => pickReading_(v, s, l, t, k)', v, seen, last, today, kind);
  const last = { value: 4500, date: '2026-10-05' };
  // fits (not below the last, not more than the machinery can run since: Hrs 24 a day) → taken as read
  assert.deepStrictEqual(pick(4517.3, [], last, '2026-10-12', 'hr'), { v: 4517.3, check: '' });
  // the decimal point missed (a tenth digit in another colour) → moved
  assert.deepStrictEqual(pick(45173, [], last, '2026-10-12', 'hr'), { v: 4517.3, check: '' });
  // the AI took another number (the clock 1245, a trip meter) – the meter is among the numbers it saw → that one
  assert.deepStrictEqual(pick(1245, [88.5, 4512.6, 1245], last, '2026-10-12', 'hr'), { v: 4512.6, check: '' });
  // nothing fits → its reading, with the reason to look again
  assert.deepStrictEqual(pick(4100, [12, 30], last, '2026-10-12', 'hr'), { v: 4100, check: 'less than the last reading 4500 (05-10-2026)' });
  assert.match(pick(9000, [], last, '2026-10-06', 'hr').check, /^much more than the last reading 4500/);
  // KM: 800 a day (at least 300)
  assert.deepStrictEqual(pick(45320, [], { value: 45000, date: '2026-10-11' }, '2026-10-12', 'km'), { v: 45320, check: '' });
  // no last reading known → as read
  assert.deepStrictEqual(pick(77, [], null, '2026-10-12', 'km'), { v: 77, check: '' });
  // the dispenser: litres; amount ÷ rate when the litres were not read; a mismatch → check
  const pump = j => run('j => pumpAnswer_(j)', j);
  assert.deepStrictEqual(pump({ litres: 45, amount: 4140, rate: 92 }), { litres: 45, check: '', amount: 4140, rate: 92 });      // (update-164: the amount and rate too – a site on fuel cards puts the amount in its box)
  assert.deepStrictEqual(pump({ litres: null, amount: 4140, rate: 92 }), { litres: 45, check: '', amount: 4140, rate: 92 });
  assert.match(pump({ litres: 4140, amount: 4140, rate: 92 }).check, /not the amount|not a normal fill/);
  assert.deepStrictEqual(pump({ litres: '45.50' }), { litres: 45.5, check: '', amount: null, rate: null });
  // the page: the dispenser fills Diesel Qty, the driver of the last fill only into an empty box (or one filled the same way)
  const fs = require('fs'), path = require('path'), app = fs.readFileSync(path.join(__dirname, '..', 'app', 'App.html'), 'utf8');
  assert.match(app, /fill\('d_qty', null, p\.litres/);
  assert.match(app, /function dhDriver\(h\) \{\s*const dr = \$\('d_driver'\); if \(S\.editDieselId \|\| \(dr\.value !== '' && dr\.dataset\.auto !== '1'\)\) return;/);
});

test('update-90: the step-7 SQL (several sites) is listed word for word and only ADDS – four new tables, closed to the public', () => {
  const file = fs.readFileSync(path.join(root, 'sql', 'supabase_step7_sites.sql'), 'utf8');
  const list = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')();
  const mine = list.find(x => x.name === 'supabase_step7_sites.sql');
  assert.ok(mine, 'listed in the app'); assert.strictEqual(mine.sql, file, 'the text shown in the app is the file, word for word');
  const code = file.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\b(drop\s+table|truncate)\b/i.test(code) && !/delete\s+from/i.test(code) && !/\bupdate\s+public\./i.test(code), 'nothing is dropped, emptied or changed');
  const altered = [...code.matchAll(/alter\s+table\s+public\.(\w+)/gi)].map(m => m[1]);
  const made = [...code.matchAll(/create table if not exists public\.(\w+)/gi)].map(m => m[1]);
  assert.deepStrictEqual(made.sort(), ['rcl_companies', 'rcl_sites', 'rcl_super_admin', 'rcl_user_sites']);
  assert.ok(altered.every(t => made.indexOf(t) > -1), 'only the new tables are altered (row level security on): ' + altered);
  made.forEach(t => { assert.match(code, new RegExp('alter table public\\.' + t + ' enable row level security')); assert.match(code, new RegExp('revoke all on [^;]*public\\.' + t + '[^;]* from public, anon, authenticated')); });
  assert.match(code, /create unique index if not exists rcl_super_admin_only_one on public\.rcl_super_admin \(\(true\)\)/, 'one Super Admin only – the database itself');
  assert.ok(!/grant[^;]*to (anon|authenticated|public)\b/i.test(code), 'nothing is given to the public API');
  assert.match(code, /from public\.app_users u/, 'the users of the site are COPIED into the list (app_users is only read)');
});

test('update-90: the key of another site is kept locked – it opens only with the same RCL_SITES_KEY', () => {
  const sites = require(path.join(root, 'server', 'sites.js'));
  const was = process.env.RCL_SITES_KEY;
  try {
    process.env.RCL_SITES_KEY = 'unit-test-key-0123456789-abcdef';
    const sealed = sites.seal('sb_secret_abc123');
    assert.match(sealed, /^v1\./); assert.ok(sealed.indexOf('sb_secret') === -1, 'the key cannot be read in the database');
    assert.strictEqual(sites.open(sealed), 'sb_secret_abc123');
    assert.notStrictEqual(sites.seal('sb_secret_abc123'), sealed, 'a new lock every time');
    process.env.RCL_SITES_KEY = 'another-key-0123456789-abcdefgh';
    assert.throws(() => sites.open(sealed), /does not match/);
    delete process.env.RCL_SITES_KEY;
    assert.throws(() => sites.open(sealed), /no key for sites/); assert.throws(() => sites.seal('x'), /RCL_SITES_KEY/);
    assert.throws(() => sites.code('a b'), /not set up/); assert.strictEqual(sites.code(' t2 '), 'T2'); assert.strictEqual(sites.code(''), '');
  } finally { if (was === undefined) delete process.env.RCL_SITES_KEY; else process.env.RCL_SITES_KEY = was; }
});

test('update-91: sign-in through the Portal – switched on only by PORTAL_URL (https), a ticket is refused before any key is asked for when it is no ticket, help in 3 languages', () => {
  const portal = require(path.join(root, 'server', 'portal.js'));
  const was = process.env.PORTAL_URL;
  try {
    delete process.env.PORTAL_URL; assert.strictEqual(portal.url(), '');
    assert.throws(() => portal.verify('a.b.c'), /not linked to the Portal/, 'without the setting: nothing is accepted (the app\'s own sign-in, as before)');
    process.env.PORTAL_URL = 'https://rcl-portal-flame.vercel.app/'; assert.strictEqual(portal.url(), 'https://rcl-portal-flame.vercel.app');
    process.env.PORTAL_URL = 'http://rcl-portal.example'; assert.strictEqual(portal.url(), '', 'plain http is never trusted (only this computer, for tests)');
    process.env.PORTAL_URL = 'http://127.0.0.1:3010'; assert.strictEqual(portal.url(), 'http://127.0.0.1:3010');
    // (13-10-2026, one address) the Portal under the main address: ONE path part is allowed – nothing more
    process.env.PORTAL_URL = 'https://x.example/portal/'; assert.strictEqual(portal.url(), 'https://x.example/portal', 'the Portal under the main address (…/portal)');
    process.env.PORTAL_URL = 'http://127.0.0.1:3030/portal'; assert.strictEqual(portal.url(), 'http://127.0.0.1:3030/portal');
    for (const v of ['https://x.example/a/b', 'https://x.example/portal?x=1', 'https://x.example/por tal', 'javascript:alert(1)']) { process.env.PORTAL_URL = v; assert.strictEqual(portal.url(), '', v); }
    process.env.PORTAL_URL = 'https://rcl-portal-flame.vercel.app';
    assert.throws(() => portal.verify('not-a-ticket'), /not a ticket/);
    assert.throws(() => portal.verify('x'.repeat(9000) + '.a.b'), /not a ticket/);
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'k' })).toString('base64url');
    assert.throws(() => portal.verify(head + '.e30.c2ln'), /not a ticket of the Portal/, 'only ES256 tickets (no "none", no shared-secret ones)');
  } finally { if (was === undefined) delete process.env.PORTAL_URL; else process.env.PORTAL_URL = was; portal.forget(); }
  // the session's 4th part: a shorter life (12 hours for a Portal sign-in), never longer than 30 days
  const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  const a = code.indexOf('const SESSION_MAX_DAYS'), b = code.indexOf('function readUsers_(');
  const pwStamp_ = () => 'abcdef012345';
  const F = new Function('pwStamp_', code.slice(a, b) + '; return { sessionMake_, sessionRead_ };')(pwStamp_);
  const v = F.sessionMake_('a@b.c', 'x', 12 * 3600000), r = F.sessionRead_(v);
  assert.match(v, /^a@b\.c\|abcdef012345\|\d+\|43200000$/); assert.ok(r.left > 12 * 3600000 - 5000 && r.left <= 12 * 3600000);
  assert.ok(F.sessionRead_(F.sessionMake_('a@b.c', 'x')).left > 29 * 86400000, 'an ordinary sign-in: 30 days as before');
  assert.ok(F.sessionRead_(F.sessionMake_('a@b.c', 'x', 999 * 86400000)).left <= 30 * 86400000, 'never longer than 30 days');
  assert.ok(F.sessionRead_('a@b.c|abcdef012345|' + (Date.now() - 13 * 3600000) + '|43200000').left < 0, '13 hours old: ended');
  // the page's help for the new messages
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  for (const m of ['The Portal sign-in could not be accepted (it ran out – it is valid for one minute) – open the module again from the Portal.', 'The Portal could not sign you in here (several tries in a row). Open the Portal and choose the module again; if it keeps happening, tell the Admin.'])
    assert.ok(H.fixRules(m)[0] !== H.FIX_ANY && /Portal/.test(H.fixRules(m)[0].en.join(' ')), m);
  // the page: the old sign-in is hidden when linked, kept behind ?local=1; one "Modules" button
  assert.strictEqual((app.match(/id="site_chg"/g) || []).length, 1); assert.strictEqual((app.match(/id="grp_mods"/g) || []).length, 1); assert.ok(!/id="(mod_pill|site_pill|mod_chips)"/.test(app)); assert.strictEqual((app.match(/id="lg_portal"/g) || []).length, 1);
  assert.ok(/local=1/.test(app) && /ssoLogin/.test(app) && /#sso=/.test(app));
});

test('update-97: a water tanker trip by trip – many trips a day (Day / Night), the same challan of the agency or a time on another trip refused, billed per trip with its own Night rate (page = server)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  for (const [no, owner] of [['WT-1', 'Jal Agency'], ['WT-2', 'Jal Agency'], ['WT-3', 'Other Water Co']])
    assert.ok(!(run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: owner, ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-07-01' }, 'add') || {}).THROWN, no);
  for (const v of ['Jal Agency', 'Other Water Co']) run('(x, m) => saveVendor_(x, m)', { name: v, gstReg: 'No', pan: 'ABCPJ1234L', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  // the BOQ: a Night trip rate only on a Per Trip line; 0 is refused; on another rent type it is not kept
  assert.match(run('(x, m) => saveBoq_(x, m)', { vendor: 'Jal Agency', from: '2026-07-01', woNo: 'WO-WT', lines: [{ no: 'WT-1', basis: 'Per Trip', rate: 500, nightRate: 0, diesel: 'Company' }] }, 'add').THROWN || '', /Night trip rate must be more than 0/);
  assert.ok(!(run('(x, m) => saveBoq_(x, m)', { vendor: 'Jal Agency', from: '2026-07-01', woNo: 'WO-WT', lines: [{ no: 'WT-1', basis: 'Per Trip', rate: 500, nightRate: 700, diesel: 'Company' }, { no: 'WT-2', basis: 'Per Trip', rate: 500, diesel: 'Company' }] }, 'add') || {}).THROWN);
  assert.ok(!(run('(x, m) => saveBoq_(x, m)', { vendor: 'Other Water Co', from: '2026-07-01', woNo: 'WO-WT3', lines: [{ no: 'WT-3', basis: 'Monthly', rate: 30000, nightRate: 900, diesel: 'Company' }] }, 'add') || {}).THROWN);
  assert.deepStrictEqual(run('() => [boqRateFor_("Jal Agency", "WT-1", "2026-07-05").line.nightRate, boqRateFor_("Jal Agency", "WT-2", "2026-07-05").line.nightRate, boqRateFor_("Other Water Co", "WT-3", "2026-07-05").line.nightRate]'), [700, null, null]);
  // a machinery on another format: not a water tanker; Format I is set in Master → Log Book Format
  assert.match(run('x => saveTankerTrips_(x)', { no: 'WT-1', date: '2026-07-01', shift: 'Day', trips: [{ c: 'X', a: '08:00', b: '09:00' }] }).THROWN || '', /not a water tanker/);
  run('x => saveLbFormats_(x)', { 'WT-1': 'I', 'WT-2': 'I', 'WT-3': 'I' });
  // the usual entry page, Excel and the old ways do not take a water tanker
  const gen = run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-07-01', shift: 'Day', no: 'WT-1', mode: 'Trip', trip: 3 }] });
  assert.ok(!gen.ok && /is a water tanker \(Log Book Format I\)/.test(gen.errors[0].msg), JSON.stringify(gen));
  assert.match(JSON.stringify(run('x => importLogBook_(x)', { check: true, rows: [{ date: '2026-07-01', shift: 'Day', no: 'WT-1', mode: 'Trip', trip: 3 }] })), /is a water tanker/);
  const save = (no, date, shift, trips) => run('x => saveTankerTrips_(x)', { no: no, date: date, shift: shift, trips: trips.map(t => ({ c: t[0], a: t[1], b: t[2], ch: t[3] || '', u: t[4] || '' })) });
  const entry = (no, date, shift) => run('(n, d, s) => { const lt = table_(APP.SHEET_LOG, logHeaders_()), c = lt.c; const r = lt.rows.find(r => logKeyOf_(lt, r) === n + "|" + d + "|" + s); return r ? { trip: num0_(r[c[H.TRIP]]), challan: str_(r[c[H.CHALLAN]]), from: tStr_(r[c[H.TSTART]]), to: tStr_(r[c[H.TEND]]), ch: str_(r[c[H.CH]]), work: str_(r[c[H.WORK]]), unit: str_(r[c[H.UNIT]]), n: tankerTripsOf_(r[c[H.ITEMS]]).length } : null; }', no, date, shift);
  const count = () => run('() => table_(APP.SHEET_LOG, logHeaders_()).rows.filter(r => /^WT-/.test(str_(r[table_(APP.SHEET_LOG, logHeaders_()).c[H.NO]]))).length');
  // ---- many trips a day: the first two, then one more later the same day – ONE Day entry ----
  let r = save('WT-1', '2026-07-01', 'Day', [['CH-1', '08:00', '08:45', '12+500', 'Curing'], ['CH-2', '09:00', '09:40', '13+000', 'Dust suppression']]);
  assert.ok(r.ok && r.added === 2, JSON.stringify(r).slice(0, 300));
  r = save('WT-1', '2026-07-01', 'Day', [['CH-3', '10:00', '10:30', '13+000', 'Curing']]);
  assert.ok(r.ok && r.trips.length === 3, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(entry('WT-1', '2026-07-01', 'Day'), { trip: 3, challan: 'CH-1, CH-2, CH-3', from: '08:00', to: '10:30', ch: '12+500 / 13+000', work: 'Curing / Dust suppression', unit: 'Trip', n: 3 });
  // a Night shift with a trip after midnight (01:00 = the next morning of that night)
  r = save('WT-1', '2026-07-01', 'Night', [['CH-4', '21:00', '21:40'], ['CH-5', '01:00', '01:30']]);
  assert.ok(r.ok && r.trips.filter(t => t.shift === 'Night').length === 2);
  // ---- duplicates: nothing of that save is kept ----
  const n0 = count(), dup = (x, re) => { assert.match(x.THROWN || '', re); assert.strictEqual(count(), n0); };
  dup(save('WT-2', '2026-07-05', 'Day', [['CH-2', '08:00', '09:00']]), /DUPLICATE – this challan no of Jal Agency is already saved \(WT-1 01-07-2026 \(Day\)\)/);      // the same agency, another tanker and date
  dup(save('WT-1', '2026-07-01', 'Day', [['ch 7', '11:00', '11:30'], ['CH7', '12:00', '12:30']]), /DUPLICATE/);      // twice in one save (spaces and small letters do not matter)
  dup(save('WT-1', '2026-07-01', 'Day', [['CH-8', '08:30', '09:10']]), /DUPLICATE time – 08:30–09:10 falls on the trip 08:00–08:45 \(Day, challan CH-1\)/);
  dup(save('WT-1', '2026-07-01', 'Night', [['CH-9', '01:15', '01:45']]), /DUPLICATE time/);
  dup(save('WT-1', '2026-07-01', 'Day', [['CH-10', '09:30', '09:30']]), /Dispatch and Unload time are the same/);
  dup(save('WT-1', '2026-07-01', 'Day', [['', '11:00', '11:30']]), /enter the Challan No/);
  dup(save('WT-1', '2026-07-01', 'Day', [['CH-11', '11:00', '']]), /enter the Unload time/);
  dup(save('WT-1', '2026-07-01', 'Full Day', [['CH-12', '11:00', '11:30']]), /Pick the shift: Day or Night/);
  dup(save('WT-1', '2099-07-01', 'Day', [['CH-12', '11:00', '11:30']]), /./);
  // another agency may have the same challan no; a trip that only touches another (08:45 → 09:00) is fine
  assert.ok(save('WT-3', '2026-07-02', 'Day', [['CH-2', '08:00', '09:00']]).ok);
  assert.ok(save('WT-1', '2026-07-01', 'Day', [['CH-6', '08:45', '09:00']]).ok);
  r = run('(n, d) => getTankerTrips_(n, d)', 'WT-1', '2026-07-01');
  assert.deepStrictEqual(r.trips.map(t => t.shift + ' ' + t.c + ' ' + t.a), ['Day CH-1 08:00', 'Day CH-6 08:45', 'Day CH-2 09:00', 'Day CH-3 10:00', 'Night CH-4 21:00', 'Night CH-5 01:00']);
  // ---- a trip deleted; the last trip of a shift takes its entry with it ----
  r = run('x => deleteTankerTrip_(x)', { no: 'WT-1', date: '2026-07-01', shift: 'Day', c: 'ch-6' });
  assert.ok(r.ok && r.gone.c === 'CH-6' && entry('WT-1', '2026-07-01', 'Day').trip === 3);
  save('WT-2', '2026-07-02', 'Night', [['N-1', '22:00', '22:30']]);
  r = run('x => deleteTankerTrip_(x)', { no: 'WT-2', date: '2026-07-02', shift: 'Night', c: 'N-1' });
  assert.ok(r.ok && entry('WT-2', '2026-07-02', 'Night') === null && r.trips.length === 0);
  assert.match(run('x => deleteTankerTrip_(x)', { no: 'WT-1', date: '2026-07-01', shift: 'Day', c: 'NOPE' }).THROWN || '', /This trip was not found/);
  // ---- Edit Log Book / the edit window change nothing of a water tanker; Edit Log Book may delete a whole entry ----
  const ed = run('() => getLogEditData_("WT-1", "2026-07-01", "2026-07-01")');
  const rows = (ed.rows || []).map(x => ({ key: x.key, same: true, date: x.date, shift: x.shift, mode: x.mode, trip: x.trip }));
  assert.match(run('b => saveLogBulk_(b)', { no: 'WT-1', from: '2026-07-01', to: '2026-07-01', rows: rows.map((x, i) => i ? x : Object.assign({}, x, { same: false, trip: 9 })), deleted: [] }).THROWN || '', /Edit Log Book can only delete its entries/);
  assert.match(run('(k, l) => updateLogRow_(k, l)', 'WT-1|2026-07-01|Day', { trip: 9 }).THROWN || '', /is a water tanker/);
  assert.strictEqual(entry('WT-1', '2026-07-01', 'Day').trip, 3);
  // ---- the bill: Day trips at 500, Night trips at 700 (WT-1); WT-2 has no Night rate – every trip at 500 ----
  save('WT-2', '2026-07-03', 'Day', [['W2-1', '08:00', '08:30']]); save('WT-2', '2026-07-03', 'Night', [['W2-2', '20:00', '20:30'], ['W2-3', '23:50', '00:20']]);
  const from = '2026-07-01', to = '2026-07-31';
  const logs = run('x => getLogBookList_(x)', { from, to, all: true }), extra = run('x => logPrintExtra_(x)', { from, to, nos: ['WT-1', 'WT-2'] });
  const byNo = {}; logs.rows.forEach(x => (byNo[x.no] = byNo[x.no] || []).push(x));
  const srv = no => run('(no, L, e, f, t) => billMachineCalc_(findMachine_(no), L, e, f, t, undefined, true)', no, byNo[no], extra, from, to);
  const b1 = srv('WT-1'), b2 = srv('WT-2');
  assert.strictEqual(b1.amount, 3 * 500 + 2 * 700, JSON.stringify(b1).slice(0, 400));
  assert.strictEqual(b2.amount, 3 * 500);
  // the page works the bill out by itself – the same figures
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const grab = m => { const i = app.indexOf(m); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const dayPartSrc = (app.match(/const dayPart = (r => [^\n]+?);\n/) || [])[1];
  const env = { dayPart: new Function('return ' + dayPartSrc)(), r2: n => Math.round(n * 100) / 100, hasKm: u => u === 'KM' || u === 'KM + Hrs', hasHr: u => u === 'Hrs' || u === 'KM + Hrs', isHol: r => ['Holiday', 'Breakdown'].indexOf(r.mode || r.unit) > -1,
    showDate: d => d.split('-').reverse().join('/'), fmt: String, DAY_STATUS: ['Idle', 'Holiday', 'Breakdown'], METER_OFF: 'No reading', isoDate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), ITEM_WORD: { hr: 'hr', km: 'km', trip: 'trips' }, dieselDebitDay: (vt, bd, m) => bd ? bd.diesel === 'Debit Basis' : !!(m && m.supply === 'Debit Basis'), findMachine: no => run('n => findMachine_(n)', no) };
  const C = new Function(...Object.keys(env), grab('function itemDaySegs(') + '\n' + grab('function tankLeft(') + '\n' + grab('function mbMachine(') + '; return { mbMachine };')(...Object.values(env));
  const p1 = C.mbMachine('WT-1', byNo['WT-1'], extra, from, to, undefined, true);
  assert.strictEqual(p1.amount, b1.amount); assert.strictEqual(C.mbMachine('WT-2', byNo['WT-2'], extra, from, to, undefined, true).amount, b2.amount);
  assert.deepStrictEqual(p1.lines.map(x => x.unit + ' ' + x.qty + ' × ' + x.rate), ['Trips 3 × 500', 'Night trips 2 × 700']);
  // the page: Format I in its lists, its print columns, the form and the Night rate in the BOQ form
  assert.match(app, /\{ id: 'I', name: 'Format I – Water tanker \(trip by trip\)'/);
  assert.match(app, /I: \['sr', 'date', 'shift', 'agency', 'vehno', 'challan', 'dspT', 'unlT', 'trip', 'chno', 'usefor'\]/);
  for (const id of ['wt_form', 'wt_date', 'wt_shift', 'wt_no', 'wt_in', 'wt_save', 'wt_saved', 'wt_tot']) assert.strictEqual((app.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
  assert.match(app, /data-lgmode="tanker"/); assert.match(app, /data-bl="nightRate"/); assert.match(app, /'DAY TRIPS'/); assert.match(app, /'NIGHT TRIPS'/);
});
test('update-103: a water tanker – more trips in the same Day / Night join an entry made before trip by trip (no error); Full Day + Night; Idle refused (page = server)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  for (const no of ['WT-7', 'WT-8'])
    assert.ok(!(run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'Neer Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add') || {}).THROWN, no);
  run('(x, m) => saveVendor_(x, m)', { name: 'Neer Agency', gstReg: 'No', pan: 'ABCPN1234L', bank: 'SBI', account: '12345679', ifsc: 'SBIN0000001' }, 'add');
  assert.ok(!(run('(x, m) => saveBoq_(x, m)', { vendor: 'Neer Agency', from: '2026-08-01', woNo: 'WO-NA', lines: [{ no: 'WT-7', basis: 'Per Trip', rate: 400, diesel: 'Company' }, { no: 'WT-8', basis: 'Per Trip', rate: 400, diesel: 'Company' }] }, 'add') || {}).THROWN);
  // entries made the usual way BEFORE the tanker was put on trip by trip (as on site: 17-09 Day, Trip 1, challan, its times)
  const old = rows => { const x = run('x => saveLogRowsInner_(x)', { rows: rows }); assert.ok(x.ok, JSON.stringify(x).slice(0, 400)); };
  old([{ date: '2026-08-10', shift: 'Day', no: 'WT-7', mode: 'Trip', trip: 1, challan: '18521', tStart: '08:00', tEnd: '09:00', work: 'Curing' },
       { date: '2026-08-11', shift: 'Full Day', no: 'WT-8', mode: 'Trip', trip: 3, challan: '501, 502' },
       { date: '2026-08-12', shift: 'Full Day', no: 'WT-7', mode: 'Idle' },
       { date: '2026-08-13', shift: 'Day', no: 'WT-7', mode: 'Trip', trip: 1, challan: 'L-1', tStart: '07:00', tEnd: '07:30' }]);
  run('x => saveLbFormats_(x)', { 'WT-7': 'I', 'WT-8': 'I' });
  const save = (no, date, shift, trips) => run('x => saveTankerTrips_(x)', { no: no, date: date, shift: shift, trips: trips.map(t => ({ c: t[0], a: t[1], b: t[2], ch: t[3] || '', u: t[4] || '' })) });
  const entry = (no, date, shift) => run('(n, d, s) => { const lt = table_(APP.SHEET_LOG, logHeaders_()), c = lt.c; const r = lt.rows.find(r => logKeyOf_(lt, r) === n + "|" + d + "|" + s); return r ? { trip: num0_(r[c[H.TRIP]]), challan: str_(r[c[H.CHALLAN]]), from: tStr_(r[c[H.TSTART]]), to: tStr_(r[c[H.TEND]]), n: (tankerTripsOf_(r[c[H.ITEMS]]) || []).length } : null; }', no, date, shift);
  const count = () => run('() => { const lt = table_(APP.SHEET_LOG, logHeaders_()); return lt.rows.filter(r => /^WT-[78]$/.test(str_(r[lt.c[H.NO]]))).length; }');
  // ---- the old Day entry is shown as its trip (marked), not as an error ----
  let r = run('(n, d) => getTankerTrips_(n, d)', 'WT-7', '2026-08-10');
  assert.strictEqual(r.other, ''); assert.deepStrictEqual(r.trips.map(t => [t.shift, t.c, t.a, t.b, t.old]), [['Day', '18521', '08:00', '09:00', 1]]);
  // ---- more Day trips the same day: they JOIN that entry (one entry, as always) ----
  const n0 = count();
  r = save('WT-7', '2026-08-10', 'Day', [['18523', '10:00', '10:30'], ['18524', '11:00', '11:40']]);
  assert.ok(r.ok && r.added === 2 && r.trips.length === 3, JSON.stringify(r).slice(0, 400));
  assert.deepStrictEqual(entry('WT-7', '2026-08-10', 'Day'), { trip: 3, challan: '18521, 18523, 18524', from: '08:00', to: '11:40', n: 3 });
  assert.strictEqual(count(), n0, 'no second entry');
  // the old trip still counts: its challan and its time are not taken again
  assert.match(save('WT-7', '2026-08-10', 'Day', [['18521', '12:00', '12:30']]).THROWN || '', /DUPLICATE – this challan no of Neer Agency/);
  assert.match(save('WT-7', '2026-08-10', 'Day', [['18530', '08:30', '08:50']]).THROWN || '', /DUPLICATE time – 08:30–08:50 falls on the trip 08:00–09:00 \(Day, challan 18521\)/);
  // ---- Night trips of that day: their own Night entry ----
  r = save('WT-7', '2026-08-10', 'Night', [['N-71', '21:00', '21:30'], ['N-72', '00:30', '01:00']]);
  assert.ok(r.ok && r.trips.filter(t => t.shift === 'Night').length === 2 && entry('WT-7', '2026-08-10', 'Night').trip === 2);
  // ---- an old Full Day entry (3 trips, two challans, no time): Day trips join it; Night trips make it the Day shift ----
  r = run('(n, d) => getTankerTrips_(n, d)', 'WT-8', '2026-08-11');
  assert.deepStrictEqual(r.trips.map(t => [t.shift, t.c, t.a, t.old]), [['Full Day', '501', '', 1], ['Full Day', '502', '', 1], ['Full Day', '', '', 1]]);
  r = save('WT-8', '2026-08-11', 'Day', [['503', '08:00', '09:00']]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 400));
  assert.deepStrictEqual(entry('WT-8', '2026-08-11', 'Full Day'), { trip: 4, challan: '503, 501, 502', from: '08:00', to: '09:00', n: 4 });
  r = save('WT-8', '2026-08-11', 'Night', [['601', '21:00', '21:30']]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 400));
  assert.strictEqual(entry('WT-8', '2026-08-11', 'Full Day'), null);
  assert.deepStrictEqual([entry('WT-8', '2026-08-11', 'Day').trip, entry('WT-8', '2026-08-11', 'Night').trip], [4, 1]);
  // a trip of the old entry taken out (the one without a challan, then one with)
  r = run('x => deleteTankerTrip_(x)', { no: 'WT-8', date: '2026-08-11', shift: 'Day', c: '' });
  assert.ok(r.ok && entry('WT-8', '2026-08-11', 'Day').trip === 3);
  // an old entry of ONE trip deleted from the form: the entry goes
  r = run('x => deleteTankerTrip_(x)', { no: 'WT-7', date: '2026-08-13', shift: 'Day', c: 'l-1' });
  assert.ok(r.ok && r.gone.c === 'L-1' && entry('WT-7', '2026-08-13', 'Day') === null);
  // ---- an Idle / Holiday / Breakdown day has no trips: refused, and said why ----
  const n1 = count();
  assert.match(save('WT-7', '2026-08-12', 'Day', [['I-1', '08:00', '09:00']]).THROWN || '', /Full Day \(Idle\) entry on this date – a day without trips/);
  assert.strictEqual(count(), n1);
  assert.match(run('(n, d) => getTankerTrips_(n, d)', 'WT-7', '2026-08-12').other, /a day without trips/);
  // ---- Edit Log Book still changes nothing of a tanker ----
  assert.match(run('(k, l) => updateLogRow_(k, l)', 'WT-7|2026-08-10|Day', { trip: 9 }).THROWN || '', /is a water tanker/);
  // ---- the page: old trips marked, the same checks; Edit Log Book adds no row for a tanker; help in 3 languages ----
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.ok(/entered before trip by trip/.test(app) && /if \(m\.lbFormat === 'I'\) \{ await ltLoad\(m\); return; \}/.test(app));      // (update-104: Edit Log Book opens a tanker as its trips, with + Add row)
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  for (const m of ['WT-7 (12-08-2026, Day): the tanker has a Full Day (Idle) entry on this date – a day without trips. If it made trips, delete that entry in Edit Log Book first.'])
    { const h = H.fixRules(m)[0]; assert.ok(h !== H.FIX_ANY && /Idle/.test(h.en.join(' ')) && h.mr && h.hi, m); }
  assert.ok(!/not made trip by trip/.test(fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8').replace(/\/\/[^\n]*/g, '')), 'the old refusal is gone');
});

test('update-104: a water tanker in Edit Log Book – one row per trip, rows added / changed / taken out; Excel import of trips (bulk); AI slowness is not a database fault; the app opens a page without eval', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  for (const no of ['WT-11', 'WT-12'])
    assert.ok(!(run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'Pani Agency', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add') || {}).THROWN, no);
  run('(x, m) => saveVendor_(x, m)', { name: 'Pani Agency', gstReg: 'No', pan: 'ABCPP1234L', bank: 'SBI', account: '12345671', ifsc: 'SBIN0000001' }, 'add');
  assert.ok(!(run('(x, m) => saveBoq_(x, m)', { vendor: 'Pani Agency', from: '2026-08-01', woNo: 'WO-PA', lines: [{ no: 'WT-11', basis: 'Per Trip', rate: 450, diesel: 'Company' }, { no: 'WT-12', basis: 'Per Trip', rate: 450, diesel: 'Company' }] }, 'add') || {}).THROWN);
  const old = rows => { const x = run('x => saveLogRowsInner_(x)', { rows: rows }); assert.ok(x.ok, JSON.stringify(x).slice(0, 400)); };
  old([{ date: '2026-08-20', shift: 'Day', no: 'WT-11', mode: 'Trip', trip: 1, challan: 'P-1', tStart: '08:00', tEnd: '08:40' },
       { date: '2026-08-21', shift: 'Full Day', no: 'WT-11', mode: 'Trip', trip: 2, challan: 'P-21, P-22' },
       { date: '2026-08-23', shift: 'Full Day', no: 'WT-11', mode: 'Holiday' }]);
  run('x => saveLbFormats_(x)', { 'WT-11': 'I', 'WT-12': 'I' });
  assert.ok(run('x => saveTankerTrips_(x)', { no: 'WT-12', date: '2026-08-20', shift: 'Day', trips: [{ c: 'Q-9', a: '07:00', b: '07:30' }] }).ok);
  const entry = (no, date, shift) => run('(n, d, s) => { const lt = table_(APP.SHEET_LOG, logHeaders_()), c = lt.c; const r = lt.rows.find(r => logKeyOf_(lt, r) === n + "|" + d + "|" + s); return r ? { trip: num0_(r[c[H.TRIP]]), challan: str_(r[c[H.CHALLAN]]), from: tStr_(r[c[H.TSTART]]), to: tStr_(r[c[H.TEND]]), n: (tankerTripsOf_(r[c[H.ITEMS]]) || []).length } : null; }', no, date, shift);
  const range = () => run('() => getTankerRange_("WT-11", "2026-08-20", "2026-08-23")');
  const save = trips => run('x => saveTankerRange_(x)', { no: 'WT-11', from: '2026-08-20', to: '2026-08-23', trips: trips });
  // ---- Edit Log Book: the trips one per row (an older entry's too), the Holiday apart ----
  let g = range();
  assert.deepStrictEqual(g.trips.map(t => [t.date, t.shift, t.c, t.a, t.old]), [['2026-08-20', 'Day', 'P-1', '08:00', 1], ['2026-08-21', 'Full Day', 'P-21', '', 1], ['2026-08-21', 'Full Day', 'P-22', '', 1]]);
  assert.deepStrictEqual(g.days.map(d => d.date + ' ' + d.status), ['2026-08-23 Holiday']);
  // nothing changed: nothing written (the older entries stay as they were)
  let r = save(g.trips); assert.ok(r.ok && r.changed === 0 && r.added === 0, JSON.stringify(r).slice(0, 300));
  // ---- + Add row: a trip more on the same Day, and a new date (Night) ----
  r = save(g.trips.concat([{ date: '2026-08-20', shift: 'Day', c: 'P-2', a: '10:00', b: '10:30', ch: '5+200', u: 'Curing' }, { date: '2026-08-22', shift: 'Night', c: 'P-3', a: '21:00', b: '21:30' }]));
  assert.ok(r.ok && r.added === 2 && r.removed === 0 && r.trips.length === 5, JSON.stringify(r).slice(0, 400));
  assert.deepStrictEqual(entry('WT-11', '2026-08-20', 'Day'), { trip: 2, challan: 'P-1, P-2', from: '08:00', to: '10:30', n: 2 });
  assert.deepStrictEqual(entry('WT-11', '2026-08-22', 'Night'), { trip: 1, challan: 'P-3', from: '21:00', to: '21:30', n: 1 });
  assert.strictEqual(entry('WT-11', '2026-08-21', 'Full Day').n, 0, 'the untouched older Full Day entry is not rewritten');
  // ---- refused, nothing saved ----
  g = range(); const plus = x => save(g.trips.concat([x]));
  assert.match(plus({ date: '2026-08-22', shift: 'Day', c: 'Q-9', a: '11:00', b: '11:30' }).THROWN || '', /Row 6: .*DUPLICATE – this challan no of Pani Agency is already saved \(WT-12 20-08-2026 \(Day\)\)/);
  assert.match(plus({ date: '2026-08-20', shift: 'Day', c: 'P-4', a: '10:10', b: '10:20' }).THROWN || '', /DUPLICATE time – 10:10–10:20 falls on the trip 10:00–10:30/);
  assert.match(plus({ date: '2026-08-20', shift: 'Day', c: 'P-4', a: '12:00', b: '' }).THROWN || '', /Row 6: WT-11 \(20-08-2026, Day\) challan P-4: enter the Unload time/);
  assert.match(plus({ date: '2026-08-20', shift: 'Day', c: 'p-2 ', a: '12:00', b: '12:30' }).THROWN || '', /challan p-2 is twice on 20-08-2026/);
  assert.match(plus({ date: '2026-08-23', shift: 'Day', c: 'P-5', a: '12:00', b: '12:30' }).THROWN || '', /Full Day \(Holiday\) entry on this date – a day without trips/);
  assert.match(plus({ date: '2026-09-01', shift: 'Day', c: 'P-5', a: '12:00', b: '12:30' }).THROWN || '', /is not between 20-08-2026 and 23-08-2026/);
  assert.strictEqual(range().trips.length, 5);
  // ---- a row changed and a row taken out; a Night trip on the Full Day date (it becomes the Day); a date emptied (its entry goes) ----
  g = range();
  const t2 = g.trips.map(t => t.c === 'P-1' ? Object.assign({}, t, { a: '07:30', b: '08:10' }) : t).filter(t => t.c !== 'P-2' && t.c !== 'P-3').concat([{ date: '2026-08-21', shift: 'Night', c: 'P-23', a: '22:00', b: '22:30' }]);
  r = save(t2);
  assert.ok(r.ok && r.added === 2 && r.removed === 3, JSON.stringify(r).slice(0, 400));
  assert.deepStrictEqual(entry('WT-11', '2026-08-20', 'Day'), { trip: 1, challan: 'P-1', from: '07:30', to: '08:10', n: 1 });
  assert.strictEqual(entry('WT-11', '2026-08-22', 'Night'), null);
  assert.deepStrictEqual([entry('WT-11', '2026-08-21', 'Full Day'), entry('WT-11', '2026-08-21', 'Day').trip, entry('WT-11', '2026-08-21', 'Night').trip], [null, 2, 1]);
  // ---- Excel: trips of two tankers ADDED; one already saved is skipped; checked first, then all or none ----
  const imp = (rows, check) => run('x => importTankerTrips_(x)', { rows: rows, check: check });
  const file = [{ line: 2, no: 'WT-11', date: '2026-08-20', shift: 'Day', c: 'P-1', a: '07:30', b: '08:10' },      // already saved
    { line: 3, no: 'WT-11', date: '2026-08-20', shift: 'Day', c: 'P-6', a: '09:00', b: '09:30', ch: '6+000', u: 'Curing' },
    { line: 4, no: 'wt-12', date: '2026-08-24', shift: 'Night', c: 'Q-10', a: '23:30', b: '00:15' },
    { line: 5, no: 'WT-12', date: '2026-08-24', shift: 'Day', c: 'Q-11', a: 0.375, b: '9:45 AM' }];      // (an Excel time is a part of a day: 0.375 = 09:00)
  r = imp(file, true);
  assert.ok(r.ok && r.check && r.added === 3 && r.same === 1 && r.tankers === 2, JSON.stringify(r));
  assert.strictEqual(entry('WT-12', '2026-08-24', 'Day'), null, 'the check saves nothing');
  r = imp(file.concat([{ line: 6, no: 'WT-12', date: '2026-08-25', shift: 'Day', c: 'P-6', a: '10:00', b: '10:30' }]));
  assert.ok(!r.ok && r.errors.length === 1 && r.errors[0].row === '6' && /DUPLICATE – this challan no of Pani Agency is already saved \(WT-11 20-08-2026 \(Day\)\)/.test(r.errors[0].msg), JSON.stringify(r));
  assert.strictEqual(entry('WT-12', '2026-08-24', 'Day'), null, 'one bad line: nothing imported');
  r = imp([{ line: 2, no: 'EX-NOT', date: '2026-08-24', shift: 'Day', c: 'Z', a: '08:00', b: '09:00' }]);
  assert.ok(!r.ok && r.errors[0].row === 2 && /not in Master/.test(r.errors[0].msg), JSON.stringify(r));
  r = imp(file);
  assert.ok(r.ok && r.added === 3 && r.same === 1, JSON.stringify(r));
  assert.deepStrictEqual(entry('WT-11', '2026-08-20', 'Day'), { trip: 2, challan: 'P-1, P-6', from: '07:30', to: '09:30', n: 2 });
  assert.deepStrictEqual([entry('WT-12', '2026-08-24', 'Day'), entry('WT-12', '2026-08-24', 'Night')].map(x => x && x.challan + ' ' + x.from + '-' + x.to), ['Q-11 09:00-09:45', 'Q-10 23:30-00:15']);
  r = imp(file); assert.ok(r.ok && r.added === 0 && r.same === 4, 'the same file again: nothing added');
  // ---- the AI's line: a call that ran out of time is the AI's slowness, not the database (no fault, not asked again) ----
  const gas = fs.readFileSync(path.join(root, 'server', 'gas.js'), 'utf8');
  assert.ok(/did not answer in time\/i\.test\(err\) \? 'the AI service was too slow to answer'/.test(gas));
  const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8'), DBF = new RegExp(code.match(/const DB_FAULT_ = \/(.+)\/;/)[1]);
  assert.ok(!DBF.test('The AI could not read the meter now (the AI service was too slow to answer) – type the reading.') && DBF.test('The database did not answer in time.'));
  // ---- the page: Edit Log Book of a tanker (+ Add row, Export / Import), help in 3 languages; the app's page door ----
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.ok(/window\.rclGo = p =>/.test(app) && /id="lt_add"/.test(app) && /id="lt_export"/.test(app) && /id="lt_import"/.test(app));
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  for (const m of ['Row 6: WT-11 (20-08-2026, Day) challan p 2: DUPLICATE – challan p 2 is twice on 20-08-2026. Not saved.', 'Row 6: 01-09-2026 is not between 20-08-2026 and 23-08-2026 – open those dates.', 'No trips in the file.', 'At most 3000 trips in one save.'])
    { const h = H.fixRules(m)[0]; assert.ok(h !== H.FIX_ANY && h.mr && h.hi, m); }
  const guide = app.slice(app.indexOf('logedit: { saves: ['), app.indexOf(']', app.indexOf('logedit: { saves: [')));
  assert.ok(['saveTankerRange', 'importTankerTrips'].every(a => guide.indexOf("'" + a + "'") > -1), guide);
});

test('update-105: a water tanker – each trip its own line in the Log Book with Edit / Delete; a saved trip changed (also its shift, also an older entry\'s trip)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  for (const no of ['WT-21', 'WT-22'])
    assert.ok(!(run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Water Tanker', type: 'Water Tanker', unit: 'Trip', worksOn: ['Trip'], owner: 'Jal Seva', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add') || {}).THROWN, no);
  run('(x, m) => saveVendor_(x, m)', { name: 'Jal Seva', gstReg: 'No', pan: 'ABCPJ1234S', bank: 'SBI', account: '12345673', ifsc: 'SBIN0000001' }, 'add');
  assert.ok(!(run('(x, m) => saveBoq_(x, m)', { vendor: 'Jal Seva', from: '2026-08-01', woNo: 'WO-JS', lines: [{ no: 'WT-21', basis: 'Per Trip', rate: 450, diesel: 'Company' }, { no: 'WT-22', basis: 'Per Trip', rate: 450, diesel: 'Company' }] }, 'add') || {}).THROWN);
  assert.ok(run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-08-15', shift: 'Day', no: 'WT-21', mode: 'Trip', trip: 1, challan: '18522', tStart: '10:30', tEnd: '10:36', work: 'PQC curing' }] }).ok);
  run('x => saveLbFormats_(x)', { 'WT-21': 'I', 'WT-22': 'I' });
  const save = (no, date, shift, trips) => run('x => saveTankerTrips_(x)', { no: no, date: date, shift: shift, trips: trips.map(t => ({ c: t[0], a: t[1], b: t[2] })) });
  const upd = x => run('x => updateTankerTrip_(x)', x);
  const entry = (no, date, shift) => run('(n, d, s) => { const lt = table_(APP.SHEET_LOG, logHeaders_()), c = lt.c; const r = lt.rows.find(r => logKeyOf_(lt, r) === n + "|" + d + "|" + s); return r ? { trip: num0_(r[c[H.TRIP]]), challan: str_(r[c[H.CHALLAN]]), from: tStr_(r[c[H.TSTART]]), to: tStr_(r[c[H.TEND]]) } : null; }', no, date, shift);
  // his case: an older Day entry (18522) and one more trip (123) the same day
  assert.ok(save('WT-21', '2026-08-15', 'Day', [['123', '07:35', '07:50']]).ok);
  let g = run('(n, d) => getTankerTrips_(n, d)', 'WT-21', '2026-08-15');
  assert.deepStrictEqual(g.trips.map(t => [t.shift, t.n, t.c]), [['Day', 1, '123'], ['Day', 2, '18522']]);
  // ---- a trip changed: its times and challan ----
  let r = upd({ no: 'WT-21', date: '2026-08-15', shift: 'Day', n: 1, c: '123', trip: { c: '124', a: '07:40', b: '08:00', ch: '3+100', u: 'Curing' } });
  assert.ok(r.ok && r.was.c === '123', JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(entry('WT-21', '2026-08-15', 'Day'), { trip: 2, challan: '124, 18522', from: '07:40', to: '10:36' });
  // ---- the older entry's trip changed (it becomes an ordinary trip) ----
  r = upd({ no: 'WT-21', date: '2026-08-15', shift: 'Day', n: 2, c: '18522', trip: { c: '18522', a: '10:30', b: '10:40', ch: 'VTR', u: 'PQC curing' } });
  assert.ok(r.ok && r.trips.every(t => !t.old) && entry('WT-21', '2026-08-15', 'Day').to === '10:40', JSON.stringify(r).slice(0, 300));
  // ---- moved to the Night: the Day keeps the other trip, the Night gets an entry ----
  r = upd({ no: 'WT-21', date: '2026-08-15', shift: 'Day', n: 1, c: '124', trip: { c: '124', a: '21:00', b: '21:20' }, to: 'Night' });
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual([entry('WT-21', '2026-08-15', 'Day').challan, entry('WT-21', '2026-08-15', 'Night').challan], ['18522', '124']);
  // ---- refused, nothing changed ----
  assert.ok(save('WT-22', '2026-08-16', 'Day', [['999', '09:00', '09:30']]).ok);
  assert.match(upd({ no: 'WT-21', date: '2026-08-15', shift: 'Night', n: 1, c: '124', trip: { c: '999', a: '21:00', b: '21:20' } }).THROWN || '', /DUPLICATE – this challan no of Jal Seva is already saved \(WT-22 16-08-2026 \(Day\)\)/);
  assert.match(upd({ no: 'WT-21', date: '2026-08-15', shift: 'Night', n: 1, c: '124', trip: { c: '125', a: '21:00', b: '' } }).THROWN || '', /enter the Unload time/);
  assert.match(upd({ no: 'WT-21', date: '2026-08-15', shift: 'Night', n: 1, c: '124', trip: { c: '124', a: '10:35', b: '10:50' }, to: 'Day' }).THROWN || '', /DUPLICATE time/);
  assert.match(upd({ no: 'WT-21', date: '2026-08-15', shift: 'Night', n: 1, c: 'OTHER', trip: { c: '125', a: '21:00', b: '21:10' } }).THROWN || '', /This trip was not found/);
  assert.match(upd({ no: 'WT-21', date: '2026-08-15', shift: 'Night', n: 4, c: '124', trip: { c: '125', a: '21:00', b: '21:10' } }).THROWN || '', /This trip was not found/);
  assert.strictEqual(entry('WT-21', '2026-08-15', 'Night').challan, '124');
  // ---- the page: the list shows a line per trip (Edit / Delete), the saved trips have Edit; the help; the page guide ----
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const fn = app.slice(app.indexOf('  function tripsOfRow(r) {'), app.indexOf('  // Edit: the trip opens in Log Book'));
  const tripsOfRow = new Function('findMachine', fn + '; return tripsOfRow;')(no => ({ lbFormat: /^WT/.test(no) ? 'I' : 'A' }));
  assert.deepStrictEqual(tripsOfRow({ no: 'WT-21', unit: 'Trip', itemWork: { _trips: [{ c: '124', a: '07:40', b: '08:00' }, { c: '18522', a: '10:30', b: '10:36' }] } }).map(t => t.c), ['124', '18522']);
  assert.deepStrictEqual(tripsOfRow({ no: 'WT-21', unit: 'Trip', itemWork: {}, trip: 1, challan: '18521', tStart: '13:00', tEnd: '13:18', chainage: '', chFrom: 'VTR', chTo: '', work: 'Water' }),
    [{ c: '18521', a: '13:00', b: '13:18', ch: 'VTR', u: 'Water', old: 1 }], 'an older entry: its one trip with its time (as the server reads it)');
  assert.strictEqual(tripsOfRow({ no: 'EX-1', unit: 'Trip', trip: 3 }), null, 'other machinery: one line as before');
  assert.ok(/data-tedit/.test(app) && /data-wtedit/.test(app) && /call\('updateTankerTrip'/.test(app));
  const guide = app.slice(app.indexOf('    log: { saves: ['), app.indexOf(']', app.indexOf('    log: { saves: [')));
  assert.ok(guide.indexOf("'updateTankerTrip'") > -1);
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  assert.ok(H.fixRules('This trip was not found (it may have been changed by someone else). Open the tanker again.')[0] !== H.FIX_ANY);
});

test('update-106 → update-111: every site its own vendors – step 1y stays listed, no site is asked by another, nothing copied, help in 3 languages', () => {
  const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8'), app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), rt = fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8');
  // the SQL step 1y (owner_site) stays: it only added a column; listed word for word in Read Me
  const sqlFile = fs.readFileSync(path.join(root, 'sql', 'supabase_step1y_vendor_owner.sql'), 'utf8');
  assert.ok(/alter table public\.vendors add column if not exists owner_site text;/.test(sqlFile) && !/\b(drop|delete|truncate|update)\b[^\n]*;/i.test(sqlFile.replace(/^--.*$/gm, '')));
  const listed = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1y_vendor_owner.sql');
  assert.ok(listed && listed.sql === sqlFile && /owner_site/.test(listed.about));
  assert.ok(/\['Owner Site', 'owner_site', 'text'\]/.test(fs.readFileSync(path.join(root, 'app', 'SupabaseSync.gs'), 'utf8')));
  // (update-111) one site asks the others nothing any more; nothing is copied; no "Vendors of all sites"
  assert.ok(/const OTHERS_ = new Set\(\['sysPrefLang'\]\);/.test(rt) && !/sysVendor/.test(rt) && !/sysVendor|vendorSpread_|vendorsTogether|othersAsk_|vendorGuard_/.test(code));
  assert.ok(!/vOtherSite|vendorsTogether|id="v_all"|id="v_share"|\.mine ===/.test(app));
  const guide = app.slice(app.indexOf('    vendors: { saves: ['), app.indexOf(']', app.indexOf('    vendors: { saves: [')));
  assert.ok(guide.indexOf("'vendorsTogether'") === -1 && guide.indexOf("'saveVendor'") > -1);
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  { const h = H.fixRules('V111 Copy is not a vendor of this site.')[0]; assert.ok(h !== H.FIX_ANY && h.mr && h.hi && /own vendors/.test(h.en.join(' '))); }
});

test('update-111: a copy of another site\'s vendor is not shown, picked or changed here – unless this site already uses it (asset, BOQ, bill …); a new vendor of that name is this site\'s own', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // this site = S1; the database is asked who is billed: "V111 Billed" has a bill here
  require('vm').runInContext(`__siteCode = () => 'S1'; var __sbReal = sbFetch_; var __asked = [];
    sbFetch_ = function (m, url, body, h) { const u = decodeURIComponent(String(url));
      if (/\\/rest\\/v1\\/(bills|payments|debit_notes|log_book)\\?select=/.test(u)) { __asked.push(u); return /bills/.test(u) && /V111 Billed/.test(u) ? [{ vendor_name: 'V111 Billed' }] : []; }
      if (/\\/rest\\/v1\\/vendors\\?select=owner_site/.test(u)) return [];      // (the column is there)
      return __sbReal(m, url, body, h); }; CacheService.getScriptCache().remove('SBCOL_vendors.owner_site');`, ctx);
  try {
    assert.strictEqual(run('() => vendorOwnOn_()'), true, 'the column is there');
    const det = { gstReg: 'No', pan: 'ABCDE1234K', bank: 'SBI', account: '12345688', ifsc: 'SBIN0000001' };
    run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'V111 Own' }, det), 'add');
    // copies that update-106 wrote here from site S2
    run(`() => { const t = table_(APP.SHEET_VENDORS, VENDOR_COLS_); ['V111 Copy', 'V111 Billed', 'V111 Asset'].forEach(n => { const row = newRow_(t); set_(row, t, 'Vendor Name', n); set_(row, t, 'Owner Site', 'S2'); set_(row, t, 'GST Registered', 'No'); t.sh.appendRow(row); }); TABLE_MEMO_ = {}; }`);
    run('(x, m) => saveMaster_(x, m)', { no: 'V111-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'V111 Asset', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
    const names = run('() => getVendors_().filter(v => /^V111/.test(v.name)).map(v => v.name + (v.saved ? "" : " (not saved)"))');
    assert.deepStrictEqual(names, ['V111 Asset', 'V111 Billed', 'V111 Own'], 'the copy no one uses here is not shown; the billed one and the asset owner are');
    assert.deepStrictEqual(run('() => vendorNames_().filter(n => /^V111/.test(n))'), ['V111 Asset', 'V111 Billed', 'V111 Own'], 'the parties to pick (Debit to)');
    assert.match(run('() => logDebit_({ debitTo: "V111 Copy", debitRate: 50 })').THROWN, /not in the Vendor Master/, 'cannot be charged here');
    assert.match(run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'V111 Copy X', oldName: 'V111 Copy' }, det), 'edit').THROWN, /^V111 Copy is not a vendor of this site\.$/);
    assert.match(run('n => deleteVendor_(n)', 'V111 Copy').THROWN, /has no saved details/, 'not deleted from here');
    // a NEW vendor with that name: this site's own (the copy's row is taken over – nothing is added twice, nothing deleted)
    const r = run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'V111 Copy' }, det), 'add');
    assert.ok(r.ok && r.vendors.some(v => v.name === 'V111 Copy'), JSON.stringify(r).slice(0, 200));
    assert.deepStrictEqual(run(`() => { const t = table_(APP.SHEET_VENDORS, VENDOR_COLS_); return t.rows.filter(x => /^V111 Copy$/.test(x[t.c['Vendor Name']])).map(x => x[t.c['Owner Site']]); }`), ['S1']);
    // an edit of a vendor used here makes it this site's own
    run('(x, m) => saveVendor_(x, m)', Object.assign({ name: 'V111 Billed', oldName: 'V111 Billed' }, det, { phone: '9876543210' }), 'edit');
    assert.deepStrictEqual(run(`() => { const t = table_(APP.SHEET_VENDORS, VENDOR_COLS_); return t.rows.filter(x => /^V111 Billed$/.test(x[t.c['Vendor Name']])).map(x => x[t.c['Owner Site']]); }`), ['S1']);
    // the database is asked only about the copies, and only the tables that count
    assert.ok(require('vm').runInContext('__asked', ctx).every(u => /=in\.\("/.test(u)));
    // the database cannot be asked: nothing is hidden (a vendor of this site never goes missing)
    require('vm').runInContext(`var __sb2 = sbFetch_; sbFetch_ = function (m, url, b, h) { if (/\\/rest\\/v1\\/bills\\?select=/.test(decodeURIComponent(url))) throw new Error('Supabase GET → 503'); return __sb2(m, url, b, h); };`, ctx);
    run(`() => { const t = table_(APP.SHEET_VENDORS, VENDOR_COLS_); const row = newRow_(t); set_(row, t, 'Vendor Name', 'V111 Other'); set_(row, t, 'Owner Site', 'S2'); t.sh.appendRow(row); TABLE_MEMO_ = {}; }`);
    assert.ok(run('() => getVendors_().some(v => v.name === "V111 Other")'));
  } finally { require('vm').runInContext("__siteCode = undefined; sbFetch_ = __sbReal; CacheService.getScriptCache().remove('SBCOL_vendors.owner_site');", ctx); }
});

test('update-99: one address – the Store and the Portal under this address, the menu of this module for the others, other modules\' pages in the dark menu', () => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  // (live 13-10-2026: /store/menu.json came through, the bare /store/ and /portal/ gave 404 – the first page has its own rule)
  // (update-127 adds Engineering after these – checked in its own test)
  // (update-138) the staging copy's own rules come first and match ONLY the staging address; the live rules are as before
  // (update-160) /scan – the page itself (a Scan with Mobile QR code); checked in its own test
  assert.deepStrictEqual(v.rewrites.filter(r => !r.has && !/^\/engineering/.test(r.source) && r.source !== '/scan'), [{ source: '/store/', destination: 'https://rcl-store.vercel.app/index.html' }, { source: '/portal/', destination: 'https://rcl-portal-flame.vercel.app/index.html' },
    { source: '/store/:path*', destination: 'https://rcl-store.vercel.app/:path*' }, { source: '/portal/:path*', destination: 'https://rcl-portal-flame.vercel.app/:path*' }]);
  assert.deepStrictEqual(v.redirects.filter(r => !/^\/engineering/.test(r.source)).map(r => r.source + '→' + r.destination + ':' + r.permanent), ['/store→/store/:false', '/portal→/portal/:false']);
  assert.ok(v.functions['api/rpc.js'] && v.crons.length === 1, 'the rest of vercel.json as before');
  // the menu: every page of Machinery, read from the page itself; every key a real page of the app
  const { menu } = require('../server/page.js'), m = menu(), app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.strictEqual(m.module, 'mechanical'); assert.ok(m.pages.length >= 20, m.pages.length);
  m.pages.forEach(p => { assert.match(p.key, /^[a-z0-9-]+$/); assert.ok(app.indexOf('id="tab-' + p.key + '"') > -1 && app.indexOf('id="sec-' + p.key + '"') > -1, p.key); assert.ok(!/[<&]/.test(p.name) || /&/.test(p.name), p.name); });
  assert.deepStrictEqual(m.pages.slice(0, 2), [{ key: 'dash', name: 'Dashboard' }, { key: 'vendors', name: 'Vendor Master', group: 'Master' }]);
  assert.ok(m.pages.some(p => p.key === 'log' && p.group === 'Log Book') && !m.pages.some(p => p.key === 'users'), 'Admin pages are not in it');
  assert.match(fs.readFileSync(path.join(root, 'build.js'), 'utf8'), /'menu\.json'/);
  // the worker keeps to this app's own addresses (the Store, the Portal and modules added later are left alone)
  const sw = fs.readFileSync(path.join(root, 'app', 'sw.js'), 'utf8'), own = /if \(!(\/.+\/)\.test\(u\.pathname\)\) return;/.exec(sw);
  assert.ok(own, 'the rule is there'); const re = eval(own[1]);
  for (const p of ['/', '/index.html', '/manifest.webmanifest', '/icons/oc2-icon-192.png', '/menu.json']) assert.ok(re.test(p), p);
  for (const p of ['/store/', '/store/api/items', '/portal/', '/hr/', '/storex']) assert.ok(!re.test(p), p);
  // the page: a link #site=…&page=…; the other modules as groups of their pages
  assert.match(app, /if \(\/\^\[a-z0-9_-\]\{1,64\}\$\/\.test\(arg\('page'\)\)\) S\.wantTab = arg\('page'\);/);
  assert.match(app, /wantTabGo\(\);      \/\/ \(13-10-2026\)/); assert.match(app, /modBase\(m\) \+ '\/menu\.json'/);
  assert.strictEqual((app.match(/id="grp_mods"/g) || []).length, 1);
});
test('update-160: a Scan with Mobile QR code opens in the RCL ERP app – /scan is the page, /.well-known/assetlinks.json names the app', () => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.deepStrictEqual(v.rewrites.filter(r => r.source === '/scan'), [{ source: '/scan', destination: '/index.html' }]);
  assert.ok(v.headers.some(h => h.source === '/.well-known/assetlinks.json' && h.headers.some(x => x.key === 'Content-Type' && x.value === 'application/json')));
  const al = JSON.parse(fs.readFileSync(path.join(root, 'app', 'well-known', 'assetlinks.json'), 'utf8'));
  assert.strictEqual(al[0].target.package_name, 'in.rachana.rcl.rcl_mobile');
  assert.deepStrictEqual(al[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.match(al[0].target.sha256_cert_fingerprints[0], /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/, 'the PUBLIC fingerprint of the signing key (never the key)');
  assert.match(fs.readFileSync(path.join(root, 'build.js'), 'utf8'), /'\.well-known', 'assetlinks\.json'/);
  const dev = fs.readFileSync(path.join(root, 'dev.js'), 'utf8');
  assert.match(dev, /'\/\.well-known\/assetlinks\.json'/); assert.match(dev, /=== '\/scan'\)/);
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.match(app, /qrSvg\(base \+ '\/scan\?cap=' \+ r\.code \+ \(r\.site \? '&site=' \+ encodeURIComponent\(r\.site\) : ''\)\)/);
  assert.match(app, /call\('capClaim', \{ code: c\.code, phone: phone, site: String\(c\.site \|\| ''\) \}\)/);
});
test('update-127: the Engineering module under this address (/engineering/ – its own Vercel project), like the Store', () => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.deepStrictEqual(v.redirects.slice(-1), [{ source: '/engineering', destination: '/engineering/', permanent: false }]);
  assert.deepStrictEqual(v.rewrites.slice(-2), [{ source: '/engineering/', destination: 'https://rcl-engineering.vercel.app/index.html' }, { source: '/engineering/:path*', destination: 'https://rcl-engineering.vercel.app/:path*' }]);
  // the first page has its own rule (as /store/ – live 13-10-2026 the bare folder gave 404 without it); the app's worker leaves it alone
  const sw = fs.readFileSync(path.join(root, 'app', 'sw.js'), 'utf8'), re = eval(/if \(!(\/.+\/)\.test\(u\.pathname\)\) return;/.exec(sw)[1]);
  for (const p of ['/engineering/', '/engineering/api/eng', '/engineering/menu.json']) assert.ok(!re.test(p), p);
  assert.ok(v.functions['api/rpc.js'] && v.crons.length === 1, 'the rest of vercel.json as before');
});
test('update-100: the same view – another module of this address opens INSIDE this screen (only the middle changes)', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.strictEqual((app.match(/id="sec-ext"/g) || []).length, 1); assert.match(app, /<div id="ext_frames"><\/div>/);
  assert.match(app, /var EXT = \{ on: null, fresh: false \};/, 'var: showTab may run before it at the start');
  assert.match(app, /function showTab\(name, fromBack\) \{\n    extHide\(\);/, 'a page of Mechanical takes the middle back');
  assert.match(app, /fr\.src = modBase\(m\) \+ '\/\?embed=1' \+ hash;/); assert.match(app, /'&u=' \+ encodeURIComponent\(email\)/);
  assert.match(app, /const x = \/\^\(\[a-z\]\{2,20\}\)__\(\[a-z0-9_-\]\{1,40\}\)\$\/\.exec\(t \|\| ''\); if \(x\) \{ extGo\(x\[1\], x\[2\]\); return; \}/);
  assert.match(app, /if \(EXT && EXT\.on && S\.curTab\) \{ showTab\(S\.curTab, true\); return; \}/, 'Back from a module page');
  assert.match(app, /modBase\(m\) \+ '\/api\/logout'/, 'Logout ends the modules\' sign-ins too');
  // only a module under THIS address opens inside (another address: as before, through the Portal)
  assert.match(app, /const inHere = m => \{ try \{ return !!modBase\(m\) && new URL\(modBase\(m\)\)\.origin === hereOrigin\(\); \}/);
});
test('update-101: the dark menu scrolls by itself on a computer; Ctrl K also searches the other modules of this screen', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.match(app, /\.app \.side, \.app\.side-auto \.side \{ position: sticky; top: 0; bottom: auto; left: auto; height: 100vh; align-self: flex-start; \}/);
  assert.match(app, /\.app \.side nav \{ flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;/);
  assert.ok(!/\.app \.side, \.app\.side-auto \.side \{ position: relative;/.test(app), 'the old "part of the page" rule is gone');
  // search: the modules' pages and their own entries (window.rclModule – the same two for every module)
  assert.match(app, /\}\)\.concat\(gsModPages\(\)\);/); assert.match(app, /\.concat\(gsModGroups\(\)\);/);
  assert.match(app, /gsModAsk\(q, seq\);/); assert.match(app, /w\.rclModule\.search\(q\)/); assert.match(app, /w\.rclModule\.open\(page, find\)/);
  assert.match(app, /if \(seq !== GS\.seq\) return;/, 'an old answer never shows for a new search');
});
test('update-102: the keys of this screen (Ctrl K, "/", Alt + B) also work inside a module\'s page – for every module, nothing needed in it', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.match(app, /fr\.addEventListener\('load', \(\) => extKeys\(fr\)\);/);
  assert.match(app, /function extKeys\(fr\) \{/); assert.match(app, /w\.__rclKeys = true;/, 'heard once per page load');
  assert.match(app, /\(e\.ctrlKey \|\| e\.metaKey\) && \(e\.key === 'k' \|\| e\.key === 'K' \|\| e\.code === 'KeyK'\)\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); \$\('gs_back'\)\.hidden \? gsOpen\(\) : gsClose\(\); return; \}/);
});

test('update-107: Log Book → Import from Excel takes a water tanker\'s lines as trips (by the tanker\'s own check), its Excel = one line per trip', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const h = app.slice(app.indexOf("$('lg_file').addEventListener('change'"), app.indexOf("$('lg_file').addEventListener('change'") + 12000);
  assert.match(h, /const isTk = r => \{ const m = findMachine\(r\.no\); return !!\(m && m\.lbFormat === 'I'\); \};/);
  assert.match(h, /rows\.splice\(0, rows\.length, \.\.\.rows\.filter\(r => !isTk\(r\)\)\);/, 'the tanker lines never reach importLogBook (the server still refuses them there)');
  assert.match(h, /call\('checkTankerImport', \{ rows: trips \}\)/); assert.match(h, /call\('importTankerTrips', \{ rows: trips \}\)/);
  assert.ok(h.indexOf("call('checkTankerImport'") < h.indexOf("call('importLogBook'"), 'both are checked before anything is saved');
  assert.match(app, /return ts\.map\(\(t, k\) => Object\.assign\(\{\}, r, \{ trip: 1, challan: t\.c, tStart: t\.a, tEnd: t\.b, chFrom: t\.ch, chTo: '', work: t\.u \}/);
  const guide = app.slice(app.indexOf('    log: { saves: ['), app.indexOf(']', app.indexOf('    log: { saves: [')));
  assert.ok(guide.indexOf("'importTankerTrips'") > -1);
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  for (const m of ['WT-1 is a water tanker – one line per trip (this line has 3 trips): each trip on its own line with its Challan No, From time (dispatch) and To time (unload).',
    '1 line of a water tanker with Idle / Holiday / Breakdown – not imported (a water tanker is entered by its trips only). Nothing to import.'])
    { const r = H.fixRules(m)[0]; assert.ok(r !== H.FIX_ANY && r.mr && r.hi && /one line of the file = one trip/.test(r.en[0]), m); }
});

test('update-108: the Super Admin changes a billed entry; a user\'s change waits for his approval; the next bill takes the difference (Credit / Debit Note)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  // the session of a Portal sign-in carries the Super Admin; only that one
  assert.strictEqual(run('() => sessionRead_(sessionMake_("a@b.c", "scrypt$x", 3600000, true)).sup'), true);
  assert.strictEqual(run('() => sessionRead_(sessionMake_("a@b.c", "scrypt$x", 3600000)).sup'), false);
  assert.strictEqual(run('() => sessionRead_(sessionMake_("a@b.c", "scrypt$x", 0, true)).sup'), true);
  assert.match(fs.readFileSync(path.join(root, 'server', 'portal.js'), 'utf8'), /super: c\.super === true,/);
  assert.match(fs.readFileSync(path.join(root, 'server', 'system.js'), 'utf8'), /super: c\.super === true && c\.admin,/);
  // a machinery, its bill of September (as the page builds it), verified and submitted
  run('(x, m) => saveVendor_(x, m)', { name: 'Corr Unit V', gstReg: 'No', pan: 'ABCPU1234V', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'CRU-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Corr Unit V', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'Corr Unit V', from: '2026-08-01', tdsPct: 2, woNo: 'WO-CU', lines: [{ no: 'CRU-1', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add');
  assert.ok(run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-08-31', shift: 'Full Day', no: 'CRU-1', mode: 'KM', openingKm: 960, closingKm: 1000 }, { date: '2026-09-01', shift: 'Full Day', no: 'CRU-1', mode: 'KM', closingKm: 1040 }, { date: '2026-09-02', shift: 'Full Day', no: 'CRU-1', mode: 'KM', closingKm: 1080 }] }).ok);
  const co = run('() => billCompanies_()')[0];
  const mk = (from, to, no) => run(`(a) => { const m = findMachine_('CRU-1'), from = a[0], to = a[1];
    const c = billMachineCalc_(m, getLogBookList_({ from: from, to: to, no: 'CRU-1', all: true }).rows, logPrintExtra_({ from: from, to: to, nos: ['CRU-1'] }), from, to, undefined, true);
    const A = r2_(c.amount), B = r2_(c.excessAmt), D = r2_(A - B), H2 = D > 0 ? r2_(D * c.tdsPct / 100) : 0;
    return { company: a[3], vendor: { name: 'Corr Unit V' }, from: from, to: to, billDate: to, billNo: a[2], picked: ['CRU-1'], partial: false, edited: false, idlePaid: true,
      machines: [{ no: 'CRU-1', workDays: c.workDays, nights: c.nights, issued: c.issued, amount: c.amount, excessAmt: c.excessAmt, debitQty: c.debitQty, excessQty: c.excessQty, dieselRate: c.dieselRate, lines: c.segs.map(s => ({ unit: s.unit, qty: s.qty, rate: s.rate, amount: s.amount })) }],
      A: A, B: B, C: 0, D: D, E: 0, F: 0, G: D, H: H2, I: r2_(D - H2), gstPct: c.gstPct, tdsPct: c.tdsPct }; }`, [from, to, no, co]);
  const submit = b => run('(b, co) => { const v = verifyBills_({ bills: [b] }); if (!v.ok) return { verify: v.bills[0].checks.filter(c => c.s === "bad").map(c => c.t) }; return submitBills_({ bills: [{ vendor: "Corr Unit V", company: co, billNo: b.billNo, from: b.from, to: b.to, billDate: b.billDate, net: b.I, data: b }] }); }', b, co);
  const s1 = submit(mk('2026-09-01', '2026-09-30', '81'));
  assert.ok(s1 && s1.ok, JSON.stringify(s1));
  const key = d => run('d => { const lt = table_(APP.SHEET_LOG), c = lt.c; return logKeyOf_(lt, lt.rows.find(r => str_(r[c[H.NO]]) === "CRU-1" && dkey_(r[c[H.DATE]]) === d)); }', d);
  // a user is refused as before; the refusal names the way out
  const refused = run('(k) => { ACTOR_SUPER_ = false; return updateLogRow_(k, { closingKm: 1100 }); }', key('2026-09-02'));
  assert.match(refused.THROWN || '', /is in the submitted RA Bill 81 .* without the Super Admin \(a bill replaced or deleted keeps them locked\)\. To correct them: change the entry and send it to the Super Admin for approval/);
  // he sends it; nothing is saved; another user (not the Super Admin) cannot approve
  const user = { email: 'u@rcl.test', name: 'User U', admin: false, perms: { 'Log Book': 'Edit' }, active: true };
  const sent = run('(u, k) => crRequest_(u, { fn: "updateLogRow", args: [k, { closingKm: 1100 }], reason: "typed wrong" })', user, key('2026-09-02'));
  assert.ok(sent && sent.ok && /^CR-\d{5}$/.test(sent.id), JSON.stringify(sent));
  assert.match(sent.summary[0], /Change Log Book entry: CRU-1 · 02-09-2026 · Full Day – Close KM 1100 \(saved now: .*Close KM 1080\)/);
  assert.match(run('(u, k) => crRequest_(u, { fn: "updateLogRow", args: [k, { closingKm: 1100 }], reason: "again" })', user, key('2026-09-02')).THROWN, /already waiting for the Super Admin/);
  assert.match(run('(u, k) => crRequest_(u, { fn: "saveMaster", args: [], reason: "x" })', user).THROWN, /Only a Log Book or diesel issue change/);
  assert.match(run('(u, x) => crDecide_(u, x)', user, { id: sent.id, approve: true }).THROWN, /Only the Super Admin approves/);
  // approved: the requester must still have Edit access (not in this harness's Users) – the request keeps waiting
  const sa = { email: 'sa@rcl.test', name: 'Super Admin', admin: true, super: true, perms: {} };
  assert.match(run('(u, x) => crDecide_(u, x)', sa, { id: sent.id, approve: true }).THROWN, /is not an active user of this site any more – reject this request/);
  assert.match(run('(u, x) => crDecide_(u, x)', sa, { id: sent.id, approve: false }).THROWN, /Write why the change is rejected/);
  const rej = run('(u, x) => crDecide_(u, x)', sa, { id: sent.id, approve: false, note: 'not needed' });
  assert.ok(rej.ok && rej.status === 'Rejected' && rej.list.requests[0].status === 'Rejected');
  // the Super Admin changes the entry himself: allowed; the bill's "before" is kept first (120 → 80 km here: 40 + 40)
  const saSave = run('(k) => { ACTOR_SUPER_ = true; SA_REASON_ = "the meter shows 1100"; try { billBaselines_("updateLogRow", [k, { closingKm: 1100 }]); return updateLogRow_(k, { closingKm: 1100 }); } finally { ACTOR_SUPER_ = false; SA_REASON_ = ""; } }', key('2026-09-02'));      // (update-152: with his reason)
  assert.ok(saSave && !saSave.THROWN, JSON.stringify(saSave));
  const base = run('() => { const t = crTable_(false); return t.rows.map((r, i) => crOut_(t, r, i)).filter(r => r.kind === "Baseline").map(r => ({ id: r.id, data: JSON.parse(r.data) })); }');
  assert.strictEqual(base.length, 1); assert.strictEqual(base[0].data.units.KM.qty, 80); assert.strictEqual(base[0].data.amount, 4000);
  // the next bill: KM 80 → 100 at the old rate ₹50 = +₹1,000 → a Credit Note of ₹980 (TDS 2%)
  assert.ok(run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-10-01', shift: 'Full Day', no: 'CRU-1', mode: 'KM', closingKm: 1140 }] }).ok);
  const corr = run('co => billCorrections_({ vendor: "Corr Unit V", company: co, bills: [{ from: "2026-10-01", to: "2026-10-10", machines: ["CRU-1"] }] })', co);
  assert.strictEqual(corr.items.length, 1);
  const z = corr.items[0];
  assert.deepStrictEqual([z.billNo, z.no, z.work[0].from, z.work[0].to, z.work[0].rate, z.work[0].amount, z.diesel, z.kind, z.amount, z.tds, z.total], ['81', 'CRU-1', 80, 100, 50, 1000, null, 'Credit', 1000, 20, 980]);
  // a bill that does not take it (or does not tick it) is not submitted
  const b2 = mk('2026-10-01', '2026-10-10', '82');
  assert.ok((submit(b2).verify || []).some(t => /a difference of ₹980 \(Credit Note – to the vendor\) is not taken in this bill/.test(t)));
  b2.corr = corr.items.map(x => Object.assign({}, x, { checked: false }));
  assert.ok((submit(b2).verify || []).some(t => /tick "Checked" for its difference/.test(t)));
  b2.corr.forEach(x => { x.checked = true; });
  const s2 = submit(b2);
  assert.ok(s2 && s2.ok, JSON.stringify(s2));
  const saved = run('id => { const b = getBills_({ id: id }).bills[0]; return { J: b.data.J, K: b.data.K, I: b.data.I, corr: b.data.corr.map(x => x.noteNo + " " + x.kind + " " + x.total) }; }', s2.saved[0].id);
  assert.deepStrictEqual([saved.J, saved.K, saved.corr.length], [-980, saved.I + 980, 1]);
  assert.match(saved.corr[0], /CN-001 Credit 980$/);
  const notes = run('() => dnList_().filter(d => d.vendor === "Corr Unit V").map(d => d.kind + " " + d.total + " " + d.status + " " + d.lines.map(l => l.amount).join("/"))');
  assert.deepStrictEqual(notes, ['Correction CN 980 Deducted 1000']);
  assert.strictEqual(run('co => billCorrections_({ vendor: "Corr Unit V", company: co, bills: [] }).items.length', co), 0, 'taken: nothing left');
  // the ledger: the Credit Note adds to what the vendor gets; the Debit Note run is not moved by it
  assert.ok(run('() => ledgerLines_().filter(l => l.vendor === "Corr Unit V" && l.kind === "cn").map(l => l.bill)').includes(980));
  assert.match(run('co => nextDnNo_(co)', co), /DN-\d{3}$/);
  // the bill deleted: its note is cancelled and the difference comes back
  assert.ok(run('id => { ACTOR_SUPER_ = true; try { return deleteBill_(id, "test"); } finally { ACTOR_SUPER_ = false; } }', s2.saved[0].id).ok);      // (update-152: the Super Admin's; kept as Deleted)
  assert.deepStrictEqual(run('() => dnList_().filter(d => d.vendor === "Corr Unit V").map(d => d.status)'), ['Cancelled']);
  assert.strictEqual(run('co => billCorrections_({ vendor: "Corr Unit V", company: co, bills: [] }).items.length', co), 1);
  // the page: the Super Admin's lock is no lock; a user may send the refused save; Approvals is his page; the bill shows the calculation
  assert.match(app, /const lxLockOf = dk => S\.user && S\.user\.super \? null :/);
  assert.match(app, /if \(CR_FNS\.indexOf\(fn\) > -1\) p0 = p0\.then\(/);
  assert.match(app, /const crSees = true;.*\n    \$\('tab-approvals'\)\.hidden = !crSees;/, '(update-114) everybody: what he sent (a verification), what waits for him');
  assert.match(app, /Corrections of earlier bills taken in this bill \(at the earlier bill\\'s rates\)/);
  const pageFns = (app.match(/const CR_FNS = \[([^\]]+)\]/) || [])[1].replace(/\s+/g, ''), srvFns = (code.match(/const CR_FNS_ = \[([^\]]+)\]/) || [])[1].replace(/\s+/g, '');
  assert.strictEqual(pageFns, srvFns, 'the page and the server know the same saves');
  // step 1z: only adds a table; listed word for word in Read Me
  const sqlFile = fs.readFileSync(path.join(root, 'sql', 'supabase_step1z_billed_changes.sql'), 'utf8');
  assert.ok(/create table if not exists public\.billed_changes/.test(sqlFile) && !/\b(drop table|delete from|truncate|update public)\b/i.test(sqlFile.replace(/^--.*$/gm, '')));
  const listed = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1z_billed_changes.sql');
  assert.ok(listed && listed.sql === sqlFile);
});

test('update-109: a request notifies the Super Admin\'s devices, a decision the devices of the user who sent it; a user sees his own requests', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  vm.runInContext('globalThis.__sent = []; rtcPush_ = function (ids, msg) { __sent.push({ ids: ids, msg: msg }); };', ctx);
  run('() => { crSuperSeen_("SA@rcl.test"); crSuperSeen_("sa@rcl.test"); crSuperSeen_("sa2@rcl.test"); }');
  assert.deepStrictEqual(run('() => crSupers_()'), ['sa2@rcl.test', 'sa@rcl.test'], 'the last Super Admins seen, newest first, once each');
  const user = { email: 'n109@rcl.test', name: 'User N', admin: false, perms: { 'Diesel Issue': 'Edit' }, active: true };
  const sent = run('u => crRequest_(u, { fn: "deleteDieselIssue", args: ["DI-999999"], reason: "entered twice" })', user);
  assert.ok(sent && sent.ok, JSON.stringify(sent));
  let pushes = run('() => __sent');
  assert.strictEqual(pushes.length, 1);
  assert.deepStrictEqual(pushes[0].ids, run('() => [rtcUid_("sa2@rcl.test"), rtcUid_("sa@rcl.test")]'));
  assert.strictEqual(pushes[0].msg.t, 'cr'); assert.match(pushes[0].msg.title, /^Approval needed – User N$/); assert.match(pushes[0].msg.body, /entered twice/);
  // the user's own list; another user's list does not have it
  const mine = run('u => crList_(u, {})', user);
  assert.ok(mine.requests.some(r => r.id === sent.id && r.status === 'Pending') && mine.pending >= 1 && mine.superAdmin === false);
  assert.ok(!run('u => crList_(u, {})', { email: 'other@rcl.test', perms: {} }).requests.some(r => r.id === sent.id));
  assert.ok(mine.requests.every(r => r.args === undefined), 'what the page sent is not given back');
  // rejected: the user's devices are told, with the reason
  const sa = { email: 'sa@rcl.test', name: 'Super Admin', admin: true, super: true, perms: {} };
  const rej = run('(u, x) => crDecide_(u, x)', sa, { id: sent.id, approve: false, note: 'not a duplicate' });
  assert.ok(rej.ok && rej.status === 'Rejected' && rej.email === undefined, JSON.stringify(rej).slice(0, 200));
  pushes = run('() => __sent');
  assert.strictEqual(pushes.length, 2);
  assert.deepStrictEqual(pushes[1].ids, run('() => [rtcUid_("n109@rcl.test")]'));
  assert.match(pushes[1].msg.title, /^Rejected – not saved: /); assert.match(pushes[1].msg.body, /By Super Admin: not a duplicate/);
  assert.strictEqual(run('u => crList_(u, {})', user).requests.find(r => r.id === sent.id).status, 'Rejected');
  // the page: a tap on the notification opens Approvals; the Super Admin is remembered at his Portal sign-in
  const sw = fs.readFileSync(path.join(root, 'app', 'sw.js'), 'utf8'), app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.match(sw, /if \(d\.t === 'cr'\) \{/); assert.match(sw, /openWindow\(data\.t === 'cr' \? '\/#page=approvals' : '\/'\)/);
  assert.match(app, /window\.top\.rclCrOpen = \(\) => \{ if \(S\.token && S\.user\) \{ showTab\('approvals'\); \} \};/);
  assert.match(fs.readFileSync(path.join(root, 'app', 'Sites.gs'), 'utf8'), /if \(x\.super\) crSuperSeen_\(u\.email\);/);
});

test('update-109: Day / Night by the time – the site\'s hours (8 AM / 8 PM unless set), checked when saved; the page picks the shift of a new entry', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  assert.deepStrictEqual(run('x => saveSiteRules_(x).rules', { backDays: '', announce: '', dayFrom: '7:30', nightFrom: '19:30' }), { backDays: '', announce: '', dayFrom: '07:30', nightFrom: '19:30', attachMax: 10 });
  assert.match(run('x => saveSiteRules_(x)', { backDays: '', dayFrom: '25:00', nightFrom: '19:30' }).THROWN, /^Shift times: type the hour as HH:MM/);
  assert.match(run('x => saveSiteRules_(x)', { backDays: '', dayFrom: '08:00', nightFrom: '08:00' }).THROWN, /cannot start at the same time/);
  assert.deepStrictEqual(run('x => saveSiteRules_(x).rules', { backDays: '2', announce: 'x' }), { backDays: 2, announce: 'x', dayFrom: '07:30', nightFrom: '19:30', attachMax: 10 }, 'not sent = kept');
  assert.strictEqual(run('x => saveSiteRules_(x).rules.attachMax', { backDays: '', attachMax: 6 }), 6, '(update-153) attachments of an entry: set by the Admin');
  assert.match(run('x => saveSiteRules_(x)', { backDays: '', attachMax: 30 }).THROWN, /^Attachments of a Log Book entry: a whole number from 1 to 20\.$/);
  assert.strictEqual(run('x => saveSiteRules_(x).rules.attachMax', { backDays: '', attachMax: 10 }), 10);
  run('x => saveSiteRules_(x)', { backDays: '', announce: '', dayFrom: '08:00', nightFrom: '20:00' });
  // the page's rule, worked on its own
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const src = app.slice(app.indexOf('  function autoShift(at) {'), app.indexOf('  function myShift() {'));
  const auto = (rules, h, m) => new Function('S', src + '; return autoShift(new Date(2026, 9, 14, ' + h + ', ' + m + '));')({ rules: rules });
  const r8 = { dayFrom: '08:00', nightFrom: '20:00' };
  assert.deepStrictEqual([[7, 59], [8, 0], [13, 0], [19, 59], [20, 0], [23, 30], [2, 0]].map(([h, m]) => auto(r8, h, m)), ['Night', 'Day', 'Day', 'Day', 'Night', 'Night', 'Night']);
  assert.strictEqual(auto({}, 9, 0), 'Day', 'no rules yet: 8 AM / 8 PM');
  assert.deepStrictEqual([[21, 0], [5, 0], [12, 0]].map(([h, m]) => auto({ dayFrom: '20:00', nightFrom: '06:00' }, h, m)), ['Day', 'Day', 'Night'], 'a "Day" that runs over midnight');
  // where it is used: the new-entry boxes, the first Log Book row, a pending machinery put in the rows; a box changed by hand is kept
  assert.match(app, /function shiftBoxes\(\) \{ return \['d_shift', 'bd_shift', 't_shift', 'wt_shift'\]; \}/);
  assert.match(app, /const ls = last \? lgf\(last, 'shift'\)\.value : myShift\(\);/);
  assert.match(app, /const shift = lgMode === 'mach' && last && ls === 'Day' \? 'Night' : lgMode === 'mach' && last && ls === 'Night' \? 'Day' : ls;/, 'one machinery: the FIRST row keeps its own shift (found by half.js: it took the shift after it)');
  assert.match(app, /const shift = myShift\(\), fire = el =>/);
  assert.match(app, /if \(t && e\.isTrusted && \(shiftBoxes\(\)\.indexOf\(t\.id\) > -1 \|\| \(t\.dataset && t\.dataset\.f === 'shift'\)\)\) t\.dataset\.hand = '1';/);
  assert.match(app, /<option value="">Automatic – Day \/ Night by the time<\/option>/);  // (found by the browser test idle.js: an "if" put inside the else-if chain of showTab stopped the Diesel page loading its list)
  const st = app.slice(app.indexOf('  function showTab(name, fromBack) {'), app.indexOf("    else if (name === 'master') loadVendors();"));
  assert.match(st, /setTimeout\(shiftAuto, 0\);[^\n]*\n    if \(name === 'dash'\) \{ dashToday\(\); \}/);
  assert.ok(!/crLoad\(\);\n    if \(/.test(st), 'nothing breaks the chain of the pages');
});

test('update-110: the language of the app – the Marathi / Hindi words keep every {0}, the page turns texts and patterns, each user his own (Settings), served by build / dev / Vercel', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const keys = JSON.parse(fs.readFileSync(path.join(root, 'app', 'i18n', 'keys.json'), 'utf8'));
  const ks = new Set(Array.isArray(keys) ? keys.map(k => typeof k === 'string' ? k : k.en || k.text) : Object.keys(keys));
  ['mr', 'hi'].forEach(l => {
    const d = JSON.parse(fs.readFileSync(path.join(root, 'app', 'i18n', l + '.json'), 'utf8')), en = Object.keys(d);
    assert.ok(en.length > 4000, l + ': most of the texts are there (' + en.length + ')');
    en.forEach(k => {
      const v = d[k], ph = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
      assert.ok(typeof v === 'string' && v.trim() && v !== k, l + ': a real translation for ' + JSON.stringify(k));
      assert.strictEqual(ph(v), ph(k), l + ': every {n} kept in ' + JSON.stringify(k) + ' → ' + JSON.stringify(v));
      assert.ok(ks.has(k), l + ': a text of the page / server (' + JSON.stringify(k) + ')');
    });
    assert.ok(/[ऀ-ॿ]/.test(d['Both'] || ''), l + ': in Devanagari');
  });
  // every script block of the page parses (a // note put before a catch once made the whole page stop)
  [...app.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => assert.doesNotThrow(() => new Function(m[1]), 'script block ' + (i + 1)));
  // the page's runtime, worked on its own
  const at = app.indexOf('  function i18nIndex(d) {'), to = app.indexOf('  function i18nText(n, inside) {');
  assert.ok(at > 0 && to > at);
  const rt = new Function('I18N', app.slice(at, to) + '; return { i18nIndex, i18nStr, i18nAs, i18nSame };');
  const I = { map: null, seen: new Map() }, f = rt(I), x = f.i18nIndex({ 'Saved.': 'Save झाले.', 'Machinery {0} is inactive.': 'मशीन {0} बंद आहे.', 'Row {0}: {1} is inactive.': 'ओळ {0}: {1} बंद आहे.', 'Both': 'दोन्ही' });
  Object.assign(I, { map: x.map, tpl: x.tpl, word: x.word, seen: new Map() });
  assert.strictEqual(f.i18nStr('  Saved. '), '  Save झाले. ', 'exact, the spaces around kept');
  assert.strictEqual(f.i18nStr('Machinery JCB-07 is inactive.'), 'मशीन JCB-07 बंद आहे.', 'a pattern: the name carried over');
  assert.strictEqual(f.i18nStr('Row 3: MH-04-AB-1 is inactive.'), 'ओळ 3: MH-04-AB-1 बंद आहे.', 'the longer pattern first');
  const y = f.i18nIndex({ 'Delete {0} entr{1}?': '{0} एन्ट्री{1} डिलीट करायच्या?', 'in {0} day{1}': '{0} दिवस{1} मध्ये', 'Inactive{0}': 'निष्क्रिय{0}' });
  Object.assign(I, { map: y.map, tpl: y.tpl, word: y.word, seen: new Map() });
  assert.deepStrictEqual(['Delete 1 entry?', 'Delete 3 entries?', 'in 1 day', 'in 4 days', 'Inactive', 'Inactive (from 01-10-2026)', 'Inactivex'].map(f.i18nStr),
    ['1 एन्ट्री डिलीट करायच्या?', '3 एन्ट्री डिलीट करायच्या?', '1 दिवस मध्ये', '4 दिवस मध्ये', 'निष्क्रिय', 'निष्क्रिय (from 01-10-2026)', null], 'the English ending is left out, the words after it are carried over');
  Object.assign(I, { map: x.map, tpl: x.tpl, word: x.word, seen: new Map() });
  assert.strictEqual(f.i18nStr('Something new'), null, 'no translation: stays English');
  assert.strictEqual(f.i18nStr('12,500.00'), null, 'numbers are not touched');
  assert.strictEqual(f.i18nStr('Machinery JCB-07 is inactive.'), 'मशीन JCB-07 बंद आहे.', 'the second time from what was worked out');
  assert.strictEqual(f.i18nStr('Something new'), null, '…also a text without a translation');
  assert.strictEqual(f.i18nAs('Something new'), 'Something new');
  assert.ok(f.i18nSame('दोन्ही', 'Both') && f.i18nSame('Both', 'Both') && !f.i18nSame('Night', 'Both'), 'code that looks at a button / option text works in any language');
  // where the page must not change anything: papers, typed boxes, the values of drop-downs
  assert.match(app, /const I18N_SKIP = 'script, style, textarea, code, pre, svg, \[data-noi18n\], \.sheet, \.bl, \.tx, \.dnp, \.billsheet, \.lbsheet, \.mb-paper, #mb_pages, \[contenteditable="true"\]';/);
  assert.match(app, /if \(p\.tagName === 'OPTION' && !p\.hasAttribute\('value'\)\) p\.setAttribute\('value', p\.value\);/);
  assert.match(app, /finally \{ btn\.disabled = false; if \(i18nSame\(btn\.textContent, label\)\) btn\.textContent = old; \}/, 'busy() gives the button its words back in any language');
  assert.ok(!/x\.textContent (===|!==) 'Both'/.test(app), 'the bill-name drop-downs');
  // each user his own: Settings → Language of the app (the help follows it); kept with the account
  assert.match(app, /<b>Language of the app<\/b><div class="set-seg" data-pref="appLang" data-noi18n><button type="button" data-v="mr">मराठी<\/button><button type="button" data-v="hi">हिंदी<\/button><button type="button" data-v="en">English<\/button><\/div>/);
  assert.match(app, /prefSet\(k === 'appLang' \? \{ appLang: b\.dataset\.v, lang: b\.dataset\.v === 'mr' \|\| b\.dataset\.v === 'hi' \? b\.dataset\.v : 'en' \} : \{ \[k\]: b\.dataset\.v \}\)/);
  assert.match(app, /if \(S\.user && p && Object\.prototype\.hasOwnProperty\.call\(p, 'appLang'\)\) i18nSet\(S\.prefs\.appLang\);/);
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  assert.deepStrictEqual(['mr', 'hi', '', 'en', 'xx', undefined].map(v => run('v => prefsClean_({ appLang: v }).appLang', v)), ['mr', 'hi', '', 'en', '', '']);
  // served: build.js copies the files, the local server and Vercel give them out
  assert.match(fs.readFileSync(path.join(root, 'build.js'), 'utf8'), /\['mr', 'hi'\]\.forEach\(l => fs\.copyFileSync\(path\.join\(__dirname, 'app', 'i18n', l \+ '\.json'\), path\.join\(out, 'i18n', l \+ '\.json'\)\)\);/);
  assert.match(fs.readFileSync(path.join(root, 'dev.js'), 'utf8'), /\|i18n\\\/\(\?:mr\|hi\)\\\.json\)\$\//);
  assert.ok(JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers.some(h => h.source === '/i18n/(.*)'));
});

test('update-112: the language is the person\'s – chosen at one site (web or phone app) it is written at his other sites; "en" = English chosen', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const rt = fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8');
  assert.match(rt, /const OTHERS_ = new Set\(\['sysPrefLang'\]\);/);
  assert.match(rt, /sysPrefLang: sysPrefLang_ \}\[fn\];/);
  assert.ok(!/sysPrefLang/.test((rt.match(/const OUTSIDE = new Set\(\[([^\]]+)\]\)/) || [])[1]), 'the page cannot call it');
  vm.runInContext('var __asked = []; __runOthers = function (fn, a) { __asked.push([fn, JSON.parse(a)]); return "[]"; };', ctx);
  try {
    const u = { email: 'Lang112@RCL.test', name: 'L' };
    run('u => saveMyPrefs_(u, { theme: "dark" })', u);
    assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(__asked)', ctx)), [], 'another setting: nothing asked of the other sites');
    run('u => saveMyPrefs_(u, { appLang: "hi", lang: "hi" })', u);
    assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(__asked)', ctx)), [['sysPrefLang', ['lang112@rcl.test', 'hi', 'hi']]]);
    run('u => saveMyPrefs_(u, { appLang: "hi", lang: "hi" })', u);
    assert.strictEqual(vm.runInContext('__asked.length', ctx), 1, 'the same again: not sent again');
    run('u => saveMyPrefs_(u, { appLang: "en", lang: "en" })', u);
    assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(__asked[1])', ctx)), ['sysPrefLang', ['lang112@rcl.test', 'en', 'en']]);
    // AT THE OTHER SITE: written for a user of that site only
    assert.deepStrictEqual(run('() => sysPrefLang_("nobody112@rcl.test", "mr", "mr")'), { ok: false });
    const someone = run('() => (readUsersSheet_()[0] || {}).email || ""');
    if (someone) {
      assert.deepStrictEqual(run('e => sysPrefLang_(e, "mr", "mr")', someone), { ok: true });
      assert.deepStrictEqual(run('e => { const p = prefsRead_(e); return [p.appLang, p.lang]; }', someone), ['mr', 'mr']);
    }
  } finally { vm.runInContext('__runOthers = undefined;', ctx); }
  // the web: English chosen = "en"; not chosen marks English too
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.match(app, /g\.dataset\.pref === 'appLang' && !p\.appLang \? 'en'/);
});

test('update-114: verification of every work – the Super Admin\'s rules, levels of named people, checked then sent, saved only at the last approval', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // a database for this test: what a save writes stays; a save that fails – or is only checked – leaves nothing (as Supabase)
  vm.runInContext(`globalThis.__k114 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB114 = {};
    globalThis.__fill114 = s => { const d = DB114[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep114 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill114(s); if (s.loaded) DB114[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    if (SB_BOOK_) __keep114(SB_BOOK_);
    SbBook_.prototype.flush = function () { __keep114(this); __k114.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill114(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill114(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    globalThis.__sent = []; rtcPush_ = function (ids, msg) { __sent.push({ ids: ids, msg: msg }); };`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'a'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('m114@rcl.test', 'Maker M', false, { 'Vendor Master': 'Edit', 'Diesel Inward': 'Edit', 'Diesel Issue': 'Edit' }), mk('c1@rcl.test', 'Checker One', false, { 'Vendor Master': 'View' }),
        mk('c1b@rcl.test', 'Checker Backup', false), mk('c2@rcl.test', 'Checker Two', false), mk('sa114@rcl.test', 'Super A', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok114_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa114@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const V = n => ({ name: n, gstReg: 'No', pan: 'ABCPV1114A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' });
    const vendorThere = n => run('n => getVendors_().some(v => (v.name || v) === n)', n);
    // ---- the rules: only the Super Admin; every page with a save is a task; checked when saved ----
    assert.match(api('m114@rcl.test', 'getFlowRules').THROWN, /Only the Super Admin sets the verification rules/);
    const fr = api('sa114@rcl.test', 'getFlowRules');
    const tasks = fr.tasks.map(t => t.m);
    ['Vendor Master', 'Diesel Issue', 'Diesel Inward', 'Diesel Transfer', 'Log Book', 'Master', 'Machinery Billing', 'Machinery Payments'].forEach(m => assert.ok(tasks.includes(m), m));
    assert.ok(!fr.tasks.some(t => t.fns.includes('saveTankSettings') || t.fns.includes('verifyBills')), 'settings and checks are not entries');
    assert.ok(fr.tasks.find(t => t.m === 'Diesel Issue').diesel && !fr.tasks.find(t => t.m === 'Vendor Master').diesel);
    assert.deepStrictEqual(fr.users.map(u => u.email).sort(), users.map(u => u.email).sort());
    assert.match(api('sa114@rcl.test', 'saveFlowRules', { tasks: { 'Vendor Master': { on: true, levels: [] } } }).THROWN, /Vendor Master: pick at least one person for level 1/);
    assert.match(api('sa114@rcl.test', 'saveFlowRules', { tasks: { 'Vendor Master': { on: true, levels: [['x@nobody.test']] } } }).THROWN, /x@nobody\.test is not an active user of this site/);
    assert.match(api('sa114@rcl.test', 'saveFlowRules', { tasks: { 'Vendor Master': { on: true, levels: [['c1@rcl.test']], daysBack: '2.5' } } }).THROWN, /"days back" must be a whole number/);
    assert.match(api('sa114@rcl.test', 'saveFlowRules', { remindHours: 0, tasks: {} }).THROWN, /"remind after" must be 1 to 168 hours/);
    let r = api('sa114@rcl.test', 'saveFlowRules', { remindHours: 3, tasks: { 'Vendor Master': { on: true, levels: [['C1@rcl.test', 'c1b@rcl.test'], ['c2@rcl.test']] }, 'Diesel Inward': { on: true, levels: [['c1@rcl.test']], daysBack: '3' }, 'Bogus Page': { on: true, levels: [['c1@rcl.test']] } } });
    assert.ok(r.ok && r.rules.remindHours === 3 && !r.rules.tasks['Bogus Page'], JSON.stringify(r));
    assert.deepStrictEqual(r.rules.tasks['Vendor Master'].levels, [['c1@rcl.test', 'c1b@rcl.test'], ['c2@rcl.test']], 'emails kept small');
    // ---- a save of the task: CHECKED (a wrong entry is refused at once, nothing sent), then sent – nothing saved ----
    const bad = api('m114@rcl.test', 'saveVendor', Object.assign(V('VF Bad'), { pan: 'x' }), 'add');
    assert.ok(bad.THROWN && !/Sent for verification/.test(bad.THROWN), 'a wrong entry is refused as a save: ' + JSON.stringify(bad));
    assert.strictEqual(run('() => flowAll_().length'), 0);
    const sent = api('m114@rcl.test', 'saveVendor', V('VF Alpha'), 'add');
    assert.match(sent.THROWN, /^Sent for verification to Checker One, Checker Backup \(level 1 of 2\) – VF-00001\. It is saved when it is approved; nothing is saved until then\.$/);
    assert.strictEqual(vendorThere('VF Alpha'), false, 'not saved yet');
    assert.match(api('m114@rcl.test', 'saveVendor', V('VF Alpha'), 'add').THROWN, /already waiting for verification|just sent twice/);
    let pushes = run('() => __sent'); assert.deepStrictEqual(pushes[0].ids, run('() => [rtcUid_("c1@rcl.test"), rtcUid_("c1b@rcl.test")]')); assert.match(pushes[0].msg.title, /^Verification – Vendor Master by Maker M$/);
    assert.ok(run('() => getVersions_().V_flow') !== '0', 'every open page hears of it (live sync "flow")');
    // ---- who sees it, who may decide ----
    const listOf = who => api(who, 'getChangeRequests', {});
    let L = listOf('m114@rcl.test'); let q = L.requests.find(x => x.id === 'VF-00001');
    assert.ok(q && q.mine && !q.canDecide && q.kind === 'Flow' && q.task === 'Vendor Master' && q.level === 1 && q.levels === 2 && q.waitingFor.join() === 'Checker One,Checker Backup' && q.args === undefined, JSON.stringify(q));
    assert.ok(listOf('c1@rcl.test').requests.find(x => x.id === 'VF-00001').canDecide && listOf('c1@rcl.test').forMe === 1);
    assert.ok(!listOf('c2@rcl.test').requests.find(x => x.id === 'VF-00001').canDecide, 'level 2 waits');
    assert.match(api('c2@rcl.test', 'decideChangeRequest', { id: 'VF-00001', approve: true }).THROWN, /This request is not waiting for you \(level 1: Checker One, Checker Backup\)/);
    assert.match(api('c1@rcl.test', 'decideChangeRequest', { id: 'VF-00001', approve: false }).THROWN, /Write why it is rejected/);
    // ---- level 1 approves: on to level 2, still nothing saved ----
    r = api('c1b@rcl.test', 'decideChangeRequest', { id: 'VF-00001', approve: true, note: 'ok by me' });
    assert.ok(r.ok && r.status === 'Pending' && r.level === 2 && r.list, JSON.stringify(r).slice(0, 300));
    assert.strictEqual(vendorThere('VF Alpha'), false);
    pushes = run('() => __sent'); assert.deepStrictEqual(pushes[pushes.length - 1].ids, run('() => [rtcUid_("c2@rcl.test")]')); assert.match(pushes[pushes.length - 1].msg.title, /level 2 of 2 \(Maker M\)/);
    assert.match(api('c1@rcl.test', 'decideChangeRequest', { id: 'VF-00001', approve: true }).THROWN, /not waiting for you \(level 2: Checker Two\)/);
    // ---- the last level: saved now, as the maker's own entry ----
    r = api('c2@rcl.test', 'decideChangeRequest', { id: 'VF-00001', approve: true });
    assert.ok(r.ok && r.status === 'Approved' && r.result === 'Saved', JSON.stringify(r).slice(0, 300));
    assert.strictEqual(vendorThere('VF Alpha'), true, 'saved at the last approval');
    q = listOf('m114@rcl.test').requests.find(x => x.id === 'VF-00001');
    assert.deepStrictEqual(q.history.map(h => h.step + (h.level || '') + ' ' + h.by), ['Sent Maker M', 'Approved1 Checker Backup', 'Approved2 Checker Two']);
    pushes = run('() => __sent'); assert.match(pushes[pushes.length - 1].msg.title, /^Approved – saved: /); assert.deepStrictEqual(pushes[pushes.length - 1].ids, run('() => [rtcUid_("m114@rcl.test")]'));
    assert.match(api('c2@rcl.test', 'decideChangeRequest', { id: 'VF-00001', approve: true }).THROWN, /already approved/);
    // ---- the maker never approves his own (even if he is on the level); the Super Admin may decide any level; his own saves go straight in ----
    run('() => { const r = flowRules_(); r.tasks["Vendor Master"].levels = [["m114@rcl.test", "c1@rcl.test"]]; kvWrite_("FLOW_RULES", JSON.stringify(r)); }');
    assert.match(api('m114@rcl.test', 'saveVendor', V('VF Beta'), 'add').THROWN, /^Sent for verification to Checker One – VF-00002/);
    assert.match(api('m114@rcl.test', 'decideChangeRequest', { id: 'VF-00002', approve: true }).THROWN, /You cannot approve your own entry/);
    assert.ok(!listOf('m114@rcl.test').requests.find(x => x.id === 'VF-00002').canDecide);
    r = api('sa114@rcl.test', 'decideChangeRequest', { id: 'VF-00002', approve: false, note: 'duplicate vendor' });
    assert.ok(r.status === 'Rejected' && !vendorThere('VF Beta'));
    assert.match(run('() => __sent').pop().msg.title, /^Rejected – not saved: /);
    r = api('sa114@rcl.test', 'saveVendor', V('VF Gamma'), 'add');
    assert.ok(r.ok && vendorThere('VF Gamma'), 'the Super Admin\'s own entry is saved at once');
    // ---- a save that cannot be done any more at the last approval goes back (Returned) with the reason; nothing half-saved ----
    assert.match(api('m114@rcl.test', 'saveVendor', V('VF Gamma 2'), 'add').THROWN, /VF-00003/);
    run('() => { const r = flowRules_(); r.tasks["Vendor Master"].levels = [["c1@rcl.test"]]; kvWrite_("FLOW_RULES", JSON.stringify(r)); }');
    assert.match(api('m114@rcl.test', 'saveVendor', V('VF Delta'), 'add').THROWN, /VF-00004/);
    assert.ok(api('sa114@rcl.test', 'saveVendor', V('VF Delta'), 'add').ok, 'meanwhile the Super Admin added the same vendor');
    r = api('c1@rcl.test', 'decideChangeRequest', { id: 'VF-00004', approve: true });
    assert.ok(r.status === 'Returned' && /^Not saved: /.test(r.result), JSON.stringify(r).slice(0, 300));
    assert.strictEqual(run('() => getVendors_().filter(v => (v.name || v) === "VF Delta").length'), 1);
    // ---- several at once: each its own save; VF-00003 still waits at its own (old) levels: as they were when it was sent ----
    assert.ok(listOf('c1@rcl.test').requests.find(x => x.id === 'VF-00003').canDecide);
    assert.match(api('m114@rcl.test', 'saveVendor', V('VF Eps'), 'add').THROWN, /VF-00005/);
    assert.match(api('c1@rcl.test', 'decideChangeRequests', { ids: [] }).THROWN, /Tick the requests first/);
    r = api('c1@rcl.test', 'decideChangeRequests', { ids: ['VF-00003', 'VF-00005', 'VF-00001'], approve: true });
    assert.deepStrictEqual(r.done.map(d => d.id + ' ' + d.status), ['VF-00003 Approved', 'VF-00005 Approved']);
    assert.deepStrictEqual(r.failed.map(d => d.id), ['VF-00001']);
    assert.ok(vendorThere('VF Gamma 2') && vendorThere('VF Eps'));
    // ---- "only when": Diesel Inward only for entries more than 3 days back ----
    const today = run('() => today_()'), back = run('d => addDays_(d, -5)', today);
    const inw = d => ({ date: d, location: 'Dispenser', pump: 'Pump', qty: 500, rate: 92, billNo: 'VF-' + d, billDate: d });
    const before = run('() => getStock_()');
    r = api('m114@rcl.test', 'saveInward', inw(today));
    assert.ok(r.ok && /^IN-/.test(r.id), 'today\'s entry: saved at once ' + JSON.stringify(r).slice(0, 200));
    const nextNo = run('() => PropertiesService.getScriptProperties().getProperty("INWARD_LAST_NO")');
    assert.match(api('m114@rcl.test', 'saveInward', inw(back)).THROWN, /^Sent for verification to Checker One – VF-00006/);
    assert.strictEqual(run('() => PropertiesService.getScriptProperties().getProperty("INWARD_LAST_NO")'), nextNo, 'only checked: no number used up');
    const inwN = b => run('b => stockTables_().it.rows.filter(r => r.some(c => c === b)).length', b);
    assert.strictEqual(inwN('VF-' + back), 0, 'nothing in the inward yet (nor in the stock)');
    r = api('c1@rcl.test', 'decideChangeRequest', { id: 'VF-00006', approve: true });
    assert.ok(r.status === 'Approved', JSON.stringify(r).slice(0, 300));
    assert.strictEqual(inwN('VF-' + back), 1, 'in at the approval');
    assert.ok(before !== null);
    // ---- diesel held back while it waits; the facts of a save ----
    const f = run('() => flowFacts_("saveDieselBulk", [{ rows: [{ date: "2026-10-10", source: "Dispenser", qty: 40 }, { date: "2026-10-11", qty: 60.5 }, { date: "2026-10-11", source: "Tank 2", litres: 10 }] }])');
    assert.strictEqual(run('() => mainPlace_()'), 'Dispenser', 'no source = the main place (update-117: the site\'s first diesel place)');
    assert.deepStrictEqual(f, { dates: ['2026-10-10', '2026-10-11'], byLoc: { Dispenser: 100.5, 'Tank 2': 10 }, qty: 110.5 });
    assert.strictEqual(run('() => flowFacts_("deleteDieselIssue", [{ qty: 50 }]).qty'), 0, 'a delete takes nothing out');
    run('() => { const r = flowRules_(); r.tasks["Diesel Issue"] = { on: true, levels: [["c1@rcl.test"]], daysBack: "", qtyAbove: 100 }; kvWrite_("FLOW_RULES", JSON.stringify(r)); }');
    assert.strictEqual(run('() => !!flowRuleFor_({ email: "m114@rcl.test" }, API_.saveDieselIssue, "saveDieselIssue", [{ date: "2026-10-14", qty: 100 }])'), false, '100 L: not more than 100 – saved at once');
    assert.strictEqual(run('() => !!flowRuleFor_({ email: "m114@rcl.test" }, API_.saveDieselIssue, "saveDieselIssue", [{ date: "2026-10-14", qty: 101 }])'), true);
    assert.strictEqual(run('() => !!flowRuleFor_({ email: "m114@rcl.test", super: true }, API_.saveDieselIssue, "saveDieselIssue", [{ qty: 500 }])'), false);
    run('() => { const t = crTable_(true), row = newRow_(t); set_(row, t, "Request ID", "VF-00099"); set_(row, t, "Kind", "Flow"); set_(row, t, "Status", "Pending"); set_(row, t, "Requester Email", "m114@rcl.test"); set_(row, t, "Requested At", new Date()); set_(row, t, "Data", JSON.stringify({ m: "Diesel Issue", levels: [["c1@rcl.test"]], level: 0, history: [], byLoc: { Dispenser: 150 }, qty: 150, waitSince: new Date(Date.now() - 7 * 3600000).toISOString(), reminded: {} })); t.sh.appendRow(row); sbFlush_(); }');
    assert.strictEqual(run('() => flowReserved_("Dispenser")'), 150);
    assert.strictEqual(run('() => { FLOW_RUN_ID_ = "VF-00099"; try { return flowReserved_("Dispenser"); } finally { FLOW_RUN_ID_ = ""; } }'), 0, 'its own litres are not held against itself');
    const avail = run('d => getIssueBalance_(d, "Day", "", "Dispenser").available', today);
    assert.match(run('(d, q) => requireStockAt_("Dispenser", d, "Day", "", q)', today, avail - 100).THROWN || '', /\(150 Ltr more waits for verification\)/);
    // ---- reminders: older than the hours → the level; twice as long → the Super Admin too; once each ----
    run('() => { crSuperSeen_("sa114@rcl.test"); CacheService.getScriptCache().remove("FLOW_REMIND"); __sent.length = 0; flowRemind_(); }');
    pushes = run('() => __sent');
    const rem = pushes.filter(p => /VF-00099/.test(p.msg.id));
    assert.strictEqual(rem.length, 1); assert.match(rem[0].msg.title, /^Waiting too long – verification of/); assert.ok(rem[0].ids.includes(run('() => rtcUid_("sa114@rcl.test")')));
    run('() => { CacheService.getScriptCache().remove("FLOW_REMIND"); __sent.length = 0; flowRemind_(); }');
    assert.strictEqual(run('() => __sent.filter(p => p.msg.id === "VF-00099").length'), 0, 'not again');
    // ---- the page and the server know the same things ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), rt = fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8');
    assert.match(app, /const FLOW_SENT_RE = \/\^Sent for verification \//);
    assert.match(app, /if \(has\('flow'\)\) crLoad\(true\);/);
    assert.match(app, /call\('decideChangeRequests', \{ ids: ids, approve: approve && !back, revert: !!back, note: note \}\)/);
    assert.match(app, /call\('saveFlowRules', \{ tasks: tasks, remindHours: \$\('fr_hours'\)\.value \}\)/);
    assert.match(rt, /const no = refusedOf\(String\(st\.result\)\);/, 'a copy sent again is told "sent for verification", never "saved"');
    assert.match(run('() => SYNC_KEYS_.join()'), /V_flow/);
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k114.flush; SbBook_.prototype.loadMany = __k114.loadMany; SbSheet_.prototype.load_ = __k114.load_; sbDiscard_ = __k114.discard; rtcPush_ = __k114.push;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); TABLE_MEMO_ = {};`, ctx);
  }
});

test('update-115: a machinery that left the site (Inactive From) – not shown, not pending, no entry from that date; the Asset Master dates show it when it was on site', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  // the page's rule (taken from the page itself) and the server's are the same rule
  const pick = re => { const m = app.match(re); assert.ok(m, String(re)); return m[0]; };
  const page = new Function(pick(/const mDay = .*\n/) + pick(/const mPeriods = .*\n/) + pick(/const onSiteOn = .*\n/) + pick(/const onSiteIn = .*\n/) + 'return { onSiteOn, onSiteIn };')();      // (update-119: with its periods on site)
  const left = { id: 'IN-1', activeFrom: '2026-08-01', status: 'Inactive', inactiveFrom: '2026-10-01' };
  const days = ['2026-07-31', '2026-08-01', '2026-09-30', '2026-10-01', '2026-10-15'];
  assert.deepStrictEqual(days.map(d => page.onSiteOn(left, d)), [false, true, true, false, false], 'on site 01-08 … 30-09');
  assert.deepStrictEqual(days.map(d => run('(m, d) => onSiteOn_(m, d)', left, d)), [false, true, true, false, false], 'the server: the same');
  assert.deepStrictEqual(days.map(d => !run('(m, d) => { try { assertActive_(m, d); return true; } catch (e) { return false; } }', left, d)), [true, false, false, true, true], 'an entry is refused on exactly the days it is not on site');
  // his example: inactive from the 1st – a list of 1st … 5th does not show it, a list that has the 30th does
  assert.strictEqual(page.onSiteIn(left, '2026-10-01', '2026-10-05'), false);
  assert.strictEqual(page.onSiteIn(left, '2026-09-30', '2026-10-05'), true);
  assert.strictEqual(page.onSiteIn(left, '2026-07-01', '2026-07-31'), false, 'before it came');
  assert.strictEqual(page.onSiteIn({ status: 'Inactive', inactiveFrom: '' }, '2000-01-01', '2099-01-01'), false, 'Inactive with no date = not on site (as the server)');
  assert.strictEqual(page.onSiteOn({ status: 'Active' }, '2026-10-15'), true);
  const leaving = { status: 'Inactive', inactiveFrom: '2026-10-20' };
  assert.strictEqual(page.onSiteOn(leaving, '2026-10-15'), true, 'leaves next week: still on site today');
  // the server: not pending from that date; the papers / BOQ / tank lists by the date, not by the word "Inactive" alone
  run('(x, m) => saveVendor_(x, m)', { name: 'Left V115', gstReg: 'No', pan: 'ABCPL1150L', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  assert.ok(run('(x, m) => saveMaster_(x, m)', { no: 'LFT-115', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Left V115', ownership: 'Rental', supply: 'Company', status: 'Inactive', activeFrom: '2026-09-25', inactiveFrom: '2026-10-01' }, 'add').ok);
  assert.ok(run('(x, m) => saveMaster_(x, m)', { no: 'LVG-115', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Left V115', ownership: 'Rental', supply: 'Company', status: 'Inactive', activeFrom: '2026-09-25', inactiveFrom: run('() => addDays_(today_(), 5)') }, 'add').ok);
  const pend = run('() => pendingLogs_({ from: "2026-09-28", to: "2026-10-03" })');
  const dates = no => (pend.items || []).filter(x => x.no === no).map(x => x.date);
  assert.deepStrictEqual(dates('LFT-115'), ['2026-09-28', '2026-09-29', '2026-09-30'], 'pending only while it was on site');
  const miss = run('d => boqMissing_({ date: d }).rows.map(r => r.no)', run('() => today_()'));
  assert.ok(!miss.includes('LFT-115') && miss.includes('LVG-115'), 'BOQ missing: only machinery on site that day (the one leaving next week still counts)');
  assert.ok(run('d => boqMissing_({ date: d }).rows.map(r => r.no)', '2026-09-30').includes('LFT-115'), '…and on a date it was on site, it counts');
  // the page: the pickers where an entry is made use the list of the entry's date; filters keep every machinery
  ['d_no" list="dl_mach_on" data-on="d_date"', 'tc_no" list="dl_mach_on" data-on="tc_date"', 'lg_top_no" list="dl_mach_on" data-on="lg_top_date"', 'data-f="no" list="dl_mach_on" data-on="bd_date"', 'data-f="no" list="dl_mach_on" data-on="row"']
    .forEach(x => assert.ok(app.includes(x), x));
  ['df_no" list="dl_machines"', 'lf_no" list="dl_machines"', 'lx_no" list="dl_machines"', 'bm_no" list="dl_machines"'].forEach(x => assert.ok(app.includes(x), x));
  assert.match(app, /\$\('dl_mach_on'\)\.innerHTML = \(S\.master \|\| \[\]\)\.filter\(m => !dk \|\| onSiteOn\(m, dk\)\)/);
  assert.match(app, /<label for="mf_from">On site from<\/label><input id="mf_from" type="date">/);
  assert.match(app, /if \(!S\.mfDated && S\.today\) \{ S\.mfDated = true; \$\('mf_from'\)\.value = S\.today; \$\('mf_to'\)\.value = S\.today; \}/);
  assert.ok(!/status !== 'Inactive'/.test(app), 'no list of the page looks at the word "Inactive" without its date');
  assert.ok(!/m\.status !== 'Inactive'/.test(fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8')), '…nor of the server');
});

test('update-116: "Send to verification" for the works under a rule; sent back with a question, answered and sent again or taken back; the sender reminded; diesel KM / Hrs by itself', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  vm.runInContext(`globalThis.__k116 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB116 = {};
    globalThis.__fill116 = s => { const d = DB116[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep116 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill116(s); if (s.loaded) DB116[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    if (SB_BOOK_) __keep116(SB_BOOK_);
    SbBook_.prototype.flush = function () { __keep116(this); __k116.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill116(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill116(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    globalThis.__sent = []; rtcPush_ = function (ids, msg) { __sent.push({ ids: ids, msg: msg }); };`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'b'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('mahesh@rcl.test', 'Mahesh Jadhav', false, { 'Vendor Master': 'Edit', 'Diesel Inward': 'Edit' }), mk('shubham@rcl.test', 'Shubham', false), mk('sa116@rcl.test', 'Super B', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok116_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa116@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const V = n => ({ name: n, gstReg: 'No', pan: 'ABCPV1116A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' });
    // ---- his rules reach his page (getInit / Approvals): the button says "Send to verification" ----
    assert.ok(api('sa116@rcl.test', 'saveFlowRules', { tasks: { 'Vendor Master': { on: true, levels: [['shubham@rcl.test']] }, 'Diesel Inward': { on: true, levels: [['shubham@rcl.test']], daysBack: '3' } } }).ok);
    const mine = api('mahesh@rcl.test', 'getInit').flow;
    assert.deepStrictEqual(mine['Vendor Master'], { daysBack: '', qtyAbove: '', to: ['Shubham'], levels: 1 });
    assert.strictEqual(mine['Diesel Inward'].daysBack, 3);
    assert.deepStrictEqual(api('sa116@rcl.test', 'getInit').flow, {}, 'the Super Admin: none (saved at once)');
    assert.deepStrictEqual(Object.keys(api('mahesh@rcl.test', 'getChangeRequests', {}).mine).sort(), ['Diesel Inward', 'Vendor Master']);
    // ---- sent; Shubham sends it back with a question (a remark is needed) ----
    assert.match(api('mahesh@rcl.test', 'saveVendor', V('Rev 116'), 'add').THROWN, /^Sent for verification to Shubham – (VF-\d{5})/);
    const id = run('() => flowAll_().filter(r => r.status === "Pending").pop().id');
    assert.match(api('shubham@rcl.test', 'decideChangeRequest', { id: id, revert: true }).THROWN, /Write the remark or question/);
    run('() => { __sent.length = 0; }');
    let r = api('shubham@rcl.test', 'decideChangeRequest', { id: id, revert: true, note: 'Which PAN is right?' });
    assert.ok(r.status === 'Reverted' && r.list, JSON.stringify(r).slice(0, 200));
    assert.deepStrictEqual(run('() => __sent.map(p => [p.ids, p.msg.title, p.msg.body])')[0], [run('() => [rtcUid_("mahesh@rcl.test")]'), 'Sent back to you – ' + run('id => flowAll_().find(r => r.id === id).summary[0]', id).slice(0, 70), 'Shubham: Which PAN is right?']);
    let q = api('mahesh@rcl.test', 'getChangeRequests', {});
    let row = q.requests.find(x => x.id === id);
    assert.ok(row.canAnswer && !row.canDecide && row.reverted.note === 'Which PAN is right?' && q.backToMe === 1 && q.forMe === 1, JSON.stringify(row).slice(0, 300));
    assert.ok(!api('shubham@rcl.test', 'getChangeRequests', {}).requests.find(x => x.id === id).canDecide, 'not waiting for Shubham now');
    assert.match(api('shubham@rcl.test', 'answerFlow', { id: id, note: 'x' }).THROWN, /Only the person who sent this entry answers it/);
    assert.match(api('mahesh@rcl.test', 'answerFlow', { id: id }).THROWN, /Write your answer/);
    assert.match(api('shubham@rcl.test', 'decideChangeRequest', { id: id, approve: true }).THROWN, /already reverted/);
    // ---- reminders: every 30 minutes until he answers ----
    run('() => { __sent.length = 0; CacheService.getScriptCache().remove("FLOW_REMIND"); flowRemind_(); }');
    assert.strictEqual(run('() => __sent.length'), 0, 'not yet 30 minutes');
    run(`id => { const t = crTable_(false), r1 = t.rows.map((r, i) => crOut_(t, r, i)).find(r => r.id === id), f = JSON.parse(r1.data); f.reverted.at = new Date(Date.now() - 31 * 60000).toISOString();
      const row = t.rows[r1.i].slice(); set_(row, t, 'Data', JSON.stringify(f)); t.sh.getRange(r1.i + 2, 1, 1, row.length).setValues([row]); sbFlush_(); }`, id);
    run('() => { __sent.length = 0; CacheService.getScriptCache().remove("FLOW_REMIND"); flowRemind_(); }');
    assert.match(run('() => __sent.map(p => p.msg.title).join("|")'), /^Waiting for your answer – /);
    run('() => { __sent.length = 0; CacheService.getScriptCache().remove("FLOW_REMIND"); flowRemind_(); }');
    assert.strictEqual(run('() => __sent.length'), 0, 'the next one after another 30 minutes');
    // ---- he answers: back to Shubham (same level), who approves – saved ----
    r = api('mahesh@rcl.test', 'answerFlow', { id: id, note: 'PAN as typed is right' });
    assert.ok(r.status === 'Pending', JSON.stringify(r).slice(0, 200));
    row = api('shubham@rcl.test', 'getChangeRequests', {}).requests.find(x => x.id === id);
    assert.ok(row.canDecide && row.history.map(h => h.step).join() === 'Sent,Reverted,Answered', JSON.stringify(row.history));
    assert.strictEqual(api('shubham@rcl.test', 'decideChangeRequest', { id: id, approve: true }).status, 'Approved');
    assert.ok(run('() => getVendors_().some(v => (v.name || v) === "Rev 116")'));
    // ---- another: sent back, then taken back – nothing saved; several sent back at once ----
    assert.match(api('mahesh@rcl.test', 'saveVendor', V('Rev 116 B'), 'add').THROWN, /^Sent for verification/);
    const id2 = run('() => flowAll_().filter(r => r.status === "Pending").pop().id');
    api('shubham@rcl.test', 'decideChangeRequests', { ids: [id2], revert: true, note: 'duplicate?' });
    assert.strictEqual(run('id => flowAll_().find(r => r.id === id).status', id2), 'Reverted', 'several at once: sent back');
    assert.strictEqual(api('mahesh@rcl.test', 'answerFlow', { id: id2, withdraw: true }).status, 'Withdrawn');
    assert.ok(!run('() => getVendors_().some(v => (v.name || v) === "Rev 116 B")'));
    assert.match(api('mahesh@rcl.test', 'answerFlow', { id: id2, note: 'again' }).THROWN, /not sent back to you \(it is withdrawn\)/);
    // ---- the page: the buttons, the diesel way ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    ['d_save', 'bd_save', 'bm_save', 'i_save', 't_save', 'tb_save', 'l_save', 'm_save', 'v_save', 'boq_save', 'py_save'].forEach(b => assert.ok(new RegExp('\\b' + b + ': \\{ m: ').test(app), b));
    assert.match(app, /const want = S\.flowFix && FIX_BTN\[S\.flowFix\.form\] === id \? 'Send again \(' \+ S\.flowFix\.id \+ '\)' : flowWill\(id\) \? 'Send to verification' : x\.dataset\.flowOrig;/);      // (update-130: correcting a returned entry)
    assert.match(app, /S\.flowMine = d\.flow \|\| \{\}/);
    // the page's dieselWay (taken from the page) on machinery of the Asset Master
    const src = app.slice(app.indexOf('  function dieselWay(m) {'), app.indexOf('  function dieselWayMount('));
    const dw = new Function('modesOf', 'hasKm', 'hasHr', src + ' return dieselWay;')(m => m.modes, w => w === 'KM' || w === 'KM + Hrs', w => w === 'Hrs' || w === 'KM + Hrs');
    assert.deepStrictEqual([
      dw({ unit: 'KM', modes: ['KM'] }), dw({ unit: 'Hrs', modes: ['Hrs', 'Time'] }), dw({ unit: 'KM + Hrs', modes: ['KM', 'Hrs', 'KM + Hrs'] }),
      dw({ unit: 'Day', modes: ['Trip'] }), dw({ unit: '', modes: ['KM', 'Hrs', 'KM + Hrs'] })], ['KM', 'Hrs', 'KM + Hrs', '', 'KM + Hrs']);
    assert.ok((app.match(/dieselWayMount\(/g) || []).length === 4, 'single, many rows, one machinery – many dates (+ its definition)');
    assert.match(app, /title="Meter not working: no reading for this fill">Meter not working<\/button>/);
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k116.flush; SbBook_.prototype.loadMany = __k116.loadMany; SbSheet_.prototype.load_ = __k116.load_; sbDiscard_ = __k116.discard; rtcPush_ = __k116.push;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); TABLE_MEMO_ = {};`, ctx);
  }
});

test('update-117: every site its own diesel places (18B: Camp Pump + 2 dispensers) – set by the Super Admin in the Portal; the first site stays Dispenser + VTR Store', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // a stand-in database of its own (empty): what a failed save wrote is thrown away
  vm.runInContext(`globalThis.__k117 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB117 = {};
    globalThis.__fill117 = s => { const d = DB117[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep117 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill117(s); if (s.loaded) DB117[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep117(this); __k117.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill117(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill117(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    rtcPush_ = function () {};
    kvWrite_("FLOW_RULES", "{}");`, ctx);
  // the Portal's two functions of Sites.gs (the rest of Sites.gs needs the server)
  const sitesGs = fs.readFileSync(path.join(root, 'app', 'Sites.gs'), 'utf8');
  vm.runInContext(sitesGs.slice(sitesGs.indexOf('function sysPlacesSave_('), sitesGs.indexOf('/* ---- (update-95) "New site"')), ctx);
  const P = PL => run('p => PropertiesService.getScriptProperties().setProperties({ DIESEL_PLACES: p })', PL);
  try {
    // ---- a site without its own setting (the first site, VTR): exactly as before ----
    run('() => { PropertiesService.getScriptProperties().deleteProperty("DIESEL_PLACES"); }');
    assert.deepStrictEqual(run('() => [placeNames_(), mainPlace_(), meterPlaces_(), tankSettings_().own]'), [['Dispenser', 'VTR Store'], 'Dispenser', { Dispenser: true }, false]);
    assert.match(run('() => { try { checkLoc_("Camp Pump", "Diesel Source"); } catch (e) { return e.message; } }'), /^Select Diesel Source \(Dispenser \/ VTR Store\)\.$/);
    assert.strictEqual(run('() => loc_("")'), 'Dispenser', 'an old entry without a place: the Dispenser, as before');
    const mT = { id: 'X-117', unit: 'KM', supply: 'Company' };
    assert.deepStrictEqual(run('m => [validateDiesel_({ qty: 5, source: "Dispenser", meter: 12345 }, m).meter, validateDiesel_({ qty: 5, source: "VTR Store", meter: 12345 }, m).meter]', mT), [12345, ''], 'the pump counter reading: only at the Dispenser, as before');
    assert.ok(!/APP\.(LOCATIONS|MAIN_LOC)/.test(fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8') + fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8')), 'no fixed list of places is left');
    // ---- the Super Admin's check of the places ----
    const bad = list => run('l => { try { savePlaces_(l); return "saved"; } catch (e) { return e.message; } }', list);
    assert.match(bad([]), /Add at least one diesel place/);
    assert.match(bad([{ name: '', cap: 10 }]), /Diesel place 1: enter its name/);
    assert.match(bad([{ name: 'Camp Pump', cap: 18000 }, { name: 'camp  pump', cap: 2650 }]), /"camp pump" is there twice/);
    assert.match(bad([{ name: 'Camp Pump', cap: 0 }]), /tank size \(Ltr\) for Camp Pump/);
    assert.match(bad([{ name: '<b>Pump', cap: 10 }]), /use letters, digits/);
    assert.match(bad(Array.from({ length: 13 }, (_, i) => ({ name: 'T' + i, cap: 10 }))), /Up to 12 diesel places/);
    assert.strictEqual(run('() => PropertiesService.getScriptProperties().getProperty("DIESEL_PLACES")'), null, 'nothing was written');
    // ---- 18B: set from the Portal (Sites.gs sysPlacesSave_), with the Activity Log line ----
    const SA = { email: 'sa117@rcl.test' };
    let r = run('(l, by) => sysPlacesSave_(l, by)', [{ name: ' Camp  Pump ', cap: 18000 }, { name: 'MH12ZE1739', cap: 2650 }, { name: 'MH12WJ1381', cap: 2650.4 }], SA.email);
    assert.deepStrictEqual(r.places.map(p => [p.name, p.cap, p.meter, p.used, p.stock]), [['Camp Pump', 18000, false, false, 0], ['MH12ZE1739', 2650, false, false, 0], ['MH12WJ1381', 2650, false, false, 0]]);
    assert.deepStrictEqual(run('() => [placeNames_(), mainPlace_(), meterPlaces_(), tankSettings_()]'), [['Camp Pump', 'MH12ZE1739', 'MH12WJ1381'], 'Camp Pump', {}, { caps: { 'Camp Pump': 18000, MH12ZE1739: 2650, MH12WJ1381: 2650 }, low: 1000, own: true }]);
    const log = run('() => { const t = table_(LOG_SHEET, []); return t.rows.map(x => x.join(" | ")).filter(x => /Diesel places set/.test(x)).pop() || ""; }');
    assert.match(log, /sa117@rcl\.test \| Super Admin \(Portal\) \| Edit \| Settings \| Diesel places \| Diesel places set by the Super Admin in the Portal: Camp Pump 18000 Ltr, MH12ZE1739 2650 Ltr, MH12WJ1381 2650 Ltr \| Before: Dispenser 10000 Ltr, VTR Store 10000 Ltr/);
    // the page and the phone app get them (getInit, and getLookups for a page already open)
    const PW = 'sha256$0123456789abcdef$' + 'c'.repeat(64);
    const u = run(`pw => { const o = {}; MODULES.forEach(m => { o[m] = 'Edit'; }); return { email: 'm117@rcl.test', name: 'Maker 117', password: pw, active: true, admin: true, perms: o }; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', [u]);
    run('(e, pw) => CacheService.getScriptCache().put("S_tok117", sessionMake_(e, pw, 3600000, false), 3600)', u.email, PW);
    // (21-10-2026) two saves in the SAME millisecond have the same "created" time, and the stock then orders them by kind, not by
    // which came first – a transfer out could come before the transfer in that it needs (this test failed about 1 run in 7).
    // People never save twice in one millisecond; the test waits for the next one.
    const api = (fn, ...a) => { const t0 = Date.now(); while (Date.now() === t0) { /* the next millisecond */ } return run('(f, a) => api("tok117", f, a)', fn, a); };
    assert.deepStrictEqual(api('getInit').locations, ['Camp Pump', 'MH12ZE1739', 'MH12WJ1381']);
    assert.deepStrictEqual(api('getLookups').locations, ['Camp Pump', 'MH12ZE1739', 'MH12WJ1381']);
    // ---- the diesel of 18B: inward at any of the 3, transfers pump → dispenser and dispenser → dispenser, issue from any ----
    const today = run('() => today_()');
    assert.ok(api('saveMaster', { no: 'TP-117', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add').ok);
    const inw = (loc, qty, bill) => api('saveInward', { date: today, location: loc, pump: 'HP Pump', qty: qty, rate: 92, billNo: bill, billDate: today });
    assert.ok(inw('Camp Pump', 5000, 'B117-1').ok);
    assert.ok(inw('mh12wj1381', 100, 'B117-2').ok, 'the name in any case');
    assert.match(inw('Dispenser', 10, 'B117-3').THROWN, /^Select Received at \(Camp Pump \/ MH12ZE1739 \/ MH12WJ1381\)\.$/, 'the first site\'s places are not places of 18B');
    assert.ok(api('saveTransfer', { date: today, shift: 'Day', from: 'Camp Pump', to: 'MH12ZE1739', qty: 1000 }).ok);
    assert.ok(api('saveTransfer', { date: today, shift: 'Day', from: 'MH12ZE1739', to: 'MH12WJ1381', qty: 300 }).ok);
    assert.match(api('saveTransfer', { date: today, shift: 'Day', from: 'MH12WJ1381', to: 'Camp Pump', qty: 401 }).THROWN, /Not enough diesel at MH12WJ1381 .*Available: 400 Ltr/);
    assert.ok(api('saveDieselIssue', { date: today, shift: 'Day', source: 'MH12WJ1381', no: 'TP-117', qty: 150, kmReading: 1000, force: true }).ok);
    assert.ok(api('saveDieselIssue', { date: today, shift: 'Day', source: 'Camp Pump', no: 'TP-117', qty: 50, kmReading: 1100, force: true }).ok);
    assert.match(api('saveDieselIssue', { date: today, shift: 'Day', source: 'MH12ZE1739', no: 'TP-117', qty: 701, kmReading: 1200, force: true }).THROWN, /Not enough diesel at MH12ZE1739 .*Available: 700 Ltr/);
    assert.match(api('saveDieselIssue', { date: today, shift: 'Day', source: 'VTR Store', no: 'TP-117', qty: 5, kmReading: 1200, force: true }).THROWN, /^Select Diesel Source \(Camp Pump \/ MH12ZE1739 \/ MH12WJ1381\)\.$/);
    assert.ok(api('saveDieselIssue', { date: today, shift: 'Day', no: 'TP-117', qty: 10, kmReading: 1300, force: true }).ok, 'no source: the first place (Camp Pump)');
    const st = run('() => getStock_()');
    assert.deepStrictEqual([st.byLoc, st.stock, st.inward, st.issued], [{ 'Camp Pump': 3940, MH12ZE1739: 700, MH12WJ1381: 250 }, 4890, 5100, 210]);
    const sum = run('d => stockSummary_(events_(stockTables_()), d, d)', today).map(x => [x.loc, x.inward, x.tin, x.tout, x.issued, x.closing]);
    assert.deepStrictEqual(sum, [['Camp Pump', 5000, 0, 1000, 60, 3940], ['MH12ZE1739', 0, 1000, 300, 0, 700], ['MH12WJ1381', 100, 300, 0, 150, 250]]);
    // (update-159, asked 25-10-2026) each other stock point on its own – "Received from" / "Sent to" never "A / B" together
    const by = run('d => stockSummary_(events_(stockTables_()), d, d)', today).map(x => [x.loc, x.tinBy, x.toutBy, x.others]);
    assert.deepStrictEqual(by, [['Camp Pump', {}, { MH12ZE1739: 1000 }, ['MH12ZE1739', 'MH12WJ1381']], ['MH12ZE1739', { 'Camp Pump': 1000 }, { MH12WJ1381: 300 }, ['Camp Pump', 'MH12WJ1381']],
      ['MH12WJ1381', { MH12ZE1739: 300 }, {}, ['Camp Pump', 'MH12ZE1739']]]);
    const lg = run('f => getStockLedger_(f)', { from: today, to: today, location: 'MH12ZE1739' }), lg0 = lg.rows[0];
    assert.deepStrictEqual([lg.others, lg0.tinBy, lg0.toutBy, lg0.tin, lg0.tout, lg0.closing], [['Camp Pump', 'MH12WJ1381'], { 'Camp Pump': 1000 }, { MH12WJ1381: 300 }, 1000, 300, 700], 'the totals as before');
    const rdy = run('f => getDailyInwardIssueReport_(f)', { from: today, to: today, location: 'Camp Pump' });
    assert.deepStrictEqual([rdy.otherLocations, rdy.rows[0].toutBy, rdy.totals.toutBy, rdy.totals.tinBy, rdy.totals.tout, rdy.totals.closing], [['MH12ZE1739', 'MH12WJ1381'], { MH12ZE1739: 1000 }, { MH12ZE1739: 1000 }, {}, 1000, 3940]);
    const rdw = run('f => getDailyInwardIssueReport_(f)', { from: today, to: today, location: 'MH12WJ1381' });
    assert.deepStrictEqual([rdw.otherLocations, rdw.totals.tinBy, rdw.totals.tin, rdw.totals.closing], [['Camp Pump', 'MH12ZE1739'], { MH12ZE1739: 300 }, 300, 250]);
    // the Transfer list's stock point is the FROM only ("jo stock point asel tithun transfer asel trch")
    const tl = l => run('f => getTransfers_(f)', { from: today, to: today, location: l }).rows.map(r => r.from + ' > ' + r.to);
    assert.deepStrictEqual(tl('Camp Pump'), ['Camp Pump > MH12ZE1739']);
    assert.deepStrictEqual(tl('MH12ZE1739'), ['MH12ZE1739 > MH12WJ1381'], 'not the transfer that came TO it');
    assert.deepStrictEqual(tl('MH12WJ1381'), [], 'nothing was sent from it');
    assert.strictEqual(tl('').length, 2, 'All: every transfer');
    // the pump counter reading: only where the place has one (the first site's Dispenser) – none at 18B
    assert.strictEqual(run('() => validateDiesel_({ qty: 5, source: "Camp Pump", meter: 12345 }, findMachine_("TP-117")).meter'), '');
    // ---- a place with entries keeps its name; it is not taken away; new places and tank sizes can change ----
    const cur = [{ name: 'Camp Pump', cap: 18000 }, { name: 'MH12ZE1739', cap: 2650 }, { name: 'MH12WJ1381', cap: 2650 }];
    assert.match(bad(cur.slice(0, 2)), /^Diesel place MH12WJ1381 has entries – it cannot be renamed or taken away\.$/);
    assert.match(bad([{ name: 'Camp Tank', cap: 18000 }].concat(cur.slice(1))), /Camp Pump has entries/);
    r = run('l => savePlaces_(l)', [cur[1], cur[0], cur[2], { name: 'Tanker MH09 4521', cap: 6000 }].map((p, i) => i === 1 ? { name: p.name, cap: 20000 } : p));
    assert.deepStrictEqual(r.places.map(p => [p.name, p.cap, p.used, p.stock]), [['MH12ZE1739', 2650, true, 700], ['Camp Pump', 20000, true, 3940], ['MH12WJ1381', 2650, true, 250], ['Tanker MH09 4521', 6000, false, 0]], 'no entry without a place here: the order may change');
    assert.ok(api('saveInward', { date: today, location: 'Tanker MH09 4521', pump: 'HP Pump', qty: 10, rate: 92, billNo: 'B117-4', billDate: today }).ok, 'the new place is a place at once');
    // a place used only by an entry that waits for verification is kept too
    const fl = run('() => { const keep = flowAll_; flowAll_ = () => [{ status: "Pending", flow: { byLoc: { "Tanker MH09 4521": 5 } } }, { status: "Approved", flow: { byLoc: { "MH12ZE1739": 1 } } }]; try { const T = { it: { rows: [], c: {} }, tt: { rows: [], c: {} }, dt: { rows: [], c: {} } }; return placesUsed_(T); } finally { flowAll_ = keep; } }');
    assert.deepStrictEqual(fl, { at: { 'TANKER MH09 4521': true }, blank: false, any: false });
    // old entries without a place (the first site's oldest): they count at the first place – it stays the first
    const blank = run(`l => { const keep = stockTables_;
      stockTables_ = () => ({ it: { rows: [[''], ['VTR Store']], c: { [H.LOC]: 0 } }, tt: { rows: [], c: { [H.FROM]: 0, [H.TO]: 1 } }, dt: { rows: [], c: { [H.SOURCE]: 0 } } });
      try { try { savePlaces_(l); return 'saved'; } catch (e) { return e.message; } } finally { stockTables_ = keep; } }`, [{ name: 'Camp Pump', cap: 1 }, { name: 'MH12ZE1739', cap: 1 }, { name: 'MH12WJ1381', cap: 1 }, { name: 'Tanker MH09 4521', cap: 1 }]);
    assert.strictEqual(blank, 'MH12ZE1739 must stay the first diesel place: old entries without a place count there.');
    // ---- New site (system.js siteSetup → Sites.gs sysPlacesSetup_): set once; a site with its places keeps them ----
    assert.deepStrictEqual(run('() => sysPlacesSetup_({ places: [{ name: "X", cap: 1 }] })'), { ok: true, note: 'already set: MH12ZE1739, Camp Pump, MH12WJ1381, Tanker MH09 4521 (to change them: Sites → Diesel places)' });
    assert.ok(run('() => sysPlacesSetup_({ keep: true })').ok);
    run('() => { PropertiesService.getScriptProperties().deleteProperty("DIESEL_PLACES"); }');
    DB117reset();
    assert.deepStrictEqual(run('() => sysPlacesSetup_({ places: [] })'), { ok: false, note: 'Add the diesel places of this site (name and tank size), then press Check & set up again.' });
    assert.deepStrictEqual(run('() => sysPlacesSetup_({ places: [{ name: "Camp Pump", cap: 18000 }, { name: "Camp Pump", cap: 1 }] })'), { ok: false, note: 'Diesel place "Camp Pump" is there twice.' });
    assert.deepStrictEqual(run('() => sysPlacesSetup_({ places: [{ name: "Camp Pump", cap: 18000 }, { name: "MH12ZE1739", cap: 2650 }], by: "sa117@rcl.test" })'), { ok: true, note: 'Camp Pump (18000 Ltr), MH12ZE1739 (2650 Ltr)' });
    // ---- the Portal's door: two acts; the ticket carries the places; system.js has the step ----
    assert.match(sitesGs, /if \(c\.act === 'places'\) return placesInfo_\(\);[^\n]*\n  if \(c\.act === 'placesSave'\) return sysPlacesSave_\(c\.places, c\.by, c\.mode\);/);      // (update-164: with the fuel-card mode)
    const portalJs = fs.readFileSync(path.join(root, 'server', 'portal.js'), 'utf8'), sysJs = fs.readFileSync(path.join(root, 'server', 'system.js'), 'utf8');
    assert.match(portalJs, /if \(c\.act === 'placesSave'\) return Object\.assign\(out, \{ places: placesOf\(c\.places\) \}, c\.mode === 'card' \|\| c\.mode === 'stock' \? \{ mode: c\.mode \} : \{\}\);/);
    assert.match(portalJs, /company: \{ id: [^\n]*\}, places: placesOf\(c\.places\) \}\);/);
    assert.match(sysJs, /pl = R\.runIn\(code, 'sysPlacesSetup', \[\{ places: [^\n]*, by: c\.by, keep: same \}\]\);[\s\S]*if \(!add\('places', pl && pl\.ok/);
    assert.match(fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8'), /sysPlacesSetup: sysPlacesSetup_,/);
    // ---- the page: the Dashboard draws one tank per place for such a site; the first site's texts stay as they were ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /if \(TANKS\.own\) \{[^\n]*\n      const key = locs\.map/);
    assert.match(app, /function vtrPlaces\(\) \{ return \(S\.locations \|\| \[\]\)\.join\('\|'\) === 'Dispenser\|VTR Store'; \}/);
    assert.match(app, /'Moved Dispenser ↔ VTR Store \(inside company, not added or removed\)' : 'Moved between the diesel places/);
    assert.match(app, /if \(L\.locations && L\.locations\.length && \(fmChanged \|\| pfChanged \|\| L\.locations\.join\('\|'\) !== \(S\.locations \|\| \[\]\)\.join\('\|'\)\)\) setLocations\(L\.locations\);/);      // (update-163: also when a place's fuel changed)
    const tk = app.slice(app.indexOf('  const DRUM_ICON = '), app.indexOf("  $('tank_set').addEventListener('click'"));
    const H2 = new Function('wavePath', 'esc', 'tkHead', tk + '; return { tankOwnHtml, tankBarrelsHtml };')(() => 'M0 0', x => x, (n, sub) => '[' + n + '|' + sub + ']');
    const own = H2.tankOwnHtml(['Camp Pump', 'MH12ZE1739', 'MH12WJ1381']);
    assert.strictEqual((own.match(/class="tkc tk-one"/g) || []).length, 3);
    assert.ok(/id="gFuel"/.test(own) && /\[MH12WJ1381\|Diesel tank\]/.test(own) && /id="gDrumo2"/.test(own));
    assert.strictEqual((H2.tankBarrelsHtml('VTR Store', 2000).match(/class="brl"/g) || []).length, 10, 'the first site\'s barrels as before');
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k117.flush; SbBook_.prototype.loadMany = __k117.loadMany; SbSheet_.prototype.load_ = __k117.load_; sbDiscard_ = __k117.discard; rtcPush_ = __k117.push;
      PropertiesService.getScriptProperties().deleteProperty("DIESEL_PLACES"); CacheService.getScriptCache().remove("USERS_LIST"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
  function DB117reset() { vm.runInContext('DB117 = {}; SB_BOOK_ = null; TABLE_MEMO_ = {};', ctx); }
});

test('update-118: the sender sees his entries in verification where he made them (and on the Dashboard) and reminds the approvers – one or all, once in 5 minutes', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  vm.runInContext(`globalThis.__k118 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB118 = {};
    globalThis.__fill118 = s => { const d = DB118[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep118 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill118(s); if (s.loaded) DB118[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep118(this); __k118.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill118(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill118(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    globalThis.__sent = []; rtcPush_ = function (ids, msg) { __sent.push({ ids: ids, msg: msg }); };
    kvWrite_("FLOW_RULES", "{}"); kvWrite_("CR_SUPERS", JSON.stringify(["sa118@rcl.test"]));`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'd'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('mahesh118@rcl.test', 'Mahesh Jadhav', false, { 'Vendor Master': 'Edit', 'Diesel Inward': 'Edit' }), mk('shubham118@rcl.test', 'Shubham', false), mk('ravi118@rcl.test', 'Ravi', false, { 'Vendor Master': 'Edit' }), mk('sa118@rcl.test', 'Super C', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok118_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa118@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const V = n => ({ name: n, gstReg: 'No', pan: 'ABCPV1118A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' });
    const M = 'mahesh118@rcl.test', S = 'shubham118@rcl.test';
    assert.ok(api('sa118@rcl.test', 'saveFlowRules', { tasks: { 'Vendor Master': { on: true, levels: [[S]] }, 'Diesel Inward': { on: true, levels: [[M]] } } }).ok);
    const sent = n => (api(M, 'saveVendor', V(n), 'add').THROWN || '').match(/VF-\d{5}/)[0];
    const a = sent('Rem 118 A'), b = sent('Rem 118 B');
    // ---- his list: the work (page) of each, and "Remind" on what waits ----
    let q = api(M, 'getChangeRequests', {}), ra = q.requests.find(x => x.id === a);
    assert.deepStrictEqual([ra.m, ra.task, ra.canRemind, ra.reminds, ra.remindedAt, ra.mine], ['Vendor Master', MODULE_LABEL('Vendor Master'), true, 0, '', true]);
    assert.ok(!api(S, 'getChangeRequests', {}).requests.find(x => x.id === a).canRemind, 'the approver does not remind');
    // ---- the checks ----
    assert.match(api(M, 'remindFlow', {}).THROWN, /^Pick the entries to remind about/);
    assert.match(api(S, 'remindFlow', { ids: [a] }).THROWN, new RegExp('^Only the person who sent entry ' + a + ' reminds about it\\.$'));
    assert.match(api(M, 'remindFlow', { ids: ['VF-99999'] }).THROWN, /^Entry VF-99999 was not found/);
    // ---- one entry: the approver of its level gets a notification now; a step of the entry; the Activity Log ----
    run('() => { __sent.length = 0; }');
    let r = api(M, 'remindFlow', { ids: [a] });
    assert.deepStrictEqual([r.ok, r.reminded, r.later], [true, [a], []]);
    const push = run('() => __sent.map(p => [p.ids, p.msg.t, p.msg.id, p.msg.title, p.msg.body])');
    assert.strictEqual(push.length, 1);
    assert.deepStrictEqual(push[0].slice(0, 4), [run('() => [rtcUid_("shubham118@rcl.test")]'), 'cr', a, 'Reminder from Mahesh Jadhav – ' + MODULE_LABEL('Vendor Master') + ' waits for your approval']);
    assert.match(push[0][4], new RegExp('^' + a + ': '));
    ra = r.list.requests.find(x => x.id === a);
    assert.ok(ra.reminds === 1 && ra.remindedAt && ra.history.some(h => h.step === 'Reminded' && h.by === 'Mahesh Jadhav' && h.note === 'to Shubham'), JSON.stringify(ra).slice(0, 400));
    assert.strictEqual(api(S, 'getChangeRequests', {}).requests.find(x => x.id === a).reminds, 1, 'the approver sees it was reminded');
    assert.ok(run('() => table_(LOG_SHEET, []).rows.some(x => x.join("|").indexOf("Verification – reminder sent by the sender") > -1)'));
    // ---- again within 5 minutes: not sent again, he is told when; "Remind all": the other one goes ----
    run('() => { __sent.length = 0; }');
    r = api(M, 'remindFlow', { ids: [a] });
    assert.ok(r.reminded.length === 0 && r.later.length === 1 && r.later[0].id === a && /^\d{2}:\d{2}$/.test(r.later[0].next), JSON.stringify(r.later));
    r = api(M, 'remindFlow', { all: true });
    assert.deepStrictEqual([r.reminded, r.later.map(l => l.id)], [[b], [a]]);
    assert.strictEqual(run('() => __sent.length'), 1);
    // after 5 minutes it goes again
    run(`id => { const t = crTable_(false), o = t.rows.map((x, i) => crOut_(t, x, i)).find(z => z.id === id), f = JSON.parse(o.data); f.remindedAt = new Date(Date.now() - 6 * 60000).toISOString();
      const row = t.rows[o.i].slice(); set_(row, t, 'Data', JSON.stringify(f)); t.sh.getRange(o.i + 2, 1, 1, row.length).setValues([row]); sbFlush_(); }`, a);
    r = api(M, 'remindFlow', { ids: [a] });
    assert.ok(r.reminded[0] === a && r.list.requests.find(x => x.id === a).reminds === 2);
    // ---- a decided entry is not reminded; nothing waiting: said so ----
    assert.strictEqual(api(S, 'decideChangeRequest', { id: b, approve: true }).status, 'Approved');
    assert.match(api(M, 'remindFlow', { ids: [b] }).THROWN, /^This entry is not waiting for approval any more/);
    assert.ok(!api(M, 'getChangeRequests', {}).requests.find(x => x.id === b).canRemind);
    assert.strictEqual(api(S, 'decideChangeRequest', { id: a, approve: false, note: 'duplicate' }).status, 'Rejected');
    assert.match(api(M, 'remindFlow', { all: true }).THROWN, /^None of your entries is waiting for approval\.$/);
    // ---- nobody else at the level (he is its only person): the Super Admin is reminded ----
    const today = run('() => today_()');
    const c = (api(M, 'saveInward', { date: today, location: 'Dispenser', pump: 'Pump 118', qty: 100, rate: 92, billNo: 'R118', billDate: today }).THROWN || '').match(/VF-\d{5}/)[0];
    run('() => { __sent.length = 0; }');
    r = api(M, 'remindFlow', { ids: [c] });
    assert.deepStrictEqual(run('() => __sent.map(p => p.ids)'), [run('() => [rtcUid_("sa118@rcl.test")]')]);
    assert.strictEqual(r.list.requests.find(x => x.id === c).history.pop().note, 'to the Super Admin');
    // ---- the page: the box on the pages and the Dashboard, the buttons, the approver told on his open page ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /const FV_TABS = \{ 'Diesel Issue': 'diesel', 'Diesel Inward': 'inward', 'Diesel Transfer': 'transfer', 'Log Book': 'log',/);
    assert.match(app, /fvDraw\(\);\n  \}\n  \/\* =+ MY ENTRIES IN VERIFICATION/);
    assert.match(app, /put\('sec-dash', 'fv_dash', fvMine\('', 1\), '', true\);/);
    assert.match(app, /fvRemindSeen\(was, S\.cr\); crDraw\(\);/);
    assert.match(app, /approvals: \{ saves: \[[^\]]*'remindFlow'[^\]]*\]/);      // (update-128 adds resendFlow after it)
    assert.match(app, /const offWith = Object\.keys\(tasks\)\.filter\(m => !tasks\[m\]\.on && tasks\[m\]\.levels\.some\(l => l\.length\)\);/, 'people picked but not ticked: asked before saving');
    const src = app.slice(app.indexOf('  const FV_DAYS = 7;'), app.indexOf('  function fvDraw() {'));
    const F = new Function('S', 'esc', 'crWhen', src + '; return { fvMine, fvHtml };');
    const now = new Date().toISOString(), old = new Date(Date.now() - 9 * 86400000).toISOString();
    const SS = { cr: { requests: [
      { kind: 'Flow', mine: true, m: 'Diesel Issue', id: 'VF-00001', task: 'Diesel Issue', status: 'Pending', at: now, waitSince: now, waitingFor: ['Shubham'], level: 1, levels: 2, canRemind: true, reminds: 2, remindedAt: now, summary: ['Diesel issue MH-1 60 L'] },
      { kind: 'Flow', mine: true, m: 'Diesel Issue', id: 'VF-00002', task: 'Diesel Issue', status: 'Approved', at: now, decidedAt: now, decidedBy: 'Shubham', summary: ['Diesel issue MH-2 40 L'] },
      { kind: 'Flow', mine: true, m: 'Diesel Issue', id: 'VF-00003', task: 'Diesel Issue', status: 'Rejected', at: old, decidedAt: old, decidedBy: 'Shubham', summary: ['old'] },
      { kind: 'Flow', mine: true, m: 'Diesel Inward', id: 'VF-00004', task: 'Diesel Inward', status: 'Reverted', at: old, canAnswer: true, reverted: { by: 'Shubham', note: 'bill?' }, summary: ['Inward 500 L'] },
      { kind: 'Flow', mine: false, m: 'Diesel Issue', id: 'VF-00005', status: 'Pending', at: now, summary: ['not his'] }] } };
    const f = F(SS, x => String(x), x => String(x));
    assert.deepStrictEqual(f.fvMine('Diesel Issue').map(x => x.id), ['VF-00001', 'VF-00002'], 'his, of this page; decided ones of the last 7 days');
    assert.deepStrictEqual(f.fvMine('', 1).map(x => x.id), ['VF-00001', 'VF-00002', 'VF-00004'], 'the Dashboard: all pages, waiting and sent back always');
    const h = f.fvHtml(f.fvMine('Diesel Issue'), 'Diesel Issue', false);
    assert.ok(/Waiting<b>1<\/b>/.test(h) && /Approved<b>1<\/b>/.test(h) && /data-fvr="VF-00001">Remind<\/button><br><small>reminded 2×/.test(h) && /Remind all waiting \(1\)/.test(h) && /at Shubham · level 1 of 2 · since 0 min/.test(h), h);
    assert.ok(/Sent back<b>1<\/b>/.test(f.fvHtml(f.fvMine('', 1), '', true)) && /data-fvopen="1">Answer/.test(f.fvHtml(f.fvMine('', 1), '', true)));
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k118.flush; SbBook_.prototype.loadMany = __k118.loadMany; SbSheet_.prototype.load_ = __k118.load_; sbDiscard_ = __k118.discard; rtcPush_ = __k118.push;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
  function MODULE_LABEL(m) { return vm.runInContext('MODULE_LABEL_', ctx)[m] || m; }
});

test('update-119: a machinery on a site several times – it left, came back: its earlier period is kept; off site in between (entries, pending, pickers); entries made stay on site', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  vm.runInContext(`globalThis.__k119 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_ };
    globalThis.DB119 = {};
    globalThis.__fill119 = s => { const d = DB119[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep119 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill119(s); if (s.loaded) DB119[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep119(this); __k119.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill119(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill119(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    kvWrite_("FLOW_RULES", "{}"); PropertiesService.getScriptProperties().deleteProperty("DIESEL_PLACES");`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'e'.repeat(64);
    const u = run(`pw => { const o = {}; MODULES.forEach(m => { o[m] = 'Edit'; }); return { email: 'a119@rcl.test', name: 'Admin 119', password: pw, active: true, admin: true, perms: o }; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', [u]);
    run('(e, pw) => CacheService.getScriptCache().put("S_tok119", sessionMake_(e, pw, 3600000, false), 3600)', u.email, PW);
    const api = (fn, ...a) => run('(f, a) => api("tok119", f, a)', fn, a);
    const M = (no, x) => Object.assign({ no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, x || {});
    const mOf = id => run('id => getMaster_().find(m => m.id === id)', id);
    const on = (id, days) => run('(id, ds) => { const m = getMaster_().find(x => x.id === id); return ds.map(d => onSiteOn_(m, d)); }', id, days);
    assert.ok(api('saveMaster', M('CB-119'), 'add').ok);
    assert.ok(api('saveInward', { date: '2026-01-01', location: 'Dispenser', pump: 'P119', qty: 2000, rate: 92, billNo: 'B119', billDate: '2026-01-01' }).ok);
    assert.ok(api('saveDieselIssue', { date: '2026-03-10', shift: 'Day', source: 'Dispenser', no: 'CB-119', qty: 50, kmReading: 1000, force: true }).ok);
    // ---- it leaves: an Inactive From that would put an entry off site is refused ----
    assert.match(api('saveMaster', M('CB-119', { status: 'Inactive', inactiveFrom: '2026-03-05' }), 'edit', 'CB-119').THROWN, /^CB-119 has entries on 10-03-2026 \(Diesel Issue\) – with these dates it would not be on site then\. Change the dates, or first delete those entries\.$/);
    assert.ok(api('saveMaster', M('CB-119', { status: 'Inactive', inactiveFrom: '2026-07-01' }), 'edit', 'CB-119').ok);
    assert.deepStrictEqual(on('CB-119', ['2026-06-30', '2026-07-01']), [true, false]);
    // ---- it came back: a date before it left is refused; on 01-09 → the period that ended is kept ----
    assert.match(api('saveMaster', M('CB-119', { activeFrom: '2026-06-15' }), 'edit', 'CB-119').THROWN, /^CB-119 left the site on 01-07-2026: "Active From" \(the day it came back\) must be on or after that – or keep its old Active From \(01-01-2026\) if it never left\.$/);
    assert.ok(api('saveMaster', M('CB-119', { activeFrom: '2026-09-01' }), 'edit', 'CB-119').ok);
    let m = mOf('CB-119');
    assert.deepStrictEqual([m.status, m.activeFrom, m.inactiveFrom, m.earlier], ['Active', '2026-09-01', '', [{ from: '2026-01-01', until: '2026-07-01' }]]);
    assert.strictEqual(run('() => { const t = table_(APP.SHEET_MASTER, MASTER_COLS_); return t.rows.find(r => rowId_(r, t) === "CB-119")[t.c[H.SPER]]; }'), '[{"from":"2026-01-01","until":"2026-07-01"}]', 'kept in "Site Periods" (SQL step 1za)');
    assert.deepStrictEqual(on('CB-119', ['2025-12-31', '2026-03-10', '2026-06-30', '2026-07-01', '2026-08-31', '2026-09-01', '2026-10-15']), [false, true, true, false, false, true, true]);
    // ---- entries: in either period yes; in between and before: refused with the reason ----
    assert.ok(api('saveDieselIssue', { date: '2026-06-20', shift: 'Day', source: 'Dispenser', no: 'CB-119', qty: 10, kmReading: 1100, force: true }).ok, 'its earlier period');
    assert.ok(api('saveDieselIssue', { date: '2026-09-05', shift: 'Day', source: 'Dispenser', no: 'CB-119', qty: 10, kmReading: 1300, force: true }).ok, 'back on site');
    assert.match(api('saveDieselIssue', { date: '2026-08-10', shift: 'Day', source: 'Dispenser', no: 'CB-119', qty: 10, kmReading: 1200, force: true }).THROWN, /^CB-119 was not on this site from 01-07-2026 to 31-08-2026 \(it came back on 01-09-2026\)\. Entry date 10-08-2026 is in that time\.$/);
    assert.match(api('saveDieselIssue', { date: '2025-12-31', shift: 'Day', source: 'Dispenser', no: 'CB-119', qty: 10, kmReading: 900, force: true }).THROWN, /^CB-119 is active only from 01-01-2026\. Entry date 31-12-2025 is before that\.$/);
    // ---- the Log Book pending list: only its days on site ----
    const pend = api('pendingLog', { from: '2026-06-28', to: '2026-09-02' });
    assert.deepStrictEqual((pend.items || []).filter(x => x.no === 'CB-119').map(x => x.date), ['2026-06-28', '2026-06-29', '2026-06-30', '2026-09-01', '2026-09-02']);
    // ---- the earlier periods corrected in the form: checked; one with entries cannot go ----
    assert.match(api('saveMaster', M('CB-119', { activeFrom: '2026-09-01', earlier: [{ from: '2026-01-01', until: '' }] }), 'edit', 'CB-119').THROWN, /earlier period 1 on site – enter the date it left/);
    assert.match(api('saveMaster', M('CB-119', { activeFrom: '2026-09-01', earlier: [{ from: '2026-01-01', until: '2026-05-01' }, { from: '2026-04-01', until: '2026-07-01' }] }), 'edit', 'CB-119').THROWN, /two periods on site overlap \(01-05-2026 and 01-04-2026\)/);
    assert.match(api('saveMaster', M('CB-119', { activeFrom: '2026-09-01', earlier: [{ from: '2026-01-01', until: '2026-09-15' }] }), 'edit', 'CB-119').THROWN, /"Active From" must be on or after 15-09-2026 – the day its earlier period on site ended/);
    assert.match(api('saveMaster', M('CB-119', { activeFrom: '2026-09-01', earlier: [] }), 'edit', 'CB-119').THROWN, /^CB-119 has entries on 10-03-2026, 20-06-2026 \(Diesel Issue\)/, 'its earlier period has entries: it stays');
    assert.ok(api('saveMaster', M('CB-119', { activeFrom: '2026-09-01', earlier: [{ from: '2026-01-01', until: '2026-07-10' }] }), 'edit', 'CB-119').ok, 'a correction that keeps every entry on site');
    assert.deepStrictEqual(mOf('CB-119').earlier, [{ from: '2026-01-01', until: '2026-07-10' }]);
    assert.ok(api('saveMaster', M('CB-119', { activeFrom: '2026-09-01', type: 'Tipper 2' }), 'edit', 'CB-119').ok, 'another change: the periods stay as they are');
    assert.deepStrictEqual(mOf('CB-119').earlier, [{ from: '2026-01-01', until: '2026-07-10' }]);
    // ---- "it never left" (the Inactive was a mistake): the same Active From – the Inactive simply goes, as before ----
    assert.ok(api('saveMaster', M('NL-119', { status: 'Inactive', inactiveFrom: '2026-05-01' }), 'add').ok);
    assert.ok(api('saveMaster', M('NL-119'), 'edit', 'NL-119').ok);
    m = mOf('NL-119'); assert.deepStrictEqual([m.status, m.earlier, on('NL-119', ['2026-06-01'])[0]], ['Active', [], true]);
    // ---- many at once (Asset Master → Edit selected): came back with a new Active From ----
    assert.ok(api('saveMaster', M('BK-119', { status: 'Inactive', inactiveFrom: '2026-04-01' }), 'add').ok);
    let r = api('editMasterMany', ['BK-119'], { status: 'Active', activeFrom: '2026-03-01' });
    assert.ok(!r.ok && /BK-119 left the site on 01-04-2026/.test(r.errors[0].msg), JSON.stringify(r));
    r = api('editMasterMany', ['BK-119'], { status: 'Active', activeFrom: '2026-06-01' });
    assert.ok(r.ok, JSON.stringify(r)); assert.deepStrictEqual(mOf('BK-119').earlier, [{ from: '2026-01-01', until: '2026-04-01' }]);
    // ---- the machinery list of the page / the phone app carries the earlier periods ----
    assert.deepStrictEqual(api('getInit').master.find(x => x.id === 'CB-119').earlier, [{ from: '2026-01-01', until: '2026-07-10' }]);
    // ---- the page: the same rule as the server, the form, the bill rule ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
    const pick = re => { const x = app.match(re); assert.ok(x, String(re)); return x[0]; };
    const P = new Function('isoDate', 'showDate', pick(/const mDay = .*\n/) + pick(/const mPeriods = .*\n/) + pick(/const onSiteOn = .*\n/) + pick(/const onSiteIn = .*\n/) + pick(/const dayBefore = .*\n/) +
      app.slice(app.indexOf('  function siteSpan(m, from, to) {'), app.indexOf('  /* ================= MASTER – filters') > 0 ? app.indexOf('  function siteSpan(m, from, to) {') + app.slice(app.indexOf('  function siteSpan(m, from, to) {')).indexOf('\n  }\n') + 4 : 0) +
      app.slice(app.indexOf('  function activeProblem(m, dk) {'), app.indexOf('  function activeProblem(m, dk) {') + app.slice(app.indexOf('  function activeProblem(m, dk) {')).indexOf('\n  }\n') + 4) +
      'return { onSiteOn, onSiteIn, siteSpan, activeProblem };')(d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), d => d.split('-').reverse().join('-'));      // (the page's isoDate: the local date)
    const cb = mOf('CB-119');
    const days = ['2025-12-31', '2026-03-10', '2026-07-09', '2026-07-10', '2026-08-31', '2026-09-01'];
    assert.deepStrictEqual(days.map(d => P.onSiteOn(cb, d)), on('CB-119', days), 'page = server');
    assert.deepStrictEqual([P.onSiteIn(cb, '2026-07-10', '2026-08-31'), P.onSiteIn(cb, '2026-07-01', '2026-07-10'), P.onSiteIn(cb, '2026-08-01', '2026-09-01')], [false, true, true]);
    assert.deepStrictEqual(P.siteSpan(cb, '2026-07-01', '2026-09-05'), { days: 9 + 5, first: '2026-07-01', last: '2026-09-05' }, '01-07 … 09-07 and 01-09 … 05-09');
    assert.strictEqual(P.activeProblem(cb, '2026-08-10'), 'CB-119 was not on this site from 10-07-2026 to 31-08-2026 (it came back on 01-09-2026). Entry date 10-08-2026 is in that time.');
    assert.strictEqual(run('(m, d) => { try { assertActive_(m, d); return ""; } catch (e) { return e.message; } }', cb, '2026-08-10'), P.activeProblem(cb, '2026-08-10'), 'the same words');
    assert.match(app, /if \(S\.editNo\) m\.earlier = mPerRead\(\)\.filter\(p => p\.from \|\| p\.until\);/);
    assert.match(app, /title: 'Did ' \+ was\.id \+ ' come back to the site\?', ok: 'It came back on this date', cancel: 'It never left'/);
    assert.match(app, /\['activeFrom', 'Active From \(made Active again: the day it came back\)', 'date'\]/);
    assert.match(app, /const final = \(m\.status === 'Inactive' && !!m\.inactiveFrom && String\(m\.inactiveFrom\)\.slice\(0, 10\) <= dayAfter\) \|\| \(m\.earlier \|\| \[\]\)\.some\(p => p\.until > from && p\.until <= dayAfter\);/);
    assert.match(code, /const final = \(!!leftOn && leftOn <= dayAfter\) \|\| \(m\.earlier \|\| \[\]\)\.some\(p => p\.until > from && p\.until <= dayAfter\);/, 'the bill: page = server');
    // ---- the database step ----
    const step = fs.readFileSync(path.join(root, 'sql', 'supabase_step1za_site_periods.sql'), 'utf8');
    assert.match(step, /^alter table public\.master add column if not exists site_periods text;$/m);
    assert.ok(!/drop |delete |update |truncate /i.test(step.replace(/^--.*$/mg, '')), 'it only adds');
    const listed = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1za_site_periods.sql');
    assert.ok(listed && listed.sql === step, 'Read Me lists it word for word');
    assert.match(fs.readFileSync(path.join(root, 'app', 'SupabaseSync.gs'), 'utf8'), /\['Site Periods', 'site_periods', 'text'\]/);
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k119.flush; SbBook_.prototype.loadMany = __k119.loadMany; SbSheet_.prototype.load_ = __k119.load_; sbDiscard_ = __k119.discard;
      CacheService.getScriptCache().remove("USERS_LIST"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
});

test('update-120: the bill copies of a diesel inward – several, from the camera or the gallery; only the user\'s own (or the inward\'s own on an edit); photos of an entry sent for verification kept for its approval', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  const B = n => 'inward/2026-10/' + String(n).padStart(8, '0') + '-7e7b-4666-9174-de383d96c72f.jpg';
  // ---- the list kept with an inward: only names of the folder inward/ ----
  assert.strictEqual(run('v => billList_(v).length', JSON.stringify([{ p: B(1) }, { p: '2026-10/3d7333fb-7e7b-4666-9174-de383d96c72f.jpg' }, { p: 'inward/../../etc/passwd' }, null])), 1);
  assert.strictEqual(run('v => billList_(v).length', 'not a list'), 0);
  assert.strictEqual(run('v => billList_(v).length', ''), 0);
  vm.runInContext('globalThis.__k120 = { ready: billsReady_ }; billsReady_ = function () {};', ctx);      // (the column is there – the unit tests run on the Sheet copy)
  try {
    const put = (p, rec) => run('(p, r) => CacheService.getScriptCache().put("PH_" + p, JSON.stringify(r), 21600)', p, rec);
    const me = { email: 'mk120@rcl.test' }, other = { email: 'xx120@rcl.test' };
    put(B(1), { e: me.email, k: 'bill', at: '2026-10-16T08:00:00.000Z' }); put(B(2), { e: me.email, k: 'bill', at: '2026-10-16T08:01:00.000Z' });
    put(B(3), { e: other.email, k: 'bill', at: 'x' }); put(B(4), { e: me.email, k: 'dash', no: 'JCB-1', at: 'x' });
    const of = (list, u, had) => run('(l, u, h) => billsOf_(l, u, h)', list, u, had);
    assert.deepStrictEqual(of(undefined, me, []), null, 'not given: nothing changes');
    assert.deepStrictEqual(of([], me, [{ p: B(9), at: 'a' }]), [], 'an empty list: none');
    assert.deepStrictEqual(of([{ p: B(1) }, B(2)], me, []), [{ p: B(1), at: '2026-10-16T08:00:00.000Z' }, { p: B(2), at: '2026-10-16T08:01:00.000Z' }], 'his own, with the time the server noted');
    assert.match(of([{ p: B(3) }], me, []).THROWN, /^A bill copy was not added by you in the last 6 hours, or it is already with another entry – add it again\.$/, 'another user\'s');
    assert.match(of([{ p: B(4) }], me, []).THROWN, /was not added by you/, 'a photo of a diesel issue');
    assert.match(of([{ p: B(5) }], me, []).THROWN, /was not added by you/, 'never sent');
    assert.match(of([{ p: B(1) }], null, []).THROWN, /was not added by you/, 'no user (the import)');
    assert.match(of([{ p: B(1) }, { p: B(1) }], me, []).THROWN, /^The same bill copy is given twice/);
    assert.match(of(Array.from({ length: 11 }, (_, i) => ({ p: B(1) })), me, []).THROWN, /^An inward keeps at most 10 bill copy photos/);
    assert.match(of('x', me, []).THROWN, /^The bill copies were not sent right/);
    assert.deepStrictEqual(of([{ p: B(9) }], other, [{ p: B(9), at: 'kept' }]), [{ p: B(9), at: 'kept' }], 'an edit: a copy the inward has stays (whoever edits)');
    // ---- sent for verification: checked (nothing taken), noted with the request; approved later – as noted, also when the server forgot ----
    const flow = run(`p => {
      FLOW_DRY_ON_ = true; FLOW_PHOTOS_ = {}; photosTaken_([p]); const noted = FLOW_PHOTOS_; FLOW_DRY_ON_ = false; FLOW_PHOTOS_ = null;
      const still = CacheService.getScriptCache().get("PH_" + p) !== null;
      CacheService.getScriptCache().put("PH_" + p, JSON.stringify(Object.assign({}, noted[p], { held: "VF-00120" })), 21600);
      const other = photoRecs_([p])[0];
      CacheService.getScriptCache().remove("PH_" + p);
      FLOW_RUN_ID_ = "VF-00120"; FLOW_PHOTOS_ = noted; const later = photoRecs_([p])[0]; FLOW_RUN_ID_ = ""; FLOW_PHOTOS_ = null;
      return { noted: noted, still: still, other: other, later: later };
    }`, B(2));
    assert.deepStrictEqual(Object.keys(flow.noted), [B(2)], 'noted with the request');
    assert.strictEqual(flow.noted[B(2)].e, me.email);
    assert.strictEqual(flow.still, true, 'only checked: the server still knows it');
    assert.strictEqual(flow.other, null, 'with the request: no other entry takes it');
    assert.deepStrictEqual([flow.later && flow.later.e, flow.later && flow.later.k, flow.later && flow.later.held], [me.email, 'bill', 'VF-00120'], 'approved after the server forgot it: as noted');
    put(B(1), { e: me.email, k: 'bill', at: 'x' });
    assert.strictEqual(run('p => { photosTaken_([p]); return CacheService.getScriptCache().get("PH_" + p); }', B(1)), null, 'saved: it goes with ONE entry');
  } finally { vm.runInContext('billsReady_ = __k120.ready; FLOW_DRY_ON_ = false; FLOW_PHOTOS_ = null; FLOW_RUN_ID_ = "";', ctx); }
  // the request keeps them; the approval uses them; both cleared after
  assert.match(code, /FLOW_DRY_ON_ = true; FLOW_PHOTOS_ = held;/);
  assert.match(code, /finally \{ FLOW_DRY_ON_ = false; FLOW_PHOTOS_ = null; \}/);
  assert.match(code, /if \(Object\.keys\(held\)\.length\) \{[^\n]*\n\s+data\.photos = held;/);
  assert.match(code, /FLOW_RUN_ID_ = r0\.id; FLOW_PHOTOS_ = f\.photos && typeof f\.photos === 'object' \? f\.photos : null;/);
  assert.match(code, /FLOW_RUN_ID_ = ''; FLOW_PHOTOS_ = null; \}/);
  // ---- the actions: the user goes with a save; a copy is sent like a question (tried 3 times) ----
  assert.match(code, /saveInward: +\{ m: 'Diesel Inward', edit: true, withUser: true, f: \(u, x\) => saveInward_\(x, u\)/);
  assert.match(code, /updateInward: +\{ m: 'Diesel Inward', edit: true, withUser: true, f: \(u, id, x\) => updateInward_\(id, x, u\)/);
  assert.match(code, /inwardPhoto: +\{ m: 'Diesel Inward', withUser: true, f: \(u, x\) => uploadInwardPhoto_\(u, x\) \}/);
  assert.match(code, /getInwardPhotos: +\{ m: 'Diesel Inward', f: inwardPhotos_ \}/);
  assert.match(code.slice(code.indexOf('function uploadInwardPhoto_'), code.indexOf('function billsOf_')), /canEdit_\(u, 'Diesel Inward'\)/, 'Edit checked inside');
  assert.match(code.slice(code.indexOf('function getInwards_'), code.indexOf('function getPumps_')), /ph: H\.PHOTOS in c \? billList_\(r\[c\[H\.PHOTOS\]\]\)\.length : 0/);
  assert.strictEqual(run('() => BILL_MAX_'), 10); assert.match(app, /const IB_MAX = 10;/, 'page = server: 10');
  // ---- the page: what a save sends ----
  const blk = app.slice(app.indexOf('  const IB_MAX = 10;'), app.indexOf("  $('i_bill_grid').addEventListener('click'"));
  const P = new Function('$', 'esc', 'call', 'phMake', 'toast', 'errMsg', blk + '; return { IB, ibReset, ibForSave, ibWhat, ibCount, ibSending };')(() => null, s => s, null, null, () => {}, e => e);
  P.ibReset('new'); assert.strictEqual(P.ibForSave(), undefined, 'a new inward without copies: nothing sent (as before)');
  P.IB.items = [{ path: B(1) }, { path: B(2) }]; assert.deepStrictEqual(P.ibForSave(), [{ p: B(1) }, { p: B(2) }]);
  P.IB.items.push({ path: '' }); assert.strictEqual(P.ibSending(), true, 'one still being sent');
  P.ibReset('edit'); P.IB.items = [{ path: B(1) }]; P.IB.had = [B(1)]; assert.strictEqual(P.ibForSave(), undefined, 'an edit, copies not changed: not sent – the inward keeps its own');
  P.IB.changed = true; P.IB.items = [{ path: B(2) }]; assert.deepStrictEqual(P.ibForSave(), [{ p: B(2) }]);
  assert.strictEqual(P.ibWhat([{ p: B(2) }]), ' (1 added, 1 taken out)'); assert.strictEqual(P.ibCount(1) + '/' + P.ibCount(3), '1 photo/3 photos');
  P.ibReset('fail'); P.IB.changed = true; assert.strictEqual(P.ibForSave(), undefined, 'they could not be read: nothing can change them');
  P.ibReset('loading'); assert.strictEqual(P.ibForSave(), undefined);
  assert.match(app, /if \(x\.photos\) changes\.push\(\['Bill copy', ibCount\(\(IB\.had \|\| \[\]\)\.length\), ibCount\(x\.photos\.length\) \+ ibWhat\(x\.photos\)\]\);/, 'Update asks it');
  assert.match(app, /<input type="file" id="i_bill_cam" class="dph-in" accept="image\/\*" capture="environment"/);
  assert.match(app, /<input type="file" id="i_bill_pick" class="dph-in" accept="image\/\*" multiple /);
  // ---- help for the new messages ----
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules };')();
  ['The bill copy must be a JPG picture.', 'An inward keeps at most 10 bill copy photos – remove some.', 'Bill copies of a diesel inward cannot be kept yet. This needs one database step first: the Admin runs sql/supabase_step1zb_inward_bills.sql once in Supabase → SQL Editor.',
    'The photo store did not keep the bill copy (500) – add it again.', 'A bill copy was not added by you in the last 6 hours, or it is already with another entry – add it again.']
    .forEach(m => assert.match(H.fixRules(m)[0].en.join(' '), /bill copy/i, m));
  // ---- the database step ----
  const step = fs.readFileSync(path.join(root, 'sql', 'supabase_step1zb_inward_bills.sql'), 'utf8');
  assert.match(step, /^alter table public\.diesel_inward add column if not exists photos text;$/m);
  assert.ok(!/drop |delete |update |truncate /i.test(step.replace(/^--.*$/mg, '')), 'it only adds');
  const listed = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1zb_inward_bills.sql');
  assert.ok(listed && listed.sql === step, 'Read Me lists it word for word');
  assert.match(fs.readFileSync(path.join(root, 'app', 'SupabaseSync.gs'), 'utf8'), /\['Updated By', 'updated_by', 'text'\],\n {4}\['Photos', 'photos', 'text'\]\] \},\s+\/\/ \(update-120/);
});

test('update-121: the water tanker Excel is of EVERY water tanker (every agency) – the empty lines pick the VEHICLE NO from the list of tankers, its agency comes by itself; Import takes each line\'s own tanker', async () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const cut = (a, b) => { const i = app.indexOf(a); assert.ok(i > -1, a); const j = app.indexOf(b, i); assert.ok(j > i, b); return app.slice(i, j); };
  const ex = cut("$('lt_export').addEventListener('click', e => busy(e.target, 'Exporting…', ", "\n  $('lt_import')");
  const exFn = ex.slice(ex.indexOf('async () => {'), ex.lastIndexOf('}));') + 1);
  const page = cut('  const wtMin = t =>', '  const wtKey = ') + cut('  function tripsOfRow(r) {', '  // Edit: the trip opens') + cut('  const LT_HEAD = ', '  const LT_COLS = ');
  // three tankers of two agencies (one just set to Format I – a new one), a machinery that is not a tanker
  const master = [{ id: 'MH-04-J-9844', owner: 'Chalke Enterprises', lbFormat: 'I' }, { id: 'MH-12-AB-1001', owner: 'Patil Water Supply', lbFormat: 'I' },
    { id: 'MH-12-ZZ-7777', owner: 'Patil Water Supply', lbFormat: 'I' }, { id: 'Sany 210', owner: 'RCL', lbFormat: 'A' }];
  const findMachine = n => master.find(m => m.id === n) || null;
  const rows = [
    { no: 'MH-12-AB-1001', date: '2026-10-14', shift: 'Day', unit: 'Trip', itemWork: { _trips: [{ c: 'P-2', a: '10:00', b: '10:20', ch: '', u: 'Curing' }, { c: 'P-1', a: '08:00', b: '08:15', ch: '', u: 'Curing' }] } },
    { no: 'MH-04-J-9844', date: '2026-10-14', shift: 'Day', unit: 'Trip', itemWork: { _trips: [{ c: 'C-7', a: '07:35', b: '07:50', ch: '12+500', u: 'Dust' }] } },
    { no: 'MH-04-J-9844', date: '2026-10-13', shift: 'Night', unit: 'Trip', itemWork: { _trips: [{ c: 'C-5', a: '21:00', b: '21:30', ch: '', u: '' }] } },
    { no: 'MH-12-ZZ-7777', date: '2026-10-14', shift: 'Day', unit: 'Idle', itemWork: {} },
    { no: 'Sany 210', date: '2026-10-14', shift: 'Full Day', unit: 'Hrs', itemWork: {} }];
  const asked = [], saved = [], said = [];
  const S = { lt: { d: { machine: { id: 'MH-04-J-9844', owner: 'Chalke Enterprises' }, from: '2026-10-01', to: '2026-10-14', trips: [] } } };
  const run = new Function('S', 'findMachine', 'call', 'saveXlsxLists', 'toast', 'lbHeadRows', 'showDate', 'wtTankers', page + '; return (' + exFn + ');');
  await run(S, findMachine, async (fn, f) => { asked.push([fn, f]); return { rows: rows }; }, async (name, sheets) => { saved.push({ name: name, sheets: sheets }); }, t => said.push(t),
    t => [['RCL'], ['VTR'], [t], []], d => d.split('-').reverse().join('/'), () => master.filter(m => m.lbFormat === 'I'))();
  assert.deepStrictEqual(asked, [['getLogBookList', { from: '2026-10-01', to: '2026-10-14', all: true }]], 'the trips of every tanker in the dates on screen – one call');
  const f = saved[0], sh = f.sheets[0], aoa = sh.aoa, H = sh.head;
  assert.strictEqual(f.name, 'Water tankers 01-10-2026 to 14-10-2026.xlsx');
  assert.strictEqual(aoa[2][0], 'WATER TANKER REPORT – all water tankers – 01/10/2026 to 14/10/2026');
  assert.strictEqual(aoa[H - 1].join('|'), 'SR. NO.|DATE|SHIFT|NAME OF AGENCY|VEHICLE NO|CHALLAN NO|DISPATCH TIME|UNLOAD TIME|TRIP|CHAINAGE NO|USE FOR');
  const trips = aoa.slice(H, H + 4).map(r => r.slice(1, 8).join(' '));
  assert.deepStrictEqual(trips, ['13/10/2026 Night Chalke Enterprises MH-04-J-9844 C-5 21:00 21:30', '14/10/2026 Day Chalke Enterprises MH-04-J-9844 C-7 07:35 07:50',
    '14/10/2026 Day Patil Water Supply MH-12-AB-1001 P-1 08:00 08:15', '14/10/2026 Day Patil Water Supply MH-12-AB-1001 P-2 10:00 10:20'], 'every tanker of every agency: date, shift, agency, vehicle, time');
  assert.deepStrictEqual(aoa.slice(H, H + 4).map(r => r[0]), [1, 2, 3, 4]);
  // 100 empty lines: no tanker fixed in them – the agency is a formula on the VEHICLE NO picked
  const empty = aoa.slice(H + 4);
  assert.strictEqual(empty.length, 100);
  empty.forEach((r, k) => { const n = H + 4 + k + 1; assert.deepStrictEqual(r, ['', '', '', { formula: 'IF(E' + n + '="","",IFERROR(VLOOKUP(E' + n + ',Lists!$A$1:$B$3,2,FALSE),""))' }], 'line ' + n); });
  // the drop-downs: Shift on every line, VEHICLE NO from the hidden list of every water tanker (a new Format I tanker is in it)
  assert.deepStrictEqual(sh.lists.map(L => [L.col, L.values || L.ref, !!L.skip]), [[2, ['Day', 'Night'], false], [4, 'Lists!$A$1:$A$3', false]]);
  assert.deepStrictEqual(f.sheets[1], { name: 'Lists', aoa: [['MH-04-J-9844', 'Chalke Enterprises'], ['MH-12-AB-1001', 'Patil Water Supply'], ['MH-12-ZZ-7777', 'Patil Water Supply']], hidden: true });
  assert.strictEqual(said[0], '4 trips of 2 water tankers and 100 empty lines. Pick the VEHICLE NO of a line (its agency comes by itself), fill the date, shift, challan, dispatch, unload… and bring the file back with "Import Excel".');
  // Import: each line its own VEHICLE NO; a line without one is not given to the tanker open on the screen – nothing is imported
  const im = cut("    if (f) busy($('lt_import'), 'Reading…', ", "    }).then(() => { if (S.lt && S.lt.d) ltState(); });");
  const imFn = im.slice(im.indexOf('async () => {')) + '}';
  const go = async raw => { const out = { calls: [], boxes: [] };
    await new Function('S', 'f', 'needXlsx', 'readExcelRows', 'LT_COLS', 'xlDate', 'call', 'askConfirm', 'listHtml', 'toast', 'findMachine', 'ltLoad', 'loadLog', 'return (' + imFn + ');')(
      S, {}, () => {}, async () => raw, [], d => d, async (fn, b) => { out.calls.push([fn, b]); return { ok: true, added: b.rows.length, same: 0, tankers: new Set(b.rows.map(x => x.no)).size }; },
      async o => { out.boxes.push(o); return true; }, l => l.join(' / '), () => {}, findMachine, async () => {}, () => {})();
    return out; };
  let r = await go([{ line: 8, no: 'MH-12-AB-1001', date: '2026-10-15', shift: 'Day', c: 'P-9', a: '09:00', b: '09:20', ch: '', u: '' }, { line: 9, no: '', date: '2026-10-15', shift: 'Night', c: 'C-9', a: '21:00', b: '21:20', ch: '', u: '' }]);
  assert.deepStrictEqual(r.calls, [], 'nothing sent');
  assert.strictEqual(r.boxes[0].title, 'Fix the file first');
  assert.match(r.boxes[0].html, /Line 9: pick the VEHICLE NO – the water tanker of this trip\./);
  r = await go([{ line: 8, no: 'MH-12-AB-1001', date: '2026-10-15', shift: 'Day', c: 'P-9', a: 0.375, b: '09:20', ch: '', u: '' }, { line: 9, no: 'MH-12-ZZ-7777', date: '2026-10-15', shift: 'n', c: 'Z-1', a: '21:00', b: '21:20', ch: '', u: '' }]);
  assert.deepStrictEqual(r.calls.map(x => [x[0], x[1].rows.map(y => y.no + ' ' + y.shift + ' ' + y.a)]), [['checkTankerImport', ['MH-12-AB-1001 Day 09:00', 'MH-12-ZZ-7777 Night 21:00']], ['importTankerTrips', ['MH-12-AB-1001 Day 09:00', 'MH-12-ZZ-7777 Night 21:00']]], 'two tankers of a file, each its own');
  assert.match(r.boxes[0].html, /2 trips will be added \(2 tankers\)/);
});

test('update-123: no opening film of One Click Solution – the link opens the sign-in at once; "Company & site" without the film; what was kept for it stays as it was', async () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  for (const gone of ['id="oc_intro"', 'id="oc_video"', 'id="oc_skip"', 'function ocIntro', 'ocIntro(', 'id="org_video"', 'id="org_intro"', 'id="org_play"', 'data-pref="intro"', 'oc_intro_off', '/icons/oc-logo-glow.webp', '@keyframes ocZoom'])
    assert.ok(app.indexOf(gone) === -1, 'still in the page: ' + gone);
  assert.ok(app.indexOf('id="login_screen"') > -1 && app.indexOf('id="boot"') > -1, 'the sign-in and the loading gauge are there');
  // "Save company & site": the film's link and its tick are not asked any more – what the server keeps for them is sent back as it is
  const i = app.indexOf("$('org_save').addEventListener('click'"), j = app.indexOf('}).catch(er => toast(errMsg(er), true)));', i);
  assert.ok(i > -1 && j > i);
  const save = app.slice(app.indexOf('busy(e.target', i), j) + '})';
  const field = { org_customer: ' Rachana Construction Limited ', org_site: 'VTR Site – NH 848', org_logo: '', org_names: 'Rachana Construction Limited\nSketchline Industries' };
  const sent = [];
  const run = org => new Function('e', 'S', '$', 'call', 'applyOrg', 'toast', 'busy', 'return ' + save + ';')(
    { target: {} }, { org: org }, id => ({ value: field[id] }), async (fn, b) => { sent.push([fn, b]); return { org: b }; }, () => {}, () => {}, (b, t, fn) => fn());
  await run({ customer: 'Rachana Construction Limited', video: 'https://example.test/film.mp4', intro: false });
  await run({ customer: 'Rachana Construction Limited' });
  assert.deepStrictEqual(sent.map(x => [x[0], x[1].customer, x[1].billNames.length, x[1].video, x[1].intro]), [
    ['saveOrgSettings', 'Rachana Construction Limited', 2, 'https://example.test/film.mp4', false],
    ['saveOrgSettings', 'Rachana Construction Limited', 2, '', true]], 'the kept film settings go back unchanged (nothing in the data changes)');
  // the words of the film are gone from the languages too (every word of a dictionary is a word of the page)
  for (const l of ['mr', 'hi']) {
    const d = JSON.parse(fs.readFileSync(path.join(root, 'app', 'i18n', l + '.json'), 'utf8'));
    for (const k of ['Play the opening now', 'Play the opening when the app is opened', 'Play the opening when I open the app', 'Opening film (https link to an .mp4, optional)', 'Fleet ERP · diesel, machinery and bills in one click'])
      assert.ok(!(k in d), l + ': ' + k);
    assert.ok('Less movement (no gliding)' in d, l);
  }
});

test('update-124: a bill made from now on – its Tax Invoice shows each vehicle for the month and its amount AFTER the diesel debit (no hours, days, rate or debit line; GST on it, no TDS); a bill made before keeps its paper', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const grab = m => { const i = app.indexOf(m); assert.ok(i > -1, m); let j = app.indexOf('{', i), d = 0; for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } };
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const env = { r2: n => Math.round(n * 100) / 100, esc, fmt: n => String(n), DOC_CSS: '', mbN2: n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), mbDot: d => String(d || '').split('-').reverse().join('.') };
  const C = new Function(...Object.keys(env), grab('function rupeesWords(') + '\nconst docDash = v => (v === \'\' || v === null || v === undefined || Number(v) === 0) ? \'-\' : mbN2(v);\n' + grab('function txPeriod(') + '\n' + grab('function taxInvoiceHtml(') + '; return { taxInvoiceHtml, txPeriod };')(...Object.values(env));
  const text = h => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  // the bill he was shown (18-10-2026): JCB with excess diesel, a tipper on debit basis, a Bolero without diesel – GST 18 %, TDS 1 %
  const base = { company: 'Rachana Construction Limited', companyInfo: { gstin: '27BBBBB0000B1Z0', invPrefix: 'RCL/TST/RA-' }, vendor: { name: 'Shree Earthmovers' }, billNo: '12', billDate: '2026-10-18', from: '2026-09-01', to: '2026-09-30', dnNo: 'RCL/TST/DN-7',
    machines: [{ no: 'MH-12-AB-1234', type: 'JCB', amount: 134000, excessAmt: 9200, lines: [{ item: 'Bucket', unit: 'Hrs', qty: 120, rate: 900, amount: 108000 }, { item: 'Breaker', unit: 'Hrs', qty: 20, rate: 1300, amount: 26000 }] },
      { no: 'MH-12-CD-5678', type: 'Tipper', amount: 60000, excessAmt: 27600, lines: [{ monthly: 60000, unit: 'Days', qty: 30, rate: 2000, amount: 60000 }] },
      { no: 'MH-12-EF-9012', type: 'Bolero', amount: 40000, excessAmt: 0, lines: [{ monthly: 40000, unit: 'Days', qty: 30, rate: 1333.33, amount: 40000 }] }],
    A: 234000, B: 36800, C: 0, D: 197200, gstPct: 18, tdsPct: 1, E: 17748, F: 17748, G: 232696, H: 1972, I: 230724 };
  const now = text(C.taxInvoiceHtml(Object.assign({}, base, { txNet: true })));
  for (const want of ['1 RENT ON VEHICLE MH12AB1234 (JCB) FOR THE MONTH OF SEPTEMBER 2026 1,24,800.00 11,232.00 11,232.00 1,47,264.00',
    '2 RENT ON VEHICLE MH12CD5678 (TIPPER) FOR THE MONTH OF SEPTEMBER 2026 32,400.00 2,916.00 2,916.00 38,232.00',
    '3 RENT ON VEHICLE MH12EF9012 (BOLERO) FOR THE MONTH OF SEPTEMBER 2026 40,000.00 3,600.00 3,600.00 47,200.00',
    'Total Billing Amount 1,97,200.00', 'Total Amount Before Tax 1,97,200.00 Basic Value 1,97,200.00 SGST 9% 17,748.00 CGST 9% 17,748.00 Total Billing Amt 2,32,696.00 Net Cheque Amount 2,32,696.00',
    'Rupees Two Lakh Thirty Two Thousand Six Hundred Ninety Six Only']) assert.ok(now.indexOf(want) > -1, 'the new Tax Invoice should say: ' + want + '\n' + now.slice(0, 1600));
  for (const gone of ['Diesel', 'Debit', 'Less:', 'Hrs', 'Days', '×', 'BUCKET', 'TDS', '2,34,000', '36,800', '1,972']) assert.ok(now.indexOf(gone) === -1, 'not on the new Tax Invoice: ' + gone);
  // the same bill made before update-124 (no txNet – every bill in RCL Drive): its paper as it was – the work, the rates and the debit line
  const old = text(C.taxInvoiceHtml(base));
  for (const want of ['BUCKET: 120 Hrs × 900.00 = 1,08,000.00', 'RENT ON VEHICLE MH12CD5678 (TIPPER) 60,000.00 - - 60,000.00', 'Total Billing Amount 2,34,000.00', 'Total Amount Before Tax 2,34,000.00',
    'Less: Diesel deduction (Debit Note RCL/TST/DN-7) − 36,800.00', 'Basic Value 1,97,200.00']) assert.ok(old.indexOf(want) > -1, 'a bill made before keeps: ' + want);
  assert.ok(old.indexOf('FOR THE MONTH') === -1);
  // the month: a whole calendar month by its name, else the dates
  assert.deepStrictEqual([['2026-09-01', '2026-09-30'], ['2026-02-01', '2026-02-28'], ['2028-02-01', '2028-02-28'], ['2028-02-01', '2028-02-29'], ['2026-09-01', '2026-09-15'], ['2026-09-20', '2026-10-10'], ['2026-12-01', '2026-12-31']].map(([f, t]) => C.txPeriod({ from: f, to: t })),
    ['FOR THE MONTH OF SEPTEMBER 2026', 'FOR THE MONTH OF FEBRUARY 2026', 'FOR THE PERIOD 01.02.2028 TO 28.02.2028', 'FOR THE MONTH OF FEBRUARY 2028', 'FOR THE PERIOD 01.09.2026 TO 15.09.2026', 'FOR THE PERIOD 20.09.2026 TO 10.10.2026', 'FOR THE MONTH OF DECEMBER 2026']);
  // an other deduction (C) stays a line of its own (the value taxed is then not the rows: no tax per row)
  const withC = text(C.taxInvoiceHtml(Object.assign({}, base, { txNet: true, C: 1000, cReason: 'tyre', D: 196200, E: 17658, F: 17658, G: 231516 })));
  assert.ok(withC.indexOf('Total Amount Before Tax 1,97,200.00 Less: Other deduction (tyre) − 1,000.00 Basic Value 1,96,200.00') > -1, withC.slice(900, 1500));
  assert.ok(withC.indexOf('1,24,800.00 - - 1,24,800.00') > -1 && withC.indexOf('Diesel') === -1);
  // a bill is marked when it is BUILT (Make Bill) – never when an old one is opened
  assert.match(grab('function mbFill('), /b\.txNet = true;/);
  assert.doesNotMatch(grab('function mbTotals('), /txNet/);
  assert.doesNotMatch(grab('function billSheets('), /txNet/);
});

test('update-125: "Change site" in the dark menu closes the phone / tablet drawer first, so its box with the sites is on top (not behind the menu)', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  // the click on "Change site": the drawer closes before the box opens
  const i = app.indexOf("$('site_chg').addEventListener('click'"); assert.ok(i > -1);
  const h = app.slice(i, app.indexOf('\n  });', i));
  const close = h.indexOf('setDrawer(false)'), box = h.indexOf('askConfirm(');
  assert.ok(close > -1 && box > -1 && close < box, 'the drawer must close before the "Change site" box opens');
  // setDrawer(false) takes the drawer away (the class that slides it in), and the drawer and its shade are above the box
  assert.match(app, /function setDrawer\(open\) \{ document\.querySelector\('\.app'\)\.classList\.toggle\('nav-open', open\); \}/);
  const z = re => Number((app.match(re) || [])[1]);
  const side = z(/\.side \{ position: fixed;[^}]*z-index: (\d+);/), shade = z(/#nav_back \{ display: block;[^}]*z-index: (\d+);/), cf = z(/#cf_back \{[^}]*z-index: (\d+);/);
  assert.ok(side > cf && shade > cf, 'on a phone the drawer (' + side + ') and its shade (' + shade + ') are above the box (' + cf + ') – that is why it must close first');
  // nothing else changed in the box: the same sites, "Stay here", the Portal's way and the app's own switch
  assert.match(h, /title: 'Change site', alertOnly: true, ok: 'Stay here'/);
  assert.match(h, /ptNav\(chosen === '__portal' \? '\/\?menu=1' : ptOpen\('mechanical', chosen\)\)/);
  assert.match(h, /siteSwitch\(chosen\)/);
});

test('update-126: every number of the Diesel dashboard opens one big box with its entries – only shown; the box\'s total is the number on the card', async () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  // the nine numbers can be pressed (a click, or Enter with the keyboard)
  for (const k of ['open', 'in', 'issued', 'close', 'now', 'today', 'machines', 'entries', 'avg'])
    assert.match(app, new RegExp('<div class="k[cm][^"]*" data-kd="' + k + '" role="button" tabindex="0" title="Click to see the entries of this number">'), k);
  assert.match(app, /const kd = e\.target\.closest\('\[data-kd\]'\); if \(kd\) \{ kdOpen\(kd\.dataset\.kd\); return; \}/);
  assert.match(app, /if \(kd && \(e\.key === 'Enter' \|\| e\.key === ' '\)\) \{ e\.preventDefault\(\); kdOpen\(kd\.dataset\.kd\); \}/);
  // the box: nothing to type or change in it – only × and Close
  const box = app.slice(app.indexOf('<div id="kd_back" hidden>'), app.indexOf('<div id="print_area"></div>'));
  assert.ok(box.length > 100 && !/<(input|select|textarea)\b/.test(box) && (box.match(/<button/g) || []).length === 2, 'only × and Close');
  // the entries come through the pages' own actions – the same access as those pages; no new server action, nothing saved
  const at = app.indexOf('  async function kdBuild(kind, d, f) {'), to = app.indexOf('  function kdClose() {');
  assert.ok(at > 0 && to > at);
  const kdCode = app.slice(at, to), called = [...kdCode.matchAll(/call\('(\w+)'/g)].map(m => m[1]);
  assert.deepStrictEqual([...new Set(called)].sort(), ['getDieselIssues', 'getInwards']);
  assert.match(code, /getInwards: +\{ m: 'Diesel Inward', f: getInwards_ \}/);
  assert.match(code, /getDieselIssues: +\{ m: 'Diesel Issue', f: getDieselIssues_ \}/);
  // worked through with the page's own code: the totals are the Dashboard's figures
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = v => (v === '' || v === null || v === undefined) ? '' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const money = v => (v === '' || v === null || v === undefined) ? '' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const calls = [], answers = {
    getInwards: { rows: [{ id: 'IN-3', date: '2026-10-12', qty: 500, rate: 92.5, amount: 46250, location: 'Dispenser', pump: 'HP Pump', billNo: 'B-7', billDate: '2026-10-12', enteredBy: 'Ravi' },
      { id: 'IN-2', date: '2026-10-05', qty: 200, rate: 92, amount: 18400, location: 'VTR Store', pump: 'HP Pump', billNo: 'B-6', billDate: '', enteredBy: 'Ravi' },
      { id: 'IN-1', date: '2026-10-01', qty: 1000, rate: '', amount: '', location: 'Dispenser', pump: 'Opening stock', open: true }] },
    getDieselIssues: { count: 3, totalQty: 95.5, share: [{ no: 'JCB-1', type: 'JCB', owner: 'A', qty: 60, entries: 2 }, { no: 'TP-2', type: 'Tipper', owner: 'B', qty: 35.5, entries: 1 }],
      rows: [{ id: 'DI-3', date: '2026-10-14', shift: 'Day', no: 'JCB-1', qty: 30, hrReading: 1200, kmReading: '', source: 'Dispenser' }, { id: 'DI-2', date: '2026-10-13', shift: 'Night', no: 'TP-2', qty: 35.5, kmReading: 9800, hrReading: '', source: 'Dispenser' },
        { id: 'DI-1', date: '2026-10-12', shift: 'Day', no: 'JCB-1', qty: 30, hrReading: 1190, kmReading: '', source: 'VTR Store' }] } };
  const K = new Function('call', 'fmt', 'money', 'esc', 'showDate', 'S', 'r2', app.slice(app.indexOf('  const kdTd = '), app.indexOf('  let kdSeq = 0;')) + app.slice(at, to) + '\nreturn kdBuild;')(
    async (fn, a) => { calls.push([fn, a]); return answers[fn]; }, fmt, money, esc, d => d.split('-').reverse().join('-'), { today: '2026-10-14' }, n => Math.round(n * 100) / 100);
  const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const d = { locations: [{ loc: 'Dispenser', opening: 1000, inward: 500, tin: 0, tout: 100, issued: 65.5, closing: 1334.5 }, { loc: 'VTR Store', opening: 300, inward: 200, tin: 100, tout: 0, issued: 30, closing: 570 }],
    stock: { stock: 1904.5, byLoc: { Dispenser: 1334.5, 'VTR Store': 570 } }, tanks: { caps: { Dispenser: 2400, 'VTR Store': 1000 } } };
  const F = { from: '2026-10-01', to: '2026-10-14' };
  let r = await K('open', d, F);
  assert.strictEqual(r.big, '1,300 Ltr'); assert.match(text(r.html), /Dispenser 1,000 500 0 100 65\.5 1,334\.5 VTR Store 300 200 100 0 30 570 All places 1,300 700 100 100 95\.5 1,904\.5/);
  r = await K('close', d, F); assert.strictEqual(r.big, '1,904.5 Ltr');
  r = await K('now', d, F); assert.strictEqual(r.big, '1,904.5 Ltr'); assert.match(text(r.html), /Dispenser 1,334\.5 2,400 56% VTR Store 570 1,000 57%/);
  // Received: the opening stock entered ON the start date is part of the opening (as getDashboard counts it) – 700 Ltr in 2 bills
  r = await K('in', d, F);
  assert.deepStrictEqual(calls.pop(), ['getInwards', { from: '2026-10-01', to: '2026-10-14', all: true }]);
  assert.strictEqual(r.big, '700 Ltr'); assert.strictEqual(r.bigSub, '₹64,650.00, 2 bills'); assert.ok(!/IN-1/.test(r.html) && /IN-3/.test(r.html) && /IN-2/.test(r.html));
  assert.match(getDashSrc(code), /if \(open && \(!from \|\| dk <= from\)\) return;/, 'the same rule on the server');
  // an opening stock AFTER the start date (a new place) is received diesel, as the server counts it
  r = await K('in', d, { from: '2026-09-30', to: '2026-10-14' }); calls.pop(); assert.strictEqual(r.big, '1,700 Ltr');
  // the Diesel Issue entries of the dates; today's of today; machine by machine; the average
  r = await K('issued', d, F); assert.deepStrictEqual(calls.pop(), ['getDieselIssues', { from: '2026-10-01', to: '2026-10-14' }]);
  assert.strictEqual(r.big, '95.5 Ltr'); assert.strictEqual(r.bigSub, '3 entries'); assert.match(text(r.html), /Total – 3 entries 95\.5/); assert.match(text(r.html), /Hrs 1,200/); assert.match(text(r.html), /KM 9,800/);
  r = await K('today', d, F); assert.deepStrictEqual(calls.pop(), ['getDieselIssues', { from: '2026-10-14', to: '2026-10-14' }]);
  r = await K('entries', d, F); calls.pop(); assert.strictEqual(r.big, '3 entries');
  r = await K('avg', d, F); calls.pop(); assert.strictEqual(r.big, '31.83 Ltr'); assert.strictEqual(r.bigSub, '95.5 Ltr ÷ 3 entries');
  r = await K('machines', d, F); calls.pop(); assert.strictEqual(r.big, '2 machines'); assert.match(text(r.html), /JCB-1 JCB A 2 60 .*TP-2 Tipper B 1 35\.5 .*Total – 2 machines 3 95\.5/);
  // more than the 500 the server lists: said so, the total is of all
  answers.getDieselIssues = Object.assign({}, answers.getDieselIssues, { count: 812 });
  r = await K('issued', d, F); calls.pop(); assert.match(text(r.html), /The latest 3 of the 812 entries are listed here; the total is of all 812\./);
  // the help of the Dashboard says it, in the three languages
  assert.match(app, /A click on a number \(Opening stock, Received, Issued, Closing stock, Stock now, Issued today, Machines fuelled, Issue entries, Average\) opens a big box with its entries – only shown\./);
  assert.match(app, /click केले की त्याच्या entries एका मोठ्या box मध्ये दिसतात – फक्त पाहण्यासाठी\./);
  assert.match(app, /click करने पर उसकी entries एक बड़े box में दिखती हैं – केवल देखने के लिए।/);
  function getDashSrc(c) { const i = c.indexOf('function getDashboard_('); return c.slice(i, c.indexOf('\n}\n', i)); }
});

test('update-128: the sender sends his rejected / returned entry again – as it was, with his remark; checked as a save first; nothing lost', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  vm.runInContext(`globalThis.__k128 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB128 = {};
    globalThis.__fill128 = s => { const d = DB128[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep128 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill128(s); if (s.loaded) DB128[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep128(this); __k128.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill128(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill128(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    globalThis.__sent = []; rtcPush_ = function (ids, msg) { __sent.push({ ids: ids, msg: msg }); };
    kvWrite_("FLOW_RULES", "{}"); kvWrite_("CR_SUPERS", JSON.stringify(["sa128@rcl.test"]));`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'd'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('mahesh128@rcl.test', 'Mahesh Jadhav', false, { 'Vendor Master': 'Edit' }), mk('shubham128@rcl.test', 'Shubham', false, { 'Vendor Master': 'Edit' }), mk('sa128@rcl.test', 'Super C', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok128_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa128@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const V = n => ({ name: n, gstReg: 'No', pan: 'ABCPV1128A', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' });
    const M = 'mahesh128@rcl.test', S = 'shubham128@rcl.test', SA = 'sa128@rcl.test';
    assert.ok(api(SA, 'saveFlowRules', { tasks: { 'Vendor Master': { on: true, levels: [[S]] } } }).ok);
    const sent = n => (api(M, 'saveVendor', V(n), 'add').THROWN || '').match(/VF-\d{5}/)[0];
    const has = n => run('n => getVendors_().some(v => v.name === n)', n);
    const req = (who, id) => api(who, 'getChangeRequests', {}).requests.find(x => x.id === id);
    // ---- REJECTED: he sends it again with his remark – the same request, back to level 1, every step kept ----
    const a = sent('Again 128 A');
    assert.strictEqual(api(S, 'decideChangeRequest', { id: a, approve: false, note: 'PAN?' }).status, 'Rejected');
    assert.deepStrictEqual([req(M, a).canResend, req(S, a).canResend], [true, false], 'only the sender sends it again');
    assert.match(api(M, 'resendFlow', { id: a }).THROWN, /^Write why it is sent again/);
    assert.match(api(S, 'resendFlow', { id: a, note: 'x' }).THROWN, new RegExp('^Only the person who sent entry ' + a + ' sends it again\\.$'));
    assert.match(api(M, 'resendFlow', { id: 'VF-99999', note: 'x' }).THROWN, /^Entry VF-99999 was not found/);
    run('() => { __sent.length = 0; }');
    let r = api(M, 'resendFlow', { id: a, note: 'PAN checked with the card' });
    assert.deepStrictEqual([r.ok, r.id, r.status, r.level, r.levels, r.to], [true, a, 'Pending', 1, 1, ['Shubham']], JSON.stringify(r).slice(0, 300));
    let ra = r.list.requests.find(x => x.id === a);
    assert.deepStrictEqual([ra.status, ra.canResend, ra.canRemind, ra.resent, ra.waitingFor], ['Pending', false, true, 1, ['Shubham']]);
    assert.deepStrictEqual(ra.history.map(h => h.step), ['Sent', 'Rejected', 'Sent again'], 'every step kept');
    assert.strictEqual(ra.history[2].note, 'PAN checked with the card');
    assert.deepStrictEqual(run('() => __sent.map(p => [p.ids, p.msg.id, p.msg.title])'), [[run('() => [rtcUid_("shubham128@rcl.test")]'), a, 'Sent again for verification – ' + MODULE_LABEL('Vendor Master') + ' by Mahesh Jadhav']]);
    assert.ok(run('() => table_(LOG_SHEET, []).rows.some(x => x.join("|").indexOf("Verification – sent again by the sender") > -1)'), 'the Activity Log');
    assert.match(api(M, 'resendFlow', { id: a, note: 'again' }).THROWN, new RegExp('^Entry ' + a + ' is waiting for verification already – only a rejected or returned entry is sent again\\.$'));
    assert.ok(!has('Again 128 A'), 'nothing saved while it waits');
    assert.strictEqual(api(S, 'decideChangeRequest', { id: a, approve: true }).status, 'Approved');
    assert.ok(has('Again 128 A'), 'approved: saved – as it was sent, nothing typed again');
    // ---- RETURNED (approved, but the save refused it): the reason is with it; sent again only when the save would take it ----
    const b = sent('Again 128 B');
    assert.ok(api(SA, 'saveVendor', V('Again 128 B'), 'add').ok !== false && has('Again 128 B'), 'meanwhile the Super Admin saved the same vendor');
    r = api(S, 'decideChangeRequest', { id: b, approve: true });
    assert.deepStrictEqual([r.status, /^Not saved: Again 128 B is already saved/.test(r.result)], ['Returned', true], JSON.stringify(r));
    const rb = req(M, b);
    assert.ok(rb.canResend && /^Not saved: /.test(rb.result), 'he sees why, and may send it again');
    r = api(M, 'resendFlow', { id: b, note: 'try again' });      // (update-129) a refusal comes back in "failed" – for one entry as for several
    assert.deepStrictEqual([r.ok, r.done.length, r.failed.length, r.failed[0].id], [true, 0, 1, b], JSON.stringify(r).slice(0, 300));
    assert.match(r.failed[0].error, new RegExp('^Not sent again: Again 128 B is already saved – use Edit\\. – entry ' + b + ' stays as it is \\(nothing is lost\\); send it again when this is put right\\.$'));
    assert.deepStrictEqual([req(M, b).status, req(M, b).canResend, req(M, b).history.length], ['Returned', true, rb.history.length], 'refused again by the save: nothing changed');
    assert.ok(api(SA, 'deleteVendor', 'Again 128 B').ok !== false && !has('Again 128 B'));
    r = api(M, 'resendFlow', { id: b, note: 'the other one is deleted' });
    assert.deepStrictEqual([r.status, r.list.requests.find(x => x.id === b).result || ''], ['Pending', ''], JSON.stringify(r).slice(0, 300));
    assert.strictEqual(api(S, 'decideChangeRequest', { id: b, approve: true }).status, 'Approved');
    assert.ok(has('Again 128 B'));
    // ---- the same entry sent anew meanwhile: the old one is not sent twice ----
    const c = sent('Again 128 C');
    assert.strictEqual(api(S, 'decideChangeRequest', { id: c, approve: false, note: 'no' }).status, 'Rejected');
    const c2 = sent('Again 128 C');
    assert.match(api(M, 'resendFlow', { id: c, note: 'x' }).THROWN, new RegExp('already waiting for verification as ' + c2 + ' – it is not sent twice'));
    // ---- several at once: each on its own ----
    const d = sent('Again 128 D'), e = sent('Again 128 E');
    api(S, 'decideChangeRequests', { ids: [d, e], approve: false, note: 'later' });
    r = api(M, 'resendFlow', { ids: [d, e, 'VF-99999'], note: 'now' });
    assert.deepStrictEqual([r.done.map(x => x.id), r.failed.map(x => x.id)], [[d, e], ['VF-99999']], JSON.stringify(r).slice(0, 300));
    assert.ok([d, e].every(id => r.list.requests.find(x => x.id === id).status === 'Pending'));
    assert.match(api(M, 'resendFlow', { ids: [], note: 'x' }).THROWN, /^Pick the entries to send again/);
    // ---- the page: why it was not saved is in the box; "Send again" one or all; the Approvals page too ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /approvals: \{ saves: \[[^\]]*'resendFlow'\]/);
    assert.match(app, /data-cragain="' \+ esc\(r\.id\) \+ '">Send again<\/button>/);
    assert.match(app, /const r = await call\('resendFlow', rs\.length > 1 \? \{ ids: rs\.map\(x => x\.id\), note: note \} : \{ id: rs\[0\]\.id, note: note \}\);/);
    const src = app.slice(app.indexOf('  const FV_DAYS = 7;'), app.indexOf('  function fvDraw() {'));
    const F = new Function('S', 'esc', 'crWhen', src + '; return { fvMine, fvHtml };');
    const now = new Date().toISOString();
    const SS = { cr: { requests: [
      { kind: 'Flow', mine: true, m: 'Diesel Issue', id: 'VF-00011', task: 'Diesel Issue', status: 'Returned', at: now, decidedAt: now, decidedBy: 'suraj', note: 'approved', result: 'Not saved: KM reading 48409.3 is less than the last one', canResend: true, summary: ['Add: MH-25-AJ-5091'] },
      { kind: 'Flow', mine: true, m: 'Diesel Issue', id: 'VF-00010', task: 'Diesel Issue', status: 'Rejected', at: now, decidedAt: now, decidedBy: 'suraj', note: 'wrong litres', canResend: true, resent: 1, summary: ['Add: MH-25-AJ-5091'] }] } };
    const h = F(SS, x => String(x), x => String(x)).fvHtml(F(SS, x => String(x), x => String(x)).fvMine('Diesel Issue'), 'Diesel Issue', false);
    assert.ok(/class="fv-why">Not saved: KM reading 48409\.3 is less than the last one</.test(h), 'why it was not saved');
    assert.ok(/data-fvagain="VF-00011">Send again<\/button>/.test(h) && /data-fvagain="VF-00010">Send again<\/button><br><small>sent again 1× before/.test(h) && /data-fvagainall="Diesel Issue">Send all again \(2\)/.test(h), h);
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k128.flush; SbBook_.prototype.loadMany = __k128.loadMany; SbSheet_.prototype.load_ = __k128.load_; sbDiscard_ = __k128.discard; rtcPush_ = __k128.push;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
  function MODULE_LABEL(m) { return vm.runInContext('MODULE_LABEL_', ctx)[m] || m; }
});

test('update-129 / 131: Send again and the approval say what the save refuses in words (warnings and mistakes); no "Send again anyway" – it is corrected first', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // a save that answers as the saves do: warnings (several), one warning ("Save anyway?") or mistakes – by W129
  vm.runInContext(`globalThis.__k129 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB129 = {};
    globalThis.__fill129 = s => { const d = DB129[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep129 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill129(s); if (s.loaded) DB129[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep129(this); __k129.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill129(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill129(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    rtcPush_ = function () {};
    globalThis.W129 = 'clean'; globalThis.SAVED129 = [];
    API_.test129 = { m: 'Vendor Master', edit: true, f: o => {
      if (W129 === 'errors') return { ok: false, errors: [{ row: 3, msg: '"MH-X" is not in Master.' }] };
      if (W129 === 'warns' && !o.force) return { ok: false, warnings: [{ row: 2, msg: 'MH-1: KM Reading 5 is less than the earlier KM Reading 9.' }, { row: 4, msg: 'MH-2: Hrs Reading 1 is less than the earlier Hrs Reading 2.' }] };
      if (W129 === 'warn' && !o.force) return { ok: false, warning: 'MH-1: the next entry has a lower reading. Save anyway?' };
      if (W129 === 'many' && !o.force) return { ok: false, warnings: Array.from({ length: 12 }, (x, i) => ({ row: i + 1, msg: 'MH-' + (i + 1) + ': KM Reading 5 is less than the earlier KM Reading 9.' })) };
      if (!FLOW_DRY_ON_) SAVED129.push(o.n);
      return { ok: true }; } };
    kvWrite_("FLOW_RULES", "{}"); kvWrite_("CR_SUPERS", JSON.stringify(["sa129@rcl.test"]));`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'd'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('mahesh129@rcl.test', 'Mahesh Jadhav', false, { 'Vendor Master': 'Edit' }), mk('shubham129@rcl.test', 'Shubham', false, { 'Vendor Master': 'Edit' }), mk('sa129@rcl.test', 'Super C', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok129_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa129@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const M = 'mahesh129@rcl.test', S = 'shubham129@rcl.test', SA = 'sa129@rcl.test';
    const W = w => run('w => { W129 = w; }', w);
    assert.ok(api(SA, 'saveFlowRules', { tasks: { 'Vendor Master': { on: true, levels: [[S]] } } }).ok);
    const sent = n => { W('clean'); const t = api(M, 'test129', { n: n }).THROWN || ''; assert.match(t, /^Sent for verification/, t); return t.match(/VF-\d{5}/)[0]; };
    const req = id => api(M, 'getChangeRequests', {}).requests.find(x => x.id === id);
    const argsOf = id => JSON.parse(run('id => flowAll_().find(r => r.id === id).args', id));
    // ---- warnings at the approval: said in full (not "refused") ----
    const a = sent('A');
    W('warns');
    let r = api(S, 'decideChangeRequest', { id: a, approve: true });
    assert.deepStrictEqual([r.status, r.result], ['Returned', 'Not saved: To check (warnings, not mistakes): Line 2: MH-1: KM Reading 5 is less than the earlier KM Reading 9. | Line 4: MH-2: Hrs Reading 1 is less than the earlier Hrs Reading 2.'], JSON.stringify(r));
    const h0 = req(a).history.length;
    // sent again: the same reason; (update-131) "anyway" (force) is not read – nothing changes until it is corrected
    for (const force of [false, true]) {
      r = api(M, 'resendFlow', { id: a, note: 'try', force: force });
      assert.deepStrictEqual([r.done.length, r.failed.length, r.failed[0].error], [0, 1, 'Not sent again: To check (warnings, not mistakes): Line 2: MH-1: KM Reading 5 is less than the earlier KM Reading 9. | Line 4: MH-2: Hrs Reading 1 is less than the earlier Hrs Reading 2. – entry ' + a + ' stays as it is (nothing is lost); send it again when this is put right.'], 'force ' + force);
    }
    assert.deepStrictEqual([req(a).status, req(a).history.length, argsOf(a)], ['Returned', h0, [{ n: 'A' }]], 'nothing changed');
    assert.deepStrictEqual(run('() => SAVED129.slice()'), []);
    // ---- mistakes: line by line ----
    const b = sent('B');
    W('errors');
    r = api(S, 'decideChangeRequest', { id: b, approve: true });
    assert.deepStrictEqual([r.status, r.result], ['Returned', 'Not saved: Line 3: "MH-X" is not in Master.']);
    // ---- one warning ("… Save anyway?"): said without the page's question ----
    const c = sent('C');
    W('warn');
    assert.strictEqual(api(S, 'decideChangeRequest', { id: c, approve: true }).result, 'Not saved: To check (a warning, not a mistake): MH-1: the next entry has a lower reading.');
    // ---- many lines: the approval says 8 and how many more; Send again lists them all ----
    const e = sent('E');
    W('many');
    r = api(S, 'decideChangeRequest', { id: e, approve: true });
    assert.ok(/^Not saved: To check \(warnings, not mistakes\): Line 1: MH-1: .* \| Line 8: MH-8: [^|]* \| … 4 more$/.test(r.result), r.result);
    r = api(M, 'resendFlow', { id: e, note: 'x' });
    assert.strictEqual(r.failed[0].error.split(' | ').length, 12, r.failed[0].error);
    // ---- every answer in words ----
    assert.deepStrictEqual(run(`() => [flowRefusal_({ ok: false, used: [{ id: 'JCB-1', diesel: 2, log: 0 }] }), flowRefusal_({ ok: false, duplicates: [{ vendor: 'V1', existing: [{ billNo: '4', rev: 1 }] }] }), flowRefusal_({ ok: false, warning: 'X. Delete anyway?' }), flowRefusal_({ ok: false, error: 'E1' }), flowRefusal_({ ok: false })]`),
      [{ warn: true, text: 'To check (a warning, not a mistake): JCB-1 has 2 Diesel Issue and 0 Log Book entries (they stay)' },
        { warn: true, text: 'To check (a warning, not a mistake): V1: a bill for the same period is already submitted (RA Bill 4 rev 1) – the new one is saved with the same bill number as its revision and the older one is marked Superseded' },
        { warn: true, text: 'To check (a warning, not a mistake): X.' }, { warn: false, text: 'E1' }, { warn: false, text: 'the save refuses it – open the entry\'s page to see why' }]);
    // ---- the page: no "Send again anyway" (update-131); the words in Marathi and Hindi ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.ok(app.indexOf('Send again anyway\'') === -1 && app.indexOf('warnLines') === -1);
    ['mr', 'hi'].forEach(l => { const d = JSON.parse(fs.readFileSync(path.join(root, 'app', 'i18n', l + '.json'), 'utf8'));
      ['To check (warnings, not mistakes): {0}', 'To check (a warning, not a mistake): {0}'].forEach(k => assert.ok(d[k], l + ': ' + k)); });
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k129.flush; SbBook_.prototype.loadMany = __k129.loadMany; SbSheet_.prototype.load_ = __k129.load_; sbDiscard_ = __k129.discard; rtcPush_ = __k129.push; delete API_.test129;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
});

test('update-130: Open & correct – the sender opens his returned / rejected Diesel Issue entry in its form, what is wrong marked; corrected, it goes to verification again (what changed in its steps)', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // the three Diesel Issue saves answer as theirs do (a KM reading under 100 is a mistake in "strict"; one entry: a warning unless force)
  vm.runInContext(`globalThis.__k130 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_,
      one: API_.saveDieselIssue, bulk: API_.saveDieselBulk, imp: API_.importDiesel };
    globalThis.DB130 = {};
    globalThis.__fill130 = s => { const d = DB130[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep130 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill130(s); if (s.loaded) DB130[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep130(this); __k130.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill130(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill130(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    globalThis.SENT130 = []; rtcPush_ = function (ids, msg) { SENT130.push(msg); };
    globalThis.W130 = 'clean'; globalThis.SAVED130 = [];
    const bad = (rows, k) => rows.map((r, i) => ({ row: (k ? r.line : i + 1), r: r })).filter(x => W130 === 'strict' && x.r && x.r.kmReading !== '' && x.r.kmReading !== undefined && Number(x.r.kmReading) < 100)
      .map(x => ({ row: x.row, msg: x.r.no + ': KM Reading ' + x.r.kmReading + ' is less than the last KM Reading 100.' }));
    API_.saveDieselBulk = { m: 'Diesel Issue', edit: true, f: b => { const e = bad(b.rows || []); if (e.length) return { ok: false, errors: e }; if (!FLOW_DRY_ON_) SAVED130.push(['bulk', b]); return { ok: true, count: b.rows.length }; } };
    API_.importDiesel = { m: 'Diesel Issue', edit: true, f: rows => { const e = bad(rows, true); if (e.length) return { ok: false, errors: e }; if (!FLOW_DRY_ON_) SAVED130.push(['imp', rows]); return { ok: true, count: rows.length }; } };
    API_.saveDieselIssue = { m: 'Diesel Issue', edit: true, withUser: true, f: (u, d) => { if (W130 === 'strict' && !d.force) return { ok: false, warning: d.no + ': the next fill has a lower reading. Save anyway?' }; if (!FLOW_DRY_ON_) SAVED130.push(['one', d]); return { ok: true, id: 'DI-1' }; } };
    kvWrite_("FLOW_RULES", "{}"); kvWrite_("CR_SUPERS", JSON.stringify(["sa130@rcl.test"]));`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'd'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('mahesh130@rcl.test', 'Mahesh Jadhav', false, { 'Diesel Issue': 'Edit' }), mk('shubham130@rcl.test', 'Shubham', false, { 'Diesel Issue': 'Edit' }), mk('sa130@rcl.test', 'Super C', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok130_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa130@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const M = 'mahesh130@rcl.test', S = 'shubham130@rcl.test', SA = 'sa130@rcl.test';
    const W = w => run('w => { W130 = w; }', w);
    assert.ok(api(SA, 'saveFlowRules', { tasks: { 'Diesel Issue': { on: true, levels: [[S]] } } }).ok);
    const sent = (fn, ...a) => { W('clean'); const t = api(M, fn, ...a).THROWN || ''; assert.match(t, /^Sent for verification/, t); return t.match(/VF-\d{5}/)[0]; };
    const req = (who, id) => api(who, 'getChangeRequests', {}).requests.find(x => x.id === id);
    const argsOf = id => JSON.parse(run('id => flowAll_().find(r => r.id === id).args', id));
    const saved = () => run('() => SAVED130.slice()');
    // ---- MULTIPLE ENTRIES (one date): returned with a mistake on row 1 ----
    const B = { date: '2026-10-18', shift: 'Day', source: 'Dispenser', rows: [{ no: 'MH-1', qty: '10', kmReading: '50', hrReading: '', driver: 'Ravi', remark: '' }, { no: 'MH-2', qty: '5', kmReading: '500', hrReading: '', driver: '', remark: '' }, { no: '', qty: '', kmReading: '', hrReading: '', driver: '', remark: '' }], force: false };
    const a = sent('saveDieselBulk', B);
    W('strict');
    let r = api(S, 'decideChangeRequest', { id: a, approve: true });
    assert.deepStrictEqual([r.status, r.result], ['Returned', 'Not saved: Line 1: MH-1: KM Reading 50 is less than the last KM Reading 100.']);
    assert.deepStrictEqual([req(M, a).canFix, req(M, a).canResend, !!req(S, a).canFix], [true, true, false], 'only the sender may open it');
    // only the sender opens it; it opens as it was sent, with what is wrong NOW
    assert.strictEqual(api(S, 'openFlow', { id: a }).THROWN, 'Only the person who sent entry ' + a + ' opens and corrects it.');
    r = api(M, 'openFlow', { id: a });
    assert.deepStrictEqual([r.form, r.fn, r.status, r.args, r.check], ['date', 'saveDieselBulk', 'Returned', [B], { ok: false, errors: [{ row: 1, msg: 'MH-1: KM Reading 50 is less than the last KM Reading 100.' }] }], JSON.stringify(r).slice(0, 500));
    assert.deepStrictEqual(saved(), [], 'opening saves nothing');
    // a remark is needed; still wrong → said on its rows (as the save says it), nothing changes
    assert.strictEqual(api(M, 'editFlow', { id: a, args: [B] }).THROWN, 'Write what you corrected – your remark goes with the entry to the people who approve it.');
    const B2 = JSON.parse(JSON.stringify(B)); B2.rows[1].kmReading = '550';
    r = api(M, 'editFlow', { id: a, note: 'row 2 reading', args: [B2] });
    assert.deepStrictEqual([r.ok, r.notSent, r.errors], [false, true, [{ row: 1, msg: 'MH-1: KM Reading 50 is less than the last KM Reading 100.' }]]);
    assert.deepStrictEqual([req(M, a).status, argsOf(a)], ['Returned', [B]], 'not sent: nothing changed');
    assert.match(api(M, 'editFlow', { id: a, note: 'x', args: [{ rows: 'x' }] }).THROWN, /cannot be sent like this – open it again and correct it in its form\.$/);
    // corrected → the same request waits again at level 1, corrected; its steps say what changed; the approver is told
    B2.rows[0].kmReading = '150'; B2.rows[0].driver = 'Ravi Patil';
    run('() => { SENT130.length = 0; }');
    r = api(M, 'editFlow', { id: a, note: 'Reading corrected from the meter photo', args: [B2] });
    assert.deepStrictEqual([r.ok, r.id, r.status, r.level, r.levels, r.to], [true, a, 'Pending', 1, 1, ['Shubham']], JSON.stringify(r).slice(0, 400));
    assert.deepStrictEqual(r.changes, ['Row 1 – KM reading: 50 → 150', 'Row 1 – Driver: Ravi → Ravi Patil', 'Row 2 – KM reading: 500 → 550']);
    const ra = r.list.requests.find(x => x.id === a), last = ra.history.slice(-1)[0];
    assert.deepStrictEqual([ra.status, ra.canFix, ra.canResend, last.step, last.note, last.changes], ['Pending', undefined, false, 'Corrected and sent again', 'Reading corrected from the meter photo', r.changes]);
    assert.deepStrictEqual(argsOf(a), [B2], 'the corrected entry is what waits');
    assert.deepStrictEqual(run('() => SENT130.map(m => m.title)'), ['Corrected and sent again – ' + run("() => MODULE_LABEL_['Diesel Issue'] || 'Diesel Issue'") + ' by Mahesh Jadhav']);
    assert.ok(run('() => table_(LOG_SHEET, []).rows.some(x => x.join("|").indexOf("Verification – corrected and sent again by the sender") > -1 && x.join("|").indexOf("Row 1 – KM reading: 50 → 150") > -1)'), 'the Activity Log');
    assert.match(api(M, 'openFlow', { id: a }).THROWN, new RegExp('^Entry ' + a + ' is waiting for verification already – only a rejected or returned entry is opened to correct\\.$'));
    assert.strictEqual(api(S, 'decideChangeRequest', { id: a, approve: true }).status, 'Approved');
    assert.deepStrictEqual(saved(), [['bulk', B2]], 'approved: the corrected entry is saved');
    // ---- ONE ENTRY: a warning ("Save anyway?") – sent with it confirmed; its photos stay with it ----
    const D = { date: '2026-10-18', shift: 'Day', source: 'Dispenser', no: 'MH-3', qty: 20, kmReading: 900, hrReading: '', driver: '', remark: '', force: false, mode: 'KM', photos: [{ k: 'dash', p: 'p/dash.jpg' }, { k: 'pump', p: 'p/pump.jpg' }] };
    const b = sent('saveDieselIssue', D);
    assert.strictEqual(api(S, 'decideChangeRequest', { id: b, approve: false, note: 'litres?' }).status, 'Rejected');
    assert.strictEqual(req(M, b).canFix, true, 'a rejected entry too');
    W('strict');
    r = api(M, 'openFlow', { id: b });
    assert.deepStrictEqual([r.form, r.check], ['one', { ok: false, warning: 'MH-3: the next fill has a lower reading. Save anyway?' }]);
    const D2 = Object.assign({}, D, { qty: 18, photos: [{ k: 'pump', p: 'p/pump2.jpg' }] });      // a new Dispenser photo taken in the form
    r = api(M, 'editFlow', { id: b, note: 'litres 18', args: [D2] });
    assert.deepStrictEqual([r.ok, r.notSent, r.warning], [false, true, 'MH-3: the next fill has a lower reading. Save anyway?']);
    r = api(M, 'editFlow', { id: b, note: 'litres 18', args: [Object.assign({}, D2, { force: true })] });
    assert.deepStrictEqual([r.status, r.changes], ['Pending', ['Litres: 20 → 18']], 'force is not a change; the photos: as many as before');
    assert.deepStrictEqual(argsOf(b)[0].photos, [{ k: 'dash', p: 'p/dash.jpg' }, { k: 'pump', p: 'p/pump2.jpg' }], 'the photos sent with it stay; the new one of its kind takes its place');
    assert.strictEqual(api(S, 'decideChangeRequest', { id: b, approve: true }).status, 'Approved');
    assert.deepStrictEqual(saved().slice(-1)[0][1].qty, 18);
    // ---- MULTIPLE ENTRIES (one machinery): opens; several machinery → not here (Send again only) ----
    const R = [{ line: 1, date: '2026-10-17', shift: 'Day', source: 'Dispenser', no: 'MH-4', qty: 10, kmReading: 40, hrReading: '', driver: '', remark: '' }, { line: 2, date: '2026-10-18', shift: 'Day', source: 'Dispenser', no: 'MH-4', qty: 12, kmReading: 160, hrReading: '', driver: '', remark: '' }];
    const c = sent('importDiesel', R);
    W('strict');
    assert.strictEqual(api(S, 'decideChangeRequest', { id: c, approve: true }).status, 'Returned');
    r = api(M, 'openFlow', { id: c });
    assert.deepStrictEqual([r.form, r.check.errors], ['mach', [{ row: 1, msg: 'MH-4: KM Reading 40 is less than the last KM Reading 100.' }]]);
    const R2 = [Object.assign({}, R[0], { kmReading: 140 }), R[1], Object.assign({}, R[1], { line: 3, date: '2026-10-19', kmReading: 170 })];
    r = api(M, 'editFlow', { id: c, note: 'ok', args: [R2] });
    assert.deepStrictEqual(r.changes, ['Row 1 – KM reading: 40 → 140', 'Row 3: added']);
    const d = sent('importDiesel', [R[0], Object.assign({}, R[1], { no: 'MH-5' })]);
    api(S, 'decideChangeRequest', { id: d, approve: false, note: 'no' });
    assert.deepStrictEqual([req(M, d).canResend, req(M, d).canFix], [true, false]);
    assert.match(api(M, 'openFlow', { id: d }).THROWN, /cannot be opened to correct here \(Diesel Issue – one entry and Multiple entries – only, for now\) – use "Send again", or enter it again\.$/);
    // ---- the words of what changed ----
    assert.deepStrictEqual(run(`() => flowChanges_([{ date: '2026-10-01', shift: 'Day', rows: [{ no: 'A', qty: '1' }, { no: 'B', qty: '2' }] }], [{ date: '2026-10-02', shift: 'Day', rows: [{ no: 'A', qty: '1' }] }])`), ['Date: 2026-10-01 → 2026-10-02', 'Row 2: taken out']);
    assert.deepStrictEqual(run(`() => flowChanges_([{ rows: [{ no: 'A' }, { no: 'B', mode: 'KM' }] }], [{ rows: [{ no: 'A', mode: 'KM' }, { no: 'B', mode: 'Meter not working' }] }])`), ['Row 2 – Measured by: KM → Meter not working'], '"Measured by" put by the page is not a change');
    // ---- the page ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /approvals: \{ saves: \[[^\]]*'openFlow', 'editFlow', 'resendFlow'\]/);
    assert.match(app, /r\.canFix \? '<button class="btn small" type="button" data-fvfix="' \+ esc\(r\.id\) \+ '">Open &amp; correct<\/button> ' : ''/);
    assert.match(app, /\(r\.canFix \? '<button class="btn small" type="button" data-crfix="' \+ esc\(r\.id\) \+ '">Open &amp; correct<\/button> ' : ''\)/);
    assert.match(app, /const res = fixing \? await flowFixCall\(\[d\]\) : editing \? await call\('updateDieselIssue', editing, Object\.assign\(\{\}, d, \{ ver: S\.editDieselVer \|\| '' \}\)\) : await call\('saveDieselIssue', d\);/);
    assert.match(app, /const res = fixing \? await flowFixCall\(\[b\]\) : await call\('saveDieselBulk', b\);/);
    assert.match(app, /const res = fixing \? await flowFixCall\(\[out\]\) : await call\('importDiesel', out\);/);
    assert.match(app, /return call\('editFlow', \{ id: fx\.id, note: fx\.note, args: args \}\);/);
    assert.match(app, /<div class="fixbar" id="d_fixbar" hidden><\/div>/);
    ['mr', 'hi'].forEach(l => { const dd = JSON.parse(fs.readFileSync(path.join(root, 'app', 'i18n', l + '.json'), 'utf8'));
      ['Open & correct', 'Stop correcting', 'Write what you corrected.', 'Only the person who sent entry {0} opens and corrects it.', '{0} corrected and sent again for verification (level 1{1}) – saved when approved.'].forEach(k => assert.ok(dd[k], l + ': ' + k)); });
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k130.flush; SbBook_.prototype.loadMany = __k130.loadMany; SbSheet_.prototype.load_ = __k130.load_; sbDiscard_ = __k130.discard; rtcPush_ = __k130.push;
      API_.saveDieselIssue = __k130.one; API_.saveDieselBulk = __k130.bulk; API_.importDiesel = __k130.imp;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
});

test('update-134: the Super Admin deletes Diesel Issue entries – saved, waiting, rejected – of a date or a period (ticked; all or none; not one of a submitted bill or a closed month), and brings them back from Deleted entries', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  vm.runInContext(`globalThis.__k134 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_, blo: billLockOf_ };
    globalThis.DB134 = {};
    globalThis.__fill134 = s => { const d = DB134[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep134 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill134(s); if (s.loaded) DB134[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep134(this); __k134.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill134(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill134(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    rtcPush_ = function () {};
    kvWrite_("FLOW_RULES", "{}"); kvWrite_("CR_SUPERS", JSON.stringify(["sa134@rcl.test"])); PropertiesService.getScriptProperties().deleteProperty("BOOKS_CLOSED_UPTO");`, ctx);
  try {
    const mach = (no, unit) => run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Tipper', type: 'Tipper', unit: unit, worksOn: [unit], kmStd: 4, hrStd: 5, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
    assert.ok(mach('SD-1', 'KM').ok && mach('SD-2', 'Hrs').ok);
    assert.ok(run('x => saveInward_(x)', { date: '2026-07-31', location: 'Dispenser', pump: 'Pump', qty: 100, rate: 92, billNo: 'SD134', billDate: '2026-07-31' }).ok);
    const one = (date, no, x) => run('x => saveDieselIssue_(x)', Object.assign({ date: date, shift: 'Day', source: 'Dispenser', no: no, qty: 10 }, x || {}));
    run('() => { ACTOR_ = "Store Keeper"; }');      // who entered them (the earlier tests leave their own)
    const d1 = one('2026-08-01', 'SD-1', { kmReading: 1000 }).id, d2 = one('2026-08-02', 'SD-1', { kmReading: 1100 }).id, d3 = one('2026-08-02', 'SD-2', { hrReading: 50 }).id;
    assert.ok(d1 && d2 && d3);
    const PW = 'sha256$0123456789abcdef$' + 'd'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('mahesh134@rcl.test', 'Mahesh Jadhav', false, { 'Diesel Issue': 'Edit' }), mk('shubham134@rcl.test', 'Shubham', false, { 'Diesel Issue': 'Edit' }), mk('admin134@rcl.test', 'Admin D', true), mk('sa134@rcl.test', 'Super D', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok134_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa134@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const M = 'mahesh134@rcl.test', S = 'shubham134@rcl.test', AD = 'admin134@rcl.test', SA = 'sa134@rcl.test';
    assert.ok(api(SA, 'saveFlowRules', { tasks: { 'Diesel Issue': { on: true, levels: [[S]] } } }).ok);
    const bulk = (date, km) => ({ date: date, shift: 'Day', source: 'Dispenser', rows: [{ no: 'SD-1', qty: '5', kmReading: String(km), hrReading: '', driver: '', remark: '' }] });
    const v1 = (api(M, 'saveDieselBulk', bulk('2026-08-03', 1200)).THROWN || '').match(/VF-\d{5}/)[0], v2 = (api(M, 'saveDieselBulk', bulk('2026-08-04', 1300)).THROWN || '').match(/VF-\d{5}/)[0];
    assert.strictEqual(api(S, 'decideChangeRequest', { id: v2, approve: false, note: 'wrong litres' }).status, 'Rejected');
    const rows = () => run('() => { const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_); return t.rows.map(r => [r[t.c[H.ID]], r[t.c[H.NO]], dkey_(r[t.c[H.IDATE]]), Number(r[t.c[H.QTY]]), r[t.c[H.KMR]], r[t.c[H.HRR]], r[t.c[H.EBY]] || "", r[t.c[H.CREATED]] instanceof Date ? r[t.c[H.CREATED]].toISOString() : String(r[t.c[H.CREATED]])]); }');
    const before = rows();
    // ---- only the Super Admin (an Admin who is not the Super Admin, a user: refused) ----
    for (const who of [M, AD]) for (const fn of ['superDelList', 'superDelete', 'superRestore'])
      assert.strictEqual(api(who, fn, { from: '2026-08-01', ids: [d1] }).THROWN, 'Only the Super Admin deletes or brings back entries here (signed in through the Portal).', who + ' ' + fn);
    // ---- the list: a date or a period; who entered it; the machinery ----
    assert.strictEqual(api(SA, 'superDelList', {}).THROWN, 'Pick the date (or From and To).');
    let L = api(SA, 'superDelList', { from: '2026-08-01', to: '2026-08-04' });
    assert.deepStrictEqual([L.saved.map(r => r.id), L.waiting.map(r => [r.id, r.label, r.dates.join()]), L.deleted.length], [[d1, d2, d3], [[v1, 'Waiting for verification', '2026-08-03'], [v2, 'Rejected', '2026-08-04']], 0]);
    assert.deepStrictEqual(api(SA, 'superDelList', { from: '2026-08-02' }).saved.map(r => r.id), [d2, d3], 'one date');
    assert.deepStrictEqual(api(SA, 'superDelList', { from: '2026-08-01', to: '2026-08-04', no: 'SD-2' }).saved.map(r => r.id), [d3], 'one machinery');
    assert.deepStrictEqual(api(SA, 'superDelList', { from: '2026-08-01', to: '2026-08-04', by: 'Mahesh Jadhav' }).waiting.map(r => r.id), [v1, v2], 'who sent it');
    // ---- all together or none: one wrong → nothing deleted ----
    let r = api(SA, 'superDelete', { ids: [d1, 'DI-999999'] });
    assert.deepStrictEqual(r, { ok: false, errors: ['DI-999999: not found – deleted or changed meanwhile. Show the list again.'] });
    assert.deepStrictEqual(rows(), before, 'nothing deleted');
    assert.strictEqual(api(SA, 'superDelete', {}).THROWN, 'Tick the entries to delete first.');
    // a closed month; an entry of a submitted bill (his choice: not deleted – the bill first)
    run('() => PropertiesService.getScriptProperties().setProperty("BOOKS_CLOSED_UPTO", "2026-08-01")');
    assert.match(api(SA, 'superDelete', { ids: [d1] }).errors[0], /entries up to 01-08-2026 are closed/);
    run('() => PropertiesService.getScriptProperties().deleteProperty("BOOKS_CLOSED_UPTO")');
    run('() => { billLockOf_ = (no, dk) => noKey_(no) === "SD2" ? { id: "BL-7", billNo: "RA-7", vendor: "V Seven", company: "RCL", from: dk, to: dk } : null; }');
    assert.strictEqual(api(SA, 'superDelList', { from: '2026-08-02' }).saved.find(x => x.id === d3).bill, 'RA-7', 'the list says it (no tick)');
    assert.deepStrictEqual(api(SA, 'superDelete', { ids: [d2, d3] }), { ok: false, errors: [d3 + ' (SD-2, 02-08-2026): it is in the submitted RA Bill RA-7 of V Seven – an entry of a submitted bill is not deleted (delete that bill first).'] });
    run('() => { billLockOf_ = __k134.blo; }');
    assert.deepStrictEqual(rows(), before, 'still nothing deleted');
    // ---- deleted: two saved, one waiting, one rejected – each kept whole ----
    r = api(SA, 'superDelete', { ids: [d1, d2], flows: [v1, v2] });
    assert.deepStrictEqual([r.ok, r.deleted, r.saved, r.requests, r.kept.map(k => k.del + '=' + k.entry)], [true, 4, 2, 2, ['DEL-00001=' + d1, 'DEL-00002=' + d2, 'DEL-00003=' + v1, 'DEL-00004=' + v2]]);
    assert.deepStrictEqual(rows().map(x => x[0]), [d3], 'out of the diesel');
    const cr = api(SA, 'getChangeRequests', {}).requests.map(x => x.id);
    assert.ok(cr.indexOf(v1) === -1 && cr.indexOf(v2) === -1, 'out of Approvals: ' + cr);
    L = api(SA, 'superDelList', { from: '2026-08-01', to: '2026-08-04' });
    assert.deepStrictEqual([L.saved.map(x => x.id), L.waiting.length, L.deleted.map(x => [x.id, x.entry, x.was, x.by, x.deletedBy])],
      [[d3], 0, [['DEL-00001', d1, 'Saved', 'Store Keeper', 'Super D'], ['DEL-00002', d2, 'Saved', 'Store Keeper', 'Super D'], ['DEL-00003', v1, 'Waiting for verification', 'Mahesh Jadhav', 'Super D'], ['DEL-00004', v2, 'Rejected', 'Mahesh Jadhav', 'Super D']]]);
    // a new request does not take the number of a deleted one
    assert.match(api(M, 'saveDieselBulk', bulk('2026-08-05', 1400)).THROWN, /VF-00003/);
    // ---- brought back: the same entry (ID, values, time, who entered it) and the request as it was ----
    r = api(SA, 'superRestore', { ids: ['DEL-00001', 'DEL-00003'] });
    assert.deepStrictEqual([r.ok, r.restored, r.ids], [true, 2, [d1, v1]]);
    assert.deepStrictEqual(rows().find(x => x[0] === d1), before.find(x => x[0] === d1), 'the same row');
    const back = api(SA, 'getChangeRequests', {}).requests.find(x => x.id === v1);
    assert.strictEqual(back && back.status, 'Pending', 'waiting again');
    assert.deepStrictEqual(api(SA, 'superDelList', { from: '2026-08-01', to: '2026-08-04' }).deleted.map(x => x.id), ['DEL-00002', 'DEL-00004']);
    assert.deepStrictEqual(api(SA, 'superRestore', { ids: ['DEL-00001'] }), { ok: false, errors: ['DEL-00001: not in Deleted entries – brought back meanwhile. Show the list again.'] });
    // ---- brought back only when the diesel is there on its date: after the stock was used meanwhile → nothing brought back ----
    const fill = one('2026-08-01', 'SD-2', { qty: 60, hrReading: 40 }); assert.ok(fill.ok, 'the stock used meanwhile: ' + JSON.stringify(fill));
    assert.match(api(M, 'saveDieselBulk', bulk('2026-08-06', 1500)).THROWN, /VF-00004/, 'and 5 Ltr more waits for verification');
    r = api(SA, 'superRestore', { ids: ['DEL-00002', 'DEL-00004'] });
    assert.ok(r.ok === false && r.errors.length === 1 && r.errors[0].indexOf(d2 + ' (SD-1, 02-08-2026): ') === 0, JSON.stringify(r));
    assert.deepStrictEqual(api(SA, 'superDelList', { from: '2026-08-01', to: '2026-08-04' }).deleted.map(x => x.id), ['DEL-00002', 'DEL-00004'], 'nothing brought back');
    assert.deepStrictEqual(api(SA, 'superRestore', { ids: ['DEL-00004'] }).ids, [v2], 'the rejected request alone');
    // the Activity Log has every delete and restore
    const acts = run('() => { const t = table_(LOG_SHEET, ["Record ID"]); return t.rows.map(r => r[t.c["Record ID"]] + " " + r[t.c["Summary"]]); }');
    assert.ok([d1, d2, v1, v2].every(id => acts.some(a => a.indexOf(id + ' Deleted by the Super Admin') === 0)), JSON.stringify(acts.slice(-8)));
    assert.ok(acts.some(a => a.indexOf(d1 + ' Brought back by the Super Admin from Deleted entries (DEL-00001)') === 0));
    // ---- the page: the panel for the Super Admin only; its help in 3 languages ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.ok(app.indexOf('<div class="panel" id="sx_panel" hidden>') > -1 && app.indexOf("if ($('sx_panel')) { $('sx_panel').hidden = !u.super;") > -1);
    assert.ok(["call('superDelList'", "call('superDelete'", "call('superRestore'"].every(x => app.indexOf(x) > -1));
    const H2 = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules };')();
    for (const [m, want] of [['Only the Super Admin deletes or brings back entries here (signed in through the Portal).', /Only the Super Admin/],
      [d3 + ' (SD-2, 02-08-2026): it is in the submitted RA Bill RA-7 of V Seven – an entry of a submitted bill is not deleted (delete that bill first).', /Delete that bill first/],
      ['DEL-00001: not in Deleted entries – brought back meanwhile. Show the list again.', /Show entries/], ['Tick the entries to delete first.', /Nothing is picked/]])
      assert.match(H2.fixRules(m)[0].en.join(' '), want, m);
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k134.flush; SbBook_.prototype.loadMany = __k134.loadMany; SbSheet_.prototype.load_ = __k134.load_; sbDiscard_ = __k134.discard; rtcPush_ = __k134.push; billLockOf_ = __k134.blo;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); PropertiesService.getScriptProperties().deleteProperty("BOOKS_CLOSED_UPTO"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
});

test('update-131: a diesel reading is checked BY ITS DATE (the fills before and after it); an entry for approval with a reading that does not fit is a MISTAKE – no "anyway", corrected first', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  vm.runInContext(`globalThis.__k131 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB131 = {};
    globalThis.__fill131 = s => { const d = DB131[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; };
    globalThis.__keep131 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill131(s); if (s.loaded) DB131[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    SB_BOOK_ = null;
    SbBook_.prototype.flush = function () { __keep131(this); __k131.flush.call(this); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill131(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill131(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    rtcPush_ = function () {};
    kvWrite_("FLOW_RULES", "{}"); kvWrite_("CR_SUPERS", JSON.stringify(["sa131@rcl.test"]));`, ctx);
  try {
    const mach = (no, unit) => run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Tipper', type: 'Tipper', unit: unit, worksOn: [unit], kmStd: 4, hrStd: 5, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
    assert.ok(mach('RD-1', 'KM').ok && mach('RD-2', 'Hrs').ok);
    assert.ok(run('x => saveInward_(x)', { date: '2026-07-31', location: 'Dispenser', pump: 'Pump', qty: 2000, rate: 92, billNo: 'RD131', billDate: '2026-07-31' }).ok);
    const one = (date, km, x) => run('x => saveDieselIssue_(x)', Object.assign({ date: date, shift: 'Day', source: 'Dispenser', no: 'RD-1', qty: 10, kmReading: km }, x || {}));
    assert.ok(one('2026-08-01', 1000).ok && one('2026-08-05', 1500).ok);
    // ---- a save that waits for no one: by its date; "Save anyway" stays ----
    assert.ok(one('2026-08-03', 1200).ok, 'between the fill before (1000) and after (1500): fits – until update-131 "less than the last 1500"');
    assert.strictEqual(one('2026-08-04', 900).warning, 'RD-1: KM Reading 900 is less than the earlier KM Reading 1200 (fill of 03-08-2026, Day). Save anyway?');
    assert.strictEqual(one('2026-08-04', 1600).warning, 'RD-1: KM Reading 1600 is more than the later KM Reading 1500 (fill of 05-08-2026, Day). Save anyway?');
    const B = rows => ({ date: '2026-08-04', shift: 'Day', source: 'Dispenser', rows: rows });
    const r1 = { no: 'RD-1', qty: '5', kmReading: '1300', hrReading: '', driver: '', remark: '' }, r2 = { no: 'RD-1', qty: '5', kmReading: '1250', hrReading: '', driver: '', remark: '' };
    assert.deepStrictEqual(run('x => saveDieselBulk_(x)', B([r1, r2])), { ok: false, warnings: [{ row: 2, msg: 'RD-1: KM Reading 1250 is less than the earlier KM Reading 1300 (row 1 of this entry).' }] }, 'the rows above it count too');
    // ---- for approval (checked when sent / sent again / corrected, or saved at the approval): a mistake – "force" does not pass it ----
    const strict = (fn, x) => run('(f, x) => { FLOW_DRY_ON_ = true; try { return globalThis[f](x); } finally { FLOW_DRY_ON_ = false; } }', fn, x);
    assert.deepStrictEqual(strict('saveDieselBulk_', Object.assign(B([r1, r2]), { force: true })), { ok: false, errors: [{ row: 2, msg: 'RD-1: KM Reading 1250 is less than the earlier KM Reading 1300 (row 1 of this entry).' }] });
    assert.strictEqual(strict('saveDieselIssue_', { date: '2026-08-04', shift: 'Day', source: 'Dispenser', no: 'RD-1', qty: 10, kmReading: 900, force: true }).THROWN,
      'RD-1: KM Reading 900 is less than the earlier KM Reading 1200 (fill of 03-08-2026, Day). Correct the reading – an entry for approval goes only when its readings fit.');
    assert.deepStrictEqual(strict('importDiesel_', [{ line: 1, date: '2026-08-06', shift: 'Day', source: 'Dispenser', no: 'RD-1', qty: 5, kmReading: 1400 }, { line: 2, date: '2026-08-07', shift: 'Day', source: 'Dispenser', no: 'RD-1', qty: 5, kmReading: 1350 }]),
      { ok: false, errors: [{ row: 1, msg: 'RD-1: KM Reading 1400 is less than the earlier KM Reading 1500 (fill of 05-08-2026, Day).' }, { row: 2, msg: 'RD-1: KM Reading 1350 is less than the earlier KM Reading 1400 (row 1 of this entry).' }] }, 'one machinery – many dates: checked for approval too (row 2: the nearest fill before it is row 1)');
    // ---- through the app: the rule on; the maker cannot send a reading that does not fit, even "anyway" ----
    const PW = 'sha256$0123456789abcdef$' + 'd'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('mahesh131@rcl.test', 'Mahesh Jadhav', false, { 'Diesel Issue': 'Edit' }), mk('shubham131@rcl.test', 'Shubham', false, { 'Diesel Issue': 'Edit' }), mk('sa131@rcl.test', 'Super C', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok131_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa131@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const M = 'mahesh131@rcl.test', S = 'shubham131@rcl.test', SA = 'sa131@rcl.test';
    assert.ok(api(SA, 'saveFlowRules', { tasks: { 'Diesel Issue': { on: true, levels: [[S]] } } }).ok);
    const rowNow = km => ({ no: 'RD-1', qty: '5', kmReading: String(km), hrReading: '', driver: '', remark: '' });
    const D6 = (km, force) => ({ date: '2026-08-06', shift: 'Day', source: 'Dispenser', rows: [rowNow(km)], force: !!force });
    let r = api(M, 'saveDieselBulk', D6(1400, true));
    assert.deepStrictEqual(r, { ok: false, errors: [{ row: 1, msg: 'RD-1: KM Reading 1400 is less than the earlier KM Reading 1500 (fill of 05-08-2026, Day).' }] }, 'not sent – "Save all anyway" does not send it');
    const sent = api(M, 'saveDieselBulk', D6(1600)).THROWN || '';
    assert.match(sent, /^Sent for verification/);
    const a = sent.match(/VF-\d{5}/)[0];
    // meanwhile a later fill with a lower reading is saved (a save that waits for no one) – at the approval it does not fit: Returned
    assert.ok(run('x => saveDieselIssue_(x)', { date: '2026-08-06', shift: 'Night', source: 'Dispenser', no: 'RD-1', qty: 10, kmReading: 1550, force: true }).ok);
    r = api(S, 'decideChangeRequest', { id: a, approve: true });
    assert.deepStrictEqual([r.status, r.result], ['Returned', 'Not saved: Line 1: RD-1: KM Reading 1600 is more than the later KM Reading 1550 (fill of 06-08-2026, Night).'], JSON.stringify(r));
    // "Send again anyway" is gone: force is not read; the reason is said in full
    r = api(M, 'resendFlow', { id: a, note: 'anyway', force: true });
    assert.deepStrictEqual([r.done.length, r.failed[0].error, 'warn' in r.failed[0]], [0, 'Not sent again: Line 1: RD-1: KM Reading 1600 is more than the later KM Reading 1550 (fill of 06-08-2026, Night). – entry ' + a + ' stays as it is (nothing is lost); send it again when this is put right.', false]);
    // Open & correct: the wrong row marked; corrected → sent; approved → saved
    r = api(M, 'openFlow', { id: a });
    assert.deepStrictEqual(r.check, { ok: false, errors: [{ row: 1, msg: 'RD-1: KM Reading 1600 is more than the later KM Reading 1550 (fill of 06-08-2026, Day).'.replace('Day).', 'Night).') }] });
    r = api(M, 'editFlow', { id: a, note: 'reading 1530', args: [D6(1530, true)] });
    assert.deepStrictEqual([r.ok, r.status, r.changes], [true, 'Pending', ['Row 1 – KM reading: 1600 → 1530']], JSON.stringify(r).slice(0, 300));
    assert.strictEqual(api(S, 'decideChangeRequest', { id: a, approve: true }).status, 'Approved');
    assert.ok(run('() => table_(APP.SHEET_DIESEL, DIESEL_COLS_).rows.some(r => r[table_(APP.SHEET_DIESEL, DIESEL_COLS_).c[H.NO]] === "RD-1" && Number(r[table_(APP.SHEET_DIESEL, DIESEL_COLS_).c[H.KMR]]) === 1530)'), 'saved as corrected');
    // ---- the page: no "Send again anyway"; the help for a reading by its date ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.ok(app.indexOf("ok: 'Send again anyway'") === -1 && app.indexOf("'Please check – warnings, not mistakes'") === -1);
    assert.match(app, /if \(fixing\) \{ toast\('Not sent\. Correct the rows marked\.', true\); return; \}/);
    assert.match(app, /\{ re: \/is less than the earlier \(KM\|Hrs\) Reading\|is more than the later \(KM\|Hrs\) Reading\|an entry for approval goes only when its readings fit\/i,/);
    const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
    assert.ok(!/readingWarnings_\(|lastReadings_\(|flowForce_\(/.test(code), 'the check against the newest fill and the "anyway" of Send again are gone');
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k131.flush; SbBook_.prototype.loadMany = __k131.loadMany; SbSheet_.prototype.load_ = __k131.load_; sbDiscard_ = __k131.discard; rtcPush_ = __k131.push;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
});

test('update-132: a BOQ amendment changes only its machinery, from any date on or after the BOQ start (also after its end); the rate history machinery-wise = what the bills take', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  assert.ok(run('(x, m) => saveVendor_(x, m)', { name: 'Hist Vendor', gstReg: 'No', pan: 'ABCDE1234H', bank: 'SBI', account: '12345670', ifsc: 'SBIN0000001' }, 'add').ok !== false);
  const mach = no => run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Tanker', type: 'Water Tanker', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Hist Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
  assert.ok(mach('HV-1').ok && mach('HV-2').ok);
  const line = (no, rate) => ({ no: no, basis: 'Per Trip', rate: rate, diesel: 'Company' });
  const b1 = run('(x, m) => saveBoq_(x, m)', { vendor: 'Hist Vendor', from: '2026-01-01', to: '2026-08-31', tdsPct: 2, woNo: 'WO-HIST', lines: [line('HV-1', 100), line('HV-2', 300)] }, 'add');
  assert.ok(b1.ok, JSON.stringify(b1));
  // amendment 1: only HV-1, from 01-02 (open); amendment 2: only HV-2, from 01-09 – after BOQ 1 ends (until update-132: refused)
  const a1 = run('(x, m) => saveBoq_(x, m)', { vendor: 'Hist Vendor', amendOf: b1.id, from: '2026-02-01', to: '', tdsPct: 2, woNo: 'WO-HIST', lines: [line('HV-1', 200)] }, 'add');
  const a2 = run('(x, m) => saveBoq_(x, m)', { vendor: 'Hist Vendor', amendOf: b1.id, from: '2026-09-01', to: '2026-09-30', tdsPct: 2, woNo: 'WO-HIST', lines: [line('HV-2', 350)] }, 'add');
  assert.ok(a1.ok && a2.ok, JSON.stringify([a1, a2]));
  assert.deepStrictEqual([a1.amendNo, a2.amendNo], [1, 2]);
  assert.strictEqual(run('(x, m) => saveBoq_(x, m)', { vendor: 'Hist Vendor', amendOf: b1.id, from: '2025-12-01', tdsPct: 2, lines: [line('HV-1', 50)] }, 'add').THROWN,
    'The amendment must start on or after the start of BOQ ' + b1.no + ' (01-01-2026).');
  // the history: period by period, which BOQ / amendment
  const h = run('() => getBoqs_({ vendor: "Hist Vendor" }).history');
  const simple = h.map(x => [x.no, x.periods.map(p => [p.from, p.to, p.amendNo ? 'A' + p.amendNo + ' of ' + p.of : 'BOQ ' + p.boqNo, p.line.rate, p.woNo])]);
  assert.deepStrictEqual(simple, [
    ['HV-1', [['2026-01-01', '2026-01-31', 'BOQ ' + b1.no, 100, 'WO-HIST'], ['2026-02-01', '', 'A1 of ' + b1.no, 200, 'WO-HIST']]],
    ['HV-2', [['2026-01-01', '2026-08-31', 'BOQ ' + b1.no, 300, 'WO-HIST'], ['2026-09-01', '2026-09-30', 'A2 of ' + b1.no, 350, 'WO-HIST']]],
  ], JSON.stringify(simple));
  // = what the bills take, every day of the year (boqRateFor_)
  const days = run(`() => { const out = []; let d = '2025-12-30'; while (d <= '2027-01-02') { ['HV-1', 'HV-2'].forEach(no => { const r = boqRateFor_('Hist Vendor', no, d); out.push([no, d, r ? r.line.rate : null]); }); d = addDays_(d, 1); } return out; }`);
  const fromHist = (no, d) => { const p = h.find(x => x.no === no).periods.find(p => p.from <= d && (!p.to || p.to >= d)); return p && !p.none ? p.line.rate : null; };
  const diff = days.filter(([no, d, r]) => fromHist(no, d) !== r);
  assert.deepStrictEqual(diff, [], 'the history says exactly the bills\' rate on every day');
  assert.deepStrictEqual(['2026-01-31', '2026-02-01', '2026-10-05'].map(d => days.find(x => x[0] === 'HV-1' && x[1] === d)[2]), [100, 200, 200]);
  assert.deepStrictEqual(['2026-08-31', '2026-09-15', '2026-10-01'].map(d => days.find(x => x[0] === 'HV-2' && x[1] === d)[2]), [300, 350, null]);
  // a time with no BOQ between two periods is said
  assert.deepStrictEqual(run(`() => boqHistory_([{ id: 'X1', no: '1', vendor: 'V', from: '2026-01-01', to: '2026-01-31', amendOf: '', amendNo: 0, created: '1', lines: [{ no: 'M', rate: 1 }] },
    { id: 'X2', no: '2', vendor: 'V', from: '2026-03-01', to: '', amendOf: 'X1', amendNo: 1, created: '2', lines: [{ no: 'M', rate: 2 }] }])[0].periods.map(p => [p.from, p.to, p.none ? 'none' : p.line.rate])`),
    [['2026-01-01', '2026-01-31', 1], ['2026-02-01', '2026-02-28', 'none'], ['2026-03-01', '', 2]]);
  // the page: the history under the BOQ list; the amendment's words
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.match(app, /<div id="bh_box" hidden><\/div>/);
  assert.match(app, /const list = \(S\.boqHist \|\| \[\]\)\.filter\(h => h\.vendor === v\);/);
  assert.match(app, /Keep only the machinery whose rate changes/);
  ['mr', 'hi'].forEach(l => { const d = JSON.parse(fs.readFileSync(path.join(root, 'app', 'i18n', l + '.json'), 'utf8'));
    ['Rate history – machinery-wise', 'The amendment must start on or after the start of BOQ {0} ({1}).'].forEach(k => assert.ok(d[k], l + ': ' + k)); });
});

test('update-138: the staging (test) database – a Preview works only with a database marked as the test one; the one SQL file for it', () => {
  // the servers: a Preview checks the mark before anything is read or written; the Sheet backup never runs on a Preview; the band
  const sf = require('../server/syncfetch.js'), was = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = 'preview';
    assert.strictEqual(sf.isPreview(), true);
    assert.ok(/^This is a Preview/.test(require('../server/google.js').config().error), 'no backup on a Preview');
    assert.ok(/id="rcl_preview_band"/.test(require('../server/page.js').shell()), 'the TEST band on a Preview');
    process.env.VERCEL_ENV = 'production';
    assert.strictEqual(sf.isPreview(), false);
    assert.ok(!/id="rcl_preview_band"/.test(require('../server/page.js').shell()), 'no band live');
  } finally { if (was === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = was; }
  const src = fs.readFileSync(path.join(root, 'server', 'syncfetch.js'), 'utf8');
  assert.ok(/function fetchAllSync\(reqs, timeoutMs\) \{[^}]*previewGuard\(reqs\);/.test(src), 'every database call goes through the guard');
  assert.ok(src.indexOf("app_settings?id=eq.THIS_IS_A_TEST_DATABASE") > -1);
  // the message: 503 and the page's help in three languages
  const rpc = fs.readFileSync(path.join(root, 'api', 'rpc.js'), 'utf8');
  assert.ok(/This is a Preview \\\(a test copy of the app\\\)\/\.test\(msg\)\) return 503/.test(rpc));
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  const r = H.fixRules(sf.PREVIEW_NO)[0];
  assert.ok(r !== H.FIX_ANY && /staging|test/i.test(r.en.join(' ')) && r.mr && r.hi, 'help for the Preview message');
  // the one SQL file: up to date with the steps (when the Store and Portal repositories are next to this one)
  const mk = require('../staging/make_staging_sql.js'), sql = fs.readFileSync(path.join(root, 'staging', 'rcl_staging_all.sql'), 'utf8');
  const store = path.join(root, '..', 'rcl-store'), portal = path.join(root, '..', 'rcl-portal');
  if (fs.existsSync(path.join(store, 'sql')) && fs.existsSync(path.join(portal, 'sql'))) assert.strictEqual(sql, mk.build(store, portal).sql, 'staging/rcl_staging_all.sql is not up to date – run node staging/make_staging_sql.js');
  // nothing runs before the typed values and the guard; every step of Read Me except keep-awake (it calls the LIVE address)
  const guard = sql.indexOf('STOPPED – nothing was run: this database already has tables'), first = sql.search(/create table/i);
  assert.ok(guard > 0 && first > guard && sql.indexOf("'TYPE-YOUR-EMAIL-HERE'") > 0 && sql.indexOf("'TYPE-YOUR-EMAIL-HERE'") < guard);
  const rd = fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8'), names = (rd.match(/"name": "supabase_step[^"]+"/g) || []).map(s => s.slice(9, -1));
  assert.ok(names.length > 30);
  names.forEach(n => assert.strictEqual(sql.split('MECHANICAL: ' + n + ' ').length - 1, /step6_keep_awake/.test(n) ? 0 : 1, n));
  assert.ok(!/cron\.schedule|net\.http_get/.test(sql), 'no timer that calls an address');
  const mark = sql.indexOf("('THIS_IS_A_TEST_DATABASE', 'yes')");
  assert.ok(mark > sql.indexOf('MECHANICAL: supabase_step1.sql') && mark < sql.indexOf('MECHANICAL: supabase_step1b_grants.sql'), 'the mark right after step 1');
  assert.ok(sql.indexOf("'ORG_SETTINGS'") < sql.indexOf('MECHANICAL: supabase_step7_sites.sql') && sql.indexOf("'ORG_SETTINGS'") > sql.indexOf('MECHANICAL: supabase_step2_web.sql'));
  ['STORE: store_step1_items.sql', 'PORTAL: portal_step1.sql', 'PORTAL: portal_step2_start.sql', 'PORTAL: portal_step3_pages.sql'].forEach(k => assert.ok(sql.indexOf(k) > -1, k));
  // the test entries: made-up names only, the staging addresses, nothing live
  assert.ok(!/rcl-portal-flame|rcl-store\.vercel\.app|oneclicksolution-erp|rclerp\.vercel\.app/.test(sql), 'no live address in the staging SQL');
  assert.ok(sql.indexOf("'" + mk.MECH + "'") > -1 && sql.indexOf("'" + mk.MECH + "/store'") > -1);
  // vercel.json: the staging rules match ONLY the staging address and send to the staging Portal / Store
  const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')), st = v.rewrites.filter(x => x.has);
  assert.strictEqual(st.length, 4);
  st.forEach(x => { assert.deepStrictEqual(x.has, [{ type: 'host', value: mk.HOST }]); assert.ok(/^https:\/\/rcl-(store|portal)-git-staging-pk12356843\.vercel\.app\//.test(x.destination), x.destination); });
  assert.ok(v.rewrites.indexOf(st[3]) < v.rewrites.findIndex(x => !x.has), 'the staging rules come before the live ones');
});

test('update-143: a new entry for a shift that is already saved is added to that entry as its next row – the same work twice is refused; diesel, tank and bill as if entered together', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  run('(x, m) => saveVendor_(x, m)', { name: 'R143 Cranes', gstReg: 'No', pan: 'ABCDE1243R', bank: 'SBI', account: '12345143', ifsc: 'SBIN0000001' }, 'add');
  // two excavators on hours only (an hour meter) – one gets its two works in two saves, the other in one save: they must end the same
  ['R143-EXA', 'R143-EXB'].forEach(no => run('(x, m) => saveMaster_(x, m)', { no: no, name: 'Excavator', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 10, owner: 'R143 Cranes', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add'));
  // a Hydra read in KM + Hrs whose BOQ has two hour works with hour slabs (his BOQ of 23-10-2026: HYDRA 1,700 / 1,400 · FARANA 2,200 / 1,700)
  run('(x, m) => saveMaster_(x, m)', { no: 'R143-HYD', name: 'Hydra', type: 'Hydra', unit: 'KM + Hrs', worksOn: ['KM + Hrs'], kmStd: 4, hrStd: 5, owner: 'R143 Cranes', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R143 Cranes', from: '2026-06-01', tdsPct: 2, woNo: 'WO-R143', lines: [
    { no: 'R143-EXA', basis: 'Per Hour', rate: 1000, diesel: 'Company' }, { no: 'R143-EXB', basis: 'Per Hour', rate: 1000, diesel: 'Company' },
    { no: 'R143-HYD', basis: 'Item-wise', diesel: 'Company', items: [
      { name: 'HYDRA', basis: 'Per Hour', qty: 'rest', slabOn: 'Day', slabs: [{ upTo: 1, rate: 1700 }, { upTo: '', rate: 1400 }] },
      { name: 'FARANA', basis: 'Per Hour', qty: 'typed', slabOn: 'Day', slabs: [{ upTo: 1, rate: 2200 }, { upTo: '', rate: 1700 }] }] }] });
  run('x => saveInward_(x)', { date: '2026-06-01', location: 'Dispenser', pump: 'Pump', qty: 2000, rate: 90, billNo: 'R143', billDate: '2026-06-01' });
  ['R143-EXA', 'R143-EXB'].forEach(no => run('x => saveDieselIssue_(x)', { date: '2026-06-02', shift: 'Day', source: 'Dispenser', no: no, qty: 120, hrReading: 100, force: true }));
  const save = rows => run('x => { try { return saveLogRowsInner_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: rows });
  const stored = no => run(`no => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(x => str_(x[c[H.NO]]) === no).map(x => ({ d: dkey_(x[c[H.DATE]]), sh: str_(x[c[H.SHIFT]]), unit: str_(x[c[H.UNIT]]), okm: numOrBlank_(x[c[H.OKM]]), ckm: numOrBlank_(x[c[H.CKM]]), ohr: numOrBlank_(x[c[H.OHR]]), chr: numOrBlank_(x[c[H.CHR]]), whr: numOrBlank_(x[c[H.WHR]]), wkm: numOrBlank_(x[c[H.WKM]]), tot: numOrBlank_(x[c[H.TOT]]), qty: numOrBlank_(x[c[H.QTY]]), odsl: numOrBlank_(x[c[H.ODSL]]), stock: numOrBlank_(x[c[H.STOCK]]), items: str_(x[c[H.ITEMS]]), work: str_(x[c[H.WORK]]), chFrom: str_(x[c[H.CHFROM]]), chTo: str_(x[c[H.CHTO]]) })).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0); }`, no);
  const pre = (no, d, sh, old) => run('(n, d, s, o) => getLogRowPrefill_(n, d, s, o)', no, d, sh || 'Full Day', old ? undefined : { add: 1 });
  const E = (no, d, o) => Object.assign({ date: d, shift: 'Full Day', no: no, mode: 'Hrs', add: 1 }, o);      // (add: the page / app shows it as added to a saved entry)
  // 01-06: the first entries (opening diesel 50 L)
  let r = save([E('R143-EXA', '2026-06-01', { openingHr: 90, closingHr: 100, openingDiesel: 50 }), E('R143-EXB', '2026-06-01', { openingHr: 90, closingHr: 100, openingDiesel: 50 })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  // 02-06, first site: EXA 100 → 102 (saved); the prefill of the same shift then offers the next row
  r = save([E('R143-EXA', '2026-06-02', { openingHr: 100, closingHr: 102, chFrom: '10+000', chTo: '10+500', work: 'SITE A' })]);
  assert.ok(r.ok && !r.added, JSON.stringify(r).slice(0, 300));
  let p = pre('R143-EXA', '2026-06-02');
  assert.strictEqual(p.problem, '', 'no "already saved" any more');
  assert.deepStrictEqual([p.addTo.rows, p.addTo.kind, p.addTo.closeHr, p.openingHr, p.first, p.firstHr], [1, 'hr', 102, 102, false, false]);
  assert.strictEqual(p.openingDiesel, stored('R143-EXA')[1].stock, 'the tank after the saved entry');
  // an older app (it does not ask for it, and does not mark the row): answered and refused as before
  assert.ok(!pre('R143-EXA', '2026-06-02', 'Full Day', true).addTo && /R143-EXA already saved for 02-06-2026 \(Full Day\)\./.test(pre('R143-EXA', '2026-06-02', 'Full Day', true).problem));
  assert.ok(save([E('R143-EXA', '2026-06-02', { openingHr: 105, closingHr: 108, add: '' })]).ok === false, 'no mark: refused');
  // second site: 105 → 108 (the 3 hours between are not worked); the other excavator gets both works in ONE save
  r = save([E('R143-EXA', '2026-06-02', { openingHr: 105, closingHr: 108, chFrom: '22+000', chTo: '22+300', work: 'SITE B' })]);
  assert.ok(r.ok && r.added === 1 && r.into === 1 && r.count === 1, JSON.stringify(r).slice(0, 300));
  r = save([E('R143-EXB', '2026-06-02', { openingHr: 100, closingHr: 102, chFrom: '10+000', chTo: '10+500', work: 'SITE A' }), E('R143-EXB', '2026-06-02', { openingHr: 105, closingHr: 108, chFrom: '22+000', chTo: '22+300', work: 'SITE B' })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  const a = stored('R143-EXA'), b = stored('R143-EXB');
  assert.strictEqual(a.length, 2, 'ONE entry for 02-06');
  assert.deepStrictEqual([a[1].ohr, a[1].chr, a[1].whr, a[1].qty, a[1].tot], [100, 108, 5, 120, 50]);
  assert.deepStrictEqual(JSON.parse(a[1].items), { _parts: [{ n: '', q: 2, f: '10+000', t: '10+500', w: 'SITE A' }, { n: '', q: 3, g: 3, f: '22+000', t: '22+300', w: 'SITE B' }] });
  assert.deepStrictEqual(a.map(x => Object.assign({}, x, { d: '' })), b.map(x => Object.assign({}, x, { d: '' })), 'two saves = one save: readings, hours, diesel, tank, rows');
  assert.deepStrictEqual([a[1].odsl, a[1].stock], [b[1].odsl, b[1].stock]);
  // the same work again: refused as a duplicate, nothing saved; a work before the saved Close: refused
  const no = (rows, re) => { const x = save(rows); assert.ok(x.ok === false && x.errors.some(e => re.test(e.msg)), JSON.stringify(x).slice(0, 400)); };
  no([E('R143-EXA', '2026-06-02', { openingHr: 105, closingHr: 108 })], /R143-EXA \(02-06-2026, Full Day\): this work is already in the saved entry of this shift/);
  no([E('R143-EXA', '2026-06-02', { openingHr: 100, closingHr: 102 })], /already in the saved entry/);
  no([E('R143-EXA', '2026-06-02', { openingHr: 107, closingHr: 109 })], /starts at 107, below the Close 108 of the row before it/);
  assert.deepStrictEqual(stored('R143-EXA'), a, 'nothing changed by the refused saves');
  // a third work; Edit Log Book reads three rows; the bill pays the hours once: 2 + 3 + 1 = 6 hours × 1,000
  r = save([E('R143-EXA', '2026-06-02', { closingHr: 109, work: 'SITE C' })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  const ed = run('() => getLogEditData_("R143-EXA", "2026-06-02", "2026-06-02")');
  assert.deepStrictEqual(ed.rows[0].itemParts.map(x => x.w + ' ' + x.q), ['SITE A 2', 'SITE B 3', 'SITE C 1']);
  const amount = (no, f, t) => run('(no, f, t) => billMachineCalc_(findMachine_(no), getLogBookList_({ from: f, to: t, no: no, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [no] }), f, t, undefined, true).amount', no, f, t);
  assert.strictEqual(amount('R143-EXA', '2026-06-02', '2026-06-02'), 6 * 1000);
  // a later entry already saved (03-06 from 112): a work of 02-06 may not close above its Start (nothing else is ever moved – update-77)
  r = save([E('R143-EXA', '2026-06-03', { openingHr: 112, closingHr: 115 })]); assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  no([E('R143-EXA', '2026-06-02', { openingHr: 110, closingHr: 113 })], /Close Hrs 113 is more than the Start Hrs 112 of the entry of 03-06-2026/);
  r = save([E('R143-EXA', '2026-06-02', { openingHr: 110, closingHr: 111 })]); assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 200));
  assert.deepStrictEqual(stored('R143-EXA').map(x => [x.d, x.ohr, x.chr, x.whr]), [['2026-06-01', 90, 100, 10], ['2026-06-02', 100, 111, 7], ['2026-06-03', 112, 115, 3]]);
  // another shift is a new entry as before (a Day entry beside a Full Day one is still refused)
  no([E('R143-EXA', '2026-06-03', { shift: 'Night', openingHr: 115, closingHr: 116 })], /has a Full Day entry on 03-06-2026/);
  // a saved day without work takes no work
  r = save([E('R143-EXA', '2026-06-04', { mode: 'Idle' })]); assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  p = pre('R143-EXA', '2026-06-04');
  assert.ok(!p.addTo && /this shift is already saved, and another work cannot be added to it: the saved entry is saved as Idle/.test(p.problem), JSON.stringify(p).slice(0, 300));
  no([E('R143-EXA', '2026-06-04', { openingHr: 115, closingHr: 116 })], /another work cannot be added to it: the saved entry is saved as Idle/);
  // THE HYDRA (KM + Hrs, two hour works): HYDRA 100 → 103, then FARANA from its Close 103 → 105 – one entry, each work at its own slab rate
  r = save([{ date: '2026-06-02', shift: 'Day', no: 'R143-HYD', mode: 'KM + Hrs', openingKm: 5000, closingKm: 5010, openingHr: 100, closingHr: 103, items: {}, work: 'LIFT' }]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  p = pre('R143-HYD', '2026-06-02', 'Day');
  assert.deepStrictEqual([p.problem, p.addTo.kind, p.addTo.lastWork, p.openingHr, p.openingKm], ['', 'hr', 'HYDRA', 103, 5010]);
  no([{ date: '2026-06-02', shift: 'Day', no: 'R143-HYD', mode: 'KM + Hrs', openingKm: 5010, closingKm: 5014, openingHr: 104, closingHr: 106, items: { _all: 'FARANA' }, add: 1 }], /starts at 104 Hrs but the row before it closed at 103/);
  r = save([{ date: '2026-06-02', shift: 'Day', no: 'R143-HYD', mode: 'KM + Hrs', openingKm: 5010, closingKm: 5014, openingHr: 103, closingHr: 105, items: { _all: 'FARANA' }, work: 'PICK AND CARRY', add: 1 }]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  const h = stored('R143-HYD')[0];
  assert.deepStrictEqual([h.okm, h.ckm, h.ohr, h.chr, h.whr, h.wkm], [5000, 5014, 100, 105, 5, 14]);
  assert.deepStrictEqual(JSON.parse(h.items), { FARANA: 2, _parts: [{ n: 'HYDRA', q: 3, w: 'LIFT', o: 10 }, { n: 'FARANA', q: 2, w: 'PICK AND CARRY', o: 4 }] });      // (update-146: each row keeps its KM too – read in KM + Hrs)
  // HYDRA 3 hr = 1,700 + 2 × 1,400; FARANA 2 hr = 2,200 + 1 × 1,700 (each work's first hour of the day at its first rate)
  assert.strictEqual(amount('R143-HYD', '2026-06-02', '2026-06-02'), (1700 + 2 * 1400) + (2200 + 1700));
  // a saved entry split between the two works (typed) cannot take a row: the reason says what to do
  r = save([{ date: '2026-06-03', shift: 'Day', no: 'R143-HYD', mode: 'KM + Hrs', openingKm: 5014, closingKm: 5020, openingHr: 105, closingHr: 110, items: { FARANA: 2 } }]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  no([{ date: '2026-06-03', shift: 'Day', no: 'R143-HYD', mode: 'KM + Hrs', closingKm: 5025, closingHr: 112, items: { _all: 'HYDRA' }, add: 1 }], /the saved entry is split between two works \(HYDRA \/ FARANA|the saved entry is split between two works \(FARANA \/ HYDRA/);
  // (review 23-10-2026) a KM + Hrs machinery: adding a work NEVER moves the next entry (03-06 starts at 105 hr / 5014 km) – refused
  const h3 = stored('R143-HYD');
  no([{ date: '2026-06-02', shift: 'Day', no: 'R143-HYD', mode: 'KM + Hrs', openingKm: 5014, closingKm: 5016, openingHr: 105, closingHr: 106, items: { _all: 'HYDRA' }, add: 1 }], /R143-HYD \(02-06-2026\): Close KM 5016 is more than the Start KM 5014 of the entry of 03-06-2026 \(Day\) – adding a work never changes another entry/);
  assert.deepStrictEqual(stored('R143-HYD'), h3, 'neither entry changed');
  // (review) the first entry of a machinery keeps its opening diesel; plain rows keep their typed hours; the saved standard average stays;
  // times that overlap are the same work – each against its twin entered in ONE save
  run('(x, m) => saveMaster_(x, m)', { no: 'R143-F1', name: 'Roller', type: 'Roller', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'R143 Cranes', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'R143-F2', name: 'Roller', type: 'Roller', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'R143 Cranes', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R143 Cranes', from: '2026-06-01', tdsPct: 2, woNo: 'WO-R143B', lines: [
    { no: 'R143-F1', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'ROLLING', basis: 'Per Hour', rate: 1000, qty: 'typed' }] },
    { no: 'R143-F2', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'ROLLING', basis: 'Per Hour', rate: 1000, qty: 'typed' }] }] });
  const F = (no, o) => E(no, '2026-06-05', o);
  r = save([F('R143-F1', { openingHr: 50, closingHr: 52, openingDiesel: 40, items: { ROLLING: 2 } }), F('R143-F1', { openingHr: 53, closingHr: 54, items: { ROLLING: 1 } })]); assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  run('(x, m, o) => saveMaster_(x, m, o)', { no: 'R143-F1', name: 'Roller', type: 'Roller', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 10, owner: 'R143 Cranes', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'edit', 'R143-F1');      // (the standard changed after the save)
  r = save([F('R143-F1', { openingHr: 54, closingHr: 56, items: { ROLLING: 2 } })]); assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  r = save([F('R143-F2', { openingHr: 50, closingHr: 52, openingDiesel: 40, items: { ROLLING: 2 } }), F('R143-F2', { openingHr: 53, closingHr: 54, items: { ROLLING: 1 } }), F('R143-F2', { openingHr: 54, closingHr: 56, items: { ROLLING: 2 } })]); assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  const f1 = stored('R143-F1')[0], f2 = stored('R143-F2')[0];
  assert.deepStrictEqual([f1.odsl, f1.ohr, f1.chr, f1.whr, f1.tot, JSON.parse(f1.items).ROLLING], [40, 50, 56, 5, 40, 5], 'opening diesel 40 kept; 5 hr; the saved 8 L/hr kept (40 L, not 50); ROLLING 2 + 1 + 2');
  assert.deepStrictEqual(Object.assign({}, f1, { d: '' }), Object.assign({}, f2, { d: '' }), 'two saves = one save');
  assert.strictEqual(amount('R143-F1', '2026-06-05', '2026-06-05'), 5 * 1000);
  // a saved Time day of a machinery on hours takes a row by Hrs; a time that overlaps a saved one is the same work (whatever the spelling)
  run('(x, m) => saveMaster_(x, m)', { no: 'R143-TM', name: 'Excavator', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs', 'Time'], hrStd: 10, owner: 'R143 Cranes', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  r = save([E('R143-TM', '2026-06-06', { mode: 'Time', tSlots: [['09:00', '11:00']], tStart: '09:00', tEnd: '11:00' })]); assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  p = pre('R143-TM', '2026-06-06');
  assert.ok(p.addTo && p.addTo.kind === 'hr' && p.problem === '', JSON.stringify(p).slice(0, 300));
  r = save([E('R143-TM', '2026-06-06', { openingHr: 200, closingHr: 203 })]); assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  no([E('R143-TM', '2026-06-06', { mode: 'time', tSlots: [['10:00', '12:00']], tStart: '10:00', tEnd: '12:00' })], /R143-TM \(06-06-2026, Full Day\): this work is already in the saved entry of this shift \(the same Start and Close, From – To times that overlap, or the same trips, challan and work\)/);
  assert.strictEqual(stored('R143-TM')[0].whr, 5, '2 hr by Time + 3 hr by Hrs');
  // the server code that does it
  const code = fs.readFileSync(path.join(__dirname, '..', 'app', 'Code.gs'), 'utf8');
  assert.match(code, /const si = b\.tanker \|\| !g\.every\(p => !!p\.x\.l\.add \|\| !!FLOW_RUN_ID_\) \? -1 : logSavedIdx_\(lt, g\[0\]\.m\.id, g\[0\]\.dk, g\[0\]\.shift\);/, 'only rows marked "add" are merged (update-146: or approved in verification)');
  assert.match(code, /if \(p\.replace !== undefined\) \{      \/\/ \(update-143, review 23-10-2026\) adding a work never changes another entry/);
  assert.match(code, /again\.forEach\(o => lt\.sh\.getRange\(o\.replace \+ 2, 1, 1, o\.row\.length\)\.setValues\(\[o\.row\]\)\);/);
  assert.match(code, /again\.forEach\(o => \{ if \(!done\[o\.id\]\) \{ done\[o\.id\] = true; recalcChain_\(o\.id\); \} \}\);/);
});

test('update-144: a shift of a machinery on hours whose rows are ALL by Time is one entry by Time – each row its own work and From – To; two rows at the same time refused; bill, diesel as one entry', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  run('(x, m) => saveVendor_(x, m)', { name: 'R144 Earthmovers', gstReg: 'No', pan: 'ABCDE1244R', bank: 'SBI', account: '12345144', ifsc: 'SBIN0000001' }, 'add');
  // his JCB (23-10-2026): on hours (an hour meter), its BOQ Item-wise BUCKET 1,200 / hr ("rest of the entry") and BREAKER 1,700 / hr ("typed")
  const NOS = ['R144-A', 'R144-B', 'R144-C', 'R144-N'];
  NOS.forEach(no => run('(x, m) => saveMaster_(x, m)', { no: no, name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs', 'Time'], hrStd: 5, owner: 'R144 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R144 Earthmovers', from: '2026-09-01', tdsPct: 2, woNo: 'WO-R144', lines: NOS.map(no => ({ no: no, basis: 'Item-wise', diesel: 'Company', items: [
    { name: 'BUCKET', basis: 'Per Hour', rate: 1200, qty: 'rest' }, { name: 'BREAKER', basis: 'Per Hour', rate: 1700, qty: 'typed' }] })) });
  const save = rows => run('x => { try { return saveLogRowsInner_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: rows });
  const no = (x, re) => assert.ok(x.ok === false && x.errors.some(e => re.test(e.msg)), JSON.stringify(x).slice(0, 500));
  const stored = n => run(`no => { const lt = table_(APP.SHEET_LOG), c = lt.c, g = (x, h) => h in c ? x[c[h]] : ''; return lt.rows.filter(x => str_(x[c[H.NO]]) === no).map(x => ({ d: dkey_(x[c[H.DATE]]), sh: str_(x[c[H.SHIFT]]), unit: str_(x[c[H.UNIT]]), ohr: numOrBlank_(x[c[H.OHR]]), chr: numOrBlank_(x[c[H.CHR]]), whr: numOrBlank_(x[c[H.WHR]]), tot: numOrBlank_(x[c[H.TOT]]), stock: numOrBlank_(x[c[H.STOCK]]), ts: tStr_(g(x, H.TSTART)), te: tStr_(g(x, H.TEND)), tb: numOrBlank_(g(x, H.TBRK)), th: numOrBlank_(g(x, H.THRS)), slots: str_(g(x, H.TSLOTS)), items: str_(x[c[H.ITEMS]]), work: str_(x[c[H.WORK]]), chf: str_(x[c[H.CHFROM]]), cht: str_(x[c[H.CHTO]]) })).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0); }`, n);
  const E = (n, o) => Object.assign({ date: '2026-09-28', shift: 'Day', no: n, mode: 'Time' }, o);
  const amount = n => run('(no, f, t) => billMachineCalc_(findMachine_(no), getLogBookList_({ from: f, to: t, no: no, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [no] }), f, t, undefined, true).amount', n, '2026-09-28', '2026-09-28');
  // 27-09: the first entries, by the hour meter (opening diesel 100)
  assert.ok(save(NOS.map(n => ({ date: '2026-09-27', shift: 'Day', no: n, mode: 'Hrs', openingHr: 1000, closingHr: 1008, openingDiesel: 100 }))).ok);
  // HIS SCREEN – A in two saves: Bucket 14:00 – 18:00 saved; then Breaker 09:00 – 13:00 of the same Day (before: "the rows of this shift are all by Time")
  let r = save([E('R144-A', { tStart: '14:00', tEnd: '18:00', items: { _all: 'BUCKET' }, work: 'LOADING' })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  let p = run('(n, d, s, o) => getLogRowPrefill_(n, d, s, o)', 'R144-A', '2026-09-28', 'Day', { add: 1 });
  assert.deepStrictEqual([p.problem, p.addTo.kind, p.addTo.mode, p.addTo.lastWork, p.lastMode], ['', 'hr', 'Time', 'BUCKET', 'Time']);
  r = save([E('R144-A', { tStart: '09:00', tEnd: '13:00', items: { _all: 'BREAKER' }, work: 'BREAKING', add: 1 })]);
  assert.ok(r.ok && r.added === 1 && r.into === 1, JSON.stringify(r).slice(0, 300));
  const a = stored('R144-A')[1];
  assert.deepStrictEqual([a.unit, a.ohr, a.chr, a.ts, a.te, a.tb, a.th, a.whr, a.slots, a.tot], ['Time', '', '', '09:00', '18:00', 60, 8, 8, '09:00-13:00,14:00-18:00', 40], 'ONE entry by Time: 09–13 + 14–18 = 8 h (the hour between not worked), diesel 8 × 5 = 40 L');
  assert.deepStrictEqual(JSON.parse(a.items), { BREAKER: 4, _parts: [{ n: 'BREAKER', q: 4, m: 'T', ts: '09:00-13:00', w: 'BREAKING' }, { n: 'BUCKET', q: 4, m: 'T', ts: '14:00-18:00', w: 'LOADING' }] }, 'its rows in the order of the day');
  assert.strictEqual(amount('R144-A'), 4 * 1200 + 4 * 1700, 'Bucket 4 hr × 1,200 + Breaker 4 hr × 1,700');
  // B: the same two rows in ONE save (as his screen: the Bucket row above) – the same entry
  r = save([E('R144-B', { tStart: '14:00', tEnd: '18:00', items: { _all: 'BUCKET' }, work: 'LOADING' }), E('R144-B', { tStart: '09:00', tEnd: '13:00', items: { _all: 'BREAKER' }, work: 'BREAKING' })]);
  assert.ok(r.ok && r.joined === 2 && r.count === 1, JSON.stringify(r).slice(0, 300));
  const b = stored('R144-B')[1], same = x => Object.assign({}, x, { work: '' });
  assert.deepStrictEqual(same(b), same(a), 'two saves = one save');
  assert.strictEqual(amount('R144-B'), 4 * 1200 + 4 * 1700);
  // C: Edit Log Book sends the shift as the page does (mode Time, the rows' times in order, a row each)
  const bulk = (rows) => tryRun('p => saveLogBulk_(p)', { no: 'R144-C', from: '2026-09-28', to: '2026-09-28', deleted: [], openingDiesel: '', rows: rows });
  const C = o => Object.assign({ key: '', same: false, half: false, date: '2026-09-28', shift: 'Day', mode: 'Time', openingHr: '', closingHr: '', openingKm: '', closingKm: '', tStart: '09:00', tEnd: '18:00', tBreak: '',
    tSlots: [['09:00', '13:00'], ['14:00', '18:00']], remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: 'BREAKING / LOADING',
    items: { _parts: [{ n: 'BREAKER', q: 4, c: '', p: '', f: '', t: '', w: 'BREAKING', m: 'T', ts: '09:00-13:00', tb: 0 }, { n: 'BUCKET', q: 4, c: '', p: '', f: '', t: '', w: 'LOADING', m: 'T', ts: '14:00-18:00', tb: 0 }] } }, o);
  // (parts whose times are not the entry's times: refused, nothing saved)
  let x = bulk([C({ tEnd: '17:00', tSlots: [['09:00', '13:00'], ['14:00', '17:00']] })]);
  assert.ok(x.ok === false && /the rows of this shift by Time \(09:00-13:00, 14:00-18:00\) are not the From – To of the entry \(09:00-13:00, 14:00-17:00\)/.test(JSON.stringify(x)), JSON.stringify(x).slice(0, 400));
  assert.strictEqual(stored('R144-C').length, 1);
  x = bulk([C()]); assert.ok(x.ok && x.added === 1, JSON.stringify(x).slice(0, 300));
  const c = stored('R144-C')[1];
  assert.deepStrictEqual([c.unit, c.whr, c.slots, c.tb, c.tot, JSON.parse(c.items)], [a.unit, a.whr, a.slots, a.tb, a.tot, JSON.parse(a.items)], 'Edit Log Book = the entry page');
  const ed = run('() => getLogEditData_("R144-A", "2026-09-28", "2026-09-28")');
  assert.deepStrictEqual(ed.rows[0].itemParts.map(q => q.n + ' ' + q.ts + ' ' + q.q), ['BREAKER 09:00-13:00 4', 'BUCKET 14:00-18:00 4'], 'Edit Log Book shows the two rows');
  // two rows at the same time: refused – in one save, and against the saved entry (update-143: the same work twice)
  no(save([E('R144-N', { tStart: '09:00', tEnd: '13:00', items: { _all: 'BUCKET' } }), E('R144-N', { tStart: '12:00', tEnd: '15:00', items: { _all: 'BREAKER' } })]),
    /R144-N \(28-09-2026, Day\): row 2 of 28-09-2026 \(12:00 – 15:00\) is at the same time as row 1 of 28-09-2026 \(09:00 – 13:00\) – a machinery does one work at a time/);
  no(save([E('R144-A', { tStart: '17:00', tEnd: '19:00', items: { _all: 'BUCKET' }, add: 1 })]), /this work is already in the saved entry of this shift/);
  assert.strictEqual(stored('R144-N').length, 1, 'nothing saved');
  // a third work the same evening: 18:30 – 20:00 Breaker → 9.5 h, three rows in order
  r = save([E('R144-A', { tStart: '18:30', tEnd: '20:00', items: { _all: 'BREAKER' }, work: 'BREAKING 2', add: 1 })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  const a3 = stored('R144-A')[1];
  assert.deepStrictEqual([a3.whr, a3.slots, a3.tb, JSON.parse(a3.items).BREAKER, JSON.parse(a3.items)._parts.map(q => q.n)], [9.5, '09:00-13:00,14:00-18:00,18:30-20:00', 90, 5.5, ['BREAKER', 'BUCKET', 'BREAKER']]);
  assert.strictEqual(amount('R144-A'), 4 * 1200 + 5.5 * 1700);
  // a NIGHT past midnight: 01:00 – 04:00 and 20:00 – 23:00 → in the order of the night, 6 h
  r = save([E('R144-N', { shift: 'Night', tStart: '01:00', tEnd: '04:00', items: { _all: 'BREAKER' } }), E('R144-N', { shift: 'Night', tStart: '20:00', tEnd: '23:00', items: { _all: 'BUCKET' } })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  const n = stored('R144-N').find(q => q.sh === 'Night');
  assert.deepStrictEqual([n.unit, n.whr, n.slots, n.ts, n.te, JSON.parse(n.items)._parts.map(q => q.n)], ['Time', 6, '20:00-23:00,01:00-04:00', '20:00', '04:00', ['BUCKET', 'BREAKER']]);
  // the next day by Hrs starts at the last hour reading (an entry by Time reads no meter)
  assert.strictEqual(run('(n, d, s) => getLogRowPrefill_(n, d, s)', 'R144-A', '2026-09-29', 'Day').openingHr, 1008);
  // the edit window: its From – To are its rows' times – changed row by row in Edit Log Book; the same times stay accepted
  const key = (nn, d) => run('(n, d) => { const lt = table_(APP.SHEET_LOG), c = lt.c, r = lt.rows.find(x => str_(x[c[H.NO]]) === n && dkey_(x[c[H.DATE]]) === d); return logKeyOf_(lt, r); }', nn, d);
  const k = key('R144-B', '2026-09-28'), wb = stored('R144-B')[1].work;
  assert.match(tryRun('(k, l) => updateLogRow_(k, l)', k, { tStart: '08:00', tEnd: '18:00', tBreak: 0, tSlots: [['08:00', '13:00'], ['14:00', '18:00']], work: wb, chFrom: '', chTo: '' }).thrown || '', /R144-B \(28-09-2026\) has rows in this shift that are kept row by row .* change its From – To in Edit Log Book/);
  const ok2 = tryRun('(k, l) => updateLogRow_(k, l)', k, { tStart: '09:00', tEnd: '18:00', tBreak: 0, tSlots: [['09:00', '13:00'], ['14:00', '18:00']], work: wb, chFrom: '', chTo: '' });
  assert.ok(!(ok2 && ok2.thrown), JSON.stringify(ok2).slice(0, 300));
  assert.deepStrictEqual(same(stored('R144-B')[1]), same(b), 'nothing changed');
  // the Excel import: such an entry is changed in Edit Log Book, not by a file
  assert.match(JSON.stringify(tryRun('x => importLogBook_(x)', { check: true, rows: [{ line: 2, date: '2026-09-28', shift: 'Day', no: 'R144-B', mode: 'Time', work: 'OTHER WORK' }] })), /kept row by row .* not by Excel/);
  // (review 23-10-2026) 1) times whose hours are rounded: 09:00 – 11:20 + 13:00 – 15:20 = 4 h 40 = 4.67 h (each row 2.33) – saved, in one save and added
  const D30 = o => E(o.no, Object.assign({ date: '2026-09-30' }, o));
  r = save([D30({ no: 'R144-N', tStart: '09:00', tEnd: '11:20', items: { _all: 'BUCKET' } }), D30({ no: 'R144-N', tStart: '13:00', tEnd: '15:20', items: { _all: 'BREAKER' } })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  r = save([D30({ no: 'R144-A', tStart: '09:00', tEnd: '11:20', items: { _all: 'BUCKET' } })]); assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  r = save([D30({ no: 'R144-A', tStart: '13:00', tEnd: '15:20', items: { _all: 'BREAKER' }, add: 1 })]); assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  const rn = stored('R144-N').find(q => q.d === '2026-09-30'), ra = stored('R144-A').find(q => q.d === '2026-09-30');
  assert.deepStrictEqual([rn.whr, rn.slots, JSON.parse(rn.items).BREAKER, JSON.parse(rn.items)._parts.map(q => q.q)], [4.67, '09:00-11:20,13:00-15:20', 2.33, [2.33, 2.33]]);
  assert.deepStrictEqual([ra.whr, ra.slots, ra.items], [rn.whr, rn.slots, rn.items], 'added = one save');
  assert.strictEqual(run('() => getLogEditData_("R144-N", "2026-09-30", "2026-09-30")').rows[0].itemParts.length, 2, 'its rows are read back (not dropped for the rounding)');
  // 2) a saved entry with "+ time" (09:00 – 11:00 and 14:00 – 16:00) takes a work 12:00 – 13:00 between its times
  r = save([D30({ no: 'R144-C', tStart: '09:00', tEnd: '16:00', tSlots: [['09:00', '11:00'], ['14:00', '16:00']], items: { _all: 'BUCKET' } })]); assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  r = save([D30({ no: 'R144-C', tStart: '12:00', tEnd: '13:00', items: { _all: 'BREAKER' }, add: 1 })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  const rc = stored('R144-C').find(q => q.d === '2026-09-30');
  assert.deepStrictEqual([rc.whr, rc.slots, rc.tb, JSON.parse(rc.items)._parts.map(q => q.n + ' ' + q.ts)], [5, '09:00-11:00,12:00-13:00,14:00-16:00', 120, ['BUCKET 09:00-11:00,14:00-16:00', 'BREAKER 12:00-13:00']]);
  // 3) the entry's chainage and work in the order of the day (the Bucket row typed first, 14:00 – 18:00)
  r = save([D30({ no: 'R144-B', tStart: '14:00', tEnd: '18:00', items: { _all: 'BUCKET' }, chFrom: '10+000', chTo: '10+500', work: 'LOADING' }), D30({ no: 'R144-B', tStart: '09:00', tEnd: '13:00', items: { _all: 'BREAKER' }, chFrom: '9+000', chTo: '9+500', work: 'BREAKING' })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  const rb = stored('R144-B').find(q => q.d === '2026-09-30');
  assert.deepStrictEqual([rb.chf, rb.cht, rb.work], ['9+000', '10+500', 'BREAKING / LOADING']);
  // 4) Edit Log Book: a break on the rows that is not the entry's break – refused
  x = bulk([C({ date: '2026-10-01', items: { _parts: [{ n: 'BREAKER', q: 3.5, m: 'T', ts: '09:00-13:00', tb: 30 }, { n: 'BUCKET', q: 4, m: 'T', ts: '14:00-18:00', tb: 0 }] } })]);
  assert.ok(x.ok === false && /are not the From – To of the entry/.test(JSON.stringify(x)), JSON.stringify(x).slice(0, 400));
  // (23-10-2026, his screen of MH-46-B-0651 – a Hydra on Time only, no hour meter: "sagle machinery la ha rule ghe") EVERY machinery:
  // 10:00 – 18:00 (13:00 – 14:00 off) HYDRA and 19:00 – 22:00 FARANA the same Day – ONE entry by Time, 10 h; the same in Edit Log Book and added
  run('(x, m) => saveMaster_(x, m)', { no: 'R144-HT', name: 'Hydra', type: 'Hydra', unit: 'Time', worksOn: ['Time'], hrStd: 3, owner: 'R144 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'R144-HU', name: 'Hydra', type: 'Hydra', unit: 'Time', worksOn: ['Time'], hrStd: 3, owner: 'R144 Earthmovers', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R144 Earthmovers', from: '2026-09-01', tdsPct: 2, woNo: 'WO-R144H', lines: ['R144-HT', 'R144-HU'].map(no => ({ no: no, basis: 'Item-wise', diesel: 'Company', items: [
    { name: 'HYDRA', basis: 'Per Hour', rate: 1700, qty: 'rest' }, { name: 'FARANA', basis: 'Per Hour', rate: 2200, qty: 'typed' }] })) });
  const H1 = (no, o) => Object.assign({ date: '2026-09-01', shift: 'Day', no: no, mode: 'Time' }, o);
  r = save([H1('R144-HT', { tStart: '10:00', tEnd: '18:00', tSlots: [['10:00', '13:00'], ['14:00', '18:00']], items: { _all: 'HYDRA' }, work: 'LIFTING' }), H1('R144-HT', { tStart: '19:00', tEnd: '22:00', items: { _all: 'FARANA' }, work: 'PICK AND CARRY' })]);
  assert.ok(r.ok && r.joined === 2 && r.count === 1, JSON.stringify(r).slice(0, 300));
  const ht = stored('R144-HT')[0];
  assert.deepStrictEqual([ht.unit, ht.whr, ht.slots, ht.tb, JSON.parse(ht.items)], ['Time', 10, '10:00-13:00,14:00-18:00,19:00-22:00', 120,
    { FARANA: 3, _parts: [{ n: 'HYDRA', q: 7, m: 'T', ts: '10:00-13:00,14:00-18:00', w: 'LIFTING' }, { n: 'FARANA', q: 3, m: 'T', ts: '19:00-22:00', w: 'PICK AND CARRY' }] }]);
  assert.strictEqual(run('(no, f, t) => billMachineCalc_(findMachine_(no), getLogBookList_({ from: f, to: t, no: no, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [no] }), f, t, undefined, true).amount', 'R144-HT', '2026-09-01', '2026-09-01'), 7 * 1700 + 3 * 2200);
  r = save([H1('R144-HU', { tStart: '10:00', tEnd: '18:00', tSlots: [['10:00', '13:00'], ['14:00', '18:00']], items: { _all: 'HYDRA' }, work: 'LIFTING' })]); assert.ok(r.ok);
  let hp = run('(n, d, s, o) => getLogRowPrefill_(n, d, s, o)', 'R144-HU', '2026-09-01', 'Day', { add: 1 });
  assert.deepStrictEqual([hp.problem, hp.addTo && hp.addTo.mode, hp.addTo && hp.addTo.sameOk], ['', 'Time', true], 'a Time-only machinery: the saved Day takes another work (the same work at another time too)');
  r = save([H1('R144-HU', { tStart: '19:00', tEnd: '22:00', items: { _all: 'FARANA' }, work: 'PICK AND CARRY', add: 1 })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(Object.assign({}, stored('R144-HU')[0], { work: '' }), Object.assign({}, ht, { work: '' }), 'added = one save');
  no(save([H1('R144-HU', { tStart: '21:00', tEnd: '23:00', items: { _all: 'HYDRA' }, add: 1 })]), /this work is already in the saved entry of this shift/);
  no(save([H1('R144-HU', { date: '2026-09-02', tStart: '09:00', tEnd: '12:00', items: { _all: 'HYDRA' } }), H1('R144-HU', { date: '2026-09-02', tStart: '11:00', tEnd: '13:00', items: { _all: 'FARANA' } })]), /is at the same time as row 1/);
  // a machinery on hours keeps its rule for rows by Hrs and by Time together (update-78) – unchanged
  r = save([E('R144-C', { date: '2026-09-29', tStart: '09:00', tEnd: '11:00', items: { _all: 'BUCKET' } }), E('R144-C', { date: '2026-09-29', mode: 'Hrs', openingHr: 1008, closingHr: 1011, items: { _all: 'BREAKER' } })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual((s => [s.unit, s.ohr, s.chr, s.whr])(stored('R144-C')[2]), ['Hrs', 1008, 1011, 5]);
});

test('update-145: two people changing the same entry – a Log Book or Diesel Issue entry changed by someone else after it was opened is not overwritten (the edit window, Edit Log Book, deletes)', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  run('(x, m) => saveVendor_(x, m)', { name: 'R145 Transport', gstReg: 'No', pan: 'ABCDE1245R', bank: 'SBI', account: '12345145', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'R145-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'R145 Transport', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  run('x => saveInward_(x)', { date: '2026-06-01', location: 'Dispenser', pump: 'Pump', qty: 2000, rate: 90, billNo: 'R145', billDate: '2026-06-01' });
  const save = rows => run('x => { try { return saveLogRowsInner_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: rows });
  const L = (d, o) => Object.assign({ date: d, shift: 'Full Day', no: 'R145-TIP', mode: 'KM' }, o);
  assert.ok(save([L('2026-06-01', { openingKm: 1000, closingKm: 1100, openingDiesel: 50 }), L('2026-06-02', { closingKm: 1180 }), L('2026-06-03', { closingKm: 1250 })]).ok);
  const K = d => 'R145-TIP|' + d + '|Full Day', entry = d => run('k => getLogEntry_(k)', K(d)), NOW = /was changed by .* after you opened it – open it again and make your change there\. Nothing was saved\./;
  // the edit window: opened by two people; the first saves; the second's save (with what he opened) is refused – nothing overwritten
  const a = entry('2026-06-02'), b = entry('2026-06-02');
  assert.ok(a.ver && a.ver === b.ver, 'the same entry: the same version');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-02'), { closingKm: 1180, work: 'CARTING A', chFrom: '', chTo: '', ver: a.ver }).thrown, 'the first one saves');
  let x = tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-02'), { closingKm: 1180, work: 'CARTING B', chFrom: '', chTo: '', ver: b.ver });
  assert.match(x.thrown || '', /^R145-TIP \(02-06-2026, Full Day\) was changed by/); assert.match(x.thrown, NOW);
  assert.strictEqual(entry('2026-06-02').work, 'CARTING A', 'his change stays');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-02'), { closingKm: 1180, work: 'CARTING A', chFrom: '', chTo: '' }).thrown, 'an older page or app (no version): taken as before');
  // what the app works out by itself (a diesel issue of that day changes the diesel and the tank) does not stop a save
  const c = entry('2026-06-02');
  run('x => saveDieselIssue_(x)', { date: '2026-06-02', shift: 'Day', source: 'Dispenser', no: 'R145-TIP', qty: 40, kmReading: 1120, force: true });
  assert.notStrictEqual(entry('2026-06-02').qty, c.qty, 'its diesel changed');
  assert.strictEqual(entry('2026-06-02').ver, c.ver, '… its version did not');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-02'), { closingKm: 1180, work: 'CARTING C', chFrom: '', chTo: '', ver: c.ver }).thrown);
  // a KM vehicle: a Close of the 2nd moves the Start of the 3rd – the 3rd opened before that is not saved over it
  const d3 = entry('2026-06-03');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-02'), { closingKm: 1190, work: 'CARTING C', chFrom: '', chTo: '', ver: entry('2026-06-02').ver }).thrown);
  assert.strictEqual(entry('2026-06-03').okm, 1190, 'the 3rd starts at the new Close');
  assert.match(tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-03'), { openingKm: 1180, closingKm: 1250, work: 'X', chFrom: '', chTo: '', ver: d3.ver }).thrown || '', NOW);
  assert.strictEqual(entry('2026-06-03').okm, 1190, 'not put back to 1180');
  // a delete with what was opened
  const d1 = entry('2026-06-01');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-01'), { closingKm: 1100, work: 'FIRST', chFrom: '', chTo: '', ver: d1.ver }).thrown);
  assert.match(tryRun('(k, v) => deleteLogRow_(k, v)', K('2026-06-01'), d1.ver).thrown || '', NOW);
  assert.ok(entry('2026-06-01'), 'not deleted');
  // Edit Log Book: the grid sends every entry with its version – one changed since: nothing saved
  const g = run('() => getLogEditData_("R145-TIP", "2026-06-01", "2026-06-03")');
  assert.ok(g.rows.every(r => r.ver), 'each row has its version');
  const vers = {}; g.rows.forEach(r => { vers[r.key] = r.ver; });
  const R = r => ({ key: r.key, same: false, half: false, date: r.date, shift: r.shift, mode: 'KM', openingKm: r.okm, closingKm: r.ckm, openingHr: '', closingHr: '', tStart: '', tEnd: '', tBreak: '', remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: r.work });
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-03'), { closingKm: 1260, work: 'SOMEONE ELSE', chFrom: '', chTo: '', ver: entry('2026-06-03').ver }).thrown, 'someone else changes the 3rd meanwhile');
  x = tryRun('p => saveLogBulk_(p)', { no: 'R145-TIP', from: '2026-06-01', to: '2026-06-03', deleted: [], openingDiesel: '', vers: vers, rows: g.rows.map(R) });
  assert.ok(x.ok === false && x.errors.some(e => /R145-TIP \(03-06-2026, Full Day\) was changed by .* after you opened it/.test(e.msg)), JSON.stringify(x).slice(0, 400));
  assert.strictEqual(entry('2026-06-03').ckm, 1260, 'his 1260 stays (the grid had 1250)');
  const g2 = run('() => getLogEditData_("R145-TIP", "2026-06-01", "2026-06-03")'), vers2 = {}; g2.rows.forEach(r => { vers2[r.key] = r.ver; });
  x = tryRun('p => saveLogBulk_(p)', { no: 'R145-TIP', from: '2026-06-01', to: '2026-06-03', deleted: [], openingDiesel: '', vers: vers2, rows: g2.rows.map(R) });
  assert.ok(x.ok, JSON.stringify(x).slice(0, 300));
  // DIESEL ISSUE: the list's rows carry their version; a change / a delete with an old one is refused
  const issues = () => run('() => getDieselIssues_({ from: "2026-06-02", to: "2026-06-02", all: true })').rows.filter(r => r.no === 'R145-TIP');
  const i0 = issues()[0]; assert.ok(i0 && i0.ver);
  const D = o => Object.assign({ date: '2026-06-02', shift: 'Day', source: 'Dispenser', no: 'R145-TIP', qty: 40, kmReading: 1120, force: true }, o);
  assert.ok(run('(id, x) => updateDieselIssue_(id, x)', i0.id, D({ qty: 45, ver: i0.ver })).ok);
  assert.match(tryRun('(id, x) => updateDieselIssue_(id, x)', i0.id, D({ qty: 50, ver: i0.ver })).thrown || '', new RegExp('^Diesel issue ' + i0.id + ' \\(R145-TIP, 02-06-2026\\) was changed by .* after you opened it'));
  assert.strictEqual(issues()[0].qty, 45, 'his 45 stays');
  assert.match(tryRun('(id, v) => deleteDieselIssue_(id, v)', i0.id, i0.ver).thrown || '', NOW);
  assert.ok(run('(id, v) => deleteDieselIssue_(id, v)', i0.id, issues()[0].ver).ok, 'with the version it has now: deleted');
  // the version reads a value the same however it was read (JSON with its keys in another order – the database reorders them)
  assert.strictEqual(run('() => verVal_(H.ITEMS, \'{"_parts":[{"n":"A","q":2}],"B":1}\') === verVal_(H.ITEMS, \'{"B":1,"_parts":[{"q":2,"n":"A"}]}\')'), true);
  assert.strictEqual(run('() => verVal_(H.OKM, "100.50") === verVal_(H.OKM, 100.5)'), true);
  // (review) an update returns the version the entry has now (the page keeps it – a delete right after it is not refused)
  const i1 = run('x => saveDieselIssue_(x)', D({ qty: 30 })), i1v = issues().find(r => r.id === i1.id).ver;
  const up = run('(id, x) => updateDieselIssue_(id, x)', i1.id, D({ qty: 31, ver: i1v }));
  assert.ok(up.ok && up.ver && up.ver === issues().find(r => r.id === i1.id).ver, JSON.stringify(up));
  // (review) an entry whose Start followed someone's change carries his name – the refusal names him, not the one refused
  run('() => { ACTOR_ = "Ravi"; }');
  const e3 = entry('2026-06-03');
  run('() => { ACTOR_ = "Shyam"; }');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-02'), { closingKm: 1200, work: 'BY SHYAM', chFrom: '', chTo: '', ver: entry('2026-06-02').ver }).thrown);
  assert.strictEqual(entry('2026-06-03').okm, 1200);
  run('() => { ACTOR_ = "Ravi"; }');
  assert.match(tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-03'), { closingKm: 1260, work: 'BY RAVI', chFrom: '', chTo: '', ver: e3.ver }).thrown || '', /^R145-TIP \(03-06-2026, Full Day\) was changed by Shyam after you opened it/);
  // (review) a request replayed later (approved by the Super Admin, a verification's last approval, "Send again"): the words say what to do there
  const e3b = entry('2026-06-03');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-03'), { closingKm: 1265, work: 'MEANWHILE', chFrom: '', chTo: '', ver: e3b.ver }).thrown);
  [['approve', /after this request was made – reject it: the person who asked makes the change again on the entry as it is now\. Nothing was saved\.$/], ['flow', /after this entry was sent – it goes back to the person who sent it/], ['resend', /after this entry was sent – it cannot be sent again: take it back/]].forEach(([cx, re]) => {
    const t = run('(k, l, cx) => { VER_CTX_ = cx; try { updateLogRow_(k, l); return ""; } catch (e) { return String(e.message); } finally { VER_CTX_ = ""; } }', K('2026-06-03'), { closingKm: 1270, work: 'REQUEST', chFrom: '', chTo: '', ver: e3b.ver }, cx);
    assert.match(t, re, cx); });
  assert.strictEqual(entry('2026-06-03').work, 'MEANWHILE');
  assert.ok(/VER_CTX_ = 'approve';/.test(fs.readFileSync(path.join(__dirname, '..', 'app', 'Code.gs'), 'utf8')) && /VER_CTX_ = 'flow';/.test(fs.readFileSync(path.join(__dirname, '..', 'app', 'Code.gs'), 'utf8')) && /VER_CTX_ = 'resend';/.test(fs.readFileSync(path.join(__dirname, '..', 'app', 'Code.gs'), 'utf8')));
  // (review) Edit Log Book of a user who is not the Super Admin: an entry of a submitted bill is kept out of the save – a change to it meanwhile does not stop the grid
  const g3 = run('() => getLogEditData_("R145-TIP", "2026-06-01", "2026-06-03")'), vers3 = {}; g3.rows.forEach(r => { vers3[r.key] = r.ver; });
  run('() => { ACTOR_SUPER_ = true; }');
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-06-01'), { closingKm: 1100, work: 'BILLED, CHANGED BY THE SUPER ADMIN', chFrom: '', chTo: '', ver: entry('2026-06-01').ver }).thrown);
  run('() => { ACTOR_SUPER_ = false; globalThis.__blo145 = billLockOf_; billLockOf_ = (no, dk) => dk === "2026-06-01" ? { no: "B-145", vendor: "R145 Transport", from: "2026-06-01", to: "2026-06-01" } : null; }');
  try {
    x = tryRun('p => saveLogBulk_(p)', { no: 'R145-TIP', from: '2026-06-01', to: '2026-06-03', deleted: [], openingDiesel: '', vers: vers3, rows: g3.rows.map(r => Object.assign(R(r), { same: true })).map((r, n) => n === 2 ? Object.assign(r, { same: false, work: 'GRID' }) : r) });
    assert.ok(x.ok, JSON.stringify(x).slice(0, 400));
    assert.strictEqual(entry('2026-06-01').work, 'BILLED, CHANGED BY THE SUPER ADMIN', 'the billed entry is not written');
    assert.strictEqual(entry('2026-06-03').work, 'GRID');
  } finally { run('() => { billLockOf_ = globalThis.__blo145; }'); }
});

test('update-146: EVERY machinery – rows of one shift by KM, Hrs, KM + Hrs, trips or the day are ONE entry (its rows kept); the same data is a duplicate; rows that cannot stand together say why', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  run('(x, m) => saveVendor_(x, m)', { name: 'R146 Transport', gstReg: 'No', pan: 'ABCDE1246R', bank: 'SBI', account: '12345146', ifsc: 'SBIN0000001' }, 'add');
  const M = (no, o) => run('(x, m) => saveMaster_(x, m)', Object.assign({ no: no, owner: 'R146 Transport', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, o), 'add');
  M('R146-TIP', { name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4 });
  M('R146-TIP2', { name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4 });
  M('R146-TM', { name: 'Transit Mixer', type: 'Transit Mixer', unit: 'KM + Hrs', worksOn: ['KM', 'Hrs'], kmStd: 3, hrStd: 4 });
  M('R146-LDR', { name: 'Loader', type: 'Loader', unit: 'Hrs', worksOn: ['KM', 'Hrs'], kmStd: 3, hrStd: 5 });
  M('R146-TRP', { name: 'Tipper', type: 'Tipper', unit: 'Trip', worksOn: ['Trip'] });
  M('R146-DAY', { name: 'Grader', type: 'Grader', unit: 'Day', worksOn: ['Day'] });
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R146 Transport', from: '2026-09-01', tdsPct: 2, woNo: 'WO-R146', lines: [
    { no: 'R146-TIP', basis: 'Per KM', rate: 40, diesel: 'Company' },
    { no: 'R146-TIP2', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'LOADED', basis: 'Per KM', rate: 50, qty: 'typed' }, { name: 'EMPTY', basis: 'Per KM', rate: 30, qty: 'rest' }] },
    { no: 'R146-TM', basis: 'Per Hour', rate: 500, diesel: 'Company' }, { no: 'R146-LDR', basis: 'Per Hour', rate: 800, diesel: 'Company' },
    { no: 'R146-TRP', basis: 'Per Trip', rate: 600, nightRate: 600, diesel: 'Company' }, { no: 'R146-DAY', basis: 'Per Day', rate: 3000, diesel: 'Company' }] });
  const save = rows => run('x => { try { return saveLogRowsInner_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: rows });
  const no = (x, re) => assert.ok(x.ok === false && x.errors.some(e => re.test(e.msg)), JSON.stringify(x).slice(0, 500));
  const stored = n => run(`no => { const lt = table_(APP.SHEET_LOG), c = lt.c, g = (x, h) => h in c ? x[c[h]] : ''; return lt.rows.filter(x => str_(x[c[H.NO]]) === no).map(x => ({ d: dkey_(x[c[H.DATE]]), unit: str_(x[c[H.UNIT]]), okm: numOrBlank_(x[c[H.OKM]]), ckm: numOrBlank_(x[c[H.CKM]]), wkm: numOrBlank_(x[c[H.WKM]]), ohr: numOrBlank_(x[c[H.OHR]]), chr: numOrBlank_(x[c[H.CHR]]), whr: numOrBlank_(x[c[H.WHR]]), trip: numOrBlank_(g(x, H.TRIP)), tot: numOrBlank_(x[c[H.TOT]]), ts: tStr_(g(x, H.TSTART)), te: tStr_(g(x, H.TEND)), items: str_(g(x, H.ITEMS)), work: str_(x[c[H.WORK]]), challan: str_(g(x, H.CHALLAN)), chFrom: str_(g(x, H.CHFROM)), chTo: str_(g(x, H.CHTO)) })).sort((a, b) => a.d < b.d ? -1 : 1); }`, n);
  const on = (n, d) => stored(n).find(x => x.d === d), parts = (n, d) => { const x = on(n, d); return x && x.items ? JSON.parse(x.items)._parts : null; };
  const amount = (n, f, t) => run('(no, f, t) => billMachineCalc_(findMachine_(no), getLogBookList_({ from: f, to: t, no: no, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [no] }), f, t, undefined, true).amount', n, f, t || f);
  const E = (n, d, o) => Object.assign({ date: d, shift: 'Full Day', no: n }, o);
  // ---- A TIPPER ON KM (one work in its BOQ – before: the second row of a shift was "already saved"): two works of one day = ONE entry ----
  assert.ok(save([E('R146-TIP', '2026-09-01', { mode: 'KM', openingKm: 1000, closingKm: 1100, openingDiesel: 100 })]).ok);
  let r = save([E('R146-TIP', '2026-09-02', { mode: 'KM', closingKm: 1150, challan: 'C1', work: 'LOADING', chFrom: '10+000' }), E('R146-TIP', '2026-09-02', { mode: 'KM', closingKm: 1220, challan: 'C2', work: 'CARTING', chTo: '12+000' })]);
  assert.ok(r.ok && r.count === 1 && r.joined === 2, JSON.stringify(r).slice(0, 300));
  let x = on('R146-TIP', '2026-09-02');
  assert.deepStrictEqual([x.unit, x.okm, x.ckm, x.wkm, x.tot, x.work, x.challan, x.chFrom, x.chTo], ['KM', 1100, 1220, 120, 30, 'LOADING / CARTING', 'C1 / C2', '10+000', '12+000']);
  assert.deepStrictEqual(parts('R146-TIP', '2026-09-02'), [{ n: '', q: 50, k: 'km', c: 'C1', f: '10+000', w: 'LOADING' }, { n: '', q: 70, k: 'km', c: 'C2', t: '12+000', w: 'CARTING' }]);
  assert.strictEqual(amount('R146-TIP', '2026-09-02'), 120 * 40, 'the bill: the day\'s 120 KM × 40');
  const g = run('() => getLogEditData_("R146-TIP", "2026-09-01", "2026-09-30")');
  assert.deepStrictEqual(g.rows[1].itemParts.map(p => [p.k, p.q, p.w].join(' ')), ['km 50 LOADING', 'km 70 CARTING'], 'Edit Log Book reads it back as its two rows');
  // a gap between the rows (a vehicle's KM follow each other) – refused with the way out; the same row twice – a duplicate
  no(save([E('R146-TIP', '2026-09-03', { mode: 'KM', closingKm: 1250 }), E('R146-TIP', '2026-09-03', { mode: 'KM', openingKm: 1280, closingKm: 1300 })]),
    /R146-TIP \(03-09-2026, Full Day\): row 2 of 03-09-2026 starts at 1280 KM but the row before it closed at 1250 – every row must start where the row before it closed \(a vehicle's KM follow each other: the 30 KM between are part of a row – start it at 1250\)\./);
  no(save([E('R146-TIP', '2026-09-03', { mode: 'KM', openingKm: 1220, closingKm: 1250 }), E('R146-TIP', '2026-09-03', { mode: 'KM', openingKm: 1220, closingKm: 1250 })]), /row 2 of 03-09-2026 is the same as row 1 of 03-09-2026 \(the same Start and Close\) – the same work is not saved twice/);
  assert.ok(!on('R146-TIP', '2026-09-03'), 'nothing saved');
  // added to a saved shift (update-143): the prefill offers it; the work after its Close is added; the same work again is a duplicate
  assert.ok(save([E('R146-TIP', '2026-09-03', { mode: 'KM', closingKm: 1250, work: 'A' })]).ok);
  let p = run('(n, d, s, o) => getLogRowPrefill_(n, d, s, o)', 'R146-TIP', '2026-09-03', 'Full Day', { add: 1 });
  assert.deepStrictEqual([p.problem, p.addTo.kind, p.addTo.sameOk, p.openingKm], ['', 'km', true, 1250]);
  no(save([E('R146-TIP', '2026-09-03', { mode: 'KM', openingKm: 1220, closingKm: 1250, add: 1 })]), /this work is already in the saved entry of this shift/);
  r = save([E('R146-TIP', '2026-09-03', { mode: 'KM', closingKm: 1290, work: 'B', add: 1 })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  x = on('R146-TIP', '2026-09-03');
  assert.deepStrictEqual([x.okm, x.ckm, x.wkm, x.work], [1220, 1290, 70, 'A / B']);
  assert.deepStrictEqual(parts('R146-TIP', '2026-09-03').map(q => [q.q, q.k, q.w].join(' ')), ['30 km A', '40 km B']);
  // Edit Log Book's save (the page sends the shift as one entry with its rows): kept; rows that do not add up – refused
  const sv = run('() => getLogEditData_("R146-TIP", "2026-09-03", "2026-09-03")').rows[0];
  const B = (ps, ck) => ({ no: 'R146-TIP', from: '2026-09-03', to: '2026-09-03', deleted: [], openingDiesel: '', rows: [{ key: sv.key, same: false, half: false, date: '2026-09-03', shift: 'Full Day', mode: 'KM', openingKm: 1220, closingKm: ck, openingHr: '', closingHr: '', tStart: '', tEnd: '', tBreak: '', remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: 'A / B', items: { _parts: ps } }] });
  x = tryRun('b => saveLogBulk_(b)', B([{ n: '', q: 30, k: 'km', w: 'A' }, { n: '', q: 40, k: 'km', w: 'B' }], 1290));
  assert.ok(x.ok, JSON.stringify(x).slice(0, 300));
  assert.deepStrictEqual(parts('R146-TIP', '2026-09-03').map(q => q.q), [30, 40]);
  x = tryRun('b => saveLogBulk_(b)', B([{ n: '', q: 30, k: 'km', w: 'A' }, { n: '', q: 40, k: 'km', w: 'B' }], 1300));
  assert.ok(x.ok === false && /the rows of this shift make 70 KM but the entry has 80 KM/.test(JSON.stringify(x)), JSON.stringify(x).slice(0, 300));
  // ---- A TIPPER WITH TWO KM WORKS (LOADED / EMPTY): the same work may come again in a row of its own (before: "both LOADED – make them one row") ----
  r = save([E('R146-TIP2', '2026-09-01', { mode: 'KM', openingKm: 1000, closingKm: 1050, openingDiesel: 50, items: { _all: 'LOADED' }, challan: 'L1' }), E('R146-TIP2', '2026-09-01', { mode: 'KM', closingKm: 1080, items: { _all: 'LOADED' }, challan: 'L2' }),
    E('R146-TIP2', '2026-09-01', { mode: 'KM', closingKm: 1100, items: {} })]);
  assert.ok(r.ok && r.joined === 3, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(parts('R146-TIP2', '2026-09-01').map(q => [q.n, q.q].join(' ')), ['LOADED 50', 'LOADED 30', 'EMPTY 20']);
  assert.strictEqual(amount('R146-TIP2', '2026-09-01'), 80 * 50 + 20 * 30);
  // ---- A TRANSIT MIXER READ IN KM + Hrs: each row keeps both meters (o: its hours) ----
  r = save([E('R146-TM', '2026-09-01', { mode: 'KM + Hrs', openingKm: 5000, closingKm: 5010, openingHr: 100, closingHr: 103, openingDiesel: 50, work: 'POUR 1' }), E('R146-TM', '2026-09-01', { mode: 'KM + Hrs', closingKm: 5030, closingHr: 107, work: 'POUR 2' })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  x = on('R146-TM', '2026-09-01');
  assert.deepStrictEqual([x.okm, x.ckm, x.wkm, x.ohr, x.chr, x.whr, x.tot], [5000, 5030, 30, 100, 107, 7, 10 + 28]);
  assert.deepStrictEqual(parts('R146-TM', '2026-09-01'), [{ n: '', q: 10, k: 'km', o: 3, w: 'POUR 1' }, { n: '', q: 20, k: 'km', o: 4, w: 'POUR 2' }]);
  assert.strictEqual(amount('R146-TM', '2026-09-01'), 7 * 500);
  const back = run('(no, d) => { const lt = table_(APP.SHEET_LOG, logHeaders_()); return logEntryRows_(lt, logSavedIdx_(lt, no, d, "Full Day"), findMachine_(no)); }', 'R146-TM', '2026-09-01');
  assert.deepStrictEqual(back.rows.map(y => [y.openingKm, y.closingKm, y.openingHr, y.closingHr].join('-')), ['5000-5010-100-103', '5010-5030-103-107'], 'read back as its rows, each with its own hours');
  assert.deepStrictEqual(run('() => getLogEditData_("R146-TM", "2026-09-01", "2026-09-01")').rows[0].itemParts.map(q => q.o), [3, 4]);
  no(save([E('R146-TM', '2026-09-02', { mode: 'KM + Hrs', closingKm: 5040, closingHr: 109 }), E('R146-TM', '2026-09-02', { mode: 'KM + Hrs', closingKm: 5050, openingHr: 110, closingHr: 112 })]), /row 2 of 02-09-2026 starts at 110 Hrs but the row before it closed at 109 Hrs – every row must start where the row before it closed/);
  // ---- A LOADER WITH A KM METER, BY Hrs (not "on hours only"): its rows follow each other ----
  r = save([E('R146-LDR', '2026-09-01', { mode: 'Hrs', openingHr: 300, closingHr: 304, openingDiesel: 40, work: 'A' }), E('R146-LDR', '2026-09-01', { mode: 'Hrs', closingHr: 306, work: 'B' })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual([on('R146-LDR', '2026-09-01').whr, parts('R146-LDR', '2026-09-01').map(q => q.q)], [6, [4, 2]]);
  no(save([E('R146-LDR', '2026-09-02', { mode: 'Hrs', closingHr: 307 }), E('R146-LDR', '2026-09-02', { mode: 'Hrs', openingHr: 308, closingHr: 309 })]), /starts at 308 Hrs but the row before it closed at 307 – every row must start where the row before it closed \(the 1 Hrs between are part of a row – start it at 307\)/);
  // rows measured in different ways / a day without work beside a work: why, not "already saved"
  no(save([E('R146-LDR', '2026-09-03', { mode: 'KM', openingKm: 10, closingKm: 20 }), E('R146-LDR', '2026-09-03', { mode: 'Hrs', closingHr: 310 })]), /R146-LDR \(03-09-2026, Full Day\): the rows of one shift must be measured the same way \(row 1 by KM, row 2 by Hrs\)/);
  no(save([E('R146-TIP', '2026-09-05', { mode: 'Idle' }), E('R146-TIP', '2026-09-05', { mode: 'KM', closingKm: 1300 })]), /R146-TIP \(05-09-2026, Full Day\): Idle is the whole shift – it cannot be one of two rows of the same shift/);
  // ---- A TIPPER BY TRIPS: the trips of each row are added; each row its own challan and work ----
  r = save([E('R146-TRP', '2026-09-01', { mode: 'Trip', trip: 5, challan: 'T1', work: 'SOIL', openingDiesel: 30 }), E('R146-TRP', '2026-09-01', { mode: 'Trip', trip: 3, challan: 'T2', work: 'MURUM' })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  x = on('R146-TRP', '2026-09-01');
  assert.deepStrictEqual([x.unit, x.trip, x.work, x.challan], ['Trip', 8, 'SOIL / MURUM', 'T1 / T2']);
  assert.deepStrictEqual(parts('R146-TRP', '2026-09-01'), [{ n: '', q: 5, k: 'trip', c: 'T1', w: 'SOIL' }, { n: '', q: 3, k: 'trip', c: 'T2', w: 'MURUM' }]);
  assert.strictEqual(amount('R146-TRP', '2026-09-01'), 8 * 600);
  no(save([E('R146-TRP', '2026-09-02', { mode: 'Trip', trip: 5, challan: 'T1', work: 'SOIL' }), E('R146-TRP', '2026-09-02', { mode: 'Trip', trip: 5, challan: 'T1', work: 'SOIL' })]), /row 2 of 02-09-2026 is the same as row 1 \(the same trips, challan, chainage and work\) – the same work is not saved twice/);
  no(save([E('R146-TRP', '2026-09-02', { mode: 'Trip', trip: 5, work: 'SOIL' }), E('R146-TRP', '2026-09-02', { mode: 'Trip', trip: '', work: 'SAND' })]), /enter the number of trips/);
  p = run('(n, d, s, o) => getLogRowPrefill_(n, d, s, o)', 'R146-TRP', '2026-09-01', 'Full Day', { add: 1 });
  assert.deepStrictEqual([p.problem, p.addTo.kind], ['', 'trip']);
  no(save([E('R146-TRP', '2026-09-01', { mode: 'Trip', trip: 5, challan: 'T1', work: 'SOIL', add: 1 })]), /this work is already in the saved entry of this shift/);
  r = save([E('R146-TRP', '2026-09-01', { mode: 'Trip', trip: 2, challan: 'T3', work: 'SAND', add: 1 })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual([on('R146-TRP', '2026-09-01').trip, parts('R146-TRP', '2026-09-01').map(q => q.q)], [10, [5, 3, 2]]);
  assert.strictEqual(amount('R146-TRP', '2026-09-01'), 10 * 600);
  // … with their in / out time: in the order of the day; at the same time – refused
  no(save([E('R146-TRP', '2026-09-03', { mode: 'Trip', trip: 2, tStart: '09:00', tEnd: '11:00', work: 'X' }), E('R146-TRP', '2026-09-03', { mode: 'Trip', trip: 2, tStart: '10:30', tEnd: '12:00', work: 'Y' })]), /row 2 of 03-09-2026 \(10:30 – 12:00\) is at the same time as row 1 of 03-09-2026 \(09:00 – 11:00\)/);
  r = save([E('R146-TRP', '2026-09-03', { mode: 'Trip', trip: 2, tStart: '13:00', tEnd: '15:00', work: 'Y' }), E('R146-TRP', '2026-09-03', { mode: 'Trip', trip: 3, tStart: '09:00', tEnd: '11:00', work: 'X' })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  x = on('R146-TRP', '2026-09-03');
  assert.deepStrictEqual([x.trip, x.ts, x.te, x.work, parts('R146-TRP', '2026-09-03').map(q => q.ti + ' ' + q.w)], [5, '09:00', '15:00', 'X / Y', ['09:00-11:00 X', '13:00-15:00 Y']]);
  // the edit window: the same trips and texts – its rows stay; other trips – its rows no longer add up and go (the entry stays)
  const K = d => 'R146-TRP|' + d + '|Full Day', ent = run('k => getLogEntry_(k)', K('2026-09-01'));
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-09-01'), { trip: 10, challan: ent.challan, chFrom: ent.chFrom, chTo: ent.chTo, work: ent.work }).thrown);
  assert.strictEqual(parts('R146-TRP', '2026-09-01').length, 3);
  assert.ok(!tryRun('(k, l) => updateLogRow_(k, l)', K('2026-09-01'), { trip: 11, challan: ent.challan, chFrom: ent.chFrom, chTo: ent.chTo, work: ent.work }).thrown);
  assert.deepStrictEqual([on('R146-TRP', '2026-09-01').trip, parts('R146-TRP', '2026-09-01') || null], [11, null]);
  // Edit Log Book: a shift by trips sent with its rows
  const BT = ps => ({ no: 'R146-TRP', from: '2026-09-04', to: '2026-09-04', deleted: [], openingDiesel: '', rows: [{ key: '', half: false, date: '2026-09-04', shift: 'Full Day', mode: 'Trip', openingKm: '', closingKm: '', openingHr: '', closingHr: '', tStart: '', tEnd: '', tBreak: '', remark: '', trip: 7, challan: 'B1 / B2', chFrom: '', chTo: '', work: 'W1 / W2', items: { _parts: ps } }] });
  x = tryRun('b => saveLogBulk_(b)', BT([{ n: '', q: 4, k: 'trip', c: 'B1', w: 'W1' }, { n: '', q: 2, k: 'trip', c: 'B2', w: 'W2' }]));
  assert.ok(x.ok === false && /the rows of this shift make 6 trips but the entry has 7 trips/.test(JSON.stringify(x)), JSON.stringify(x).slice(0, 300));
  x = tryRun('b => saveLogBulk_(b)', BT([{ n: '', q: 4, k: 'trip', c: 'B1', w: 'W1' }, { n: '', q: 3, k: 'trip', c: 'B2', w: 'W2' }]));
  assert.ok(x.ok, JSON.stringify(x).slice(0, 300));
  assert.deepStrictEqual(run('() => getLogEditData_("R146-TRP", "2026-09-04", "2026-09-04")').rows[0].itemParts.map(q => [q.k, q.q, q.c].join(' ')), ['trip 4 B1', 'trip 3 B2']);
  // ---- A MACHINERY BY THE DAY: two works of one day – ONE day, paid once ----
  r = save([E('R146-DAY', '2026-09-01', { mode: 'Day', work: 'SITE A', openingDiesel: 20 }), E('R146-DAY', '2026-09-01', { mode: 'Day', work: 'SITE B' })]);
  assert.ok(r.ok && r.joined === 2, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual([on('R146-DAY', '2026-09-01').work, parts('R146-DAY', '2026-09-01')], ['SITE A / SITE B', [{ n: '', q: 1, k: 'day', w: 'SITE A' }, { n: '', q: 1, k: 'day', w: 'SITE B' }]]);
  assert.strictEqual(amount('R146-DAY', '2026-09-01'), 3000, 'one day');
  no(save([E('R146-DAY', '2026-09-02', { mode: 'Day', work: 'SITE A' }), E('R146-DAY', '2026-09-02', { mode: 'Day', work: 'SITE A' })]), /row 2 of 02-09-2026 is the same as row 1 \(the same challan, chainage and work\)/);
  // the code that decides
  const code = fs.readFileSync(path.join(__dirname, '..', 'app', 'Code.gs'), 'utf8');
  assert.match(code, /if \(hasKm_\(mode\)\) return 'km';\n  if \(hasHr_\(mode\)\) return 'hr';\n  if \(mode === 'Trip'\) return 'trip';\n  if \(mode === 'Day'\) return 'day';/);
  assert.ok(!/two rows one after the other are both/.test(code), 'the same work twice in a row is no longer refused');
});

test('update-146 (after the review): rows keep what was typed on them and their Excel work type; trips with two works row by row; KM + Hrs duplicates on both meters; trips on rows by the day; a work approved in verification', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  run('(x, m) => saveVendor_(x, m)', { name: 'R146B Hire', gstReg: 'No', pan: 'ABCDE1247R', bank: 'SBI', account: '12345147', ifsc: 'SBIN0000001' }, 'add');
  const M = (no, o) => run('(x, m) => saveMaster_(x, m)', Object.assign({ no: no, owner: 'R146B Hire', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, o), 'add');
  M('R146B-HYD', { name: 'Hydra', type: 'Hydra', unit: 'KM + Hrs', worksOn: ['KM', 'Hrs'], kmStd: 3, hrStd: 4 });
  M('R146B-TRP', { name: 'Tipper', type: 'Tipper', unit: 'Trip', worksOn: ['Trip'] });
  M('R146B-TIP', { name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4 });
  M('R146B-TM', { name: 'Transit Mixer', type: 'Transit Mixer', unit: 'KM + Hrs', worksOn: ['KM', 'Hrs'], kmStd: 3, hrStd: 4 });
  M('R146B-GR', { name: 'Grader', type: 'Grader', unit: 'Day', worksOn: ['Day'] });
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R146B Hire', from: '2026-09-01', tdsPct: 2, woNo: 'WO-R146B', lines: [
    { no: 'R146B-HYD', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'LIFT', basis: 'Per Hour', rate: 1000, qty: 'rest' }, { name: 'SHIFTING', basis: 'Per KM', rate: 50, qty: 'typed' }] },
    { no: 'R146B-TRP', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'SOIL', basis: 'Per Trip', rate: 600, qty: 'typed' }, { name: 'MURUM', basis: 'Per Trip', rate: 400, qty: 'rest' }] },
    { no: 'R146B-TIP', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'CARTING', basis: 'Per KM', rate: 40, qty: 'typed' }] },
    { no: 'R146B-TM', basis: 'Per Hour', rate: 500, diesel: 'Company' },
    { no: 'R146B-GR', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'DAY-A', basis: 'Per Day', rate: 3000 }, { name: 'DAY-B', basis: 'Per Day', rate: 4000 }] }] });
  const save = rows => run('x => { try { return saveLogRowsInner_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: rows });
  const no = (x, re) => assert.ok(x.ok === false && x.errors.some(e => re.test(e.msg)), JSON.stringify(x).slice(0, 500));
  const item = (n, d) => run(`(no, d) => { const lt = table_(APP.SHEET_LOG), c = lt.c; const r = lt.rows.find(x => str_(x[c[H.NO]]) === no && dkey_(x[c[H.DATE]]) === d); return r ? { items: str_(r[c[H.ITEMS]]), trip: numOrBlank_(r[c[H.TRIP]]), work: str_(r[c[H.WORK]]) } : null; }`, n, d);
  const J = (n, d) => JSON.parse(item(n, d).items || '{}');
  const amount = (n, d) => run('(no, f, t) => billMachineCalc_(findMachine_(no), getLogBookList_({ from: f, to: t, no: no, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [no] }), f, t, undefined, true).amount', n, d, d);
  const back = (n, d, sh) => run('(no, d, s) => { const lt = table_(APP.SHEET_LOG, logHeaders_()); return logEntryRows_(lt, logSavedIdx_(lt, no, d, s), findMachine_(no)); }', n, d, sh || 'Full Day');
  const E = (n, d, o) => Object.assign({ date: d, shift: 'Full Day', no: n }, o);
  // 1. a typed item on rows without a work picked (SHIFTING per KM beside LIFT per hour): kept on each row and on the entry – read back as they were
  let r = save([E('R146B-HYD', '2026-09-01', { mode: 'KM + Hrs', openingKm: 100, closingKm: 110, openingHr: 50, closingHr: 53, openingDiesel: 50, items: { SHIFTING: 10 }, challan: 'A' }),
    E('R146B-HYD', '2026-09-01', { mode: 'KM + Hrs', closingKm: 130, closingHr: 57, items: { SHIFTING: 20 }, challan: 'B' })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  let j = J('R146B-HYD', '2026-09-01');
  assert.strictEqual(j.SHIFTING, 30);
  assert.deepStrictEqual(j._parts.map(p => [p.q, p.o, (p.x || {}).SHIFTING]), [[10, 3, 10], [20, 4, 20]]);
  assert.strictEqual(amount('R146B-HYD', '2026-09-01'), 7 * 1000 + 30 * 50);
  assert.deepStrictEqual(back('R146B-HYD', '2026-09-01').rows.map(y => y.items.SHIFTING), [10, 20], 'each row gets back what was typed on it');
  assert.deepStrictEqual(run('() => getLogEditData_("R146B-HYD", "2026-09-01", "2026-09-01")').rows[0].itemParts.map(p => (p.x || {}).SHIFTING), [10, 20]);
  // … Edit Log Book changes a challan only (the page sends the rows as it read them): SHIFTING stays, the bill too
  const g1 = run('() => getLogEditData_("R146B-HYD", "2026-09-01", "2026-09-01")').rows[0];
  let x = tryRun('b => saveLogBulk_(b)', { no: 'R146B-HYD', from: '2026-09-01', to: '2026-09-01', deleted: [], openingDiesel: '', rows: [{ key: g1.key, half: false, date: '2026-09-01', shift: 'Full Day', mode: 'KM + Hrs', openingKm: 100, closingKm: 130, openingHr: 50, closingHr: 57,
    tStart: '', tEnd: '', tBreak: '', remark: '', trip: '', challan: 'A / C', chFrom: '', chTo: '', work: '', items: { SHIFTING: 30, _parts: [{ n: '', q: 10, k: 'km', o: 3, x: { SHIFTING: 10 }, c: 'A' }, { n: '', q: 20, k: 'km', o: 4, x: { SHIFTING: 20 }, c: 'C' }] } }] });
  assert.ok(x.ok, JSON.stringify(x).slice(0, 300));
  assert.deepStrictEqual([J('R146B-HYD', '2026-09-01').SHIFTING, amount('R146B-HYD', '2026-09-01')], [30, 7 * 1000 + 30 * 50]);
  // 2. the Excel "Work type" of rows without a work picked (a tipper with one typed KM item): its whole KM go to it – also on the first row
  r = save([E('R146B-TIP', '2026-09-01', { mode: 'KM', openingKm: 1000, closingKm: 1040, openingDiesel: 40, items: { _all: 'CARTING' } }), E('R146B-TIP', '2026-09-01', { mode: 'KM', closingKm: 1100, items: { _all: 'CARTING' } })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  j = J('R146B-TIP', '2026-09-01');
  assert.deepStrictEqual([j.CARTING, j._parts.map(p => (p.x || {}).CARTING)], [100, [40, 60]]);
  assert.strictEqual(amount('R146B-TIP', '2026-09-01'), 100 * 40, 'before the review: ₹0');
  r = save([E('R146B-TIP', '2026-09-02', { mode: 'KM', closingKm: 1110 }), E('R146B-TIP', '2026-09-02', { mode: 'KM', closingKm: 1120, items: { _all: 'LIFT' } })]);
  no(r, /"LIFT" is not an item of its BOQ/);
  // 3. trips with two works (SOIL typed, MURUM the rest): each row ONE of them – by its Work type, its typed trips, or the rest
  r = save([E('R146B-TRP', '2026-09-01', { mode: 'Trip', trip: 5, items: { _all: 'SOIL' }, openingDiesel: 20, challan: 'S1' }), E('R146B-TRP', '2026-09-01', { mode: 'Trip', trip: 3, items: { _all: 'SOIL' }, challan: 'S2' })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  j = J('R146B-TRP', '2026-09-01');
  assert.deepStrictEqual([j.SOIL, j._parts.map(p => [p.n, p.q, p.k])], [8, [['SOIL', 5, 'trip'], ['SOIL', 3, 'trip']]]);
  assert.strictEqual(amount('R146B-TRP', '2026-09-01'), 8 * 600, 'before the review: 8 × 400');
  r = save([E('R146B-TRP', '2026-09-02', { mode: 'Trip', trip: 5, items: { SOIL: 5 }, challan: 'S3' }), E('R146B-TRP', '2026-09-02', { mode: 'Trip', trip: 3, items: {}, challan: 'M1' })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(J('R146B-TRP', '2026-09-02')._parts.map(p => p.n + ' ' + p.q), ['SOIL 5', 'MURUM 3']);
  assert.strictEqual(amount('R146B-TRP', '2026-09-02'), 5 * 600 + 3 * 400);
  assert.deepStrictEqual(run('() => getLogEditData_("R146B-TRP", "2026-09-02", "2026-09-02")').rows[0].itemParts.map(p => [p.n, p.q, p.k]), [['SOIL', 5, 'trip'], ['MURUM', 3, 'trip']]);
  no(save([E('R146B-TRP', '2026-09-03', { mode: 'Trip', trip: 5, items: { SOIL: 2 } }), E('R146B-TRP', '2026-09-03', { mode: 'Trip', trip: 3 })]), /each row of one shift is ONE work: press SOIL \/ MURUM \(not Split\)/);
  r = save([E('R146B-TRP', '2026-09-02', { mode: 'Trip', trip: 2, items: { SOIL: 2 }, challan: 'S4', add: 1 })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  assert.strictEqual(amount('R146B-TRP', '2026-09-02'), 7 * 600 + 3 * 400, 'added to the saved shift as its third work');
  // 4. KM + Hrs: a duplicate only when BOTH meters read the same
  r = save([E('R146B-TM', '2026-09-01', { mode: 'KM + Hrs', openingKm: 5000, closingKm: 5010, openingHr: 100, closingHr: 100, openingDiesel: 30 }), E('R146B-TM', '2026-09-01', { mode: 'KM + Hrs', openingKm: 5010, closingKm: 5030, openingHr: 100, closingHr: 100 })]);
  assert.ok(r.ok, 'the same hours, other KM: two works – ' + JSON.stringify(r).slice(0, 300));
  no(save([E('R146B-TM', '2026-09-01', { mode: 'KM + Hrs', openingKm: 5010, closingKm: 5030, openingHr: 100, closingHr: 100, add: 1 })]), /this work is already in the saved entry of this shift/);
  r = save([E('R146B-TM', '2026-09-01', { mode: 'KM + Hrs', closingKm: 5040, closingHr: 102, add: 1 })]);
  assert.ok(r.ok && r.added === 1, 'a new work beside saved rows of 0 hours – ' + JSON.stringify(r).slice(0, 300));
  // 5. rows by the day with trips (Format B): the trips of the rows are added and each row keeps its own; a Work type naming a day item picks it
  r = save([E('R146B-GR', '2026-09-01', { mode: 'Day', trip: 4, work: 'A', openingDiesel: 10, items: { _all: 'DAY-B' } }), E('R146B-GR', '2026-09-01', { mode: 'Day', trip: 3, work: 'B' })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual([item('R146B-GR', '2026-09-01').trip, J('R146B-GR', '2026-09-01')._day, J('R146B-GR', '2026-09-01')._parts.map(p => p.tr)], [7, 'DAY-B', [4, 3]]);
  assert.deepStrictEqual(back('R146B-GR', '2026-09-01').rows.map(y => y.trip), [4, 3]);
  // 6. an entry approved in verification after another of its shift was saved: added to it (it had no "add" mark – sent before)
  r = run('x => { FLOW_RUN_ID_ = "VF-146"; try { return saveLogRowsInner_(x); } catch (e) { return { thrown: String(e.message) }; } finally { FLOW_RUN_ID_ = ""; } }', { rows: [E('R146B-TIP', '2026-09-01', { mode: 'KM', closingKm: 1130, work: 'APPROVED LATER' })] });
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  no(save([E('R146B-TIP', '2026-09-01', { mode: 'KM', closingKm: 1150 })]), /already saved for 01-09-2026 \(Full Day\)/);      // (without the mark and not from verification: an older app – as before)
  // 7. (second review) a Work type of the OTHER meter on rows read in KM + Hrs: that meter's quantity of each row
  M('R146B-HY2', { name: 'Hydra', type: 'Hydra', unit: 'KM + Hrs', worksOn: ['KM', 'Hrs'], kmStd: 3, hrStd: 4 });
  M('R146B-ROL', { name: 'Roller', type: 'Roller', unit: 'Hrs', worksOn: ['Hrs', 'Time'], hrStd: 5 });
  run('(x, m) => saveBoq_(x, m)', { vendor: 'R146B Hire', from: '2026-09-01', tdsPct: 2, woNo: 'WO-R146C', lines: [
    { no: 'R146B-HY2', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'PICK', basis: 'Per Hour', rate: 1200, qty: 'typed' }, { name: 'MOVE', basis: 'Per KM', rate: 30, qty: 'rest' }] },
    { no: 'R146B-ROL', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'ROLLING', basis: 'Per Hour', rate: 1000, qty: 'typed' }] }] });
  r = save([E('R146B-HY2', '2026-09-01', { mode: 'KM + Hrs', openingKm: 10, closingKm: 20, openingHr: 5, closingHr: 7, openingDiesel: 20, items: { _all: 'PICK' } }), E('R146B-HY2', '2026-09-01', { mode: 'KM + Hrs', closingKm: 25, closingHr: 10, items: { _all: 'PICK' } })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  j = J('R146B-HY2', '2026-09-01');
  assert.deepStrictEqual([j.PICK, j._parts.map(p => (p.x || {}).PICK)], [5, [2, 3]]);
  assert.strictEqual(amount('R146B-HY2', '2026-09-01'), 5 * 1200 + 15 * 30);
  r = save([E('R146B-HY2', '2026-09-02', { mode: 'KM + Hrs', closingKm: 30, closingHr: 11, items: { _all: 'PICK' } }), E('R146B-HY2', '2026-09-02', { mode: 'KM + Hrs', closingKm: 40, closingHr: 14, items: { _all: 'PICK' } })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  j = J('R146B-HY2', '2026-09-02');
  assert.deepStrictEqual([j.PICK, j._parts.map(p => [p.q, p.o, (p.x || {}).PICK])], [4, [[5, 1, 1], [10, 3, 3]]], 'the first row\'s Start from the day before: its hours known on save');
  // 8. (second review) a row by Time keeps what was typed on it too; an old shift (rows without their share) takes a work – shared out, not all on row 1
  r = save([E('R146B-ROL', '2026-09-01', { mode: 'Hrs', openingHr: 100, closingHr: 102, openingDiesel: 20, items: { ROLLING: 2 } }), E('R146B-ROL', '2026-09-01', { mode: 'Time', tStart: '14:00', tEnd: '16:00', items: { ROLLING: 2 } })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(J('R146B-ROL', '2026-09-01')._parts.map(p => (p.x || {}).ROLLING), [2, 2]);
  r = save([E('R146B-ROL', '2026-09-02', { mode: 'Hrs', closingHr: 104, items: { ROLLING: 2 } }), E('R146B-ROL', '2026-09-02', { mode: 'Hrs', closingHr: 105, items: { ROLLING: 1 } })]);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
  run(`() => { const lt = table_(APP.SHEET_LOG), c = lt.c, i = lt.rows.findIndex(x => str_(x[c[H.NO]]) === 'R146B-ROL' && dkey_(x[c[H.DATE]]) === '2026-09-02'), row = lt.rows[i].slice();
    row[c[H.ITEMS]] = JSON.stringify({ ROLLING: 3, _parts: [{ n: '', q: 2 }, { n: '', q: 1 }] }); lt.sh.getRange(i + 2, 1, 1, row.length).setValues([row]); }`);      // (as saved before the review: no share on its rows)
  r = save([E('R146B-ROL', '2026-09-02', { mode: 'Hrs', closingHr: 107, items: { ROLLING: 2 }, add: 1 })]);
  assert.ok(r.ok && r.added === 1, JSON.stringify(r).slice(0, 300));
  j = J('R146B-ROL', '2026-09-02');
  assert.deepStrictEqual([j.ROLLING, j._parts.map(p => (p.x || {}).ROLLING)], [5, [2, 1, 2]], 'row 1 keeps 2 (its hours), not all 3');
  assert.strictEqual(amount('R146B-ROL', '2026-09-02'), 5 * 1000);
});

test('update-141: the Google Sheet backup ONCE A DAY (the nightly job; the first open page of the day if it did not run); the logs only their new rows', () => {
  const root = path.join(__dirname, '..');
  const bk = require('../server/backup.vm.js'), rt = fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8'), pg = fs.readFileSync(path.join(root, 'server', 'page.js'), 'utf8');
  // an open page: nothing when a backup ended today (India date); 4 minutes after a failed try; the nightly job (full) always runs
  assert.ok(/const doneToday = st => !!ms\(st\.lastCheck\) && dayOf\(ms\(st\.lastCheck\)\) === dayOf\(nowMs\)/.test(bk) && /'Asia\/Kolkata', 'yyyy-MM-dd'/.test(bk));
  assert.ok(/if \(opt\.auto && !opt\.full && !unfinished && \(doneToday\(state\) \|\| \(ms\(state\.lastTry\) && nowMs - ms\(state\.lastTry\) < 4 \* 60000\)\)\) return \{ skipped: true \};/.test(bk));
  assert.ok(/!\(state\.todo && state\.todo\.length\) && doneToday\(state\)\) \{ __unlockNamed\((?:'backup'|T\.lock)\); return \{ skipped: true \}; \}/.test(bk), 'checked again with the lock');      // (update-157: the lock of this backup – the site's "backup" or the Portal's)
  assert.ok(!/nowMs - Math\.max\(ms\(state\.lastCheck\), ms\(state\.lastTry\)\) < 4 \* 60000/.test(bk), 'no backup every 4 minutes any more');
  // the logs: only the new rows, when the tab and the notes agree; else (and once in 30 days) whole
  assert.ok(/const APPEND_ = \{ activity_log: 'id', store_activity: 'id' \};/.test(bk) && /MONTH = 30 \* day/.test(bk));
  // (review 21-10-2026) read by key page by page, each key once; same columns; never into a tab made again in the same run
  assert.ok(/const add = byKey\(t, kcol, a\.last\);/.test(bk) && /if \(!distinct\(add, kcol\)\) return null;/.test(bk) && /list = kcol \? byKey\(t, kcol, ''\) :/.test(bk));
  assert.ok(/if \(a\.cols !== colsOf\(t\)\) return null;/.test(bk) && /if \(missing\.indexOf\((?:sbTabName_|tabOf)\(t\)\) > -1\) return null;/.test(bk));
  assert.ok(/Number\(tab\.gridProperties\.rowCount\) !== Number\(a\.n\) \+ 1\) return null;/.test(bk) && /return countUpTo\(t, kcol, top\) === Number\(a\.n\) \+ add\.length \? add : null;/.test(bk));
  assert.ok(/rowCount: x\.total \|\| x\.data\.length/.test(bk) && /'!A' \+ \(\(x\.from \|\| 0\) \+ i \+ 1\)/.test(bk) && /if \(!jobs\.length\) return;/.test(bk));
  assert.ok(/keep\(\{ sig: old, fullRun: fullRun, todo: changed\.filter\(t => !doneNow\[t\]\), lastRun: nowIso, app: apps(, copied: copied(, remPos: remPos, retry: Object\.keys\(remBad\))?)? \}\)/.test(bk), 'the notes of the logs are kept with each group');
  // the page asks every 30 minutes; a minute later while something is left (the answer says "pending")
  assert.ok(/setInterval\(tick, 1800000\)/.test(pg) && !/setInterval\(tick, 300000\)/.test(pg) && /j\.pending > 0\) \{ clearTimeout\(soon\); soon = setTimeout\(tick, 60000\)/.test(pg));
  assert.ok(/pending: Number\(r\.pending\) \|\| 0 \}; \}|pending: \(Number\(r\.pending\) \|\| 0\) \+ \(d && d\.pending \? 1 : 0\) \}; \}/.test(rt))      // (update-158) + the files still to copy to Drive;
  // the page's script still parses
  const { shell } = require('../server/page.js'); const sh = shell(); const scripts = sh.match(/<script>([\s\S]*?)<\/script>/g) || [];
  scripts.forEach(s => { new Function(s.replace(/^<script>|<\/script>$/g, '')); });
  // the nightly job is still in vercel.json (02:00 India time) and still needs its secret
  const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.deepStrictEqual(v.crons, [{ path: '/api/backup?full=1', schedule: '30 20 * * *' }]);
  assert.ok(/if \(!secret \|\| !same\(got, 'Bearer ' \+ secret\)\) return send\(401/.test(fs.readFileSync(path.join(root, 'api', 'backup.js'), 'utf8')));
  // the Admin's pill: the time when today's, else the date
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.ok(/'<\/svg><span>Backup ' \+ \(bad \? '!' : \(t \? bkWhen\(t\) : ''\)\)/.test(app) && /const bkWhen = iso =>/.test(app));
  const bkWhen = new Function('const hhmm = iso => "T"; ' + app.slice(app.indexOf('const bkWhen = iso =>'), app.indexOf('\n', app.indexOf('const bkWhen = iso =>'))) + ' return bkWhen;')();
  assert.strictEqual(bkWhen(new Date().toISOString()), 'T');
  assert.ok(/^\d{2} [A-Z][a-z]{2}$/.test(bkWhen(new Date(Date.now() - 3 * 86400000).toISOString())), bkWhen(new Date(Date.now() - 3 * 86400000).toISOString()));
});

test('update-140: step 2b (web_boot2 – the settings and the users list only when changed) is listed word for word, only ADDS one function, is checked by the Admin\'s database page, and the server uses it with a way back', () => {
  const file = fs.readFileSync(path.join(root, 'sql', 'supabase_step2b_light_boot.sql'), 'utf8');
  const list = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')();
  const i = list.findIndex(x => x.name === 'supabase_step2b_light_boot.sql');
  assert.ok(i > -1, 'step 2b is listed in Read Me (so a new site and the staging database get it too)');
  assert.strictEqual(list[i].sql, file, 'the text shown in the app is the file, word for word');
  assert.strictEqual(list[i - 1].name, 'supabase_step2_web.sql', 'right after step 2 (it needs web.props / web.cache)');
  const code = file.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\b(drop|truncate|delete|insert|update|alter)\b/i.test(code), 'nothing is dropped, emptied, changed or written – one function is added');
  assert.match(code, /^\s*begin;/m); assert.match(code, /commit;/);
  const fns = [...code.matchAll(/create or replace function public\.(\w+)\(/g)].map(m => m[1]);
  assert.deepStrictEqual(fns, ['web_boot2'], 'exactly one function');
  assert.match(code, /returns jsonb language plpgsql stable security definer set search_path = '' as/, 'a fixed, EMPTY search_path');
  assert.match(code, /revoke all on function public\.web_boot2\(text\[\], text, jsonb, text\) from public, anon, authenticated;/);
  assert.match(code, /grant execute on function public\.web_boot2\(text\[\], text, jsonb, text\) to service_role;/);
  const fnBody = (code.match(/as \$\$([\s\S]*?)\$\$;/) || [])[1] || '';
  assert.ok(fnBody && !/from\s+(?!web\.|c\b|v\b)\w+/i.test(fnBody), 'every table it reads is named with its schema (web.props, web.cache)');
  assert.match(fnBody, /if p_stamp is null or p_stamp = '' or p_stamp <> v_sh then v_out := v_out \|\| v_st; end if;/, 'the stamp only when the server does not have it');
  assert.match(fnBody, /'same',\s+coalesce\(\(select jsonb_agg\(c\.key\) from c where p_have is not null and \(p_have ->> c\.key\) = c\.h\)/, 'an unchanged entry: only its name');
  // the Admin's database page knows the step; the staging file has it
  const cg = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  assert.match(cg, /add\('Less data from the database[^']*\(step 2b\)', fn\('web_boot2'\), 'supabase_step2b_light_boot\.sql'\)/);
  assert.ok(fs.readFileSync(path.join(root, 'staging', 'rcl_staging_all.sql'), 'utf8').indexOf(file) > -1, 'the staging database gets step 2b');
  // the server: web_boot2 first, web_boot when it is missing (404); the light 15-minute check; one read shared by the threads
  const gas = fs.readFileSync(path.join(root, 'server', 'gas.js'), 'utf8'), pool = fs.readFileSync(path.join(root, 'server', 'pool.js'), 'utf8'), rt = fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8');
  assert.match(gas, /rpc\('web_boot2', \{ p_keys: keys, p_ver: [^}]+p_have: have, p_stamp: BEAT\.st \? BEAT\.sh : '' \}\)/);
  assert.match(gas, /if \(!BOOT_NOT_THERE\(e\)\) throw e; BEAT\.boot2 = Date\.now\(\);/, 'a missing step 2b → web_boot, as before (any other error is not hidden)');
  assert.match(gas, /if \(BEAT\.boot2 === true \|\| Date\.now\(\) - Number\(BEAT\.boot2\) > 600000\)/, 'asked again 10 minutes later (the step may have been run since)');
  assert.match(gas, /if \(whole \|\| lost \|\| stampLost\) \{ BEAT\.pall = null; BEAT\.kept\.clear\(\); BEAT\.st = null; BEAT\.sh = ''; return bootAsk\(keys\); \}/, 'anything that does not fit: everything again');
  assert.match(gas, /throw new Error\('404 web_boot2 is not installed/);
  assert.match(gas, /else if \(Date\.now\(\) - s\.loadedAt > WARM_REFRESH\) due\.push\(t\);/, 'after 15 minutes: the light check, not a whole read');
  assert.match(gas, /Date\.now\(\) - \(s\.wholeAt \|\| 0\) > WARM_WHOLE\) cold\.push\(t\)/, 'a whole read once in 6 hours still');
  assert.match(gas, /WARM_DIFF_MAX = 300/);
  assert.match(pool, /workerData: \{ rclWorker: true, seed: \[\.\.\.SNAP\.values\(\)\] \}/, 'a new thread starts with the tables the server already read');
  assert.match(gas, /if \(ON_TABLE && rows\.length < WARM_MAX\) ON_TABLE\(site\(\), t, WARM\.tables\.get\(t\)\);/, 'a very big table is not passed between threads');
  assert.match(rt, /return \['S_' \+ String\(args\[0\] \|\| ''\), 'USERS_LIST', 'RTCN', 'FLOW_REMIND'\];/, 'the reminder mark comes with the start of the request');
});

test('update-142: a database helper unused for a while keeps running – only its connections are renewed (a new helper only when that cannot be done)', async () => {
  const root = path.join(__dirname, '..'), src = fs.readFileSync(path.join(root, 'server', 'syncfetch.js'), 'utf8');
  assert.match(src, /if \(worker && Date\.now\(\) - lastUsed > IDLE_MS && !renew\(worker\)\) \{ const old = worker; worker = null; try \{ old\.terminate\(\); \} catch \(e\) \{\} \}/, 'renewed first; replaced only when that fails');
  assert.match(src, /const POOL_KEY = Symbol\.for\('undici\.globalDispatcher\.1'\);/);
  assert.match(src, /if \(m && m\.renew\) \{ let ok = false; try \{ ok = renewPool\(used\); \} catch \(e\) \{ ok = false; \} m\.port\.postMessage\(ok === true\);/);
  // (review 22-10-2026) the renewal itself, on every layout: only Node 20 / 22's (one pool, under '.1') is renewed; anything else → false
  const block = /\/\/ <renewPool>([\s\S]*?)\/\/ <\/renewPool>/.exec(src)[1], vm = require('vm');
  const tryIt = body => JSON.parse(vm.runInNewContext(block + '\nglobalThis.destroyed = 0; class Pool { dispatch() {} destroy() { globalThis.destroyed++; return Promise.resolve(); } }\nJSON.stringify((() => { ' + body + ' })());'));      // (plain values: the answer comes from another realm)
  const K1 = "Symbol.for('undici.globalDispatcher.1')", K2 = "Symbol.for('undici.globalDispatcher.2')", put = (k, w) => 'Object.defineProperty(globalThis, ' + k + ', { value: ' + w + ', writable: true });';
  assert.strictEqual(tryIt('return renewPool(false);'), true, 'no request yet: nothing to renew');
  assert.strictEqual(tryIt('return renewPool(true);'), false, 'used, but no pool under the known name (another Node): replaced as before');
  assert.deepStrictEqual(tryIt('const o = new Pool(); ' + put(K1, 'o') + ' const r = renewPool(true); return [r, globalThis[' + K1 + '] !== o, globalThis.destroyed];'), [true, true, 1], 'Node 20 / 22: a new pool, the old one closed');
  assert.deepStrictEqual(tryIt(put(K1, 'new Pool()') + put(K2, 'new Pool()') + ' return [renewPool(true), globalThis.destroyed];'), [false, 0], 'a newer Node (undici 8 keeps its pool under .2): not renewed, nothing closed');
  assert.deepStrictEqual(tryIt(put(K2, 'new Pool()') + ' return [renewPool(true), globalThis.destroyed];'), [false, 0]);
  assert.deepStrictEqual(tryIt('const o = new Pool(); Object.defineProperty(globalThis, ' + K1 + ', { value: o, writable: false }); return [renewPool(true), globalThis[' + K1 + '] === o, globalThis.destroyed];'), [false, true, 0], 'cannot be replaced: the pool in use is left open');
  const helper = /const WORKER_SRC = `([\s\S]*?)`;/.exec(src); assert.ok(helper); new Function('require', helper[1]);      // the helper's own code parses
  // in use: a pause longer than the idle limit renews the connections of the same helper, and the next request is answered
  const { Worker } = require('worker_threads');
  const srv = new Worker("const http = require('http'); const { parentPort } = require('worker_threads'); http.createServer((q, s) => s.end('ok')).listen(0, '127.0.0.1', function () { parentPort.postMessage(this.address().port); });", { eval: true });
  const port = await new Promise(ok => srv.once('message', ok));
  process.env.RCL_FETCH_IDLE_MS = '600';
  const file = path.join(root, 'server', 'syncfetch.js'); delete require.cache[require.resolve(file)];
  const sf = require(file), url = 'http://127.0.0.1:' + port + '/';
  try {
    assert.strictEqual(sf.fetchAllSync([{ url: url }])[0].code, 200);
    const made = sf.helpersMade(), renewed = sf.renewals();
    for (let i = 0; i < 3; i++) { sf.sleepSync(700); assert.strictEqual(sf.fetchAllSync([{ url: url }])[0].code, 200); }
    assert.strictEqual(sf.renewals(), renewed + 3, 'renewed after each pause'); assert.strictEqual(sf.helpersMade(), made, 'no new helper');
  } finally { await srv.terminate(); delete process.env.RCL_FETCH_IDLE_MS; delete require.cache[require.resolve(file)]; }
});

test('update-151: a submitted bill keeps its Log Book as evidence – the same as verified, written with the bill, checked later; changed after Verify = nothing submitted', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // the rig's storage of the evidence is the database; here an in-memory stand-in with the same rows (the database's no-change rule is tested on the rig)
  vm.runInContext(`var EV_STORE = { snap: [], rows: [] }; var __evReady0 = evReady_, __evAppend0 = evAppend_, __evRead0 = evRead_;
    evReady_ = () => true;
    evAppend_ = (tab, o) => { (tab === EV_SNAP_TAB_ ? EV_STORE.snap : EV_STORE.rows).push(JSON.parse(JSON.stringify(o))); };
    evRead_ = id => { const s = EV_STORE.snap.find(x => x['Bill ID'] === id); if (!s) return null;
      return { snap: { id: id, bill_no: s['Bill No'], rev: s['Rev'], vendor_name: s['Vendor Name'], company: s['Company'], period_from: String(s['Period From']).slice(0, 10), period_to: String(s['Period To']).slice(0, 10), kind: s['Kind'],
        bill_data: s['Bill Data'], machines: s['Machines'], extra: s['Extra'], rows_count: s['Rows Count'], snapshot_sha256: s['Snapshot SHA256'], submitted_by: s['Submitted By'], submitted_at: s['Submitted At'] },
        rows: EV_STORE.rows.filter(r => r['Bill ID'] === id).map(r => ({ entry_key: r['Entry Key'], data: r['Data'], row_sha256: r['Row SHA256'] })) }; };`, ctx);
  try {
    // the canonical text: the same content gives the same text whatever order its keys were made in
    assert.strictEqual(run('() => canon_({ b: 1, a: [2, { d: 4, c: 3 }], e: undefined, n: null })'), '{"a":[2,{"c":3,"d":4}],"b":1,"n":null}');
    assert.strictEqual(run('() => canon_({ a: [2, { c: 3, d: 4 }], n: null, b: 1 })'), run('() => canon_({ b: 1, a: [2, { d: 4, c: 3 }], n: null })'));
    run('(x, m) => saveVendor_(x, m)', { name: 'Ev Vendor', gstReg: 'No', pan: 'ABCPE1151V', bank: 'SBI', account: '15101510', ifsc: 'SBIN0000151' }, 'add');
    run('(x, m) => saveMaster_(x, m)', { no: 'EVX-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Ev Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    run('(x, m) => saveBoq_(x, m)', { vendor: 'Ev Vendor', from: '2026-01-01', tdsPct: 2, woNo: 'WO-EV', lines: [{ no: 'EVX-1', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add');
    const log = (date, shift, close, extra) => run('x => saveLogRowsInner_(x)', { rows: [Object.assign({ date: date, shift: shift, no: 'EVX-1', mode: 'KM', closingKm: close }, extra || {})] });
    assert.ok(log('2026-05-01', 'Day', 1040, { openingKm: 1000 }).ok); assert.ok(log('2026-05-01', 'Night', 1070).ok); assert.ok(log('2026-05-02', 'Full Day', 1120).ok);
    const co = run('() => billCompanies_()')[0];
    const mk = no => run(`(a) => { const m = findMachine_('EVX-1'), from = '2026-05-01', to = '2026-05-31';
      const c = billMachineCalc_(m, getLogBookList_({ from: from, to: to, no: 'EVX-1', all: true }).rows, logPrintExtra_({ from: from, to: to, nos: ['EVX-1'] }), from, to, undefined, true);
      const A = r2_(c.amount), B = r2_(c.excessAmt), D = r2_(A - B), H2 = D > 0 ? r2_(D * c.tdsPct / 100) : 0;
      return { company: a[1], vendor: { name: 'Ev Vendor' }, from: from, to: to, billDate: to, billNo: a[0], picked: ['EVX-1'], partial: false, edited: false, idlePaid: true,
        machines: [{ no: 'EVX-1', workDays: c.workDays, nights: c.nights, issued: c.issued, amount: c.amount, excessAmt: c.excessAmt, lines: [] }], A: A, B: B, C: 0, D: D, E: 0, F: 0, G: D, H: H2, I: r2_(D - H2), gstPct: c.gstPct, tdsPct: c.tdsPct }; }`, [no, co]);
    const sub = b => run('(b, co) => submitBills_({ bills: [{ vendor: "Ev Vendor", company: co, billNo: b.billNo, from: b.from, to: b.to, billDate: b.billDate, net: b.I, data: b }] })', b, co);
    // 1. Verify keeps the evidence hash with its "verified" mark; Submit writes the bill and its evidence together
    let bill = mk('151');
    const ver = run('b => verifyBills_({ bills: [b] })', bill);
    assert.ok(ver && ver.ok, JSON.stringify(ver).slice(0, 600));
    assert.ok(ver.bills[0].checks.some(c => c.s === 'ok' && /^Log Book evidence: 3 entries of 1 machinery/.test(c.t)), 'said in the checks');
    const mark = run('(b) => CacheService.getScriptCache().get(billVerifyKey_(b, { vendor: "Ev Vendor", company: b.company, from: b.from, to: b.to }))', bill);
    const ev0 = run('(b) => billEvidence_(b)', bill);
    assert.strictEqual(mark, 'S:' + ev0.hash); assert.match(ev0.hash, /^[0-9a-f]{64}$/);
    assert.deepStrictEqual(ev0.rows.map(r => r.key), ['EVX-1|2026-05-01|Day', 'EVX-1|2026-05-01|Night', 'EVX-1|2026-05-02|Full Day']);
    assert.strictEqual(run('(b) => billEvidence_(b).hash', bill), ev0.hash, 'the same database → the same hash');
    const s1 = sub(bill);
    assert.ok(s1 && s1.ok, JSON.stringify(s1).slice(0, 400));
    const store = run('() => EV_STORE');
    assert.strictEqual(store.snap.length, 1); assert.strictEqual(store.rows.length, 3);
    assert.strictEqual(store.snap[0]['Bill ID'], s1.saved[0].id); assert.strictEqual(store.snap[0]['Snapshot SHA256'], ev0.hash); assert.strictEqual(store.snap[0]['Kind'], 'submission');
    assert.ok(store.rows.every(r => r['Row ID'] === s1.saved[0].id + '|' + r['Entry Key'] && /^[0-9a-f]{64}$/.test(r['Row SHA256'])));
    assert.match(store.rows[0]['Data'], /"ckm":1040/); assert.ok(!/"lk":/.test(store.rows.map(r => r['Data']).join('')), 'the on-screen lock mark is not part of the evidence');
    // 2. the saved bill's Log Book from its evidence, checked: every hash worked out again
    let e = run('id => getBillEvidence_({ id: id })', s1.saved[0].id);
    assert.strictEqual(e.kind, 'submission'); assert.strictEqual(e.count, 3); assert.strictEqual(e.check.ok, true); assert.strictEqual(e.check.billSame, true);
    assert.deepStrictEqual(e.rows.map(r => r.date + ' ' + r.shift + ' ' + r.ckm), ['2026-05-01 Day 1040', '2026-05-01 Night 1070', '2026-05-02 Full Day 1120']);
    assert.deepStrictEqual(e.machines.map(m => m.id), ['EVX-1']); assert.strictEqual(e.extra.idlePaid, true);
    // 3. the Super Admin corrects a billed entry afterwards: the live Log Book changes, the bill's evidence does not
    const k3 = run('() => { const lt = table_(APP.SHEET_LOG), c = lt.c; return logKeyOf_(lt, lt.rows.find(r => str_(r[c[H.NO]]) === "EVX-1" && dkey_(r[c[H.DATE]]) === "2026-05-02")); }');
    const upd = run('(k) => { ACTOR_SUPER_ = true; SA_REASON_ = "the meter photo shows 1125"; try { return updateLogRow_(k, { closingKm: 1125 }); } finally { ACTOR_SUPER_ = false; SA_REASON_ = ""; } }', k3);      // (update-152: with his reason)
    assert.ok(upd && !upd.THROWN, JSON.stringify(upd).slice(0, 300));
    assert.strictEqual(run('() => getLogBookList_({ from: "2026-05-02", to: "2026-05-02", no: "EVX-1", all: true }).rows[0].ckm'), 1125, 'the live entry is corrected');
    e = run('id => getBillEvidence_({ id: id })', s1.saved[0].id);
    assert.strictEqual(e.rows[2].ckm, 1120, 'the bill still shows the entry as billed'); assert.strictEqual(e.check.ok, true);
    // 4. evidence that was tampered with is found by the check (here the stand-in lets it happen; the database refuses it – rig test)
    run('() => { EV_STORE.rows[1]["Data"] = EV_STORE.rows[1]["Data"].replace(\'"ckm":1070\', \'"ckm":1099\'); }');
    e = run('id => getBillEvidence_({ id: id })', s1.saved[0].id);
    assert.strictEqual(e.check.ok, false); assert.deepStrictEqual(e.check.bad, ['EVX-1|2026-05-01|Night']);
    // 5. changed after Verify: nothing is submitted, "verify again"
    run('(x, m) => saveMaster_(x, m)', { no: 'EVX-2', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Ev Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add');
    run('(x, m) => saveBoq_(x, m)', { vendor: 'Ev Vendor', from: '2026-06-01', tdsPct: 2, woNo: 'WO-EV2', lines: [{ no: 'EVX-1', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add');
    assert.ok(log('2026-06-01', 'Full Day', 1200).ok);
    const june = run(`(a) => { const m = findMachine_('EVX-1'), from = '2026-06-01', to = '2026-06-30';
      const c = billMachineCalc_(m, getLogBookList_({ from: from, to: to, no: 'EVX-1', all: true }).rows, logPrintExtra_({ from: from, to: to, nos: ['EVX-1'] }), from, to, undefined, true);
      const A = r2_(c.amount), D = r2_(A - r2_(c.excessAmt)), H2 = D > 0 ? r2_(D * c.tdsPct / 100) : 0;
      return { company: a, vendor: { name: 'Ev Vendor' }, from: from, to: to, billDate: to, billNo: '152', picked: ['EVX-1'], partial: false, edited: false, idlePaid: true,
        machines: [{ no: 'EVX-1', workDays: c.workDays, nights: c.nights, issued: c.issued, amount: c.amount, excessAmt: c.excessAmt, lines: [] }], A: A, B: r2_(c.excessAmt), C: 0, D: D, E: 0, F: 0, G: D, H: H2, I: r2_(D - H2), gstPct: c.gstPct, tdsPct: c.tdsPct }; }`, co);
    assert.ok(run('b => verifyBills_({ bills: [b] })', june).ok);
    // after Verify an entry of the bill's machinery and dates is changed (its work text – the figures stay the same, so only the evidence tells)
    const k6 = run('() => { const lt = table_(APP.SHEET_LOG), c = lt.c; return logKeyOf_(lt, lt.rows.find(r => str_(r[c[H.NO]]) === "EVX-1" && dkey_(r[c[H.DATE]]) === "2026-06-01")); }');
    const u6 = run('(k) => updateLogRow_(k, { closingKm: 1200, work: "changed after verify" })', k6); assert.ok(u6 && !u6.THROWN, JSON.stringify(u6).slice(0, 400));
    const dbg = run('(b) => { const m = CacheService.getScriptCache().get(billVerifyKey_(b, { vendor: "Ev Vendor", company: b.company, from: b.from, to: b.to })); const e = billEvidence_(b); return { mark: m, now: e.hash, remark: e.rows.map(r => r.text).join(" ").indexOf("changed after verify") > -1 }; }', june);
    const s2 = sub(june);
    assert.strictEqual(s2.ok, false, JSON.stringify(dbg)); assert.match((s2.errors || []).join(' '), /^Ev Vendor: the Log Book of this bill changed after it was verified .* – verify the bill again \(Verify & Submit\)\.$/);
    assert.strictEqual(run('() => EV_STORE.snap.length'), 1, 'nothing written'); assert.strictEqual(run('() => getBills_({}).bills.filter(b => b.billNo === "152").length'), 0, 'no bill');
    // verified again: submitted, with the remark in its evidence
    assert.ok(run('b => verifyBills_({ bills: [b] })', june).ok);
    // (a bill removed earlier left its evidence under BILL-00050: that ID is never given again – the next is BILL-00051)
    vm.runInContext('var __sbF0 = sbFetch_; sbFetch_ = (m, u) => /bill_snapshots\\?select=id&order=id\\.desc&limit=1$/.test(u) ? [{ id: "BILL-00050" }] : __sbF0(m, u);', ctx);
    let s3; try { s3 = sub(june); } finally { vm.runInContext('sbFetch_ = __sbF0;', ctx); }
    assert.ok(s3 && s3.ok, JSON.stringify(s3).slice(0, 300)); assert.strictEqual(s3.saved[0].id, 'BILL-00051');
    assert.match(run('id => getBillEvidence_({ id: id }).rows[0].work', s3.saved[0].id), /changed after verify/);
    // 6. before step 1zc (no evidence tables): bills are verified and submitted as before, without evidence
    vm.runInContext('evReady_ = () => false;', ctx);
    run('(x, m) => saveBoq_(x, m)', { vendor: 'Ev Vendor', from: '2026-07-01', tdsPct: 2, woNo: 'WO-EV3', lines: [{ no: 'EVX-1', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add');
    assert.ok(log('2026-07-01', 'Full Day', 1300).ok);
    const july = Object.assign(JSON.parse(JSON.stringify(june)), { from: '2026-07-01', to: '2026-07-31', billDate: '2026-07-31', billNo: '153' });
    const jc = run(`() => { const m = findMachine_('EVX-1'), c = billMachineCalc_(m, getLogBookList_({ from: '2026-07-01', to: '2026-07-31', no: 'EVX-1', all: true }).rows, logPrintExtra_({ from: '2026-07-01', to: '2026-07-31', nos: ['EVX-1'] }), '2026-07-01', '2026-07-31', undefined, true); return c; }`);
    july.machines = [{ no: 'EVX-1', workDays: jc.workDays, nights: jc.nights, issued: jc.issued, amount: jc.amount, excessAmt: jc.excessAmt, lines: [] }];
    july.A = jc.amount; july.B = jc.excessAmt; july.D = Math.round((jc.amount - jc.excessAmt) * 100) / 100; july.G = july.D; july.H = Math.round(july.D * jc.tdsPct) / 100; july.I = Math.round((july.D - july.H) * 100) / 100;
    const vj = run('b => verifyBills_({ bills: [b] })', july); assert.ok(vj.ok, JSON.stringify(vj).slice(0, 500));
    assert.ok(!vj.bills[0].checks.some(c => /Log Book evidence/.test(c.t)));
    const s4 = sub(july); assert.ok(s4 && s4.ok, JSON.stringify(s4).slice(0, 300)); assert.strictEqual(run('() => EV_STORE.snap.length'), 2, 'no evidence without its tables');
    assert.strictEqual(run('id => getBillEvidence_({ id: id }).kind', s4.saved[0].id), 'off');
  } finally { vm.runInContext('evReady_ = __evReady0; evAppend_ = __evAppend0; evRead_ = __evRead0;', ctx); }
});

test('update-152: an approved or billed Log Book entry is locked – only the Super Admin changes it, with his reason; a bill is deleted / revised only by him, kept as Deleted, still locking', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // a database for this test (as update-114's): what a save writes stays; a save that is refused – or only checked – leaves nothing.
  // The guard runs first, as in the real write; the database here "has" every column of step 1zd (dbCols).
  vm.runInContext(`globalThis.__k152 = { flush: SbBook_.prototype.flush, loadMany: SbBook_.prototype.loadMany, load_: SbSheet_.prototype.load_, discard: sbDiscard_, push: rtcPush_ };
    globalThis.DB152 = {};
    globalThis.__fill152 = s => { const d = DB152[s.def.table]; s.data = d ? d.data.map(r => r.slice()) : []; s.ids = d ? d.ids.slice() : []; s.appended.forEach(r => { s.data.push(r); s.ids.push(null); }); s.appended = []; s.loaded = true; s.dbCols = s.def.cols.map(c => c[1]); };
    globalThis.__keep152 = b => Object.keys(b.sheets).forEach(t => { const s = b.sheets[t]; if (!s.loaded && s.appended.length) __fill152(s); if (s.loaded) DB152[t] = { data: s.data.map(r => r.slice()), ids: s.ids.slice() }; });
    if (SB_BOOK_) __keep152(SB_BOOK_);
    SbBook_.prototype.flush = function () { entryGuard_(this); __keep152(this); Object.keys(this.sheets).forEach(t => this.sheets[t].saved()); };
    SbBook_.prototype.loadMany = function (tables) { tables.forEach(t => { const s = this.sheets[t] || (this.sheets[t] = new SbSheet_(this, SB_TABLES_.find(d => d.table === t))); if (!s.loaded) __fill152(s); }); };
    SbSheet_.prototype.load_ = function () { if (!this.loaded) __fill152(this); };
    sbDiscard_ = function () { SB_BOOK_ = null; };
    rtcPush_ = function () {};`, ctx);
  try {
    const PW = 'sha256$0123456789abcdef$' + 'b'.repeat(64);
    const users = run(`pw => { const p = a => { const o = {}; MODULES.forEach(m => { o[m] = a ? 'Edit' : 'None'; }); return o; };
      const mk = (email, name, admin, extra) => ({ email: email, name: name, password: pw, active: true, admin: admin, perms: Object.assign(p(admin), extra || {}) });
      return [mk('lb152@rcl.test', 'Log User', false, { 'Log Book': 'Edit', 'Diesel Issue': 'Edit', 'Diesel Inward': 'Edit', 'Machinery Billing': 'Edit', 'Saved Bills': 'Edit' }), mk('ck152@rcl.test', 'Checker C', false, { 'Log Book': 'View' }),
        mk('ad152@rcl.test', 'Admin A', true), mk('sa152@rcl.test', 'Super S', true)]; }`, PW);
    run('l => { CacheService.getScriptCache().put("USERS_LIST", JSON.stringify(l), 3600); }', users);
    const tok = {}; users.forEach((u, i) => { tok[u.email] = 'tok152_' + i; run('(t, e, pw, s) => CacheService.getScriptCache().put("S_" + t, sessionMake_(e, pw, 3600000, s), 3600)', tok[u.email], u.email, PW, u.email === 'sa152@rcl.test'); });
    const api = (who, fn, ...a) => run('(t, f, a) => api(t, f, a)', tok[who], fn, a);
    const apiR = (who, reason, fn, ...a) => run('(t, f, a, m) => api(t, f, a, m)', tok[who], fn, a, { reason: reason });
    const U = 'lb152@rcl.test', CK = 'ck152@rcl.test', AD = 'ad152@rcl.test', SA = 'sa152@rcl.test';
    assert.ok(api(AD, 'saveVendor', { name: 'AP152 Vendor', gstReg: 'No', pan: 'ABCPA1152A', bank: 'SBI', account: '15215215', ifsc: 'SBIN0000152' }, 'add').ok);
    assert.ok(api(AD, 'saveMaster', { no: 'AP152-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'AP152 Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add').ok);
    assert.ok(api(AD, 'saveBoq', { vendor: 'AP152 Vendor', from: '2026-01-01', tdsPct: 2, woNo: 'WO-152', lines: [{ no: 'AP152-1', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add').ok);
    const row = r => run('k => { const lt = table_(APP.SHEET_LOG), c = lt.c, i = lt.rows.findIndex(x => logKeyOf_(lt, x) === k); return i < 0 ? null : logRowOut_(lt, lt.rows[i]); }', r);
    const K = (d, sh) => 'AP152-1|' + d + '|' + (sh || 'Full Day');
    const lr = (d, close, ex) => ({ rows: [Object.assign({ date: d, shift: 'Full Day', no: 'AP152-1', mode: 'KM', closingKm: close, work: 'Carting' }, ex || {})] });
    // ---------- 1. under a verification rule: sent, approved – saved AND marked approved ----------
    const fr = api(SA, 'saveFlowRules', { tasks: { 'Log Book': { on: true, levels: [[CK]] } } }); assert.ok(fr.ok, JSON.stringify(fr).slice(0, 300));
    const sent1 = api(U, 'saveLogRows', lr('2026-05-01', 1040, { openingKm: 1000 }));
    assert.match(sent1.THROWN || JSON.stringify(sent1), /^Sent for verification to Checker C – VF-00001\./);
    assert.strictEqual(row(K('2026-05-01')), null, 'not saved yet');
    let r = api(CK, 'decideChangeRequest', { id: 'VF-00001', approve: true });
    assert.ok(r.ok && r.status === 'Approved', JSON.stringify(r).slice(0, 300));
    let e = row(K('2026-05-01'));
    assert.ok(e && e.ckm === 1040 && e.ap && e.ap.by === 'Checker C' && e.ap.ref === 'VF-00001' && /^\d{4}-\d{2}-\d{2}T/.test(e.ap.at), 'saved and marked: ' + JSON.stringify(e && e.ap));
    assert.deepStrictEqual(run('() => getLogBookList_({ from: "2026-05-01", to: "2026-05-31", no: "AP152-1", all: true }).rows.map(x => !!x.ap)'), [true], 'the lists say so');
    // a change of the approved entry, sent under the rule: refused already when it is sent (nothing waits)
    const msgA = /^Log Book entry of AP152-1 on 01-05-2026: it was approved on \d\d-\d\d-\d{4} by Checker C \(VF-00001\) – an approved entry cannot be changed or deleted without the Super Admin\. To correct it: change the entry and send it to the Super Admin for approval \(the page asks\) – it is saved only when he approves\.$/;
    assert.match(api(U, 'updateLogRow', K('2026-05-01'), { closingKm: 1045, work: 'Carting' }).THROWN, msgA);
    assert.strictEqual(run('() => flowAll_().filter(r => r.status === "Pending").length'), 0, 'nothing was sent');
    // ---------- 2. without the rule: the approved entry is still locked for everyone but the Super Admin ----------
    assert.ok(api(SA, 'saveFlowRules', { tasks: {} }).ok);
    const before = JSON.stringify(row(K('2026-05-01')));
    assert.match(api(U, 'updateLogRow', K('2026-05-01'), { closingKm: 1045, work: 'Carting' }).THROWN, msgA, 'a change');
    assert.match(api(U, 'deleteLogRow', K('2026-05-01')).THROWN, msgA, 'a delete');
    assert.match(api(AD, 'updateLogRow', K('2026-05-01'), { closingKm: 1045, work: 'Carting' }).THROWN, msgA, 'the Admin too');
    assert.strictEqual(JSON.stringify(row(K('2026-05-01'))), before, 'nothing changed');
    // a new entry after it (not approved – its Start follows the approved Close, which is not changed): saved, not marked
    r = api(U, 'saveLogRows', lr('2026-05-02', 1080)); assert.ok(r.ok, JSON.stringify(r).slice(0, 300));
    assert.ok(row(K('2026-05-02')) && !row(K('2026-05-02')).ap, 'not approved');
    assert.ok(api(U, 'updateLogRow', K('2026-05-02'), { closingKm: 1090, work: 'Carting more' }).ok, 'an entry that is not approved is changed as before');
    // diesel issued on the approved day: allowed (the diesel it puts into the entry is not what was approved)
    assert.ok(api(U, 'saveInward', { date: '2026-05-01', location: 'Dispenser', pump: 'Pump', qty: 500, rate: 92, billNo: 'IN152', billDate: '2026-05-01' }).ok);
    r = api(U, 'saveDieselIssue', { date: '2026-05-01', shift: 'Day', source: 'Dispenser', no: 'AP152-1', qty: 10, kmReading: 1040, force: true });
    assert.ok(r && !r.THROWN, 'diesel on the approved day: ' + JSON.stringify(r).slice(0, 300));
    assert.strictEqual(row(K('2026-05-01')).qty, 10); assert.ok(row(K('2026-05-01')).ap, 'still approved');
    // ---------- 3. the Super Admin: with his reason only ----------
    assert.match(api(SA, 'updateLogRow', K('2026-05-01'), { closingKm: 1042, work: 'Carting' }).THROWN, /^SA_REASON: Super Admin – this save changes 1 locked Log Book entry \(AP152-1 01-05-2026 – changed, approved\)\. Give the reason: it is kept with the entry's history\.$/);
    r = apiR(SA, 'Close KM typed wrong – the meter photo shows 1042', 'updateLogRow', K('2026-05-01'), { closingKm: 1042, work: 'Carting' });
    assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
    assert.ok(row(K('2026-05-01')).ckm === 1042 && row(K('2026-05-01')).ap.ref === 'VF-00001', 'saved; still approved (the mark stays)');
    assert.deepStrictEqual(run('() => { ACTOR_ = "Super S"; ACTOR_SUPER_ = true; SA_REASON_ = "why"; CUR_FN_ = "updateLogRow"; try { return saveCtx_(); } finally { ACTOR_SUPER_ = false; SA_REASON_ = ""; CUR_FN_ = ""; } }'),
      { actor: 'Super S', super: true, reason: 'why', fn: 'updateLogRow', flow: '', ctx: '', op: '' }, 'what goes to the database with the save');
    // ---------- 4. a machinery number changed in Asset Master: its approved entries follow (only the number) ----------
    const m = run('() => findMachine_("AP152-1")');
    r = api(AD, 'saveMaster', Object.assign({}, m, { no: 'AP152-9' }), 'edit', 'AP152-1'); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
    assert.ok(row('AP152-9|2026-05-01|Full Day') && row('AP152-9|2026-05-01|Full Day').ap && !row(K('2026-05-01')), 'moved with its mark');
    // (update-156: the machinery as it is now – its version after the first change; the old one would be refused, as any stale edit)
    r = api(AD, 'saveMaster', Object.assign({}, run('() => findMachine_("AP152-9")'), { no: 'AP152-1' }), 'edit', 'AP152-9'); assert.ok(r && r.ok, 'and back: ' + JSON.stringify(r).slice(0, 300));
    // ---------- 5. bills: revise / delete only by the Super Admin; a Superseded or Deleted bill still locks ----------
    const co = run('() => billCompanies_()')[0];
    const mk = no => run(`(a) => { const m = findMachine_('AP152-1'), from = '2026-05-01', to = '2026-05-31';
      const c = billMachineCalc_(m, getLogBookList_({ from: from, to: to, no: 'AP152-1', all: true }).rows, logPrintExtra_({ from: from, to: to, nos: ['AP152-1'] }), from, to, undefined, true);
      const A = r2_(c.amount), B = r2_(c.excessAmt), D = r2_(A - B), H2 = D > 0 ? r2_(D * c.tdsPct / 100) : 0;
      return { company: a[1], vendor: { name: 'AP152 Vendor' }, from: from, to: to, billDate: to, billNo: a[0], picked: ['AP152-1'], partial: false, edited: false, idlePaid: true,
        machines: [{ no: 'AP152-1', workDays: c.workDays, nights: c.nights, issued: c.issued, amount: c.amount, excessAmt: c.excessAmt, lines: [] }], A: A, B: B, C: 0, D: D, E: 0, F: 0, G: D, H: H2, I: r2_(D - H2), gstPct: c.gstPct, tdsPct: c.tdsPct }; }`, [no, co]);
    const pack = (b, confirm) => ({ bills: [{ vendor: 'AP152 Vendor', company: co, billNo: b.billNo, from: b.from, to: b.to, billDate: b.billDate, net: b.I, data: b }], confirm: confirm });
    let bill = mk('521');
    assert.ok(api(U, 'verifyBills', { bills: [bill] }).ok);
    const s1 = api(U, 'submitBills', pack(bill)); assert.ok(s1 && s1.ok, 'the Billing user submits a new bill: ' + JSON.stringify(s1).slice(0, 300));
    // the same vendor and period again: a revision – the Billing user cannot
    const v2 = api(U, 'verifyBills', { bills: [bill] });
    assert.ok((((v2.bills || [])[0] || {}).checks || []).some(c => c.s === 'bad' && /^A bill of this vendor for the same period and machinery is already submitted \(RA Bill 521\) – only the Super Admin can revise a submitted bill/.test(c.t)), JSON.stringify(v2).slice(0, 500));
    r = api(U, 'submitBills', pack(bill, true));
    assert.ok(r.ok === false && /^AP152 Vendor: a bill of this vendor for the same period and machinery is already submitted \(RA Bill 521\) – only the Super Admin can revise/.test((r.errors || []).join(' ')), JSON.stringify(r).slice(0, 400));
    assert.strictEqual(run('() => getBills_({ vendor: "AP152 Vendor" }).bills.length'), 1, 'nothing saved');
    // the Super Admin revises it: the first is Superseded – and still locks
    assert.ok(api(SA, 'verifyBills', { bills: [bill] }).ok);
    r = api(SA, 'submitBills', pack(bill, true)); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
    assert.deepStrictEqual(run('() => getBills_({ vendor: "AP152 Vendor" }).bills.map(b => b.rev + " " + b.status).sort()'), ['0 Superseded', '1 Active']);
    const msgB = /^Log Book entry of AP152-1 on 02-05-2026: this machinery is in the submitted RA Bill 521 rev 1 of AP152 Vendor/;
    assert.match(api(U, 'updateLogRow', K('2026-05-02'), { closingKm: 1095, work: 'Carting more' }).THROWN, msgB, 'billed: locked (it was not approved)');
    // deleted – by the Super Admin, with a reason: kept as Deleted; the entries stay locked (by the Superseded one and the Deleted one)
    const ids = run('() => getBills_({ vendor: "AP152 Vendor" }).bills.map(b => b.id + " " + b.status)');
    const activeId = ids.find(x => / Active$/.test(x)).split(' ')[0];
    assert.match(api(AD, 'deleteBill', activeId, 'wrong').THROWN, /^Only the Super Admin deletes a submitted bill/);
    r = api(SA, 'deleteBill', activeId, 'built on a wrong BOQ'); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
    assert.deepStrictEqual(run('() => getBills_({ vendor: "AP152 Vendor" }).bills.map(b => b.rev + " " + b.status + " " + (b.deleteReason || "")).sort()'), ['0 Superseded ', '1 Deleted built on a wrong BOQ']);
    assert.match(api(U, 'updateLogRow', K('2026-05-02'), { closingKm: 1095, work: 'Carting more' }).THROWN, /is in the submitted RA Bill 521 \((superseded|deleted)\) of AP152 Vendor .*\(a bill replaced or deleted keeps them locked\)/, 'never unlocked by itself');
    // the money: a deleted bill is in no list or ledger total (Active only, as before)
    assert.strictEqual(run('() => ledgerLines_().filter(l => l.vendor === "AP152 Vendor" && l.kind === "bill").length'), 0);
    // the user's correction goes to the Super Admin (Approvals), saved when he approves – with the request's reason kept
    const cr = api(U, 'sendChangeRequest', { fn: 'updateLogRow', args: [K('2026-05-02'), { closingKm: 1095, work: 'Carting more' }], reason: 'the meter shows 1095' });
    assert.ok(cr && cr.ok && /^CR-/.test(cr.id), JSON.stringify(cr).slice(0, 300));
    r = api(SA, 'decideChangeRequest', { id: cr.id, approve: true }); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 300));
    assert.strictEqual(row(K('2026-05-02')).ckm, 1095, 'saved at his approval');
  } finally {
    vm.runInContext('SbBook_.prototype.flush = __k152.flush; SbBook_.prototype.loadMany = __k152.loadMany; SbSheet_.prototype.load_ = __k152.load_; sbDiscard_ = __k152.discard; rtcPush_ = __k152.push; SB_BOOK_ = null;', ctx);
  }
});

test('update-153: attachments of a Log Book entry – real file types only, kept once by fingerprint, only the sender\'s own (or another entry\'s), at most the site\'s number; Scan with Mobile – hashed one-time token, same person and site, 5 / 15 minutes', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm'), gas = require('../server/gas.js');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
  // a stand-in of the private file store (Supabase Storage): kept by name, never overwritten; signed links only for files it has
  const store = {}, calls = [];
  const resp = (c, t) => ({ getResponseCode: () => c, getContentText: () => t });
  const U0 = ctx.Utilities, F0 = ctx.UrlFetchApp;
  ctx.Utilities = gas.Utilities;
  ctx.UrlFetchApp = { fetch: (url, o) => { calls.push({ url, o });
    const up = /\/storage\/v1\/object\/erp-files\/(.+)$/.exec(url), sign = /\/storage\/v1\/object\/sign\/erp-files$/.test(url);
    if (up) { if (o.headers['x-upsert'] !== 'false') return resp(400, 'upsert not allowed in this test'); if (store[up[1]]) return resp(400, '{"statusCode":"409","error":"Duplicate","message":"The resource already exists"}');
      store[up[1]] = Buffer.from(o.payload.getBytes().map(b => (b + 256) % 256)); return resp(200, '{"Key":"erp-files/' + up[1] + '"}'); }
    if (sign) return resp(200, JSON.stringify(JSON.parse(o.payload).paths.map(p => store[p] ? { path: p, signedURL: '/object/sign/erp-files/' + p + '?token=t' } : { path: p, error: 'not found', signedURL: null })));
    throw new Error('no network'); } };
  vm.runInContext('globalThis.__k153 = { ready: attReady_, conf: sbConf_ }; attReady_ = function () {}; sbConf_ = function () { return { url: "https://store.test", key: "unit-test" }; };', ctx);
  const jpg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('a photo of the meter 1125')]);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from('png bytes')]);
  const url = (mime, b) => 'data:' + mime + ';base64,' + b.toString('base64');
  const shaOf = b => crypto.createHash('sha256').update(b).digest('hex');
  const me = { email: 'Op153@rcl.test', name: 'Operator', perms: { 'Log Book': 'Edit' } }, other = { email: 'xx153@rcl.test', name: 'Other', perms: { 'Log Book': 'Edit' } }, viewer = { email: 'v153@rcl.test', name: 'V', perms: { 'Log Book': 'View' } };
  const up = (u, mime, b, name) => run('(u, x) => uploadAttachment_(u, x)', u, { data: url(mime, b), name: name || 'file' });
  try {
    // ---- what a file really is: its first bytes (a web page cannot be sent as a "photo") ----
    assert.strictEqual(run('b => attSniff_(b)', [...jpg]), 'image/jpeg'); assert.strictEqual(run('b => attSniff_(b)', [...png]), 'image/png'); assert.strictEqual(run('b => attSniff_(b)', [...pdf]), 'application/pdf');
    assert.strictEqual(run('b => attSniff_(b)', [...Buffer.from('<html><script>')]), '');
    assert.match(up(me, 'image/jpeg', Buffer.from('<html><script>alert(1)</script>')).THROWN, /^This file is not what its name says \(image\/jpeg\)/);
    assert.match(up(me, 'image/jpeg', pdf).THROWN, /not what its name says/, 'a PDF called a photo');
    assert.match(run('(u, x) => uploadAttachment_(u, x)', me, { data: 'data:text/html;base64,PGh0bWw+' }).THROWN, /^An attachment must be a photo \(JPG or PNG\) or a PDF\.$/);
    assert.match(run('(u, x) => uploadAttachment_(u, x)', me, { data: url('application/pdf', Buffer.alloc(3 * 1024 * 1024 + 10, 0x25)) }).THROWN, /^This file is too big \(more than 3 MB\)/);
    assert.match(up(viewer, 'image/jpeg', jpg).THROWN, /View access only for Log Book/);
    assert.strictEqual(calls.length, 0, 'nothing refused reached the store');
    // ---- kept once, under its fingerprint ----
    const a = up(me, 'image/jpeg', jpg, 'meter.jpg');
    assert.deepStrictEqual([a.ok, a.sha, a.path, a.mime, a.size, a.dup], [true, shaOf(jpg), 'log/' + shaOf(jpg).slice(0, 2) + '/' + shaOf(jpg) + '.jpg', 'image/jpeg', jpg.length, false]);
    assert.ok(store[a.path].equals(jpg), 'the store has exactly the bytes sent');
    const a2 = up(other, 'image/jpeg', jpg, 'same.jpg');
    assert.deepStrictEqual([a2.sha, a2.dup], [a.sha, true], 'the same file again (anybody): the same object – not stored twice, not overwritten');
    assert.strictEqual(Object.keys(store).length, 1);
    const p = up(me, 'application/pdf', pdf, 'challan.pdf'); assert.match(p.path, /^log\/[0-9a-f]{2}\/[0-9a-f]{64}\.pdf$/);
    const g = up(me, 'image/png', png, 'screenshot.png'); assert.match(g.path, /\.png$/);
    const rec = run('h => JSON.parse(CacheService.getScriptCache().get("AT_" + h))', p.sha);
    assert.deepStrictEqual([rec.e, rec.mime, rec.name], ['op153@rcl.test', 'application/pdf', 'challan.pdf'], 'the server noted who sent it (6 hours)');
    // ---- the list an entry is to have ----
    const lt = { c: { Attachments: 0 }, rows: [[JSON.stringify([{ sha: g.sha, p: g.path, mime: 'image/png', size: 9, name: 'kept', at: 'x', by: 'Someone' }])]] };
    const of = (list, u, had, lt0) => run('(l, u, h, lt) => { OUT_FOR_ = u; try { return attOf_(l, h, lt); } finally { OUT_FOR_ = null; } }', list, u, had, lt0 || { c: {}, rows: [] });
    assert.strictEqual(of(undefined, me, []), null, 'not given: the entry keeps what it has');
    assert.deepStrictEqual(of([], me, [{ sha: a.sha }]), [], 'an empty list: none');
    const mine = of([{ sha: a.sha }, p.sha], me, []); assert.ok(Array.isArray(mine), JSON.stringify(mine));
    assert.deepStrictEqual(mine.map(x => [x.p, x.mime, x.by]), [[a.path, 'image/jpeg', 'Operator'], [p.path, 'application/pdf', 'Operator']], 'his own files, as the server noted them');
    assert.deepStrictEqual(of([{ sha: a.sha }], other, []).map(x => x.by), ['Other'], 'the same file sent by the other person too: his own as well');
    const lone = up(me, 'image/jpeg', Buffer.concat([jpg, Buffer.from('2')]));
    assert.match(of([{ sha: lone.sha }], other, []).THROWN, /^A file was not added by you in the last 6 hours/, 'another person\'s file (not with an entry)');
    assert.match(of([{ sha: 'f'.repeat(64) }], me, []).THROWN, /was not added by you/, 'never sent');
    assert.deepStrictEqual(of([{ sha: g.sha }], other, [], lt).map(x => [x.p, x.name, x.by]), [[g.path, 'kept', 'Someone']], 'kept with another entry: one photo for two shifts');
    assert.deepStrictEqual(of([{ sha: 'e'.repeat(64) }], other, [{ sha: 'e'.repeat(64), p: 'log/ee/' + 'e'.repeat(64) + '.jpg', mime: 'image/jpeg', size: 1, name: 'n', at: 'a', by: 'b' }]).length, 1, 'an edit: a file the entry has stays (whoever edits)');
    assert.match(of([{ sha: a.sha }, { sha: a.sha }], me, []).THROWN, /^The same file is attached twice/);
    assert.match(of([{ sha: '../../x' }], me, []).THROWN, /^An attachment was not sent right/);
    assert.match(of('x', me, []).THROWN, /^The attachments were not sent right/);
    assert.match(of(Array.from({ length: 11 }, (_, i) => ({ sha: String(i).padStart(64, 'a') })), me, []).THROWN, /^A Log Book entry keeps at most 10 attachments/);
    // the list kept with an entry: only names of the folder log/ with a fingerprint
    assert.strictEqual(run('v => attList_(v).length', JSON.stringify([{ sha: a.sha, p: a.path }, { sha: a.sha, p: '../../etc/passwd' }, { sha: 'x', p: a.path }, null])), 1);
    assert.strictEqual(run('v => attList_(v).length', 'not a list'), 0);
    // ---- in a save: the entry, then its files – all or nothing ----
    run('(x, m) => saveMaster_(x, m)', { no: 'AT-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'At Co', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
    const save = (rows, u) => run('(b, u) => { OUT_FOR_ = u; try { return saveLogRowsA_(b); } finally { OUT_FOR_ = null; } }', { rows: rows }, u);
    const s1 = save([{ date: '2026-08-01', shift: 'Day', no: 'AT-1', mode: 'KM', openingKm: 100, closingKm: 150, attachments: [{ sha: a.sha }, { sha: p.sha }] }], me);
    assert.ok(s1.ok !== false && !(s1.errors || []).length, JSON.stringify(s1));
    const seen = run('k => getLogAttachments_({ key: k })', 'AT-1|2026-08-01|Day');
    assert.deepStrictEqual(seen.files.map(f => [f.sha, f.mime, !!f.url]), [[a.sha, 'image/jpeg', true], [p.sha, 'application/pdf', true]], 'kept with the entry, each with a 15-minute link');
    assert.strictEqual(seen.max, 10);
    // one photo for two shifts: the Night entry takes the Day's photo – the other person too (it is already with an entry)
    const s2 = save([{ date: '2026-08-01', shift: 'Night', no: 'AT-1', mode: 'KM', openingKm: 150, closingKm: 180, attachments: [{ sha: a.sha }] }], other);
    assert.ok(s2.ok !== false && !(s2.errors || []).length, JSON.stringify(s2));
    assert.deepStrictEqual(run('k => getLogAttachments_({ key: k }).files.map(f => f.p)', 'AT-1|2026-08-01|Night'), [a.path]);
    assert.strictEqual(Object.keys(store).length, 4, 'the store still has each file once');
    // refused: nothing of the save stays
    const s3 = save([{ date: '2026-08-02', shift: 'Day', no: 'AT-1', mode: 'KM', openingKm: 180, closingKm: 200, attachments: [{ sha: lone.sha }] }], other);
    assert.match(String(s3.THROWN), /was not added by you/);
    assert.strictEqual(run('() => getLogBookList_ ? 1 : 1'), 1);
    assert.match(String(run('k => getLogAttachments_({ key: k })', 'AT-1|2026-08-02|Day').THROWN), /./, 'the refused entry was not saved');
    // the same files on several entries in one save
    const ln = run('(x, u) => { OUT_FOR_ = u; try { return linkLogAttachments_(x); } finally { OUT_FOR_ = null; } }', { keys: ['AT-1|2026-08-01|Day', 'AT-1|2026-08-01|Night'], files: [g.sha] }, me);
    assert.deepStrictEqual(ln.entries.map(e => e.attachments.length), [3, 2], 'added to what each has');
    // an edit that changes only the attachments: a file taken out leaves the list only (the store keeps it)
    const ver = run('k => getLogEntry_(k)', 'AT-1|2026-08-01|Night');
    const ed = run('(k, l, u) => { OUT_FOR_ = u; try { return updateLogRowA_(k, l); } finally { OUT_FOR_ = null; } }', 'AT-1|2026-08-01|Night', { ver: ver && ver.ver, attachments: [{ sha: g.sha }] }, me);
    assert.ok(ed.ok !== false, JSON.stringify(ed));
    assert.deepStrictEqual(run('k => getLogAttachments_({ key: k }).files.map(f => f.sha)', 'AT-1|2026-08-01|Night'), [g.sha]);
    assert.ok(store[a.path], 'nothing is deleted from the store');
    // two people at the same entry: the second edit (opened before the first was saved) is refused – nothing lost
    const ed2 = run('(k, l, u) => { OUT_FOR_ = u; try { return updateLogRowA_(k, l); } finally { OUT_FOR_ = null; } }', 'AT-1|2026-08-01|Night', { ver: ver && ver.ver, attWas: [a.sha], attachments: [{ sha: a.sha }, { sha: p.sha }] }, me);
    assert.match(String(ed2.THROWN), /^The attachments of this entry were changed by someone else after you opened it/);
    assert.deepStrictEqual(run('k => getLogAttachments_({ key: k }).files.map(f => f.sha)', 'AT-1|2026-08-01|Night'), [g.sha], 'unchanged');
    const ed3 = run('(k, l, u) => { OUT_FOR_ = u; try { return updateLogRowA_(k, l); } finally { OUT_FOR_ = null; } }', 'AT-1|2026-08-01|Night', { ver: ver && ver.ver, attWas: [g.sha], attachments: [{ sha: g.sha }, { sha: p.sha }] }, me);
    assert.deepStrictEqual(ed3.attachments.map(f => f.sha), [g.sha, p.sha], 'opened as it is now: saved');
    // a row of the entry page that joins an entry already saved: its files are ADDED to what the entry has
    assert.deepStrictEqual(run('(k, l, u) => { OUT_FOR_ = u; try { return withLock_(() => attSet_(k, l, "add")).map(f => f.sha); } finally { OUT_FOR_ = null; } }', 'AT-1|2026-08-01|Night', [{ sha: a.sha }, { sha: g.sha }], me), [g.sha, p.sha, a.sha]);
    // ---- Scan with Mobile ----
    const st = run('(u, x) => capStart_(u, x)', me, { key: 'AT-1|2026-08-01|Day', label: 'AT-1 · 01-08-2026 · Day' });
    assert.match(st.id, /^[0-9a-f]{32}$/); assert.match(st.token, /^[0-9a-f]{64}$/); assert.strictEqual(st.code, st.id + '.' + st.token);
    const kept = run('id => CacheService.getScriptCache().get("CAP_" + id)', st.id);
    assert.ok(!kept.includes(st.token), 'the server keeps only the token\'s fingerprint');
    assert.strictEqual(JSON.parse(kept).th, crypto.createHash('sha256').update(st.token).digest('hex'));
    const st2 = run('(u, x) => capStart_(u, x)', me, { key: 'K' }); assert.notStrictEqual(st2.token, st.token, 'a new token every time');
    assert.match(run('(u, x) => capStart_(u, x)', me, {}).THROWN, /^Scan with Mobile: open an entry/);
    assert.match(run('(u, x) => capStart_(u, x)', viewer, { key: 'K' }).THROWN, /View access only/);
    const claim = (u, code, phone) => run('(u, x) => capClaim_(u, x)', u, { code: code, phone: phone });
    assert.match(claim(me, st.id + '.' + 'a'.repeat(64), 'phone-0001').THROWN, /^This QR code is not valid/, 'a wrong token');
    assert.match(claim(me, 'b'.repeat(32) + '.' + st.token, 'phone-0001').THROWN, /^This QR code is not valid/, 'a made-up session');
    assert.match(claim(me, st.id, 'phone-0001').THROWN, /^This QR code is not valid/, 'no token');
    assert.match(claim(other, st.code, 'phone-0001').THROWN, /^This QR code was made by another person/, 'another person on the phone');
    ctx.__siteCode = () => 'ZZ'; try { assert.match(claim(me, st.code, 'phone-0001').THROWN, /^This QR code is for another site/); } finally { delete ctx.__siteCode; }
    // (update-160) the QR carries its site (…/scan?cap=…&site=…): capStart gives it; a phone at another site is told WHICH one (before:
    // "not valid" – the session is not found in another site's database)
    ctx.__siteCode = () => 'S1'; try {
      const sq = run('(u, x) => capStart_(u, x)', me, { key: 'KQ' });
      assert.strictEqual(sq.site, 'S1');
      assert.match(run('(u, x) => capClaim_(u, x)', me, { code: sq.code, phone: 'phone-0009', site: 'T2' }).THROWN, /^This QR code is for another site \(T2\) – open that site on the phone and scan it again\.$/);
      assert.strictEqual(run('(u, x) => capClaim_(u, x)', me, { code: sq.code, phone: 'phone-0009', site: 'S1' }).ok, true, 'its own site: fine');
      assert.strictEqual(run('(u, x) => capClaim_(u, x)', me, { code: sq.code, phone: 'phone-0009' }).ok, true, 'an older QR (no site in it): as before');
    } finally { delete ctx.__siteCode; }
    assert.match(claim(me, st.code, 'x').THROWN, /did not say who it is/);
    const c1 = claim(me, st.code, 'phone-0001'); assert.deepStrictEqual([c1.ok, c1.key, c1.max, c1.have], [true, 'AT-1|2026-08-01|Day', 10, 0]);
    assert.strictEqual(claim(me, st.code, 'phone-0001').ok, true, 'the same phone again (a retry): fine');
    assert.match(claim(me, st.code, 'phone-0002').THROWN, /^This QR code is already being used by another phone/, 'single use: a second phone');
    // the phone sends a photo (as any attachment), then tells the session
    const ph = up(me, 'image/jpeg', Buffer.concat([jpg, Buffer.from('from the phone')]), 'cam.jpg');
    const add = (u, sha, phone, code0) => run('(u, x) => capAdd_(u, x)', u, { code: code0 || st.code, phone: phone || 'phone-0001', sha: sha });
    assert.strictEqual(add(me, ph.sha).have, 1);
    assert.deepStrictEqual(add(me, ph.sha), { ok: true, have: 1, same: true }, 'the same photo twice: once');
    assert.match(add(me, lone.sha + 'x').THROWN, /was not sent from this phone/);
    assert.match(add(me, ph.sha, 'phone-0002').THROWN, /^Scan the QR code again – this phone does not hold it/);
    const otherPic = up(other, 'image/jpeg', Buffer.concat([jpg, Buffer.from('other')]));
    assert.match(add(other, otherPic.sha).THROWN, /made by another person/, 'injection: another person cannot add to it');
    // the computer asks: only its owner sees what came; each file once
    const poll = (u, have) => run('(u, x) => capPoll_(u, x)', u, { id: st.id, have: have || [] });
    const p1 = poll(me); assert.deepStrictEqual([p1.state, p1.count, p1.files.map(f => [f.sha, !!f.url])], ['claimed', 1, [[ph.sha, true]]]);
    assert.deepStrictEqual(poll(me, [ph.sha]).files, [], 'already shown: not sent again');
    assert.deepStrictEqual([poll(other).state, poll(other).files], ['gone', []], 'another person learns nothing');
    // nothing is linked by this: the files are with the entry only when it is saved
    assert.deepStrictEqual(run('k => getLogAttachments_({ key: k }).files.length', 'AT-1|2026-08-01|Day'), 3);
    // at most the site's number
    run('id => { const o = JSON.parse(CacheService.getScriptCache().get("CAP_" + id)); o.max = 1; CacheService.getScriptCache().put("CAP_" + id, JSON.stringify(o), 600); }', st.id);
    assert.match(add(me, a.sha).THROWN, /^At most 1 files for one entry/);
    run('id => { const o = JSON.parse(CacheService.getScriptCache().get("CAP_" + id)); o.max = 10; CacheService.getScriptCache().put("CAP_" + id, JSON.stringify(o), 600); }', st.id);
    assert.strictEqual(run('(u, x) => capAdd_(u, x)', me, { code: st.code, phone: 'phone-0001', shas: [a.sha, p.sha, ph.sha] }).have, 3, 'several in one call, each once');
    assert.match(run('(u, x) => capAdd_(u, x)', me, { code: st.code, phone: 'phone-0001', shas: [g.sha, otherPic.sha] }).THROWN, /was not sent from this phone/, 'one of them not his: none taken');
    assert.strictEqual(poll(me, [ph.sha]).count, 3);
    // cancel / done / a new QR: closed
    run('(u, x) => capCancel_(u, x)', other, { id: st.id }); assert.strictEqual(claim(me, st.code, 'phone-0001').ok, true, 'another person cannot close it');
    run('(u, x) => capCancel_(u, x)', me, { id: st.id });
    assert.match(claim(me, st.code, 'phone-0001').THROWN, /^This QR code was closed on the computer/);
    assert.match(add(me, ph.sha).THROWN, /closed on the computer/);
    const st3 = run('(u, x) => capStart_(u, x)', me, { key: 'K3' }), st4 = run('(u, x) => capStart_(u, x)', me, { key: 'K3', prev: st3.id });
    assert.match(claim(me, st3.code, 'phone-0003').THROWN, /closed on the computer/, 'a new QR ends the one before');
    assert.strictEqual(claim(me, st4.code, 'phone-0003').ok, true);
    // the times: unclaimed after 5 minutes, any after 15
    const age = (id, f) => run('(id, f) => { const o = JSON.parse(CacheService.getScriptCache().get("CAP_" + id)); o[f] = new Date(Date.now() - 1000).toISOString(); CacheService.getScriptCache().put("CAP_" + id, JSON.stringify(o), 600); }', id, f);
    const st5 = run('(u, x) => capStart_(u, x)', me, { key: 'K5' }); age(st5.id, 'claimBy');
    assert.match(claim(me, st5.code, 'phone-0005').THROWN, /^This QR code ran out \(5 minutes\)/);
    assert.strictEqual(run('(u, x) => capPoll_(u, x)', me, { id: st5.id }).state, 'expired');
    age(st4.id, 'ends'); assert.match(claim(me, st4.code, 'phone-0003').THROWN, /^This QR code ran out \(15 minutes\)/);
    assert.match(add(me, ph.sha, 'phone-0003', st4.code).THROWN, /ran out \(15 minutes\)/);
    assert.strictEqual(run('(u, x) => capPoll_(u, x)', me, { id: 'nonsense' }).state, 'gone');
    // ---- (security review) each side writes its own record: the phone's write landing just after the computer closed it does not open it again ----
    const st6 = run('(u, x) => capStart_(u, x)', me, { key: 'K6' });
    assert.strictEqual(claim(me, st6.code, 'phone-0006').ok, true);
    const o6 = run('id => capGet_(id)', st6.id);      // the phone read it (claimed) …
    run('(u, x) => capCancel_(u, x)', me, { id: st6.id });      // … the computer closes it …
    run('(id, o, h) => { o.files.push({ sha: h, at: "x" }); capFiles_(id, o); }', st6.id, o6, ph.sha);      // … and the phone's write lands after that
    assert.deepStrictEqual([run('id => capGet_(id).state', st6.id), run('id => capGet_(id).files.length', st6.id), run('(u, x) => capPoll_(u, x)', me, { id: st6.id }).state], ['cancelled', 1, 'cancelled'], 'closed stays closed');
    assert.ok(!/"state":"claimed"/.test(run('id => CacheService.getScriptCache().get("CAPX_" + id) || ""', st6.id)) && run('id => CacheService.getScriptCache().get("CAPX_" + id)', st6.id) === 'cancelled');
    // two phones at the same moment (both read it "waiting"): the database's counter lets only the first one hold it
    const cnt = {}; ctx.__count = k => (cnt[k] = (cnt[k] || 0) + 1);
    try {
      const st7 = run('(u, x) => capStart_(u, x)', me, { key: 'K7' });
      assert.strictEqual(claim(me, st7.code, 'phone-0007').ok, true);
      run('id => { const c = CacheService.getScriptCache(), o = JSON.parse(c.get("CAP_" + id)); o.state = "waiting"; delete o.phone; c.put("CAP_" + id, JSON.stringify(o), 600); }', st7.id);      // (as the second phone saw it)
      assert.match(claim(me, st7.code, 'phone-0008').THROWN, /^This QR code is already being used by another phone/);
      // at most 300 files and 150 MB one person sends in a day (a stolen sign-in cannot fill the store); the same file again uses no room
      const day = run('() => today_()'), kn = 'ATN_' + day + '_op153@rcl.test';
      cnt[kn] = 300;
      assert.match(up(me, 'image/jpeg', Buffer.concat([jpg, Buffer.from('301')])).THROWN, /^You sent too many attachments today \(at most 300 files, 150 MB a person in a day\) – send the rest tomorrow/);
      cnt[kn] = 0;
      run('k => CacheService.getScriptCache().put(k, String(150 * 1048576 - 10), 600)', 'ATB_' + day + '_op153@rcl.test');
      assert.match(up(me, 'image/jpeg', Buffer.concat([jpg, Buffer.from('a little more than 10 bytes')])).THROWN, /^You sent too many attachments today/);
      run('k => CacheService.getScriptCache().put(k, "0", 600)', 'ATB_' + day + '_op153@rcl.test');
      const big = up(me, 'image/jpeg', Buffer.concat([jpg, Buffer.from('counted')]));
      assert.strictEqual(run('k => Number(CacheService.getScriptCache().get(k))', 'ATB_' + day + '_op153@rcl.test'), big.size, 'the bytes kept are counted');
      assert.strictEqual(up(me, 'image/jpeg', Buffer.concat([jpg, Buffer.from('counted')])).dup, true);
      assert.strictEqual(run('k => Number(CacheService.getScriptCache().get(k))', 'ATB_' + day + '_op153@rcl.test'), big.size, 'the same file again: no room used, not counted');
    } finally { delete ctx.__count; }
    // ---- (security review) a change request's files: checked when it is ASKED and kept with it; its approval takes only those ----
    const night = 'AT-1|2026-08-01|Night', hadN = run('k => getLogAttachments_({ key: k }).files.map(f => f.sha)', night);
    const cr = run('(u, k, h) => crRequest_(u, { fn: "updateLogRow", args: [k, { ver: "x", attachments: [{ sha: h }] }], reason: "the right photo" })', me, night, g.sha);
    assert.ok(cr && cr.ok, JSON.stringify(cr));
    assert.match(cr.summary[0], new RegExp('^Change Log Book entry: AT-1 · 01-08-2026 · Night · Attachments ' + hadN.length + ' → 1 \\(' + (hadN.length - 1) + ' taken off\\)'), 'the Super Admin sees what it does to the files');
    const crRow = run('id => { const t = crTable_(false); return crOut_(t, t.rows.find(r => str_(r[t.c["Request ID"]]) === id), 0).data; }', cr.id);
    assert.deepStrictEqual(Object.keys(JSON.parse(crRow).att), [g.sha], 'its files, as checked now, kept with the request');
    assert.strictEqual(JSON.parse(crRow).att[g.sha].e, 'op153@rcl.test');
    assert.match(run('(u, k, h) => crRequest_(u, { fn: "updateLogRow", args: [k, { ver: "x", attachments: [{ sha: h }] }], reason: "not mine" })', other, night, lone.sha).THROWN, /^A file was not added by you in the last 6 hours/, 'another person\'s file: refused when it is asked');
    assert.match(run('(u, k) => crRequest_(u, { fn: "updateLogRow", args: [k, { ver: "x", attachments: [{ sha: "../x" }] }], reason: "x" })', me, night).THROWN, /^An attachment was not sent right/);
    // at the approval: a file of the store that is not the requester's (and not with an entry) is refused – unless the request kept its record
    const atAppr = (l, e, ca) => run('(l, e, ca) => { VER_CTX_ = "approve"; FLOW_SENDER_ = e; CR_ATT_ = ca; try { return attOf_(l, [], { c: {}, rows: [] }).map(x => x.sha); } finally { VER_CTX_ = ""; FLOW_SENDER_ = ""; CR_ATT_ = null; } }', l, e, ca);
    assert.match(atAppr([{ sha: lone.sha }], 'xx153@rcl.test', null).THROWN, /^A file was not added by you/, 'only being in the store is not enough');
    assert.deepStrictEqual(atAppr([{ sha: lone.sha }], 'xx153@rcl.test', { [lone.sha]: { e: 'xx153@rcl.test', es: ['xx153@rcl.test'], mime: 'image/jpeg', size: 1, name: 'n', at: 'a' } }), [lone.sha], 'the record kept with the request');
    assert.deepStrictEqual(run('(l, e) => { VER_CTX_ = "flow"; FLOW_SENDER_ = e; try { return attOf_(l, [], { c: {}, rows: [] }).map(x => x.sha); } finally { VER_CTX_ = ""; FLOW_SENDER_ = ""; } }', [{ sha: lone.sha }], 'xx153@rcl.test'), [lone.sha], 'a verification (checked when it was sent): the file in the store');
    // in words: the same files on several entries; a new row with its files
    assert.deepStrictEqual(run('a => crDescribe_("linkLogAttachments", a).lines', [{ keys: ['AT-1|2026-08-01|Day', 'AT-1|2026-08-01|Night'], files: [g.sha, p.sha] }]), ['Attach 2 files to: AT-1 · 01-08-2026 · Day', 'Attach 2 files to: AT-1 · 01-08-2026 · Night'], 'not "Delete"');
    assert.match(run('a => crDescribe_("saveLogRows", a).lines[0]', [{ rows: [{ date: '2026-08-03', shift: 'Day', no: 'AT-1', mode: 'KM', closingKm: 210, attachments: [{ sha: a.sha }] }] }]), /^Add: AT-1 · 03-08-2026 · Day – .*Close KM 210.* · 1 attachment$/);
  } finally { vm.runInContext('attReady_ = __k153.ready; sbConf_ = __k153.conf;', ctx); ctx.Utilities = U0; ctx.UrlFetchApp = F0; }
  // (security review) an attachment is not held by a verification (one file may be with several entries); a legacy bill's files only for who may see the Log Book;
  // the preview of a dropped file has the type its bytes say; the bucket is made private even if it was there before
  assert.strictEqual((code.match(/Object\.keys\(held\)\.filter\(p => !\/\^AT_\/\.test\(p\)\)/g) || []).length, 3);
  assert.match(code, /getBillAttachments: \{ m: 'Saved Bills', any: \['Saved Bills', 'Machinery Billing', 'Bill Summary', 'Vendor Ledger'\], withUser: true, f: \(u, f\) => getBillAttachments_\(f, u\) \}/);
  assert.match(code, /\(ev\.kind === 'legacy' \|\| ev\.kind === 'off'\) && \(!u \|\| seesAny_\(u, \['Log Book', 'Machinery Billing', 'Saved Bills'\]\)\)/);
  assert.match(fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), /it\.url = URL\.createObjectURL\(new Blob\(\[u8\], \{ type: k \}\)\)/);
  assert.match(fs.readFileSync(path.join(root, 'sql', 'supabase_step1ze_attachments.sql'), 'utf8'), /on conflict \(id\) do update set public = false;/);
  // ---- the actions and their access ----
  assert.match(code, /uploadAttachment: +\{ m: 'Log Book', withUser: true, f: \(u, x\) => uploadAttachment_\(u, x\) \}/);
  assert.match(code, /linkLogAttachments: \{ m: 'Log Book', edit: true, f: linkLogAttachments_, log: 'logAttach' \}/);
  assert.match(code, /saveLogRows: +\{ m: 'Log Book', edit: true, f: saveLogRowsA_, log: 'logrows' \}/);
  assert.match(code, /updateLogRow: +\{ m: 'Log Book', edit: true, f: updateLogRowA_, log: 'logEdit' \}/);
  for (const f of ['capStart', 'capClaim', 'capAdd', 'capPoll', 'capCancel']) assert.match(code, new RegExp(f + ': +\\{ m: \'Log Book\', withUser: true, f: \\(u, x\\) => ' + f + '_\\(u, x\\) \\}'));
  // the database step: it only ADDS (a column, a private bucket) and is listed word for word
  const sqlFile = fs.readFileSync(path.join(root, 'sql', 'supabase_step1ze_attachments.sql'), 'utf8');
  const listed = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1ze_attachments.sql');
  assert.ok(listed, 'in the Read Me'); assert.strictEqual(listed.sql.trim(), sqlFile.trim());
  assert.ok(!/\b(drop|delete|truncate|update)\b/i.test(sqlFile.replace(/--[^\n]*/g, '').replace(/on conflict[^;]*/gi, '')), 'only adds');
  assert.match(sqlFile, /values \('erp-files', 'erp-files', false,/, 'the bucket is private');
});

test('update-155: "the same as you have" / only what changed – the rebuilt answer is always exactly the server\'s answer of now', () => {
  const d = require('../server/delta.js');
  // 1. the pieces and the patch: hundreds of list changes (new row on top, a row changed, deleted, the order turned, many changed)
  const rows = n => Array.from({ length: n }, (_, i) => ({ id: 'D' + i, date: '2026-10-' + String(1 + i % 28).padStart(2, '0'), no: 'AU-' + (i % 60), qty: (i * 7) % 300, note: 'x'.repeat(i % 40) }));
  let t0 = JSON.stringify({ rows: rows(400), total: 400 }), small = 0;
  for (let k = 0; k < 250; k++) {
    const r = JSON.parse(t0), ch = k % 5;
    if (ch === 0) r.rows.unshift({ id: 'N' + k, date: '2026-10-24', no: 'AU-1', qty: k, note: 'new' });
    if (ch === 1) r.rows[k % r.rows.length].qty = 999 + k;
    if (ch === 2) r.rows.splice(k % r.rows.length, 1);
    if (ch === 3) r.rows.reverse();
    if (ch === 4) for (let q = 0; q < 20; q++) r.rows[(q * 37 + k) % r.rows.length].note = 'chg' + q;
    r.total = r.rows.length;
    const t1 = JSON.stringify(r), ops = d.diff(t0, t1);
    assert.strictEqual(d.rclPatch(t0, ops), t1, 'change ' + k);
    if (ch < 3 && JSON.stringify(ops).length < t1.length / 20) small++;
    if (ch === 4) assert.ok(JSON.stringify(ops).length < t1.length / 5, '20 rows changed: still a part of the list');
    t0 = t1;
  }
  assert.strictEqual(small, 150, 'a new, changed or deleted row sends a small part of the list (' + small + ' of 150)');
  // random text with the cut marks in it, and a bad patch is refused (never a half answer)
  for (let k = 0; k < 1500; k++) { const g = () => Array.from({ length: Math.floor(Math.random() * 60) }, () => '{}[],"ab'[Math.floor(Math.random() * 8)]).join(''); const a = g(), b = Math.random() < 0.5 ? a + g() : g() + a.slice(Math.floor(Math.random() * (a.length + 1))); assert.strictEqual(d.rclPatch(a, d.diff(a, b)), b); }
  assert.strictEqual(d.rclPatch('[{"a":1},{"b":2}]', [[5, 1]]), null);
  assert.strictEqual(d.rclPatch('[{"a":1},{"b":2}]', [[0, 0]]), null);
  assert.strictEqual(d.rclPatch('[{"a":1},{"b":2}]', 'x'), null);
  // 2. the answer: whole the first time; "same" for the same fingerprint; only the change when this server has the base
  d.clearKept();
  const list = n => JSON.stringify({ rows: rows(n) });
  const k1 = d.keyOf('vtr', 'api', ['tokA', 'getDieselIssues', {}]), k2 = d.keyOf('vtr', 'api', ['tokB', 'getDieselIssues', {}]), k3 = d.keyOf('18b', 'api', ['tokA', 'getDieselIssues', {}]);
  assert.ok(k1 !== k2 && k1 !== k3, 'one key per sign-in and per site');
  const a1 = d.answer(k1, list(300), '', true); assert.strictEqual(a1.kind, 'full'); const j1 = JSON.parse(a1.text); assert.deepStrictEqual(j1.result, JSON.parse(list(300)));
  const a2 = d.answer(k1, list(300), j1.h, true); assert.deepStrictEqual(JSON.parse(a2.text), { h: j1.h, same: 1 }); assert.ok(a2.text.length < 60);
  const a3 = d.answer(k1, list(301), j1.h, true), j3 = JSON.parse(a3.text); assert.strictEqual(a3.kind, 'delta'); assert.strictEqual(j3.base, j1.h);
  assert.strictEqual(d.rclPatch(list(300), j3.delta), list(301)); assert.strictEqual(d.hash(list(301)), j3.h); assert.ok(a3.text.length < list(301).length / 20);
  assert.strictEqual(d.answer(k1, list(302), j3.h, false).kind, 'full', 'a page that cannot check a rebuilt answer gets it whole');
  // another sign-in that sends someone else's fingerprint: never a delta from the other's answer; "same" only if its OWN answer is identical
  const b1 = d.answer(k2, list(10), d.hash(list(302)), true); assert.strictEqual(b1.kind, 'full'); assert.deepStrictEqual(JSON.parse(b1.text).result, JSON.parse(list(10)));
  assert.strictEqual(d.answer(k2, list(11), 'not-a-fingerprint', true).kind, 'full');
  assert.strictEqual(d.answer(k1, '[1]', JSON.parse(a1.text).h, true).kind, 'full', 'small answers are sent whole');
  // the memory has an end: the oldest answers go first; an answer above 2 million characters is not kept (it still gets "same")
  const big = JSON.stringify({ x: 'y'.repeat(2100000) }), hb = d.hash(big);
  d.answer('big', big, '', true); assert.strictEqual(d.answer('big', big, hb, true).kind, 'same'); assert.strictEqual(d.answer('big', big + ' ', hb, true).kind, 'full');
  d.clearKept(); assert.deepStrictEqual(d.kept(), { answers: 0, chars: 0 });
  // 3. the page and the server run the SAME two functions (one text, put into the page's bridge)
  const { shell } = require('../server/page.js');
  assert.ok(shell().indexOf(d.CLIENT) > -1, 'the bridge carries delta.CLIENT word for word');
  assert.ok(d.CLIENT.indexOf('\\') === -1 && d.CLIENT.indexOf('${') === -1, 'no character the page\'s template would change');
});

test('update-155: the page\'s bridge keeps answers in memory only, rebuilds them, checks them, and asks again on any doubt', async () => {
  const vm = require('vm'), d = require('../server/delta.js'), { shell } = require('../server/page.js');
  const html = shell(), i = html.indexOf('<script>'), bridge = html.slice(i + 8, html.indexOf('</script>', i));
  d.clearKept();
  // a stand-in for the server: works out the answer of NOW (state) and sends it the update-155 way when the page asks so
  const state = { list: JSON.stringify({ rows: Array.from({ length: 200 }, (_, k) => ({ id: k, qty: k * 3, no: 'AU-' + (k % 9) })) }), refuse: false, breakDelta: false };
  const sent = [], stored = {}; let calls = 0;
  const fetchStub = async (url, o) => { calls++; const b = JSON.parse(o.body); sent.push(b);
    let text;
    if (b.fn === 'logout') text = '{"result":true}';
    else if (state.refuse) text = JSON.stringify({ error: 'You do not have access to Diesel Issue.' });
    else if (b.m === 1) { const a = d.answer(d.keyOf(b.site || '', b.fn, b.args), state.list, b.have, b.dx === 1); text = a.text;
      if (state.breakDelta && a.kind === 'delta') { const j = JSON.parse(text); j.delta = j.delta.map(x => typeof x === 'string' ? x.replace(/\d/, '7') : x); text = JSON.stringify(j); } }
    else text = '{"result":' + state.list + '}';
    return { status: 200, text: async () => text }; };
  const store = { getItem: k => (k in stored ? stored[k] : null), setItem: (k, v) => { stored[k] = String(v); }, removeItem: k => { delete stored[k]; } };
  const win = { fetch: fetchStub, localStorage: store, sessionStorage: store, crypto: globalThis.crypto, TextEncoder, addEventListener() {}, location: { origin: 'http://x' }, setTimeout, clearTimeout, setInterval() {}, Promise, JSON, Map, Uint8Array, Math, Date, Error, Array, Object, String, Number, RegExp, Proxy };
  win.window = win; win.parent = win; win.document = { getElementById: () => null, addEventListener() {}, body: null, readyState: 'complete' };
  vm.createContext(win); vm.runInContext(bridge, win);
  const ask = () => new Promise((res, rej) => win.google.script.run.withSuccessHandler(res).withFailureHandler(rej).api('tokA', 'getDieselIssues', { from: '2026-10-01' }));
  const now = () => JSON.parse(state.list);
  assert.deepStrictEqual(await ask(), now()); assert.strictEqual(sent[0].m, 1); assert.ok(!('have' in sent[0]), 'the first time: no fingerprint, the whole answer');
  assert.deepStrictEqual(await ask(), now()); assert.ok(/^[0-9a-f]{32}$/.test(sent[1].have) && sent[1].dx === 1, 'asked again with the fingerprint it has');
  assert.strictEqual(win.__rclMemo().same, 1);
  for (let k = 0; k < 12; k++) { const o = now(); if (k % 3 === 0) o.rows.unshift({ id: 'n' + k, qty: k, no: 'AU-X' }); else if (k % 3 === 1) o.rows[k * 5].qty = -k; else o.rows.splice(k, 2); state.list = JSON.stringify(o);
    assert.deepStrictEqual(await ask(), o, 'change ' + k + ': the page has exactly the server\'s answer'); }
  assert.ok(win.__rclMemo().delta >= 12, 'only the changes travelled');
  // each asker gets its own copy (changing one never changes the kept answer)
  const x = await ask(); x.rows[0].qty = 'changed by the page'; assert.deepStrictEqual(await ask(), now());
  // a delta that does not rebuild the server's answer (fingerprint differs) → asked again for the whole answer: still exact
  const o2 = now(); o2.rows[3].qty = 12345; state.list = JSON.stringify(o2); state.breakDelta = true;
  const before = win.__rclMemo().mismatch; assert.deepStrictEqual(await ask(), o2); assert.strictEqual(win.__rclMemo().mismatch, before + 1); assert.ok(!('have' in sent[sent.length - 1]));
  state.breakDelta = false;
  // a refusal (access taken away) reaches the page as before and drops what was kept for that question
  state.refuse = true; await assert.rejects(ask(), /do not have access/); state.refuse = false;
  const n0 = sent.length; await ask(); assert.ok(!('have' in sent[n0]), 'after a refusal nothing kept is offered');
  // sign-out, another site: nothing kept is offered any more
  await ask(); assert.ok(win.__rclMemo().answers >= 1);
  await new Promise(r => win.google.script.run.withSuccessHandler(r).logout('tokA')); assert.strictEqual(win.__rclMemo().answers, 0);
  await ask(); stored.rcl_site = 'n2'; const n1 = sent.length; await ask(); assert.ok(!('have' in sent[n1]) && sent[n1].site === 'n2', 'another site: asked whole, with that site');
  // a save never goes this way: no fingerprint, no "m", its own number as before
  await new Promise(r => win.google.script.run.withSuccessHandler(r).withFailureHandler(r).api('tokA', 'saveDieselIssue', { qty: 1 }));
  const sv = sent[sent.length - 1]; assert.ok(!('m' in sv) && !('have' in sv) && /^s/.test(sv.rid));
  // nothing of the answers is in the browser's storage
  assert.ok(Object.keys(stored).every(k => k === 'rcl_site'), 'storage holds only the site: ' + Object.keys(stored).join(','));
});

test('update-155: /api/rpc answers "same" / delta only to a page that asks for it, never to a save; counts each action', () => {
  const { execFileSync } = require('child_process');
  const prog = `
    const path = require('path'), root = ${JSON.stringify(root)};
    const poolPath = require.resolve(path.join(root, 'server/pool.js'));
    let answer = JSON.stringify({ rows: Array.from({ length: 300 }, (_, k) => ({ id: k, v: 'r' + k })) });
    require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { call: async (fn, args, meta) => { meta.use = { db: 2, dbBytes: 900, cpu: 3 }; if (args[1] === 'boom') throw new Error('You do not have access to Diesel Issue.'); return answer; } } };
    process.env.RCL_USAGE = 'on';
    const rpc = require(path.join(root, 'api/rpc.js'));
    const call = (body, method, url) => new Promise(res => { const out = { headers: {} }; const r = { statusCode: 0, setHeader: (k, v) => { out.headers[k] = v; }, end: t => res({ code: r.statusCode, text: t }) };
      rpc({ method: method || 'POST', url: url || '/api/rpc', headers: { host: 'x' }, body: body }, r); });
    (async () => {
      const q = { fn: 'api', args: ['tk', 'getDieselIssues', {}], site: 'vtr' };
      const r0 = await call(q); const old = JSON.parse(r0.text);
      const r1 = await call(Object.assign({ m: 1 }, q)); const j1 = JSON.parse(r1.text);
      const r2 = await call(Object.assign({ m: 1, have: j1.h, dx: 1 }, q));
      answer = answer.replace('"r5"', '"CHANGED"');
      const r3 = await call(Object.assign({ m: 1, have: j1.h, dx: 1 }, q));
      const sv = await call({ fn: 'api', args: ['tk', 'saveDieselIssue', {}], rid: 's1', m: 1, have: j1.h, dx: 1, site: 'vtr' });
      const er = await call({ fn: 'api', args: ['tk', 'boom', {}], m: 1, site: 'vtr' });
      const u = await call(null, 'GET', '/api/rpc?usage=1');
      console.log(JSON.stringify({ old: Object.keys(old), j1: Object.keys(j1), r2: JSON.parse(r2.text), r3: Object.keys(JSON.parse(r3.text)), sv: Object.keys(JSON.parse(sv.text)), er: [er.code, JSON.parse(er.text)], usage: JSON.parse(u.text) }));
    })();`;
  const r = JSON.parse(execFileSync(process.execPath, ['-e', prog], { timeout: 30000 }).toString().trim().split('\n').pop());
  assert.deepStrictEqual(r.old, ['result'], 'a caller that does not ask (an older page, the phone app): { result } exactly as before');
  assert.deepStrictEqual(r.j1, ['h', 'result']);
  assert.deepStrictEqual(Object.keys(r.r2), ['h', 'same']);
  assert.deepStrictEqual(r.r3, ['h', 'base', 'delta']);
  assert.deepStrictEqual(r.sv, ['result'], 'a save (it carries its number) is always answered whole');
  assert.strictEqual(r.er[0], 403); assert.ok(/do not have access/.test(r.er[1].error));
  const g = r.usage.top.find(x => x.key === 'vtr|getDieselIssues');
  assert.ok(g && g.n === 4 && g.same === 1 && g.delta === 1 && g.db === 8 && g.dbBytes === 3600 && g.cpu === 12 && g.full > g.out, JSON.stringify(g));
  assert.ok(r.usage.top.find(x => x.key === 'vtr|boom' && x.err === 1) && r.usage.top.find(x => x.key === 'vtr|saveDieselIssue' && x.n === 1));
});

test('update-156: every edit screen carries the version it opened – Inward, Transfer, Payments, Vendor, BOQ, Asset Master (one, many, delete): changed by someone else meanwhile = refused, nothing saved', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => run('(f, a) => { try { return eval("(" + f + ")").apply(null, a); } catch (e) { return { thrown: String(e.message) }; } }', fn, a);
  const NOW = /was changed by .* after you opened it – open it again and make your change there\. Nothing was saved\./;
  // ---- the start ----
  run('(x, m) => saveVendor_(x, m)', { name: 'R156 Transport', gstReg: 'No', pan: 'ABCDE1256R', bank: 'SBI', account: '12345156', ifsc: 'SBIN0000001' }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'R156-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'R156 Transport', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01', monthlyRate: 45000 }, 'add');
  run('(x, m) => saveMaster_(x, m)', { no: 'R156-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 6, owner: 'R156 Transport', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  const inw = run('x => saveInward_(x)', { date: '2026-06-01', location: 'Dispenser', pump: 'Pump 156', qty: 2000, rate: 90, billNo: 'R156-A', billDate: '2026-06-01' });
  // ---- Inward ----
  const iRow = () => run('() => getInwards_({ from: "2026-06-01", to: "2026-06-01" })').rows.find(r => r.id === inw.id);
  const i1 = iRow(), I = o => Object.assign({ date: '2026-06-01', location: 'Dispenser', pump: 'Pump 156', qty: 2000, rate: 90, billNo: 'R156-A', billDate: '2026-06-01' }, o);
  assert.ok(i1.ver && i1.ver === iRow().ver, 'the same inward: the same version');
  assert.ok(!tryRun('(id, x) => updateInward_(id, x)', inw.id, I({ rate: 91, ver: i1.ver })).thrown, 'the first change is saved');
  let x = tryRun('(id, x) => updateInward_(id, x)', inw.id, I({ rate: 95, ver: i1.ver }));
  assert.match(x.thrown || '', new RegExp('^Inward ' + inw.id + ' was changed by')); assert.match(x.thrown, NOW);
  assert.strictEqual(iRow().rate, 91, 'his 91 stays');
  assert.match(tryRun('(id, v) => deleteInward_(id, v)', inw.id, i1.ver).thrown || '', NOW); assert.ok(iRow(), 'not deleted');
  assert.ok(!tryRun('(id, x) => updateInward_(id, x)', inw.id, I({ rate: 92 })).thrown, 'an older page or app (no version): taken as before');
  run('x => saveDieselIssue_(x)', { date: '2026-06-01', shift: 'Day', source: 'Dispenser', no: 'R156-TIP', qty: 40, kmReading: 1120, force: true });
  const i2 = iRow();
  assert.ok(!tryRun('(id, x) => updateInward_(id, x)', inw.id, I({ rate: 93, ver: i2.ver })).thrown, 'diesel issued from it meanwhile does not stop the change');
  // ---- Transfer ----
  run('x => saveInward_(x)', { date: '2026-06-01', location: 'VTR Store', pump: 'Pump 156', qty: 500, rate: 90, billNo: 'R156-B', billDate: '2026-06-01' });
  const tr = run('x => saveTransfer_(x)', { date: '2026-06-02', shift: 'Day', from: 'VTR Store', to: 'Dispenser', qty: 100, remark: 'R156' });
  const tRow = () => run('() => getTransfers_({ from: "2026-06-02", to: "2026-06-02" })').rows.find(r => r.id === tr.id), t1 = tRow();
  const TR = o => Object.assign({ date: '2026-06-02', shift: 'Day', from: 'VTR Store', to: 'Dispenser', qty: 100, remark: 'R156' }, o);
  assert.ok(t1.ver && !tryRun('(id, x) => updateTransfer_(id, x)', tr.id, TR({ qty: 120, ver: t1.ver })).thrown);
  assert.match(tryRun('(id, x) => updateTransfer_(id, x)', tr.id, TR({ qty: 150, ver: t1.ver })).thrown || '', NOW);
  assert.match(tryRun('(id, v) => deleteTransfer_(id, v)', tr.id, t1.ver).thrown || '', NOW);
  assert.strictEqual(tRow().qty, 120);
  // ---- Payments ----
  run('(x, m) => savePayment_(x, m)', { type: 'Payment', date: '2026-06-03', vendor: 'R156 Transport', amount: 10000, mode: 'NEFT', ref: 'UTR156' }, 'add');
  const pRow = () => run('() => getPayments_({ vendor: "R156 Transport" })').payments[0], p1 = pRow();
  const PY = o => Object.assign({ id: p1.id, type: 'Payment', date: '2026-06-03', vendor: 'R156 Transport', amount: 10000, mode: 'NEFT', ref: 'UTR156' }, o);
  assert.ok(p1.ver && !tryRun('(x, m) => savePayment_(x, m)', PY({ amount: 12000, ver: p1.ver }), 'edit').thrown);
  x = tryRun('(x, m) => savePayment_(x, m)', PY({ amount: 15000, ver: p1.ver }), 'edit');
  assert.match(x.thrown || '', /^Payment PAY-\d+ \(R156 Transport\) was changed by/); assert.strictEqual(pRow().amount, 12000, 'the ledger keeps 12,000');
  assert.match(tryRun('(id, v) => deletePayment_(id, v)', p1.id, p1.ver).thrown || '', NOW); assert.ok(pRow(), 'not deleted');
  assert.ok(!tryRun('(id, v) => deletePayment_(id, v)', p1.id, pRow().ver).thrown, 'deleted with the version of now');
  // ---- Vendor (also a rename: refused before anything moves) ----
  const vRow = () => run('() => getVendors_()').find(v => v.name === 'R156 Transport'), v1 = vRow();
  const VD = o => Object.assign({ name: 'R156 Transport', gstReg: 'No', pan: 'ABCDE1256R', bank: 'SBI', account: '12345156', ifsc: 'SBIN0000001' }, o);
  assert.ok(v1.ver && !tryRun('(x, m) => saveVendor_(x, m)', VD({ bank: 'HDFC', ver: v1.ver }), 'edit').thrown);
  x = tryRun('(x, m) => saveVendor_(x, m)', VD({ oldName: 'R156 Transport', name: 'R156 Movers', bank: 'SBI', ver: v1.ver }), 'edit');
  assert.match(x.thrown || '', /^Vendor R156 Transport was changed by/);
  assert.ok(vRow() && vRow().bank === 'HDFC' && run('() => getMaster_()').find(m => m.id === 'R156-TIP').owner === 'R156 Transport', 'not renamed, the machinery still his');
  run('(x, m) => saveMaster_(x, m)', { no: 'R156-NEW', name: 'Roller', type: 'Roller', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'R156 Transport', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
  assert.strictEqual(vRow().ver, run('() => getVendors_()').find(v => v.name === 'R156 Transport').ver, 'a machinery given to him meanwhile does not change his version');
  // ---- BOQ ----
  const bq = run('(b, m) => saveBoq_(b, m)', { vendor: 'R156 Transport', no: 'BOQ-156', from: '2026-06-01', to: '', lines: [{ no: 'R156-TIP', basis: 'Monthly', rate: 45000, diesel: 'Company' }], gstPct: '', tdsPct: 1, woNo: 'WO-156' }, 'add');
  const bRow = () => run('() => getBoqs_({})').boqs.find(b => b.id === bq.id), b1 = bRow();
  const BQ = o => Object.assign({ vendor: 'R156 Transport', no: 'BOQ-156', from: '2026-06-01', to: '', lines: [{ no: 'R156-TIP', basis: 'Monthly', rate: 45000, diesel: 'Company' }], gstPct: '', tdsPct: 1, woNo: 'WO-156' }, o);
  assert.ok(b1 && b1.ver, JSON.stringify(b1 || bq).slice(0, 300));
  assert.ok(!tryRun('(b, m, id) => saveBoq_(b, m, id)', BQ({ remark: 'first', ver: b1.ver }), 'edit', bq.id).thrown);
  assert.match(tryRun('(b, m, id) => saveBoq_(b, m, id)', BQ({ lines: [{ no: 'R156-TIP', basis: 'Monthly', rate: 50000, diesel: 'Company' }], ver: b1.ver }), 'edit', bq.id).thrown || '', /^BOQ BOQ-156 \(R156 Transport\) was changed by/);
  assert.match(tryRun('(id, v) => deleteBoq_(id, v)', bq.id, b1.ver).thrown || '', NOW);
  assert.strictEqual(bRow().lines[0].rate, 45000, 'the rate stays');
  // ---- Asset Master: one, many, delete ----
  const mRow = id => run('() => getMaster_()').find(m => m.id === id), m1 = mRow('R156-JCB');
  const M = o => Object.assign({ no: 'R156-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 6, owner: 'R156 Transport', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, o);
  assert.ok(m1.ver && !tryRun('(x, m, o) => saveMaster_(x, m, o)', M({ hrStd: 7, ver: m1.ver }), 'edit', 'R156-JCB').thrown);
  x = tryRun('(x, m, o) => saveMaster_(x, m, o)', M({ no: 'R156-JCB2', hrStd: 6, ver: m1.ver }), 'edit', 'R156-JCB');
  assert.match(x.thrown || '', /^Machinery R156-JCB was changed by/); assert.ok(mRow('R156-JCB') && !mRow('R156-JCB2') && mRow('R156-JCB').hrStd === 7, 'not renamed, 7 stays');
  const m2 = mRow('R156-JCB');
  run('x => saveDieselIssue_(x)', { date: '2026-06-02', shift: 'Day', source: 'Dispenser', no: 'R156-JCB', qty: 30, hrReading: 500, force: true });
  assert.strictEqual(mRow('R156-JCB').ver, m2.ver, 'a diesel issue of it does not change its version');
  x = tryRun('(i, c, v) => editMasterMany_(i, c, v)', ['R156-JCB', 'R156-TIP'], { kmStd: 5 }, { 'R156-JCB': m1.ver, 'R156-TIP': mRow('R156-TIP').ver });
  assert.ok(x.ok === false && x.errors.length === 1 && /R156-JCB was changed by/.test(x.errors[0].msg), JSON.stringify(x).slice(0, 300));
  assert.ok(!tryRun('(i, c, v) => editMasterMany_(i, c, v)', ['R156-JCB'], { make: 'JCB 3DX' }, { 'R156-JCB': m2.ver }).thrown);
  assert.match(tryRun('(id, f, v) => deleteMaster_(id, f, v)', 'R156-JCB', true, m2.ver).thrown || '', NOW);
  assert.match(tryRun('(i, f, v) => deleteMasterMany_(i, f, v)', ['R156-NEW', 'R156-JCB'], true, { 'R156-NEW': mRow('R156-NEW').ver, 'R156-JCB': m2.ver }).thrown || '', NOW);
  assert.ok(mRow('R156-JCB') && mRow('R156-NEW'), 'neither deleted');
  // a person who may not see the rates does not get the fingerprint of them
  const out = run('u => leastOut_(u, { master: getMaster_() })', { email: 'd@x', admin: false, perms: { 'Diesel Issue': 'Edit' } });
  const full = run('u => leastOut_(u, { master: getMaster_() })', { email: 'a@x', admin: true });
  assert.ok(out.master.every(m => !('ver' in m) && !('monthlyRate' in m)) && full.master.every(m => m.ver), 'only those who see every field get the version');
  // the page sends what it opened, on every screen
  const page = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  ["call('updateInward', editing, x)", "call('deleteInward', r.id, r.ver", "call('updateTransfer', editing, x)", "call('deleteTransfer', r.id, r.ver", "x.ver = S.py.editVer", "call('deletePayment', p.id, p.ver",
    "ver: S.vEdit && S.vEdit.saved ? S.vEdit.ver", "call('deleteVendor', S.vEdit.name, S.vEdit.ver", "body.ver = S.bRec.ver", "call('deleteBoq', b.id, b.ver", "m.ver = S.editMasterVer", "call('deleteMaster', no, force, (",
    "call('editMasterMany', list.map(m => m.id), ch, Object.fromEntries", "call('deleteMasterMany', ids, false, vers)", "S.editInwardVer = r.ver", "S.editTransferVer = r.ver", "S.py.editVer = p.ver", "S.editMasterVer = m.ver"]
    .forEach(k => assert.ok(page.indexOf(k) > -1, 'the page: ' + k));
});

// update-161 (26-10-2026): "mala app war pratek gostich realtime notification jayla haw app band aso ki chalu" – the phone app's
// notifications through Firebase: a phone of a person is kept at the first site (one phone = one person, at most 6, signed out =
// off); whatever the web is told (rtcPush_) also goes to his phones as a data message with the site it is from; a phone Firebase
// says is gone is forgotten; only Google's addresses (the stand-in only off the live site); nothing without the key; never throws.
test('update-161: the phone app\'s notifications (Firebase) – kept at the first site, sent with every web notification, gone phones forgotten', async () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tok = c => c + 'f'.repeat(20) + ':APA91b' + 'x'.repeat(140);
  // ---- the server code (Code.gs): the actions and what rtcPush_ hands on
  // (earlier tests put their own rtcPush_ in its place: the real one from Code.gs again, for this test)
  const code161 = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8'), p0 = code161.indexOf('function rtcPush_(ids, msg, but) {');
  require('vm').runInContext('this.__rtcPush161 = rtcPush_; ' + code161.slice(p0, code161.indexOf('\n}\n', p0) + 3), ctx);
  run(`() => { this.FCM161 = { keep: [], send: [] }; this.__keep161 = { pk: this.__pushKey, ps: this.__pushSend };
    __fcmKeep = (id, t, put) => { FCM161.keep.push([id, t.slice(0, 1), put]); return JSON.stringify({ ok: true, phones: 1, sending: true }); };
    __fcmSend = (ids, msg, ttl) => { FCM161.send.push({ ids: JSON.parse(ids), msg: JSON.parse(msg), ttl: ttl }); return '{"sent":1}'; };
    __pushKey = () => ''; }`);      // (no web push at all: the phones still get it)
  const U = { email: 'phone161@site.test', name: 'Phone 161', active: true, admin: false, perms: {} };
  const api = (f, u, x) => run('(f, u, x) => { try { return this[f](u, x); } catch (e) { return { thrown: String(e.message) }; } }', f, u, x);
  const me = run('e => rtcUid_(e)', U.email);
  assert.match(api('fcmSave_', U, { token: 'short' }).thrown, /^Notifications: the address of this phone for notifications is not valid/);
  assert.match(api('fcmSave_', U, { token: tok('a') + '<script>' }).thrown, /not valid/);
  assert.deepStrictEqual(api('fcmSave_', U, { token: tok('a') }), { ok: true, phones: 1, sending: true });
  assert.deepStrictEqual(api('fcmOff_', U, { token: 'bad' }), { ok: true }, 'signing out never fails on it');
  api('fcmOff_', U, { token: tok('a') });
  assert.deepStrictEqual(run('() => FCM161.keep'), [[me, 'a', true], [me, 'a', false]]);
  const A = run('() => ({ save: API_.fcmSave.m, su: API_.fcmSave.withUser, off: API_.fcmOff.m, ou: API_.fcmOff.withUser })');
  assert.deepStrictEqual(A, { save: '', su: true, off: '', ou: true }, 'any signed-in person, for his own phone');
  run('() => rtcPush_(["0123456789abcdef"], { t: "ring", call: "c1", name: "Asha", mode: "voice" })');
  run('() => crNotify_(["phone161@site.test"], { id: "VF-1", title: "Verification – Diesel Issue by Bala", body: "MH-12 50 L" })');
  const S = run('() => FCM161.send');
  assert.deepStrictEqual([S.length, S[0].ids, S[0].msg.t, S[0].ttl, S[1].ids, S[1].msg.t, S[1].msg.id, S[1].ttl], [2, ['0123456789abcdef'], 'ring', 60, [me], 'cr', 'VF-1', 86400]);
  run('() => { __fcmSend = () => { throw new Error("down"); }; }');
  assert.doesNotThrow(() => run('() => crNotify_(["phone161@site.test"], { id: "VF-2", title: "x", body: "y" })'), 'a notification never stops a save');
  run('() => { __pushKey = __keep161.pk; __pushSend = __keep161.ps; delete this.__fcmKeep; delete this.__fcmSend; rtcPush_ = __rtcPush161; }');
  assert.deepStrictEqual(api('fcmSave_', U, { token: tok('a') }), { ok: false, off: true }, 'a server without it: nothing, no error');

  // ---- server/fcm.js against a stand-in for Google (its own process – the calls wait for their answers)
  const { spawn } = require('child_process');
  const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const sp = spawn(process.execPath, [path.join(__dirname, 'fcm-standin.js'), '0'], { env: Object.assign({}, process.env, { FCM_STANDIN_PUB: kp.publicKey }), stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    const port = await new Promise((ok, no) => { const t = setTimeout(() => no(new Error('stand-in did not start')), 8000); sp.stdout.on('data', d => { const m = /fcm stand-in (\d+)/.exec(String(d)); if (m) { clearTimeout(t); ok(Number(m[1])); } }); });
    const base = 'http://127.0.0.1:' + port, env0 = { u: process.env.FCM_TEST_URL, k: process.env.FCM_SERVICE_ACCOUNT_JSON, v: process.env.VERCEL_ENV };
    const fcm = require('../server/fcm.js'), store = {};
    fcm._io.read = ids => { const o = {}; ids.forEach(i => { if (store[i] !== undefined) o[i] = store[i]; }); return o; };
    fcm._io.write = (id, v) => { store[id] = String(v); };
    const sent = async () => (await (await fetch(base + '/sent')).json());
    try {
      process.env.FCM_TEST_URL = base; delete process.env.VERCEL_ENV;
      delete process.env.FCM_SERVICE_ACCOUNT_JSON;
      assert.deepStrictEqual(fcm.send(['0123456789abcdef'], { t: 'cr' }, 60, 'S1'), { sent: 0, gone: 0 }, 'no key: nothing sent');
      process.env.FCM_SERVICE_ACCOUNT_JSON = 'not json';
      assert.match(fcm.send(['0123456789abcdef'], { t: 'cr' }, 60, 'S1').error, /not the complete key file/);
      process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account', project_id: 'rclerp-test', client_email: 'fcm@rclerp-test.iam.gserviceaccount.com', private_key: kp.privateKey });
      const a = '0123456789abcdef', b = 'fedcba9876543210';
      assert.throws(() => fcm.keep(a, 'short', true), /^Error: Notifications: the address of this phone/);
      assert.throws(() => fcm.keep('not-a-person', tok('p'), true), /who this phone belongs to/);
      // Asha's phone and a shared phone; Bala signs in on the shared one: it is his now (not Asha's any more)
      assert.deepStrictEqual(fcm.keep(a, tok('p'), true), { ok: true, phones: 1, sending: true });
      fcm.keep(a, tok('s'), true);
      assert.strictEqual(fcm.keep(b, tok('s'), true).phones, 1);
      assert.deepStrictEqual(JSON.parse(store['FCM|' + a]).map(p => p.t[0]), ['p']);
      assert.deepStrictEqual(JSON.parse(store['FCM|' + b]).map(p => p.t[0]), ['s']);
      for (let i = 0; i < 8; i++) fcm.keep(a, tok('m' + i), true);
      assert.strictEqual(JSON.parse(store['FCM|' + a]).length, 6, 'at most 6 phones – the oldest goes');
      // a ring to Asha and Bala: one message per phone, a DATA message (the app shows it), with the site, HIGH, 60 s, one per call
      fcm.keep(a, tok('gone'), true);      // (Firebase says this one is not there any more)
      let r = fcm.send([a, b, a, 'bad'], { t: 'ring', call: 'k1', name: 'Chitra', mode: 'voice', other: 'not sent' }, 60, 'T2');
      assert.deepStrictEqual(r, { sent: 6, gone: 1 });
      let s = await sent();
      assert.strictEqual(s.tokens, 1, 'one permission of Google for all of them');
      const m0 = s.sent[0].message;
      assert.deepStrictEqual([s.sent[0].project, m0.notification, m0.data.t, m0.data.call, m0.data.name, m0.data.mode, m0.data.site, m0.data.other, m0.android.priority, m0.android.ttl, m0.android.collapse_key],
        ['rclerp-test', undefined, 'ring', 'k1', 'Chitra', 'voice', 'T2', undefined, 'HIGH', '60s', 'call-k1']);
      assert.ok(Object.values(m0.data).every(v => typeof v === 'string'), 'Firebase takes only text in a data message');
      assert.ok(!JSON.parse(store['FCM|' + a]).some(p => /^gone/.test(p.t)), 'the phone that is gone is forgotten');
      assert.strictEqual(JSON.parse(store['FCM|' + a]).length, 5);
      // signed out on a phone: off; nothing is sent to it any more
      fcm.keep(b, tok('s'), false);
      await fetch(base + '/reset');
      r = fcm.send([b], { t: 'cr', id: 'VF-9', title: 'Approved – saved: Diesel Issue', body: 'x'.repeat(900) }, 86400, 'S1');
      assert.deepStrictEqual(r, { sent: 0, gone: 0 });
      r = fcm.send([a], { t: 'cr', id: 'VF-9', title: 'Approved – saved: Diesel Issue', body: 'x'.repeat(900) }, 86400, 'S1');
      s = await sent();
      assert.deepStrictEqual([r.sent, s.sent[0].message.data.id, s.sent[0].message.data.body.length, s.sent[0].message.android.ttl, s.sent[0].message.android.collapse_key], [5, 'VF-9', 400, '86400s', undefined]);
      // the live site: the stand-in is never used there (Google's own addresses only) – nothing reaches it
      process.env.VERCEL_ENV = 'production'; fcm._forget(); await fetch(base + '/reset');
      r = fcm.send([a], { t: 'cr', id: 'VF-10' }, 60, 'S1');
      assert.strictEqual((await sent()).sent.length, 0);
      assert.strictEqual(r.sent, 0);
      // a Preview (a test copy on the live database) never sends to real phones
      process.env.VERCEL_ENV = 'preview';
      assert.deepStrictEqual(fcm.send([a], { t: 'cr' }, 60, 'S1'), { sent: 0, gone: 0 });
    } finally {
      for (const [k, v] of [['FCM_TEST_URL', env0.u], ['FCM_SERVICE_ACCOUNT_JSON', env0.k], ['VERCEL_ENV', env0.v]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  } finally { sp.kill(); }
});

// update-162 (26-10-2026): "diesel issue access user la deto … user wise konala konte source cha access deycha … jya user la jyacha
// access asel to tyach madhun issue kru shakel same transfer la pn … inward la nko" – his answers: Transfer = FROM only; nothing
// chosen = every source; lists as before; given by the Super Admin in the Portal.
test('update-162: diesel sources per person – Issue and the From of a Transfer only from his own (also a change / delete of another source\'s entry); Inward free; Admin and nothing chosen = every source; the Portal sets them', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const CP = 'CAMP PUMP', ZE = 'DISPENSER - MH12ZE-1739', WJ = 'DISPENSER - MH12WJ-1381';
  run('p => { PropertiesService.getScriptProperties().setProperty("DIESEL_PLACES", p); PropertiesService.getScriptProperties().deleteProperty("DIESEL_SOURCES"); DSRC_U_ = null; }', JSON.stringify([{ name: CP }, { name: ZE }, { name: WJ }]));
  const BALA = { email: 'bala162@site.test', name: 'Bala 162', admin: false, perms: { 'Diesel Issue': 'Edit', 'Diesel Transfer': 'Edit', 'Diesel Inward': 'Edit' } };
  const ADMIN = { email: 'admin162@site.test', name: 'Admin 162', admin: true, perms: {} };
  try {
    run('(x, m) => saveMaster_(x, m)', { no: 'DS-162', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'DS Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-06-01' }, 'add');
    run('x => saveInward_(x)', { date: '2026-06-01', location: CP, pump: 'Pump', qty: 5000, rate: 100, billNo: 'DS1', billDate: '2026-06-01' });
    const t0 = run('x => saveTransfer_(x)', { date: '2026-06-01', shift: 'Day', from: CP, to: ZE, qty: 1000 });      // (nobody's sources yet: every source)
    assert.strictEqual(t0.ok, true, JSON.stringify(t0));
    // nothing chosen for him: every source, nothing told to the page (as before)
    assert.strictEqual(run('u => dsrcMine_(u)', BALA), null);
    assert.strictEqual(run('u => publicUser_(u).dsrc', BALA), null);
    // ---- the Super Admin gives him ZE for Diesel Issue and ZE for Diesel Transfer (the Portal – Sites.gs pages → dsrcSet_)
    assert.match(run('(e, g) => dsrcSet_(e, g, "sa@rcl.test")', BALA.email, { 'Diesel Issue': [ZE.toLowerCase(), 'NOT A PLACE'], 'Diesel Transfer': [ZE] }), /Diesel Issue: DISPENSER - MH12ZE-1739; Diesel Transfer: DISPENSER - MH12ZE-1739/);
    assert.deepStrictEqual(run('u => dsrcMine_(u)', BALA), { 'Diesel Issue': [ZE], 'Diesel Transfer': [ZE] }, 'the name as the site writes it; an unknown name left out');
    assert.deepStrictEqual(run('u => publicUser_(u).dsrc', BALA), { 'Diesel Issue': [ZE], 'Diesel Transfer': [ZE] }, 'the page and the phone are told');
    assert.strictEqual(run('u => dsrcMine_(u)', ADMIN), null, 'the Admin: every source');
    assert.strictEqual(run('(e, g) => dsrcSet_(e, g, "sa")', BALA.email, { 'Diesel Issue': [ZE], 'Diesel Transfer': [ZE] }), '', 'nothing changed: nothing written');
    run('u => { DSRC_U_ = u; }', BALA);
    // ---- Diesel Issue: another source refused (one entry, many at once, Excel import); his own saved
    const iss = src => ({ date: '2026-06-02', shift: 'Day', no: 'DS-162', qty: 50, kmReading: 1000, source: src, mode: 'KM' });
    assert.match(tryRun('(d, u) => saveDieselIssue_(d, u)', iss(CP), BALA).thrown, /^Diesel source CAMP PUMP is not given to Bala 162 for Diesel Issue \(given: DISPENSER - MH12ZE-1739\) – the Super Admin gives the diesel sources in the Portal/);
    const ok1 = run('(d, u) => saveDieselIssue_(d, u)', iss(ZE), BALA);
    assert.strictEqual(ok1.ok, true, JSON.stringify(ok1));
    const imp = tryRun('r => importDiesel_(r)', [Object.assign(iss(WJ), { line: 1, kmReading: 1100 })]);
    assert.ok(/not given to Bala 162 for Diesel Issue/.test(JSON.stringify(imp)), JSON.stringify(imp));
    // ---- Diesel Transfer: FROM his own only; TO any
    assert.match(tryRun('x => saveTransfer_(x)', { date: '2026-06-02', shift: 'Day', from: CP, to: WJ, qty: 10 }).thrown, /^Diesel source CAMP PUMP is not given to Bala 162 for Diesel Transfer/);
    assert.strictEqual(run('x => saveTransfer_(x)', { date: '2026-06-02', shift: 'Day', from: ZE, to: CP, qty: 10 }).ok, true, 'from his own to any');
    const bulk = tryRun('r => saveTransferBulk_(r)', [{ line: 1, date: '2026-06-02', shift: 'Day', from: WJ, to: ZE, qty: 1 }]);
    assert.ok(/not given to Bala 162 for Diesel Transfer/.test(JSON.stringify(bulk)), JSON.stringify(bulk));
    // ---- the transfer made from CAMP PUMP (before): not his to change or delete
    assert.match(tryRun('(id, x) => updateTransfer_(id, x)', t0.id, { date: '2026-06-01', shift: 'Day', from: ZE, to: WJ, qty: 5 }).thrown, /CAMP PUMP is not given to Bala 162 for Diesel Transfer/);
    assert.match(tryRun('id => deleteTransfer_(id)', t0.id).thrown, /CAMP PUMP is not given to Bala 162 for Diesel Transfer/);
    // ---- Inward: free
    assert.strictEqual(run('(x, u) => saveInward_(x, u)', { date: '2026-06-02', location: WJ, pump: 'Pump', qty: 100, rate: 100, billNo: 'DS2', billDate: '2026-06-02' }, BALA).ok, true);
    // ---- an issue of CAMP PUMP made by the Admin: not Bala's to change or delete
    run('() => { DSRC_U_ = null; }');
    const cpIss = run('(d, u) => saveDieselIssue_(d, u)', Object.assign(iss(CP), { date: '2026-06-03', kmReading: 1200 }), ADMIN);
    assert.strictEqual(cpIss.ok, true, JSON.stringify(cpIss));
    run('u => { DSRC_U_ = u; }', BALA);
    assert.match(tryRun('(id, d) => updateDieselIssue_(id, d)', cpIss.id, Object.assign(iss(ZE), { date: '2026-06-03', kmReading: 1200 })).thrown, /CAMP PUMP is not given to Bala 162 for Diesel Issue/);
    assert.match(tryRun('id => deleteDieselIssue_(id)', cpIss.id).thrown, /CAMP PUMP is not given to Bala 162 for Diesel Issue/);
    // ---- every place ticked = every source again; none ticked = none
    run('(e, g) => dsrcSet_(e, g, "sa")', BALA.email, { 'Diesel Issue': [CP, ZE, WJ], 'Diesel Transfer': [] });
    assert.deepStrictEqual(run('u => dsrcMine_(u)', BALA), { 'Diesel Transfer': [] });
    assert.match(tryRun('x => saveTransfer_(x)', { date: '2026-06-04', shift: 'Day', from: ZE, to: CP, qty: 1 }).thrown, /for Diesel Transfer \(none is given\)/);
    run('(e, g) => dsrcSet_(e, g, "sa")', BALA.email, { 'Diesel Issue': null, 'Diesel Transfer': null });
    assert.strictEqual(run('u => dsrcMine_(u)', BALA), null, 'back to every source');
    // ---- an approval runs the change with the REQUESTER's sources (both places a change is run on approval); every request: its person
    const codeGs = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
    assert.strictEqual((codeGs.match(/DSRC_U_ = ru;/g) || []).length, 2, 'the change-request approval and the flow approval');
    assert.ok(codeGs.indexOf('  DSRC_U_ = u;') > -1, 'api(): the person of the request');
    // ---- the Portal's door (Sites.gs): the users with their sources and the site's places; pages saves them
    const sitesGs = fs.readFileSync(path.join(root, 'app', 'Sites.gs'), 'utf8');
    assert.match(sitesGs, /return \{ users: d\.users\.map\(pub\), pages: d\.modules, places: cardSite_\(\) \? \[\] : placeNames_\(\) \};/);      // (update-164: a site on fuel cards has no diesel sources)
    assert.match(sitesGs, /if \(c\.sources && typeof c\.sources === 'object'\) \{ const lk = LockService\.getScriptLock\(\); lk\.waitLock\(30000\); try \{ dsTxt = dsrcSet_\(email, c\.sources, c\.by\); \}/);
    assert.ok(!/withLock_\(\(\) => \{ dsTxt/.test(sitesGs), 'not withLock_: it would drop the pages saved just before (found on the rig)');
    // ---- the page: his own sources on the entry forms only
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    ['<select id="d_src" class="loc-select src-select" data-default="first" data-own="Diesel Issue"', '<select id="t_from" class="loc-select" data-default="first" data-own="Diesel Transfer">',
      "const keep = sel.value, all = sel.dataset.all, base = sel.dataset.own ? mySources(sel.dataset.own) : S.locations"].forEach(k => assert.ok(app.indexOf(k) > -1, k));      // (update-163: d_src also follows the machinery's fuel)
    assert.ok(!/id="df_src"[^>]*data-own/.test(app) && !/id="rm_src"[^>]*data-own/.test(app), 'the filters of the lists and reports: every source');
  } finally {
    run('() => { PropertiesService.getScriptProperties().deleteProperty("DIESEL_PLACES"); PropertiesService.getScriptProperties().deleteProperty("DIESEL_SOURCES"); DSRC_U_ = null; }');
  }
});

test('update-163: fuel – Diesel / Petrol / CNG / Electric machinery (Asset Master → Fuel) and each diesel place its fuel; a fill only from a place of its fuel, a transfer only within one fuel; the fuels never added together; a site of Diesel only as before', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const DC = 'DIESEL CARD', PC = 'PETROL CARD', CC = 'CNG CARD', PK = 'PETROL CAN';
  const car = (no, fuel, extra) => Object.assign({ no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 12, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-07-01' }, fuel === undefined ? {} : { fuel: fuel }, extra || {});
  try {
    // ---- a site of Diesel only (no places set = the first site's Dispenser + VTR Store): as before
    run('() => { PropertiesService.getScriptProperties().deleteProperty("DIESEL_PLACES"); }');
    assert.deepStrictEqual(run('() => siteFuels_()'), ['Diesel']);
    assert.strictEqual(run('() => fuelViewOf_([{ fuel: "Petrol" }])'), '', 'one fuel: no fuel view, whatever is sent');
    assert.strictEqual(run('() => "byFuel" in getDieselIssues_({})'), false, 'the lists: no totals per fuel');
    // ---- HO: one place per fuel card (the Super Admin, Portal → Sites → Diesel places), and a second Petrol place
    // (a new site: no entry anywhere yet – the other tests' entries at the first site's places are left aside for this save)
    const info = run(`l => { const keep = stockTables_; stockTables_ = () => ({ it: { rows: [], c: { [H.LOC]: 0 } }, tt: { rows: [], c: { [H.FROM]: 0, [H.TO]: 1 } }, dt: { rows: [], c: { [H.SOURCE]: 0 } } });
      try { return savePlaces_(l); } finally { stockTables_ = keep; } }`, [{ name: DC, cap: 500 }, { name: PC, cap: 500, fuel: 'petrol' }, { name: CC, cap: 300, fuel: 'CNG' }, { name: PK, cap: 100, fuel: 'Petrol' }]);
    assert.deepStrictEqual(info.places.map(p => p.name + ':' + p.fuel), [DC + ':Diesel', PC + ':Petrol', CC + ':CNG', PK + ':Petrol']);
    assert.deepStrictEqual(JSON.parse(run('() => PropertiesService.getScriptProperties().getProperty("DIESEL_PLACES")')).map(p => p.fuel || ''), ['', 'Petrol', 'CNG', 'Petrol'], 'Diesel is kept as nothing (a place of before)');
    assert.deepStrictEqual(run('() => placeFuels_()'), { [DC]: 'Diesel', [PC]: 'Petrol', [CC]: 'CNG', [PK]: 'Petrol' });
    assert.deepStrictEqual(run('() => siteFuels_()'), ['Diesel', 'Petrol', 'CNG']);
    assert.match(tryRun('l => savePlaces_(l)', [{ name: DC, cap: 500, fuel: 'Kerosene' }]).thrown, /^Diesel place "DIESEL CARD": its fuel is Diesel, Petrol or CNG\.$/);
    // ---- the Asset Master: Fuel (empty / not sent = Diesel; unknown = refused); Electric needs no standard average; CNG's is KM/kg
    run('(x, m) => saveMaster_(x, m)', car('HO-D163', undefined), 'add');
    run('(x, m) => saveMaster_(x, m)', car('HO-P163', 'Petrol'), 'add');
    run('(x, m) => saveMaster_(x, m)', car('HO-C163', 'cng'), 'add');
    run('(x, m) => saveMaster_(x, m)', car('HO-E163', 'Electric', { kmStd: '' }), 'add');
    assert.match(tryRun('(x, m) => saveMaster_(x, m)', car('HO-X163', 'Gas'), 'add').thrown, /^HO-X163: select Fuel \(Diesel \/ Petrol \/ CNG \/ Electric\)\.$/);
    assert.match(tryRun('(x, m) => saveMaster_(x, m)', car('HO-Y163', 'CNG', { kmStd: '' }), 'add').thrown, /^HO-Y163: enter Standard Average \(KM\/kg\)\.$/);
    const fuelOf = no => run('n => (getMaster_().find(m => m.id === n) || {}).fuel', no);
    assert.deepStrictEqual(['HO-D163', 'HO-P163', 'HO-C163', 'HO-E163'].map(fuelOf), ['Diesel', 'Petrol', 'CNG', 'Electric']);
    run('(x, m, o) => saveMaster_(x, m, o)', Object.assign(car('HO-P163'), { name: 'Car HO-P163 (renamed)' }), 'edit', 'HO-P163');
    assert.strictEqual(fuelOf('HO-P163'), 'Petrol', 'a change that does not send Fuel keeps it');
    const ex = run('() => exportMaster_()');
    const fi = ex.headers.indexOf('Fuel');
    assert.ok(fi > -1, 'Export has a Fuel column');
    assert.deepStrictEqual(['HO-D163', 'HO-P163'].map(n => ex.rows.find(r => r.indexOf(n) > -1)[fi]), ['', 'Petrol'], 'Diesel = empty, as it is kept');
    const imp = run('(r, a) => importMaster_(r, a)', [{ line: 2, no: 'HO-D163', fuel: 'CNG' }], true);
    assert.ok(imp.ok !== false, JSON.stringify(imp));
    assert.strictEqual(fuelOf('HO-D163'), 'CNG', 'the Excel import sets the Fuel');
    run('(r, a) => importMaster_(r, a)', [{ line: 2, no: 'HO-D163', fuel: 'Diesel' }], true);
    assert.strictEqual(fuelOf('HO-D163'), 'Diesel');
    // ---- stock: each card its own fuel
    [[DC, 200], [PC, 150], [CC, 40]].forEach((x, i) => assert.strictEqual(run('x => saveInward_(x)', { date: '2026-07-01', location: x[0], pump: 'Card', qty: x[1], rate: 100, billNo: 'F163-' + i, billDate: '2026-07-01' }).ok, true));
    // ---- a fill only from a place of its fuel; an Electric machinery gets none
    const iss = (no, src, qty, km) => ({ date: '2026-07-02', shift: 'Day', no: no, qty: qty, kmReading: km, source: src, mode: 'KM' });
    assert.strictEqual(tryRun('d => saveDieselIssue_(d)', iss('HO-P163', DC, 10, 1000)).thrown, 'DIESEL CARD holds Diesel and HO-P163 runs on Petrol – pick a Petrol place (Asset Master → Fuel).');
    assert.strictEqual(tryRun('d => saveDieselIssue_(d)', iss('HO-D163', PC, 10, 1000)).thrown, 'PETROL CARD holds Petrol and HO-D163 runs on Diesel – pick a Diesel place (Asset Master → Fuel).');
    assert.strictEqual(tryRun('d => saveDieselIssue_(d)', iss('HO-E163', DC, 10, 1000)).thrown, 'HO-E163 runs on Electric – no fuel is issued to it (Asset Master → Fuel).');
    assert.strictEqual(run('d => saveDieselIssue_(d)', iss('HO-P163', PC, 30, 1000)).ok, true);
    assert.strictEqual(run('d => saveDieselIssue_(d)', iss('HO-D163', DC, 50, 2000)).ok, true);
    assert.strictEqual(run('d => saveDieselIssue_(d)', iss('HO-C163', CC, 8, 3000)).ok, true);
    assert.match(tryRun('d => saveDieselIssue_(d)', Object.assign(iss('HO-C163', CC, 100, 3100), { date: '2026-07-03' })).thrown, /^Not enough CNG at CNG CARD for 03-07-2026 \(Day\)\. Available: 32 kg, you are issuing: 100 kg\.$/, 'CNG in kg');
    const bulk = run('b => saveDieselBulk_(b)', { date: '2026-07-03', shift: 'Day', source: PC, rows: [{ no: 'HO-D163', qty: 5, kmReading: 2100, mode: 'KM' }] });
    assert.ok(/PETROL CARD holds Petrol and HO-D163 runs on Diesel/.test(JSON.stringify(bulk)), 'many at once: the same check ' + JSON.stringify(bulk));
    // (found here) the rows of "many at once" are checked with the batch's source – also his own diesel sources (update-162)
    const RAVI = { email: 'ravi163@site.test', name: 'Ravi 163', admin: false, perms: { 'Diesel Issue': 'Edit' } };
    run('(e, g) => dsrcSet_(e, g, "sa")', RAVI.email, { 'Diesel Issue': [PC] });
    run('u => { DSRC_U_ = u; }', RAVI);
    assert.strictEqual(run('b => saveDieselBulk_(b)', { date: '2026-07-03', shift: 'Day', source: PC, rows: [{ no: 'HO-P163', qty: 5, kmReading: 1100, mode: 'KM' }] }).ok, true, 'his own source, not the first place');
    const notHis = run('b => saveDieselBulk_(b)', { date: '2026-07-03', shift: 'Day', source: PK, rows: [{ no: 'HO-P163', qty: 1, kmReading: 1200, mode: 'KM' }] });
    assert.ok(/Diesel source PETROL CAN is not given to Ravi 163 for Diesel Issue/.test(JSON.stringify(notHis)), JSON.stringify(notHis));
    run('(e) => { DSRC_U_ = null; dsrcSet_(e, { "Diesel Issue": null }, "sa"); }', RAVI.email);
    // ---- a transfer only between places of one fuel
    assert.strictEqual(tryRun('x => saveTransfer_(x)', { date: '2026-07-02', shift: 'Day', from: PC, to: DC, qty: 5 }).thrown, 'A transfer goes only between places of the same fuel: PETROL CARD holds Petrol, DIESEL CARD holds Diesel.');
    assert.strictEqual(run('x => saveTransfer_(x)', { date: '2026-07-02', shift: 'Day', from: PC, to: PK, qty: 20 }).ok, true, 'Petrol → Petrol');
    // ---- a place with entries keeps its fuel
    assert.strictEqual(tryRun('l => savePlaces_(l)', [{ name: DC, cap: 500 }, { name: PC, cap: 500, fuel: 'Diesel' }, { name: CC, cap: 300, fuel: 'CNG' }, { name: PK, cap: 100, fuel: 'Petrol' }]).thrown, 'Diesel place PETROL CARD (Petrol) has entries – its fuel cannot be changed.');
    // ---- the lists: the total of each fuel (the page never adds them together); a list of one fuel
    const li = run('() => getDieselIssues_({ from: "2026-07-01", to: "2026-07-31" })');
    assert.deepStrictEqual(li.byFuel, { Diesel: 50, Petrol: 35, CNG: 8 });
    assert.deepStrictEqual(run('() => getDieselIssues_({ from: "2026-07-01", to: "2026-07-31", fuel: "Petrol" })').rows.map(r => r.no), ['HO-P163', 'HO-P163']);
    assert.deepStrictEqual(run('() => getInwards_({ from: "2026-07-01", to: "2026-07-31" })').byFuel, { Diesel: 200, Petrol: 150, CNG: 40 });
    assert.deepStrictEqual(run('() => getTransfers_({ from: "2026-07-01", to: "2026-07-31" })').byFuel, { Petrol: 20 });
    // ---- the dashboard / a report of ONE fuel (FUEL_VIEW_, only around an action that saves nothing): only its places, entries and machinery
    assert.strictEqual(run('() => fuelViewOf_([{ from: "", fuel: "Petrol" }])'), 'Petrol');
    assert.strictEqual(run('() => fuelViewOf_(["Own", { fuel: "CNG" }])'), 'CNG', 'getOwnershipDetail sends the filter second');
    assert.strictEqual(run('() => fuelViewOf_([{ fuel: "Electric" }])'), '', 'no place holds Electric');
    const view = (fu, fn) => run('(fu, src) => { FUEL_VIEW_ = fu; try { return eval(src)(); } finally { FUEL_VIEW_ = ""; } }', fu, fn);
    const dP = view('Petrol', '() => getDashboard_({ from: "2026-07-02", to: "2026-07-02" })');
    assert.strictEqual(dP.total.qty, 30, 'Petrol issued only');
    assert.deepStrictEqual(Object.keys(dP.stock.byLoc), [PC, PK]);
    assert.deepStrictEqual(dP.stock.byLoc, { [PC]: 95, [PK]: 20 }, 'the live stock of the Petrol places');
    assert.deepStrictEqual(dP.locations.map(x => x.loc), [PC, PK]);
    assert.deepStrictEqual(Object.keys(dP.tanks.caps), [PC, PK]);
    const dC = view('CNG', '() => getDashboard_({ from: "2026-07-02", to: "2026-07-02" })');
    assert.strictEqual(dC.total.qty, 8); assert.deepStrictEqual(dC.stock.byLoc, { [CC]: 32 });
    const dAll = run('() => getDashboard_({ from: "2026-07-02", to: "2026-07-02" })');
    assert.strictEqual(dAll.pending.total, dP.pending.total, 'the Log Book still pending: every machinery, whatever the fuel shown');
    assert.deepStrictEqual(run('() => getStock_().byFuel'), Object.assign({ Petrol: 115, CNG: 32 }, { Diesel: run('() => getStock_().byFuel.Diesel') }));
    const mP = view('Petrol', '() => getMonthlyDieselReport_({ from: "2026-07-01", to: "2026-07-31", source: "", shift: "", supply: "", ownerships: ["Own", "Rental", "Hired", "Debit", "Other"], machines: [] })');
    assert.strictEqual(mP.total, 35, 'the monthly report of Petrol: its machinery only');
    assert.ok(JSON.stringify(mP.groups).indexOf('HO-D163') === -1);
    assert.strictEqual(run('() => FUEL_VIEW_'), '', 'the view ends with the action');
    // the Tank size box of a fuel's dashboard sends only its tanks: the others keep their size
    const ts = run('() => saveTankSettings_({ caps: { "PETROL CARD": 600, "PETROL CAN": 120 }, low: 50 })');
    assert.deepStrictEqual([ts.caps[PC], ts.caps[PK], ts.caps[DC], ts.caps[CC]], [600, 120, 500, 300]);
    assert.match(tryRun('() => saveTankSettings_({ caps: { "PETROL CARD": 0 }, low: 50 })').thrown, /^Enter the tank size \(Ltr\) for PETROL CARD\.$/, 'a size sent must be a size');
    // ---- apiRun_: the view only for Reports / Dashboard and never for a save
    const codeGs = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
    assert.ok(codeGs.indexOf("const fv = !spec.edit && (spec.m === 'Reports' || spec.m === 'Dashboard') ? fuelViewOf_(args) : '';") > -1);
    assert.ok(codeGs.indexOf('return FUEL_VIEW_ && SB_DEPTH_ === 0 ? fuelView_(name, t) : t;') > -1, 'never inside a save');
    // ---- the database step, Read Me and the check
    const sql = fs.readFileSync(path.join(root, 'sql', 'supabase_step1zg_fuel.sql'), 'utf8');
    assert.match(sql, /alter table public\.master add column if not exists fuel text;/);
    assert.ok(!/\b(drop|delete|truncate|update)\b/i.test(sql.replace(/--.*$/gm, '')), 'nothing removed or changed');
    assert.ok(codeGs.indexOf("add('The fuel of each machinery – Diesel / Petrol / CNG / Electric (step 1zg)', has('master', 'fuel'), 'supabase_step1zg_fuel.sql');") > -1);
    // ---- the Portal's door passes each place's fuel (a Portal before it sends none = Diesel)
    const portal = require(path.join(root, 'server', 'portal.js'));
    assert.ok(/fuel: String\(p\.fuel\)/.test(fs.readFileSync(path.join(root, 'server', 'portal.js'), 'utf8')) && typeof portal.verifyAdmin === 'function');
    // ---- the page
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    ['<select id="m_fuel"', 'data-fuel-by="d_no"', 'data-fuel-by="bm_no"', 'data-fuel-by="t_from"', 'data-fuel-by="k_fuel"', 'data-fuel-by="rd_fuel"', 'data-fuel-by="rm_fuel"', 'data-fuel-by="ra_fuel"',
      '<select id="k_fuel" class="fuel-select">', "fuel: 'fuel', fueltype: 'fuel'", "const B_FIELDS = ['no', 'name', 'type', 'make', 'unit', 'kmStd', 'hrStd', 'owner', 'ownership', 'supply', 'fuel'];",
      "if (!fu) setStock(d.stock); }", "S.placeFuels = d.placeFuels || {};"].forEach(k => assert.ok(app.indexOf(k) > -1, k));
  } finally {
    run('() => { PropertiesService.getScriptProperties().deleteProperty("DIESEL_PLACES"); FUEL_VIEW_ = ""; }');
  }
});

test('update-164: fuel cards – a site without diesel stock (HO): the cards and their balance, a fill by a card or in Cash with its ₹, payments onto a card, a card\'s statement, the dashboard of cards and cars; a site that is not on cards as before', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const car = (no, fuel) => ({ no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 12, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-07-01', fuel: fuel });
  const HD = 'HDFC FUEL 1', IC = 'ICICI CREDIT';
  try {
    // ---- a site that is not on fuel cards: as before (no cards, no Fuel Cards page, the stock is stock)
    run('() => { const P = PropertiesService.getScriptProperties(); P.deleteProperty("FUEL_MODE"); P.deleteProperty("FUEL_CARDS"); }');
    assert.strictEqual(run('() => cardSite_()'), false);
    assert.strictEqual(run('() => "cards" in getStock_()'), false, 'no cards in the stock');
    assert.strictEqual(run('() => getInit_(null).fuelMode'), '');
    assert.strictEqual(run('() => usersAdmin_().modules.some(m => m.key === "Fuel Cards")'), false, 'the Portal does not list Fuel Cards at a site with stock');
    assert.ok(run('() => usersAdmin_().modules.some(m => m.key === "Diesel Inward")'));
    assert.strictEqual(tryRun('x => saveCard_(x)', { name: HD }).thrown, 'This site is not on fuel cards – the Super Admin sets that in the Portal (Sites → Diesel places → Fuel cards).');
    // the new page: an empty cell is No access (never View); No access is kept as an empty cell
    run('() => { this.__mh164 = makeHash_; makeHash_ = () => "sha256$0123456789abcdef$" + "0".repeat(64); }');      // (the test's Utilities has no hashing)
    try { run('x => saveUserAdmin_(x, null)', { isNew: true, email: 'driver164@site.test', name: 'Driver 164', active: true, admin: false, perms: { 'Diesel Issue': 'Edit' }, newPassword: crypto.randomBytes(8).toString('hex') + 'Aa1' }); }
    finally { run('() => { makeHash_ = this.__mh164; }'); }
    const perm = () => run('() => readUsersSheet_().find(u => u.email === "driver164@site.test").perms["Fuel Cards"]');
    assert.strictEqual(perm(), 'None');
    run('x => saveUserAdmin_(x, null)', { email: 'driver164@site.test', name: 'Driver 164', active: true, admin: false, perms: { 'Fuel Cards': 'View' } });
    assert.strictEqual(perm(), 'View');
    run('x => saveUserAdmin_(x, null)', { email: 'driver164@site.test', name: 'Driver 164', active: true, admin: false, perms: { 'Fuel Cards': 'None' } });
    assert.strictEqual(perm(), 'None');
    assert.strictEqual(run('() => { const t = table_("Users", []); const r = t.rows.find(x => String(x[t.c.Email]) === "driver164@site.test"); return r[t.c["Fuel Cards"]]; }'), '', 'kept as an empty cell');
    // ---- the Super Admin puts the site on fuel cards (Portal → Sites → Diesel places), its places as they are
    const places = run('() => places_().map(p => ({ name: p.name, cap: tankSettings_().caps[p.name] || 100, fuel: p.fuel }))');
    const info = run('(l, m) => savePlaces_(l, m)', places, 'card');
    assert.strictEqual(info.mode, 'card');
    assert.strictEqual(run('() => cardSite_()'), true);
    assert.strictEqual(run('() => getInit_(null).fuelMode'), 'card');
    assert.deepStrictEqual(run('() => usersAdmin_().modules.filter(m => /Fuel Cards|Diesel Inward|Diesel Transfer/.test(m.key)).map(m => m.key)'), ['Fuel Cards'], 'the Portal lists Fuel Cards, no Inward / Transfer');
    run('(x, m) => saveMaster_(x, m)', car('HO-1-164', 'Petrol'), 'add');
    run('(x, m) => saveMaster_(x, m)', car('HO-2-164', 'Diesel'), 'add');
    run('(x, m) => saveMaster_(x, m)', Object.assign(car('HO-3-164', 'Electric'), { kmStd: '' }), 'add');
    assert.ok(run('() => siteFuels_()').indexOf('Petrol') > -1, 'the fuels of the site: its machinery\'s');
    // ---- the cards: every check, then two cards
    const bad = x => tryRun('x => saveCard_(x)', Object.assign({ name: HD, last4: '4321', type: 'Fuel card', cars: [], opening: 5000, openDate: '2026-07-01' }, x)).thrown;
    assert.strictEqual(bad({ name: '' }), 'Enter the card\'s name (e.g. HDFC Fuel Card 1).');
    assert.strictEqual(bad({ name: 'cash' }), '"Cash" is how a fill is paid without a card – give the card another name.');
    assert.strictEqual(bad({ last4: '1234567890123456' }), 'Card HDFC FUEL 1: type only the LAST 4 digits of the card number (never the whole number).');
    assert.strictEqual(bad({ type: 'Gift card' }), 'Card HDFC FUEL 1: pick its kind (Fuel card / Credit card / Debit card).');
    assert.strictEqual(bad({ opening: -1 }), 'Card HDFC FUEL 1: enter its opening balance (₹, 0 or more).');
    assert.match(bad({ openDate: '2099-01-01' }), /is after today/);
    assert.match(bad({ cars: ['NOT-A-CAR'] }), /is not in Master/);
    const c1 = run('x => saveCard_(x)', { name: HD, last4: '4321', type: 'fuel card', cars: [], opening: 5000, openDate: '2026-07-01' });
    assert.strictEqual(c1.ok, true); assert.strictEqual(c1.added, true);
    assert.strictEqual(c1.summary, 'Fuel card added: HDFC FUEL 1 – Fuel card, …4321, opening ₹5000 on 01-07-2026, every car, Active');
    run('x => saveCard_(x)', { name: IC, type: 'Credit card', cars: ['ho-1-164'], opening: 1000, openDate: '2026-07-05' });
    assert.strictEqual(bad({ name: IC }), 'Card ICICI CREDIT is already there.');
    assert.deepStrictEqual(run('() => getStock_().cards.map(c => c.name + ":" + c.balance + ":" + c.cars.join("|"))'), [HD + ':5000:', IC + ':1000:HO-1-164']);
    // ---- a fill: a card or Cash, its ₹ – the checks of the server
    const fill = (no, src, qty, amount, date, extra) => Object.assign({ date: date || '2026-07-06', shift: 'Day', no: no, qty: qty, kmReading: '', source: src, amount: amount }, extra || {});
    const refused = d => tryRun('d => saveDieselIssue_(d)', d).thrown;
    assert.strictEqual(refused(fill('HO-1-164', '', 10, 1050)), 'HO-1-164: pick how the fuel was paid – a fuel card or Cash.');
    assert.strictEqual(refused(fill('HO-1-164', 'XYZ CARD', 10, 1050)), 'HO-1-164: "XYZ CARD" is not a fuel card of this site (Fuel Cards) – pick a card or Cash.');
    assert.strictEqual(refused(fill('HO-1-164', HD, 10, '')), 'HO-1-164: enter the Amount (₹) of this fill.');
    assert.strictEqual(refused(fill('HO-2-164', IC, 10, 900)), 'HO-2-164: card ICICI CREDIT is not for this car (Fuel Cards → its cars) – pick its own card or Cash.');
    assert.strictEqual(refused(fill('HO-1-164', IC, 10, 900, '2026-07-04')), 'HO-1-164: card ICICI CREDIT starts on 05-07-2026 (its opening balance) – a fill of 04-07-2026 cannot be on it.');
    assert.strictEqual(refused(fill('HO-3-164', 'Cash', 10, 900)), 'HO-3-164 runs on Electric – no fuel is issued to it (Asset Master → Fuel).');
    // (update-162) a person's diesel sources are places – a site on fuel cards does not use them
    const RAVI = { email: 'ravi164@site.test', name: 'Ravi 164', admin: false, perms: { 'Diesel Issue': 'Edit' } };
    run('(e, g) => dsrcSet_(e, g, "sa")', RAVI.email, { 'Diesel Issue': [places[0].name] });
    run('u => { DSRC_U_ = u; }', RAVI);
    const f1 = run('d => saveDieselIssue_(d)', fill('HO-1-164', HD, 10, 1050));
    assert.strictEqual(f1.ok, true, JSON.stringify(f1));
    run('(e) => { DSRC_U_ = null; dsrcSet_(e, { "Diesel Issue": null }, "sa"); }', RAVI.email);
    const row = id => run('id => { const t = table_(APP.SHEET_DIESEL, DIESEL_COLS_); const r = t.rows.find(x => String(x[t.c[H.ID]]) === id); return { src: r[t.c[H.SOURCE]], amount: r[t.c[H.AMOUNT]], rate: r[t.c[H.RATE]] }; }', id);
    assert.deepStrictEqual(row(f1.id), { src: HD, amount: 1050, rate: 105 }, 'the card in Diesel Source, the ₹ and the rate (Amount ÷ Qty)');
    assert.strictEqual(f1.stock.cards.find(c => c.name === HD).balance, 3950, 'the balance after the fill comes back with the save');
    const cash = run('d => saveDieselIssue_(d)', fill('HO-2-164', 'cash', 10, 900, '', { rate: 90 }));
    assert.deepStrictEqual(row(cash.id), { src: 'Cash', amount: 900, rate: 90 });
    // no stock: a fill is never refused for litres; a short balance is saved (the fuel is already in the car)
    const big = run('d => saveDieselIssue_(d)', fill('HO-1-164', IC, 15, 1500));
    assert.strictEqual(big.ok, true);
    assert.strictEqual(big.stock.cards.find(c => c.name === IC).balance, -500, 'shown red on the page – not refused');
    assert.strictEqual(run('() => getStock_().stock'), 0, 'no diesel stock');
    // stock entries are not made at a site on fuel cards
    assert.match(tryRun('x => saveInward_(x)', { date: '2026-07-06', location: places[0].name, pump: 'P', qty: 100, rate: 90, billNo: 'X1', billDate: '2026-07-06' }).thrown, /^This site is on fuel cards – it keeps no diesel stock, so a Diesel Inward is not made here/);
    assert.match(tryRun('x => saveTransfer_(x)', { date: '2026-07-06', shift: 'Day', from: places[0].name, to: places[1] ? places[1].name : 'X', qty: 5 }).thrown, /so a Diesel Transfer is not made here/);
    assert.match(tryRun('b => saveDieselBulk_(b)', { date: '2026-07-06', shift: 'Day', source: HD, rows: [{ no: 'HO-1-164', qty: 1 }] }).thrown, /"Multiple entries" of diesel issues is not made here/);
    assert.match(tryRun('r => importDiesel_(r)', [{ line: 2, date: '2026-07-06', shift: 'Day', no: 'HO-1-164', qty: 1, source: HD }]).thrown, /an Excel import of diesel issues is not made here/);
    // a change of a fill: its new ₹ (and Cash → the card's balance comes back)
    const up = run('(id, d) => updateDieselIssue_(id, d)', big.id, fill('HO-1-164', 'Cash', 15, 1400));
    assert.strictEqual(up.ok, true);
    assert.deepStrictEqual(row(big.id), { src: 'Cash', amount: 1400, rate: 93.33 });
    assert.strictEqual(up.stock.cards.find(c => c.name === IC).balance, 1000);
    run('(id, d) => updateDieselIssue_(id, d)', big.id, fill('HO-1-164', IC, 15, 1500));
    // inactive: no new fill on it
    run('x => saveCard_(x)', { was: IC, name: IC, type: 'Credit card', cars: ['HO-1-164'], opening: 1000, openDate: '2026-07-05', active: false });
    assert.strictEqual(refused(fill('HO-1-164', IC, 5, 500, '2026-07-07')), 'HO-1-164: card ICICI CREDIT is Inactive (Fuel Cards) – pick another card or Cash.');
    run('x => saveCard_(x)', { was: IC, name: IC, type: 'Credit card', cars: ['HO-1-164'], opening: 1000, openDate: '2026-07-05' });
    // a card with entries keeps its name; its opening date not after its first entry
    assert.strictEqual(tryRun('x => saveCard_(x)', { was: IC, name: 'ICICI NEW', type: 'Credit card', opening: 1000, openDate: '2026-07-05' }).thrown, 'Card ICICI CREDIT has entries – its name stays (it can be made Inactive).');
    assert.strictEqual(tryRun('x => saveCard_(x)', { was: IC, name: IC, type: 'Credit card', opening: 1000, openDate: '2026-07-07' }).thrown, 'Card ICICI CREDIT has entries from 06-07-2026 – its opening date can be at most that day.');
    // ---- payments onto a card
    const pBad = x => tryRun('x => saveCardPayment_(x)', Object.assign({ date: '2026-07-07', card: IC, amount: 2000, ref: 'NEFT 1' }, x)).thrown;
    assert.strictEqual(pBad({ card: '' }), 'Pick the card the payment was made onto.');
    assert.strictEqual(pBad({ amount: 0 }), 'Enter the amount paid onto card ICICI CREDIT (₹).');
    assert.strictEqual(pBad({ date: '2026-07-04' }), 'Card ICICI CREDIT starts on 05-07-2026 (its opening balance) – a payment of 04-07-2026 is already in that balance.');
    const p1 = run('x => saveCardPayment_(x)', { date: '2026-07-07', card: 'icici credit', amount: 2000, ref: 'NEFT 1' });
    assert.strictEqual(p1.id, 'CP-000001');
    assert.strictEqual(p1.stock.cards.find(c => c.name === IC).balance, 1500, '1000 − 1500 + 2000');
    assert.strictEqual(run('(id, x) => updateCardPayment_(id, x)', p1.id, { date: '2026-07-07', card: IC, amount: 2500, ref: 'NEFT 1' }).cards.find(c => c.name === IC).balance, 2000);
    const p2 = run('x => saveCardPayment_(x)', { date: '2026-07-08', card: HD, amount: 100, remark: 'top-up' });
    assert.strictEqual(run('id => deleteCardPayment_(id)', p2.id).cards.find(c => c.name === HD).balance, 3950);
    const pl = run('() => getCardPayments_({ from: "2026-07-01", to: "2026-07-31" })');
    assert.deepStrictEqual([pl.count, pl.total, pl.rows[0].id, pl.rows[0].ref], [1, 2500, 'CP-000001', 'NEFT 1']);
    // ---- the statement of a card
    const st = run('() => cardStatement_({ card: "ICICI CREDIT", from: "2026-07-07", to: "2026-07-31" })');
    assert.deepStrictEqual([st.opening, st.lines.length, st.lines[0].kind, st.lines[0].in, st.closing], [-500, 1, 'Payment', 2500, 2000], 'the fill of 06-07 is in the opening of 07-07');
    const st2 = run('() => cardStatement_({ card: "ICICI CREDIT" })');
    assert.deepStrictEqual([st2.from, st2.opening, st2.lines.map(x => x.kind + ':' + x.balance)], ['2026-07-05', 1000, ['Fill:-500', 'Payment:2000']]);
    assert.strictEqual(st2.lines[0].no, 'HO-1-164');
    // ---- the lists: the ₹ of each card / Cash; the fuels apart (a fill's fuel = its machinery's)
    const li = run('() => getDieselIssues_({ from: "2026-07-06", to: "2026-07-06", no: "164" })');
    assert.deepStrictEqual(li.byPay, { [HD]: 1050, Cash: 900, [IC]: 1500 });
    assert.strictEqual(li.totalAmount, 3450);
    assert.deepStrictEqual([li.byFuel.Petrol, li.byFuel.Diesel], [25, 10]);
    assert.strictEqual(li.rows.find(r => r.id === f1.id).amount, 1050);
    // ---- the dashboard of a site on fuel cards
    run('x => saveLogRowsInner_(x)', { rows: [{ date: '2026-07-06', shift: 'Full Day', no: 'HO-1-164', mode: 'KM', openingKm: 1000, closingKm: 1250 }] });
    const dd = run('() => cardDash_({ from: "2026-07-01", to: "2026-07-31" })');
    const c164 = dd.cars.find(x => x.no === 'HO-1-164');
    assert.deepStrictEqual([c164.fuel, c164.unit, c164.qty, c164.amount, c164.card, c164.cash, c164.fills, c164.km, c164.avg], ['Petrol', 'Ltr', 25, 2550, 2550, 0, 2, 250, 10]);
    assert.deepStrictEqual([c164.last.date, c164.last.paidBy, c164.last.amount], ['2026-07-06', IC, 1500]);
    assert.strictEqual(dd.cars.find(x => x.no === 'HO-2-164').cash, 900);
    assert.deepStrictEqual(dd.cards.map(c => c.name + ':' + c.balance), [HD + ':3950', IC + ':2000']);
    assert.strictEqual(dd.total.amount, Math.round(dd.cars.reduce((s, x) => s + x.amount, 0) * 100) / 100);
    assert.strictEqual(tryRun('() => cardDash_({ from: "2026-07-31", to: "2026-07-01" })').thrown, 'From date is after To date.');
    // ---- back to diesel stock: not once a fill was paid by a card or in Cash
    assert.strictEqual(tryRun('(l, m) => savePlaces_(l, m)', places, 'stock').thrown, 'This site has fills paid by a fuel card or in Cash (or payments onto a card) – it stays on fuel cards.');
    assert.strictEqual(run('() => placesInfo_().cardEntries'), true);
    // ---- the actions and their access; the Portal's door passes the mode
    const api = require('vm').runInContext('API_', ctx);
    assert.deepStrictEqual(Array.from(api.getCards.any), ['Fuel Cards', 'Diesel Issue', 'Dashboard'], 'the driver sees the balances');
    ['saveCard', 'saveCardPayment', 'updateCardPayment', 'deleteCardPayment'].forEach(n => assert.ok(api[n].edit && api[n].m === 'Fuel Cards', n));
    assert.strictEqual(api.getCardDash.m, 'Dashboard');
    assert.deepStrictEqual(run('() => SYNC_GROUPS_["Fuel Cards"]'), ['stock']);
    const portalJs = fs.readFileSync(path.join(root, 'server', 'portal.js'), 'utf8');
    assert.ok(portalJs.indexOf("c.mode === 'card' || c.mode === 'stock' ? { mode: c.mode } : {}") > -1);
    // ---- the database step: only adds; in Read Me word for word; the check names it
    const sql = fs.readFileSync(path.join(root, 'sql', 'supabase_step1zh_fuel_cards.sql'), 'utf8');
    const code = sql.replace(/--.*$/gm, '');
    assert.ok(!/\b(delete\s+from|truncate|update\s+public\.)/i.test(code) && !/drop (table|column)/i.test(code), 'nothing removed or changed (the triggers only note a change / a delete)');
    ['alter table public.diesel_issue add column if not exists rate numeric;', 'alter table public.diesel_issue add column if not exists amount numeric;', 'create table if not exists public.card_payments (', 'alter table public.app_users add column if not exists perm_fuel_cards text;']
      .forEach(k => assert.ok(sql.indexOf(k) > -1, k));
    const listed = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1zh_fuel_cards.sql');
    assert.ok(listed && listed.sql === sql, 'Read Me shows the file word for word');
    assert.ok(fs.readFileSync(path.join(root, 'staging', 'rcl_staging_all.sql'), 'utf8').indexOf(sql) > -1, 'the test database has it');
    assert.ok(fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8').indexOf("'supabase_step1zh_fuel_cards.sql');      // (update-164)") > -1);
  } finally {
    run('() => { const P = PropertiesService.getScriptProperties(); P.deleteProperty("FUEL_MODE"); P.deleteProperty("FUEL_CARDS"); DSRC_U_ = null; }');
  }
});

test('update-164 fix: the sign-in starts the live sync again (a note had been put in the middle of the line – everything after it was a comment)', () => {
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.match(app, /S\.fuelMode = d\.fuelMode \|\| ''; siteBoot\(d\.siteInfo\); applyPerms\(\); startSync\(\); setClosed\(S\.closedUpto\); dbCheckDaily\(\); try \{ rtcAfterLogin\(\); \}/);
  // each of them runs: on its line no "//" comes before it
  ['startSync();', 'dbCheckDaily();', 'rtcAfterLogin();'].forEach(c => {
    const lines = app.split('\n').filter(l => l.indexOf(c) > -1 && !/function /.test(l));
    assert.ok(lines.length >= 1, c + ' is called');
    lines.forEach(l => { const before = l.slice(0, l.indexOf(c)); assert.ok(!/(^|[^:'"\/])\/\/(?![^']*'[^']*$)/.test(before), c + ' is not inside a comment: ' + l.trim().slice(0, 160)); });
  });
});


test('update-166: a fuel card\'s details – its bank / company, the name on it, its expiry (month / year, marked when it ends within 30 days or has ended), the customer / account ID; the number stays only its last 4 digits', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const C = 'HDFC FLEET 166';
  try {
    run('() => { const P = PropertiesService.getScriptProperties(); P.deleteProperty("FUEL_MODE"); P.deleteProperty("FUEL_CARDS"); }');
    const places = run('() => places_().map(p => ({ name: p.name, cap: tankSettings_().caps[p.name] || 100, fuel: p.fuel }))');
    run('(l, m) => savePlaces_(l, m)', places, 'card');
    const card = x => Object.assign({ name: C, type: 'Fuel card', last4: '4321', opening: 5000, openDate: '2026-07-01', cars: [] }, x);
    // a card of before (no details): as it was
    const old = run('x => saveCard_(x)', card({}));
    assert.ok(old.ok && old.added);
    const c0 = run('() => cardBalances_()[0]');
    assert.deepStrictEqual([c0.issuer, c0.holder, c0.expiry, c0.custId, c0.expDays], ['', '', '', '', null], 'no details: nothing shown, no expiry mark');
    // the details kept and given back (the page and the phone alike)
    const sv = run('x => saveCard_(x)', card({ was: C, issuer: '  HDFC  Bank ', holder: 'Rachana Construction Ltd', expiry: '2029-08', custId: 'CUST 778899' }));
    assert.ok(sv.ok && !sv.added);
    const c1 = run('() => cardBalances_()[0]');
    assert.deepStrictEqual([c1.issuer, c1.holder, c1.expiry, c1.custId, c1.last4, c1.balance], ['HDFC Bank', 'Rachana Construction Ltd', '2029-08', 'CUST 778899', '4321', 5000]);
    assert.ok(c1.expDays > 30, 'a far expiry: no mark');
    assert.match(sv.summary, /HDFC Bank, in the name of Rachana Construction Ltd, expiry 08\/2029, customer ID CUST 778899/, 'the Activity Log says the details');
    assert.match(sv.changes, /^Before: HDFC FLEET 166 – Fuel card, …4321, opening/, 'and how it was before');
    // the expiry typed as the page's month box gives it, or as it is printed on a card
    ['2029-08', '08/2029', '8/29', '08-29', '08.2029'].forEach(v => { run('x => saveCard_(x)', card({ was: C, expiry: v })); assert.strictEqual(run('() => cards_()[0].expiry'), '2029-08', v); });
    run('x => saveCard_(x)', card({ was: C, expiry: '' }));
    assert.strictEqual(run('() => cards_()[0].expiry'), '', 'the expiry taken out');
    ['13/2029', '00/2029', 'aug 2029', '2029-8-1', '08/1999'].forEach(v => assert.strictEqual(tryRun('x => saveCard_(x)', card({ was: C, expiry: v })).thrown, 'Card ' + C + ': the expiry is its month and year (e.g. 08/2029).', v));
    // the days to its last good day: this month = till its last day; last month = ended (below 0)
    const t = run('() => today_()'), y = +t.slice(0, 4), m = +t.slice(5, 7), end = new Date(Date.UTC(y, m, 0)).getUTCDate();
    run('x => saveCard_(x)', card({ was: C, expiry: t.slice(0, 7) }));
    assert.strictEqual(run('() => cardBalances_()[0].expDays'), end - +t.slice(8, 10), 'ends this month: the days till its last day');
    const pm = m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
    run('x => saveCard_(x)', card({ was: C, expiry: pm }));
    assert.ok(run('() => cardBalances_()[0].expDays') < 0, 'ended last month: below 0 (Expired)');
    // the whole card number is never kept – not in another box either
    const whole = 'Card ' + C + ': that is the whole card number – it is never kept. Type only its LAST 4 digits (and the customer / account ID of the card programme, not the card number).';
    assert.strictEqual(tryRun('x => saveCard_(x)', card({ was: C, custId: '4111 1111 1111 1111' })).thrown, whole);
    assert.strictEqual(tryRun('x => saveCard_(x)', card({ was: C, holder: '5500-0000-0000-0004' })).thrown, whole);
    assert.strictEqual(tryRun('x => saveCard_(x)', card({ was: C, last4: '4111111111111111' })).thrown, 'Card ' + C + ': type only the LAST 4 digits of the card number (never the whole number).');
    run('x => saveCard_(x)', card({ was: C, custId: '1234567890' }));
    assert.strictEqual(run('() => cards_()[0].custId'), '1234567890', 'a customer ID of 10 digits is kept');
    run('x => saveCard_(x)', card({ was: C, custId: '4111111111111112' }));
    assert.strictEqual(run('() => cards_()[0].custId'), '4111111111111112', '16 digits that are no card number (the card check) are kept');
    assert.strictEqual(tryRun('x => saveCard_(x)', card({ was: C, issuer: 'B'.repeat(61) })).thrown, 'Card ' + C + ': the bank / company is up to 60 letters.');
    assert.strictEqual(tryRun('x => saveCard_(x)', card({ was: C, holder: 'H'.repeat(61) })).thrown, 'Card ' + C + ': the name on the card is up to 60 letters.');
    assert.strictEqual(tryRun('x => saveCard_(x)', card({ was: C, custId: 'C'.repeat(41) })).thrown, 'Card ' + C + ': the customer / account ID is up to 40 letters.');
    assert.ok(run('() => JSON.stringify(cards_())').indexOf('4111 1111') === -1, 'nothing of a refused number is kept');
    // the page: the boxes, sent with the card, shown in the list and on the tile
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    ['id="cd_issuer"', 'id="cd_holder"', 'id="cd_exp" type="month"', 'id="cd_cust"', "issuer: val('cd_issuer'), holder: val('cd_holder'), expiry: $('cd_exp').value, custId: val('cd_cust')", '<th>Last 4</th><th>Expiry</th>', "c.expDays < 0 ? { cls: 'cd-exp bad', text: 'Expired '"].forEach(x => assert.ok(app.indexOf(x) > -1, x));
  } finally {
    run('() => { const P = PropertiesService.getScriptProperties(); ["FUEL_MODE", "FUEL_CARDS", "DIESEL_PLACES"].forEach(k => P.deleteProperty(k)); }');
  }
});

test('update-165: the Maintenance Log Book of a site on fuel cards (HO): a bill with its lines (work / part and ₹), a Service mark with its KM, the checks; the list and the words typed before; the AI\'s reading of a bill; a car\'s log book (its fills and bills, the costs, the last service); a car\'s new number; a site not on cards as before', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const car = no => ({ no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 12, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-07-01', fuel: 'Petrol' });
  const C1 = 'HO-1-165', C2 = 'HO-2-165', CARD = 'HDFC MNT 165';
  try {
    // ---- a site that is not on fuel cards: (update-170) Maintenance there too – listed, read (update-165: refused there)
    run('() => { const P = PropertiesService.getScriptProperties(); P.deleteProperty("FUEL_MODE"); P.deleteProperty("FUEL_CARDS"); }');
    assert.strictEqual(run('() => usersAdmin_().modules.some(m => m.key === "Maintenance")'), true, 'update-170: the Portal lists Maintenance at a site with stock too');
    assert.ok(Array.isArray(run('x => getMaint_(x)', {}).rows), 'update-170: its bills are read there');
    assert.strictEqual(run('() => usersAdmin_().modules.some(m => m.key === "Fuel Cards")'), false, 'Fuel Cards still only on fuel cards');
    // ---- HO: on fuel cards; two cars; the page listed; an empty access cell is No access
    const places = run('() => places_().map(p => ({ name: p.name, cap: tankSettings_().caps[p.name] || 100, fuel: p.fuel }))');
    run('(l, m) => savePlaces_(l, m)', places, 'card');
    assert.ok(run('() => usersAdmin_().modules.some(m => m.key === "Maintenance")'), 'the Portal lists Maintenance at a site on fuel cards');
    assert.strictEqual(run('() => MODULE_BLANK_NONE_.Maintenance'), true);
    run('(x, m) => saveMaster_(x, m)', car(C1), 'add');
    run('(x, m) => saveMaster_(x, m)', car(C2), 'add');
    // ---- the checks of a bill
    const bill = x => Object.assign({ date: '2026-07-05', no: C1, garage: 'Toyota Service', billNo: 'TS-101', km: 45210, service: true, remark: '',
      lines: [{ work: 'Engine oil', amount: 1200 }, { work: 'Oil filter', amount: 300 }, { work: 'Labour', amount: 500 }, { work: 'GST 18%', amount: 360 }] }, x);
    const bad = x => tryRun('x => saveMaint_(x)', bill(x)).thrown;
    assert.strictEqual(bad({ lines: [] }), 'Add the work / parts of the bill, each with its amount (₹).');
    assert.strictEqual(bad({ lines: [{ work: '', amount: '' }, { work: '  ', amount: 0 }] }), 'Add the work / parts of the bill, each with its amount (₹).', 'empty lines are left out');
    assert.strictEqual(bad({ lines: [{ work: '', amount: 500 }] }), 'Bill line 1: type the work / part (e.g. Engine oil, Labour).');
    assert.strictEqual(bad({ lines: [{ work: 'Wiper', amount: '' }] }), 'Bill line 1 (Wiper): enter its amount (₹).');
    assert.strictEqual(bad({ lines: [{ work: 'Wiper', amount: 100 }, { work: 'Discount', amount: -150 }] }), 'The total of the bill cannot be below 0 – check the amounts (a discount is a minus line).');      // (update-168: a bill of only free lines – ₹ 0 – is kept; below 0 is not)
    assert.strictEqual(bad({ km: '' }), C1 + ': a service needs its reading (KM / Hrs) – the next service is counted from it.');      // (update-170: KM or Hrs)
    assert.match(bad({ date: '2026-06-30' }), /is active only from 01-07-2026/, 'the car must be on site that day');
    assert.match(bad({ no: 'NOT-A-CAR' }), /is not in Master/);
    assert.match(bad({ date: '2099-01-01' }), /after today|future/i);
    assert.strictEqual(bad({ lines: Array.from({ length: 151 }, (_, i) => ({ work: 'Part ' + i, amount: 1 })) }), 'A bill keeps at most 150 lines.');      // (update-168: 150 – an accident bill had 65)
    // ---- two bills; the same bill number of the same garage again: asked first
    const b1 = run('x => saveMaint_(x)', bill({}));
    assert.deepStrictEqual([b1.ok, b1.id, b1.total], [true, 'MT-000001', 2360]);
    const b2 = run('x => saveMaint_(x)', bill({ date: '2026-07-20', billNo: 'TS-140', service: false, km: '', garage: 'Tyre House',
      lines: [{ work: 'Tyre', amount: 6000 }, { work: 'Wheel alignment', amount: 600 }, { work: 'Discount', amount: -100 }, { work: 'engine oil', amount: 400 }] }));
    assert.deepStrictEqual([b2.id, b2.total], ['MT-000002', 6900]);
    const tw = run('x => saveMaint_(x)', bill({}));
    assert.strictEqual(tw.ok, false);
    assert.strictEqual(tw.warning, 'Bill TS-101 of Toyota Service for ' + C1 + ' is already saved (MT-000001). Save it again?');
    const b3 = run('x => saveMaint_(x)', bill({ force: true, no: C2, billNo: 'X-9', service: false, km: '' }));
    assert.strictEqual(b3.id, 'MT-000003');
    // ---- a change: the lines and the total; a delete
    const u = run('(id, x) => updateMaint_(id, x)', 'MT-000003', bill({ no: C2, billNo: 'X-9', service: false, km: 1200, lines: [{ work: 'Battery', amount: 5200 }] }));
    assert.deepStrictEqual([u.ok, u.total], [true, 5200]);
    assert.strictEqual(tryRun('id => deleteMaint_(id)', 'MT-000099').thrown, 'Maintenance bill MT-000099 was not found.');
    // ---- the list: newest first; the words typed before, the most used first
    const l = run('x => getMaint_(x)', { from: '2026-07-01', to: '2026-07-31' });
    assert.deepStrictEqual([l.count, l.total, l.rows.map(r => r.id)], [3, 14460, ['MT-000002', 'MT-000003', 'MT-000001']]);
    assert.deepStrictEqual(l.rows[2].lines, [{ work: 'Engine oil', type: 'Paid', amount: 1200 }, { work: 'Oil filter', type: 'Paid', amount: 300 }, { work: 'Labour', type: 'Paid', amount: 500 }, { work: 'GST 18%', type: 'Paid', amount: 360 }]);      // (update-168: each line its kind – none given = Paid)
    assert.deepStrictEqual([l.rows[2].service, l.rows[2].km, l.rows[2].garage, l.rows[2].billNo], [true, 45210, 'Toyota Service', 'TS-101']);
    assert.strictEqual(l.works[0], 'Engine oil', '"Engine oil" / "engine oil" – one word, used twice');
    assert.deepStrictEqual(l.garages.slice().sort(), ['Toyota Service', 'Tyre House']);
    assert.strictEqual(run('x => getMaint_(x)', { no: C2 }).count, 1, 'one car');
    run('id => deleteMaint_(id)', 'MT-000003');
    assert.strictEqual(run('x => getMaint_(x)', {}).count, 2);
    // ---- files: only one this person sent (as the Log Book's attachments); the store is Supabase only
    assert.strictEqual(tryRun('x => saveMaint_(x)', bill({ billNo: 'F-1', files: [{ sha: 'a'.repeat(64) }] })).thrown, 'A bill file was not added by you in the last 6 hours – add it again.');
    assert.strictEqual(tryRun('x => saveMaint_(x)', bill({ billNo: 'F-2', files: 'x' })).thrown, 'The bill files were not sent right – add them again.');
    assert.strictEqual(tryRun('(u, x) => uploadAttachment_(u, x, "Maintenance")', { email: 'sa@x', admin: true, perms: { Maintenance: 'Edit' } }, { data: 'data:text/html;base64,PGI+' }).thrown, 'An attachment must be a photo (JPG or PNG) or a PDF.');      // (a real upload: the rig – this test's Utilities cannot decode)
    assert.strictEqual(tryRun('(u, x) => uploadAttachment_(u, x, "Maintenance")', { email: 'v@x', admin: false, perms: { Maintenance: 'View' } }, { data: 'data:application/pdf;base64,JVBERi0xLjQK' }).thrown, 'You have View access only for Maintenance. Ask Admin for Edit access.');
    // ---- the AI's reading of a bill (its answer → the form's values); a PDF goes as a PDF
    const ans = j => run('j => maintAnswer_(j)', j);
    const a1 = ans({ date: '2026-07-05', billNo: 'TS-101', garage: 'Toyota Service', vehicle: 'MH12HO1165', km: '45,210', service: true, total: '2,360.00',
      lines: [{ work: 'Engine oil', amount: '1,200' }, { item: 'Oil filter', amount: 300 }, { work: 'Labour', amount: 500 }, { work: 'CGST 9%', amount: 180 }, { work: 'SGST 9%', amount: 180 }, { work: 'Nothing', amount: 0 }] });
    assert.deepStrictEqual([a1.date, a1.billNo, a1.garage, a1.km, a1.total, a1.service, a1.check, a1.lines.length], ['2026-07-05', 'TS-101', 'Toyota Service', 45210, 2360, true, '', 6]);
    assert.deepStrictEqual(a1.lines[5], { work: 'Nothing', type: 'FOC', amount: 0 }, '(update-168) a line charged nothing is kept – as a free one');
    const a2 = ans({ date: '2099-01-01', lines: [{ work: 'Tyre', amount: 6000 }, { work: 'Discount', amount: '-100' }], total: 6000 });
    assert.deepStrictEqual([a2.date, a2.lines[1].amount, a2.check], ['', -100, 'the lines read add up to ₹5900 – the bill says ₹6000']);
    assert.strictEqual(ans({}).check, 'no line of the bill could be read');
    assert.deepStrictEqual(run('() => maintRead_({ email: "e@x", admin: true, perms: { Maintenance: "Edit" } }, { data: "data:application/pdf;base64,JVBERi0xLjQK" })'), { off: true }, 'the AI is not set up here');
    assert.strictEqual(tryRun('() => maintRead_({ email: "e@x", admin: true, perms: { Maintenance: "Edit" } }, { data: "data:text/html;base64,PGI+" })').thrown, 'A bill must be a photo (JPG or PNG) or a PDF.');
    const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
    assert.match(code, /return maintAnswer_\(aiJson_\(aiAskPhoto_\(mt\[2\], ask, mt\[1\], 'the bill'\)\) \|\| \{\}\);/, 'a PDF goes to the AI as a PDF (its own type)');
    assert.match(code, /parts: \[\{ inlineData: \{ mimeType: mime \|\| 'image\/jpeg', data: b64 \} \}, \{ text: ask \}\]/, 'the meter photos as before (JPG)');
    // ---- the car's log book: its fills (card / Cash) and bills by date, the costs, the last service
    run('x => saveCard_(x)', { name: CARD, last4: '1165', type: 'Fuel card', cars: [], opening: 10000, openDate: '2026-07-01' });
    run('x => saveDieselIssue_(x)', { date: '2026-07-04', shift: 'Day', source: CARD, no: C1, qty: 20, kmReading: 45000, amount: 2100, force: true });
    run('x => saveDieselIssue_(x)', { date: '2026-07-22', shift: 'Day', source: 'Cash', no: C1, qty: 10, kmReading: 45600, amount: 1060, force: true });
    run('x => saveDieselIssue_(x)', { date: '2026-08-02', shift: 'Day', source: 'Cash', no: C1, qty: 10, kmReading: 46000, amount: 1070, force: true });
    const g = run('x => maintLog_(x)', { no: C1, from: '2026-07-01', to: '2026-07-31' });
    assert.strictEqual(g.title, 'Maintenance Log Book – ' + C1);
    assert.deepStrictEqual(g.lines.map(x => x.date + ' ' + x.kind + ' ' + x.amount), ['2026-07-04 Fuel 2100', '2026-07-05 Maintenance 2360', '2026-07-20 Maintenance 6900', '2026-07-22 Fuel 1060'], 'by date, the August fill not in July');
    assert.deepStrictEqual([g.lines[0].paidBy, g.lines[0].qty, g.lines[0].unit, g.lines[3].paidBy], [CARD, 20, 'Ltr', 'Cash']);
    assert.deepStrictEqual(g.total.fuel, { qty: 30, amount: 3160, card: 2100, cash: 1060, fills: 2 });
    assert.deepStrictEqual(g.total.maint, { amount: 9260, bills: 2, billTotal: 9260, insurance: 0, free: 0 });      // (update-168: the bills' total, what the insurance paid, what the free lines were worth)
    assert.strictEqual(g.total.all, 12420);
    assert.deepStrictEqual(g.total.byWork.slice(0, 2), [{ work: 'Tyre', amount: 6000, n: 1 }, { work: 'Engine oil', amount: 1816, n: 2 }]);      // (update-172: its bill's "GST 18%" line on its items – 1,200 + 18 %)
    assert.deepStrictEqual([g.total.km, g.total.perKm], [0, null], 'no Log Book KM yet: no ₹ per KM');
    assert.deepStrictEqual(g.lastService, { date: '2026-07-05', km: 45210, id: 'MT-000001' });
    assert.deepStrictEqual(run('x => maintLog_(x)', { no: C2, from: '2026-07-01', to: '2026-07-31' }).lines, [], 'the other car: nothing of this car');
    // ---- a new number of the car: its bills follow
    run('(a, b) => renameMachine_(a, b)', C1, 'HO-9-165');
    assert.strictEqual(run('x => getMaint_(x)', { no: 'HO-9-165' }).count, 2);
    assert.strictEqual(run('x => getMaint_(x)', { no: C1 }).count, 0);
    // ---- the access and the actions; the database step only adds; Read Me lists it; the database check knows it
    const api = run('() => { const o = {}; Object.keys(API_).forEach(k => { o[k] = { m: API_[k].m, edit: !!API_[k].edit, any: API_[k].any || null }; }); return o; }');
    ['saveMaint', 'updateMaint', 'deleteMaint'].forEach(n => assert.ok(api[n].edit && api[n].m === 'Maintenance', n));
    ['getMaint', 'getMaintFiles', 'maintFile', 'readMaintBill'].forEach(n => assert.ok(!api[n].edit && api[n].m === 'Maintenance', n));
    assert.deepStrictEqual(api.maintLog.any, ['Maintenance', 'Reports']);
    const sql = fs.readFileSync(path.join(root, 'sql', 'supabase_step1zi_maintenance.sql'), 'utf8');
    const sqlCode = sql.replace(/--.*$/gm, '');
    assert.ok(!/\b(delete\s+from|truncate|update\s+public\.)/i.test(sqlCode) && !/drop (table|column)/i.test(sqlCode), 'nothing removed or changed (the triggers only note a change / a delete)');
    assert.ok(fs.readFileSync(path.join(root, 'staging', 'rcl_staging_all.sql'), 'utf8').indexOf(sql) > -1, 'the test database has it');
    assert.match(sql, /create table if not exists public\.maintenance \(/);
    assert.match(sql, /alter table public\.app_users add column if not exists perm_maintenance text;/);
    const listed = new Function(fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8') + '; return README_SQL_;')().find(x => x.name === 'supabase_step1zi_maintenance.sql');
    assert.ok(listed && listed.sql === sql, 'Read Me lists the step word for word');
    assert.ok(code.indexOf("'supabase_step1zi_maintenance.sql');      // (update-165)") > -1);
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /mnt: \{ saves: \['saveMaint', 'updateMaint', 'deleteMaint', 'maintFile', 'readMaintBill'\],/);
    assert.ok(!/if \(\$\('tab-mnt'\) && !cm\) \$\('tab-mnt'\)\.hidden = true;/.test(app), 'update-170: the menu has Maintenance at every site (was: only on fuel cards)');
    assert.match(app, /try \{ const r = await call\(o\.up \|\| 'uploadAttachment', \{ data: 'data:' \+ it\.mime/, 'the bill files use the attachments\' own box');
  } finally {
    run('() => { const P = PropertiesService.getScriptProperties(); ["FUEL_MODE", "FUEL_CARDS", "MNT_LAST_NO", "CARDPAY_LAST_NO"].forEach(k => P.deleteProperty(k)); }');
  }
});

test('update-167: Claude – with ANTHROPIC_API_KEY every AI question goes to Claude in its own words (the assistant, its look-ups, photos, PDF bills, the test); the page\'s conversation is unchanged; busy / no credit / a wrong key are said; Gemini stays as it was', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const sent = [], answers = []; let waited = 0, service = 'claude';
  const reply = (code, obj) => ({ code: code, text: typeof obj === 'string' ? obj : JSON.stringify(obj) });
  ctx.__ai = { on: () => true, service: () => service, model: () => '', wait: ms => { waited += ms; },
    call: (method, p, body, ms) => { sent.push({ method: method, path: p, body: body === null || body === undefined ? null : JSON.parse(JSON.stringify(body)), ms: ms }); const a = answers.shift(); return a ? a : reply(500, { type: 'error', error: { type: 'api_error', message: 'nothing queued' } }); } };
  const list = reply(200, { data: [{ id: 'claude-haiku-5-5', created_at: '2026-06-01T00:00:00Z' }, { id: 'claude-opus-5-5', created_at: '2026-06-02T00:00:00Z' }, { id: 'claude-sonnet-5-5', created_at: '2026-06-02T00:00:00Z' },
    { id: 'claude-sonnet-4-5-20250929', created_at: '2025-09-29T00:00:00Z' }, { id: 'claude-haiku-4-5-20251001', created_at: '2025-10-01T00:00:00Z' }], has_more: false });
  const msg = (content, stop) => reply(200, { id: 'msg_1', type: 'message', role: 'assistant', content: content, stop_reason: stop || 'end_turn', usage: { input_tokens: 900, output_tokens: 40, cache_read_input_tokens: 2100, cache_creation_input_tokens: 0 } });
  const clean = () => run('() => { const P = PropertiesService.getScriptProperties(); ["AI_MODEL_C", "AI_MODEL", "AI_PLAIN"].forEach(k => P.deleteProperty(k)); }');
  const u = { name: 'Sujit', email: 'sujit@x.test', admin: true };
  try {
    clean();
    assert.deepStrictEqual(run('() => aiInfo_()'), { on: true, service: 'Claude' });
    // the look-ups in Claude's words: JSON Schema in small letters, the same 11, one that takes nothing takes an empty object
    const tools = run('() => aiToolsC_()');
    assert.deepStrictEqual(tools.map(t => t.name), run('() => AI_TOOLS_.map(t => t.name)'));
    assert.ok(tools.every(t => t.input_schema && t.input_schema.type === 'object' && t.description.length > 20) && !/"(OBJECT|STRING|NUMBER)"/.test(JSON.stringify(tools)));
    assert.deepStrictEqual(tools.find(t => t.name === 'diesel_stock').input_schema, { type: 'object', properties: {} });
    assert.deepStrictEqual(tools.find(t => t.name === 'diesel_issues').input_schema.properties.from, { type: 'string', description: 'first date, yyyy-mm-dd' });
    assert.deepStrictEqual(tools.find(t => t.name === 'diesel_issues').input_schema.required, ['from', 'to']);
    // the page's conversation → Claude's: pairs of look-up and result by number; a look-up the page never answered gets "no
    // result" first in the next turn; a result without its look-up is plain text; the same side twice in a row is one turn
    const conv = run('t => aiToClaude_(t)', [
      { role: 'user', parts: [{ text: 'diesel yesterday?' }] },
      { role: 'model', parts: [{ text: 'Looking.' }, { functionCall: { name: 'diesel_issues', args: { from: '2026-10-26', to: '2026-10-26' } } }, { functionCall: { name: 'diesel_stock', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'diesel_stock', response: { litres: 813 } } }, { functionResponse: { name: 'diesel_issues', response: { totalLitres: 240 } } }] },
      { role: 'model', parts: [{ text: '**240 L** yesterday.' }] },
      { role: 'user', parts: [{ text: 'and pending?' }] },
      { role: 'model', parts: [{ functionCall: { name: 'pending_log_book', args: { date: '2026-10-26' } }, thoughtSignature: 'sig' }] },
      { role: 'user', parts: [{ text: 'never mind – who changed MH-12?' }, { functionResponse: { name: 'activity', response: { rows: [] } } }] },
    ]);
    assert.deepStrictEqual(conv.map(m => m.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user']);
    assert.deepStrictEqual(conv[1].content.map(b => b.type + ':' + (b.name || b.text)), ['text:Looking.', 'tool_use:diesel_issues', 'tool_use:diesel_stock']);
    assert.deepStrictEqual(conv[2].content.map(b => b.type + ':' + b.tool_use_id + ':' + b.content), ['tool_result:' + conv[1].content[2].id + ':{"litres":813}', 'tool_result:' + conv[1].content[1].id + ':{"totalLitres":240}'], 'each result to its own look-up, by name');
    assert.ok(/^toolu_\d{4}$/.test(conv[1].content[1].id) && conv[1].content[1].id !== conv[1].content[2].id);
    assert.deepStrictEqual(conv[6].content.map(b => b.type + (b.is_error ? ':error' : '')), ['tool_result:error', 'text', 'text'], 'the unanswered look-up first (no result), then the question, then the stray result as text');
    assert.strictEqual(conv[6].content[0].tool_use_id, conv[5].content[0].id);
    assert.ok(!JSON.stringify(conv).includes('thoughtSignature'), 'Gemini\'s own marks are not sent to Claude');
    assert.deepStrictEqual(run('t => aiToClaude_(t)', [{ role: 'user', parts: [{ text: 'a' }] }, { role: 'user', parts: [{ text: 'b' }] }]).map(m => m.content.length), [2]);
    // Claude's answer → the page's parts (text, functionCall)
    assert.deepStrictEqual(run('c => aiFromClaude_(c)', [{ type: 'text', text: 'Let me look.' }, { type: 'tool_use', id: 'toolu_x', name: 'diesel_issues', input: { from: '2026-10-26', to: '2026-10-26' } }, { type: 'text', text: '  ' }]),
      [{ text: 'Let me look.' }, { functionCall: { name: 'diesel_issues', args: { from: '2026-10-26', to: '2026-10-26' } } }]);

    // 1. a question: the list of models (the newest Sonnet first, then the newest Haiku), then Messages – the rules kept
    // (cache_control), the snapshot after them, the 11 look-ups; the answer a look-up in the page's own words
    answers.push(list, msg([{ type: 'tool_use', id: 'toolu_01', name: 'diesel_issues', input: { from: '2026-10-26', to: '2026-10-26' } }], 'tool_use'));
    let r = run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'How much diesel yesterday?' }] }], context: { page: { tab: 'dash' }, dieselStockNow: { litres: 813 } } });
    assert.deepStrictEqual(r.parts, [{ functionCall: { name: 'diesel_issues', args: { from: '2026-10-26', to: '2026-10-26' } } }]);
    assert.deepStrictEqual([r.model, r.used, r.tries], ['claude-sonnet-5-5', 3040, 1]);
    assert.deepStrictEqual(sent.map(x => x.method + ' ' + x.path), ['GET /v1/models?limit=1000', 'POST /v1/messages']);
    const b = sent[1].body;
    assert.strictEqual(b.model, 'claude-sonnet-5-5');
    assert.ok(b.max_tokens >= 1024 && b.tools.length === 11 && b.messages.length === 1 && b.messages[0].role === 'user' && b.messages[0].content[0].text === 'How much diesel yesterday?');
    assert.deepStrictEqual(b.system[0].cache_control, { type: 'ephemeral' });
    assert.match(b.system[0].text, /Answer ONLY from this app/); assert.match(b.system[0].text, /The person asking is Sujit \(Admin\)\./);
    assert.ok(!/SNAPSHOT/.test(b.system[0].text) && /^9\. SNAPSHOT/.test(b.system[1].text) && /"dieselStockNow":\{"litres":813\}/.test(b.system[1].text), 'the snapshot is after the kept part');
    assert.strictEqual(b.temperature, undefined);
    assert.deepStrictEqual(JSON.parse(run('() => PropertiesService.getScriptProperties().getProperty("AI_MODEL_C")')).list, ['claude-sonnet-5-5', 'claude-haiku-5-5'], 'the order is kept for a day');
    // 2. the next step: the conversation with the look-up and its result; the answer text – the list is not asked again
    sent.length = 0;
    answers.push(msg([{ type: 'text', text: '**240 L** of diesel yesterday.' }]));
    r = run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'How much diesel yesterday?' }] }, { role: 'model', parts: r.parts }, { role: 'user', parts: [{ functionResponse: { name: 'diesel_issues', response: { totalLitres: 240 } } }] }] });
    assert.deepStrictEqual(r.parts, [{ text: '**240 L** of diesel yesterday.' }]);
    assert.deepStrictEqual(sent.map(x => x.path), ['/v1/messages']);
    assert.deepStrictEqual(sent[0].body.messages.map(m => m.role + ':' + m.content.map(c => c.type).join('+')), ['user:text', 'assistant:tool_use', 'user:tool_result']);
    assert.strictEqual(sent[0].body.messages[2].content[0].tool_use_id, sent[0].body.messages[1].content[0].id);
    // 3. busy (529 overloaded): Sonnet again after a short wait, then Haiku – and Haiku is asked first afterwards
    sent.length = 0; waited = 0;
    answers.push(reply(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), reply(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), msg([{ type: 'text', text: 'OK from Haiku.' }]));
    r = run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] });
    assert.deepStrictEqual([r.parts[0].text, r.model, r.tries, sent.map(x => x.body.model).join(',')], ['OK from Haiku.', 'claude-haiku-5-5', 3, 'claude-sonnet-5-5,claude-sonnet-5-5,claude-haiku-5-5']);
    assert.ok(waited >= 1500);
    assert.deepStrictEqual(JSON.parse(run('() => PropertiesService.getScriptProperties().getProperty("AI_MODEL_C")')).list, ['claude-haiku-5-5', 'claude-sonnet-5-5']);
    run('() => PropertiesService.getScriptProperties().setProperty("AI_MODEL_C", JSON.stringify({ list: ["claude-sonnet-5-5", "claude-haiku-5-5"], at: Date.now() }))');
    // every model busy: the words of "busy", the Admin sees what it said
    answers.push(...[1, 2, 3].map(() => reply(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } })));
    assert.throws(() => run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] }), /The AI service is busy right now \(529\).*asked 3 time\(s\).*said: Overloaded/);
    // 4. no credit left / a wrong key: said as it is (not asked again); a refusal: not asked again either
    sent.length = 0;
    answers.push(reply(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } }));
    assert.throws(() => run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] }), /^Error: The AI service has no credit left \(Claude\): the Admin has to add funds in Claude Console → Billing\./);
    assert.strictEqual(sent.length, 1);
    answers.push(reply(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    assert.throws(() => run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] }), /did not accept its key \(401\).*ANTHROPIC_API_KEY/);
    answers.push(reply(400, { type: 'error', error: { type: 'invalid_request_error', message: 'messages: text content blocks must be non-empty' } }));
    assert.throws(() => run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] }), /refused the question \(400\)\. Model claude-sonnet-5-5\. It said: messages: text content blocks/);
    answers.push(msg([], 'max_tokens'));
    assert.throws(() => run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] }), /gave no answer \(max_tokens\)/);

    // 5. a photo (JPG) and a bill (PDF): an image / a document block with the question; JSON read from its answer
    sent.length = 0;
    answers.push(msg([{ type: 'text', text: '```json\n{"litres": 45.5, "amount": 4186, "rate": 92}\n```' }]));
    assert.deepStrictEqual(run('() => pumpAnswer_(aiJson_(aiAskPhoto_("QUJD", "Read the litres. Answer with JSON only.")) || {})'), { litres: 45.5, check: '', amount: 4186, rate: 92 });
    assert.deepStrictEqual(sent[0].body.messages[0].content.map(c => c.type + ':' + (c.source ? c.source.media_type + ':' + c.source.data : c.text)), ['image:image/jpeg:QUJD', 'text:Read the litres. Answer with JSON only.']);
    assert.ok(sent[0].body.max_tokens === 2048 && sent[0].ms <= 25000 && !sent[0].body.tools);
    answers.push(msg([{ type: 'text', text: '{"date": "2026-10-20", "total": 1200, "lines": [{"work": "Oil change", "amount": 1200}]}' }]));
    assert.strictEqual(run('() => aiAskPhoto_("JVBERi0x", "Read the bill.", "application/pdf", "the bill")'), '{"date": "2026-10-20", "total": 1200, "lines": [{"work": "Oil change", "amount": 1200}]}');
    assert.deepStrictEqual([sent[1].body.messages[0].content[0].type, sent[1].body.messages[0].content[0].source.media_type, sent[1].body.max_tokens], ['document', 'application/pdf', 8192]);
    assert.ok(sent[1].ms > 25000 && sent[1].ms <= 50000, 'a bill gets more time');      // (update-168: 50 s)
    answers.push(reply(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }));
    assert.throws(() => run('() => aiAskPhoto_("QUJD", "Read it.")'), /The AI could not read the meter now \(no credit left in Claude Console\) – type the reading\./);
    answers.push(reply(529, {}), reply(529, {}), reply(529, {}));
    assert.throws(() => run('() => aiAskPhoto_("QUJD", "Read it.", "image/jpeg", "the bill")'), /The AI could not read the bill now \(529\) – type it in, or try again\./);

    // 6. "Test the AI service": the service named, the list asked again, one tiny question to each model
    sent.length = 0;
    answers.push(list, msg([{ type: 'text', text: 'OK' }]), reply(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }));
    const chk = run('() => getAiCheck_()');
    assert.deepStrictEqual([chk.key, chk.service, chk.models, chk.tests.map(t => t.model + ':' + t.ok + ':' + t.said)], [true, 'Claude', ['claude-sonnet-5-5', 'claude-haiku-5-5'], ['claude-sonnet-5-5:true:OK', 'claude-haiku-5-5:false:no credit left – add funds in Claude Console → Billing']]);
    assert.deepStrictEqual(sent.slice(1).map(x => [x.body.model, x.body.max_tokens, x.body.messages[0].content]), [['claude-sonnet-5-5', 16, 'Reply with the word OK.'], ['claude-haiku-5-5', 16, 'Reply with the word OK.']]);
    // a list that cannot be read (no connection): the two by name, and asked again in an hour – a wrong key: said at once
    clean(); sent.length = 0;
    answers.push({ code: 0, text: '', error: 'no connection' }, msg([{ type: 'text', text: 'fine' }]));
    r = run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] });
    assert.deepStrictEqual([r.model, sent.map(x => x.path).join(',')], ['claude-sonnet-5-5', '/v1/models?limit=1000,/v1/messages']);
    const keptC = JSON.parse(run('() => PropertiesService.getScriptProperties().getProperty("AI_MODEL_C")'));
    assert.ok(Date.now() - keptC.at > 86400000 - 3600000 - 60000 && Date.now() - keptC.at < 86400000, 'kept for an hour only');
    clean();
    answers.push(reply(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    assert.throws(() => run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }] }), /did not accept its key \(401\)/);

    // 7. Gemini (no Claude key): exactly as before – its own address, its own words, its own kept order
    clean(); service = 'gemini'; sent.length = 0;
    assert.deepStrictEqual(run('() => aiInfo_()'), { on: true, service: 'Gemini' });
    answers.push(reply(200, { models: [{ name: 'models/gemini-9.5-flash', supportedGenerationMethods: ['generateContent'] }] }), reply(200, { candidates: [{ content: { role: 'model', parts: [{ text: 'Gemini here.' }] } }], usageMetadata: { totalTokenCount: 12 } }));
    r = run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'stock?' }] }], context: { page: { tab: 'dash' } } });
    assert.deepStrictEqual([r.parts[0].text, r.model], ['Gemini here.', 'gemini-9.5-flash']);
    assert.deepStrictEqual(sent.map(x => x.path), ['/v1beta/models?pageSize=1000', '/v1beta/models/gemini-9.5-flash:generateContent']);
    assert.ok(sent[1].body.system_instruction && /\n9\. SNAPSHOT – /.test(sent[1].body.system_instruction.parts[0].text) && sent[1].body.tools[0].functionDeclarations.length === 11 && sent[1].body.contents[0].role === 'user');
    assert.strictEqual(run('() => PropertiesService.getScriptProperties().getProperty("AI_MODEL_C")'), null, 'Claude\'s order is kept apart from Gemini\'s');
  } finally {
    delete ctx.__ai; clean();
  }
  // without any key: as before
  assert.deepStrictEqual(run('() => aiInfo_()'), { on: false });
  assert.throws(() => run('(u, x) => getAiReply_(u, x)', u, { contents: [{ role: 'user', parts: [{ text: 'hello' }] }] }), /assistant is not set up yet: the Admin has to put the AI key \(ANTHROPIC_API_KEY – Claude\)/);
  // the server's line (server/gas.js): Claude with its key and its headers when ANTHROPIC_API_KEY is set, else Gemini
  const gas = fs.readFileSync(path.join(root, 'server', 'gas.js'), 'utf8');
  assert.match(gas, /const AI_KEY_C = \(\) => String\(process\.env\.ANTHROPIC_API_KEY \|\| ''\)\.trim\(\);/);
  assert.match(gas, /\{ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application\/json' \}/);
  assert.match(gas, /service: \(\) => AI_KEY_C\(\) \? 'claude' : process\.env\.GEMINI_API_KEY \? 'gemini' : ''/);
  // the page: the not-set-up words name the Claude key; the test says the service; the help names Claude Console
  const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
  assert.ok(!/GEMINI_API_KEY|Google AI Studio in Gemini|Gemini in Google AI Studio/.test(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner('))), 'the help speaks of Claude');
  assert.match(app, /No key on the server \(ANTHROPIC_API_KEY for Claude\)\./);
  assert.match(app, /d\.service === 'Claude' \? 'No model answered\. Check in Claude Console/);
  const H = new Function(app.slice(app.indexOf('const FIX_RULES = ['), app.indexOf('function fixInner(')) + '; return { fixRules, FIX_ANY };')();
  for (const [m, want] of [['The AI service has no credit left (Claude): the Admin has to add funds in Claude Console → Billing. The rest of the app works as always.', /has no credit left, or the key/],
    ['The AI service did not accept its key (401): the Admin has to check ANTHROPIC_API_KEY in the server\'s settings (Vercel → Environment Variables) and Redeploy.', /has no credit left, or the key/],
    ['The AI could not read the meter now (no credit left in Claude Console) – type the reading.', /./],
    ['The AI service is busy right now (529) – that is on its side, not in the app.', /could not get an answer from the AI service \(Claude\)/],
    ['The assistant is not set up yet: the Admin has to put the AI key (ANTHROPIC_API_KEY – Claude) in the server\'s settings.', /Claude Console \(platform\.claude\.com → API keys\)/]]) {
    const got = H.fixRules(m);
    assert.ok(got[0] !== H.FIX_ANY && want.test(got.map(x => x.en.join(' ')).join(' ')), m);
  }
  assert.ok(H.fixRules('The AI could not read the meter now (no credit left in Claude Console) – type the reading.').some(x => /has no credit left, or the key/.test(x.en[0])), 'the photo\'s message also says what to do about the credit');
});

test('update-168: every line of a maintenance bill – its kind (Paid / Warranty / FOC / Service Plan), Qty, Rate, Discount % and ₹; free lines kept at ₹ 0 with their worth; an insurance claim (company, claim no., what it paid) – the car\'s cost is only what we paid; the AI\'s short lines, several invoices and the insurance; an app of before cannot lose them', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const C1 = 'DD-01-G-0168';
  try {
    const places = run('() => places_().map(p => ({ name: p.name, cap: tankSettings_().caps[p.name] || 100, fuel: p.fuel }))');
    run('(l, m) => savePlaces_(l, m)', places, 'card');
    run('(x, m) => saveMaster_(x, m)', { no: C1, name: 'Range Rover Sport', type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2025-09-01', fuel: 'Diesel' }, 'add');
    // ---- his labour bill S2526NMM2-07668: FOC, Paid and Warranty lines; the taxes as their own lines
    const labour = [
      { work: 'Carried out EVHC', type: 'FOC', qty: 1, rate: 0, disc: '', amount: '' },
      { work: 'Read and clear fault code', type: 'Paid', qty: 1, rate: 620, amount: 620 },
      { work: 'Wheel alignment', type: 'Paid', qty: 1, rate: 1860, amount: 1860 },
      { work: 'DEF tank level check and top up', type: 'paid', qty: 1, rate: 620, amount: 620 },
      { work: 'Armrest lid locking arm – renew', type: 'Warranty', qty: 1, rate: 280, amount: 280 },      // (a ₹ typed on a free line is not charged)
      { work: 'Steering column coupling – renew', type: 'Warranty', qty: 1, rate: 840 },
      { work: 'CGST 9%', type: 'Paid', amount: 279 }, { work: 'SGST 9%', amount: 279 }];
    const b1 = run('x => saveMaint_(x)', { date: '2025-12-25', no: C1, garage: 'Navnit Motors Pvt. Ltd.', billNo: 'S2526NMM2-07668', km: 19566, service: false, lines: labour });
    assert.deepStrictEqual([b1.ok, b1.total, b1.billTotal], [true, 3658, 3658], 'the bill\'s grand total ₹3,658 – what we paid');
    let l = run('x => getMaint_(x)', { no: C1 });
    let r = l.rows.find(x => x.id === b1.id);
    assert.deepStrictEqual(r.lines.map(x => x.type + ':' + x.amount), ['FOC:0', 'Paid:620', 'Paid:1860', 'Paid:620', 'Warranty:0', 'Warranty:0', 'Paid:279', 'Paid:279'], 'every line kept with its kind; a free line charged ₹ 0');
    assert.deepStrictEqual(r.lines[1], { work: 'Read and clear fault code', type: 'Paid', amount: 620, qty: 1, rate: 620 });
    assert.deepStrictEqual(r.lines[6], { work: 'CGST 9%', type: 'Paid', amount: 279 }, 'a tax line: no Qty / Rate');
    assert.deepStrictEqual([r.total, r.billTotal, r.free, r.insurance], [3658, 3658, 1120, null], 'the free lines were worth ₹1,120 (warranty 280 + 840)');
    // ---- his parts bill S2627NMM2-02040: Paid lines at a 5 % discount, Service Plan lines at 100 %
    const b2 = run('x => saveMaint_(x)', { date: '2026-06-15', no: C1, garage: 'Navnit Motors Pvt. Ltd.', billNo: 'S2627NMM2-02040', km: 31758, service: true, lines: [
      { work: 'Plug – oil drain', type: 'Paid', qty: 1, rate: 863.01, disc: 5, amount: 819.86 },
      { work: 'Engine oil 0W30 (ml)', type: 'Service Plan', qty: 1050, rate: 1.65, disc: 100, amount: 0 },
      { work: 'Filter – engine oil element', type: 'Service Plan', qty: 1, rate: 2060.95, disc: 100 },
      { work: 'CGST 9%', amount: 73.79 }, { work: 'SGST 9%', amount: 73.79 }, { work: 'Round-off', amount: -0.44 }] });
    r = run('x => getMaint_(x)', { no: C1 }).rows.find(x => x.id === b2.id);
    assert.deepStrictEqual([b2.total, r.lines[0].disc, r.lines[1].qty, r.free], [967, 5, 1050, 3793.45], 'the discount kept; the service plan lines worth 1050 × 1.65 + 2060.95');
    // ---- the checks of a line
    const bad = lines => tryRun('x => saveMaint_(x)', { date: '2026-06-15', no: C1, garage: 'X', billNo: 'B-' + Math.random(), lines: lines }).thrown;
    assert.strictEqual(bad([{ work: 'Bolt', type: 'Free', amount: 0 }]), 'Bill line 1 (Bolt): Paid by is RCL, Insurance, Warranty, FOC or Service Plan.');
    assert.strictEqual(bad([{ work: 'Bolt', type: 'Paid', qty: -1, rate: 10, amount: 10 }]), 'Bill line 1 (Bolt): the quantity is not right.');
    assert.strictEqual(bad([{ work: 'Bolt', type: 'Paid', qty: 1, rate: -10, amount: 10 }]), 'Bill line 1 (Bolt): the rate is not right.');
    assert.strictEqual(bad([{ work: 'Bolt', type: 'Paid', qty: 1, rate: 10, disc: 120, amount: 10 }]), 'Bill line 1 (Bolt): the discount is 0 to 100 %.');
    assert.strictEqual(bad([{ work: 'Bolt', type: 'Paid', qty: 1, rate: 10 }]), 'Bill line 1 (Bolt): enter its amount (₹).', 'a Paid line needs its ₹');
    assert.strictEqual(bad([{ work: '', type: 'Warranty', qty: 1, rate: 10 }]), 'Bill line 1: type the work / part (e.g. Engine oil, Labour).');
    // a bill of only free lines (all under warranty): kept, ₹ 0
    const b3 = run('x => saveMaint_(x)', { date: '2025-12-25', no: C1, garage: 'Navnit Motors Pvt. Ltd.', billNo: 'W-ONLY', lines: [{ work: 'Retainer – seat duct', type: 'Warranty', qty: 1, rate: 5717.88 }, { work: 'Joint – double cruciform', type: 'Warranty', qty: 1, rate: 38890.92 }] });
    assert.deepStrictEqual([b3.ok, b3.total, b3.billTotal], [true, 0, 0]);
    // ---- an insurance claim (his accident bill S2627NMM2-01629: ₹2,16,499; we paid ₹10,856 – the receipt)
    const acc = { date: '2026-06-03', no: C1, garage: 'Navnit Motors Pvt. Ltd.', billNo: 'S2627NMM2-01629', km: 31061, lines: [{ work: 'Repair wiring harness', type: 'Paid', qty: 1, rate: 65000, amount: 65000 },
      { work: 'Other labour', amount: 118474 }, { work: 'CGST 9%', amount: 16512.66 }, { work: 'SGST 9%', amount: 16512.66 }, { work: 'Round-off', amount: -0.32 }] };
    const badI = ins => tryRun('x => saveMaint_(x)', Object.assign({}, acc, { billNo: 'I-' + Math.random(), insurance: ins })).thrown;
    assert.strictEqual(badI({ company: '', paid: 100 }), 'The insurance part of the bill: type the insurance company.');
    assert.strictEqual(badI({ company: 'Tata AIG', paid: '' }), 'The insurance part of the bill: enter what the insurance paid (₹).');
    assert.strictEqual(badI({ company: 'Tata AIG', paid: 300000 }), 'The insurance part of the bill: the insurance paid ₹300000 – more than the bill (₹216499).');
    const b4 = run('x => saveMaint_(x)', Object.assign({}, acc, { insurance: { company: 'Tata AIG General Insurance', claimNo: 'CLM-1', paid: 205643 } }));
    assert.deepStrictEqual([b4.ok, b4.total, b4.billTotal], [true, 10856, 216499], 'we paid ₹10,856 of ₹2,16,499');
    r = run('x => getMaint_(x)', { no: C1 }).rows.find(x => x.id === b4.id);
    assert.deepStrictEqual([r.total, r.billTotal, r.insurance, r.lines.some(x => x.type === 'Insurance')], [10856, 216499, { company: 'Tata AIG General Insurance', claimNo: 'CLM-1', paid: 205643 }, false], 'the insurance apart from the lines');
    const raw = run('id => { const t = maintTable_(true); return t.rows.find(r => str_(r[t.c[H.MT_ID]]) === id)[t.c[H.AMOUNT]]; }', b4.id);
    assert.strictEqual(raw, 10856, 'the Amount kept = what we paid');
    assert.strictEqual(run('x => getMaint_(x)', { no: C1, from: '2026-06-03', to: '2026-06-03' }).total, 10856, 'the list\'s total: what we paid');
    // ---- the car's log book: the cost = what we paid; the bills' total, the insurance and the free lines told apart; by work only what was paid
    const g = run('x => maintLog_(x)', { no: C1, from: '2025-12-01', to: '2026-06-30' });
    assert.deepStrictEqual(g.total.maint, { amount: 3658 + 967 + 0 + 10856, bills: 4, billTotal: 3658 + 967 + 0 + 216499, insurance: 205643, free: 1120 + 3793.45 + 44608.8 });
    assert.ok(!g.total.byWork.some(w => /Retainer|Armrest|EVHC|Engine oil 0W30|Tata AIG/.test(w.work)), 'free lines and the insurance are not costs by work');
    assert.strictEqual(r2(g.total.byWork.reduce((s, w) => s + w.amount, 0)), r2(3658 + 967 + 216499), 'by work: the paid lines');
    // ---- an app of before (its lines have no kind) may not change a bill with free lines or an insurance part; a plain one: as before
    assert.strictEqual(tryRun('(id, x) => updateMaint_(id, x)', b1.id, { date: '2025-12-25', no: C1, garage: 'Navnit Motors Pvt. Ltd.', billNo: 'S2526NMM2-07668', lines: [{ work: 'Wheel alignment', amount: 1860 }] }).thrown,
      'Bill ' + b1.id + ' has free lines (Warranty / FOC / Service Plan) or an insurance part – update the app to change it.');
    const plain = run('x => saveMaint_(x)', { date: '2026-01-10', no: C1, garage: 'Tyre House', billNo: 'T-9', lines: [{ work: 'Tyre', amount: 6000 }] });
    assert.deepStrictEqual(run('(id, x) => updateMaint_(id, x)', plain.id, { date: '2026-01-10', no: C1, garage: 'Tyre House', billNo: 'T-9', lines: [{ work: 'Tyre', amount: 6200 }] }).total, 6200);
    // …the new app keeps the insurance when it sends it, and takes it out when it sends none
    assert.strictEqual(run('(id, x) => updateMaint_(id, x)', b4.id, Object.assign({}, acc, { lines: acc.lines.map(x => Object.assign({ type: 'Paid' }, x)), insurance: { company: 'Tata AIG General Insurance', claimNo: 'CLM-1', paid: 205643 } })).total, 10856);
    assert.strictEqual(run('(id, x) => updateMaint_(id, x)', b4.id, Object.assign({}, acc, { lines: acc.lines.map(x => Object.assign({ type: 'Paid' }, x)), insurance: null })).total, 216499);
    // a line of before (no kind) is read as Paid
    assert.deepStrictEqual(run('() => maintLinesOf_(JSON.stringify([{ work: "Engine oil", amount: 1200 }]))'), [{ work: 'Engine oil', type: 'Paid', amount: 1200 }]);
    // ---- the AI's answer: the short lines [work, type, qty, rate, discount, amount]; several invoices; an insurance claim
    const ans = j => run('j => maintAnswer_(j)', j);
    const a1 = ans({ date: '2025-12-25', billNo: 'S2526NMM2-07667, S2526NMM2-07668', garage: 'Navnit Motors Pvt. Ltd.', vehicle: 'DD01G0169', km: 19566, total: 10278,
      lines: [['Retainer – seat duct', 'Warranty', 1, 5717.88, 0, 0], ['Fluid – diesel exhaust', 'Paid', 1, 5610.42, 0, 5610.42], ['Carried out EVHC', 'FOC', 1, 0, 0, 0],
        ['Service 8000 miles', 'Service Plan', 1, 5580, 100, 0], ['Wheel alignment', 'Paid', 1, 1860, null, 1860], ['Drive in / out', 'Paid', 1, 0, 0, 0], ['CGST 9%', 'Paid', null, null, 0, 1404], ['SGST 9%', 'Paid', null, null, 0, 1404], ['Round-off', 'Paid', null, null, 0, -0.42]] });
    assert.deepStrictEqual(a1.lines.map(x => x.type + ':' + x.amount), ['Warranty:0', 'Paid:5610.42', 'FOC:0', 'Service Plan:0', 'Paid:1860', 'FOC:0', 'Paid:1404', 'Paid:1404', 'Paid:-0.42'], 'every line, a Paid one charged nothing → FOC');
    assert.deepStrictEqual([a1.lines[0], a1.lines[6], a1.billNo, a1.check, a1.insurance], [{ work: 'Retainer – seat duct', type: 'Warranty', amount: 0, qty: 1, rate: 5717.88, disc: 0 }, { work: 'CGST 9%', type: 'Paid', amount: 1404, disc: 0 }, 'S2526NMM2-07667, S2526NMM2-07668', '', null]);
    const a2 = ans({ billNo: 'S2627NMM2-01629, S2627NMM2-01630', total: '12,30,893', insurer: 'Tata AIG General Insurance Co Ltd', claimNo: null, insurancePaid: null, customerPaid: '10,856', lines: [['Repair', 'Paid', 1, 1230893, 0, 1230893]] });
    assert.deepStrictEqual(a2.insurance, { company: 'Tata AIG General Insurance Co Ltd', claimNo: '', paid: 1220037 }, 'the insurance paid = the bill less what we paid (the receipt)');
    assert.deepStrictEqual(ans({ total: 1000, insurer: 'ICICI Lombard', insurancePaid: 900, lines: [['X', 'Paid', 1, 1000, 0, 1000]] }).insurance, { company: 'ICICI Lombard', claimNo: '', paid: 900 });
    assert.strictEqual(ans({ total: 1000, insurer: 'ICICI Lombard', insurancePaid: 5000, lines: [['X', 'Paid', 1, 1000, 0, 1000]] }).insurance, null, 'more than the bill: not taken (update-169: no claim then)');
    // update-169 (his bill 04590 on the live page: "Insurance Co : Others", a general repair paid in cash – read as a claim, the save asked for the insurance's ₹)
    assert.strictEqual(ans({ total: 7475, insurer: 'Others', claimNo: null, insurancePaid: null, customerPaid: null, lines: [['Fluid – diesel exhaust', 'Paid', 1, 5610.42, 0, 5610.42]] }).insurance, null, 'a company without what the insurance paid: not a claim');
    assert.strictEqual(ans({ total: 7475, insurer: 'Tata AIG General Insurance Co Ltd', insurancePaid: null, customerPaid: 7475, lines: [['X', 'Paid', 1, 7475, 0, 7475]] }).insurance, null, 'we paid the whole bill: not a claim');
    assert.match(fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8'), /a vehicle detail "Insurance Co" alone is NOT a claim/);
    assert.deepStrictEqual(ans({ lines: [{ work: 'Old style', amount: 500 }] }).lines, [{ work: 'Old style', type: 'Paid', amount: 500 }], 'the long form still read');
    const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
    assert.match(code, /"lines": \[\[work, type, qty, uom, rate, discount, gst, amount\], …\] – ONE array for EVERY item of every invoice, also the free ones/);      // (update-170: uom; update-171: gst)
    assert.match(code, /read them all as ONE bill/);
  } finally {
    run('() => { const P = PropertiesService.getScriptProperties(); ["FUEL_MODE", "FUEL_CARDS"].forEach(k => P.deleteProperty(k)); }');
  }
  function r2(n) { return Math.round(n * 100) / 100; }
});

test('update-170: Maintenance at every site for every machinery – the reading of its meter (KM / Hrs), a line\'s Uom, the Party of a bill; the log book (bills only at a site with stock, its fills too on fuel cards); the AI\'s lines with their Uom; the Store\'s provision', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const R = 'ROLLER-03-170';
  try {
    // a site with stock (VTR): a roller on hours, its bills, no fuel card anywhere
    run('() => { const P = PropertiesService.getScriptProperties(); P.deleteProperty("FUEL_MODE"); P.deleteProperty("FUEL_CARDS"); }');
    assert.strictEqual(run('() => cardSite_()'), false);
    assert.ok(run('() => usersAdmin_().modules.some(m => m.key === "Maintenance")'), 'the page is given in the Portal at every site');
    run('(x, m) => saveMaster_(x, m)', { no: R, name: 'Soil Compactor No.03', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2022-11-01' }, 'add');
    // his log book: 30-09-2024 ARS Group 1903 – six lines; 05-10-2024 RK Power 1915 – with a tax line each
    const b1 = run('x => saveMaint_(x)', { date: '2024-09-30', no: R, garage: 'ARS Group', billNo: 'ARS-11', km: 1903, service: true, lines: [
      { work: 'Air Filter Safety', type: 'Paid', qty: 1, uom: 'Nos', rate: 584, amount: 584 }, { work: 'Hydraulic oil (29 Ltr)', type: 'Paid', qty: 3, uom: 'Bkt', rate: 7667, amount: 23000 },
      { work: 'CGST 9%', amount: 2121 }, { work: 'SGST 9%', amount: 2121 }] });
    assert.deepStrictEqual([b1.ok, b1.total], [true, 27826], 'a bill of a roller at a site with stock is kept');
    const r1 = run('x => getMaint_(x)', { no: R }).rows[0];
    assert.deepStrictEqual(r1.lines[1], { work: 'Hydraulic oil (29 Ltr)', type: 'Paid', amount: 23000, qty: 3, uom: 'Bkt', rate: 7667 }, 'its Uom kept with the line');
    assert.deepStrictEqual([r1.km, r1.garage, r1.service], [1903, 'ARS Group', true], 'the reading of its meter (Hrs); the party');
    assert.strictEqual(tryRun('x => saveMaint_(x)', { date: '2024-10-05', no: R, garage: 'RK Power', service: true, lines: [{ work: 'Nox Sensor', amount: 14505 }] }).thrown,
      R + ': a service needs its reading (KM / Hrs) – the next service is counted from it.');
    assert.strictEqual(tryRun('x => saveMaint_(x)', { date: '2024-10-05', no: R, garage: 'RK Power', km: -5, lines: [{ work: 'Nox Sensor', amount: 14505 }] }).thrown, 'Enter ' + R + ' Reading.');
    // a fill of the roller (from the stock): not in its maintenance log book at a site with stock
    const g = run('x => maintLog_(x)', { no: R, from: '2024-09-01', to: '2024-10-31' });
    assert.deepStrictEqual([g.card, g.machine.meter, g.lines.length, g.lines[0].kind, g.lines[0].party, g.total.fuel.fills, g.total.maint.amount, g.total.all], [false, 'Hrs', 1, 'Maintenance', 'ARS Group', 0, 27826, 27826],
      'the bills with their Party; no fuel at a site with stock');
    assert.deepStrictEqual(g.lines[0].lines.map(l => l.work), ['Air Filter Safety', 'Hydraulic oil (29 Ltr)', 'CGST 9%', 'SGST 9%'], 'every line, the tax lines too (the page puts them in the GST column)');
    assert.deepStrictEqual(run('() => maintStoreLines_(null, "2024-01-01", "2024-12-31")'), [], 'the Store\'s provision: nothing yet');
    // the AI's lines with their Uom (7 values); 6 values as before
    const ans = j => run('j => maintAnswer_(j)', j);
    const a = ans({ total: 27141, lines: [['Hydraulic oil (29 Ltr)', 'Paid', 3, 'Bkt', 7667, 0, 23000], ['CGST 9%', 'Paid', null, null, null, 0, 2070.5], ['Old', 'Paid', 1, 50, 0, 50]] });
    assert.deepStrictEqual(a.lines, [{ work: 'Hydraulic oil (29 Ltr)', type: 'Paid', amount: 23000, qty: 3, uom: 'Bkt', rate: 7667, disc: 0 }, { work: 'CGST 9%', type: 'Paid', amount: 2070.5, disc: 0 }, { work: 'Old', type: 'Paid', amount: 50, qty: 1, rate: 50, disc: 0 }]);
    assert.deepStrictEqual(ans({ lines: [{ work: 'Coolant', qty: 2.5, unit: 'Ltr', rate: 165, amount: 412 }] }).lines[0].uom, 'Ltr', 'the long form: its unit');
    // the page: Maintenance in the menu at every site; the log book in his format
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.ok(!/if \(\$\('tab-mnt'\) && !cm\) \$\('tab-mnt'\)\.hidden = true;/.test(app), 'the menu shows Maintenance at every site');
    assert.match(app, /<th style="white-space:nowrap;min-width:46px">Sr No<\/th><th>Date<\/th><th>Party Name<\/th><th class="n">Current Reading<\/th><th>Particulars<\/th><th class="n">Qty<\/th><th>Uom<\/th><th class="n">Basic Rate<\/th><th class="n">Amount<\/th>/);      // (update-171: then the GST of each rate …)
  } finally {
    run('() => { const P = PropertiesService.getScriptProperties(); ["FUEL_MODE", "FUEL_CARDS"].forEach(k => P.deleteProperty(k)); }');
  }
});

test('update-171: each line its GST % (one number – CGST and SGST half each) and its "Paid by" (RCL, Insurance, Warranty, FOC, Service Plan); the bill\'s total with the GST of its lines; lines paid by the insurance are its part; an older app cannot lose them; the AI\'s lines with their GST', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = require('vm').runInContext('(' + fn + ')', ctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const tryRun = (fn, ...a) => { try { return run(fn, ...a); } catch (e) { return { thrown: String(e.message) }; } };
  const C = 'DD-01-G-0171';
  try {
    run('() => { const P = PropertiesService.getScriptProperties(); P.deleteProperty("FUEL_MODE"); P.deleteProperty("FUEL_CARDS"); }');
    run('(x, m) => saveMaster_(x, m)', { no: C, name: 'Range Rover', type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 8, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2025-09-01', fuel: 'Diesel' }, 'add');
    // his 04590: the items with their GST (18 %, a 28 % plug free), the free ones, the round-off – no tax lines
    const b1 = run('x => saveMaint_(x)', { date: '2025-09-12', no: C, garage: 'Navnit Motors Pvt Ltd', billNo: 'S2526NMM2-04590', km: 13153, service: true, lines: [
      { work: 'Engine oil', type: 'Service Plan', qty: 11000, uom: 'ML', rate: 1.48, disc: 100, gst: 18 }, { work: 'Plug – oil drain', type: 'FOC', qty: 1, uom: 'Nos', rate: 815.7, gst: 28 },
      { work: 'Fluid – diesel exhaust', type: 'RCL', qty: 1, uom: 'Nos', rate: 5610.42, gst: 18, amount: 5610.42 }, { work: 'Battery – additional', type: 'Paid', qty: 1, uom: 'Nos', rate: 724.59, gst: 18, amount: 724.59 },
      { work: 'Adjustment', amount: -0.31 }] });
    assert.deepStrictEqual([b1.ok, b1.total, b1.billTotal], [true, 7475, 7475], 'the bill ₹7,475: 5610.42 × 1.18 + 724.59 × 1.18 − 0.31');
    const r1 = run('x => getMaint_(x)', { no: C }).rows[0];
    assert.deepStrictEqual(r1.lines.map(l => l.type + ':' + (l.gst || 0)), ['Service Plan:18', 'FOC:28', 'Paid:18', 'Paid:18', 'Paid:0'], '"RCL" kept as Paid; each line its GST %');
    assert.deepStrictEqual([r1.billTotal, r1.total, r1.free], [7475, 7475, 17095.7]);
    const bad = l => tryRun('x => saveMaint_(x)', { date: '2025-09-12', no: C, garage: 'X', billNo: 'B-' + Math.random(), lines: l }).thrown;
    assert.strictEqual(bad([{ work: 'Bolt', type: 'Paid', amount: 10, gst: 120 }]), 'Bill line 1 (Bolt): the GST is 0 to 100 %.');
    assert.strictEqual(bad([{ work: 'Bolt', type: 'Shop', amount: 10 }]), 'Bill line 1 (Bolt): Paid by is RCL, Insurance, Warranty, FOC or Service Plan.');
    assert.strictEqual(bad([{ work: 'Bumper', type: 'Insurance', amount: 1000, gst: 18 }]), 'The insurance part of the bill: type the insurance company.', 'a line paid by the insurance: its company is needed');
    // an accident bill: lines paid by the insurance, one by us – the insurance's part = those lines with their GST (the ₹ typed is not used)
    const b2 = run('x => saveMaint_(x)', { date: '2026-06-03', no: C, garage: 'Navnit Motors Pvt Ltd', billNo: 'ACC-1', km: 31061, lines: [
      { work: 'Front bumper', type: 'Insurance', qty: 1, rate: 10000, gst: 28, amount: 10000 }, { work: 'Paint labour', type: 'By Insurance', amount: 5000, gst: 18 }, { work: 'Depreciation', type: 'RCL', amount: 1000, gst: 18 }],
      insurance: { company: 'Tata AIG', claimNo: 'CLM-9', paid: 99999 } });
    assert.deepStrictEqual([b2.ok, b2.billTotal, b2.total], [true, 19880, 1180], 'bill 12,800 + 5,900 + 1,180; the insurance paid 18,700; we paid 1,180');
    const r2 = run('x => getMaint_(x)', { no: C }).rows.find(r => r.id === b2.id);
    assert.deepStrictEqual([r2.insurance, r2.lines.map(l => l.type)], [{ company: 'Tata AIG', claimNo: 'CLM-9', paid: 18700 }, ['By Insurance', 'By Insurance', 'Paid']]);
    const lg = run('x => maintLog_(x)', { no: C, from: '2025-09-01', to: '2026-06-30' });
    assert.deepStrictEqual([lg.total.maint.amount, lg.total.maint.billTotal, lg.total.maint.insurance], [8655, 27355, 18700]);
    assert.deepStrictEqual(lg.total.byWork.map(w => w.work + ':' + w.amount), ['Fluid – diesel exhaust:6620.3', 'Depreciation:1180', 'Battery – additional:855.01', 'Adjustment:-0.31'], 'by work: our lines with their GST (CGST and SGST each rounded)');
    // an app of before 3.51.0 (no gst in its lines) may not change it
    const old = tryRun('(i, x) => updateMaint_(i, x)', b1.id, { date: '2025-09-12', no: C, garage: 'Navnit Motors Pvt Ltd', billNo: 'S2526NMM2-04590', km: 13153, service: true, lines: r1.lines.map(l => ({ work: l.work, type: l.type, amount: l.amount })) });
    assert.strictEqual(old.thrown, 'Bill ' + b1.id + ' has the GST of its lines or lines paid by the insurance – update the app to change it.');
    // the AI: 8 values a line, no tax lines; its check with the GST
    const ans = j => run('j => maintAnswer_(j)', j);
    const a = ans({ total: 7475, lines: [['Fluid – diesel exhaust', 'Paid', 1, 'Nos', 5610.42, 0, 18, 5610.42], ['Battery – additional', 'Paid', 1, 'Nos', 724.59, 0, 18, 724.59], ['Adjustment', 'Paid', null, null, null, 0, 0, -0.31]] });
    assert.deepStrictEqual([a.lines[0], a.check], [{ work: 'Fluid – diesel exhaust', type: 'Paid', amount: 5610.42, qty: 1, uom: 'Nos', rate: 5610.42, disc: 0, gst: 18 }, ''], 'its GST %; the lines with their GST make the total');
    const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8');
    assert.match(code, /Do NOT give the taxes \(CGST, SGST, IGST\) as lines of their own – each item carries its gst/);
    // the page: Paid by, GST % / GST ₹ / With GST in the lines; the log book: the GST rates in its heading, Paid by, Insurance claim, Service
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /<th style="width:132px">Paid by<\/th>/);      // (update-172: the compact widths)
    assert.match(app, /<th class="n" style="width:66px">GST %<\/th><th class="n" style="width:96px">GST ₹<\/th><th class="n" style="width:114px">With GST<\/th>/);
    assert.match(app, /'<th class="n">CGST ' \+ fmt\(r \/ 2\) \+ '%<\/th><th class="n">SGST ' \+ fmt\(r \/ 2\) \+ '%<\/th>'/);
    assert.match(app, /<th>Paid by<\/th><th>Insurance claim<\/th><th>Service<\/th>/);
  } finally {
    run('() => { const P = PropertiesService.getScriptProperties(); ["FUEL_MODE", "FUEL_CARDS"].forEach(k => P.deleteProperty(k)); }');
  }
});

test('update-172: the log book of a bill of before – its tax lines (CGST / SGST / IGST of one rate) go onto its items, no GST row; the lines of a bill one compact row each, the note under the table', () => {
  const vm = require('vm'), app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8'), L = app.split('\n');
  // the page's own code: its lines from where a name is given until they parse (as the page runs them)
  const take = re => { const i = L.findIndex(l => re.test(l)); assert.ok(i > -1, String(re)); for (let k = i; k < i + 80; k++) { const t = L.slice(i, k + 1).join('\n'); try { new vm.Script(t); return t; } catch (e) { /* more lines */ } } throw new Error('not parsed: ' + re); };
  const ctx = vm.createContext({});
  vm.runInContext([take(/^\s*const r2 = /), take(/^\s*const mtCharged = /), take(/^\s*const MT_TAX = /), take(/^\s*const mtTaxPct = /), take(/^\s*function mlogSpread\(/), 'globalThis.S = mlogSpread;'].join('\n'), ctx);
  const spread = ls => JSON.parse(JSON.stringify(ctx.S(ls)));
  // his bill 04590 as it was saved (update-170): two items of RCL, CGST @ 9% and SGST @ 9% as lines, the adjustment, the free lines
  const b = [
    { work: 'Filter – engine oil element', type: 'Service Plan', qty: 1, rate: 1966.56, amount: 0 },
    { work: 'Fluid – diesel exhaust', type: 'Paid', qty: 1, rate: 5610.42, amount: 5610.42 },
    { work: 'Battery – additional, L', type: 'Paid', qty: 1, rate: 724.59, amount: 724.59 },
    { work: 'CGST @ 9%', type: 'Paid', amount: 570.15 }, { work: 'SGST @ 9%', type: 'Paid', amount: 570.15 },
    { work: 'Adjustment', type: 'Paid', amount: -0.31 }];
  const s = spread(b);
  assert.deepStrictEqual(s.map(l => l.work), ['Filter – engine oil element', 'Fluid – diesel exhaust', 'Battery – additional, L', 'Adjustment'], 'no CGST / SGST row');
  assert.deepStrictEqual([s[1].tax, s[2].tax, s[1].taxRate], [{ c: 504.94, s: 504.94, i: 0 }, { c: 65.21, s: 65.21, i: 0 }, 18], 'each item its 9 % + 9 % – the bill\'s ₹570.15 + ₹570.15');
  assert.ok(!s[0].tax && !s[3].tax, 'a free line and the adjustment carry no tax');
  const sum = s.reduce((t, l) => t + (mtChargedJs(l.type) ? l.amount + (l.tax ? l.tax.c + l.tax.s + l.tax.i : 0) : 0), 0);
  function mtChargedJs(t) { return !t || t === 'Paid' || t === 'By Insurance'; }
  assert.strictEqual(Math.round(sum * 100) / 100, 7475, 'the bill stays ₹7,475');
  // a tax that does not fit its % (an item without GST on the bill): in the items' proportion, the paisa on the biggest – the tax kept
  const p = spread([{ work: 'Part A', type: 'Paid', amount: 1000 }, { work: 'Part B', type: 'Paid', amount: 333 }, { work: 'CGST 9%', type: 'Paid', amount: 60 }, { work: 'SGST 9%', type: 'Paid', amount: 60 }]);
  assert.deepStrictEqual(p.map(l => l.tax), [{ c: 45.01, s: 45.01, i: 0 }, { c: 14.99, s: 14.99, i: 0 }]);
  // IGST of one rate: on the items (the GST column only)
  assert.deepStrictEqual(spread([{ work: 'Tyre', type: 'Paid', amount: 10000 }, { work: 'IGST 28%', type: 'Paid', amount: 2800 }]).map(l => [l.work, l.tax, l.taxRate]), [['Tyre', { c: 0, s: 0, i: 2800 }, 28]]);
  // one "GST 18%" line (CGST and SGST together): on the items, half CGST and half SGST (the update-165 bills of the app's tests)
  assert.deepStrictEqual(spread([{ work: 'Engine oil', amount: 1200 }, { work: 'Oil filter', amount: 300 }, { work: 'Labour', amount: 500 }, { work: 'GST 18%', amount: 360 }]).map(l => [l.work, l.tax, l.taxRate]),
    [['Engine oil', { c: 108, s: 108, i: 0 }, 18], ['Oil filter', { c: 27, s: 27, i: 0 }, 18], ['Labour', { c: 45, s: 45, i: 0 }, 18]]);
  // as saved: two rates, a cess, a tax without its %, no item to carry it, a bill of the new way (GST % on its lines)
  const same = ls => assert.deepStrictEqual(spread(ls).map(l => l.work), ls.map(l => l.work));
  same([{ work: 'Oil', type: 'Paid', amount: 1000 }, { work: 'CGST 9%', type: 'Paid', amount: 90 }, { work: 'CGST 14%', type: 'Paid', amount: 28 }]);
  same([{ work: 'Oil', type: 'Paid', amount: 1000 }, { work: 'Cess 1%', type: 'Paid', amount: 10 }]);
  same([{ work: 'Oil', type: 'Paid', amount: 1000 }, { work: 'CGST', type: 'Paid', amount: 90 }]);
  same([{ work: 'Oil', type: 'Warranty', amount: 0 }, { work: 'CGST 9%', type: 'Paid', amount: 90 }]);
  assert.ok(!spread([{ work: 'Oil', type: 'Paid', amount: 1000, gst: 18 }])[0].tax, 'a line with its own GST % keeps it');
  // the server, the same: the log book's "by work / part" of a bill of before – no CGST / SGST work, each item with its tax; the totals as saved
  const { T, ctx: sctx } = require('./harness.js');
  const run = (fn, ...a) => { const r = vm.runInContext('(' + fn + ')', sctx)(...a); T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const C = 'DD-01-G-0172';
  run('(x, m) => saveMaster_(x, m)', { no: C, name: 'Fortuner', type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 9, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2025-09-01', fuel: 'Diesel' }, 'add');
  const sb = run('x => saveMaint_(x)', { date: '2025-09-12', no: C, garage: 'Navnit Motors Pvt Ltd', billNo: 'S2526NMM2-04590', km: 13153, service: true, lines: b });
  assert.deepStrictEqual([sb.ok, sb.total], [true, 7475], 'saved as it was (update-170): the tax lines its own');
  assert.deepStrictEqual(run('a => maintSpread_(a)', b).map(l => l.work + ':' + (l.taxAdd || 0)), ['Filter – engine oil element:0', 'Fluid – diesel exhaust:1009.88', 'Battery – additional, L:130.42', 'Adjustment:0']);
  const lg = run('x => maintLog_(x)', { no: C, from: '2025-09-01', to: '2025-09-30' });
  assert.deepStrictEqual(lg.total.byWork.map(w => w.work + ':' + w.amount), ['Fluid – diesel exhaust:6620.3', 'Battery – additional, L:855.01', 'Adjustment:-0.31'], 'by work: no CGST / SGST – the items with their tax');
  assert.deepStrictEqual([lg.total.maint.amount, lg.lines[0].lines.length], [7475, 6], 'the totals and the bill\'s own lines as saved');
  // the log book uses it; the name of a line without its kind after it (Paid by is its column)
  assert.match(app, /spread = bills\.map\(x => mlogSpread\(x\.lines\)\)/);
  assert.match(app, /return \{ part: l\.work \|\| '', qty: l\.qty,/);
  // the form as his picture: a head with the service switch, the details' card (each box its icon), the lines one compact row each
  // (fixed columns, every one on the page; the note under the table, not in its foot), the totals' box, the buttons at the foot
  assert.match(app, /table\.mt-lines \{ table-layout: fixed; min-width: 1040px; \}/);
  assert.match(app, /<label class="mt-svc mt-switch">[^\n]*<input type="checkbox" id="mt_service"><span class="mt-sw" aria-hidden="true"><\/span><\/label>/);
  assert.match(app, /<\/table><\/div>\n\s*<div class="mt-bottom">\n\s*<div class="mt-bl">\n\s*<p class="mt-how">Amount = Qty × Rate − Discount, before GST\./);
  assert.match(app, /<div class="mt-tbox"><div><span>Subtotal<\/span><b id="mt_sub">0\.00<\/b><\/div><div><span id="mt_gstl">GST<\/span><b id="mt_gstt">0\.00<\/b><\/div><div class="mt-grand"><span>Bill total<\/span><b id="mt_total">0\.00<\/b><\/div><\/div>/);
  assert.doesNotMatch(app, /<td colspan="9"><button class="btn ghost small" id="mt_addl"/);
  assert.match(app, /document\.addEventListener\('dblclick', e => \{ const el = e\.target; if \(back\.hidden && okEl\(el\)\) \{ e\.preventDefault\(\); open\(el\); \} \}\);/, 'a double-click opens any box big (the app\'s big box)');
  assert.match(app, /\$\('mt_addf'\)\.querySelector\('span'\)\.textContent = /, 'the files button keeps its icon');
});
