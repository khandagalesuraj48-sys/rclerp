# update-178 – the Store's outward into the Maintenance Log Book (28-10-2026)

**Asked (28-10-2026):** "sagle banwayla chalu kr" – the Store's step 2 (rcl-store `store-work`): its **Issue (Outward) to a machinery**
joins that machinery's Maintenance Log Book here (update-170 kept the place for it; update-175's "Fetch outward" said it was not built).

**No database step of Mechanical.** The Store's own step (`rcl-store/sql/store_step2_work.sql`) is run by the owner in every site's
Supabase – the same database as Mechanical's, so this server reads the Store's tables of the site. **No secret in any file.**

## What changes
* **Maintenance Log Book of a machinery:** every issue of the RCL Store to it in the dates is a bill of the Party **"RCL Store"**
  (Bill "Outward <no>"): each item its Qty, Uom, the Store's average basic rate on the issue's date, Amount; the reading written on
  the issue; "use for" as its remark. An issue **on debit** (charged to the machinery's owner) is not our cost (update-168): its
  lines are shown as "Debit", ₹ 0 ("RCL Store – debit to <party>").
* **Fetch outward (Store):** "N issue(s) of the RCL Store to this machinery are in this log book (Party "RCL Store")" / "No issue of the
  RCL Store to this machinery in these dates"; a site whose database has not the Store's step 2: "The Store's work is not set up at
  this site yet (its database step 2) – there is no outward to fetch …" (no error).
* The page's guide (Maintenance) says it; the words in English, मराठी and हिंदी.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **132 / 132 pass** (new `update-178`: the issues read from the site's database as
  bills of "RCL Store", a debit issue ₹ 0, the reading, the paging; a site without the Store's tables: none, `on` false; a server
  without the database key: none).
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; no secret in the change.
* **The local rig** (Claude stand-in, with the Store's step 2 run in the site databases): `mnt173.js` **24 / 24** (part 6: Fetch outward
  says what the server says), `mnt170.js` **21 / 21**; the Store's own tests (`work.test.js` – an issue to a machinery shows in its
  Maintenance Log Book here as "RCL Store") – see the Store's pull request.
* **Not verified:** the live databases (the Store's step 2 is not run there yet).

## Order
1. The owner runs `sql/store_step2_work.sql` (rcl-store) in every site's Supabase. 2. The Store's pull request, the Portal's. 3. This.

## Going back
* Vercel → Instant Rollback to the update before this one (the log book then shows no Store issue – nothing is lost; the issues stay in
  the Store).
