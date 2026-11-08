# update-180 – the old log book's headings in any order; each line of the Maintenance Log Book its own Edit / Delete (28-10-2026)

**Asked (28-10-2026, 15:32):** "APAN JE MAINATANCE LOG BOOK JE PDF IMPORT KRT AAHOT N TR KAY HOTE KAHI PDF MADHE HEADING MAGHE PUDHE
AAHET TR APLE SYSTEAM NI AUTO IDENTY FY KRUN TE SAGLA BANWAYLA HAW OK ANI HA KONTYA HI GADICHI LOG BOKK MAINTANACE WALA EK EK ENTRY MALA
EDIT OR DELET KRTA YAWI". His answer (asked): **each line on its own** ("प्रत्येक ओळ स्वतंत्र") – the bill's Change / Delete stay; web
and app.

**No database step. Nothing saved is changed by the update itself. No secret in any file.** With the phone app **3.56.0** (the same,
as the app's own screens – not released yet, as he said).

## What changes
### 1. The old log book (PDF, photo, Excel) – the headings in any order, found by their words
* Before: the AI was told the columns in one fixed order (Sr No · Date · Party Name · … · Total) – a PDF printed in another order or
  with other names went into the wrong columns. The Excel needed the exact names.
* Now the AI copies each table's **headings as printed, left to right**, and every row under them, and says what each heading is. The
  columns are then found **here, by the words of the heading** (`maintLogField_`): Bill Date / Date; Party Name / Supplier / Garage /
  Vendor / Workshop; Current Reading / KM / HMR / Hrs; Particulars / Item Description / Material / Spare Parts; Qty / Quantity / Nos;
  Uom / Unit; Rate / Basic Rate / Unit Price; Amount / Taxable Value / Basic Amount; GST / GST Amount / CGST / SGST / IGST (in ₹ –
  **CGST + SGST added**); GST % / Rate of GST; Amount With GST / Net Amount / Gross / Total Amount; Total. A heading no rule knows:
  what the AI said it is. Left out: a bill no., a remark, a discount, an HSN code.
* A book **without an Amount column**: its amount with GST less its GST (or from its GST %), or Qty × Rate when it has no amount at all;
  a GST % makes its GST ₹. Every other cell as printed.
* **A page going on without its heading:** the page sends the headings of the page before with the next page; the AI reads that table
  in them. (A phone app of before sends none: such a page is read in the log book's own columns, as before.)
* The rows still come back in the log book's 12 columns – the Check, the duplicates, the names, the Import are as before.
* **Excel:** the same rules on the page (`mliField` / `mliRows` – word for word the server's; the unit test keeps them the same): the
  heading row is the first with a Particulars column and an amount (or a rate), in any order.

### 2. The Maintenance Log Book – each line of a bill its own Edit and Delete
* **Maintenance → Maintenance Log Book** (any machinery, any dates or "Start to end") – under each Particulars: **Edit · Delete**
  (only for Maintenance Edit; on the screen only – not in the print, not in the Excel). The bill's **Change / Delete** on the Party
  Name stay.
* **Edit** → a box: Particulars, Paid by, Qty, Uom, Basic Rate, Disc %, Amount (₹), GST % – as a line of the bill's form (a Paid line's ₹
  from Qty × Rate − Disc %, a free line ₹ 0; its GST and amount with GST shown). Save → only that line changes; the rest of the bill –
  its other lines, its insurance part, its files, party, bill no., reading, service – stays as it is. The bill is checked as a change
  of the whole bill (every check of the form; the same machinery is not checked against its Active dates again – an old imported bill
  can be changed). A mistake is said in the box (what was typed is kept).
* **Delete** → "Delete this line?" (the line with its ₹, the bill, "The other lines of the bill stay as they are.") → only that line goes.
  **The only line of a bill:** "Delete bill MT-…?" – the whole bill is deleted (a bill keeps at least one line).
* **Changed by someone meanwhile:** the server checks the line is still the one shown (its work, ₹ and the bill's date) – else
  "Bill MT-… was changed meanwhile – show the log book again, then change its line." (nothing saved).
* Server: `updateMaintLine(id, { i, date, was, line })` and `deleteMaintLine(id, { i, date, was })` – Maintenance Edit, kept in the
  Activity Log as a change of the bill (before / after), sent for verification like every Maintenance save (a rule on). Help for the
  two new messages (English, मराठी, हिंदी); the new words of the page in मराठी and हिंदी.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **133 / 133 pass** (new `update-180`: the page's and the server's heading rules word for
  word the same; 51 headings each to its column; his own format unchanged; another order, CGST + SGST, no Amount column, a GST %; the
  AI's answer with headings – a heading by the AI's word – the next page in them – an answer of before as before; his Excel in another
  order on the page; one line changed – the bill's total again, its insurance part and file kept; refused when changed meanwhile /
  another date / no such line; checked as the bill's form; a line deleted; the only line refused; the insurance not more than the bill;
  the two actions, the verification, the page).
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse (unit test); no secret in the change.
* **The local rig** (Claude stand-in): new `test/browser/mline180.js` **15 / 15** – an Excel with its headings in another order (Item
  Description, Bill Date, Supplier, KM, Unit, Rate, Taxable Value, CGST 9%, SGST 9%, Net Amount, Remarks) read and imported (₹3,256.80);
  a PDF of 2 pages – page 1 in another order ("Kilometre" by the AI's word), page 2 without its heading read in page 1's – imported;
  the log book: 5 lines each Edit · Delete; FUEL FILTER Qty 1 → 2 (₹1,300 from Qty × Rate) saved – only that line; a line changed by
  someone meanwhile refused in the box; a line deleted; the only line → the whole bill; View only – none; no page error. Pictures:
  `mline180_logbook.png`, `mline180_edit.png` (on the rig).
* Again on the rig, all passing: `mnt173.js` 24 / 24 (the old import: his own layout, the PDF of before, the names, the format), `mnt170.js`
  21 / 21, `mnt168.js` 30 / 30, `mnt165.js` 32 / 32, `pendprint179.js` 13 / 13; the Portal's own test 119 / 119.
* **Not verified:** a real PDF of his read by the real AI (the rig's stand-in answers as Claude would); the live data.

## Going back
* Vercel → Instant Rollback to the update before this one (update-178). Nothing to undo in the database.
