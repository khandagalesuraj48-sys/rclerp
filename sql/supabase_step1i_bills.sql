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
