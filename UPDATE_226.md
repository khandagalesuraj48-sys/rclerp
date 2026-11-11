# update-226 – the Advertise Corner starts on the first Dashboard too (no SQL) (11-11-2026)

**Asked (11-11-2026, with pictures):** "ek vedio mi set kela aahe active ahe tri dakhwet nahiye". The post was Active in the Portal
for every site, App + Web, and the Dashboard showed nothing.

## The fault (update-225's own)
The posts were asked for when a page is opened with `showTab`. The Dashboard is the page a person STARTS on, and it is shown then
without `showTab` (on the rig: `S.curTab` is empty on the first page) – so the posts were asked only after he had gone to another
page and come back to the Dashboard. On a fresh start: never.

## What changes (App.html – the Advertise Corner only)
1. **The page itself is looked at every 2 seconds:** signed in and the Dashboard on the screen = seen (`advOn`). The first Dashboard
   starts the posts; another page stops them (as before, at once through `showTab`).
2. **An ask that could not be made or got no answer is made again soon** – not linked to the Portal yet: as soon as it is; no answer:
   in half a minute (before: 10 minutes later).

Nothing else: no server action, no figure, no access changed.

## Evidence
* `timeout 300 node --test test/unit.test.js` – 178 of 178 (new: `update-226`); the page's script parses.
* The rig, a browser, a fresh sign-in, **no `showTab` called**: `S.curTab` empty, the Dashboard seen → the posts asked; with the
  Portal's own answer for the site (a video, Banner) the place shows it, playing; another page: stopped; no page error.

## Not verified
* The ask on the one address on the rig (two addresses there – the Portal's real answer was given to the page's own ask); the live
  site; **whether the owner's video file itself can be played by a browser** (in the Portal's own page it did not play – see the
  Portal's change of the same day, which now says so on the page).

## Going back
Vercel → Instant Rollback to update-225.
