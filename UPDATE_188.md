# update-188 – the date rule of update-187 put right where it held too much or too little (29-10-2026)

**Why:** a check of update-187 (the code read again, every place the rule reaches) found where it does not do what was asked. Asked
the MD the four that are his to decide (29-10-2026); his answers:
* A user's change of an old Log Book / diesel entry in a submitted RA Bill or approved – **"नको – फक्त नकार"**: refused, as now.
* The Maintenance bill's date (the garage bill's own) and a fuel card payment's date – **"नाही – फक्त आजची तारीख"**: a user only today.
* The Log Book Debit Statement's "Debit to" and rate on older Log Book rows – **"फक्त Admin / Super Admin"**: as now.
* A Night shift's diesel after midnight – **"standerd pramane thew time ratri 11.59 pm nantr lae h next day as"**: the calendar day, as now.

**No SQL.** No data is changed.

## What changes
* **Open & correct** (a user's own entry sent for verification and rejected / returned): it opens and its correction is checked from
  the day the entry was **sent** – as its approval and "Send again" already are (update-187). Before, an entry sent on 29-10 and
  rejected on 31-10 could not be corrected by its sender ("a user enters only today's entries"); one sent before the rule (before
  29-10-2026) was held by it there too.
* The day of a request from its "Requested At" (`reqDay_`): a time that cannot be read is never a fault (measured from today).
* **The page – his answers:** a user's Maintenance **Bill date** and a fuel card **payment date** offer only today (as the server already
  refused another day); "Read the bill (AI)" puts the bill's date for a user only when it is today's (the Admin's: the bill's own date).
* **The page – Daily machinery status:** its date box is free again for everybody – it also **shows** an earlier day (a user's Submit
  of an earlier day the server refuses with the words, as before).
* With it (other repositories, each its own pull request): the Store's and Engineering's pages read "today" again on a new day (a page
  left open past midnight gave a user only yesterday); their rig-only switch (`STORE_TODAY_RULE`, `ENG_DAY_RULE`) is never obeyed on
  Vercel; the phone app 3.62.1 moves "today" on with the live sync and keeps a user's read bill date to today.

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `flowDry_(…, at)` sets `REQ_DAY_` (cleared in its `finally`); `flowOpen_` / `flowEdit_` pass the request's `at`; `reqDay_` used in all three places |
| `app/App.html` | `USER_DATE_IDS` + `mt_date`, `cp_date`, − `bk_date`; `liveMsg` checks the same list; the bill reader keeps a user's date today |
| `test/unit.test.js` | `update-188` (and update-187's source checks to `reqDay_`) |
| `test/browser/today187.js` | three more checks (the two dates, the breakdown day) |

## Evidence
* Unit tests: **141 / 141** (`update-188`: the request's day – read, blank, unreadable; the dry run of Open & correct as a user: the day it
  was sent passes, a day before it refused, no time from today, sent before the rule not held; the source; the page's list and the bill reader).
* Local test rig, no Portal, a fresh copy – `today187.js` **16 / 16** (with the new: his Maintenance bill date and card payment date only
  today, said at once in the server's words; the Daily machinery status date free; no page error).
* The same rig with the Portal: Open & correct `fix130` **12 / 12**; verification `flow116` 17 / 18 (the one line is the copy's own
  "Database check" note – the same as before this change); the Portal's own test 119 / 119.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live site and a real phone. An Open & correct of a request sent days before, on the live data (the unit test runs the dry run itself).

## Going back
Vercel → Instant Rollback to the previous update. Nothing to undo in the database.
