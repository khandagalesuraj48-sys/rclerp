# update-227 – the Advertise Corner: one size – the strip, its shape fixed; a post sits as it was fitted in the Portal (no SQL here) (12-11-2026)

**Asked (12-11-2026):** "jast mothe size thewaychich nahi fkt strip madhe thewaychi ata strip web sathi wegli size ani app sathi
mobile screen nusar wegli size … fit to strip as ek option de te mi dable ki vedio image web and app nusar set hoil". Before, a
post's picture was cut differently on every screen (the place was 96 px high and as wide as the window), and his 16 : 9 picture
showed only its middle band. The fitting itself is the Portal's (rcl-portal #43: its step 9, "Fit to strip").

## What changes (App.html – the Advertise Corner only)
1. **One size: the strip, with a fixed shape** – 12.8 : 1 on the web (1920 × 150: 97 px high on a 1,246 px Dashboard), and the app's
   3.42 : 1 (1080 × 316) on a narrow screen (a phone's browser, up to 700 px). Banner / Card are gone. Because the shape is fixed,
   the same part of a post is seen on every screen.
2. **A post sits as the Super Admin fitted it:** the Portal gives `fit` (x, y = the part kept in view, z = how much bigger) for the
   web and for the app; the web's is used on a wide screen, the app's on a narrow one. Not fitted (or the Portal before its step 9)
   = from its middle, as before. A wrong value = the middle, no zoom.

Nothing else: no server action, no figure, no access changed.

## Evidence
* `timeout 300 node --test test/unit.test.js` – 179 of 179 (new: `update-227`). On the first run one older test (`update-218`, the
  web lock) failed once; alone and in the second full run it passed, with and without this change – not looked into further.
* The rig, a browser, with the Portal's real answer for the site (a video fitted there: web x 63 y 41.68 z 1 · app x 34.6 y 46.04
  z 1.6): wide screen – 1246 × 97 (12.85 : 1), the web's fit on the video, playing; narrow screen (420 px) – 396 × 116 (3.41 : 1),
  the app's fit and its zoom; no page error.

## Not verified
* The live site; Safari, Firefox; the ask on the one address on the rig (as in update-226: the Portal's answer was given to the
  page's own ask).

## Going back
Vercel → Instant Rollback to update-226.
