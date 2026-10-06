// (1) A saved bill opened from RCL Drive shows its LOG BOOK after its papers. (2) Every print window has "Excel": the same pages as
// an .xlsx, every page a tab. The real print window, PDF pages counted; the real .xlsx read back with openpyxl.
//   node viewbill.js 3000   (this code)      node viewbill.js 3002   (the code that is live – the "before" of point 1)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'); const { execSync } = require('child_process');
const PORT = Number(process.argv[2] || 3000), NEW = PORT === 3000;
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 640) : '')); };
const clean = () => sql("delete from bills where vendor_name = 'View Vendor Noreg'; delete from log_book where machinery like 'VBX-%'; delete from diesel_issue where machinery like 'VBX-%'; delete from boq where vendor_name = 'View Vendor Noreg'; delete from master where id like 'VBX-%'; delete from vendors where vendor_name = 'View Vendor Noreg';");
const xlsxRead = file => JSON.parse(execSync('python3 -I -', { input: `
import json, sys, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(file)})
o = {"sheets": wb.sheetnames, "data": {}}
for ws in wb.worksheets:
    rows = []
    for row in ws.iter_rows():
        rows.append([[c.coordinate, c.value, c.data_type, c.number_format, {"b": bool(c.font and c.font.b), "sz": c.font.sz if c.font else None, "fill": (c.fill.fgColor.rgb if c.fill and c.fill.fill_type == "solid" else None), "bd": "".join(k[0] for k in ("left", "right", "top", "bottom") if getattr(c.border, k) is not None and getattr(c.border, k).style), "h": c.alignment.horizontal if c.alignment else None, "wrap": bool(c.alignment and c.alignment.wrap_text)}] for c in row if c.value is not None])
    bordered = sum(1 for row in ws.iter_rows() for c in row if c.border is not None and any(getattr(c.border, k) is not None and getattr(c.border, k).style for k in ("left", "right", "top", "bottom")))
    ps = ws.page_setup
    o["data"][ws.title] = {"rows": [r for r in rows if r], "merges": [str(m) for m in ws.merged_cells.ranges], "dims": ws.dimensions, "bordered": bordered, "grid": bool(ws.sheet_view.showGridLines),
        "page": {"orient": ps.orientation, "paper": ps.paperSize, "fitW": ps.fitToWidth, "fitH": ps.fitToHeight, "fit": bool(ws.sheet_properties.pageSetUpPr and ws.sheet_properties.pageSetUpPr.fitToPage)},
        "widths": sorted(set(round(d.width, 1) for d in ws.column_dimensions.values() if d.width))[:40], "ncols": ws.max_column, "nrows": ws.max_row, "images": len(getattr(ws, "_images", []))}
print(json.dumps(o))
` }).toString());
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const must = (n, r) => { if (!r || r.ERROR || r.ok === false) out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
  const mach = (no, type) => ({ no: no, name: type, type: type, unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'View Vendor Noreg', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' });
  must('m1', await api('saveMaster', mach('VBX-1', 'Trailer'), 'add')); must('m2', await api('saveMaster', mach('VBX-2', 'Tipper'), 'add'));
  must('vendor', await api('saveVendor', { name: 'View Vendor Noreg', gstReg: 'No', pan: 'ABCPE1234V', bank: 'SBI', account: '000123456789', ifsc: 'SBIN0000001' }, 'add'));
  must('boq', await api('saveBoq', { vendor: 'View Vendor Noreg', from: '2026-09-01', tdsPct: 2, woNo: 'WO-VB', lines: [{ no: 'VBX-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }, { no: 'VBX-2', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add'));
  const dd = d => '2026-09-' + String(d).padStart(2, '0');
  let rows = [], k = 55263; for (let d = 1; d <= 30; d++) rows.push({ date: dd(d), shift: 'Day', no: 'VBX-1', mode: 'KM', openingKm: d === 1 ? k : undefined, closingKm: (k += 20 + d), chFrom: 'RCL CAMP TO CASTING YARD TO SONALE TO RCL CAMP 567+070 RHS', work: 'BARRICADES LOADING FOR INSTALLATION WORK' });
  must('log 1', await api('saveLogRows', { rows: rows }));
  rows = []; k = 9000; for (let d = 1; d <= 10; d++) rows.push({ date: dd(d), shift: 'Full Day', no: 'VBX-2', mode: 'KM', openingKm: d === 1 ? k : undefined, closingKm: (k += 40), work: 'Murum carting' });
  must('log 2', await api('saveLogRows', { rows: rows }));
  must('diesel', await api('saveDieselIssue', { date: dd(2), shift: 'Day', source: 'Dispenser', no: 'VBX-2', qty: 300, kmReading: 9040, force: true }));      // far over the standard: a diesel Debit Note
  must('diesel 2', await api('saveDieselIssue', { date: dd(9), shift: 'Day', source: 'Dispenser', no: 'VBX-2', qty: 20, kmReading: 9320, force: true }));      // (the LAST fill of a period is partly still in the tank – the first one is the one debited)
  const co = ((await api('billInit')).companies || ['Rachana Construction Limited'])[0];

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.removeItem('rcl_orient_rep_rep-lb'); localStorage.removeItem('rcl_orient_rep'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.addScriptTag({ path: path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js') });      // the Excel tool from the local copy (the CDN is closed in the test rig)
  await f.addScriptTag({ path: path.join(__dirname, 'node_modules/exceljs/dist/exceljs.min.js') });     // the formatting tool, the same version the app loads (4.4.0)
  await f.evaluate(() => { window.__xl = []; XLSX.writeFile = function (wb, name) { window.__xl.push({ name: name, plain: true, b64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) }); };
    saveXlsxBuffer = function (buf, name) { const u = new Uint8Array(buf); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); window.__xl.push({ name: name, b64: btoa(bin) }); }; });
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  const pdfOf = async (w, name) => { const file = '/home/claude/test/shots/vb_' + (NEW ? 'new' : 'old') + '_' + name + '.pdf'; await w.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    return { pages: Number((execSync('pdfinfo "' + file + '"').toString().match(/Pages:\s+(\d+)/) || [])[1]), text: execSync('pdftotext -layout "' + file + '" -').toString().replace(/\s+/g, ' '), file: file }; };
  // the print window that a click opens (waits until its pages are written)
  const popupOf = async click => { const got = new Promise(res => b.once('targetcreated', t => res(t))); await click(); for (let i = 0; i < 12; i++) { await wait(300); await yes(); }
    const t = await Promise.race([got, wait(15000).then(() => null)]); if (!t) return null; const w = await t.page(); w.__said = []; w.on('dialog', async d => { w.__said.push(d.message()); try { await d.accept(); } catch (e) {} });
    for (let i = 0; i < 60; i++) { if (await w.evaluate(() => !!document.querySelector('.sheet')).catch(() => false)) break; await wait(300); } await wait(2200); return w; };
  const excelOf = async (w, name) => { const before = await f.evaluate(() => window.__xl.length); const has = await w.evaluate(() => { const x = document.getElementById('xl_btn'); if (!x) return false; x.click(); return true; }); if (!has) return null;
    let x = null; for (let i = 0; i < 60 && !x; i++) { await wait(400); x = await f.evaluate(n => window.__xl[n] || null, before); } if (!x) return { none: true };
    const file = '/home/claude/test/shots/' + name + '.xlsx'; fs.writeFileSync(file, Buffer.from(x.b64, 'base64')); return Object.assign({ name: x.name, plain: !!x.plain, file: file, btn: await w.evaluate(() => document.getElementById('xl_btn').textContent) }, xlsxRead(file)); };

  // ---------- the bill is made and submitted ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
  await f.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /View Vendor Noreg/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-05'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co).catch(e => out.push('bill load: ' + String(e.message).slice(0, 120)));
  for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await f.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
  const bill = await f.evaluate(() => { const x = S.mb.bills[0]; return x ? { A: x.A, B: x.B, I: x.I, G: x.G } : null; });
  await wait(1500);
  const onPage = await f.evaluate(() => { const pg = document.querySelector('#mb_pages .mb-page'), fr = pg && pg.querySelector('iframe.mb-lbf'), d = fr && fr.contentDocument;
    return { heads: pg ? [...pg.querySelectorAll('.mb-doc-h')].map(h => h.textContent.trim().slice(0, 26)) : [], frame: !!fr, machines: d ? [...d.querySelectorAll('.lb-mach')].map(x => x.textContent.trim()) : [], entries: d ? d.querySelectorAll('table.lb-t tbody tr').length : 0, frame_px: fr ? Math.round(fr.getBoundingClientRect().height) : 0 }; });
  if (NEW) { ok('bill page after "Build bills": under the Abstract, Tax Invoice, Declaration and Debit Note stands the LOG BOOK of the bill\'s machinery (both sheets, 40 entries)', onPage.frame && onPage.machines.join(' | ') === 'VBX-1 (TRAILER) | VBX-2 (TIPPER)' && onPage.entries === 40 && onPage.frame_px > 1500 && /Log Book/.test(onPage.heads.join('|')), onPage);
    await f.evaluate(() => { const fr = document.querySelector('#mb_pages iframe.mb-lbf'); if (fr) fr.scrollIntoView({ block: 'start' }); }); await wait(500); await p.screenshot({ path: '/home/claude/test/shots/vb_buildpage.png' }); }
  await f.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const no = tr.querySelector('.mb-no'); if (no && !no.value) { no.value = '51'; no.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(900);
  const sub = new Promise(res => b.once('targetcreated', t => res(t)));
  await f.evaluate(() => document.getElementById('mb_abstract').click());
  for (let i = 0; i < 50; i++) { await wait(500); await yes(); if (sql("select count(*) from bills where vendor_name = 'View Vendor Noreg' and status = 'Active'") === '1') break; }
  const t0 = await Promise.race([sub, wait(15000).then(() => null)]); let subPdf = null; if (t0) { const w = await t0.page(); await wait(2500); if (NEW) subPdf = await pdfOf(w, 'aftersubmit'); await w.close(); }
  ok('the bill is submitted (A = work, B = diesel debit)', sql("select count(*) from bills where vendor_name = 'View Vendor Noreg' and status = 'Active'") === '1' && bill && bill.B > 0, bill);

  if (NEW) ok('the print that opens after "Verify & Submit": the 4 papers AND the Log Book of both machinery – 6 pages', subPdf && subPdf.pages === 6 && /LOG BOOK – SEPTEMBER 2026/.test(subPdf.text) && /VBX-1 \(TRAILER\)/.test(subPdf.text) && /VBX-2 \(TIPPER\)/.test(subPdf.text) && /DEBIT NOTE/.test(subPdf.text) && /DECLARATION OF GST NON-ENROLMENT/.test(subPdf.text), subPdf && { pages: subPdf.pages });
  // ---------- 1. RCL Drive → Saved Bills → View / Print ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bills'); }); await wait(1200);
  await f.evaluate(() => { document.getElementById('sb_from').value = '2026-09-01'; document.getElementById('sb_to').value = '2026-09-30'; return sbLoad(); }); await wait(1500);
  let w = await popupOf(() => f.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => r.textContent.indexOf('View Vendor Noreg') > -1); tr.querySelector('[data-sbv]').click(); }));
  const lay = await w.evaluate(() => ({ papers: document.querySelectorAll('.sheet > section.billsheet').length, logbooks: [...document.querySelectorAll('.sheet > section.lbsheet')].map(s => (s.querySelector('.lb-mach') || {}).textContent + ' ' + s.querySelectorAll('table.lb-t tbody tr').length + ' entries, fitted ' + (s.dataset.fit ? Math.round(Number(s.dataset.fit) * 100) + '%' : '–')), excel: !!document.getElementById('xl_btn'), title: document.title }));
  const pdf = await pdfOf(w, 'savedbill');
  if (NEW) {
    ok('1. View / Print of the saved bill: 4 papers (Abstract, Tax Invoice, GST Declaration, Debit Note) and then the LOG BOOK of both machinery', lay.papers === 4 && lay.logbooks.length === 2 && /VBX-1.*30 entries/.test(lay.logbooks[0]) && /VBX-2.*10 entries/.test(lay.logbooks[1]), lay);
    ok('   printed: 6 pages – every paper and every machinery\'s Log Book on a page of its own', pdf.pages === 6 && /LOG BOOK – SEPTEMBER 2026/.test(pdf.text) && /VBX-1 \(TRAILER\)/.test(pdf.text) && /VBX-2 \(TIPPER\)/.test(pdf.text) && /DECLARATION OF GST NON-ENROLMENT/.test(pdf.text) && /DEBIT NOTE/.test(pdf.text), { pages: pdf.pages });
    execSync('pdftoppm -r 60 -png "' + pdf.file + '" /home/claude/test/shots/vb_saved');
    // ---------- 2. Excel of that bill ----------
    const x = await excelOf(w, 'vb_bill');
    ok('2. "Excel" in the print window of the bill: one FORMATTED file, a TAB for every page', x && !x.none && !x.plain && x.btn === 'Excel ✓' && JSON.stringify(x.sheets) === JSON.stringify(['Abstract', 'Tax Invoice', 'GST Declaration', 'Debit Note', 'LB VBX-1', 'LB VBX-2']) && /^RCL_Abstract_of_Bill_View_Vendor_Noreg_RA_Bill_51\.xlsx$/.test(x.name), x && { file: x.name, tabs: x.sheets });
    const cellsOf = sh => [].concat(...((x.data[sh] || {}).rows || [])), find = (sh, re) => cellsOf(sh).filter(c => typeof c[1] === 'string' && re.test(c[1])), nums = sh => cellsOf(sh).filter(c => c[2] === 'n').map(c => c[1]);
    ok('   Abstract tab: the work-done amount and the net payable are NUMBERS (can be added in Excel)', nums('Abstract').indexOf(bill.A) > -1 && nums('Abstract').indexOf(bill.I) > -1, { A: bill.A, net: bill.I, numbers_in_tab: nums('Abstract').length });
    ok('   Tax Invoice tab: amounts are numbers; the account number 000123456789 and the dates stay TEXT', nums('Tax Invoice').indexOf(bill.G) > -1 && find('Tax Invoice', /000123456789/).length === 1 && find('Tax Invoice', /05\.10\.2026/).length >= 1, { G: bill.G, account: (find('Tax Invoice', /000123456789/)[0] || [])[1].slice(0, 80) });
    ok('   GST Declaration tab: the lines of the declaration, the party\'s name in it', find('GST Declaration', /DECLARATION OF GST NON-ENROLMENT/).length === 1 && find('GST Declaration', /I\/We View Vendor Noreg ?, do hereby declare/).length === 1 && find('GST Declaration', /Name of the Authorised Signatory: View Vendor Noreg/).length === 1, cellsOf('GST Declaration').slice(0, 4).map(c => String(c[1]).slice(0, 50)));
    ok('   Debit Note tab: the diesel debit as a number', nums('Debit Note').indexOf(bill.B) > -1, { B: bill.B });
    // ----- the look: the same as the print -----
    const stOf = sh => cellsOf(sh).map(c => c[4]), ab = x.data['Abstract'] || {}, tx = x.data['Tax Invoice'] || {}, lbx = x.data['LB VBX-1'] || {};
    const hdr = find('LB VBX-1', /^DATE$/)[0], tot = find('LB VBX-1', /^TOTAL$/).pop(), net = find('Abstract', /Net Payable Amt/)[0];
    ok('   the LOOK – Log Book tab: every table cell has its border (' + lbx.bordered + ' cells), the heading row is shaded and bold, the TOTAL row has its yellow, letters wrap', lbx.bordered > 30 * 17 && hdr && hdr[4].fill === 'FFE9ECEF' && hdr[4].b && /l/.test(hdr[4].bd) && /t/.test(hdr[4].bd) && tot && tot[4].fill === 'FFFFF1C7' && stOf('LB VBX-1').filter(z => z.wrap).length > 100, { bordered: lbx.bordered, heading: hdr && hdr[4], total: tot && tot[4] });
    ok('   Abstract and Tax Invoice tabs: borders, bold, shading; the Net Payable line keeps its colour', ab.bordered > 40 && tx.bordered > 40 && stOf('Abstract').some(z => z.b) && net && net[4].fill === 'FFFFF4C8' && net[4].b && stOf('Tax Invoice').some(z => z.fill === 'FFEEF1F4'), { abstract_bordered: ab.bordered, tax_bordered: tx.bordered, net: net && net[4] });
    ok('   widths and heights follow the print (many column widths, not one), Excel\'s own grid lines are off', lbx.widths.length >= 8 && ab.widths.length >= 6 && [ab, tx, lbx].every(d => d.grid === false), { logbook_widths: lbx.widths.slice(0, 14), cols: lbx.ncols, rows: lbx.nrows });
    ok('   page set-up of every tab: A4 portrait, fitted to one page – printing the Excel gives the same pages', x.sheets.every(sh => { const pg = x.data[sh].page; return pg.orient === 'portrait' && Number(pg.paper) === 9 && pg.fit && Number(pg.fitW) === 1 && Number(pg.fitH) === 1; }), x.data['Abstract'].page);
    const lb1 = x.data['LB VBX-1'] || { rows: [], merges: [] }, dataRows = lb1.rows.filter(r => r.some(c => /^\d\d-09-2026$/.test(String(c[1]))));
    ok('   Log Book tab: 30 date rows; date as text, readings as numbers, heading cells joined as on the paper; signatures side by side', dataRows.length === 30 && dataRows[0].some(c => c[1] === '01-09-2026' && c[2] === 's') && dataRows[0].some(c => c[1] === 55263 && c[2] === 'n') && lb1.merges.length > 3 && lb1.rows.some(r => r.filter(c => /^(CONTRACTOR|PREPARED & CHECKED BY|CHECKED BY|VERIFIED BY|APPROVED BY)$/.test(String(c[1]))).length === 5), { date_rows: dataRows.length, first_row: dataRows[0] && dataRows[0].slice(0, 8).map(c => c[1]), joined: lb1.merges.length });
  } else {
    ok('BEFORE (the code that is live): View / Print of the saved bill has the papers only – no Log Book, no Excel button', lay.logbooks.length === 0 && !lay.excel && !/LOG BOOK –/.test(pdf.text), { papers: lay.papers, logbooks: lay.logbooks.length, pages: pdf.pages, excel_button: lay.excel });
  }
  await w.close();

  if (NEW) {
    // ---------- 3. every other print has it too ----------
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('log'); }); await wait(2000);
    await f.evaluate(() => { document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n = document.getElementById('lf_no'); n.value = 'VBX-2'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
    w = await popupOf(() => f.evaluate(() => [...document.querySelectorAll('#sec-log button')].find(x => /Print Log Book/.test(x.textContent)).click()));
    let x = w && await excelOf(w, 'vb_logbook'); const lbPdf = w && await pdfOf(w, 'logbook');
    ok('3. Log Book print: "Excel" gives the Log Book (1 tab, 10 date rows); the print itself is still 1 page', x && !x.none && JSON.stringify(x.sheets) === JSON.stringify(['LB VBX-2']) && x.data['LB VBX-2'].rows.filter(r => r.some(c => /^\d\d-09-2026$/.test(String(c[1])))).length === 10 && lbPdf.pages === 1, x && { file: x.name, tabs: x.sheets, pages: lbPdf.pages });
    if (w) await w.close();
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('master'); }); await wait(1800);
    w = await popupOf(() => f.evaluate(() => document.getElementById('m_print').click()));
    x = w && await excelOf(w, 'vb_master'); const txt = w && await w.evaluate(() => document.querySelector('.sheet').innerText.replace(/\s+/g, ' '));
    const all = x && !x.none ? [].concat(...x.data[x.sheets[0]].rows) : [];
    const rep1 = x && !x.none ? x.data[x.sheets[0]] : {};
    ok('   …formatted too: borders on its cells, landscape as its print, as many pages down as it needs', x && !x.plain && rep1.bordered > 20 && rep1.page.orient === 'landscape' && rep1.page.fit && Number(rep1.page.fitW) === 1 && Number(rep1.page.fitH) === 0, { bordered: rep1.bordered, page: rep1.page });
    ok('   a report print (Asset Master list): "Excel" gives one tab with the heading lines and the table – VBX-1 and VBX-2 are in it', x && !x.none && x.sheets.length === 1 && all.some(c => c[1] === 'VBX-1') && all.some(c => c[1] === 'VBX-2') && all.some(c => /Asset Master/i.test(String(c[1]))) && /VBX-1/.test(txt), x && { file: x.name, tab: x.sheets[0], cells: all.length });
    if (w) await w.close();
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1200);
    w = await popupOf(() => f.evaluate(() => document.getElementById('mb_preview').click()));
    const pvPdf = w && await pdfOf(w, 'preview');
    x = w && await excelOf(w, 'vb_preview');
    ok('   "Print Preview" on the billing page: the papers and the Log Book together (6 pages); its Excel has them as tabs', x && !x.none && pvPdf.pages === 6 && JSON.stringify(x.sheets) === JSON.stringify(['Abstract', 'Tax Invoice', 'GST Declaration', 'Debit Note', 'LB VBX-1', 'LB VBX-2']), x && { pages: pvPdf.pages, tabs: x.sheets });
    // ---------- 4. without the formatting tool (no internet for it): the plain Excel, and it says so ----------
    await f.evaluate(() => { window.__keepX = window.ExcelJS; window.ExcelJS = undefined; rclLoadExcelJs = () => Promise.reject(new Error('The Excel formatting tool could not be loaded.')); });
    x = w && await excelOf(w, 'vb_plain');
    ok('4. the formatting tool cannot be loaded: the plain Excel is given (same tabs) and a message says it is without formatting', x && !x.none && x.plain === true && x.sheets.length === 6 && (w.__said || []).some(m => /WITHOUT formatting/.test(m)), x && { tabs: x.sheets.length, said: (w.__said || [])[0] });
    await f.evaluate(() => { window.ExcelJS = window.__keepX; });
    if (w) await w.close();
  }
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
