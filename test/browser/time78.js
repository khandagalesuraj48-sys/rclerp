// update-78 (asked 11-10-2026, his screen of MH-04-MN-7725: row 1 Bucket on TIME, row 2 Breaker on HRS, the same Day shift – both were red
//   "already in another row"; "in one shift it can be so"): rows by Time among the rows by Hrs of a machinery on hours; their hours are added.
// Real pages: the Log Book entry page, Edit Log Book, the small edit window, the print, the Excel sheet.
// On the local rig only.   node gap77.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N78-%'; delete from diesel_issue where machinery like 'N78-%'; delete from boq where vendor_name = 'N78 Vendor'; delete from master where id like 'N78-%'; delete from vendors where vendor_name = 'N78 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const db = () => sql("select coalesce(string_agg(to_char(date,'DD') || ' ' || coalesce(opening_hrs::text,'') || '>' || coalesce(closing_hrs::text,'') || '=' || coalesce(working_hrs::text,''), ' | ' order by date, shift), '') from log_book where machinery = 'N78-BRK'");
const parts = d => sql("select coalesce(item_work::text,'') from log_book where machinery = 'N78-BRK' and date = '2026-10-" + d + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N78 Vendor', gstReg: 'No', pan: 'ABCDE1278N', bank: 'SBI', account: '12345678', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N78-BRK', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 4, tankCap: 300, owner: 'N78 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveLbFormats', { 'N78-BRK': 'D' }));
  E(await api('saveBoq', { vendor: 'N78 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-N78', lines: [{ no: 'N78-BRK', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }] }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N78-BRK', date: '2026-09-30', shift: 'Day', mode: 'Hrs', openingHr: 3710, closingHr: 3714.5, items: {} }] }));
  ok('the test machinery: a JCB on hours (format D: Hrs, and Time), Bucket ₹1,200 / Breaker ₹1,500 per hour, 4 L/hr; 30-09 3710 → 3714.5', !seedErr.length, seedErr.join(' // ') || 'ready');

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

  const clickWay = (i, way) => f.evaluate((i, way) => { document.querySelectorAll('#lg_in .lrow')[i].querySelector('.way [data-way="' + way + '"]').click(); }, i, way);
  const pick = async (i, name) => { await f.evaluate((i, n) => { [...document.querySelectorAll('#lg_in .lrow')[i].querySelectorAll('.itm-chip')].find(c => c.dataset.pick === n).click(); }, i, name); await wait(250); await f.evaluate(() => lgCalcAll()); await wait(150); };

  // ---------- 1. his screen: row 1 Bucket by Time 09:00 – 11:00, row 2 Breaker by Hrs, the same Day ----------
  await start('2026-10-01'); await setRow(0, 'N78-BRK', 'Day'); await clickWay(0, 'Time'); await wait(400);
  await setF(0, 'tStart', '09:00'); await setF(0, 'tEnd', '11:00'); await pick(0, 'Bucket');
  await addRow(); await setRow(1, 'N78-BRK', 'Day'); await setF(1, 'closingHr', '3717.5'); await pick(1, 'Breaker');
  let g = await rows();
  ok('his screen: row 1 Bucket by Time (09:00 – 11:00 = 2 hr), row 2 Breaker by Hrs (3714.5 → 3717.5 = 3 hr) – no row red, no "already in another row"; row 2 is "work 2 of this day"',
    !g[0].red && !g[1].red && !/already in another row/.test(g.map(x => x.note).join(' ')) && g[1].start === '3714.5' && /work 2/.test(g[1].label) && /^2/.test(g[0].tot) && /^3/.test(g[1].tot), g);
  let sv = await save();
  const ent = () => sql("select coalesce(string_agg(to_char(date,'DD') || ' ' || unit || ' ' || coalesce(opening_hrs::text,'') || '>' || coalesce(closing_hrs::text,'') || '=' || coalesce(working_hrs::text,'') || ' ' || coalesce(item_work::text,''), ' | ' order by date), '') from log_book where machinery = 'N78-BRK' and date >= '2026-10-01'");
  ok('   saved as ONE entry on Hrs 3714.5 → 3717.5 = 5 h (2 by Time + 3), Breaker 3 h (Bucket the rest 2 h); the row by Time kept with its times', /^01 Hrs 3714\.5>3717\.5=5 /.test(ent()) && /"Breaker":3/.test(ent()) && /"m":"T","ts":"09:00-11:00"/.test(ent()), [ent(), sv.slice(0, 200)]);

  // ---------- 2. Edit Log Book ----------
  const open = async (from, to) => { await f.evaluate(async (from, to) => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = from; document.getElementById('lx_to').value = to; const n = document.getElementById('lx_no'); n.value = 'N78-BRK'; n.dispatchEvent(new Event('change', { bubbles: true })); await lxLoad(); }, from, to); await wait(1200); };
  const grid = () => f.evaluate(() => { lxCalc(); return { rows: [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)], g = k => { const i = tr.querySelector('[data-f="' + k + '"]'); return i ? i.value : ''; };
    return r.date.slice(8) + ' ' + lxWay(r) + ' ' + (lxWay(r) === 'Time' ? g('tStart') + '-' + g('tEnd') : g('ohr') + '>' + g('chr')) + ' =' + tr.querySelector('.tot').textContent.replace(/\s+/g, '') + (tr.classList.contains('bad') ? ' RED' : '') + ' [' + [...tr.querySelectorAll('.lx-note')].map(n => n.textContent.trim()).join(' / ') + ']'; }),
    foot: document.getElementById('lx_foot').textContent.replace(/\s+/g, ' ').trim(), save: document.getElementById('lx_save').disabled ? 'off' : 'on' }; });
  const lxSet = (i, k, v) => f.evaluate((i, k, v) => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="' + k + '"]'); el.value = v; ['input', 'change'].forEach(n => el.dispatchEvent(new Event(n, { bubbles: true }))); }, i, k, v);
  const lxSave = async () => { const said = []; await f.evaluate(() => { window.__t = []; document.getElementById('lx_save').click(); }); for (let i = 0; i < 24; i++) { await wait(500); const t = await yes(); if (t) said.push(t); } await wait(1500); return said.concat(await f.evaluate(() => window.__t || [])).join(' // '); };
  await open('2026-10-01', '2026-10-01');
  let x = await grid();
  ok('Edit Log Book: the entry comes back as its two rows – Time 09:00 – 11:00 (2 hr) and Hrs 3714.5 → 3717.5 (3 hr); total 5 hr; nothing red', x.rows.length === 2 && /^01 Time 09:00-11:00 =2hr/.test(x.rows[0]) && /^01 Hrs 3714\.5>3717\.5 =3hr/.test(x.rows[1]) && /5 hr/.test(x.foot) && !/RED/.test(x.rows.join()), x);
  await lxSet(0, 'tEnd', '12:00'); x = await grid();
  ok('   To time of the row by Time → 12:00: that row 3 hr, total 6 hr, the row by Hrs unchanged', /^01 Time 09:00-12:00 =3hr/.test(x.rows[0]) && /^01 Hrs 3714\.5>3717\.5 =3hr/.test(x.rows[1]) && /6 hr/.test(x.foot) && x.save === 'on', x);
  sv = await lxSave();
  ok('   saved: 3714.5 → 3717.5 = 6 h (3 by Time + 3)', /^01 Hrs 3714\.5>3717\.5=6 /.test(ent()) && /"ts":"09:00-12:00"/.test(ent()), [ent(), sv.slice(0, 300)]);

  // ---------- 3. the edit window ----------
  const k1 = await f.evaluate(async () => (await call('getLogBookList', { from: '2026-10-01', to: '2026-10-01', no: 'N78-BRK', all: true })).rows[0].key);
  await f.evaluate(async k => { showTab('log'); await openLogEdit(k); }, k1); await wait(800);
  const le = await f.evaluate(() => ({ ro: document.getElementById('le_chr').readOnly, note: document.getElementById('le_note').textContent, parts: [...document.querySelectorAll('#le_box .le-parts')].map(x => x.textContent).join(' ') }));
  ok('edit window: total 6 hr ("3 hr of its rows by Time added"); its readings locked; the rows named with "by Time 09:00–12:00"', le.ro && /Total for this entry: 6 hr/.test(le.note) && /3 hr of its rows by Time added/.test(le.note) && /by Time 09:00–12:00/.test(le.parts), le);
  await f.evaluate(() => document.getElementById('le_cancel').click()); await wait(300);

  // ---------- 4. Excel: Total Hrs = Close − Start + 3 ----------
  const xl = await f.evaluate(async () => { const rs = (await call('getLogBookList', { from: '2026-10-01', to: '2026-10-01', no: 'N78-BRK', all: true })).rows; const cols = lbColsFor([findMachine('N78-BRK')], rs); const sh = lbSheet('t', 't', cols, rs, false), ti = cols.findIndex(c => c.h === 'Total Hrs');
    return sh.aoa.filter(r => Array.isArray(r) && /01-10-2026/.test(String(r[0]))).map(r => JSON.stringify(r[ti])); });
  ok('Excel: Total Hrs = Close − Start + 3 (shows 6)', xl.length === 1 && /\+3,/.test(xl[0]) && /"result":6/.test(xl[0]), xl);

  // ---------- 5. the print ----------
  const got = []; b.on('targetcreated', async t => { try { if (t.type() === 'page') { const pw = await t.page(); if (pw && pw !== p) { await wait(2500);
    const v = await pw.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(s => ({ mach: (s.querySelector('.lb-mach') || {}).textContent, rows: [...s.querySelectorAll('.lb-t tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).join(' | ')), bill: [...s.querySelectorAll('.lb-bill tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()) }))).catch(() => null);
    if (v) got.push(v); await pw.close(); } } } catch (e) {} });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); localStorage.setItem('rcl_print_head', 'Rachana Construction Limited'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-10-01'; document.getElementById('lf_to').value = '2026-10-31'; const n = document.getElementById('lf_no'); n.value = 'N78-BRK'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(2000);
  await f.evaluate(() => document.getElementById('lf_print').click());
  for (let i = 0; i < 24 && !got.length; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
  const sh = (got[0] || []).find(z => /N78-BRK/.test(z.mach || ''));
  const r01 = sh ? sh.rows.filter(z => /01-10-2026/.test(z)) : [];
  ok('the print (format D): two rows – 09:00 / 12:00 with 3 hours, and 3714.5 / 3717.5 with 3 hours; TOTAL HOURS 6; payable 3 × 1,200 + 3 × 1,500 = ₹8,100', !!sh && r01.length === 2 && /09:00/.test(r01[0]) && /12:00/.test(r01[0]) && /3714\.5/.test(r01[1]) && /3717\.5/.test(r01[1]) && sh.bill.some(z => /TOTAL HOURS\s*6\b/.test(z)) && sh.bill.some(z => /8,100/.test(z)), sh ? { rows: r01, bill: sh.bill.slice(0, 8) } : 'no print');

  ok('no script error on the page', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
