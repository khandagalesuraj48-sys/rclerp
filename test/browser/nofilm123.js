// update-123 (asked 17-10-2026: "one click che ek animation yete te animation purn kadhun tak … link click direct login page"):
// the page opened as the link opens it – on a computer and on a phone, the location allowed – shows the sign-in at once: no
// opening film over it. The page's own file in Chromium (Playwright), nothing else loaded – no rig needed:
//   node test/browser/nofilm123.js [app/App.html]
const fs = require('fs'), path = require('path'), os = require('os');
const need = n => { try { return require(n); } catch (e) { return require(path.join('/opt/node-tools/node_modules', n)); } };
const { chromium } = need('playwright');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'app', 'App.html'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nofilm123-'));
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x))); };
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ name: 'computer', w: 1366, h: 768, m: false }, { name: 'phone', w: 390, h: 844, m: true }]) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m, permissions: ['geolocation'], geolocation: { latitude: 19.07, longitude: 72.87, accuracy: 20 } });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());      // no server: only the page itself
    await p.goto('file://' + file, { waitUntil: 'load' });
    for (const ms of [300, 1500]) {
      await p.waitForTimeout(ms === 300 ? 300 : 1200);
      const st = await p.evaluate(() => {
        const ls = document.getElementById('login_screen'), top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return { film: !!document.getElementById('oc_intro'), login: !!ls && !ls.hidden && getComputedStyle(ls).display !== 'none',
          atMiddle: top ? (top.closest('#oc_intro') ? 'the film' : top.closest('#login_screen') ? 'the sign-in' : (top.id || top.className || top.tagName)) : '' };
      });
      ok(vp.name + ', ' + ms + ' ms after opening: the sign-in, no film over it', !st.film && st.login && st.atMiddle === 'the sign-in', st);
    }
    await p.screenshot({ path: path.join(dir, vp.name + '.png') });
    ok(vp.name + ': no page error', errs.length === 0, errs);
    await ctx.close();
  }
  await b.close();
  console.log(pass + ' passed, ' + fail + ' failed  (pictures: ' + dir + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
