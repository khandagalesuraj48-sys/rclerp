/* update-212 – HO's cars: their photos, a car's details; the Super Admin from the Portal. Local rig only (PORTAL=1 bash rig/all.sh):
 *   the Portal :3010 (its code from ../rcl-portal, its test database), Mechanical :3000 / :3001, the file store stand-in of the rig.
 *   T2 = database rcl_s2 (put on fuel cards for this test – as HO); S1 = database rcl (diesel stock – must stay exactly as it was).
 *   Test data only (a tiny drawn picture); T2's settings, cars, entries and photos of this test are taken out at the end.
 *      node test/cars212api.js */
'use strict';
const { execSync } = require('child_process'), path = require('path'), crypto = require('crypto'), fs = require('fs');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const wait = ms => new Promise(r => setTimeout(r, ms));
const P = 'http://127.0.0.1:3010';
const rpc = async (port, site, fn, ...args) => { const b = { fn, args }; if (site) b.site = site;
  const r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(120000) }); return r.json(); };
let cookie = '';
const portal = async (p, body) => { const h = { 'Content-Type': 'application/json', 'X-RCL': '1' }; if (cookie) h.Cookie = cookie;
  const r = await fetch(P + p, { method: 'POST', headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  let j = {}; try { j = await r.json(); } catch (e) { j = {}; } return Object.assign({ status: r.status }, j); };
Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:3106', SUPABASE_SECRET_KEY: 'sb_secret_rigkey', PORTAL_SECRET: 'rig-portal-secret-0123456789abcdefghijklmnop' });
const keys = require(path.join(__dirname, '..', '..', 'rcl-portal', 'lib', 'keys'));
const now = () => Math.floor(Date.now() / 1000);
const adm = o => keys.sign(Object.assign({ iss: P, aud: 'mechanical-admin', sub: 'sa@rcl.test', site: 'T2', act: 'carPhotos', iat: now(), exp: now() + 60, jti: crypto.randomBytes(16).toString('hex') }, o || {}));
// a tiny real JPEG (a drawn car, 64 × 40); a comment inside makes each one its own file
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAoAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwC7RRRXccIUUUUAFFFFABRRRQAVc0vTn1O9FurbBtLM+M7QPbPPOB+NU66vw1JYWenmSS7gSaZssrSAEAZAGCfqfxqZuy0LgrvUsW3hbToUxMHnYgZLMVAPfAGP1zU3/COaT/z6f+RH/wAa8m1v4ra9d6nJJpE/2GyHyxRmJHYj+8xYHk+g4HA56n0jwj4ytfEehreXLRWlwjmKaNpAAWAB3Lk52nI69ORzjJ5+aXc6LR7Gj/wjmk/8+n/kR/8AGqt94UtZU3WbGBwOFJLKevryO3P6Vqf2np//AD/W3/f1f8a8c1v4ra9d6nJJpE/2GyHyxRmJHYj+8xYHk+g4HA56kUpITjFnU32nXOnSiO5j27s7WByGHsf8mq1dJ4Y8V2Hizw751+sFvLuMM8TyAKzAA7lyc45BHcH1xk4N4sSXs6wY8pZGCYORtzxz34reEubcxnHl2IaKKKszOQvvBczXTNYTRLA3IWVjlfbgHI/z710WlaZFpNkttES3O53P8Tdzjt06UUUlFJ3RTk2rF2uQvvBczXTNYTRLA3IWVjlfbgHI/wA+9FFDinuCk1sdFpWmRaTZLbREtzudz/E3c47dOlXaKKewtz//2Q==', 'base64');
const jpg = tag => Buffer.concat([JPG.subarray(0, 2), Buffer.from([0xFF, 0xFE, 0, Buffer.byteLength(tag) + 2]), Buffer.from(tag), JPG.subarray(2)]);
const durl = b => 'data:image/jpeg;base64,' + b.toString('base64'), shaOf = b => crypto.createHash('sha256').update(b).digest('hex');
const propsOf = db => { const o = {}; sql(db, "select key || chr(9) || coalesce(value, '') from web.props").split('\n').filter(Boolean).forEach(l => { const [k, v] = l.split('\t'); o[k] = v; }); return o; };
const STORE2 = '/home/claude/rig/storage2/erp-files';
const CARS = ['HO-1-212', 'HO-2-212', 'HO-3-212', 'HO-1B-212'];
const counts = db => sql(db, "select (select count(*) from master) || ',' || (select count(*) from diesel_issue) || ',' || (select count(*) from log_book) || ',' || (select count(*) from app_settings) || ',' || (select coalesce(max(updated_at)::text, '') from app_settings)");

(async () => {
  const keepT2 = propsOf('rcl_s2'), s1Before = counts('rcl'), s1Props = JSON.stringify(['FUEL_MODE', 'FUEL_CARDS', 'DIESEL_PLACES', 'CAR_PHOTOS'].map(k => propsOf('rcl')[k])), files0 = fs.existsSync(STORE2 + '/car') ? execSync('find ' + STORE2 + '/car -type f | wc -l').toString().trim() : '0';
  const logN = w => Number(sql('rcl_s2', "select count(*) from activity_log where summary = '" + w + "'")), logA0 = logN('Car photo added: HO-1-212'), logB0 = logN('Car photo added: HO-2-212');
  const viewKeep = sql('rcl_s2', "select coalesce(perm_dashboard,'') || '|' || coalesce(perm_log_book,'') || '|' || coalesce(perm_maintenance,'') || '|' || coalesce(perm_reports,'') from app_users where email = 'view@rcl.test'");
  try {
    // ---- the Super Admin signs in to the Portal and puts T2 on fuel cards (as HO) ----
    let r = null;
    for (const pw of ['Super#Admin2041', 'Super#Admin2040']) { r = await portal('/api/auth', { action: 'login', email: 'sa@rcl.test', password: pw }); if (r.status === 200 && !r.error) break; }
    ok('the Super Admin is signed in to the Portal', r.status === 200 && !r.error, r);
    r = await portal('/api/admin', { action: 'carPhotos', site: 'T2' });
    ok('T2 not on fuel cards yet: Vehicle photos refused by Mechanical', r.status === 400 && /This site is not on fuel cards/.test(r.error || ''), r);
    r = await portal('/api/admin', { action: 'placesSave', site: 'T2', places: [{ name: 'HO Office', cap: 100 }], mode: 'card' });
    ok('T2 on fuel cards (Portal → Sites → Diesel places → Fuel cards)', r.ok && r.mode === 'card', r);
    // ---- a person at T2: the Admin (sujit) and a user with Dashboard View only (view) ----
    sql('rcl', "insert into rcl_user_sites (email, site, is_admin, is_default) values ('sujit@rcl.test', 'T2', true, false), ('view@rcl.test', 'T2', false, false) on conflict (email, site) do nothing");
    sql('rcl_s2', "update app_users set admin = 'Yes' where email = 'sujit@rcl.test'; update app_users set perm_dashboard = 'View', perm_log_book = 'None', perm_maintenance = 'None', perm_reports = 'None' where email = 'view@rcl.test'; delete from web.cache where key = 'USERS_LIST'");
    await wait(16500);
    const s1tok = (await rpc(3001, null, 'login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
    const tk = (await rpc(3001, null, 'switchSite', s1tok, 'T2')).result.token;
    const api = async (fn, ...a) => { const x = await rpc(3001, 'T2', 'api', tk, fn, a); return x.error ? { ERROR: x.error } : x.result; };
    const s1t = (await rpc(3000, null, 'login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;      // (another sign-in: the first one moved to T2)
    const s1api = async (fn, ...a) => { const x = await rpc(3000, null, 'api', s1t, fn, a); return x.error ? { ERROR: x.error } : x.result; };
    const vtok0 = (await rpc(3000, null, 'login', 'view@rcl.test', 'Audit#PassView9!x')).result;
    const vtk = vtok0 ? (await rpc(3000, null, 'switchSite', vtok0.token, 'T2')).result.token : '';
    const vapi = async (fn, ...a) => { const x = await rpc(3000, 'T2', 'api', vtk, fn, a); return x.error ? { ERROR: x.error } : x.result; };
    ok('a user (Dashboard View only) is signed in at T2', !!vtk, vtok0);
    let init = await api('getInit');
    ok('T2 page: on fuel cards', init.fuelMode === 'card', init.fuelMode);
    const today = init.today, m1 = today.slice(0, 8) + '01';
    const car = (no, x) => Object.assign({ no: no, name: 'Innova Crysta', make: 'Toyota', type: 'Car', unit: 'KM', worksOn: ['KM'], kmStd: 12, owner: 'Rachana Construction Limited', ownership: 'Own', supply: 'Company', status: 'Active', activeFrom: m1, fuel: 'Diesel' }, x || {});
    for (const c of [car('HO-1-212'), car('HO-2-212', { make: 'Maruti Suzuki', name: 'Dzire VXi', fuel: 'Petrol' }), car('HO-3-212', { make: 'Tata', name: 'Signa 4825', type: 'Tipper' })]) { r = await api('saveMaster', c, 'add'); ok('car ' + c.no + ' in Asset Master', r && r.ok, r); }
    r = await api('saveCard', { name: 'HDFC 212', last4: '4321', type: 'Fuel card', cars: [], opening: 20000, openDate: m1 });
    ok('a fuel card', r && r.ok, r);
    r = await api('saveDieselIssue', { date: today, shift: 'Day', no: 'HO-1-212', qty: 30, kmReading: 48100, source: 'HDFC 212', amount: 2850 }); ok('a fill by card', r && r.ok, r);
    r = await api('saveDieselIssue', { date: today, shift: 'Day', no: 'HO-1-212', qty: 10, kmReading: 48210, source: 'Cash', amount: 950 }); ok('a fill in cash', r && r.ok, r);
    r = await api('saveLogRows', { rows: [{ date: today, shift: 'Full Day', no: 'HO-1-212', mode: 'KM', openingKm: 48100, closingKm: 48180, driver: 'Ramesh' }] }); ok('a Log Book day', r && r.ok !== false && !r.ERROR, r);
    // ---- the Dashboard: as before, with make / status / KM now and no photo yet ----
    let d = await api('getCardDash', { from: m1, to: today }), c1 = (d.cars || []).find(x => x.no === 'HO-1-212');
    ok('Dashboard: the figures as before (40 L, ₹3,800 – card 2,850, cash 950, 2 fills, 80 km)', c1 && c1.qty === 40 && c1.amount === 3800 && c1.card === 2850 && c1.cash === 950 && c1.fills === 2 && c1.km === 80, c1);
    ok('   with its make, status, KM now (48,210) and no photo', c1 && c1.make === 'Toyota' && c1.status === 'Active' && c1.kmNow === 48210 && c1.photo === null, c1);
    // ---- who sets a photo: not the user (the server refuses – not only the screen); the Admin ----
    r = await vapi('carPhotoSet', { no: 'HO-1-212', full: durl(jpg('a')), thumb: durl(jpg('at')) });
    ok('a user (Dashboard View) cannot set a photo – refused by the server', /Only Admin can open this/.test(r.ERROR || ''), r);
    r = await vapi('carPhotoRemove', { no: 'HO-1-212' });
    ok('   …nor remove one', /Only Admin can open this/.test(r.ERROR || ''), r);
    r = await api('carPhotoSet', { no: 'HO-1-212', full: 'data:image/jpeg;base64,' + Buffer.from('<html>').toString('base64'), thumb: durl(jpg('at')) });
    ok('not a real photo: refused', /not a real photo/.test(r.ERROR || ''), r);
    r = await api('carPhotoSet', { no: 'HO-1-212', full: durl(jpg('a')), thumb: durl(jpg('at')), was: '' });
    ok('the Admin sets the photo of HO-1-212', r && r.ok && r.photo && r.photo.t && r.photo.f && r.photo.exp > Date.now() + 5 * 60000, r);      // (a link is used for 10 of its 15 minutes: at least 5 left)
    const p1 = r.photo, pathA = 'car/' + shaOf(jpg('a')).slice(0, 2) + '/' + shaOf(jpg('a')) + '.jpg', pathAt = 'car/' + shaOf(jpg('at')).slice(0, 2) + '/' + shaOf(jpg('at')) + '.jpg';
    ok('   its two files in T2\'s private store (car/<2>/<sha256>.jpg), exactly as sent', fs.existsSync(STORE2 + '/' + pathA) && fs.readFileSync(STORE2 + '/' + pathA).equals(jpg('a')) && fs.readFileSync(STORE2 + '/' + pathAt).equals(jpg('at')));
    const kv = () => JSON.parse(sql('rcl_s2', "select coalesce(value, '{}') from app_settings where id = 'CAR_PHOTOS'") || '{}');
    ok('   the car\'s line in T2\'s own settings (app_settings CAR_PHOTOS)', kv().HO1212 && kv().HO1212.p === pathA && kv().HO1212.t === pathAt, kv());
    ok('   the Activity Log of T2: "Car photo added: HO-1-212"', logN('Car photo added: HO-1-212') === logA0 + 1);
    // the link opens the photo (the store's stand-in); a link that is not signed does not
    let g = await fetch(p1.t.replace('127.0.0.1:3102', '127.0.0.1:3102'), { signal: AbortSignal.timeout(20000) });
    const got = Buffer.from(await g.arrayBuffer());
    ok('   its small photo opens by its link', g.status === 200 && got.equals(jpg('at')), g.status);
    g = await fetch(p1.t.replace(/\?.*$/, '').replace('/object/sign/', '/object/public/'), { signal: AbortSignal.timeout(20000) });
    ok('   …not without the signed link (a private store)', g.status >= 400, g.status);
    // ---- the Dashboard, a user, the links ----
    d = await vapi('getCardDash', { from: m1, to: today }); c1 = (d.cars || []).find(x => x.no === 'HO-1-212');
    ok('the user sees the photo on the Dashboard (his Dashboard View)', c1 && c1.photo && c1.photo.v === p1.v && c1.photo.t === p1.t, c1 && c1.photo);
    r = await vapi('getCarPhotoLinks', { nos: ['HO-1-212', 'HO-2-212'] });
    ok('new links asked by the page: only cars with a photo', r && r.photos && Object.keys(r.photos).join() === 'HO-1-212', r);
    // ---- one car's details: as the person may see them ----
    let det = await vapi('getCarDetail', { no: 'HO-1-212', from: m1, to: today });
    ok('the user: the car, its fills (newest first), the totals; no Log Book / Maintenance (no access); no photo button', det && det.car.no === 'HO-1-212' && det.fills.length === 2 && det.fills[0].km === 48210 && det.sum.amount === 3800 && det.log === null && det.maint === null && det.may.photo === false, det);
    det = await api('getCarDetail', { no: 'HO-1-212', from: m1, to: today });
    ok('the Admin: its Log Book day and its maintenance (none) too', det && det.log.length === 1 && det.log[0].ckm === 48180 && det.log[0].driver === 'Ramesh' && Array.isArray(det.maint) && det.may.photo === true, det);
    // ---- changed: a screen opened before is refused; the earlier files stay ----
    r = await api('carPhotoSet', { no: 'HO-1-212', full: durl(jpg('b')), thumb: durl(jpg('bt')), was: '' });
    ok('changed by someone else meanwhile: refused, nothing saved', /was changed by someone else after you opened it/.test(r.ERROR || ''), r);
    r = await api('carPhotoSet', { no: 'HO-1-212', full: durl(jpg('b')), thumb: durl(jpg('bt')), was: p1.v });
    ok('the photo changed', r && r.ok && r.photo.v === shaOf(jpg('bt')).slice(-16), r);
    ok('   the earlier files stay in the store (nothing is deleted there)', fs.existsSync(STORE2 + '/' + pathA) && fs.existsSync(STORE2 + '/' + pathAt));
    const p2 = r.photo;
    // ---- the Machinery Number changed in Asset Master: the photo follows, in the same save ----
    r = await api('saveMaster', car('HO-1B-212'), 'edit', 'HO-1-212');
    ok('HO-1-212 renamed HO-1B-212: "1 car photo" moved with its fills and Log Book', r && r.ok && /1 car photo/.test((r.renamed || {}).text || ''), r && r.renamed);
    ok('   the photo\'s line under the new number only', kv().HO1B212 && kv().HO1B212.t === 'car/' + shaOf(jpg('bt')).slice(0, 2) + '/' + shaOf(jpg('bt')) + '.jpg' && !kv().HO1212, Object.keys(kv()));
    d = await api('getCardDash', { from: m1, to: today }); c1 = (d.cars || []).find(x => x.no === 'HO-1B-212');
    ok('   the Dashboard shows it on the renamed car', c1 && c1.photo && c1.photo.v === p2.v && c1.qty === 40, c1);
    // ---- the Portal (the Super Admin): the list, a photo set, the files bound to the signed request ----
    r = await portal('/api/admin', { action: 'carPhotos', site: 'T2' });
    ok('Portal → Sites → Vehicle photos: the cars of T2\'s Asset Master with their photos', r.status === 200 && JSON.stringify((r.cars || []).map(x => [x.no, !!x.photo])) === JSON.stringify([['HO-1B-212', true], ['HO-2-212', false], ['HO-3-212', false]]), r);
    r = await portal('/api/admin', { action: 'carPhotoSet', site: 'T2', no: 'HO-2-212', was: '', full: durl(jpg('c')), thumb: durl(jpg('ct')) });
    ok('the Super Admin sets the photo of HO-2-212 from the Portal', r.status === 200 && r.ok && r.photo && r.photo.v === shaOf(jpg('ct')).slice(-16), r);
    ok('   by "Super Admin (Portal)" (the site\'s Activity Log and the car\'s line)', kv().HO2212 && kv().HO2212.by === 'Super Admin (Portal)' && logN('Car photo added: HO-2-212') === logB0 + 1 && sql('rcl_s2', "select name from activity_log where summary = 'Car photo added: HO-2-212' order by at desc limit 1") === 'Super Admin (Portal)', kv().HO2212);
    ok('   the Portal\'s own record', Number(sql('rcl_portal', "select count(*) from audit where action = 'Vehicle photo' and target = 'HO-2-212 · T2'")) >= 1);
    // a request signed by the Portal for OTHER files: the files that arrive are refused
    let x = await rpc(3000, null, 'portalAdmin', await adm({ act: 'carPhotoSet', no: 'HO-3-212', was: '', sha: { full: shaOf(jpg('d')), thumb: shaOf(jpg('dt')) } }), { full: durl(jpg('e')), thumb: durl(jpg('dt')) });
    ok('files that are not the ones the signed request names: refused', /not the one the Portal sent/.test(x.error || ''), x);
    x = await rpc(3000, null, 'portalAdmin', await adm({ act: 'carPhotoSet', no: 'HO-3-212', was: '', sha: { full: 'x', thumb: 'y' } }), { full: durl(jpg('d')), thumb: durl(jpg('dt')) });
    ok('a request without proper fingerprints: refused', /no fingerprints of the photo/.test(x.error || ''), x);
    const t1 = await adm({ act: 'carPhotos' }); x = await rpc(3000, null, 'portalAdmin', t1); const x2 = await rpc(3000, null, 'portalAdmin', t1);
    ok('a ticket used once only', x.result && Array.isArray(x.result.cars) && /used|once|already/i.test(x2.error || ''), [x.error, x2.error]);
    // ---- removed: the car's line only; the files stay; the other cars keep theirs ----
    r = await portal('/api/admin', { action: 'carPhotoRemove', site: 'T2', no: 'HO-2-212', was: shaOf(jpg('ct')).slice(-16) });
    ok('the Super Admin removes the photo of HO-2-212', r.status === 200 && r.ok && r.photo === null, r);
    ok('   its files stay in the store; HO-1B-212 keeps its photo', fs.existsSync(STORE2 + '/car/' + shaOf(jpg('c')).slice(0, 2) + '/' + shaOf(jpg('c')) + '.jpg') && !kv().HO2212 && !!kv().HO1B212);
    r = await api('carPhotoRemove', { no: 'HO-2-212' });
    ok('   nothing left to remove: said so', /HO-2-212 has no photo to remove/.test(r.ERROR || ''), r);
    // ---- every other site: refused; nothing of S1 changed ----
    r = await s1api('getCarPhotoLinks', {}); ok('S1 (diesel stock): new links refused', /This site is not on fuel cards/.test(r.ERROR || ''), r);
    r = await s1api('carPhotoSet', { no: 'X', full: durl(jpg('s1')), thumb: durl(jpg('s1t')) }); ok('S1: a photo refused (its Admin)', /This site is not on fuel cards/.test(r.ERROR || ''), r);
    r = await s1api('getCarDetail', { no: 'X' }); ok('S1: a car\'s details refused', /This site is not on fuel cards/.test(r.ERROR || ''), r);
    r = await portal('/api/admin', { action: 'carPhotos', site: 'S1' }); ok('Portal: S1\'s Vehicle photos refused by its Mechanical', r.status === 400 && /This site is not on fuel cards/.test(r.error || ''), r);
    const s1d = await s1api('getDashboard', { from: today, to: today });
    ok('S1\'s Dashboard as before (its tanks and places)', s1d && s1d.tanks && Array.isArray(s1d.locations), Object.keys(s1d || {}));
    ok('S1\'s database not touched (machinery, diesel, Log Book, settings – counts and last change)', counts('rcl') === s1Before && !sql('rcl', "select id from app_settings where id = 'CAR_PHOTOS'"), [s1Before, counts('rcl')]);
    ok('S1\'s settings not touched (its fuel mode, cards, places; no car photos)', JSON.stringify(['FUEL_MODE', 'FUEL_CARDS', 'DIESEL_PLACES', 'CAR_PHOTOS'].map(k => propsOf('rcl')[k])) === s1Props);
    ok('no file of the store was deleted (only added under car/)', !/DELETE/.test(fs.readFileSync('/home/claude/rig/proxy3102.log', 'utf8').split('\n').filter(l => /storage/.test(l)).join('\n')));
  } catch (e) { ok('the test ran to its end', false, String(e && e.stack || e)); }
  finally {
    // ---- T2 back as it was: this test's cars, entries, photos' settings and files; its settings ----
    const ids = CARS.map(c => "'" + c + "'").join(',');
    sql('rcl_s2', "delete from diesel_issue where machinery in (" + ids + "); delete from log_book where machinery in (" + ids + "); delete from master where id in (" + ids + "); delete from app_settings where id = 'CAR_PHOTOS'; delete from card_payments where card = 'HDFC 212'");
    const now2 = propsOf('rcl_s2');
    Object.keys(now2).forEach(k => { if (!(k in keepT2)) sql('rcl_s2', "delete from web.props where key = '" + k.replace(/'/g, "''") + "'"); });
    Object.keys(keepT2).forEach(k => { if (now2[k] !== keepT2[k]) sql('rcl_s2', "update web.props set value = '" + String(keepT2[k]).replace(/'/g, "''") + "' where key = '" + k.replace(/'/g, "''") + "'"); });
    const vk = viewKeep.split('|');
    sql('rcl_s2', "update app_users set perm_dashboard = '" + vk[0] + "', perm_log_book = '" + vk[1] + "', perm_maintenance = '" + vk[2] + "', perm_reports = '" + vk[3] + "' where email = 'view@rcl.test'; delete from web.cache where key = 'USERS_LIST'");
    sql('rcl', "delete from rcl_user_sites where site = 'T2' and email in ('sujit@rcl.test', 'view@rcl.test')");
    try { execSync('find ' + STORE2 + '/car -type f -newer /home/claude/rig/postgrest2.conf -delete'); } catch (e) { /* the rig's own test files only */ }
    console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }
})();
