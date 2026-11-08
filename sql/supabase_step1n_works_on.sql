-- =====================================================================
-- RCL Fleet ERP – what each machinery works on (Day / Trip / KM / Hrs / Time) and Log Book entries on Time
-- Only ADDS columns. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists works_on text;
alter table public.log_book add column if not exists start_time text;
alter table public.log_book add column if not exists end_time text;
alter table public.log_book add column if not exists break_min numeric;
alter table public.log_book add column if not exists time_hrs numeric;
-- the machinery already there keep what they had: KM → KM, Hrs → Hrs, KM + Hrs → KM, Hrs
update public.master set works_on = case unit when 'KM' then 'KM' when 'Hrs' then 'Hrs' when 'KM + Hrs' then 'KM, Hrs' else works_on end
  where works_on is null or works_on = '';
