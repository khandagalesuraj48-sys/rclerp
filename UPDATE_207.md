# update-207 – the Log Book print: a day with diesel and no Log Book entry is a row of its own (03-11-2026)

**Asked** (with the Log Book of MH-05-AM-1931: 250 L issued, 150 L in the rows, "NOT IN AN ENTRY: 26-10-2026 100 L" under it): "ata bgh
system sangtey jya diwshi diesel ghetley but tya day chi entry nahi mhanun dakhwat nahi tr as nko diesel ghetley ani kam nasel tr te
entry disayla hawi kam nasel tr 0 0 sagle rahu de all format sathi logic use kr".

**No database step.**

## What changes
* In the Log Book print – **every format (A to I)**, from the Log Book page and in a bill's Log Book – a day on which the machinery was
  given diesel but has **no Log Book entry** is now **a row of its own, in its date's place**: its date, its shift (the fill's), the diesel
  issued and the reading given at the fill (blank when none); no work – "–" in the work columns and **"NO LOG BOOK ENTRY – DIESEL
  ISSUED"** in the work description. The note "… NOT IN AN ENTRY …" under the sheet is then not needed (the diesel is in the rows).
* **Only printed:** the working days, nights, hours, KM, trips, the payable amount and the bill are worked out from the entries only,
  as before – the row adds no day. The diesel running balance of a sheet with a month-end tank check takes the diesel on its own day.
* **Server (`app/Code.gs`)** – `logPrintExtra_`: each fill with its shift (`fills[].s`). **Page (`app/App.html`)** – `logSheetsBuild`
  (`LB_DSL`, the rows put in; Format A and the others print them as a day without work).
* **rcl-mobile 3.82.0** – the same in `lb_print.dart`.

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 160 / 160 (new `update-207`; `update-206` now with the fills' shift). The page's
  script blocks parse.
* The rig in Chromium: the page's own print on every case of rcl-mobile's fixture – only the case with such a day changed; a new case
  (a Trip tipper like MH-05-AM-1931 with diesel on two days without entries; Format F with a Night fill on a day without an entry; Format
  I) – each such day a row of its own, the days counted from the entries only (picture looked at).
* rcl-mobile 3.82.0: the app's print against the web's sheets (the fixture made again) on GitHub Actions.

## Not verified
* Not run on the live site; MH-05-AM-1931 not opened from here.

## Going back
Vercel → Instant Rollback to update-206.
