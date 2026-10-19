# update-129 – Send again: say a save's warnings, and let the sender confirm them (19-10-2026)

**Reported (with a picture, after update-128 went live):** "40 merge kela AHE BUT ASA ERROR KA YET AAHE" – Send again on Diesel
Issue "Multiple entries" said "Not sent again: the save refuses it – entry VF-00011 stays as it is …"; the box showed
"Not saved: refused" on VF-00011 … VF-00007 and "Not saved: Line …" on VF-00006 … VF-00004.

## Why it happened
* A save says "not saved" in its own answer in a few ways: **mistakes** (`errors` – each line), or **warnings** that the person
  confirms on the page with "Save anyway" (`warnings` – Multiple entries; `warning` – one entry; `used` / `duplicates`).
* The approval and Send again read only the mistakes and the single `warning`. The **warnings of "Multiple entries"** (a KM / Hrs
  reading lower than the last one – e.g. a later day was saved before this one was approved) were not read: the approval wrote
  "Not saved: refused" and Send again said "the save refuses it", with no way to confirm them.
* VF-00006 … VF-00004 are different: they have real **mistakes** ("Line N: …"); those were always said.

## What changes
* **The reason in full**, at the approval (Returned) and when sent again:
  * warnings → "To check (warnings, not mistakes): Line 2: MH-…: KM Reading 5100 is less than the last KM Reading 5300. | …"
    (up to 8 lines, then "… n more");
  * one warning → "To check (a warning, not a mistake): …" (without the page's "Save anyway?");
  * mistakes → "Line 3: … | …" (up to 5 lines), as before.
* **Send again → the warnings to check:** a box "Please check – warnings, not mistakes" lists them for each entry.
  * **Send again anyway** → the entry goes to verification (level 1) with its warnings confirmed – as "Save all anyway" on the
    page – and is saved as it was sent when approved. Its steps say "… – warnings confirmed by the sender".
  * **Cancel** → nothing changes ("Not sent again: VF-… – nothing changed.").
* A **mistake** is never passed by "anyway": it is said, and the entry stays as it is until it is put right.
* The same for every save that asks to confirm (fixed everywhere): Diesel Issue (one / Multiple entries / Edit), Master delete
  (one / several – "has n Diesel Issue and n Log Book entries"), Machinery Billing submit ("a bill for the same period is already
  submitted" – saved as its revision, the older one Superseded, as the page's default). A unit test lists these saves: a new
  save that asks to confirm fails the test until it is added.
* For one entry, a refusal now comes back like for several (in the list of "not sent"), so the page can offer the confirm.
* Help (red box) in English / मराठी / हिंदी says: a mistake – put it right first; only warnings – check them and press
  "Send again anyway". New words in `mr.json` / `hi.json`.

## Server
* `app/Code.gs`: `flowRefusal_(res)` (the reason in words, warning or mistake), `flowRefused_`, `flowForce_` (where each save reads
  its confirm: `force` on the entry; `confirm` for `submitBills`; the second value for `deleteMaster` / `deleteMasterMany`);
  `resendFlow` takes `force: true`; `flowDecide_` and `flowResendOne_` use `flowRefusal_`.
* The confirmed entry's stored values (`Args`) get the confirm, so the approval saves it as confirmed.
* No SQL.

## Evidence
* **Unit tests: 91 / 91** (new "update-129"; "update-128" updated: one refused entry now comes back in `failed`). The new test
  runs the real server code with a save that answers as the diesel saves do: warnings at the approval → Returned with each line
  → Send again: the same warnings, nothing changed → "anyway" → waiting, kept confirmed → approved → saved; mistakes → said line
  by line, "anyway" does not pass them, nothing changed; one warning ("Save anyway?" taken off); the confirm of every save
  (`flowForce_`); the words of `used` / `duplicates`; the page's code; the Marathi / Hindi words.
* **Rig browser test** `test/browser/again129.js`: **9 / 9** with the real Diesel Issue "Multiple entries" (`saveDieselBulk`):
  sent (readings above the last) → a later reading saved meanwhile → approved → Returned "Not saved: To check (warnings, not
  mistakes): Line 1: KDX-129: KM Reading 5100 is less than the last KM Reading 5300. …"; the box shows it; Send again → the
  warnings box; Cancel → nothing changed; Send again anyway → waiting, confirmed; approved → the two lines saved as sent.
* Earlier tests on the rig still pass: `again128.js` 11 / 11, `flow114.js` 12 / 12, `flow116.js` 18 / 18.
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* The live entries in the picture. After this update:
  * VF-00011 … VF-00007 (said "refused"): press Send again → the warnings are listed → if right, "Send again anyway".
  * VF-00006 … VF-00004 ("Line …"): the full reason is said; put the mistake right first (or enter it again).
  * Their stored "Not saved: refused" text stays until they are sent again (it is not rewritten).
* The phone app (it gets the same in App 3.21.1, PR #46). A real phone is not tested here.

## Going back
Vercel → Instant Rollback to update-128. Entries sent again with warnings confirmed stay Waiting with the confirm in them; the
earlier version approves them as confirmed too (the save reads the same `force`).
