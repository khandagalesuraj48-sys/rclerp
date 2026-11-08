# update-71 – the Log Book entry page takes a row for each work of one shift (10-10-2026)

Asked by the owner on 10-10-2026 after update-70 went live (`06f2e72`), with a screenshot of the **Log Book entry** page: the same
excavator twice on 01-10 Day – Bucket 1 → 2 and Breaker 3 → 4 – both rows red: "… is already in another row for this date / shift".
His words: "In Edit Log Book this can be entered, but while filling the Log Book this comes. Why did you fix it in one place
only – use the logic."

He is right: update-69 built the row-for-each-work rule in Edit Log Book only (its note said so under "not verified"). This
update puts **the same rule on the entry page**. No database step, nothing stored in a new way.

## What was built
* **Entry page.** A machinery whose BOQ has two or more hour works (or two or more KM works) – Bucket and Breaker – may stand in
  **more than one row for the same date and shift**. Add the second row, pick the same machinery and shift, press its work.
  * its **Start is the Close of the row above** (it fills by itself; lower the Close above and it follows). A Start typed away
    from it is stopped: "This work starts where the row above closed: 2 hr … Clear the Start – it fills by itself."
    (On his screenshot the second row started at 3 while the first closed at 2: the hours of a shift follow each other – a gap
    inside one shift cannot be kept.)
  * each row is **ONE work** (not Split); two rows one after the other are not the same work (Bucket – Breaker – Bucket is fine);
  * the row is marked **"work 2 of this day"**; the diesel issued in that shift, the opening diesel and the ½ tick stand on the
    first row only (the foot counts the diesel once);
  * rows of other machinery may stand between them.
* **Saved as ONE entry that keeps its rows** – exactly what Edit Log Book saves (`item_work`: `{"Breaker":2,"_parts":[…]}`), so
  Edit Log Book opens it as rows, the print gives a row for each work, and the bill pays each work at its own rate.
  The page says: "1 Log Book entry saved (2 rows are works of the same shift – …)".
* **The joining is done by the server** (`saveLogRowsInner_`), so the Excel import, which adds its new lines through the same
  function, follows the same rule: two lines of one machinery, date and shift, each with its "Work type", become one entry with
  two rows.
* **Every other machinery keeps the old rule**: a second row on the same shift is refused as before ("already in another row").
  Day + Night of one date stay two entries.
* A shift that is **already saved** is not added to from the entry page; the message now says where that is done:
  "… already saved for 01-10-2026 (Day). To add another work to this saved shift (Bucket / Breaker): Edit Log Book → "+ work in
  this shift" under that entry."
* Help: the advice for these messages and the page description of Log Book say it, in English, Marathi and Hindi.

## Files changed (against live update-70, `06f2e72`)
| File | Change |
|---|---|
| `app/Code.gs` | `logRowsKind_`, `logRowsJoin_` (new); `saveLogRowsInner_` groups the rows of one machinery + date + shift and saves each group as one entry (`joined` in its answer; the error names the row that is wrong); `logSlotHint_` wording |
| `app/App.html` | `lgPartKind`; `lgCalcAll` (rows of one shift: no clash, Start = Close above, one work a row, diesel / ½ tick on the first); `lgSum`; the toast after Save; advice rule + page description (EN / MR / HI); one CSS selector |
| `test/unit.test.js` | 1 new test (49 in all) |
| `test/browser/entry71.js` | new |
| `UPDATE_71.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit, none reached it)
| | before (the code that is live, `06f2e72`) | after |
|---|---|---|
| his screen: the excavator twice on 01-10 Day, Bucket then Breaker | both rows red "… already in another row for this date / shift"; diesel counted twice (60 L); Save refused | no red row; second row "work 2 of this day", Start 2; diesel once (30 L) |
| Save | nothing saved | ONE entry 1 → 4 = 3 hr, rows kept: Bucket 1 hr, Breaker 2 hr |
| the same entry in Edit Log Book / print / money | – | two rows / a row for each work / 1 × 1,200 + 2 × 1,500 = 4,200 |
| a Tipper (one kind of work) twice on a shift | refused | refused (unchanged) |

* `test/browser/entry71.js`: on the live code 10 checks fail (the fault) – on this code **19 passed, 0 failed**.
* Unit 49 / 49 (the new test: hand-worked figures, the six ways a row is refused – each on its own row, nothing saved –, a
  machinery without works, an already saved shift, the Excel import with two lines).
* Nothing else moved: 28 browser tests, **382 PASS, 0 FAIL** (entry71 19 · item2 13 · lgrows 12 · splittime 18 · half 12 · xls 14 ·
  nightrow 22 · works69 33 · timefmt70 6 · rate69 19 · lxlook 10 · lbpage 13 · tm 4 · tmbill 6 · lbbasis 9 · viewbill 23 ·
  billlock 17 · gstdecl 11 · tank 7 · hardenpage 10 · least68 9 · debit 5 · dnui 8 · boq 8 · big 18 · fix 8 · retry 10 · sweep 38);
  server suites: saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 · audit 36 / 0 · reg 11 / 0 · restore-drill 7 / 0 ·
  dn 13 / 1 (the known line "backup is not set up" on the rig).

Said plainly:
* The first run of the new browser test failed in 4 checks: the test had not pressed the work on the first row (the entry page
  asks for it: "Pick the work of this entry"). That was the test; the page was right. Corrected test: 19 / 19.
* One comparison server of the rig (port 3002, needed by `nightrow.js` only) had stopped between two runs; that test was run
  again with the server up: 22 / 22.

## Not verified
* The live site, the live data, a phone (his screenshot is the narrow layout; the rig test ran on a wide screen – the same rows
  and the same code draw both).
* The Excel import with two lines of one shift was checked at the server (unit test), not by uploading a real file on the page.
* A machinery read in KM + Hrs with rows for its hour works on the entry page: built (the other meter closes on the last row),
  not run in the browser.

## Not built (said, not done – not asked)
* Adding a work **from the entry page to a shift that is already saved** (he saved the Bucket row yesterday and types the
  Breaker row today): the page refuses it and points to Edit Log Book → "+ work in this shift", where it is done.
* The small edit window (Log Book list → Edit) still edits the entry as a whole (Split), as before.
* Rows for works measured by clock Time or by Trips (as in update-69).

## Going back
Vercel → Instant Rollback → update-70 (`06f2e72`). Entries saved by this update are stored exactly like those Edit Log Book
saves since update-69 – update-70 reads, shows, prints and bills them.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-71.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-71: Log Book entry takes a row for each work of one shift"
git push
```
Vercel "Ready" → press **Update** in the app → Log Book entry: the same machinery in two rows of one shift.
