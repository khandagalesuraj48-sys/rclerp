// update-153 – attachments of a Log Book entry (photos / PDF): Ctrl + V, drop, upload, camera, Scan with Mobile (a QR code: the
// phone sends, the computer shows), photo correction, one file for two shifts (kept once), at most the site's number, the locks of
// update-152 for approved / billed entries, the files of a submitted bill as submitted (its evidence, annex, ZIP).
// Real page + real database (local rig, PORTAL=1, steps 1zc, 1zd and 1ze applied to the rig databases). Test data only ("AT153"
// vendor, machinery, entries, users, a bill), taken out at the end; the test files are left in the rig's file store (a store keeps
// a file once and never deletes it – as the live one).
//   A. the server: real file types only, the same file kept once, at most the site's number, two people at one entry
//   B. the entry page: Ctrl + V of a copied photo in a row → its box → Done → 📎 1 → Save – the entry keeps it
//   C. drop a photo and a PDF on the Night row, + the Day row's photo ("From another entry") → one entry, 3 files; the shared photo
//      is ONE file in the store
//   D. upload through "Upload files", the camera (the computer's – a stand-in camera), the correction of a photo (turn, suggested
//      cut – used only on "Use this"), the network failing while sending (the tile says so; Done again sends it)
//   E. Scan with Mobile: the laptop's edit window → QR code → the phone (another browser, the same person) opens it, signs in, takes
//      a photo, sends it → the laptop shows it → Save changes → kept; the QR code: another person, a wrong token, closed, ran out
//   F. approved entry: its files are changed only by the Super Admin, with his reason (database history); billed entry: the same;
//      the bill keeps the files as submitted (getBillAttachments, the print's annex, the ZIP checked by fingerprint)
//   G. no script error
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'); const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!', STORE = '/home/claude/rig/storage/erp-files/';
const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) })).json();
const fault = o => fetch('http://127.0.0.1:3100/__fault', { method: 'POST', body: JSON.stringify(o || {}) }).then(r => r.json()).catch(() => null);
const shaHex = b => crypto.createHash('sha256').update(b).digest('hex');
const dir = path.join(os.tmpdir(), 'att153'); fs.mkdirSync(dir, { recursive: true });
(async () => {
  const cleanup = () => {
    const ids = sql("select coalesce(string_agg(quote_literal(id), ','), '') from bills where vendor_name = 'AT153 Vendor'");
    if (ids) sql('alter table public.bill_log_rows disable trigger bill_log_rows_fixed; alter table public.bill_snapshots disable trigger bill_snapshots_fixed;' +
      'delete from public.bill_log_rows where bill_id in (' + ids + '); delete from public.bill_snapshots where id in (' + ids + ');' +
      'alter table public.bill_log_rows enable trigger bill_log_rows_fixed; alter table public.bill_snapshots enable trigger bill_snapshots_fixed;');      // (LOCAL RIG ONLY)
    sql("alter table public.log_book_history disable trigger log_book_history_fixed; delete from public.log_book_history where entry_key like 'AT153-%'; alter table public.log_book_history enable trigger log_book_history_fixed;" +      // (LOCAL RIG ONLY)
      "delete from public.bill_machines where bill_id in (select id from bills where vendor_name = 'AT153 Vendor'); delete from bills where vendor_name = 'AT153 Vendor'; delete from log_book where machinery like 'AT153-%'; delete from boq where vendor_name = 'AT153 Vendor';" +
      "delete from master where id like 'AT153-%'; delete from vendors where vendor_name = 'AT153 Vendor'; delete from billed_changes where args like '%AT153-%'; delete from app_users where email in ('mk153@rcl.test', 'ot153@rcl.test');" +
      "delete from app_settings where id = 'FLOW_RULES' and value like '%ot153%'; delete from web.cache where key like 'SB%' or key like 'VB_%' or key like 'CAP_%' or key like 'AT_%' or key in ('USERS_LIST');");
    fault({});
  };
  const errs = { a: [], m: [], p: [], s: [] }; let b = null;
  try {
    cleanup();
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_log_book) select 'mk153', 'mk153@rcl.test', password_hash, 'Maker 153', 'Yes', 'No', 'Edit' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin, perm_log_book) select 'ot153', 'ot153@rcl.test', password_hash, 'Other 153', 'Yes', 'No', 'Edit' from app_users where email = 'sujit@rcl.test'; delete from web.cache where key in ('USERS_LIST');");
    await wait(1500);
    const signIn = async e => { const a = await post(U, { fn: 'login', args: [e, PW] }); return a.result && a.result.token; };
    const su = await signIn('sujit@rcl.test'), mk = await signIn('mk153@rcl.test'), mk2 = await signIn('mk153@rcl.test'), ot = await signIn('ot153@rcl.test');
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const ticketNow = async () => { const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
    const ss = await post(SA, { fn: 'ssoLogin', args: [await ticketNow()] }), sat = ss.result && ss.result.token;
    const call = async (base, tk, fn, a, meta) => { const r = await post(base, { fn: 'api', args: meta ? [tk, fn, a, meta] : [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const A = (fn, ...a) => call(U, su, fn, a), M = (fn, ...a) => call(U, mk, fn, a), M2 = (fn, ...a) => call(U, mk2, fn, a), O = (fn, ...a) => call(U, ot, fn, a), S_ = (fn, ...a) => call(SA, sat, fn, a);
    const SAr = (reason, fn, ...a) => call(SA, sat, fn, a, { reason: reason });
    ok('setup: Admin, maker (two sign-ins: "computer" and "phone"), another person signed in at :3001; the Super Admin through the Portal at :3000', !!(su && mk && mk2 && ot && sat), { su: !!su, mk: !!mk, ot: !!ot, sa: ss.error || !!sat });
    const must = (n, r) => { if (!r || r.ERROR || r.ok === false) out.push('SETUP ' + n + ': ' + JSON.stringify(r).slice(0, 300)); return r; };
    must('vendor', await A('saveVendor', { name: 'AT153 Vendor', gstReg: 'No', pan: 'ABCPA1153K', bank: 'SBI', account: '15315315', ifsc: 'SBIN0000153' }, 'add'));
    for (const no of ['AT153-1', 'AT153-2']) must('master ' + no, await A('saveMaster', { no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'AT153 Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add'));
    must('boq', await A('saveBoq', { vendor: 'AT153 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-AT153', lines: [{ no: 'AT153-2', basis: 'Per KM', rate: 50, diesel: 'Company' }] }, 'add'));
    const att = id => { const v = sql("select coalesce(attachments, '') from log_book where id = '" + id + "'"); try { return v ? JSON.parse(v) : []; } catch (e) { return 'BAD ' + v; } };
    const shas = id => { const a = att(id); return Array.isArray(a) ? a.map(x => x.sha) : a; };
    const stored = () => { try { return execSync('find ' + STORE + 'log -type f 2>/dev/null | wc -l').toString().trim() | 0; } catch (e) { return -1; } };

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'], headless: 'shell', protocolTimeout: 180000 });
    const frameOf = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    const box = f => f.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ') : ''; });
    const okBox = f => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
    const toastOf = f => f.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });
    const signInPage = async (pg, email, base) => { await pg.goto((base || U) + '/', { waitUntil: 'load' }); let f = await frameOf(pg, () => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
      await f.type('#lg_email', email); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(6000); return frameOf(pg, () => typeof S === 'object' && !!S.user); };
    // test pictures, made by a real browser: a "meter photo" (a light paper on a dark table – the suggested cut finds it), a screenshot (PNG)
    const pm = await b.newPage(); await pm.goto('about:blank');
    const pics = await pm.evaluate(() => { const mk = (w, h, fill, txt, paper) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, w, h);
      if (paper) { g.fillStyle = '#F8FAFC'; g.beginPath(); g.moveTo(w * .22, h * .15); g.lineTo(w * .8, h * .2); g.lineTo(w * .76, h * .86); g.lineTo(w * .18, h * .8); g.closePath(); g.fill(); }
      g.fillStyle = paper ? '#0F172A' : '#FFFFFF'; g.font = 'bold 44px Arial'; g.fillText(txt, w * .3, h * .5); return c; };
      return { jpg: mk(1200, 900, '#1E293B', 'METER 1125', true).toDataURL('image/jpeg', 0.9), jpg2: mk(1000, 700, '#7C2D12', 'CHALLAN 7', true).toDataURL('image/jpeg', 0.9), png: mk(800, 500, '#1D4ED8', 'WhatsApp 1', false).toDataURL('image/png'),
        jpg3: mk(900, 900, '#14532D', 'PHONE 3', true).toDataURL('image/jpeg', 0.9), jpg4: mk(640, 480, '#4C1D95', 'NET 4', false).toDataURL('image/jpeg', 0.9) }; });
    await pm.close();
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const bytesOf = u => Buffer.from(u.split(',')[1], 'base64');
    fs.writeFileSync(path.join(dir, 'upload.jpg'), bytesOf(pics.jpg2)); fs.writeFileSync(path.join(dir, 'phone.jpg'), bytesOf(pics.jpg3)); fs.writeFileSync(path.join(dir, 'net.jpg'), bytesOf(pics.jpg4)); fs.writeFileSync(path.join(dir, 'challan.pdf'), PDF);

    // ---------- A. the server ----------
    const st0 = stored();
    const u1 = await M('uploadAttachment', { data: pics.jpg, name: 'meter.jpg' }), u1b = await O('uploadAttachment', { data: pics.jpg, name: 'again.jpg' });
    const fake = await M('uploadAttachment', { data: 'data:image/jpeg;base64,' + Buffer.from('<html><script>alert(1)</script></html>').toString('base64'), name: 'x.jpg' });
    const pdfU = await M('uploadAttachment', { data: 'data:application/pdf;base64,' + PDF.toString('base64'), name: 'challan.pdf' });
    const onDisk = u1 && u1.path ? fs.readFileSync(STORE + u1.path) : Buffer.alloc(0);
    ok('A. a photo kept under its SHA-256 (log/<2>/<sha>.jpg) – exactly the bytes sent; the same photo by another person: the same file (dup), not kept twice', u1 && u1.sha === shaHex(bytesOf(pics.jpg)) && u1.path === 'log/' + u1.sha.slice(0, 2) + '/' + u1.sha + '.jpg' && onDisk.equals(bytesOf(pics.jpg)) && u1b && u1b.dup === true && u1b.path === u1.path, { u1, u1b });
    ok('   a web page sent as a "photo": refused ("not what its name says"); a PDF: kept (.pdf); the store has one file each (a file kept by an earlier run is not kept again)', /^This file is not what its name says \(image\/jpeg\)/.test(fake.ERROR || '') && pdfU && /\.pdf$/.test(pdfU.path || '') && stored() === st0 + (u1.dup ? 0 : 1) + (pdfU.dup ? 0 : 1), { fake, pdfU, n: stored() - st0 });
    const K1 = 'AT153-1|2026-10-01|Day';
    const sv = await M('saveLogRows', { rows: [{ date: '2026-10-01', shift: 'Day', no: 'AT153-1', mode: 'KM', openingKm: 1000, closingKm: 1010, work: 'A', attachments: [{ sha: u1.sha }, { sha: pdfU.sha }] }] });
    const svO = await O('saveLogRows', { rows: [{ date: '2026-10-02', shift: 'Day', no: 'AT153-1', mode: 'KM', closingKm: 1020, work: 'A', attachments: [{ sha: pdfU.sha }, { sha: 'f'.repeat(64) }] }] });
    ok('   saved with an entry: the maker\'s own files (photo + PDF); another person\'s save with a file never sent: refused, nothing saved', sv && sv.ok && JSON.stringify(shas(K1)) === JSON.stringify([u1.sha, pdfU.sha]) && /^A file was not added by you in the last 6 hours/.test(svO.ERROR || '') && sql("select count(*) from log_book where id = 'AT153-1|2026-10-02|Day'") === '0', { sv, svO, a: att(K1) });
    must('rules', await A('saveSiteRules', { backDays: '', attachMax: 3 }));
    const four = await M('linkLogAttachments', { keys: [K1], files: [{ sha: (await M('uploadAttachment', { data: pics.png, name: 'w.png' })).sha }, { sha: (await M('uploadAttachment', { data: pics.jpg2, name: 'c.jpg' })).sha }] });
    ok('   at most the site\'s number (Site rules: 3): a 4th file for the entry is refused – "keeps at most 3 attachments"; nothing changed', /^A Log Book entry keeps at most 3 attachments/.test(four.ERROR || '') && shas(K1).length === 2, { four, n: shas(K1).length });
    must('rules back', await A('saveSiteRules', { backDays: '', attachMax: 10 }));
    const e1 = await M('getLogEntry', K1), e2 = await O('getLogEntry', K1);
    const upA = await M('updateLogRow', K1, { ver: e1.ver, attWas: [u1.sha, pdfU.sha], attachments: [{ sha: u1.sha }] });
    const upB = await O('updateLogRow', K1, { ver: e2.ver, attWas: [u1.sha, pdfU.sha], attachments: [{ sha: u1.sha }, { sha: pdfU.sha }, { sha: (await O('uploadAttachment', { data: pics.jpg2, name: 'o.jpg' })).sha }] });
    ok('   two people at one entry (both opened it with 2 files): the first saves (PDF taken out); the second is refused – "changed by someone else … open it again"', upA && upA.ok !== false && !upA.ERROR && /^The attachments of this entry were changed by someone else after you opened it/.test(upB.ERROR || '') && JSON.stringify(shas(K1)) === JSON.stringify([u1.sha]), { upA, upB, now: shas(K1) });

    // ---------- A2. under a verification rule: the files go with the request; saved with the entry when the checker approves ----------
    must('flow on', await S_('saveFlowRules', { tasks: { 'Log Book': { on: true, levels: [['ot153@rcl.test']] } } }));
    const vfPic = await M('uploadAttachment', { data: pics.jpg4, name: 'vf.jpg' });
    const vfS = await M('saveLogRows', { rows: [{ date: '2026-10-03', shift: 'Day', no: 'AT153-1', mode: 'KM', closingKm: 1030, work: 'A', attachments: [{ sha: vfPic.sha }, { sha: pdfU.sha }] }] });
    const vfId = ((vfS.ERROR || '').match(/VF-\d+/) || [''])[0];
    const kVf = 'AT153-1|2026-10-03|Day', vfBefore = sql("select count(*) from log_book where id = '" + kVf + "'");
    const vfD = vfId ? await O('decideChangeRequest', { id: vfId, approve: true }) : null;
    must('flow off', await S_('saveFlowRules', { tasks: {} }));
    ok('A2. under a verification rule: sent (' + vfId + ') – nothing saved yet; the checker approves – the entry is saved WITH its 2 files (the sender\'s, as noted with the request), approved', !!vfId && vfBefore === '0' && vfD && vfD.status === 'Approved' && JSON.stringify(shas(kVf)) === JSON.stringify([vfPic.sha, pdfU.sha]) && sql("select approval_ref from log_book where id = '" + kVf + "'") === vfId, { vfS, vfD: vfD && (vfD.status || vfD.ERROR), now: shas(kVf) });

    // ---------- B. the entry page: Ctrl + V ----------
    const pa = await b.newPage(); await pa.setViewport({ width: 1440, height: 900 }); pa.on('pageerror', e => errs.m.push(String(e.message).slice(0, 200)));
    const F = await signInPage(pa, 'mk153@rcl.test');
    const quiet = () => F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const c = document.getElementById('ai_close'); if (c && c.offsetParent !== null) c.click(); S.formDirty = false; });
    await quiet(); await F.evaluate(() => showTab('log')); await wait(2000);
    // (the entry page's own way of filling rows – as test/browser/rows146.js)
    const start = async date => { await F.evaluate(async d => { S.formDirty = false; setLgMode('date'); const dt = document.getElementById('lg_top_date'); dt.value = d; dt.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); clearLogGrid(); }, date); await wait(500); };
    const setRow = async (i, no, shift) => { await F.evaluate((i, no, shift) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; const sh = tr.querySelector('[data-f=shift]'); sh.value = shift; const x = tr.querySelector('[data-f=no]'); x.value = no; x.dispatchEvent(new Event('change', { bubbles: true })); }, i, no, shift);
      for (let k = 0; k < 30; k++) { await wait(400); if (await F.evaluate((i, no) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; return !!(tr && tr._p && tr._p.machine.id === no); }, i, no)) break; } await F.evaluate(() => lgCalcAll()); await wait(200); };
    const addRow = async () => { await F.evaluate(() => document.getElementById('l_add1').click()); await wait(400); };
    const setF = async (i, k, v) => { await F.evaluate((i, k, v) => { const el = document.querySelectorAll('#lg_in .lrow')[i].querySelector('[data-f=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); lgCalcAll(); }, i, k, v); await wait(200); };
    const saveRows = async n0 => { await F.evaluate(() => document.getElementById('l_save').click()); for (let i = 0; i < 40; i++) { await wait(500); await okBox(F); if (Number(sql("select count(*) from log_book where machinery = 'AT153-2'")) >= n0) break; } await wait(1500); };
    await start('2026-09-01'); await setRow(0, 'AT153-2', 'Day'); await setF(0, 'openingKm', '5000'); await setF(0, 'closingKm', '5040'); await setF(0, 'work', 'Carting');
    const paste = (sel, dataUrl, name, type) => F.evaluate(async (sel, u, name, type) => { const blob = await (await fetch(u)).blob(); const f = new File([blob], name, { type: type }); const dt = new DataTransfer(); dt.items.add(f);
      const el = typeof sel === 'string' ? document.querySelector(sel) : lgf(lgRows()[sel], 'work'); el.focus(); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, sel, dataUrl, name, type);
    const tiles = () => F.evaluate(() => [...document.querySelectorAll('#at_tiles .at-tile')].map(t => t.className.replace('at-tile ', '') + ':' + (t.querySelector('small') || {}).textContent));
    const waitTiles = async (n, st) => { let t = []; for (let i = 0; i < 40; i++) { t = await tiles(); if (t.length >= n && t.every(x => !st || x.indexOf(st) === 0)) break; await wait(300); } return t; };
    const done = async () => { await F.evaluate(() => { const b = document.querySelector('#at_back [data-at="ok"]'); if (b) b.click(); }); for (let i = 0; i < 60; i++) { if (await F.evaluate(() => !document.getElementById('at_back'))) return true; await wait(400); } return false; };
    await paste(0, pics.png, 'image.png', 'image/png');
    const tb = await waitTiles(1, 'st-new');
    ok('B. Ctrl + V of a copied photo (a PNG from WhatsApp Web) in a row: its box opens with the photo, made ready here (not sent yet)', tb.length === 1 && /^st-new:image\.png · \d+ KB$/.test(tb[0]), tb);
    const closed = await done(), badge = await F.evaluate(() => { const b = lgRows()[0].querySelector('.att-btn'); return b.className + '|' + b.textContent; });
    ok('   Done: sent (the store keeps it), the box closes, the row\'s 📎 shows 1', closed && badge === 'att-btn on|📎1', { closed, badge });
    const k2d = 'AT153-2|2026-09-01|Day';

    // ---------- C. drop a photo and a PDF on the Night row, + "From another entry" ----------
    await addRow(); await setRow(1, 'AT153-2', 'Night'); await setF(1, 'closingKm', '5070'); await setF(1, 'work', 'Carting');
    await F.evaluate(async (u1, u2) => { const mk = async (u, n, t) => new File([await (await fetch(u)).blob()], n, { type: t }); const dt = new DataTransfer(); dt.items.add(await mk(u1, 'challan.jpg', 'image/jpeg')); dt.items.add(await mk(u2, 'challan.pdf', 'application/pdf'));
      const tr = lgRows()[1]; tr.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); lgf(tr, 'work').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, pics.jpg2, 'data:application/pdf;base64,' + PDF.toString('base64'));
    const tc = await waitTiles(2, 'st-new');
    await F.evaluate(() => document.querySelector('#at_back [data-at="other"]').click()); await wait(1500);
    const offer = await F.evaluate(() => [...document.querySelectorAll('#at_other .at-og')].map(g => g.querySelector('b').textContent + ' ' + g.querySelectorAll('[data-at=take]').length));
    await F.evaluate(() => { const t = document.querySelector('#at_other [data-at=take]'); if (t) t.click(); }); await wait(500);
    const tc2 = await tiles();
    ok('C. a photo and a PDF dropped on the Night row: its box with both; "From another entry" offers row 1\'s photo; added – 3 files', tc.length === 2 && /PDF|challan\.pdf/.test(tc.join()) && /^Row 1: AT153-2 · 01-09-2026 · Day 1$/.test(offer[0] || '') && tc2.length === 3, { tc, offer, tc2 });
    const before = stored(); await done();
    await saveRows(2);
    const kn = 'AT153-2|2026-09-01|Night', dS = shas(k2d), nS = shas(kn);
    ok('   Save: Day keeps its photo; Night keeps 3 (photo, PDF and the SAME file as Day – one photo for two shifts)', Array.isArray(dS) && dS.length === 1 && Array.isArray(nS) && nS.length === 3 && nS.indexOf(dS[0]) > -1 && /^image\/jpeg,image\/jpeg,application\/pdf$|application\/pdf/.test(att(kn).map(x => x.mime).join(',')), { dS, nS, toast: await toastOf(F) });
    ok('   the shared photo is ONE file in the store (2 new files for 3 + 1 attachments: the PDF was sent before, the shared photo once)', stored() - before <= 1 && fs.existsSync(STORE + att(k2d)[0].p), { added: stored() - before });
    const listChip = await F.evaluate(async () => { document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-01'; const n = document.getElementById('lf_no'); n.value = 'AT153-2'; await loadLog(); return [...document.querySelectorAll('#l_rows [data-latt]')].map(x => x.textContent.trim()); });
    await F.evaluate(() => document.querySelector('#l_rows [data-latt]').click()); let vw = ''; for (let i = 0; i < 20; i++) { await wait(400); vw = await F.evaluate(() => { const v = document.getElementById('at_view'); return v ? document.getElementById('at_vname').textContent + '|' + !!v.querySelector('img,iframe') : ''; }); if (vw) break; }
    const imgOk = await F.evaluate(async () => { const im = document.querySelector('#at_view img'); if (!im) return 'no img'; for (let i = 0; i < 20 && !im.complete; i++) await new Promise(r => setTimeout(r, 200)); const v = document.getElementById('at_view'); const r = im.naturalWidth > 0; v.querySelector('[data-v=x]').click(); return r; });
    ok('   the Log Book list: "📎 1" and "📎 3"; a click shows the file (the image loads from its 15-minute link)', JSON.stringify(listChip.sort()) === JSON.stringify(['📎 1', '📎 3']) && /^1 \/ \d · /.test(vw) && imgOk === true, { listChip, vw, imgOk });

    // ---------- D. upload files, camera, the correction of a photo, the network failing ----------
    await quiet(); await F.evaluate(() => showTab('log')); await wait(800);
    await start('2026-09-02'); await setRow(0, 'AT153-2', 'Day'); await setF(0, 'closingKm', '5110'); await setF(0, 'work', 'Carting');
    await F.evaluate(() => lgRows()[0].querySelector('.att-btn').click()); await wait(800);
    const inp = await F.$('#at_file'); await inp.uploadFile(path.join(dir, 'upload.jpg'), path.join(dir, 'challan.pdf'));
    const td1 = await waitTiles(2, 'st-new');
    await F.evaluate(() => document.querySelector('#at_back [data-at="cam"]').click());
    let cam = false; for (let i = 0; i < 30; i++) { await wait(400); cam = await F.evaluate(() => { const v = document.querySelector('#at_camv video'); return !!v && v.videoWidth > 0; }); if (cam) break; }
    await F.evaluate(() => { const b = document.querySelector('#at_camv [data-c="yes"]'); if (b) b.click(); });
    const td2 = await waitTiles(3, 'st-new');
    ok('D. "Upload files" (a photo and a PDF) and "Camera" (the computer\'s camera – a live picture, Take photo): 3 tiles, ready to send', td1.length === 2 && cam && td2.length === 3 && /camera-\d+\.jpg/.test(td2[2]), { td1, cam, td2 });
    // the correction: ✎ on the uploaded photo → turn right, suggested cut → Use this
    await F.evaluate(() => document.querySelector('#at_tiles .at-tile[data-i="0"] [data-at="fix"]').click()); await wait(1500);
    const edOpen = await F.evaluate(() => !!document.getElementById('at_ed'));
    await F.evaluate(() => document.querySelector('#at_ed [data-e="r"]').click()); await wait(600);
    await F.evaluate(() => document.querySelector('#at_ed [data-e="auto"]').click()); await wait(600);
    const sug = await F.evaluate(() => document.getElementById('at_emsg').textContent);
    await F.evaluate(() => document.querySelector('#at_ed [data-e="yes"]').click());
    const td3 = await waitTiles(3, 'st-new');
    ok('   ✎ Correct the photo: turned right, "Suggest cut" finds the paper (shown – used only on "Use this"); the tile is made again', edOpen && /^Suggested cut shown/.test(sug) && td3.length === 3, { edOpen, sug, td3 });
    // the network fails while sending: the tile says so; Done again sends it
    await pa.setOfflineMode(true);
    await F.evaluate(() => document.querySelector('#at_back [data-at="ok"]').click());
    let tErr = []; for (let i = 0; i < 60; i++) { await wait(500); tErr = await tiles(); if (tErr.some(t => /^st-err/.test(t)) && !tErr.some(t => /^st-send/.test(t))) break; }
    const msgErr = await F.evaluate(() => (document.getElementById('at_msg') || {}).textContent || '');
    await pa.setOfflineMode(false); await wait(1000);
    const okNow = await done();
    ok('   the network fails while sending: the tiles show "!" and the box says "not sent – press Done to try again"; online again, Done sends them', tErr.some(t => /^st-err/.test(t)) && /not sent \(marked !\) – press Done to try again/.test(msgErr) && okNow, { tErr, msgErr, okNow });
    await saveRows(3);
    const k3 = 'AT153-2|2026-09-02|Day', a3 = att(k3);
    const dims = (() => { try { const bt = fs.readFileSync(STORE + a3[0].p); for (let i = 2; i < bt.length - 9; i++) if (bt[i] === 0xFF && (bt[i + 1] === 0xC0 || bt[i + 1] === 0xC2)) return [bt.readUInt16BE(i + 7), bt.readUInt16BE(i + 5)]; } catch (e) { return String(e.message); } return null; })();
    ok('   saved: 3 files; the corrected photo is upright-turned and cut (taller than wide now – the original was 1000 × 700), JPEG', Array.isArray(a3) && a3.length === 3 && Array.isArray(dims) && dims[1] > dims[0] && a3[0].mime === 'image/jpeg', { a3: Array.isArray(a3) ? a3.map(x => x.mime + ' ' + x.size) : a3, dims });

    // ---------- E. Scan with Mobile ----------
    const kE = 'AT153-2|2026-09-02|Day';
    await quiet(); await F.evaluate(async () => { document.getElementById('lf_from').value = '2026-09-02'; document.getElementById('lf_to').value = '2026-09-02'; await loadLog(); });
    await F.evaluate(k => openLogEdit(k), kE); for (let i = 0; i < 20 && !(await F.evaluate(() => !document.getElementById('le_back').hidden)); i++) await wait(300);
    const capRes = new Promise(res => { const h = async r => { try { if (!/\/api\/rpc$/.test(r.url())) return; const q = r.request().postData() || ''; if (q.indexOf('"capStart"') < 0) return; const j = await r.json(); pa.off('response', h); res(j.result); } catch (e) {} }; pa.on('response', h); });
    await F.evaluate(() => document.getElementById('le_att_btn').click()); for (let i = 0; i < 20 && !(await F.evaluate(() => !!document.getElementById('at_back'))); i++) await wait(300);
    await F.evaluate(() => document.querySelector('#at_back [data-at="qr"]').click());
    const cap = await Promise.race([capRes, wait(15000).then(() => null)]);
    const qrShown = await F.evaluate(() => !!document.querySelector('#at_qr svg') && document.getElementById('at_qr_st').textContent);
    ok('E. Scan with Mobile (the edit window): a QR code for 5 minutes – a random id and a 256-bit token; the server keeps only the token\'s fingerprint', cap && /^[0-9a-f]{32}\.[0-9a-f]{64}$/.test(cap.code) && /^Waiting for the phone/.test(qrShown || '') && sql("select count(*) from web.cache where key = 'CAP_" + cap.id + "' and value like '%" + cap.token.slice(0, 20) + "%'") === '0' && sql("select count(*) from web.cache where key = 'CAP_" + cap.id + "'") === '1', { cap: cap && cap.code, qrShown });
    // the QR code alone is nothing: another person, a wrong token
    const byOther = await O('capClaim', { code: cap.code, phone: 'p-other-0001' }), badTok = await M2('capClaim', { code: cap.id + '.' + 'a'.repeat(64), phone: 'p-phone-0001' });
    ok('   another person scanning it: refused ("made by another person"); a wrong token: refused ("not valid")', /^This QR code was made by another person/.test(byOther.ERROR || '') && /^This QR code is not valid/.test(badTok.ERROR || ''), { byOther, badTok });
    // the phone: another browser (a phone's size), the same person; it opens the QR's link, signs in, takes a photo, sends it
    const pp = await b.newPage(); await pp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); pp.on('pageerror', e => errs.p.push(String(e.message).slice(0, 200)));
    await pp.goto(U + '/?cap=' + cap.code, { waitUntil: 'load' });
    let Fp = await frameOf(pp, () => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await Fp.type('#lg_email', 'mk153@rcl.test'); await Fp.type('#lg_pass', PW); await Fp.click('#lg_btn');
    Fp = await frameOf(pp, () => !!document.getElementById('cap_sheet'));
    const sheet = Fp ? await Fp.evaluate(() => document.querySelector('#cap_sheet h3').textContent) : '';
    const claimedSt = await (async () => { for (let i = 0; i < 20; i++) { await wait(500); const t = await F.evaluate(() => (document.getElementById('at_qr_st') || {}).textContent || ''); if (/Phone connected/.test(t)) return t; } return await F.evaluate(() => (document.getElementById('at_qr_st') || {}).textContent || ''); })();
    ok('   the phone opens the link → signs in (the QR code is kept through the sign-in) → "Scan with Mobile" for that entry; the laptop: "📱 Phone connected"', /^AT153-2 · 02-09-2026 · Day$/.test(sheet) && /^📱 Phone connected/.test(claimedSt), { sheet, claimedSt });
    const second = await call(U, ot, 'capClaim', [{ code: cap.code, phone: 'p-second-001' }]);
    const phoneTwo = await M('capClaim', { code: cap.code, phone: 'p-second-001' });
    ok('   single use: a second phone of the same person is refused ("already being used by another phone")', /^This QR code is already being used by another phone/.test(phoneTwo.ERROR || ''), { phoneTwo, second });
    const pin = await Fp.$('#cap_file'); await pin.uploadFile(path.join(dir, 'phone.jpg'));
    for (let i = 0; i < 30; i++) { await wait(300); if (await Fp.evaluate(() => [...document.querySelectorAll('#cap_tiles .at-tile')].some(t => /st-new/.test(t.className)))) break; }
    await Fp.evaluate(() => document.querySelector('#cap_sheet [data-c="send"]').click());
    let ph = ''; for (let i = 0; i < 30; i++) { await wait(500); ph = await Fp.evaluate(() => document.getElementById('cap_msg').textContent); if (/sent ✓/.test(ph)) break; }
    let lap = []; for (let i = 0; i < 30; i++) { await wait(500); lap = await tiles(); if (lap.length >= 4) break; }
    ok('   the phone: "1 sent ✓ – they show on the computer"; the laptop shows the phone\'s photo while the box is open (asked every 3 s)', /^1 sent ✓/.test(ph) && lap.length === 4 && /^st-ok/.test(lap[3]), { ph, lap });
    ok('   nothing is linked by the phone: the entry still has 3 files until the laptop saves', shas(kE).length === 3);
    await done();
    await F.evaluate(() => document.getElementById('le_save').click());
    for (let i = 0; i < 30; i++) { await wait(500); await okBox(F); if (shas(kE).length === 4) break; }
    ok('   Done → Save changes ("Attachments 3 files → 4 files (+1)"): the entry keeps the phone\'s photo', shas(kE).length === 4, shas(kE));
    const closedNow = await M2('capAdd', { code: cap.code, phone: 'x', sha: shas(kE)[3] });
    ok('   after Done the QR code is closed: the phone cannot add to it ("Scan the QR code again" / "closed")', /closed on the computer|does not hold it|not valid/.test(closedNow.ERROR || ''), closedNow);
    // ran out / cancelled / a new QR ends the old one
    const c2 = await M('capStart', { key: kE, label: 'x' }), c3 = await M('capStart', { key: kE, label: 'x', prev: c2.id });
    const oldGone = await M2('capClaim', { code: c2.code, phone: 'p-phone-0002' });
    sql("update web.cache set value = jsonb_set(value::jsonb, '{claimBy}', to_jsonb((now() - interval '1 minute')::text))::text where key = 'CAP_" + c3.id + "'");
    const ranOut = await M2('capClaim', { code: c3.code, phone: 'p-phone-0003' }), pollOut = await M('capPoll', { id: c3.id });
    const c4 = await M('capStart', { key: kE, label: 'x' }); await M('capCancel', { id: c4.id }); const cancelled = await M2('capClaim', { code: c4.code, phone: 'p-phone-0004' });
    ok('   a new QR code ends the one before; not scanned in 5 minutes: "ran out (5 minutes)" (the laptop is told "expired"); cancelled: "closed on the computer"', /^This QR code was closed on the computer/.test(oldGone.ERROR || '') && /^This QR code ran out \(5 minutes\)/.test(ranOut.ERROR || '') && pollOut && pollOut.state === 'expired' && /^This QR code was closed on the computer/.test(cancelled.ERROR || ''), { oldGone, ranOut, pollOut, cancelled });
    // the phone page with a code that is not valid: a box says so
    const pp2 = await b.newPage(); await pp2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); pp2.on('pageerror', e => errs.p.push(String(e.message).slice(0, 200)));
    await pp2.goto(U + '/?cap=' + c4.id + '.' + 'b'.repeat(64), { waitUntil: 'load' });
    let Fp2 = await frameOf(pp2, () => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await Fp2.type('#lg_email', 'mk153@rcl.test'); await Fp2.type('#lg_pass', PW); await Fp2.click('#lg_btn'); await wait(7000);
    Fp2 = await frameOf(pp2, () => typeof S === 'object' && !!S.user);
    const badBox = await box(Fp2);
    ok('   the phone opens a QR code that is not valid: "Scan with Mobile :: This QR code is not valid (any more)…" – nothing else opens', /^Scan with Mobile :: This QR code is not valid/.test(badBox) && !(await Fp2.evaluate(() => !!document.getElementById('cap_sheet'))), badBox);
    await pp2.close(); await pp.close();

    // ---------- F. approved and billed entries ----------
    sql("update log_book set approved_by = 'Checker 153', approved_at = now(), approval_ref = 'VF-AT153' where id = '" + k2d + "'");      // (LOCAL RIG ONLY: an entry approved in verification)
    await wait(1200);
    const eAp = await M('getLogEntry', k2d);
    const apRef = await M('updateLogRow', k2d, { ver: eAp.ver, attWas: shas(k2d), attachments: [] });
    const apLink = await M('linkLogAttachments', { keys: [k2d], files: [{ sha: shas(kn)[1] }] });
    ok('F. an APPROVED entry: the maker cannot take its file out ("it was approved … without the Super Admin"), nor link another to it; nothing changed', /it was approved/.test(apRef.ERROR || '') && /it was approved/.test(apLink.ERROR || '') && shas(k2d).length === 1, { apRef, apLink });
    const eS = await S_('getLogEntry', k2d);
    const saNo = await S_('updateLogRow', k2d, { ver: eS.ver, attWas: shas(k2d), attachments: [{ sha: shas(k2d)[0] }, { sha: shas(kn)[1] }] });
    const saYes = await SAr('Challan copy added – it was on WhatsApp', 'updateLogRow', k2d, { ver: eS.ver, attWas: shas(k2d), attachments: [{ sha: shas(k2d)[0] }, { sha: shas(kn)[1] }] });
    const h = sql("select allowed || '|' || locked_by || '|' || (ctx->>'super') || '|' || (ctx->>'reason') || '|' || array_to_string(changed, ',') from log_book_history where entry_key = '" + k2d + "' order by seq desc limit 1");
    ok('   the Super Admin: asked for the reason (SA_REASON), then saved with it; the database\'s history: approval, super, the reason, "attachments" changed', /^SA_REASON: /.test(saNo.ERROR || '') && saYes && !saYes.ERROR && shas(k2d).length === 2 && /^true\|approval\|true\|Challan copy added – it was on WhatsApp\|.*attachments/.test(h), { saNo: (saNo.ERROR || '').slice(0, 120), saYes, h });
    // a bill of September for AT153 Vendor (the Admin's page): the entries are billed – the files as they are now go in its evidence
    const co = ((await A('billInit')).companies || ['Rachana Construction Limited'])[0];
    const pb = await b.newPage(); await pb.setViewport({ width: 1440, height: 900 }); pb.on('pageerror', e => errs.a.push(String(e.message).slice(0, 200)));
    const FA = await signInPage(pb, 'sujit@rcl.test');
    const yes = () => FA.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; });
    await FA.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
    await FA.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = x.closest('label, tr, div').textContent.indexOf('AT153 Vendor') > -1; x.dispatchEvent(new Event('change', { bubbles: true })); });
      document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-05'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co);
    for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await FA.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
    await wait(1200); await FA.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const x = tr.querySelector('.mb-no'); if (x && !x.value) { x.value = '153'; x.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(800);
    await FA.evaluate(() => document.getElementById('mb_abstract').click());
    for (let i = 0; i < 50; i++) { await wait(500); await yes(); if (sql("select count(*) from bills where vendor_name = 'AT153 Vendor'") === '1') break; }
    for (const pg of await b.pages()) { if (pg !== pa && pg !== pb) await pg.close().catch(() => {}); }
    const billId = sql("select id from bills where vendor_name = 'AT153 Vendor'");
    const ba = billId ? await A('getBillAttachments', { id: billId }) : null;
    const want = [...new Set([].concat(shas(k2d), shas(kn), shas(k3)))].sort();
    ok('   a bill of September submitted: getBillAttachments – the files AS SUBMITTED (fixed), each once (the shared photo once, with its 2 entries), each with a link', !!billId && ba && ba.fixed === true && JSON.stringify(ba.files.map(f => f.sha).sort()) === JSON.stringify(want) && ba.files.some(f => f.entries.length === 2) && ba.files.every(f => !!f.url), ba && { kind: ba.kind, n: ba.count, want: want.length, multi: ba.files.map(f => f.entries.length) });
    // a billed entry (not approved): the maker cannot change its files; the Super Admin can, with his reason – the bill keeps the files as billed
    const eB = await M('getLogEntry', kn);
    const bRef = await M('updateLogRow', kn, { ver: eB.ver, attWas: shas(kn), attachments: [{ sha: shas(kn)[0] }] });
    ok('   a BILLED entry (Night, not approved): the maker cannot change its files ("in the submitted RA Bill 153 …")', /submitted RA Bill 153/.test(bRef.ERROR || '') && shas(kn).length === 3, bRef);
    const eB2 = await S_('getLogEntry', kn), kept = shas(kn);
    const saB = await SAr('Wrong photo – the PDF stays', 'updateLogRow', kn, { ver: eB2.ver, attWas: kept, attachments: [{ sha: kept[1] }, { sha: kept[2] }] });
    const ba2 = await A('getBillAttachments', { id: billId }), ev = await A('getBillEvidence', { id: billId });
    const evN = ev && (ev.rows || []).find(r => r.key === kn);
    ok('   the Super Admin takes a file out of the billed entry (with his reason): the entry has 2 now – the bill STILL has the 3 as billed, evidence check ✔', saB && !saB.ERROR && shas(kn).length === 2 && JSON.stringify(ba2.files.map(f => f.sha).sort()) === JSON.stringify(want) && ev.check && ev.check.ok === true && evN && (evN.att || []).length === 3, { saB, now: shas(kn).length, ba2: ba2 && ba2.count, check: ev && ev.check, evN: evN && (evN.att || []).length });
    // the saved bill's print: the annex of its files; Saved Bills → 📎 Files: one ZIP, each file checked by fingerprint
    await FA.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bills'); }); await wait(1200);
    await FA.evaluate(() => { document.getElementById('sb_from').value = '2026-09-01'; document.getElementById('sb_to').value = '2026-09-30'; return sbLoad(); }); await wait(1500);
    const pop = new Promise(res => b.once('targetcreated', t => res(t)));
    await FA.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => r.textContent.indexOf('AT153 Vendor') > -1); tr.querySelector('[data-sbv]').click(); });
    const t0 = await Promise.race([pop, wait(20000).then(() => null)]); let annex = null;
    if (t0) { const w = await t0.page(); for (let i = 0; i < 50; i++) { if (await w.evaluate(() => !!document.querySelector('.bill-att')).catch(() => false)) break; await wait(400); }
      annex = await w.evaluate(async () => { const s = document.querySelector('.bill-att'); if (!s) return null; const imgs = [...s.querySelectorAll('img')]; for (let i = 0; i < 25 && imgs.some(im => !im.complete); i++) await new Promise(r => setTimeout(r, 200));
        return { head: s.querySelector('h2').textContent, n: s.querySelectorAll('figure').length, imgs: imgs.filter(im => im.naturalWidth > 0).length, pdf: s.querySelectorAll('.ba-pdf').length, note: s.querySelector('.ev-note').textContent }; }); await w.close(); }
    ok('   View / Print of the bill: after its Log Book, "Attachments of the Log Book – RA Bill 153" – each file once, photos shown, the PDF marked, "as submitted"', annex && /^Attachments of the Log Book – RA Bill 153/.test(annex.head) && annex.n === want.length && annex.imgs === want.length - annex.pdf && annex.pdf >= 1 && /^The files each entry had when the bill was submitted/.test(annex.note), annex);
    const cdp = await b.target().createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    fs.readdirSync(dir).filter(x => /\.zip$/.test(x)).forEach(x => fs.unlinkSync(path.join(dir, x)));
    await FA.evaluate(() => { const tr = [...document.querySelectorAll('#sb_rows tr')].find(r => r.textContent.indexOf('AT153 Vendor') > -1); tr.querySelector('[data-sbz]').click(); });
    let zipF = ''; for (let i = 0; i < 40; i++) { await wait(500); zipF = (fs.readdirSync(dir).find(x => /\.zip$/.test(x)) || ''); if (zipF) break; }
    await wait(1500);
    let zl = ''; try { fs.writeFileSync(path.join(dir, 'zt.py'), "import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1])\nprint(z.testzip())\nprint(len(z.namelist()))\nt=z.read('FINGERPRINTS.txt').decode('utf-8')\nprint(t.count('checked \\u2714'))\nprint(t.count('\\u2717'))\n");
      zl = execSync('timeout 30 python3 -I ' + JSON.stringify(path.join(dir, 'zt.py')) + ' ' + JSON.stringify(path.join(dir, zipF))).toString(); } catch (e) { zl = 'ERR ' + String(e.message).slice(0, 200); }
    const zp = zl.split('\n');
    ok('   Saved Bills → 📎 Files: one ZIP (a good ZIP), every file + FINGERPRINTS.txt – each "checked ✔" against its SHA-256, none ✗', !!zipF && zp[0] === 'None' && zp[1] === String(want.length + 1) && zp[2] === String(want.length) && zp[3] === '0', { zipF, zl: zl.slice(0, 300) });
    const toastZ = await toastOf(FA);
    ok('   …and the page says so ("each matches its fingerprint ✔")', /each matches its fingerprint ✔/.test(toastZ), toastZ);
    // ---------- superseded: the Super Admin revises the bill – the old one keeps its files as billed, the new one its own ----------
    const pS = await b.newPage(); await pS.setViewport({ width: 1440, height: 900 }); pS.on('pageerror', e => errs.s.push(String(e.message).slice(0, 200)));
    await pS.goto(SA + '/#sso=' + await ticketNow(), { waitUntil: 'load' }); await wait(7000);
    const FS = await frameOf(pS, () => typeof S === 'object' && !!S.user && S.user.super === true);
    const yesS = () => FS.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; const r = document.getElementById('sa_reason'); if (r && !r.value) r.value = 'Revised – a photo was wrong'; document.getElementById('cf_ok').click(); return t; } return ''; });
    await FS.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
    await FS.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = x.closest('label, tr, div').textContent.indexOf('AT153 Vendor') > -1; x.dispatchEvent(new Event('change', { bubbles: true })); });
      document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-06'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co);
    for (let i = 0; i < 40; i++) { await wait(500); await yesS(); if (await FS.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
    await wait(1200); await FS.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const x = tr.querySelector('.mb-no'); if (x && !x.value) { x.value = '153'; x.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(800);
    await FS.evaluate(() => document.getElementById('mb_abstract').click());
    for (let i = 0; i < 60; i++) { await wait(500); await yesS(); if (sql("select count(*) from bills where vendor_name = 'AT153 Vendor'") === '2') break; }
    for (const pg of await b.pages()) { if (pg !== pa && pg !== pb && pg !== pS) await pg.close().catch(() => {}); }
    const oldId = sql("select id from bills where vendor_name = 'AT153 Vendor' and status = 'Superseded'"), newId = sql("select id from bills where vendor_name = 'AT153 Vendor' and status = 'Active'");
    const bo = oldId ? await A('getBillAttachments', { id: oldId }) : null, bn = newId ? await A('getBillAttachments', { id: newId }) : null;
    const nightOf = r => r && r.files ? r.files.filter(f => (f.entries || []).some(e => e.key === kn)).map(f => f.sha).sort() : null;
    ok('   superseded: the Super Admin revises the bill – the old one (Superseded) still has the Night\'s 3 files as billed; the new one (rev 1) has its 2 – each bill from its own evidence', !!oldId && !!newId && JSON.stringify(nightOf(bo)) === JSON.stringify([...kept].sort()) && JSON.stringify(nightOf(bn)) === JSON.stringify([...shas(kn)].sort()) && bo.fixed && bn.fixed,
      { oldId, newId, old: nightOf(bo), neu: nightOf(bn), rev: sql("select string_agg(bill_no || ' rev ' || rev || ' ' || status, ', ') from bills where vendor_name = 'AT153 Vendor'") });
    ok('G. no script error on the pages (the maker\'s, the phone\'s, the Admin\'s, the Super Admin\'s)', !errs.m.length && !errs.p.length && !errs.a.length && !errs.s.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 900)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + String(e.message).slice(0, 200)); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
