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
  assert.match(pp, /geolocation=\(\)/);                                     // what the app does not use stays forbidden
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
  assert.match(vs, /window\.open\('', '_blank'\)/); assert.match(vs, /logSheetsOf\(\{ rows: rows, f: \{ from: b\.from, to: b\.to \}/); assert.match(vs, /billSheets\(data, [^)]*\) \+ lb, 'rep rep-bill' \+ \(lb \? ' rep-lb' : ''\)/);
  assert.match(app, /\.billsheet \+ \.lbsheet, \.lbsheet \+ \.billsheet \{ break-before: page; \}/);
});

test('a submitted bill locks the Log Book and diesel entries of its machinery for its dates – for everyone, until the bill is deleted; the refusal says the way out', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const LOCK = /this machinery is in the submitted RA Bill 9 of Lock Vendor \(.+, 01-07-2026 to 31-07-2026\) – its Log Book and diesel entries of those dates cannot be added, changed or deleted\. To correct them: the Admin deletes that bill/;
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
  // ---------- the bill is deleted: everything is open again ----------
  const billId = run('() => { const t = billTable_(); return billOut_(t, t.rows.find(r => billOut_(t, r, false).vendor === "Lock Vendor"), false).id; }');
  r = run('(id, why) => deleteBill_(id, why)', billId, 'correction of the Log Book'); assert.ok(r && r.ok, JSON.stringify(r).slice(0, 200));
  assert.strictEqual(run('() => billLockOf_("BLK-1", "2026-07-02")'), null);
  r = run('(k, l) => updateLogRow_(k, l)', key('2026-07-02'), { closingKm: 1125, work: 'corrected after the bill was deleted' }); assert.ok(r && r.ok, 'after the bill is deleted the entry can be changed: ' + JSON.stringify(r).slice(0, 300));
  r = run('id => deleteDieselIssue_(id)', dId); assert.ok(r && !r.THROWN, 'and the diesel issue deleted: ' + JSON.stringify(r).slice(0, 200));
  assert.strictEqual(run('() => getLogBookList_({ from: "2026-06-01", to: "2026-08-31", no: "BLK-1", all: true }).rows.filter(r => r.lk).length'), 0);
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
  assert.strictEqual(api.backupNow.admin, true); assert.strictEqual(api.accessReport.admin, true); assert.deepStrictEqual(Array.from(api.getStock.any), ['Dashboard', 'Diesel Inward', 'Diesel Transfer', 'Diesel Issue', 'Reports']);
});

test('update-68 (D1): no code can open the backup Sheet to "anyone with the link"', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = ['app', 'server', 'api'].flatMap(d => walk(path.join(root, d))).filter(f => /\.(gs|js)$/.test(f) && !/[\\/]vendor[\\/]/.test(f));
  const all = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  // the server's backup talks to Google's Sheets API only, with a right that covers spreadsheets only: sharing (a Drive right) is out of its reach
  const g = fs.readFileSync(path.join(root, 'server', 'google.js'), 'utf8');
  assert.deepStrictEqual([...g.matchAll(/googleapis\.com\/auth\/([a-z.]+)/g)].map(m => m[1]), ['spreadsheets']);
  assert.ok(!/auth\/drive/.test(all), 'no Drive right is asked for anywhere');
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
  no([{ n: 'Bucket', q: 2 }, { n: 'Bucket', q: 1 }], /two rows one after the other are both Bucket/);
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
  assert.deepStrictEqual(g.machine.modes, ['Hrs'], 'format E: new entries are read from the hour meter');
  assert.deepStrictEqual(g.rows.map(r => [r.date, r.mode, r.tHrs].join(' ')), ['2026-06-28 Time 6.5', '2026-06-29 Time 2'], 'the entries are still what was saved');
  const send = (edit, extra) => run('p => { try { return saveLogBulk_(p); } catch (e) { return { thrown: String(e.message) }; } }', { no: 'T70-JCB', from: from, to: to, deleted: [], openingDiesel: '',
    rows: grid().rows.map(r => Object.assign({ key: r.key, same: false, half: false, date: r.date, shift: r.shift, mode: r.mode, openingHr: '', closingHr: '', openingKm: '', closingKm: '', tStart: r.tStart, tEnd: r.tEnd, tBreak: r.tBrk, remark: '', trip: '', challan: '', chFrom: '', chTo: '', work: r.work, odSet: '' }, edit(r))).concat(extra || []) });
  const stored = () => run(`() => { const lt = table_(APP.SHEET_LOG), c = lt.c; return lt.rows.filter(x => str_(x[c[H.NO]]) === 'T70-JCB').map(x => [dkey_(x[c[H.DATE]]), str_(x[c[H.UNIT]]), num0_(x[c[H.THRS]]), str_(x[c[H.WORK]])].join(' ')).sort(); }`);
  // a description corrected, and the To time of the 29th: saved in the way they were saved in
  let r = send(x => x.date === '2026-06-28' ? { work: 'CLEANING WORK' } : { tEnd: '14:00' });
  assert.ok(r.ok && r.changed === 2, JSON.stringify(r).slice(0, 300));
  assert.deepStrictEqual(stored(), ['2026-06-28 Time 6.5 CLEANING WORK', '2026-06-29 Time 3 SHIFTING']);
  // a NEW entry by Time is still refused for this machinery (its format is read from the hour meter) – and nothing is changed by the try
  r = send(() => ({ same: true }), [{ key: '', date: '2026-06-30', shift: 'Day', mode: 'Time', tStart: '09:00', tEnd: '11:00', tBreak: '', work: 'NEW' }]);
  assert.ok(r.ok === false && /does not work on "Time"/.test((r.errors || []).map(e => e.msg).join(' ') + (r.thrown || '')), JSON.stringify(r).slice(0, 300));
  // a saved entry cannot be moved to a way the machinery does not have either
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
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { openingHr: 9, closingHr: 10, items: { Breaker: 1 } })], /row 2 of 03-06-2026 starts at 9 but the row before it closed at 8 – every row must start where the row before it closed/, 2);
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { closingHr: 9, items: {} })], /two rows one after the other are both Bucket/);
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { closingHr: 10, items: { Breaker: 1 } })], /row 2 of 03-06-2026 – each row of one shift is ONE work: press Bucket \/ Breaker \(not Split\)/, 2);
  no([J('2026-06-03', { closingHr: 9, items: { Breaker: 1 } }), J('2026-06-03', { closingHr: 10, items: {} })], /row 1 of 03-06-2026 – each row of one shift is ONE work/);
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { closingHr: 8, items: { _all: 'Breaker' } })], /row 2 of 03-06-2026 \(Breaker\) has no work/);
  no([J('2026-06-03', { closingHr: 8, items: {} }), J('2026-06-03', { closingHr: 9, items: { _all: 'Breaker' }, half: true })], /the ½ tick belongs to the first row of the shift/, 2);
  // a shift that is ALREADY saved is not added to from the entry page: the message says where to do it
  no([J('2026-06-02', { closingHr: 8, items: { _all: 'Breaker' } })], /already saved for 02-06-2026 \(Day\)\. To add another work to this saved shift \(Bucket \/ Breaker\): Edit Log Book → "\+ work in this shift"/);
  // a machinery with ONE kind of work keeps the old rule: the second row of a shift is refused, nothing is joined
  r = save([{ date: '2026-06-03', shift: 'Day', no: 'E71-TIP', mode: 'KM', closingKm: 200 }, { date: '2026-06-03', shift: 'Day', no: 'E71-TIP', mode: 'KM', closingKm: 240 }]);
  assert.ok(r.ok === false && /E71-TIP already saved for 03-06-2026 \(Day\)/.test(r.errors.map(e => e.msg).join(' ')) && r.errors[0].row === 2, JSON.stringify(r).slice(0, 300));
  assert.strictEqual(stored('E71-TIP').length, 1);
  // the Excel sheet that is imported: two lines of the machinery on the same date and shift, each with its "Work type" → one entry with two rows too
  const imp = run('x => { try { return importLogBook_(x); } catch (e) { return { thrown: String(e.message) }; } }', { rows: [
    { line: 2, date: '2026-06-04', shift: 'Day', no: 'E71-JCB', mode: 'Hrs', closingHr: 9, items: { _all: 'Bucket' }, work: 'DRAIN' }, { line: 3, date: '2026-06-04', shift: 'Day', no: 'E71-JCB', mode: 'Hrs', closingHr: 10.5, items: { _all: 'Breaker' }, work: 'ROCK' }] });
  assert.ok(imp && !imp.thrown && imp.ok !== false, JSON.stringify(imp).slice(0, 400));
  s = stored('E71-JCB');
  assert.strictEqual(s.length, 3);
  assert.deepStrictEqual([s[2].d, s[2].ohr, s[2].chr, s[2].whr], ['2026-06-04', 7, 10.5, 3.5]);
  assert.deepStrictEqual(JSON.parse(s[2].items), { Breaker: 1.5, _parts: [{ n: 'Bucket', q: 2, w: 'DRAIN' }, { n: 'Breaker', q: 1.5, w: 'ROCK' }] });
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
