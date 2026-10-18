# update-125 – "Change site" on a phone: the box with the sites is on top (18-10-2026)

**Asked (with a picture from a phone):** "jewa mi site change la jatoy tewa site change krnecha option yetoy but blue pattice maghe
hide hotey tr he fix kr".

## What it was
* On a phone or a tablet (the page 760 px wide or less), the dark menu is a **drawer** that slides in over the page.
* "Change site" at its top opened the box with the sites (**VTR NH 848 / 18B KOLHAPUR**, "Stay here"), but the box opened
  **behind the drawer and its dark shade**. The drawer (`.side`, layer 30) and its shade (`#nav_back`, 29) sit above every box of
  the app (`#cf_back`, 20).
* The pages of the menu close the drawer when pressed; "Change site" did not, so its box stayed hidden and could not be pressed.
* On a computer the menu is part of the page, so it was not affected.

## What changes (the page only)
* Pressing **"Change site"** first **closes the drawer**, exactly as a page of the menu does. Then the box with the sites opens on
  top, and a site or "Stay here" can be pressed.
* **Nothing else changes:**
  * the same sites and the same "Stay here";
  * through the Portal, another site still opens with a new ticket ("All my modules (Portal)" too);
  * without the Portal, the app's own switch as before;
  * on a computer, as before.
* No server change, no SQL, nothing in the data.
* The phone app (rcl-mobile) has its own Change site screen, with no drawer, so it is not affected.

## Evidence
* **Unit tests: 88 / 88.** The new test "update-125" checks:
  * the drawer closes before the "Change site" box opens;
  * the drawer and its shade are above the box, which is why it must close;
  * the box, the Portal's way and the app's own switch are unchanged.

  On main the test fails.
* **Browser `test/browser/sitechg125.js`** (new, no rig needed: the page's own file in Chromium, nothing signed in, nothing
  sent). The page is shown as after a sign-in with two sites, on a phone (390 × 844), a tablet (760 × 1024) and a computer
  (1366 × 768). It opens the menu and presses "Change site", then checks:
  * the box is open with both sites;
  * what is on top at its title, at each site and at "Stay here" is the box;
  * the drawer has closed;
  * "Stay here" can be pressed and closes the box;
  * there is no page error.

  Result: **18 / 18**. The same test on the page of main: **12 / 18**. On the phone the menu is on top of the sites, the title
  and "Stay here"; on the tablet the menu's shade is. "Stay here" cannot be pressed on either.
* `test/browser/nofilm123.js`: 6 / 6.
* `node --check` passes on `server/*.js` and `api/*.js`, and the page's 6 script blocks parse. No secret is in the change.

## Not run / not verified
* Not tried on a real iPhone or Android phone; Chromium only (Safari's engine was not available here).
* The rig browser tests were not run: the local rig was not built for this change.

## Going back
Vercel → Instant Rollback to the deployment before this one. Nothing in the data changes.
