# update-247 – The time in the lists is when the USER SENT the entry, not when it was approved (14-11-2026)

**Asked:** (two pictures of one Diesel Issue: the list says 05:02 PM, its photos 02:30 PM) "2 time ka diset aahet weg wegle same entry
sathi – mi sangitlel mala realtime hawa ahe jewa user diesel issue krto ani approval sathi entry jate to time".

**What was wrong (update-246):** an entry that goes through verification is written into its table only when the last person approves
it, so its "Created At" – the time update-246 showed – is the moment of the approval. Three entries approved together all said 05:02 PM.

**No database step. Nothing is stored differently; no entry, calculation, stock, bill or permission changes.** "Created At" is not
touched (the order of the stock follows it).

## What changes
* `app/Code.gs`: the lists of Diesel Issue, Inward and Transfer look up the entry's request (`sentAtOf_`, `sentAtPick_`): the request of
  that page that was saved in the same moment as the entry (its "Decided At" from 5 s before to 120 s after the entry's "Created At"),
  with the entry's machinery among its own when several fit. The time shown is the request's "Requested At" – the moment the user sent
  it. It works for the entries already there too.
* An entry saved without verification has no request: its own time of saving, as in update-246.
* The web page and the phone app are unchanged – they show what the server sends.

## Evidence
* `timeout 300 node --test test/unit.test.js` – 193 of 193 pass (new test "update-247": his case – sent 14:31, approved 17:02; two
  requests approved 15 s apart; several entries in one request; no machinery; an entry without a request; no requests' table).

## Not verified
* Not run against a database and not seen in a browser or on a phone; a real approval was not walked through (the choice of the
  request is tested on its own).
* An entry made on a phone with no network: the time shown is when it reached the server, not when it was typed.
* The lists now also read the requests' table; how much slower that is was not measured.

## Going back
Vercel → Instant Rollback to update-246.
