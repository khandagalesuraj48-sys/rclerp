# update-215 – The Pump bill photo of a fill at HO; the tyres & batteries in the Maintenance Log Book (08-11-2026)

**Asked:** the features for HO and every site – "ata he sagle ek sath bana ani ha ho sathi pn ani other site sathi pn he hawe aahet".
**This is step C** (features 7 and 9): the HO fill's odometer + bill photo, and tyre & battery records. **No database step.** With
**rcl-mobile 3.90.0**. Comes after update-214 (this branch is on top of it – merge update-213, then update-214, then this).

## What changes
1. **A fill at a site on fuel cards (HO) – the Pump bill photo** (`PHOTO_KINDS_.bill`): the Diesel Issue form shows a 5th tile **"Pump
   bill"** next to Dashboard (the odometer – read by the AI as before), Vehicle + driver and Dispenser litres. Taken with the camera, kept
   with the fill, seen with the fill's photos – exactly as the other photos (the same private store, the same checks). Not compulsory. A
   site with its own diesel stock has no pump bill: the tile is not shown there and the server refuses it ("The Pump bill photo is only for
   a site on fuel cards (a fill at a pump).", help in 3 languages).
2. **Maintenance Log Book → Tyres & batteries** (every site, web and app): nothing new to fill in – every line of a bill (or of the RCL
   Store's outward to the machinery) whose work / part names a **tyre** or a **battery** comes in this list by itself, **not a repair of
   one** (puncture, repair, alignment, balancing, rotation, charging, water, check, cleaning, fitting, labour, air …). Each: date, Tyre /
   Battery, the line as written, Qty, party / bill, what was paid (with its GST; a Warranty / FOC line its kind, ₹ 0), the machinery's
   reading on that bill, **how far it has run since** (its last reading – a fill or a Log Book Close) and how long ago.
3. The page help of the Maintenance Log Book (3 languages) says so.

## Evidence
* Unit: `timeout 500 node --test test/unit.test.js` – **168 / 168**. New `update-215`: which lines are a tyre / a battery (12 cases – a
  puncture, a repair, an alignment, a battery charging / water are not); a bill of a tyre with GST 18 % (35,400 for 2), a puncture, a
  battery on warranty, and a battery from the Store: listed with the reading then and the run since (1,250 / 1,050 km), only in the dates;
  the Pump bill photo refused at a site with stock and taken on to the usual checks at a site on fuel cards; the page's tile rule and its
  table. The photo kinds of the page and the server stay the same list (the old test, now with "bill").
* The rig in Chromium (`scratchpad/hod/web215.js`, **14 / 14**): S1 – a test machinery, a bill (tyre ₹15,000 + GST, a puncture, a battery),
  a Log Book day after: the log book lists the tyre ₹17,700 and the battery, 320 km run since, 5 days – not the puncture; the Pump bill
  photo refused there. T2 put on fuel cards as HO: a Pump bill photo taken and saved with a fill, seen as "Pump bill" with its link; the
  HO fill form shows Dashboard, Vehicle + driver, Dispenser litres, Pump bill (no Register); no page error. Everything put back after.
* `node --check` on `server/*.js`, `api/*.js`; the page's 7 script blocks parse; no secret in the change.

## Not verified
* The live sites' real bills (how their lines are written – a line that names a tyre in another way, e.g. only a size, is not listed).
* A real phone's camera for the Pump bill (the app's form is tested on GitHub).
* The second part (vehicle booking, toll / FASTag) – needs a database step; shown before it is built.

## Going back
Vercel → Instant Rollback. A fill saved with a Pump bill keeps it in its photo list; the update before does not show that kind.
