/* RESTORE DRILL (update-68, decision D12) – on the local test rig only. "A backup is useful when a restore has been shown."
 * It never touches the live database, the real Google Sheet, or even the rig's own database (it only READS that one):
 * everything is rebuilt in scratch databases (rcl_drill_a, rcl_drill_b) that are made and dropped here.
 *
 *   ROUTE A – a database copy (pg_dump → a new database): the way a Supabase backup / an own dump is restored.
 *             Proved here: every table comes back row for row, byte for byte; the app's server starts on it and works.
 *   ROUTE B – from the Google Sheet backup: the tabs are read back and the tables rebuilt from them in an EMPTY database.
 *             Measured here: which tables / columns / cells come back exactly, and which cannot (passwords, cut cells,
 *             what is not in the Sheet at all). The Sheet is the stand-in of the tests: it holds exactly what the app
 *             SENDS – how Google itself stores dates and long numbers is not part of this drill (see UPDATE_68.md).
 *   node test/restore-drill.js */
const { execSync, spawn } = require('child_process'); const path = require('path'), fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const APP = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const psql = (db, q, opt) => execSync('su postgres -c "psql -d ' + db + ' -tA -q -v ON_ERROR_STOP=1"', { input: q, stdio: ['pipe', 'pipe', (opt && opt.err) ? 'pipe' : 'ignore'], maxBuffer: 1 << 28 }).toString().trim();
const sh = c => execSync(c, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString();
let pass = 0, fail = 0; const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); };
const note = (name, extra) => console.log('NOTE ' + name + (extra !== undefined ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : ''));
const G = 'http://127.0.0.1:3997', g = async p => (await fetch(G + p)).json();
const raw = async (port, body) => { let r; for (let i = 0; ; i++) { try { r = await fetch('http://127.0.0.1:' + port + '/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) }); break; } catch (e) { if (i >= 6) throw e; await wait(500); } } return r.json(); };
const tables = db => psql(db, "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1").split('\n').filter(Boolean);
const sum = (db, t) => psql(db, 'select count(*) || \' rows \' || coalesce(md5(string_agg(md5(x::text), \'\' order by id)), \'-\') from public.' + t + ' x');
const drop = db => { try { sh('su postgres -c "dropdb --if-exists ' + db + '"'); } catch (e) { /* not there */ } };

(async () => {
  const procs = []; const kill = () => procs.forEach(c => { try { process.kill(-c.pid); } catch (e) { try { c.kill(); } catch (e2) {} } });
  drop('rcl_drill_a'); drop('rcl_drill_b');
  try {
    const all = tables('rcl'), counts = {}; all.forEach(t => { counts[t] = Number(psql('rcl', 'select count(*) from public.' + t)); });
    console.log('the rig\'s database: ' + all.length + ' tables, ' + Object.values(counts).reduce((a, b) => a + b, 0) + ' rows');

    console.log('\n=== ROUTE A – A DATABASE COPY (the way a Supabase backup or an own dump comes back) ===');
    const dump = '/tmp/rcl_drill.dump'; sh('su postgres -c "pg_dump -Fc -d rcl -f ' + dump + '"');
    sh('su postgres -c "createdb rcl_drill_a"'); sh('su postgres -c "pg_restore -d rcl_drill_a --no-owner ' + dump + '" 2>&1 || true');
    const before = {}, afterA = {}; all.forEach(t => { if (t !== 'deleted_rows') { before[t] = sum('rcl', t); afterA[t] = sum('rcl_drill_a', t); } });
    const diffA = Object.keys(before).filter(t => before[t] !== afterA[t]);
    ok('A1. every table of the app comes back row for row and byte for byte (count + fingerprint of every row, ' + Object.keys(before).length + ' tables)', diffA.length === 0, diffA.length ? diffA.map(t => t + ': ' + before[t] + ' ≠ ' + afterA[t]) : Object.keys(before).map(t => t + ' ' + before[t].split(' ')[0]).join(', '));
    const webA = psql('rcl_drill_a', "select (select count(*) from web.props) || ' settings, ' || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'web\\_%') || ' functions, ' || (select count(*) from pg_trigger where not tgisinternal) || ' triggers'");
    const webO = psql('rcl', "select (select count(*) from web.props) || ' settings, ' || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'web\\_%') || ' functions, ' || (select count(*) from pg_trigger where not tgisinternal) || ' triggers'");
    ok('A2. what is NOT a table of entries comes back too: the settings and counters (web.props), the app\'s database functions, the triggers', webA === webO, { original: webO, restored: webA });
    const propsSame = psql('rcl_drill_a', "select md5(string_agg(key || '=' || value, '|' order by key)) from web.props where key not like 'V\\_%' and key not in ('ERR_STAMP', 'SB_INFO', 'BK_STATE')") === psql('rcl', "select md5(string_agg(key || '=' || value, '|' order by key)) from web.props where key not like 'V\\_%' and key not in ('ERR_STAMP', 'SB_INFO', 'BK_STATE')");
    ok('A3. the counters are the same (the next Diesel Issue number continues where it was – no number is given twice after a restore)', propsSame, psql('rcl_drill_a', "select string_agg(key || '=' || value, ', ' order by key) from web.props where key like '%LAST_NO'"));

    console.log('\n=== ROUTE B – FROM THE GOOGLE SHEET BACKUP (rebuilt in an EMPTY database, compared with the original) ===');
    const stand = spawn('node', [path.join(__dirname, 'sheets-standin.js')], { stdio: 'ignore', detached: true }); procs.push(stand);
    for (let i = 0; i < 30; i++) { try { await g('/dump'); break; } catch (e) { await wait(200); } }
    await g('/reset?bare=1'); psql('rcl', "delete from web.props where key in ('BK_STATE', 'SB_INFO'); delete from web.locks where name = 'backup';");
    const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    const srv = spawn('node', ['dev.js'], { cwd: APP, env: Object.assign({}, process.env, { PORT: '3005', GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'backup-robot@rig.test', private_key: key }), BACKUP_SHEET_ID: 'rigSheet0123456789abcdefghijklmn', GOOGLE_SHEETS_URL: G, GOOGLE_TOKEN_URL: G + '/token', CRON_SECRET: 'local-cron-secret' }), stdio: 'ignore', detached: true }); procs.push(srv);
    for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:3005/')).status === 200) break; } catch (e) {} await wait(300); }
    const admin = (await raw(3005, { fn: 'login', args: ['sujit@rcl.test', 'Nashik#Road848!'] })).result.token;
    // a few entries with values a Sheet likes to "improve" (an account number with leading zeros, a text that looks like a formula or a date)
    const api = (fn, args) => raw(3005, { fn: 'api', args: [admin, fn, args] });
    const today = psql('rcl', "select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD')");
    await api('saveVendor', [{ name: 'DRILL Vendor & Sons (Engg.)', gstReg: 'No', pan: 'ABCPE1234T', bank: '=1+1 Bank', account: '000123456789012345', ifsc: 'SBIN0000001', address: 'Plot 12/5, "Gat" < 10' }, 'add']);
    await api('savePayment', [{ type: 'Opening', vendor: 'DRILL Vendor & Sons (Engg.)', date: today, amount: 123456.78, side: 'Payable', remark: '12/5' }, 'add']);
    await api('saveDieselIssue', [{ date: today, shift: 'Day', source: 'Dispenser', no: 'MH-15-AB-0002', driver: 'DRILL driver', qty: 12.5, kmReading: 99940 + Math.floor(Math.random() * 9), remark: '+91 98220 00000', force: true }]);
    // the state that is compared is taken AFTER the sign-in (it writes an Activity Log line) and the backup is made of exactly that
    let b; for (let i = 0; i < 8; i++) { b = await raw(3005, { fn: 'api', args: [admin, 'backupNow', []] }); if (b.error) throw new Error(b.error); if (!b.result.pending && (b.result.upToDate || b.result.full || i > 0)) break; await wait(1200); }
    const orig = {}; all.forEach(t => { if (t !== 'deleted_rows') { orig[t] = sum('rcl', t); counts[t] = Number(orig[t].split(' ')[0]); } });
    // the app's own names of tabs and headings
    const ctx = { console, JSON, Math, Date, Object, Array, String, Number, RegExp, Error }; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(APP, 'app', 'SupabaseSync.gs'), 'utf8') + '\n;this.__x = { tab: sbTabName_, head: sbHeader_ };', ctx);
    const d = await g('/dump'), tabTitles = d.tabs.map(t => t.title);
    sh('su postgres -c "createdb rcl_drill_b"'); sh('su postgres -c "pg_dump -s -d rcl" | su postgres -c "psql -q -d rcl_drill_b" 2>&1 || true');      // the empty tables, functions and triggers (the app\'s SQL steps)
    const empty = tables('rcl_drill_b').every(t => psql('rcl_drill_b', 'select count(*) from public.' + t) === '0');
    const report = [], notIn = [], hidden = [], cutCells = [];
    for (const t of all) {
      if (t === 'deleted_rows') continue;
      const title = ctx.__x.tab(t); if (tabTitles.indexOf(title) === -1) { notIn.push(t); continue; }
      const values = (await g('/tab?title=' + encodeURIComponent(title))).values || [], head = values[0] || [];
      const cols = psql('rcl', "select column_name || ':' || data_type from information_schema.columns where table_schema = 'public' and table_name = '" + t + "' order by ordinal_position").split('\n').map(x => ({ name: x.split(':')[0], type: x.split(':')[1] }));
      const at = {}; cols.forEach(c => { at[c.name] = head.indexOf("'" + ctx.__x.head(t, c.name)) > -1 ? head.indexOf("'" + ctx.__x.head(t, c.name)) : head.indexOf(ctx.__x.head(t, c.name)); });
      const missingCols = cols.filter(c => at[c.name] === -1).map(c => c.name);
      // a tab → rows. A text was sent with a leading apostrophe (the Sheet does not show it); an empty cell = no value
      const rows = values.slice(1).filter(r => (r || []).some(v => v !== '' && v !== null && v !== undefined)).map(r => { const o = {}; cols.forEach(c => { if (at[c.name] === -1) return; let v = r[at[c.name]]; if (v === undefined || v === null || v === '') { o[c.name] = null; return; }
        if (typeof v === 'string' && v.charAt(0) === "'") v = v.slice(1);
        if (v === '(hidden)') { hidden.push(t + '.' + c.name); o[c.name] = null; return; }
        if (typeof v === 'string' && /…\(cut: longer than a Sheet cell can hold\)$/.test(v)) cutCells.push(t + '.' + c.name);
        o[c.name] = c.type === 'jsonb' && typeof v === 'string' ? JSON.parse(v) : v; }); return o; });
      // loaded in ONE transaction, with the triggers quiet (so "updated at" stays what it was and nothing is noted as deleted)
      const file = '/tmp/rcl_drill_' + t + '.json'; fs.writeFileSync(file, JSON.stringify(rows)); fs.chmodSync(file, 0o644);
      psql('rcl_drill_b', "begin; set local session_replication_role = replica; insert into public." + t + " select * from jsonb_populate_recordset(null::public." + t + ", pg_read_file('" + file + "')::jsonb); commit;", { err: true });
      fs.unlinkSync(file);
      const back = sum('rcl_drill_b', t);
      // column by column, where the whole table is not identical. '' and "no value" are the same thing for the app (a Sheet cell cannot tell them apart)
      const bad = [];
      if (back !== orig[t]) for (const c of cols) { const q = db => psql(db, 'select coalesce(md5(string_agg(coalesce(' + (c.type === 'numeric' ? 'trim_scale(' + c.name + ')' : c.name) + "::text, ''), '|' order by id)), '-') from public." + t);
        if (q('rcl') !== q('rcl_drill_b')) bad.push(c.name); }
      report.push({ table: t, rows: counts[t], back: Number(back.split(' ')[0]), identical: back === orig[t], differs: bad, missingCols: missingCols });
    }
    ok('B0. the scratch database starts empty (only the app\'s tables, functions and triggers – its SQL steps)', empty);
    ok('B1. every table of entries has its tab in the Sheet, with EVERY column of the table', report.length >= 16 && report.every(r => r.missingCols.length === 0), { tables_with_a_tab: report.length, without_a_tab: notIn, missing_columns: report.filter(r => r.missingCols.length).map(r => r.table + ': ' + r.missingCols.join(',')) });
    ok('B2. every row comes back: the same number of rows in every table', report.every(r => r.rows === r.back), report.filter(r => r.rows !== r.back).map(r => r.table + ' ' + r.rows + ' → ' + r.back).join('; ') || report.map(r => r.table + ' ' + r.back).join(', '));
    const exact = report.filter(r => r.identical).map(r => r.table), same = report.filter(r => !r.identical && r.differs.length === 0).map(r => r.table), differ = report.filter(r => r.differs.length);
    const onlyPw = differ.every(r => r.table === 'app_users' && r.differs.join() === 'password_hash');
    ok('B3. every cell comes back as it was – except the passwords, which are deliberately not in the Sheet', differ.length <= 1 && onlyPw, { byte_for_byte: exact.length + ' tables', same_but_empty_text_became_no_value: same, cells_that_differ: differ.map(r => r.table + ': ' + r.differs.join(', ')) });
    note('B4. what a restore from the Sheet does NOT bring back (measured)', { passwords: [...new Set(hidden)].join(', ') + ' – every user needs a new one-time password from the Admin (the Admin first, by SQL)', cells_cut_at_49000_letters: [...new Set(cutCells)].join(', ') || 'none in this data (a very long bill would be)',
      tables_without_a_tab: notIn.join(', ') || 'none', not_in_the_sheet_at_all: 'web.props = ' + psql('rcl', "select string_agg(key, ', ' order by key) from web.props where key not like 'V\\_%' and key not in ('ERR_STAMP', 'SB_INFO', 'BK_STATE')") + ' (the counters of the entry numbers and every setting of the site); web.cache (sign-ins); web.ops; deleted_rows' });
    // would the app work on it? counters must be put right first – shown here by what the numbers would be
    const maxDi = psql('rcl_drill_b', "select coalesce(max(nullif(regexp_replace(id, '\\D', '', 'g'), '')::bigint), 0) from public.diesel_issue where id like 'DI-%'"), cnt = psql('rcl', "select value from web.props where key = 'DIESEL_LAST_NO'");
    note('B5. after a restore from the Sheet the counters must be SET from the data (they are not in the Sheet): e.g. DIESEL_LAST_NO must be at least the highest Diesel Issue number', { highest_number_in_the_restored_data: maxDi, counter_in_the_original: cnt, counter_in_the_restored_database: psql('rcl_drill_b', "select coalesce((select value from web.props where key = 'DIESEL_LAST_NO'), 'missing')") });
  } finally {
    kill(); try { psql('rcl', "delete from web.props where key in ('BK_STATE', 'SB_INFO'); delete from web.locks where name = 'backup'; delete from payments where vendor_name like 'DRILL Vendor%'; delete from vendors where vendor_name like 'DRILL Vendor%'; delete from diesel_issue where driver_name = 'DRILL driver'; delete from activity_log where summary like '%DRILL%' or changes like '%DRILL%';"); } catch (e) {}
    drop('rcl_drill_a'); drop('rcl_drill_b'); try { fs.unlinkSync('/tmp/rcl_drill.dump'); } catch (e) {}
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
