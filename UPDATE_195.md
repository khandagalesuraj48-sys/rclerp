# update-195 – Purchase's own backup Google Sheets (30-10-2026)

**Asked:** "ata ya modual la google sheet asign kruya adhi"; his choice (asked): **Purchase's own Sheet** – every site's Purchase
data in one Sheet, like the Portal's backup; when it is full, Sheet 2.

**No database step. No entry, calculation, bill, ledger, stock or permission changes.** The backup only reads.

## What changes
### Mechanical (this repository)
* `server/backup.vm.js`: a third kind of backup next to a site's and the Portal's – **Purchase** (`target: 'purchase'`): its own
  numbered Sheets kept at the first site (`BK_PUR_SHEETS`, `BK_PUR_STATE`, `SB_PUR_INFO`, lock `backup_purchase`), like the Portal's.
  Its rows come only through Purchase's own backup export ("Purchase – People / Settings / Numbers / Activity" tabs, each row with
  its site). The status tab says "RCL ERP Purchase – copy of the Purchase database". Change link / Add Sheet N / Backup now as for
  the Portal. A Sheet of a site or of the Portal is never given to Purchase, nor Purchase's to them.
* `server/bkexport.js`: where Purchase is – `PURCHASE_URL`, else where `vercel.json` sends /purchase (`https://rcl-purchase.vercel.app`).
* `server/portal.js` (the Portal's ticket may name `target: 'purchase'`), `server/system.js` (kept at the first site; the Sheets
  already taken), `server/runtime.js` (the first site may write Purchase's Sheets – only those of its list; no Drive copy for it),
  `api/backup.js` (the nightly job: every site, the Portal **and Purchase** – none given = "off").
* Help (EN / MR / HI): the full-Sheet rule knows Purchase; the export rule names rcl-purchase.
### rcl-portal
* Portal → Sites: a new button **Purchase backup** (next to Portal backup) – the same panel: its Sheets, how full, the robot to share
  with, Give Sheet 1 / Change link / Add Sheet N / Backup now. Written in the Portal's record as "Purchase".
### rcl-purchase
* `api/backup-export.js` + `lib/bkexport.js` (the same file as the Portal's and Engineering's): only for Mechanical's backup, with
  `BACKUP_EXPORT_SECRET`; every site's rows; only the listed columns; never the sign-ins or the used tickets.

## Before it works live (the owner)
1. Merge the three pull requests (rcl-purchase, rcl-portal, rclerp).
2. Vercel → **rcl-purchase** → Environment Variables → `BACKUP_EXPORT_SECRET` = the SAME value as in rclerp / rcl-portal /
   rcl-engineering → Redeploy rcl-purchase.
3. A new, empty Google Sheet (erp@myrachana.com), shared with the backup robot as Editor → Portal → Sites → **Purchase backup** →
   its link → Give Sheet 1 → Backup now.

## Evidence
* Unit: rclerp 148 / 148 (new `update-195`); rcl-portal 19 / 19 (new: the Purchase backup button); rcl-purchase 7 / 7 (new: the
  backup export).
* Rig (Sheets stand-in, never a real Sheet): **`test/backup195.js` 32 / 32** – Purchase's export (secret, tables, every site, no
  sign-ins); the nightly job with 4 backups (Purchase without a Sheet "off"); Sites → Purchase backup: the first site's and the
  Portal's Sheets refused, not shared → told to share, its own Sheet 1 (Portal record "Purchase", first site's Activity Log, kept
  only at the first site); Purchase's Sheet refused for T2 and for the Portal; Backup now: the four tabs, every row of every site,
  only the listed columns, the status tab; the nightly job takes a new row; Add Sheet 2; the real Portal page (the four buttons on one
  line, the panel). **`test/backup157.js` 55 / 55** (the sites' and the Portal's backups as before; it now counts 4 backups).

## Not verified
* A real Google Sheet and the live projects (needs the merges, the secret in rcl-purchase and the Sheet link).

## Going back
Vercel → Instant Rollback (rclerp and rcl-portal; rcl-purchase). Purchase's Sheets stay as they are; nothing in any database changes.
