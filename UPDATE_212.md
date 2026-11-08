# update-212 – HO's cars as a gallery with their photos; a car's details; the photos set by the Admin / Super Admin (also from the Portal) (08-11-2026)

**Asked:** "MASTER IMPLEMENTATION PROMPT – HEAD OFFICE VEHICLE GALLERY & INTERACTIVE VEHICLE MANAGEMENT … HEAD OFFICE ONLY" (Machinery →
Dashboard → Fuel Cards & Cars: premium gallery cards with the car's photo, search, Gallery / Table, a car's details on a click; Admin
upload / replace / remove with preview, validation, compression; responsive; no dummy data; strictly no destructive change).
His answers: the Super Admin sets / changes a car's photo **from the Portal, by its Machinery Number**; the **Admin and the Super Admin**
from HO too; **a preview first** (approved 08-11-2026, with: the 15-minute links renew by themselves; a changed Machinery Number keeps its
photo; access checked on the server; replacing / removing never deletes another file or a bill; the app with real camera / gallery,
preview, compression, upload; no SQL; other sites unchanged; tested on desktop, phone and the Portal).

**No database step.** With **rcl-portal** (Sites → Vehicle photos) and **rcl-mobile 3.86.0** (the app's own gallery and car screen).

## How HO is known
A site **on fuel cards** (`cardSite_()` – the Super Admin sets it in the Portal: Sites → Diesel places → Fuel cards). That is HO today. Every
new action begins with `cardSiteOnly_()`: at every other site it is refused ("This site is not on fuel cards …"). And one site = one database:
HO's photos and their list are in HO's own database and file store – another site's server never reads them.

## What changes
1. **The Dashboard of HO (web)** – the summary band as before (card balances, totals, Today / This month / Last month, From – To). The Cars
   panel: a **gallery** (4 a row on a desktop, 2 on a phone, 1 on a very small one): photo (or a drawn car / truck / machine), fuel, Active /
   Inactive, the number big, make · model, fuel filled and ₹, the card / cash bar, fills, average (as before), **KM now** (the latest Log Book
   closing or fill reading up to "To"), last fill. **Search** by a part of the number (letters and digits only), make or model. **Gallery /
   Table** – the table exactly as before; the search and the choice kept. A click (or Enter) on a card or a table row opens **the car**:
   a panel from the right (the whole screen on a phone; Esc / ✕ closes) – its photo, number, make · model, fuel, kind, status, KM now; fuel
   filled, expense, average, by card, cash, fills; tabs **Fuel history** (date, fuel, qty, ₹, card / Cash, KM), **Log Book** (date, shift,
   start / close / KM, driver) and **Maintenance** (date, garage · bill, works, KM, ₹, Service).
2. **A photo (the Admin / the Super Admin)** – "📷 Add photo" on a card without one; "Change photo" / "Remove" in the car. JPG / PNG / WebP
   (≤ 25 MB as picked) → turned upright and made a JPG of at most 1600 px (≤ 2 MB) and a small one of 480 px (≤ 400 KB) **on the page**,
   **shown first** ("Nothing is saved until you press Save photo"), saved with a progress line; Remove asks first.
3. **The server** (`app/Code.gs`, "THE CARS' PHOTOS AND ONE CAR'S DETAILS"):
   * `carPhotoSet` / `carPhotoRemove` – `admin: true` in API_ **and** checked inside (`CAR_NOT_ADMIN_`); each file a real JPEG (its first bytes)
     and within its size; kept in the private store under its fingerprint `car/<2>/<sha256>.jpg` (never overwritten; the same file = the same
     object); the car's line in the site's setting `app_settings CAR_PHOTOS` `{ key: { p, t, at, by } }`; a screen opened before another change
     is refused (`was`); at most 60 a person a day; the Activity Log: "Car photo added / changed / removed: <number>" (module Master).
   * **Nothing is ever deleted from the store**: Change / Remove change only the car's line (the earlier file stays, like every bill and
     attachment of erp-files) – a maintenance bill or another car's photo cannot go with it.
   * `getCarDetail` (Dashboard view) – the fills; the Log Book only for a person who may see the Log Book; the maintenance only for one who may
     see Maintenance or Reports (as the car's Maintenance Log Book); `may.photo` for the screen (the server checks again on a save).
   * `getCarPhotoLinks` – new links; `getCardDash` gives each car `make`, `status`, `kmNow`, `photo { t, f, exp, v }` (its figures untouched).
   * **Links**: 15 minutes (the store's signed links, `attLinks_`); the server uses one for 10 of its minutes (the same link again = the
     browser's / phone's own copy) and says when it ends; the page asks for new ones by itself 90 s before (a check each minute while the
     Dashboard is open, and on coming back to the tab) and at once when a picture does not open – **no reload**.
   * **A changed Machinery Number** (`renameMachine_`): the car's line moves to the new number **in the same save** – `kvInSave_` puts the
     setting into the save's one database transaction (`web_write`, app_settings like any table): written only if the rename is written.
     A line left under the new number (a machinery no longer in Asset Master) is taken off it, never given to this car.
   * A list of photos that cannot be read stops a change (never taken as "no photos" and written back); showing them, it only hides them.
4. **The Portal (Super Admin)** – Sites → a site's row → **Vehicle photos**: every machinery of its Asset Master by number with its photo,
   search, Upload / Change / Remove, the same making-smaller and preview. The Portal signs a ticket naming the two files' **SHA-256**; the
   files go **beside** the ticket (`server/system.js`); Mechanical keeps them only if they are exactly those files (`carPhotoSet_` with
   `sha`), once per ticket (`portalOnce_`), as "Super Admin (Portal)". A site not on fuel cards answers "not on fuel cards".
5. **The app (rcl-mobile 3.86.0)** – its own gallery on Dashboard → Fuel cards & cars (search, Gallery / List), its own car screen (photo
   over the top, figures, Fuel / Log Book / Maintenance), Add / Change photo from **the camera or the gallery** (a computer: a file), made
   smaller on the phone, shown first, saved; Remove asks first. The phone keeps each picture by its own mark and renews links by itself.

## Security and permissions (checked on the server)
| Who | Sees the photos / a car's details | Sets / changes / removes |
|---|---|---|
| HO's Super Admin (Portal or HO) | yes | yes |
| HO's Admin | yes | yes |
| HO's user with Dashboard (View / Edit) | yes (Log Book / Maintenance only with that page) | **no** – "Only Admin can open this." |
| HO's user without Dashboard | no | no |
| Any person at another site | no – "not on fuel cards" | no – "not on fuel cards" |
| The Portal with a ticket for other files / used twice / unsigned | – | refused |

## Evidence
* Unit: `timeout 400 node --test test/unit.test.js` – **165 / 165**. New `update-212`: every new action refused at a site not on fuel cards
  (nothing reaches the store); who may set / remove (the API rule and inside); a PNG called a JPEG, a web page called a photo, too big, an
  unknown car – refused; two files under their fingerprints, exactly as sent; the car's line; the Activity Log; the Dashboard's figures as
  before plus make / status / KM now / photo; the same link for 10 minutes (no new call), a new one when less than 5 minutes are left; the
  store cannot make links – the Dashboard still opens; a screen opened before a change – refused; the same file for two cars stored once;
  removing one car's photo leaves the other's; **no delete call to the store, no code that deletes from it**; a car's details as each person
  may see them; **a renamed number keeps its photo** (and a line left under the new number is not given to it); kvInSave_ waits in the save;
  the Portal's request with other files refused; the page's words; the help in 3 languages (FIX_RULES), the guide (PAGE_GUIDE).
* Rig API (`test/cars212api.js`, PORTAL=1): **51 / 51** – T2 put on fuel cards from the Portal (as HO); a Dashboard-View user refused by
  the server; the Admin's photo in T2's own store (the stand-in) and settings; it opens by its signed link, not without; the user sees it;
  details per access; rename → the photo follows; the Super Admin from the Portal; a ticket with other files / without fingerprints / used
  twice – refused; S1 (diesel stock) refuses everything, its database and settings unchanged; no store delete.
* The rig in Chromium (`u212/web.js`, 38 / 38, pictures looked at): desktop gallery, photos added through the page (a 4000 × 3000 JPG made
  1600 × 1200, a PNG, a WebP), shown first, saved; search; Table; a car's details (fills, Log Book, maintenance); Change photo; Remove asks;
  **a link ending → new links with no reload; a picture whose link ended → new links, the picture back**; phone width 390 px: 2 a row, no
  sideways scroll, the car over the whole screen; a Dashboard-View user: photos, no buttons, a photo sent by hand refused; the Portal's
  Vehicle photos (list, upload, preview, search) and the HO page showing the Portal's photo. No page error.
* Also run: `places117api.js` 33 / 33, `portal94api.js` 17 / 17, rcl-portal `test/api.test.js` 130 / 130, rcl-portal unit 22 / 22.
* `node --check` on `server/*.js`, `api/*.js`; the page's 7 script blocks parse; no secret in the change.

## Not verified
* Not on the live HO site or its real Supabase Storage (the rig's stand-in of the store); not with HO's real cars and photos.
* The app: only its own tests and pictures on GitHub Actions (Android + iPhone build) – **the camera on a real phone is not tested here**.
* Very large real phone photos (HEIC from an iPhone is turned into JPEG by the phone's picker before the app reads it).

## Going back
Vercel → Instant Rollback (Mechanical; the Portal). The photos and the `CAR_PHOTOS` line stay in HO's store / settings and do nothing to
the update before (it does not read them); the gallery goes, the table comes back. The app: the earlier release stays installable.
