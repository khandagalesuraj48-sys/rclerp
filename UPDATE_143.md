# update-143 – A second entry for a shift that is already saved is added to it (23-10-2026)

**Asked (23-10-2026):** "app madhe ajun ek problem asa aahe 1 day madhe multiple entry ghet nahi shift change kel ki ghete … multiple
entry hou de n yar jar same data bharat asel tr te duplicate hoil ani jr same data nasel tr duplicate honar nahi n karan hydra farana
water tanker excavater je rental astat te multiple thikani 1 day madhe kam kartat" – then "OK MG BAKI JE SANGITLE TULA TE FIX KRUN DE".

## What was wrong
* The Log Book keeps ONE entry per machinery, date and shift (its key, its diesel, its tank and the bill hang on it).
* Several works in one shift were already possible, but only when they were entered **together** (the entry page with two rows
  of the machinery – update-71 / 77 / 78) or in **Edit Log Book** ("+ work in this shift").
* A machinery that went to a second site the same day was **refused** on the Log Book entry page and in the phone app once the
  first site's entry was saved: "… already saved for <date> (<shift>)".
* The water tanker was not affected: its trips of a day are added to the day's entry already (update-103).

## What changes
* **A new entry for a machinery, date and shift that is already saved becomes the next row (work) of that saved entry** – exactly as
  if the rows had been entered together (`app/Code.gs` `saveLogRowsInner_`: `logSavedIdx_`, `logEntryRows_`, `logRowsJoin_`). The
  saved entry is written again in its own place (`logRowAgain_`: its key and who entered it stay); its tank and the entries after it
  are worked out again (`recalcChain_`). One entry per shift stays.
* **Which machinery:** every one whose shift can keep rows – on hours only (an hour meter, no KM meter), or whose BOQ of that date has
  two or more works of the entry's kind (hour / KM): an excavator, a Hydra / Farana with HYDRA and FARANA in its BOQ.
* **Refused as before, with the reason:** a vehicle on KM with one kind of work ("Another work of the same shift is added to a saved
  entry only for a machinery on hours, or one whose BOQ has two or more works of this kind – change the saved entry in Edit Log
  Book"); a saved day on Idle / Holiday / Breakdown, without a reading or with a new meter; a saved entry split between two works
  (typed); a date in a submitted bill.
* **The same work twice** – the same Start and Close of its meter, or the same From – To – is refused: "this work is already in the
  saved entry of this shift … the same work is not saved twice" (`logSameWork_`).
* **The new work comes after what is saved:** it starts at the saved Close (on hours it may start above it – those hours are not
  counted, update-77). A work before the saved Close is refused (Edit Log Book puts a work in between). On hours, a Close above the
  next date's Start is refused as before (no other entry is ever moved).
* **The prefill** (`getLogRowPrefill_`, the entry page and the phone) says it before the save: `addTo` { rows, kind, mode, closeKm,
  closeHr, stock, lastWork, sameOk }; no "already saved" problem; Start = the saved Close; the tank after the saved entry.
* **The Log Book entry page** (`app/App.html` `lgCalcAll`): such a row is "work 2 of this day"; its note says "This day is already
  saved – this row is added to it as work 2 (it starts at its Close; its diesel is already there)"; Diesel issued 0 (it is on the
  saved entry); no ½ tick; one work per row (no Split); not the same work as the saved last one unless on hours only. The toast
  after the save: "1 work was added to the entry already saved for that shift".
* **The assistant** (web and phone) says "… is already saved – this work is added to that entry as work 2".
* **Help:** two new rules in `FIX_RULES` (English / मराठी / हिंदी): the same work twice; a saved entry that cannot take another work.
* **The phone app** (`rcl-mobile`, App 3.31.2, its own pull request): the same on its Log Book form.
* **The answer of the save** keeps `count` as before (older phones), and adds `added` / `into`.
* **No database step. No new setting. Edit Log Book, the bill, the diesel and the reports are not changed** – they already read the
  rows of a shift.

## Evidence (local test copy only)
* `node --test test/unit.test.js` **99 / 99**.
  * New check "update-143" (in the server code itself, on the test harness):
    * two excavators on hours, one given its two works in two saves, the other in one save: **every stored figure the same**
      (readings, hours, the diesel issued, the standard diesel, the tank before and after, the rows);
    * the prefill offers the next row (no problem, Start 102, the tank after the saved entry);
    * the same work twice refused (two ways), a work before the saved Close refused – nothing changed by them;
    * a third work: Edit Log Book reads three rows; the bill pays 6 hours × 1,000;
    * a Close above the next date's Start refused; inside it saved; the Night beside a Full Day still refused; a saved Idle day
      takes no work (prefill and save);
    * the Hydra (KM + Hrs, HYDRA / FARANA with his hour slabs): HYDRA 100 → 103 saved, then FARANA 103 → 105 – one entry 100 → 105,
      KM 5000 → 5014, its rows HYDRA 3 / FARANA 2; a FARANA starting at 104 refused (KM + Hrs: rows follow each other); the bill
      (1,700 + 2 × 1,400) + (2,200 + 1,700) = **8,400**; a saved entry split between the two works refused with the reason.
  * The old check of update-71 changed where it held the OLD rule ("a shift that is already saved is not added to"): now that
    Breaker is added as the 4th row (02-06: 4 → 8, 4 hours) and the import of 04-06 starts at 8.
* `test/browser/add143.js` **17 / 17** – the real Log Book entry page on the test copy (with `test/browser/geo-shim.js`): the
  excavator's second site, the duplicate, the Hydra's FARANA after HYDRA (the same work red), the tipper still refused, Edit Log
  Book reading the rows, no page errors.
* The Log Book tests of the page, before and after (see "Regression").

## Regression
(filled after the run)

## Not verified
* Not on Vercel, not against the live database.
* The phone app: its build checks (analyze, tests, screens) run on GitHub; not on a real phone.
* The Excel import is unchanged: two lines of one machinery on the same date and shift in ONE file are joined as before
  (update-71); a line for a shift saved earlier is handled by the import's own rule.

## Going back
Vercel → Instant Rollback to the update before. No SQL. An entry that took a second work stays one entry with its rows – exactly
what Edit Log Book "+ work in this shift" makes – so the old code reads it as before.
