# update-70 – Edit Log Book shows an entry the way it was saved (10-10-2026)

Asked by the owner on 10-10-2026, right after update-69 went live (two screenshots of one JCB that works on "Hrs, Time"):
"the Log Book shows the data, but Edit Log Book is blank – fix it."

## What was wrong
* The entries of that JCB were made **by clock Time** (09:00 – 13:00, 14:00 – 18:00 …). Later its **Log Book Format** was set to
  one that is read from the hour meter (format E – the one with Challan No and Particular).
* Edit Log Book drew every row in the way of the *format* (Hrs) instead of the way the entry was *saved* (Time): Start / Close
  Hrs empty, Total "–", every row red, Save off. The data itself was never touched – the Log Book list and the print read
  it correctly.
* **This was not caused by update-69.** The same screen was reproduced on the rig with the update-68 code (GitHub
  `0c18421`) – same columns, same empty red rows. It shows for any machinery whose format was changed to another way of
  measuring after entries were made.

## What was changed (two places, nothing else)
| File | Change |
|---|---|
| `app/App.html` – `lxLoad` | a saved entry keeps its own way (KM / Hrs / KM + Hrs / Time / Trip / Day) when the format does not list it; before it fell back to the first way of the format |
| `app/App.html` – `lxRender` | "Measured by" of such a row offers the way it was saved in, beside the ways of the format |
| `app/Code.gs` – `saveLogBulk_` | an entry that is already saved may be saved again in the way it has (before: "does not work on "Time""). A **new** entry, or a change to another way, is checked against the machinery as before |
| `test/unit.test.js` | 1 new test (48 in all) |
| `test/browser/timefmt70.js` | new |

No database step. No change to the entry page, the bill, the print, the small edit window (it already used the saved way).
A **new** row for such a machinery follows its format, as before (format E → Hrs).

## Evidence (local rig; every command with a time limit, none reached it)
| | before (update-68 code and update-69 code) | after |
|---|---|---|
| the grid of that JCB (3 entries by Time, format E) | 3 rows "Hrs", empty, red; "3 row(s) in red need a correct Close"; Save off | 3 rows "Time" with their times and split timing, 6.5 / 7 / 2 hr, total 15.5 hr; "No changes yet" |
| a description corrected and saved | not possible | saved; way, hours and split timing unchanged |
| a To time corrected (13:00 → 14:00) and saved | not possible | saved: 3 hr, still by Time |
| the server, asked to save such an entry | refuses: "does not work on "Time"" | saves it; still refuses a NEW Time entry and a change to a way the machinery does not have |

* `test/browser/timefmt70.js`: on the update-68 code 2 passed, 1 failed (the grid check – that is the fault); on this code 6 passed, 0 failed.
* The new unit test fails on the code that is live (`fc3187e`) and passes here. Unit 48 / 48.
* Nothing else moved – 19 browser tests, 295 PASS, 0 FAIL (timefmt70 6 · nightrow 22 · lxlook 10 · works69 33 · splittime 18 ·
  half 12 · item2 13 · lgrows 12 · billlock 17 · lbpage 13 · xls 14 · rate69 19 · tm 4 · tmbill 6 · lbbasis 9 · viewbill 23 ·
  sweep 38 · big 18 · fix 8); server suites: saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 · audit 36 / 0 ·
  reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known line "backup is not set up" on the rig).

## Not verified
* The live site and the live data: his machinery was not looked at (the shell cannot reach it). The cause is read from his two
  screenshots (columns of format E, "Works on Hrs, Time", entries by Time in the list) and reproduced with the same set-up.
* The browser tests not listed above were not run again for this two-place change (they ran on update-69 the same day).
* How the PRINT in format E (columns for hour-meter readings) shows entries made by clock Time was not looked at and not
  changed – not asked. The formats made for clock time are F and G (Master → Log Book Format).

## Going back
Vercel → Instant Rollback → update-69 (`fc3187e`). Nothing is stored differently by this update.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-70.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-70: Edit Log Book shows an entry the way it was saved"
git push
```
Vercel "Ready" → press **Update** in the app → Edit Log Book of that JCB.
