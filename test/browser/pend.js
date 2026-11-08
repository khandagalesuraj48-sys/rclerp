// pending Log Book on the entry page · the date under the readings of the monthly report · the new words – through the page and the database
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} setLgMode('date'); }); await wait(2500);
  const today = await f.evaluate(() => S.today);
  // the Dashboard's own list for today = the strip's list
  const dash = await f.evaluate(async d => { const r = await call('pendingLog', {}); return r.items.filter(x => x.date === d).map(x => x.no).sort(); }, today);
  const strip = () => f.evaluate(() => { const bx = document.getElementById('lg_pend'); return { hidden: bx.hidden, head: (bx.querySelector('.lp-head span') || bx).textContent.replace(/\s+/g, ' ').trim().slice(0, 110), chips: [...bx.querySelectorAll('.lp-chips button')].map(x => x.textContent), ticked: [...bx.querySelectorAll('.lp-chips button.in')].map(x => x.textContent), all: (bx.querySelector('[data-lpall]') || {}).textContent || '' }; });
  let s = await strip();
  ok('entry by date: the page itself lists the machinery that have no Log Book for the date – the same ones as the Dashboard\'s pending list', !s.hidden && s.chips.length === dash.length && dash.length > 0 && s.chips.slice().sort().join() === dash.join() && new RegExp(dash.length + ' machinery').test(s.head), { head: s.head, onPage: s.chips.length, dashboard: dash.length });
  const first = s.chips[0];
  await f.evaluate(() => document.querySelector('#lg_pend .lp-chips button').click()); await wait(900);
  const r1 = await f.evaluate(() => ({ rows: lgRows().length, no: lgf(lgRows()[0], 'no').value }));
  s = await strip();
  ok('a press on a name puts that machinery into the (empty) first row and ticks it in the list', r1.rows === 1 && r1.no === first && s.ticked.join() === first && /1 already in the rows/.test(s.head), { row: r1, ticked: s.ticked, head: s.head });
  await f.evaluate(() => document.querySelector('#lg_pend [data-lpall]').click()); await wait(1500);
  const r2 = await f.evaluate(() => ({ rows: lgRows().length, nos: new Set(lgRows().map(tr => lgf(tr, 'no').value)).size }));
  s = await strip();
  const expectRows = Math.min(dash.length, 31);
  ok('"Add the next 30" puts thirty more into rows, one row each, all ticked', r2.rows === expectRows && r2.nos === expectRows && s.ticked.length === expectRows, { rows: r2.rows, different: r2.nos, ticked: s.ticked.length, of: dash.length });
  await p.screenshot({ path: 'shots/pend_date.png' });
  // a save elsewhere makes one less pending
  const one = dash[0];
  await f.evaluate(async (no, d) => { await call('saveLogRows', { rows: [{ date: d, shift: 'Full Day', no: no, mode: 'Idle' }] }); await lgPendLoad(true); }, one, today); await wait(600);
  s = await strip();
  ok('after an entry is saved for one of them it is no longer listed', s.chips.length === dash.length - 1 && s.chips.indexOf(one) === -1, { before: dash.length, now: s.chips.length });
  // entry by machinery: its pending dates
  const mach = await f.evaluate(async no => { setLgMode('mach'); const el = document.getElementById('lg_top_no'); el.value = no; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, dash[1]); await wait(2500);
  const want = sql("select count(*) from generate_series(greatest(date '2026-09-01', coalesce((select active_from from master where id = '" + dash[1] + "'), date '2026-09-01')), date '" + today + "', interval '1 day') g where not exists (select 1 from log_book l where l.machinery = '" + dash[1] + "' and l.date = g::date)");
  s = await strip();
  ok('entry by machinery: the page lists that machinery\'s dates without an entry (counted again from the database)', !s.hidden && s.chips.length === Number(want) && new RegExp(dash[1].replace(/[-]/g, '\\-') + ' – dates without').test(s.head), { head: s.head, onPage: s.chips.length, database: Number(want) });
  const before = await f.evaluate(() => lgRows().map(tr => lgf(tr, 'date').value));
  const firstDate = await f.evaluate(() => { const b = document.querySelector('#lg_pend .lp-chips button:not(.in)'); const k = b.dataset.lp; b.click(); return k; }); await wait(900);
  const r3 = await f.evaluate(() => ({ dates: lgRows().map(tr => lgf(tr, 'date').value), nos: [...new Set(lgRows().map(tr => lgf(tr, 'no').value))] }));
  ok('a press on a date adds a row for that date, at its place by date (above the later row), for the same machinery', r3.dates.length === before.length + 1 && r3.dates.indexOf(firstDate) > -1 && before.every(d => r3.dates.indexOf(d) > -1) && r3.dates.join() === r3.dates.slice().sort().join() && r3.nos.join() === dash[1], { before: before, pressed: firstDate, now: r3.dates });
  // "Add all" for one machinery: its pending dates, each its own row, in date order, the dates left as they are (they have gaps)
  await f.evaluate(() => document.querySelector('#lg_pend [data-lpall]').click()); await wait(2500);
  if (await f.evaluate(() => !!document.querySelector('#lg_pend [data-lpall]'))) { await f.evaluate(() => document.querySelector('#lg_pend [data-lpall]').click()); await wait(1500); }
  const r4 = await f.evaluate(() => { const L = lgPendList(); const d = lgRows().map(tr => lgf(tr, 'date').value); return { rows: d.length, sorted: d.join() === d.slice().sort().join(), unique: new Set(d).size, pending: L.items.length, allIn: L.items.every(x => x.inn) }; });
  ok('"Add all" for one machinery: every pending date gets its own row, in date order, none changed', r4.rows === r4.pending && r4.unique === r4.rows && r4.sorted && r4.allIn, r4);
  await p.screenshot({ path: 'shots/pend_mach.png' });
  await f.evaluate(async (no, d) => { await call('deleteLogRow', no + '|' + d + '|Full Day'); }, one, today);
  // ---------- the monthly report: date under the readings, the new words ----------
  const rep = await f.evaluate(async () => { const d = await call('getMonthlyAvgReport', { from: '2026-09-01', to: '2026-09-30' }); const rows = [].concat(...d.groups.map(g => g.rows)).filter(r => r.cDate);
    const words = {}; [].concat(...d.groups.map(g => g.rows)).forEach(r => { if (r.statusCode) words[r.statusCode] = r.status; }); return { n: rows.length, sample: rows.slice(0, 1).map(r => ({ id: r.id, oDate: r.oDate, cDate: r.cDate, cKm: r.cKm, cHr: r.cHr }))[0], words: words }; });
  const dbLast = rep.sample ? sql("select max(date)::text || '|' || min(date)::text from log_book where machinery = '" + rep.sample.id + "' and date between '2026-09-01' and '2026-09-30'") : '';
  ok('monthly report: each reading carries the date of the Log Book entry it comes from (checked against the database)', rep.n > 0 && dbLast === rep.sample.cDate + '|' + rep.sample.oDate, { machinery: rep.sample, database: dbLast });
  ok('…and the status is said in the new words', Object.keys(rep.words).every(k => /^(Good|Very good – \d+% less diesel|More diesel – \d+% over|Bad – \d+% more diesel|Check reading – too good \(\d+% less diesel\))$/.test(rep.words[k]) || k === 'na') && !!rep.words.ok, rep.words);
  await f.evaluate(() => { showTab('ravg'); document.getElementById('ra_from').value = '2026-09-01'; document.getElementById('ra_to').value = '2026-09-30'; document.getElementById('ra_go').click(); });
  for (let i = 0; i < 40; i++) { await wait(500); if (await f.evaluate(() => !document.getElementById('ra_out').hidden && document.querySelectorAll('#ra_out small.rdd').length > 0)) break; }
  const pg = await f.evaluate(() => { const s = [...document.querySelectorAll('#ra_out small.rdd')].map(x => x.textContent); const st = [...new Set([...document.querySelectorAll('#ra_out .mst')].map(x => x.textContent.replace(/\d+/g, 'N')))]; return { dates: s.length, sample: s.slice(0, 2).join(', '), badges: st.join(' | '), old: /High consumption|Low consumption|Balanced/.test(document.getElementById('ra_out').textContent) }; });
  ok('on the page: a small date under the readings (dd-mm), the new words, none of the old three', pg.dates > 0 && /^\d\d-\d\d/.test(pg.sample) && /Good/.test(pg.badges) && !pg.old, pg);
  await f.evaluate(() => { const o = document.getElementById('ra_out'); if (o) o.scrollIntoView(); }); await wait(300); await p.screenshot({ path: 'shots/monthly_dates.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/pend.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/pend.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
