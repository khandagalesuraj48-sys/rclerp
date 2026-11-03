# update-203 – a tank check every N days before diesel; the ERP's day starts at 06:00 (02-11-2026)

**Asked:** "bill submit aso ki naso tank check compulsary aahe … jya gadyana diesel dile jatey tya pratek gadich tank check
compulsory karaych aahe every 7 days … aaj aahe 2 tarik aaj mi diesel dile ok then 7th day la gadi ali diesel la tya weli system agodr
tank check fill kra bolel tya nantarch entry save karel jr tank check fill nahi kel entry save nahi honar super admin la access de
konte site la tank check compulsory karaych konala karaych jas ki own rental hired and machine wise pn asaw … kiti disani tank check
haw te hi define kru shakel changes edit delete kru shakel je active aahet tyanche sathi fkt ok debit basis war aahe tyana he lagu
nasel". His answers (02-11-2026): counted **from the last tank check**; typed **in the diesel entry itself**; set **in the Portal**;
a machinery without its Tank Capacity – the rule is not for it ("2 number ok"); and "ata aple app madhe ratri 12 nantr next day chalu
hotoy ata 12 nko tr sakali 6 am nantr next day chalu hoil ok ani super admin la asa access banaun de ki jari ajun wel change kraychi
garaj padli tr portal madhun site wise change kru shakel".

**No database step.** Both settings are kept per site in `app_settings` (`SITE_RULES.dayStart`, `TANK_EVERY`). Nothing saved before
changes.

## 1. The ERP's day starts at 06:00 (per site, the Super Admin in the Portal)
* `today_()` and `reqDay_()` count the day from the site's **day start** (`DAY_START_DEFAULT_` 06:00 unless the Super Admin sets
  another hour): from 00:00 to 05:59 "today" is still the day before – the date of a new entry, the users' date rule ("only today's
  entries"), "a date after today", the reports of today, the page's and the app's today (they take it from the server).
* The time a thing was saved (Activity Log, photos) stays the clock's.
* The site's Settings page (`saveSiteRules_`) keeps the day start as it is.

## 2. A tank check every N days before diesel
* **The rule of a site** (`TANK_EVERY`): days for **Own / Rental / Hired** (empty = not for that group) and **machinery-wise** lines
  (on with its own days, on with its group's days, or off) – a machinery's own line wins over its group. The rule begins on the day it
  is first saved (`since`).
* **Not for** a machinery that is Inactive, on Debit Basis (or Debit), without its Tank Capacity in Asset Master, or on a fuel other
  than Diesel.
* **Due:** on the date of a diesel issue when the days from the day after its last tank check reach N (a check on the 2nd, 7 days →
  due with a fill on the 9th). Never checked: counted from its first diesel on or after `since`. Bills do not change this – the check is
  due whether the month's bill is made or not.
* **Diesel Issue (one entry and Multiple entries):** the machinery chosen, the page asks `tankDue`; when due, a **Tank check due** box
  shows (the diesel found in the tank before filling; the reason when the system's figure differs by more than 5 L / 10 %). Without it
  the fill is **not saved** ("X: tank check due – the last one on … a check every N days. Type the diesel found in the tank before
  filling (Tank check), then save."). In Multiple entries the box is in the first row of that machinery.
* **What is kept:** the check is the tank **before** the fill = the tank at the end of the day before the fill, so it is kept as a tank
  check of that date (reason "Before the diesel of dd-mm-yyyy (a check every N days)"), through the same `tankCheckAdd_` – the Log
  Book's tank, the next entry's opening and the bill's month-end check read it as every check. The month close still applies to that
  day.
* **Import Diesel:** a fill whose check is due is refused – it is entered in Diesel Issue with its check (or the check first on the
  Tank Check page).
* Editing an issue does not ask it.

## 3. The Portal: Sites → a site → "Day & tank check" (the Super Admin only)
* The hour the day starts (HH:MM), the days for Own / Rental / Hired, and machinery-wise lines – add, change, delete; the list of the
  site's machinery says why the rule is not for one (Inactive, Debit Basis, no Tank Capacity, fuel).
* The Portal asks Mechanical with its signed admin ticket (`siteRules`, `siteRulesSave` – `server/portal.js` lets through only those
  fields); Mechanical checks everything again (`sysSiteRulesSave_`), writes the Activity Log ("Day & tank check", before / after) and
  the Portal its audit.

## What changes
* **Server (`app/Code.gs`)** – `DAY_START_DEFAULT_`, `dayStartMin_`, `today_`, `reqDay_`; `siteRules_` / `saveSiteRules_` with
  `dayStart`; `tankEvery_`, `tankEveryDays_`, `tankDue_`, `tankDueInfo_` (action `tankDue`), `tankDayOpen_`, `tankBeforeDiesel_`,
  `siteRulesInfo_`, `sysSiteRulesSave_`; `saveDieselIssue_`, `saveDieselBulk_`, `importDiesel_`, `tankCheckAdd_(…, fromDiesel)`.
* **`app/Sites.gs`** – `sysPortalAdmin_`: `siteRules`, `siteRulesSave`. **`server/portal.js`** – `verifyAdmin` for both.
* **Page (`app/App.html`)** – Diesel Issue's tank check box (`dieselTcCheck`), Multiple entries' row box (`rowTcCheck`), the help
  rule in English, Marathi and Hindi (`FIX_RULES`).
* **rcl-portal** – `api/admin.js` `siteRulesGet` / `siteRulesSave`; Sites → "Day & tank check" panel.
* **rcl-mobile 3.76.0** – Diesel Issue's box (one and Multiple entries); Super Admin → Sites → Day & tank check.

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 156 / 156 (new `update-203`: the day start at 00:00 / 05:59 / 06:00 / 23:59
  IST, `reqDay_`; the rule's checks; a fill due / not due / after a check; refused without it; kept at the day before with its reason;
  Multiple entries; Import; a rule off; Debit Basis, Inactive, no capacity). The page's script blocks parse; `node --check` on
  `server/*.js`, `api/*.js`; FIX_RULES coverage within its limit.
* rcl-portal unit: 20 / 20 (new: the panel and the two actions).
* The rig in Chromium (Postgres + PostgREST + Portal + Mechanical): the Portal's panel saved (06:00, Own 1 day) → Mechanical's
  Activity Log line → Diesel Issue showed the box, refused the fill without it, saved it with the check (kept on the day before:
  "Before the diesel of 02-11-2026 (a check every 1 days)") – all passed.
* rcl-mobile 3.76.0: the build on GitHub Actions (analyze, tests, screens).

## Not verified
* Not run on the live sites or a real phone / iPhone.
* **Tank Capacity:** on the rig 272 of 276 machinery had no Tank Capacity – such machinery is not under the rule until its Tank
  Capacity is filled in Asset Master (the panel lists them as "no Tank Capacity").
* The Store, Purchase and Engineering still start their day at 00:00 (not changed in this update).
* A page left open from before the update shows no box until it is reloaded (the server still refuses the fill).

## Going back
Vercel → Instant Rollback to update-202 (and the Portal / the app to their earlier versions). The two settings stay in
`app_settings` and are simply not read.
