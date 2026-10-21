-- =====================================================================
-- RCL Fleet ERP – step 2b: the settings only when they changed (update-140)
-- Run once in Supabase → SQL Editor → New query → paste all → Run, in EVERY site's Supabase (VTR NH 848, 18B …).
-- Safe to run again. It ADDS one function (web_boot2). No table, column, row or other function is changed.
-- The whole file is ONE transaction: it is installed completely, or – if anything fails – not at all.
--
-- WHY. Every request of the app begins by asking the database for ALL the settings and the users list (web_boot: web.props
--   and the cache entry USERS_LIST – several KB) – more than twice a second on a busy site, all day. That was the largest part
--   of what the live database sent out (5 GB in 13 days; the free plan allows 5 GB a month).
-- NOW. web_boot2 answers exactly like web_boot, plus fingerprints (md5): "ver" of all the settings (every key and value) and
--   "hash" of every cache entry asked for. The server sends the fingerprints of what it already has (p_ver, p_have); what is
--   the same is not sent again (props = null; the entry is left out of "cache") and the server uses its copy. Any change of a
--   setting or an entry changes its fingerprint, so a change is always sent. Sign-in sessions are always sent (they are small).
--   Without this step the app keeps working exactly as before (it uses web_boot).
-- =====================================================================
begin;

create or replace function public.web_boot2(p_keys text[], p_ver text, p_have jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  with v as (
    select coalesce(md5(string_agg(p.key || chr(31) || coalesce(p.value, ''), chr(30) order by p.key)), '') as ver from web.props p
  ), c as (
    select c.key, c.value, md5(coalesce(c.value, '')) as h, floor(extract(epoch from (c.expires_at - now()))) as left_s
    from web.cache c where c.key = any(p_keys) and c.expires_at > now()
  )
  select jsonb_build_object(
    'ver', v.ver,
    'props', case when p_ver is not null and p_ver <> '' and p_ver = v.ver then null
                  else coalesce((select jsonb_object_agg(p.key, p.value) from web.props p), '{}'::jsonb) end,
    'cache', coalesce((select jsonb_object_agg(c.key, c.value) from c where p_have is null or (p_have ->> c.key) is distinct from c.h), '{}'::jsonb),
    'hash',  coalesce((select jsonb_object_agg(c.key, c.h) from c), '{}'::jsonb),
    'left',  coalesce((select jsonb_object_agg(c.key, c.left_s) from c), '{}'::jsonb))
    || public.web_stamp()
  from v;
$$;

revoke all on function public.web_boot2(text[], text, jsonb) from public, anon, authenticated;
grant execute on function public.web_boot2(text[], text, jsonb) to service_role;

commit;
notify pgrst, 'reload schema';
