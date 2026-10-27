# update-173 – the old maintenance log book imported as it is: Excel, or PDF / photo read by the AI (27/28-10-2026)

**Asked (27-10-2026, 23:30, with his log book PDFs and Store Excel files):** "ata mazya kade pdf aahet excel aahe log book che ok ata
jewde active aahet own rachana vehicle te mala import karaych aahe as it is jas asel tr tya nantr new data mi bharat jail ok …".
**His answer (asked which first):** "Log book import आधी" (then the Store module).
**Then (28-10-2026, 00:13):** "excel file nhi tu banaw perfect ani aple app madhe powerful Claude AI aahe so import kartana full scan
duplicate sagle kahi find krun import kasel name correction samaj suraj name asel excel madhe 4 type madhe aahe surj suraaj saraj as tr
ai verify karel sagle ani mg proper import duplicate entry import nahi honar ts to show pn krel as powerfull hawy sagle".
**His answers (asked):** all three – **PDF import (Claude AI reads it)**, **Excel format (template) download**, **Excel import**; the
names the AI corrects: **"यादी दाखव, मी पाहून ✓ करेन"** (the list is shown, he ticks).

**No database step.** Imported bills are ordinary maintenance bills (the table of step 1zi, as update-170). **Nothing saved is changed**
– an import only adds bills. **No secret in any file.**

## What changes
* **The page Maintenance → "Import the old log book (Excel or PDF)"** (a panel under the bills – **the Admin only**, and only where
  step 1zi is run): **"Choose the file (Excel / PDF / photo)"** and **"Download the format (Excel)"**.
  * **His Excel** ("All Machinery Maintenance Logbook" – a sheet a machinery, as his PDFs): the heading row Sr No · Date · Party Name ·
    Current Reading · Particulars · Qty · Uom · Basic Rate · Amount · GST Amount · Amount With GST · Total (found by its words, in any
    row, in any column order); the machinery's name above it (ROLLER NO-03).
  * **A PDF of the old log book, or a photo of a page – read by the AI (Claude)** row by row, every name and number as printed (the AI
    is told not to correct a spelling): 2 pages a call (an answer within the server's 60 seconds; a cut or slow answer – one page); the
    file is kept by Claude between the calls (prompt caching – the next pages cost about a tenth for it); each machinery's table its own
    sheet (a page going on without its name joins the one before); then read exactly as a sheet of the Excel. Up to 3 MB a file.
  * **"Download the format (Excel)"**: "Old Maintenance Log Book – format.xlsx" – "How to fill", then **a sheet for each Own machinery
    on the site today**, its number in row 3 (the sheet is put to it by that), the heading ready. Nothing else in it.
  * **each sheet is read as his log book:** a bill = the rows one under another of one date and party (a date left empty – a merged
    cell – is the row's above; a reading only on the bill's first row is the bill's); the total line is skipped; each line as it is:
    Particulars, Qty, Uom, Basic Rate, Amount and its **GST %** from its GST Amount (18 % when 18 % of the amount makes it to ₹1 – an old
    file shows whole rupees; else the % itself); a ₹0 line stays ₹0 (kept as FOC);
  * **its machinery** found among the **Own machinery on the site today** (Asset Master) by the name above the heading or the sheet's
    name (ROLLER NO-03 = ROLLER-03 = Roller No.03; MH12XW0169 = MH-12-XW-0169) – he can change it, or set "– not imported –"; a rented
    / hired one, or one not on the site now, is never offered;
  * **the full check – the lines that do not add up are shown** ("N line(s) to look at – imported as they are"): Qty × Rate ≠ Amount,
    Amount + GST ≠ Amount With GST, a GST % that is not 5 / 12 / 18 / 28 – each with its line. They are imported as they are (as asked).
  * **the names written in more than one way (AI)** – asked by itself after the file is read: every Party Name, Particulars and Uom of
    the file (with its rows) and the names already saved at this site go to the AI; it says which are one name written in several ways
    (SURJ / SURAAJ / SARAJ → SURAJ) and the right spelling (a saved one first, else the one most rows use). **The list is shown, nothing
    ticked** – he ticks what is to be changed (Tick all / Untick all), may type another name in "Becomes"; the bills are checked and
    imported with the ticked names, the rest as in the file. "Ask the AI again". Without the AI: "the names stay as in the file".
  * a table a sheet: Sheet · Name in the file · Machinery (Active, Own) · Rows · Bills · File total (₹) (its "Amount With GST") · Total
    (₹) (the lines with their GST as they will be kept) · Check;
  * **Check** (`checkMaintImport` – nothing saved): each machinery's bills checked by the server as a bill typed in – each mistake with its
    row ("Line 12: …"); else "✓ N new bill(s), lines, ₹ (from – to)";
  * **duplicates shown:** "N bill(s) already there – left out" opens the list – each with its rows, date, ₹ and "already saved as
    MT-…" (or "twice in the file (Line …)");
  * **Import** (`importMaint`, asked first): **one machinery all of it or nothing**; bill numbers MT-… as usual; "Entered by" him.
* **The server** (`app/Code.gs`; `API_`: `checkMaintImport` – Maintenance, Admin; `importMaint` – Maintenance Edit, Admin, logged as
  `maintImport`; `readMaintLog`, `maintImportNames` – Maintenance, Admin, nothing saved):
  * `importMaint_`: only an **Own** machinery **on the site now** ("X is not an Own machinery on this site now (Asset Master) – the old
    log book is imported only for those."); at most 3000 bills in one import; a file with no bill says so; each bill: its date a real
    one up to today, **closed months stay closed** (entryOpen_ – the Admin reopens a closed month first if the old log book is of a
    closed period); its lines checked as a typed bill (maintLines_); its reading as a reading; not a service; **the machinery's Active
    check is not made** (a bill of 2022 is before its "active from");
  * **a bill already there is left out** – the same machinery and date, and **the same lines, or its total to ₹1 (above ₹0) – whatever
    its party is called** (SURJ or SURAJ, a name ticked or not); the same bill twice in the file is kept once. So the same file can be
    given again: only what is not there is added. The list of those left out: up to 500.
  * `readMaintLog_`: a PDF or a JPG / PNG photo up to 3 MB; the pages asked; the AI's answer as tables of 12 columns ("null" = empty, a
    row without Particulars left out); a cut answer → `again` (the page asks one page). Without the AI: `{ off: true }`.
  * `maintImportNames_`: the file's names (up to 4,000 a list) and the saved ones (the 1,500 most used); only a real change of a name
    of the file is kept. Without the AI: `{ off: true }`.
  * `aiAskPhoto_` / `aiAskPhotoC_`: an optional `opt` – the file kept (cache_control), a longer answer, a text alone, the words after
    a failure. Every call of before is unchanged.
* **Help and words:** `FIX_RULES` rules for the new messages (English, मराठी, हिंदी); `PAGE_GUIDE` mnt: `importMaint`,
  `checkMaintImport`, `readMaintLog`, `maintImportNames` and a sentence on the import; `app/i18n`: the new texts (the page's in Marathi
  and Hindi; the AI's own questions and the Excel's words stay English).
* **The phone app 3.53.0** (rcl-mobile, its own pull request): the Admin's Maintenance has the same import as the app's own screen –
  Excel, PDF, photo, the format; the names list with ticks; the lines to look at; Check, Import, the duplicates listed – the same server
  actions; the file read by the same rules (proven against this page's code).

## Evidence
* `timeout 300 node --test test/unit.test.js` → **126 / 126 pass**. The `update-173` test: an Own roller and a rented JCB; Check of 3
  bills (6 lines, ₹15,999.62) saves nothing; Import adds 3 (a ₹0 "DRUM OIL" line kept FOC); the same 3 again → 0 new, 3 already there;
  a near total (within ₹1) is the same bill; **the party written another way ("STOR") is the same bill; a ₹0 bill with other lines is
  new**; the same bill twice in the file once; a wrong date and a bill without lines → 2 mistakes, nothing saved; the rented one and an
  empty file refused; the log book after the import; **the AI** (a stand-in): a PDF's pages 1–2 as a document kept by Claude (cache
  control), 16,000 tokens, "Read ONLY pages 1 to 2", every row in 12 columns, an empty table and a row without Particulars left out; a
  cut answer → `again`; a photo – its one page; a wrong file; a file over 3 MB; busy → asked again, then "try again in a minute"; **the
  names**: the file's names with their rows and the saved ones asked as text alone; only names of the file, a real change, once, a known
  list; no name – nothing asked; no AI – said so; **the page's own reader**: Qty × Rate, Amount + GST, GST 21.24 % found (a usual 5 %
  not); a sheet of the AI numbered by its rows; only a ticked name (with a name) changed in the bills sent, the file as it is kept.
  Changed on purpose: update-165's list of Maintenance `saves` and the Gemini body of a photo (the text alone allowed).
* `node --check` on `server/*.js` and `api/*.js`; the page's 6 script blocks parse; acorn: no call lost; no secret in the change.
* **The local rig** (Postgres + PostgREST + Portal + Mechanical; the Claude stand-in `test/claude-standin.js`, now with `/__next` – the
  answers to a file in order – and `/__names`; test data only, taken out after each run):
  * `mnt173.js` **15 / 15** (S1, step 1zi): an Excel in his layout uploaded – 2 sheets (the roller "Roller No.03" = RL-173; the rented
    JCB "– not imported –"), 7 rows, 4 bills; **the names (AI)**: GANESH MOTERS → Ganesh Motors, FUEL WATER SEPRETOR → FUEL WATER
    SEPARATOR, nothing ticked, asked once with every name and its rows; **"1 line(s) to look at"**: Qty × Rate ₹16.50, Amount ₹15.00;
    the party ticked; Check ✓ 4 new bills ₹16,017.32; Import MT-000001 … MT-000004 – the ticked party "Ganesh Motors", the unticked
    Particulars as in the file; **the same file again**: 0 new, **4 listed** "already saved as MT-…" (GANESH MOTERS = the saved Ganesh
    Motors bill); **a PDF**: pages 1–2, 3–4 cut off, then page 3 alone, the file kept every time; 2 machinery (ROLLER NO-03 – its page
    without a name joined; MH12XW0169 not on the site – not imported); Check 1 new + AD BLUE already there; Import MT-000005; **the
    format**: "How to fill", a sheet for RL-173 (row 3 its number, the heading), none for the rented JCB; the roller's log book: 5 bills,
    ₹16,489.32.
  * `mnt170.js` **21 / 21**, `mnt168.js` **30 / 30**, `mnt165.js` **32 / 32** – the rest of the page as before.
  * Picture (rig): the names' list and the check.
* **Not verified:** **his real files** – the Excel reader was built from his PDFs' layout, and the PDF reading with the stand-in, not
  the real Claude (how well the real AI reads his scanned / printed pages is seen only with his file, live). **Try it first with one
  machinery's file and look at the Check before Import.** A real phone.

## Going back
* Vercel → Instant Rollback to update-172. Bills already imported stay (they are ordinary bills; one can be deleted on the page as any
  bill).
