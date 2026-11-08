-- =====================================================================
-- RCL Fleet ERP – step 1za: a machinery on a site several times (update-119)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one empty column "site_periods" to master: the earlier periods a machinery was on the site (it left and came
-- back later), as the app writes them: [{"from":"2026-01-01","until":"2026-07-01"}, …]. Its current period stays in Active From /
-- Status / Inactive From, as before. No table, column, row or rule is changed. Until it is run, a machinery that comes back
-- cannot be saved with its earlier period (the app says that this file must be run first); everything else works as before.
-- Rollback: alter table public.master drop column site_periods;
-- =====================================================================
alter table public.master add column if not exists site_periods text;

notify pgrst, 'reload schema';
select 'Step 1za done · master.site_periods ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'master' and column_name = 'site_periods') as done;
