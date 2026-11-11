# update-230 – the web lock waits 30 minutes (no SQL) (12-11-2026)

**Asked (12-11-2026):** "web lock 30 minute ch banaw" – the screen of the web locks after 30 minutes without use (it was 10
minutes, his choice of 10-11-2026, update-218).

## What is changed
* `app/Code.gs` – `WL_IDLE_MS_ = 1800000` (was 600000); the message `SCREEN_LOCKED … (nobody used it for 30 minutes)`.
* `app/App.html` – the page's own time (`WL.ms`) 30 minutes; the page kept a time from the server only up to 10 minutes
  (`<= 600000`) – now up to 30 (`<= 1800000`), in both places; the help (`FIX_RULES`) and My settings → Screen lock
  (`PAGE_GUIDE`) say 30 minutes in English, Marathi and Hindi.
* Nothing else of the lock is changed: how it locks, unlocks (fingerprint / face / PIN, password), the 5 wrong passwords, the
  server's own clock (+ 1 minute), a module's page inside counting as use. The look of the locked screen is not changed.
* The phone app's own lock is not part of this.

## Evidence
* `timeout 600 node --test test/unit.test.js` – 182 pass, 0 fail (new: `update-230`; `update-218`'s message test updated).

## Not verified
* Not waited 30 minutes in a real browser. The rig's short time (`RCL_RIG_LOCK_MS`, at most 10 minutes, never on Vercel) is as before.
* A page already open keeps its old copy until it is reloaded: the server alone then decides (30 minutes + 1), the old page
  itself still locks at 10 minutes until reloaded.

## Going back
Vercel → Instant Rollback to update-229.
