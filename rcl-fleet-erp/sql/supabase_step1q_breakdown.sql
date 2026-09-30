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
