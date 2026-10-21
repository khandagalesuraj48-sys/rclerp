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
--   The same for the "stamp" (the time of the last change of each main table, ~400 bytes): the server sends the fingerprint of
--   the stamp it has (p_stamp); when nothing changed only the fingerprint comes back ("sh"), else the stamp itself.
--   Without this step the app keeps working exactly as before (it uses web_boot).
-- =====================================================================
begin;

create or replace function public.web_boot2(p_keys text[], p_ver text, p_have jsonb, p_stamp text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ver text; v_st jsonb; v_sh text; v_out jsonb;
begin
  select coalesce(md5(string_agg(p.key || chr(31) || coalesce(p.value, ''), chr(30) order by p.key)), '') into v_ver from web.props p;
  v_st := public.web_stamp();
  v_sh := md5(coalesce(v_st ->> 'stamp', '') || chr(30) || coalesce((v_st -> 'tables')::text, ''));
  with c as (
    select c.key, c.value, md5(coalesce(c.value, '')) as h, floor(extract(epoch from (c.expires_at - now()))) as left_s
    from web.cache c where c.key = any(p_keys) and c.expires_at > now()
  )
  select jsonb_build_object(
    'ver', v_ver,
    'props', case when p_ver is not null and p_ver <> '' and p_ver = v_ver then null
                  else coalesce((select jsonb_object_agg(p.key, p.value) from web.props p), '{}'::jsonb) end,
    -- an entry the server already has with the same fingerprint: only its name ("same"); a new or changed one: its value and fingerprint
    'cache', coalesce((select jsonb_object_agg(c.key, c.value) from c where p_have is null or (p_have ->> c.key) is distinct from c.h), '{}'::jsonb),
    'hash',  coalesce((select jsonb_object_agg(c.key, c.h) from c where (p_have is null or (p_have ->> c.key) is distinct from c.h) and c.key not like 'S\_%'), '{}'::jsonb),      -- (a sign-in is never kept: no fingerprint)
    'same',  coalesce((select jsonb_agg(c.key) from c where p_have is not null and (p_have ->> c.key) = c.h), '[]'::jsonb),
    'left',  coalesce((select jsonb_object_agg(c.key, c.left_s) from c), '{}'::jsonb),
    'sh', v_sh)
  into v_out;
  -- the stamp itself only when the server does not have it already
  if p_stamp is null or p_stamp = '' or p_stamp <> v_sh then v_out := v_out || v_st; end if;
  return v_out;
end $$;

revoke all on function public.web_boot2(text[], text, jsonb, text) from public, anon, authenticated;
grant execute on function public.web_boot2(text[], text, jsonb, text) to service_role;

commit;
notify pgrst, 'reload schema';
