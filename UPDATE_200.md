# update-200 – after a tank check the Log Book's Opening is the diesel found (02-11-2026)

**Asked (a picture of the Log Book form of 01-11-2026, MH-09-BC-2570: Opening 105.8, with the bill of October debiting 35.3 L
after 90 L found on 31-10):** "01-11-26 ch opening bagh as ka ale".

**Why:** a new Log Book entry's form showed as its Opening the Log Book's closing of the entry before (31-10: 105.8 L) and did not
look at the tank check after it (31-10: 90 L found). Once saved, the server worked the tank out again from the check (recalcStock_,
"from the end of this day the system tank starts again from the real figure") – only the form (and Edit Log Book's grid) was
wrong before saving. Checked on the rig: the form said −10, the saved entry 40 (the check).

**No database step.** No calculation of a saved entry, bill, ledger or stock changes – the saved figures were already right.

## What changes
* **Server (`app/Code.gs`)** – `tankResetFor_` (the check after the entry before, dated before this one – the same as
  `recalcStockOnly_`): `getLogRowPrefill_` gives it as the Opening (`openingDiesel`, `openingCheck`; then it is not a "first entry"
  to type); `saveLogRows_` starts the row from it (the chain worked out after the save gave the same); `getLogEditData_` gives the
  checks from the entry before (`checks`).
* **Page (`app/App.html`)** – the Log Book form: the Opening is the diesel found, with "tank check 31-10" under it; Edit Log Book's
  grid starts the tank again after a check (as the server). An Opening typed on the 1st still wins (as before).
* **Phone app** – Edit Log Book's grid the same (the entry form takes the server's figure).

## Evidence
* Unit **153 / 153** (new `update-200`: Opening 120 without a check; the check of 31-10 (90 L) → the form of 01-11 opens at 90 and
  says which check; not on the same day; saved 90 → 70; Edit Log Book's checks with and without an entry before; the page's two
  places). The page's script blocks parse; `node --check`.
* The rig in Chromium: Log Book → One date – many machinery → 01-11-2026 → TCR-2: Opening **40** "tank check 31-10" (the Log Book's
  closing of 31-10 was −10); no page fault.

## Not verified
* Live: MH-09-BC-2570's 01-11 form is expected to open at 90 L (the check of 31-10). The 105.8 L closing of 31-10 is the Log Book's own
  tank carried from September (the bill starts October at 0) – not checked against the live data.

## Going back
Vercel → Instant Rollback to the previous deployment.
