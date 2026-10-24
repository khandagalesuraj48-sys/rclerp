// update-155: WHAT ONE OPEN PAGE COSTS, phase by phase – the same script on main and on the branch, the same test data.
// Counts: requests and bytes the browser gets (by action), what the server asks the (test) database (calls and bytes, from the
// rig's meter on :3100), and the CPU time of the app server process (/proc). On the local rig only:
//   node test/traffic155.js [out.json]      (the rig's app server :3001, test data from the rig's seed; never a live address)
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const U = 'http://127.0.0.1:3001', M = 'http://127.0.0.1:3100/__meter';
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const meter = async reset => { const j = await (await fetch(M)).json(); if (reset) await fetch(M, { method: 'POST' }); return j; };
const post = async b => JSON.parse(await (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).text());
// the app server on :3001: its process id and CPU time (user + system, ms)
const pid = (() => { for (const p of fs.readdirSync('/proc').filter(x => /^\d+$/.test(x))) { try { const c = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8'); if (!/dev\.js/.test(c)) continue; if (/(^|\0)PORT=3001(\0|$)/.test(fs.readFileSync('/proc/' + p + '/environ', 'utf8'))) return p; } catch (e) { /* not ours */ } } return null; })();
const tick = Number(execSync('getconf CLK_TCK').toString().trim()) || 100;
const cpu = () => { try { const f = fs.readFileSync('/proc/' + pid + '/stat', 'utf8').split(') ')[1].split(' '); return (Number(f[11]) + Number(f[12])) * 1000 / tick; } catch (e) { return NaN; } };
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  let calls = []; const errs = [], report = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  p.on('response', async r => { const u = r.url(); if (!u.startsWith(U)) return; const q = r.request(); let fn = u.replace(U, '').split('?')[0];
    if (u.indexOf('/api/rpc') > -1) { try { const j = JSON.parse(q.postData() || '{}'); fn = 'rpc ' + (j.fn === 'api' ? j.args[1] : j.fn); } catch (e) {} }
    let n = 0, kind = ''; try { const buf = await r.buffer(); n = buf.length; const head = buf.slice(0, 60).toString(); kind = /"same":1/.test(head) ? 'same' : /"base":"/.test(head) ? 'delta' : ''; } catch (e) { n = Number(r.headers()['content-length'] || 0); }
    calls.push({ fn, n, kind }); });
  let c0 = cpu();
  const phase = async (label, secs) => {
    const by = {}; calls.forEach(c => { const x = by[c.fn] || (by[c.fn] = { n: 0, bytes: 0, same: 0, delta: 0 }); x.n++; x.bytes += c.n; if (c.kind) x[c.kind]++; });
    const rows = Object.entries(by).sort((a, b2) => b2[1].bytes - a[1].bytes); const tot = rows.reduce((s, [, x]) => s + x.bytes, 0), cnt = rows.reduce((s, [, x]) => s + x.n, 0);
    const j = await meter(true), c1 = cpu();
    const rec = { label, secs, requests: cnt, rpc: rows.filter(([k]) => /^rpc /.test(k)).reduce((s, [, x]) => s + x.n, 0), browserBytes: tot, dbCalls: j.rows.reduce((s, r) => s + r.calls, 0), dbBytes: j.total, dbTop: j.rows.slice(0, 6).map(r => r.kind + ' ' + r.calls + '× ' + (r.bytes / 1024).toFixed(1) + ' KiB'), serverCpuMs: Math.round(c1 - c0), by: Object.fromEntries(rows) };
    c0 = c1; report.push(rec); calls = [];
    console.log('## ' + label + ' (' + secs + ' s): ' + cnt + ' requests (' + rec.rpc + ' to /api/rpc), ' + (tot / 1024).toFixed(1) + ' KiB to the browser · database → server ' + (j.total / 1024).toFixed(1) + ' KiB in ' + rec.dbCalls + ' calls · server CPU ' + rec.serverCpuMs + ' ms');
    console.log('   database: ' + rec.dbTop.join(' | '));
    rows.forEach(([k, x]) => console.log('   ' + k.padEnd(28) + String(x.n).padStart(5) + ' × ' + String(Math.round(x.bytes / x.n)).padStart(8) + ' B = ' + (x.bytes / 1024).toFixed(1) + ' KiB' + (x.same || x.delta ? '   (same ' + x.same + ', changes only ' + x.delta + ')' : ''))); };
  await meter(true);
  // A. opening the app and signing in, the Dashboard on screen
  await p.goto(U + '/', { waitUntil: 'load' }); await wait(1500);
  let F = null; for (let i = 0; i < 40 && !F; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(() => !!document.getElementById('lg_email'))) F = x; } catch (e) {} } if (!F) await wait(300); }
  await F.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
  await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', 'Nashik#Road848!'); await F.click('#lg_btn');
  await wait(20000); await phase('A. open the app, sign in, Dashboard on screen', 22);
  const move = async secs => { const end = Date.now() + secs * 1000; let k = 0; while (Date.now() < end) { await p.mouse.move(200 + (k % 50) * 4, 300 + (k % 7) * 10); k++; await wait(4000); } };
  // B. working on the Dashboard, nobody else saving
  await move(120); await phase('B. working on the Dashboard, nobody saving', 120);
  // C. the Log Book page and the Diesel Issue page opened
  await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(6000);
  await F.evaluate(() => { try { showTab('diesel'); } catch (e) {} }); await wait(6000); await phase('C. Log Book page + Diesel Issue opened', 12);
  // D. another person saves a diesel issue (of today) every 15 s, this page on Diesel Issue
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token; const saved = [];
  const other = (async () => { for (let i = 0; i < 6; i++) { await wait(15000); const r = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [{ date: TODAY, shift: 'Day', source: 'Dispenser', no: 'AU-' + String(10 + i * 3).padStart(2, '0'), qty: 30 + i, kmReading: 900000 + i * 10, hrReading: 900000 + i * 10, driver: 'Traffic ' + i, force: true }]], rid: 'tr155' + Date.now().toString(36) + i }); saved.push(r.error ? 'ERR ' + String(r.error).slice(0, 80) : 'ok'); } })();
  await move(92); await other; await phase('D. Diesel Issue on screen while another person saves 6 issues (one every 15 s)', 92);
  // E. a page that others' entries do not change (the Monthly report), somebody working on it
  await F.evaluate(() => { try { showTab('rmonthly'); } catch (e) {} }); await move(60); await phase('E. working on a report page (Monthly report), nobody saving', 60);
  // F. the tab in the background (the page is told it is hidden – the headless browser cannot hide a tab)
  await F.evaluate(() => { try { showTab('diesel'); } catch (e) {} }); await wait(3000); calls = []; await meter(true); c0 = cpu();
  const hide = h => Promise.all(p.frames().map(fr => fr.evaluate(h => { try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); } catch (e) {} }, h).catch(() => {})));
  await hide(true); await wait(120000); await phase('F. tab in the background (hidden)', 120);
  // G. back on screen: caught up at once
  await hide(false); await wait(5000); await phase('G. back on screen (catch-up)', 5);
  // H. the Dashboard on screen while another person saves 4 diesel issues (one every 15 s)
  await F.evaluate(() => { try { showTab('dash'); } catch (e) {} }); await wait(6000); calls = []; await meter(true); c0 = cpu();
  const other2 = (async () => { for (let i = 0; i < 4; i++) { await wait(15000); const r = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [{ date: TODAY, shift: 'Night', source: 'Dispenser', no: 'AU-' + String(31 + i * 3).padStart(2, '0'), qty: 20 + i, kmReading: 950000 + i * 10, hrReading: 950000 + i * 10, driver: 'Traffic D' + i, force: true }]], rid: 'tr155d' + Date.now().toString(36) + i }); saved.push(r.error ? 'ERR ' + String(r.error).slice(0, 80) : 'ok'); } })();
  await move(66); await other2; await phase('H. Dashboard on screen while another person saves 4 issues (one every 15 s)', 66);
  console.log('other person\'s saves:', saved.join(', '), '· page errors:', JSON.stringify(errs));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ saved, errs, report }, null, 1));
  await b.close();
})().catch(e => { console.log('ERR', e.stack); process.exit(1); });
