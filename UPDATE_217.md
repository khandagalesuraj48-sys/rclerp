# update-217 – Calls from any site to anyone of any site (no SQL) (09-11-2026)

**Asked:** "ajun ek call apla work krto but both user same site war asayla lagtat tr as nko user online asla ki bas zal call lawta yeil
mgg to kuthe pn aso mhanje a user vtr ani b user 18 or ho kuthe ka asena call lawata ala pahije". His answer: **every site's online
users, with their site's name** ("सर्व sites चे online users"). With **rcl-mobile 3.92.0**.

## No database step
Nothing new in any database. The first site's existing store (`web.cache`, its counter `web_count`, its `app_settings`) is used.

## What changes
1. **One exchange for the calls of every site.** Every note of a call (ring, answer, decline, who / here, bye …), its counter and what
   is remembered of a call (rung, answered, the rings still waiting) are now kept at the **first site's** store. A page of any site
   reads its notes there – so a user of VTR rings a user of 18B or HO exactly as he rings one of his own site.
   * At the first site itself nothing changes (its own store, as before).
   * Another site reaches it through `server/gas.js makeHome` / `runtime.js __rtcX` (Code.gs `rtcC_`, `rtcCount_`): read when asked,
     written in one call at the end of the request. The first site's counter is kept in each server's memory for **one second** (every
     open page asks every 2 s – so a server asks the first site about once a second, as it asks its own site for the heartbeat); a note
     once read is kept in memory until it runs out (forgotten if the counter ever starts again). The heartbeat's reads try once, for
     2.5 s at most: a slow first site never holds a heartbeat up (and a call note never stops the heartbeat – as before).
2. **The list to pick from:** this site's people as before, then **the people of the other sites, each with his site's name** –
   "Kiran (18B)". Each site's own users and its own "Screen share" rights (an Admin of 18B switching it off for a user of 18B counts
   everywhere). Asked from the other sites (`sysRtcPeople_` – names and rights only, never an e-mail address; added to `OTHERS_`) and
   kept a minute; a change of the rights is seen at once. On the web and in the app **a user of another site is shown while he is at
   the app** (online, or ticked); "Show this to the Admin" still ticks this site's Admins only.
3. **Names say the site:** a ring, an answer, a missed call, the phone's notification and the Activity Log say "Hari (HO)" when the
   other person is of another site.
4. **Missed calls and a browser's notifications** are kept at the first site (so a call of any site reaches them). A browser's
   notifications saved at a site before this update are still used there and move to the first site the next time that browser
   signs in. Missed calls of before this update at another site are not shown any more (they are kept 3 days only).
5. **The phone app's notification of a call** says it can be answered from any site (`x: 1` – `server/fcm.js`): the app 3.92.0
   answers where it is, without opening the caller's site.

## Evidence
* Unit: `timeout 600 node --test test/unit.test.js` – **170 / 170**. New `update-217` (a stand-in for the first site's store): each
  site's people as another site asks them (no e-mail); the list at VTR – "Hari (HO)", "Kiran (18B)", the user switched off at 18B not
  there; Bala (VTR) rings Kiran (18B): the note in the first site's store with its site, the counter there, the phone says "Bala (VTR)"
  and `x: 1`, the missed list at the first site; at 18B Kiran's heartbeat gets it, also as a waiting ring; he answers Bala (not a user
  of 18B); the Activity Log; Bala gets the answer "Kiran (18B)"; who / here across sites; refused: a user switched off at his site, an
  unknown code; a missed call of HO's Hari kept at the first site, shown at HO with Call back; **the first site writes to its own store
  as before**; a browser's notifications – one saved at VTR before still used, moved to the first site at its next save, sent once;
  the rights changed → the kept list dropped. The tests that list `OTHERS_` and the server's door updated; the update-216 test now puts
  back the list of users it replaced.
* The rig, two sites (S1 = the first site, T2), real server and databases (`test/browser/call217.js`, **19 / 19**): Hari (S1 only) and
  Kiran (T2 only) see each other on the list with the site's name; rings both ways, answer, who / here, a missed call with Call back;
  T2's own store holds no call note; the missed list at the first site; **the same site still works** (Kiran → Lata at T2, Hari → Sujit at
  S1); a heartbeat at T2 ~15 ms; **real browsers**: Hari's list shows "Kiran Far (Test Site T2)" once he is at the app, Kiran's page
  (T2) rings "Hari Home (VTR Site – NH 848) wants to show you a screen", he accepts, sees Hari's screen and they hear each other; no page
  error. Everything it added taken away after.
* `node --check` on `server/*.js`, `api/*.js`; the page's 7 script blocks parse; no secret in the change.

## Not verified
* The live sites (a real call between two real sites); a real phone (app 3.92.0 is built and tested by GitHub Actions).
* The old browser test `screen72.js` was not run (it makes users through Users & Access, which the rig's Super Admin set-up refuses); the
  same-site calls are checked by the unit tests of update-72 / 75 and by `call217.js`.

## Going back
Vercel → Instant Rollback. Nothing in any database to undo (the call notes are short-lived; the missed calls / notifications written at
the first site are simply not read by the update before).
