# update-156 – every edit screen checks the version it opened (24-10-2026)

**Asked (24-10-2026, with update-155):** "Concurrent Updates साठी Version Checks आणि Conflict Detection अनिवार्य ठेव … Duplicate Save
Protection, Atomic Transactions आणि सुरक्षित Retries ठेव." The audit of the same day (section 10, issue 6): "last save wins on at
least 9 edit screens; the version check is optional".

Until now only Log Book and Diesel Issue (update-145) refused a save over a change someone else had made after the entry was
opened. Now the same check is on every screen that changes an entry that is kept: **Inward, Transfer, Machinery Payments, Vendor
Master, Vendor BOQ and Asset Master (one machinery, many at once, delete, delete many)** – a change or a delete of what someone
else changed meanwhile is refused with who changed it, and nothing is saved:
"Inward IN-000012 was changed by Sujit after you opened it – open it again and make your change there. Nothing was saved."
(the same words and the same help in English, Marathi and Hindi as update-145 – `FIX_RULES` already has them).

**No database step. No calculation, bill, ledger, stock or rule changes; every save is checked and saved exactly as before.**

## How (app/Code.gs, app/App.html)
* Each row these screens list carries `ver` – a fingerprint (`rowVer_`, as update-145) of the fields the screen can change:
  * Inward: date, qty, pump, rate, amount, bill no., bill date, place, bill copies (`INWARD_VER_H_`) – not its running balance;
  * Transfer: date, shift, from, to, qty, remark – not the balances;
  * Payments: type, date, vendor, amount, side, mode, reference, against bill, remark;
  * Vendor Master: name, GST, PAN, TDS, bank, branch, account, IFSC, address, phone, remark, Aadhaar, email – not "ownership",
    which follows the machinery by itself;
  * Vendor BOQ: number, vendor, valid from / to, amendment, lines (rates), remark;
  * Asset Master: every field the form or "Edit selected" changes, with the papers' dates – not the Log Book format or a reading.
  A diesel issue, a Log Book entry or a new machinery of the vendor does not change these versions.
* The page keeps the version an entry had when it was **opened** (not the list's of later – the list follows others' saves by
  itself) and sends it with the change (`x.ver`) or the delete (one more argument); "Edit selected" and "Delete selected" send each
  machinery's version (`vers`). The server checks it under the site's save lock (`verCheck_`), for a vendor or a machinery BEFORE a
  rename moves anything.
* Dates and amounts are compared as values (`verVal_`: a date as its day, a number as its number).
* **Not compulsory yet:** a save that sends no version (a page or a phone app of before this update still open) is taken as before.
  The web page sends it always; the phone app from 3.36.0. Making it compulsory is a decision for when every phone runs 3.36.0.
* A machinery's version goes only to those who see every field of it (`leastOut_`): it is worked out from the rates too, and a
  person who may not see a rate does not get its fingerprint (he cannot change a machinery either).

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – **112 / 112** (1 new: every screen's change and delete against the real server code – the first
  change saved, the second on the old version refused with who changed it and the first one's value staying; a delete on the old
  version refused; an older page or app (no version) taken as before; diesel issued from an inward, a machinery given to a vendor or
  a diesel issue of a machinery does not change their versions; a vendor or a machinery is checked before a rename moves anything;
  "Edit selected" / "Delete selected" refuse the whole lot when one was changed – neither deleted; only a person who sees every
  field of a machinery gets its version; the page sends them). `node --check` on `server/*.js`, `api/*.js`; the page's script
  blocks parse; no secret in the change.
* **`test/browser/ver156.js`** – two browsers, each its own sign-in, the real pages; A and B open the same entry, B saves, then A
  saves (or B deletes) what he opened:
  | Screen | update-155 (before) | update-156 |
  | --- | --- | --- |
  | Inward – change | A's 95 saved over B's 91 | refused – "Inward IN-000002 was changed by … after you opened it … Nothing was saved."; 91 stays; opened again → 95 saved |
  | Inward – delete with the old version | deleted | refused, not deleted; the live refresh shows the new version and a delete from it is taken |
  | Transfer – change | A's 150 over B's 120 | refused; 120 stays |
  | Payments – change | A's 15,000 over B's 12,000 (the ledger) | refused; 12,000 stays |
  | Asset Master – change | A's 8 L/hr over B's 7 | refused; 7 stays |
  | Vendor Master – change | A's phone saved, B's bank lost | refused; B's bank stays, the phone not changed |
  | the help in his language, no script error | ✓ | ✓ |
  **update-155: 5 / 12** (the 7 are "last save wins") – **update-156: 12 / 12**.
* **The same tests on update-155 and on update-156** (the same snapshots, steps 1zc + 1zd + 1ze), check by check – the same pass and
  the same fail on both:
  * clean snapshot: `billlock` 16, `viewbill` 23, `bills120` 17, `gstdecl` 11 (the bills unchanged), `same145` 10, `entry71` 20,
    `lbpage` 13, `rows146` 29, `boq` 8 (a saved BOQ changed through the page – it sends its version), `boqhist132` 4, `boqprint133`
    4, `inactive115` 11, `periods119` 13, `fit131` 8, `machno` 19 (a machinery number changed and changed back – everything follows),
    `works69` 34, `rate69` 19, `tanker105` 7, `tanker107` 8, `photo139` 11, `add143` 18, `fix130` 12, `sync155` 21 (another
    person's save on the open list: median 0.6 s), `tabs` (the same lines); the same failures on both (data or servers this rig
    does not have): `saveonce` 19 / 24, `details147` and the API tests below without the Portal.
  * Super Admin snapshot (Portal): `flow114` 12, `flow116` 18, `billed108` 25, `ev151` 12, `sdel134` 6, `ldebit149` 14,
    `flow114api` 30, `lock152` 17, `att153` 39; `inward120api` **44** (inward changes and bill copies through the server's door),
    `details147api` 24, `details147` 10; `places117api` 8 / 8 on both.
  * `vendors111api` (every site its own vendors) stops at its start on this rig on both (the switch to the second site answers
    "SESSION_EXPIRED" right after the sign-in) – not run; Vendor Master is covered by `ver156`, `details147api` (a maker's vendor
    save checked and approved, 24 / 24) and the unit test.

## Not verified
* The live sites; a real phone with App 3.36.0 (its build and tests are green on GitHub Actions); Vercel's real instances.
* Diesel Issue and Log Book keep update-145's check unchanged (their versions are the same as before – none of the new date or
  number fields is theirs; the unit test of update-145 still passes).
* Not tested on these six screens: a Super Admin approving, later, a change a User sent for approval. The change carries the
  version the User opened, so if the entry was changed meanwhile the approval should be refused with the same words (as for Log
  Book and Diesel Issue since update-145) – read in the code, not run.

## Going back
* Vercel → Instant Rollback to the deployment before this update. Nothing is saved differently.
