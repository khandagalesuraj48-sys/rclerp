# update-205 – Vehicle Compliance: the documents of every machinery – the RC Book, the Tax Invoice and the files of every renewal (03-11-2026)

**Asked:** "mala vehicle compliance madhe pratek vehicle ch document upload krta yaw asa haway rc book pn ok ani tya gadich tax invoice
pn ok ani ha je kahi renewal hote te renewal wise asaw mhanje maghche document pn mala bghta yeil". His answers (03-11-2026): "Tax
Invoice" = **the invoice of buying the vehicle**; the database step – **"ho, ase kar"**.

## Database step (approved – he runs it): `sql/supabase_step1zl_compliance_files.sql`
* In **every site's** Supabase → SQL Editor, once. It only **adds one empty column**: `compliance_history.attachments` (text). Nothing
  is deleted or changed. Safe to run again. Shown word for word in Read Me; the database check lists it.
* **Until it is run** Vehicle Compliance works exactly as before; 📎 Documents says the file must be run, and a file is refused with the
  same words (nothing is sent to the store).

## What he gets
* **📎 Documents** under each machinery in Vehicle Compliance (its count of files) opens its documents:
  * **RC Book** and **Tax Invoice** (the invoice of buying it): "+ Add RC Book" / "+ Add Tax Invoice" – the PDF / photos, then the RC No /
    Invoice No, date and remark (optional). **Each one added is a line of its own – a new one does not take the place of the earlier:
    "Latest" and "Earlier" both stay.**
  * **Each paper** (Tax, PUC, Permit, Fitness, Insurance – those its type needs): every renewal of the history (valid upto, renewed on,
    No, ₹, by) **with its own files**. "+ Add file" adds to any renewal, also an old one. A paper whose date was entered before (Asset
    Master / Excel, no renewal in the history) gets a line of its own when its file is added.
  * Each file: look at it, **Open**, **Print**, **Download** (links for 15 minutes).
* **Renewing a paper**: after the dates the attachments' box opens – add the renewed paper's PDF / photos and press Done (Done with no
  file saves the date only; Cancel saves nothing). The file goes with that renewal.
* **Renewal history**: a column **Files** – 📎 n opens that renewal's files.
* The same in the phone app (3.78.0).

## The rules
* Files: PDF, JPG, PNG, at most 3 MB each, at most the site's number a line (Site rules, 10 unless set); kept once in the private store
  (`erp-files`, under their SHA-256 – the Log Book's), **never overwritten or deleted** – files are only added, never taken out.
* Who: **Vehicle Compliance Edit** adds; **View** sees. Only **Own** machinery (as update-184: no papers of Rental / Hired / Debit).
* A file must have been sent by the same person in the last 6 hours (as every attachment). The verification flow (if the Super Admin
  sets one on these saves) keeps the files with the request, as for maintenance bills.
* Activity Log: "Insurance renewed … (1 file)", "RC Book of X: 1 file added (a new line CMP-…)".
* The Drive copy (backup) takes these files with the store's other files (as the vendors' documents).

## What changes
* **Server (`app/Code.gs`)** – `CMP_KEEP_DOCS_`, `cmpFilesOn_`, `cmpFilesReady_`, `cmpFilesOf_`, `cmpRowOut_`, `cmpFiles_`, `getCmpFiles_`;
  `cmpHistAdd_` (the files, the ids made); `renewDoc_` (x.files); `getCompliance_` (files of each line and machinery, `filesOn`, `keep`);
  `uploadAttachment_` ('Vehicle Compliance'); API `cmpDoc`, `cmpFiles`, `getCmpFiles`; the Activity Log; `dbHealth_` (step 1zl).
* **`app/SupabaseSync.gs`** – `compliance_history.attachments` ('opt'). **`app/ReadMe.gs`** – step 1zl. **`staging/rcl_staging_all.sql`** made again.
* **Page (`app/App.html`)** – 📎 Documents (`cpdPaint`, `cpdOpen`, `cpdAdd`), the renew with files, the history's Files column, the page
  guide (3 languages), the help rule (3 languages).
* **rcl-mobile 3.78.0** – `compliance_docs.dart` (CmpDocsScreen, the files of a renewal), `compliance.dart`; the web's help words.

## Evidence
* Unit: `timeout 300 node --test test/unit.test.js` – 157 / 157 (new `update-205`: before step 1zl – refused with what to run, a renewal
  without files as before; a renewal with its file; the RC Book twice – two lines; a file added later to the renewal of the date now; to a
  line by its id; a paper with no line – a line of its own; refusals – another person's file, twice the same, already on the line, no
  file, not a document, not Own, a line of another paper, more than 10; the documents with their links; the counts; the actions and
  their access; step 1zl only adds, Read Me word for word; the page; the help in 3 languages). The page's script blocks parse.
* The rig in Chromium (Postgres + PostgREST + file store, step 1zl run there): 📎 Documents – RC Book added twice (Latest + Earlier),
  Tax Invoice, Insurance renewed with its PDF, a file added later to that renewal; each line saved in the database with its files; the
  photos open from the store; the history's 📎 opens the viewer; no page fault – all passed.
* rcl-mobile 3.78.0: the build on GitHub Actions.

## Not verified
* Not run on the live sites or a real phone. Step 1zl not run on live (he runs it).

## Going back
Vercel → Instant Rollback to update-204. The column stays (empty or with the files' list) and is not read; the files stay in the store.
