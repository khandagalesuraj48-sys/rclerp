// update-109 (Day / Night by the time) in the browser, on the local rig (Mechanical :3001, site S1). The site's hours are set so that
// "now" is Day, then Night: the untouched shift boxes of new entries follow (Diesel Issue, the first Log Book row); a box changed by
// hand keeps the person's choice; the Admin's Settings → Rules of the site shows and saves the two hours. Nothing is saved as an entry.
//   NODE_PATH=<folder with puppeteer-core, @sparticuz/chromium> NODE_OPTIONS="--require <path>/geo-shim.js" node shift109.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const BASE = 'http://127.0.0.1:3001';
(async () => {
  const post = async body => (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })).json();
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const was = (await api('getMyPrefs')).rules || {};
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  const errs = [];
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    await p.goto(BASE + '/', { waitUntil: 'load' });
    let f = null; for (let i = 0; i < 60 && !f; i++) { await wait(500); const fr = p.frames().find(x => x !== p.mainFrame()); try { if (fr && await fr.evaluate(() => typeof showTab === 'function' && !!document.getElementById('lg_email'))) f = fr; } catch (e) {} }
    await wait(2000); f = p.frames().find(x => x !== p.mainFrame());
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(7000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} S.formDirty = false; prefSet({ shift: '' }); });
    // the hours around "now" (the browser's clock): Day = now − 1 h … now + 1 h, then Night = the rest
    const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const times = await f.evaluate(() => { const n = new Date(), a = new Date(n.getTime() - 3600000), z = new Date(n.getTime() + 3600000); const h = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); return { a: h(a), z: h(z) }; });
    const state = () => f.evaluate(() => ({ d: $('d_shift').value, bd: $('bd_shift').value, t: $('t_shift').value, wt: $('wt_shift').value, lg: (lgRows()[0] && lgf(lgRows()[0], 'shift').value) || '', auto: autoShift() }));
    await f.evaluate(t => { setRules(Object.assign({}, S.rules, { dayFrom: t.a, nightFrom: t.z })); showTab('diesel'); }, times); await wait(800);
    let s = await state();
    ok('the site\'s Day hours around now: every untouched new-entry shift box says Day (Diesel one / many, Transfer, tanker)', s.auto === 'Day' && s.d === 'Day' && s.bd === 'Day' && s.t === 'Day' && s.wt === 'Day', s);
    await f.evaluate(() => { showTab('log'); try { setLgMode('date'); } catch (e) {} }); await wait(800);
    await f.evaluate(t => { setRules(Object.assign({}, S.rules, { dayFrom: t.z, nightFrom: t.a })); }, times); await wait(500);
    s = await state();
    ok('the hours changed so that now is Night: the boxes follow, and the first Log Book row (no machinery yet) is Night', s.auto === 'Night' && s.d === 'Night' && s.bd === 'Night' && s.t === 'Night' && s.lg === 'Night', s);
    // one machinery (Log Book "one machinery – many dates"): its first row has the shift of now, not the one after it
    const mrow = await f.evaluate(() => { S.formDirty = false; setLgMode('mach'); const n = $('lg_top_no'); n.value = S.master[0].no; n.dispatchEvent(new Event('change', { bubbles: true })); return S.master[0].no; }); await wait(1500);
    const ms = await f.evaluate(() => { const tr = lgRows()[0]; return tr ? lgf(tr, 'shift').value : ''; });
    ok('Log Book, one machinery (' + mrow + '): the first row is Night as well (before the fix it took the shift after it)', ms === 'Night', ms);
    await f.evaluate(() => { S.formDirty = false; setLgMode('date'); }); await wait(500);
    // a box changed by hand (keyboard): kept while the entry is not saved
    await f.evaluate(() => showTab('diesel')); await wait(500);
    await f.focus('#d_shift'); await p.keyboard.press('ArrowUp'); await wait(300);
    const handVal = await f.evaluate(() => $('d_shift').value);
    await f.evaluate(() => { S.formDirty = true; shiftAuto(); }); await wait(200);
    s = await state();
    ok('a shift changed by hand (Night → ' + handVal + ') stays as the person chose while the entry is not saved', handVal === 'Day' && s.d === 'Day' && s.bd === 'Night', s);
    await f.evaluate(() => { S.formDirty = false; shiftAuto(); }); await wait(200);
    ok('   …once the entry is saved (nothing typed any more) it follows the time again', (await state()).d === 'Night');
    // "My usual shift" (Settings) still wins
    await f.evaluate(() => prefSet({ shift: 'Day' })); await wait(300);
    ok('"My usual shift" = Day: the boxes say Day whatever the time', (await state()).d === 'Day');
    await f.evaluate(() => prefSet({ shift: '' })); await wait(300);
    // the Admin's Settings → Rules of the site: the two hours shown and saved
    await f.evaluate(() => { showTab('settings'); }); await wait(1500);
    await f.evaluate(() => { $('rule_day').value = '07:00'; $('rule_night').value = '19:00'; $('rule_save').click(); }); await wait(2500);
    const saved = (await api('getMyPrefs')).rules || {};
    ok('Settings → Rules of the site: "Day shift starts at" / "Night shift starts at" saved (07:00 / 19:00)', saved.dayFrom === '07:00' && saved.nightFrom === '19:00', saved);
    ok('no page error', !errs.length, errs);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 600)); }
  finally { await b.close(); await api('saveSiteRules', { backDays: was.backDays === undefined ? '' : String(was.backDays), announce: was.announce || '', dayFrom: was.dayFrom || '08:00', nightFrom: was.nightFrom || '20:00' }); }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
