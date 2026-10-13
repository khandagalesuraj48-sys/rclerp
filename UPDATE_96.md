# update-96 – "Change site" in the dark menu; a clean top bar for users; a site deleted in the Portal (13-10-2026)

Asked by the owner on 13-10-2026 (the layout picked from a preview):
* at the top of the dark menu, **Change site**; under Machinery, his **other modules of this site**;
* the top bar of a **user** stays clean: Backup, Supabase and the like are for the Admin only;
* the Super Admin can **delete** a site in the Portal (Portal PR of the same day).

## What changed
| Where | Before | Now |
|---|---|---|
| Dark menu, top | – | **Change site** with the name of the site he is on. Pressed: his sites (the open one marked), and through the Portal also "All my modules". Another site opens through the Portal with a new ticket, without signing in again. With the reserve sign-in (`?local=1`), the app's own switch is used, as in update-90. |
| Dark menu, under Machinery | – | His other modules of this site (e.g. Store ↗). One opens through the Portal. Shown only when he has another module on this site. |
| Top bar | "Modules" button, module shortcuts, site pill | Gone from the top bar; their jobs are in the menu above. |
| Top bar of a user (not Admin) | Backup, "Supabase", month-close pill | Hidden. The Admin sees them as before. The database and fault pills were already Admin-only. The backup runs by itself. A date inside a closed month is still pointed out while typing, and the server still refuses it. |
| `portalAdmin` | acts users / pages / siteSql / siteSetup | + `siteOff`: the Super Admin deleted the site in the Portal. Here the site is only set to `closed` in the list of sites: nobody opens it, and **nothing of its own database is touched**. The first site is refused ("This is the first site – it cannot be deleted.", with a FIX_RULES rule in EN/MR/HI). |
| `siteSetup` | a ready site kept its company settings | A closed site brought back with **the same** database also keeps its own settings. |

No SQL. The calculations, the permissions and the data are not changed.

## Evidence (local rig – never live)
* `test/browser/portal91.js` 21 / 21:
  * the menu starts with Change site and the site name;
  * Store sits under Machinery and opens through the Portal;
  * Change site lists his sites (the open one marked) and "All my modules", and opens T2;
  * a User's top bar has no Backup or Supabase pill;
  * on a phone, the menu shows Change site;
  * no script error.
* `test/browser/site90.js` 24 / 24: without the Portal, Change site works with the app's own switch, as before.
* `test/newsite95.js` 32 / 32 (5 new checks):
  * the site is deleted in the Portal and is "closed" here;
  * its database is untouched;
  * an open session there can do nothing more;
  * no new ticket is given;
  * "New site" with the same link brings it back Ready, with its own settings.
* Unit 61 · portal91api 40 · portal94api 17 · site90api 75 · backup 30 (run with `APP_DIR=/home/claude/vercel`, after the rig's Super Admin row was cleared) · site89 38.
  site89 failed once on `web.cache` straight after other tests and then passed alone. This is the same pre-existing flake as in update-95.
* Portal: API 90 / 90 (12 new: deleting sites, companies and modules, and Mechanical refusing the first site) · browser 34 / 34 · unit 6.
  Its browser test once waited longer than 20 s for "Check & set up" (2 runs out of about 10). The wait is now 40 s and the test reports the error message if there is one. The cause of the slow answer was not found.

## Not verified
* Not run on live.
* Not tried on a real iPhone or Android. The phone check is a 412-px Chromium.
* The menu of a person with a real second module (Store does not exist yet). On the rig, the second app server plays "Store".

## Going back
Vercel → Instant Rollback to update-95. A site already set to "closed" stays closed. "New site" with its link makes it ready again.
