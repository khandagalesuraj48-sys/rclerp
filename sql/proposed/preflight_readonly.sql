-- =====================================================================
-- RCL Fleet ERP – PREFLIGHT for database constraints (update-68, decision D8).   READ-ONLY: every statement is a SELECT.
-- It changes nothing. Run it in Supabase → SQL Editor and send the result table (or a screenshot) back.
--
-- WHY. The rules below are enforced today only by the app's code. Before any of them is also given to the database
-- (sql/proposed/constraints_after_preflight.sql – NOT to be run yet), the data that is already there must be looked at:
-- a constraint added over rows that break it either fails to be created, or – worse – makes every later save that
-- touches such a row fail.
--
-- PART 1 = one table: every rule, how many rows break it today, and an example.   "0" everywhere = the constraint is safe.
-- PART 2 = the rows themselves for each rule (run a block only where part 1 shows a number).
-- PART 3 = what the public roles (anon, authenticated) are GRANTED on the app's tables and functions.
--
-- How names are compared (the same way the app compares them):
--   vendor names:      upper case, spaces at the ends removed, several spaces = one        → V(x)
--   machinery numbers: upper case, only letters and digits (MH-15 AB 0002 = MH15AB0002)     → N(x)
-- =====================================================================

-- ---------------------------------------------------------------- PART 1: the summary (ONE statement)
with
v as (select 1),
c01 as (select regexp_replace(upper(coalesce(machinery, '')), '[^A-Z0-9]', '', 'g') k, date d, count(*) n, min(id) a, max(id) b from public.tank_check where date is not null group by 1, 2 having count(*) > 1),
c02 as (select upper(btrim(regexp_replace(coalesce(vendor_name, ''), '\s+', ' ', 'g'))) k, btrim(coalesce(boq_no, '')) no, count(*) n, min(id) a, max(id) b from public.boq where btrim(coalesce(boq_no, '')) <> '' group by 1, 2 having count(*) > 1),
c03 as (select upper(btrim(regexp_replace(coalesce(vendor_name, ''), '\s+', ' ', 'g'))) k, coalesce(company, '') co, btrim(coalesce(bill_no, '')) no, count(*) n, min(id) a, max(id) b from public.bills where coalesce(status, '') = 'Active' group by 1, 2, 3 having count(*) > 1),
c04 as (select id from public.bills where coalesce(status, '') <> 'Deleted' and btrim(coalesce(bill_no, '')) = ''),
c05 as (select id from public.bills where coalesce(status, '') not in ('Active', 'Superseded', 'Deleted')),
c06 as (select id from public.diesel_issue where qty is null or not (qty > 0)),
c07 as (select id from public.diesel_inward where qty is null or not (qty > 0)),
c08 as (select id from public.diesel_transfer where qty is null or not (qty > 0)),
c09 as (select id from public.payments where amount is null or not (amount > 0)),
c10 as (select upper(btrim(regexp_replace(coalesce(vendor_name, ''), '\s+', ' ', 'g'))) k, count(*) n, min(id) a, max(id) b from public.payments where entry_type = 'Opening' group by 1 having count(*) > 1),
c11 as (select coalesce(location, '') k, count(*) n, min(id) a, max(id) b from public.diesel_inward where upper(regexp_replace(btrim(coalesce(pump_name, '')), '\s+', ' ', 'g')) = 'OPENING STOCK' group by 1 having count(*) > 1),
c12 as (select regexp_replace(upper(id), '[^A-Z0-9]', '', 'g') k, count(*) n, min(id) a, max(id) b from public.master group by 1 having count(*) > 1),
c13 as (select upper(btrim(regexp_replace(coalesce(vendor_name, ''), '\s+', ' ', 'g'))) k, count(*) n, min(id) a, max(id) b from public.vendors group by 1 having count(*) > 1),
c14 as (select regexp_replace(upper(coalesce(machinery, '')), '[^A-Z0-9]', '', 'g') k, date d, coalesce(shift, '') s, count(*) n, min(id) a, max(id) b from public.log_book group by 1, 2, 3 having count(*) > 1),
c15 as (select lower(btrim(coalesce(email, ''))) k, count(*) n, min(id) a, max(id) b from public.app_users group by 1 having count(*) > 1),
c16 as (select coalesce(company, '') co, btrim(coalesce(dn_no, '')) no, count(*) n, min(id) a, max(id) b from public.debit_notes where btrim(coalesce(dn_no, '')) <> '' group by 1, 2 having count(*) > 1),
c17 as (select id from public.diesel_transfer where coalesce(from_location, '') = coalesce(to_location, '')),
c18 as (select id from public.diesel_issue where issue_date is null or btrim(coalesce(machinery, '')) = ''),
c19 as (select id from public.log_book where date is null or btrim(coalesce(machinery, '')) = ''),
c20 as (select id from public.payments where entry_type is null or entry_type not in ('Opening', 'Payment'))
select '01 tank check: one per machinery and date' as rule, (select count(*) from c01) as groups_or_rows_breaking_it, (select string_agg(k || ' ' || d || ' (' || a || ', ' || b || ')', '; ') from (select * from c01 limit 3) x) as example
union all select '02 BOQ No: once per vendor', (select count(*) from c02), (select string_agg(k || ' no ' || no || ' (' || a || ', ' || b || ')', '; ') from (select * from c02 limit 3) x)
union all select '03 bill number: one ACTIVE bill per vendor + name (company) + number', (select count(*) from c03), (select string_agg(k || ' / ' || co || ' no ' || no || ' (' || a || ', ' || b || ')', '; ') from (select * from c03 limit 3) x)
union all select '04 bill number is not blank (bills not deleted)', (select count(*) from c04), (select string_agg(id, ', ') from (select * from c04 limit 5) x)
union all select '05 bill status is Active / Superseded / Deleted', (select count(*) from c05), (select string_agg(id, ', ') from (select * from c05 limit 5) x)
union all select '06 Diesel Issue: quantity more than 0', (select count(*) from c06), (select string_agg(id, ', ') from (select * from c06 limit 5) x)
union all select '07 Diesel Inward: quantity more than 0', (select count(*) from c07), (select string_agg(id, ', ') from (select * from c07 limit 5) x)
union all select '08 Diesel Transfer: quantity more than 0', (select count(*) from c08), (select string_agg(id, ', ') from (select * from c08 limit 5) x)
union all select '09 Payment / opening balance: amount more than 0', (select count(*) from c09), (select string_agg(id, ', ') from (select * from c09 limit 5) x)
union all select '10 opening balance: one per vendor', (select count(*) from c10), (select string_agg(k || ' (' || a || ', ' || b || ')', '; ') from (select * from c10 limit 3) x)
union all select '11 opening stock: one per location', (select count(*) from c11), (select string_agg(k || ' (' || a || ', ' || b || ')', '; ') from (select * from c11 limit 3) x)
union all select '12 machinery number: once (letters and digits compared)', (select count(*) from c12), (select string_agg(a || ' = ' || b, '; ') from (select * from c12 limit 3) x)
union all select '13 vendor name: once (case and spaces ignored)', (select count(*) from c13), (select string_agg(a || ' = ' || b, '; ') from (select * from c13 limit 3) x)
union all select '14 Log Book: one entry per machinery, date and shift', (select count(*) from c14), (select string_agg(k || ' ' || d || ' ' || s || ' (' || a || ', ' || b || ')', '; ') from (select * from c14 limit 3) x)
union all select '15 user: one row per e-mail', (select count(*) from c15), (select string_agg(a || ' = ' || b, '; ') from (select * from c15 limit 3) x)
union all select '16 debit note number: once per name (company)', (select count(*) from c16), (select string_agg(co || ' no ' || no || ' (' || a || ', ' || b || ')', '; ') from (select * from c16 limit 3) x)
union all select '17 Diesel Transfer: from and to are different places', (select count(*) from c17), (select string_agg(id, ', ') from (select * from c17 limit 5) x)
union all select '18 Diesel Issue: has a date and a machinery', (select count(*) from c18), (select string_agg(id, ', ') from (select * from c18 limit 5) x)
union all select '19 Log Book: has a date and a machinery', (select count(*) from c19), (select string_agg(id, ', ') from (select * from c19 limit 5) x)
union all select '20 Payments: type is Opening or Payment', (select count(*) from c20), (select string_agg(id, ', ') from (select * from c20 limit 5) x)
order by 1;

-- ---------------------------------------------------------------- PART 2: the rows (run ONLY the block whose rule shows a number above)
-- 01 tank check: one per machinery and date
-- select * from public.tank_check t where exists (select 1 from public.tank_check o where o.id <> t.id and o.date = t.date and regexp_replace(upper(coalesce(o.machinery, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(coalesce(t.machinery, '')), '[^A-Z0-9]', '', 'g')) order by machinery, date, id;
-- 02 BOQ No once per vendor
-- select id, boq_no, vendor_name, valid_from, valid_to, amendment_of, amendment_no from public.boq b where btrim(coalesce(boq_no, '')) <> '' and exists (select 1 from public.boq o where o.id <> b.id and btrim(coalesce(o.boq_no, '')) = btrim(coalesce(b.boq_no, '')) and upper(btrim(regexp_replace(coalesce(o.vendor_name, ''), '\s+', ' ', 'g'))) = upper(btrim(regexp_replace(coalesce(b.vendor_name, ''), '\s+', ' ', 'g')))) order by vendor_name, boq_no, id;
-- 03 one ACTIVE bill per vendor + name + number
-- select id, vendor_name, company, bill_no, rev, period_from, period_to, status, net_payable from public.bills b where status = 'Active' and exists (select 1 from public.bills o where o.id <> b.id and o.status = 'Active' and coalesce(o.company, '') = coalesce(b.company, '') and btrim(coalesce(o.bill_no, '')) = btrim(coalesce(b.bill_no, '')) and upper(btrim(regexp_replace(coalesce(o.vendor_name, ''), '\s+', ' ', 'g'))) = upper(btrim(regexp_replace(coalesce(b.vendor_name, ''), '\s+', ' ', 'g')))) order by vendor_name, company, bill_no, id;
-- 06 – 09 quantities / amounts
-- select id, issue_date, machinery, qty from public.diesel_issue where qty is null or not (qty > 0);
-- select id, date, location, pump_name, qty from public.diesel_inward where qty is null or not (qty > 0);
-- select id, date, from_location, to_location, qty from public.diesel_transfer where qty is null or not (qty > 0);
-- select id, entry_type, entry_date, vendor_name, amount from public.payments where amount is null or not (amount > 0);
-- 10 / 11 opening entries
-- select id, entry_date, vendor_name, amount, side from public.payments where entry_type = 'Opening' order by upper(btrim(vendor_name)), id;
-- select id, date, location, pump_name, qty from public.diesel_inward where upper(regexp_replace(btrim(coalesce(pump_name, '')), '\s+', ' ', 'g')) = 'OPENING STOCK' order by location, id;
-- 12 – 15 names and keys
-- select id, machinery_number, machinery_name from public.master m where exists (select 1 from public.master o where o.id <> m.id and regexp_replace(upper(o.id), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(m.id), '[^A-Z0-9]', '', 'g')) order by id;
-- select id, vendor_name from public.vendors v where exists (select 1 from public.vendors o where o.id <> v.id and upper(btrim(regexp_replace(coalesce(o.vendor_name, ''), '\s+', ' ', 'g'))) = upper(btrim(regexp_replace(coalesce(v.vendor_name, ''), '\s+', ' ', 'g')))) order by id;
-- select id, date, machinery, shift from public.log_book l where exists (select 1 from public.log_book o where o.id <> l.id and o.date = l.date and coalesce(o.shift, '') = coalesce(l.shift, '') and regexp_replace(upper(coalesce(o.machinery, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(coalesce(l.machinery, '')), '[^A-Z0-9]', '', 'g')) order by machinery, date, shift, id;
-- 16 debit note number
-- select id, dn_no, company, dn_date, vendor_name, status from public.debit_notes d where exists (select 1 from public.debit_notes o where o.id <> d.id and coalesce(o.company, '') = coalesce(d.company, '') and btrim(coalesce(o.dn_no, '')) = btrim(coalesce(d.dn_no, ''))) order by company, dn_no, id;

-- ---------------------------------------------------------------- PART 3: what the PUBLIC roles are granted (run each as its own statement)
-- 3a. tables: which rights anon / authenticated hold on the app's tables (today nothing can be read through them: every table
--     has row-level security switched on and NO policy – but the grants themselves are whatever the project's defaults gave)
-- select table_schema, table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as rights
--   from information_schema.role_table_grants where grantee in ('anon', 'authenticated', 'PUBLIC') and table_schema in ('public', 'web') group by 1, 2, 3 order by 1, 2, 3;
-- 3b. row-level security: is it on for every table, and are there policies (expected: on, and no policy at all)
-- select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced, (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and n.nspname in ('public', 'web') order by 1, 2;
-- 3c. functions: which of the app's functions anon / authenticated may call (expected: none)
-- select p.proname as function, pg_get_function_identity_arguments(p.oid) as args, has_function_privilege('anon', p.oid, 'execute') as anon_may_call, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_may_call, p.prosecdef as runs_as_owner
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'web\_%' order by 1;
-- 3d. sequences and default rights (what a table created LATER would get)
-- select defaclrole::regrole as made_by, defaclnamespace::regnamespace as schema, defaclobjtype as kind, defaclacl as default_rights from pg_default_acl order by 1, 2, 3;
