// daily report, month close, database self-check, "Debit to" in print and Excel – through the page and the database
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
(async () => {
  sql("delete from web.props where key = 'BOOKS_CLOSED_UPTO'") ;
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.removeItem('rcl_dbcheck'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__docs = []; printDoc = function (title, inner) { window.__docs.push({ title: title, html: inner }); }; });
  const text = h => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const dlgYes = async () => { await wait(350); return f.evaluate(() => { const c = document.getElementById('cf_back'); if (c && !c.hidden) { const t = document.getElementById('cf_title').textContent; document.getElementById('cf_ok').click(); return t; } return ''; }); };
  const card = () => f.evaluate(() => { const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 500) : ''; });
  // ---------- 1. the database check ----------
  for (let i = 0; i < 30; i++) { await wait(500); if (await f.evaluate(() => !document.getElementById('db_pill').hidden)) break; }
  let pill = await f.evaluate(() => ({ shown: !document.getElementById('db_pill').hidden, text: document.getElementById('db_pill').textContent }));
  ok('Admin sees "Database ✓" by itself after signing in (checked once a day)', pill.shown && pill.text === 'Database ✓', pill);
  sql("alter table public.log_book drop column if exists meter_note; drop function if exists public.web_health(); notify pgrst, 'reload schema';"); await wait(1500);
  await f.evaluate(() => document.getElementById('db_pill').click()); await wait(600);
  await f.evaluate(() => document.getElementById('dbh_again').click()); for (let i = 0; i < 30; i++) { await wait(500); if (await f.evaluate(() => /to do/.test(document.getElementById('db_pill').textContent))) break; } await wait(600);
  const dlg = await f.evaluate(() => ({ pill: document.getElementById('db_pill').textContent, title: document.getElementById('cf_title').textContent, rows: [...document.querySelectorAll('#cf_msg table.dbh tr.no')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim()) }));
  ok('a missing SQL step is found and named with the file to run', /2 to do/.test(dlg.pill) && dlg.rows.length === 2 && /supabase_step1u_meter\.sql/.test(dlg.rows.join(' ')) && /supabase_step4_health\.sql/.test(dlg.rows.join(' ')), dlg);
  await p.screenshot({ path: 'shots/dbcheck.png' });
  execSync('su postgres -c "psql -d rcl -q" < /home/claude/vercel/sql/supabase_step1u_meter.sql 2>/dev/null; su postgres -c "psql -d rcl -q" < /home/claude/vercel/sql/supabase_step4_health.sql 2>/dev/null'); await wait(1500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} return dbCheck(false); }); await wait(500);
  ok('after the files are run the check is green again', (await f.evaluate(() => document.getElementById('db_pill').textContent)) === 'Database ✓');
  // ---------- 2. the daily report ----------
  await f.evaluate(() => { showTab('dash'); document.getElementById('k_from').value = '2026-09-30'; document.getElementById('k_to').value = '2026-09-30'; document.getElementById('dash_daily').click(); });
  for (let i = 0; i < 40; i++) { await wait(500); if (await f.evaluate(() => window.__docs.length > 0)) break; }
  const doc = await f.evaluate(() => window.__docs[0] || { title: '', html: '' }); const t = text(doc.html);
  ok('Daily report: one click gives the day with its five parts', /Daily Report 30-09-2026/.test(doc.title) && /1\. Diesel stock/.test(t) && /2\. Diesel received/.test(t) && /3\. Diesel issued/.test(t) && /4\. Log Book/.test(t) && /5\. To look at/.test(t), doc.title + ' | ' + t.slice(0, 200));
  const dbIss = sql("select coalesce(sum(qty), 0) || '|' || count(*) from diesel_issue where issue_date = '2026-09-30'"), dbLog = sql("select count(*) from log_book where date = '2026-09-30'");
  const mIss = t.match(/Total – (\d+) issue\(s\), \d+ machinery\s+([\d,.]+)/);
  ok('…its diesel issued and Log Book rows are those of the database (' + dbIss + ' ; ' + dbLog + ' entries)', mIss && Number(mIss[1]) === Number(dbIss.split('|')[1]) && Number(mIss[2].replace(/,/g, '')) === Number(dbIss.split('|')[0]) && (doc.html.split('4. Log Book')[1].split('5. To look at')[0].match(/<tr>/g) || []).length - 1 === Number(dbLog), mIss && mIss[0]);
  fs.writeFileSync('/tmp/daily.html', '<html><body style="font-family:Arial,sans-serif;margin:24px;width:760px">' + doc.html + '</body></html>');
  // ---------- 3. month close ----------
  await f.evaluate(() => showTab('bill')); await wait(1500);
  ok('the Month close panel is on the Billing page (Admin)', await f.evaluate(() => !document.getElementById('lk_panel').hidden && /nothing is closed/.test(document.getElementById('lk_now').textContent)));
  await f.evaluate(() => { document.getElementById('lk_date').value = '2026-08-31'; document.getElementById('lk_save').click(); }); const q = await dlgYes(); await wait(2500);
  const lk = await f.evaluate(() => ({ pill: document.getElementById('lock_pill').textContent, hidden: document.getElementById('lock_pill').hidden, now: document.getElementById('lk_now').textContent }));
  ok('close up to 31-08-2026: asked first, then shown to everyone in the top bar', /Close entries up to 31-08-2026/.test(q) && !lk.hidden && lk.pill === 'Closed up to 31-08-2026' && sql("select value from web.props where key = 'BOOKS_CLOSED_UPTO'").replace(/"/g, '') === '2026-08-31', lk);
  await f.evaluate(() => showTab('diesel')); await wait(2000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} const d = document.getElementById('d_date'); d.value = '2026-08-20'; d.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(400);
  let c = await card(); ok('typing a date of the closed month is pointed out at once, with what to do (Marathi)', /entries up to 31-08-2026 are closed/.test(c) && /काय करायचे/.test(c), c.slice(0, 220));
  const srv = await f.evaluate(async () => { try { await call('saveDieselIssue', { date: '2026-08-20', shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0001', qty: 5, kmReading: 1, force: true }); return 'SAVED'; } catch (e) { return String(e.message || e); } });
  ok('…and the server refuses it whatever the page does', /entries up to 31-08-2026 are closed/.test(srv) && sql("select count(*) from diesel_issue where issue_date = '2026-08-20' and qty = 5") === '0', srv.slice(0, 160));
  await f.evaluate(() => { showTab('bill'); }); await wait(1200); await f.evaluate(() => document.getElementById('lk_open').click()); await dlgYes(); await wait(2500);
  ok('the Admin reopens: nothing is closed', await f.evaluate(() => document.getElementById('lock_pill').hidden && /nothing is closed/.test(document.getElementById('lk_now').textContent)) && sql("select coalesce((select value from web.props where key = 'BOOKS_CLOSED_UPTO'), '')").replace(/"/g, '') === '');
  ok('the Activity Log has both steps', Number(sql("select count(*) from activity_log where record_id = 'Month close'")) >= 2, sql("select string_agg(summary, ' | ') from (select summary from activity_log where record_id = 'Month close' order by at desc limit 2) x"));
  // ---------- 4. "Debit to" in the Log Book print and Excel ----------
  await f.evaluate(() => { showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} window.__docs = []; window.__x = null; saveXlsxLists = async function (name, sheets) { window.__x = sheets; return true; };
    document.getElementById('lf_from').value = '2026-09-01'; document.getElementById('lf_to').value = '2026-09-30'; const n0 = document.getElementById('lf_no'); n0.value = 'GAPX-1'; n0.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  await f.evaluate(() => [...document.querySelectorAll('#sec-log button')].find(x => /Print Log Book/.test(x.textContent)).click()); for (let i = 0; i < 16; i++) { await wait(400); await dlgYes(); if (await f.evaluate(() => window.__docs.length > 0)) break; }
  const pr = text((await f.evaluate(() => (window.__docs[0] || { html: '' }).html)));
  ok('Log Book print says whom the work is debited to', /DEBIT TO MULTI VENDOR @ 40/.test(pr), (pr.match(/DEBIT TO[^|]{0,60}/) || ['not found'])[0]);
  await f.evaluate(() => document.getElementById('lf_exp_mach').click()); for (let i = 0; i < 30; i++) { await wait(400); if (await f.evaluate(() => !!window.__x)) break; }
  const xl = await f.evaluate(() => { const s = (window.__x || []).find(y => y.name === 'GAPX-1'); if (!s) return null; const h = s.aoa[s.head - 1], row = s.aoa.find(r => r[0] === '20-09-2026'); return { head: h.slice(-3), val: row ? [row[h.indexOf('Debit to')], row[h.indexOf('Debit rate')]] : null }; });
  ok('the Excel sheet has "Debit to" and "Debit rate"', xl && xl.head.join('|') === 'Remark|Debit to|Debit rate' && xl.val && xl.val[0] === 'Multi Vendor' && Number(xl.val[1]) === 40, xl);
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/batch.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/batch.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); try { execSync('su postgres -c "psql -d rcl -q" < /home/claude/vercel/sql/supabase_step1u_meter.sql 2>/dev/null; su postgres -c "psql -d rcl -q" < /home/claude/vercel/sql/supabase_step4_health.sql 2>/dev/null'); } catch (e2) {} process.exit(1); });
