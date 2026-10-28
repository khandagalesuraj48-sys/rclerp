// (update-167) the assistant with CLAUDE, end to end: the page, the server and the database are real; the AI service is
// test/claude-standin.js on :3998 (as strict as Anthropic's Messages API) and the server runs with ANTHROPIC_API_KEY.
//   node test/browser/claude167.js      (the rig: all.sh, then the servers again with ANTHROPIC_API_KEY / ANTHROPIC_API_BASE)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const cl = async path => (await fetch('http://127.0.0.1:3998' + path)).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 460) : '')); };
(async () => {
  await cl('/__clear'); sql("delete from web.props where key in ('AI_MODEL', 'AI_MODEL_C', 'AI_PLAIN')");
  // a machinery of this test (the rig's clean copy has none; taken out again at the end) – put in before the page is opened
  sql("delete from diesel_issue where machinery = 'CL-1670'; delete from master where id = 'CL-1670';");
  const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const mk = await post({ fn: 'api', args: [tk, 'saveMaster', [{ no: 'CL-1670', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'Test Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add']] });
  ok('(the test\'s machinery CL-1670 is in the Master)', !mk.error && sql("select count(*) from master where id = 'CL-1670'") === '1', mk.error || 'ok');
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });      // (the daily summary is not part of this test)
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const info = await f.evaluate(() => AI.on);
  ok('the server says the AI is on (Claude)', info === true, info);
  await f.evaluate(() => document.getElementById('ai_fab').click()); await wait(400);
  const ask = async q => { const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
    await f.evaluate(t => { const i = document.getElementById('ai_in'); i.value = t; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, q);
    for (let i = 0; i < 80; i++) { await wait(400); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; }
    return f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; const last = m[m.length - 1], src = m[m.length - 2]; return { answer: last.textContent, cls: last.className, bold: (last.querySelector('b') || {}).textContent || '', go: [...last.querySelectorAll('.ai-go')].map(x => x.dataset.aigo + ':' + x.textContent), looked: src && src.classList.contains('ai-src') ? src.textContent : '' }; }); };
  // 1. a figure from the data: Claude asks for the look-up, the PAGE runs it with the person's sign-in, Claude writes the answer
  const tot = sql("select coalesce(sum(qty), 0)::float || '|' || count(*) from diesel_issue where issue_date between '2026-09-29' and '2026-09-30'").split('|');
  let a = await ask('Compare the diesel issued from 2026-09-29 to 2026-09-30');
  ok('a diesel question: the figure is the database\'s own (' + tot[0] + ' L in ' + tot[1] + ' entries), the look-up is named, the button to the page is there', a.cls === 'ai-m bot' && a.bold === tot[0] + ' L' && new RegExp('in ' + tot[1] + ' entries').test(a.answer) && /Looked up:Diesel issues 29-09-2026 to 30-09-2026/.test(a.looked) && a.go.join() === 'diesel:Open Diesel Issue →', a);
  let log = await cl('/__log'); const steps = log.filter(x => x.model && !x.list);
  ok('Claude was asked in its own words: the list of models first, then two steps – the newest Sonnet, the rules kept (cache), the 42 look-ups (update-185: 29 more; update-186: remember, forget), who asks; nothing refused', log[0].list === true && steps.length === 2 && steps.every(x => x.model === 'claude-sonnet-5-5' && x.sysHasRules && x.tools.length === 42 && /^Sujit.* \(Admin\)$/.test(x.sysWho) && x.cached === 'ephemeral' && !x.refused && x.temperature === undefined)
    && steps[0].roles === 'user' && steps[1].roles === 'user,assistant,user' && steps[1].result === 'diesel_issues', log);
  ok('…the answer names the model (Admin)', /claude-sonnet-5-5 · [\d.]+ s/.test(a.looked), a.looked);
  // 2. the same chat goes on (in Marathi): the earlier look-up and its result are sent again as a pair – Claude takes it
  const pend = await f.evaluate(async d => (await rawCall('logPending')).items.filter(x => x[1] === d).length, '2026-10-03');
  a = await ask('2026-10-03 ला कोणत्या गाड्यांची Log Book बाकी आहे, आणि असे का?');
  log = await cl('/__log');
  ok('the chat goes on: the pending count is the app\'s own, the whole conversation (two look-ups with their results) was accepted', new RegExp('^' + pend + ' machinery have no Log Book for 2026-10-03').test(a.answer) && !log.some(x => x.refused) && log[log.length - 1].roles === 'user,assistant,user,assistant,user,assistant,user', { answer: a.answer.slice(0, 80), roles: log[log.length - 1].roles, refused: log.filter(x => x.refused).map(x => x.refused) });
  // 3. the snapshot answers the stock in ONE step, and it is sent after the kept part
  await cl('/__clear'); await f.evaluate(() => document.getElementById('ai_new').click()); await wait(300);
  const stock = await f.evaluate(async () => (await rawCall('getStock')).stock);
  a = await ask('why is the stock what it is now?');
  log = await cl('/__log');
  ok('the stock from the snapshot: one step, the app\'s own figure; the snapshot after the kept rules', a.cls === 'ai-m bot' && a.answer.indexOf('the stock is ' + stock + ' L') > -1 && log.filter(x => x.model).length === 1 && log[0].snapshotApart === true && /dieselStockNow/.test(log[0].snapshot), { answer: a.answer.slice(0, 80), log: log });
  // 4. an entry is only PREPARED – shown for Save, never saved by the assistant
  const m1 = 'CL-1670', n1 = sql('select count(*) from diesel_issue');
  a = await ask('please put 40 for ' + m1);
  const card = await f.evaluate(() => { const c = [...document.querySelectorAll('#ai_msgs .ai-m[data-card="1"]')].pop(); return c ? [...c.querySelectorAll('.ai-card tr')].map(tr => tr.textContent).join(' | ') : ''; });
  ok('"please put 40 for ' + m1 + '": the entry is prepared on the screen for Save (40 L) – the AI says so, nothing is saved', /40\s*L/.test(card) && /on the screen – check it and press Save/.test(a.answer) && sql('select count(*) from diesel_issue') === n1, { answer: a.answer.slice(0, 80), card: card.slice(0, 160), before: n1, after: sql('select count(*) from diesel_issue') });
  await f.evaluate(() => { const x = [...document.querySelectorAll('#ai_msgs .ai-acts button')].find(bt => /Cancel|रद्द/.test(bt.textContent)); if (x) x.click(); }); await wait(300);
  // 5. busy: Sonnet overloaded once → asked again by itself; overloaded all along → Haiku answers and is asked first afterwards
  await cl('/__clear'); await f.evaluate(() => document.getElementById('ai_new').click()); await wait(300);
  await cl('/__busy?model=claude-sonnet-5-5&n=1');
  a = await ask('Compare the diesel issued from 2026-09-29 to 2026-09-30');
  log = await cl('/__log');
  ok('Sonnet busy once (529): asked again by the server, the person simply gets the answer', a.cls === 'ai-m bot' && a.bold === tot[0] + ' L' && log.filter(x => x.busy).length === 1 && log.filter(x => x.model === 'claude-sonnet-5-5' && !x.busy).length === 2, log.map(x => x.model + (x.busy ? ' busy' : '')));
  await cl('/__clear'); await cl('/__busy?model=claude-sonnet-5-5&n=99'); await f.evaluate(() => document.getElementById('ai_new').click()); await wait(300);
  a = await ask('Compare the diesel issued from 2026-09-29 to 2026-09-30');
  log = await cl('/__log'); const order = log.map(x => x.model + (x.busy ? ' busy' : ' ok'));
  const kept = JSON.parse(sql("select value from web.props where key = 'AI_MODEL_C'") || '{}');
  ok('Sonnet busy all along: Haiku answers, and Haiku is asked first for the next step', a.cls === 'ai-m bot' && a.bold === tot[0] + ' L' && order.slice(0, 3).join(' | ') === 'claude-sonnet-5-5 busy | claude-sonnet-5-5 busy | claude-haiku-5-5 ok' && order[3] === 'claude-haiku-5-5 ok' && (kept.list || [])[0] === 'claude-haiku-5-5', { order: order, kept: kept });
  sql("delete from web.props where key = 'AI_MODEL_C'"); await cl('/__clear');
  // 6. no credit left in the company's Claude account: said as it is, in the help in Marathi too; not asked again
  await cl('/__credit?n=1');
  const nc = await f.evaluate(async () => { try { await rawCall('getAiReply', { contents: [{ role: 'user', parts: [{ text: 'diesel today?' }] }] }); return 'answered'; } catch (e) { const m = errMsg(e), r = fixRules(m); return { msg: m, mr: r.length ? r[0].mr.join(' ') : '' }; } });
  log = await cl('/__log');
  ok('no credit left: "The AI service has no credit left (Claude) …" – asked once; the help (Marathi) says Billing → add funds', /^The AI service has no credit left \(Claude\): the Admin has to add funds in Claude Console → Billing\./.test(nc.msg || '') && /credit शिल्लक नाही/.test(nc.mr || '') && /Billing/.test(nc.mr || '') && log.filter(x => x.credit).length === 1 && log.filter(x => x.model).length === 1, { nc: nc, log: log });
  // 7. a photo of a meter through Claude: an image block; the reading as the AI saw it, checked by the app as always
  await cl('/__clear');
  await cl('/__meter?say=' + encodeURIComponent('{"km": 45173.4, "hrs": null, "numbers": []}'));
  const jpg = 'data:image/jpeg;base64,' + Buffer.from('a stand-in photo of a dashboard – the stand-in answers what /__meter says').toString('base64');
  const mr = await f.evaluate(async (d, no) => { try { return await rawCall('getMeterReading', { data: d, no: no, kind: 'dash' }); } catch (e) { return { ERROR: errMsg(e) }; } }, jpg, m1);
  log = await cl('/__log'); const img = log.find(x => x.image) || {};
  ok('a meter photo: sent to Claude as an image (image/jpeg) with the question, JSON asked in its words; the answer comes back as the app reads it', !mr.ERROR && 'km' in mr && img.service === 'claude' && img.kind === 'image' && img.image === 'image/jpeg' && img.jsonAsked && /Read the TOTAL/.test(img.ask || ''), { mr: mr, img: img });
  // 8. the Admin's "Test the AI service": the service named, each model with its time
  await cl('/__clear'); const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
  await f.evaluate(() => document.getElementById('ai_test').click());
  for (let i = 0; i < 60; i++) { await wait(300); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; }
  const tt = await f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; return m[m.length - 1].textContent; });
  ok('Admin "Test the AI service": Service Claude, ✓ Sonnet and ✓ Haiku with their times', /(Service|सेवा): Claude/.test(tt) && /✓ claude-sonnet-5-5 – answered in [\d.]+ s/.test(tt) && /✓ claude-haiku-5-5 – answered in [\d.]+ s/.test(tt) && /At least one model answers/.test(tt), tt.slice(0, 330));
  await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/claude167_test.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  sql("delete from web.props where key = 'AI_MODEL_C'"); await cl('/__clear');
  sql("delete from diesel_issue where machinery = 'CL-1670'; delete from master where id = 'CL-1670';");
  out.push(pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
