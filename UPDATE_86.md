# update-86 – the server kept awake; no "Waiting for the server" words; on a phone: no keyboard by itself, a "saved" box (12-10-2026)

Asked by the owner on 12-10-2026 (discussed first; his answers): the server must stay active and never sleep, and the
"Waiting for the server" message is not wanted; on Android the keyboard sometimes opens by itself – it must open only when a box
is tapped; on a phone, after a diesel issue is saved, a proper "saved" pop-up – closing by itself in 3 seconds and by hand – with
the form cleared for the next vehicle (phone only, not the laptop). The other changes (Kolhapur 18B site, approvals, alerts) later.

**One database step** (his approval: "server continue active"): `sql/supabase_step6_keep_awake.sql` – Supabase → SQL Editor → run
once. It only ADDS a timetable entry (pg_cron) that calls the app's wake address every 3 minutes (pg_net), and a daily clean-up of
that timetable's own run log. No table, column or row of the app is touched. Nothing to set in Vercel. Live: update-85 (`78a2eb9`).

## What changes
| Where | What |
|---|---|
| Server | `GET /api/rpc?warm=1` (`api/rpc.js`): runs the sign-in screen's light step (orgInfo) in a helper thread and answers `{ ok, ms }` – no data, `Cache-Control: no-store`. Any other GET is refused as before (405). |
| Database | `supabase_step6_keep_awake.sql`: `oneclick-keep-awake` every 3 min → `https://oneclicksolution-erp.vercel.app/api/rpc?warm=1`; `oneclick-keep-awake-log` daily → run log older than 3 days cleared. Run again = safe (the entries are made again). Another site copy: its own address in the file. In Read Me (word for word) and `NEW_SITE_SETUP.md`. |
| The waiting bar (`server/page.js`) | the thin moving bar at the top stays when an answer is slow; the words "Waiting for the server… N s (…)" are gone. (What it waited for is still noted for the freeze note.) |
| Phone – keyboard (`App.html`, `PHONE`) | on a phone (a finger, no mouse) the app never puts the cursor in a box while the keyboard is closed – after a save, on opening a page / form … (46 places in the app, all at once: `HTMLElement.prototype.focus` on a phone). A tapped box opens the keyboard as always; moving on while typing (Enter / Next) still works; Search and Ask keep the cursor (pressed to type). A box the app pointed at is scrolled into view instead. Computer: as before. |
| Phone – saved box | Diesel Issue → One entry → Save on a phone: a green ✓ box "Diesel issue saved" (or "updated") with Issue ID, machinery, litres, reading, photos; it closes by itself after 3 s (a green line counts down), with × or a tap outside; the form under it is already empty. Computer: the line at the bottom as before. |
| Help (EN / MR / HI) | Diesel Issue page: the saved box and the keyboard on a phone. |

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `mobile86.js` (new): wake address answers ok / no data / no-store, other GET 405; PHONE seen as a phone; Save → the box with Issue ID, M86-TIP, 10 L, 1,010 km, form empty, NO cursor in a box; still there at 2.4 s, gone at 3.4 s; × closes at once; a tap outside closes; 3 fills saved; the app alone cannot put the cursor in a box, a tap can, moving on while typing works, Search keeps it; a slow answer (3.8 s, database delayed at the gateway): only the bar, no words; computer: the line at the bottom, no box, cursor back in Machinery; no script error | 18 passed, 0 failed |
| The SQL step on the rig with pg_cron 1.6 (pg_net: a stand-in that notes the call – the rig has no pg_net): run twice without error; 2 timetable entries; the job's command run → called `https://oneclicksolution-erp.vercel.app/api/rpc?warm=1` (30 s limit); the clean-up command runs; the rollback lines remove both | passed |
| unit 57 / 57 · photo85 31 / 0 · sweep 38 · entry71 20 · retry 10 · hardenpage 10 · access84 18 · search83 13 · idle 10 (changed on purpose, below) · saveonce 44 / 0 · secure68 48 / 0 | all 0 failed |

Test changed ON PURPOSE: `idle.js` checked that the words "Waiting for the server… N s" appear after 2.5 s – now it checks that
only the bar shows (his rule).

## Not verified / said plainly
* **On live**: that Vercel then never puts the server to sleep. The wake call every 3 minutes keeps one server warm; if many people
  work at once, Vercel may start an extra server that wakes the first time. Check after a day: Supabase → Integrations → Cron →
  `oneclick-keep-awake` → its runs succeed, and the app no longer waits after a pause.
* Vercel's Hobby (free) plan is meant for personal, non-commercial use; a business app should be on Vercel Pro – it also lets a
  timetable run more often than once a day from Vercel itself.
* Real Android / iPhone keyboards (tested in a phone-sized browser with touch).

## Going back
Vercel → Instant Rollback → update-85 (`78a2eb9`). The wake calls can stay (update-85 answers a GET with 405 – harmless) or be
removed: `select cron.unschedule('oneclick-keep-awake'); select cron.unschedule('oneclick-keep-awake-log');`

## To deploy (owner)
1. Supabase → SQL Editor → paste `sql/supabase_step6_keep_awake.sql` (also in the app: Read Me → SQL) → Run.
2. ```
   cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
   git status
   Expand-Archive -Path "$HOME\Downloads\rcl-update-86.zip" -DestinationPath . -Force
   git status
   git add .
   git commit -m "update-86: server kept awake, no waiting words, phone - keyboard only on tap, saved pop-up"
   git push
   ```
