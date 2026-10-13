# update-92 – the Google Sheet backup works again with the site tables (13-10-2026)

Reported by the owner on 13-10-2026. The red "Backup" pill showed this message:
`Supabase GET /rest/v1/rcl_sites → 400 … column rcl_sites.id does not exist`.

## Cause
update-90's SQL (`supabase_step7_sites.sql`) added four tables: `rcl_sites`, `rcl_user_sites`, `rcl_super_admin` and
`rcl_companies`. The backup copies **every** table into the Sheet and read each one in the order of its `id` column. Three
of the new tables have no `id` (their keys are `code`, `email` and `email + site`). The database refused the request, and
the **whole backup stopped**.

So from the moment that SQL was run, **the Sheet copy stopped being updated**. The live data itself was never affected.

The update-90 tests did not catch this because the backup test was not run again after the step-7 SQL. It is run now (below).

## The change (no SQL, no change to any data)
* Each table is read in the order of its own key (`app/SupabaseSync.gs`: `SB_KEYS_`, `sbOrder_`). This is the same
  everywhere a table is read for the backup: the server's backup, and the old Apps Script full and change copies.
* These are never copied into the Sheet; the cell says "(hidden)":
  * the Super Admin's password and recovery code;
  * another site's locked database key.
  (A user's password was already hidden.)
* The Sheet gets four new tabs: `rcl_sites`, `rcl_user_sites`, `rcl_super_admin`, `rcl_companies`.

## Evidence (local rig, a stand-in for Google Sheets – never live)
* `test/backup.js`, code before the change: **4 failed** ("column rcl_super_admin.id does not exist"), the same error as live.
* `test/backup.js`, code after the change: **30 / 30**. New checks: the site tables are copied, and the Super Admin's
  password, his recovery code and a site's database key are "(hidden)".
* `test/unit.test.js`: 61 / 61.

## Not verified
* Not run against the live Sheet. After the merge, the next minute's backup (or the "Backup" button) should turn the pill
  green and add the four tabs.
* The old Apps Script backup (no longer the live path) matches changed rows by `id`. For the new tables it would add a
  changed row again instead of replacing it. The server's backup rewrites a changed table in full, so it is not affected.

## Going back
Vercel → Instant Rollback to the version before. (The backup would then fail again as before.)
