-- =====================================================================
-- RCL Fleet ERP – step 1u: Log Book entries without a reading (meter not working) and "new meter"
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS one empty column to log_book.
-- No existing column, row or rule is changed. Until it is run the app works as before; a "No reading" or
-- "New meter" entry is refused with a message that names this file.
-- Rollback: alter table public.log_book drop column meter_note;
-- =====================================================================
alter table public.log_book add column if not exists meter_note text;   -- "No reading – <reason>" or "New meter – <reason>"
notify pgrst, 'reload schema';
