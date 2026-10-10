# update-69 – a row for each work of a shift · each work on its own printed row · the diesel rate typed by hand (10-10-2026)

Asked by the owner on 10-10-2026 (with two screenshots: Edit Log Book of a JCB showing "24-09-2026: two entries on
Day – make one Day and the other Night", and a bill's Log Book summary with "DIESEL DEBIT rate = higher of avg ₹98.13 /
last ₹98.13"):

1. "The same machine, Day or Night, worked with the Bucket AND the Breaker – then this error must not come."
2. "Wherever diesel is debited in the app – Log Book, debit recovery, anywhere – … I must be able to put the rate myself."
3. "When the Log Book is given, Bucket separate and Breaker separate – however I enter it, mixed or any way – never two in one."

Nothing else was changed. **No database step, no new column or table.** Live is update-68 (`0c18421`); this update was
built and tested on the local rig only – nothing was pushed, deployed or run against the live database.

## What was understood, and what was built

### 1. Edit Log Book – a row for each work of one shift
* A machinery whose BOQ (on that date) has **two or more hour works, or two or more KM works** (Bucket and Breaker), may
  have **more than one row on the same date and the same shift** – one row for each work. Each row has its own Start /
  Close, its own Challan No, Particular, Chainage and Work description.
* Under every row of such a machinery stands **"+ work in this shift"**: it adds a row under it – same date, same shift,
  starting where that work closed. Lower the Close of the first row and the Start of the second follows (as always in
  this grid). A row added with "+ Add row" and set to the same date and shift works the same way.
* The rules of such a shift, each told on the row on the spot: every row is ONE work (not Split); its Close is above its
  Start; it starts exactly where the row above closed ("Use it" puts the reading); two rows one after the other are not
  the same work (Bucket – Breaker – Bucket is fine); at most 12 rows a shift. The half-day tick, the diesel and the
  opening diesel of the shift stand on its first row.
* An entry whose shift is changed into the shift of another entry (its Night set to Day) becomes a work of that entry;
  the question before saving says so ("1 entry deleted (25-09-2026 Night: its rows were moved into another entry …)").
* **For every other machinery the old rule stays exactly as it was** ("two entries on Day – make one Day and the other
  Night"): there the second row of a shift is a mistake, and the grid is drawn as before.

**How it is kept (why no database change was needed).** The Log Book stays **one stored entry per machinery + date +
shift** – that is its key, and the diesel of the shift, the tank, the bill lock and the debit notes hang on it; two stored
rows a shift were refused for that reason before (HANDOVER: "two entries a day were NOT built"). The rows of a shift are
kept **inside** that entry, in the existing text column `item_work`, next to the item quantities:
`{"Breaker":1,"_parts":[{"n":"Bucket","q":2,"c":"694","w":"PQC…"},{"n":"Breaker","q":1,"w":"ROCK…"}]}` – the works in
the order they were done, each with its hours (or KM) and its texts. The entry's own Start / Close are the first row's
Start and the last row's Close. The Start / Close of each row are worked out from the entry's Start, so nothing drifts
when a reading before it is corrected.
The quantities that the bill uses (`"Breaker":1`, Bucket = the rest) are **derived from the rows by the server** and
checked: the rows must add up to the entry's total. So the bill, the diesel standard, the tank and every report read
what they always read.
If the entry's total is later changed somewhere that knows nothing of rows (the small edit window, an Excel import, the
entry before it corrected), rows that no longer add up are **not used**: the entry is then shown by its quantities – as
a Split entry always was. In the small edit window a note says so before anything is changed.

### 2. The Log Book print – each work on its own row
* An entry whose hours (KM, trips) went to two or more items is printed as **one row for each item** – in every Log Book
  format (A to H), in the Excel of the print, in the Log Book under a bill, in the print after "Verify & Submit" and in a
  saved bill opened again.
* An entry that holds its rows (item 1) is printed as entered: own Start / Close, challan, chainage, description.
* An entry entered **with "Split"** (only the hours of each item are known) is printed as rows too: they follow each
  other **in the order of the BOQ** (Bucket first, then Breaker), each as long as its hours, with the entry's challan and
  description on each. *This order is an assumption – a Split entry does not say which work came first. Where the order
  matters, enter the works as rows in Edit Log Book.*
* The column PARTICULAR of such a row names that work (or what was typed for that row).
* **Only the rows change.** Every total, the summary box, the payable amount, the diesel and the TDS / GST are worked
  out from the entries exactly as before. The diesel of a day stands once, on its first row. Rows are numbered 1, 2, 3 …
* Not changed (one line per entry, as before): the list under Log Book entry (it has the Edit / Delete buttons of the
  entry), the Daily report, the Excel "for filling" (it is imported back entry by entry).

### 3. The diesel debit rate typed by hand
* **Bill** (Machinery Billing): under the amount "Diesel ded. (B)" of every bill that has diesel to debit stands a box
  **₹/L**. Empty = the automatic rate, as before (the higher of the average rate of the period and the last purchase
  rate – shown in the box in grey). A rate typed there is the rate of **that bill**: its Abstract ("@ ₹95.5/L"), its
  diesel Debit Note and its Log Book follow at once. Emptying the box brings the automatic rate back.
* **The server**: "Verify & Submit" builds every bill again from the database. It now does so at the bill's typed rate,
  says so in the check list ("Diesel is debited at ₹95.5 per litre – typed by hand in this bill (automatic rate of the
  period: ₹92.5)"), and still refuses a bill whose diesel amount does not match (an amount made at another rate without
  the rate, or a rate that is not a rate).
* **The saved bill** keeps the rate. Opened again (View bill, or its Log Book from Saved Bills) its Log Book is at that
  rate – not at whatever the automatic rate is on that later day.
* **Print Log Book** (from the Log Book page, Edit Log Book, the bill page, Saved Bills): the box that asks for the name
  on top now also has **"Diesel debit rate ₹ / litre"** (empty = automatic). From a bill it opens with that bill's rate.
  The sheet then says "rate = ₹95.50 (fixed by hand)" where it said "rate = higher of avg … / last …".
* **Debit Recovery Statement** already had this (rate: of the day / average / *Fixed*, and a rate per entry that can be
  saved) – nothing was changed there.
* Not changed (they are internal estimates, not money recovered from a party): the Dashboard's "extra diesel ≈ ₹", the
  Machinery Cost Sheet, Diesel Cost, Owner / Vendor-wise, Diesel Watch.
* The automatic rule itself is unchanged. (His words "this rate – last bill" were read as: keep the automatic rate as it
  is, and let me type my own. If the automatic rate should become the LAST PURCHASE rate alone, that is one line – say so.)

Help in three languages: the two new kinds of message have their advice in English, Marathi and Hindi (FIX_RULES), and
the page descriptions of Log Book, Edit Log Book and Machinery Billing (which the Ask assistant answers from) say the
new functions.

## Files changed (against live update-68, `0c18421`)

| File | Change |
|---|---|
| `app/Code.gs` | `itemPartsOf_`, `itemPartsStrip_`, `partsTxtSame_` (new); `logItemWork_` takes `_parts` and keeps saved rows only while they fit (`prev`); `itemQtyOf_` ignores keys that begin with `_`; `logItemsOut_` / `getLogEditData_` give `itemParts`; `updateLogRow_`, `importLogBook_` (keep / join rule); `logSlotHint_` (entry page: how to add a second work); `billMachineCalc_` (`extra.manualRate`; returns `dieselRate`, `autoRate`, `rateManual`); `verifyBills_` (`b.dieselRate`, 0.01 – 999.99); `billVerifyKey_` (the rate is part of the key) |
| `app/App.html` | Edit Log Book grid (`LX.cut`, `LX.pc`, `lxSlotRows`, `lxPartKind`, `lxLater`, `lxPickOf`, `lxOtherItems`, `lxSig`, `lxPartsProblem`, `lxAddWork`, load / draw / calc / remove / save by shift); `lbWorkRows` + `logSheetsBuild` (a row for each work; `L.dieselRate`, `L.rateBy`); `mbMachine` / `mbFill` / bills table (`.mb-dr`); `askPrintName(what, opt)` / `printLogRows`; saved-bill Log Book; 2 advice rules; 3 page descriptions; a few lines of CSS |
| `test/unit.test.js` | 3 new tests (47 in all) |
| `test/browser/works69.js`, `rate69.js`, `compare69.js` | new |
| `UPDATE_69.md`, `HANDOVER.md` | notes |

## Evidence (local rig, 10-10-2026; every command with a time limit, none reached it)

**New**
| Test | Result |
|---|---|
| `test/browser/works69.js` – real browser: "+ work in this shift", Start follows, each wrong way stopped with its reason, saved as ONE entry with its rows, grid opens with the rows again (nothing "changed"), three works, a row removed, the last row removed, print rows (kept and Split), all 8 formats, money by item, server agrees, a Night entry moved into the Day entry (the question names the entry that goes), a KM + Hrs machinery keeps what was typed for its KM items, a machinery without works keeps the old error | 33 passed, 0 failed |
| `test/browser/rate69.js` – real browser: box under B, 95.50 → 50 L × 95.50 = 4,775 in Abstract / Debit Note / Log Book, 5000 not taken, emptied = automatic, **typed key by key with a pause, then Tab**, the bill's own Log Book print (rate kept / emptied), server agrees / refuses the wrong bills (no rate, other amount, −3, "true", 1000, 0.001), Verify & Submit saves the rate, print after submit, saved bill opened again, Print Log Book with 90 and empty | 19 passed, 0 failed |
| unit: works kept inside one entry (hand-worked, 13,590); the print's rows (page function); the rate by hand, page = server, verify | 3 of 3 (suite 47 / 47) |
| `test/browser/compare69.js` – the Log Book print of every machinery, live code (GitHub `0c18421` on another port) against this code, same database | 6 sheets the same to the letter; 1 sheet (the machinery with a three-work shift and a Split entry): 3 rows → 6 rows, **totals and amounts the same**; 0 sheets with another total or amount |

**Before → after (measured)**
| | live update-68 | update-69 |
|---|---|---|
| a second row on the same date + shift for a JCB with Bucket + Breaker | red: "two entries on Day – make one Day and the other Night", Save off | taken; saved as one entry with two rows |
| the same for a Tipper (one kind of work) | that error | that error (unchanged) |
| print of an entry with Bucket 2 hr + Breaker 1 hr | one row "BREAKER 1 HR · BUCKET 2 HR" | two rows: "BUCKET 2 HR" 2361.8 → 2363.8, "BREAKER 1 HR" 2363.8 → 2364.8 |
| diesel rate of a bill | automatic only | automatic, or typed: 50 L × ₹95.50 = ₹4,775 (was ₹4,625 at ₹92.50) |
| a bill sent with an amount made at another rate | refused | refused unless the bill carries that rate |

**Nothing else moved** (all on the final code)
unit 47 / 47 · `saveonce.js` 44 / 0 · `secure68.js` 48 / 0 · `harden.js` 27 / 0 · `backup.js` 28 / 0 · `audit.js` 36 / 0 ·
`reg.js` 11 / 0 · `restore-drill.js` 7 / 0 · `dn.js` 13 / 1 (the known line "backup is not set up" for the rig's servers) ·
browser: item2 13 (Bucket / Breaker entry page + bill) · xls 14 (Excel with items, out and in) · nightrow 22 · lxlook 10 ·
half 12 · splittime 18 · lbpage 13 · lbbasis 9 · viewbill 23 · billlock 17 · gstdecl 11 · tank 7 · tmbill 6 · tm 4 ·
hardenpage 10 · least68 9 · debit 5 · dnui 8 · boq 8 · lgrows 12 · big 18 · fix 8 · retry 10 · sweep 38 pages – 0 FAIL.
With the two new tests: 26 browser tests, 357 PASS, 0 FAIL. All of these were run again AFTER the review corrections below.

Said plainly:
* The first run of `nightrow.js` crashed: a machinery WITHOUT separate works, brought into the error state "two rows on
  one shift", was drawn the new way (no "½" tick on the second row). That was a fault of this update, found by the old
  test; corrected (`lxLater`: the new drawing only where a shift can have a row for each work) – 22 / 22.
* Two new-test failures on the way were wrong expectations in the tests themselves (how the Debit Note text was read;
  a wrong figure 13,440 for 13,290) – the app's output was right both times.
* `colsweep.js` reports "Diesel Issue: total row has 16 columns, the rows have 15". It reports the same on the live code
  (run against `0c18421`): it was there before this update and was not touched.
* `item2.js` and `xls.js` needed their machinery (EX-200 of "Item Vendor") which was missing from the rig; it was created
  through the app's own calls. (That is why those two tests "crashed" in the update-65 comparison of 08-10.)

## Independent review (two reviewers who had not seen the work being made) – what they found, what was done

| Found | Done |
|---|---|
| **A real fault:** the ₹/L box of a bill lost what was being typed – half a second after a key the table was drawn again under the cursor. (My first test set the value in one step and did not see it.) | Corrected: typing in that box no longer redraws the table; the rate is taken when the box is left or Enter is pressed. `rate69.js` now types key by key with a pause: on the code WITHOUT the correction it fails (box loses the cursor + a script error), with it it passes. |
| A machinery measured in KM + Hrs: what was typed for its KM items was dropped when its hour works were saved as rows | Corrected on load and on save (`lxOtherItems`); checked in `works69.js` ("Shifting 8 km" still there, money 6,060). |
| The question before saving said "0 deleted" when an entry was going because its row was moved into another entry's shift | Corrected: it counts it and names it. |
| The page relied on the Save button being off; the save itself did not check the rows of a shift again | The same rule is now checked once more inside Save; the server checks it in any case. |
| Trips typed (format B) on a later row of a shift were not sent | The trips of the rows are added up. |
| Server: rows summing to within 0.01 hr were taken (now 0.005, the rounding of the app); a quantity like 0.004 counted as work; no limit on rows or text length; item names in another letter case made a second key; the kept rows survived a change of description in the small edit window when the description had been stored in another column | All corrected; three of them are in the unit test. |
| Diesel rate: `true`, 1000, 0.001 were not refused cleanly; a bill verified at one rate could be submitted at another within the same minute | Rate must be 0.01 – 999.99; the rate is part of the verify key. |
| Print box: a rate standing in the box and then emptied still printed at the bill's rate; a half-typed number ("9e") was taken as empty | Emptied = automatic; a half-typed number is refused with a message. |
| Print (clock-time column): the gross hours of a row for each work were also adjusted for KM works, and not for an entry with split timing | Adjusted for hour works only, and for split timing too. |

Left as they are (said, not changed): a shift's rows are for hour-meter and KM works only; the daily entry page keeps one
line a shift; on a machinery measured in **KM + Hrs with two KM items as well**, the hour works get their rows and the KM
items stand together on the first row.

## What was NOT verified
* The live site, the live database, real phones, Windows / Edge. Nothing was deployed.
* Rows for each work on a machinery measured by clock Time or by Trips: not built (rows are for hour-meter and KM works);
  such an entry still takes Split, and the print still gives a row for each item (for Time: the times on the first row).
* A Log Book of a whole month with two rows on many days on one page: the one-page fit shrinks the sheet as it does for
  any long month (`lbpage.js` passes for the usual lengths); a sheet of 60 rows was not looked at on paper.
* Formats B – H were checked for rows, order and money (`works69.js`), not compared on paper.
* The entry page (daily entry) still takes ONE line per machinery and shift. A second line there is refused as before,
  now with the hint "To add another work of the same shift (Bucket / Breaker): Edit Log Book → + Add row → the same date
  and shift – or open this entry and use Split."

## Going back
Vercel → Instant Rollback → the previous deployment is update-68 (`0c18421`): safe (passwords, step 5 – nothing of that
is touched by this update). What update-68 does with an entry that holds rows (measured on the rig, live code on another
port – before the review corrections; they did not change how an entry is stored): it reads it and bills it correctly (it knows the quantities); it prints it as one row ("BREAKER 1 HR · BUCKET 2
HR"); its Edit Log Book grid cannot save a CHANGE to such an entry ("\"_parts\" is not an item of its BOQ" – nothing is
saved); its small edit window saves and joins the rows into one entry. No data is lost or wrong in either direction.
A bill saved with a typed rate keeps its amounts on update-68 (they are stored); only its Log Book would again show the
automatic rate when opened there.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-69.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-69: a row for each work of a shift, each work on its own printed row, diesel rate by hand"
git push
```
Vercel "Ready" → press **Update** in the app → Edit Log Book of the JCB: "+ work in this shift".
