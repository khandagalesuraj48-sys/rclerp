# update-199 – the month-end tank check decides the diesel debit (02-11-2026)

**Asked (with the Bill_preview of MH09BC2570, 01-10-2026 to 31-10-2026, 104.8 L debited although the tank capacity of 220 L was set):**
"ya month end la pratek vehicle balance deisel 01-11-26 sathi opening ghe tithun daily tula opening closing bhetat jail … 30 or month
end last date la bill close krte weli tank check mhanje tank balance takne mandatory aasel … system show krel as per system stander
etke etke balance asayla hawa aahe … user quantity takel same takli aahe balance as tr te next day opening … kami takli jitki kami
apdle mhanje ti debit hoil … system mhannty 100 balance hawa ahe tank check 80 ale tr opening 80 hoil but 20 ltr debit pn jail …
tanck check qty taktana asset madhe tank capacity takne mandetory asel tya shiway nahi honar".
His answers (02-11-2026): more found than the system → that is the opening, no debit, no credit; the October bill too, with the
check of 31-10 (opening of 01-10 = 0); the check is needed only for machinery of the bill with company diesel and a system balance.

**No database step.** The tank checks are kept where they always were (`tank_check`).

## The rule (a bill period that ends on or after 31-10-2026; a machinery with a Standard Average)
* **Opening** = the diesel found at the tank check of the day before the period (none → 0; the first one is 31-10-2026, so October
  starts at 0 even when a check of 30-09 exists).
* **System** = Opening + company diesel issued in the period − the standard for the work of the company days.
* System **above the Tank Capacity** → that part is debited at once (the tank cannot hold it).
* The **tank check of the last day** of the period: **found less** → the shortage is debited; **the same or more** → nothing debited,
  nothing given back. Either way the found diesel is the next period's opening.
* System 0 or less → no check needed, nothing debited. System above 0 and **no check → the bill cannot be verified / submitted**.
* **Final bill** (the machinery left the site) → the whole System is debited; no check needed.
* Debit Basis days as before: their diesel is debited in full and their work is not counted.
* A bill **up to 30-10-2026** keeps the last-fill rule ("taken as still in the tank"). A bill **submitted before this update** keeps the
  rule it was made with when it is worked out again (corrections, update-108): a new bill is marked `data.tankRule`.

## What changes
* **Server (`app/Code.gs`)**
  * `TANK_RULE_FROM_`, `tankMonthEnd_`; `logPrintExtra_` gives each machinery's opening and month-end check (`checks`) for dates ending
    on or after 31-10-2026 – their being there puts the bill on the rule; `billMachineCalc_` returns `tc` (the figures) and debits
    `tc.debit`; `verifyBills_`: ✖ "tank check of … is needed – as per the standard … L should be in the tank (opening + diesel −
    standard)", ✔ the check and the shortage, ⚠ above the tank; `submitBills_` marks `data.tankRule`; the bill's evidence (update-151)
    keeps the checks it stands on; `billNowFig_` works an unmarked bill out with its old rule.
  * **Every tank check needs the Tank Capacity** of Asset Master ("Set the Tank Capacity of … first"), and nothing more than the tank
    holds can be found. The tank check a **submitted bill stands on** (its last day, or the day before it – its opening) is the Super
    Admin's only (`tankLock_`, also Delete); the Super Admin's change keeps the bill's "before" (`BL_FNS_`, `billBaselines_`) so the
    difference goes to the vendor's next bill.
  * New action **`saveBillTankCheck`** (Machinery Billing, Edit; saved once): the check of the bill's last day from the bill – the
    server works the bill out again and keeps its system figure; "Change" puts the new check in place of the old one (one save). Every
    rule of a tank check applies (date rules, month close, capacity, the bill lock). Activity Log: "Tank check (month end, from the bill)".
* **Page (`app/App.html`)**
  * Machinery Billing: the same rule (`tankMonthEnd`); the bill says "tank check of … needed"; a **Tank check (month end)** box under
    each bill for each machinery that needs one – what should be in its tank (opening + issued − standard), the diesel found → Save
    (Enter) / Change; the bills are worked out again at once.
  * The Abstract's line B, the Debit Note ("Diesel short in the tank at the check of …", "Diesel above the tank capacity …"; a final
    bill: "Diesel in its tank … left the site") and the note under it say the calculation.
  * **The Log Book sheet** (the bill's, Print Log Book, a saved bill's): the diesel columns now run day by day from the opening – a
    row's diesel added, its work at the standard taken off = its closing, the next row's opening (a debited day's diesel in and out);
    under it "TANK CHECK – <date>": opening + issued − standard = system, found and short; "DIESEL SHORT – DEBIT AMT". A bill before
    31-10-2026 prints as before (opening / closing 0).
  * Tank Check page: "Tank Capacity not set in Asset Master – set it first, a tank check needs it".
  * Help (English, Marathi, Hindi) for every new message; the page guide of Machinery Billing and Tank Check.
  * **Found on the way:** since 23-10-2026 the page's bill used the date a machinery left (`leftOn`) without making it – a **final bill
    stopped the page with "leftOn is not defined"**. Made, as the server's.
* **Phone app (rcl-mobile 3.72.2, branch `app-3722-tank-check`)** – the same rule, the box on the bill, the papers and the Log Book
  sheet, the Tank Check note.

## Evidence
* Unit: **152 / 152** (new `update-199`: the October bill without a check (✖), the check from the bill (110 L → 40 L short, ₹4,000),
  a second check refused, Change (160 L → nothing), the bill verified and submitted with its mark; November's opening = 110 L; above
  the tank (debited at once); a final bill; no capacity / more than the tank refused; the submitted bill locks its 31-10 check (not
  the 30-09 one); the Super Admin's Change; an unmarked bill keeps the last-fill rule; the page's `tankMonthEnd` = the server's for
  five cases; the help). `node --check` on server/*.js, api/*.js; the page's script blocks parse.
* The rig in Chromium (test machinery TCR-1 / TCR-2 only): the warning and the box; 250 L refused (tank 220 L); 110 L saved → "found
  110 L → 40 L short – debited", B ₹4,000, the database row (system 150, found 110, the reason written by itself); the Abstract, the
  Debit Note and the Log Book sheet (daily opening / closing 0 → 150, the tank check rows); Change to 160 L → nothing short, still one
  check; Verify: "tank check of 31-10-2026: 150 L as per the standard, 110 L found – 40 L short, debited. Opening of the next bill:
  110 L." – no ✖; no page fault.
* The web's own code run in the page on the rig made the phone app's fixture (`test/fixtures/bill/web_tank.json`: check missing,
  found, above the tank, above + short, final, November's opening, a bill before 31-10).

## Not verified
* The live database: the October bills already submitted (if any) keep their last-fill rule; a new October bill needs the checks of
  31-10-2026. The month close (Admin) and the users' date rule apply to the bill's check as to every tank check – an older date
  needs the Admin.
* The dashboard's diesel recovery estimate of a running month now shows only what is above the tank until the month-end check.
* The older browser tests that need puppeteer-core (not on this computer) were not run; their periods are before 31-10-2026.
* The phone app: its build on GitHub (analyze, tests) – see its pull request; a real phone.

## Going back
Vercel → Instant Rollback to the previous deployment. Checks saved stay in `tank_check` (they are ordinary tank checks); bills
submitted with the mark keep their saved figures (a saved bill is never changed).
