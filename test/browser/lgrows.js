// Log Book entry with many rows: the buttons never lie over the rows and stay in sight; Ctrl + S asks and saves
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 640 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} try { setLgMode('date'); } catch (e) {} }); await wait(800);
  const addTo = async n => { for (;;) { const have = await f.evaluate(() => document.querySelectorAll('#lg_in > tr').length); if (have >= n) break; await f.evaluate(() => document.getElementById('l_add1').click()); await wait(60); } };
  const measure = () => f.evaluate(() => { const r = el => { const x = el.getBoundingClientRect(); return { top: Math.round(x.top), bottom: Math.round(x.bottom) }; };
    const sc = document.scrollingElement, abs = x => ({ top: x.top + sc.scrollTop, bottom: x.bottom + sc.scrollTop });
    const act = document.getElementById('l_save').closest('.actions'), rows = [...document.querySelectorAll('#lg_in > tr')], last = rows[rows.length - 1], panel = act.closest('.panel'), next = panel.nextElementSibling;
    const wrap = document.querySelector('#lg_in').closest('.table-wrap');
    return { rows: rows.length, wrapBottom: abs(r(wrap)).bottom, lastRowBottom: abs(r(last)).bottom, nextTop: next ? abs(r(next)).top : null, actions: r(act), viewport: innerHeight, scrollTop: sc.scrollTop, scrollMax: sc.scrollHeight - innerHeight }; });
  for (const n of [10, 30]) {
    await addTo(n); await wait(300);
    await f.evaluate(() => { document.scrollingElement.scrollTop = 0; }); await wait(200);
    // scrolled to the middle of the rows: the buttons must be in the window, at its bottom, and the box must hold all rows
    const mid = await f.evaluate(() => { const rows = document.querySelectorAll('#lg_in > tr'), m = rows[Math.floor(rows.length / 2)]; m.scrollIntoView({ block: 'center' }); return true; }); await wait(300);
    const a = await measure();
    ok(n + ' rows: the box holds all rows (nothing runs over the buttons or the list below)', a.wrapBottom >= a.lastRowBottom - 1 && (a.nextTop === null || a.nextTop >= a.lastRowBottom), { rows: a.rows, boxBottom: a.wrapBottom, lastRowBottom: a.lastRowBottom, nextPanelTop: a.nextTop });
    ok(n + ' rows, scrolled to the middle: "+ Add row / Save / Clear" are in the window, at its bottom', a.actions.bottom <= a.viewport + 1 && a.actions.top >= a.viewport - 90, { buttonsTop: a.actions.top, buttonsBottom: a.actions.bottom, window: a.viewport });
    if (n === 10) await p.screenshot({ path: 'shots/lgrows_10.png' });
    // scrolled past the rows: the bar is in its normal place under the last row
    await f.evaluate(() => { const rows = document.querySelectorAll('#lg_in > tr'); rows[rows.length - 1].scrollIntoView({ block: 'center' }); }); await wait(300);
    const e = await measure(); const lastVis = await f.evaluate(() => { const rows = document.querySelectorAll('#lg_in > tr'); return Math.round(rows[rows.length - 1].getBoundingClientRect().bottom); });
    ok(n + ' rows, at the end: the buttons sit just under the last row', e.actions.top >= lastVis - 1 && e.actions.top - lastVis < 40, { lastRowBottom: lastVis, buttonsTop: e.actions.top });
  }
  await p.screenshot({ path: 'shots/lgrows_30.png' });
  // Ctrl + S
  await f.evaluate(() => { window.__saved = 0; document.getElementById('l_save').addEventListener('click', e => { window.__saved++; e.stopImmediatePropagation(); }, true); const i = document.querySelector('#lg_in > tr input'); if (i) i.focus(); });
  await p.keyboard.down('Control'); await p.keyboard.press('KeyS'); await p.keyboard.up('Control'); await wait(500);
  const q = await f.evaluate(() => ({ open: !document.getElementById('cf_back').hidden, title: document.getElementById('cf_title').textContent, msg: document.getElementById('cf_msg').textContent.slice(0, 120), ok: document.getElementById('cf_ok').textContent, cancel: document.getElementById('cf_cancel').textContent, focus: document.activeElement && document.activeElement.id }));
  ok('Ctrl + S on the Log Book entry: a box asks "Save?" naming the button; the cursor waits on "Yes, save"', q.open && q.title === 'Save?' && /“Save Log Book”/.test(q.msg) && /save करायचे आहे का/.test(q.msg) && q.ok === 'Yes, save' && q.cancel === 'No' && q.focus === 'cf_ok', q);
  await p.keyboard.press('Escape'); await wait(300);
  const no = await f.evaluate(() => ({ open: !document.getElementById('cf_back').hidden, saved: window.__saved }));
  await f.evaluate(() => { if (!document.getElementById('cf_back').hidden) closeConfirm(false); });
  ok('"No" (or Esc): nothing is saved', no.saved === 0, no);
  await p.keyboard.down('Control'); await p.keyboard.press('KeyS'); await p.keyboard.up('Control'); await wait(400); await p.keyboard.press('Enter'); await wait(500);
  ok('Ctrl + S then Enter (= Yes): the Save button is pressed once', await f.evaluate(() => window.__saved) === 1, await f.evaluate(() => window.__saved));
  // another page: Asset Master, and a page with nothing to save
  await f.evaluate(() => { showTab('master'); }); await wait(1500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} document.getElementById('m_name').focus(); });
  await p.keyboard.down('Control'); await p.keyboard.press('KeyS'); await p.keyboard.up('Control'); await wait(400);
  const m = await f.evaluate(() => { const t = document.getElementById('cf_msg').textContent.slice(0, 60), o = !document.getElementById('cf_back').hidden; closeConfirm(false); return { open: o, msg: t }; });
  ok('on Asset Master it names that page\'s button', m.open && /“Save machinery”/.test(m.msg), m);
  await f.evaluate(() => { showTab('dash'); }); await wait(1200);
  await p.keyboard.down('Control'); await p.keyboard.press('KeyS'); await p.keyboard.up('Control'); await wait(400);
  const d = await f.evaluate(() => ({ open: !document.getElementById('cf_back').hidden, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent }));
  ok('on a page with nothing to save (Dashboard) it says so and asks nothing', !d.open && /nothing to save/.test(d.toast), d);
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/lgrows.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/lgrows.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
