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
* `test/browser/same145.js` **10 / 10** – two browsers: the edit window (refused with the reason and the help in his language, B's
  change stays; opened again and saved), Edit Log Book (A's grid refused after B's change; loaded again and saved), the Diesel
  Issue form (A's 50 L refused, B's 45 L stays); no page error.
* The phone app's build (analyze, tests – new: the Edit Log Book payload carries every entry's version; a Diesel Issue change sends
  its version – the screens).

## Not verified
* Not on Vercel, not against the live database. Two servers of Vercel at the same time were not tried (the check reads the entry
  as the server holds it at the save, as every other check of a save does).
* The phone app on a real phone.
* Other pages (Diesel Inward, Transfer, masters, bills …) are not covered yet – he chose Log Book + Diesel Issue first.

## Going back
Vercel → Instant Rollback to the update before. No SQL. The phone app's version field is then simply not read.
