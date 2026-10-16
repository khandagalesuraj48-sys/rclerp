# update-120 – Bill copies of a diesel inward, several at once (16-10-2026)

**Asked:** "ata nantr jewa diesel inward hote tewa inward bill copy pn add krayche aahet ok inward copy eka weli multiple click
krun save kru shakel user".

## How it works
* **Diesel Inward → "Bill copy"** (under Bill Date; only for "Diesel received from pump", not for Opening stock / Extra diesel):
  * **📷 Take photo** – the camera; press again for the next copy (one after another);
  * **🖼️ Choose photos** – several at once from the gallery;
  * up to **10** with one inward. Each is made smaller (longest side 2000 px – the writing of the bill stays clear, about
    300 KB), sent at once, and its tile shows ✓; **✕** takes a copy out; a tile pressed opens the picture large.
  * "Save inward" waits until every copy shows ✓ ("A bill copy is still being sent").
* **The list:** "📷 n" next to the Inward ID → the copies open large (Bill copy 1, 2 …, the time each was added).
* **Edit:** the copies the inward has are shown – keep, take out, add. "Update" asks: "Bill copy – 2 photos → 3 photos (1 added)".
  An edit that does not touch the copies (or an older page / phone app) keeps them as they are.
* **Who:** Diesel Inward **Edit** adds copies; **View** may look at them; no access – not even look. A copy goes only with an
  entry of the person who added it (within 6 hours), and with one entry only.
* **Verification:** an inward sent for verification takes its copies with it; the approver reads "bill copies 2" in the entry;
  approved later (also days later), it is saved **with** its copies.
* **Phone app 3.1.13** (rcl-mobile): the same "Bill copy" in New / Change Diesel Inward (camera or gallery, several at once).

## Found and fixed on the way (live today)
**A diesel issue with photos sent for verification was ALWAYS "Returned – not saved" at the approval** ("The Dashboard photo was
not taken by you in the last 6 hours…"): the check made when it is sent removed what the server remembered of the photos. Measured
on the rig with the code before this update: approved at once → Returned, not saved. Now: the photos are noted with the request
and kept for its approval (no other entry can take them meanwhile) – approved at once or after 6 hours → saved with its 4 photos.
Entries sent before this update are not mended (their photos are not noted): approved, they are still returned – send them again.

## How it is built
* **SQL step 1zb** `sql/supabase_step1zb_inward_bills.sql` (in **every** site's Supabase: VTR NH 848, 18B KOLHAPUR): only adds the
  empty column `diesel_inward.photos`. The pictures go to the private bucket `diesel-photos` (step 1x, already run), folder
  `inward/`. Until it is run: adding a copy says this file must be run; everything else works as before. Listed word for word in
  the Read Me; New site runs it by itself.
* `app/Code.gs`: actions `inwardPhoto` (`uploadInwardPhoto_`), `getInwardPhotos` (`inwardPhotos_`, `photoLinks_`); `billsOf_`,
  `billList_`, `billsReady_` (`photoColReady_`, shared with the diesel photos); `saveInward` / `updateInward` take the user and
  `photos`; the inward list gives `ph`; the approval summary "bill copies n". Verification: `FLOW_PHOTOS_`, `photoRecs_`,
  `photosTaken_` (diesel photos and bill copies). `server/page.js`, `server/runtime.js`: `inwardPhoto` tried again like a
  question (as `dieselPhoto`). `app/SupabaseSync.gs`: the column.
* `app/App.html`: the "Bill copy" box (`IB`, `ibAdd`, `ibLoad`, `ibForSave`, `ibView`), `phMake(file, null, 2000)` (no band),
  the list button, the Update question; FIX_RULES (bill copy messages); PAGE_GUIDE (inward: `inwardPhoto`, `getInwardPhotos`,
  the text); Marathi / Hindi words.

## Evidence (local rig, test data only)
* Unit 84 / 84 – new "update-120": the list kept (only `inward/` names); what a save takes (own, another's, a diesel photo,
  never sent, twice, more than 10, not given = kept, an edit keeps the inward's own); sent for verification → noted, held, used
  at the approval after the server forgot; the page's `ibForSave` / `ibWhat`; page = server (10); the help; the SQL step.
* API `test/inward120api.js` 44 / 44 (real Postgres + the Storage stand-in): before the SQL step – refused naming the file,
  an inward without copies saved as before; the step runs twice; copies kept as sent; saved with 3; the list "3"; links open the
  very picture, a forged link does not; the refusals above; 10 saved, 11 refused, nothing written by a refused save; edit:
  take out / add / keep (time kept), without the list – kept, all taken out; the Activity Log; View looks, cannot add; no access;
  verification: sent, noted, held, approved after the server forgot – saved with its copies, as the maker's; **the diesel issue
  with 4 photos through verification – saved with them**. The same diesel check on the code before: **returned, not saved**
  (approved at once and after 6 hours).
* Browser `test/browser/bills120.js` 17 / 17: the box (camera / several at once); 3 photos of 3000 × 4000 picked together →
  "Sending" → ✓, kept 2000 × 1500 (~274 KB each); ✕; saved with 2; the list "📷 2" opens them; Edit shows 2, one more from the
  camera, "Update" asks "2 photos → 3 photos (1 added)", saved; 9 more with 3 there → 7 added and said; Clear changes nothing;
  Opening stock – no box; a phone (390 px) – 2 tiles in a row; no page error. Screenshots looked at.
* Old tests: flow114api 30 / 30; browser flow114 12 / 12, flow116 18 / 18, remind118 13 / 13, lang110 17 / 17, photo85 35 / 35
  (without the location stand-in, as written); newsite95 37 / 37 (the new site has the column). photo85api: 20 / 20 up to its
  user part, which stops because a site Admin may not add users any more (Super Admin only – the same on main, not this update).
* `node --check` server/*.js, api/*.js; the page's script blocks parse (unit test).

## Not verified
* Not run on the live sites; not on a real phone (camera, gallery – the app's build runs its tests and draws the screens).
* Translations of the new words were made by me (AI).

## Going back
Vercel → Instant Rollback to update-119. Copies already kept stay in the column and in the store (the older code does not show
them). The column can stay (the older code does not read it).
