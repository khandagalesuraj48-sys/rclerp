// a phone: picking from a list by touch, and the phone's Back button. Real touches in a phone-size browser; page, server, database real.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 430) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1500);
  let f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const tapEl = async sel => { const r = await f.evaluate(s => { const el = typeof s === 'string' ? document.querySelector(s) : null; if (!el) return null; el.scrollIntoView({ block: 'center' }); const x = el.getBoundingClientRect(); return [x.left + x.width / 2, x.top + x.height / 2]; }, sel); if (!r) throw new Error('not found: ' + sel); await wait(150); await p.touchscreen.tap(r[0], r[1]); await wait(450); };
  const list = () => f.evaluate(() => { const b = document.getElementById('pk_list'); return b && !b.hidden ? { rows: [...b.querySelectorAll('.pk-row')].map(x => x.firstChild.textContent), h: Math.round(b.querySelector('.pk-row').getBoundingClientRect().height), inView: b.getBoundingClientRect().bottom <= innerHeight + 1 && b.getBoundingClientRect().top >= 0 } : null; });
  // ---------- 1. the machinery box of Diesel Issue ----------
  await f.evaluate(() => { showTab('diesel'); }); await wait(1500);
  await f.evaluate(() => { window.__chg = 0; document.getElementById('d_no').addEventListener('change', () => { window.__chg++; }); });
  await tapEl('#d_no');
  let l = await list();
  ok('touching the machinery box opens the app\'s own list under it – rows big enough for a finger, inside the screen', l && l.rows.length > 5 && l.h >= 44 && l.inView && await f.evaluate(() => !document.getElementById('d_no').hasAttribute('list')), l && { rows: l.rows.length, first: l.rows.slice(0, 3), rowHeight: l.h, inView: l.inView });
  await p.keyboard.type('0001'); await wait(400); l = await list();
  ok('typing "0001" narrows it to the number, found without its dashes', l && l.rows.join() === 'MH-15-AB-0001', l && l.rows);
  await tapEl('#pk_list .pk-row');
  const picked = await f.evaluate(() => ({ value: document.getElementById('d_no').value, changes: window.__chg, listGone: document.getElementById('pk_list').hidden, known: !!findMachine(document.getElementById('d_no').value) }));
  ok('a tap on the row puts the number in the box and tells the app at once (the "changed" signal) – the list closes', picked.value === 'MH-15-AB-0001' && picked.changes === 1 && picked.listGone && picked.known, picked);
  // ---------- 2. a row of the Log Book (made later) ----------
  await f.evaluate(() => { showTab('log'); }); await wait(2500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} setLgMode('date'); }); await wait(900);
  const sel = await f.evaluate(() => { const i = document.querySelector('#sec-log td.c-m input[data-f="no"]'); if (!i) return ''; i.id = i.id || 'lgtest_no'; return '#' + i.id; });
  await tapEl(sel); await p.keyboard.type('0002'); await wait(500); l = await list();
  const before = await f.evaluate(s => document.querySelector(s).value, sel);
  await tapEl('#pk_list .pk-row'); await wait(1800);
  const row = await f.evaluate(s => { const i = document.querySelector(s), tr = i.closest('tr') || i.closest('.lg-row') || i.parentElement.parentElement; return { value: i.value, rowText: tr.textContent.replace(/\s+/g, ' ').slice(0, 160), startFilled: [...tr.querySelectorAll('input')].some(x => x !== i && /^\d+(\.\d+)?$/.test(x.value) && Number(x.value) > 0) }; }, sel);
  ok('the same in a Log Book row: the pick is taken and the row fills (the Start reading comes)', l && l.rows[0] === 'MH-15-AB-0002' && before === '0002' && row.value === 'MH-15-AB-0002' && row.startFilled, { list: l && l.rows, row: row });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} if (typeof lgClear === 'function') lgClear(); S.formDirty = false; });
  // ---------- 3. the phone's Back ----------
  const state = () => f.evaluate(() => ({ tab: S.curTab, ai: !document.getElementById('ai_panel').hidden, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent })).catch(() => ({ gone: true }));
  const back = async () => { await p.evaluate(() => history.back()); await wait(900); };
  await f.evaluate(() => { showTab('dash'); S.hist = []; }); await wait(600);
  await tapEl('#page_title');                                                  // a touch: the step of history is put in place
  await f.evaluate(() => { showTab('diesel'); }); await wait(500); await f.evaluate(() => { showTab('inward'); }); await wait(500);
  await back(); let s1 = await state(); await tapEl('#page_title'); await back(); let s2 = await state();
  ok('Back goes ONE page back each time and the app stays open (Diesel Inward → Diesel Issue → Dashboard)', s1.tab === 'diesel' && s2.tab === 'dash' && /127\.0\.0\.1:3000/.test(p.url()), { first: s1.tab, second: s2.tab, url: p.url() });
  await tapEl('#ai_fab'); const opened = (await state()).ai; await back(); const s3 = await state();
  ok('with the assistant\'s window open, Back closes it (the page stays)', opened && !s3.ai && s3.tab === 'dash', { opened: opened, after: s3 });
  await f.evaluate(() => { showTab('diesel'); document.getElementById('d_no').value = ''; }); await wait(700); await tapEl('#d_no'); const lo = !!(await list()); await back(); const s4 = await state();
  ok('with a pick-list open, Back closes the list first', lo && !(await list()) && s4.tab === 'diesel', { listWasOpen: lo, tab: s4.tab });
  await f.evaluate(() => { document.activeElement && document.activeElement.blur(); showTab('dash'); S.hist = []; }); await wait(500); await tapEl('#page_title');
  await back(); const s5 = await state();
  ok('on the first page with nothing open: "press Back again to leave" – still in the app', !s5.gone && s5.tab === 'dash' && /Back पुन्हा दाबा/.test(s5.toast) && /127\.0\.0\.1:3000/.test(p.url()), s5);
  await back(); await wait(800);
  ok('a second Back straight after leaves the app', !/127\.0\.0\.1:3000/.test(p.url()), p.url());
  ok('no script error', errs.length === 0, errs.join(' | '));
  // ---------- 4. a computer keeps the browser's own list ----------
  const p2 = await b.newPage(); await p2.setViewport({ width: 1536, height: 860 }); await p2.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1500);
  const f2 = p2.frames().find(x => x !== p2.mainFrame());
  await f2.type('#lg_email', 'sujit@rcl.test'); await f2.type('#lg_pass', 'Nashik#Road848!'); await f2.click('#lg_btn'); await wait(6000);
  await f2.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); }); await wait(1200); await f2.click('#d_no'); await wait(400);
  ok('on a computer nothing changes: the box keeps the browser\'s own list', await f2.evaluate(() => document.getElementById('d_no').getAttribute('list') === 'dl_machines' && !document.getElementById('pk_list')));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/mob.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/mob.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
