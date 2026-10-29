# update-192 – the old log book imported exactly as it is; several log books deleted together from the status (29-10-2026)

**Asked (29-10-2026, 15:36):** "ani aik old log book mi jewa first time kontya hi machinehe upload krayla jail mg te pdf aso ki excel
tewa as it is sagle aahe as yeyla ahw app swtaat tewa kahich nahi akrnar fkt spelling crrect krel te hi fkt iteam che je material issue
zalel asel tyach ani heading ekde tikde astil tr heading match krel ok baki amount madhe jara pn changes hoyla nko aah ehe perfect kr web
warti adhi kr nantr app kraych ki nahi sangto" and (15:38) "ajun ek maintanace log bokk je aahet status made multiple delet option pn de
ek ekselect krun ek sathi mi delet kru shaku". **The web only** – the phone app's own import screens later, when he says.

**Then (16:32) with his real files** – his old log book of MH25AJ5506 and the app's Excel of it after the import: "rate diffrenace kiti aahe
… import krtaa ji excel import file madhe ji amount ahe tich dakhwali jate nantr … app madhe amount weglich aste … je mi import kartoy tech
rahayla haw n amount basic aso gst aso total aso". Checked line by line (his files stay out of the repository):
* in the app the 190 lines carry the numbers his sheet **shows** (its cells are formatted in whole rupees: GST 212.40 shown "212", rate
  1,185.59 shown "1,186") – not the cells' own values: 110 lines differ by up to ₹0.50 each;
* **4 lines were not imported**: two AdBlue fills of one day (another reading, another driver) were taken as "the same bill twice in the
  file" and the second was left out (30-01-2026, 16-02-2026; and 01-06-2025 / a ₹0 line of 30-05-2025 with another of the same day);
* some names were changed by more than a spelling ("Diesel Cap" → "Diesel Tank Cap", "Mahindra Ad Blue" → "Ad Blue Mahindra");
* the Excel of the log book turned a date of day 12 or less around (10-12-2023 → 12-10-2023 – the Excel maker read it as a US date);
* his sheet's own Total (₹7,06,578.70) leaves out 3 rows whose "Amount With GST" is empty (₹6,549.00): Amount + GST of all lines
  is ₹7,13,127.70.

**No SQL.** No table, no row is changed by the update itself. No secret in any file.

## What changes
### 1. The old log book (Excel, PDF, photo) – as it is
What the import did before that was not "as it is" – each one found in the code and put right:
* **An Excel's number as it is in the cell – its whole value** (as the web read it before; his MH25AJ5506 sheet shows why: its own
  totals add the whole values) – kept to the paisa. Only a per cent cell is taken as it shows (0.18 shown "18%" is 18 %, not 0.18 %).
  A PDF or a photo has only the printed (shown) numbers – for the whole values, import the Excel itself.
* **Numbers as written** (`mliNum`, the rows' `n`): "1,250/-", "Rs. 500", "₹ 75.50", "(150)" (= −150). Before, "1,250/-" or "Rs. 500"
  became **₹0** without a word. "-" / "nil" = not written. A word in an Amount / GST / Amount With GST that is not a number now
  **stops that sheet** ("Line 4 (TYRE): Amount "three hundred" is not a number – put it right in the file") – never ₹0. A Qty / Rate /
  reading that is not a number: left empty and shown. "2 Nos", "12,345 KM": the number (and its unit when the Uom is empty).
* **Nothing dropped unseen:**
  * a total row is left out only when its words are a total alone (Total, Sub Total, Grand Total, Total Rs., B/F, C/F). Before,
    any Particulars starting with "Total" was dropped – an oil "TOTAL QUARTZ 15W40" was lost, and "Sub Total" was imported as a line
    (the bill counted twice). Each total row left out is listed under "line(s) to look at";
  * a row with an amount but no Particulars: before, dropped (its ₹ lost); now kept as **"-"** with its ₹, and listed – unless its ₹ is
    the bill's lines above it (to ₹1): the bill's total row, left out and listed;
  * a row of only its date / party / reading (the bill's lines under it): before, the lines under it took the date of the bill above;
    now they take this row's;
  * a line without an Amount in the file: ₹0 (free) as before – now listed ("Qty × Rate = ₹80 but no Amount in the file").
* **The row's own numbers only** (`maintLogRows_` = the page's `mliRows`, word for word): an Amount not written in a row that has its
  Amount With GST – that less its GST (the row's total stays the file's); no GST ₹ written but an Amount and an Amount With GST – the
  GST is the difference (when it is a GST: 0 to 28 % of the amount). Before, a GST % made the GST (₹222.12 where the file says ₹222), and a
  book with Amount and Amount With GST but no GST column lost its GST. Nothing else is worked out.
* **The bill no. kept** (heading Bill No / Invoice No / Challan No – not a Part / Job Card / Item no.): the bill is saved with it, and two
  bills of one day and one party with their own nos. stay **two bills** (before: one).
* **Never a line of the file left out because another line of the file is like it** (his two AdBlue fills of a day): only a bill
  **already saved** is left out (the same file imported again – listed, as before); a saved bill stands for one bill of the file only; two
  bills with their own readings or bill nos., not the same, are never the same bill. A bill of the file written the same as another one
  further up is imported and listed ("Line 6: written the same as Line 3 – imported as the file has it"). A numbered empty row (only
  zeros) is no line. A row without its "Amount With GST" (where the others have it) is listed: its Amount + GST is kept.
* **Only the items' spelling** (`maintImportNames_`, `mliNamesOf`, `mliBills`): the AI is asked only about the Particulars; a Party name
  or a Uom is never offered or changed (also when an older phone app sends them). The list "Item names (Particulars) – spelling (AI)";
  only what is ticked is changed. **A spelling only** (`spellOnly_`): the same letters but for spaces and signs ("ADBLUE" / "AD BLUE"), or
  the same words in the same order each spelt a little differently ("HYDROULIC" / "HYDRAULIC") – a word added, taken out or moved
  ("Diesel Cap" → "Diesel Tank Cap", "Mahindra Ad Blue" → "Ad Blue Mahindra") is not offered.
* **The Excel of a report** (`rpExcel`, every report's "Export to Excel"): a date goes as the page shows it (dd-mm-yyyy) – before, one
  whose day is 12 or less was turned around (10-12-2023 → 12-10-2023).
* **The AI reading a PDF / photo:** told to copy every number with all its digits and decimals – never rounded, never worked out; to keep
  every row of a bill (also one without Particulars); the bill no. is a heading it may name. Its rows now have the bill no. as the 13th
  column (the phone app reads the first 12 – as before).
* The format download (Excel) is as before (no column added). "How the file is read" says it in his words.

### 2. Log book status – several log books deleted together
* **Maintenance → Log book status** (the Admin / Super Admin only – as "Delete this log book"): a ✓ for each log book with bills (and one
  for all shown); **"Delete selected (n)"**. It says first each log book with its bills, dates and ₹, and the total; **DELETE** is typed to
  confirm. Then each machinery's whole log book is deleted (the server's `deleteMaintLog`, Start to end, the bills counted as shown).
* A log book changed meanwhile, or with a month closed: **not deleted**, said ("0 deleted, 1 not deleted" and why); the others go.
  What the RCL Store issued and the fuel stay; each bill is written in the Activity Log (as the single delete).
* Words in English, मराठी, हिंदी (`app/i18n`). No new server action, no new server message.

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `maintLogField_` (billNo), `maintLogRows_` (`nil`, `n`, a row's own numbers, 13th column), `MLR_NAMES_.billno`, `readMaintLog_` (the words to the AI; rows with a number kept; 13 columns), `maintImportNames_` (the items only, `spellOnly_`), `importMaint_` (`twice`: only a saved bill, once, its reading and bill no.) |
| `app/App.html` | `mliField` / `mliRows` (the server's word for word), `mliNum`, `mliLead`, `mliShown`, `MLI_TOT`, `mliSheet` (every row as it is; `nums`; the bill no.; zero rows; `same` / `nw` listed), `rpExcel` (dates `data-t="s"`), `MLI_HEAD` (13), `mliFormat` (12 as before), `mliRead` (`mliShown`), `mliNamesOf` / `mliBills` / names list (items only), `mliWarnText`, `mliState` / `mliPaint` / Check (a sheet with `nums` not checked); the status: `#ml_stdel`, `#ml_stall`, `.ml-stck`, `mlStAdmin`, `mlStatusSel`, `S.mlsel` |
| `app/i18n` | the new texts appended to `keys.json`; their Marathi / Hindi |
| `test/claude-standin.js` | answers "ITEM NAMES OF …" |

## Evidence
* Unit tests: **145 / 145** (new `update-192`; update-173 / 180 / 183 moved to it: the 13th column, a row without Particulars kept, the
  names only items, two alike bills of the file both imported).
* **His MH25AJ5506 sheet on the rig** (a scratch check – his file is not in the repository; the rig's own database): imported through the
  page as he does it – read **194 lines** (the file 194), 106 bills, Total ₹7,13,127.69 = File total; listed: the Total row (left out) and
  the 3 rows without Amount With GST; the AI's names: only "Coolent → Coolant" offered ("Diesel Tank Cap", the words moved: not); Check –
  every bill new; **saved 194 lines – each one's date, item, rate, Amount and GST the file's cell to the paisa (194 / 194 the same)**; its
  Excel: every date as shown (10-12-2023 stays 10-12-2023).
* Local test rig (PORTAL=1, RCLSTEPS=1, claude mode; each test on its own clean copy) – new `test/browser/mnt192.js` **14 / 14** (the Excel
  as old files are: "1,250/-", a GST 56.25 shown 56 → 56.25, "2 Nos", an oil named TOTAL QUARTZ kept, the Sub Total left out, two bills
  of one day by their bill no., the date / party row, "-" for an amount without Particulars, no Amount ₹0 – File total = Total ₹4,085.75,
  saved so; the AI's names – only the item; a sheet with "three hundred" – said, not imported; the status: two log books ticked and
  deleted together, a wrong word – nothing, a log book changed meanwhile – not deleted, said; not the Admin – no ticks). Pictures
  `mnt192_import.png`, `mnt192_confirm.png`, `mnt192_status.png` (on the rig).
* Again, moved to "only the items" / the Admin's ✓ column where they read them: `mnt173` 24 / 24, `mnt183` 15 / 15, `mline180` 15 / 15,
  `mnt182` 16 / 16, `mnt170` 20 / 20; the Portal's own test 123 / 123.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The real AI service (the rig uses its stand-in); a PDF of his.
* **His live log book of MH-25-AJ-5506 stays as it is now** (rounded numbers, 4 lines missing) – nothing live is changed by an update: after
  this update he deletes it (Log book status → ✓ → Delete selected, or "Delete this log book") and imports the Excel again.
* Each amount is kept to the paisa (a GST of ₹30.5082 in a cell is ₹30.51) – the lines' sum can differ from the sheet's own sum by a paisa
  or two.
* The live site; a real phone (the app is not changed).
* The phone app's own Excel import still reads as before (his word: the app later). Its PDF import and its names list use the server's
  new rules already (the same server).

## Going back
Vercel → Instant Rollback to the previous update. Nothing to undo in the database.
