// "Debit to" and Debit Notes through the page itself
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240) : '')); };
(async () => {
  sql("delete from debit_notes; delete from log_book where id like 'MH-15-AB-0001|2026-10-02|%'");
  const last = Number(sql("select coalesce(max(closing_km), 0) from log_book where machinery = 'MH-15-AB-0001'")) || 0;
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  const dismiss = () => f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const okDlg = () => f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; });
  await dismiss(); await f.evaluate(() => showTab('log')); await wait(2500); await dismiss();
  await f.evaluate(() => { setLgMode('date'); const d = document.getElementById('lg_top_date'); d.value = '2026-10-02'; d.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(600);
  await f.evaluate(() => { const tr = document.querySelector('#lg_in .lrow'); const i = tr.querySelector('[data-f=no]'); i.value = 'MH-15-AB-0001'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(1500);
  await f.evaluate(() => document.querySelector('#lg_in .lrow .dbt-btn').click()); await wait(200);
  const cell = await f.evaluate(() => { const tr = document.querySelector('#lg_in .lrow'), td = tr.querySelector('td.c-debit'), r = td.getBoundingClientRect(), w = document.querySelector('.lg-wrap'); return { there: !!td, inside: r.right <= w.getBoundingClientRect().right + 1, options: document.querySelectorAll('#dl_dnparty option').length, rowFits: tr.scrollWidth <= tr.clientWidth + 1 }; });
  ok('entry row has "Debit to" + rate, inside the row, with the parties to pick', cell.there && cell.inside && cell.options >= 2 && cell.rowFits, cell);
  await f.evaluate(close => { const tr = document.querySelector('#lg_in .lrow'); const set = (k, v) => { const el = tr.querySelector('[data-f=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('closingKm', String(close)); set('work', 'Carting for Vendor 5'); set('debitTo', 'Vendor 5'); set('debitRate', '55'); }, last + 40);
  await wait(500); await p.screenshot({ path: 'shots/dn_entry.png' });
  await f.evaluate(() => document.getElementById('l_save').click()); for (let i = 0; i < 8; i++) { await wait(500); await okDlg(); }
  ok('saved: the database has the party and the rate', sql("select debit_to || '@' || debit_rate from log_book where id = 'MH-15-AB-0001|2026-10-02|Full Day'") === 'Vendor 5@55', sql("select count(*) from log_book where id = 'MH-15-AB-0001|2026-10-02|Full Day'"));
  await f.evaluate(() => { const a = document.getElementById('lf_from'), c = document.getElementById('lf_to'); a.value = '2026-10-02'; c.value = '2026-10-02'; a.dispatchEvent(new Event('change', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  ok('the Log Book list shows "Debit to Vendor 5 @ 55"', await f.evaluate(() => /Debit to Vendor 5 @ 55/.test(document.getElementById('l_rows').textContent)));
  // RCL Drive → Saved Debit Notes → New
  await f.evaluate(() => showTab('bills')); await wait(2000); await dismiss();
  await f.evaluate(() => document.querySelector('#drv_tabs [data-drv=dn]').click()); await wait(300);
  await f.evaluate(() => document.getElementById('dn_open').click()); await wait(800);
  await f.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('dn_co', 'Sketchline Industries'); set('dn_vendor', 'Vendor 5'); set('dn_from', '2026-10-01'); set('dn_to', '2026-10-02'); set('dn_date', '2026-10-02'); document.getElementById('dn_fetch').click(); });
  await wait(2500);
  await f.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }; set('dn_gst', '18'); set('dn_tds', '1'); });
  await wait(300);
  const form = await f.evaluate(() => ({ lines: document.querySelectorAll('#dn_lines tr[data-i]').length, first: document.querySelector('#dn_lines tr[data-i]') ? [...document.querySelectorAll('#dn_lines tr[data-i] input')].map(i => i.value).join(' | ') : '', sum: document.getElementById('dn_sum').textContent }));
  ok('the form brings the Log Book entry as a line: 40 KM × 55; total 2,200 + 396 − 22 = 2,574', form.lines === 1 && /40/.test(form.first) && /55/.test(form.first) && /2,574\.00/.test(form.sum), form);
  await f.evaluate(() => document.getElementById('dn_new').scrollIntoView({ block: 'start' })); await wait(300); await p.screenshot({ path: 'shots/dn_form.png' });
  await f.evaluate(() => document.getElementById('dn_save').click()); for (let i = 0; i < 8; i++) { await wait(500); await okDlg(); }
  const list = await f.evaluate(() => [...document.querySelectorAll('#dn_rows tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()).filter(x => /SLI\/VTR\/DN/.test(x)).slice(0, 2));
  ok('saved: the note is in Saved Debit Notes with its number', list.length === 1 && /SLI\/VTR\/DN-\d{3}/.test(list[0]) && /2,574\.00/.test(list[0]) && /In the Vendor Ledger/.test(list[0]), list);
  // print
  await f.evaluate(() => { window.__doc = null; printDoc = function (title, html) { window.__doc = { title: title, html: html }; }; document.querySelector('#dn_rows [data-dnn]').click(); }); await wait(1500);
  const doc = await f.evaluate(() => window.__doc ? window.__doc.title + ' :: ' + window.__doc.html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ') : '');
  ok('View / Print: the debit note paper with GST, TDS, total and the amount in words', /DEBIT NOTE/.test(doc) && /Add: GST 18% 396\.00/.test(doc) && /Less: TDS 1% − 22\.00/.test(doc) && /Total debit 2,574\.00/.test(doc) && /Rupees Two Thousand Five Hundred Seventy Four Only/.test(doc), doc.slice(0, 200));
  await f.evaluate(() => { const box = document.createElement('div'); box.id = 'docbox'; box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;overflow:auto;padding:16px'; box.innerHTML = '<div style="width:780px" id="doc9">' + window.__doc.html + '</div>'; document.body.appendChild(box); }); await wait(300);
  await (await f.$('#doc9')).screenshot({ path: 'shots/dn_paper.png' }); await f.evaluate(() => document.getElementById('docbox').remove());
  // the entry is now locked for "Debit to"; the second "Get entries" offers nothing
  await f.evaluate(() => document.getElementById('dn_open').click()); await wait(400);
  await f.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }; set('dn_vendor', 'Vendor 5'); set('dn_from', '2026-10-01'); set('dn_to', '2026-10-02'); document.getElementById('dn_fetch').click(); }); await wait(2500);
  ok('the entry is not offered a second time', await f.evaluate(() => document.querySelectorAll('#dn_lines tr[data-i]').length === 0), await f.evaluate(() => (document.querySelector('.toast') || {}).textContent));
  ok('no script error', errs.length === 0, errs.join(' | '));
  console.log(pass + ' passed, ' + fail + ' failed');
  await b.close();
  sql("delete from debit_notes; delete from log_book where id like 'MH-15-AB-0001|2026-10-02|%'");
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
