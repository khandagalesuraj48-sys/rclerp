# update-108 – Correcting a billed period: the Super Admin, Approvals, and the next bill takes the difference (14-10-2026)

**Asked:** "bill entry change fkt super admin change kru shakel; credit note debit note he tr banwaych aahech but bill madhe pn tas
calculation dakhwaych aahe; bill banwatna farak disla tr to … clear krun dyayla haw, clear nahi kel tr bill submit honar nahi; super
admin changes kru shakel he ok ahe but user pn change kru shakel but approval tewach hoil jewa super admin approval deil."
His choices (14-10-2026): Approvals is a page in Mechanical; the difference is taken in the new bill (Credit / Debit Note made by
itself, calculation in the bill, all differences ticked or no submit); SQL step 1z is fine.

## How it works
1. **The Super Admin** – the Portal's Super Admin when he opens Mechanical through the Portal:
   * his ticket now says `super: true` (Portal `api/go.js`), and his Mechanical session keeps it (`sessionMake_` 5th part "S");
   * the bill lock lets him through everywhere: Log Book (every way – entry, list Edit / Delete, Edit Log Book, Excel, water tanker)
     and Diesel Issue (`billLockFail_`, `ACTOR_SUPER_`);
   * on the page the lock marks no longer stop him (a short note says the difference goes to the next bill).
2. **Anybody else** is refused as before. Now the refusal (or the page's own warning) offers **"Send for approval"**:
   * the user writes why;
   * exactly that save (action + what the page sent) is kept in `billed_changes` (kind Request, `sendChangeRequest`) – nothing
     is saved yet. The same on the phone app (3.1.3).
3. **Approvals** (new page, Admin menu, the Super Admin only, with the number waiting):
   * each request shows who, what (machinery, date, shift, the readings asked and what is saved now) and why;
   * **Approve** = the same save runs now, as that user's change, with every check of a save (`decideChangeRequest`). If
     something changed meanwhile it is refused with the reason and keeps waiting;
   * **Reject** needs a reason; nothing is saved.
4. **Before the first change** of a submitted bill's entries (the Super Admin's save or an approved one), the bill's figures for
   that machinery are worked out from the entries as they still are and kept (`billed_changes`, kind Baseline – once per bill and
   machinery).
5. **The next bill** of the vendor (same name on the bill) works each such bill out again from today's entries
   (`billCorrections_`) and shows the difference **at the old bill's rates**:
   * work: the quantity of each line × its rate; a unit with several rates (slabs) by its amount;
   * diesel debited: litres × the old bill's diesel rate;
   * plus = **Credit Note** (to the vendor), minus = **Debit Note** (from the vendor); GST / TDS at the old bill's %;
   * a blue box on the vendor's first bill lists them, each with a "checked" tick. Not ticked = verify says ✖ and the bill is
     **not submitted**;
   * on submit the notes are made (numbers: Debit Notes in their run, Credit Notes `…/CN-001` in their own run) and taken in
     the bill: **J = Debit − Credit, K = I − J**;
   * the Abstract shows a table "Corrections of earlier bills" with the calculation and the note numbers;
   * the vendor ledger shows the note; a Credit Note adds to what the vendor gets;
   * the saved bill keeps what it took (`data.corr`); the bill after it compares with that. A bill deleted (or replaced by a
     revision) cancels its correction notes, and the difference shows again.
6. **The bill on the Drive is never changed.**

## SQL (he runs it) – `sql/supabase_step1z_billed_changes.sql`, in EVERY site's Supabase (VTR NH 848, 18B …)
Only adds one empty table `billed_changes` (listed word for word in Read Me; the database check names it). Until it is run:
the Super Admin's change works but its difference cannot be shown; a user's "Send for approval" says the step must be run first;
bills work as before.

## Other repositories
* **Portal** (PR "The Super Admin's ticket says so"): `api/go.js` adds `super: true` for the Super Admin; test `api.test.js`.
* **Phone app** 3.1.3 (PR "billed-approval"): the same "send it to the Super Admin?" box; the Super Admin is not stopped.

## Evidence (local rig, test data only)
* Unit: `timeout 300 node --test test/unit.test.js` → 72 / 72 (new "update-108": the session flag, the refusal, a request
  (sent / twice / wrong action / not the Super Admin / user no longer active / reject needs a reason), the Super Admin's change
  and its "before", the next bill's difference (KM 80 → 100 × ₹50 → Credit Note ₹980 with TDS 2%), verify refuses it not taken /
  not ticked, submit makes the note and J / K, the ledger, the DN run not moved, delete cancels the note and the difference comes
  back, step 1z only adds).
* Browser `test/browser/billed108.js` (rig with the Portal) → 22 / 22:
  * RA Bill 71 submitted on the page;
  * the user's Edit on a billed date: the box, the edit window, Save refused, "send" with a reason, nothing saved;
  * an Admin who is not the Super Admin cannot approve;
  * the Portal ticket says super; the Super Admin's screen shows "Approvals (1)"; the request with who / what / why;
  * Approve saves it (and the next entry's Start follows); the "before" kept;
  * a diesel issue: the user refused, the Super Admin saves it;
  * the October bill shows KM 120 → 150 × ₹50 = +₹1,500, diesel 10 → 20 L × ₹92.50 = −₹925 → Credit Note ₹563.50, the Abstract
    table and the J line;
  * verify without the tick: not submitted; ticked: submitted with the note, J / K; nothing left after; ledger line;
  * the bill deleted: note Cancelled, difference back; no page error.
* Old browser tests: billlock.js 16 / 16 (changed: the warning is now a box with "send for approval"; the server's "way out"
  text), half.js 12 / 12, debit.js 5 / 5, dnui.js 8 / 8, viewbill.js 23 / 23, gstdecl.js 11 / 11, tanker107.js 8 / 8.
* Portal: `api.test.js` 104 / 104, `super14.js` 7 / 7 (run with the password the API test leaves).
* `node --check` on server/*.js and api/*.js; the page's script blocks parse.

## Not verified
* Not run on the live data or a real phone. The phone app is built and tested by GitHub Actions (I cannot run Flutter here).
* Books closed (Month closing) still stops any change of a closed month – also an approved one; the Admin reopens the month if needed.
* A normal user does not see the list of his own requests (only the toast "Sent …"); the Super Admin sees all on Approvals.
* An old bill submitted before this update is only looked at once one of its entries is changed (its "before" is kept at that moment).

## Going back
Vercel → Instant Rollback to update-107 (Mechanical) and the Portal's previous deployment. The table `billed_changes` can stay
(nothing reads it then). A correction note already made stays in Debit Notes: after going back, the older code counts a Credit
Note like a Debit Note in the ledger – cancel such a note (Saved Bills → Debit Notes) after deleting the bill that took it.
