// update-85 – the server side of the photos of a diesel issue (rig only: the Storage stand-in of rig/proxy.js): before the SQL step /
// after it – a photo kept, a save with photos, links to look at them; refused: no location, not a JPG, another user's photo, a
// photo name never sent, the same kind twice; a View user may look, not send; an edit keeps the photos.   node photo85api.js [port]
const fs = require('fs'), { execSync } = require('child_process');
const sql = q => execSync('timeout 20 su postgres -c "psql -d rcl -tA -q"', { input: q }).toString().trim();
const BASE = 'http://127.0.0.1:' + (process.argv[2] || '3000');
const post = async b => (await (await fetch(BASE + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(60000) })).json());
const out = []; let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 400) : '')); };
(async () => {
  sql("alter table public.diesel_issue drop column if exists photos; delete from storage.buckets where id = 'diesel-photos'; notify pgrst, 'reload schema'; delete from web.cache where key like 'LG\\_%' or key like 'DUP\\_%';");
  execSync('rm -rf /home/claude/rig/storage/diesel-photos'); await new Promise(r => setTimeout(r, 1500));
  const tk = (await post({ fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
  const api = async (fn, ...a) => { const r = await post({ fn: 'api', args: [tk, fn, a] }); return r.error ? { ERROR: r.error } : r.result; };
  const TINY = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAeACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3EKKKKACiiigAooooAKKKKACiiigD/9k=';      // a 40 × 30 red JPG
  const pic = 'data:image/jpeg;base64,' + TINY;
  let r = await api('dieselPhoto', { kind: 'dash', data: pic, lat: 19.99, lng: 73.78, acc: 12, at: new Date().toISOString(), no: 'MH-15-AB-0002' });
  ok('before the SQL step: a photo is refused and the message names the SQL file', r.ERROR && /supabase_step1x_diesel_photos\.sql/.test(r.ERROR), r);
  sql(fs.readFileSync(require('path').join(process.env.APP_DIR || require('path').join(__dirname, '..'), 'sql', 'supabase_step1x_diesel_photos.sql'), 'utf8')); sql("notify pgrst, 'reload schema'"); await new Promise(r => setTimeout(r, 1500));
  ok('the SQL file runs on the rig and runs again (safe twice)', (() => { try { sql(fs.readFileSync(require('path').join(process.env.APP_DIR || require('path').join(__dirname, '..'), 'sql', 'supabase_step1x_diesel_photos.sql'), 'utf8')); return true; } catch (e) { return false; } })());
  r = await api('dieselPhoto', { kind: 'dash', data: pic, lat: '', lng: '', at: new Date().toISOString(), no: 'MH-15-AB-0002' });
  ok('a photo without location is refused', r.ERROR && /no location/.test(r.ERROR), r);
  r = await api('dieselPhoto', { kind: 'xx', data: pic, lat: 19.99, lng: 73.78, no: 'MH-15-AB-0002' });
  ok('an unknown kind is refused', r.ERROR && /not one of the 4 photos/.test(r.ERROR), r);
  r = await api('dieselPhoto', { kind: 'veh', data: 'data:image/png;base64,AAAA', lat: 19.99, lng: 73.78, no: 'MH-15-AB-0002' });
  ok('not a JPG: refused', r.ERROR && /JPG/.test(r.ERROR), r);
  r = await api('dieselPhoto', { kind: 'veh', data: pic, lat: 19.99, lng: 73.78, no: 'NOT-IN-MASTER-85' });
  ok('a machinery that is not in Master: refused', r.ERROR && /not in Master/.test(r.ERROR), r);
  r = await api('getMeterReading', { data: pic, no: 'MH-15-AB-0002' });
  ok('the AI reading is its own question; on a site without the AI it says so ({ off: true })', r && r.off === true, r);
  const up = {};
  for (const k of ['dash', 'veh', 'pump', 'reg']) { up[k] = await api('dieselPhoto', { kind: k, data: pic, lat: 19.9975, lng: 73.7898, acc: 14.6, at: '2026-10-12T10:15:00.000Z', no: 'MH-15-AB-0002' }); }
  ok('4 photos kept (each a path in the private store)', Object.values(up).every(x => x.ok && /^\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/.test(x.path)), up);
  ok('   the files are in the store', Object.values(up).every(x => fs.existsSync('/home/claude/rig/storage/diesel-photos/' + x.path)));
  const today = sql("select to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD')");
  r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 1, driver: 'P85 driver', force: true, photos: ['dash', 'veh', 'pump', 'reg'].map(k => ({ k: k, p: up[k].path })) });
  ok('a diesel issue saved with its 4 photos', r.ok && r.id, r);
  const id = r.id;
  const row = JSON.parse(sql("select photos from diesel_issue where id = '" + id + "'") || '[]');
  ok('   kept with the entry: kind, path, time and place as the server noted them', row.length === 4 && row[0].k === 'dash' && row[0].lat === 19.9975 && row[0].acc === 15 && row[0].at === '2026-10-12T10:15:00.000Z', row);
  const list = await api('getDieselIssues', { q: id });
  ok('   the list says it has 4 photos', list.rows && list.rows[0] && list.rows[0].ph === 4, list.rows && list.rows[0]);
  const ph = await api('getDieselPhotos', id);
  ok('   links to look at them, in order Dashboard, Vehicle, Dispenser, Register', ph.photos && ph.photos.map(x => x.k).join() === 'dash,veh,pump,reg' && ph.photos.every(x => /\/storage\/v1\/object\/sign\/diesel-photos\/.+\?token=/.test(x.url)), ph);
  const img = await fetch(ph.photos[0].url); const bytes = Buffer.from(await img.arrayBuffer());
  ok('   a link opens the very picture that was sent', img.status === 200 && bytes.equals(Buffer.from(TINY, 'base64')), { status: img.status, len: bytes.length });
  const bad = await fetch(ph.photos[0].url.replace(/token=[^&]+/, 'token=forged.9999999999'));
  ok('   a made-up link does not open it', bad.status >= 400, bad.status);
  // the same photo cannot be attached twice / by another user
  r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 1, driver: 'P85 driver', force: true, photos: [{ k: 'dash', p: up.dash.path }] });
  ok('a photo that is already with an entry cannot be given to a second one', r.ERROR && /already with another entry/.test(r.ERROR), r);
  const other = await api('dieselPhoto', { kind: 'veh', data: pic, lat: 19.99, lng: 73.78, no: 'MH-15-AB-0002' });
  const m2 = sql("select id from master where id <> 'MH-15-AB-0002' and coalesce(status,'') <> 'Inactive' and coalesce(diesel_supply,'') <> 'Debit Basis' order by id limit 1");
  r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: m2, qty: 1, force: true, photos: [{ k: 'veh', p: other.path }] });
  ok('a photo taken for one machinery cannot go with an entry of another (' + m2 + ')', r.ERROR && new RegExp('taken for MH-15-AB-0002, not for ' + m2).test(r.ERROR), r);
  const d2 = await api('dieselPhoto', { kind: 'dash', data: pic, lat: 19.99, lng: 73.78, no: 'MH-15-AB-0002' });
  r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 1, driver: 'P85 driver', force: true, photos: [{ k: 'dash', p: d2.path }, { k: 'dash', p: d2.path }] });
  ok('the same kind twice: refused', r.ERROR && /can be given once/.test(r.ERROR), r);
  r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 1, driver: 'P85 driver', force: true, photos: [{ k: 'veh', p: d2.path }] });
  ok('a photo given as another kind (a Dashboard photo as Vehicle): refused', r.ERROR && /not taken by you/.test(r.ERROR), r);
  r = await api('saveDieselIssue', { date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 1, driver: 'P85 driver', force: true, photos: [{ k: 'reg', p: '2026-10/00000000-0000-0000-0000-000000000000.jpg' }] });
  ok('a photo name that was never sent: refused', r.ERROR && /not taken by you/.test(r.ERROR), r);
  // another user (Diesel Issue Edit) cannot use the Admin's photo
  sql("delete from app_users where id = 'p85@rcl.test'"); 
  const MOD = (await api('usersAdmin')).modules.map(m => m.key), perms = {}; MOD.forEach(m => { perms[m] = m === 'Diesel Issue' ? 'Edit' : 'None'; });
  await api('saveUserAdmin', { isNew: true, email: 'p85@rcl.test', name: 'P85', active: true, admin: false, perms, newPassword: 'Temp#p851' });
  const l = await post({ fn: 'login', args: ['p85@rcl.test', 'Temp#p851'] }); await post({ fn: 'changePassword', args: [l.result.token, 'Temp#p851', 'Own#p852468'] });
  const tk2 = (await post({ fn: 'login', args: ['p85@rcl.test', 'Own#p852468'] })).result.token;
  r = await post({ fn: 'api', args: [tk2, 'saveDieselIssue', [{ date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 1, force: true, photos: [{ k: 'pump', p: up.pump.path }] }]] });
  ok('another user cannot attach the Admin\'s photo', r.error && /not taken by you/.test(r.error), r);
  // a View-only user may look, not send
  const perms2 = {}; MOD.forEach(m => { perms2[m] = m === 'Diesel Issue' ? 'View' : 'None'; });
  await api('saveUserAdmin', { isNew: false, email: 'p85@rcl.test', name: 'P85', active: true, admin: false, perms: perms2 });
  r = await post({ fn: 'api', args: [tk2, 'dieselPhoto', [{ kind: 'dash', data: pic, lat: 1, lng: 1, no: 'MH-15-AB-0002' }]] });
  ok('a View-only user cannot send a photo', r.error && /View access only/.test(r.error), r);
  r = await post({ fn: 'api', args: [tk2, 'getDieselPhotos', [id]] });
  ok('   but can look at the photos', r.result && r.result.photos && r.result.photos.length === 4, r.error);
  const perms3 = {}; MOD.forEach(m => { perms3[m] = 'None'; perms3['Log Book'] = 'Edit'; });
  await api('saveUserAdmin', { isNew: false, email: 'p85@rcl.test', name: 'P85', active: true, admin: false, perms: perms3 });
  r = await post({ fn: 'api', args: [tk2, 'getDieselPhotos', [id]] });
  ok('a user without Diesel Issue cannot open the photos', r.error && /do not have access/.test(r.error), r);
  // an edit of the entry keeps its photos
  r = await api('updateDieselIssue', id, { date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', qty: 2, driver: 'P85 driver', force: true });
  ok('an edit of the entry keeps its photos', r.ok && JSON.parse(sql("select photos from diesel_issue where id = '" + id + "'") || '[]').length === 4, r);
  // clean
  await api('deleteDieselIssue', id);
  sql("delete from activity_log where email = 'p85@rcl.test'; delete from app_users where id = 'p85@rcl.test';");
  out.push('TOTAL ' + pass + ' passed, ' + fail + ' failed'); console.log(out.join('\n')); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.log('CRASH', e); process.exit(1); });
