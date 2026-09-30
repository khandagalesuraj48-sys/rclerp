-- =====================================================================
-- RCL Fleet ERP – Users: access column for the new page "Bill Summary"
-- Only ADDS a column. Everyone starts with "No access"; Admin gives it in Users & Access (Admin has it already).
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.app_users add column if not exists perm_bill_summary text;
update public.app_users set perm_bill_summary = case when upper(coalesce(admin, '')) = 'YES' then 'Edit' else 'No access' end where perm_bill_summary is null;
