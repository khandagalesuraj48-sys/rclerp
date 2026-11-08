# update-128 – Send a rejected or returned entry again, as it was (19-10-2026)

**Asked (with a picture of "My entries in verification": 8 entries "Returned – not saved"):** "ata user prt tya entry krt basnar
nahi ata je return reject zal tech reason deun return krta yeil as banaw ata jyana return zaley tith tyana option asel send to
approval or verification data loss nko karuu".

## What changes
* **Send again** – for the person who sent it, on his entry that is:
  * **Rejected** (an approver said no, with a reason), or
  * **Returned** (approved at the last level, but the save refused it – "Not saved: …").
* He writes **why** he sends it again (needed). The entry goes to verification again **exactly as it was sent** – the same lines,
  the same photos – starting at **level 1** of its levels. Nothing is typed again.
* It is the **same request** (VF-…): its status is Waiting again; every earlier step stays in its Steps (Sent, Rejected / Approved,
  Returned with the reason, **Sent again** with his remark). Level 1 gets a notification ("Sent again for verification – …").
* **Checked as a save first** (as when it was first sent, nothing written): if the save would refuse it again, he is told now –
  "Not sent again: <the reason> – entry VF-… stays as it is (nothing is lost); send it again when this is put right." It stays
  Rejected / Returned with its Send again button.
* **Where:**
  * the box **"My entries in verification"** (Diesel Issue, Inward, Transfer, Log Book, … and the Dashboard): each not-saved entry
    now shows **why** (a returned one: the save's reason in red – before, only the approver's note was there), a **Send again**
    button, and **Send all again (n)** when there are two or more (one remark for all; each is checked on its own);
  * **Approvals:** Send again on his own rejected / returned rows.
* Not sent twice: an entry already waiting again (e.g. made anew meanwhile) is refused – "already waiting for verification as VF-…".
* Only the sender (not the approver, not another user); he still needs Edit access to that page. Taken back (Withdrawn) entries
  are not included – he took them back himself.
* Help (the red box's advice) and the Approvals page guide say it in English / मराठी / हिंदी; the new words are in `mr.json` /
  `hi.json` (`keys.json` refreshed by `tools/i18n/extract.js`).
* **The phone app** has the same (App 3.21.1).

## Server
* New action `resendFlow` ({ id, note } or { ids, note }), `flowResend_` / `flowResendOne_` in `app/Code.gs`; `getChangeRequests`
  gives `canResend` and `resent`; the Activity Log writes "Verification – sent again by the sender".
* No SQL: the request row (`billed_changes`, kind Flow) is updated in place – Status, Data (its steps), Result emptied.

## Evidence
* **Unit tests: 90 / 90** (new "update-128"; one other run had the known timing-flaky "update-117" fail once, it passed on the
  other run). The new test runs the real server code: rejected → sent again with a remark → the same request at level 1, its
  steps, the notification, the Activity Log → approved → saved as it was; returned (the same vendor saved meanwhile) → Send again
  refused with the save's reason, nothing changed → the other one deleted → sent again → approved → saved; the same entry made
  anew meanwhile → not sent twice; several at once (one not found); the checks (no remark, not the sender, waiting already).
* **Rig browser test** `test/browser/again128.js`: **11 / 11** – the box shows Not saved 3 with why (the approver's note; the
  save's reason in red), Send again on each and Send all again (3); the dialog shows why and needs a remark; sent → Waiting at
  level 1, steps kept; Send all again (2) → Waiting 3; approved → the three vendors saved as they were sent; no page error.
* Earlier verification browser tests still pass on the rig: `flow114.js` 12 / 12, `flow116.js` 18 / 18.

## Not verified
* The live database (the 8 entries in the picture): each will be checked as a save when it is sent again – if the reason it was
  returned is still there, it is said and it stays.
* A real phone (the app is checked by its build: analyze, tests).

## Going back
Vercel → Instant Rollback to the previous update. Requests sent again stay as they are (Waiting); the earlier version approves or
rejects them as before.
