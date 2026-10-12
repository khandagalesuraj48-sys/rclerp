// update-83 (asked 12-10-2026): the universal search (Ctrl + K) – a spelling mistake still finds the name and suggests the right
// spelling; a reading is found in the Log Book (also between Start and Close) and the Diesel Issue; a result opens its page.
// On the local rig only.   node search83.js [port]
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const port = process.argv[2] || '3000';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 900) : '')); };
const clean = () => sql("delete from log_book where machinery like 'N83-%'; delete from diesel_issue where machinery like 'N83-%'; delete from diesel_inward where pump_name = 'N83 Pump'; delete from master where id like 'N83-%'; delete from vendors where vendor_name = 'N83 Sainath Earthmovers'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  await wait(1300);
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveVendor', { name: 'N83 Sainath Earthmovers', gstReg: 'No', pan: 'ABCDE1283N', bank: 'SBI', account: '12345683', ifsc: 'SBIN0000001' }, 'add'));
  E(await api('saveMaster', { no: 'N83-JCB', name: 'JCB', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'N83 Sainath Earthmovers', ownership: 'Rental', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveLogRows', { rows: [{ no: 'N83-JCB', date: '2026-10-05', shift: 'Full Day', mode: 'Hrs', openingHr: 3714.5, closingHr: 3717.5, driver: 'Anandrao Patil', work: 'ROCK BREAKING', challan: 'CH-8371' }] }));
  E(await api('saveInward', { date: '2026-10-04', location: 'Dispenser', pump: 'N83 Pump', qty: 500, rate: 92, billNo: 'N83-IN', billDate: '2026-10-04' }));
  E(await api('saveDieselIssue', { date: '2026-10-05', shift: 'Day', source: 'Dispenser', no: 'N83-JCB', qty: 40, hrReading: 3714.5, driver: 'Anandrao Patil', force: true }));
  ok('test data: machinery N83-JCB, driver "Anandrao Patil", Log Book 05-10 3714.5 → 3717.5 (challan CH-8371), a diesel issue at reading 3714.5, vendor "N83 Sainath Earthmovers"', !seedErr.length, seedErr.join(' // ') || 'ready');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' }); await wait(1200);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const search = async q => { const t0 = Date.now(); await f.evaluate(q => { if ($('gs_back').hidden) gsOpen(); const i = $('gs_in'); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); }, q);
    for (let k = 0; k < 40; k++) { await wait(150); if (await f.evaluate(() => !!GS.server)) break; } const ms = Date.now() - t0;
    return Object.assign(await f.evaluate(() => ({ fix: ($('gs_list').querySelector('.gs-fix') || {}).textContent || '', groups: [...$('gs_list').querySelectorAll('.gs-grp')].map(g => g.textContent),
      items: [...$('gs_list').querySelectorAll('.gs-item')].map(x => x.querySelector('b').textContent + ' ¦ ' + x.querySelector('small').textContent) })), { ms: ms }); };
  const click = async (re, onTitle) => f.evaluate((src, t) => { const it = [...$('gs_list').querySelectorAll('.gs-item')].find(x => new RegExp(src).test(t ? x.querySelector('b').textContent : x.textContent)); if (!it) return false; it.click(); return true; }, re, !!onTitle);

  // 1. "annd" – a letter missing
  let r = await search('annd');
  ok('"annd": the Log Book entry and the diesel issue of driver Anandrao are found ("found: Driver: Anandrao Patil"), and it asks "Did you mean anandrao?"',
    r.items.some(x => /^N83-JCB\s+–\s+05-10-2026/.test(x) && /found: Driver: Anandrao Patil/.test(x)) && r.items.some(x => /N83-JCB/.test(x) && /40 L/.test(x)) && /Did you mean anandrao\?/i.test(r.fix), r);
  await p.screenshot({ path: '/home/claude/test/shots/search83_annd.png' });
  await f.evaluate(() => $('gs_list').querySelector('.gs-fixbtn').click()); await wait(1500);
  ok('   pressing the suggestion puts "anandrao" in the box', await f.evaluate(() => $('gs_in').value) === 'anandrao');
  // 2. a reading between Start and Close
  r = await search('3716');
  ok('a reading in between (3716): the Log Book entry 3714.5 → 3717.5 it falls in', r.items.some(x => /^N83-JCB\s+–\s+05-10-2026/.test(x) && /3,?714\.5 → 3,?717\.5 \(3716 is in between\)/.test(x)), r);
  // 3. the exact reading: Log Book (Start Hrs) and Diesel Issue (Hrs reading)
  r = await search('3714.5');
  ok('the exact reading (3714.5): in the Log Book (Start Hrs) and in the Diesel Issue (Hrs reading)', r.items.some(x => /Start Hrs: 3714\.5/.test(x)) && r.items.some(x => /Hrs reading: 3714\.5/.test(x)), r.items);
  await click('Start Hrs: 3714\\.5'); await wait(3000);
  const lg = await f.evaluate(() => ({ tab: S.curTab, no: $('lf_no').value, from: $('lf_from').value, to: $('lf_to').value, rows: (S.logList && S.logList.rows || []).map(x => x.no + ' ' + x.date) }));
  ok('   the result opens the Log Book on that machinery and date, with the entry in the list', lg.tab === 'log' && lg.no === 'N83-JCB' && lg.from === '2026-10-05' && lg.to === '2026-10-05' && lg.rows.join() === 'N83-JCB 2026-10-05', lg);
  // 4. machinery + challan, typed without dashes; a vendor with a typo – and it opens the vendor
  r = await search('n83jcb ch8371');
  ok('machinery and challan written without dashes ("n83jcb ch8371") find the entry', r.items.some(x => /^N83-JCB\s+–\s+05-10-2026/.test(x)), r.items);
  r = await search('sainth earthmovers');
  ok('a vendor with a spelling mistake ("sainth earthmovers") is found', r.items.some(x => /^N83 Sainath Earthmovers/.test(x)), r.items);
  const vchip = await f.evaluate(() => { const it = [...$('gs_list').querySelectorAll('.gs-item')].filter(x => x.querySelector('b').textContent === 'N83 Sainath Earthmovers'); const c = it.length === 1 ? [...it[0].querySelectorAll('.gs-chip')].find(x => x.textContent === 'Vendor') : null; if (c) c.click(); return { same: it.length, chip: !!c }; });
  ok('   the owner and the vendor of the same name are ONE result, with a "Vendor" button', vchip.same === 1 && vchip.chip, vchip); await wait(2500);
  const vd = await f.evaluate(() => ({ tab: S.curTab, q: $('vf_q').value, shown: [...document.querySelectorAll('#sec-vendors tbody tr')].map(t => t.textContent).filter(t => /Sainath/.test(t)).length }));
  ok('   the result opens Vendor Master filtered to that vendor', vd.tab === 'vendors' && vd.q === 'N83 Sainath Earthmovers' && vd.shown >= 1, vd);
  // 5. nothing found: a plain message; and it answers quickly
  r = await search('qqqxw');
  ok('nothing found → a plain message, no wrong suggestion', !r.items.length && !r.fix, r);
  ok('the answers come quickly (each search under 3 s on the rig)', r.ms < 3000, r.ms + ' ms');
  ok('no script error', !errs.length, errs);
  await b.close(); try { clean(); } catch (e) { out.push('clean after: ' + String(e.message).slice(0, 200)); }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); try { clean(); } catch (e2) {} process.exit(1); });
