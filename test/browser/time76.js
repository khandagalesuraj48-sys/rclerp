// update-76 (asked 11-10-2026): "the JCB / excavators we set on HOURS sometimes suddenly give no hour reading – they give the timing
//   instead; so one machine has hours and time in one month and entering it is a problem – fix it with logic".
// One rule everywhere: an hours machinery may have a day on Time (clock From–To). Entry page, Edit Log Book, Excel, print, bill.
// On the local rig only.   node time76.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N76-%'; delete from diesel_issue where machinery like 'N76-%'; delete from boq where vendor_name = 'N76 Vendor'; delete from master where id like 'N76-%'; delete from vendors where vendor_name = 'N76 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const entries = no => sql("select coalesce(string_agg(date || ' ' || shift || ' ' || coalesce(opening_hrs::text, '') || '>' || coalesce(closing_hrs::text, '') || '=' || coalesce(working_hrs::text, '') || ' km ' || coalesce(opening_km::text, '') || '>' || coalesce(closing_km::text, '') || ' ' || coalesce(item_work::text, '') || ' wk[' || coalesce(work_done, '') || '] dsl ' || coalesce(diesel_qty::text, ''), ' ;; ' order by date, shift), '') from log_book where machinery = '" + no + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N76 Vendor', gstReg: 'No', pan: 'ABCDE1276N', bank: 'SBI', account: '12345676', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N76-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 10, tankCap: 300, owner: 'N76 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveLbFormats', { 'N76-JCB': 'D' }));      // his JCB / excavators: the hours format
  E(await api('saveBoq', { vendor: 'N76 Vendor', from: '2026-10-01', tdsPct: 2, woNo: 'WO-N76', lines: [{ no: 'N76-JCB', basis: 'Per Hour', rate: 1000, diesel: 'Company' }] }));
  ok('the test machinery: a JCB on the HOURS format (D), billed per hour (₹1,000), 10 L/hr', !seedErr.length, seedErr.join(' // ') || 'ready');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const okDlg = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(3000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const start = async date => { await f.evaluate(async d => { S.formDirty = false; setLgMode('date'); const dt = document.getElementById('lg_top_date'); dt.value = d; dt.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); clearLogGrid(); }, date); await wait(500); };
  // a row: its machinery and shift (the page then asks the server for its Start, diesel, items)
  const setRow = async (i, no, shift) => { await f.evaluate((i, no, shift) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; const sh = tr.querySelector('[data-f=shift]'); sh.value = shift; const x = tr.querySelector('[data-f=no]'); x.value = no; x.dispatchEvent(new Event('change', { bubbles: true })); }, i, no, shift);
    for (let k = 0; k < 30; k++) { await wait(400); if (await f.evaluate((i, no) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; return !!(tr && tr._p && tr._p.machine.id === no); }, i, no)) break; } await f.evaluate(() => lgCalcAll()); await wait(200); };
  const addRow = async () => { await f.evaluate(() => document.getElementById('l_add1').click()); await wait(400); };
  const setF = async (i, k, v) => { await f.evaluate((i, k, v) => { const el = document.querySelectorAll('#lg_in .lrow')[i].querySelector('[data-f=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); lgCalcAll(); }, i, k, v); await wait(200); };
  const pick = async (i, name) => { await f.evaluate((i, n) => { [...document.querySelectorAll('#lg_in .lrow')[i].querySelectorAll('.itm-chip')].find(c => c.dataset.pick === n).click(); }, i, name); await wait(250); await f.evaluate(() => lgCalcAll()); await wait(150); };
  const rows = () => f.evaluate(() => { lgCalcAll(); return { rows: [...document.querySelectorAll('#lg_in .lrow')].map(tr => { const v = k => (tr.querySelector('[data-f=' + k + ']') || {}).value, o = k => ((tr.querySelector('[data-o=' + k + ']') || {}).textContent || '').trim(), bx = tr.querySelector('.lg-itm'), hf = tr.querySelector('.lg-half'), tg = tr.querySelector('.lg-partn');
      return { no: v('no'), shift: v('shift'), start: v('openingHr'), close: v('closingHr'), okm: v('openingKm'), ckm: v('closingKm'), tot: o('whr') || o('wkm'), red: tr.classList.contains('err'), note: [...tr.querySelectorAll('.lnote')].map(n => n.textContent.trim()).filter(Boolean).join(' | '), chips: bx ? [...bx.querySelectorAll('.itm-chip')].map(c => c.textContent + (c.classList.contains('on') ? '*' : '')).join(' ') : '', issued: o('diesel'), odsl: (tr.querySelector('[data-o=odslCell]') || {}).textContent.trim() || v('openingDiesel'), need: o('need'), closing: o('closing'), half: hf ? !hf.hidden : null, label: tg && !tg.hidden ? tg.textContent : '' }; }),
    sum: document.getElementById('l_gsum').textContent.replace(/\s+/g, ' ').trim() }; });
  const save = async () => { await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } document.getElementById('l_save').click(); }); let s = ''; for (let i = 0; i < 14; i++) { await wait(500); const t = await okDlg(); if (t) s += t + ' / '; }
    return (s + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 420) : ''; if (bx) bx.hidden = true; return ((window.__t || []).join(' | ') + ' ' + [...document.querySelectorAll('.toast, #toast')].map(x => x.textContent).join(' ') + ' ' + t).trim(); })).trim(); };


  const wayInfo = i => f.evaluate(i => { const tr = document.querySelectorAll('#lg_in .lrow')[i], w = tr.querySelector('.way'); return { sel: w ? w.dataset.sel : '', buttons: w ? [...w.querySelectorAll('[data-way]')].map(x => x.dataset.way + (x.classList.contains('dis') ? ':off' : '') + (x.classList.contains('on') ? ':on' : '')) : [], tip: w && w.querySelector('[data-way=Time]') ? w.querySelector('[data-way=Time]').title : '' }; }, i);
  const clickWay = (i, way) => f.evaluate((i, way) => { document.querySelectorAll('#lg_in .lrow')[i].querySelector('.way [data-way="' + way + '"]').click(); }, i, way);
  const dbRows = () => sql("select coalesce(string_agg(to_char(date,'DD') || ' ' || unit || ' ' || coalesce(opening_hrs::text,'') || '>' || coalesce(closing_hrs::text,'') || ' ' || coalesce(start_time::text,'') || '-' || coalesce(end_time::text,'') || ' =' || coalesce(working_hrs::text,''), ' | ' order by date), '') from log_book where machinery = 'N76-JCB'");

  // ---------- 1. the entry page: Hrs picked by itself, Time can be picked ----------
  await start('2026-10-01'); await setRow(0, 'N76-JCB', 'Full Day');
  let w = await wayInfo(0);
  ok('the JCB on the hours format: "Hrs" is picked by itself, and "Time" can now be picked (before: not offered at all); its tip says it is for a day without an hour reading',
    w.sel === 'Hrs' && w.buttons.includes('Hrs:on') && w.buttons.includes('Time') && !w.buttons.some(x => /^KM/.test(x)) && /hour meter gave no reading/.test(w.tip), w);
  await setF(0, 'openingHr', '100'); await setF(0, 'closingHr', '105');
  let sv = await save();
  ok('   01-10 on hours 100 → 105 saved', /^01 Hrs 100>105 -\s*=5$/.test(dbRows()), [sv.slice(0, 160), dbRows()]);
  await start('2026-10-02'); await setRow(0, 'N76-JCB', 'Full Day'); await clickWay(0, 'Time'); await wait(400);
  await setF(0, 'tStart', '09:00'); await setF(0, 'tEnd', '13:00'); await wait(300);
  w = await wayInfo(0); let g = await rows();
  sv = await save();
  ok('02-10 the hour meter gave no reading: Time picked, 09:00 – 13:00 → saved as a Time day of 4 hours (no hour reading)', w.sel === 'Time' && /02 Time >\s+09:00(:00)?-13:00(:00)? =4\b/.test(dbRows()), [w.sel, sv.slice(0, 200), dbRows()]);
  await start('2026-10-03'); await setRow(0, 'N76-JCB', 'Full Day');
  w = await wayInfo(0); g = await rows();
  ok('03-10: back on "Hrs" by itself (not Time), and its Start is 105 – the last hour reading, before the Time day', w.sel === 'Hrs' && g.rows[0].start === '105', { way: w.sel, start: g.rows[0].start });
  await setF(0, 'closingHr', '110'); sv = await save();
  ok('   03-10 105 → 110 saved', /03 Hrs 105>110/.test(dbRows()), dbRows());

  // ---------- 2. Edit Log Book: a NEW row may be on Time; the Time day is shown with its times ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('logedit'); }); await wait(1500);
  const lx = await f.evaluate(async () => { const n = document.getElementById('lx_no'); n.value = 'N76-JCB'; n.dispatchEvent(new Event('change', { bubbles: true })); const fr = document.getElementById('lx_from'), to = document.getElementById('lx_to'); if (fr) fr.value = '2026-10-01'; if (to) to.value = '2026-10-31'; if (typeof lxLoad === 'function') await lxLoad(); await new Promise(r => setTimeout(r, 1500));
    const m = LX && LX.d && LX.d.machine; return { modes: m ? modesOf(m) : null, main: m ? modesMain(m) : null, rows: (LX.rows || []).map(r => r.date.slice(8) + ' ' + lxWay(r) + (r.tStart ? ' ' + r.tStart + '-' + r.tEnd : '')), opts: [...document.querySelectorAll('#lx_body tr')].slice(-1).map(tr => [...(tr.querySelector('select[data-f=mode]') || { options: [] }).options].map(o => o.value)) }; });
  ok('Edit Log Book: the JCB may be entered on Hrs or Time (usual: Hrs); the Time day shows with its times (09:00 – 13:00)', JSON.stringify(lx.modes) === '["Hrs","Time"]' && JSON.stringify(lx.main) === '["Hrs"]' && lx.rows.some(x => /^02 Time 09:00-13:00/.test(x)), lx);

  // ---------- 3. Excel: the columns and the list "Measured by" have Time; a Time row of the JCB is not refused ----------
  const xl = await f.evaluate(() => { const m = findMachine('N76-JCB'); const cols = lbColsFor([m], []); const w = cols.find(c => c.h === 'Measured by') || {};
    return { heads: cols.map(c => c.h), list: (typeof w.list === 'function' ? w.list([0, '2026-10-05', 'N76-JCB']) : []).join(','), blank: w.v ? w.v({ blank: true }) : '', probs: typeof lbProblems === 'function' ? lbProblems({ no: 'N76-JCB', date: '2026-10-05', shift: 'Full Day', mode: 'Time', tStart: '10:00', tEnd: '12:00' }, m) : 'n/a' }; }).catch(e => ({ error: String(e.message).slice(0, 200) }));
  ok('Excel for the JCB: From / To time columns are there, a blank row is filled with "Hrs", and a Time row is not refused ("does not work on")', !xl.error && xl.heads.some(h => /from/i.test(h)) && xl.heads.some(h => /to/i.test(h)) && xl.blank === 'Hrs' && /Hrs,Time/.test(xl.list) && !/does not work on/.test(JSON.stringify(xl.probs)), xl);

  // ---------- 4. the print (format D): the Time day prints its times in the hour columns; TOTAL HOURS counts it ----------
  const got = []; b.on('targetcreated', async t => { try { if (t.type() === 'page') { const pw = await t.page(); if (pw && pw !== p) { await wait(2500);
    const v = await pw.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(s => ({ mach: (s.querySelector('.lb-mach') || {}).textContent, rows: [...s.querySelectorAll('.lb-t tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).join(' | ')), bill: [...s.querySelectorAll('.lb-bill tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()) }))).catch(() => null);
    if (v) got.push(v); await pw.close(); } } } catch (e) {} });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); localStorage.setItem('rcl_print_head', 'Rachana Construction Limited'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-10-01'; document.getElementById('lf_to').value = '2026-10-31'; const n = document.getElementById('lf_no'); n.value = 'N76-JCB'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(2000);
  await f.evaluate(() => document.getElementById('lf_print').click());
  for (let i = 0; i < 24 && !got.length; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
  const sh = (got[0] || []).find(x => /N76-JCB/.test(x.mach || ''));
  const r02 = sh ? sh.rows.find(x => /^\d+ \| 02/.test(x) || / 02-10-2026 /.test(' ' + x + ' ') || /02\/10|02-10/.test(x)) : '';
  ok('the Log Book print (hours format D): the Time day prints 09:00 and 13:00 in the hour columns with 4 hours; TOTAL HOURS = 14 (5 + 4 + 5)', !!sh && /09:00/.test(r02 || '') && /13:00/.test(r02 || '') && sh.bill.some(x => /TOTAL HOURS\s*14\b/.test(x)), sh ? { row02: r02, bill: sh.bill.slice(0, 4) } : 'no print');

  // (the bill per hour of such a month: proved in the unit test – 16.5 h × ₹1,000 = ₹16,500)
  ok('no script error on the page', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
