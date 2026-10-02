// excavator with Bucket + Breaker (item-wise BOQ): pick the work in the Log Book → saved → list → bill
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 320) : '')); };
(async () => {
  sql("delete from log_book where machinery = 'EX-200'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 760 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  const okDlg = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(3000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const openRow = async date => { await f.evaluate(async d => { setLgMode('date'); const dt = document.getElementById('lg_top_date'); dt.value = d; dt.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 600));
      const tr = document.querySelector('#lg_in .lrow'); const x = tr.querySelector('[data-f=no]'); x.value = 'EX-200'; x.dispatchEvent(new Event('change', { bubbles: true })); }, date);
    for (let i = 0; i < 30; i++) { await wait(500); if (await f.evaluate(() => { const tr = document.querySelector('#lg_in .lrow'); return !!(tr && tr._p && tr._p.machine.id === 'EX-200' && tr.querySelector('.lg-itm .itm-pick')); })) break; } };
  const setF = (k, v) => f.evaluate((k2, v2) => { const el = document.querySelector('#lg_in .lrow [data-f=' + k2 + ']'); el.value = v2; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); lgCalcAll(); }, k, v);
  const pick = async name => { await f.evaluate(n => { [...document.querySelectorAll('#lg_in .lrow .itm-chip')].find(c => c.dataset.pick === n).click(); }, name); await wait(250); await f.evaluate(() => lgCalcAll()); };
  const state = () => f.evaluate(() => { lgCalcAll(); const tr = document.querySelector('#lg_in .lrow'), bx = tr.querySelector('.lg-itm'); return { chips: [...bx.querySelectorAll('.itm-chip')].map(c => c.textContent + (c.classList.contains('on') ? '*' : '')).join(' '), say: bx.querySelector('.itm-say').textContent, split: !bx.querySelector('.itm-split').hidden, red: tr.classList.contains('err'), note: (tr.querySelector('.c-m .lnote') || {}).textContent || '', items: JSON.stringify(itemBoxRead(bx)) }; });
  const save = async () => { await f.evaluate(() => document.getElementById('l_save').click()); let s = ''; for (let i = 0; i < 14; i++) { await wait(500); const t = await okDlg(); if (t) s += t + ' / '; } return s + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 420) : ''; }); };
  const row = d => sql("select working_hrs || '|' || coalesce(item_work::text, '') from log_book where id = 'EX-200|" + d + "|Full Day'");
  // day 1: nothing picked → refused with the reason; then Breaker for the whole entry
  await openRow('2026-09-30'); await setF('openingHr', '1000'); await setF('closingHr', '1008');
  let st = await state();
  ok('a new entry shows the items as buttons and nothing is picked yet', st.chips === 'Bucket Breaker Split' && st.red && /Pick the work of this entry: Bucket \/ Breaker \/ Split/.test(st.note), st);
  await p.screenshot({ path: 'shots/item_pick.png' });
  let r = await save(); ok('Save without a pick is refused and says what to do (Marathi)', /Pick the work of this entry/.test(r) && /काय करायचे/.test(r) && row('2026-09-30') === '', r.slice(0, 260));
  await f.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; });
  await pick('Breaker'); st = await state(); ok('press "Breaker": the whole entry (8 hr) is breaker work', st.chips === 'Bucket Breaker* Split' && st.say === '8 hr' && !st.red && st.items === '{"Breaker":8}', st);
  await setF('closingHr', '1009'); st = await state(); ok('…and it follows the reading: Close 1009 → 9 hr', st.say === '9 hr' && st.items === '{"Breaker":9}', st); await setF('closingHr', '1008');
  r = await save(); ok('saved: 8 hr, item work Breaker 8', /^8\|.*Breaker.*8/.test(row('2026-09-30')), row('2026-09-30') + ' ' + r.slice(0, 80));
  // day 2: Bucket for the whole entry
  await openRow('2026-10-01'); await setF('closingHr', '1016'); await pick('Bucket'); st = await state();
  ok('press "Bucket": 8 hr of bucket work', st.chips === 'Bucket* Breaker Split' && st.say === '8 hr' && !st.red, st); r = await save();
  ok('saved: 8 hr, nothing for Breaker (all Bucket)', /^8\|/.test(row('2026-10-01')) && !/Breaker[^0-9]*[1-9]/.test(row('2026-10-01')), row('2026-10-01'));
  // day 3: both – Split: Breaker 3 → Bucket gets the rest (5)
  await openRow('2026-10-02'); await setF('closingHr', '1024'); await pick('_split');
  await f.evaluate(() => { const i = document.querySelector('#lg_in .lrow .lg-itm input[data-item=Breaker]'); i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); lgCalcAll(); }); st = await state();
  ok('"Split": Breaker 3 typed, Bucket takes the rest (5)', st.chips === 'Bucket Breaker Split*' && st.split && st.items === '{"Breaker":3}' && await f.evaluate(() => /Bucket 5 hr/.test(document.querySelector('#lg_in .lrow .itm-rest').textContent)), st);
  await p.screenshot({ path: 'shots/item_split.png' }); r = await save();
  ok('saved: 8 hr, Breaker 3', /^8\|.*Breaker.*3/.test(row('2026-10-02')), row('2026-10-02'));
  // the list
  await f.evaluate(() => { const a = document.getElementById('lf_from'), c = document.getElementById('lf_to'), n = document.getElementById('lf_no'); a.value = '2026-09-30'; c.value = '2026-10-02'; n.value = 'EX-200'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(3000);
  const lst = await f.evaluate(() => document.getElementById('l_rows').textContent.replace(/\s+/g, ' '));
  ok('the list says the work of each entry', /Breaker 8 hr/.test(lst) && /Bucket 8 hr/.test(lst) && /Bucket 5 hr · Breaker 3 hr|Breaker 3 hr · Bucket 5 hr/.test(lst), (lst.match(/(Bucket|Breaker)[^A-Z]{1,40}hr[^A-Z]{0,30}/g) || []).join(' || '));
  // the edit window opens with the saved pick
  await f.evaluate(() => openLogEdit('EX-200|2026-09-30|Full Day')); await wait(2500);
  const ed = await f.evaluate(() => { const bx = document.getElementById('le_itm'); return [...bx.querySelectorAll('.itm-chip')].map(c => c.textContent + (c.classList.contains('on') ? '*' : '')).join(' ') + ' | ' + bx.querySelector('.itm-say').textContent; });
  ok('the edit window opens with what was saved (Breaker, 8 hr)', ed === 'Bucket Breaker* Split | 8 hr', ed); await f.evaluate(() => { try { document.getElementById('le_cancel').click(); } catch (e) {} });
  // the bill: Bucket 8 + 5 = 13 hr × 1,200 = 15,600; Breaker 8 + 3 = 11 hr × 1,500 = 16,500; A = 32,100
  await f.evaluate(() => showTab('bill')); await wait(1500);
  await f.evaluate(async () => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /Item Vendor/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-30'; document.getElementById('mb_to').value = '2026-10-02'; document.getElementById('mb_build').click(); });
  for (let i = 0; i < 30; i++) { await wait(500); if (await f.evaluate(() => (S.mb.bills || []).length > 0)) break; }
  const bill = await f.evaluate(() => { const bb = (S.mb.bills || []).find(x => /Item Vendor/.test(x.vendor.name)); return bb ? { A: bb.A, lines: bb.machines[0].lines.map(l => (l.item || '') + ' ' + l.qty + ' × ' + l.rate + ' = ' + l.amount).join(' ; ') } : null; });
  ok('the bill: Bucket 13 hr × 1,200 = 15,600 and Breaker 11 hr × 1,500 = 16,500 → A = 32,100', bill && bill.A === 32100 && /Bucket 13 × 1200 = 15600/.test(bill.lines) && /Breaker 11 × 1500 = 16500/.test(bill.lines), bill);
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/item2.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/item2.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 500)); process.exit(1); });
