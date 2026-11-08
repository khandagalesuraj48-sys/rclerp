# update-127 – The Engineering module under this address (19-10-2026)

**Asked:** "engineering moul run kr full build kr" – the Engineering module (its own repository `rcl-engineering`, its own
Vercel project and its own Supabase for every site) opens like the Store: inside Mechanical's screen, at the same address.

## What changes
* `vercel.json` only:
  * `/engineering` → `/engineering/` (a redirect, as `/store`);
  * `/engineering/` → `https://rcl-engineering.vercel.app/index.html` (the first page has its own rule, as `/store/`);
  * `/engineering/<anything>` → `https://rcl-engineering.vercel.app/<anything>`.
* Nothing else: no change to the page, the server, the database or access. Mechanical's dark menu already shows every module
  of the site with its pages (from `<its address>/menu.json`) and opens them in the middle of this screen; Ctrl K already asks
  every module (`window.rclModule`). The app's worker already leaves other addresses alone.

## Before it works live (the owner)
1. The Vercel project of `rcl-engineering` exists and its address is `https://rcl-engineering.vercel.app` (if Vercel gives
   another address, this file and `vercel.json` change first).
2. Portal → Modules → Engineering (key `engineering`) with the link `https://oneclicksolution-erp.vercel.app/engineering`.
Until then `/engineering/` answers "not found" – nothing else is touched.

## Evidence
* Unit tests: 90 / 90 (twice; one earlier run had 1 failure – the known timing-flaky test, which passed on both reruns). New test
  "update-127": the redirect and the two rewrites, the worker leaves `/engineering/…` alone, the rest of vercel.json as before;
  the test "update-99" now checks the Store's and the Portal's rules apart from Engineering's.
* On the rig (gateway :3030 = what these rewrites do live, `rig/gateway.js` with `/engineering` → :3040):
  `rcl-engineering/test/inmech.test.js` 7 / 7 – the Portal's Engineering card opens Mechanical's screen with Engineering's
  Dashboard in the middle; Mechanical's dark menu lists Engineering's pages of that person (an Admin: 6, no set-up); a page opens
  in place; a plan saved inside (passes the origin check); Ctrl K finds Engineering's work "Embankment".

## Not verified
* The live rewrite to `rcl-engineering.vercel.app` (that project does not exist yet).

## Going back
Vercel → Instant Rollback to the previous update (or remove the three `/engineering` entries).
