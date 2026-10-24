# update-157 – numbered backup Sheets for every site and the Portal, with the Engineering and Portal data (24-10-2026)

**Asked (24-10-2026):** "vtr ani 18 b chi 2 ni google sheet link tula mi new diel super admin 2 ni link change kru shakel new sheet
link deu shakel mhanje eka google sheet full zali tr new add krta yeil mhanje old pn asel but te backup sheet 1 zali nantr 2 number
chalu zali … site wise" and "18 b sathi mi google sheet link dileli nahi … purn data first to till date tya sheet madhe jayla hawa ani
sheet madhe daily rule je aahet backup tya pramane sheet madhe data yet rahil"; the backup of every module ("हो – सगळे modules").
Web only – the phone app is not changed ("he fkt web sathi app mdhe ky gheu nko"); what is entered in the app is in the same
database, so it is backed up the same way.

**No database step. No entry, calculation, bill, ledger, stock or permission changes.** The backup only reads the databases.

## What changes
### Numbered Sheets per site (`server/backup.vm.js`)
* Every site keeps its own list of backup Sheets in its own settings (`BK_SHEETS`), numbered: Sheet 1, Sheet 2, …; the Portal its
  own (`BK_PORTAL_SHEETS`, kept at the first site). The last one is the one in use.
* **Change link** – another Sheet in place of the one in use: the whole copy (its part) goes there at the next backup; the Sheet of
  before is left as it is (nothing in it is deleted).
* **Add Sheet N** – when the one in use is full (Google allows 10 million cells in one Sheet): the one before stays as it is and is
  never written again; the new one holds, **table by table, every row new or changed since an hour before that table's last
  copy into the one before** (a row may be in both, none is left out – an old entry corrected later goes into the new Sheet), the deletions since then
  (Deleted Rows) and the masters whole (machinery, vendors, BOQ, users, settings, the site lists, the Store's items). Sheet 1 +
  Sheet 2 + … is the whole data. Each Sheet's status tab says which number it is and what it holds.
* A site without a list yet uses the Sheet it had as its Sheet 1 (the first site `BACKUP_SHEET_ID`, another site the Sheet given at
  "New site") – so nothing changes until the Super Admin gives a link.
* A new Sheet 1 (18B, or a new link for VTR) gets **the whole data from the first day** at the next backup (in pieces, it goes on by
  itself), then every day as before (the nightly job, the first open page of the day, the Admin's Backup button).
* How full a Sheet is (its cells) is read after each copy and kept with it; at 80 % the Admin's Backup window and the Super Admin's
  panel say so; a full Sheet gives a plain message: "Sheet 2 of this site is full – … the Super Admin adds Sheet 3 …".
* The nightly job (`api/backup.js`) now runs every ready site (a site without a Sheet answers "off") and the Portal's backup.

### The Super Admin: Portal → Sites → Backup (rcl-portal), and Portal backup
* Per site: its Sheets (number, link, what it holds, how full – green, yellow from 80 %, red from 90 % –, in use / kept since,
  given by whom and when), the last backup, the robot's e-mail address to share each Sheet with; **Change link**, **Add Sheet N**,
  **Backup now**. "Portal backup" (next to "New site") – the same for the Portal.
* Every link is checked first (`server/system.js` `backupAdmin`, `bkSheetSet_`): the robot can open it ("share it with … as
  Editor" otherwise), it is no other site's or the Portal's Sheet, it is not an earlier Sheet of the same site. Written in the
  Portal's record and in the site's Activity Log.

### The other modules' data (Engineering, the Portal)
* Engineering's rows of a site go into **that site's** Sheets ("Engineering – Road / Masters / Works given / People / Plans and
  reports / Reasons / Activity"); never another site's. The Portal's users (passwords and recovery codes "(hidden)"), access, sites,
  companies, modules and activity record into the Portal's Sheets. The sign-ins, used tickets, counters and signing keys are never
  given.
* They come through each module's own **backup export** (`api/backup-export.js` + `lib/bkexport.js`, the same file in rcl-portal and
  rcl-engineering), asked with `BACKUP_EXPORT_SECRET` – the same value in Vercel for the three projects; each module keeps its own
  database key. `server/bkexport.js` here (the Portal at `PORTAL_URL`; Engineering at `ENGINEERING_URL`, else where `vercel.json`
  sends /engineering). If Engineering cannot be reached, the site's own data is still backed up and the panel says so.

### Help (EN / MR / HI)
* `FIX_RULES`: a full Sheet; the other modules' data not given (the secret); "backup of this site is not set up" now says where the
  Super Admin gives the Sheet.

## An independent review (25-10-2026) – what it found and what was changed
A separate review of this change (security and data-safety) found 3 high, 2 medium and 6 low points. Changed:
* **Engineering failing while its rows are read no longer stops the site's backup.** Each table of another module is read on its
  own: one that fails is noted in the status ("not copied now – …") and tried again at the next backup; the site's own tables come
  first; a table is read 300 rows a page (far below what an answer may carry) and never past the run's time; the catalog is asked
  with a 10-second wait. Before, one such failure stopped every later table of the site – for good.
* **"Add Sheet N" when the Sheet filled in the middle of a copy.** The next Sheet now starts **table by table** from an hour before
  that table's last copy into the full Sheet (a table not copied into it keeps the start it had). Before, it then took
  everything again – and filled up too.
* **A Sheet used before is never given again**, to this or another site: a changed link keeps the old Sheet in the site's list
  ("was"), and the Sheet a site had before its list counts too. A Sheet that already holds a backup (a "Backup Status" tab) is
  refused, so is one shared as Viewer (the robot must be able to write – its status tab is made when the link is given).
* **One change of a backup Sheet at a time** for all sites (a lock in the first site's database); the Sheets of a closed site, and the
  Sheet typed at "New site", are checked against every other site's too.
* A run that waited while the Super Admin gave a new Sheet does not write into the old one; the notes of a run say which Sheet they
  are for. A short "Backup now" that runs out of time is "goes on by itself", not an error.
* The server checks that a Sheet the backup writes is on that site's own list (before, it trusted the name it was given).
* The status says when Engineering's data is left out because `BACKUP_EXPORT_SECRET` or Engineering's address is missing
  (`ENGINEERING_URL` – now in README; set it in Vercel to be sure). The secret is read without spaces or a pasted line end.
* The Portal's users go out with a **list of columns** (a column added later never leaves by itself); passwords and recovery
  codes stay "(hidden)".
* A link like `…/spreadsheets/u/1/d/…` (a second Google account in the browser) is taken.
**A second review of the fixes** (25-10-2026) found four more, fixed: a big table of another module (e.g. 30,000 rows of activity) is
now copied **in pieces** – each run goes on where the one before stopped (before, it started again every run and never finished);
the status tab made when a Sheet is given carries the mark "given to site …", so a giving that did not finish can be done again by the
same site only (before, the Sheet was then refused for good); a table not copied because the other module failed is tried again at
the next backup and named in "Still to copy"; a short "Backup now" that ran out of time says "press Backup now again". "New site"'s
Sheet check is under the same lock; a closed site brought back with its own Sheet is not refused. Two settings for tests only:
`BK_HARD_MS` (a shorter run) and `BK_REMOTE_ROWS` (smaller pages) – normally not set.
Not changed (noted): another module's table is read by position, so a row saved in the same second may come twice or be missed in
that one copy (the next copy has it); a row deleted in Engineering, the Portal or the bill evidence is not listed in "Deleted Rows"
(those have no delete log); after an Instant Rollback the old code keeps the notes of the new Sheet – the old Sheet catches up at its
daily full copy.

## Evidence (local test rig – never live)
* Unit: Mechanical **112 / 112** (two checks follow the new names: the lock of this backup `T.lock`, the tab name `tabOf`; the
  line of `sysPrefLang` kept as it was); Portal **10 / 10** (1 new: the export – only with the secret, only its tables, passwords
  hidden, "since" filter, at most 1,000 rows a page, a bad "since" refused); Engineering **17 / 17** (1 new: the export – a site
  must be named, every question names it, never the sign-ins, the "since" filter of a plan or report). `node --check` on every
  server file; the pages' script blocks parse; no secret in the change.
* **`test/backup157.js`** (the Sheets stand-in now keeps several spreadsheets, can refuse one, act as a Viewer share and be full):
  **55 / 55** on a fresh rig – the 43 below, 9 for the review and 3 for the second review (a Sheet marked "given to site T2"
  refused for S1 and taken for T2; Engineering's activity of 30,000 new rows copied in 4 pieces – "… rows so far" – then exactly its
  rows, each once). The 9 of the review: its own Sheet of before and another site's refused; a Sheet that
  holds a backup refused; a Viewer share refused ("cannot write it"), the site's Sheet unchanged; Engineering failing on one table
  (a fault at its database): the site's own backup written (a new machinery in Master), not failed, the status names the table, the
  next backup copies it; Sheet 3 added while Sheet 2 was not complete: the Log Book keeps its start of Sheet 2, the Activity Log
  starts from its own copy, and Sheet 3 holds exactly those rows. The 43 (after the Portal's and Engineering's
  own tests, which put their rows in): the export doors refuse without the secret or with a wrong one, never give the sign-ins, hide
  every password and recovery code, Engineering only with a site and only that site's rows, "since" works; the nightly job writes the
  first site's Sheet of before as its Sheet 1 with Engineering's S1 rows ("Engineering – …"), 18B and the Portal (no Sheet yet) left
  out, nothing written anywhere else; the Portal: a Sheet not shared with the robot refused with the robot's address, the first
  site's Sheet refused for T2, T2's own Sheet given (Portal record + T2's Activity Log), "Backup now" writes T2's whole data (its own,
  not S1's); S1 "Change link": the whole of S1 into the new Sheet 1, the Sheet of before not written again; "Add Sheet 2" with Sheet
  1's own link refused; Sheet 2: only the rows changed since (an old entry corrected now), the masters whole, its status tab "Sheet 2
  of 2", Sheet 1 not written again; a full Sheet gives the "Sheet 2 of this site is full … adds Sheet 3" message; the Portal's own
  Sheet (T2's refused): Users, Access, Sites, Companies, Modules, Activity, passwords "(hidden)", every user; the real Portal page
  (Sites → Backup of S1: Sheet 1 kept, Sheet 2 in use, how full each is, the robot's address, the buttons), no script error. The
  page's picture: `bk157-sites-backup.png` (kept with the test results, not in the repository).
* **`test/backup.js`** (the backup test of before, main and this branch, the same rig): the same **40 pass / 9 fail on main and on this branch, the same
  9 checks** (compared line by line; run with the sites' key so the nightly job reaches every site): the 9 are checks written for the
  data and Sheet layout of an earlier rig (the Diesel Issue / Master tab, the Store's log, the Activity Log's "only new rows", the
  "TEXT stays text" cell, the several-sites tables) and fail on main too. Differences seen only in the details: the nightly job now
  says `sites: 3` (every ready site and the Portal) instead of 1; the status tab has the lines "Site", "This Sheet", "It holds"; the
  Admin's answer carries `sheetN`, `sheets`, `cells`.
* The Portal's own tests on this branch: `api.test.js` 111 / 111, `browser.test.js` 34 / 34 in 7 of 9 runs (two runs: the New site
  step sent an empty site code and the 4 checks after it failed); on main the same test is not steady either: 34 / 34 in 2 of 3 runs
  (one stopped at its line 58, waiting 20 s for a screen) – a timing of this rig's browser, not of this change;
  Engineering's `api.test.js` 81 / 82 (the same check fails on main – a name on the rig's list of people).

## Not verified
* Real Google Sheets (the stand-in answers the calls the backup makes; the 10-million-cell message is Google's wording as known).
* The live sites, Vercel's real instances, the nightly job on Vercel.
* A Sheet given while a backup of that site is running is refused with "A backup is being copied right now – try again in a minute" (seen in the code, not run).
* Two Super Admin tabs giving a Sheet at the same moment (the lock across sites) – read in the code, not run.

## What the owner does (after merging)
1. Vercel → **rclerp**, **rcl-portal** and **rcl-engineering** → Settings → Environment Variables → add `BACKUP_EXPORT_SECRET` = one
   long secret word (at least 24 letters and digits – better 40 random ones), **the same in all three**, for Production → in rclerp
   also `ENGINEERING_URL` = Engineering's address (e.g. https://rcl-engineering.vercel.app) → Redeploy each.
2. For VTR and 18B: make a new, empty Google Sheet each, share it with the backup robot's address (shown in the panel) as Editor,
   then Portal → Sites → *the site* → Backup → paste the link → "Give Sheet 1" / "Change link of Sheet 1". The same for the Portal
   (Portal backup) if wanted.
3. The next nightly backup (or "Backup now") fills them.

## Going back
* Vercel → Instant Rollback to update-156 (rclerp) and to the Portal's / Engineering's deployment before. The Sheets already written
  stay as they are; the first site falls back to `BACKUP_SHEET_ID` as before; 18B goes back to having no backup.
