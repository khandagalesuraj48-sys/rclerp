-- =====================================================================
-- RCL Fleet ERP – step 1y: the Vendor Master common to every site (update-106)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one empty column "owner_site" to vendors: the site that made the vendor (the only site where it can be changed
-- or deleted). No existing column, row or rule is changed. Until it is run at every site, each site keeps its own vendors
-- as before; the Vendor Master says that this file must be run first.
-- Rollback (only before "Bring the vendors of all sites together" was used): alter table public.vendors drop column owner_site;
-- =====================================================================
alter table public.vendors add column if not exists owner_site text;

notify pgrst, 'reload schema';
select 'Step 1y done · vendors ' || (select count(*) from public.vendors) as done;
