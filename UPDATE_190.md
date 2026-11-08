# update-190 (urgent) – Vehicle Compliance draws its table again (29-10-2026)

**Asked (29-10-2026, 13:41, with two pictures – HEAD OFFICE, Vehicle Compliance, search "0169"):** "HE AS KA YET AAHE HE MALA FIX KRUN DE".
The page showed its four counts but no table and no renewal history, and a fault: "Uncaught TypeError: Cannot read properties of
undefined (reading '1')" (where: comp).

**Cause:** the fuel cards' payments (update-164, 27-10-2026) were written with the same names as Vehicle Compliance on the page: `S.cp`
(its state – the payments' `{ items, tok, edit }` replaced the compliance's `{ d, chip }`, so `chip` was gone) and `cpLoad` (the
payments' function replaced the compliance's). The compliance page then stopped at its chips – at **every site** since 27-10-2026.
On the way, one more box with another's name: the Dashboard's "Day-wise diesel stock" dates went into the Log Book page's note (`lg_note`).

**No SQL.** No data is changed.

## What changes
* The card payments have their own names (`S.cpay`, `cpayLoad`) – Vehicle Compliance keeps `S.cp`, `cpLoad`.
* The Dashboard's diesel-stock dates: their own box (`lgd_note`).
* A unit test: no function of the page made twice, no part of `S` started twice, every box of the page's HTML its own id.

## Evidence
* Unit tests: **143 / 143**.
* Local rig, a fresh copy – `test/browser/comp190.js`: on the code before this change **4 / 12 counted, the same fault** ("Cannot read
  properties of undefined (reading '1')", no table, no history); with it **6 / 6** (table and history drawn, a search "0169", a chip,
  the payments' own state, no page error). `today187.js` 16 / 16.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live site (HEAD OFFICE's fuel card payments after the change – the rig is a site with stock).

## Going back
Vercel → Instant Rollback to the previous update.
