-- =====================================================================
-- RCL Fleet ERP – step 2: run the app outside Apps Script (Vercel)
-- Run once in Supabase → SQL Editor → New query → paste all → Run. Safe to run again.
-- It only ADDS things. No table of the app and no saved data is changed; the Apps Script app keeps working.
--
-- What Apps Script kept by itself is now kept here:
--   web.props  – settings and counters (Script Properties): bill settings, format names, last numbers, data versions
--   web.cache  – short-lived things (Cache): sign-in sessions, the users list, sign-in attempt counters
--   web.locks  – "one save at a time" (Lock)
-- They are in their own schema "web" (not in "public"), so the Google Sheet backup does not copy them and nobody
-- can read them through the API. The app reaches them only through the functions below, with the secret key.
-- =====================================================================
create schema if not exists web;

create table if not exists web.props (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
create table if not exists web.cache (
  key text primary key,
  value text,
  expires_at timestamptz not null
);
create index if not exists cache_expires on web.cache (expires_at);
create table if not exists web.locks (
  name text primary key,
  holder text not null,
  expires_at timestamptz not null
);

-- start of every request, in ONE call: all settings, the asked cache keys (with the seconds each still lives),
-- and "stamp" = the newest change in the main tables (so a copy of them kept in memory is used only while nothing changed,
-- whoever changed it: this app, the Apps Script app, or the SQL editor)
create or replace function public.web_boot(p_keys text[])
returns jsonb language sql security definer set search_path = web, public as $$
  select jsonb_build_object(
    'props', coalesce((select jsonb_object_agg(key, value) from web.props), '{}'::jsonb),
    'cache', coalesce((select jsonb_object_agg(key, value) from web.cache where key = any(p_keys) and expires_at > now()), '{}'::jsonb),
    'left',  coalesce((select jsonb_object_agg(key, floor(extract(epoch from (expires_at - now())))) from web.cache where key = any(p_keys) and expires_at > now()), '{}'::jsonb),
    'stamp', concat_ws('|',
      (select max(updated_at) from public.master), (select max(updated_at) from public.diesel_inward), (select max(updated_at) from public.diesel_transfer),
      (select max(updated_at) from public.diesel_issue), (select max(updated_at) from public.log_book), (select max(updated_at) from public.tank_check),
      (select max(seq) from public.deleted_rows)));
$$;

-- settings: { "key": "value", … } are saved; a key with null is removed
create or replace function public.web_props_set(p jsonb)
returns void language plpgsql security definer set search_path = web, public as $$
begin
  delete from web.props where key in (select e.key from jsonb_each(p) as e where jsonb_typeof(e.value) = 'null');
  insert into web.props (key, value, updated_at)
    select e.key, e.value #>> '{}', now() from jsonb_each(p) as e where jsonb_typeof(e.value) <> 'null'
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- cache: read some keys
create or replace function public.web_cache_get(p_keys text[])
returns jsonb language sql security definer set search_path = web, public as $$
  select coalesce((select jsonb_object_agg(key, value) from web.cache where key = any(p_keys) and expires_at > now()), '{}'::jsonb);
$$;
-- cache: write [{ "key", "value", "ttl" (seconds) }] and remove keys; old entries are cleared now and then
create or replace function public.web_cache_set(p_put jsonb, p_del text[])
returns void language plpgsql security definer set search_path = web, public as $$
begin
  if p_del is not null and array_length(p_del, 1) > 0 then delete from web.cache where key = any(p_del); end if;
  if p_put is not null and jsonb_typeof(p_put) = 'array' and jsonb_array_length(p_put) > 0 then
    insert into web.cache (key, value, expires_at)
      select x->>'key', x->>'value', now() + make_interval(secs => greatest(1, coalesce((x->>'ttl')::numeric, 600)))
      from jsonb_array_elements(p_put) as x
    on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
  end if;
  if random() < 0.02 then delete from web.cache where expires_at < now() - interval '10 minutes'; end if;
end $$;

-- end of a request, in ONE call: settings to save (null = remove), cache entries to write and to remove
create or replace function public.web_flush(p_props jsonb, p_put jsonb, p_del text[])
returns void language plpgsql security definer set search_path = web, public as $$
begin
  if p_props is not null and jsonb_typeof(p_props) = 'object' then perform public.web_props_set(p_props); end if;
  perform public.web_cache_set(p_put, p_del);
end $$;

-- one save at a time: take the lock (true) or not (false, someone else has it). A lock left behind by a request
-- that died frees itself after p_ttl seconds. With the lock come the settings as they are NOW (fresh counters).
create or replace function public.web_lock(p_name text, p_holder text, p_ttl int)
returns jsonb language plpgsql security definer set search_path = web, public as $$
declare got text;
begin
  insert into web.locks as l (name, holder, expires_at) values (p_name, p_holder, now() + make_interval(secs => p_ttl))
  on conflict (name) do update set holder = excluded.holder, expires_at = excluded.expires_at
    where l.expires_at < now() or l.holder = p_holder
  returning l.holder into got;
  if got is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'props', coalesce((select jsonb_object_agg(key, value) from web.props), '{}'::jsonb));
end $$;
create or replace function public.web_unlock(p_name text, p_holder text)
returns void language sql security definer set search_path = web, public as $$
  delete from web.locks where name = p_name and holder = p_holder;
$$;

-- only the secret key (service_role) may call these
revoke all on schema web from public, anon, authenticated;
revoke all on all tables in schema web from public, anon, authenticated;
revoke all on function public.web_boot(text[]) from public, anon, authenticated;
revoke all on function public.web_props_set(jsonb) from public, anon, authenticated;
revoke all on function public.web_cache_get(text[]) from public, anon, authenticated;
revoke all on function public.web_cache_set(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.web_flush(jsonb, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.web_lock(text, text, int) from public, anon, authenticated;
revoke all on function public.web_unlock(text, text) from public, anon, authenticated;
grant execute on function public.web_boot(text[]) to service_role;
grant execute on function public.web_props_set(jsonb) to service_role;
grant execute on function public.web_cache_get(text[]) to service_role;
grant execute on function public.web_cache_set(jsonb, text[]) to service_role;
grant execute on function public.web_flush(jsonb, jsonb, text[]) to service_role;
grant execute on function public.web_lock(text, text, int) to service_role;
grant execute on function public.web_unlock(text, text) to service_role;
notify pgrst, 'reload schema';
