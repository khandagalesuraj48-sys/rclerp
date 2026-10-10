// update-69 (asked 10-10-2026): "wherever diesel is debited I must be able to put the rate myself"
//   the bill: a rate box for each bill (empty = automatic) → the Abstract, the Debit Note and the bill's Log Book follow it;
//   the server works the bill out with that rate (and refuses a bill whose amount was made with another rate);
//   the saved bill keeps the rate and its Log Book opens at it; the Log Book print asks for a rate too.
// On the local rig only.   node rate69.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const clean = () => sql("delete from bills where vendor_name = 'R69 Vendor'; delete from log_book where machinery like 'R69-%'; delete from diesel_issue where machinery like 'R69-%'; delete from boq where vendor_name = 'R69 Vendor'; delete from master where id like 'R69-%'; delete from vendors where vendor_name = 'R69 Vendor'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const r2 = v => Math.round(v * 100) / 100;
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(40000) })).json(); } catch (e) { if (i >= 6) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'R69 Vendor', gstReg: 'No', pan: 'ABCDE1269R', bank: 'SBI', account: '12345670', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'R69-JCB', name: 'JCB', type: 'JCB', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 4, tankCap: 150, owner: 'R69 Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add'));
  E(await api('saveBoq', { vendor: 'R69 Vendor', from: '2026-09-01', tdsPct: 2, woNo: 'WO-R69', lines: [{ no: 'R69-JCB', basis: 'Per Hour', rate: 1200, diesel: 'Debit Basis' }] }, 'add'));
  E(await api('saveLogRows', { rows: [{ date: '2026-09-21', shift: 'Day', no: 'R69-JCB', mode: 'Hrs', openingHr: 500, closingHr: 508, work: 'EXCAVATION' }, { date: '2026-09-22', shift: 'Day', no: 'R69-JCB', mode: 'Hrs', closingHr: 515, work: 'EXCAVATION' }] }));
  E(await api('saveDieselIssue', { date: '2026-09-21', shift: 'Day', source: 'Dispenser', no: 'R69-JCB', qty: 50, hrReading: 502, force: true }));
  ok('the test vendor, a JCB on debit-basis diesel, 15 hr of work and 50 L of diesel are saved', !seedErr.length && sql("select count(*) from log_book where machinery like 'R69-%'") === '2', seedErr.join(' // ') || 'ready');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const yes = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const tx = document.getElementById('cf_title').textContent + ' :: ' + document.getElementById('cf_msg').textContent.replace(/\s+/g, ' '); document.getElementById('cf_ok').click(); return tx; } return ''; });
  const co = 'Rachana Construction Limited';

  // ---------- 1. the bill page ----------
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; showTab('bill'); }); await wait(1500);
  await f.evaluate(async co => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = /R69 Vendor/.test(x.closest('label, tr, div').textContent); x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_date').value = '2026-10-05'; document.getElementById('mb_co').value = co; document.getElementById('mb_build').click(); }, co).catch(e => out.push('bill load: ' + String(e.message).slice(0, 120)));
  for (let i = 0; i < 40; i++) { await wait(500); await yes(); if (await f.evaluate(() => (S.mb.bills || []).length >= 1)) break; }
  const bill = () => f.evaluate(() => { const b = S.mb.bills[0], m = b.machines[0], tr = document.querySelector('#mb_rows tr'), box = tr.querySelector('.mb-dr'), pg = document.querySelector('#mb_pages .mb-page');
    return { A: b.A, B: b.B, I: b.I, rate: m.dieselRate, auto: m.autoRate, manual: m.rateManual, debitQty: m.debitQty, excessQty: m.excessQty, excessAmt: m.excessAmt, billRate: b.dieselRate, box: box ? { value: box.value, ph: box.placeholder } : null,
      abstract: (pg.querySelector('.mb-paper').textContent.replace(/\s+/g, ' ').match(/Less- Diesel Deduction.{0,120}/) || [''])[0], dn: [...pg.querySelectorAll('.mb-paper.mb-doc')].map(x => x.innerText.replace(/\s+/g, ' ')).filter(t => /DEBIT NOTE/i.test(t) && !/TAX INVOICE/i.test(t.slice(0, 60))).join(' ').slice(0, 1500), lb: (S.mb.lb[0] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/DIESEL DEBIT.{0,160}/)[0] }; });
  let a = await bill(); const auto = a.auto, qty = a.debitQty + a.excessQty;
  ok('the bill is built at the automatic rate; under "Less – diesel" stands a rate box that is empty and shows that rate',
    a.rate === auto && auto > 0 && !a.manual && a.debitQty === 50 && a.B === r2(50 * auto) && a.box && a.box.value === '' && a.box.ph.indexOf(String(auto.toFixed(2))) > -1 && /higher of avg/.test(a.lb), { auto: auto, B: a.B, box: a.box, logbook: a.lb.slice(0, 90) });
  const setRate = async v => { await f.evaluate(v => { const el = document.querySelector('#mb_rows tr .mb-dr'); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, v); await wait(900); };
  await setRate('95.5'); a = await bill();
  ok('95.50 typed in the box: the diesel of the bill is debited at ₹95.50 – 50 L × 95.50 = ₹4,775; A is untouched; the Abstract says "@ ₹95.5/L"',
    a.rate === 95.5 && a.manual === true && a.billRate === 95.5 && a.excessAmt === 4775 && a.B === 4775 && /@ ₹95\.5\/L/.test(a.abstract) && a.box.value === '95.5', { rate: a.rate, B: a.B, A: a.A, abstract: a.abstract.slice(0, 110) });
  ok('   the Debit Note of the bill and the Log Book under the bill are at the same rate ("rate = ₹95.50 (fixed by hand)", 50 L × ₹95.50 = 4,775)', /95\.5/.test(a.dn) && /4,775/.test(a.dn) && /rate = ₹95\.50 \(fixed by hand\)/.test(a.lb) && /50 L debit × ₹95\.50/.test(a.lb) && /4,775\.00/.test(a.lb), { debitNote: (a.dn.match(/.{40}95\.5.{60}/) || [a.dn.slice(0, 120)])[0], logbook: a.lb.slice(0, 130) });
  await f.evaluate(() => document.querySelector('#mb_rows').scrollIntoView({ block: 'center' })); await wait(300); await p.screenshot({ path: '/home/claude/test/shots/rate69_bill.png' });
  await setRate('5000'); let b2 = await bill();
  ok('   a rate that cannot be right (5000) is not taken: the bill stays at 95.50 and says what to type', b2.rate === 95.5 && b2.B === 4775, { rate: b2.rate, toast: await f.evaluate(() => (document.querySelector('.toast, #toast') || {}).textContent || '') });
  await setRate(''); b2 = await bill();
  ok('   the box emptied: automatic again (' + auto + ')', b2.rate === auto && !b2.manual && b2.B === r2(50 * auto) && /higher of avg/.test(b2.lb), { rate: b2.rate, B: b2.B });
  // typed by hand, key by key, and then a pause (the page redraws its table half a second after typing in the other boxes – it must not do that to this one)
  const boxEl = await f.$('#mb_rows tr .mb-dr'); await boxEl.click(); await p.keyboard.type('96.25', { delay: 70 }); await wait(1300);
  const mid = await f.evaluate(() => { const el = document.querySelector('#mb_rows tr .mb-dr'); return { value: el.value, focused: document.activeElement === el }; });
  await p.keyboard.press('Tab'); await wait(900); const a3 = await bill();
  ok('   REALLY typed on the keyboard (96.25), a pause of more than a second, then Tab: the figure is still in the box while typing and the bill takes it (50 L × 96.25 = ₹4,812.50)',
    mid.value === '96.25' && mid.focused && a3.rate === 96.25 && a3.B === 4812.5 && a3.box.value === '96.25', { whileTyping: mid, rate: a3.rate, B: a3.B });
  await setRate('95.5'); a = await bill();
  // the Log Book of THIS bill (its "Log Book" button): the box shows the bill's rate; emptied there = the automatic rate
  const billPrint = async empty => { const pop = new Promise(res => b.once('targetcreated', t => res(t)));
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} const bt = document.querySelector('#mb_rows [data-mblog]'); if (bt) bt.click(); else mbLogPrint([S.mb.bills[0]]); });
    let seen = null; for (let i = 0; i < 16; i++) { await wait(400); seen = await f.evaluate(empty => { const c = document.getElementById('cf_back'), el = document.getElementById('pn_rate'); if (c && !c.hidden && el) { const v = el.value; if (empty) el.value = ''; document.getElementById('cf_ok').click(); return { was: v }; } return null; }, empty); if (seen) break; }
    const t = await Promise.race([pop, wait(12000).then(() => null)]); let txt = ''; if (t) { try { const w = await t.page(); await wait(2200); txt = await w.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await w.close(); } catch (e) { txt = 'popup: ' + e.message; } }
    return { was: seen && seen.was, txt: txt }; };
  const bp1 = await billPrint(false), bp2 = await billPrint(true);
  ok('   the "Log Book" print of this bill: its rate box already shows 95.5 and the sheet is at ₹95.50; with the box EMPTIED the sheet is at the automatic rate',
    bp1.was === '95.5' && /rate = ₹95\.50 \(fixed by hand\)/i.test(bp1.txt) && bp2.was === '95.5' && /rate = higher of avg/i.test(bp2.txt) && !/fixed by hand/i.test(bp2.txt),
    { kept: (bp1.txt.match(/DIESEL DEBIT.{0,90}/i) || [bp1.txt.slice(0, 90)])[0], emptied: (bp2.txt.match(/DIESEL DEBIT.{0,90}/i) || [bp2.txt.slice(0, 90)])[0] });

  // ---------- 2. the server works it out with the same rate ----------
  const mk = (rate, B) => ({ vendor: { name: 'R69 Vendor' }, company: co, from: '2026-09-01', to: '2026-09-30', idlePaid: true, dieselRate: rate, machines: [{ no: 'R69-JCB', workDays: 2, nights: 0, issued: 50, amount: a.A, excessAmt: B }], A: a.A, B: B, C: 0 });
  const said = async bl => JSON.stringify(await api('verifyBills', { bills: [bl] })).replace(/\\"/g, '"');
  const v1 = await said(mk(95.5, 4775)), v2 = await said(mk('', 4775)), v3 = await said(mk(95.5, r2(50 * auto))), v4 = await said(mk(-3, 4775));
  ok('the server, asked to check the bill: with the rate 95.50 it agrees with ₹4,775 and says the rate was typed by hand', !/diesel deduction ₹/.test(v1) && /Diesel is debited at ₹95\.5 per litre – typed by hand in this bill \(automatic rate of the period: ₹/.test(v1), (v1.match(/Diesel is debited[^"]{0,140}/) || [v1.slice(0, 200)])[0]);
  ok('   a bill that claims ₹4,775 WITHOUT saying the rate is refused (the server works it out at the automatic rate)', /diesel deduction ₹/.test(v2), (v2.match(/R69-JCB: [^"]{0,120}/) || [''])[0]);
  ok('   a bill that names the rate 95.50 but carries the automatic amount is refused too', /diesel deduction ₹4775/.test(v3), (v3.match(/R69-JCB: [^"]{0,120}/) || [''])[0]);
  ok('   a rate that is not a rate (-3) is refused with the reason', /is not a proper rate/.test(v4), (v4.match(/Diesel rate typed[^"]{0,150}/) || [''])[0]);
  const v5 = await said(mk(true, 4775)), v6 = await said(mk(1000, 4775)), v7 = await said(mk(0.001, 4775));
  ok('   so are "true", 1000 and 0.001', /is not a proper rate/.test(v5) && /is not a proper rate/.test(v6) && /is not a proper rate/.test(v7), [v5, v6, v7].map(v => (v.match(/Diesel rate typed[^"]{0,60}/) || ['(taken)'])[0]));

  // ---------- 3. Verify & Submit; the saved bill ----------
  await f.evaluate(() => { const no = document.querySelector('#mb_rows tr .mb-no'); if (no && !no.value) { no.value = '69'; no.dispatchEvent(new Event('input', { bubbles: true })); } }); await wait(900);
  const popup = new Promise(res => b.once('targetcreated', t => res(t)));
  await f.evaluate(() => document.getElementById('mb_abstract').click()); let seen = '';
  for (let i = 0; i < 50; i++) { await wait(500); const t = await yes(); if (t) seen += t + ' || '; if (sql("select count(*) from bills where vendor_name = 'R69 Vendor' and status = 'Active'") === '1') break; }
  const db = sql("select coalesce(data::json->>'dieselRate','') || ' | ' || coalesce(data::json->>'B','') || ' | ' || coalesce(data::json->'machines'->0->>'dieselRate','') || ' | ' || coalesce(data::json->'machines'->0->>'excessAmt','') from bills where vendor_name = 'R69 Vendor' and status = 'Active'");
  ok('Verify & Submit: the check list says the rate was typed by hand, and the bill is SAVED with it (rate 95.5, B 4775)', /typed by hand in this bill/.test(seen) && db === '95.5 | 4775 | 95.5 | 4775', { database: db, checklist: (seen.match(/Diesel is debited[^|]{0,120}/) || [seen.slice(0, 160)])[0] });
  const t0 = await Promise.race([popup, wait(15000).then(() => null)]);
  let ptxt = ''; if (t0) { try { const w = await t0.page(); await wait(2500); ptxt = await w.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await w.close(); } catch (e) { ptxt = 'popup: ' + e.message; } }
  ok('   the print after submitting (bill papers + Log Book) carries the rate: Abstract "@ ₹95.5/L", Log Book "rate = ₹95.50 (fixed by hand)"', /@ ₹95\.5\/L/.test(ptxt) && /RATE = ₹95\.50 \(FIXED BY HAND\)|rate = ₹95\.50 \(fixed by hand\)/i.test(ptxt), (ptxt.match(/.{30}fixed by hand.{60}/i) || [ptxt.slice(0, 160)])[0]);
  // the saved bill, opened later from Saved Bills
  const id = sql("select id from bills where vendor_name = 'R69 Vendor' and status = 'Active'");
  const popup2 = new Promise(res => b.once('targetcreated', t => res(t)));
  await f.evaluate(id => { try { closeConfirm(false); } catch (e) {} viewSavedBill(id).catch(() => {}); }, id);
  for (let i = 0; i < 12; i++) { await wait(500); await yes(); }
  const t2 = await Promise.race([popup2, wait(12000).then(() => null)]);
  let vtxt = ''; if (t2) { try { const w = await t2.page(); await wait(2500); vtxt = await w.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await w.close(); } catch (e) { vtxt = 'popup: ' + e.message; } }
  ok('the SAVED bill opened again (View bill): its papers and its Log Book are at ₹95.50, not at the automatic rate', /@ ₹95\.5\/L/.test(vtxt) && /rate = ₹95\.50 \(fixed by hand\)/i.test(vtxt) && !/higher of avg/i.test(vtxt), (vtxt.match(/.{30}fixed by hand.{60}/i) || [vtxt.slice(0, 200)])[0]);

  // ---------- 4. the Log Book print asks for the rate ----------
  const printWith = async rate => { const pop = new Promise(res => b.once('targetcreated', t => res(t)));
    await f.evaluate(async () => { try { closeConfirm(false); } catch (e) {} const L = await call('getLogBookList', { from: '2026-09-01', to: '2026-09-30', no: 'R69-JCB', all: true }); printLogRows({ rows: L.rows, f: { from: '2026-09-01', to: '2026-09-30' }, summary: [] }); });
    let dlg = ''; for (let i = 0; i < 16; i++) { await wait(400); dlg = await f.evaluate(r => { const c = document.getElementById('cf_back'), el = document.getElementById('pn_rate'); if (c && !c.hidden && el) { const t = document.getElementById('cf_msg').textContent.replace(/\s+/g, ' '); el.value = r; document.getElementById('cf_ok').click(); return t; } return ''; }, rate); if (dlg) break; }
    const t = await Promise.race([pop, wait(12000).then(() => null)]); let txt = ''; if (t) { try { const w = await t.page(); await wait(2200); txt = await w.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); await w.close(); } catch (e) { txt = 'popup: ' + e.message; } }
    return { dlg: dlg, txt: txt }; };
  const q1 = await printWith('90');
  ok('Print Log Book asks for the name AND offers "Diesel debit rate ₹ / litre" (empty = automatic); with 90 typed the sheet debits 50 L × ₹90.00 = ₹4,500', /Diesel debit rate/.test(q1.dlg) && /automatic rate/.test(q1.dlg) && /rate = ₹90\.00 \(fixed by hand\)/i.test(q1.txt) && /4,500\.00/.test(q1.txt), { dialog: q1.dlg.slice(0, 150), sheet: (q1.txt.match(/DIESEL DEBIT.{0,120}/i) || [q1.txt.slice(0, 120)])[0] });
  const q2 = await printWith('');
  ok('   left empty: the automatic rate, as before ("rate = higher of avg … / last …")', /rate = higher of avg/i.test(q2.txt) && !/fixed by hand/i.test(q2.txt), (q2.txt.match(/DIESEL DEBIT.{0,110}/i) || [q2.txt.slice(0, 120)])[0]);

  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
