# update-139 – The Hour meter photo (with App 3.29.0) (20-10-2026)

**Asked:** "jya gadich 2 engine yet tith 2 reading takayla lahtat ek km ani ek hrs tr ase 2 photo weg wegle gheta yawet".

## What changes
* **A 5th photo, the Hour meter.**
  * It is shown for a machinery measured by **KM and Hrs** (not Debit Basis), whose hour meter is often not on the dashboard.
  * It sits next to Dashboard, Vehicle + driver, Dispenser litres and Register.
  * A machinery with one reading keeps the 4 photos.
* **The server** (`app/Code.gs`):
  * `PHOTO_KINDS_` has `hrs: 'Hour meter'`; `PHOTO_ORDER_` gives the order dash, hrs, veh, pump, reg;
  * an entry keeps up to 5 photos;
  * the messages name the photos (`PHOTO_NAMES_`);
  * `getMeterReading` with kind `hrs` asks the AI for the hours only (`aiReadMeter_(…, 'hr')`).
* **The web page** (`app/App.html`):
  * the tile shows only for such a machinery (`phKindsOf`);
  * its photo is read by the AI as the dashboard's is, and fills the **Hrs** box; its hours win over hours read on the
    dashboard photo;
  * the note says "the hour meter";
  * five tiles fit on one row on a computer (`.dph-grid.five`); a phone shows 2 a row as before.
* The help rule for the photo messages covers the new texts (`FIX_RULES`).
* Words in मराठी / हिंदी (`app/i18n`). The three old "4 photos" messages are taken out.
* **No database step.**

## Evidence
* `node --test test/unit.test.js` **96 / 96**. The update-85 test expects the 5 kinds, the same on page and server, and the AI asked
  for the hour meter photo.
* `node --check` on server/api passes; the 6 script blocks of the page parse.
* Rig browser `test/browser/photo139.js` **11 / 11** (phone screen, Storage and AI stand-ins):
  * the server refuses an unknown kind and names the five;
  * the Hour meter photo is asked for the HOURS only (the AI's question has no odometer); the dashboard photo as before;
  * KM machinery: 4 tiles; KM + Hrs machinery: 5 tiles;
  * Dashboard → KM 45173.4, Hour meter → Hrs 1251.5 (both blue, in the note);
  * saved with 5 photos;
  * `getDieselPhotos` lists them in order with their names.
  * Picture `test/shots/photo139_tiles.png` (local).
* `test/browser/photo85.js` **35 / 35** again (the 4 photos as before).

## Not verified
* Not tried on a real phone or the live site.

## Going back
Vercel → Instant Rollback to update-138. No SQL.
