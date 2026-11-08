/* update-112 – the language of the app is the person's: chosen at one site, written at his other sites. Local rig only:
 * S1 = database rcl, T2 = database rcl_s2, app server :3001. Test data only; his settings at both sites are put back.
 *      node test/lang112api.js */
const { execSync } = require('child_process');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, x) => { c ? pass++ : fail++; out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const sql = (db, q) => execSync('timeout 60 su postgres -c "psql -d ' + db + ' -tA -q"', { input: q }).toString().trim();
const call = async (site, fn, ...args) => { const b = { fn, args }; if (site) b.site = site;
  const r = await fetch('http://127.0.0.1:3001/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(120000) }); return r.json(); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const KEY = "USER_PREFS|sujit@rcl.test";
const lang = db => { const v = sql(db, "select value from app_settings where id = '" + KEY + "'"); try { const j = JSON.parse(v || '{}'); return (j.appLang || '') + '|' + (j.lang || ''); } catch (e) { return '?'; } };
(async () => {
  const keep = {}; for (const db of ['rcl', 'rcl_s2']) keep[db] = sql(db, "select coalesce(value,'') from app_settings where id = '" + KEY + "'");
  try {
    sql('rcl', "insert into rcl_user_sites (email, site, is_admin, is_default) values ('sujit@rcl.test', 'T2', true, false) on conflict (email, site) do nothing");
    ok('sujit is a user at T2 too', sql('rcl_s2', "select count(*) from app_users where email = 'sujit@rcl.test'") === '1');
    await wait(16500);
    const s1 = (await call(null, 'login', 'sujit@rcl.test', 'Nashik#Road848!')).result.token;
    let r = await call('S1', 'api', s1, 'saveMyPrefs', [{ appLang: 'hi', lang: 'hi' }]);
    ok('Hindi chosen at S1: saved there', r.result && r.result.prefs.appLang === 'hi' && lang('rcl') === 'hi|hi', r.error || lang('rcl'));
    ok('   and written at T2 (his other site)', lang('rcl_s2') === 'hi|hi', lang('rcl_s2'));
    const t2 = (await call(null, 'switchSite', s1, 'T2')).result.token;
    r = await call('T2', 'api', t2, 'saveMyPrefs', [{ appLang: 'en', lang: 'en' }]);
    ok('English chosen at T2 ("en"): back at S1 too', lang('rcl_s2') === 'en|en' && lang('rcl') === 'en|en', [lang('rcl'), lang('rcl_s2')]);
    r = await call('T2', 'api', t2, 'saveMyPrefs', [{ theme: 'dark' }]);
    ok('another setting at T2 stays at T2 (the language as it was at S1)', JSON.parse(sql('rcl_s2', "select value from app_settings where id = '" + KEY + "'")).theme === 'dark' && (JSON.parse(sql('rcl', "select value from app_settings where id = '" + KEY + "'") || '{}').theme || 'light') !== 'dark');
  } catch (e) { ok('run', false, String(e && e.stack || e).slice(0, 500)); }
  finally {
    for (const db of ['rcl', 'rcl_s2']) { if (keep[db]) sql(db, "update app_settings set value = '" + keep[db].replace(/'/g, "''") + "' where id = '" + KEY + "'"); else sql(db, "delete from app_settings where id = '" + KEY + "'"); }
    sql('rcl', "delete from rcl_user_sites where email = 'sujit@rcl.test' and site = 'T2'");
  }
  console.log(out.join('\n')); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
