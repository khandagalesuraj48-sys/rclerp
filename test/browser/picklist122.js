// update-122 (asked 17-10-2026: "android aso ios aso window aso … iphone warti pn te disat nahi number … proper work hoyla haw"):
// the machinery box of an entry (Diesel Issue, Log Book, Tank Check, Breakdown – the machinery on site on its date) shows the
// numbers to pick on an Android phone, an iPhone and an iPad (also with a keyboard), and a computer keeps the browser's list.
// The page's own code (cut out of app/App.html) on a small page – no rig needed. Chromium through Playwright:
//   node test/browser/picklist122.js [app/App.html]
const fs = require('fs'), path = require('path');
const need = n => { try { return require(n); } catch (e) { return require(path.join('/opt/node-tools/node_modules', n)); } };
const { chromium } = need('playwright');
const os = require('os'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pk122-'));
const app = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', '..', 'app', 'App.html'), 'utf8');
const cut = (a, b) => { const i = app.indexOf(a); if (i < 0) throw new Error('not found ' + a); const j = app.indexOf(b, i); if (j < 0) throw new Error('not found ' + b); return app.slice(i, j); };
const css = cut('  #pk_list {', '  #pk_list .pk-row small') + cut('  #pk_list .pk-row small', '\n') + '\n';
const pk = cut(app.indexOf('  const pkApple = ') > -1 ? '  const pkApple = ' : '  const pkTouch = ', '\n  /* ---------- THE PHONE\'S BACK BUTTON');
const mo = cut('  const machOpt = m =>', '  function renderMaster() {');
const esc = cut('  const esc = s =>', '\n');
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px sans-serif;margin:20px} input{font-size:16px;min-height:42px;width:300px}${css}</style></head><body>
<input type="date" id="d_date" value="2026-10-17"><br><br><label for="d_no">Machinery Number / Name</label><br>
<input id="d_no" list="dl_mach_on" data-on="d_date" autocomplete="off" placeholder="Type or pick a number or name">
<datalist id="dl_machines"></datalist><datalist id="dl_mach_on"></datalist>
<script>
${esc}
const $ = id => document.getElementById(id);
function showDate(dk) { if (!dk) return ''; const p = String(dk).split('-'); return esc(p[2] + '-' + p[1] + '-' + p[0]); }
const S = { today: '2026-10-17', machOnFor: '', master: [
  { id: 'Sany 210 (No.1)', no: 'SANY210', name: 'Sany 210', type: 'Excavator', status: 'Active' },
  { id: 'Sany 140', no: 'SANY140', name: 'Sany 140', type: 'Excavator', status: 'Active' },
  { id: 'MH-25-AJ-8511', no: 'MH-25-AJ-8511', name: '', type: 'Tipper', status: 'Active' },
  { id: 'Scania 9', no: 'SC9', name: '', type: 'Tipper', status: 'Active', gone: true }] };
const onSiteOn = (m, dk) => !m.gone;
${pk}
${mo}
</script></body></html>`;
fs.writeFileSync(path.join(dir, 'page.html'), html);
const iPhoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const iPadUA = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const out = {};
  for (const [name, opt] of [['Android phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' }],
    ['iPhone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: iPhoneUA }],
    ['iPad with a keyboard (no touch pointer, 1024 wide)', { viewport: { width: 1180, height: 820 }, userAgent: iPadUA }],
    ['Windows computer', { viewport: { width: 1366, height: 768 }, userAgent: winUA }]]) {
    const ctx = await b.newContext(opt), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto('file://' + path.join(dir, 'page.html'));
    if (opt.hasTouch) await p.tap('#d_no'); else await p.click('#d_no');
    await p.keyboard.type('Sa'); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const box = document.getElementById('pk_list'); return { own: !!box && !box.hidden, rows: box ? [...box.querySelectorAll('.pk-row')].map(x => x.dataset.pkv) : [], browserList: document.getElementById('d_no').getAttribute('list'), options: [...document.querySelectorAll('#dl_mach_on option')].map(o => o.value) }; });
    if (r.own) { const row = await p.$('#pk_list .pk-row'); const bb = await row.boundingBox(); if (opt.hasTouch) await p.touchscreen.tap(bb.x + 10, bb.y + 10); else await p.mouse.click(bb.x + 10, bb.y + 10); await p.waitForTimeout(200); r.picked = await p.inputValue('#d_no'); }
    out[name] = Object.assign(r, { errors: errs });
    await ctx.close();
  }
  await b.close();
  let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  → ' + JSON.stringify(x))); };
  const want = ['Sany 210 (No.1)', 'Sany 140'];
  ['Android phone', 'iPhone', 'iPad with a keyboard (no touch pointer, 1024 wide)'].forEach(n => {
    const r = out[n];
    ok(n + ': the app\'s own list opens under the box', r.own, r);
    ok(n + ': the machinery on site on the date that match "Sa" (not the one gone)', JSON.stringify(r.rows) === JSON.stringify(want), r.rows);
    ok(n + ': a tap puts the number in the box', r.picked === 'Sany 210 (No.1)', r.picked);
    ok(n + ': no page error', !r.errors.length, r.errors);
  });
  const w = out['Windows computer'];
  ok('Windows computer: the browser\'s own list, filled with the machinery on site', w.browserList === 'dl_mach_on' && !w.own && JSON.stringify(w.options) === JSON.stringify(['Sany 210 (No.1)', 'Sany 140', 'MH-25-AJ-8511']), w);
  console.log(pass + ' passed, ' + fail + ' failed');
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})();
