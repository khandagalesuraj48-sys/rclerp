# update-74 – the Admin sees which version runs, and whether the screen share's relay works (10-10-2026)

Asked by the owner on 10-10-2026, after update-73 (screen share through a relay) went live (`8cb92cd`):
"I cannot make out whether the relay is connected or not" and "the Admin must be able to understand which version the app
runs on". (In the same message: the "Waiting for the server … (getInit)" line after a sign-in – answered in the chat, see
the end; and that the further screen share ideas were not added – they were suggestions waiting for his yes, not built.)

No database step. Nothing to set in Vercel. Live is update-73 (`8cb92cd`); built and tested on the local rig only.

## What the Admin sees
Settings → **This app** (the card that already showed "Version 62f6ed01") has two new lines, for the Admin only:

* **Running now (Admin): update-74** – with the words of that update and its commit (e.g. "version for the Admin · 1234abc").
  Taken from the commit the live deployment was made from, so it is always the real one – also after an Instant Rollback
  (then it shows the update rolled back to). If the page open in that browser is older than the live version, it says
  "This page is older than the live version: close the app and open it again".
* **Screen share relay: Set – free.expressturn.com:3478** (or **Not set**) – the address only; the name and password are
  never shown.
* **Check the relay** – this computer asks the relay for an address of its own, exactly as at the start of a call
  (nothing is sent to anybody), and says in a few seconds:
  * green **"Working – the relay answered in 0.4 s (over UDP). A call that cannot go directly goes through it."**
  * red **"Not working – the relay refused the name / password …"** (the relay answered "wrong name or password")
  * red **"Not working – the relay did not answer in 8 s …"** (wrong address, or this network blocks the relay's port).

In a call, the bar at the bottom now always says how it is connected: **"· direct connection"** or **"· through the relay"**
(update-73 said only the second, so "nothing written" was not clear).

## How it works
* Vercel gives every deployment the commit it was made from (`VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_MESSAGE`,
  `VERCEL_ENV` – "system environment variables", available at runtime; Vercel docs, read 10-10-2026). `server/runtime.js`
  `__deployInfo` reads them; `Code.gs` `appVersion_` takes the update number from the message ("update-74: …").
  So the commit message must keep starting with `update-NN:` as all of them do.
* `getAppVersion` is an Admin-only question (a user who is not Admin gets "Only Admin can open this.").
* The relay check runs in the Admin's own browser (`iceTransportPolicy: 'relay'`, at most 8 s). It proves the relay works
  from THAT computer's network; the other person's network can still differ.

## Files changed (against live update-73, `8cb92cd`)
| File | Change |
|---|---|
| `server/runtime.js` | `__deployInfo`: the commit Vercel gives the server |
| `app/Code.gs` | `appVersion_` (new) and the Admin-only question `getAppVersion` |
| `app/App.html` | Settings → This app: the Admin lines `av_box` (`avLoad`, `avRelayCheck`, `avRelayTry`); the call bar says "direct connection" too; Settings description and the screen share advice in English, Marathi and Hindi; `getAppVersion` listed under the Settings page |
| `test/unit.test.js` | 1 new test (51 in all) |
| `test/browser/version74.js` | new |
| `test/browser/relay73.js` | checks "direct connection" too |
| `UPDATE_74.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `version74.js` – Admin sees "update-74", its words and commit, and "Set – 127.0.0.1:3478"; the relay's name / password nowhere on the page or in the answer; "Check the relay" with the right password → "Working … (over UDP)"; an older page says so; a user who is not Admin sees nothing and the server refuses him; a WRONG relay password → "Not working – the relay refused the name / password" (red); nothing set → "Not set", no Check button, the three variable names; no commit given → "Not known here"; no script error | 9 passed, 0 failed |
| `relay73.js` – as in update-73, plus: a direct call's bar says "direct connection" | 7 passed, 0 failed |
| unit: the update number from the commit message (also "Update-74B – …", none, nothing given); the relay by address once; its name and password not in the answer | 1 test, passed (51 / 51) |

**Nothing else moved:** unit 51 / 51 · saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 · browser:
screen72 23 / 0 · group72 13 / 0 · sweep (every page opened) 38 / 0 · entry71 19 / 0. After those runs only the order of two
comments in `server/runtime.js` changed (checked again: it parses, unit 51 / 51). Not run again: audit, reg, dn, restore-drill
and the other browser tests – this update touches only Settings → This app and the call bar.

## Not verified
* On the live site: that Vercel really gives the commit to this project (its docs say so; if the setting "Automatically
  expose System Environment Variables" was ever switched off, the line says "Not known here" – nothing breaks).
* The real ExpressTURN from his computers – that is what "Check the relay" is for: he can now see it himself.
* "did not answer in 8 s" (an address where nothing answers) was not made on the rig; the two other answers were.

## Going back
Vercel → Instant Rollback → update-73 (`8cb92cd`). Nothing is stored by this update.

## To deploy (owner; no SQL, nothing to set in Vercel)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-74.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-74: Admin sees the version that runs and can check the relay"
git push
```
Vercel "Ready" → close the app and open it again → Settings → This app → "update-74" → press **Check the relay**.

## The "Waiting for the server … (getInit)" line (asked in the same message – answered, nothing changed)
It is the app's own notice that an answer takes long; after 6 s it names the answer it waits for. `getInit` is the first
load after a sign-in (all the data the pages need). Right after a new deployment the server on Vercel starts fresh (its
first answer is slower) – so it is expected once after each update. `getInit` was not changed by update-72, 73 or 74.
Not measured on the live site (I cannot reach it from here). If it shows at EVERY sign-in, the number of seconds it shows
is what is needed to look into it.
