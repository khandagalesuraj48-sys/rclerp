# update-243 – HR's own backup Google Sheets (14-11-2026)

**Asked:** "hr sathi google sheet jodleli nahiye new sheet link de ani konala share karaychi te sang"; "ho banaw … fkt rcl hr";
"sheet madhe saglach data jayla pahije". Until now nothing of HR was in any backup.

**No database step. No entry, calculation, bill, ledger, stock or permission changes.** The backup only reads.

## What changes
### Mechanical (this repository)
* `server/backup.vm.js`: a fourth kind of backup next to a site's, the Portal's and Purchase's – **HR** (`target: 'hr'`): its own
  numbered Sheets kept at the first site (`BK_HR_SHEETS`, `BK_HR_STATE`, `SB_HR_INFO`, lock `backup_hr`). Its rows come only through
  HR's own backup export ("HR – …" tabs, each row with its site). The status tab says "RCL ERP HR – copy of the HR database …
  PRIVATE". Change link / Add Sheet N / Backup now as for the Portal and Purchase. A Sheet of a site, of the Portal or of Purchase
  is never given to HR, nor HR's to them.
* `server/bkexport.js`: where HR is – `HR_URL`, else where `vercel.json` sends /hr (`https://rcl-hr.vercel.app`).
* `server/portal.js` (the Portal's ticket may name `target: 'hr'`), `server/system.js` (kept at the first site; the Sheets already
  taken), `server/runtime.js` (the first site may write HR's Sheets – only those of its list; no Drive copy for it),
  `api/backup.js` (the nightly job: every site, the Portal, Purchase **and HR** – none given = "off").
* Help (EN / MR / HI): the full-Sheet rule knows HR; the export rule names rcl-hr.
### rcl-portal
* Portal → Sites: a new button **HR backup** (next to Purchase backup) – the same panel.
### rcl-hr
* `api/backup-export.js` + `lib/bkexport.js`: only for Mechanical's backup, with `BACKUP_EXPORT_SECRET`; every site's rows of
  **every table** (his word: everything – also the KYC and bank numbers and the pay). Not given: the sign-ins and the used
  tickets (not data); the face numbers of a person go as "(hidden)". A photo, selfie or paper is a file in HR's private store –
  the Sheet holds its place only, not the file. "My HR" has no data of its own (the same database).

## Before it works live (the owner)
1. Merge the three pull requests (rcl-hr, rcl-portal, rclerp).
2. Vercel → **rcl-hr** → Environment Variables → `BACKUP_EXPORT_SECRET` = the SAME value as in rclerp / rcl-portal /
   rcl-engineering / rcl-purchase → Redeploy rcl-hr.
3. The new, empty Google Sheet (erp@myrachana.com), shared with the backup robot as Editor (done by him 14-11-2026) → Portal →
   Sites → **HR backup** → its link → Give Sheet 1 → Backup now.

## Evidence
* Unit: rclerp 190 / 190 (new `update-243`; `update-195` follows the new lines); rcl-portal 36 / 36 (new: the HR backup button);
  rcl-hr 52 / 52 (new: the backup export – the secret, every table of the SQL steps in the list, sign-ins and tickets never).
* rcl-hr on the local copy of HR's database (`test/rig/backup_export.js`, 223 checks): all 52 tables are in the database with
  their key and "since" columns, every column and row is given, the list of tables comes in well under the backup's 10 seconds,
  the face numbers are hidden, no table of the database is forgotten.

## Not verified
* **`test/backup195.js` and `test/backup157.js` (the whole backup on the rig with the Sheets stand-in) were NOT run** – their
  count of nightly backups was changed from 4 to 5 by reading only. No HR twin of `backup195.js` was written: HR goes through the
  same lines as Purchase (`BK_OWN_`), read line by line, not run end to end.
* A real Google Sheet and the live projects (needs the merges, the secret in rcl-hr and the Sheet link). The Portal's five buttons
  were not looked at in a browser. How long the first full copy of HR takes live (it goes on over several runs, like a site's).

## Going back
Vercel → Instant Rollback (rclerp, rcl-portal, rcl-hr). HR's Sheet stays as it is; nothing in any database changes.
