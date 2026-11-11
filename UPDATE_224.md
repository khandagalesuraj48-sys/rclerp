# update-224 – sign-in to the app without the old screen and the fuel gauge; an opening animation (no SQL) (11-11-2026)

**Asked (11-11-2026):** "web madhe new page ale aahe but sign in krayla wel ghete old screen yete ani to meter pn yeto to nko aahe fkt
ata ji new screen banwali ti ekach asel baki konti screen nahi lagech sign in hoil data load hoil fast … sign in jas hoil next page
sathi ek mast animation pn haw aahe". With the Portal's new sign-in page (rcl-portal #38) the way in showed, one after the other: the
Portal's page, this app's own OLD sign-in picture ("Signing in…") and the fuel gauge ("Filling up your data").

## What changes (App.html, Index.html – the look of the start only)
1. **No old sign-in screen on the way in.** Before anything is drawn, a mark is set for a person who is signed in here, comes from
   the Portal with a ticket, or whose sign-in is the Portal's: this page's own (reserve) sign-in screen is not drawn for him at all.
   The mark goes when that screen is really needed (an error, "Logout" here, `?local=1`) – it works as before. Not for the Super Admin.
2. **No fuel gauge.** The loading look is the Portal's: white, the One Click Solution logo in two turning rings, "Signing in" /
   "Loading your data" under it.
3. **The opening:** when the data is in, the logo opens out over the screen and the app zooms in under it (0.5 s). The app is open
   and usable from the first moment – the animation is a picture over it, nothing waits for it. Reduced motion / "Less motion": none.
4. The shell page is white (was grey) – no grey flash between the two pages.

Together with rcl-portal `signin-go` (the same look there on the way out, and straight into the ERP after sign-in).

**Unchanged:** `ssoLogin`, `getInit`, every check and access, the reserve sign-in, the screen lock, the location check.

## Evidence (local test copy, test data only)
* Unit tests 176 / 176 (new `update-224`).
* Real browser on the rig, Portal → Mechanical, every screen recorded from the click on "Sign in": the Portal's sign-in → white →
  the orbit look → the app zooming in. **The old sign-in screen and the gauge: not shown at any moment.** No page error. From the
  click to the open app: 3.7 s on the rig (the old way is not comparable – it stopped at the Portal's own page).

## Not verified
* The live site; Safari / Firefox; the real time on the live servers (the sign-in's own calls are unchanged, so no claim of speed).

## Going back
Vercel → Instant Rollback to update-223. No database step.
