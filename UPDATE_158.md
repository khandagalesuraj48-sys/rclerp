# update-158 – Storage (how full every place is) and the copy of the photos and files to Google Drive (25-10-2026)

**Asked (24-10-2026):** "super admin ani admin la he hi disaw ki supabase storage kiti aahe ki to bharley same google sheet kiti bharle
kiti baki jene karun new kahi krtana admin super admin nkki vichar krel"; "baki sagle files photos attachment drive madhe
organazation madhe astil mhanje sagle ektr nasel ok as proper sturucture banaw"; the Drive of the company's own Google account (the one he chose for the backup), "Free ने सुरू,
80% ला वाढवू"; "Admin: स्वतःची site; Super Admin: सगळ्या sites + एकूण"; "ho sagle suru kr he fkt web sathi app mdhe ky gheu nko ha but
app mdhun entry kelela data pn backup hoyla ahaw" – web only; what is entered in the phone app is in the same database and is copied
the same way.

**One database step: `sql/supabase_step1zf_storage_drive.sql`, in EVERY site's Supabase** (VTR NH 848, 18B KOLHAPUR), after 1ze. It
only ADDS: two read-only functions (`web_usage` – the size of the database and of its files; `web_files` – the list of the app's
files for the copy) and two new, empty tables: `backup_drive` (what is already in Drive – each file once; insert only, a line is never
changed or deleted) and `backup_drive_state` (one line: how far the copy got, how many, the files to try again). With it: rcl-portal `sql/portal_step4_usage.sql` and rcl-engineering `sql/eng_step2_usage.sql` (only
`web_usage`) – for their database sizes. **No entry, calculation, bill, ledger, stock or permission changes.** The copy only READS the
files; it never changes or deletes one, here or in Drive.

## What changes
### Storage
* **The Admin** (his own site): the Backup window (the cloud button in the top bar) now also shows **Storage** – the database (of
  8 GB, Supabase Pro), the photos and files (how many, how big – the 100 GB are for every site together), the backup Sheet in use (of
  1 crore cells), the Google Drive copy (how many files, the last copy). Green; **yellow from 80 %; red from 90 %** – and a line
  "tell the Super Admin" when something is 80 % full.
* **The Super Admin**: Portal → Sites → **Storage** – every site the same, the Portal's and Engineering's own databases, **all photos
  and files together** (of 100 GB), and the Google Drive: which account, how full (as Google says), "Connect Google Drive", "Copy files
  now" per site.
* Asked once in 10 minutes per site (`storageUsage_`, `drvQuota_`); the database is asked by `web_usage()` – until step 1zf it says
  which file to run.

### The copy of the files to Google Drive (`server/drive.vm.js`, `server/drive.js`, `api/drive.js`)
* **Connect once:** Portal → Sites → Storage → "Connect Google Drive" → Google asks the company's account "Allow" →
  Google sends it back to `/api/drive` (a one-time state the Super Admin's press made, good for 15 minutes) → connected. The app gets
  ONLY `drive.file`: it sees and makes **only its own folder "RCL ERP – Files (backup)"** there – nothing else of that Drive. What
  Google gives (the refresh token) is kept **locked** (`RCL_SITES_KEY`, like a site's database key) in the first site's settings.
* **The folders** (every site its own, every kind its own, by year and month, every entry its own folder):
  ```
  RCL ERP – Files (backup) / VTR Site – NH 848 (S1) / Diesel Issue photos   / 2026 / 10 October / 05-10-2026 MH-15-AB-0002 DI-000123 / Dashboard 1.jpg
                                                    / Diesel Inward bills    / 2026 / 10 October / 04-10-2026 IN-000012 <pump> / Bill copy 1.jpg
                                                    / Log Book attachments   / 2026 / 10 October / 05-10-2026 MH-15-AB-0002 Day / <its name>
                                                    / Bills / 2026 / RA-12 rev 1 – <vendor> / shortcuts to the files of its Log Book as submitted
                                                    / Not linked to any entry / erp-files / 2026 / 10 October / <file>
  ```
* **Each file once:** a file on two entries is copied into the first and the other gets a **shortcut**; a submitted bill's folder
  holds shortcuts to its files; a file no entry has (a day old at least – one just sent may still be saved with its entry) goes to
  "Not linked to any entry". Noted in `backup_drive` – nothing is copied twice; another Google account gets its own whole copy.
* **Checked:** the file goes from the file store to Drive inside the server's helper thread (never through the app's code), its MD5 and
  SHA-256 worked out on the way; it is noted only when **Drive's MD5 of what it received = the file's** (and an attachment's SHA-256 =
  its name). A file that cannot be copied (not in the file store, not received whole) waits on a list and is **tried again by
  itself** – after an hour, after 6 hours, then every day; Storage shows how many wait ("not copied yet – tried again by itself").
  One whose copy reached Drive but was not right is tried 3 times by itself (each try leaves that copy in Drive – nothing is deleted
  there), after that only with "Copy files now". One file never holds up the others.
* **When:** with the backup – the nightly job and the open pages (every 30 minutes; every 3 minutes while files are left), in pieces
  of about half a minute (a "Copy files now" press: about 17 seconds); an entry a minute after it was saved at the earliest. The first
  copy (every file from the first day) goes on by itself. Where the copy is, is kept in `backup_drive_state` – not in the settings
  (a change there would make every server read all settings again).
* **A folder deleted by hand in that Drive:** an entry's own folder is made again (with all its files) when something goes into it
  again; a bigger folder (the site's, a kind's, a year's, a month's – these are checked once a day) – the whole copy of the site is
  made again, in "<site> – made again <date>" (the old folder stays as it is). Storage says what happened (for a week). The backup's
  own folder deleted: "connect Google Drive again" – a new folder, the whole copy again.
* **Only the company's account:** with `DRIVE_ACCOUNT` (= that account's address) in Vercel, "Allow" from any other Google account is
  refused – nothing is connected.
* **Drive full / access taken back:** said plainly in Storage ("Google Drive is full … buy more Google storage", "connect Google Drive
  again"); nothing is lost – the copy goes on when it can. Connected again with the same account: the same folder, nothing twice.
* **Never deleted:** the app has no call that deletes or shares anything in Drive (the stand-in counts them: 0).

### Help (EN / MR / HI)
* `FIX_RULES`: the Drive copy could not be made (full, access stopped, not set up).

## Evidence (local test rig – never live)
* Unit: Mechanical **112 / 112** (the Drive right: only `server/drive.js` asks one, and only `drive.file`; the backup door's
  answer adds the files still to copy; step 1zf listed in Read Me word for word, in the staging SQL file); Portal **11 / 11** (1 new:
  `usage` – only with the secret, nothing else read, before its step: which file to run); Engineering **18 / 18** (the same).
  `node --check` on every server file; the pages' script blocks parse; no secret in the change.
* **`test/storage158.js`** (Google's sign-in and Drive: `test/drive-standin.js`; the rig's file store keeps `storage.objects` rows as
  Supabase does) – **36 / 36** on a fresh rig (after the review): Storage before Drive – S1's database (as the database counts it) and every file, T2
  without step 1zf says which file to run, the Portal's and Engineering's databases; "Connect Google Drive" asks Google ONLY for
  `drive.file` with lasting access; a state nobody gave refused, the real one connects (the account, the backup's own folder, the
  refresh token LOCKED – not in the settings as it is), the same answer again refused, written in the Activity Log; "Copy files
  now": Diesel Issue photos "… / Diesel Issue photos / 2026 / 10 October / 05-10-2026 MH-15-B158 B158-DI1 / Dashboard 1.jpg", the
  inward's "Bill copy 1.jpg", a file on two Log Book entries copied once + a shortcut in the second, a PDF and a 6 MB photo (the
  resumable way) whole, the submitted bill's folder "Bills / 2026 / RA-158 rev 1 – Rig Vendor" with shortcuts, a file no entry has
  in "Not linked to any entry", the one sent just now not yet; each noted once with Drive's MD5 = the file's; the copy's notes in
  `backup_drive_state`, none in the settings; pressed again: nothing twice; the nightly job: a file Drive did not receive whole is
  NOT noted, said, put on the try-again list (the others go on) and copied whole an hour later, off the list; T2's photo in T2's own
  folder; Storage after – the Drive's account and how full; Drive full – said plainly, not noted; the access taken back – "the
  Super Admin connects Google Drive again"; connected again – the same folder, only the file left over copied; the Admin's Backup
  window (server and the real page); **an entry's folder deleted by hand in Drive** – made again with its old and its new photo, the
  copy did not stop, said in Storage; **a kind's folder deleted by hand** ("Diesel Inward bills") – the whole copy of the site made
  again in "VTR Site – NH 848 (S1) – made again <date>", every file once there, the old site folder kept, said in Storage; the real Portal page (Sites → Storage); no script error on either page; **nothing ever
  deleted or shared in Drive** (the stand-in counts such calls: 0). Pictures: `storage158-portal.png`, `storage158-admin.png`
  (kept with the test results, not in the repository).
* On the same rig and branch (the final tree): `test/backup157.js` **55 / 55** (update-157 unchanged by this); the Portal's
  `api.test.js` 111 / 111; its `browser.test.js` 34 / 34 in two runs, 13 / 5 in the third – at "New site" the code typed into the
  form was lost (the known unsteady step of this rig, main too); Engineering's `api.test.js` 81 / 82 (the same check fails on main).
* Found on the way (tests only): typing into the Portal's sign-in page as soon as it has loaded can be lost – the page's first calls
  are still running (5 sign-ins: 2 did not happen). `test/backup157.js` and `test/storage158.js` now wait for those calls (10 of 10
  then); the page itself is not changed.
* `test/backup.js` (the backup test of before) with steps 1zc – 1ze in the rig's site databases: **36 pass / 13 fail on main and on
  this branch – the same 13 checks** (the 9 of before, and 4 about the tables of step 1zc that the old test does not know).

## Not verified
* A real Google account, real Google Drive, the real Google sign-in page (the stand-in answers the calls the copy makes, the way
  Google's documents describe them); the Google Cloud consent screen and its publishing; Google's real storage numbers.
* Real Supabase Storage (`storage.objects` is a stand-in table on the rig; the real one has the same columns the functions read);
  the live sites; Vercel's real instances and time limits; the nightly job on Vercel.
* How long the first copy of the live files takes (their number and size are not known here).
* An upload into a folder that is in Drive's bin (not deleted): what Google does is not verified – the root, site and kind folders are
  checked for the bin; an entry's folder is not.
* Known limits: an old entry's folder deleted by hand is made again only when something goes into it again (the entry changes); a
  shortcut elsewhere to a file that was in a deleted folder points to nothing; a run Vercel stops between an upload and its note can
  leave one extra copy of that file in Drive (never a missing one).

## Review (25-10-2026, an independent check of the whole change) – what changed after it
The review found no secret leak and no way past the access checks. What it found, and what was done:
1. **The new table would have slowed and then stopped the Sheet backup** (it grows with every file, and was copied whole every night)
   → `backup_drive` and `backup_drive_state` are not copied into the backup Sheet (`SB_SKIP_`; they only say where the files are in
   Drive – Drive itself holds the same).
2. **One Drive error could stop a site's copy for good** (a folder deleted by hand) → a missing folder is made again (an entry's
   own) or the whole copy of the site is made again (a bigger one); the root, site and kind folders are checked (the root every run,
   the others once a day); an entry Drive refuses three runs in a row goes to the try-again list and the copy goes on.
3. **Extra copies in Drive** → what was copied is noted even when the batch stops half-way; the same file twice in one entry is sent
   once; a copy that reached Drive wrong is tried 3 times at most by itself.
4. **The time limit** → the copy knows the request's last moment (the pool's 58 s), every call to Google gets only the time left, a
   batch is not started with less than 12 s left, running out of time is "goes on next time" (not an error).
5. **A passing problem could skip a file for ever** → the try-again list (after an hour, 6 hours, then every day; "Copy files now"),
   a file is taken off the list when it is copied.
6. **Load on the live site** → where the copy is, is kept in its own table (not the settings); written after a page of entries and at
   the end, not after every file; without step 1zf it asks again in 30 minutes; open pages copy every 3 minutes while files are left.
7. **An entry saved at the very moment of a run could be passed** → an entry is copied a minute after it was saved at the earliest.
8. **Hardening** → `DRIVE_ACCOUNT` (only that account can be connected); two "Allow" answers at the same moment: only one connects (a
   lock); the page Google comes back to shows only fixed text; the test addresses for Google work only off Vercel; the file store is
   read without following a redirect; a big file's MD5 is asked from Drive when the last piece's answer has none.

## What the owner does (after merging)
1. **The SQL:** `sql/supabase_step1zf_storage_drive.sql` in **every site's** Supabase (VTR, 18B); `portal_step4_usage.sql` in the
   Portal's; `eng_step2_usage.sql` in Engineering's.
2. **Google Cloud** (the project of the backup robot, or a new one): APIs & Services → Library → **Google Drive API** → Enable. OAuth
   consent screen → External (or Internal if the project belongs to the company's Google Workspace) → app name "RCL ERP backup", the scope
   `…/auth/drive.file` only → **Publish app** (in "Testing" the access stops after 7 days). Credentials → Create credentials → **OAuth
   client ID** → Web application → Authorized redirect URI: the address Portal → Sites → Storage shows (this app + `/api/drive`).
3. **Vercel → rclerp** → Environment Variables: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `DRIVE_ACCOUNT` =
   the company's Google account for the backup (and `DRIVE_REDIRECT_URL` if the address shown is not the one people use) → Redeploy.
4. Portal → Sites → **Storage** → **Connect Google Drive** → sign in with **the company's Google account for the backup** → Allow. The first copy starts by itself.

## Going back
* Vercel → Instant Rollback to update-157. The copies already in Drive stay there; nothing in the databases needs to go back (the
  functions and the table of step 1zf are harmless to the older app – the rollback lines are in the SQL file).
