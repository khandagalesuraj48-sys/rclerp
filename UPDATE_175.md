# update-175 – the Maintenance Log Book "Start to end", its bills changed and deleted, every Own machinery imported, "Fetch outward" (28-10-2026)

**Asked (28-10-2026, 07:27):** "maintenance log book madhe date filter aahe but ajun ek banaw start to end he ek option natr fetch outward
as he dable ki systeam outward fetch krel log book madhle missing entry fill krun log book updet hoil long period asa nko error ata machine
active nasli pn systeam madhe aahe tri log book import hou shakel ok active from che agodr cha data pn load hou shakel purn log book edit
ani delet pn karta yeu shakel ok import kel nantr Names written in more than one way (AI) he je tick krayche aste import zale nantr pn aahe
as rahte tr te hi fix kr ok ekdam proper logic ne he sagle banaw".
**His answers (asked):** "Fetch outward" – **"Store module चे Issue झाल्यावर"** (the button now; the Store's Issue joins it when it is
built); a machinery not active – **"फक्त Own – active असो वा नसो"**.

**No database step. Nothing saved is changed. No secret in any file.**

## What changes
* **Maintenance Log Book** (page Maintenance; the phone app's report):
  * **"Start to end"** (a tick beside From / To): the whole log book of the machinery – from its first bill (or fill) to today; the dates
    are greyed. The meta line says "Start to end: <first> to <today>".
  * **No "Select up to … days" any more** – a long period is shown (update-170: at most 1,100 days).
  * **Each bill its Change and Delete** – on the screen only (not printed, not in the Excel), for those with Maintenance Edit: Change
    opens the bill in the form (as the list's ✎), Delete asks first; the log book is shown again after a change or a delete.
  * **"Fetch outward (Store)"**: reads the log book again with what the RCL Store issued to the machinery. The Store has no Issue yet
    (only its Item Master) – it says so: "The Store's Issue (material given to a machinery) is not built yet – there is no outward to
    fetch. When it is, what the Store gives to this machinery comes into its log book by itself." (`maintLog_` answers `store: { on,
    lines }`; `MAINT_STORE_ON_` / `maintStoreLines_` – the provision of update-170 – are where the Store's Issue joins.)
* **Maintenance bills** (the list): **"Start to end"** too – every bill of every date (the machinery picked or all), each changeable
  and deletable.
* **The whole log book can be changed:** a bill changed **on the same machinery is not checked against its Active dates again** – an old
  bill imported from before its Active From, or of a machinery no longer active, can be changed (its date too) and deleted. A **new** bill,
  or a bill **moved to another machinery**, is checked as always (the machinery active on that date). Closed months stay closed.
* **The old log book's import – every Own machinery** (Asset Master: Ownership Own), **on the site now or not** (update-173: on the site
  now only); a rented / hired one never. The list marks one "(not on the site now)"; "Download the format (Excel)" has a sheet for each
  Own machinery. Bills before its Active From were already imported as they are.
* **The names' list (AI) goes once everything is imported** (no sheet left with a machinery and not imported).
* **Help and words:** the `FIX_RULES` rule of the import (its new words: "… is not an Own machinery (Asset Master: Ownership Own) …");
  `PAGE_GUIDE` mnt (Start to end, Change / Delete, Fetch outward) in English, मराठी, हिंदी; `app/i18n`: 10 new texts in Marathi and Hindi.
* **The phone app 3.53.0** (rcl-mobile, its own pull request): the same – the log book report's "Start to end" chip, the bills' "Start to
  end" chip, "Fetch outward (Store)" (then the log book start to end), every Own machinery in the import, the names' list gone after it.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **128 / 128 pass**. The new `update-175` test: an Own roller no longer on the site
  imports its old log book (2012, 2024); its log book start to end – from 12-03-2012 … to today, ₹1,770, the Store's outward `{ on: false,
  lines: 0 }`; a long period (2010 – 2026) without an error; its 2012 bill changed (its party and its date); moved to a machinery active
  only from 2026 – refused; a new bill typed for 2012 – refused as before; deleted. Changed on purpose: update-173's rented-machinery
  message and its rule.
* `node --check` on `server/*.js` and `api/*.js`; the page's script blocks parse; acorn: no call lost; no secret in the change.
* **The local rig** (Claude stand-in): `mnt173.js` **22 / 22** (6. an Own roller no longer on the site offered "(not on the site
  now)"; the names' list gone after the import; the log book "Start to end: 02-12-2022 to 28-10-2026", the dates greyed, 5 bills each
  with Change / Delete – not in the Excel; "Fetch outward (Store)" says the Store's Issue is not built; Change opens MT-000005 in the form;
  Delete of MT-000004 from the log book – 4 left, shown again; the bills "Start to end" – every bill), `mnt170.js` **21 / 21**,
  `mnt168.js` **30 / 30**, `mnt165.js` **32 / 32**. `mnt170` / `mnt168` read the log book as printed (the screen's Change / Delete left
  out) – changed on purpose. Picture (rig): the log book start to end with its buttons.
* acorn: `onSiteOn_` one call fewer – on purpose (the import no longer asks whether the machinery is on the site).
* **Not verified:** the Store's outward itself (the Store's Issue is not built); a real phone; his real data.

## Going back
* Vercel → Instant Rollback to update-174 (the log book with its dates only, the import for machinery on the site only).
