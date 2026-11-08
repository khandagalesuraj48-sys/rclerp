// a phone, by touch only: the menu, a whole Diesel Issue entry (machinery from the list, litres, Save), the vendor list in a filter
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process'); const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
(async () => {
  sql("delete from diesel_issue where remark = 'touch test'");
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 360, height: 760, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1500);
  const f = p.frames().find(x => x !== p.mainFrame());
  await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); } catch (e) {} });
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  const tap = async sel => { const r = await f.evaluate(s => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: 'center' }); const x = el.getBoundingClientRect(); const top = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return { at: [x.left + x.width / 2, x.top + x.height / 2], reachable: !!top && (top === el || el.contains(top) || top.contains(el)), covered: top && !(top === el || el.contains(top) || top.contains(el)) ? (top.id || top.className || top.tagName) : '' }; }, sel); if (!r) throw new Error('not found: ' + sel); await wait(150); await p.touchscreen.tap(r.at[0], r.at[1]); await wait(500); return r; };
  // the menu
  await tap('#nav_menu'); const open = await f.evaluate(() => document.querySelector('.app').classList.contains('nav-open'));
  const item = await tap('#tab-diesel'); await wait(900);
  const afterMenu = await f.evaluate(() => ({ tab: S.curTab, drawer: document.querySelector('.app').classList.contains('nav-open') }));
  ok('the menu opens with a touch, a touch on "Diesel Issue" goes there and the menu closes', open && item.reachable && afterMenu.tab === 'diesel' && !afterMenu.drawer, { opened: open, after: afterMenu });
  // a whole entry
  await tap('#d_no'); await p.keyboard.type('0001'); await wait(400); await tap('#pk_list .pk-row'); await wait(600);
  await p.screenshot({ path: 'shots/mob_form.png' });
  await tap('#d_qty'); await p.keyboard.type('12'); await tap('#d_km'); await p.keyboard.type('6000'); await tap('#d_remark'); await p.keyboard.type('touch test');
  const vals = await f.evaluate(() => ({ no: document.getElementById('d_no').value, qty: document.getElementById('d_qty').value, remark: document.getElementById('d_remark').value, date: document.getElementById('d_date').value }));
  const sv = await tap('#d_save'); const said = []; for (let i = 0; i < 12; i++) { await wait(500); const c = await f.evaluate(() => { const c = document.getElementById('cf_back'); const tt = document.getElementById('toast'); let o = tt && !tt.hidden ? 'toast: ' + tt.textContent : ''; if (c && !c.hidden) { o += ' | box: ' + c.textContent.replace(/\s+/g, ' ').slice(0, 160); document.getElementById('cf_ok').click(); } return o; }); if (c) said.push(c); if (sql("select count(*) from diesel_issue where remark = 'touch test'") === '1') break; }
  out.push('   (form: ' + JSON.stringify(vals) + ' · the app said: ' + said.join(' // ').slice(0, 500) + ')');
  const row = sql("select machinery || '|' || qty::float from diesel_issue where remark = 'touch test'");
  ok('a whole Diesel Issue by touch: machinery from the list, litres, Save (the Save button is not covered by anything) – it is in the database', sv.reachable && row === 'MH-15-AB-0001|12', { saveReachable: sv.reachable, coveredBy: sv.covered, row: row });
  // another kind of list: owners / vendors in a filter
  await f.evaluate(() => { showTab('master'); }); await wait(1500);
  const any = await f.evaluate(() => { const i = [...document.querySelectorAll('#sec-master input[list], #sec-master input[data-pk]')].find(x => x.offsetParent !== null && /owner|vendor|type/i.test((x.getAttribute('list') || x.dataset.pk || ''))); if (!i) return ''; i.id = i.id || 'pk_any'; return '#' + i.id; });
  if (any) { await tap(any); await wait(300); const l = await f.evaluate(() => { const b = document.getElementById('pk_list'); return b && !b.hidden ? [...b.querySelectorAll('.pk-row')].length : 0; }); const first = l ? await f.evaluate(() => document.querySelector('#pk_list .pk-row').dataset.pkv) : ''; if (l) await tap('#pk_list .pk-row');
    ok('the other lists work the same (' + any + ')', l > 0 && await f.evaluate((s, v) => document.querySelector(s).value === v, any, first), { rows: l, picked: first }); }
  await p.screenshot({ path: 'shots/mob_list.png' });
  ok('no script error', errs.length === 0, errs.join(' | '));
  sql("delete from diesel_issue where remark = 'touch test'");
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/mob2.out', out.join('\n')); await b.close();
})().catch(e => { fs.writeFileSync('/tmp/mob2.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 500)); try { sql("delete from diesel_issue where remark = 'touch test'"); } catch (e2) {} process.exit(1); });
