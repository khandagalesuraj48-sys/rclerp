// faults reported by themselves · Diesel Watch · QR labels and what a scan opens – through the page and the database
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const clean = () => sql("delete from log_book where machinery in ('WX-1', 'WX-2'); delete from diesel_issue where machinery in ('WX-1', 'WX-2'); delete from master where id in ('WX-1', 'WX-2'); delete from app_settings where id = 'APP_ERRORS'; delete from web.props where key = 'ERR_STAMP'; delete from web.cache where key like 'ERRSEEN_%';");
(async () => {
  clean();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); if (r.error) out.push('setup ' + fn + ': ' + r.error); return r.result; };
  for (const no of ['WX-1', 'WX-2']) await api('saveMaster', { no: no, name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 50, owner: 'Watch Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  // WX-1: 24-09 40 L (at 1000) → 100 km until the next fill (needs 25 L) · 26-09 60 L (at 1100, tank holds 50) → no work · 28-09 40 L (still at 1100)
  await api('saveLogRows', { rows: [{ date: '2026-09-24', shift: 'Full Day', no: 'WX-1', mode: 'KM', openingKm: 1000, closingKm: 1060 }, { date: '2026-09-25', shift: 'Full Day', no: 'WX-1', mode: 'KM', closingKm: 1100 }] });
  await api('saveDieselIssue', { date: '2026-09-24', shift: 'Day', source: 'Dispenser', no: 'WX-1', qty: 40, kmReading: 1000, force: true });
  await api('saveDieselIssue', { date: '2026-09-26', shift: 'Day', source: 'Dispenser', no: 'WX-1', qty: 60, kmReading: 1100, force: true });
  await api('saveDieselIssue', { date: '2026-09-28', shift: 'Day', source: 'Dispenser', no: 'WX-1', qty: 40, kmReading: 1100, force: true });
  // WX-2: diesel, but no Log Book at all
  await api('saveDieselIssue', { date: '2026-09-25', shift: 'Day', source: 'Dispenser', no: 'WX-2', qty: 35, kmReading: 500, force: true });
  // ---------- Diesel Watch, the figures ----------
  const w = await api('rptWatch', { from: '2026-09-24', to: '2026-09-30' });
  const mine = (w.findings || []).filter(x => x.no === 'WX-1').map(x => x.kind + ' ' + x.date.slice(8) + ': ' + x.litres + ' L');
  ok('Diesel Watch finds the four signs of WX-1, the biggest first: no work 60 L, 15 L more than the work needs, 10 L over the tank, a meter that did not move',
    mine.join(' | ') === 'No work 26: 60 L | More than the work needs 24: 15 L | Over the tank 26: 10 L | Reading 28: 0 L', mine.join(' | '));
  const m1 = (w.machines || []).find(x => x.no === 'WX-1') || {};
  ok('…in the totals a fill with two signs counts once: WX-1 = 60 + 15 = 75 L (not 85), 4 signs', m1.litres === 75 && m1.signs === 4, m1);
  const u = (w.unchecked || []).find(x => x.no === 'WX-2');
  ok('…and says apart that the diesel of WX-2 (35 L, no Log Book) cannot be checked', !!u && u.qty === 35 && u.fills === 1, u);
  // ---------- the page ----------
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/?m=WX-1', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6500);
  // a label was scanned (the link carried ?m=WX-1)
  const arr = await f.evaluate(() => ({ title: (document.querySelector('#qr_sheet h3') || {}).textContent || '', shown: !!document.getElementById('qr_sheet'), buttons: [...document.querySelectorAll('#qr_go [data-qrgo]')].map(x => x.textContent).join(' | '), url: window.top.location.href }));
  ok('a scanned label (…/?m=WX-1): after sign-in the app asks what to do for that machinery, and the link is clean again', arr.shown && arr.title === 'WX-1' && /Diesel Issue \| Log Book entry/.test(arr.buttons) && !/[?]m=/.test(arr.url), arr);
  await p.screenshot({ path: 'shots/qr_scan.png' });
  await f.evaluate(() => document.querySelector('#qr_go [data-qrgo="diesel"]').click()); await wait(1500);
  const di = await f.evaluate(() => ({ tab: S.curTab, no: document.getElementById('d_no').value }));
  ok('"Diesel Issue" opens the diesel form with the machinery filled in', di.tab === 'diesel' && di.no === 'WX-1', di);
  // the labels
  await f.evaluate(() => { window.__docs = []; printDoc = function (title, inner) { window.__docs.push({ title: title, html: inner }); }; showTab('master'); }); await wait(2000);
  await f.evaluate(() => document.getElementById('m_qr').click()); await wait(500);
  await f.evaluate(() => { document.getElementById('qr_which').value = 'WX-1'; document.getElementById('cf_ok').click(); }); await wait(900);
  const lab = await f.evaluate(() => { const d = window.__docs[0] || { title: '', html: '' }; const box = document.createElement('div'); box.innerHTML = d.html; return { title: d.title, labels: box.querySelectorAll('.qrl').length, svg: !!box.querySelector('.qrl svg'), text: (box.querySelector('.qrl') || {}).textContent || '', link: qrLink('WX-1') }; });
  ok('QR labels: a label for the machinery with its QR code and number; the code holds the app\'s link to that machinery', lab.labels === 1 && lab.svg && /WX-1/.test(lab.text) && /Scan: diesel issue/.test(lab.text) && /^http:\/\/127\.0\.0\.1:3000\/[?]m=WX-1$/.test(lab.link), lab);
  fs.writeFileSync('/tmp/qr.html', '<html><head><meta charset="utf-8"></head><body style="margin:20px;width:760px">' + (await f.evaluate(() => window.__docs[0].html)) + '</body></html>');
  // the Diesel Watch report on the page
  await f.evaluate(() => { showTab('rp-watch'); document.getElementById('rpwatch_from').value = '2026-09-24'; document.getElementById('rpwatch_to').value = '2026-09-30'; document.getElementById('rpwatch_go').click(); });
  for (let i = 0; i < 40; i++) { await wait(500); if (await f.evaluate(() => /Diesel Watch/.test(document.getElementById('rpwatch_title').textContent))) break; }
  const rp = await f.evaluate(() => ({ title: document.getElementById('rpwatch_title').textContent, kpis: document.getElementById('rpwatch_kpis').textContent.replace(/\s+/g, ' ').slice(0, 220), rows: document.querySelectorAll('#rpwatch_body table[data-sheet="Signs"] tbody tr').length, unchecked: /WX-2/.test(document.getElementById('rpwatch_body').textContent) }));
  ok('the report page shows them: signs, machinery to look at first, and the diesel that cannot be checked', /Diesel Watch/.test(rp.title) && rp.rows >= 4 && rp.unchecked, rp);
  await p.screenshot({ path: 'shots/watch.png' });
  // ---------- faults ----------
  await f.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; const sc = document.createElement('script'); sc.textContent = 'setTimeout(function () { thisFunctionDoesNotExist(); }, 10);'; document.body.appendChild(sc); }); await wait(350);      // a fault in the page's own code
  const card = () => f.evaluate(() => { const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 520) : ''; });
  const c1 = await card();
  ok('a fault of the page: the user is told at once that it is the app, not the entry, and that the Admin knows (with what to do, in Marathi)', /fault in the app on this page – it is not your entry/.test(c1) && /app चा स्वतःचा बिघाड/.test(c1), c1.slice(0, 260));
  const still = await f.evaluate(() => ({ login: !document.getElementById('login_screen').hidden, tab: S.curTab, report: !document.getElementById('rpwatch_out').hidden }));
  ok('…and stays on the page with the work as it was (the sign-in screen does NOT come over it)', !still.login && still.tab === 'rp-watch' && still.report, still);
  let c2 = ''; for (let i = 0; i < 16; i++) { await wait(500); c2 = await card(); if (/was just reported/.test(c2)) break; }
  ok('…and an Admin who is working gets a note within seconds, with its own advice', /A fault of the app was just reported – rp-watch: .*thisFunctionDoesNotExist/.test(c2) && /वरचे "Faults" दाबा/.test(c2), c2.slice(0, 300));
  const srv = await f.evaluate(async () => { try { await call('rptOwner', { from: '2026-09-01', to: '2026-09-30', ownerships: 5 }); return 'no error'; } catch (e) { return String(e.message || e); } });
  ok('a fault on the server: the user gets a plain sentence, not a raw error', /The app hit a fault while doing this \(rptOwner\) – it is not your entry\. It has been reported to the Admin/.test(srv), srv.slice(0, 200));
  for (let i = 0; i < 20; i++) { await wait(500); if (await f.evaluate(() => !document.getElementById('err_pill').hidden && /2/.test(document.getElementById('err_pill').textContent))) break; }
  const pill = await f.evaluate(() => ({ shown: !document.getElementById('err_pill').hidden, text: document.getElementById('err_pill').textContent }));
  ok('the Admin sees "Faults: 2" in the top bar within seconds, while working', pill.shown && pill.text === 'Faults: 2', pill);
  await f.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; document.getElementById('err_pill').click(); });
  for (let i = 0; i < 20; i++) { await wait(400); if (await f.evaluate(() => !document.getElementById('cf_back').hidden && /Faults of the app/.test(document.getElementById('cf_title').textContent))) break; }
  const list = await f.evaluate(() => ({ title: document.getElementById('cf_title').textContent, rows: [...document.querySelectorAll('#cf_msg table.dbh tbody tr')].map(tr => [...tr.children].slice(1, 5).map(td => td.textContent.replace(/details[\s\S]*/, '').trim().slice(0, 60)).join(' / ')), pillHidden: document.getElementById('err_pill').hidden }));
  ok('the list says who, what kind, where and what – for both; once looked at, the pill goes', list.rows.length === 2 && /Sujit \/ on the server \/ rptOwner \/ .*map is not a function/.test(list.rows[0]) && /Sujit \/ on the page \/ rp-watch \/ .*thisFunctionDoesNotExist/.test(list.rows[1]) && list.pillHidden, list);
  await p.screenshot({ path: 'shots/faults.png' });
  const btns = await f.evaluate(() => ({ empty: !!document.getElementById('flt_empty'), cancelShown: document.getElementById('cf_cancel') ? document.getElementById('cf_cancel').offsetParent !== null : false }));
  ok('the list has one way out (Close) and its own "Empty the list" button', btns.empty && !btns.cancelShown, btns);
  const again = await f.evaluate(async () => { closeConfirm(true); try { await call('rptOwner', { from: '2026-09-01', to: '2026-09-30', ownerships: 5 }); } catch (e) {} return true; }); await wait(800);
  ok('the same fault again within 10 minutes is not written a second time', Number(JSON.parse(sql("select value from app_settings where id = 'APP_ERRORS'")).length) === 2, sql("select length(value) from app_settings where id = 'APP_ERRORS'"));
  ok('no other script error', errs.filter(x => !/thisFunctionDoesNotExist/.test(x)).length === 0, errs.join(' | '));
  clean();
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/new3.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/new3.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 700)); try { clean(); } catch (e2) {} process.exit(1); });
