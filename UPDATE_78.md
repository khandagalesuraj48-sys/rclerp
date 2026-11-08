# update-78 – a machinery on hours: rows by Time and rows by Hrs in the same shift (11-10-2026)

Asked by the owner on 11-10-2026, with a screen of MH-04-MN-7725 on the Log Book page: row 1 Bucket on **Time**, row 2 Breaker on
**Hrs**, the same Day – both rows red "MH-04-MN-7725 is already in another row for this date / shift". Asked whether that really
happens: "yes, in one shift it can be so – the possibility is there".

No database step, nothing to set in Vercel. Live is update-77 (`73b503a`); built and tested on the local rig only.

## Why it was refused
update-77 lets the rows of one shift of a machinery on hours have gaps, but all rows had to be measured the same way. A row by Time
and a row by Hrs were not taken as rows of one shift, so they clashed as two entries of the same date and shift.

## The rule (machinery read by the hour meter only – the same set as update-77)
* In one shift, a row may be by **Time** (From – To, with break; the meter gave no reading for that work) among the rows by **Hrs**.
  At least one row of the shift is by Hrs (a shift of rows all by Time is one Time entry with "+ time", as before).
* It stays ONE entry, on Hrs: its **Start = the first row by Hrs, its Close = the last row by Hrs**; the next day starts at that Close.
* Its hours = Close − Start − hours not worked between the rows by Hrs (update-77) **+ the hours of the rows by Time**.
  Example (his screen): Bucket 09:00 – 11:00 = 2 h + Breaker 3714.5 → 3717.5 = 3 h → **5 h** – bill (each work at its rate), diesel
  as per standard, tank, averages, print, reports.
* The hours of a row by Time are always worked out on the server from its times and break (what a page sends as hours is not used).
* Such an entry is changed row by row in Edit Log Book (the edit window and an Excel file refuse a change to it – as for a gap).
* Everything of update-77 stays (no other date changes by itself). Vehicles with a KM meter: nothing changed.

## Where
| Place | What the user sees |
|---|---|
| Log Book entry page | row 1 on Time, row 2 on Hrs (or any order): no clash; row 2 is "work 2 of this day"; one entry saved |
| Edit Log Book | the entry comes back as its rows (the Time row with its From – To and break); a row's "Measured by" may be Time; totals add up |
| Edit window | total includes "… hr of its rows by Time added"; the rows are named ("by Time 09:00–12:00"); readings locked (Edit Log Book) |
| Print | the Time row prints its From / To in the reading columns with its hours; TOTAL HOURS and the payable add both |
| Excel export | Total Hrs = Close − Start + the hours by Time |
| Help (EN / MR / HI) | Log Book and Edit Log Book; the error help of rows of a shift |

## Files changed (against live update-77, `73b503a`)
| File | Change |
|---|---|
| `app/Code.gs` | `partIsTime_`, `partTimeQ_`, `partTime_`, `partExtra_`, `partsSpecial_`, `specialOfJson_` (new); `partsGap_` (less the hours by Time); `itemPartsOf_`, `logItemWork_` (rows by Time; at least one by Hrs); `logRowsKind_`, `logRowsJoin_` (first row may be Time; Start / Close from the rows by Hrs; "new meter" on the first row by Hrs); `saveLogRowsInner_` (`join.firstIdx`); `updateLogRow_`, `saveLogBulk_`, `importLogBook_` (locks by `specialOfJson_`; messages) |
| `app/App.html` | `partIsTimeP`, `partsGapP` and helpers; Edit Log Book (`lxPartKind`, `lxRowQty`, `lxPartsProblem`, load, `lxCalc`, `lxTimePart`, save); entry page (`lgPartKind`, grouping, the gap hint); edit window; print `lbWorkRows`; Excel formula; help and error help (EN / MR / HI) |
| `test/unit.test.js` | 1 new test (56 in all); the two update-77 message checks follow the new wording |
| `test/browser/time78.js` | new |
| `UPDATE_78.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `time78.js` (real pages, his case on a Bucket / Breaker JCB of format D): row 1 Time 09:00 – 11:00 Bucket, row 2 Hrs Breaker Start 3714.5 (by itself) → 3717.5 – no red, no "already in another row"; saved as ONE entry on Hrs 3714.5 → 3717.5 = 5 h, Breaker 3 h, the Time row kept; Edit Log Book shows the two rows, To → 12:00 → 6 h, saved; edit window: 6 hr, "3 hr of its rows by Time added", readings locked; Excel "+3" (6); print: 09:00 / 12:00 3 h and 3714.5 / 3717.5 3 h, TOTAL HOURS 6, payable 3 × 1,200 + 3 × 1,500 = ₹8,100; no script error | 10 passed, 0 failed |
| unit (hand-worked): his case = 5 h, diesel 25 L; next day Start 3717.5; Edit Log Book Hrs 1.5 + Time 1.5 + Hrs 1 after 1 h not worked = 4 h (Time hours from its times, not from what was sent); a Time row of 0 h refused; all by Time refused; edit window refused; bill 9 h × ₹1,000 = ₹9,000; Bucket by Time + Breaker by Hrs = 2 × 1,200 + 3 × 1,500 = ₹6,900; a new meter ticked on the first row by Hrs after a Time row | passed (56 / 56 with net) |

**Nothing else moved** (final code): unit + net 56 / 56 · saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 · audit 36 / 0 ·
reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known line "backup is not set up" on the rig) · browser: gap77 20 · entry71 20 ·
works69 34 · item2 13 · lgrows 12 · xls 14 · time76 10 · lbpage 13 · lxlook 10 · splittime 18 · half 12 · timefmt70 6 · tm 4 · tmbill 6 ·
lbbasis 9 · viewbill 23 · billlock 17 · rate69 19 · sweep 38 · nightrow 22 · least68 9 · gstdecl 11 · tank 7 · debit 5 · dnui 8 · boq 8 ·
big 18 · fix 8 · retry 10 · hardenpage 10 – all 0 failed.

An independent review of the change found nothing serious; two small things were corrected before delivery ("new meter" could not be
ticked when the first row of the shift is by Time; one message named row 1 instead of the first row by Hrs). Left as it is (said
plainly): in Edit Log Book, if the rows by Hrs of such a shift are deleted and only a split Time row is left, it is saved as one
From – To (the hours stay right; the split is not kept – the same as any change of From / To / Break there).

## Not verified
* The live site and MH-04-MN-7725's real data; phones.

## Going back
Vercel → Instant Rollback → update-77 (`73b503a`). **Careful:** update-77 does not know rows by Time. An entry saved meanwhile with a
row by Time (2 h Time + 3 h Hrs = 5 h) becomes 3 h as soon as any entry of that machinery is saved under update-77. Correct such
entries before rolling back (e.g. the Time row as a Night entry).

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-78.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-78: machinery on hours - rows by Time and by Hrs in one shift"
git push
```
Vercel "Ready" → Update in the app → Log Book: MH-04-MN-7725, row 1 Time (From – To, Bucket), row 2 Hrs (Close, Breaker) → Save.
