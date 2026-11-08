# update-154 – the Log Book entry's new look, for its three ways of entering (web only) (24-10-2026)

**Asked (24-10-2026, with three pictures):** "mi tula ui redisgn krayla sangnar aahe fkt web sathi he app sathi nahi ok aple app
cha logic samjun ghe ani aplela proper ashi ui banaw log book entry madhe 3 type aahet tya 3 ni type sathi perfect ui banaw"
(redesign the Log Book entry for the web only – not the phone app – for its three types). The design was shown first and
approved ("ok"); then "test zale asl tr pr de".

**Only the look.** Every field, figure, check, save and permission of the page is the same: the same inputs (`data-f`), the same
outputs (`data-o`), the same classes the code reads, the same server actions. No server change, no database step, no phone-app
change.

## What changes (app/App.html – markup and styles of the Log Book entry)
* **The head** says which way of entering is open (its name and one line on how it works) and "Change entry type" has an icon.
* **Choosing the way:** the three ways as cards with an icon (One date – many machinery; One machinery – many dates; Water tanker
  – trip by trip).
* **One card per row** (both "one date" and "one machinery" ways – the same row): on top the machinery (one date) or the date (one
  machinery) with the machinery's type and owner under it, the shift, ½ day and the row's buttons (📎 Attachments, Debit, ×); then
  "Measured by" (the same chips); then three parts side by side:
  * **Reading** – Start / Close / Total for KM and Hours; From / To / Total for Time (two parts too: the second From / To and
    their hours under the first); the status ways (Idle, Holiday, Breakdown, Day) show only what they need; "No reading" shows its
    reason under it. Before "Measured by" is picked the part says "Pick the machinery first." / "Pick “Measured by” above."
  * **Diesel (Ltr)** – Opening, Issued, Consumed, Closing; the standard and the average (fill to fill) under them.
  * **Work** – Chainage From / To, Work done; "Debit to (party)" and Rate when Debit is pressed (as before).
  On a narrow screen the parts go two side by side, on a phone one under the other.
* **One machinery – many dates:** the facts of the picked machinery on top – its number, type and name, Owner (ownership), Works
  on, Standard (km/L, L/hr – "Not set" when not set), Last Log Book entry.
* **Water tanker:** the tanker number with its facts, the totals (Day trips, Night trips, Total trips) as tiles beside it; "New
  trips" and "Saved trips" each in a box ("One line per trip – Trip is 1 on every line."; under Save: "The same challan, or a time
  that falls on another trip, is refused." – the rules the server already has); the shift of a saved trip as a Day / Night chip.
* The old styles of the entry table stay in the file; the new ones (one block, "update-154") sit after them and win only inside
  `.lg-wrap.lgc`. The class `c-close` of the row was renamed `c-end` (the dashboard's KPI tile has a class `c-close` with a purple
  background that showed through).
* Translations: 9 new texts in Marathi and Hindi (`app/i18n/mr.json`, `hi.json`, `keys.json`); 3 texts no longer on the page
  taken out.
* Tests that looked for the old table cells (`td.c-m`, `td.c-debit`, the 6th cell of the row) now find the same fields in the card
  (`half.js`, `mob.js`, `dnui.js`, `att153.js`, `splittime.js` – its look check now checks the card: see Evidence).

## Not taken from his pictures (not asked for in words, or would need more than the look – he decides)
* A photo of the machinery; filter chips by type; a month calendar; attachments for a water tanker trip; an Excel import box with
  "10 MB". None of these exists on the page today.

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – **108 / 108**. `node --check` on `server/*.js`, `api/*.js`; the page's 6 script blocks
  parse; no secret in the change.
* **The same rig snapshots on main and on this branch** (steps 1zc + 1zd + 1ze on both), test by test – the same checks pass and
  the same checks fail on both:
  * clean snapshot, all passing on both: `billlock` 16, `viewbill` 23, `bills120` 17, `gstdecl` 11, `lbpage` 13, `rows146` 29,
    `same145` 10, `entry71` 20, `again128` 11, `time144` 17, `tanker105` 7, `gap77` 20, `lgrows` 12, `add143` 18, `fix` 8,
    `shift109` 8, `tanker103` 11, `tanker97` 16, `time76` 10, `time78` 10, `start` 8, `pendm` 6, `fix130` 12 (run at the same
    hour on both; an earlier run of main at 7 in the morning gave 7 / 3 – the diesel page's shift by the time of day, not this
    change).
  * clean snapshot, the same failures on both (they need data, servers or files this rig does not have): `splittime` 12 / 6,
    `half` 4 / 8 (its entry-page check "½ day" passes on both), `group72` 8 / 5, `lg2` 4 / 4, `mob` 4 / 7, `pend` 8 / 3, `guide2`
    8 / 2, `rename` 3 / 8, `stale` 1 / 2, `dnui`, `saveonce` 19 / 24, `ldebit149api` 22 / 4, `dn`, `meter`, `item2`, `meter2`, `xls`.
  * Super Admin snapshot (Portal): `flow114` 12, `flow116` 18, `billed108` 25, `ev151` 12, `sdel134` 6, `remind118` 13,
    `ldebit149` 14, `flow114api` 30, `lock152` 17, `att153` **39 / 39** (its 📎 check now reads the count – the button also says
    "Attachments"; before that it failed only that check, 38 / 1).
* `splittime`'s look check for the card, at 1920 / 1536 / 1366 / 1280: every time box shows the whole time (156 – 430 px), each
  From, its To and its hours on one line, the hours and the total (5 hr) inside the Reading part, the card not wider than its box.
* `rowwidth`: the row fits its box at every width – at 1280 the old row was 1002 px in a 952 px box (main), the card 950 in 952.
* Pictures drawn on the rig (computer 1600 wide and a phone 390 wide) of the three ways: choosing, one date with KM / Hrs / Time in
  two parts / Holiday / Debit, one machinery with No reading, the water tanker with saved trips – no script error.
* Some older tests write their results to a file of their own (`/tmp/<name>.out`); they were run through a copy for this rig
  (outside the repository) so that their results are read, on main and on the branch alike.

## Not verified
* The live sites; a real computer's screen sizes other than the rig's (1920 / 1600 / 1536 / 1366 / 1280 and a 390-wide phone
  were drawn); tablets; Safari and Firefox (the card uses `:has()` and container queries – Chrome, Edge and Safari 16+ / Firefox
  121+ have them; the rig has only Chromium); the dark theme (the page's whole-page filter) was not looked at; printing the entry
  page (not a printed page).

## Going back
* Vercel → Instant Rollback to the deployment before this update. Nothing is saved differently (no server or database change).
