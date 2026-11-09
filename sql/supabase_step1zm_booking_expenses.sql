-- =====================================================================
-- RCL Fleet ERP – step 1zm: Vehicle Booking and Vehicle Expenses (toll / FASTag / parking) (update-216)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, HEAD OFFICE, …). Safe to run again.
-- It only ADDS two new tables and three empty access columns. Nothing is changed or deleted.
-- Rollback: drop table public.vehicle_booking; drop table public.vehicle_expense;
--           alter table public.app_users drop column perm_vehicle_booking, drop column perm_booking_approve, drop column perm_vehicle_expenses;
-- =====================================================================
create table if not exists public.vehicle_booking (
  id text primary key, need_from timestamptz, need_to timestamptz, place_from text, place_to text, purpose text, people integer,
  machinery text, driver text, status text, asked_by text, asked_name text, decided_by text, decided_at timestamptz, reply text,
  remark text, extra jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.vehicle_expense (
  id text primary key, date date, machinery text, kind text, place text, amount numeric, paid_by text, ref text, txn_id text,
  source text, remark text, files text, entered_at timestamptz, entered_by text, updated_by text, extra jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists vehicle_booking_touch on public.vehicle_booking;
create trigger vehicle_booking_touch before update on public.vehicle_booking for each row execute function public.touch_updated_at();
drop trigger if exists vehicle_booking_deleted on public.vehicle_booking;
create trigger vehicle_booking_deleted after delete on public.vehicle_booking for each row execute function public.note_delete();
drop trigger if exists vehicle_expense_touch on public.vehicle_expense;
create trigger vehicle_expense_touch before update on public.vehicle_expense for each row execute function public.touch_updated_at();
drop trigger if exists vehicle_expense_deleted on public.vehicle_expense;
create trigger vehicle_expense_deleted after delete on public.vehicle_expense for each row execute function public.note_delete();
alter table public.vehicle_booking enable row level security;
alter table public.vehicle_expense enable row level security;
create index if not exists vehicle_booking_updated_at on public.vehicle_booking (updated_at);
create index if not exists vehicle_booking_car on public.vehicle_booking (machinery, need_from);
create index if not exists vehicle_expense_updated_at on public.vehicle_expense (updated_at);
create index if not exists vehicle_expense_car on public.vehicle_expense (machinery, date);
-- one FASTag transaction is kept once (a statement uploaded twice adds nothing)
create unique index if not exists vehicle_expense_txn on public.vehicle_expense (txn_id) where txn_id is not null and txn_id <> '';
grant select, insert, update, delete on public.vehicle_booking to service_role;
grant select, insert, update, delete on public.vehicle_expense to service_role;

-- access for the new pages: empty = No access (the Super Admin gives it in the Portal → Users & Access → Pages)
alter table public.app_users add column if not exists perm_vehicle_booking text;
alter table public.app_users add column if not exists perm_booking_approve text;
alter table public.app_users add column if not exists perm_vehicle_expenses text;

notify pgrst, 'reload schema';
select 'Step 1zm done · vehicle_booking ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'vehicle_booking')
  || ' · vehicle_expense ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'vehicle_expense')
  || ' · access columns ' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'app_users'
       and column_name in ('perm_vehicle_booking', 'perm_booking_approve', 'perm_vehicle_expenses')) as done;
