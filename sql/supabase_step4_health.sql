-- =====================================================================
-- RCL Fleet ERP – step 4: the app checks the database by itself (Admin → "Database" in the top bar)
-- Run once in Supabase → SQL Editor (safe to run again). It adds ONE function and changes no table, no row, no rule.
-- web_health() returns what sql/check_security.sql shows: row level security on every table, no public policy,
-- no function callable without the secret key, the "web" schema hidden. Only the server (secret key) can call it.
-- Until it is run the app still checks the columns and functions of every SQL step, and says that this file is missing.
-- Rollback: drop function public.web_health();
-- =====================================================================
create or replace function public.web_health()
returns jsonb language sql stable security definer set search_path = public, pg_catalog as $$
  select jsonb_build_object('findings', coalesce(jsonb_agg(f order by f desc), '[]'::jsonb)) from (
    select case when c.relrowsecurity then 'ok   ' else 'LOOK ' end || 'row level security on ' || n.nspname || '.' || c.relname as f
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'web') and c.relkind = 'r'
    union all
    select 'LOOK policy "' || policyname || '" on ' || schemaname || '.' || tablename || ' for ' || array_to_string(roles, ', ') from pg_policies where schemaname in ('public', 'web')
    union all
    select case when has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') then 'LOOK ' else 'ok   ' end
           || 'function ' || p.proname || ' – callable without the secret key: ' || (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))::text
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'trigger'::regtype
    union all
    select case when exists (select 1 from pg_namespace where nspname = 'web') and has_schema_privilege('anon', 'web', 'usage') then 'LOOK ' else 'ok   ' end || 'schema web hidden from the public API'
  ) x;
$$;
revoke all on function public.web_health() from public, anon, authenticated;
grant execute on function public.web_health() to service_role;
notify pgrst, 'reload schema';
