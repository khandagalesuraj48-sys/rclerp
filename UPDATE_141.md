# update-141 – The Google Sheet backup once a day, reading only what is new (21-10-2026)

**Asked (21-10-2026):** "Maintain … one successful Google Sheets backup daily" and "Minimum practical Supabase Egress" (the free
plan's 5 GB were used in 13 days).

## What was wrong
* Every open web page asked for a backup every 5 minutes. After **any** change the server copied every changed table **whole**
  again – at most every 4 minutes, all day.
* The **Activity Log** changes with every save, so it was read whole again many times a day. It is by far the biggest table
  (on the test copy: 19,300 rows = 9.1 MB). This is very likely the largest part of what the live database sent out (not
  measured live – see "Not verified").

## What changes
* **Once a day** (`server/backup.vm.js`):
  * the nightly job of Vercel (`vercel.json`, 02:00 India time, unchanged) makes the full copy, as before;
  * an open page starts a backup **only when none ended today** (India date) – the safety net when the nightly job did not
    run (no `CRON_SECRET` in Vercel, Vercel or Google down);
  * after a failed try the next one waits 4 minutes (as before);
  * the **Backup** button (Admin) copies at once, as before;
  * an unfinished backup goes on a minute later (the page is told `pending`).
* **The logs: only their new rows.** The Activity Log and the Store's log (`store_activity`) only grow.
  * Their new rows (key after the last one copied) are read and added at the end of the tab.
  * This happens only when everything agrees: the tab has exactly the rows copied before, and the table has exactly those plus
    the new ones.
  * Otherwise – a row deleted, a tab changed by hand – and once in 30 days, the tab is written whole, as before.
  * The notes are kept in `BK_STATE.app` (rows copied, last key, last whole copy).
* **The page** (`server/page.js`) asks every 30 minutes instead of every 5. It asks a minute later while a backup is unfinished.
* **The Admin's Backup pill** (`app/App.html`) shows the time when the backup is from today, else its date (e.g. "20 Oct").
* **No database step. No new setting.**

## Evidence (local test copy only)
* `node --test test/unit.test.js` **97 / 97**. The new check "update-141" covers:
  * once a day;
  * the logs' rule;
  * the page's timer;
  * the nightly job in `vercel.json`;
  * the pill.
* `node test/backup.js` on the test copy (Sheets stand-in): **46 / 46**, every section.
  * New sections:
    * **daily** – the first page of the day starts the backup; after it, open pages are left alone even after a new entry;
      the nightly job and the button still run; an unfinished run says `pending` and ends complete;
    * **logs** – only new rows are added; the tab is exactly the table row by row; a tab that does not match, a deleted
      row, or 30 days: written whole; the Store's log too.
  * Fixed in the test (old fixtures, the same failure on main):
    * the second user is made in the database (since update-90 the Admin cannot make users);
    * there is only ever one Super Admin;
    * the tab name "Billed Changes".
* **Measured** with the test copy's byte counter (19,300 Activity Log rows):

  | One backup run reads | Before | After |
  |---|---|---|
  | after one diesel entry | 9.16 MB | 0.08 MB |
  | the full copy of the day | 9.24 MB | 0.15 MB |

  * Before: up to one such run every 4–5 minutes while anything changed.
  * After: one a day, plus the Admin's button.

## After an independent review (21-10-2026)
A second reviewer read the change; it found nothing critical. Four edge cases of "only the new log rows" are now closed:
* **Read by key, not by position.** A log is read page by page after the last key, never by position. Before, a row saved
  between two pages of a read of more than 1,000 rows could come twice while another row was missed. A read whose keys are not
  each once is not trusted (whole next time).
* **Columns changed.** The notes keep the log's columns; a column added or taken away → the tab is written whole.
* **Tab made again.** A tab made again in the same run (it was missing) is written whole, never appended into.
* **Always from the database.** Every page of a log read has a filter, so it is always asked of the database.
* New checks in `test/backup.js` (logs):
  * 1,500 new rows at once – each once, the tab exactly the table;
  * a column added → whole with the new heading;
  * all tabs gone → whole.

## Also (tests only)
* The unit test "update-117" failed about 1 run in 7. Two of its saves came in the same millisecond. The stock then orders them
  by kind, so a transfer out could come before the transfer in that it needs. People never save twice in one millisecond, so
  only the test was changed: it waits for the next millisecond. The stock rule is unchanged. 8 runs in a row: 97 / 97.

## Not verified
* Not run on Vercel, against the live database, or with the real Google Sheets API (the stand-in answers like it).
* **Not known whether `CRON_SECRET` is set in Vercel.** Without it the nightly job is refused (401). The first open page of each
  day then makes the backup.
* The live split of egress is not measured: the Activity Log's live size is not known here.

## Going back
Vercel → Instant Rollback to the update before. No SQL. The backup's notes keep working with the old code (it ignores
`BK_STATE.app`).
