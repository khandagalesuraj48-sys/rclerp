# update-100 – the same view: other modules open INSIDE Mechanical's screen (13-10-2026)

**Asked (13-10-2026):**
> "mechanical madhe kuth hi click kar same view rahto, but store war click kel view change hoto … store jri open kel mechanical
> kas view aahe sagle fix aahe fkt tab changes"
>
> "sign in ekdach … modual change sathi sign in nahi … app ekdam smooth"
>
> "diesel issue log book … patkn yetat same other modual … same smoothness"

## What changes for the person
* He signs in **once**.
* Mechanical's screen stays: the dark menu, the top bar, Change site, Back, Search.
* Store ▸ Dashboard / Item Master in the dark menu opens the Store page **in the middle**, where a Mechanical page is
  shown. Nothing else moves.
* Back to Log Book and then to Item Master is instant. The Store page stays loaded and is not loaded again (13 ms on the rig).
* **No sign-in page.** The Store's own sign-in comes by itself and nothing is typed:
  * the first time the Store is opened;
  * when the Store's 12-hour sign-in ends.
* The Store's card on the Portal opens the same screen: Mechanical with the Store page in the middle.
* The same works for every module served under this address, on every site.
* A person with the Store but not Mechanical gets the Store's own screen, as before.

## How
* **Mechanical (`app/App.html`):**
  * new middle part `#sec-ext` holding one frame per module (`/store/?embed=1#site=…&page=…&u=<email>`);
  * `extOpen`, `extHide` (called by `showTab`), `extGo` (links `#page=store__items`) and `extSize`;
  * Back from a module page returns to the Mechanical page before it;
  * Logout also ends the modules' sign-ins;
  * an old sign-in without module addresses asks the Portal once (`modsFresh`, same person only).
* **Store (rcl-store PR "in-frame"):**
  * `?embed=1` hides its own menu and top bar;
  * its sign-in comes from the Portal as an answer (`/portal/api/go?…&json=1`), with no page change;
  * another person's or another site's Store sign-in on the browser is ended first;
  * opened on its own beside Mechanical (same address), it goes into Mechanical's screen, at most once in 30 s;
  * `vercel.json`: X-Frame-Options SAMEORIGIN and `frame-ancestors 'self'`, so only this address may show it inside.
* **Portal (rcl-portal PR "in-frame"):** `/api/go?…&json=1` gives the ticket itself.
  * Only from the Portal's own address: our header plus the origin check. Another site is refused (tested).

No SQL. No change to bills, ledgers, stock or permissions. `test/browser/oneaddress99.js` was replaced by `inframe100.js`: the
Store no longer has its own screen beside Mechanical.

## Evidence (local rig; never live)
* **The same view, end to end** (`test/browser/inframe100.js`, rig `GATEWAY=1 PORTAL=1`): **11/11**. One tab all the way:
  * Portal → Store card → Mechanical's screen with the Store Dashboard in the middle;
  * Store ▸ Item Master (same Store page);
  * Log Book;
  * Store again (13 ms);
  * Back;
  * a Store save inside;
  * the Store's sign-in deleted → back by itself, no sign-in page;
  * Change site T2 → Store there (T2's items only, Store User);
  * no sign-in page after the first.
* **Mechanical:**

  | Test | Result | Note |
  |---|---|---|
  | unit | 64/64 | new "update-100" |
  | portal91 | 22 | |
  | portal91api | 40 | |
  | portal94api | 17 | |
  | site90 | 24 | against :3001 |
  | newsite95 | 32 | |
  | pwa | 9 | |
  | start | 8 | |
  | search83 | 13 | |
  | mobile86 | 18 | |
  | tanker97 | 16 | |
* **Store:**

  | Test | Result |
  |---|---|
  | unit | 9 |
  | api | 46 |
  | browser | 26 |
* **Portal:**

  | Test | Result | Note |
  |---|---|---|
  | unit | 6 | |
  | api | 96 | 5 new json=1 checks |
  | browser | 34 | |
* Script blocks parse, `node --check` passes, and no secret is in the change.

## NOT verified
* Live on Vercel: whether the Store's frame headers through the rewrite allow it inside Mechanical. Both projects now say
  SAMEORIGIN / `'self'`, so they should. First check after the merge.
* A phone screen with the Store inside. Only a computer screen (1440×900) was tested.
* The installed app on his devices.

## Merge
Merge all three (Portal, Store, then Mechanical) within a minute or two. Mechanical alone would show an empty middle until the
Store's headers allow it. No setting to change.

## Going back
Vercel → Instant Rollback of the three projects. The one-address settings stay as they are.
