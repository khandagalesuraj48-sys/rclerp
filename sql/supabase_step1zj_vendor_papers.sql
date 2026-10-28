-- =====================================================================
-- RCL Fleet ERP – step 1zj: the vendor's Owner Name and its documents (update-184)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, HEAD OFFICE, …). Safe to run again.
-- It only ADDS two empty columns to vendors: owner_name (the Owner Name beside the Company Name) and documents (the list of the
-- vendor's papers – Aadhaar, PAN, GST, Udyam, bank details … – each a PDF or a photo kept in the private store erp-files of step
-- 1ze, as a bill's files). No existing column, row or rule is changed. Until it is run, a vendor is saved as before.
-- Rollback (only while no vendor has an Owner Name or a document): alter table public.vendors drop column owner_name; alter table public.vendors drop column documents;
-- =====================================================================
alter table public.vendors add column if not exists owner_name text;
alter table public.vendors add column if not exists documents text;

notify pgrst, 'reload schema';
select 'Step 1zj done · vendors ' || (select count(*) from public.vendors)
  || ' · vendors.owner_name ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'vendors' and column_name = 'owner_name')
  || ' · vendors.documents ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'vendors' and column_name = 'documents') as done;
