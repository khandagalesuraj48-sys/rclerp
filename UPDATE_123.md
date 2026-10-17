# update-123 – No opening film: the link opens the sign-in at once (17-10-2026)

**Asked:** "jewa app login or link open keli jatetewa one click che ek animation yete te animation purn kadhun tak te nko aahe ata
link click direct login page one click che fkt animation nko aahe".

## What it was
* When the ERP's link was opened, the **One Click Solution opening film** (`#oc_intro`, update-79) played over the page first:
  about 4 seconds once in every browser session, or up to 12 seconds when a film link was set. Only after it came the sign-in.
* "Company & site" (Admin) had a film link, a "Play the opening when the app is opened" tick and a "Play the opening now" button.
  My settings had "Play the opening when I open the app".

## What changes (the page only)
* **The film is gone:** its screen, its styles and its code (`ocIntro`). The link opens the **sign-in at once**, on a computer and
  on a phone.
* Gone with it:
  * "Company & site": the film link, the tick and the button;
  * My settings: "Play the opening when I open the app";
  * "Less movement" now says "(no gliding)".
* **Stays as it was:**
  * the sign-in screen with the One Click Solution logo;
  * the browser-tab and app icons;
  * the fuel gauge shown while the data loads after the sign-in.
* **Nothing in the data changes:** "Save company & site" sends back the film settings the server keeps, unchanged. No server
  change, no SQL.
* The words of the film were taken out of Marathi / Hindi (`mr.json`, `hi.json`, `keys.json` – the extractor gives the same list).
* The phone app: the same "Company & site" screen loses the film link and the tick (rcl-mobile, App 3.19.1).

## Evidence
* **Unit tests: 86 / 86.** The new test "update-123" checks:
  * the film's screen, code, styles, picture and the three settings are not in the page;
  * the sign-in and the loading gauge are there;
  * "Save company & site", run from the page's own code, sends back the film settings that were kept – a link and "off", or
    nothing and "on" – unchanged;
  * the film's words are gone from Marathi / Hindi.
* **Browser `test/browser/nofilm123.js`** (new, no rig needed – the page's own file in Chromium, the location allowed): on a
  computer (1366 × 768) and a phone (390 × 844), 300 ms and 1.5 s after opening, the middle of the screen is the sign-in and there
  is no film. Result: **6 / 6**. The same test on the page of main before this update: on the phone **the film** is in the middle
  of the screen at both times (4 failed).
* `test/browser/brand.js` and `logo79.js` (rig tests): changed to check the sign-in at once and "Company & site" without the film.
  The sign-in is `position: fixed`, so it is checked by what is in the middle of the screen, not by `offsetParent`.
* `node --check` passes on `server/*.js` and `api/*.js`. No secret is in the change.

## Not run / not verified
* The rig browser tests (`brand.js`, `logo79.js`) were not run: the local rig was not built for this change.
* Not tried on a real phone or computer.

## Going back
Vercel → Instant Rollback to the deployment before this one. Nothing in the data changes; the kept film settings are as they were.
