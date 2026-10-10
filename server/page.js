/* The page the browser gets: the SAME App.html and Index.html as in Apps Script, plus a small "bridge".
 * In Apps Script the page talks to the server with google.script.run; here the bridge gives the page the same
 * google.script.run, which sends the call to /api/rpc. Nothing else in the page changes. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const APP_DIR = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP_DIR, f), 'utf8');

const BRIDGE = `
(function () {
  var base = '';
  try { base = window.parent.location.origin; } catch (e) { base = ''; }
  if (!base || base === 'null') { try { base = window.location.origin; } catch (e) { base = ''; } }
  if (!base || base === 'null') base = '';
  // how long the server took: shown when the mouse rests on "Live" (the last check, and the slowest of the recent calls)
  var recent = [];
  function took(name, args, ms) {
    var fn = name === 'api' ? String(args[1]) : name;
    if (fn !== 'sync') { recent.push({ fn: fn, ms: ms }); if (recent.length > 25) recent.shift(); }
    else setTimeout(function () { var el = document.getElementById('live_dot'); if (!el) return;
      var worst = recent.slice().sort(function (a, b) { return b.ms - a.ms; })[0];
      el.title = String(el.title || '').split(' · server')[0] + ' · server answered in ' + ms + ' ms' + (worst ? ' · slowest recent: ' + worst.fn + ' ' + worst.ms + ' ms' : ''); }, 80);
  }
  // a question (never a save) that is already on its way is not sent a second time: both askers get the one answer
  var flying = {}, saveNo = 0;      // saveNo goes up whenever anything that is not a question is sent or answered
  function isQuestion(name, args) { if (name !== 'api') return false; var f = String(args[1]);
    return /^(get|rpt)[A-Z]/.test(f) || ['logDashboard', 'pendingLog', 'billInit', 'vendorLedger', 'vendorOutstanding', 'billSummary', 'dieselHistory', 'boqRateCheck', 'boqMissing', 'logPrintExtra'].indexOf(f) > -1; }
  // calls on their way (for the freeze note: which answer the page was waiting for, and for how long) and the last answer
  var inFlight = {}, flightNo = 0, lastAnswer = '';
  window.__rclNet = function () { var now = Date.now(), w = Object.keys(inFlight).map(function (k) { return inFlight[k].fn + ' ' + ((now - inFlight[k].t0) / 1000).toFixed(1) + ' s'; });
    return { waiting: w.slice(0, 4).join(', '), last: lastAnswer }; };
  function send(name, args, ok, fail) {
    try { if (window.__rclCrumb && !(name === 'api' && args[1] === 'sync')) window.__rclCrumb('→ ' + (name === 'api' ? args[1] : name)); } catch (e) {}
    if (isQuestion(name, args)) {
      // a question asked BEFORE a save must never answer one asked AFTER it (the list would miss what was just saved):
      // the save number is part of the key, so after any save the same question goes to the server again
      var key = saveNo + '|' + JSON.stringify(args);
      if (flying[key]) { flying[key].push({ ok: ok, fail: fail }); return; }
      flying[key] = [];
      var ok0 = ok, fail0 = fail;
      ok = function (v) { var others = flying[key] || []; delete flying[key];
        var txt = others.length ? JSON.stringify(v === undefined ? null : v) : '';        // every asker gets its own copy
        try { if (ok0) ok0(v); } finally { others.forEach(function (w) { try { if (w.ok) w.ok(JSON.parse(txt)); } catch (e) {} }); } };
      fail = function (e) { var others = flying[key] || []; delete flying[key];
        try { if (fail0) fail0(e); } finally { others.forEach(function (w) { try { if (w.fail) w.fail(e); } catch (x) {} }); } };
    }
    var isQ = isQuestion(name, args) || (name === 'api' && args[1] === 'sync') || name === 'getAppBuild' || name === 'getAppHtml';
    if (!isQ) saveNo++;
    var t0 = Date.now(), fid = ++flightNo, fnName = name === 'api' ? String(args[1]) : name;
    inFlight[fid] = { fn: fnName, t0: t0 };
    var landed = function (err) { delete inFlight[fid]; lastAnswer = fnName + ' ' + (Date.now() - t0) + ' ms' + (err ? ' (failed)' : ''); };
    /* A SAVE THAT DID NOT GET THROUGH IS SENT AGAIN BY ITSELF (asked 03-10-2026: "do not tell me it was not saved – save it").
     * Every save carries its own number (rid). When the connection drops, the server is busy or it does not answer, the
     * same save is sent again with the SAME number – after 1.2 s, then a little longer each time, at most every 10 s –
     * for as long as this page is open. The server keeps the answer of every number for an hour, so a save that had
     * arrived the first time is NOT saved twice: the second copy just gets the first answer. The person sees a small
     * line "being sent again"; the Save button stays "Saving…"; closing the page asks first.
     * Not sent again: an entry the server REFUSES (a wrong reading, a closed month …) – that needs the person, and is shown.
     * A question (a list, a report) is asked again 3 times, then it says so as before. */
    var rid = (name === 'api' && !isQ) ? ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)) : '';
    var body = JSON.stringify(rid ? { fn: name, args: args, rid: rid } : { fn: name, args: args }), tries = 0;
    var again = function (why) {
      if (/Too much data/.test(why)) return false;
      if (name !== 'api' || fnName === 'sync') return false;
      if (isQ) { if (tries >= 3) return false; setTimeout(attempt, 600 * tries); return true; }
      waiting[fid] = { fn: fnName, n: tries }; retryNote();
      setTimeout(attempt, Math.min(10000, Math.round(1200 * Math.pow(1.6, tries - 1)))); return true;
    };
    var attempt = function () {
      tries++;
      fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, cache: 'no-store' })
        .then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
          if (!j) throw new Error(r.status === 413 ? 'Too much data in one go – pick a shorter period.' : 'The server did not answer properly (' + r.status + '). Try again.');
          return j; }); })
        .then(function (j) {
          if (j.error !== undefined && j.error !== null && TRANSIENT.test(String(j.error)) && again(String(j.error))) return;       // the server could not do it NOW: again
          var was = waiting[fid]; if (was) { delete waiting[fid]; retryNote(true); }
          landed(false); if (!isQ) saveNo++; try { took(name, args, Date.now() - t0); if (window.__rclCrumb && !(name === 'api' && args[1] === 'sync')) window.__rclCrumb('← ' + (name === 'api' ? args[1] : name) + ' ' + (Date.now() - t0) + ' ms' + (tries > 1 ? ' (try ' + tries + ')' : '') + (j && j.error ? ' ERROR' : '')); } catch (e) {} if (j.error !== undefined && j.error !== null) { if (fail) fail(new Error(j.error)); } else if (ok) ok(j.result); },
              function (e) {
                if (again(String((e && e.message) || e))) return;
                landed(true); if (fail) fail(new Error(e && /did not answer|Too much data/.test(e.message) ? e.message : 'No connection to the server – check the internet and try again.')); });
    };
    attempt();
  }
  // what the server says when it could not do it NOW (busy, database slow) – worth sending again; anything else is an answer
  var TRANSIENT = /Another save is still running|Could not reach the database|did not answer in time|^Database [(][a-z_]+[)]: 5[0-9][0-9]|RETRY_LATER/;
  var waiting = {};      // saves that are being sent again: { flight number: { fn, n } }
  window.__rclSaving = function () { return Object.keys(waiting).length; };
  var RT = { en: ['No connection – your entry is kept and is being sent again by itself', 'try', 'Do not close this page.', 'Saved ✔'],
    mr: ['Connection नाही – तुमची entry जपली आहे आणि आपोआप पुन्हा पाठवली जात आहे', 'प्रयत्न', 'हे page बंद करू नका.', 'Save झाले ✔'],
    hi: ['Connection नहीं – आपकी entry सुरक्षित है और अपने-आप दोबारा भेजी जा रही है', 'प्रयास', 'यह page बंद न करें।', 'Save हो गया ✔'] };
  var rtBox = null, rtHide = null;
  function retryNote(done) {
    var ks = Object.keys(waiting), lang = 'mr'; try { lang = localStorage.getItem('rcl_lang') || 'mr'; } catch (e) {}
    var T = RT[lang] || RT.mr;
    if (!rtBox) { if (!document.body) return; rtBox = document.createElement('div'); rtBox.id = 'rcl_retry'; rtBox.setAttribute('role', 'status');
      rtBox.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99998;max-width:min(680px,92vw);padding:10px 16px;border-radius:12px;font:600 13.5px/1.4 system-ui,Arial,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.28);text-align:center';
      document.body.appendChild(rtBox); }
    clearTimeout(rtHide);
    if (ks.length) { var n = 0; ks.forEach(function (k) { if (waiting[k].n > n) n = waiting[k].n; });
      rtBox.hidden = false; rtBox.style.background = '#FFF4D6'; rtBox.style.color = '#6B4500'; rtBox.style.border = '1px solid #F0C36D';
      rtBox.textContent = T[0] + (ks.length > 1 ? ' (' + ks.length + ')' : '') + ' · ' + T[1] + ' ' + n + ' · ' + T[2]; }
    else if (done) { rtBox.hidden = false; rtBox.style.background = '#E8F7EF'; rtBox.style.color = '#0B6B3A'; rtBox.style.border = '1px solid #A7DFC0'; rtBox.textContent = T[3]; rtHide = setTimeout(function () { rtBox.hidden = true; }, 2600); }
    else rtBox.hidden = true;
  }
  // closing the page while an entry is still being sent: the browser asks first
  window.addEventListener('beforeunload', function (e) { if (Object.keys(waiting).length) { e.preventDefault(); e.returnValue = ''; return ''; } });

  /* A thin bar at the top of the app while it waits for the server longer than half a second, and the seconds once it is
   * more than 2.5 s. A slow answer (a server that had gone to sleep, a weak connection) must never look like a frozen app:
   * the page itself stays usable, and the person sees that it is waiting and for how long. The 2-second check is not shown. */
  if (window.parent !== window) (function waitBar() {
    var bar = null;
    setInterval(function () {
      var now = Date.now(), oldest = 0, what = '';
      for (var k in inFlight) { var x = inFlight[k]; if (x.fn === 'sync' || x.fn === 'getAppBuild') continue; if (now - x.t0 > oldest) { oldest = now - x.t0; what = x.fn; } }
      if (oldest > 500) {
        if (!bar) { if (!document.body) return; bar = document.createElement('div'); bar.id = 'rcl_wait'; bar.innerHTML = '<i></i><span></span>'; document.body.appendChild(bar); }
        bar.hidden = false; var s = bar.lastChild, txt = oldest > 2500 ? 'Waiting for the server… ' + Math.round(oldest / 1000) + ' s' + (oldest > 6000 ? ' (' + what + ')' : '') : '';      // after 6 s it names what it waits for – that is what to tell the developer
        if (s.textContent !== txt) s.textContent = txt; s.hidden = !txt;
      } else if (bar && !bar.hidden) bar.hidden = true;
    }, 250);
  })();
  function runner(ok, fail) {
    return new Proxy({}, { get: function (t, name) {
      if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
      if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
      if (name === 'withUserObject') return function () { return runner(ok, fail); };
      return function () { send(String(name), Array.prototype.slice.call(arguments), ok, fail); };
    } });
  }
  window.google = { script: { run: runner(null, null), host: { close: function () {} } } };
  /* A small recorder for "the page stopped answering" (asked for after a freeze nobody could explain).
   * Only inside the app's own page, only in this browser: it keeps the last things that happened (which question went to
   * the server, how long the answer took, clicks, and every time the page could not answer for more than a second),
   * and a heartbeat once a second. If the page ends without saying goodbye – it froze and was closed or reloaded –
   * the next start shows a short note with those lines, so they can be sent on. Nothing is sent anywhere by itself. */
  if (window.parent !== window) (function recorder() {
    var KEY = 'rcl_trace', crumbs = [], t = function () { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); };
    var add = function (what, long) { crumbs.push(t() + ' ' + String(what).slice(0, long ? 400 : 90)); if (crumbs.length > 30) crumbs.shift(); };
    /* what the page was doing when it stopped answering: page on screen, the person's last action, the answer it was
     * waiting for (and how long), the last answer, the longest recent blocking task and the memory in use (Chrome) */
    var lastAct = '', lastLong = '';
    var context = function () { var out = [], pt = document.getElementById('page_title');
      out.push('page: ' + (pt ? String(pt.textContent || '').trim() : '?'));
      if (lastAct) out.push('last action: ' + lastAct);
      try { var n = window.__rclNet ? window.__rclNet() : null; if (n && n.waiting) out.push('waiting for: ' + n.waiting); if (n && n.last) out.push('last answer: ' + n.last); } catch (e) {}
      if (lastLong) out.push('blocking task: ' + lastLong);
      try { var m = performance.memory; if (m) out.push('memory: ' + Math.round(m.usedJSHeapSize / 1048576) + ' of ' + Math.round(m.jsHeapSizeLimit / 1048576) + ' MB'); } catch (e) {}
      try { out.push('page size: ' + document.getElementsByTagName('*').length + ' elements'); } catch (e) {}
      return out.join(' · '); };
    window.rclDiag = function () { return crumbs.concat([t() + ' now: ' + context()]).join(String.fromCharCode(10)); };
    var prev = null; try { prev = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { prev = null; }
    /* WRITTEN ONLY WHEN THERE IS SOMETHING NEW (07-10-2026). The note used to be written to the browser's storage EVERY SECOND,
     * for as long as the page was open (also in the background) – a blocking write of up to 12 KB, 86,000 times a day per open
     * page. Now: only when a line was added since the last write (looked at once a second), and when the page goes to the
     * background or is closed. The once-a-second look that notices "the page did not answer" stays.
     * "clean" (= no note next time) is now also set when the page goes to the background: a phone that ends a background app
     * no longer shows "stopped without closing properly" at the next start. Each open page has its own mark (me), and a note
     * left by ANOTHER page that is still open and answering is not shown (see showLast). */
    var me = Math.random().toString(36).slice(2, 10), dirty = false, add0 = add;
    add = function (what, long) { add0(what, long); dirty = true; }; window.__rclCrumb = add;
    var save = function (clean) { dirty = false; try { localStorage.setItem(KEY, JSON.stringify({ beat: Date.now(), clean: !!clean, tab: me, crumbs: crumbs })); } catch (e) {} };
    var last = Date.now();
    var wasHidden = document.hidden;
    document.addEventListener('visibilitychange', function () { if (document.hidden) { wasHidden = true; save(true); } else save(false); });
    setInterval(function () { var now = Date.now(), gap = now - last; last = now;
      // more than about 2 seconds without a heartbeat while the page was on screen = the page did not answer
      if (gap > 300000) add('page paused for ' + Math.round(gap / 60000) + ' min (computer asleep?)');
      else if (gap > 2100 && !document.hidden && !wasHidden) add('PAGE DID NOT ANSWER for ' + (gap / 1000).toFixed(1) + ' s – ' + context(), true);
      wasHidden = document.hidden; if (dirty) save(document.hidden); }, 1000);
    // other open pages of the app answer "I am still here" (so their note is not shown as a crash by a page that starts)
    var chan = null; try { chan = new BroadcastChannel('rcl_trace'); chan.onmessage = function (e) { var d = e && e.data; if (d && d.ask === me) { try { chan.postMessage({ alive: me }); } catch (x) {} } }; } catch (e) { chan = null; }
    try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (e.duration >= 200) lastLong = Math.round(e.duration) + ' ms at ' + t(); if (e.duration >= 1000) add('long task ' + Math.round(e.duration) + ' ms'); }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    // Chrome 123+: a slow screen frame says WHICH code held it (function name and what started it)
    try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (e.duration < 1000) return;
      var sc = (e.scripts || []).slice().sort(function (a, b) { return b.duration - a.duration; }).slice(0, 2).map(function (x) { return (x.sourceFunctionName || x.invoker || '?') + ' (' + (x.invokerType || '') + ') ' + Math.round(x.duration) + ' ms'; }).join('; ');
      lastLong = Math.round(e.duration) + ' ms at ' + t() + (sc ? ' – ' + sc : '');
      add('slow frame ' + Math.round(e.duration) + ' ms' + (sc ? ': ' + sc : '') + (e.blockingDuration ? ' (blocked ' + Math.round(e.blockingDuration) + ' ms)' : ''), true); }); })
      .observe({ type: 'long-animation-frame', buffered: false }); } catch (e) {}
    document.addEventListener('click', function (e) { var b = e.target && e.target.closest ? e.target.closest('button, a, [role=tab], .navbtn') : null; if (b) { lastAct = 'click ' + (b.id || '') + ' "' + String(b.textContent || '').trim().slice(0, 30) + '" at ' + t(); add('click: ' + (b.id || '') + ' "' + String(b.textContent || '').trim().slice(0, 30) + '"'); } }, true);
    document.addEventListener('change', function (e) { var x = e.target; if (x && (x.id || (x.dataset && x.dataset.f))) lastAct = 'changed ' + (x.id || x.dataset.f) + ' at ' + t(); }, true);
    window.addEventListener('pagehide', function () { save(true); });
    window.addEventListener('error', function (e) { add('script error: ' + String(e.message).slice(0, 70)); });
    // the last run ended without a goodbye and its heartbeat had stopped: show what it was doing
    var showLast = function () {
      if (!prev || prev.clean || !prev.crumbs || !prev.crumbs.length) return;
      var when = new Date(prev.beat), box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;max-width:760px;margin:auto;background:#fff;border:2px solid #B45309;border-radius:12px;padding:12px 14px;box-shadow:0 12px 30px rgba(0,0,0,.25);font:13px/1.45 system-ui,Arial,sans-serif;color:#1F2937';
      var esc = function (x) { return String(x).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
      box.innerHTML = '<b>Last time this page stopped at ' + esc(when.toLocaleTimeString()) + ' without closing properly.</b> If it had frozen, please send a photo of this box:' +
        '<pre style="margin:8px 0;max-height:190px;overflow:auto;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:8px;font:12px/1.4 Consolas,monospace;white-space:pre-wrap">' + esc(prev.crumbs.join(String.fromCharCode(10))) + '</pre>' +
        '<button type="button" style="padding:6px 14px;border:1px solid #334155;border-radius:8px;background:#fff;cursor:pointer;font:600 13px system-ui">Close</button>';
      box.querySelector('button').onclick = function () { box.remove(); };
      (document.body || document.documentElement).appendChild(box);
    };
    // a note of a page that is still open and answering is nobody's crash: it is asked first (half a second), then shown
    var showIfGone = function () {
      if (!prev || prev.clean || !prev.crumbs || !prev.crumbs.length) return;
      if (!chan || !prev.tab) { showLast(); return; }
      var alive = false, on = function (e) { if (e && e.data && e.data.alive === prev.tab) alive = true; };
      try { chan.addEventListener('message', on); chan.postMessage({ ask: prev.tab }); } catch (e) { showLast(); return; }
      setTimeout(function () { try { chan.removeEventListener('message', on); } catch (e) {} if (!alive) showLast(); }, 500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showIfGone); else showIfGone();
    save(false);
  })();

  // the Google Sheet backup: while the app is open it asks the server now and then to copy what changed
  // (the server does nothing when nothing changed or when a backup ran a moment ago)
  if (window.parent !== window) {
    var tick = function () { try { var tk = ''; try { tk = sessionStorage.getItem('rcl_token') || localStorage.getItem('rcl_token') || ''; } catch (e) { tk = ''; }
      if (!tk) return;      // nobody signed in: nothing to ask
      fetch(base + '/api/backup', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk }) }).catch(function () {}); } catch (e) {} };
    setTimeout(tick, 40000); setInterval(tick, 300000);
  }
})();`;

let memo = null;
function page() {
  if (memo) return memo;
  // the app with the bridge in front of its version line (the version is a fingerprint of this text, as in Apps Script)
  const app = read('App.html').replace('<script>/*APP_BUILD*/</script>', () => '<script>' + BRIDGE + '</script><script>/*APP_BUILD*/</script>');
  const build = crypto.createHash('md5').update(app, 'utf8').digest('hex').slice(0, 12);
  const put = "window.APP_BUILD = '" + build + "'; window.APP_URL = (function () { try { return window.parent.location.origin + '/'; } catch (e) { return ''; } })();";
  const html = app.replace('/*APP_BUILD*/', () => put);
  memo = { build: build, html: html, bridged: app };
  return memo;
}
// the shell page (Index.html) with the app put in, as doGet did
function shell() {
  const a = page();
  const json = JSON.stringify({ build: a.build, html: a.html }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  // (manifest, colours and icons: what a phone needs to install the page as an app – see build.js)
  const head = '<title>Fleet ERP – One Click Solution</title>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<link rel="icon" href="https://i.ibb.co/CpSfBqXX/RCL-LOGO-PDF.png">\n' +
    '<link rel="manifest" href="/manifest.webmanifest">\n<meta name="theme-color" content="#0F1F3D">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Fleet ERP">\n<link rel="apple-touch-icon" href="/icons/apple-180.png">\n';
  let s = read('Index.html');
  if (s.indexOf('/*APP_JSON*/null') === -1 || s.indexOf('<script>') === -1) throw new Error('Index.html is not the shell page this build expects.');
  s = s.replace('<meta charset="utf-8">', () => '<meta charset="utf-8">\n' + head);
  s = s.replace('<script>', () => '<script>' + BRIDGE + '</script>\n<script>');
  s = s.replace('/*APP_JSON*/null', () => json);
  return s;
}
module.exports = { page, shell, read, APP_DIR };
