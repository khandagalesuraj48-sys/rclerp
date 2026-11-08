// update-179 (asked 28-10-2026: "pending log book je aahet te mala period wise print krta yawet dashboard warun pn ani log book netry
// madhun jith diste pending tithun pn") – in the browser, on the local rig only (PORTAL=1 bash rig/all.sh). Test data only: vendor
// "PP179 Vendor", machinery PP179-OWN (Own) and PP179-R1 (Rental, of that vendor), on the site from 5 days ago with no Log Book – all
// taken out at the end. The Pending Log Book printed (Mechanical :3001, its own sign-in) –
//   1. from the Dashboard: its period (From / To of the list) in the print's box, the print = the server's list of that period
//      (each machinery, its pending days, its dates as runs), the totals;
//   2. the Dashboard with Ownership "Own": only Own machinery;
//   3. a month: from its 1st, counted up to today;
//   4. from the Log Book entry page, by date: the machinery of that date – the same as the page's own list;
//   5. by machinery: that machinery only, its pending dates from 01-09-2026 – the same number as the page's list;
//   no error on the page; a picture of the print in test/shots/pendprint179.png.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1500) : '')); };
const SHOTS = (process.env.SHOTS || '/home/claude/test/shots') + '/';
(async () => {
  const errs = [];
  let b = null;
  const cleanup = () => sql("delete from master where machinery_number like 'PP179-%'; delete from vendors where vendor_name = 'PP179 Vendor'; delete from web.cache where key like 'SB%' or key like 'F\\_%';");
  const post = async body => (await fetch(U + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })).json();
  try {
    cleanup();
    const tok = (await post({ fn: 'login', args: ['sujit@rcl.test', PW] })).result.token;
    const SA = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tok, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const t0 = (await SA('getDashboard', {})) && new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
    const d5 = (() => { const d = new Date(t0 + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 5); return d.toISOString().slice(0, 10); })();
    const v = await SA('saveVendor', { name: 'PP179 Vendor', gstReg: 'No', pan: 'ABCDE1794J', bank: 'HDFC Bank', branch: 'Mankoli', account: '12345179', ifsc: 'HDFC0009218', phone: '9800000179', address: 'Test' }, 'add');
    const mk = (no, ownership) => SA('saveMaster', { no: no, name: 'Bolero', type: 'Bolero', unit: 'KM', worksOn: ['KM'], kmStd: 10, owner: ownership === 'Own' ? 'Rachana Construction Limited' : 'PP179 Vendor', ownership: ownership, supply: 'Company', status: 'Active', activeFrom: d5 }, 'add');
    const m1 = await mk('PP179-OWN', 'Own'), m2 = await mk('PP179-R1', 'Rental');
    ok('0. test machinery PP179-OWN (Own) and PP179-R1 (Rental, PP179 Vendor), on the site from ' + d5 + ', no Log Book', !v.ERROR && !m1.ERROR && !m2.ERROR, { v, m1, m2 });
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto('http://127.0.0.1:3001/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    let F = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await F.type('#lg_email', 'sujit@rcl.test'); await F.type('#lg_pass', 'Nashik#Road848!'); await F.click('#lg_btn'); await wait(6000);
    F = await find(() => typeof S === 'object' && !!S.user && !!S.master);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} const a = document.getElementById('ai_panel'); if (a) a.hidden = true; }); } catch (e) {}
    // the print window is caught here (its HTML), not opened
    await F.evaluate(() => { window.__printed = ''; window.open = () => ({ closed: false, focus() {}, print() {}, alert() {}, document: { open() {}, write(h) { window.__printed += h; }, close() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } } }); });
    const today = await F.evaluate(() => S.today), dmy = d => d.slice(8, 10) + '-' + d.slice(5, 7) + '-' + d.slice(0, 4);
    const back = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    const text = h => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ' ').replace(/<br>/g, ' \n ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
    const rowsOf = h => [...h.matchAll(/<tr><td class="n">\d+<\/td><td><b>([^<]+)<\/b>[\s\S]*?<\/td><td>[^<]*<\/td><td>[^<]*<\/td><td>([^<]*)<\/td><td class="n"><b>(\d+)<\/b><\/td><td>([^<]*)<\/td><\/tr>/g)].map(m => ({ no: m[1], own: m[2], n: Number(m[3]), dates: m[4] }));
    // the box of the print: its fields, then Next and the name on top (when the site has more than one)
    const box = () => F.evaluate(() => ({ open: !$('cf_back').hidden, kind: ($('pp_kind') || {}).value, from: ($('pp_from') || {}).value, to: ($('pp_to') || {}).value, date: ($('pp_date') || {}).value, own: ($('pp_own') || {}).value, no: ($('pp_no') || {}).value }));
    const go = async set => {
      if (set) await F.evaluate(s => { Object.keys(s).forEach(k => { const el = $(k); el.value = s[k]; el.dispatchEvent(new Event('change', { bubbles: true })); }); }, set);
      await F.evaluate(() => { window.__printed = ''; $('cf_ok').click(); }); await wait(900);
      for (let i = 0; i < 6 && !(await F.evaluate(() => window.__printed)); i++) { await F.evaluate(() => { if (!$('cf_back').hidden) $('cf_ok').click(); }); await wait(1200); }
      return F.evaluate(() => window.__printed);
    };
    // what the server says is pending in a period: machinery → days
    const want = (from, to, own) => F.evaluate(async (a, z, o) => { const r = await call('pendingLog', { from: a, to: z }), m = {};
      r.items.forEach(x => { const mm = findMachine(x.no) || {}; if (o && mm.ownership !== o) return; m[mm.id || x.no] = (m[mm.id || x.no] || 0) + 1; }); return m; }, from, to, own || '');
    const same = (rows, m) => rows.length === Object.keys(m).length && rows.every(r => m[r.no] === r.n);

    // 1. the Dashboard: its period in the box; the print = the server's list of that period
    const f1 = back(10);
    await F.evaluate(f => { showTab('dash'); $('lb_pfrom').value = f; $('lb_pto').value = S.today; $('lb_own').value = ''; $('lb_vendor').value = ''; }, f1); await wait(800);
    await F.evaluate(() => $('lb_pprint').click()); await wait(700);
    const b1 = await box();
    ok('1a. Dashboard → Pending Log Book → Print: the box with the list\'s period (From / To), all machinery', b1.open && b1.kind === 'period' && b1.from === f1 && b1.to === today && b1.own === '' && b1.no === '', b1);
    const h1 = await go(), r1 = rowsOf(h1), t1 = text(h1), w1 = await want(f1, today), days1 = r1.reduce((a, x) => a + x.n, 0), pr1 = r1.find(r => r.no === 'PP179-R1') || {};
    ok('1b. the print: "Pending Log Book – ' + dmy(f1) + ' to ' + dmy(today) + '", every machinery of the server\'s list with its pending days', t1.indexOf('Pending Log Book – ' + dmy(f1) + ' to ' + dmy(today)) > -1 && r1.length >= 2 && same(r1, w1), { rows: r1.slice(0, 5), server: w1 });
    ok('1c. … PP179-R1: Rental, 6 days, its dates as one run "' + dmy(d5).slice(0, 5) + ' → ' + dmy(today).slice(0, 5) + ' (6)"', pr1.own === 'Rental' && pr1.n === 6 && pr1.dates === dmy(d5).slice(0, 5) + ' → ' + dmy(today).slice(0, 5) + ' (6)', pr1);
    ok('1d. … the totals ("N machinery · M days pending", Total), the signatures', t1.indexOf(r1.length + ' machinery · ' + days1 + ' day' + (days1 === 1 ? '' : 's') + ' pending') > -1 && new RegExp('Total – ' + r1.length + ' machinery ' + days1).test(t1) && /Prepared by/.test(t1), t1.slice(0, 900));
    // a picture of the print (its HTML in a page of its own)
    try { const q = await b.newPage(); await q.setViewport({ width: 900, height: 1200 }); await q.setContent(h1.replace(/<script[\s\S]*?<\/script>/g, ''), { waitUntil: 'load', timeout: 20000 }); await q.screenshot({ path: SHOTS + 'pendprint179.png', fullPage: false }); await q.close(); } catch (e) { out.push('(picture: ' + e.message + ')'); }

    // 2. Ownership "Own": only Own machinery
    await F.evaluate(() => $('lb_pprint').click()); await wait(700);
    const h2 = await go({ pp_own: 'Own' }), r2 = rowsOf(h2), w2 = await want(f1, today, 'Own');
    ok('2. Ownership "Own": only the Own machinery of that period (PP179-OWN, not PP179-R1)', same(r2, w2) && r2.every(r => r.own === 'Own') && r2.some(r => r.no === 'PP179-OWN') && !r2.some(r => r.no === 'PP179-R1'), { rows: r2.length, server: Object.keys(w2).length, all: r1.length });
    // 2b. the vendor: only its machinery
    await F.evaluate(() => $('lb_pprint').click()); await wait(700);
    const h2b = await go({ pp_own: '', pp_ven: 'PP179 Vendor' }), r2b = rowsOf(h2b);
    ok('2b. Owner / Vendor "PP179 Vendor": only PP179-R1', r2b.length === 1 && r2b[0].no === 'PP179-R1' && r2b[0].n === 6 && /PP179 Vendor/.test(text(h2b)), r2b);

    // 3. a month: from its 1st, counted up to today
    await F.evaluate(() => $('lb_pprint').click()); await wait(700);
    const m0 = today.slice(0, 8) + '01', h3 = await go({ pp_kind: 'month', pp_month: today.slice(0, 7), pp_own: '', pp_ven: '' }), r3 = rowsOf(h3), t3 = text(h3), w3 = await want(m0, today);
    ok('3. a month: "Pending Log Book – <month>", from its 1st up to today (said)', same(r3, w3) && t3.indexOf('Period: ' + dmy(m0) + ' to ') > -1 && (today.slice(8) === (new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).toISOString().slice(8, 10)) || t3.indexOf('Counted up to today (' + dmy(today) + ')') > -1), { rows: r3.length, server: Object.keys(w3).length, head: t3.slice(0, 400) });

    // 4. the Log Book entry page, by date: the machinery of that date – as the page's own list
    await F.evaluate(() => { showTab('log'); }); await wait(2000);
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} setLgMode('date'); }); await wait(3000);
    const d4 = back(2);
    await F.evaluate(d => { const el = $('lg_top_date'); el.value = d; el.dispatchEvent(new Event('change', { bubbles: true })); }, d4); await wait(1500);
    const chips4 = await F.evaluate(() => { lgPendDraw(); return [...document.querySelectorAll('#lg_pend .lp-chips button')].map(x => x.dataset.lp); });
    const hasBtn = await F.evaluate(() => !!document.querySelector('#lg_pend [data-lpprint]'));
    await F.evaluate(() => document.querySelector('#lg_pend [data-lpprint]').click()); await wait(700);
    const b4 = await box();
    ok('4a. Log Book entry (by date) → Print: the box for that one date', hasBtn && b4.open && b4.kind === 'date' && b4.date === d4, b4);
    const h4 = await go(), r4 = rowsOf(h4), t4 = text(h4);
    ok('4b. the print: "Pending Log Book – ' + dmy(d4) + '", the same machinery as the page lists for that date, one day each', t4.indexOf('Pending Log Book – ' + dmy(d4)) > -1 && chips4.length > 0 && r4.length === chips4.length && r4.every(r => r.n === 1 && chips4.indexOf(r.no) > -1), { print: r4.map(r => r.no), page: chips4 });

    // 5. by machinery: that machinery only, its pending dates from 01-09-2026
    const no5 = chips4[0];
    await F.evaluate(no => { setLgMode('mach'); const el = $('lg_top_no'); el.value = no; el.dispatchEvent(new Event('change', { bubbles: true })); }, no5); await wait(3000);
    const n5 = await F.evaluate(() => { const L = lgPendList(); return L ? L.total || L.items.length : -1; });
    await F.evaluate(() => { lgPendDraw(); document.querySelector('#lg_pend [data-lpprint]').click(); }); await wait(700);
    const b5 = await box();
    ok('5a. Log Book entry (by machinery) → Print: that machinery, 01-09-2026 to today', b5.open && b5.kind === 'period' && b5.no === no5 && b5.from === '2026-09-01' && b5.to === today, b5);
    const h5 = await go(), r5 = rowsOf(h5);
    ok('5b. the print: only ' + no5 + ', its pending days = the page\'s list (' + n5 + ')', r5.length === 1 && r5[0].no === no5 && r5[0].n === n5 && n5 > 0, { print: r5, page: n5 });

    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('the test ran to its end', false, e && e.stack || String(e)); }
  finally { if (b) await b.close().catch(() => {}); try { cleanup(); out.push('(test data taken out: ' + sql("select count(*) from master where machinery_number like 'PP179-%'") + ' left)'); } catch (e) { out.push('(cleanup: ' + e.message + ')'); } }
  out.push('TOTAL pass=' + pass + ' fail=' + fail);
  console.log(out.join('\n'));
  process.exit(fail ? 1 : 0);
})();
