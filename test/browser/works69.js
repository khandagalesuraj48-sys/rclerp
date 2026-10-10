// update-69 (asked 10-10-2026): a machinery with Bucket + Breaker in its BOQ
//   1. Edit Log Book: the same date and the same shift may have a ROW FOR EACH WORK – no "two entries on Day" error
//   2. it is saved as ONE entry that remembers its rows; opening the grid again shows the rows again
//   3. the Log Book print shows each work on its own row – also for an entry entered with "Split"
//   4. a machinery WITHOUT such works keeps the old rule (one row a shift)
// On the local rig only.   node works69.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const clean = () => sql("delete from bills where vendor_name = 'W69 Vendor'; delete from log_book where machinery like 'W69-%'; delete from log_book where machinery like 'X69-%'; delete from boq where vendor_name = 'X69 Vendor'; delete from master where id like 'X69-%'; delete from vendors where vendor_name = 'X69 Vendor'; delete from diesel_issue where machinery like 'W69-%'; delete from boq where vendor_name = 'W69 Vendor'; delete from master where id like 'W69-%'; delete from vendors where vendor_name = 'W69 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const entry = d => sql("select opening_hrs || '>' || closing_hrs || '=' || working_hrs || ' ' || coalesce(item_work::text, '') || ' ch[' || coalesce(challan_no, '') || '] wk[' || coalesce(work_done, '') || ']' from log_book where id = 'W69-JCB|" + d + "|Day'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'W69 Vendor', gstReg: 'No', pan: 'ABCDE1269W', bank: 'SBI', account: '12345669', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'W69-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 4, tankCap: 150, owner: 'W69 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveMaster', { no: 'W69-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'W69 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveMaster', { no: 'W69-MIX', name: 'JCB', type: 'JCB', unit: 'KM + Hrs', worksOn: ['KM', 'Hrs'], hrStd: 4, kmStd: 3, tankCap: 150, owner: 'W69 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'W69 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-69', lines: [{ no: 'W69-MIX', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }, { name: 'Carting', basis: 'Per KM', rate: 40 }, { name: 'Shifting', basis: 'Per KM', rate: 60 }] }, { no: 'W69-JCB', basis: 'Item-wise', diesel: 'Debit Basis', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }] }, { no: 'W69-TIP', basis: 'Per KM', rate: 40, diesel: 'Company' }] }, 'add'));
  E(await api('saveLogRows', { rows: [{ date: '2026-09-23', shift: 'Day', no: 'W69-JCB', mode: 'Hrs', openingHr: 2357.6, closingHr: 2361.8, items: {}, work: 'DRAIN LOADING' },
    { date: '2026-09-24', shift: 'Day', no: 'W69-JCB', mode: 'Hrs', closingHr: 2364.8, items: {}, work: 'PQC MATERIAL SHIFTING', challan: '694' },
    { date: '2026-09-25', shift: 'Day', no: 'W69-JCB', mode: 'Hrs', closingHr: 2368.3, items: { Breaker: 1.5 }, work: 'SOLAR LIGHT SHIFTING', challan: '695' }] }));      // (the 25th is entered with "Split": Breaker 1.5 of 3.5 hr)
  E(await api('saveLogRows', { rows: [{ date: '2026-09-23', shift: 'Day', no: 'W69-TIP', mode: 'KM', openingKm: 1000, closingKm: 1080 }, { date: '2026-09-24', shift: 'Day', no: 'W69-TIP', mode: 'KM', closingKm: 1140 }] }));
  E(await api('saveLogRows', { rows: [{ date: '2026-09-23', shift: 'Day', no: 'W69-MIX', mode: 'KM + Hrs', openingHr: 100, closingHr: 104, openingKm: 1000, closingKm: 1020, items: { Breaker: 1, Shifting: 8 }, work: 'MIX' }] }));      // (4 hr: Bucket 3 + Breaker 1; 20 km: Carting 12 + Shifting 8)
  E(await api('saveDieselIssue', { date: '2026-09-24', shift: 'Day', source: 'Dispenser', no: 'W69-JCB', qty: 40, hrReading: 2362, force: true }));
  ok('the test machinery (JCB with Bucket + Breaker per hour; a Tipper per KM), entries and one diesel issue are saved', !seedErr.length && sql("select count(*) from log_book where machinery like 'W69-%'") === '6', seedErr.join(' // ') || '6 entries');
  const before24 = entry('2026-09-24');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const open = async no => { await f.evaluate(no => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; LX.cut = {}; showTab('logedit'); document.getElementById('lx_from').value = '2026-09-01'; document.getElementById('lx_to').value = '2026-09-30'; const n = document.getElementById('lx_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('lx_load').click(); }, no); await wait(3500); };
  const grid = () => f.evaluate(() => [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)], v = s => (tr.querySelector('[data-f=' + s + ']') || {}).value;
    return { date: r.date, shift: r.shift, ohr: v('ohr'), chr: v('chr'), okm: v('okm'), ckm: v('ckm'), tot: tr.querySelector('.tot').textContent.trim(), cls: tr.className.trim(), tag: [...tr.querySelectorAll('.tag')].map(x => x.textContent).join(','),
      chips: [...tr.querySelectorAll('.itm-chip')].map(c => c.textContent + (c.classList.contains('on') ? '*' : '')).join(' '), say: (tr.querySelector('.itm-say') || {}).textContent || '', notes: [...tr.querySelectorAll('.lx-note')].map(x => x.textContent).join(' | '),
      half: !!tr.querySelector('[data-f=half]'), part: (tr.querySelector('.lx-part') || {}).textContent || '', more: !!tr.querySelector('.lx-more'), iss: tr.querySelector('.is').textContent.trim(), challan: v('challan'), work: v('work') }; }));
  const sum = () => f.evaluate(() => ({ sum: document.getElementById('lx_sum').textContent.replace(/\s+/g, ' '), save: document.getElementById('lx_save').textContent + (document.getElementById('lx_save').disabled ? ' (off)' : ''), foot: document.getElementById('lx_foot').textContent.replace(/\s+/g, ' ').slice(0, 80) }));
  const setIn = async (i, fld, v) => { await f.evaluate((i, fld, v) => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f=' + fld + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, i, fld, v); await wait(250); };
  const chip = async (i, name) => { await f.evaluate((i, name) => { [...document.querySelectorAll('#lx_rows tr[data-i="' + i + '"] .itm-chip')].find(c => c.dataset.pick === name).click(); }, i, name); await wait(400); };
  const clickIn = async (i, sel) => { await f.evaluate((i, sel) => { document.querySelector('#lx_rows tr[data-i="' + i + '"] ' + sel).click(); }, i, sel); await wait(500); };
  const save = async () => { await f.evaluate(() => document.getElementById('lx_save').click()); let said = ''; for (let k = 0; k < 16; k++) { await wait(500); const t = await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; }); if (t) said += t + ' / '; }
    return said + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 300) : ''; if (bx) bx.hidden = true; return t; }); };
  const printRows = no => f.evaluate(async no => { const L = await call('getLogBookList', { from: '2026-09-01', to: '2026-09-30', no: no, all: true }); const x = await logSheetsOf({ rows: L.rows, f: { from: '2026-09-01', to: '2026-09-30' }, summary: [] }, 'Rachana Construction Limited');
    const d = document.createElement('div'); d.innerHTML = x.sheets; const t = d.querySelector('table.lb-t');
    return { rows: [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim())), foot: [...t.querySelectorAll('tfoot td')].map(td => td.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '), box: d.textContent.replace(/\s+/g, ' ').match(/TOTAL HOURS.*?NET PAYABLE AMOUNT[^₹]*₹ [\d,.]+/)[0] }; }, no);

  // ---------- 1. the grid as it is; a row for another work of the same shift ----------
  await open('W69-JCB');
  let g = await grid();
  ok('the grid opens with the 3 entries; a row of this machinery offers "+ work in this shift"', g.length === 3 && g.every(r => r.more && r.half && !r.part) && g[1].ohr === '2361.8' && g[1].chr === '2364.8' && g[1].iss === '40', g.map(r => r.date.slice(8) + ' ' + r.ohr + '>' + r.chr + ' ' + r.chips));
  await clickIn(1, '.lx-more');
  g = await grid();
  ok('"+ work in this shift" on the 24th adds a row UNDER it: same date, same shift, starting where that work closed (2364.8), nothing picked yet – it says what to do, and is not "two entries on Day"',
    g.length === 4 && g[2].date === '2026-09-24' && g[2].shift === 'Day' && g[2].ohr === '2364.8' && /NEW/.test(g[2].tag) && !/\*/.test(g[2].chips) && /no work yet/.test(g[2].notes) && !/two entries/.test(g.map(r => r.notes).join(' ')) && /work 2 of this day/.test(g[2].part) && !g[2].half && g[2].iss === '0' && g[1].iss === '40',
    { row: g[2].ohr + '>' + g[2].chr, chips: g[2].chips, note: g[2].notes, label: g[2].part, issued: [g[1].iss, g[2].iss] });
  // the Bucket work ended at 2363.8 → the Breaker row starts there by itself
  await setIn(1, 'chr', '2363.8'); await setIn(2, 'chr', '2364.8');
  g = await grid();
  ok('lowering the Close of the first work to 2363.8 moves the Start of the second to 2363.8; the entry after (25th) still starts at 2364.8', g[2].ohr === '2363.8' && g[2].chr === '2364.8' && g[3].ohr === '2364.8' && /2 hr/.test(g[1].tot) && /1 hr/.test(g[2].tot), g.map(r => r.date.slice(8) + ' ' + r.ohr + '>' + r.chr + ' = ' + r.tot));
  ok('   until its work is pressed the new row is red and tells so ("press Bucket / Breaker") – Save is off', /bad/.test(g[2].cls) && /Pick the work|ONE work/.test(g[2].notes + ' ' + g[2].chips + (await f.evaluate(() => document.querySelector('#lx_rows tr[data-i="2"] .itm').textContent))) && /\(off\)/.test((await sum()).save), { note: g[2].notes, save: (await sum()).save });
  await chip(2, 'Breaker');
  await setIn(1, 'challan', '694').catch(() => {}); await setIn(2, 'work', 'ROCK BREAKING'); await setIn(1, 'work', 'PQC MATERIAL SHIFTING');
  g = await grid(); let s0 = await sum();
  ok('Breaker pressed on the second row: both rows are fine (Bucket 2 hr, Breaker 1 hr), no red row, Save is on', /Bucket\*/.test(g[1].chips) && /Breaker\*/.test(g[2].chips) && !/bad/.test(g[1].cls + g[2].cls) && !g[1].notes && !g[2].notes && !/\(off\)/.test(s0.save), { r1: g[1].chips + ' ' + g[1].say, r2: g[2].chips + ' ' + g[2].say, sum: s0.sum, save: s0.save });
  await f.evaluate(() => document.querySelector('table.lx-t').scrollIntoView({ block: 'center' })); await wait(300); await p.screenshot({ path: '/home/claude/test/shots/works69_grid.png' });
  // wrong ways are stopped on the spot
  await chip(2, 'Bucket'); g = await grid();
  ok('   the same work on two rows one after the other is stopped: "same work as the row above … make them one row"', /bad/.test(g[2].cls) && /same work as the row above \(Bucket\)/.test(g[2].notes), g[2].notes);
  await chip(2, '_split'); g = await grid();
  ok('   "Split" on a row of a shift that has a row for each work is stopped: "each row … is ONE work"', /bad/.test(g[2].cls) && /ONE work/.test(g[2].notes), g[2].notes);
  await chip(2, 'Breaker'); await setIn(2, 'ohr', '2364'); g = await grid();
  ok('   a row that does not start where the row above closed is stopped, with "Use it"', /bad/.test(g[2].cls) && /starts where the row above closed: 2,?363\.8/.test(g[2].notes), g[2].notes);
  await clickIn(2, '.lx-fix'); g = await grid();
  ok('   "Use it" puts 2363.8 back – fine again', g[2].ohr === '2363.8' && !/bad/.test(g[2].cls), g[2].ohr + ' ' + g[2].cls);

  // ---------- 2. saved as ONE entry that remembers its rows ----------
  let said = await save(); await wait(2500);
  const after24 = entry('2026-09-24');
  ok('Save: the 24th is still ONE entry in the database (2361.8 → 2364.8 = 3 hr), Breaker 1 hr for the bill, and it remembers its two rows',
    sql("select count(*) from log_book where machinery = 'W69-JCB'") === '3' && /^2361\.8>2364\.8=3 /.test(after24) && /"Breaker":1[,}]/.test(after24) && /"_parts":\[\{"n":"Bucket","q":2[^\]]*\{"n":"Breaker","q":1/.test(after24) && /ROCK BREAKING/.test(after24),
    { said: said.slice(0, 90), before: before24, after: after24 });
  g = await grid(); s0 = await sum();
  ok('the grid opens again with the two rows of the 24th (Bucket 2361.8 → 2363.8, Breaker 2363.8 → 2364.8), nothing marked as changed, the diesel of the shift on its first row',
    g.length === 4 && g[1].ohr === '2361.8' && g[1].chr === '2363.8' && /Bucket\*/.test(g[1].chips) && g[2].ohr === '2363.8' && g[2].chr === '2364.8' && /Breaker\*/.test(g[2].chips) && g.every(r => !r.tag && !/chg|bad|new/.test(r.cls)) && /No changes yet/.test(s0.sum) && g[1].iss === '40' && g[2].iss === '0' && g[2].work === 'ROCK BREAKING' && g[3].ohr === '2364.8',
    { rows: g.map(r => r.date.slice(8) + ' ' + r.ohr + '>' + r.chr + ' ' + r.chips.replace(/ Split/, '') + (r.tag ? ' [' + r.tag + ']' : '')), sum: s0.sum });

  // ---------- 3. the print: each work on its own row ----------
  let pr = await printRows('W69-JCB');
  const line = (rows, re) => rows.filter(r => re.test(r.join(' ¦ ')));
  const r24 = line(pr.rows, /24-09-2026/), r25 = line(pr.rows, /25-09-2026/);
  ok('Log Book print: the 24th is TWO rows – BUCKET 2 HR (2361.8 → 2363.8) with its own description, then BREAKER 1 HR (2363.8 → 2364.8) with its own; the diesel of the day stands once',
    r24.length === 2 && /2361\.8 ¦ 2363\.8 ¦ 2 HR/.test(r24[0].join(' ¦ ')) && /BUCKET 2 HR – PQC MATERIAL SHIFTING/.test(r24[0].join(' ¦ ')) && /2363\.8 ¦ 2364\.8 ¦ 1 HR/.test(r24[1].join(' ¦ ')) && /BREAKER 1 HR – ROCK BREAKING/.test(r24[1].join(' ¦ ')) && !/BREAKER/.test(r24[0].join(' ')) && !/BUCKET/.test(r24[1].join(' ')) && r24[0].indexOf('40') > -1 && r24[1].indexOf('40') === -1,
    r24.map(r => r.join(' ¦ ')));
  ok('   an entry entered with "Split" (the 25th: 3.5 hr, Breaker 1.5) is printed as two rows too – Bucket 2 HR 2364.8 → 2366.8, Breaker 1.5 HR 2366.8 → 2368.3 (the order of the BOQ)',
    r25.length === 2 && /2364\.8 ¦ 2366\.8 ¦ 2 HR/.test(r25[0].join(' ¦ ')) && /BUCKET 2 HR/.test(r25[0].join(' ')) && /2366\.8 ¦ 2368\.3 ¦ 1\.5 HR/.test(r25[1].join(' ¦ ')) && /BREAKER 1\.5 HR/.test(r25[1].join(' ')), r25.map(r => r.join(' ¦ ')));
  ok('   the rows are numbered 1 to 5, no row names two works, and the totals are those of the entries: 10.7 HR, 40 L',
    pr.rows.length === 5 && pr.rows.map(r => r[0]).join(',') === '1,2,3,4,5' && pr.rows.every(r => !/BUCKET.*BREAKER|BREAKER.*BUCKET/.test(r.join(' '))) && /10\.7 HR/.test(pr.foot) && /\b40\b/.test(pr.foot), { sr: pr.rows.map(r => r[0]).join(','), foot: pr.foot });
  ok('   the money is the work of each item at its own rate: Bucket 8.2 hr × 1,200 + Breaker 2.5 hr × 1,500 = 13,590', /BUCKET: 8\.2 HRS × ₹ 1,200\.00/.test(pr.box) && /BREAKER: 2\.5 HRS × ₹ 1,500\.00/.test(pr.box) && /13,590\.00/.test(pr.box), pr.box.slice(0, 420));
  const srv = await api('verifyBills', { bills: [{ vendor: { name: 'W69 Vendor' }, company: 'Rachana Construction Limited', from: '2026-09-01', to: '2026-09-30', partial: true, idlePaid: true, machines: [{ no: 'W69-JCB', workDays: 3, nights: 0, issued: 40, amount: 13590, excessAmt: 0 }], A: 13590, B: 0, C: 0 }] });
  const chk = JSON.stringify(srv).slice(0, 2500);
  ok('   the server works the same bill out by itself: amount ₹13,590 for W69-JCB is not disputed (only the diesel line differs, which this check left at 0)', !/amount ₹/.test(chk) && /diesel deduction/.test(chk), (chk.match(/W69-JCB: [^"]{0,160}/) || [chk.slice(0, 200)])[0]);

  // ---------- 4. three works in a shift; a row taken away; the last row taken away ----------
  await open('W69-JCB'); await clickIn(2, '.lx-more'); await setIn(2, 'chr', '2364.3'); await setIn(3, 'chr', '2364.8'); await chip(3, 'Bucket'); await setIn(3, 'work', 'LOADING AGAIN');
  g = await grid();
  ok('a third row (Bucket again after the Breaker) is taken: 2 + 0.5 + 0.5 hr', g.length === 5 && g[3].date === '2026-09-24' && g[3].ohr === '2364.3' && !/bad/.test(g[1].cls + g[2].cls + g[3].cls) && /work 3 of this day/.test(g[3].part), g.slice(1, 4).map(r => r.ohr + '>' + r.chr + ' ' + r.chips.replace(/ Split/, '') + ' ' + r.cls));
  await save(); await wait(2500);
  let e3 = entry('2026-09-24');
  ok('   saved: one entry, three rows kept (Bucket 2, Breaker 0.5, Bucket 0.5) – Breaker 0.5 hr for the bill', /^2361\.8>2364\.8=3 /.test(e3) && /"Breaker":0\.5/.test(e3) && (e3.match(/"n":/g) || []).length === 3, e3);
  pr = await printRows('W69-JCB');
  ok('   printed as three rows of the 24th', line(pr.rows, /24-09-2026/).length === 3 && /BUCKET 0\.5 HR – LOADING AGAIN/.test(line(pr.rows, /24-09-2026/)[2].join(' ')), line(pr.rows, /24-09-2026/).map(r => r.slice(4, 7).join('>') + ' ' + r[r.length - 1]));
  // take the middle row away: the row after it starts where the first closed
  await clickIn(2, 'button.del'); g = await grid(); s0 = await sum();
  ok('a row of the shift is deleted in the grid: the rows left are shown as changed, the entry itself is NOT counted as deleted', g.length === 4 && /0<\/b> deleted|0 deleted/.test(s0.sum.replace(/<[^>]+>/g, '')) && !/\(off\)/.test(s0.save) || /0 deleted/.test(s0.sum), { rows: g.slice(1, 3).map(r => r.ohr + '>' + r.chr + ' ' + r.chips.replace(/ Split/, '') + ' ' + r.cls + ' ' + r.notes), sum: s0.sum, save: s0.save });
  // (two Bucket rows are now one after the other → must be made one row: delete the second, the first takes the whole shift)
  ok('   the two rows left are both Bucket → stopped ("make them one row")', /same work as the row above/.test(g[2].notes), g[2].notes);
  await clickIn(2, 'button.del'); await setIn(1, 'chr', '2364.8'); g = await grid();
  await save(); await wait(2500); e3 = entry('2026-09-24');
  ok('   with one row left the entry is an ordinary entry again: 3 hr of Bucket, no rows kept, still 3 entries', /^2361\.8>2364\.8=3 /.test(e3) && !/_parts/.test(e3) && !/Breaker/.test(e3) && sql("select count(*) from log_book where machinery = 'W69-JCB'") === '3', e3);

  // ---------- 4b. every Log Book format prints a row for each work (the 25th is a Split: Bucket 2 hr, Breaker 1.5 hr) ----------
  const fm = [];
  for (const F of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'A']) {
    E(await api('saveLbFormats', { 'W69-JCB': F })); await f.evaluate(async () => { try { await refreshLookups(); } catch (e) {} }); await wait(700);
    try { const x = await printRows('W69-JCB'); const r25x = x.rows.filter(r => /25-09-2026/.test(r.join(' ')));
      fm.push(F + ': ' + x.rows.length + ' rows, 25th ' + r25x.length + (r25x.length === 2 && /BUCKET/.test(r25x[0].join(' ')) && !/BREAKER/.test(r25x[0].join(' ')) && /BREAKER/.test(r25x[1].join(' ')) && !/BUCKET/.test(r25x[1].join(' ')) ? ' ok' : ' WRONG ' + r25x.map(r => r.join('¦')).join(' // ').slice(0, 200)) + (/13,290\.00/.test(x.box) ? '' : ' MONEY? ' + (x.box.match(/PAYABLE AMOUNT[^A-Z]{0,30}/) || [''])[0])); }
    catch (e) { fm.push(F + ': ERROR ' + String(e.message).slice(0, 120)); }
  }
  ok('every Log Book format (A to H) prints the Split entry of the 25th as two rows – BUCKET, then BREAKER – and the same money (Bucket 9.2 hr × 1,200 + Breaker 1.5 hr × 1,500 = 13,290)', fm.every(x => / ok$/.test(x)) && seedErr.length === 0, fm);
  // ---------- 4c. an entry whose shift is changed INTO the shift of another entry becomes part of it – and the question before saving says so ----------
  E(await api('saveLogRows', { rows: [{ date: '2026-09-25', shift: 'Night', no: 'W69-JCB', mode: 'Hrs', closingHr: 2370.3, items: {}, work: 'NIGHT LOADING' }] }));
  await open('W69-JCB'); g = await grid(); const ni2 = g.findIndex(r => r.date === '2026-09-25' && r.shift === 'Night'), di2 = g.findIndex(r => r.date === '2026-09-25' && r.shift === 'Day');
  await f.evaluate(i => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f=shift]'); el.value = 'Day'; el.dispatchEvent(new Event('change', { bubbles: true })); }, ni2); await wait(600);
  g = await grid(); const two = g.map((r, i) => i).filter(i => g[i].date === '2026-09-25');
  ok('the Night entry of the 25th set to Day: it stands under the Day row as a second work of that shift (no "two entries on Day"); the Day row, a Split, is asked for ONE work', two.length === 2 && !/two entries/.test(g.map(r => r.notes).join(' ')) && /ONE work/.test(g[two[0]].notes), g.slice(two[0]).map(r => r.shift + ' ' + r.ohr + '>' + r.chr + ' ' + r.notes));
  await chip(two[0], 'Breaker'); g = await grid(); s0 = await sum();
  await f.evaluate(() => document.getElementById('lx_save').click()); let ask = '';
  for (let k = 0; k < 12 && !ask; k++) { await wait(400); ask = await f.evaluate(() => { const c = document.getElementById('cf_back'); return c && !c.hidden ? document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ') : ''; }); }
  ok('   Save asks first and counts the entry that goes: "1 entry deleted (25-09-2026 Night: its rows were moved into another entry of that date …)"', /1 entry deleted \(25-09-2026 Night: its rows were moved into another entry of that date/.test(ask), ask.slice(0, 260));
  await f.evaluate(() => document.getElementById('cf_ok').click()); for (let k = 0; k < 8; k++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); } await wait(1500);
  const e25 = entry('2026-09-25');
  ok('   saved: the 25th is ONE Day entry 2364.8 → 2370.3 = 5.5 hr with its two rows (Breaker 3.5, Bucket 2); the Night entry is gone; 3 entries in all',
    /^2364\.8>2370\.3=5\.5 /.test(e25) && /"Breaker":3\.5/.test(e25) && /"_parts":\[\{"n":"Breaker","q":3\.5[^\]]*\{"n":"Bucket","q":2/.test(e25) && sql("select count(*) from log_book where machinery = 'W69-JCB'") === '3' && sql("select count(*) from log_book where id = 'W69-JCB|2026-09-25|Night'") === '0', e25);

  // ---------- 4d. a machinery measured in KM + Hrs: what was typed for its KM items stays when its hour works are made rows ----------
  await open('W69-MIX'); g = await grid();
  const mixBefore = sql("select item_work::text from log_book where id = 'W69-MIX|2026-09-23|Day'");
  await clickIn(0, '.lx-more'); await chip(0, 'Bucket'); await setIn(0, 'chr', '103'); await setIn(1, 'chr', '104'); await chip(1, 'Breaker'); g = await grid(); s0 = await sum();
  const typedKm = await f.evaluate(() => LX.rows.map(r => JSON.stringify(r.items || {})));
  ok('W69-MIX (4 hr, 20 km; Shifting 8 km typed): its hours made two rows – Bucket 100 → 103, Breaker 103 → 104 – no red row, Save on', g.length === 2 && g[0].ohr === '100' && g[0].chr === '103' && g[1].ohr === '103' && g[1].chr === '104' && !/bad/.test(g[0].cls + g[1].cls) && !/\(off\)/.test(s0.save), { rows: g.map(r => r.ohr + '>' + r.chr + ' km ' + r.okm + '>' + r.ckm + ' ' + r.chips + ' ' + r.cls + ' ' + r.notes), items: typedKm, save: s0.save });
  said = await save(); await wait(2500);
  const mixAfter = sql("select opening_km || '>' || closing_km || ' ' || opening_hrs || '>' || closing_hrs || ' ' || item_work::text from log_book where id = 'W69-MIX|2026-09-23|Day'");
  ok('   saved: still 1000 → 1020 km and 100 → 104 hr; "Shifting 8 km" is STILL there beside the two rows (Bucket 3, Breaker 1)', /^1000>1020 100>104 /.test(mixAfter) && /"Shifting":8/.test(mixAfter) && /"Breaker":1[,}]/.test(mixAfter) && /"_parts":\[\{"n":"Bucket","q":3[^\]]*\{"n":"Breaker","q":1/.test(mixAfter), { said: said.slice(0, 80), before: mixBefore, after: mixAfter });
  g = await grid(); s0 = await sum(); const prm = await printRows('W69-MIX').catch(e => ({ rows: [], foot: '', box: 'ERROR ' + e.message }));
  ok('   opened again: two rows, nothing marked as changed; the money is Bucket 3 × 1,200 + Breaker 1 × 1,500 + Carting 12 × 40 + Shifting 8 × 60 = 6,060', g.length === 2 && /No changes yet/.test(s0.sum) && g.every(r => !/chg|bad|new/.test(r.cls)) && /6,060\.00/.test(prm.box), { rows: g.map(r => r.ohr + '>' + r.chr + ' ' + r.cls), sum: s0.sum, print: prm.rows.map(r => r.join('¦')).join(' // ').slice(0, 300), box: prm.box.slice(0, 380) });

  // ---------- 5. a machinery without such works keeps the old rule ----------
  await open('W69-TIP');
  g = await grid();
  ok('a machinery with one kind of work (Tipper per KM) has no "+ work in this shift"', g.length === 2 && g.every(r => !r.more), g.map(r => r.date.slice(8) + ' more:' + r.more));
  await f.evaluate(() => { LX.rows.forEach(r => { r._sel = r.date === '2026-09-24'; }); document.getElementById('lx_add').click(); }); await wait(600);
  g = await grid(); const ni = g.findIndex(r => /NEW/.test(r.tag));
  await f.evaluate(i => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f=shift]'); el.value = 'Day'; el.dispatchEvent(new Event('change', { bubbles: true })); }, ni); await wait(600);
  g = await grid(); s0 = await sum();
  ok('   two rows on the same shift are still refused for it: "two entries on Day – make one Day and the other Night", Save off', g.filter(r => /two entries on Day/.test(r.notes)).length === 2 && /\(off\)/.test(s0.save), { notes: g.map(r => r.notes).filter(Boolean), save: s0.save });
  await f.evaluate(() => { S.formDirty = false; LX.rows = []; LX.deleted = []; LX.cut = {}; });

  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
