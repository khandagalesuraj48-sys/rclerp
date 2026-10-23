# update-151 – a submitted bill keeps its Log Book as fixed evidence (24-10-2026)

**Asked (24-10-2026):** "बिल final झाल्यावर नंतर कुणी logbook फोटो बदलला तरी जुने बिल बदलता कामा नये, कारण ते आर्थिक पुरावा असतो.
म्हणून versioning आणि सुरक्षित reference वर भर द्यायचा" and, in "RCL ERP — FINAL DEVELOPMENT UPDATE", Phase A: "When a Bill is
submitted: snapshot the exact billed Logbook rows … save the Bill and evidence atomically … render all future saved-Bill views and
exports from that immutable snapshot … Do not invent historical snapshots for legacy Bills."

This is Phase A only. The approval / bill locks for everyone but the Super Admin (Phase B), attachments and Scan with Mobile
(Phase C), photo correction (Phase D) and attachments in bills (Phase E) come as their own updates.

## What was there
* A submitted bill saved its own figures (Abstract, Tax Invoice, Debit Note – `bills.data`). Its **Log Book pages were made again
  from today's Log Book** every time the bill was opened (RCL Drive → View / Print, its Log Book, Bill Summary, Vendor Ledger).
* A submitted bill (Active) locks its entries for everyone but the Super Admin (update-108). The Super Admin's correction, or an
  approved request, changed the Log Book – and so the Log Book pages of the old bill changed with it.

## What changes
* **Verify & Submit** builds each bill's **evidence** from the database: every Log Book entry of its machinery and dates exactly
  as the bill and its Log Book sheet use them, the Asset Master of its machinery, the other input of its Log Book sheet (the BOQ in
  force, the diesel issues of the days, the diesel rates) and the bill's own Idle choice and diesel rate. Each entry gets a
  **SHA-256** fingerprint of its canonical text (keys in order), the whole bill one SHA-256 of it all.
* **Verify** keeps that fingerprint with its "verified" mark (15 minutes, as before). The checks list says
  "Log Book evidence: n entries of m machinery – kept with the bill exactly as it is now when it is submitted."
* **Submit** builds the evidence again inside its own lock. **Another fingerprint = something changed after Verify** (an entry, a
  machinery, its diesel / BOQ) → "Not submitted – … the Log Book of this bill changed after it was verified … verify the bill
  again (Verify & Submit)"; nothing is saved. The same → the evidence is written **in the same all-or-nothing database write as the
  bill** (one transaction: both or neither).
* **The database refuses** every UPDATE, DELETE and TRUNCATE of the evidence (a trigger, `RCL_EVIDENCE_FIXED`), and the app's own
  key has no right to delete it – whoever asks, the Super Admin too.
* **Every view of a saved bill** shows its Log Book **from its evidence**, never from today's Log Book: RCL Drive → View / Print and
  Log Book, Bill Summary, the Vendor Ledger, and the print that opens after Submit. Above the Log Book:
  "Log Book as submitted with RA Bill 151 on 24-10-2026 09:12 by Sujit Mule – kept with the bill, never changed afterwards.
  Evidence check ✔ (6 entries, SHA-256 1a2b…)." Every fingerprint is worked out again each time it is opened; a mismatch says
  "EVIDENCE CHECK FAILED – … Tell the Super Admin." The Log Book print of such a bill asks no diesel rate (the bill's own).
* **A bill submitted before this update** has no evidence and none is made up for it. Its Log Book is today's, and the paper says
  so: "This bill was submitted before the Log Book was kept with bills. The Log Book below is TODAY'S Log Book (date time), not a
  record of the time of submission. Since the bill was saved: 1 entry changed, 0 added, 0 deleted (by the database's own times)."
* A bill ID is **never given twice**: a bill removed before this update leaves its evidence under its ID for ever, so a new bill
  takes the next number after the highest ID that has evidence.
* **Admin → Database health** lists the new step.
* **Phone app:** App 3.32.0 (`rcl-mobile`) – the same in RCL Drive, Bill Summary, the Vendor Ledger and the print after Submit (its
  note text is tested against this page's own).
* **Help (English / मराठी / हिंदी):** the Machinery Billing and Saved Bills guides say it; two new help rules (FIX_RULES) for the
  new messages; the Marathi / Hindi words of the new texts (`app/i18n`; the app's too).

## The database step – needs his approval, he runs it
`sql/supabase_step1zc_bill_evidence.sql` – **in every site's Supabase** (VTR NH 848, 18B KOLHAPUR, …). It only **adds two new,
empty tables** (`bill_snapshots`, `bill_log_rows`), their trigger and rights. No existing table, row or rule is changed. Safe to run
again. Until it is run the app works exactly as before (bills are saved without their evidence; views say "TODAY'S Log Book").
Why it is needed: the evidence must live where nobody – not even the app – can change it afterwards; a column in `bills` could be
overwritten by the next save of the bill row.

## Files
* `app/Code.gs` – `evReady_`, `canon_`, `sha_`, `evRow_`, `evHash_`, `evHead_`, `billEvidence_`, `evAppend_`, `evSave_`, `evRead_`,
  `evCheck_`, `evLegacyChanges_`, `getBillEvidence_` (new action `getBillEvidence`, access as Saved Bills / Machinery Billing /
  Bill Summary / Vendor Ledger); `verifyBills_` (the mark), `submitBills_` (built again, compared, saved with the bill); dbHealth_.
* `app/SupabaseSync.gs`, `app/SupabaseData.gs` – the two tables; `server/gas.js` – they are never loaded into the server's memory.
* `app/App.html` – `billLogOf`, `viewSavedBillIn`, RCL Drive Log Book, the print after Submit, `logSheetsBuild` (the machinery as it
  was), `printLogRows` (no rate question for evidence), `.ev-note`; PAGE_GUIDE, FIX_RULES; `app/ReadMe.gs` (step 1zc, word for word).
* `sql/supabase_step1zc_bill_evidence.sql` (new); `staging/rcl_staging_all.sql` (made again); `app/i18n/*`.
* Tests: `test/unit.test.js` (new test update-151), `test/browser/ev151.js` (new).

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – **106 / 106**. New test update-151: the canonical text is the same whatever the key order;
  Verify keeps 'S:' + the hash; Submit writes 1 snapshot + 3 rows; getBillEvidence checks ✔ and the bill's figures are the same;
  a Super Admin correction later leaves the evidence as billed; a changed stored row is found (its key named); a change between
  Verify and Submit is refused with nothing saved; Verify again → submitted; without step 1zc – kind 'off', as before.
* `test/browser/ev151.js` (new, real page + real database + Portal sign-in) – **11 / 11**:
  1. Verify & Submit writes the bill and its evidence together (6 entries, 64-letter SHA-256); the print after Submit has
     "Log Book as submitted with RA Bill 151 … Evidence check ✔ (6 entries …)".
  2. As the app's own database role: UPDATE refused by the trigger, DELETE and TRUNCATE refused (no right); nothing changed.
  3. The Super Admin corrects the billed entry of 06-09 (Close 1240 → 1247): the live Log Book changes; RCL Drive → View / Print
     and its Log Book print still show 1240 and the old work text, "Evidence check ✔"; getBillEvidence ✔, figures the same.
  4. A bill without evidence: "submitted before the Log Book was kept with bills … TODAY'S Log Book … 1 entry changed, 0 added,
     0 deleted".
  5. An entry changed between Verify and Submit (the same reading, another work text – only the evidence sees it):
     "Not submitted … changed after it was verified", no bill, no evidence.
  6. No script error.
* Billing pages from the same snapshot, main and this branch (step 1zc applied for the branch):
  REGRESSION_TABLE
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse (unit test); no secret in the change.
* App 3.32.0: APP_CI

## Not verified
* The live sites; Supabase itself (the rig is Postgres + PostgREST of the same version family); a real phone; the time a site with
  many thousands of entries in one bill needs (the evidence of a bill is one read of its own entries – the same read Verify does).

## Going back
* Vercel → Instant Rollback to the deployment before this update. Bills submitted meanwhile stay saved and correct (their
  evidence rows simply are not read by the older code).
* The two tables are kept (evidence is never thrown away). Only while they are still empty can they be dropped (the rollback
  line is in the SQL file).
