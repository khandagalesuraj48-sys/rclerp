// update-125 (asked 18-10-2026, a picture from a phone: "site change la jatoy tewa site change krnecha option yetoy but blue
// pattice maghe hide hotey"): on a phone the dark menu is a drawer over the page; "Change site" at its top opened its box BEHIND
// the drawer (the box under the menu and its dark shade), so the sites could not be pressed. Now the drawer closes first and the
// box is on top – on a phone, on a computer (the menu that opens over the page) and on a tablet.
// The page's own file in Chromium (Playwright), nothing else loaded – no rig needed; nothing is signed in, nothing is sent:
//   node test/browser/sitechg125.js [app/App.html]
const fs = require('fs'), path = require('path'), os = require('os');
const need = n => { try { return require(n); } catch (e) { return require(path.join('/opt/node-tools/node_modules', n)); } };
const { chromium } = need('playwright');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'app', 'App.html'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitechg125-'));
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x))); };
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ name: 'phone', w: 390, h: 844, m: true }, { name: 'tablet', w: 760, h: 1024, m: true }, { name: 'computer', w: 1366, h: 768, m: false }]) {
    // isMobile stays off: the page's file has no viewport line (the server adds it), so the width given is the page's width
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.m,
      permissions: ['geolocation'], geolocation: { latitude: 16.69, longitude: 74.17, accuracy: 20 } });      // the page needs the location
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());      // no server: only the page itself
    await p.goto('file://' + file, { waitUntil: 'load' });
    await p.waitForTimeout(400);
    // the page as after a sign-in with two sites (the app's own switch – the same box as through the Portal)
    await p.evaluate(() => {
      const ls = document.getElementById('login_screen'); if (ls) ls.hidden = true; document.body.classList.remove('locked');
      const bt = document.getElementById('boot'); if (bt) bt.hidden = true;
      siteBoot({ site: 'S2', name: '18B KOLHAPUR', sites: [{ code: 'S1', name: 'VTR NH 848' }, { code: 'S2', name: '18B KOLHAPUR' }] });
    });
    if (vp.name !== 'computer') { await p.click('#nav_menu'); await p.waitForTimeout(700); }      // the drawer slides in
    const before = await p.evaluate(() => { const r = document.getElementById('site_chg').getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && !!t.closest('#site_chg'); });
    ok(vp.name + ': "Change site" can be pressed in the menu', before);
    await p.click('#site_chg'); await p.waitForTimeout(700);
    const st = await p.evaluate(() => {
      const box = document.getElementById('cf_box'), back = document.getElementById('cf_back');
      const btns = [...document.querySelectorAll('#cf_msg .sp-btn')];
      const top = el => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t ? (t.closest('#cf_box') ? 'the box' : t.closest('.side') ? 'the menu' : t.id === 'nav_back' ? 'the menu\'s shade' : (t.id || t.className || t.tagName)) : 'nothing'; };
      return { open: !back.hidden, sites: btns.map(x => x.textContent), atSites: btns.map(top), atOk: top(document.getElementById('cf_ok')), atTitle: top(document.getElementById('cf_title')),
        drawer: document.querySelector('.app').classList.contains('nav-open') };
    });
    ok(vp.name + ': the "Change site" box is open with both sites', st.open && st.sites.length === 2, st);
    ok(vp.name + ': the box is on top – its sites, its title and "Stay here" can be pressed', st.atSites.every(x => x === 'the box') && st.atOk === 'the box' && st.atTitle === 'the box', st);
    ok(vp.name + ': the drawer closed when "Change site" was pressed', !st.drawer, st);
    await p.screenshot({ path: path.join(dir, vp.name + '.png') });
    // "Stay here": the box closes, the page is as it was, nothing is opened
    const pressed = await p.click('#cf_ok', { timeout: 3000 }).then(() => true, () => false);
    if (!pressed) await p.evaluate(() => closeConfirm(false));      // under the menu it cannot be pressed: closed for the next size
    await p.waitForTimeout(300);
    ok(vp.name + ': "Stay here" can be pressed and closes the box', pressed && await p.evaluate(() => document.getElementById('cf_back').hidden));
    ok(vp.name + ': no page error', errs.length === 0, errs);
    await ctx.close();
  }
  await b.close();
  console.log(pass + ' passed, ' + fail + ' failed  (pictures: ' + dir + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
