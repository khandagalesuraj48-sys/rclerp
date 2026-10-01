# RCL Fleet ERP – audit of 01-10-2026

Scope: the whole repository as it is on GitHub after `rcl-update-6` (`app/`, `server/`, `api/`, `sql/`, build and deploy files).
Where it was checked: a local copy of the stack – PostgreSQL 16 + PostgREST with every SQL file of `sql/` run in order,
two app servers, a stand-in for Google's Sheets API, jsdom and headless Chromium. Test data: 122 machinery, 3,606 Log Book rows,
1,809 diesel issues. **Nothing was run against the live Supabase project, the live Vercel deployment or the live Google Sheet,
and no production data or schema was touched.**

## A. Summary

- Confirmed defects: **8**. Fixed in this update: **8** (three of them need `sql/supabase_step3_safety.sql`; without it the app keeps working the old way).
- Open items that need a decision or an action by the owner: **11** (section F).
- Highest risks found: a public backup trigger (S1), saves that could be written half (D1), the same entry saved twice (D2).
- Tests: `npm test` 7/7 · `node test/audit.js` 40/40 · `node test/reg.js` 11/11 · `node test/bkg.js` 21/21 · page sweep 35/35 pages · hostile-text test passed.

## B. Findings (fixed)

| ID | Sev | Where | Evidence → cause | Fix | Test |
|---|---|---|---|---|---|
| S1 | P1 | `api/backup.js` | 4 calls of `/api/backup?full=1` without any sign-in ran 4 full backups (14 calls to the Sheets API). The endpoint had no check; `full=1` skipped the "not more often than every 4 minutes" rule. | POST needs a valid session token (the open app sends it); GET (nightly job) needs `Authorization: Bearer $CRON_SECRET`; everything else gets 401. A forced full backup is only possible for the nightly job. | audit.js "a stranger cannot make the server run full backups"; bkg.js "nightly job without its proof is refused" |
| D1 | P1 | `app/SupabaseData.gs` `SbBook_.prototype.flush` | A save writes several tables with one REST call per table. With the Log Book write made to fail, the Diesel Issue row of the same save stayed in the database (1,809 → 1,810 rows). | New SQL function `web_write(jsonb)`: all tables of one save in one transaction. `flush` uses it; if the function is not installed it falls back to the old calls. | audit.js "one save = all or nothing" (before: row stayed; after: 1,809 → 1,809) |
| D2 | P1 | `app/Code.gs` `api()` | The identical Diesel Issue (and payment) sent twice at the same moment was saved twice (two issue numbers). Nothing recognised a repeat. | For actions that add rows (`ONCE_FNS_`), the same user + same action + same content within 8 seconds is refused; the place is given back if the first attempt fails. Uses the exact counter `web_count`. | audit.js "the very same entry sent twice … is saved once" (diesel and payment) |
| S2 | P2 | `app/Code.gs` `login()` | The wrong-password counter was read, then written back (two steps). Calls arriving together read the same number, so more than 5 guesses could be looked at before the lock. | Every attempt first takes a place in an exact counter (`web_count`) and is looked at only if it is among the first 5. | audit.js "40 guesses fired at the same moment: at most 5 are even looked at" |
| B1 | P2 | `server/backup.vm.js` `webBackup_` | "Changed tables only" trusted its own notes: a tab deleted or emptied in the Sheet was not written again until the nightly run. | The Backup button now looks at the Sheet: a missing tab, or one whose row count differs from its table, is written again. | audit.js "every table is in the Sheet with the same number of rows as the database" (16 tables) |
| B2 | P3 | `server/backup.vm.js` | A value longer than 50,000 letters (a Sheet cell's limit) was cut without a trace. | The Backup Status tab says how many cells were cut. | – |
| S3 | P3 | SQL `note_delete()`, `touch_updated_at()` | Executable by everyone by default (they are trigger helpers and cannot do harm when called, but nobody needs the right). | `revoke` in step 3. | `sql/check_security.sql` |
| S4 | P3 | `vercel.json` | No `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`. | Added for every path. | unit test "vercel.json …" |

## C. Files changed

| File | Why |
|---|---|
| `api/backup.js` | S1 – who may ask for a backup |
| `server/page.js` | S1 – the open app sends its session token with the backup check |
| `server/runtime.js` | S1 (session check), exact counter and write mode for D1 / D2 / S2 |
| `server/gas.js` | recognises "step-3 function not installed" |
| `server/backup.vm.js` | B1, B2 |
| `app/Code.gs` | S2 (`login`), D2 (`api`, `ONCE_FNS_`, `apiRun_`) |
| `app/SupabaseData.gs` | D1 (`flush` through `web_write`) |
| `sql/supabase_step3_safety.sql` | new: `web_write`, `web_count`, `web_uncount`, two revokes |
| `sql/check_security.sql` | new: read-only look at RLS, policies and function rights |
| `vercel.json` | S4 |
| `package.json`, `test/*` | `npm test` (offline) and the integration checks |
| `README.md`, `HANDOVER.md`, `AUDIT.md` | documentation |

## D. Database impact

- `sql/supabase_step3_safety.sql` adds three functions and removes the execute right on two trigger helpers. **No table, column, index, policy or row is changed.** Safe to run again.
- Compatibility: the app works before and after it is run (it detects the functions).
- Rollback: `drop function public.web_write(jsonb); drop function public.web_count(text, int); drop function public.web_uncount(text);`
- Production data and schema were **not** modified by this audit.

## E. Tests

| Command | Result |
|---|---|
| `npm test` (no database needed) | 7 passed, 0 failed |
| `node test/audit.js` (local stack) | 40 passed, 0 failed |
| `node test/reg.js` (10 saves at once on two servers, fresh reads) | 11 passed |
| `node test/bkg.js` (backup against a stand-in for Google) | 21 passed |
| page sweep, 35 pages in headless Chromium | no script error, no failed call, no sideways spill |
| hostile text in names / remarks, all pages | never ran as code |
| `node build.js` | builds |

NOT RUN: anything on the live Vercel / Supabase / Google; restore from a backup; phones; the print windows with hostile text; load beyond the test data; TypeScript / lint (none configured); `npm audit` (the project has no npm dependencies and no lockfile).

## F. Open items

Needs an action by the owner
1. **P1 – the GitHub repository is public.** No key is in it (files and all 7 commits scanned), but the whole source and the Supabase project address are. Make it private.
2. **P1 – the backup Sheet can be opened by anyone who has its link** (set by the old backup). It holds vendors' bank details. Set General access to Restricted.
3. **P2 – `CRON_SECRET`** must be added in Vercel (any long random text), otherwise the nightly job is refused (the open app still triggers backups).
4. Run `sql/check_security.sql` on the live project – the RLS and rights were verified only on the local copy.

Needs a decision (not changed, because it would change behaviour)
5. P2 – a blank access cell means **View** (`ACCESS_` in `Code.gs`). When a new page's column is added, existing users can see it until Admin sets "No access".
6. P2 – passwords are stored as salted SHA-256 with 300 rounds. A slow hash (scrypt / bcrypt) would be stronger; it needs a plan for existing passwords.
7. P2 – the open app asks the server once a second (measured: 9 calls in 10 seconds; about 28,800 per open tab in 8 hours). Each is one Vercel invocation and one database call.
8. P2 – there is no tool to restore the database from the Sheet, and the Sheet copy cuts cells over 50,000 letters. On Supabase's free plan there is no other backup.
9. P3 – no foreign keys or check constraints: the rules live only in the app's code.
10. P3 – Excel libraries come from a CDN without an integrity hash; `xlsx` 0.18.5 has published advisories for opening untrusted files.
11. P3 – `getInit`, `getLookups`, `getStock`, `globalSearch` answer every signed-in user (a user with no access still receives the machinery list); errors carry database details to signed-in users; app errors are sent with HTTP 200.

Not applicable to this app: several organisations or projects in one database; draft / approved / rejected bill states (bills are Active, Superseded or Deleted); a direct-to-machine fuel model (the app has Inward, Transfer and stock by design).

## G. Release checklist

1. Supabase → SQL Editor: run `sql/supabase_step3_safety.sql`, then `sql/check_security.sql` (every line should start with "ok").
2. Vercel → Environment Variables: add `CRON_SECRET`.
3. Push; open the app; sign in.
4. Save one Diesel Issue and one Log Book entry; press Backup; look at the Sheet.
5. Press Save twice quickly on a Diesel Issue: one row must appear.
6. Items 1 and 2 of section F.
