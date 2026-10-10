// Edit Log Book grid, the look: (1) the time boxes of a Time row stay inside their cell (they took the whole cell: To, Break and
// Challan ran over Total and the next columns); (2) every figure of the total line stands under its own heading (for a machinery
// with ONE way of working they stood one column to the left).   node lxlook.js [port]   (3002 = the version before, to see it fail)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 640) : '')); };
const clean = () => sql("delete from log_book where machinery like 'LXV-%'; delete from master where id like 'LXV-%';");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) })).json(); } catch (e) { if (i >= 8) throw e; await wait(700); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 240)); return r; };
  const mk = (no, type, works, unit) => api('saveMaster', Object.assign({ no: no, name: type, type: type, unit: unit, worksOn: works, owner: 'Look Vendor', ownership: 'Rental', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, unit === 'Hrs' ? { hrStd: 4 } : { kmStd: 4 }), 'add');
  E(await mk('LXV-T', 'JCB', ['Hrs', 'Time'], 'Hrs')); E(await api('saveLbFormats', { 'LXV-T': 'F' }));     // his screen: the format with times (one way: Time)
  E(await mk('LXV-A', 'JCB', ['Hrs', 'Time'], 'Hrs'));                                                       // Hrs + Time, the usual format (Challan inside the time cell)
  E(await mk('LXV-K', 'Tipper', ['KM'], 'KM')); E(await mk('LXV-H', 'Poclain', ['Hrs'], 'Hrs'));            // one way each
  const T = no => [{ date: '2026-09-01', shift: 'Day', no: no, mode: 'Time', tStart: '11:00', tEnd: '17:00', tSlots: [['11:00', '13:00'], ['14:00', '17:00']] }, { date: '2026-09-07', shift: 'Day', no: no, mode: 'Time', tStart: '09:00', tEnd: '18:30', tSlots: [['09:00', '13:00'], ['14:00', '18:30']] }, { date: '2026-09-08', shift: 'Full Day', no: no, mode: 'Time', tStart: '08:00', tEnd: '12:30', tSlots: [['08:00', '12:30']], tBreak: 30 }];
  E(await api('saveLogRows', { rows: T('LXV-T') })); E(await api('saveLogRows', { rows: T('LXV-A') }));
  E(await api('saveLogRows', { rows: [{ date: '2026-09-01', shift: 'Full Day', no: 'LXV-K', mode: 'KM', openingKm: 1000, closingKm: 1080, openingDiesel: 0 }, { date: '2026-09-02', shift: 'Full Day', no: 'LXV-K', mode: 'KM', openingKm: 1080, closingKm: 1140 }] }));
  E(await api('saveLogRows', { rows: [{ date: '2026-09-01', shift: 'Full Day', no: 'LXV-H', mode: 'Hrs', openingHr: 100, closingHr: 106, openingDiesel: 0 }] }));
  ok('the test machinery and entries are saved', !seedErr.length && sql("select count(*) from log_book where machinery like 'LXV-%'") === '9', seedErr.join(' // ') || '9 entries');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1000 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  const open = async (no, w) => { await p.setViewport({ width: w, height: 1000 }); await f.evaluate(no => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; LX.rows = []; LX.deleted = []; showTab('logedit'); document.getElementById('lx_from').value = '2026-09-01'; document.getElementById('lx_to').value = '2026-09-30'; const n = document.getElementById('lx_no'); n.value = no; n.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('lx_load').click(); }, no); await wait(3500);
    return f.evaluate(() => { const bx = el => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }; const t = document.querySelector('table.lx-t');
      const heads = [...t.querySelectorAll('thead th')].map(th => ({ t: th.textContent.trim(), b: bx(th) }));
      const foot = [...t.querySelectorAll('tfoot td')]; let k = 0; const fc = foot.map(td => { const span = td.colSpan || 1, h0 = heads[k], h1 = heads[k + span - 1]; k += span; return { t: td.textContent.trim(), b: bx(td), under: h1 ? h1.t : '(no heading)', fits: !!h0 && !!h1 && Math.abs(bx(td)[0] - h0.b[0]) <= 1 && Math.abs(bx(td)[1] - h1.b[1]) <= 1 }; });
      const rows = [...t.querySelectorAll('tbody tr[data-i]')].map(tr => { const td = tr.querySelector('.lx-tm'); if (!td) return null; const ins = [...td.querySelectorAll('input')]; const tops = ins.map(i => Math.round(i.getBoundingClientRect().top));
        return { cell: bx(td), boxes: ins.map(i => (i.dataset.f || '') + ' ' + bx(i).join('-')), inside: ins.every(i => bx(i)[0] >= bx(td)[0] - 1 && bx(i)[1] <= bx(td)[1] + 1), oneLine: tops.every(y => Math.abs(y - tops[0]) <= 2), timeW: ins.filter(i => i.type === 'time').map(i => bx(i)[1] - bx(i)[0]) }; }).filter(Boolean);
      return { heads: heads.length, footCols: k, foot: fc.filter(x => x.t), allFit: fc.every(x => x.fits), rows: rows, split: [...t.querySelectorAll('.lx-split')].map(x => x.textContent) }; }); };
  for (const w of [1920, 1366]) {
    const a = await open('LXV-T', w);
    ok('his screen (format with times) at ' + w + ' wide: From, To and Break of every Time row are inside the "Time / Trips" cell, on one line, the time boxes wide enough for the whole time (≥ 100 px, not the whole cell)',
      a.rows.length === 3 && a.rows.every(r => r.inside && r.oneLine && r.timeW.every(x => x >= 100 && x <= 140)), a.rows[0]);
    if (w === 1920) { await f.evaluate(() => document.querySelector('table.lx-t').scrollIntoView({ block: 'center' })); await wait(300); await p.screenshot({ path: '/home/claude/test/shots/lxlook_' + port + '.png', clip: { x: 268, y: 330, width: 1640, height: 330 } });
      ok('   the split entries still show their split under the row', a.split.length === 2 && /11:00 – 13:00 \(2\) \+ 14:00 – 17:00 \(3\)/.test(a.split[0]), a.split); }
    ok('   the total line: its hours stand under "Total" (' + w + ')', a.footCols === a.heads && a.allFit && a.foot.some(x => /17\.5 hr/.test(x.t) && x.under === 'Total'), a.foot.map(x => x.t + ' under "' + x.under + '"'));
  }
  const a2 = await open('LXV-A', 1920);
  ok('Hrs + Time machinery, the usual format: From, To, Break and Challan No inside the cell on one line', a2.rows.length === 3 && a2.rows.every(r => r.inside && r.oneLine && r.boxes.length === 4), a2.rows[0]);
  const k = await open('LXV-K', 1920);
  ok('machinery with ONE way (KM only): the total line has the columns of the heading – KM under "Total", diesel issued under "Issued", consumed under "Consumed", closing under "Closing diesel (est.)"',
    k.footCols === k.heads && k.allFit && k.foot.some(x => /140 km/.test(x.t) && x.under === 'Total') && k.foot.filter(x => /^-?[\d.,]+$/.test(x.t)).map(x => x.under).join('|') === 'Issued|Consumed|Closing diesel (est.)', k.foot.map(x => x.t + ' under "' + x.under + '"'));
  const h = await open('LXV-H', 1920);
  ok('machinery with ONE way (Hrs only): the same', h.footCols === h.heads && h.allFit && h.foot.some(x => /6 hr/.test(x.t) && x.under === 'Total'), h.foot.map(x => x.t + ' under "' + x.under + '"'));
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log('port ' + port + '\n' + out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
