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
