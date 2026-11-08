// update-185 – the assistant's look-ups of the STORE and ENGINEERING, end to end on the rig in GATEWAY mode (one address :3030, as
// Mechanical's vercel.json does live: /store, /engineering, /portal → their servers): Mechanical's page asks the module itself
// (its action aiLook) with the person's sign-in THERE; when it has none, the module's page is opened unseen (it signs in by
// itself) and the look-up asked again. The AI service is test/claude-standin.js (:3998; a question "LOOKUP <name> <JSON>").
//   after: the rig in gateway mode with Claude, the Portal's test, the Store's test/work.test.js and Engineering's test/api.test.js
//   NODE_PATH=… node test/browser/ai185gw.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const path = require('path'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const sqlFile = (db, f) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -v ON_ERROR_STOP=1 -tA -q"', { input: require('fs').readFileSync(f) }).toString();
const cl = async p => (await fetch('http://127.0.0.1:3998' + p, { signal: AbortSignal.timeout(10000) })).json();
const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 20000)) { try { const v = await fn(); if (v) return v; } catch (e) { /* changing */ } await wait(300); } return null; };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 1200) : '')); };
const G = 'http://127.0.0.1:3030', SHOT = process.env.SHOTS || '/tmp';
(async () => {
  const before = sql('rcl_portal', "select key || '|' || url from modules where key in ('mechanical', 'store', 'engineering') order by key");
  // (the rig's own start, by SQL: the Store's steps in S1 with one item and its opening stock; Engineering's step; the three modules at
  // the one address; sujit Admin of Mechanical, the Store and Engineering at S1)
  for (const f of ['store_step1_items', 'store_step2_work', 'store_step3_grn_import', 'store_step4_grn_no']) sqlFile('rcl', '/home/claude/rcl-store/sql/' + f + '.sql');
  sqlFile('rcl_eng', '/home/claude/rcl-engineering/sql/eng_step1.sql');
  sql('rcl', "insert into items (code, name, name_key, unit, category, status, created_by) values ('ITM-9185', 'Cement OPC 53', 'cementopc53', 'Bag', 'Cement', 'Active', 'test') on conflict (code) do nothing; " +
    "insert into store_opening (code, date, qty, rate, updated_by) values ('ITM-9185', current_date - 5, 42, 350, 'test') on conflict (code) do update set qty = 42, rate = 350; notify pgrst, 'reload schema';");
  // (sujit in the Portal with his Mechanical password – as the Portal's own import does)
  const ph = sql('rcl', "select password_hash from app_users where lower(email) = 'sujit@rcl.test'");
  sql('rcl_portal', "insert into users (email, name, password_hash) values ('sujit@rcl.test', 'Sujit Test', '" + ph.replace(/'/g, "''") + "') on conflict (email) do update set password_hash = excluded.password_hash, active = true");
  sql('rcl_portal', "insert into modules (key, name, url, status, sort) values ('mechanical', 'Mechanical', '" + G + "', 'live', 1), ('store', 'Store', '" + G + "/store', 'live', 2), ('engineering', 'Engineering', '" + G + "/engineering', 'live', 3) " +
    "on conflict (key) do update set url = excluded.url, status = 'live'; alter table public.access add column if not exists pages jsonb; " +
    "insert into access (email, site, module, role, granted_by) values ('sujit@rcl.test', 'S1', 'mechanical', 'admin', 'test'), ('sujit@rcl.test', 'S1', 'store', 'admin', 'test'), ('sujit@rcl.test', 'S1', 'engineering', 'admin', 'test') " +
    "on conflict (email, site, module) do update set role = 'admin', pages = null; delete from counters; notify pgrst, 'reload schema';");
  sql('rcl', "delete from web.cache where key like 'F\\_%' or key like 'LG\\_%'; delete from store_sessions;"); sql('rcl_eng', 'delete from eng_sessions;');
  await wait(1500);
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
  const errs = [];
  const app = p => p.frames().find(x => x !== p.mainFrame() && !/\/(store|engineering)\//.test(x.url()) && x.parentFrame() === p.mainFrame());
  try {
    await cl('/__clear');
    const ctx = await b.createBrowserContext(), p = await ctx.newPage();
    await ctx.overridePermissions(G, ['geolocation']); await p.setGeolocation({ latitude: 19.997453, longitude: 73.789802, accuracy: 20 });
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(G + '/portal/', { waitUntil: 'load' });
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'l_email', { timeout: 20000 });
    await p.type('#l_email', 'sujit@rcl.test'); await p.type('#l_pass', 'Nashik#Road848!'); await p.click('#l_btn');
    await until(() => p.evaluate(() => !document.getElementById('v_home').hidden && document.querySelectorAll('#h_sites a.mod').length));
    await p.evaluate(() => [...document.querySelectorAll('#h_sites a.mod')].find(a => /module=mechanical&site=S1/.test(a.getAttribute('href'))).click());
    const f = await until(async () => { const a = app(p); return a && await a.evaluate(() => typeof S === 'object' && !!S.user && !!S.today && typeof AI === 'object') && a; }, 60000);
    ok('Mechanical (S1) opens at the one address, the Store and Engineering among its modules', !!f && (await f.evaluate(() => PT.mods.filter(m => inHere(m)).map(m => m.key).sort().join(','))) === 'engineering,mechanical,store', f && await f.evaluate(() => PT.mods.map(m => m.key + ' ' + m.url)));
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { localStorage.setItem('oc_brief_sujit@rcl.test', S.today); } catch (e) {} });
    const frames0 = await f.evaluate(() => [...document.querySelectorAll('#ext_frames iframe')].map(x => x.id));
    await f.evaluate(() => document.getElementById('ai_fab').click()); await wait(400);
    const ask = async (name, args) => { await cl('/__clear'); const n0 = await f.evaluate(() => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length);
      await f.evaluate(t => { const i = document.getElementById('ai_in'); i.value = t; document.getElementById('ai_form').dispatchEvent(new Event('submit', { cancelable: true })); }, 'LOOKUP ' + name + ' ' + JSON.stringify(Object.assign({}, args, { _: 'compare' })));
      for (let i = 0; i < 120; i++) { await wait(400); if (await f.evaluate(n => document.querySelectorAll('#ai_msgs .ai-m.bot, #ai_msgs .ai-m.err').length > n && !AI.busy, n0)) break; }
      const shown = await f.evaluate(() => { const m = [...document.querySelectorAll('#ai_msgs > div')]; return { answer: m[m.length - 1].textContent, src: (m[m.length - 2] || {}).textContent || '' }; });
      const log = await cl('/__log'), e = log.find(x => x.result === name) || {}; let r = null; try { r = JSON.parse(e.resultJson || 'null'); } catch (x) { r = null; }
      return Object.assign(shown, { r: r }); };
    // 1. the Store: no Store sign-in yet in this browser – its page opened unseen, it signs in, the look-up answered
    const stockDb = sql('rcl', "select count(*) from items where name = 'Cement OPC 53'");
    let a = await ask('store_stock', { query: 'cement' });
    const fr = await f.evaluate(() => { const x = document.getElementById('ext_store'); return x ? { hidden: x.hidden, shown: !document.getElementById('sec-ext').hidden } : null; });
    ok('1. "store stock of cement": the Store had no sign-in here – its page opened unseen (the person stays where he is), it signed in, the Stock report answered (Cement OPC 53: 42 Bag); "Looked up: Store – stock · cement"',
      stockDb === '1' && frames0.indexOf('ext_store') < 0 && fr && fr.hidden && !fr.shown && a.r && a.r.report === 'Stock' && a.r.count === 1 && a.r.rows[0].Item === 'Cement OPC 53' && a.r.rows[0].Stock === 42 && /Looked up:Store – stock · cement/.test(a.src), [frames0, fr, a]);
    a = await ask('store_requirements', {});
    ok('   then at once with the same sign-in: the requirements (none yet)', a.r && /^Material requirements/.test(a.r.report) && a.r.count === 0, a.r);
    // 2. Engineering the same way
    a = await ask('eng_progress', {});
    const efr = await f.evaluate(() => { const x = document.getElementById('ext_engineering'); return x ? x.hidden : null; });
    ok('2. "Engineering progress": Engineering\'s page opened unseen, signed in – its answer (the strip chart up to today; no layers set up on the rig)', efr === true && a.r && Array.isArray(a.r.layers) && a.r.upTo, [efr, a]);
    a = await ask('eng_report', { from: new Date(Date.now() + 330 * 60000 - 6 * 86400000).toISOString().slice(0, 10), to: new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10) });
    ok('   the report of the week (sujit is Engineering\'s Admin at S1): answered (its works – none on the rig)', a.r && Array.isArray(a.r.works) && a.r.reportsDue === 0, a.r);
    // 3. the module's own answer of a refusal reaches the AI
    a = await ask('store_item_ledger', { item: 'unobtainium' });
    ok('3. an item not of the Store: the AI is told ("…is not an item of this site\'s Store.")', /You cannot see this: "unobtainium" is not an item of this site's Store\./.test(a.answer), a.answer);
    await p.screenshot({ path: path.join(SHOT, 'ai185gw_ask.png') });
    ok('no error on the page', errs.length === 0, errs);
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally {
    await b.close();
    try { before.split('\n').filter(Boolean).forEach(l => { const [k, u] = l.split('|'); sql('rcl_portal', "update modules set url = '" + u + "' where key = '" + k + "'"); }); sql('rcl', "delete from store_opening where code = 'ITM-9185'; delete from items where code = 'ITM-9185';"); out.push('cleanup: the modules\' addresses put back, the test item out'); } catch (e) { out.push('cleanup: ' + e.message); }
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
