# update-197 – an edit in Asset Master saves a change of only the Tank Capacity (02-11-2026)

**Asked (his screenshot, MH-09-BC-2570):** "mi eth tank capacity takli ani save krtoy tr nothink change as yetey he fix kr".

**Why:** before saving an edit, the page compares the form with the machinery as saved and says "Nothing changed." when nothing
differs. That list of boxes left out **Tank Capacity**, **Engine Number**, **Chassis Number**, **Engine Make** and the **papers**
(Tax, PUC, Permit, Fitness, Insurance) – so a change of only those was never sent. The server always saved them; only the page's
check stopped it. (Not from the update merged the same morning – the list has been like this since before 23-10-2026.)

**No database step. No server change.** No entry, calculation, bill, ledger, stock or permission changes.

## What changes
* `app/App.html` (Asset Master → Update machinery): every box of the form is compared; "Update …? These details will change" lists
  them too. A paper is compared as the form shows it (N/A, Lifetime, a date or nothing).
* rcl-mobile **3.72.1** (`lib/core/assets.dart` `kMasterDiff`): the same in the app's machinery form.

## Evidence
* Unit: rclerp new `update-197` – every key the form sends is compared; his case (only Tank Capacity typed) → one change "Tank
  Capacity (Ltr) – → 220"; the same again → nothing. It **fails on the code before the fix** ("not compared: tankCap") and passes
  after. All unit tests: see the PR.
* Rig, Chromium (Mechanical :3000, sign-in as an Admin): Asset Master → Edit → nothing typed → "Nothing changed."; Tank Capacity 220
  typed → "Update RL-STORE-1? Tank Capacity (Ltr) – → 220" → Update → "Machinery updated." → in the database 220 (put back after).
* App: `test/masters_test.dart` (Tank Capacity, engine / chassis / make, a paper; not sent → kept) – the GitHub build.

## Not verified
* The live site after the deploy (this computer cannot open it); a real phone.

## Going back
Vercel → Instant Rollback to the previous deployment.
