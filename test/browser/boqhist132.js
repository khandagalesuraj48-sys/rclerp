// update-132 (asked 19-10-2026: "agodrcha boq 1 number cha aahe 31 08 26 prynt ok nantr mi 01 09 26 pasun … amendment … mala disayla
// haw old kay hot nantr amendment zali kadhi … boq period wise ani vehicle wise") – in the browser, on the local rig only (PORTAL=1
// bash rig/all.sh; Mechanical :3001 own sign-in). Test data only: vendor "VH132 Vendor", machinery VH132-1 / VH132-2, their BOQs –
// all taken out at the end.
//   1. BOQ 1 of the vendor: 01-08-2026 – 31-08-2026, VH132-1 Per Trip ₹1,000, VH132-2 Per Trip ₹500;
//   2. Vendor BOQ → the vendor → "Make amendment": only VH132-1 kept, ₹1,200, Valid From 01-09-2026 – 30-09-2026 → saved (until
//      update-132: "The amendment must start inside the BOQ period");
//   3. "Rate history – machinery-wise": VH132-1 01-08 – 31-08 ₹1,000 (BOQ 1 – Original, First rate) → 01-09 – 30-09 ₹1,200
//      (Amendment 1 of BOQ 1, Changed – was ₹1,000); VH132-2 01-08 – 31-08 ₹500 only (not touched).
//   NODE_PATH=/home/claude/test/node_modules NODE_OPTIONS="--require <path>/geo-shim.js" node boqhist132.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!', SHOTS = '/home/claude/test/shots/';
(async () => {
  const cleanup = () => sql("delete from boq where vendor_name = 'VH132 Vendor'; delete from master where machinery_number in ('VH132-1', 'VH132-2'); delete from vendors where vendor_name = 'VH132 Vendor'; delete from web.cache where key like 'SB%' or key like 'F\\_%';");
  const post = async (body) => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  const errs = [];
  let b = null;
  try {
    cleanup();
    const tok = (await post({ fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const SA = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const v = await SA('saveVendor', { name: 'VH132 Vendor', gstReg: 'No', pan: 'ABCDE1234H', bank: 'SBI', account: '12345670', ifsc: 'SBIN0000001' }, 'add');
    const mk = no => SA('saveMaster', { no: no, name: 'Tanker', type: 'Water Tanker', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'VH132 Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-08-01' }, 'add');
    const m1 = await mk('VH132-1'), m2 = await mk('VH132-2');
    const b1 = await SA('saveBoq', { vendor: 'VH132 Vendor', from: '2026-08-01', to: '2026-08-31', tdsPct: 2, woNo: 'WO-132', woDate: '2026-07-25', lines: [{ no: 'VH132-1', basis: 'Per Trip', rate: 1000, diesel: 'Company' }, { no: 'VH132-2', basis: 'Per Trip', rate: 500, diesel: 'Company' }] }, 'add');
    ok('1. BOQ 1 of VH132 Vendor: 01-08-2026 – 31-08-2026 (VH132-1 ₹1,000, VH132-2 ₹500)', !v.ERROR && !m1.ERROR && !m2.ERROR && b1 && b1.ok, { v, m1, m2, b1 });
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', PW); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const a = document.getElementById('ai_panel'); if (a) a.hidden = true; }); } catch (e) {}
    await F.evaluate(() => showTab('boq'));
    for (let i = 0; i < 40; i++) { if (await F.evaluate(() => [...$('bf_vendor').options].some(o => o.value === 'VH132 Vendor'))) break; await wait(500); }
    await F.evaluate(() => { $('bf_vendor').value = 'VH132 Vendor'; $('bf_vendor').dispatchEvent(new Event('change')); }); await wait(800);
    // 2. Make amendment: only VH132-1, ₹1,200, from 01-09-2026 to 30-09-2026
    await F.evaluate(id => document.querySelector('#boq_rows [data-bamend="' + id + '"]').click(), b1.id); await wait(1000);
    const note = await F.evaluate(() => $('b_note').textContent);
    await F.evaluate(() => {
      const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('change', { bubbles: true })); };
      set('b_from', '2026-09-01'); set('b_to', '2026-09-30');
      const rows = [...$('b_lines').querySelectorAll('tr')];
      const keep = rows.find(tr => tr.querySelector('[data-bl=no]') && tr.querySelector('[data-bl=no]').value === 'VH132-1');
      rows.forEach(tr => { if (tr !== keep && tr.querySelector('[data-bl=no]')) { const x = tr.querySelector('.del, [data-bldel], button[title*="Remove"]'); if (x) x.click(); else tr.remove(); } });
      const r = keep.querySelector('[data-bl=rate]'); r.value = '1200'; r.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await wait(500);
    await F.evaluate(() => $('boq_save').click());
    const t1 = await (async () => { for (let i = 0; i < 30; i++) { const v = await F.evaluate(() => ({ toast: $('toast').hidden ? '' : $('toast').textContent, form: !$('b_form').hidden, dlg: !$('cf_back').hidden ? $('cf_title').textContent + ' | ' + $('cf_msg').innerText : '' })); if (v.dlg) { await F.evaluate(() => $('cf_ok').click()); await wait(800); continue; } if (v.toast && !v.form) return v; await wait(500); } return await F.evaluate(() => ({ toast: $('toast').textContent, form: !$('b_form').hidden })); })();
    const saved = JSON.parse(sql("select coalesce(json_agg(json_build_object('no', boq_no, 'from', valid_from::text, 'to', coalesce(valid_to::text, ''), 'amend', coalesce(amendment_no::text, ''), 'lines', lines) order by boq_no), '[]') from boq where vendor_name = 'VH132 Vendor'") || '[]');
    const am = saved.find(x => x.amend === '1');
    const amLines = am ? (JSON.parse(am.lines).lines || JSON.parse(am.lines)) : [];
    ok('2. "Make amendment" from 01-09-2026 (after BOQ 1 ends 31-08): saved – only VH132-1 at ₹1,200 (note: "' + note.slice(0, 70) + '…")', /Keep only the machinery whose rate changes/.test(note) && !!am && String(am.from).slice(0, 10) === '2026-09-01' && amLines.length === 1 && amLines[0].no === 'VH132-1' && Number(amLines[0].rate) === 1200, { t1, saved });
    // 3. the rate history
    await wait(1500);
    const hist = await F.evaluate(() => ({ head: ($('bh_box').querySelector('h3') || {}).textContent || '', rows: [...$('bh_box').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.innerText.replace(/\s+/g, ' ').trim()).join(' | ')) }));
    ok('3. "Rate history – machinery-wise": VH132-1 ₹1,000 (01-08 – 31-08, BOQ 1 – Original) → ₹1,200 (01-09 – 30-09, Amendment 1 of BOQ 1, changed); VH132-2 ₹500 only', hist.head === 'Rate history – machinery-wise' && hist.rows.length === 3 &&
      /^VH132-1 \| 01-08-2026 – 31-08-2026 \| Per Trip ₹1,000 · diesel: company paid \| BOQ 1 – Original WO WO-132 \| First rate$/.test(hist.rows[0]) &&
      /^01-09-2026 – 30-09-2026 \| Per Trip ₹1,200 · diesel: company paid \| Amendment 1 of BOQ 1 saved as BOQ \d+ WO WO-132 \| Changed – was Per Trip ₹1,000 · diesel: company paid$/.test(hist.rows[1]) &&
      /^VH132-2 \| 01-08-2026 – 31-08-2026 \| Per Trip ₹500 · diesel: company paid \| BOQ 1 – Original WO WO-132 \| First rate$/.test(hist.rows[2]), hist);
    await F.evaluate(() => $('bh_box').scrollIntoView({ block: 'center' })); await wait(400);
    await p.screenshot({ path: SHOTS + 'boqhist132.png' });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  ok('no script error on the page', errs.length === 0, errs);
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
