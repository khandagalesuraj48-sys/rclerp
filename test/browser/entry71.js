// update-71 (asked 10-10-2026, with a screenshot of the Log Book entry page: two rows of one machinery on the same day –
// Bucket 1 → 2 and Breaker 3 → 4 – both red: "… is already in another row for this date / shift"):
//   "in Edit Log Book this can be entered, but while filling the Log Book this comes – use the same logic".
// The entry page takes a row for each work of one shift, with the rules of Edit Log Book; it is saved as ONE entry that keeps its rows.
// On the local rig only.   node entry71.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N71-%'; delete from diesel_issue where machinery like 'N71-%'; delete from boq where vendor_name = 'N71 Vendor'; delete from master where id like 'N71-%'; delete from vendors where vendor_name = 'N71 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const entries = no => sql("select coalesce(string_agg(date || ' ' || shift || ' ' || coalesce(opening_hrs::text, '') || '>' || coalesce(closing_hrs::text, '') || '=' || coalesce(working_hrs::text, '') || ' km ' || coalesce(opening_km::text, '') || '>' || coalesce(closing_km::text, '') || ' ' || coalesce(item_work::text, '') || ' wk[' || coalesce(work_done, '') || '] dsl ' || coalesce(diesel_qty::text, ''), ' ;; ' order by date, shift), '') from log_book where machinery = '" + no + "'");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N71 Vendor', gstReg: 'No', pan: 'ABCDE1271N', bank: 'SBI', account: '12345671', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N71-JCB', name: 'Sany', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 12, tankCap: 300, owner: 'N71 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveMaster', { no: 'N71-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'N71 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'N71 Vendor', from: '2026-10-01', tdsPct: 2, woNo: 'WO-N71', lines: [{ no: 'N71-JCB', basis: 'Item-wise', diesel: 'Company', items: [{ name: 'Bucket', basis: 'Per Hour', rate: 1200 }, { name: 'Breaker', basis: 'Per Hour', rate: 1500 }] }, { no: 'N71-TIP', basis: 'Per KM', rate: 40, diesel: 'Company' }] }, 'add'));
  E(await api('saveDieselIssue', { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'N71-JCB', qty: 30, force: true }));
  ok('the test machinery: an excavator with Bucket + Breaker per hour (12 L/hr, no entry yet, 30 L issued on 01-10 Day) and a Tipper per KM', !seedErr.length, seedErr.join(' // ') || 'ready');

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

  // ---------- 1. his screen: the same machinery twice on 01-10 Day – Bucket, then Breaker ----------
  await start('2026-10-01');
  await setRow(0, 'N71-JCB', 'Day'); await setF(0, 'openingHr', '1'); await setF(0, 'closingHr', '2'); await pick(0, 'Bucket');
  await addRow(); await setRow(1, 'N71-JCB', 'Day');
  let g = await rows();
  ok('a second row for the same machinery, date and shift is NOT "already in another row": it is marked "work 2 of this day" and its Start is the Close of the row above (2)',
    g.rows.length === 2 && !/already in another row/.test(g.rows.map(r => r.note).join(' ')) && g.rows[1].start === '2' && /work 2 of this day/.test(g.rows[1].label) && !g.rows[0].label, g.rows.map(r => r.start + '>' + r.close + ' ' + r.chips + ' [' + r.label + '] ' + (r.red ? 'RED ' : '') + r.note));
  await setF(1, 'closingHr', '4'); await pick(1, 'Bucket'); g = await rows();
  ok('   Bucket pressed on the second row too: it says so – "Same work as the row above (Bucket) … press the other work"', g.rows[1].red && /Same work as the row above \(Bucket\)/.test(g.rows[1].note) && !g.rows[0].red, g.rows[1].note);
  await pick(1, 'Breaker'); g = await rows();
  ok('Breaker pressed and Close 4 typed on the second row: no red row – Bucket 1 hr (1 → 2), Breaker 2 hr (2 → 4)', !g.rows[0].red && !g.rows[1].red && /Bucket\*/.test(g.rows[0].chips) && /Breaker\*/.test(g.rows[1].chips) && /^1\b/.test(g.rows[0].tot) && /^2\b/.test(g.rows[1].tot), g.rows.map(r => r.start + '>' + r.close + ' = ' + r.tot + ' ' + r.chips + ' ' + (r.red ? 'RED ' + r.note : '')));
  ok('   the diesel of the shift (30 L) stands once, on the first row; the second row starts from the diesel the first left (30 − 12 = 18) and has no ½ tick; the foot counts 30 L',
    g.rows[0].issued === '30' && g.rows[1].issued === '0' && g.rows[0].closing === '18' && g.rows[1].closing === '-6' && g.rows[0].half === true && g.rows[1].half === false && /Diesel issued: 30 Ltr/.test(g.sum), { issued: g.rows.map(r => r.issued), need: g.rows.map(r => r.need), closing: g.rows.map(r => r.closing), half: g.rows.map(r => r.half), foot: g.sum });
  await f.evaluate(() => document.getElementById('lg_in').scrollIntoView({ block: 'center' })); await wait(300); await p.screenshot({ path: '/home/claude/test/shots/entry71_rows.png' });
  // the wrong ways are stopped on the spot
  await setF(1, 'openingHr', '3'); g = await rows();
  ok('   a Start typed away from the Close above (3 instead of 2, as on his screen) is stopped: "This work starts where the row above closed: 2 hr"', g.rows[1].red && /This work starts where the row above closed: 2/.test(g.rows[1].note), g.rows[1].note);
  await setF(1, 'openingHr', ''); g = await rows();
  ok('   the Start cleared: it fills by itself with 2 – fine again', g.rows[1].start === '2' && !g.rows[1].red, g.rows[1].start + ' ' + g.rows[1].note);
  await pick(1, '_split'); g = await rows();
  ok('   "Split" on a row of such a shift is stopped: "Each row of this shift is ONE work"', g.rows[1].red && /ONE work/.test(g.rows[1].note), g.rows[1].note);
  await pick(1, 'Breaker'); await setF(0, 'work', 'LOADING'); await setF(1, 'work', 'ROCK BREAKING'); g = await rows();
  // ---------- 2. saved as ONE entry that keeps its rows ----------
  let said = await save(); await wait(2500); let db = entries('N71-JCB');
  ok('Save: ONE entry in the database – 01-10 Day 1 → 4 = 3 hr, Breaker 2 hr for the bill, its two rows kept (Bucket 1 "LOADING", Breaker 2 "ROCK BREAKING"), the 30 L once',
    /^2026-10-01 Day 1>4=3 /.test(db) && !/;;/.test(db) && /"Breaker":2[,}]/.test(db) && /"_parts":\[\{"n":"Bucket","q":1,"w":"LOADING"\},\{"n":"Breaker","q":2,"w":"ROCK BREAKING"\}\]/.test(db) && /wk\[LOADING \/ ROCK BREAKING\] dsl 30/.test(db), { said: said.slice(0, 200), database: db });
  ok('   the page says so: "1 Log Book entry saved (2 rows are works of the same shift …)"', /1 Log Book entry saved \(2 rows are works of the same shift/.test(said), said.slice(0, 220));
  const ed = await api('getLogEditData', 'N71-JCB', '2026-10-01', '2026-10-10');
  const pr = await f.evaluate(async () => { const L = await call('getLogBookList', { from: '2026-10-01', to: '2026-10-10', no: 'N71-JCB', all: true }); const x = await logSheetsOf({ rows: L.rows, f: { from: '2026-10-01', to: '2026-10-10' }, summary: [] }, 'Rachana Construction Limited'); const d = document.createElement('div'); d.innerHTML = x.sheets; const t = d.querySelector('table.lb-t');
    return { rows: [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()).join(' ¦ ')), box: (d.textContent.replace(/\s+/g, ' ').match(/PAYABLE AMOUNT[^A-Z]{0,24}/) || [''])[0] }; });
  ok('   Edit Log Book gets it as two rows (Bucket 1, Breaker 2); the Log Book print has a row for each work; the money is 1 × 1,200 + 2 × 1,500 = 4,200',
    ed && ed.rows && ed.rows.length === 1 && (ed.rows[0].itemParts || []).map(x => x.n + ' ' + x.q).join(', ') === 'Bucket 1, Breaker 2' && pr.rows.length === 2 && /BUCKET 1 HR/.test(pr.rows[0]) && /BREAKER 2 HR/.test(pr.rows[1]) && /4,200\.00/.test(pr.box), { edit: ed && ed.rows && (ed.rows[0].itemParts || []).map(x => x.n + ' ' + x.q), print: pr.rows.map(r => r.slice(0, 150)), box: pr.box });

  // ---------- 3. the next day: three works, entered with another machinery between them ----------
  await start('2026-10-02');
  await setRow(0, 'N71-JCB', 'Day'); await setF(0, 'closingHr', '5'); await pick(0, 'Bucket');
  await addRow(); await setRow(1, 'N71-TIP', 'Day'); await setF(1, 'openingKm', '100'); await setF(1, 'closingKm', '160');
  await addRow(); await setRow(2, 'N71-JCB', 'Day'); await pick(2, 'Breaker'); await setF(2, 'closingHr', '5.5');
  await addRow(); await setRow(3, 'N71-JCB', 'Day'); await setF(3, 'closingHr', '7'); await pick(3, 'Bucket');
  g = await rows();
  ok('02-10: Bucket 4 → 5, (a Tipper row), Breaker 5 → 5.5, Bucket 5.5 → 7 – the rows of the excavator follow each other over the other machinery\'s row; nothing red',
    g.rows.length === 4 && g.rows.every(r => !r.red) && g.rows[0].start === '4' && g.rows[2].start === '5' && g.rows[3].start === '5.5' && /work 2 of this day/.test(g.rows[2].label) && /work 3 of this day/.test(g.rows[3].label) && !g.rows[1].label, g.rows.map(r => r.no + ' ' + (r.start || r.okm) + '>' + (r.close || r.ckm) + ' ' + r.chips.replace(/ Split/, '') + ' [' + r.label + '] ' + (r.red ? 'RED ' + r.note : '')));
  said = await save(); await wait(2500); db = entries('N71-JCB'); const dbT = entries('N71-TIP');
  ok('   saved: the excavator has TWO entries now (01-10 and 02-10), the 02-10 one 4 → 7 = 3 hr with three rows (Bucket 1, Breaker 0.5, Bucket 1.5); the Tipper has its own entry',
    db.split(' ;; ').length === 2 && /2026-10-02 Day 4>7=3 /.test(db) && /"_parts":\[\{"n":"Bucket","q":1\},\{"n":"Breaker","q":0\.5\},\{"n":"Bucket","q":1\.5\}\]/.test(db) && /^2026-10-02 Day .* km 100>160 /.test(dbT) && /2 Log Book entries saved \(3 rows are works of the same shift/.test(said), { said: said.slice(0, 160), jcb: db.split(' ;; ')[1], tipper: dbT });

  // ---------- 4. what stays as it was ----------
  await start('2026-10-03');
  await setRow(0, 'N71-TIP', 'Day'); await setF(0, 'closingKm', '200'); await addRow(); await setRow(1, 'N71-TIP', 'Day'); await setF(1, 'closingKm', '240'); g = await rows();
  ok('a machinery with ONE kind of work (the Tipper) twice on the same shift is refused as before: "… is already in another row for this date / shift"', g.rows.every(r => r.red && /N71-TIP is already in another row for this date \/ shift/.test(r.note)) && !g.rows[1].label, g.rows.map(r => r.note));
  said = await save(); await wait(800);
  ok('   and Save does not take it ("Fix the rows marked in red first")', /Fix the rows marked in red first/.test(said) && entries('N71-TIP').split(' ;; ').length === 1, said.slice(0, 160));
  await start('2026-10-03');
  await setRow(0, 'N71-JCB', 'Day'); await setF(0, 'closingHr', '9'); await pick(0, 'Bucket'); await addRow(); await setRow(1, 'N71-JCB', 'Night'); await setF(1, 'closingHr', '12'); await pick(1, 'Breaker'); g = await rows();
  ok('Day and Night of one date stay two entries (not rows of one shift): the Night row starts at the Day Close (9), carries no "work 2" mark and keeps its ½ tick', g.rows.every(r => !r.red) && g.rows[1].start === '9' && !g.rows[1].label && g.rows[1].half === true, g.rows.map(r => r.shift + ' ' + r.start + '>' + r.close + ' [' + r.label + '] half:' + r.half));
  said = await save(); await wait(2500); db = entries('N71-JCB');
  ok('   saved as two entries (Day 7 → 9, Night 9 → 12), no rows kept inside them', /2026-10-03 Day 7>9=2 /.test(db) && /2026-10-03 Night 9>12=3 /.test(db) && !/_parts/.test(db.split(' ;; ').slice(2).join(' ')) && db.split(' ;; ').length === 4, db.split(' ;; ').slice(2));
  // a shift that is already saved: the page says where another work is added to it
  await start('2026-10-01'); await setRow(0, 'N71-JCB', 'Day'); g = await rows();
  ok('a shift that is ALREADY saved: the row says "already saved for 01-10-2026 (Day)" and where to add a work to it (Edit Log Book → "+ work in this shift")', g.rows[0].red && /already saved for 01-10-2026 \(Day\)/.test(g.rows[0].note) && /Edit Log Book → "\+ work in this shift"/.test(g.rows[0].note), g.rows[0].note);
  await f.evaluate(() => { S.formDirty = false; clearLogGrid(); });

  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
