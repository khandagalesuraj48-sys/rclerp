// Vendor BOQ: tick which machinery the BOQ is for; give one line's terms to other machinery; a saved BOQ takes more machinery
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 320) : '')); };
(async () => {
  const tk = (await rpc('login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token; const api = async (fn, ...a) => (await rpc('api', tk, fn, a));
  sql("delete from boq where vendor_name = 'Multi Vendor'");
  for (const n of [1, 2, 3, 4]) await api('saveMaster', { no: 'MV-' + n, name: 'Excavator', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 12, owner: 'Multi Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  await api('saveVendor', { name: 'Multi Vendor', gstReg: 'No', pan: 'ABCDE1234L', bank: 'SBI', account: '12345675', ifsc: 'SBIN0000001' }, 'add');
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('boq'); }); await wait(3500); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const pickState = () => f.evaluate(() => ({ shown: !document.getElementById('b_pick').hidden, list: [...document.querySelectorAll('#b_pick .bp')].map(l => l.textContent.trim().replace(/\s+/g, ' ') + (l.querySelector('input').checked ? ' ✓' : '') + (l.querySelector('input').disabled ? ' (locked)' : '')).join(' | '), lines: [...document.querySelectorAll('#b_lines [data-bl=no]')].map(x => x.value).join(',') }));
  const newBoq = async () => { for (let i = 0; i < 40; i++) { if (await f.evaluate(() => (S.vendors || []).some(v => v.name === 'Multi Vendor' && (v.machines || []).length === 4))) break; await wait(500); }
    await f.evaluate(() => { document.getElementById('b_new').click(); const v = document.getElementById('b_vendor'); v.value = 'Multi Vendor'; v.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('b_from').value = '2026-09-01'; document.getElementById('b_from').dispatchEvent(new Event('change', { bubbles: true })); }); await wait(500); };
  await newBoq(); let st = await pickState();
  ok('a new BOQ lists all 4 machinery of the vendor with nothing ticked and no line', st.shown && (st.list.match(/MV-/g) || []).length === 4 && !/✓/.test(st.list) && st.lines === '', st);
  await f.evaluate(() => { const c = document.querySelector('#b_pick [data-bp="MV-1"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(200);
  st = await pickState(); ok('tick MV-1 → one line for MV-1', st.lines === 'MV-1' && /MV-1 Excavator ✓/.test(st.list), st);
  await f.evaluate(() => { const tr = document.querySelector('#b_lines tr'); const set = (k, v) => { const el = tr.querySelector('[data-bl=' + k + ']'); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }; set('basis', 'Per Hour'); set('rate', '1500'); set('diesel', 'Debit Basis'); });
  await f.evaluate(() => document.querySelector('#b_lines tr .bl-same').click()); await wait(400);
  const dlg = await f.evaluate(() => ({ title: document.getElementById('cf_title').textContent, text: document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 220), boxes: [...document.querySelectorAll('#b_samelist input')].map(x => x.dataset.same).join(',') }));
  ok('"same terms → other machinery" shows the terms and the other machinery', /Same terms as MV-1/.test(dlg.title) && /Per Hour ₹1500 · all diesel debited/.test(dlg.text) && dlg.boxes === 'MV-2,MV-3,MV-4', dlg);
  await p.screenshot({ path: 'shots/boq_same.png' });
  await f.evaluate(() => { ['MV-2', 'MV-3'].forEach(id => { document.querySelector('#b_samelist [data-same="' + id + '"]').checked = true; }); document.getElementById('cf_ok').click(); }); await wait(400);
  const lines = await f.evaluate(() => [...document.querySelectorAll('#b_lines tr')].map(tr => tr.querySelector('[data-bl=no]').value + ':' + tr.querySelector('[data-bl=basis]').value + ':' + tr.querySelector('[data-bl=rate]').value + ':' + tr.querySelector('[data-bl=diesel]').value).join(' | '));
  ok('MV-2 and MV-3 get the same terms (3 lines, MV-4 left out)', lines === 'MV-1:Per Hour:1500:Debit Basis | MV-2:Per Hour:1500:Debit Basis | MV-3:Per Hour:1500:Debit Basis', lines);
  await Promise.race([p.screenshot({ path: 'shots/boq_pick.png' }).catch(() => {}), wait(8000)]);
  await f.evaluate(() => document.getElementById('boq_save').click()); for (let i = 0; i < 12; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
  const saved = (await api('getBoqs', { vendor: 'Multi Vendor' })).result.boqs;
  ok('saved: one BOQ with 3 machinery at ₹1,500 per hour, diesel debited', saved.length === 1 && saved[0].lines.map(l => l.no + ':' + l.basis + ':' + l.rate + ':' + l.diesel).join('|') === 'MV-1:Per Hour:1500:Debit Basis|MV-2:Per Hour:1500:Debit Basis|MV-3:Per Hour:1500:Debit Basis', saved.map(x => x.lines.map(l => l.no + ':' + l.rate)).join(' / '));
  // a second BOQ of the same vendor: the three are locked, MV-4 is free
  await f.evaluate(() => { showTab('dash'); }); await wait(800); await f.evaluate(() => { S.stale = S.stale || {}; showTab('boq'); return loadVendors ? loadVendors() : null; }).catch(() => {}); await wait(3500); await newBoq(); st = await pickState();
  ok('a second BOQ for the same dates: MV-1..3 are locked ("in BOQ 1"), MV-4 can be ticked', /MV-1 Excavator · in BOQ 1 \(locked\)/.test(st.list) && /MV-4 Excavator$/.test(st.list.split(' | ').pop()) , st.list);
  await f.evaluate(() => document.getElementById('b_cancel').click());
  // the saved BOQ takes MV-4 on the same terms: Edit → same terms → Save
  const opened = await f.evaluate(id => { const bq = (S.boqs || []).find(x => x.id === id); if (!bq) return 'not in the page list'; bOpen('edit', bq); return 'opened'; }, saved[0].id); await wait(500);
  await f.evaluate(() => document.querySelector('#b_lines tr .bl-same').click()); await wait(400);
  const only4 = await f.evaluate(() => [...document.querySelectorAll('#b_samelist input')].map(x => x.dataset.same + (x.closest('label').textContent.indexOf('already a line') > -1 ? '(line)' : '')).join(','));
  await f.evaluate(() => { document.querySelector('#b_samelist [data-same="MV-4"]').checked = true; document.getElementById('cf_ok').click(); }); await wait(400);
  await f.evaluate(() => document.getElementById('boq_save').click()); for (let i = 0; i < 12; i++) { await wait(500); await f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) document.getElementById('cf_ok').click(); }); }
  const saved2 = (await api('getBoqs', { vendor: 'Multi Vendor' })).result.boqs;
  ok('a saved BOQ takes one more machinery on the same terms (Edit → same terms → Save): now 4', saved2.length === 1 && saved2[0].lines.length === 4 && saved2[0].lines.every(l => l.basis === 'Per Hour' && Number(l.rate) === 1500), opened + ' | offered: ' + only4 + ' | ' + saved2.map(x => x.lines.map(l => l.no + ':' + l.rate)).join(' / '));
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/boq.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/boq.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 500)); process.exit(1); });
