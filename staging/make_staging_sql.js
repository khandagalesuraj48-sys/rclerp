'use strict';
/* THE STAGING DATABASE – one SQL file for a NEW, EMPTY Supabase project "rcl-staging" (asked 20-10-2026: "Staging database: HE 2
 * KR PERFECT"; his choices: Mechanical + Portal + Store in it, empty + a few TEST entries).
 *
 *   node staging/make_staging_sql.js            → writes staging/rcl_staging_all.sql (from the files below; nothing else)
 *   node staging/make_staging_sql.js --check    → only says whether that file is up to date (the unit test does the same)
 *
 * What goes in, in this order:
 *   1. the three lines HE types (his e-mail, name and a one-time password for the TEST Portal) – checked first: nothing runs
 *      while they are not typed;
 *   2. the guard: a database that already has tables of Mechanical, the Portal or the Store and is NOT marked as the test one
 *      (the live one) is refused – nothing runs;
 *   3. every SQL step of Mechanical from Read Me (README_SQL_ in app/ReadMe.gs – the same list as "New site"), without
 *      step 6 (keep-awake: it calls the LIVE address every few minutes); the test mark right after step 1; the TEST company and
 *      site name before step 7 (step 7 names site S1 from it);
 *   4. the Store's SQL (../rcl-store/sql/store_step1_items.sql);
 *   5. the Portal's SQL (../rcl-portal/sql/portal_step1.sql, step 2, step 3) – its tables have other names than Mechanical's
 *      and the Store's, so the three live in one project;
 *   6. the TEST entries (all made up, every name says TEST): 1 vendor and 3 machinery (Mechanical), 3 items (Store), the TEST
 *      company, site S1, the two modules with the staging addresses, and HIM as the Super Admin (his one-time password).
 * The other repositories are read from the folders next to this one (or --store <dir> --portal <dir>). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = path.join(__dirname, 'rcl_staging_all.sql');

// the addresses of the staging copies: the Preview of the branch "staging" in each Vercel project (team pk12356843). The Portal
// and the Store are served under Mechanical's staging address (/portal, /store – vercel.json), exactly as live.
const HOST = 'rclerp-git-staging-pk12356843.vercel.app';
const MECH = 'https://' + HOST, STORE_AT = MECH + '/store';

function readmeSteps() {
  const s = fs.readFileSync(path.join(root, 'app', 'ReadMe.gs'), 'utf8'), i = s.indexOf('const README_SQL_ = [');
  if (i < 0) throw new Error('README_SQL_ not found in app/ReadMe.gs');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(s.slice(i).replace('const README_SQL_ =', 'this.R ='), ctx);
  return ctx.R.map(x => ({ name: x.name, sql: x.sql }));
}
const file = (dir, name) => ({ name: name, sql: fs.readFileSync(path.join(dir, 'sql', name), 'utf8') });

function build(storeDir, portalDir) {
  const mech = readmeSteps(), skipped = mech.filter(x => /step6_keep_awake/.test(x.name)).map(x => x.name);
  const steps = mech.filter(x => !/step6_keep_awake/.test(x.name));
  const store = [file(storeDir, 'store_step1_items.sql')];
  const portal = ['portal_step1.sql', 'portal_step2_start.sql', 'portal_step3_pages.sql'].map(n => file(portalDir, n));
  const part = (who, x) => '-- ===================== ' + who + ': ' + x.name + ' =====================\n' + x.sql.replace(/\s+$/, '') + '\n';
  const out = [];
  out.push(HEAD);
  steps.forEach(x => {
    if (/step7_sites/.test(x.name)) out.push(ORG);
    out.push(part('MECHANICAL', x));
    if (x.name === 'supabase_step1.sql') out.push(MARK);
  });
  store.forEach(x => out.push(part('STORE', x)));
  portal.forEach(x => out.push(part('PORTAL', x)));
  out.push(SEED);
  return { sql: out.join('\n'), mech: steps.map(x => x.name), skipped: skipped, store: store.map(x => x.name), portal: portal.map(x => x.name) };
}

const HEAD = `-- =====================================================================================================================
-- RCL ERP – THE STAGING (TEST) DATABASE: Mechanical + Portal + Store in ONE new Supabase project "rcl-staging".
-- Made by staging/make_staging_sql.js – do not edit by hand. The guide: staging/STAGING_SETUP.md.
--
-- Run it ONLY in the NEW, EMPTY project "rcl-staging" (Supabase → that project → SQL Editor → New query → paste → Run).
-- A database that already has the ERP's tables and is not marked as the TEST one (the LIVE one) is refused: nothing runs.
-- It can be run again in the staging project safely (it only adds what is missing; a TEST entry already there is kept).
-- Every name in it is made up (TEST …). Not one row of the live databases is in it.
-- =====================================================================================================================

-- ▶▶▶ TYPE YOUR OWN 3 VALUES HERE, between the ' ' (the TEST Portal's Super Admin), then press Run:
create temp table if not exists staging_you (what text primary key, val text);
delete from staging_you;
insert into staging_you (what, val) values
  ('email',    'TYPE-YOUR-EMAIL-HERE'),
  ('name',     'TYPE-YOUR-NAME-HERE'),
  ('password', 'TYPE-A-ONE-TIME-PASSWORD-HERE');      -- 8 or more; the TEST Portal asks for your own one at the first sign-in
-- ◀◀◀ nothing below needs to be changed

do $$
declare e text; n text; p text; marked boolean := false;
begin
  select val into e from staging_you where what = 'email';
  select val into n from staging_you where what = 'name';
  select val into p from staging_you where what = 'password';
  if coalesce(e, '') like 'TYPE-%' or coalesce(n, '') like 'TYPE-%' or coalesce(p, '') like 'TYPE-%' or position('@' in coalesce(e, '')) < 2
     or length(trim(coalesce(n, ''))) < 2 or length(coalesce(p, '')) < 8 then
    raise exception 'STOPPED – nothing was run: type your e-mail, your name and a one-time password (8 or more letters) in the first lines, then Run again.';
  end if;
  if to_regclass('public.app_settings') is not null then
    execute 'select exists (select 1 from public.app_settings where id = ''THIS_IS_A_TEST_DATABASE'' and value = ''yes'')' into marked;
  end if;
  if not marked and (to_regclass('public.master') is not null or to_regclass('public.app_users') is not null or to_regclass('public.items') is not null
                     or to_regclass('public.users') is not null or to_regclass('public.modules') is not null or to_regclass('public.rcl_sites') is not null) then
    raise exception 'STOPPED – nothing was run: this database already has tables of the ERP and it is not the TEST one. Run this file only in the NEW, EMPTY Supabase project "rcl-staging".';
  end if;
end $$;
`;

// right after step 1 (app_settings is there now): every server on a Preview checks this row before it reads or writes anything
const MARK = `-- ===================== THE TEST MARK =====================
-- The servers of a Preview (the staging copies) work ONLY with a database that has this row; the live databases never have it.
insert into public.app_settings (id, value) values ('THIS_IS_A_TEST_DATABASE', 'yes') on conflict (id) do update set value = 'yes';
`;

const ORG = `-- ===================== TEST: company and site name (before step 7, which names site S1 from it) =====================
insert into web.props (key, value) values ('ORG_SETTINGS',
  '{"customer":"TEST Co","site":"TEST Site (staging)","logo":"","billNames":["TEST Co"],"intro":true,"video":""}')
on conflict (key) do nothing;
`;

const SEED = `-- ===================== TEST ENTRIES (all made up) =====================
-- Mechanical: one vendor and three machinery of that vendor (on site from the 1st of this month)
insert into public.vendors (id, vendor_name, ownership, gst_registered, pan_number, bank_name, account_number, ifsc_code, entered_at, entered_by, owner_site)
values ('TEST VENDOR A', 'Test Vendor A', 'Rental', 'No', 'TESTV1234A', 'TEST BANK', '000011112222', 'TEST0000001', now(), 'TEST (staging)', 'S1')
on conflict (id) do nothing;
insert into public.master (id, machinery_number, machinery_name, type, unit, works_on, std_km_per_ltr, std_ltr_per_hr, owner_name, ownership, diesel_supply, status, active_from, entered_by)
values ('TEST-JCB-01',    'TEST-JCB-01',    'JCB (TEST)',       'JCB',        'Hrs', 'Hrs', null, 5,    'Test Vendor A', 'Rental', 'Company', 'Active', date_trunc('month', current_date)::date, 'TEST (staging)'),
       ('TEST-TIPPER-01', 'TEST-TIPPER-01', 'Tipper (TEST)',    'Tipper',     'KM',  'KM',  3,    null, 'Test Vendor A', 'Rental', 'Company', 'Active', date_trunc('month', current_date)::date, 'TEST (staging)'),
       ('TEST-EXC-01',    'TEST-EXC-01',    'Excavator (TEST)', 'Excavator',  'Hrs', 'Hrs', null, 12,   'Test Vendor A', 'Rental', 'Company', 'Active', date_trunc('month', current_date)::date, 'TEST (staging)')
on conflict (id) do nothing;

-- Store: three items (Item Master)
insert into public.items (code, name, name_key, unit, category, status, created_by)
values ('ITM-0001', 'Cement Bag (TEST)',      'cementbagtest',      'Bag', 'Civil',      'Active', 'TEST (staging)'),
       ('ITM-0002', 'Diesel Filter (TEST)',   'dieselfiltertest',   'Nos', 'Spares',     'Active', 'TEST (staging)'),
       ('ITM-0003', 'Steel Bar 12mm (TEST)',  'steelbar12mmtest',   'Kg',  'Steel',      'Active', 'TEST (staging)')
on conflict (code) do nothing;

-- Portal: the TEST company, site S1 (the same code as Mechanical's first site), the modules at the staging addresses, and the
-- Super Admin (the values typed at the top; the password is a one-time one – the Portal asks for his own at the first sign-in)
insert into public.companies (id, name) values ('TESTCO', 'TEST Co') on conflict (id) do nothing;
insert into public.sites (code, name, company_id, status, sort) values ('S1', 'TEST Site (staging)', 'TESTCO', 'active', 1) on conflict (code) do nothing;
update public.modules set url = '${MECH}', status = 'live' where key = 'mechanical' and coalesce(url, '') = '';
insert into public.modules (key, name, url, status, sort) values ('store', 'Store', '${STORE_AT}', 'live', 2) on conflict (key) do nothing;
insert into public.users (email, name, password_hash, active, is_super)
select lower(trim((select val from staging_you where what = 'email'))), trim((select val from staging_you where what = 'name')),
       (select val from staging_you where what = 'password'), true, true
 where not exists (select 1 from public.users where is_super)
on conflict (email) do nothing;

notify pgrst, 'reload schema';

-- what is there now (a look – it changes nothing)
select 'TEST database ready · test mark: ' || (select value from public.app_settings where id = 'THIS_IS_A_TEST_DATABASE')
       || ' · machinery ' || (select count(*) from public.master) || ' · vendors ' || (select count(*) from public.vendors)
       || ' · items ' || (select count(*) from public.items) || ' · sites ' || (select count(*) from public.rcl_sites)
       || ' · Portal sites ' || (select count(*) from public.sites) || ' · modules ' || (select string_agg(key || ' ' || status, ', ' order by sort) from public.modules)
       || ' · Super Admin ' || coalesce((select email from public.users where is_super), 'NONE') as done;
`;

module.exports = { build, HOST, MECH };

if (require.main === module) {
  const storeDir = path.resolve(arg('--store', path.join(root, '..', 'rcl-store'))), portalDir = path.resolve(arg('--portal', path.join(root, '..', 'rcl-portal')));
  const b = build(storeDir, portalDir);
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== b.sql) { console.log('staging/rcl_staging_all.sql is NOT up to date – run: node staging/make_staging_sql.js'); process.exit(1); }
    console.log('staging/rcl_staging_all.sql is up to date'); process.exit(0);
  }
  fs.writeFileSync(OUT, b.sql);
  console.log('written ' + path.relative(root, OUT) + ' (' + b.sql.length + ' characters): Mechanical ' + b.mech.length + ' steps (left out: ' + b.skipped.join(', ') +
    '), Store ' + b.store.join(', ') + ', Portal ' + b.portal.join(', ') + ' + the TEST entries');
}
