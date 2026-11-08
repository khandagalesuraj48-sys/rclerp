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
