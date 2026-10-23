# update-146 – Every machinery: a row for each work of a shift (KM, Hrs, KM + Hrs, trips, the day) (23-10-2026)

**Asked (23-10-2026, his screen of MH-46-B-0651):** "ha error mala kuthech nko aahe bhai – sagle machinery la ha rule ghe; duplicate
cha data same entry hot asel tr duplicate hoil; yar mi ata date same, same shift madhe weg wegle timing, weg wegle work ghetoy tri
error yetoy – logic samjun ghe ani he proper fix kr". update-144 did it for rows by Time (any machinery); this update does it for the
other ways: rows by the readings of a machinery that is not on hours only, by trips and by the day.

## What was wrong
* A second row of the same machinery, date and shift was refused ("two entries on Day", "already in another row for this date /
  shift", "already saved for …") unless the machinery was on hours only, every row was by Time, or its BOQ had two works of that kind.
  A tipper on KM, a transit mixer on KM + Hrs, a tipper by trips, a machinery by the day – two works in one shift were refused.

## What changes
* **Every machinery, rows of one shift by its readings, by trips or by the day are ONE entry that keeps its rows** (`logRowsKind_`
  → 'km' / 'hr' / 'trip' / 'day'). The Log Book still has one entry per machinery + date + shift (its key, diesel, tank and bill).
  * **By KM, by Hrs (a machinery with a KM meter), in KM + Hrs:** the rows follow each other – row 2 starts where row 1 closed (the
    entry is Start of the first row → Close of the last). **A gap is refused with the way out**: "row 2 … starts at 1080 KM but the row
    before it closed at 1050 – every row must start where the row before it closed (a vehicle's KM follow each other: the 30 KM between
    are part of a row – start it at 1050)". A machinery on hours only keeps update-77 (the hours between are not counted).
  * **In KM + Hrs:** each row keeps its own hours too (`o` in the row) – opened again, printed and read back as its own KM and hours.
  * **By trips:** each row its trips, challan, chainage and work; the entry's trips are their sum (5 + 3 = 8); with in / out times
    (Format H) the rows go in the order of the day and two rows at the same time are refused.
  * **By the day:** the works of that one day; the day is paid once.
  * Where the BOQ has two or more works of that kind (Loaded / Empty), each row is ONE work, as before.
* **The same data twice is a duplicate, refused:** the same Start and Close; by trips / by the day the same trips, challan, chainage,
  work and remark (and in / out times that meet) – in one save, in Edit Log Book, and when added to a saved shift (update-143).
* **The same work may come again in a row of its own** (its own readings / challan): "two rows one after the other are both …" and
  "same work as the row above" are gone (server, Edit Log Book, entry page, phone).
* **Rows that cannot stand together say why** (never "two entries on Day"): "Idle (Holiday / Breakdown) is the whole shift – it cannot
  be one of two rows of the same shift …", "a row without a meter reading (No reading) cannot be one of two rows …", "the rows of one
  shift must be measured the same way (row 1 by KM, row 2 by Time) …" (`logRowsWhyNot_`, `lgWhyNot`, `lxPartsProblem`).
* **Where:** the Log Book entry page (two rows of one shift, "work 2 of this day"), Edit Log Book ("+ work in this shift" now under the
  row's own Close / trips / day too, not only the item column; what to type is said), a work added to a saved shift (update-143),
  the edit window (its rows named; changing a reading / the trips / a text there joins them into one row), the print (a row for each
  work, KM + Hrs with each row's hours, trips with their in / out time), the phone app (App 3.31.2: its Edit Log Book, print, entry
  form). Stale rows go: an entry whose total was changed without its rows (edit window, Edit Log Book) keeps no rows that no longer
  add up.
* **Help (English / मराठी / हिंदी):** a new rule (a day without work beside a work); the rules of the rows of a shift and of a
  duplicate say the new rules; the page guides of the Log Book and Edit Log Book. The Marathi / Hindi words of the new messages.
* No database step, no setting.

## Evidence (local test copy only)
* `node --test test/unit.test.js` **104 / 104** – new checks "update-146" and "update-146 (after the review)" (in the server code): a tipper on KM – two works of 02-09 =
  ONE entry 1100 → 1220 (rows 50 + 70 km, their challans, chainage, work), bill 120 × 40, read back by Edit Log Book; a gap refused
  with the way out; the same row twice refused; a work added to the saved shift (the prefill offers it, kind km), the same work again
  refused; Edit Log Book's save of the rows kept, rows that do not add up refused; a tipper with LOADED / EMPTY: LOADED twice in a row
  accepted, bill 80 × 50 + 20 × 30; a transit mixer in KM + Hrs: each row's hours kept (3, 4), read back as its rows, an hours gap
  refused; a loader with a KM meter by Hrs: rows follow each other; rows in different ways / Idle beside a work: why; a tipper by trips:
  5 + 3 = 8 trips, bill 8 × 600, duplicate refused, a row without trips refused, added to the saved shift (10 trips, bill 6,000), in /
  out times at the same time refused and in the order of the day; the edit window keeps the rows when nothing changes and drops them
  when the trips change; Edit Log Book's save of trips; a machinery by the day: two works = one day, bill one day, duplicate refused.
  After the review: SHIFTING typed 10 + 20 on a Hydra's rows kept on each row and on the entry (bill 7 × 1,000 + 30 × 50), read back as
  10 / 20, kept through an Edit Log Book save; a tipper's rows with Work type CARTING – 40 + 60 KM to CARTING (bill 4,000, before ₹0); a
  Work type of another BOQ refused; trips SOIL 5 + SOIL 3 (Work type) = 8 × 600 (before 8 × 400), SOIL 5 typed + 3 (rest MURUM) =
  5 × 600 + 3 × 400, read back as SOIL / MURUM, a split refused, a third work added; KM + Hrs rows of 0 hours with other KM are two works,
  the same both meters a duplicate, a new work beside old rows of 0 hours accepted; rows by the day with trips 4 + 3 = 7, each row its
  own, Work type DAY-B picks the day item; an entry approved in verification added to its saved shift (without the mark otherwise:
  refused as before).
  The update-71 and update-143 checks changed where they held the OLD rule (the tipper's second row is now its next work; a work
  added to 02-06 that passes the Start of 03-06 is refused; the Hydra's rows keep their KM).
* `test/browser/rows146.js` **22 / 22** – the real pages: Edit Log Book (a tipper on KM: "+ work in this shift", its Close, a gap red,
  saved as one entry and opened again as its rows; by trips: a duplicate red, saved 8 trips, opened again; KM + Hrs: each row its own
  hours, saved and opened again), the entry page (two rows of the tipper → one entry; Idle beside a work → red with the reason; a third
  work added to the saved trips; the same work again refused), the edit window (its rows said), the print (three rows of trips with
  their challans, payable ₹6,000); no page error.
* The Log Book browser tests of the page on this update – see "Regression".
* The phone app (App 3.31.2, its own pull request): its GitHub build – analyze, the tests (new: a tipper on KM, by trips, KM + Hrs;
  the print of rows of every way the same as the web's own print), the screens.

## After an independent review (fixed, each with a check)
1. **A typed item on rows without a work picked was lost when Edit Log Book saved the shift again** (e.g. SHIFTING per KM typed 10 + 20
   on two rows of a Hydra: after a challan was changed the bill lost the 30 KM). Each such row now keeps what was typed on it (`x`);
   rows saved before that get the entry's typed items back shared out over the rows in order (each up to its own quantity) – nothing is
   lost, every row's box adds up (the page, the add path, the phone). This also mends the same old gap of update-77 (rows on hours).
2. **The Excel "Work type" of rows of one shift was dropped** (all trips went to the rest item; a typed KM item got nothing): a row's
   Work type is now its whole quantity – on the row and on the entry (the first row's when its Start is known); a day item named is the
   entry's day item; a work paid another way is refused with the reason.
3. **Trips with two works (SOIL / MURUM): each row is ONE of them** (as for hours and KM) – picked on the page, named by its Work type
   or its typed trips, the rest one otherwise; the bill pays each row at its work's rate; Split refused (the phone the same).
4. **KM + Hrs: a duplicate only when BOTH meters read the same** (rows of 0 hours with other KM were taken as the same); rows already
   saved are not compared with each other (adding a 4th work to an old shift was refused).
5. **Trips on rows by the day (Format B) are added**, and every row keeps its own trips (`tr`, also on rows by readings); the page's
   and the server's duplicate check agree.
6. **Edit Log Book no longer rewrites an untouched entry** (it added each row's KM to old Hydra entries and stamped them): what is new
   (o / x / tr) is sent only for an entry that was changed.
7. Old words: the help ("a vehicle on KM cannot take a second work"), the fallback message and the hint for an older app say the
   update-146 rule.
8. A machinery by the day (no item column) has "+ work in this shift" in Edit Log Book.
9. An entry approved in verification after another entry of its shift was saved is added to that shift (it was sent before the other
   was saved, so it carried no "add" mark) – as the page would have done.

## Regression
(filled in after the sweep)

## Not verified
* Not on Vercel, not against the live database.
* The phone app on a real phone.

## Going back
Vercel → Instant Rollback to the update before. No SQL. An entry saved meanwhile with rows (k / o / ti in its rows) stays a valid
entry: its readings, trips, totals and bill are the ordinary columns. In the update before, Edit Log Book shows such a shift as one
row (its rows are not read) – nothing is lost from its totals.
