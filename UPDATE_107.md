# update-107 – Log Book "Import from Excel" takes water tanker trips (14-10-2026)

**Asked:** "log book che ethun jr mi water tanker import kel tr error yet aahe – asa error nko yeyla."
Before: a file with a water tanker (Log Book Format I) on Log Book → "Import from Excel" was refused for every tanker line
("… is a water tanker – its trips are entered on Log Book → Water tanker – trip by trip"), and nothing of the file was imported.

## How it works now
* The same file may have usual machinery **and** water tankers. The usual rows go in exactly as before (`checkLogImport` /
  `importLogBook`).
* A water tanker's line = **one trip**:
  | File column | Trip |
  |---|---|
  | Date, Shift | date; Night = Night, Day / Full Day = Day |
  | Challan No | challan |
  | From time / To time | Dispatch / Unload time (Excel time numbers too) |
  | Chainage From (– Chainage To) | chainage |
  | Work Done | use for |
* The trips are checked and saved by the tanker's own rule, the same as the tanker's Edit Log Book → Import Excel
  (`checkTankerImport` / `importTankerTrips` → `tankerPlan_`): challan and both times, the agency's challans, a time on another
  trip, closed month, submitted bill, active, Per Trip BOQ. A trip already saved (the same tanker, date and challan) is skipped.
  The trips of a date and shift go into that entry.
* **Everything is checked before anything is saved.** One question shows both parts: "N new entries … / N water tanker trips
  will be added (k tankers) / M already saved – skipped". A problem in either part = nothing imported, with the line and reason.
* A tanker line with more than one trip (Trips 3, or "C1, C2" in Challan No) is stopped: "one line per trip".
* A tanker line with Idle / Holiday / Breakdown is not imported, and the question says so (a tanker is entered by its trips).
* **Log Book Excel** (Export / the picked machinery's template): a tanker's entry is written **one line per trip** (as the
  Log Book list shows it), so the same file comes back with Import (its saved trips = "already in the Log Book"). The entry's
  diesel stays on its first line only.
* Help in English, Marathi, Hindi for the two new messages (FIX_RULES). `importTankerTrips` listed in PAGE_GUIDE of the Log Book.
* **No server change, no SQL.** Only `app/App.html`.

## Evidence (local rig, test data only)
* Unit tests: `timeout 300 node --test test/unit.test.js` → 71 / 71 (new "update-107").
* Browser `test/browser/tanker107.js` → 8 / 8:
  * one file with a KM tipper + a water tanker: the question said 1 new entry, 2 tanker trips to add (1 tanker), 1 already
    saved, the Idle line not imported; saved: the tipper's entry (40 km), the tanker's Day = 2 trips in one entry, the Night
    trip from Excel time numbers 21:00–21:30, no Idle entry;
  * a tanker line with 3 trips: stopped, nothing imported;
  * a trip without its Unload time: stopped with "Line 3 … enter the Unload time", and the KM row of the same file not saved;
  * the tanker's Log Book Excel = one line per trip; that file back = "already in the Log Book", nothing added; no page error.
* Old tests on the same rig: xls.js (the usual Log Book Excel in and out) 14 / 14, tanker104.js 12 / 12, tanker105.js 7 / 7.
* `node --check` on server/*.js and api/*.js passes.

## Not verified
* Not run on the live data or with his own Excel file; the file was made by the test (the app's Excel tool), not opened in
  MS Excel.
* The usual rows and the tanker trips are saved by two calls one after the other (each all-or-nothing, both checked just
  before). If the second fails between them, the first stays saved and a box says exactly which part was not imported.

## Going back
Vercel → Instant Rollback to update-106. Nothing in the database to undo.
