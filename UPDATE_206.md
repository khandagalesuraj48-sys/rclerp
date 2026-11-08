# update-206 – the Log Book print shows the reading given at every diesel fill (03-11-2026)

**Asked:** "log book apan print gheto tikde kahi thikani diesel issue aahet tyachi qty auto yete tasech kahi thikani diesel ghetana ji
reading dile jatey jas ki km aso ki hrs aso ki mix aso tr te kahi machine log book print madhe te disat nahi … mala fkt diesel quantity
nko tr tyat mla reading hrs km je asel tr yeyla haway proper bgh sagle ani sang kuthe kuthe missing aahe … MH04KU3332 … diesel issue
qty yete but issue welechi readings nahit"; after the list of where it was missing: "jith diesel issue diesel tith jr tya machine chi
reading dilei asel tr ti dislich pahije".

**No database step.**

## Where the reading was missing (found 03-11-2026)
1. **Format B (KM + Hrs + Trip)** – no reading column at all: only the litres.
2. **Format E (Particular / Challan)** – the same.
3. **Format A, C, D** – the column was there, but the print looked only at the reading of the machinery's **unit** (Asset Master): a
   machinery on Trip / Day / Time whose fill gives its **Hrs** reading printed nothing.
4. **A fill on a day with no Log Book entry** – its litres in the note under the sheet, no reading.
5. **Two fills in a day** – the litres of both, the reading of the last only.
6. **Format H (Trip register)** – no reading column (its fills are not asked a reading – that is not changed).
7. **Format F, G (time sheets) and I (water tanker)** – no diesel at all, even when the machinery had diesel (found with his picture, below).
8. The same in the phone app and in a bill's Log Book sheet (the same code).

**Then (03-11-2026, with a picture of MH-04-LS-7725 – Format F, a time sheet – 200 L of diesel debited and no diesel on its Log
Book):** "he bgh yat diesel issue kel te hi disena … mala pratek format madhe diesel issue haw aahe ok jr tya gadila dilech nasel tr nko
deu but dile aahe tr haw aahe ani diesel diley reading nahi tr reading blank thew te ai reading asel tr reading diesel issue time chi
yeyla haw sagle format la aple he lagu".

## What changes
* **Every format shows the diesel given:** Format F and G (time sheets) and I (water tanker) had no diesel at all – now, when the
  machinery had diesel in the dates, they get **"Diesel qty"** and **"Reading at diesel"** (before the chainage), and "Total diesel
  issue" in the summary. No diesel given – no such columns (as before). Format I: an entry's diesel on its first trip line only.
* **Format H:** its "Reading at diesel" column whenever diesel was given (a fill without a reading – blank).
* **The reading given at a fill – whatever it has:** KM, Hrs or both (not only the unit's). The reading of the machinery's own unit is
  printed as a plain number, as on its meter (as before); another one says KM / HRS ("500 HRS" on a Trip tipper); both: "1000 KM / 200
  HRS" (before: "1000 / 200").
* **Each fill of the day:** two fills – both readings, one under the other.
* **Format B and E:** the column "Current diesel refilling reading" after "Issued qty" (as A, C, D).
* **A fill on a day without an entry:** "… NOT IN AN ENTRY: 03-10-2026 10 L (READING 512 HRS)".
* A bill's Log Book (also of a bill already submitted, when it is opened again) shows the readings the same way – its entries and figures
  do not change.
* **Server (`app/Code.gs`)** – `logPrintExtra_`: each fill of a day with its own readings (`fills`); the day's litres and last reading as
  before. **Page (`app/App.html`)** – `logSheetsBuild` (`fillReads`), `LB_FMT_COLS` (B, E, H), `LB_FORMATS` (their descriptions).
* **rcl-mobile 3.80.0** – the same in `lb_print.dart` and the formats' descriptions.

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 159 / 159 (new `update-206`: the fills of a day with their own readings; the
  page's code). The page's script blocks parse.
* The rig in Chromium: the page's own `logSheetsBuild` run on every case of rcl-mobile's print fixture – the cases without readings in
  Format B / E / dual come out the same as before; Format B and E gained the column; "1000 KM / 200 HRS"; a new case (a Trip tipper
  with Hrs fills – two in a day and one on a day without an entry; Format E; Format H with a KM reading; Format F with diesel – a fill
  with and one without a reading –, Format F without diesel, Format I with diesel) – pictures looked at.
* rcl-mobile 3.80.0: the app's print against the web's sheets (the fixture made again) on GitHub Actions.

## Not verified
* Not run on the live site; MH04KU3332's own Log Book was not looked at (no access to the live data from here) – its fills' readings
  show if it is on Format B / E, or on a unit other than the reading given.

## Going back
Vercel → Instant Rollback to update-205.
