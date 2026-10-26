# update-161 – The phone app's notifications at once through Firebase, the app open or closed (26-10-2026)

**Asked (26-10-2026):** "ok ata push notification chalu kru"; then "mala app war pratek gostich realtime notification jayla haw
app band aso ki chalu app updet pasun te sagle kahi ok". The Firebase project **RCLERP NOTIFICATION** (`rclerp-notification`, in
the myrachana.com organisation, Spark – free) with the Android app `in.rachana.rcl.rcl_mobile` was made by the owner.

**No database step. No entry, stock, bill or permission rule changes.** The phone's Firebase address is kept in `app_settings` of
the FIRST site (the table every site already has), beside the list of sites.

## What changes
### The server
* **`fcmSave` / `fcmOff`** (any signed-in person, for his own phone – `API_`): the phone app gives its Firebase address when it is
  at a site, and takes it off at Sign out. `server/fcm.js` keeps it at the first site: `FCM|<person>` (his phones, at most 6, the
  newest first) and `FCMT|<fingerprint of the address>` (whose phone it is). **One phone = one person:** another person signing in
  on it takes it over (as the web's notifications, update-75). A wrong address: "Notifications: the address of this phone for
  notifications is not valid – close the app and open it again." (help rule in `FIX_RULES`, English / मराठी / हिंदी); more than 30
  in an hour: refused.
* **`rtcPush_`** (everything the web is told – a call's ring / answered / missed, every verification and approval notification,
  the reminders) **also goes to the person's phones** through Firebase (FCM HTTP v1): a DATA message (the app shows it in the
  person's language) with **the site it is from**, HIGH priority, a ring 60 s (one per call), answered 2 min, the rest a day. It
  goes even when no browser of his has notifications on. A phone Firebase says is no longer there (404 / UNREGISTERED) is
  forgotten. It never throws – a notification never stops a save.
* The ring also carries `from` (who rings – a 16-letter id, not his e-mail) so "Decline" on the phone's notification answers him.
* **The key:** `FCM_SERVICE_ACCOUNT_JSON` in Vercel → Environment Variables (Production) – the file Firebase gives (Project
  settings → Service accounts → Generate new private key), pasted whole. Not set: nothing is sent (as before). **A Preview never
  sends.** Only Google's two addresses are called (`oauth2.googleapis.com`, `fcm.googleapis.com`); the test rig's stand-in
  (`FCM_TEST_URL`) is refused on the live site even if it were set there. README lists the setting.

### The phone app (rcl-mobile 3.42.0, its own pull request)
* Firebase Cloud Messaging: the phone is given at a site (once a day), taken off first at Sign out; the messages shown at once with
  the app open or closed – a call rings (Answer / Decline), missed calls, verification and approvals (pressed: Approvals at that
  site), and **"RCL ERP <version> is ready"** to every phone when a version is released (the release itself sends it – the GitHub
  secret `FCM_SERVICE_ACCOUNT_JSON`). The 15-minute check stays (nothing is missed if Firebase is ever late; the same thing is
  never told twice).

## Evidence
* `timeout 300 node --test test/unit.test.js` → **114 / 114 pass** – new: the actions (wrong address refused, his phone, off),
  `rtcPush_` hands every notification on (a ring 60 s, an approval a day) also with no web push at all, a failure never stops a
  save; `server/fcm.js` against a stand-in of Google in its own process: Google's permission asked once with a signed request
  (checked with the public key), one message per phone, only text in the data, the site, HIGH / 60 s / one per call, a body cut at
  400, at most 6 phones, a phone taken over by another person, signed out = off, a gone phone forgotten, **nothing to the stand-in
  on the live site** (only Google's address is tried), nothing in a Preview, nothing without the key.
* **The local rig** (Postgres + PostgREST + the door, the Portal, Mechanical :3000 / :3001 with the test stand-in of Google on :3997
  and a TEST key made on the rig – never a real key), `test/fcm161api.js` → **8 / 8**: a wrong address refused with the plain
  message; the phone given at S1 kept only in the first site's database (T2's has none); a ring at S1 → one data message to it (the
  caller, `from`, the site S1, HIGH, 60 s, one per call, the project of the key); the caller gave up → "missed" to it, and a second
  phone Firebase calls gone is forgotten; **a ring at T2 reaches the SAME phone with the site T2**; another person signs in on the
  phone → the first person's "missed" does not reach it; signed out → off.
* The older rig tests of calls and verification (`push75`, `master75`, `call135`, `flow114`, `flow116`) give **exactly the same
  results on main and on this branch** on today's rig (they need set-ups of their own that today's rig does not make – not from
  this change).
* The Portal's `test/api.test.js` on the rig: **111 / 111** (with the rig's seed step `seed_portal.js` – it had been left out of the
  update-160 runs: that note's "99 / 12, the same on main" was the rig's missing seed, not a fault).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change (the rig's test key lives
  only in the scratch folder of the test computer).

## Not verified
* Real Google and a real phone: the rig cannot reach Google; the first real message goes when the key is in Vercel and the app
  3.42.0 is on a phone.
* iPhone: not yet (needs the Apple account's push key).

## Going back
* Vercel → Instant Rollback to update-160. Nothing in the database to undo (the `FCM|…` rows in `app_settings` are only read by
  this update; they can stay). Removing `FCM_SERVICE_ACCOUNT_JSON` stops every phone notification at once.
