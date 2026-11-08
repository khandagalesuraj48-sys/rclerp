-- =====================================================================
-- RCL Fleet ERP – Supabase: give the secret key (service_role) access to the tables
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Newer Supabase projects do not give this access to new tables automatically.
-- =====================================================================
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.backup_catalog() to service_role;

-- tables and modules added later get the same access automatically
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
