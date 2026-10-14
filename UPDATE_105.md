# update-105 – Water tanker: each trip its own line, with Edit / Delete (14-10-2026)

**Asked** (screenshots of MH-04-J-9844, 17-09-2026): "ekach date madhe entry keli multiple tr he ekatch ale aahe – pratek entry
seprate asawi; ani edit delete pn asaw log book entry water tanker chi kartana; ani edit log book madhe proper logic".

**What he saw:** the Log Book list showed one line for the day: "2 trips, Challan 123, 18522" with one Edit / Delete. The trip
form's saved trips could only be deleted, not changed.

## The fix (`app/App.html`, `app/Code.gs`; no SQL)
* **Log Book list:** a water tanker's entry shows **one line per trip**:
  * Dispatch–Unload, "Trip n", its challan, chainage and use for;
  * its own **Edit** and **Delete**;
  * the entry's diesel on its first line;
  * a trip of an entry made before trip by trip is marked.

  The other machinery: as before.
* **Edit** (in the list, or on the trip form's saved trips): the trip goes into the line above with a note "Changing trip n of
  Day – challan X". Its challan, times, chainage, use for, and also its shift can be changed. **Save change** saves that one
  trip (`updateTankerTrip_`), checked like a new trip by the same rule as Edit Log Book (`tankerPlan_`):
  * challan and both times;
  * the agency's challans;
  * a time on another trip;
  * a closed month, a bill.
  A trip moved to the Night gets its Night entry.
* **Delete** in the list: only that trip goes. The last trip takes its entry with it.
* **Edit Log Book:** a water tanker opens as its trips, one row each, with + Add row and Excel (update-104, live since 12:28).
* What is kept did not change: ONE Log Book entry per tanker, date and shift, with its trips inside. The bill, the diesel and
  the prints stay as they are.

## Evidence
* Unit tests: 69/69. New "update-105" covers:
  * his case (an older Day entry 18522 + trip 123);
  * a trip changed, the older trip changed, a trip moved to the Night;
  * refused: another tanker's challan, a missing time, a time on another trip, a trip changed by someone else;
  * the page's per-trip lines, the same as the server reads them.
* Local rig, browser:
  * **`tanker105.js` 7/7:** the list shows Trip 1 / Trip 2 with their own Edit / Delete; Edit from the list opens the form ready
    to change and Save change keeps one entry; Edit on the form moves the older trip to the Night; Delete from the list removes
    one trip.
  * `tanker104.js` 12/12, `tanker103.js` 11/11, `tanker97.js` 16/16 (as before).
* `node --check` on server/*.js and api/*.js passes; the page's script blocks parse.

## NOT verified
* On the live data.
* The phone: its part (rcl-mobile 3.1.1) is built and tested by GitHub, not run on a real phone.

## Going back
Vercel → Instant Rollback (rclerp). Nothing in the stored data changes shape.
