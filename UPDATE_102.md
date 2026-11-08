# update-102 – Ctrl K works inside the Store's pages too (13-10-2026)

**Asked:** "Store ch Dashboard / Item madhe gelo Ctrl K kel ki kamach krt nahi … Mechanical madhe yeun Ctrl K keli ki lagech open
hot … fix kr; new modual ale tri search Ctrl K sagli kade kam karel"

**Why it failed:** after a click in the Store's page, the keys go to that page. Mechanical's screen did not hear them.

**The fix (only `app/App.html`):** each time a module's page loads inside the screen, Mechanical also listens to the keys
pressed in it (`extKeys`):
* Ctrl K (⌘ K) opens and closes the search;
* "/" opens it when the cursor is not in a box;
* Alt + B is Back.

This is done by Mechanical for every module served under this address, so a new module needs nothing for it. No SQL.

## Evidence (local rig, gateway mode)
* **`test/browser/search101.js`: 13/13.** New checks:
  * cursor in the Store's search box → Ctrl K opens Mechanical's search with the cursor in it;
  * typing finds the Store's item;
  * on the Store's Dashboard, "/" opens the search.
* `inframe100.js` 11/11; unit 66/66 (new "update-102").

## NOT verified
* Live and in the installed app.
* A person who has only the Store (no Mechanical) gets the Store's own screen, which has no Ctrl K search.

## Going back
Vercel → Instant Rollback (rclerp).
