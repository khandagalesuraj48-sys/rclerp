-- =====================================================================================================================
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

-- ===================== MECHANICAL: supabase_step1.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Supabase database (step 1)
-- Run once in Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run again (it only adds what is missing).
-- =====================================================================

-- every change keeps "updated_at"; every delete is noted for the backup copy
create table if not exists public.deleted_rows (
  seq bigserial primary key,
  table_name text not null,
  row_id text not null,
  deleted_at timestamptz not null default now()
);
create index if not exists deleted_rows_at on public.deleted_rows (deleted_at);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.note_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.deleted_rows (table_name, row_id) values (tg_table_name, old.id::text); return old; end $$;

-- settings (tank sizes and similar)
create table if not exists public.app_settings (
  id text primary key,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Master
create table if not exists public.master (
  id text primary key,
  machinery_number text,
  machinery_name text,
  type text,
  make text,
  unit text,
  std_km_per_ltr numeric,
  std_ltr_per_hr numeric,
  owner_name text,
  ownership text,
  diesel_supply text,
  status text,
  active_from date,
  inactive_from date,
  tank_capacity numeric,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.master add column if not exists machinery_number text;
alter table public.master add column if not exists machinery_name text;
alter table public.master add column if not exists type text;
alter table public.master add column if not exists make text;
alter table public.master add column if not exists unit text;
alter table public.master add column if not exists std_km_per_ltr numeric;
alter table public.master add column if not exists std_ltr_per_hr numeric;
alter table public.master add column if not exists owner_name text;
alter table public.master add column if not exists ownership text;
alter table public.master add column if not exists diesel_supply text;
alter table public.master add column if not exists status text;
alter table public.master add column if not exists active_from date;
alter table public.master add column if not exists inactive_from date;
alter table public.master add column if not exists tank_capacity numeric;
alter table public.master add column if not exists extra jsonb;

-- Diesel Inward
create table if not exists public.diesel_inward (
  id text primary key,
  date date,
  location text,
  pump_name text,
  qty numeric,
  rate numeric,
  amount numeric,
  bill_number text,
  bill_date date,
  balance numeric,
  entered_at timestamptz,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.diesel_inward add column if not exists date date;
alter table public.diesel_inward add column if not exists location text;
alter table public.diesel_inward add column if not exists pump_name text;
alter table public.diesel_inward add column if not exists qty numeric;
alter table public.diesel_inward add column if not exists rate numeric;
alter table public.diesel_inward add column if not exists amount numeric;
alter table public.diesel_inward add column if not exists bill_number text;
alter table public.diesel_inward add column if not exists bill_date date;
alter table public.diesel_inward add column if not exists balance numeric;
alter table public.diesel_inward add column if not exists entered_at timestamptz;
alter table public.diesel_inward add column if not exists extra jsonb;

-- Diesel Transfer
create table if not exists public.diesel_transfer (
  id text primary key,
  date date,
  shift text,
  from_location text,
  to_location text,
  qty numeric,
  remark text,
  from_balance numeric,
  to_balance numeric,
  entered_at timestamptz,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.diesel_transfer add column if not exists date date;
alter table public.diesel_transfer add column if not exists shift text;
alter table public.diesel_transfer add column if not exists from_location text;
alter table public.diesel_transfer add column if not exists to_location text;
alter table public.diesel_transfer add column if not exists qty numeric;
alter table public.diesel_transfer add column if not exists remark text;
alter table public.diesel_transfer add column if not exists from_balance numeric;
alter table public.diesel_transfer add column if not exists to_balance numeric;
alter table public.diesel_transfer add column if not exists entered_at timestamptz;
alter table public.diesel_transfer add column if not exists extra jsonb;

-- Diesel Issue
create table if not exists public.diesel_issue (
  id text primary key,
  issue_date date,
  shift text,
  source text,
  machinery text,
  type text,
  owner_name text,
  qty numeric,
  km_reading numeric,
  hrs_reading numeric,
  driver_name text,
  remark text,
  diesel_supply text,
  debit_rate numeric,
  balance numeric,
  dispenser_reading numeric,
  entered_at timestamptz,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.diesel_issue add column if not exists issue_date date;
alter table public.diesel_issue add column if not exists shift text;
alter table public.diesel_issue add column if not exists source text;
alter table public.diesel_issue add column if not exists machinery text;
alter table public.diesel_issue add column if not exists type text;
alter table public.diesel_issue add column if not exists owner_name text;
alter table public.diesel_issue add column if not exists qty numeric;
alter table public.diesel_issue add column if not exists km_reading numeric;
alter table public.diesel_issue add column if not exists hrs_reading numeric;
alter table public.diesel_issue add column if not exists driver_name text;
alter table public.diesel_issue add column if not exists remark text;
alter table public.diesel_issue add column if not exists diesel_supply text;
alter table public.diesel_issue add column if not exists debit_rate numeric;
alter table public.diesel_issue add column if not exists balance numeric;
alter table public.diesel_issue add column if not exists dispenser_reading numeric;
alter table public.diesel_issue add column if not exists entered_at timestamptz;
alter table public.diesel_issue add column if not exists extra jsonb;

-- Log Book
create table if not exists public.log_book (
  id text primary key,
  date date,
  machinery text,
  shift text,
  owner_name text,
  type text,
  unit text,
  opening_km numeric,
  closing_km numeric,
  working_km numeric,
  opening_hrs numeric,
  closing_hrs numeric,
  working_hrs numeric,
  opening_diesel numeric,
  diesel_qty numeric,
  consumed_std numeric,
  closing_diesel numeric,
  std_km_per_ltr numeric,
  std_ltr_per_hr numeric,
  consumption_km numeric,
  consumption_hrs numeric,
  km_reading numeric,
  hrs_reading numeric,
  diesel_readings text,
  chainage_from text,
  chainage_to text,
  chainage_no text,
  work_done text,
  trip text,
  driver_name text,
  remark text,
  actual_average text,
  extra_short numeric,
  fill_cycle text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.log_book add column if not exists date date;
alter table public.log_book add column if not exists machinery text;
alter table public.log_book add column if not exists shift text;
alter table public.log_book add column if not exists owner_name text;
alter table public.log_book add column if not exists type text;
alter table public.log_book add column if not exists unit text;
alter table public.log_book add column if not exists opening_km numeric;
alter table public.log_book add column if not exists closing_km numeric;
alter table public.log_book add column if not exists working_km numeric;
alter table public.log_book add column if not exists opening_hrs numeric;
alter table public.log_book add column if not exists closing_hrs numeric;
alter table public.log_book add column if not exists working_hrs numeric;
alter table public.log_book add column if not exists opening_diesel numeric;
alter table public.log_book add column if not exists diesel_qty numeric;
alter table public.log_book add column if not exists consumed_std numeric;
alter table public.log_book add column if not exists closing_diesel numeric;
alter table public.log_book add column if not exists std_km_per_ltr numeric;
alter table public.log_book add column if not exists std_ltr_per_hr numeric;
alter table public.log_book add column if not exists consumption_km numeric;
alter table public.log_book add column if not exists consumption_hrs numeric;
alter table public.log_book add column if not exists km_reading numeric;
alter table public.log_book add column if not exists hrs_reading numeric;
alter table public.log_book add column if not exists diesel_readings text;
alter table public.log_book add column if not exists chainage_from text;
alter table public.log_book add column if not exists chainage_to text;
alter table public.log_book add column if not exists chainage_no text;
alter table public.log_book add column if not exists work_done text;
alter table public.log_book add column if not exists trip text;
alter table public.log_book add column if not exists driver_name text;
alter table public.log_book add column if not exists remark text;
alter table public.log_book add column if not exists actual_average text;
alter table public.log_book add column if not exists extra_short numeric;
alter table public.log_book add column if not exists fill_cycle text;
alter table public.log_book add column if not exists extra jsonb;

-- Tank Check
create table if not exists public.tank_check (
  id text primary key,
  date date,
  machinery text,
  system_diesel numeric,
  physical_diesel numeric,
  difference numeric,
  method text,
  litres_to_fill numeric,
  reason text,
  checked_by text,
  entered_at timestamptz,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tank_check add column if not exists date date;
alter table public.tank_check add column if not exists machinery text;
alter table public.tank_check add column if not exists system_diesel numeric;
alter table public.tank_check add column if not exists physical_diesel numeric;
alter table public.tank_check add column if not exists difference numeric;
alter table public.tank_check add column if not exists method text;
alter table public.tank_check add column if not exists litres_to_fill numeric;
alter table public.tank_check add column if not exists reason text;
alter table public.tank_check add column if not exists checked_by text;
alter table public.tank_check add column if not exists entered_at timestamptz;
alter table public.tank_check add column if not exists extra jsonb;

-- Users
create table if not exists public.app_users (
  id text primary key,
  email text,
  password_hash text,
  name text,
  active text,
  admin text,
  perm_dashboard text,
  perm_master text,
  perm_diesel_inward text,
  perm_diesel_transfer text,
  perm_diesel_issue text,
  perm_log_book text,
  perm_reports text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_users add column if not exists email text;
alter table public.app_users add column if not exists password_hash text;
alter table public.app_users add column if not exists name text;
alter table public.app_users add column if not exists active text;
alter table public.app_users add column if not exists admin text;
alter table public.app_users add column if not exists perm_dashboard text;
alter table public.app_users add column if not exists perm_master text;
alter table public.app_users add column if not exists perm_diesel_inward text;
alter table public.app_users add column if not exists perm_diesel_transfer text;
alter table public.app_users add column if not exists perm_diesel_issue text;
alter table public.app_users add column if not exists perm_log_book text;
alter table public.app_users add column if not exists perm_reports text;
alter table public.app_users add column if not exists extra jsonb;

-- Activity Log
create table if not exists public.activity_log (
  id text primary key,
  at timestamptz,
  email text,
  name text,
  action text,
  module text,
  record_id text,
  summary text,
  changes text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.activity_log add column if not exists at timestamptz;
alter table public.activity_log add column if not exists email text;
alter table public.activity_log add column if not exists name text;
alter table public.activity_log add column if not exists action text;
alter table public.activity_log add column if not exists module text;
alter table public.activity_log add column if not exists record_id text;
alter table public.activity_log add column if not exists summary text;
alter table public.activity_log add column if not exists changes text;
alter table public.activity_log add column if not exists extra jsonb;

-- useful lookups
create index if not exists diesel_issue_date on public.diesel_issue (issue_date);
create index if not exists diesel_issue_machinery on public.diesel_issue (machinery);
create index if not exists diesel_inward_date on public.diesel_inward (date);
create index if not exists diesel_transfer_date on public.diesel_transfer (date);
create index if not exists log_book_machinery_date on public.log_book (machinery, date);
create index if not exists tank_check_machinery_date on public.tank_check (machinery, date);
create index if not exists activity_log_at on public.activity_log (at);

drop trigger if exists master_touch on public.master;
create trigger master_touch before update on public.master for each row execute function public.touch_updated_at();
drop trigger if exists master_deleted on public.master;
create trigger master_deleted after delete on public.master for each row execute function public.note_delete();
alter table public.master enable row level security;
create index if not exists master_updated_at on public.master (updated_at);

drop trigger if exists diesel_inward_touch on public.diesel_inward;
create trigger diesel_inward_touch before update on public.diesel_inward for each row execute function public.touch_updated_at();
drop trigger if exists diesel_inward_deleted on public.diesel_inward;
create trigger diesel_inward_deleted after delete on public.diesel_inward for each row execute function public.note_delete();
alter table public.diesel_inward enable row level security;
create index if not exists diesel_inward_updated_at on public.diesel_inward (updated_at);

drop trigger if exists diesel_transfer_touch on public.diesel_transfer;
create trigger diesel_transfer_touch before update on public.diesel_transfer for each row execute function public.touch_updated_at();
drop trigger if exists diesel_transfer_deleted on public.diesel_transfer;
create trigger diesel_transfer_deleted after delete on public.diesel_transfer for each row execute function public.note_delete();
alter table public.diesel_transfer enable row level security;
create index if not exists diesel_transfer_updated_at on public.diesel_transfer (updated_at);

drop trigger if exists diesel_issue_touch on public.diesel_issue;
create trigger diesel_issue_touch before update on public.diesel_issue for each row execute function public.touch_updated_at();
drop trigger if exists diesel_issue_deleted on public.diesel_issue;
create trigger diesel_issue_deleted after delete on public.diesel_issue for each row execute function public.note_delete();
alter table public.diesel_issue enable row level security;
create index if not exists diesel_issue_updated_at on public.diesel_issue (updated_at);

drop trigger if exists log_book_touch on public.log_book;
create trigger log_book_touch before update on public.log_book for each row execute function public.touch_updated_at();
drop trigger if exists log_book_deleted on public.log_book;
create trigger log_book_deleted after delete on public.log_book for each row execute function public.note_delete();
alter table public.log_book enable row level security;
create index if not exists log_book_updated_at on public.log_book (updated_at);

drop trigger if exists tank_check_touch on public.tank_check;
create trigger tank_check_touch before update on public.tank_check for each row execute function public.touch_updated_at();
drop trigger if exists tank_check_deleted on public.tank_check;
create trigger tank_check_deleted after delete on public.tank_check for each row execute function public.note_delete();
alter table public.tank_check enable row level security;
create index if not exists tank_check_updated_at on public.tank_check (updated_at);

drop trigger if exists app_users_touch on public.app_users;
create trigger app_users_touch before update on public.app_users for each row execute function public.touch_updated_at();
drop trigger if exists app_users_deleted on public.app_users;
create trigger app_users_deleted after delete on public.app_users for each row execute function public.note_delete();
alter table public.app_users enable row level security;
create index if not exists app_users_updated_at on public.app_users (updated_at);

drop trigger if exists activity_log_touch on public.activity_log;
create trigger activity_log_touch before update on public.activity_log for each row execute function public.touch_updated_at();
drop trigger if exists activity_log_deleted on public.activity_log;
create trigger activity_log_deleted after delete on public.activity_log for each row execute function public.note_delete();
alter table public.activity_log enable row level security;
create index if not exists activity_log_updated_at on public.activity_log (updated_at);

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
drop trigger if exists app_settings_deleted on public.app_settings;
create trigger app_settings_deleted after delete on public.app_settings for each row execute function public.note_delete();
alter table public.app_settings enable row level security;
create index if not exists app_settings_updated_at on public.app_settings (updated_at);
alter table public.deleted_rows enable row level security;

-- list of tables and columns for the backup copy (every table in "public", except the delete log)
create or replace function public.backup_catalog()
returns table (table_name text, column_name text, ordinal_position int)
language sql stable security definer set search_path = public as $$
  select c.table_name::text, c.column_name::text, c.ordinal_position::int
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.table_name <> 'deleted_rows'
  order by c.table_name, c.ordinal_position;
$$;
revoke all on function public.backup_catalog() from public, anon, authenticated;
grant execute on function public.backup_catalog() to service_role;

-- Row Level Security is ON for every table and no access is given yet:
-- only the secret key (used by the Apps Script) can read / write. The app's own login rules come in step 3.

-- access for the secret key (service_role) – newer projects do not give it automatically
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.backup_catalog() to service_role;

-- tables and modules added later get the same access automatically
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- ===================== THE TEST MARK =====================
-- The servers of a Preview (the staging copies) work ONLY with a database that has this row; the live databases never have it.
insert into public.app_settings (id, value) values ('THIS_IS_A_TEST_DATABASE', 'yes') on conflict (id) do update set value = 'yes';

-- ===================== MECHANICAL: supabase_step1b_grants.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Supabase: give the secret key (service_role) access to the tables
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Newer Supabase projects do not give this access to new tables automatically.
-- =====================================================================
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.backup_catalog() to service_role;

-- tables and modules added later get the same access automatically
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- ===================== MECHANICAL: supabase_step1c_backup_check.sql =====================
-- =====================================================================
-- RCL Fleet ERP – quick "has anything changed?" check for the 1-minute backup
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Returns the newest change time (any table, including deletes) and a fingerprint of the tables / columns,
-- so the backup knows in ONE small call whether there is anything to copy.
-- =====================================================================
create or replace function public.backup_last_change()
returns table (last_change timestamptz, layout text)
language plpgsql stable security definer set search_path = public as $$
declare
  t record;
  m timestamptz;
  best timestamptz := 'epoch';
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format('select max(updated_at) from public.%I', t.table_name) into m;
    if m is not null and m > best then best := m; end if;
  end loop;
  select greatest(best, coalesce(max(d.deleted_at), 'epoch')) into best from public.deleted_rows d;
  return query
    select best,
           md5(coalesce(string_agg(c.table_name || '.' || c.column_name, ',' order by c.table_name, c.ordinal_position), ''))
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.table_name <> 'deleted_rows';
end $$;
revoke all on function public.backup_last_change() from public, anon, authenticated;
grant execute on function public.backup_last_change() to service_role;

-- ===================== MECHANICAL: supabase_step1d_opening_diesel.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Log Book: opening diesel typed on the 1st of a month
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.log_book add column if not exists opening_diesel_set numeric;

-- ===================== MECHANICAL: supabase_step1e_master_rates.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Master: Monthly Rate and TDS Rate (Rental / Hired machinery)
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists monthly_rate numeric;
alter table public.master add column if not exists tds_rate numeric;

-- ===================== MECHANICAL: supabase_step1f_entered_by.sql =====================
-- =====================================================================
-- RCL Fleet ERP – who entered / changed each entry
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master          add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.diesel_inward   add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.diesel_transfer add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.diesel_issue    add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.log_book        add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.tank_check      add column if not exists entered_by text, add column if not exists updated_by text;

-- ===================== MECHANICAL: supabase_step1g_vendors_boq.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Vendors (party master) and BOQ (rate contracts)
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs / SupabaseData.gs).
-- =====================================================================
create table if not exists public.vendors (
  id text primary key,
  vendor_name text,
  ownership text,
  gst_registered text,
  gst_number text,
  gst_percent numeric,
  pan_number text,
  tds_percent numeric,
  bank_name text,
  branch text,
  account_number text,
  ifsc_code text,
  address text,
  phone text,
  remark text,
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.boq (
  id text primary key,
  boq_no text,
  vendor_name text,
  valid_from date,
  valid_to date,
  amendment_of text,
  amendment_no numeric,
  lines text,
  remark text,
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists vendors_touch on public.vendors;
create trigger vendors_touch before update on public.vendors for each row execute function public.touch_updated_at();
drop trigger if exists vendors_deleted on public.vendors;
create trigger vendors_deleted after delete on public.vendors for each row execute function public.note_delete();
alter table public.vendors enable row level security;
create index if not exists vendors_updated_at on public.vendors (updated_at);

drop trigger if exists boq_touch on public.boq;
create trigger boq_touch before update on public.boq for each row execute function public.touch_updated_at();
drop trigger if exists boq_deleted on public.boq;
create trigger boq_deleted after delete on public.boq for each row execute function public.note_delete();
alter table public.boq enable row level security;
create index if not exists boq_updated_at on public.boq (updated_at);
create index if not exists boq_vendor on public.boq (vendor_name);

grant select, insert, update, delete on public.vendors, public.boq to service_role;

-- ===================== MECHANICAL: supabase_step1h_asset_vendor_fields.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Asset Master and Vendor Master: new fields
-- Only ADDS columns. Existing data is not changed.
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists engine_number text;
alter table public.master add column if not exists chassis_number text;
alter table public.master add column if not exists engine_make text;
alter table public.master add column if not exists tax_valid_upto text;        -- a date (YYYY-MM-DD) or NA
alter table public.master add column if not exists puc_valid_upto text;
alter table public.master add column if not exists permit_valid_upto text;
alter table public.master add column if not exists fitness_valid_upto text;
alter table public.master add column if not exists insurance_valid_upto text;
alter table public.vendors add column if not exists aadhaar_number text;
alter table public.vendors add column if not exists email text;

-- ===================== MECHANICAL: supabase_step1i_bills.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Machinery Billing: submitted bills (a saved copy of each bill)
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs / SupabaseData.gs).
-- =====================================================================
create table if not exists public.bills (
  id text primary key,
  vendor_name text,
  company text,
  bill_no text,
  rev numeric,
  period_from date,
  period_to date,
  bill_date date,
  net_payable numeric,
  status text,
  data text,
  remark text,
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists bills_touch on public.bills;
create trigger bills_touch before update on public.bills for each row execute function public.touch_updated_at();
drop trigger if exists bills_deleted on public.bills;
create trigger bills_deleted after delete on public.bills for each row execute function public.note_delete();
alter table public.bills enable row level security;
create index if not exists bills_updated_at on public.bills (updated_at);
create index if not exists bills_vendor on public.bills (vendor_name);
grant select, insert, update, delete on public.bills to service_role;

-- ===================== MECHANICAL: supabase_step1j_user_access.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Users: access columns for the new pages
-- Only ADDS columns. Each user first gets the access he had before (Master / Reports), so nothing changes until Admin sets it.
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.app_users add column if not exists perm_vendor_master text;
alter table public.app_users add column if not exists perm_vendor_boq text;
alter table public.app_users add column if not exists perm_machinery_billing text;
alter table public.app_users add column if not exists perm_saved_bills text;
update public.app_users set perm_vendor_master = perm_master where perm_vendor_master is null;
update public.app_users set perm_vendor_boq = perm_master where perm_vendor_boq is null;
update public.app_users set perm_machinery_billing = perm_master where perm_machinery_billing is null;
update public.app_users set perm_saved_bills = perm_reports where perm_saved_bills is null;

-- ===================== MECHANICAL: supabase_step1k_bill_summary.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Users: access column for the new page "Bill Summary"
-- Only ADDS a column. Everyone starts with "No access"; Admin gives it in Users & Access (Admin has it already).
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.app_users add column if not exists perm_bill_summary text;
update public.app_users set perm_bill_summary = case when upper(coalesce(admin, '')) = 'YES' then 'Edit' else 'No access' end where perm_bill_summary is null;

-- ===================== MECHANICAL: supabase_step1l_payments_ledger.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Machinery Payments (payments + opening balances) and access for the ledger pages
-- Only ADDS a table and columns. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs / SupabaseData.gs).
-- =====================================================================
create table if not exists public.payments (
  id text primary key,
  entry_type text,
  entry_date date,
  vendor_name text,
  amount numeric,
  side text,
  mode text,
  reference text,
  against_bill text,
  remark text,
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();
drop trigger if exists payments_deleted on public.payments;
create trigger payments_deleted after delete on public.payments for each row execute function public.note_delete();
alter table public.payments enable row level security;
create index if not exists payments_updated_at on public.payments (updated_at);
create index if not exists payments_vendor on public.payments (vendor_name);
grant select, insert, update, delete on public.payments to service_role;

-- access for the new pages: Admin gets Edit, everyone else starts with "No access" (Admin gives it in Users & Access)
alter table public.app_users add column if not exists perm_machinery_payments text;
alter table public.app_users add column if not exists perm_vendor_ledger text;
alter table public.app_users add column if not exists perm_vendor_outstanding text;
update public.app_users set perm_machinery_payments = case when upper(coalesce(admin, '')) = 'YES' then 'Edit' else 'No access' end where perm_machinery_payments is null;
update public.app_users set perm_vendor_ledger = case when upper(coalesce(admin, '')) = 'YES' then 'Edit' else 'No access' end where perm_vendor_ledger is null;
update public.app_users set perm_vendor_outstanding = case when upper(coalesce(admin, '')) = 'YES' then 'Edit' else 'No access' end where perm_vendor_outstanding is null;

-- ===================== MECHANICAL: supabase_step1m_vehicle_compliance.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Vehicle Compliance: history of renewals (Tax, PUC, Permit, Fitness, Insurance) and page access
-- Only ADDS a table and a column. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs / SupabaseData.gs).
-- =====================================================================
create table if not exists public.compliance_history (
  id text primary key,
  machinery_no text,
  document text,
  old_valid_upto text,
  new_valid_upto text,
  renewed_on date,
  document_no text,
  amount numeric,
  remark text,
  source text,
  entered_at timestamptz,
  entered_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists compliance_history_touch on public.compliance_history;
create trigger compliance_history_touch before update on public.compliance_history for each row execute function public.touch_updated_at();
drop trigger if exists compliance_history_deleted on public.compliance_history;
create trigger compliance_history_deleted after delete on public.compliance_history for each row execute function public.note_delete();
alter table public.compliance_history enable row level security;
create index if not exists compliance_history_updated_at on public.compliance_history (updated_at);
create index if not exists compliance_history_machinery on public.compliance_history (machinery_no);
grant select, insert, update, delete on public.compliance_history to service_role;

-- access for the new page: Admin gets Edit, everyone else starts with "No access" (Admin gives it in Users & Access)
alter table public.app_users add column if not exists perm_vehicle_compliance text;
update public.app_users set perm_vehicle_compliance = case when upper(coalesce(admin, '')) = 'YES' then 'Edit' else 'No access' end where perm_vehicle_compliance is null;

-- ===================== MECHANICAL: supabase_step1n_works_on.sql =====================
-- =====================================================================
-- RCL Fleet ERP – what each machinery works on (Day / Trip / KM / Hrs / Time) and Log Book entries on Time
-- Only ADDS columns. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists works_on text;
alter table public.log_book add column if not exists start_time text;
alter table public.log_book add column if not exists end_time text;
alter table public.log_book add column if not exists break_min numeric;
alter table public.log_book add column if not exists time_hrs numeric;
-- the machinery already there keep what they had: KM → KM, Hrs → Hrs, KM + Hrs → KM, Hrs
update public.master set works_on = case unit when 'KM' then 'KM' when 'Hrs' then 'Hrs' when 'KM + Hrs' then 'KM, Hrs' else works_on end
  where works_on is null or works_on = '';

-- ===================== MECHANICAL: supabase_step1o_challan.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Log Book: Challan No for trip entries
-- Only ADDS a column. Run once in Supabase → SQL Editor → New query → paste → Run (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.log_book add column if not exists challan_no text;

-- ===================== MECHANICAL: supabase_step1q_breakdown.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Breakdown register and the daily breakdown report, and the "Breakdown" page access
-- Only ADDS tables and a column. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs / SupabaseData.gs).
-- =====================================================================
create table if not exists public.breakdowns (
  id text primary key, machinery_no text, from_date date, reason text, remark text, status text, back_on date, closing_remark text,
  entered_at timestamptz, entered_by text, updated_by text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.breakdown_reports (
  id text primary key, report_date date, machinery_count numeric, details text, submitted_at timestamptz, entered_by text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists breakdowns_touch on public.breakdowns;
create trigger breakdowns_touch before update on public.breakdowns for each row execute function public.touch_updated_at();
drop trigger if exists breakdowns_deleted on public.breakdowns;
create trigger breakdowns_deleted after delete on public.breakdowns for each row execute function public.note_delete();
drop trigger if exists breakdown_reports_touch on public.breakdown_reports;
create trigger breakdown_reports_touch before update on public.breakdown_reports for each row execute function public.touch_updated_at();
drop trigger if exists breakdown_reports_deleted on public.breakdown_reports;
create trigger breakdown_reports_deleted after delete on public.breakdown_reports for each row execute function public.note_delete();
alter table public.breakdowns enable row level security;
alter table public.breakdown_reports enable row level security;
create index if not exists breakdowns_updated_at on public.breakdowns (updated_at);
create index if not exists breakdown_reports_updated_at on public.breakdown_reports (updated_at);
grant select, insert, update, delete on public.breakdowns to service_role;
grant select, insert, update, delete on public.breakdown_reports to service_role;

-- access for the new page: Admin gets Edit, everyone else starts with "No access" (Admin gives it in Users & Access)
alter table public.app_users add column if not exists perm_breakdown text;
update public.app_users set perm_breakdown = case when upper(coalesce(admin, '')) = 'YES' then 'Edit' else 'No access' end where perm_breakdown is null;

-- ===================== MECHANICAL: supabase_step1r_logbook_format.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Log Book print format of each machinery (Format A, B, …)
-- Only ADDS a column. Every machinery starts on Format A. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists log_book_format text;
update public.master set log_book_format = 'A' where log_book_format is null or log_book_format = '';

-- ===================== MECHANICAL: supabase_step1s_boq_items.sql =====================
-- =====================================================================
-- RCL Fleet ERP – Item-wise BOQ: the work of a Log Book entry shared between the items of the BOQ (e.g. Bucket / Breaker)
-- Only ADDS a column. Nothing that is saved changes. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs).
-- The items themselves (name, rent type, rate, slabs) are kept inside the BOQ line (boq.lines) – no new table is needed.
-- =====================================================================
alter table public.log_book add column if not exists item_work text;

-- ===================== MECHANICAL: supabase_step1t_debit_notes.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1t: "Debit to" in the Log Book, and Debit Notes
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS: two empty columns to log_book and one new, empty table.
-- No existing column, row or rule is changed. Until it is run the app works as before; the "Debit to" fields are
-- simply not saved and the Debit Notes list stays empty.
-- Rollback: alter table public.log_book drop column debit_to, drop column debit_rate; drop table public.debit_notes;
-- =====================================================================
alter table public.log_book add column if not exists debit_to text;       -- the party this entry's work is charged to
alter table public.log_book add column if not exists debit_rate numeric;  -- the rate typed for it

create table if not exists public.debit_notes (
  id text primary key,          -- DN-00001 …
  dn_no text,                   -- the printed number, own run for each name (Rachana / Sketchline)
  company text,
  dn_date date,
  vendor_name text,
  kind text,                    -- Log Book | Manual
  period_from date,
  period_to date,
  lines text,                   -- JSON: machinery, particular, qty, unit, rate, amount (and the Log Book entry it came from)
  log_ids text,                 -- JSON: the Log Book entries in this note (an entry can be in one note only)
  amount numeric,
  gst_pct numeric,
  gst_amt numeric,
  tds_pct numeric,
  tds_amt numeric,
  total numeric,
  status text,                  -- Open | Cancelled
  bill_id text,
  remark text,
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists debit_notes_touch on public.debit_notes;
create trigger debit_notes_touch before update on public.debit_notes for each row execute function public.touch_updated_at();
drop trigger if exists debit_notes_deleted on public.debit_notes;
create trigger debit_notes_deleted after delete on public.debit_notes for each row execute function public.note_delete();
alter table public.debit_notes enable row level security;
create index if not exists debit_notes_updated_at on public.debit_notes (updated_at);
create index if not exists debit_notes_vendor on public.debit_notes (vendor_name);
revoke all on public.debit_notes from anon, authenticated;
grant select, insert, update, delete on public.debit_notes to service_role;
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step1u_meter.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1u: Log Book entries without a reading (meter not working) and "new meter"
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS one empty column to log_book.
-- No existing column, row or rule is changed. Until it is run the app works as before; a "No reading" or
-- "New meter" entry is refused with a message that names this file.
-- Rollback: alter table public.log_book drop column meter_note;
-- =====================================================================
alter table public.log_book add column if not exists meter_note text;   -- "No reading – <reason>" or "New meter – <reason>"
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step1v_half_day.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1v: "Half day" on a Log Book entry (it is paid as half a day in the bill)
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS one empty column to log_book.
-- No existing column, row or rule is changed. Until it is run the app works as before; a "½ day" entry is
-- refused with a message that names this file.
-- Rollback: alter table public.log_book drop column day_part;
-- =====================================================================
alter table public.log_book add column if not exists day_part numeric;   -- 0.5 = half day; empty = a whole day (every entry so far)
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step1w_time_slots.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1w: split timing of a Log Book entry measured by Time (e.g. 11:00-13:00 and 14:00-17:00)
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS one empty column to log_book.
-- No existing column, row or rule is changed. The hours of an entry stay where they are (start_time, end_time,
-- break_min, time_hrs); this column only keeps HOW the time was split, to show and print it.
-- Until it is run the app works as before; an entry with MORE THAN ONE From – To is refused with a message
-- that names this file (an entry with one From – To is saved as always).
-- Rollback: alter table public.log_book drop column time_slots;
-- =====================================================================
alter table public.log_book add column if not exists time_slots text;   -- "11:00-13:00,14:00-17:00"; empty = one From – To (every entry so far)
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step1x_diesel_photos.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1x: the 4 photos of a diesel issue (update-85)
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS:
--   1. one empty column "photos" to diesel_issue (the list of the entry's photos: which photo, where it is kept,
--      the time and the place it was taken);
--   2. one PRIVATE place for the pictures (Storage bucket "diesel-photos"): only JPG, at most 2 MB a picture.
--      Private = a picture opens only through the app, with a link that works for 15 minutes.
-- No existing column, row or rule is changed. Until it is run the app works as before; taking a photo says
-- that this file must be run first.
-- Rollback (only while no entry has photos): alter table public.diesel_issue drop column photos;
--   and in Supabase → Storage delete the bucket diesel-photos (it must be empty).
-- =====================================================================
alter table public.diesel_issue add column if not exists photos text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diesel-photos', 'diesel-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step1y_vendor_owner.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1y: the Vendor Master common to every site (update-106)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one empty column "owner_site" to vendors: the site that made the vendor (the only site where it can be changed
-- or deleted). No existing column, row or rule is changed. Until it is run at every site, each site keeps its own vendors
-- as before; the Vendor Master says that this file must be run first.
-- Rollback (only before "Bring the vendors of all sites together" was used): alter table public.vendors drop column owner_site;
-- =====================================================================
alter table public.vendors add column if not exists owner_site text;

notify pgrst, 'reload schema';
select 'Step 1y done · vendors ' || (select count(*) from public.vendors) as done;

-- ===================== MECHANICAL: supabase_step1z_billed_changes.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1z: changes of a billed period (update-108)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one new, empty table "billed_changes". It keeps two kinds of rows:
--   Request  – a Log Book / diesel change that a user made on a date of a submitted bill; it waits until the Super Admin
--              approves it (then it is saved) or rejects it;
--   Baseline – a submitted bill's figures (one machinery) as worked out just before its first entry was changed, so that the
--              next bill of the vendor shows exactly what the change made different.
-- No existing table, column, row or rule is changed. Until it is run, such a change is refused as before and the page says
-- that this file must be run first.
-- Rollback: drop table public.billed_changes;
-- =====================================================================
create table if not exists public.billed_changes (
  id text primary key,          -- CR-00001 … (a request) · BL|<bill id>|<machinery> (a baseline)
  kind text,                    -- Request | Baseline
  requested_at timestamptz,
  requested_by text,            -- the user's name
  requester_email text,
  action text,                  -- the save that was asked (updateLogRow, saveDieselIssue …)
  args text,                    -- JSON: exactly what the page sent – saved as it is when approved
  summary text,                 -- what it changes, in words (machinery, date, readings)
  machinery text,
  dates text,
  reason text,                  -- the user's reason
  status text,                  -- Pending | Approved | Rejected (a request)
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  result text,
  bill_id text,                 -- a baseline: the bill
  data text,                    -- a baseline: the bill's figures of that machinery (JSON)
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists billed_changes_touch on public.billed_changes;
create trigger billed_changes_touch before update on public.billed_changes for each row execute function public.touch_updated_at();
drop trigger if exists billed_changes_deleted on public.billed_changes;
create trigger billed_changes_deleted after delete on public.billed_changes for each row execute function public.note_delete();
alter table public.billed_changes enable row level security;
create index if not exists billed_changes_updated_at on public.billed_changes (updated_at);
create index if not exists billed_changes_status on public.billed_changes (status);
revoke all on public.billed_changes from anon, authenticated;
grant select, insert, update, delete on public.billed_changes to service_role;

notify pgrst, 'reload schema';
select 'Step 1z done · billed_changes ' || (select count(*) from public.billed_changes) as done;

-- ===================== MECHANICAL: supabase_step1za_site_periods.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1za: a machinery on a site several times (update-119)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one empty column "site_periods" to master: the earlier periods a machinery was on the site (it left and came
-- back later), as the app writes them: [{"from":"2026-01-01","until":"2026-07-01"}, …]. Its current period stays in Active From /
-- Status / Inactive From, as before. No table, column, row or rule is changed. Until it is run, a machinery that comes back
-- cannot be saved with its earlier period (the app says that this file must be run first); everything else works as before.
-- Rollback: alter table public.master drop column site_periods;
-- =====================================================================
alter table public.master add column if not exists site_periods text;

notify pgrst, 'reload schema';
select 'Step 1za done · master.site_periods ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'master' and column_name = 'site_periods') as done;

-- ===================== MECHANICAL: supabase_step1zb_inward_bills.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1zb: the bill copies of a diesel inward (update-120)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one empty column "photos" to diesel_inward: the list of the inward's bill copy photos, as the app writes them:
-- [{"p":"inward/2026-10/<id>.jpg","at":"…"}, …]. The pictures themselves go to the PRIVATE place of the diesel photos
-- (Storage bucket "diesel-photos", made by step 1x), in its folder inward/. No table, column, row or rule is changed.
-- Until it is run the app works as before; adding a bill copy says that this file must be run first.
-- Rollback (only while no inward has bill copies): alter table public.diesel_inward drop column photos;
-- =====================================================================
alter table public.diesel_inward add column if not exists photos text;

notify pgrst, 'reload schema';
select 'Step 1zb done · diesel_inward.photos ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'diesel_inward' and column_name = 'photos') as done;

-- ===================== MECHANICAL: supabase_step1zc_bill_evidence.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1zc: the fixed evidence of a submitted bill (update-151)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS two new, empty tables:
--   1. bill_snapshots – one row per bill submitted from now on: the bill as saved, the Asset Master of its machinery, the other
--      input of its Log Book pages (BOQ, diesel issues, rates, the Idle choice) and the fingerprint (SHA-256) of it all;
--   2. bill_log_rows  – every Log Book entry of that bill exactly as it was billed, each with its own fingerprint.
-- The app writes them in the SAME all-or-nothing save as the bill. After that NOBODY can change or delete them: a trigger
-- refuses every UPDATE, DELETE and TRUNCATE, and the app's key has no right to delete. No existing table, row or rule is changed.
-- Until it is run the app works as before (bills are saved without their evidence).
-- Rollback (ONLY while both tables are empty – evidence is never thrown away once it is written):
--   drop table public.bill_log_rows; drop table public.bill_snapshots; drop function public.rcl_evidence_fixed();
-- =====================================================================
begin;

create table if not exists public.bill_snapshots (
  id text primary key,                 -- the bill's ID (BILL-00012)
  bill_no text,
  rev numeric,
  vendor_name text,
  company text,
  period_from date,
  period_to date,
  kind text not null default 'submission',
  bill_data text,                      -- the bill as saved (figures, notes) – JSON
  machines text,                       -- the Asset Master of its machinery as used – JSON
  extra text,                          -- the other input of its Log Book pages – JSON
  rows_count numeric,
  snapshot_sha256 text not null,
  submitted_by text,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bill_log_rows (
  id text primary key,                 -- <bill ID>|<Log Book entry key>
  bill_id text not null,
  entry_key text not null,             -- machinery|date|shift
  machinery text,
  entry_date date,
  shift text,
  data text not null,                  -- the entry as billed – JSON
  row_sha256 text not null,
  created_at timestamptz not null default now()
);
create index if not exists bill_log_rows_bill on public.bill_log_rows (bill_id);
create index if not exists bill_log_rows_entry on public.bill_log_rows (entry_key);

-- written once, never changed: every UPDATE, DELETE and TRUNCATE is refused
create or replace function public.rcl_evidence_fixed() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'RCL_EVIDENCE_FIXED: % holds the evidence of a submitted bill – it is never changed or deleted', tg_table_name;
end $$;
drop trigger if exists bill_snapshots_fixed on public.bill_snapshots;
create trigger bill_snapshots_fixed before update or delete on public.bill_snapshots for each row execute function public.rcl_evidence_fixed();
drop trigger if exists bill_snapshots_no_truncate on public.bill_snapshots;
create trigger bill_snapshots_no_truncate before truncate on public.bill_snapshots for each statement execute function public.rcl_evidence_fixed();
drop trigger if exists bill_log_rows_fixed on public.bill_log_rows;
create trigger bill_log_rows_fixed before update or delete on public.bill_log_rows for each row execute function public.rcl_evidence_fixed();
drop trigger if exists bill_log_rows_no_truncate on public.bill_log_rows;
create trigger bill_log_rows_no_truncate before truncate on public.bill_log_rows for each statement execute function public.rcl_evidence_fixed();

-- the same safety as every table of the app: the public key gets nothing; the app's key reads and adds rows, and may not delete
alter table public.bill_snapshots enable row level security;
alter table public.bill_log_rows enable row level security;
revoke all on public.bill_snapshots from public, anon, authenticated;
revoke all on public.bill_log_rows from public, anon, authenticated;
revoke delete, truncate on public.bill_snapshots from service_role;
revoke delete, truncate on public.bill_log_rows from service_role;
grant select, insert, update on public.bill_snapshots to service_role;   -- (update is needed for the app's "insert … on conflict" save; the trigger refuses it)
grant select, insert, update on public.bill_log_rows to service_role;
revoke all on function public.rcl_evidence_fixed() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
select 'Step 1zc done · bill_snapshots ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'bill_snapshots')
  || ' · bill_log_rows ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'bill_log_rows')
  || ' · triggers ' || (select count(*) from pg_trigger where tgname in ('bill_snapshots_fixed', 'bill_snapshots_no_truncate', 'bill_log_rows_fixed', 'bill_log_rows_no_truncate')) as done;

-- ===================== MECHANICAL: supabase_step1zd_entry_locks.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 1zd: an approved or billed Log Book entry is locked – only the Super Admin changes it (update-152)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …), AFTER step 1zc. Safe to run again.
-- It only ADDS (nothing that is there is changed or removed):
--   1. log_book: approved_by, approved_at, approval_ref – the mark of an entry saved through a verification (approval) rule;
--   2. bills: deleted_by, deleted_at, delete_reason – a submitted bill is never removed any more: "Deleted" is a status, kept;
--      the app's key loses the right to delete a bill;
--   3. bill_machines – which machinery and dates every submitted bill holds (Active, Superseded or Deleted alike – a bill never
--      unlocks its entries by itself), kept by a trigger on bills; filled once from the bills there are now;
--   4. log_book_history – every change of a locked entry (before and after, who, why), written by the database itself; nobody
--      can change or delete it;
--   5. a guard on log_book: a change of a locked entry that is not the Super Admin's is WRITTEN DOWN (log_book_history,
--      allowed = false) – "warn" mode. It refuses such a change only after the Admin switches it to "enforce" (see the end).
--   6. web_write3 – the app's all-or-nothing save with who is saving and why (the guard reads it).
-- Until it is run the app works as before (no approval mark, bills deleted as before is refused by the new app – it needs this).
-- Rollback (code first: Vercel → Instant Rollback; then, only if wanted):
--   drop trigger log_book_guard on public.log_book; drop trigger log_book_guard_ins on public.log_book;
--   drop trigger bills_machines on public.bills; grant delete on public.bills to service_role;
--   (the new columns and tables are kept – they hold history; they are harmless to the older app)
-- =====================================================================
begin;

-- 1. the approval mark
alter table public.log_book add column if not exists approved_by text;
alter table public.log_book add column if not exists approved_at timestamptz;
alter table public.log_book add column if not exists approval_ref text;

-- 2. a bill is deleted by its status ("Deleted"), never removed
alter table public.bills add column if not exists deleted_by text;
alter table public.bills add column if not exists deleted_at timestamptz;
alter table public.bills add column if not exists delete_reason text;
revoke delete, truncate on public.bills from service_role;

-- 3. the machinery and dates of every submitted bill (the same keys as the app: the number it has today, letters and digits only)
create table if not exists public.bill_machines (
  bill_id text not null,
  machinery_key text not null,
  period_from date not null,
  period_to date not null,
  primary key (bill_id, machinery_key)
);
create index if not exists bill_machines_key on public.bill_machines (machinery_key, period_from, period_to);
alter table public.bill_machines enable row level security;
revoke all on public.bill_machines from public, anon, authenticated;
grant select on public.bill_machines to service_role;

create or replace function public.rcl_no_key(v text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(upper(coalesce(v, '')), '[^A-Z0-9]', '', 'g')
$$;

-- the keys of one bill: its machinery list (the number it has today – noNow – or as billed), or – a very old bill without the
-- list – every machinery its vendor owns in the Asset Master
create or replace function public.rcl_bill_keys(p_data text, p_vendor text) returns setof text language plpgsql stable set search_path = '' as $$
declare j jsonb;
begin
  begin j := nullif(p_data, '')::jsonb; exception when others then j := null; end;
  if j is not null and jsonb_typeof(j->'machines') = 'array' and jsonb_array_length(j->'machines') > 0 then
    return query select distinct public.rcl_no_key(coalesce(nullif(m->>'noNow', ''), m->>'no')) from jsonb_array_elements(j->'machines') m
      where public.rcl_no_key(coalesce(nullif(m->>'noNow', ''), m->>'no')) <> '';
  else
    return query select distinct public.rcl_no_key(x.id) from public.master x where upper(trim(coalesce(x.owner_name, ''))) = upper(trim(coalesce(p_vendor, ''))) and public.rcl_no_key(x.id) <> '';
  end if;
end $$;

create or replace function public.rcl_bill_machines() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.period_from is null or new.period_to is null then return new; end if;
  -- (a bill's list changes only when a machinery number is changed later – noNow; the keys it had are kept as well: never unlocked)
  insert into public.bill_machines (bill_id, machinery_key, period_from, period_to)
    select new.id, k, new.period_from, new.period_to from public.rcl_bill_keys(new.data, new.vendor_name) k
    on conflict (bill_id, machinery_key) do nothing;
  return new;
end $$;
drop trigger if exists bills_machines on public.bills;
create trigger bills_machines after insert or update of data, period_from, period_to, vendor_name on public.bills for each row execute function public.rcl_bill_machines();
-- once: the bills there are now (every status – Active, Superseded)
insert into public.bill_machines (bill_id, machinery_key, period_from, period_to)
  select b.id, k, b.period_from, b.period_to from public.bills b, lateral public.rcl_bill_keys(b.data, b.vendor_name) k
  where b.period_from is not null and b.period_to is not null
  on conflict (bill_id, machinery_key) do nothing;

create or replace function public.rcl_billed(p_machinery text, p_date date) returns text language sql stable set search_path = '' as $$
  select bm.bill_id from public.bill_machines bm where bm.machinery_key = public.rcl_no_key(p_machinery) and bm.period_from <= p_date and bm.period_to >= p_date limit 1
$$;

-- 4. the history of every change of a locked entry
create table if not exists public.log_book_history (
  seq bigserial primary key,
  entry_key text not null,
  action text not null,                -- insert / update / delete
  locked_by text,                      -- approval / bill / approval + bill
  bill_id text,
  changed text[],                      -- the columns changed (what was entered – not what the app works out)
  old_row jsonb,
  new_row jsonb,
  ctx jsonb,                           -- who saved it and why (from the app's save)
  allowed boolean not null,            -- false = not the Super Admin's (warn: written down; enforce: refused)
  at timestamptz not null default now()
);
create index if not exists log_book_history_key on public.log_book_history (entry_key);
create index if not exists log_book_history_at on public.log_book_history (at);
create or replace function public.rcl_history_fixed() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'RCL_HISTORY_FIXED: % is the history of locked entries – it is never changed or deleted', tg_table_name;
end $$;
drop trigger if exists log_book_history_fixed on public.log_book_history;
create trigger log_book_history_fixed before update or delete on public.log_book_history for each row execute function public.rcl_history_fixed();
drop trigger if exists log_book_history_no_truncate on public.log_book_history;
create trigger log_book_history_no_truncate before truncate on public.log_book_history for each statement execute function public.rcl_history_fixed();
alter table public.log_book_history enable row level security;
revoke all on public.log_book_history from public, anon, authenticated;
revoke delete, truncate, update on public.log_book_history from service_role;
grant select, insert on public.log_book_history to service_role;      -- (insert: the guard runs as the saving role)
grant usage on sequence public.log_book_history_seq_seq to service_role;

-- 5. the guard (mode in app_settings, id ENTRY_GUARD: 'warn' – the default – or 'enforce')
insert into public.app_settings (id, value) values ('ENTRY_GUARD', 'warn') on conflict (id) do nothing;
-- (it runs as the role that saves – the app's own is service_role – so it knows who is saving; it may only ADD history rows)
create or replace function public.rcl_entry_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  -- (what is ENTERED in a Log Book entry – the same list as the app's LB_GUARD_; the diesel of the day, its readings and the driver
  -- copied from Diesel Issue, and every figure the app works out, are not in it)
  k constant text[] := array['date', 'machinery', 'shift', 'opening_km', 'closing_km', 'opening_hrs', 'closing_hrs',
    'chainage_from', 'chainage_to', 'chainage_no', 'work_done', 'trip', 'remark', 'start_time', 'end_time', 'break_min', 'time_hrs',
    'challan_no', 'item_work', 'debit_to', 'debit_rate', 'meter_note', 'day_part', 'time_slots', 'approved_by', 'approved_at', 'approval_ref'];
  o jsonb; n jsonb; ch text[]; bill text; appr boolean := false; ctx jsonb; ok boolean; mode text; key text;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  -- locked: the entry as it was (approved, or in a bill), or the place it is written to (in a bill)
  if o is not null then
    appr := coalesce(o->>'approved_at', '') <> '';
    bill := public.rcl_billed(o->>'machinery', (o->>'date')::date);
  end if;
  if bill is null and n is not null and n->>'date' is not null then bill := public.rcl_billed(n->>'machinery', (n->>'date')::date); end if;
  if not appr and bill is null then return null; end if;
  -- what was entered and changed (the figures the app works out – averages, diesel balance, fill cycle – do not count)
  select coalesce(array_agg(x order by x), '{}') into ch from unnest(k) x
    where coalesce(o->x, 'null'::jsonb) is distinct from coalesce(n->x, 'null'::jsonb);      -- (a column with nothing in it is not a change)
  if tg_op = 'UPDATE' and array_length(ch, 1) is null then return null; end if;
  begin ctx := nullif(current_setting('rcl.ctx', true), '')::jsonb; exception when others then ctx := null; end;
  ok := coalesce((ctx->>'super')::boolean, false) or coalesce(ctx->>'op', '') = 'rename';
  key := coalesce(o->>'id', n->>'id');
  insert into public.log_book_history (entry_key, action, locked_by, bill_id, changed, old_row, new_row, ctx, allowed)
    values (key, lower(tg_op), case when appr and bill is not null then 'approval + bill' when appr then 'approval' else 'bill' end, bill, ch, o, n, ctx, ok);
  if not ok and current_user = 'service_role' then
    select value into mode from public.app_settings where id = 'ENTRY_GUARD';
    if coalesce(mode, 'warn') = 'enforce' then
      raise exception 'RCL_ENTRY_LOCKED: the Log Book entry % is %, only the Super Admin can change it', key, case when appr then 'approved' else 'in a submitted bill' end;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists log_book_guard on public.log_book;
create trigger log_book_guard after update or delete on public.log_book for each row execute function public.rcl_entry_guard();
drop trigger if exists log_book_guard_ins on public.log_book;
create trigger log_book_guard_ins after insert on public.log_book for each row execute function public.rcl_entry_guard();

-- 6. the app's save with who is saving and why (the same as web_write / web_write2, the context set for this save only)
create or replace function public.web_write3(p jsonb, p_ctx jsonb, p_rid text, p_holder text, p_result text)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  perform set_config('rcl.ctx', coalesce(p_ctx, '{}'::jsonb)::text, true);
  if coalesce(p_rid, '') = '' then return public.web_write(p); end if;
  return public.web_write2(p, p_rid, p_holder, p_result);
end $$;
revoke all on function public.web_write3(jsonb, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.web_write3(jsonb, jsonb, text, text, text) to service_role;
revoke all on function public.rcl_entry_guard() from public, anon, authenticated;
revoke all on function public.rcl_bill_machines() from public, anon, authenticated;
revoke all on function public.rcl_history_fixed() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
select 'Step 1zd done · bill_machines ' || (select count(*) from public.bill_machines) || ' rows · guard ' || (select value from public.app_settings where id = 'ENTRY_GUARD')
  || ' · triggers ' || (select count(*) from pg_trigger where tgname in ('log_book_guard', 'log_book_guard_ins', 'bills_machines', 'log_book_history_fixed', 'log_book_history_no_truncate')) as done;
-- LATER (only when the Admin decides – after some days with no "not the Super Admin's" lines in Database health):
--   update public.app_settings set value = 'enforce' where id = 'ENTRY_GUARD';

-- ===================== MECHANICAL: supabase_step2_web.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 2: run the app outside Apps Script (Vercel)
-- Run once in Supabase → SQL Editor → New query → paste all → Run. Safe to run again.
-- It only ADDS things. No table of the app and no saved data is changed; the Apps Script app keeps working.
--
-- What Apps Script kept by itself is now kept here:
--   web.props  – settings and counters (Script Properties): bill settings, format names, last numbers, data versions
--   web.cache  – short-lived things (Cache): sign-in sessions, the users list, sign-in attempt counters
--   web.locks  – "one save at a time" (Lock)
-- They are in their own schema "web" (not in "public"), so the Google Sheet backup does not copy them and nobody
-- can read them through the API. The app reaches them only through the functions below, with the secret key.
-- =====================================================================
create schema if not exists web;

create table if not exists web.props (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
create table if not exists web.cache (
  key text primary key,
  value text,
  expires_at timestamptz not null
);
create index if not exists cache_expires on web.cache (expires_at);
create table if not exists web.locks (
  name text primary key,
  holder text not null,
  expires_at timestamptz not null
);

-- Row Level Security ON, no access given: only the functions below (run by the owner) reach these tables
alter table web.props enable row level security;
alter table web.cache enable row level security;
alter table web.locks enable row level security;

-- "stamp": the newest change in the app's tables, and which tables it covers. The server keeps a copy of these tables in
-- its memory and uses it only while the stamp is the same – whoever changed the data (this app, the Apps Script app,
-- the SQL editor). A table is covered only if it has updated_at and the two triggers (touch + delete note) that every
-- app table gets; the Activity Log is left out on purpose (it changes with every action and is read rarely).
create or replace function public.web_stamp()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t text; m timestamptz; parts text := ''; names text[] := '{}';
begin
  for t in
    select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and c.relname = any (array['master','diesel_inward','diesel_transfer','diesel_issue','log_book','tank_check','vendors','boq','bills','payments',
                                 'compliance_history','breakdowns','breakdown_reports','app_users','app_settings'])
      and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped)
      and exists (select 1 from pg_trigger g where g.tgrelid = c.oid and g.tgname = c.relname || '_touch' and not g.tgisinternal)
      and exists (select 1 from pg_trigger g where g.tgrelid = c.oid and g.tgname = c.relname || '_deleted' and not g.tgisinternal)
    order by c.relname
  loop
    execute format('select max(updated_at) from public.%I', t) into m;
    parts := parts || coalesce(extract(epoch from m)::text, '0') || '|';
    names := names || t;
  end loop;
  parts := parts || coalesce((select max(seq) from public.deleted_rows)::text, '0');
  return jsonb_build_object('stamp', parts, 'tables', to_jsonb(names));
end $$;

-- start of every request, in ONE call: all settings, the asked cache keys (with the seconds each still lives), and the stamp
create or replace function public.web_boot(p_keys text[])
returns jsonb language sql security definer set search_path = web, public as $$
  select jsonb_build_object(
    'props', coalesce((select jsonb_object_agg(key, value) from web.props), '{}'::jsonb),
    'cache', coalesce((select jsonb_object_agg(key, value) from web.cache where key = any(p_keys) and expires_at > now()), '{}'::jsonb),
    'left',  coalesce((select jsonb_object_agg(key, floor(extract(epoch from (expires_at - now())))) from web.cache where key = any(p_keys) and expires_at > now()), '{}'::jsonb))
    || public.web_stamp();
$$;

-- settings: { "key": "value", … } are saved; a key with null is removed
create or replace function public.web_props_set(p jsonb)
returns void language plpgsql security definer set search_path = web, public as $$
begin
  delete from web.props where key in (select e.key from jsonb_each(p) as e where jsonb_typeof(e.value) = 'null');
  insert into web.props (key, value, updated_at)
    select e.key, e.value #>> '{}', now() from jsonb_each(p) as e where jsonb_typeof(e.value) <> 'null'
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- cache: read some keys
create or replace function public.web_cache_get(p_keys text[])
returns jsonb language sql security definer set search_path = web, public as $$
  select coalesce((select jsonb_object_agg(key, value) from web.cache where key = any(p_keys) and expires_at > now()), '{}'::jsonb);
$$;
-- cache: write [{ "key", "value", "ttl" (seconds) }] and remove keys; old entries are cleared now and then
create or replace function public.web_cache_set(p_put jsonb, p_del text[])
returns void language plpgsql security definer set search_path = web, public as $$
begin
  if p_del is not null and array_length(p_del, 1) > 0 then delete from web.cache where key = any(p_del); end if;
  if p_put is not null and jsonb_typeof(p_put) = 'array' and jsonb_array_length(p_put) > 0 then
    insert into web.cache (key, value, expires_at)
      select x->>'key', x->>'value', now() + make_interval(secs => greatest(1, coalesce((x->>'ttl')::numeric, 600)))
      from jsonb_array_elements(p_put) as x
    on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
  end if;
  if random() < 0.02 then delete from web.cache where expires_at < now() - interval '10 minutes'; end if;
end $$;

-- end of a request, in ONE call: settings to save (null = remove), cache entries to write and to remove
create or replace function public.web_flush(p_props jsonb, p_put jsonb, p_del text[])
returns void language plpgsql security definer set search_path = web, public as $$
begin
  if p_props is not null and jsonb_typeof(p_props) = 'object' then perform public.web_props_set(p_props); end if;
  perform public.web_cache_set(p_put, p_del);
end $$;

-- one save at a time: take the lock (true) or not (false, someone else has it). A lock left behind by a request
-- that died frees itself after p_ttl seconds. With the lock come the settings as they are NOW (fresh counters).
create or replace function public.web_lock(p_name text, p_holder text, p_ttl int)
returns jsonb language plpgsql security definer set search_path = web, public as $$
declare got text;
begin
  insert into web.locks as l (name, holder, expires_at) values (p_name, p_holder, now() + make_interval(secs => p_ttl))
  on conflict (name) do update set holder = excluded.holder, expires_at = excluded.expires_at
    where l.expires_at < now() or l.holder = p_holder
  returning l.holder into got;
  if got is null then return jsonb_build_object('ok', false); end if;
  -- with the lock: the settings and the stamp as they are NOW (nobody else can save until the lock is given back)
  return jsonb_build_object('ok', true, 'props', coalesce((select jsonb_object_agg(key, value) from web.props), '{}'::jsonb)) || public.web_stamp();
end $$;
create or replace function public.web_unlock(p_name text, p_holder text)
returns void language sql security definer set search_path = web, public as $$
  delete from web.locks where name = p_name and holder = p_holder;
$$;

-- only the secret key (service_role) may call these
revoke all on schema web from public, anon, authenticated;
revoke all on all tables in schema web from public, anon, authenticated;
revoke all on function public.web_stamp() from public, anon, authenticated;
grant execute on function public.web_stamp() to service_role;
revoke all on function public.web_boot(text[]) from public, anon, authenticated;
revoke all on function public.web_props_set(jsonb) from public, anon, authenticated;
revoke all on function public.web_cache_get(text[]) from public, anon, authenticated;
revoke all on function public.web_cache_set(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.web_flush(jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.web_lock(text, text, int) from public, anon, authenticated;
revoke all on function public.web_unlock(text, text) from public, anon, authenticated;
grant execute on function public.web_boot(text[]) to service_role;
grant execute on function public.web_props_set(jsonb) to service_role;
grant execute on function public.web_cache_get(text[]) to service_role;
grant execute on function public.web_cache_set(jsonb, text[]) to service_role;
grant execute on function public.web_flush(jsonb, jsonb, text[]) to service_role;
grant execute on function public.web_lock(text, text, int) to service_role;
grant execute on function public.web_unlock(text, text) to service_role;
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step2b_light_boot.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 2b: the settings only when they changed (update-140)
-- Run once in Supabase → SQL Editor → New query → paste all → Run, in EVERY site's Supabase (VTR NH 848, 18B …).
-- Safe to run again. It ADDS one function (web_boot2). No table, column, row or other function is changed.
-- The whole file is ONE transaction: it is installed completely, or – if anything fails – not at all.
--
-- WHY. Every request of the app begins by asking the database for ALL the settings and the users list (web_boot: web.props
--   and the cache entry USERS_LIST – several KB) – more than twice a second on a busy site, all day. That was the largest part
--   of what the live database sent out (5 GB in 13 days; the free plan allows 5 GB a month).
-- NOW. web_boot2 answers exactly like web_boot, plus fingerprints (md5): "ver" of all the settings (every key and value) and
--   "hash" of every cache entry asked for. The server sends the fingerprints of what it already has (p_ver, p_have); what is
--   the same is not sent again (props = null; the entry is left out of "cache") and the server uses its copy. Any change of a
--   setting or an entry changes its fingerprint, so a change is always sent. Sign-in sessions are always sent (they are small).
--   The same for the "stamp" (the time of the last change of each main table, ~400 bytes): the server sends the fingerprint of
--   the stamp it has (p_stamp); when nothing changed only the fingerprint comes back ("sh"), else the stamp itself.
--   Without this step the app keeps working exactly as before (it uses web_boot).
-- =====================================================================
begin;

create or replace function public.web_boot2(p_keys text[], p_ver text, p_have jsonb, p_stamp text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ver text; v_st jsonb; v_sh text; v_out jsonb;
begin
  select coalesce(md5(string_agg(p.key || chr(31) || coalesce(p.value, ''), chr(30) order by p.key)), '') into v_ver from web.props p;
  v_st := public.web_stamp();
  v_sh := md5(coalesce(v_st ->> 'stamp', '') || chr(30) || coalesce((v_st -> 'tables')::text, ''));
  with c as (
    select c.key, c.value, md5(coalesce(c.value, '')) as h, floor(extract(epoch from (c.expires_at - now()))) as left_s
    from web.cache c where c.key = any(p_keys) and c.expires_at > now()
  )
  select jsonb_build_object(
    'ver', v_ver,
    'props', case when p_ver is not null and p_ver <> '' and p_ver = v_ver then null
                  else coalesce((select jsonb_object_agg(p.key, p.value) from web.props p), '{}'::jsonb) end,
    -- an entry the server already has with the same fingerprint: only its name ("same"); a new or changed one: its value and fingerprint
    'cache', coalesce((select jsonb_object_agg(c.key, c.value) from c where p_have is null or (p_have ->> c.key) is distinct from c.h), '{}'::jsonb),
    'hash',  coalesce((select jsonb_object_agg(c.key, c.h) from c where (p_have is null or (p_have ->> c.key) is distinct from c.h) and c.key not like 'S\_%'), '{}'::jsonb),      -- (a sign-in is never kept: no fingerprint)
    'same',  coalesce((select jsonb_agg(c.key) from c where p_have is not null and (p_have ->> c.key) = c.h), '[]'::jsonb),
    'left',  coalesce((select jsonb_object_agg(c.key, c.left_s) from c), '{}'::jsonb),
    'sh', v_sh)
  into v_out;
  -- the stamp itself only when the server does not have it already
  if p_stamp is null or p_stamp = '' or p_stamp <> v_sh then v_out := v_out || v_st; end if;
  return v_out;
end $$;

revoke all on function public.web_boot2(text[], text, jsonb, text) from public, anon, authenticated;
grant execute on function public.web_boot2(text[], text, jsonb, text) to service_role;

commit;
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step3_safety.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 3: safety (run once in Supabase → SQL Editor; safe to run again)
-- It only ADDS three functions and takes away two unused permissions. No table, no column and no saved data is changed.
-- The app works with or without it: without it, it simply keeps working the old way.
--
--   web_write(p)        – one save = one database transaction. A save usually writes several tables (e.g. Diesel Issue
--                         + the Log Book rows it changes). Before, each table was written by its own call: if one failed,
--                         the others stayed written. Now either everything of a save is written, or nothing.
--   web_count(key, ttl) – a counter that cannot be fooled by many calls at the same moment
--                         (wrong-password attempts; "the same entry was sent twice").
--   web_uncount(key)    – takes a counter away again.
-- Rollback: drop function public.web_write(jsonb); drop function public.web_count(text, int); drop function public.web_uncount(text);
-- =====================================================================

create or replace function public.web_write(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  w jsonb; t text; rel regclass; cols text; setlist text; idtype text; k int; n int := 0; d int := 0; bad text;
begin
  for w in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    t := w->>'table';
    select c.oid::regclass into rel from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname = t;
    if rel is null then raise exception 'web_write: "%" is not a table of the app', t; end if;
    if jsonb_typeof(w->'upserts') = 'array' and jsonb_array_length(w->'upserts') > 0 then
      -- every column sent must be a column of the table (as the REST API insists too)
      select string_agg(x, ', ') into bad from jsonb_object_keys(w->'upserts'->0) x
        where not exists (select 1 from pg_attribute a where a.attrelid = rel and a.attname = x and a.attnum > 0 and not a.attisdropped);
      if bad is not null then raise exception 'web_write: column(s) % are not in table %', bad, t; end if;
      select string_agg(format('%I', a.attname), ', ' order by a.attnum),
             string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ' order by a.attnum) filter (where a.attname <> 'id')
        into cols, setlist
        from pg_attribute a where a.attrelid = rel and a.attnum > 0 and not a.attisdropped and (w->'upserts'->0) ? a.attname::text;
      execute format('insert into %s (%s) select %s from jsonb_populate_recordset(null::%s, $1) on conflict (id) do %s',
        rel, cols, cols, rel, case when setlist is null then 'nothing' else 'update set ' || setlist end) using w->'upserts';
      get diagnostics k = row_count; n := n + k;
    end if;
    if jsonb_typeof(w->'deletes') = 'array' and jsonb_array_length(w->'deletes') > 0 then
      select format_type(a.atttypid, a.atttypmod) into idtype from pg_attribute a where a.attrelid = rel and a.attname = 'id';
      execute format('delete from %s where id = any (array(select jsonb_array_elements_text($1))::%s[])', rel, idtype) using w->'deletes';
      get diagnostics k = row_count; d := d + k;
    end if;
  end loop;
  return jsonb_build_object('written', n, 'deleted', d);
end $$;

-- a counter that counts correctly however many calls arrive together; it forgets itself p_ttl seconds after the last count
create or replace function public.web_count(p_key text, p_ttl int)
returns int language sql security definer set search_path = web, public as $$
  insert into web.cache as c (key, value, expires_at) values (p_key, '1', now() + make_interval(secs => greatest(1, p_ttl)))
  on conflict (key) do update
    set value = case when c.expires_at < now() or c.value !~ '^[0-9]+$' then '1' else (c.value::int + 1)::text end,
        expires_at = excluded.expires_at
  returning value::int;
$$;
create or replace function public.web_uncount(p_key text)
returns void language sql security definer set search_path = web, public as $$
  delete from web.cache where key = p_key;
$$;

revoke all on function public.web_write(jsonb) from public, anon, authenticated;
revoke all on function public.web_count(text, int) from public, anon, authenticated;
revoke all on function public.web_uncount(text) from public, anon, authenticated;
grant execute on function public.web_write(jsonb) to service_role;
grant execute on function public.web_count(text, int) to service_role;
grant execute on function public.web_uncount(text) to service_role;

-- the two trigger helpers are only ever run by the database itself: nobody needs the right to call them
revoke all on function public.note_delete() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step4_health.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 4: the app checks the database by itself (Admin → "Database" in the top bar)
-- Run once in Supabase → SQL Editor (safe to run again). It adds ONE function and changes no table, no row, no rule.
-- web_health() returns what sql/check_security.sql shows: row level security on every table, no public policy,
-- no function callable without the secret key, the "web" schema hidden. Only the server (secret key) can call it.
-- Until it is run the app still checks the columns and functions of every SQL step, and says that this file is missing.
-- Rollback: drop function public.web_health();
-- =====================================================================
create or replace function public.web_health()
returns jsonb language sql stable security definer set search_path = public, pg_catalog as $$
  select jsonb_build_object('findings', coalesce(jsonb_agg(f order by f desc), '[]'::jsonb)) from (
    select case when c.relrowsecurity then 'ok   ' else 'LOOK ' end || 'row level security on ' || n.nspname || '.' || c.relname as f
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'web') and c.relkind = 'r'
    union all
    select 'LOOK policy "' || policyname || '" on ' || schemaname || '.' || tablename || ' for ' || array_to_string(roles, ', ') from pg_policies where schemaname in ('public', 'web')
    union all
    select case when has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') then 'LOOK ' else 'ok   ' end
           || 'function ' || p.proname || ' – callable without the secret key: ' || (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))::text
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'trigger'::regtype
    union all
    select case when exists (select 1 from pg_namespace where nspname = 'web') and has_schema_privilege('anon', 'web', 'usage') then 'LOOK ' else 'ok   ' end || 'schema web hidden from the public API'
  ) x;
$$;
revoke all on function public.web_health() from public, anon, authenticated;
grant execute on function public.web_health() to service_role;
notify pgrst, 'reload schema';

-- ===================== MECHANICAL: supabase_step5_save_once.sql =====================
-- =====================================================================
-- RCL Fleet ERP – step 5: a save is saved ONCE, decided inside the database (update-68, decision D7)
-- Run once in Supabase → SQL Editor (safe to run again). It ADDS one small table (web.ops) and six functions.
-- No existing table, column, row or function is changed; web_write (step 3) stays exactly as it is.
-- The whole file is ONE transaction: it is installed completely, or – if anything fails – not at all.
--
-- WHY. The page gives every save its own number (rid) and sends the SAME save again when no answer comes. Until now the
--   server remembered "this number is done" in a separate note written AFTER the save. If the save went into the database
--   but its answer was lost (the connection dropped, the 30-second limit, a server stopped at that moment), the note was
--   never written – and the copy sent again was saved a SECOND time (a second Diesel Issue number, stock counted twice).
-- NOW. The number is written IN THE SAME TRANSACTION as the entry itself: either both are in the database or neither.
--   A copy of the same save that arrives later – on any server – finds the number, gets the first answer back and writes
--   nothing. Two copies at the same moment: the database lets exactly one of them write.
--
--   web.ops            one row per save number: whose it is (holder), what was sent (hash), started / done / refused, the answer
--   web_op_begin       "I want to run save number X": yours (run it) / done (here is its answer) / somebody is on it (wait)
--   web_op_mark        called INSIDE the write: "X is done" – refuses if X is no longer this server's (it was taken over)
--   web_write2         = web_op_mark + web_write in ONE transaction
--   web_op_end         after the request: the final answer / "refused" / "give the number back" (only if nothing was written)
--                      / "close": who does what follows a save (Activity Log line, telling the open pages) – exactly one request
--   web_ops_cleanup    old numbers are forgotten (see RETENTION below)
--   web_op_note        (used inside the functions only) the old-style note of a done save, for the code before update-68
--
-- WORKS WITH THE CODE THAT IS LIVE BEFORE update-68 (update-65): that code never calls these functions and never looks
--   at web.ops, so installing this file changes nothing for it (proved on the test rig: its whole test suite with and
--   without this file). The file can therefore be run BEFORE the new code is deployed, and while people are working.
-- UNTIL THIS FILE IS RUN the new code works exactly as the old (it notices the functions are missing and uses the old
--   way); the Admin's "Database" check shows this step as to do. The servers use it from their next save on; a save that
--   was started the old way just before is still finished the old way (web_op_begin answers "old" for a number that has
--   an old-style note in web.cache).
-- GOING BACK to the code before update-68 is covered too: when a save is done, the database also leaves the old-style
--   note for its number (web_op_note – in the same transaction as the entry). The older code looks for exactly that note,
--   so a copy of a save that reaches the older code after a roll-back gets the first answer and is not saved again.
--
-- SECURITY (reviewed 07-10-2026).
--   * Who can call: ONLY the server's secret key (role service_role). EXECUTE is taken from PUBLIC, anon and authenticated
--     explicitly (a Supabase project gives new functions to anon / authenticated by default – the revoke below undoes that).
--   * web.ops cannot be read or changed directly by anybody but the database owner (the Supabase dashboard): the schema
--     "web" is not offered by the API, no role has rights on the table (also taken from service_role – it works through
--     the functions only), and row-level security is on with no policy.
--   * The functions that touch web.ops / web.cache run with the owner's rights (SECURITY DEFINER) and have a FIXED, EMPTY
--     search_path: every table is written with its schema (web.ops, web.cache), so no object placed in another schema can
--     be picked up in its stead. web_write2 runs with the caller's rights (it only calls the two functions by full name).
--   * A save number is checked for its shape (8 – 64 letters, digits, _ or -). The same number with other data, or from
--     another sign-in, is refused; it is never answered with the first one's answer (web_op_begin: same = false).
--
-- RETENTION – the table cannot grow for ever (web_ops_cleanup):
--   * a number is forgotten 3 days after it was started (whatever its state);
--   * an answer longer than 2,000 letters is dropped after 24 hours (the number stays: a copy that comes that late is
--     still not saved again, it is answered "saved" without the details);
--   * never more than 200,000 numbers: beyond that the oldest are forgotten first (never one younger than 2 hours).
--   It runs by itself: about every 50th save (inside web_op_begin) and once a night with the backup job of the server.
--   Inside web_op_begin it can never stand in the way of a save: if the clean-up fails, the save goes on (10-10-2026).
--   To look:  select count(*), min(started_at), pg_size_pretty(pg_total_relation_size('web.ops')) from web.ops;
--   By hand:  select public.web_ops_cleanup();
--
-- ROLLBACK (the app goes back to the old way by itself, nothing else depends on these). Normally this step is LEFT IN
--   when the app goes back to older code – it does not disturb it. If it must be taken out while update-68 is live: do it
--   in a quiet minute (a save that is on its way at that very moment gets an error and must be pressed again).
--   drop function if exists public.web_write2(jsonb, text, text, text);
--   drop function if exists public.web_op_mark(text, text, text);
--   drop function if exists public.web_op_begin(text, text, text, int);
--   drop function if exists public.web_op_end(text, text, text, text);
--   drop function if exists public.web_ops_cleanup(int, int, int);
--   drop function if exists public.web_op_note(text, text);
--   drop table if exists web.ops;
-- =====================================================================

begin;

create table if not exists web.ops (
  rid        text primary key,                        -- the number the page gave this save
  hash       text not null,                           -- fingerprint of what was sent (who, which action, its data) – not the data itself
  holder     text not null,                           -- the request that may write it now (changes when a dead one is taken over)
  state      text not null default 'started',         -- started | done | refused
  result     text,                                    -- the answer (done) or the refusal (refused)
  started_at timestamptz not null default now(),
  done_at    timestamptz,                             -- when the entry went into the database
  closed_at  timestamptz                              -- when what follows a save was finished (Activity Log line, live refresh)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ops_state_known' and conrelid = 'web.ops'::regclass) then
    alter table web.ops add constraint ops_state_known check (state in ('started', 'done', 'refused'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ops_rid_shape' and conrelid = 'web.ops'::regclass) then
    alter table web.ops add constraint ops_rid_shape check (rid ~ '^[A-Za-z0-9_-]{8,64}$');
  end if;
end $$;
create index if not exists ops_started_at on web.ops (started_at);
alter table web.ops enable row level security;
revoke all on web.ops from public, anon, authenticated, service_role;      -- nobody works on the table itself: only the functions below

-- old numbers are forgotten. Answer: { deleted, trimmed, capped, rows, bytes }
create or replace function public.web_ops_cleanup(p_keep_days int default 3, p_answer_hours int default 24, p_max_rows int default 200000)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d int := 0; t int := 0; c int := 0; n bigint;
begin
  delete from web.ops where started_at < now() - make_interval(days => greatest(1, coalesce(p_keep_days, 3)));
  get diagnostics d = row_count;
  update web.ops set result = null
    where started_at < now() - make_interval(hours => greatest(1, coalesce(p_answer_hours, 24))) and state = 'done' and result is not null and length(result) > 2000;
  get diagnostics t = row_count;
  select count(*) into n from web.ops;
  if n > greatest(1000, coalesce(p_max_rows, 200000)) then
    delete from web.ops where rid in (select o.rid from web.ops o where o.started_at < now() - interval '2 hours'
      order by o.started_at limit (n - greatest(1000, coalesce(p_max_rows, 200000))));
    get diagnostics c = row_count; n := n - c;
  end if;
  return jsonb_build_object('deleted', d, 'trimmed', t, 'capped', c, 'rows', n, 'bytes', pg_total_relation_size('web.ops'::regclass));
end $$;

-- The note the code BEFORE update-68 keeps for a done save (web.cache: "OPC_<number>" = it was counted, "OPR_<number>" = its
-- answer; one hour, as that code keeps it). Written here by the database when a save is done, so that after a roll-back the
-- older code finds it and does not save a copy again. Called only from the functions below (nobody may call it from outside).
create or replace function public.web_op_note(p_rid text, p_result text)
returns void language sql security definer set search_path = '' as $$
  insert into web.cache as c (key, value, expires_at)
  values ('OPC_' || p_rid, '1', now() + interval '1 hour'),
         ('OPR_' || p_rid, coalesce(nullif(p_result, ''), '{"ok":true,"_resent":true}'), now() + interval '1 hour')
  on conflict (key) do update set value = case when c.key like 'OPC\_%' and c.expires_at > now() then c.value else excluded.value end, expires_at = excluded.expires_at;
$$;

-- "I want to run save number p_rid". Answer: { mine, state, same, result, age, closed }
--   mine  = true  → this request runs the save (the number is new, or its first owner died long ago without writing)
--   state = done  → it is already saved: `result` is its answer;  refused → `result` is the refusal
--   same  = false → the number was used for a DIFFERENT entry (never run, never answered with the other one's data)
--   state = old   → this number was started or finished the old way (its note is in web.cache): it is finished the old way
--   closed = false with state done → the entry is in, but the request that saved it has not finished what follows a save
create or replace function public.web_op_begin(p_rid text, p_hash text, p_holder text, p_stale int default 75)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r web.ops%rowtype; n int; mine boolean := false;
begin
  -- housekeeping, now and then (also once a night by the server). It must never stand in the way of a save: if it fails, the save goes on.
  if random() < 0.02 then begin perform public.web_ops_cleanup(); exception when others then null; end; end if;
  -- the change-over to this step: a number a server handled the old way (before this file was run) stays with the old way
  if not exists (select 1 from web.ops o where o.rid = p_rid)
     and exists (select 1 from web.cache c where c.key in ('OPR_' || p_rid, 'OPT_' || p_rid, 'OPC_' || p_rid) and c.expires_at > now()) then
    return jsonb_build_object('mine', false, 'state', 'old', 'same', true);
  end if;
  insert into web.ops (rid, hash, holder) values (p_rid, p_hash, p_holder) on conflict (rid) do nothing;
  get diagnostics n = row_count; mine := (n = 1);
  if not mine then
    -- a copy that started long ago and never finished: taken over. (If a write of that copy is still on its way, this line
    -- WAITS for it – it holds the row; when it went through, the state is "done" and nothing is taken over.)
    update web.ops o set holder = p_holder, started_at = now()
      where o.rid = p_rid and o.state = 'started' and o.hash = p_hash and o.holder <> p_holder and o.started_at < now() - make_interval(secs => greatest(5, coalesce(p_stale, 75)));
    get diagnostics n = row_count; mine := (n = 1);
  end if;
  select * into r from web.ops o where o.rid = p_rid;
  if not found then return jsonb_build_object('mine', false, 'state', 'gone', 'same', true); end if;
  -- (asked twice by the same request – its first question was answered but the answer was lost: still its own)
  if r.holder = p_holder and r.state = 'started' then mine := true; end if;
  -- the answer of a save is given only for the SAME fingerprint (same sign-in, same action, same data)
  return jsonb_build_object('mine', mine, 'state', r.state, 'same', r.hash = p_hash, 'result', case when r.hash = p_hash then r.result else null end,
    'age', round(extract(epoch from now() - r.started_at))::int, 'closed', r.closed_at is not null);
end $$;

-- inside the write: "p_rid is done, here is its answer" – only for the request that holds it
create or replace function public.web_op_mark(p_rid text, p_holder text, p_result text)
returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update web.ops o set state = 'done', result = p_result, done_at = now() where o.rid = p_rid and o.holder = p_holder and o.state = 'started';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'OP_NOT_MINE: save % is no longer this request''s (already done, or taken over) – nothing was written', p_rid; end if;
  perform public.web_op_note(p_rid, p_result);      -- (in the same transaction as the entry: both are there, or neither)
end $$;

-- the write of a save: its number and its rows in ONE transaction (all of it, or nothing)
create or replace function public.web_write2(p jsonb, p_rid text, p_holder text, p_result text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform public.web_op_mark(p_rid, p_holder, p_result);
  return public.web_write(p);
end $$;

-- after the request.  p_state: 'done' (keep the final answer; what follows the save is finished) | 'refused' (keep the
--   refusal) | 'free' (give the number back) – each only for the request that holds the number, and "refused" / "free" only
--   while NOTHING was written (state still 'started'). If a write of this save is still on its way, the call waits for it.
-- 'close' = "the entry is in, but what follows a save was never finished (the server that saved it got no answer, or
--   stopped): I do it now". Exactly ONE request gets n = 1 – whoever asks first, whichever server.
-- Answer: { n, state, result, mine, closed } as the row is now. (Only the server calls this, for a number web_op_begin gave
--   it or showed it as done with the SAME fingerprint; a number can only be taken over by a copy with the same fingerprint.)
create or replace function public.web_op_end(p_rid text, p_holder text, p_state text, p_result text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r web.ops%rowtype; n int := 0;
begin
  if p_state = 'done' then
    update web.ops o set state = 'done', result = coalesce(p_result, o.result), done_at = coalesce(o.done_at, now()), closed_at = coalesce(o.closed_at, now())
      where o.rid = p_rid and o.holder = p_holder and o.state in ('started', 'done');
    get diagnostics n = row_count;
    if n = 1 then perform public.web_op_note(p_rid, (select o.result from web.ops o where o.rid = p_rid)); end if;      -- the final answer, for the older code too
    select * into r from web.ops o where o.rid = p_rid;
    return jsonb_build_object('n', n, 'state', coalesce(r.state, 'gone'), 'result', r.result, 'mine', r.holder = p_holder, 'closed', r.closed_at is not null);
  elsif p_state = 'refused' then
    update web.ops o set state = 'refused', result = p_result, done_at = now() where o.rid = p_rid and o.holder = p_holder and o.state = 'started';
  elsif p_state = 'free' then
    delete from web.ops o where o.rid = p_rid and o.holder = p_holder and o.state = 'started';
  elsif p_state = 'close' then
    update web.ops o set closed_at = now() where o.rid = p_rid and o.state = 'done' and o.closed_at is null;
  else
    raise exception 'web_op_end: state "%" is not known', p_state;
  end if;
  get diagnostics n = row_count;
  select * into r from web.ops o where o.rid = p_rid;
  if not found then return jsonb_build_object('n', n, 'state', 'gone'); end if;
  return jsonb_build_object('n', n, 'state', r.state, 'result', r.result, 'mine', r.holder = p_holder, 'closed', r.closed_at is not null);
end $$;

-- only the secret key (service_role) may call these
revoke all on function public.web_op_begin(text, text, text, int) from public, anon, authenticated;
revoke all on function public.web_op_mark(text, text, text) from public, anon, authenticated;
revoke all on function public.web_write2(jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.web_op_end(text, text, text, text) from public, anon, authenticated;
revoke all on function public.web_ops_cleanup(int, int, int) from public, anon, authenticated;
revoke all on function public.web_op_note(text, text) from public, anon, authenticated, service_role;      -- inside use only
grant execute on function public.web_op_begin(text, text, text, int) to service_role;
grant execute on function public.web_op_mark(text, text, text) to service_role;
grant execute on function public.web_write2(jsonb, text, text, text) to service_role;
grant execute on function public.web_op_end(text, text, text, text) to service_role;
grant execute on function public.web_ops_cleanup(int, int, int) to service_role;

notify pgrst, 'reload schema';

commit;

-- ===================== TEST: company and site name (before step 7, which names site S1 from it) =====================
insert into web.props (key, value) values ('ORG_SETTINGS',
  '{"customer":"TEST Co","site":"TEST Site (staging)","logo":"","billNames":["TEST Co"],"intro":true,"video":""}')
on conflict (key) do nothing;

-- ===================== MECHANICAL: supabase_step7_sites.sql =====================
-- =====================================================================
-- RCL Fleet ERP – SEVERAL SITES, ONE APP (update-90, stage 2 of "new site")
-- Run ONCE, and ONLY in the database of the FIRST site (VTR) – the one whose link is in Vercel (SUPABASE_URL).
-- Supabase → SQL Editor → New query → paste → Run. It can be run again safely.
--
-- Only ADDS 4 new tables. Not one existing table, row or column is changed:
--   rcl_super_admin  the Super Admin (system only: sites, users and access, companies – no entries, no reports)
--   rcl_companies    the companies a site belongs to (Rachana, Sketchline …): name, address, GSTIN, PAN, logo
--   rcl_sites        the sites: this one is the first ("S1", its database is the one in Vercel – nothing about it is stored);
--                    other sites (stage 3) keep their database's link and key LOCKED (encrypted with a key only Vercel has)
--   rcl_user_sites   which user has which site, and his default site
-- Every user of this site today becomes a user of site S1 (copied from app_users – app_users itself is not touched).
-- The tables are for the server only (secret key): row level security on, no policy, nothing for anon / authenticated.
-- =====================================================================
create table if not exists public.rcl_super_admin (
  email text primary key, name text, password_hash text not null, recovery_hash text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- there is ONE Super Admin: a second row is refused by the database itself
create unique index if not exists rcl_super_admin_only_one on public.rcl_super_admin ((true));
create table if not exists public.rcl_companies (
  id text primary key, name text not null, address text, gstin text, pan text, logo text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.rcl_sites (
  code text primary key, name text, company_id text references public.rcl_companies (id), home boolean not null default false,
  status text not null default 'ready', sheet text, db_url text, db_key_enc text, db_conn_enc text, sort int not null default 0,
  created_by text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists rcl_sites_one_home on public.rcl_sites (home) where home;
create table if not exists public.rcl_user_sites (
  email text not null, site text not null references public.rcl_sites (code), is_admin boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (email, site)
);
create index if not exists rcl_user_sites_email on public.rcl_user_sites (email);

drop trigger if exists rcl_super_admin_touch on public.rcl_super_admin;
create trigger rcl_super_admin_touch before update on public.rcl_super_admin for each row execute function public.touch_updated_at();
drop trigger if exists rcl_companies_touch on public.rcl_companies;
create trigger rcl_companies_touch before update on public.rcl_companies for each row execute function public.touch_updated_at();
drop trigger if exists rcl_sites_touch on public.rcl_sites;
create trigger rcl_sites_touch before update on public.rcl_sites for each row execute function public.touch_updated_at();
drop trigger if exists rcl_user_sites_touch on public.rcl_user_sites;
create trigger rcl_user_sites_touch before update on public.rcl_user_sites for each row execute function public.touch_updated_at();

alter table public.rcl_super_admin enable row level security;
alter table public.rcl_companies enable row level security;
alter table public.rcl_sites enable row level security;
alter table public.rcl_user_sites enable row level security;
revoke all on public.rcl_super_admin, public.rcl_companies, public.rcl_sites, public.rcl_user_sites from public, anon, authenticated;
grant select, insert, update, delete on public.rcl_super_admin, public.rcl_companies, public.rcl_sites, public.rcl_user_sites to service_role;

-- this site = site S1 (its name: the site name of "Company & site", if it was set – a setting that cannot be read leaves it empty)
do $$
declare nm text;
begin
  begin
    select nullif(trim(value::jsonb ->> 'site'), '') into nm from web.props where key = 'ORG_SETTINGS';
  exception when others then nm := null;
  end;
  if not exists (select 1 from public.rcl_sites where home) then
    insert into public.rcl_sites (code, name, home, status, sort) values ('S1', nm, true, 'ready', 1);
  end if;
end $$;
-- every user of this site today is a user of S1 (with his Admin mark); a user already listed is left as he is
insert into public.rcl_user_sites (email, site, is_admin)
select lower(trim(u.email)), (select code from public.rcl_sites where home), upper(coalesce(u.admin, '')) = 'YES'
  from public.app_users u
 where coalesce(trim(u.email), '') <> '' and upper(coalesce(u.active, 'YES')) <> 'NO'
on conflict (email, site) do nothing;

-- the database's web layer learns the new tables at once
notify pgrst, 'reload schema';

-- what is there now (a look – it changes nothing)
select 'sites: ' || (select count(*) from public.rcl_sites) || ' · people on sites: ' || (select count(*) from public.rcl_user_sites)
       || ' · super admin: ' || (select count(*) from public.rcl_super_admin) as done;

-- ===================== STORE: store_step1_items.sql =====================
-- =====================================================================
-- RCL ERP – STORE, step 1: the Item Master (and the Store's sign-ins).
-- Run ONCE in EVERY site's Supabase project (the same project as that site's Mechanical): RCL - VTR NH 848, 18B, …
-- Supabase → SQL Editor → New query → paste → Run. It can be run again safely; it only ADDS – nothing of Mechanical is
-- touched, no data is changed or deleted.
--
--   items           the Item Master of this site: code (ITM-0001 …, given by the database), name, unit, category, HSN,
--                   GST %, min stock, Active / Inactive. A name is there once (name_key: small letters and digits only).
--                   Common to every module of the site (Mechanical's maintenance will use the same items later).
--   store_sessions  the Store's sign-ins (only a fingerprint of each)
--   store_tickets   the Portal tickets already used (a ticket opens the Store once)
--   store_activity  who did what in the Store, when
-- Every table is for the server only: row level security on, nothing for anon / authenticated.
-- Rollback (only while no item is entered): drop table public.store_activity, public.store_tickets, public.store_sessions, public.items; drop sequence public.items_code_seq;
-- =====================================================================
create sequence if not exists public.items_code_seq;
create table if not exists public.items (
  code text primary key default ('ITM-' || lpad(nextval('public.items_code_seq')::text, 4, '0')),
  name text not null, name_key text not null, unit text not null, category text not null,
  hsn text, gst_pct numeric, min_stock numeric,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  similar_note text,          -- "Sugaar: not the same as ITM-0001 Sugar – said by …" (a near name saved on purpose)
  created_by text, updated_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists items_name_key on public.items (name_key);
create table if not exists public.store_sessions (
  id_hash text primary key, email text not null, name text, is_admin boolean not null default false,
  info jsonb, created_at timestamptz not null default now(), expires_at timestamptz not null
);
create index if not exists store_sessions_email on public.store_sessions (email);
create table if not exists public.store_tickets (jti text primary key, expires_at timestamptz not null);
create table if not exists public.store_activity (
  id bigserial primary key, at timestamptz not null default now(), email text, action text not null, target text, detail jsonb
);
create index if not exists store_activity_at on public.store_activity (at desc);

create or replace function public.store_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.store_touch();

do $$ declare t text; begin
  foreach t in array array['items', 'store_sessions', 'store_tickets', 'store_activity'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
revoke all on sequence public.items_code_seq from public, anon, authenticated;
grant usage, select on sequence public.items_code_seq, public.store_activity_id_seq to service_role;
revoke all on function public.store_touch() from public, anon, authenticated;

notify pgrst, 'reload schema';
select 'Store step 1 done · items ' || (select count(*) from public.items) as done;

-- ===================== PORTAL: portal_step1.sql =====================
-- =====================================================================
-- RCL ERP – PORTAL, step 1: everything the Portal keeps (run ONCE in the Portal's own Supabase project – rcl-portal)
-- Supabase → SQL Editor → New query → paste → Run. It can be run again safely; it never deletes or changes data.
--
--   companies   Rachana, Sketchline … (name, address, GSTIN, PAN, logo)
--   sites       VTR NH 848, Kolhapur 18B … (code, name, company)
--   modules     Mechanical (live), later Engineering, Store, Billing (name, link, on/off)
--   users       everybody who signs in: email, name, kept password (scrypt – the same form as in Mechanical, so passwords
--               move over unchanged), active, Super Admin mark, the Super Admin's recovery code (kept as a hash)
--   access      who may open which module on which site, and as what (admin / user)
--   sessions    sign-ins (only a fingerprint of each sign-in is kept, never the sign-in itself)
--   audit       who changed what, when
--   counters    sign-in limits (5 wrong passwords → 15 minutes; 60 sign-ins a minute)
--   signing_keys the Portal's key for the module "tickets" (its secret half is kept LOCKED with a key only Vercel has)
-- Every table is for the server only: row level security on, no policy, nothing for anon / authenticated.
-- =====================================================================
create table if not exists public.companies (
  id text primary key, name text not null, address text, gstin text, pan text, logo text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sites (
  code text primary key check (code ~ '^[A-Z0-9]{1,12}$'), name text not null, company_id text references public.companies (id),
  status text not null default 'active' check (status in ('active', 'closed')), sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.modules (
  key text primary key check (key ~ '^[a-z]{2,20}$'), name text not null, url text, status text not null default 'off' check (status in ('live', 'off')),
  sort int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.users (
  email text primary key check (email = lower(email)), name text not null, password_hash text, active boolean not null default true,
  is_super boolean not null default false, recovery_hash text, last_login_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- there is ONE Super Admin: a second one is refused by the database itself
create unique index if not exists users_one_super on public.users ((is_super)) where is_super;
create table if not exists public.access (
  email text not null references public.users (email) on update cascade, site text not null references public.sites (code),
  module text not null references public.modules (key), role text not null check (role in ('admin', 'user')),
  granted_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (email, site, module)
);
create index if not exists access_site on public.access (site, module);
create table if not exists public.sessions (
  id_hash text primary key, email text not null references public.users (email) on update cascade on delete cascade,
  created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), expires_at timestamptz not null,
  user_agent text
);
create index if not exists sessions_email on public.sessions (email);
create table if not exists public.audit (
  id bigserial primary key, at timestamptz not null default now(), actor text, action text not null, target text, detail jsonb
);
create index if not exists audit_at on public.audit (at desc);
create table if not exists public.counters (
  key text primary key, n int not null default 0, expires_at timestamptz not null
);
create table if not exists public.signing_keys (
  kid text primary key, public_jwk jsonb not null, private_sealed text not null, active boolean not null default true,
  created_at timestamptz not null default now()
);

-- one count, done inside the database (two sign-ins at the same moment can never both slip under the limit)
create or replace function public.portal_hit(p_key text, p_ttl int) returns int language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  insert into public.counters as c (key, n, expires_at) values (p_key, 1, now() + make_interval(secs => p_ttl))
  on conflict (key) do update set
    n = case when c.expires_at < now() then 1 else c.n + 1 end,
    expires_at = case when c.expires_at < now() then now() + make_interval(secs => p_ttl) else c.expires_at end
  returning n into v;
  if random() < 0.01 then delete from public.counters where expires_at < now() - interval '1 hour'; end if;
  return v;
end $$;
create or replace function public.portal_unhit(p_key text) returns void language sql security definer set search_path = '' as $$
  delete from public.counters where key = p_key;
$$;
create or replace function public.portal_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['companies', 'sites', 'modules', 'users', 'access'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.portal_touch()', t || '_touch', t);
  end loop;
  foreach t in array array['companies', 'sites', 'modules', 'users', 'access', 'sessions', 'audit', 'counters', 'signing_keys'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.audit_id_seq to service_role;
revoke all on function public.portal_hit(text, int) from public, anon, authenticated;
revoke all on function public.portal_unhit(text) from public, anon, authenticated;
revoke all on function public.portal_touch() from public, anon, authenticated;
grant execute on function public.portal_hit(text, int) to service_role;
grant execute on function public.portal_unhit(text) to service_role;

-- the first module: Mechanical (its link is set by the Super Admin in the Portal)
insert into public.modules (key, name, status, sort) values ('mechanical', 'Mechanical', 'live', 1) on conflict (key) do nothing;

-- the database's web layer learns the new tables at once
notify pgrst, 'reload schema';

select 'Portal step 1 done · companies ' || (select count(*) from public.companies) || ' · sites ' || (select count(*) from public.sites)
       || ' · users ' || (select count(*) from public.users) || ' · modules ' || (select count(*) from public.modules) as done;

-- ===================== PORTAL: portal_step2_start.sql =====================
-- RCL Portal – step 2: the module a person opens straight after signing in (his own choice, "My start").
-- Supabase (the Portal's project) → SQL Editor → New query → paste → Run. It can be run again safely.
-- It only ADDS one empty column to the users table; no row, no password and no access changes.
alter table public.users add column if not exists start_item text;      -- 'module|SITE', e.g. 'mechanical|S1'; empty = none
comment on column public.users.start_item is 'The module and site that open right after sign-in (chosen by the person on his dashboard).';
notify pgrst, 'reload schema';
select 'Portal step 2 done · users ' || (select count(*) from public.users) || ' · column start_item ' ||
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'start_item') then 'there' else 'MISSING' end as done;

-- ===================== PORTAL: portal_step3_pages.sql =====================
-- RCL Portal – step 3: the pages of a module a person may open on a site (set by the Super Admin under Users & Access → Pages).
-- Used by the Store (Dashboard: View / No access; Item Master: Edit / View / No access). Mechanical keeps its pages itself, as
-- before. Supabase (the Portal's project) → SQL Editor → New query → paste → Run. It can be run again safely.
-- It only ADDS one empty column to the access table; no row, no password and no access changes. Empty = every page, as before.
alter table public.access add column if not exists pages jsonb;
comment on column public.access.pages is 'The pages of the module (e.g. {"dashboard":"View","items":"Edit"}); empty = every page.';
notify pgrst, 'reload schema';
select 'Portal step 3 done · access ' || (select count(*) from public.access) || ' · column pages ' ||
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'access' and column_name = 'pages') then 'there' else 'MISSING' end as done;

-- ===================== TEST ENTRIES (all made up) =====================
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
update public.modules set url = 'https://rclerp-git-staging-pk12356843.vercel.app', status = 'live' where key = 'mechanical' and coalesce(url, '') = '';
insert into public.modules (key, name, url, status, sort) values ('store', 'Store', 'https://rclerp-git-staging-pk12356843.vercel.app/store', 'live', 2) on conflict (key) do nothing;
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
