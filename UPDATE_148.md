# update-148 – Approvals → Details: the photos and bill copies themselves (24-10-2026)

**Asked (24-10-2026, his screen of VF-00046):** "details mdhe attachment disayla haw". The Details of update-147 showed the photos of
a diesel issue as a table of their file names ("# K P · dash 2026-10/1dd0c88f-….jpg · veh … · pump … · reg …") – a mistake of
update-147: a list of photos was taken for rows of the entry.

## What changes
* **Details shows the pictures themselves**, each with its name (Dashboard, Hour meter, Vehicle and driver, Dispenser litres,
  Register; an inward's "Bill copy"; a row's photo "Row 2 – Dashboard"), small; **pressed – full size**, as the photos of a saved
  fill (`.phv-grid`). Never a file name. The links open the pictures for 15 minutes (the same private store and links as
  `getDieselPhotos`; one call for all the entries asked, also in the bulk question).
* The photos of a list of entries (Multiple entries) are taken out before the rows are made into a table.
* If the pictures cannot be opened just then, the message says so under them; the rest of the details are as before.
* **Server:** `approvalDetails_` – `addPics` (photos / billPhotos / copies, first of all keys), `pics: [{ label, at, url }]`,
  `photoLinks_` once for all; `photos` = how many. **Page:** `crDetHtml` – the pictures (`.phv-grid.cr-pics`). **Phone app:** App
  3.31.6 – the same pictures (`_Pic` in `approval_details.dart`; pressed – full size).
* Help (English / मराठी / हिंदी): the Approvals guide says it. No database step, no setting, no access change.

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – 105 / 105; the page's script blocks parse.
* `test/details147api.js` – 24 / 24 (new: a diesel issue with two photos → the checker's Details: "Dashboard", "Dispenser
  litres", each a link that opens the picture; no table; no file name among the fields).
* `test/browser/details147.js` – 10 / 10 (new: the two pictures load in the details, named; no ".jpg" anywhere in the text).

## Not verified
* The live site; a real phone.

## Going back
* Vercel → Instant Rollback to the deployment before this update (no database step).
