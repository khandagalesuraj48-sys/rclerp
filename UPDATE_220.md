# update-220 – Speed: the Dashboard no longer carries the whole "Log Book pending" list; one call less when a page opens (no SQL) (10-11-2026)

**Asked (10-11-2026, after update-218 went live):** "page load lagech ka hot nahi data lagech ka yet nahi time ghetey" – then
"rollback nko karus aple app check kr ki speed ka kami zaley ani app la super fast kr sagle logic pakdun correct and perfect".

## What was found (measured on the local test copy – not on the live site)
* **The web lock (update-218) is not the main cause:** the page opened, signed in and showed its Dashboard in the same time before and
  after it (1.3–1.6 s on the test copy, 3 runs each). It did add **one call to every opening of the page** (`passkeyList` – his
  devices for My settings, asked even when My settings is not open).
* **The Dashboard's answer carried the whole "Log Book pending" list** – one line for every machinery and every day without a Log Book
  since 01-09-2026 (`pending.items`, plus a line per machinery in `today` / `older`). The Dashboard shows only the NUMBER (the badges, the
  Log Book card). The list **grows every day**: on the test copy (276 machinery, few Log Book entries) **19,543 lines = 2.0 MB in every
  Dashboard answer** – every opening and every refresh. Vercel can send at most ~4.2 MB in one answer: the Dashboard would have stopped
  working when the list got about twice as long. The server also worked the list out slowly (every machinery × every day: its periods
  on site read again, the date worked out again).
* After a new version (every merge) the server's first answers are about 3× slower (≈2.0 s for the 8 calls of an opening, ≈0.6 s once
  warm) – the server's helper threads read in the whole server code first. A change of how requests are given to threads was tried
  and **measured no better** (2.25 s) – it was taken out again; nothing of it is in this update.

## What changes
1. **The Dashboard asks `lite: 1`** (App.html `loadDash`, the Daily report): its answer's `pending` is `{ asOf, from, to, total, age }` –
   the number, the ages, the dates – **everything else of the Dashboard is exactly the same** (checked line for line). An older page or
   app that does not say `lite` gets the whole answer exactly as before (Code.gs `pendLite_`).
2. **The pending list itself** (Dashboard → Log Book view → "Log Book pending", 01-09-2026 → today) is asked of the server
   (`pendingLog`, the same list, the same access – Dashboard) **only when that view is on screen**: when it is opened, when the page opens
   on it, and again after the next new Dashboard answer (`lbPendAll`, `S.lb.pall`). Another period (From / To) – as before.
3. **The pending list is worked out faster, the same list** (Code.gs `pendingLogs_`): the days of the period once (not once per machinery),
   each machinery's periods on site once (`onSiteFn_` – the same rule as `onSiteOn_`, which now uses it), each day's age once.
4. **His devices (passkeys) are asked only when My settings is on screen** (App.html `wlSetDraw`) – not with every opening of the page.
   The lock panel still asks them itself (`lockState`) when it shows.
5. **A call never waits for a lock the page cannot show** (App.html `rawCallM`): a call refused with `SCREEN_LOCKED` waits only while
   the lock panel is really shown; otherwise it is answered ("the screen is locked") instead of waiting without end.

The phone app reads only the number of the Dashboard's `pending` (`total`) and takes its lists from `pendingLog` / `logPending` – it is
not changed by this update and keeps working (it still gets the whole answer, as it does not say `lite`).

## Evidence (local test copy, test data only)
| | main (f089d31) | this update |
|---|---|---|
| Dashboard answer | 2,007,040 bytes | **3,138 bytes** |
| `pendingLog` (the whole list), server | 311 ms | **108 ms** (same 2,004,046 bytes, same answer) |
| `getDashboard` whole answer (an older page), server | 192–247 ms | **113–131 ms** (same answer) |
| the 8 calls of an opening, warm server, 1 CPU (2 runs × 2) | 577–823 ms | **413–514 ms** (one call fewer) |
| the same on a server just started (1 CPU) | 2.0–2.2 s | 1.8–2.2 s (unchanged – see above) |
| sign in → Dashboard filled (browser, 3 runs) | 1.28–1.36 s | **1.10–1.28 s** |
| page opened again → Dashboard filled (browser, 3 runs) | 1.42–1.61 s | 1.22–1.56 s |

* The same answers, main vs this update, on the same database: `pendingLog` (usual period and October), `logPending`, `getDashboard`
  (two periods), `logDashboard` – all **SAME** (scratch script, not kept).
* In the browser, main vs this update: the badges (19,543), the Log Book view's list (276 machinery cards, the same first card, the same
  chips "All 19543 · Today 276 · Yesterday 276 · 2–7 days 1656 · more than 7 days 17335", Today = 276); the list asked once when the
  view is opened, not again when switching Diesel ↔ Log Book; the page opened again on the Log Book view shows its list by itself.
* Unit tests: 172 / 172 (new: `update-220` – the new pending list = the old way of working it out, line for line, also for a machinery
  that left and came back; `lite` = the number only, the rest of the Dashboard the same, without `lite` the whole answer; the page parts).
* Rig browser tests: `lock218.js` 16 / 16 (the web lock, with the new waiting rule); `pendprint179.js` 13 / 13 (the pending prints) –
  run with the browser's location allowed (the test as kept does not allow it, so its sign-in now stops at "Location चालू करा" – a
  test to bring up to date, not a fault of the app).

## Not verified
* **The live site was not measured** (it cannot be reached from here; his computer was not linked). How much faster the live Dashboard
  gets depends on how many machinery-days are pending there – where Log Books are filled every day the list is shorter than on the
  test copy.
* The slower first answers after every new version (cold server) are not changed.

## Going back
Vercel → Instant Rollback to update-218. No database step; nothing was stored differently.
