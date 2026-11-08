// update-155: the shell no longer asks "is there a new version?" every minute while the app's heartbeat answers (every heartbeat
//   carries the version); after a deploy the bar "a new version is ready" still comes by itself within seconds, and the shell is
//   asked once – not with every 2-second heartbeat while the new version waits.
// On the local rig only (it rebuilds the rig's copy of the app in APP_DIR and restarts the rig's two app servers – never live).
//   node upd155.js
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium'); const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), { execSync, spawn } = require('child_process');
const wait = ms => new Promise(r => setTimeout(r, ms));
const DIR = process.env.APP_DIR || '/home/claude/vercel', APP = path.join(DIR, 'app', 'App.html'), MARK = '\n<!-- upd155 test build -->\n';
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
// the rig's app servers (node dev.js in DIR): stopped and started again with the same settings
function restart() {
  const procs = fs.readdirSync('/proc').filter(x => /^\d+$/.test(x)).map(p => { try { const c = fs.readFileSync('/proc/' + p + '/cmdline', 'utf8'); if (!/dev\.js/.test(c) || fs.readlinkSync('/proc/' + p + '/cwd') !== DIR) return null;
    const env = {}; fs.readFileSync('/proc/' + p + '/environ', 'utf8').split('\0').filter(Boolean).forEach(kv => { const i = kv.indexOf('='); env[kv.slice(0, i)] = kv.slice(i + 1); }); return { pid: Number(p), env }; } catch (e) { return null; } }).filter(Boolean);
  procs.forEach(x => { try { process.kill(x.pid); } catch (e) {} });
  execSync('sleep 1');
  procs.forEach(x => { const c = spawn('node', ['dev.js'], { cwd: DIR, env: x.env, detached: true, stdio: 'ignore' }); c.unref(); });
  return procs.length;
}
const up = async () => { for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(2000) }); if (r.status === 200) return true; } catch (e) {} await wait(300); } return false; };
(async () => {
  const original = fs.readFileSync(APP, 'utf8');
  const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell', protocolTimeout: 120000 });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1536, height: 900 }); const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
    const asked = []; p.on('request', q => { if (/\/api\/rpc/.test(q.url())) { try { const j = JSON.parse(q.postData() || '{}'); asked.push({ fn: j.fn === 'api' ? j.args[1] : j.fn, t: Date.now() }); } catch (e) {} } });
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'load' }); await wait(1200);
    const f = p.frames().find(x => x !== p.mainFrame());
    await f.evaluate(() => { try { localStorage.setItem('oc_brief_sujit@rcl.test', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); localStorage.setItem('rcl_lang', 'en'); sessionStorage.setItem('oc_intro', '1'); } catch (e) {} });
    await f.type('#lg_email', 'sujit@rcl.test'); await f.type('#lg_pass', 'Nashik#Road848!'); await f.click('#lg_btn'); await wait(6000);
    await f.evaluate(() => { try { closeConfirm(false); } catch (e) {} });
    const v0 = await p.evaluate(() => window.rclApp.build());
    // 1. 70 seconds of work: the heartbeat runs; the shell's own version question
    let t0 = Date.now(); for (let k = 0; k < 14; k++) { await p.mouse.move(300 + k * 7, 400); await wait(5000); }
    const builds = asked.filter(x => x.t >= t0 && x.fn === 'getAppBuild').length, syncs = asked.filter(x => x.t >= t0 && x.fn === 'sync').length;
    ok('70 s of work: the heartbeat asks (it carries the version) and the shell does not ask for the version by itself', syncs >= 25 && builds === 0, { sync: syncs, getAppBuild: builds });
    // 2. a new version is deployed (the rig's copy of the app with one more line, built, servers restarted)
    fs.writeFileSync(APP, original + MARK); execSync('cd ' + DIR + ' && timeout 120 node build.js > /dev/null'); const n = restart(); await up();
    t0 = Date.now(); let shown = 0;
    for (let i = 0; i < 60 && !shown; i++) { await p.mouse.move(400, 300 + i); await wait(500); if (await p.evaluate(() => !document.getElementById('upd').hidden)) shown = Date.now() - t0; }
    const live = await p.evaluate(() => window.rclApp.newer());
    ok('a new version deployed (' + n + ' servers restarted): the bar "a new version is ready" comes by itself, within seconds', shown > 0 && shown < 15000 && live, { ms: shown || 'not in 30 s', newer: live });
    const t1 = Date.now(); for (let k = 0; k < 6; k++) { await p.mouse.move(500 + k, 300); await wait(5000); }
    const again = asked.filter(x => x.t >= t1 && x.fn === 'getAppBuild').length, beats = asked.filter(x => x.t >= t1 && x.fn === 'sync').length;
    ok('   while it waits (30 s, ' + beats + ' heartbeats): the shell is asked at most once a minute – not with every heartbeat', again <= 1 && beats >= 10, { getAppBuild: again, sync: beats });
    ok('   the version the page runs is still the one it opened with (nothing swapped behind the person\'s back)', await p.evaluate(() => window.rclApp.build()) === v0);
    ok('no script error', !errs.length, errs);
  } catch (e) { ok('no crash', false, String(e && e.stack || e)); }
  finally {
    try { await b.close(); } catch (e) {}
    try { fs.writeFileSync(APP, original); execSync('cd ' + DIR + ' && timeout 120 node build.js > /dev/null'); restart(); await up(); } catch (e) { out.push('restore: ' + String(e.message).slice(0, 200)); }
  }
  console.log(out.join('\n') + '\n\n' + pass + ' passed, ' + fail + ' failed');
})();
