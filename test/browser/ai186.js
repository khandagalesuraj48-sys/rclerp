// update-186 (the assistant live – "ai khup powerfull … swatachi memory … chat history … live jas 2 person boltat tas … site wise"), end to
// end on the rig: the page, the server (api/ai.js, aiPrepare), the database and test/claude-standin.js on :3998 (it streams as the real
// service; "REMEMBER <note>" asks for the look-up remember, "WHAT DO YOU REMEMBER" answers with the MEMORY of its rules). The rig without
// the Portal (the app's own sign-in), RCLSTEPS=1. Step 1zk is put in site S1 (rcl) by this test; site T2 (rcl_s2) first without it.
// The browser's speech is a stand-in (what it says is written down; what it hears is given by the test). Test data only.
//   node test/browser/ai186.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const path = require('path'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (q, d) => execSync('timeout 60 su postgres -c "psql -d ' + (d || 'rcl') + ' -tA -q"', { input: q }).toString().trim();
const sqlFile = (f, d) => execSync('timeout 60 su postgres -c "psql -d ' + (d || 'rcl') + ' -v ON_ERROR_STOP=1 -tA -q"', { input: require('fs').readFileSync(f) }).toString();
const cl = async (p, body) => (await fetch('http://127.0.0.1:3998' + p, body ? { method: 'POST', body: body, signal: AbortSignal.timeout(10000) } : { signal: AbortSignal.timeout(10000) })).json();
const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 20000)) { try { const v = await fn(); if (v) return v; } catch (e) { /* changing */ } await wait(150); } return null; };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const SHOT = process.env.SHOTS || '/tmp', ROOT = path.join(__dirname, '..', '..');
// the browser's speech, written down: what it says (__spoken, each with its time) and what it hears (__hear – one a listening)
const SPEECH = () => {
  window.__spoken = []; window.__hear = []; window.__recs = 0; window.__sayMs = 500;
  const q = []; let cur = null;
  const next = () => { if (cur || !q.length) return; cur = q.shift(); window.__spoken.push({ t: cur.text, at: Date.now() }); const u = cur; setTimeout(() => { if (cur !== u) return; cur = null; try { u.onend && u.onend({}); } catch (e) {} next(); }, window.__sayMs); };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { get speaking() { return !!cur; }, get pending() { return q.length > 0; }, getVoices: () => [{ lang: 'en-IN', name: 'test' }, { lang: 'mr-IN', name: 'test mr' }],
    speak(u) { q.push(u); next(); }, cancel() { const all = (cur ? [cur] : []).concat(q.splice(0)); cur = null; all.forEach(u => { try { u.onerror && u.onerror({ error: 'interrupted' }); } catch (e) {} }); } } });      // (the browser's own is read-only: put in its place)
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  window.SpeechRecognition = function () { const r = this; window.__recs++; r.start = () => { setTimeout(() => { const t = window.__hear.shift();
    if (t) { try { r.onresult && r.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: true })] }); } catch (e) {} } try { r.onend && r.onend(); } catch (e) {} }, 300); }; r.abort = () => {}; r.stop = () => {}; };
};
(async () => {
  let b = null; const errs = [];
  const clean = () => { sql("delete from ai_memory where email = 'sujit@rcl.test'; delete from ai_chats where email = 'sujit@rcl.test';"); };
  try {
    const had2 = sql("select count(*) from pg_class where relname = 'ai_memory'", 'rcl_s2') === '1';
    sqlFile(path.join(ROOT, 'sql', 'supabase_step1zk_ai_memory.sql'));
    sqlFile(path.join(ROOT, 'sql', 'supabase_step1zk_ai_memory.sql'));      // (safe to run again)
    // (the database's REST layer reads its tables again after "notify pgrst" – a moment; the test waits for it, as a person would)
    const rest = db => until(async () => (await fetch('http://127.0.0.1:' + db + '/rest/v1/ai_memory?select=id&limit=1', { headers: { apikey: 'sb_secret_rigkey', Authorization: 'Bearer sb_secret_rigkey' }, signal: AbortSignal.timeout(5000) })).status === 200, 20000);
    await wait(2500); await rest(3100);      // (its reading again comes a moment after the step)
    ok('step 1zk in site S1: the two tables, row level security on, nobody but the server', sql("select string_agg(relname || ':' || relrowsecurity, ',' order by relname) from pg_class where relname in ('ai_memory', 'ai_chats')") === 'ai_chats:true,ai_memory:true' &&
      sql("select count(*) from information_schema.role_table_grants where table_name in ('ai_memory', 'ai_chats') and grantee in ('anon', 'authenticated')") === '0');
    clean(); await cl('/__clear');
    await wait(1200);
    const post = async (body, port) => (await fetch('http://127.0.0.1:' + (port || 3001) + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json();
    const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    const J = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
    const today = (await J('getInit')).today;
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
    const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.evaluateOnNewDocument(SPEECH);
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    await f.evaluate(() => document.getElementById('ai_fab').click()); await wait(400);
    ok('(the page is at site S1)', await f.evaluate(() => (localStorage.getItem('rcl_site') || 'S1') === 'S1'), await f.evaluate(() => localStorage.getItem('rcl_site')));
    const lastBot = () => f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err')].pop(); return m ? m.textContent : ''; });
    const type = t => f.evaluate(x => { const i = document.getElementById('ai_in'); i.value = x; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, t);
    const done = async n0 => until(() => f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0), 40000);
    const count = () => f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
    // 1. the answer word by word: the words appear in the bubble while Claude still writes them; no "Thinking…"
    await fetch('http://127.0.0.1:3998/__delay?ms=60');
    let n0 = await count(); const t0 = Date.now(); await type('diesel compare 2026-10-27');
    const seen = []; let thinking = false;
    for (let i = 0; i < 200; i++) { const s = await f.evaluate(() => { const w = document.querySelector('#ai_msgs .ai-stream'), x = document.querySelector('#ai_msgs .ai-wait'); return { live: w ? w.textContent : null, wait: x ? x.textContent : '', busy: AI.busy }; });
      if (/Thinking/.test(s.wait)) thinking = true; if (s.live !== null) seen.push({ n: s.live.length, ms: Date.now() - t0 }); if (!s.busy && i > 3) break; await wait(60); }
    const ans1 = await lastBot(), src1 = await f.evaluate(() => [...document.querySelectorAll('#ai_msgs .ai-src')].pop().textContent), log1 = await cl('/__log');
    const grew = seen.length >= 3 && seen[seen.length - 1].n > seen[0].n;
    ok('1. a question for the AI: its words come INTO the bubble as they are written (' + seen.length + ' looks, ' + (seen[0] || {}).n + ' → ' + (seen[seen.length - 1] || {}).n + ' characters, first at ' + (seen[0] || {}).ms + ' ms) – then the answer; no "Thinking…"',
      grew && !thinking && /L\*\*|L of diesel/.test(ans1) && /Looked up:Diesel issues/.test(src1), [seen.slice(0, 5), ans1, src1, thinking]);
    ok('   every step asked word by word (stream: true) – the look-up\'s step too; what it wrote before asking for the look-up ("Let me look that up.") is not left in the chat',
      log1.filter(x => x.model && !x.list).length === 2 && log1.filter(x => x.model && !x.list).every(x => x.stream === true) && !/Let me look that up/.test(await f.evaluate(() => document.getElementById('ai_msgs').textContent)), log1.map(x => [x.model, x.stream]));
    ok('   the Admin sees the model, the time and when the first words came', /claude-sonnet-5-5 · [\d.]+ s · first words [\d.]+ s/.test(src1), src1);
    // 2. its own memory: "remember …" – kept for him at this site; a new chat knows it; Memory lists it; × takes it out
    n0 = await count(); await type('REMEMBER RL-185 is called Mota JCB, compare'); await done(n0);
    const memRow = sql("select id || '|' || note from ai_memory where email = 'sujit@rcl.test'");
    ok('2. "remember …": the look-up remember (the server, his own note) – kept in S1 for him; the AI says so; "Looked up: Memory – kept"', /^\d+\|RL-185 is called Mota JCB, compare$/.test(memRow) && /I will remember that \(note #\d+\)/.test(await lastBot()) &&
      /Memory – kept/.test(await f.evaluate(() => [...document.querySelectorAll('#ai_msgs .ai-src')].pop().textContent)), [memRow, await lastBot()]);
    await f.evaluate(() => document.getElementById('ai_new').click()); await wait(300);
    n0 = await count(); await type('WHAT DO YOU REMEMBER compare'); await done(n0);
    ok('   a NEW chat: the AI is given its notes of him (MEMORY in its rules)', new RegExp('#' + memRow.split('|')[0] + ' RL-185 is called Mota JCB').test(await lastBot()), await lastBot());
    await f.evaluate(() => document.getElementById('ai_mem').click());
    const mem = await until(() => f.evaluate(() => { const s = document.getElementById('ai_side'); return !s.hidden && s.querySelector('.ai-row') ? { rows: [...s.querySelectorAll('.ai-row')].map(r => r.textContent), msgsHidden: document.getElementById('ai_msgs').hidden } : null; }), 10000);
    ok('   Memory: his note listed (only him, this site), the chat set aside', mem && mem.rows.length === 1 && /RL-185 is called Mota JCB/.test(mem.rows[0]) && mem.msgsHidden, mem);
    await p.screenshot({ path: path.join(SHOT, 'ai186_memory.png') });
    await f.evaluate(() => document.querySelector('#ai_side [data-aiforget]').click());
    ok('   × takes it out (from the database too)', !!await until(async () => sql("select count(*) from ai_memory where email = 'sujit@rcl.test'") === '0' && await f.evaluate(() => !document.querySelector('#ai_side [data-aiforget]') && /Nothing yet|अजून काही नाही|अभी कुछ नहीं/.test(document.getElementById('ai_side').textContent)), 10000));
    await f.evaluate(() => document.querySelector('#ai_side [data-aiback]').click()); await wait(200);
    // 3. the chats are kept after every answer – History lists them, one opens again and goes on
    const chats = sql("select count(*) || '|' || max(n) from ai_chats where email = 'sujit@rcl.test'");
    ok('3. the chats kept by themselves after the answers (2 chats: the first with its 2 questions)', chats === '2|2', chats);
    await f.evaluate(() => document.getElementById('ai_hist').click());
    const hist = await until(() => f.evaluate(() => { const s = document.getElementById('ai_side'); return !s.hidden && s.querySelector('[data-aichat]') ? [...s.querySelectorAll('[data-aichat]')].map(r => r.textContent) : null; }), 10000);
    ok('   History: the newest first, its first question as its name', hist && hist.length === 2 && /^WHAT DO YOU REMEMBER/.test(hist[0]) && /^diesel compare 2026-10-27/.test(hist[1]) && /2 (question|प्रश्न|सवाल)/.test(hist[1]), hist);
    await p.screenshot({ path: path.join(SHOT, 'ai186_history.png') });
    await f.evaluate(() => [...document.querySelectorAll('#ai_side [data-aichat]')][1].click());
    const opened = await until(() => f.evaluate(() => document.getElementById('ai_side').hidden && document.querySelectorAll('#ai_msgs .ai-m.me').length === 2 ? { me: [...document.querySelectorAll('#ai_msgs .ai-m.me')].map(x => x.textContent), turns: AI.turns.length, note: !!document.querySelector('#ai_msgs .ai-note') } : null), 10000);
    ok('   opened again: its questions and answers on the screen, the conversation goes on from them', opened && opened.me[0] === 'diesel compare 2026-10-27' && opened.turns === 4 && opened.note, opened);
    n0 = await count(); await type('pending compare ' + today); await done(n0);
    ok('   a question more: the SAME chat goes on (3 questions now), no new one', sql("select count(*) || '|' || max(n) from ai_chats where email = 'sujit@rcl.test'") === '2|3', sql("select id, n from ai_chats where email = 'sujit@rcl.test'"));
    // 4. a stream cut half-way (the service busy after some words): asked once more, in one piece – the answer comes
    await cl('/__clear'); await fetch('http://127.0.0.1:3998/__cut?n=1');
    n0 = await count(); await type('who compare 2026-10-01 2026-10-04'); await done(n0);
    const log4 = await cl('/__log');
    ok('4. a stream cut half-way: asked again in one piece (getAiReply) – the answer is there', log4.some(x => x.cut) && log4.some(x => x.model && x.stream === false) && /entries in the Activity Log/.test(await lastBot()), [log4.map(x => [x.stream, x.cut]), await lastBot()]);
    // 5. LIVE: you speak, it answers aloud – each sentence said while the rest is still being written; then it listens again by itself
    await cl('/__clear'); await fetch('http://127.0.0.1:3998/__delay?ms=90');
    // (the page listens with the TOP window's speech – what it hears and how often it listened are counted there; it says with its own)
    const top = p.mainFrame(), recs = () => top.evaluate(() => window.__recs);
    await f.evaluate(() => { window.__spoken.length = 0; window.__sayMs = 250; }); await top.evaluate(() => window.__hear.push('diesel compare 2026-10-27'));
    const rec0 = await recs();
    // (when the answer is there in full – its last bubble, no longer being written)
    await f.evaluate(() => { window.__finalAt = 0; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (!window.__finalAt && n.classList && n.classList.contains('bot') && !n.classList.contains('ai-stream')) window.__finalAt = Date.now(); }))).observe(document.getElementById('ai_msgs'), { childList: true }); });
    await f.evaluate(() => document.getElementById('ai_mic').click());
    const talk = await until(async () => (await recs()) >= rec0 + 2 && await f.evaluate(() => !AI.busy && !AI.saying && AI.live) ? await f.evaluate(() => ({ spoken: window.__spoken.map(x => x.t), first: (window.__spoken[0] || {}).at, whole: window.__finalAt })) : null, 40000);
    const st5 = talk || { recs: await recs(), hear: await top.evaluate(() => window.__hear.length), page: await f.evaluate(() => ({ live: AI.live, busy: AI.busy, saying: AI.saying, rec: !!AI.rec, bar: document.getElementById('ai_live_t').textContent, last: ([...document.querySelectorAll('#ai_msgs > div')].pop() || {}).textContent, spoken: window.__spoken.length, micHidden: document.getElementById('ai_mic').hidden })) };
    ok('5. Talk: heard → asked → the answer SAID (in its sentences) → listening again by itself', talk && talk.spoken.length >= 1 && /litres? of diesel|diesel in/i.test(talk.spoken.join(' ')), st5);
    // what was said: no "Let me look that up." (the look-up's step), the units in words
    ok('   its first sentence was SAID while the rest was still being written (' + (talk ? talk.whole - talk.first : '?') + ' ms before the answer was there in full)', talk && talk.first > 0 && talk.whole > talk.first, talk);
    ok('   the look-up\'s own words are not said; "L" said as litres', talk && !/Let me look that up/.test(talk.spoken.join(' ')) && /litres/.test(talk.spoken.join(' ')), talk && talk.spoken);
    // interrupt: it speaks a long time → the microphone pressed → it stops and listens at once (the talk goes on)
    await cl('/__clear'); await f.evaluate(() => { window.__spoken.length = 0; window.__sayMs = 4000; }); await top.evaluate(() => window.__hear.push('diesel compare 2026-10-27'));
    const rec1 = await recs();
    if (!await f.evaluate(() => AI.live)) await f.evaluate(() => document.getElementById('ai_mic').click());      // (three silences end a talk: started again)
    const speaking = await until(() => f.evaluate(() => AI.saying && window.__spoken.length >= 1), 40000);
    const recBefore = await recs();
    await f.evaluate(() => document.getElementById('ai_mic').click());
    const after = await until(async () => (await recs()) > recBefore && await f.evaluate(() => AI.live && !AI.saying) ? { live: true } : null, 10000);
    ok('   while it speaks, the microphone: it stops at once and listens (the talk goes on)', !!speaking && !!after && rec1 >= 0, [speaking, after]);
    await p.screenshot({ path: path.join(SHOT, 'ai186_talk.png') });
    await f.evaluate(() => document.getElementById('ai_live_stop').click());
    // 6. site-wise: T2 (another database) – without step 1zk it says so; with it, nothing of S1's notes or chats is there
    sql("insert into rcl_user_sites (email, site, is_admin) values ('sujit@rcl.test', 'T2', true) on conflict (email, site) do nothing");      // (rig only: sujit at T2 too – only now, the page stays at S1)
    let lg2 = null; for (let i = 0; i < 20; i++) { lg2 = await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'], site: 'T2' }); if (lg2.result && lg2.result.site === 'T2') break; await wait(1500); }      // (the list of sites is kept a little while)
    const tk2 = lg2.result && lg2.result.site === 'T2' && lg2.result.token, J2 = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk2, fn, a], site: 'T2' }); return r.error ? { ERROR: r.error } : r.result; };
    const m2a = tk2 ? await J2('aiMemory') : { ERROR: lg2.error || 'signed in at ' + (lg2.result || {}).site };
    if (had2) ok('6. (site T2 had step 1zk from an earlier run of this test – its "without the step" is checked on a fresh rig)', m2a && m2a.on === true, m2a);
    else ok('6. site T2 (its own database) without step 1zk: the assistant\'s memory says the step is needed – the rest as before', m2a && m2a.on === false && /supabase_step1zk_ai_memory\.sql/.test(m2a.msg), m2a);
    sqlFile(path.join(ROOT, 'sql', 'supabase_step1zk_ai_memory.sql'), 'rcl_s2'); await rest(3102); await wait(31000);      // (a server that just found it missing asks again after 30 s)
    await J('aiLookup', { name: 'remember', args: { note: 'only at S1' } });
    await wait(600);
    const m2 = await J2('aiMemory'), c2 = await J2('aiChats');
    ok('   with it at T2: none of S1\'s notes or chats there (S1 has them – its own database)', m2 && m2.on === true && m2.notes.length === 0 && c2 && c2.on === true && c2.chats.length === 0 && sql("select count(*) from ai_memory", 'rcl_s2') === '0' && sql("select count(*) from ai_memory where email = 'sujit@rcl.test'") === '1', [m2, c2]);
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { clean(); sql('delete from ai_memory; delete from ai_chats;', 'rcl_s2'); sql("delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'"); out.push('cleanup: the test\'s notes and chats taken out'); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
