// meter not working, through the page and the real database: No reading → estimate proposed → saved → list → reading again → new meter → bill
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const NO = 'MH-15-AB-0001';
(async () => {
  sql("delete from log_book where machinery = '" + NO + "' and date >= '2026-10-01'");
  const lastClose = Number(sql("select closing_km from log_book where machinery = '" + NO + "' and closing_km is not null order by date desc limit 1")) || 0;
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const dismiss = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const okDlg = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.slice(0, 200); document.getElementById('cf_ok').click(); return t; } return ''; });
  await dismiss(); await f.evaluate(() => showTab('log')); await wait(2600); await dismiss();
  const row = async (date, fill) => { await f.evaluate(async (d, no) => { setLgMode('date'); const dt = document.getElementById('lg_top_date'); dt.value = d; dt.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 500));
      const tr = document.querySelector('#lg_in .lrow'); const x = tr.querySelector('[data-f=no]'); x.value = no; x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1800)); }, date, NO); await f.evaluate(fill); await wait(500); };
  const set = "const tr = document.querySelector('#lg_in .lrow'); const set = (k, v) => { const el = tr.querySelector('[data-f=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; const way = w => [...tr.querySelectorAll('.way .wy')].find(b => b.dataset.way === w).click();";
  const save = async () => { await f.evaluate(() => document.getElementById('l_save').click()); const seen = []; for (let i = 0; i < 8; i++) { await wait(500); const t = await okDlg(); if (t) seen.push(t); } return seen.join(' / ') + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? bx.querySelector('.fx-msg').textContent : ''; }); };
  // day 1: "No reading"
  await row('2026-10-01', new Function(set + "way('No reading');")); await wait(600);
  const st = await f.evaluate(() => { lgCalcAll(); const tr = document.querySelector('#lg_in .lrow'); const vis = s => { const e = tr.querySelector(s); return !!e && e.offsetParent !== null; };
    return { btn: !!tr.querySelector('.way .wy.nrd'), est: tr.querySelector('[data-f=estKm]').value, avg: tr._p.avgWork, estShown: vis('[data-f=estKm]'), reasonShown: vis('[data-f=meterNote]'), startHidden: !vis('[data-f=openingKm]'), closeHidden: !vis('[data-f=closingKm]'), total: tr.querySelector('[data-o=wkm]').textContent, fits: tr.scrollWidth <= tr.clientWidth + 1 }; });
  ok('"No reading" button: readings go away, the estimate is proposed from the machinery\'s own average, a reason is asked', st.btn && st.estShown && st.reasonShown && st.startHidden && st.closeHidden && Number(st.est) > 0 && Number(st.est) === st.avg.km && /est\./.test(st.total) && st.fits, st);
  await p.screenshot({ path: 'shots/meter_row.png' });
  let r = await save(); ok('without a reason it is refused, with what to do', /write why there is no reading/.test(r), r.slice(0, 200));
  await f.evaluate(new Function(set + "set('meterNote', 'odometer not working');")); r = await save();
  const db1 = sql("select unit || '|' || coalesce(opening_km::text, '') || '|' || coalesce(closing_km::text, '') || '|' || working_km || '|' || meter_note from log_book where id = '" + NO + "|2026-10-01|Full Day'");
  ok('saved: no readings, estimated KM as the work, the reason kept', db1 === 'No reading|||' + st.est + '|No reading – odometer not working', db1 + '  (' + r.slice(0, 80) + ')');
  // day 2: the meter works again → Start = the last reading before the gap
  await row('2026-10-02', new Function(set + ""));
  const st2 = await f.evaluate(() => { lgCalcAll(); const tr = document.querySelector('#lg_in .lrow'); return { way: tr.querySelector('.way').dataset.sel, start: tr.querySelector('[data-f=openingKm]').value, ro: tr.querySelector('[data-f=openingKm]').readOnly, nm: tr.querySelector('.nm') && !tr.querySelector('.nm').hidden }; });
  ok('next day with a reading: Start is the last reading before the gap (' + lastClose + '), and "new meter" is offered', Number(st2.start) === lastClose && st2.nm, st2);
  // a new meter instead: tick, type Start 100 and Close 160
  await f.evaluate(new Function(set + "const ck = tr.querySelector('[data-f=newMeter]'); ck.checked = true; ck.dispatchEvent(new Event('change', { bubbles: true }));")); await wait(400);
  await f.evaluate(new Function(set + "set('openingKm', '100'); set('closingKm', '160'); set('meterNote', 'new speedometer fitted');")); await wait(400);
  r = await save();
  const db2 = sql("select unit || '|' || opening_km || '|' || closing_km || '|' || working_km || '|' || meter_note from log_book where id = '" + NO + "|2026-10-02|Full Day'");
  ok('new meter saved: Start 100 (typed), Close 160, 60 km', db2 === 'KM|100|160|60|New meter – new speedometer fitted', db2 + '  (' + r.slice(0, 120) + ')');
  // the list shows both marks
  await f.evaluate(() => { const a = document.getElementById('lf_from'), c = document.getElementById('lf_to'), n = document.getElementById('lf_no'); a.value = '2026-10-01'; c.value = '2026-10-02'; n.value = 'MH-15-AB-0001'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  const lst = await f.evaluate(() => document.getElementById('l_rows').textContent.replace(/\s+/g, ' '));
  ok('the list marks the estimated day and the new meter', /No reading – odometer not working \(work estimated\)/.test(lst) && /New meter – new speedometer fitted/.test(lst), lst.slice(0, 260));
  // diesel without a reading
  await f.evaluate(() => showTab('diesel')); await wait(2300); await dismiss();
  await f.evaluate(no => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; set('d_no', no); }, NO); await wait(1500);
  const dz = await f.evaluate(() => { const b = [...document.querySelectorAll('#sec-diesel .way .wy')].find(x => x.dataset.way === 'No reading'); if (b) b.click(); return !!b; }); await wait(400);
  await f.evaluate(() => { const el = document.getElementById('d_qty'); el.value = '12'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('d_save').click(); });
  let dmsg = ''; for (let i = 0; i < 8; i++) { await wait(500); const t = await okDlg(); if (t) dmsg += t + ' / '; }
  const dsl = sql("select qty || '|' || coalesce(km_reading::text, 'no reading') from diesel_issue where machinery = '" + NO + "' and qty = 12 order by created_at desc limit 1");
  ok('Diesel Issue has "No reading" too: 12 L saved without a reading', dz && dsl === '12|no reading', dsl + '  ' + dmsg.slice(0, 160));
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/meter.out', out.join('\n')); await b.close();
  sql("delete from log_book where machinery = '" + NO + "' and date >= '2026-10-01'; delete from diesel_issue where machinery = '" + NO + "' and qty = 12 and issue_date >= '2026-10-01'");
})().catch(e => { fs.writeFileSync('/tmp/meter.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 500)); process.exit(1); });
