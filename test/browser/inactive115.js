// update-115 (a machinery that left the site) in the browser, on the local rig (Mechanical :3001, site S1). Test data only: two
// machinery "…-115" (one left on 01-10-2026), taken out at the end.
//   Asset Master opens with the machinery on site today; dates 30-09 … 05-10 show the one that left; 01-10 … 05-10 do not; Clear
//   filters shows all. The Diesel Issue picker of today does not offer it; with the date 30-09 it does. The Log Book pending list
//   and the server refuse an entry from 01-10.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node inactive115.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001';
(async () => {
  const cleanup = () => sql("delete from master where id in ('LFT-115', 'ON-115'); delete from web.cache where key like 'SB%';");
  const post = async body => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  let b = null; const errs = [];
  try {
    cleanup();
    const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const m1 = await api('saveMaster', { no: 'LFT-115', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Inactive', activeFrom: '2026-09-01', inactiveFrom: '2026-10-01' }, 'add');
    const m2 = await api('saveMaster', { no: 'ON-115', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-09-01' }, 'add');
    ok('seed: LFT-115 on site 01-09 … 30-09 (Inactive From 01-10), ON-115 on site', m1.ok && m2.ok, [m1, m2]);
    const e1 = await api('saveDieselIssue', { date: '2026-10-01', shift: 'Day', source: 'Dispenser', no: 'LFT-115', qty: 5, kmReading: 100, force: true });
    ok('an entry of 01-10 is refused ("inactive from 01-10-2026")', /LFT-115 is inactive from 01-10-2026/.test(e1.ERROR || ''), e1);
    const pend = await api('pendingLog', { from: '2026-09-28', to: '2026-10-03' });
    const pl = (pend.items || []).filter(x => x.no === 'LFT-115').map(x => x.date);
    ok('Log Book pending: only 28-09 … 30-09 for it', pl.join() === '2026-09-28,2026-09-29,2026-09-30', pl);

    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', 'Nashik#Road848!'); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user && !!S.today);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('master'); }); await wait(2500);
    const list = () => F.evaluate(() => ({ ids: [...document.querySelectorAll('#m_rows tr')].map(t => (t.children[1] || {}).textContent || '').filter(x => /-115$/.test(x)), sum: $('m_sum').textContent, from: $('mf_from').value, to: $('mf_to').value, today: S.today }));
    let L = await list();
    ok('Asset Master opens with the machinery on site TODAY: ON-115 yes, LFT-115 no ("' + L.sum + '")', L.from === L.today && L.to === L.today && L.ids.join() === 'ON-115' && /on site on/.test(L.sum), L);
    const setR = (a, z) => F.evaluate((a, z) => { $('mf_from').value = a; $('mf_to').value = z; $('mf_to').dispatchEvent(new Event('change', { bubbles: true })); }, a, z);
    await setR('2026-09-30', '2026-10-05'); await wait(500); L = await list();
    ok('dates 30-09 … 05-10: LFT-115 is shown (it was on site on the 30th)', L.ids.includes('LFT-115') && L.ids.includes('ON-115'), L);
    await setR('2026-10-01', '2026-10-05'); await wait(500); L = await list();
    ok('dates 01-10 … 05-10: LFT-115 is not shown', !L.ids.includes('LFT-115') && L.ids.includes('ON-115'), L);
    await F.evaluate(() => $('mf_clear').click()); await wait(500); L = await list();
    ok('"Clear filters": every machinery, also the one that left', L.ids.includes('LFT-115') && L.from === '' && L.to === '', L);
    // the Diesel Issue picker
    await F.evaluate(() => showTab('diesel')); await wait(2000);
    const opts = async d => F.evaluate(async d => { if (d) { $('d_date').value = d; $('d_date').dispatchEvent(new Event('change', { bubbles: true })); } $('d_no').blur(); await new Promise(r => setTimeout(r, 100)); $('d_no').focus(); await new Promise(r => setTimeout(r, 200));
      return { list: $('d_no').getAttribute('list'), ids: [...document.querySelectorAll('#dl_mach_on option')].map(o => o.value).filter(v => /-115$/.test(v)), all: [...document.querySelectorAll('#dl_machines option')].map(o => o.value).filter(v => /-115$/.test(v)) }; }, d);
    let o = await opts('');
    ok('Diesel Issue today: the machinery picker offers ON-115, not LFT-115', o.list === 'dl_mach_on' && o.ids.join() === 'ON-115', o);
    o = await opts('2026-09-30');
    ok('   with the date 30-09: it offers LFT-115 too', o.ids.includes('LFT-115') && o.ids.includes('ON-115'), o);
    ok('   (the search / filter boxes keep every machinery)', o.all.includes('LFT-115'), o);
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
