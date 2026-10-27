-- =====================================================================
-- RCL Fleet ERP – step 1zg: the fuel of each machinery – Diesel / Petrol / CNG / Electric (update-163)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, HEAD OFFICE, …). Safe to run again.
-- It only ADDS one empty column "fuel" to master. Empty = Diesel, so every machinery of before stays Diesel and nothing else
-- is changed (no table, column, row or rule). Until it is run, a machinery can be saved only as Diesel (the app says that this
-- file must be run first); everything else works as before. The fuel of each diesel place is kept in the site's settings (no
-- SQL for it).
-- Rollback: alter table public.master drop column fuel;
-- =====================================================================
alter table public.master add column if not exists fuel text;

notify pgrst, 'reload schema';
select 'Step 1zg done · master.fuel ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'master' and column_name = 'fuel') as done;
