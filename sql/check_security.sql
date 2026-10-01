-- RCL Fleet ERP – a LOOK at the security of the database. It changes nothing (only SELECT).
-- Run in Supabase → SQL Editor. Every line of the result should say "ok"; send a screenshot if any line says "LOOK".
select case when c.relrowsecurity then 'ok   ' else 'LOOK ' end || 'row level security on ' || n.nspname || '.' || c.relname as finding
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'web') and c.relkind = 'r'
union all
select 'LOOK policy "' || policyname || '" on ' || schemaname || '.' || tablename || ' for ' || array_to_string(roles, ', ') from pg_policies where schemaname in ('public', 'web')
union all
select case when has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') then 'LOOK ' else 'ok   ' end
       || 'function ' || p.proname || ' – callable without the secret key: ' || (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))::text
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'trigger'::regtype
union all
select case when has_schema_privilege('anon', 'web', 'usage') then 'LOOK ' else 'ok   ' end || 'schema web hidden from the public API'
order by 1 desc;
