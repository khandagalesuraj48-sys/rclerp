-- =====================================================================
-- RCL Fleet ERP – step 1zi: the Maintenance Log Book of a site on fuel cards (update-165)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, HEAD OFFICE, …). Safe to run again.
-- It only ADDS: the table maintenance (the maintenance bills of the cars – each bill with its lines, its total, a Service mark
-- and its files) and the empty access column of the new page "Maintenance" (empty = No access). Nothing is changed or deleted.
-- A site that is not on fuel cards (VTR, 18B) does not use any of it. The bills' files are kept in the private store erp-files
-- (step 1ze), as the Log Book's attachments.
-- Rollback: drop table public.maintenance; alter table public.app_users drop column perm_maintenance;
-- =====================================================================
create table if not exists public.maintenance (
  id text primary key, date date, machinery text, garage text, bill_no text, km_reading numeric, amount numeric, lines text,
  service text, remark text, files text, entered_at timestamptz, entered_by text, updated_by text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists maintenance_touch on public.maintenance;
create trigger maintenance_touch before update on public.maintenance for each row execute function public.touch_updated_at();
drop trigger if exists maintenance_deleted on public.maintenance;
create trigger maintenance_deleted after delete on public.maintenance for each row execute function public.note_delete();
alter table public.maintenance enable row level security;
create index if not exists maintenance_updated_at on public.maintenance (updated_at);
create index if not exists maintenance_machinery on public.maintenance (machinery, date);
grant select, insert, update, delete on public.maintenance to service_role;

-- access for the new page: empty = No access (the Super Admin gives it in the Portal → Users & Access → Pages)
alter table public.app_users add column if not exists perm_maintenance text;

notify pgrst, 'reload schema';
select 'Step 1zi done · maintenance ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'maintenance')
  || ' · app_users.perm_maintenance ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'app_users' and column_name = 'perm_maintenance') as done;
