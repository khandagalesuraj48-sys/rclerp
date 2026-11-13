# update-238 – Diesel Day Book: each diesel source its own columns; the search finds it (no SQL) (13-11-2026)

**Asked (13-11-2026, after seeing update-237 live):** "diesel location astil … date wise opening received issued balance … eka source
sathi … lagech tyach bajula dusrya source sathi … all nko" – the picture approved, then "yat transfer cha pn colum de"; and
"ctrl k kel ki … search madhe to report yet nahi".

## The change (`app/App.html` only – the server's `rptDayBook_` is not changed)
* **Diesel Day Book:** each diesel source has its own block of five columns, side by side – **Opening · Received · Transfer ·
  Issued · Balance** (its name over them). The column "All places" and "Litres" are gone. An entry fills only the block of its
  source: the stock before it, what came / went, the stock after it; a transfer fills two blocks (− in the one it left, + in the one
  it reached). Each day ends with "Total of <date>" (opening, received, transfer, issued, balance of each source); the whole period
  at the end.
* **Search (Ctrl K):** a word many pages share ("diesel", "report") listed only the first 6 pages – the new report was cut off. Now
  every page that matches is listed (up to 40). ("day book" found it already.)

## Evidence
* `timeout 300 node --test test/unit.test.js` – 186 pass (the Day Book's test now also checks the five columns of a
  source and that there is no "All places").
* On the local rig (test data): the report generated – the picture given to him; the search asked for "diesel", "report",
  "day book" – before: the report only for "day book".

## NOT run / NOT verified
Print and Excel of the new layout were not opened (two header rows) – his look. The other browser / API tests were not run.
The phone app has no screen for the report yet (his word: after the app's release).

## Going back
Vercel → Instant Rollback to update-237.
