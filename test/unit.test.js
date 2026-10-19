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
  assert.deepStrictEqual(run('x => saveSiteRules_(x)', { backDays: '3', announce: '  Fill every entry by the 30th  ' }).rules, { backDays: 3, announce: 'Fill every entry by the 30th', dayFrom: '08:00', nightFrom: '20:00' });
  assert.deepStrictEqual(run('() => getInit_().rules'), { backDays: 3, announce: 'Fill every entry by the 30th', dayFrom: '08:00', nightFrom: '20:00' });
  const asUser = (admin, f) => { run('a => { ACTOR_ADMIN_ = a; }', admin); try { return f(); } finally { run('() => { ACTOR_ADMIN_ = true; }'); } };
  const entry = d => ({ rows: [{ date: d, shift: 'Full Day', no: 'RL-1', mode: 'KM', openingKm: 100, closingKm: 150 }] });
  assert.match(asUser(false, () => tryIt(() => run('x => saveLogRowsInner_(x)', entry(day(-10))))).err, closed);          // 10 days back: refused for a user
  assert.strictEqual(asUser(true, () => tryIt(() => run('x => saveLogRowsInner_(x)', entry(day(-10))))).ok, true);        // the Admin may
  assert.match(asUser(false, () => tryIt(() => run('k => deleteLogRow_(k)', 'RL-1|' + day(-10) + '|Full Day'))).err, closed);   // … and the user cannot delete it either
  assert.strictEqual(asUser(false, () => tryIt(() => run('x => saveLogRowsInner_(x)', { rows: [{ date: day(-3), shift: 'Full Day', no: 'RL-1', mode: 'KM', closingKm: 200 }] }))).ok, true);   // 3 days back: inside the rule
  // no limit again
  assert.deepStrictEqual(run('x => saveSiteRules_(x)', { backDays: '', announce: '' }).rules, { backDays: '', announce: '', dayFrom: '08:00', nightFrom: '20:00' });      // (update-109: the shift times, 8 AM / 8 PM unless set)
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
  assert.match(vs, /window\.open\('', '_blank'\)/); assert.match(vs, /logSheetsOf\(\{ rows: rows, f: \{ from: b\.from, to: b\.to \}/); assert.match(vs, /billSheets\(data, [^)]*\) \+ lb, 'rep rep-bill' \+ \(lb \? ' rep-lb' : ''\)/);
  assert.match(app, /\.billsheet \+ \.lbsheet, \.lbsheet \+ \.billsheet \{ break-before: page; \}/);
});

test('a submitted bill locks the Log Book and diesel entries of its machinery for its dates – for everyone, until the bill is deleted; the refusal says the way out', () => {
  const { T, ctx } = require('./harness.js');
  const run = (fn, ...a) => { let r; try { r = require('vm').runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  const LOCK = /this machinery is in the submitted RA Bill 9 of Lock Vendor \(.+, 01-07-2026 to 31-07-2026\) – its Log Book and diesel entries of those dates cannot be added, changed or deleted without the Super Admin\. To correct them: change the entry and send it to the Super Admin for approval .* or the Admin deletes that bill/;      // (update-108: the Super Admin's approval is the way out)
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
  // a row by Time whose time is 0, and a shift of rows all by Time, are refused
  b = bulk([R(e2, { items: { _parts: [{ n: '', q: 3.5 }, { n: '', q: 0, m: 'T', ts: '13:00-14:00', tb: 60 }] } })], '2026-07-02', '2026-07-02');
  assert.ok((b.ok === false && /working time is 0 for this row/.test(JSON.stringify(b))) || /working time is 0 for this row/.test(b.thrown || ''), JSON.stringify(b).slice(0, 300));
  assert.match(save([J('2026-07-03', { mode: 'Time', tStart: '09:00', tEnd: '10:00' }), J('2026-07-03', { mode: 'Time', tStart: '11:00', tEnd: '12:00' })]).thrown || '', /already saved|all by Time/);
  // the edit window: readings of such an entry are changed row by row in Edit Log Book
  const key = d => run('(n, d) => { const lt = table_(APP.SHEET_LOG), c = lt.c, r = lt.rows.find(x => str_(x[c[H.NO]]) === n && dkey_(x[c[H.DATE]]) === d); return logKeyOf_(lt, r); }', 'T78-JCB', d);
  assert.match(tryRun('(k, l) => updateLogRow_(k, l)', key('2026-07-01'), { openingHr: 3714.5, closingHr: 3718, work: 'LOADING / ROCK BREAKING' }).thrown || '', /kept row by row/);
  // the bill per hour: 5 + 4 = 9 h × ₹1,000 = ₹9,000 (30-06 is June)
  const bill = no => run('(n, f, t) => billMachineCalc_(findMachine_(n), getLogBookList_({ from: f, to: t, no: n, all: true }).rows, logPrintExtra_({ from: f, to: t, nos: [n] }), f, t, undefined, true).amount', no, '2026-07-01', '2026-07-31');
  assert.strictEqual(bill('T78-JCB'), 9000);
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
  assert.deepStrictEqual(pageKinds, ['dash', 'veh', 'pump', 'reg']);
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
  assert.match(app, /if \(\(k === 'dash' && m\.supply !== 'Debit Basis'\) \|\| k === 'pump'\) phAsk\(k, m\.id, pic\.small\);/);      // (update-87: dashboard and dispenser, while the photo is sent)
  assert.match(code, /getMeterReading:\s+\{ m: 'Diesel Issue', withUser: true, f: \(u, x\) => meterReading_\(u, x\) \}/);
  assert.ok(!/aiReadMeter_/.test(code.slice(code.indexOf('function uploadDieselPhoto_'), code.indexOf('function meterReading_'))), 'the upload does not wait for the AI');
  assert.match(code, /rec\.no !== mId/); assert.match(code, /photosTaken_\(photos\.map\(x => x\.p\)\)/); assert.match(code, /pc\.remove\('PH_' \+ p\)/);      // (update-120: photosTaken_)
  // a photo being sent is tried again 3 times (a question), not for ever (a save) – the page's shell and the server agree
  const shell = fs.readFileSync(path.join(__dirname, '..', 'server', 'page.js'), 'utf8'), rt = fs.readFileSync(path.join(__dirname, '..', 'server', 'runtime.js'), 'utf8');
  assert.match(shell, /'logPrintExtra', 'dieselPhoto', 'inwardPhoto'\]/); assert.match(rt, /'logPrintExtra', 'dieselPhoto', 'inwardPhoto'\]/);      // (update-120: and a bill copy)
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
  assert.deepStrictEqual(pump({ litres: 45, amount: 4140, rate: 92 }), { litres: 45, check: '' });
  assert.deepStrictEqual(pump({ litres: null, amount: 4140, rate: 92 }), { litres: 45, check: '' });
  assert.match(pump({ litres: 4140, amount: 4140, rate: 92 }).check, /not the amount|not a normal fill/);
  assert.deepStrictEqual(pump({ litres: '45.50' }), { litres: 45.5, check: '' });
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
  assert.deepStrictEqual(v.rewrites, [{ source: '/store/', destination: 'https://rcl-store.vercel.app/index.html' }, { source: '/portal/', destination: 'https://rcl-portal-flame.vercel.app/index.html' },
    { source: '/store/:path*', destination: 'https://rcl-store.vercel.app/:path*' }, { source: '/portal/:path*', destination: 'https://rcl-portal-flame.vercel.app/:path*' }]);
  assert.deepStrictEqual(v.redirects.map(r => r.source + '→' + r.destination + ':' + r.permanent), ['/store→/store/:false', '/portal→/portal/:false']);
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
  assert.match(refused.THROWN || '', /is in the submitted RA Bill 81 .* without the Super Admin\. To correct them: change the entry and send it to the Super Admin for approval/);
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
  const saSave = run('(k) => { ACTOR_SUPER_ = true; try { billBaselines_("updateLogRow", [k, { closingKm: 1100 }]); return updateLogRow_(k, { closingKm: 1100 }); } finally { ACTOR_SUPER_ = false; } }', key('2026-09-02'));
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
  assert.ok(run('id => deleteBill_(id, "test")', s2.saved[0].id).ok);
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
  assert.deepStrictEqual(run('x => saveSiteRules_(x).rules', { backDays: '', announce: '', dayFrom: '7:30', nightFrom: '19:30' }), { backDays: '', announce: '', dayFrom: '07:30', nightFrom: '19:30' });
  assert.match(run('x => saveSiteRules_(x)', { backDays: '', dayFrom: '25:00', nightFrom: '19:30' }).THROWN, /^Shift times: type the hour as HH:MM/);
  assert.match(run('x => saveSiteRules_(x)', { backDays: '', dayFrom: '08:00', nightFrom: '08:00' }).THROWN, /cannot start at the same time/);
  assert.deepStrictEqual(run('x => saveSiteRules_(x).rules', { backDays: '2', announce: 'x' }), { backDays: 2, announce: 'x', dayFrom: '07:30', nightFrom: '19:30' }, 'not sent = kept');
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
    assert.match(app, /const want = flowWill\(id\) \? 'Send to verification' : x\.dataset\.flowOrig;/);
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
    const api = (fn, ...a) => run('(f, a) => api("tok117", f, a)', fn, a);
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
    assert.match(sitesGs, /if \(c\.act === 'places'\) return placesInfo_\(\);[^\n]*\n  if \(c\.act === 'placesSave'\) return sysPlacesSave_\(c\.places, c\.by\);/);
    const portalJs = fs.readFileSync(path.join(root, 'server', 'portal.js'), 'utf8'), sysJs = fs.readFileSync(path.join(root, 'server', 'system.js'), 'utf8');
    assert.match(portalJs, /if \(c\.act === 'placesSave'\) return Object\.assign\(out, \{ places: placesOf\(c\.places\) \}\);/);
    assert.match(portalJs, /company: \{ id: [^\n]*\}, places: placesOf\(c\.places\) \}\);/);
    assert.match(sysJs, /pl = R\.runIn\(code, 'sysPlacesSetup', \[\{ places: [^\n]*, by: c\.by, keep: same \}\]\);[\s\S]*if \(!add\('places', pl && pl\.ok/);
    assert.match(fs.readFileSync(path.join(root, 'server', 'runtime.js'), 'utf8'), /sysPlacesSetup: sysPlacesSetup_,/);
    // ---- the page: the Dashboard draws one tank per place for such a site; the first site's texts stay as they were ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /if \(TANKS\.own\) \{[^\n]*\n      const key = locs\.map/);
    assert.match(app, /function vtrPlaces\(\) \{ return \(S\.locations \|\| \[\]\)\.join\('\|'\) === 'Dispenser\|VTR Store'; \}/);
    assert.match(app, /'Moved Dispenser ↔ VTR Store \(inside company, not added or removed\)' : 'Moved between the diesel places/);
    assert.match(app, /if \(L\.locations && L\.locations\.length && L\.locations\.join\('\|'\) !== \(S\.locations \|\| \[\]\)\.join\('\|'\)\) setLocations\(L\.locations\);/);
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
    assert.deepStrictEqual([r.ok, r.done.length, r.failed.length, r.failed[0].id, r.failed[0].warn], [true, 0, 1, b, false], JSON.stringify(r).slice(0, 300));
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

test('update-129: Send again and the approval say a save\'s WARNINGS (not "refused"); the sender confirms them ("Send again anyway"); mistakes stay mistakes', () => {
  const { T, ctx } = require('./harness.js');
  const vm = require('vm');
  const run = (fn, ...a) => { let r; try { r = vm.runInContext('(' + fn + ')', ctx)(...a); } catch (e) { T.reset(); return { THROWN: String(e && e.message) }; } T.reset(); return JSON.parse(JSON.stringify(r === undefined ? null : r)); };
  // a save that answers as the diesel saves do: warnings (several – "Multiple entries"), one warning ("Save anyway?") or mistakes – by W129
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
      if (W129 === 'warns' && !o.force) return { ok: false, warnings: [{ row: 2, msg: 'MH-1: KM Reading 5 is less than the last KM Reading 9.' }, { row: 4, msg: 'MH-2: Hrs Reading 1 is less than the last Hrs Reading 2.' }] };
      if (W129 === 'warn' && !o.force) return { ok: false, warning: 'MH-1: the next entry has a lower reading. Save anyway?' };
      if (W129 === 'many' && !o.force) return { ok: false, warnings: Array.from({ length: 12 }, (x, i) => ({ row: i + 1, msg: 'MH-' + (i + 1) + ': KM Reading 5 is less than the last KM Reading 9.' })) };
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
    const saved = () => run('() => SAVED129.slice()');
    const argsOf = id => JSON.parse(run('id => flowAll_().find(r => r.id === id).args', id));
    // ---- WARNINGS at the approval (the readings of another entry saved meanwhile): said as warnings, not "refused" ----
    const a = sent('A');
    W('warns');
    let r = api(S, 'decideChangeRequest', { id: a, approve: true });
    assert.deepStrictEqual([r.status, r.result], ['Returned', 'Not saved: To check (warnings, not mistakes): Line 2: MH-1: KM Reading 5 is less than the last KM Reading 9. | Line 4: MH-2: Hrs Reading 1 is less than the last Hrs Reading 2. – the sender can send it again and confirm them'], JSON.stringify(r));
    const h0 = req(a).history.length;
    // sent again as it was: the same warnings – said, to confirm; nothing changes
    r = api(M, 'resendFlow', { id: a, note: 'try' });
    assert.deepStrictEqual([r.done.length, r.failed.length, r.failed[0].warn], [0, 1, true], JSON.stringify(r).slice(0, 400));
    assert.strictEqual(r.failed[0].error, 'Not sent again: To check (warnings, not mistakes): Line 2: MH-1: KM Reading 5 is less than the last KM Reading 9. | Line 4: MH-2: Hrs Reading 1 is less than the last Hrs Reading 2. – entry ' + a + ' stays as it is (nothing is lost); check them and press "Send again anyway" to confirm them.');
    assert.deepStrictEqual([req(a).status, req(a).history.length, argsOf(a)[0].force], ['Returned', h0, undefined], 'nothing changed');
    // "Send again anyway": confirmed – to level 1, the confirmation kept with it; saved as it is when approved
    r = api(M, 'resendFlow', { ids: [a], note: 'readings checked – a later day was saved first', force: true });
    assert.deepStrictEqual([r.done.map(x => x.id), r.failed.length], [[a], 0], JSON.stringify(r).slice(0, 400));
    const ra = req(a);
    assert.deepStrictEqual([ra.status, ra.history.slice(-1)[0].step, ra.history.slice(-1)[0].note], ['Pending', 'Sent again', 'readings checked – a later day was saved first – warnings confirmed by the sender']);
    assert.deepStrictEqual(argsOf(a), [{ n: 'A', force: true }], 'kept confirmed for the approval – nothing else changed');
    assert.deepStrictEqual(saved(), [], 'nothing saved before the approval');
    assert.strictEqual(api(S, 'decideChangeRequest', { id: a, approve: true }).status, 'Approved');
    assert.deepStrictEqual(saved(), ['A'], 'approved: saved as it was sent, the warnings confirmed');
    // ---- MISTAKES: said line by line; "anyway" does not pass a mistake ----
    const b = sent('B');
    W('errors');
    r = api(S, 'decideChangeRequest', { id: b, approve: true });
    assert.deepStrictEqual([r.status, r.result], ['Returned', 'Not saved: Line 3: "MH-X" is not in Master.']);
    r = api(M, 'resendFlow', { ids: [b], note: 'x', force: true });
    assert.deepStrictEqual([r.done.length, r.failed[0].warn, r.failed[0].error], [0, false, 'Not sent again: Line 3: "MH-X" is not in Master. – entry ' + b + ' stays as it is (nothing is lost); send it again when this is put right.']);
    assert.deepStrictEqual([req(b).status, argsOf(b)], ['Returned', [{ n: 'B' }]], 'not sent: not changed');
    // ---- ONE WARNING ("… Save anyway?", as one diesel issue): said without the page's question ----
    const c = sent('C');
    W('warn');
    r = api(S, 'decideChangeRequest', { id: c, approve: true });
    assert.strictEqual(r.result, 'Not saved: To check (a warning, not a mistake): MH-1: the next entry has a lower reading. – the sender can send it again and confirm them');
    r = api(M, 'resendFlow', { id: c, note: 'ok', force: true });
    assert.deepStrictEqual([r.status, r.done.map(x => x.id)], ['Pending', [c]]);
    assert.strictEqual(api(S, 'decideChangeRequest', { id: c, approve: true }).status, 'Approved');
    assert.deepStrictEqual(saved(), ['A', 'C']);
    // ---- many lines ("Multiple entries" of 59 lines): the approval says 8 and how many more; Send again lists them all, to check ----
    const e = sent('E');
    W('many');
    r = api(S, 'decideChangeRequest', { id: e, approve: true });
    assert.ok(/^Not saved: To check \(warnings, not mistakes\): Line 1: MH-1: .* \| Line 8: MH-8: [^|]* \| … 4 more – the sender can send it again and confirm them$/.test(r.result), r.result);
    r = api(M, 'resendFlow', { id: e, note: 'x' });
    assert.strictEqual(r.failed[0].error.split(' | ').length, 12, r.failed[0].error);
    assert.ok(r.failed[0].warn && /Line 12: MH-12: KM Reading 5 is less than the last KM Reading 9\. – entry /.test(r.failed[0].error));
    // ---- every "Save anyway" as its save reads it; every answer in words ----
    assert.deepStrictEqual(run(`() => [['deleteMaster', ['X']], ['deleteMasterMany', [['X', 'Y']]], ['submitBills', [{ bills: [] }]], ['saveDieselBulk', [{ rows: [] }]], ['updateDieselIssue', ['DI-1', { qty: 5 }]], ['saveDieselIssue', [{ qty: 5 }]], ['x', ['only text']]]
      .map(([f, a]) => [flowForce_(f, a), a])`), [[true, ['X', true]], [true, [['X', 'Y'], true]], [true, [{ bills: [], confirm: true }]], [true, [{ rows: [], force: true }]], [true, ['DI-1', { qty: 5, force: true }]], [true, [{ qty: 5, force: true }]], [false, ['only text']]]);
    assert.deepStrictEqual(run(`() => [flowRefusal_({ ok: false, used: [{ id: 'JCB-1', diesel: 2, log: 0 }] }), flowRefusal_({ ok: false, duplicates: [{ vendor: 'V1', existing: [{ billNo: '4', rev: 1 }] }] }), flowRefusal_({ ok: false, warning: 'X. Delete anyway?' }), flowRefusal_({ ok: false, error: 'E1' }), flowRefusal_({ ok: false })]`),
      [{ warn: true, text: 'To check (a warning, not a mistake): JCB-1 has 2 Diesel Issue and 0 Log Book entries (they stay)' },
        { warn: true, text: 'To check (a warning, not a mistake): V1: a bill for the same period is already submitted (RA Bill 4 rev 1) – the new one is saved with the same bill number as its revision and the older one is marked Superseded' },
        { warn: true, text: 'To check (a warning, not a mistake): X.' }, { warn: false, text: 'E1' }, { warn: false, text: 'the save refuses it – open the entry\'s page to see why' }]);
    // every save that answers "to confirm" is one of these (a new one: add it to flowRefusal_ / flowForce_ and here)
    const code = fs.readFileSync(path.join(root, 'app', 'Code.gs'), 'utf8').split('\n'), asks = new Set(); let fnName = '';
    code.forEach(l => { const m = l.match(/^function (\w+)\(/); if (m) fnName = m[1]; if (/return \{ ok: false, (warning|warnings|used|duplicates)\b/.test(l)) asks.add(fnName); });
    assert.deepStrictEqual([...asks].sort(), ['deleteMasterMany_', 'deleteMaster_', 'saveDieselBulk_', 'saveDieselIssue_', 'submitBills_', 'updateDieselIssue_']);
    const src = code.join('\n');
    assert.match(src, /function saveDieselBulk_\(b\) \{[\s\S]*?if \(warnings\.length && !b\.force\) return/);
    assert.match(src, /function saveDieselIssue_\(d, u\) \{[\s\S]*?if \(!d\.force\) \{/);
    assert.match(src, /function updateDieselIssue_\(id, d\) \{[\s\S]*?if \(!d\.force\) \{/);
    assert.match(src, /function submitBills_\(b\) \{[\s\S]*?if \(dup\.length && !b\.confirm\) return/);
    assert.match(src, /function deleteMaster_\(id, force\) \{/); assert.match(src, /function deleteMasterMany_\(ids, force\) \{/);
    // ---- the page: the warnings shown to confirm; "Send again anyway" sends them confirmed ----
    const app = fs.readFileSync(path.join(root, 'app', 'App.html'), 'utf8');
    assert.match(app, /askConfirm\(\{ title: 'Please check – warnings, not mistakes', ok: 'Send again anyway', wide: true, html: html \}\)/);
    assert.match(app, /said\(await call\('resendFlow', \{ ids: warn\.map\(f => f\.id\), note: note, force: true \}\)\);/);
    const wl = new Function(app.match(/    const warnLines = (t => [^\n]*);\n/)[0].replace('const warnLines =', 'return'))();
    assert.deepStrictEqual(wl('Not sent again: To check (warnings, not mistakes): Line 2: a. | Line 4: b. – entry VF-00011 stays as it is (nothing is lost); check them and press "Send again anyway" to confirm them.'), ['Line 2: a.', 'Line 4: b.']);
    // the words in Marathi and Hindi
    ['mr', 'hi'].forEach(l => { const d = JSON.parse(fs.readFileSync(path.join(root, 'app', 'i18n', l + '.json'), 'utf8'));
      ['Not sent again: {0} – entry {1} stays as it is (nothing is lost); check them and press "Send again anyway" to confirm them.', 'Please check – warnings, not mistakes', 'Send again anyway', 'To check (warnings, not mistakes): {0}', 'To check (a warning, not a mistake): {0}']
        .forEach(k => assert.ok(d[k], l + ': ' + k)); });
  } finally {
    vm.runInContext(`SbBook_.prototype.flush = __k129.flush; SbBook_.prototype.loadMany = __k129.loadMany; SbSheet_.prototype.load_ = __k129.load_; sbDiscard_ = __k129.discard; rtcPush_ = __k129.push; delete API_.test129;
      CacheService.getScriptCache().remove("USERS_LIST"); kvWrite_("FLOW_RULES", "{}"); SB_BOOK_ = null; TABLE_MEMO_ = {};`, ctx);
  }
});
