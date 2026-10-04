// the assistant, part 2: ready questions answered by the app itself, for the page the person is on; the snapshot (one-step answers);
// "Ask the assistant" on an error; the Admin's test. Page, server and database real; the AI service is the stand-in.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const gem = async path => (await fetch('http://127.0.0.1:3998' + path)).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 430) : '')); };
(async () => {
  await gem('/__clear'); sql("delete from web.props where key = 'AI_MODEL'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} setLgMode('date'); document.getElementById('ai_fab').click(); }); await wait(1500);
  const chips = () => f.evaluate(() => [...document.querySelectorAll('#ai_sugg button')].map(x => x.textContent));
  const last = () => f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; const l = m[m.length - 1], s = m[m.length - 2]; return { cls: l.className, text: l.textContent, src: s ? s.textContent : '', go: [...l.querySelectorAll('.ai-go')].map(x => x.dataset.aigo || 'retry') }; });
  const settle = async n0 => { for (let i = 0; i < 80; i++) { await wait(300); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; } };
  const count = () => f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
  // 1. the ready questions follow the page
  const today = await f.evaluate(() => S.today), dmy = today.slice(8) + '-' + today.slice(5, 7) + '-' + today.slice(0, 4);
  let c = await chips();
  ok('on the Log Book page the first ready question is about that page: what is pending for the date picked there', c.length >= 3 && c[0] === '⚡ ' + dmy + ' ला कोणत्या गाड्यांची Log Book entry बाकी आहे?', c);
  await f.evaluate(() => showTab('diesel')); await wait(700); c = await chips();
  ok('on Diesel Issue the ready questions change to diesel: yesterday, today, the stock', /काल किती diesel/.test(c[0]) && /आज किती diesel/.test(c[1]) && /stock/.test(c[2]), c);
  // 2. a ready question is answered by the app itself – the AI service is not asked at all
  await gem('/__busy?model=*&n=99'); let n0 = await count();
  await f.evaluate(() => document.querySelector('#ai_sugg [data-aiready="dieselY"]').click()); await settle(n0);
  let a = await last(); const y = await f.evaluate(() => addDay(S.today, -1)), tot = sql("select coalesce(sum(qty), 0)::float || '|' || count(*) from diesel_issue where issue_date = '" + y + "'").split('|');
  ok('"yesterday\'s diesel" is answered at once by the app itself although every AI model is busy; the figure is the database\'s', a.cls === 'ai-m bot' && /app कडून थेट/.test(a.src) && (Number(tot[1]) ? a.text.indexOf(Number(tot[0]).toLocaleString('en-IN') + ' L') > -1 && a.text.indexOf(tot[1] + ' entries') > -1 : /दिलेले नाही/.test(a.text)) && (await gem('/__log')).length === 0, { answer: a.text.slice(0, 110), database: tot, aiCalls: (await gem('/__log')).length });
  n0 = await count(); await f.evaluate(() => document.querySelector('#ai_sugg [data-aiready="page"]').click()); await settle(n0); a = await last();
  ok('"what is this page for" gives the page\'s own guide in Marathi', /^Diesel Issue/.test(a.text) && /[\u0900-\u097F]{3,}/.test(a.text), a.text.slice(0, 120));
  // 3. a typed question with the snapshot: one step, no look-up
  await gem('/__clear'); n0 = await count();
  await f.evaluate(() => { const i = document.getElementById('ai_in'); i.value = 'what is the stock now?'; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }); await settle(n0);
  a = await last(); let log = await gem('/__log'); const stock = await f.evaluate(async () => (await rawCall('getStock')).stock);
  ok('a typed question the snapshot answers needs ONE step to the AI service (no look-up), with the app\'s own figure', a.cls === 'ai-m bot' && a.text.indexOf('the stock is ' + stock + ' L') > -1 && log.length === 1 && /dieselStockNow/.test(log[0].snapshot) && log[0].page === 'diesel' && /च्या आकड्यांवरून/.test(a.src), { answer: a.text.slice(0, 80), steps: log.length, snapshotHas: log[0] && log[0].snapshot, page: log[0] && log[0].page, src: a.src });
  // 4. the snapshot is rebuilt when the data changes
  const at0 = await f.evaluate(() => AI.snapAt);
  await f.evaluate(async t => { await call('saveLogRows', { rows: [{ date: t, shift: 'Night', no: 'MH-15-AB-0001', mode: 'Idle' }] }); }, today); await wait(2500);
  const at1 = await f.evaluate(() => AI.snapAt);
  ok('after a save the snapshot is rebuilt by itself (the window is open)', at1 > at0 && at0 > 0, { before: at0, after: at1 });
  await f.evaluate(async t => { await call('deleteLogRow', 'MH-15-AB-0001|' + t + '|Night'); }, today);
  // 5. an error → "Ask the assistant"
  await f.evaluate(() => { document.getElementById('ai_close').click(); fixCard('Close KM 90 cannot be less than Start KM 100.'); }); await wait(300);
  const btn = await f.evaluate(() => { const x = document.querySelector('#fixbox [data-fixai]'); return x ? x.textContent : ''; });
  await gem('/__clear'); n0 = await count();
  await f.evaluate(() => document.querySelector('#fixbox [data-fixai]').click()); await settle(n0);
  a = await last(); log = await gem('/__log'); const asked = await f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs .ai-m.me')]; return m[m.length - 1].textContent; });
  ok('the help card of an error has "Ask the assistant": it opens the window and asks about that message on that page', btn === 'याबद्दल Assistant ला विचारा' && /"Diesel Issue" या page वर हा संदेश आला: "Close KM 90 cannot be less than Start KM 100\."/.test(asked) && a.cls === 'ai-m bot' && /The app's guide/.test(a.src) && !(await f.evaluate(() => document.getElementById('ai_panel').hidden)), { button: btn, asked: asked.slice(0, 90), answer: a.text.slice(0, 60), src: a.src.slice(0, 60) });
  // 6. the Admin's test
  await gem('/__clear'); await gem('/__busy?model=gemini-9.5-flash&n=99'); n0 = await count();
  await f.evaluate(() => document.getElementById('ai_test').click()); await settle(n0); a = await last();
  ok('Admin "Test the AI service": each model with answered / not, the time, and what the service said', /✗ gemini-9\.5-flash – 503: This model is currently experiencing high demand/.test(a.text) && /✓ gemini-9\.0-flash – answered in [\d.]+ s/.test(a.text) && /✓ gemini-9\.5-flash-lite – answered/.test(a.text) && /At least one model answers/.test(a.text), a.text.slice(0, 330));
  await p.screenshot({ path: 'shots/assistant2.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  await gem('/__clear'); sql("delete from web.props where key = 'AI_MODEL'");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/ai2.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/ai2.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
