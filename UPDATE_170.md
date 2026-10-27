# update-170 – the Maintenance Log Book in his format, at every site (27-10-2026)

**Asked (27-10-2026, 18:14):** he sent the Maintenance Log Book of **Roller No-03** (a PDF, 139 lines). "mala log book as hawa
aahe ya format madhe ok ani ha party name jithun ty gadi sathi material issue hotey tyach naw asel mg RCL STORE asel tr te yeil jr
direct bill marle tr party ch name yeil ok he fix kr nantr app banaw".

**His answers (asked first):**
* the 3.49.0 release goes on;
* **every site, every machinery**;
* Store: "apan sadhya store module pn banwanar aahe bhawa so tyach provision attach krun thew sadhya direct bill marel" – keep its
  provision, for now direct bills;
* GST: **the tax lines stay separate** (as now).

**His format** (the PDF): Sr No · Date · Party Name · Current Reading · Particulars · Qty · Uom · Basic Rate · Amount · GST Amount ·
Amount With GST · Total. Date, Party and Reading are merged over the rows of one bill. The Total line is at the end.

**No database step.** Step 1zi (`maintenance`, `app_users.perm_maintenance`) was already for every site. Where it was not run, the
page says so, as before. **No secret in any file.**

## What changes
* **Maintenance at every site** (update-165: only at a site on fuel cards):
  * the server answers at every site (`cardSiteOnly_` taken out of the Maintenance actions);
  * the page Maintenance is listed in the Portal's Users & Access → Pages for every site (Mechanical's own list – the Portal is not
    changed);
  * the menu shows it when the person has the page. Blank = No access, as before, so nobody sees it until it is given.
  * Fuel Cards stays only at a site on fuel cards.
* **A bill of any machinery:**
  * the form says **Machinery**, **Party name** (the garage / shop of a direct bill) and **Current reading (KM / Hrs)**;
  * a service needs "its reading (KM / Hrs)";
  * each line has its **Uom** (Nos, Ltr, Kg, Set, Bkt, Mtr, Pair, Gram, Box offered; any other can be typed);
  * the AI reads the Uom too (`[work, type, qty, uom, rate, discount, amount]`; the 6-value form is still read).
* **The Maintenance Log Book in his format:**
  * a row for each line of a bill;
  * Date, Party Name (with its bill no.) and Current Reading once for the bill's rows (merged on the screen, in the print and in
    Excel);
  * a part: Qty, Uom, Basic Rate, Amount;
  * a **tax line** (CGST, SGST, IGST, GST, Cess …): its ₹ in **GST Amount**;
  * Amount With GST, and Total, as his sheet;
  * a free line (Warranty / FOC / Service Plan): its kind, ₹ 0;
  * an insurance claim: a row "Paid by the insurance – company (claim no.)" with a minus ₹;
  * the last line: **Total – n bill(s)** with Amount, GST Amount, Amount With GST and Total (= what we paid), then "Free lines …
    worth ₹…".
  * At a site on fuel cards (HO), its **fills** follow in their own table. Its KPIs are as before: fuel, maintenance, all costs, KM,
    ₹ per KM, last service.
  * At a site with stock, no fills are shown (they carry no ₹ there). The KPIs are Maintenance and Last service (with km / hrs).
  * "Maintenance by work / part" is as before.
* **The Store's provision (`maintStoreLines_`):** where the material the RCL Store issues to a machinery joins the log book – each
  as a bill of the Party "RCL Store" with its lines. It gives nothing yet, because the Store has only its Item Master.
* **Help and words** (English / मराठी / हिंदी): the maintenance help rule knows the new service message; the page's guide names
  every site, the party, the reading, the Uom and the log book's columns; `app/i18n`: 29 new texts, the old ones out.
* **The phone app 3.50.0** (its own pull request), the same:
  * Maintenance at every site (Entries, the start page, Help);
  * Party name, Current reading (KM / Hrs), each line its Uom (Qty · Uom, Rate · Disc %, Amount);
  * the bill's sheet (Party, Reading, Qty Uom × Rate);
  * the Maintenance Log Book in his format, the fills apart at a site on fuel cards.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **123 / 123 pass**. The new `update-170` test checks:
  * at a site with stock: the page listed, a roller on Hrs, its bill with the Uom of each line, its reading, the party;
  * the reading checks;
  * its log book: the bills with their Party, the meter, no fuel;
  * the Store's provision empty;
  * the AI's 7-value lines and the long form with "unit";
  * the page's menu rule and his column names.

  Older tests were changed on purpose:
  * Maintenance now at a site with stock;
  * the service message;
  * the AI's line form;
  * the menu rule.
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; no secret in the change.
* acorn: no call lost in Sites.gs, SupabaseData.gs, SupabaseSync.gs, server/portal.js. The fewer calls are the ones taken out on
  purpose:
  * Code.gs: `cardSiteOnly_` 13 → 6 – the Maintenance actions;
  * App.html: the old log book's `what` / `mtLinesText`, the menu's `$('tab-mnt')` hide, one `cardMode()`.
* **The local rig** (Postgres + PostgREST + Portal + Mechanical; test data only, taken out after each run; the Portal's
  `api.test.js` 117 / 117 first in each run):
  * new `test/browser/mnt170.js` **16 / 16** (S1 plays VTR, with step 1zi):
    * the Portal lists Maintenance at S1;
    * a roller on Hrs, its bill with Uom;
    * "(KM / Hrs)";
    * its log book with no fuel;
    * the page – the menu, the form's names, the Uom column, a bill typed (₹ from Qty × Rate, the Uom kept, saved);
    * the list's columns;
    * the log book in his 12 columns – a row a line, Date / Party / Reading merged per bill, the tax lines in GST Amount, Total
      ₹29,180.00 / ₹4,748.85 / ₹33,928.85, no fuel table, Maintenance / Last service "1,903 hrs";
    * Excel: the sheets, the merged cells.
  * `mnt165.js` **32 / 32** (Claude stand-in), changed on purpose:
    * the log book's new table, the fills apart and the Excel sheets at HO;
    * S1 now has Maintenance (step 1zi not run there: "missing").
  * `mnt168.js` **29 / 29** (Claude stand-in, and again with the Gemini one), changed on purpose:
    * the Uom column;
    * the claim in the new format: 8 lines + the insurance's row, Total ₹2,399.80 / ₹421.20 / ₹821.00.
  * Pictures: the log book of the roller at S1.
* **Not verified:**
  * the other browser tests of the rig (menu, idle, …) were not run again – the menu only gains Maintenance for a person who has
    it;
  * a real phone (the app's build runs analyze, the tests and draws the screens).

## Going back
* Vercel → Instant Rollback to update-169. The bills saved meanwhile stay as they are – the Uom inside their lines.
* A bill saved at VTR / 18B stays in its table, but the page is hidden there again.
