# RCL Fleet ERP – performance pass 2 (02-10-2026)

Asked for: menu not fixed / sticky; then speed first (no freezes, no Chrome "Wait / Close page"), on an i3-1215U / 8 GB laptop.
Not changed: database, data, sign-in, permissions, server code (`app/*.gs`), API names and answers, routes, workflows.
Files changed: `app/App.html`, `server/page.js` (the bridge / freeze recorder) and this note.

## How it was measured

Local copy of the stack in the sandbox: PostgreSQL 16 + PostgREST 12, seeded through the app's own API with
120 machinery, 3,556 Log Book rows, 1,931 diesel issues, 32 inwards, 9 transfers. The ORIGINAL page (port 3001) and the
NEW page (port 3002) ran side by side on the same database, in headless Chromium at 1536 × 860.
"Another user" = a second sign-in saving a diesel inward every 3 seconds. One slow sandbox CPU core: milliseconds are for
before / after comparison only. **Not measured on the live site, on the real laptop, or with real Google Fonts / CDN.**

| What | Before | After |
|---|---|---|
| Server calls from the Log Book entry grid (20 rows filled, other user saving, 36 s) | 189 | 58 |
| Dashboard reloads while on screen (other user saving every 3 s, 30 s) | 10 + 10 ledger | 7 + 7 ledger |
| Dashboard reloads while NOT on screen, per save | 1 each | 0 (one load when opened) |
| "Show all" 500 Log Book rows – longest freeze | 328 ms | 146 ms (same total, in pieces) |
| One full calculation of the entry grid (20 rows) | 3.2 ms | 2.7 ms – and once per frame, not once per server answer |
| Excel tool (≈ 900 KB) before the page can draw | blocking | loads in the background |
| Menu on a computer | `position: sticky` | normal page flow (moves −400 px after a 400 px scroll) |

## The top 10 bottlenecks found (from the code, then measured where possible)

| # | File · function | Problem | Change | Expected benefit |
|---|---|---|---|---|
| 1 | `App.html` · `lgRefreshAll` | After EVERY change by anyone (each sync), every filled entry row asked the server at once (20 rows = 20 heavy calls), every few seconds | At most once in 15 s, 3 rows at a time; unchanged answers are not redrawn. Save is still checked on the server (`saveLogRowsInner_` recomputes diesel and readings) | 189 → 58 calls in 36 s; no bursts of 20 calls; much less server load for everyone |
| 2 | `App.html` · `lgFill` → `lgCalcAll` | Each server answer and each key press recalculated all rows, each row scanning all others (rows²), rewriting cells even when unchanged | Calculation once per frame (`lgCalcSoon`); Save first finishes it (`lgCalcFlush`); only rows of the same machinery are compared; a cell is written only when its text changed. Same formulas | Typing / answers no longer pile up work; tested: Save pressed right after typing used the typed Close (row in the database checked) |
| 3 | `App.html` · `onDataChanged` / `dashSoon` / `loadDash` | Dashboard reloaded (2 calls + full redraw + number animation) after every change of every user, even when another page was on screen | On screen: at most once in 5 s; off screen: marked and loaded once when opened; an identical answer is not redrawn (also the stock ledger) | Fewer calls; no hidden redraws while working on other pages |
| 4 | `App.html` · `setMaster` | Every lookup refresh (each entry page opened, others' entries) rebuilt 6 pick-lists + the whole Asset Master table, and asked for the vehicle-papers list again | Unchanged list → nothing rebuilt; vehicle-papers badge then at most every 5 min. Reset at sign-in | Less DOM work and one heavy call less per page opened |
| 5 | `App.html` · "Show all" (`listsFirst100`) | Up to 400 rows inserted in one go → one long layout | 50 rows per frame; a new list cancels the rest. Same rows and order | Longest freeze 328 → 146 ms |
| 6 | `App.html` `<head>` | `xlsx.full.min.js` loaded synchronously before anything could be drawn | Loaded in the background when the page is idle (≤ 3 s) or at the first click / key. `needXlsx` asks again if it failed | Faster first screen, especially on a slow connection. Export tested: same sheet content as before |
| 7 | `App.html` · `armReveal` | Read a panel's position after each style change (forced layout per panel on every page change) | Positions read first, then classes set | One layout instead of one per panel |
| 8 | `App.html` · `openTabData` (**bug**) | Two lines sat in the middle of the if-chain: after the first data change by anyone, **Tank Check and the report pages stopped loading when opened** | Lines moved after the chain | Confirmed in the browser: before = not loaded, after = loaded |
| 9 | `App.html` · menu CSS | Menu was `position: sticky; height: 100vh` with its own scroll bar | Normal flow, no inner scroll bar; look unchanged; phone drawer unchanged | As asked |
| 10 | `server/page.js` · freeze recorder | Noted only "did not answer for N s" (from 2.5 s) and long tasks | From ≈ 2 s; each note says page, last action, call being waited for and for how long, last answer, longest blocking task, memory, page size; Chrome's long-animation-frame shows the function that held the frame; `rclDiag()` in the console prints it all; a sleeping computer is not reported as a freeze | Next freeze can be traced to a page + action + call |

Looked for and NOT found: timers / listeners added again and again (all are set up once; `startSync` is guarded),
scroll / resize handlers, polling faster than the existing 2 / 5 / 15 / 30 s rhythm, lists longer than 500 rows
(the server already caps lists at 500; the page draws the first 100). Search boxes were already debounced (400 ms; checked:
6 fast keys = 1 call). Identical lists were already not redrawn (`listsFirst100`).

## Checked on this code

| Check | Result |
|---|---|
| `npm test` | 11 passed, 0 failed |
| `test/audit.js` auth | 9 passed, 0 failed (brute-force section passed in the full run; the backup section needs the extra :3997 server – not in this rig) |
| `test/audit.js` diesel + money | 22 passed, 2 failed – both need machinery `MH-15-AB-0002`, which this rig's data does not have (fixture, not code; server code unchanged) |
| Log Book list: Last 7 days, machinery filter, search, period totals | identical page text, original vs new |
| Log Book print (one machinery, 7 days) | identical print document (same fingerprint) |
| Log Book Excel export (machinery-wise) | identical sheet XML, original vs new |
| Log Book entry saved through the page | saved; database row = typed figures (37.5 km, 9.62 L std) |
| Page errors during all runs | none |
| Menu | not fixed / sticky; scrolls with the page |

NOT checked: the real laptop, real phones, Safari, the live Vercel site, Google Fonts / cdnjs (blocked in the sandbox –
the Excel file was served from npm's copy of the same version), Chrome's long-animation-frame line (not reported by the
headless browser), `test/reg.js`, `bkg.js`, `dn.js` (need the older rig's database set-up; they test server code, unchanged).

## Your decisions

1. Log Book entry: other people's new diesel now shows in an open entry grid within about 15 s (was 2–5 s). Shorter if needed.
2. The Dashboard now updates at most every 5 s while open.
