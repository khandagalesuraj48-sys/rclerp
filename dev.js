// Local run (optional, for checking on your own computer):  node dev.js   →  http://localhost:3000
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in a file ".env.local" (never put that file in git).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
const { shell } = require('./server/page');
const rpc = require('./api/rpc');
const port = Number(process.env.PORT) || 3000;
// the same security headers as the live site (vercel.json, the rule for every address). Without them a header that forbids
// something on the live site – the microphone, 04-10-2026 – cannot be seen here.
const siteHeaders = (() => { try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8')); return ((j.headers || []).find(h => h.source === '/(.*)') || { headers: [] }).headers; } catch (e) { return []; } })();
http.createServer((req, res) => {
  siteHeaders.forEach(h => res.setHeader(h.key, h.value));
  if (req.url.split('?')[0] === '/api/rpc') return rpc(req, res);
  if (req.url.split('?')[0] === '/api/ai') return require('./api/ai')(req, res);      // (update-186) the assistant's answer word by word
  if (req.url.split('?')[0] === '/api/backup') return require('./api/backup')(req, res);
  if (req.url.split('?')[0] === '/api/drive') return require('./api/drive')(req, res);      // (update-158) Google's answer after "Allow"
  if (req.url.split('?')[0] === '/menu.json') { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache'); return res.end(JSON.stringify(require('./server/page').menu())); }
  if (req.url.split('?')[0] === '/.well-known/assetlinks.json') { res.setHeader('Content-Type', 'application/json'); return res.end(require('fs').readFileSync(require('path').join(__dirname, 'app', 'well-known', 'assetlinks.json'))); }      // (update-160)
  if (req.url.split('?')[0] === '/' || req.url.split('?')[0] === '/index.html' || req.url.split('?')[0] === '/scan') {      /* (update-160) /scan: a Scan with Mobile QR opened in a browser */ res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(shell()); }
  // the app's own static files (made by build.js – on Vercel they are served from public/)
  const st = /^\/(sw\.js|manifest\.webmanifest|icons\/[a-z0-9-]+\.(?:png|webp)|vendor\/[a-z0-9.-]+\.js|i18n\/(?:mr|hi)\.json)$/.exec(req.url.split('?')[0]);
  if (st) { const fp = path.join(__dirname, 'public', st[1]); if (fs.existsSync(fp)) { res.setHeader('Content-Type', /\.js$/.test(fp) ? 'text/javascript; charset=utf-8' : /\.png$/.test(fp) ? 'image/png' : /\.webp$/.test(fp) ? 'image/webp' : /\.json$/.test(fp) ? 'application/json; charset=utf-8' : 'application/manifest+json'); res.setHeader('Cache-Control', 'no-cache'); return res.end(fs.readFileSync(fp)); } }
  res.statusCode = 404; res.end('Not found');
}).listen(port, () => console.log('RCL Fleet ERP – http://localhost:' + port));
