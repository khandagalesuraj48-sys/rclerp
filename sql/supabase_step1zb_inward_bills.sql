-- =====================================================================
-- RCL Fleet ERP – step 1zb: the bill copies of a diesel inward (update-120)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one empty column "photos" to diesel_inward: the list of the inward's bill copy photos, as the app writes them:
-- [{"p":"inward/2026-10/<id>.jpg","at":"…"}, …]. The pictures themselves go to the PRIVATE place of the diesel photos
-- (Storage bucket "diesel-photos", made by step 1x), in its folder inward/. No table, column, row or rule is changed.
-- Until it is run the app works as before; adding a bill copy says that this file must be run first.
-- Rollback (only while no inward has bill copies): alter table public.diesel_inward drop column photos;
-- =====================================================================
alter table public.diesel_inward add column if not exists photos text;

notify pgrst, 'reload schema';
select 'Step 1zb done · diesel_inward.photos ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'diesel_inward' and column_name = 'photos') as done;
