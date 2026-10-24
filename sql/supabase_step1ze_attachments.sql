-- =====================================================================
-- RCL Fleet ERP – step 1ze: attachments of a Log Book entry (update-153)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …), AFTER step 1zd. Safe to run again.
-- It only ADDS:
--   1. one empty column "attachments" to log_book – the list of the entry's photos / PDFs (the fingerprint, SHA-256, of each file,
--      where it is kept, its kind, size and name, who added it and when);
--   2. one PRIVATE place for the files (Storage bucket "erp-files"): JPG, PNG and PDF, at most 10 MB a file. Private = a file opens
--      only through the app, with a link that works for 15 minutes. Each file is kept ONCE under its fingerprint (the same photo
--      attached to two entries is one file) and is never overwritten or deleted by the app.
-- No existing column, row or rule is changed. Until it is run the app works as before; adding an attachment says this file must be
-- run first. The entry guard of step 1zd already counts the attachments as part of the entry (only the Super Admin changes those of an
-- approved or billed entry).
-- Rollback (only while no entry has attachments): alter table public.log_book drop column attachments;
--   and in Supabase → Storage delete the bucket erp-files (it must be empty).
-- =====================================================================
alter table public.log_book add column if not exists attachments text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('erp-files', 'erp-files', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
select 'Step 1ze done · log_book.attachments ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'log_book' and column_name = 'attachments')
  || ' · bucket erp-files ' || (select count(*) from storage.buckets where id = 'erp-files') as done;
