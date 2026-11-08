# update-99 – one address for every module (13-10-2026)

**Asked (13-10-2026):** "store page open dusri kade zal he chukich keles … store war click kel ki store ch dropdown khali
yetil … jyach war click krel te tithch open hoil same view madhe dusri kade nahi janar ani he sagle modual sathi asel new jri
add zal hach behiour all site madhe". The own domain comes later ("domain nantr jodu ata bakich fix kr").

**Why the Store opened in another window:** the installed app keeps to its own web address. The Store
(rcl-store.vercel.app) and the Portal (rcl-portal-flame.vercel.app) were other addresses, so they opened outside it.

**The fix:** everything is served under ONE address – the main one:

| Address | What it serves |
|---|---|
| `https://oneclicksolution-erp.vercel.app/` | Mechanical |
| `…/store/` | the Store (Vercel rewrite to rcl-store) |
| `…/portal/` | the Portal (Vercel rewrite to rcl-portal) |

When the own domain is added later, it is pointed at this project and everything moves with it.

Three pull requests, one change:
* this one (rclerp);
* rcl-store "one-address";
* rcl-portal "one-address".

## What changed here (Mechanical)
* **`vercel.json`:**
  * rewrites `/store/:path*` and `/portal/:path*`;
  * `/store` and `/portal` redirect to `/store/` and `/portal/`;
  * `/menu.json` is not cached.
* **`/menu.json`** – the pages of Machinery with their sections (Master, Diesel, Log Book, Billing, Reports).
  * Built by `build.js` from the menu in `App.html` (`server/page.js` `menu()`), so it is never out of date. `dev.js` serves it too.
  * The Store (and any module added later) shows these pages in its own dark menu.
* **The dark menu:** each other module of the site is a group like Machinery (Store ▾ → Dashboard, Item Master).
  * Its pages are read from the module itself (`<its address>/menu.json`).
  * A click opens that module on that page, in the same window.
  * If a module's menu cannot be read, the group shows one line, "Open …", through the Portal, as before.
* **Links from another module's menu:** `<address>/#site=S1&page=log` opens Mechanical on that page.
  * Not signed in, or signed in on another site: the trip goes through the Portal, carrying the page, and nothing is typed.
  * A page the person may not open: a note in English, Marathi and Hindi, and his usual page.
* **`server/portal.js`:**
  * `PORTAL_URL` may carry one path part (`…/portal`);
  * the ticket's module list carries each module's address (https only).
* **`sw.js`** (the installed app's worker) touches only this app's own addresses. The Store, the Portal and any later
  module are left to themselves.

No SQL. Bills, ledgers, stock, permissions: untouched.

## Evidence (local rig; never live)
* **Unit tests:** `node --test test/unit.test.js`, 63/63.
  * New: "update-99" (rewrites, menu, worker rule, page hooks).
  * "update-91" now also accepts `…/portal` and refuses two path parts, `?`, a space, and `javascript:`.
* **One address in the browser** (`test/browser/oneaddress99.js`, rig `GATEWAY=1 PORTAL=1`, `rig/gateway.js` :3030 doing
  what the rewrites do; each app gets its own Host, as with an outside rewrite): **12/12**. One tab all the way:
  * Portal `/portal/` → Store `/store/` (Dashboard);
  * → Mechanical "Log Book" from the Store's menu;
  * → Store "Item Master" from Mechanical's menu;
  * a Store save;
  * Store Change site T2 (same page);
  * → Mechanical "Diesel Issue" on T2.
* **Mechanical, other tests:**

  | Test | Result | Note |
  |---|---|---|
  | portal91 | 22/22 | updated: the Store is now a group with its pages |
  | portal91api | 40/40 | |
  | portal94api | 17/17 | |
  | site90api | 75/75 | |
  | site90 | 24/24 | run against :3001 |
  | newsite95 | 32/32 | |
  | pwa | 9/9 | |
  | start | 8/8 | |
  | search83 | 13/13 | |
  | mobile86 | 18/18 | |
  | tanker97 | 16/16 | |
* **Store:**

  | Test | Result |
  |---|---|
  | unit | 8 |
  | api | 46 |
  | browser | 26 |
* **Portal:**

  | Test | Result |
  |---|---|
  | unit | 6 |
  | api | 91 |
  | browser | 34 |
* `node --check` passes on `server/*.js`, `api/*.js`, `build.js` and `dev.js`. The page's script blocks parse. No secret is in the change.

## NOT verified
* **Vercel's real outside rewrite.** It was played on the rig by `gateway.js`. Two things are unknown:
  * which Host / X-Forwarded-Host the Store and the Portal really get. Both accept their PUBLIC_URL, so it works either way;
  * whether Vercel adds Mechanical's headers to their pages. Mechanical's headers allow what they need.

  First check after the merge: open `…/portal/` and `…/store/`.
* **The installed app on a phone or computer, live.** In the rig's browser (no installed app), one tab was kept all the way.
* **The full Mechanical browser suite.** Only the tests listed above were run, not every file in `test/browser/`.
  `test/backup.js` was not run again: nothing in the backup changed.
* **Mechanical's pages in the Store's menu are the same for everybody.** A page the person may not open shows the note and
  his usual page.

## Switching on (the owner, after the three merges)
1. Open `https://oneclicksolution-erp.vercel.app/portal/` and `…/store/`. Both should show their pages.
2. Vercel → Environment Variables. These are addresses, not secrets:
   * **rcl-portal:** `PUBLIC_URL = https://oneclicksolution-erp.vercel.app/portal`
   * **rcl-store:**
     * `PORTAL_URL = https://oneclicksolution-erp.vercel.app/portal`
     * `PUBLIC_URL = https://oneclicksolution-erp.vercel.app/store`
   * **rclerp:** `PORTAL_URL = https://oneclicksolution-erp.vercel.app/portal`

   Then Redeploy all three. Until all three are redeployed, a sign-in may say "made by another Portal". Open it again a
   minute later.
3. Portal → Modules:
   * mechanical = `https://oneclicksolution-erp.vercel.app`
   * store = `https://oneclicksolution-erp.vercel.app/store`
4. Use only `https://oneclicksolution-erp.vercel.app` from now on (bookmark / installed app). Each person signs in once more
   at the new address.

## Going back
* Put the three settings back:
  * PORTAL_URL = `https://rcl-portal-flame.vercel.app`;
  * PUBLIC_URL removed.
* Put the module addresses back. Redeploy.
* Or use Vercel → Instant Rollback of each project.

The code itself works at the old addresses as before.

## Fix after the merge (13-10-2026, live check)
Live, `…/store/menu.json` came through the rewrite, but the bare first pages `…/store/` and `…/portal/` gave Vercel's
404. Each first page now has its own rule, placed before the general ones:
* `/store/` → `https://rcl-store.vercel.app/index.html`
* `/portal/` → `https://rcl-portal-flame.vercel.app/index.html`

Why the general rule with an empty path did not reach the first page was not found. The rig's gateway cannot show it.
Unit test "update-99" checks the four rules (63/63).
