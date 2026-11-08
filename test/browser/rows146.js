// update-146 (asked 23-10-2026, "ha error mala kuthech nko aahe … sagle machinery la ha rule ghe – same data asel tr duplicate hoil;
//   date same, same shift madhe weg wegle timing, weg wegle work ghetoy tri error yetoy"): EVERY machinery may have a row for each
//   work of a shift – by KM, by KM + Hrs, by trips (not only on hours or by Time). One entry; its rows kept; the same row twice is a
//   duplicate; rows that cannot stand together (Idle beside a work) say why – never "two entries on Day".
// Real pages: Edit Log Book, the Log Book entry page (and a work added to a saved shift – update-143), the edit window, the print.
// On the local rig only.   node rows146.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N146-%'; delete from diesel_issue where machinery like 'N146-%'; delete from boq where vendor_name = 'N146 Vendor'; delete from master where id like 'N146-%'; delete from vendors where vendor_name = 'N146 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
// one entry: unit, readings, trips, work, its rows
const ent = (no, d) => sql("select unit || ' ' || coalesce(opening_km::float8::text, '') || '>' || coalesce(closing_km::float8::text, '') || ' ' || coalesce(opening_hrs::float8::text, '') || '>' || coalesce(closing_hrs::float8::text, '') || ' t' || coalesce(trip::float8::text, '') || ' [' || coalesce(work_done, '') || '] ' || coalesce(item_work::text, '') from log_book where machinery = '" + no + "' and date = '2026-09-" + d + "'");
const count = no => sql("select count(*) from log_book where machinery = '" + no + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N146 Vendor', gstReg: 'No', pan: 'ABCDE1246N', bank: 'SBI', account: '12345146', ifsc: 'SBIN0000001' }, 'add'));
  const M = async o => E(await api('saveMaster', Object.assign({ tankCap: 300, owner: 'N146 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, o), 'add'));
  await M({ no: 'N146-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4 });
  await M({ no: 'N146-TRP', name: 'Tipper', type: 'Tipper', unit: 'Trip', worksOn: ['Trip'] });
  await M({ no: 'N146-TM', name: 'Transit Mixer', type: 'Transit Mixer', unit: 'KM + Hrs', worksOn: ['KM', 'Hrs'], kmStd: 3, hrStd: 4 });
  // (after the review) a tipper with one typed KM work; a tipper with two trip works; a grader by the day
  await M({ no: 'N146-TIP2', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4 });
  await M({ no: 'N146-TRP2', name: 'Tipper', type: 'Tipper', unit: 'Trip', worksOn: ['Trip'] });
  await M({ no: 'N146-GRD', name: 'Grader', type: 'Grader', unit: 'Day', worksOn: ['Day'] });
  E(await api('saveBoq', { vendor: 'N146 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-N146', lines: [{ no: 'N146-TIP', basis: 'Per KM', rate: 40, diesel: 'Company' },
    { no: 'N146-TRP', basis: 'Per Trip', rate: 600, nightRate: 600, diesel: 'Company' }, { no: 'N146-TM', basis: 'Per Hour', rate: 500, diesel: 'Company' },
    { no: 'N146-TIP2', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'CARTING', basis: 'Per KM', rate: 40, qty: 'typed' }] },
    { no: 'N146-TRP2', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'SOIL', basis: 'Per Trip', rate: 600, qty: 'typed' }, { name: 'MURUM', basis: 'Per Trip', rate: 400, qty: 'rest' }] },
    { no: 'N146-GRD', basis: 'Per Day', rate: 3000, diesel: 'Company' }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N146-TIP2', date: '2026-09-01', shift: 'Full Day', mode: 'KM', openingKm: 1000, closingKm: 1050, openingDiesel: 40, items: { CARTING: 50 } }] }));
  // (an entry saved BEFORE the review: its two rows without what was typed on each)
  sql("update log_book set item_work = '{\"CARTING\":50,\"_parts\":[{\"n\":\"\",\"q\":20,\"k\":\"km\",\"w\":\"A\"},{\"n\":\"\",\"q\":30,\"k\":\"km\",\"w\":\"B\"}]}' where machinery = 'N146-TIP2' and date = '2026-09-01'");
  E(await api('saveLogRows', { rows: [{ no: 'N146-TRP2', date: '2026-09-01', shift: 'Full Day', mode: 'Trip', trip: 5, challan: 'S1', items: { SOIL: 5 }, openingDiesel: 20 }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N146-GRD', date: '2026-09-01', shift: 'Full Day', mode: 'Day', work: 'SITE A', openingDiesel: 10 }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N146-TIP', date: '2026-09-01', shift: 'Full Day', mode: 'KM', openingKm: 1000, closingKm: 1100, openingDiesel: 100 }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N146-TIP', date: '2026-09-02', shift: 'Full Day', mode: 'KM', closingKm: 1150, challan: 'C1', work: 'LOADING' }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N146-TRP', date: '2026-09-01', shift: 'Full Day', mode: 'Trip', trip: 5, challan: 'T1', work: 'SOIL', openingDiesel: 30 }] }));
  E(await api('saveLogRows', { rows: [{ no: 'N146-TM', date: '2026-09-01', shift: 'Full Day', mode: 'KM + Hrs', openingKm: 5000, closingKm: 5010, openingHr: 100, closingHr: 103, openingDiesel: 50, work: 'POUR 1' }] }));
  ok('the test machinery: a tipper on KM (₹40 / KM), a tipper by trips (₹600 / trip), a transit mixer in KM + Hrs (₹500 / hr); one work saved on each', !seedErr.length && /^KM 1100>1150 /.test(ent('N146-TIP', '02')) && /^Trip > > t5 /.test(ent('N146-TRP', '01')), seedErr.join(' // ') || [ent('N146-TIP', '02'), ent('N146-TRP', '01')]);

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } });
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_back').textContent.replace(/\s+/g, ' ').slice(0, 400); document.getElementById('cf_ok').click(); return t; } return ''; });

  // ---------- Edit Log Book ----------
  const open = async (no, from, to) => { await f.evaluate(async (no, from, to) => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = from; document.getElementById('lx_to').value = to; const n = document.getElementById('lx_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); await lxLoad(); }, no, from, to); await wait(1200); };
  const grid = () => f.evaluate(() => { lxCalc(); return { rows: [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const r = LX.rows[Number(tr.dataset.i)], g = k => { const i = tr.querySelector('[data-f="' + k + '"]'); return i ? i.value : ''; };
    return r.date.slice(8) + ' ' + lxWay(r) + ' ' + g('okm') + '>' + g('ckm') + ' ' + g('ohr') + '>' + g('chr') + ' t' + g('trip') + ' ' + g('challan') + ' ' + g('work') + ' =' + tr.querySelector('.tot').textContent.replace(/\s+/g, '') + (tr.classList.contains('bad') ? ' RED' : '') + ' [' + [...tr.querySelectorAll('.lx-note')].map(n => n.textContent.trim()).join(' / ') + ']'; }),
    foot: document.getElementById('lx_foot').textContent.replace(/\s+/g, ' ').trim(), save: document.getElementById('lx_save').disabled ? 'off' : 'on', all: document.getElementById('lx_panel').textContent.replace(/\s+/g, ' ') }; });
  const lxSet = async (i, k, v) => { await f.evaluate((i, k, v) => { const el = document.querySelector('#lx_rows tr[data-i="' + i + '"] [data-f="' + k + '"]'); el.value = v; ['input', 'change'].forEach(n => el.dispatchEvent(new Event(n, { bubbles: true }))); }, i, k, v); await wait(250); };
  const lxSave = async () => { const said = []; await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } document.getElementById('lx_save').click(); }); for (let i = 0; i < 24; i++) { await wait(500); const t = await yes(); if (t) said.push(t); } await wait(1500); return said.concat(await f.evaluate(() => window.__t || [])).join(' // '); };
  const more = async i => { const r = await f.evaluate(i => { const b0 = document.querySelector('#lx_rows tr[data-i="' + i + '"] .lx-more'); if (!b0) return false; window.__t = []; b0.click(); return true; }, i); await wait(700); return r; };

  // 1. a tipper on KM (one work in its BOQ – before: "two entries on Day")
  await open('N146-TIP', '2026-09-02', '2026-09-02');
  const m1 = await more(0), say1 = await f.evaluate(() => (window.__t || []).join(' '));
  let x = await grid();
  ok('Edit Log Book, a tipper on KM: "+ work in this shift" under 02-09 (1100 → 1150) – row 2 starts at 1150; the page says what to type', m1 && x.rows.length === 2 && /^02 KM 1150>1150 /.test(x.rows[1]) && /type its Close – it starts where the row above closed/.test(say1), [x.rows, say1]);
  await lxSet(1, 'ckm', '1220'); await lxSet(1, 'work', 'CARTING'); x = await grid();
  ok('   its Close 1220, CARTING: nothing red, no "two entries on"; 50 + 70 km; Save on', !/RED/.test(x.rows.join()) && !/two entries on/.test(x.all) && /=50km/.test(x.rows[0]) && /=70km/.test(x.rows[1]) && x.save === 'on', x);
  await lxSet(1, 'okm', '1180'); x = await grid();
  ok('   a gap (row 2 Start 1180): red "This work starts where the row above closed: 1,150"; Save off', /RED/.test(x.rows[1]) && /This work starts where the row above closed: 1,150/.test(x.rows[1]) && x.save === 'off', x);
  await lxSet(1, 'okm', '1150');
  let sv = await lxSave();
  ok('   saved: ONE entry 1100 → 1220 (120 KM), work "LOADING / CARTING", its two rows (50 km, 70 km)', /^KM 1100>1220 /.test(ent('N146-TIP', '02')) && /\[LOADING \/ CARTING\]/.test(ent('N146-TIP', '02')) && /"q":\s*50.*"k":\s*"km".*"q":\s*70/.test(ent('N146-TIP', '02')) && count('N146-TIP') === '2', [ent('N146-TIP', '02'), sv.slice(0, 300)]);
  await open('N146-TIP', '2026-09-02', '2026-09-02'); x = await grid();
  ok('   opened again: its two rows 1100 > 1150 and 1150 > 1220, each with its work; nothing red', x.rows.length === 2 && /^02 KM 1100>1150 .* LOADING =50km/.test(x.rows[0]) && /^02 KM 1150>1220 .* CARTING =70km/.test(x.rows[1]) && !/RED/.test(x.rows.join()), x);

  // 2. a tipper by trips
  await open('N146-TRP', '2026-09-01', '2026-09-01');
  await more(0); const say2 = await f.evaluate(() => (window.__t || []).join(' '));
  await lxSet(1, 'trip', '3'); await lxSet(1, 'challan', 'T2'); await lxSet(1, 'work', 'MURUM'); x = await grid();
  ok('Edit Log Book, a tipper by trips: "+ work in this shift" – type its trips (3), challan T2, MURUM: nothing red; Save on', /type its trips, challan and work/.test(say2) && x.rows.length === 2 && !/RED/.test(x.rows.join()) && /=3trips/.test(x.rows[1]) && x.save === 'on', [x, say2]);
  await lxSet(1, 'trip', '5'); await lxSet(1, 'challan', 'T1'); await lxSet(1, 'work', 'SOIL'); x = await grid();
  ok('   the same row twice (5 trips, T1, SOIL): red "the same as row 1 of this shift … – the same work is not saved twice"; Save off', /RED/.test(x.rows[1]) && /the same as row 1 of this shift \(the same trips, challan, chainage and work\) – the same work is not saved twice/.test(x.rows.join()) && x.save === 'off', x);
  await lxSet(1, 'trip', '3'); await lxSet(1, 'challan', 'T2'); await lxSet(1, 'work', 'MURUM');
  sv = await lxSave();
  ok('   saved: ONE entry of 8 trips, work "SOIL / MURUM", its rows 5 (T1) and 3 (T2)', /^Trip > > t8 \[SOIL \/ MURUM\]/.test(ent('N146-TRP', '01')) && /"q":\s*5.*"k":\s*"trip".*"q":\s*3/.test(ent('N146-TRP', '01')), [ent('N146-TRP', '01'), sv.slice(0, 300)]);
  await open('N146-TRP', '2026-09-01', '2026-09-01'); x = await grid();
  ok('   opened again: two rows, 5 trips and 3 trips', x.rows.length === 2 && /t5 T1 SOIL =5trips/.test(x.rows[0]) && /t3 T2 MURUM =3trips/.test(x.rows[1]), x);

  // 3. a transit mixer read in KM + Hrs: each row its own hours
  await open('N146-TM', '2026-09-01', '2026-09-01');
  await more(0); await lxSet(1, 'ckm', '5030'); await lxSet(1, 'chr', '107'); await lxSet(1, 'work', 'POUR 2'); x = await grid();
  ok('Edit Log Book, a transit mixer (KM + Hrs): row 2 starts at 5010 KM / 103 Hrs; 5030 / 107 – nothing red', x.rows.length === 2 && /^01 KM \+ Hrs 5010>5030 103>107 /.test(x.rows[1]) && !/RED/.test(x.rows.join()), x);
  sv = await lxSave();
  ok('   saved: ONE entry 5000 → 5030 / 100 → 107; its rows keep their hours (3 and 4)', /^KM \+ Hrs 5000>5030 100>107 /.test(ent('N146-TM', '01')) && /"o":\s*3.*"o":\s*4/.test(ent('N146-TM', '01')), [ent('N146-TM', '01'), sv.slice(0, 300)]);
  await open('N146-TM', '2026-09-01', '2026-09-01'); x = await grid();
  ok('   opened again: row 1 5000 > 5010 / 100 > 103, row 2 5010 > 5030 / 103 > 107', /^01 KM \+ Hrs 5000>5010 100>103 /.test(x.rows[0]) && /^01 KM \+ Hrs 5010>5030 103>107 /.test(x.rows[1]), x);

  // ---------- (after the review) what was typed on rows; trips with two works; a machinery by the day ----------
  const boxes = () => f.evaluate(() => [...document.querySelectorAll('#lx_rows tr[data-i]')].map(tr => { const i = tr.querySelector('.lx-itm input[data-item="CARTING"]'); return i ? i.value : '-'; }));
  await open('N146-TIP2', '2026-09-01', '2026-09-01'); x = await grid();
  const bx = await boxes();
  ok('(review) Edit Log Book, an entry saved before the review with CARTING 50 typed on two rows (20 + 30 km): each row gets its share back – 20 and 30; nothing red', x.rows.length === 2 && bx.join() === '20,30' && !/RED/.test(x.rows.join()), [bx, x.rows]);
  await lxSet(1, 'work', 'B2'); sv = await lxSave();
  ok('   a text changed and saved: CARTING still 50 – and now each row keeps its own (20, 30)', /"CARTING":\s*50/.test(ent('N146-TIP2', '01')) && /"x":\s*\{"CARTING":\s*20\}.*"x":\s*\{"CARTING":\s*30\}/.test(ent('N146-TIP2', '01')), [ent('N146-TIP2', '01'), sv.slice(0, 200)]);
  await open('N146-TRP2', '2026-09-01', '2026-09-01');
  await more(0); await lxSet(1, 'trip', '3'); await lxSet(1, 'challan', 'M1'); x = await grid();
  ok('(review) trips with two works (SOIL / MURUM): the row added is red until its work is pressed', /RED/.test(x.rows[1]) && /ONE work – press SOIL \/ MURUM|Pick the work/.test(x.rows.join()) && x.save === 'off', x);
  await f.evaluate(() => { [...document.querySelectorAll('#lx_rows tr[data-i="1"] .itm-chip')].find(c => c.dataset.pick === 'MURUM').click(); }); await wait(400); x = await grid();
  ok('   MURUM pressed: nothing red', !/RED/.test(x.rows.join()) && x.save === 'on', x);
  sv = await lxSave();
  ok('   saved: 8 trips, its rows SOIL 5 and MURUM 3', /^Trip > > t8 /.test(ent('N146-TRP2', '01')) && /"n":\s*"SOIL",\s*"q":\s*5.*"n":\s*"MURUM",\s*"q":\s*3/.test(ent('N146-TRP2', '01')), [ent('N146-TRP2', '01'), sv.slice(0, 200)]);
  await open('N146-GRD', '2026-09-01', '2026-09-01');
  const mg = await more(0); await lxSet(1, 'work', 'SITE B'); x = await grid();
  ok('(review) a grader by the day (no item column): "+ work in this shift" is there; SITE A + SITE B – nothing red', mg && x.rows.length === 2 && !/RED/.test(x.rows.join()), [mg, x]);
  sv = await lxSave();
  ok('   saved: ONE day, two works', /^Day .*\[SITE A \/ SITE B\]/.test(ent('N146-GRD', '01')) && /"k":\s*"day".*"k":\s*"day"/.test(ent('N146-GRD', '01')) && count('N146-GRD') === '1', [ent('N146-GRD', '01'), sv.slice(0, 200)]);

  // ---------- the Log Book entry page ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; showTab('log'); }); await wait(2500); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const start = async date => { await f.evaluate(async d => { S.formDirty = false; setLgMode('date'); const dt = document.getElementById('lg_top_date'); dt.value = d; dt.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); clearLogGrid(); }, date); await wait(500); };
  const setRow = async (i, no, shift) => { await f.evaluate((i, no, shift) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; const sh = tr.querySelector('[data-f=shift]'); sh.value = shift; const x = tr.querySelector('[data-f=no]'); x.value = no; x.dispatchEvent(new Event('change', { bubbles: true })); }, i, no, shift);
    for (let k = 0; k < 30; k++) { await wait(400); if (await f.evaluate((i, no) => { const tr = document.querySelectorAll('#lg_in .lrow')[i]; return !!(tr && tr._p && tr._p.machine.id === no); }, i, no)) break; } await f.evaluate(() => lgCalcAll()); await wait(200); };
  const addRow = async () => { await f.evaluate(() => document.getElementById('l_add1').click()); await wait(400); };
  const setF = async (i, k, v) => { await f.evaluate((i, k, v) => { const el = document.querySelectorAll('#lg_in .lrow')[i].querySelector('[data-f=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); lgCalcAll(); }, i, k, v); await wait(200); };
  const rows = () => f.evaluate(() => { lgCalcAll(); return [...document.querySelectorAll('#lg_in .lrow')].map(tr => { const o = k => ((tr.querySelector('[data-o=' + k + ']') || {}).textContent || '').trim(), tg = tr.querySelector('.lg-partn');
    return { km: o('wkm'), red: tr.classList.contains('err'), note: [...tr.querySelectorAll('.lnote')].map(n => n.textContent.trim()).filter(Boolean).join(' | '), issued: o('diesel'), label: tg && !tg.hidden ? tg.textContent : '', start: (tr.querySelector('[data-f=openingKm]') || {}).value }; }); });
  const save = async () => { await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } document.getElementById('l_save').click(); }); let s = ''; for (let i = 0; i < 14; i++) { await wait(500); const t = await yes(); if (t) s += t + ' / '; }
    return (s + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 420) : ''; if (bx) bx.hidden = true; return ((window.__t || []).join(' | ') + ' ' + t).trim(); })).trim(); };
  const clickWay = (i, way) => f.evaluate((i, way) => { const b0 = document.querySelectorAll('#lg_in .lrow')[i].querySelector('.way [data-way="' + way + '"]'); if (b0) b0.click(); return !!b0; }, i, way);
  // 4. two rows of the tipper on KM, 03-09 Full Day
  await start('2026-09-03'); await setRow(0, 'N146-TIP', 'Full Day'); await setF(0, 'closingKm', '1250'); await setF(0, 'work', 'A');
  await addRow(); await setRow(1, 'N146-TIP', 'Full Day'); await setF(1, 'closingKm', '1300'); await setF(1, 'work', 'B');
  let g = await rows();
  ok('entry page 03-09: two rows of the tipper on KM (→ 1250, → 1300) – no red, no "already in another row"; row 2 "work 2 of this day", starts at 1250, diesel 0',
    !g[0].red && !g[1].red && !/already in another row/.test(g.map(z => z.note).join(' ')) && /work 2 of this day/.test(g[1].label) && g[1].start === '1250' && g[1].issued === '0', g);
  let s1 = await save();
  ok('   saved: ONE entry 1220 → 1300, "A / B", two rows (30 km, 50 km)', /^KM 1220>1300 .*\[A \/ B\]/.test(ent('N146-TIP', '03')) && /"q":\s*30.*"q":\s*50/.test(ent('N146-TIP', '03')), [ent('N146-TIP', '03'), s1.slice(0, 300)]);
  // 5. Idle beside a work: why, not "already in another row"
  await start('2026-09-04'); await setRow(0, 'N146-TIP', 'Full Day'); const idl = await clickWay(0, 'Idle'); await wait(300);
  await addRow(); await setRow(1, 'N146-TIP', 'Full Day'); await setF(1, 'closingKm', '1310');
  g = await rows();
  ok('entry page 04-09: Idle and a work of the same shift – both red "Idle is the whole shift – it cannot be one of two rows of the same shift"', idl && g[0].red && g[1].red && /Idle is the whole shift – it cannot be one of two rows of the same shift/.test(g[1].note), g);
  await f.evaluate(() => { S.formDirty = false; clearLogGrid(); }); await wait(300);
  // 6. a third work added to the saved trips of 01-09 (update-143)
  await start('2026-09-01'); await setRow(0, 'N146-TRP', 'Full Day'); await setF(0, 'trip', '2'); await setF(0, 'challan', 'T3'); await setF(0, 'work', 'SAND');
  g = await rows();
  ok('entry page 01-09 (saved, two rows by trips): 2 trips T3 SAND – "already saved – this row is added to it as work 3", not red', !g[0].red && /already saved – this row is added to it as work 3/.test(g[0].note), g);
  s1 = await save();
  ok('   saved into that entry: 10 trips, three rows (5, 3, 2)', /^Trip > > t10 \[SOIL \/ MURUM \/ SAND\]/.test(ent('N146-TRP', '01')) && /"q":\s*5.*"q":\s*3.*"q":\s*2/.test(ent('N146-TRP', '01')), [ent('N146-TRP', '01'), s1.slice(0, 300)]);
  await start('2026-09-01'); await setRow(0, 'N146-TRP', 'Full Day'); await setF(0, 'trip', '5'); await setF(0, 'challan', 'T1'); await setF(0, 'work', 'SOIL');
  s1 = await save();
  ok('   the same work again (5 trips T1 SOIL): refused "already in the saved entry of this shift" – nothing changed', /already in the saved entry of this shift/.test(s1) && /^Trip > > t10 /.test(ent('N146-TRP', '01')), [s1.slice(0, 300), ent('N146-TRP', '01')]);
  await f.evaluate(() => { S.formDirty = false; clearLogGrid(); }); await wait(300);

  // ---------- the edit window: its rows said, and how they are changed ----------
  const k1 = await f.evaluate(async () => (await call('getLogBookList', { from: '2026-09-01', to: '2026-09-01', no: 'N146-TRP', all: true })).rows[0].key);
  await f.evaluate(async k => { showTab('log'); await openLogEdit(k); }, k1); await wait(800);
  const le = await f.evaluate(() => [...document.querySelectorAll('#le_box .le-parts')].map(z => z.textContent).join(' '));
  ok('edit window of 01-09: "This shift has 3 rows: 5 trips SOIL, then 3 trips MURUM, then 2 trips SAND … use Edit Log Book"', /This shift has 3 rows: 5 trips SOIL, then 3 trips MURUM, then 2 trips SAND\. To change those rows use Edit Log Book/.test(le), le);
  await f.evaluate(() => document.getElementById('le_cancel').click()); await wait(300);

  // ---------- the print: the trips of 01-09 as their three rows ----------
  const got = []; b.on('targetcreated', async t => { try { if (t.type() === 'page') { const pw = await t.page(); if (pw && pw !== p) { await wait(2500);
    const v = await pw.evaluate(() => [...document.querySelectorAll('.lbsheet')].map(s => ({ mach: (s.querySelector('.lb-mach') || {}).textContent, rows: [...s.querySelectorAll('.lb-t tr')].map(tr => [...tr.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()).join(' | ')), bill: [...s.querySelectorAll('.lb-bill tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()) }))).catch(() => null);
    if (v) got.push(v); await pw.close(); } } } catch (e) {} });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); localStorage.setItem('rcl_print_head', 'Rachana Construction Limited'); }); await wait(1500);
  await f.evaluate(() => { document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n = document.getElementById('lf_no'); n.value = 'N146-TRP'; n.dispatchEvent(new Event('change', { bubbles: true })); return loadLog(); }); await wait(2000);
  await f.evaluate(() => document.getElementById('lf_print').click());
  for (let i = 0; i < 24 && !got.length; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
  const sh = (got[0] || []).find(z => /N146-TRP/.test(z.mach || ''));
  const r01 = sh ? sh.rows.filter(z => /01-09-2026/.test(z)) : [];
  ok('the print: 01-09 as three rows – 5, 3 and 2 trips with their challans; payable 10 × ₹600', !!sh && r01.length === 3 && /T1.*5 TRIPS/.test(r01[0]) && /T2.*3 TRIPS/.test(r01[1]) && /T3.*2 TRIPS/.test(r01[2]) && sh.bill.some(z => /6,000/.test(z)), sh ? { rows: r01, bill: sh.bill.slice(0, 8) } : 'no print');

  ok('no script error on the page', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
