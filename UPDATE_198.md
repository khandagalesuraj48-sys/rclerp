# update-198 – the machinery boxes narrow at once on a computer (02-11-2026)

**Asked (two pictures of Diesel Issue, "7533" and "SANY" typed):** "eth mi search krtoy tr lage yet nahi … he pn fix karaych aahe".

**Why:** on a computer the machinery boxes used the browser's own list (`<datalist>`). After "7533" or "SANY" was typed it still
showed the first names of the whole list (20 KVA DG 1, 400 KVA DG, 500 KVA DG) and narrowed only later. On phones the app already
used its own list (since 05-10-2026), which narrows in the page with every letter.

**No database step. No server change.** No entry, calculation, bill, ledger, stock or permission changes.

## What changes (`app/App.html`)
* **The machinery boxes** – the machinery on site on the entry's date (`dl_mach_on`: Diesel Issue, Log Book, Tank Check, Breakdown,
  the bulk rows) and all machinery (`dl_machines`: the bulk issue, the filters) – use the app's own list **on a computer too**:
  * narrows at once with every letter; a number is found without its dashes and in small letters ("mh09bc7533");
  * opens on a click in the box, on typing or on ↓ – not by itself when the box gets the cursor after a save;
  * ↓ / ↑ choose, **Enter** takes the chosen one (or the only one left), **Esc** closes, a click takes; the cursor stays in the box.
* Every other box (driver, vendor, type, pump …) keeps the browser's list on a computer, as before. **A phone: as before.**
* A filter box with this list is still a filter (it applies when a name is taken); the big box (⤢) gets the same list; the list is
  above the big box.

## Evidence
* Unit 151 / 151 (new `update-198`: the boxes taken, the keys, the narrowing – "7533" → the two with 7533, "SANY" → SANY only).
* Rig in Chromium with 271 test machinery (DGs without a number, numbered vehicles, SANY): a computer – the cursor put in the box
  by itself: no list; a click: the list; "7533" → MH-09-BC-7533, MH-12-XY-7533 at once; "SANY" → the 4 SANY; "mh09bc7533" → one,
  Enter takes it, the details show, the cursor stays; ↓ ↓ ↑ Enter; Esc; ↓ again; a click on a name; the Diesel issued filter box
  takes the name and the list is asked again; the Driver box keeps the browser's list; no page fault. A phone (touch): the list on
  a touch, narrows, a tap takes it and the keyboard goes, the Driver box has the app's list – as before.

## Not verified
* His computer and the live data (several hundred machinery); the browser's own list could not be photographed here.

## Going back
Vercel → Instant Rollback to the previous deployment.
