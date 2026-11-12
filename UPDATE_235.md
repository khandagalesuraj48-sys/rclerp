# update-235 – "Verify my e-mail" did not appear in My profile (a fault of update-234; no SQL) (12-11-2026)

**Reported (12-11-2026, with a picture of My account):** "ajun nahi disat" – after update-234 and the Portal's step 11 were live.

## The fault
update-234 asked the Portal only when the Portal's link (`PORTAL_URL`, one fixed address) was at the SAME address as the page. The
app is open at more than one address (`oneclicksolution.online`, the older `oneclicksolution-erp.vercel.app`): at any address
other than the link's, the Portal was never asked and the button stayed hidden.

## The change (`app/App.html` only)
* The Portal is asked at the address the person is at (the link's path, `/portal`, under this address).
* When the Portal gives no answer here (not signed in to it at this address), the button "Verify my e-mail" is shown all the same:
  the Portal's own page decides (it asks his sign-in if needed; an already verified person simply goes on). It is hidden only when
  the Portal says he is verified, is the Super Admin, or verifying is not switched on. The strip appears only on the Portal's answer.

## Evidence
`timeout 300 node --test test/unit.test.js` – 185 pass (every script block of the page parses).

## NOT run / NOT verified
Not seen in a browser inside this app (it needs the live addresses) – his look after the deploy. API / browser tests not run.

## Going back
Vercel → Instant Rollback to update-234.
