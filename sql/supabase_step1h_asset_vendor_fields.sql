-- =====================================================================
-- RCL Fleet ERP – Asset Master and Vendor Master: new fields
-- Only ADDS columns. Existing data is not changed.
-- Run once in Supabase → SQL Editor → New query → paste → Run  (BEFORE pasting the new SupabaseSync.gs).
-- =====================================================================
alter table public.master add column if not exists engine_number text;
alter table public.master add column if not exists chassis_number text;
alter table public.master add column if not exists engine_make text;
alter table public.master add column if not exists tax_valid_upto text;        -- a date (YYYY-MM-DD) or NA
alter table public.master add column if not exists puc_valid_upto text;
alter table public.master add column if not exists permit_valid_upto text;
alter table public.master add column if not exists fitness_valid_upto text;
alter table public.master add column if not exists insurance_valid_upto text;
alter table public.vendors add column if not exists aadhaar_number text;
alter table public.vendors add column if not exists email text;
