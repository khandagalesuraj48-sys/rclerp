# update-137 – Calls between the phone app and the web (with App 3.26.0) (19-10-2026)

**Asked:** "JR SAMAJ EK USER APP WAR AAHE ANI EK USER WEB WAR TRI SUDHA CONNECT HOYLA HAW TE PN PROPER".
**His answers:** "SAGLE KAHI KARTA YAW" (a call comes in on the app, the app calls a web user, the phone's camera, the phone's screen);
the ring also with the app closed (the next step – Firebase); the Android phone app first.

## What changes
* **The phone app (App 3.26.0) speaks the web's screen share:** the same server actions (`rtcUsers`, `rtcSend`, `rtcMissed`, `rtcWa`),
  the same notes with the heartbeat (`sync` {r}), the same data-channel messages. So a web user and an app user call each other both
  ways, show cameras (faces at the side) and screens, chat, end – as two web users do. The server's screen share is not changed.
* **The web says a call from the app as a call:** the app may start a **voice call** or a **video call** (its front camera); the web's
  ring then says "Bala is calling you – voice call" / "– video call" ("A call from the phone app, with voice · nothing is recorded"),
  the tab's title "● Bala – call", a missed one "Missed: Bala called you (voice call)". A screen share from the web or from the app's
  "My screen" is said as before.
* **The notification** of a ring (a web page with notifications allowed – update-75) says the same for a call from the app
  (`rtcSend_` passes the mode to `rtcPush_`; `app/sw.js`).
* The new words in मराठी / हिंदी (`app/i18n/mr.json`, `hi.json`; `keys.json` refreshed).

## Evidence
* **Rig browser test** `test/browser/app137.js` **16 / 16**: the web page (A) with "the app" (B) – a plain page of the same address
  that sends exactly the app's notes and messages through `/api/rpc` with B's sign-in (a Flutter app cannot run here):
  the app's heartbeat (first "just opened", then up to the note read); the web's list shows B "at the app now"; the web rings the
  app (its screen) → the ring comes with the heartbeat → the app accepts with its answer → connected, the app gets A's screen, his
  voice and the roster, the web hears the app; the app shows its front camera → the web sees B's face at the side; chat both ways;
  the app stops its camera → the face goes; the web ends → the app's call ends ("ended"); **the app calls the web (voice)** → the web's
  ring says "B 137 Bala is calling you – voice call | A call from the phone app, with voice …" → accepted, voices both ways; the web
  shows its screen in the app's call → the app gets it; the app ends → the web's call ends; the Activity Log has the joining and the
  end; a **video call** from the app → "– video call"; the web declines with a reply → the app's call ends with reply 2.
  Pictures `test/shots/app137_*.png` (local).
* `both136.js` 12 / 12 and `call135.js` 9 / 9 again (calls between two web pages: unchanged).
* **Unit tests 95 / 95.** `node --check` on `server/*.js`, `api/*.js`, `app/sw.js`; the page's script blocks parse; no secret in the change.
* The app's own engine (rcl-mobile `lib/core/rtc.dart`) has its own tests (with a pretend phone) in the app's build.

## Not verified
* A real Android phone with the web (the app's WebRTC on a phone, its screen share with Android's "Start now", the ringtone, the
  notification "Call is on") – the app's build checks only that it builds and that its tests pass. To try: install App 3.26.0, open
  Home → the call button on the phone and the screen-share button on a computer.
* The ring with the app closed (Firebase) – not built yet.

## Going back
Vercel → Instant Rollback to update-136. Nothing is saved differently (a call from the app is then said as "wants to show you a screen").
