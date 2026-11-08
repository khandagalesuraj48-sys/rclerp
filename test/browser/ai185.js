// update-185 (the assistant – "AI la app cha main brain"): the rest of Mechanical in Ask – the look-ups the SERVER runs (aiLookup), end to
// end: the page, the server and the database are real; the AI service is test/claude-standin.js on :3998 (a question "LOOKUP <name>
// <JSON>" makes it ask for that look-up, its log keeps what the look-up gave back). The rig without the Portal (the app's own sign-in),
// RCLSTEPS=1 (site S1 with step 1zi – its maintenance). Test data only, taken out again at the end.
//   node test/browser/ai185.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const cl = async p => (await fetch('http://127.0.0.1:3998' + p, { signal: AbortSignal.timeout(10000) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const NO = 'RL-1850', V = 'AI Test Vendor 185', SHOT = process.env.SHOTS || '/tmp';
(async () => {
  let b = null; const errs = [];
  const clean = () => sql("delete from maintenance where machinery = '" + NO + "'; delete from master where id = '" + NO + "'; delete from vendors where vendor_name = '" + V + "'; delete from web.cache where key like 'SB%'");
  try {
    await cl('/__clear'); clean();
    const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json();
    const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const J = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J('getInit')).today, d1 = today.slice(0, 8) + '01';
    // the test's data: an Own roller with a maintenance bill of the old log book (its GST ₹ as in the file), a vendor with its numbers
    const m = await J('saveMaster', { no: NO, name: 'Roller 1850', type: 'Soil Compactor', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 8, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2020-01-01' }, 'add');
    const im = await J('importMaint', { no: NO, bills: [{ rows: 'Line 1', date: d1, garage: 'Patil Garage', km: 900, lines: [{ work: 'FUEL FILTER', qty: 1, uom: 'Nos', rate: 650, amount: 650, gstAmt: 117 }] }] });
    const vs = await J('saveVendor', { name: V, gstReg: 'No', pan: 'ABCDE1234F', aadhaar: '234523452345', bank: 'Test Bank', branch: 'Pune', account: '000111222333', ifsc: 'SBIN0001234', phone: '9822001850' }, 'add');
    ok('(the test\'s data: ' + NO + ' with one maintenance bill, the vendor "' + V + '")', !m.ERROR && !im.ERROR && !vs.ERROR && sql("select count(*) from maintenance where machinery = '" + NO + "'") === '1', [m.ERROR, im.ERROR, vs.ERROR]);
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
    const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    ok('the server says the AI is on (Claude)', await f.evaluate(() => AI.on) === true);
    await f.evaluate(() => document.getElementById('ai_fab').click()); await wait(400);
    // ("compare" in it: the question is for the AI, not one the page answers by itself)
    const ask = async (name, args) => { await cl('/__clear'); const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
      await f.evaluate(t => { const i = document.getElementById('ai_in'); i.value = t; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, 'LOOKUP ' + name + ' ' + JSON.stringify(Object.assign({}, args, { _: 'compare' })));
      for (let i = 0; i < 80; i++) { await wait(400); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; }
      const shown = await f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; return { answer: m[m.length - 1].textContent, src: (m[m.length - 2] || {}).textContent || '' }; });
      const log = await cl('/__log'), e = log.find(x => x.result === name) || {}; let r = null; try { r = JSON.parse(e.resultJson || 'null'); } catch (x) { r = null; }
      return Object.assign(shown, { r: r, steps: log.filter(x => x.model && !x.list).length, tools: (log.find(x => x.tools) || {}).tools || [] }); };
    // 1. maintenance: the machinery as typed another way; the bill's ₹ from the database; "Looked up: Maintenance bills …"
    let a = await ask('maintenance_bills', { from: d1, to: today, machinery: 'rl 1850' });
    ok('1. "maintenance bills of rl 1850": Claude asks for it, the SERVER runs it (the person\'s access) – RL-1850, 1 bill ₹767 (650 + its GST ₹117 as in the file), Patil Garage; "Looked up: Maintenance bills …"; two steps',
      a.r && a.r.machinery === NO && a.r.bills === 1 && a.r.totalRupees === 767 && a.r.bills_[0].garage === 'Patil Garage' && /FUEL FILTER ₹767/.test(a.r.bills_[0].lines) && /^Result of maintenance_bills/.test(a.answer) && /Looked up:Maintenance bills .* · rl 1850/.test(a.src) && a.steps === 2 && a.tools.indexOf('machinery_cost') > -1, a);
    a = await ask('maintenance_log_book', { machinery: NO });
    ok('   its Maintenance Log Book (start to end): ₹767, 1 bill, by work FUEL FILTER', a.r && a.r.startToEnd === true && a.r.maintenanceRupees === 767 && a.r.bills === 1 && a.r.byWork[0].work === 'FUEL FILTER', a.r);
    a = await ask('maintenance_status', {});
    ok('   Log book status: RL-1850 added up to ' + d1, a.r && a.r.added_.some(x => x.no === NO && x.bills === 1 && x.upTo === d1), a.r);
    // 2. the vendor: its details and what is missing – never the Aadhaar, PAN or account number
    a = await ask('vendors', { query: 'ai test vendor' });
    const vt = JSON.stringify(a.r || {});
    ok('2. "vendor AI Test Vendor": found, its mobile and bank; nothing missing – and NO Aadhaar / PAN / account number in what goes to the AI',
      a.r && a.r.found === 1 && a.r.vendors[0].company === V && a.r.vendors[0].mobile === '9822001850' && a.r.vendors[0].bank === 'Test Bank, Pune' && !a.r.vendors[0].missing && !/234523452345|ABCDE1234F|000111222333/.test(vt), vt.slice(0, 600));
    a = await ask('vendor_ledger', { vendor: 'Nobody 185' });
    ok('   a vendor that is not of the site: the AI is told so ("…is not a vendor of this site.")', /You cannot see this: "Nobody 185" is not a vendor of this site\./.test(a.answer), a.answer);
    // 3. papers, cost, the others – each answers
    a = await ask('compliance', {});
    ok('3. Vehicle Compliance: RL-1850 (Own) – its papers "not entered"', a.r && a.r.papers.some(x => x.no === NO && x.state === 'not entered'), a.r && a.r.counts);
    const rest = {};
    for (const n of ['vendor_bills', 'payments', 'vendor_outstanding', 'vendor_boq', 'breakdowns', 'fuel_cards', 'diesel_inward', 'diesel_transfers', 'machinery_cost']) { const x = await ask(n, { from: d1, to: today }); rest[n] = x.r ? (x.r.error ? 'ERROR ' + x.r.error : 'ok') : 'no result: ' + x.answer.slice(0, 120); }
    ok('   Saved Bills, Payments, Outstanding, BOQ, Breakdown, Fuel Cards, Diesel Inward, Transfer, Machinery Cost Sheet: each answers', Object.values(rest).every(v => v === 'ok'), rest);
    await p.screenshot({ path: path.join(SHOT, 'ai185_ask.png') });
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('no error in the test itself', false, String(e && e.stack || e)); }
  finally {
    if (b) await b.close();
    try { clean(); await cl('/__clear'); out.push('cleanup: done'); } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
