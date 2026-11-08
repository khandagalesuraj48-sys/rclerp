# update-165 – Maintenance Log Book of a site on fuel cards (HO) – step 2 (27-10-2026)

**Asked (27-10-2026):** step 2 of HO ("2 step chalu kr", then "ata aple je thambwalel mi ho ch kam chalu kr"). His answers to the
plan: **one entry = one bill with many lines** (each work / part with its ₹, typed freely – the words typed before are offered); a
**"Service" mark now, with its KM** (step 3, the service schedule, counts from it); the car's log book **on the screen + Excel +
Print**; the bill's **PDF / photos kept with it** and **read by the AI** to fill the form (the person checks it); the fuel comes in by
itself from the fills; **only at a site on fuel cards (HO)**; access through the Portal page **"Maintenance"** (Edit / View; empty =
No access); one SQL step for every site; web + phone app.

**One database step:** `sql/supabase_step1zi_maintenance.sql` – it only ADDS: the table `maintenance` (the bills) and the empty
access column `app_users.perm_maintenance`. **Run it in EVERY site's Supabase** (VTR, 18B, HO). VTR and 18B do not use it; until it
is run at HO, the page says "Maintenance bills cannot be kept yet … supabase_step1zi_maintenance.sql" and the Admin's database check
asks for it.

## What changes
### The page Maintenance (only at a site on fuel cards)
* Menu: Diesel → **Maintenance** (after Fuel Cards). Users & Access → Pages lists **Maintenance** only for such a site (Edit / View,
  empty = No access). A site not on fuel cards: no such page – the server refuses its actions ("This site is not on fuel cards …").
* **A bill:** Bill date, Car, Garage / vendor (earlier ones offered), Bill number, KM reading, **"This bill is a service"** (then the
  KM is required – "a service needs its KM reading – the next service is counted from it"), Remark; **its lines** – each work / part
  with its ₹ (a discount is a minus line; up to 60 lines; the total must be more than 0), the total under them; **its files** – PDF /
  photos, up to 10, in the Log Book's attachment box (kept once under their SHA-256 in the private store, as the Log Book's files;
  no "Scan with Mobile" here).
* **"Read the bill (AI)"** (the site's AI – Gemini): the last file added is read (a PDF as it is, a photo as the page made it
  smaller); its date, bill number, garage, KM, Service and its lines go into the **empty** boxes (the bill's date goes in while the
  date box still has the date it was opened with), **blue – "check every value before saving"**; lines typed already are replaced only
  when the person says so; "the lines read add up to ₹X – the bill says ₹Y", "the bill says the vehicle X – check the car". Nothing
  is saved by the AI. Not set up: "type the bill".
* The **same bill number of the same garage for the car** saved before: asked first ("Saved before? … Save it again?").
* **The list:** the bills of the dates (this month to start with) and of one car (blank = all), newest first, their total; each bill's
  lines, Service, KM, files (open – links of 15 minutes), Edit, Delete (its files stay in the store – a stored file is never deleted).
  The entry lock of the month / bill rules apply as to every entry (`entryOpen_` / `booksOpen_`), and the verification of work, as
  every page that saves.
* **"Maintenance Log Book of a car"**: Car, From, To → **every fill** (Diesel Issue – its card or Cash, litres / kg, KM) **and every
  bill** of the car, by date; Fuel – N fills (by card ₹, cash ₹), Maintenance – N bills, **All costs**; the KM of its Log Book, **₹ per
  KM**, the **last service** (date and KM); "Maintenance by work / part" (times and ₹). **Print (A4 landscape)** and **Excel** (sheets
  "Log Book" and "By work") as every report.
### Everything else
* **A site not on fuel cards (VTR, 18B) works exactly as before.** The Log Book, Diesel Issue, Fuel Cards and every report as before.
* A car renamed in the Master: its bills follow (`renameMachine_`). The Activity Log notes each bill added / changed / deleted.
* The attachment box (`atOpen`) takes the action that keeps a file and its maximum (the Log Book: as before).
* Help in English / मराठी / हिंदी for every new message (`FIX_RULES` – 2 rules), the page's guide (`PAGE_GUIDE` `mnt`), the words of
  the page (`app/i18n`: keys + 92 Marathi / Hindi).
* **The phone app** (rcl-mobile 3.46.0, its own pull request): the same on the app's own screens – Entries → Maintenance (the list, a
  bill with its lines and files, "Read the bill (AI)", Change, Delete) and the car's Maintenance Log Book (screen, Excel, PDF).
* **Order:** this update first, then the app. Then the SQL step in every site; then the Super Admin: Users & Access → Pages →
  Maintenance for those who keep the bills.

## Evidence
* `timeout 300 node --test test/unit.test.js` → **119 / 119 pass** – new `update-165`: a site not on cards refused; a bill saved with
  its lines, Service with its KM, the garage, bill no.; each refusal with its exact message (no line / empty lines, a line without its
  work / ₹, the total not more than 0, a service without KM, more than 60 lines, the car not on site that day / not in the Master, a
  date after today, a file not sent by this person, files not sent right, a web page as a file, View access); the same bill again
  asked first (`force` saves it); a change (its lines and total); the list (newest first, the total, the words typed before by how often); the
  AI's answer checked (`maintAnswer_` – a future date dropped, the lines' sum against the total); the AI off; a PDF sent to Gemini as
  `application/pdf`; the car's log book totals; a rename; the API specs (access, Activity Log); the SQL step only adds; ReadMe and the
  staging copy have it; the page's strings. Every new server message has its help rule (the coverage test).
* **The local rig** (Postgres + PostgREST + the door; the Portal from its main; Mechanical :3000; a Gemini stand-in), the whole way
  `test/browser/mnt165.js` → **32 / 32**: T2 (steps 1zg + 1zh + 1zi run) as HO – the Portal puts it on fuel cards, its Pages list
  has Maintenance (S1's not); a PDF and a photo of a bill kept under their SHA-256; a web page sent as a "PDF" refused; the AI reads
  the bill (sent as `application/pdf`, JSON asked) → its date, bill no., garage, KM, 4 lines, total, Service; saved MT-000001 with its 2
  files; the same bill again asked first; the checks; the list and the words; the files open (the PDF as sent); the car's log book
  (2 fills by card / Cash + 2 bills; fuel ₹3150, maintenance ₹8660, all ₹11810; the last service). **The page:** "Live", the menu has
  Maintenance, the database check sees step 1zi; the bills of this month and the words; "+ Add bill" (the attachment box "Bill files",
  no Scan with Mobile); 2 files sent; "Read the bill (AI)" → the bill's date, garage, bill no., KM, Service, 3 lines in blue, ₹3,540.00;
  a line typed over → saved MT-000003 ₹3640 with its 2 files; Edit with its lines and files → saved; the log book on the screen (Sr,
  Date, Entry, What – each fits its column) and in Excel (sheets "Log Book", "By work"). **S1 (VTR) as before:** Maintenance refused,
  not in the menu, Diesel Inward there, "Live", the database check asks for step 1zi there. No error on the pages. The test's data
  out again.
* With it on the rig, as before: `sync164` 9 / 9, `cards164` 39 / 39, `fuel163` 41 / 41, the Portal's `test/api.test.js` 117 / 117.
* **Every call of the page and the server files counted before / after (acorn, against main): no call is missing** (`App.html`,
  `Code.gs`, `Sites.gs`, `SupabaseData.gs`, `SupabaseSync.gs`, `ReadMe.gs`, `server/runtime.js`, `server/page.js`).
* `node --check` on `server/*.js`, `api/*.js`; the page's script blocks and every `.gs` file parse; no secret in the change.

## Not verified
* The live sites: nothing changes until the SQL step is run (and HO is on fuel cards – it is) and the page is given in the Portal.
* A real garage bill read by Gemini (the rig's stand-in answers what the test tells it; the request – the PDF as `application/pdf`,
  the JSON asked – is checked).
* The Google Sheet backup of `maintenance` on the live backup run (the backup finds tables from the database's own list; not run).

## Going back
* Vercel → Instant Rollback to update-164 (its fix deploy). The table and the column can stay (only this update reads them). If
  wanted (the bills are lost): `drop table public.maintenance; alter table public.app_users drop column perm_maintenance;`
