// update-143 (asked 23-10-2026): "1 day madhe multiple entry ghet nahi, shift change kel ki ghete … multiple entry hou de; jar same data
//   bharat asel tr te duplicate hoil ani jr same data nasel tr duplicate honar nahi – hydra farana water tanker excavater je rental astat te
//   multiple thikani 1 day madhe kam kartat".
// A new entry for a machinery, date and shift that is already saved is added to that entry as its next row – on the real Log Book entry page.
// On the local rig only.   node add143.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N143-%'; delete from diesel_issue where machinery like 'N143-%'; delete from boq where vendor_name = 'N143 Cranes'; delete from master where id like 'N143-%'; delete from vendors where vendor_name = 'N143 Cranes';");
const entry = (no, d) => sql("select coalesce(string_agg(to_char(date,'DD') || ' ' || shift || ' ' || coalesce(opening_hrs::text,'') || '>' || coalesce(closing_hrs::text,'') || '=' || coalesce(working_hrs::text,''), ' | ' order by date, shift), '') from log_book where machinery = '" + no + "'" + (d ? " and date = '" + d + "'" : ''));
const parts = (no, d) => sql("select coalesce(item_work::text,'') from log_book where machinery = '" + no + "' and date = '" + d + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json(); } catch (e) { if (i > 4) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N143 Cranes', gstReg: 'No', pan: 'ABCDE1143N', bank: 'SBI', account: '12341143', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N143-EXC', name: 'Excavator', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 10, tankCap: 300, owner: 'N143 Cranes', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveMaster', { no: 'N143-HYD', name: 'Hydra', type: 'Hydra', unit: 'KM + Hrs', worksOn: ['KM + Hrs'], kmStd: 4, hrStd: 5, tankCap: 200, owner: 'N143 Cranes', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveMaster', { no: 'N143-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'N143 Cranes', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'N143 Cranes', from: '2026-10-01', tdsPct: 2, woNo: 'WO-N143', lines: [{ no: 'N143-EXC', basis: 'Per Hour', rate: 1000, diesel: 'Company' }, { no: 'N143-TIP', basis: 'Per KM', rate: 40, diesel: 'Company' },
    { no: 'N143-HYD', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'HYDRA', basis: 'Per Hour', qty: 'rest', slabOn: 'Day', slabs: [{ upTo: 1, rate: 1700 }, { upTo: '', rate: 1400 }] }, { name: 'FARANA', basis: 'Per Hour', qty: 'typed', slabOn: 'Day', slabs: [{ upTo: 1, rate: 2200 }, { upTo: '', rate: 1700 }] }] }] }));
  // the first site of the day, saved (as from a phone): the Excavator 100 → 102, the Hydra HYDRA 100 → 103, the Tipper 500 → 540
  E(await api('saveLogRows', { rows: [{ no: 'N143-EXC', date: '2026-10-06', shift: 'Full Day', mode: 'Hrs', openingHr: 100, closingHr: 102, work: 'SITE A', driver: 'D1' },
    { no: 'N143-HYD', date: '2026-10-06', shift: 'Day', mode: 'KM + Hrs', openingKm: 5000, closingKm: 5010, openingHr: 100, closingHr: 103, items: {}, work: 'LIFT', driver: 'D2' },
    { no: 'N143-TIP', date: '2026-10-06', shift: 'Full Day', mode: 'KM', openingKm: 500, closingKm: 540, driver: 'D3' }] }));
  ok('the test machinery and their first entries of 06-10 (an excavator on hours, a Hydra in KM + Hrs with HYDRA / FARANA, a tipper on KM)', !seedErr.length && entry('N143-EXC') === '06 Full Day 100>102=2', seedErr.join(' // ') || entry('N143-EXC'));

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
  const pick = async (i, name) => { await f.evaluate((i, n) => { [...document.querySelectorAll('#lg_in .lrow')[i].querySelectorAll('.itm-chip')].find(c => c.dataset.pick === n).click(); }, i, name); await wait(250); await f.evaluate(() => lgCalcAll()); await wait(150); };
  const rows = () => f.evaluate(() => { lgCalcAll(); return [...document.querySelectorAll('#lg_in .lrow')].map(tr => { const v = k => (tr.querySelector('[data-f=' + k + ']') || {}).value, o = k => ((tr.querySelector('[data-o=' + k + ']') || {}).textContent || '').trim(), tg = tr.querySelector('.lg-partn'), gh = tr.querySelector('.gaphint'), hf = tr.querySelector('.lg-half');
    return { start: v('openingHr'), close: v('closingHr'), okm: v('openingKm'), tot: o('whr'), red: tr.classList.contains('err'), note: [...tr.querySelectorAll('.lnote')].map(n => n.textContent.trim()).filter(Boolean).join(' | '), gap: gh && !gh.hidden ? gh.textContent : '', issued: o('diesel'), label: tg && !tg.hidden ? tg.textContent : '', half: hf ? !hf.hidden : null, odsl: ((tr.querySelector('[data-o=odslCell]') || {}).textContent || '').trim(), closing: o('closing') }; }); });
  const save = async () => { await f.evaluate(() => { window.__t = []; const o = window.toast; if (!o.__w) { window.toast = function (m, e) { window.__t.push(String(m)); return o.apply(this, arguments); }; window.toast.__w = 1; } document.getElementById('l_save').click(); }); let s = ''; for (let i = 0; i < 14; i++) { await wait(500); const t = await yes(); if (t) s += t + ' / '; }
    return (s + ' ' + await f.evaluate(() => { const bx = document.getElementById('fixbox'); const t = bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 420) : ''; if (bx) bx.hidden = true; return ((window.__t || []).join(' | ') + ' ' + t).trim(); })).trim(); };

  // ---------- 1. the excavator at a second site the same day ----------
  await start('2026-10-06'); await setRow(0, 'N143-EXC', 'Full Day');
  let g = await rows();
  ok('the saved day is no longer refused: the row is "work 2 of this day", its Start proposed at the saved Close (102), the diesel of the day already on the saved entry (0 here), no ½ tick, a note says so – nothing red', !g[0].red && g[0].start === '102' && /work 2 of this day/.test(g[0].label) && g[0].issued === '0' && g[0].half === false && /already saved – this row is added to it as work 2/.test(g[0].note), g[0]);
  await setF(0, 'openingHr', '105'); await setF(0, 'closingHr', '108'); g = await rows();
  ok('   Start 105 (above 102): 3 hours, "3 hr not worked between the rows – not counted", nothing red', !g[0].red && g[0].tot.startsWith('3') && /3 hr not worked between the rows/.test(g[0].gap), g[0]);
  await setF(0, 'chFrom', '22+000'); await setF(0, 'chTo', '22+300'); await setF(0, 'work', 'SITE B');
  let sv = await save();
  ok('   saved: the toast says the work was ADDED to the entry already saved; the Log Book has ONE entry 100 → 108 of 5 hours (not 8) with its two rows', /1 work was added to the entry already saved for that shift/.test(sv) && entry('N143-EXC', '2026-10-06') === '06 Full Day 100>108=5' && /"g":\s*3/.test(parts('N143-EXC', '2026-10-06')) && /SITE B/.test(parts('N143-EXC', '2026-10-06')), [sv.slice(0, 300), entry('N143-EXC'), parts('N143-EXC', '2026-10-06')]);
  // the same work again → a duplicate: refused on the server with the help in three languages, nothing saved
  await start('2026-10-06'); await setRow(0, 'N143-EXC', 'Full Day'); g = await rows();
  ok('   the same row again: the page now proposes 108 and says "work 3"', g[0].start === '108' && /work 3 of this day/.test(g[0].label), g[0]);
  await setF(0, 'openingHr', '105'); await setF(0, 'closingHr', '108'); g = await rows();
  ok('   typing the same 105 → 108 again is red already on the page (it starts below the saved Close 108)', g[0].red && /less than the last Close/.test(g[0].note), g[0]);
  sv = await save();
  ok('   … and if it is sent anyway the server refuses it, nothing saved', entry('N143-EXC', '2026-10-06') === '06 Full Day 100>108=5', [sv.slice(0, 300), entry('N143-EXC')]);
  const dup = await api('saveLogRows', { rows: [{ no: 'N143-EXC', date: '2026-10-06', shift: 'Full Day', mode: 'Hrs', openingHr: 105, closingHr: 108, add: 1 }] });
  const old = await api('saveLogRows', { rows: [{ no: 'N143-EXC', date: '2026-10-06', shift: 'Full Day', mode: 'Hrs', openingHr: 108, closingHr: 109 }] });
  ok('   an older app (its row without the "add" mark) is refused as before: "already saved", nothing saved', old && old.ok === false && /already saved for 06-10-2026 \(Full Day\)/.test(JSON.stringify(old)) && entry('N143-EXC', '2026-10-06') === '06 Full Day 100>108=5', old);
  ok('   the same work sent again (e.g. from a phone that was offline): "already in the saved entry of this shift", nothing saved', dup && dup.ok === false && /this work is already in the saved entry of this shift/.test(JSON.stringify(dup)) && entry('N143-EXC', '2026-10-06') === '06 Full Day 100>108=5', dup);
  const fix = await f.evaluate(m => fixRules(m).map(r => r.en[0] + ' ' + r.mr[0]).join(' || '), String(dup && dup.errors && dup.errors[0] && dup.errors[0].msg));
  ok('   its help (English / मराठी): the work is already there', /This work is already there/.test(fix) && /आधीच आहे/.test(fix), fix);      // (update-146: the help also names trips / day)

  // ---------- 2. the Hydra: HYDRA saved, then FARANA from its Close ----------
  await start('2026-10-06'); await setRow(0, 'N143-HYD', 'Day'); g = await rows();
  ok('Hydra (KM + Hrs, two hour works): the row starts at the saved Close (103 hr, 5010 km) as work 2', !(/already saved for/.test(g[0].note)) && g[0].start === '103' && g[0].okm === '5010' && /work 2 of this day/.test(g[0].label), g[0]);
  await setF(0, 'closingKm', '5014'); await setF(0, 'closingHr', '105');
  await pick(0, 'HYDRA'); g = await rows();
  ok('   (update-146) the same work as the saved last one (HYDRA) in a row of its own: not red (its own readings – different data)', !g[0].red && !/Same work as the row above/.test(g[0].note), g[0]);
  await pick(0, 'FARANA'); g = await rows();
  ok('   FARANA: nothing red', !g[0].red, g[0]);
  sv = await save();
  const hp = parts('N143-HYD', '2026-10-06');
  ok('   saved into the Hydra\'s entry of 06-10 (Day): 100 → 105, its rows HYDRA 3 hr then FARANA 2 hr', entry('N143-HYD', '2026-10-06') === '06 Day 100>105=5' && /"n":\s*"HYDRA",\s*"q":\s*3/.test(hp) && /"n":\s*"FARANA",\s*"q":\s*2/.test(hp), [sv.slice(0, 200), entry('N143-HYD'), hp]);
  const bill = await api('getLogBookList', { from: '2026-10-06', to: '2026-10-06', no: 'N143-HYD', all: true });
  ok('   (the entry reads back with both works)', bill && bill.rows && bill.rows.length === 1 && (bill.rows[0].itemParts || []).map(x => x.n).join(',') === 'HYDRA,FARANA', bill && bill.rows && bill.rows[0] && bill.rows[0].itemParts);

  // ---------- 3. a vehicle on KM keeps one entry per shift ----------
  await start('2026-10-06'); await setRow(0, 'N143-TIP', 'Full Day'); g = await rows();
  // update-146 (23-10-2026, "sagle machinery la ha rule ghe"): a vehicle on KM takes another work of a saved shift too
  ok('(update-146) a tipper on KM (one kind of work): the saved day takes this row as its work 2 – it starts at the saved Close', !g[0].red && /already saved – this row is added to it as work 2/.test(g[0].note) && /work 2 of this day/.test(g[0].label), g[0]);

  // ---------- 4. Edit Log Book shows the excavator's day as its rows ----------
  const ed = await api('getLogEditData', 'N143-EXC', '2026-10-06', '2026-10-06');
  ok('Edit Log Book: the day of the excavator comes as its two rows (SITE A 2 hr, SITE B 3 hr after 3 hr not worked)', ed && ed.rows && ed.rows.length === 1 && (ed.rows[0].itemParts || []).map(x => x.w + ' ' + x.q + (x.g ? ' g' + x.g : '')).join(', ') === 'SITE A 2, SITE B 3 g3', ed && ed.rows && ed.rows[0] && ed.rows[0].itemParts);

  ok('no page errors', !errs.length, errs);
  await b.close();
  try { clean(); } catch (e) {}
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(2); });
