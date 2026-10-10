# update-68 – release-safety checks and GO / NO-GO (08-10-2026, re-checked and finished 10-10-2026)

> **10-10-2026 – final re-check, asked by the owner ("check everything once more, deeply").** Section 10 at the end has
> what was done: a dress rehearsal of the whole production order with the delivered files, every suite again, and two
> independent reviews (no blocker; three small hardenings made and tested). **The packages of 10-10-2026 replace those
> of 08-10-2026.** The owner decided to go to production without the Vercel Preview test (section 3 stays as an option).
>
> So that they cannot be mixed up with the older downloads, the files of 10-10-2026 are handed over under these names:
> `rcl-final-1-step5.sql` (= `supabase_step5_save_once.sql`), `rcl-final-2-update-65s.zip` (= `rcl-update-65s.zip`),
> `rcl-final-3-update-68.zip` (= `rcl-update-68.zip`), `rcl-final-emergency-rollback-to-65s.zip` (= `rcl-rollback-to-65s.zip`).

Asked by the owner after `UPDATE_68.md`: three checks before production – (1) going back from update-68 must be safe,
(2) the step-5 SQL must work with the update-65 code that is live, (3) update-68 must be tried on the real Vercel runtime
(a Preview deployment) – plus a security review of `supabase_step5_save_once.sql`.

**Nothing in this report was run against the live database, the live site or the live Google Sheet.** Checks 1 and 2 and
the SQL review were run on the local test rig. **Check 3 could not be run from the developer's side** (see section 3) – it
is prepared as one command and is the owner's step.

## VERDICT

| | |
|---|---|
| Code and SQL of update-68 | **GO** – every check that could be run here passes |
| Rollback safety (check 1) | **GO** – with the new rollback-safe baseline `update-65s` |
| update-65 + step 5 (check 2) | **GO** – update-65 behaves the same with and without step 5 |
| SQL security review | **GO** – three hardenings and a retention rule were added |
| Vercel Preview (check 3) | **NOT RUN.** On 10-10-2026 the owner decided to release without it. |
| Final re-check 10-10-2026 (section 10) | **GO** – two independent reviews: no blocker; dress rehearsal of the whole order with the delivered files: every stage passed; all suites passed |
| **Production release** | **GO in the order of section 5 – with one thing knowingly untested: the Vercel runtime itself.** The order contains that risk: update-65s goes live first (so one click goes back safely), a scrypt failure on Vercel cannot lock out users whose password is still kept the older way (verified), and step 6 shows within two minutes whether scrypt works there. |

---

## 1. Rollback safety for scrypt

### The hazard (measured again, on the exact update-65)
After a user's password has been moved to scrypt by update-68, the exact update-65:
* refuses the user's real password (locked out), and
* **accepts the stored text itself as the password** (`scrypt$32768$8$3$…` typed into the password box signs in).

So the plain update-65 must never again be the version production goes back to.

### The strategy: `update-65s` – a rollback-safe baseline, deployed BEFORE update-68
`rcl-update-65s.zip` = the exact update-65 with one change (3 files; `app/Code.gs` +32 −4 lines, `server/gas.js` +10 −1,
one unit test): **it can read a password kept with scrypt.**

* a scrypt password is checked with scrypt → the user signs in with the same password as always; nobody is locked out;
* anything that looks like a kept password (`scrypt$…`, `sha256$…`, `tmp$…`) is **never** compared as typed text;
* a session made on update-68 stays good (the stamp inside the scrypt text is used);
* a one-time password made on update-68 (`tmp$scrypt$…`) is accepted, still "must change";
* every refused sign-in costs the same work – unknown e-mail, wrong password for a scrypt password, wrong password for a
  password still kept the older way (no timing hint; the last case was added on 10-10-2026);
* everything else is update-65 as it is today: a password CHANGED there is kept the old way (`sha256$…`), a one-time
  password set by the Admin is kept as typed (as update-65 does). update-68 reads both again when it comes back.

It is deployed first, so that **the deployment Vercel offers for "Instant Rollback" is this safe one** (on the Hobby plan
Vercel offers only the immediately previous production deployment – the plain update-65 is then no longer on offer).
The same result by git: `git revert HEAD` after update-68 gives exactly this tree.

If update-65s was NOT deployed first, `rcl-rollback-to-65s.zip` (every file of update-65s that differs from update-68) is
the emergency way back – unzip, commit, push. In that case Instant Rollback must not be used.

### Proof – `node test/rollback68.js` (three versions on ONE database: update-68, update-65s, exact update-65)

Last run 08-10-2026, after every change of this round: **20 passed, 0 failed** (`test/rollback68.js`) and
**4 passed, 0 failed** (`test/rollback68-backup.js`).

| What was asked | Measured | Result |
|---|---|---|
| The hazard exists on the plain update-65 | real password: "Wrong email or password."; the kept text typed as the password: **signed in** (also the kept text of a one-time password) | confirmed – that version is never the way back |
| After a rollback the stored hash string is NOT a password | on update-65s refused, each one: the kept text · `tmp$` + the kept text · the text without its stamp · only its hash part · in capitals · the kept text of a one-time password · a damaged kept text | **PASS** |
| Legitimate users are not locked out | the migrated user signs in on update-65s with the same password (no "must change"), the app opens; a wrong password is refused; the Admin (scrypt) signs in and opens Users & Access | **PASS** |
| Nobody is thrown out in the middle of work | a session made on update-68 goes on working on update-65s; one made on update-65s goes on working on update-68 | **PASS** |
| update-65s does not damage what update-68 kept | signing in there does not rewrite the password | **PASS** |
| The other protections are still there | 5 wrong tries lock the e-mail; unknown e-mail 323 ms, wrong password 297 ms (same work) | **PASS** |
| One-time password made on update-68, then rollback | the one-time password signs in and must be changed; the forced change works (kept as `sha256$…`, as update-65 does); the old one is dead | **PASS** |
| Documented recovery path | Admin → Users & Access → one-time password on update-65s → the user signs in and must change it | **PASS** |
| Forward again to update-68 | everybody signs in; passwords update-65s kept the old way are moved to scrypt again at that sign-in | **PASS** |
| A save in flight at the moment of the switch | forward (65s → 68), back (68 → 65s, copy 9 s later), back with the answer of the first lost: **one entry, one number** each time | **PASS** |
| Backup after the rollback | update-65s makes its backup with the notes update-68 left (3 calls to the stand-in for Google, the new entry is in the Sheet, the app shows the backup as all right); forward again update-68's backup is right | **PASS** |

Said plainly:
* The first run of `rollback68-backup.js` showed 1 FAIL. The cause was a wrong expectation in the new test (it assumed
  update-68 no longer keeps the field `lastFull`; it does). The app behaved correctly in both runs; the expectation was
  corrected and the test run again: 4 / 4.
* While the update-68 browser tests were repeated, one of them (`nightrow.js`) uses an older server for comparison. With
  the **plain** update-65 there it could not sign the Admin in – his password was already kept with scrypt. That is the
  hazard of this section, met by accident in the rig. With update-65s as the comparison server: 22 / 22.

**update-65s is otherwise update-65** (so that deploying it is not a release of its own):
* its page is byte for byte the page of update-65 – the app's version mark is the same (`d01afabe8f66`), so **no user
  sees an "Update" prompt** when it is deployed;
* update-65's own suite against update-65s (step 5 installed): unit + net 39 / 39 (38 + the new one) · audit 36 / 0 –
  the same lines · reg 11 / 0 · dn 13 / 1 – the same lines (the 1 = "backup is not set up" for these rig servers) ·
  25 people for 25 s: no failed call;
* 11 browser tests of update-65 against it (start, cred, settings, idle, fix, retry, big, billlock, lbpage, sweep, tank):
  147 PASS lines, 0 FAIL. The other 49 browser tests were **not** run against update-65s.

### What else is carried across a rollback (checked)
* **Sessions**: a session made on update-68 works on update-65s and the other way round (nobody is signed out).
* **Saves in flight**: when a save is done, the database now also leaves the note the older code looks for (in the same
  transaction as the entry). A copy of a save that reaches update-65s after the rollback is answered from it and not
  saved again – also when the answer of the first was lost. Proved in both directions (section G of the test).
* **Backup notes** (`BK_STATE` holds more fields since update-67): update-65s is not confused by them – it copies
  everything once, writes the notes back in its own form and goes on; update-68 reads those again (`test/rollback68-backup.js`).
* **Step 5** stays installed after a rollback – update-65 / 65s never touch it (check 2).
* Activity Log lines, fault notes and the `web.ops` rows written by update-68 are plain data to the older code.

### Recovery paths (documented, tested)
1. Normal case on update-65s: none needed – everybody signs in.
2. A user forgot the password / is stuck: Admin → Users & Access → new one-time password (works on update-65s; tested).
3. The Admin himself cannot sign in (any version): one statement in Supabase gives him a one-time password that must
   be changed at the sign-in:
   `update public.app_users set password_hash = 'One-Time-Word-9' where id = '<admin e-mail>'; delete from web.cache where key = 'USERS_LIST';`
4. Only if somebody put the **plain update-65** (or older) live while scrypt passwords exist: go to update-65s at once
   (it reads them); if that is impossible, the SQL of `UPDATE_68.md` § D2 (it replaces every scrypt password by an
   unusable value and gives the Admin a one-time password).

---

## 2. Step 5 with the update-65 code that is live

Method: the rig's servers were the **exact update-65** (`git archive` of `2e4e3cc`, no file changed; update-65 does not
contain the name of any step-5 object – checked: 0 mentions). The update-65 repository's own tests were run twice:
**A** = without step 5, **B** = with the final `supabase_step5_save_once.sql` installed.

**API level (update-65's own suites, run by its own `npm test` / `node test/…`):**

| Suite | A: without step 5 | B: with the final step 5 |
|---|---|---|
| unit + net (`npm test`) | 38 / 38 | 38 / 38 |
| `audit.js` auth brute diesel money atomic | 36 pass, 0 fail | 36 pass, 0 fail – line for line the same |
| `reg.js` (two servers, numbering, stock) | 11 pass, 0 fail | 11 pass, 0 fail |
| `dn.js` (Debit Notes) | 13 pass, 1 fail | 13 pass, 1 fail – the same lines |
| `load-site.js` 25 people, 25 s | no failed call | no failed call |
| rows in `web.ops` after each run | – | **0** (update-65 never touches it) |
| update-65's Database check (Admin) | all ok | 9 lines, all ok |

The 1 failing line of `dn.js` is "the backup copies the new table too" – the rig's servers have no Google Sheet set up;
it fails the same way without step 5.

**Browser level (the 60 browser tests of the update-65 time, a real Chromium on the exact update-65 page):**

| | with the final step 5 |
|---|---|
| tests run | 60 |
| tests with every line PASS | 37 |
| PASS lines | 492 |
| FAIL lines | 22, in 12 tests + 3 crashes (ai3 4 · batch 2 · clear 1 · lg2 2 · lists 1 · meter 1 · pend 2 · rename 1 · set2 1 · stale 2 + crash · voice 4 · xls 1 + crash · item2 crash) |
| tests that print no PASS / FAIL (measurements) | 11 |

Are those 22 + 3 caused by step 5? **No – measured:** the 28 tests that were not clean (every test with a FAIL, a crash
or no verdict line, and the five tests whose fixtures had to be repaired) were run again on the same update-65 **without** step 5: test by test the same
counts (155 PASS, 22 FAIL, 3 crashes in both states). They are older tests whose expectations no longer fit the rig's
data or the present page; they fail identically on today's live code. Their causes were not looked into (not part of
this task; nothing in the ERP was changed for them).

The tests without verdict lines were compared by their whole output: identical for blank, dates, hdrall, item2,
rowwidth, storm, sweep, tabs, xls2. Two differed between the long runs and were therefore run **alone**, repeatedly, in
both states:
* `topbar.js` (which pages' top bar needs two lines at 1280 px): the list changes **from run to run in both states**
  (3 runs with step 5 and 3 without gave the same three variants). Cause found: the test switches a "Closed up to …"
  pill on and measures while the page's own refresh takes it away again – a race inside the test, a few milliseconds
  decide. The lookup call it races with: median 13 ms with step 5, 12 ms without.
* `meter2.js`: identical in both states on the same data (4 runs, the same output). The earlier difference was an
  estimate that depends on rows other tests had added in between.

The 32 tests without a second (no-step-5) run in the final round are all-PASS with step 5 (337 PASS lines).

Said plainly – two earlier browser runs of this check were **thrown away** because of mistakes in the test harness, not
in the app: (1) three old tests restart the rig and started the update-68 code in the middle of the run; (2) two old
tests take two columns out and put them back with a SQL file the database user could not read, so the columns stayed
out. Both were corrected (rig start script pointed at update-65; update-65 copied to a readable folder; schema
repaired) and the runs repeated; only the repeated runs are reported above. This is why the round took hours.

**Recommended order confirmed:** step 5 can be installed while update-65 is live. This removes the period in which
update-68 would be live with the D7 protection still inactive.

---

## 3. Vercel Preview – NOT RUN, prepared

**Why it was not run here.** The developer's workspace cannot reach `*.vercel.app` or `*.supabase.co` (its network is
closed to them), has no access to the Vercel account, and a Preview needs its own test database – which only the owner
can create. A Preview that used the project's present settings might be connected to the LIVE database; nothing was
pushed for that reason.

**What was done instead (all local, none of it is the Vercel runtime):**
* `test/preview-smoke.js` – the eleven checks asked for, as ONE command (Node 18+, nothing to install).
* Rehearsed against a local stand-in for "a new, empty test database + a Preview": **16 passed, 0 failed.**
* Its guards were proved: it stops – having saved nothing – on the production link, on a database without the mark
  "I am a test database", with a wrong key, and when the Preview is not reading from the test database given (proved
  with a random word, before anything is saved; the other database was verified untouched).
* It cannot start a real backup: it holds the backup's lock while it asks; with a Sheet configured for the rehearsal
  the whole run made **0 calls to Google**.
* `preview_test_database.sql` – every SQL step in order, for the empty test project (installs cleanly on an empty
  database; schema = the rig's).
* Memory of the server during bursts of sign-ins (local Node 22, 6 helper threads): peak 532 MB with 24 sign-ins at once
  (update-65 under the same burst: 324 MB) – i.e. about 32 MB per sign-in in flight, as designed. **Vercel's own limit
  and behaviour must be read from the Preview's logs.**

**What the script checks on the Preview** (each line PASS / FAIL; result also written to `preview-smoke-result.txt`):
1 old SHA-256 user signs in · 2 that sign-in moved the password to scrypt (verified independently) · 3 signs in again
(times printed) · 4 wrong password and the kept text refused · four sign-ins at once · 5 one-time password flow ·
6 session carries its sign-in time · 7 `getInit` + step 5 shown as installed · 8 a save with its number in the database ·
9 the same request again does not duplicate (also twice at the same moment; other data under the same number refused) ·
10 Admin may start a backup · 11 normal user may not.

### Steps for the owner (about 30 minutes)

**A. A test database** – Supabase → New project (free, any name such as `rcl-preview-test`) → SQL Editor → paste the
whole of `preview_test_database.sql` → Run. Keep its Project URL and its secret key.

**B. Vercel → Project → Settings → Environment Variables – BEFORE any Preview is made**

| Variable | Must be |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (the live ones) | **Production only** (untick Preview and Development) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (add again, values of the TEST project) | **Preview** |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `BACKUP_SHEET_ID`, `CRON_SECRET`, `GEMINI_API_KEY` | **Production only** – nothing for Preview |

If the live variables are ticked for Preview today, any Preview would work on the LIVE database and write the live
backup Sheet. (Changing the ticks does not touch the running production deployment.)

**C. The Preview** (PowerShell, project folder; `git status` must be clean and on `main`):
```
git checkout -b preview-68
Expand-Archive -Path "$HOME\Downloads\rcl-update-68.zip" -DestinationPath . -Force
git add .
git commit -m "update-68 (preview)"
git push -u origin preview-68
```
Vercel → Deployments → the new **Preview** → copy its link. (If no deployment appears, the pushing GitHub account may not
deploy on this Vercel plan – use the account that owns the Vercel project.)

**D. If the link asks for a Vercel login** – Settings → Deployment Protection → Protection Bypass for Automation → create a
secret (used below as `VERCEL_BYPASS`).

**E. Run the test** (`node -v` must show 18 or higher; otherwise install "Node.js LTS" from nodejs.org):
```
$env:PREVIEW_URL       = "https://<preview link>.vercel.app"
$env:TEST_SUPABASE_URL = "https://<test project>.supabase.co"
$env:TEST_SUPABASE_KEY = "<secret key of the TEST project>"
$env:VERCEL_BYPASS     = "<only if step D was needed>"
node test/preview-smoke.js
```
Expected last line: `16 passed, 0 failed`. Send back `preview-smoke-result.txt`.

**F. Look at Vercel** → the Preview deployment → Logs: no error lines; duration of the `login` calls; "Max memory used".

**G. Back to main** – `git checkout main` (the folder is update-65 again; production was not touched).

---

## 4. Security review of `supabase_step5_save_once.sql`

| Point | Finding | State |
|---|---|---|
| `SECURITY DEFINER` | Used by the five functions that must work on `web.ops` / `web.cache` (`web_op_begin`, `web_op_mark`, `web_op_end`, `web_ops_cleanup`, `web_op_note`): the callers have no rights on those tables, so the functions run as the owner. `web_write2` is `SECURITY INVOKER` – it only calls `web_op_mark` and the existing `web_write` by full name. | as intended |
| Fixed `search_path` | **Hardened.** It was `web, public` (as the older steps). Now **empty** (`set search_path = ''`) on all six functions and every table is written with its schema. Proved: look-alike tables `public.ops` / `public.cache` are ignored. | fixed |
| `EXECUTE` grants | Revoked from `PUBLIC`, `anon`, `authenticated` (a Supabase project gives new functions to anon / authenticated by default – the explicit revoke undoes it); granted to `service_role` only. `web_op_note` is granted to nobody (inside use). Proved by calling each as anon and authenticated: "permission denied". | ok |
| Window while installing | **Hardened.** The file is one transaction (`begin … commit`): there is no moment in which a function exists but its revoke has not run; if anything fails nothing is installed. | fixed |
| anon / authenticated exposure | None: no execute right, no right on schema `web`, no right on `web.ops`, row-level security on with no policy, and the schema `web` is not offered by the API. `check_security.sql`: every line "ok". | ok |
| Can `web.ops` be read or changed directly? | Only by the database owner (the Supabase dashboard). **Hardened:** rights on the table are now also taken from `service_role` – even with the server's secret key the table can be neither read nor written, only the functions can be called (proved through SQL as each role and through the API with the secret key). Row-level security is not FORCED, deliberately: the functions run as the owner. | fixed |
| What is stored | `rid`, a SHA-256 fingerprint of sign-in + action + data (not the data), the answer of the save (may hold business data, as every table does), times. No password, no session token. | ok |
| Request-id collision / reuse | A number is 8 – 64 letters / digits / `_` / `-` (checked by the server and now by a table constraint). The page makes it from the time + 10 random characters. The same number with other data, or from another sign-in: **refused** – nothing saved – and the database itself now withholds the kept answer when the fingerprint differs (**hardened**). A kept answer goes only to the same sign-in while it is valid. A number of another user cannot be guessed; reusing one only yields that refusal. | fixed |
| States | `check (state in ('started','done','refused'))` added. | fixed |
| Housekeeping and saves | **Hardened 10-10-2026.** The clean-up that `web_op_begin` starts now and then is wrapped: if it ever fails, the save goes on (proved with a clean-up that raises an error). | fixed |
| Retention / growth | **Was the weak point:** cleaning happened only "now and then" inside `web_op_begin`. Now `web_ops_cleanup`: a number is forgotten **3 days** after it started; an answer longer than 2,000 letters is dropped after **24 hours** (the number stays – a late copy is answered "saved" without details, still not saved again); **never more than 200,000 numbers** (oldest first, never one younger than 2 hours). It runs about every 50th save **and every night with the server's backup job**. Measured: 6,000 numbers (three very busy days) = 3.3 MB. The table cannot grow for ever. | fixed |
| Deadlocks / waits | A copy waits only on its own number's row; the save's lock (`web.locks`) is separate; no cycle found. | ok |
| Re-run / rollback | Safe to run again (tested twice). Rollback = the seven `drop` lines in its heading; the app then uses the old way (tested). | ok |
| Compatibility | Works with update-65 (check 2) and update-65s; change-over without restart; old-style note for the older code. | ok |

Read-only checks to run in production after installing (expected results in brackets):
```sql
select count(*), min(started_at), pg_size_pretty(pg_total_relation_size('web.ops')) from web.ops;         -- (0 rows while update-65 is live)
select r, has_schema_privilege(r, 'web', 'usage') as web, has_table_privilege(r, 'web.ops', 'select') as ops
  from unnest(array['anon', 'authenticated', 'service_role']) r;                                          -- (all false)
select proname, prosecdef, proconfig from pg_proc where proname like 'web_op%' or proname = 'web_write2';  -- (search_path="" on all)
-- and the whole of sql/check_security.sql: every line must start with "ok"
```

---

## 5. Production deployment order (exact)

Before: section 7 (manual checks) done. Choose a quiet hour. (The Preview of section 3 was left out by the owner's
decision of 10-10-2026; it stays possible.)

| # | Step | How | Good when |
|---|---|---|---|
| 1 | **Backup / snapshot** | In the app (still update-65): the Backup pill → backup now → open the Sheet, tab "Backup Status" shows this minute. Supabase → Database → Backups: take / note the latest backup if the plan has them. Copy the result of `select key, value from web.props where key like '%LAST_NO' or key in ('ORG_SETTINGS','BILL_SETTINGS','SITE_RULES','CMP_RULES','LB_FORMAT_NAMES','BOOKS_CLOSED_UPTO');` into a file (the counters and settings are not in the Sheet). | Sheet time is now; the query result is saved |
| 2 | **Step-5 SQL** | Supabase → SQL Editor → `supabase_step5_save_once.sql` → Run | "Success"; then the four read-only checks of section 4 |
| 3 | **Old production still works** | Sign in; save one ordinary entry (e.g. a Diesel Issue) and see it in the list; Admin's "Database" pill as before | all normal; `select count(*) from web.ops` = 0 |
| 4 | **update-65s** (rollback-safe baseline) | `Expand-Archive … rcl-update-65s.zip`; `git add .`; `git commit -m "update-65s: rollback-safe baseline (reads scrypt passwords)"`; `git push`; wait for "Ready" in Vercel | sign out and in as Admin and as a normal user; the app works as before (no "Update" button – the page is unchanged) |
| 5 | **update-68** | `Expand-Archive … rcl-update-68.zip`; `git add .`; `git commit -m "update-68: save once in database, scrypt passwords, 30-day session, least privilege, admin-only backup"`; `git push`; "Ready"; press **Update** in the app | – |
| 6 | **Smoke test** | Admin signs in · Database check shows "step 5 ✓" · save a Diesel Issue · `select state, count(*) from web.ops group by 1` shows `done` · `select id, left(password_hash, 6) from app_users` shows `scrypt` for those who signed in · a normal user signs in, clicks the Backup pill ("Only Admin…") · Users & Access → Access report opens | all as written |
| 7 | **Watch one hour** | Vercel → Logs (errors, duration, memory); the Admin's "Faults" pill | quiet |

Do not push anything between steps 4 and 5 other than update-68 (step 4 must stay the immediately previous production
deployment).

---

## 6. Rollback procedure (exact)

**When:** sign-ins fail, saves fail, or anything in step 6 / 7 is wrong and not understood within minutes.

**A. Fast (preferred)** – Vercel → Project → Production Deployment → **Instant Rollback** → the previous deployment
(= update-65s, commit "update-65s: …") → Confirm. Takes effect at once.
*Check before confirming that the deployment offered is "update-65s". If it is anything older: cancel and use C.*
After an Instant Rollback Vercel stops putting new pushes live by itself; when the corrected version is pushed, use
"Undo Rollback" / "Promote" on it.

**B. By git** (instead of A) – `git revert --no-edit HEAD` then `git push` (the tree is update-65s again).

**C. If update-65s was never deployed** – `Expand-Archive … rcl-rollback-to-65s.zip`, `git add .`,
`git commit -m "rollback to update-65s"`, `git push`. Do NOT use Instant Rollback in this case.

**After any rollback**
* Nothing to do in the database. **Leave step 5 installed** (harmless to update-65s; proved). Do not change passwords by SQL.
* Users stay signed in; they sign in with the same passwords.
* Look at the last entries of the last minutes (Diesel Issue, Inward, payments): each is there once.
* The first backup after the rollback copies every table once.
* The nightly backup job is the same in update-65, 65s and 68 (`vercel.json`: only response headers differ), and a
  rollback does not change environment variables – nothing to set in Vercel.
* Tell the developer what was seen (the Admin's "Faults" list, the time).

**Never** promote or redeploy a deployment older than update-65s once update-68 has been live (section 1).

Step-5 SQL itself is taken out – only if it is the cause – with the seven `drop` lines in its heading; the app then
works the old way by itself (tested).

---

## 7. Manual checks before release (owner)

1. **Vercel environment variables** as in section 3 B (live values = Production only) – only if a Preview is ever made.
2. **Vercel plan and Git account**: Settings → Git shows which GitHub account is connected; pushes from the PC appear as
   deployments (they do today). Know where "Instant Rollback" is.
3. **Supabase backups**: Database → Backups – does the plan have them? If not, the Sheet backup of step 1 is the only one.
4. **Backup Sheet sharing**: Share → General access → Restricted.
5. **The folder on the PC**: `git status` clean, `git log -1` shows `2e4e3cc update-65`.
6. Only if the Preview test is run after all: Node on the PC (`node -v` ≥ 18) and its result `16 passed, 0 failed`.
7. If Supabase's SQL Editor asks "this query has destructive operations – run anyway?" at step 2: confirm (the file
   deletes nothing of the ERP; the words are in its clean-up function and its comments).
8. Tell the users the time; nobody in the middle of a long entry (Edit Log Book grid) at step 5.

---

## 8. Files of this round

| File | For |
|---|---|
| `rcl-update-65s.zip` | the rollback-safe baseline (deploy before update-68) |
| `rcl-update-68.zip` | update-68, with the hardened step-5 SQL, the retention, the new tests and this report |
| `rcl-rollback-to-65s.zip` | emergency way back if update-65s was not deployed first |
| `supabase_step5_save_once.sql` | the SQL to run in production (also inside the update-68 zip and shown in the app) |
| `preview_test_database.sql` | every SQL step for the empty TEST project of the Preview |
| `test/preview-smoke.js` (in the zip) | the Preview test |

**update-68 after the changes of this round (rig, 08-10-2026):** unit 44 / 44 · `saveonce.js` 42 / 0 (with the new
section on the SQL itself) · `secure68.js` 47 / 0 · `harden.js` 27 / 0 · `backup.js` 28 / 0 · `audit.js` 36 / 0 ·
`reg.js` 11 / 0 · `restore-drill.js` 7 / 0 · `dn.js` 13 / 1 (the same "backup is not set up" line) · `rollback68.js`
20 / 0 · `rollback68-backup.js` 4 / 0 · `preview-smoke.js` rehearsal 16 / 0 · browser: hardenpage, least68, viewbill,
lbpage, billlock, nightrow, gstdecl, lbbasis, lxlook, sweep, splittime, half – 192 PASS lines, 0 FAIL.
Every command was run with a time limit; none reached it.

Changed since the first update-68 package: `sql/supabase_step5_save_once.sql`, `app/ReadMe.gs` (its copy),
`server/runtime.js` (nightly clean-up; comments), `server/gas.js` (one name), `app/Code.gs` (one line of the Database
check), tests and documents. **No ERP module, calculation, page or permission was changed.**

## 9. What was NOT verified

* The Vercel runtime (section 3) – open.
* The live database, the live Sheet, real phones, Windows / Edge.
* Supabase's hosted gateway and pooler (the rig runs the same PostgREST and PostgreSQL 16, not Supabase's own layer).
* Vercel's "Instant Rollback" itself (described from Vercel's documentation, not clicked). Which Vercel plan the
  project is on was not seen; the order of section 5 is written for the strictest case (Hobby: only the immediately
  previous production deployment can be rolled back to).
* The time one scrypt sign-in takes on Vercel's CPU and the memory limit there (locally 300 – 440 ms; the Preview test
  prints the times).
* Check 2, browser level: the run WITHOUT step 5 was repeated for 28 of the 60 tests (all that were not clean); the
  other 32 were run with step 5 only (all PASS). 12 old tests have failing lines and 3 crash on update-65 itself, the
  same with and without step 5 – causes not investigated.
* update-65s: the API suite and 11 browser tests; not the other 49 browser tests (its page is byte-identical to
  update-65's and the three changed files touch only the password check).
* The 60 older browser tests were not run again against update-68 in this round (they were in the update-68 round);
  this round ran update-68's 12 browser tests and its API suites after the SQL hardening (section 8).

---

## 10. Final re-check of 10-10-2026

Asked: "I will not do anything – check everything again, deeply, and tell me finally what to do."
Nothing was pushed, deployed, or run against the live database or the live Sheet. GitHub `main` is still `2e4e3cc`.

### 10.1 Two independent reviews (reviewers that had not seen the work)

**Result: no blocker in the step-5 SQL, in update-65s or in update-68.** Both confirmed the main claims by reading and by
their own experiments (stored text never opens an account; nobody is locked out on the path 65 → 65s → 68 → 65s → 68;
sessions survive every hop; the SQL changes no existing object, takes no lock live traffic uses, is one transaction).

Three findings were worth fixing now – each small, each measured before and after:

| Finding | Before (packages of 08-10) | After (packages of 10-10) |
|---|---|---|
| A refused sign-in was answered quickly when the password is still kept the older way (every user right after the deployment) – the time told that the e-mail exists | unknown e-mail 282 ms · wrong password 34 ms | 306 ms · 294 ms (update-68 and update-65s) |
| A write whose answer was lost AND the database could not be asked right after (two faults at once): the page showed an error although the entry was in – the person would type it again | "Could not save to Supabase: 503" · entry in the database · page does not resend | "again later" · the page sends the SAME number again · one entry, one number |
| The clean-up started inside `web_op_begin` could, if it ever failed, fail that save attempt | not guarded | guarded – the save goes on |

Files touched by this: `app/Code.gs` (sign-in: 4 lines, + 1 helper) in update-68 and in update-65s, `server/runtime.js`
(3 lines), `sql/supabase_step5_save_once.sql` (1 line + comments; `app/ReadMe.gs` copy), tests. **No ERP module,
calculation, page or permission was changed.**

Findings NOT changed (judged not worth touching a tested release; listed so that nothing is hidden):
* If scrypt **itself failed on Vercel** (not expected – it is part of Node): users whose password is still kept the older
  way sign in normally and are simply not moved to scrypt (verified by experiment: no write, valid session). What would
  not work in that case: changing a password, the Admin setting a one-time password, and sign-in of users already moved.
  → This is what step 6 of section 5 looks for ("`scrypt` in front of the password of somebody who signed in"). If it is
  not there: go back to update-65s (nobody was moved, so nobody is affected) and tell the developer.
* A save that is **in flight at the very second** of a rollback (started on update-68, its copy lands on older code before
  the first finished) can be saved twice. Finished saves are covered (tested). → Roll back in a quiet minute if possible.
* A kept password that somebody **edited by hand in the database** into a damaged form (leading blank, capitals) is compared
  as typed text – as in update-65 today. Not reachable through the app.
* A one-time password that itself looks like a kept password (`sha256$…` typed by the Admin) never works – choose another.
* Large answers of saves are kept twice for a short time (24 h in `web.ops`, 1 h as the old-style note); bounded by the
  retention rule.
* Supabase's SQL Editor may ask "this query has destructive operations – run anyway?" because the file contains the
  words `delete` / `drop` (inside its clean-up function and its comments). It deletes nothing of the ERP: confirm.
* The rig's default rights differ from Supabase's. → Closed: the SQL was installed again on an empty database with
  Supabase-style default rights (new functions given to anon / authenticated / service_role): anon and authenticated
  cannot call any of the six functions, `web_op_note` nobody, `web.ops` is closed to all three; `check_security.sql` 43 × ok.

### 10.2 Every suite again (on the final files)

Run on 10-10-2026 after the three hardenings, every command with a time limit (none reached it):

| Suite | Result |
|---|---|
| unit – update-68 / update-65s | 44 / 44 · 39 / 39 |
| `saveonce.js` | 44 passed, 0 failed (42 + the two new lines) |
| `secure68.js` (with the exact update-65 on the comparison port) | 52 passed, 0 failed (51 + the new timing line) |
| `rollback68.js` (update-68, update-65s, exact update-65 on one database) | 21 passed, 0 failed (20 + the new timing line) |
| `rollback68-backup.js` | 4 passed, 0 failed |
| `harden.js` · `backup.js` · `audit.js` · `reg.js` · `restore-drill.js` | 27 / 0 · 28 / 0 · 36 / 0 · 11 / 0 · 7 / 0 |
| `dn.js` | 13 passed, 1 failed – the known line "backup is not set up" for the rig's servers |
| browser: hardenpage 10 · least68 9 · viewbill 23 · lbpage 13 · billlock 17 · gstdecl 11 · lbbasis 9 · lxlook 10 · sweep 38 · nightrow 22 · half 12 · splittime 18 | 192 PASS lines, 0 FAIL |
| `preview-smoke.js` rehearsal on an empty database with Supabase-style default rights | 16 passed, 0 failed |

Said plainly: `splittime.js` first showed 9 FAIL lines. Cause: two test batches of mine ran at the same time and one of
them restarts the rig; run alone it is 18 / 18. And this re-check was interrupted once by the owner after 43 minutes
(stage 1 of the rehearsal had just finished); it was continued from that point, nothing was run twice blindly.

### 10.3 Dress rehearsal of the production order – with the delivered files only

The four folders were built from GitHub `main` (`2e4e3cc`) plus **only the zip files that are delivered**; the SQL is
the delivered file. The rig's database was first put in the state of production today (no step 5, passwords kept the
old way). Then the order of section 5, one stage after the other, each followed by the same walk-through (sign-ins of
the stage before still valid · Admin and a normal user sign in · wrong password and the kept text refused · the app
starts · Database check · a Diesel Issue saved and the same request sent again to the other server → one entry, one
number · the entry deleted again):

| Stage | Code | Result |
|---|---|---|
| 0 – production today | update-65, no step 5 | 7 passed, 0 failed |
| 1 – the step-5 SQL is run **while 25 people use the app** | update-65 | SQL took 63 ms; no call of the 25 people failed; 9 passed, 0 failed; `web.ops` stays empty; `check_security.sql` 43 × ok |
| 2 – update-65s is deployed | update-65s | 9 passed, 0 failed; same version mark → no "Update" prompt; passwords not rewritten |
| 3 – update-68 is deployed | update-68 | 11 passed, 0 failed; both passwords now scrypt; Database check shows step 5; the save's number is "done" in the database; normal user: "Only Admin can start a backup." |
| 4 – **ROLLBACK** to update-65s (passwords are scrypt) | update-65s | 9 passed, 0 failed; everybody signs in with the same password; the kept text is refused; sessions of stage 3 still valid |
| 5 – forward again | update-68 | 11 passed, 0 failed |
| 6 – the emergency way back (update-68 + `rcl-rollback-to-65s.zip`) | = update-65s | 9 passed, 0 failed |

**65 lines passed, 0 failed.** Not part of the rehearsal because it cannot be on a rig: Vercel itself, the live
database, the live Sheet.
