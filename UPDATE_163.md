# update-163 – Fuel: Diesel / Petrol / CNG / Electric – each machinery its fuel, each diesel place its fuel (26-10-2026)

**Asked (26-10-2026):** "ata tu ek kam kr tu prtrol cng he field banaw ani ha electric ha pn thew future madhe ya gadya pn yenar
aahet". His answers: the fuel is set in the **Asset Master**, one per machinery; the entries stay on the **same Diesel pages** with
the fuel, and **the stock of each fuel is kept apart**; **Electric** is only marked on the machinery for now; HO uses **separate fuel
cards** → one diesel place per card. Then "ho" to the plan.

**One database step:** `sql/supabase_step1zg_fuel.sql` (one empty column `master.fuel`; empty = Diesel). **Run it in EVERY site's
Supabase** (VTR, 18B, HO). Until it is run a site works exactly as before; only a Petrol / CNG / Electric machinery cannot be saved
there (the app says this file must be run first).

## What changes
### Machinery (Asset Master)
* A **Fuel** box: Diesel / Petrol / CNG / Electric. Empty = Diesel, so **every machinery of before is Diesel**. Also in "Multiple
  machinery" (the last column), the Excel import / export (column **Fuel**) and the phone. A change of the fuel is shown in "These
  details will change". The list marks a Petrol / CNG / Electric machinery.
* CNG: the standard average is **KM/kg** (kg/Hr). Electric: no standard average is asked.
### Diesel places (the Super Admin, Portal → Sites → Diesel places, and New site)
* Each place holds **one fuel**: Diesel / Petrol / CNG. A place of before is Diesel. HO: DIESEL CARD, PETROL CARD, CNG CARD.
* A place that has entries **keeps its fuel** (its stock is of that fuel): "Diesel place PETROL CARD (Petrol) has entries – its fuel
  cannot be changed." The Activity Log of the site says the fuel of each place.
### The checks (the server, for the web and the phone alike)
* **Diesel Issue** (one entry, many at once, Excel, a change): only from a place of the machinery's fuel – "DIESEL CARD holds Diesel
  and MH-12-HO-1163 runs on Petrol – pick a Petrol place (Asset Master → Fuel)." An Electric machinery: "… runs on Electric – no fuel
  is issued to it". **Transfer**: only between places of one fuel. **Inward**: the fuel of the place.
* **Found and fixed on the way:** in "One date – many machinery" each row was checked with the **first** place instead of the batch's
  source. So a person's own diesel sources (update-162) were checked against the first place there: someone given only another
  place was refused, and someone given only the first place could save at another. The rows are now checked with the batch's source.
* CNG is counted in **kg**: "Not enough CNG at CNG CARD … Available: 32 kg, you are issuing: 100 kg." Diesel's messages are word for
  word as before.
### Never added together
* **The lists** (Diesel issued, Inward entries, Transfers): a site with more than one fuel shows the total of each – "Diesel 50 Ltr ·
  Petrol 30 Ltr · CNG 8 kg"; a CNG row says kg.
* **The Dashboard** and **every diesel report** (and Daily Inward & Issue, Monthly Diesel, Monthly Diesel & Average): a **Fuel** box
  (only on a site with more than one fuel). Each fuel on its own – its places, entries, machinery, tanks and stock – in its own words
  ("Petrol summary – all locations", "CNG tank", "In (kg)"), on the screen, the print and Excel. The Log Book still pending stays every
  machinery. The **Daily report** of the Dashboard shows the stock, received and issued of **each fuel** one after another.
* The entry forms follow the fuel of the place: "Petrol Qty (Ltr)", "CNG Qty (kg)", the stock chips "CNG CARD 32 kg", the fill
  history of a CNG car in kg.
* **A site whose places are all Diesel (VTR, 18B) looks exactly as before:** no Fuel box anywhere, the same words, the same lists.
### With it
* **The Portal** (its own pull request): Sites → Diesel places (and New site) – a **Fuel** box in each row.
* **The phone app** (rcl-mobile 3.44.0, its own pull request): the same on the app's own screens.
* **Order:** this update first, then the Portal, then the app. Then the SQL step in every site, then HO's places in the Portal.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **116 / 116 pass** – new `update-163`: a site of Diesel only (no fuel view, no totals
  per fuel); HO's four places with their fuel (kept as before for Diesel; an unknown fuel refused); four cars – Fuel empty / Petrol /
  cng / Electric (no standard average) – unknown "Gas" refused, CNG without a standard average → "KM/kg"; a change without Fuel keeps
  it; Export has Fuel (Diesel empty); the Excel import sets it; fills: Petrol car from DIESEL CARD, Diesel car from PETROL CARD, the
  Electric car – each refused with the exact message; the right ones saved; "Not enough CNG … kg"; many at once at PETROL CARD with
  the Diesel car refused for that row; **a person's own source (update-162) in many at once: his own non-first place saved, another
  refused**; Petrol → Diesel transfer refused, Petrol → Petrol saved; PETROL CARD with entries cannot become Diesel; the lists' totals
  per fuel and a list of one fuel; the dashboard and the monthly report of Petrol / CNG (only their places, entries, machinery; the
  pending Log Book of every machinery); the view ends with the action; the SQL step only adds; the page's boxes.
  Two older tests (update-117, update-162) check the page's code word for word: their strings follow the new code (same meaning).
* **The local rig** (Postgres + PostgREST + the door; the Portal from its branch; Mechanical :3000 / :3001), the whole way
  `test/browser/fuel163.js` → **41 / 41**: T2 (step 1zg run) as HO: the Super Admin in the **Portal's own screen** (Sites → Diesel
  places) sees a Fuel box per row, types DIESEL CARD / PETROL CARD (Petrol) / CNG CARD (CNG) / PETROL CAN (Petrol), Save → kept in T2's
  own database with the fuel, the Portal asked again shows it, the Activity Log says it; four cars of each fuel kept in `master.fuel`;
  the server's checks with their exact messages; the Portal cannot turn PETROL CARD (with entries) into Diesel; lists per fuel; the
  dashboard of Petrol / CNG and the monthly report of CNG; **the page**: Diesel Issue offers PETROL CARD + PETROL CAN for the Petrol
  car, CNG CARD for the CNG car ("CNG Qty (kg)", stock in kg), DIESEL CARD for the Diesel car (as before), the Electric note; the
  CNG car's history in kg; an Excel row marked before sending; Transfer To of the From's fuel (also its grid rows); the stock chips in
  kg; the Dashboard's Fuel box (Petrol → "Petrol summary", 30 Ltr, 2 tanks; CNG → 8 kg, 1 tank; back to Diesel → as before); Reports →
  Stock Register of CNG; Daily Inward & Issue of Petrol; Asset Master Fuel (CNG → "KM/kg"), the list marks, a change of the fuel saved.
  **S1 without step 1zg** (VTR): a Petrol machinery is not saved (the step is asked for); every place Diesel; no Fuel box shown
  anywhere; "Diesel summary – all locations"; Diesel Issue's source as before. No error on the pages. Pictures: the Portal's Fuel
  boxes, the CNG issue form, the CNG dashboard, the Asset Master.
* With it on the rig, as before: `dsrc162` 26 / 26, `transfer159` 24 / 24, the Portal's `test/api.test.js` 117 / 117 (the Portal from its branch).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* The live sites: nothing changes there until the SQL step is run and a place / machinery is given another fuel.
* The approval of a restricted person's "many at once" entry on the rig (the flow tests need set-ups today's rig does not make);
  the unit test checks the batch's source with his sources.
* The Log Book pages and the bills keep their words ("Opening Diesel") for a Petrol / CNG machinery – not asked; HO's cars are Own.

## Going back
* Vercel → Instant Rollback to update-162. The column `master.fuel` can stay (it is only read by this update); a place's `fuel` in
  `DIESEL_PLACES` is ignored by the update before. If wanted: `alter table public.master drop column fuel;` (the fuels are lost).
