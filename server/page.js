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
  var flying = {};
  function isQuestion(name, args) { if (name !== 'api') return false; var f = String(args[1]);
    return /^(get|rpt)[A-Z]/.test(f) || ['logDashboard', 'pendingLog', 'billInit', 'vendorLedger', 'vendorOutstanding', 'billSummary', 'dieselHistory', 'boqRateCheck', 'boqMissing', 'logPrintExtra'].indexOf(f) > -1; }
  function send(name, args, ok, fail) {
    if (isQuestion(name, args)) {
      var key = JSON.stringify(args);
      if (flying[key]) { flying[key].push({ ok: ok, fail: fail }); return; }
      flying[key] = [];
      var ok0 = ok, fail0 = fail;
      ok = function (v) { var others = flying[key] || []; delete flying[key];
        var txt = others.length ? JSON.stringify(v === undefined ? null : v) : '';        // every asker gets its own copy
        try { if (ok0) ok0(v); } finally { others.forEach(function (w) { try { if (w.ok) w.ok(JSON.parse(txt)); } catch (e) {} }); } };
      fail = function (e) { var others = flying[key] || []; delete flying[key];
        try { if (fail0) fail0(e); } finally { others.forEach(function (w) { try { if (w.fail) w.fail(e); } catch (x) {} }); } };
    }
    var t0 = Date.now();
    fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: name, args: args }), cache: 'no-store' })
      .then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
        if (!j) throw new Error(r.status === 413 ? 'Too much data in one go – pick a shorter period.' : 'The server did not answer properly (' + r.status + '). Try again.');
        return j; }); })
      .then(function (j) { try { took(name, args, Date.now() - t0); } catch (e) {} if (j.error !== undefined && j.error !== null) { if (fail) fail(new Error(j.error)); } else if (ok) ok(j.result); },
            function (e) { if (fail) fail(new Error(e && /did not answer|Too much data/.test(e.message) ? e.message : 'No connection to the server – check the internet and try again.')); });
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
