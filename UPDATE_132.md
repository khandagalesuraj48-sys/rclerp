# update-132 – BOQ: amendment also after the BOQ ends; the rate history machinery-wise (19-10-2026)

**Asked (with pictures of "The amendment must start inside the BOQ period (01-08-2026 to 31-08-2026)"):** "agodrcha boq 1 number cha
aahe 31 08 26 prynt ok nantr mi 01 09 26 pasun …", then "mala work order number change nahi karaycha … tyach work order madhe amendment
… ji amendment jya gadi chi zali asel tya gadicha to rate … lagu hoil … amendment multiple hou shaktat … period wise", "mala disayla
haw old kay hot nantr amendment zali kadhi … boq period wise ani vehicle wise", and his example: "1234 … 01 01 26 pasun rate 100 …
01 02 26 … amendment … 200 … tyach gadich boq change hoil baki konacha sambandh nahi … jewa tya party war jail mi tewa mala disel 01
month sathi yacha ha rate hot … second month la ha rate hot … ani hi rate change zal tya sathi amendment pn dili aahe".

## What changes
* **Make amendment from any date on or after the BOQ's start – also after it ends.** Only the machinery in the amendment get the
  new rate from that date (the same work order); the other machinery of the BOQ stay as they are. Several amendments are fine.
  (Until now the amendment had to start inside the BOQ's period: 01-09 for a BOQ that ended 31-08 was refused.)
  * The amendment form says: "Keep only the machinery whose rate changes …"; its Valid From starts at today, its Valid To at the
    BOQ's end only when that is later (else open).
* **Vendor BOQ → pick a vendor → "Rate history – machinery-wise"** under the BOQ list: for each machinery, period by period –
  from – to, the rent type and rate, which BOQ or amendment gave it (and its work order), and what changed ("First rate" /
  "Same rate" / "Changed – was Per Trip ₹1,000"). The old rate ends the day before an amendment starts; a time with no BOQ
  between two periods is shown as "No BOQ – no rate".
* The bills: **no change** – they already take, for each machinery and each date, the newest rate in force; the history is made by
  the same rule (one order, `boqNewer_`, for both).
* Help (red box) in English / मराठी / हिंदी; the phone app has the same (App 3.23.0).

## Server
* `app/Code.gs`: `saveBoq_` – an amendment from on or after its BOQ's start ("The amendment must start on or after the start of
  BOQ 1 (01-01-2026)."); `boqHistory_` (the periods), `boqNewer_` (the order, also used by `boqRateFor_`); `getBoqs` gives
  `history`. No SQL.

## Evidence
* **Unit tests: 94 / 94** (new "update-132"): BOQ 1 (01-01 – 31-08: HV-1 ₹100, HV-2 ₹300); Amendment 1 only HV-1 ₹200 from 01-02
  (open); Amendment 2 only HV-2 ₹350 from 01-09 – after BOQ 1 ends (until now refused); before the BOQ start → refused. The history:
  HV-1 ₹100 01-01 – 31-01 → ₹200 from 01-02; HV-2 ₹300 01-01 – 31-08 → ₹350 01-09 – 30-09. **The history = the bills' rate
  (`boqRateFor_`) on every day from 30-12-2025 to 02-01-2027**, both machinery. A gap between two periods is said.
* **Rig browser test** `test/browser/boqhist132.js` **4 / 4**: BOQ 1 01-08 – 31-08 (two tankers); on the page "Make amendment" for
  one tanker from 01-09-2026 → saved; the history shows ₹1,000 (01-08 – 31-08, BOQ 1 – Original) → ₹1,200 (01-09 – 30-09, Amendment
  1 of BOQ 1, "Changed – was …"), the other tanker untouched.
* Earlier tests on the rig: `billed108.js` 24 / 24; `boq.js` 8 / 8 (run on the own-sign-in copy :3001 – the file points at :3000,
  which in the Portal rig has no sign-in form of its own; not changed by this update).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* The live BOQ of PRAJAY ENTERPRISES: after this update "Make amendment" from 01-09-2026 is taken.
* A bill made with such an amendment on the live data (the rule the bills use is the same as before; the unit test compares every day).

## Going back
Vercel → Instant Rollback to update-131. Amendments saved meanwhile stay; the earlier version uses them in bills the same way (it
only refused to save a new one after the BOQ end).
