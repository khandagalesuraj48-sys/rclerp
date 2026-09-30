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
