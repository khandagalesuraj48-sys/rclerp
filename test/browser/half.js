// "½ day" from the Log Book entry to the bill, through the page and the database. First WITHOUT the database step (refused, named),
// then with it: entry page → database → Edit page → bill page (= server on Verify & Submit) → Log Book print.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 440) : '')); };
const clean = () => sql("delete from bills where vendor_name = 'Half Vendor'; delete from log_book where machinery = 'HDX-1'; delete from diesel_issue where machinery = 'HDX-1'; delete from boq where vendor_name = 'Half Vendor'; delete from master where id = 'HDX-1'; delete from vendors where vendor_name = 'Half Vendor';");
const restart = () => execSync('timeout 80 /tmp/up3.sh >/dev/null 2>&1; for i in $(seq 1 40); do a=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/); b=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/); if [ "$a" = "200" ] && [ "$b" = "200" ]; then break; fi; sleep 0.5; done', { shell: '/bin/bash' });
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 160)); }
  sql('alter table public.log_book drop column if exists day_part;'); restart();
  // (after a restart of the test servers the first call can meet a connection the old server left behind: asked again)
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
  let tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  await api('saveMaster', { no: 'HDX-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Half Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  await api('saveVendor', { name: 'Half Vendor', gstReg: 'No', pan: 'ABCDE1234H', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  await api('saveBoq', { vendor: 'Half Vendor', from: '2026-09-01', tdsPct: 0, woNo: 'WO-HD', lines: [{ no: 'HDX-1', basis: 'Monthly', rate: 30000, diesel: 'Company' }] }, 'add');
  // ---------- without the database step ----------
  let r = await api('saveLogRows', { rows: [{ date: '2026-09-01', shift: 'Full Day', no: 'HDX-1', mode: 'KM', openingKm: 1000, closingKm: 1040 }] });
  ok('before the database step: an ordinary entry saves as always', !r.ERROR && Number(sql("select count(*) from log_book where machinery = 'HDX-1'")) === 1, r.ERROR || 'saved');
  r = await api('saveLogRows', { rows: [{ date: '2026-09-02', shift: 'Full Day', no: 'HDX-1', mode: 'KM', closingKm: 1060, half: true }] });
  const refused = r.ERROR || JSON.stringify(r).slice(0, 300);
  ok('…a "½ day" entry is refused, naming the file to run – nothing is saved', /½ day/.test(refused) && /supabase_step1v_half_day\.sql/.test(refused) && Number(sql("select count(*) from log_book where machinery = 'HDX-1'")) === 1, refused.slice(0, 220));
  // ---------- the database step, as the Admin runs it ----------
  execSync('su postgres -c "psql -d rcl -q -f /home/claude/vercel/sql/supabase_step1v_half_day.sql" 2>&1'); execSync('su postgres -c "psql -d rcl -q -f /home/claude/vercel/sql/supabase_step1v_half_day.sql" 2>&1');      // (twice: safe to run again)
  restart(); tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const health = await api('dbHealth'); const hl = JSON.stringify(health).match(/[^{}]*step 1v[^{}]*/);
  ok('after the step: the health check lists it as done', !!hl && /"ok":true/.test(hl[0]), hl ? hl[0].slice(0, 160) : 'not listed');
  // ---------- the entry page ----------
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} setLgMode('mach'); const n = document.getElementById('lg_top_no'); n.value = 'HDX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  const tick = await f.evaluate(() => { const trs = [...document.querySelectorAll('#sec-log td.c-m')].map(td => td.closest('tr')); const set = (tr, k, v) => { const i = tr.querySelector('[data-f="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); };
    const tr = trs[0]; if (!tr) return { rows: 0 }; set(tr, 'date', '2026-09-02'); const lab = tr.querySelector('.lg-half'); const h = tr.querySelector('[data-f="half"]'); h.checked = true; h.dispatchEvent(new Event('change', { bubbles: true })); return { rows: trs.length, label: lab ? lab.textContent.trim() : '', title: lab ? lab.title.slice(0, 60) : '' }; }); await wait(1800);
  await f.evaluate(() => { const tr = document.querySelector('#sec-log td.c-m').closest('tr'); const i = tr.querySelector('[data-f="closingKm"]'); i.value = '1060'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(500);
  await f.evaluate(() => [...document.querySelectorAll('#sec-log .lg-actions button, #sec-log button')].find(x => /^Save Log Book/.test(x.textContent.trim())).click());
  for (let i = 0; i < 30; i++) { await wait(500); await yes(); if (Number(sql("select count(*) from log_book where machinery = 'HDX-1'")) === 2) break; }
  const db1 = sql("select date || '|' || shift || '|' || coalesce(day_part::float::text, '') || '|' || closing_km::float from log_book where machinery = 'HDX-1' and date = '2026-09-02'");
  ok('entry page: a tick "½ day" under the shift; saved, the entry carries 0.5 in the database (readings as typed)', tick.label === '½ day' && db1 === '2026-09-02|Full Day|0.5|1060', { tick: tick, database: db1 });
  await api('saveLogRows', { rows: [{ date: '2026-09-03', shift: 'Day', no: 'HDX-1', mode: 'KM', closingKm: 1100 }, { date: '2026-09-03', shift: 'Night', no: 'HDX-1', mode: 'KM', closingKm: 1110, half: true }] });
  r = await api('saveLogRows', { rows: [{ date: '2026-09-04', shift: 'Full Day', no: 'HDX-1', mode: 'Holiday', half: true }] });
  ok('a Holiday cannot be a half day (it is not paid at all)', /is for a day that is paid/.test(r.ERROR || JSON.stringify(r)), (r.ERROR || JSON.stringify(r)).slice(0, 140));
  const list = await api('getLogBookList', { from: '2026-09-01', to: '2026-09-30', no: 'HDX-1', all: true });
  ok('the Log Book list knows which entries are half', (list.rows || []).map(x => x.date.slice(8) + ' ' + x.shift + (x.half ? ' ½' : '')).sort().join(', ') === '01 Full Day, 02 Full Day ½, 03 Day, 03 Night ½', (list.rows || []).map(x => x.date.slice(8) + ' ' + x.shift + (x.half ? ' ½' : '')).sort());
  // ---------- the bill ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
  await f.evaluate(async () => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /Half Vendor/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_co').value = 'Rachana Construction Limited'; document.getElementById('mb_build').click(); }).catch(e => out.push('bill load: ' + String(e.message).slice(0, 120)));
  for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await f.evaluate(() => (S.mb.bills || []).length > 0)) break; }
  const m = await f.evaluate(() => { const bb = (S.mb.bills || []).find(x => /Half Vendor/.test(x.vendor.name)); if (!bb) return null; const x = bb.machines[0]; return { workDays: x.workDays, nights: x.nights, amount: x.amount, A: bb.A, abs: document.querySelector('#mb_pages .mb-paper') ? document.querySelector('#mb_pages .mb-paper').textContent.replace(/\s+/g, ' ').slice(0, 900) : '' }; });
  // 30,000 a month ÷ 30 = 1,000 a day: 01 whole (1) + 02 half (0.5) + 03 day (1) + 03 half night (0.5) = 3 → 3,000
  ok('the bill: 2.5 days + 0.5 night = 3 × ₹1,000 = ₹3,000 (without the marks it would be 3 days + 1 night = ₹4,000)', m && m.workDays === 2.5 && m.nights === 0.5 && m.amount === 3000, m && { workDays: m.workDays, nights: m.nights, amount: m.amount });
  await f.evaluate(() => { document.querySelectorAll('#mb_rows tr').forEach(tr => { const no = tr.querySelector('.mb-no'); if (no && !no.value) { no.value = '77'; no.dispatchEvent(new Event('input', { bubbles: true })); } }); }); await wait(600);
  await f.evaluate(() => document.getElementById('mb_abstract').click()); let seen = '';
  for (let i = 0; i < 40; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const tx = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 200); document.getElementById('cf_ok').click(); return tx; } return ''; }); if (t) seen += t + ' || '; if (sql("select count(*) from bills where vendor_name = 'Half Vendor' and status = 'Active'") === '1') break; }
  const saved = sql("select coalesce(data::json->>'A', '') from bills where vendor_name = 'Half Vendor' and status = 'Active'");
  ok('Verify & Submit: the server works the bill out again by itself and agrees – the bill is saved with ₹3,000', Number(saved) === 3000 && !/does not match|differs/i.test(seen), 'saved A = ' + saved + ' | ' + seen.slice(0, 220));
  // ---------- the Log Book print ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__docs = []; printDoc = function (title, inner) { window.__docs.push({ title: title, html: inner }); };
    document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n0 = document.getElementById('lf_no'); n0.value = 'HDX-1'; n0.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  await f.evaluate(() => [...document.querySelectorAll('#sec-log button')].find(x => /Print Log Book/.test(x.textContent)).click()); for (let i = 0; i < 20; i++) { await wait(400); await yes(); if (await f.evaluate(() => window.__docs.length > 0)) break; }
  const pr = await f.evaluate(() => { const box = document.createElement('div'); box.innerHTML = (window.__docs[0] || { html: '' }).html; return box.textContent.replace(/\s+/g, ' '); });
  ok('the Log Book print (the sheet with the bill): "TOTAL WORKING DAYS … 2.5", the halves named, the same ₹3,000', /TOTAL WORKING DAYS ?2 HALF DAYS COUNTED AS ½ ?2\.5/.test(pr) && /TOTAL WORKING NIGHT ?0\.5/.test(pr) && /3,000\.00/.test(pr) && /Day ½/.test(pr), (pr.match(/TOTAL WORKING DAYS.{0,90}/) || [''])[0] + ' … ' + (pr.match(/PAYABLE AMOUNT.{0,30}/) || [''])[0]);
  // ---------- taking the mark off again on the Edit page ----------
  // (a submitted bill locks its entries since 06-10-2026: with the bill in force the server refuses the change)
  const lockedTry = await api('updateLogRow', 'HDX-1|2026-09-02|Full Day', { closingKm: 1061 });
  ok('with the bill submitted, the entry of 02-09 cannot be changed (the refusal names the bill and the way out)', /is in the submitted RA Bill 77 of Half Vendor/.test(JSON.stringify(lockedTry)) && /the Admin deletes that bill/.test(JSON.stringify(lockedTry)), JSON.stringify(lockedTry).slice(0, 200));
  sql("delete from bills where vendor_name = 'Half Vendor'"); await wait(1500);     // (a billed entry cannot be edited – this part is about the Edit page, so the test bill goes first)
  await f.evaluate(() => { showTab('logedit'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lx_from').value = '2026-09-01'; document.getElementById('lx_to').value = '2026-09-30'; const n = document.getElementById('lx_no'); n.value = 'HDX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); const b = document.getElementById('lx_load') || [...document.querySelectorAll('#sec-logedit button')].find(x => /Load|Show/.test(x.textContent)); if (b) b.click(); }); await wait(3000);
  const ed = await f.evaluate(() => { const cks = [...document.querySelectorAll('#lx_rows [data-f="half"]')]; const st = cks.map(x => x.checked); const i = st.indexOf(true); if (i > -1) { cks[i].checked = false; cks[i].dispatchEvent(new Event('change', { bubbles: true })); } return { ticks: st, changed: i }; });
  out.push('   (edit page state: ' + JSON.stringify(await f.evaluate(() => ({ halves: LX.rows.map(r => r.half), changed: LX.rows.filter(r => lxChanged(r)).length, saveBtn: (b => b ? { disabled: b.disabled, hidden: b.hidden || b.offsetParent === null, text: b.textContent } : null)(document.getElementById('lx_save')), panel: !document.getElementById('lx_panel').hidden, tab: S.curTab }))) + ')');
  const said2 = []; await f.evaluate(() => document.getElementById('lx_save').click()); for (let i = 0; i < 30; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'), tt = document.getElementById('toast'); return (c && !c.hidden ? 'box: ' + c.textContent.replace(/\s+/g, ' ').slice(0, 200) : '') + (tt && !tt.hidden ? ' toast: ' + tt.textContent.slice(0, 160) : ''); }); if (t && said2.indexOf(t) < 0) said2.push(t); await yes(); if (sql("select coalesce(day_part::float::text, 'empty') from log_book where machinery = 'HDX-1' and date = '2026-09-02'") === 'empty') break; }
  const db2 = sql("select coalesce(day_part::float::text, 'empty') from log_book where machinery = 'HDX-1' and date = '2026-09-02'");
  ok('Edit Log Book shows the ticks; taking one off and saving makes the entry a whole day again', ed.ticks.join() === 'false,true,false,true' && db2 === 'empty', { ticks: ed.ticks, database: db2, said: said2.join(' // ').slice(0, 300) });
  await p.screenshot({ path: 'shots/half_edit.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  clean();
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/half.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/half.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); try { clean(); } catch (e2) {} process.exit(1); });
