-- =====================================================================
-- RCL Fleet ERP – Log Book print format of each machinery (Format A, B, …)
-- Only ADDS a column. Every machinery starts on Format A. Run once in Supabase → SQL Editor → New query → paste → Run
-- (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists log_book_format text;
update public.master set log_book_format = 'A' where log_book_format is null or log_book_format = '';
