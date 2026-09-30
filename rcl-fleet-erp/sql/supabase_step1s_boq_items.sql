-- =====================================================================
-- RCL Fleet ERP – Item-wise BOQ: the work of a Log Book entry shared between the items of the BOQ (e.g. Bucket / Breaker)
-- Only ADDS a column. Nothing that is saved changes. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs).
-- The items themselves (name, rent type, rate, slabs) are kept inside the BOQ line (boq.lines) – no new table is needed.
-- =====================================================================
alter table public.log_book add column if not exists item_work text;
