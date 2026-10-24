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
_(filled in below)_

## Not verified
_(filled in below)_

## Going back
* Vercel → Instant Rollback to the deployment before this update. Nothing is saved differently and nothing is kept anywhere but in
  memory: a page of the old version simply gets `{ result }` again.
