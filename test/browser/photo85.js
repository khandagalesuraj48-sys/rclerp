// update-85 (asked 12-10-2026): the app opens only with the location on; a diesel issue takes 4 photos with the camera (time and
// place printed on each, made small), the AI reads the dashboard photo into the reading box, the photos go with the entry and are
// looked at from the list. On a PHONE screen. On the local rig only (Storage and AI stand-ins).   node photo85.js
// Needs: the rig (up.sh) with the Storage stand-in of rig/proxy.js; test/gemini-standin.js is started here. The pictures are made
// here, in the browser, as big as a phone camera makes them (3000 × 4000 / 4000 × 3000 JPG of 1.5 – 2 MB).
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync, spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const APP_DIR = process.env.APP_DIR || path.join(__dirname, '..', '..'), IMG = fs.mkdtempSync('/tmp/photo85-'), SHOTS = process.env.SHOTS || '/home/claude/test/shots';
const PORT = 3006, BASE = 'http://127.0.0.1:' + PORT, AI = 'http://127.0.0.1:3998', NASHIK = { latitude: 19.997453, longitude: 73.789802, accuracy: 18 };
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const clean = () => sql("delete from log_book where machinery like 'P85-%'; delete from diesel_issue where machinery like 'P85-%'; delete from master where id like 'P85-%'; delete from web.cache where key like 'LG\\_%' or key like 'F\\_%' or key like 'DUP\\_%';");
const kids = [];
(async () => {
  try { clean(); } catch (e) { out.push('clean: ' + String(e.message).slice(0, 200)); }
  sql(fs.readFileSync(path.join(APP_DIR, 'sql', 'supabase_step1x_diesel_photos.sql'), 'utf8'));      // the database step of this update
  // pictures as a phone camera makes them (taken "now"), and one from the gallery (an hour old) – drawn by a browser
  { const mk = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' }), pg = await mk.newPage();
    for (const [k, txt, w, h] of [['dash', '04517.3', 3000, 4000], ['veh', 'MH15 JCB', 3000, 4000], ['pump', '45.00 L', 4000, 3000], ['reg', 'REGISTER', 3000, 4000]]) {
      const b64 = await pg.evaluate((txt, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 9000; i++) { g.fillStyle = 'rgba(' + (i * 37 % 255) + ',' + (i * 91 % 255) + ',' + (i * 53 % 255) + ',.25)'; g.fillRect((i * 7919) % w, (i * 104729) % h, 30, 30); }
        g.fillStyle = '#fff'; g.fillRect(w / 6, h / 3, w * 2 / 3, h / 6); g.strokeStyle = '#000'; g.lineWidth = 12; g.strokeRect(w / 6, h / 3, w * 2 / 3, h / 6);
        g.fillStyle = '#111'; g.font = 'bold 160px Arial'; g.fillText(txt, w / 5, h / 3 + 220); return c.toDataURL('image/jpeg', 0.95).split(',')[1]; }, txt, w, h);
      fs.writeFileSync(path.join(IMG, k + '_now.jpg'), Buffer.from(b64, 'base64'));
    }
    await mk.close(); }
  const now = new Date(), old = new Date(Date.now() - 3600000);
  for (const k of ['dash', 'veh', 'pump', 'reg']) fs.utimesSync(path.join(IMG, k + '_now.jpg'), now, now);
  fs.copyFileSync(path.join(IMG, 'reg_now.jpg'), path.join(IMG, 'gallery.jpg')); fs.utimesSync(path.join(IMG, 'gallery.jpg'), old, old);
  const camKB = Math.round(fs.statSync(path.join(IMG, 'dash_now.jpg')).size / 1024);
  // the AI stand-in and a server of the app that uses it
  let aiUp = false; try { aiUp = (await fetch(AI + '/__log', { signal: AbortSignal.timeout(1500) })).ok; } catch (e) { aiUp = false; }
  if (!aiUp) { const c = spawn('node', [path.join(APP_DIR, 'test', 'gemini-standin.js')], { stdio: 'ignore', detached: true }); kids.push(c); await wait(800); }
  const srv = spawn('node', ['dev.js'], { cwd: APP_DIR, env: Object.assign({}, process.env, { PORT: String(PORT), GEMINI_API_KEY: 'test-key', GEMINI_API_BASE: AI }), stdio: 'ignore', detached: true }); kids.push(srv);
  for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/', { signal: AbortSignal.timeout(1000) })).ok) break; } catch (e) {} await wait(300); }
  await fetch(AI + '/__clear');
  const post = async body => { for (let i = 0; ; i++) { try { return await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json(); } catch (e) { if (i > 3) throw e; await wait(800); } } };
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const seedErr = []; const E = r => { if (r && (r.ERROR || r.ok === false)) seedErr.push(JSON.stringify(r).slice(0, 260)); return r; };
  E(await api('saveMaster', { no: 'P85-JCB', name: 'JCB 3DX', type: 'Excavator', unit: 'Hrs', worksOn: ['Hrs'], hrStd: 5, owner: 'Rachana Construction Limited', ownership: 'Own', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  E(await api('saveMaster', { no: 'P85-TIP', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 3, owner: 'Rachana Construction Limited', ownership: 'Own', status: 'Active', activeFrom: '2026-10-01' }, 'add'));
  const today = sql("select to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD')");
  E(await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'P85-JCB', qty: 20, hrReading: 4500, driver: 'P85 driver', force: true, mode: 'Hrs' }));
  ok('test data: P85-JCB (Hrs, last reading 4500) and P85-TIP (KM); the database step of this update run on the rig', !seedErr.length, seedErr.join(' // ') || 'ready');

  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const ctx = await b.createBrowserContext(), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.setUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36');
  await p.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  // 1. no location: the app does not open
  await p.goto(BASE + '/', { waitUntil: 'load' }); await wait(2500);
  let f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
  let lb = await f.evaluate(() => ({ shown: !$('loc_block').hidden, mr: $('loc_mr').textContent, en: $('loc_en').textContent, cover: getComputedStyle($('loc_block')).position + ' ' + getComputedStyle($('loc_block')).zIndex }));
  ok('location not allowed: the whole app is covered by "Location चालू करा" with what to do (Marathi, Hindi, English)', lb.shown && /परवानगी/.test(lb.mr) && /Allow Location for this site/.test(lb.en) && /^fixed 2147483000$/.test(lb.cover), lb);
  const blocked = await f.evaluate(() => { const r = $('lg_btn').getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(el && el.closest('#loc_block')); });
  ok('   the sign-in button cannot be pressed under it', blocked);
  await p.screenshot({ path: SHOTS + '/photo85_noloc.png' });
  // 2. location allowed → "Check again" opens the app
  await ctx.overridePermissions(BASE, ['geolocation']); await p.setGeolocation(NASHIK);
  await f.evaluate(() => $('loc_again').click()); await wait(1500);
  ok('location allowed + "Check again": the app opens', await f.evaluate(() => $('loc_block').hidden && !!LOC.pos && LOC.pos.lat === 19.997453));
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); setDieselMode('one'); }); await wait(2500);
  ok('   signed in on the phone, Diesel Issue open; no machinery picked → no photo tiles yet', await f.evaluate(() => S.curTab === 'diesel' && $('d_ph').hidden));
  const pick = async no => { await f.evaluate(no => { const i = $('d_no'); i.value = no; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); }, no); await wait(900); };
  await pick('P85-JCB');
  ok('machinery picked: 4 photo tiles – Dashboard, Vehicle + driver, Dispenser litres, Register', await f.evaluate(() => !$('d_ph').hidden && [...document.querySelectorAll('#d_ph_grid .dph-tile')].map(t => t.dataset.phk).join() === 'dash,veh,pump,reg'));
  await p.screenshot({ path: SHOTS + '/photo85_tiles.png', fullPage: false });
  // take a photo: the tile opens the camera (a file chooser here), the picture is given
  const take = async (k, file) => {
    const [ch] = await Promise.all([p.waitForFileChooser({ timeout: 10000 }), f.evaluate(k => document.querySelector('#d_ph_grid [data-phk="' + k + '"]').click(), k)]);
    ok('   the ' + k + ' tile opens the CAMERA (input capture="environment", pictures only)', ch.isMultiple() === false && await f.evaluate(() => $('d_ph_in').getAttribute('capture') === 'environment' && $('d_ph_in').accept === 'image/*'));
    await ch.accept([file]);
    for (let i = 0; i < 80; i++) { await wait(250); const st = await f.evaluate(k => ({ busy: !!PH.busy[k], done: !!PH.items[k] }), k); if (!st.busy && i > 2) break; }
    return f.evaluate(k => PH.items[k] || null, k);
  };
  await fetch(AI + '/__meter?say=' + encodeURIComponent('{"km": null, "hrs": 4517.3}'));
  const dash = await take('dash', path.join(IMG, 'dash_now.jpg'));
  ok('Dashboard photo (3000 × 4000, ' + camKB + ' KB from the camera) sent and kept: ✓ on the tile', !!dash && /^\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/.test(dash.path) && await f.evaluate(() => document.querySelector('[data-phk="dash"]').classList.contains('done')), dash);
  const look = await f.evaluate(url => new Promise(ok => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const px = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3); let light = 0; const d = g.getImageData(0, im.naturalHeight - 80, im.naturalWidth, 80).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) light++;
    ok({ w: im.naturalWidth, h: im.naturalHeight, band: px(4, im.naturalHeight - 4), photo: px(Math.round(im.naturalWidth / 2), 40), textPixels: light }); }; im.onerror = () => ok(null); im.src = url; }), dash.url);
  ok('   made smaller: 1200 × 1600 picture (longest side 1600) + a band of 90 px under it = 1200 × 1690, ' + dash.kb + ' KB (camera file ' + camKB + ' KB)', look && look.w === 1200 && look.h === 1690 && dash.kb > 20 && dash.kb < 700, { look, kb: dash.kb });
  ok('   the band is dark with white writing (date, time, kind, machinery; latitude, longitude)', look && look.band.every(v => v < 60) && look.textPixels > 300, look);
  ok('   a photo taken and not saved yet keeps a new version of the app away (as a half-typed entry does)', await f.evaluate(() => window.rclBusy() === true));
  for (let i = 0; i < 40; i++) { await wait(250); if (await f.evaluate(() => /AI read/.test($('d_ai_note').textContent))) break; }
  const kept = fs.statSync(path.join('/home/claude/rig/storage/diesel-photos', dash.path)).size;
  ok('   the store has exactly the picture made on the phone (' + Math.round(kept / 1024) + ' KB)', Math.abs(kept / 1024 - dash.kb) <= 1, kept);
  const ai = await f.evaluate(() => ({ hr: $('d_hr').value, blue: $('d_hr').classList.contains('ai-read'), note: $('d_ai_note').hidden ? '' : $('d_ai_note').textContent }));
  const sent = (await (await fetch(AI + '/__log')).json()).filter(x => x.image);
  ok('AI: the dashboard photo was read – Hrs Reading filled with 4517.3, shown blue, "check it with the photo"', ai.hr === '4517.3' && ai.blue && /AI read on the dashboard photo: 4,?517\.3 hr/.test(ai.note), ai);
  ok('   the AI got the small picture (JPG, ~' + (sent[0] || {}).bytes + ' bytes) and was asked for JSON', sent.length === 1 && sent[0].image === 'image/jpeg' && Math.abs(sent[0].bytes / 1024 - dash.kb) <= 1 && sent[0].json === 'application/json', sent);
  await f.evaluate(() => window.scrollBy(0, $('d_ai_note').getBoundingClientRect().top - 420)); await wait(300);
  await p.screenshot({ path: SHOTS + '/photo85_ai.png' });
  await f.evaluate(() => { const i = $('d_hr'); i.value = '4517.5'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  ok('   typing over it: the box keeps what was typed, no longer blue (ONE reading is saved)', await f.evaluate(() => $('d_hr').value === '4517.5' && !$('d_hr').classList.contains('ai-read') && $('d_ai_note').hidden));
  const veh = await take('veh', path.join(IMG, 'veh_now.jpg'));
  const pump = await take('pump', path.join(IMG, 'pump_now.jpg'));
  ok('Vehicle + driver and Dispenser litres photos kept (a landscape photo too: 1600 × 1200 + band)', !!veh && !!pump && await f.evaluate(u => new Promise(ok => { const im = new Image(); im.onload = () => ok(im.naturalWidth === 1600 && im.naturalHeight === 1320); im.src = u; }), pump.url), { veh: veh && veh.kb, pump: pump && pump.kb });
  ok('   the AI is asked only for the dashboard photo', (await (await fetch(AI + '/__log')).json()).filter(x => x.image).length === 1);
  // a picture from the gallery (an hour old) is refused
  const [ch2] = await Promise.all([p.waitForFileChooser({ timeout: 10000 }), f.evaluate(() => document.querySelector('#d_ph_grid [data-phk="reg"]').click())]);
  await ch2.accept([path.join(IMG, 'gallery.jpg')]); await wait(1500);
  const gal = await f.evaluate(() => ({ dlg: $('cf_back').hidden ? '' : $('cf_back').textContent, kept: !!PH.items.reg }));
  ok('a photo from the gallery (an hour old) is refused: "Take the photo now", nothing sent – with the help for photos (camera, not gallery)', /Take the photo now/.test(gal.dlg) && /not from the gallery|gallery मधून नाही/.test(gal.dlg) && !/स्वीकारता आले नाही/.test(gal.dlg) && !gal.kept, gal.dlg.slice(0, 400));
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(400);
  const reg = await take('reg', path.join(IMG, 'reg_now.jpg'));
  ok('Register photo taken now: kept – all 4 tiles ✓', !!reg && await f.evaluate(() => document.querySelectorAll('#d_ph_grid .dph-tile.done').length === 4));
  await f.evaluate(() => $('d_ph').scrollIntoView({ block: 'start' })); await wait(300);
  await p.screenshot({ path: SHOTS + '/photo85_four.png' });
  // save the fill
  await f.evaluate(() => { $('d_qty').value = '35'; $('d_qty').dispatchEvent(new Event('input', { bubbles: true })); $('d_driver').value = 'P85 driver'; }); await wait(800);
  await f.evaluate(() => $('d_save').click()); await wait(4000);
  await f.evaluate(() => { try { closeConfirm(true); } catch (e) {} }); await wait(2500);
  const row = sql("select id || '|' || coalesce(hrs_reading::text,'') || '|' || coalesce(photos,'') from diesel_issue where machinery = 'P85-JCB' and qty = 35");
  const [id, hr, phj] = row.split('|'); let phs = []; try { phs = JSON.parse(phj); } catch (e) { phs = []; }
  ok('saved: ONE reading (4517.5, the typed one) and the 4 photos with time and place (Nashik, ± 18 m)', /^DI-/.test(id) && hr === '4517.5' && phs.map(x => x.k).join() === 'dash,veh,pump,reg' && phs.every(x => x.lat === 19.997453 && x.lng === 73.789802 && x.acc === 18 && x.at), row.slice(0, 300));
  ok('   the form is empty again, the tiles are gone (no machinery picked)', await f.evaluate(() => $('d_no').value === '' && $('d_ph').hidden && !Object.keys(PH.items).length));
  // the list → 📷 4 → the photos
  await f.evaluate(id => { $('df_q').value = id; loadDiesel(); }, id); await wait(2500);
  const btn = await f.evaluate(id => { const b = document.querySelector('[data-dph="' + id + '"]'); return b ? b.textContent : ''; }, id);
  ok('the list shows 📷 4 on that entry', /📷 4/.test(btn), btn);
  await f.evaluate(id => document.querySelector('[data-dph="' + id + '"]').click(), id); await wait(3500);
  const view = await f.evaluate(() => { const g = document.querySelector('.phv-grid'); if (!g) return null; return { imgs: [...g.querySelectorAll('img')].map(i => ({ w: i.naturalWidth, alt: i.alt })), maps: [...g.querySelectorAll('a[href*="google.com/maps?q="]')].map(a => a.href), caps: [...g.querySelectorAll('figcaption')].map(c => c.textContent) }; });
  ok('📷 opens the 4 photos, large, each with its kind, time and a map link to where it was taken', view && view.imgs.length === 4 && view.imgs.every(i => i.w >= 1200) && view.imgs.map(i => i.alt).join() === 'Dashboard,Vehicle and driver,Dispenser litres,Register' &&
    view.maps.length === 4 && /q=19\.997453%2C73\.789802|q=19\.997453,73\.789802/.test(view.maps[0]) && /\d\d-\d\d-\d{4} \d\d:\d\d:\d\d/.test(view.caps[0]), view);
  await p.screenshot({ path: SHOTS + '/photo85_view.png' });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(400);
  // the photos of one machinery are not kept for another
  await pick('P85-JCB'); await take('dash', path.join(IMG, 'dash_now.jpg'));
  await pick('P85-TIP');
  ok('machinery changed after a photo: the photo is removed (it shows the other machinery) and the person is told', await f.evaluate(() => !Object.keys(PH.items).length && PH.no === 'P85-TIP' && !$('d_ph').hidden));
  // editing an entry: its photos stay, no tiles
  await f.evaluate(id => editDiesel(id), id); await wait(800);
  ok('editing an entry: no photo tiles (its photos stay as they were taken)', await f.evaluate(() => $('d_ph').hidden && S.editDieselId));
  await f.evaluate(() => clearDiesel()); await wait(500);
  // the location is gone when a photo is taken: no photo, the location screen
  await pick('P85-TIP'); await ctx.clearPermissionOverrides();
  const [ch3] = await Promise.all([p.waitForFileChooser({ timeout: 10000 }), f.evaluate(() => document.querySelector('#d_ph_grid [data-phk="veh"]').click())]);
  await ch3.accept([path.join(IMG, 'veh_now.jpg')]); await wait(3000);
  ok('location switched off before a photo: the photo is not sent, the location screen comes back', await f.evaluate(() => !PH.items.veh && !$('loc_block').hidden));
  ok('no script error on the page', !errs.length, errs);
  await b.close();
  try { await api('deleteDieselIssue', id); } catch (e) {} clean();
  kids.forEach(c => { try { process.kill(-c.pid); } catch (e) {} });
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); kids.forEach(c => { try { process.kill(-c.pid); } catch (x) {} }); try { clean(); } catch (x) {} process.exit(1); });
