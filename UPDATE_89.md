# update-89 – new sites, stage 1: the server is ready for several sites (13-10-2026)

Asked by the owner on 12-10-2026: one app for every site (VTR, Kolhapur 18B, and later more). Every site has its own Supabase
database and its own Google Sheet. A new site is made by the Super Admin from the app, without changing any code. Every change
to the app reaches every site. Stage 1 (this update) only gets the server ready. **Nothing changes for VTR. Its data is not
touched. No SQL. Nothing to set in Vercel.** Live: update-88 (`0cb1e58`).

## What changes (inside the server only – nobody sees a difference)
* A request can say which site it is for (`site`, a short code like `18B`). The page does not send it yet (stage 2). Not sent
  means the FIRST site, exactly as before: `SUPABASE_URL` / `SUPABASE_SECRET_KEY` / `BACKUP_SHEET_ID`.
* What the server keeps in its memory is now kept **per site**: the copy of the tables, the heartbeat's memory, and "is this
  SQL step installed?". So the data of two sites can never mix, even when their requests run one after the other in the same
  server.
* A site writes its backup only to its OWN Sheet. A site without a Sheet is told "not set up". It never falls back to the first
  site's Sheet (the Sheet calls check the Sheet id too).
* A site that is not set up is refused before anything is read: "This site is not set up (…)" (404). The help text for it is
  in EN / MR / HI.
* Where the other sites' settings come from: stage 2 / 3 (the sites list of the Super Admin). Until then only the test setting
  `RCL_SITES` can name one. It is not set on Vercel, so there is only the first site.

Code:
* `server/sites.js` (new)
* `server/gas.js`: `conf`, `useSite`, `site`, memory `LOCAL` / `BEAT` / `WARM` per site
* `server/runtime.js`: `useSite`, `COUNTER` / `WRITE` per site, the Sheet of the site
* `server/google.js`: `config(sheetOf)`, `call(…, sheetOf)` + the Sheet-id check
* `api/rpc.js`: `site` → meta, 404
* `app/App.html`: one help rule

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `site89.js` (new), on 2 app servers (one with ONE helper thread). First site = database rcl; second site "T2" = a second, blank database (rcl_s2, its own door). Checks: first site's sign-in and rows as before, with no site sent and with site ""; T2 sign-in in its own database; the first site's sign-in is refused on T2; T2 shows 0 diesel issues; the two sites take turns 6 times in the same thread and every answer comes from its own site; a vendor saved on T2 is in T2's database and not in the first site's; T2's company name shows on T2's sign-in screen while the first site's is unchanged; T2's backup is refused (no Sheet); **every one of the first site's 22 tables compared row by row before / after all of T2's work: not one row changed**; a site that is not set up gets 404; a wrong code is refused | 36 passed, 0 failed |
| unit (+2 messages in the help-rule check) | 58 / 58 |
| backup (Google Sheet, stand-in): privacy, manual, first, text, pieces, cutoff, failure, cron, changes | 28 / 0 |
| browser tests on the first site: sweep 38, entry71 20, works69 34, access84 18, mobile86 18, fold88 44, least68 9, hardenpage 10, photo85api 25 | all 0 failed |
| photo85 (32 / 3) and idle (4 / 6) | the SAME failures, test for test, on the live update-88 (`0cb1e58`) run on the same rig right after. They come from the rig, not from this update (photo85 passed 35 / 0 on the same code a few hours earlier). |

## Not verified / said plainly
* A real second Supabase project: the rig's second database stands in for it, the same way the first one stands in for VTR.
* Real phones.
* Not run: version74, push75, relay73, nightrow, shell85, compare69 (they need their own servers).

## Going back
Vercel → Instant Rollback → update-88 (`0cb1e58`). Nothing in the database to undo.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-89.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-89: new sites stage 1 - server ready for several sites, VTR unchanged"
git push
```
