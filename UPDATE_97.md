# update-97 – Water tanker, trip by trip (Log Book Format I) (13-10-2026)

Asked by the owner on 13-10-2026:
* a Log Book format only for water tankers;
* one tanker makes many trips a day, entered as they come, with a Day and a Night shift;
* the same challan or the same time twice → an alert, nothing saved;
* his headings: Sr No, Date, Name of Agency, Tanker No, Chalan No, Dispatch Time, Unload Time, Trip, Chainage No, Use For;
* at the bottom: total trips, day trips, night trips and the amount as per the BOQ, so the tanker can be billed.

His choices (13-10-2026):
* challan duplicate = **the same agency's** challan no;
* **a Night trip has its own rate**;
* **one line = 1 trip**.

## What changed
| Where | What |
|---|---|
| Master → Log Book Format | New **Format I – Water tanker (trip by trip)**. A machinery becomes a water tanker by being set to Format I. |
| Log Book → entry type | New **"Water tanker – trip by trip"** form. On top: Date, Shift (Day / Night) and Tanker No. Then one line per trip: Challan No, Dispatch Time, Unload Time, Trip (= 1), Chainage No and Use For. "+ Add trip" adds a line; "Save trips" saves them. Below the lines: the saved trips of that date, both shifts, each with ×, and the Day / Night / Total trips. |
| Trips later the same day | Added to the same Day (or Night) entry. The Log Book keeps one entry per tanker, date and shift, so the bill, the diesel and the locks work as before. The trips are kept inside that entry (Item Work → `_trips`). Its Trip is the number of trips; its challan, from–to, chainage and work are filled from the trips. |
| Duplicates (refused, nothing of that save is kept) | A challan no already saved for **any tanker of the same agency, on any date** (another agency may use the same number). The same challan twice in one save. A Dispatch–Unload time that overlaps another trip of the tanker on that date, in either shift. A Night trip after midnight counts as the next morning. A time that only touches another trip is allowed (08:45 → next trip at 08:45). Also refused: Dispatch = Unload, Unload more than 12 hours after Dispatch, an empty challan or time. The page checks first; the server checks again, and only the server can see the agency's other tankers. |
| Vendor BOQ, a Per Trip line | Optional **Night trip ₹** box. Empty = a Night trip is paid at the same rate as by day. **Existing BOQs are unchanged.** |
| The bill (server, Machinery Billing page, Log Book print) | Per Trip with a Night rate: Day trips × rate + Night trips × Night rate, as two lines ("Trips", "Night trips"). Without a Night rate: exactly as before. |
| The print of a Format I tanker | **WATER TANKER REPORT**: his headings plus Shift, one line per trip. Bottom left: TOTAL TRIPS, DAY TRIPS, NIGHT TRIPS. Right: the rate (Day and Night), payable, TDS, GST and net, as in every format. "View format" shows a sample. |
| Other ways into the Log Book | The usual entry rows, the Excel import and the older entry ways refuse a water tanker and point to its form. The usual rows say so as soon as the tanker is typed. Edit Log Book can only **delete** a tanker's whole entry; the edit window refuses it. Trips are changed on their own form. |
| Help | Errors in EN/MR/HI: FIX_RULES rules for the tanker, duplicate and Night-rate messages. Page guide: the Log Book page lists `saveTankerTrips` and `deleteTankerTrip`. |

**No SQL.** Every column used is already there: `item_work`, `trip`, `challan_no`, `start_time`, `end_time`, `chainage_no` and `work_done` in `log_book`, and the BOQ lines (JSON). Once merged, it works for **VTR and 18B** alike (one app for every site).

## Evidence (local rig – never live)
* **Unit (new test, in memory):**
  * many trips a day, Day and Night (a trip after midnight included);
  * every kind of duplicate refused, and the save leaves nothing behind;
  * another agency's same challan allowed;
  * a trip deleted; the last trip takes its entry with it;
  * the usual save, Excel, Edit Log Book and the edit window refused;
  * the BOQ Night rate (0 refused, not kept on a Monthly line);
  * the bill 3 × 500 + 2 × 700, and **page = server**;
  * a tanker without a Night rate billed at the day rate.

  Unit 62 / 62.
* **`test/browser/tanker97.js` 16 / 16:**
  * the form;
  * two trips, then one more later the same day: one entry with Trip 3;
  * the same challan, an overlapping time, and the agency's challan on its other tanker: each refused, nothing saved;
  * a Night trip, with the totals;
  * a trip deleted;
  * the usual rows point to the form;
  * the print: WATER TANKER REPORT with his headings, 3 lines, TOTAL 3 / DAY 2 / NIGHT 1, payable ₹1,700;
  * a phone;
  * no script error.
* **Unchanged (rig):**
  * Log Book browser tests: lbbasis 9, timefmt70 6, time76 10, time78 10, works69 34, lxlook 10.
  * Portal and site tests: portal91 browser 21, portal91api 40, portal94api 17, site90api 75, backup 30.
  * site89: 38. It failed once on `web.cache` straight after other tests, then passed alone. This is the same pre-existing flake as in updates 95 and 96.

## Not verified
* Not run on live.
* Not tried on a real phone. The phone check is a 412-px Chromium.
* The Night trip box in the BOQ form was not clicked through in a browser; its markup, its reading and the server are tested.
* "View format" for Format I was not opened in a browser.

## Going back
Vercel → Instant Rollback to update-96. A tanker's entries stay; their trips stay in Item Work, and the older version shows them as entries with a trip count.
