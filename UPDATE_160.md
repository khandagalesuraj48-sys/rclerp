# update-160 – The "Scan with Mobile" QR code opens in the RCL ERP app (25-10-2026)

**Asked (25-10-2026):** "AIK APLE APP MADHE SCANNER AHE … JEWA LOG BOOK ATTACHMENT MADHE ATTACHMENT QR NANTR MOBILE SCAN PHOTO
KADHUN KRTO N JEWA TE APP SCANNER MADHUN HOYLA PAHIJE"; then "THIS QR CODE IN NOT VALID AS YET TE"; then "NI HA GOOGLE SCANNER
MOBILE SCANNER MADHUN JARI SCANN KEL ADHI APP KADE JAW APP NASEL TR BROWSER KADE OK ANI COMPLETE PROCESS ZAL SHIWAY MADHECH CUT HOU
NAYE".

**No database step. No entry, attachment, bill or permission rule changes** – the same capStart / capClaim / capAdd / capPoll as
update-153; only the QR code's address, its site, a plain message for another site, and the file Android checks.

## Why "This QR code is not valid"
The QR code's session is kept in the computer's SITE database. A phone open at another site looks for it in that site's database,
does not find it, and said "not valid". Now the QR code carries its site: the app opens that site by itself (another of his sites),
and the server says plainly "This QR code is for another site (…)" if a phone at another site still sends it.

## What changes
### The QR code (`app/App.html` atQr)
* Its address is now `https://oneclicksolution-erp.vercel.app/scan?cap=<code>&site=<site>` (before: `…/?cap=<code>`).
* The words beside it: "Scan it with the phone's camera, Google Lens or the RCL app → Scan – it opens in the RCL app (in the browser
  when the app is not on the phone)." (मराठी, हिंदी in `app/i18n`; `keys.json` made again.)

### The phone without the app (the browser, as before)
* `/scan` is the ERP page itself (`vercel.json` rewrite after the staging rules, no-cache; `dev.js` the same). The page keeps the code
  and its site through the sign-in, puts the address back to `/`, and sends the site with `capClaim`.

### The server (`app/Code.gs`)
* `capStart_` also answers `site`.
* `capOpen_` (capClaim / capAdd …): a `site` sent that is not this site → "This QR code is for another site (T2) – open that site on
  the phone and scan it again." (its help rule was there already in `FIX_RULES`). Without `site` (an old QR code, the app before
  3.41.0): as before.

### Android: the link opens in the app
* `app/well-known/assetlinks.json` → `public/.well-known/assetlinks.json` (`build.js`; `vercel.json`: application/json, 1 hour): the
  app's package `in.rachana.rcl.rcl_mobile` and the SHA-256 fingerprint of its signing certificate. Both are PUBLIC (every installed
  APK shows them) – no secret. Android checks this file when the app is installed / updated (`autoVerify`), so **this update must be
  live before the app 3.41.0 is installed**.

### The phone app (rcl-mobile 3.41.0, its own pull request)
* The manifest takes `https://oneclicksolution-erp.vercel.app/scan`; the app keeps the code until he is signed in, unlocked and at its
  site (another of his sites opened by itself), then the photos screen. The app's own Scan does the same. The lock does not come while
  the app's own camera / file box is open (up to 10 minutes) – the process is not cut midway.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **113 / 113 pass** (new: `/scan` and `assetlinks.json` in `vercel.json` / `build.js`;
  capClaim with the site: S1 at S1 ✓, T2 at S1 → "for another site (T2)", an old QR code without a site → as before).
* **Browser, the local rig** (Postgres + PostgREST + the door; the Portal; Mechanical :3000 / :3001), `test/browser/att153.js` →
  **40 / 40**: the QR code carries its site; a phone at another site (ZZ9) gets the plain message; `/.well-known/assetlinks.json`
  names the app; the phone opens `/scan?cap=…&site=…`, signs in (the code kept), "Scan with Mobile" for that entry, the photos come to
  the computer – and every update-153 check as before.
* The Portal's `test/api.test.js` on the rig: 99 / 12 – **the same 99 / 12 on main** (the rig's set-up today, not this change; the
  Portal is not changed).
* `node --check` on `server/*.js`, `api/*.js`, `build.js`, `dev.js`; the page's 6 script blocks parse; the JSON files parse; no secret
  in the change.

## Not verified
* A real Android phone with the phone's camera / Google Lens (the link opening the app needs the live `assetlinks.json` and the app
  3.41.0 installed after it). If Android has not verified the link yet, the phone asks "open with" or opens the browser – the process
  still works there.
* iPhone: the link opens in the browser (Universal Links need the Apple team ID – not done).
* The Vercel rewrite and the file headers on the live site (checked in the rig's `dev.js` and by the unit test of `vercel.json`).

## Going back
* Vercel → Instant Rollback to update-159. Nothing in the database to undo. A QR code made after the rollback is `…/?cap=` again; the
  app 3.41.0 still reads it (its own Scan).
