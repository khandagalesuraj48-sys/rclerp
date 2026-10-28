# update-184 – the vendor's Company Name, Owner Name and documents; the papers only for Own machinery (28-10-2026)

**Asked (28-10-2026, 20:10, with the New vendor and Asset Master screenshots):** "new vendor banwanatana sadhya ekach aahe vendor name tr
tith company name as banaw ani ajun ek fild kr owner name ok ani vendor che attachment add option de je pratek vendor che distil mg tyanch
adhar pan gst asel tr te hi nante udyam bank details as je company la lagtat te vendor warun kadhi pn mi bgu shaku print or download kru
shaku ok ata jya vendor ch nasel tyana blank rahude ok mi ek ek add krel ani attchment pratek vendor sathi lagel supplir aso ki mechinery
aso ok asset master madhe papers fkt own mhanje rachana che ghenar mi je rental debit or other aahet tyanche atatchment nko aaht mala".
With the phone app **3.59.0** (the same, as the app's own screens).

**One database step: `sql/supabase_step1zj_vendor_papers.sql`** – run it once in **every site's Supabase** (VTR NH 848, 18B KOLHAPUR,
HEAD OFFICE, …). It only ADDS two empty columns to `vendors` (`owner_name`, `documents`); no row and no other column is changed. Until
it is run, a vendor is saved as before (the Owner Name and the documents say what to run). No secret in any file.

## What changes
* **Vendor Master → the vendor's form:** the first box is **"Company Name"** (it is the vendor's name, as before – the lists, bills,
  BOQs keep using it). A new box **"Owner Name"** beside it. Both kept with the vendor.
* **Documents** (under the form, for every vendor – a supplier or a machinery's owner): **Aadhaar, PAN, GST certificate, Udyam, Bank
  details (cheque / passbook), Other** – each its **Add** (a PDF or a photo, up to 10 a kind, 30 a vendor; the same box as a bill's
  files). **Saved with "Save vendor"**. A vendor without any stays blank.
* **The vendors list:** a **"Documents"** column – 📎 and how many. Its window: the Owner, then each kind with its files – each
  **Open · Print · Download**. The links work for 15 minutes (opened again, new links).
* **Asset Master:** the papers' box (Tax, PUC, Permit, Fitness, Insurance …) **only for Own** (Rachana's) machinery – for Rental,
  Hired, Debit, Other it is not shown. Papers already typed for them stay in the database (nothing deleted).
* **Vehicle Compliance:** only **Own** machinery (the Ownership choice is gone); its Excel import leaves out the others and says how many.
* The bill's files window (Maintenance 📎): a PDF's sign its own height – its name and buttons inside the box (as in the vendor's).
* Words and help in English, Marathi, Hindi (`app/i18n`; the help rule of update-184 at the end of `FIX_RULES`). New actions
  `vendorDoc` (Vendor Master Edit – one document kept in the private store of step 1ze) and `getVendorDocs` (Vendor Master – the
  documents with their links) in `API_` and in `PAGE_GUIDE`. The Database check (Admin) knows step 1zj.

## Code
| Where | What |
|---|---|
| `app/SupabaseSync.gs` | `vendors`: `Owner Name` → `owner_name`, `Documents` → `documents` (both `'opt'`) |
| `app/Code.gs` | `VENDOR_MORE_`, `VENDOR_DOC_KINDS_`, `vendorColOn_`, `vendorDocsList_` / `vendorDocsOf_` (via `maintFilesOf_`), `getVendorDocs_`; `vendorOut_` owner / docs; `validateVendor_` "Company Name"; `saveVendor_` keeps them only when sent and the columns are there; `uploadAttachment_` 'Vendor Master'; `getBoqs_` `vdocsOn`; `getCompliance_` / `importCompliance_` Own only (`skipped`); the Database check step 1zj |
| `app/App.html` | the form (`v_owner`, `#v_docs_box`, `vDocsPaint`), the list's Documents column (`data-vdocs` → `vDocsView`, print `data-vdp`), `#m_docs_box` only for Own, `cp_own` gone, the import's "left out"; `FIX_RULES`, `PAGE_GUIDE` |
| `sql/supabase_step1zj_vendor_papers.sql`, `app/ReadMe.gs`, `staging/rcl_staging_all.sql` | step 1zj (word for word in the Read Me) |
| `app/i18n` | the new texts appended; their Marathi / Hindi |

## Evidence
* Unit tests: **137 / 137** (`update-184`; the update-181 assertions moved to "Company Name").
* Local test rig (PORTAL=1, RCLSTEPS=1, claude mode) – `test/browser/mnt184.js` **9 / 9**: before step 1zj – "Company Name *", no Owner
  Name, the documents say what to run, a vendor saved as before; step 1zj run twice (only adds); after it – the Owner Name, the six kinds
  each with Add; a PAN (PDF) and an Aadhaar (photo) added and saved with the vendor (each its kind, in the database); the list
  "Documents 📎 2"; its window – Owner, Aadhaar, PAN, each Open / Print / Download inside its box, the download link a download, the
  link opens the file; the Asset Master's papers only for Own; Vehicle Compliance only Own machinery, no ownership choice. Pictures:
  `mnt184_form.png`, `mnt184_docs.png`.
* Also on the rig: `vtype181` 16 / 16 (the vendor's type), `att153` 40 / 40 (the attachments' box), the Portal's own test 119 / 119.
* `node --check` on `server/*.js`, `api/*.js`; the page's scripts parse; no secret in the change.

## Not verified
* The live Supabase / Vercel (step 1zj in the live databases – he runs it); a real phone; printing on a real printer.

## Going back
Vercel → Instant Rollback to the previous update. The two columns can stay (the older update does not read them). Only while no
vendor has an Owner Name or a document: `alter table public.vendors drop column owner_name; alter table public.vendors drop column documents;`
