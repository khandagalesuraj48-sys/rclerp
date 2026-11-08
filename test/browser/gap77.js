// update-77 (asked 11-10-2026): "the same machinery, the same day, Breaker worked two times – if the readings are different it must be
//   accepted; when I edit the entry of the 3rd, the 2nd must not change, nor the 4th – only for machinery". His answers: the hours
//   between the rows are NOT counted; a Close above the next entry's Start stops the save; only machinery on hours.
// Real pages: the Log Book entry page, Edit Log Book, the small edit window, the print, the Excel sheet.
// On the local rig only.   node gap77.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N77-%'; delete from diesel_issue where machinery like 'N77-%'; delete from boq where vendor_name = 'N77 Vendor'; delete from master where id like 'N77-%'; delete from vendors where vendor_name = 'N77 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const db = () => sql("select coalesce(string_agg(to_char(date,'DD') || ' ' || coalesce(opening_hrs::text,'') || '>' || coalesce(closing_hrs::text,'') || '=' || coalesce(working_hrs::text,''), ' | ' order by date, shift), '') from log_book where machinery = 'N77-BRK'");
const parts = d => sql("select coalesce(item_work::text,'') from log_book where machinery = 'N77-BRK' and date = '2026-10-" + d + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N77 Vendor', gstReg: 'No', pan: 'ABCDE1277N', bank: 'SBI', account: '12345677', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N77-BRK', name: 'Breaker', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 10, tankCap: 300, owner: 'N77 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'N77 Vendor', from: '2026-10-01', tdsPct: 2, woNo: 'WO-N77', lines: [{ no: 'N77-BRK', basis: 'Per Hour', rate: 1000, diesel: 'Company' }] }));
  ok('the test machinery: a Breaker on hours, billed per hour (₹1,000), 10 L/hr', !seedErr.length, seedErr.join(' // ') || 'ready');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_back').textContent.replace(/\s+/g, ' ').slice(0, 400); document.getElementById('cf_ok').click(); return t; } return ''; });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(3000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const start = async date => { await f.evaluate(async d => { S.formDirty = false; setLgMode('date'); const dt = document.getElementById('lg_top_date'); dt.value = d; dt.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); clearLogGrid(); }, date); await wait(500); };
  const setRow = async (i, no, shift) => { await f.evaluate((i, no, shift) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; const sh = tr.querySelector('[data-f=shift]'); sh.value = shift; const x = tr.querySelector('[data-f=no]'); x.value = no; x.dispatchEvent(new Event('change', { bubbles: true })); }, i, no, shift);
    for (let k = 0; k < 30; k++) { await wait(400); if (await f.evaluate((i, no) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; return !!(tr && tr._p && tr._p.machine.id === no); }, i, no)) break; } await f.evaluate(() => lgCalcAll()); await wait(200); };
  const addRow = async () => { await f.evaluate(() => document.getElementById('l_add1').click()); await wait(400); };
  const setF = async (i, k, v) => { await f.evaluate((i, k, v) => { const el = document.querySelectorAll('#lg_in .lrow')[i].querySelector('[data-f=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); lgCalcAll(); }, i, k, v); await wait(200); };
  const rows = () => f.evaluate(() => { lgCalcAll(); return [...document.querySelectorAll('#lg_in .lrow')].map(tr => { const v = k => (tr.querySelector('[data-f=' + k + ']') || {}).value, o = k => ((tr.querySelector('[data-o=' + k + ']') || {}).textContent || '').trim(), tg = tr.querySelector('.lg-partn'), gh = tr.querySelector('.gaphint');
    return { start: v('openingHr'), close: v('closingHr'), tot: o('whr'), red: tr.classList.contains('err'), note: [...tr.querySelectorAll('.lnote')].map(n => n.textContent.trim()).filter(Boolean).join(' | '), gap: gh && !gh.hidden ? gh.textContent : '', issued: o('diesel'), label: tg && !tg.hidden ? tg.textContent : '' }; }); });
  const save = async () => { await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } document.getElementById('l_save').click(); }); let s = ''; for (let i = 0; i < 14; i++) { await wait(500); const t = await yes(); if (t) s += t + ' / '; }
    return (s + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 420) : ''; if (bx) bx.hidden = true; return ((window.__t || []).join(' | ') + ' ' + t).trim(); })).trim(); };

  // ---------- 1. the entry page: Breaker 100 → 102, then again 110 → 113 in the same shift ----------
  await start('2026-10-01'); await setRow(0, 'N77-BRK', 'Full Day');
  await setF(0, 'openingHr', '100'); await setF(0, 'closingHr', '102');
  await addRow(); await setRow(1, 'N77-BRK', 'Full Day');
  let g = await rows();
  ok('entry page: a second row of the same Breaker, date and shift is offered as "work 2 of this day", its Start proposed at the Close above (102)', g[1].start === '102' && /work 2/.test(g[1].label), g);
  await setF(1, 'openingHr', '101'); await setF(1, 'closingHr', '103'); g = await rows();
  ok('   a Start BELOW the Close of the row above (101 < 102) is red', g[1].red && /less than the last Close/.test(g[1].note), g[1]);
  await setF(1, 'openingHr', '110'); await setF(1, 'closingHr', '113'); g = await rows();
  ok('   Start 110 (above 102): accepted – "8 hr not worked between the rows – not counted", the row is 3 hours, nothing red', !g[0].red && !g[1].red && g[1].tot.startsWith('3') && /8 hr not worked between the rows/.test(g[1].gap), g);
  let sv = await save();
  ok('   saved as ONE entry 100 → 113 of 5 hours (not 13); its rows kept with the 8 hours not worked', db() === '01 100>113=5' && /"g":\s*8/.test(parts('01')), [db(), parts('01'), sv.slice(0, 200)]);
  await start('2026-10-02'); await setRow(0, 'N77-BRK', 'Full Day'); g = await rows();
  ok('02-10: the next day starts at 113 (the last Close)', g[0].start === '113', g[0]);
  await setF(0, 'closingHr', '116'); sv = await save();
  E(await api('saveLogRows', { rows: [{ no: 'N77-BRK', date: '2026-10-03', shift: 'Full Day', mode: 'Hrs', openingHr: 116, closingHr: 120, driver: '', work: '' }] }));
  ok('   02-10 113 → 116 and 03-10 116 → 120 saved', db() === '01 100>113=5 | 02 113>116=3 | 03 116>120=4', [db(), sv.slice(0, 200), seedErr]);

  // ---------- 2. Edit Log Book ----------
  const open = async (from, to) => { await f.evaluate(async (from, to) => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = from; document.getElementById('lx_to').value = to; const n = document.getElementById('lx_no'); n.value = 'N77-BRK'; n.dispatchEvent(new Event('change', { bubbles: true })); await lxLoad(); }, from, to); await wait(1200); };
  const grid = () => f.evaluate(() => { lxCalc(); return { rows: [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)], g = k => { const i = tr.querySelector('[data-f="' + k + '"]'); return i ? i.value : ''; };
    return r.date.slice(8) + ' ' + g('ohr') + '>' + g('chr') + ' =' + tr.querySelector('.tot').textContent.replace(/\s+/g, '') + (tr.classList.contains('bad') ? ' RED' : '') + ' [' + [...tr.querySelectorAll('.lx-note')].map(n => n.textContent.trim()).join(' / ') + ']'; }),
    foot: document.getElementById('lx_foot').textContent.replace(/\s+/g, ' ').trim(), save: document.getElementById('lx_save').disabled ? 'off' : 'on' }; });
  const lxSet = (dd, j, k, v) => f.evaluate((dd, j, k, v) => { const i = LX.rows.map((r, n) => [r, n]).filter(x => x[0].date === '2026-10-' + dd)[j][1]; const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="' + k + '"]'); el.value = v; ['input', 'change'].forEach(n => el.dispatchEvent(new Event(n, { bubbles: true }))); }, dd, j, k, v);
  const lxSave = async () => { const said = []; await f.evaluate(() => { window.__t = []; document.getElementById('lx_save').click(); }); for (let i = 0; i < 24; i++) { await wait(500); const t = await yes(); if (t) said.push(t); } await wait(1500); return said.concat(await f.evaluate(() => window.__t || [])).join(' // '); };
  await open('2026-10-01', '2026-10-03');
  let x = await grid();
  ok('Edit Log Book: the 1st comes back as its two rows 100 → 102 and 110 → 113 ("8 hr not worked between the rows"), then 113 → 116 and 116 → 120; total 12 hr', x.rows.length === 4 && /^01 100>102 =2hr/.test(x.rows[0]) && /^01 110>113 =3hr.*8 hr not worked between the rows/.test(x.rows[1]) && /^02 113>116 =3hr/.test(x.rows[2]) && /^03 116>120 =4hr/.test(x.rows[3]) && /12 hr/.test(x.foot), x);
  await lxSet('02', 0, 'chr', '117'); x = await grid();
  ok('   Close of the 2nd → 117: the 3rd is NOT moved (still 116 → 120) – it turns red ("Start cannot be less than 117"), Save is off', /^03 116>120/.test(x.rows[3]) && / RED/.test(x.rows[3]) && /Start cannot be less than 117/.test(x.rows[3]) && x.save === 'off', x);
  await lxSet('02', 0, 'chr', '115.5'); await lxSet('01', 1, 'ohr', '108'); x = await grid();
  ok('   Close of the 2nd → 115.5: the 3rd still 116 (not moved, not red); the 2nd row of the 1st starts at 108 → 6 hr not worked, that row 5 hr', /^03 116>120 =4hr \[/.test(x.rows[3]) && !/RED/.test(x.rows.join()) && /^01 108>113 =5hr.*6 hr not worked/.test(x.rows[1]) && x.save === 'on', x);
  sv = await lxSave();
  ok('   saved: 1st 100 → 113 = 7 h (2 + 5), 2nd 113 → 115.5, 3rd unchanged 116 → 120; the confirm said the entry after is not changed', db() === '01 100>113=7 | 02 113>115.5=2.5 | 03 116>120=4' && /"g":\s*6/.test(parts('01')), [db(), parts('01'), sv.slice(0, 500)]);
  // only the 2nd in the grid: the entry after it (the 3rd, outside) is never changed – a Close above its Start is red here
  await open('2026-10-02', '2026-10-02');
  await lxSet('02', 0, 'chr', '117'); x = await grid();
  ok('   the 2nd alone in the grid, its Close → 117: red "Close cannot be more than 116 – the Start of the entry of 03-10-2026", Save off', / RED/.test(x.rows[0]) && /Close cannot be more than 116 – the Start of the entry of 03-10-2026/.test(x.rows[0]) && x.save === 'off', x);
  await f.evaluate(() => { S.formDirty = false; LX.rows = []; LX.deleted = []; });

  // ---------- 3. the small edit window ----------
  const list = await f.evaluate(async () => (await call('getLogBookList', { from: '2026-10-01', to: '2026-10-03', no: 'N77-BRK', all: true })).rows.map(r => ({ d: r.date, key: r.key, whr: r.whr, parts: (r.itemParts || []).map(p => p.q + (p.g ? '+g' + p.g : '')).join(',') })));
  const k1 = (list.find(r => r.d === '2026-10-01') || {}).key, k2 = (list.find(r => r.d === '2026-10-02') || {}).key;
  await f.evaluate(async k => { showTab('log'); await openLogEdit(k); }, k1); await wait(800);
  let le = await f.evaluate(() => ({ ro: document.getElementById('le_chr').readOnly && document.getElementById('le_ohr').readOnly, note: document.getElementById('le_note').textContent, rows: (document.getElementById('le_rows77') || {}).textContent || '' }));
  ok('edit window of the 1st (rows with hours not worked): total 7 hr (6 hr between not counted); Start / Close locked, "changed in Edit Log Book, row by row"', le.ro && /Total for this entry: 7 hr/.test(le.note) && /6 hr between its rows not worked/.test(le.note) && /2 hr, then 5 hr \(after 6 hr not worked\)/.test(le.rows) && /Edit Log Book/.test(le.rows), [le, list]);
  await f.evaluate(() => document.getElementById('le_cancel').click()); await wait(300);
  await f.evaluate(async k => { await openLogEdit(k); }, k2); await wait(800);
  await f.evaluate(() => { const c = document.getElementById('le_chr'); c.value = '118'; c.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  le = await f.evaluate(() => document.getElementById('le_note').textContent);
  ok('edit window of the 2nd, Close 118: "Close cannot be more than 116 – the Start of the next entry 03-10-2026 … not changed by itself"', /Close cannot be more than 116 – the Start of the next entry 03-10-2026/.test(le), le);
  await f.evaluate(() => { const c = document.getElementById('le_chr'); c.value = '115'; c.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  le = await f.evaluate(() => document.getElementById('le_note').textContent);
  await f.evaluate(() => document.getElementById('le_save').click()); for (let i = 0; i < 10; i++) { await wait(500); await yes(); }
  ok('   Close 115: "the next entry keeps its Start 116"; saved – the 3rd unchanged', /keeps its Start 116/.test(le) && db() === '01 100>113=7 | 02 113>115=2 | 03 116>120=4', [le, db()]);

  // ---------- 3b. Edit Log Book, a machinery without an item-wise BOQ: "+ work in this shift" is there (under the Close) ----------
  await open('2026-10-02', '2026-10-02');
  const more = await f.evaluate(() => { const b0 = document.querySelector('#lx_rows tr[data-i="0"] .lx-more'); if (!b0) return false; b0.click(); return true; }); await wait(600);
  await lxSet('02', 1, 'ohr', '115.5'); await lxSet('02', 1, 'chr', '116'); x = await grid();
  ok('   "+ work in this shift" (no item BOQ): a second row of the 2nd, 115.5 → 116 – "0.5 hr not worked between the rows"; nothing red', more && x.rows.length === 2 && /^02 115\.5>116 =0\.5hr.*0\.5 hr not worked between the rows/.test(x.rows[1]) && !/RED/.test(x.rows.join()) && x.save === 'on', x);
  sv = await lxSave();
  ok('   saved: the 2nd is 113 → 116 = 2.5 h (2 + 0.5); the 3rd unchanged', db() === '01 100>113=7 | 02 113>116=2.5 | 03 116>120=4' && /"g":\s*0\.5/.test(parts('02')), [db(), parts('02'), sv.slice(0, 300)]);

  // ---------- 4. the Excel sheet: Total Hrs of the 1st is Close − Start less the 6 hours not worked ----------
  const xl = await f.evaluate(async () => { const rs = (await call('getLogBookList', { from: '2026-10-01', to: '2026-10-03', no: 'N77-BRK', all: true })).rows; const cols = lbColsFor([findMachine('N77-BRK')], rs); const sh = lbSheet('t', 't', cols, rs, false), ti = cols.findIndex(c => c.h === 'Total Hrs');
    return sh.aoa.filter(r => Array.isArray(r) && /01-10-2026|02-10-2026/.test(String(r[0]))).map(r => String(r[0]) + ' ' + JSON.stringify(r[ti])); });
  const x01 = xl.find(z => /^01-10/.test(z)) || '', x02 = xl.find(z => /^02-10/.test(z)) || '';
  ok('Excel: Total Hrs of the 1st = Close − Start − 6 (shows 7), of the 2nd Close − Start − 0.5 (2.5)', xl.length === 2 && /-6,/.test(x01) && /"result":7/.test(x01) && /-0\.5,/.test(x02) && /"result":2\.5/.test(x02), xl);

  // ---------- 5. the print: the 1st as its two rows; TOTAL HOURS 13 (7 + 2 + 4); payable ₹13,000 ----------
  const got = []; b.on('targetcreated', async t => { try { if (t.type() === 'page') { const pw = await t.page(); if (pw && pw !== p) { await wait(2500);
    const v = await pw.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(s => ({ mach: (s.querySelector('.lb-mach') || {}).textContent, rows: [...s.querySelectorAll('.lb-t tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).join(' | ')), bill: [...s.querySelectorAll('.lb-bill tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()) }))).catch(() => null);
    if (v) got.push(v); await pw.close(); } } } catch (e) {} });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); localStorage.setItem('rcl_print_head', 'Rachana Construction Limited'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-10-01'; document.getElementById('lf_to').value = '2026-10-31'; const n = document.getElementById('lf_no'); n.value = 'N77-BRK'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(2000);
  await f.evaluate(() => document.getElementById('lf_print').click());
  for (let i = 0; i < 24 && !got.length; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
  const sh = (got[0] || []).find(z => /N77-BRK/.test(z.mach || ''));
  const body = sh ? sh.rows.filter(z => /\| 100 \| 102 \||\| 108 \| 113 \|/.test(' ' + z + ' ')) : [];
  ok('the print: the 1st as two rows (100 → 102 and 108 → 113); TOTAL HOURS 13.5 (7 + 2.5 + 4); payable ₹13,500', !!sh && body.length === 2 && sh.bill.some(z => /TOTAL HOURS\s*13\.5\b/.test(z)) && sh.bill.some(z => /13,500/.test(z)), sh ? { rows: sh.rows.slice(0, 8), bill: sh.bill.slice(0, 6) } : 'no print');

  ok('no script error on the page', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
