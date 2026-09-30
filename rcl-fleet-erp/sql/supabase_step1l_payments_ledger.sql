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
