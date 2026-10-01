// Local run (optional, for checking on your own computer):  node dev.js   →  http://localhost:3000
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in a file ".env.local" (never put that file in git).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
const { shell } = require('./server/page');
const rpc = require('./api/rpc');
const port = Number(process.env.PORT) || 3000;
http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/rpc') return rpc(req, res);
  if (req.url.split('?')[0] === '/api/backup') return require('./api/backup')(req, res);
  if (req.url.split('?')[0] === '/' || req.url.split('?')[0] === '/index.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(shell()); }
  res.statusCode = 404; res.end('Not found');
}).listen(port, () => console.log('RCL Fleet ERP – http://localhost:' + port));
