# update-76 – an hours machinery may have a day on Time (its hour meter gave no reading) (11-10-2026)

Asked by the owner on 11-10-2026: "the JCB / excavators that we set on HOURS sometimes suddenly do not give the hour reading – they
give the timing instead; so in one month one machine has hours and time, and entering it is a problem. Fix it with logic."

No database step, nothing to set in Vercel. Live is update-75 (`93a3597`); built and tested on the local rig only.

## Why it was a problem
A machinery's Log Book format decides how its entries are measured. Formats D and E (the hours formats) allowed ONLY "Hrs", and
the format overrides the Asset Master ticks – so on a day the hour meter gave no reading, "Time" could not be picked at all (not on
the entry page, not in Edit Log Book, and an Excel row by Time was refused: "does not work on Time").

## The rule (one rule, in every place)
**A machinery measured by hours (Hrs or KM + Hrs – by its format or its ticks) may also have a day on Time (clock time From – To).**
* Its usual way stays **Hrs**: the entry page picks Hrs by itself as before; Time is picked only for that day. After a Time day
  the next day is on Hrs again (not Time).
* The hours of the Time day count as **hours everywhere**: the bill per hour (same rate), the diesel average (L/hr), the diesel
  "as per standard", the tank, the Log Book print's TOTAL HOURS, the reports, the cost sheet. (All of these already added up the
  hours of every entry – nothing in them had to change.)
* The **next hours day starts at the last hour reading** before the Time day (a Time day has no reading).
* A way the machinery really does not have (e.g. KM for a JCB) is still refused.

Where it applies: Log Book entry page · Edit Log Book (a new row may be on Time) · the small edit window · Excel export (From /
To time columns, "Measured by" list Hrs / Time, a blank row filled with Hrs) and Excel import · the print (format D/E: the Time
day prints its From and To in the hour columns and its hours) · the bill · the reports.

## Found on the way and corrected (they hurt exactly such a month)
* **Log Book list – period total:** when the period started on a Time day, the average was blank (it took the way of the first
  entry), and the opening / closing readings were blank when the period started / ended on a Time day → the readings now come
  from the first / last entry that HAS a reading; the average from the first entry that has one.
* **Monthly Diesel & Average report:** the same for its Opening / Closing Hrs and their dates.
* **Edit window:** "the next entry" (whose Start follows a changed Close) was the very next entry – a Time day – so it showed a
  wrong "below zero" warning → now the next entry that reads the meter.
* **Edit Log Book** and **deleting an entry:** the hours entry AFTER a Time day did not follow a lowered Close / a deleted
  entry (only raising worked) → now the next entry that reads the meter follows.

## Files changed (against live update-75, `93a3597`)
| File | Change |
|---|---|
| `app/Code.gs` | `timeX_` / `withTime_` (the rule); the Activity Log line of several entries (no line ending in a space); `buildMaster_` `modes` + `modesX`; `logModeFor_`; `getLogRowPrefill_` (the usual way after a Time day); `getLogBookList_` and `addReadings_` (readings / average past a Time day); `getLogEntry_` (the next entry that reads the meter); `deleteLogRow_` and `saveLogBulk_` (the next reader follows past a Time day) |
| `app/App.html` | `modesBase` / `modesOf` / `modesX` / `modesMain` (the same rule), `wayAuto` (Hrs by itself), the way buttons of a format machinery, the tip of Time, Edit Log Book's new row, the Excel blank-row way; Log Book and Edit Log Book help (EN / MR / HI) |
| `test/unit.test.js` | 1 new test (53 in all); the update-70 test changed on purpose: it said a NEW Time entry of an hours-format machinery is refused – that is exactly what is allowed now |
| `test/browser/time76.js` | new |
| `test/browser/xls.js` | an hours machinery's Excel has From / To and Time now (changed on purpose) |
| `test/sheets-standin.js`, `test/gateway-standin.js` | (rig only) read the data as UTF-8 – a letter of several bytes is not broken |
| `UPDATE_76.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `time76.js` (real pages): the JCB on format D – "Hrs" picked by itself, "Time" can be picked (with its tip); 01-10 Hrs 100 → 105 saved; 02-10 Time 09:00 – 13:00 → saved as 4 hours without a reading; 03-10 back on Hrs by itself, Start 105; Edit Log Book offers Hrs / Time (usual Hrs) and shows the Time day with its times; Excel: From / To columns, "Measured by" Hrs / Time / …, a blank row = Hrs, a Time row not refused; the print (format D): 09:00 and 13:00 in the hour columns, 4 hours, TOTAL HOURS 14, payable ₹14,000; no script error | 10 passed, 0 failed |
| unit: format D → ways Hrs + Time (Time the extra); a Time day saved, KM still refused; next Start 105 and the usual way Hrs; a Start below the last Close still refused past the Time day; the period summary (16.5 h, readings 100 / 110 although the period ends on a Time day; average worked out when it starts on one); Monthly report readings and dates; the edit window's "next entry" = the next reader; Edit Log Book: a lowered Close moves the hours entry after the Time day; delete: the same; the bill per hour 16.5 h × ₹1,000 = ₹16,500 | 1 test, passed (53 / 53) |

**Nothing else moved** (on the final code unless said): unit 53 / 53 · saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 ·
audit 36 / 0 · reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known line "backup is not set up" on the rig) · browser: entry71 19 ·
item2 13 · lgrows 12 · splittime 18 · half 12 · works69 33 · timefmt70 6 · lxlook 10 · lbpage 13 · tm 4 · tmbill 6 · lbbasis 9 · viewbill 23 ·
billlock 17 · rate69 19 · sweep 38 · least68 9 · gstdecl 11 · tank 7 · debit 5 · dnui 8 · boq 8 · big 18 · fix 8 · retry 10 · hardenpage 10 ·
nightrow 22 – all 0 failed · xls 14 / 0 (see below).

Said plainly:
* `xls.js` failed 2 checks: an hours machinery's Excel now ALSO has From / To time columns and "Time" in "Measured by" (so a day
  without a reading can be filled from Excel too). That is the new rule – the test was changed on purpose (and reads "Work type" by
  its column name now); then 14 / 0.
* `restore-drill.js` failed once: the backup stand-in of the RIG (`test/sheets-standin.js`, and the same in
  `test/gateway-standin.js`) joined incoming data piece by piece and broke a "–" that fell between two pieces. Real Google Sheets
  reads it whole – the app was not wrong. Corrected in the stand-ins (they read UTF-8 now); then 7 / 0.
* While looking, a small thing of the app itself: the Activity Log line of an entry without a Close (Time / Trip / Day) ended in
  "– close " with a space (the backup Sheet trims it, so a restore differed by that space). It now says "– Time 09:00–13:00" (or the
  way) and never ends in a space.
* The second, third and fourth runs of the long list ran before these last two corrections (Activity Log line, stand-ins) –
  `time76`, `xls`, `restore-drill` and `backup` were run again after them.

## Not verified
* The live site and his real JCB data. An already-saved month is not changed by this update (nothing is rewritten); only what is
  shown / allowed from now on.

## Going back
Vercel → Instant Rollback → update-75 (`93a3597`). Time days saved meanwhile stay valid entries (update-75 shows and prints a
saved Time day as it is; it only does not offer Time for a NEW entry of such a machinery).

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-76.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-76: an hours machinery may have a day on Time when its hour meter gives no reading"
git push
```
Vercel "Ready" → Update in the app → Log Book: pick the JCB → "Hrs" is picked; on a day without a reading press **Time** and type
From – To.
