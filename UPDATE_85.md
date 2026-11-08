# update-85 – Diesel Issue: 4 photos with time and place, the AI reads the meter; the app opens only with the location on (12-10-2026)

Asked by the owner on 12-10-2026 (discussed first, his answers):
* 4 photos at a diesel issue: the dashboard (meter), the vehicle with its driver, the litres on the dispenser, the line in the
  register. **Not compulsory yet** – he will say when.
* Taken **with the camera only**, there and then – not from the gallery. The **time and the place** on each photo.
* The **AI reads the reading on the dashboard photo** and puts it in the form; the person may change it; **one reading** is saved.
* **Location off → the app does not open**, for **every user** (phone and computer).
* The photos are kept in Supabase; the entry has their links and he can look at them. Made smaller, but clear.
* The entries are made by the person who gives the diesel, on the phone.
Later (not in this update): no-reading entries going for approval, alerts on WhatsApp / e-mail, photos compulsory.

**One database step** (his approval given): `sql/supabase_step1x_diesel_photos.sql` – Supabase → SQL Editor → run once. It only
ADDS one empty column `diesel_issue.photos` and one PRIVATE Storage bucket `diesel-photos` (JPG only, ≤ 2 MB a picture). Until it
is run the app works as before; taking a photo says that this file must be run first. Nothing to set in Vercel (the AI uses the
assistant's key GEMINI_API_KEY; no key → no AI reading, the photos still work). Live is update-84 (`c867b22`).

## What the person sees
| Place | What |
|---|---|
| Opening the app | Location not allowed / GPS off → the whole app is covered by "Location चालू करा" with what to do (Marathi, Hindi, English) and "पुन्हा तपासा / Check again". Checked when the app opens and each time it is looked at again; not watched all the time (battery). |
| Diesel Issue → One entry → after picking the machinery | "Photos": 4 tiles – Dashboard · Vehicle + driver · Dispenser litres · Register. A tile opens the phone's camera. The photo is made smaller (longest side 1600 px, ~200–400 KB), a dark band under it gets the date, time, kind, machinery, latitude / longitude (± metres); it is sent at once and the tile shows it with ✓ (tap = take it again). |
| Dashboard photo | "The AI is reading the meter…" → the KM / Hrs box filled (blue) and "AI read on the dashboard photo: 4,517.3 hr – check it with the photo". Typing over it = the typed value. Debit Basis machinery: not asked. |
| A gallery picture (older than 3 minutes) | "Take the photo now" – refused. |
| Machinery changed after photos | the photos are removed ("take them again") – a photo shows its machinery. |
| Save | the photos go with the entry. Edit of an entry: no tiles, its photos stay as taken. Multiple entries / Excel: as before (no photos). |
| Diesel Issue list | 📷 4 on an entry with photos → the 4 photos large, each with its time and "📍 Map (± m)" (Google Maps). The links open the pictures for 15 minutes. |
| Help (EN / MR / HI) | Diesel Issue page; 3 new error helps (location, AI reading, photo). |

## How it works (where)
| File | Change |
|---|---|
| `sql/supabase_step1x_diesel_photos.sql` (new) | the column and the private bucket; shown word for word in Read Me (`app/ReadMe.gs`); `NEW_SITE_SETUP.md` step list |
| `app/Code.gs` | `uploadDieselPhoto_` (one photo → Storage `diesel-photos/<yyyy-MM>/<uuid>.jpg`; who / which machinery / when / where kept 6 h in the cache), `meterReading_` + `aiReadMeter_` + `meterAnswer_` (the AI reading – its own question, after the photo is kept), `photosOf_` (a save takes only photos THIS user sent for THIS machinery in the last 6 h, each kind once; a photo goes with ONE entry), `dieselPhotos_` (15-minute links), `photosReady_` (the SQL step run? – asks the database itself when the server's memory copy of the table is older than the step), `photoList_`; `saveDieselIssue_(d, u)`; list rows `ph`; Database check "step 1x"; API `dieselPhoto`, `getMeterReading`, `getDieselPhotos` |
| `app/SupabaseSync.gs` | `diesel_issue.photos` in the table list (so the Google Sheet backup has it) |
| `app/SupabaseData.gs` | a column of the app missing in the FIRST row of a table is looked for in the other rows (the server's memory copy keeps rows read before the column was added) – without this, for up to 15 minutes after the SQL step, saving ANY diesel entry could be refused once a photo entry existed (found in testing) |
| `server/gas.js` | a blob of bytes as a request body (the picture), `Utilities.base64Decode` |
| `server/page.js`, `server/runtime.js` | `dieselPhoto` is tried again 3 times (like a question), not for ever (like a save) – on a weak signal the person can take it again or save without it |
| `app/App.html` | location screen and checks (`locCheck`, `locNow`, `locDenied` – an app opened BEFORE this update reloads its whole page once, see below); photo tiles, camera, making the picture (`phMake`), `phTake`, `phAskMeter`, `phApplyRead`, `phView`; `formDirty` counts unsaved photos (a new version of the app waits, as for a half-typed entry); help |
| `app/Index.html`, `vercel.json` | the app's frame and the site's header allow the location (`geolocation=(self)`, this site only) |

**An app that was open when this goes live**: a new version only renews the app inside its frame; the outer page stays the one
loaded before, which did not allow the location. The new app sees that and loads the whole page once (at most once in 5 minutes,
never in a loop), which brings the new outer page – nobody is locked out. (Tested: `shell85.js`.)

## Evidence (local rig – Storage and AI stand-ins; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `photo85.js` (new, PHONE screen 412 × 915, touch, Android): no location → whole app covered, sign-in cannot be pressed; allowed + Check again → opens; tiles only after picking a machinery; each tile opens the camera (`capture=environment`, pictures only); a 3000 × 4000 camera picture (1.2 MB) → 1200 × 1690 (1600 + band), ~220 KB, dark band with writing; the store has exactly that picture; the AI got the small picture and the Hrs box shows 4517.3 (blue, note); typing 4517.5 → that is saved (ONE reading); a landscape photo → 1600 × 1320; the AI asked only for the dashboard; a gallery picture (1 h old) refused with the photo help; 4 ✓; unsaved photos keep a new version away; saved: reading 4517.5 + 4 photos with time and place (Nashik ± 18 m); list 📷 4 → 4 pictures, kinds, times, map links; machinery changed → photos removed; edit → no tiles; location switched off before a photo → no photo, location screen; no script error | 31 passed, 0 failed |
| `photo85api.js` (new, server): before the SQL step → refused naming the file; the file runs twice safely; refused: no location, unknown kind, not a JPG, machinery not in Master; AI reading `{off:true}` without a key; 4 photos kept; a save with them; kept with the entry (time / place as the server noted); list `ph: 4`; links in order; a link opens the very picture; a made-up link does not; refused: a photo already with an entry, a photo of another machinery, the same kind twice, a photo as another kind, a name never sent, another user's photo; View user: cannot send, can look; no Diesel Issue: cannot look; an edit keeps the photos | 25 passed, 0 failed |
| `shell85.js` (new): the OLD outer page (update-84) + the new app → one reload, no loop, then the location screen; the NEW outer page → opens at once | 5 passed, 0 failed |
| unit (1 new test + 1 changed on purpose, see below) | 57 / 57 (net not run) |
| Server suites: saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 · audit 36 / 0 · reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known "backup is not set up" on the rig) | |
| Browser (with `geo-shim.js` – a test browser with its location on): sweep 38 · least68 9 · hardenpage 10 · entry71 20 · works69 34 · gap77 20 · time78 10 · item2 13 · lgrows 12 · xls 14 · tank 7 · viewbill 23 · billlock 17 · rate69 19 · lbpage 13 · lxlook 10 · splittime 18 · half 12 · time76 10 · timefmt70 6 · tm 4 · tmbill 6 · lbbasis 9 · gstdecl 11 · debit 5 · dnui 8 · boq 8 · big 18 · fix 8 · retry 10 · brand 13 · logo79 6 · group72 13 · master75 13 · screen72 23 · media75 21 · access84 18 · search83 13 | all 0 failed |

An independent review of the change (by an agent that had not written it) found 12 points; corrected before delivery: an app open
during the update would have been locked out (→ reload once); the same photos could go with several entries or another machinery
(→ tied to the machinery, one entry); a photo on a weak signal was sent again for ever and blocked the Save (→ 3 tries); the AI
reading inside the upload could pass the server's time limit (→ its own question after); a slow GPS fix locked the app (→ the
quicker place / the last 2 minutes, a message); "Finding your location…" could stay for ever (→ "Check again" after 25 s); a big
photo decoded at full size on a cheap phone (→ decoded smaller); an iPhone photo could come out turned (→ Safari uses the picture
itself, which turns it upright); unsaved photos did not stop a new version (→ they do).

Tests changed ON PURPOSE:
* unit "talking with the assistant needs the microphone": it checked `geolocation=()` ("not used, stays forbidden") – now the app
  uses it: `geolocation=(self)` and the frame allows it.
* `group72`, `master75`, `media75`, `push75`, `relay73`, `screen72`, `version74`: they meant to give their test users "Log Book +
  Dashboard Edit, the rest No access", but took the page list as objects and sent no access at all; until update-84 a page not
  sent was View, since update-84 it is No access – so master75 and screen72 failed on the LIVE version too (checked: they pass on
  update-83, fail on update-84 unchanged). The app is right; the tests now send what they meant (`.key`).
* every browser test runs with `test/browser/geo-shim.js` (`NODE_OPTIONS=--require …`) – the app needs the location now.

## Not verified / said plainly
* **Real phones and the real services**: the AI's accuracy on real dashboard photos (the rig has a stand-in that answers what the
  test sets); real Supabase Storage (the stand-in follows its documented API: upload, batch-sign, private bucket); Android camera
  apps and iPhone Safari (orientation, the location prompt). First live test: one fill with 4 photos on a phone.
* **Computers in the office**: the location is compulsory for every user (his rule). A computer whose Windows location is off
  (Settings → Privacy → Location) gets the location screen and cannot open the app until it is on – Admin's computer too.
* Not run: `push75`, `relay73`, `version74` (they need their own servers / relay on ports 3009 / 3010) – only their user-access
  line was changed; `nightrow` (needs its own server).
* Photos of a retake, a form left unsaved, or a deleted entry stay in the bucket (nothing deletes pictures). About 4 × 250 KB a
  fill; a clean-up of pictures no entry uses can be added later.

## Going back
Vercel → Instant Rollback → update-84 (`c867b22`). The SQL step can stay (an empty column and an empty bucket harm nothing); the
photos already taken stay in the bucket and in the column. If rolled back, open apps are not locked (update-84 has no location
screen).

## To deploy (owner)
1. Supabase → SQL Editor → paste `sql/supabase_step1x_diesel_photos.sql` (also in the app: Read Me → SQL) → Run.
2. ```
   cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
   git status
   Expand-Archive -Path "$HOME\Downloads\rcl-update-85.zip" -DestinationPath . -Force
   git status
   git add .
   git commit -m "update-85: diesel issue photos with time and place, AI meter reading, location on to open the app"
   git push
   ```
3. Vercel "Ready" → open the app on the phone → allow Location → Diesel Issue → pick a machinery → take the 4 photos → Save →
   📷 in the list.
