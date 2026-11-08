// a stand-in for Google's sign-in (OAuth) and Drive API (tests only, update-158): it answers the few calls the copy of the files
// makes – the token (a one-time code → a refresh token; a refresh token → an access token), about (the account, how full),
// files.create (a folder, a shortcut), files.get (is the folder there), the upload (multipart and resumable). It keeps every file
// in memory with its MD5, and counts every call that would DELETE or SHARE something (the app must never make one).
//   GET /dump              → { calls, deletes, shares, files: [{ id, name, mimeType, parents, size, md5, target, rcl }] }
//   GET /reset             → start again                 GET /full?bytes=N  → the account holds N bytes at most (0 = no limit given)
//   GET /corrupt?n=K       → the next K uploads are kept with a wrong MD5 (as if a byte was lost on the way)
//   GET /revoke            → the refresh tokens given so far stop working (Google answers invalid_grant)
//   GET /fail?n=K&code=C   → the next K Drive calls answer C
//   GET /gone?id=X         → X deleted by hand, with everything in it   GET /trash?id=X → X put in the bin by hand
// A create or an upload into a folder that is not there answers 404 (as Google); the last piece of a resumable upload answers
// without the MD5 (the copy asks for it).
// Listens on 127.0.0.1:3996 (GOOGLE_OAUTH_TOKEN_URL=http://127.0.0.1:3996/token, GOOGLE_DRIVE_URL=http://127.0.0.1:3996,
// GOOGLE_OAUTH_AUTH_URL=http://127.0.0.1:3996/auth). The client is rig-client / rig-client-secret; the good code is "good-code".
'use strict';
const http = require('http'), crypto = require('crypto');
const PORT = Number(process.env.DRIVE_STANDIN_PORT || 3996);
let files, calls, deletes, shares, nextId, limit, corrupt, fail, rts, ats, sessions, revoked;
const reset = () => { files = []; calls = 0; deletes = 0; shares = 0; nextId = 1; limit = 15 * 1073741824; corrupt = 0; fail = { n: 0, code: 500 }; rts = new Set(); ats = new Set(); sessions = {}; revoked = new Set(); };
reset();
const send = (res, code, obj, h) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, h || {})); res.end(JSON.stringify(obj)); };
const used = () => files.reduce((t, f) => t + (f.size || 0), 0);
const gErr = (res, code, reason, msg) => send(res, code, { error: { code: code, message: msg || reason, errors: [{ reason: reason, message: msg || reason }] } });
function keep(meta, buf, upload) {
  if (limit && used() + buf.length > limit) return null;
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const f = { id: 'F' + (nextId++), name: String(meta.name || ''), mimeType: meta.mimeType || 'application/octet-stream', parents: meta.parents || [], size: buf.length,
    md5: upload && corrupt > 0 ? (corrupt--, '0'.repeat(32)) : md5, rcl: (meta.appProperties || {}).rcl || '', bytes: buf };      // (only an upload is ever "not received whole")
  files.push(f); return f;
}
http.createServer((req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const body = Buffer.concat(chunks), u = new URL(req.url, 'http://x'), p = u.pathname;
    if (p === '/dump') return send(res, 200, { calls: calls, deletes: deletes, shares: shares, used: used(), limit: limit, files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, size: f.size, md5: f.md5, target: f.target || '', rcl: f.rcl })) });
    if (p === '/reset') { reset(); return send(res, 200, { ok: true }); }
    if (p === '/full') { limit = Number(u.searchParams.get('bytes')) || 0; return send(res, 200, { limit: limit }); }
    if (p === '/corrupt') { corrupt = Number(u.searchParams.get('n')) || 0; return send(res, 200, { corrupt: corrupt }); }
    if (p === '/revoke') { rts.forEach(t => revoked.add(t)); ats.clear(); return send(res, 200, { ok: true }); }      // (the access tokens given stop too)
    if (p === '/trash') { const f = files.find(x => x.id === u.searchParams.get('id')); if (f) f.trashed = true; return send(res, 200, { ok: !!f }); }      // GET /trash?id= → put in the bin by hand
    if (p === '/gone') { const id = u.searchParams.get('id'), out = new Set([id]); let more = true; while (more) { more = false; files.forEach(f => { if (!out.has(f.id) && f.parents.some(x => out.has(x))) { out.add(f.id); more = true; } }); }
      files = files.filter(f => !out.has(f.id)); return send(res, 200, { gone: out.size }); }      // GET /gone?id= → deleted by hand, with all in it
    if (p === '/fail') { fail = { n: Number(u.searchParams.get('n')) || 0, code: Number(u.searchParams.get('code')) || 500 }; return send(res, 200, fail); }
    if (p === '/auth') return send(res, 200, { page: 'Google would ask "Allow" here', state: u.searchParams.get('state'), redirect: u.searchParams.get('redirect_uri') });
    if (p === '/token' && req.method === 'POST') {
      const f = new URLSearchParams(body.toString('utf8'));
      if (f.get('client_id') !== 'rig-client' || f.get('client_secret') !== 'rig-client-secret') return send(res, 401, { error: 'invalid_client' });
      if (f.get('grant_type') === 'authorization_code') {
        if (f.get('code') !== 'good-code') return send(res, 400, { error: 'invalid_grant', error_description: 'Bad Request' });
        const rt = 'rig-refresh-' + crypto.randomBytes(8).toString('hex'), at = 'rig-access-' + crypto.randomBytes(8).toString('hex'); rts.add(rt); ats.add(at);
        return send(res, 200, { access_token: at, refresh_token: rt, expires_in: 3599, scope: 'https://www.googleapis.com/auth/drive.file', token_type: 'Bearer' });
      }
      if (f.get('grant_type') === 'refresh_token') {
        const rt = f.get('refresh_token'); if (!rts.has(rt) || revoked.has(rt)) return send(res, 400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
        const at = 'rig-access-' + crypto.randomBytes(8).toString('hex'); ats.add(at); return send(res, 200, { access_token: at, expires_in: 3599, token_type: 'Bearer' });
      }
      return send(res, 400, { error: 'unsupported_grant_type' });
    }
    // every Drive call: a token this stand-in gave
    const tok = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (!/^\/upload\/session\//.test(p) && !ats.has(tok)) return gErr(res, 401, 'authError', 'Invalid Credentials');
    calls++;
    if (req.method === 'DELETE') { deletes++; return gErr(res, 403, 'forbidden', 'stand-in: the app must never delete'); }
    if (/permissions/.test(p)) { shares++; return gErr(res, 403, 'forbidden', 'stand-in: the app must never share'); }
    if (fail.n > 0) { fail.n--; return gErr(res, fail.code, 'backendError', 'stand-in: asked to fail'); }
    if (p === '/drive/v3/about' && req.method === 'GET') return send(res, 200, { user: { emailAddress: 'erp@rig.test', displayName: 'ERP' }, storageQuota: Object.assign({ usage: String(used()), usageInDrive: String(used()) }, limit ? { limit: String(limit) } : {}) });
    let m = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (m && req.method === 'GET') { const f = files.find(x => x.id === decodeURIComponent(m[1])); return f ? send(res, 200, { id: f.id, trashed: !!f.trashed, md5Checksum: f.md5, size: String(f.size) }) : gErr(res, 404, 'notFound', 'File not found: ' + m[1]); }
    if (p === '/drive/v3/files' && req.method === 'POST') {
      let j = {}; try { j = JSON.parse(body.toString('utf8') || '{}'); } catch (e) { return gErr(res, 400, 'parseError'); }
      if ((j.parents || []).some(id => !files.find(x => x.id === id && x.mimeType === 'application/vnd.google-apps.folder'))) return gErr(res, 404, 'notFound', 'File not found: parent');
      if (j.mimeType === 'application/vnd.google-apps.shortcut' && !files.find(x => x.id === (j.shortcutDetails || {}).targetId)) return gErr(res, 404, 'notFound', 'File not found: target');
      const f = keep(j, Buffer.alloc(0)); f.target = (j.shortcutDetails || {}).targetId || ''; return send(res, 200, { id: f.id });
    }
    if (p === '/upload/drive/v3/files' && req.method === 'POST') {
      const type = String(req.headers['content-type'] || '');
      if (u.searchParams.get('uploadType') === 'resumable') {
        let j = {}; try { j = JSON.parse(body.toString('utf8') || '{}'); } catch (e) { return gErr(res, 400, 'parseError'); }
        if ((j.parents || []).some(id => !files.find(x => x.id === id))) return gErr(res, 404, 'notFound', 'File not found: parent');
        const sid = crypto.randomBytes(6).toString('hex'); sessions[sid] = { meta: j, mime: req.headers['x-upload-content-type'] };
        res.writeHead(200, { Location: 'http://127.0.0.1:' + PORT + '/upload/session/' + sid }); return res.end();
      }
      const b = (/boundary=([^;]+)/.exec(type) || [])[1]; if (u.searchParams.get('uploadType') !== 'multipart' || !b) return gErr(res, 400, 'badRequest', 'multipart expected');
      const sep = Buffer.from('--' + b), parts = []; let i = body.indexOf(sep);
      while (i > -1) { const j2 = body.indexOf(sep, i + sep.length); if (j2 === -1) break; parts.push(body.subarray(i + sep.length, j2)); i = j2; }
      const partOf = x => { const h = x.indexOf('\r\n\r\n'); return h === -1 ? null : x.subarray(h + 4, x.length - 2); };      // (each part ends with CR LF before the next boundary)
      if (parts.length < 2) return gErr(res, 400, 'badRequest', 'two parts expected');
      let meta = {}; try { meta = JSON.parse(partOf(parts[0]).toString('utf8')); } catch (e) { return gErr(res, 400, 'parseError', 'metadata'); }
      if ((meta.parents || []).some(id => !files.find(x => x.id === id))) return gErr(res, 404, 'notFound', 'File not found: parent');
      const f = keep(meta, partOf(parts[1]), true);
      if (!f) return gErr(res, 403, 'storageQuotaExceeded', 'The user\'s Drive storage quota has been exceeded.');
      return send(res, 200, { id: f.id, md5Checksum: f.md5, size: String(f.size) });
    }
    m = /^\/upload\/session\/([a-f0-9]+)$/.exec(p);
    if (m && req.method === 'PUT') { const s = sessions[m[1]]; if (!s) return gErr(res, 404, 'notFound'); delete sessions[m[1]];
      const f = keep(Object.assign({}, s.meta), body, true); if (!f) return gErr(res, 403, 'storageQuotaExceeded', 'The user\'s Drive storage quota has been exceeded.');
      return send(res, 200, { kind: 'drive#file', id: f.id, name: f.name }); }      // (no MD5 here: the copy asks for it)
    return gErr(res, 404, 'notFound', 'stand-in: not here: ' + req.method + ' ' + p);
  });
}).listen(PORT, '127.0.0.1');
