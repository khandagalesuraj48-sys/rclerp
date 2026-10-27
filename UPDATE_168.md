# update-168 – a maintenance bill as the garage's bill: every line with its kind, Qty, Rate, Discount; insurance claims (27-10-2026)

**Asked (27-10-2026, with a picture of the Maintenance form and 9 of his bills – service, labour, parts, an accident / insurance
claim):** "he bgh as yet aahe but ata kahi bill deto tyanchi reading bgh kahi material warranty madhe aste kahi paid aste kahi
discount deun aste tr sagle kahi yeyla hawa ok and type pn krta yayla hawa ok … mala proper banaun de".
**His answers (the three questions asked first):**
* the car's cost = **only what we paid** (a warranty / free line is not a cost; an insurance's part is not our cost);
* each line = **Work / part · kind (Paid / Warranty / FOC / Service Plan) · Qty · Rate · Discount % · ₹**;
* an insurance claim = **one bill** with the whole amount, **what the insurance paid** and **what we paid**.

**What his bills showed (read here, not kept anywhere):** a Type column (Paid / Warranty / FOC / Service Plan) where the free
lines carry ₹ 0; a discount % on a line (up to 100 % for a service plan); more than one invoice of the same job in one PDF (parts
and labour, a payment receipt); an accident set of 65 lines billed to the insurance company with the customer's part shown
apart. Before this update the AI's reading dropped every ₹ 0 line (the warranty / free ones), the form had only "Work / part" and
"₹", and the car was never taken from the bill's vehicle number.

**No database step.** The lines are the one text column `lines` of `maintenance` (step 1zi) – the new fields go inside it.
**No secret in any file.**

## What changes
* **A line of a bill** (`maintLines_`): its work / part, its **kind** – Paid, Warranty, FOC or Service Plan (a line of before,
  without a kind, is Paid) – its **Qty**, **Rate** and **Discount %** when the bill has them, and its **₹**:
  * a **Paid** line needs its ₹ (what the bill charges for it; taxes, the round-off and a discount on the whole bill are Paid lines
    of their own, a discount a minus ₹);
  * a **Warranty / FOC / Service Plan** line is kept with ₹ 0 charged; what it is worth (Qty × Rate) is shown.
  * Checks (with help in English / मराठी / हिंदी): the kind; a Qty or Rate below 0; a discount outside 0 – 100 %. A bill may now be
    only free lines (₹ 0); below 0 is refused ("The total of the bill cannot be below 0 …"). A bill keeps up to 150 lines (was 60).
* **An insurance claim** (`maintIns_`): the insurance company, its claim number and what it paid – never more than the bill. It is
  kept as one more line of the kind "Insurance" with a minus ₹, so the bill's lines still add up to the bill's **Amount = what WE
  paid**. Everything that counts money counts that: the list and its total, the car's Maintenance Log Book (maintenance, all costs,
  ₹ per KM), the Excel and the print.
* **The server's answers** (`getMaint`, `maintLog`, `saveMaint`, `updateMaint`): a bill also says its `billTotal` (its Paid lines),
  `insurance` ({ company, claimNo, paid } or null) and `free` (what its free lines are worth); the log book's maintenance total
  says the bills, the insurance and the free worth too; "by work / part" counts only Paid lines.
* **An app of before** (its lines have no kind) cannot change a bill that has free lines or an insurance part – they would be lost:
  "Bill MT-… has free lines (Warranty / FOC / Service Plan) or an insurance part – update the app to change it." (every other bill
  it changes as before).
* **The AI reads the bill** (`maintRead_` / `maintAnswer_`, Claude or Gemini – the same question):
  * EVERY item of every invoice in the file, also the free ones, each as a short array `[work, type, qty, rate, discount, amount]`
    (a bill of 60+ lines is read in time; the long form is still taken);
  * more than one invoice of the same job in the file (parts + labour + a receipt) = ONE bill (their numbers joined);
  * the kind as the bill's Type column says (a line charged ₹ 0 without a kind = FOC);
  * an insurance claim: the insurer, the claim number, what the insurance paid – or the bill less what the customer paid;
  * with Claude a bill gets 50 seconds (was 40; a server call has 60); Gemini's time as before.
* **The page Maintenance (web):**
  * the lines: **# · Work / part · Kind · Qty · Rate (₹) · Disc % · Amount (₹)** – a Paid line's ₹ is worked out from Qty × Rate −
    Disc % when Qty and Rate are typed (it can still be typed); a free line is green, its ₹ 0 (not typed), "worth ₹…" under it;
  * under the lines: **Bill total** (the Paid lines) and "Free lines … – not paid, worth ₹…"; a tick **"Insurance claim"** opens
    the insurance company, claim no., paid by the insurance and **We paid (₹) – the car's cost**;
  * "Read the bill (AI)" also puts **the car** (from the bill's vehicle number, when the box is empty and the car is in the Asset
    Master – else it says "… it is not in the Asset Master: pick the car."), every line's kind / Qty / Rate / Disc %, the insurance
    part – all blue until changed;
  * the message after saving: "… (We paid ₹821.00 of ₹2,821.00.)";
  * the list: the Work / parts wrap (3 lines – all of it on pointing and in Edit), a free line with its kind ("Oil filter
    (Warranty)"), under the ₹ (what we paid): "bill ₹…", "insurance ₹… (company)", "free worth ₹…"; it fits the page;
  * the car's log book (screen, print, Excel): each bill with its notes; "Maintenance – n bill(s) – we paid (bills ₹…, insurance ₹…)
    · free lines worth ₹…"; "by work / part" ends with "Paid lines of the bills", "Paid by the insurance −₹…", "We paid".
  * In मराठी / हिंदी the kinds are shown in the language (वॉरंटी, सर्व्हिस प्लॅन …) and sent in English, as every drop-down.
* **Help and words:** the maintenance help rule (FIX_RULES) knows the new messages and says what to do (en / mr / hi); the page's
  guide (`mnt`) names the kinds, Qty, Rate, Discount and the insurance; `app/i18n`: 58 new texts in Marathi and Hindi, 8 old ones
  out (the AI's question in English is not translated, as before).
* **The phone app** (rcl-mobile **3.49.0**, its own pull request – the app's own screens): each line a card with Work / part, Kind,
  Qty · Rate · Disc % · ₹ (worked out the same way; a free line green, ₹ 0, its worth); Bill total, free worth, the insurance switch
  and boxes, We paid; "Read the bill (AI)" with the car, the kinds and the insurance; the list (we paid, the notes), the bill's sheet
  (each line, Bill total, Paid by the insurance, We paid, Free lines worth), Change, and the car's log book as the web.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **122 / 122 pass** – new `update-168` (his labour bill 07668 – Paid lines with Qty /
  Rate, a Warranty line kept at ₹ 0 with its worth; his parts bill 02040 – a 5 % discount and a Service Plan line; the checks of a
  line; a bill only of warranty lines; an insurance claim – the checks, we paid ₹10,856 of ₹2,16,499, the Amount, the list, the log
  book's totals and "by work"; the old-app guard; a plain change; the insurance kept or taken out on a change; a line of before read
  as Paid; the AI's short lines, several invoices, the insurance from what the customer paid). Older tests changed on purpose: the
  message "cannot be below 0", 150 lines, a ₹ 0 line now kept as FOC, the lines with their kind, the log book's new totals.
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: no call lost in Code.gs, Sites.gs,
  SupabaseData.gs, SupabaseSync.gs, server/portal.js; App.html one `.trim` and one `.slice` fewer – both in the old line code this
  update replaced (`mtLinesNow` / `mtLines`); no secret in the change.
* **The local rig** (Postgres + PostgREST + Portal + Mechanical; site T2 plays HO on fuel cards; the AI is a stand-in – no real
  Claude or Gemini was asked; test data only, taken out after each run; the Portal's own `api.test.js` 117 / 117 first):
  * new `test/browser/mnt168.js` **29 / 29** with the **Claude** stand-in and **29 / 29** with the Gemini one: the server part above
    end to end in the database; the AI's short lines; the page – the car from the bill's number, the 8 lines with their kinds /
    Qty / Rate / Disc %, the free lines (₹ 0, worth ₹2,340 / ₹350 / ₹250), Bill total ₹2,761, free ₹2,940, the insurance (₹2,000),
    We paid ₹761; a discount typed away (₹ 600), a kind changed and back; the insurance more than the bill refused; saved – the
    Amount ₹821, the insurance line; the message; the list's notes and that it fits the page; Edit; the car's log book; मराठी – the
    kinds in Marathi, sent in English, the bill saved.
  * `mnt165.js` (update-165's whole page) **32 / 32** on this branch with Gemini and with Claude.
  * Pictures (rig): the form with the lines, the insurance part, the list, the log book, the form in मराठी.
* **Not verified:** a real AI reading of his 9 bills (no AI key here – the stand-in gives the answer a model would; the question was
  made from his bills' columns); the phone app on a real phone (its build runs analyze, the tests and draws the screens).

## Going back
* Vercel → Instant Rollback to update-167. The bills saved meanwhile stay as they are: their Amount is what we paid; their extra
  line fields (kind, Qty, Rate, Disc %) and the insurance line stay in `lines` – update-167 shows the insurance line as a line with
  a minus ₹ and the free lines at ₹ 0.
