-- =====================================================================
-- RCL Fleet ERP – step 1w: split timing of a Log Book entry measured by Time (e.g. 11:00-13:00 and 14:00-17:00)
-- Run once in Supabase → SQL Editor (safe to run again). It only ADDS one empty column to log_book.
-- No existing column, row or rule is changed. The hours of an entry stay where they are (start_time, end_time,
-- break_min, time_hrs); this column only keeps HOW the time was split, to show and print it.
-- Until it is run the app works as before; an entry with MORE THAN ONE From – To is refused with a message
-- that names this file (an entry with one From – To is saved as always).
-- Rollback: alter table public.log_book drop column time_slots;
-- =====================================================================
alter table public.log_book add column if not exists time_slots text;   -- "11:00-13:00,14:00-17:00"; empty = one From – To (every entry so far)
notify pgrst, 'reload schema';
