-- =====================================================================
-- RCL Fleet ERP – Log Book: opening diesel typed on the 1st of a month
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.log_book add column if not exists opening_diesel_set numeric;
