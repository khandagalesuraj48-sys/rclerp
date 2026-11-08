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
