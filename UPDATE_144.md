# update-144 – The rows of a shift may all be by Time (23-10-2026)

**Asked (23-10-2026):** his screen of a JCB in Edit Log Book – 28-09-2026 Day: Bucket by Time 14:00 – 18:00 (saved), "+ work in this
shift" Breaker by Time 09:00 – 13:00 – both rows red "the rows of this shift are all by Time – keep one row and give it its times (or
one row of the shift by Hrs)". "ase error nko n yeyla".

## What was wrong
* A machinery on hours (an hour meter, no KM meter) may have several rows in one shift (update-77), and a row may be by Time among
  rows by Hrs (update-78). But a shift whose rows were ALL by Time was refused: the page said "all by Time", the server the same.
* The way left was one row with "+ time" and Split (typed hours) – the works lost their own times.

## What changes
* **A shift whose rows are all by Time is ONE entry by Time** (`app/Code.gs` `logRowsJoin_`, `logItemWork_` `tOnly`):
  * its times are the rows' times **in the order of the shift** (`timeSpans_`: a Night's times after midnight come last) – e.g.
    09:00-13:00,14:00-18:00; its break is the breaks typed on the rows (the server adds the hour between, as for split timing);
  * its hours are the sum of the rows (4 + 4 = 8); the diesel as per standard for 8 h; the next day by Hrs starts at the last hour
    reading (an entry by Time reads no meter – as before);
  * each row keeps its own work, From – To, challan, chainage and description (`_parts`, in the order of the day); the bill pays
    each work at its rate (Bucket 4 h × 1,200 + Breaker 4 h × 1,700 = 11,600).
* **Two rows at the same time are refused** (a machinery does one work at a time): the server ("row 2 … (12:00 – 15:00) is at the
  same time as row 1 … (09:00 – 13:00)"), Edit Log Book and the entry page (the row red with the reason). A work added to a saved
  shift at a time already in it: refused as the same work (update-143).
* **The rows and the entry always agree:** the server refuses rows whose times are not the entry's times (`timesOk`).
* **Where:** the Log Book entry page (two rows by Time of the same machinery, date and shift; "work 2 of this day"), Edit Log Book
  ("+ work in this shift"; the shift sent as one entry by Time in the order of the day), a row added to a saved shift (update-143),
  the phone app's Edit Log Book (App 3.31.2, `rcl-mobile` `lib/core/log_edit.dart`).
* **Such an entry is changed row by row in Edit Log Book:** the edit window locks its From, To, Break and "+ time" (the server refuses
  a changed From – To: `updateLogRow_`); the Excel import refuses a change to it – as for the entries of update-77 / 78.
* **Help (English / मराठी / हिंदी):** a new rule for two rows at the same time; the rule of the rows of a shift and the page guides of
  the Log Book and Edit Log Book say it. The Marathi / Hindi words of the new messages (also those of update-143, which were missing).
* **Unchanged:** shifts with rows by Hrs, rows by Hrs and by Time together (update-78), a single entry by Time with "+ time", KM
  vehicles, every other machinery. No database step, no setting.

## Evidence (local test copy only)
* `node --test test/unit.test.js` **101 / 101**:
  * new check "update-144" (in the server code itself): his JCB – Bucket 14:00 – 18:00 saved, then Breaker 09:00 – 13:00 added: ONE
    entry by Time 8 h, times 09:00-13:00,14:00-18:00, break 60, diesel 40 L, rows BREAKER / BUCKET in the order of the day, bill
    11,600; the same two rows in ONE save (Bucket row first): every stored figure the same; Edit Log Book's payload: the same entry;
    rows whose times are not the entry's: refused, nothing saved; two rows at the same time (one save / against the saved shift):
    refused; a third work 18:30 – 20:00 → 9.5 h, break 90, bill 4 × 1,200 + 5.5 × 1,700; a Night 20:00 – 23:00 + 01:00 – 04:00 = 6 h in
    the order of the night; the next day starts at the last hour reading; the edit window refuses another From – To and keeps the same
    one; the Excel import refuses a change; rows by Hrs and by Time together unchanged (5 h);
  * the check of update-78 changed where it held the OLD rule ("a shift of rows all by Time is refused"): now ONE entry by Time of
    2 h; its July bill 9,000 → 11,000 (the 2 h of 03-07).
* `test/browser/time144.js` **15 / 15** – the real pages: his screen in Edit Log Book (no red, saved as one entry by Time 8 h, opened
  again as its two rows in the order of the day; To 15:00 → both rows red with the reason, Save off); the entry page (two rows by
  Time of one Day, "work 2 of this day", diesel 0; the overlap red; saved as one entry); a third work added to the saved shift from
  the entry page (9.5 h) and a time inside the saved ones refused; the edit window (From, To, Break locked, no "+ time"); the print
  (three rows with their times, TOTAL HOURS 22, payable ₹31,150); no page error.
* Browser tests of the rows of a shift, on the final code: time78 10 / 10, gap77 20 / 20, entry71 20 / 20, add143 18 / 18.
* The other Log Book tests of the page, before and after (see "Regression").

## Regression
(filled after the run)

## Not verified
* Not on Vercel, not against the live database.
* The phone app: its build checks (analyze, tests, screens) run on GitHub; not on a real phone.

## Going back
Vercel → Instant Rollback to the update before. No SQL. An entry saved meanwhile with rows all by Time stays a valid entry by Time
(its times, hours, items and bill are ordinary columns and stay right). In the update before, Edit Log Book shows such a shift as its
rows in red ("all by Time") until they are made one row with "+ time".
