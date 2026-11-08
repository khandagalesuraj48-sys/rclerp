// update-150 (QR labels: by owner, or the machinery ticked – one or many; 8 on an A4 page, 2 × 4) in the browser, on the local
// rig (Mechanical :3001, database rcl). Test data only ("QR150" machinery and their two owners), all taken out at the end.
//   1. Asset Master → QR labels: the owners with how many machinery; all ticked at first;
//   2. one owner → all its machinery ticked (9 → 2 pages); Make the labels → the print: 8 on the first page, 1 on the second
//      (the real print window, made into a PDF: 2 A4 pages);
//   3. one machinery: Untick all shown, Find, tick it → 1 label (1 page); nothing ticked → "Make the labels" cannot be pressed;
//   4. several machinery of different owners → their labels only;
//   5. a phone-size screen: the chooser fits; no script error.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node qr150.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), path = require('path'), fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!';
const post = async body => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
// the pages of a PDF (pdfinfo of poppler when it is there; else the page objects that are not packed)
const pdfPages = (buf, file) => { fs.writeFileSync(file, buf); try { return Number((execSync('timeout 20 pdfinfo "' + file + '"').toString().match(/^Pages:\s+(\d+)/m) || [])[1] || 0); } catch (e) { return (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length; } };
(async () => {
  const cleanup = () => sql("delete from master where id like 'QR150-%'; delete from vendors where vendor_name like 'QR150 %'; delete from web.cache where key like 'SB%';");
  const errs = [], files = path.join(process.cwd(), 'shots'); fs.mkdirSync(files, { recursive: true });
  let b = null;
  try {
    cleanup();
    const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const A = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const vs = []; for (const [nm, pan] of [['QR150 Owner A', 'ABCPQ1150A'], ['QR150 Owner B', 'ABCPQ2150B']]) vs.push(await A('saveVendor', { name: nm, gstReg: 'No', pan: pan, bank: 'SBI', account: '1500150' + pan.slice(-2, -1), ifsc: 'SBIN0000150' }, 'add'));
    const mach = (no, owner) => ({ no: no, name: 'Tipper ' + no.slice(-2), type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: owner, ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' });
    const ms = [];
    for (let i = 1; i <= 9; i++) ms.push(await A('saveMaster', mach('QR150-A' + i, 'QR150 Owner A'), 'add'));
    for (let i = 1; i <= 2; i++) ms.push(await A('saveMaster', mach('QR150-B' + i, 'QR150 Owner B'), 'add'));
    ok('seed: 2 owners, 9 + 2 machinery', vs.every(v => !v.ERROR) && ms.every(m => !m.ERROR && m.ok !== false) && sql("select count(*) from master where id like 'QR150-%'") === '11', { vs: vs, ms: ms.filter(m => m.ERROR) });

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const c = document.getElementById('ai_close'); if (c && c.offsetParent !== null) c.click(); showTab('master'); });
    await wait(2500);
    const state = () => F.evaluate(() => ({ count: $('qr_count').textContent, rows: [...document.querySelectorAll('#qr_list [data-qr]')].map(c => c.dataset.qr + (c.checked ? '+' : '-')), okOff: $('cf_ok').disabled,
      owners: [...$('qr_owner').options].map(o => o.textContent) }));
    const openQr = async () => { await F.evaluate(() => { const c = document.getElementById('ai_close'); if (c && c.offsetParent !== null) c.click(); S.masterEdit = null; $('m_qr').click(); }); await wait(600); };      // (the assistant's panel closed first)
    // the print window of "Make the labels": the real one (printDoc), caught as it opens
    let made = 0;
    const make = async () => {
      const tp = new Promise(r => { const on = t => { if (t.type() === 'page') { b.off('targetcreated', on); r(t); } }; b.on('targetcreated', on); setTimeout(() => r(null), 15000); });
      await F.click('#cf_ok');
      const t = await tp; if (!t) return { none: true };
      const w = await t.page(); await wait(1500);
      const x = await w.evaluate(() => ({ title: document.title, pages: [...document.querySelectorAll('.qrs')].map(g => g.querySelectorAll('.qrl').length),
        nos: [...document.querySelectorAll('.qrl b')].map(e => e.textContent), svg: document.querySelectorAll('.qrl svg').length,
        over: [...document.querySelectorAll('.qrl')].some(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) }));
      x.pdf = pdfPages(await w.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }), path.join(files, '150-qr-labels-' + (++made) + '.pdf'));
      x.w = w; return x;
    };
    // ---- 1. the chooser ----
    await openQr();
    let st = await state();
    const all = Number((st.count.match(/^(\d+) ticked/) || [])[1] || 0);
    ok('1. QR labels: the owners with how many machinery; every active machinery ticked at first', st.owners.some(o => o === 'QR150 Owner A (9)') && st.owners.some(o => o === 'QR150 Owner B (2)') && /^All owners \(\d+ machinery\)$/.test(st.owners[0]) &&
      all >= 11 && st.rows.length === all && st.rows.every(r => r.endsWith('+')), st);
    // ---- 2. one owner ----
    await F.evaluate(() => { $('qr_owner').value = 'QR150 Owner A'; $('qr_owner').dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
    st = await state();
    ok('2. one owner: all its 9 machinery ticked – "9 ticked – 2 pages"', st.count === '9 ticked – 2 pages' && st.rows.length === 9 && st.rows.every(r => /^QR150-A\d\+$/.test(r)), st);
    await p.screenshot({ path: path.join(files, '150-qr-chooser.png') });
    let L = await make();
    ok('   Make the labels → the print: "QR labels – QR150 Owner A – 9 machinery", 8 on the first page, 1 on the second, each with its QR code', !L.none && L.title === 'QR labels – QR150 Owner A – 9 machinery' && JSON.stringify(L.pages) === '[8,1]' && L.svg === 9 &&
      L.nos.join() === 'QR150-A1,QR150-A2,QR150-A3,QR150-A4,QR150-A5,QR150-A6,QR150-A7,QR150-A8,QR150-A9', L.none ? L : { title: L.title, pages: L.pages, svg: L.svg, nos: L.nos });
    ok('   …as a PDF: 2 A4 pages; nothing cut inside a label', L.pdf === 2 && !L.over, { pdf: L.pdf, over: L.over });
    if (L.w) { await L.w.setViewport({ width: 900, height: 1200 }); await L.w.screenshot({ path: path.join(files, '150-qr-labels.png'), fullPage: true }); await L.w.close(); }
    // ---- 3. one machinery ----
    await openQr();
    await F.evaluate(() => { $('qr_owner').value = 'QR150 Owner B'; $('qr_owner').dispatchEvent(new Event('change', { bubbles: true })); $('qr_untick').click(); }); await wait(300);
    st = await state();
    ok('3. Untick all shown: "Nothing ticked" – Make the labels cannot be pressed', st.count === 'Nothing ticked' && st.okOff && st.rows.every(r => r.endsWith('-')), st);
    await F.evaluate(() => { const i = $('qr_find'); i.value = 'qr150-b2'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(300);
    await F.click('#qr_list [data-qr="QR150-B2"]'); await wait(200);
    st = await state();
    ok('   Find "qr150-b2" (any case), tick it: "1 ticked – 1 page"', st.count === '1 ticked – 1 page' && st.rows.join() === 'QR150-B2+' && !st.okOff, st);
    L = await make();
    ok('   one label: "QR labels – QR150-B2", 1 page', !L.none && L.title === 'QR labels – QR150-B2' && JSON.stringify(L.pages) === '[1]' && L.pdf === 1, L.none ? L : { title: L.title, pages: L.pages, pdf: L.pdf });
    if (L.w) await L.w.close();
    // ---- 4. several machinery, of different owners ----
    await openQr();
    await F.evaluate(() => { const i = $('qr_find'); i.value = 'QR150-'; i.dispatchEvent(new Event('input', { bubbles: true })); $('qr_untick').click(); }); await wait(300);
    for (const no of ['QR150-A3', 'QR150-A7', 'QR150-B1']) { await F.click('#qr_list [data-qr="' + no + '"]'); await wait(150); }
    st = await state();
    ok('4. machinery of two owners ticked: "3 ticked – 1 page"', st.count === '3 ticked – 1 page' && st.rows.filter(r => r.endsWith('+')).join() === 'QR150-A3+,QR150-A7+,QR150-B1+', st);
    L = await make();
    ok('   their 3 labels only: "QR labels – 3 machinery"', !L.none && L.title === 'QR labels – 3 machinery' && L.nos.join() === 'QR150-A3,QR150-A7,QR150-B1' && L.pdf === 1, L.none ? L : { title: L.title, nos: L.nos, pdf: L.pdf });
    if (L.w) await L.w.close();
    // ---- 5. a phone-size screen ----
    await p.setViewport({ width: 390, height: 844 }); await wait(800);
    await openQr();
    const wide = await F.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    await p.screenshot({ path: path.join(files, '150-qr-phone.png') });
    ok('5. a phone-size screen: the chooser fits (the page does not get wider)', wide <= 0, wide);
    await F.evaluate(() => closeConfirm(false));
    ok('no script error on the page', errs.length === 0, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
