// a stand-in for Google's Sheets API (tests only): it keeps one "spreadsheet" in memory and answers the few calls the backup
// makes – the token, reading the tabs, batchUpdate (addSheet, updateSheetProperties, repeatCell), values:batchUpdate.
// It keeps every value EXACTLY AS IT WAS SENT (so a test can see what the backup wrote, apostrophes included).
//   GET /dump              → { calls, tabs: [{ title, rows, grid, head, second, protected }] }
//   GET /tab?title=…       → { title, values }                     GET /reset[?bare=1]  → start again (bare = no old tabs)
//   GET /protect, /unprotect                                       → the old backup's tab protections on / off
//   GET /slow?ms=N         → every values:batchUpdate waits N ms   GET /fail?n=K&code=C → the next K API calls answer C
// Listens on 127.0.0.1:3997 (GOOGLE_SHEETS_URL=http://127.0.0.1:3997, GOOGLE_TOKEN_URL=http://127.0.0.1:3997/token).
const http = require('http');
let tabs, calls, nextId, slow = 0, fail = { n: 0, code: 500 }, prot = true, writes = [];
const reset = bare => { calls = 0; nextId = 100; slow = 0; fail = { n: 0, code: 500 }; writes = []; prot = !bare;
  tabs = bare ? [] : [{ id: 1, title: 'Master', rowCount: 1, columnCount: 3, values: [['Machinery', 'Name', 'Type']] }, { id: 2, title: 'Log Book', rowCount: 1, columnCount: 3, values: [['Log Book Key', 'Date', 'Shift']] }]; };
reset(false);
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const colNo = a => a.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const meta = t => ({ properties: { sheetId: t.id, title: t.title, gridProperties: { rowCount: t.rowCount, columnCount: t.columnCount, frozenRowCount: 1 } },
  protectedRanges: prot && t.id < 100 ? [{ range: { sheetId: t.id }, warningOnly: false, requestingUserCanEdit: false }] : [] });
http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    const u = new URL(req.url, 'http://x'), p = u.pathname;
    if (p === '/dump') return send(res, 200, { calls: calls, writes: writes.length, tabs: tabs.map(t => ({ title: t.title, rows: t.values.length, grid: { rowCount: t.rowCount, columnCount: t.columnCount }, head: t.values[0] || [], second: t.values[1] || [], protected: prot && t.id < 100 })) });
    if (p === '/tab') { const t = tabs.find(x => x.title === u.searchParams.get('title')); return send(res, t ? 200 : 404, t ? { title: t.title, values: t.values } : {}); }
    if (p === '/reset') { reset(u.searchParams.get('bare') === '1'); return send(res, 200, { ok: true }); }
    if (p === '/protect') { prot = true; return send(res, 200, { ok: true }); }
    if (p === '/unprotect') { prot = false; return send(res, 200, { ok: true }); }
    if (p === '/slow') { slow = Number(u.searchParams.get('ms')) || 0; return send(res, 200, { slow: slow }); }
    if (p === '/fail') { fail = { n: Number(u.searchParams.get('n')) || 0, code: Number(u.searchParams.get('code')) || 500 }; return send(res, 200, fail); }
    if (p === '/token') return send(res, 200, { access_token: 'standin-token', expires_in: 3600, token_type: 'Bearer' });
    if (!/^Bearer /.test(String(req.headers.authorization || ''))) return send(res, 401, { error: { message: 'no token' } });
    calls++;
    if (fail.n > 0) { fail.n--; return send(res, fail.code, { error: { code: fail.code, message: 'stand-in: asked to fail' } }); }
    let j = {}; try { j = body ? JSON.parse(body) : {}; } catch (e) { return send(res, 400, { error: { message: 'bad JSON' } }); }
    let m;
    if (req.method === 'GET' && /^\/v4\/spreadsheets\/[^/:]+$/.test(p)) return send(res, 200, { sheets: tabs.map(meta) });
    if (req.method === 'POST' && /^\/v4\/spreadsheets\/[^/:]+:batchUpdate$/.test(p)) {
      const replies = [];
      for (const q of j.requests || []) {
        if (q.addSheet) { const pr = q.addSheet.properties || {}; if (tabs.some(t => t.title === pr.title)) return send(res, 400, { error: { message: 'A sheet with the name "' + pr.title + '" already exists.' } });
          const t = { id: nextId++, title: pr.title, rowCount: (pr.gridProperties || {}).rowCount || 1000, columnCount: (pr.gridProperties || {}).columnCount || 26, values: [] }; tabs.push(t); replies.push({ addSheet: { properties: meta(t).properties } }); continue; }
        if (q.updateSheetProperties) { const pr = q.updateSheetProperties.properties || {}, t = tabs.find(x => x.id === pr.sheetId); if (!t) return send(res, 400, { error: { message: 'no such sheet' } });
          if (prot && t.id < 100) return send(res, 400, { error: { message: 'You are trying to edit a protected cell or object.' } });
          const g = pr.gridProperties || {}; if (g.rowCount) { t.rowCount = g.rowCount; t.values = t.values.slice(0, g.rowCount); } if (g.columnCount) { t.columnCount = g.columnCount; t.values = t.values.map(r => r.slice(0, g.columnCount)); } replies.push({}); continue; }
        replies.push({});
      }
      return send(res, 200, { replies: replies });
    }
    if (req.method === 'POST' && /^\/v4\/spreadsheets\/[^/:]+\/values:batchUpdate$/.test(p)) {
      const go = () => { let cells = 0;
        for (const d of j.data || []) { m = /^'((?:[^']|'')+)'!([A-Z]+)(\d+)$/.exec(d.range); if (!m) return send(res, 400, { error: { message: 'Unable to parse range: ' + d.range } });
          const t = tabs.find(x => x.title === m[1].replace(/''/g, "'")); if (!t) return send(res, 400, { error: { message: 'Unable to parse range: ' + d.range } });
          const r0 = Number(m[3]) - 1, c0 = colNo(m[2]) - 1;
          if (r0 + (d.values || []).length > t.rowCount) return send(res, 400, { error: { message: 'Range (' + d.range + ') exceeds grid limits. Max rows: ' + t.rowCount } });
          (d.values || []).forEach((row, i) => { if (c0 + row.length > t.columnCount) throw new Error('columns'); t.values[r0 + i] = row.slice(); cells += row.length; }); }
        writes.push({ at: Date.now(), option: j.valueInputOption, ranges: (j.data || []).map(d => d.range), cells: cells });
        return send(res, 200, { totalUpdatedCells: cells }); };
      return slow ? setTimeout(go, slow) : go();
    }
    return send(res, 404, { error: { message: 'stand-in: not a call the backup makes – ' + req.method + ' ' + p } });
  });
}).listen(3997, '127.0.0.1');
