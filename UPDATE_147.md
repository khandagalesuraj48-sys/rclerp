# update-147 – Approvals: an entry in full for the people who approve it ("Details") (23-10-2026)

**Asked (23-10-2026):** "jewa diesel issu verify sathi pathwale jate n approval detna details madhe sagle bghta yaw ki entry mdhe ky
ahe fkt diesel nhi sagle approval mdhe asa asaw mhnje jo aproval krnar aahe tyala detail mdhe samjel entry wise mg bulk approval
asel tri ani to proper verify krun approval deu shakel". This is step 1 of the three he asked that day (step 2: an approved entry is
changed or deleted only by the Super Admin or its approvers; step 3: the Super Admin edits, deletes and renames users in the Portal) –
each comes as its own update, one at a time.

## What was there
* Approvals showed each entry as one or two summary lines (machinery · date · a few readings). The entry itself – every field, every
  row of a Multiple-entries save, a vendor's bank details – was not shown to the person who approves it ("Open & correct" is only for
  the sender). In "Approve ticked" the question listed only the numbers (VF-00012, VF-00013 …).

## What changes
* **"Details" under every entry in Approvals** opens it in full under its line; **"Hide details"** closes it; **"Details of all"** (in
  the bar) opens every entry of the list. Every work under verification (Diesel Issue, Inward, Transfer, Log Book, Master, Vendor
  Master, BOQ, Payments, Billing, Breakdown, Compliance) and the changes of a billed period:
  * who sent it, when, the work and **what it does in plain words** ("New diesel issue – multiple entries", "Change of a saved Log
    Book entry", "Vendor" …);
  * **every field with its name** (Machinery, Litres, KM reading, Driver, Remark, Date, Shift, Diesel source; a vendor's PAN, Bank,
    Account No, IFSC …); the machinery with its **name and type** from the Asset Master;
  * **its rows as a table** – one row per entry, every column (a Multiple-entries diesel issue, Log Book rows …), up to 300 rows;
  * photos / bill copies with it, counted; for a change or a delete of a saved entry, **what is saved now**; the reason of a
    change of a billed period.
* **Several at once:** "Approve ticked", "Send back ticked" and "Reject ticked" show **each ticked entry in full** in the question
  before the decision.
* **Who sees it:** the same people who see the entry in the list – the Super Admin, the person who sent it and the people of its
  levels. Anyone else, or a wrong number: "This request was not found – refresh the list." **It only reads:** nothing is decided,
  nothing is written, the list and its summary are as before.
* An open entry that moves on meanwhile (approved at a level, corrected and sent again) is fetched again by itself.
* **Server:** `approvalDetails` (`API_`, `approvalDetails_` in `app/Code.gs`, after `flowOpen_`; `DET_LABEL_`, `DET_ACT_`,
  `detVal_`). **Page:** `crDetBtn`, `crDetRow`, `crDetHtml`, `crDetLoad`, `crDetFill`, `crDetOpen`, `#cr_det_all`; `crBulk` loads the
  ticked entries first. **Phone app:** App 3.31.5 (`rcl-mobile`, `lib/screens/approval_details.dart`, `approvals.dart`) – the same
  Details, Details of all and the bulk question, as its own screens.
* **Help (English / मराठी / हिंदी):** the Approvals guide says it; a help rule for "Choose an entry to see its details."; the Marathi /
  Hindi words of the new texts (`app/i18n`, and the app's `assets/i18n/web_*.json`).
* No database step, no setting, no access change.

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – 105 / 105.
* `test/details147api.js` (new, API) – 21 / 21: the checker's Details of a vendor (every field) and of a diesel issue (Machinery
  with name and type, Litres, KM reading, Driver, Remark, Date, Shift, source), Multiple entries as a table (each row and column),
  three at once in the order asked, the sender and the Super Admin see them, a person of no level and a wrong number get "not found",
  nothing written or decided, then the bulk approval saves as before.
* `test/browser/details147.js` (new, browser) – 9 / 9: Details opens and closes under its line, Details of all, the bulk question
  shows each ticked entry in full, the approval saves both, a phone-size screen does not get wider.
* The earlier verification tests on main and on this branch, each from the same snapshot: see the table in the pull request.

## Not verified
* The live site; a real phone (the app's build on GitHub runs analyze, its tests and draws the screens).

## Going back
* Vercel → Instant Rollback to the deployment before this update (no database step; nothing to undo in the data).
