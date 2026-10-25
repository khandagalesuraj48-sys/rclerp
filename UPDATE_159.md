# update-159 – A column for each stock point; the Transfer list's stock point = From (25-10-2026)

**Asked (25-10-2026, at 18B – VTR is fine):** "transfer mi check krt aahe stock point la filter lawatoy jo stock point asel tithun
transfer asel trch khali dakhwel n"; "dasshbord warti … / as kart aahe tr nko / oblick nko aahe mala proper te vehicle wise dakhaw
… 2 ni paiki ekat jari kahi zal asel tr te 2 ni t dakhwte ts nahi proper asaw"; "report banwatana pn bgh te 2 vehicle ektr dakhawat
aahe ass nko ahe jyach tyach seprate ale gel transfer". His answers: the Transfer list's stock point = **"फक्त तिथून गेलेले (From)"**;
the columns = **"सगळे columns नेहमी"** (every other stock point always, 0 when nothing moved).

**No database step. No entry, stock, balance, bill or permission changes** – only how the transfers are shown and filtered. Every
total (`tin`, `tout`, opening, closing) is the same number as before; the new figures are those totals split by the other stock point.

## What changes
### The Transfer list (Diesel → Diesel Transfer)
* The filter is now **"From (stock point)"**: only the transfers sent FROM that stock point (`getTransfers_`). Before, a transfer
  showed under its From and its To. At 18B: CAMP PUMP → every transfer it sent; a DISPENSER → only what that dispenser sent on (none
  today). The same in "Export to Excel" of the list (the same server call).

### Dashboard → Day-wise diesel stock, and the stock cards above it
* With one stock point chosen: **"+ Received from X"** and **"− Sent to X"** for EACH other stock point X, each its own column (before:
  one column "Received from A / B" – a transfer with A looked as if it was with B too). At 18B, CAMP PUMP: Received from MH12ZE-1739,
  Received from MH12WJ-1381, Sent to MH12ZE-1739, Sent to MH12WJ-1381. The "Whole period" line sums each column. The words under the
  table say so. The card of each stock point: the same lines. All locations: as before (no transfer columns).
* VTR (Dispenser, VTR Store – one other place each): the same words as before ("+ Received from VTR Store", "− Sent to VTR Store").

### Reports → Daily Diesel Inward & Issue Summary (screen, print, Excel)
* With one location chosen: "Received from X" and "Sent to X" for each other stock point (before: "Received from A / B",
  "Sent to A / B"). The check line (Opening + Inward + Received − Sent − Issued = Closing) is the same.

### The server (`app/Code.gs`)
* `events_`: a transfer's two events carry `peer` – the other stock point.
* `addPeer_`, `peersOf_` (the other stock points in the site's order, and one no longer a place that still has a transfer).
* `stockSummary_` (the Dashboard's cards, the Owner report's stock): each place also `tinBy`, `toutBy`, `others`.
* `getStockLedger_`: each day `tinBy`, `toutBy`; the answer `others`. `getDailyInwardIssueReport_`: each day and the totals
  `tinBy`, `toutBy`; `otherLocations` = `peersOf_`. `tin` / `tout` stay (the phone app before 3.38.0 reads them).
* `getTransfers_`: the location filter = From only.

### Help (3 languages)
* The page guide of Diesel Transfer (the filter), the Dashboard (the columns) and the Daily report (the columns): a sentence each in
  English, मराठी, हिंदी. `app/i18n`: "From (stock point)" and the new line under the Day-wise table in Marathi and Hindi; the old
  texts no longer on the page taken out ("Stock point", "other location", the old line). `keys.json` is made again by
  `tools/i18n/extract.js` – it also lists the texts of update-158 (the storage window), which had not been collected yet (no
  translation yet, as before).

### The phone app (rcl-mobile 3.38.0, its own pull request)
* The same: Dashboard → Day-wise stock and the stock cards, Reports → Daily Inward & Issue – a column / line for each other stock
  point; the Transfer list's filter "From (stock point)" and the day list of the Transfer page: From only. Against a server before
  this update (no `tinBy`) the app shows the old columns, never wrong zeros.

## Evidence
* `timeout 600 node --test test/unit.test.js` → **112 / 112 pass**. In the 18B test (three places, Camp Pump → MH12ZE1739 1,000,
  MH12ZE1739 → MH12WJ1381 300): `tinBy` / `toutBy` / `others` of each place; the ledger and the daily report of a place (the totals as
  before); `getTransfers_` From only (Camp Pump → 1, MH12ZE1739 → only its own sending, not the 1,000 it received; MH12WJ1381 → none).
* **Browser, the local rig** (Postgres + PostgREST + the door; the Portal; Mechanical :3000), `test/browser/transfer159.js` → **24 / 24**:
  T2 with the 18B names (CAMP PUMP, DISPENSER - MH12ZE-1739, DISPENSER - MH12WJ-1381), 12,000 in, CAMP PUMP → ZE 2,000, → WJ 1,500,
  ZE → WJ 300, issued ZE 100, WJ 150: the Transfer filter (2 / 1 / 0 / 3), the Day-wise table of each place (headers and every figure,
  the whole-period line), the cards, the daily report on screen and in the Excel file, All locations as before, **S1 (VTR) the same
  words as before**, no page error; the test data taken out. `test/browser/places117.js` **13 / 13**, `test/browser/ver156.js`
  **12 / 12** (main 12 / 12, without the Portal). `test/places117api.js` stops at the same set-up step on main and here (a sign-in
  of the rig's second server) – not from this change. The Portal's `test/api.test.js` 111 (set-up of the rig).
* `node --check` on `server/*.js`, `api/*.js`; the page's 6 script blocks parse; no secret in the change.

## Not verified
* On the live 18B data (only the rig's copy with the same names). The print itself (paper) – the print uses the same table as the
  screen.
* A real phone (the app's build runs its tests and draws its screens).

## Going back
* Vercel → Instant Rollback to update-158. Nothing in the database to undo.
