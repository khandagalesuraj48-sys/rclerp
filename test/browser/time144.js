// update-144 (asked 23-10-2026, his screen of a JCB in Edit Log Book: 28-09 Day Bucket by Time 14:00 – 18:00, "+ work in this shift"
//   Breaker by Time 09:00 – 13:00 – red "the rows of this shift are all by Time"; "ase error nko n yeyla"): a shift of a machinery on
//   hours whose rows are ALL by Time is one entry by Time – each row its own work and From – To; two rows at the same time are refused.
// Real pages: Edit Log Book, the Log Book entry page (also a row added to a saved shift – update-143), the edit window, the print.
// On the local rig only.   node time144.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N144-%'; delete from diesel_issue where machinery like 'N144-%'; delete from boq where vendor_name = 'N144 Vendor'; delete from master where id like 'N144-%'; delete from vendors where vendor_name = 'N144 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
// one line per entry: date shift unit hours slots | the works of its rows
const ent = d => sql("select coalesce(string_agg(to_char(date,'DD') || ' ' || shift || ' ' || unit || ' ' || coalesce(working_hrs::text,'') || 'h ' || coalesce(time_slots,'') || ' ' || coalesce(item_work::text,''), ' || ' order by date, shift), '') from log_book where machinery = 'N144-JCB'" + (d ? " and date = '2026-09-" + d + "'" : ''));
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N144 Vendor', gstReg: 'No', pan: 'ABCDE1244N', bank: 'SBI', account: '12345144', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N144-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 4, tankCap: 300, owner: 'N144 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveLbFormats', { 'N144-JCB': 'D' }));
  // his BOQ of 23-10-2026: BUCKET 1,200 / hr "rest of the entry", BREAKER 1,700 / hr "typed in the Log Book"
  E(await api('saveBoq', { vendor: 'N144 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-N144', lines: [{ no: 'N144-JCB', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'BUCKET', basis: 'Per Hour', rate: 1200, qty: 'rest' }, { name: 'BREAKER', basis: 'Per Hour', rate: 1700, qty: 'typed' }] }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N144-JCB', date: '2026-09-27', shift: 'Day', mode: 'Hrs', openingHr: 3710, closingHr: 3714.5, items: {} }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N144-JCB', date: '2026-09-28', shift: 'Day', mode: 'Time', tStart: '14:00', tEnd: '18:00', items: { _all: 'BUCKET' }, work: 'LOADING' }] }));
  ok('the test machinery: a JCB on hours (format D), BUCKET ₹1,200 / BREAKER ₹1,700 per hour; 27-09 3710 → 3714.5; 28-09 Day saved: BUCKET by Time 14:00 – 18:00', !seedErr.length && /^28 Day Time 4h\b/.test(ent('28')), seedErr.join(' // ') || ent('28'));

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_back').textContent.replace(/\s+/g, ' ').slice(0, 400); document.getElementById('cf_ok').click(); return t; } return ''; });

  // ---------- 1. Edit Log Book – his screen ----------
  const open = async (from, to) => { await f.evaluate(async (from, to) => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = from; document.getElementById('lx_to').value = to; const n = document.getElementById('lx_no'); n.value = 'N144-JCB'; n.dispatchEvent(new Event('change', { bubbles: true })); await lxLoad(); }, from, to); await wait(1200); };
  const grid = () => f.evaluate(() => { lxCalc(); return { rows: [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)], g = k => { const i = tr.querySelector('[data-f="' + k + '"]'); return i ? i.value : ''; };
    return r.date.slice(8) + ' ' + lxWay(r) + ' ' + (lxWay(r) === 'Time' ? g('tStart') + '-' + g('tEnd') : g('ohr') + '>' + g('chr')) + ' ' + (lxPickOf(r, 'hr') || '?') + ' =' + tr.querySelector('.tot').textContent.replace(/\s+/g, '') + (tr.classList.contains('bad') ? ' RED' : '') + ' [' + [...tr.querySelectorAll('.lx-note')].map(n => n.textContent.trim()).join(' / ') + ']'; }),
    foot: document.getElementById('lx_foot').textContent.replace(/\s+/g, ' ').trim(), save: document.getElementById('lx_save').disabled ? 'off' : 'on', all: document.getElementById('lx_panel').textContent.replace(/\s+/g, ' ') }; });
  const lxSet = (i, k, v) => f.evaluate((i, k, v) => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="' + k + '"]'); el.value = v; ['input', 'change'].forEach(n => el.dispatchEvent(new Event(n, { bubbles: true }))); }, i, k, v);
  const chip = async (i, name) => { await f.evaluate((i, name) => { [...document.querySelectorAll('#lx_rows tr[data-i="' + i + '"] .itm-chip')].find(c => c.dataset.pick === name).click(); }, i, name); await wait(400); };
  const lxSave = async () => { const said = []; await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } document.getElementById('lx_save').click(); }); for (let i = 0; i < 24; i++) { await wait(500); const t = await yes(); if (t) said.push(t); } await wait(1500); return said.concat(await f.evaluate(() => window.__t || [])).join(' // '); };
  await open('2026-09-28', '2026-09-28');
  const more = await f.evaluate(() => { const b0 = document.querySelector('#lx_rows tr[data-i="0"] .lx-more'); if (!b0) return false; b0.click(); return true; }); await wait(700);
  const way1 = await f.evaluate(() => lxWay(LX.rows[1]));
  if (way1 !== 'Time') { await lxSet(1, 'mode', 'Time'); await wait(400); }
  await lxSet(1, 'tStart', '09:00'); await lxSet(1, 'tEnd', '13:00'); await chip(1, 'BREAKER');
  let x = await grid();
  ok('Edit Log Book, his screen: "+ work in this shift" → row 2 Breaker by Time 09:00 – 13:00 under Bucket 14:00 – 18:00 – NO red, no "all by Time"; total 8 hr; Save on',
    more && x.rows.length === 2 && !/RED/.test(x.rows.join()) && !/all by Time/.test(x.all) && /^28 Time 14:00-18:00 BUCKET =4hr/.test(x.rows[0]) && /^28 Time 09:00-13:00 BREAKER =4hr/.test(x.rows[1]) && /8 hr/.test(x.foot) && x.save === 'on', x);
  let sv = await lxSave();
  ok('   saved: ONE entry by Time 8 h – times 09:00-13:00,14:00-18:00; its rows in the order of the day: BREAKER 4 (09–13), BUCKET 4 (14–18); BREAKER 4 typed for the bill',
    /^28 Day Time 8h 09:00-13:00,14:00-18:00 /.test(ent('28')) && /"BREAKER":\s*4/.test(ent('28')) && /"n":\s*"BREAKER".*"ts":\s*"09:00-13:00".*"n":\s*"BUCKET".*"ts":\s*"14:00-18:00"/.test(ent('28')), [ent('28'), sv.slice(0, 300)]);
  await open('2026-09-28', '2026-09-28'); x = await grid();
  ok('   opened again: the two rows, Breaker 09:00 – 13:00 first, then Bucket 14:00 – 18:00; total 8 hr; nothing red',
    x.rows.length === 2 && /^28 Time 09:00-13:00 BREAKER =4hr/.test(x.rows[0]) && /^28 Time 14:00-18:00 BUCKET =4hr/.test(x.rows[1]) && /8 hr/.test(x.foot) && !/RED/.test(x.rows.join()), x);
  // two rows at the same time: red with the reason, Save off; back to 13:00 – fine again
  await lxSet(0, 'tEnd', '15:00'); x = await grid();
  ok('   Breaker To → 15:00 (into Bucket 14:00 – 18:00): red "is at the same time as row 2 … a machinery does one work at a time"; Save off',
    /RED/.test(x.rows[0]) && /this row \(09:00 – 15:00\) is at the same time as row 2 of this shift \(14:00 – 18:00\) – a machinery does one work at a time/.test(x.rows.join()) && x.save === 'off', x);
  await lxSet(0, 'tEnd', '13:00'); x = await grid();
  ok('   back to 13:00: nothing red; total 8 hr (the grid is as saved again – nothing to save)', !/RED/.test(x.rows.join()) && /8 hr/.test(x.foot), x);

  // ---------- 2. the Log Book entry page ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; showTab('log'); }); await wait(2500); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const start = async date => { await f.evaluate(async d => { S.formDirty = false; setLgMode('date'); const dt = document.getElementById('lg_top_date'); dt.value = d; dt.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); clearLogGrid(); }, date); await wait(500); };
  const setRow = async (i, no, shift) => { await f.evaluate((i, no, shift) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; const sh = tr.querySelector('[data-f=shift]'); sh.value = shift; const x = tr.querySelector('[data-f=no]'); x.value = no; x.dispatchEvent(new Event('change', { bubbles: true })); }, i, no, shift);
    for (let k = 0; k < 30; k++) { await wait(400); if (await f.evaluate((i, no) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; return !!(tr && tr._p && tr._p.machine.id === no); }, i, no)) break; } await f.evaluate(() => lgCalcAll()); await wait(200); };
  const addRow = async () => { await f.evaluate(() => document.getElementById('l_add1').click()); await wait(400); };
  const setF = async (i, k, v) => { await f.evaluate((i, k, v) => { const el = document.querySelectorAll('#lg_in .lrow')[i].querySelector('[data-f=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); lgCalcAll(); }, i, k, v); await wait(200); };
  const rows = () => f.evaluate(() => { lgCalcAll(); return [...document.querySelectorAll('#lg_in .lrow')].map(tr => { const o = k => ((tr.querySelector('[data-o=' + k + ']') || {}).textContent || '').trim(), tg = tr.querySelector('.lg-partn');
    return { tot: o('whr'), red: tr.classList.contains('err'), note: [...tr.querySelectorAll('.lnote')].map(n => n.textContent.trim()).filter(Boolean).join(' | '), issued: o('diesel'), label: tg && !tg.hidden ? tg.textContent : '' }; }); });
  const save = async () => { await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } document.getElementById('l_save').click(); }); let s = ''; for (let i = 0; i < 14; i++) { await wait(500); const t = await yes(); if (t) s += t + ' / '; }
    return (s + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 420) : ''; if (bx) bx.hidden = true; return ((window.__t || []).join(' | ') + ' ' + t).trim(); })).trim(); };
  const clickWay = (i, way) => f.evaluate((i, way) => { document.querySelectorAll('#lg_in .lrow')[i].querySelector('.way [data-way="' + way + '"]').click(); }, i, way);
  const pick = async (i, name) => { await f.evaluate((i, n) => { [...document.querySelectorAll('#lg_in .lrow')[i].querySelectorAll('.itm-chip')].find(c => c.dataset.pick === n).click(); }, i, name); await wait(250); await f.evaluate(() => lgCalcAll()); await wait(150); };
  await start('2026-09-29'); await setRow(0, 'N144-JCB', 'Day'); await clickWay(0, 'Time'); await wait(400);
  await setF(0, 'tStart', '14:00'); await setF(0, 'tEnd', '18:00'); await pick(0, 'BUCKET');
  await addRow(); await setRow(1, 'N144-JCB', 'Day'); await clickWay(1, 'Time'); await wait(400); await setF(1, 'tStart', '09:00'); await setF(1, 'tEnd', '13:00'); await pick(1, 'BREAKER');
  let g = await rows();
  ok('entry page 29-09: Bucket by Time 14:00 – 18:00 and Breaker by Time 09:00 – 13:00, the same Day – no red, no "already in another row"; row 2 "work 2 of this day", its diesel 0',
    !g[0].red && !g[1].red && !/already in another row|all by Time/.test(g.map(z => z.note).join(' ')) && /work 2/.test(g[1].label) && g[1].issued === '0' && /^4/.test(g[0].tot) && /^4/.test(g[1].tot), g);
  await setF(1, 'tEnd', '15:00'); g = await rows();
  ok('   Breaker To → 15:00: red "This row (09:00 – 15:00) is at the same time as work 1 of this day (14:00 – 18:00)"', g[1].red && /This row \(09:00 – 15:00\) is at the same time as work 1 of this day \(14:00 – 18:00\) – a machinery does one work at a time/.test(g[1].note), g);
  await setF(1, 'tEnd', '13:00'); sv = await save();
  ok('   back to 13:00 and saved: ONE entry by Time 8 h, its rows in the order of the day (BREAKER, BUCKET)', /^29 Day Time 8h 09:00-13:00,14:00-18:00 /.test(ent('29')) && /"n":\s*"BREAKER".*"n":\s*"BUCKET"/.test(ent('29')), [ent('29'), sv.slice(0, 300)]);

  // ---------- 3. a third work of 28-09 from the entry page: added to the saved shift (update-143) ----------
  await start('2026-09-28'); await setRow(0, 'N144-JCB', 'Day'); await clickWay(0, 'Time'); await wait(400);
  await setF(0, 'tStart', '18:30'); await setF(0, 'tEnd', '20:00'); await pick(0, 'BREAKER');
  g = await rows();
  ok('entry page 28-09 (saved): a row Breaker by Time 18:30 – 20:00 – "already saved – this row is added to it as work 3", not red', !g[0].red && /already saved – this row is added to it as work 3/.test(g[0].note) && /work 3/.test(g[0].label), g);
  sv = await save();
  ok('   saved into that entry: 9.5 h, three rows (BREAKER, BUCKET, BREAKER), times 09:00-13:00,14:00-18:00,18:30-20:00', /^28 Day Time 9\.5h 09:00-13:00,14:00-18:00,18:30-20:00 /.test(ent('28')) && /"BREAKER":\s*5\.5/.test(ent('28')) && /1 work was added/.test(sv), [ent('28'), sv.slice(0, 300)]);
  await start('2026-09-28'); await setRow(0, 'N144-JCB', 'Day'); await clickWay(0, 'Time'); await wait(400);
  await setF(0, 'tStart', '17:00'); await setF(0, 'tEnd', '19:00'); await pick(0, 'BUCKET');
  sv = await save();
  ok('   a time inside the saved ones (17:00 – 19:00): refused "already in the saved entry of this shift" – nothing changed', /already in the saved entry of this shift/.test(sv) && /^28 Day Time 9\.5h /.test(ent('28')), [sv.slice(0, 300), ent('28')]);
  await f.evaluate(() => { S.formDirty = false; clearLogGrid(); }); await wait(300);

  // ---------- 4. the edit window: its From – To are its rows' times (changed row by row in Edit Log Book) ----------
  const k1 = await f.evaluate(async () => (await call('getLogBookList', { from: '2026-09-28', to: '2026-09-28', no: 'N144-JCB', all: true })).rows[0].key);
  await f.evaluate(async k => { showTab('log'); await openLogEdit(k); }, k1); await wait(800);
  const le = await f.evaluate(() => ({ ro: ['le_ts', 'le_te', 'le_tb'].map(id => document.getElementById(id).readOnly), add: document.getElementById('le_xadd').hidden, xs: [...document.querySelectorAll('#le_xs input')].every(i => i.readOnly), note: document.getElementById('le_note').textContent, parts: [...document.querySelectorAll('#le_box .le-parts')].map(z => z.textContent).join(' ') }));
  ok('edit window of 28-09: From, To and Break locked, no "+ time"; total 9.5 hr; its rows named by Time', le.ro.every(Boolean) && le.add && le.xs && /Total for this entry: 9\.5 hr/.test(le.note) && /BREAKER 4 hr \(by Time 09:00–13:00\)/.test(le.parts), le);
  await f.evaluate(() => document.getElementById('le_cancel').click()); await wait(300);

  // ---------- 5. the print: 28-09 as its three rows with their times; TOTAL HOURS 22; payable ----------
  const got = []; b.on('targetcreated', async t => { try { if (t.type() === 'page') { const pw = await t.page(); if (pw && pw !== p) { await wait(2500);
    const v = await pw.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(s => ({ mach: (s.querySelector('.lb-mach') || {}).textContent, rows: [...s.querySelectorAll('.lb-t tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).join(' | ')), bill: [...s.querySelectorAll('.lb-bill tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()) }))).catch(() => null);
    if (v) got.push(v); await pw.close(); } } } catch (e) {} });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); localStorage.setItem('rcl_print_head', 'Rachana Construction Limited'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n = document.getElementById('lf_no'); n.value = 'N144-JCB'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(2000);
  await f.evaluate(() => document.getElementById('lf_print').click());
  for (let i = 0; i < 24 && !got.length; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
  const sh = (got[0] || []).find(z => /N144-JCB/.test(z.mach || ''));
  const r28 = sh ? sh.rows.filter(z => /28-09-2026/.test(z)) : [];
  // BUCKET 4.5 (27-09, the rest) + 4 + 4 = 12.5 hr × 1,200 = 15,000; BREAKER 5.5 + 4 = 9.5 hr × 1,700 = 16,150 → 31,150
  ok('the print: 28-09 as three rows (09:00 / 13:00, 14:00 / 18:00, 18:30 / 20:00); TOTAL HOURS 22 (4.5 + 9.5 + 8); payable ₹31,150', !!sh && r28.length === 3 && /09:00.*13:00/.test(r28[0]) && /14:00.*18:00/.test(r28[1]) && /18:30.*20:00/.test(r28[2]) && sh.bill.some(z => /TOTAL HOURS\s*22\b/.test(z)) && sh.bill.some(z => /31,150/.test(z)), sh ? { rows: r28, bill: sh.bill.slice(0, 8) } : 'no print');

  ok('no script error on the page', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
