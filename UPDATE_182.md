# update-182 – the Maintenance page tidied; the Admin deletes a machinery's log book (28-10-2026)

**Asked (28-10-2026, 18:56, with 6 screenshots):** "apan maintanace madhe je banwale log book pdf import karun tithe admin or super admin
gadich log book maintanace ch delet pn karu shakel as de … Maintenance bills ha section remove kr to nko mala Import the old log book
(Excel or PDF) he etk moth nko he pn perfect thikani gheun ja nit basw yala pn Maintenance Log Book party name che khali chande delet
nko natr particular che khali edit delet nko pratek entry che last la edit delet asa option de nantr jith mi bil upload keto te hi
perfect baanw ughach ase moth e mothe section nko". With the phone app **3.58.0** (the same, as the app's own screens – not released).

**No database step.** No table, no row is changed by the update itself. No secret in any file.

## What changes
* **"Maintenance bills" is taken out** of the Maintenance page (the list, its dates, its machinery filter, its total). The bills are seen
  in the **Maintenance Log Book** – each bill changed from there (a line's Edit → "Change the whole bill").
* **The bill's form is compact:** a slim head (a small sign, one short line), the boxes closer, "How the amounts work" folded.
* **"Import old log book (Excel / PDF)"** is a small button at the top right of the Maintenance Log Book's card (for everyone with
  Maintenance Edit, as before). It opens the import's small box under it (Choose the file · Download the format; "How the file is
  read" folded); ✕ closes it. The import works as before.
* **The Maintenance Log Book:** nothing under the Party Name (no Change / Delete there) and nothing under the Particulars (no Edit /
  Delete there). An **Action** column at the end – each entry **Edit · Delete**, the bill's files **📎** on its first row. On the screen
  only – not printed, not in the Excel. The column stays in view at the rows' end when the table is wider than the page.
* **"Delete this log book"** (red) – **the Admin / Super Admin only** – after Show: all the maintenance bills of that machinery in the
  dates shown (or Start to end). Asked first with the number of bills and their ₹; **the machinery number is typed to confirm** (a wrong
  one: "Not deleted"). The server deletes only when it still has as many bills as shown (a bill added / deleted meanwhile: refused,
  nothing deleted); a bill of a closed month: refused. What the RCL Store issued and the fuel stay. **Each bill deleted is written in the
  Activity Log with its values.**
* Words and help in English, Marathi, Hindi (`app/i18n`; the help rule of update-182 at the end of `FIX_RULES`; the update-180 rule's
  text fixed). New action `deleteMaintLog` in `API_` (`admin: true`) and in `PAGE_GUIDE` (`saves`).

## Code
| Where | What |
|---|---|
| `app/Code.gs` | `API_.deleteMaintLog` (`admin: true`, `log: 'maintLogDelete'`); `deleteMaintLog_(x)` (`withLock_`, the count check, `booksOpen_`, deletes from the bottom; the deleted values kept out of the answer); `logAfter_` `maintLogDelete` – one Activity Log line a bill |
| `app/App.html` | the bills list out; `mtLoad` reads only the names the boxes offer; `.mlb-head` with `#ml_imp`; `#mti_panel.mti-box`; the bill's slim head, `details.mt-howd`; `mlogShow` – the Action column (`mlog-acth` / `mlog-actd` / `mlog-actf`, sticky), `#ml_delall` (Admin, `btn danger`); `rpmlog_body` clicks; `mtFilesView`; `mlLineEdit` → `#mll_bill` "Change the whole bill"; `FIX_RULES`, `PAGE_GUIDE`, guide texts |
| `app/i18n` | 40 new texts appended to `keys.json`; their Marathi / Hindi |

## Evidence
* Unit tests: **135 / 135** (`update-182`; 6 older assertions moved to the new page).
* Local test rig (PORTAL=1, RCLSTEPS=1, claude mode) – `test/browser/mnt182.js` **16 / 16**: no bills list; the slim head; the import's
  button and box; the Action column (Edit · Delete, 📎 1), nothing under Party / Particulars, not in the print / Excel, in view at the
  rows' end; a line's Edit → the whole bill in the form; not the Admin – no Delete; the server refuses another count; a wrong number –
  nothing deleted; "rl 182" typed – its 3 bills deleted, the other machinery's bill stays, 3 Activity Log lines. Pictures:
  `mnt182_form.png`, `mnt182_import.png`, `mnt182_logbook.png`, `mnt182_delete.png`.
* The older Maintenance page tests moved to the new page and passing: `mline180` 15 / 15, `mnt165` 32 / 32, `mnt168` 29 / 29,
  `mnt170` 20 / 20, `mnt173` 24 / 24 (mnt165 / mnt168 without RCLSTEPS, as written); the Portal's own test 119 / 119.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live Supabase / Vercel; a real phone.

## Going back
Vercel → Instant Rollback to the previous update. Nothing to undo in the database (bills deleted with "Delete this log book" stay
deleted – their values are in the Activity Log).
