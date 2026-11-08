# update-155 – smart cache, smart sync, the 2-second refresh at a lower cost (24-10-2026)

**Asked (24-10-2026):** "Smart Cache System … Data बदललेला नसेल तर Supabase किंवा Vercel ला अनावश्यक Request जायला नको … Smart Data
Synchronization – फक्त नवीन, बदललेल्या किंवा Delete झालेल्या Records चे Updates … User A ने Data Save केला की User B ला सक्रिय Screen
वर शक्यतो 2 सेकंदांत Update दिसला पाहिजे … Active Critical Screens साठी Fast Sync … Hidden/Inactive Screens साठी कमी खर्चिक Sync
आणि पुन्हा Active झाल्यावर Catch-up … API Calls आणि Egress कमी करणे … Vercel Functions, CPU, Supabase Queries आणि Egress यांचे
स्वतंत्र मोजमाप … अनावश्यक नवीन Libraries, Redis, Paid Services किंवा Database नकोत … Development Branch वर Implement आणि Test कर."
Built on the audit of the same day (sections 7 – 9, 16 – 17: "same as you have" answers, changed rows only, the heartbeat).

**No database step, no new library or service, no change to any action's own code, any save, check, bill, ledger, stock or
attachment.** Every answer is still worked out on the server from the database with the person's access, exactly as before; what
changes is how much of it travels, and how often a page asks.

## What changes

### 1. "The same as you have" / only what changed – one way for every question of every page
* `server/delta.js` (new): the page keeps the last answer of each question **in its memory only** (never in the browser's
  storage) with its fingerprint (SHA-256, 32 hex). Asked again, it sends the fingerprint (`have`); the server works the answer out
  as always and then answers:
  * the same fingerprint → `{ h, same: 1 }` (about 50 bytes);
  * this server still has the answer the page has → `{ h, base, delta }` – only the parts that changed (the answer cut after every
    `},` and `],` – the end of a row – and rebuilt from runs of the old pieces and the new text);
  * anything else → `{ h, result }` – the whole answer.
  The page rebuilds the answer and checks it against `h`; a missing base, a delta that does not rebuild or a different
  fingerprint asks again for the whole answer. So the page always ends with exactly the server's answer of NOW.
* Which questions: the heartbeat (`sync`), every `get…` / `rpt…` and the other reads (`logDashboard`, `pendingLog`, `billInit`,
  `vendorLedger`, `vendorOutstanding`, `billSummary`, `dieselHistory`, `boqRateCheck`, `boqMissing`, `logPrintExtra`). Never a save
  (it carries its number), a photo or a file being sent, a screen-share note.
* `api/rpc.js`: only a page that asks for it (`m: 1`, no save number) gets these answers; every other caller – an older page still
  open, the phone app – gets `{ result }` exactly as before. A refusal (`{ error }`) is as before.
* Kept per question AND per sign-in on both sides (the key holds the site and the whole question with the sign-in's token): one
  person's answer is never used for another's. On this server at most 32 million characters, an answer above 2 million is not kept
  (it still gets "same"); on the page at most about 12 million, the oldest go first.
* Emptied on the page at sign-in, sign-out, another site, a password change and the Super Admin's work; a refusal (no access any
  more …) drops what was kept for that question.
* `server/page.js` (the bridge) gets the same two functions as the server (`delta.CLIENT`, put into the page word for word).

### 2. The heartbeat: fast where others' entries show, cheaper elsewhere, catch-up at once (`app/App.html`)
* The pages that show other people's entries as they come (`LIVE_TABS`: Dashboard, Log Book, Diesel Issue / Inward / Transfer,
  Approvals, Asset Master, Activity Log) keep the **2 seconds** (asked 02-10-2026). Any other page on screen: **5 seconds**. Nobody
  touching the page for 5 minutes: 15 seconds (as before). A tab in the background: **60 seconds** (was 30). A screen share being
  set up: 1.5 seconds (as before).
* Coming back to the tab or the window, a first touch after a quiet spell, opening a page and every save ask at once (as before).
* Every heartbeat answer is "the same" in a few bytes while nothing changed (part 1).

### 3. The shell's own version check (`app/Index.html`)
* The shell no longer asks `getAppBuild` every minute while the app's heartbeat answers: every heartbeat carries the version and
  the app tells the shell. Before sign-in (no heartbeat) it asks as before. The "new version" banner and the update after 3 minutes
  work as before.
* The app asks the shell about a new version once, then at most once a minute (until now every heartbeat – every 2 seconds – made
  the shell ask the server again while the new version waited).

### 4. What each action costs, counted (`server/usage.js`, `server/syncfetch.js`, `server/pool.js`)
* Per site and action, in this server's memory: calls, time, the worker thread's CPU, database calls and the bytes the database
  sent, the bytes sent to the page, the whole size the answer would have had, how many were "same" / "only what changed", errors.
* One short line in the server's log every 10 minutes (Vercel → Logs → `[usage]`; `RCL_USAGE_LOG=off` stops it). On the local
  rig only: `GET /api/rpc?usage=1` (when `RCL_USAGE=on` – never set on the live site). Nothing is written to the database.

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – **111 / 111** (3 new: the pieces and the patch on 250 list changes and 1,500 random texts, the
  answers "same" / delta / whole, one key per sign-in and site, the memory's limits; the page's bridge run in a `vm` against the
  real server code – every rebuilt answer equal to the server's, a tampered delta asked again whole, a refusal drops what was kept,
  sign-out and another site empty it, a save never goes this way, nothing in the browser's storage; `/api/rpc` with a stand-in
  pool – `{ result }` exactly as before for a caller that does not ask, never for a save, the counts per action). `node --check`
  on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.
* **`test/browser/sync155.js`** (two app servers, as Vercel runs several; the person B has only "Diesel Issue: Edit"):
  | | main | this branch |
  | --- | --- | --- |
  | A saves 6 diesel issues on the other server – shown on B's list after (ms) | 2154, 545, 356, 1632, 702, 828 – median 702 | 2086, 510, 537, 1488, 650, 1846 – median 650 |
  | A saves 3 Log Book rows – shown on the Admin's Log Book page after (ms) | 968, 1500, 442 | 1000, 836, 2060 |
  | B's list reloads after a save (bytes) | 33 – 35 KB whole every time | 1.1 KB (only the change) |
  | B's heartbeat answer | 733 – 765 B every time | 49 B ("same") when nothing new |
  Both: B's list equals a freshly opened page's list row for row; offline – A adds 2, changes 1, deletes 1 – back online, all four
  on B's list within 0.3 – 1.6 s; A and B save at the same moment on two servers – each once; one save (same number) sent to both
  servers at once and again later – one entry; access taken away – the page is gone within seconds and B's question, also with the
  fingerprint of the list he had, is refused (no "same", no rows); sign-out empties the page's memory (branch: 21 / 21; main: 16 / 5
  – the 5 are the checks of what main does not have).
* **`test/browser/upd155.js`**: 70 s of work – the shell asked `getAppBuild` 0 times (main 1 a minute); a new version deployed –
  the bar came by itself after 0.5 s (main 2.1 s); while it waited, 15 heartbeats and **0** version questions (main **15**, one
  with every heartbeat).
* **`test/traffic155.js`** – one page, the same test data (60 machinery, 900 Log Book rows, 306 diesel issues), main → branch:
  | Phase | Requests | Bytes to the browser | Database → server | Server CPU |
  | --- | --- | --- | --- | --- |
  | A. open, sign in, Dashboard (22 s) | 24 → 24 | 3,613 → 3,621 KiB | the same | 1.37 → 1.39 s |
  | B. working on the Dashboard, nobody saving (120 s) | 62 → 61 | **44.6 → 2.9 KiB** | 49.8 → 50.4 KiB | 0.64 → 0.56 s |
  | C. Log Book + Diesel Issue opened (12 s) | 11 → 12 | 135 → 131 KiB | see below | 0.30 → 0.37 s |
  | D. Diesel Issue on screen, another person saves 6 issues (92 s) | 68 → 66 | **693 → 15.3 KiB** | see below | 2.33 → 2.17 s |
  | E. working on a report page (60 s) | **34 → 15** | 55.3 → 1.8 KiB | 47.9 → 36.9 KiB | 0.42 → 0.27 s |
  | F. tab in the background (120 s) | **3 → 1** | 2.3 → 0.0 KiB | 4.9 → 1.6 KiB | 0.14 → 0.10 s |
  | G. back on screen (5 s) | 4 → 3 | 2.3 → 0.1 KiB | the same | — |
  Bytes are before compression (Vercel compresses JSON on the way). The database → server bytes are the same on both (this update
  does not change how the server reads the database): C + D together 3.65 MB on main and on the branch – most of it the server's
  threads catching up with the 1,200 test rows written just before the run.
  Per open page and hour, from these: on a page that shows others' entries the heartbeat stays one call every 2 seconds (the
  owner's rule) but its answer is 49 B instead of ~750 B; the shell's 60 version questions an hour are gone; a report or other page
  asks about 900 times an hour instead of 1,800; a background tab about 60 instead of 120.
* **The same regression sets on main and on this branch** (the same snapshots, steps 1zc + 1zd + 1ze), test by test – the same
  checks pass and the same fail on both:
  * clean snapshot: `billlock` 16, `viewbill` 23, `bills120` 17, `gstdecl` 11, `lbpage` 13, `rows146` 29, `same145` 10, `entry71`
    20, `again128` 11, `time144` 17, `tanker105` 7, `gap77` 20, `add143` 18, `fix` 8, `tanker97` 16, `time76` 10, `time78` 10,
    `fix130` 12, `idle` 10, `warm` 12, `start` 8, `pendm` 6, `lgrows` 12, `retry` **10 / 10** (a save that does not get through
    is sent again by itself and saved once – through the new bridge; run with the machinery it expects); the same failures on both
    (data or servers this rig does not have): `shift109` 2 / 1, `tanker103` 10 / 1, `lists` 11 / 2, `stale` 1 / 2, `saveonce`
    19 / 24, `ldebit149api` 22 / 4, `half` 11 / 1, `mob` 4 / 7, `pend`, `guide2` 8 / 2, `rename` 3 / 8, `pwa` (stops at its own
    old restart line on both); `storm`: 21 calls from the watching page on both. `poll` – main 9 / 9 with its old rhythm, the
    branch 11 / 11 with the new one (a report page 5 s, a background tab 60 s).
  * Super Admin snapshot (Portal): `flow114` 12, `flow116` 18, `billed108` 25, `ev151` 12, `sdel134` 6, `remind118` 13,
    `ldebit149` 14, `flow114api` 30, `lock152` 17, `att153` 39 – on both (in the long run `remind118` on main and `lock152` on the
    branch each stopped once at a sign-in that did not open in time; run again alone: all passing on both).

## Not verified
* The live sites; Vercel's real instances (the rig had two app servers in one machine); compression on the way.
* Real browsers in the background: a hidden tab was told it is hidden (the headless browser cannot hide one); real browsers slow
  timers of background tabs further.
* Safari / Firefox: the page checks a rebuilt answer with `crypto.subtle` (Chrome, Edge, Safari 11+, Firefox 34+; a page without it
  simply gets whole answers).
* Live usage figures before / after: the `[usage]` lines in Vercel's log give them once this is live.
* The Dashboard's reload while others save was not measured as a phase of its own (its answer goes the same way as the lists).

## Going back
* Vercel → Instant Rollback to the deployment before this update. Nothing is saved differently and nothing is kept anywhere but in
  memory: a page of the old version simply gets `{ result }` again.
