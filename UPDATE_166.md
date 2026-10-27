# update-166 – A fuel card's details (27-10-2026)

**Asked (27-10-2026, 11:22):** "fuel card number / details takayla option nahiye te baanaw". His answers: the card number stays
**only its last 4 digits** (as now – the whole number is never kept); the details: **Bank / company**, **the name on the card**, its
**expiry (month / year)**, the **customer / account ID** of the card programme.

**No database step:** the cards are kept in the site's own settings (`FUEL_CARDS`, as update-164) – the new details go with them.

## What changes
* **Fuel Cards → "+ Add card" / Edit:** four new boxes – *Bank / company*, *Name on the card*, *Expiry (month / year)* (the browser's
  month box), *Customer / Account ID* ("of the card programme – not the card number"). None is required.
* **The list of cards:** the details under the card's name ("HDFC Bank · Rachana Construction Ltd · Customer ID …"), a new column
  **Expiry**: its month / year; **"Expires 31-10-2026"** in amber when its last good day (the end of its expiry month) is within 30
  days; **"Expired 08/2026"** in red after it. The **tile** (Fuel Cards and the Dashboard of a site on fuel cards) shows its bank /
  company and the same mark.
* **The server (web and phone alike):** the expiry is read as the month box gives it (2029-08) or as a card prints it (08/2029, 8/29,
  08-29, 08.2029) and kept as yyyy-MM; anything else: "Card X: the expiry is its month and year (e.g. 08/2029)." Lengths: bank /
  company and name up to 60, customer ID up to 40. **A whole card number typed into any of these boxes is refused** ("that is the
  whole card number – it is never kept …") – 13 to 19 digits that pass the card check (Luhn); nothing of it is kept. The days to
  the card's last good day go with each card (`expDays`), so the web and the phone mark it the same. The Activity Log line says the
  details. A card of before (without details) is shown as it was.
* Help in English / मराठी / हिंदी: the card rule of `FIX_RULES` covers the new messages; the page's guide (`PAGE_GUIDE` `cards`) says
  the details; the words of the page (`app/i18n`).
* **The phone app** (rcl-mobile 3.47.0, its own pull request): the same four boxes in the card's form, the details on its sheet, the
  mark on the tile (Fuel Cards and the Dashboard).
* VTR / 18B: nothing changes (no Fuel Cards there).

## Evidence
* `timeout 300 node --test test/unit.test.js` → **120 / 120 pass** – new `update-166`: a card of before shows no details and no mark;
  the details kept and given back; the Activity Log line; the expiry in 5 ways → 2029-08, taken out; 5 wrong expiries refused with
  the message; the days to its last good day (this month = till its last day, last month = below 0); a whole card number refused in
  the customer ID and in the name, nothing kept; a 10-digit customer ID and 16 digits that are no card number kept; the lengths; the
  page's boxes, what it sends, the Expiry column and the marks.
* **The local rig** `test/browser/card166.js` → **12 / 12**: T2 (as HO) on fuel cards; "+ Add card" has the 4 boxes (Expiry a month
  box); a card saved from the page with its details (kept with only its last 4 digits); the list's details and "Expires <the last day
  of this month>" in amber; the tile "Fuel card ···· 4321 · HDFC Bank" with its mark; Edit brings them back; the whole card number
  typed as the Customer ID refused, nothing kept; an expiry of last month "Expired …" in red, on the Dashboard's tile too; S1 (VTR)
  as before. With it: `cards164` 39 / 39 (its check now reads the balance by its column's name – the new Expiry column moved it),
  `sync164` 9 / 9, `mnt165` 32 / 32, the Portal's `api.test.js` 117 / 117.
* Every call of the page and the server counted before / after (acorn, against main): no call is missing. `node --check` on
  `server/*.js`, `api/*.js`; the page's script blocks and the `.gs` files parse; no secret in the change.

## Not verified
* The live site (HO): nothing changes until the deploy; then the cards can be given their details (Edit).

## Going back
* Vercel → Instant Rollback to update-165. The details stay in the site's settings and are simply not shown by update-165.
