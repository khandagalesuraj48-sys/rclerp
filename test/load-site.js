'use strict';
/* HOW MANY PEOPLE CAN ONE SITE SERVE?  –  run this against a TEST copy of the app (its own link and database), never the live site.
 *
 *   node test/load-site.js <link of the test copy> <e-mail> <password> [people = 100] [seconds = 60]
 *   e.g.  node test/load-site.js https://my-test-copy.vercel.app admin@example.com "the password" 100 120
 *
 * It behaves like that many people at work: every "page" asks "anything new?" every 2 seconds, opens the Log Book list about
 * every 15 seconds and saves a diesel issue about every 90 seconds. At the end it deletes the diesel issues and the diesel
 * inward it made; the 40 test machinery "LD-00" … "LD-39" stay (make them Inactive or delete them in Asset Master).
 * It prints how long the calls took and whether any failed. "Smooth" = half of the lists under about 1 second, saves under
 * about 2 seconds, and nothing failed. The sign-in must be an Admin (it adds machinery and diesel). */
const [base0, email, pass, n0, t0] = process.argv.slice(2);
if (!base0 || !email || !pass) { console.log('usage: node test/load-site.js <link> <e-mail> <password> [people] [seconds]'); process.exit(1); }
const base = base0.replace(/\/+$/, ''), N = Number(n0) || 100, T = Number(t0) || 60;
const post = async body => { const r = await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); try { return JSON.parse(t); } catch (e) { return { error: 'HTTP ' + r.status + ' ' + t.slice(0, 80) }; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const lg = await post({ fn: 'login', args: [email, pass] }); if (!lg.result || !lg.result.token) throw new Error('sign-in failed: ' + (lg.error || 'no token'));
  const tk = lg.result.token, api = (fn, ...a) => post({ fn: 'api', args: [tk, fn, a] });
  const init = (await api('getInit')).result; if (!init) throw new Error('the app did not start for this sign-in');
  const today = init.today, loc = (init.locations || ['Dispenser'])[0], have = new Set((init.master || []).map(m => m.id));
  console.log('test copy: ' + base + ' · ' + (init.company || '') + ' · today ' + today + ' · ' + N + ' people for ' + T + ' s');
  for (let i = 0; i < 40; i++) { const no = 'LD-' + String(i).padStart(2, '0'); if (!have.has(no)) await api('saveMaster', { no: no, name: 'Load test', type: 'Load test', unit: 'KM', worksOn: ['KM'], kmStd: 4, owner: 'Load test', ownership: 'Other', status: 'Active' }, 'add'); }
  const inw = await api('saveInward', { date: today, location: loc, pump: 'Load test', qty: N * 30 + 1000, rate: 1, billNo: 'LOADTEST-' + Date.now(), billDate: today });
  if (inw.error) console.log('note: the test diesel could not be received (' + inw.error + ') – saves may be refused for lack of stock');
  const lat = { poll: [], read: [], save: [] }, errs = {}, made = []; let n = 0; const end = Date.now() + T * 1000;
  const one = async (kind, u) => { const s0 = Date.now(); let r;
    try { r = kind === 'poll' ? await api('sync') : kind === 'read' ? await api('getLogBookList', { from: today, to: today })
        : await api('saveDieselIssue', { date: today, shift: 'Day', source: loc, no: 'LD-' + String(u % 40).padStart(2, '0'), qty: Math.round((1 + Math.random() * 8) * 100) / 100, kmReading: 100 + (n % 900), remark: 'LOAD TEST', force: true }); }
    catch (e) { r = { error: 'call failed: ' + String((e.cause && e.cause.code) || e.message) }; }
    lat[kind].push(Date.now() - s0); n++;
    if (r.error) { const k = kind + ': ' + String(r.error).slice(0, 80); errs[k] = (errs[k] || 0) + 1; } else if (kind === 'save' && r.result && r.result.id) made.push(r.result.id); };
  const every = async (kind, u, ms) => { const first = Math.random() * ms; if (Date.now() + first >= end) return; await wait(first);
    while (Date.now() < end) { const s0 = Date.now(); await one(kind, u); if (s0 + ms >= end) break; await wait(Math.max(0, s0 + ms - Date.now())); } };
  const s0 = Date.now(); await Promise.all(Array.from({ length: N }, (_, u) => Promise.all([every('poll', u, 2000), every('read', u, 15000), every('save', u, 90000)]))); const secs = (Date.now() - s0) / 1000;
  const q = (a, p) => { if (!a.length) return '-'; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  console.log(Math.round(n / secs) + ' calls a second for ' + Math.round(secs) + ' s');
  [['poll', '"anything new?"'], ['read', 'Log Book list'], ['save', 'saving a diesel issue']].forEach(k => console.log('  ' + k[1].padEnd(24) + String(lat[k[0]].length).padStart(6) + ' calls   half under ' + String(q(lat[k[0]], 0.5)).padStart(5) + ' ms   95% under ' + String(q(lat[k[0]], 0.95)).padStart(5) + ' ms   slowest ' + String(q(lat[k[0]], 1)).padStart(6) + ' ms'));
  console.log('  failed: ' + (Object.keys(errs).length ? Object.keys(errs).map(k => errs[k] + ' × ' + k).join('; ') : 'none'));
  let gone = 0; for (const id of made) { const r = await api('deleteDieselIssue', id); if (!r.error) gone++; }
  if (inw.result && inw.result.id) await api('deleteInward', inw.result.id);
  console.log('cleaned up: ' + gone + ' of ' + made.length + ' test diesel issues deleted, the test diesel receipt deleted. The machinery LD-00 … LD-39 stay.');
})().catch(e => { console.log('STOPPED: ' + String(e.message || e)); process.exit(1); });
