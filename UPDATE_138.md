# update-138 – The staging (TEST) database (with rcl-portal and rcl-store "staging-guard") (20-10-2026)

**Asked:** "ॲप उघडायला Fingerprint / Face lock: Staging database: HE 2 KR PERFECT" (the lock is App 3.27.0).
**His answers:**
* the staging database is for everything: Mechanical, Portal and Store;
* its data is empty plus a few TEST entries.

## What changes
* **A Preview works only with the TEST database.**
  * On a Vercel Preview (`VERCEL_ENV=preview`), every server first asks the database for the row
    `app_settings.THIS_IS_A_TEST_DATABASE = 'yes'`. It does this before it reads or writes anything. Only the staging
    database has this row.
  * A database without the row (any live one) is refused: 503, "This is a Preview (a test copy of the app): it works only
    with the TEST database …". Nothing is read or saved.
  * Where the check sits:
    * Mechanical: `server/syncfetch.js` `previewGuard` in `fetchAllSync`, so every database, storage or site call passes it;
    * the Portal: `lib/preview.js`, used by `lib/db.js`;
    * the Store: `lib/preview.js`, used by `lib/sites.js`.
  * The answer is remembered for 5 minutes (yes) or 10 seconds (no).
  * Live (`production`) asks nothing: it works exactly as before.
  * The page's help for the message is in English, मराठी and हिंदी (`FIX_RULES`, first rule).
* **No Google Sheet backup from a Preview** (`server/google.js` `config`): the live Sheet keeps only live data.
* **The orange TEST band on every page of a Preview:** "TEST copy (Preview) – the staging database · nothing here is live".
  * Mechanical: `server/page.js` `shell`; the app's frame starts below the band, so it hides nothing.
  * Portal and Store pages: in the page's flow, above their top bar.
  * The Store inside Mechanical's screen has no second band.
  * The Portal's `me` and the Store's `me` / `sso` answers carry `preview: true`.
* **One SQL file for the new Supabase project "rcl-staging":** `staging/rcl_staging_all.sql`, made by
  `node staging/make_staging_sql.js`. It contains, in order:
  * the three values he types (e-mail, name, one-time password);
  * the guard: it refuses a database that has the ERP's tables without the mark;
  * every Mechanical step of Read Me (`README_SQL_` – the same list as "New site"), except step 6 (keep-awake), which calls
    the LIVE address;
  * the mark, right after step 1;
  * the TEST company and site name, before step 7;
  * Store step 1;
  * Portal steps 1–3;
  * the TEST entries: vendor "Test Vendor A"; machinery TEST-JCB-01, TEST-TIPPER-01, TEST-EXC-01; Store items ITM-0001…0003;
    Portal company "TEST Co" and site S1 "TEST Site (staging)"; the modules at the staging addresses; him as the Super Admin.
  * The file can be run again on staging safely.
* **`vercel.json`:** four rewrites that match ONLY the host `rclerp-git-staging-pk12356843.vercel.app`. They send its
  `/portal/` and `/store/` to the staging Portal and Store, so the staging copy is "one address" exactly as live. The live
  rules are unchanged and come after them.
* **Guide:** `staging/STAGING_SETUP.md` (Marathi). It covers:
  * the Supabase project and the SQL;
  * Vercel Preview-only settings;
  * the Ignored Build Step for the branch `staging`;
  * Deployment Protection off for Previews;
  * the check.

## Evidence
* **Unit:** `node --test test/unit.test.js` **96 / 96**. The new test "update-138" checks:
  * the guard is in `fetchAllSync`;
  * the band and the no-backup rule on a Preview; no band live;
  * 503 and the help;
  * the SQL file is up to date and in the right order (nothing before the typed values and the guard; every step except step 6;
    the mark after step 1; the company before step 7);
  * no live address in the SQL file;
  * the staging rewrites match only the staging host.
* `node --check`: server, api and staging files.
* All 6 script blocks of the page parse.
* Portal unit tests 8 / 8, Store unit tests 10 / 10.
* **The SQL on the rig (Postgres 16):**
  * nothing typed → "STOPPED – nothing was run", 0 tables;
  * on the rig's first-site database (like live) → STOPPED, 31 tables before and after;
  * on the rig's Portal database → STOPPED, 9 tables before and after;
  * on a new database → "TEST database ready · test mark: yes · machinery 3 · vendors 1 · items 3 · sites 1 · Portal sites 1 ·
    modules mechanical live, store live · Super Admin …";
  * again → the same (nothing doubled);
  * `check_security.sql`: Mechanical all ok. Portal all OK except the one-time plain password, which is expected until the
    first sign-in.
* **Rig end-to-end** `test/browser/staging138.js` **30 / 30**. The three servers run with `VERCEL_ENV=preview` (`rig/stg_up.sh`).
  * **A – pointed at the live-like rig databases (no mark):**
    * Mechanical's page has the band;
    * Mechanical login → 503 "This is a Preview …";
    * the Portal → 503;
    * the Store's database call → 503;
    * not one row was written to those databases (`pg_stat_user_tables` before / after);
    * the same Store call without Preview reads as before.
  * **B – on the staging database:**
    * the file run again;
    * the modules have the staging addresses;
    * the Portal band;
    * the typed Super Admin signs in with the one-time password, must set his own, and it is hashed (`scrypt$`);
    * the cards Mechanical and Store S1;
    * Mechanical opens from the card and signs in by itself, with the band;
    * it reads the TEST vendor and the three TEST machinery;
    * a vendor save lands in the TEST database only;
    * no Sheet backup;
    * the Store opens inside Mechanical's screen (one address) and reads the three TEST items;
    * a Store save gets ITM-0004 in the TEST database only;
    * the Store alone has its band;
    * no page error.
  * Pictures `test/shots/staging138_*.png` (local).
* **Live behaviour unchanged (not a Preview), rig:**
  * Portal `test/api.test.js` **111 / 111**;
  * Store `test/api.test.js` **58 / 58**;
  * `test/browser/inframe100.js` (one address, Store inside Mechanical) **11 / 11**.
  * (Two rig leftovers of earlier test runs were cleared first: Mechanical user sa@rcl.test and two T2 items.)

## Not verified
* **Not run on Vercel or Supabase themselves.** These were only done on the rig:
  * the `has: host` rewrites;
  * the Ignored Build Step line;
  * Deployment Protection;
  * `VERCEL_ENV` at build time (the band);
  * Supabase's SQL Editor running the whole file.

  The guide says to stop if the band is not on the staging page.
* The staging addresses assume Vercel's branch-address form `<project>-git-staging-pk12356843.vercel.app`, which is the form of
  the Store's existing Previews.

## Going back
* Vercel → Instant Rollback to update-137.
* Or remove the Preview settings: live never uses any of this.
* No SQL step for the live databases.
