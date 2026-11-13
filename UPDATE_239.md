# update-239 – Diesel Day Book: the headings under every date (no SQL) (13-11-2026)

**Asked (13-11-2026, with a picture of the headings):** "pratek date la he headings thew jene karun samjel nkki".

## The change (`app/App.html` only)
The two heading rows of the Day Book (Type · ID · Who / what · Detail · each diesel source with Opening · Received · Transfer ·
Issued · Balance · Entered by) now come **under every date**, before that day's entries – not once at the top of the sheet.

## Evidence
`timeout 300 node --test test/unit.test.js` – 186 pass. On the local rig (test data) the report was generated: the headings stand
under each of its three dates (picture given to him).

## NOT run / NOT verified
Print and Excel were not opened; the other browser / API tests were not run; the live site.

## Going back
Vercel → Instant Rollback to update-238.
