// Split timing of a Time entry (11 to 1 and 2 to 5 = 5 hours). First WITHOUT the database step (one From – To saves as always, a split
// is refused and names the file), then with it: the entry page → database → Log Book list → edit window → Edit Log Book → print.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 620) : '')); };
const clean = () => sql("delete from log_book where machinery = 'SPX-1'; delete from boq where vendor_name = 'Split Vendor P'; delete from master where id = 'SPX-1'; delete from vendors where vendor_name = 'Split Vendor P';");
const restart = () => execSync('timeout 80 /tmp/up3.sh >/dev/null 2>&1; for i in $(seq 1 40); do a=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/); b=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/); if [ "$a" = "200" ] && [ "$b" = "200" ]; then break; fi; sleep 0.5; done', { shell: '/bin/bash' });
const hasCol = () => sql("select count(*) from information_schema.columns where table_name = 'log_book' and column_name = 'time_slots'") === '1';
const db = () => sql("select string_agg(to_char(date,'DD') || ' ' || shift || ': ' || coalesce(start_time,'') || '>' || coalesce(end_time,'') || ' brk ' || coalesce(break_min::float::text,'') || ' hrs ' || coalesce(time_hrs::float::text,'') " + (hasCol() ? "|| case when coalesce(time_slots,'') <> '' then ' [' || time_slots || ']' else '' end" : '') + ", ' | ' order by date, case shift when 'Night' then 2 else 1 end) from log_book where machinery = 'SPX-1'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  sql('alter table public.log_book drop column if exists time_slots;'); restart();
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
  let tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  await api('saveMaster', { no: 'SPX-1', name: 'Poclain', type: 'Poclain', unit: 'Hrs', worksOn: ['Hrs', 'Time'], hrStd: 4, owner: 'Split Vendor P', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  await api('saveVendor', { name: 'Split Vendor P', gstReg: 'No', pan: 'ABCPE1234T', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add');
  await api('saveBoq', { vendor: 'Split Vendor P', from: '2026-09-01', tdsPct: 0, woNo: 'WO-SP', lines: [{ no: 'SPX-1', basis: 'Per Hour', rate: 1000, diesel: 'Company' }] }, 'add');

  // ---------- without the database step ----------
  let r = await api('saveLogRows', { rows: [{ date: '2026-09-01', shift: 'Full Day', no: 'SPX-1', mode: 'Time', tStart: '08:00', tEnd: '13:00', tSlots: [['08:00', '13:00']], tBreak: 30 }] });
  ok('before the database step: an entry with ONE From – To saves as always (08:00 to 13:00, break 30 = 4.5)', !r.ERROR && db() === '01 Full Day: 08:00>13:00 brk 30 hrs 4.5', r.ERROR || db());
  r = await api('saveLogRows', { rows: [{ date: '2026-09-02', shift: 'Day', no: 'SPX-1', mode: 'Time', tStart: '11:00', tEnd: '17:00', tSlots: [['11:00', '13:00'], ['14:00', '17:00']] }] });
  const refused = r.ERROR || JSON.stringify(r);
  ok('…a SPLIT entry is refused, naming the file to run – nothing is saved', /Split timing/.test(refused) && /supabase_step1w_time_slots\.sql/.test(refused) && db() === '01 Full Day: 08:00>13:00 brk 30 hrs 4.5', refused.slice(0, 230));
  // ---------- the database step, as the Admin runs it ----------
  execSync('su postgres -c "psql -d rcl -q -f /home/claude/vercel/sql/supabase_step1w_time_slots.sql" 2>&1'); execSync('su postgres -c "psql -d rcl -q -f /home/claude/vercel/sql/supabase_step1w_time_slots.sql" 2>&1');      // (twice: safe to run again)
  restart(); tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const health = await api('dbHealth'); const hl = JSON.stringify(health).match(/[^{}]*step 1w[^{}]*/);
  ok('after the step: the column is there (old entry untouched) and the health check lists it as done', hasCol() && db() === '01 Full Day: 08:00>13:00 brk 30 hrs 4.5' && !!hl && /"ok":true/.test(hl[0]), hl ? hl[0].slice(0, 150) : 'not listed');

  // ---------- the entry page ----------
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  b.on('targetcreated', async t => { try { if (t.type() === 'page') { const w = await t.page(); if (w && w !== p) { await wait(2500); const txt = await w.evaluate(() => document.querySelector('.sheet') ? document.querySelector('.sheet').innerText.replace(/[ \t]+/g, ' ') : '').catch(() => ''); if (txt) printed.push(txt); await w.close(); } } } catch (e) {} });
  const printed = [];
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); localStorage.setItem('rcl_print_head', 'Rachana Construction Limited'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { document.getElementById('cf_ok').click(); return true; } return false; });
  const toastNow = () => f.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent.trim() : ''; });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} setLgMode('mach'); const n = document.getElementById('lg_top_no'); n.value = 'SPX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(3000);
  // helpers on the first row of the entry grid
  const row = fn => f.evaluate(fn);
  const setIn = (sel, v) => f.evaluate((sel, v) => { const tr = document.querySelector('#sec-log tr.lrow'); const el = tr.querySelector(sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
  const state = () => f.evaluate(() => { const tr = document.querySelector('#sec-log tr.lrow'); return { way: (tr.querySelector('.way') || { dataset: {} }).dataset.sel, slots: lgSlots(tr), labels: [...tr.querySelectorAll('.tm-h')].map(x => x.textContent.trim()), total: tr.querySelector('[data-o="whr"]').textContent.replace(/\s+/g, ' ').trim(), shown: (tr.querySelector('.tm-t') || {}).textContent, addShown: !tr.querySelector('.rd.tm.addt').hidden, top: getComputedStyle(tr.children[5]).verticalAlign }; });
  const newRow = async (date, shift) => { await f.evaluate((date, shift) => { const tr = document.querySelector('#sec-log tr.lrow'); const d = tr.querySelector('[data-f="date"]'); d.value = date; d.dispatchEvent(new Event('input', { bubbles: true })); d.dispatchEvent(new Event('change', { bubbles: true })); const s = tr.querySelector('[data-f="shift"]'); s.value = shift; s.dispatchEvent(new Event('change', { bubbles: true })); }, date, shift); await wait(1800);
    await f.evaluate(() => { const tr = document.querySelector('#sec-log tr.lrow'); const bt = tr.querySelector('.way [data-way="Time"]'); if (bt) bt.click(); }); await wait(600); };
  const saveGrid = async until => { await f.evaluate(() => [...document.querySelectorAll('#sec-log button')].find(x => /^Save Log Book/.test(x.textContent.trim())).click()); const said = []; for (let i = 0; i < 30; i++) { await wait(500); const t = await toastNow(); if (t && said.indexOf(t) < 0) said.push(t); await yes(); if (until()) break; } await wait(2500); return said; };

  // his example: 11 to 1 and 2 to 5
  await newRow('2026-09-02', 'Day');
  await setIn('[data-f="tStart"]', '11:00'); await setIn('[data-f="tEnd"]', '13:00'); await wait(400);
  let s0 = await state();
  await row(() => document.querySelector('#sec-log tr.lrow .tm-add').click()); await wait(300);
  await setIn('.tm-xa .rd.xs:last-child input', '14:00'); await setIn('.tm-xb .rd.xs:last-child input', '17:00'); await wait(700);
  let s1 = await state();
  ok('entry page, measured by Time: "+ time" adds a second From – To; each shows its hours as a number and the total is their sum (11:00–13:00 = 2, 14:00–17:00 = 3, total 5)',
    s0.way === 'Time' && s0.addShown && JSON.stringify(s1.slots) === JSON.stringify([['11:00', '13:00'], ['14:00', '17:00']]) && s1.labels.join('|') === '2 hr|3 hr' && /^5\s*hr$/.test(s1.total), { one_time: { labels: s0.labels, total: s0.total }, two_times: { labels: s1.labels, total: s1.total } });
  const geo = async () => f.evaluate(() => { const tr = document.querySelector('#sec-log tr.lrow'); const box = el => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const ins = [...tr.querySelectorAll('.rd.tm input[type=time]')].map(el => ({ v: el.value, w: Math.round(el.getBoundingClientRect().width), cy: Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) }));
    const labs = [...tr.querySelectorAll('.tm-h')].map(el => ({ t: el.textContent, cy: Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2), box: box(el) }));
    const tot = tr.querySelector('.tm-t'), brk = tr.querySelector('[data-f="tBreak"]'), totTd = tr.querySelector('[data-o="whr"]').closest('td'), dsl = tr.querySelector('[data-o="odslCell"]');
    return { ins, labs, total: { t: tot.textContent, cy: Math.round(tot.getBoundingClientRect().top + tot.getBoundingClientRect().height / 2), box: box(tot) }, breakCy: Math.round(brk.getBoundingClientRect().top + brk.getBoundingClientRect().height / 2), totalTd: box(totTd), dieselX: dsl ? Math.round(dsl.closest('td').getBoundingClientRect().left) : 0, rowW: Math.round(tr.getBoundingClientRect().width), wrapW: Math.round(document.querySelector('.lg-wrap').getBoundingClientRect().width), scrollW: document.querySelector('.lg-wrap').scrollWidth }; });
  const shots = {};
  for (const w of [1920, 1536, 1366, 1280]) { await p.setViewport({ width: w, height: 800 }); await wait(700); await f.evaluate(() => document.querySelector('#sec-log tr.lrow').scrollIntoView({ block: 'center' })); await wait(300); shots[w] = await geo();
    const r = await f.evaluate(() => { const b = document.querySelector('#sec-log tr.lrow').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await p.screenshot({ path: '/home/claude/test/shots/splittime_entry_' + w + '.png', clip: { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 44), width: Math.min(w, r.w + 12), height: r.h + 56 } }); }
  await p.setViewport({ width: 1536, height: 900 }); await wait(600);
  const g = shots[1536], near = (a, b2) => Math.abs(a - b2) <= 2;
  const bad = w => { const q = shots[w], o = []; if (!q.ins.every(i => i.w >= 88)) o.push('time box narrower than 88 px'); if (!(near(q.ins[0].cy, q.ins[2].cy) && near(q.ins[1].cy, q.ins[3].cy))) o.push('From and To not on one line');
    if (!(near(q.labs[0].cy, q.ins[2].cy) && near(q.labs[1].cy, q.ins[3].cy))) o.push('hours not on the line of their time'); if (!q.labs.every(l => l.box[0] >= q.totalTd[0] - 1 && l.box[0] + l.box[2] <= q.totalTd[0] + q.totalTd[2] + 1)) o.push('hours outside the Total column');
    if (q.total.t !== '5 hr' || !near(q.total.cy, q.breakCy) || q.total.box[0] < q.totalTd[0] - 1 || q.total.box[0] + q.total.box[2] > q.totalTd[0] + q.totalTd[2] + 1) o.push('total not on the Break line in the Total column'); if (q.scrollW > q.wrapW + 1 && w >= 1366) o.push('row wider than its box'); return o; };      // at 1280 the row is 50 px wider than its box in the live code too (measured with rowwidth.js: 1002 in 952) – not from this change
  const W = [1920, 1536, 1366, 1280];
  ok('   look on a computer (1920 / 1536 / 1366 / 1280 wide): every time box shows the whole time, each From, its To and its hours stand on one line, the hours are in the Total column, the total is on the Break line; the row is as wide as before',
    W.every(w => !bad(w).length) && shots[1280].scrollW === 1002 && shots[1366].scrollW === 1036 && shots[1536].scrollW === 1206 && shots[1920].scrollW === 1590, W.map(w => w + ': ' + (bad(w).join(', ') || 'ok') + ' (boxes ' + shots[w].ins.map(i => i.w).join('/') + ' px, lines ' + shots[w].ins.map(i => i.cy).join('/') + ', hours ' + shots[w].labs.map(l => l.cy).join('/') + ', total ' + shots[w].total.cy + ' = break ' + shots[w].breakCy + ')').join(' ; '));
  await f.evaluate(() => document.querySelector('#sec-log tr.lrow').scrollIntoView({ block: 'center' })); await wait(300); await p.screenshot({ path: '/home/claude/test/shots/splittime_entry.png' });
  let said = await saveGrid(() => /02 Day/.test(db() || ''));
  ok('   saved – database: From = first From, To = last To, Break = the gap (60), hours 5, and the split kept', /02 Day: 11:00>17:00 brk 60 hrs 5 \[11:00-13:00,14:00-17:00\]/.test(db()), db());
  // a night in two parts around midnight, with a 30-minute break typed
  await newRow('2026-09-02', 'Night');
  await setIn('[data-f="tStart"]', '20:00'); await setIn('[data-f="tEnd"]', '23:00'); await row(() => document.querySelector('#sec-log tr.lrow .tm-add').click()); await wait(300);
  await setIn('.tm-xa .rd.xs:last-child input', '01:00'); await setIn('.tm-xb .rd.xs:last-child input', '04:30'); await setIn('[data-f="tBreak"]', '30'); await wait(700);
  s1 = await state();
  said = await saveGrid(() => /02 Night/.test(db() || ''));
  ok('   a NIGHT split around midnight (20:00–23:00, 01:00–04:30) with a 30 min break: 3 + 3.5 − 0.5 = 6 on the page and in the database', s1.labels.join('|') === '3 hr|3.5 hr' && /^6\s*hr$/.test(s1.total) && /02 Night: 20:00>04:30 brk 150 hrs 6 \[20:00-23:00,01:00-04:30\]/.test(db()), { labels: s1.labels, total: s1.total, database: (db().match(/02 Night[^|]*/) || [''])[0] });
  // 2 pm to 3.30 pm = 1.5
  await newRow('2026-09-03', 'Full Day');
  await setIn('[data-f="tStart"]', '14:00'); await setIn('[data-f="tEnd"]', '15:30'); await wait(700);
  s1 = await state();
  said = await saveGrid(() => /03 Full Day/.test(db() || ''));
  ok('   one time 14:00 to 15:30: the number is 1.5; saved as an ordinary entry (no split text)', /^1\.5\s*hr$/.test(s1.total) && /03 Full Day: 14:00>15:30 brk  hrs 1\.5$/.test(db()), { total: s1.total, database: (db().match(/03 Full Day.*$/) || [''])[0] });
  // times out of order: refused with the reason
  await newRow('2026-09-04', 'Full Day');
  await setIn('[data-f="tStart"]', '14:00'); await setIn('[data-f="tEnd"]', '17:00'); await row(() => document.querySelector('#sec-log tr.lrow .tm-add').click()); await wait(300);
  await setIn('.tm-xa .rd.xs:last-child input', '11:00'); await setIn('.tm-xb .rd.xs:last-child input', '13:00'); await wait(500);
  said = await saveGrid(() => false);
  ok('   times typed out of order (14–17, then 11–13): not saved, the message says which time and why', !/04 Full Day/.test(db()) && said.some(t => /time 2 \(11:00 to 13:00\) starts before time 1 ends \(17:00\)/.test(t)), said.join(' // ').slice(0, 260));
  // × takes the second time away: an ordinary entry again
  await row(() => document.querySelector('#sec-log tr.lrow .tm-rem').click()); await wait(500);
  s1 = await state();
  ok('   × removes the added time: the row is one From – To again (14:00–17:00 = 3)', s1.slots.length === 1 && /^3\s*hr$/.test(s1.total), { slots: s1.slots, total: s1.total });
  await f.evaluate(() => { S.formDirty = false; });

  // ---------- the Log Book list ----------
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n = document.getElementById('lf_no'); n.value = 'SPX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(3000);
  const list = await f.evaluate(() => [...document.querySelectorAll('#l_rows tr')].map(tr => [...tr.children].slice(0, 7).map(td => td.innerText.replace(/\s+/g, ' ').trim()).join(' | ')).filter(x => /SPX-1/.test(x)));
  const l2 = list.find(x => /^02-09-2026 \| Day/.test(x)) || '';
  ok('Log Book list: the split entry shows both times, each with its hours, and the total 5', /11:00 14:00 \| 13:00 \(2 hr\) 17:00 \(3 hr\) \| 5/.test(l2), l2);

  // ---------- the edit window ----------
  await f.evaluate(() => { const tr = [...document.querySelectorAll('#l_rows tr')].find(r => /^02-09-2026\s*Day/.test(r.innerText.replace(/\s+/g, ' ').trim()) || (/02-09-2026/.test(r.children[0].textContent) && /^Day/.test(r.children[1].textContent.trim()))); tr.querySelector('[data-ledit]').click(); }); await wait(2500);
  const ed = await f.evaluate(() => ({ open: !document.getElementById('le_back').hidden, from: document.getElementById('le_ts').value, to: document.getElementById('le_te').value, brk: document.getElementById('le_tb').value, more: [...document.querySelectorAll('#le_xs .le-x')].map(d => d.querySelector('[data-s=a]').value + '-' + d.querySelector('[data-s=b]').value + ' ' + d.querySelector('.tm-h').textContent), note: document.getElementById('le_note').textContent.replace(/\s+/g, ' ') }));
  ok('Edit (Log Book list): the window opens with the two times as they were entered (first in From / To, the second under it), the Break box empty (the gap is not a break), total 5 hr (2 + 3)', ed.open && ed.from === '11:00' && ed.to === '13:00' && ed.brk === '' && ed.more.join() === '14:00-17:00 3 hr' && /Total for this entry: 5 hr \(2 \+ 3\)/.test(ed.note), ed);
  // a third time is added: 17:30 to 19:00
  await f.evaluate(() => { document.getElementById('le_xadd').click(); const d = document.querySelector('#le_xs .le-x:last-child'); const a = d.querySelector('[data-s=a]'), b2 = d.querySelector('[data-s=b]'); a.value = '17:30'; b2.value = '19:00'; a.dispatchEvent(new Event('input', { bubbles: true })); b2.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(500);
  const note2 = await f.evaluate(() => document.getElementById('le_note').textContent.replace(/\s+/g, ' '));
  await p.screenshot({ path: '/home/claude/test/shots/splittime_edit.png' });
  await f.evaluate(() => document.getElementById('le_save').click()); let asked = '';
  for (let i = 0; i < 24; i++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const x = document.getElementById('cf_msg').textContent.replace(/\s+/g, ' '); document.getElementById('cf_ok').click(); return x; } return ''; }); if (t) asked = t; if (/17:30-19:00/.test(db())) break; }
  ok('   a third time added (17:30–19:00): total 6.5 (2 + 3 + 1.5); the "what will change" box names the times; saved', /6\.5 hr \(2 \+ 3 \+ 1\.5\)/.test(note2) && /Time \(From – To\)/.test(asked) && /02 Day: 11:00>19:00 brk 90 hrs 6\.5 \[11:00-13:00,14:00-17:00,17:30-19:00\]/.test(db()), { note: note2.slice(0, 90), asked: asked.slice(0, 200), database: (db().match(/02 Day[^|]*/) || [''])[0] });

  // ---------- Edit Log Book grid ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = '2026-09-01'; document.getElementById('lx_to').value = '2026-09-05'; const n = document.getElementById('lx_no'); n.value = 'SPX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('lx_load').click(); }); await wait(3500);
  const lx = await f.evaluate(() => [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)]; return r.date.slice(8) + ' ' + r.shift + ' ' + r.tStart + '-' + r.tEnd + ' brk ' + r.tBrk + ' | ' + (tr.querySelector('.lx-split') ? tr.querySelector('.lx-split').textContent : '') + ' | ' + tr.querySelector('.tot').textContent.replace(/\s+/g, ' ').trim(); }));
  ok('Edit Log Book: the split entries show as From – To – Break with the same hours, and their split is written under them', /^02 Day 11:00-19:00 brk 90 \| split: 11:00 – 13:00 \(2\) \+ 14:00 – 17:00 \(3\) \+ 17:30 – 19:00 \(1\.5\) \| 6\.5 hr$/.test(lx[1] || '') && /^02 Night 20:00-04:30 brk 150 \| split: .* \| 6 hr$/.test(lx[2] || '') && /^01 Full Day 08:00-13:00 brk 30 \|  \| 4\.5 hr$/.test(lx[0] || ''), lx);
  // another row of the grid is changed and saved: the splits stay
  const before = db();
  await f.evaluate(() => { const i = LX.rows.findIndex(r => r.date === '2026-09-03'); const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="work"]'); el.value = 'trench cutting'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  await f.evaluate(() => document.getElementById('lx_save').click()); for (let i = 0; i < 20; i++) { await wait(500); await yes(); if (sql("select coalesce(work_done,'') from log_book where machinery = 'SPX-1' and date = '2026-09-03'") === 'trench cutting') break; } await wait(2000);
  ok('   another entry changed in the grid and saved: the splits (and all hours) are exactly as before', db() === before && sql("select coalesce(work_done,'') from log_book where machinery = 'SPX-1' and date = '2026-09-03'") === 'trench cutting', db() === before ? 'identical' : db());

  // ---------- the print and the bill ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; showTab('log'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n = document.getElementById('lf_no'); n.value = 'SPX-1'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(2500);
  await f.evaluate(() => [...document.querySelectorAll('#sec-log button')].find(x => /Print Log Book/.test(x.textContent)).click()); for (let i = 0; i < 16; i++) { await wait(500); await yes(); if (printed.length) break; } await wait(1500);
  const pr = (printed[0] || '').replace(/\n+/g, ' ');
  ok('Log Book print: the split entry shows its times one under the other (11:00 14:00 17:30 / 13:00 17:00 19:00) and 6.5 HR; the month: 4.5 + 6.5 + 6 + 1.5 = 18.5', /11:00 14:00 17:30/.test(pr) && /13:00 17:00 19:00/.test(pr) && /6\.5 ?HR/i.test(pr) && /18\.5/.test(pr), (pr.match(/02-09-2026.{0,120}/) || [pr.slice(0, 200)])[0]);
  const bill = await api('getLogBookList', { from: '2026-09-01', to: '2026-09-30', no: 'SPX-1', all: true });
  ok('the hours every report and the bill use (working hours of the entries): 4.5, 6.5, 6, 1.5', JSON.stringify((bill.rows || []).map(x => x.whr).sort()) === JSON.stringify([1.5, 4.5, 6, 6.5]), (bill.rows || []).map(x => x.date.slice(8) + ' ' + x.shift + ' ' + x.whr));
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
