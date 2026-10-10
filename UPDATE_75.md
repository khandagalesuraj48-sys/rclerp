# update-75 – screen share, "master level": 13 features at once, built with security in mind (10-10-2026)

Asked by the owner on 10-10-2026, after update-74 went live (`45020f9`). I listed 13 screen share features; he answered:
"build all of this at once, perfectly, with logic – think of security".

No database step (no SQL, no new table – the new data is kept as rows of the existing app_settings / cache store). Nothing
to set in Vercel. Live is update-74 (`45020f9`); built and tested on the local rig only – nothing was pushed, deployed or
run against the live database.

## The 13 features – what the user sees
**A. The call reaches the user**
1. **Calls when the app is closed (notification).** Each user turns it on once per device: a question comes ~20 s after a
   sign-in ("Get screen share calls even when the app is closed? Turn on / Not now"), or Settings → This app →
   "Screen share calls when the app is closed" → Turn on. A ring then shows as a notification of the phone / computer
   ("Sujit wants to show you a screen") – it stays until tapped; a tap opens the app and the ring is there. Not answered:
   "Missed: Sujit wanted to show you a screen". Answered on another device of the same user: the notification there goes.
   Works in Chrome and Edge (Android, Windows); on iPhone only when the app was added to the Home Screen.
2. **WhatsApp.** Not answered after 15 seconds → "S75 Bala has not answered yet. [Ask on WhatsApp]" – opens WhatsApp with
   his "My mobile number" (Settings) and a ready message "Sujit wants to show you a screen in the Fleet ERP app … open the
   app: <link>". Shown only when that user has set a mobile number.
3. **Missed calls, Call back, Reply.** A call that was not answered shows as a red number on the screen button and a line
   after sign-in; the "Share my screen" box lists "Missed calls" with **Call back** (ticks that user) and Clear. The ring
   box has **Reply…**: "I will call you back in 5 minutes" / "In a meeting – later, please" / "Please call me on the
   phone" – the caller reads it.

**B. Help**
4. **"Show this to the Admin (screen share)"** on every red message (for a user who is not Admin, in the language of the
   help): it opens the box with the Admin(s) ticked and the message shown; the Admin's ring says "Bala needs help –
   wants to show you a screen" with the page and the message.

**C. From a site**
5. **Camera.** "What to show": My screen / **My camera** / Only my page. A phone shows its back camera (More → Switch
   camera, Light where the phone has one). A phone can now START a share and ask for help (camera or page).
6. **Snapshot** (on the picture): a PNG of what is shown, saved on this device only.

**D. A weak line**
7. **A line that drops is made again by itself** (up to 40 s: "connecting again…", then "Connected again with …").
8. **The network's state** in the bar ("Network: good / weak / poor") and **More → Low data** (the picture becomes
   smaller and slower – 150 kbit/s, 5 frames a second – the voice stays); it switches on by itself when the line is poor.
9. **"Only my page" – no video:** the others' app opens the page the sharer is on, as he moves and scrolls – each with
   his OWN access (a page he has no right to is not opened: "… (a page you cannot open)"). "Stop following" in the bar.

**E. Explaining**
10. **Pen:** the viewer draws on the picture; the lines show on the sharer's own app for 10 seconds, with his name; Clear.
11. **Chat** in the call: text and photos (a photo is made small, JPEG); not saved – gone when the call ends.

**F. The Admin**
12. **Who may use screen share:** Users & Access → "Screen share – who may use it" (everybody ticked; Admin users always
    may). Unticked: he can neither show nor be called ("Screen share is switched off for you – the Admin can switch it
    on in Users & Access"). Written in the Activity Log.
13. **History:** Activity Log → **Screen share calls** – joined, ended (how long), declined (with the reply), did not answer.

## Security – how each part is protected
* **Notifications** (Web Push): the message is **encrypted for that one browser** (RFC 8291) and **signed with the site's
  key** (VAPID, RFC 8292). The site's key is **made from the server's existing secret** (one-way) – nothing to set,
  stored nowhere, never leaves the server. The server writes **only to the browser makers' push services** (Google,
  Mozilla, Microsoft, Apple – a fixed list; no redirects followed), so a forged "device" cannot make it call any other
  address. What passes through the push service: the caller's name, a call code, and (for help) the page name – the error
  text itself stays in the app. A device belongs to one user: when somebody else signs in on it, it moves to him; on
  Sign out it is removed; a device the push service calls gone is forgotten.
* **Limits against misuse:** at most 8 new calls a minute and 40 an hour per user; one notification per caller and person
  in 20 seconds; WhatsApp numbers only for a user THIS user has rung in the last 3 minutes and who has not answered or
  declined (10 an hour) – the numbers cannot be collected; turning notifications on at most 20 times an hour.
* **Everything that comes from another browser is shown as text**, never as page code (names, help text, chat, page
  names); a chat photo must be a JPEG; chat is limited to 15 messages in 10 seconds, 500 letters, 200 KB per photo; the
  pen draws only points between 0 and 1, at most 12 lines in 5 seconds, and only on the sharer's own app tab; the host
  passes on what a guest sends under the guest's own name (nobody can write as somebody else).
* **Rights are checked by the server:** a user switched off cannot ring, be rung, or even get the relay's keys; the
  reconnection notes are accepted only between a host and a guest of that very call.
* **Nothing of a call is recorded or stored** on the server: chat, photos and snapshots stay on the devices.
* The camera is allowed for this site only (header `camera=(self)`, before `camera=()`); it starts only on a button.
* An **independent review** (a reviewer who had not seen the work) found no blocker and confirmed the points above. It
  found ways to misuse it, all corrected before the final test runs: a loop of rings and cancels could flood phones with
  notifications (→ the limits above), mobile numbers could be collected by ringing everybody (→ 3 minutes, not answered,
  10 an hour), the notification stayed on a user's other devices after he answered (→ "answered on another device"),
  a user switched off during a ring could not be cancelled (→ fixed), a switched-off user still got the relay's keys
  (→ not any more), the rights list was read from the database on every note (→ kept a minute), a user who was not
  active lost his "switched off" at the next save (→ kept), the help button was offered to a switched-off user and on
  screen-share messages (→ not), the test door for the rig's push stand-in is refused on the live site even if set,
  leftovers after the app replaces itself in the frame (→ cleared).

## Files changed (against live update-74, `45020f9`)
| File | Change |
|---|---|
| `app/Code.gs` | screen share block: rights (`rtcOff_`, `rtcRights_`, `rtcRightsSave_`), waiting rings (`rtcPendAdd_`, `rtcPendDrop_`, `rtcPending_`), missed calls (`rtcMissed_` …), replies, WhatsApp (`rtcWa_`), notifications (`rtcPushKey_`, `rtcPushSave_`, `rtcPushOff_`, `rtcPush_`), ring limits, `re` notes; 7 API entries |
| `server/runtime.js` | WEB PUSH: the site's key from the existing secret, encryption (RFC 8291), signature (RFC 8292), the list of push services, sending (5 s at most) |
| `server/syncfetch.js` | a request may say "do not follow a redirect" (used by the push requests only) |
| `app/App.html` | the new parts of the call (list: what to show, missed calls, help; ring: Reply; bar: network, Chat, More; picture: Pen, Clear, Snapshot; chat box), notifications, follow, pen, chat, low data, reconnect; "Show this to the Admin" on the red message card; Users & Access → Screen share; Activity Log → Screen share calls; Settings → This app → notifications line; help texts (EN / MR / HI) |
| `app/sw.js` | the notification (ring / missed / answered elsewhere) and the tap on it |
| `app/Index.html` | the app's frame may use the camera |
| `vercel.json` | `camera=(self)` (was `camera=()`) |
| `test/unit.test.js` | 1 new test (52 in all); the header test now expects `camera=(self)` (on purpose – the app uses the camera now) |
| `test/browser/master75.js`, `media75.js`, `push75.js` | new |
| `test/browser/version74.js` | waits for the version box to be filled again (it read it too early once the Settings page had one more line) |
| `UPDATE_75.md`, `HANDOVER.md` | notes |

## Evidence (local rig; every command with a time limit, none reached it)
Real browser pages with separate sign-ins; a pretend microphone and camera; "share this tab" answered by itself.
| Test | Result |
|---|---|
| `master75.js` – a ring waiting when the app is opened later (as from the notification) → accepted; Reply… "In a meeting" → the caller reads it; not answered → after 15 s "Ask on WhatsApp" with her own number and the app's link; she opens the app later → red 1, "Missed screen share: Sujit", the list with Call back (ticks Sujit), the red number goes; a red message → "Show this to the Admin" (not on the Admin's page, in the help's language) → the box with the message, the Admin ticked → the Admin's ring "needs help" with the page and the message → he sees the screen; Users & Access: Dev switched off → "switched off for you", nobody can pick him, Activity Log line; Activity Log → Screen share calls: joined / ended / declined (with the reply) / did not answer; no script error | 13 passed, 0 failed |
| `media75.js` – three people: what to show (screen / camera / page), "wants to show you a camera", Camera of Sujit at both; "Network: good"; Switch camera without a new call; Snapshot (PNG on the device); "only my page": no picture, both apps open Log Book, scroll follows, an Admin page is NOT opened ("a page you cannot open"), Stop following; the pen: a line drawn by Bala shows in red on Sujit's own app at the same place, Clear, nonsense points draw nothing; chat to both (through the host), a message that looks like page code stays text (nothing runs), an SVG / javascript "photo" refused, a real photo arrives as JPEG, 30 messages at once → at most 15 taken; Low data: Sujit's picture to Bala only at 150 kbit/s; a line made again ("Connected again", voice goes on); a phone's box offers camera / page | 21 passed, 0 failed (run 3 times on the final code: 21, 21; one earlier run had 1 failure – the page NAME in the "Following …" line was the previous page once; the line is now named from the follower's own menu) |
| `push75.js` – the site's key; a device saved; an address that is not a push service refused (no calling other servers); a ring reaches the stand-in push service signed (ES256, the right audience, ≤ 12 h) and encrypted (opened with the device's keys); a gone device (410) forgotten; "missed" when given up; signed out = not his device any more; the service worker shows "P75 Bala wants to show you a screen – Needs help – Log Book …", it stays; a tap closes it and tells the open app; Settings line | 9 passed, 0 failed |
| unit – who may use it, the waiting ring, missed list (answered / declined / given up – at once), the reply in the Activity Log, WhatsApp only for a user just rung (and not after 3 minutes / once answered), notifications only to push services, a device moving to the user who signed in on it, gone devices, "re" only between host and guest, and the review's points (other devices told, 20-s and per-minute limits, a user switched off during a ring, a user not active keeps "off", no relay keys when off) | 1 test, passed (52 / 52) |
| encryption checked with an independent library (http_ece decrypts what the server sends) | passed |

**Nothing else moved** (on the final code unless said): unit 52 / 52 · saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 ·
backup 28 / 0 · audit 36 / 0 · reg 11 / 0 · restore-drill 7 / 0 · dn 13 / 1 (the known line "backup is not set up" on the rig) ·
browser: screen72 23 / 0 · group72 13 / 0 · relay73 7 / 0 · version74 9 / 0 · sweep (every page) 38 / 0 · entry71 19 / 0 · least68 9 / 0.
(screen72, group72, relay73, sweep, entry71, least68 and harden … restore-drill ran before the last change – the follower's line
naming the page from its own menu; version74's test was corrected to wait for the box to refresh – it read the box too early.)
saveonce failed one check in one run because my relay test server was using the port that test starts its own server on
(3009); with the port free: 44 / 0. Not run again: the other Log Book / bill / diesel browser tests of `UPDATE_72.md` – this
update touches only the screen share, the red message card (one more button), Users & Access (one more panel), the
Activity Log (one more button and module), Settings (one more line).

## What was NOT verified – said plainly
* **A real notification on a real phone / computer.** The rig cannot reach Google's, Microsoft's or Apple's push services.
  What was proven: the server's message is correctly encrypted and signed (a stand-in push service opened and checked
  it the way a browser and a push service do; separately an independent library – http_ece – decrypted it), and the app's
  service worker shows the notification and opens the app when it gets a push (Chrome's own test door). "Turn on" itself
  (the browser asking Google for a subscription) cannot be done on the rig.
* A real phone camera, the Light (torch), Switch camera between two real cameras; a real line that drops (the reconnect
  was forced on a working line); WhatsApp opening on a phone; snapshots saved on a phone; iPhone; Firefox / Safari.
* The live site.

## Going back
Vercel → Instant Rollback → update-74 (`45020f9`). What this update stores (app_settings rows `PUSH|…`, `PUSHE|…`,
`RTCMISS|…`, `RTC_OFF`; cache entries `RTC…`) is ignored by update-74. After a roll-back the browsers keep their
notification permission; a ring then simply does not send notifications.

## To deploy (owner; no SQL, nothing to set in Vercel)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-75.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-75: screen share master level - notifications, WhatsApp, missed calls, help, camera, chat, pen"
git push
```
Vercel "Ready" → on every computer / phone: close the app and open it again (the shell page and the camera permission
are new) → Settings → This app → **Turn on** (once per device) → users fill **My mobile number** in Settings (for WhatsApp).
