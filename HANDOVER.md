# RCL Fleet ERP – handover for the next chat (state on 30-09-2026, after item-wise BOQ)

The app is LIVE with real data. Every change must keep existing data, bills and behaviour working.
Reply to the user in Marathi (he writes Marathi in English letters). Deliver only what he asks.

## Setup
- Google Apps Script web app (server file **Code.gs** = this pack's Code.gs; UI **App.html** inside **Index.html**), plus
  **SupabaseSync.gs**, **SupabaseData.gs**, **ReadMe.gs**.
- Main database: Supabase (https://mydhljgncdszrglqppsv.supabase.co). A Google Sheet is an automatic exact backup.
- Deploy: run new SQL first (Supabase → SQL Editor) → paste changed files → Save → Deploy → Manage deployments → ✏️ → New version.
- SQL files (all idempotent), run in order: step1, 1b, 1c, 1d, 1e, 1f, 1g, 1h, 1i, 1j, 1k, 1l, 1m, 1n, 1o, 1p, 1q, 1r, 1s (folder `sql/`).
  A new module = new SQL file + mapping in SupabaseSync.gs (SB tables) / SupabaseData.gs (SB_ID_HEADER_) + README_SQL_ in ReadMe.gs.
- Every page appears in Users & Access through MODULES in Code.gs (new module = new `perm_<name>` column in app_users).

## Modules (menu)
Dashboard · Master: Vendor Master, Asset Master, Vendor BOQ, Vehicle Compliance, **Log Book Format** · Diesel Inward / Transfer / Issue · Log Book (entry, list, print, Excel) · Edit Log Book · **Breakdown** · Tank Check · Machinery Billing, Saved Bills, Bill Summary, Machinery Payments, Vendor Ledger, Vendor Outstanding · Reports · Users & Access · Read Me · Activity log.

## Key rules already built
- Ownership: Own (Rachana Construction Limited) / Rental (default for others) / Hired / Other. No "Debit" ownership.
- Vendor BOQ line: rent type Monthly / Per Day / Per Hour (slabs) / Per KM / Per Trip / **No rent – diesel only**;
  Diesel: "Company diesel – only extra over standard debited" or "Debit – ALL diesel given is debited". Diesel debit is per machinery.
  Debit rate = higher of period average and last purchase rate. A machinery cannot be in two BOQs of one vendor for the same dates
  (new BOQ form leaves such machinery out).
- Asset Master "Works on" ticks: Day, Trip, KM, Hrs, KM + Hrs, Time (Format A machinery follow these ticks).
- **Log Book formats A–H** (Master → Log Book Format; per machinery, renamable, "View format" sample print):
  A standard; B KM+Hrs+Trip; C KM; D Hrs; E Particular/Challan (hour reading); F Time sheet; G Time sheet 1st hr / 2nd hrs (BOQ first slab, else 1 hr); H Trip register (challan, diesel qty, in/out time, trips).
  For B–H the format decides the entry ways (LB_FMT_MODES in App.html and LB_FMT_MODES_ in Code.gs) and the fields
  (LB_FMT_NEEDS: challan, particular = remark, no chainage for C, in/out time with trips for H, trips with readings for B).
  Entry grid, Edit Log Book, Diesel Issue ways, Excel and print all follow the machinery's format; mixed formats on one date work row by row.
- Day status in Log Book for every machinery: **Idle** (no work; paid or not is chosen in the bill), **Holiday** and **Breakdown** (not paid). Print shows them only in Work description.
- Log Book Excel export: every date of the filter for every machinery (missing dates as blank rows), drop-downs (Shift, Measured by, Status) via ExcelJS, falls back to plain Excel; import skips blank rows; Status column.
- Breakdown page = daily machinery status (date + Own/Rental…, Working/Breakdown + reason), submit / save changes / delete a day, saved-days list, period report (machinery-wise / owner-wise / owner → machinery), print & Excel. Separate from the Log Book "Breakdown" status.
- Asset list print (Asset Master): date / month / period; optional columns only when ticked; type-wise summary by ownership.
- Pending Log Book = active machinery with no entry that day (from 01-09-2026); Debit-basis / diesel-only machinery excluded.
- Prints ask Rachana Construction Limited or Sketchline Industries (logo follows the name).
- Every edit/delete asks for confirmation; everything is written to the Activity log.

## Also done after the first pack (App.html in this pack has it)
- Every print: tables are fitted to the paper (smaller letters step by step, then scaled; fixed tables that cut text switch to content widths).
- Every print window (not bills) has "Page: Portrait | Landscape"; the choice is remembered per kind of print on that device.

## Item-wise BOQ + Idle choice (built 30-09-2026, in this pack)
He answered: **no minimum hours**; **Idle paid or not is decided by him while billing**.
- SQL: `sql/supabase_step1s_boq_items.sql` (adds `log_book.item_work`). Run BEFORE pasting SupabaseSync.gs. Changed files: Code.gs, App.html, SupabaseSync.gs, ReadMe.gs.
- Vendor BOQ: new rent type **Item-wise** on a line. `line.items = [{ name, basis (Per Hour / Per Day / Monthly / Per KM / Per Trip), rate, slabs, slabOn, qty }]`
  kept inside the BOQ `Lines` JSON (no new table). `qty`: `rest` = takes what is left of the entry's total of that kind (one per kind),
  `typed` = quantity typed in the Log Book. Diesel rule stays per machinery. Old lines are untouched.
- Log Book: still ONE entry per machinery + date + shift (the key, diesel and tank depend on it – two entries a day were NOT built).
  Typed items are kept in "Item Work" as JSON `{ "Breaker": 3, "_day": "item" }`; the rest item is worked out when read
  (`itemQtyOf_`, `logItemsOut_` in Code.gs → rows of getLogBookList carry `itemQty`, `itemOver`, `itemUnknown`, `itemLeft`, `boqItems`).
  Item boxes: entry grid, edit window, Edit Log Book (`itemBoxHtml / itemBoxRead / itemBoxCalc` in App.html). Typed items may not be more than the entry's total.
  Several Per Day / Monthly items in one line: the entry picks one ("Day item"); one such item: every paid day.
- Excel: column "Item work" (`Breaker=3; Rock=1`, a picked Day item by its name alone) in export, template and import.
- Bill: each item on its own quantity and rate (slabs per item), item name on the bill lines and in the Log Book print (rate box and Work description).
  The same calculation is in three places and must stay the same: `itemDaySegs` + `mbMachine` (App.html), the Log Book print (App.html), `billMachineCalc_` (Code.gs).
- Idle: Machinery Billing list has an "Idle days" column per bill – Paid / Not paid (`bill.idlePaid`); shown as paid until chosen;
  Verify & Submit (client and server) refuses a bill with Idle days and no choice. Log Book print from a bill follows the choice; from the Log Book page Idle counts as paid.
- Verify: ✖ items typed above the entry total / item not in the BOQ; ⚠ work given to no item (only when the line has no Per Day / Monthly item).
- Tested in Node (server on an in-memory database + the page in jsdom): BOQ form, entry, edit, Edit Log Book, import, bills, verify, prints. Not yet tried by him on the live app.

## Moving the app out of Apps Script to Vercel (pack built 30-09-2026 – NOT yet deployed by him)
He finds the Apps Script app slow. Decision: same app, same Supabase, same Google Sheet backup; only the app leaves Apps Script.
Repo folder `rcl-fleet-erp` (he works from VS Code, git → GitHub, Vercel deploys on push):
- `app/` = the SAME files as Apps Script (App.html, Index.html, Code.gs, SupabaseSync.gs, SupabaseData.gs, ReadMe.gs). All future changes go here;
  they run UNCHANGED on Vercel. Never fork the logic into server/.
- `server/runtime.js` loads the .gs files into a fresh `vm` context per request (fresh globals, like Apps Script).
  `server/gas.js` = stand-ins: PropertiesService → `web.props`, CacheService → `web.cache` (sessions, USERS_LIST, counters; `SBG_*` table
  snapshots stay in server memory, valid only while `web_boot().stamp` is unchanged; `V_*` versions live in props), LockService → `web.locks`
  (re-entrant, 75 s TTL, fresh props on acquire), UrlFetchApp → `server/syncfetch.js` (worker thread + Atomics.wait = synchronous HTTP),
  Utilities (formatDate, computeDigest incl. byte arrays, newBlob, getUuid, sleep). `process.env.TZ = 'Asia/Kolkata'`.
- `server/page.js` + `build.js`: public/index.html = Index.html shell with the app inlined; a bridge script gives the page `google.script.run`
  → `POST /api/rpc { fn, args }` (`api/rpc.js`; fns: api, login, changePassword, logout, getAppHtml, getAppBuild).
- SQL `sql/supabase_step2_web.sql`: schema `web` (props, cache, locks – not in `public`, so the backup does not copy them) and functions
  `web_boot, web_props_set, web_cache_get, web_cache_set, web_flush, web_lock, web_unlock` (service_role only).
- Env vars on Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY; optional GAS_BACKUP_URL + GAS_BACKUP_KEY ("Backup now" → Apps Script doPost in
  `apps-script/VercelBridge.gs`; untested against Google). `vercel.json` region `bom1` – must be near the Supabase region.
- Apps Script side: `VercelBridge.gs` (`exportSettingsToWeb()` copies Script Properties to web.props; `webMirror_` sends backup status SB_INFO;
  `doPost`). Code.gs got `movedTo_()`: script property `APP_MOVED_TO` = new link closes the old app (doGet, login, api) – delete it to roll back.
  The Apps Script project stays for the backup triggers only.
- Tested here on real PostgreSQL 16 + PostgREST (all SQL files run in order) with two server processes: login, password change (hash checked
  independently), sessions across servers, 8 simultaneous saves (lock: unique numbers, stock right), item-wise entries, billing through the
  real page (jsdom) and the shell. NOT tested: real Vercel, real Supabase gateway, real Google (backup now), his existing password hashes.
- Steps for him are in README.md (Marathi): A setup, B check alone, C switch day, D roll back, E later changes, F backup-now.
- LIVE on Vercel since 01-10-2026 for his own checking: https://rclerp.vercel.app (GitHub: khandagalesuraj48-sys/rclerp, he pushes from VS Code;
  the PC's git is signed in as `milestoneconsultancy`, added as collaborator). Staff still use the Apps Script app; `APP_MOVED_TO` not set yet.
- Speed fixes after his first try (he said it hung / stuttered): (1) `Utilities.formatDate` stand-in made a new Intl formatter per call – it is
  called for every date cell, so list pages took 5 s; now plain arithmetic for India time. (2) `server/pool.js`: every request runs in its own
  helper thread (up to 6), so a slow call never blocks the every-second sync or other calls. (3) `makeFetch` in gas.js keeps the whole-table
  GETs of the tables listed by `web_stamp()` in memory while the stamp is unchanged; `web_lock` returns the stamp too, so saves also use the
  copy when nothing changed. Any speed work must keep this rule: never serve a table that is not in `web_stamp().tables`.
- "Backup now": Vercel env `GAS_BACKUP_URL` = old app's /exec link; the call is signed with sha256(SUPABASE_SECRET_KEY + '|rcl-backup')
  (VercelBridge.gs doPost checks it). Tested only against a local stand-in, not against Google.
- Local test rig used here (not in the repo): PostgreSQL 16 + PostgREST + a /rest/v1 proxy, `node dev.js` ×2, jsdom and headless Chromium
  (@sparticuz/chromium + puppeteer-core) for the page.
- Supabase region is ap-south-1 (Mumbai) = Vercel `bom1` (checked 01-10-2026). Speed update is pushed (commit "faster server").
- LOOK 2026-10 (asked 01-10-2026; one CSS block at the very end of the `<style>` in App.html, headed "LOOK 2026-10", plus 6 lines in `autoSide`):
  he chose Rachana red for the menu and "same page, but the form bigger and wider" for entry screens.
  * Menu: red gradient (#C0171F → #8C0F15), white lettering, active item = white tab with the module colour on its icon, amber counts.
  * Menu stayed open after a click inside it (focus stayed on the clicked heading) → `close()` now blurs a mouse-focused element.
  * Menu opening: children get a fixed width (272 / 74 px) so text does not re-flow per frame; shorter transition; top bar no backdrop blur.
  * Motion: `.rv` reveal and `section.enter` are short fades (no bounce, no stagger); menu items do not move / rotate on hover.
  * Entry panels (`.panel[data-perm]`, `#v_form`, `#b_form`) on ≥761 px: bigger fields (46 px, 15.5 px), `.grid` = auto-fit so fields use the
    full width, bigger buttons. Tabs (`.subtabs`, `.switch`) active = brand red.
  * Log Book entry (`.lg-wrap table.lgt`) on ≥761 px: each `tr.lrow` is a 24-column CSS grid of two lines with labels from
    `td:nth-of-type(n)::before` (nth-of-type, NOT nth-child: lgFill inserts a `<small class="lg-fmt">` between the cells). Before this the
    grid scrolled sideways at 1366–1536 px windows. If a column is ever added to lgRowHtml, update these nth-of-type rules.
  * Phones (≤760 px) keep the old table layout for the Log Book entry (only colours changed) – not asked yet.
  * Not measurable here: how smooth the menu animation is on his laptop (headless Chromium frame timing is unreliable).
- 01-10-2026: he REJECTED the red menu ("looks very bad"). Menu colours are now CSS variables at the top of the LOOK 2026-10 block
  (`--sb-1/2/3`, `--sb-ink`, `--sb-on-bg`, `--brand` …); default = deep navy. Options shown to him as pictures: navy, charcoal, light, teal – waiting for his pick.
- 01-10-2026: he decided NO Apps Script at all (never open it again). So:
  * Google Sheet backup now runs from Vercel: `server/google.js` (service-account JWT → Sheets API v4, no libraries), `server/backup.vm.js`
    (`webBackup_` – runs inside the app's vm, reuses sbCatalog_/sbHeader_/sbTabName_/sbAllRows_; a table whose row count or newest updated_at
    changed gets its whole tab rewritten with the grid resized to fit; all tabs once a day; state in web.props `BK_STATE`, status in `SB_INFO`;
    lock name "backup"), `api/backup.js` (no sign-in, returns only ok; the bridge in page.js calls it every 5 min while the app is open;
    Vercel cron nightly `?full=1`), `sbBackupNow_` = `webBackup_({manual:true})`.
  * Env on Vercel: `GOOGLE_SERVICE_ACCOUNT_JSON` (whole key file), `BACKUP_SHEET_ID` (id or link). He wants the backup to CONTINUE in the
    existing backup Sheet (id 14B_uvMm…Clro – never put it in the repo: the old script made it "anyone with the link can view").
    So the layout is kept identical: same tab names / headings, values via `sbCell_` with valueInputOption USER_ENTERED (as setValues did).
    The old script protected every tab for its owner and removes other editors → he must (once) stop the old triggers, share the Sheet with the
    service account as Editor and remove the tab protections; `webBackup_` checks `protectedRanges.requestingUserCanEdit` first and says which
    tabs are still protected, without writing anything. Google calls per run: 1 get + 1–2 batchUpdate + a few values:batchUpdate (quota-safe).
    No weekly dated copy (needs Drive; not built – Sheets has version history).
  * `apps-script/VercelBridge.gs`, GAS_BACKUP_URL and the doPost path are removed. `movedTo_()` in Code.gs is harmless leftover.
  * Tested only against a local stand-in for Google (token signature verified, grid limits enforced) – NOT against real Google.
  * Old Apps Script app: to be archived + triggers deleted by him once staff have the new link (README).
- 01-10-2026: backup to his EXISTING Sheet works on the real setup (he pressed Backup: full backup written, 16 tables; Log Book 203 rows,
  Diesel Issue 309, Master 57 – the real data is small). Service account: rcl-backup@rcl-erp-510303.iam.gserviceaccount.com.
  Old Apps Script triggers are deleted; archiving the old deployment + giving staff the new link was the last step given to him.
- Menu "hangs open" on Vercel (reproduced): after a click the old code closed the menu 350 ms later with a width transition; on Vercel the
  page data arrives within that time and drawing it blocks the main thread, so the menu stayed open / half-way until the drawing ended
  (on Apps Script the data came seconds later, so it never collided). `autoSide` is rewritten: the menu opens / closes AT ONCE (no width
  transition; only the lettering fades in), a click on a page shuts it in the same task, and it also shuts on mousemove over the page,
  mouse leaving the window and window blur; keyboard users (`:focus-visible` inside) keep it open. Do not bring back a width transition.
- Known limits: sync every 1 s = many Vercel invocations; ~4.5 MB answer limit (guarded with a message); whole main tables still read per request.

## Open after this
- Intermediate reading between two items on one day (e.g. Bucket 100–105, Breaker 105–108) is not recorded – only the hours per item. Ask if he needs it.
- Log Book "Breakdown" status is still not linked to the Breakdown page. Party-wise work rules page, full-debit party ledger note: later.
