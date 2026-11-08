/* update-120 – the bill copies of a diesel inward, through the server's own door (/api/rpc) on the local rig started with PORTAL=1:
 *   :3001 = the app's own sign-in (Sujit as Admin, a maker, a viewer), :3000 = linked to the Portal :3010 (the Super Admin's
 *   ticket, for the verification rules), database rcl, the Storage stand-in of rig/proxy.js. Test data only (users, a machinery,
 *   inwards of bill "BC120-…", diesel of "BC120-1"), taken out at the end; the rules of the site are put back as they were.
 *   node test/inward120api.js            everything
 *   node test/inward120api.js diesel     only: a diesel issue WITH ITS PHOTOS sent for verification, approved after the server
 *                                        forgot the photos (6 hours) – saved with them? (the same check on the code before)
 * Checks against the REAL database: before the SQL step – refused, naming the file; the step runs (twice); copies kept in the
 * private store; an inward saved with its copies; the list counts them; links open the very pictures; refused: not a JPG, too
 * big, a copy of another user, a diesel photo, a name never sent, the same twice, more than 10, a copy already with an inward;
 * an edit keeps / takes out / adds, and without the list keeps them; View may look, not add; no access – not even look; an
 * inward sent for verification keeps its copies until it is approved – also after the 6 hours (and no other entry takes them). */
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const sql = q => execSync('timeout 60 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const U = 'http://127.0.0.1:3001', SA = 'http://127.0.0.1:3000', P = 'http://127.0.0.1:3010', PW = 'Nashik#Road848!';
const ONLY_DIESEL = process.argv[2] === 'diesel';
const wait = ms => new Promise(r => setTimeout(r, ms));
const post = async (base, body) => { const r = await fetch(base + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); return r.json(); };
let n = 0; const rid = () => 'bc120' + Date.now().toString(36) + (n++);
const TINY = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAeACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3EKKKKACiiigAooooAKKKKACiiigD/9k=';      // a 40 × 30 red JPG
const PIC = 'data:image/jpeg;base64,' + TINY;
const STEP = path.join(__dirname, '..', 'sql', 'supabase_step1zb_inward_bills.sql');
const STORE = '/home/claude/rig/storage/diesel-photos/';
(async () => {
  const rules0 = sql("select coalesce((select value from app_settings where id = 'FLOW_RULES'), '__none__')");
  const cleanup = () => {
    sql("delete from diesel_issue where machinery = 'BC120-1'; delete from diesel_inward where bill_number like 'BC120-%' or pump_name = 'BC120 Pump'; delete from master where id = 'BC120-1';" +
      "delete from billed_changes where kind = 'Flow' and (requester_email in ('mk120@rcl.test') or args like '%BC120-%'); delete from app_users where email in ('mk120@rcl.test', 'vw120@rcl.test', 'no120@rcl.test');" +
      (rules0 === '__none__' ? "delete from app_settings where id = 'FLOW_RULES';" : "update app_settings set value = '" + rules0.replace(/'/g, "''") + "' where id = 'FLOW_RULES';") +
      "delete from web.cache where key like 'SB%' or key = 'USERS_LIST';");
  };
  try {
    cleanup();
    if (!ONLY_DIESEL) { sql("alter table public.diesel_inward drop column if exists photos; notify pgrst, 'reload schema';"); }      // (the rig only: as a site before the step)
    sql("insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_inward, perm_diesel_issue, perm_master) select 'mk120', 'mk120@rcl.test', password_hash, 'Maker 120', 'Yes', 'No', 'Edit', 'Edit', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin, perm_diesel_inward) select 'vw120', 'vw120@rcl.test', password_hash, 'Viewer 120', 'Yes', 'No', 'View' from app_users where email = 'sujit@rcl.test';" +
      "insert into app_users (id, email, password_hash, name, active, admin, perm_log_book, perm_diesel_inward) select 'no120', 'no120@rcl.test', password_hash, 'Other 120', 'Yes', 'No', 'Edit', 'None' from app_users where email = 'sujit@rcl.test';" +      // (a blank cell is View)
      "delete from web.cache where key = 'USERS_LIST' or key like 'SBCOL%';");
    await wait(1500);
    const signIn = async e => { const a = await post(U, { fn: 'login', args: [e, PW] }); return a.result && a.result.token; };
    const su = await signIn('sujit@rcl.test'), mk = await signIn('mk120@rcl.test'), vw = await signIn('vw120@rcl.test'), no = await signIn('no120@rcl.test');
    let lr = null; for (const pw of ['Super#Admin2040', 'Super#Admin2041']) { lr = await fetch(P + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RCL': '1' }, body: JSON.stringify({ action: 'login', email: 'sa@rcl.test', password: pw }) }); if (lr.status === 200) break; }
    const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
    const go = await fetch(P + '/api/go?module=mechanical&site=S1', { headers: { Cookie: cookie }, redirect: 'manual' });
    const ticket = (go.headers.get('location') || '').split('#sso=')[1] || '';
    const ss = await post(SA, { fn: 'ssoLogin', args: [ticket] }); const sa = ss.result && ss.result.token;
    ok('signed in: Sujit (Admin), a maker, a viewer, a user without Diesel Inward at :3001; the Super Admin through the Portal at :3000', !!(su && mk && vw && no && sa), { su: !!su, mk: !!mk, vw: !!vw, no: !!no, sa: ss.error || !!sa });
    const api = async (base, tok, fn, a, r) => { const b = { fn: 'api', args: [tok, fn, a || []] }; if (r) b.rid = r; const x = await post(base, b); return x.error ? { ERROR: x.error } : x.result; };
    const J = (fn, ...a) => api(U, su, fn, a, rid()), M = (fn, ...a) => api(U, mk, fn, a, rid()), V = (fn, ...a) => api(U, vw, fn, a, rid()), N = (fn, ...a) => api(U, no, fn, a, rid()), S = (fn, ...a) => api(SA, sa, fn, a, rid());
    const today = sql("select to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD')");
    const inw = (bill, x) => Object.assign({ date: today, location: 'Dispenser', pump: 'BC120 Pump', qty: 10, rate: 90, billNo: bill, billDate: today }, x || {});
    const copy = async who => { const r = await (who || J)('inwardPhoto', { data: PIC }); return r.path ? r.path : r; };
    const rowPhotos = id => { const v = sql("select coalesce(photos, '') from diesel_inward where id = '" + id + "'"); return v ? JSON.parse(v) : []; };
    const forget = () => sql("delete from web.cache where key like 'PH\\_%'");      // what the server keeps for 6 hours – gone (as after 6 hours)
    const mach = async () => { const x = await J('saveMaster', { no: 'BC120-1', name: 'Tipper', type: 'Tipper', unit: 'KM', worksOn: ['KM'], kmStd: 4, tankCap: 2000, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: '2026-01-01' }, 'add'); ok('seed: machinery BC120-1', x.ok, x); };
    let r;

    if (!ONLY_DIESEL) {
      // ---- before the SQL step ----
      r = await J('inwardPhoto', { data: PIC });
      ok('before the SQL step: a bill copy is refused and the message names the SQL file', /supabase_step1zb_inward_bills\.sql/.test(r.ERROR || ''), r);
      r = await J('saveInward', inw('BC120-0'));
      ok('   an inward without copies is saved as before', r.ok && /^IN-/.test(r.id), r);
      sql(fs.readFileSync(STEP, 'utf8')); sql(fs.readFileSync(STEP, 'utf8')); sql("notify pgrst, 'reload schema'"); await wait(1500);
      ok('the SQL step runs on the rig, and again (safe twice); it only adds the column', sql("select count(*) from information_schema.columns where table_name = 'diesel_inward' and column_name = 'photos'") === '1');
      // ---- copies ----
      r = await J('inwardPhoto', { data: 'data:image/png;base64,AAAA' });
      ok('not a JPG: refused', /The bill copy must be a JPG picture/.test(r.ERROR || ''), r);
      r = await J('inwardPhoto', { data: 'data:image/jpeg;base64,' + 'A'.repeat(2000004) });
      ok('too big: refused', /The bill copy is too big/.test(r.ERROR || ''), r);
      const c = []; for (let i = 0; i < 4; i++) c.push(await copy());
      ok('4 copies kept – each a name in the folder inward/ of the private store', c.every(p => typeof p === 'string' && /^inward\/\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/.test(p)), c);
      ok('   the files are in the store, as sent', c.every(p => typeof p === 'string' && fs.existsSync(STORE + p) && fs.readFileSync(STORE + p).equals(Buffer.from(TINY, 'base64'))));
      // ---- saved with an inward ----
      r = await J('saveInward', inw('BC120-1', { photos: c.slice(0, 3).map(p => ({ p: p })) }));
      ok('an inward saved with 3 bill copies', r.ok && /^IN-/.test(r.id), r);
      const id1 = r.id;
      let row = rowPhotos(id1);
      ok('   kept with the inward: the 3 names, in order, with the time each was sent', row.length === 3 && row.map(x => x.p).join() === c.slice(0, 3).join() && row.every(x => !isNaN(Date.parse(x.at))), row);
      let list = await J('getInwards', { bill: 'BC120-1' });
      ok('   the list says it has 3 bill copies (and 0 for an inward without)', list.rows && list.rows.length === 1 && list.rows[0].ph === 3 && (await J('getInwards', { bill: 'BC120-0' })).rows[0].ph === 0, list.rows);
      let ph = await J('getInwardPhotos', id1);
      ok('   links to look at them, in order', ph.id === id1 && ph.billNo === 'BC120-1' && ph.photos.length === 3 && ph.photos.map(x => x.p).join() === c.slice(0, 3).join() && ph.photos.every(x => /\/storage\/v1\/object\/sign\/diesel-photos\/inward\/.+\?token=/.test(x.url)), ph);
      const img = await fetch(ph.photos[0].url), bytes = Buffer.from(await img.arrayBuffer());
      ok('   a link opens the very picture', img.status === 200 && bytes.equals(Buffer.from(TINY, 'base64')), img.status);
      ok('   a made-up link does not', (await fetch(ph.photos[0].url.replace(/token=[^&]+/, 'token=forged.9999999999'))).status >= 400);
      // ---- refused ----
      r = await J('saveInward', inw('BC120-2', { photos: [{ p: c[0] }] }));
      ok('a copy already with an inward cannot go with a second one', /A bill copy was not added by you in the last 6 hours, or it is already with another entry/.test(r.ERROR || ''), r);
      r = await J('saveInward', inw('BC120-2', { photos: [{ p: c[3] }, { p: c[3] }] }));
      ok('the same copy twice: refused', /The same bill copy is given twice/.test(r.ERROR || ''), r);
      r = await J('saveInward', inw('BC120-2', { photos: [{ p: 'inward/2026-10/00000000-0000-0000-0000-000000000000.jpg' }] }));
      ok('a name that was never sent: refused', /was not added by you/.test(r.ERROR || ''), r);
      await mach();
      const dph = await J('dieselPhoto', { kind: 'dash', data: PIC, lat: 19.99, lng: 73.78, acc: 10, at: new Date().toISOString(), no: 'BC120-1' });
      r = await J('saveInward', inw('BC120-2', { photos: [{ p: dph.path }] }));
      ok('a photo of a diesel issue is not a bill copy', dph.path && /was not added by you/.test(r.ERROR || ''), [dph, r]);
      r = await M('saveInward', inw('BC120-2', { photos: [{ p: c[3] }] }));
      ok('another user cannot give Sujit\'s copy', /was not added by you/.test(r.ERROR || ''), r);
      const eleven = []; for (let i = 0; i < 11; i++) eleven.push(await copy());
      r = await J('saveInward', inw('BC120-2', { photos: eleven.map(p => ({ p: p })) }));
      ok('more than 10 copies: refused', /An inward keeps at most 10 bill copy photos/.test(r.ERROR || ''), r);
      r = await J('saveInward', inw('BC120-2', { photos: eleven.slice(0, 10).map(p => ({ p: p })) }));
      ok('   10 copies: saved', r.ok && rowPhotos(r.id).length === 10, r);
      ok('none of the refused saves wrote an inward (BC120-2: only the one with 10)', sql("select count(*) from diesel_inward where bill_number = 'BC120-2'") === '1');
      // ---- an edit ----
      const at0 = rowPhotos(id1)[0].at;
      r = await J('updateInward', id1, inw('BC120-1', { photos: [{ p: c[0] }, { p: c[2] }, { p: c[3] }] }));
      row = rowPhotos(id1);
      ok('an edit: copy 2 taken out, a new one added, 1 and 3 kept (their time as before)', r.ok && row.map(x => x.p).join() === [c[0], c[2], c[3]].join() && row[0].at === at0, [r, row]);
      ok('   the picture taken out stays in the store (nothing is deleted)', fs.existsSync(STORE + c[1]));
      r = await J('updateInward', id1, inw('BC120-1', { qty: 12 }));
      ok('an edit without the list (an older page / app) keeps the copies', r.ok && rowPhotos(id1).length === 3 && sql("select qty from diesel_inward where id = '" + id1 + "'") === '12', [r, rowPhotos(id1)]);
      const act = sql("select changes from activity_log where record_id = '" + id1 + "' and action = 'Edit' order by at desc limit 1");
      ok('   the Activity Log has the edit', /Qty \(Ltr\): 10 → 12/.test(act), act);
      r = await J('updateInward', id1, inw('BC120-1', { qty: 12, photos: [] }));
      ok('an edit with all copies taken out: none left', r.ok && rowPhotos(id1).length === 0 && (await J('getInwards', { bill: 'BC120-1' })).rows[0].ph === 0, [r, rowPhotos(id1)]);
      // ---- who may ----
      r = await V('inwardPhoto', { data: PIC });
      ok('a View user cannot add a copy', /View access only for Diesel Inward/.test(r.ERROR || ''), r);
      const id10 = sql("select id from diesel_inward where bill_number = 'BC120-2'");
      r = await V('getInwardPhotos', id10);
      ok('   but can look at them', r.photos && r.photos.length === 10, r.ERROR);
      r = await N('getInwardPhotos', id10);
      ok('a user without Diesel Inward cannot look', /do not have access/.test(r.ERROR || ''), r);
      r = await J('getInwardPhotos', 'IN-999999');
      ok('an inward that is not there: said', /Inward IN-999999 was not found/.test(r.ERROR || ''), r);
      // ---- sent for verification ----
      r = await S('saveFlowRules', { tasks: { 'Diesel Inward': { on: true, levels: [['sujit@rcl.test']] } } });
      ok('rule (Super Admin): Diesel Inward → Sujit', r.ok, r);
      const m1 = await copy(M), m2 = await copy(M);
      r = await M('saveInward', inw('BC120-3', { photos: [{ p: m1 }, { p: m2 }] }));
      const vf = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
      ok('the maker\'s inward with 2 copies: sent for verification, nothing saved', /^Sent for verification to Sujit/.test(r.ERROR || '') && vf && sql("select count(*) from diesel_inward where bill_number = 'BC120-3'") === '0', r);
      const data = JSON.parse(sql("select data from billed_changes where id = '" + vf + "'") || '{}');
      ok('   the request keeps what the server noted for its 2 copies', data.photos && Object.keys(data.photos).sort().join() === [m1, m2].sort().join() && data.photos[m1].e === 'mk120@rcl.test', data.photos);
      const summ = sql("select summary from billed_changes where id = '" + vf + "'");
      ok('   the approver reads "bill copies 2" in the entry', /bill copies 2/.test(summ), summ);
      r = await M('saveInward', inw('BC120-4', { photos: [{ p: m1 }] }));
      ok('   meanwhile no other entry can take those copies', /was not added by you in the last 6 hours, or it is already with another entry/.test(r.ERROR || ''), r);
      forget();
      r = await J('decideChangeRequest', { id: vf, approve: true });
      const id3 = sql("select id from diesel_inward where bill_number = 'BC120-3'");
      ok('approved after the server forgot the copies (as after 6 hours): saved WITH its 2 copies, as the maker\'s', r.status === 'Approved' && id3 && rowPhotos(id3).map(x => x.p).sort().join() === [m1, m2].sort().join() && sql("select entered_by from diesel_inward where id = '" + id3 + "'") === 'Maker 120', [r, id3 && rowPhotos(id3)]);
      ph = await J('getInwardPhotos', id3);
      ok('   and they open', ph.photos && ph.photos.length === 2 && ph.photos.every(x => x.url), ph);
    }

    // ---- (update-120) the same for the photos of a diesel issue sent for verification ----
    if (ONLY_DIESEL) await mach();
    r = await S('saveFlowRules', { tasks: { 'Diesel Issue': { on: true, levels: [['sujit@rcl.test']] } } });
    ok('rule (Super Admin): Diesel Issue → Sujit (Diesel Inward: no rule)', r.ok, r);
    r = await J('saveInward', inw('BC120-9', { qty: 500 }));
    ok('seed: 500 L into the Dispenser', r.ok, r);
    const dp = {}; for (const k of ['dash', 'veh', 'pump', 'reg']) { const x = await M('dieselPhoto', { kind: k, data: PIC, lat: 19.9975, lng: 73.7898, acc: 14, at: new Date().toISOString(), no: 'BC120-1' }); dp[k] = x.path || x; }
    ok('the maker takes the 4 photos of a fill', Object.values(dp).every(p => typeof p === 'string'), dp);
    r = await M('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'BC120-1', qty: 5, kmReading: 1005, force: true, photos: ['dash', 'veh', 'pump', 'reg'].map(k => ({ k: k, p: dp[k] })) });
    const vfd = ((r.ERROR || '').match(/VF-\d{5}/) || [])[0];
    ok('the diesel issue with its 4 photos: sent for verification', /^Sent for verification to Sujit/.test(r.ERROR || '') && !!vfd, r);
    forget();
    r = await J('decideChangeRequest', { id: vfd, approve: true });
    const ph4 = sql("select coalesce(photos, '') from diesel_issue where machinery = 'BC120-1'");
    ok('approved after the server forgot the photos (as after 6 hours): the diesel issue is saved WITH its 4 photos', r.status === 'Approved' && (JSON.parse(ph4 || '[]')).length === 4, [r.status, r.result, ph4, r.ERROR]);
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 600)); }
  finally { try { cleanup(); } catch (e) { out.push('cleanup: ' + e.message); } }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
