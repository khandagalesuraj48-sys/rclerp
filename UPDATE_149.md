# update-149 – Reports → Log Book Debit Statement: the Log Book entries charged to a party (24-10-2026)

**Asked (24-10-2026):** "app war pn jewa log book mdhun ekadi entry debit to keli jate tr tyach wegle record rahaw jas diesell debit
rahte tas yach pn asawa proper tyt pn filter import export print rate change he sagle krta yaw app mdhe debit t kelel aahe ntr updet
ntr te disaw mla". His answers (24-10-2026): in **Reports**, named "Log Book Debit Statement"; the import gives **the party and the
rate of entries already saved** (machinery + date + shift); the rate is changed for **one entry, and for all shown at once**.

## What was there
* A Log Book entry could be charged to a party ("Debit to" + rate, update-1t). The Debit Recovery Statement is for **diesel**
  given to a party; the Log Book entries charged to a party were seen only inside a Debit Note (New Debit Note → its lines). There
  was no record of them of their own, no way to change many rates at once, no import.

## What changes
* **Reports → "Log Book Debit Statement"** (next to the Debit Recovery Statement). Filters: From – To, **a party** (from the Vendor
  Master; blank = all), **one machinery** (blank = all).
  * **Summary** – one line per party: machinery, entries, quantity (hours, KM, trips, days – each in its own unit), how many are
    already in a Debit Note, the amount; the total.
  * **Details** – party by party, every entry: date, shift, machinery, type, measured by, quantity, unit, work, its Debit Note (if
    any), **rate**, amount; the party's total; the grand total.
* **Rate change** (Log Book Edit access): a **rate box on every entry** – the amount changes at once; **"Rate for all shown"** +
  **"Put on all shown"** puts one rate on every entry shown; **"Save changed rates (n)"** asks (each entry, ₹ was → ₹ now) and saves.
  An entry already in a Debit Note has no box – it keeps its rate (cancel that note first).
* **Import** – **"Import party + rate (Excel)"**: a file with Date, Shift, Machinery, Debit to, Rate. Each line is **an entry already
  saved** (machinery + date + shift; no shift needed on a day with one entry). Asked first (each line: entry → party @ rate).
  A blank "Debit to" cell (or no such column): the entry keeps its party. **"Excel layout for the import"**: the empty layout, or –
  with a statement shown – the entries shown already in it, to change and import back.
* **Every line is checked as a change of its Log Book entry** (the same checks as Edit Log Book): the party in the Vendor Master, a
  rate above 0, the month open, a submitted bill (Super Admin only), not in a Debit Note, a day with two entries needs its shift, an
  entry not given twice. **All or nothing:** one line that cannot be changed is said with its row – then nothing is saved.
* **Export / Print:** Excel as every report; Print – the figures (no boxes, no buttons) with the sign lines and "Party acceptance".
* The Activity: "Debit to / rate changed for N Log Book entries" ("… (Excel import)" for a file), with each change (was → now).
* A changed rate is only for what the party pays (the Debit Note). The bills of the machinery are not changed.
* **Who:** the statement – Reports access (as every report); the rate change and the import – Log Book Edit (View: refused, said).
  Under verification rules, "saveLogDebits" follows the Log Book's rule (sent for verification like any Log Book change).
* **Server:** `rptLogDebit_` (`API_.rptLogDebit`, Reports), `saveLogDebits_` (`API_.saveLogDebits`, Log Book, edit; `writeLog_`
  'logDebits') in `app/Code.gs`. **Page:** the report def `ldebit` (`reportDefs`, `rpFilters` party / machinery), `ldebitRecalc`,
  `ldebitSave`, the import (`LD_COLS`), `rpPrint`. **Phone app:** App 3.31.7 (`rcl-mobile`) – Reports → Financial → the same
  statement as its own screen, "Change rates" (one / all shown) and "Import party + rate (Excel)".
* **Help (English / मराठी / हिंदी):** the report's guide (`REPORT_GUIDE.ldebit`), 5 new help rules (`FIX_RULES`), `saveLogDebits` in
  the Log Book page's saves (`PAGE_GUIDE`); the Marathi / Hindi words of the new texts (`app/i18n`, +48 each; the app's too).
* No database step (the columns `debit_to` / `debit_rate` are there since update-1t), no setting, no access change.

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – 105 / 105 (every new server message has its help; the words keep every {n}; the page's script
  blocks parse).
* `test/ldebit149api.js` (new, API) – 26 / 26: the statement party by party (the quantity × rate = amount, each entry, the totals),
  a party filter (any case), a machinery filter; one rate changed, seen at once by the other server; one rate for several (one
  already as given); the import by machinery + date + shift, a day with one entry without its shift, a blank "Debit to" keeps the
  party; refused and NOTHING saved: a day of two entries without the shift, an entry not saved, a party not in the Vendor Master, a
  rate of 0, the same entry twice, nothing to save; an entry in a Debit Note keeps its rate (said) and the statement names its note;
  Log Book View: refused to change, sees the statement; the Activity with each change; a Log Book verification rule: the change
  is sent for verification (nothing written), the checker sees it in Details, approved → saved.
* `test/browser/ldebit149.js` (new, browser) – 14 / 14: the report in the menu, Generate (summary, rate boxes), one rate typed (the
  amount at once) → asked → saved, one party + "Put on all shown" → saved, the import asked and saved, a wrong line said with its row
  and nothing saved, a blank "Debit to" asked as "(its party)", the print (figures, no boxes, "Party acceptance"), a phone-size
  screen does not get wider, no script error.
* The Debit Note page (`test/browser/dnui.js`) and the machinery number change (`test/browser/machno.js`), on main and on this branch
  from the same snapshot: see the pull request.

## Not verified
* The live site; a real phone (the app's build on GitHub runs analyze, its tests and draws the screens).

## Going back
* Vercel → Instant Rollback to the deployment before this update (no database step). Rates saved through it stay in the Log Book
  as any change of an entry (the Activity has each one, was → now).
