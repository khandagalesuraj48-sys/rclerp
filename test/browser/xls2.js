// the real Excel writer (ExcelJS, with drop-downs and formulas): does the file open and carry them?
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const path = require('path'); const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(3000);
  await f.addScriptTag({ path: path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js') }); await f.addScriptTag({ path: path.join(__dirname, 'node_modules/exceljs/dist/exceljs.min.js') });
  const res = await f.evaluate(async () => { try { closeConfirm(false); } catch (e) {}
    let blob = null; const keep = URL.createObjectURL; URL.createObjectURL = bl => { blob = bl; return keep.call(URL, bl); };
    document.getElementById('lf_from').value = '2026-09-30'; document.getElementById('lf_to').value = '2026-10-02'; document.getElementById('lf_no').value = 'EX-200';
    document.getElementById('lf_exp_mach').click(); for (let i = 0; i < 60 && !blob; i++) await new Promise(r => setTimeout(r, 300));
    if (!blob) return { err: 'no file' };
    const buf = new Uint8Array(await blob.arrayBuffer()); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('EX-200'); const head = []; ws.getRow(5).eachCell({ includeEmpty: true }, c => head.push(String(c.value || '')));
    const col = h => head.indexOf(h) + 1; const last = ws.getRow(8);
    const x = XLSX.read(buf, { type: 'array' }); const a = XLSX.utils.sheet_to_json(x.Sheets['EX-200'], { header: 1, defval: '' });
    return { bytes: buf.length, tabs: wb.worksheets.map(w => w.name), head: head.join(' | '), total6: JSON.stringify(ws.getRow(6).getCell(col('Total Hrs')).value), total8: JSON.stringify(last.getCell(col('Total Hrs')).value),
      listMeasured: JSON.stringify((last.getCell(col('Measured by')).dataValidation || {}).formulae), listWork: JSON.stringify((last.getCell(col('Work type')).dataValidation || {}).formulae), measured8: last.getCell(col('Measured by')).value,
      yellowWork: JSON.stringify(((last.getCell(col('Work type')).fill || {}).fgColor || {}).argb || ''), readBack: a.slice(5, 8).map(r => r.slice(0, 9).join(',')).join(' ; ') }; });
  console.log(JSON.stringify(res, null, 1).slice(0, 1500)); console.log('script errors:', errs.join(' | ') || 'none');
  await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
