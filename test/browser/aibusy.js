// a busy AI service: the app asks again by itself, moves to the next model, and says it plainly when all are busy
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const gem = async path => (await fetch('http://127.0.0.1:3998' + path)).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
(async () => {
  await gem('/__clear'); sql("delete from web.props where key = 'AI_MODEL'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('ai_fab').click(); }); await wait(400);
  const ask = async q => { const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
    if (q) await f.evaluate(t => { const i = document.getElementById('ai_in'); i.value = t; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, q);
    for (let i = 0; i < 120; i++) { await wait(400); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; }
    return f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; const last = m[m.length - 1]; return { cls: last.className, text: last.textContent.slice(0, 260), again: !!last.querySelector('[data-airetry]'), turns: AI.turns.length }; }); };
  // 1. the first model is busy twice, then answers
  await gem('/__busy?model=gemini-9.5-flash&n=1');
  let a = await ask('How much diesel was issued from 2026-09-29 to 2026-09-30?');
  let log = await gem('/__log');
  ok('the model is busy once (503): the app asks it again by itself and the person simply gets the answer', a.cls === 'ai-m bot' && /L of diesel in \d+ entries/.test(a.text) && log.filter(x => x.busy).length === 1 && log.every(x => x.model === 'gemini-9.5-flash'), { answer: a.text.slice(0, 60), busyAnswers: log.filter(x => x.busy).length, models: [...new Set(log.map(x => x.model))] });
  // 2. the first model stays busy: the next model answers, and is asked first from then on
  await gem('/__clear'); await gem('/__busy?model=gemini-9.5-flash&n=99');
  a = await ask('Which machinery are pending on 2026-10-03?');
  log = await gem('/__log');
  const order1 = log.map(x => x.model + (x.busy ? ' busy' : ' ok'));
  ok('the first model stays busy: the next model answers the question', a.cls === 'ai-m bot' && /machinery have no Log Book/.test(a.text) && order1.slice(0, 3).join(' | ') === 'gemini-9.5-flash busy | gemini-9.5-flash busy | gemini-9.0-flash ok', order1);
  ok('…and the model that answered is asked first afterwards (the busy one is not tried again for the next step)', order1[3] === 'gemini-9.0-flash ok' && JSON.parse(sql("select value from web.props where key = 'AI_MODEL'")).list[0] === 'gemini-9.0-flash', { nextCall: order1[3], kept: sql("select value from web.props where key = 'AI_MODEL'").slice(0, 90) });
  // 3. everything is busy: said plainly, the conversation is as before, "Ask again" works once the service is back
  await gem('/__clear'); await gem('/__busy?model=*&n=99'); const before = await f.evaluate(() => AI.turns.length);
  a = await ask('How much diesel was issued from 2026-09-29 to 2026-09-30?');
  ok('every model busy: a plain message (not the service\'s raw text), with what the Admin needs and an "Ask again" button; the conversation is as it was', a.cls === 'ai-m err' && /The AI service is busy right now \(503\) – that is on its side, not in the app\. It was asked 4 time\(s\)\. Please ask again in a minute\. Admin: model \S+ said: This model is currently experiencing high demand/.test(a.text) && !/\{/.test(a.text) && a.again && a.turns === before, a);
  await gem('/__clear'); const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot').length);
  await f.evaluate(() => document.querySelector('#ai_msgs [data-airetry]').click());
  for (let i = 0; i < 60; i++) { await wait(400); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot').length > n && !AI.busy, n0)) break; }
  const fin = await f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; return { last: m[m.length - 1].textContent.slice(0, 50), errorsLeft: document.querySelectorAll('#ai_msgs .ai-m.err').length }; });
  ok('"Ask again" sends the same question once more and the answer comes; the error is gone', /L of diesel in \d+ entries/.test(fin.last) && fin.errorsLeft === 0, fin);
  ok('no script error', errs.length === 0, errs.join(' | '));
  await gem('/__clear'); sql("delete from web.props where key = 'AI_MODEL'");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/aibusy.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/aibusy.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
