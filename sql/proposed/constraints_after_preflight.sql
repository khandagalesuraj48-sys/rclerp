-- =====================================================================
-- RCL Fleet ERP – PROPOSED database constraints (update-68, decision D8).        *** DO NOT RUN YET ***
--
-- This file is a PROPOSAL. It is not one of the app's SQL steps, the app does not need it and does not look for it.
-- Order of work:
--   1. run sql/proposed/preflight_readonly.sql (it only reads) and look at the result;
--   2. where a rule shows rows, they are corrected first IN THE APP (or the rule is dropped from this file);
--   3. only then, with the owner's go-ahead, the matching block below is run – one block at a time, at a quiet hour;
--   4. each block has its own ROLLBACK line.
--
-- WHAT A CONSTRAINT CHANGES FOR THE APP. Today a second tank check on the same day is refused by the app with its own
-- words. With the constraint the DATABASE refuses it too – this matters only if the app's check is ever passed by
-- (two servers at the same moment outside the lock, a row typed straight into the database, a future mistake in the
-- code). Then the whole save is refused and rolled back (nothing half-saved) and the user sees
-- "Could not save to Supabase: 409 … duplicate key value violates unique constraint …". Nothing is lost silently.
--
-- WHY SOME RULES ARE **NOT** PROPOSED (checked by preflight, deliberately left without a constraint):
--   12 machinery number once (letters/digits)   14 Log Book one per machinery/date/shift   13 vendor name once
--   The app writes a save as "put the new rows, then delete the old ones" (web_write). When a machinery number is
--   re-written with other punctuation (MH15AB0002 → MH-15-AB-0002) the new row and the old row exist together for a
--   moment inside the transaction – a unique index on the letters-and-digits key would refuse that legitimate rename.
--   These three stay with: the primary key (exact text) + the app's rule + the lock. To give them to the database later,
--   web_write must first delete, then put (a change to the step-3 function – its own update, with its own tests).
--   15 user e-mail: already the primary key (id = the e-mail in small letters).
--
-- All statements are safe to run again ("if not exists" / guarded). Sizes today are small (thousands of rows): each
-- statement takes well under a second; it holds a short lock on its one table while it runs.
-- =====================================================================

-- ================= BLOCK A – quantities and amounts must be more than 0 =================
-- app rule today: Diesel Issue / Inward / Transfer "Enter Qty (Ltr)" (qty > 0); Payment "Enter the amount" (amount > 0)
-- preflight rules 06, 07, 08, 09 must show 0.
-- "not valid" = checked for every row written from now on, existing rows are not scanned at this moment;
-- "validate" = the existing rows are checked too (fails, changing nothing, if one breaks the rule).
-- RISK: the app re-writes rows when balances are recalculated (every row of a location after a back-dated entry). If an
--       OLD row with quantity 0 exists, such a recalculation would be refused after this block → preflight first.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'diesel_issue_qty_pos')    then alter table public.diesel_issue    add constraint diesel_issue_qty_pos    check (qty > 0) not valid; end if;
  if not exists (select 1 from pg_constraint where conname = 'diesel_inward_qty_pos')   then alter table public.diesel_inward   add constraint diesel_inward_qty_pos   check (qty > 0) not valid; end if;
  if not exists (select 1 from pg_constraint where conname = 'diesel_transfer_qty_pos') then alter table public.diesel_transfer add constraint diesel_transfer_qty_pos check (qty > 0) not valid; end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_pos')     then alter table public.payments        add constraint payments_amount_pos     check (amount > 0) not valid; end if;
end $$;
alter table public.diesel_issue    validate constraint diesel_issue_qty_pos;
alter table public.diesel_inward   validate constraint diesel_inward_qty_pos;
alter table public.diesel_transfer validate constraint diesel_transfer_qty_pos;
alter table public.payments        validate constraint payments_amount_pos;
-- ROLLBACK A:
--   alter table public.diesel_issue drop constraint if exists diesel_issue_qty_pos;   alter table public.diesel_inward drop constraint if exists diesel_inward_qty_pos;
--   alter table public.diesel_transfer drop constraint if exists diesel_transfer_qty_pos;   alter table public.payments drop constraint if exists payments_amount_pos;

-- ================= BLOCK B – one tank check per machinery and date =================
-- app rule today: "<machinery> already has a tank check on <date>. Delete it first to check again." (saveTankCheck_)
-- preflight rule 01 must show 0.   Machinery compared by letters and digits, as the app does.
-- RISK: none known – a tank check row keeps its id when a machinery is renamed (it is changed in place).
create unique index if not exists tank_check_one_per_day on public.tank_check ((regexp_replace(upper(coalesce(machinery, '')), '[^A-Z0-9]', '', 'g')), date);
-- ROLLBACK B:   drop index if exists public.tank_check_one_per_day;

-- ================= BLOCK C – BOQ No once per vendor =================
-- app rule today: "<vendor> already has BOQ No <no>. Leave BOQ No blank for the next number." (saveBoq_; an amendment gets its own number)
-- preflight rule 02 must show 0.   Vendor compared in capitals with single spaces, as the app does (vKey_).
-- RISK: a vendor is renamed by changing its BOQ rows in place (same ids) – no clash. Joining two vendors by renaming is refused by the app.
create unique index if not exists boq_no_once_per_vendor on public.boq ((upper(btrim(regexp_replace(coalesce(vendor_name, ''), '\s+', ' ', 'g')))), (btrim(coalesce(boq_no, '')))) where btrim(coalesce(boq_no, '')) <> '';
-- ROLLBACK C:   drop index if exists public.boq_no_once_per_vendor;

-- ================= BLOCK D – one ACTIVE bill per vendor + name (company) + bill number =================
-- app rule today: "RA Bill No <no> is already used by another bill of this vendor" (verifyBills_ / submitBills_). A bill
--   saved again for the same period keeps its number as a REVISION: the older row becomes "Superseded" in the same save,
--   the new row is "Active" – so among ACTIVE rows a number appears once. Superseded and Deleted rows keep their numbers
--   (history) and are outside this index.
-- preflight rules 03 (must show 0) and 05 (status values).
-- RISK (why this one needs the most care): in the save of a revision the NEW active row is put while the OLD row is
--   changed to Superseded – both are in the same statement (one "insert … on conflict do update" for the table), and
--   PostgreSQL checks a unique index row by row inside a statement. If the new row is written before the old one is
--   changed, the statement is refused although the end state would be fine.
--   MEASURED on the test rig (07-10-2026, with this index in place, through web_write): old row first, then the new
--   one → written; the new row first → REFUSED (unique_violation). The app sends the rows in the order of the table
--   (old before new), so today it would pass – but it would depend on an order nothing guarantees. → NOT proposed for
--   now (left as a comment): the app's rule + the lock stay. To give it to the database, the revision must first be
--   written in two steps or web_write must order the rows – its own update with its own tests.
-- create unique index if not exists bills_active_no_once on public.bills ((upper(btrim(regexp_replace(coalesce(vendor_name, ''), '\s+', ' ', 'g')))), (coalesce(company, '')), (btrim(coalesce(bill_no, '')))) where status = 'Active';
-- ROLLBACK D:   drop index if exists public.bills_active_no_once;

-- ================= BLOCK E – one opening balance per vendor; one opening stock per location =================
-- app rules today: savePayment_ ("… already has an opening balance") and checkOpening_ ("Opening stock of <location> is already entered …")
-- preflight rules 10 and 11 must show 0.
-- RISK: none known (entries are changed in place).
create unique index if not exists payments_one_opening_per_vendor on public.payments ((upper(btrim(regexp_replace(coalesce(vendor_name, ''), '\s+', ' ', 'g'))))) where entry_type = 'Opening';
create unique index if not exists inward_one_opening_per_location on public.diesel_inward ((coalesce(location, ''))) where upper(regexp_replace(btrim(coalesce(pump_name, '')), '\s+', ' ', 'g')) = 'OPENING STOCK';
-- ROLLBACK E:   drop index if exists public.payments_one_opening_per_vendor;   drop index if exists public.inward_one_opening_per_location;

-- ================= BLOCK F – debit note number once per name (company) =================
-- app rule today: the next number is one more than the highest ever given under that name (nextDnNo_), under the lock.
-- preflight rule 16 must show 0.
-- NOTE: the diesel debit notes made inside a bill use the same run of numbers but are kept inside the bill's data, not
--       in this table – this index covers the notes of this table only.
create unique index if not exists debit_notes_no_once on public.debit_notes ((coalesce(company, '')), (btrim(coalesce(dn_no, '')))) where btrim(coalesce(dn_no, '')) <> '';
-- ROLLBACK F:   drop index if exists public.debit_notes_no_once;

-- ================= BLOCK G – least privilege for the public roles (anon, authenticated) =================
-- TODAY: the app talks to the database ONLY with the secret key (role service_role), from the server. The public key
--   roles (anon, authenticated) are used by nothing. They are held off by row-level security: it is ON for every table
--   and there is NO policy, so they can read and write nothing; and the app's functions are revoked from them.
--   But the table GRANTS themselves are whatever Supabase gave by default when the tables were made (preflight part 3
--   shows them). If row-level security were ever switched off on a table by mistake, those grants would open it.
-- PROPOSAL: take the grants away as well – then two things must both go wrong before anything is exposed.
-- RISK: none for the app (it never uses these roles). Anything ELSE that reads this database with the public key
--   (a dashboard tool, a mobile app, the Supabase "Table editor" is NOT affected – it uses its own role) would stop
--   working → confirm that nothing else uses the project's public (anon) key before running.
-- revoke all on all tables    in schema public from anon, authenticated;
-- revoke all on all sequences in schema public from anon, authenticated;
-- revoke all on all tables    in schema web    from anon, authenticated;
-- revoke usage on schema web from anon, authenticated;
-- alter default privileges in schema public revoke all on tables    from anon, authenticated;      -- tables made later (by the role that runs this)
-- alter default privileges in schema public revoke all on sequences from anon, authenticated;
-- alter default privileges in schema public revoke all on functions from anon, authenticated;
-- ROLLBACK G (gives back what Supabase gives a new project by default):
--   grant all on all tables in schema public to anon, authenticated;   grant all on all sequences in schema public to anon, authenticated;
--   alter default privileges in schema public grant all on tables to anon, authenticated;   alter default privileges in schema public grant all on sequences to anon, authenticated;
