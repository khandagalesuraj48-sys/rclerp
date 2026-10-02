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
- 01-10-2026 (later): even the instant hover menu was not good enough for him ("still hangs sometimes / sometimes does not open") and he asked
  for a different way. Now `deskSide` (replaces autoSide): on a computer the slim icon strip is always there; the full menu opens ONLY by a
  click (arrow button under the logo, the logo, or a group icon) and closes on choosing a page, a click outside, the button or Esc. No hover,
  no timers, no focus logic. Do not bring hover-opening back.
- He rejected the two-line "box per entry" Log Book layout: wants ONE line per machinery. `.lg-wrap tr.lrow` is now a 14-column CSS grid with
  explicit `grid-column` per `td:nth-of-type(n)` (diesel = 2×2 block with inline words Open / Issued / Used / Close; Standard over Average;
  headings once via `tr:first-child > td::after`; disabled "Measured by" ways hidden). `.lg-wrap` is a size container: under 1290 px of room
  chainage + work drop to a second line. Fits without sideways scroll at his 1536 px window (slim menu).
- Diesel Issue: he wants only the last issue of a machinery, not the history table → `.dhist table.dh-t` and its note are hidden (the head
  line with last fill / last reading stays; the "Last: …" line under the machinery was already there).
- Other: top bar fully opaque; buttons get a pressed state; Read Me page no longer scrolls sideways; `$schema` removed from vercel.json
  (VS Code warned "untrusted"); two worker threads are started at boot; resting the mouse on "Live" shows the last server time and the
  slowest recent call (bridge, `took()` in server/page.js) – ask him for these numbers if he says the app is slow.
- A sweep of all 35 pages in headless Chromium (local data) shows no JS errors, no failed calls, no sideways spill.
- 01-10-2026: he pasted a long English "complete audit" brief. Done on the local rig; report in `AUDIT.md` (read it before any security /
  integrity work). Fixed: public `/api/backup` (now session token for POST, `CRON_SECRET` bearer for the nightly GET), non-atomic saves
  (`web_write` – one transaction per save, `SbBook_.flush` falls back to per-table calls when the function is missing), double submission
  (`ONCE_FNS_` + `web_count`, 8 s window, released on failure), exact sign-in attempt counter, Backup button verifies tabs, headers.
  New SQL `sql/supabase_step3_safety.sql` (he must run it; the app works without it) and read-only `sql/check_security.sql`.
  Tests now live in the repo: `npm test` (offline, 7 tests) and `test/audit.js`, `reg.js`, `bkg.js` (need the local rig).
  Open, waiting for him: repo still PUBLIC, backup Sheet link-readable, add `CRON_SECRET` in Vercel, blank access = View (decision),
  weak password hash (decision), 1-second polling (cost), no restore tool.
- 01-10-2026: second English brief ("Phase 2 – complete UI/UX redesign + performance"). Done and written up in `UI_PERFORMANCE_AUDIT.md`:
  polling is now adaptive (`syncGap()` in App.html: 2 s working / 5 s untouched / 15 s after 5 min / 30 s hidden; first touch after a quiet
  spell syncs at once) – measured 19→11 calls per 20 s working, 29→6 per 30 s idle; the bridge merges identical in-flight QUESTIONS only
  (`isQuestion` in server/page.js – never saves); top-bar pills redrawn only on change; phone: three pages no longer spill sideways and
  the Log Book entry is a block per entry (≤760 px); one consistency block for tables / fields / focus rings.
  Tried and REMOVED: drawing long lists in pieces – no measurable gain (the cost is the browser's layout of a 500-row table, 18,000 boxes;
  script is only ~20 ms). The real cure is fewer rows at first – waiting for his decision. Not a ground-up redesign (two were rejected).
- 01-10-2026: third English brief ("Phase 3 – final readiness"). His decisions: long lists show the first 100 rows + "Show all";
  polling 2 s while active; Log Book blocks on phone / table on desktop; production only after checks and a verified backup.
  Built: `listsFirst100` in App.html – an `innerHTML` setter on eleven list tbodies (l_rows, d_rows, i_rows, t_rows, m_rows, a_rows, v_rows,
  sb_rows, py_rows, tc_rows, boq_rows) that draws 100 rows and keeps the rest for a `.more-bar` button; list code, totals, exports untouched.
  Note for him: the lists already held only the latest 500 (server limit) – "Show all" shows those, not beyond.
  Report: `PHASE3_READINESS_REPORT.md` (Go for preview, No-Go for production until backup looked at, step-2 + step-3 SQL and
  check_security run on live, CRON_SECRET set, preview looked at). Browser tests are in `test/browser/` (need puppeteer-core + Chromium).
  IMPORTANT STATE: GitHub / the live site were still at update-6 ("click menu…") when this was written – none of Phase 1–3 was live.
- 01-10-2026 15:34: Phase 1–3 (update-9) IS LIVE (GitHub main = "phase 1-3: audit fixes…"). Right after saving 11 diesel issues from the
  multiple-entries grid (toast "11 diesel issues saved (DI-000355 to DI-000365)") Chrome showed "Page Unresponsive" on the live site.
  NOT reproduced here (4 rows; 11 rows; 11 rows with 40 Log Book rows typed and Dashboard / Log Book loaded: longest freeze 0.6 s) and no
  endless loop found by reading (no MutationObserver, no DOM-dependent while loops, polling cannot spin). CAUSE UNKNOWN.
  Added a recorder in the bridge (`recorder()` in server/page.js): crumbs of server calls / clicks / long tasks + a 1 s heartbeat in
  localStorage `rcl_trace`; if a run ends without `pagehide`, the next start shows a box with the last lines – ask him for a photo of it.
  `npm test` now also checks that every script of the generated page parses (a typo in the bridge would stop the whole app).
  What happens after a save on the page (for the next investigation): `onDataChanged` → getLookups + setMaster, refreshStock, loadDiesel,
  loadInward / loadTransfers / loadLog if loaded, lgRefreshAll (one call per typed Log Book row), loadDash.
- 01-10-2026 (evening): the freeze did not come back; a user saw the recorder's box once (content not captured – ask for a photo next time).
- BILL PAPERS, step 1 of 2 (asked with a sample "Tax Invoice" PDF of Mr. Suresh Sarjerav Patil, RA-27, Sketchline):
  * Every bill now has three papers made from the SAME saved figures: Abstract (`billHtml`), Tax Invoice (`taxInvoiceHtml` – the party's
    invoice to the company in the fixed format; number = `companyInfo.invPrefix` + RA bill no), Debit Note – diesel (`debitNoteHtml`, only when
    B > 0). `billSheets(b, cls)` = the print pages; used on the billing page (under each Abstract) and in every "View / Print" of a saved bill.
  * Tax Invoice figures = the Abstract's: Total before tax A, less diesel B / other C (lines shown only when not zero), Basic Value D,
    SGST F, CGST E, Total Billing G, less TDS H (only when not zero), Net Cheque I, words of I. MY ASSUMPTION, told to him: deductions and TDS
    are shown on the invoice so that it ties to the Abstract – he must confirm.
  * Debit Note numbers: assigned in `submitBills_` (kept in `bills.data.dnNo`, no schema change), one run per company, prefix from
    Bill Settings (`dnPrefix`, default RCL/VTR/DN- and SLI/VTR/DN-), a bill saved again for the same vendor + period keeps its number.
    `billOut_` now returns `dnNo` and `dnAmt` in lists. Bills saved before this have no number (shown as "–").
  * "Saved Bills" page is now "RCL Drive" (module / permission name is still 'Saved Bills'): tabs Saved Bills | Saved Debit Notes.
  * Tests: unit test "bill papers" (words, figures, hostile text) and `d5.js` in the audit rig (11 checks: numbers per company, revision,
    three papers, Drive). NOT built yet = step 2: Log Book "Debit to" (vendor + rate typed by hand), a Debit Note page for those
    (lines Sr / particular / qty / rate / amount, GST, TDS, own number run per company), choosing which notes to deduct in a bill, ledger.
    His answers for step 2: rate typed by hand; separate numbering for RCL and Sketchline; a note is deducted once, by tick, when the
    party's bill is made; a party without a bill keeps the note as receivable in the ledger; nothing is stored as PDF.
- 01-10-2026 (night): update-11 (bill papers, RCL Drive) is live. He dropped the speed ideas (per-page live, browser cache, server result
  cache – all explained with their risks, all declined: "leave it as it is"). Then asked for three things:
  * Machinery Cost Sheet – BUILT: report `mcost` (`rptMachineCost_` in Code.gs, entry in `reportDefs()`), from `logDashboard_` (now also
    returns `recover` per machinery and takes `withDebit`). Net cost = Rent (bill calculation, Idle paid) + diesel issued × period diesel rate
    − diesel recovered in the bill; per hr / per km; a line under each machinery shows the working; rented machinery without a BOQ rate is
    flagged. Own machinery has no rent (salary / repairs / EMI are not in the app). Unit test with hand-worked figures.
  * RULE he gave: the party's Tax Invoice never carries TDS – the party bills value + GST; the company deducts TDS when paying (Abstract
    only). `taxInvoiceHtml`: "Less: TDS" removed, Net Cheque Amount and the words = G.
  * Sending reports by WhatsApp / e-mail from inside the app (auto to set numbers, or on "Send") – only IDEAS given, nothing built:
    e-mail needs a mail service key in Vercel; WhatsApp needs the WhatsApp Business Platform (own number, Meta business verification,
    approved templates, per-message charge ~₹0.115 utility in India per public rate cards, plus a provider fee) – waiting for his choice.
- 02-10-2026: he reported the live app hangs a lot (clicks on tabs not taken, scrolling stuck). CAUSE FOUND AND REPRODUCED
  (`test/browser/storm.js`): after EVERY save by ANY user, `onDataChanged` on every open page reloaded and redrew every page ever opened
  in that tab (lookups + vehicle-papers badge, stock, diesel, inward, transfer, Log Book list, one call per typed Log Book row, Dashboard).
  On Apps Script the answers trickled in over seconds; on Vercel they arrive together, and with several people entering it never stops.
  Measured (12 saves by another user in 30 s, the page just open): 93 calls, page blocked 5.0 s, longest freeze 793 ms
  → after the fix 28 calls, 1.4 s, 185 ms.
  THE FIX (App.html, `onDataChanged`, `whenCalm`, `openTabData`, `stockSoon`, `setMaster`, list setter):
  * only the page ON SCREEN is refreshed, at most once in 5 s, and never between mouse-down and mouse-up (`whenCalm`);
  * pages not on screen are marked `S.stale[tab]` and refreshed when opened (`openTabData`); the Dashboard loads itself on open;
  * form lists (getLookups) at once only when the Asset Master changed, else at most once in 15 s and without the papers badge;
  * balances only for the page on screen; a list that comes back identical is not redrawn (`lastHtml` in `listsFirst100`).
  `test/browser/stale.js` (10 checks) proves nothing stays old: hidden pages refresh on open, typed Log Book rows survive and get the
  other user's diesel, own saves show at once. DO NOT bring back background reloading of hidden pages.
  (This is the per-page "live" idea he had proposed and then dropped – done in the safe form: no browser copy of old data is shown.)
  The earlier "Page Unresponsive" after saving 11 diesel issues was very likely the same storm; not proven.
- 02-10-2026: update-13 (refresh only the page on screen) is live. He then said "build the Debit to function" (step 2 of the bill papers).
  BUILT (needs `sql/supabase_step1t_debit_notes.sql` – he must run it; without it the app works, "Debit to" and saving a note are refused
  with a message that names the SQL file):
  * Log Book entry: a "Debit" button in each row opens two fields – party (Vendor Master names, datalist `dl_dnparty` from getLookups.vendors)
    and rate typed by hand. Columns `log_book.debit_to`, `debit_rate` (H.DEBITTO / H.DEBITRATE; `logDebit_`, `debitReady_`). Also in the
    edit window. Shown in the list ("Debit to X @ rate"). NOT yet in: Edit Log Book grid, Excel import / export, Log Book print.
  * Debit Notes: table `debit_notes` (sheet 'Debit Notes', DN_COLS_). `debitPending_` (entries of a party + period not in a note; qty =
    hours / KM / trips / 1 day as the entry is measured), `saveDebitNote_` (lines from entries + lines by hand; GST % and TDS % typed;
    total = amount + GST − TDS; amounts worked out again on the server), `getDebitNotes_`, `cancelDebitNote_` (Admin). One entry in one note
    only; an entry in a note has its "Debit to" locked. Number = next of the company's run (`nextDnNo_`, shared with the diesel notes of
    the bills). Page: RCL Drive → Saved Debit Notes → "+ New Debit Note"; print = `debitNoteDocHtml`.
  * Money: `ledgerLines_` adds every note that is not cancelled as kind 'dn' (paid = total) → Vendor Ledger and Vendor Outstanding go down.
  * Step 2b BUILT (02-10-2026, he said "Continue"): debit notes are ticked in the party's bill. `billInit_` returns `pendingDn`; each
    built bill gets `dnOpen` (same party + same name) and `dns` (ticked); `mbTotals` adds J = sum of ticked notes and K = I − J (A–I and the
    tax untouched); the Abstract prints lines J and K; the Tax Invoice is not affected. `submitBills_` validates the notes on the server
    (found, not cancelled, same party and name, in one bill only – a bill saved again may keep the notes of the bill it replaces), takes
    the amounts from the saved notes, stores `dns`, `J`, `K` in `bills.data`, and sets the notes to Status 'Deducted' + Bill ID; notes of a
    replaced bill that are no longer ticked, and notes of a deleted bill (`deleteBill_`), go back to 'Open'. A deducted note cannot be
    cancelled. MONEY: the bill stays I in `bills.net` and in the ledger; the note is its own ledger line – so it is counted exactly once
    whether it is ticked in a bill or not (ticking only shows it on the Abstract and locks the note). Test: jsdom `d6.js` in the audit
    rig, 18 checks (K = 14,112 − 2,360 = 11,752; ledger 10,752).
  * Data layer: `SbSheet_.toRecord_` leaves out columns the database does not have (`dbCols` from the loaded rows) – so code can go live
    before its SQL. `web_stamp()` has a fixed table list without debit_notes → that table is simply read fresh each time.
  * Bridge fix found on the way: the "same question sent once" merge could hand a list asked BEFORE a save to an asker AFTER it; the key
    now carries a save counter (`saveNo` in server/page.js).
  * Tests: unit "Debit to and Debit Notes" (hand-worked 19,256), `test/dn.js` (6 checks without the SQL, 14 with it, two servers),
    `test/browser/dnui.js` (8 checks through the page).
- 02-10-2026: he sent a collage of a "clean UI" as a reference and asked for something more premium, pictures first. I made six mock-up
  pictures (HTML rendered to PNG, not in the repo). He answered: "keep ONLY the Dashboard as it is, change the UI of everything else".
  BUILT = block "LOOK 2026-10 B" at the end of the stylesheet in App.html (tokens `--c-*`, font Archivo for titles and figures, added to the
  Google Fonts link):
  * Menu pinned open with the names on a computer (238 px; `PINNED_MENU = true` switches `deskSide` off – the old click-open strip code
    is still there). Its button slims it to icons; the choice is remembered. Navy #0C1A2E, plain icons, active item blue with an amber bar.
  * Top bar white, one line (company name and the Supabase pill hide below 1450 px), title in Archivo.
  * Panels, buttons (amber = save / primary, blue for Build bills / New debit note / Get entries), fields, segmented tabs, tables, pills:
    all restyled with `section:not(#sec-dash) …` so the DASHBOARD CONTENT IS UNTOUCHED. Bill papers (.mb-paper) and the Log Book entry
    grid are excluded from the table rules.
  * Log Book entry with the pinned menu: one line per machinery from 1,150 px of room (tight columns, 1150–1290), comfortable columns
    above 1290, the two-line layout below 1150 (fits a 1366 px laptop). Measured: 1536 px screen → room 1206, one line; 1366 → two lines,
    no sideways scroll; 1920 → one line.
  * NOT done from the mock-ups (would change behaviour, not asked): the "Working / Idle" picker instead of the status buttons, the KPI
    band, the road-style tank bar, new page layouts. Only the look of what exists was changed.
  * Checked: 36 pages on a computer and at phone width without error or sideways spill; all flows' tests pass. Not checked: real fonts
    (Google Fonts cannot load in the test rig – fallback fonts were seen), real phones.
- 02-10-2026 (after the merge of the Claude Code branch "performance pass 2", which is now main): he asked five things.
  * Log Book LIST opens with yesterday + today only (`lfTwoDays`; quick button "Last 2 days"; "Clear filters" returns to it; an emptied
    From date still means "from the start").
  * "Not 15 seconds – other people's entries within 2 seconds": the check stays at 2 s while the tab is on screen for 5 minutes after the
    last touch (`SYNC_IDLE_MS = 2000`), lists on screen refresh within 2 s (`fresh`: 2000, Dashboard 5000), and the open entry rows are
    refreshed by ONE call for all rows – new API `getLogRowPrefills` (`getLogRowPrefills_`, loops `getLogRowPrefill_`), `lgFill(tr, pre)`,
    `lgRefreshAll` at most once in 2 s (falls back to row-by-row if the server does not know the call). Measured cost of the 2-second
    rhythm with another user saving every 2.5 s: 40 calls / 30 s from one open Diesel page (28–31 at the 5-second rhythm).
  * Readings fully visible: Start / Close columns widened (tight layout now 1150–1379 px of room, fields show 10 characters at 1536 and
    1366 px screens); slim padding on those inputs.
  * WHY THE BILL AND THE LOG BOOK PRINT DISAGREED (his PDFs: print 150 L / 1.7 L extra, Abstract 43.7 L extra): the bill counts every
    Diesel Issue of the period (192 L = 148.3 allowed + 43.7); the print added up only the "Issued" of its rows (150 L), so an issue on a
    date / shift with no Log Book entry (or on a Breakdown / Holiday row) was missing from the print. 192 − 150 = 42 L: one issue.
    FIX: the print now uses the bill's total and names the issues that are in no entry (`issAll`, `noEntry` in the print code). The bill's
    logic was not changed. Test: jsdom `d7.js` (bill 15 L extra = print 15 L extra, note "04-09-2026 25 L").
  * "Debit to": explained to him where it is kept (log_book.debit_to / debit_rate, shown in the list, in the backup Sheet) and where to see
    it (RCL Drive → Saved Debit Notes → New Debit Note → Get Log Book entries; then the note, the Vendor Ledger). A plain register of all
    "Debit to" entries does not exist yet – offered.
- 02-10-2026 (update-17 is live). He asked: (1) diesel given on a day without a Log Book entry must stay in the bill BUT the bill must
  say so, with what to do; (2) the whole app must explain every error – what is wrong and what to do, in Marathi, Hindi and English;
  the user corrects, the app never changes data by itself.
  * (1) `mbMachine` returns `noEntry` (issue dates with no WORKING Log Book row – none, or only Idle / Holiday / Breakdown);
    `billNoEntry(b)`; shown as a ⚠ block under the vendor in the bill list (with the help), on line B of the Abstract and on the diesel
    Debit Note. The bill's figures are unchanged. Saved in the bill's data, so old bills show it too once saved with this version.
  * (2) HELP FOR ERRORS = `FIX_RULES` in App.html (just above `toast`): about 37 rules, each a pattern on the app's own English message +
    [what is wrong, what to do] in en / mr / hi; `FIX_ANY` = general advice when nothing matches. Shown by `fixCard` (a card at the
    bottom right under every red message; closes with × or on the next successful save), inside alert boxes ("Nothing saved", "Not
    submitted", stock / machinery alerts – `askConfirm` with `alertOnly`), under the sign-in error, and next to bill warnings (`fixHtml`).
    Language buttons English / मराठी / हिंदी, remembered in localStorage `rcl_lang` (default mr). The Log Book "Nothing saved" message now
    carries the rows' own errors so the right rule is found. TO COVER A NEW MESSAGE: add a rule; the unit test "help for errors" checks
    that every rule has the three languages (Devanagari for mr / hi) and that at most 3 % of the server's messages get only the general
    advice. The app's own messages are still English – only the explanation is translated.
- Known limits: sync is one call every 2–30 s per open tab (see above); ~4.5 MB answer limit (guarded with a message); whole main tables still read per request.

## Open after this
- Intermediate reading between two items on one day (e.g. Bucket 100–105, Breaker 105–108) is not recorded – only the hours per item. Ask if he needs it.
- Log Book "Breakdown" status is still not linked to the Breakdown page. Party-wise work rules page, full-debit party ledger note: later.
- 02-10-2026 (performance pass 2, see PERFORMANCE_PASS2.md): menu on a computer is no longer fixed / sticky (normal page flow,
  CSS block "menu on a computer: part of the page" at the end of the stylesheet). Speed: Log Book entry refresh (`lgRefreshAll`,
  ≤ 1 per 15 s, 3 at a time) and calculation (`lgCalcSoon` / `lgCalcFlush`), Dashboard refresh (≤ 1 per 5 s, only on screen,
  `S.dashStale`), `setMaster` skips an unchanged list (`S.masterSig`), "Show all" 50 rows per frame, Excel tool loads in the
  background (`rclLoadXlsx`). Bug fixed: `openTabData` – Tank Check / report pages did not load after the first data change.
  Freeze recorder (server/page.js): page, last action, waited call, memory; `rclDiag()` in the console.
