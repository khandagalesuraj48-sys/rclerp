// the assistant makes an entry – only after the person's yes. Page, server and database real; the AI service is the stand-in.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const gem = async path => (await fetch('http://127.0.0.1:3998' + path)).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 440) : '')); };
const clean = () => sql("delete from log_book where machinery = 'AD-9911'; delete from diesel_issue where machinery = 'AD-9911'; delete from master where id = 'AD-9911';");
(async () => {
  clean(); await gem('/__clear'); sql("delete from web.props where key in ('AI_MODEL', 'AI_PLAIN')");
  const post = async body => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); if (r.error) out.push('setup ' + fn + ': ' + r.error); return r.result; };
  await api('saveMaster', { no: 'AD-9911', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 200, owner: 'Ask Vendor', ownership: 'Rental', status: 'Active', activeFrom: '2026-09-01' }, 'add');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), yest = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  await api('saveLogRows', { rows: [{ date: yest, shift: 'Full Day', no: 'AD-9911', mode: 'KM', openingKm: 5000, closingKm: 5080 }] });
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(d => { try { localStorage.setItem('oc_brief_sujit@rcl.test', d); } catch (e) {} }, today);
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('ai_fab').click(); }); await wait(1200);
  const count = () => f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
  const settle = async n0 => { for (let i = 0; i < 120; i++) { await wait(250); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; } await wait(200); };
  const last = () => f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; let i = m.length - 1; while (i > 0 && !/ai-m (bot|err)/.test(m[i].className)) i--; const l = m[i]; return { cls: l.className, text: l.textContent.replace(/\s+/g, ' ').trim(), card: [...l.querySelectorAll('.ai-card tr')].map(tr => [...tr.children].map(td => td.textContent).join(': ')), notes: [...l.querySelectorAll('.ai-note')].map(x => x.textContent), acts: [...l.querySelectorAll('.ai-acts button:not([disabled])')].map(x => x.dataset.aido), pending: !!AI.pending }; });
  const ask = async q => { const n0 = await count(); await f.evaluate(t => { const i = document.getElementById('ai_in'); i.value = t; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, q); await settle(n0); return last(); };
  const press = async what => { const n0 = await count(); await f.evaluate(w => { const bs = [...document.querySelectorAll('#ai_msgs .ai-acts button[data-aido="' + w + '"]:not([disabled])')]; bs[bs.length - 1].click(); }, what); await settle(n0); return last(); };
  const nDiesel = () => Number(sql("select count(*) from diesel_issue where machinery = 'AD-9911'")), nLog = () => Number(sql("select count(*) from log_book where machinery = 'AD-9911'"));
  // ---------- a diesel issue ----------
  let a = await ask('AD-9911 la 60 litre diesel de, km 5080');
  ok('a command in Marathi (English letters): the entry is SHOWN with Save / Open in the form / Cancel – nothing is saved yet, the AI service is not asked', a.pending && a.card.join(' | ') === 'Machinery: AD-9911 · Tipper · Ask Vendor | Date: ' + today.slice(8) + '-' + today.slice(5, 7) + '-' + today.slice(0, 4) + ' · Day | Diesel: 60 L  ←  Dispenser | Reading: 5,080 km' && a.acts.join() === 'save,form,cancel' && nDiesel() === 0 && (await gem('/__log')).length === 0, { card: a.card, buttons: a.acts, inDatabase: nDiesel() });
  ok('…and what would be SPOKEN for it ends with the question "Save करू का?"', await f.evaluate(() => { const c = [...document.querySelectorAll('#ai_msgs .ai-m[data-card="1"]')].pop(); return /AD-9911 ला 60 लिटर diesel, Dispenser मधून, .* Day\. Save करू का\?$/.test(c.dataset.say) && AI.lastAnswer === c.dataset.say; }));
  a = await press('save');
  const row = sql("select qty::float || '|' || km_reading::float || '|' || coalesce(source, '') || '|' || shift || '|' || issue_date from diesel_issue where machinery = 'AD-9911'");
  ok('Save: the diesel issue is in the database exactly as shown, saved through the app\'s own save', /^Save झाले ✔ Diesel Issue DI-\d+ – AD-9911/.test(a.text) && row === '60|5080|Dispenser|Day|' + today && !a.pending, { answer: a.text.slice(0, 60), row: row });
  // cancel
  a = await ask('AD-9911 la 25 litre diesel de'); a = await press('cancel');
  ok('Cancel: nothing is saved', /रद्द केले; काही save झाले नाही/.test(a.text) && nDiesel() === 1 && !a.pending, { answer: a.text, inDatabase: nDiesel() });
  // the server's own question
  a = await ask('AD-9911 la 30 litre diesel de, km 4000'); a = await press('save');
  ok('the form\'s own check comes through: a reading lower than the last one → "save anyway?" is asked in the chat, nothing saved yet', /Save anyway\?/.test(a.text) && a.acts.join() === 'force,cancel' && nDiesel() === 1, { answer: a.text.slice(0, 120), buttons: a.acts });
  a = await press('cancel');
  // a refused entry: more than the stock
  a = await ask('AD-9911 la 9999999 litre diesel de');
  const warned = a.notes.join(' '); a = await press('save');
  ok('more than the stock: warned on the card, and the Save is refused by the server – nothing saved', /फक्त [\d,.]+ L stock आहे/.test(warned) && a.cls === 'ai-m err' && /Not enough diesel/.test(a.text) && nDiesel() === 1, { warned: warned.slice(0, 80), refused: a.text.slice(0, 90) });
  await f.evaluate(() => { AI.pending = null; });
  // something missing: asked, and completed by the next words
  a = await ask('AD-9911 la diesel de');
  const q1 = a.text; a = await ask('45 litre');
  ok('litres not said: it asks, and the next words complete the entry', /AD-9911 ला किती लिटर\?/.test(q1) && a.pending && /Diesel: 45 L/.test(a.card.join(' ')), { asked: q1, then: a.card.join(' | ') });
  a = await ask('हो');
  ok('"हो" saves the waiting entry', /Save झाले ✔ Diesel Issue DI-\d+/.test(a.text) && nDiesel() === 2, { answer: a.text.slice(0, 50), inDatabase: nDiesel() });
  // ---------- a Log Book entry ----------
  a = await ask('AD-9911 chi aajchi log book entry, close 5210');
  ok('a Log Book entry by its closing reading: the Start comes from the last Close, the work is worked out and shown', a.pending && /KM: 5,080 → 5,210 = 130 km/.test(a.card.join(' | ').replace(/\s+/g, ' ')) && nLog() === 1, a.card);
  a = await press('save');
  const lr = sql("select opening_km::float || '|' || closing_km::float || '|' || shift || '|' || date from log_book where machinery = 'AD-9911' and date = '" + today + "'");
  ok('Save: the Log Book entry is in the database as shown', /Save झाले ✔ Log Book entry/.test(a.text) && lr === '5080|5210|Full Day|' + today, { answer: a.text.slice(0, 50), row: lr });
  a = await ask('AD-9911 chi aajchi log book entry, close 5300');
  ok('a second entry for the same day and shift is not prepared: the app says the day already has its entry', a.cls === 'ai-m bot' && !a.pending && /already|आधीच|entry/.test(a.text) && nLog() === 2, a.text.slice(0, 120));
  a = await ask('AD-9911 close 100 log book entry ' + yest);
  ok('…and for a day that has one too (yesterday)', !a.pending && nLog() === 2, a.text.slice(0, 100));
  // ---------- questions are still questions ----------
  a = await ask('AD-9911 ne ya mahinyat kiti diesel ghetle?');
  ok('a question about diesel is still a question (answered, nothing prepared)', !a.pending && /AD-9911 – .*: 105 L, 2 entries/.test(a.text), a.text.slice(0, 80));
  // ---------- through the AI: it can only prepare ----------
  await gem('/__clear'); a = await ask('please put 20 for AD-9911');
  const card = await f.evaluate(() => { const c = [...document.querySelectorAll('#ai_msgs .ai-m[data-card="1"]')].pop(); return c ? [...c.querySelectorAll('.ai-card tr')].map(tr => tr.textContent).join(' | ') : ''; });
  ok('a loosely worded command goes to the AI, which can only PREPARE: the same card waits for Save, the AI says so and does not claim it is saved', /Diesel20L←Dispenser/.test(card.replace(/\s+/g, '')) && /Reading–/.test(card.replace(/\s+/g, '')) && /on the screen – check it and press Save/.test(a.text) && nDiesel() === 2 && await f.evaluate(() => !!AI.pending), { card: card.slice(0, 120), ai: a.text.slice(0, 70), inDatabase: nDiesel() });
  await press('cancel');
  await p.screenshot({ path: 'shots/aido.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  clean(); await gem('/__clear');
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/aido.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/aido.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); try { clean(); } catch (e2) {} process.exit(1); });
