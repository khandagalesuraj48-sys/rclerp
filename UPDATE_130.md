# update-130 – Open & correct a returned / rejected entry (Diesel Issue) (19-10-2026)

**Asked:** "ek kam kar n jy aentry pathwale hote te mala open krun edit pn krta yaw kay kuth chukley te pn samjayla haw".
**His choices (asked first):** only the person who sent it; corrected → to verification again; Diesel Issue first.

## What changes
* **Open & correct** – next to "Send again", on his own **Rejected** or **Returned** Diesel Issue entry (the box "My entries in
  verification" and Approvals). Diesel Issue for now: **One entry**, **Multiple entries – one date** and **Multiple entries –
  one machinery** (an Excel import of several machinery: "Send again" only).
* It opens **in the form it was made in, as it was sent** (date, shift, source, every row, readings, driver, remark):
  * a bar on top: **why it came back** (the save's reason, or "Rejected by …: …") and **what is wrong now** – the server checks it
    as a save, nothing written;
  * the **wrong rows in red** (a warning in amber) with the reason under the rows;
  * the photos sent with one entry stay with it (a new photo of the same kind takes its place).
* He corrects it; the form's button says **"Send again (VF-…)"**. He writes **what he corrected** (asked once).
  * Still wrong → the rows are marked again, **nothing is sent**, nothing changes.
  * Warnings → "Send again anyway", as "Save anyway".
  * OK → **the same request (VF-…) waits again from level 1, with the corrected entry**. Nothing is saved until it is approved.
* **The people who approve it see what changed**: on Approvals, "Corrected by … : remark" and the list –
  "Row 2 – Machinery: KDX-130B → KDX-130", "Litres: 5 → 7" … Its Steps keep "Corrected and sent again" with the changes.
  ("Measured by", put by the page from the Master, is not listed unless it really changed, e.g. "No reading".)
* **Stop correcting** (on the bar), Cancel / Clear, or another form: nothing changes.
* Only the sender (not the approver, not another user); he needs Edit access to Diesel Issue. Activity Log: "Verification –
  corrected and sent again by the sender" with the changes. The approvers get a notification ("Corrected and sent again – …").
* Help (red box) and the Approvals text in English / मराठी / हिंदी; new words in `mr.json` / `hi.json`.
* **The phone app**: the same in its own screens (App 3.22.0).

## Server
* `app/Code.gs`: new actions `openFlow` { id } (the entry, its form, and the save's check now) and `editFlow` { id, note, args }
  (checked as a save; its own answer when it refuses; else the request is updated: Args, Summary, Machinery, Dates, litres per
  place, level 1, step with `changes`). `flowFixForm_`, `flowFixOf_`, `flowDry_`, `flowChanges_`. `getChangeRequests` gives
  `canFix`.
* No SQL: the same request row (`billed_changes`, kind Flow) is updated in place.

## Evidence
* **Unit tests: 92 / 92** (new "update-130"; "update-116" updated for the button words). The new test runs the real server code
  with the three Diesel Issue saves answering as theirs do: returned with a mistake on row 1 → only the sender opens it → it
  opens as sent with the mistake → still wrong: refused on its rows, nothing changed → corrected → Pending at level 1, its step
  with "Row 1 – KM reading: 50 → 150", the notification, the Activity Log → approved → the corrected entry saved; one entry
  (rejected) with a warning → "anyway" → its photos kept by kind; one machinery – many dates (a row added); several machinery →
  not opened; the words of what changed; the page's code; the Marathi / Hindi words.
* **Rig browser test** `test/browser/fix130.js`: **12 / 12** with real Diesel Issue entries – Multiple entries returned
  ("Line 2: "KDX-130B" is not in Master.") → Open & correct → the form as sent, line 2 red, the bar, "Send again (VF-…)" → corrected
  → remark → Pending with the corrected lines and the changes → the checker's Approvals shows "Corrected by Maker 130 … Row 2 –
  Machinery: KDX-130B → KDX-130" → approved → the corrected lines saved; One entry rejected → opened → Stop correcting (nothing
  changed) → opened again, litres 5 → 7 → sent → approved → saved; no page error.
* Earlier tests on the rig: `again129.js` 9 / 9, `again128.js` 11 / 11, `flow114.js` 12 / 12, `flow116.js` 18 / 18 (flow114 /
  flow116 each once missed a sign-in when the four ran back to back; each passed when run again on its own).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* The live entries (VF-00006 … VF-00004 with "Line …"): after this update, "Open & correct" on each.
* Other pages (Log Book, Inward, Transfer, Master …): "Send again" only, for now – the next step if he wants it.
* The phone app on a real phone (its build runs analyze, the tests and draws the screens).

## Going back
Vercel → Instant Rollback to update-129. Requests corrected meanwhile stay Waiting with their corrected entry; the earlier
version approves or rejects them as before.
