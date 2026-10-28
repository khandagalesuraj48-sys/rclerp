/* THE ASSISTANT'S ANSWER WORD BY WORD (update-186, asked 28-10-2026: "fast response … live jas 2 person kas boltat tas").
 * api/ai.js gets the request of one step of a question from the app's own code (aiPrepare – every check of getAiReply: who asks,
 * his limits, the conversation, the rules with this site's facts and his memory, the snapshot) and asks Claude here with
 * "stream": true. The words are handed on (onText) as Claude writes them; at the end the whole message comes back in the parts the
 * page and the phone app already know (text / functionCall) – the same as getAiReply gives.
 * The same rules as aiReplyC_ (app/Code.gs): the models in their order (the first one twice, 1.5 s apart), a busy one (no
 * connection, 429, 5xx, 529) → the next, a model the service no longer has (404) → the next, a refused key / no credit → said at
 * once in the app's own words. A stream cut after words were already sent is said as "busy" (asking again would send them twice);
 * cut before any word: the next model. */
'use strict';
const KEY = () => String(process.env.ANTHROPIC_API_KEY || '').trim();
const BASE = () => String(process.env.ANTHROPIC_API_BASE || 'https://api.anthropic.com').replace(/\/+$/, '');
const wait = ms => new Promise(r => setTimeout(r, ms));
// the app's own words for the AI service's answers (the same as app/Code.gs – its help rules know them)
const MSG = {
  off: 'The assistant is not set up yet: the Admin has to put the AI key (ANTHROPIC_API_KEY – Claude) in the server\'s settings.',
  key: code => 'The AI service did not accept its key (' + code + '): the Admin has to check ANTHROPIC_API_KEY in the server\'s settings (Vercel → Environment Variables) and Redeploy.',
  credit: 'The AI service has no credit left (Claude): the Admin has to add funds in Claude Console → Billing. The rest of the app works as always.',
  busy: (admin, last, tried) => 'The AI service is busy right now' + (last && last.code ? ' (' + last.code + ')' : '') + ' – that is on its side, not in the app. It was asked ' + tried + ' time(s). Please ask again in a minute.' +
    (admin && last ? ' Admin: model ' + last.model + (last.said ? ' said: ' + last.said : last.error ? ': ' + last.error : '') : ''),
  refused: (admin, code, model, said) => 'The AI service refused the question (' + code + ').' + (admin ? ' Model ' + model + '. It said: ' + said : ' Tell the Admin.'),
  empty: why => 'The AI service gave no answer' + (why ? ' (' + why + ')' : '') + '. Ask in other words.',
};
const said = text => { try { const j = JSON.parse(text); return String((j.error && j.error.message) || text).slice(0, 300); } catch (e) { return String(text || '').slice(0, 300); } };
const noCredit = (code, text) => code === 400 && /credit balance|purchase credits|billing/i.test(String(text || ''));
const busyCode = code => [429, 500, 502, 503, 504, 529].indexOf(code) > -1;

// the events of the stream ("event: …\ndata: {…}\n\n") as they come, in pieces of any size
function sse(onEvent) {
  let buf = '';
  return chunk => {
    buf += chunk; let i;
    while ((i = buf.search(/\r?\n\r?\n/)) > -1) {
      const block = buf.slice(0, i); buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
      let ev = '', data = '';
      block.split(/\r?\n/).forEach(l => { if (l.indexOf('event:') === 0) ev = l.slice(6).trim(); else if (l.indexOf('data:') === 0) data += l.slice(5).trim(); });
      if (!data) continue;
      let j = null; try { j = JSON.parse(data); } catch (e) { j = null; }
      if (j) onEvent(ev || j.type, j);
    }
  };
}
// one message being written: its blocks (text / tool_use) – at the end in the app's parts
function message() {
  const blocks = []; const usage = {}; let stop = '';
  return {
    on(type, j, onText) {
      if (type === 'message_start') Object.assign(usage, (j.message && j.message.usage) || {});
      else if (type === 'content_block_start') { const b = j.content_block || {}; blocks[j.index] = { type: b.type, id: b.id, name: b.name, text: b.type === 'text' ? String(b.text || '') : '', json: '' }; if (b.type === 'text' && b.text) onText(String(b.text)); }
      else if (type === 'content_block_delta') {
        const b = blocks[j.index], d = j.delta || {}; if (!b) return;
        if (d.type === 'text_delta' && d.text) { b.text += d.text; onText(d.text); }
        else if (d.type === 'input_json_delta') b.json += d.partial_json || '';
      } else if (type === 'message_delta') { Object.assign(usage, j.usage || {}); stop = (j.delta && j.delta.stop_reason) || stop; }
    },
    parts() {
      return blocks.filter(Boolean).map(b => {
        if (b.type === 'text') return String(b.text).trim() ? { text: b.text } : null;
        if (b.type === 'tool_use' && b.name) { let args = {}; try { args = b.json ? JSON.parse(b.json) : {}; } catch (e) { args = {}; } return { functionCall: { name: String(b.name), args: args && typeof args === 'object' ? args : {} } }; }
        return null;
      }).filter(Boolean);
    },
    used: () => ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'].reduce((a, k) => a + (Number(usage[k]) || 0), 0),
    stop: () => stop,
  };
}
/* one step: prep = { body, seq, admin } (aiPrepare); onText(words) as they come → { parts, model, used, tries, ms } */
async function stream(prep, onText, opt) {
  opt = opt || {};
  const key = KEY(); if (!key) throw new Error(MSG.off);
  const seq = Array.isArray(prep && prep.seq) ? prep.seq : [], t0 = Date.now(), gone = {}, admin = !!(prep && prep.admin);
  let last = null, tried = 0;
  for (let i = 0; i < seq.length; i++) {
    const model = seq[i]; if (gone[model] || Date.now() - t0 > (opt.within || 35000)) continue;
    if (i === 1) await wait(opt.pause === undefined ? 1500 : opt.pause);
    tried++;
    let r;
    try {
      r = await fetch(BASE() + '/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ model: model, stream: true }, prep.body)), signal: AbortSignal.timeout(opt.ms || 45000) });
    } catch (e) { last = { code: 0, error: 'no connection (' + String((e && e.message) || e).slice(0, 80) + ')', model: model }; continue; }
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      last = { code: r.status, said: said(text), model: model };
      if (noCredit(r.status, text)) throw new Error(MSG.credit);
      if (r.status === 401 || r.status === 403) throw new Error(MSG.key(r.status));
      if (r.status === 404) { gone[model] = true; continue; }
      if (!busyCode(r.status)) throw new Error(MSG.refused(admin, r.status, model, last.said));
      if (r.status === 429) gone[model] = true;
      continue;
    }
    const m = message(); let sent = 0, failed = null;
    const feed = sse((type, j) => { if (failed) return; if (type === 'error') { failed = (j && j.error) || { message: 'error' }; return; } m.on(type, j, t => { sent += t.length; onText(t); }); });
    try {
      const dec = new TextDecoder();
      for await (const chunk of r.body) { feed(dec.decode(chunk, { stream: true })); if (failed) break; }
    } catch (e) { failed = { type: 'connection', message: String((e && e.message) || e).slice(0, 120) }; }
    if (failed) {
      last = { code: failed.type === 'overloaded_error' ? 529 : 0, said: String(failed.message || failed.type || ''), model: model };
      if (sent) throw new Error(MSG.busy(admin, last, tried));      // words were already on the screen: not asked again here
      continue;
    }
    const parts = m.parts();
    if (!parts.length) throw new Error(MSG.empty(m.stop()));
    return { parts: parts, model: model, used: m.used(), tries: tried, ms: Date.now() - t0 };
  }
  throw new Error(MSG.busy(admin, last, tried));
}
module.exports = { stream, sse, message, MSG };
