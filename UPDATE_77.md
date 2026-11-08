# update-77 – a machinery on hours: several rows in one shift with hours not worked between them; an edit never changes another date (11-10-2026)

Asked by the owner on 11-10-2026: "the same machinery, the same day, Breaker worked two times – if the readings are different it must
be accepted. When I edit the entry of the 3rd, the 2nd must not change, and the 4th must not change. This is only for machinery."
His answers to the three questions asked first:
1. The hours between the two rows are **not counted** (Breaker 100 → 102 and 110 → 113 = 5 hours; 102 → 110 is in no bill and no diesel).
2. When an edit makes a Close higher than the Start of the next entry: **the next entry is not changed – the save stops with the reason.**
3. **Only machinery on hours** (JCB, excavator, breaker). Vehicles on KM stay as they are.

No database step, nothing to set in Vercel. Live is update-76 (`919c917`); built and tested on the local rig only.

## Why it was a problem
* A second row on the same date and shift was accepted only for a machinery whose BOQ has two or more hour works (Bucket and
  Breaker), only when the rows followed each other exactly (each row starting at the Close above), and never the same work twice.
  Any other machinery got "two entries on Full Day – make one Day and the other Night".
* Changing a Close (Edit Log Book, the edit window), deleting an entry, adding an entry between two others or importing Excel moved
  the Start of the next entry by itself.

## The rule – for a machinery read by the hour meter only (no KM meter)
* **Several rows in one shift**, whatever its BOQ – the same work twice too. A row may start at the Close of the row above **or
  higher**; the hours in between are kept on the row as "hours not worked" and are **not counted**: the entry's hours = its Close −
  its Start − those hours. That is what the bill (per hour), the diesel as per standard, the tank, the averages, the print and the
  reports use (they all use the entry's hours). A row starting **below** the Close above is still refused.
  It stays ONE entry (one machinery + date + shift) that keeps its rows, as for the works of update-69 / 71.
* **No other date changes by itself**: not when a Close is changed (Edit Log Book, edit window), not when an entry is deleted, not
  when an entry is put in between, not by an Excel import. A Close higher than the Start of the next entry is refused with the
  reason ("… is more than the Start Hrs 116 of the entry of 03-07-2026 – that entry is not changed by itself. Correct one of them;
  nothing was saved."). A Start below the Close before it is refused as before. An entry with "new meter" starts a new chain (the
  entry before it is not held against its Start).
* Rows of the SAME shift in Edit Log Book: the next row follows a changed Close only while it starts exactly at that Close (as
  before); a row typed higher keeps its Start. Deleting a row of a shift leaves the other rows as they are.
* **Vehicles with a KM meter (KM, KM + Hrs): nothing changed.**

## Where (one rule, every place)
| Place | What the user sees |
|---|---|
| Log Book entry page | a second row of the same machinery, date and shift; its Start is proposed at the Close above and may be typed higher – "8 hr not worked between the rows – not counted"; below = red. Saved as one entry. |
| Edit Log Book | "+ work in this shift" for such a machinery (under its Close when there is no item BOQ); a gap row says "… not worked between the rows"; a Close above the Start of the next entry turns that row red; nothing else moves; the save box says "the entry after is not changed – its Start stays …" |
| Edit window (Log Book list → Edit) | the total without the hours not worked; a Close above the next Start is shown in red; "the next entry keeps its Start …". An entry with hours not worked between its rows: its Start / Close and texts are locked here – changed row by row in Edit Log Book. |
| Excel export | Total Hrs of such an entry = Close − Start − the hours not worked |
| Excel import | no Start is raised by itself; a Close above the next Start is refused; an entry with hours not worked between its rows is changed in Edit Log Book, not by a file (the same file brought back unchanged is fine) |
| Print | the entry printed as its rows (100 → 102, 108 → 113); TOTAL HOURS without the gap |
| Bill, diesel, tank, reports | the entry's hours (without the gap) – nothing in them had to change |
| Help (English / Marathi / Hindi) | Log Book and Edit Log Book descriptions; two error helps |

## Files changed (against live update-76, `919c917`)
| File | Change |
|---|---|
| `app/Code.gs` | `hrsOnly_`, `partsGap_`, `gapOfJson_` (new); `itemPartsOf_` (rows without a work, "g"); `logItemWork_` (rows of a machinery without separate works, the same work twice, "g"); `logCalc_` (the hours not worked); `recalcChain_` (no Start raised; hours less the gap); `logRowsKind_` / `logRowsJoin_` (entry page rows with a gap); `saveLogRowsInner_` (an entry put in between is checked against the next Start); `linkAfterInsert_`, `deleteLogRow_` (no other entry changed); `saveLogBulk_` (no entry after changed – refused instead; rows kept when not sent); `updateLogRow_` (the same; an entry with a gap is changed in Edit Log Book); `importLogBook_` (the same); `logEntriesOf_`, `logItemsOut_`, `getLogEditData_` (`nextHr`, `hrsOnly`), `getLogEntry_` (its rows) |
| `app/App.html` | `hrsOnlyM`, `partsGapP`; Edit Log Book (`lxHO`, `lxPlain`, `lxMoreBtn`, `lxPartKind`, `lxPartsProblem`, load with "g", `lxCalc`, typing, `lxPlace`, `lxRemove`, save); entry page (`lgPartKind`, `lgCalcAll`); edit window (`leNote`, `openLogEdit`, its save box); print `lbWorkRows`; Excel `lbColsFor` / `lbSheet`; FIX_RULES (2); PAGE_GUIDE log / logedit (EN / MR / HI) |
| `test/unit.test.js` | 1 new test (55 in all); 3 older tests changed on purpose (see below) |
| `test/browser/gap77.js` | new |
| `test/browser/entry71.js`, `test/browser/works69.js` | changed on purpose (see below) |
| `UPDATE_77.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `gap77.js` (real pages): entry page – second row of the Breaker proposed at 102, 101 red, 110 → 113 accepted ("8 hr not worked … not counted"), saved as ONE entry 100 → 113 = **5 h**; next day Start 113; Edit Log Book – the rows come back, Close of the 2nd → 117: the 3rd **not moved** (red, Save off), → 115.5: saved, 3rd still 116; the 2nd alone in the grid → 117: red "Close cannot be more than 116 …"; "+ work in this shift" without an item BOQ; edit window – gap entry locked with its rows, Close 118 red, 115 saved ("the next entry keeps its Start 116"); Excel Total Hrs formula "−6" (7 h) and "−0.5" (2.5 h); print: two rows, TOTAL HOURS 13.5, payable ₹13,500; no script error | 20 passed, 0 failed |
| unit (hand-worked): 100 → 102 + 110 → 113 = 5 h, diesel 25 L; a row below the Close refused; Edit Log Book / edit window: Close above the next Start refused, nothing changed; lowered Close – next entry not moved; three rows 2 + 1 + 3 = 6 h; rows that do not fit refused; Excel change of a gap entry refused, the same file unchanged accepted; delete – next entry not moved; an entry put in between checked against the next Start; bill 12 h × ₹1,000 = ₹12,000; Breaker twice on a Bucket / Breaker machinery = 5 h × ₹1,500; rows sent as one without "joined" keep their rows, joined on purpose → ordinary entry; new meter = new chain; a KM vehicle: still one row a shift, its next entry still follows | 1 test, passed (55 / 55 with net) |

**Nothing else moved** (all on the final code): unit + net 55 / 55 · saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 ·
audit 36 / 0 · reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known line "backup is not set up" on the rig) · browser: entry71 20 ·
works69 34 · item2 13 · lgrows 12 · xls 14 · time76 10 · lbpage 13 · lxlook 10 · splittime 18 · half 12 · timefmt70 6 · tm 4 · tmbill 6 ·
lbbasis 9 · viewbill 23 · billlock 17 · rate69 19 · nightrow 22 · sweep 38 · least68 9 · gstdecl 11 · tank 7 · debit 5 · dnui 8 · boq 8 ·
big 18 · fix 8 · retry 10 · hardenpage 10 – all 0 failed.

Said plainly – tests changed ON PURPOSE (they checked exactly what he asked to change; all for a JCB on hours):
* unit update-71 test: "row 2 starts at 9 but the row before closed at 8" and "two rows one after the other are both Bucket" were
  refusals – now allowed; replaced by "a row starting below the Close" (still refused).
* unit update-69 test: "two rows both Bucket" refused → replaced by a row with a negative gap (still refused).
* unit update-76 test: "the 3rd follows the new Close of the 1st" and "the deleted 1st's Start is taken over" – now the 3rd keeps its
  Start; the bill of that month is 11.5 h (was 16.5 h, because the 3rd no longer stretches).
* `entry71.js`: the same work twice and a Start typed above the Close above – now accepted (a Start below is still red).
* `works69.js`: the same; and deleting the middle row of a shift leaves the row after it as it was ("0.5 hr not worked between the rows").

Found by an independent review of the change and corrected before delivery: an unchanged Excel file of such an entry on a Bucket /
Breaker machinery was refused; an entry before a "new meter" entry was refused; Edit Log Book had no "+ work in this shift" for a
machinery without an item BOQ; a gap entry sent as one row could lose its gap; a single typed hour item on such rows lost its hours;
the edit window's save box still said "the next entry will start at the new Close".

Also changed by this update (seen while building it): the edit window now receives the rows of a shift (`getLogEntry_`), so the
note "This shift has a row for each work …" that update-69 wrote for it now really shows – also for a Bucket / Breaker machinery.

## Not verified
* The live site and his real data. Entries already saved are not rewritten by this update; but from now on, for a machinery on hours,
  an edit no longer moves the next entry (a Close above it is refused) – that is the asked change.
* Phones (the rows were tested on a 1920-wide screen).

## Going back
Vercel → Instant Rollback → update-76 (`919c917`). **Careful:** update-76 does not know "hours not worked between rows". An entry saved
meanwhile with such a gap (100 → 102, 110 → 113 = 5 h) becomes Close − Start (13 h) as soon as ANY entry of that machinery is saved
under update-76. Before rolling back, correct those entries (one row each, or the second time as a Night entry).

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-77.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-77: machinery on hours - several rows in a shift with a gap; an edit never changes another date"
git push
```
Vercel "Ready" → Update in the app → Log Book: the Breaker, a second row for the same date and shift → type its own Start and Close.
