// a save that does not get through is sent again by itself, and is saved ONCE – through the page, the server and the database
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 360) : '')); };
const count = remark => Number(sql("select count(*) from diesel_issue where remark = '" + remark + "'"));
(async () => {
  sql("delete from diesel_issue where remark like 'RETRY-%'");
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const RUN = Date.now().toString(36);      // a save number is answered from memory for an hour: every run of the test uses its own numbers
  const issue = remark => ({ date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0001', qty: 7, kmReading: 999999, remark: remark, force: true });
  // ---- the server by itself ----
  let a = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [issue('RETRY-A')]], rid: 'testrid-A-' + RUN });
  let b = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [issue('RETRY-A')]], rid: 'testrid-A-' + RUN });
  ok('server: the same save number sent twice is saved once, and the second copy gets the first answer', count('RETRY-A') === 1 && a.result && b.result && a.result.id === b.result.id, { first: a.result && a.result.id, second: b.result ? b.result.id : b.error });
  const both = await Promise.all([post({ fn: 'api', args: [tk, 'saveDieselIssue', [issue('RETRY-B')]], rid: 'testrid-B-' + RUN }), wait(40).then(() => post({ fn: 'api', args: [tk, 'saveDieselIssue', [issue('RETRY-B')]], rid: 'testrid-B-' + RUN }))]);
  ok('server: two copies at the same moment → one entry, both get its answer', count('RETRY-B') === 1 && both[0].result && both[1].result && both[0].result.id === both[1].result.id, both.map(x => x.result ? x.result.id : x.error));
  a = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [Object.assign(issue('RETRY-C'), { qty: -5 })]], rid: 'testrid-C-' + RUN });
  b = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [Object.assign(issue('RETRY-C'), { qty: -5 })]], rid: 'testrid-C-' + RUN });
  ok('server: an entry that is refused is refused the same way again (nothing saved)', !!a.error && a.error === b.error && count('RETRY-C') === 0, a.error);
  a = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [issue('RETRY-D')]] }); b = await post({ fn: 'api', args: [tk, 'saveDieselIssue', [issue('RETRY-D')]] });
  ok('server: without a number the old guard still holds (the same new entry twice within seconds is refused)', count('RETRY-D') === 1 && /sent twice/.test(b.error || ''), b.error || 'saved twice');
  // ---- the page ----
  const br = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await br.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(5500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  // the network between the page and the server, as the test wants it
  let mode = 'ok', seen = [];
  await p.setRequestInterception(true);
  p.on('request', async r => {
    const d = r.postData() || '';
    if (!/api\/rpc/.test(r.url()) || !/RETRY-/.test(d)) return r.continue().catch(() => {});
    seen.push(JSON.parse(d).rid || 'no number');
    if (mode === 'drop2' && seen.length <= 2) return r.abort('connectionfailed').catch(() => {});                 // never reaches the server
    if (mode === 'lost1' && seen.length === 1) { try { await fetch('http://127.0.0.1:3000/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: d }); } catch (e) {} return r.abort('connectionreset').catch(() => {}); }   // reaches the server, the answer is lost
    return r.continue().catch(() => {});
  });
  const save = (remark, extra) => f.evaluate((rm, ex) => { window.__res = null; call('saveDieselIssue', Object.assign({ date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0001', qty: 7, kmReading: 999999, remark: rm, force: true }, ex || {})).then(r => { window.__res = { ok: true, id: r.id }; }, e => { window.__res = { ok: false, err: String(e.message || e) }; }); }, remark, extra);
  const result = async ms => { for (let i = 0; i < ms / 200; i++) { const r = await f.evaluate(() => window.__res); if (r) return r; await wait(200); } return null; };
  const note = () => f.evaluate(() => { const x = document.getElementById('rcl_retry'); return x && !x.hidden ? x.textContent : ''; });
  // 1. the connection drops twice before the save reaches the server
  mode = 'drop2'; seen = []; await save('RETRY-E'); await wait(900);
  const n1 = await note(), saving1 = await f.evaluate(() => window.__rclSaving());
  let r = await result(12000);
  ok('page: connection lost → the person sees "kept, being sent again" (in Marathi), not "not saved"', /Connection नाही – तुमची entry जपली आहे आणि आपोआप पुन्हा पाठवली जात आहे/.test(n1) && saving1 === 1, n1);
  ok('…and it is saved by itself when the connection is back: one entry, the same number every time', r && r.ok && count('RETRY-E') === 1 && seen.length === 3 && new Set(seen).size === 1 && seen[0] !== 'no number', { result: r, tries: seen.length, rows: count('RETRY-E') });
  await wait(300); ok('…then "Save झाले ✔" for a moment, and nothing is waiting any more', /Save झाले ✔/.test(await note()) && (await f.evaluate(() => window.__rclSaving())) === 0, await note());
  // 2. the save reaches the server but the answer is lost on the way back
  mode = 'lost1'; seen = []; await save('RETRY-F'); r = await result(15000);
  ok('page: saved on the server, answer lost → sent again → still ONE entry, and the page gets its answer', r && r.ok && !!r.id && count('RETRY-F') === 1 && seen.length === 2, { result: r, tries: seen.length, rows: count('RETRY-F') });
  // 3. an entry the server refuses is shown, not sent again
  mode = 'ok'; seen = []; await save('RETRY-G', { qty: -3 }); r = await result(8000);
  ok('page: a refused entry is said at once and is not sent again', r && !r.ok && seen.length === 1 && count('RETRY-G') === 0, { result: r, tries: seen.length });
  ok('no script error', errs.length === 0, errs.join(' | '));
  sql("delete from diesel_issue where remark like 'RETRY-%'");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/retry.out', out.join('\n')); await br.close();
})().catch(e => { fs.writeFileSync('/tmp/retry.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
