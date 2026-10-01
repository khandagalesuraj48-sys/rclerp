# RCL Fleet ERP – Phase 3: readiness for release (01-10-2026)

`AUDIT.md` (Phase 1) and `UI_PERFORMANCE_AUDIT.md` (Phase 2) are unchanged.

**Where everything below was run:** a local copy of the stack – PostgreSQL 16 + PostgREST with every file of `sql/` run in order,
two app servers, a stand-in for Google's Sheets API, jsdom and headless Chromium; test data of 122 machinery, 3,606 Log Book
rows, 1,809 diesel issues. **Nothing was run against the live Supabase project, the live Vercel deployment or the live Google
Sheet. No production data, schema or deployment was touched.**

Not part of this app (asked for in the brief, checked, not found): organisations / several tenants, tasks, file attachments.

## 0. The one thing to know first

**What is live today is still the version before Phase 1.** The repository on GitHub (the source Vercel deploys) is at the
commit "click menu, one-line log book, short diesel history". None of the Phase 1, 2 or 3 changes is in it (table in section 1).
So on the live site today: the backup address answers anyone without sign-in (S1), a save can be written half (D1) and the same
entry can be saved twice (D2). They are fixed in this package and go live only when it is deployed.

## 1. Verified changes (present in this package / in the live source)

| Change | File | In this package | In the live source |
|---|---|---|---|
| S1 backup needs sign-in or `CRON_SECRET` | `api/backup.js`, `server/page.js` | yes | no |
| D1 one save = one transaction (`web_write`) | `app/SupabaseData.gs` | yes | no |
| D2 same new entry sent twice is saved once | `app/Code.gs` (`ONCE_FNS_`) | yes | no |
| S2 exact sign-in attempt counter | `app/Code.gs` (`login`) | yes | no |
| B1 Backup button verifies the Sheet's tabs | `server/backup.vm.js` | yes | no |
| S4 security headers | `vercel.json` | yes | no |
| Step-3 SQL | `sql/supabase_step3_safety.sql` | yes | no |
| P1 polling rhythm (2 s working) | `app/App.html` (`syncGap`) | yes | no |
| P2 a repeated question is sent once | `server/page.js` (`isQuestion`) | yes | no |
| Phone: Log Book entry as blocks, no sideways spill | `app/App.html` | yes | no |
| **Phase 3: first 100 rows + "Show all"** | `app/App.html` (`listsFirst100`) | yes | no |

## 2. Decision 1 – long lists: first 100 rows, "Show all"

How it is done: the eleven list tables (Log Book, Diesel issued, Inward, Transfer, Asset list, Activity log, Vendors, Saved
Bills, Payments, Tank checks, BOQ) draw their first 100 rows in the order the list already has. Under the list a bar says
"The first 100 of N rows are shown (same order). Totals, exports and reports count every record." with a **Show all N**
button, and after that "Show the first 100 only". The lists' own code is unchanged – only what is drawn changes. Entry
grids, Edit Log Book, bills and every report always show everything.

Checked in Chromium (`test/browser/lists.js`, 25 of 25 passed):

| Check | Result |
|---|---|
| 100 rows drawn, bar and button shown (Diesel 500, Log Book 500, Asset 122, Activity 468) | pass |
| "Show all" draws every row; "first 100 only" goes back | pass |
| Order: the first row is the same before and after, and is the first row the server gave | pass |
| Totals on the page identical before and after ("Entries: 1809 · Total diesel: 1,08,168 Ltr" with 100 rows drawn) | pass |
| A filter is answered by the server over all records (15 rows for one machinery) | pass |
| "Export to Excel" asks the server with `all: true` – not the rows drawn | pass |
| Asset Master "Select all shown" selects only the rows on screen | by reading `masterSelBar` (works on the rows drawn) |

Effect on speed (same machine, median of 3, longest time the page could not answer while opening):

| Page | Before | After |
|---|---|---|
| Diesel Issue | 520 ms (runs 251–571) | 190 ms |
| Activity log | 211 ms | 77 ms |
| Asset Master | 180 ms | 138 ms |
| Log Book | 508 ms | 450 ms (most of this page is the machinery-wise totals table, not the list) |

Chromium timeline for Diesel Issue: layout 203 → 59 ms, boxes laid out 18,012 → 3,999.

**One thing that is NOT new but must be said:** these lists already held at most the latest 500 records, with the note
"showing latest 500 – narrow the filter to see the rest". "Show all" shows all rows of the list (up to those 500); older
records are reached with the filter. Totals, exports and reports cover everything. If "Show all" must go beyond 500, that is a
separate change on the server (answers of several MB) – say so.

## 3. Decision 2 – polling at 2 seconds while active

`test/browser/poll.js`, 9 of 9 passed:

| Check | Measured |
|---|---|
| Working: one check about every 2 s | 11 checks in 20 s |
| Never two checks at the same time | most at once: 1 |
| 25 "window to front" signals at once | 6 checks in 10 s, still one at a time |
| Slow network (3.5 s per answer): the next check waits for the answer | 3 checks in 15 s |
| Network down: "Reconnecting…", steady retries, no storm | 6 attempts in 12 s |
| Network back: "Live" by itself | yes |
| Tab in the background | 1 check in 40 s |
| Coming back to the tab | asks within about 1 s |
| After sign-out | 0 checks |

Volume: about 30 checks a minute per tab while working, 12 a minute untouched, 2 a minute in the background (before: 60 a
minute always). Each check is one Vercel invocation and one database call.
Not promised: that a change by one user is on another user's screen in 2 seconds – that also needs the network and the
server; the 2 seconds is how often the page asks. There is no slowing down of retries while the network is down (it keeps the
2-second rhythm).

## 4. Decision 3 – Log Book on phone and desktop

| Check | Result |
|---|---|
| Phone width (390 px): entry is one block per entry, 340 px in a 340 px box | pass |
| Phone width: all 35 pages, none pushes the page sideways | pass |
| Desktop (1536 px): one line per machinery, fits (1,370 in 1,370), buttons do not overlap | pass |
| Entry, edit window, Edit Log Book, item-wise entry through the page (jsdom) | no errors; saved values as before |
| Bill figures through the page (Bucket 13 hr × 900, Breaker slab 1,500 + 2 × 1,200) | unchanged |

Not run: real phones or tablets, iOS Safari, printing.

## 5. Tests actually run on this code

| Command | Result |
|---|---|
| `node build.js` | built |
| `npm test` | 7 passed, 0 failed |
| `node test/audit.js` | 40 passed, 0 failed |
| `node test/reg.js` | 11 passed, 0 failed |
| `node test/bkg.js` | 21 passed, 0 failed |
| `node test/browser/lists.js` | 25 passed, 0 failed |
| `node test/browser/poll.js` | 9 passed, 0 failed |
| `node test/browser/sweep.js` (35 pages, desktop) | 35 without script error, failed call or sideways spill |
| phone-width sweep (35 pages) | none spills |
| `node test/browser/xss.js` (hostile text on every page) | never ran as code |

The browser scripts need `puppeteer-core` and a Chromium (`npm i --no-save puppeteer-core @sparticuz/chromium`) and the local
stack; they are not run by `npm test`.
NOT RUN: anything on live Vercel / Supabase / Google; restore from a backup; real devices; printing; load with many users.

## 6. Database and SQL review (nothing was executed on production)

| File(s) | What it does | Risk |
|---|---|---|
| `supabase_step1.sql` … `step1s` (19 files) | create the app's tables, add columns, triggers for "last changed" and the delete log, RLS on, rights for the secret key only | already run on the live project; all written to be run again without harm (`if not exists`); the only `drop` is `drop trigger if exists` followed at once by `create trigger` |
| `supabase_step2_web.sql` | schema `web` (settings, sessions, locks) and its functions | already run on live. The package changes one thing in it: `web_stamp()` now covers all app tables and `web_lock` returns the stamp. **Run it again unless it was run after the "faster server" update** (safe to repeat); with the older version the app works but re-reads more than needed |
| `supabase_step3_safety.sql` | adds `web_write`, `web_count`, `web_uncount`; removes the execute right on two trigger helpers | new for live. Adds only functions. No table, column or row changes. The app works before and after. Rollback: three `drop function` lines (in the file's header) |
| `check_security.sql` | only SELECT: RLS per table, policies, who may call the functions | none |

No file contains `drop table`, `truncate`, a mass `delete` or anything that switches RLS off (searched). `web_write` deletes
rows only when the app itself asks to delete those ids – the same deletes the app does today, now inside the transaction.
RLS and rights were verified on the local copy: RLS on for all 20 tables, no policies (so only the secret key reaches the
data), no function callable without the secret key. **On the live project this is unverified until `check_security.sql` is run there.**

## 7. Release checklist

Before (all must be true)
1. Backup: press **Backup** in the live app; in the Sheet, "Backup Status" shows the current time and the row counts look right.
2. Download a copy of that Sheet (File → Download → Excel). This is the only copy outside Supabase.
3. Supabase → SQL Editor: run `supabase_step2_web.sql`, then `supabase_step3_safety.sql`, then `check_security.sql` (every line starts with "ok").
4. Vercel → Environment Variables (for Production **and** Preview): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `BACKUP_SHEET_ID`, new: `CRON_SECRET`.
5. GitHub repository set to Private. Backup Sheet's General access set to Restricted.
6. No `.env` file in the folder to be pushed (`git status` must not list one).

Preview first
7. Push to a branch (commands below). Vercel builds a Preview link. **The preview uses the live database** – look, and do at most one test entry that you delete again.
8. On the preview: sign in; Dashboard; Log Book list (100 rows + Show all); Diesel Issue; one saved bill; Backup button.

Release
9. Merge the branch to `main` and push. Vercel deploys.
10. On the live link: sign in; one Diesel Issue; press Save twice quickly – one row; Backup; "Live" shown.

Watch (first day)
11. Vercel → project → Logs: lines starting `[api:` or `[backup]` are errors the server wrote.
12. Rest the mouse on "Live": the server's answer time and the slowest recent call.
13. Vercel → Usage: function invocations.

Rollback
14. Code: Vercel → Deployments → the previous deployment → Promote / Rollback. Takes effect at once; open apps reload themselves.
15. Database: nothing to undo (no schema change). If wanted: the three `drop function` lines of step 3 – the app then saves the old way.

## 8. Open risks and what to do about each

| # | Risk | What to do |
|---|---|---|
| 1 | Live site still without the Phase 1 fixes (section 0) | release this package |
| 2 | Repository is public (no key in it; source and database address are) | GitHub → Settings → Change visibility → Private |
| 3 | Backup Sheet readable by anyone with the link (bank details inside) | Share → General access → Restricted |
| 4 | No way to restore the database from the Sheet has been built or tested; Supabase free plan keeps no backups | decide: Supabase Pro (daily backups) or a restore tool; until then keep weekly downloaded copies |
| 5 | A blank access cell means View | decide whether blank should mean No access |
| 6 | Passwords: salted SHA-256, 300 rounds | plan a stronger hash with re-hash at next sign-in |
| 7 | "Show all" stops at the list's existing 500 | decide whether it must load everything |
| 8 | Real speed on Vercel, real phones, iOS Safari, printing: not tested | check on the preview and on a phone before release |
| 9 | Vercel Hobby plan is for non-commercial use | move the project to Pro |

## 9. Go / No-Go

Criteria and state:

| Criterion | State |
|---|---|
| No test failing on the package | met (section 5) |
| No critical defect found in Phase 3 | met – none found in the package |
| Phase 1 fixes present in what will be deployed | met |
| Fresh backup made and looked at | **not yet – operator** |
| Step-2 (again) and step-3 SQL run, `check_security.sql` all "ok" on live | **not yet – operator** |
| `CRON_SECRET` set | **not yet – operator** |
| Preview looked at on the live data | **not yet – operator** |

**Recommendation: GO for a preview deployment now. NO-GO for production until the four operator items above are done.**
Leaving the live site as it is keeps risk 1 open, so the release should not wait long.

## 10. Commands for the operator (run by hand, in this order)

Supabase → SQL Editor (paste each file, Run): `sql/supabase_step2_web.sql`, `sql/supabase_step3_safety.sql`, `sql/check_security.sql`.

VS Code terminal, in the project folder:

```
git status
git checkout -b phase3
Expand-Archive -Path "$HOME\Downloads\rcl-update-9.zip" -DestinationPath . -Force
git status
git add -A
git commit -m "phase 1-3: audit fixes, faster checks, first 100 rows"
git push -u origin phase3
```

Look at the Preview link Vercel shows for the branch `phase3`. When satisfied:

```
git checkout main
git merge phase3
git push
```

To undo the release: Vercel → Deployments → previous deployment → Promote.
