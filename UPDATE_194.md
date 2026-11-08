# update-194 – The Purchase module under this address (30-10-2026)

**Asked:** "agodr supabase ani vercel madhe purchase department banau sagle site cha data tyatach asel mg old site aso ki new
banel tewa pn ani aata jas aahe ekach link warti sagle kahi" – the Purchase Department (its own repository `rcl-purchase`, its
own Vercel project and its own Supabase for every site) opens like the Store and Engineering: inside Mechanical's screen, at
the same address.

## What changes
* `vercel.json` only:
  * `/purchase` → `/purchase/` (a redirect, as `/engineering`);
  * `/purchase/` → `https://rcl-purchase.vercel.app/index.html` (the first page has its own rule, as `/engineering/`);
  * `/purchase/<anything>` → `https://rcl-purchase.vercel.app/<anything>`.
* Nothing else: no change to the page, the server, the database or access. Mechanical's dark menu already shows every module
  of the site with its pages (from `<its address>/menu.json`) and opens them in the middle of this screen; Ctrl K already asks
  every module (`window.rclModule`); Mechanical's Logout already signs out of every module of this address. The app's worker
  already leaves other addresses alone.

## Before it works live (the owner)
1. The Vercel project of `rcl-purchase` exists and its address is `https://rcl-purchase.vercel.app` (if Vercel gives another
   address, this file and `vercel.json` change first).
2. Portal → Modules → Purchase (key `purchase`) with the link `https://oneclicksolution-erp.vercel.app/purchase`.
Until then `/purchase/` answers "not found" – nothing else is touched.

## Evidence
* Unit tests: 147 / 147. New test "update-194": the redirect and the two rewrites, no staging rule (as Engineering), the
  worker leaves `/purchase/…` alone, the rest of vercel.json as before; "update-99" and "update-127" now pick their own rules
  by address (they read the last entries before).
* On the rig (gateway :3030 = what these rewrites do live, `rig/gateway.js` with `/purchase` → :3050):
  `rcl-purchase/test/inmech.test.js` 7 / 7 – the Portal's Purchase card opens Mechanical's screen with Purchase's Dashboard in
  the middle (his 2 sites); Mechanical's dark menu lists Purchase – Dashboard; Ctrl K finds it; one Purchase sign-in; no
  script error.

## Not verified
* The live rewrite to `rcl-purchase.vercel.app` (that project does not exist yet).

## Going back
Vercel → Instant Rollback to the previous update (or remove the three `/purchase` entries).
