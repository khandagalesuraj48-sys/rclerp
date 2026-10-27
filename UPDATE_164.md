# update-164 – Fuel cards: a site without diesel stock (HO) – step 1 (27-10-2026)

**Asked (27-10-2026):** "ho madhe diesel stock hot nahi ek card dilelel aahet tya card warun payment kel jat swipe krun ani gadi
madhe fuel bharle jat … stock ha option nassel baki daily log book asel … mi card cha opening balance takel nantr apli system auto
amount debit dakhwel mhanje app madhe card balance kiti ahe … jr card war payment kel tri detail madhe payment entry card war add
krta yawi … other site la kahi nahi fkt ho site". His answers: a card is **only for fuel**; a fill is paid by a **card or in Cash**;
step 1 = **cards + fuel + the HO dashboard** (the Maintenance Log Book and the service schedule come later). Then "ho" to the plan.

**One database step:** `sql/supabase_step1zh_fuel_cards.sql` – it only ADDS: `diesel_issue.rate`, `diesel_issue.amount` (empty),
the table `card_payments`, the empty access column `app_users.perm_fuel_cards`. **Run it in EVERY site's Supabase** (VTR, 18B, HO).
VTR and 18B do not use any of it; until it is run at HO, HO cannot be put on fuel cards' payments (the app says this file is needed).

## What changes
### The Super Admin puts a site on fuel cards (the Portal, its own pull request)
* Portal → Sites → a site → Diesel places: **"How fuel is given"** – *From diesel places (stock)* (as now) or **Fuel cards – no
  stock**. Kept in that site's own settings (`FUEL_MODE = card`); the Activity Log says it. Once a fill was paid by a card or in Cash
  (or a payment was put onto a card) the site **stays** on fuel cards ("it stays on fuel cards").
* Only such a site has the new page **Fuel Cards** (Users & Access → Pages: Edit / View; empty = No access) and has no Diesel
  Inward / Transfer pages and no diesel sources.
### Fuel Cards (the new page)
* Each card: **name**, **kind** (Fuel card / Credit card / Debit card), **last 4 digits only** (never the whole number), **opening
  balance ₹ and its date**, the **cars** that use it (none ticked = every car), Active / Inactive.
* **Balance = opening + payments onto the card − the fills paid by it** (from its opening date). Worked out from the entries every
  time – nothing stored that can go wrong.
* **Payments / recharges onto a card**: date, card, ₹, reference, remark, up to 5 receipt photos; changed / deleted with Edit.
* **A card's statement**: the balance at the start, every payment (+) and fill (−) with the balance after it, the closing balance.
### Diesel Issue at a site on fuel cards
* **"Paid by"**: the cards of that car (Active; its own or for every car) with their balance, and **Cash**. **Amount (₹)** must be
  given; the rate is worked out (Amount ÷ Qty) when left empty. The line under it: "balance now ₹X → after this fill ₹Y" – **short is
  still saved, in red** (the fuel is already in the car). The ₹ is read from the dispenser photo too. Photos: Dashboard (KM),
  Dispenser (litres + ₹), Vehicle + driver – **no Register photo**. One fill at a time (no "Multiple entries", no Excel).
* Refused (the server, for the web and the phone alike): no card / Cash; a card not of the site, Inactive, not for this car, or a fill
  before the card's opening date; no Amount; an Electric car; Inward / Transfer / "Multiple entries" at such a site.
* The list: "Paid by" and "Amount (₹)" columns, the ₹ of each card / Cash; each fuel apart (the car's fuel).
### The Dashboard at a site on fuel cards (HO)
* "Fuel cards & cars": every card's balance now; for the dates (this month to start with) each car – KM of its Log Book, fuel filled
  (L / kg, never added together), ₹ by card / in cash, the fills, the average (and the standard), the last fill; the totals.
* No stock, tanks, Inward or stock reports there (Daily Inward & Issue, Stock Register, Diesel Purchase Register not in the menu).
  The Log Book stays exactly as it is.
### Everything else
* **A site not on fuel cards (VTR, 18B) works exactly as before** – no Fuel Cards page, the same Diesel Issue, stock, places.
* The assistant: at a site on fuel cards a fill is made in the Diesel Issue form (its card or Cash, its ₹, the photos); "How much is
  on the fuel cards now?" gives the cards' balances.
* Help in English / मराठी / हिंदी for every new message (FIX_RULES), the page's guide (PAGE_GUIDE `cards`), the words of the page
  (`app/i18n`).
* **The phone app** (rcl-mobile 3.45.0, its own pull request): the same on the app's own screens – Home shows the cards' balances
  in place of the stock, the Fuel Cards screen, the Diesel Issue's card / Cash and ₹, the Dashboard of cards and cars.
* **Order:** this update first, then the Portal, then the app. Then the SQL step in every site; then the Super Admin: Portal → Sites
  → HO → Diesel places → "Fuel cards – no stock"; Users & Access → Pages → Fuel Cards for those who keep the cards; then Mechanical
  → Fuel Cards → add the cards with their opening balance.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **117 / 117 pass** – new `update-164`: a site not on cards as before (no cards in its
  stock, a card refused with "This site is not on fuel cards …"); HO on cards: cards saved (only the last 4 digits; 16 digits refused;
  "Cash" refused as a name; an opening date after a card's first entry refused); fills by a card / Cash with their ₹, each refusal
  with its exact message; the balances (opening + payments − fills from the opening date); a short card saved with a negative
  balance; payments added / changed / deleted; the statement; the dashboard of cards and cars; Inward / Transfer / many refused; the
  site cannot go back to stock once used; the SQL step only adds. Older tests that check the page's code word for word follow the
  new code (same meaning). Every new server message has its help rule (the coverage test).
* **The local rig** (Postgres + PostgREST + the door; the Portal from its branch; Mechanical :3000 / :3001), the whole way
  `test/browser/cards164.js` → **39 / 39**: T2 (steps 1zg + 1zh run) as HO – the Super Admin in the **Portal's own screen** picks
  "Fuel cards – no stock", Save → kept in T2's settings, the Activity Log says it; the Portal's Pages list of T2 has Fuel Cards and no
  Inward / Transfer; three cars (Petrol, Diesel, Electric); two cards (HDFC for every car, ICICI for the Petrol car); fills by card /
  Cash with the exact refusals; ICICI short → −500 saved; a payment onto a card and the statement; the list's ₹ per card / Cash; the
  dashboard; the Portal cannot take T2 back to stock. **The page**: the menu has Fuel Cards and no Inward / Transfer / Stock Register;
  Diesel Issue "Paid by" with the car's cards and Cash, the Amount box, no stock pill, no Register photo, one entry at a time; "balance
  now ₹3,950.00 → after this fill ₹1,850.00"; saved; Fuel Cards – tiles, "+ Add card" (kept), a payment from the page, its statement;
  the Dashboard "Fuel cards & cars". **S1 (VTR) as before**: not on cards, no Fuel Cards, Diesel Inward there, "Diesel Source" every
  place, the stock pill. No error on the pages.
* With it on the rig, as before: `fuel163` 41 / 41, `dsrc162` 26 / 26, `transfer159` 24 / 24, the Portal's `test/api.test.js`
  117 / 117 (the Portal from its branch).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* The live sites: nothing changes until the SQL step is run and the Super Admin puts HO on fuel cards.
* A real fuel-pump display read for the ₹ (the phone reads it from the dispenser photo; checked only with the test pictures' text).
* The Google Sheet backup of `card_payments` on the live backup run (the backup finds tables from the database's own list; seen on
  the rig only).

## Going back
* Vercel → Instant Rollback to update-163. The new columns and the table can stay (only this update reads them). A site put on fuel
  cards: the Super Admin's setting `FUEL_MODE` is ignored by the update before – HO would show its (empty) diesel places again, and the
  fills paid by a card would show their card's name as the Diesel Source. If wanted (the payments are lost):
  `drop table public.card_payments; alter table public.diesel_issue drop column rate, drop column amount; alter table public.app_users drop column perm_fuel_cards;`
