-- =====================================================================
-- RCL Fleet ERP – Master: Monthly Rate and TDS Rate (Rental / Hired machinery)
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists monthly_rate numeric;
alter table public.master add column if not exists tds_rate numeric;
