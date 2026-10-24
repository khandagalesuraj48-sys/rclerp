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
* `node --test test/unit.test.js` – **108 / 108**. New: real file types by their bytes; kept once by SHA-256 (a stand-in store);
  only one's own / the entry's / another entry's files; at most the site's number; two people at one entry; a new row's files
  added to the entry it joins; Scan with Mobile – only the token's fingerprint kept, wrong token, another person, another site,
  second phone, the 5 and 15 minutes, cancel, a new QR ends the old, the computer's poll only for its owner; step 1ze only adds,
  word for word in Read Me.
* `test/browser/att153.js` (real pages: the maker's, a second browser as his phone, the Admin's, the Super Admin's through the
  Portal; real database with steps 1zc + 1zd + 1ze; the rig's stand-in of the file store) – **36 / 36**, every case asked for:
  Ctrl + V; drag-and-drop of a photo and a PDF; several files on one entry; one photo for two shifts (one file in the store);
  Upload files; Camera (a stand-in camera); the correction (turned, suggested cut, the stored file turned and cut); the network
  failing while sending and Done again; two people at one entry; the laptop's QR code → the phone signs in, sends a photo → the
  laptop shows it → saved; the QR code: another person, a wrong token, single use, ran out, cancelled, a new one ends the old, a
  code that is not valid on the phone; an approved entry (the maker refused; the Super Admin with his reason, in the history); a
  billed entry (the same); the bill keeps its files as submitted after the Super Admin's change; the bill's annex and its ZIP
  checked by fingerprint; the bill revised by the Super Admin – the superseded one keeps its files, the new one its own; no script
  error.
* The regression set (clean and Super Admin snapshots) on this branch: see the end of this file.
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks parse; no secret in the change.
* App 3.34.0: see the end of this file.

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
