// update-106 (the Vendor Master common to every site) in the browser, on the local rig (Mechanical :3001, own sign-in): a vendor
// made at S1 is seen at T2 with "made at VTR NH 848 · Sujit"; its Edit and Delete at T2 show the box (which site, who; changed only
// there) and open no form; T2's Admin sees "Vendors of all sites". Test data only; everything is put back at the end.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node vendors106.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process'), fs = require('fs'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms)); const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const SHOTS = '/home/claude/test/shots/', BASE = 'http://127.0.0.1:3001', PW = 'Nashik#Road848!';
(async () => {
  const def1 = sql('rcl', "select is_default from rcl_user_sites where email = 'sujit@rcl.test' and site = 'S1'") === 't';
  const was2 = sql('rcl_s2', "select admin || '|' || coalesce(perm_vendor_master,'') from app_users where email = 'sujit@rcl.test'");
  const step = fs.readFileSync(path.join(__dirname, '..', '..', 'sql', 'supabase_step1y_vendor_owner.sql'), 'utf8');
  for (const db of ['rcl', 'rcl_s2']) { sql(db, step); sql(db, "delete from public.vendors where vendor_name like 'V106 %'; delete from web.cache where key like 'SBCOL%';"); }
  sql('rcl', "update rcl_user_sites set is_default = false where email = 'sujit@rcl.test'; insert into rcl_user_sites (email, site, is_admin, is_default) values ('sujit@rcl.test', 'T2', true, true) on conflict (email, site) do update set is_admin = true, is_default = true");
  sql('rcl_s2', "update app_users set admin = 'Yes', perm_vendor_master = 'Edit', updated_at = now() + interval '1 second' where email = 'sujit@rcl.test'");
  sql('rcl', "insert into vendors (id, vendor_name, gst_registered, pan_number, entered_at, entered_by, owner_site) values ('V106 GAMMA EARTHMOVERS', 'V106 Gamma Earthmovers', 'No', 'ABCPG1061A', now(), 'Sujit', 'S1')");
  sql('rcl_s2', "insert into vendors (id, vendor_name, gst_registered, pan_number, entered_at, entered_by, owner_site) values ('V106 GAMMA EARTHMOVERS', 'V106 Gamma Earthmovers', 'No', 'ABCPG1061A', now(), 'Sujit', 'S1')");
  await wait(16500);
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    const frameReady = async pg => { for (let i = 0; i < 60; i++) { await wait(500); const fr = pg.frames().find(x => x !== pg.mainFrame()); try { if (fr && await fr.evaluate(() => !!document.getElementById('lg_email') && typeof showTab === 'function')) return fr; } catch (e) {} } throw new Error('the page did not load'); };
    let f = await frameReady(p); await wait(2500); f = await frameReady(p);
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', PW); await f.click('#lg_btn'); await wait(8000);
    f = await frameReady(p).catch(() => f);
    await p.screenshot({ path: SHOTS + 'v106_login.png' });
    // two sites: the sign-in asks which – T2
    await f.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Test Site T2/.test(x.textContent) && x.offsetParent); if (b) b.click(); }); await wait(7000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} showTab('vendors'); }); await wait(3500);
    const st = await f.evaluate(() => ({ site: (S.siteInfo || {}).site || '', row: ([...document.querySelectorAll('#v_rows tr')].find(tr => /V106 Gamma/.test(tr.textContent)) || {}).innerText || '', note: $('v_share').hidden ? '' : $('v_share').textContent, all: !$('v_all').hidden }));
    ok('at T2: the vendor made at S1 is listed with "made at VTR NH 848 · Sujit"; the note says one Vendor Master for every site; "Vendors of all sites" for the Admin', /made at VTR NH 848 · Sujit/.test(st.row) && /One Vendor Master for every site/.test(st.note) && st.all, st);
    await f.evaluate(() => [...document.querySelectorAll('#v_rows tr')].find(tr => /V106 Gamma/.test(tr.textContent)).querySelector('[data-vedit]').click()); await wait(600);
    const box = await f.evaluate(() => ({ open: !$('cf_back').hidden, text: $('cf_back').innerText, form: !$('v_form').hidden }));
    ok('   its Edit: a box – made at site VTR NH 848 by Sujit, changed only there; no form', box.open && /was made at site VTR NH 848 by Sujit/.test(box.text) && /only at VTR NH 848/.test(box.text) && !box.form, box);
    await p.screenshot({ path: SHOTS + 'v106_box.png' });
    await f.evaluate(() => $('cf_ok').click()); await wait(300);
    await f.evaluate(() => [...document.querySelectorAll('#v_rows tr')].find(tr => /V106 Gamma/.test(tr.textContent)).querySelector('[data-vdel]').click()); await wait(600);
    const box2 = await f.evaluate(() => ({ open: !$('cf_back').hidden, text: $('cf_back').innerText }));
    ok('   its Delete: the same box (nothing deleted)', box2.open && /made at site VTR NH 848/.test(box2.text) && sql('rcl_s2', "select count(*) from vendors where vendor_name = 'V106 Gamma Earthmovers'") === '1', box2);
    await f.evaluate(() => $('cf_ok').click()); await wait(300);
    await f.evaluate(() => $('v_all').click()); await wait(5000);
    const plan = await f.evaluate(() => ({ open: !$('cf_back').hidden, text: $('cf_back').innerText }));
    ok('"Vendors of all sites": what each site would get, before anything is written', plan.open && /Bring the vendors of all sites together\?|already have the same/.test(plan.text) && /VTR NH 848|Test Site T2/.test(plan.text), plan.text.slice(0, 400));
    await p.screenshot({ path: SHOTS + 'v106_all.png' });
  } catch (e) { ok('the run finished', false, e.stack || String(e)); }
  finally { await b.close(); }
  ok('no script error', errs.length === 0, errs);
  for (const db of ['rcl', 'rcl_s2']) sql(db, "delete from public.vendors where vendor_name like 'V106 %'");
  sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'; update rcl_user_sites set is_default = " + def1 + " where email = 'sujit@rcl.test' and site = 'S1'");
  const w = was2.split('|'); sql('rcl_s2', "update app_users set admin = '" + w[0] + "', perm_vendor_master = '" + w[1] + "' where email = 'sujit@rcl.test'");
  console.log(out.join('\n')); console.log('\nTOTAL ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
