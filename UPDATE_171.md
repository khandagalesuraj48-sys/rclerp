# update-171 – each item its GST (the rates in the heading) and who paid it, in the entry and the log book (27-10-2026)

**Asked (27-10-2026, with a picture of the log book print of his bill 04590):** "tu gst asa ekdam nahi dakhwaycha item wise gst
asel jr lagla asel tr bro ani gst raw madhe nko heading madhe ghe 9 9 18 as ok ani ha koni paid kel insurance claim aahe nahi
service ch bill ahe ka as sagle haway etial madhe entry krtana pn ani log print madhe pn".

**His answers (asked first):**
* "are heading madhe gst rate astil item samor gst chi amount yetil" – the rates in the heading, each item its GST amount;
* the entry: **one GST % for a line** (e.g. 18) – CGST and SGST are half each;
* **each line its "Paid by"** (RCL / Insurance / Warranty / FOC / Service Plan) and the bill's **Insurance claim** and **Service**
  on every line of the log book – in the entry and in the log print, on the web and in the app.

**Before this update** (update-170, as he had chosen then): the taxes were lines of their own ("CGST 9%", "SGST 9%") and the log
book put their ₹ in one "GST Amount" column; a line said only its kind (Paid / Warranty / FOC / Service Plan); an insurance claim
was a tick with the ₹ typed.

**No database step.** The GST % and the new kind sit inside the `lines` text of `maintenance` (step 1zi). **No secret in any file.**

## What changes
* **A line of a bill** (`maintLines_`):
  * its **GST %** – one number, 0 to 100 (CGST and SGST are half each); kept when above 0. The line's GST is its CGST and its SGST,
    **each rounded** to the paisa, as the bills print them (`maintGstOf_`): his Battery line ₹724.59 at 18 % → ₹855.01.
  * its **Paid by**: **RCL** (kept as before as "Paid"), **Insurance** ("By Insurance" – a new kind: charged, the insurance paid
    it), Warranty, FOC, Service Plan. The message: "Bill line N (work): Paid by is RCL, Insurance, Warranty, FOC or Service Plan."
    and "…: the GST is 0 to 100 %." (help in English / मराठी / हिंदी).
  * the Amount of a line is **before GST**; the bill's total is its RCL and Insurance lines **with their GST**
    (`maintLineTotal_`) – the list, the bill's ₹, the car's log book, "by work / part", ₹ per KM all count it.
* **The insurance part** (`maintIns_`): when lines are paid by the insurance, what the insurance paid **is those lines with
  their GST** (not typed) and the insurance company is needed; without such lines it is typed as before.
* **An app of before** (its lines carry no GST) cannot change a bill that has a GST % or lines paid by the insurance (they would
  be lost): "Bill MT-… has the GST of its lines or lines paid by the insurance – update the app to change it."
* **The AI reads the bill** with each item's GST: `[work, type, qty, uom, rate, discount, gst, amount]` (the 7- and 6-value forms
  of before are still read); it is told not to give the taxes as lines of their own and that the lines with their GST make the
  grand total (its check "the lines read add up to …" counts the GST).
* **The page Maintenance (web):**
  * the lines: **# · Work / part · Paid by · Qty · Uom · Rate · Disc % · Amount (₹) · GST % · GST ₹ · With GST** – GST ₹ and With
    GST are worked out as typed; a line paid by the insurance is light blue;
  * **Bill total** is with GST; a line paid by the insurance ticks **Insurance claim** by itself and puts "Paid by the
    insurance (₹)" (not typed); **We paid** = the rest;
  * the note under the lines says: Amount before GST, GST % of each item, no tax lines, Paid by RCL / Insurance / Warranty / FOC /
    Service Plan;
  * the list shows each line's ₹ with GST, "(Insurance)" after a line paid by the insurance.
* **The Maintenance Log Book (screen, print, Excel)** – his columns with the GST in the heading:
  **Sr No · Date · Party Name · Current Reading · Particulars · Qty · Uom · Basic Rate · Amount · CGST 9% · SGST 9% · [the same
  pair for every other GST % of the lines] · GST 18% (or "GST Amount" when the lines have several rates) · Amount With GST · Paid
  by · Insurance claim · Service · Total**
  * each item its CGST and SGST in its rate's columns; no tax row;
  * **Paid by** on every line (RCL, Insurance, Warranty …); **Insurance claim** (Yes / No) and **Service** (Yes / No) of its bill
    on every line;
  * the insurance's row "Paid by the insurance – company" (minus ₹, Paid by "Insurance") as before;
  * the Total line: Amount, each CGST / SGST column, GST, Amount With GST, Total (= what we paid);
  * **a bill of before** with tax lines ("CGST 9%", "SGST 9%"): their ₹ go into the matching CGST / SGST column by the % in their
    name (an IGST / GST line: in the GST column).
* **Help and words:** the maintenance help rule (FIX_RULES) knows the new messages (en / mr / hi); the page's guide names GST % and
  Paid by; `app/i18n`: 18 new texts in Marathi and Hindi, 7 old ones out.
* **The phone app 3.51.0** (rcl-mobile, its own pull request – the app's own screens): each line card has **Paid by** (RCL /
  Insurance / Warranty / FOC / Service Plan – shown so, the kinds sent as before) and **Amount (₹) · GST %**, under them "GST ₹… ·
  With GST ₹…"; the bill total with GST; a line paid by the insurance turns the claim on and fills "Paid by the insurance" (not
  typed); the list and the bill's sheet show ₹ with GST, GST % and who paid; the car's log book in the columns above.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **124 / 124 pass**. The new `update-171` test checks:
  * his bill 04590 typed with GST 18 % per item: total ₹7,475, "by work" with GST (Battery ₹855.01 – CGST and SGST each rounded);
  * an accident bill: RCL ₹1,180 and Insurance lines ₹18,700 – bill ₹19,880, the insurance part ₹18,700 taken from the lines, we
    paid ₹1,180; the company needed;
  * the GST check, the Paid by message, the old-app guard;
  * the AI's 8 values and its question;
  * the page: the lines' heading (Paid by, GST %, GST ₹, With GST), the log book's heading with the CGST / SGST rates, Paid by,
    Insurance claim, Service.

  Older checks changed on purpose: the kind message ("Paid by is …"), the AI's line form, update-170's log book heading, the Sr No
  column's width.
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: **no call lost** in App.html, Code.gs,
  Sites.gs, SupabaseData.gs, SupabaseSync.gs, server/portal.js; no secret in the change.
* **The local rig** (Postgres + PostgREST + Portal + Mechanical; test data only, taken out after each run; the AI is a stand-in –
  no real Claude or Gemini was asked):
  * `test/browser/mnt170.js` **18 / 18** (S1 plays VTR, with step 1zi), changed on purpose: the typed bill carries GST 18 % on
    each line; a line paid by the insurance ticks the claim by itself; the log book in the new columns – CGST 9% / SGST 9% / GST
    18%, Paid by, Insurance claim, Service – Total ₹29,180.00 / ₹2,626.20 / ₹2,626.20 / ₹5,252.40 / ₹34,432.40.
  * `mnt168.js` **29 / 29** (Claude stand-in), changed on purpose: the Paid by heading, the GST columns, the log book's rows and
    Total (the tax lines of that bill now in their CGST / SGST columns).
  * `mnt165.js` **32 / 32** (Claude stand-in) – the whole page of update-165 still works.
* **Not verified:**
  * a real AI reading of his bills with GST per item (no AI key here – the stand-in gives the answer a model would);
  * the other browser tests of the rig were not run again (the change is only in Maintenance);
  * the phone app on a real phone (its build runs analyze, the tests and draws the screens).

## Going back
* Vercel → Instant Rollback to update-170. The bills saved meanwhile stay as they are: update-170 reads a line with a GST % as
  its Amount without the GST, and a line "By Insurance" as a Paid line – so such a bill should be typed again with tax lines
  after going back.
