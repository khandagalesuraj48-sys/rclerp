# update-104 – Water tanker in Edit Log Book (+ Add row, Excel export / import); two faults (14-10-2026)

**Asked:**
* "ata eth Add row ha option nahiye, same Import Export option pn haway, mi bulk madhe pn data upload karu shaku" – Edit Log Book
  of MH-04-J-9844 (water tanker) had no "+ Add row" (update-103 hid it) and no Excel.
* Faults list (2 today): "he kay yet ase sarkhe ani he error auto fix hoyla hawet".

## 1. Edit Log Book of a water tanker – one row per trip
* A machinery on Log Book Format I now opens in Edit Log Book as its **trips**, one row each:
  Date, Shift, Challan No, Dispatch, Unload, Trip (1), Chainage No, Use For.
  * Trips of an entry made before trip by trip are shown too, marked.
  * Idle / Holiday / Breakdown days are listed on top.
  * Dates in a submitted bill are shown and cannot be changed.
* **+ Add row** adds a trip with the date and shift of the row above. A row can be changed or taken out (×, or tick + Delete
  selected). **Save changes** sends all trips of those dates.
* The server (`saveTankerRange_` → `tankerPlan_`) checks every changed date as the trip-by-trip form does:
  * a challan and both times for a new or changed trip;
  * the same challan of the agency anywhere;
  * a time on another trip;
  * Idle / Holiday / Breakdown;
  * a closed month or a submitted bill;
  * the tanker active and a Per Trip BOQ.

  It then writes one entry per date and shift. An entry whose trips are all taken out is deleted. A Full Day entry takes the Day
  trips; Night trips make it the Day, and a debit note linked to it follows. A date that did not change is not touched.
* **Export Excel**: the Water Tanker Report layout (SR. NO., DATE, SHIFT, NAME OF AGENCY, VEHICLE NO, CHALLAN NO, DISPATCH TIME,
  UNLOAD TIME, TRIP, CHAINAGE NO, USE FOR). It has the trips of those dates and 100 empty lines with the tanker filled in, and a
  Day/Night drop-down.
* **Import Excel** (bulk): the same layout, many tankers and dates. The trips are **added**: a challan already saved for that
  tanker and date is skipped. The file is checked first and a box shows the counts ("N will be added, M already saved"). Then
  all trips are saved, or none.
* The other machinery: Edit Log Book as before. The trip-by-trip form: as before.

## 2. Fault "getMeterReading – database – The AI could not read the meter now (The database did not answer in time.)"
* **Cause:** the AI service (not the database) did not answer the photo within 25 s. The shared network helper says "The
  database did not answer in time" for any call that runs out of time. So:
  * the fault list marked it as a database fault;
  * the server answered "try again later" (503).
* **Fix (`server/gas.js`):** an AI call that runs out of time now says "the AI service was too slow to answer". It is not a fault
  of the app, so it no longer goes to the fault list. The person still types the reading, as the message says.

## 3. Fault "policy – Security policy (watched only – nothing was blocked): script-src – eval"
* **Cause** (proved on the rig): the **phone app** (3.1) switched pages in the web by running a piece of text as code (eval). The
  watched security policy noted each one. Nothing was blocked.
* **Fix:**
  * The web page has its own door, `window.rclGo(page)` (here).
  * The app uses that door (rcl-mobile pull request "no-eval"; it needs a new app release). An older page still works through
    the old way.

## Evidence
* Unit tests: 68/68. New "update-104" covers:
  * the range: unchanged = nothing written; added, changed and taken out;
  * Full Day + Night → Day;
  * a date emptied (its entry goes);
  * duplicate challan or time, a missing time, Holiday, a date outside the range;
  * import: check / all or none / already saved / an Excel time number / a bad line;
  * the AI message is not a database fault;
  * help texts and PAGE_GUIDE.
* Local rig, browser:
  * **`tanker104.js` 12/12:** Edit Log Book of a tanker with an old entry; + Add row saved into the same Day; a Night; the same
    challan stopped; a row taken out; Export file checked; Import of the filled file (3 added, 2 skipped, 2 tankers); another
    machinery as before.
  * `tanker103.js` 11/11 (its Edit Log Book check changed to update-104); `tanker97.js` 16/16.
* rcl-mobile `test_web/real_erp.js` 18/18, with a new check "the page switches ran no eval". With the old bridge that check fails
  ("script-src eval" ×3), which is the fault in his list.
* `node --check` on server/*.js and api/*.js passes; the page's script blocks parse.

## NOT verified
* On the live data. A real phone (the app change needs a new release, after his yes).
* The Excel files were made and read by the test (ExcelJS / SheetJS), not opened in Microsoft Excel.

## Going back
Vercel → Instant Rollback (rclerp). Trips saved from Edit Log Book or Import are ordinary trip-by-trip entries and stay right.
No SQL.
