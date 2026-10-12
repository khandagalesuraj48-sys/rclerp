# update-84 – a user sees only the pages he was given (12-10-2026)

Asked by the owner on 12-10-2026: "the user sees only what he was given – Diesel Issue given, then only that, nothing else,
not even View."

No database step, nothing to set in Vercel. Live is update-83 (`ba388b1`); built and tested on the local rig only.

## What was wrong (from the code)
* Users page, "+ Add user": every page of the new row started at **View**. Giving only Diesel Issue = Edit left every other
  page at View, so the user saw everything.
* A new user saved without a page (`saveUserAdmin_`) left its cell empty, and an empty cell counts as View.
* The search (Ctrl + K) showed the Machinery and Owners results with the buttons Log Book, Ledger, Master and Debit statement
  to everybody, whatever his access.
* At sign-in the Dashboard was opened first; a user without the Dashboard got the red "You do not have access to Dashboard.
  Ask Admin." (found while testing this). The rule that moves him off a page he may not open looked only at a page he had
  clicked, and only in the Machinery group.

## Now
| Place | What changes |
|---|---|
| Users page – "+ Add user" | every page starts at **No access**; Admin sets View / Edit only where he wants |
| Server – a new user | a page not sent is written "No access" (Admin = Edit) |
| Search – Machinery | shown only when he may open Diesel Issue, Log Book, Reports or Asset Master; each button only for a page he may open; a click opens the first of these |
| Search – Owners | only with Asset Master; "Debit statement" only with Reports |
| Sign-in | a user who may not open the Dashboard lands on his first page (a Machinery page if he has one, else any of his); the same when Admin takes away the page he is on – any group, not only Machinery |
| Help (EN / MR / HI) | Users page: a new user starts with No access |

Not changed: users already saved (their access stays as written – Admin changes it in the Users page; "Set a whole column → all No access"
does it for a whole column). An EMPTY cell in the Users table still counts as View (the Access report lists them). The server search
and every page already followed the access.

## Evidence (local rig; every command with a time limit, none reached it)
| Test | Result |
|---|---|
| `access84.js` (new, real pages): "+ Add user" – all 17 pages No access; only Diesel Issue = Edit → Add → that user has Diesel Issue Edit, No access on the other 16; the same through the server with only one page sent; signed in: the menu shows Diesel Issue and his own Settings only; search "n84-jcb" → machinery with "Diesel issued" and "New issue" only, groups Machinery / Diesel issues only; the owner's name → no Owners result; the driver → his diesel issue, a click opens Diesel Issue; a Log Book View user → machinery with "Log Book" only, opens the Log Book, no diesel issue; sign-in: the Diesel Issue user lands on Diesel Issue, the Log Book user on the Log Book, no "You do not have access" from the server; Admin unchanged (all buttons, owner found); no script error | 18 passed, 0 failed |
| unit | 56 / 56 (net not run here) |
| search83 13 / 0 · least68 9 / 0 · sweep 38 / 0 · group72 13 / 0 · hardenpage 10 / 0 · saveonce 44 / 0 · secure68 48 / 0 · harden 27 / 0 · backup 28 / 0 | all 0 failed |

## Not verified
* The live site and his real users.

## To deploy (owner; no SQL)
```
cd "C:\Users\aghug\Desktop\WEBSITE AND APP\rcl-fleet-erp"
git status
Expand-Archive -Path "$HOME\Downloads\rcl-update-84.zip" -DestinationPath . -Force
git status
git add .
git commit -m "update-84: a user sees only the pages he was given"
git push
```
