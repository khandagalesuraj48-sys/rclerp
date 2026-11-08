# update-169 – a service bill is not read as an insurance claim (27-10-2026)

**Seen (27-10-2026, 17:57, his pictures of the live page at HEAD OFFICE):** his Navnit Motors bill **04590** (general repairs,
paid in cash; its vehicle details say "Insurance Co : Others"). "Read the bill (AI)" read all 11 lines well: the Service Plan
lines at ₹ 0 with their worth, the FOC line, the taxes, the adjustment; Bill total ₹7,475.00. But it also ticked **"Insurance
claim"**, with the insurance company "TATA AIG GENERAL INSURANCE CO LTD" and no amount. Saving then said "The insurance part of
the bill: enter what the insurance paid (₹)". Nothing was saved. This bill is not a claim: it shows no insurance or customer
liability, and the vehicle's "Insurance Co" detail is not a claim.

**No database step. Nothing else changes.**

## What changes (app/Code.gs)
* **`maintAnswer_`:** the AI's insurance part is taken only when it says **what the insurance paid**. That is either the
  insurance liability, or the bill less what the customer paid, more than 0 and not more than the bill. An insurance company alone
  is not a claim: the "Insurance claim" box stays unticked. The person can still tick it and type it.
* **The question to the AI (`maintRead_`):** "insurer" only when the bill is an insurance claim. That means it is billed to an
  insurance company, or it shows the insurance / customer liability. A vehicle detail "Insurance Co" alone is NOT a claim.
* His accident bill (Tata AIG, ₹12,30,893; customer liability ₹10,856) is read as before. The insurance paid comes to ₹12,20,037.
* Not in the phone app's code: the app takes the server's answer as it is.

## For bill 04590 now (before this update is live)
Untick **"Insurance claim"** and press **Save bill**.

## Evidence
* `timeout 300 node --test test/unit.test.js` passes **122 / 122**. `update-168` now also checks these four cases:
  * his 04590: insurer "Others", no amounts → no claim;
  * a company with what we paid = the whole bill → no claim;
  * the insurance more than the bill → no claim (was: the company without an amount);
  * the new words of the question.
* Rig, Claude stand-in: `mnt168.js` **29 / 29** and `mnt165.js` **32 / 32**. The Portal `api.test.js` passed 117 / 117 first.
* `app/i18n/keys.json`: the one changed sentence of the question swapped. The AI's question is not translated.

## Not verified
* What the real AI read on his 04590 file: it is not kept. The picture shows the company as read by the AI (blue), with no
  amount.
* A real re-read of 04590 with the new question. That is for after the merge: press "Read the bill (AI)" again on a new form.

## Going back
Vercel → Instant Rollback to update-168.
