# update-115 – A machinery that left the site: by its date, everywhere (15-10-2026)

**Asked:** "jya gadya jya site hun jya date pasun inactive hoil tya date pasun tya show krnar nahi khuth n tyanchi entry krta
yeil n tya gadich kahi pending dakhwl … asset master list ghetena date range asel … ekhade gadi 1 la inactive aahe tr 1 pasun
nahi disnar but filter 30 cha asel tr dakhawel".

## The rule (one rule, page and server)
A machinery is **on the site** from its "Active From" (blank = always) **until the day before** its "Inactive From". From the
Inactive From date:
* **No entry** – the server refuses it (as before: "… is inactive from 01-10-2026").
* **Not pending** in the Log Book (as before – by date).
* **Not offered** where an entry is made: the machinery picker of Diesel Issue, the rows of Diesel Issue (many), Log Book entry
  (top and every row) and Tank Check now offer only the machinery **on site on that entry's date** (an entry of 30-09 still
  offers a machinery that left on 01-10). The search / filter boxes of the lists and reports keep every machinery (old entries).
* **Not counted** as on site in: the Vehicle Compliance list, "BOQ missing", the tank report, the assistant's "no entry today",
  the Excel templates and the QR labels. These looked at the word "Inactive" only – now at its date (a machinery leaving next
  week still counts today).

## Asset Master: dates
* New boxes **"On site from" / "to"**. A machinery is shown when it was on site on **at least one day** of these dates.
  His example: Inactive From 01-10 → 01-10 … 05-10 does not show it; 30-09 … 05-10 shows it.
* The page opens with **today** in both (the machinery on site today). "Clear filters" empties them = every machinery, also the
  ones that left (to open one and make it Active again). The count says "Machinery: 54 of 55 · on site on 15-10-2026".
* "Print list" follows these dates (as the other filters). "Export to Excel" stays the whole Master, as before (it is the file
  for Import).

## Built on update-114 (pull request #25) – merge that one first
No SQL step. No change to saved data.

## Evidence (local rig, test data only)
* Unit 79 / 79 – new "update-115": the page's rule (taken from the page) and the server's give the same days; an entry is refused
  on exactly the days it is not on site; his example (01-10 … 05-10 no, 30-09 … 05-10 yes); pending only while on site; BOQ
  missing by the date; the entry pickers use the date's list, the filters all; no list looks at "Inactive" without its date.
* Browser `test/browser/inactive115.js` 11 / 11: entry of 01-10 refused; pending 28-09 … 30-09 only; Asset Master opens with
  today (LFT-115 not shown), 30-09 … 05-10 shows it, 01-10 … 05-10 not, Clear shows it; Diesel Issue picker today without it,
  with the date 30-09 with it; no page error.
* Old browser tests: entry71 20, shift109 8, tanker107 8, idle 10, half 12, item2 13, lang110 17.

## Not verified
* Not run on the live sites.
* The phone app: its machinery list does not yet use the dates (next phone version, 3.1.7). The server refuses its entry anyway.

## Going back
Vercel → Instant Rollback to update-114.
