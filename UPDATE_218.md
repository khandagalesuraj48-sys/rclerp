# update-218 – The web lock: 10 minutes without use → the screen locks; fingerprint / face / PIN or the password opens it (no SQL) (10-11-2026)

**Asked:** web security – he chose "**अ – Web lock (शिफारस)**", and on 10-11-2026 the time: **10 minutes**. The phone app (rcl-mobile) has
its own app lock already and is **not changed**.

## No database step
Nothing new in any database. What the lock needs is kept where the app already keeps such things:

| What | Where | Size |
|---|---|---|
| The lock of a sign-in: its last activity and the moment it locked | the sign-in's own value in the site's `web.cache` (`S_<token>`), a 6th part `W<last activity ms>[L<locked at ms>]` | ~30 bytes |
| Wrong passwords on the locked screen, in a row | the exact counter `WLF_<token>` (web.cache, 1 hour) | – |
| The challenge for the device (2 minutes, used once) | `WLC_<token>` and `WLCU_<challenge>` (web.cache) | ~120 bytes |
| **A person's passkeys** (one list for all his sites – the same address = the same passkey) | the **first site's** `app_settings`, row `WL_PK\|<email>`: `[{ id, alg, k: public key (JWK), n: counter, name, at, used }]` | **~290 bytes a device (ES256), ~540 (RS256); at most 10 devices → ≤ 5.4 KB a person** |

Only PUBLIC keys are kept; the private key never leaves the device. An older version of the app reads the sign-in's value exactly as
before (the 6th part is ignored) – going back is safe.

## What changes
1. **The lock (the web page – App.html `wl…`).** 10 minutes with no mouse / keyboard / touch / scroll anywhere on the ERP's screen →
   the screen locks: a panel covers EVERYTHING (also a module's page shown inside Mechanical's screen – Store, Engineering, Purchase),
   what is behind is only hidden and made unreachable (`inert`, `visibility: hidden`): the open page, the forms and what is typed in them,
   the scroll stay exactly as they were. A touch inside a module's page (same address) counts as use. **Waking a computer up after
   longer than 10 minutes:** the first touch locks the screen (it is not counted as use). **Several tabs of one browser** are one sign-in:
   their last touch is shared (`rcl_wl_act`), a lock in one locks the others at once, unlocking in one unlocks the others (`rcl_wl`, the
   browser's "storage" event; a tab that missed it asks the server every 30 s). A tab opened while the screen is locked – a new tab, a
   reload, the Portal's ticket – **starts locked and asks no data**.
2. **The locked screen** (simple; in his language – English / मराठी / हिंदी): the One Click logo, "Screen locked", his name, the site,
   "Locked at 14:32"; **"Unlock with fingerprint / face / PIN"** when THIS device has one set up (else only:) **his password** →
   "Unlock with password"; **"Sign out"** (no question – the confirm box is behind the lock). A wrong password: "Wrong password – tries
   left: 4, then you are signed out."; the **5th wrong password in a row signs him out** (the server ends the sign-in; the page signs out
   of the Portal too). Unlocking goes on **where he was** – no reload, nothing typed lost, the cursor back in its box.
3. **The server keeps the lock (Code.gs `wlGate_`, in `api`, `sysWho_`, `changePassword`).** Every call of the web page says how long ago
   the page was last touched (`act` – the bridge, server/page.js; api/rpc.js → runtime.js `__act`). The server notes it (at most every
   30 s), and while the sign-in is locked – or nothing was heard of its page for longer than the 10 minutes (+ 1 minute for the noting)
   by **its own clock** – it refuses **every** action of that sign-in with `SCREEN_LOCKED` (HTTP 423): the data, saves, the heartbeat,
   the assistant, "another site", the password change. Only the lock's own actions answer (below) and Sign out. **Taking the panel away
   in the browser's tools gives no data** (checked). A "just touched" sent by hand does not open a locked sign-in.
   * A call the server refused because of the lock **waits** in the page and is asked again by itself once unlocked; a **save** that met
     the lock waits in the bridge with its own number (never saved twice – runtime.js gives the number back on `SCREEN_LOCKED`).
   * **Not watched:** a sign-in whose page never says how long ago it was touched – **the phone app** (its own app lock) and a page of
     before this update (it becomes watched once the shell has loaded the new version). The Super Admin's own console of Mechanical
     (the old `sa…` sign-in, without the Portal) is not locked either.
   * The heartbeat answered from a server's memory (gas.js) never writes the activity; a locked sign-in is always read afresh (so an
     unlock is seen at once by every helper thread).
4. **The password.** A sign-in that came **from the Portal** is checked **by the Portal** – checked: Mechanical's copy of a password is
   NOT kept in step with the Portal (a password changed in the Portal is not written to Mechanical; a person made by the Portal has one
   nobody knows – Sites.gs `sysSso_`). So `server/portal.js checkPassword` asks the Portal's own sign-in (`POST <PORTAL_URL>/api/auth`
   action `login` – the same check and limits as a sign-in there) and ends the Portal sign-in it made for that answer at once (`logout`
   with its cookie, which never leaves this server). **No change in rcl-portal.** The Portal's Activity shows a "Login" and a "Logout"
   for such an unlock (a wrong one: "Login failed"). The app's own sign-in (`?local=1`, or no Portal) is checked with this site's kept
   password (`checkPw_`).
5. **Fingerprint / face / PIN = a passkey (WebAuthn), checked on the server** (`server/webauthn.js` – no npm package: its own small CBOR
   reader; the signature with Node's crypto, reached by the app's code only through the narrow hook `__webauthn` – runtime.js).
   * Setting up: `authenticatorAttachment: platform` (the device's own), `userVerification: required`, `attestation: none`,
     ES256 / RS256, the person's handle = 16 bytes of a hash (not his e-mail).
   * Checked every time: the challenge (made by the server, kept server-side 2 minutes, **used once**), the type, the **origin** (the
     address the browser is on – `meta.origin`, from the request: https only, http only for `localhost`), not made inside another site,
     the **RP ID hash** (= the address's host name), **user present + user verified**, the passkey's number, the **signature** (ES256 DER /
     RS256 PKCS#1 v1.5) with the kept public key, the **sign counter** (a lower or equal one – both not 0 – is refused: a copied key).
   * **My settings → Screen lock** (new panel): "Unlock with fingerprint / face / PIN on this device" – **Set up on this device**; his
     devices ("Windows · Chrome", "Android · Chrome" …) with the **date added** and last use, "This device"; **Remove** (asked first).
     At most 10 devices. Which passkeys were made in THIS browser is remembered in this browser (`rcl_wl_pk`) – that is "this device has
     one" (WebAuthn cannot say it without asking the device).
   * The request for the device is fetched beforehand (when the lock shows / My settings opens) – Safari asks the device only straight
     from a press.
6. **Rig only:** a shorter lock time for tests, `RCL_RIG_LOCK_MS` (5 s – 10 min), read only when `VERCEL` is not set – Vercel always sets
   it, so it can never be on there.

## New actions (all in `API_`, all `m: ''` + `withUser`; listed in PAGE_GUIDE `settings.saves`; asked like questions – never "a save sent again": runtime.js / page.js `WL_FNS`)
| Action | What | Allowed while locked |
|---|---|---|
| `lockState` | locked or not, since when, his name, the site, his passkeys' numbers, which password (Portal or own), the lock time | yes |
| `lockNow` | the page locked itself (or opened while locked) – every tab of the sign-in at once | yes |
| `unlockPassword` | `{ password }` – Portal or own check; counted; the 5th wrong → signed out | yes |
| `unlockPasskeyStart` / `unlockPasskey` | the request for the device / its answer checked → open | yes |
| `passkeyList` / `passkeyStart` / `passkeySave` / `passkeyRemove` | My settings → Screen lock | no |

`getInit` and `sync` also answer `lock: { ms }` (the lock time).

## New server messages and their help (FIX_RULES, English / मराठी / हिंदी)
| Message | Help rule |
|---|---|
| `SCREEN_LOCKED: the screen is locked (nobody used it for 10 minutes) – unlock …` | "The screen was locked because nobody used the ERP for 10 minutes …" |
| `Wrong password – N tries left, then you are signed out.` (+ the Portal's 15-minute hold) · `Type your password to unlock the screen.` | "The password typed on the locked screen is not right …" |
| `You were signed out after 5 wrong passwords in a row on the locked screen – sign in again.` | "You were signed out: 5 wrong passwords in a row …" |
| `The password could not be checked just now (the Portal did not answer) …` (not counted as wrong) | "The password could not be checked just now …" |
| `The fingerprint / face / PIN was not accepted (…)` · `… request ran out (2 minutes)` · `… is not set up for you` · `No fingerprint / face / PIN is set up for you` · `… cannot be used on this server` · `… works only on the ERP's own https address` | "The fingerprint / face / PIN of this device did not unlock the screen …" |
| `You have 10 devices with fingerprint / face / PIN already …` · `This device's fingerprint / face / PIN could not be set up (…)` | "The fingerprint / face / PIN could not be set up on this device …" |

The locked screen and My settings show the help line in his language (not the English message).

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – **171 / 171** (main: 170 / 170). New `update-218`, with test vectors made in the test
  (a stand-in device: P-256 and RSA-2048 keys, its own CBOR writer): CBOR values of RFC 8949 and refusals (indefinite, cut short, a key
  twice); the address rules (https; http only for localhost; never 127.0.0.1); setting up ES256 + RS256 accepted, and refused for: another
  challenge, another address, made inside another site, the wrong kind, no UV, no UP, no key, an EdDSA key, a point not on the curve,
  another RP ID, a number that does not match, bytes after the answer; unlocking accepted (ES256, RS256, a device without a counter) and
  refused for: another key, another device with his number, the counter back or equal, another challenge / address, no UV, a changed
  authenticatorData. The lock rules (Code.gs in the harness): a sign-in without `act` (the phone app) not watched and not written; the 6th
  part read exactly as before by `sessionRead_` (also a Portal sign-in's 12 hours); the activity written only every 30 s and never from a
  heartbeat answered from memory (a lock is); locked → 8 kinds of actions refused, the 5 lock actions allowed, a touch does not open it;
  the page's "untouched longer" and the server's own clock (10 min + 1 min; a forged "just touched" does not open); `lockNow`; the own
  password (wrong → "4 tries left", right → open, the Activity Log line), 5 wrong → the sign-in ended; a Portal sign-in: the Portal is
  asked (not reached → not counted; this site's own old password does not open it; "too many" there; right → open); `lockState`; passkeys
  end to end with the real `server/webauthn.js` (set up – options, handle not the e-mail, kept ~290 bytes, the challenge once, no twice on
  one device, RS256 too, a name without < > "; unlock; the counter and last use kept; refused: the same answer again, not his, another key
  with his number, a copied key, another address, a challenge older than 2 minutes; removed → opens nothing; at most 10; not https →
  said). The bridge and the server have one list of the lock's actions; the rig switch is never read on Vercel; help rules for every new
  message. The old tests that pin the page / the bridge pass unchanged (update-102 still finds its line).
* The rig, real server and databases, real Chromium with Chrome's **virtual authenticator** (`test/browser/lock218.js`, **16 / 16**,
  Mechanical started with `RCL_RIG_LOCK_MS=20000`, at `http://localhost`): the Portal sign-in's password checked by the rig's Portal
  (wrong counted, right opens, its Activity "Login failed, Login, Logout"); the lock time from the server; My settings → set up (kept
  266 bytes, "This device", the date); a touch inside a module's page counts (27 s); 20 s untouched → locked: the panel covers the whole
  screen and the module's page, the app hidden and inert, name / site / time, the fingerprint button; the server refuses the data (423)
  also with a forged "just touched", and with the panel removed by hand the page's own call gets no data; a wrong password said; the
  right one → the same page, the typed text and the cursor kept, the module page still there, the waiting call answered; waking up
  after longer locks at the first touch; a wrong passkey refused (another credential of the device; his own with a changed signature);
  the passkey unlock (the counter 1 → 3); several tabs lock / unlock together, a new tab opened while locked starts locked with no data;
  5 wrong passwords → signed out; a new password sign-in starts unlocked; Sign out from the lock; Remove in My settings; no page error.
  Pictures: `/home/claude/test/shots/lock218_settings.png`, `lock218_locked.png`, `lock218_open.png`, `lock218_signedout.png`.
* The existing browser tests that touch sign-in / settings, **main vs this branch on the same rig** (my own copy of Mechanical on :3061,
  so the :3000 / :3001 other work uses were not touched) – **the same results**: `call217.js` 19 / 19 → 19 / 19; `hardenpage.js` 8 / 10
  → 8 / 10; `lang110.js` 2 / 3 → 2 / 3; `set2.js` 2 / 4 → 2 / 4; `settings.js` stops at the same place on main and here. The failures are
  there on main too (these tests are older than the location rule of update-85 / the current page – "excel: null", headless Chrome's
  "Credential Management" error of the saved-password offer, an element they look for).
* Measured – the heartbeat of one page touched "just now", 60 beats (the server's own counter, rig): main **19 ms, 3.37 database calls,
  200 bytes from the database** per beat → this branch **20 ms, 3.42 calls, 262 bytes** (the activity is written about once in 30 s).
* `node --check` on `server/*.js`, `api/*.js` (22 files); the page's 8 script blocks parse; no secret in the change; `AUDIT.md` unchanged.
* NOT run: `test/portal91api.js` / `portal91.js` (portal91api empties the rig's Portal database, which other work used at the same time);
  the Portal path is covered by lock218.js step 0 and the unit test instead.

## Not verified
* **Real devices:** Windows Hello, Android (Chrome) fingerprint, iPhone / iPad / Mac Safari (Face ID / Touch ID) – only Chrome's
  virtual authenticator here. Safari in the app's frame (the app runs inside a same-origin `srcdoc` frame of the shell; Chrome allows
  WebAuthn there – checked; Safari not tried). The Windows app's web view: not tried.
* The live sites and the live Portal (the Portal's sign-in endpoint is asked by Mechanical's server as on the rig).
* The real module pages (Store, Engineering, Purchase) inside the screen: the test used a page of the same address in the module frame
  (the same mechanism); their own servers do **not** know the lock (see the owner's points).

## For the owner to confirm
1. **5 wrong passwords → signed out** (the same 5 as a sign-in). With the Portal, its own rule then also holds his Portal sign-in for
   15 minutes (5 wrong in 15 minutes) – the fingerprint still works until then. Keep 5?
2. **The Portal's Activity** shows "Login" / "Logout" for each password unlock (Mechanical's Activity Log says "Screen unlocked with the
   password"). A small Portal action "check the password" (no sign-in made, its own Activity words) would be cleaner – a Portal change.
3. **What the lock does NOT cover** (it is Mechanical's): a module opened on its OWN in another tab (`/store/`, `/engineering/`,
   `/purchase/`) and the Portal's own page (`/portal/` – the Super Admin's console too) sign in by themselves with the Portal's cookie
   and are not locked. Inside Mechanical's screen the panel covers them, but their own servers do not refuse while locked. Closing this
   needs the Portal to know the lock (its ticket refused for a locked browser) – a Portal change, to be decided.
4. Someone with the browser's tools could still clear this browser's storage and get a NEW sign-in through the Portal's cookie (the
   lock is kept per sign-in; a new sign-in starts open). Same fix as point 3.
5. A browser that has his password saved offers it on the lock screen too (as on the sign-in screen) – the fingerprint / face / PIN is
   the safer way.
6. **A screen share call** (update-72) does not count as use: a person who only watches a shared screen for 10 minutes without touching
   gets the lock (the call goes on behind it). Should a call that is on keep the screen open?

## Going back
Vercel → Instant Rollback. Nothing in any database to undo: the sign-ins keep working (the 6th part of their value is ignored by the
update before); the `WL_PK|…` rows of `app_settings` are simply not read.
