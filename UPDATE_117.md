# update-117 – Every site its own diesel places (18B: Camp Pump + 2 dispensers), set by the Super Admin (16-10-2026)

**Asked:** "18b site sathi diesel systeam thodi wegli aahe … ekde ek pump aahe jo yanche camp madhe ahe ha pump 18k ltr quantity
aahe tyat vendor kdhun direct diesel yet … 2 dispensor aahet MH12ZE1739 ani MH12WJ1381 … diesel inward ya 3 thikani hot direct …
issue krtana ya 3 ni madhun … diesel transfer pn hote pump madhun dispense or eka dispensor madhun dusrya dispensor madhe". Then:
"CAMP PUMP as kr name … dispensor aahet 2650 ltr che … 18 B madhe ajun aple app madhe entry zalel nahit … VTR la hat lau nko tikde
data live aahe … ani ek ashi setting banwaychi ji super admin site banwatanach diesel as banau shakel … proper logic use kr".

## How it works
* **A site's diesel places** are its own: the Super Admin sets them in the **Portal**.
  * **New site** has a small table "Diesel places of this site": name + tank size (Ltr), "+ Add place", "Remove". It is step 6 of
    the checklist (step 7 = Ready). A site that already has its places keeps them (the form's places are then not used).
  * **Sites → "Diesel places"** (a link on every site that is not Closed): the places of that site with the tank size and the
    **stock now**; change a tank size, add a place, remove a place without entries, Save.
* **For 18B** the Super Admin enters: **Camp Pump 18000, MH12ZE1739 2650, MH12WJ1381 2650** (in Sites → Diesel places → 18B).
  From then on at 18B:
  * Diesel Inward ("Received at"): any of the 3;
  * Diesel Issue ("Diesel Source"): any of the 3; the stock of each is checked on its own;
  * Diesel Transfer: Camp Pump → a dispenser, a dispenser → the other dispenser (From and To: any two of the 3);
  * every list, filter, report, the Excel templates, the phone app: the 3 places;
  * the Dashboard: **one tank for each place** (its stock, % of its tank, red below the low level); the stock cards per place.
* **The rules (so no stock moves by itself):**
  * a place that has entries (or an entry waiting for verification) **keeps its name and cannot be removed**;
  * the first place stays the first while old entries without a place count there (the first site's oldest entries);
  * names: letters, digits, spaces, - . / ( ) &, up to 40; each name once; up to 12 places; tank size 1 … 1,000,000 Ltr.
  * The first place is the one chosen first on the forms (and an entry sent without a place goes there).
* **A site without the setting** (the first site, VTR) has **Dispenser + VTR Store exactly as before** – the same lists, the same
  pickup + barrels picture on the Dashboard, the same words; the Dispenser's pump counter reading as before. Nothing at VTR changes
  unless the Super Admin opens VTR's Diesel places and saves.
* The pump counter reading ("Current Diesel Issue Reading"): only at a place that had it (the first site's Dispenser). The new
  places have none (the owner's answer on a dispenser reading is still open).

## How it is built (no SQL step)
* `app/Code.gs` block "DIESEL PLACES OF THIS SITE": site setting `DIESEL_PLACES` = `[{ name, meter }]`, tank sizes in the existing
  `TANK_CAP_<name>`; `places_()` / `placeNames_()` / `mainPlace_()` / `meterPlaces_()` replace `APP.LOCATIONS` / `APP.MAIN_LOC`
  everywhere (17 uses in Code.gs, 1 in Read Me: stock, inward, issue, bulk, transfer, balances, stock summary, reports, tank sizes, verification facts,
  Read Me); `placesUsed_` / `placesInfo_` / `savePlaces_`; `getLookups` gives the places (an open page takes a change by itself);
  `tankSettings_().own`.
* `app/Sites.gs`: `sysPortalAdmin_` acts `places` / `placesSave` → `sysPlacesSave_` (lock, Activity Log "Diesel places set by
  the Super Admin in the Portal: …" with the places before); `sysPlacesSetup_` for New site. `server/system.js` siteSetup step
  `places`; `server/portal.js` the places travel inside the signed ticket (`placesOf`); `server/runtime.js` `sysPlacesSetup`.
* Page: `vtrPlaces()` (the first site's words stay), `tankOwnHtml` (one tank per place; the drum drawing shared with the barrels),
  `setLocations` from `getLookups`. FIX_RULES: one rule for the diesel place messages (English, Marathi, Hindi). Marathi / Hindi
  for the 7 new words of the page.
* Portal (`rcl-portal`): `placesGet` / `placesSave` actions, `siteSetup` sends the places; the page: New site table, Sites →
  Diesel places panel. Phone app 3.1.10: the Marathi word under each place on Home (`placeMr`); the app already took the places.

## Evidence (local rig, test data only)
* Unit 81 / 81 – new "update-117": no setting = Dispenser + VTR Store, the Dispenser's reading as before; every check of the
  places; 18B's places set (Activity Log line), getInit / getLookups; inward at any place, transfers pump → dispenser and
  dispenser → dispenser, issues, not-enough per place, "Dispenser" refused at 18B; stock per place and per period; a place with
  entries / waiting entries kept; the first place kept for entries without a place; New site set once; the Portal door; the page.
* Rig API `test/places117api.js` 33 / 33 through the real Portal and Mechanical: S1 (VTR) unchanged and its Dispenser cannot be
  taken away (nothing written); T2 (no entries, as 18B) gets the 3 places in its own database; entries and stock per place;
  Dashboard tanks; the Portal shows "has entries" and the stock; a 4th place added and taken away; another server sees it.
* Rig `test/newsite95.js` 37 / 37 (New site end to end, now with step 6 "Diesel places"; the test's start also clears the Super
  Admin's user rows of later updates – it could not start any more).
* Browser `test/browser/places117.js` 13 / 13: the Portal panel (typed, + Add place, Save, "has entries"); New site table; T2's
  page: every place list has the 3, Transfer From Camp Pump → To MH12ZE1739, the Dashboard 3 tanks with their levels; S1's
  Dashboard pickup + barrels and old words; no page error. Screenshots looked at.
* Old browser tests: lang110 17 / 17, flow116 18 / 18, inactive115 11 / 11, idle 10 / 10, tabs OK. batch.js 12 / 14 – the same
  2 fails ("Debit to" in Log Book print / Excel) on the main code too; stale.js needs a machinery the rig no longer has.
* `node --check` server/*.js, api/*.js; every script block of the page parses (unit test). Portal unit 8 / 8.

## Not verified
* Not run on the live sites. **Nothing changes anywhere until the Super Admin saves 18B's places** in the Portal.
* The phone app 3.1.10: built and tested by GitHub Actions only (no Flutter here); not on a real phone.
* Translations of the new words were made by me (AI).

## Going back
Vercel → Instant Rollback to update-116 (Mechanical) and the Portal's previous deployment. The setting `DIESEL_PLACES` stays in
18B's settings and is ignored by the older code (18B then shows Dispenser + VTR Store again; entries made at the new places would
then not be in any list's stock – so go back only before 18B's first entry, or ask).
