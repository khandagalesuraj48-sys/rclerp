# update-116 – "Send to verification", sent back with a question, diesel KM / Hrs by itself (15-10-2026)

**Asked:** "mahesh la save as isnarch nahi direct sent to verification … jr koni asign nasel approval sathi tr save option disel …
draft mhanun save asel jewa shubham approval deil tewa actual save hoil … shubham ek ek entry save kru shakto bulk entry save kru
shakto aleli entry revert kru shakto remark deun mahesh la question vicharu shakto jr revert zal tr mahesh la continue push
notification jatil" and "diesel issue madhe … gadi km aahe hrs aahe ki km+hrs aahe he pn auto select asaw … koni te manual nahi
taknar".

## What changes
* **The button says "Send to verification"** (amber) instead of "Save …" for a work the Super Admin put under verification for
  this person; it says to whom (hover). With an "only when" (days back / litres) it changes while the form is filled (40 L →
  "Save diesel issue", 300 L → "Send to verification"). A work nobody approves keeps its "Save". The Super Admin always "Save".
  Pages: Diesel Issue (one, many, one machinery – many dates), Inward, Transfer (one, many), Log Book (entry, Edit Log Book, water
  tanker, tank check), Asset Master, Vendor Master, BOQ, Payments, Debit Note, Verify & Submit, Breakdown.
* Until the last level approves, the entry is a **draft** (a request – nothing in the data), as in update-114.
* **Send back** (one, or several ticked): the approver writes a remark / question; the entry goes back to the sender – nothing saved.
  * The sender sees **"Sent back to you"** with the question: **"Answer and send again"** (his answer goes with the same entry to
    the same level) or **"Take back"** (not saved; a changed entry is entered anew).
  * He is **reminded every 30 minutes** (notification) until he answers or takes it back.
  * Every step is kept (Sent – Sent back – Answered – Approved).
* **Diesel Issue: KM / Hrs / KM + Hrs by itself** from the Asset Master (one, many rows, one machinery – many dates). Nothing to
  pick; only **"Meter not working"** stays (pressed again: the reading again). The Log Book keeps its choice (not asked).
* No SQL step.

## Evidence (local rig, test data only)
* Unit 80 / 80 – new "update-116": his rules reach getInit and Approvals (none for the Super Admin); send back needs a remark,
  notifies the sender, is not decidable meanwhile; only the sender answers; reminders after 30 min, once per 30 min; answered →
  same level → approved → saved; sent back with several at once; taken back → not saved, cannot be answered; the page's buttons
  and its `dieselWay` (KM, Hrs, KM + Hrs, none) on Asset Master machinery.
* Browser `test/browser/flow116.js` 18 / 18: 40 L "Save diesel issue", 300 L "Send to verification"; KM chosen by itself, "Meter
  not working" on / off; sent; the checker sends it back with a question; the maker's open page shows "Sent back to you 1" by
  itself; he answers; the checker approves → saved as the maker's; no page error.
* Old browser tests: flow114 12, billed108 24, lang110 17, entry71 20, dnui 8, item2 13, half 12. meter.js fails 1 and set2.js
  fails 1 the same on the main code (rig data / photo – not caused by this).

## Not verified
* Live sites. The phone app's part is version 3.1.8 (its own pull request).

## Going back
Vercel → Instant Rollback to update-115. Entries sent back stay in `billed_changes` with Status "Reverted" (the older code does not
show them; nothing of them is saved).
