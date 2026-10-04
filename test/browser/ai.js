// the assistant, end to end: the page, the server and the database are real; the AI service is the stand-in /tmp/gem.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
(async () => {
  await fetch('http://127.0.0.1:3998/__clear');
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  const fabBefore = await f.evaluate(() => document.getElementById('ai_fab').hidden);
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const fab = await f.evaluate(() => !document.getElementById('ai_fab').hidden);
  ok('the "Ask" button is not on the sign-in screen and is there after sign-in', fabBefore && fab, { hiddenBefore: fabBefore, shownAfter: fab });
  await f.evaluate(() => document.getElementById('ai_fab').click()); await wait(400);
  const hello = await f.evaluate(() => ({ open: !document.getElementById('ai_panel').hidden, first: document.querySelector('#ai_msgs .ai-m.bot').textContent.slice(0, 60), sugg: [...document.querySelectorAll('#ai_sugg button')].map(x => x.textContent) }));
  ok('the window opens with a greeting and ready questions in the help language (Marathi)', hello.open && /या app बद्दल काहीही विचारा/.test(hello.first) && hello.sugg.length >= 3 && hello.sugg.every(x => /^⚡ /.test(x)) && hello.sugg.some(x => /काल किती diesel/.test(x)), hello);
  const ask = async q => { const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
    await f.evaluate(t => { const i = document.getElementById('ai_in'); i.value = t; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, q);
    for (let i = 0; i < 60; i++) { await wait(400); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; }
    return f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; const last = m[m.length - 1], src = m[m.length - 2]; return { answer: last.textContent, cls: last.className, bold: (last.querySelector('b') || {}).textContent || '', go: [...last.querySelectorAll('.ai-go')].map(x => x.dataset.aigo + ':' + x.textContent), looked: src && src.classList.contains('ai-src') ? src.textContent : '' }; }); };
  // 1. a figure from the data
  const tot = sql("select coalesce(sum(qty), 0)::float || '|' || count(*) from diesel_issue where issue_date between '2026-09-29' and '2026-09-30'").split('|');
  let a = await ask('Compare the diesel issued from 2026-09-29 to 2026-09-30');
  ok('a diesel question: the figure in the answer is the database\'s own (' + tot[0] + ' L in ' + tot[1] + ' entries), and the answer says what was looked up', a.cls === 'ai-m bot' && a.bold === tot[0] + ' L' && new RegExp('in ' + tot[1] + ' entries').test(a.answer) && /Looked up:Diesel issues 29-09-2026 to 30-09-2026/.test(a.looked), a);
  ok('the answer carries a button to the page', a.go.join() === 'diesel:Open Diesel Issue →', a.go);
  await f.evaluate(() => document.querySelector('#ai_msgs .ai-go').click()); await wait(800);
  ok('…and the button opens that page', await f.evaluate(() => S.curTab) === 'diesel', await f.evaluate(() => S.curTab));
  // 2. pending Log Book – in Marathi
  const today = await f.evaluate(() => S.today), pend = await f.evaluate(async d => (await rawCall('logPending')).items.filter(x => x[1] === d).length, '2026-10-03');
  a = await ask('2026-10-03 ला कोणत्या गाड्यांची Log Book बाकी आहे, आणि असे का?');
  ok('a pending question typed in Marathi: the count is the app\'s own pending count for that date', new RegExp('^' + pend + ' machinery have no Log Book for 2026-10-03').test(a.answer) && /Pending Log Book 03-10-2026/.test(a.looked), { answer: a.answer.slice(0, 90), app: pend });
  // 3. how do I
  a = await ask('How do I make the bill of a vendor?');
  ok('a "how do I" question is answered from the app\'s own guide, with a button to the page', /Looked up:The app's guide/.test(a.looked) && a.go.length === 1 && /^Use "[^"]*Bill/i.test(a.answer), a);
  // 4. who did what
  a = await ask('Who changed things between 2026-10-01 and 2026-10-04?');
  ok('a "who did what" question reads the Activity Log', /entries in the Activity Log; the last by /.test(a.answer) && /Activity Log 01-10-2026 to 04-10-2026/.test(a.looked), a.answer.slice(0, 100));
  await p.screenshot({ path: 'shots/assistant.png' });
  // what went to the AI service, and what never did
  const log = await (await fetch('http://127.0.0.1:3998/__log')).json();
  ok('every step carried the server\'s rules, the 9 look-ups and who is asking; the model was picked from the service\'s list', log.length === 8 && log.every(x => x.sysHasRules && x.tools.length === 9 && x.sysWho === 'Sujit (Admin)' && x.model === 'gemini-9.5-flash'), { steps: log.length, model: log[0] && log[0].model });
  ok('the service\'s own parts are sent back untouched (it refuses a conversation otherwise)', log.filter(x => /model/.test(x.roles)).length >= 4 && !/refused|400/.test(JSON.stringify(a)), log.map(x => x.roles).slice(0, 4));
  // a look-up the user may not use: the refusal is passed on, nothing is read another way
  const refused = await f.evaluate(async () => { const real = rawCall; rawCall = async (fn, ...x) => { if (fn === 'getActivity') throw new Error('Only Admin can open the Activity Log.'); return real(fn, ...x); }; return true; });
  a = await ask('Who deleted entries between 2026-10-01 and 2026-10-04?');
  ok('a look-up the user is not allowed: the answer says so – the assistant has no other way to the data', /You cannot see this: Only Admin can open the Activity Log\./.test(a.answer), a.answer.slice(0, 120));
  // New chat
  await f.evaluate(() => document.getElementById('ai_new').click()); await wait(300);
  ok('"New chat" forgets the conversation', await f.evaluate(() => AI.turns.length === 0 && document.querySelectorAll('#ai_msgs > div').length === 1 && document.querySelectorAll('#ai_sugg button').length >= 3));
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/ai.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/ai.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
