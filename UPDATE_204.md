# update-204 – the Tax Invoice of the Net Work Done Amount; RCL Drive: deleted bills in their own tab, month by month (03-11-2026)

**Asked:** "je party tax invoice ahe tya war debit amount nko dakhau tith direct ji abstract warti Net Work Done Amount ji amount asel
debit nantr chi tich tax invoice part dakhwel ok debit kiti kay tax invoice warti nay yenar he fix kr ni ajun ek delet kelel bill eth
nko show karu seprate thew month wise" (with his RA Bill 19 – a Bolero, the substitute driver's charges as the other deduction – and
the picture of RCL Drive).

**No database step.** A bill made from now on carries `data.txD`; nothing saved before changes.

## 1. The Tax Invoice (a bill made from now on – `b.txD`)
* The invoice is of the **Net Work Done Amount (D = A − B − C)** of the Abstract: no "Less: Diesel deduction", no "Less: Other
  deduction", no reason of a deduction. Total Amount Before Tax = Basic Value = D; GST on it; Total Billing Amt = Net Cheque Amount = G.
* Each vehicle's line is its amount after its diesel debit (as since update-124) **and after its share of the other deduction (C)**:
  C is taken off the vehicles in proportion to their amounts (whole rupees on a bill in whole rupees, the rest on the last vehicle –
  `txShares`), so the lines add up to D. One vehicle (his RA 19): 41,290 − 1,800 = **39,490** on the invoice.
* The Abstract still shows A, B, C (with its reason) and D; the Debit Note as before.
* **A bill made before keeps its invoice as it was** (RCL Drive shows every bill exactly as it was saved) – RA 19 already submitted
  keeps its "Less: Other deduction" line; a bill made again (or a revision) after this update gets the new invoice.

## 2. RCL Drive – Deleted Bills
* **Saved Bills** no longer lists a deleted bill (the bills in force and the superseded ones stay).
* A third tab, **Deleted Bills**: the deleted bills **month by month** – the month the bill's work period starts (as the Bill Summary),
  the newest month first ("October 2026 – 2 deleted bills"), each with who deleted it and when, the reason, and View / Print, Log
  Book, 📎 Files (no Delete). The same filters (period, vendor, name on the bill) apply.
* The page guide of RCL Drive says where a deleted bill is (English, Marathi, Hindi).

## What changes
* **Page (`app/App.html`)** – `mbFill` marks `b.txD`; `txShares`, `taxInvoiceHtml`; RCL Drive: the tab, `#drv_del` / `#sbx_rows`,
  `sbDeleted`, `sbLoad` (the bills split), the tab switch, `sbClick` for both lists; `PAGE_GUIDE.bills`.
* **Server** – nothing.
* **rcl-mobile 3.77.0** – the same in `bill.dart` (`txD`, `txShares`, `taxInvoiceHtml`) and RCL Drive (Deleted Bills tab).

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 156 / 156 (new `update-204`: his RA 19 – the invoice of 39,490 with no
  deduction; three vehicles with diesel and C 1,000 – the shares 632.86 / 164.30 / 202.84 (633 / 164 / 203 in rupees), the lines add
  up to D, GST on each line; a bill before keeps its "Less" line; Deleted Bills month by month, newest first, no Delete). The page's
  script blocks parse.
* The rig in Chromium (Postgres + PostgREST + Mechanical): the October bill of the test vendor with C 1,800 – the Abstract shows C and
  its reason, the Tax Invoice 1,69,436 = D with no deduction (69,412 + 1,00,024), submitted (`data.txD`), opened again the same; RCL
  Drive – Saved Bills without the deleted ones, Deleted Bills: October then September, who and why, View / Print opens – all passed.
* rcl-mobile 3.77.0: the build on GitHub Actions; the app's bills against the web's own (`web_round.json` made again by the web).

## Not verified
* Not run on the live site or a real phone.
* The deleted bills on the rig were copies made in its database (a Super Admin's delete through the Portal was not run here).

## Going back
Vercel → Instant Rollback to the update before. Bills made in between keep `data.txD`; with the earlier page their invoice shows the
"Less: Other deduction" line again.
