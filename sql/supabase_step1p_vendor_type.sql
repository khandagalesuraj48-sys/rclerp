-- =====================================================================
-- RCL Fleet ERP – Vendor type (how the vendor is paid and how diesel is treated)
-- Only ADDS a column. Every vendor starts as "As per BOQ" (the BOQ line's Diesel decides). Run once in Supabase → SQL Editor
-- → New query → paste → Run (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.vendors add column if not exists vendor_type text;
update public.vendors set vendor_type = 'As per BOQ' where vendor_type is null or vendor_type = '';
