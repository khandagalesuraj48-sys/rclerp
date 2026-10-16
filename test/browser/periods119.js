// update-119 (a machinery on a site several times) in the browser, on the local rig (Mechanical :3001, site S1). Test data only:
// machinery "PR-119" (on site 01-01-2026 …, left 01-07-2026) and its diesel, taken out at the end.
//   1. Asset Master → Edit PR-119 (Inactive from 01-07-2026) → Status Active → "Did PR-119 come back to the site?" → came back
//      on 01-09-2026 → Save: the change list says "It came back"; saved: Active from 01-09-2026, earlier 01-01-2026 – 30-06-2026;
//   2. the badge shows the earlier period; the form shows it under "Earlier periods on site";
//   3. the Diesel Issue picker: on 15-08-2026 PR-119 is not offered; on 15-06-2026 and 05-09-2026 it is;
//   4. the dates 01-08 … 31-08 of the Asset Master do not show it; 15-06 … 31-08 do; no page error.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node periods119.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', SHOT = process.env.SHOTS || '/tmp';
(async () => {
  const cleanup = () => sql("delete from diesel_issue where machinery = 'PR-119'; delete from diesel_inward where bill_number = 'PR119'; delete from master where id = 'PR-119'; delete from web.cache where key like 'SB%';");
  const post = async body => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  let b = null; const errs = [];
  try {
    cleanup();
    const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const M = { no: 'PR-119', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' };
    const s1 = await api('saveMaster', M, 'add');
    const s0 = await api('saveInward', { date: '2026-06-01', location: 'Dispenser', pump: 'Pump 119', qty: 100, rate: 92, billNo: 'PR119', billDate: '2026-06-01' });
    if (!s0.ok) out.push('seed inward: ' + JSON.stringify(s0));
    const s2 = await api('saveDieselIssue', { date: '2026-06-10', shift: 'Day', source: 'Dispenser', no: 'PR-119', qty: 5, kmReading: 500, force: true });
    const s3 = await api('saveMaster', Object.assign({}, M, { status: 'Inactive', inactiveFrom: '2026-07-01' }), 'edit', 'PR-119');
    ok('seed: PR-119 on site from 01-01-2026, a diesel issue on 10-06, left on 01-07-2026', s1.ok && s2.ok && s3.ok, [s1.ok || s1, s2, s3.ok || s3]);
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', 'Nashik#Road848!'); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user && !!S.today && (S.master || []).some(m => m.id === 'PR-119'));
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('master'); }); await wait(2000);
    // ---- 1. edit → Active → "did it come back?" ----
    await F.evaluate(() => editMaster('PR-119')); await wait(800);
    const f0 = await F.evaluate(() => ({ status: $('m_status').value, ifrom: $('m_ifrom').value, per: !$('m_per_wrap').hidden, perText: $('m_per').textContent.trim() }));
    ok('1. the form: Inactive from 01-07-2026; "Earlier periods on site" shown (none yet)', f0.status === 'Inactive' && f0.ifrom === '2026-07-01' && f0.per && /None/.test(f0.perText), f0);
    await F.evaluate(() => { $('m_status').value = 'Active'; $('m_status').dispatchEvent(new Event('change', { bubbles: true })); }); await wait(800);
    const q = await F.evaluate(() => ({ open: !$('cf_back').hidden, title: $('cf_title').textContent, ok: $('cf_ok').textContent, cancel: $('cf_cancel').textContent, back: ($('m_back') || {}).min }));
    ok('   Status Active → "' + q.title + '" (It came back on this date / It never left)', q.open && q.title === 'Did PR-119 come back to the site?' && q.ok === 'It came back on this date' && q.cancel === 'It never left' && q.back === '2026-07-01', q);
    await F.evaluate(() => { $('m_back').value = '2026-09-01'; $('cf_ok').click(); }); await wait(600);
    ok('   came back on 01-09-2026 → Active From 01-09-2026', await F.evaluate(() => $('m_afrom').value) === '2026-09-01');
    await p.screenshot({ path: SHOT + '/periods119_form.png' });
    await F.evaluate(() => $('m_save').click()); await wait(1500);
    const cf = await F.evaluate(() => ({ open: !$('cf_back').hidden, title: $('cf_title').textContent, text: $('cf_msg').textContent.replace(/\s+/g, ' ') }));
    ok('   the change list says "It came back: left on 01/07/2026 → back on 01/09/2026 (until then kept as an earlier period)"', cf.open && /It came back/.test(cf.text) && /back on .*2026 \(until then kept as an earlier period\)/.test(cf.text), cf);
    await F.evaluate(() => $('cf_ok').click()); await wait(3500);
    const row = JSON.parse(sql("select json_build_object('s', status, 'a', active_from, 'i', inactive_from, 'p', site_periods) from master where id = 'PR-119'"));
    ok('   saved: Active from 01-09-2026, earlier 01-01-2026 … (until) 01-07-2026', row.s === 'Active' && row.a === '2026-09-01' && !row.i && row.p === '[{"from":"2026-01-01","until":"2026-07-01"}]', row);
    // ---- 2. the badge and the form ----
    await F.evaluate(() => { $('mf_clear').click(); $('m_search').value = 'PR-119'; $('m_search').dispatchEvent(new Event('input')); }); await wait(1200);
    const badge = await F.evaluate(() => { const tr = [...document.querySelectorAll('#m_rows tr')].find(t => /PR-119/.test(t.textContent)); return tr ? tr.textContent.replace(/\s+/g, ' ') : ''; });
    ok('2. the Asset Master row: "Active from …09…2026", "earlier: 01…01…2026 – 30…06…2026"', /Active from/.test(badge) && /earlier: .*2026 – .*2026/.test(badge), badge);
    await F.evaluate(() => editMaster('PR-119')); await wait(800);
    const per = await F.evaluate(() => [...document.querySelectorAll('#m_per .m-per')].map(r => [r.querySelector('.mp-from').value, r.querySelector('.mp-until').value]));
    ok('   the form: earlier period From 01-01-2026, Inactive From 01-07-2026', JSON.stringify(per) === '[["2026-01-01","2026-07-01"]]', per);
    await F.evaluate(() => $('m_per_wrap').scrollIntoView({ block: 'center' })); await wait(400); await p.screenshot({ path: SHOT + '/periods119_periods.png' });
    await F.evaluate(() => { try { clearMaster(); } catch (e) {} });
    // ---- 3. the Diesel Issue picker by date ----
    await F.evaluate(() => showTab('diesel')); await wait(2000);
    const offered = async d => F.evaluate(async d => { $('d_date').value = d; $('d_date').dispatchEvent(new Event('change', { bubbles: true })); $('d_no').blur(); await new Promise(r => setTimeout(r, 100)); $('d_no').focus(); await new Promise(r => setTimeout(r, 250));
      return [...document.querySelectorAll('#dl_mach_on option')].some(o => o.value === 'PR-119'); }, d);
    const o = [await offered('2026-06-15'), await offered('2026-08-15'), await offered('2026-09-05')];
    ok('3. Diesel Issue: offered on 15-06 (earlier period) and 05-09 (back), not on 15-08 (away)', JSON.stringify(o) === '[true,false,true]', o);
    const pr = await F.evaluate(() => activeProblem(findMachine('PR-119'), '2026-08-15'));
    ok('   the page\'s words for 15-08: "' + pr + '"', /^PR-119 was not on this site from .*07.*2026 to .*08.*2026 \(it came back on .*09.*2026\)\. Entry date .*08.*2026 is in that time\.$/.test(pr), pr);
    const srv = await api('saveDieselIssue', { date: '2026-08-15', shift: 'Day', source: 'Dispenser', no: 'PR-119', qty: 5, kmReading: 600, force: true });
    ok('   the server refuses an entry on 15-08 with the same words', /was not on this site from 01-07-2026 to 31-08-2026 \(it came back on 01-09-2026\)/.test(srv.ERROR || ''), srv);
    // ---- 4. the Asset Master dates ----
    await F.evaluate(() => showTab('master')); await wait(1500);
    const shown = async (a, z) => F.evaluate(async (a, z) => { $('m_search').value = ''; $('m_search').dispatchEvent(new Event('input')); $('mf_from').value = a; $('mf_to').value = z; $('mf_to').dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 500));
      return [...document.querySelectorAll('#m_rows tr')].some(t => /PR-119/.test(t.textContent)); }, a, z);
    const s4 = [await shown('2026-08-01', '2026-08-31'), await shown('2026-06-15', '2026-08-31'), await shown('2026-08-20', '2026-09-03')];
    ok('4. Asset Master "On site" dates: 01-08 … 31-08 not shown; 15-06 … 31-08 and 20-08 … 03-09 shown', JSON.stringify(s4) === '[false,true,true]', s4);
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
