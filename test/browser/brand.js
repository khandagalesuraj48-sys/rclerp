// One Click Solution: the sign-in brand, "Company & site" settings (update-123: no opening film – the link opens the sign-in at once)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'); const { execSync } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = q => execSync('su postgres -c "psql -d rcl -tA"', { input: q }).toString().trim();
const rpc = async (fn, ...args) => (await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args }) })).json();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) : '')); };
(async () => {
  sql("delete from web.props where key = 'ORG_SETTINGS'");
  // before anybody signs in the server gives only the brand and whose copy this is
  const pub = await rpc('orgInfo'); ok('without a sign-in the server tells the product and whose copy this is – nothing else', pub.result && pub.result.brand === 'One Click Solution' && pub.result.customer === 'Rachana Construction Limited' && pub.result.site === 'VTR Site – NH 848' && Object.keys(pub.result).sort().join() === 'billNames,brand,customer,intro,logo,product,site,video', pub.result || pub.error);
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const p = await b.newPage(); await p.setViewport({ width: 1536, height: 860 });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(2600);
  const f = p.frames().find(x => x !== p.mainFrame());
  // (update-123, asked 17-10-2026: "one click che ek animation … purn kadhun tak … link click direct login page")
  // (the sign-in is position: fixed – it has no offsetParent: what is seen is asked of the screen itself, at its middle)
  const seen = () => { const ls = document.getElementById('login_screen'), top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return { film: !!document.getElementById('oc_intro'), login: !ls.hidden && getComputedStyle(ls).display !== 'none', atMiddle: top ? (top.closest('#login_screen') ? 'sign-in' : top.id || top.className || top.tagName) : '' }; };
  const open = await f.evaluate(seen);
  ok('the link opens the sign-in at once – no opening film, nothing over the sign-in', !open.film && open.login && open.atMiddle === 'sign-in', open);
  // (update-81, asked 11-10-2026: the sign-in screen shows One Click Solution only – no customer name or logo on it)
  const lg = await f.evaluate(() => { const ls = document.getElementById('login_screen'); return { brand: document.querySelector('#login_form .oc-logo').alt, rachana: /Rachana/i.test(ls.textContent) || [...ls.querySelectorAll('img')].some(i => /Rachana|RCL/i.test(i.alt + i.getAttribute('src'))), title: window.top.document.title }; });
  ok('the sign-in screen carries the One Click Solution logo only – no Rachana name or logo on it', /One Click Solution/.test(lg.brand) && !lg.rachana && /Rachana Construction Limited – Fleet ERP · One Click Solution/.test(lg.title), lg);
  await p.screenshot({ path: 'shots/oc_login.png' });
  await p.reload({ waitUntil: 'load' }); await wait(1500);
  const f2 = p.frames().find(x => x !== p.mainFrame());
  const again = await f2.evaluate(seen);
  ok('a reload: the sign-in at once again (no film)', !again.film && again.login && again.atMiddle === 'sign-in', again);
  await f2.type('#lg_email', 'sujit@rcl.test'); await f2.type('#lg_pass', 'Nashik#Road848!'); await f2.click('#lg_btn'); await wait(5500);
  await f2.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('users'); }); await wait(2500);
  const form = await f2.evaluate(() => ({ customer: document.getElementById('org_customer').value, site: document.getElementById('org_site').value, names: document.getElementById('org_names').value, note: document.getElementById('ua_site').textContent, company: document.getElementById('company').textContent, by: document.querySelector('.brandsub').textContent }));
  ok('inside: the customer\'s name as before, "by One Click Solution" under the logo, and the Users page says which site its users belong to', form.customer === 'Rachana Construction Limited' && form.site === 'VTR Site – NH 848' && /belong to: Rachana Construction Limited – VTR Site – NH 848/.test(form.note) && form.company === 'Rachana Construction Limited' && /by One Click Solution/.test(form.by), form);
  // change the site name: reports and Excel headings follow; then back
  const save = async vals => { await f2.evaluate(v => { Object.keys(v).forEach(k => { const el = document.getElementById(k); if (el.type === 'checkbox') el.checked = v[k]; else el.value = v[k]; }); document.getElementById('org_save').click(); }, vals); for (let i = 0; i < 20; i++) { await wait(400); const t = await f2.evaluate(() => { const x = document.getElementById('toast'), bx = document.getElementById('fixbox'); return (x && !x.hidden ? x.textContent : '') + (bx && !bx.hidden ? ' || ' + bx.querySelector('.fx-msg').textContent : ''); }); if (t.trim()) return t; } return ''; };
  let t = await save({ org_site: 'Pune Ring Road – Package 3' });
  const after = await f2.evaluate(() => ({ site: SITE_NAME, head: lbHeadRows('x')[1][0], note: document.getElementById('ua_site').textContent }));
  ok('a new site name is saved and used on the reports at once', /saved/.test(t) && after.site === 'Pune Ring Road – Package 3' && after.head === 'Pune Ring Road – Package 3' && JSON.parse(sql("select value from web.props where key = 'ORG_SETTINGS'")).site === 'Pune Ring Road – Package 3', after);
  await f2.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; });
  t = await save({ org_logo: 'http://not-secure.example/logo.png' }); ok('a logo link that is not https is refused', /must be a link that starts with https/.test(t), t.slice(0, 120));
  await f2.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; document.getElementById('org_logo').value = 'https://i.ibb.co/CpSfBqXX/RCL-LOGO-PDF.png'; });
  const hasBills = Number(sql("select count(*) from bills where company = 'Rachana Construction Limited'"));
  t = await save({ org_names: 'Sketchline Industries' }); ok('a name that saved bills carry cannot be taken away (' + hasBills + ' bills)', hasBills > 0 ? /cannot be taken away/.test(t) : /saved/.test(t), t.slice(0, 140));
  await f2.evaluate(() => { const bx = document.getElementById('fixbox'); if (bx) bx.hidden = true; });
  t = await save({ org_site: 'VTR Site – NH 848', org_names: 'Sketchline Industries\nRachana Construction Limited' }); ok('put back as it was', /saved/.test(t) && await f2.evaluate(() => SITE_NAME === 'VTR Site – NH 848'), t.slice(0, 80));
  ok('Company & site: no film link, no "Play the opening" tick or button', await f2.evaluate(() => !document.getElementById('org_video') && !document.getElementById('org_intro') && !document.getElementById('org_play')));
  const kept = JSON.parse(sql("select value from web.props where key = 'ORG_SETTINGS'"));
  ok('a save keeps what was kept for the film as it was (nothing in the data changes)', kept.intro === true && kept.video === '', { intro: kept.intro, video: kept.video });
  ok('no script error', errs.length === 0, errs.join(' | '));
  out.push(pass + ' passed, ' + fail + ' failed'); fs.writeFileSync('/tmp/brand.out', out.join('\n')); await b.close();
  sql("delete from web.props where key = 'ORG_SETTINGS'");
})().catch(e => { fs.writeFileSync('/tmp/brand.out', out.join('\n') + '\nCRASH ' + String(e.stack || e).slice(0, 600)); process.exit(1); });
