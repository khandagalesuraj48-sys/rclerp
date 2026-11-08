# update-109 – Approvals for the user too, notifications, Day / Night by the time (14-10-2026)

**Asked:** "user la pn disayla haw tyan approval sathi kay pathwale ahe konach approval pending aahe kuthlech approval milale aahe; push
notification … jyala approval pathwale aahe tyalach … approval zal ki tyach same user la pn" and "app madhe day ani night shift auto
select hoil time nusar jith jith ha shift option asel … manualy change pn krta yel". His choices: Day 8 AM – 8 PM, Night 8 PM – 8 AM;
the Log Book too; the notification of a request to the Super Admin only.

## 1. Approvals for everybody who sends
* **Approvals** is now under **My account** (it was under Admin, for the Super Admin only):
  * shown to the Super Admin and to every user who may change Log Book or Diesel Issue (Edit);
  * the menu shows how many are waiting.
* **A user** sees all the changes he sent: Waiting (not saved yet) / Approved (saved, by whom, when) / Rejected (with the Super Admin's
  reason). He has no Approve / Reject buttons. The list is read again right after he sends a change.
* **The Super Admin** sees as before: waiting ones first, "Show approved and rejected too", Approve / Reject.
* **Phone app 3.1.4:** Me → Approvals opens the same page inside the app.

## 2. Notifications (web push – the same as the screen-share calls)
* A change sent for approval → a notification to the **Super Admin's** devices: "Approval needed – <user>", what and why.
* Approved / Rejected → a notification to the devices of **the user who sent it**: "Approved – saved: …" / "Rejected – not saved: …"
  with the Super Admin's reason.
* A tap opens the app on Approvals.
* Who the Super Admin is: remembered at his Portal sign-ins (setting CR_SUPERS, the last 5).
* A device gets them once that browser / installed app allowed notifications (the question after sign-in now says "screen share
  calls, approvals"; Settings → notifications).
* The phone app (Flutter) has no push service of its own yet – there the list is Me → Approvals.

## 3. Day / Night by the time
* **Settings → Rules of the site** (Admin): "Day shift starts at" (08:00) and "Night shift starts at" (20:00).
* Every shift box of a NEW entry takes Day or Night by the time while untouched:
  * Diesel Issue (one and many), Diesel Transfer, Water tanker;
  * the Log Book rows not filled yet: one date – many machinery all rows; one machinery – many dates the first row, then the next
    shift as before.
* It follows the clock (checked every minute and when the page opens).
* A box changed by hand keeps the person's choice until the entry is saved.
* An entry being changed keeps its own shift.
* **"My usual shift"** (Settings, per user) still wins; its empty choice is now "Automatic – Day / Night by the time".
* **Phone app 3.1.4:** the same (diesel, transfer, Log Book, tanker), from the site's hours.
* Not changed: the date. An entry made after midnight gets that day's date, as the clock says (his answer 15-10-2026: "ratri 12
  nantar next day chalu hoto, so te time ani date standard pramane asel").

## Fixed on the way
While testing, the browser test idle.js showed that a line put inside showTab's chain stopped the Diesel page from loading its
list. It is fixed (a statement of its own before the chain), and a unit check guards it.

Later (found by the old browser test half.js): in the Log Book "one machinery – many dates", the FIRST row took the shift AFTER
the one of the time (Day by the clock → the row said Night), because "next row = next shift" was applied to it too. Fixed: only a
row after another one moves to the next shift. A unit check and shift109.js guard it. half.js now sets its row to "Full Day" itself
(a new row no longer starts as Full Day – it follows the time, as asked).

## Evidence (local rig, test data only)
* Unit: 74 / 74 (new "update-109": notifications to the Super Admin and to the sender, the user's own list, rejected with reason;
  "update-109" shift: the hours saved / checked / kept, the page's rule for every hour incl. a Day over midnight, where it is used,
  the showTab chain).
* Browser:
  * shift109.js 8 / 8 – the boxes follow the hours, the first Log Book row (one date, and one machinery), a hand choice kept,
    "My usual shift" wins, Settings saves the hours;
  * half.js 12 / 12 (after the fix above);
  * old page tests that counted on a new Log Book row being "Full Day" now set that shift themselves (the row follows the time,
    as asked): dnui 8 / 8, item2 13 / 13, meter 8 / 8, start 8 / 8;
  * billed108.js 24 / 24 (with the user's Approvals: Waiting, then Approved);
  * idle 10 / 10, entry71 20 / 20, lgrows 12 / 12, pendm 6 / 6, tanker104 12 / 12, tanker105 7 / 7, tanker107 8 / 8, xls 14 / 14.
* pend.js (3 FAIL) and batch.js (2 FAIL) fail the same on main before this change (not caused by it).
* Phone app: GitHub Actions (analyze, tests incl. the new shift test, screens).

## Not verified
* A notification arriving on a real phone / computer: the push service cannot be reached from the test rig (the server code that
  sends it is unit-tested).
* Live data.

## Going back
Vercel → Instant Rollback to update-108. No SQL.
