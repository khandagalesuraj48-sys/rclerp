# update-234 – "Verify my e-mail" reachable from this app; the screen lock's password asked by the user ID (no SQL) (12-11-2026)

**Asked (12-11-2026):** the Portal has two ways to sign in now (password, or a code by e-mail – its steps 10 and 11). He opened
My account here and wrote: "user la email cha option disat nahi". And his rule: the e-mail a user was made with stays his **user
ID** for ever (`pk@gmail.com` – "he delet nahi honar … fix rahil"); the e-mail he verifies is the one he signs in with.

## What is added
* `app/App.html` – **My account → My profile:** "Verify my e-mail" while his e-mail is not verified; afterwards "E-mail verified ✓
  – you sign in with: …". **A strip on top** ("Verify your e-mail … · Verify now") while it is not verified and the Portal's
  reminder is switched on – asked again every hour; it hides nothing and **nothing is ever closed** for it. Both send him to the
  Portal's own page (`<Portal>/?verify=1`). This page only ASKS the Portal (`/api/auth` – `me`, `emailAlert`) with his own Portal
  sign-in: nothing is kept or changed in this app or its database. Only under the one address (the Portal at the same address);
  elsewhere, or the Portal not reached: nothing is shown – everything as before.
* `server/portal.js` `checkPassword` (the screen lock's "is this his password?"): asks the Portal's new `checkPassword` by the
  person's user ID – right also for a person who signs in at the Portal with another, verified e-mail – and no sign-in is made
  there. A Portal that does not have it yet (404): asked as before, through its sign-in.
* 4 texts in Marathi and Hindi (`app/i18n`). No new action, no new server error, no SQL.

## Evidence
* `timeout 300 node --test test/unit.test.js` – 185 pass (the translations and every script block of the page among them).
* `node --check server/portal.js`.
* `checkPassword` run against a rig Portal with step 11 (a user whose sign-in e-mail is not his user ID): right → ok, wrong → not
  ok, no sign-in made there; and against a stand-in OLD Portal (404): falls back to login + logout, right / wrong as before.

## NOT run / NOT verified
* The API and browser tests (they need the full local rig) – not run. The strip and the button were not seen in a browser inside
  this app: they need the app and the Portal under one address – his look after the deploy.
* `tools/i18n/extract.js` was not used to rewrite `keys.json` (on this computer it lists many more texts than the file has); the 4
  texts were added by hand to `keys.json`, `mr.json`, `hi.json`.

## Order
The Portal's pull request (step 11) first or together with this one. Without the Portal's part the button and the strip simply
do not appear.

## Going back
Vercel → Instant Rollback to update-233. Nothing was written anywhere.
