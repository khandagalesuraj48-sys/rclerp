# update-236 – the web app opens without the location (no SQL) (13-11-2026)

**Asked (13-11-2026, urgent):** "web madhun location garaj nahiye web user la he fix urgent krun pr de fkt web".

## Before
Since update-85 the web app opened only with the location on: without it a screen "Location चालू करा" covered the whole app
(also when the person came back to the tab, or the browser's permission changed).

## The change (`app/App.html` only – the server, the phone app and the database are not touched)
* The web app opens without the location: nothing asks for it on open, on coming back or when the permission changes. The screen
  "Location चालू करा" and everything that showed it are taken out.
* **Unchanged:** a photo of a Diesel Issue taken on the web still carries its place (his rule of 12-10-2026; the server refuses a
  photo without it). The location is asked only at that moment. Off / not allowed: a message (Marathi, Hindi, English) says what
  the photo needs – the app stays open, nothing is covered.

## Tests
* `timeout 300 node --test test/unit.test.js` – 185 pass (every script block of the page parses).
* `test/browser/photo85.js` changed to the new behaviour (the app is open without the location; a photo without the location
  gives the message). `test/browser/shell85.js` is removed: it tested the location screen of an app left open over update-85.

## NOT run / NOT verified
See the pull request for the browser test's result on the rig. Not seen on the live site – his look after the deploy.

## Going back
Vercel → Instant Rollback to update-235.
