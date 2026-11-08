# update-72 – screen share with voice between users of the app (10-10-2026)

Asked by the owner on 10-10-2026: "User A is on a screen and has a difficulty. A shares his own screen with user B and can show
and tell him directly – fully live and fast. They can share screens with each other, see each other, edit. When he wants to
share it asks WHOM – a list – and it goes to those he picks. Audio plus screen share: both can talk to each other."
He first asked how it could be done simply (answered in the chat: in the app itself, browser to browser), then: "build all of it".

No database step, no new table, no new service to pay for. Live is update-71 (`d735e05`); this was built and tested on the
local rig only – nothing was pushed, deployed or run against the live database.

## What the user sees
1. A **screen button** in the bar at the top of every page (beside the key).
2. It opens **"Share my screen"**: the other users by name, each with "at the app now" (green) or "not at the app now". Tick up
   to **3**, press **Share screen**.
3. The browser itself asks what to show – **this tab** (so that only the app is seen) – and for the microphone.
4. The other user's page **rings**: "Sujit wants to show you a screen – Accept / Decline" (sound, and the tab's title changes).
5. Accept → he **sees the screen live** in a picture at the bottom right (Size: small / medium / large) and both **talk**.
6. A **bar at the bottom** on everybody's page: who is in the call, the time, **Mute**, **Show my screen / Stop showing my
   screen**, **End** (the one who started) or **Leave**. Anybody in the call can show his own screen too.
7. **A click on the picture** shows a red ring with the clicker's name at that place on the sharer's own screen.
8. **"Open this page here: Log Book"** above the picture opens the page the sharer is on in the viewer's OWN app – there he works
   with his own sign-in and his own rights (offered only for a page he has in his own menu).
9. In a call of three or four, everybody hears everybody and sees any screen that is shown (names above the picture to switch).

## What a browser does not allow – and so is not here
* **The viewer cannot click or type in the other person's screen.** That is what 7 and 8 are for.
* **A phone's browser cannot show its screen** (Chrome on Android and Safari on iPhone have no such function). A phone can be
  called, sees the screen and talks. On a computer it is built for and tried in Chrome (Edge is the same engine); Firefox and
  Safari have the same functions but were not tried.
* The pointer (7) works when the sharer shows the app's own tab in Chrome or Edge (the browser tells the app which tab is shown).

## How it works
* **Screen and voices go straight from browser to browser** (WebRTC, encrypted by the browser) – never through our server or
  Vercel. To find a way to each other the browsers ask a public address server (STUN) of Google and of Cloudflare what their
  own address is; the users' network addresses become known to each other's browsers (that is how any such call works).
* **The server carries only the short notes that set a call up** ("who is at the app?", ring, answer, decline, cancel, busy,
  bye). A note is one entry of the existing cache store for 150 seconds, numbered by the store's own counter; every page's
  heartbeat (the "anything new?" every 2 seconds that the app already has) says up to which number it has read and gets the
  notes meant for that user. Users are named to each other by a short code, never by e-mail address.
* A ring is remembered for a few hours, and an answer / decline / bye is taken only from a user who was really rung in that
  call (or from its host) – nobody can make another user's page react to a call that never was.
* Once two browsers are connected, everything else goes over their own data channel: a screen on / off, the pointer, the page
  that is open, leaving.
* The one who starts is the **host**; each guest is connected to the host only, and the host passes on to the other guests
  what one guest sends. That is why 3 guests is the limit (the host's computer and line carry it).
* **Nothing is recorded.** The Activity Log gets one line when somebody joins ("Bala joined the screen share of Sujit") and one
  when it ends ("Screen share of Sujit with Bala ended after 12 min 34 s") – written from what the server itself has seen.
* A new version of the app is not swapped in during a call ("Update now" asks first: "A screen share is on …").
* A user with the app open in two tabs or on two devices: the ring shows in all; answered in one, the others stop ("answered
  in another tab …"); a tab does not ring while another tab of the same browser is in a call.

## Files changed (against live update-71, `d735e05`)
| File | Change |
|---|---|
| `app/Code.gs` | new block "SCREEN SHARE WITH VOICE": `rtcUid_`, `rtcPeople_`, `rtcUsers_`, `rtcSend_`, `rtcBeat_`; `API_`: `rtcUsers`, `rtcSend`; `apiRun_`: the heartbeat's answer may carry `rtc` |
| `server/runtime.js` | `bootKeys`: the counter `RTCN` is loaded with the other keys of a request (so a heartbeat asks the database nothing extra); `IS_QUESTION`: `rtc…` calls are not "saves" |
| `server/page.js` | `isQuestion`: `rtc…` calls are not "saves" (no "your entry is being sent again", no save-once number) |
| `app/App.html` | new block "SCREEN SHARE WITH VOICE" (the `RTC` state and the `rtc…` functions); the button `u_share`; the boxes `rtc_note`, `rtc_in`, `rtc_bar`, `rtc_view`; styles; hooks in `syncNow` / `syncGap` / `showTab` / `rclBusy` (+ `rclBusyWhy`) / `showLogin`; one advice rule and the Settings page description (EN / MR / HI) |
| `app/Index.html` | the frame of the app may show the screen (`allow … display-capture`); "Update now" during a call asks with its own words |
| `test/unit.test.js` | 1 new test (50 in all) |
| `test/browser/screen72.js`, `group72.js` | new |
| `UPDATE_72.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit, none reached it)
The browser tests use real browser pages with separate sign-ins; the browser was started with a pretend microphone and with
"show this tab" answered by itself (nobody is there to press Allow). Picture and sound were checked as packets really arriving
and the picture's clock moving – not only as "a box is shown".

**New**
| Test | Result |
|---|---|
| `screen72.js` – one to one: the list (who is at the app), nothing ticked, ring within seconds (only at the one rung), accept → picture 800×468 moving + sound both ways, "Open this page here" (and NOT for an Admin page the viewer does not have), the pointer at the very place (25 % / 60 %) with the name, the ring gone after 3 s, B shows his screen too, stops, both press "Show my screen" at the same moment, mute, End, the 2 lines of the Activity Log, decline, cancel before the answer, busy, leave, the app open in two tabs (ring in both, answered in one, the other stops; no ring while the other tab is in a call) | 23 passed, 0 failed |
| `group72.js` – three people: not more than 3 can be ticked, both ring, one accepts first and shows her screen, the other joins LATER and gets both screens and both voices, everybody hears 2 voices, the pointer of one guest on the other guest's screen (through the host) and not on the host's, a screen stopped, one leaves and the two go on, End, the 3 lines of the Activity Log, one declines and the other accepts | 13 passed, 0 failed |
| unit: who gets which note (only the users it is for, never the sender, in order, once), a number taken but not yet written (held, nothing lost), **a ring behind notes that are long gone is given at once** (the review's main finding), a counter that started again, what is refused (self, nobody, an unknown user, 4 users, an unknown kind, too long, no call id, an answer / bye in a call one was never rung in), the end of a call written once, only by its host, only with those who really answered, not longer than since the ring | 1 test, passed (suite 50 / 50) |

**What a heartbeat costs the database (measured at the rig's gateway, 40 heartbeats in 2.3 s)**
| | database calls |
|---|---|
| live code (update-71) | 3 (once a second, as designed on 04-10-2026) |
| this code, nothing new | 3 |
| this code, a page of the OLD version asking (no number sent) | 3 |
A page reads the store once more only when a note is new (its next heartbeat), then not again.

**The new app in the OLD shell page** (a browser that has not reloaded the shell since before this update): showing the screen
works there too (checked with the old `Index.html`).

**Nothing else moved** (all on the final code): unit 50 / 50 · saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 ·
audit 36 / 0 · reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known line "backup is not set up" on the rig) · the 28 browser
tests of before: 382 PASS (entry71 19 · item2 13 · lgrows 12 · splittime 18 · half 12 · xls 14 · nightrow 22 · works69 33 ·
timefmt70 6 · rate69 19 · lxlook 10 · lbpage 13 · tm 4 · tmbill 6 · lbbasis 9 · viewbill 23 · billlock 17 · gstdecl 11 · tank 7 ·
hardenpage 10 · least68 9 · debit 5 · dnui 8 · boq 8 · big 18 · fix 8 · retry 10 · sweep 38). With the two new ones: 30 browser
tests, 418 PASS.

Said plainly:
* `hardenpage.js` failed ONE check in one of its three runs ("a page that really died: the note is shown at the next start" –
  the test looks 1.8 s after the page opens); run again twice: 10 / 10 both times. It was 10 / 10 in every run before today.
  I could not tie it to this update (the check is about another feature and passes on the same code), but it is the first time
  it was seen, so it is written here.
* An **independent review** (a reviewer who had not seen the work being made) found one real fault and several smaller ones;
  all were corrected before the runs above:
  * a ring to a page behind another window (it asks the server only once a minute) was held back behind older notes until it
    was too old → notes now stay 150 s and a number is not waited for once a later note is 10 s old (unit test);
  * the notes were sent like "saves" (on a weak line: "your entry is being sent again …") → they are questions now;
  * accepting a ring while the list was open, then pressing "Share screen", could leave a call running unseen → one call at a
    time is checked again after every wait; the list closes on Accept;
  * the bar lay over the app's own messages → the call's boxes lie under every dialog and the help card, the message line is
    lifted while a call is on;
  * "Open this page here" offered an Admin page to a user who is not Admin → only pages of his own menu (test);
  * a tab kept ringing after the caller had given up on a busy user; two sides changing something at the same moment could
    lose one change (test); "ended" lines could be invented and other users' pages made to answer → the server checks every
    note against the ring it has seen (unit test); the pointer is limited to 4 in 3 seconds; a user without a name was shown
    by his address → by its first part.
  * One suggestion was tried and TAKEN BACK: keeping read notes in the server's memory (fewer database reads when many
    pages are open). It gave stale notes after the counter started again. `server/gas.js` is unchanged in this update.

## What was NOT verified – and what will decide whether it works for him
* **Real networks.** On the rig both browsers are on one computer. Whether the office and a site (or two mobile networks) can
  reach each other directly is not known until it is tried. If a call rings and is accepted but then says "could not connect
  … the two networks do not let the computers reach each other directly", a relay server (TURN) has to be added – Cloudflare
  has one (its price page: the first 1,000 GB a month free); that needs an account of his and a key in Vercel, and a small
  update. Not built now (not needed until it fails).
* The live site, real microphones and loudspeakers (echo, loudness), real phones, Windows / Edge, Firefox, Safari.
* More than a few minutes of a call; a line that drops for more than about 20 seconds ends the call (start again).
* A page in a background tab hears a ring only at its next heartbeat – up to about a minute; the ring waits 80 seconds.

## Not built (said, not done)
* **A right per user** ("who may share a screen"): every signed-in user can share with every other. A right in Users & Access
  needs a new column in the users table – a database change, which is asked for separately. Say so if it is wanted.
* Recording; a text chat; a call without any screen from a phone; more than 3 guests (needs a paid media server).

## Going back
Vercel → Instant Rollback → update-71 (`d735e05`). Nothing is stored that update-71 would trip over (the notes are cache
entries that expire by themselves; the Activity Log lines are ordinary lines).

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-72.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-72: screen share with voice between users"
git push
```
Vercel "Ready" → press **Update** in the app on BOTH computers (best: close the tab and open the app again, so that the shell
page is new too) → the screen button at the top.
