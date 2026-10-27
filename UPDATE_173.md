# update-173 – the old maintenance log book imported as it is (Excel) (27/28-10-2026)

**Asked (27-10-2026, 23:30, with his log book PDFs and Store Excel files):** "ata mazya kade pdf aahet excel aahe log book che ok ata
jewde active aahet own rachana vehicle te mala import karaych aahe as it is jas asel tr tya nantr new data mi bharat jail ok …".
**His answer (asked which first):** "Log book import आधी" (then the Store module).

**No database step.** Imported bills are ordinary maintenance bills (the table of step 1zi, as update-170). **Nothing saved is changed**
– an import only adds bills. **No secret in any file.**

## What changes
* **The page Maintenance → "Import the old log book (Excel)"** (a panel under the bills – **the Admin only**, and only where step 1zi is
  run). He picks his file ("All Machinery Maintenance Logbook" – a sheet a machinery, as his PDFs):
  * **each sheet is read as his log book:** the heading row Sr No · Date · Party Name · Current Reading · Particulars · Qty · Uom · Basic
    Rate · Amount · GST Amount · Amount With GST · Total (found by its words, in any row, in any column order); the machinery's name above
    it (ROLLER NO-03);
  * **a bill = the rows one under another of one date and party** (a date left empty – a merged cell – is the row's above; a reading
    only on the bill's first row is the bill's); the total line is skipped;
  * **each line as it is:** Particulars, Qty, Uom, Basic Rate, Amount and its **GST %** from its GST Amount (18 % when 18 % of the amount
    makes it to ₹1 – an old file shows whole rupees; else the % itself); a ₹0 line stays ₹0 (kept as FOC);
  * **its machinery** found among the **Own machinery on the site today** (Asset Master) by the name above the heading or the sheet's
    name (ROLLER NO-03 = ROLLER-03 = Roller No.03; MH12XW0169 = MH-12-XW-0169) – he can change it, or set "– not imported –"; a rented
    / hired one, or one not on the site now, is never offered;
  * a table a sheet: Sheet · Name in the file · Machinery (Active, Own) · Rows · Bills · File total (₹) (its "Amount With GST") · Total
    (₹) (the lines with their GST as they will be kept) · Check;
  * **Check** (`checkMaintImport` – nothing saved): each machinery's bills checked by the server as a bill typed in – each mistake with its
    row ("Line 12: …"); else "✓ N new bill(s), lines, ₹ (from – to)" and "N bill(s) already there – left out";
  * **Import** (`importMaint`, asked first): **one machinery all of it or nothing**; bill numbers MT-… as usual; "Entered by" him.
* **The server** (`app/Code.gs` `importMaint_`; `API_`: `checkMaintImport` – Maintenance, Admin; `importMaint` – Maintenance Edit, Admin,
  logged as `maintImport`):
  * only an **Own** machinery **on the site now** ("X is not an Own machinery on this site now (Asset Master) – the old log book is
    imported only for those."); at most 3000 bills in one import; a file with no bill says so;
  * each bill: its date a real one up to today, **closed months stay closed** (entryOpen_ – the Admin reopens a closed month first if the
    old log book is of a closed period); its lines checked as a typed bill (maintLines_); its reading as a reading; not a service;
    **the machinery's Active check is not made** (a bill of 2022 is before its "active from");
  * **a bill already there is left out** – the same machinery, date and party, and the same lines or its total to ₹1; the same bill twice
    in the file is kept once. So the same file can be given again: only what is not there is added.
  * one lock, one write for all the bills (as every save).
* **Help and words:** a `FIX_RULES` rule for the 3 new messages (English, मराठी, हिंदी); `PAGE_GUIDE` mnt: `importMaint`,
  `checkMaintImport` and a sentence on the import; `app/i18n`: 42 new texts, 37 in Marathi and Hindi.
* **The phone app 3.53.0** (rcl-mobile, its own pull request): the Admin's Maintenance has the same import as the app's own screen (a card
  a sheet, Check, Import – the same server actions); the file read by the same rules (proven against this page's code).

## Evidence
* `timeout 300 node --test test/unit.test.js` → **126 / 126 pass**. The new `update-173` test: an Own roller and a rented JCB; Check of 3
  bills (6 lines, ₹15,999.62, from – to) saves nothing; Import adds 3 (a ₹0 "DRUM OIL" line kept FOC); the same 3 again → 0 new, 3 already
  there; a near total (within ₹1) is the same bill; the same bill twice in the file once; a wrong date and a bill without lines → 2
  mistakes, nothing saved; the rented one and an empty file refused; the log book of the roller after the import (3 bills, ₹15,999.62);
  the page's markup (the panel for the Admin, the reader's columns). Changed on purpose: update-165's list of Maintenance `saves`.
* `node --check` on `server/*.js` and `api/*.js`; the page's 6 script blocks parse; acorn: no call lost; no secret in the change.
* **The local rig** (Postgres + PostgREST + Portal + Mechanical; test data only, taken out after each run):
  * `mnt173.js` **10 / 10** (S1, step 1zi): an Excel in his layout (the roller "Roller No.03" = RL-173, a rented JCB) uploaded – the table
    (rows, bills, file total, total; the JCB "– not imported –"), Check, Import (MT-000001 … MT-000003, dates 2022 – 2024), the same file
    again → 0 new, 3 already there; the roller's Maintenance Log Book from 01-12-2022 shows them.
  * `mnt170.js` **21 / 21**, `mnt168.js` **30 / 30**, `mnt165.js` **32 / 32** – the rest of the page as before.
  * Picture (rig): the import after Check.
* **Not verified:** **his real file** – the reader was built from his PDFs' layout; his "All Machinery Maintenance Logbook.xlsx" is
  needed to see that every sheet of it reads right (its heading words, merged cells, its sheet names) before it is used live. A real
  phone.

## Going back
* Vercel → Instant Rollback to update-172. Bills already imported stay (they are ordinary bills; one can be deleted on the page as any
  bill).
