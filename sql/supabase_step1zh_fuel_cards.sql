-- =====================================================================
-- RCL Fleet ERP – step 1zh: fuel cards – a site without diesel stock (update-164)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, HEAD OFFICE, …). Safe to run again.
-- It only ADDS: two empty columns of diesel_issue (rate, amount – the ₹ of a fill at a site on fuel cards), the table
-- card_payments (the payments / recharges onto a fuel card) and the empty access column of the new page "Fuel Cards" (empty =
-- No access). Nothing is changed or deleted. A site that is not on fuel cards (VTR, 18B) does not use any of it.
-- Rollback: drop table public.card_payments; alter table public.diesel_issue drop column rate, drop column amount;
--           alter table public.app_users drop column perm_fuel_cards;
-- =====================================================================
alter table public.diesel_issue add column if not exists rate numeric;
alter table public.diesel_issue add column if not exists amount numeric;

create table if not exists public.card_payments (
  id text primary key, date date, card text, amount numeric, reference text, remark text, photos text,
  entered_at timestamptz, entered_by text, updated_by text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists card_payments_touch on public.card_payments;
create trigger card_payments_touch before update on public.card_payments for each row execute function public.touch_updated_at();
drop trigger if exists card_payments_deleted on public.card_payments;
create trigger card_payments_deleted after delete on public.card_payments for each row execute function public.note_delete();
alter table public.card_payments enable row level security;
create index if not exists card_payments_updated_at on public.card_payments (updated_at);
grant select, insert, update, delete on public.card_payments to service_role;

-- access for the new page: empty = No access (the Super Admin gives it in the Portal → Users & Access → Pages)
alter table public.app_users add column if not exists perm_fuel_cards text;

notify pgrst, 'reload schema';
select 'Step 1zh done · diesel_issue.amount ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'diesel_issue' and column_name = 'amount')
  || ' · card_payments ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'card_payments')
  || ' · app_users.perm_fuel_cards ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'app_users' and column_name = 'perm_fuel_cards') as done;
