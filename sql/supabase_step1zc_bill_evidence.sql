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
