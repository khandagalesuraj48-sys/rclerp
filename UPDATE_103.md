# update-103 – Water tanker: many trips in one Day / Night, also on a date with an older entry (14-10-2026)

**Asked:** "water tanker entry madhe aahe tri error yetoy – ek diwsat multiple entry, day aso ki night multiple entry astat …
proper logic use kr ani he perfect banau de" (screenshots: MH-04-J-9844, 17-09-2026, Day).

**Why it failed:**
* The tanker had a Day entry made on the usual Log Book page **before** trip by trip (Trip 1, a challan, its times).
* Trip by trip then refused every new trip of that Day: "there is already a Day entry that was not made trip by trip – change
  or delete it in Edit Log Book first".
* Edit Log Book could not help either. Its "+ Add row" made a second Day row ("two entries on Day"), and a tanker's entry cannot
  be changed there.

## The fix (`app/Code.gs`, `app/App.html`; no SQL)
* **An older entry is read as its trips.**
  * Its Trip count and challan no(s) become trips.
  * With 1 trip, its Dispatch / Unload time is kept too.
  * The form lists them, marked "(entered before trip by trip)".
* **New trips of that Day / Night join that entry.** It stays ONE entry per tanker, date and shift, as before. Its Trip count,
  challans and times are worked out again.
* The older trips still count for the checks: the same challan or a time on them is refused.
* **A Full Day entry:**
  * Day trips join it.
  * Night trips: it becomes the Day shift, and the Night gets its own entry (a Full Day and a Night cannot stand together).
* **Idle / Holiday / Breakdown** on that date and shift: still refused, with a clear message: "a day without trips. If it made
  trips, delete that entry in Edit Log Book first". Help in EN / MR / HI.
* A trip of an older entry can be deleted on the form. The last trip takes the entry with it.
* **Edit Log Book, a water tanker:** "+ Add row" and "Add all missing dates" are hidden. A note says more trips go on Log Book →
  "Water tanker – trip by trip". Entries can still be deleted there. Other machinery: no change.

## Evidence
* Unit tests: 67/67 (new "update-103"). Checked there:
  * old Day + 2 trips → 1 entry of 3;
  * the old challan and time refused;
  * Night of the same day;
  * Full Day + Day, then Night;
  * delete of an old trip;
  * Idle refused;
  * help texts.
* Local rig, browser:
  * **`test/browser/tanker103.js`: 11/11**, the same case as the screenshot: an old Day, Trip 1 entry; then 2 more Day trips
    saved into ONE entry (CT-1, CT-2, CT-3, 08:00 to 11:40); Night trips; Full Day + Night; Edit Log Book without "+ Add row"
    for a tanker and with it for other machinery.
  * `tanker97.js` 16/16 (as before).
* `node --check` on server/*.js and api/*.js: passes. The page's script blocks parse.

## NOT verified
* On the live data (MH-04-J-9844).
* In the mobile app. Its water tanker screen uses the same server actions, but it was not run on a phone.

## Going back
Vercel → Instant Rollback (rclerp). Entries that took trips stay right after a rollback: they are ordinary trip-by-trip entries.
