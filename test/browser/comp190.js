// LOCAL TEST RIG ONLY – update-190: Vehicle Compliance draws its table and its renewal history (also with a search); the fuel cards'
// payments keep their own names (S.cpay / cpayLoad) – the page had both under one name and the compliance page broke.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const ist = n => new Date(Date.now() + 330 * 60000 + n * 86400000).toISOString().slice(0, 10);
(async () => {
  const A = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = (fn, ...args) => post({ fn: 'api', args: [A, fn, args] });
  await api('saveMaster', { no: 'MH12CP0169', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Rig Vendor 190', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: ist(-40), insuranceUpto: ist(-3), pucUpto: ist(20) }, 'add');
  const c = (await api('getCompliance')).result || {};
  ok('the copy has machinery in Vehicle Compliance', (c.machines || []).length > 0, (c.machines || []).length);
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
    const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(900);
    let f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000);
    f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('comp'); }); await wait(2500);
    const look = () => f.evaluate(() => ({ rows: document.querySelectorAll('#cp_table tbody tr').length, head: (document.querySelector('#cp_table thead') || {}).textContent || '', hist: (document.querySelector('#cp_hist thead') || {}).textContent || '', chip: S.cp && S.cp.chip }));
    let x = await look();
    ok('Vehicle Compliance: its table and its renewal history are drawn', x.rows > 0 && /Machinery/.test(x.head) && /Renewed on/.test(x.hist) && x.chip === 'attention', x);
    await f.evaluate(() => { const q = document.getElementById('cp_q'); q.value = '0169'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(800);
    x = await look();
    ok('a search ("0169"): drawn again, no fault', x.rows > 0 && /Renewed on/.test(x.hist), x);
    await f.evaluate(() => { const b2 = document.querySelector('#cp_chips [data-cpc="all"]'); if (b2) b2.click(); }); await wait(500);
    x = await look();
    ok('a chip (All machinery): drawn', x.rows > 0 && x.chip === 'all', x);
    const own = await f.evaluate(() => ({ cp: typeof S.cp.d, cpay: !!S.cpay && Array.isArray(S.cpay.items) }));
    ok('the card payments have their own state (S.cpay); S.cp stays the compliance\'s', own.cp === 'object' && own.cpay, own);
    await Promise.race([p.screenshot({ path: (process.env.SHOT_DIR || '.') + '/comp190.png' }).catch(() => {}), wait(20000)]);
    ok('no page error', errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(out.join('\n')); console.log('TOTAL ' + pass + ' passed, ' + fail + ' failed');
  require('fs').writeFileSync('/tmp/comp190.out', out.join('\n') + '\nTOTAL ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack); process.exit(1); });
