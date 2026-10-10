# update-68 – security and data-integrity release (07-10-2026)

> **Read `RELEASE_68.md` first.** It is the later document: the three release-safety checks (going back is safe with the
> baseline `update-65s`; step 5 works with the live update-65; the Vercel Preview test), the security review of the
> step-5 SQL, the exact order of the production deployment and the exact way back. Where the two differ, it counts.

Scope: only the owner's decisions D1 – D12 on the audit of update-67 (`AUDIT_2026-10-07.md`). No refactor, no clean-up of
unused code, no splitting of files. Everything of update-67 is kept and its tests pass.

**Nothing was run against the live Supabase database, the live site or the real Google Sheet.** All proofs below were made
on the local test rig (PostgreSQL 16 + PostgREST behind a gateway stand-in with a fault switch, two copies of the app's
server, a headless Chromium). "Before" = the code that is live today (GitHub `2e4e3cc`, update-65) run on the same rig.

---

## 1. Executive summary

| # | Decision | Result in update-68 |
|---|---|---|
| D7 | Unknown-result save / duplicate save (HIGH) | **Built and proved.** A save is recorded with its number in the SAME database transaction as the entry (new SQL step 5). Lost answer, cut connection, late answer, killed server, two servers at once: one row, one number, the same answer. Needs **one SQL file run by the owner**; until then the app works exactly as before. |
| D2 | Passwords → scrypt | **Built and proved.** scrypt (N=32768, r=8, p=3). Old hashes are accepted and re-kept at the next good sign-in, other sessions stay signed in. One-time passwords and plain passwords in the table are kept with scrypt too. No schema change. |
| D6 | Session: 30 days at most | **Built and proved.** Inactivity (6 h) as before + absolute 30 days from the sign-in. |
| D5 | Manual backup: Admin only | **Built and proved**, refused on the server. The nightly job and the automatic check are untouched. |
| D4 | Least privilege of start-up calls | **Built and proved** after mapping every consumer in the page. Rate, TDS %, engine / chassis / paper dates, driver, pump and vendor names and the stock go only to users with a page that uses them. Page access itself is unchanged. |
| D3 | Empty access cells | **No behaviour change.** A read-only Access report (Admin) shows user, page, raw cell, effective access. |
| D1 | Backup Sheet privacy | Code verified: it cannot open the Sheet to "anyone" (unit test). **Owner must check the Sheet's sharing in Google.** |
| D8 | Database constraints | **Files only**: read-only preflight (20 rules) + proposed constraints with risk and roll-back for each. Tested on the rig. Nothing to run yet except the preflight (it only reads). |
| D10 | Strict CSP | **Not enforced** (as decided). Report-only stays; violations are now noted quietly in the Admin's fault list. Checklist for later below. |
| D11 | Concurrent editing | **Design only** + today's behaviour measured (`test/stale.js`). Not implemented – reasons below. |
| D12 | Restore | **Audit + strategy + a restore drill on the rig** (`test/restore-drill.js`): a database copy and the Sheet were both restored into scratch databases and compared. No restore button was built. |
| D9 | GitHub private | Owner action. One Vercel point must be checked first (below). |

Deployment needs: **git push** (all code) + **one Supabase SQL file** (`supabase_step5_save_once.sql`, for D7 only) + two owner
settings (Google Sheet sharing, GitHub visibility). No Vercel environment or config change.

---

## 2. Files changed (compared with update-67)

| File | What |
|---|---|
| `sql/supabase_step5_save_once.sql` | NEW – table `web.ops`, functions `web_op_begin`, `web_op_mark`, `web_write2`, `web_op_end`, `web_ops_cleanup`, `web_op_note` (D7) |
| `sql/proposed/preflight_readonly.sql` | NEW – read-only checks for constraints and grants (D8) |
| `sql/proposed/constraints_after_preflight.sql` | NEW – PROPOSED constraints, not a step of the app (D8) |
| `server/runtime.js` | `runOnce` (the save-once flow), `__op`, the door `saved`; step 5 is asked for with every save (not remembered) |
| `server/gas.js` | names the step-5 functions when missing; `scryptHex` (host function for the app's code) |
| `app/SupabaseData.gs` | `flush` writes through `web_write2` (number + rows in one transaction) when the request has a number |
| `app/Code.gs` | D2 passwords (`makeHash_`, `checkPw_`, `rehash_`, `storePw_`, `pwStamp_`, `pwDummy_`), D6 sessions (`sessionMake_`, `sessionRead_`, `sessionUser_`), D5 (`backupNow` Admin-only), D4 (`leastOut_`, `getInit_`, `getLookups_`, `getStock`, brief), D3 (`accessReport_`), D7 (`savedAfterAll_`, kept answer), health-check line for step 5 |
| `app/ReadMe.gs` | step 5 listed with its full text (shown in the app, Admin → Read me) |
| `app/App.html` | stock asked only when a page shows it; backup pill for non-Admin; "Access report" button (Users & Access); quiet note of policy violations; two actions listed in the page guide |
| `test/saveonce.js`, `test/secure68.js`, `test/stale.js`, `test/restore-drill.js`, `test/browser/least68.js` | NEW tests |
| `test/unit.test.js` | +5 tests (39 → 44) |
| `test/backup.js` | +section `manual` (D5); the password check also looks for "scrypt" |
| `test/harden.js` | 6 expectations brought in line with the new flow (see 4.3) + 1 new line |
| `test/gateway-standin.js` | fault options `delay` and `drop` |
| `UPDATE_68.md`, `HANDOVER.md`, `README.md`, `NEW_SITE_SETUP.md` | documentation |

Not touched: every ERP module (Log Book, billing, BOQ, diesel, reports …), calculations, permissions, `vercel.json`,
`api/*`, `server/pool.js`, `server/backup.vm.js`, `server/page.js`, the service worker, the SQL steps 1 – 4.

---

## 3. Exact fixes

### D7 – a save is saved once, decided inside the database

**The problem (measured on the live code).** The page gives every save a number and sends the same save again when no answer
comes. The server noted "this number is done" in a separate cache entry written *after* the save. When the entry went into
the database but its answer was lost, no note existed – the copy was saved a second time.

| Fault injected (rig) | Live code (2e4e3cc) | update-68 with step 5 |
|---|---|---|
| write carried out, server gets "503" for it | user is told "Could not save" although the entry IS saved | answers **saved**; 1 row, 1 number |
| connection cut right after the write | "Network: other side closed" although saved | answers **saved**; 1 row, 1 number |
| answer later than the server waits | **2 rows, 2 Diesel Issue numbers** | 1 row, 1 number |
| server killed after the write | **2 rows, 2 numbers** (copy answered after 79 s) | 1 row, 1 number (copy answered after 3 s) |
| same number with a different entry | answered with the OTHER entry's answer | refused |
| same number from another sign-in / after sign-out | answered | refused / "not signed in" |

**The mechanism.**

```
page ──save #X──▶ server ──web_op_begin(X, fingerprint, holder)──▶ database        (1) "yours" / "done: here is the answer" /
                                                                                       "refused" / "somebody is on it: wait" / "old"
                  server runs the action under the lock
                  └─ web_write2(rows, X, holder, answer)  = ONE transaction:       (2) web_op_mark: X is done  +  web_write: the rows
                        both are in the database, or neither
                  server ──web_op_end(X, holder, done | refused | free | close)──▶  (3) final answer / refusal / number given back
```

* `web.ops`: one row per save number – `rid`, `hash` (sign-in + action + data), `holder` (the request that may write it),
  `state` (started → done / refused), `result`, `started_at`, `done_at`, `closed_at`.
* **Same number, different data** (or another sign-in): refused – never run, never answered with another entry's answer.
* **Two copies at the same moment** on two servers: the primary key lets exactly one be "mine"; the other waits and gets
  the first one's answer.
* **A copy that died without writing**: taken over after 75 s (a request lives 60 s at most). A write of the dead copy that
  is still on its way makes the take-over wait (row lock) and then find "done"; `web_op_mark` refuses a writer whose number
  was taken over (`OP_NOT_MINE`) – two copies can never both write.
* **The database has the last word**: whatever error the server got, it asks `web_op_end`; if the state is "done", the
  request answers "saved" with the kept answer.
* **What follows a save** (Activity Log line, telling the open pages) is finished by exactly one request
  (`web_op_end('close')`): normally the one that saved; if it could not (no answer, server stopped), the copy that finds
  "done but not closed" does it (`savedAfterAll_`) – the Activity Log gets its line, once, and the Admin's fault list says
  what happened.
* Works for every saving action (it sits in front of all of them): Diesel Issue DI-, Inward IN-, Transfer, bills, debit
  notes, payments, BOQ, Log Book … – a copy never takes a second number.
* Not in memory, not on the client: one table in the database, shared by every server instance.

**Compatibility.**
* Until step 5 is run, `web_op_begin` answers "404 not installed" and the server uses the old way – exactly today's
  behaviour (tested: `saveonce.js compat`). The Admin's Database check shows step 5 as "to do".
* Whether step 5 is installed is asked with every save and never remembered, so the moment the SQL is run every server
  uses it. A save that went the old way seconds before is still finished the old way (`web_op_begin` answers "old" when it
  finds the old note). Tested without restarting the servers.
* `web_write` (step 3) is not changed. `web_write2` only calls `web_op_mark` and then `web_write`.

**Roll-back.** The heading of the SQL file has the five `drop` lines. After them the app is back on the old way by itself.
Nothing else depends on these objects. Tested (taken out, put back twice).

**Honest limits.**
* A failed transaction still uses up a Diesel Issue number (the counter is written at once, as before) – a gap, never a
  duplicate. Unchanged from today.
* The Activity Log line is still written after the save, not in its transaction (as before). What is new: if it could not
  be written, it is made up for by the next copy. For an EDIT or a DELETE that line then has no before/after details (they
  are not known any more); for a new entry it is the usual line.
* `web.ops` cannot grow for ever (`web_ops_cleanup`, run about every 50th save and every night by the server's backup
  job): a number is kept 3 days; an answer longer than 2,000 letters is dropped after 24 hours (the number stays, a copy
  that late is answered "saved" without details); never more than 200,000 numbers. Measured on the rig: 6,000 numbers
  (three very busy days) = 3.3 MB.
* For the code before update-68 the database also leaves the old-style note of a done save (`web_op_note`, in the same
  transaction): after a roll-back a copy of that save is answered from it and not saved again.
* Settings saved through "properties" (not table rows) are marked done at the end of the request, not atomically – they
  are safe to repeat.

### D2 – passwords are kept with scrypt

* Kept as `scrypt$<N>$<r>$<p>$<salt 32 hex>$<hash 64 hex>$<stamp 12 hex>`; a one-time password has `tmp$` in front.
  N=32768, r=8, p=3: 32 MB and about 0.3 s per check on the rig (the old way: 301 SHA-256 rounds ≈ 0.1 ms).
* The cost settings are part of the kept text. Only values from a short list are accepted (N 16384 – 131072, r 8, p 1 – 5):
  a planted value like N = 1,073,741,824 is refused in 39 ms and cannot hold a server.
* **Old format**: `sha256$salt$hash` is still read. After a sign-in with the right password it is kept afresh with scrypt.
  The session stamp is carried over, so the person's other devices stay signed in.
* One-time passwords made before the update (`tmp$sha256$…`) and a plain password typed into the table are accepted once and
  kept as `tmp$scrypt$…` – still one-time, still "must change", the server opens nothing until it is changed.
* A damaged kept text opens for nothing and is never compared as plain text; the kept text typed as the password is refused.
* A wrong e-mail now costs the same work as a wrong password (same answer time: 304 ms vs 304 ms) – the time does not
  tell which e-mails exist.
* No schema change: the same `password_hash` cell.

**Side effect to know.** A sign-in now takes about a third of a second of work, and the existing rule "at most 5 tries of one
e-mail are looked at at the same time" now covers a longer moment: 9 sign-ins of ONE e-mail in the same instant → at least 5
get in, the rest are asked to try again; nobody is locked (tested).

**Going back to a version before update-68 (important).** The safe way back is the baseline **update-65s** (update-65 that
can read scrypt – see `RELEASE_68.md` §1: nobody is locked out, the kept text is not a password). The following applies
only to the PLAIN update-65 or older, which must not be put live again. Measured on the live code:
1. it cannot read `scrypt$…` → such a user cannot sign in with the password;
2. worse, it treats the kept text as a *plain* password → whoever has a copy of the Users table could sign in with the text.

So: do **not** roll the code back below update-68 without running this first (it replaces every scrypt password by a random
value nobody knows and gives the Admin a one-time password; users then get new one-time passwords from the Admin):

```sql
-- ONLY when going back to code older than update-68. Replace the e-mail and the one-time password.
update public.app_users set password_hash = 'tmp$sha256$' || substr(md5(random()::text), 1, 16) || '$' || md5(random()::text) || md5(random()::text)
  where password_hash ~ '^(tmp\$)?scrypt\$';
update public.app_users set password_hash = 'Choose-A-One-Time-Password-9' where id = 'admin@example.com';
delete from web.cache where key = 'USERS_LIST';
```

Tested on the rig against the live code: after it nobody signs in with a kept text or an old password; the one-time
password signs in, must be changed, the change works; and update-68 afterwards reads what the old code wrote.
Rolling *forward* (65 → 68) needs nothing: all existing passwords keep working.

### D6 – a sign-in lasts 30 days at most

Session value `email|stamp|time of the sign-in`. Ended when: not used for 6 hours (as before), the password changed, the
user deactivated, signed out (all as before, at once, on every server) – and now 30 days after the sign-in whatever happens
(checked at every use; also for "change password"). A session from before the update has no time: it gets "now" at its first
use, so it too ends within 30 days. Nobody is signed out by the deployment.

### D5 – only the Admin starts a backup by hand

`backupNow` is `admin: true` in the server's action list → "Only Admin can start a backup." for anybody else; nothing is
started (no call to Google, the backup's notes untouched – measured). The page: the pill still shows every user that the
backup is all right; for a non-Admin a click asks the server for nothing.
Unchanged and tested: the nightly job with its secret (`/api/backup`), and the automatic check an open app makes every few
minutes (not a manual start: the server decides whether one is due; refused without a sign-in).

### D4 – the start-up calls give only what the user's pages use

Map of consumers (made from the page's code before anything was trimmed):

| Data | Read by (page code) | Now sent to users with access to |
|---|---|---|
| machinery: number, name, type, make, unit / works on, Log Book format, modes, owner, ownership, supply, status, dates, standard averages, tank capacity | every pick-list, global search, diesel, Log Book, reports, billing, assistant | **everybody** (unchanged) |
| `monthlyRate`, `tdsRate` | Asset Master form + bulk edit, Machinery Billing (`mbMachine`), Log Book print (`logSheetsBuild`) | Asset Master, Machinery Billing, Saved Bills, Log Book |
| `engineNo`, `chassisNo`, `engineMake`, the five paper dates, `enteredBy`, `updatedBy` | Asset Master list / form / export / asset list print | Asset Master (Vehicle Compliance has its own list from the server) |
| driver names | Diesel Issue form, filter, multiple-entry grid | Diesel Issue |
| pump names | Diesel Inward form + filter, report filter | Diesel Inward, Reports |
| vendor names | "Debit to (party)" in the Log Book, debit-note form | Log Book, Machinery Billing, Saved Bills |
| diesel stock (`getInit`, `getStock`, daily brief) | Diesel Inward / Transfer / Issue pills, assistant; Dashboard and reports have their own calls | Dashboard, Diesel Inward, Diesel Transfer, Diesel Issue, Reports |

* The machinery details are cut from **every** answer of the server (`leastOut_` finds a machinery item anywhere in an
  answer), so no other action gives them by the side (checked: Stock ledger report, Edit Log Book, search, brief, sync).
* Copies only – the machinery list shared inside a request is never changed.
* `getStock` is refused for users without a page that shows stock; the page no longer asks for it for them.
* View access counts as access (a View-only user of a page gets what that page uses). Admin: everything.
* Before (live code): a user with **no page at all** received all 12 detail fields of every machinery, every driver, pump
  and vendor name and the stock. After: none of them (the values are nowhere in what is sent – text search of the answers).

### D3 – access report (no behaviour change)

Admin → Users & Access → **Access report**: a summary (written / EMPTY → View / other text → View / Admin / taken from another
column / no column) and "Save the full list" = one line per user and page: user, e-mail, active, Admin, page, *what is
written in the Users table*, *the access the app gives now*, why. "Access now" is taken from the same list every sign-in
uses, and was compared with what the user's own sign-in gets (17 pages). The Users table is byte for byte the same after
the report. An empty cell still gives View.
The same from SQL, read-only: `select id, admin, perm_dashboard, perm_master, … from public.app_users order by id;`

### D1 – backup Sheet privacy (code side)

Verified and pinned by a unit test: the server's backup uses Google's Sheets API only, with the right `spreadsheets` only
(sharing needs a Drive right it does not have); no code names "anyone with the link"; the one place that sets sharing at
all (the old Apps Script backup) sets PRIVATE. **The Sheet's present sharing cannot be seen from code – owner check below.**

### D10 – strict CSP (not enforced)

Unchanged headers: enforced `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`; report-only
`script-src 'self' 'unsafe-inline'; worker-src 'self'`. New: what the browser would refuse is noted quietly in the Admin's
fault list ("Security policy (watched only – nothing was blocked): …"), each kind once, at most 3 per page load, browser
extensions ignored, the user sees nothing. A walk through all 38 pages + print + Excel produced no note.

**What still stands in the way of a strict `script-src` (no `'unsafe-inline'`):**

| Kind | Where | Count |
|---|---|---|
| inline event handlers | `app/App.html`: `onerror=` on logo images (lines 2437, 2444, 2485, 2486, 6624, 6625, 9412 ×2, 13590, 13591), `onsubmit="return false"` on the sign-in form (2442), `onclick=` in print windows (6570 ×2, 6578) and in the BOQ box (8831) | 15 |
| inline scripts | `App.html`: the app (≈1.15 MB), the QR library, 4 small ones; `Index.html`: the shell with the app as a JS literal; `server/page.js`: the bridge; print windows written with `document.write` and a script made from `fn.toString()` | 8 + print windows |
| inline `style="…"` | `App.html` (needs `style-src 'unsafe-inline'` or a clean-up) | 136 |
| external hosts | `i.ibb.co` (logos, favicon, Excel logo fetch), `fonts.googleapis.com` + `fonts.gstatic.com` (Google Fonts), `cdn.21st.dev` (sign-in picture), `ifsc.razorpay.com` (bank look-up `fetch`), `cdnjs.cloudflare.com` (second try for the Excel tool), any `https` logo / film the Admin sets | 6 + Admin-set |
| old Apps Script compatibility | the page is ONE document put into an iframe by `srcdoc` and swapped in place for a new version; it talks through a `google.script.run` stand-in (inline bridge). Nonces or hashes cannot be used with a static shell + a page assembled in the browser | – |

**Checklist for a later update (in this order, each step shippable on its own):**
0. Watch the Admin's fault list for "Security policy" notes for a few weeks (now possible).
1. Replace the 15 inline handlers by listeners (`onsubmit="return false"` first: the form's submit listener has no
   `preventDefault` today – the riskiest one).
2. Bring the logos and the sign-in picture into the app's own files (`/vendor/…`-style), fonts self-hosted or dropped.
3. Print windows: a real page of the app (`/print.html` + `postMessage`) instead of `document.write` with inline script.
4. Move the app's script, the QR library and the bridge into files served by the app (`/app.<hash>.js`); the shell loads
   the page by URL instead of `srcdoc` (this is the large step – it changes how a new version is swapped in).
5. Report-only: `script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self' https://ifsc.razorpay.com; font-src 'self' https://fonts.gstatic.com` – two weeks without notes.
6. Enforce. `style-src` without `'unsafe-inline'` only after the 136 attributes are gone (separate, low value).

### D11 – concurrent editing (design; not implemented)

**Measured today** (`node test/stale.js`): A corrects a Diesel Issue 10 → 25 Ltr; B, whose form still shows 10, adds a remark
and saves → the entry is 10 Ltr again, B gets no warning. The same with a payment: ₹50,000 → ₹55,000 by A is put back to
₹50,000 by B. No save anywhere checks a version.

**Where it matters most (ranked by money / operational weight and by how a save is built):**

| # | Entity | Why |
|---|---|---|
| 1 | Edit Log Book grid (`saveLogBulk`) | one save re-sends EVERY row of the period – a stale grid overwrites other people's rows wholesale; Log Book drives the bills |
| 2 | Diesel Issue edit | stock and debit amounts |
| 3 | Payments / opening balance | money, vendor ledger |
| 4 | BOQ edit | rates of every later bill |
| 5 | Vendor (bank / PAN / GST) | found by name; an "edit" of a deleted vendor adds it again |
| 6 | Asset Master | rate, TDS %, status |
| 7 | Log Book single row, Diesel Inward, Transfer | |
| 8 | Users & Access, status changes, deletes | |
| 9 | Settings (kept as properties) | needs its own mechanism |

**Proposed mechanism – a content fingerprint, no schema change.**
* When the server gives a record for editing it adds `ver` = a short hash of the record's *business* fields as stored.
* The page sends `ver` back with the save. Under the lock, with fresh data, the server recomputes it. Different →
  `"<who> changed this entry at <time> after you opened it – nothing was saved. Reload it and enter your change again."`
* No `ver` sent (a page of an older version still open) → no check, as today (compatible roll-out).
* Why not `updated_at`: every table has it, but it also moves when nobody edited the record – balances recalculated after
  a back-dated entry, the Log Book chain, renames, bills re-writing debit notes. It would raise false conflicts all day.
  The fingerprint leaves the derived columns (balances, stock, chain values) out.
* The grid: one `ver` per row; only rows the person actually changed are checked and written (this also stops the
  wholesale overwrite).
* Optional later (schema): a `rev integer` column per table raised by the app on a real edit – cheaper to compare, same
  semantics. Not needed for the first version.

**Why it is not in update-68.** It needs a change in every edit form of the page (keep and send `ver`) and in every
edit action, i.e. it touches Log Book, diesel, payments, BOQ, vendors and master code – against "do not rewrite ERP modules
unrelated to these decisions" and too wide to prove properly inside this release. Suggested as its own update, entity
1 – 3 first, with `test/stale.js` as the acceptance test (its lines must flip to "refused").

### D12 – restore (audit, strategy, drill)

**What exists today.**

| | A. Supabase's own backups | B. Google Sheet backup (the app's) | C. not in the Sheet |
|---|---|---|---|
| What | whole database | every public table, every column, every row | – |
| Contains | everything | entries, vendors, users (without passwords), Activity Log, `app_settings` (personal settings, fault list) | `web.props`: the counters (`DIESEL_LAST_NO`, `INWARD_LAST_NO`, `LOG_LAST_NO` …), site settings (`ORG_SETTINGS`, `BILL_SETTINGS`, `SITE_RULES`, `CMP_RULES`, `LB_FORMAT_NAMES`, `BOOKS_CLOSED_UPTO`, AI settings); passwords; `web.cache`, `web.ops`; the functions, triggers and security rules (those are the SQL steps in `sql/`) |
| Freshness | daily (plan-dependent) | within minutes of a change while an app is open; nightly in full | – |
| Restore path today | Supabase dashboard | **none** | – |

**Depends on the Supabase plan / settings – cannot be seen from the repository (please check in the dashboard):**
Database → Backups. According to Supabase's documentation: the Free plan has **no** backups you can restore; Pro keeps daily
backups 7 days (Team 14, Enterprise up to 30); point-in-time recovery is a paid add-on that needs at least the Small
compute size; a restore brings downtime; Storage files are not in a database backup. Whether the project is paused after
inactivity (Free) also matters. If the project is on Free, the Sheet is today the ONLY backup.

**Restore drill on the rig** (`node test/restore-drill.js`, scratch databases only):

| Route | Result |
|---|---|
| A – database copy (`pg_dump` → new database) | every table row for row and byte for byte (17 tables); settings, counters, 16 functions, 34 triggers back; the counters continue (no number twice) |
| B – from the Sheet into an EMPTY database (schema from the SQL steps) | every table has its tab with every column; the same number of rows; **16 of 17 tables byte for byte**, incl. account number `000123456789012345`, "=1+1 Bank", "12/5", "+91 …"; the 17th differs only in `password_hash` (deliberately "(hidden)") |
| B – what does not come back | passwords (every user needs a one-time password; the Admin first, by SQL); everything of column C; a cell longer than 49,000 letters is cut (none in the test data – a very long bill could be) |

Limits of the drill: the "Sheet" is the stand-in of the tests – it holds exactly what the app SENDS. How Google stores
dates / times (as its own date values, in the Sheet's time zone) and gives them back is **not** proved; the rig has few
rows (bills, BOQ: none). A real drill is step 1 below.

**Strategy.**
1. **A real restore drill once** (owner + developer, nothing in production is touched): a NEW empty Supabase project →
   SQL steps 1 – 5 → restore (a) from a Supabase backup / `pg_dump` if the plan has one, (b) from a COPY of the Sheet →
   compare counts and fingerprints table by table with the queries of `restore-drill.js` → point a preview deployment at
   it and sign in. Only after this is the backup "proved".
2. **Close the gaps of the Sheet**: copy `web.props` (settings + counters, without secrets) into a tab – small change to
   the backup, its own update; or accept "A is the restore, B is the reading copy".
3. **If a restore tool is ever built: never a "Restore everything" button.** An Admin-only, off-by-default tool (or a
   script run by the developer) with:
   * *source validation*: every tab present, headings = the table's columns, row counts against "Backup Status", no cut
     cells, ids unique;
   * *dry-run first*: per table "would add / would change / would delete / identical" – nothing written;
   * *conflict detection*: rows newer in the database than in the backup (`updated_at`) are listed, never overwritten
     silently; default = restore only what is missing;
   * *table order*: master, vendors, users → BOQ → diesel inward, transfer, issue → Log Book, tank check → bills, debit
     notes, payments → history tables (there are no foreign keys; the order is for the app's own cross-checks);
   * *one transaction per run* with the triggers quiet, the app's lock held (`web.locks`), the app in "read only" for
     that time; counters set from the data afterwards (`DIESEL_LAST_NO` ≥ highest number …);
   * *audit*: who, when, from which backup, counts per table – into the Activity Log and a table of its own;
   * *way back*: a `pg_dump` (or Supabase backup) taken immediately before; the run can be undone by restoring it.
4. Until then the documented procedure is: Supabase restore if the plan has it; otherwise the Sheet + developer, on a new
   project first.

---

## 4. Tests

### 4.1 New in update-68

| Test | What | Live code (before) | update-68 |
|---|---|---|---|
| `node test/saveonce.js` | D7: A normal · B lost answer ×4 (503, cut, late, server killed) · C retried · D two servers / six copies · E other payload / other sign-in · F real failure ×2 · G locks, double click · H numbering · take-over · stale writer · database functions alone · compat (step taken out / put back, change-over without restart) | 10 passed, **7 failed** (of the 17 lines that apply to it) | **44 passed, 0 failed** (31 + 11 lines on the SQL itself – rights, look-alike tables, retention – added 08-10-2026; + 2 on 10-10-2026: two faults at once, and a clean-up that fails) |
| `node test/secure68.js` | D2 (19) · D6 (9) · D3 (6) · D4 (13) · going back (4, against the live code) | D4: 6 passed, **8 failed**; D6: absolute limit **fails** | **51 passed, 0 failed** |
| `node test/backup.js manual` | D5: user refused, Admin runs, automatic check, no sign-in, nightly job | (user could start a backup) | 5 of 5 |
| `node test/restore-drill.js` | D12: both routes into scratch databases | – | 7 passed, 0 failed |
| `test/browser/least68.js` | real browser: no-access, diesel-only, Log Book + billing, reports + dashboard, inward + transfer users and the Admin open every page they have – no script error, lists there where used; backup pill; Access report file; policy note | – | 9 passed, 0 failed |
| `node test/stale.js` | D11: today's behaviour measured | A's change lost, no warning | the same (not fixed – design) |
| D8 on the rig | preflight finds 19 planted violations (rolled back); blocks A, B, C, E, F applied twice, audit suite 34/34 with them, bad writes refused with nothing left, then removed | – | done |

### 4.2 Existing suites (all re-run on the final build)

(10-10-2026: final re-check – every suite once more on the final files, `secure68.js` now 52 lines, `rollback68.js` 21; see `RELEASE_68.md` §10.)
(08-10-2026: after the hardening of the step-5 SQL every suite of 4.1 and 4.2 was run again – the numbers are in
`RELEASE_68.md` §8; `audit.js` now with its section `atomic`: 36 / 36; the 12 browser tests: 192 PASS lines, 0 FAIL.)

| Suite | update-67 | update-68 |
|---|---|---|
| `npm test` (unit) | 39 / 39 | **44 / 44** |
| `node test/harden.js` | 26 / 26 | **27 / 27** |
| `node test/backup.js` | 23 / 23 | **28 / 28** |
| `node test/audit.js auth brute diesel money` | 34 / 34 | **34 / 34** |
| `node test/reg.js` | 11 / 11 | **11 / 11** |
| browser: hardenpage 10 · viewbill 23 · splittime 18 · lbpage 13 · billlock 17 · half 12 · nightrow 22 · gstdecl 11 · lbbasis 9 · lxlook 10 · sweep 38 pages | all pass | **all pass** |

Speed (rig, a save with its number, median of 30): live code 64 – 72 ms, update-68 61 – 67 ms. Heartbeat 3 ms, `getInit`
8 – 10 ms (unchanged). Sign-in: +0.3 s (scrypt, intended).

### 4.3 Expectations of update-67 tests that were changed, and why

* `harden.js` "counter hiccup": with step 5 the "who is first" question is no longer a counter, so the injected fault meets
  the double-click counter instead: that save is answered "could not reach the database" (nothing saved) and the same
  number sent again is saved once. The test now sends it again, as the page does. The point of the test (the counters stay
  on after a hiccup) is unchanged and passes.
* `harden.js` "(c) housekeeping write fails": the old flow wrote one more note first; the fault now starts at the first call.
* `harden.js` three password lines: accept `scrypt$…` beside `sha256$…`.
* `harden.js` "12 sign-ins at the same moment": now 12 sign-ins, then their 12 sign-outs at the same moment (12 + 12 lines,
  none overwritten) – see the side effect under D2 – plus a new line for 9 sign-ins of one e-mail in one instant.
* `nightrow.js` (browser) compares with a server of the old code on port 3002; the old code cannot sign the rig's Admin in
  once his password is kept with scrypt, so for this run both sides were the new code (22 / 22).

### 4.4 Not run / not verified

* The live site, the live database, the real Google Sheet, a real phone, Windows / Edge, Safari.
* Vercel itself: scrypt (32 MB per check) inside a Vercel function, and real cold starts – only Node on the rig.
* Supabase's hosted PostgREST / gateway: the rig runs the same PostgREST and SQL, but not Supabase's pooler or limits.
* How Google stores and returns dates in the backup Sheet (restore route B).
* The preflight against production data – only the owner can run it.
* Whether anything else uses the project's public (anon) key (block G of the proposed constraints).

---

## 5. SQL prepared

| File | Kind | Run it? |
|---|---|---|
| `sql/supabase_step5_save_once.sql` | adds `web.ops` + 6 functions; changes no existing table, column, row or function; one transaction; safe to run again; roll-back lines in its heading | **Yes – once, BEFORE the push** (it works with the live update-65 – `RELEASE_68.md` §2; also shown in the app: Admin → Read me → SQL) |
| `sql/proposed/preflight_readonly.sql` | SELECT only: 20 rules + grants | Yes, any time (reads only) – send back the result table |
| `sql/proposed/constraints_after_preflight.sql` | PROPOSAL | **No.** Only after the preflight, block by block, with a go-ahead |

**D8 – the rules, one by one.** "Rows breaking it" on production is **unknown until the preflight is run**; on the rig's
test data every rule shows 0.

| # | Rule the app enforces today | Preflight | Proposed in the database | Risk | Roll-back |
|---|---|---|---|---|---|
| 01 | one tank check per machinery and date (`saveTankCheck_`) | rule 01 | block B: unique index on (letters+digits of machinery, date) | none known | `drop index tank_check_one_per_day` |
| 02 | BOQ No once per vendor (`saveBoq_`) | 02 | block C: unique index (vendor in capitals, BOQ No) | none known | `drop index boq_no_once_per_vendor` |
| 03 | one ACTIVE bill per vendor + name + bill number; a revision keeps the number, the older row becomes Superseded (`verifyBills_`, `submitBills_`) | 03, 04, 05 | block D – **not proposed now** | measured: with the index a revision is written when the old row comes first and REFUSED when the new row comes first – it would hang on an order nothing guarantees | – |
| 06 – 09 | quantity / amount more than 0 (Diesel Issue, Inward, Transfer, Payment) | 06 – 09 | block A: `check (qty > 0)` / `check (amount > 0)`, added "not valid" then validated | an old row with 0 would make later recalculations of that table fail → preflight first | `drop constraint …_pos` |
| 10 | one opening balance per vendor (`savePayment_`) | 10 | block E: unique index where type = Opening | none known | `drop index payments_one_opening_per_vendor` |
| 11 | one opening stock per location (`checkOpening_`) | 11 | block E: unique index where pump = "Opening Stock" | none known | `drop index inward_one_opening_per_location` |
| 12 | machinery number once, letters and digits compared (`saveMaster_`) | 12 | **not proposed** | a save writes new rows before deleting old ones: re-writing a number with other punctuation would be refused | – |
| 13 | vendor name once (case / spaces ignored) | 13 | **not proposed** (same reason; the key is already the name in capitals) | – | – |
| 14 | Log Book: one entry per machinery, date, shift | 14 | **not proposed** (same reason; the key is machinery\|date\|shift) | – | – |
| 15 | one user per e-mail | 15 | already the primary key | – | – |
| 16 | debit note number once per name (company) (`nextDnNo_`) | 16 | block F: unique index (company, DN No) | covers this table only – the diesel notes inside bills use the same run | `drop index debit_notes_no_once` |
| 17 – 20 | transfer from ≠ to; entries have date and machinery; payment type | 17 – 20 | preflight only for now | – | – |

**Grants to the public roles.** The app uses only the secret key (role `service_role`) from the server. `anon` and
`authenticated` are used by nothing; they are held off by row-level security (on, no policy) and the app's functions are
revoked from them. But the table *grants* are whatever Supabase's defaults gave. Preflight part 3 shows them. Block G
proposes to revoke them too (two things must then go wrong before anything is exposed). Risk: anything else reading the
database with the public key would stop – confirm there is nothing.

---

## 6. Owner actions

1. **Deploy in the order of `RELEASE_68.md` §5** (backup → step-5 SQL → check the live app → update-65s → update-68 →
   smoke test), after the Preview test of its §3.
2. After update-68 is live, Admin → Database must show "A save is saved once – decided in the database (step 5)" with ✓.
3. **Google Sheet (D1)** – open the backup Sheet → Share → General access → must say **Restricted**. If it says "Anyone with
   the link", change it. This cannot be seen or changed from code; it is not fixed just because the code is right.
4. **Supabase (D8)**: run `sql/proposed/preflight_readonly.sql` (reads only) and send the result table.
5. **Supabase (D12)**: Database → Backups – which plan, are there backups, how many days? Tell the developer.
6. **Access report (D3)**: Users & Access → Access report → look at the "EMPTY" lines and decide what an empty cell should mean.
7. **GitHub (D9)**: repository → Settings → General → Danger Zone → Change visibility → **Private**.
   Check first: nothing in the code reads GitHub, so the app itself is not affected. The one thing to verify is the
   deployment: Vercel's rule (their knowledge base) is that for a private repository the person who pushes must be a member
   of the Vercel team (Pro) or the owner of the Hobby account. The notes of this project say the PC pushes as the GitHub user
   `milestoneconsultancy` (a collaborator) and that the Vercel project is on Hobby. If that is still so, pushes after going
   private may no longer deploy. So: (a) in Vercel → Settings → Git see which GitHub account is connected and which plan;
   (b) make the repository private; (c) push a small change and see that it deploys; (d) if it does not: push as the
   Vercel account's owner, or move to Pro, or turn visibility back.

---

## 7. Intentionally deferred

* D3: the meaning of an empty access cell (owner's decision pending).
* D8: every constraint (preflight first); block D and rules 12 – 14 need `web_write` to delete before it writes, or the
  revision to be written in two steps.
* D10: enforcing the strict script rule (checklist above).
* D11: optimistic concurrency (design above; its own update).
* D12: copying `web.props` into the Sheet; a restore tool; the real restore drill.
* Dead-code clean-up and splitting `Code.gs` / `App.html` (excluded by the owner for this update).
* Activity Log line inside the save's transaction (today: after it, made up for when lost).

---

## 8. Remaining risks

**Critical** – none known in the code after this update, *once step 5 is run*. Until it is run, the duplicate after a lost
answer (D7) is exactly as today.

**High**
* The backup Sheet's sharing is unknown (D1) – owner check.
* No proved restore (D12). If the Supabase project is on the Free plan, the Sheet is the only backup and it lacks the
  counters, the settings and the passwords.
* Last writer wins (D11) – measured; most dangerous in the Edit Log Book grid.
* The repository is public (D9) until the owner changes it (no secret is in it; the code and the database address are).

**Medium**
* No database constraints yet (D8): the rules hold through the app's code and its lock only.
* Table grants of the public roles are Supabase's defaults (held off by row-level security only).
* The strict script rule is not enforced (D10); stored HTML in bills is refused by the server since update-67.
* Going back from update-68 is safe only to update-65s (or by `git revert`), never to the plain update-65 (`RELEASE_68.md` §6).
* scrypt on Vercel (memory / time under load) is proved on the rig only – watch the first sign-ins after the deployment.
* The Activity Log line of a save whose answer was lost has no details for an edit / delete.

---

## 9. What the deployment needs

| | Needed? |
|---|---|
| Git push | **Yes** – everything |
| Vercel environment / config change | **No** |
| Supabase SQL | **Yes, one file**: `supabase_step5_save_once.sql` (D7). Without it everything else of update-68 works and D7 stays as today. The preflight is optional and reads only. |
| Google setting | **Check**: backup Sheet → Share → General access → Restricted |
| GitHub setting | **Owner**: visibility → Private, after the Vercel check of section 6.7 |
