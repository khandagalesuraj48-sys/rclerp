// the assistant, part 3: typed questions the app answers itself (three languages), the AI path with the machinery's figures attached,
// the fall-back when the AI service fails, and the "thinking" setting. Page, server, database real; the AI service is the stand-in.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const gem = async path => (await fetch('http://127.0.0.1:3998' + path)).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 430) : '')); };
(async () => {
  await gem('/__clear'); sql("delete from web.props where key in ('AI_MODEL', 'AI_PLAIN')");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });      // (the daily summary is not part of this test)
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('ai_fab').click(); }); await wait(1500);
  const ask = async q => { const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length), t0 = Date.now();
    await f.evaluate(t => { const i = document.getElementById('ai_in'); i.value = t; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, q);
    for (let i = 0; i < 150; i++) { await wait(200); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; }
    const r = await f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; let i = m.length - 1; while (i > 0 && !/ai-m (bot|err)/.test(m[i].className)) i--; return { cls: m[i].className, text: m[i].textContent, src: m[i - 1] ? m[i - 1].textContent : '', after: m[i + 1] ? m[i + 1].textContent : '' }; });
    r.ms = Date.now() - t0; r.ai = (await gem('/__log')).length; return r; };
  const today = await f.evaluate(() => S.today), m1 = today.slice(0, 8) + '01';
  // ---- answered by the app itself ----
  let dT = sql("select coalesce(sum(qty), 0)::float || '|' || count(*) from diesel_issue where machinery = 'MH-15-AB-0001' and issue_date between '2026-09-01' and '2026-09-30'").split('|');
  let a = await ask('MH-15-AB-0001 ne september madhe kiti diesel ghetle?');
  ok('Marathi in English letters, a machinery and a month: the app answers itself, in Marathi, with the database\'s figure – the AI service is not asked', a.cls === 'ai-m bot' && /app कडून थेट/.test(a.src) && a.text.indexOf('MH-15-AB-0001 – 01-09-2026 ते 30-09-2026: ' + Number(dT[0]).toLocaleString('en-IN') + ' L, ' + dT[1] + ' entries') > -1 && a.ai === 0, { answer: a.text.slice(0, 90), database: dT, aiCalls: a.ai, ms: a.ms });
  const pend = await f.evaluate(async d => (await rawCall('logPending')).items.filter(x => x[1] === d).length, today);
  a = await ask('आज कोणत्या गाड्यांची Log Book बाकी आहे?');
  ok('Marathi: what is pending today – the app itself', /app कडून थेट/.test(a.src) && a.text.indexOf('**') < 0 && new RegExp('साठी ' + pend + ' गाड्यांची').test(a.text) && a.ai === 0, { answer: a.text.slice(0, 70), app: pend, ms: a.ms });
  a = await ask('what is the diesel stock?');
  ok('English: the stock – the app itself, and in English because the question was', /from the app itself, now/.test(a.src) && /^Diesel in stock now: 1,32,727 L/.test(a.text) && a.ai === 0, a.text.slice(0, 60));
  a = await ask('How much diesel was issued yesterday?');
  ok('"How much …" is a plain question (not one for the AI)', /from the app itself, now/.test(a.src) && a.ai === 0, a.text.slice(0, 60));
  a = await ask('average of MH-15-AB-0001 in September');
  const avg = await f.evaluate(async () => { const d = await rawCall('rptAverage', { from: '2026-09-01', to: '2026-09-30' }); return [].concat(...d.groups.map(g => g.rows)).find(r => r.no === 'MH-15-AB-0001'); });
  ok('the average of a machinery for a month: the same figures as the report', a.text.indexOf('Average: ' + avg.actual + ' (standard ' + avg.std + ') → ' + avg.status) > -1 && /01-09-2026 to 30-09-2026/.test(a.text) && a.ai === 0, { answer: a.text.slice(0, 130), report: avg.actual + ' / ' + avg.status });
  a = await ask('0001 chi shevatchi reading kay ahe');
  ok('four digits that only one machinery ends with are enough to find it (its last reading)', /MH-15-AB-0001 – शेवटची reading \d\d-\d\d-\d{4} ची: [\d,.]+ km/.test(a.text) && a.ai === 0, a.text.slice(0, 80));
  // ---- the AI path ----
  a = await ask('Why is MH-15-AB-0001 bad?'); let log = await gem('/__log');
  ok('a "why" question goes to the AI service – in ONE step, because the machinery\'s figures were attached; asked with the low thinking level', a.cls === 'ai-m bot' && /^About MH-15-AB-0001 \(from the attached figures\): /.test(a.text) && log.length === 1 && /aboutTheMachineryInTheQuestion/.test(log[0].snapshot) && log[0].thinking === 'low', { answer: a.text.slice(0, 110), steps: log.length, thinking: log[0] && log[0].thinking });
  a = await ask('MH-99-ZZ-9999 ne kiti diesel ghetle?');
  ok('a number that is not in the Master is not guessed at by the app – it goes to the AI service', (await gem('/__log')).length > 1 && !/app कडून थेट/.test(a.src), { src: a.src.slice(0, 60), answer: a.text.slice(0, 60) });
  // a model that refuses the thinking setting: asked again at once without it, and remembered
  await gem('/__clear'); await gem('/__nothink?model=gemini-9.5-flash');
  a = await ask('Why is MH-15-AB-0002 bad?'); log = await gem('/__log'); const first = log.map(x => x.refusedThinking ? 'refused' : 'answered' + (x.thinking ? ' (thinking ' + x.thinking + ')' : ' (plain)'));
  a = await ask('Why is MH-15-AB-0004 bad?'); log = await gem('/__log');
  ok('a model that refuses the thinking setting is asked again at once without it, and the next question does not try it again', first.join(', ') === 'refused, answered (plain)' && log.length === 3 && !log[2].refusedThinking && log[2].thinking === '' && /^About MH-15-AB-0004/.test(a.text), { first: first, calls: log.length, kept: sql("select value from web.props where key = 'AI_PLAIN'") });
  // ---- the AI service fails: still an answer ----
  await gem('/__clear'); await gem('/__busy?model=*&n=999');
  a = await ask('Why is the average of MH-15-AB-0001 bad in September?');
  ok('the AI service is busy: the app answers as well as it can (the machinery\'s average) and says so – no error', a.cls === 'ai-m bot' && /The AI service did not answer – from the app itself, now/.test(a.src) && /Average: /.test(a.text) && /Admin: The AI service is busy right now \(503\)/.test(a.after), { src: a.src, answer: a.text.slice(0, 80), after: a.after.slice(0, 70) });
  a = await ask('How do I make the bill of a vendor?');
  ok('…a "how do I" question gets the guide of the page that fits, with a button', a.cls === 'ai-m bot' && /^Machinery Billing\n[A-Za-z]/.test(a.text) && /the app's guide that fits best/.test(a.src), { src: a.src, answer: a.text.slice(0, 60) });
  a = await ask('zzqx prrt wvv');
  ok('…only when nothing at all can be said is an error shown, with "Ask again"', a.cls === 'ai-m err' && /busy right now/.test(a.text) && /Ask again/.test(a.text), a.text.slice(0, 90));
  await p.screenshot({ path: 'shots/assistant3.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  await gem('/__clear'); sql("delete from web.props where key in ('AI_MODEL', 'AI_PLAIN')");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/ai3.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/ai3.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
