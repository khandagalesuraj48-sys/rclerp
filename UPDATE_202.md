# update-202 – bills in whole rupees; the Head Office signatures on the Abstract (02-11-2026)

**Asked:** "aik apan je bill banwato te point madhe yet jas ki 333.2 1023.1 … amount mala decimal madhe nko aahe round off amount
hawwet jas ki .5 che aat asel tr 1 .5 che nantr asel tr next amount as mhanje 12.3 he round off hoil 12 ani 122.6 r ale tr te hoil 123
as perfect billing haway ani ha bill madhe 2 sign wadhwayche aahet fkt abstract warti jith head office sign krtil asa section haway …
verify by ho account ani checked by ho account". Pictures shown on the rig; his changes (02-11-2026): "headoffice section adhi checked
by nantr verifyd by as ani etke moth nko normal banaw but sign krta yawi abstract warun checked by billing department he remove kr";
then "PR de ani swata merge kr".

**No database step.** A bill made from now on carries `data.round`; nothing saved before changes.

## The rule (a bill built after this update – `b.round`)
* **Every line's amount** (days / hours / KM / trips × rate), **each machinery's diesel debit**, the **other deduction (C)**, **GST**
  and **TDS** are rounded to the rupee: below 50 paise down, 50 paise and above up (12.3 → 12, 122.6 → 123, 1,02,712.50 → 1,02,713;
  `r0` / `r0_`). A, B, D, G, I, K are their sums – so A − B − C = D, D + E + F = G, G − H = I add up to the rupee.
* Rates, quantities and litres stay as they are (₹2,741.94 / day, 83 Hrs, 12.35 L).
* The differences of earlier bills taken in a new bill (update-108) are worked out in rupees too.
* An open debit note made before (with paise) is taken as it is – J / K then show its paise.
* **A bill made before keeps its figures and its papers** (paise, the 7 signatures): worked out again later (corrections) with the
  rule it was made with.

## What changes
* **Server (`app/Code.gs`)** – `r0_`; `billMachineCalc_(…, rnd)`: the lines and the diesel debit in rupees; `verifyBills_` works the
  bill out with its own mark (`b.round`) – C, GST and TDS in rupees; `billNowFig_` with the saved bill's mark; `billCorrections_` in
  rupees.
* **Page (`app/App.html`)**
  * Machinery Billing: `mbFill` marks a new bill (`b.round`), `mbMachine` / `mbTotals` in rupees; the list shows rupees.
  * The Abstract, Tax Invoice and Debit Note: amounts without paise (`mbA`); the Abstract without **"Checked By – Billing Dept"**
    (6 signatures) and, under them, a **HEAD OFFICE** row – **Checked By, then Verified By (HO Accounts)**, room to sign, not big.
    Only on the Abstract.
  * The bill's Log Book sheet (on the bill page, "Log Book", a saved bill's – as submitted): the bill's own amount and diesel debit
    of each machinery, GST / TDS / net in rupees (`lbFig`).
* **Phone app (rcl-mobile 3.75.0, branch `app-3750-whole-rupees`)** – the same rule, papers, list and Log Book sheet; its test against
  the web's own code (`test/fixtures/bill/web_round.json`, made in the page on the rig).

## Evidence
* Unit **155 / 155** (new `update-202`: the rule (12.3, 122.6, 122.5, −12.5 …); the bill he was shown – RW-1 monthly ₹85,000 for 26
  days 71,290.32 → 71,290, RW-2 83 hrs × ₹1,237.50 = 1,02,712.50 → 1,02,713, diesel 1,140.77 → 1,141 and 1,625.71 → 1,626; A 1,74,003,
  B 2,767, D 1,71,236, GST 15,411 + 15,411, TDS 1,712, Net 2,00,346; verified ("Totals are correct … ₹200346") and submitted with its
  mark; worked out again later: the same rupees; a bill in paise still verifies the old way; the page's `mbTotals` = the server's; the
  Abstract of a new bill (no Billing Dept, the Head Office in that order) and of an old one (as it was)). Two older paper tests given
  the page's new formats. `node --check`; the page's script blocks parse.
* The rig in Chromium (test vendor "Round Rig Vendor"): the list, the Abstract, Tax Invoice (Total 2,02,058, in words), Debit Note
  (1,141 + 1,626 = 2,767), the Log Book sheets (₹ 71,290 / ₹ 1,02,713, − ₹ 1,141 / − ₹ 1,626, TDS, net – no paise); Verify & Submit:
  "Totals are correct … Net Payable ₹200346", saved with `round` true, net 200346; the saved bill's papers and its Log Book (as
  submitted) the same; no page fault.

## Not verified
* No older bill was saved on the rig: an older bill's papers were checked by the unit test only.
* A page opened before this update (not reloaded) still builds bills in paise – they verify and save the old way; reloading the page
  (or the app's update) gives rupees.
* The live database: nothing changes there until a new bill is built.
* The phone app: its build on GitHub (analyze, tests) – see its pull request; a real phone.

## Going back
Vercel → Instant Rollback to the previous deployment. Bills saved with `round` keep their rupees (a saved bill is never changed).
