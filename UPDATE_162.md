# update-162 – Diesel sources per person: Diesel Issue and the From of a Transfer only from his own (26-10-2026)

**Asked (26-10-2026):** "apan diesel issue access user la deto ata vtr aso 18b aso diesel source 1 or multiple aahet mala user wise
konala konte source cha access deycha ki nahi as assw mhanje jya user la jyacha access asel to tyach madhun issue kru shakel same
transfer la pn as mala haw aahe inward la nko karan inward koni pn kru shakte". His answers: Transfer = **From only**; people today =
**every source (as now)**; lists and reports = **everything as now**; given in **Portal → Users & Access (Super Admin)**. Then "ho".

**No database step. No stock, bill or ledger calculation changes.** The sources are kept in the site's own settings (`web.props`,
the key `DIESEL_SOURCES` – the table every site already has), like the site's diesel places (update-117).

## What changes
### The server (`app/Code.gs`)
* **`DIESEL_SOURCES`** = `{ "<email>": { "Diesel Issue": [places], "Diesel Transfer": [places] } }`. A page not there = **every
  source** (also a place added later) – what everybody has today. An **Admin / the Super Admin: always every source.**
* **Checked on the server for every save, whatever the page or the phone sends** (`dsrcMay_`, the person of the request `DSRC_U_`):
  * **Diesel Issue** – its source must be his (one entry, many at once, the Excel import, the change of an entry; `validateDiesel_`).
    An issue of another source is **not his to change or delete** (`updateDieselIssue_`, `deleteDieselIssue_`).
  * **Diesel Transfer** – its **From** must be his (one, many at once, Excel; `validateTransfer_`); the **To may be any place**. A
    transfer from another source is not his to change or delete (`updateTransfer_`, `deleteTransfer_`).
  * **Diesel Inward: no limit** (anyone with the page, as before).
  * Refused with: "Diesel source CAMP PUMP is not given to Bala for Diesel Issue (given: DISPENSER - MH12ZE-1739) – the Super Admin
    gives the diesel sources in the Portal (Users & Access → Pages)." (help rule in `FIX_RULES`, English / मराठी / हिंदी).
  * **Verification:** the dry run at sending checks the sender; on **approval** the change runs with the **requester's** sources
    (both places a change is run on approval).
* `publicUser_` tells the page and the phone his sources (`user.dsrc`, only when some are chosen) – in `login`, `getInit`, `sync`.
### The Portal's door (`app/Sites.gs`, `server/portal.js`)
* `users` answers each person's `dsrc` and the site's `places`; `pages` takes `sources` (the Portal's ticks) and keeps them with
  `dsrcSet_`: every place ticked = every source (nothing kept); a name that is not a place of the site is left out; none ticked =
  none. The Activity Log of the site: "Diesel sources of <email> – Diesel Issue: …; Diesel Transfer: …" (with the pages' changes,
  by "Super Admin (Portal)"). A Portal before this update sends no `sources`: his sources stay as they are.
* (Found on the rig, fixed before handing over: keeping the sources with `withLock_` dropped the pages saved just before it – a new
  person's pages were lost. It uses the script lock only.)
### The page (`app/App.html`)
* **Diesel Issue** (one entry, "many at once", its rows, the Excel import) and the **Transfer From** (one, its rows, Excel) offer
  **only his own sources**; one = chosen by itself. The **To** of a transfer is ready on a place other than the From. The lists'
  filters, the reports, Diesel Inward: **every place** (as before). Excel rows with another source: "Diesel Source – not your diesel
  source" / "From – not your diesel source" before anything is sent. The assistant's diesel entry takes his own source when he names
  none (a source he names stays as said – the server then says it is not his). His sources changed in the Portal reach the open
  page at the next sync. The guides of Diesel Issue and Diesel Transfer say it (English / मराठी / हिंदी).

### With it
* **The Portal** (rcl-portal, its own pull request): Users & Access → his name → Module Access → **Diesel sources**: a tick for each
  diesel place of the site under "Diesel Issue – source" and "Diesel Transfer – From" (for a Mechanical User; an Admin has every
  source). All ticked = every place.
* **The phone app** (rcl-mobile 3.43.0, its own pull request): the same on the app's own screens.
* **Order:** this update first (the Portal's ticks need it; a Portal before it is not changed by it), then the Portal, then the app.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **115 / 115 pass** – new `update-162`: (18B's names) nothing chosen = every source,
  nothing told to the page; the Super Admin gives ZE for Issue and Transfer (a name in small letters taken as the site writes it, an
  unknown name left out); an issue from CAMP PUMP refused with the exact message, from ZE saved, the Excel import refused; a transfer
  FROM CAMP PUMP refused, ZE → CAMP PUMP saved, many at once refused; the Admin's CAMP PUMP transfer and issue: not his to change or
  delete; Inward anywhere; every place ticked = every source; none ticked = "(none is given)"; the Admin: every source; both approval
  places run with the requester; the Portal's door; the page's own-source boxes (and the lists' filters left with every place).
* **The local rig** (Postgres + PostgREST + the door, the Portal from the Portal branch, Mechanical :3000 / :3001), the whole way
  `test/browser/dsrc162.js` → **26 / 26**: T2 as 18B (CAMP PUMP, DISPENSER - MH12ZE-1739, DISPENSER - MH12WJ-1381); the Super Admin
  in the **Portal's own screen** (Users & Access → site T2 → the person → Module Access) sees a tick for each place under Issue and
  Transfer, all ticked; unticks all but ZE and presses Save changes → kept in T2's own database only (S1 has none), in T2's Activity
  Log and the Portal's record; the person signs in through the Portal (one-time password → his own) – the page is told his sources;
  the server refuses an issue / a transfer from CAMP PUMP (exact message), saves from ZE, ZE → WJ, an Inward at WJ; the Admin's
  CAMP PUMP transfer not his to delete; **his page**: Issue source, "many at once" and its rows = only ZE, Transfer From and its rows
  = only ZE, To = every place (ready on another place), the Diesel list's filter and Inward = every place; the Admin's page = every
  place; the Portal opened again shows his ticks; all ticked + Save = nothing kept, the page told nothing, an issue from CAMP PUMP
  saved again; no error on the pages. Pictures: the Portal's ticks, his Issue form, his Transfer form.
* The Portal's `test/api.test.js` on the rig: **117 / 117** (the new: the places with the users, the ticks saved in S1's own
  database – Transfer all ticked = every source, Inward never kept, the Activity record, opened again, a save without sources keeps
  them, all ticked = nothing kept). With main's Mechanical: 112 / 5 – five of the six new ones fail (main sends no places and keeps no sources): the Portal needs this update first.
* `fcm161api` 8 / 8 and `transfer159` 24 / 24 as before. `places117api` stops at the same place **on main and on this branch** (its
  second part signs in at :3001 with a set-up today's rig does not make – not from this change).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* An approval of a restricted person's entry on the rig (the flow tests need set-ups today's rig does not make): the unit test checks
  that both approval places run with the requester's sources.
* The live site: nothing is changed there until the Super Admin unticks a source for someone.

## Going back
* Vercel → Instant Rollback to update-161. Nothing in the database to undo: `DIESEL_SOURCES` (in each site's `web.props`) is only
  read by this update – it can stay; every person then has every source again.
