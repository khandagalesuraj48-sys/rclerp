# update-213 – Vehicle alerts at every site: papers, service, more diesel, a fuel card low; the morning message (08-11-2026)

**Asked:** the features for HO – "ata he sagle ek sath bana ani ha ho sathi pn ani other site sathi pn he hawe aahet" (all ten, HO and
every other site). His answers: a booking is approved by a new right; toll: by hand + the statement; **the alerts go to the site's Admin
and the Super Admin**; released straight to everybody once merged. Built in steps – **this is step A** (alerts: features 1, 2, 5, 6).
**No database step.** With **rcl-mobile 3.88.0**.

## What changes
1. **The alerts** (`app/Code.gs`, "VEHICLE ALERTS (update-213)"), for every machinery on site today:
   * **Papers** – Tax, PUC, Permit, Fitness, Insurance of an Own machinery (Vehicle Compliance's own list): expired, or due within 30 days.
   * **Service** – Asset Master → **Service every** KM / Hrs / months. From the newest maintenance bill marked **Service** (its date and
     reading) and the machinery's last reading (its diesel issues and Log Book Close): **overdue**, or **due** within 10 % of the interval
     / 15 days; "no bill marked Service yet" when a rule is set and none is marked.
   * **More diesel** – this month's Actual vs Standard Average: "More diesel" (over 10 %) or "Bad" (over 30 %), exactly as the report.
   * **A fuel card** (a site on fuel cards) whose balance is below its **Alert below ₹**.
   * `getVehAlerts`: each part only for a person who may see it – papers: Vehicle Compliance / Asset Master; service: Maintenance / Asset
     Master; diesel: Reports / Dashboard; cards: Fuel Cards (checked on the server).
2. **Asset Master → Service every** (web and app): three boxes – KM (a machinery on KM), Hrs (on Hrs), months; empty = no reminder.
   Kept as a setting of the site (`app_settings SVC_RULES`) **written with the Asset Master save** (one transaction – `kvInSave_`);
   checked before anything is written; shown in "Update …?" before the save; follows a changed number in the same save; goes with a
   deleted machinery. The boxes typed win over the machinery's own rule sent back as it was read.
3. **Fuel Cards → Alert below ₹** (web and app): optional; the card turns red "Low – below ₹…" when its balance is under it.
4. **The web Dashboard** (every site): "⚠ Vehicle alerts" at its top – the counts, opened: each machinery with its alerts (red: expired /
   overdue / bad; amber: due / more diesel), the low cards. HO's car gallery: each car's alerts under its name. Read again when the data
   changes (at most once a minute otherwise).
5. **The morning message**: the heartbeat (any open page or phone) sends it **once a day after 08:00** to the site's Admins and the
   Super Admin (Firebase – `crNotify_`): "Vehicle alerts – n machinery: … paper(s) expired / due · … service(s) due · …".
6. Help in 3 languages for the new messages (`FIX_RULES`).

## Evidence
* Unit: `timeout 450 node --test test/unit.test.js` – **166 / 166**. New `update-213`: Service every refused when not a whole number in
  range or for the other meter (nothing saved); kept with the save; the alerts – 500 KM left of 10,000 = due, a rule with no Service
  bill, an expired Insurance, a PUC due in 10 days, more diesel – the worst first; serviced again: nothing; each part only for whom may
  see it; a renamed number keeps its rule (with and without the boxes); the typed boxes win; a deleted machinery drops it; the
  morning message not before 08:00, once a day, to the Super Admin; a card below its amount (only with Fuel Cards); the page's boxes.
* The rig in Chromium (`scratchpad/hod/web213.js`, **15 / 15**): S1 – Service every and an Insurance of yesterday saved; refused
  (too small, the other meter); getVehAlerts; the Dashboard's box with its counts and the row; the Asset Master form shows the rule; a
  change through the page shown first and saved; phone width with no sideways scroll; no page error; set back. (It found the "typed
  boxes win" fault – fixed and tested.)
* `node --check` on `server/*.js`, `api/*.js`; the page's 7 script blocks parse; no secret in the change.

## Not verified
* The live sites and their real data; the morning message on a real phone (the Firebase key is live only).
* Steps B (driver-wise, maintenance in the cost sheet) and C (HO fill photos, tyre / battery) and the second part (booking, toll) –
  not in this update.

## Going back
Vercel → Instant Rollback. The service rules stay in `app_settings SVC_RULES` and a card's `lowAt` stays with the card – the update
before does not read them.
