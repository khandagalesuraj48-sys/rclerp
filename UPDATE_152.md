# update-152 – an approved or billed Log Book entry is locked: only the Super Admin changes it, with his reason (24-10-2026)

**Asked (24-10-2026, "RCL ERP — FINAL DEVELOPMENT UPDATE", Phase B):** "Once a Logbook Entry has been approved, or it is included
in a submitted Machinery Bill: ONLY SUPER ADMIN CAN edit, delete, replace attachments … with a reason … enforced in the server AND
the database … bills deleted logically … only the Super Admin revises / rebuilds / deletes a submitted bill." And: "unapproved and
unbilled entries stay editable as before."

Phase B only. It builds on update-151 (the bill's fixed evidence – PR #63, step 1zc) and must be merged after it. Attachments and
Scan with Mobile (Phase C), photo correction (D) and attachments in bills (E) are update-153.

## What was there
* A submitted bill (Active) locked its entries for everybody but the Super Admin (update-108: a user's change could be sent to
  him as a request). A bill that was **deleted** (by the Admin – the row was removed) or **superseded** unlocked its entries.
* An entry saved through a verification rule (update-114) was approved in Approvals, and then it was an ordinary entry again:
  anybody with Edit could change or delete it.
* The Super Admin's change of a billed entry needed no reason; nothing in the database recorded who changed a locked entry.

## What changes
* **Approved = locked.** At the last approval of a verification the entries the save writes are marked: `approved_by`,
  `approved_at`, `approval_ref` (the request). From then on only the Super Admin changes or deletes them – the same as an entry of
  a submitted bill. Everybody else's change is refused and offered to the Super Admin ("An approved entry – send it to the Super
  Admin?", with the reason) – approved by him on Approvals, it is saved.
* **A bill never unlocks by itself.** The lock of a bill holds for Active, **Superseded and Deleted** bills alike (the text says
  "a bill replaced or deleted keeps them locked").
* **One guard for every save** (`entryGuard_`, run just before the database write of ANY save – Log Book page, edit window, Edit
  Log Book, imports, the assistant, a request approved): it compares each Log Book row with what it was and refuses a change of a
  locked entry (approved or billed) unless the Super Admin saves it. **The Super Admin is asked for his reason** ("Locked entry –
  give the reason" – `SA_REASON`); the save goes again with it (a new save number) and the reason is kept with the entry's history.
  A save run at the last approval of a verification counts as the sender's, not the approver's.
* **The database guards it too (step 1zd):** a trigger on `log_book` writes every change of a locked entry – before and after, who,
  whether he was the Super Admin, his reason – into `log_book_history`, which nobody (the app's key included) can change or delete.
  It starts in **"warn"**: a change that is not the Super Admin's (e.g. made outside the app) is written down, and Admin → Database
  health names how many there were in 30 days. The Admin switches it to **"enforce"** later (one line at the end of the SQL file):
  such a change is then refused by the database itself (`RCL_ENTRY_LOCKED`).
* **Bills are deleted logically.** Only the Super Admin deletes a submitted bill (signed in through the Portal); it is **kept**,
  marked **Deleted** with who, when and his reason; its entries stay locked; its debit notes are open again. The app's key loses
  the right to remove a bill row. Saved Bills shows "Deleted" (and "DELETED" across its papers). Only the Super Admin revises or
  builds again a submitted bill's dates.
* **The page** marks an approved entry "✔ Approved" (Log Book list, Edit Log Book read-only – but for the Super Admin); the edit
  window of an approved entry says so first; the lock texts are the server's; the help (FIX_RULES, English / मराठी / हिंदी) has
  rules for the new messages; PAGE_GUIDE updated; the Marathi / Hindi words of the new texts (`app/i18n`).
* **Phone app:** App 3.33.0 (`rcl-mobile`, branch `app-entry-locks-3330`) – the same in the app's own screens.

## The database step – needs his approval, he runs it
`sql/supabase_step1zd_entry_locks.sql` – **in every site's Supabase**, after step 1zc. It only **adds**: three columns of
`log_book` (the approval mark), three of `bills` (the Deleted mark), the table `bill_machines` (filled once from the bills there
are, then kept by a trigger), the table `log_book_history`, the guard's triggers on `log_book`, the setting `ENTRY_GUARD` = warn,
and the save function `web_write3`; it takes from the app's key the right to DELETE / TRUNCATE `bills`. Its helper functions are
callable only with the secret key. Safe to run again. Until it is run the app works as before, except that deleting a bill is
refused (it needs this step).
Why: the lock must hold even for a change that does not come through the app (the database is the last word), and a deleted bill
must stay as financial evidence.

## Files
* `app/Code.gs` – `billLocks_` / `billLockMsg_` (every status), `entryGuard_`, `apprColsOn_`, `apprRow_` / `apprLock_`,
  `saveCtx_`, `deleteBill_` (Super Admin only, logical), the revise rule, `logRowOut_` (`ap`), `dbHealth_` (step 1zd and the guard's
  note), the approval marks in `flowDecide_` / `crDecide_`, `LB_GUARD_`.
* `app/SupabaseData.gs` – the rows as they were before a save (`orig`, `goneRows`) and the guard before the write; `web_write3`
  with the context (back to `web_write2` / `web_write` until step 1zd is there).
* `app/SupabaseSync.gs` – the new columns. `app/App.html` – the reason box, "✔ Approved", the locks, Saved Bills Deleted,
  FIX_RULES, PAGE_GUIDE. `app/ReadMe.gs` (step 1zd, word for word). `staging/rcl_staging_all.sql` (made again). `app/i18n/*`.
* Tests: `test/unit.test.js`, `test/harness.js` (the guard as before a real write), `test/browser/lock152.js` (new), and – the rules
  changed – `billlock.js`, `billed108.js` (the bill deleted by the Super Admin), `ev151.js` (the Super Admin's reason).

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – **107 / 107**.
* `test/browser/lock152.js` (new; real page, real database with steps 1zc + 1zd, the Super Admin through the Portal) – **17 / 17**:
  the checker's approval marks the entries; the maker's Edit of an approved entry is refused and offered to the Super Admin, sent
  with his reason, nothing changed; the Super Admin's page asks "Locked entry – give the reason" and saves it – the database's
  history has before / after, super, the reason; his approval of the request saves it with the request's reason; the database guard
  writes down a change made outside the app (warn) and, switched to enforce, refuses it; a bill submitted, deleted only by the
  Super Admin – kept as Deleted with the reason, its entries still locked; the Admin cannot delete it; no script error.
* The rest, the same snapshot on main and on this branch (steps 1zc + 1zd for the branch):
  * clean snapshot: `billlock` 16 / 16, `viewbill` 23 / 23, `bills120` 17 / 17, `gstdecl` 11 / 11, `lbpage` 13 / 13, `rows146`
    29 / 29, `same145` 10 / 10, `entry71` 20 / 20, `again128` 11 / 11, `time144` 17 / 17, `tanker105` 7 / 7, `gap77` 20 / 20 –
    and `fix130` 7 / 3, `splittime` 12 / 6, `group72` 8 / 5, `lg2` 4 / 4, `meter`, `dnui`, `dn`, `ldebit149api`, `saveonce`
    (they need data or servers this snapshot does not have) – **exactly the same numbers on main and on this branch**.
  * Super Admin snapshot (Portal): `flow114` 12 / 12, `flow116` 18 / 18, `sdel134` 6 / 6, `remind118` 13 / 13, `ldebit149` 14 / 14,
    `flow114api` 30 / 30 – as on main; `billed108` 25 / 25 (main 24 / 24 – its step 6 now has the Super Admin delete the bill and
    checks that the Admin cannot); `ev151` 12 / 12 (its step 3 now gives the Super Admin's reason).
  * Found and fixed by this run: the helper functions of step 1zd were callable without the secret key (Database health → Security
    said so and the pages showed "Database check: 1 thing to do"); the step now revokes them from the public roles.
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.
* App 3.33.0: the build (analyze, every test, the screens drawn, Android, iPhone, Windows) passed.

## Not verified
* The live sites; Supabase itself (the rig is Postgres + PostgREST); a real phone. The guard in "enforce" mode was tried only in the
  rig – the live sites start in "warn" and the Admin should switch only after some days without "not the Super Admin's" lines in
  Database health.

## Going back
* Vercel → Instant Rollback to the deployment before this update (the older code does not use the new columns and tables).
* In Supabase (only if wanted): the rollback lines at the top of the SQL file drop the triggers and give the delete right back; the
  new columns and tables are kept (they hold history).
