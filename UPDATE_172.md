# update-172 – the Maintenance bill as his picture; no GST row in the log book (27-10-2026)

**Asked (27-10-2026, 21:24, with the print of the log book of DD-01-G-0169 and a picture of the form):** "he design perfect banaw etke
mothe mothe maintenance che te nko gheu ani pdf print keli ki gst raw madhe ka dakhawat aahe heading madhe aahet gst tr mag item che list
che khali gst kashyala det aahes … design redesign kr perfect banaw".
**Then (21:36, with a reference picture of the form he wants):** "ek reference image add krt aahe – warche images nahi ale tri chale pn
asa banaw ha, but box war double click kel ki box motha hoil ani number box madhe hide nahi honar text pn nahi adjust ani as perfect banaw
baki kam continue kr".

**What his pictures showed:**
* the print: his bill 04590 (saved in update-170, when the taxes were lines of their own) had **"CGST @ 9%" and "SGST @ 9%" as rows**
  under the items, though the GST is now in the heading;
* the form: every line a row of very big boxes; the Work / part box over half the page wide and the GST columns pushed off it – the
  long note in the table's foot did not wrap and made the table wider than the page.

**No database step. Nothing saved is changed** (an old bill keeps its tax lines; only how they are shown and counted in the log book).
**No secret in any file.**

## What changes
* **The Maintenance Log Book (screen, print, Excel; web and app):**
  * **a bill of before with its taxes as lines of their own** – "CGST @ 9%", "SGST @ 9%", "GST 18%" (half CGST, half SGST) or "IGST 18%",
    all of one rate – shows **no GST row**: each tax goes onto the bill's items (its RCL / Insurance lines above ₹0, not a round-off or
    adjustment), **by the tax's %** when that makes the bill's tax to ₹1 (his 04590: Fluid ₹5,610.42 → CGST ₹504.94 + SGST ₹504.94,
    Battery ₹724.59 → ₹65.21 + ₹65.21 = the bill's ₹570.15 + ₹570.15), else **in the items' proportion**, the paisa left over on the
    biggest item. The bill's GST and its total stay what was saved (₹7,475).
  * A bill with another tax (cess, VAT …) or two rates as tax lines is shown as saved (its tax lines in their columns, as update-171).
  * A line's name is written **without its kind after it** ("Oil filter", not "Oil filter (Warranty)") – **Paid by** is its own column.
  * **Maintenance by work / part** (the server's `maintLog_`, `maintSpread_`): no CGST / SGST "work"; each item with its part of the tax.
* **The page Maintenance – the form as his picture** (only this form; the other pages stay as they are):
  * a head: the wrench icon, "Maintenance bill" and its note, and **"This bill is a service" as a switch** at its right;
  * a card with the bill's details – Bill date · Machinery · Party name · Bill number · Current reading, **each box with its icon** – then
    Remark and the **bill files** (a chip a file: its icon, its name – it opens –, its size, **×** takes it out of this bill) with
    "+ Add bill (PDF / photo)" (blue) and "Read the bill (AI)";
  * a card **"Work / parts of the bill"** with "+ Line" at its right: **one compact row a line** (34 px boxes; were 40 px and a frame),
    the columns of fixed width – **every column on the page** (nothing to scroll sideways at a laptop's width), **no number or name cut**
    in its box; GST ₹ and With GST worked out, With GST shaded; a red bin to take a line out; the AI's values a light blue;
  * under the lines: the note (now wrapping), "Double-click a box to see and type all of it in a big box.", the **Insurance claim**, and
    the **totals' box: Subtotal (before GST) · GST (18%) (its % when the lines have one) · Bill total**, the free lines' worth under it;
  * the foot: **Clear** (Cancel edit when changing a bill) at the left, **Save bill** (blue) at the right.
  * **A double-click (or F2) on any box opens it big** – the app's own big box (since 02-10-2026, for every box of the app): all its text or
    number, saved back as if typed there (the ₹ and the totals worked out the same way). Checked on the bill's lines.
  * Not taken from the picture (they would be new features, not asked): the month's counts at the top (total bills, amount, pending),
    Import from Template, Bulk Actions, Delete Selected, the rows' drag handles and pencils, Add Notes / Terms, Preview Bill, Save as Draft.
    The words of the boxes and buttons stay the page's own (their Marathi / Hindi exist).
* **Words:** `app/i18n`: 3 new texts in Marathi and Hindi ("Subtotal", "Read the bill (AI)", the double-click note), one old one out.
* **The phone app 3.52.0** (rcl-mobile, its own pull request): the car's log book the same way (no GST row; the name without its kind).
  Its bill form is the app's own phone screen and is not changed.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **125 / 125 pass**. The new `update-172` test runs the page's own `mlogSpread` on his
  bill 04590 (no CGST / SGST row; 504.94 / 65.21 each side; the bill ₹7,475), a tax that does not fit its % (in proportion), one "GST 18%"
  line (half and half), IGST, and the cases kept as saved (two rates, cess, no %, no item, a line with its own GST %); the server's
  `maintSpread_` and the log book's "by work" of that bill (Fluid ₹6,620.30, Battery ₹855.01, no CGST / SGST); the form's markup (the
  switch, the note under the table, the totals' box, the big box). Changed on purpose: update-171's column widths, update-165's
  "by work" (Engine oil ₹1,816 – its bill's "GST 18%" line now on its items).
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: no call lost; no secret in the change.
* **The local rig** (Postgres + PostgREST + Portal + Mechanical; test data only, taken out after each run; the AI a stand-in):
  * `mnt170.js` **21 / 21** (S1, step 1zi): the roller's bill of before (CGST 9% / SGST 9% lines) – 4 rows, no CGST / SGST row, Air
    Filter 52.56 + 52.56, Hydraulic oil 2,070.09 + 2,070.09, the Total as before (₹29,180.00 / ₹2,626.20 / ₹2,626.20 / ₹5,252.40 /
    ₹34,432.40); the totals' box Subtotal ₹5,595.00 · GST (18%) ₹1,007.10 · Bill total ₹6,602.10; no number or name cut; the icons never
    over the writing; a double-click opens the big box – the Work / part with all its text, Esc; on Rate 278 → 280 saved there: the line
    ₹4,200, the Bill total ₹6,637.50, back to 278.
  * `mnt168.js` **30 / 30** (Claude stand-in): the lines fit the page at 1600 px (every column, a row ≤ 44 px, a box ≤ 34 px, a free
    line's ₹ 0 greyed), the note under the table; the claim's log book – 6 lines and the insurance's row, its CGST / SGST in proportion
    (₹157.95 / ₹52.65 each – its discount typed away, the tax no longer 9 % of the items), the names without their kind, the Total as
    before.
  * `mnt165.js` **32 / 32** (Claude stand-in) – the whole page of update-165; changed on purpose: the car's log book has 6 rows (its first
    bill's "GST 18%" line on its 3 items, CGST 9% / SGST 9% in the heading).
  * Pictures (rig): the form, the lines, the log book.
* **Not verified:** a real phone; the form on a small laptop screen in Marathi (checked at 1600 px in English); a real AI reading.

## Going back
* Vercel → Instant Rollback to update-171. Nothing saved changed: the log book shows the tax lines of the bills of before as rows again.
