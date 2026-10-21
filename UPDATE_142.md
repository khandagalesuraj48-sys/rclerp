# update-142 – Less CPU on Vercel: the database helper is kept, only its connections are renewed (21/22-10-2026)

**Why (21-10-2026):** Vercel's free plan (Hobby) allows 4 hours of "Fluid Active CPU" in 30 days. Its Usage page showed
**4 h 41 m – over the limit – and 94 % of it was this app (rclerp, 4 h 25 m)**. Per day: about 4 minutes on 1 October, 15–27
minutes on working days since 13 October; the limit is about 8 minutes a day. Over the limit, Vercel may pause the projects
(the ERP, the Portal and the Store would stop). He cannot take a paid plan now and asked that the web keep working.

## What was wrong (measured on the test copy)
* The server waits for the database through a **helper thread** (`server/syncfetch.js`). A helper not used for 5 seconds was
  **thrown away and a new one started** at the next request – the protection against connections that went dead while Vercel
  froze the server (02-10-2026: a call waited 22 s).
* Starting a helper costs about **100–150 ms of CPU** (a new thread, and Node loads its whole web-request library again).
* So a request that came more than 5 s after the last one paid that every time. That is every heartbeat of a quiet site:
  * a page left open asks every 15 s;
  * a tab in the background every 30 s;
  * at night, at lunch, on a Sunday – almost every request.
* Test copy, one page, CPU of the server per "anything new?" (heartbeat):

  | The page | main (before) | this update |
  |---|---|---|
  | in use (every 2 s) | TBD | TBD |
  | open, nobody touching it (every 15 s) | TBD | TBD |
  | tab in the background (every 30 s) | TBD | TBD |

## What changes
* **The helper is kept.** After 5 s without use it only throws away its connections and opens new ones for the next request:
  the same protection against a dead connection, without starting a new thread.
  * How: the helper replaces Node's pool of open connections (`Symbol.for('undici.globalDispatcher.1')`) with a new, empty
    pool of the same kind and closes the old one.
  * The helper answers whether it could. If it could not (an unexpected Node version), it is replaced exactly as before.
* Nothing else changes: the same 2-second updates, the same time limits (reads 15 s, writes 30 s), a read that failed on the
  network is still asked once more on a new connection, a write is still never repeated by itself.
* **No database step. No new setting. No change on the page.**

## Evidence (local test copy only)
* `node --test test/unit.test.js` **99 / 99**. New check "update-142": renewed first, replaced only when that fails; the
  helper's code parses; three pauses → three renewals, still one helper, every request answered.
* `node --test test/net.test.js` **1 / 1** (updated). Its test server never answers a second request on the same connection
  (a connection that went dead). After each pause longer than the idle limit the read is answered at once, without a retry –
  so the connections really are new – and no new helper was started (4 pauses, 4 renewals). The dead-connection read and the
  write that is never sent twice: as before.
* The way back was checked by hand: a helper that refuses the renewal is replaced (2 helpers, 0 renewals).
* CPU: TBD
* Regression: TBD

## Not verified
* Not on Vercel and not against the live database (TLS to Supabase; the test copy talks plain HTTP on this computer).
* **How much less CPU Vercel will count is not known before it runs live.** It depends on how often the live site is quiet for
  more than 5 s between requests. Vercel → Usage → Fluid Active CPU shows it per day.
* Which Node version the Vercel project uses is not known here (tested on Node 22). On a version where the renewal cannot be
  done, the helper is replaced as before (the old cost, nothing breaks).

## Going back
Vercel → Instant Rollback to the update before. No SQL, no data touched.
