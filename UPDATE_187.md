# update-187 – back-dated entries only by the Admin and the Super Admin (29-10-2026, urgent)

**Asked (29-10-2026, 09:27):** "diesel issue krnare user la date madhe confusen hotey kadhi kadhi tyanchi date auto maghchi selct hotey
jas ki aaj 29 aahe tr tyan entry 28 madhe kel aahe … admin ani super admin fkt back dated entry kru shakto baki konich nahi ok jo entry
user karayla jail tyala auto aajchi date select aasel tyala date change krta yenar nahi ani ha apan modual wise banwaych".
**His answers:** the Log Book – a user also yesterday ("Log Book ला काल + आज"); Engineering – a user's report of yesterday and today
(the Engineering module's own piece of work). With the phone app **3.62.1** (its date pickers; a half-filled entry of an earlier day
no longer brings back its old date – the cause of the entries saved on the 28th).

**No SQL.** No data is changed.

## What changes
* **A user who is not the site's Admin** makes, changes and deletes only entries of **today** – a **Log Book** entry (and its water
  tanker trips) also of **yesterday**. Every entry: Diesel Issue (one, many, Excel), Inward, Transfer, Log Book, Tank check, Breakdown
  report, Maintenance bill, fuel card payment – their changes and deletions too (every place that calls `booksOpen_` / `entryOpen_`). Refused in his words:
  "Diesel issue of 28-10-2026: a user enters only today's entries – an entry of an earlier day is made, changed or deleted only by the
  Admin or the Super Admin. Ask the Admin." (help in English, Marathi, Hindi).
* **The Admin and the Super Admin:** any day, as before (closed months as always). The Super Admin's approval of a change request is his.
* **Settings → Rules of this site** ("the last … days"): now only stricter – 0 = the Log Book too only today; empty = as fixed. Its
  label says so.
* **An entry sent for verification** is measured from the day it was **sent**: approved (or sent again) days later it still saves. One
  sent before this rule (before 29-10-2026) is not held by it.
* **The page:** a user's date boxes offer only today (the Log Book's today and yesterday) – `min` / `max`, a tip; a day before is said at
  once, with the server's words (`liveMsg`).

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `userDateRule_` (first in `booksOpen_`), `userDays_`, `REQ_DAY_` (set from the request's time where a sent entry is saved at its last approval – `flowDecide_` – and where it is sent again – `flowResendOne_`), `USER_TODAY_FROM_`, `USER_DATE_RULE_ON_` |
| `app/App.html` | `userDays`, `userFloor`, `userDateBox` (focusin / pointerdown), the check in `liveMsg`, `FIX_RULES` rule (update-187), the Rules label |
| `app/i18n` | 8 texts in Marathi and Hindi (added at the end) |
| `test/harness.js` | `USER_DATE_RULE_ON_ = false` for the unit tests of before (they keep their fixed dates); `update-187` tests the rule itself |

## Evidence
* Unit tests: **140 / 140** (`update-187`: a user today only, the Log Book also yesterday, every kind of entry; the Admin and the Super
  Admin any day; the site's rule only stricter (0 / 3 / empty); a request approved 3 days after it was sent still saves, a day before it
  was sent refused, one sent before the rule not held; the real Log Book save and delete of a user and of the Admin; the source).
* Local test rig (no Portal, a fresh copy of the database) – `test/browser/today187.js` **13 / 13**: a new user (not Admin) – Diesel
  Inward of yesterday refused with the words, of today not refused for its date; Log Book 2 days back refused, yesterday saved; the Admin's
  inward of 5 days back not refused for its date; his Diesel Issue and Inward date boxes: only today, yesterday said at once in the
  server's words; his Log Book date: yesterday or today; the Admin's date box: no limit; no page error.
* The same rig with the Portal (the users sign in there): verification – `flow114` 11 / 12, `flow116` 17 / 18 (sent, sent back, sent
  again, approved and saved; the one line of each is the page's "Database check: 4 thing(s) to do" note of this copy, where the newer
  SQL steps are not run – not about this change); diesel sources per person – `dsrc162` 26 / 26; the Portal's own test 119 / 119.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live site and a real phone. The verification approvals on the live data (the unit tests and the rule's own test cover them).
* `settings.js` on the rig failed twice on the copy's own names (it expects "Sujit", the copy has "Sujit Test") – not about this change; not run on the code before it.

## Going back
Vercel → Instant Rollback to the previous update. Nothing to undo in the database.
