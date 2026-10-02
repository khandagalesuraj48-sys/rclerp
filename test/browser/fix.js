// help for errors in the page: the card under a red message, the language switch, the help inside a "Nothing saved" box
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
(async () => {
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 90000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(800);
  const f = p.frames().find(x => x !== p.mainFrame());
  // a wrong password at sign-in
  await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'wrong-password-1'); await f.click('#lg_btn'); await wait(2500);
  const lg = await f.evaluate(() => { const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ') : ((document.getElementById('lg_err') || {}).textContent || 'no card'); });
  console.log('   sign-in with a wrong password shows: ' + lg.slice(0, 200));
  await f.evaluate(() => { document.getElementById('lg_pass').value = ''; }); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(4500);
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('diesel'); }); await wait(2500); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  // 1. Diesel Issue for a machinery that is not in the Master
  await f.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('d_no', 'ZZ-00-ZZ-0000'); set('d_qty', '20'); document.getElementById('d_save').click(); });
  await wait(2500);
  const card = async () => f.evaluate(() => { const bx = document.getElementById('fixbox'); return bx && !bx.hidden ? { msg: bx.querySelector('.fx-msg').textContent, help: bx.querySelector('.fixhelp').textContent.replace(/\s+/g, ' '), on: (bx.querySelector('.fx-lang .on') || {}).textContent } : null; });
  let c = await card();
  ok('a refused entry opens the help card, in Marathi by default', c && c.on === 'मराठी' && /काय चुकले/.test(c.help) && /काय करायचे/.test(c.help), c);
  await p.screenshot({ path: 'shots/fix_card.png' });
  await f.evaluate(() => document.querySelector('#fixbox [data-fixlang=hi]').click()); await wait(200); c = await card();
  ok('हिंदी: the same help in Hindi', c && c.on === 'हिंदी' && /क्या गलत है/.test(c.help) && /क्या करना है/.test(c.help), c && c.help.slice(0, 160));
  await f.evaluate(() => document.querySelector('#fixbox [data-fixlang=en]').click()); await wait(200); c = await card();
  ok('English: the same help in English', c && c.on === 'English' && /What is wrong/.test(c.help) && /What to do/.test(c.help), c && c.help.slice(0, 160));
  ok('the choice of language is remembered on this device', await f.evaluate(() => localStorage.getItem('rcl_lang')) === 'en');
  await f.evaluate(() => { document.querySelector('#fixbox [data-fixlang=mr]').click(); document.querySelector('#fixbox .fx-x').click(); }); await wait(200);
  ok('the card closes with ×', await f.evaluate(() => document.getElementById('fixbox').hidden === true));
  // 2. Log Book: closing reading below the start → "Nothing saved" box with the help inside
  await f.evaluate(() => showTab('log')); await wait(2500); await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  await f.evaluate(async () => { setLgMode('date'); const tr = document.querySelector('#lg_in .lrow'); const x = tr.querySelector('[data-f=no]'); x.value = 'MH-15-AB-0001'; x.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1500));
    const cl = tr.querySelector('[data-f=closingKm]'); cl.value = '5'; cl.dispatchEvent(new Event('input', { bubbles: true })); cl.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait(600); await f.evaluate(() => document.getElementById('l_save').click()); await wait(2500);
  const dlg = await f.evaluate(() => { const bk = document.getElementById('cf_back'); const bx = document.getElementById('fixbox'); return { open: !bk.hidden, title: document.getElementById('cf_title').textContent, text: document.getElementById('cf_msg').textContent.replace(/\s+/g, ' ').slice(0, 420), help: !!document.querySelector('#cf_msg .fixhelp'), card: bx && !bx.hidden ? bx.textContent.replace(/\s+/g, ' ').slice(0, 300) : '' }; });
  ok('Log Book with a closing reading below the start: the message comes with "what is wrong / what to do"', (dlg.open && dlg.help && /काय करायचे/.test(dlg.text)) || /काय करायचे/.test(dlg.card), dlg.open ? dlg.title + ' :: ' + dlg.text : dlg.card);
  await p.screenshot({ path: 'shots/fix_dialog.png' });
  await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
  // 3. a good save hides the card
  await f.evaluate(() => { fixCard('Failed to fetch'); toast('Saved.'); }); await wait(200);
  ok('a successful save hides the card', await f.evaluate(() => document.getElementById('fixbox').hidden === true));
  ok('no script error', errs.length === 0, errs.join(' | '));
  console.log(pass + ' passed, ' + fail + ' failed'); await b.close();
})().catch(e => { console.log('CRASH', String(e.stack || e).slice(0, 400)); process.exit(1); });
