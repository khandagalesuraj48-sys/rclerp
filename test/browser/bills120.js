// update-120 (the bill copies of a diesel inward) in the browser, on the local rig started with PORTAL=1 (Mechanical :3001 own
// sign-in; database rcl with step 1zb). Test data only (inwards of "BC120-W…"), taken out at the end.
//   1. Diesel Inward: the "Bill copy" box with "Take photo" (camera) and "Choose photos" (several at once); 3 big photos picked
//      together → 3 tiles "Sending" → ✓, each made smaller (longest side 2000 px); ✕ takes one out;
//   2. Save → the inward is kept with its 2 copies; the form is empty again; the list shows "📷 2" → the copies open large;
//   3. Edit → its 2 copies are shown; one more from the camera → "Update" asks: Bill copy 2 photos → 3 photos (1 added) → saved;
//   4. 9 more picked with 3 there → only 7 are added ("Up to 10 …"); Clear → nothing changed in the inward;
//   5. Opening stock: no bill copy box; a phone (390 px wide): the tiles 2 in a row; no page error.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node bills120.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700) : '')); };
const U = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!', SHOT = process.env.SHOTS || '/tmp', STORE = '/home/claude/rig/storage/diesel-photos/';
// the size of a JPG (its SOF part)
const jpgSize = b => { let i = 2; while (i < b.length) { if (b[i] !== 0xFF) return null; const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + len; } return null; };
(async () => {
  const cleanup = () => sql("delete from diesel_inward where bill_number like 'BC120-W%'; delete from web.cache where key like 'SB%';");
  const errs = [], dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bills120-'));
  let b = null;
  try {
    cleanup();
    ok('seed: the database has step 1zb (diesel_inward.photos)', sql("select count(*) from information_schema.columns where table_name = 'diesel_inward' and column_name = 'photos'") === '1');
    b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 180000 });
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(U + '/', { waitUntil: 'load' });
    const find = async need => { for (let i = 0; i < 80; i++) { for (const x of p.frames()) { try { if (x !== p.mainFrame() && await x.evaluate(need)) return x; } catch (e) {} } await wait(500); } return null; };
    const lf = await find(() => !!document.getElementById('lg_email') && document.getElementById('lg_email').offsetParent !== null);
    await lf.type('#lg_email', 'sujit@rcl.test'); await lf.type('#lg_pass', PW); await lf.click('#lg_btn'); await wait(6000);
    const F = await find(() => typeof S === 'object' && !!S.user);
    try { await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); } catch (e) {}
    // test photos: big ones (3000 × 4000), made by the browser itself, each with its number written on it
    const mkPic = async (n, w, h) => { const b64 = await F.evaluate((n, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#123'; g.font = '700 260px Arial'; g.fillText('BILL ' + n, 200, 600); for (let y = 900; y < h; y += 90) { g.font = '400 60px Arial'; g.fillText('HSD 1000 L  @ 92.10  =  92,100.00  line ' + y, 200, y); } return c.toDataURL('image/jpeg', 0.92).split(',')[1]; }, n, w, h);
      const f = path.join(dir, 'bill' + n + '.jpg'); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f; };
    const pics = []; for (let i = 1; i <= 13; i++) pics.push(await mkPic(i, i === 4 ? 4000 : 3000, i === 4 ? 3000 : 4000));
    await F.evaluate(() => { showTab('inward'); try { aiOpen(false); } catch (e) {} }); await wait(2500);      // (the assistant's panel, if it was left open, closed for the pictures)
    const tiles = () => F.evaluate(() => ({ done: document.querySelectorAll('#i_bill_grid .ib-item.done').length, busy: document.querySelectorAll('#i_bill_grid .ib-item.busy').length,
      add: [...document.querySelectorAll('#i_bill_grid [data-iba]')].map(x => x.textContent.trim()), shown: !$('i_bills').hidden && $('i_bills').offsetParent !== null, head: ($('i_bills').querySelector('.dph-head') || {}).textContent || '' }));
    let t = await tiles();
    ok('1. Diesel Inward: the "Bill copy" box – "Take photo" (camera) and "Choose photos" (several at once), no copy yet', t.shown && t.done === 0 && t.add.length === 2 && /Take photo/.test(t.add[0]) && /Choose photos/.test(t.add[1]) && /Bill copy/.test(t.head) &&
      await F.evaluate(() => $('i_bill_cam').getAttribute('capture') === 'environment' && $('i_bill_pick').multiple && !$('i_bill_pick').hasAttribute('capture')), t);
    await (await F.$('#i_bill_pick')).uploadFile(pics[0], pics[1], pics[2]);
    await wait(300); const mid = await tiles();
    let k = 0; while (k++ < 60 && (t = await tiles()).done < 3) await wait(500);
    ok('   3 photos picked together → 3 tiles, sent one after another ("Sending" → ✓)', mid.done + mid.busy === 3 && mid.busy > 0 && t.done === 3 && t.busy === 0, { mid, t });
    await p.screenshot({ path: SHOT + '/bills120-1-three.png' });
    const paths = await F.evaluate(() => IB.items.map(x => x.path));
    const sizes = paths.map(x => jpgSize(fs.existsSync(STORE + x) ? fs.readFileSync(STORE + x) : Buffer.alloc(0)));
    const kb = paths.map(x => Math.round(fs.statSync(STORE + x).size / 1024));
    ok('   each kept in the store made smaller: longest side 2000 px (3000 × 4000 sent), at most 1.3 MB (' + kb.join(' / ') + ' KB)', sizes.every(s => s && Math.max(s.w, s.h) === 2000 && Math.min(s.w, s.h) === 1500) && kb.every(x => x <= 1331), sizes);
    await F.evaluate(() => document.querySelector('#i_bill_grid [data-ibx="1"]').click()); await wait(300);
    t = await tiles();
    ok('   ✕ takes the 2nd copy out: 2 left (1 and 3)', t.done === 2 && JSON.stringify(await F.evaluate(() => IB.items.map(x => x.path))) === JSON.stringify([paths[0], paths[2]]), t);
    // ---- 2. save ----
    await F.evaluate(() => { setInwType('inward'); $('i_loc').value = 'Dispenser'; $('i_pump').value = 'BC120 Web Pump'; $('i_qty').value = '10'; $('i_rate').value = '90'; $('i_billno').value = 'BC120-W1'; $('i_billdate').value = S.today; $('i_qty').dispatchEvent(new Event('input', { bubbles: true })); });
    await F.evaluate(() => $('i_save').click()); await wait(1500);
    k = 0; let id = ''; while (k++ < 30 && !(id = sql("select coalesce(max(id), '') from diesel_inward where bill_number = 'BC120-W1'"))) await wait(500);
    const kept = id ? JSON.parse(sql("select coalesce(photos, '[]') from diesel_inward where id = '" + id + "'") || '[]') : [];
    await wait(800); t = await tiles();
    ok('2. Save → the inward ' + id + ' is kept with its 2 copies (1 and 3); the form is empty again (no copy)', id && kept.map(x => x.p).join() === [paths[0], paths[2]].join() && t.done === 0 && t.add.length === 2, { id, kept, t });
    await F.evaluate(() => { foldOpen('inward'); loadInward(); }); await wait(2500);
    const btn = await F.evaluate(i => { const r = [...document.querySelectorAll('#i_rows tr')].find(tr => tr.textContent.indexOf(i) > -1); const x = r && r.querySelector('[data-iph]'); return x ? x.textContent.trim() : null; }, id);
    ok('   the list: "📷 2" by ' + id, btn === '📷 2', btn);
    await F.evaluate(i => document.querySelector('#i_rows [data-iph="' + i + '"]').click(), id); await wait(2500);
    const view = await F.evaluate(() => { const g = document.querySelector('.phv-grid'); return g ? { title: $('cf_title').textContent, imgs: [...g.querySelectorAll('img')].map(i => i.complete && i.naturalWidth), caps: [...g.querySelectorAll('figcaption b')].map(x => x.textContent) } : null; });
    ok('   pressed: the 2 copies open large (2000 px pictures), "Bill copy 1 / 2"', view && view.imgs.length === 2 && view.imgs.every(w => w === 1500) && view.caps.join() === 'Bill copy 1,Bill copy 2' && /Bill copy – IN-/.test(view.title) && /BC120-W1/.test(view.title), view);
    await p.screenshot({ path: SHOT + '/bills120-2-view.png' });
    await F.evaluate(() => { try { closeConfirm(false); } catch (e) {} }); await wait(500);
    // ---- 3. edit ----
    await F.evaluate(i => document.querySelector('#i_rows [data-iedit="' + i + '"]').click(), id);
    k = 0; while (k++ < 30 && (t = await tiles()).done < 2) await wait(400);
    ok('3. Edit: its 2 copies are shown', t.done === 2 && t.add.length === 2, t);
    await (await F.$('#i_bill_cam')).uploadFile(pics[3]);
    k = 0; while (k++ < 40 && (t = await tiles()).done < 3) await wait(500);
    const s4 = jpgSize(fs.readFileSync(STORE + (await F.evaluate(() => IB.items[2].path))));
    ok('   one more from the camera (4000 × 3000 → 2000 × 1500): 3 tiles', t.done === 3 && s4 && s4.w === 2000 && s4.h === 1500, { t, s4 });
    await F.evaluate(() => $('i_save').click()); await wait(1200);
    const ask = await F.evaluate(() => ({ open: !$('cf_back').hidden, title: $('cf_title').textContent, rows: [...document.querySelectorAll('#cf_box tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()) }));
    ok('   "Update" asks: Bill copy 2 photos → 3 photos (1 added)', ask.open && /Update IN-/.test(ask.title) && ask.rows.some(r => /Bill copy/.test(r) && /2 photos/.test(r) && /3 photos \(1 added\)/.test(r)), ask);
    await p.screenshot({ path: SHOT + '/bills120-3-update.png' });
    await F.evaluate(() => $('cf_ok').click()); await wait(2500);
    const kept3 = JSON.parse(sql("select coalesce(photos, '[]') from diesel_inward where id = '" + id + "'") || '[]');
    ok('   saved: 3 copies (the 2 as before, then the new one)', kept3.length === 3 && kept3[0].p === paths[0] && kept3[1].p === paths[2] && kept3[0].at === kept[0].at, kept3);
    // ---- 4. at most 10 ----
    await F.evaluate(i => { loadInward(); }, id); await wait(2000);
    await F.evaluate(i => document.querySelector('#i_rows [data-iedit="' + i + '"]').click(), id);
    k = 0; while (k++ < 30 && (t = await tiles()).done < 3) await wait(400);
    await (await F.$('#i_bill_pick')).uploadFile(...pics.slice(4, 13));
    await wait(400);
    const toastTx = await F.evaluate(() => $('toast').textContent);
    k = 0; while (k++ < 120 && ((t = await tiles()).busy > 0 || t.done < 10)) await wait(500);
    ok('4. 9 more picked with 3 there: only 7 are added ("Up to 10 bill copies with one inward – the first 7 are added."); no "add" tile at 10', t.done === 10 && t.add.length === 0 && /Up to 10 bill copies with one inward – the first 7 are added\./.test(toastTx), { t, toastTx });
    await p.screenshot({ path: SHOT + '/bills120-4-ten.png' });
    await F.evaluate(() => $('i_clear').click()); await wait(500);
    t = await tiles();
    ok('   Clear: the form is a new inward again; the saved inward keeps its 3 copies', t.done === 0 && JSON.parse(sql("select coalesce(photos, '[]') from diesel_inward where id = '" + id + "'") || '[]').length === 3, t);
    // ---- 5. opening stock; a phone ----
    await F.evaluate(() => setInwType('opening')); await wait(300);
    ok('5. Opening stock: no bill copy box', !(await tiles()).shown);
    await F.evaluate(() => setInwType('inward')); await p.setViewport({ width: 390, height: 844 }); await wait(1200);      // (isMobile would load the page again)
    await (await F.$('#i_bill_pick')).uploadFile(pics[0], pics[1]);
    k = 0; while (k++ < 40 && (t = await tiles()).done < 2) await wait(500);
    const cols = await F.evaluate(() => getComputedStyle($('i_bill_grid')).gridTemplateColumns.split(' ').length);
    await F.evaluate(() => $('i_bills').scrollIntoView({ block: 'center' })); await wait(400);
    await p.screenshot({ path: SHOT + '/bills120-5-phone.png' });
    ok('   on a phone (390 px): the tiles 2 in a row', cols === 2 && t.done === 2, { cols, t });
    await F.evaluate(() => $('i_clear').click());
    ok('no page error', errs.length === 0, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 700)); }
  finally { try { if (b) await b.close(); } catch (e) {} try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
