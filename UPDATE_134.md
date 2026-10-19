# update-134 – The Super Admin deletes entries (saved, waiting, returned, rejected) of a date or a period – and brings them back (19-10-2026)

**Asked:** "super admin user ni kelelI konti hi entry mg ti save aso approval madhe aso ki retuen aso ki reject aso konti hi entry
delet kru shakel jas ki koni diesel issue kel aasel super admin ti entry delet kru shakel single date or ya period wise".
**His choices:** Diesel Issue first (the others one by one when he says); an entry in a submitted bill is **not** deleted; a deleted
entry can be **brought back**; the entries are **picked from a list with ticks**.

## What changes
* **Diesel Issue → "Delete entries – Super Admin"** (at the end of the page; shown only to the Super Admin signed in through the
  Portal):
  * a **date** (or From – To), optionally who entered it and a machinery → **Show entries**;
  * **Saved entries** and the ones **waiting for verification / returned / rejected**, each with a tick (and Tick all). One in a
    submitted RA Bill or of a closed month cannot be ticked – it says why ("In the submitted RA Bill RA-7 – delete that bill first");
  * **Delete ticked** → asked once → all the ticked are deleted together, or none (each refusal said, e.g. one changed meanwhile);
    the diesel goes back into the stock, the Log Book link follows;
  * **Deleted entries**: every deleted entry is kept whole (who entered it, who deleted it and when, what it had) → tick →
    **Bring back ticked**: a saved entry comes back the same (its ID, values, photos, time, who entered it) – checked again: the
    month open, not in a submitted bill now, the diesel in stock on its date; a request comes back waiting / returned / rejected
    as it was.
  * Every delete and every bring-back is in the Activity Log.
* An approved request is not listed (its entries are saved – they are deleted). A user's own Delete (one entry) stays as before.
* The phone app has the same screen (App 3.25.0: Diesel Issue ⋮ → Delete entries – Super Admin).
* Help (red box) in English / मराठी / हिंदी for every new message; the page guide of Diesel Issue says it; the new words in मराठी /
  हिंदी.

## Server (no SQL – no new table)
* `app/Code.gs`: `superDelList` / `superDelete` / `superRestore` (`sdelList_`, `sdelDelete_`, `sdelRestore_`; the Super Admin only –
  `sdelSuper_`; never sent for verification). A deleted entry is kept in the existing table `billed_changes` as kind **"Deleted"**
  (`DEL-00001` …, with every column of the row); a deleted request keeps its row with kind **"Flow Deleted"** (Approvals, reminders,
  the held-back diesel and the counts read only kind "Flow", so it is out of all of them until brought back).
* A new verification number (`VF-…`) now counts every request ever made, also a deleted one (it keeps its number – no clash when it
  is brought back).

## Evidence
* **Unit tests 95 / 95** (new "update-134", with the real saves and the app's API): only the Super Admin (a user, an Admin who is not
  the Super Admin: refused, all three actions); the list by a date / a period / a machinery / who sent it; one wrong → nothing
  deleted; a closed month and a submitted bill → refused, nothing deleted; 2 saved + 1 waiting + 1 rejected deleted → out of the
  diesel and of Approvals, kept as DEL-00001…4; a new request takes VF-00003 (not a deleted one's number); brought back → the same
  row (ID, litres, reading, time, who entered it) and the request Pending again; a second bring-back refused; the stock used
  meanwhile → "Not enough diesel …", nothing brought back; the rejected one alone → back; the Activity Log has each.
* **Rig browser test** `test/browser/sdel134.js` **6 / 6**: the Super Admin (Portal ticket) – the panel; today's 2 saved + 1
  waiting; ticked 2 → "Delete ticked (2)" → "Delete 2 entries?" → deleted, kept (DEL-00001, DEL-00002); both brought back (the 10 L
  entry with its ID, the request Pending); an Admin who is not the Super Admin: no panel, the server refuses. Picture
  `test/shots/sdel134.png` (local).
* Also on the rig: `flow114.js` 12 / 12 and `fit131.js` 8 / 8 (the verification flow – its numbers now count a deleted request too).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.

## Not verified
* On the live data (nothing was deleted live).
* Entries of the other pages (Inward, Transfer, Log Book …) – not part of this step (his choice: Diesel Issue first).

## Going back
Vercel → Instant Rollback to update-133. Entries deleted meanwhile stay in "Deleted entries" (billed_changes, kind "Deleted"); they
can be brought back once this update is back.
