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
  | in use (every 2 s, 60 calls) | 10.5 ms | 10.2 ms |
  | open, nobody touching it (every 15 s, 12 calls) | **156 ms** | **13 ms** |
  | tab in the background (every 30 s, 6 calls) | **162 ms** | **20 ms** |

  (The server's own CPU over the whole time, divided by the calls – its own timers, about 0.06 s a minute with nobody asking,
  are included, so the small numbers are at most that. Each copy freshly started on the same test database; the server's CPU
  read from /proc before and after.)

## What changes
* **The helper is kept.** After 5 s without use it only throws away its connections and opens new ones for the next request:
  the same protection against a dead connection, without starting a new thread.
  * How: the helper replaces Node's pool of open connections (`Symbol.for('undici.globalDispatcher.1')`) with a new, empty
    pool of the same kind and closes the old one.
  * Only on the layout it was built and tested for: Node 20 / 22 keep exactly one pool, under that name. Anything else – a
    newer Node (Node 26's undici 8 keeps it under `.2`), no pool where one should be, a pool that cannot be replaced – and the
    helper answers "no": it is then replaced exactly as before (the old CPU cost, never a dead connection).
  * A helper that does not answer within 2 s is replaced as before too.
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
* **CPU under the usual load** (`test/load-site.js`: 15 people for 10 minutes – a heartbeat every 2 s each, the Log Book every
  15 s, a diesel issue every 90 s; the same test database, VTR's size, put back before each run): the server used
  **89.6 s → 78.9 s of CPU (12 % less)**. Nothing failed; the speed is the same ("anything new?" half under 6 ms, Log Book list
  36–37 ms, save 137–142 ms).
* Where the CPU went before (CPU profile of the same load, every thread): **31 % in helper threads**, 24 of them started in 3
  minutes. A busy site gains little (12 %); a quiet site gains most (above: 8–12× less per heartbeat).
* Regression: TBD

## After an independent review (22-10-2026)
A second reviewer read the change, ran the tests and tried it on Node 20.20, 21.7 and 22.22. On Node 20–22 it confirmed: the
built-in `fetch` takes the pool from that name on every request; the new pool is the same as Node's own; after a renewal the
old connection closes at once and the next request opens a new one; 10,000 renewals keep the memory flat; a renewal never
reaches a helper with a request in flight; the other protections are unchanged. Two things were fixed:
* **A newer Node** keeps its pool under another name (undici 8 in Node 26: `.2`). The first version then said "renewed" while
  nothing was renewed – the dead-connection protection would have been lost. Now only the known layout (exactly one pool,
  under `.1`) is renewed; on any other the helper says "no" and is replaced as before.
* **The new pool is checked before the old one is closed**; if it could not be put in place, the pool in use is left open.
* New checks in `test/unit.test.js` (update-142), run in a sandbox: nothing to renew before the first request; used but no pool
  under the known name → "no"; Node 20 / 22 → new pool, old one closed; a pool under `.2` (with or without `.1`) → "no",
  nothing closed; a pool that cannot be replaced → "no", left open.
* Checked by hand with the name changed to `.2` (as on another Node): a new helper is started (2 helpers, 0 renewals), every
  read answered at once.

## Seen while measuring, not changed
* Every request builds the app's server code afresh in a new sandbox (`runtime.js` `runPlain`: `vm.createContext` and the whole
  script run again) – about 2 ms of CPU per request, close to half of a heartbeat of a page in use. Changing that touches how
  every action runs; it is not part of this update.

## Not verified
* Not on Vercel and not against the live database.
* **How much less CPU Vercel will count is not known before it runs live.** It depends on how often the live site is quiet for
  more than 5 s between requests. Vercel → Usage → Fluid Active CPU shows it per day.
* Which Node version the Vercel project uses is not known here (tested on Node 22; the reviewer also on 20 and 21). On any
  other layout the helper is replaced as before (the old cost, nothing breaks) – and the CPU saving does not happen.
* Not tested over TLS (the live database is HTTPS; the test copy is plain HTTP on this computer).

## Going back
Vercel → Instant Rollback to the update before. No SQL, no data touched.
