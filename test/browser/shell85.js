// update-85: an app that was OPEN when this update went live. A new version only renews the app inside its frame; the outer page
// stays the one loaded before – with "geolocation=()" and a frame that does not allow the location. The new app must see that
// and load the whole page once (which brings the new outer page), not lock the person out; and never reload again and again.
//   node shell85.js <port of a server of the OLD version – update-84> <port of a server of THIS version>
// (rig only; the old version: git archive of update-84 run with dev.js on its own port)
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const OLD = 'http://127.0.0.1:' + (process.argv[2] || '3007'), NEW = 'http://127.0.0.1:' + (process.argv[3] || '3000');
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 500) : '')); };
(async () => {
  const app = (await (await fetch(NEW + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: 'getAppHtml', args: [] }) })).json()).result;
  ok('the app of this version (as a new version is handed to an open page)', app && /locCheck\(\)/.test(app.html), app && app.build);
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
  const ctx = await b.createBrowserContext(), p = await ctx.newPage();
  await ctx.overridePermissions(OLD, ['geolocation']); await p.setGeolocation({ latitude: 19.997453, longitude: 73.789802, accuracy: 20 });
  let navs = 0; p.on('framenavigated', fr => { if (fr === p.mainFrame()) navs++; });
  await p.goto(OLD + '/', { waitUntil: 'load' }); await wait(1500); navs = 0;
  const before = await p.evaluate(() => ({ allow: document.getElementById('app').getAttribute('allow'), policy: (document.featurePolicy || {}).allowsFeature ? document.featurePolicy.allowsFeature('geolocation') : null }));
  ok('the open page is the OLD outer page: its frame does not allow the location, its header forbids it', !/geolocation/.test(before.allow || '') && before.policy === false, before);
  // the new version arrives (as Index.html showApp does)
  await p.evaluate(h => { document.getElementById('app').srcdoc = h; }, app.html);
  for (let i = 0; i < 40 && !navs; i++) await wait(250);
  ok('the new app sees that its frame may not ask for the location and loads the whole page once (no lock-out)', navs === 1, { navs });
  await wait(2000);
  // the page loaded again is still the old one here (this server IS the old version) – the new app handed in again must not loop
  navs = 0; await p.evaluate(h => { document.getElementById('app').srcdoc = h; }, app.html); await wait(5000);
  const f = p.frames().find(x => x !== p.mainFrame());
  const st = await f.evaluate(() => ({ block: !document.getElementById('loc_block').hidden, en: document.getElementById('loc_en').textContent })).catch(e => ({ err: String(e.message) }));
  ok('   a second time within 5 minutes: no reload again (no loop) – the location screen says what to do', navs === 0 && st.block === true, { navs, st });
  // the new outer page: the app opens with the location, without any reload
  const p2 = await ctx.newPage(); await ctx.overridePermissions(NEW, ['geolocation']); await p2.setGeolocation({ latitude: 19.997453, longitude: 73.789802, accuracy: 20 });
  let navs2 = 0; p2.on('framenavigated', fr => { if (fr === p2.mainFrame()) navs2++; });
  await p2.goto(NEW + '/', { waitUntil: 'load' }); await wait(3500);
  const f2 = p2.frames().find(x => x !== p2.mainFrame());
  const st2 = await f2.evaluate(() => ({ block: !document.getElementById('loc_block').hidden, pos: !!LOC.pos, allow: window.parent.document.getElementById('app').getAttribute('allow') }));
  ok('the NEW outer page: its frame allows the location, the app opens at once, no reload', !st2.block && st2.pos && /geolocation/.test(st2.allow) && navs2 === 1, { st2, navs2 });
  await b.close();
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
