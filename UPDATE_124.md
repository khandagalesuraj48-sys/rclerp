# update-124 – The party's Tax Invoice: the month and the amount after the diesel debit (18-10-2026)

**Asked:**
* "tax invoice war debit as nko disayla … 100 gross amount asel ani debit 10 ani mag basic yeil 90 … tax invoice direct 90 asel …
  je drive madhe bill ahet tyana changes nahi karaych"
* then: "tax invoice warti days hours rate nako dakhwayla … fkt samaj rent of bolero fkt month ani tya month chi amount … tax
  invoice warti tds nahi lagnar"
* Approved on the pictures of a sample bill: "ata je new tu dakhwale te barobar aahe ata tasech tya pramane banaw".

## What it was
On the Tax Invoice each vehicle showed:
* its work, as hours / days × rate = amount;
* its full amount;
* below them, "Total Amount Before Tax" (the full amount), "Less: Diesel deduction (Debit Note …)", then the Basic Value and the GST.

## What changes (a bill made from now on)
* **Each vehicle shows "RENT ON VEHICLE <no> (<type>)", "FOR THE MONTH OF SEPTEMBER 2026" and its amount AFTER its own diesel
  debit.**
  * A bill that is not one whole calendar month says "FOR THE PERIOD 01.09.2026 TO 15.09.2026" instead.
  * No hours, days, rate or work lines appear.
  * The GST of each vehicle is on that amount.
* "Total Billing Amount", "Total Amount Before Tax" and "Basic Value" = the amount after the debit (the Abstract's D).
  * No "Less: Diesel deduction" line.
  * SGST / CGST, Total Billing Amt and Net Cheque Amount are the Abstract's E, F and G.
* TDS is not on the Tax Invoice (as before; it is on the Abstract only).
* "Other deduction (C)", when a bill has one, stays a line of its own, as before.
* **Unchanged:**
  * the Abstract (A, B, C, D … I, the full working);
  * the Debit Note;
  * the GST declaration;
  * every figure of the bill;
  * the server.
* **Bills made before (RCL Drive) keep their papers exactly as they were.** A bill is marked when it is BUILT on Make Bill
  (`b.txNet`, in `mbFill`, saved with the bill). A saved bill without the mark is drawn as before.
* No server change, no new action, no SQL. The phone app gets the same (rcl-mobile, its bill papers and Make Bill).

## How it is built
`app/App.html`:
* `txPeriod(b)`: the month, or the dates;
* `taxInvoiceHtml`: `net = !!b.txNet` – amount = `m.amount − m.excessAmt`, the period line instead of the work lines, no diesel
  line;
* `mbFill`: `b.txNet = true`.

`app/i18n/keys.json` was refreshed by the extractor. The papers stay English: `.tx` is not translated.

## Evidence
* **Unit tests: 87 / 87.** The new test "update-124" uses the bill he approved (JCB with excess diesel, a tipper on debit basis,
  a Bolero, GST 18 %, TDS 1 %):
  * every row shows the month and its amount after the debit, with its GST: 1,24,800 / 32,400 / 40,000; Basic 1,97,200; total
    2,32,696;
  * Diesel, Debit, Hrs, Days, ×, TDS, the gross 2,34,000 and the debit 36,800 are not on it;
  * the same bill without the mark (made before) has its old paper: work × rate, the debit line;
  * the month or the dates (February, a leap year, a part month, across two months);
  * an other deduction stays a line;
  * only `mbFill` marks a bill (not `mbTotals`, not `billSheets`).
* **The web's own billing code run in node on 29 bills** (the recorded test site and made-up machinery – the generator of the
  app's bill fixture):
  * the papers of every bill WITHOUT the mark, drawn by this page, are the same to the character as the papers drawn by the page of
    main: **29 / 29**, i.e. old bills unchanged;
  * every bill's figures (A … K) are the same as main's;
  * the new mark changes the Tax Invoice of the 21 bills that have vehicles (the 8 others are empty).
* Pictures of the papers (Abstract, Tax Invoice today and new), drawn by the page's own code in Chromium, were shown to him and
  approved.
* `node --check` passes on `server/*.js` and `api/*.js`. No secret is in the change.

## Not run / not verified
* The rig API / browser tests were not run.
* A real bill was not built on the live site.

## Going back
Vercel → Instant Rollback. Bills submitted after this keep the mark: on the code before, they show their Tax Invoice the old way
(the figures are the same).
