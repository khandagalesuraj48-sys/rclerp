# update-131 – Nothing wrong goes for approval: no "Send again anyway"; a reading is checked by its date (19-10-2026)

**Asked (with a picture of VF-00004's 12 reading warnings and "Send again anyway"):** "are send any way he option nko aahe chukicha
data approval sathi gelach nahi pahije kay chukey te user la patkan samjle pahije user correct krel tya nantr correct hoil mg te send
hou shakel". **His choices:** no "anyway" for entries that go for approval (a save that waits for no one – e.g. the Super Admin's –
keeps "Save anyway"); a machinery number changed in Asset Master is NOT carried into waiting entries ("nako").

## Why VF-00004 showed 12 warnings
* A new diesel fill was checked against the machinery's **newest** fill, whatever its date. VF-00004 is an entry of an earlier date
  that waited days for approval; meanwhile later fills of the same machinery were saved – so its readings were "less than the last"
  on every line, also where they were right (e.g. Row 22: 3625 on its day, 3717.5 on a later day).
* Edit already checked the right way: the fill before and the fill after, by date.

## What changes
* **A reading is checked by its date** – everywhere a fill is made: One entry, Multiple entries (one date), Edit, and (for approval)
  One machinery – many dates / Excel import. It must not be lower than the nearest fill **before** it (by date, shift, time – the
  rows above it in the same entry count too) and not higher than the nearest fill **after** it. The message names that fill:
  "KDX-131: KM Reading 5150 is more than the later KM Reading 5120 (fill of 19-10-2026, Day)." / "… is less than the earlier KM
  Reading 1300 (row 1 of this entry)."
* **For an entry that goes for approval** (when it is sent, sent again, corrected, and when it is approved) a reading that does not
  fit is a **mistake**: the rows are red with the reason and **nothing is sent** – "Save anyway" / "Save all anyway" (force) does not
  pass it. The person corrects it ("Open & correct" for a returned one), then it goes.
* **"Send again anyway" is gone** (from update-129): Send again says what the save refuses in full; it is corrected first.
* An entry approved later that no longer fits (e.g. a later fill with a lower reading saved meanwhile) comes back **Returned** with
  the row and the reason – not saved.
* A save that waits for no one: as before ("Save anyway?"), but with the check by date (far fewer false warnings).
* Help (red box) in English / मराठी / हिंदी: "This reading does not fit between the fill before it and the fill after it …".

## Server
* `app/Code.gs`: `fitWarnings_` / `dieselPts_` / `dieselIdxs_` (the check by date), `flowStrict_` (an entry for approval),
  `FLOW_FIT_MSG_`; `saveDieselIssue_`, `saveDieselBulk_`, `updateDieselIssue_`, `importDiesel_` use them. Gone: `readingWarnings_`,
  `lastReadings_` (the newest-fill check), `flowForce_` and the `force` of `resendFlow` (update-129). No SQL.

## Evidence
* **Unit tests: 93 / 93** – new "update-131" with the real saves: a fill between the earlier and the later fill fits (until now
  "less than the last"); lower than the earlier / higher than the later → the words with the fill's date; a row under a row of the
  same entry; for approval: Multiple entries (also with force), One entry (also with force), One machinery – many dates refused
  with the rows; through the app: not sent even "anyway" → a fitting entry sent → a later lower fill saved → approval Returned with
  the row and date → Send again with force still refused → Open & correct marks the row → corrected → approved → saved. "update-129"
  rewritten (the words of a refusal; force not read); "update-128" adjusted.
* **Rig browser test** `test/browser/fit131.js` **8 / 8** (replaces `again129.js`) with real Diesel Issue entries: a non-fitting row not
  sent even with "Save all anyway"; yesterday's entry sent; a fill of today at a lower reading saved; approval → Returned "Line 2: …
  5150 is more than the later KM Reading 5120 (fill of 19-10-2026, Day)"; Send again → said, no "anyway", nothing changed; Open &
  correct → line 2 red with that reason → 5110 → sent → approved → saved. Also on the rig: `fix130.js` 12 / 12, `again128.js`
  11 / 11, `flow114.js` 12 / 12, `flow116.js` 18 / 18, `dashkd126.js` 72 / 72.
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* The live entries: after this update VF-00004's rows that fit by date are no longer marked; the ones still marked (e.g. Row 39
  "1.4" Hrs, Row 14) are corrected with "Open & correct".
* The assistant's chat test (`test/browser/aido.js`, needs the AI stand-in) was not run; its "Save anyway?" for a direct save stays.
* The phone app: App 3.22.1 (same piece of work) – checked by its build.

## Going back
Vercel → Instant Rollback to update-130. Entries sent meanwhile stay as they are.
