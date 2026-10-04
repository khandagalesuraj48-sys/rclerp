// the daily summary (by itself, once a day) and talking with the assistant. Page, server, database real.
// The browser's ears and voice are played by the test (a headless browser has neither): what is asked of them, and what the app does with what they give.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 440) : '')); };
(async () => {
  sql("delete from app_settings where id like 'USER_PREFS|%'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.evaluateOnNewDocument(() => {
    if (window.top === window) { window.__recs = []; const Rec = function () { this.start = () => { this.started = true; window.__recs.push(this); }; this.abort = () => { this.aborted = true; }; this.stop = () => {}; }; window.webkitSpeechRecognition = Rec; window.SpeechRecognition = Rec; }
    window.__said = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: true, cancel() { window.__cancelled = (window.__cancelled || 0) + 1; }, getVoices() { return [{ lang: 'en-IN', name: 'English India' }, { lang: 'hi-IN', name: 'Hindi' }]; }, speak(u) { window.__said.push({ text: u.text, lang: u.lang }); window.__utter = u; } } });
  });
  const open = async () => { await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(3000); const f = p.frames().find(x => x !== p.mainFrame());
    if (await f.evaluate(() => !S.token && !document.getElementById('login_screen').hidden)) { await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.evaluate(() => { document.getElementById('lg_remember').checked = true; }); await f.click('#lg_btn'); }
    await wait(5000); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); return f; };
  // ---------- the daily summary ----------
  let f = await open();
  for (let i = 0; i < 50; i++) { await wait(400); if (await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot').length > 1 && !AI.busy)) break; }
  const brief = await f.evaluate(() => ({ open: !document.getElementById('ai_panel').hidden, q: (document.querySelector('#ai_msgs .ai-m.me') || {}).textContent || '', src: [...document.querySelectorAll('#ai_msgs .ai-src')].map(x => x.textContent).join('|'), text: ([...document.querySelectorAll('#ai_msgs .ai-m.bot')].pop() || {}).textContent || '', go: [...document.querySelectorAll('#ai_msgs .ai-go')].map(x => x.dataset.aigo).join(',') }));
  const y = await f.evaluate(() => addDay(S.today, -1)), yd = y.slice(8) + '-' + y.slice(5, 7) + '-' + y.slice(0, 4);
  const pendY = await f.evaluate(async d => (await rawCall('logPending')).items.filter(x => x[1] === d).length, y), dsl = sql("select coalesce(sum(qty), 0)::float || '|' || count(*) from diesel_issue where issue_date = '" + y + "'").split('|');
  ok('the first time the app is opened on a day, the assistant opens by itself with the summary of yesterday', brief.open && /सारांश/.test(brief.q) && /app कडून थेट/.test(brief.src) && new RegExp('काल \\(' + yd + '\\):').test(brief.text), { asked: brief.q, start: brief.text.slice(2, 60) });
  ok('its figures are the app\'s own: yesterday\'s diesel, the stock now, the machinery whose Log Book is pending', (Number(dsl[1]) ? brief.text.indexOf(Number(dsl[0]).toLocaleString('en-IN') + ' L दिले, ' + dsl[1] + ' entries') > -1 : /Diesel: दिलेले नाही/.test(brief.text)) && /आत्ता stock: 1,32,727 L/.test(brief.text) && brief.text.indexOf(pendY + ' गाड्यांची बाकी') > -1 && /लक्ष द्या:/.test(brief.text) && /Diesel Watch, गेले 7 दिवस: \d+ चिन्हे/.test(brief.text), { text: brief.text.slice(0, 330).replace(/\n/g, ' ⏎ '), database: { diesel: dsl, pending: pendY } });
  ok('…with buttons to the pages it speaks of', /log/.test(brief.go) && /rp-watch/.test(brief.go), brief.go);
  await p.screenshot({ path: 'shots/brief.png' });
  f = await open(); await wait(4500);
  ok('opened again the same day: it does not come by itself a second time (it stays a ⚡ question on every page)', await f.evaluate(() => document.getElementById('ai_panel').hidden) && await f.evaluate(() => { document.getElementById('ai_fab').click(); return [...document.querySelectorAll('#ai_sugg button')].some(x => x.dataset.aiready === 'brief'); }));
  await f.evaluate(() => { document.getElementById('ai_close').click(); prefSet({ brief: false }); localStorage.removeItem('oc_brief_sujit@rcl.test'); }); await wait(1500);
  f = await open(); await wait(4500);
  ok('switched off in Settings: it does not open by itself', await f.evaluate(() => document.getElementById('ai_panel').hidden && S.prefs.brief === false));
  await f.evaluate(() => prefSet({ brief: true })); await wait(1200);
  // ---------- talking ----------
  await f.evaluate(() => document.getElementById('ai_fab').click()); await wait(600);
  const mic = await f.evaluate(() => !document.getElementById('ai_mic').hidden);
  await f.evaluate(() => document.getElementById('ai_mic').click()); await wait(300);
  let st = await f.evaluate(() => ({ live: !document.getElementById('ai_live').hidden, text: document.getElementById('ai_live_t').textContent, micOn: document.getElementById('ai_mic').classList.contains('on') })), rec = await p.evaluate(() => ({ n: window.__recs.length, lang: window.__recs[0] && window.__recs[0].lang, started: window.__recs[0] && window.__recs[0].started }));
  ok('the microphone button starts listening, in the help language (Marathi, mr-IN)', mic && st.live && /ऐकतो आहे/.test(st.text) && st.micOn && rec.n === 1 && rec.lang === 'mr-IN' && rec.started, { bar: st.text, listening: rec });
  const hear = async words => { await p.evaluate(w => { const r = window.__recs[window.__recs.length - 1]; r.onresult({ results: [Object.assign([{ transcript: w }], { isFinal: true })] }); r.onend(); }, words); };
  const today = await f.evaluate(() => S.today), pendT = await f.evaluate(async d => (await rawCall('logPending')).items.filter(x => x[1] === d).length, today);
  await hear('आज कोणत्या गाड्यांची लॉग बुक बाकी आहे');
  for (let i = 0; i < 40; i++) { await wait(300); if (await f.evaluate(() => window.__said.length > 0)) break; }
  let said = await f.evaluate(() => window.__said[0]), bub = await f.evaluate(() => ({ q: [...document.querySelectorAll('#ai_msgs .ai-m.me')].pop().textContent, a: [...document.querySelectorAll('#ai_msgs .ai-m.bot')].pop().textContent.slice(0, 70), bar: document.getElementById('ai_live_t').textContent }));
  ok('what was heard is asked, the answer is shown and SPOKEN: its start, dates and units as words, in a voice the device has (no Marathi voice → the Hindi one)', bub.q === 'आज कोणत्या गाड्यांची लॉग बुक बाकी आहे' && new RegExp(pendT + ' गाड्यांची').test(bub.a) && said && new RegExp('^' + Number(today.slice(8)) + ' ऑक्टोबर साठी ' + pendT + ' गाड्यांची Log Book entry बाकी आहे').test(said.text) && /बाकी screen वर आहे\.$/.test(said.text) && said.lang === 'hi-IN' && /बोलतो आहे/.test(bub.bar), { heard: bub.q, spoken: said, bar: bub.bar });
  const before = await p.evaluate(() => window.__recs.length);
  await f.evaluate(() => window.__utter.onend()); await wait(900);
  ok('when it has finished speaking it listens again – a conversation', await p.evaluate(n => window.__recs.length === n + 1 && window.__recs[window.__recs.length - 1].started, before) && /ऐकतो आहे/.test(await f.evaluate(() => document.getElementById('ai_live_t').textContent)));
  await hear('८५११ नाही, डिझेल स्टॉक किती आहे'); for (let i = 0; i < 40; i++) { await wait(300); if (await f.evaluate(() => window.__said.length > 1)) break; }
  said = await f.evaluate(() => window.__said[1]);
  ok('a second spoken question (the stock) is answered and spoken too', !!said && /आत्ता diesel stock: 1,32,727 लिटर/.test(said.text), said);
  await f.evaluate(() => window.__utter.onend()); await wait(700); await hear('थांब'); await wait(500);
  st = await f.evaluate(() => ({ live: !document.getElementById('ai_live').hidden, micOn: document.getElementById('ai_mic').classList.contains('on'), liveFlag: AI.live }));
  ok('saying "थांब" ends the talk', !st.live && !st.micOn && st.liveFlag === false, st);
  // the speaker on an answer, and a refused microphone
  const n0 = await f.evaluate(() => window.__said.length);
  await f.evaluate(() => [...document.querySelectorAll('#ai_msgs .ai-m.bot .ai-say')].pop().click()); await wait(300);
  ok('the 🔊 on an answer reads it aloud without the microphone', await f.evaluate(n => window.__said.length === n + 1, n0));
  await f.evaluate(() => { AI.saying = false; document.getElementById('ai_mic').click(); }); await wait(300);
  await p.evaluate(() => { const r = window.__recs[window.__recs.length - 1]; r.onerror({ error: 'not-allowed' }); }); await wait(300);
  const den = await f.evaluate(() => ({ live: !document.getElementById('ai_live').hidden, msg: [...document.querySelectorAll('#ai_msgs .ai-m.err')].pop().textContent }));
  ok('the microphone is not allowed: the talk ends and a line says how to allow it', !den.live && /microphone ची परवानगी नाही/.test(den.msg), den.msg.slice(0, 110));
  await p.screenshot({ path: 'shots/voice.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  sql("delete from app_settings where id like 'USER_PREFS|%'");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/voice.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/voice.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
