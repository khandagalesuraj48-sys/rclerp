# update-133 – BOQ print: the work order on top; an amendment prints as an amendment letter (19-10-2026)

**Asked (with a picture of the print of "BOQ 2 (Amendment 1 of BOQ 1)" and of a paper "Amendment letter Of Intent"):** "ata je boq
bantat je amendment bante tya warti work order number date he sagle yeu de ja n mi image jodla aahe ata fkt etkach distey so he
proper amendment watayla haw example sathi mi ajun ek photo add krt aahe te pn bgh".

## What changes (Vendor BOQ → Print)
* **Every BOQ print: the Work Order No and the Work Order Date on top** (right side, under the BOQ ID). Until now they were saved
  with the BOQ but not printed.
* **An amendment prints as an amendment letter** (like his example):
  * on top: "Amendment Letter – Amendment 1 of BOQ 1", BOQ ID (BOQ 2), Work Order No / Date, "With effect from";
  * **To,** the vendor, his address and contact number;
  * **Subject:** "Amendment 1 of BOQ 1 – change of rate for 01 Nos Water Tanker.";
  * **Reference:** "Work Order No. … dated …; BOQ 1 (BOQ-…) from … to …." – an amendment without a work order of its own takes
    the work order of its BOQ;
  * "Dear Sir, With reference to the above work order, we are changing the rate of the machinery given below (Annexure-I) **with
    effect from 01-09-2026**. The other machinery of BOQ 1 and all other terms and conditions remain the same.";
  * **Annexure-I**: each machinery – type, rent type, the **earlier rate** (till the day before, from the rate history of
    update-132 = the rate the bills took) and the **new rate**, diesel, remark;
  * the vendor's details (GST, PAN, TDS %, bank), all versions of the BOQ (as before);
  * "For and on behalf of <the name chosen on top>." and the signatures **ACCEPTED BY VENDOR** / Prepared by / Approved by.
* An original BOQ prints as before (+ the work order on top).
* The phone app prints the same (App 3.24.0).

## Server
No change (no SQL). Page only: `boqPrint` in `app/App.html` (+ the letter's print styles `.bl-to` / `.bl-p` / `.bl-for`).
`app/i18n`: the word list refreshed; four words of the old amendment heading taken out of मराठी / हिंदी (no longer on the page).

## Evidence
* **Rig browser test** `test/browser/boqprint133.js` **4 / 4**: BOQ 1 (01-08 – 31-08-2026, work order SLI/VTR-Office/WO/2024-2025/73
  of 01-05-2024, two tankers) and Amendment 1 (no work order of its own; one tanker ₹1,200 from 01-09-2026) – the print of BOQ 1 has
  the work order number and date on top; the print of the amendment has To / Subject / Reference (the work order of BOQ 1) / "with
  effect from 01-09-2026" / ₹1,000 till 31-08-2026 → ₹1,200 / "For and on behalf of" / "ACCEPTED BY VENDOR", the other tanker not
  in the annexure. Picture: `test/shots/boqprint133.png` (local).
* `boqhist132.js` 4 / 4 again.
* **Unit tests 94 / 94** in 4 full runs in a row. Before them "update-117" (the diesel places of a site – it does not touch the BOQ
  and is not changed here) failed in 2 full runs; it passed alone and in those 4 runs. The cause was not found (not seen again).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* The live print of PRAJAY ENTERPRISES' amendment (BOQ-0023): if BOQ-0019 was saved without a work order number, the letter has
  none either – fill it with Edit on BOQ 1 (or on the amendment).
* Printing on paper / Save as PDF in a real browser (the test reads the print page; the picture is of the same page).

## Going back
Vercel → Instant Rollback to update-132. Nothing is saved differently.
