# update-179 – the Pending Log Book printed for a period – from the Dashboard and from the Log Book entry page (28-10-2026)

**Asked (28-10-2026, 10:28):** "ATA AIK N PENDING LOG BOOK JE AAHET N TE MALA PERIOD WISE PRINT KRTA YAWET ASHBORD WARUN PN ANI LOG BOOK
NETRY MADHUN JOITH DISTE N PENDING TITHUN PN".

**No database step. Nothing saved is changed. No secret in any file.** With the phone app **3.54.0** (the same, as the app's own screen).

## What changes
* **Dashboard → Pending Log Book → Print** (next to "From 01-09-2026") and **Log Book entry → the pending list → Print** (by date: that
  date; by machinery: that machinery from 01-09-2026 to today).
* A box first: **List for** one date / a month / a period (from – to) – the list's own period is filled in; **Ownership** (All, Own,
  Rental + Hired, Rental, Hired), **Owner / Vendor**, **Machinery** (all or one). Then the name on top (as every print), then the print
  (Portrait / Landscape, Excel, Print – as every print of the app).
* **The print:** "Pending Log Book – <date / month / from to to>", the period, "N machinery · M days pending", the filters; a table – #,
  Machinery, Type, Owner / Vendor, Ownership, **Pending days**, **Dates pending** (as runs: "23-10 → 28-10 (6), 30-10"; with the year
  when the period is in two years); Own first, then Rental, Hired, by owner; the Total; the signatures. A period past today: "Counted up
  to today".
* The same list as the Dashboard's Pending Log Book (a day a machinery was on the site with no Log Book entry in any shift; Debit-basis
  parties and Ownership "Other" need no Log Book).
* **Server:** `logPending` (the entry page's list – Log Book access) takes a period `{ from, to }` too (none: from 01-09-2026 to today, as
  before). The Dashboard's print uses the Dashboard's list (`pendingLog`, Dashboard access).
* The words in English, मराठी and हिंदी.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **131 / 131 pass** (new `update-179`: `logPending_` with and without a period – the same
  days as the Dashboard's list, a To after today counted up to today, From after To refused; the buttons and the one print for both; the
  dates as runs, also over the year's end).
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse (unit test); no secret in the change.
* **The local rig** (Claude stand-in): new `test/browser/pendprint179.js` **13 / 13** – test machinery PP179-OWN (Own) and PP179-R1
  (Rental, PP179 Vendor) on the site from 5 days ago: the Dashboard's box has the list's period; the print = the server's list of that
  period (PP179-R1: Rental, 6 days, "23-10 → 28-10 (6)"); the totals and signatures; Ownership Own (only PP179-OWN); the vendor (only
  PP179-R1); a month; the entry page by date (the same machinery as its list) and by machinery (its 6 days); no page error; the test
  data taken out. A picture of the print: `test/shots/pendprint179.png` (on the rig).
* The older `pend.js` could not run on this rig's data (no pending day today in the rig – it needs one; it does not concern this change).
* **Not verified:** the live data; a real printer.

## Going back
* Vercel → Instant Rollback to update-177 (or the update before this one).
