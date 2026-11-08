// "Clear" on every form
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const yes = async () => { await wait(250); return f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; }); };
  const go = async t => { await f.evaluate(t2 => { try { closeConfirm(false); } catch (e) {} showTab(t2); }, t); await wait(1800); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); };
  // every page: a form with a Save / Submit / Build button must have a Clear next to it
  const cover = await f.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const miss = [], have = [];
    for (const t of TABS) { try { closeConfirm(false); } catch (e) {} showTab(t); await sleep(200);
      const sec = document.getElementById('sec-' + t); if (!sec) continue;
      for (const sv of sec.querySelectorAll('button')) { const tx = sv.textContent.trim(); if (!/^(Save|Submit|Build|Generate)\b/.test(tx) || /company details|^Save$/.test(tx)) continue;
        const box = sv.closest('.actions, .bk-bar, .panel') || sv.parentNode; const cl = [...box.querySelectorAll('button')].find(x => /^Clear\b/.test(x.textContent.trim()));
        (cl ? have : miss).push(t + ' › ' + tx); } }
    return { miss, have }; });
  ok('every Save / Submit / Build / Generate form has a Clear next to it', cover.miss.length === 0, cover.miss.length ? 'missing: ' + cover.miss.join(', ') : cover.have.length + ' forms: ' + cover.have.join(', '));
  // Vendor Master
  await go('vendors'); await f.evaluate(() => { document.getElementById('v_new').click(); const s = (i, v) => { document.getElementById(i).value = v; }; s('v_name', 'Test Party'); s('v_pan', 'ABCDE1234F'); s('v_addr', 'Somewhere'); });
  await f.evaluate(() => document.getElementById('v_clear').click()); const q1 = await yes(); await wait(300);
  ok('Vendor form: Clear asks first, then the form is blank and "New vendor"', /Clear the vendor form/.test(q1) && await f.evaluate(() => ['v_name', 'v_pan', 'v_addr'].every(i => document.getElementById(i).value === '') && /New vendor/.test(document.getElementById('v_title').textContent)), q1);
  // Vendor BOQ
  await go('boq'); await f.evaluate(() => { document.getElementById('b_new').click(); document.getElementById('b_remark').value = 'typed'; document.getElementById('b_wono').value = 'WO-1'; }); await wait(300);
  await f.evaluate(() => document.getElementById('boq_clear').click()); await yes(); await wait(300);
  ok('BOQ form: blank new BOQ', await f.evaluate(() => document.getElementById('b_remark').value === '' && document.getElementById('b_wono').value === '' && document.getElementById('b_vendor').value === '' && document.getElementById('b_lines').children.length === 0 && /New BOQ/.test(document.getElementById('b_title').textContent)));
  // Debit note
  await go('bills'); await f.evaluate(() => { [...document.querySelectorAll('#sec-bills button')].find(x => /Saved Debit Notes/.test(x.textContent)).click(); }); await wait(600);
  await f.evaluate(() => { document.getElementById('dn_open').click(); document.getElementById('dn_add').click(); document.getElementById('dn_remark').value = 'typed'; }); await wait(300);
  const n0 = await f.evaluate(() => S.dn.lines.length); await f.evaluate(() => document.getElementById('dn_clear').click()); await yes(); await wait(300);
  ok('Debit note form: lines and fields emptied', n0 === 1 && await f.evaluate(() => S.dn.lines.length === 0 && document.getElementById('dn_remark').value === '' && document.getElementById('dn_date').value === S.today));
  // Machinery Billing
  await go('bill'); await f.evaluate(async () => { await mbLoadInit(); document.querySelectorAll('#mb_vlist input.mb-vck').forEach(x => { x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); }); document.getElementById('mb_from').value = '2026-09-01'; document.getElementById('mb_to').value = '2026-09-30'; document.getElementById('mb_build').click(); }); await wait(4000);
  const built = await f.evaluate(() => S.mb.bills.length); await f.evaluate(() => document.getElementById('mb_clear').click()); await yes(); await wait(400);
  ok('Machinery Billing: the built bills are removed and the vendors unticked (' + built + ' bills before)', built > 0 && await f.evaluate(() => S.mb.bills.length === 0 && document.querySelectorAll('#mb_vlist input:checked').length === 0));
  // Edit Log Book, Breakdown, list filters
  await go('logedit'); await f.evaluate(() => { document.getElementById('lx_no').value = 'MH-15-AB-0001'; document.getElementById('lx_clear').click(); }); await yes(); await wait(200);
  ok('Edit Log Book: selection emptied, grid closed', await f.evaluate(() => document.getElementById('lx_no').value === '' && document.getElementById('lx_panel').hidden));
  await go('brk'); await f.evaluate(() => document.getElementById('bk_clear').click()); const q2 = await yes(); await wait(1200);
  ok('Breakdown sheet: Clear asks and reloads the saved day', /Clear the breakdown sheet/.test(q2), q2);
  await go('vled'); await f.evaluate(() => { document.getElementById('vl_from').value = '2026-09-01'; document.getElementById('vl_clear').click(); });
  await go('breg'); await f.evaluate(() => document.getElementById('br_clear').click()); await wait(800);
  await go('vout'); await f.evaluate(() => document.getElementById('vo_clear').click()); await wait(800);
  ok('Vendor Ledger / Bill Summary / Outstanding: filters cleared without an error', await f.evaluate(() => document.getElementById('vl_from').value === '' && document.getElementById('br_from').value !== ''));
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/clear.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/clear.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 500)); process.exit(1); });
