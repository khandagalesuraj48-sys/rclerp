# update-145 – Two people changing the same entry (Log Book and Diesel Issue) (23-10-2026)

**Asked (23-10-2026):** the decision in the work report ("two people editing the same entry: the last save wins"), given with
"ata je approval deych aahe te pr tri de"; where first: **"Log Book + Diesel Issue"** (his answer). The wording he was shown:
"this entry was changed by <name> after you opened it – open it again and make your change".

## What was wrong
Two people open the same entry; the first saves; the second saves what he opened – and the first one's change is silently gone.

## What changes
* **An entry opened for a change carries its version** (`ver` – a short fingerprint of what a person can change in it: date, shift,
  way, readings, times, trips, challan, chainage, work, remark, items, ½ day, Debit to, meter note, opening diesel of the 1st;
  for a Diesel Issue: date, shift, machinery, litres, readings, remark, driver, source, dispenser reading). The save sends it back.
* **Changed by someone else in between → nothing is saved:** "MH-… (02-10-2026, Full Day) was changed by <who> after you opened it
  – open it again and make your change there. Nothing was saved." (`verCheck_`; who = Updated By, else Entered By). The help says
  what happened and what to do (English / मराठी / हिंदी).
* **Where:** the Log Book edit window (`getLogEntry_` → `updateLogRow_`), its Delete (`deleteLogRow_(key, ver)`), Edit Log Book
  (`getLogEditData_` rows → `saveLogBulk_` `vers`: every entry of the grid as it was opened – one changed since: the grid is not
  saved), the Diesel Issue form (`getDieselIssues_` rows → `updateDieselIssue_` `d.ver`, `deleteDieselIssue_(id, ver)`); the phone
  app the same (App 3.31.2: its Log Book change and delete, Edit Log Book, Diesel Issue change and delete).
* **No false stop:** what the app works out by itself – the diesel and the tank of an entry, the averages, the driver taken from the
  Diesel Issue – is not part of the version, so a Diesel Issue saved meanwhile does not stop a Log Book change. A Start that moved
  because the entry before it was changed (a KM vehicle) is part of it: saving over it would have put the old Start back.
* **A save without a version** (an older page or phone app) is taken as before.
* The Diesel Issue page's list is refreshed every few seconds; the version kept is the one of the moment the entry was opened.
* No database step, no setting.

## Evidence (local test copy only)
* `node --test test/unit.test.js` **102 / 102** – new check "update-145": the edit window (A and B open, B saves, A refused, B's
  change stays; no version = as before); a Diesel Issue of that day does not change the Log Book entry's version; the next entry's
  Start moved by the Close before it → an old version refused, the Start not put back; a delete with an old version refused; Edit
  Log Book with an old version of one entry: nothing saved, then with fresh versions saved; Diesel Issue change and delete; the
  version reads JSON in any key order and numbers in any form the same. The update-130 check follows the changed line of the page.
  After the review: an update returns its version now; the Start moved by Shyam's change → the refusal names Shyam; a request
  replayed later gets the words of a request (approved / sent / sent again); Edit Log Book of a user (not the Super Admin) is not
  stopped by a change to an entry of a submitted bill, which stays as it is.
* `test/browser/same145.js` **10 / 10** – two browsers: the edit window (refused with the reason and the help in his language, B's
  change stays; opened again and saved), Edit Log Book (A's grid refused after B's change; loaded again and saved), the Diesel
  Issue form (A's 50 L refused, B's 45 L stays); no page error.
* The phone app's build (analyze, tests – new: the Edit Log Book payload carries every entry's version; a Diesel Issue change sends
  its version – the screens).

## After an independent review (no serious defect; fixed, each with a check)
1. **The name in the refusal could be wrong:** an entry whose Start moved because someone changed the entry before it kept the old
   "Updated By" – Ravi was told "changed by Ravi". Now the entry whose Start follows a change is stamped with the person who made that
   change (the edit window, Edit Log Book, a new entry put in between, a delete, the chain) – the refusal names Shyam.
2. **A request replayed later** (a change of a billed period approved by the Super Admin, the last approval of a verification, "Send
   again") carries the version of the moment it was asked. When the entry changed since, it is still refused (approving it would wipe
   that change), but the words now say what to do there: "… after this request was made – reject it: the person who asked makes the
   change again …" / "… after this entry was sent – it goes back to the person who sent it …" / "… it cannot be sent again: take it
   back …". A help rule (English / मराठी / हिंदी).
3. **Edit Log Book of a user who is not the Super Admin:** an entry of a submitted bill is never written from the grid – its version
   is no longer checked (a change to it by the Super Admin does not stop the grid).
4. **Diesel Issue page:** a delete uses the version of the row the confirm showed; after an update the page keeps the version it has
   now (the server returns it), so a delete right after an update is not refused.
Left as it is (said plainly): Google Sheet mode only – a save that first adds a column gives one false refusal (Supabase's columns
are fixed, so not live); the opening diesel of a machinery's very first entry and a water tanker's delete from Edit Log Book are not in
the check; the version is worked out for every row a list reads (about 15–35 µs a row on the test copy).

## Not verified
* Not on Vercel, not against the live database. Two servers of Vercel at the same time were not tried (the check reads the entry
  as the server holds it at the save, as every other check of a save does).
* The phone app on a real phone.
* Other pages (Diesel Inward, Transfer, masters, bills …) are not covered yet – he chose Log Book + Diesel Issue first.

## Going back
Vercel → Instant Rollback to the update before. No SQL. The phone app's version field is then simply not read.
