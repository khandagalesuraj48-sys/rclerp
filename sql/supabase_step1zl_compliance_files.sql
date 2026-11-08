-- =====================================================================
-- RCL Fleet ERP – step 1zl: the documents of Vehicle Compliance (update-205)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, HEAD OFFICE, …). Safe to run again.
-- It only ADDS one empty column to compliance_history: attachments (the list of the files of a renewal – the PDF / photos of a
-- paper (Tax, PUC, Permit, Fitness, Insurance) – and of the machinery's RC Book and Tax Invoice, each kept in the private store
-- erp-files of step 1ze, as a Log Book entry's files). No existing column, row or rule is changed. Until it is run, Vehicle
-- Compliance works as before (without documents) and says this file must be run first.
-- Rollback (only while no line has a file): alter table public.compliance_history drop column attachments;
-- =====================================================================
alter table public.compliance_history add column if not exists attachments text;

notify pgrst, 'reload schema';
select 'Step 1zl done · compliance_history ' || (select count(*) from public.compliance_history)
  || ' · compliance_history.attachments ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'compliance_history' and column_name = 'attachments') as done;
