-- =====================================================================
-- RCL Fleet ERP – who entered / changed each entry
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master          add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.diesel_inward   add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.diesel_transfer add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.diesel_issue    add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.log_book        add column if not exists entered_by text, add column if not exists updated_by text;
alter table public.tank_check      add column if not exists entered_by text, add column if not exists updated_by text;
