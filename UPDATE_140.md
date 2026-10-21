# update-140 – Less data from the database on every request (21-10-2026)

**Asked (21-10-2026):** "ETK LAGECH NAY ZAL PAHIJE ANI APP PN PROPER CHALAYLA HAWI" and "Minimum practical Supabase Egress"
(the VTR database sent 5 GB in 13 days; the free plan allows 5 GB a month).

## What was wrong (measured on the test copy, old code)
* **Every request started by reading ALL the settings and the users list** (`web_boot`, ~4.4 KB with its headers). With the
  heartbeat this happened more than twice a second on a busy site. It was the largest part of what one request cost.
* **Every 15 minutes every helper thread of every server read every main table whole again.** A server has up to 6 helper
  threads, and each kept its own copy, so each read the tables itself.
* **The approvals' reminder mark (`FLOW_REMIND`) was read by itself at every heartbeat** – an extra database call.

## What changes
* **Step 2b (`sql/supabase_step2b_light_boot.sql`, one new function `web_boot2`).**
  * The server says what it already has: a fingerprint of all settings, of each cache entry, and of the "stamp" (the time of
    the last change of each main table).
  * The database sends only what differs.
  * When nothing changed, the answer is small: no settings, no users list, no stamp.
  * Any change of a setting, an entry or a table changes its fingerprint, so a change is always sent. Data is never old.
  * Sign-ins are always sent fresh: a sign-out on one server is refused on the next request of every other server.
  * **Without step 2b the server keeps using `web_boot`, exactly as before.** It asks again every 10 minutes, so step 2b works
    once it is run, without a redeploy.
* **The 15-minute check is light** (`server/gas.js`, `makeWarm` → `check`).
  * Only every row's id and time of change are read – about a sixth of the table.
  * A row that is new, changed or missing is then read by its id; a row gone from the database is dropped. The copy ends exactly
    as a whole read would leave it.
  * More than 300 differences: the table is read whole, as before. Once in 6 hours it is read whole anyway.
* **"What changed since" sends only what the copy does not have** (`server/gas.js`, the `hot` read).
  * It goes 15 seconds back, so a row saved just now came again whole with every request of those 15 seconds, on every thread.
  * Now it first lists only id and time of change, then reads only the rows the copy does not have with that time.
* **One read per server, not per thread** (`server/pool.js`, `gas.seed`). A thread that read or checked a table hands its copy
  to the server's other threads, and to every thread started later.
* **`FLOW_REMIND` comes with the start of the request** (`server/runtime.js` `bootKeys`) and from the heartbeat's memory.
  * The heartbeat's memory follows the server's own writes at once (`flush`).
* The Admin's database page lists step 2b (`dbHealth_`); Read Me lists it word for word, after step 2; the staging SQL has it.
* The load test (`test/load-site.js`) sends with its heartbeat what a real page sends (up to which screen-share note it has
  read), so it no longer asks for that note at every heartbeat.

## Evidence (local test copy only)
* `node --test test/unit.test.js` **97 / 97**. Check "update-140":
  * step 2b is word for word in Read Me, right after step 2;
  * it only adds one function (no drop / delete / update);
  * its search_path is empty;
  * it is granted to service_role only;
  * the server's way back to `web_boot`;
  * the light check;
  * the threads' shared copy;
  * FLOW_REMIND with the start.
* `test/browser/egress140.js` **8 / 8** (two servers). Changes made behind the app's back are all found by the light check, on
  both servers:
  * a change with an old time;
  * an id with "|" and spaces;
  * a delete without its note;
  * a late insert;
  * 400 changes → whole read.

  The light check sent 1/7 of the Log Book. The same test on main: 2 / 8 (it cannot see such changes before 15 minutes).
* `test/browser/boot140.js` **4 / 4** with step 2b, **4 / 4** without it:
  * an entry saved on server A is in server B's next list;
  * a setting changed in the database is seen at the next request;
  * a sign-out on B is refused by A at once;
  * one start of a request with nothing changed: **662 bytes** with step 2b (counted with ~300 bytes of headers), against
    **4,477 bytes** with `web_boot`.
* The regression sweep of every API and browser test, main against this branch: see "Regression".
* The same load on old and new code: see "Measured".

## Measured
(filled from the test copy's byte counter – see the table below)

## Regression
(filled from the sweep)

## Not verified
* Not on Vercel, not against the live database. **How much less the live database sends is not measured** – it depends on the
  number of servers Vercel runs, their threads and the live load. The live split of egress is not known.
* Step 2b has never been run on a Supabase project. It was run only on the local test copy (PostgreSQL 16 + PostgREST).

## Steps for him (in order)
1. Merge this PR. It works without step 2b, exactly as before.
2. With his approval: run `sql/supabase_step2b_light_boot.sql` in **every** site's Supabase (VTR NH 848, 18B) – SQL Editor →
   New query → paste all → Run. It only adds a function; safe to run again.
3. The Admin's database page then shows step 2b as done.

## Going back
* Vercel → Instant Rollback to the update before.
* Step 2b can stay: the old code never calls `web_boot2`.
* To take step 2b away (not needed): `drop function public.web_boot2(text[], text, jsonb, text);`
