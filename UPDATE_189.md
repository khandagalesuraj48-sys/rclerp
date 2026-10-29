# update-189 – a page's 4th access "Admin": its entries of an earlier day (29-10-2026)

**Asked (29-10-2026, 11:59):** "mi sangetlel pratek kam madhe edit no access view ani admin ha acess haway diesle inward issue transfer madhe
je back dated entry karnar aahet tyanche sathi te banwaych aahe". **His answers:** every page with a date; Admin = only that page's entries
of an earlier day. With the Portal (pages given there) and the phone app **3.64.0**.

**No SQL.** No data is changed (the access cells are text; "Admin" is a new word in them).

## What changes
* **Pages with a date** – Diesel Inward, Diesel Issue, Diesel Transfer, Log Book (its tank check too), Breakdown, Maintenance, Fuel
  Cards (a site on fuel cards) – have a 4th access **Admin**: Edit, and that page's entries of an earlier day – made, changed, deleted
  (as the site's Admin does since update-187). Another page as a user (today only; the Log Book also yesterday).
* **Unchanged:** the closed months; a billed or approved entry (only the Super Admin); every check of Edit (an Admin page is read as Edit).
* **Given:** in the Portal (Users & Access → his name → Pages: Admin · Edit · View · No access on a page with a date) and in Mechanical's
  own Users & Access. "Admin" on a page without a date is kept as Edit.
* **The page:** his date boxes of such a page offer any day; the others only today.
* A verification request of such a page: its approval and Open & correct count his Admin pages too (as the site's Admin).

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `DATE_PAGES_`, `WHAT_PAGE_`, `pageAdminOf_`, `permsShown_`; `ACCESS_` / `permOf_` know Admin; `readUsersSheet_` (`pageAdmin`, perms Edit); `saveUserAdmin_`; `usersAdmin_` (`dateAdmin`); `publicUser_` (`pageAdmin`); `ACTOR_PAGE_ADMIN_` wherever the one acting is set; `userDateRule_` |
| `app/Sites.gs` | the Portal's pages: Admin taken on a page with a date; shown as Admin |
| `server/portal.js` | the Portal's signed ticket may carry Admin (`ACCESS`) |
| `app/App.html` | `DATE_PAGE`, `pageAdminHere` (date boxes, `liveMsg`); Users & Access: Admin offered (`dateAdmin`), its colour; `accessKey` with pageAdmin |
| `test/unit.test.js` | `update-189` (and two source checks of update-187 / 188) |
| `test/browser/page189.js` | the rig test |

## Evidence
* Unit tests: **142 / 142**.
* Local rig (no Portal, a fresh copy): `page189.js` **8 / 8** (a user with Diesel Inward = Admin: an inward of 5 days back not refused for
  its date, a Log Book of 3 days back refused; Users & Access shows Admin, offers it on the 6 pages with a date of this site; his sign-in
  carries pageAdmin; his inward date box any day, his Diesel Issue box only today; no page error); `today187.js` 16 / 16.
* The same rig with the Portal: the Portal's own test **123 / 123** (with Admin given there: offered on the pages with a date, saved in
  Mechanical as "Admin", shown again; on a page without a date not taken) – it found that Mechanical's check of the Portal's signed ticket
  (`server/portal.js`) dropped Admin: put right. Verification `flow116` 17 / 18 (the copy's own "Database check" note, as before).
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live site and a real phone.

## Going back
Vercel → Instant Rollback to the previous update. A person given Admin on a page then has Edit there (today only) – nothing to undo.
