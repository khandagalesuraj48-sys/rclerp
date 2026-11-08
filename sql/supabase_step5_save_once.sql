-- =====================================================================
-- RCL Fleet ERP – step 5: a save is saved ONCE, decided inside the database (update-68, decision D7)
-- Run once in Supabase → SQL Editor (safe to run again). It ADDS one small table (web.ops) and six functions.
-- No existing table, column, row or function is changed; web_write (step 3) stays exactly as it is.
-- The whole file is ONE transaction: it is installed completely, or – if anything fails – not at all.
--
-- WHY. The page gives every save its own number (rid) and sends the SAME save again when no answer comes. Until now the
--   server remembered "this number is done" in a separate note written AFTER the save. If the save went into the database
--   but its answer was lost (the connection dropped, the 30-second limit, a server stopped at that moment), the note was
--   never written – and the copy sent again was saved a SECOND time (a second Diesel Issue number, stock counted twice).
-- NOW. The number is written IN THE SAME TRANSACTION as the entry itself: either both are in the database or neither.
--   A copy of the same save that arrives later – on any server – finds the number, gets the first answer back and writes
--   nothing. Two copies at the same moment: the database lets exactly one of them write.
--
--   web.ops            one row per save number: whose it is (holder), what was sent (hash), started / done / refused, the answer
--   web_op_begin       "I want to run save number X": yours (run it) / done (here is its answer) / somebody is on it (wait)
--   web_op_mark        called INSIDE the write: "X is done" – refuses if X is no longer this server's (it was taken over)
--   web_write2         = web_op_mark + web_write in ONE transaction
--   web_op_end         after the request: the final answer / "refused" / "give the number back" (only if nothing was written)
--                      / "close": who does what follows a save (Activity Log line, telling the open pages) – exactly one request
--   web_ops_cleanup    old numbers are forgotten (see RETENTION below)
--   web_op_note        (used inside the functions only) the old-style note of a done save, for the code before update-68
--
-- WORKS WITH THE CODE THAT IS LIVE BEFORE update-68 (update-65): that code never calls these functions and never looks
--   at web.ops, so installing this file changes nothing for it (proved on the test rig: its whole test suite with and
--   without this file). The file can therefore be run BEFORE the new code is deployed, and while people are working.
-- UNTIL THIS FILE IS RUN the new code works exactly as the old (it notices the functions are missing and uses the old
--   way); the Admin's "Database" check shows this step as to do. The servers use it from their next save on; a save that
--   was started the old way just before is still finished the old way (web_op_begin answers "old" for a number that has
--   an old-style note in web.cache).
-- GOING BACK to the code before update-68 is covered too: when a save is done, the database also leaves the old-style
--   note for its number (web_op_note – in the same transaction as the entry). The older code looks for exactly that note,
--   so a copy of a save that reaches the older code after a roll-back gets the first answer and is not saved again.
--
-- SECURITY (reviewed 07-10-2026).
--   * Who can call: ONLY the server's secret key (role service_role). EXECUTE is taken from PUBLIC, anon and authenticated
--     explicitly (a Supabase project gives new functions to anon / authenticated by default – the revoke below undoes that).
--   * web.ops cannot be read or changed directly by anybody but the database owner (the Supabase dashboard): the schema
--     "web" is not offered by the API, no role has rights on the table (also taken from service_role – it works through
--     the functions only), and row-level security is on with no policy.
--   * The functions that touch web.ops / web.cache run with the owner's rights (SECURITY DEFINER) and have a FIXED, EMPTY
--     search_path: every table is written with its schema (web.ops, web.cache), so no object placed in another schema can
--     be picked up in its stead. web_write2 runs with the caller's rights (it only calls the two functions by full name).
--   * A save number is checked for its shape (8 – 64 letters, digits, _ or -). The same number with other data, or from
--     another sign-in, is refused; it is never answered with the first one's answer (web_op_begin: same = false).
--
-- RETENTION – the table cannot grow for ever (web_ops_cleanup):
--   * a number is forgotten 3 days after it was started (whatever its state);
--   * an answer longer than 2,000 letters is dropped after 24 hours (the number stays: a copy that comes that late is
--     still not saved again, it is answered "saved" without the details);
--   * never more than 200,000 numbers: beyond that the oldest are forgotten first (never one younger than 2 hours).
--   It runs by itself: about every 50th save (inside web_op_begin) and once a night with the backup job of the server.
--   Inside web_op_begin it can never stand in the way of a save: if the clean-up fails, the save goes on (10-10-2026).
--   To look:  select count(*), min(started_at), pg_size_pretty(pg_total_relation_size('web.ops')) from web.ops;
--   By hand:  select public.web_ops_cleanup();
--
-- ROLLBACK (the app goes back to the old way by itself, nothing else depends on these). Normally this step is LEFT IN
--   when the app goes back to older code – it does not disturb it. If it must be taken out while update-68 is live: do it
--   in a quiet minute (a save that is on its way at that very moment gets an error and must be pressed again).
--   drop function if exists public.web_write2(jsonb, text, text, text);
--   drop function if exists public.web_op_mark(text, text, text);
--   drop function if exists public.web_op_begin(text, text, text, int);
--   drop function if exists public.web_op_end(text, text, text, text);
--   drop function if exists public.web_ops_cleanup(int, int, int);
--   drop function if exists public.web_op_note(text, text);
--   drop table if exists web.ops;
-- =====================================================================

begin;

create table if not exists web.ops (
  rid        text primary key,                        -- the number the page gave this save
  hash       text not null,                           -- fingerprint of what was sent (who, which action, its data) – not the data itself
  holder     text not null,                           -- the request that may write it now (changes when a dead one is taken over)
  state      text not null default 'started',         -- started | done | refused
  result     text,                                    -- the answer (done) or the refusal (refused)
  started_at timestamptz not null default now(),
  done_at    timestamptz,                             -- when the entry went into the database
  closed_at  timestamptz                              -- when what follows a save was finished (Activity Log line, live refresh)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ops_state_known' and conrelid = 'web.ops'::regclass) then
    alter table web.ops add constraint ops_state_known check (state in ('started', 'done', 'refused'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ops_rid_shape' and conrelid = 'web.ops'::regclass) then
    alter table web.ops add constraint ops_rid_shape check (rid ~ '^[A-Za-z0-9_-]{8,64}$');
  end if;
end $$;
create index if not exists ops_started_at on web.ops (started_at);
alter table web.ops enable row level security;
revoke all on web.ops from public, anon, authenticated, service_role;      -- nobody works on the table itself: only the functions below

-- old numbers are forgotten. Answer: { deleted, trimmed, capped, rows, bytes }
create or replace function public.web_ops_cleanup(p_keep_days int default 3, p_answer_hours int default 24, p_max_rows int default 200000)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d int := 0; t int := 0; c int := 0; n bigint;
begin
  delete from web.ops where started_at < now() - make_interval(days => greatest(1, coalesce(p_keep_days, 3)));
  get diagnostics d = row_count;
  update web.ops set result = null
    where started_at < now() - make_interval(hours => greatest(1, coalesce(p_answer_hours, 24))) and state = 'done' and result is not null and length(result) > 2000;
  get diagnostics t = row_count;
  select count(*) into n from web.ops;
  if n > greatest(1000, coalesce(p_max_rows, 200000)) then
    delete from web.ops where rid in (select o.rid from web.ops o where o.started_at < now() - interval '2 hours'
      order by o.started_at limit (n - greatest(1000, coalesce(p_max_rows, 200000))));
    get diagnostics c = row_count; n := n - c;
  end if;
  return jsonb_build_object('deleted', d, 'trimmed', t, 'capped', c, 'rows', n, 'bytes', pg_total_relation_size('web.ops'::regclass));
end $$;

-- The note the code BEFORE update-68 keeps for a done save (web.cache: "OPC_<number>" = it was counted, "OPR_<number>" = its
-- answer; one hour, as that code keeps it). Written here by the database when a save is done, so that after a roll-back the
-- older code finds it and does not save a copy again. Called only from the functions below (nobody may call it from outside).
create or replace function public.web_op_note(p_rid text, p_result text)
returns void language sql security definer set search_path = '' as $$
  insert into web.cache as c (key, value, expires_at)
  values ('OPC_' || p_rid, '1', now() + interval '1 hour'),
         ('OPR_' || p_rid, coalesce(nullif(p_result, ''), '{"ok":true,"_resent":true}'), now() + interval '1 hour')
  on conflict (key) do update set value = case when c.key like 'OPC\_%' and c.expires_at > now() then c.value else excluded.value end, expires_at = excluded.expires_at;
$$;

-- "I want to run save number p_rid". Answer: { mine, state, same, result, age, closed }
--   mine  = true  → this request runs the save (the number is new, or its first owner died long ago without writing)
--   state = done  → it is already saved: `result` is its answer;  refused → `result` is the refusal
--   same  = false → the number was used for a DIFFERENT entry (never run, never answered with the other one's data)
--   state = old   → this number was started or finished the old way (its note is in web.cache): it is finished the old way
--   closed = false with state done → the entry is in, but the request that saved it has not finished what follows a save
create or replace function public.web_op_begin(p_rid text, p_hash text, p_holder text, p_stale int default 75)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r web.ops%rowtype; n int; mine boolean := false;
begin
  -- housekeeping, now and then (also once a night by the server). It must never stand in the way of a save: if it fails, the save goes on.
  if random() < 0.02 then begin perform public.web_ops_cleanup(); exception when others then null; end; end if;
  -- the change-over to this step: a number a server handled the old way (before this file was run) stays with the old way
  if not exists (select 1 from web.ops o where o.rid = p_rid)
     and exists (select 1 from web.cache c where c.key in ('OPR_' || p_rid, 'OPT_' || p_rid, 'OPC_' || p_rid) and c.expires_at > now()) then
    return jsonb_build_object('mine', false, 'state', 'old', 'same', true);
  end if;
  insert into web.ops (rid, hash, holder) values (p_rid, p_hash, p_holder) on conflict (rid) do nothing;
  get diagnostics n = row_count; mine := (n = 1);
  if not mine then
    -- a copy that started long ago and never finished: taken over. (If a write of that copy is still on its way, this line
    -- WAITS for it – it holds the row; when it went through, the state is "done" and nothing is taken over.)
    update web.ops o set holder = p_holder, started_at = now()
      where o.rid = p_rid and o.state = 'started' and o.hash = p_hash and o.holder <> p_holder and o.started_at < now() - make_interval(secs => greatest(5, coalesce(p_stale, 75)));
    get diagnostics n = row_count; mine := (n = 1);
  end if;
  select * into r from web.ops o where o.rid = p_rid;
  if not found then return jsonb_build_object('mine', false, 'state', 'gone', 'same', true); end if;
  -- (asked twice by the same request – its first question was answered but the answer was lost: still its own)
  if r.holder = p_holder and r.state = 'started' then mine := true; end if;
  -- the answer of a save is given only for the SAME fingerprint (same sign-in, same action, same data)
  return jsonb_build_object('mine', mine, 'state', r.state, 'same', r.hash = p_hash, 'result', case when r.hash = p_hash then r.result else null end,
    'age', round(extract(epoch from now() - r.started_at))::int, 'closed', r.closed_at is not null);
end $$;

-- inside the write: "p_rid is done, here is its answer" – only for the request that holds it
create or replace function public.web_op_mark(p_rid text, p_holder text, p_result text)
returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update web.ops o set state = 'done', result = p_result, done_at = now() where o.rid = p_rid and o.holder = p_holder and o.state = 'started';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'OP_NOT_MINE: save % is no longer this request''s (already done, or taken over) – nothing was written', p_rid; end if;
  perform public.web_op_note(p_rid, p_result);      -- (in the same transaction as the entry: both are there, or neither)
end $$;

-- the write of a save: its number and its rows in ONE transaction (all of it, or nothing)
create or replace function public.web_write2(p jsonb, p_rid text, p_holder text, p_result text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform public.web_op_mark(p_rid, p_holder, p_result);
  return public.web_write(p);
end $$;

-- after the request.  p_state: 'done' (keep the final answer; what follows the save is finished) | 'refused' (keep the
--   refusal) | 'free' (give the number back) – each only for the request that holds the number, and "refused" / "free" only
--   while NOTHING was written (state still 'started'). If a write of this save is still on its way, the call waits for it.
-- 'close' = "the entry is in, but what follows a save was never finished (the server that saved it got no answer, or
--   stopped): I do it now". Exactly ONE request gets n = 1 – whoever asks first, whichever server.
-- Answer: { n, state, result, mine, closed } as the row is now. (Only the server calls this, for a number web_op_begin gave
--   it or showed it as done with the SAME fingerprint; a number can only be taken over by a copy with the same fingerprint.)
create or replace function public.web_op_end(p_rid text, p_holder text, p_state text, p_result text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r web.ops%rowtype; n int := 0;
begin
  if p_state = 'done' then
    update web.ops o set state = 'done', result = coalesce(p_result, o.result), done_at = coalesce(o.done_at, now()), closed_at = coalesce(o.closed_at, now())
      where o.rid = p_rid and o.holder = p_holder and o.state in ('started', 'done');
    get diagnostics n = row_count;
    if n = 1 then perform public.web_op_note(p_rid, (select o.result from web.ops o where o.rid = p_rid)); end if;      -- the final answer, for the older code too
    select * into r from web.ops o where o.rid = p_rid;
    return jsonb_build_object('n', n, 'state', coalesce(r.state, 'gone'), 'result', r.result, 'mine', r.holder = p_holder, 'closed', r.closed_at is not null);
  elsif p_state = 'refused' then
    update web.ops o set state = 'refused', result = p_result, done_at = now() where o.rid = p_rid and o.holder = p_holder and o.state = 'started';
  elsif p_state = 'free' then
    delete from web.ops o where o.rid = p_rid and o.holder = p_holder and o.state = 'started';
  elsif p_state = 'close' then
    update web.ops o set closed_at = now() where o.rid = p_rid and o.state = 'done' and o.closed_at is null;
  else
    raise exception 'web_op_end: state "%" is not known', p_state;
  end if;
  get diagnostics n = row_count;
  select * into r from web.ops o where o.rid = p_rid;
  if not found then return jsonb_build_object('n', n, 'state', 'gone'); end if;
  return jsonb_build_object('n', n, 'state', r.state, 'result', r.result, 'mine', r.holder = p_holder, 'closed', r.closed_at is not null);
end $$;

-- only the secret key (service_role) may call these
revoke all on function public.web_op_begin(text, text, text, int) from public, anon, authenticated;
revoke all on function public.web_op_mark(text, text, text) from public, anon, authenticated;
revoke all on function public.web_write2(jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.web_op_end(text, text, text, text) from public, anon, authenticated;
revoke all on function public.web_ops_cleanup(int, int, int) from public, anon, authenticated;
revoke all on function public.web_op_note(text, text) from public, anon, authenticated, service_role;      -- inside use only
grant execute on function public.web_op_begin(text, text, text, int) to service_role;
grant execute on function public.web_op_mark(text, text, text) to service_role;
grant execute on function public.web_write2(jsonb, text, text, text) to service_role;
grant execute on function public.web_op_end(text, text, text, text) to service_role;
grant execute on function public.web_ops_cleanup(int, int, int) to service_role;

notify pgrst, 'reload schema';

commit;
