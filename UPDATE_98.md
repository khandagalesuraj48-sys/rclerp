# update-98 – the backup copies the Store's tables too (fix, 13-10-2026)

**Seen live on 13-10-2026,** right after the Store's SQL (`rcl-store/sql/store_step1_items.sql`) was run in the VTR database.
Mechanical showed:

> Supabase GET /rest/v1/items → 400: column items.id does not exist

The Google Sheet backup stopped. It copies **every** table of the site's database and read each one in the order of an
"id" column. The Store's tables have their own keys instead: `items` uses `code`, `store_sessions` uses `id_hash`, and
`store_tickets` uses `jti`. **No data was lost or changed.** Only the copy into the Sheet stopped.

## What changed (`app/SupabaseSync.gs` – used by the server's backup and by the old Apps Script one)
* **A table is read in the order of its own key:**
  * `SB_KEYS_` (now also `items: code`);
  * otherwise `id`;
  * otherwise, for a table of another module that has no `id`, its first column.

  Any later module's table works the same way.
* **Never copied into the Sheet:** the Store's sign-ins and used tickets (`SB_SKIP_ = store_sessions, store_tickets`). They
  are not data, and a sign-in fingerprint does not belong in a Sheet. The Store's **Item Master** and its **activity
  record** are copied like any table.
* The old Apps Script backup of changes:
  * a table without `updated_at` is read whole;
  * its rows are matched by their own key.

No SQL. Nothing else of the app changes.

## Evidence (local rig)
* `test/backup.js` **31 / 31**, with the Store's tables in the rig database:
  * before the fix, 12 checks failed with exactly the live message ("column store_sessions.id does not exist");
  * the new check: the Item Master is copied, the sign-ins and tickets are not.
* Unit 62 / 62 · portal91api 40 / 40.

## Not verified
Not run on live. After the merge, press **Backup** in Mechanical once (Admin): the red "Backup" pill should turn green.

## Going back
Vercel → Instant Rollback to update-97. The backup stops again for as long as the Store's tables are in the database.
