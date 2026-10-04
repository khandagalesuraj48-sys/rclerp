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
- 02-10-2026 (update-18 is live). He confirmed what he wants: the app polices itself, explains everything on the spot in three
  languages, the user corrects; NO AI in the app; and "self-training" = the app knows what is in it. Agreed way: a build check that
  refuses anything undescribed. BUILT:
  * `PAGE_GUIDE` (25 pages) and `REPORT_GUIDE` (11 reports) in App.html: what the page is + what the app checks / how the figures come,
    en / mr / hi, and `saves` = the server actions that write from that page. "?" button in the top bar (`#pg_help`, `guideShow`).
  * THE GUARANTEE = unit test "the app knows itself": fails when a page of TABS or a report of reportDefs has no guide entry or lacks a
    language, when a server action with `edit: true` / `admin: true` is not in any page's `saves`, or when `saves` names an action that
    does not exist. With the earlier test "help for errors" this is what keeps new features from going live unexplained.
    WHEN ADDING A PAGE / REPORT / SAVE ACTION: add its guide entry, its FIX_RULES for new messages, and (if useful) a line in `liveMsg`.
  * On-the-spot checks (`liveMsg`, a `change` listener): future date, machinery not in Master, negative number, Close below Start in a
    Log Book row, "Debit to" party not in the Vendor Master / rate missing, Diesel Issue larger than the stock (balance box below 0).
    They show the help card at once and mark the field (`.live-bad`); the server still checks everything on Save.
  * The bill's "to check" notes are written out under the vendor with what to do (rules for: no BOQ, no hours / KM on some days, Idle
    not chosen, PAN / bank missing, nothing to bill). Confirm boxes for "… anyway" warnings also carry the help.
  * The red line: in Marathi / Hindi the rule's "what is wrong" comes first, then the app's own English line with names and numbers.
  * NOT done: translating the app's labels, buttons and the original messages themselves; live checks on every single field of every
    form (only the common ones above); explanations per column of each report (one explanation per report).
- 02-10-2026 (update-19 is live). METER NOT WORKING. His problem: when a vehicle's meter stops, no reading can be entered, the month's KM
  come out low and the bill debits "excess diesel" wrongly. He left the decisions to me ("most correct logic, do not disturb the flow").
  DECIDED AND BUILT (needs `sql/supabase_step1u_meter.sql` – one column `log_book.meter_note`; without it "No reading" / "New meter"
  are refused with a message naming the file, everything else works):
  * A way of measuring "No reading" (`METER_OFF_` / `METER_OFF`), offered for every machinery that has a KM / Hrs way – in the Log Book
    entry row and in Diesel Issue (a fill without a reading). Such an entry has NO readings; its work (WKM / WHR) is an ESTIMATE and a
    reason is compulsory (Meter Note = "No reading – reason"). The app proposes the machinery's own average of its last 7 entries with
    readings (`meterAvg_`, sent as `avgWork` by getLogRowPrefill_); the person may change it; more than 1.5 × the average gives an
    on-the-spot warning (not a block). Anyone with Log Book Edit can use it (site staff enter daily).
  * Money: nothing special-cased. The entry is a working day with work = the estimate, so the BOQ pays it (monthly / per day: the day;
    per KM / hour: the estimated quantity) and the diesel standard counts it → no false "excess diesel". The bill SAYS it: a "to check"
    line per machinery, a note on line A of the Abstract (`billEst`), help rule in 3 languages. List and print (format A) mark the entry.
  * Readings chain: untouched design – a meter follows its own last reading, so the first entry with a reading after the gap starts at the
    last reading before it (stuck meter resumes). NEW METER: tick "new meter" on its first entry (payload `meter: 'new'` + reason) → the
    typed Start is kept (Meter Note "New meter – reason"); `meterNew_` guards every place that links a Start to the previous Close
    (recalcChain_, linkAfterInsert_, saveLogBulk_, deleteLogRow_, importLogBook_).
  * recalcChain_ keeps the saved estimate of a "No reading" row; the edit window can correct the estimate and the reason
    (`updateLogRow_` with estKm / estHr / meterNote). The Edit Log Book grid cannot CREATE a no-reading day (message → use the Log Book page).
  * Known limits: one flag for both meters of a KM + Hrs machinery; formats B–H of the printed Log Book show such a row without the
    "EST." mark (format A has it); a new day does not default to "No reading" – it is chosen each day on purpose.
  * Tests: unit test "meter not working" (hand-worked: 490 km → 49 L allowed, 55 issued → 6 L × 100 = 600; re-link after an edit; delete),
    `test/browser/meter.js` (8 checks through the page and the database), checked without the SQL as well.
- 02-10-2026 (update-20 live): he asked what to do when the meter is not working on the machinery's FIRST day (no history, the estimate
  field stayed empty). `meterAvg_` now falls back to the average of OTHER machinery of the same type (entries with readings in the 30 days
  before, at least 3) and returns `src` ('own' | 'type' | ''); a visible line under the estimate (`.nrhint`) says where the figure comes
  from, or – with no history at all – what to type. The first entry WITH a reading of such a machinery types its Start (firstKm).
  Also that day: Chrome "Page Unresponsive" on the loading screen one minute after his push; not reproduced (reload here: 1–5 s). His
  console showed only an error of the BetterBugs extension (content.bundle.js, Sentry) – a page-recording extension is my main suspect for
  the freezes on his machine; asked him to try an Incognito window. NOT PROVEN.
- 02-10-2026: MY MISTAKE in the on-the-spot checks: `liveMsg` called every future date in an entry form wrong, so BOQ "Valid To"
  01-01-2027 was flagged. Fixed: the check applies only to real entry dates (`ENTRY_DATES` in liveMsg + the Log Book row date) – the
  same dates the server limits with `entryDate_`. `test/browser/dates.js` sets every date field of every page to a future date and lists
  which complain (only payment, inward date + bill date, transfer, diesel issue). Validity dates must never be checked for "after today".
- 02-10-2026: he asked that every typing box can be opened large (boxes are small, long text cannot be read): "a button next to the
  box, or double-click – your call". BUILT = `bigBox()` in App.html (one generic piece, no code per field): double-click in a box, F2, or
  the small round ⤢ that sits on the top-right corner of the box that has the keyboard → a large box (`#bigbox`) with the field's name,
  the text, a character count, and Save (Ctrl + Enter) / Cancel (Esc) / Clear. Save writes the value back and fires `input` + `change`
  on the small box, so all page logic runs as if typed there. A pick-list box keeps its list, a number box stays a number box; dates,
  times, drop-downs, tick boxes, passwords, the sign-in screen and locked boxes are left out. While it is open the keyboard belongs to it
  (focus is pulled back, Esc does not close a dialog underneath). A box whose text is cut shows the whole text on hover (title).
  Names of grid boxes come from `GRID_NAMES` (data-f → name) – add a line there for a new grid field. Test: `test/browser/big.js` (18).
- 02-10-2026: he reported: "the tab is left open 5–10 minutes without a touch → the app looks frozen → when I press the tab it loads a bit
  and then works; I want it smooth always". NOT REPRODUCED here (a page left alone answers at once in the rig). Two things can produce
  exactly this and neither is in the app's own code: (a) Chrome's Memory Saver puts an unused tab to sleep and LOADS IT AGAIN when the tab
  is clicked; (b) the first call after a pause waits for a server that has gone cold / a connection that was dropped. Built for both:
  * `#rcl_wait` (bridge, server/page.js `waitBar`): a thin moving bar at the top when a call (not the 2-second check) takes longer than
    0.5 s, and "Waiting for the server… N s" after 2.5 s – a slow answer no longer looks like a frozen app; the page stays usable.
  * A tab that was discarded (`document.wasDiscarded`) opens the page the person was on (`rcl_last`, written by showTab) instead of the
    Dashboard, and once a day shows a blue information card (FIX rule "put this tab to sleep", 3 languages) with the Chrome setting:
    Settings → Performance → "Always keep these sites active" → rclerp.vercel.app. `fixCard(text, 'info')` = blue card that a success
    toast does not close.
  * The tab holds a shared Web Lock (`rcl-fleet-erp-open`) – Chrome does not FREEZE a tab that holds a lock (it may still discard it);
    the `resume` event asks the server at once.
  ASKED HIM to add the site to Chrome's "always keep active" list and to tell me what the bar shows (seconds) the next time it happens.
  If the seconds are high after pauses, the cause is the server side (Vercel plan / cold start) and needs a keep-warm or a paid plan.
- 02-10-2026: "every form must have a Clear". Most entry forms already had one. `clearEverywhere()` in App.html adds the missing ones in
  one place (button inserted after the form's Save): Vendor Master (`v_clear` → a blank new vendor), Vendor BOQ (`boq_clear`), New Debit
  Note (`dn_clear`), Edit Log Book (`lx_clear`), Machinery Billing (`mb_clear` – unticks vendors, drops the bills built on the page),
  Breakdown sheet (`bk_clear` – back to the saved day), and "Clear filters" on Bill Summary, Vendor Ledger, Vendor Outstanding and the
  breakdown list. Meaning everywhere: an empty NEW form (leaves edit mode), asks first when typed data would be lost, never touches saved
  data. NOT given a Clear on purpose: small windows that edit one saved record (they have Cancel), "Save company details" and Log Book
  Format (settings). `test/browser/clear.js` walks every page and fails if a Save / Submit / Build / Generate button has no Clear beside it.
- 02-10-2026: ITEM-WISE WORK IS PICKED. He has a rental excavator used with Bucket and Breaker (BOQ "Item-wise", each item its own rate)
  and asked that the Log Book entry makes him SELECT the work, and that the bill follows. The item-wise chain already existed (BOQ items →
  item quantities in the entry → `itemDaySegs` in the bill); what changed is the entry: `itemBoxHtml` now draws, for a kind (hours / KM /
  trips) with two or more items, a button per item + "Split" (`.itm-pick`, `.itm-chip`); `itemBoxCalc` applies the pick (one item gets
  the whole entry and follows the reading; Split shows the quantity boxes, the "rest" item takes what is left). In a NEW entry nothing is
  picked and the row is red until it is ("Pick the work of this entry: …", help rule in 3 languages) – before, an untouched entry went
  silently to the "rest" item (Bucket). Saved entries, the edit window and the Edit Log Book grid open with what was saved (no forced
  pick there). The pick lives on the box (`data-pickhr` …). WHAT IS SAVED AND BILLED IS UNCHANGED ({ item: qty }; server untouched).
  Test `test/browser/item2.js` (13, with the database): Breaker 8 hr, Bucket 8 hr, split 5 + 3 → bill Bucket 13 × 1,200 = 15,600 and
  Breaker 11 × 1,500 = 16,500, A = 32,100.
- 02-10-2026: VENDOR BOQ – which machinery, and one rule for many. He asked: a party has many assets → choose which vehicles a BOQ is
  for; and a BOQ that is made should be applied to others on the same criteria instead of making a new one. BUILT (page only, server and
  data model unchanged – still one line per machinery):
  * `#b_pick` / `bPickDraw()`: every machinery of the vendor with a tick; tick = a line, untick = the line goes; "Tick all" / "None";
    machinery already in another BOQ for the dates is locked and says which. A NEW BOQ (and a change of vendor) now starts with NOTHING
    ticked (it used to add every free machinery).
  * "same terms → other machinery" on each line (`bSameTerms`): a box with the other free machinery of the vendor; the ticked ones get a
    line with the same rent type, rate, slabs / items and diesel (an existing line is replaced). Works in Edit of a saved BOQ too – that
    is how a made BOQ takes more machinery. `bReadLine(tr)` = one line of the form as data (Save uses it too).
  * Test `test/browser/boq.js` (8, with the database): tick 1 → terms → same terms to 2 more → saved with 3; a second BOQ shows them
    locked; Edit → same terms to the 4th → saved with 4.
- 02-10-2026: THE START READING CAN BE TYPED HIGHER. His case: machinery on diesel-debit basis take diesel, work a while, then work
  elsewhere, so the meter has moved on when they come back. Rule he gave: Start comes from the last Close automatically, the person may
  change it, but never below the last Close of the same machinery. BUILT (no SQL):
  * Server, one rule everywhere – Start >= the Close before it: `startFrom_` (entry page; `lenientStart` for imports = a lower Start in a
    file is ignored as before, a higher one is kept), `updateLogRow_` (now also REFUSES a Start below the Close before it – it did not
    check this), `saveLogBulk_` (grid: "must be equal" became "not less"), `recalcChain_` / `linkAfterInsert_` / import re-link (only LIFT
    a Start that is below the Close before it; never lower one, never touch a "New meter" row).
  * "Linked" = a Start equal to the Close before it. When that Close is corrected, a linked Start follows; a Start typed higher stays,
    unless the Close passes it (then it is lifted to the Close). On delete, a next Start that was linked to the deleted entry takes that
    entry's own Start (so a gap typed before the deleted entry is not absorbed).
  * The distance between the last Close and a higher Start is in no entry: not paid, not counted for the diesel standard.
  * Page: the Start box of an entry row is open (was read-only); untouched it keeps following the last Close; typed lower → row red + help
    card; typed higher → blue note "N km ran elsewhere – not counted". The grid shows the same note instead of "Start should be …".
  * Tests: unit "Start reading …" (hand-worked chain: gap, correction that passes the gap, linked follow, edit window, delete),
    `test/browser/start.js` (8, with the database).
- 02-10-2026 (16:02, live): his screenshot – Log Book Format page BLANK and the bar "Waiting for the server… 22 s". Two separate faults,
  neither reproduced in the rig; both now guarded:
  * A CALL THAT WAITS TENS OF SECONDS. Most likely cause (not proven on the live site): a dead database connection. `server/syncfetch.js`
    keeps connections open between calls; Vercel freezes the process between requests, and `server/pool.js` gives a request to the FIRST
    free thread, so threads 2–6 are used only when requests overlap and their helper can sit unused for minutes; the other side closes
    the connection, the frozen process never notices, the next call on it waits up to the 55-second limit. Guards in syncfetch.js:
    (1) a helper unused for 5 s is replaced (fresh connections), (2) each call has its own limit (reads 15 s, writes 30 s),
    (3) a failed / timed-out READ is asked once more; a WRITE is never repeated. `test/net.test.js` plays a dead connection (now part of
    `npm test`). This also fits his earlier "after 5–10 minutes it freezes, then works".
  * A PAGE THAT STAYS INVISIBLE. Panels wait at opacity 0 (`.rv`) until an IntersectionObserver reports them (`armReveal`); if the report
    never comes the page is blank although it is there (his scrollbar showed a tall page). Now every panel of the page is shown after
    0.6 s at the latest (timer per section). `test/browser/blank.js`: with an observer that never reports, 56 panels on 36 pages visible.
  * The waiting bar now names the call after 6 s ("… 22 s (getLookups)") – ASK HIM FOR THAT NAME if it happens again.
- 02-10-2026: RENAMING A VENDOR. The name of a saved vendor was read-only ("it links the vendor to its assets"). He wants to change it and
  keep the assets with the vendor. BUILT (no SQL, no new API): the name box is open; `saveVendor` takes `oldName`; when it differs,
  `renameVendor_` moves the name everywhere in the same save (one web_write transaction): Asset Master owner, BOQ, bills, payments,
  debit notes (their Vendor Name column), Log Book owner and "Debit to", Diesel Issue owner, and the vendor's own row (its key is the
  name: old row deleted, new one added with the same details). NOT changed: the saved papers (data JSON) of submitted bills / notes –
  they keep the name they were issued with. REFUSED: a new name that another vendor or owner already has (that would join two parties).
  The page asks before renaming and says what follows; the Activity Log gets "Vendor renamed: A → B (moved with it: …)".
  Tests: unit "renaming a vendor" and `test/browser/rename.js` (11, with the database, renames back at the end).
- 02-10-2026: THE LOG BOOK EXCEL OF A MACHINERY. He typed a vehicle number, exported, and got a general sheet (the template even used an
  example Bolero). Wanted: the Excel of exactly that machinery, for the period chosen, with only the columns / tab that machinery needs,
  and the same file must go back through Import at once. BUILT (page only):
  * `lbPicked()` = the machinery of the list's filter, else the one typed in the entry form (`lg_top_no`). `lbExport` reads the filter
    from the screen at that moment (it used the filter of the list loaded last), and refuses a number that is not in the Master.
  * `lbHeadFor(machinery, rows)` = the columns of LB_HEAD that those machinery use: KM / hour readings by their ways of working, time,
    trips, challan by way or Log Book format (`LB_FMT_NEEDS`), "Item work" by an item-wise BOQ, chainage unless the format has none.
    Each machinery tab has its own columns; the date-wise sheet has the union of its machinery. Full rows are built as before (`lbLine`,
    `lbSum`) and cut to those columns, so figures cannot differ.
  * With a machinery picked, the two Template buttons give that machinery's own sheet (its dates of the period, empty dates to fill).
  * Import was already heading-based (`readExcelRows` + `LB_COLS`, all tabs, missing columns = untouched), so the cut file imports as is.
  * Test `test/browser/xls.js` (11): KM machinery, hour machinery with items, date-wise, machinery from the entry form, template, unknown
    number, and the round trip – exported file → one empty date filled → the page's own Import → "1 added, 7 skipped" in the database.
- 02-10-2026 (17:44, his screenshots of the exported sheet of MH-43-4090, a JCB with Bucket / Breaker): three remarks – no diesel in the
  sheet (the app takes it by itself), look at the "Measured by" drop-down, and look at the last column ("Fill Measured by with one of:
  Hrs / Idle / … | Item work: Breaker=hr (Bucket takes the rest)" repeated on every row). REBUILT the machinery sheet:
  * `lbColsFor(machinery, rows)` = column descriptors { h, w, v, list, f, sum }; `lbSheet(...)` builds the sheet from them. (This replaces
    the "cut the 28-column row" approach of the morning; `lbLine` / `lbSum` / `lbLists` / `LB_HEAD` are no longer used by the export.)
  * GONE: the four diesel columns, "Status" (Idle / Holiday / Breakdown are in the "Measured by" drop-down), the hint column, the free-text
    "Item work" on a single machinery's sheet. Summary tab: no diesel, + "Empty dates".
  * "Measured by" comes filled on the empty dates of a machinery with one way of working; the import no longer treats the way alone as an
    entry (`filled`), so untouched dates are skipped.
  * Total KM / Hrs are formulas (ExcelJS `{ formula, result }`; the plain-Excel fallback converts them).
  * Item-wise machinery: "Work type" drop-down (item names + Split) and a column per typed item ("Breaker (hr)"). Import: LB_COLS knows
    "Work type"; `readExcelRows` also returns `_has` (which known columns exist) and `_more` (other columns by heading); `lbItemsOf` makes
    `{ _all: 'Breaker' }` or the split quantities; a working row of such a sheet without a Work type is a problem ("Work type").
    SERVER: `logItemWork_` understands `_all` (the picked item takes the entry's total; needs totals – the import's compare step now
    passes them for such rows).
  * Tests: `test/browser/xls.js` (14, with the database: columns, drop-downs, formula, import of a KM day, Breaker / Split / Bucket days,
    refusal without Work type) and `xls2.js` (reads back the real ExcelJS file: formulas, drop-downs, yellow empty Work type).
- 02-10-2026: EXCESS DIESEL – THE LAST FILL IS PARTLY STILL IN THE TANK. His problem: diesel filled on the last day is in the tank at
  month end but was debited as excess. I proposed a carry-forward to the next bill; HE DECIDED OTHERWISE, in his words: take the last
  fill and its reading, the run from that reading to the period's last Close, the diesel that run needs by the standard; what is left of
  the fill is "in the tank" and must not be debited – FOR THAT MONTH ONLY, the balance is NOT given to the next month as an opening; it
  is an assumption so that the debit does not apply. He confirmed four details: last fill = the last company-diesel issue of the period
  (any date); a fill without a reading → the work of the Log Book days AFTER the fill date; no entry on / after the fill → the whole fill
  is in the tank; hour machinery the same with hours and L/hr.
  * `tankLeft_` (Code.gs) and its twin `tankLeft` (App.html) – same code; `billMachineCalc_`, the page's `mbMachine` and the Log Book
    print all use it: excess = raw excess − min(left, raw). `left` is also capped by Asset Master → Tank Capacity when set. A Close below
    the fill reading (new meter) falls back to the days after the fill.
  * `logPrintExtra_` issues now carry `lastQty / lastKm / lastHr` (the last fill of a day by itself). The dashboard rows given to
    `billMachineCalc_` (cost sheet) now carry `ckm / chr`.
  * Shown: Abstract line B and the diesel Debit Note ("last fill 30 L on … at 1,234 km; run after it 46 km = 10 L by standard; 20 L taken
    as still in the tank – not debited"), the Log Book print, and a "to check" line when Tank Capacity is not set. Help rule in 3 languages.
  * CONSEQUENCE I TOLD HIM: the diesel of the last fill is judged only for the run after it, so a machinery with ONE fill in the period
    never shows excess, and the left-over is never judged in any month. Tank Capacity in Asset Master is the only limit.
  * Tests: unit "the last fill …" (his figures: 29.13 L over, 20 L left, 9.13 L = ₹913; page = server; tank cap; no reading; no entry),
    the cost-sheet and meter tests re-worked by hand, `test/browser/tank.js` (7, with the database, incl. Verify & Submit).
- 02-10-2026 (evening): after my review of the whole app he chose six things. (Vendor rename: "old stays old" – saved papers keep the old
  name; nothing to build.) BUILT:
  * MONTH CLOSE. Property `BOOKS_CLOSED_UPTO` (yyyy-mm-dd, '' = nothing closed; kept in web.props). `booksClosed_()`, `booksOpen_(dk, what)`,
    `entryOpen_` (= entryDate_ + the lock), `saveBooksLock_` (API `saveBooksLock`, admin, Activity Log "Month close"). Guarded: Diesel
    Issue (add / bulk / import / change – old AND new date – / delete), Inward (entry date only, not the pump bill date; change, delete),
    Transfer, Log Book (entry, old paths, grid incl. deleted rows, import, edit window, delete), Tank Check, Breakdown report. NOT
    closed: bills, debit notes, payments, vehicle papers. Page: `setClosed` → pill "Closed up to …" for everyone, Admin panel "Month
    close" on the Billing page (`#lk_panel`), on-the-spot check on entry dates, help rule in 3 languages. `getInit` / `getLookups` carry
    `closedUpto`.
  * FINAL BILL. A machinery that is Inactive with "Inactive From" on or before the day after the bill's period has left the site: its bill
    gives no "still in the tank" allowance (`final` in billMachineCalc_ / mbMachine / the Log Book print), says so on line B and in
    "to check" (deduct every open debit note). Automatic – nothing to tick.
  * "DEBIT TO" in the Log Book print (every format – `lbMarks`, which also puts the meter note into formats B–H) and in the Excel sheet
    ("Debit to", "Debit rate" when the sheet has any; they come back through the import for new dates).
  * DAILY REPORT: Dashboard → "Daily report" (`dailyReport`): the Dashboard's day (From = To) or today; five parts – diesel stock per
    location, received, issued, Log Book, to look at (diesel without entry, active machinery without entry, breakdowns). Print / PDF.
  * THE APP CHECKS ITS DATABASE (Admin only): `dbHealth_` (API `dbHealth`, admin) – columns of every step via `backup_catalog`, functions
    of step 2 / 3 via the API's own list, security findings via `web_health()` = NEW `sql/supabase_step4_health.sql`. Page: pill
    "Database ✓" / "Database: N to do" (`#db_pill`), once a day per Admin (localStorage `rcl_dbcheck`), box with the file to run,
    "Check again now". Until step 4 is run the check says so (one item "to do").
  * Tests: unit "month close …" and the final bill inside the tank test; `test/browser/batch.js` (14, with the database).
- 03-10-2026: THE APP BECOMES A PRODUCT OF "ONE CLICK SOLUTION". He: One Click Solution is the platform; Rachana is its first customer
  (VTR NH 848, monthly fee); Rachana's other sites and other companies will get the same app with no data of another. AGREED MODEL
  (explained to him, he went ahead): one COPY per customer site – same repository, own Vercel project, own Supabase database, own users.
  So a user of one site cannot open another (the other copy does not know the user) and no customer's data is ever in another copy.
  NEW_SITE_SETUP.md = the steps for a new copy. BUILT in this copy (Rachana stays exactly as it was – the defaults are its values):
  * `BRAND_` (One Click Solution / Fleet ERP) and ONE setting `ORG_SETTINGS` (`orgSettings_`, `orgPublic_`, `saveOrgSettings_` – API
    `saveOrgSettings`, admin, Activity Log): customer, site, logo link, the names bills are made in (`billCompanies_()` replaces the
    constant BILL_COMPANIES_; a name carried by saved bills / notes cannot be removed), opening on / off, film link.
  * `orgInfo` – the only call besides login that works without a sign-in (api/rpc.js ALLOWED, runtime.js): brand, customer, site, logo.
  * Page: `applyOrg` fills what was written in the code (company in the top bar, SITE_NAME on reports / Excel, PRINT_NAMES, logos, the
    bill-name drop-downs, the browser title); panel "Company & site" on the Users page; note "All users of this page belong to …".
  * Sign-in screen: One Click Solution brand on top, the customer's logo and site under it. THE OPENING (`#oc_intro`, `ocIntro`): a
    4-second film built into the page (letterbox bars, mark, word, light sweep), once per browser session, skippable, off by the tick
    or for reduced motion; a film link (.mp4) plays instead when set. While it fades it lets presses through.
  * `memoGet_` / `memoDrop_`: per-request memory that tolerates TABLE_MEMO_ being null (outside api()).
  * NOT DONE: licence / monthly fee control, a One Click super-admin, a central sign-in that sends a user to his site, the print footer
    and a few help texts that still say Rachana / Sketchline, diesel locations still in the code (APP.LOCATIONS). Repo is still PUBLIC.
  * Test: `test/browser/brand.js` (13, with the database).
- 03-10-2026: VENDOR FORM – GST NUMBER AND IFSC FILL IN WHAT THEY CAN. He asked: type the GST number → the vendor's data comes; type
  the IFSC → bank and branch come. Checked on the web first (03-10-2026):
  * IFSC: Razorpay's public IFSC list `https://ifsc.razorpay.com/<IFSC>` – free, no key, CORS, 404 for an unknown code, fields BANK /
    BRANCH / CITY / STATE. BUILT in the page (`vIfscAuto`): bank and branch filled, note under the box; 404 and "no connection" said;
    only the IFSC code is sent; one request per code.
  * GST: the legal name and address of a GSTIN are NOT available free – every service found needs an account and a key (paid, small free
    trial). NOT connected; TOLD HIM. BUILT without any service (`gstRead`, `vGstAuto`): the 15th character is a check letter (rule verified
    on 7 real numbers) → a mistyped number is caught; PAN (characters 3–12) filled in; State (first two digits) and kind of party (4th
    letter of the PAN) shown; a PAN typed by hand that differs is pointed out. The old half-fill of the PAN at 12 characters is removed.
  * If he takes a GST look-up service: add a server function (key in a Vercel environment variable, never in the page) and call it from
    `vGstAuto` to fill name and address.
  * ALSO FIXED: the top bar had become too full (pills "Closed up to", "Database") and covered the page title on a 1366–1536 px screen.
    Rules at the END of the style sheet: one line; the search box gives way to its icon first, then company / date, then the pills'
    texts; below 1300 px the right group may go to a second line. `test/browser/topbar.js` measures all 36 pages at 1536 / 1366 / 1280.
  * Tests: `test/browser/vauto.js` (12; the bank list is played by the test because the rig cannot reach it).
- 03-10-2026: (1) A SAVE THAT DOES NOT GET THROUGH IS SENT AGAIN BY ITSELF; (2) SETTINGS – every user's own app. He: "do not show me
  a box that it was not saved – the system must retry by itself; what the user saved must be saved", "a user can put his own photo",
  "settings are user-wise, everybody customises his own app", no OTP.
  * RE-SENDING (bridge in server/page.js): every save (`api`, not a question) gets a number `rid`; on a network failure, a non-JSON
    answer (504 …) or a "not now" answer (TRANSIENT: lock busy, database slow, RETRY_LATER) the SAME body is sent again – 1.2 s, ×1.6,
    at most 10 s – for as long as the page is open. Line `#rcl_retry` ("kept, being sent again", 3 languages by `rcl_lang`), then
    "Saved ✔". `beforeunload` asks while a save is waiting. Questions: 3 tries. login / changePassword / sync: not re-sent.
  * SAVED ONCE (server/runtime.js `run`): for a save with a rid – first copy claims the number (`web_count OPC_<rid>`, exact with the
    step-3 SQL; a plain cache look without it), notes its start (`OPT_`), runs, keeps its answer for an hour (`OPR_`). A later copy
    returns the kept answer, or waits up to ~24 s for it, or – when the first copy cannot be alive any more (75 s) and left nothing –
    runs. A REFUSAL is kept too (`__refused`); a "not now" error frees the number. api/rpc.js passes `rid` in meta.
    Residual risk: a first copy that dies after the data was written but before its answer was kept (milliseconds) → a later copy
    would save again (Log Book rows cannot double – same key; a diesel issue could).
  * NOT BUILT: sending again after the page was closed (an outbox kept in the browser). Entries the server refuses are still shown.
  * SETTINGS. Server: `prefsClean_` (only known keys / values), `prefsRead_` / `prefsWrite_` (one row per user in `app_settings`,
    id `USER_PREFS|<email>`, by REST – no SQL needed; script properties when not on Supabase), API `getMyPrefs`, `saveMyPrefs` (every
    signed-in user), `saveSiteRules` (admin; property SITE_RULES = { backDays, announce }), `siteRules_()` in getInit / getLookups.
    `booksOpen_` now also enforces "days back" for users who are not Admin (`ACTOR_ADMIN_`, set in apiRun_).
  * Page: menu group "My account → Settings" (tab `settings`, section `sec-settings`, guide in 3 languages); photo in the top bar
    (`#u_ava`, opens Settings; hidden on a phone). `applyPrefs` → html[data-theme|text|density|motion], help language, favourites
    (`#grp_fav`), usual shift / diesel location; `prefSet` applies at once, keeps a copy per e-mail on the device (`oc_prefs_<email>`)
    and saves 0.45 s later; `prefsBoot` after getInit (first page, usual Log Book entry type). Photo: cut square, 128 px JPEG.
  * DARK THEME = the whole page turned (`filter: invert(1) hue-rotate(180deg)` on html) with pictures, the menu and the opening film
    turned back; never on paper (`@media print`). Not a second colour scheme – some coloured drawings look darker.
  * Top bar: with the photo it was full again – the short pills are never cut; a second line only below 1340 px.
  * NOT BUILT from the list he saw: rows per page, choice of Dashboard cards, keeping a half-typed entry, required fields,
    defaults for new users, sign out of all devices. "Menu open / closed" dropped (on a computer the menu is slim by itself).
  * Tests: unit "settings …" (21 unit tests now), `test/browser/retry.js` (10), `settings.js` (10), `set2.js` (4, photo file and Enter).
- 03-10-2026 (his screenshot: Asset Master → Edit "Pradeep Engineers", Ownership list = Own / Rental / Hired / Other): "bring the Debit
  option here, I will set the ones I want in debit – those I gave diesel on debit basis are not visible any more, the debit ones show
  in Rental." CAUSE: an earlier change had removed Debit as an ownership (`normOwnership_` read "Debit" as Rental, the form's list had
  no Debit – "diesel debit is decided in the BOQ"), so reports that group by the machinery's CURRENT ownership (`issueList_`,
  `rptOwner_` …) put those parties under Rental. RESTORED: `normOwnership_` keeps Debit; the form offers Debit (with a line saying what
  it means); `validateMaster_` forces Diesel Supply = Debit Basis for ownership Debit (the hidden supply box used to send "Company");
  taken out of Debit → Company. Rows that still say "Debit" in the database read as Debit by themselves; rows re-saved meanwhile say
  Rental – he sets them. Asset report: Debit in its ownership filter and summary. Daily report: debit parties are not "without an
  entry" (the filter compared ownership with "Debit Basis" – wrong value, fixed). A Rental machinery whose BOQ says diesel on debit is
  unchanged. Tests: unit "ownership Debit …", `test/browser/debit.js` (5).
- 03-10-2026: TRANSIT MIXER AVERAGE – TWO ENGINES, ONE TANK. His September "Monthly Diesel & Average" showed "–" for six TMs and
  0.11 km/L + 42.07 L/hr for MH-04-KU-3332. EXPLAINED (no code fault): the TMs had no Log Book readings in September (one had a single
  day against a month of diesel); with readings (his October example, MH-25-AJ-2169: 60 L, 102.4 km, 1.8 hr) the figure came.
  He then SET THE RULE for transit mixers and every later two-engine / one-tank machinery (unit "KM + Hrs"): the hour engine is taken
  at its standard (diesel = Hrs × L/hr), the rest of the diesel is the vehicle engine's (km/L = KM ÷ the rest). Before, the diesel
  was shared in the ratio of the two standard needs. CHANGED in the ONE function `dualAvg_` (Code.gs) – every report and the Log Book
  use it; text now "1.88 km/L + 3 L/hr (std)". Hours alone need ≥ the diesel given → no average, "hours need X L, Y L given – check
  readings". No hours / no hour standard → km ÷ diesel; only hours → diesel ÷ hours. UNCHANGED: High / Low consumption and a bill's
  excess diesel (they compare the diesel with the total need). Tests: unit "two engines, one tank …" (his figures: 5.4 L, 54.6 L,
  1.88 km/L), `test/browser/tm.js` (4, the real reports with the database).
- 03-10-2026 (evening): he asked for five things at once – faults known by themselves (Admin AND user, live), speed for a growing
  database, entries without a network (and what when two people do the same work, one online, one not), diesel theft shown in special
  reports, a QR code for every machinery. BUILT NOW: three. NOT BUILT: two (told him why; they need his decision / a design).
  * FAULTS. Server: `faultKind_` (an error whose name is not "Error" = fault of the code; DB_FAULT_ = database) – caught in `api()`,
    half-done writes dropped, written by `errLog_` (list APP_ERRORS in app_settings, last 200; the same fault once in 10 minutes;
    stamp ERR_STAMP = today's count + last line), the user gets "The app hit a fault … not your entry … reported to the Admin".
    `reportError` (any user) for faults of the page; `getErrors` / `clearErrors` (admin). getInit / sync give `faults` to Admins.
    Page: `reportErr` (window error + unhandledrejection whose reason is not a plain Error), info card for the user in 3 languages,
    pill `#err_pill` "Faults: N" for the Admin within seconds + a note, list on a press ("seen" kept per device in rcl_errseen).
  * DIESEL WATCH (report key `watch`, `rptWatch_`): per machinery that keeps a Log Book – closed fill-to-fill cycles over the standard by
    more than 15% and 5 L; fills with no work until the next fill; a fill over the tank capacity; a fill reading that went back or did
    not move; tank checks that found 5 L or more less. Apart: machinery with diesel but no Log Book work in the period ("cannot be
    checked"). A fill with two signs counts once in the totals. Debit-basis parties left out. Words: "signs", "to look at, not proof".
  * QR LABELS: library qrcode-generator 1.4.4 (MIT, Kazuhiko Arase) minified in its own script block; Asset Master → "QR labels" (all
    active or one; 12 per A4); the code = `<site>/?m=<id>`; `qrArrive` after getInit shows its own sheet `#qr_sheet` (Diesel Issue /
    Log Book entry / ledger) and cleans the link. A label holds only the number; a sign-in is still needed.
  * NOT BUILT – SPEED FOR GROWTH: measured only the present size on the rig (about 0.2 s a call at 3,600 Log Book rows). A growth test
    by rows inserted straight into the database is NOT valid (the app serves cached table snapshots keyed by its versions) – it has to
    be done through the app. Then: read by date window instead of whole tables. (My test's "server crashed" was my own stale socket.)
  * NOT BUILT – ENTRIES WITHOUT A NETWORK: needs the page to open offline (service worker), start-up data kept on the device, an outbox
    kept on the device (the rid of update-37 makes re-sending safe), and a rule for two people entering the same thing. PROPOSED RULE
    (awaiting his yes): first to reach the server wins; the later one is kept on the device as "not accepted" with the reason and who
    entered it, to change or discard – never overwritten silently. Diesel issues have no natural key: same machinery + date + shift +
    litres from another user asks "already entered by X – save anyway?".
  * FOUND WHILE TESTING: the very first error handler of the page (start of the main script) put the SIGN-IN SCREEN over the page on
    ANY script error, also for a signed-in user at work. It now acts only until somebody is signed in; after that `reportErr` reports
    the fault and the user stays where he is.
  * Tests: unit "faults …" (24 unit tests), `test/browser/new3.js` (16, with the database).
- 04-10-2026: SPEED FOR MANY USERS. He: "even with 3,000 users everything must run smoothly" → clarified: 3,000 over ALL sites, each
  site (its own copy) at least 100 users, "no load, no hang". WHAT WAS WRONG: a table was read whole (and parsed) whenever ANYTHING had
  changed anywhere (one stamp for all tables); every save read all main tables again; every heartbeat asked the database.
  * TABLES IN MEMORY, UPDATED BY CHANGES (server/gas.js `makeWarm`, exposed to the app code as `__warm`; used in SupabaseData.gs
    `loadMany` / `load_`): per server instance each table is kept as rows in id order (JS string order – the same on every instance);
    stamp unchanged → nothing asked; else rows with `updated_at` > (time of the last answer on the database's clock – its HTTP Date
    header – less 15 s, less the duration of a first read) + ids from `deleted_rows` (paged to the end); a table not yet held is
    read whole by id (keyset pages); ≥ 1,000 changed rows → whole; whole again every 15 minutes; > 250,000 rows not kept;
    activity_log not kept. Only the table that is asked for is filled; the main tables are brought up to date in one round trip.
    The rows are SHARED between requests – `fill` copies (JSON cells too) and never changes them. `fill` rewritten as plain loops.
    Kill switch: environment variable RCL_WARM=off (old way: whole tables, heartbeat from the database).
  * HEARTBEAT FROM MEMORY (`gas.boot(st, keys, light)`, `BEAT`): `sync` is answered from this server's memory when the shared part
    (settings / versions / users list / stamp) is ≤ 1 s old and the session ≤ 20 s (its remaining time counted down); a save on this
    server resets it; an ended session is forgotten at once. 40 heartbeats: 0 database calls (was 40).
  * A bug found by profiling the first version: a long list of deletions (≥ 1,000 in the overlap window) forced a whole-table read on
    EVERY request – fixed (the deletion list is paged; the window is time-based).
  * MEASURED on the rig (ONE processor core for app servers, database, gateway and the load generator – absolute times are
    pessimistic): single calls at 25,221 Log Book rows, old → new: list 618 → 89 ms, start-up 661 → 113 ms, diesel save 1,395 → 247 ms.
    20 people hammering (25k rows): 2 → 11 calls/s, read 10.6 s → 1.2 s. Realistic use (heartbeat 2 s, list 15 s, save 90 s per
    person): 30 people – list half under 0.2 s, save 0.5 s; 50 people – 0.2 s / 0.5 s (95% of saves under 2.6 s); 100 people – the
    one core is saturated (heartbeats ~3 s), nothing fails. NOT measured on Vercel + Supabase.
  * STILL TRUE: saves go one at a time over the whole site (web_lock 'script', ~0.25 s each here → 3–4 a second); per request ~70–90 ms
    of the server's own work at 3,600–25,000 Log Book rows (turning rows into the app's tables + the logic); memory per instance
    grows with the data (6 pool workers each hold the tables).
  * `test/load-site.js <link> <e-mail> <password> [people] [seconds]` – the realistic test against any TEST copy (never the live
    site); makes LD-00…39, a diesel receipt and diesel issues, deletes the issues and the receipt at the end.
  * Tests: `test/browser/warm.js` (12: two servers with separate memories agree with the database after changes through either, edits
    straight in the database, delete + re-enter, 2,500 rows at once); all earlier suites pass on the new path (audit 40, reg 11, …).
- 04-10-2026 (photo of a laptop, user Amzad, Log Book entry with 10 rows: "+ Add row / Save Log Book / Clear" lay over row 8 and
  the list panel over rows 8–10): "the buttons must stay properly visible even with 30 rows" + "Ctrl + S must save on every page,
  with a pop-up 'save?' – yes → save".
  * CAUSE of the overlap: on a computer `.lg-wrap` is `overflow: visible` (the one-line entry rows), but it is also a `.table-wrap`,
    and every `.table-wrap` has `max-height: calc(100vh − 140px)` (tables scroll in their own box). A box with a height limit that
    does not scroll: with more rows than fit that height (5 on a laptop) the rows ran out of the box, over what follows. FIX:
    `max-height: none` for `.lg-wrap` on computers. All 38 pages scanned for the same combination: none other.
  * The button row of the Log Book entry (`.actions.lg-actions`) is `position: sticky; bottom: 0` – in sight at the bottom of the
    window while the rows are on the screen, in its normal place under the last row.
  * Ctrl + S (`ctrlSave`, in the global keydown): never the browser's "save page"; finds the visible, enabled main button whose
    words begin with Save / Update / Add – first in the panel that has the cursor, else the first on the page –, leaves the box
    being typed in (so its value counts), asks "Save?" naming the button (help language; the cursor on "Yes, save", so Enter = yes,
    Esc = no) and presses that button. Nothing to save → a line says so; a box already open → nothing. `askConfirm` got `cancel`
    (label) and `focusOk`.
  * Test: `test/browser/lgrows.js` (12: 10 and 30 rows at 1280 × 640, Ctrl + S on Log Book, Asset Master, Dashboard).
- 04-10-2026 (later): three things, agreed first in words, then built.
  * THE WORDS FOR A MACHINERY'S DIESEL. "High consumption / Low consumption / Balanced" were not understood by a new person (km/L is
    better when higher, L/hr when lower). Now ONE function `dieselVerdict_(pct)` (Code.gs), pct = % more / less diesel than the
    standard says the work needed (the same comparison as before, for KM, Hrs and KM + Hrs): within 10% "Good"; 10–30% less
    "Very good – N% less diesel"; over 30% less "Check reading – too good (N% less diesel)"; 10–30% more "More diesel – N% over";
    over 30% more "Bad – N% more diesel". Codes ok / less / check / more / bad (colours `.mst.*`, `.st.*`; counts on the report).
    Used by Monthly Diesel & Average (`addReadings_`) and Actual vs Standard Average (`rptAverage_`, order: bad, more, check, ok, less).
  * MONTHLY DIESEL & AVERAGE: each reading shows the date of the Log Book entry it comes from (`row.oDate`, `row.cDate`; a small
    dd-mm under the reading on the page and in print; two date columns in the Excel) – "the period says 01 to 30, which date is the
    closing reading of?".
  * PENDING LOG BOOK ON THE ENTRY PAGE (`#lg_pend`, `lgPendLoad / lgPendList / lgPendDraw / lgPendAdd`; API `logPending`, module
    Log Book, = `pendingLogs_()` as [machinery, date] pairs): by date → the machinery without an entry for the date on top; by
    machinery → its dates without an entry. A press puts it into the rows (an empty row first; for one machinery at its place by
    date, WITHOUT the "date changed" signal, which would re-date every row below day by day); "Add all / the next 30"; ticks for
    what is in the rows; read on opening, after every save, at most once a minute otherwise. The Dashboard's list is unchanged.
  * Tests: unit "the words for a machinery's diesel …" (25 unit tests), `test/browser/pend.js` (11, with the database).
- 04-10-2026 (screenshot: pending dates of MH-25-AJ-8511, 34 dates of September and October in one list): "I want a filter – when I
  look at October I do not want the other months; all at first, then what I pick." MONTH FILTER on the pending strip of the
  one-machinery entry (`lgPendMonth`, `.lp-months`, buttons All / Sep 2026 / Oct 2026 with counts; shown when the dates are in more
  than one month; back to All for another machinery; "Add all" follows the filter). Seen in the same screenshot and fixed: the
  Standard of a two-meter machinery ("2.5 km/L + 3 L/hr") ran under the From / To boxes – the Standard and Average cells now wrap
  (rule placed AFTER `td:nth-of-type(n+9):nth-of-type(-n+14)`, which keeps the diesel figures on one line and used to win).
  Test: `test/browser/pendm.js` (6).
- 04-10-2026: "vehicles and machinery under OTHER do not need a Log Book entry." ONE RULE `needsLogBook_(m)` (Code.gs) / `needsLogBook(m)`
  (page): not Diesel Supply "Debit Basis", not Ownership "Debit", not Ownership "Other". Used by `pendingLogs_` (so: the Dashboard's
  Pending Log Book, the strip on the entry page, the menu count), the daily report's "no entry" list and the Excel template's list of
  machinery. An entry for an "Other" vehicle is still ACCEPTED – it is only never asked for. NOT changed (told him): Diesel Watch still
  lists the diesel of "Other" vehicles under "cannot be checked" (it is a fact about the diesel, not a reminder), the meter reading
  asked at a diesel issue, the monthly report (their status stays "–"). Test: unit 'Log Book is not asked of Ownership "Other" …'
  (26 unit tests); through the server: an Other vehicle adds 0 to the pending count, the same vehicle as Rental adds its 34 days.
- 04-10-2026: "SAVE PASSWORD?" AND AUTO-FILL AT SIGN-IN. He: "the app asks the password at every sign-in; after a sign-in it should
  ask 'save the password?' – every time until the user saves; once saved the sign-in fills itself." The sign-in form already was a
  real form with the right autocomplete names; the browser still never offered to save because the app's page is an iframe made
  from text (srcdoc, no address of its own) and browsers do not run their password manager there. NOW the app hands the sign-in to
  the browser through the top page (Credential Management API, `window.top.PasswordCredential` – Chromium browsers):
  `credSave(email, password)` after a correct sign-in (not when the password must be changed first) and after a password change;
  `credFill()` when the sign-in screen is shown (`credentials.get({ password: true, mediation: 'optional' })` → fills the two boxes,
  note `#lg_cred`, cursor on Sign In – it does NOT sign in by itself); `credForget()` on sign-out (`preventSilentAccess`).
  The app stores the password nowhere. Whether / how often the bubble shows is the browser's rule ("Never for this site", the
  setting "Offer to save passwords", incognito). Firefox / Safari: nothing changes. The 6-hour session and "Remember me" are as before.
  Test: `test/browser/cred.js` (8; the browser's store is played by the test – headless Chromium has no password manager, the real
  call answers NotSupportedError and the sign-in still works). NOT seen by me: the real Chrome bubble – to be checked on the live site.
- 04-10-2026: THE ASSISTANT (chat), STAGE 1. He: "a chat bot in the app – ask it anything about the app: how, where, why, who did what,
  how much diesel, who took it …". Agreed: Gemini (his own API key), the app's data may go to it, read-only, each user within his
  own permissions, only from this app's data.
  * SERVER: `server/gas.js makeAi` → `__ai` for the app code (key GEMINI_API_KEY from the server's settings, never sent to a page;
    GEMINI_MODEL fixes the model, GEMINI_API_BASE is for tests). Code.gs: `AI_TOOLS_` (9 look-ups, declarations only), `aiRules_`
    (the fixed instruction: only this app, look up before any figure, read-only, answer in the person's language, [[open:TAB|Label]]),
    `aiModel_` (from the service's own list: "gemini-flash-latest" if offered, else the highest gemini-N flash that is not lite /
    preview …; kept a day in AI_MODEL; a 404 forgets it), `getAiReply_` (one step: signed-in user, 150 steps / hour / user and
    5,000 / day / site, at most 40 turns / 250 kB, only user / model turns are taken from the page; errors in plain words, the
    service's own text for the Admin). getInit gives `ai: { on }`.
  * PAGE: `#ai_fab` / `#ai_panel`; `AI_RUN` runs the look-ups through the app's normal calls with the user's sign-in (getDieselIssues,
    getLogBookList, logPending, getStock, S.master, rptAverage, rptWatch, getActivity, the guides PAGE_GUIDE / REPORT_GUIDE /
    FIX_RULES) and hands back totals + the split + the first rows; `aiAsk` loops up to 7 steps, sends the model's parts back
    untouched (thought signatures), shows "Looked up: …" under an answer and turns [[open:…]] into a button. Nothing is stored.
  * NOT DONE / NOT PROVEN: no call to the REAL Gemini was possible from the build machine (no network to it) – the request and answer
    shapes follow Google's documented REST form (v1beta generateContent, x-goog-api-key, system_instruction, tools.functionDeclarations,
    functionCall / functionResponse parts) and are tested against `test/gemini-standin.js`; the first real conversation is his.
    Stage 2 ("why" for bills and rejected entries, vendor ledger look-ups) and stage 3 (actions with a yes) are not built.
  * SET-UP for a site: Vercel → Settings → Environment Variables → GEMINI_API_KEY = the key from Google AI Studio → Redeploy.
  * Tests: unit "the assistant …" (27 unit tests), `test/browser/ai.js` (13; needs `node test/gemini-standin.js` and
    GEMINI_API_KEY=test-key, GEMINI_API_BASE=http://127.0.0.1:3998 in .env.local).
- 04-10-2026 (night): THE FIRST REAL QUESTION TO GEMINI on the live site (his screenshot): the key works, the request was accepted –
  the service answered 503 "This model is currently experiencing high demand … UNAVAILABLE", and the app showed that raw JSON.
  NOW `getAiReply_` deals with a busy service itself: busy = 503 / 500 / 429 / no connection; the first model is asked up to 3 times
  (waits 1.5 s, 3 s; `__ai.wait`), then the next two models of `aiModels_()` once each (the order: gemini-flash-latest, flash by
  version, previews, flash-lite – kept a day as AI_MODEL { list }), all within ~35 s; a 429 moves on to the next model at once; the
  model that answered is put first. 400 / 401 / 403 are not repeated. All busy → "The AI service is busy right now (503) – that is
  on its side, not in the app … ask again in a minute" (+ for the Admin the model and the service's own sentence, read out of its
  JSON by `aiSaid_`), and the chat shows an "Ask again" button; the failed question is taken out of the conversation.
  Tests: `test/browser/aibusy.js` (6; the stand-in can be told to be busy: /__busy?model=…&n=…). Still to be seen on live: a full
  answer from the real Gemini (a function call, the look-up, the final text).
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
