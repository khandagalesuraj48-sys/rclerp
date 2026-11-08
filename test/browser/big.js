// the big box: double-click / F2 / the small button on any typing box; Save, Cancel, Clear
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  const box = () => f.evaluate(() => { const bb = document.getElementById('bigbox'); if (!bb || bb.hidden) return null; const ed = bb.querySelector('.bb-ed'); return { title: document.getElementById('bb_title').textContent, tag: ed.tagName, type: ed.type || '', list: ed.getAttribute('list') || '', value: ed.value, count: document.getElementById('bb_count').textContent }; });
  const dbl = sel => f.evaluate(s => { const el = document.querySelector(s); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); }, sel);
  const press = id => f.evaluate(i => document.getElementById(i).click(), id);
  const typeIn = v => f.evaluate(v2 => { const ed = document.querySelector('#bigbox .bb-ed'); ed.value = v2; ed.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await dbl('#lg_pass'); ok('sign-in screen: a password box does NOT open large', (await box()) === null);
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('log'); }); await wait(2600); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  await f.evaluate(async () => { setLgMode('date'); const tr = document.querySelector('#lg_in .lrow'); const x = tr.querySelector('[data-f=no]'); x.value = 'MH-15-AB-0001'; x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1600));
    window.__ch = 0; tr.querySelector('[data-f=work]').addEventListener('change', () => { window.__ch++; }); });
  const W = '#lg_in .lrow [data-f=work]', LONG = 'Carting of GSB from Valshind plant to chainage 12+500, 6 trips, then shifted to median work near the under-pass as told by the site in-charge';
  await dbl(W); let bx = await box();
  ok('double-click on "Work done" opens the large box with the name of the field', bx && bx.tag === 'TEXTAREA' && bx.title.length > 2, bx);
  await typeIn(LONG); await p.screenshot({ path: 'shots/bigbox.png' }); await press('bb_save');
  ok('Save: the text is in the small box and the page was told (as if typed there)', (await f.evaluate(s => document.querySelector(s).value, W)) === LONG && (await f.evaluate(() => window.__ch)) === 1 && (await box()) === null);
  await f.evaluate(s => document.querySelector(s).dispatchEvent(new MouseEvent('mouseover', { bubbles: true })), W);
  ok('a cut text shows in full when the mouse rests on the box', (await f.evaluate(s => document.querySelector(s).title, W)) === LONG);
  await dbl(W); await typeIn('something else'); await press('bb_cancel');
  ok('Cancel: nothing changes', (await f.evaluate(s => document.querySelector(s).value, W)) === LONG && (await f.evaluate(() => window.__ch)) === 1);
  await dbl(W); await press('bb_clear'); const cleared = (await box()).value; await press('bb_save');
  ok('Clear, then Save: the box is empty', cleared === '' && (await f.evaluate(s => document.querySelector(s).value, W)) === '');
  // F2 and the small button
  await f.focus('#lg_in .lrow [data-f=chFrom]'); await wait(200);
  const tip = await f.evaluate(() => { const t = document.getElementById('bb_tip'), i = document.querySelector('#lg_in .lrow [data-f=chFrom]').getBoundingClientRect(), r = t.getBoundingClientRect(); return { shown: !t.hidden, corner: Math.abs(r.right - (i.right + 6)) <= 3 && r.top < i.top && r.bottom > i.top }; });
  ok('the box with the keyboard shows the small ⤢ on its top right corner (not over the text)', tip.shown && tip.corner, tip);
  await p.keyboard.press('F2'); bx = await box(); ok('F2 opens the large box of the box with the keyboard (Chainage From)', !!bx, bx && bx.title);
  await typeIn('12+500\nLHS service road'); await p.keyboard.down('Control'); await p.keyboard.press('Enter'); await p.keyboard.up('Control'); await wait(150);
  ok('Ctrl + Enter saves; a line break becomes a space in a one-line box', (await f.evaluate(() => document.querySelector('#lg_in .lrow [data-f=chFrom]').value)) === '12+500 LHS service road' && (await box()) === null);
  await f.focus('#lg_in .lrow [data-f=chTo]'); await wait(200); await f.evaluate(() => document.getElementById('bb_tip').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))); bx = await box();
  ok('the small ⤢ opens it too', !!bx, bx && bx.title); await p.keyboard.press('Escape'); await wait(100); ok('Esc cancels', (await box()) === null);
  // number, pick-list, and what must not open
  await dbl('#lg_in .lrow [data-f=closingKm]'); bx = await box(); ok('a reading opens as a large NUMBER box, named "Close KM"', bx && bx.tag === 'INPUT' && bx.type === 'number' && bx.title === 'Close KM', bx);
  const start = Number(await f.evaluate(() => document.querySelector('#lg_in .lrow [data-f=openingKm]').value)); await typeIn(String(start + 77)); await p.keyboard.press('Enter'); await wait(300);
  ok('…Save recalculates the row (Total 77)', await f.evaluate(() => { lgCalcAll(); return /77/.test(document.querySelector('#lg_in .lrow [data-o=wkm]').textContent); }), await f.evaluate(() => document.querySelector('#lg_in .lrow [data-o=wkm]').textContent));
  await dbl('#lg_in .lrow [data-f=no]'); bx = await box(); ok('a box with a pick-list keeps its list in the large box', bx && bx.tag === 'INPUT' && bx.list === 'dl_machines', bx); await press('bb_cancel');
  await dbl('#lg_top_date'); const d1 = await box(); await dbl('#lg_in .lrow [data-f=shift]'); const d2 = await box(); await f.evaluate(() => { showTab('diesel'); }); await wait(1500); await dbl('#d_balance'); const d3 = await box(); await f.evaluate(() => { showTab('log'); }); await wait(800);
  ok('dates, drop-downs and locked boxes do not open large', d1 === null && d2 === null && d3 === null, [d1, d2, d3]);
  // inside a dialog: Esc closes the large box only
  await f.evaluate(() => { askConfirm({ title: 'Test dialog', html: '<input id="tdlg" value="abc">', ok: 'OK' }); }); await wait(200); await dbl('#tdlg'); bx = await box(); await p.keyboard.press('Escape'); await wait(150);
  ok('over a dialog: the large box opens above it and Esc closes only the large box', !!bx && (await box()) === null && await f.evaluate(() => !document.getElementById('cf_back').hidden)); await f.evaluate(() => closeConfirm(false));
  // every page: count the boxes that can be opened
  const cover = await f.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); let n = 0, pages = 0; for (const t of TABS) { try { closeConfirm(false); } catch (e) {} showTab(t); await sleep(150); const sec = document.getElementById('sec-' + t); if (!sec) continue; const k = [...sec.querySelectorAll('input, textarea')].filter(el => el.offsetParent !== null && !el.readOnly && !el.disabled && ['text', 'search', 'number', 'tel', 'email', 'url', ''].indexOf((el.getAttribute('type') || '').toLowerCase()) > -1 || (el.tagName === 'TEXTAREA' && el.offsetParent !== null)).length; if (k) pages++; n += k; } return { n, pages }; });
  ok('it works on every page without code per field', cover.n > 60 && cover.pages > 15, cover.n + ' typing boxes on ' + cover.pages + ' pages');
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/big.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/big.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 500)); process.exit(1); });
