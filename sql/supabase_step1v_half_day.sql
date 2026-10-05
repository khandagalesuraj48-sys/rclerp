-- =====================================================================
-- RCL Fleet ERP – step 1v: "Half day" on a Log Book entry (it is paid as half a day in the bill)
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS one empty column to log_book.
-- No existing column, row or rule is changed. Until it is run the app works as before; a "½ day" entry is
-- refused with a message that names this file.
-- Rollback: alter table public.log_book drop column day_part;
-- =====================================================================
alter table public.log_book add column if not exists day_part numeric;   -- 0.5 = half day; empty = a whole day (every entry so far)
notify pgrst, 'reload schema';
