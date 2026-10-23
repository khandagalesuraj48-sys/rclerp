-- =====================================================================
-- RCL Fleet ERP – step 1zd: an approved or billed Log Book entry is locked – only the Super Admin changes it (update-152)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …), AFTER step 1zc. Safe to run again.
-- It only ADDS (nothing that is there is changed or removed):
--   1. log_book: approved_by, approved_at, approval_ref – the mark of an entry saved through a verification (approval) rule;
--   2. bills: deleted_by, deleted_at, delete_reason – a submitted bill is never removed any more: "Deleted" is a status, kept;
--      the app's key loses the right to delete a bill;
--   3. bill_machines – which machinery and dates every submitted bill holds (Active, Superseded or Deleted alike – a bill never
--      unlocks its entries by itself), kept by a trigger on bills; filled once from the bills there are now;
--   4. log_book_history – every change of a locked entry (before and after, who, why), written by the database itself; nobody
--      can change or delete it;
--   5. a guard on log_book: a change of a locked entry that is not the Super Admin's is WRITTEN DOWN (log_book_history,
--      allowed = false) – "warn" mode. It refuses such a change only after the Admin switches it to "enforce" (see the end).
--   6. web_write3 – the app's all-or-nothing save with who is saving and why (the guard reads it).
-- Until it is run the app works as before (no approval mark, bills deleted as before is refused by the new app – it needs this).
-- Rollback (code first: Vercel → Instant Rollback; then, only if wanted):
--   drop trigger log_book_guard on public.log_book; drop trigger log_book_guard_ins on public.log_book;
--   drop trigger bills_machines on public.bills; grant delete on public.bills to service_role;
--   (the new columns and tables are kept – they hold history; they are harmless to the older app)
-- =====================================================================
begin;

-- 1. the approval mark
alter table public.log_book add column if not exists approved_by text;
alter table public.log_book add column if not exists approved_at timestamptz;
alter table public.log_book add column if not exists approval_ref text;

-- 2. a bill is deleted by its status ("Deleted"), never removed
alter table public.bills add column if not exists deleted_by text;
alter table public.bills add column if not exists deleted_at timestamptz;
alter table public.bills add column if not exists delete_reason text;
revoke delete, truncate on public.bills from service_role;

-- 3. the machinery and dates of every submitted bill (the same keys as the app: the number it has today, letters and digits only)
create table if not exists public.bill_machines (
  bill_id text not null,
  machinery_key text not null,
  period_from date not null,
  period_to date not null,
  primary key (bill_id, machinery_key)
);
create index if not exists bill_machines_key on public.bill_machines (machinery_key, period_from, period_to);
alter table public.bill_machines enable row level security;
revoke all on public.bill_machines from public, anon, authenticated;
grant select on public.bill_machines to service_role;

create or replace function public.rcl_no_key(v text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(upper(coalesce(v, '')), '[^A-Z0-9]', '', 'g')
$$;

-- the keys of one bill: its machinery list (the number it has today – noNow – or as billed), or – a very old bill without the
-- list – every machinery its vendor owns in the Asset Master
create or replace function public.rcl_bill_keys(p_data text, p_vendor text) returns setof text language plpgsql stable set search_path = '' as $$
declare j jsonb;
begin
  begin j := nullif(p_data, '')::jsonb; exception when others then j := null; end;
  if j is not null and jsonb_typeof(j->'machines') = 'array' and jsonb_array_length(j->'machines') > 0 then
    return query select distinct public.rcl_no_key(coalesce(nullif(m->>'noNow', ''), m->>'no')) from jsonb_array_elements(j->'machines') m
      where public.rcl_no_key(coalesce(nullif(m->>'noNow', ''), m->>'no')) <> '';
  else
    return query select distinct public.rcl_no_key(x.id) from public.master x where upper(trim(coalesce(x.owner_name, ''))) = upper(trim(coalesce(p_vendor, ''))) and public.rcl_no_key(x.id) <> '';
  end if;
end $$;

create or replace function public.rcl_bill_machines() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.period_from is null or new.period_to is null then return new; end if;
  -- (a bill's list changes only when a machinery number is changed later – noNow; the keys it had are kept as well: never unlocked)
  insert into public.bill_machines (bill_id, machinery_key, period_from, period_to)
    select new.id, k, new.period_from, new.period_to from public.rcl_bill_keys(new.data, new.vendor_name) k
    on conflict (bill_id, machinery_key) do nothing;
  return new;
end $$;
drop trigger if exists bills_machines on public.bills;
create trigger bills_machines after insert or update of data, period_from, period_to, vendor_name on public.bills for each row execute function public.rcl_bill_machines();
-- once: the bills there are now (every status – Active, Superseded)
insert into public.bill_machines (bill_id, machinery_key, period_from, period_to)
  select b.id, k, b.period_from, b.period_to from public.bills b, lateral public.rcl_bill_keys(b.data, b.vendor_name) k
  where b.period_from is not null and b.period_to is not null
  on conflict (bill_id, machinery_key) do nothing;

create or replace function public.rcl_billed(p_machinery text, p_date date) returns text language sql stable set search_path = '' as $$
  select bm.bill_id from public.bill_machines bm where bm.machinery_key = public.rcl_no_key(p_machinery) and bm.period_from <= p_date and bm.period_to >= p_date limit 1
$$;

-- 4. the history of every change of a locked entry
create table if not exists public.log_book_history (
  seq bigserial primary key,
  entry_key text not null,
  action text not null,                -- insert / update / delete
  locked_by text,                      -- approval / bill / approval + bill
  bill_id text,
  changed text[],                      -- the columns changed (what was entered – not what the app works out)
  old_row jsonb,
  new_row jsonb,
  ctx jsonb,                           -- who saved it and why (from the app's save)
  allowed boolean not null,            -- false = not the Super Admin's (warn: written down; enforce: refused)
  at timestamptz not null default now()
);
create index if not exists log_book_history_key on public.log_book_history (entry_key);
create index if not exists log_book_history_at on public.log_book_history (at);
create or replace function public.rcl_history_fixed() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'RCL_HISTORY_FIXED: % is the history of locked entries – it is never changed or deleted', tg_table_name;
end $$;
drop trigger if exists log_book_history_fixed on public.log_book_history;
create trigger log_book_history_fixed before update or delete on public.log_book_history for each row execute function public.rcl_history_fixed();
drop trigger if exists log_book_history_no_truncate on public.log_book_history;
create trigger log_book_history_no_truncate before truncate on public.log_book_history for each statement execute function public.rcl_history_fixed();
alter table public.log_book_history enable row level security;
revoke all on public.log_book_history from public, anon, authenticated;
revoke delete, truncate, update on public.log_book_history from service_role;
grant select, insert on public.log_book_history to service_role;      -- (insert: the guard runs as the saving role)
grant usage on sequence public.log_book_history_seq_seq to service_role;

-- 5. the guard (mode in app_settings, id ENTRY_GUARD: 'warn' – the default – or 'enforce')
insert into public.app_settings (id, value) values ('ENTRY_GUARD', 'warn') on conflict (id) do nothing;
-- (it runs as the role that saves – the app's own is service_role – so it knows who is saving; it may only ADD history rows)
create or replace function public.rcl_entry_guard() returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  -- (what is ENTERED in a Log Book entry – the same list as the app's LB_GUARD_; the diesel of the day, its readings and the driver
  -- copied from Diesel Issue, and every figure the app works out, are not in it)
  k constant text[] := array['date', 'machinery', 'shift', 'opening_km', 'closing_km', 'opening_hrs', 'closing_hrs',
    'chainage_from', 'chainage_to', 'chainage_no', 'work_done', 'trip', 'remark', 'start_time', 'end_time', 'break_min', 'time_hrs',
    'challan_no', 'item_work', 'debit_to', 'debit_rate', 'meter_note', 'day_part', 'time_slots', 'approved_by', 'approved_at', 'approval_ref'];
  o jsonb; n jsonb; ch text[]; bill text; appr boolean := false; ctx jsonb; ok boolean; mode text; key text;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  -- locked: the entry as it was (approved, or in a bill), or the place it is written to (in a bill)
  if o is not null then
    appr := coalesce(o->>'approved_at', '') <> '';
    bill := public.rcl_billed(o->>'machinery', (o->>'date')::date);
  end if;
  if bill is null and n is not null and n->>'date' is not null then bill := public.rcl_billed(n->>'machinery', (n->>'date')::date); end if;
  if not appr and bill is null then return null; end if;
  -- what was entered and changed (the figures the app works out – averages, diesel balance, fill cycle – do not count)
  select coalesce(array_agg(x order by x), '{}') into ch from unnest(k) x
    where coalesce(o->x, 'null'::jsonb) is distinct from coalesce(n->x, 'null'::jsonb);      -- (a column with nothing in it is not a change)
  if tg_op = 'UPDATE' and array_length(ch, 1) is null then return null; end if;
  begin ctx := nullif(current_setting('rcl.ctx', true), '')::jsonb; exception when others then ctx := null; end;
  ok := coalesce((ctx->>'super')::boolean, false) or coalesce(ctx->>'op', '') = 'rename';
  key := coalesce(o->>'id', n->>'id');
  insert into public.log_book_history (entry_key, action, locked_by, bill_id, changed, old_row, new_row, ctx, allowed)
    values (key, lower(tg_op), case when appr and bill is not null then 'approval + bill' when appr then 'approval' else 'bill' end, bill, ch, o, n, ctx, ok);
  if not ok and current_user = 'service_role' then
    select value into mode from public.app_settings where id = 'ENTRY_GUARD';
    if coalesce(mode, 'warn') = 'enforce' then
      raise exception 'RCL_ENTRY_LOCKED: the Log Book entry % is %, only the Super Admin can change it', key, case when appr then 'approved' else 'in a submitted bill' end;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists log_book_guard on public.log_book;
create trigger log_book_guard after update or delete on public.log_book for each row execute function public.rcl_entry_guard();
drop trigger if exists log_book_guard_ins on public.log_book;
create trigger log_book_guard_ins after insert on public.log_book for each row execute function public.rcl_entry_guard();

-- 6. the app's save with who is saving and why (the same as web_write / web_write2, the context set for this save only)
create or replace function public.web_write3(p jsonb, p_ctx jsonb, p_rid text, p_holder text, p_result text)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  perform set_config('rcl.ctx', coalesce(p_ctx, '{}'::jsonb)::text, true);
  if coalesce(p_rid, '') = '' then return public.web_write(p); end if;
  return public.web_write2(p, p_rid, p_holder, p_result);
end $$;
revoke all on function public.web_write3(jsonb, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.web_write3(jsonb, jsonb, text, text, text) to service_role;
revoke all on function public.rcl_entry_guard() from public, anon, authenticated;
revoke all on function public.rcl_bill_machines() from public, anon, authenticated;
revoke all on function public.rcl_history_fixed() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
select 'Step 1zd done · bill_machines ' || (select count(*) from public.bill_machines) || ' rows · guard ' || (select value from public.app_settings where id = 'ENTRY_GUARD')
  || ' · triggers ' || (select count(*) from pg_trigger where tgname in ('log_book_guard', 'log_book_guard_ins', 'bills_machines', 'log_book_history_fixed', 'log_book_history_no_truncate')) as done;
-- LATER (only when the Admin decides – after some days with no "not the Super Admin's" lines in Database health):
--   update public.app_settings set value = 'enforce' where id = 'ENTRY_GUARD';
