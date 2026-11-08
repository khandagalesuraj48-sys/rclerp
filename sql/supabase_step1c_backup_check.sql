-- =====================================================================
-- RCL Fleet ERP – quick "has anything changed?" check for the 1-minute backup
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Returns the newest change time (any table, including deletes) and a fingerprint of the tables / columns,
-- so the backup knows in ONE small call whether there is anything to copy.
-- =====================================================================
create or replace function public.backup_last_change()
returns table (last_change timestamptz, layout text)
language plpgsql stable security definer set search_path = public as $$
declare
  t record;
  m timestamptz;
  best timestamptz := 'epoch';
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format('select max(updated_at) from public.%I', t.table_name) into m;
    if m is not null and m > best then best := m; end if;
  end loop;
  select greatest(best, coalesce(max(d.deleted_at), 'epoch')) into best from public.deleted_rows d;
  return query
    select best,
           md5(coalesce(string_agg(c.table_name || '.' || c.column_name, ',' order by c.table_name, c.ordinal_position), ''))
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and tb.table_type = 'BASE TABLE' and c.table_name <> 'deleted_rows';
end $$;
revoke all on function public.backup_last_change() from public, anon, authenticated;
grant execute on function public.backup_last_change() to service_role;
