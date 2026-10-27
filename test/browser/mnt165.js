// update-165 (asked 27-10-2026: "mala pratek gadi sathi mainnantanace log book banwaych aahe … fuel entry auto yetil … mala pdf readder
// haway ok ocr cha pn chalel … je bill yetil … te upload krta yawit entry sobat") – the whole way on the local rig started with
// PORTAL=1 (the Portal :3010 from ../rcl-portal, Mechanical :3000 linked to it). Site T2 (database rcl_s2, steps 1zg, 1zh and 1zi run)
// plays HO, put on fuel cards; S1 (database rcl, steps 1zh / 1zi NOT run) plays VTR – exactly as before. Test data only, on the rig.
//   1. the Portal: T2 on fuel cards; its Pages list has Maintenance; S1's has not
//   2. the server at T2: a PDF and a photo of a bill kept (the attachments' store); the AI reads the PDF (sent as a PDF); a bill with
//      its lines, Service and KM, its files; the checks; the same bill again is asked first; the list and the words typed before;
//      the files' links; a car's log book (its fills by card / Cash and its bills, the costs, the last service)
//   3. the page at T2: the menu has Maintenance; a bill – files added in the attachments' box, "Read the bill (AI)" fills the form
//      (blue), saved; the list; Edit (its files back); the car's log book on the screen and in Excel; the page stays "Live"
//   4. S1: the page and the server as before (no Maintenance)
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node mnt165.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'); const fs = require('fs'), path = require('path'), crypto = require('crypto');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', SHOT = process.env.SHOTS || '/tmp', GEM = 'http://127.0.0.1:3998';
const C1 = 'MNT-1-165', C2 = 'MNT-2-165', CARD = 'HDFC MNT 165';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const say = async j => fetch(GEM + '/__meter?say=' + encodeURIComponent(JSON.stringify(j)));
(async () => {
  const errs = []; let b = null, cookie = '';
  const has = (db, t, c) => sql(db, "select count(*) from information_schema.columns where table_schema = 'public' and table_name = '" + t + "'" + (c ? " and column_name = '" + c + "'" : ''));
  const post = async (base, body) => (await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const preq = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
    const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
  const ticket = async site => { const go = await fetch(P + '/api/go?module=mechanical&site=' + site, { headers: { Cookie: cookie }, redirect: 'manual' }); return (go.headers.get('location') || '').split('#sso=')[1] || ''; };
  const find = async (pg, need) => { for (let i = 0; i < 80; i++) { for (const x of pg.frames()) { try { if (x !== pg.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
  const dir = fs.mkdtempSync(path.join(SHOT, 'mnt165-'));
  const n0 = sql('rcl_s2', 'select (select count(*) from diesel_issue)');
  try {
    ok('start: T2 has no fill; steps 1zg, 1zh and 1zi run in T2, step 1zi not in S1', n0 === '0' && has('rcl_s2', 'maintenance') !== '0' && has('rcl_s2', 'app_users', 'perm_maintenance') === '1' && has('rcl', 'maintenance') === '0',
      [n0, has('rcl_s2', 'maintenance'), has('rcl', 'maintenance')]);
    let lr = null;
    for (const p of ['Super#Admin2040', 'Super#Admin2041']) { lr = await preq('/api/auth', { action: 'login', email: 'sa@rcl.test', password: p }); if (lr.status === 200 && !lr.error) break; }
    // ---- 1. the Portal: T2 on fuel cards; the Pages of each site ----
    const pg0 = await preq('/api/admin', { action: 'placesGet', site: 'T2' });
    const put = await preq('/api/admin', { action: 'placesSave', site: 'T2', places: (pg0.places || []).map(p => ({ name: p.name, cap: p.cap || 1000 })), mode: 'card' });
    ok('1. the Portal: T2 put on fuel cards', put.status === 200 && sql('rcl_s2', "select value from web.props where key = 'FUEL_MODE'") === 'card', put);
    const pagesOf = async site => { const r = await preq('/api/admin', { action: 'mechPages', site: site }); return (r.pages || r.modules || []).map(x => x.key || x); };
    const p2 = await pagesOf('T2'), p1 = await pagesOf('S1');
    ok('   the Portal\'s Users & Access → Pages: T2 lists Maintenance (and Fuel Cards); S1 does not', p2.indexOf('Maintenance') > -1 && p2.indexOf('Fuel Cards') > -1 && p1.indexOf('Maintenance') === -1, [p2, p1]);
    // ---- 2. the server at T2 ----
    const sa = await post(SA, { fn: 'ssoLogin', args: [await ticket('T2')] });
    const J = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [sa.result.token, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const init = await J('getInit'), today = init.today, d1 = today.slice(0, 8) + '01', d2 = today.slice(0, 8) + '02';
    const car = no => ({ no: no, name: 'Car ' + no, type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 14, owner: 'RCL', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: d1, fuel: 'Petrol' });
    const mm = [await J('saveMaster', car(C1), 'add'), await J('saveMaster', car(C2), 'add')];
    ok('   two cars', mm.every(x => x && !x.ERROR), mm);
    const cd = await J('saveCard', { name: CARD, last4: '1165', type: 'Fuel card', cars: [], opening: 10000, openDate: d1 });
    const f1 = await J('saveDieselIssue', { date: d1, shift: 'Day', source: CARD, no: C1, qty: 20, kmReading: 45000, amount: 2100, force: true });
    const f2 = await J('saveDieselIssue', { date: d2, shift: 'Day', source: 'Cash', no: C1, qty: 10, kmReading: 45300, amount: 1050, force: true });
    ok('   a card and two fills of the car (by card, in Cash)', cd.ok && f1.ok && f2.ok, [cd, f1, f2]);
    // files of a bill: a PDF and a photo, kept in the attachments' store under their fingerprint
    const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n% bill 165\n');
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const pm = await b.newPage(); await pm.goto('about:blank');
    const jpg = await pm.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 1200); g.fillStyle = '#111'; g.font = 'bold 40px Arial';
      g.fillText('TOYOTA SERVICE – BILL TS-101', 40, 100); g.fillText('Engine oil 1200', 40, 220); g.fillText('Oil filter 300', 40, 300); g.fillText('Total 1500', 40, 400); return c.toDataURL('image/jpeg', 0.85); });
    await pm.close();
    fs.writeFileSync(path.join(dir, 'bill.pdf'), PDF); fs.writeFileSync(path.join(dir, 'bill.jpg'), Buffer.from(jpg.split(',')[1], 'base64'));
    const up1 = await J('maintFile', { data: 'data:application/pdf;base64,' + PDF.toString('base64'), name: 'bill.pdf' }), up2 = await J('maintFile', { data: jpg, name: 'bill.jpg' });
    ok('   a PDF and a photo of the bill kept under their SHA-256 (log/<2>/<sha>.pdf / .jpg) – the Log Book attachments\' store', up1.sha === crypto.createHash('sha256').update(PDF).digest('hex') && /^log\/[0-9a-f]{2}\/[0-9a-f]{64}\.pdf$/.test(up1.path) && /\.jpg$/.test(up2.path || ''), [up1, up2]);
    const fake = await J('maintFile', { data: 'data:application/pdf;base64,' + Buffer.from('<html>x</html>').toString('base64'), name: 'x.pdf' });
    ok('   a web page sent as a "PDF": refused', /^This file is not what its name says/.test(fake.ERROR || ''), fake);
    // the AI reads the PDF (sent as a PDF – its own type)
    await fetch(GEM + '/__clear');
    await say({ date: d1, billNo: 'TS-101', garage: 'Toyota Service', vehicle: C1.replace(/-/g, ''), km: '45,210', service: true, total: '2,360.00',
      lines: [{ work: 'Engine oil', amount: 1200 }, { work: 'Oil filter', amount: 300 }, { work: 'Labour', amount: 500 }, { work: 'GST 18%', amount: 360 }] });
    const rd = await J('readMaintBill', { data: 'data:application/pdf;base64,' + PDF.toString('base64') });
    const glog = await (await fetch(GEM + '/__log')).json(), gl = glog.filter(x => x.image).pop() || {};
    ok('   the AI reads the bill: sent as a PDF (application/pdf), asked for JSON; its answer → date, bill no., garage, KM, the 4 lines, the total, Service', gl.image === 'application/pdf' && gl.json === 'application/json' && /garage, service centre or parts shop/.test(gl.ask || '') &&
      rd.date === d1 && rd.billNo === 'TS-101' && rd.garage === 'Toyota Service' && rd.km === 45210 && rd.lines.length === 4 && rd.total === 2360 && rd.service === true && rd.check === '', [gl, rd]);
    // a bill with its files
    const bill = x => Object.assign({ date: d1, no: C1, garage: 'Toyota Service', billNo: 'TS-101', km: 45210, service: true, remark: 'first service',
      lines: rd.lines, files: [{ sha: up1.sha }, { sha: up2.sha }] }, x);
    const s1 = await J('saveMaint', bill({}));
    const row = sql('rcl_s2', "select machinery || '|' || amount || '|' || service || '|' || km_reading || '|' || garage || '|' || bill_no from maintenance where id = 'MT-000001'");
    const files = JSON.parse(sql('rcl_s2', "select files from maintenance where id = 'MT-000001'") || '[]');
    ok('   a bill saved: MT-000001 – the car, ₹2360 (its lines), Service with its KM, the garage and bill no.; its 2 files kept with it', s1.ok && s1.id === 'MT-000001' && row === C1 + '|2360|Yes|45210|Toyota Service|TS-101' && same(files.map(f => f.sha), [up1.sha, up2.sha]), [s1, row, files]);
    ok('   its lines kept as typed', same(JSON.parse(sql('rcl_s2', "select lines from maintenance where id = 'MT-000001'")), rd.lines));
    const again = await J('saveMaint', bill({}));
    ok('   the same bill number of the same garage for the car again: asked first ("already saved (MT-000001)")', again.ok === false && /is already saved \(MT-000001\)\. Save it again\?$/.test(again.warning || ''), again);
    const noKm = await J('saveMaint', bill({ billNo: 'TS-102', km: '' })), noLine = await J('saveMaint', bill({ billNo: 'TS-103', lines: [{ work: 'Wiper', amount: '' }] }));
    const other = await J('saveMaint', bill({ billNo: 'TS-104', files: [{ sha: 'b'.repeat(64) }] }));
    ok('   the checks: a service without its KM; a line without its ₹; a file not sent by this person', noKm.ERROR === C1 + ': a service needs its KM reading – the next service is counted from it.' && noLine.ERROR === 'Bill line 1 (Wiper): enter its amount (₹).' && other.ERROR === 'A bill file was not added by you in the last 6 hours – add it again.', [noKm, noLine, other]);
    const s2 = await J('saveMaint', { date: d2, no: C1, garage: 'Tyre House', billNo: 'TH-9', km: '', service: false, lines: [{ work: 'Tyre', amount: 6000 }, { work: 'Discount', amount: -100 }, { work: 'engine oil', amount: 400 }] });
    const ls = await J('getMaint', { from: d1, to: today });
    ok('   the list: newest first, ₹8660 in all; the words typed before – "Engine oil" first (twice), the garages', s2.id === 'MT-000002' && same(ls.rows.map(r => r.id), ['MT-000002', 'MT-000001']) && ls.total === 8660 && ls.works[0] === 'Engine oil' && ls.garages.indexOf('Tyre House') > -1, ls);
    const fl = await J('getMaintFiles', 'MT-000001');
    let got = null; try { got = Buffer.from(await (await fetch(fl.files[0].url)).arrayBuffer()); } catch (e) { got = null; }
    ok('   the bill\'s files open (links of 15 minutes) – the PDF as it was sent', fl.files.length === 2 && !!got && got.equals(PDF), [fl, got && got.length]);
    const lg = await J('maintLog', { no: C1, from: d1, to: today });
    ok('   the car\'s log book: the 2 fills (card, Cash) and the 2 bills by date; fuel ₹3150 (card ₹2100, cash ₹1050), maintenance ₹8660, all ₹11810; the last service', lg.title === 'Maintenance Log Book – ' + C1 &&
      same(lg.lines.map(x => x.kind + ':' + x.amount), ['Fuel:2100', 'Maintenance:2360', 'Fuel:1050', 'Maintenance:6300']) && lg.total.fuel.card === 2100 && lg.total.fuel.cash === 1050 && lg.total.maint.amount === 8660 && lg.total.all === 11810 &&
      same(lg.lastService, { date: d1, km: 45210, id: 'MT-000001' }), lg);
    // ---- 3. the page at T2 ----
    const mp = await b.newPage(); await mp.setViewport({ width: 1600, height: 1000 }); mp.on('pageerror', e => errs.push('T2: ' + String(e.message).slice(0, 200)));
    await mp.goto(SA + '/#sso=' + await ticket('T2'), { waitUntil: 'load' });
    const F = await find(mp, () => typeof S === 'object' && !!S.user && !!S.today && S.fuelMode === 'card');
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    let live = ''; for (let i = 0; i < 30; i++) { live = await F.evaluate(() => document.getElementById('live_dot').textContent.trim()); if (live === 'Live') break; await wait(500); }
    ok('3. the page at T2 stays live ("Live" – the heartbeat answers)', live === 'Live', live);
    const dh2 = await F.evaluate(async () => (await rawCall('dbHealth')).checks.filter(x => /Maintenance Log Book/.test(x.name)).map(x => ({ ok: x.ok, fix: x.fix || '' })));
    ok('   the database check at T2: "Maintenance Log Book … (step 1zi)" in place', dh2.length === 1 && dh2[0].ok, dh2);
    out.push('info: T2\'s other database checks not in place on this rig: ' + JSON.stringify(await F.evaluate(async () => (await rawCall('dbHealth')).checks.filter(x => !x.ok).map(x => x.name + ' → ' + (x.fix || '')))));
    const nav = await F.evaluate(() => ({ mnt: !$('tab-mnt').hidden, cards: !$('tab-cards').hidden }));
    ok('   the menu has Maintenance (and Fuel Cards)', nav.mnt && nav.cards, nav);
    await F.evaluate(() => showTab('mnt')); await wait(2500);
    const l0 = await F.evaluate(() => ({ rows: [...document.querySelectorAll('#mt_rows tr')].map(t => t.cells[0] && t.cells[0].textContent), sum: $('mt_sum').textContent, works: [...document.querySelectorAll('#dl_mwork option')].map(o => o.value) }));
    ok('   Maintenance: the bills of this month (2), the total, the words typed before offered', same(l0.rows, ['MT-000002', 'MT-000001']) && /8,660\.00/.test(l0.sum) && l0.works[0] === 'Engine oil', l0);
    // a new bill: the car, then its files in the attachments' box, then "Read the bill (AI)"
    await F.evaluate(no => { $('mt_no').value = no; }, C2);      // (the date box keeps today – the AI's date of the bill goes in)
    await F.evaluate(() => $('mt_addf').click()); for (let i = 0; i < 20 && !(await F.evaluate(() => !!document.getElementById('at_back'))); i++) await wait(300);
    const box = await F.evaluate(() => ({ title: document.querySelector('#at_back h3').textContent, qr: !!document.querySelector('#at_back [data-at="qr"]') }));
    ok('   "+ Add bill": the attachments\' box ("Bill files"), without Scan with Mobile', box.title === 'Bill files' && !box.qr, box);
    const inp = await F.$('#at_file'); await inp.uploadFile(path.join(dir, 'bill.pdf'), path.join(dir, 'bill.jpg'));
    for (let i = 0; i < 40; i++) { const n = await F.evaluate(() => document.querySelectorAll('#at_tiles .at-tile.st-new').length); if (n >= 2) break; await wait(300); }
    await F.evaluate(() => document.querySelector('#at_back [data-at="ok"]').click());
    for (let i = 0; i < 60 && await F.evaluate(() => !!document.getElementById('at_back')); i++) await wait(400);
    const fp = await F.evaluate(() => ({ n: S.mt.files.length, read: !$('mt_read').disabled, txt: $('mt_files').textContent }));
    ok('   the 2 files sent (kept in the store) and shown; "Read the bill (AI)" can be pressed', fp.n === 2 && fp.read && /bill\.pdf/.test(fp.txt), fp);
    await say({ date: d2, billNo: 'MS-77', garage: 'Maruti Service', vehicle: C2, km: 1200, service: true, total: 3540, lines: [{ work: 'Service charge', amount: 2500 }, { work: 'Coolant', amount: 500 }, { work: 'GST 18%', amount: 540 }] });
    await F.evaluate(() => $('mt_read').click());
    for (let i = 0; i < 40; i++) { if (await F.evaluate(() => /Read by the AI|read nothing/.test($('mt_readmsg').textContent))) break; await wait(400); }
    const fr = await F.evaluate(() => ({ dt: $('mt_date').value, dtBlue: $('mt_date').classList.contains('ai-read'), g: $('mt_garage').value, b: $('mt_billno').value, km: $('mt_km').value, sv: $('mt_service').checked, blue: document.querySelectorAll('#sec-mnt .ai-read').length,
      lines: mtLinesNow().filter(l => l.work).map(l => l.work + ' ' + l.amount), total: $('mt_total').textContent, msg: $('mt_readmsg').textContent }));
    ok('   "Read the bill (AI)": the bill\'s date (the box had today), the garage, bill no., KM, Service and the 3 lines put in the form – blue, "check every value"; the total ₹3,540.00', fr.dt === d2 && fr.dtBlue && fr.g === 'Maruti Service' && fr.b === 'MS-77' && fr.km === '1200' && fr.sv && fr.blue >= 6 &&
      same(fr.lines, ['Service charge 2500', 'Coolant 500', 'GST 18% 540']) && fr.total === '3,540.00' && /check every value/.test(fr.msg), fr);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) y.hidden = true; }); }); await wait(300);
    await F.evaluate(() => $('mt_lines').scrollIntoView({ block: 'center' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt165_form.png') });
    // a line changed by hand (no longer blue), then Save
    await F.evaluate(() => { const a = document.querySelectorAll('#mt_lines .mt-a')[1]; a.value = '600'; a.dispatchEvent(new Event('input', { bubbles: true })); });
    const t2 = await F.evaluate(() => $('mt_total').textContent);
    await F.evaluate(() => $('mt_save').click());
    for (let i = 0; i < 40 && sql('rcl_s2', "select count(*) from maintenance where bill_no = 'MS-77'") === '0'; i++) await wait(500);
    const r3 = sql('rcl_s2', "select id || '|' || machinery || '|' || amount || '|' || service || '|' || km_reading from maintenance where bill_no = 'MS-77'"), f3 = JSON.parse(sql('rcl_s2', "select files from maintenance where bill_no = 'MS-77'") || '[]');
    ok('   saved from the page: MT-000003 – ' + C2 + ', ₹3640 (the line typed over), Service, 1200 km; its 2 files', t2 === '3,640.00' && r3 === 'MT-000003|' + C2 + '|3640|Yes|1200' && f3.length === 2, [t2, r3, f3]);
    await wait(2500);
    const l1 = await F.evaluate(() => ({ rows: [...document.querySelectorAll('#mt_rows tr')].map(t => t.cells[0] && t.cells[0].textContent), clear: $('mt_no').value === '' && S.mt.files.length === 0 }));
    ok('   the list has it at once; the form is empty again', l1.rows[0] === 'MT-000003' && l1.clear, l1);
    // Edit: the form with its lines and files; a change saved
    await F.evaluate(() => document.querySelector('[data-mte="MT-000003"]').click()); await wait(2500);
    const ed = await F.evaluate(() => ({ t: $('mt_title').textContent, no: $('mt_no').value, n: mtLinesNow().filter(l => l.work).length, files: S.mt.files.length, sv: $('mt_service').checked }));
    ok('   Edit: "Change bill MT-000003" – its car, 3 lines, Service and its 2 files back in the form', ed.t === 'Change bill MT-000003' && ed.no === C2 && ed.n === 3 && ed.files === 2 && ed.sv, ed);
    await F.evaluate(() => { $('mt_remark').value = 'checked'; $('mt_save').click(); });
    for (let i = 0; i < 30 && sql('rcl_s2', "select coalesce(remark, '') from maintenance where id = 'MT-000003'") !== 'checked'; i++) await wait(500);
    ok('   the change saved (its files kept)', sql('rcl_s2', "select remark from maintenance where id = 'MT-000003'") === 'checked' && JSON.parse(sql('rcl_s2', "select files from maintenance where id = 'MT-000003'") || '[]').length === 2);
    // the car's log book on the screen and in Excel
    await F.evaluate((no, a, z) => { $('ml_no').value = no; $('ml_from').value = a; $('ml_to').value = z; $('ml_go').click(); }, C1, d1, today);
    for (let i = 0; i < 30 && !(await F.evaluate(() => !$('rpmlog_out').hidden)); i++) await wait(400);
    const lb = await F.evaluate(() => ({ t: $('rpmlog_title').textContent, kp: [...document.querySelectorAll('#rpmlog_kpis div')].map(x => x.textContent), rows: document.querySelectorAll('#rpmlog_body table')[0].tBodies[0].rows.length, pr: !$('ml_print').disabled,
      fits: [...document.querySelectorAll('#rpmlog_body table')[0].tBodies[0].rows[0].cells].slice(0, 3).every(c => c.scrollWidth <= c.clientWidth + 1), head: [...document.querySelectorAll('#rpmlog_body table')[0].tHead.rows[0].cells].map(c => c.textContent) }));
    ok('   the car\'s log book on the screen: its title, 4 lines (2 fills, 2 bills) – Sr, Date, Entry, What (each fits its column), Fuel / Maintenance / All costs / Last service', lb.t === 'Maintenance Log Book – ' + 'MNT-1-165' && lb.rows === 4 && lb.fits && lb.head.slice(0, 4).join('|') === 'Sr|Date|Entry|What' && lb.kp.some(x => /All costs₹11,810\.00/.test(x)) && lb.kp.some(x => /Last service/.test(x)) && lb.pr, lb);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { $('ai_panel').hidden = true; $('ai_panel').style.display = 'none'; } catch (e) {} ['fixbox', 'toast'].forEach(id => { const y = document.getElementById(id); if (y) y.hidden = true; }); }); await wait(300);
    await F.evaluate(() => $('rpmlog_out').scrollIntoView({ block: 'start' })); await wait(300);
    await mp.screenshot({ path: path.join(SHOT, 'mnt165_logbook.png') });
    for (let i = 0; i < 30 && !(await F.evaluate(() => typeof XLSX !== 'undefined')); i++) await wait(500);
    const xl = await F.evaluate(() => { let got = null; const w = XLSX.writeFile; XLSX.writeFile = (wb, name) => { got = { name: name, sheets: wb.SheetNames, a1: wb.Sheets[wb.SheetNames[0]]['A3'] && wb.Sheets[wb.SheetNames[0]]['A3'].v }; }; try { rpExcel({ key: 'mlog' }); } finally { XLSX.writeFile = w; } return got; });
    ok('   … and in Excel: the sheets "Log Book" and "By work", its title on top', !!xl && same(xl.sheets, ['Log Book', 'By work']) && /^RCL_Maintenance_Log_Book_MNT_1_165_/.test(xl.name) && /Maintenance Log Book/.test(xl.a1 || ''), xl);
    // ---- 4. S1: as before ----
    const s1t = await post(SA, { fn: 'ssoLogin', args: [await ticket('S1')] });
    const J1 = async (fn, ...a) => { const r = await post(SA, { fn: 'api', args: [s1t.result.token, fn, a], site: 'S1' }); return r.error ? { ERROR: r.error } : r.result; };
    const x1 = await J1('getMaint', {});
    ok('4. S1: Maintenance refused – "This site is not on fuel cards …"', /^This site is not on fuel cards/.test(x1.ERROR || ''), x1);
    const sp = await b.newPage(); await sp.setViewport({ width: 1440, height: 950 }); sp.on('pageerror', e => errs.push('S1: ' + String(e.message).slice(0, 200)));
    await sp.goto(SA + '/#sso=' + await ticket('S1'), { waitUntil: 'load' });
    const F1 = await find(sp, () => typeof S === 'object' && !!S.user && !!S.today);
    let live1 = ''; for (let i = 0; i < 30; i++) { live1 = await F1.evaluate(() => document.getElementById('live_dot').textContent.trim()); if (live1 === 'Live') break; await wait(500); }
    const v1 = await F1.evaluate(() => ({ mnt: !$('tab-mnt').hidden, inward: !$('tab-inward').hidden }));
    ok('   S1\'s page: no Maintenance in the menu, Diesel Inward there, "Live"', !v1.mnt && v1.inward && live1 === 'Live', [v1, live1]);
    const dh1 = await F1.evaluate(async () => (await rawCall('dbHealth')).checks.filter(x => /Maintenance Log Book/.test(x.name)).map(x => ({ ok: x.ok, fix: x.fix || '' })));
    ok('   the database check at S1 (step 1zi not run there): asks for supabase_step1zi_maintenance.sql', dh1.length === 1 && !dh1[0].ok && dh1[0].fix === 'supabase_step1zi_maintenance.sql', dh1);
    ok('no error on the pages', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try {      // the test's own data out again (rig only)
      if (n0 === '0') sql('rcl_s2', "delete from maintenance; delete from diesel_issue where machinery like 'MNT-%165'; delete from master where id like 'MNT-%165'; " +
        "delete from web.props where key in ('FUEL_MODE', 'FUEL_CARDS', 'CARDPAY_LAST_NO', 'MNT_LAST_NO', 'DIESEL_PLACES') or key like 'TANK_CAP_%'; delete from web.cache where key like 'SB%'");
      out.push('cleanup: T2 back to ' + sql('rcl_s2', 'select (select count(*) from maintenance) + (select count(*) from diesel_issue)') + ' bills / fills');
    } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
