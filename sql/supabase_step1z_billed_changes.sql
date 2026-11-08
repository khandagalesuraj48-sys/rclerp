-- =====================================================================
-- RCL Fleet ERP – step 1z: changes of a billed period (update-108)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, …). Safe to run again.
-- It only ADDS one new, empty table "billed_changes". It keeps two kinds of rows:
--   Request  – a Log Book / diesel change that a user made on a date of a submitted bill; it waits until the Super Admin
--              approves it (then it is saved) or rejects it;
--   Baseline – a submitted bill's figures (one machinery) as worked out just before its first entry was changed, so that the
--              next bill of the vendor shows exactly what the change made different.
-- No existing table, column, row or rule is changed. Until it is run, such a change is refused as before and the page says
-- that this file must be run first.
-- Rollback: drop table public.billed_changes;
-- =====================================================================
create table if not exists public.billed_changes (
  id text primary key,          -- CR-00001 … (a request) · BL|<bill id>|<machinery> (a baseline)
  kind text,                    -- Request | Baseline
  requested_at timestamptz,
  requested_by text,            -- the user's name
  requester_email text,
  action text,                  -- the save that was asked (updateLogRow, saveDieselIssue …)
  args text,                    -- JSON: exactly what the page sent – saved as it is when approved
  summary text,                 -- what it changes, in words (machinery, date, readings)
  machinery text,
  dates text,
  reason text,                  -- the user's reason
  status text,                  -- Pending | Approved | Rejected (a request)
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  result text,
  bill_id text,                 -- a baseline: the bill
  data text,                    -- a baseline: the bill's figures of that machinery (JSON)
  entered_at timestamptz,
  entered_by text,
  updated_by text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists billed_changes_touch on public.billed_changes;
create trigger billed_changes_touch before update on public.billed_changes for each row execute function public.touch_updated_at();
drop trigger if exists billed_changes_deleted on public.billed_changes;
create trigger billed_changes_deleted after delete on public.billed_changes for each row execute function public.note_delete();
alter table public.billed_changes enable row level security;
create index if not exists billed_changes_updated_at on public.billed_changes (updated_at);
create index if not exists billed_changes_status on public.billed_changes (status);
revoke all on public.billed_changes from anon, authenticated;
grant select, insert, update, delete on public.billed_changes to service_role;

notify pgrst, 'reload schema';
select 'Step 1z done · billed_changes ' || (select count(*) from public.billed_changes) as done;
