// update-139 (asked 20-10-2026: "jya gadich 2 engine yet tith 2 reading takayla lahtat ek km ani ek hrs tr ase 2 photo weg wegle
// gheta yawet"): a machinery measured by KM and Hrs gets a 5th photo, the Hour meter – it fills the Hrs box (the dashboard the KM
// box). A machinery with one reading keeps the 4 photos. On a PHONE screen, on the local rig only (Storage and AI stand-ins).
//   APP_DIR=/home/claude/vercel node photo139.js        (the rig: all.sh; test/gemini-standin.js is started here)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const APP_DIR = process.env.APP_DIR || path.join(__dirname, '..', '..'), IMG = fs.mkdtempSync('/tmp/photo139-'), SHOTS = process.env.SHOTS || '/home/claude/test/shots';
const PORT = 3008, BASE = 'http://127.0.0.1:' + PORT, AI = 'http://127.0.0.1:3998', NASHIK = { latitude: 19.997453, longitude: 73.789802, accuracy: 18 };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const clean = () => sql("delete from diesel_issue where machinery like 'P139-%'; delete from master where id like 'P139-%'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%';");
const kids = [];
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  { const mk = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' }), pg = await mk.newPage();
    for (const [k, txt] of [['dash', '45173.4'], ['hrs', '1251.5'], ['veh', 'MH15 TM'], ['pump', '45.00 L'], ['reg', 'REGISTER']]) {
      const b64 = await pg.evaluate(txt => { const c = document.createElement('canvas'); c.width = 1200; c.height = 1600; const g = c.getContext('2d'); g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 1200, 1600);
        g.fillStyle = '#111'; g.font = 'bold 140px Arial'; g.fillText(txt, 150, 800); return c.toDataURL('image/jpeg', 0.92).split(',')[1]; }, txt);
      fs.writeFileSync(path.join(IMG, k + '.jpg'), Buffer.from(b64, 'base64'));
    }
    await mk.close(); }
  let aiUp = false; try { aiUp = (await fetch(AI + '/__log', { signal: AbortSignal.timeout(1500) })).ok; } catch (e) { aiUp = false; }
  if (!aiUp) { const c = spawn('node', [path.join(__dirname, '..', 'gemini-standin.js')], { stdio: 'ignore', detached: true }); kids.push(c); await wait(800); }
  const srv = spawn('node', ['dev.js'], { cwd: APP_DIR, env: Object.assign({}, process.env, { PORT: String(PORT), GEMINI_API_KEY: 'test-key', GEMINI_API_BASE: AI }), stdio: 'ignore', detached: true }); kids.push(srv);
  for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/', { signal: AbortSignal.timeout(1000) })).ok) break; } catch (e) {} await wait(300); }
  await fetch(AI + '/__clear');
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const today = sql("select to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD')");
  const seed = [
    await api('saveMaster', { no: 'P139-TM', name: 'Transit Mixer', type: 'Transit Mixer', unit: 'KM + Hrs', worksOn: ['KM', 'Hrs'], kmStd: 3, hrStd: 4, owner: 'Rachana Construction Limited', ownership: 'Own', status: 'Active', activeFrom: '2026-10-01' }, 'add'),
    await api('saveMaster', { no: 'P139-K', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 3, owner: 'Rachana Construction Limited', ownership: 'Own', status: 'Active', activeFrom: '2026-10-01' }, 'add'),
    await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'P139-TM', qty: 20, kmReading: 45000, hrReading: 1200, force: true, mode: 'KM + Hrs' })];
  ok('test data: P139-TM (KM and Hrs; last 45000 km, 1200 hr) and P139-K (KM only)', seed.every(r => r && !r.ERROR && r.ok !== false), seed);

  // ---- the server ----
  const one = async (kind, no) => api('dieselPhoto', { kind: kind, data: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMG, (kind === 'xx' ? 'reg' : kind) + '.jpg')).toString('base64'), lat: 19.997453, lng: 73.789802, acc: 18, at: new Date().toISOString(), no: no });
  const bad = await one('xx', 'P139-TM');
  ok('the server: a photo of no known kind is refused, the kinds named (with the Hour meter)', bad.ERROR === 'This is not one of the photos of a diesel issue (Dashboard, Hour meter, Vehicle and driver, Dispenser litres, Register).', bad);
  await fetch(AI + '/__meter?say=' + encodeURIComponent('{"km": 45173.4, "hrs": 1251.5, "numbers": []}'));
  const rh = await api('getMeterReading', { kind: 'hrs', data: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMG, 'hrs.jpg')).toString('base64'), no: 'P139-TM' });
  const ask = ((await (await fetch(AI + '/__log')).json()).filter(x => x.image).pop() || {}).ask || '';
  ok('the server: the Hour meter photo is read for the HOURS only (the AI is not asked for the odometer)', rh && rh.km === null && rh.hr === 1251.5 && /hour meter/.test(ask) && !/odometer/.test(ask), { rh, ask: ask.slice(0, 300) });
  const rd = await api('getMeterReading', { kind: 'dash', data: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMG, 'dash.jpg')).toString('base64'), no: 'P139-TM' });
  ok('   the dashboard photo as before (both readings of this machinery asked)', rd && rd.km === 45173.4 && rd.hr === 1251.5, rd);

  // ---- the page, on a phone ----
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await ctx.overridePermissions(BASE, ['geolocation']); await p.setGeolocation(NASHIK);
  await p.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36');
  await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(2500);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); setDieselMode('one'); }); await wait(2500);
  const pick = async no => { await f.evaluate(no => { const i = $('d_no'); i.value = no; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); }, no); await wait(900); };
  const tiles = () => f.evaluate(() => [...document.querySelectorAll('#d_ph_grid .dph-tile')].map(t => t.dataset.phk).join());
  await pick('P139-K');
  ok('a machinery with ONE reading (KM): the 4 photos as before', await tiles() === 'dash,veh,pump,reg', await tiles());
  await pick('P139-TM');
  ok('a machinery measured by KM and Hrs: a 5th tile, the Hour meter, after the Dashboard', await tiles() === 'dash,hrs,veh,pump,reg', await tiles());
  const take = async k => {
    const [ch] = await Promise.all([p.waitForFileChooser({ timeout: 10000 }), f.evaluate(k => document.querySelector('#d_ph_grid [data-phk="' + k + '"]').click(), k)]);
    await ch.accept([path.join(IMG, k + '.jpg')]);
    for (let i = 0; i < 80; i++) { await wait(250); const st = await f.evaluate(k => ({ busy: !!PH.busy[k], done: !!PH.items[k] }), k); if (!st.busy && i > 2) break; }
    return f.evaluate(k => PH.items[k] || null, k);
  };
  await fetch(AI + '/__meter?say=' + encodeURIComponent('{"km": 45173.4, "hrs": null, "numbers": []}'));
  await take('dash');
  for (let i = 0; i < 40; i++) { await wait(250); if (await f.evaluate(() => $('d_km').value !== '')) break; }
  await fetch(AI + '/__meter?say=' + encodeURIComponent('{"km": null, "hrs": 1251.5, "numbers": []}'));
  const hrs = await take('hrs');
  for (let i = 0; i < 40; i++) { await wait(250); if (await f.evaluate(() => $('d_hr').value !== '')) break; }
  const st = await f.evaluate(() => ({ km: $('d_km').value, hr: $('d_hr').value, kmBlue: $('d_km').classList.contains('ai-read'), hrBlue: $('d_hr').classList.contains('ai-read'), note: $('d_ai_note').textContent }));
  ok('the dashboard photo fills the KM box, the Hour meter photo the Hrs box (both blue, both in the note)', !!hrs && st.km === '45173.4' && st.hr === '1251.5' && st.kmBlue && st.hrBlue && /45,?173\.4 km/.test(st.note) && /1,?251\.5 hr/.test(st.note), st);
  await f.evaluate(() => $('d_ph').scrollIntoView({ block: 'start' })); await wait(300);
  await p.screenshot({ path: SHOTS + '/photo139_tiles.png' });
  await take('veh'); await take('pump'); await take('reg');
  ok('   all 5 tiles ✓', await f.evaluate(() => document.querySelectorAll('#d_ph_grid .dph-tile.done').length === 5));
  await f.evaluate(() => { $('d_qty').value = '35'; $('d_qty').dispatchEvent(new Event('input', { bubbles: true })); }); await wait(800);
  await f.evaluate(() => $('d_save').click()); await wait(4000);
  await f.evaluate(() => { try { closeConfirm(true); } catch (e) {} }); await wait(2500);
  const row = sql("select id || '|' || coalesce(km_reading::text,'') || '|' || coalesce(hrs_reading::text,'') || '|' || coalesce(photos,'') from diesel_issue where machinery = 'P139-TM' and qty = 35");
  const [id, km, hr, phj] = row.split('|'); let phs = []; try { phs = JSON.parse(phj); } catch (e) { phs = []; }
  ok('saved: KM 45173.4 and Hrs 1251.5, and the 5 photos (the Hour meter among them)', /^DI-/.test(id) && km === '45173.4' && hr === '1251.5' && phs.map(x => x.k).join() === 'dash,hrs,veh,pump,reg', row.slice(0, 300));
  const v = await api('getDieselPhotos', id);
  ok('   its photos are shown in order with their names: Dashboard, Hour meter, Vehicle and driver, Dispenser litres, Register', (v.photos || []).map(x => x.label).join() === 'Dashboard,Hour meter,Vehicle and driver,Dispenser litres,Register', v);
  ok('no script error on the page', !errs.length, errs);
  await b.close();
  try { await api('deleteDieselIssue', id); } catch (e) {} clean();
  kids.forEach(c => { try { process.kill(-c.pid); } catch (e) {} });
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); kids.forEach(c => { try { process.kill(-c.pid); } catch (x) {} }); try { clean(); } catch (x) {} process.exit(1); });
