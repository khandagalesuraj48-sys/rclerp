// a stand-in for the Gemini service (tests only): it checks what the app sends and answers the way the real service does –
// first a functionCall (with a thoughtSignature the app must send back untouched), then a text made from the look-up's result
const http = require('http'); const log = [], busy = {};
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    if (req.url === '/__log') return send(res, 200, log);
    if (req.url === '/__clear') { log.length = 0; Object.keys(busy).forEach(k => delete busy[k]); return send(res, 200, {}); }
    // tests: /__busy?model=NAME&n=3 → the next 3 questions to that model (or to "*" = every model) are answered "busy" (503), as the real service does
    const bz = /^\/__busy\?model=([^&]+)&n=(\d+)/.exec(req.url); if (bz) { busy[decodeURIComponent(bz[1])] = Number(bz[2]); return send(res, 200, busy); }
    if (req.headers['x-goog-api-key'] !== 'test-key') return send(res, 403, { error: { message: 'API key not valid' } });
    if (req.method === 'GET' && /^\/v1beta\/models(\?|$)/.test(req.url)) return send(res, 200, { models: [
      { name: 'models/gemini-9.5-pro', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-9.0-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-9.5-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-9.5-flash-lite', supportedGenerationMethods: ['generateContent'] }, { name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] }] });
    const m = /^\/v1beta\/models\/([^:]+):generateContent/.exec(req.url); if (!m || req.method !== 'POST') return send(res, 404, { error: { message: 'not found' } });
    const bk = busy[m[1]] > 0 ? m[1] : busy['*'] > 0 ? '*' : '';
    if (bk) { busy[bk]--; log.push({ model: m[1], busy: true }); return send(res, 503, { error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } }); }
    let j = {}; try { j = JSON.parse(body); } catch (e) { return send(res, 400, { error: { message: 'bad JSON' } }); }
    const turns = j.contents || [], last = turns[turns.length - 1] || { parts: [] }, sys = ((j.system_instruction || {}).parts || [{}])[0].text || '';
    log.push({ model: m[1], roles: turns.map(t => t.role).join(','), tools: ((j.tools || [])[0] || { functionDeclarations: [] }).functionDeclarations.map(f => f.name), sysHasRules: /Answer ONLY from this app/.test(sys), sysWho: (/The person asking is ([^.]+)\./.exec(sys) || [])[1] || '', temperature: (j.generationConfig || {}).temperature });
    // a model turn that carried a signature must come back with it
    const broken = turns.some(t => t.role === 'model' && t.parts.some(p => p.functionCall && p.thoughtSignature !== 'sig-' + p.functionCall.name));
    if (broken) return send(res, 400, { error: { message: 'the thought signature of a function call was not sent back' } });
    const text = say => send(res, 200, { candidates: [{ content: { role: 'model', parts: [{ text: say }] }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 321 } });
    const callFn = (name, args) => send(res, 200, { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: name, args: args }, thoughtSignature: 'sig-' + name }] } }], usageMetadata: { totalTokenCount: 123 } });
    const fr = last.parts.find(p => p.functionResponse);
    if (fr) { const r = fr.functionResponse.response || {}, n = fr.functionResponse.name;
      if (r.error) return text('You cannot see this: ' + r.error);
      if (n === 'diesel_issues') return text('**' + r.totalLitres + ' L** of diesel in ' + r.entries + ' entries (' + r.from + ' to ' + r.to + '). Most: ' + ((r.byMachinery[0] || {}).name || '-') + '.\n[[open:diesel|Open Diesel Issue]]');
      if (n === 'pending_log_book') return text(r.machineryWithoutLogBook + ' machinery have no Log Book for ' + r.date + '. [[open:log|Open Log Book]]');
      if (n === 'app_guide') return text('Use "' + ((r.pagesThatFit[0] || {}).title || '?') + '". [[open:' + ((r.pagesThatFit[0] || {}).tab || 'x') + '|Open it]]');
      if (n === 'activity') return text(r.entries + ' entries in the Activity Log; the last by ' + ((r.rows[0] || {}).name || '-') + '.');
      return text('Result of ' + n + ': ' + JSON.stringify(r).slice(0, 200));
    }
    const q = String((last.parts.find(p => p.text) || {}).text || ''), d = q.match(/\d{4}-\d{2}-\d{2}/g) || [];
    // the snapshot that came with the question: a question it answers is answered in ONE step (no function call)
    let snap = null; try { snap = JSON.parse(sys.split('SNAPSHOT = ')[1] || 'null'); } catch (e) { snap = null; }
    log[log.length - 1].snapshot = snap ? Object.keys(snap).join(',') : ''; log[log.length - 1].page = snap && snap.page ? snap.page.tab : '';
    if (/stock/i.test(q) && snap && snap.dieselStockNow) return text('As of now (' + snap.asOf + ') the stock is **' + snap.dieselStockNow.litres + ' L**.');
    if (/this message|हा संदेश/i.test(q)) return callFn('app_guide', { topic: q });
    if (/diesel/i.test(q)) return callFn('diesel_issues', { from: d[0] || '2026-09-29', to: d[1] || d[0] || '2026-09-30' });
    if (/pending|बाकी/i.test(q)) return callFn('pending_log_book', { date: d[0] || '2026-10-03' });
    if (/who|कोणी/i.test(q)) return callFn('activity', { from: d[0] || '2026-10-01', to: d[1] || '2026-10-04', text: '' });
    if (/how|कसे/i.test(q)) return callFn('app_guide', { topic: q });
    return text('I can only answer from this app.');
  });
}).listen(3998, '127.0.0.1');
