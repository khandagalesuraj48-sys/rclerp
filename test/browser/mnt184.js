// update-184 (asked 28-10-2026: "new vendor banwanatana sadhya ekach aahe vendor name tr tith company name as banaw ani ajun ek fild kr owner
// name … vendor che attachment add option de … adhar pan gst … udyam bank details … kadhi pn mi bgu shaku print or download kru shaku …
// asset master madhe papers fkt own mhanje rachana che ghenar") – on the local rig (PORTAL=1): site S1 (database rcl). Test data only.
//   1. before step 1zj: the form says "Company Name"; the Owner Name and the documents say what to run; a vendor saved as before
//   2. step 1zj run (twice – it only adds): a new vendor with its Owner Name, its PAN (a PDF) and Aadhaar (a photo) – kept in the
//      store, saved with the vendor (each its kind); the list: Documents 📎 2 – each to open, print, download
//   3. the Asset Master: the papers only for Own (a Rental one: not shown); Vehicle Compliance: only Own machinery
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt184.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'); const path = require('path'); const fs = require('fs'); const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const sqlFile = (db, f) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -v ON_ERROR_STOP=1 -tA -q"', { input: fs.readFileSync(f) }).toString();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1500) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp';
const V1 = 'Before 1zj Traders 184', V2 = 'Test Earthmovers 184', OWN = 'OWN-184', RENT = 'RENT-184';
(async () => {
  const errs = []; let b = null, cookie = '';
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnt184-'));
  const had = sql('rcl', "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'vendors' and column_name in ('owner_name', 'documents')");
  try {
    ok('start: S1 (rcl) without step 1zj', had === '0', had);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), d1 = init.today.slice(0, 8) + '01';
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    const open = async () => { await mp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' }); const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today); await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(4000); return F; };
    let F = await open();
    const tidy = async () => { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) { y.hidden = true; y.style.display = 'none'; } }); }); await wait(300); };
    // ---- 1. before step 1zj ----
    await F.evaluate(() => showTab('vendors')); await wait(2500); await tidy();
    await F.evaluate(() => $('v_new').click()); await wait(500);
    const f0 = await F.evaluate(() => ({ label: document.querySelector('label[for="v_name"]').textContent, owner: !$('v_owner_f').hidden, note: $('v_docs_note').hidden ? '' : $('v_docs_note').textContent, add: document.querySelectorAll('#v_docs [data-vda]').length }));
    await F.evaluate(n => { $('v_name').value = n; $('v_save').click(); }, V1);
    for (let i = 0; i < 30 && sql('rcl', "select count(*) from vendors where vendor_name = '" + V1 + "'") !== '1'; i++) await wait(400);
    ok('1. before step 1zj: "Company Name *"; no Owner Name box, the documents say what to run (no Add); a vendor saved as before',
      f0.label === 'Company Name *' && !f0.owner && /sql\/supabase_step1zj_vendor_papers\.sql/.test(f0.note) && f0.add === 0 && sql('rcl', "select count(*) from vendors where vendor_name = '" + V1 + "'") === '1', f0);
    // ---- 2. step 1zj ----
    let r1 = ''; try { sqlFile('rcl', path.join(__dirname, '..', '..', 'sql', 'supabase_step1zj_vendor_papers.sql')); r1 = sqlFile('rcl', path.join(__dirname, '..', '..', 'sql', 'supabase_step1zj_vendor_papers.sql')); } catch (e) { r1 = 'FAULT ' + e.message; }
    ok('2. step 1zj runs twice without a fault (it only adds two columns)', /Step 1zj done · vendors \d+ · vendors\.owner_name 1 · vendors\.documents 1/.test(r1), r1);
    sql('rcl', "delete from web.cache where key like 'SB%'"); await wait(1500);
    for (const pt of ['3000', '3001']) { try { await fetch('http://127.0.0.1:' + pt + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: 'whoami' }), signal: AbortSignal.timeout(5000) }); } catch (e) {} }
    // the files: a PDF (the PAN) and a JPEG photo (the Aadhaar)
    const PL = require(path.join(__dirname, '..', '..', 'app', 'vendor', 'pdf-lib-1.17.1.min.js')), pd = await PL.PDFDocument.create();
    pd.addPage([595, 842]).drawText('PAN CARD – TEST EARTHMOVERS 184', { x: 40, y: 780, size: 16, font: await pd.embedFont(PL.StandardFonts.Helvetica) });
    const panFile = path.join(dir, 'pan card.pdf'); fs.writeFileSync(panFile, Buffer.from(await pd.save()));
    const jpg = await F.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 260; const g = c.getContext('2d'); g.fillStyle = '#e8f0fe'; g.fillRect(0, 0, 400, 260); g.fillStyle = '#000'; g.font = '24px sans-serif'; g.fillText('AADHAAR – TEST 184', 30, 130); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; });
    const aadFile = path.join(dir, 'aadhaar.jpg'); fs.writeFileSync(aadFile, Buffer.from(jpg, 'base64'));
    F = await open();
    await F.evaluate(() => showTab('vendors')); await wait(2500); await tidy();
    await F.evaluate(() => $('v_new').click()); await wait(500);
    await F.evaluate((n) => { $('v_name').value = n; $('v_owner').value = 'Ramesh Patil'; }, V2);
    const f1 = await F.evaluate(() => ({ owner: !$('v_owner_f').hidden, note: $('v_docs_note').hidden, kinds: [...document.querySelectorAll('#v_docs .v-doc b')].map(x => x.textContent), add: document.querySelectorAll('#v_docs [data-vda]').length }));
    ok('   after it: the Owner Name box; the documents – Aadhaar, PAN, GST certificate, Udyam, Bank details (cheque / passbook), Other – each its Add',
      f1.owner && f1.note && JSON.stringify(f1.kinds) === JSON.stringify(['Aadhaar', 'PAN', 'GST certificate', 'Udyam', 'Bank details (cheque / passbook)', 'Other']) && f1.add === 6, f1);
    const addDoc = async (kind, file) => {
      await F.evaluate(k => document.querySelector('#v_docs [data-vda="' + k + '"]').click(), kind);
      for (let i = 0; i < 20 && !(await F.evaluate(() => !!document.getElementById('at_back'))); i++) await wait(300);
      const inp = await F.$('#at_file'); await inp.uploadFile(file);
      for (let i = 0; i < 40 && !(await F.evaluate(() => document.querySelectorAll('#at_tiles .at-tile.st-new').length > 0)); i++) await wait(300);
      await F.evaluate(() => document.querySelector('#at_back [data-at="ok"]').click());
      for (let i = 0; i < 60 && await F.evaluate(() => !!document.getElementById('at_back')); i++) await wait(400);
    };
    await addDoc('PAN', panFile); await addDoc('Aadhaar', aadFile);
    const f2 = await F.evaluate(() => [...document.querySelectorAll('#v_docs .v-doc')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    await F.evaluate(() => $('v_docs_box').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt184_form.png') });
    await F.evaluate(() => $('v_save').click());
    for (let i = 0; i < 30 && sql('rcl', "select count(*) from vendors where vendor_name = '" + V2 + "'") !== '1'; i++) await wait(400);
    const row = sql('rcl', "select coalesce(owner_name, '') || ' | ' || coalesce(documents, '') from vendors where vendor_name = '" + V2 + "'");
    ok('   its PAN (a PDF) and Aadhaar (a photo) added in the attachments\' box; Save vendor – the Owner Name and both documents saved with it (each its kind)',
      /^Aadhaar ?1 file\(s\)/.test(f2[0]) && /^PAN ?1 file\(s\)/.test(f2[1]) && /^Ramesh Patil \| \[/.test(row) && /"kind":"PAN"/.test(row) && /"kind":"Aadhaar"/.test(row) && /"name":"pan card\.pdf"/.test(row) && /"mime":"image\/jpeg"/.test(row), [f2, row]);
    // the list: 📎 2 – the window: each to open, print, download
    await wait(2500); await tidy();
    const li = await F.evaluate(n => { const tr = [...document.querySelectorAll('#v_rows tr')].find(t => t.cells[0] && t.cells[0].textContent === n); return tr ? { cell: tr.cells[8].textContent.trim(), head: document.querySelector('#sec-vendors thead tr').cells[8].textContent } : null; }, V2);
    await F.evaluate(n => document.querySelector('[data-vdocs="' + n + '"]').click(), V2);
    for (let i = 0; i < 20 && await F.evaluate(() => $('cf_back').hidden); i++) await wait(300);
    await wait(800);
    const vw = await F.evaluate(() => ({ title: $('cf_title').textContent, owner: (document.querySelector('#cf_msg p') || {}).textContent, groups: [...document.querySelectorAll('#cf_msg h3')].map(h => h.textContent),
      acts: [...document.querySelectorAll('#cf_msg .vdv-act')].map(a => [...a.children].map(x => x.textContent).join('/')), dl: [...document.querySelectorAll('#cf_msg .vdv-act a')].filter(a => a.textContent === 'Download').map(a => /download=/.test(a.href)),
      inside: [...document.querySelectorAll('#cf_msg .vdv-grid figure')].map(f => { const a = f.querySelector('.vdv-act'); return !!a && a.getBoundingClientRect().bottom <= f.getBoundingClientRect().bottom + 1; }) }));
    await mp.screenshot({ path: path.join(SHOT, 'mnt184_docs.png') });
    const got = await F.evaluate(async () => { const a = [...document.querySelectorAll('#cf_msg .vdv-act a')].find(x => x.textContent === 'Open'); if (!a) return null; const r = await fetch(a.href); return { status: r.status, type: r.headers.get('content-type') }; });
    ok('   the list: "Documents" 📎 2; its window: the Owner, PAN and Aadhaar, each Open / Print / Download inside its box (the download link asks the file as a download); its link opens the file',
      li && li.head === 'Documents' && li.cell === '📎 2' && vw.title === 'Documents – ' + V2 && /Ramesh Patil/.test(vw.owner) && JSON.stringify(vw.groups) === JSON.stringify(['Aadhaar', 'PAN']) && vw.acts.every(a => a === 'Open/Print/Download') && vw.dl.length === 2 && vw.dl.every(Boolean) && vw.inside.length === 2 && vw.inside.every(Boolean) && got && got.status === 200,
      [li, vw, got]);
    await tidy();
    // ---- 3. the Asset Master: the papers only for Own; Vehicle Compliance only Own ----
    for (const [no, own] of [[OWN, 'Own'], [RENT, 'Rental']]) { const m = await J('saveMaster', { no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: own === 'Own' ? 'Rachana Construction Limited' : V2, ownership: own, supply: 'Company', status: 'Active', activeFrom: d1, docs: { insurance: '2027-03-31' } }, 'add'); if (m.ERROR) out.push('master ' + no + ': ' + m.ERROR); }
    F = await open();
    await F.evaluate(() => showTab('master')); await wait(2500); await tidy();
    const pb = await F.evaluate(() => { const r = {}; for (const o of ['Own', 'Rental', 'Hired', 'Debit', 'Other']) { $('m_ownership').value = o; $('m_ownership').dispatchEvent(new Event('change')); r[o] = !$('m_docs_box').hidden; } return r; });
    ok('3. the Asset Master: the papers box only for Own (Rental, Hired, Debit, Other: not shown)', JSON.stringify(pb) === JSON.stringify({ Own: true, Rental: false, Hired: false, Debit: false, Other: false }), pb);
    await F.evaluate(() => showTab('comp')); await wait(3000); await tidy();
    const cp = await F.evaluate(() => ({ rows: (S.cp && S.cp.d ? S.cp.d.machines : []).map(m => m.no + ':' + m.ownership), own: $('cp_own').hidden && $('cp_own').options.length === 1 }));
    ok('   Vehicle Compliance: only Own machinery (' + OWN + ' – not ' + RENT + '); no ownership choice any more', cp.rows.indexOf(OWN + ':Own') > -1 && !cp.rows.some(x => x.indexOf(RENT) === 0) && cp.rows.every(x => /:Own$/.test(x)) && cp.own, cp);
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    try {      // the test's own data out again (rig only); the two columns stay (the rig's snapshot is restored before the next run)
      sql('rcl', "delete from vendors where vendor_name in ('" + V1 + "', '" + V2 + "'); delete from master where id in ('" + OWN + "', '" + RENT + "'); delete from web.cache where key like 'SB%'");
      out.push('cleanup: done');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
