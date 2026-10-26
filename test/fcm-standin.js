/* (update-161) TEST RIG ONLY – a stand-in for Google's two addresses the phone notifications use (server/fcm.js):
 *   POST /token                              the permission: the signed request (RS256) is checked with FCM_STANDIN_PUB
 *   POST /v1/projects/<p>/messages:send      one message to one phone; a token beginning "gone" is "not there any more" (404)
 *   GET  /sent                               what was sent (for the tests);  GET /reset  forgets it
 * node test/fcm-standin.js [port] – prints "fcm stand-in <port>" when it listens. Never used on the live site. */
'use strict';
const http = require('http'), crypto = require('crypto');
const PUB = String(process.env.FCM_STANDIN_PUB || '');
let sent = [], tokens = 0;
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && url === '/sent') return json(res, 200, { sent: sent, tokens: tokens });
    if (req.method === 'GET' && url === '/reset') { sent = []; tokens = 0; return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && url === '/token') {
      const a = new URLSearchParams(body).get('assertion') || '', p = a.split('.');
      let ok = p.length === 3, claim = {};
      try { claim = JSON.parse(Buffer.from(p[1], 'base64url').toString()); } catch (e) { ok = false; }
      if (ok && PUB) ok = crypto.createVerify('RSA-SHA256').update(p[0] + '.' + p[1]).verify(PUB, Buffer.from(p[2], 'base64url'));
      if (!ok || claim.scope !== 'https://www.googleapis.com/auth/firebase.messaging' || claim.aud !== 'https://oauth2.googleapis.com/token') return json(res, 400, { error: 'invalid_grant', error_description: 'bad assertion' });
      tokens++;
      return json(res, 200, { access_token: 'at-' + tokens, expires_in: 3600, token_type: 'Bearer' });
    }
    const m = /^\/v1\/projects\/([^/]+)\/messages:send$/.exec(url);
    if (req.method === 'POST' && m) {
      if (!/^Bearer at-\d+$/.test(String(req.headers.authorization || ''))) return json(res, 401, { error: { code: 401, status: 'UNAUTHENTICATED' } });
      let j = null; try { j = JSON.parse(body); } catch (e) { j = null; }
      const msg = j && j.message;
      if (!msg || !msg.token) return json(res, 400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'no message' } });
      if (/^gone/.test(msg.token)) return json(res, 404, { error: { code: 404, status: 'NOT_FOUND', message: 'Requested entity was not found.', details: [{ errorCode: 'UNREGISTERED' }] } });
      sent.push({ project: decodeURIComponent(m[1]), auth: req.headers.authorization, message: msg });
      return json(res, 200, { name: 'projects/' + m[1] + '/messages/' + sent.length });
    }
    json(res, 404, { error: 'not here' });
  });
}).listen(Number(process.argv[2]) || 0, '127.0.0.1', function () { console.log('fcm stand-in ' + this.address().port); });
