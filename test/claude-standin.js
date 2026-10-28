// (update-167) a stand-in for Claude – Anthropic's Messages API (tests only; port 3998, where the Gemini stand-in is when Gemini is
// tested). It checks what the app sends as strictly as the real service does – the key and the version header, the turns (user
// first, then one side after the other), a result for EVERY look-up first in the next turn and none without its look-up, no empty
// text, the look-ups' JSON Schema – and answers the way the real one does: a tool_use, then a text made from its tool_result.
// Same controls as test/gemini-standin.js: /__log, /__clear, /__meter?say=, /__busy?model=NAME&n=3 (529 overloaded) and
// /__credit?n=1 (400 "credit balance is too low").
// (update-173) POST /__next (its body: the text of the next answer to a file – one a call, in order; then /__meter's) and POST /__names
// (the answer to the names of an old log book).
const http = require('http'); const log = [], busy = {}, meter = { say: '{"km": null, "hrs": null}' }, credit = { n: 0 }, next = [], names = { say: '{"fixes": []}' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const err = (res, code, type, message) => send(res, code, { type: 'error', error: { type: type, message: message } });
const MODELS = [
  { type: 'model', id: 'claude-haiku-5-5', display_name: 'Claude Haiku 5.5', created_at: '2026-09-20T00:00:00Z' },
  { type: 'model', id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5', created_at: '2026-09-10T00:00:00Z' },
  { type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', created_at: '2026-09-10T00:00:00Z' },
  { type: 'model', id: 'claude-sonnet-4-5-20250929', display_name: 'Claude Sonnet 4.5', created_at: '2025-09-29T00:00:00Z' },
];
const blocks = c => typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : [];
// what the real service refuses (400 invalid_request_error) – the message, or '' when the request is right
function wrong(j) {
  if (typeof j.model !== 'string' || !j.model) return 'model: Field required';
  if (!Number.isInteger(j.max_tokens) || j.max_tokens < 1) return 'max_tokens: Field required';
  const ms = j.messages; if (!Array.isArray(ms) || !ms.length) return 'messages: at least one message is required';
  if (ms[0].role !== 'user') return 'messages: first message must use the "user" role';
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i], bl = blocks(m.content);
    if (m.role !== 'user' && m.role !== 'assistant') return 'messages.' + i + '.role: Input should be \'user\' or \'assistant\'';
    if (i > 0 && ms[i - 1].role === m.role) return 'messages: roles must alternate between "user" and "assistant"';
    if (!bl.length) return 'messages.' + i + ': all messages must have non-empty content';
    for (const b of bl) {
      if (b.type === 'text' && !String(b.text || '').trim()) return 'messages.' + i + ': text content blocks must contain non-whitespace text';
      if (b.type === 'tool_use' && (m.role !== 'assistant' || !/^[a-zA-Z0-9_-]+$/.test(String(b.id || '')) || typeof b.input !== 'object')) return 'messages.' + i + ': tool_use is not right';
      if ((b.type === 'image' || b.type === 'document') && (!b.source || b.source.type !== 'base64' || !b.source.data)) return 'messages.' + i + ': the source of an image / document is not right';
      if (b.type === 'image' && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(b.source.media_type) < 0) return 'messages.' + i + ': image media_type is not supported';
      if (b.type === 'document' && b.source.media_type !== 'application/pdf') return 'messages.' + i + ': document media_type is not supported';
    }
    const uses = bl.filter(b => b.type === 'tool_use').map(b => b.id), next = ms[i + 1], nb = next ? blocks(next.content) : [];
    if (uses.length && next) {
      const res = nb.filter(b => b.type === 'tool_result').map(b => b.tool_use_id), missing = uses.filter(id => res.indexOf(id) < 0);
      if (missing.length) return 'messages.' + (i + 1) + ': `tool_use` ids were found without `tool_result` blocks immediately after: ' + missing.join(', ') + '. Each `tool_use` block must have a corresponding `tool_result` block in the next message.';
      const firstOther = nb.findIndex(b => b.type !== 'tool_result'), lastRes = nb.map(b => b.type).lastIndexOf('tool_result');
      if (firstOther > -1 && firstOther < lastRes) return 'messages.' + (i + 1) + ': tool_result blocks must come first in the message';
    }
    if (m.role === 'user') {
      const prevUses = i > 0 ? blocks(ms[i - 1].content).filter(b => b.type === 'tool_use').map(b => b.id) : [];
      const stray = bl.filter(b => b.type === 'tool_result' && prevUses.indexOf(b.tool_use_id) < 0);
      if (stray.length) return 'messages.' + i + ': unexpected `tool_use_id` found in `tool_result` blocks: ' + stray[0].tool_use_id + '. Each `tool_result` block must have a corresponding `tool_use` block in the previous message.';
    }
  }
  if (j.tools !== undefined && (!Array.isArray(j.tools) || j.tools.some(t => !t.name || !t.input_schema || t.input_schema.type !== 'object'))) return 'tools: input_schema must be a JSON Schema of type "object"';
  if (JSON.stringify(j.tools || []).match(/"type":"(OBJECT|STRING|NUMBER|INTEGER|BOOLEAN|ARRAY)"/)) return 'tools: JSON Schema types are written in small letters';
  if (j.system !== undefined && typeof j.system !== 'string' && !(Array.isArray(j.system) && j.system.every(b => b.type === 'text' && String(b.text || '').trim()))) return 'system: must be a string or text blocks';
  return '';
}
http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    if (req.url === '/__log') return send(res, 200, log);
    const mr = /^\/__meter\?say=(.*)$/.exec(req.url); if (mr) { meter.say = decodeURIComponent(mr[1]); return send(res, 200, meter); }
    if (req.url === '/__clear') { log.length = 0; Object.keys(busy).forEach(k => delete busy[k]); credit.n = 0; next.length = 0; names.say = '{"fixes": []}'; return send(res, 200, {}); }
    if (req.url === '/__next' && req.method === 'POST') { next.push(body); return send(res, 200, { queued: next.length }); }
    if (req.url === '/__names' && req.method === 'POST') { names.say = body; return send(res, 200, {}); }
    const bz = /^\/__busy\?model=([^&]+)&n=(\d+)/.exec(req.url); if (bz) { busy[decodeURIComponent(bz[1])] = Number(bz[2]); return send(res, 200, busy); }
    const cr = /^\/__credit\?n=(\d+)/.exec(req.url); if (cr) { credit.n = Number(cr[1]); return send(res, 200, credit); }
    if (req.headers['x-api-key'] !== 'test-key-c') return err(res, 401, 'authentication_error', 'invalid x-api-key');
    if (!req.headers['anthropic-version']) return err(res, 400, 'invalid_request_error', 'anthropic-version: header is required');
    if (req.method === 'GET' && /^\/v1\/models(\?|$)/.test(req.url)) { log.push({ service: 'claude', list: true }); return send(res, 200, { data: MODELS, has_more: false, first_id: MODELS[0].id, last_id: MODELS[MODELS.length - 1].id }); }
    if (req.method !== 'POST' || req.url !== '/v1/messages') return err(res, 404, 'not_found_error', 'Not found');
    let j = {}; try { j = JSON.parse(body); } catch (e) { return err(res, 400, 'invalid_request_error', 'There was an issue with the format of your request'); }
    if (!MODELS.some(m => m.id === j.model)) return err(res, 404, 'not_found_error', 'model: ' + j.model);
    const bk = busy[j.model] > 0 ? j.model : busy['*'] > 0 ? '*' : '';
    if (bk) { busy[bk]--; log.push({ service: 'claude', model: j.model, busy: true }); return err(res, 529, 'overloaded_error', 'Overloaded'); }
    if (credit.n > 0) { credit.n--; log.push({ service: 'claude', model: j.model, credit: true }); return err(res, 400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'); }
    const bad = wrong(j); if (bad) { log.push({ service: 'claude', model: j.model, refused: bad }); return err(res, 400, 'invalid_request_error', bad); }
    const ms = j.messages, last = ms[ms.length - 1], lb = blocks(last.content), sysB = typeof j.system === 'string' ? [{ type: 'text', text: j.system }] : (j.system || []);
    const sys = sysB.map(b => b.text).join('\n');
    const entry = { service: 'claude', model: j.model, roles: ms.map(m => m.role).join(','), tools: (j.tools || []).map(t => t.name), sysHasRules: /Answer ONLY from this app/.test(sys), sysWho: (/The person asking is ([^.]+)\./.exec(sys) || [])[1] || '',
      cached: ((sysB[0] || {}).cache_control || {}).type || '', snapshotApart: sysB.length > 1 && /^9\. SNAPSHOT/.test(sysB[1].text || '') && !/SNAPSHOT/.test(sysB[0].text || ''), temperature: j.temperature, maxTokens: j.max_tokens };
    log.push(entry);
    const usage = { input_tokens: 1200, output_tokens: 60, cache_creation_input_tokens: ms.length === 1 ? 2300 : 0, cache_read_input_tokens: ms.length === 1 ? 0 : 2300 };
    const text = say => send(res, 200, { id: 'msg_' + log.length, type: 'message', role: 'assistant', model: j.model, content: [{ type: 'text', text: say }], stop_reason: 'end_turn', usage: usage });
    let nUse = 0; const callFn = (name, input) => send(res, 200, { id: 'msg_' + log.length, type: 'message', role: 'assistant', model: j.model, content: [{ type: 'text', text: 'Let me look that up.' }, { type: 'tool_use', id: 'toolu_s' + log.length + '_' + (++nUse), name: name, input: input }], stop_reason: 'tool_use', usage: usage });
    // a photo or a PDF bill: what /__meter says (what a model would read on it)
    const file = lb.find(b => b.type === 'image' || b.type === 'document');
    if (file) { const q = (lb.find(b => b.type === 'text') || {}).text || ''; Object.assign(entry, { image: file.source.media_type, kind: file.type, bytes: Math.round(String(file.source.data || '').length * 3 / 4), ask: q.slice(0, 600), jsonAsked: /Answer with JSON only/.test(q),
      kept: (file.cache_control || {}).type || '', read: (/Read (ONLY pages? [\d to]+|this photo|this page \([^)]*\))/.exec(q) || [])[1] || '' }); return text(next.length ? next.shift() : meter.say); }
    // the result of a look-up: the answer made from it
    const tr = lb.find(b => b.type === 'tool_result');
    if (tr) {
      const prev = blocks(ms[ms.length - 2].content), use = prev.find(b => b.type === 'tool_use' && b.id === tr.tool_use_id) || {}, n = use.name;
      let r = {}; try { r = JSON.parse(typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)) || {}; } catch (e) { r = {}; }
      entry.result = n;
      if (r.error) return text('You cannot see this: ' + r.error);
      if (/^prepare_/.test(n)) return text(r.shownToThePersonForSaveOrCancel ? 'The entry is on the screen – check it and press Save.' : r.askedThePersonFor ? 'I asked for what is missing.' : 'Not prepared.');
      if (n === 'diesel_issues') return text('**' + r.totalLitres + ' L** of diesel in ' + r.entries + ' entries (' + r.from + ' to ' + r.to + '). Most: ' + ((r.byMachinery[0] || {}).name || '-') + '.\n[[open:diesel|Open Diesel Issue]]');
      if (n === 'pending_log_book') return text(r.machineryWithoutLogBook + ' machinery have no Log Book for ' + r.date + '. [[open:log|Open Log Book]]');
      if (n === 'app_guide') return text('Use "' + ((r.pagesThatFit[0] || {}).title || '?') + '". [[open:' + ((r.pagesThatFit[0] || {}).tab || 'x') + '|Open it]]');
      if (n === 'activity') return text(r.entries + ' entries in the Activity Log; the last by ' + ((r.rows[0] || {}).name || '-') + '.');
      return text('Result of ' + n + ': ' + JSON.stringify(r).slice(0, 200));
    }
    const q = String((lb.filter(b => b.type === 'text').pop() || {}).text || ''), d = q.match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (/^NAMES OF AN OLD MAINTENANCE LOG BOOK/.test(q)) { Object.assign(entry, { names: true, ask: q.slice(q.indexOf('party – '), q.indexOf('party – ') + 1500) }); return text(names.say); }
    let snap = null; try { snap = JSON.parse(sys.split('SNAPSHOT = ')[1] || 'null'); } catch (e) { snap = null; }
    entry.snapshot = snap ? Object.keys(snap).join(',') : ''; entry.page = snap && snap.page ? snap.page.tab : '';
    if (/stock/i.test(q) && snap && snap.dieselStockNow) return text('As of now (' + snap.asOf + ') the stock is **' + snap.dieselStockNow.litres + ' L**.');
    if (/this message|हा संदेश/i.test(q)) return callFn('app_guide', { topic: q });
    const pm = /please put (\d+) for (\S+)/i.exec(q); if (pm) return callFn('prepare_diesel_issue', { machinery: pm[2], litres: Number(pm[1]) });
    if (/diesel/i.test(q)) return callFn('diesel_issues', { from: d[0] || '2026-09-29', to: d[1] || d[0] || '2026-09-30' });
    if (/pending|बाकी/i.test(q)) return callFn('pending_log_book', { date: d[0] || '2026-10-03' });
    if (/who|कोणी/i.test(q)) return callFn('activity', { from: d[0] || '2026-10-01', to: d[1] || '2026-10-04', text: '' });
    if (/how|कसे/i.test(q)) return callFn('app_guide', { topic: q });
    return text('I can only answer from this app.');
  });
}).listen(Number(process.env.PORT || 3998), '127.0.0.1');
