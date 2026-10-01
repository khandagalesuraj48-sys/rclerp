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
    fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: name, args: args }), cache: 'no-store' })
      .then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
        if (!j) throw new Error(r.status === 413 ? 'Too much data in one go – pick a shorter period.' : 'The server did not answer properly (' + r.status + '). Try again.');
        return j; }); })
      .then(function (j) { landed(false); if (!isQ) saveNo++; try { took(name, args, Date.now() - t0); if (window.__rclCrumb && !(name === 'api' && args[1] === 'sync')) window.__rclCrumb('← ' + (name === 'api' ? args[1] : name) + ' ' + (Date.now() - t0) + ' ms' + (j && j.error ? ' ERROR' : '')); } catch (e) {} if (j.error !== undefined && j.error !== null) { if (fail) fail(new Error(j.error)); } else if (ok) ok(j.result); },
            function (e) { landed(true); if (fail) fail(new Error(e && /did not answer|Too much data/.test(e.message) ? e.message : 'No connection to the server – check the internet and try again.')); });
  }
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
    window.__rclCrumb = add;
    var prev = null; try { prev = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { prev = null; }
    var save = function (clean) { try { localStorage.setItem(KEY, JSON.stringify({ beat: Date.now(), clean: !!clean, crumbs: crumbs })); } catch (e) {} };
    var last = Date.now();
    var wasHidden = document.hidden;
    document.addEventListener('visibilitychange', function () { if (document.hidden) wasHidden = true; });
    setInterval(function () { var now = Date.now(), gap = now - last; last = now;
      // more than about 2 seconds without a heartbeat while the page was on screen = the page did not answer
      if (gap > 300000) add('page paused for ' + Math.round(gap / 60000) + ' min (computer asleep?)');
      else if (gap > 2100 && !document.hidden && !wasHidden) add('PAGE DID NOT ANSWER for ' + (gap / 1000).toFixed(1) + ' s – ' + context(), true);
      wasHidden = document.hidden; save(false); }, 1000);
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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showLast); else showLast();
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
  const head = '<title>Rachana Construction Limited – Fleet ERP</title>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<link rel="icon" href="https://i.ibb.co/CpSfBqXX/RCL-LOGO-PDF.png">\n';
  let s = read('Index.html');
  if (s.indexOf('/*APP_JSON*/null') === -1 || s.indexOf('<script>') === -1) throw new Error('Index.html is not the shell page this build expects.');
  s = s.replace('<meta charset="utf-8">', () => '<meta charset="utf-8">\n' + head);
  s = s.replace('<script>', () => '<script>' + BRIDGE + '</script>\n<script>');
  s = s.replace('/*APP_JSON*/null', () => json);
  return s;
}
module.exports = { page, shell, read, APP_DIR };
