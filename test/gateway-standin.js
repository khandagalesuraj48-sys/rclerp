// a stand-in for Supabase's gateway in front of PostgREST (tests only; used by test/harden.js):
//   /rest/v1/* → PostgREST, the app's secret key becomes the service role – as the real gateway does.
// FAULTS FOR TESTS: POST /__fault { match, code, n, skip, after, text, delay, drop } makes the next n requests whose "METHOD path" matches
//   the regular expression answer `code` instead (skip = let that many matching requests pass first; after = true: the request IS
//   carried out by the database and only its answer is replaced – "it arrived, the answer was lost").
//   POST /__fault {} (no match) clears every fault.   GET /__fault → what is set and how often each fired.
// Settings (environment – nothing secret is written in this file):
//   GATEWAY_PORT (3100)   POSTGREST (127.0.0.1:3101)   GATEWAY_KEY = the key the app sends (its SUPABASE_SECRET_KEY)
//   GATEWAY_JWT_SECRET = the jwt-secret PostgREST was started with
const http = require('http'), crypto = require('crypto');
const SECRET = String(process.env.GATEWAY_JWT_SECRET || ''), KEY = String(process.env.GATEWAY_KEY || '');
if (!SECRET || !KEY) { console.error('Set GATEWAY_JWT_SECRET and GATEWAY_KEY.'); process.exit(1); }
const [PG_HOST, PG_PORT] = String(process.env.POSTGREST || '127.0.0.1:3101').split(':');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const head = b64({ alg: 'HS256', typ: 'JWT' }), body = b64({ role: 'service_role', exp: 4102444800 });
const JWT = head + '.' + body + '.' + crypto.createHmac('sha256', SECRET).update(head + '.' + body).digest('base64url');
let faults = [];
http.createServer((req, res) => {
  if (req.url === '/__fault') {
    if (req.method === 'GET') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(faults.map(f => ({ match: f.match, code: f.code, left: f.n, skip: f.skip, fired: f.fired })))); }
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => { let j = {}; try { j = JSON.parse(b || '{}'); } catch (e) { j = {}; }
      if (!j.match) faults = []; else faults.push({ match: String(j.match), re: new RegExp(j.match), code: Number(j.code) || 503, n: Number(j.n) || 1, skip: Number(j.skip) || 0, after: !!j.after, delay: Number(j.delay) || 0, drop: !!j.drop, text: j.text === undefined ? '{"message":"test fault"}' : String(j.text), fired: 0 });
      res.end('{"ok":true}'); });
    return;
  }
  if (req.url.indexOf('/rest/v1') !== 0) { res.statusCode = 404; return res.end('{}'); }
  if (req.headers.apikey !== KEY) { res.statusCode = 401; return res.end('{"message":"Invalid API key"}'); }
  const what = req.method + ' ' + req.url;
  let hit = null;
  for (const f of faults) { if (f.n > 0 && f.re.test(what)) { if (f.skip > 0) { f.skip--; continue; } f.n--; f.fired++; hit = f; break; } }
  // (delay = the answer is held back that many ms; drop = no answer at all: the connection is cut)
  const fail = () => setTimeout(() => { if (hit.drop) { try { req.socket.destroy(); } catch (e) {} return; } res.statusCode = hit.code; res.setHeader('Content-Type', 'application/json'); res.end(hit.text); }, hit.delay || 0);
  if (hit && !hit.after) { req.resume(); req.on('end', fail); return; }
  const h = Object.assign({}, req.headers, { authorization: 'Bearer ' + JWT, host: PG_HOST + ':' + PG_PORT }); delete h.apikey;
  const up = http.request({ host: PG_HOST, port: Number(PG_PORT), method: req.method, path: req.url.slice('/rest/v1'.length) || '/', headers: h }, r => {
    if (hit) { r.resume(); r.on('end', fail); return; }
    res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', e => { res.statusCode = 502; res.end(JSON.stringify({ message: String(e.message) })); });
  req.pipe(up);
}).listen(Number(process.env.GATEWAY_PORT) || 3100, '127.0.0.1');
