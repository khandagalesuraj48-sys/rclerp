# Fleet ERP (One Click Solution) – setting up a new copy for a customer / site

One copy = one customer site: its own link, its own database, its own users. Nothing of another copy can be seen from it.
The code is the same for every copy (this repository); only the settings differ.

## What you need
- The One Click Solution accounts: GitHub (this repository, PRIVATE), Vercel, Supabase.
- 30–40 minutes.

## Steps
1. **Database** – Supabase → New project (region Mumbai). Keep the project URL and the `service_role` key.
2. **Tables** – Supabase → SQL Editor: run every file of `sql/` in this order (each can be run again safely):
   `supabase_step1.sql`, `step1b` … `step1u` (alphabetical), then `supabase_step2_web.sql`, `supabase_step3_safety.sql`,
   `supabase_step4_health.sql`. Finish with `check_security.sql` – every line must start with "ok".
3. **App** – Vercel → Add New → Project → import this same repository. Environment variables (Production and Preview):
   the same names as the first copy (Supabase URL, service key, `CRON_SECRET`, the Google backup values if a backup Sheet is used)
   with the NEW database's values. Deploy. Give the project its own domain / name.
4. **First Admin** – create the first user as described in the app's Read Me (Users table), sign in.
5. **Company & site** – Admin → Users & Access → "Company & site": the customer's name, the site / project, the logo link,
   the name(s) bills are made in. Then Machinery Billing → Company details (address, GSTIN, PAN, invoice / debit-note prefixes).
6. **Check** – the pill "Database ✓" at the top must be green. Add the diesel locations, machinery, vendors, BOQs – the copy starts empty.

## Updates
A push to the repository updates every copy (each Vercel project builds from it). When an update brings a new SQL file,
run it in every copy's database – each copy's Admin sees "Database: 1 to do" until it is done.

## What is NOT shared between copies
Data, users, passwords, settings, backups, bill numbers. A user of one copy cannot sign in to another: the other copy does not
know that user at all.
