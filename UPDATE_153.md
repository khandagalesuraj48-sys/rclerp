# update-153 – attachments of a Log Book entry: paste, drop, upload, camera, Scan with Mobile; photo correction; a bill's files as submitted (24-10-2026)

**Asked (24-10-2026, "RCL ERP — FINAL DEVELOPMENT UPDATE: SMART ATTACHMENTS, QR MOBILE SCAN & LOGBOOK PERMISSIONS", Phases C, D,
E):** "Universal Smart Attachment … Ctrl+V (WhatsApp Web), drag-and-drop, upload files, open camera, scan with mobile … PDFs
supported … multi-entry linking, no duplicate uploads … up to 10 attachments per entry (configurable), optional"; Scan with Mobile:
"laptop generates temporary QR tied to entry or draft; phone scans → secure mobile capture page … → upload → laptop gets event and
shows preview; linked only after validation and Save … ~5 min expiry, high-entropy single-use tokens, store hashed tokens, validate
mobile user's auth, bind to site / user / entry / draft, prevent replay / injection / cross-user, QR alone grants no data … works
across networks"; photo correction: "orientation, straighten, suggested crop with confirmation, perspective, rotate, reset, original
quality, use original, default compression, no duplicate originals"; attachments in bills: "snapshot, dedupe, annex".

Built on update-152 (locks, step 1zd) and update-151 (the bill's evidence, step 1zc): merge after them.

## What changes
### Attachments of a Log Book entry (Phase C)
* **One box** (📎) everywhere an entry is made or changed: a row of the Log Book page (Ctrl + V or a drop on the row opens it with
  the files), the edit window ("📎 Add / change"), and Edit Log Book ("📎 Attach to selected" – the same files on every ticked
  entry, saved at once). In the box: **Ctrl + V** (a photo copied in WhatsApp Web, a screenshot), **drop** photos / PDFs, **Upload
  files**, **Camera** (a phone's own camera; on a computer its webcam, live), **Scan with Mobile**, **From another entry** (a file
  of another row of the page or of a saved entry of the same machinery the day before / after – one photo for two shifts, not sent
  again). Tiles with ✓ / … / !; a file opens big (← →; a PDF in the box or a new tab).
* **Kept once, never changed:** the server works out each file's **SHA-256** and keeps it in the **private** store (bucket
  `erp-files`) under `log/<2>/<sha256>.<jpg|png|pdf>`, never overwritten, never deleted (financial evidence). The same file sent
  again – by anybody, for any entry – is the same object. The page refuses the same file twice in one entry at once.
* **Real files only:** a photo (JPG / PNG) or a PDF, at most 3 MB as sent, checked by its first bytes (a web page called a photo is
  refused). Photos are made smaller on the device first (see Phase D).
* **Only one's own files:** a save takes only files the same person sent in the last 6 hours, files the entry already has, or files
  already kept with another Log Book entry of the site. At most **the site's number** per entry (Settings → Rules of the site:
  1 – 20, **10** unless set).
* **Saved with the entry, all or nothing:** files are sent when the box's Done is pressed and linked when the entry is SAVED (the
  same save – `saveLogRows` adds them to what the entry has; `updateLogRow` sets the list and sends what the entry had when it was
  opened: someone else changed it meanwhile → "changed by someone else … open it again", nothing saved, nothing lost).
* **Locks (update-152):** the list is part of the entry – an approved or billed entry's files are changed only by the Super
  Admin, with his reason; the database's guard writes it into the entry's history.
* The Log Book list and Edit Log Book show **📎 n** on an entry with files (a click shows them).

### Scan with Mobile
* The computer asks for a session (`capStart`): a random id and a **256-bit token**; the server keeps only the token's SHA-256,
  the person, the site, the entry (or the new row), the times. The QR code holds this site's address `?cap=<id>.<token>`.
* The phone (the RCL app's scanner, or the phone's camera → the web page) must be **signed in as the same person at the same site**
  (the QR code alone gives nothing; it is kept through the sign-in). It claims the session **once** (`capClaim` – a second phone is
  refused) within **5 minutes**; the session lives **15 minutes**. The photos taken there (✎ corrected) are sent like any
  attachment and told to the session (`capAdd`).
* The computer asks every **3 s** (5 s after two minutes, never while the page is hidden; `capPoll` – a "question", no save
  number, only its owner learns anything) and shows each photo as it comes. **Nothing is linked by the phone:** the computer saves
  the entry. "New QR code" ends the one before; Stop / Done close it. It works across networks (the phone needs only the internet).

### Photo correction (Phase D)
* A photo is turned upright as the camera wrote it, made **at most 1600 px, JPEG** (about 0.2 – 0.7 MB).
* ✎ on a tile (before it is sent): ⟲ ⟳, **straighten** (±15°, corners filled white), the **four corners** (a cut, or a photo
  taken at an angle made straight – perspective), **✂ Suggest cut** (finds the paper; only shown – used when "Use this" is
  pressed), Whole photo, **Reset**, **Original quality** (up to 3000 px), **Use the original file** (sent as it is, up to 3 MB).
* **One copy only:** the corrected one or the original is sent – never both; correcting a photo already sent is not offered.

### A bill's files (Phase E)
* A submitted bill's evidence (update-151) holds every entry as billed – **with its files** (fingerprints and places). As a file is
  kept under its fingerprint and never changed, the evidence names exactly the bytes that were billed.
* `getBillAttachments`: a saved bill's files as submitted, **each once** with all its entries (a legacy bill: today's, said so).
* View / Print of a saved bill ends with **"Attachments of the Log Book – RA Bill …"** (each file once, photos shown, PDFs marked,
  fingerprint). Saved Bills → **📎 Files**: one **ZIP** of them, named by date, machinery and shift, each **checked against its
  SHA-256** as it is put in, with `FINGERPRINTS.txt`.

### Phone app – App 3.34.0 (`rcl-mobile`, branch `app-attachments-3340`)
The same in the app's own screens: Attachments in the Log Book entry (Camera, Gallery, PDF, the correction screen), 📎 on the entry
card, the app's scanner opens Scan with Mobile's capture screen, the bill annex and the ZIP in RCL Drive, the number in Rules of
this site; the web's help and words taken again.

## The independent security review (24-10-2026) – what it found and what was done
A separate reviewer read the code of update-152 and update-153 (it did not see this report). No high finding; one medium, seven
low. Done in this update:
* **Medium – a change request could change a locked entry's files unseen.** A billed / approved entry's attachments changed by a
  user go to the Super Admin as a change request; the request did not check the files, its summary did not mention them, and its
  approval took any file of the store. Now: the request **checks the files when it is asked** (the person's own of the last 6 hours,
  or one already with an entry) and **keeps their records with the request** (`crAtts_`); its approval takes exactly those
  (`CR_ATT_`) – a file only "in the store" is refused (that fallback is left only for a verification, whose save was checked when it
  was sent). The Approvals line says **"Attachments 2 → 3 (1 added)"** / "(1 taken off)"; "Attach to selected" under a
  verification reads "Attach 2 files to: …" (it read "Delete: …").
* **The QR code's token was kept with a save's answer** (the "saved once" record, up to 24 hours). Now every Scan with Mobile call
  is a "question" (they write no table): no save number, nothing of its answer is kept. Only the token's SHA-256 is kept.
* **Two at the same moment** (the phone's photo told just as the computer closes the QR; two phones claiming at once): each side now
  writes its own record (the session, its end, the phone's files), so a late write never opens a closed session again; the claim
  is counted by the database – only the first phone holds it.
* **No limit on uploads:** at most **300 files and 150 MB a person in a day** (the same file again uses no room and is not counted);
  over it: "You sent too many attachments today … tell the Admin at once" (help in English / मराठी / हिंदी).
* **A legacy bill's files** (a bill from before step 1zc: today's files) were given to users who may not see the Log Book; now only
  to those with Log Book, Machinery Billing or Saved Bills access (as the Log Book list).
* **The preview of a dropped PDF** used the type the file claimed; now the type its bytes say.
* **Step 1ze** makes the bucket private even if a bucket of that name was made by hand before, and its last line says
  "private".
* "Held" attachments of a verification: the marking did nothing (it wrote under the wrong name); attachments are now not held at
  all (one file may be with several entries – the request keeps their records).

Looked at and **not changed** (said plainly):
* The database guard trusts the context the app's save sets (Super Admin / rename). Whoever holds the app's secret key could set it
  too – the guard is a record and a check against changes made outside the app, not against the key's holder. The key lives only in
  Vercel. A rename lets the guard through for the whole entry (the app itself lets only the number change).
* The database does not stop the app's key from deleting a file in the store: the app never deletes or overwrites (x-upsert false),
  the bucket is private, and the ZIP checks every file against its SHA-256 (a changed file shows ✗).
* A file is checked by its first bytes only (a JPG / PNG / PDF header); the store serves it with that type from Supabase's own
  address, never from the app's – it cannot run as a page of the app. A file sent but never saved with an entry stays in the store
  (nothing is deleted – financial evidence); it is not written to the Activity Log (the save that links it is).
* Two people sending the same file at the same second may leave only one of them in the 6-hour note – the other gets "not added
  by you … add it again", and adding it again fixes it.
* A "days back" verification rule does not catch an attachments-only edit (the same as for every edit of an entry before).

## The database step – needs his approval, he runs it
`sql/supabase_step1ze_attachments.sql` – **in every site's Supabase**, after step 1zd. It only **adds**: one empty column
`log_book.attachments` and one **private** Storage bucket `erp-files` (JPG, PNG, PDF; 10 MB a file at most – the app sends 3 MB at
most). Nothing else changes. Safe to run again. Until it is run: everything works as before; adding a file says this step is
needed.

## Files
* `app/Code.gs` – the attachments (`attReady_` … `attMineLinks_`), Scan with Mobile (`capStart_` … `capCancel_`), `saveLogRowsA_`,
  `updateLogRowA_`, `linkLogAttachments_`, `getLogAttachments_`, `getBillAttachments_`; `API_` entries; the Site rule `attachMax`;
  `logRowOut_` (`att`); the sender of a save run at its approval (`FLOW_SENDER_`); the Activity Log line `logAttach`.
* `app/SupabaseSync.gs` (the column), `app/App.html` (the box, the correction, the viewer, Scan with Mobile on both sides, the
  entry page / edit window / list / Edit Log Book, Site rules, the bill annex, the ZIP; FIX_RULES; PAGE_GUIDE), `server/page.js` and
  `server/runtime.js` (`uploadAttachment`, `capPoll` are questions), `app/ReadMe.gs` (step 1ze word for word),
  `staging/rcl_staging_all.sql` (made again), `app/i18n/*`.
* Tests: `test/unit.test.js` (new test update-153), `test/browser/att153.js` (new).

## Evidence (local test rig – never live)
* `node --test test/unit.test.js` – **108 / 108**. The test update-153: real file types by their bytes; kept once by SHA-256 (a
  stand-in store); only one's own / the entry's / another entry's files; at most the site's number; two people at one entry; a new
  row's files added to the entry it joins; Scan with Mobile – only the token's fingerprint kept, wrong token, another person,
  another site, second phone, the 5 and 15 minutes, cancel, a new QR ends the old, the computer's poll only for its owner; step 1ze
  only adds, word for word in Read Me. After the security review also: a write of the phone landing after the computer closed the
  QR (stays closed); two phones at the same moment (only the first); the daily limit (300 files / 150 MB; the same file again not
  counted); a change request's files checked when asked and kept with it, its line "Attachments n → m (…)"; at its approval a file
  only "in the store" refused, the kept record taken; "Attach n files to" (not "Delete").
* `test/browser/att153.js` (real pages: the maker's, a second browser as his phone, the Admin's, the Super Admin's through the
  Portal; real database with steps 1zc + 1zd + 1ze; the rig's stand-in of the file store) – **39 / 39**, every case asked for:
  Ctrl + V; drag-and-drop of a photo and a PDF; several files on one entry; one photo for two shifts (one file in the store);
  Upload files; Camera (a stand-in camera); the correction (turned, suggested cut, the stored file turned and cut); the network
  failing while sending and Done again; two people at one entry; an entry under a verification rule saved with its files at the
  approval; the laptop's QR code → the phone signs in, sends a photo → the laptop shows it → saved; the QR code: another person, a
  wrong token, single use, ran out, cancelled, a new one ends the old, a code that is not valid on the phone; an approved entry
  (the maker refused; the Super Admin with his reason, in the history); a billed entry (the same); the bill keeps its files as
  submitted after the Super Admin's change; the bill's annex and its ZIP checked by fingerprint; the bill revised by the Super
  Admin – the superseded one keeps its files, the new one its own; a billed entry's files sent to the Super Admin as a change
  request ("Attachments 2 → 3 (1 added)"), approved – exactly those files, the history names the request, the bill unchanged; no
  script error.
* **The regression set, the same snapshots on main and on this branch** (steps 1zc + 1zd + 1ze for the branch):
  * clean snapshot: `billlock` 16 / 16, `viewbill` 23 / 23, `bills120` 17 / 17, `gstdecl` 11 / 11, `lbpage` 13 / 13, `rows146`
    29 / 29, `same145` 10 / 10, `entry71` 20 / 20, `again128` 11 / 11, `time144` 17 / 17, `tanker105` 7 / 7, `gap77` 20 / 20 – and
    `fix130` 7 / 3, `splittime` 12 / 6, `group72` 8 / 5, `lg2` 4 / 4, `meter`, `dnui`, `dn`, `ldebit149api`, `saveonce` (they need
    data or servers this snapshot does not have) – **exactly the same numbers on main and on this branch**.
  * Super Admin snapshot (Portal): `flow114` 12 / 12, `flow116` 18 / 18, `billed108` 25 / 25, `ev151` 12 / 12, `sdel134` 6 / 6,
    `remind118` 13 / 13, `ldebit149` 14 / 14, `flow114api` 30 / 30, `lock152` 17 / 17, `att153` 39 / 39.
  * Said plainly: in one run of the whole chain BEFORE the review's changes, `att153` stopped at the phone's sign-in (the phone did
    not open its capture screen; 19 passed, 3 failed). It did not come again in four later runs (alone twice, after `lock152`, the
    whole chain); the test now writes down what the phone shows if it ever does.
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.
* App 3.34.0 (`rcl-mobile` 892aacb): the build – analyze, every test, the screens drawn, Android, iPhone, Windows – passed.

## Storage (Phase F) – measured on the rig with the page's own settings
A drawn 12-megapixel photo of a log book page with a camera's grain (not a real phone's photo):

| | the camera's own file | sent by default (1600 px, JPEG 0.82) | "Original quality" (3000 px, 0.92) |
|---|---|---|---|
| little grain | 2.0 MB | **0.33 MB** | 1.2 MB |
| more grain | 3.0 MB | **0.39 MB** | 1.7 MB |
| much grain | 4.1 MB | **0.45 MB** | 2.2 MB |

* "Use the original file": at most 3 MB (bigger is made smaller). A PDF: at most 3 MB. The phone app uses the same settings.
* The same file is kept once, for every entry and every person; nothing is kept twice by the correction (one copy only); no
  thumbnails (a tile shows the file itself through its 15-minute link – each look downloads it once).
* For a site: 50 entries a day with one photo each ≈ **20 MB a day, about 0.6 GB a month**. Supabase's Free plan has **1 GB of
  files and 5 GB of downloads a month for the whole organization** (every project of it together – the sites, if they are in one
  organization – and the diesel photos already use it); the Pro plan 100 GB of files (then $0.021 a GB) and 250 GB of downloads
  (then $0.09 a GB) – Supabase's billing page, read 24-10-2026. So on the Free plan the files of one busy site fill it in under two
  months. A smaller photo (1280 px, JPEG 0.75 – measured 0.21 – 0.26 MB) would make it last about twice as long; fewer files per
  entry is the Admin's site rule. That is his choice – nothing of it is changed here.

## Not verified
* The live sites; Supabase Storage itself (the rig's stand-in keeps files by name with the same rules: private, x-upsert false →
  "Duplicate", signed links of 15 minutes); a real phone (camera, gallery, the app's scanner on a real QR code), iPhone; two real
  networks (the rig is one machine – but nothing in the design needs the same network: the phone talks only to the site's server);
  the size of real phone photos after the page's compression (the test pictures are drawn, not taken).

## Going back
* Vercel → Instant Rollback to the deployment before this update. Entries saved with files keep their list in the new column;
  the older code does not read it (nothing breaks); the files stay in the private store.
* The column and the bucket are kept (they hold evidence); only while nothing is in them can they be removed (the lines are in
  the SQL file).
