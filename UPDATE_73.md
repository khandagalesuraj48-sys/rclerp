# update-73 – screen share through a relay, for two networks that cannot reach each other directly (10-10-2026)

Asked by the owner on 10-10-2026, after update-72 (screen share with voice) went live: on one laptop / one Wi-Fi everything
worked; with a friend far away, on his own network, the call rang, was accepted and then stayed at **"Calling … (connecting)"**.
Discussed first (no coding): the ring and the answer go through our server and worked; the picture and the sound go straight
from browser to browser, and the two networks did not let the computers reach each other. Such networks need a **relay**
(a TURN server) that passes the encrypted picture and sound on.
His words on which relay: no Cloudflare (it asks for a card) – "one or two calls a day at most, nothing big, tell me one without
a card and we do that". Chosen: **ExpressTURN, free plan** (sign-up without a card; its site said on that day: 1,000 GB a
month free). He signed up and sent the relay's address: `free.expressturn.com:3478`. The name and the password stay with him.

No database step. No new table. Nothing to pay. Live is update-72 (`4ab3ab7`); this was built and tested on the local rig
only – nothing was pushed, deployed or run against the live database, and the real relay was NOT tried (see "Not verified").

## What has to be set (owner, once) – in Vercel, not in the code
Vercel → the project → Settings → **Environment Variables** – three of them (Production):

| Name | Value |
|---|---|
| `RTC_TURN_URL` | `free.expressturn.com:3478` |
| `RTC_TURN_USER` | the username ExpressTURN shows on its dashboard |
| `RTC_TURN_PASS` | the password ExpressTURN shows on its dashboard |

Vercel uses new variables from the **next deployment** on – so: the variables first, then the push of this update.
The name and password are never written in a file of the repository (it is public) and never in a chat.

## What the user sees
* Nothing new to press. A call is started and accepted exactly as before.
* When the two computers can reach each other directly (same office, same Wi-Fi), the call goes directly – as before.
* When they cannot, the call now goes **through the relay**; the bar at the bottom then says
  **"Your screen is shown · through the relay"**.
* When a relay is set but cannot be used (a wrong address, name or password, or a firewall), both the one who started and the
  one who accepted get: *"Screen share: could not connect to … If it happens every time: the relay could not be reached from
  one of the two networks (its address, name or password in the hosting settings may be wrong, or a firewall blocks it)."* –
  with the advice box in English, Marathi and Hindi. (Without a relay set the old words stay: "the two networks do not let the
  computers reach each other directly".)
* With a relay set, the ring goes out when the relay has answered the caller's browser – usually within a second or two, at
  most 6 seconds (before: at most 3). It has to wait: the ways to reach the caller are written into the ring itself.

## How it works
* `server/runtime.js` reads the three settings of the hosting (`__rtcRelay`). All three set = there is a relay; anything
  missing = no relay, and the app behaves exactly as in update-72.
* `app/Code.gs` `rtcRelay_` turns the address into what a browser understands. It may be written the way the relay's own
  site shows it: `host:port`, with or without `turn:` in front, without a port (3478 is taken), several separated by commas
  (up to 4), `turns:` for a secure one. Each address is offered **over UDP and over TCP** (some office networks let only TCP
  out). Something that is not an address is left out.
* `rtcUsers_` (the call a page makes when the list is opened or a ring is accepted) gives the relay to the page after the two
  address servers. The browser then tries every way by itself and takes the best that works – direct first, the relay when
  there is no direct way. The app does not decide that.
* The picture and the sound stay **encrypted from browser to browser**; the relay passes on packets it cannot read. It does
  see the two network addresses and how much is sent.
* **Said plainly – who gets the relay's name and password:** a browser cannot use a relay without them, so the page of every
  signed-in user gets them (not a visitor who is not signed in). They open the relay only – nothing of the app, its data or
  the hosting. Somebody who is signed in could read them and use up the relay's free amount; if that is ever suspected:
  make a new password at ExpressTURN and put it in Vercel (then redeploy).
* How much goes through the relay: a shared app tab is roughly 0.3 – 1 GB per hour of a call, only for calls that really
  need the relay (an estimate from the usual bit rates of screen sharing – not measured on a real line).

## Files changed (against live update-72, `4ab3ab7`)
| File | Change |
|---|---|
| `server/runtime.js` | `__rtcRelay`: the three settings of the hosting → the relay, or none |
| `app/Code.gs` | `rtcRelay_` (new); `rtcUsers_` adds the relay to `ice` and says `relay: true / false` |
| `app/App.html` | `rtcLoadUsers` keeps `RTC.relay`; `rtcIceDone` waits for the relay's way (at most 6 s) when a relay is set; `rtcWay` (new) asks the browser whether the connection is direct or relayed → the bar says "· through the relay"; the "could not connect" words name the relay when one is set; the advice rule and the Settings page description say it in English, Marathi and Hindi; `RTC.policy = 'relay'` (for tests only: everything through the relay) |
| `test/unit.test.js` | 1 new test |
| `test/browser/relay73.js` | new |
| `test/browser/turn-standin.js` | new – a small relay for the rig only (needs `npm install node-turn` in the rig's test folder; it is NOT in `package.json` and nothing of the app uses it) |
| `UPDATE_73.md`, `HANDOVER.md` | notes |

Not changed: `app/Index.html`, `server/page.js`, `server/gas.js`, the database, `AUDIT.md`, every other page of the app.

## Evidence (local rig; every command with a time limit, none reached it)
The rig has no second network, so the relay case was made on purpose: a small relay (TURN server) was started on the rig,
the app's server was started with the three settings pointing to it, and both browser pages were told to use **only** the
relay – as if no direct way existed. Picture and sound were checked as packets really arriving and the picture's clock
moving; "through the relay" was read from the browser's own report of the connection, not only from the bar.

**New**
| Test | Result |
|---|---|
| `relay73.js` (server with the relay set, port 3009; a second server with a WRONG relay password, port 3010) | 7 passed, 0 failed |
| – the pages are given the relay over UDP and over TCP with a name and password | pass |
| – only the relay allowed: the call connects; picture 800×468 moving, sound both ways, the page that is open is told; the browser reports the connection as `relay` on both sides; both bars say "through the relay" | pass |
| – the guest shows his own screen over that same relayed connection | pass |
| – the same two pages left to choose (one computer): they connect directly (`host` / `host`), the bar does not say "through the relay" | pass |
| – a wrong relay password and no direct way: the ring still arrives (after 8 s), the call does not connect, and after about 40 s BOTH pages say that the relay could not be reached, with the advice box; no call is left hanging | pass |
| – no script error on the pages (both parts) | pass |
| unit: the address as ExpressTURN shows it (`free.expressturn.com:3478`), with `turn:`, without a port, several with commas, `turns:`, one with its own `?transport`; half set or not an address = no relay; nothing set = the list of servers as before | 1 test, passed |

**Nothing else moved** (on the final code):
unit 50 / 50 · saveonce 44 / 0 · secure68 48 / 0 · audit 36 / 0 · reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known
line "backup is not set up" on the rig) · browser: screen72 23 / 0 · group72 13 / 0 · sweep (every page opened) 38 / 0.
Run on the code just BEFORE the last change of wording (after them only the help texts in `App.html` and the tests changed;
`Code.gs` and `runtime.js` are the same): harden 27 / 0 · backup 28 / 0 · browser entry71 19 / 0 · least68 9 / 0.
**Not run again for this update:** the other 25 browser tests of the list in `UPDATE_72.md` (Log Book, bills, diesel …) –
this update touches only the screen share's code and three help texts.

Said plainly:
* **The count of unit tests in `UPDATE_72.md` was wrong by one**: it says "50 in all"; counted again on the pushed code it is
  49. With the one new test it is 50 now.
* While making this update `npm install node-turn` in the rig's test folder removed the hand-made stand-in for the test
  browser; I first put a real package in its place, which made the browser tests crash or show no picture. Found, taken out,
  the stand-in put back (HeadlessChrome 141, as before); all results above are from after that. Nothing of this is in the
  repository – it is the rig only.

## What was NOT verified – and what will decide whether it works for him
* **The real relay.** ExpressTURN itself – its address, that his name and password work, that it answers over UDP and over
  TCP, its free amount – was not tried by me: I have no account there and must not have his password. What its site says
  about "free" was read on 10-10-2026 and may change.
* **His real networks.** Whether his laptop and his friend's laptop can both reach the relay is known only when they try.
  A network that blocks port 3478 altogether (some offices do) would still fail – the free plan has no other port.
* The live site; Edge / Firefox / Safari; phones; a long call through the relay; the sound quality through it.
* The estimate of GB per hour.

## If it still does not connect after this update
The words of the message tell which case it is:
* "… the two networks do not let the computers reach each other directly" → the app does not see a relay: one of the three
  variables is missing or misspelt in Vercel, or the push was made BEFORE the variables were saved (push once more, or
  Vercel → Deployments → Redeploy).
* "… the relay could not be reached …" → the app has the relay but a browser could not use it: the username or password is
  not as on the ExpressTURN dashboard, or one of the two networks blocks port 3478.

## Going back
Vercel → Instant Rollback → update-72 (`4ab3ab7`). Nothing is stored by this update. The three variables may stay – update-72
does not read them.

## To deploy (owner; no SQL)
1. Vercel → Settings → Environment Variables: the three variables of the table above → Save.
2. Then:
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-73.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-73: screen share through a relay when the networks need it"
git push
```
3. Vercel "Ready" → on BOTH computers close the app's tab and open the app again → make the call to the far-away computer.
   Connected through the relay = the bar says "· through the relay".
