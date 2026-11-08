// Settings, the parts not covered before: choosing a photo file, and "Enter moves to the next box"
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
(async () => {
  sql("delete from app_settings where id like 'USER_PREFS|%'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('tab-settings').click(); }); await wait(1500);
  // a photo file chosen from the computer
  const inp = await f.$('#set_photo_file'); await inp.uploadFile('/tmp/photo.png'); await wait(4500);
  const ph = sql("select value::json->>'photo' from app_settings where id = 'USER_PREFS|sujit@rcl.test'");
  const size = await f.evaluate(() => new Promise(r => { const im = document.querySelector('#u_ava img'); if (!im) return r('no picture in the top bar'); const t = new Image(); t.onload = () => r(t.width + 'x' + t.height); t.onerror = () => r('unreadable'); t.src = im.src; }));
  ok('a photo chosen from the computer is made 128 x 128, saved with the account and shown in the top bar', /^data:image\/jpeg;base64,/.test(ph) && ph.length < 20000 && size === '128x128', { saved: ph.slice(0, 30) + '… (' + ph.length + ' characters)', shown: size });
  await f.evaluate(() => document.getElementById('set_photo_del').click()); await wait(4000);
  ok('"Remove" takes the photo away again', sql("select value::json->>'photo' from app_settings where id = 'USER_PREFS|sujit@rcl.test'") === '' && await f.evaluate(() => !document.querySelector('#u_ava img')));
  // Enter = next box
  const walk = async () => { await f.evaluate(() => { showTab('inward'); }); await wait(1500); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('i_qty').focus(); });
    await p.keyboard.press('Enter'); await wait(150); return f.evaluate(() => document.activeElement && document.activeElement.id); };
  const before = await walk();
  await f.evaluate(() => prefSet({ enterNext: true })); await wait(900);
  const after = await walk();
  ok('"Enter moves to the next box": off → Enter stays in the box; on → it goes to the next box', before === 'i_qty' && !!after && after !== 'i_qty', { off: before, on: after });
  ok('no script error', errs.length === 0, errs.join(' | '));
  sql("delete from app_settings where id like 'USER_PREFS|%'");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/set2.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/set2.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
