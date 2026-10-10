// update-70 (asked 10-10-2026): "the Log Book shows the data but Edit Log Book is blank"
//   a machinery whose entries were saved by clock Time, and whose Log Book format was later set to one that is measured by the
//   hour meter (format E): Edit Log Book must show each entry the way it was SAVED (its times, its hours), let it be changed and saved.
// On the local rig only.   node timefmt70.js [port] [look]      look = only look at the grid (no save) – for the code before the fix
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000', lookOnly = process.argv[3] === 'look';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'T70-%'; delete from diesel_issue where machinery like 'T70-%'; delete from boq where vendor_name = 'T70 Vendor'; delete from master where id like 'T70-%'; delete from vendors where vendor_name = 'T70 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const rowsDb = () => sql("select string_agg(date || ' ' || unit || ' ' || coalesce(time_hrs::text, '') || ' ' || coalesce(work_done, ''), ' ; ' order by date) from log_book where machinery = 'T70-JCB'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'T70 Vendor', gstReg: 'No', pan: 'ABCDE1270T', bank: 'SBI', account: '12345670', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'T70-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs', 'Time'], hrStd: 4, tankCap: 150, owner: 'T70 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'T70 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-T70', lines: [{ no: 'T70-JCB', basis: 'Per Hour', rate: 1200, diesel: 'Company' }] }, 'add'));
  // the entries are made by clock time (as on the site: 09:00 – 13:00 and 14:00 – 18:00) …
  E(await api('saveLogRows', { rows: [{ date: '2026-09-28', shift: 'Day', no: 'T70-JCB', mode: 'Time', tStart: '09:00', tEnd: '16:30', tSlots: [['09:00', '13:00'], ['14:00', '16:30']], work: 'CLEANING' }] }));
  E(await api('saveLogRows', { rows: [{ date: '2026-09-29', shift: 'Day', no: 'T70-JCB', mode: 'Time', tStart: '10:00', tEnd: '18:00', tSlots: [['10:00', '13:00'], ['14:00', '18:00']], work: 'CASTING YARD' }] }));
  E(await api('saveLogRows', { rows: [{ date: '2026-09-30', shift: 'Day', no: 'T70-JCB', mode: 'Time', tStart: '11:00', tEnd: '13:00', work: 'SHIFTING' }] }));
  E(await api('saveDieselIssue', { date: '2026-09-29', shift: 'Day', source: 'Dispenser', no: 'T70-JCB', qty: 20, force: true }));
  // … and LATER its Log Book format is set to E (challan + particular; measured by the hour meter)
  E(await api('saveLbFormats', { 'T70-JCB': 'E' }));
  const db0 = rowsDb();
  const slots0 = sql("select string_agg(coalesce(start_time, '') || '>' || coalesce(end_time, '') || ' [' || coalesce(time_slots, '') || '] brk ' || coalesce(break_min::text, ''), ' ; ' order by date) from log_book where machinery = 'T70-JCB'");
  ok('a JCB that works on Hrs and Time, three entries by clock time (6.5, 7 and 2 hr), then its Log Book format set to E', !seedErr.length && /2026-09-28 Time 6\.5 CLEANING ; 2026-09-29 Time 7 CASTING YARD ; 2026-09-30 Time 2 SHIFTING/.test(db0), seedErr.join(' // ') || db0);

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const open = async no => { await f.evaluate(no => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; LX.cut = {}; showTab('logedit'); document.getElementById('lx_from').value = '2026-09-01'; document.getElementById('lx_to').value = '2026-09-30'; const n = document.getElementById('lx_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('lx_load').click(); }, no); await wait(3500); };
  const grid = () => f.evaluate(() => ({ head: [...document.querySelectorAll('#lx_head th')].map(x => x.textContent.trim()).filter(Boolean).join(' | '),
    rows: [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)], v = s => (tr.querySelector('[data-f=' + s + ']') || {}).value;
      return { date: r.date, way: v('mode'), ways: [...(tr.querySelector('[data-f=mode]') || { options: [] }).options].map(o => o.value).join('/'), ohr: v('ohr'), chr: v('chr'), times: [...tr.querySelectorAll('input[type=time]')].map(x => x.value).join(' '), tot: tr.querySelector('.tot').textContent.replace(/\s+/g, ' ').trim(), cls: tr.className.trim(), tag: [...tr.querySelectorAll('.tag')].map(x => x.textContent).join(','), notes: [...tr.querySelectorAll('.lx-note')].map(x => x.textContent).join(' | '), iss: tr.querySelector('.is').textContent.trim(), work: v('work') }; }),
    sum: document.getElementById('lx_sum').textContent.replace(/\s+/g, ' '), save: document.getElementById('lx_save').textContent + (document.getElementById('lx_save').disabled ? ' (off)' : ''), foot: document.getElementById('lx_foot').textContent.replace(/\s+/g, ' ').slice(0, 120) }));
  await open('T70-JCB'); let g = await grid();
  await f.evaluate(() => document.querySelector('table.lx-t').scrollIntoView({ block: 'center' })); await wait(300); await p.screenshot({ path: '/home/claude/test/shots/timefmt70_' + port + '.png' });
  ok('Edit Log Book shows the three entries AS SAVED: measured by Time, their times, 6.5 / 7 / 2 hr – no empty red row, nothing marked as changed',
    g.rows.length === 3 && g.rows.every(r => r.way === 'Time' && !/bad|chg/.test(r.cls) && !r.tag) && /09:00/.test(g.rows[0].times) && /6\.5/.test(g.rows[0].tot) && /\b7\b/.test(g.rows[1].tot) && /\b2\b/.test(g.rows[2].tot) && /No changes yet/.test(g.sum),
    { head: g.head, rows: g.rows.map(r => r.date.slice(8) + ' [' + r.way + ' of ' + r.ways + '] hrs ' + r.ohr + '>' + r.chr + ' times ' + r.times + ' = ' + r.tot + ' ' + r.cls + ' ' + r.notes), sum: g.sum, save: g.save, foot: g.foot });
  if (!lookOnly) {
    const setIn = async (i, sel, v) => { await f.evaluate((i, sel, v) => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] ' + sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, i, sel, v); await wait(300); };
    const save = async () => { await f.evaluate(() => document.getElementById('lx_save').click()); let said = ''; for (let k = 0; k < 16; k++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; }); if (t) said += t + ' / '; }
      return said + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 300) : ''; if (bx) bx.hidden = true; return t; }); };
    // a description corrected (the times untouched)
    await setIn(0, '[data-f=work]', 'CLEANING WORK'); g = await grid();
    let said = await save(); await wait(2500); let db = rowsDb();
    const slots = sql("select string_agg(coalesce(start_time, '') || '>' || coalesce(end_time, '') || ' [' || coalesce(time_slots, '') || '] brk ' || coalesce(break_min::text, ''), ' ; ' order by date) from log_book where machinery = 'T70-JCB'");
    ok('a description is corrected and saved: the entry keeps its way (Time), its 6.5 hr and its split timing (09:00 – 13:00 + 14:00 – 16:30); the other two are untouched', /2026-09-28 Time 6\.5 CLEANING WORK ; 2026-09-29 Time 7 CASTING YARD ; 2026-09-30 Time 2 SHIFTING/.test(db) && slots === slots0, { said: said.slice(0, 160), database: db, times: slots, timesBefore: slots0 });
    // the time of the 30th corrected: 11:00 – 13:00 becomes 11:00 – 14:00
    await open('T70-JCB'); g = await grid();
    const tEnd = await f.evaluate(() => { const tr = document.querySelector('#lx_rows tr[data-i="2"]'); const t = [...tr.querySelectorAll('input[type=time]')]; return t.map(x => x.dataset.f || x.className).join(','); });
    await f.evaluate(() => { const tr = document.querySelector('#lx_rows tr[data-i="2"]'); const t = [...tr.querySelectorAll('input[type=time]')]; const el = t[t.length - 1]; el.value = '14:00'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(500);
    g = await grid(); said = await save(); await wait(2500); db = rowsDb();
    ok('the To time of the 30th is corrected (13:00 → 14:00) and saved: 3 hr, still by Time', /2026-09-30 Time 3 SHIFTING/.test(db) && /2026-09-28 Time 6\.5 CLEANING WORK ; 2026-09-29 Time 7 CASTING YARD/.test(db), { timeBoxes: tEnd, row: g.rows[2], said: said.slice(0, 200), database: db });
    // a NEW entry of this machinery follows its format (E = hour meter): the choice of a new row
    await open('T70-JCB'); g = await grid();
    ok('opened again: three entries by Time, nothing marked as changed; each row offers the way it was saved in (Time) beside the way of the format (Hrs)', g.rows.length === 3 && g.rows.every(r => r.way === 'Time' && /Hrs/.test(r.ways) && /Time/.test(r.ways) && !/bad|chg/.test(r.cls)) && /No changes yet/.test(g.sum), g.rows.map(r => r.date.slice(8) + ' [' + r.way + ' of ' + r.ways + '] ' + r.times + ' = ' + r.tot + ' ' + r.cls));
    await f.evaluate(() => { S.formDirty = false; LX.rows = []; LX.deleted = []; LX.cut = {}; });
  }
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
