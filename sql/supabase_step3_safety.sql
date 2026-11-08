-- =====================================================================
-- RCL Fleet ERP – step 3: safety (run once in Supabase → SQL Editor; safe to run again)
-- It only ADDS three functions and takes away two unused permissions. No table, no column and no saved data is changed.
-- The app works with or without it: without it, it simply keeps working the old way.
--
--   web_write(p)        – one save = one database transaction. A save usually writes several tables (e.g. Diesel Issue
--                         + the Log Book rows it changes). Before, each table was written by its own call: if one failed,
--                         the others stayed written. Now either everything of a save is written, or nothing.
--   web_count(key, ttl) – a counter that cannot be fooled by many calls at the same moment
--                         (wrong-password attempts; "the same entry was sent twice").
--   web_uncount(key)    – takes a counter away again.
-- Rollback: drop function public.web_write(jsonb); drop function public.web_count(text, int); drop function public.web_uncount(text);
-- =====================================================================

create or replace function public.web_write(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  w jsonb; t text; rel regclass; cols text; setlist text; idtype text; k int; n int := 0; d int := 0; bad text;
begin
  for w in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    t := w->>'table';
    select c.oid::regclass into rel from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname = t;
    if rel is null then raise exception 'web_write: "%" is not a table of the app', t; end if;
    if jsonb_typeof(w->'upserts') = 'array' and jsonb_array_length(w->'upserts') > 0 then
      -- every column sent must be a column of the table (as the REST API insists too)
      select string_agg(x, ', ') into bad from jsonb_object_keys(w->'upserts'->0) x
        where not exists (select 1 from pg_attribute a where a.attrelid = rel and a.attname = x and a.attnum > 0 and not a.attisdropped);
      if bad is not null then raise exception 'web_write: column(s) % are not in table %', bad, t; end if;
      select string_agg(format('%I', a.attname), ', ' order by a.attnum),
             string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ' order by a.attnum) filter (where a.attname <> 'id')
        into cols, setlist
        from pg_attribute a where a.attrelid = rel and a.attnum > 0 and not a.attisdropped and (w->'upserts'->0) ? a.attname::text;
      execute format('insert into %s (%s) select %s from jsonb_populate_recordset(null::%s, $1) on conflict (id) do %s',
        rel, cols, cols, rel, case when setlist is null then 'nothing' else 'update set ' || setlist end) using w->'upserts';
      get diagnostics k = row_count; n := n + k;
    end if;
    if jsonb_typeof(w->'deletes') = 'array' and jsonb_array_length(w->'deletes') > 0 then
      select format_type(a.atttypid, a.atttypmod) into idtype from pg_attribute a where a.attrelid = rel and a.attname = 'id';
      execute format('delete from %s where id = any (array(select jsonb_array_elements_text($1))::%s[])', rel, idtype) using w->'deletes';
      get diagnostics k = row_count; d := d + k;
    end if;
  end loop;
  return jsonb_build_object('written', n, 'deleted', d);
end $$;

-- a counter that counts correctly however many calls arrive together; it forgets itself p_ttl seconds after the last count
create or replace function public.web_count(p_key text, p_ttl int)
returns int language sql security definer set search_path = web, public as $$
  insert into web.cache as c (key, value, expires_at) values (p_key, '1', now() + make_interval(secs => greatest(1, p_ttl)))
  on conflict (key) do update
    set value = case when c.expires_at < now() or c.value !~ '^[0-9]+$' then '1' else (c.value::int + 1)::text end,
        expires_at = excluded.expires_at
  returning value::int;
$$;
create or replace function public.web_uncount(p_key text)
returns void language sql security definer set search_path = web, public as $$
  delete from web.cache where key = p_key;
$$;

revoke all on function public.web_write(jsonb) from public, anon, authenticated;
revoke all on function public.web_count(text, int) from public, anon, authenticated;
revoke all on function public.web_uncount(text) from public, anon, authenticated;
grant execute on function public.web_write(jsonb) to service_role;
grant execute on function public.web_count(text, int) to service_role;
grant execute on function public.web_uncount(text) to service_role;

-- the two trigger helpers are only ever run by the database itself: nobody needs the right to call them
revoke all on function public.note_delete() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
notify pgrst, 'reload schema';
