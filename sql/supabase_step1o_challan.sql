-- =====================================================================
-- RCL Fleet ERP – Log Book: Challan No for trip entries
-- Only ADDS a column. Run once in Supabase → SQL Editor → New query → paste → Run (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.log_book add column if not exists challan_no text;
